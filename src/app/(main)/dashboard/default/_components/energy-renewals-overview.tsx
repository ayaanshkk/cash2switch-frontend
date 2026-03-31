"use client";

import { useState, useEffect } from "react";
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Zap,
  Users,
  ChevronRight,
  Clock,
  PoundSterling,
} from "lucide-react";
import { Bar, BarChart, XAxis, Cell, Pie, PieChart } from "recharts";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface Employee {
  employee_id: number;
  employee_name: string;
  email: string;
}

interface RenewalStats {
  total_renewals_30_60_days: number;
  total_renewals_61_90_days: number;
  total_renewals_90_plus_days: number;
  expired_contracts: number;
  total_revenue_at_risk: number;
  total_aq: number;
  contacted_count: number;
  not_contacted_count: number;
  renewed_count: number;
  lost_count: number;
}

interface SupplierBreakdown {
  supplier_name: string;
  renewal_count: number;
  total_value: number;
}

interface SalespersonPerformance {
  employee_id: number;
  employee_name: string;
  total_contacts: number;
  converted_count: number;
  total_value_touched: number;
  conversion_rate: number;
}

interface PeriodBreakdown {
  client_id: number;
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  supplier_name: string;
  contract_end_date: string;
  days_until_expiry: number;
  mpan_number: string;
  annual_usage: number;
  estimated_revenue: number;
  assigned_to: string;
  status: string;
}

interface EnergyRenewalsOverviewProps {
  userRole?: string;
  employeeId?: number;
}

interface AQBreakdown {
  employee_id: number;
  employee_name: string;
  customer_count: number;
  total_aq: number;
  total_revenue: number;
  average_aq_per_customer: number;
}

interface AQBreakdownResponse {
  total_aq: number;
  total_revenue: number;
  total_customers: number;
  salesperson_count: number;
  breakdown: AQBreakdown[];
}

/** Reference palette: blue, orange, yellow, green, purple, pink */
const DASH = {
  blue: "#3B82F6",
  orange: "#F97316",
  yellow: "#FBBF24",
  green: "#22c55e",
  purple: "#a855f7",
  pink: "#ec4899",
  slate: "#94a3b8",
} as const;

const BAR_PERIOD_FILLS = [DASH.orange, DASH.yellow, DASH.blue] as const;

const supplierBarColors = [
  DASH.blue,
  DASH.orange,
  DASH.green,
  DASH.purple,
  DASH.yellow,
  DASH.pink,
];

const chartConfig = {
  renewals: {
    label: "Renewals",
    color: DASH.blue,
  },
  contacted: {
    label: "Contacted",
    color: DASH.blue,
  },
  notContacted: {
    label: "Not Contacted",
    color: DASH.slate,
  },
};

