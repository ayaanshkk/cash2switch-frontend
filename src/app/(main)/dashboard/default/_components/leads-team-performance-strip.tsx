"use client";

import { useState, useEffect, useRef } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Users, BarChart3, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { fetchWithAuth } from "@/lib/api";
import type { TeamLeadStat } from "./leads-dashboard-overview";
import {
  ProgressRing,
  firstName,
  getInitials,
  TEAM_STRIP_RING_SIZE,
  useTeamStripVisibleCount,
} from "@/components/StaffPerformanceGrid";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export interface LeadsTeamStatRow {
  employee_id: number | null;
  employee_name: string;
  count: number;
  /** From GET /api/crm/leads/stats-by-employee-detailed */
  by_stage?: { stage_name: string; count: number }[];
}

/** Ring color by relative load vs busiest teammate (high = heavier). Mirrors Team Performance legend shape. */
function loadRateColor(pct: number): string {
  if (pct >= 60) return "#dc2626";
  if (pct >= 35) return "#d97706";
  if (pct > 0) return "#16a34a";
  return "#d1d5db";
}

function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) {
      setV(0);
      return;
    }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
  }, [target, duration]);
  return v;
}

function LeadLoadStripCard({
  row,
  maxCount,
  onClick,
  delay,
}: {
  row: LeadsTeamStatRow;
  maxCount: number;
  onClick: () => void;
  delay: number;
}) {
  const relativePct = maxCount > 0 ? Math.round((row.count / maxCount) * 100) : 0;
  const display = useCountUp(relativePct, 1000);
  const stroke = loadRateColor(relativePct);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-[108px] flex-col items-center gap-2.5 rounded-2xl px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/50"
      style={{ animation: `cp-stagger-up 0.45s ${delay}ms cubic-bezier(0.22,1,0.36,1) both` }}
    >
      <div className="relative flex-shrink-0 transition-transform duration-300 ease-out group-hover:scale-[1.04] group-active:scale-[0.98]">
        <ProgressRing rate={relativePct} size={TEAM_STRIP_RING_SIZE} colorAtRate={loadRateColor} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 select-none items-center justify-center rounded-2xl bg-gradient-to-br from-stone-800 to-black text-xs font-bold text-white shadow-inner ring-2 ring-white/90 transition-shadow duration-300 group-hover:shadow-md">
            {getInitials(row.employee_name)}
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold leading-tight text-stone-800 transition-colors group-hover:text-stone-950">
          {firstName(row.employee_name)}
        </p>
        <p className="text-[11px] font-bold tabular-nums" style={{ color: stroke }}>
          {display}%
        </p>
        <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wide text-stone-400">vs peak</p>
      </div>
    </button>
  );
}

