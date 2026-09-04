# Transcript flag audit — live database

_Queried 2026-09-03 against project `sbldlebgtonaxtofflnw` (Vector Equine). All `session_transcript_segments` rows. No rules were changed._

## How to read this

`transcript_flag_audit` is the view A2a added so flagging would beat deletion: keep the row, name the rule, look at what it caught. That view is empty. The numbers you asked for from it are zeros. The rest of the file is why, and then the same breakdowns computed by running the **current** `flagSegment` rules against every stored `text` — which is what display and the cleaned corpus actually do today, because `text_cleaned` is also empty and `readCleanedTranscript` falls through to `cleanAsrText`.

Stored `text` is the evidence. Nothing here is a recommendation.

## 1. What `transcript_flag_audit` contains

| | Count |
|---|---:|
| Total segments (`session_transcript_segments`) | 1160 |
| Flagged (`flag_reason` IS NOT NULL = rows in `transcript_flag_audit`) | **0** |
| Flagged as % of total | **0%** |
| Sessions with any segment | 29 |
| Sessions with any stored flag | 0 |

Breakdown by `flag_reason`: none. There are no stored reasons to rank.

Twenty most common texts per rule: none.

`hallucination:short_crumb` distinct values: none stored.

`hallucination:vocab_dump` (VOCAB_DUMP_RE) distinct values: none stored.

Whisper vs browser among stored flags: none stored.

Every named rule is dead **as a stored flag**. That is a write-path finding, not a statement that the rules never match speech.

## 2. Why the audit view is empty

`flag_reason` is a generated column: `raw_json ->> 'exclusion_reason'`. On this database:

- 0 rows have an `exclusion_reason` key in `raw_json`.
- 0 rows have `text_cleaned`.
- 36 rows have `excluded_from_corpus = true`. All 36 of those are `speaker = 'vector'` (the Brief 14 trigger). Zero rider or trainer rows are excluded by the column.
- `raw_json.engine` is `whisper` on 65 rows, `browser` on 0, unmarked on 1095.
- Row `created_at` spans 2026-07-21 to 2026-08-16. A2a landed 29 Aug 2026. **No live segment has been written since.**

So A2a stopped deletion in code, and no subsequent lesson has exercised the write path that fills `exclusion_reason`. Historical rows were never backfilled.

## 3. What still keeps speech off the screen and out of the cleaned corpus

`readCleanedTranscript` skips a row if `flag_reason` is set (never, today), then takes `text_cleaned` (never) or `cleanAsrText(text)`. `cleanAsrText` returns an empty string when `classifyHallucination` matches, and empty strings are dropped. Live GET `/segments` does the same.

`fetchTrainerCorpusSegments(..., "cleaned")` uses that reader, so those rows never reach polish or Ask.

`fetchTrainerCorpusSegments(..., "raw")` filters on stored `flag_reason` and `excluded_from_corpus`. With both unset for rider/trainer speech, **short crumbs still reach a raw corpus read.** The SQL view `trainer_corpus_segments` agrees: it only excludes `vector` and `excluded_from_corpus`.

That is the gap: storage kept the words; display and cleaned consumers still throw them away at read time; the audit view cannot see it.

## 4. Current rules replayed against every stored `text`

Same functions as production (`flagSegment` / `classifyHallucination`). No row has Whisper quality numbers, so `no_speech_prob`, `avg_logprob`, and `compression_ratio` cannot fire here.

| | Count | % of all segments |
|---|---:|---:|
| Total segments | 1160 | 100% |
| Would be flagged by current rules | 135 | 11.6% |
| Of those, already `excluded_from_corpus` (vector only) | 0 | |
| Of those, rider/trainer rows display+cleaned-corpus drop at read time | 135 | |

### By `flag_reason`, ordered by frequency

| flag_reason | Count | % of flagged | % of all segments |
|---|---:|---:|---:|
| `hallucination:short_crumb` | 107 | 79.3% | 9.2% |
| `hallucination:boilerplate` | 15 | 11.1% | 1.3% |
| `hallucination:prompt_shaped` | 9 | 6.7% | 0.8% |
| `hallucination:prompt_echo` | 4 | 3.0% | 0.3% |

### Twenty most common distinct `text` values per rule

#### `hallucination:short_crumb` (107 segments)

| Count | Text |
|---:|---|
| 88 | `Yeah` |
| 12 | `Yes` |
| 6 | `No` |
| 1 | `That` |

#### `hallucination:boilerplate` (15 segments)

| Count | Text |
|---:|---|
| 10 | `Thank you for watching.` |
| 2 | `Transcribe only clear speech.` |
| 1 | `Thanks` |
| 1 | `Bye` |
| 1 | `Speakers may say Hey Vector or Vector.` |

#### `hallucination:prompt_shaped` (9 segments)

