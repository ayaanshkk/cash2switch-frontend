"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Zap } from "lucide-react";
import { Bar, BarChart, XAxis, Cell, Pie, PieChart, LabelList } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { formatCurrency, cn } from "@/lib/utils";

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

interface EnergyRenewalsOverviewProps {
  userRole?: string;
  employeeId?: number;
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
  const [stats, setStats] = useState<RenewalStats | null>(null);
  const [supplierData, setSupplierData] = useState<SupplierBreakdown[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRenewalStats();
  }, []);

  const fetchRenewalStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");

      // ✅ Add employee filter for salespeople
      const employeeParam = employeeId ? `?employee_id=${employeeId}` : '';

      // Fetch renewal statistics
      const statsRes = await fetch(`${API_BASE_URL}/energy-renewals/stats${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setStats(statsData);
      }

      // Fetch supplier breakdown
      const supplierRes = await fetch(`${API_BASE_URL}/energy-renewals/supplier-breakdown${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (supplierRes.ok) {
        const supplierBreakdown = await supplierRes.json();
        setSupplierData(supplierBreakdown);
      }
    } catch (error) {
      console.error("Error fetching renewal stats:", error);
    } finally {
      setLoading(false);
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
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {/* Renewals Due - 30-60 Days */}
        <Card className="border-orange-300 bg-orange-50/30">
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
            <div className="text-orange-600 text-xs">Contact customers now</div>
          </CardFooter>
        </Card>

        {/* Renewals Due - 61-90 Days */}
        <Card className="border-yellow-300 bg-yellow-50/30">
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
            <div className="text-yellow-600 text-xs">Schedule follow-up calls</div>
          </CardFooter>
        </Card>

        {/* Renewals Due - 90+ Days */}
        <Card className="border-blue-300 bg-blue-50/30">
          <CardHeader>
            <CardDescription>Renewals Due (90+ Days)</CardDescription>
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
            <div className="text-blue-600 text-xs">Initial contact preparation</div>
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
        <Card className="border-purple-300 bg-purple-50/30">
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
            <div className="text-purple-600 text-xs">Annual energy usage</div>
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
    </div>
  );
}