export function LeadStageBreakdownDialog({
  open,
  onOpenChange,
  name,
  total,
  stages,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  name: string;
  total: number;
  stages: { stage_name: string; count: number }[];
}) {
  const sum = stages.reduce((s, x) => s + x.count, 0);
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <BarChart3 className="h-5 w-5 text-violet-600" />
            Lead stages — {name}
          </DialogTitle>
          <DialogDescription>
            Counts by CRM stage for active pipeline leads (no project row yet). Total:{" "}
            <span className="font-semibold text-slate-900">{total.toLocaleString()}</span>
            {sum !== total && (
              <span className="text-amber-600"> · stages sum {sum.toLocaleString()}</span>
            )}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-2 space-y-2">
          {stages.length === 0 ? (
            <p className="text-sm text-slate-500">No stage breakdown available.</p>
          ) : (
            <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-slate-50/50">
              {stages.map((row) => (
                <li
                  key={row.stage_name}
                  className="flex items-center justify-between gap-3 px-4 py-3 text-sm first:rounded-t-xl last:rounded-b-xl"
                >
                  <span className="font-medium text-slate-800">{row.stage_name}</span>
                  <span className="tabular-nums font-semibold text-violet-700">
                    {row.count.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Shared loader for dashboard Leads tab and /dashboard/leads — detailed stats with fallback. */
export async function loadTeamStatsWithFallback(service: string): Promise<{
  teamStats: TeamLeadStat[];
  teamStripStats: LeadsTeamStatRow[];
}> {
  try {
    const detailedResp = await fetchWithAuth(
      `/api/crm/leads/stats-by-employee-detailed?service=${encodeURIComponent(service)}`
    );
    const detailedPayload = detailedResp as {
      employees?: Array<{
        employee_id: number;
        employee_name: string;
        total: number;
        by_stage?: { stage_name: string; count: number }[];
      }>;
    };
    const emps = detailedPayload?.employees;
    if (emps && Array.isArray(emps)) {
      const rows: TeamLeadStat[] = emps.map((e) => ({
        employee_id: e.employee_id ?? null,
        employee_name: e.employee_name ?? "—",
        lead_count: Number(e.total ?? 0),
        count: Number(e.total ?? 0),
      }));
      const strip: LeadsTeamStatRow[] = emps.map((e) => ({
        employee_id: e.employee_id,
        employee_name: e.employee_name,
        count: e.total,
        by_stage: e.by_stage ?? [],
      }));
      return { teamStats: rows, teamStripStats: strip };
    }
  } catch (e) {
    console.warn("[leads-team] stats-by-employee-detailed failed, falling back:", e);
  }

  try {
    const fb = await fetchWithAuth(
      `/api/crm/leads/stats-by-employee?service=${encodeURIComponent(service)}`
    );
    const stats = (
      fb as { stats?: Array<{ employee_id: number | null; employee_name: string; count: number }> }
    )?.stats;
    if (stats && Array.isArray(stats)) {
      const rows: TeamLeadStat[] = stats.map((s) => ({
        employee_id: s.employee_id ?? null,
        employee_name: s.employee_name ?? "—",
        lead_count: Number(s.count ?? 0),
        count: Number(s.count ?? 0),
      }));
      const strip: LeadsTeamStatRow[] = stats.map((s) => ({
        employee_id: s.employee_id,
        employee_name: s.employee_name,
        count: Number(s.count ?? 0),
        by_stage: [] as { stage_name: string; count: number }[],
      }));
      return { teamStats: rows, teamStripStats: strip };
    }
  } catch (e) {
    console.warn("[leads-team] stats-by-employee fallback failed:", e);
  }

  return { teamStats: [], teamStripStats: [] };
}

export function LeadsTeamPerformanceStrip({
  stats,
  loading,
  isAdmin,
  myLeadCount,
  className,
}: {
  stats: LeadsTeamStatRow[];
  loading: boolean;
  isAdmin: boolean;
  myLeadCount: number;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const showViewAllLeads = !pathname?.startsWith("/dashboard/leads");
  const [modal, setModal] = useState<{
    open: boolean;
    name: string;
    total: number;
    stages: { stage_name: string; count: number }[];
  }>({ open: false, name: "", total: 0, stages: [] });

  const adminStripItemCount = isAdmin && !loading ? stats.length : 0;
  const { ref: stripRowRef, visibleCount: stripVisibleCount } = useTeamStripVisibleCount(adminStripItemCount);

  const openBreakdown = (row: LeadsTeamStatRow) => {
    setModal({
      open: true,
      name: row.employee_name,
      total: row.count,
      stages: row.by_stage ?? [],
    });
  };

  if (loading) {
    return (
      <div
        className={cn(
          "crm-panel flex gap-5 overflow-hidden rounded-[28px] p-5",
          className
        )}
      >
        {Array.from({ length: isAdmin ? 6 : 1 }).map((_, i) => (
          <div key={i} className="flex min-w-[108px] flex-col items-center gap-2 animate-pulse">
            <div
              className="rounded-full bg-stone-200/80"
              style={{ width: TEAM_STRIP_RING_SIZE, height: TEAM_STRIP_RING_SIZE }}
            />
            <div className="h-2.5 w-14 rounded bg-stone-200/70" />
            <div className="h-2 w-8 rounded bg-stone-200/60" />
          </div>
        ))}
      </div>
    );
  }

  if (!isAdmin) {
    const myStages = stats[0]?.by_stage ?? [];
    const myName = stats[0]?.employee_name || "You";
    return (
      <>
        <div className={cn("crm-panel rounded-[28px] px-5 pb-5 pt-4", className)}>
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white shadow-sm">
              <Users className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-stone-900">Your lead load</p>
              <p className="text-xs text-stone-500">
                {myLeadCount.toLocaleString()} active lead{myLeadCount === 1 ? "" : "s"} in your pipeline
              </p>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-8">
            <div className="relative flex-shrink-0">
              <ProgressRing rate={100} size={TEAM_STRIP_RING_SIZE} colorAtRate={() => "#16a34a"} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="flex h-12 w-12 select-none items-center justify-center rounded-2xl bg-gradient-to-br from-stone-800 to-black text-xs font-bold text-white shadow-inner ring-2 ring-white/90">
                  {getInitials(myName)}
                </div>
              </div>
            </div>
            <div className="text-center sm:text-left">
              <p className="text-3xl font-extrabold tabular-nums text-stone-900">{myLeadCount.toLocaleString()}</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-stone-400">leads</p>
              {myStages.length > 0 && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-3 border-stone-200 bg-white text-stone-800 hover:bg-stone-50"
                  onClick={() =>
                    setModal({
                      open: true,
                      name: myName,
                      total: myLeadCount,
                      stages: myStages,
                    })
                  }
                >
                  <BarChart3 className="mr-2 h-4 w-4" />
                  View by stage
                </Button>
              )}
            </div>
          </div>
        </div>
        <LeadStageBreakdownDialog
          open={modal.open}
          onOpenChange={(o) => setModal((m) => ({ ...m, open: o }))}
          name={modal.name}
          total={modal.total}
          stages={modal.stages}
        />
      </>
    );
  }

  const strip = [...stats].sort((a, b) => a.employee_name.localeCompare(b.employee_name));
  const stripVisible = strip.slice(0, stripVisibleCount);
  const maxCount = Math.max(...strip.map((s) => s.count), 1);
  const total = strip.reduce((s, x) => s + x.count, 0);
  const avgPerPerson = strip.length > 0 ? Math.round(total / strip.length) : 0;
  const subtitle = `${strip.length} members · ${total.toLocaleString()} in pipeline · avg ${avgPerPerson} per person`;

  if (strip.length === 0) {
    return (
      <div
        className={cn(
          "crm-panel rounded-[28px] px-5 py-8 text-center text-sm text-stone-500",
          className
        )}
      >
        No per-person lead counts yet — assign leads from the Leads page to see workload here.
      </div>
    );
  }

  return (
    <>
      <div className={cn("crm-panel rounded-[28px] px-5 pb-5 pt-4", className)}>
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white shadow-sm">
            <Users className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-stone-900">Team lead load</p>
            <p className="text-xs text-stone-500">{subtitle}</p>
          </div>
          {showViewAllLeads && (
            <button
              type="button"
              onClick={() => router.push("/dashboard/leads")}
              className="group ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 active:scale-[0.98]"
            >
              View all
              <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          )}
        </div>

        <div ref={stripRowRef} className="min-w-0 flex gap-6 overflow-x-hidden pb-2">
          {stripVisible.map((s, i) => (
            <LeadLoadStripCard
              key={s.employee_id ?? `emp-${i}`}
              row={s}
              maxCount={maxCount}
              onClick={() => openBreakdown(s)}
              delay={i * 45}
            />
          ))}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-200/80 pt-3 text-[11px] text-stone-500">
          <span className="font-medium text-stone-600">Load vs peak</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#dc2626" }} />
            ≥ 60% heavy
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#d97706" }} />
            35–59% elevated
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#16a34a" }} />
            {"< 35%"} lighter
          </span>
        </div>
      </div>

      <LeadStageBreakdownDialog
        open={modal.open}
        onOpenChange={(o) => setModal((m) => ({ ...m, open: o }))}
        name={modal.name}
        total={modal.total}
        stages={modal.stages}
      />
    </>
  );
}
