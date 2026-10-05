"use client";

import { useEffect, useMemo, useState } from "react";

import { BadgePoundSterling, CheckCircle2, Download, Loader2, RefreshCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL, fetchWithAuth } from "@/lib/api";

type CommissionItem = {
  id?: string;
  commission_payment_id?: string | null;
  commission_payment_receipt_id?: string | null;
  client_name: string | null;
  agent_name: string;
  employee_id?: number | null;
  date_received?: string | null;
  receipt_amount?: string;
  commission_rate: string;
  commission_amount: string;
  batch_id?: string | null;
  status: "Awaiting Payment" | "Commission Paid";
};

type CommissionBatch = {
  id: string;
  employee_id?: number | null;
  agent_name: string;
  batch_month: string;
  total_amount: string;
  status: "Awaiting Payment" | "Commission Paid";
  paid_at: string | null;
  statement_url: string;
  items: CommissionItem[];
};

type AgentGroup = {
  agentName: string;
  employeeId: number | null;
  items: CommissionItem[];
  total: number;
  batches: CommissionBatch[];
};

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatMoney = (value: string | number | null | undefined) =>
  moneyFormatter.format(Number(value || 0));

const statusClass = {
  "Awaiting Payment":
    "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-950/60",
  "Commission Paid":
    "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
};

function agentStatus(group: AgentGroup): "Awaiting Payment" | "Commission Paid" {
  if (group.batches.some((b) => b.status === "Awaiting Payment")) return "Awaiting Payment";
  if (group.items.some((i) => !i.batch_id)) return "Awaiting Payment";
  if (group.batches.every((b) => b.status === "Commission Paid") && group.batches.length > 0)
    return "Commission Paid";
  return "Awaiting Payment";
}

