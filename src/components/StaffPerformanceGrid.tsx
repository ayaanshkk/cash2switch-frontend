// "use client";

// import { useState, useEffect, useRef } from "react";
// import { Users, ArrowRight, CheckCircle2, TrendingUp, Clock, TrendingDown } from "lucide-react";
// import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
// import { cn } from "@/lib/utils";

// const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// /* ─── Types ─── */
// interface StaffMember {
//   employee_id: number;
//   employee_name: string;
//   role_name?: string;
//   email?: string;
// }

// interface CustomerContact {
//   client_id: number;
//   business_name: string;
//   contact_person: string;
//   phone: string;
//   contact_date: string;
//   notes: string;
//   status: string;
//   supplier: string;
//   contract_end_date: string;
//   annual_usage: number;
//   estimated_revenue: number;
//   assigned_to_name?: string;
// }

// interface RenewalRecord {
//   status: string;
//   assigned_to_name: string;
// }

// interface SalespersonPerformance {
//   employee_id: number;
//   employee_name: string;
//   total_contacts: number;
//   converted_count: number;
//   total_value_touched: number;
//   conversion_rate: number;
//   customers_contacted: CustomerContact[];
//   renewed_count?: number;
//   in_progress_count?: number;
//   not_contacted_count?: number;
//   lost_count?: number;
// }

// interface PerformanceData {
//   period: string;
//   period_label: string;
//   start_date: string;
//   end_date: string;
//   performance: SalespersonPerformance[];
// }

// interface StaffStat {
//   employee_id: number;
//   employee_name: string;
//   total_contacts: number;
//   converted_count: number;
//   total_value_touched: number;
//   conversion_rate: number;
//   renewed_count: number;
//   in_progress_count: number;
//   not_contacted_count: number;
//   lost_count: number;
// }

// interface StaffPerformanceGridProps {
//   /** Omit for admin (all staff). Pass employee_id for salesperson (their data only). */
//   employeeId?: number;
// }

// /* ─── Pure helpers ─── */
// function getInitials(n: string) {
//   const p = n.trim().split(/\s+/);
//   return p.length === 1
//     ? p[0].slice(0, 2).toUpperCase()
//     : (p[0][0] + p[p.length - 1][0]).toUpperCase();
// }
// function firstName(n: string) {
//   return n.trim().split(/\s+/)[0];
// }
// function rateColor(rate: number) {
//   if (rate >= 60) return "#16a34a";
//   if (rate >= 35) return "#d97706";
//   if (rate > 0) return "#dc2626";
//   return "#d1d5db";
// }

// /* ─── Animated counter ─── */
// function useCountUp(target: number, duration = 900) {
//   const [v, setV] = useState(0);
//   const raf = useRef<number | null>(null);
//   useEffect(() => {
//     if (target === 0) { setV(0); return; }
//     const t0 = performance.now();
//     const tick = (now: number) => {
//       const p = Math.min((now - t0) / duration, 1);
//       setV(Math.round((1 - Math.pow(1 - p, 3)) * target));
//       if (p < 1) raf.current = requestAnimationFrame(tick);
//     };
//     raf.current = requestAnimationFrame(tick);
//     return () => { if (raf.current) cancelAnimationFrame(raf.current); };
//   }, [target, duration]);
//   return v;
// }

// /* ─── Progress ring ─── */
// function ProgressRing({ rate, size = 80 }: { rate: number; size?: number }) {
//   const sw = 5.5;
//   const r = (size - sw) / 2;
//   const circ = 2 * Math.PI * r;
//   const [dash, setDash] = useState(0);

//   useEffect(() => {
//     const id = setTimeout(() => setDash((rate / 100) * circ), 120);
//     return () => clearTimeout(id);
//   }, [rate, circ]);

//   return (
//     <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
//       <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth={sw} />
//       <circle
//         cx={size / 2} cy={size / 2} r={r}
//         fill="none"
//         stroke={rateColor(rate)}
//         strokeWidth={sw}
//         strokeLinecap="round"
//         strokeDasharray={`${dash} ${circ}`}
//         style={{ transition: "stroke-dasharray 0.9s cubic-bezier(0.22,1,0.36,1)" }}
//       />
//     </svg>
//   );
// }

