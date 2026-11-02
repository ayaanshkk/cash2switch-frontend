"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Search, Loader2, X, Users, TrendingUp, TrendingDown, CheckCircle2, ArrowRight, FileDown, BarChart2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { fetchWithAuth } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const CRM_PROXY = `${API_BASE_URL}/api/crm`;

const PIPELINE_STATUSES = [
  "Not Called",
  "No Contact",
  "Callback",
  "Not Answered",
  "Priced",
  "Sold",
  "Won",
  "Lost",
];

const IN_PROGRESS_STATUSES = ["Not Called", "No Contact", "Callback", "Not Answered", "Priced"];

const STATUS_COLOURS: Record<string, string> = {
  "Not Called":   "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  "No Contact":   "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-200",
  "Callback":     "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  "Not Answered": "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
  "Priced":       "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  "Sold":         "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  "Won":          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  "Lost":         "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

const LEAD_STATUS_BADGE: Record<string, string> = {
  "Not Called":   "bg-slate-100 text-slate-700",
  "Callback":     "bg-blue-100 text-blue-700",
  "No Contact":   "bg-gray-100 text-gray-600",
  "Not Answered": "bg-yellow-100 text-yellow-700",
  "Priced":       "bg-purple-100 text-purple-700",
  "Sold":         "bg-green-100 text-green-700",
  "Won":          "bg-emerald-100 text-emerald-700",
  "Lost":         "bg-red-100 text-red-700",
  "Dead":         "bg-zinc-200 text-zinc-600",
};

interface EmployeeRow {
  employee_id: number;
  employee_name: string;
  statuses: Record<string, number>;
  total: number;
}

interface Allocator {
  employee_id: number;
  employee_name: string;
  count: number;
}

interface Summary {
  total_allocated: number;
  sold_won: number;
  in_progress: number;
  lost: number;
}

interface PipelineLead {
  opportunity_id: number;
  business_name?: string;
  contact_person?: string;
  stage_name?: string;
  assigned_to_name?: string;
  created_at?: string;
  annual_usage?: number;
  supplier_name?: string;
}

interface DrilldownState {
  employee_id: number;
  employee_name: string;
  status: string | null;
}

export default function LeadsGeneratorPage() {
  const [service, setService] = useState("utilities");
  const [search, setSearch] = useState("");
  const [matrix, setMatrix] = useState<EmployeeRow[]>([]);
  const [statusTotals, setStatusTotals] = useState<Record<string, number>>({});
  const [summary, setSummary] = useState<Summary>({ total_allocated: 0, sold_won: 0, in_progress: 0, lost: 0 });
  const [allocators, setAllocators] = useState<Allocator[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [drilldown, setDrilldown] = useState<DrilldownState | null>(null);
  const [drillLeads, setDrillLeads] = useState<PipelineLead[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);
  const [drillSearch, setDrillSearch] = useState("");

  // Report modal
  const [reportOpen, setReportOpen] = useState(false);
  const [reportEmployeeId, setReportEmployeeId] = useState<string>("");
  const [reportData, setReportData] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportDownloading, setReportDownloading] = useState(false);

  const fetchMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`${CRM_PROXY}/leads/allocation-pipeline?service=${service}`);
      setMatrix(data.matrix || []);
      setStatusTotals(data.status_totals || {});
      setSummary(data.summary || { total_allocated: 0, sold_won: 0, in_progress: 0, lost: 0 });
      setAllocators(data.allocators || []);
    } catch (e: any) {
      setError(e.message || "Failed to load allocation pipeline");
    } finally {
      setLoading(false);
    }
  }, [service]);

  useEffect(() => { fetchMatrix(); }, [fetchMatrix]);

  useEffect(() => {
    if (!drilldown) return;
    const load = async () => {
      setDrillLoading(true);
      setDrillLeads([]);
      setDrillSearch("");
      try {
        const params = new URLSearchParams({
          service,
          salesperson_id: String(drilldown.employee_id),
          allocated: "true",
          per_page: "500",
        });
        if (drilldown.status) params.set("status", drilldown.status);
        const data = await fetchWithAuth(`${CRM_PROXY}/leads?${params}`);
        setDrillLeads(data.data || data.leads || []);
      } catch {
        setDrillLeads([]);
      } finally {
        setDrillLoading(false);
      }
    };
    load();
  }, [drilldown, service]);

  const filteredMatrix = matrix.filter(row =>
    !search || row.employee_name.toLowerCase().includes(search.toLowerCase())
  );

  const visibleTotal = PIPELINE_STATUSES.reduce((a, s) => a + (statusTotals[s] || 0), 0);

  const fetchReport = async (empId: string) => {
    if (!empId) return;
    setReportLoading(true);
    setReportData(null);
    try {
      const data = await fetchWithAuth(`${CRM_PROXY}/leads/agent-report?service=${service}&employee_id=${empId}`);
      setReportData(data);
    } catch (e: any) {
      setReportData(null);
    } finally {
      setReportLoading(false);
    }
  };

  const downloadReport = async (fmt: "csv" | "pdf") => {
    if (!reportEmployeeId) return;
    setReportDownloading(true);
    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(
        `${CRM_PROXY}/leads/agent-report/download?service=${service}&employee_id=${reportEmployeeId}&format=${fmt}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const name = reportData?.employee_name?.replace(/\s+/g, "_") || "Agent";
      a.download = `Lead_Report_${name}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setReportDownloading(false);
    }
  };

  const filteredDrillLeads = drillLeads.filter(l => {
    if (!drillSearch) return true;
    const q = drillSearch.toLowerCase();
    return (
      (l.business_name || "").toLowerCase().includes(q) ||
      (l.contact_person || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col gap-8 p-8 max-w-[1600px]">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Allocated Leads Pipeline</h1>
          <p className="text-sm text-gray-500 dark:text-slate-400 mt-0.5">
            Track leads allocated to salespeople — where they came from and what&apos;s happened
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={service} onValueChange={setService}>
            <SelectTrigger className="w-40 h-10">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="utilities">Electricity</SelectItem>
              <SelectItem value="water">Water</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={fetchMatrix} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Refresh"}
          </Button>
          <Button
            size="sm"
            className="bg-black hover:bg-gray-900 text-white gap-1.5"
            onClick={() => { setReportOpen(true); setReportData(null); setReportEmployeeId(""); }}
          >
            <BarChart2 className="h-4 w-4" />
            Agent Report
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      {!loading && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="rounded-2xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-6 py-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Users className="h-4 w-4 text-blue-500" />
              <span className="text-xs font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">Total Allocated</span>
            </div>
            <div className="text-3xl font-bold text-gray-900 dark:text-white">{summary.total_allocated.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50/50 dark:bg-emerald-950/20 px-6 py-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span className="text-xs font-medium text-emerald-700 dark:text-emerald-400 uppercase tracking-wide">Sold / Won</span>
            </div>
            <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">{summary.sold_won.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-blue-200 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/20 px-6 py-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-400 uppercase tracking-wide">In Progress</span>
            </div>
            <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">{summary.in_progress.toLocaleString()}</div>
          </div>
          <div className="rounded-2xl border border-red-200 dark:border-red-800/50 bg-red-50/50 dark:bg-red-950/20 px-6 py-5 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="h-4 w-4 text-red-500" />
              <span className="text-xs font-medium text-red-700 dark:text-red-400 uppercase tracking-wide">Lost</span>
            </div>
            <div className="text-3xl font-bold text-red-600 dark:text-red-400">{summary.lost.toLocaleString()}</div>
          </div>
        </div>
      )}

      {/* Allocator(s) info bar */}
      {allocators.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/60 px-5 py-3 text-sm">
          <span className="font-medium text-gray-600 dark:text-slate-300">Allocated by:</span>
          {allocators.map(a => (
            <span key={a.employee_id} className="inline-flex items-center gap-1.5 rounded-full bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 px-3 py-1 text-gray-800 dark:text-slate-200 shadow-sm">
              <ArrowRight className="h-3 w-3 text-blue-500" />
              <span className="font-semibold">{a.employee_name}</span>
              <span className="text-gray-400 dark:text-slate-400">({a.count.toLocaleString()} leads)</span>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search salesperson..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10 h-10 rounded-xl"
          />
        </div>
        <span className="text-sm font-medium text-gray-500 dark:text-slate-400">
          {filteredMatrix.length} salesperson{filteredMatrix.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Matrix table */}
      {loading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading pipeline...
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-500">{error}</div>
      ) : filteredMatrix.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-slate-500">
          <Users className="h-10 w-10 mb-3 opacity-40" />
          <p className="text-sm">No allocated leads found</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-700 shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-slate-800/60 border-b border-gray-200 dark:border-slate-700">
                <th className="text-left px-6 py-5 font-semibold text-gray-700 dark:text-slate-300 w-56 min-w-[180px]">
                  Salesperson
                </th>
                <th className="text-center px-4 py-5 font-semibold text-gray-700 dark:text-slate-300 min-w-[120px]">
                  Total Assigned
                </th>
                <th className="text-center px-4 py-5 font-semibold text-gray-700 dark:text-slate-300 min-w-[120px]">
                  <span className="text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                    In Progress
                  </span>
                </th>
                {PIPELINE_STATUSES.map(s => (
                  <th key={s} className="text-center px-4 py-5 font-semibold text-gray-700 dark:text-slate-300 min-w-[110px]">
                    <span className={`text-xs px-2.5 py-1 rounded-full ${STATUS_COLOURS[s] || "bg-gray-100 text-gray-600"}`}>
                      {s}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredMatrix.map((row, idx) => (
                <tr
                  key={row.employee_id}
                  className={`border-b border-gray-100 dark:border-slate-700/50 hover:bg-blue-50/40 dark:hover:bg-slate-800/30 transition-colors ${
                    idx % 2 === 0 ? "" : "bg-gray-50/50 dark:bg-slate-800/20"
                  }`}
                >
                  <td className="px-6 py-5">
                    <button
                      onClick={() => setDrilldown({ employee_id: row.employee_id, employee_name: row.employee_name, status: null })}
                      className="font-medium text-blue-600 dark:text-blue-400 hover:underline text-left"
                    >
                      {row.employee_name}
                    </button>
                  </td>

                  {/* Total Assigned — all allocated leads for this person across all statuses */}
                  <td className="text-center px-4 py-5">
                    <button
                      onClick={() => setDrilldown({ employee_id: row.employee_id, employee_name: row.employee_name, status: null })}
                      className="font-bold text-gray-900 dark:text-white hover:text-blue-600 dark:hover:text-blue-400 tabular-nums transition-colors text-base"
                    >
                      {row.total.toLocaleString()}
                    </button>
                  </td>

                  {/* In Progress — active statuses only */}
                  <td className="text-center px-4 py-5">
                    {(() => {
                      const count = IN_PROGRESS_STATUSES.reduce((sum, s) => sum + (row.statuses[s] || 0), 0);
                      return count > 0 ? (
                        <span className="font-semibold text-blue-700 dark:text-blue-400 tabular-nums text-base">
                          {count.toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-gray-300 dark:text-slate-600">—</span>
                      );
                    })()}
                  </td>

                  {/* Status cells */}
                  {PIPELINE_STATUSES.map(s => {
                    const count = row.statuses[s] || 0;
                    return (
                      <td key={s} className="text-center px-4 py-5">
                        {count > 0 ? (
                          <button
                            onClick={() => setDrilldown({ employee_id: row.employee_id, employee_name: row.employee_name, status: s })}
                            className="font-semibold text-gray-800 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 tabular-nums transition-colors text-base"
                          >
                            {count.toLocaleString()}
                          </button>
                        ) : (
                          <span className="text-gray-300 dark:text-slate-600">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Totals footer */}
              <tr className="bg-gray-100 dark:bg-slate-800 border-t-2 border-gray-300 dark:border-slate-600 font-bold">
                <td className="px-6 py-4 text-gray-700 dark:text-slate-300">Totals</td>
                <td className="text-center px-4 py-4 text-gray-900 dark:text-white tabular-nums text-base">
                  {matrix.reduce((sum, row) => sum + row.total, 0).toLocaleString()}
                </td>
                <td className="text-center px-4 py-4 text-blue-700 dark:text-blue-400 tabular-nums text-base">
                  {matrix.reduce((sum, row) => sum + IN_PROGRESS_STATUSES.reduce((s2, st) => s2 + (row.statuses[st] || 0), 0), 0).toLocaleString()}
                </td>
                {PIPELINE_STATUSES.map(s => (
                  <td key={s} className="text-center px-4 py-4 text-gray-800 dark:text-slate-200 tabular-nums text-base">
                    {(statusTotals[s] || 0) > 0
                      ? (statusTotals[s] || 0).toLocaleString()
                      : <span className="font-normal text-gray-300 dark:text-slate-600">—</span>
                    }
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Drilldown dialog */}
      <Dialog open={!!drilldown} onOpenChange={open => { if (!open) setDrilldown(null); }}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-blue-500" />
              {drilldown?.employee_name}
              {drilldown?.status && (
                <Badge className={`ml-1 ${LEAD_STATUS_BADGE[drilldown.status] || "bg-gray-100 text-gray-600"}`}>
                  {drilldown.status}
                </Badge>
              )}
            </DialogTitle>
          </DialogHeader>

          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search leads..."
              value={drillSearch}
              onChange={e => setDrillSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
            {drillSearch && (
              <button onClick={() => setDrillSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto min-h-0">
            {drillLoading ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Loading...
              </div>
            ) : filteredDrillLeads.length === 0 ? (
              <div className="py-12 text-center text-gray-400 text-sm">No leads found</div>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-700">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Business</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Contact</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Status</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Supplier</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-600 dark:text-slate-300">Annual Usage</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDrillLeads.map(lead => (
                    <tr key={lead.opportunity_id} className="border-b border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/40">
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-slate-100">
                        {lead.business_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                        {lead.contact_person || "—"}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STATUS_BADGE[lead.stage_name || ""] || "bg-gray-100 text-gray-600"}`}>
                          {lead.stage_name || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">
                        {lead.supplier_name || "—"}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-700 dark:text-slate-300">
                        {lead.annual_usage ? Number(lead.annual_usage).toLocaleString() : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="pt-3 border-t border-gray-200 dark:border-slate-700 text-xs text-gray-400 dark:text-slate-500">
            {filteredDrillLeads.length} lead{filteredDrillLeads.length !== 1 ? "s" : ""}
            {drillSearch ? ` matching "${drillSearch}"` : ""}
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Agent Report Modal ── */}
      <Dialog open={reportOpen} onOpenChange={open => { setReportOpen(open); if (!open) { setReportData(null); setReportEmployeeId(""); } }}>
        <DialogContent className="!w-[95vw] !max-w-[1400px] max-h-[92vh] flex flex-col overflow-hidden p-0">
          {/* Header bar */}
          <div className="flex items-center justify-between px-6 pr-14 pt-5 pb-4 border-b border-gray-200 dark:border-slate-700 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg font-semibold">
              <BarChart2 className="h-5 w-5 text-black" />
              Agent Lead Report
            </DialogTitle>
            <div className="flex items-center gap-3">
              <Select
                value={reportEmployeeId}
                onValueChange={id => { setReportEmployeeId(id); fetchReport(id); }}
              >
                <SelectTrigger className="w-72 h-9">
                  <SelectValue placeholder="Choose a salesperson…" />
                </SelectTrigger>
                <SelectContent>
                  {matrix.map(row => (
                    <SelectItem key={row.employee_id} value={String(row.employee_id)}>
                      {row.employee_name} ({row.total.toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {reportData && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button size="sm" className="gap-1.5 bg-black hover:bg-gray-900 text-white" disabled={reportDownloading}>
                      {reportDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      Download Report
                      <ChevronDown className="h-3.5 w-3.5 ml-0.5" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => downloadReport("csv")}>
                      Download CSV
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => downloadReport("pdf")}>
                      Download PDF
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto min-h-0 px-6 py-5">
            {reportLoading && (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <Loader2 className="h-6 w-6 animate-spin mr-2" />
                Loading report…
              </div>
            )}

            {!reportLoading && !reportData && (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 dark:text-slate-500">
                <Users className="h-12 w-12 mb-3 opacity-30" />
                <p className="text-sm">Select an agent above to view their report</p>
              </div>
            )}

            {!reportLoading && reportData && (() => {
              const s = reportData.summary ?? {};
              const total: number = s.total_assigned ?? 0;
              const soldWon: number = s.sold_won ?? 0;
              const inProgress: number = s.in_progress ?? 0;
              const lost: number = s.lost ?? 0;
              const convRate: number = s.conversion_rate ?? 0;

              // Derived progress metrics
              const notCalled: number = reportData.status_breakdown?.["Not Called"] ?? 0;
              const contacted: number = total - notCalled;
              const callCoverage: number = total > 0 ? Math.round((contacted / total) * 100) : 0;

              // Targets: 10% conversion, 80% call coverage
              const TARGET_CONV = 10;
              const TARGET_CALL = 80;
              const convNeededForTarget = Math.max(0, Math.ceil(total * TARGET_CONV / 100) - soldWon);
              const callsNeededForTarget = Math.max(0, Math.ceil(total * TARGET_CALL / 100) - contacted);

              // Donut chart data — group minor statuses for readability
              const DONUT_COLOURS: Record<string, string> = {
                "Lead":             "#6366f1",
                "Not Called":       "#94a3b8",
                "Not Answered":     "#f59e0b",
                "Callback":         "#3b82f6",
                "No Contact":       "#64748b",
                "Priced":           "#a855f7",
                "Sold":             "#22c55e",
                "Won":              "#10b981",
                "Lost":             "#ef4444",
                "Converted":        "#14b8a6",
                "Already Renewed":  "#0ea5e9",
                "Email Only":       "#78716c",
                "Broker in Place":  "#f97316",
                "Renewed Directly": "#8b5cf6",
                "End Date Changed": "#84cc16",
              };
              const donutData = Object.entries(reportData.status_breakdown as Record<string, number>)
                .sort(([, a], [, b]) => (b as number) - (a as number))
                .map(([name, value]) => ({ name, value: value as number, fill: DONUT_COLOURS[name] || "#cbd5e1" }));

              return (
                <div className="flex flex-col gap-6">
                  {/* ── Row 1: KPI cards ── */}
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                    {[
                      { label: "Total Assigned",  value: total,          colour: "text-gray-900 dark:text-white",                bg: "bg-gray-50 dark:bg-slate-800/60",       border: "border-gray-200 dark:border-slate-700" },
                      { label: "In Progress",     value: inProgress,     colour: "text-blue-700 dark:text-blue-300",             bg: "bg-blue-50 dark:bg-blue-900/20",        border: "border-blue-200 dark:border-blue-800" },
                      { label: "Sold / Won",      value: soldWon,        colour: "text-emerald-700 dark:text-emerald-300",       bg: "bg-emerald-50 dark:bg-emerald-900/20",  border: "border-emerald-200 dark:border-emerald-800" },
                      { label: "Lost",            value: lost,           colour: "text-red-700 dark:text-red-300",               bg: "bg-red-50 dark:bg-red-900/20",          border: "border-red-200 dark:border-red-800" },
                      { label: "Conversion Rate", value: `${convRate}%`, colour: convRate >= TARGET_CONV ? "text-emerald-700 dark:text-emerald-300" : "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-900/20", border: "border-orange-200 dark:border-orange-800" },
                    ].map(card => (
                      <div key={card.label} className={`rounded-xl p-4 ${card.bg} border ${card.border} flex flex-col gap-1`}>
                        <span className="text-xs text-gray-500 dark:text-slate-400 font-medium">{card.label}</span>
                        <span className={`text-2xl font-bold tabular-nums ${card.colour}`}>
                          {typeof card.value === "number" ? card.value.toLocaleString() : card.value}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* ── Row 2: Donut chart + Progress + Status bars ── */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                    {/* Donut chart */}
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5 flex flex-col">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-3 flex items-center gap-2">
                        <BarChart2 className="h-4 w-4 text-indigo-600" />
                        Lead Distribution
                      </h3>
                      <div className="flex-1 min-h-[220px]">
                        <ResponsiveContainer width="100%" height={220}>
                          <PieChart>
                            <Pie
                              data={donutData}
                              cx="50%"
                              cy="50%"
                              innerRadius={55}
                              outerRadius={85}
                              paddingAngle={2}
                              dataKey="value"
                            >
                              {donutData.map((entry, i) => (
                                <Cell key={i} fill={entry.fill} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: any, name: string) => [`${Number(v).toLocaleString()} leads`, name]}
                              contentStyle={{ fontSize: 12, borderRadius: 8 }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                      </div>
                      {/* Mini legend */}
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1">
                        {donutData.slice(0, 8).map(d => (
                          <div key={d.name} className="flex items-center gap-1.5 min-w-0">
                            <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ background: d.fill }} />
                            <span className="text-[10px] text-gray-600 dark:text-slate-400 truncate">{d.name}</span>
                            <span className="text-[10px] font-semibold text-gray-800 dark:text-slate-200 ml-auto tabular-nums">{d.value.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Progress towards targets */}
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4 text-emerald-600" />
                        Progress Towards Targets
                      </h3>
                      <div className="flex flex-col gap-4">
                        {/* Call coverage bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Call Coverage</span>
                            <span className="text-xs font-semibold tabular-nums">
                              <span className={callCoverage >= TARGET_CALL ? "text-emerald-600" : "text-orange-500"}>{callCoverage}%</span>
                              <span className="text-gray-400 font-normal"> / target {TARGET_CALL}%</span>
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden relative">
                            <div className={`h-full rounded-full ${callCoverage >= TARGET_CALL ? "bg-emerald-500" : "bg-blue-500"}`} style={{ width: `${Math.min(callCoverage, 100)}%` }} />
                            <div className="absolute top-0 bottom-0 w-px bg-gray-400/60" style={{ left: `${TARGET_CALL}%` }} />
                          </div>
                          <div className="flex justify-between mt-1 text-[10px]">
                            <span className="text-gray-400">{contacted.toLocaleString()} contacted of {total.toLocaleString()}</span>
                            {callsNeededForTarget > 0
                              ? <span className="text-orange-500 font-medium">{callsNeededForTarget.toLocaleString()} more to target</span>
                              : <span className="text-emerald-600 font-medium">Target reached ✓</span>}
                          </div>
                        </div>

                        {/* Conversion bar */}
                        <div>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-xs font-medium text-gray-600 dark:text-slate-400">Conversion Rate</span>
                            <span className="text-xs font-semibold tabular-nums">
                              <span className={convRate >= TARGET_CONV ? "text-emerald-600" : "text-orange-500"}>{convRate}%</span>
                              <span className="text-gray-400 font-normal"> / target {TARGET_CONV}%</span>
                            </span>
                          </div>
                          <div className="h-3 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden relative">
                            <div className={`h-full rounded-full ${convRate >= TARGET_CONV ? "bg-emerald-500" : "bg-orange-400"}`} style={{ width: `${Math.min((convRate / TARGET_CONV) * 100, 100)}%` }} />
                            <div className="absolute top-0 bottom-0 w-px bg-gray-400/60" style={{ left: "100%" }} />
                          </div>
                          <div className="flex justify-between mt-1 text-[10px]">
                            <span className="text-gray-400">{soldWon.toLocaleString()} sold / won</span>
                            {convNeededForTarget > 0
                              ? <span className="text-orange-500 font-medium">{convNeededForTarget.toLocaleString()} more sales to target</span>
                              : <span className="text-emerald-600 font-medium">Target reached ✓</span>}
                          </div>
                        </div>

                        {/* Worked / Unworked / Closed tiles */}
                        <div className="grid grid-cols-3 gap-2 mt-1">
                          {[
                            { label: "Worked",   val: contacted, cls: "text-gray-900 dark:text-white" },
                            { label: "Unworked", val: notCalled, cls: "text-amber-600" },
                            { label: "Closed",   val: soldWon,   cls: "text-emerald-600" },
                          ].map(t => (
                            <div key={t.label} className="rounded-lg bg-gray-50 dark:bg-slate-800/60 border border-gray-100 dark:border-slate-700 p-2.5 text-center">
                              <p className="text-[10px] text-gray-500 dark:text-slate-400 uppercase tracking-wide">{t.label}</p>
                              <p className={`text-lg font-bold tabular-nums ${t.cls}`}>{t.val.toLocaleString()}</p>
                            </div>
                          ))}
                        </div>

                        {/* Unworked alert */}
                        {notCalled > 0 && (
                          <div className="rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 px-3 py-2.5 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">Not Called Yet</p>
                              <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">Leads waiting for first contact</p>
                            </div>
                            <span className="text-xl font-bold tabular-nums text-amber-700 dark:text-amber-300">{notCalled.toLocaleString()}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Status breakdown bars */}
                    <div className="rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5">
                      <h3 className="text-sm font-semibold text-gray-800 dark:text-slate-200 mb-4 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600" />
                        Status Breakdown
                      </h3>
                      <div className="flex flex-col gap-2 overflow-y-auto max-h-[320px] pr-1">
                        {donutData.map(({ name, value, fill }) => {
                          const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                          return (
                            <div key={name} className="flex items-center gap-2">
                              <span className="h-2 w-2 rounded-full shrink-0" style={{ background: fill }} />
                              <span className="text-xs text-gray-600 dark:text-slate-400 w-32 shrink-0 truncate">{name}</span>
                              <div className="flex-1 h-2 rounded-full bg-gray-100 dark:bg-slate-700 overflow-hidden">
                                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
                              </div>
                              <span className="text-xs tabular-nums font-semibold text-gray-700 dark:text-slate-300 w-20 text-right">
                                {value.toLocaleString()} <span className="text-gray-400 font-normal text-[10px]">({pct}%)</span>
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* ── Row 3: Lead list ── */}
                  {reportData.leads && reportData.leads.length > 0 && (
                    <div>
                      <h3 className="text-sm font-semibold text-gray-700 dark:text-slate-300 mb-2">
                        All Leads ({reportData.leads.length.toLocaleString()})
                      </h3>
                      <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-slate-700">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50 dark:bg-slate-800/60 text-xs text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                              <th className="px-3 py-2.5 text-left font-medium">Business</th>
                              <th className="px-3 py-2.5 text-left font-medium">Contact</th>
                              <th className="px-3 py-2.5 text-left font-medium">Phone</th>
                              <th className="px-3 py-2.5 text-left font-medium">Status</th>
                              <th className="px-3 py-2.5 text-left font-medium">Supplier</th>
                              <th className="px-3 py-2.5 text-right font-medium">Annual Usage</th>
                              <th className="px-3 py-2.5 text-left font-medium">End Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {reportData.leads.map((lead: any, idx: number) => (
                              <tr key={lead.opportunity_id ?? idx} className="border-t border-gray-100 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800/40">
                                <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-slate-100 max-w-[200px] truncate">{lead.business_name || "—"}</td>
                                <td className="px-3 py-2.5 text-gray-600 dark:text-slate-400 max-w-[160px] truncate">{lead.contact_person || "—"}</td>
                                <td className="px-3 py-2.5 text-gray-600 dark:text-slate-400 whitespace-nowrap">{lead.tel_number || "—"}</td>
                                <td className="px-3 py-2.5">
                                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${LEAD_STATUS_BADGE[lead.status || ""] || "bg-gray-100 text-gray-600"}`}>
                                    {lead.status || "—"}
                                  </span>
                                </td>
                                <td className="px-3 py-2.5 text-gray-600 dark:text-slate-400">{lead.supplier_name || "—"}</td>
                                <td className="px-3 py-2.5 text-right tabular-nums text-gray-700 dark:text-slate-300">
                                  {lead.annual_usage ? Number(lead.annual_usage).toLocaleString() : "—"}
                                </td>
                                <td className="px-3 py-2.5 text-gray-600 dark:text-slate-400 whitespace-nowrap">{lead.end_date || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
