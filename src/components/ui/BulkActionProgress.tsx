"use client";

import { Check, X } from "lucide-react";

interface Props {
  visible: boolean;
  progress: number;       // 0–100
  label: string;
  sublabel?: string;
  total?: number;
  done: boolean;
  doneLabel?: string;     // overrides the default "Deleted N records" message
  stackOffset?: number;   // stacks this widget below another one (0 = top)
  onDismiss: () => void;
}

export function BulkActionProgress({ visible, progress, label, sublabel, total, done, doneLabel, stackOffset = 0, onDismiss }: Props) {
  if (!visible) return null;

  const radius = 28;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;
  const topPx = 16 + stackOffset * 108; // stack 108px apart

  return (
    <div className="fixed right-4 z-[9999] flex items-center gap-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 shadow-xl rounded-xl px-4 py-3 min-w-[220px] max-w-[280px] transition-all" style={{ top: `${topPx}px` }}>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
      {/* Progress circle */}
      <div className="relative shrink-0">
        <svg width="64" height="64" viewBox="0 0 64 64">
          {/* Track */}
          <circle
            cx="32" cy="32" r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="5"
            className="text-zinc-100 dark:text-zinc-800"
          />
          {/* Progress arc */}
          {progress < 5 && !done ? (
            // Indeterminate spinner when progress not yet meaningful
            <circle
              cx="32" cy="32" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={`${circumference * 0.25} ${circumference * 0.75}`}
              className="text-blue-500 origin-center"
              style={{ animation: "spin 1s linear infinite", transformOrigin: "32px 32px" }}
            />
          ) : (
            <circle
              cx="32" cy="32" r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={done ? 0 : offset}
              transform="rotate(-90 32 32)"
              className={done ? "text-emerald-500" : "text-blue-500"}
              style={{ transition: "stroke-dashoffset 0.4s ease" }}
            />
          )}
        </svg>
        {/* Centre content */}
        <div className="absolute inset-0 flex items-center justify-center">
          {done ? (
            <Check className="h-5 w-5 text-emerald-500 shrink-0" />
          ) : progress >= 5 ? (
            <span className="text-[13px] font-semibold text-zinc-800 dark:text-zinc-100">
              {Math.round(progress)}%
            </span>
          ) : null}
        </div>
      </div>

      {/* Text */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-zinc-800 dark:text-zinc-100 leading-tight">
          {done
            ? (doneLabel ?? `Deleted ${total} record${(total ?? 0) !== 1 ? "s" : ""} successfully`)
            : label}
        </p>
        {!done && sublabel && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 truncate">{sublabel}</p>
        )}
      </div>

      {/* Dismiss — only when done */}
      {done && (
        <button
          onClick={onDismiss}
          className="shrink-0 p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-zinc-400" />
        </button>
      )}
    </div>
  );
}