// /* ─── Strip card ─── */
// function StripCard({ stat, onClick, delay }: { stat: StaffStat; onClick: () => void; delay: number }) {
//   const rate = useCountUp(stat.conversion_rate, 1000);
//   const color = rateColor(stat.conversion_rate);

//   return (
//     <button
//       type="button"
//       onClick={onClick}
//       className="group flex min-w-[100px] flex-col items-center gap-2 focus:outline-none"
//       style={{ animation: `cp-stagger-up 0.4s ${delay}ms cubic-bezier(0.22,1,0.36,1) both` }}
//     >
//       <div className="relative flex-shrink-0">
//         <ProgressRing rate={stat.conversion_rate} size={72} />
//         <div className="absolute inset-0 flex items-center justify-center">
//           <div className="flex h-10 w-10 select-none items-center justify-center rounded-full bg-black text-xs font-bold text-white transition-transform duration-200 group-hover:scale-110">
//             {getInitials(stat.employee_name)}
//           </div>
//         </div>
//       </div>
//       <div className="text-center">
//         <p className="text-xs font-semibold leading-tight">{firstName(stat.employee_name)}</p>
//         <p className="text-[11px] font-bold tabular-nums" style={{ color }}>{rate}%</p>
//       </div>
//     </button>
//   );
// }

// /* ─── Detail card ─── */
// function DetailCard({ stat, delay }: { stat: StaffStat; delay: number }) {
//   const rate = useCountUp(stat.conversion_rate, 1000);
//   const color = rateColor(stat.conversion_rate);

//   return (
//     <div
//       className="crm-panel flex flex-col gap-3 rounded-2xl p-4"
//       style={{ animation: `cp-stagger-up 0.4s ${delay}ms cubic-bezier(0.22,1,0.36,1) both` }}
//     >
//       <div className="flex items-center gap-3">
//         <div className="relative flex-shrink-0">
//           <ProgressRing rate={stat.conversion_rate} size={52} />
//           <div className="absolute inset-0 flex items-center justify-center">
//             <div className="flex h-7 w-7 select-none items-center justify-center rounded-full bg-black text-[10px] font-bold text-white">
//               {getInitials(stat.employee_name)}
//             </div>
//           </div>
//         </div>
//         <div className="min-w-0 flex-1">
//           <p className="truncate text-sm font-semibold">{stat.employee_name}</p>
//           <p className="text-xs text-black/40">{stat.total_contacts} contacts</p>
//         </div>
//         <div className="flex-shrink-0 text-right">
//           <p className="text-xl font-bold tabular-nums" style={{ color }}>{rate}%</p>
//           <p className="text-[10px] text-black/35">conversion</p>
//         </div>
//       </div>
//       <div className="grid grid-cols-4 divide-x divide-black/6 overflow-hidden rounded-xl border border-black/7 bg-black/[0.018]">
//         {[
//           { label: "Renewed", val: stat.renewed_count, icon: CheckCircle2 },
//           { label: "In Progress", val: stat.in_progress_count, icon: TrendingUp },
//           { label: "Not Contacted", val: stat.not_contacted_count, icon: Clock },
//           { label: "Lost", val: stat.lost_count, icon: TrendingDown },
//         ].map(({ label, val, icon: Icon }) => (
//           <div key={label} className="flex flex-col items-center gap-0.5 py-2">
//             <Icon className="h-3 w-3 text-black/30" />
//             <p className="text-sm font-bold tabular-nums">{val}</p>
//             <p className="text-[9px] uppercase tracking-wide text-black/35">{label}</p>
//           </div>
//         ))}
//       </div>
//     </div>
//   );
// }

// /* ─── Main component ─── */
// export function StaffPerformanceGrid({ employeeId }: StaffPerformanceGridProps) {
//   const [staff, setStaff] = useState<StaffMember[]>([]);
//   const [monthlyPerformance, setMonthlyPerformance] = useState<SalespersonPerformance[]>([]);
//   const [renewals, setRenewals] = useState<CustomerContact[]>([]);
//   const [loading, setLoading] = useState(true);
//   const [open, setOpen] = useState(false);
//   const [selectedEmployeeId, setSelectedEmployeeId] = useState<number | null>(null);
//   const [sortBy, setSortBy] = useState<"conversion_rate" | "converted_count" | "total_contacts">("conversion_rate");