| Count | Text |
|---:|---|
| 1 | `Lots of coding I'm trying to get like a transcript going so like when I am having a conversation with my trainer` |
| 1 | `Records what what it does we're saying and then create a transcript so I can use it to annotate whatever` |
| 1 | `But like keep a conversation like roughly going because it's supposed to create a transcript like if you scroll down can you see it recording what I'm saying versus like what you're saying` |
| 1 | `OK so the way this works as technically it's like a sea coach but it's recorded in a conversation between Ryder and Trainor and then creating a transcript and then after people are done writing it creates a summary and kinda list out the movements that you guys worked on and` |
| 1 | `At Super Bowl I mean yeah the transcript itself is super helpful because then I feel like you know I feel like half the time I like forget what I was told so I can go back and be like what the hell did she say about the half pass or like my left seat bone and then it's written out` |
| 1 | `Not real I mean maybe the only thing I can think of is that like making it private like as long as like other people can't access your transcripts that way like I know some things like you wouldn't want other people to hear that you've said in a lesson so either way to like cut that out if you do show someone your transcript or just a way to like` |
| 1 | `I'm assuming like other people can't see your transcript unless you show it to them` |
| 1 | `Yeah is it create a transcript on your side with like what I'm saying cause that was something I pushed to because before it wasn't recording what Elizabeth was OK` |
| 1 | `So this is recording what I'm saying here and it's also creating a transcript, and then when the trainer connects their call it's also recording with the trainer as well, so it's like rider blah blah.` |

#### `hallucination:prompt_echo` (4 segments)

| Count | Text |
|---:|---|
| 1 | `Thank you for watching!` |
| 1 | `This whisper looks like it's just saying thank you for watching over and over.` |
| 1 | `If the audio is silent or only noise, return an empty transcript.` |
| 1 | `Speech violence against women featuring strangulation.` |

### `hallucination:short_crumb` — every distinct value

107 segments, 4 distinct values.

| Count | Text |
|---:|---|
| 88 | `Yeah` |
| 12 | `Yes` |
| 6 | `No` |
| 1 | `That` |

### `hallucination:vocab_dump` (VOCAB_DUMP_RE) — every distinct value

No stored text matches this rule.

### Whisper path vs browser-ASR path (replayed flags)

`raw_json.engine` is how the two paths are marked. Unmarked rows have no `engine` field — that is the older live browser-ASR write, before provenance.

| Path | All segments | Replayed flags | % of that path flagged |
|---|---:|---:|---:|
| whisper | 65 | 17 | 26.2% |
| browser | 0 | 0 | — |
| unmarked | 1095 | 118 | 10.8% |

Among replayed flags only:

| Path | Count | % of replayed flags |
|---|---:|---:|
| unmarked | 118 | 87.4% |
| whisper | 17 | 12.6% |

Replayed flags by path and rule:

| Path | flag_reason | Count |
|---|---|---:|
| unmarked | `hallucination:short_crumb` | 107 |
| whisper | `hallucination:boilerplate` | 13 |
| unmarked | `hallucination:prompt_shaped` | 9 |
| whisper | `hallucination:prompt_echo` | 4 |
| unmarked | `hallucination:boilerplate` | 2 |

## 5. Rules that have never fired

Two different meanings of never.

### As a stored `flag_reason` on the live database

All of them. The audit view has zero rows.

| Rule | Role in code |
|---|---|
| `empty` | `flagSegment` on blank text |
| `no_speech_prob` | Whisper `no_speech_prob` > 0.35 |
| `avg_logprob` | Whisper `avg_logprob` < −0.85 |
| `compression_ratio` | Whisper `compression_ratio` > 2.2 |
| `hallucination:empty` | `classifyHallucination` blank — **unreachable** from `flagSegment`, which returns `empty` first |
| `hallucination:boilerplate` | exact YouTube/prompt leftovers |
| `hallucination:prompt_echo` | substring prompt leftovers |
| `hallucination:vocab_dump` | VOCAB_DUMP_RE gait-stack / aids-stack |
| `hallucination:watermark_short` | short “thanks for watching” — **unreachable** if boilerplate or prompt_echo already matched |
| `hallucination:subscribe_short` | short subscribe leftover — **unreachable** if boilerplate or prompt_echo already matched |
| `hallucination:prompt_shaped` | long instructional sentence with transcribe/transcript vocabulary |
| `hallucination:short_crumb` | ≤12 chars matching the crumb list, including `No.` / `Yes.` |
| `superseded_by_whisper` | browser row replaced after a Whisper write for the same window |

### Against stored `text` (replay)

These current rules match **no** stored segment:

- `empty`
- `no_speech_prob`
- `avg_logprob`
- `compression_ratio`
- `hallucination:empty`
- `hallucination:vocab_dump`
- `hallucination:watermark_short`
- `hallucination:subscribe_short`
- `superseded_by_whisper`

Quality rules cannot fire: no row stores `raw_json.quality`. `superseded_by_whisper` is write-path only and is not something `flagSegment` would attach to `text`. `watermark_short` and `subscribe_short` sit after broader rules that already catch the same phrases.

## 6. Notes that are facts, not a decision

- Replaying rules on historical `text` is not the same as a stored audit. Pre-A2a cleanup may already have deleted the worst Whisper crumbs before insert, so this replay **under-counts** what the rules would have caught on raw ASR.
- `cleanAsrText` is still destructive at read time: a match becomes `""` and the line vanishes from display. That is why “No.” can exist in `text` and still reach nobody who reads the cleaned transcript.
- A fresh lesson after A2a is what would populate `transcript_flag_audit` for real. This file is the stand-in until that exists.

