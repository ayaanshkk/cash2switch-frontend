"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Zap, Users, ChevronRight } from "lucide-react";
import { Bar, BarChart, XAxis, Cell, Pie, PieChart, LabelList } from "recharts";
import { useRouter } from "next/navigation";

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

interface RenewalStats {
  total_renewals_30_60_days: number;
  total_renewals_61_90_days: number;
  total_renewals_90_plus_days: number;
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
  
  // Modal states
  const [showPeriodModal, setShowPeriodModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [periodBreakdown, setPeriodBreakdown] = useState<PeriodBreakdown[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<string>("");
  const [modalLoading, setModalLoading] = useState(false);
  const [showAQModal, setShowAQModal] = useState(false);
  const [aqBreakdown, setAQBreakdown] = useState<AQBreakdownResponse | null>(null);
  const [aqModalLoading, setAQModalLoading] = useState(false);

  const fetchAQBreakdown = async () => {
    setAQModalLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      
      const res = await fetch(
        `${API_BASE_URL}/energy-renewals/aq-breakdown`,
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
  }, []);

  const fetchRenewalStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");

      // ✅ DEBUG: What are we filtering by?
      console.log("📊 Fetching Stats with Filter:", {
        userRole,
        employeeId,
        isFiltered: employeeId !== undefined,
        filterType: employeeId ? `Salesperson (ID: ${employeeId})` : 'All Company Data'
      });

      // ✅ Add employee filter for salespeople
      const employeeParam = employeeId ? `?employee_id=${employeeId}` : '';

      console.log(`📡 API Call: ${API_BASE_URL}/energy-renewals/stats${employeeParam}`);

      // Fetch renewal statistics
      const statsRes = await fetch(`${API_BASE_URL}/energy-renewals/stats${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log("✅ Stats Received:", {
          total_renewals_30_60_days: statsData.total_renewals_30_60_days,
          total_renewals_61_90_days: statsData.total_renewals_61_90_days,
          total_renewals_90_plus_days: statsData.total_renewals_90_plus_days,
          total_aq: statsData.total_aq,
          contacted_count: statsData.contacted_count,
          not_contacted_count: statsData.not_contacted_count,
          renewed_count: statsData.renewed_count,
          lost_count: statsData.lost_count
        });
        setStats(statsData);
      } else {
        console.error("❌ Stats API failed:", await statsRes.text());
      }

      // Fetch supplier breakdown
      const supplierRes = await fetch(`${API_BASE_URL}/energy-renewals/supplier-breakdown${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (supplierRes.ok) {
        const supplierBreakdown = await supplierRes.json();
        console.log(`✅ Supplier Breakdown: ${supplierBreakdown.length} suppliers`);
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
      const employeeParam = employeeId ? `&employee_id=${employeeId}` : '';

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

  const fetchPeriodBreakdown = async (period: string) => {
    setModalLoading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const employeeParam = employeeId ? `&employee_id=${employeeId}` : '';

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

  return (
      <div className="space-y-4">
        {/* Top Stats Cards - Make them clickable */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          {/* Renewals Due - 30-60 Days - CLICKABLE */}
          <Card 
            className="border-orange-300 bg-orange-50/30 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => fetchPeriodBreakdown('30-60')}
          >
            <CardHeader>
              <CardDescription>Renewals Due (30-60 Days)</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums text-orange-900">
                {stats?.total_renewals_30_60_days || 0}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-300">
                  <AlertTriangle className="h-3 w-3" />
                  Urgent
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium text-orange-800">
                Immediate action required
              </div>
              <div className="text-orange-600 text-xs flex items-center gap-1">
                Click for details <ChevronRight className="h-3 w-3" />
              </div>
            </CardFooter>
          </Card>

          {/* Renewals Due - 61-90 Days - CLICKABLE */}
          <Card 
            className="border-yellow-300 bg-yellow-50/30 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => fetchPeriodBreakdown('61-90')}
          >
            <CardHeader>
              <CardDescription>Renewals Due (61-90 Days)</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums text-yellow-900">
                {stats?.total_renewals_61_90_days || 0}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-700 border-yellow-300">
                  <TrendingUp className="h-3 w-3" />
                  Plan Ahead
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium text-yellow-800">
                Start engagement process
              </div>
              <div className="text-yellow-600 text-xs flex items-center gap-1">
                Click for details <ChevronRight className="h-3 w-3" />
              </div>
            </CardFooter>
          </Card>

          {/* Renewals Due - 90+ Days - CLICKABLE */}
          <Card 
            className="border-blue-300 bg-blue-50/30 cursor-pointer hover:shadow-lg transition-shadow"
            onClick={() => fetchPeriodBreakdown('91-180')}
          >
            <CardHeader>
              <CardDescription>Renewals Due (91-180 Days)</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums text-blue-900">
                {stats?.total_renewals_90_plus_days || 0}
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300">
                  <TrendingUp className="h-3 w-3" />
                  Monitor
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium text-blue-800">
                Early pipeline building
              </div>
              <div className="text-blue-600 text-xs flex items-center gap-1">
                Click for details <ChevronRight className="h-3 w-3" />
              </div>
            </CardFooter>
          </Card>

          {/* Revenue at Risk */}
          <Card className="border-red-300 bg-red-50/30">
            <CardHeader>
              <CardDescription>Revenue at Risk</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums text-red-900">
                £{((stats?.total_revenue_at_risk || 0) / 1000).toFixed(0)}K
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300">
                  <AlertTriangle className="h-3 w-3" />
                  High Priority
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium text-red-800">
                Total contract value expiring
              </div>
              <div className="text-red-600 text-xs">Protect revenue stream</div>
            </CardFooter>
          </Card>

          {/* Total AQ */}
          <Card 
            className={`border-purple-300 bg-purple-50/30 ${userRole === 'Platform Admin' ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
            onClick={() => {
              if (userRole === 'Platform Admin') {
                fetchAQBreakdown();
              }
            }}
          >
            <CardHeader>
              <CardDescription>Total AQ</CardDescription>
              <CardTitle className="text-3xl font-semibold tabular-nums text-purple-900">
                {formatAQ(stats?.total_aq || 0)} kWh
              </CardTitle>
              <CardAction>
                <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300">
                  <Zap className="h-3 w-3" />
                  Energy
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1.5 text-sm">
              <div className="line-clamp-1 flex gap-2 font-medium text-purple-800">
                Total consumption at risk
              </div>
              {userRole === 'Platform Admin' ? (
                <div className="text-purple-600 text-xs flex items-center gap-1">
                  Click for breakdown <ChevronRight className="h-3 w-3" />
                </div>
              ) : (
                <div className="text-purple-600 text-xs">Annual energy usage</div>
              )}
            </CardFooter>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {/* Renewals by Period */}
          <Card>
            <CardHeader>
              <CardTitle>Renewals by Period</CardTitle>
              <CardDescription>Upcoming contract expirations</CardDescription>
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
          <Card>
            <CardHeader>
              <CardTitle>Contact Status</CardTitle>
              <CardDescription>Customer engagement progress</CardDescription>
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
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[var(--chart-2)]"></div>
                <span>Contacted: {stats?.contacted_count || 0}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[var(--chart-3)]"></div>
                <span>Pending: {stats?.not_contacted_count || 0}</span>
              </div>
            </CardFooter>
          </Card>

          {/* Supplier Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle>Top Suppliers</CardTitle>
              <CardDescription>Contracts expiring by supplier</CardDescription>
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
                        <span className="font-medium truncate max-w-[150px]">
                          {supplier.supplier_name}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-muted-foreground">{supplier.renewal_count} contracts</span>
                        <span className="font-semibold">£{(supplier.total_value / 1000).toFixed(0)}K</span>
                      </div>
                    </div>
                    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
        <Card>
          <CardHeader>
            <CardTitle>Renewal Performance</CardTitle>
            <CardDescription>Overall renewal success metrics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="text-center p-4 border rounded-lg bg-green-50">
                <div className="text-3xl font-bold text-green-700">{stats?.renewed_count || 0}</div>
                <div className="text-sm text-green-600 mt-1">Renewed</div>
                <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mt-2" />
              </div>
              <div className="text-center p-4 border rounded-lg bg-blue-50">
                <div className="text-3xl font-bold text-blue-700">{stats?.contacted_count || 0}</div>
                <div className="text-sm text-blue-600 mt-1">In Progress</div>
                <TrendingUp className="h-5 w-5 text-blue-600 mx-auto mt-2" />
              </div>
              <div className="text-center p-4 border rounded-lg bg-orange-50">
                <div className="text-3xl font-bold text-orange-700">{stats?.not_contacted_count || 0}</div>
                <div className="text-sm text-orange-600 mt-1">Not Contacted</div>
                <AlertTriangle className="h-5 w-5 text-orange-600 mx-auto mt-2" />
              </div>
              <div className="text-center p-4 border rounded-lg bg-red-50">
                <div className="text-3xl font-bold text-red-700">{stats?.lost_count || 0}</div>
                <div className="text-sm text-red-600 mt-1">Lost</div>
                <TrendingDown className="h-5 w-5 text-red-600 mx-auto mt-2" />
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <div className="w-full text-center text-sm text-muted-foreground">
              Renewal success rate: <span className="font-semibold text-foreground">{renewalPercentage}%</span>
            </div>
          </CardFooter>
        </Card>
        
        {/* Period Breakdown Modal */}
        <Dialog open={showPeriodModal} onOpenChange={setShowPeriodModal}>
          <DialogContent className="max-w-6xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                Renewals Due: {selectedPeriod === '30-60' ? '30-60 Days' : selectedPeriod === '61-90' ? '61-90 Days' : '91-180 Days'}
              </DialogTitle>
              <DialogDescription>
                Detailed breakdown of {periodBreakdown.length} renewals in this period
              </DialogDescription>
            </DialogHeader>

            {modalLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="space-y-2">
                {periodBreakdown.map((renewal) => (
                  <div
                    key={renewal.client_id}
                    className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/dashboard/renewals/${renewal.client_id}`)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold">{renewal.business_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {renewal.contact_person} · {renewal.phone}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          <span>Supplier: {renewal.supplier_name}</span>
                          <span>MPAN: {renewal.mpan_number}</span>
                          <span>AQ: {renewal.annual_usage?.toLocaleString()} kWh</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-lg">£{renewal.estimated_revenue.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{renewal.days_until_expiry} days</p>
                        <Badge variant="outline" className="mt-1">
                          {renewal.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Sales Performance Modal */}
        <Dialog open={showSalesModal} onOpenChange={setShowSalesModal}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Salesperson Performance - Detailed View</DialogTitle>
              <DialogDescription>
                Monthly performance metrics for all team members
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {salesPerformance.map((sales) => (
                <Card key={sales.employee_id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{sales.employee_name}</CardTitle>
                      <Badge variant="outline">
                        {sales.conversion_rate}% conversion
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <p className="text-2xl font-bold text-blue-700">{sales.total_contacts}</p>
                        <p className="text-sm text-blue-600">Total Contacts</p>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <p className="text-2xl font-bold text-green-700">{sales.converted_count}</p>
                        <p className="text-sm text-green-600">Converted</p>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <p className="text-2xl font-bold text-purple-700">
                          £{(sales.total_value_touched / 1000).toFixed(1)}K
                        </p>
                        <p className="text-sm text-purple-600">Value Touched</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>

        {/* AQ Breakdown Modal */}
        <Dialog open={showAQModal} onOpenChange={setShowAQModal}>
          <DialogContent className="max-w-[98vw] w-[98vw] max-h-[90vh] overflow-y-auto p-6">
            <DialogHeader className="pb-4">
              <DialogTitle className="text-2xl">AQ Breakdown by Salesperson</DialogTitle>
              <DialogDescription className="text-base">
                Total annual quantity (AQ) split across sales team
              </DialogDescription>
            </DialogHeader>

            {aqModalLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
              </div>
            ) : aqBreakdown ? (
              <div className="space-y-6">
                {/* Summary Cards */}
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
                      <CardDescription className="text-sm">Salespeople</CardDescription>
                      <CardTitle className="text-3xl text-orange-900">
                        {aqBreakdown.salesperson_count}
                      </CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                {/* Breakdown Table - NO FIXED WIDTHS */}
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
              </div>
            ) : (
              <p className="text-center py-8 text-gray-500">No data available</p>
            )}
          </DialogContent>
        </Dialog>
      </div>  
    );
  }