//   useEffect(() => {
//     if (employeeId) {
//       // Salesperson view - fetch only their performance
//       fetchPerformanceData();
//     } else {
//       // Admin view - fetch all staff first, then performance
//       fetchStaffMembers();
//     }
//   }, [employeeId]);

//   const fetchStaffMembers = async () => {
//     try {
//       setLoading(true);
//       const token = localStorage.getItem("auth_token");
//       const tenantId = localStorage.getItem("tenant_id") || "1";

//       const response = await fetch(`${API_BASE_URL}/employees`, {
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "X-Tenant-ID": tenantId,
//         },
//       });

//       if (response.ok) {
//         const data = await response.json();
//         const employees = Array.isArray(data) ? data : (data.data || []);
        
//         // Show ALL employees except Platform Admin
//         const salespeople = employees.filter((emp: any) => {
//           const roleName = emp.role_name?.toLowerCase() || '';
//           const isPlatformAdmin = roleName.includes('platform') && roleName.includes('admin');
//           return !isPlatformAdmin;
//         });
        
//         setStaff(salespeople);
        
//         // After fetching staff, fetch performance data
//         await fetchPerformanceData();
//       }
//     } catch (error) {
//       console.error("Error fetching staff:", error);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchPerformanceData = async () => {
//     try {
//       const token = localStorage.getItem("auth_token");
//       const tenantId = localStorage.getItem("tenant_id") || "1";
//       const employeeParam = employeeId ? `&employee_id=${employeeId}` : '';

//       const headers: Record<string, string> = {
//         Authorization: `Bearer ${token}`,
//         "X-Tenant-ID": tenantId,
//       };

//       // Fetch monthly performance (primary data source for the new design)
//       const monthlyRes = await fetch(
//         `${API_BASE_URL}/energy-renewals/salesperson-performance?period=month${employeeParam}`,
//         { headers }
//       );

//       if (monthlyRes.ok) {
//         const monthlyData: PerformanceData = await monthlyRes.json();
//         console.log("📊 Monthly Performance Data:", monthlyData);
//         setMonthlyPerformance(monthlyData.performance || []);
//       }

//       // Also fetch ALL renewals to get accurate status counts
//       const renewalsUrl = employeeId
//         ? `${API_BASE_URL}/energy-renewals?employee_id=${employeeId}`
//         : `${API_BASE_URL}/energy-renewals`;
      
//       const renewalsRes = await fetch(renewalsUrl, { headers });
//       if (renewalsRes.ok) {
//         const renewalsData = await renewalsRes.json();
//         const allRenewals = Array.isArray(renewalsData) ? renewalsData : [];
//         console.log("📋 All Renewals Sample:", allRenewals.slice(0, 5));
//         setRenewals(allRenewals);
//       }
//     } catch (error) {
//       console.error("Error fetching performance:", error);
//     } finally {
//       if (employeeId) {
//         setLoading(false);
//       }
//     }
//   };

//   /* Compute stats from performance data AND renewals data */
//   const stats: StaffStat[] = monthlyPerformance
//     .map((perf) => {
//       // Get this employee's renewals from the renewals endpoint
//       const employeeRenewals = renewals.filter(
//         (r) => r.assigned_to_name?.toLowerCase().trim() === perf.employee_name.toLowerCase().trim()
//       );

//       // Count by status - using the SAME logic as your Renewal Performance widget
//       const renewed_count = employeeRenewals.filter(r => {
//         const s = (r.status || '').toLowerCase().trim();
//         return s === 'renewed' || s === 'won' || s === 'already renewed' || 
//                s === 'renewed directly' || s === 'pricing approved' ||
//                s.includes('renew');
//       }).length;
      
//       const in_progress_count = employeeRenewals.filter(r => {
//         const s = (r.status || '').toLowerCase().trim();
//         return s === 'in progress' || s.includes('contact') || 
//                s.includes('call') || s.includes('progress') || s.includes('callback');
//       }).length;
      
//       const lost_count = employeeRenewals.filter(r => {
//         const s = (r.status || '').toLowerCase().trim();
//         return s === 'lost' || s.includes('cancel') || s === 'declined';
//       }).length;
      
