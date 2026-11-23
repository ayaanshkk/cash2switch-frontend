"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
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
  mpan_number?: string | null;
  payment_period_label?: string | null;
  payment_period_start?: string | null;
  payment_period_end?: string | null;
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
  /** null when paying all pending batches for an agent */
  batchId: string | null;
  /** set when paying all pending batches in one go */
  employeeId?: number | null;
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

  const [pendingAgent, setPendingAgent] = useState<string | null>(null);
  const [agentDropdownOpen, setAgentDropdownOpen] = useState(false);
  const [agentSearch, setAgentSearch] = useState("");
  // selection: agentName → Set of commission_payment_receipt_ids
  const [selectedItems, setSelectedItems] = useState<Record<string, Set<string>>>({});
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 20;
  const [statsModal, setStatsModal] = useState<"total" | "paid" | "partial" | "awaiting" | null>(null);
  const [paymentTrackerReceived, setPaymentTrackerReceived] = useState<number>(0);
  const [receivedModal, setReceivedModal] = useState(false);
  const [receivedModalLoading, setReceivedModalLoading] = useState(false);
  type ReceivedRow = { key: string; clientId: number | null; title: string; agent: string | null; supplier: string; mpan: string | null; expected: number; received: number; outstanding: number; status: string };
  const [receivedModalRows, setReceivedModalRows] = useState<ReceivedRow[]>([]);
  const [receivedModalPage, setReceivedModalPage] = useState(1);
  const [receivedModalAgentFilter, setReceivedModalAgentFilter] = useState<string>("all");
  const RECEIVED_PAGE_SIZE = 20;
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

  const filteredGroups: typeof agentGroups = [];

  const agentOptions = useMemo(() => {
    const q = agentSearch.trim().toLowerCase();
    return agentGroups
      .map((g) => g.agentName)
      .filter((name) => !q || name.toLowerCase().includes(q))
      .sort((a, b) => a.localeCompare(b));
  }, [agentGroups, agentSearch]);

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
      const [data, trackerData] = await Promise.all([
        fetchWithAuth(url),
        fetchWithAuth("/api/commission/clients-with-payments?page=1&page_size=1").catch(() => null),
      ]);
      setBatches(data.batches || []);
      setItems(data.items || []);
      setIsAdmin(Boolean(data.is_admin));
      setPaymentTrackerReceived(Number(trackerData?.summary?.received || 0));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  const openReceivedModal = async () => {
    setReceivedModal(true);
    setReceivedModalLoading(true);
    setReceivedModalRows([]);
    setReceivedModalPage(1);
    setReceivedModalAgentFilter("all");
    try {
      const statuses = ["Received", "Partially Paid", "Received - Written Off"];
      const results = await Promise.all(
        statuses.map((s) =>
          fetchWithAuth(`/api/commission/clients-with-payments?page=1&page_size=200&status=${encodeURIComponent(s)}`).catch(() => null)
        )
      );
      const rows: ReceivedRow[] = [];
      results.forEach((data, i) => {
        if (!data) return;
        for (const client of data.clients || []) {
          for (const p of client.payments) {
            rows.push({
              key: `${p.id}`,
              clientId: client.client_id ?? null,
              title: client.business_name || `Client #${client.client_id}`,
              agent: client.agent_name || null,
              supplier: client.supplier_name || "-",
              mpan: client.mpan_number || client.mpan_bottom || null,
              expected: Number(p.expected_net_amount || 0),
              received: Number(p.amount_received || 0),
              outstanding: Number(p.outstanding_amount || 0),
              status: p.status || statuses[i],
            });
          }
        }
      });
      setReceivedModalRows(rows);
    } catch {
      // non-fatal
    } finally {
      setReceivedModalLoading(false);
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

  function openPayAll(group: AgentGroup, pendingBatches: CommissionBatch[], totalOutstanding: number) {
    setSidebarError(null);
    if (pendingBatches.length === 1) {
      const batch = pendingBatches[0];
      const total = Number(batch.total_amount || 0);
      const alreadyPaid = Number(batch.amount_paid || 0);
      const outstanding = Math.max(total - alreadyPaid, 0);
      setSidebar({
        batchId: batch.id, agentName: batch.agent_name,
        batchTotal: total, alreadyPaid,
        prefilledAmount: outstanding,
        context: `Full commission payment`,
        receiptId: null,
        amountPaid: outstanding > 0 ? outstanding.toFixed(2) : "",
        paymentDate: todayIso(), notes: "",
      });
    } else {
      // Multiple pending batches — pay all in one go
      setSidebar({
        batchId: null,
        employeeId: group.employeeId,
        agentName: group.agentName,
        batchTotal: totalOutstanding,
        alreadyPaid: 0,
        prefilledAmount: totalOutstanding,
        context: `Full commission payment (${pendingBatches.length} months)`,
        receiptId: null,
        amountPaid: totalOutstanding > 0 ? totalOutstanding.toFixed(2) : "",
        paymentDate: todayIso(), notes: "",
      });
    }
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
    setSaving(`pay-${sidebar.batchId ?? sidebar.employeeId}`);
    try {
      if (!sidebar.batchId && sidebar.employeeId) {
        // Pay all pending batches for this agent
        await fetchWithAuth(`/api/commission/agents/${sidebar.employeeId}/pay-all-pending`, {
          method: "POST",
          body: JSON.stringify({ amount_paid: sidebar.amountPaid, payment_date: sidebar.paymentDate, notes: sidebar.notes || null }),
        });
      } else {
        await fetchWithAuth(`/api/commission/batches/${sidebar.batchId}/log-payment`, {
          method: "POST",
          body: JSON.stringify({ amount_paid: sidebar.amountPaid, payment_date: sidebar.paymentDate, notes: sidebar.notes || null, receipt_id: sidebar.receiptId || null }),
        });
      }
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
        if (!s || (s.batchId && s.batchId !== batchId)) return s;
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

  const downloadCustomStatement = async (agentName: string, receiptIds: string[]) => {
    const key = `dl-custom-${agentName}`;
    setSaving(key); setError(null);
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/commission/statement/custom`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_ids: receiptIds, agent_name: agentName }),
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: `commission-${agentName.replace(/\s+/g, "-")}-selected.pdf` }).click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed"); }
    finally { setSaving(null); }
  };

  /* ── selection helpers ── */
  const getSelected = (agentName: string): Set<string> => selectedItems[agentName] ?? new Set();

  const toggleItem = (agentName: string, receiptId: string) => {
    setSelectedItems((prev) => {
      const current = new Set(prev[agentName] ?? []);
      if (current.has(receiptId)) current.delete(receiptId); else current.add(receiptId);
      return { ...prev, [agentName]: current };
    });
  };

  const toggleAll = (agentName: string, receiptIds: string[]) => {
    setSelectedItems((prev) => {
      const current = prev[agentName] ?? new Set();
      const allSelected = receiptIds.every((id) => current.has(id));
      return { ...prev, [agentName]: allSelected ? new Set() : new Set(receiptIds) };
    });
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
      {/* Summary stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-6">
        {/* Agents */}
        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Agents</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-slate-950 dark:text-slate-50">{agentGroups.length}</CardContent>
        </Card>
        {/* Payment Received — after Agents, before Total Commission */}
        <Card onClick={openReceivedModal} className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:border-slate-400 hover:shadow-md transition-shadow dark:hover:border-slate-600">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Payment Received</CardTitle></CardHeader>
          <CardContent className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{money(paymentTrackerReceived)}</CardContent>
        </Card>
        {([
          { label: "Total Commission", value: money(adminTotals.total),    valueCls: "",                                               modalKey: "total" },
          { label: "Paid",             value: money(adminTotals.paid),     valueCls: "text-emerald-700 dark:text-emerald-400",         modalKey: "paid" },
          { label: "Partially Paid",   value: money(adminTotals.partial),  valueCls: "text-blue-700 dark:text-blue-400",               modalKey: "partial" },
          { label: "Awaiting",         value: money(adminTotals.awaiting), valueCls: "text-orange-700 dark:text-orange-400",           modalKey: "awaiting" },
        ] as { label: string; value: string; valueCls: string; modalKey: "total"|"paid"|"partial"|"awaiting" }[]).map(({ label, value, valueCls, modalKey }) => (
          <Card key={label} onClick={() => setStatsModal(modalKey)} className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:border-slate-400 hover:shadow-md transition-shadow dark:hover:border-slate-600">
            <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">{label}</CardTitle></CardHeader>
            <CardContent className={`text-2xl font-semibold text-slate-950 dark:text-slate-50 ${valueCls}`}>{value}</CardContent>
          </Card>
        ))}
      </div>

      {/* Agent selector + month filter + refresh */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
        <div className="relative w-72">
          <button
            type="button"
            onClick={() => { setAgentDropdownOpen((o) => !o); setAgentSearch(""); }}
            className="flex w-full items-center justify-between rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            <span className={pendingAgent ? "text-slate-900 dark:text-slate-50" : "text-slate-400 dark:text-slate-500"}>
              {pendingAgent ?? "Select agent…"}
            </span>
            <Search className="ml-2 h-4 w-4 shrink-0 text-slate-400" />
          </button>
          {pendingAgent && (
            <button
              type="button"
              onClick={() => { setPendingAgent(null); setSelectedAgent(null); }}
              className="absolute top-1/2 right-8 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              title="Clear"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
          {agentDropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setAgentDropdownOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-full rounded-md border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
                <div className="p-2 border-b border-slate-100 dark:border-slate-800">
                  <Input
                    autoFocus
                    placeholder="Search…"
                    value={agentSearch}
                    onChange={(e) => setAgentSearch(e.target.value)}
                    className="h-8 text-sm dark:border-slate-700 dark:bg-slate-950"
                  />
                </div>
                <ul className="max-h-56 overflow-y-auto py-1">
                  {agentOptions.length === 0 ? (
                    <li className="px-3 py-2 text-sm text-slate-400">No agents found</li>
                  ) : agentOptions.map((name) => (
                    <li key={name}>
                      <button
                        type="button"
                        onClick={() => { setPendingAgent(name); setAgentDropdownOpen(false); }}
                        className={`w-full px-3 py-2 text-left text-sm hover:bg-slate-100 dark:hover:bg-slate-800 ${pendingAgent === name ? "font-semibold text-slate-900 dark:text-slate-50" : "text-slate-700 dark:text-slate-300"}`}
                      >
                        {name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}
        </div>
        <Button
          disabled={!pendingAgent}
          onClick={() => {
            if (!pendingAgent) return;
            const group = agentGroups.find((g) => g.agentName === pendingAgent);
            if (group?.employeeId) {
              window.open(`/dashboard/payments/agent-commissions/agent/${group.employeeId}`, "_blank");
            }
          }}
        >
          View Records
        </Button>
        {pendingAgent && (
          <button
            type="button"
            onClick={() => { setPendingAgent(null); }}
            className="text-sm text-slate-500 underline hover:text-slate-700 dark:hover:text-slate-300"
          >
            Clear
          </button>
        )}
        </div>
      </div>

      {!pendingAgent && (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-slate-500">
          <p className="text-sm">Select an agent above to view their commission records.</p>
        </div>
      )}

      {filteredGroups.map((group) => {
        const pendingBatches   = group.batches.filter((b) => b.status !== "Commission Paid");
        const pendingBatch     = pendingBatches[0] ?? null;
        const anyBatch         = group.batches[0];
        const status           = agentStatusLabel(group);
        const outstanding      = pendingBatches.reduce((sum, b) =>
          sum + Math.max(Number(b.total_amount || 0) - Number(b.amount_paid || 0), 0), 0);
        const totalPaid        = group.batches.reduce((sum, b) => sum + Number(b.amount_paid || 0), 0);

        // Selection for this group
        const selectableIds  = group.items.map((i) => i.commission_payment_receipt_id).filter(Boolean) as string[];
        const selected       = getSelected(group.agentName);
        const selectedHere   = selectableIds.filter((id) => selected.has(id));
        const allChecked     = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
        const someChecked    = selectedHere.length > 0 && !allChecked;
        const selectedTotal  = group.items
          .filter((i) => i.commission_payment_receipt_id && selected.has(i.commission_payment_receipt_id))
          .reduce((s, i) => s + Number(i.commission_amount || 0), 0);
        const hasSelection   = selectedHere.length > 0;

        return (
          <Card key={group.agentName} className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle className="text-slate-950 dark:text-slate-50">{group.agentName}</CardTitle>
                <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {outstanding > 0 && (
                    <span>Outstanding: <span className="font-medium text-orange-700 dark:text-orange-400">{money(outstanding)}</span></span>
                  )}
                  {totalPaid > 0 && (
                    <span>Paid: <span className="font-medium text-emerald-700 dark:text-emerald-400">{money(totalPaid)}</span></span>
                  )}
                  {hasSelection && (
                    <span>Selected: <span className="font-medium text-blue-600 dark:text-blue-400">{money(selectedTotal)} ({selectedHere.length} item{selectedHere.length !== 1 ? "s" : ""})</span></span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge className={statusCls[status] ?? ""}>{status}</Badge>
                {outstanding > 0 && !hasSelection && (
                  <Button size="sm" onClick={() => openPayAll(group, pendingBatches, outstanding)} disabled={!!saving}>
                    Pay All ({money(outstanding)})
                  </Button>
                )}
                {hasSelection && outstanding > 0 && (
                  <Button size="sm" onClick={() => openPayAll(group, pendingBatches, selectedTotal)} disabled={!!saving}>
                    Pay Selected ({money(selectedTotal)})
                  </Button>
                )}
                {group.employeeId && (
                  <Button size="sm" variant="outline" onClick={() => window.open(`/dashboard/payments/agent-commissions/agent/${group.employeeId}`, "_blank")} className="dark:border-slate-700 dark:hover:bg-slate-800">
                    Overview
                  </Button>
                )}
                {hasSelection && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadCustomStatement(group.agentName, selectedHere)}
                    disabled={!!saving}
                    className="dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    {saving === `dl-custom-${group.agentName}` ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Statement ({selectedHere.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
                <table className="w-full min-w-[960px] text-sm">
                  <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                    <tr>
                      <th className="px-4 py-3 w-10">
                        <input
                          type="checkbox"
                          checked={allChecked}
                          ref={(el) => { if (el) el.indeterminate = someChecked; }}
                          onChange={() => toggleAll(group.agentName, selectableIds)}
                          className="h-4 w-4 rounded border-slate-300 accent-slate-800 cursor-pointer"
                          title="Select all"
                        />
                      </th>
                      <th className="px-4 py-3">Client</th>
                      <th className="px-4 py-3">MPAN/MPR</th>
                      <th className="px-4 py-3">Period</th>
                      <th className="px-4 py-3 text-right">Supplier Receipt</th>
                      <th className="px-4 py-3 text-right">Rate</th>
                      <th className="px-4 py-3 text-right">Commission</th>
                      <th className="px-4 py-3 text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                    {group.items.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE).map((item, idx) => {
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
                      const isChecked     = !!rid && selected.has(rid);

                      return (
                      <tr
                        key={item.id || `${item.client_name}-${idx}`}
                        className={`transition-colors ${isChecked ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"} ${item.batch_id ? "cursor-pointer" : ""}`}
                        onClick={() => item.batch_id && window.open(`/dashboard/payments/agent-commissions/batch/${item.batch_id}`, "_blank")}
                      >
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          {rid && (
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleItem(group.agentName, rid)}
                              className="h-4 w-4 rounded border-slate-300 accent-slate-800 cursor-pointer"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-100">
                          {item.client_name || "Client"}
                        </td>
                        <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{item.mpan_number || "-"}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {item.payment_period_label
                            ? <span className="font-medium text-slate-800 dark:text-slate-200">{item.payment_period_label}</span>
                            : "-"}
                          {(item.payment_period_start || item.payment_period_end) && (
                            <span className="block text-xs text-slate-400 dark:text-slate-500">
                              {item.payment_period_start} – {item.payment_period_end}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{money(item.receipt_amount)}</td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-950 dark:text-slate-100">{money(item.commission_amount)}</td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-1.5">
                            {rowFullyPaid ? (
                              <button
                                onClick={() => itemBatch && window.open(`/dashboard/payments/agent-commissions/batch/${itemBatch.id}`, "_blank")}
                                className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/80"
                              >
                                ✓ Paid
                              </button>
                            ) : rowPartlyPaid ? (
                              <button
                                onClick={() => itemBatch && window.open(`/dashboard/payments/agent-commissions/batch/${itemBatch.id}`, "_blank")}
                                className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950/80"
                              >
                                Part Paid
                              </button>
                            ) : itemBatch ? (
                              <button
                                onClick={() => window.open(`/dashboard/payments/agent-commissions/batch/${itemBatch.id}`, "_blank")}
                                className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
                              >
                                Pay
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                            {/* Per-row download — enabled once this receipt is paid */}
                            {rid && (rowFullyPaid || rowPartlyPaid) ? (
                              <button
                                onClick={() => downloadCustomStatement(group.agentName, [rid])}
                                disabled={!!saving}
                                title="Download statement for this record"
                                className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                              >
                                {saving === `dl-custom-${group.agentName}` ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Download className="h-3.5 w-3.5" />
                                )}
                              </button>
                            ) : (
                              <span className="inline-block w-[26px]" />
                            )}
                          </div>
                        </td>
                      </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Pagination */}
              {group.items.length > PAGE_SIZE && (() => {
                const totalPages = Math.ceil(group.items.length / PAGE_SIZE);
                const start = (currentPage - 1) * PAGE_SIZE + 1;
                const end   = Math.min(currentPage * PAGE_SIZE, group.items.length);
                return (
                  <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
                    <span className="text-xs text-slate-500 dark:text-slate-400">
                      Showing {start}–{end} of {group.items.length}
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        disabled={currentPage === 1}
                        onClick={() => setCurrentPage((p) => p - 1)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        ← Prev
                      </button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1)
                        .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                        .reduce<(number | "…")[]>((acc, p, i, arr) => {
                          if (i > 0 && (p as number) - (arr[i - 1] as number) > 1) acc.push("…");
                          acc.push(p);
                          return acc;
                        }, [])
                        .map((p, i) =>
                          p === "…" ? (
                            <span key={`ellipsis-${i}`} className="px-1 text-xs text-slate-400">…</span>
                          ) : (
                            <button
                              key={p}
                              onClick={() => setCurrentPage(p as number)}
                              className={`rounded-md border px-2.5 py-1 text-xs font-medium ${currentPage === p ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"}`}
                            >
                              {p}
                            </button>
                          )
                        )}
                      <button
                        disabled={currentPage === totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                        className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      >
                        Next →
                      </button>
                    </div>
                  </div>
                );
              })()}
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
          {!isAdmin && (
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 w-full sm:w-auto">
                <Input className="w-full sm:w-44 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
                {month && <Button variant="ghost" size="sm" onClick={() => setMonth("")} className="text-slate-500 hover:text-slate-900 dark:text-slate-400">All</Button>}
              </div>
              <Button variant="outline" onClick={() => load()} disabled={loading} className="dark:border-slate-800 dark:hover:bg-slate-800">
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>
          )}
        </div>

        {error   && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{error}</div>}
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">{message}</div>}

        {loading
          ? <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading…</div>
          : isAdmin ? renderAdminView() : renderAgentView()}
      </div>

      {/* ── stats drill-down modal ── */}
      {statsModal && (() => {
        const modalMeta: Record<string, { title: string; accentCls: string; emptyMsg: string }> = {
          total:   { title: "All Agents — Commission",    accentCls: "text-slate-900 dark:text-slate-50",              emptyMsg: "No agents found." },
          paid:    { title: "Agents — Fully Paid",        accentCls: "text-emerald-700 dark:text-emerald-400",         emptyMsg: "No fully paid agents." },
          partial: { title: "Agents — Partially Paid",    accentCls: "text-blue-700 dark:text-blue-400",               emptyMsg: "No partially paid agents." },
          awaiting:{ title: "Agents — Awaiting Payment",  accentCls: "text-orange-700 dark:text-orange-400",           emptyMsg: "No agents awaiting payment." },
        };
        const modalGroups = agentGroups.filter((g) => {
          const s = agentStatusLabel(g);
          if (statsModal === "total")   return true;
          if (statsModal === "paid")    return s === "Commission Paid";
          if (statsModal === "partial") return s === "Partially Paid";
          if (statsModal === "awaiting")return s === "Awaiting Payment";
          return false;
        });
        const { title, accentCls, emptyMsg } = modalMeta[statsModal];
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setStatsModal(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                {/* header */}
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
                  <button onClick={() => setStatsModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {/* list */}
                <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {modalGroups.length === 0 ? (
                    <li className="px-5 py-10 text-center text-sm text-slate-400">{emptyMsg}</li>
                  ) : modalGroups.map((g) => {
                    const outstanding = g.batches
                      .filter((b) => b.status !== "Commission Paid")
                      .reduce((s, b) => s + Math.max(Number(b.total_amount||0) - Number(b.amount_paid||0), 0), 0);
                    const totalPaid = g.batches.reduce((s, b) => s + Number(b.amount_paid||0), 0);
                    const st = agentStatusLabel(g);
                    const stCls = st === "Commission Paid" ? "text-emerald-700 dark:text-emerald-400"
                                : st === "Partially Paid"  ? "text-blue-700 dark:text-blue-400"
                                :                            "text-orange-700 dark:text-orange-400";
                    return (
                      <li key={g.agentName}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                          onClick={() => {
                            setPendingAgent(g.agentName);
                            setSelectedAgent(g.agentName);
                            setCurrentPage(1);
                            setStatsModal(null);
                          }}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{g.agentName}</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {outstanding > 0 && <span>Outstanding: <span className="font-medium text-orange-600 dark:text-orange-400">{money(outstanding)}</span></span>}
                              {outstanding > 0 && totalPaid > 0 && <span className="mx-1.5">·</span>}
                              {totalPaid > 0 && <span>Paid: <span className="font-medium text-emerald-700 dark:text-emerald-400">{money(totalPaid)}</span></span>}
                              {outstanding === 0 && totalPaid === 0 && <span>Total: <span className={`font-medium ${accentCls}`}>{money(g.total)}</span></span>}
                            </p>
                          </div>
                          <span className={`text-xs font-medium ${stCls}`}>{st}</span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>
          </>
        );
      })()}

      {/* ── payment received modal ── */}
      {receivedModal && (() => {
        const agentOptions = Array.from(new Set(receivedModalRows.map((r) => r.agent).filter(Boolean))) as string[];
        const filteredRows = receivedModalAgentFilter === "all"
          ? receivedModalRows
          : receivedModalRows.filter((r) => r.agent === receivedModalAgentFilter);
        const totalPages = Math.max(1, Math.ceil(filteredRows.length / RECEIVED_PAGE_SIZE));
        const pageRows = filteredRows.slice((receivedModalPage - 1) * RECEIVED_PAGE_SIZE, receivedModalPage * RECEIVED_PAGE_SIZE);
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setReceivedModal(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700 shrink-0">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">Payment Received</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Received · Partially Paid · Received — Written Off · Click a row to open payment history</p>
                  </div>
                  <button onClick={() => setReceivedModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                {agentOptions.length > 0 && (
                  <div className="flex items-center gap-3 border-b border-slate-200 dark:border-slate-700 px-5 py-3 shrink-0">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 whitespace-nowrap">Filter by Agent</label>
                    <select
                      value={receivedModalAgentFilter}
                      onChange={(e) => { setReceivedModalAgentFilter(e.target.value); setReceivedModalPage(1); }}
                      className="rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1.5 text-xs text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">All Agents</option>
                      {agentOptions.map((a) => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                )}
                <div className="overflow-y-auto flex-1">
                  {receivedModalLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-500">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
                    </div>
                  ) : receivedModalRows.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-400">No received payments found.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[800px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 sticky top-0">
                          <tr>
                            <th className="px-4 py-2.5">Client</th>
                            <th className="px-4 py-2.5">Agent</th>
                            <th className="px-4 py-2.5">Supplier</th>
                            <th className="px-4 py-2.5">MPAN/MPR</th>
                            <th className="px-4 py-2.5 text-right">Expected</th>
                            <th className="px-4 py-2.5 text-right">Received</th>
                            <th className="px-4 py-2.5 text-right">Outstanding</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {pageRows.map((row) => (
                            <tr
                              key={row.key}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                              onClick={() => row.clientId && window.open(`/dashboard/payments/history/${row.clientId}`, "_blank")}
                            >
                              <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{row.title}</td>
                              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{row.agent || <span className="text-slate-400">—</span>}</td>
                              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{row.supplier}</td>
                              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{row.mpan || "-"}</td>
                              <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">{money(row.expected)}</td>
                              <td className="px-4 py-2.5 text-right font-medium text-emerald-700 dark:text-emerald-400">{money(row.received)}</td>
                              <td className="px-4 py-2.5 text-right text-orange-700 dark:text-orange-400">{row.outstanding > 0 ? money(row.outstanding) : <span className="text-slate-400">—</span>}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  row.status === "Received" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : row.status === "Partially Paid" ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                                  : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                                }`}>{row.status}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
                {/* Pagination footer */}
                {!receivedModalLoading && filteredRows.length > RECEIVED_PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 px-5 py-3 shrink-0 text-sm text-slate-600 dark:text-slate-400">
                    <span>Page {receivedModalPage} of {totalPages} · {filteredRows.length} rows</span>
                    <div className="flex gap-2">
                      <button
                        disabled={receivedModalPage <= 1}
                        onClick={() => setReceivedModalPage((p) => p - 1)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >Previous</button>
                      <button
                        disabled={receivedModalPage >= totalPages}
                        onClick={() => setReceivedModalPage((p) => p + 1)}
                        className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed"
                      >Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

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
                            onClick={() => sidebar.batchId && reversePayment(sidebar.batchId, entry.id)}
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
