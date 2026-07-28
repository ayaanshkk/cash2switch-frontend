"use client";

import { useEffect, useMemo, useState } from "react";

import { BadgePoundSterling, CheckCircle2, Download, Loader2, RefreshCcw, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";

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

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatMoney = (value: string | number | null | undefined) => moneyFormatter.format(Number(value || 0));

const currentMonth = () => new Date().toISOString().slice(0, 7);

const statusClass = {
  "Awaiting Payment": "bg-amber-100 text-amber-800 hover:bg-amber-100",
  "Commission Paid": "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
};

export default function AgentCommissionsPage() {
  const { user } = useAuth();
  const [month, setMonth] = useState(currentMonth());
  const [batches, setBatches] = useState<CommissionBatch[]>([]);
  const [items, setItems] = useState<CommissionItem[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const agentName = user?.name || user?.full_name || "Agent";

  const agentTotal = useMemo(
    () => items.reduce((total, item) => total + Number(item.commission_amount || 0), 0),
    [items],
  );

  const filteredBatches = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return batches;

    return batches.filter((batch) =>
      [batch.agent_name, batch.status, batch.batch_month]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [batches, searchTerm]);

  const filteredItems = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) =>
      [item.client_name, item.agent_name, item.status, item.date_received]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [items, searchTerm]);

  const adminTotals = useMemo(
    () =>
      batches.reduce(
        (acc, batch) => {
          acc.total += Number(batch.total_amount || 0);
          if (batch.status === "Commission Paid") acc.paid += Number(batch.total_amount || 0);
          if (batch.status === "Awaiting Payment") acc.awaiting += Number(batch.total_amount || 0);
          return acc;
        },
        { total: 0, paid: 0, awaiting: 0 },
      ),
    [batches],
  );

  const agentStatus = useMemo(() => {
    if (batches.some((batch) => batch.status === "Awaiting Payment")) return "Awaiting Payment";
    if (batches.some((batch) => batch.status === "Commission Paid")) return "Commission Paid";
    if (items.length > 0) return "Awaiting Payment";
    return "Awaiting Payment";
  }, [batches, items]);

  const loadCommissions = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchWithAuth(`/api/commission/agent-commissions?month=${month}`);
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
  }, []);

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
      setMessage(`Generated ${summary.batches_created || 0} batches and ${summary.items_created || 0} items.`);
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

  const downloadStatement = async (batchId: string) => {
    setSaving(`download-${batchId}`);
    setError(null);

    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(`/backend-api/api/commission/batches/${batchId}/statement`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `agent-commission-${month}.pdf`;
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Due</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoney(agentTotal)}</CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Items</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{items.length}</CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Status</CardTitle>
          </CardHeader>
          <CardContent>
            <Badge className={statusClass[agentStatus]}>{agentStatus}</Badge>
          </CardContent>
        </Card>
      </div>
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>{agentName}</CardTitle>
            <p className="mt-1 text-sm text-slate-500">Your commission items for the selected month.</p>
          </div>
          {batches[0] && (
            <Button variant="outline" onClick={() => downloadStatement(batches[0].id)}>
              <Download className="mr-2 h-4 w-4" />
              Download Statement
            </Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t">
            <table className="w-full min-w-[760px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                <tr>
                  <th className="px-5 py-3">Client</th>
                  <th className="px-5 py-3">Receipt Date</th>
                  <th className="px-5 py-3 text-right">Rate</th>
                  <th className="px-5 py-3 text-right">Commission</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {filteredItems.map((item, index) => (
                  <tr key={item.id || `${item.client_name}-${item.date_received}-${index}`}>
                    <td className="px-5 py-3 font-medium text-slate-950">{item.client_name || "Client"}</td>
                    <td className="px-5 py-3 text-slate-600">{item.date_received || "-"}</td>
                    <td className="px-5 py-3 text-right">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                    <td className="px-5 py-3 text-right font-semibold">{formatMoney(item.commission_amount)}</td>
                    <td className="px-5 py-3">
                      <Badge className={statusClass[item.status]}>{item.status}</Badge>
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-5 py-12 text-center text-slate-500">
                      No commission items match this month and search.
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
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Batches</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{batches.length}</CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Total Commission</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold">{formatMoney(adminTotals.total)}</CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Paid</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-700">{formatMoney(adminTotals.paid)}</CardContent>
        </Card>
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-slate-600">Awaiting</CardTitle>
          </CardHeader>
          <CardContent className="text-2xl font-semibold text-orange-700">
            {formatMoney(adminTotals.awaiting)}
          </CardContent>
        </Card>
      </div>

      {batches.length === 0 && items.length === 0 && (
        <Card className="border-slate-200 shadow-sm">
          <CardContent className="py-12 text-center text-slate-500">
            No agent commissions found for this month.
          </CardContent>
        </Card>
      )}

      {filteredBatches.map((batch) => (
        <Card key={batch.id} className="border-slate-200 shadow-sm">
          <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>{batch.agent_name}</CardTitle>
              <p className="mt-1 text-sm text-slate-500">Total: {formatMoney(batch.total_amount)}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge className={statusClass[batch.status]}>{batch.status}</Badge>
              {batch.status !== "Commission Paid" && (
                <Button size="sm" onClick={() => markPaid(batch.id)} disabled={saving === batch.id}>
                  {saving === batch.id ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}
                  Mark as Paid
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => downloadStatement(batch.id)}>
                <Download className="mr-2 h-4 w-4" />
                Download Statement
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3 text-right">Supplier Receipt</th>
                    <th className="px-4 py-3 text-right">Rate</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {batch.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3 font-medium">{item.client_name || "Client"}</td>
                      <td className="px-4 py-3 text-right">{formatMoney(item.receipt_amount)}</td>
                      <td className="px-4 py-3 text-right">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatMoney(item.commission_amount)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {items.some((item) => !item.batch_id) && (
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>Awaiting Batch Generation</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase">
                  <tr>
                    <th className="px-4 py-3">Agent</th>
                    <th className="px-4 py-3">Client</th>
                    <th className="px-4 py-3 text-right">Supplier Receipt</th>
                    <th className="px-4 py-3 text-right">Commission</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {filteredItems
                    .filter((item) => !item.batch_id)
                    .map((item, index) => (
                      <tr key={`${item.commission_payment_receipt_id}-${index}`}>
                        <td className="px-4 py-3">{item.agent_name}</td>
                        <td className="px-4 py-3 font-medium">{item.client_name || "Client"}</td>
                        <td className="px-4 py-3 text-right">{formatMoney(item.receipt_amount)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{formatMoney(item.commission_amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Payments</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Agent Commissions</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Review monthly agent commission batches, generate payouts, and download statements.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="w-72 pl-9"
                placeholder="Search agent, client, status..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            <Input
              className="w-48 pr-4 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:mr-1"
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
            <Button variant="outline" onClick={loadCommissions} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            {isAdmin && (
              <Button onClick={generateBatches} disabled={saving === "generate"}>
                {saving === "generate" ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <BadgePoundSterling className="mr-2 h-4 w-4" />
                )}
                Generate Month-End Payouts
              </Button>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}
        {message && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {message}
          </div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-slate-500">
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