//       const not_contacted_count = employeeRenewals.filter(r => {
//         const s = (r.status || '').toLowerCase().trim();
//         return s === '' || s === 'pending' || s === 'not contacted' || s === 'new' ||
//                (!s.includes('renew') && !s.includes('progress') && 
//                 !s.includes('contact') && !s.includes('lost') && 
//                 !s.includes('cancel') && !s.includes('call') && !s.includes('won'));
//       }).length;

//       // Calculate renewal rate based on renewals data
//       const total = employeeRenewals.length || perf.total_contacts || 1;
//       const renewal_rate = total > 0 ? Math.round((renewed_count / total) * 100) : 0;

//       console.log(`📊 ${perf.employee_name}:`, {
//         total_from_api: perf.total_contacts,
//         renewals_count: employeeRenewals.length,
//         renewed: renewed_count,
//         in_progress: in_progress_count,
//         not_contacted: not_contacted_count,
//         lost: lost_count,
//         renewal_rate,
//       });

//       return {
//         employee_id: perf.employee_id,
//         employee_name: perf.employee_name,
//         total_contacts: employeeRenewals.length || perf.total_contacts,
//         converted_count: renewed_count,
//         total_value_touched: perf.total_value_touched,
//         conversion_rate: renewal_rate,
//         renewed_count,
//         in_progress_count,
//         not_contacted_count,
//         lost_count,
//       };
//     })
//     .sort((a, b) => a.employee_name.localeCompare(b.employee_name)); // Alphabetical order

//   const strip = [...stats].sort((a, b) => a.employee_name.localeCompare(b.employee_name)); // Also alphabetical in strip
//   const sorted = [...stats].sort((a, b) => {
//     if (sortBy === "converted_count") return b.converted_count - a.converted_count;
//     if (sortBy === "total_contacts") return b.total_contacts - a.total_contacts;
//     if (sortBy === "conversion_rate") return b.conversion_rate - a.conversion_rate;
//     return a.employee_name.localeCompare(b.employee_name); // Default to alphabetical
//   });

//   const avgRate = stats.length > 0 
//     ? Math.round(stats.reduce((s, m) => s + m.conversion_rate, 0) / stats.length) 
//     : 0;
//   const totalConverted = stats.reduce((s, m) => s + m.converted_count, 0);
//   const totalContacts = stats.reduce((s, m) => s + m.total_contacts, 0);

//   /* Subtitle and modal header differ per role */
//   const subtitle = employeeId
//     ? `${stats[0]?.total_contacts ?? 0} contacts · ${stats[0]?.conversion_rate ?? 0}% conversion · ${stats[0]?.converted_count ?? 0} converted`
//     : `${staff.length} members · avg ${avgRate}% conversion · ${totalConverted} converted this month`;

//   const modalStats = employeeId
//     ? [
//         { label: "Contacts", val: stats[0]?.total_contacts ?? 0 },
//         { label: "Rate", val: `${stats[0]?.conversion_rate ?? 0}%` },
//         { label: "Converted", val: stats[0]?.converted_count ?? 0 },
//       ]
//     : [
//         { label: "Members", val: staff.length },
//         { label: "Avg Rate", val: `${avgRate}%` },
//         { label: "Total Converted", val: totalConverted },
//         { label: "Total Contacts", val: totalContacts },
//       ];

//   /* Skeleton */
//   if (loading)
//     return (
//       <div className="crm-panel flex gap-5 overflow-hidden rounded-[28px] p-5">
//         {Array.from({ length: employeeId ? 1 : 6 }).map((_, i) => (
//           <div key={i} className="flex min-w-[100px] flex-col items-center gap-2 animate-pulse">
//             <div className="h-[72px] w-[72px] rounded-full bg-black/8" />
//             <div className="h-2.5 w-14 rounded bg-black/8" />
//             <div className="h-2 w-8 rounded bg-black/6" />
//           </div>
//         ))}
//       </div>
//     );

//   return (
//     <>
//       {/* ── Strip panel ── */}
//       <div className="crm-panel rounded-[28px] px-5 pb-5 pt-4">
//         <div className="mb-4 flex items-center gap-3">
//           <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-black text-white">
//             <Users className="h-4 w-4" />
//           </div>
//           <div>
//             <p className="text-sm font-semibold">
//               {employeeId ? "My Performance" : "Team Performance"}
//             </p>
//             <p className="text-xs text-black/40">{subtitle}</p>
//           </div>
//           <button
//             type="button"
//             onClick={() => {
//               setSelectedEmployeeId(null);
//               setOpen(true);
//             }}
//             className="cp-action-link ml-auto flex items-center gap-1.5 !rounded-xl !px-3 !py-1.5 text-xs font-medium hover:!bg-black/5"
//           >
//             View all
//             <ArrowRight className="cp-action-arrow h-3 w-3" />
//           </button>
//         </div>

