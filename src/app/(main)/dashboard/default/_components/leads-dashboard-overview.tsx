"use client";

import { useState, useEffect } from "react";
import { TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Zap, Users, ChevronRight, Clock, Sparkles } from "lucide-react";
import { Bar, BarChart, XAxis, Cell, Pie, PieChart, LabelList } from "recharts";
import { useRouter } from "next/navigation";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
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

interface LeadStats {
  total_leads: number;
  active_leads: number;
  converted_leads: number;
  new_leads: number;
  in_progress: number;
  lost_leads: number;
  conversion_rate: number;
  total_value: number;
  recent_leads_30d: number;
  allocated_leads: number;
  unallocated_leads: number;
  stage_breakdown: { [key: string]: number };
}

interface StageBreakdown {
  stage_id: number;
  stage_name: string;
  count: number;
  total_value: number;
}

interface SalespersonBreakdown {
  employee_id: number;
  employee_name: string;
  total_leads: number;
  converted_count: number;
  in_progress_count: number;
  not_contacted_count: number;
  lost_count: number;
  conversion_rate: number;
  total_value: number;
}

interface LeadDetail {
  opportunity_id: number;
  business_name: string;
  contact_person: string;
  tel_number: string;
  email: string;
  stage_name: string;
  opportunity_value: number;
  assigned_to_name: string;
  created_at: string;
  annual_usage: number;
  service_name: string;
}

interface LeadsOverviewProps {
  userRole?: string;
  employeeId?: number;
}

