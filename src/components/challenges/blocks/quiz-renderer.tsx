"use client";

import { useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { BlockRendererProps, QuizSettings } from "@/lib/blocks/types";

export function QuizBlockRenderer({ block, onComplete }: BlockRendererProps) {
  const settings = block.settings as QuizSettings;
  const questions = settings.questions ?? [];
  const passingPercent = settings.passingPercent ?? 70;

  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    questions.map(() => null),
  );
  const [submitted, setSubmitted] = useState(false);

  function select(qIdx: number, oIdx: number) {
    if (submitted) return;
    setAnswers((prev) => prev.map((v, i) => (i === qIdx ? oIdx : v)));
  }

  function submit() {
    setSubmitted(true);
    const correct = questions.filter(
      (q, i) => answers[i] === q.correctIndex,
    ).length;
    const pct = questions.length > 0 ? (correct / questions.length) * 100 : 0;
    if (pct >= passingPercent && onComplete) onComplete();
  }

  const score = submitted
    ? questions.filter((q, i) => answers[i] === q.correctIndex).length
    : 0;

  return (
    <div className="space-y-6">
      {questions.map((q, qIdx) => {
        const isCorrect = submitted && answers[qIdx] === q.correctIndex;
        const isWrong = submitted && answers[qIdx] !== null && answers[qIdx] !== q.correctIndex;

        return (
          <div
            key={qIdx}
            className="space-y-3 rounded-lg border border-white/10 bg-white/[0.03] p-4"
          >
            <p className="text-sm font-medium text-white">
              {qIdx + 1}. {q.question}
            </p>

            <div className="space-y-2">
              {q.options.map((opt, oIdx) => {
                const selected = answers[qIdx] === oIdx;
                const optCorrect = submitted && oIdx === q.correctIndex;
                const optWrong = submitted && selected && oIdx !== q.correctIndex;

                let ring = "border-white/10";
                if (!submitted && selected) ring = "border-cyan-400 bg-cyan-400/10";
                if (optCorrect) ring = "border-green-500 bg-green-500/10";
                if (optWrong) ring = "border-red-500 bg-red-500/10";

                return (
                  <button
                    key={oIdx}
                    type="button"
                    disabled={submitted}
                    onClick={() => select(qIdx, oIdx)}
                    className={`flex w-full items-center gap-3 rounded-lg border px-4 py-2.5 text-left text-sm transition-colors ${ring} ${
                      submitted ? "cursor-default" : "cursor-pointer hover:border-white/20"
                    }`}
                  >
                    <input
                      type="radio"
                      readOnly
                      checked={selected}
                      className="h-4 w-4 border-slate-600 bg-slate-800 text-cyan-400 focus:ring-0"
                    />
                    <span className="flex-1 text-slate-200">{opt}</span>
                    {optCorrect && <CheckCircle2 size={16} className="text-green-400" />}
                    {optWrong && <XCircle size={16} className="text-red-400" />}
                  </button>
                );
              })}
            </div>

            {submitted && (isCorrect || isWrong) && q.explanation && (
              <p className="rounded-md bg-white/[0.05] px-3 py-2 text-xs text-slate-400">
                {q.explanation}
              </p>
            )}
          </div>
        );
      })}

      {!submitted ? (
        <Button
          onClick={submit}
          disabled={answers.some((a) => a === null)}
          className="bg-cyan-500 text-white hover:bg-cyan-600 disabled:opacity-40"
        >
          Submit Answers
        </Button>
      ) : (
        <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-white/[0.03] px-4 py-3">
          <span className="text-sm text-slate-300">
            Score: <span className="font-semibold text-white">{score}/{questions.length}</span>
          </span>
          <span className="text-xs text-slate-500">
            ({Math.round((score / Math.max(questions.length, 1)) * 100)}% — need {passingPercent}% to pass)
          </span>
          {score / Math.max(questions.length, 1) * 100 >= passingPercent ? (
            <CheckCircle2 size={16} className="text-green-400" />
          ) : (
            <XCircle size={16} className="text-red-400" />
          )}
        </div>
      )}
    </div>
  );
}
