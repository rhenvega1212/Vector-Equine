"use client";

import { Plus, Trash2, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { BlockEditorProps, QuizSettings } from "@/lib/blocks/types";

type Question = QuizSettings["questions"][number];

export function QuizBlockEditor({ block, onUpdate }: BlockEditorProps) {
  const settings = block.settings as QuizSettings;
  const questions = settings.questions ?? [];
  const passingPercent = settings.passingPercent ?? 70;

  function updateQuestions(next: Question[]) {
    onUpdate({ settings: { ...settings, questions: next } });
  }

  function setQuestion(index: number, patch: Partial<Question>) {
    updateQuestions(
      questions.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  }

  function removeQuestion(index: number) {
    updateQuestions(questions.filter((_, i) => i !== index));
  }

  function addQuestion() {
    updateQuestions([
      ...questions,
      { question: "", options: ["", ""], correctIndex: 0 },
    ]);
  }

  function setOption(qIdx: number, oIdx: number, value: string) {
    const opts = [...questions[qIdx].options];
    opts[oIdx] = value;
    setQuestion(qIdx, { options: opts });
  }

  function addOption(qIdx: number) {
    setQuestion(qIdx, { options: [...questions[qIdx].options, ""] });
  }

  function removeOption(qIdx: number, oIdx: number) {
    const q = questions[qIdx];
    const opts = q.options.filter((_, i) => i !== oIdx);
    const correctIndex = q.correctIndex >= opts.length ? 0 : q.correctIndex;
    setQuestion(qIdx, { options: opts, correctIndex });
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Label className="text-slate-300">Passing %</Label>
        <Input
          type="number"
          min={0}
          max={100}
          value={passingPercent}
          onChange={(e) =>
            onUpdate({
              settings: { ...settings, passingPercent: Number(e.target.value) },
            })
          }
          className="w-20 border-white/10 bg-white/[0.03] text-white"
        />
      </div>

      {questions.map((q, qIdx) => (
        <div
          key={qIdx}
          className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="text-xs font-medium text-slate-400">
              Question {qIdx + 1}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-slate-400 hover:text-red-400"
              onClick={() => removeQuestion(qIdx)}
            >
              <Trash2 size={14} />
            </Button>
          </div>

          <Input
            value={q.question}
            onChange={(e) => setQuestion(qIdx, { question: e.target.value })}
            placeholder="Question text…"
            className="border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
          />

          <div className="space-y-2">
            <Label className="text-xs text-slate-400">
              Options (select the correct answer)
            </Label>
            {q.options.map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`q-${qIdx}-correct`}
                  checked={q.correctIndex === oIdx}
                  onChange={() => setQuestion(qIdx, { correctIndex: oIdx })}
                  className="h-4 w-4 border-slate-600 bg-slate-800 text-cyan-400 focus:ring-cyan-400/50"
                />
                <Input
                  value={opt}
                  onChange={(e) => setOption(qIdx, oIdx, e.target.value)}
                  placeholder={`Option ${oIdx + 1}`}
                  className="flex-1 border-white/10 bg-white/[0.03] text-white placeholder:text-slate-500"
                />
                {q.options.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-slate-400 hover:text-red-400"
                    onClick={() => removeOption(qIdx, oIdx)}
                  >
                    <Minus size={14} />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-slate-400 hover:text-cyan-400"
              onClick={() => addOption(qIdx)}
            >
              <Plus size={12} className="mr-1" /> Add Option
            </Button>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs text-slate-400">
              Explanation (optional)
            </Label>
            <textarea
              value={q.explanation ?? ""}
              onChange={(e) =>
                setQuestion(qIdx, { explanation: e.target.value || undefined })
              }
              placeholder="Why this answer is correct…"
              rows={2}
              className="w-full resize-y rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-cyan-400 focus:outline-none"
            />
          </div>
        </div>
      ))}

      <Button
        variant="outline"
        size="sm"
        className="border-dashed border-white/20 text-slate-300 hover:border-cyan-400 hover:text-cyan-400"
        onClick={addQuestion}
      >
        <Plus size={14} className="mr-1" /> Add Question
      </Button>
    </div>
  );
}