const stageColors = [
  "var(--chart-1)",
  "var(--chart-2)", 
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const chartConfig = {
  leads: {
    label: "Leads",
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

export function LeadsOverview({ userRole, employeeId }: LeadsOverviewProps = {}) {
  const router = useRouter();
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [stageData, setStageData] = useState<StageBreakdown[]>([]);
  const [salesData, setSalesData] = useState<SalespersonBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [modalEmployeeFilter, setModalEmployeeFilter] = useState<number | undefined>(undefined);
  
  // Modal states
  const [showStageModal, setShowStageModal] = useState(false);
  const [showSalesModal, setShowSalesModal] = useState(false);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [stageLeads, setStageLeads] = useState<LeadDetail[]>([]);
  const [selectedStage, setSelectedStage] = useState<string>("");
  const [modalLoading, setModalLoading] = useState(false);

  const isAdmin = employeeId === undefined || employeeId === null;

  useEffect(() => {
    console.log("\n" + "=".repeat(80));
    console.log("🎯 LEADS OVERVIEW - INITIALIZATION");
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

  useEffect(() => {
    fetchLeadStats();
    if (isAdmin) {
      loadEmployees();
    }
  }, [isAdmin, employeeId]);

  const fetchLeadStats = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");

      const employeeParam = !isAdmin && employeeId ? `?employee_id=${employeeId}` : '';

      console.log("\n" + "=".repeat(80));
      console.log("📊 FETCHING LEAD STATS");
      console.log("=".repeat(80));
      console.log("Request details:");
      console.log("  - isAdmin:", isAdmin);
      console.log("  - employeeId:", employeeId);
      console.log("  - URL:", `${API_BASE_URL}/api/crm/leads/stats${employeeParam}`);
      console.log("=".repeat(80) + "\n");

      const statsRes = await fetch(`${API_BASE_URL}/api/crm/leads/stats${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (statsRes.ok) {
        const statsData = await statsRes.json();
        console.log("✅ Stats received:", statsData);
        setStats(statsData);
      } else {
        console.error("❌ Stats API failed:", await statsRes.text());
      }

      const stageRes = await fetch(`${API_BASE_URL}/api/crm/leads/stage-breakdown${employeeParam}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (stageRes.ok) {
        const stageBreakdown = await stageRes.json();
        console.log("✅ Stage breakdown received:", stageBreakdown.length, "stages");
        setStageData(stageBreakdown);
      }

      if (isAdmin) {
        const salesRes = await fetch(`${API_BASE_URL}/api/crm/leads/salesperson-breakdown`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (salesRes.ok) {
          const salesBreakdown = await salesRes.json();
          console.log("✅ Salesperson breakdown received:", salesBreakdown.length, "salespeople");
          setSalesData(salesBreakdown);
        }
      }
    } catch (error) {
      console.error("❌ Error fetching lead stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStageLeads = async (stageName: string, employeeOverride?: number | undefined | null) => {
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
        `${API_BASE_URL}/api/crm/leads/by-stage?stage=${encodeURIComponent(stageName)}${employeeParam}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.ok) {
        const data = await res.json();
        setStageLeads(data.leads || []);
        setSelectedStage(stageName);
        setShowStageModal(true);
      }
    } catch (error) {
      console.error("Error fetching stage leads:", error);
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

  const contactStatus = [
    { status: "Contacted", count: stats?.in_progress || 0, fill: "var(--chart-2)" },
    { status: "Not Contacted", count: stats?.new_leads || 0, fill: "var(--chart-3)" },
  ];

  const conversionPercentage = stats?.conversion_rate?.toFixed(1) || "0";

  const formatVolume = (vol: number) => {
    if (vol >= 1000000) {
      return `${(vol / 1000000).toFixed(1)}M`;
    } else if (vol >= 1000) {
      return `${(vol / 1000).toFixed(0)}K`;
    }
    return vol.toString();
  };

  return (
    <div className="space-y-4">
      
      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {/* Total Pipeline */}
        <Card 
          className="border-violet-300 bg-violet-50/30 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchStageLeads('all')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm">Active Pipeline</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-violet-900">
              {stats?.total_leads || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-violet-100 text-violet-700 border-violet-300 whitespace-nowrap">
              <Users className="h-3 w-3" />
              Pipeline
            </Badge>
            <div className="line-clamp-1 font-medium text-violet-800">
              {isAdmin ? "Total active leads" : "Your active leads"}
            </div>
            <div className="text-violet-600 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* New Leads */}
        <Card 
          className="border-blue-300 bg-blue-50/30 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchStageLeads('new')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm">New / Not Contacted</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-blue-900">
              {stats?.new_leads || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-300 whitespace-nowrap">
              <Sparkles className="h-3 w-3" />
              Fresh
            </Badge>
            <div className="line-clamp-1 font-medium text-blue-800">
              Needs first contact
            </div>
            <div className="text-blue-600 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* In Progress */}
        <Card 
          className="border-amber-300 bg-amber-50/30 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchStageLeads('in_progress')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm">In Progress</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-amber-900">
              {stats?.in_progress || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-300 whitespace-nowrap">
              <Clock className="h-3 w-3" />
              Active
            </Badge>
            <div className="line-clamp-1 font-medium text-amber-800">
              Being worked on
            </div>
            <div className="text-amber-600 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* Converted */}
        <Card 
          className="border-green-300 bg-green-50/30 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchStageLeads('converted')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm">Converted</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-green-900">
              {stats?.converted_leads || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300 whitespace-nowrap">
              <CheckCircle2 className="h-3 w-3" />
              Won
            </Badge>
            <div className="line-clamp-1 font-medium text-green-800">
              Successfully converted
            </div>
            <div className="text-green-600 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>

        {/* Total Value */}
        <Card 
          className="border-purple-300 bg-purple-50/30 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => setShowVolumeModal(true)}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm">
              {isAdmin ? "Total Pipeline Value" : "Your Pipeline Value"}
            </CardDescription>
            <CardTitle className="text-xl font-semibold tabular-nums text-purple-900 break-all leading-tight">
              £{(stats?.total_value || 0).toLocaleString('en-GB', { 
                minimumFractionDigits: 0, 
                maximumFractionDigits: 0 
              })}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-purple-100 text-purple-700 border-purple-300 whitespace-nowrap">
              <Zap className="h-3 w-3" />
              Value
            </Badge>
            <div className="line-clamp-1 font-medium text-purple-800">
              {isAdmin ? "Total opportunity value" : "Your opportunity value"}
            </div>
            {isAdmin && (
              <div className="text-purple-600 flex items-center gap-1">
                Click for breakdown <ChevronRight className="h-3 w-3" />
              </div>
            )}
          </CardFooter>
        </Card>

        {/* Lost */}
        <Card 
          className="border-red-300 bg-red-50/30 cursor-pointer hover:shadow-lg transition-shadow overflow-hidden"
          onClick={() => fetchStageLeads('lost')}
        >
          <CardHeader className="pb-2 px-4 pt-4">
            <CardDescription className="text-sm">Lost</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums text-red-900">
              {stats?.lost_leads || 0}
            </CardTitle>
          </CardHeader>
          <CardFooter className="flex-col items-start gap-1.5 text-sm px-4 pb-4 pt-2">
            <Badge variant="outline" className="bg-red-100 text-red-700 border-red-300 whitespace-nowrap">
              <TrendingDown className="h-3 w-3" />
              Lost
            </Badge>
            <div className="line-clamp-1 font-medium text-red-800">
              Lost opportunities
            </div>
            <div className="text-red-600 flex items-center gap-1">
              Click for details <ChevronRight className="h-3 w-3" />
            </div>
          </CardFooter>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Leads by Stage */}
        <Card>
          <CardHeader>
            <CardTitle>Leads by Stage</CardTitle>
            <CardDescription>
              {isAdmin ? "Pipeline distribution" : "Your pipeline stages"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64">
            <ChartContainer config={chartConfig} className="h-full w-full">
              <BarChart data={stageData.slice(0, 8)} margin={{ left: 0, right: 0, top: 20, bottom: 20 }}>
                <XAxis 
                  dataKey="stage_name" 
                  tickLine={false} 
                  axisLine={false} 
                  tickMargin={8}
                  tick={{ fontSize: 10 }}
                  interval={0}
                />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="count" fill="var(--color-leads)" radius={[8, 8, 0, 0]}>
                  {stageData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={stageColors[index % stageColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* Contact Status */}
        <Card>
          <CardHeader>
            <CardTitle>Contact Status</CardTitle>
            <CardDescription>
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
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[var(--chart-2)]"></div>
              <span>Contacted: {stats?.in_progress || 0}</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full bg-[var(--chart-3)]"></div>
              <span>Pending: {stats?.new_leads || 0}</span>
            </div>
          </CardFooter>
        </Card>

        {/* Salesperson Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Top Salespeople</CardTitle>
            <CardDescription>
              {isAdmin ? "Leads by salesperson" : "Your lead distribution"}
            </CardDescription>
          </CardHeader>
          <CardContent className="h-64 overflow-y-auto">
            <div className="space-y-3">
              {salesData.slice(0, 6).map((person, index) => (
                <div key={person.employee_id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: stageColors[index % stageColors.length] }}
                      />
                      <span className="font-medium truncate max-w-[150px]">
                        {person.employee_name}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">{person.total_leads} leads</span>
                      <span className="font-semibold">£{(person.total_value / 1000).toFixed(0)}K</span>
                    </div>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${(person.total_leads / (stats?.total_leads || 1)) * 100}%`,
                        backgroundColor: stageColors[index % stageColors.length],
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
          <CardTitle>Lead Performance</CardTitle>
          <CardDescription>
            {isAdmin ? "Overall lead success metrics" : "Your lead success metrics"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg bg-green-50">
              <div className="text-3xl font-bold text-green-700">{stats?.converted_leads || 0}</div>
              <div className="text-sm text-green-600 mt-1">Converted</div>
              <CheckCircle2 className="h-5 w-5 text-green-600 mx-auto mt-2" />
            </div>
            <div className="text-center p-4 border rounded-lg bg-blue-50">
              <div className="text-3xl font-bold text-blue-700">{stats?.in_progress || 0}</div>
              <div className="text-sm text-blue-600 mt-1">In Progress</div>
              <TrendingUp className="h-5 w-5 text-blue-600 mx-auto mt-2" />
            </div>
            <div className="text-center p-4 border rounded-lg bg-orange-50">
              <div className="text-3xl font-bold text-orange-700">{stats?.new_leads || 0}</div>
              <div className="text-sm text-orange-600 mt-1">Not Contacted</div>
              <AlertTriangle className="h-5 w-5 text-orange-600 mx-auto mt-2" />
            </div>
            <div className="text-center p-4 border rounded-lg bg-red-50">
              <div className="text-3xl font-bold text-red-700">{stats?.lost_leads || 0}</div>
              <div className="text-sm text-red-600 mt-1">Lost</div>
              <TrendingDown className="h-5 w-5 text-red-600 mx-auto mt-2" />
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <div className="w-full text-center text-sm text-muted-foreground">
            Conversion rate: <span className="font-semibold text-foreground">{conversionPercentage}%</span>
          </div>
        </CardFooter>
      </Card>

      {/* Stage Leads Modal */}
      <Dialog open={showStageModal} onOpenChange={(open) => {
        setShowStageModal(open);
        if (!open && isAdmin) {
          setModalEmployeeFilter(undefined);
        }
      }}>
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b flex-shrink-0">
            <div className="flex items-start justify-between gap-6">
              <div className="flex-1 min-w-0">
                <DialogTitle className="text-2xl font-bold mb-2">
                  {selectedStage === 'all' ? 'All Leads' :
                  selectedStage === 'new' ? 'New / Not Contacted Leads' :
                  selectedStage === 'in_progress' ? 'In Progress Leads' : 
                  selectedStage === 'converted' ? 'Converted Leads' : 
                  selectedStage === 'lost' ? 'Lost Leads' :
                  `Leads in ${selectedStage}`}
                </DialogTitle>
                <DialogDescription className="text-sm">
                  Showing {stageLeads.length} lead{stageLeads.length !== 1 ? 's' : ''} in this category
                </DialogDescription>
              </div>
              
              {isAdmin && (
                <Select
                  value={modalEmployeeFilter?.toString() || "all"}
                  onValueChange={(value) => {
                    const newEmployeeId = value === "all" ? undefined : parseInt(value);
                    setModalEmployeeFilter(newEmployeeId);
                    fetchStageLeads(selectedStage, newEmployeeId);
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
            ) : stageLeads.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">No leads found for this category</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {stageLeads.map((lead) => (
                  <div
                    key={lead.opportunity_id}
                    className="p-5 border rounded-xl hover:bg-gray-50 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => router.push(`/dashboard/leads/${lead.opportunity_id}`)}
                  >
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 truncate">{lead.business_name}</h3>
                          <Badge variant="outline" className="text-xs flex-shrink-0">
                            {lead.stage_name}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 truncate">
                          {lead.contact_person} · {lead.tel_number}
                        </p>
                      </div>
                      
                      <div className="text-right flex-shrink-0">
                        <p className="text-xl font-bold text-blue-700 whitespace-nowrap">
                          £{(lead.opportunity_value || 0).toLocaleString()}
                        </p>
                        <p className="text-xs text-gray-600 mt-1 whitespace-nowrap">
                          {lead.service_name || 'Energy'}
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-5 gap-4 pt-3 border-t border-gray-100">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">Email</p>
                        <p className="font-semibold text-sm text-gray-900 truncate">{lead.email || 'N/A'}</p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">Annual Usage</p>
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {lead.annual_usage ? `${lead.annual_usage.toLocaleString()} kWh` : 'N/A'}
                        </p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">Value</p>
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          £{(lead.opportunity_value || 0).toLocaleString()}
                        </p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">Created</p>
                        <p className="font-semibold text-sm text-gray-900 truncate">
                          {lead.created_at ? new Date(lead.created_at).toLocaleDateString('en-GB') : 'N/A'}
                        </p>
                      </div>
                      
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">Assigned To</p>
                        <p className="font-semibold text-sm text-purple-700 flex items-center gap-1 truncate">
                          <Users className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{lead.assigned_to_name || 'Unassigned'}</span>
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

      {/* Value Breakdown Modal */}
      <Dialog open={showVolumeModal} onOpenChange={setShowVolumeModal}>
        <DialogContent className="max-w-[98vw] w-[98vw] max-h-[90vh] overflow-y-auto p-6">
          <DialogHeader className="pb-4">
            <DialogTitle className="text-2xl">
              {isAdmin ? "Pipeline Value by Salesperson" : "Your Pipeline Value"}
            </DialogTitle>
            <DialogDescription className="text-base">
              {isAdmin 
                ? "Total opportunity value split across sales team"
                : "Your total opportunity value"}
            </DialogDescription>
          </DialogHeader>

          {isAdmin ? (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-purple-50">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-sm">Total Pipeline Value</CardDescription>
                    <CardTitle className="text-3xl text-purple-900">
                      £{((stats?.total_value || 0) / 1000).toFixed(1)}K
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-green-50">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-sm">Total Leads</CardDescription>
                    <CardTitle className="text-3xl text-green-900">
                      {stats?.total_leads || 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
                <Card className="bg-blue-50">
                  <CardHeader className="pb-3">
                    <CardDescription className="text-sm">Avg Value/Lead</CardDescription>
                    <CardTitle className="text-3xl text-blue-900">
                      £{stats?.total_leads ? Math.round((stats.total_value || 0) / stats.total_leads) : 0}
                    </CardTitle>
                  </CardHeader>
                </Card>
              </div>

              <div className="rounded-lg border bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        <th className="px-6 py-4 text-left text-sm font-semibold whitespace-nowrap">Salesperson</th>
                        <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap">Total Leads</th>
                        <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap">Total Value (£)</th>
                        <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap">Conversion Rate</th>
                        <th className="px-6 py-4 text-right text-sm font-semibold whitespace-nowrap">% of Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {salesData.map((sales) => {
                        const valuePercentage = ((sales.total_value / (stats?.total_value || 1)) * 100).toFixed(1);
                        
                        return (
                          <tr key={sales.employee_id} className="hover:bg-gray-50">
                            <td className="px-6 py-5 whitespace-nowrap">
                              <div className="flex items-center gap-3">
                                <Users className="h-5 w-5 text-purple-600 flex-shrink-0" />
                                <span className="font-medium text-base">{sales.employee_name}</span>
                              </div>
                            </td>
                            <td className="px-6 py-5 text-right text-base whitespace-nowrap">
                              {sales.total_leads}
                            </td>
                            <td className="px-6 py-5 text-right font-semibold text-lg text-purple-900 whitespace-nowrap">
                              £{(sales.total_value / 1000).toFixed(1)}K
                            </td>
                            <td className="px-6 py-5 text-right text-base text-gray-700 whitespace-nowrap">
                              {sales.conversion_rate}%
                            </td>
                            <td className="px-6 py-5 text-right whitespace-nowrap">
                              <div className="flex items-center justify-end gap-4">
                                <div className="w-40 h-4 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
                                  <div
                                    className="h-full bg-purple-600 rounded-full transition-all"
                                    style={{ width: `${valuePercentage}%` }}
                                  />
                                </div>
                                <span className="text-base font-semibold w-16 text-right">{valuePercentage}%</span>
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
            <div className="text-center py-8">
              <p className="text-4xl font-bold text-purple-900">
                £{(stats?.total_value || 0).toLocaleString()}
              </p>
              <p className="text-gray-600 mt-2">Your total pipeline value</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}