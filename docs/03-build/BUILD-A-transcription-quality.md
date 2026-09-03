# BUILD A · Transcription Quality

**Milestone 1, Section A.** No hardware required. Can start immediately against sessions already recorded.

---

## Why this section comes first

The transcript is not a convenience feature. It is the label source for the entire training pipeline: what the trainer said, when she said it, joined later to video and sensor data. Every downstream model inherits this error rate. If the transcript is wrong, the labels are wrong, and no amount of sensor precision fixes that.

Two known problems to solve:

1. Whisper generates fluent text over silence and background noise, so the transcript contains speech nobody said.
2. Dressage terminology is transcribed incorrectly, which is exactly the vocabulary that carries the coaching signal.

Both have cheap fixes. Neither requires changing models.

---

## Ground rules for this section

- **Do not change the model.** The fixes here are a preprocessing step and a decoding hint.
- **Do not delete or overwrite any existing transcript data.** Some of it is the only recording of real sessions that exists.
- **Measure before and after.** Right now "not accurate enough" is a feeling. Every change in this section must be justified by a number.
- **A1 is an audit and it gates everything else.** Report findings before writing code for A2 onward.

---

## A1 · Audit what is currently stored

**Goal:** establish ground truth about the current transcription path before changing it.

Investigate and report back on:

- Which Whisper implementation is in use. OpenAI API, `faster-whisper`, `whisper.cpp`, or something else. This determines whether VAD and prompting are configuration or new code.
- Whether the raw Whisper output is persisted separately from the Claude-cleaned version, or whether cleanup overwrites the original. Name the table and columns.
- Whether transcript rows record which model produced them.
- How audio reaches the transcriber: one mixed track, or separate tracks per participant.
- How speaker attribution is currently determined.
- Whether the session recordings Rhen has captured still have their original audio available, or only the derived transcript.

**Acceptance:** a written summary answering each of the above, with file paths and table names. No code changes in this task.

**Do not** begin A2 until this is reported and reviewed.

---

## A2 · Raw transcript becomes immutable

**Goal:** the raw Whisper output is ground truth and is never modified. The cleaned version is a separate derived artifact.

An LLM cleaning a transcript that becomes training labels is a real risk. If cleanup normalises "haunches in" to "travers", or quietly corrects what it thinks the trainer meant, the result reads perfectly and is wrong. A garbled transcript is visibly suspect; a confidently rewritten one is not.

**Implement:**

- Raw and cleaned transcripts are distinguishable rows or columns, never the same field.
- The cleanup step writes a new record. It never issues an update against the raw record.
- Both variants are retrievable for a given session.
- Rider-facing debrief may read the cleaned variant. Anything that will be used for labeling reads the raw variant, with the cleaned one available alongside for comparison.

If A1 finds that both are already stored, this task reduces to enforcing the rule in code and adding a test.

**Acceptance:** a test that fails if cleanup mutates a raw transcript record.

---

## A3 · Build the measurement harness

**Goal:** a repeatable way to score transcription accuracy, so A4 through A6 can be justified with numbers rather than impressions.

**Implement a script that:**

- Takes a session's audio, a hand-corrected reference transcript, and a generated transcript.
- Reports **overall word error rate** using standard normalisation: lowercase, strip punctuation, collapse whitespace, expand numerals consistently.
- Reports **lexicon term accuracy** separately: of the dressage terms present in the reference, what proportion appear correctly in the output.
- Reports **insertion rate during non-speech**, which is the phantom-text problem. Count words produced in time ranges the reference marks as silent.

The three numbers matter independently. Overall word error rate can stay flat while lexicon accuracy improves substantially, and lexicon accuracy is the one that determines label quality. Reporting only the aggregate will hide the improvement that actually matters.

**Acceptance:** the script runs against one session and emits all three numbers. Output is a file, not console text, so results can be compared across runs.

---

## A4 · Baseline measurement

**Goal:** a number to improve against.

Rhen hand-corrects a reference transcript for a representative sample of a real session. Recommend fifteen to twenty minutes containing both trainer instruction and rider speech, with normal arena noise.

Run A3's harness against the current pipeline. Record all three numbers, the session used, and the date.

**Acceptance:** baseline recorded in a file committed to the repo.

**Note:** if the numbers are poor and the audio is audibly poor to a human listener, the problem is the microphone, not the model. Establish that before proceeding, because no model work fixes bad input.

