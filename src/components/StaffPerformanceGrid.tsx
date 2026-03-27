"use client";

import { useState, useEffect, useRef } from "react";
import { Users, ArrowRight, CheckCircle2, TrendingUp, Clock, TrendingDown, Search } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

/* ─── Types ─── */
interface StaffMember {
  employee_id: number;
  employee_name: string;
  role_name?: string;
  email?: string;
}

interface CustomerContact {
  client_id: number;
  business_name: string;
  contact_person: string;
  phone: string;
  contact_date: string;
  notes: string;
  status: string;
  supplier: string;
  contract_end_date: string;
  annual_usage: number;
  estimated_revenue: number;
  assigned_to_name?: string;
}

interface RenewalRecord {
  status: string;
  assigned_to_name: string;
}

interface SalespersonPerformance {
  employee_id: number;
  employee_name: string;
  total_contacts: number;
  converted_count: number;
  total_value_touched: number;
  conversion_rate: number;
  customers_contacted: CustomerContact[];
  renewed_count?: number;
  in_progress_count?: number;
  not_contacted_count?: number;
  lost_count?: number;
}

interface PerformanceData {
  period: string;
  period_label: string;
  start_date: string;
  end_date: string;
  performance: SalespersonPerformance[];
}

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
  /** Omit for admin (all staff). Pass employee_id for salesperson (their data only). */
  employeeId?: number;
}

/* ─── Pure helpers ─── */
function getInitials(n: string) {
  const p = n.trim().split(/\s+/);
  return p.length === 1
    ? p[0].slice(0, 2).toUpperCase()
    : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function firstName(n: string) {
  return n.trim().split(/\s+/)[0];
}
function rateColor(rate: number) {
  if (rate >= 60) return "#16a34a";
  if (rate >= 35) return "#d97706";
  if (rate > 0) return "#dc2626";
  return "#d1d5db";
}

/* ─── Animated counter ─── */
function useCountUp(target: number, duration = 900) {
  const [v, setV] = useState(0);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) { setV(0); return; }
    const t0 = performance.now();
    const tick = (now: number) => {
      const p = Math.min((now - t0) / duration, 1);
      setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [target, duration]);
  return v;
}

/* ─── Progress ring ─── */
function ProgressRing({ rate, size = 80 }: { rate: number; size?: number }) {
  const sw = 5.5;
  const r = (size - sw) / 2;
  const circ = 2 * Math.PI * r;
  const [dash, setDash] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDash((rate / 100) * circ), 120);
    return () => clearTimeout(id);
  }, [rate, circ]);

  return (
    <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={sw} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none"
        stroke={rateColor(rate)}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeDasharray={`${dash} ${circ}`}
        style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)" }}
      />
    </svg>
  );
}

/* ─── Strip card ─── */
function StripCard({ stat, onClick, delay }: { stat: StaffStat; onClick: () => void; delay: number }) {
  const rate = useCountUp(stat.conversion_rate, 1000);
  const color = rateColor(stat.conversion_rate);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex min-w-[100px] flex-col items-center gap-2 focus:outline-none"
      style={{ animation: `cp-stagger-up 0.4s ${delay}ms cubic-bezier(0.22,1,0.36,1) both` }}
    >
      <div className="relative flex-shrink-0">
        <ProgressRing rate={stat.conversion_rate} size={72} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 select-none items-center justify-center rounded-full bg-black text-xs font-bold text-white transition-transform duration-200 group-hover:scale-110">
            {getInitials(stat.employee_name)}
          </div>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-semibold leading-tight">{firstName(stat.employee_name)}</p>
        <p className="text-[11px] font-bold tabular-nums" style={{ color }}>{rate}%</p>
      </div>
    </button>
  );
}