export function EnergyRenewalsOverview({ userRole, employeeId }: EnergyRenewalsOverviewProps = {}) {
  const router = useRouter();
  const [stats, setStats] = useState<RenewalStats | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierBreakdown[]>([]);
  const [salesPerformance, setSalesPerformance] = useState<SalespersonPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalEmployeeFilter, setModalEmployeeFilter] = useState<number | undefined>(undefined);
  
  // Modal states
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [periodBreakdown, setPeriodBreakdown] = useState<PeriodBreakdown[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [modalLoading, setModalLoading] = useState(false);
  const [showAQModal, setShowAQModal] = useState(false);
  const [aqBreakdown, setAQBreakdown] = useState<AQBreakdownResponse | null>(null);
  const [aqModalLoading, setAQModalLoading] = useState(false);

  // ✅ CRITICAL FIX: Determine admin status based on employeeId prop
  // If employeeId is undefined/null, user is admin (viewing all data)
  // If employeeId is provided, user is salesperson (viewing only their data)
  const isAdmin = employeeId === undefined || employeeId === null;

  const loadEmployees = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const fetchAQBreakdown = async () => {
    setAQModalLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      
      // ✅ Salespeople see their own stats, admins see everyone
      const employeeParam = !isAdmin && employeeId ? `?employee_id=${employeeId}` : '';
      
      const res = await fetch(
        `${API_BASE_URL}/energy-renewals/aq-breakdown${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        setAQBreakdown(data);
        setShowAQModal(true);
      }
    } catch (error) {
      console.error("Error fetching AQ breakdown:", error);
    } finally {
      setAQModalLoading(false);
    }
  };

  useEffect(() => {
    fetchRenewalStats();
    fetchSalesPerformance('month');
    if (isAdmin) {
      loadEmployees(); // ✅ Only admins need employee list for filters
    }
  }, [isAdmin, employeeId]);

  const fetchRenewalStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");

      // ✅ CRITICAL FIX: Only add employee_id param for salespeople
      const employeeParam = !isAdmin && employeeId ? `?employee_id=${employeeId}` : '';

      const statsRes = await fetch(`${API_BASE_URL}/energy-renewals/stats${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      const supplierRes = await fetch(`${API_BASE_URL}/energy-renewals/supplier-breakdown${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (supplierRes.ok) {
        const supplierBreakdown = await supplierRes.json();
        setSupplierData(supplierBreakdown);
      }
    } catch (error) {
      console.error("❌ Error fetching renewal stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSalesPerformance = async (period: 'week' | 'month') => {
    try {
      const token = localStorage.getItem("auth_token");
      
      // ✅ Salespeople see only their own performance
      const employeeParam = !isAdmin && employeeId ? `&employee_id=${employeeId}` : '';

      const res = await fetch(
        `${API_BASE_URL}/energy-renewals/salesperson-performance?period=${period}${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        setSalesPerformance(data.performance || []);
      }
    } catch (error) {
      console.error("Error fetching sales performance:", error);
    }
  };

  const fetchPeriodBreakdown = async (period: string, employeeOverride?: number | undefined | null) => {
    setModalLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      
      let employeeParam = '';
      
      if (!isAdmin && employeeId) {
        // Salesperson - always filter by their employeeId
        employeeParam = `&employee_id=${employeeId}`;
      } else if (isAdmin) {
        // Use the override if provided (from dropdown change), otherwise fall back to state
        const effectiveFilter = employeeOverride !== undefined ? employeeOverride : modalEmployeeFilter;
        if (effectiveFilter) {
          employeeParam = `&employee_id=${effectiveFilter}`;
        }
      }

      const res = await fetch(
        `${API_BASE_URL}/energy-renewals/period-breakdown?period=${period}${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        setPeriodBreakdown(data.renewals || []);
        setSelectedPeriod(period);
        setShowPeriodModal(true);
      }
    } catch (error) {
      console.error("Error fetching period breakdown:", error);
    } finally {
      setModalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const renewalsByPeriod = [
    { period: "30 Days", renewals: stats?.total_renewals_30_60_days || 0 },
    { period: "60 Days", renewals: stats?.total_renewals_61_90_days || 0 },
    { period: "90 Days", renewals: stats?.total_renewals_90_plus_days || 0 },
  ];

  const contactStatus = [
    { status: "Contacted", count: stats?.contacted_count || 0, fill: DASH.blue },
    { status: "Pending", count: stats?.not_contacted_count || 0, fill: "#E5E7EB" },
  ];

  const renewalTotal =
    stats &&
    stats.renewed_count +
      stats.lost_count +
      stats.contacted_count +
      stats.not_contacted_count;
  const renewalPercentage =
    stats && renewalTotal
      ? ((stats.renewed_count / renewalTotal) * 100).toFixed(1)
      : "0";
  const renewalPctNum = Math.min(100, Math.max(0, parseFloat(renewalPercentage) || 0));

  const formatAQ = (aq: number) => {
    if (aq >= 1000000) {
      return `${(aq / 1000000).toFixed(1)}M`;
    } else if (aq >= 1000) {
      return `${(aq / 1000).toFixed(0)}K`;
    }
    return aq.toString();
  };

  return (
      <div className="space-y-6">
        {/* KPI row — reference-style tinted cards + icon orbs */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Card
            className="cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-b from-orange-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-orange-100 transition hover:shadow-lg"
            onClick={() => fetchPeriodBreakdown("30-60")}
          >
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-orange-100">
                <AlertTriangle className="h-6 w-6 text-[#F97316]" strokeWidth={2} />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums text-slate-900">
                {stats?.total_renewals_30_60_days || 0}
              </CardTitle>
              <CardDescription className="text-sm font-semibold text-slate-700">Due in 30 days</CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 pt-0 text-sm text-slate-600">
              <span>Immediate action</span>
              <span className="flex items-center gap-1 text-xs font-medium text-[#F97316]">
                Details <ChevronRight className="h-3 w-3" />
              </span>
            </CardFooter>
          </Card>

          <Card
            className="cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-b from-amber-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-amber-100 transition hover:shadow-lg"
            onClick={() => fetchPeriodBreakdown("61-90")}
          >
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                <Clock className="h-6 w-6 text-[#FBBF24]" strokeWidth={2} />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums text-slate-900">
                {stats?.total_renewals_61_90_days || 0}
              </CardTitle>
              <CardDescription className="text-sm font-semibold text-slate-700">Due in 60 days</CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 pt-0 text-sm text-slate-600">
              <span>Start engagement</span>
              <span className="flex items-center gap-1 text-xs font-medium text-amber-700">
                Details <ChevronRight className="h-3 w-3" />
              </span>
            </CardFooter>
          </Card>

          <Card
            className="cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-b from-blue-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-blue-100 transition hover:shadow-lg"
            onClick={() => fetchPeriodBreakdown("91-180")}
          >
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-blue-100">
                <TrendingUp className="h-6 w-6 text-[#3B82F6]" strokeWidth={2} />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums text-slate-900">
                {stats?.total_renewals_90_plus_days || 0}
              </CardTitle>
              <CardDescription className="text-sm font-semibold text-slate-700">Due in 90 days</CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 pt-0 text-sm text-slate-600">
              <span>Pipeline building</span>
              <span className="flex items-center gap-1 text-xs font-medium text-blue-600">
                Details <ChevronRight className="h-3 w-3" />
              </span>
            </CardFooter>
          </Card>

          <Card
            className="cursor-pointer overflow-hidden rounded-xl border-0 bg-gradient-to-b from-slate-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-slate-200 transition hover:shadow-lg"
            onClick={() => fetchPeriodBreakdown("expired")}
          >
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <AlertCircle className="h-6 w-6 text-slate-700" strokeWidth={2} />
              </div>
              <CardTitle className="text-4xl font-bold tabular-nums text-slate-900">
                {stats?.expired_contracts || 0}
              </CardTitle>
              <CardDescription className="text-sm font-semibold text-slate-700">Expired</CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 pt-0 text-sm text-slate-600">
              <span>Needs follow-up</span>
              <span className="flex items-center gap-1 text-xs font-medium text-slate-600">
                Details <ChevronRight className="h-3 w-3" />
              </span>
            </CardFooter>
          </Card>

          <Card
            className={`overflow-hidden rounded-xl border-0 bg-gradient-to-b from-violet-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-violet-100 ${isAdmin ? "cursor-pointer transition hover:shadow-lg" : ""}`}
            onClick={() => {
              if (isAdmin) fetchAQBreakdown();
            }}
          >
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-violet-100">
                <Zap className="h-6 w-6 text-[#a855f7]" strokeWidth={2} />
              </div>
              <CardTitle className="text-3xl font-bold tabular-nums text-slate-900">
                {formatAQ(stats?.total_aq || 0)}{" "}
                <span className="text-lg font-semibold text-slate-600">kWh</span>
              </CardTitle>
              <CardDescription className="text-sm font-semibold text-slate-700">
                {isAdmin ? "Total AQ" : "Your AQ"}
              </CardDescription>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 pt-0 text-sm text-slate-600">
              <span>{isAdmin ? "Consumption at risk" : "Your usage"}</span>
              {isAdmin && (
                <span className="flex items-center gap-1 text-xs font-medium text-violet-700">
                  Breakdown <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </CardFooter>
          </Card>

          <Card className="overflow-hidden rounded-xl border-0 bg-gradient-to-b from-pink-50 to-white shadow-md shadow-slate-200/50 ring-1 ring-pink-100">
            <CardHeader className="pb-2">
              <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-pink-100">
                <PoundSterling className="h-6 w-6 text-[#ec4899]" strokeWidth={2} />
              </div>
              <CardTitle className="text-2xl font-bold tabular-nums leading-tight text-slate-900">
                £
                {(stats?.total_revenue_at_risk || 0).toLocaleString("en-GB", {
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                })}
              </CardTitle>
              <CardDescription className="text-sm font-semibold text-slate-700">Revenue at risk</CardDescription>
            </CardHeader>
            <CardFooter className="pt-0 text-sm text-slate-600">
              Total contract value expiring
            </CardFooter>
          </Card>
        </div>

        {/* Charts + suppliers */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">Upcoming expirations</CardTitle>
              <CardDescription>
                {isAdmin ? "Volume by horizon" : "Your renewals by horizon"}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <BarChart data={renewalsByPeriod} margin={{ left: 4, right: 4, top: 16, bottom: 8 }}>
                  <XAxis
                    dataKey="period"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={10}
                    tick={{ fill: "#64748b", fontSize: 12 }}
                  />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="renewals" radius={[10, 10, 0, 0]} maxBarSize={56}>
                    {renewalsByPeriod.map((_, i) => (
                      <Cell key={`bar-${i}`} fill={BAR_PERIOD_FILLS[i] ?? DASH.blue} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </CardContent>
          </Card>

          <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">Engagement progress</CardTitle>
              <CardDescription>
                {isAdmin ? "Contacted vs pending" : "Your pipeline"}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex h-64 items-center justify-center">
              <ChartContainer config={chartConfig} className="h-full w-full">
                <PieChart>
                  <Pie
                    data={contactStatus}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={68}
                    outerRadius={92}
                    stroke="#fff"
                    strokeWidth={2}
                  >
                    {contactStatus.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                </PieChart>
              </ChartContainer>
            </CardContent>
            <CardFooter className="flex flex-wrap justify-center gap-6 text-sm text-slate-700">
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full" style={{ backgroundColor: DASH.blue }} />
                <span>Contacted: {stats?.contacted_count || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-slate-300" />
                <span>Pending: {stats?.not_contacted_count || 0}</span>
              </div>
            </CardFooter>
          </Card>

          <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
            <CardHeader>
              <CardTitle className="text-lg font-bold text-slate-900">Top suppliers</CardTitle>
              <CardDescription>
                {isAdmin ? "Share of expiring value" : "Your suppliers"}
              </CardDescription>
            </CardHeader>
            <CardContent className="h-64 overflow-y-auto pr-1">
              <div className="space-y-3">
                {supplierData.slice(0, 6).map((supplier, index) => {
                  const c = supplierBarColors[index % supplierBarColors.length];
                  return (
                    <div key={supplier.supplier_name} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <div className="flex min-w-0 items-center gap-2">
                          <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c }} />
                          <span className="truncate font-medium text-slate-800">{supplier.supplier_name}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                          <span>{supplier.renewal_count} contracts</span>
                          <span className="font-semibold text-slate-900">
                            £{(supplier.total_value / 1000).toFixed(0)}K
                          </span>
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${(supplier.total_value / (stats?.total_revenue_at_risk || 1)) * 100}%`,
                            backgroundColor: c,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall renewal success */}
        <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
          <CardHeader className="flex flex-col gap-4 space-y-0 pb-2 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <CardTitle className="text-lg font-bold text-slate-900">Overall renewal success</CardTitle>
              <CardDescription>
                {isAdmin ? "Pipeline outcomes across the book" : "Your renewal outcomes"}
              </CardDescription>
            </div>
            <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:min-w-[200px] sm:items-end">
              <span className="text-4xl font-bold tabular-nums text-slate-900">{renewalPercentage}%</span>
              <span className="text-xs font-medium text-slate-500">Success rate</span>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100 sm:w-48">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all"
                  style={{ width: `${renewalPctNum}%` }}
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
                <div className="text-3xl font-bold tabular-nums text-slate-900">{stats?.renewed_count ?? 0}</div>
                <div className="mt-1 text-sm font-semibold text-emerald-800">Renewed</div>
              </div>
              <div className="rounded-xl border border-blue-100 bg-gradient-to-b from-blue-50/80 to-white p-4 shadow-sm ring-1 ring-blue-100/60">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-blue-100">
                  <TrendingUp className="h-5 w-5 text-blue-600" strokeWidth={2} />
                </div>
                <div className="text-3xl font-bold tabular-nums text-slate-900">{stats?.contacted_count ?? 0}</div>
                <div className="mt-1 text-sm font-semibold text-blue-800">In progress</div>
              </div>
              <div className="rounded-xl border border-amber-100 bg-gradient-to-b from-amber-50/80 to-white p-4 shadow-sm ring-1 ring-amber-100/60">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-amber-100">
                  <Clock className="h-5 w-5 text-amber-600" strokeWidth={2} />
                </div>
                <div className="text-3xl font-bold tabular-nums text-slate-900">{stats?.not_contacted_count ?? 0}</div>
                <div className="mt-1 text-sm font-semibold text-amber-800">Not contacted</div>
              </div>
              <div className="rounded-xl border border-rose-100 bg-gradient-to-b from-rose-50/80 to-white p-4 shadow-sm ring-1 ring-rose-100/60">
                <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-rose-100">
                  <TrendingDown className="h-5 w-5 text-rose-600" strokeWidth={2} />
                </div>
                <div className="text-3xl font-bold tabular-nums text-slate-900">{stats?.lost_count ?? 0}</div>
                <div className="mt-1 text-sm font-semibold text-rose-800">Lost</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Period Breakdown Modal */}
        <Dialog open={showPeriodModal} onOpenChange={(open) => {
          setShowPeriodModal(open);
          if (!open && isAdmin) {
            setModalEmployeeFilter(undefined);
          }
        }}>
          <DialogContent className="max-w-[98vw] w-[98vw] max-h-[90vh] overflow-hidden flex flex-col">
            <DialogHeader className="pb-4 border-b flex-shrink-0">
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-2xl font-bold mb-2">
                    {selectedPeriod === 'expired' ? 'Expired Contracts' :
                     selectedPeriod === '30-60' ? 'Renewals Due: 30-60 Days' : 
                     selectedPeriod === '61-90' ? 'Renewals Due: 61-90 Days' : 
                     'Renewals Due: 91-180 Days'}
                  </DialogTitle>
                  <DialogDescription className="text-sm">
                    Showing {periodBreakdown.length} customer{periodBreakdown.length !== 1 ? 's' : ''} in this period
                  </DialogDescription>
                </div>
                
                {/* ✅ Only show filter dropdown for admins */}
                {isAdmin && (
                  <Select
                    value={modalEmployeeFilter?.toString() || "all"}
                    onValueChange={(value) => {
                      const newEmployeeId = value === "all" ? undefined : parseInt(value);
                      setModalEmployeeFilter(newEmployeeId);
                      fetchPeriodBreakdown(selectedPeriod, newEmployeeId);
                    }}
                  >
                    <SelectTrigger className="w-[220px] flex-shrink-0">
                      <SelectValue placeholder="All Salespeople" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Salespeople</SelectItem>
                      {employees.map((emp) => (
                        <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                          {emp.employee_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto pr-2">
              {modalLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
                </div>
              ) : periodBreakdown.length === 0 ? (
                <div className="text-center py-16 text-gray-500">
                  <p className="text-lg">No renewals found for this period</p>
                </div>
              ) : (
                <div className="space-y-3 py-4">
                  {periodBreakdown.map((renewal) => (
                    <div
                      key={renewal.client_id}
                      className="p-5 border rounded-xl hover:bg-gray-50 hover:shadow-sm cursor-pointer transition-all"
                      onClick={() => router.push(`/dashboard/renewals/${renewal.client_id}`)}
                    >
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-lg font-bold text-gray-900 truncate">{renewal.business_name}</h3>
                            <Badge variant="outline" className="text-xs flex-shrink-0">
                              {renewal.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 truncate">
                            {renewal.contact_person} · {renewal.phone}
                          </p>
                        </div>
                        
                        <div className="text-right flex-shrink-0">
                          <p className="text-xl font-bold text-green-700 whitespace-nowrap">
                            £{renewal.estimated_revenue.toLocaleString('en-GB')}
                          </p>
                          <p className="text-xs text-gray-600 mt-1 whitespace-nowrap">
                            {selectedPeriod === 'expired' 
                              ? `${Math.abs(renewal.days_until_expiry)} days overdue`
                              : `In ${renewal.days_until_expiry} days`
                            }
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-5 gap-4 pt-3 border-t border-gray-100">
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase mb-1">Supplier</p>
                          <p className="font-semibold text-sm text-gray-900 truncate">{renewal.supplier_name}</p>
                        </div>
                        
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase mb-1">MPAN</p>
                          <p className="font-semibold text-sm text-gray-900 font-mono truncate">{renewal.mpan_number}</p>
                        </div>
                        
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase mb-1">Annual Usage</p>
                          <p className="font-semibold text-sm text-gray-900 truncate">{renewal.annual_usage?.toLocaleString()} kWh</p>
                        </div>
                        
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase mb-1">Contract End</p>
                          <p className="font-semibold text-sm text-gray-900 truncate">
                            {renewal.contract_end_date ? new Date(renewal.contract_end_date).toLocaleDateString('en-GB') : 'N/A'}
                          </p>
                        </div>
                        
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500 uppercase mb-1">Assigned To</p>
                          <p className="font-semibold text-sm text-purple-700 flex items-center gap-1 truncate">
                            <Users className="h-3 w-3 flex-shrink-0" />
                            <span className="truncate">{renewal.assigned_to}</span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* AQ Breakdown Modal */}
        <Dialog open={showAQModal} onOpenChange={setShowAQModal}>
          <DialogContent className="max-w-[98vw] w-[98vw] max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-2xl">
                {isAdmin ? "AQ Breakdown by Salesperson" : "Your AQ Breakdown"}
              </DialogTitle>
              <DialogDescription className="text-base">
                {isAdmin 
                  ? "Total annual quantity (AQ) split across sales team"
                  : "Your total annual quantity (AQ)"}
              </DialogDescription>
            </DialogHeader>

            {aqModalLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : aqBreakdown ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card className="bg-purple-50">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-sm">Total AQ</CardDescription>
                      <CardTitle className="text-3xl text-purple-900">
                        {formatAQ(aqBreakdown.total_aq)} kWh
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="bg-green-50">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-sm">Total Revenue</CardDescription>
                      <CardTitle className="text-3xl text-green-900">
                        £{(aqBreakdown.total_revenue / 1000).toFixed(1)}K
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="bg-blue-50">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-sm">Total Customers</CardDescription>
                      <CardTitle className="text-3xl text-blue-900">
                        {aqBreakdown.total_customers}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                  <Card className="bg-orange-50">
                    <CardHeader className="pb-3">
                      <CardDescription className="text-sm">
                        {isAdmin ? "Salespeople" : "Your Portfolio"}
                      </CardDescription>
                      <CardTitle className="text-3xl text-orange-900">
                        {isAdmin ? aqBreakdown.salesperson_count : "Active"}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {isAdmin && (
                  <div className="rounded-lg border bg-white">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 border-b">
                          <tr>
                            <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap min-w-[200px]">
                              Salesperson
                            </th>
                            <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap min-w-[120px]">
                              Customers
                            </th>
                            <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap min-w-[150px]">
                              Total AQ (kWh)
                            </th>
                            <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap min-w-[160px]">
                              Avg AQ/Customer
                            </th>
                            <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap min-w-[130px]">
                              Revenue (£)
                            </th>
                            <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap min-w-[250px]">
                              % of Total AQ
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {aqBreakdown.breakdown.map((sales) => {
                            const aqPercentage = ((sales.total_aq / aqBreakdown.total_aq) * 100).toFixed(1);
                            
                            return (
                              <tr key={sales.employee_id} className="hover:bg-gray-50">
                                <td className="px-6 py-5 whitespace-nowrap">
                                  <div className="flex items-center gap-3">
                                    <Users className="h-5 w-5 text-purple-600 flex-shrink-0" />
                                    <span className="font-medium text-base">{sales.employee_name}</span>
                                  </div>
                                </td>
                                <td className="px-6 py-5 text-right text-base whitespace-nowrap">
                                  {sales.customer_count}
                                </td>
                                <td className="px-6 py-5 text-right font-semibold text-lg text-purple-900 whitespace-nowrap">
                                  {formatAQ(sales.total_aq)}
                                </td>
                                <td className="px-6 py-5 text-right text-base text-gray-700 whitespace-nowrap">
                                  {formatAQ(sales.average_aq_per_customer)}
                                </td>
                                <td className="px-6 py-5 text-right font-semibold text-base text-green-700 whitespace-nowrap">
                                  £{(sales.total_revenue / 1000).toFixed(1)}K
                                </td>
                                <td className="px-6 py-5 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-4">
                                    <div className="w-40 h-4 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                                      <div
                                        className="h-full bg-purple-600 rounded-full transition-all"
                                        style={{ width: `${aqPercentage}%` }}
                                      />
                                    </div>
                                    <span className="text-base font-semibold w-16 text-right">{aqPercentage}%</span>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No data available</p>
            )}
          </DialogContent>
        </Dialog>
      </div>  
    );
  }