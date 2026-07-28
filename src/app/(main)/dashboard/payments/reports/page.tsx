"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  BadgePoundSterling,
  BarChart3,
  Building2,
  CheckCircle2,
  Clock3,
  Loader2,
  RefreshCcw,
  TrendingUp,
  Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";

type StatusTotal = {
  status: string;
  count: number;
  total_expected: string;
  total_received: string;
  total_outstanding: string;
};

type SummaryReport = {
  total_expected_commission: string;
  total_received: string;
  total_outstanding: string;
  payment_count: number;
  overdue_count: number;
  underpaid_count: number;
  by_status: StatusTotal[];
};

type SupplierReport = {
  supplier_id: number | null;
  supplier_name: string;
  total_expected: string;
  total_received: string;
  total_outstanding: string;
  payment_count: number;
  underpaid_count: number;
  overdue_count: number;
};

type AgentReport = {
  employee_id: number | null;
  agent_name: string;
  month: string | null;
  total_commission: string;
  paid_commission: string;
  awaiting_payment: string;
  batch_count: number;
  item_count: number;
};

type UnderpaidPayment = {
  id: string;
  client_id: number | null;
  customer_name: string | null;
  business_name: string | null;
  supplier_name: string | null;
  agent_name: string | null;
  expected_net_amount: string;
  amount_received: string;
  outstanding_amount: string;
  due_date: string | null;
  status: string;
  last_checked_at: string | null;
  next_follow_up_date: string | null;
};

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatMoney = (value: string | number | null | undefined) => moneyFormatter.format(Number(value || 0));

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatMonth = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const statusTone: Record<string, string> = {
  Scheduled: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  Pending: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Due: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  Received: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "Partially Paid": "bg-orange-100 text-orange-800 hover:bg-orange-100",
  "Chasing Supplier": "bg-red-100 text-red-700 hover:bg-red-100",
  Closed: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200",
};

