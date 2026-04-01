"use client";

import { useState, useEffect, useRef } from "react";
import {
  Users,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  Clock,
  TrendingDown,
  Search,
  ChevronLeft,
  Sparkles,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

/* ─── Types ─── */
interface StaffStat {
  employee_id: number;
  employee_name: string;
  total_contacts: number;
  converted_count: number;
  total_value_touched: number;
  conversion_rate: number;
  renewed_count: number;
  in_progress_count: number;
  not_contacted_count: number;
  lost_count: number;
  renewed_directly_count: number;
  end_date_changed_count: number;
  priced_count: number;
}

interface StaffPerformanceGridProps {
  employeeId?: number;
}

/* ─── Conversion color (original): green / amber / red / gray by band ─── */
export function rateColor(rate: number): string {
  if (rate >= 60) return "#16a34a";
  if (rate >= 35) return "#d97706";
  if (rate > 0) return "#dc2626";
  return "#d1d5db";
}

/** Bar fill: green / amber / red / gray tiers (matches ring) */
function conversionBarGradient(rate: number): string {
  if (rate >= 60) return "linear-gradient(90deg, #15803d 0%, #22c55e 100%)";
  if (rate >= 35) return "linear-gradient(90deg, #b45309 0%, #f59e0b 100%)";
  if (rate > 0) return "linear-gradient(90deg, #b91c1c 0%, #ef4444 100%)";
  return "linear-gradient(90deg, #9ca3af 0%, #d1d5db 100%)";
}

/* Muted but distinct outcome tiles — not a full rainbow; 4 related hues */
const OUTCOME_STYLES = {
  renewed_count: {
    card: "border-emerald-200 bg-emerald-50",
    icon: "text-emerald-600",
    num: "text-emerald-950",
    label: "text-emerald-800",
  },
  in_progress_count: {
    card: "border-sky-200 bg-sky-50",
    icon: "text-sky-600",
    num: "text-sky-950",
    label: "text-sky-800",
  },
  not_contacted_count: {
    card: "border-amber-200 bg-amber-50",
    icon: "text-amber-600",
    num: "text-amber-950",
    label: "text-amber-900",
  },
  lost_count: {
    card: "border-rose-200 bg-rose-50",
    icon: "text-rose-600",
    num: "text-rose-950",
    label: "text-rose-900",
  },
} as const;

export function getInitials(n: string) {
  const p = n.trim().split(/\s+/);
  return p.length === 1
    ? p[0].slice(0, 2).toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

export function firstName(n: string) {
  return n.trim().split(/\s+/)[0];
}

/* ─── Animated counter ─── */
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

/** Shared ring diameter for Team Performance (renewals) and Team lead load (leads) horizontal strips */
export const TEAM_STRIP_RING_SIZE = 88;

/* ─── Progress ring ─── */
export function ProgressRing({
  rate,
  size = 80,
  colorAtRate = rateColor,
}: {
  rate: number;
  size?: number;
  /** Defaults to renewal conversion bands; pass a custom mapper for e.g. lead load. */
  colorAtRate?: (rate: number) => string;
}) {
  const sw = 5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);
  const stroke = colorAtRate(rate);

  useEffect(() => {
    const id = setTimeout(() => setDash((Math.min(100, Math.max(0, rate)) / 100) * circ), 80);
    return () => clearTimeout(id);
  }, [rate, circ]);

  return (
    <svg width={size} height={size} className="drop-shadow-sm" style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(226 232 240 / 0.95)" strokeWidth={sw} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 0.95s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

/* ─── Strip avatar ─── */
function StripCard({ stat, onClick, delay }: { stat: StaffStat; onClick: () => void; delay: number }) {
  const rate = useCountUp(stat.conversion_rate, 1000);
  const stroke = rateColor(stat.conversion_rate);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-[108px] flex-col items-center gap-2.5 rounded-2xl px-1 py-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/50"
      style={{ animation: `cp-stagger-up 0.45s ${delay}ms cubic-bezier(0.22,1,0.36,1) both` }}
    >
      <div className="relative flex-shrink-0 transition-transform duration-300 ease-out group-hover:scale-[1.04] group-active:scale-[0.98]">
        <ProgressRing rate={stat.conversion_rate} size={TEAM_STRIP_RING_SIZE} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-12 w-12 select-none items-center justify-center rounded-2xl bg-gradient-to-br from-stone-800 to-black text-xs font-bold text-white shadow-inner ring-2 ring-white/90 transition-shadow duration-300 group-hover:shadow-md">
            {getInitials(stat.employee_name)}
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold leading-tight text-stone-800 transition-colors group-hover:text-stone-950">
          {firstName(stat.employee_name)}
        </p>
        <p className="text-[11px] font-bold tabular-nums" style={{ color: stroke }}>
          {rate}%
        </p>
      </div>
    </button>
  );
}

const outcomeMeta = [
  { key: "renewed_count", label: "Renewed", icon: CheckCircle2 },
  { key: "in_progress_count", label: "In progress", icon: TrendingUp },
  { key: "not_contacted_count", label: "Not contacted", icon: Clock },
  { key: "lost_count", label: "Lost", icon: TrendingDown },
] as const;

/* ─── Team grid card ─── */
function DetailCard({ stat, delay }: { stat: StaffStat; delay: number }) {
  const rate = useCountUp(stat.conversion_rate, 1000);
  const stroke = rateColor(stat.conversion_rate);

  return (
    <div
      className="group flex flex-col gap-5 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-stone-300 hover:shadow-md"
      style={{ animation: `cp-stagger-up 0.45s ${delay}ms cubic-bezier(0.22,1,0.36,1) both` }}
    >
      <div className="flex items-center gap-4">
        <div className="relative flex-shrink-0">
          <ProgressRing rate={stat.conversion_rate} size={TEAM_STRIP_RING_SIZE} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-12 w-12 select-none items-center justify-center rounded-2xl bg-gradient-to-br from-stone-800 to-black text-xs font-bold text-white shadow-sm ring-2 ring-white">
              {getInitials(stat.employee_name)}
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-bold leading-tight text-stone-900">{stat.employee_name}</p>
          <p className="mt-0.5 text-sm text-stone-500">{stat.total_contacts} contacts</p>
        </div>

        <div className="flex-shrink-0 text-right">
          <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color: stroke }}>
            {rate}%
          </p>
          <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-stone-400">conversion</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {outcomeMeta.map(({ key, label, icon: Icon }) => {
          const val = stat[key as keyof StaffStat] as number;
          const st = OUTCOME_STYLES[key as keyof typeof OUTCOME_STYLES];
          return (
            <div
              key={key}
              className={cn(
                "flex items-start gap-3 rounded-xl border px-3.5 py-3 shadow-sm transition-shadow duration-200 hover:shadow-md",
                st.card,
              )}
            >
              <Icon className={cn("mt-0.5 h-4 w-4 flex-shrink-0", st.icon)} />
              <div className="min-w-0">
                <p className={cn("text-lg font-bold tabular-nums leading-tight", st.num)}>{val}</p>
                <p className={cn("mt-0.5 whitespace-nowrap text-[10px] font-semibold uppercase tracking-wide", st.label)}>
                  {label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Single-member spotlight (richer layout, animations) ─── */
function MemberSpotlight({ stat, delay }: { stat: StaffStat; delay: number }) {
  const rate = useCountUp(stat.conversion_rate, 1100);
  const [barOn, setBarOn] = useState(false);
  const stroke = rateColor(stat.conversion_rate);

  useEffect(() => {
    const t = requestAnimationFrame(() => setBarOn(true));
    return () => cancelAnimationFrame(t);
  }, [stat.conversion_rate]);

  return (
    <div
      className="cp-performance-modal-surface relative overflow-hidden rounded-2xl border border-stone-200 bg-white p-8 shadow-md"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="relative z-[1] flex flex-col gap-8 md:flex-row md:items-start md:gap-10">
        <div className="flex flex-col items-center gap-4 md:items-start">
          <div
            className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-stone-800 to-black text-2xl font-bold tracking-tight text-white shadow-lg ring-4 ring-white/90"
            style={{ animation: `cp-stagger-up 0.5s ${delay + 40}ms cubic-bezier(0.22,1,0.36,1) both` }}
          >
            {getInitials(stat.employee_name)}
            <span className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full bg-white shadow-md ring-2 ring-stone-200/80">
              <Sparkles className="h-3.5 w-3.5 text-stone-700" />
            </span>
          </div>
          <div className="text-center md:text-left">
            <h3 className="text-xl font-bold tracking-tight text-stone-900">{stat.employee_name}</h3>
            <p className="mt-1 text-sm text-stone-500">Performance snapshot · {stat.total_contacts} contacts</p>
          </div>
        </div>

        <div className="min-w-0 flex-1 space-y-6">
          <div
            className="space-y-3"
            style={{ animation: `cp-stagger-up 0.5s ${delay + 80}ms cubic-bezier(0.22,1,0.36,1) both` }}
          >
            <div className="flex items-end justify-between gap-4">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">Conversion</span>
              <span className="text-3xl font-extrabold tabular-nums text-stone-900" style={{ color: stroke }}>
                {rate}%
              </span>
            </div>
            <div className="h-3 w-full overflow-hidden rounded-full border border-stone-200/80 bg-stone-100">
              <div
                className="cp-conversion-bar-inner h-full rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
                style={{
                  width: barOn ? `${stat.conversion_rate}%` : "0%",
                  background: conversionBarGradient(stat.conversion_rate),
                  transition: "width 1s cubic-bezier(0.22, 1, 0.36, 1)",
                }}
              />
            </div>
          </div>

          <div
            className="grid grid-cols-2 gap-3 sm:grid-cols-4"
            style={{ animation: `cp-stagger-up 0.5s ${delay + 120}ms cubic-bezier(0.22,1,0.36,1) both` }}
          >
            {outcomeMeta.map(({ key, label, icon: Icon }, i) => {
              const val = stat[key as keyof StaffStat] as number;
              const st = OUTCOME_STYLES[key as keyof typeof OUTCOME_STYLES];
              return (
                <div
                  key={key}
                  className={cn(
                    "rounded-xl border p-4 shadow-sm transition-transform duration-300 hover:-translate-y-0.5 hover:shadow-md",
                    st.card,
                  )}
                  style={{ animation: `cp-stagger-up 0.4s ${delay + 140 + i * 45}ms cubic-bezier(0.22,1,0.36,1) both` }}
                >
                  <Icon className={cn("mb-2 h-5 w-5", st.icon)} />
                  <p className={cn("text-2xl font-bold tabular-nums", st.num)}>{val}</p>
                  <p className={cn("mt-1 text-[10px] font-semibold uppercase tracking-wide", st.label)}>{label}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ─── */
export function StaffPerformanceGrid({ employeeId }: StaffPerformanceGridProps) {
  const [staffStats, setStaffStats] = useState<StaffStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"highest" | "lowest" | "converted_count" | "total_contacts">("highest");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchPerformanceData();
  }, [employeeId]);

  const fetchPerformanceData = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const employeeParam = employeeId ? `?employee_id=${employeeId}` : "";
      const response = await fetch(
        `${API_BASE_URL}/energy-renewals/staff-status-counts${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (response.ok) {
        const data = await response.json();
        setStaffStats(data);
      }
    } catch (error) {
      console.error("Error fetching performance:", error);
    } finally {
      setLoading(false);
    }
  };

  const stats = staffStats;
  const strip = [...stats].sort((a, b) => a.employee_name.localeCompare(b.employee_name));

  const filteredStats = stats.filter((stat) =>
    stat.employee_name.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const sorted = [...filteredStats].sort((a, b) => {
    if (sortBy === "converted_count") return b.converted_count - a.converted_count;
    if (sortBy === "total_contacts") return b.total_contacts - a.total_contacts;
    if (sortBy === "highest") return b.conversion_rate - a.conversion_rate;
    if (sortBy === "lowest") return a.conversion_rate - b.conversion_rate;
    return a.employee_name.localeCompare(b.employee_name);
  });

  const avgRate =
    stats.length > 0 ? Math.round(stats.reduce((s, m) => s + m.conversion_rate, 0) / stats.length) : 0;
  const totalConverted = stats.reduce((s, m) => s + m.renewed_count, 0);
  const totalContacts = stats.reduce((s, m) => s + m.total_contacts, 0);

  const subtitle = employeeId
    ? `${stats[0]?.total_contacts ?? 0} contacts · ${stats[0]?.conversion_rate ?? 0}% conversion`
    : `${stats.length} members · avg ${avgRate}% conversion · ${totalConverted} renewed`;

  const selectedStat = selectedEmployeeId ? stats.find((s) => s.employee_id === selectedEmployeeId) : null;

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) setSelectedEmployeeId(null);
  };

  if (loading)
    return (
      <div className="crm-panel flex gap-5 overflow-hidden rounded-[28px] p-5">
        {Array.from({ length: employeeId ? 1 : 6 }).map((_, i) => (
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

  return (
    <>
      <div className="crm-panel rounded-[28px] px-5 pb-5 pt-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white shadow-sm">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-stone-900">
              {employeeId ? "My Performance" : "Team Performance"}
            </p>
            <p className="text-xs text-stone-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedEmployeeId(null);
              setOpen(true);
            }}
            className="group ml-auto inline-flex items-center gap-1.5 rounded-xl border border-stone-200/90 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900 active:scale-[0.98]"
          >
            View all
            <ArrowRight className="h-3 w-3 transition-transform duration-200 group-hover:translate-x-0.5" />
          </button>
        </div>

        {strip.length === 0 ? (
          <p className="py-4 text-center text-sm text-stone-400">No data found.</p>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
            {strip.map((s, i) => (
              <StripCard
                key={s.employee_id}
                stat={s}
                onClick={() => {
                  setSelectedEmployeeId(s.employee_id);
                  setOpen(true);
                }}
                delay={i * 45}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-stone-200/80 pt-3 text-[11px] text-stone-500">
          <span className="font-medium text-stone-600">Conversion bands</span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#16a34a" }} />
            ≥ 60% great
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#d97706" }} />
            35–59% good
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#dc2626" }} />
            {"< 35%"} focus
          </span>
        </div>
      </div>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent
          showCloseButton
          style={{ width: "min(1280px, 94vw)", maxWidth: "min(1280px, 94vw)" }}
          className={cn(
            "max-h-[92vh] overflow-hidden border-0 bg-white p-0 shadow-xl",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-[0.99] data-[state=open]:duration-300",
          )}
        >
          <div className="cp-performance-modal-surface flex max-h-[92vh] flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl">
            {/* Header — solid surface so title & KPIs never compete with blurred layers */}
            <div className="relative z-[1] border-b border-stone-200 bg-stone-50 px-6 py-6 md:px-8">
              <DialogHeader className="relative space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  {selectedStat && !employeeId && (
                    <button
                      type="button"
                      onClick={() => setSelectedEmployeeId(null)}
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50 hover:text-stone-900"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      All team
                    </button>
                  )}
                  <DialogTitle className="flex flex-wrap items-center gap-3 text-xl font-bold tracking-tight text-stone-900">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-black text-white shadow-md">
                      <Users className="h-5 w-5" />
                    </span>
                    {selectedStat
                      ? `${selectedStat.employee_name}`
                      : employeeId
                        ? "My performance overview"
                        : "Team performance hub"}
                  </DialogTitle>
                </div>
                <p className="text-sm text-stone-500">
                  {selectedStat
                    ? "Detailed outcomes and conversion for this teammate."
                    : employeeId
                      ? "Your renewal activity and outcomes."
                      : "Compare conversion and pipeline health across the team."}
                </p>

                {/* Summary strip — team only (single member uses spotlight for metrics) */}
                {!selectedStat && (
                  <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
                    {[
                      { label: "Members", val: stats.length, accent: "border-l-4 border-l-green-600 bg-green-50" },
                      { label: "Avg conversion", val: `${avgRate}%`, accent: "border-l-4 border-l-indigo-600 bg-indigo-50" },
                      { label: "Renewed (total)", val: totalConverted, accent: "border-l-4 border-l-emerald-600 bg-emerald-50" },
                      { label: "Contacts (total)", val: totalContacts, accent: "border-l-4 border-l-sky-600 bg-sky-50" },
                    ].map(({ label, val, accent }, i) => (
                      <div
                        key={label}
                        className={cn(
                          "rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm transition hover:shadow-md",
                          accent,
                        )}
                        style={{ animation: `cp-stagger-up 0.4s ${80 + i * 50}ms cubic-bezier(0.22,1,0.36,1) both` }}
                      >
                        <p className="text-2xl font-bold tabular-nums text-stone-900">{val}</p>
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-stone-600">{label}</p>
                      </div>
                    ))}
                  </div>
                )}
              </DialogHeader>
            </div>

            <div className="max-h-[calc(92vh-200px)] min-h-0 flex-1 overflow-y-auto bg-stone-50 px-6 py-6 md:px-8">
              <div className="space-y-6">
                {!selectedEmployeeId && !employeeId && (
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-stone-500">Sort</span>
                      {(["highest", "lowest", "converted_count", "total_contacts"] as const).map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setSortBy(s)}
                          className={cn(
                            "rounded-full px-4 py-2 text-sm font-medium transition-all duration-200",
                            sortBy === s
                              ? "scale-[1.02] bg-stone-900 text-white shadow-md"
                              : "border border-stone-200 bg-white text-stone-600 shadow-sm hover:border-stone-300 hover:bg-stone-100",
                          )}
                        >
                          {s === "highest"
                            ? "Highest %"
                            : s === "lowest"
                              ? "Lowest %"
                              : s === "converted_count"
                                ? "Most renewed"
                                : "Most contacts"}
                        </button>
                      ))}
                    </div>
                    <div className="relative max-w-full sm:w-72">
                      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
                      <input
                        type="text"
                        placeholder="Search by name…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-full border border-stone-200/90 bg-white py-2 pl-10 pr-4 text-sm text-stone-900 shadow-sm transition placeholder:text-stone-400 focus:border-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-400/25"
                      />
                    </div>
                  </div>
                )}

                {selectedStat ? (
                  <MemberSpotlight stat={selectedStat} delay={0} />
                ) : (
                  <div
                    className={cn(
                      "grid gap-4",
                      "grid-cols-1 sm:grid-cols-2 xl:grid-cols-3",
                    )}
                  >
                    {sorted.map((s, i) => (
                      <DetailCard key={s.employee_id} stat={s} delay={i * 40} />
                    ))}
                  </div>
                )}

                {!selectedEmployeeId && sorted.length === 0 && searchQuery && (
                  <div className="py-16 text-center">
                    <p className="text-sm text-stone-500">No team members match &ldquo;{searchQuery}&rdquo;</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