//         {strip.length === 0 ? (
//           <p className="py-4 text-center text-sm text-black/30">No data found.</p>
//         ) : (
//           <div className="flex gap-6 overflow-x-auto pb-2" style={{ scrollbarWidth: "thin" }}>
//             {strip.map((s, i) => (
//               <StripCard 
//                 key={s.employee_id} 
//                 stat={s} 
//                 onClick={() => {
//                   setSelectedEmployeeId(s.employee_id);
//                   setOpen(true);
//                 }} 
//                 delay={i * 40} 
//               />
//             ))}
//           </div>
//         )}

//         <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-black/6 pt-3 text-[11px] text-black/40">
//           <span className="flex items-center gap-1.5">
//             <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#16a34a" }} />
//             ≥ 60% Great
//           </span>
//           <span className="flex items-center gap-1.5">
//             <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#d97706" }} />
//             35–59% Good
//           </span>
//           <span className="flex items-center gap-1.5">
//             <span className="inline-block h-2 w-2 rounded-full" style={{ background: "#dc2626" }} />
//             {"< 35%"} Needs focus
//           </span>
//         </div>
//       </div>

//       {/* ── Detail modal ── */}
//       <Dialog open={open} onOpenChange={setOpen}>
//         <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto border-black/10 p-0">
//           <div className="rounded-t-[inherit] bg-[linear-gradient(135deg,rgba(0,0,0,0.96),rgba(0,0,0,0.78))] px-6 py-5">
//             <DialogHeader>
//               <DialogTitle className="flex items-center gap-2.5 text-white">
//                 <Users className="h-4 w-4 text-white/60" />
//                 {selectedEmployeeId 
//                   ? `${stats.find(s => s.employee_id === selectedEmployeeId)?.employee_name}'s Performance`
//                   : employeeId ? "My Performance Overview" : "Team Performance Overview"}
//               </DialogTitle>
//             </DialogHeader>
//             <div className="mt-3 flex gap-5">
//               {selectedEmployeeId ? (
//                 // Show individual stats
//                 (() => {
//                   const selectedStat = stats.find(s => s.employee_id === selectedEmployeeId);
//                   if (!selectedStat) return null;
//                   return [
//                     { label: "Contacts", val: selectedStat.total_contacts },
//                     { label: "Rate", val: `${selectedStat.conversion_rate}%` },
//                     { label: "Converted", val: selectedStat.converted_count },
//                   ].map(({ label, val }) => (
//                     <div key={label}>
//                       <p className="text-xl font-bold tabular-nums text-white">{val}</p>
//                       <p className="mt-0.5 text-[11px] text-white/45">{label}</p>
//                     </div>
//                   ));
//                 })()
//               ) : (
//                 // Show team stats
//                 modalStats.map(({ label, val }) => (
//                   <div key={label}>
//                     <p className="text-xl font-bold tabular-nums text-white">{val}</p>
//                     <p className="mt-0.5 text-[11px] text-white/45">{label}</p>
//                   </div>
//                 ))
//               )}
//             </div>
//           </div>

//           <div className="space-y-4 p-5">
//             {/* Sort controls — only show when viewing all employees */}
//             {!selectedEmployeeId && !employeeId && (
//               <div className="flex items-center gap-2">
//                 <span className="text-xs text-black/40">Sort by</span>
//                 {(["conversion_rate", "converted_count", "total_contacts"] as const).map((s) => (
//                   <button
//                     key={s}
//                     type="button"
//                     onClick={() => setSortBy(s)}
//                     className={cn(
//                       "rounded-full px-3 py-1 text-xs font-medium transition-all",
//                       sortBy === s ? "bg-black text-white" : "bg-black/6 text-black/50 hover:bg-black/10",
//                     )}
//                   >
//                     {s === "conversion_rate" ? "Conversion Rate" : s === "converted_count" ? "Converted" : "Contacts"}
//                   </button>
//                 ))}
//               </div>
//             )}
//             <div className={cn(
//               "grid gap-3",
//               selectedEmployeeId ? "grid-cols-1" : "sm:grid-cols-2"
//             )}>
//               {(selectedEmployeeId 
//                 ? stats.filter(s => s.employee_id === selectedEmployeeId)
//                 : sorted
//               ).map((s, i) => (
//                 <DetailCard key={s.employee_id} stat={s} delay={i * 35} />
//               ))}
//             </div>
//           </div>
//         </DialogContent>
//       </Dialog>
//     </>
//   );
// }