---

## A5 · Voice activity detection

**Goal:** eliminate transcription of silence.

Run Silero VAD ahead of Whisper so the model only ever receives segments containing speech. This is the standard fix for the phantom-text behaviour.

If `faster-whisper` is in use, this is a configuration flag rather than new code. If the OpenAI API is in use, VAD has to run before the audio is sent, which also reduces cost by not uploading silence.

**Implement:**

- VAD segmentation ahead of transcription.
- VAD parameters recorded in session metadata alongside the model version, so a transcript can be traced to the exact configuration that produced it.
- Segment timestamps preserved through to the final transcript. Do not lose timing while segmenting; the whole product depends on it.

**Acceptance:** re-run A3's harness. Insertion rate during non-speech should drop substantially. Record the delta.

---

## A6 · Dressage lexicon prompt

**Goal:** bias decoding toward correct terminology.

Whisper accepts a prompt that conditions decoding. Supplying the working vocabulary of the discipline improves recognition of exactly the terms that carry coaching signal.

**Implement:**

- A lexicon file in the repo, editable without a code change. Rhen owns its contents.
- The lexicon is passed as the decoding prompt on every transcription request.
- The lexicon version is recorded in session metadata.

Starting vocabulary, to be extended by Rhen: travers, renvers, shoulder-in, half-pass, leg yield, half-halt, on the bit, on the aids, pirouette, piaffe, passage, extended trot, collected canter, counter canter, flying change, tempi changes, haunches in, haunches out, inside leg, outside rein, throughness, impulsion, engagement, connection, suppling, transitions, serpentine, volte, tracking up, overtracking, behind the vertical, above the bit, croup, poll, hindquarters, forehand.

**Constraint:** the prompt is limited to roughly 224 tokens. The list will need to be prioritised rather than exhaustive. Favour terms that are frequently used, frequently mis-transcribed, and consequential when wrong.

**Acceptance:** re-run A3's harness. Lexicon term accuracy should improve. Record the delta. If it does not move, report that rather than tuning further; it means the failure is acoustic rather than linguistic.

---

## A7 · Separate channels per participant

**Goal:** correct speaker attribution, for free.

The rider and trainer are each on their own phone with their own microphone. If those channels are transcribed independently before mixing, attribution is structurally correct and requires no speaker diarisation. If audio is mixed first, attribution becomes guesswork, and it matters a great deal whether a line was an instruction from the trainer or a question from the rider.

**Implement:**

- Record per-participant tracks rather than only a composite mix.
- Transcribe each track independently.
- Merge the resulting transcripts into one timeline ordered by timestamp, with speaker identity attached to each segment from the track it came from.
- Preserve the composite mix if it is currently used for playback; this task adds tracks, it does not remove one.

**Invariant to write into the code:** never mix audio before transcribing.

**Acceptance:** a transcript from a two-participant session where every segment carries a correct speaker, verified by hand against the audio.

---

## A8 · Pin and record the model version

**Goal:** any transcript can be traced to the exact configuration that produced it.

Transcription will run in two places: the cloud at tier 1, and the edge device at tier 2. Two implementations of the thing the labeling thesis rests on will drift unless the version is pinned in both and treated as part of the contract. A tier 1 and a tier 2 recording of the same lesson must not read differently.

**Implement, recorded in session metadata:**

- Model name and exact version.
- VAD implementation and parameters.
- Lexicon version.
- Which path produced it, cloud or edge device.

**Acceptance:** given any transcript record, all four are retrievable.

---

## Definition of done for Section A

- Raw transcripts are immutable and cleanup is a separate artifact, enforced by a test.
- A measurement harness exists and produces three numbers.
- A baseline is recorded, and a post-change measurement is recorded alongside it.
- VAD runs ahead of transcription and phantom text is measurably reduced.
- The lexicon is in place, versioned, and editable by Rhen.
- Speaker attribution comes from separate channels, not inference.
- Every transcript is traceable to the configuration that produced it.

---

## Out of scope for Section A

- Changing the transcription model.
- Building the edge device transcription path. That is Section F and Milestone 2, but A8 exists so that path can be made consistent when it arrives.
- Improving the cleaned or debrief text. Section A is about the raw signal only.
- Microphone or hardware changes, though A4 may reveal they are needed.
