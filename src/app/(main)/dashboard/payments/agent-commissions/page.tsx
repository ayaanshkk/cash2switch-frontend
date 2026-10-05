"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BadgePoundSterling,
  Download,
  Loader2,
  Lock,
  RefreshCcw,
  Search,
  X,
} from "lucide-react";

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
  client_id?: number | null;
  client_name: string | null;
  agent_name: string;
  employee_id?: number | null;
  date_received?: string | null;
  receipt_amount?: string;
  commission_rate: string;
  commission_amount: string;
  batch_id?: string | null;
  status: string;
};

type PaymentLogEntry = {
  id: string;
  amount: string;
  date: string;
  notes: string | null;
  logged_at: string;
  receipt_id?: string | null;
};

type CommissionBatch = {
  id: string;
  employee_id?: number | null;
  agent_name: string;
  batch_month: string;
  total_amount: string;
  amount_paid?: string;
  payment_date?: string | null;
  payment_notes?: string | null;
  payment_log?: PaymentLogEntry[];
  status: string;
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

type PaymentSidebar = {
  batchId: string;
  agentName: string;
  /** full batch total for display */
  batchTotal: number;
  /** already paid so far on this batch */
  alreadyPaid: number;
  /** what to pre-fill; undefined = empty (Pay All path) */
  prefilledAmount?: number;
  /** label shown in sidebar header */
  context: string;
  /** receipt id when paying a specific row; null for Pay All */
  receiptId: string | null;
  amountPaid: string;
  paymentDate: string;
  notes: string;
};

const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const money = (v: string | number | null | undefined) => fmt.format(Number(v || 0));
const todayIso = () => new Date().toISOString().slice(0, 10);

const statusCls: Record<string, string> = {
  "Awaiting Payment": "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 dark:hover:bg-amber-950/60",
  "Partially Paid":   "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950/60",
  "Commission Paid":  "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
};

function StatementButton({ batchId, label, hasPaid, saving, onDownload }: {
  batchId: string; label: string; hasPaid: boolean; saving: string | null;
  onDownload: (id: string, label: string) => void;
}) {
  const [showTip, setShowTip] = useState(false);
  const tipRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = () => {
    if (!hasPaid) {
      setShowTip(true);
      if (tipRef.current) clearTimeout(tipRef.current);
      tipRef.current = setTimeout(() => setShowTip(false), 2500);
      return;
    }
    onDownload(batchId, label);
  };

  return (
    <div className="relative">
      <Button
        size="sm"
        variant="outline"
        onClick={handleClick}
        disabled={saving === `dl-${batchId}`}
        className={`dark:border-slate-700 dark:hover:bg-slate-800 ${!hasPaid ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {saving === `dl-${batchId}` ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : hasPaid ? (
          <Download className="mr-2 h-4 w-4" />
        ) : (
          <Lock className="mr-2 h-4 w-4" />
        )}
        Statement
      </Button>
      {showTip && (
        <div className="absolute right-0 top-full mt-1.5 z-50 w-max max-w-[200px] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Make a payment first to unlock the statement.
          <div className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" />
        </div>
      )}
    </div>
  );
}

function agentStatusLabel(group: AgentGroup): string {
  const statuses = group.batches.map((b) => b.status);
  if (statuses.includes("Awaiting Payment") || group.items.some((i) => !i.batch_id)) return "Awaiting Payment";
  if (statuses.includes("Partially Paid")) return "Partially Paid";
  if (statuses.length > 0 && statuses.every((s) => s === "Commission Paid")) return "Commission Paid";
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
  const msgTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showMessage = (msg: string) => {
    setMessage(msg);
    if (msgTimerRef.current) clearTimeout(msgTimerRef.current);
    msgTimerRef.current = setTimeout(() => setMessage(null), 4000);
  };
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sidebar, setSidebar] = useState<PaymentSidebar | null>(null);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const agentName = user?.name || user?.full_name || "Agent";

  /* ── group items by agent ── */
  const agentGroups = useMemo<AgentGroup[]>(() => {
    const map = new Map<string, AgentGroup>();
    for (const item of items) {
      if (!map.has(item.agent_name))
        map.set(item.agent_name, { agentName: item.agent_name, employeeId: item.employee_id ?? null, items: [], total: 0, batches: [] });
      const g = map.get(item.agent_name)!;
      g.items.push(item);
      g.total += Number(item.commission_amount || 0);
    }
    for (const batch of batches) {
      const g = map.get(batch.agent_name);
      if (g) g.batches.push(batch);
    }
    return Array.from(map.values()).sort((a, b) => a.agentName.localeCompare(b.agentName));
  }, [items, batches]);

  const filteredGroups = useMemo(() => {
    let groups = agentGroups;
    const q = search.trim().toLowerCase();
    if (q) groups = groups.filter(
      (g) => g.agentName.toLowerCase().includes(q) || g.items.some((i) => i.client_name?.toLowerCase().includes(q)),
    );
    if (statusFilter) {
      groups = groups.filter((g) => {
        const label = agentStatusLabel(g);
        return label === statusFilter;
      });
    }
    return groups;
  }, [agentGroups, search, statusFilter]);

  const adminTotals = useMemo(() => {
    const total   = agentGroups.reduce((s, g) => s + g.total, 0);
    const paid    = batches.filter((b) => b.status === "Commission Paid").reduce((s, b) => s + Number(b.amount_paid || 0), 0);
    const partial = batches.filter((b) => b.status === "Partially Paid").reduce((s, b) => s + Number(b.amount_paid || 0), 0);
    const awaiting = total - paid - partial;
    return { total, paid, partial, awaiting: Math.max(awaiting, 0) };
  }, [agentGroups, batches]);

  const agentTotal = useMemo(() => items.reduce((s, i) => s + Number(i.commission_amount || 0), 0), [items]);

  /* ── data loading ── */
  const load = async (autoGenerate = false) => {
    setLoading(true); setError(null);
    try {
      // Auto-generate batches for any unbatched receipts before loading
      if (autoGenerate) {
        try {
          await fetchWithAuth("/api/commission/batches/generate", { method: "POST", body: JSON.stringify({}) });
        } catch {
          // silently ignore — page still loads
        }
      }
      const url = month ? `/api/commission/agent-commissions?month=${month}` : `/api/commission/agent-commissions`;
      const data = await fetchWithAuth(url);
      setBatches(data.batches || []);
      setItems(data.items || []);
      setIsAdmin(Boolean(data.is_admin));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const mountedRef = useRef(false);
  useEffect(() => {
    load(true); // auto-generate on first load
    mountedRef.current = true;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (mountedRef.current) load(); // month changes after mount
  }, [month]); // eslint-disable-line react-hooks/exhaustive-deps

  const prevBatchIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = sidebar?.batchId ?? null;
    if (newId && newId !== prevBatchIdRef.current) {
      setTimeout(() => amountRef.current?.focus(), 60);
    }
    prevBatchIdRef.current = newId;
  }, [sidebar?.batchId]);

  /* ── open sidebar helpers ── */
  function openManageSidebar(batch: CommissionBatch) {
    const total       = Number(batch.total_amount || 0);
    const alreadyPaid = Number(batch.amount_paid || 0);
    setSidebarError(null);
    setSidebar({
      batchId: batch.id, agentName: batch.agent_name,
      batchTotal: total, alreadyPaid,
      prefilledAmount: undefined,
      context: `Manage payments`,
      receiptId: null,
      amountPaid: "",
      paymentDate: todayIso(), notes: "",
    });
  }

  function openPayAll(batch: CommissionBatch) {
    const total      = Number(batch.total_amount || 0);
    const alreadyPaid = Number(batch.amount_paid || 0);
    const outstanding = Math.max(total - alreadyPaid, 0);
    setSidebarError(null);
    setSidebar({
      batchId: batch.id, agentName: batch.agent_name,
      batchTotal: total, alreadyPaid,
      prefilledAmount: outstanding,
      context: `Full commission payment`,
      receiptId: null,
      amountPaid: outstanding > 0 ? outstanding.toFixed(2) : "",
      paymentDate: todayIso(), notes: "",
    });
  }

  function openPayItem(batch: CommissionBatch, item: CommissionItem, alreadyPaidForItem = 0) {
    const total       = Number(batch.total_amount || 0);
    const alreadyPaid = Number(batch.amount_paid || 0);
    const itemAmount  = Number(item.commission_amount || 0);
    const remaining   = Math.max(itemAmount - alreadyPaidForItem, 0);
    setSidebarError(null);
    setSidebar({
      batchId: batch.id, agentName: batch.agent_name,
      batchTotal: total, alreadyPaid,
      prefilledAmount: remaining,
      context: `${item.client_name || "Client"} — ${money(item.commission_amount)}`,
      receiptId: item.commission_payment_receipt_id ?? null,
      amountPaid: remaining.toFixed(2),
      paymentDate: todayIso(), notes: "",
    });
  }

  /* ── submit payment ── */
  const submitPayment = async () => {
    if (!sidebar) return;
    setSidebarError(null);
    const amt = Number(sidebar.amountPaid);
    if (!sidebar.amountPaid || isNaN(amt) || amt <= 0) { setSidebarError("Enter a valid amount."); return; }
    setSaving(`pay-${sidebar.batchId}`);
    try {
      await fetchWithAuth(`/api/commission/batches/${sidebar.batchId}/log-payment`, {
        method: "POST",
        body: JSON.stringify({ amount_paid: sidebar.amountPaid, payment_date: sidebar.paymentDate, notes: sidebar.notes || null, receipt_id: sidebar.receiptId || null }),
      });
      showMessage(`Payment of ${money(amt)} logged for ${sidebar.agentName}.`);
      setSidebar(null);
      await load();
    } catch (e) {
      setSidebarError(e instanceof Error ? e.message : "Failed to log payment");
    } finally {
      setSaving(null);
    }
  };

  /* ── reverse payment ── */
  const reversePayment = async (batchId: string, logEntryId: string) => {
    setSidebarError(null);
    setSaving(`rev-${logEntryId}`);
    try {
      await fetchWithAuth(`/api/commission/batches/${batchId}/reverse-payment`, {
        method: "POST",
        body: JSON.stringify({ log_entry_id: logEntryId }),
      });
      showMessage("Payment reversed successfully.");
      await load();
      // Update sidebar state with fresh batch data
      setSidebar((s) => {
        if (!s || s.batchId !== batchId) return s;
        return s; // load() will refresh batches; sidebar stays open
      });
    } catch (e) {
      setSidebarError(e instanceof Error ? e.message : "Failed to reverse payment");
    } finally {
      setSaving(null);
    }
  };

  /* ── generate / download ── */
  const generateBatches = async () => {
    setSaving("generate"); setError(null); setMessage(null);
    try {
      const body = month ? { month } : {};
      const data = await fetchWithAuth("/api/commission/batches/generate", { method: "POST", body: JSON.stringify(body) });
      const s = data.summary || {};
      showMessage(`Generated ${s.batches_created || 0} batches and ${s.items_created || 0} items.`);
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to generate"); }
    finally { setSaving(null); }
  };

  const downloadStatement = async (batchId: string, label: string) => {
    setSaving(`dl-${batchId}`); setError(null);
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/commission/batches/${batchId}/statement`, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: `commission-${label}-${month || "all"}.pdf` }).click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed"); }
    finally { setSaving(null); }
  };

  /* ── views ── */
  const agentSelfStatus = useMemo(() => {
    if (batches.some((b) => b.status === "Awaiting Payment") || items.some((i) => !i.batch_id)) return "Awaiting Payment";
    if (batches.some((b) => b.status === "Partially Paid")) return "Partially Paid";
    if (batches.length > 0 && batches.every((b) => b.status === "Commission Paid")) return "Commission Paid";
    return "Awaiting Payment";
  }, [batches, items]);

  const renderAgentView = () => (
    <div className="space-y-4">
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Due</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{money(agentTotal)}</CardContent></Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Items</CardTitle></CardHeader><CardContent className="text-2xl font-semibold">{items.length}</CardContent></Card>
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900"><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Status</CardTitle></CardHeader><CardContent><Badge className={statusCls[agentSelfStatus] ?? ""}>{agentSelfStatus}</Badge></CardContent></Card>
      </div>
      <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div><CardTitle>{agentName}</CardTitle><p className="mt-1 text-sm text-slate-500">Your commission items{month ? " for selected month" : " (all time)"}.</p></div>
          {batches[0] && (
            <StatementButton
              batchId={batches[0].id}
              label={agentName}
              hasPaid={Number(batches[0].amount_paid || 0) > 0}
              saving={saving}
              onDownload={downloadStatement}
            />
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-[700px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                <tr><th className="px-5 py-3">Client</th><th className="px-5 py-3">Date</th><th className="px-5 py-3 text-right">Rate</th><th className="px-5 py-3 text-right">Commission</th><th className="px-5 py-3">Status</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {items.map((item, idx) => (
                  <tr key={item.id || idx} className="dark:hover:bg-slate-800/50">
                    <td className="px-5 py-3 font-medium">{item.client_name || "Client"}</td>
                    <td className="px-5 py-3 text-slate-500">{item.date_received || "-"}</td>
                    <td className="px-5 py-3 text-right">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                    <td className="px-5 py-3 text-right font-semibold">{money(item.commission_amount)}</td>
                    <td className="px-5 py-3"><Badge className={statusCls[item.status] ?? ""}>{item.status}</Badge></td>
                  </tr>
                ))}
                {!items.length && <tr><td colSpan={5} className="px-5 py-12 text-center text-slate-500">No commission items found{month ? " for this month" : ""}.</td></tr>}
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
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {([
          { label: "Agents",           value: String(agentGroups.length),      filter: null,               valueCls: "",                                          countLabel: `${agentGroups.length} agent${agentGroups.length !== 1 ? "s" : ""}` },
          { label: "Total Commission", value: money(adminTotals.total),         filter: null,               valueCls: "" },
          { label: "Paid",             value: money(adminTotals.paid),          filter: "Commission Paid",  valueCls: "text-emerald-700 dark:text-emerald-400" },
          { label: "Partially Paid",   value: money(adminTotals.partial),       filter: "Partially Paid",   valueCls: "text-blue-700 dark:text-blue-400" },
          { label: "Awaiting",         value: money(adminTotals.awaiting),      filter: "Awaiting Payment", valueCls: "text-orange-700 dark:text-orange-400" },
        ] as { label: string; value: string; filter: string | null; valueCls: string }[]).map(({ label, value, filter, valueCls }) => {
          const isActive = statusFilter === filter && filter !== null;
          return (
            <Card
              key={label}
              onClick={() => setStatusFilter(isActive ? null : filter)}
              className={`border-slate-200 shadow-sm transition-all dark:border-slate-800 dark:bg-slate-900 ${filter !== null ? "cursor-pointer hover:border-slate-400 dark:hover:border-slate-600" : ""} ${isActive ? "ring-2 ring-slate-400 dark:ring-slate-500" : ""}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400 flex items-center justify-between">
                  {label}
                  {isActive && <span className="text-xs font-normal text-slate-400">✕ clear</span>}
                </CardTitle>
              </CardHeader>
              <CardContent className={`text-2xl font-semibold text-slate-950 dark:text-slate-50 ${valueCls}`}>{value}</CardContent>
            </Card>
          );
        })}
      </div>

      {statusFilter && (
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Filtering by <span className="font-medium text-slate-700 dark:text-slate-300">{statusFilter}</span> — showing {filteredGroups.length} agent{filteredGroups.length !== 1 ? "s" : ""}.{" "}
          <button onClick={() => setStatusFilter(null)} className="text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300">Clear filter</button>
        </p>
      )}

      {filteredGroups.length === 0 && (
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardContent className="py-12 text-center text-slate-500">No agent commissions found{statusFilter ? ` with status "${statusFilter}"` : month ? " for this month" : ""}.</CardContent>
        </Card>
      )}

      {filteredGroups.map((group) => {
        const pendingBatch = group.batches.find((b) => b.status !== "Commission Paid");
        const anyBatch     = group.batches[0];
        const status       = agentStatusLabel(group);
        const outstanding  = pendingBatch
          ? Math.max(Number(pendingBatch.total_amount || 0) - Number(pendingBatch.amount_paid || 0), 0)
          : 0;

        return (
          <Card key={group.agentName} className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-slate-950 dark:text-slate-50">{group.agentName}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
                  <span>Total: <span className="font-medium text-slate-700 dark:text-slate-300">{money(group.total)}</span></span>
                  {pendingBatch && Number(pendingBatch.amount_paid || 0) > 0 && (
                    <>
                      <span>Paid: <span className="font-medium text-emerald-700 dark:text-emerald-400">{money(pendingBatch.amount_paid)}</span></span>
                      <span>Outstanding: <span className="font-medium text-orange-700 dark:text-orange-400">{money(outstanding)}</span></span>
                    </>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusCls[status] ?? ""}>{status}</Badge>
                {pendingBatch && outstanding > 0 && (
                  <Button size="sm" onClick={() => openPayAll(pendingBatch)} disabled={!!saving}>
                    Pay All ({money(outstanding)})
                  </Button>
                )}
                {!pendingBatch && anyBatch && (
                  <Button size="sm" variant="outline" onClick={() => openManageSidebar(anyBatch)} disabled={!!saving} className="dark:border-slate-700 dark:hover:bg-slate-800">
                    Manage Payments
                  </Button>
                )}
                {anyBatch && (
                  <StatementButton
                    batchId={anyBatch.id}
                    label={group.agentName}
                    hasPaid={Number(anyBatch.amount_paid || 0) > 0}
                    saving={saving}
                    onDownload={downloadStatement}
                  />
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
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {group.items.map((item, idx) => {
                      const itemBatch = item.batch_id
                        ? group.batches.find((b) => b.id === item.batch_id) ?? pendingBatch
                        : null;

                      // Per-row payment status derived from log entries referencing this receipt
                      const rid = item.commission_payment_receipt_id;
                      const log = itemBatch?.payment_log ?? [];
                      const paidForRow = log
                        .filter((e) => e.receipt_id === rid)
                        .reduce((s, e) => s + Number(e.amount || 0), 0);
                      const rowCommission = Number(item.commission_amount || 0);
                      const rowFullyPaid  = rid && paidForRow >= rowCommission && rowCommission > 0;
                      const rowPartlyPaid = rid && paidForRow > 0 && !rowFullyPaid;

                      return (
                      <tr
                        key={item.id || `${item.client_name}-${idx}`}
                        onClick={() => item.client_id && window.open(`/dashboard/payments/history/${item.client_id}`, "_blank")}
                        className={`dark:hover:bg-slate-800/50 hover:bg-slate-50 transition-colors ${item.client_id ? "cursor-pointer" : ""}`}
                      >
                        <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-100">
                          {item.client_name || "Client"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">{item.date_received || "-"}</td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{money(item.receipt_amount)}</td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-950 dark:text-slate-100">{money(item.commission_amount)}</td>
                        <td className="px-4 py-3 text-right">
                          {rowFullyPaid ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (itemBatch) openManageSidebar(itemBatch); }}
                              disabled={!!saving}
                              className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 disabled:opacity-40 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/80"
                            >
                              ✓ Paid
                            </button>
                          ) : rowPartlyPaid ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); if (itemBatch) openPayItem(itemBatch, item, paidForRow); }}
                              disabled={!!saving}
                              className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 disabled:opacity-40 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950/80"
                            >
                              Part Paid
                            </button>
                          ) : itemBatch ? (
                            <button
                              onClick={(e) => { e.stopPropagation(); openPayItem(itemBatch, item); }}
                              disabled={!!saving}
                              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Pay
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );

  /* ── sidebar live preview ── */
  const enteredAmt   = Number(sidebar?.amountPaid || 0);
  const alreadyPaid  = sidebar?.alreadyPaid ?? 0;
  const batchTotal   = sidebar?.batchTotal ?? 0;
  const newTotalPaid = alreadyPaid + enteredAmt;
  const remaining    = Math.max(batchTotal - newTotalPaid, 0);
  const willBeFull   = newTotalPaid >= batchTotal && enteredAmt > 0;

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── header bar ── */}
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Payments</p>
            <h1 className="mt-1 text-2xl sm:text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">Agent Commissions</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              {month ? "Showing commissions for selected month." : "Showing all-time commissions. Filter by month to manage payouts."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-auto">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input className="w-full sm:w-64 pl-9 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" placeholder="Search agent or client…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            <div className="flex items-center gap-1 w-full sm:w-auto">
              <Input className="w-full sm:w-44 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
              {month && <Button variant="ghost" size="sm" onClick={() => setMonth("")} className="text-slate-500 hover:text-slate-900 dark:text-slate-400">All</Button>}
            </div>
            <Button variant="outline" onClick={load} disabled={loading} className="dark:border-slate-800 dark:hover:bg-slate-800">
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
            {isAdmin && (
              <Button onClick={generateBatches} disabled={saving === "generate"}>
                {saving === "generate" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BadgePoundSterling className="mr-2 h-4 w-4" />}
                Generate Payouts
              </Button>
            )}
          </div>
        </div>

        {error   && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{error}</div>}
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">{message}</div>}

        {loading
          ? <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading…</div>
          : isAdmin ? renderAdminView() : renderAgentView()}
      </div>

      {/* ── payment sidebar ── */}
      {sidebar && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setSidebar(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900">

            {/* header */}
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Make Payment</h2>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">{sidebar.agentName}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sidebar.context}</p>
              </div>
              <button onClick={() => setSidebar(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* body */}
            <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">

              {/* summary strip */}
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 dark:border-slate-700 dark:bg-slate-800/50">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500 dark:text-slate-400">Total commission</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100">{money(batchTotal)}</span>
                </div>
                {alreadyPaid > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-500 dark:text-slate-400">Already paid</span>
                    <span className="font-medium text-emerald-700 dark:text-emerald-400">{money(alreadyPaid)}</span>
                  </div>
                )}
                {enteredAmt > 0 && (
                  <div className="flex justify-between text-sm border-t border-slate-200 pt-2 dark:border-slate-700">
                    <span className="text-slate-500 dark:text-slate-400">Remaining after this</span>
                    <span className={`font-semibold ${willBeFull ? "text-emerald-700 dark:text-emerald-400" : "text-orange-700 dark:text-orange-400"}`}>
                      {willBeFull ? "Fully paid ✓" : money(remaining)}
                    </span>
                  </div>
                )}
              </div>

              {/* amount */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Amount <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">£</span>
                  <Input
                    ref={amountRef}
                    type="number" step="0.01" min="0.01"
                    placeholder="0.00"
                    value={sidebar.amountPaid}
                    onChange={(e) => setSidebar((s) => s ? { ...s, amountPaid: e.target.value } : s)}
                    className="pl-7 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100"
                  />
                </div>
                {enteredAmt > 0 && (
                  <p className={`text-xs ${willBeFull ? "text-emerald-600 dark:text-emerald-400" : "text-orange-600 dark:text-orange-400"}`}>
                    {willBeFull ? "Full payment — will mark as Commission Paid" : "Partial payment — status will be set to Partially Paid"}
                  </p>
                )}
              </div>

              {/* date */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Payment date</label>
                <Input
                  type="date"
                  value={sidebar.paymentDate}
                  onChange={(e) => setSidebar((s) => s ? { ...s, paymentDate: e.target.value } : s)}
                  className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]"
                />
              </div>

              {/* notes */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Notes <span className="text-slate-400 font-normal">(optional)</span>
                </label>
                <textarea
                  rows={3}
                  placeholder="e.g. Paid via bank transfer, ref #12345"
                  value={sidebar.notes}
                  onChange={(e) => setSidebar((s) => s ? { ...s, notes: e.target.value } : s)}
                  className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500"
                />
              </div>

              {sidebarError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{sidebarError}</p>
              )}

              {/* audit log */}
              {(() => {
                const currentBatch = batches.find((b) => b.id === sidebar.batchId);
                const log = currentBatch?.payment_log ?? [];
                if (!log.length) return null;
                return (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Payment History</p>
                    <div className="space-y-2">
                      {log.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-700 dark:bg-slate-800/50">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{money(entry.amount)}</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">{entry.date}{entry.notes ? ` · ${entry.notes}` : ""}</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">{new Date(entry.logged_at).toLocaleString("en-GB")}</p>
                          </div>
                          <button
                            onClick={() => reversePayment(sidebar.batchId, entry.id)}
                            disabled={!!saving}
                            title="Reverse this payment"
                            className="ml-3 shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40"
                          >
                            Reverse
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* footer */}
            <div className="border-t border-slate-200 px-6 py-4 dark:border-slate-800 flex gap-3">
              <Button className="flex-1" onClick={submitPayment} disabled={!!saving}>
                {saving?.startsWith("pay-") ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Log Payment
              </Button>
              <Button variant="outline" onClick={() => setSidebar(null)} className="dark:border-slate-700 dark:hover:bg-slate-800">Cancel</Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
