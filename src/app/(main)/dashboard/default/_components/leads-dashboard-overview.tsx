"use client";

import { useMemo } from "react";
import {
  Users,
  Flame,
  CalendarClock,
  Zap,
  TrendingUp,
  CheckCircle2,
  Clock,
  TrendingDown,
} from "lucide-react";
import { Bar, BarChart, Cell, Pie, PieChart, XAxis } from "recharts";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

import type { LeadRow } from "./leads-dashboard-table";

const L = {
  violet: "#7c3aed",
  teal: "#0d9488",
  cyan: "#0891b2",
  amber: "#d97706",
  rose: "#e11d48",
  slate: "#64748b",
} as const;

const BAR_FILLS = [L.violet, L.teal, L.cyan, L.amber, L.rose, "#6366f1", "#8b5cf6", "#14b8a6"];

const chartConfig = {
  count: { label: "Leads", color: L.violet },
  slice: { label: "Share", color: L.teal },
};

export interface LeadPerformanceStats {
  converted: number;
  renewed: number;
  in_progress: number;
  not_contacted: number;
  lost: number;
  success_rate: number;
  renewed_directly: number;
  end_date_changed: number;
  priced: number;
}

export interface TeamLeadStat {
  employee_id: number | null;
  employee_name: string;
  count?: number;
  lead_count?: number;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  end.setHours(0, 0, 0, 0);
  return Math.ceil((end.getTime() - today.getTime()) / (86400 * 1000));
}