"use client";

import { useState, useEffect } from "react";
import { User, ChevronDown, Phone, Calendar, DollarSign, TrendingUp, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

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
}

interface SalespersonPerformance {
  employee_id: number;
  employee_name: string;
  total_contacts: number;
  converted_count: number;
  total_value_touched: number;
  conversion_rate: number;
  customers_contacted: CustomerContact[];
}

interface PerformanceData {
  period: string;
  period_label: string;
  start_date: string;
  end_date: string;
  performance: SalespersonPerformance[];
}

interface StaffPerformanceGridProps {
  employeeId?: number; // For salesperson view (only see their own data)
}

export function StaffPerformanceGrid({ employeeId }: StaffPerformanceGridProps) {
  const router = useRouter();
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [weeklyPerformance, setWeeklyPerformance] = useState<SalespersonPerformance[]>([]);
  const [monthlyPerformance, setMonthlyPerformance] = useState<SalespersonPerformance[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [performanceLoading, setPerformanceLoading] = useState(false);
  const [expandedSalespeople, setExpandedSalespeople] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (employeeId) {
      // Salesperson view - fetch only their performance
      fetchAllPerformance();
    } else {
      // Admin view - fetch all staff first
      fetchStaffMembers();
    }
  }, [employeeId]);

  const fetchStaffMembers = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";

      const response = await fetch(`${API_BASE_URL}/employees`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const employees = Array.isArray(data) ? data : (data.data || []);
        
        // Show ALL employees except Platform Admin
        const salespeople = employees.filter((emp: any) => {
          const roleName = emp.role_name?.toLowerCase() || '';
          const isPlatformAdmin = roleName.includes('platform') && roleName.includes('admin');
          return !isPlatformAdmin;
        });
        
        setStaff(salespeople);
      }
    } catch (error) {
      console.error("Error fetching staff:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllPerformance = async () => {
    setPerformanceLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const employeeParam = employeeId ? `&employee_id=${employeeId}` : '';

      // Fetch weekly performance
      const weeklyRes = await fetch(
        `${API_BASE_URL}/energy-renewals/salesperson-performance?period=week${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (weeklyRes.ok) {
        const weeklyData: PerformanceData = await weeklyRes.json();
        setWeeklyPerformance(weeklyData.performance || []);
      }

      // Fetch monthly performance
      const monthlyRes = await fetch(
        `${API_BASE_URL}/energy-renewals/salesperson-performance?period=month${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (monthlyRes.ok) {
        const monthlyData: PerformanceData = await monthlyRes.json();
        setMonthlyPerformance(monthlyData.performance || []);
      }

      setShowDialog(true);
    } catch (error) {
      console.error("Error fetching performance:", error);
    } finally {
      setPerformanceLoading(false);
    }
  };

  const handleStaffClick = (member: StaffMember) => {
    console.log('🖱️ Clicked on:', member.employee_name, member.employee_id);
    fetchAllPerformance();
  };

  const toggleSalesperson = (employeeId: number) => {
    const newExpanded = new Set(expandedSalespeople);
    if (newExpanded.has(employeeId)) {
      newExpanded.delete(employeeId);
    } else {
      newExpanded.add(employeeId);
    }
    setExpandedSalespeople(newExpanded);
  };

  const renderPerformanceData = (performance: SalespersonPerformance[]) => {
    if (performanceLoading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      );
    }

    if (performance.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No activity in this period
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {performance.map((sales) => (
          <Collapsible
            key={sales.employee_id}
            open={expandedSalespeople.has(sales.employee_id)}
            onOpenChange={() => toggleSalesperson(sales.employee_id)}
          >
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                        <Users className="h-6 w-6 text-primary" />
                      </div>
                      <div className="text-left">
                        <CardTitle className="text-lg">{sales.employee_name}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {sales.total_contacts} contacts · {sales.conversion_rate}% conversion
                        </p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-2xl font-bold text-primary">
                          £{(sales.total_value_touched / 1000).toFixed(1)}K
                        </p>
                        <p className="text-sm text-green-600">
                          {sales.converted_count} converted
                        </p>
                      </div>
                      <ChevronDown
                        className={`h-5 w-5 text-muted-foreground transition-transform ${
                          expandedSalespeople.has(sales.employee_id) ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    <h4 className="font-semibold mb-4 flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Customer Contacts ({sales.customers_contacted.length})
                    </h4>
                    
                    {sales.customers_contacted.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-4">
                        No customer contacts in this period
                      </p>
                    ) : (
                      <div className="space-y-3">
                        {sales.customers_contacted.map((contact) => (
                          <div
                            key={contact.client_id}
                            className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/dashboard/renewals/${contact.client_id}`)}
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  <h5 className="font-semibold truncate">
                                    {contact.business_name}
                                  </h5>
                                  <Badge variant="outline" className="flex-shrink-0">
                                    {contact.status || 'Pending'}
                                  </Badge>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 text-sm text-muted-foreground mb-2">
                                  <div className="flex items-center gap-1">
                                    <User className="h-3 w-3" />
                                    {contact.contact_person}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Phone className="h-3 w-3" />
                                    {contact.phone}
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Calendar className="h-3 w-3" />
                                    Contacted: {new Date(contact.contact_date).toLocaleDateString()}
                                  </div>
                                  {contact.contract_end_date && (
                                    <div className="flex items-center gap-1">
                                      <TrendingUp className="h-3 w-3" />
                                      Expires: {new Date(contact.contract_end_date).toLocaleDateString()}
                                    </div>
                                  )}
                                </div>

                                {contact.notes && (
                                  <p className="text-sm text-muted-foreground italic mt-2 line-clamp-2">
                                    "{contact.notes}"
                                  </p>
                                )}

                                <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                                  <span>Supplier: {contact.supplier}</span>
                                  {contact.annual_usage && (
                                    <span>AQ: {contact.annual_usage.toLocaleString()} kWh</span>
                                  )}
                                </div>
                              </div>

                              <div className="text-right flex-shrink-0">
                                <div className="flex items-center gap-1 text-lg font-semibold text-primary">
                                  <DollarSign className="h-4 w-4" />
                                  £{contact.estimated_revenue.toLocaleString()}
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  Est. Revenue
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    );
  };

  // If salesperson view (employeeId provided), show performance directly
  if (employeeId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>My Performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Your individual renewal performance and customer contacts
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="month" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
            </TabsList>
            
            <TabsContent value="week">
              {renderPerformanceData(weeklyPerformance)}
            </TabsContent>
            
            <TabsContent value="month">
              {renderPerformanceData(monthlyPerformance)}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    );
  }

  // Admin view - show staff grid
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Team Performance</CardTitle>
          <p className="text-sm text-muted-foreground">
            Click on any team member to view their individual renewal performance
          </p>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {staff.map((member) => (
              <button
                key={member.employee_id}
                onClick={() => handleStaffClick(member)}
                className="p-4 border rounded-lg hover:shadow-lg transition-all hover:border-primary bg-white hover:bg-gray-50 text-center group"
              >
                <div className="flex flex-col items-center gap-2">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                    <User className="h-6 w-6 text-primary" />
                  </div>
                  <div className="font-medium text-sm truncate w-full" title={member.employee_name}>
                    {member.employee_name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {member.role_name || 'Staff'}
                  </div>
                </div>
              </button>
            ))}
          </div>

          {staff.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-3 text-gray-400" />
              <p>No staff members found</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Performance Detail Dialog - Admin View */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-6xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Team Performance - Detailed Breakdown</DialogTitle>
            <DialogDescription>
              View weekly and monthly performance metrics for all team members
            </DialogDescription>
          </DialogHeader>

          <Tabs defaultValue="month" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="week">This Week</TabsTrigger>
              <TabsTrigger value="month">This Month</TabsTrigger>
            </TabsList>
            
            <TabsContent value="week">
              {renderPerformanceData(weeklyPerformance)}
            </TabsContent>
            
            <TabsContent value="month">
              {renderPerformanceData(monthlyPerformance)}
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}