/* ─── Detail card — FIXED layout, no truncation, proper spacing ─── */
function DetailCard({ stat, delay }: { stat: StaffStat; delay: number }) {
  const rate = useCountUp(stat.conversion_rate, 1000);
  const color = rateColor(stat.conversion_rate);

  const statChips = [
    { label: "Renewed",       val: stat.renewed_count,       icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50",  numColor: "text-emerald-700" },
    { label: "In Progress",   val: stat.in_progress_count,   icon: TrendingUp,   color: "text-blue-600",    bg: "bg-blue-50",     numColor: "text-blue-700"    },
    { label: "Not Contacted", val: stat.not_contacted_count, icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50",    numColor: "text-amber-700"   },
    { label: "Lost",          val: stat.lost_count,          icon: TrendingDown, color: "text-red-600",     bg: "bg-red-50",      numColor: "text-red-700"     },
  ];

  return (
    <div
      className="flex flex-col gap-5 rounded-2xl border border-black/8 bg-white p-6 shadow-sm"
      style={{ animation: `cp-stagger-up 0.4s ${delay}ms cubic-bezier(0.22,1,0.36,1) both` }}
    >
      {/* ── Header: avatar + name + conversion — all on one clean row ── */}
      <div className="flex items-center gap-4">
        {/* Ring + initials */}
        <div className="relative flex-shrink-0">
          <ProgressRing rate={stat.conversion_rate} size={72} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex h-10 w-10 select-none items-center justify-center rounded-full bg-black text-xs font-bold text-white">
              {getInitials(stat.employee_name)}
            </div>
          </div>
        </div>

        {/* Name + contacts */}
        <div className="flex-1 min-w-0">
          <p className="text-base font-bold text-gray-900 leading-tight truncate">{stat.employee_name}</p>
          <p className="text-sm text-gray-400 mt-0.5">{stat.total_contacts} contacts</p>
        </div>

        {/* Conversion — fixed width pill on right */}
        <div className="flex-shrink-0 text-right">
          <p className="text-2xl font-extrabold tabular-nums leading-none" style={{ color }}>{rate}%</p>
          <p className="text-[10px] font-medium text-gray-400 mt-1">conversion</p>
        </div>
      </div>

      {/* ── Stat chips: 2×2 grid, always fully readable ── */}
      <div className="grid grid-cols-2 gap-2">
        {statChips.map(({ label, val, icon: Icon, color: iconColor, bg, numColor }) => (
          <div key={label} className={cn("flex items-center gap-3 rounded-xl px-4 py-3", bg)}>
            <Icon className={cn("h-5 w-5 flex-shrink-0", iconColor)} />
            <div className="min-w-0">
              <p className={cn("text-lg font-bold tabular-nums leading-tight", numColor)}>{val}</p>
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 leading-tight mt-0.5 whitespace-nowrap">
                {label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Main component ─── */
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
      const tenantId = localStorage.getItem("tenant_id") || "1";
      const employeeParam = employeeId ? `?employee_id=${employeeId}` : '';

      const res = await fetch(
        `${API_BASE_URL}/energy-renewals/staff-status-counts${employeeParam}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId,
          },
        }
      );

      if (res.ok) {
        const data = await res.json();
        console.log('📊 Fetched staff stats:', data.length, 'members');
        console.log('📊 Staff data:', data);
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
  
  // Filter by search query
  const filteredStats = stats.filter(stat => 
    stat.employee_name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  
  // Sort by highest or lowest performance
  const sorted = [...filteredStats].sort((a, b) => {
    if (sortBy === "converted_count") return b.converted_count - a.converted_count;
    if (sortBy === "total_contacts") return b.total_contacts - a.total_contacts;
    if (sortBy === "highest") return b.conversion_rate - a.conversion_rate; // Highest first
    if (sortBy === "lowest") return a.conversion_rate - b.conversion_rate; // Lowest first
    return a.employee_name.localeCompare(b.employee_name);
  });

  const avgRate = stats.length > 0
    ? Math.round(stats.reduce((s, m) => s + m.conversion_rate, 0) / stats.length)
    : 0;
  const totalConverted = stats.reduce((s, m) => s + m.renewed_count, 0);
  const totalContacts  = stats.reduce((s, m) => s + m.total_contacts, 0);

  const subtitle = employeeId
    ? `${stats[0]?.total_contacts ?? 0} contacts · ${stats[0]?.conversion_rate ?? 0}% conversion`
    : `${stats.length} members · avg ${avgRate}% conversion · ${totalConverted} renewed`;

  /* Skeleton */
  if (loading)
    return (
      <div className="crm-panel flex gap-5 overflow-hidden rounded-[28px] p-5">
        {Array.from({ length: employeeId ? 1 : 6 }).map((_, i) => (
          <div key={i} className="flex min-w-[100px] flex-col items-center gap-2 animate-pulse">
            <div className="h-[72px] w-[72px] rounded-full bg-black/8" />
            <div className="h-2.5 w-14 rounded bg-black/8" />
            <div className="h-2 w-8 rounded bg-black/6" />
          </div>
        ))}
      </div>
    );

  /* ── Resolved stat for selected employee (used in modal header) ── */
  const selectedStat = selectedEmployeeId
    ? stats.find(s => s.employee_id === selectedEmployeeId)
    : null;

  return (
    <>
      {/* ── Strip panel ── */}
      <div className="crm-panel rounded-[28px] px-5 pb-5 pt-4">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white">
            <Users className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">
              {employeeId ? "My Performance" : "Team Performance"}
            </p>
            <p className="text-xs text-black/40">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={() => { setSelectedEmployeeId(null); setOpen(true); }}
            className="cp-action-link ml-auto flex items-center gap-1.5 !rounded-xl !px-3 !py-1.5 text-xs font-medium hover:!bg-black/5"
          >
            View all
            <ArrowRight className="cp-action-arrow h-3 w-3" />
          </button>
        </div>

        {strip.length === 0 ? (
          <p className="py-4 text-center text-sm text-black/30">No data found.</p>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
            {strip.map((s, i) => (
              <StripCard
                key={s.employee_id}
                stat={s}
                onClick={() => { setSelectedEmployeeId(s.employee_id); setOpen(true); }}
                delay={i * 40}
              />
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-black/6 pt-3 text-[11px] text-black/40">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#16a34a" }} />
            ≥ 60% Great
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#d97706" }} />
            35–59% Good
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#dc2626" }} />
            {"< 35%"} Needs focus
          </span>
        </div>
      </div>

      {/* ── Detail modal ── */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          style={{ width: "min(1400px, 92vw)", maxWidth: "min(1400px, 92vw)" }}
          className="max-h-[95vh] overflow-hidden border-0 p-0 shadow-2xl"
        >

          {/* ── Modal header ── */}
          <div className="border-b border-gray-100 bg-white px-7 py-6">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3 text-xl font-bold text-gray-900">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-black">
                  <Users className="h-4 w-4 text-white" />
                </div>
                {selectedStat
                  ? `${selectedStat.employee_name}'s Performance`
                  : employeeId ? "My Performance Overview" : "Team Performance Overview"}
              </DialogTitle>
            </DialogHeader>

            {/* ── Summary stat boxes ── */}
            <div className="mt-5 grid grid-cols-3 gap-3 md:grid-cols-4">
              {selectedStat ? (
                /* Individual view — 3 boxes */
                [
                  { label: "Total Contacts",   val: selectedStat.total_contacts,   color: "text-blue-600"    },
                  { label: "Conversion Rate",  val: `${selectedStat.conversion_rate}%`, color: "text-emerald-600" },
                  { label: "Renewed",          val: selectedStat.renewed_count,    color: "text-purple-600"  },
                ].map(({ label, val, color }) => (
                  <div key={label} className="flex flex-col justify-between rounded-xl bg-gray-50 px-4 py-3.5 ring-1 ring-black/5">
                    <p className={cn("text-2xl font-extrabold tabular-nums leading-tight", color)}>{val}</p>
                    <p className="mt-1.5 text-xs font-medium text-gray-500 leading-tight">{label}</p>
                  </div>
                ))
              ) : (
                /* Team view — 4 boxes */
                [
                  { label: "Members",        val: stats.length     },
                  { label: "Avg Rate",       val: `${avgRate}%`    },
                  { label: "Total Renewed",  val: totalConverted   },
                  { label: "Total Contacts", val: totalContacts    },
                ].map(({ label, val }) => (
                  <div key={label} className="flex flex-col justify-between rounded-xl bg-gray-50 px-4 py-3.5 ring-1 ring-black/5">
                    <p className="text-2xl font-extrabold tabular-nums text-gray-900 leading-tight">{val}</p>
                    <p className="mt-1.5 text-xs font-medium text-gray-500 leading-tight">{label}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* ── Scrollable content ── */}
          <div className="max-h-[calc(95vh-220px)] overflow-y-auto bg-gray-50/40 px-7 py-5">
            <div className="space-y-5">

              {/* Sort controls + Search — team view only */}
              {!selectedEmployeeId && !employeeId && (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-500">Sort by:</span>
                    {(["highest", "lowest", "converted_count", "total_contacts"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setSortBy(s)}
                        className={cn(
                          "rounded-lg px-3.5 py-1.5 text-sm font-medium transition-all",
                          sortBy === s
                            ? "bg-black text-white shadow-sm"
                            : "bg-white text-gray-600 shadow-sm ring-1 ring-black/8 hover:bg-gray-50",
                        )}
                      >
                        {s === "highest" ? "Highest Performance" : 
                         s === "lowest" ? "Lowest Performance" :
                         s === "converted_count" ? "Renewed" : "Contacts"}
                      </button>
                    ))}
                  </div>
                  
                  {/* Search bar */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search team members..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-64 rounded-lg border border-gray-200 bg-white py-1.5 pl-9 pr-3 text-sm transition-all placeholder:text-gray-400 focus:border-gray-300 focus:outline-none focus:ring-2 focus:ring-black/5"
                    />
                  </div>
                </div>
              )}

              {/* Cards grid — 2 columns max so cards have room to breathe */}
              <div className={cn(
                "grid gap-4",
                selectedEmployeeId
                  ? "grid-cols-1 max-w-lg mx-auto"
                  : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              )}>
                {(selectedEmployeeId
                  ? stats.filter(s => s.employee_id === selectedEmployeeId)
                  : sorted
                ).map((s, i) => (
                  <DetailCard key={s.employee_id} stat={s} delay={i * 35} />
                ))}
              </div>

              {/* Show message if search returns no results */}
              {!selectedEmployeeId && sorted.length === 0 && searchQuery && (
                <div className="py-12 text-center">
                  <p className="text-sm text-gray-500">No team members found matching "{searchQuery}"</p>
                </div>
              )}

            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}