export default function CommissionReportsPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState<SummaryReport | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierReport[]>([]);
  const [agents, setAgents] = useState<AgentReport[]>([]);
  const [underpaid, setUnderpaid] = useState<UnderpaidPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportSearch, setReportSearch] = useState("");
  const normalizedRole = user?.role?.trim().toLowerCase() || "";
  const isAdmin = ["platform admin", "tenant super admin", "admin", "superadmin", "super admin"].includes(
    normalizedRole,
  );

  const totals = useMemo(
    () => ({
      atRiskCount: (summary?.overdue_count || 0) + (summary?.underpaid_count || 0),
      awaitingAgentPayout: agents.reduce((total, agent) => total + Number(agent.awaiting_payment || 0), 0),
    }),
    [agents, summary],
  );

  const filteredSuppliers = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    const rows = [...suppliers].sort((a, b) => Number(b.total_outstanding || 0) - Number(a.total_outstanding || 0));
    if (!query) return rows;

    return rows.filter((supplier) =>
      [supplier.supplier_name, supplier.supplier_id ? String(supplier.supplier_id) : null]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [reportSearch, suppliers]);

  const filteredAgents = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    const rows = [...agents].sort((a, b) => {
      if (a.month && b.month && a.month !== b.month) return b.month.localeCompare(a.month);
      return Number(b.awaiting_payment || 0) - Number(a.awaiting_payment || 0);
    });
    if (!query) return rows;

    return rows.filter((agent) =>
      [agent.agent_name, agent.month, agent.employee_id ? String(agent.employee_id) : null]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [agents, reportSearch]);

  const filteredUnderpaid = useMemo(() => {
    const query = reportSearch.trim().toLowerCase();
    const rows = [...underpaid].sort((a, b) => Number(b.outstanding_amount || 0) - Number(a.outstanding_amount || 0));
    if (!query) return rows;

    return rows.filter((payment) =>
      [
        payment.business_name,
        payment.customer_name,
        payment.supplier_name,
        payment.agent_name,
        payment.status,
        payment.due_date,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [reportSearch, underpaid]);

  const loadReports = async () => {
    setLoading(true);
    setError(null);

    try {
      const [summaryData, supplierData, agentData, underpaidData] = await Promise.all([
        fetchWithAuth("/api/commission/reports/summary"),
        fetchWithAuth("/api/commission/reports/by-supplier"),
        fetchWithAuth("/api/commission/reports/by-agent"),
        fetchWithAuth("/api/commission/reports/underpaid"),
      ]);

      setSummary(summaryData.summary);
      setSuppliers(supplierData.suppliers || []);
      setAgents(agentData.agents || []);
      setUnderpaid(underpaidData.payments || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commission reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && user && !isAdmin) {
      router.replace("/unauthorized");
    }
  }, [authLoading, isAdmin, router, user]);

  useEffect(() => {
    if (!authLoading && isAdmin) {
      loadReports();
    }
  }, [authLoading, isAdmin]);

  if (authLoading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/50 text-slate-500">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        Checking access...
      </div>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Payments</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Commission Reports</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Management view of supplier receipts, outstanding balances, overdue risk, and agent payout totals.
            </p>
          </div>
          <Button onClick={loadReports} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <BadgePoundSterling className="h-4 w-4 text-slate-900" />
                Total Expected
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMoney(summary?.total_expected_commission)}</div>
              <p className="mt-1 text-xs text-slate-500">{summary?.payment_count || 0} payment rows</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Total Received
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMoney(summary?.total_received)}</div>
              <p className="mt-1 text-xs text-slate-500">Supplier receipts logged</p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <Clock3 className="h-4 w-4 text-orange-600" />
                Total Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{formatMoney(summary?.total_outstanding)}</div>
              <p className="mt-1 text-xs text-slate-500">
                {formatMoney(totals.awaitingAgentPayout)} awaiting agent payout
              </p>
            </CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <AlertTriangle className="h-4 w-4 text-red-600" />
                Overdue / Underpaid
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-semibold">{totals.atRiskCount}</div>
              <p className="mt-1 text-xs text-slate-500">
                {summary?.overdue_count || 0} overdue, {summary?.underpaid_count || 0} underpaid
              </p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-lg border bg-white text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading commission reports...
          </div>
        ) : (
          <Tabs defaultValue="supplier" className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <TabsList className="grid w-full grid-cols-3 bg-white shadow-sm sm:w-fit">
                <TabsTrigger value="supplier" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  By Supplier
                </TabsTrigger>
                <TabsTrigger value="agent" className="gap-2">
                  <Users className="h-4 w-4" />
                  By Agent
                </TabsTrigger>
                <TabsTrigger value="underpaid" className="gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Underpaid
                </TabsTrigger>
              </TabsList>
              <Input
                className="max-w-md bg-white"
                placeholder="Search supplier, agent, customer, month..."
                value={reportSearch}
                onChange={(event) => setReportSearch(event.target.value)}
              />
            </div>

            <TabsContent value="supplier">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Supplier Performance
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      Ordered by outstanding balance so high-risk suppliers stay at the top.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[920px] text-sm">
                      <thead className="border-y bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        <tr>
                          <th className="px-5 py-3">Supplier</th>
                          <th className="px-5 py-3 text-right">Expected</th>
                          <th className="px-5 py-3 text-right">Received</th>
                          <th className="px-5 py-3 text-right">Outstanding</th>
                          <th className="px-5 py-3 text-right">Payments</th>
                          <th className="px-5 py-3 text-right">Overdue</th>
                          <th className="px-5 py-3 text-right">Underpaid</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {filteredSuppliers.map((supplier) => {
                          const atRisk = supplier.overdue_count > 0 || supplier.underpaid_count > 0;
                          return (
                            <tr
                              key={supplier.supplier_id || supplier.supplier_name}
                              className={atRisk ? "bg-red-50/40" : ""}
                            >
                              <td className="px-5 py-4 font-medium text-slate-950">{supplier.supplier_name}</td>
                              <td className="px-5 py-4 text-right">{formatMoney(supplier.total_expected)}</td>
                              <td className="px-5 py-4 text-right">{formatMoney(supplier.total_received)}</td>
                              <td className="px-5 py-4 text-right font-semibold">
                                {formatMoney(supplier.total_outstanding)}
                              </td>
                              <td className="px-5 py-4 text-right">{supplier.payment_count}</td>
                              <td className="px-5 py-4 text-right">
                                <Badge
                                  className={
                                    supplier.overdue_count
                                      ? "bg-red-100 text-red-700 hover:bg-red-100"
                                      : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                                  }
                                >
                                  {supplier.overdue_count}
                                </Badge>
                              </td>
                              <td className="px-5 py-4 text-right">
                                <Badge
                                  className={
                                    supplier.underpaid_count
                                      ? "bg-orange-100 text-orange-800 hover:bg-orange-100"
                                      : "bg-slate-100 text-slate-700 hover:bg-slate-100"
                                  }
                                >
                                  {supplier.underpaid_count}
                                </Badge>
                              </td>
                            </tr>
                          );
                        })}
                        {filteredSuppliers.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                              No supplier report rows found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="agent">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Monthly Agent Commissions
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      Grouped by agent and month with paid versus awaiting payout.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-sm">
                      <thead className="border-y bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        <tr>
                          <th className="px-5 py-3">Agent</th>
                          <th className="px-5 py-3">Month</th>
                          <th className="px-5 py-3 text-right">Total Commission</th>
                          <th className="px-5 py-3 text-right">Paid</th>
                          <th className="px-5 py-3 text-right">Awaiting Payment</th>
                          <th className="px-5 py-3 text-right">Batches</th>
                          <th className="px-5 py-3 text-right">Items</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {filteredAgents.map((agent) => (
                          <tr key={`${agent.employee_id}-${agent.month}`}>
                            <td className="px-5 py-4 font-medium text-slate-950">{agent.agent_name}</td>
                            <td className="px-5 py-4 text-slate-700">{formatMonth(agent.month)}</td>
                            <td className="px-5 py-4 text-right font-semibold">
                              {formatMoney(agent.total_commission)}
                            </td>
                            <td className="px-5 py-4 text-right text-emerald-700">
                              {formatMoney(agent.paid_commission)}
                            </td>
                            <td className="px-5 py-4 text-right text-orange-700">
                              {formatMoney(agent.awaiting_payment)}
                            </td>
                            <td className="px-5 py-4 text-right">{agent.batch_count}</td>
                            <td className="px-5 py-4 text-right">{agent.item_count}</td>
                          </tr>
                        ))}
                        {filteredAgents.length === 0 && (
                          <tr>
                            <td colSpan={7} className="px-5 py-12 text-center text-slate-500">
                              No agent commission batches found yet.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="underpaid">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Underpaid & Outstanding
                    </CardTitle>
                    <p className="mt-1 text-sm text-slate-500">
                      Sorted by largest outstanding amount for chasing priority.
                    </p>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[1120px] text-sm">
                      <thead className="border-y bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        <tr>
                          <th className="px-5 py-3">Customer</th>
                          <th className="px-5 py-3">Supplier</th>
                          <th className="px-5 py-3">Agent</th>
                          <th className="px-5 py-3 text-right">Expected</th>
                          <th className="px-5 py-3 text-right">Received</th>
                          <th className="px-5 py-3 text-right">Outstanding</th>
                          <th className="px-5 py-3">Due Date</th>
                          <th className="px-5 py-3">Status</th>
                          <th className="px-5 py-3">Next Follow-Up</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {filteredUnderpaid.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-5 py-4 font-medium text-slate-950">
                              {payment.business_name || payment.customer_name || `Client #${payment.client_id}`}
                            </td>
                            <td className="px-5 py-4 text-slate-700">{payment.supplier_name || "-"}</td>
                            <td className="px-5 py-4 text-slate-700">{payment.agent_name || "-"}</td>
                            <td className="px-5 py-4 text-right">{formatMoney(payment.expected_net_amount)}</td>
                            <td className="px-5 py-4 text-right">{formatMoney(payment.amount_received)}</td>
                            <td className="px-5 py-4 text-right font-semibold text-red-700">
                              {formatMoney(payment.outstanding_amount)}
                            </td>
                            <td className="px-5 py-4 text-slate-700">{formatDate(payment.due_date)}</td>
                            <td className="px-5 py-4">
                              <Badge
                                className={
                                  statusTone[payment.status] || "bg-slate-100 text-slate-700 hover:bg-slate-100"
                                }
                              >
                                {payment.status}
                              </Badge>
                            </td>
                            <td className="px-5 py-4 text-slate-700">{formatDate(payment.next_follow_up_date)}</td>
                          </tr>
                        ))}
                        {filteredUnderpaid.length === 0 && (
                          <tr>
                            <td colSpan={9} className="px-5 py-12 text-center text-slate-500">
                              No underpaid or chasing supplier payments found.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