export function LeadsDashboardOverview({
  leads,
  performance,
  teamStats,
  loading,
}: {
  leads: LeadRow[];
  performance: LeadPerformanceStats | null;
  teamStats: TeamLeadStat[];
  loading: boolean;
}) {
  const metrics = useMemo(() => {
    let ending60 = 0;
    let callbackish = 0;
    let volume = 0;
    for (const l of leads) {
      const du = daysUntil(l.end_date);
      if (du != null && du >= 0 && du <= 60) ending60 += 1;
      const st = (l.stage_name || "").toLowerCase();
      if (st.includes("callback") || st.includes("call back")) callbackish += 1;
      if (l.annual_usage) volume += Number(l.annual_usage);
    }
    return {
      pipeline: leads.length,
      ending60,
      callbackish,
      volume,
    };
  }, [leads]);

  const stageBars = useMemo(() => {
    const m = new Map<string, number>();
    for (const l of leads) {
      const k = l.stage_name?.trim() || "Unknown";
      m.set(k, (m.get(k) || 0) + 1);
    }
    return [...m.entries()]
      .map(([stage, count]) => ({ stage: stage.length > 18 ? `${stage.slice(0, 16)}…` : stage, count, full: stage }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [leads]);

  const pieSlices = useMemo(() => {
    const top = stageBars.slice(0, 5);
    const rest = stageBars.slice(5).reduce((s, x) => s + x.count, 0);
    const slices = top.map((t, i) => ({
      name: t.full,
      value: t.count,
      fill: BAR_FILLS[i % BAR_FILLS.length],
    }));
    if (rest > 0) slices.push({ name: "Other stages", value: rest, fill: "#cbd5e1" });
    return slices;
  }, [stageBars]);

  const successPct =
    performance != null ? Number(performance.success_rate || 0).toFixed(1) : "0";
  const successNum = Math.min(100, Math.max(0, parseFloat(successPct) || 0));

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center rounded-2xl border border-slate-200/80 bg-white shadow-sm">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-violet-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-b from-violet-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-violet-100">
          <CardHeader className="pb-2">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
              <Users className="h-6 w-6 text-violet-700" strokeWidth={2} />
            </div>
            <CardTitle className="text-4xl font-bold tabular-nums text-slate-900">{metrics.pipeline}</CardTitle>
            <CardDescription className="text-sm font-semibold text-slate-700">Active pipeline</CardDescription>
          </CardHeader>
          <CardFooter className="pt-0 text-sm text-slate-600">Open opportunities (Lost excluded)</CardFooter>
        </Card>

        <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-b from-teal-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-teal-100">
          <CardHeader className="pb-2">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-teal-100">
              <CalendarClock className="h-6 w-6 text-teal-700" strokeWidth={2} />
            </div>
            <CardTitle className="text-4xl font-bold tabular-nums text-slate-900">{metrics.ending60}</CardTitle>
            <CardDescription className="text-sm font-semibold text-slate-700">Ending within 60 days</CardDescription>
          </CardHeader>
          <CardFooter className="pt-0 text-sm text-slate-600">By contract end date</CardFooter>
        </Card>

        <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-b from-amber-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-amber-100">
          <CardHeader className="pb-2">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <Flame className="h-6 w-6 text-amber-700" strokeWidth={2} />
            </div>
            <CardTitle className="text-4xl font-bold tabular-nums text-slate-900">{metrics.callbackish}</CardTitle>
            <CardDescription className="text-sm font-semibold text-slate-700">Callback / follow-up</CardDescription>
          </CardHeader>
          <CardFooter className="pt-0 text-sm text-slate-600">Stage name contains “callback”</CardFooter>
        </Card>

        <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-b from-cyan-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-cyan-100">
          <CardHeader className="pb-2">
            <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-100">
              <Zap className="h-6 w-6 text-cyan-700" strokeWidth={2} />
            </div>
            <CardTitle className="text-3xl font-bold tabular-nums text-slate-900">
              {(metrics.volume / 1000).toFixed(0)}k
              <span className="text-lg font-semibold text-slate-600"> kWh</span>
            </CardTitle>
            <CardDescription className="text-sm font-semibold text-slate-700">Annual usage in view</CardDescription>
          </CardHeader>
          <CardFooter className="pt-0 text-sm text-slate-600">Sum of usage on loaded leads</CardFooter>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Leads by stage</CardTitle>
            <CardDescription>Where your pipeline sits today</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {stageBars.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
                No stages to chart yet
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
                <BarChart data={stageBars} margin={{ left: 4, right: 4, top: 12, bottom: 8 }}>
                  <XAxis
                    dataKey="stage"
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    tick={{ fill: "#64748b", fontSize: 10 }}
                    height={56}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {stageBars.map((_, i) => (
                      <Cell key={`sb-${i}`} fill={BAR_FILLS[i % BAR_FILLS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            )}
          </CardContent>
        </Card>

        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Stage mix</CardTitle>
            <CardDescription>Top stages by volume</CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            {pieSlices.length === 0 ? (
              <div className="flex h-[240px] items-center justify-center text-sm text-slate-500">
                No distribution yet
              </div>
            ) : (
              <ChartContainer config={chartConfig} className="aspect-auto h-[240px] w-full">
                <PieChart>
                  <Pie
                    data={pieSlices}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    innerRadius={58}
                    outerRadius={88}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {pieSlices.map((entry, index) => (
                      <Cell key={`pc-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            )}
          </CardContent>
          {pieSlices.length > 0 && (
            <CardFooter className="flex flex-wrap justify-center gap-3 text-xs text-slate-600">
              {pieSlices.slice(0, 4).map((s) => (
                <span key={s.name} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.fill }} />
                  {s.name.length > 14 ? `${s.name.slice(0, 12)}…` : s.name}: {s.value}
                </span>
              ))}
            </CardFooter>
          )}
        </Card>

        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
          <CardHeader>
            <CardTitle className="text-lg font-bold text-slate-900">Team load</CardTitle>
            <CardDescription>Leads per salesperson</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[260px] space-y-3 overflow-y-auto pr-1">
            {teamStats.length === 0 ? (
              <p className="py-8 text-center text-sm text-slate-500">No team breakdown from API</p>
            ) : (
              teamStats.slice(0, 8).map((t, index) => {
                const n = t.lead_count ?? t.count ?? 0;
                const max = Math.max(...teamStats.map((x) => x.lead_count ?? x.count ?? 0), 1);
                const w = (n / max) * 100;
                const c = BAR_FILLS[index % BAR_FILLS.length];
                return (
                  <div key={`${t.employee_id}-${t.employee_name}`} className="space-y-1">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="truncate font-medium text-slate-800">{t.employee_name}</span>
                      <span className="shrink-0 tabular-nums text-slate-600">{n}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full transition-all" style={{ width: `${w}%`, backgroundColor: c }} />
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      </div>

      {/* Outcomes (from performance API) */}
      {performance && (
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
          <CardHeader className="flex flex-col gap-4 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Pipeline outcomes</CardTitle>
              <CardDescription>Snapshot from CRM performance</CardDescription>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:min-w-[200px] sm:items-end">
              <span className="text-4xl font-bold tabular-nums text-slate-900">{successPct}%</span>
              <span className="text-xs font-medium text-slate-500">Conversion hint</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 sm:w-48">
                <div
                  className="h-full rounded-full bg-teal-500 transition-all"
                  style={{ width: `${successNum}%` }}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-xl border border-emerald-100 bg-gradient-to-b from-emerald-50/80 to-white p-4 shadow-sm ring-1 ring-emerald-100/60">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" strokeWidth={2} />
                </div>
                <div className="text-3xl font-bold tabular-nums text-slate-900">{performance.converted}</div>
                <div className="mt-1 text-sm font-semibold text-emerald-800">Converted</div>
              </div>
              <div className="rounded-xl border border-sky-100 bg-gradient-to-b from-sky-50/80 to-white p-4 shadow-sm ring-1 ring-sky-100/60">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-sky-100">
                  <TrendingUp className="h-5 w-5 text-sky-600" strokeWidth={2} />
                </div>
                <div className="text-3xl font-bold tabular-nums text-slate-900">{performance.in_progress}</div>
                <div className="mt-1 text-sm font-semibold text-sky-800">In progress</div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-gradient-to-b from-amber-50/80 to-white p-4 shadow-sm ring-1 ring-amber-100/60">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" strokeWidth={2} />
                </div>
                <div className="text-3xl font-bold tabular-nums text-slate-900">{performance.not_contacted}</div>
                <div className="mt-1 text-sm font-semibold text-amber-800">Not contacted</div>
              </div>
              <div className="rounded-xl border border-rose-100 bg-gradient-to-b from-rose-50/80 to-white p-4 shadow-sm ring-1 ring-rose-100/60">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-100">
                  <TrendingDown className="h-5 w-5 text-rose-600" strokeWidth={2} />
                </div>
                <div className="text-3xl font-bold tabular-nums text-slate-900">{performance.lost}</div>
                <div className="mt-1 text-sm font-semibold text-rose-800">Lost</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
