"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, AlertCircle, CheckCircle2, Zap, Users, ChevronRight } from "lucide-react";
import { Bar, BarChart, XAxis, Cell, Pie, PieChart, LabelList } from "recharts";
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
  not_due_contracts: number;
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
  mpan_mpr?: string;
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

const supplierColors = [
  "var(--chart-1)",
  "var(--chart-2)", 
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const chartConfig = {
  renewals: {
    label: "Renewals",
    color: "var(--chart-1)",
  },
  contacted: {
    label: "Contacted",
    color: "var(--chart-2)",
  },
  notContacted: {
    label: "Not Contacted",
    color: "var(--chart-3)",
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

  const isAdmin = employeeId === undefined || employeeId === null;

  useEffect(() => {
    console.log("\n" + "=".repeat(80));
    console.log("🎯 ENERGY RENEWALS OVERVIEW - INITIALIZATION");
    console.log("=".repeat(80));
    console.log("Props received:");
    console.log("  - userRole:", userRole);
    console.log("  - employeeId:", employeeId);
    console.log("\nCalculated state:");
    console.log("  - isAdmin:", isAdmin);
    console.log("  - Will filter data:", !isAdmin);
    console.log("=".repeat(80) + "\n");
  }, [userRole, employeeId, isAdmin]);

  const loadEmployees = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        console.log("✅ Loaded employees:", data);
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
      
      const employeeParam = !isAdmin && employeeId ? `?employee_id=${employeeId}` : '';
      
      console.log(`📊 Fetching AQ breakdown with param: ${employeeParam}`);
      
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
      loadEmployees();
    }
  }, [isAdmin, employeeId]);

  const fetchRenewalStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");

      const employeeParam = !isAdmin && employeeId ? `?employee_id=${employeeId}` : '';

      console.log("\n" + "=".repeat(80));
      console.log("📊 FETCHING RENEWAL STATS");
      console.log("=".repeat(80));
      console.log("Request details:");
      console.log("  - isAdmin:", isAdmin);
      console.log("  - employeeId:", employeeId);
      console.log("  - URL:", `${API_BASE_URL}/energy-renewals/stats${employeeParam}`);
      console.log("=".repeat(80) + "\n");

      const statsRes = await fetch(`${API_BASE_URL}/energy-renewals/stats${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log("✅ Stats received:", statsData);
        setStats(statsData);
      } else {
        console.error("❌ Stats API failed:", await statsRes.text());
      }

      const supplierRes = await fetch(`${API_BASE_URL}/energy-renewals/supplier-breakdown${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (supplierRes.ok) {
        const supplierBreakdown = await supplierRes.json();
        console.log("✅ Supplier breakdown received:", supplierBreakdown.length, "suppliers");
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
      
      const employeeParam = !isAdmin && employeeId ? `&employee_id=${employeeId}` : '';

      console.log(`📈 Fetching sales performance: period=${period}, employeeParam=${employeeParam}`);

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
        employeeParam = `&employee_id=${employeeId}`;
      } else if (isAdmin) {
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
    { period: "30-60 Days", renewals: stats?.total_renewals_30_60_days || 0 },
    { period: "61-90 Days", renewals: stats?.total_renewals_61_90_days || 0 },
    { period: "90+ Days", renewals: stats?.total_renewals_90_plus_days || 0 },
  ];

  const contactStatus = [
    { status: "Contacted", count: stats?.contacted_count || 0, fill: "var(--chart-2)" },
    { status: "Not Contacted", count: stats?.not_contacted_count || 0, fill: "var(--chart-3)" },
  ];

  const renewalPercentage = stats
    ? ((stats.renewed_count / (stats.renewed_count + stats.lost_count + stats.contacted_count + stats.not_contacted_count)) * 100).toFixed(1)
    : "0";

  const formatAQ = (aq: number) => {
    if (aq >= 1000000) {
      return `${(aq / 1000000).toFixed(1)}M`;
    } else if (aq >= 1000) {
      return `${(aq / 1000).toFixed(0)}K`;
    }
    return aq.toString();
  };

  const formatCurrency = (amount: number) => {
    if (amount >= 1000000) {
      return `£${(amount / 1000000).toFixed(1)}M`;
    } else if (amount >= 1000) {
      return `£${(amount / 1000).toFixed(0)}K`;
    }
    return `£${amount.toFixed(0)}`;
  };

  return (
    <div className="space-y-4">
      
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
        {/* 30-60 Days */}
        <Card 
          className="border-orange-300 bg-orange-50/30 dark:border-orange-900/50 dark:bg-orange-950/20 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchPeriodBreakdown('30-60')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm dark:text-orange-300/80">Renewals Due (30-60 Days)</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-orange-900 dark:text-orange-200">
              {stats?.total_renewals_30_60_days || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800 whitespace-nowrap">
              <AlertTriangle className="h-3 w-3" />
              Urgent
            </Badge>
            <div className="line-clamp-1 font-medium text-orange-800 dark:text-orange-300/90">
              Immediate action required
            </div>
            <div className="text-orange-600 dark:text-orange-400 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* 61-90 Days */}
        <Card 
          className="border-yellow-300 bg-yellow-50/30 dark:border-yellow-900/50 dark:bg-yellow-950/20 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchPeriodBreakdown('61-90')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm dark:text-yellow-300/80">Renewals Due (61-90 Days)</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-yellow-900 dark:text-yellow-200">
              {stats?.total_renewals_61_90_days || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-950/60 dark:text-yellow-300 dark:border-yellow-800 whitespace-nowrap">
              <TrendingUp className="h-3 w-3" />
              Plan Ahead
            </Badge>
            <div className="line-clamp-1 font-medium text-yellow-800 dark:text-yellow-300/90">
              Start engagement process
            </div>
            <div className="text-yellow-600 dark:text-yellow-400 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* 91-180 Days */}
        <Card 
          className="border-blue-300 bg-blue-50/30 dark:border-blue-900/50 dark:bg-blue-950/20 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchPeriodBreakdown('91-180')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm dark:text-blue-300/80">Renewals Due (91-180 Days)</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-blue-900 dark:text-blue-200">
              {stats?.total_renewals_90_plus_days || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800 whitespace-nowrap">
              <TrendingUp className="h-3 w-3" />
              Monitor
            </Badge>
            <div className="line-clamp-1 font-medium text-blue-800 dark:text-blue-300/90">
              Early pipeline building
            </div>
            <div className="text-blue-600 dark:text-blue-400 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* Expired Contracts */}
        <Card 
          className="border-gray-400 bg-gray-50/50 dark:border-slate-700 dark:bg-slate-900/40 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchPeriodBreakdown('expired')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm dark:text-slate-400">Expired Contracts</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-gray-900 dark:text-slate-100">
              {stats?.expired_contracts || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-gray-200 text-gray-700 border-gray-400 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 whitespace-nowrap">
              <AlertCircle className="h-3 w-3" />
              Overdue
            </Badge>
            <div className="line-clamp-1 font-medium text-gray-800 dark:text-slate-300">
              Contracts already expired
            </div>
            <div className="text-gray-600 dark:text-slate-400 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* Not Due Contracts */}
        <Card 
          className="border-teal-300 bg-teal-50/30 dark:border-teal-900/50 dark:bg-teal-950/20 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchPeriodBreakdown('not-due')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm dark:text-teal-300/80">Not Due (365+ Days)</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-teal-900 dark:text-teal-200">
              {stats?.not_due_contracts || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-teal-100 text-teal-700 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800 whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3" />
              Long Term
            </Badge>
            <div className="line-clamp-1 font-medium text-teal-800 dark:text-teal-300/90">
              Contracts not due soon
            </div>
            <div className="text-teal-600 dark:text-teal-400 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* Total AQ */}
        <Card 
          className={`border-purple-300 bg-purple-50/30 dark:border-purple-900/50 dark:bg-purple-950/20 overflow-hidden ${isAdmin ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
          onClick={() => {
            if (isAdmin) {
              fetchAQBreakdown();
            }
          }}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm dark:text-purple-300/80">
              {isAdmin ? "Total AQ" : "Your Total AQ"}
            </CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-purple-900 dark:text-purple-200">
              {formatAQ(stats?.total_aq || 0)} kWh
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800 whitespace-nowrap">
              <Zap className="h-3 w-3" />
              Energy
            </Badge>
            <div className="line-clamp-1 font-medium text-purple-800 dark:text-purple-300/90">
              {isAdmin ? "Total consumption at risk" : "Your consumption at risk"}
            </div>
            {isAdmin ? (
              <div className="text-purple-600 dark:text-purple-400 flex items-center gap-1">
                Click for breakdown <ChevronRight className="h-3 w-3" />
              </div>
            ) : (
              <div className="text-purple-600 dark:text-purple-400">Annual energy usage</div>
            )}
          </CardFooter>
        </Card>

        {/* Revenue at Risk */}
        <Card className="border-red-300 bg-red-50/30 dark:border-red-900/50 dark:bg-red-950/20 overflow-hidden">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm dark:text-red-300/80">
              {isAdmin ? "Total Revenue at Risk" : "Your Revenue at Risk"}
            </CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums text-red-900 dark:text-red-200 break-all leading-tight">
              {formatCurrency(stats?.total_revenue_at_risk || 0)}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800 whitespace-nowrap">
              <AlertTriangle className="h-3 w-3 mr-1" />
              High Priority
            </Badge>
            <div className="line-clamp-2 font-medium text-red-800 dark:text-red-300/90">
              {isAdmin ? "Total contract value expiring" : "Your contract value expiring"}
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Renewals by Period */}
        <Card className="dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="dark:text-slate-100">Renewals by Period</CardTitle>
            <CardDescription className="dark:text-slate-400">
              {isAdmin ? "Upcoming contract expirations" : "Your upcoming expirations"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={renewalsByPeriod} margin={{ left: 0, right: 0, top: 20, bottom: 20 }}>
                <XAxis 
                  dataKey="period" 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={8}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="renewals" fill="var(--color-renewals)" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Contact Status */}
        <Card className="dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="dark:text-slate-100">Contact Status</CardTitle>
            <CardDescription className="dark:text-slate-400">
              {isAdmin ? "Customer engagement progress" : "Your engagement progress"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 flex items-center justify-center">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <PieChart>
                <Pie
                  data={contactStatus}
                  dataKey="count"
                  nameKey="status"
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                >
                  {contactStatus.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                  <LabelList
                    dataKey="count"
                    position="inside"
                    className="fill-white font-bold"
                  />
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          </CardContent>
          <CardFooter className="flex justify-around text-sm">
            <div className="flex items-center gap-2 dark:text-slate-300">
              <div className="h-3 w-3 rounded-full bg-[var(--chart-2)]"></div>
              <span>Contacted: {stats?.contacted_count || 0}</span>
            </div>
            <div className="flex items-center gap-2 dark:text-slate-300">
              <div className="h-3 w-3 rounded-full bg-[var(--chart-3)]"></div>
              <span>Pending: {stats?.not_contacted_count || 0}</span>
            </div>
          </CardFooter>
        </Card>

        {/* Supplier Breakdown */}
        <Card className="dark:bg-slate-900 dark:border-slate-800">
          <CardHeader>
            <CardTitle className="dark:text-slate-100">Top Suppliers</CardTitle>
            <CardDescription className="dark:text-slate-400">
              {isAdmin ? "Contracts expiring by supplier" : "Your contracts by supplier"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 overflow-y-auto">
            <div className="space-y-3">
              {supplierData.slice(0, 6).map((supplier, index) => (
                <div key={supplier.supplier_name} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: supplierColors[index % supplierColors.length] }}
                      />
                      <span className="font-medium truncate max-w-[150px] dark:text-slate-200">
                        {supplier.supplier_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground dark:text-slate-400">{supplier.renewal_count} contracts</span>
                      <span className="font-semibold dark:text-slate-100">{formatCurrency(supplier.total_value)}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 dark:bg-slate-800 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(supplier.total_value / (stats?.total_revenue_at_risk || 1)) * 100}%`,
                        backgroundColor: supplierColors[index % supplierColors.length],
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Performance Summary */}
      <Card className="dark:bg-slate-900 dark:border-slate-800">
        <CardHeader>
          <CardTitle className="dark:text-slate-100">Renewal Performance</CardTitle>
          <CardDescription className="dark:text-slate-400">
            {isAdmin ? "Overall renewal success metrics" : "Your renewal success metrics"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg bg-green-50 dark:bg-green-950/20 dark:border-green-900/50">
              <div className="text-3xl font-bold text-green-700 dark:text-green-400">{stats?.renewed_count || 0}</div>
              <div className="text-sm text-green-600 dark:text-green-300 mt-1">Renewed</div>
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 mx-auto mt-2" />
            </div>
            <div className="text-center p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900/50">
              <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{stats?.contacted_count || 0}</div>
              <div className="text-sm text-blue-600 dark:text-blue-300 mt-1">In Progress</div>
              <TrendingUp className="h-5 w-5 text-blue-600 dark:text-blue-400 mx-auto mt-2" />
            </div>
            <div className="text-center p-4 border rounded-lg bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900/50">
              <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">{stats?.not_contacted_count || 0}</div>
              <div className="text-sm text-orange-600 dark:text-orange-300 mt-1">Not Contacted</div>
              <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400 mx-auto mt-2" />
            </div>
            <div className="text-center p-4 border rounded-lg bg-red-50 dark:bg-red-950/20 dark:border-red-900/50">
              <div className="text-3xl font-bold text-red-700 dark:text-red-400">{stats?.lost_count || 0}</div>
              <div className="text-sm text-red-600 dark:text-red-300 mt-1">Lost</div>
              <TrendingDown className="h-5 w-5 text-red-600 dark:text-red-400 mx-auto mt-2" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div className="w-full text-center text-sm text-muted-foreground dark:text-slate-400">
            Renewal success rate: <span className="font-semibold text-foreground dark:text-slate-200">{renewalPercentage}%</span>
          </div>
        </CardFooter>
      </Card>
      
      {/* Period Breakdown Modal */}
      <Dialog open={showPeriodModal} onOpenChange={(open) => {
        setShowPeriodModal(open);
        if (!open && isAdmin) {
          setModalEmployeeFilter(undefined);
        }
      }}>
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[90vh] overflow-hidden flex flex-col dark:bg-slate-900 dark:border-slate-800 dark:text-slate-100">
          <DialogHeader className="pb-4 border-b dark:border-slate-800 flex-shrink-0">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-bold mb-2 dark:text-slate-100">
                  {selectedPeriod === 'expired' ? 'Expired Contracts' :
                  selectedPeriod === 'not-due' ? 'Not Due Contracts (365+ Days)' :
                  selectedPeriod === '30-60' ? 'Renewals Due: 30-60 Days' : 
                  selectedPeriod === '61-90' ? 'Renewals Due: 61-90 Days' : 
                  'Renewals Due: 91-180 Days'}
                </DialogTitle>
                <DialogDescription className="text-sm dark:text-slate-400">
                  Showing {periodBreakdown.length} customer{periodBreakdown.length !== 1 ? 's' : ''} in this period
                </DialogDescription>
              </div>
              
              {isAdmin && (
                <Select
                  value={modalEmployeeFilter?.toString() || "all"}
                  onValueChange={(value) => {
                    const newEmployeeId = value === "all" ? undefined : parseInt(value);
                    setModalEmployeeFilter(newEmployeeId);
                    fetchPeriodBreakdown(selectedPeriod, newEmployeeId);
                  }}
                >
                  <SelectTrigger className="w-[220px] flex-shrink-0 dark:bg-slate-950 dark:border-slate-800 dark:text-slate-200">
                    <SelectValue placeholder="All Salespeople" />
                  </SelectTrigger>
                  <SelectContent className="dark:bg-slate-900 dark:border-slate-800 dark:text-slate-200">
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
              <div className="text-center py-16 text-gray-500 dark:text-slate-400">
                <p className="text-lg">No renewals found for this period</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {periodBreakdown.map((renewal) => (
                  <div
                    key={renewal.client_id}
                    className="p-5 border rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 dark:border-slate-800 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => window.open(`/dashboard/renewals/${renewal.client_id}`, "_blank", "noopener,noreferrer")}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{renewal.business_name}</h3>
                          <Badge variant="outline" className="text-xs flex-shrink-0 dark:border-slate-700 dark:text-slate-300">
                            {renewal.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 dark:text-slate-400 truncate">
                          {renewal.contact_person} · {renewal.phone}
                        </p>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-blue-700 dark:text-blue-400 whitespace-nowrap">
                          {renewal.annual_usage?.toLocaleString() || 0} kWh
                        </p>
                        <p className="text-xs text-gray-600 dark:text-slate-400 mt-1 whitespace-nowrap">
                          {selectedPeriod === 'expired' 
                            ? `${Math.abs(renewal.days_until_expiry)} days overdue`
                            : selectedPeriod === 'not-due'
                            ? `In ${renewal.days_until_expiry} days`
                            : `In ${renewal.days_until_expiry} days`
                          }
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-slate-400 uppercase mb-1">Supplier</p>
                        <p className="font-semibold text-sm text-gray-900 dark:text-slate-200 truncate">{renewal.supplier_name}</p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-slate-400 uppercase mb-1">MPR</p>
                        <p className="font-semibold text-sm text-gray-900 dark:text-slate-200 font-mono truncate">
                          {renewal.mpan_mpr || renewal.mpan_number || "N/A"}
                        </p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-slate-400 uppercase mb-1">Annual Usage</p>
                        <p className="font-semibold text-sm text-gray-900 dark:text-slate-200 truncate">{renewal.annual_usage?.toLocaleString() || 0} kWh</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}