export default function AgentCommissionsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState("");
  const [batches, setBatches] = useState<CommissionBatch[]>([]);
  const [items, setItems] = useState<CommissionItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const agentName = user?.name || user?.full_name || "Agent";

  // Group all receipt items by agent, merging batched + unbatched
  const agentGroups = useMemo<AgentGroup[]>(() => {
    const map = new Map<string, AgentGroup>();

    for (const item of items) {
      const key = item.agent_name;
      if (!map.has(key)) {
        map.set(key, {
          agentName: item.agent_name,
          employeeId: item.employee_id ?? null,
          items: [],
          total: 0,
          batches: [],
        });
      }
      const group = map.get(key)!;
      group.items.push(item);
      group.total += Number(item.commission_amount || 0);
    }

    for (const batch of batches) {
      const group = map.get(batch.agent_name);
      if (group) group.batches.push(batch);
    }

    return Array.from(map.values()).sort((a, b) =>
      a.agentName.localeCompare(b.agentName),
    );
  }, [items, batches]);

  const filteredGroups = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return agentGroups;
    return agentGroups.filter(
      (g) =>
        g.agentName.toLowerCase().includes(query) ||
        g.items.some((i) => i.client_name?.toLowerCase().includes(query)),
    );
  }, [agentGroups, searchTerm]);

  const adminTotals = useMemo(() => {
    const total = agentGroups.reduce((s, g) => s + g.total, 0);
    const paid = batches
      .filter((b) => b.status === "Commission Paid")
      .reduce((s, b) => s + Number(b.total_amount || 0), 0);
    return { total, paid, awaiting: total - paid };
  }, [agentGroups, batches]);

  const agentTotal = useMemo(
    () => items.reduce((s, i) => s + Number(i.commission_amount || 0), 0),
    [items],
  );

  const agentSelfStatus = useMemo<"Awaiting Payment" | "Commission Paid">(() => {
    if (batches.some((b) => b.status === "Awaiting Payment") || items.some((i) => !i.batch_id))
      return "Awaiting Payment";
    if (batches.every((b) => b.status === "Commission Paid") && batches.length > 0)
      return "Commission Paid";
    return "Awaiting Payment";
  }, [batches, items]);

  const loadCommissions = async () => {
    setLoading(true);
    setError(null);
    try {
      const url = month
        ? `/api/commission/agent-commissions?month=${month}`
        : `/api/commission/agent-commissions`;
      const data = await fetchWithAuth(url);
      setBatches(data.batches || []);
      setItems(data.items || []);
      setIsAdmin(Boolean(data.is_admin));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load agent commissions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCommissions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const generateBatches = async () => {
    setSaving("generate");
    setError(null);
    setMessage(null);
    try {
      const data = await fetchWithAuth("/api/commission/batches/generate", {
        method: "POST",
        body: JSON.stringify({ month }),
      });
      const summary = data.summary || {};
      setMessage(
        `Generated ${summary.batches_created || 0} batches and ${summary.items_created || 0} items.`,
      );
      await loadCommissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate payout batches");
    } finally {
      setSaving(null);
    }
  };

  const markPaid = async (batchId: string) => {
    setSaving(batchId);
    setError(null);
    setMessage(null);
    try {
      await fetchWithAuth(`/api/commission/batches/${batchId}/mark-paid`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      setMessage("Batch marked as paid.");
      await loadCommissions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to mark batch as paid");
    } finally {
      setSaving(null);
    }
  };

  const downloadStatement = async (batchId: string, agentLabel: string) => {
    setSaving(`download-${batchId}`);
    setError(null);
    try {
      const token =
        localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(
        `${API_BASE_URL}/api/commission/batches/${batchId}/statement`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `commission-${agentLabel}-${month || "all"}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to download statement");
    } finally {
      setSaving(null);
    }
  };

  const renderAgentView = () => (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Total Due
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
            {formatMoney(agentTotal)}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Items
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
            {items.length}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Status
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusClass[agentSelfStatus]}>{agentSelfStatus}</Badge>
          </CardContent>
        </Card>
      </div>
      <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle className="text-slate-950 dark:text-slate-50">{agentName}</CardTitle>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Your commission items{month ? " for the selected month" : " (all time)"}.
            </p>
          </div>
          {batches[0] && (
            <Button
              variant="outline"
              onClick={() => downloadStatement(batches[0].id, agentName)}
              className="w-full sm:w-auto dark:border-slate-700 dark:hover:bg-slate-800"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Statement
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Receipt Date</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                  <th className="px-5 py-3 text-right">Commission</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {items.map((item, index) => (
                  <tr
                    key={item.id || `${item.client_name}-${item.date_received}-${index}`}
                    className="dark:hover:bg-slate-800/50"
                  >
                    <td className="px-5 py-3 font-medium text-slate-950 dark:text-slate-100">
                      {item.client_name || "Client"}
                    </td>
                    <td className="px-5 py-3 text-slate-600 dark:text-slate-400">
                      {item.date_received || "-"}
                    </td>
                    <td className="px-5 py-3 text-right text-slate-700 dark:text-slate-300">
                      {Number(item.commission_rate || 0).toFixed(2)}%
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-slate-950 dark:text-slate-100">
                      {formatMoney(item.commission_amount)}
                    </td>
                    <td className="px-5 py-3">
                      <Badge className={statusClass[item.status]}>{item.status}</Badge>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-5 py-12 text-center text-slate-500 dark:text-slate-400"
                    >
                      No commission items found{month ? " for this month" : ""}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );

  const renderAdminView = () => (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-4">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Agents
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
            {agentGroups.length}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Total Commission
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-950 dark:text-slate-50">
            {formatMoney(adminTotals.total)}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Paid
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">
            {formatMoney(adminTotals.paid)}
          </CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
              Awaiting
            </CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-orange-700 dark:text-orange-400">
            {formatMoney(adminTotals.awaiting)}
          </CardContent>
        </Card>
      </div>

      {filteredGroups.length === 0 && (
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="py-12 text-center text-slate-500 dark:text-slate-400">
            No agent commissions found{month ? " for this month" : ""}.
          </CardContent>
        </Card>
      )}

      {filteredGroups.map((group) => {
        const pendingBatch = group.batches.find((b) => b.status === "Awaiting Payment");
        const anyBatch = group.batches[0];
        const status = agentStatus(group);

        return (
          <Card
            key={group.agentName}
            className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-slate-950 dark:text-slate-50">
                  {group.agentName}
                </CardTitle>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Total: {formatMoney(group.total)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusClass[status]}>{status}</Badge>
                {month && pendingBatch && (
                  <Button
                    size="sm"
                    onClick={() => markPaid(pendingBatch.id)}
                    disabled={saving === pendingBatch.id}
                  >
                    {saving === pendingBatch.id ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                    )}
                    Mark as Paid
                  </Button>
                )}
                {month && anyBatch && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadStatement(anyBatch.id, group.agentName)}
                    disabled={saving === `download-${anyBatch.id}`}
                    className="dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {saving === `download-${anyBatch.id}` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Download Statement
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[760px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">Receipt Date</th>
                      <th className="px-4 py-3 text-right">Supplier Receipt</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {group.items.map((item, idx) => (
                      <tr
                        key={item.id || `${item.client_name}-${idx}`}
                        className="dark:hover:bg-slate-800/50"
                      >
                        <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-100">
                          {item.client_name || "Client"}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                          {item.date_received || "-"}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {formatMoney(item.receipt_amount)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          {Number(item.commission_rate || 0).toFixed(2)}%
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-950 dark:text-slate-100">
                          {formatMoney(item.commission_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Payments</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Agent Commissions
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              {month ? "Showing commissions for selected month." : "Showing all-time commissions. Filter by month to manage payouts."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                className="w-full sm:w-72 pl-9 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Search agent or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <Input
                className="w-full sm:w-48 pr-4 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:mr-1"
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              />
              {month && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setMonth("")}
                  className="shrink-0 text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  All
                </Button>
              )}
            </div>
            <Button
              variant="outline"
              onClick={loadCommissions}
              disabled={loading}
              className="w-full sm:w-auto dark:border-slate-800 dark:hover:bg-slate-800"
            >
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCcw className="mr-2 h-4 w-4" />
              )}
              Refresh
            </Button>
            {isAdmin && month && (
              <Button
                onClick={generateBatches}
                disabled={saving === "generate"}
                className="w-full sm:w-auto"
              >
                {saving === "generate" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BadgePoundSterling className="mr-2 h-4 w-4" />
                )}
                Generate Payouts
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-slate-500 dark:text-slate-400">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading agent commissions...
          </div>
        ) : isAdmin ? (
          renderAdminView()
        ) : (
          renderAgentView()
        )}
      </div>
    </div>
  );
}
