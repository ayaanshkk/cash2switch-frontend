"use client";

import { cn } from "@/lib/utils";
import { RefreshCw, Sparkles } from "lucide-react";

export type DashboardMainView = "renewals" | "leads";

const items: {
  id: DashboardMainView;
  label: string;
  short: string;
  description: string;
  icon: typeof RefreshCw;
}[] = [
  {
    id: "renewals",
    label: "Renewals",
    short: "Renewals",
    description: "Contracts & expiries",
    icon: RefreshCw,
  },
  {
    id: "leads",
    label: "Leads",
    short: "Leads",
    description: "Pipeline & opportunities",
    icon: Sparkles,
  },
];

export function DashboardViewSwitcher({
  value,
  onChange,
  className,
}: {
  value: DashboardMainView;
  onChange: (v: DashboardMainView) => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative isolate flex w-full flex-col gap-3 sm:w-auto sm:min-w-[min(100%,380px)]",
        className
      )}
      role="tablist"
      aria-label="Dashboard view"
    >
      <div className="relative rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1.5 shadow-inner shadow-slate-300/40 backdrop-blur-sm dark:border-slate-700/50 dark:bg-slate-900/40">
        <div className="grid grid-cols-2 gap-1 sm:flex sm:gap-1">
          {items.map((item) => {
            const active = value === item.id;
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => onChange(item.id)}
                className={cn(
                  "relative flex min-h-[52px] flex-col items-center justify-center gap-0.5 rounded-xl px-4 py-2.5 text-center transition-all duration-200 sm:min-h-0 sm:flex-1 sm:flex-row sm:gap-2 sm:px-5",
                  active
                    ? "bg-white text-slate-900 shadow-md shadow-slate-400/25 ring-1 ring-slate-200/90 dark:bg-slate-800 dark:text-white dark:ring-slate-600"
                    : "text-slate-500 hover:bg-white/60 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800/50 dark:hover:text-slate-200"
                )}
              >
                <span
                  className={cn(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                    active
                      ? item.id === "renewals"
                        ? "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                        : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"
                      : "bg-slate-200/60 text-slate-500 dark:bg-slate-800 dark:text-slate-500"
                  )}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.25} />
                </span>
                <span className="flex flex-col items-center sm:items-start">
                  <span className="text-sm font-semibold leading-tight">{item.short}</span>
                  <span
                    className={cn(
                      "hidden text-[11px] font-medium leading-tight sm:block",
                      active ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-500"
                    )}
                  >
                    {item.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
