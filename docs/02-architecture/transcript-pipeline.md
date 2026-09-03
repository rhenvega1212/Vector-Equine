# Transcript pipeline — raw storage, cleaned display

Read this before touching anything that writes or reads
`session_transcript_segments`.

## The invariant

> **Storage is raw. Display is cleaned. The two are never the same operation,
> and no display concern ever justifies changing what is stored.**

Before this, cleanup ran inside transcription. Utterances that looked like
Whisper hallucinations were deleted before they were ever written, which made a
false positive indistinguishable from silence. The rule that drops any utterance
of twelve characters or fewer matching a list of common words was removing
`No.` — and in a dressage lesson the short utterances are the timing markers,
which is the signal the product exists to measure.

Nothing in this pipeline deletes a segment any more. Suspect text is flagged and
kept.

## Columns

| Column | Meaning |
|---|---|
| `text` | Verbatim ASR output. Immutable. Never write a cleaned or polished value here. |
| `text_cleaned` | Cleaned rendering for display and model input. NULL means clean `text` at read time. |
| `excluded_from_corpus` | Keep this row out of training data. True for all `vector` rows by trigger. |
| `flag_reason` | Generated from `raw_json.exclusion_reason`. NULL means no rule fired. |
| `raw_json.quality` | Whisper's three per-segment signals. |
| `raw_json` provenance | `engine`, `model`, `prompt_version`, `vad`, `producing_path`. |

Rows written before this landed hold cleaned text in `text` and NULL in
`text_cleaned`. Cleanup is idempotent, so they render the same as they always
did — but their verbatim text is gone and is not recoverable.

## Reading

There is no default reader. Pick one, in `src/lib/capture/transcript-read.ts`:

- **`readRawTranscript`** — verbatim, flagged rows included. Ground truth,
  audits, corpus construction, hand-correcting a reference transcript.
- **`readCleanedTranscript`** — display text, flagged rows removed. Anything a
  person reads or a model is given.

For trainer-method and corpus work go through `fetchTrainerCorpusSegments`,
which takes the variant as a required argument and excludes both `vector` rows
and flagged rows. The `trainer_corpus_segments` view enforces the same two
exclusions for SQL consumers.

Display filters on `flag_reason`, not on `excluded_from_corpus` — Vector's own
spoken lines are excluded from the corpus by design and still belong on screen.

## Auditing the flag rules

Every rule here has false positives. Flagging only beats deleting if somebody
actually looks:

```sql
-- What has each rule removed from the corpus lately?
SELECT flag_reason, count(*), min(created_at), max(created_at)
FROM transcript_flag_audit
WHERE created_at > now() - interval '30 days'
GROUP BY flag_reason
ORDER BY 2 DESC;

-- What did the twelve-character rule actually catch?
SELECT created_at, speaker, text
FROM transcript_flag_audit
WHERE flag_reason = 'hallucination:short_crumb'
ORDER BY created_at DESC
LIMIT 50;
```

If that second query is full of real speech, the rule is wrong. That is the
conversation the audit view exists to make possible.

## Audio

Mic chunks are stored in the `session-videos` bucket under
`capture-audio/<capture_session_id>/<speaker>/<offset>-<chunk_id>.<ext>`, with
one `session_media_assets` row per chunk at `kind = 'audio_recording'`.

Storage never blocks a lesson. The upload runs after the response via
`waitUntil`, failures log and nothing else, and a session with no storage still
produces a complete transcript. Because the upload can fail, no path is recorded
on the transcript row — segments carry `raw_json.audio_chunk_id` and the asset
row is the only claim that audio exists.

Retention is `VECTOR_CONFIG.SESSION_AUDIO_RETENTION_DAYS`, currently zero
meaning keep forever. Nothing enforces it; there is no deletion job.

To listen to a session end to end:

```bash
npx dotenv-cli -e .env.local -- npx tsx scripts/assemble-session-audio.ts --capture <id>
```

Chunks come from recorder stop/restart, so there are gaps between them. The
script pads them with silence so offsets still line up with the session clock,
and reports total and largest gap. A naive concatenation sounds fine and puts
every timestamp after the first gap in the wrong place.

## Not wired

Re-transcription from stored audio. The previous implementation deleted every
segment for each speaker it re-transcribed and was inert only because no audio
existed. It is removed rather than left to be rediscovered — see git history.
Reviving it needs a design that writes alongside existing rows.
