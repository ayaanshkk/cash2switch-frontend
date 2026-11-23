"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Download, Eye, Loader2, RefreshCcw, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_BASE_URL, fetchWithAuth } from "@/lib/api";

/* ── types ── */
type CommissionItem = {
  id?: string;
  client_name: string | null;
  agent_name: string;
  employee_id?: number | null;
  mpan_number?: string | null;
  payment_period_label?: string | null;
  payment_period_start?: string | null;
  payment_period_end?: string | null;
  receipt_amount?: string;
  commission_rate: string;
  commission_amount: string;
  batch_id?: string | null;
  commission_payment_receipt_id?: string | null;
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
  agent_name: string;
  batch_month: string;
  total_amount: string;
  amount_paid?: string;
  payment_log?: PaymentLogEntry[];
  status: string;
  paid_at: string | null;
  items: CommissionItem[];
};

type Sidebar = {
  batchId: string | null;
  employeeId?: number | null;
  agentName: string;
  batchTotal: number;
  alreadyPaid: number;
  prefilledAmount?: number;
  context: string;
  receiptId: string | null;
  amountPaid: string;
  paymentDate: string;
  notes: string;
};

/* ── helpers ── */
const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const money = (v: number | string | null | undefined) => fmt.format(Number(String(v || "0").replace(/[£,]/g, "")));
const todayIso = () => new Date().toISOString().slice(0, 10);
const PAGE_SIZE = 20;

const statusCls: Record<string, string> = {
  "Awaiting Payment": "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300",
  "Partially Paid":   "bg-blue-100 text-blue-800 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300",
  "Commission Paid":  "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300",
};

export default function AgentOverviewPage() {
  const params = useParams();
  const router = useRouter();
  const employeeId = params?.employeeId as string;

  const [items, setItems]     = useState<CommissionItem[]>([]);
  const [batches, setBatches] = useState<CommissionBatch[]>([]);
  const [agentName, setAgentName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState<string | null>(null);
  const [error, setError]     = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const msgTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [sidebar, setSidebar]           = useState<Sidebar | null>(null);
  const [sidebarError, setSidebarError] = useState<string | null>(null);
  const amountRef = useRef<HTMLInputElement>(null);

  const [selected, setSelected]       = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [cardModal, setCardModal]     = useState<"paid" | "outstanding" | null>(null);
  const [activeTab, setActiveTab]     = useState<"commissions" | "payment-history" | "statements">("commissions");

  type SavedStatement = { id: string; agent_name: string; generated_by_name: string; generated_at: string; file_name: string; receipt_count: number; total_commission: number; batch_id: string | null };
  const [statements, setStatements]           = useState<SavedStatement[]>([]);
  const [statementsLoading, setStatementsLoading] = useState(false);
  const [stmtDownloading, setStmtDownloading] = useState<string | null>(null);

  type SalesRow = { key: string; clientId: number | null; title: string; supplier: string; mpan: string | null; expected: number; received: number; outstanding: number; status: string };
  const [salesModal, setSalesModal]           = useState(false);
  const [salesModalLoading, setSalesModalLoading] = useState(false);
  const [salesModalRows, setSalesModalRows]   = useState<SalesRow[]>([]);
  const [salesModalPage, setSalesModalPage]   = useState(1);
  const SALES_PAGE_SIZE = 20;

  const showMsg = (msg: string) => {
    setMessage(msg);
    if (msgTimer.current) clearTimeout(msgTimer.current);
    msgTimer.current = setTimeout(() => setMessage(null), 4000);
  };

  /* ── open sales modal ── */
  const openSalesModal = async () => {
    setSalesModal(true);
    setSalesModalLoading(true);
    setSalesModalRows([]);
    setSalesModalPage(1);
    try {
      const statuses = ["Received", "Partially Paid", "Received - Written Off"];
      const results = await Promise.all(
        statuses.map((s) =>
          fetchWithAuth(`/api/commission/clients-with-payments?page=1&page_size=500&status=${encodeURIComponent(s)}`).catch(() => null)
        )
      );
      const rows: SalesRow[] = [];
      results.forEach((data, i) => {
        if (!data) return;
        for (const client of data.clients || []) {
          if ((client.agent_name || "").toLowerCase() !== agentName.toLowerCase()) continue;
          for (const p of client.payments) {
            rows.push({
              key: `${p.id}`,
              clientId: client.client_id ?? null,
              title: client.business_name || `Client #${client.client_id}`,
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
      setSalesModalRows(rows);
    } catch { /* non-fatal */ }
    finally { setSalesModalLoading(false); }
  };

  /* ── load ── */
  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchWithAuth(`/api/commission/agent-commissions?employee_id=${employeeId}`);
      const allItems: CommissionItem[]   = data.items   || [];
      const allBatches: CommissionBatch[] = data.batches || [];
      setItems(allItems);
      setBatches(allBatches);
      setAgentName(allBatches[0]?.agent_name || allItems[0]?.agent_name || "Agent");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStatements = async (name: string) => {
    setStatementsLoading(true);
    try {
      const data = await fetchWithAuth(`/api/commission/statements?per_page=100&agent_name=${encodeURIComponent(name)}`);
      setStatements(data.statements || []);
    } catch { /* silent */ }
    finally { setStatementsLoading(false); }
  };

  useEffect(() => { if (agentName) loadStatements(agentName); }, [agentName]); // eslint-disable-line react-hooks/exhaustive-deps

  const getStatementUrl = async (id: string): Promise<string | null> => {
    const data = await fetchWithAuth(`/api/commission/statements/${id}/download`);
    return data.download_url as string | null;
  };

  const downloadSavedStatement = async (id: string, fileName: string) => {
    if (stmtDownloading) return;
    setStmtDownloading(id);
    try {
      const url = await getStatementUrl(id);
      if (!url) throw new Error("No URL");
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.target = "_blank";
      a.click();
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed"); }
    finally { setStmtDownloading(null); }
  };

  const viewSavedStatement = async (id: string) => {
    if (stmtDownloading) return;
    setStmtDownloading(id);
    try {
      const url = await getStatementUrl(id);
      if (url) window.open(url, "_blank");
    } catch (e) { setError(e instanceof Error ? e.message : "Could not open statement"); }
    finally { setStmtDownloading(null); }
  };

  /* focus amount field when sidebar opens */
  const prevBatchIdRef = useRef<string | null>(null);
  useEffect(() => {
    const newId = sidebar?.batchId ?? null;
    if (newId && newId !== prevBatchIdRef.current) setTimeout(() => amountRef.current?.focus(), 60);
    prevBatchIdRef.current = newId;
  }, [sidebar?.batchId]);

  /* ── derived totals ── */
  const totals = useMemo(() => {
    const totalSales      = items.reduce((s, i) => s + Number(String(i.receipt_amount   || "0").replace(/[£,]/g, "")), 0);
    const totalCommission = items.reduce((s, i) => s + Number(String(i.commission_amount || "0").replace(/[£,]/g, "")), 0);
    const paid            = batches.reduce((s, b) => s + Number(String(b.amount_paid    || "0").replace(/[£,]/g, "")), 0);
    const outstanding     = batches
      .filter((b) => b.status !== "Commission Paid")
      .reduce((s, b) => s + Math.max(Number(String(b.total_amount || "0").replace(/[£,]/g, "")) - Number(String(b.amount_paid || "0").replace(/[£,]/g, "")), 0), 0);
    return { totalSales, totalCommission, paid, outstanding };
  }, [items, batches]);

  const overallStatus = useMemo(() => {
    if (batches.some((b) => b.status === "Awaiting Payment") || items.some((i) => !i.batch_id)) return "Awaiting Payment";
    if (batches.some((b) => b.status === "Partially Paid")) return "Partially Paid";
    if (batches.length > 0 && batches.every((b) => b.status === "Commission Paid")) return "Commission Paid";
    return "Awaiting Payment";
  }, [batches, items]);

  /* ── pending batches ── */
  const pendingBatches = useMemo(() => batches.filter((b) => b.status !== "Commission Paid"), [batches]);

  /* ── paginated items ── */
  const filteredItems = items;

  const totalPages  = Math.max(1, Math.ceil(filteredItems.length / PAGE_SIZE));
  const pageItems   = filteredItems.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  /* ── selection ── */
  const selectableIds = filteredItems.map((i) => i.commission_payment_receipt_id).filter(Boolean) as string[];
  const selectedHere  = selectableIds.filter((id) => selected.has(id));
  const allChecked    = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someChecked   = selectedHere.length > 0 && !allChecked;
  const selectedTotal = filteredItems
    .filter((i) => i.commission_payment_receipt_id && selected.has(i.commission_payment_receipt_id))
    .reduce((s, i) => s + Number(String(i.commission_amount || "0").replace(/[£,]/g, "")), 0);
  const hasSelection  = selectedHere.length > 0;

  // Only receipt IDs in the selection that have at least one payment logged
  const paidSelectedIds = useMemo(() => {
    return selectedHere.filter((rid) => {
      const item = filteredItems.find((i) => i.commission_payment_receipt_id === rid);
      if (!item?.batch_id) return false;
      const batch = batches.find((b) => b.id === item.batch_id);
      if (!batch) return false;
      if (batch.status === "Commission Paid") return true;
      const log = batch.payment_log ?? [];
      return log.some((e) => Number(e.amount || 0) > 0);
    });
  }, [selectedHere, filteredItems, batches]);

  const toggleItem = (rid: string) => {
    setSelected((prev) => { const n = new Set(prev); n.has(rid) ? n.delete(rid) : n.add(rid); return n; });
  };
  const toggleAll = () => {
    setSelected((prev) => {
      const all = selectableIds.every((id) => prev.has(id));
      if (all) { const n = new Set(prev); selectableIds.forEach((id) => n.delete(id)); return n; }
      return new Set([...prev, ...selectableIds]);
    });
  };

  /* ── sidebar helpers ── */
  const openPayAll = () => {
    setSidebarError(null);
    const totalOutstanding = totals.outstanding;
    if (pendingBatches.length === 1) {
      const b = pendingBatches[0];
      const total = Number(String(b.total_amount || "0").replace(/[£,]/g, ""));
      const paid  = Number(String(b.amount_paid  || "0").replace(/[£,]/g, ""));
      const out   = Math.max(total - paid, 0);
      setSidebar({ batchId: b.id, agentName, batchTotal: total, alreadyPaid: paid, prefilledAmount: out, context: "Full commission payment", receiptId: null, amountPaid: out > 0 ? out.toFixed(2) : "", paymentDate: todayIso(), notes: "" });
    } else {
      setSidebar({ batchId: null, employeeId: Number(employeeId), agentName, batchTotal: totalOutstanding, alreadyPaid: 0, prefilledAmount: totalOutstanding, context: `Full commission payment (${pendingBatches.length} months)`, receiptId: null, amountPaid: totalOutstanding > 0 ? totalOutstanding.toFixed(2) : "", paymentDate: todayIso(), notes: "" });
    }
  };

  const openPaySelected = () => {
    setSidebarError(null);
    const pendingBatch = pendingBatches[0] ?? null;
    const total = pendingBatch ? Number(String(pendingBatch.total_amount || "0").replace(/[£,]/g, "")) : selectedTotal;
    const paid  = pendingBatch ? Number(String(pendingBatch.amount_paid  || "0").replace(/[£,]/g, "")) : 0;
    setSidebar({ batchId: pendingBatch?.id ?? null, employeeId: Number(employeeId), agentName, batchTotal: total, alreadyPaid: paid, prefilledAmount: selectedTotal, context: `${selectedHere.length} selected item${selectedHere.length !== 1 ? "s" : ""}`, receiptId: null, amountPaid: selectedTotal > 0 ? selectedTotal.toFixed(2) : "", paymentDate: todayIso(), notes: "" });
  };

  const openPayItem = (item: CommissionItem) => {
    const itemBatch = item.batch_id ? batches.find((b) => b.id === item.batch_id) ?? null : null;
    if (!itemBatch) return;
    const total     = Number(String(itemBatch.total_amount || "0").replace(/[£,]/g, ""));
    const paid      = Number(String(itemBatch.amount_paid  || "0").replace(/[£,]/g, ""));
    const itemAmt   = Number(String(item.commission_amount || "0").replace(/[£,]/g, ""));
    const rid       = item.commission_payment_receipt_id ?? null;
    const log       = itemBatch.payment_log ?? [];
    const paidForRow = log.filter((e) => e.receipt_id === rid).reduce((s, e) => s + Number(e.amount || 0), 0);
    const remaining = Math.max(itemAmt - paidForRow, 0);
    setSidebarError(null);
    // Use per-row totals so the sidebar correctly shows "Fully paid" when paying just this row's commission
    setSidebar({ batchId: itemBatch.id, agentName, batchTotal: itemAmt, alreadyPaid: paidForRow, prefilledAmount: remaining, context: `${item.client_name || "Client"} — ${money(item.commission_amount)}`, receiptId: rid, amountPaid: remaining.toFixed(2), paymentDate: todayIso(), notes: "" });
  };

  /* ── submit payment ── */
  const submitPayment = async () => {
    if (!sidebar) return;
    setSidebarError(null);
    const amt = Number(sidebar.amountPaid);
    if (!sidebar.amountPaid || isNaN(amt) || amt <= 0) { setSidebarError("Enter a valid amount."); return; }
    setSaving(`pay-${sidebar.batchId ?? sidebar.employeeId}`);
    try {
      if (!sidebar.batchId && sidebar.employeeId) {
        await fetchWithAuth(`/api/commission/agents/${sidebar.employeeId}/pay-all-pending`, { method: "POST", body: JSON.stringify({ amount_paid: sidebar.amountPaid, payment_date: sidebar.paymentDate, notes: sidebar.notes || null }) });
      } else {
        await fetchWithAuth(`/api/commission/batches/${sidebar.batchId}/log-payment`, { method: "POST", body: JSON.stringify({ amount_paid: sidebar.amountPaid, payment_date: sidebar.paymentDate, notes: sidebar.notes || null, receipt_id: sidebar.receiptId || null }) });
      }
      showMsg(`Payment of ${money(amt)} logged.`);
      setSidebar(null);
      await load();
    } catch (e) { setSidebarError(e instanceof Error ? e.message : "Failed to log payment"); }
    finally { setSaving(null); }
  };

  /* ── reverse payment ── */
  const reversePayment = async (batchId: string, logEntryId: string) => {
    setSidebarError(null);
    setSaving(`rev-${logEntryId}`);
    try {
      await fetchWithAuth(`/api/commission/batches/${batchId}/reverse-payment`, { method: "POST", body: JSON.stringify({ log_entry_id: logEntryId }) });
      showMsg("Payment reversed.");
      await load();
    } catch (e) { setSidebarError(e instanceof Error ? e.message : "Failed to reverse"); }
    finally { setSaving(null); }
  };

  /* ── download custom statement ── */
  const downloadCustomStatement = async (receiptIds: string[]) => {
    const key = `dl-custom-${agentName}`;
    setSaving(key); setError(null);
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/commission/statement/custom`, { method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, body: JSON.stringify({ receipt_ids: receiptIds, agent_name: agentName }) });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: `commission-${agentName.replace(/\s+/g, "-")}-selected.pdf` }).click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed"); }
    finally { setSaving(null); }
  };

  /* ── sidebar live preview ── */
  const enteredAmt   = Number(sidebar?.amountPaid || 0);
  const alreadyPaid  = sidebar?.alreadyPaid ?? 0;
  const batchTotal   = sidebar?.batchTotal ?? 0;
  const newTotalPaid = alreadyPaid + enteredAmt;
  const remaining    = Math.max(batchTotal - newTotalPaid, 0);
  const willBeFull   = newTotalPaid >= batchTotal && enteredAmt > 0;


  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">

        {/* ── header ── */}
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => router.back()} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Agent Commissions</p>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
                {loading ? "Loading…" : agentName}
              </h1>
              <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-400">All-time commission overview</p>
            </div>
          </div>
          <Button variant="outline" onClick={load} disabled={loading} className="dark:border-slate-700 dark:hover:bg-slate-800">
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </div>

        {error   && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{error}</div>}
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">{message}</div>}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading…</div>
        ) : (
          <>
            {/* ── stat cards ── */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {/* Total Sales — clickable → modal */}
              <Card
                onClick={openSalesModal}
                className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all dark:hover:border-slate-700"
              >
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Sales</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-slate-950 dark:text-slate-50">{money(totals.totalSales)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Supplier receipts</p>
                </CardContent>
              </Card>
              {/* Total Commission */}
              <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Total Commission</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-teal-600 dark:text-teal-400">{money(totals.totalCommission)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">All time</p>
                </CardContent>
              </Card>
              {/* Paid — clickable → modal */}
              <Card
                onClick={() => setCardModal("paid")}
                className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all dark:hover:border-slate-700"
              >
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Paid</CardTitle></CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold text-emerald-700 dark:text-emerald-400">{money(totals.paid)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Commission paid out</p>
                </CardContent>
              </Card>
              {/* Outstanding — clickable → modal */}
              <Card
                onClick={() => setCardModal("outstanding")}
                className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900 cursor-pointer hover:border-slate-300 hover:shadow-md transition-all dark:hover:border-slate-700"
              >
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">Outstanding</CardTitle></CardHeader>
                <CardContent>
                  <p className={`text-2xl font-semibold ${totals.outstanding > 0 ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`}>{money(totals.outstanding)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Still to be paid</p>
                </CardContent>
              </Card>
            </div>

            {/* ── tabbed card ── */}
            <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              {/* Tab bar + actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 dark:border-slate-800 px-5 pt-4 pb-0">
                <div className="flex gap-1">
                  {(["commissions", "payment-history", "statements"] as const).map((tab) => {
                    const allLogEntries = batches.flatMap((b) => (b.payment_log ?? []).map((e) => ({ ...e, batchId: b.id })));
                    const label = tab === "commissions" ? "Commissions" : tab === "payment-history" ? "Payment History" : "Statements";
                    const badge = tab === "payment-history" && allLogEntries.length > 0
                      ? allLogEntries.length
                      : tab === "statements" && statements.length > 0
                      ? statements.length
                      : null;
                    return (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
                          activeTab === tab
                            ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
                            : "border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                        }`}
                      >
                        {label}
                        {badge !== null && (
                          <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 px-1 text-xs font-semibold text-slate-700 dark:text-slate-300">{badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
                {activeTab === "commissions" && (
                  <div className="flex flex-wrap gap-2 items-center pb-3 ml-auto">
                    <Badge className={statusCls[overallStatus] ?? ""}>{overallStatus}</Badge>
                    {totals.outstanding > 0 && !hasSelection && (
                      <Button size="sm" onClick={openPayAll} disabled={!!saving}>
                        Pay All ({money(totals.outstanding)})
                      </Button>
                    )}
                    {hasSelection && totals.outstanding > 0 && (
                      <Button size="sm" onClick={openPaySelected} disabled={!!saving}>
                        Pay Selected ({money(selectedTotal)})
                      </Button>
                    )}
                    {hasSelection && (
                      <span className="text-sm text-slate-500 dark:text-slate-400">Selected: <span className="font-medium text-blue-600 dark:text-blue-400">{money(selectedTotal)}</span></span>
                    )}
                    {paidSelectedIds.length > 0 && (
                      <Button size="sm" variant="outline" onClick={() => downloadCustomStatement(paidSelectedIds)} disabled={!!saving} className="dark:border-slate-700 dark:hover:bg-slate-800">
                        {saving === `dl-custom-${agentName}` ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Statement ({paidSelectedIds.length})
                      </Button>
                    )}
                  </div>
                )}
              </div>

              <CardContent className="p-0">
                {/* ── statements tab ── */}
                {activeTab === "statements" && (
                  <div className="overflow-x-auto">
                    {statementsLoading ? (
                      <div className="flex items-center justify-center py-12 text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading…</div>
                    ) : statements.length === 0 ? (
                      <p className="py-12 text-center text-sm text-slate-400">No statements downloaded yet for {agentName}.</p>
                    ) : (
                      <table className="w-full text-sm min-w-[600px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700">
                          <tr>
                            <th className="px-4 py-3">Generated</th>
                            <th className="px-4 py-3">By</th>
                            <th className="px-4 py-3 text-right">Items</th>
                            <th className="px-4 py-3 text-right">Commission</th>
                            <th className="px-4 py-3 text-center">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {statements.map((s) => (
                            <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                              <td className="px-4 py-3 text-slate-700 dark:text-slate-300">
                                {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(s.generated_at))}
                              </td>
                              <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{s.generated_by_name || "—"}</td>
                              <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-400">{s.receipt_count}</td>
                              <td className="px-4 py-3 text-right font-semibold text-teal-600 dark:text-teal-400">{money(s.total_commission)}</td>
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex items-center gap-2">
                                  <button
                                    onClick={() => viewSavedStatement(s.id)}
                                    disabled={!!stmtDownloading}
                                    title="View PDF"
                                    className="inline-flex items-center justify-center rounded-md border border-slate-200 dark:border-slate-700 p-1.5 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                                  >
                                    {stmtDownloading === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
                                  </button>
                                  <button
                                    onClick={() => downloadSavedStatement(s.id, s.file_name)}
                                    disabled={!!stmtDownloading}
                                    title="Download"
                                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"
                                  >
                                    <Download className="h-3.5 w-3.5" />
                                    Download
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}

                {/* ── payment history tab ── */}
                {activeTab === "payment-history" && (() => {
                  const allEntries = batches.flatMap((b) =>
                    (b.payment_log ?? []).map((e) => ({ ...e, batchId: b.id, batchMonth: b.batch_month }))
                  ).sort((a, b) => new Date(b.logged_at).getTime() - new Date(a.logged_at).getTime());
                  return allEntries.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-400">No payments logged yet for {agentName}.</p>
                  ) : (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {allEntries.map((entry) => (
                        <div key={entry.id} className="flex items-start justify-between px-5 py-4">
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(Number(entry.amount || 0))}</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.logged_at))}
                            </p>
                            {entry.notes && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400"><span className="font-medium text-slate-400 dark:text-slate-500">Note:</span> {entry.notes}</p>}
                          </div>
                          <button
                            onClick={() => reversePayment(entry.batchId, entry.id)}
                            disabled={!!saving}
                            className="ml-4 shrink-0 inline-flex items-center gap-1.5 rounded-md border border-red-200 dark:border-red-800 px-2.5 py-1 text-xs font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40"
                          >
                            {saving === `rev-${entry.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
                            Reverse
                          </button>
                        </div>
                      ))}
                    </div>
                  );
                })()}

                {/* ── commissions tab ── */}
                {activeTab === "commissions" && (
                <>
                <div className="overflow-x-auto border-t border-slate-200 dark:border-slate-800">
                  <table className="w-full min-w-[960px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500 uppercase dark:bg-slate-800/60 dark:text-slate-400">
                      <tr>
                        <th className="px-4 py-3 w-10">
                          <input type="checkbox" checked={allChecked} ref={(el) => { if (el) el.indeterminate = someChecked; }} onChange={toggleAll} className="h-4 w-4 rounded border-slate-300 accent-slate-800 cursor-pointer" title="Select all" />
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
                      {pageItems.length === 0 ? (
                        <tr><td colSpan={8} className="px-4 py-12 text-center text-slate-500">No records found.</td></tr>
                      ) : pageItems.map((item, idx) => {
                        const itemBatch  = item.batch_id ? batches.find((b) => b.id === item.batch_id) ?? null : null;
                        const rid        = item.commission_payment_receipt_id;
                        const log        = itemBatch?.payment_log ?? [];
                        const paidForRow = log.filter((e) => e.receipt_id === rid).reduce((s, e) => s + Number(e.amount || 0), 0);
                        const rowAmt     = Number(String(item.commission_amount || "0").replace(/[£,]/g, ""));
                        const rowFull    = rid && paidForRow >= rowAmt && rowAmt > 0;
                        const rowPartial = rid && paidForRow > 0 && !rowFull;
                        const isChecked  = !!rid && selected.has(rid);
                        return (
                          <tr
                            key={item.id || `${item.client_name}-${idx}`}
                            className={`transition-colors ${isChecked ? "bg-blue-50 dark:bg-blue-950/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}
                          >
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              {rid && <input type="checkbox" checked={isChecked} onChange={() => toggleItem(rid)} className="h-4 w-4 rounded border-slate-300 accent-slate-800 cursor-pointer" />}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-950 dark:text-slate-100">{item.client_name || "Client"}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{item.mpan_number || "—"}</td>
                            <td className="px-4 py-3 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                              {item.payment_period_label
                                ? <span className="font-medium text-slate-800 dark:text-slate-200">{item.payment_period_label}</span>
                                : "—"}
                              {(item.payment_period_start || item.payment_period_end) && (
                                <span className="block text-xs text-slate-400">{item.payment_period_start} – {item.payment_period_end}</span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{money(item.receipt_amount)}</td>
                            <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-950 dark:text-slate-100">{money(item.commission_amount)}</td>
                            <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-center gap-1.5">
                                {rowFull ? (
                                  <button onClick={() => openPayItem(item)} className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/80">✓ Paid</button>
                                ) : rowPartial ? (
                                  <button onClick={() => openPayItem(item)} className="rounded-md bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-700 hover:bg-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950/80">Part Paid</button>
                                ) : itemBatch ? (
                                  <button onClick={() => openPayItem(item)} className="rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">Pay</button>
                                ) : (
                                  <span className="text-xs text-slate-400">—</span>
                                )}
                                {rid && (rowFull || rowPartial) ? (
                                  <button onClick={() => downloadCustomStatement([rid])} disabled={!!saving} title="Download statement" className="rounded-md border border-slate-200 p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">
                                    {saving === `dl-custom-${agentName}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                  </button>
                                ) : <span className="inline-block w-[26px]" />}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── pagination ── */}
                {filteredItems.length > PAGE_SIZE && (() => {
                  const start = (currentPage - 1) * PAGE_SIZE + 1;
                  const end   = Math.min(currentPage * PAGE_SIZE, filteredItems.length);
                  return (
                    <div className="flex items-center justify-between border-t border-slate-200 px-5 py-3 dark:border-slate-800">
                      <span className="text-xs text-slate-500 dark:text-slate-400">Showing {start}–{end} of {filteredItems.length}</span>
                      <div className="flex items-center gap-1">
                        <button disabled={currentPage === 1} onClick={() => setCurrentPage((p) => p - 1)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">← Prev</button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1)
                          .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                          .reduce<(number | "…")[]>((acc, p, i, arr) => { if (i > 0 && (p as number) - (arr[i-1] as number) > 1) acc.push("…"); acc.push(p); return acc; }, [])
                          .map((p, i) => p === "…"
                            ? <span key={`e-${i}`} className="px-1 text-xs text-slate-400">…</span>
                            : <button key={p} onClick={() => setCurrentPage(p as number)} className={`rounded-md border px-2.5 py-1 text-xs font-medium ${currentPage === p ? "border-slate-800 bg-slate-800 text-white dark:border-slate-200 dark:bg-slate-200 dark:text-slate-900" : "border-slate-200 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"}`}>{p}</button>
                          )}
                        <button disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => p + 1)} className="rounded-md border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800">Next →</button>
                      </div>
                    </div>
                  );
                })()}
                </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* ── sales modal ── */}
      {salesModal && (() => {
        const totalSalesPages = Math.max(1, Math.ceil(salesModalRows.length / SALES_PAGE_SIZE));
        const salesPageRows   = salesModalRows.slice((salesModalPage - 1) * SALES_PAGE_SIZE, salesModalPage * SALES_PAGE_SIZE);
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setSalesModal(false)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-6xl max-h-[90vh] flex flex-col rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700 shrink-0">
                  <div>
                    <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{agentName} — Sales</h2>
                    <p className="text-xs text-slate-500 mt-0.5">Received · Partially Paid · Received — Written Off · Click a row to open payment history</p>
                  </div>
                  <button onClick={() => setSalesModal(false)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <div className="overflow-y-auto flex-1">
                  {salesModalLoading ? (
                    <div className="flex items-center justify-center py-16 text-slate-500">
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
                    </div>
                  ) : salesModalRows.length === 0 ? (
                    <p className="py-12 text-center text-sm text-slate-400">No received payments found for {agentName}.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm min-w-[700px]">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 dark:border-slate-700 sticky top-0">
                          <tr>
                            <th className="px-4 py-2.5">Client</th>
                            <th className="px-4 py-2.5">Supplier</th>
                            <th className="px-4 py-2.5">MPAN/MPR</th>
                            <th className="px-4 py-2.5 text-right">Expected</th>
                            <th className="px-4 py-2.5 text-right">Received</th>
                            <th className="px-4 py-2.5 text-right">Outstanding</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {salesPageRows.map((row) => (
                            <tr
                              key={row.key}
                              className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                              onClick={() => row.clientId && window.open(`/dashboard/payments/history/${row.clientId}`, "_blank")}
                            >
                              <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">{row.title}</td>
                              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{row.supplier}</td>
                              <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{row.mpan || "—"}</td>
                              <td className="px-4 py-2.5 text-right text-slate-700 dark:text-slate-300">{money(row.expected)}</td>
                              <td className="px-4 py-2.5 text-right font-medium text-emerald-700 dark:text-emerald-400">{money(row.received)}</td>
                              <td className="px-4 py-2.5 text-right text-orange-700 dark:text-orange-400">{row.outstanding > 0 ? money(row.outstanding) : <span className="text-slate-400">—</span>}</td>
                              <td className="px-4 py-2.5">
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                                  row.status === "Received"           ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
                                  : row.status === "Partially Paid"  ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
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
                {!salesModalLoading && salesModalRows.length > SALES_PAGE_SIZE && (
                  <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-700 px-5 py-3 shrink-0 text-sm text-slate-600 dark:text-slate-400">
                    <span>Page {salesModalPage} of {totalSalesPages} · {salesModalRows.length} rows</span>
                    <div className="flex gap-2">
                      <button disabled={salesModalPage <= 1} onClick={() => setSalesModalPage((p) => p - 1)} className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">Previous</button>
                      <button disabled={salesModalPage >= totalSalesPages} onClick={() => setSalesModalPage((p) => p + 1)} className="rounded-md border border-slate-200 dark:border-slate-700 px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed">Next</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        );
      })()}

      {/* ── paid / outstanding modal ── */}
      {cardModal && (() => {
        const isPaid = cardModal === "paid";
        const modalBatches = isPaid
          ? batches.filter((b) => b.status === "Commission Paid")
          : batches.filter((b) => b.status !== "Commission Paid");
        const title    = isPaid ? "Paid Batches" : "Outstanding Batches";
        const emptyMsg = isPaid ? "No paid batches yet." : "No outstanding batches.";
        const fmtMonth = (v?: string | null) => {
          if (!v) return "—";
          try { return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" }).format(new Date(v + "-01")); }
          catch { return v; }
        };
        return (
          <>
            <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm" onClick={() => setCardModal(null)} />
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
                  <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{agentName} — {title}</h2>
                  <button onClick={() => setCardModal(null)} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800">
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <ul className="max-h-[60vh] overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {modalBatches.length === 0 ? (
                    <li className="px-5 py-10 text-center text-sm text-slate-400">{emptyMsg}</li>
                  ) : modalBatches.map((b) => {
                    const total = Number(String(b.total_amount || "0").replace(/[£,]/g, ""));
                    const paid  = Number(String(b.amount_paid  || "0").replace(/[£,]/g, ""));
                    const out   = Math.max(total - paid, 0);
                    return (
                      <li key={b.id}>
                        <button
                          type="button"
                          className="flex w-full items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                          onClick={() => { setCardModal(null); setActiveTab("commissions"); }}
                        >
                          <div>
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-50">{fmtMonth(b.batch_month)}</p>
                            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                              Commission: <span className="font-medium text-slate-700 dark:text-slate-300">{money(total)}</span>
                              {paid > 0 && <> · Paid: <span className="font-medium text-emerald-600 dark:text-emerald-400">{money(paid)}</span></>}
                              {out > 0  && <> · Outstanding: <span className="font-medium text-orange-600 dark:text-orange-400">{money(out)}</span></>}
                            </p>
                          </div>
                          <span className={`ml-3 shrink-0 inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusCls[b.status] ?? "bg-slate-100 text-slate-600"}`}>
                            {b.status === "Commission Paid" ? "Paid" : b.status === "Partially Paid" ? "Partial" : "Awaiting"}
                          </span>
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

      {/* ── payment sidebar ── */}
      {sidebar && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm" onClick={() => setSidebar(null)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-white shadow-2xl dark:bg-slate-900">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-5 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">{sidebar.alreadyPaid >= sidebar.batchTotal && sidebar.batchTotal > 0 ? "Payment History" : "Make Payment"}</h2>
                <p className="mt-0.5 text-sm font-medium text-slate-700 dark:text-slate-300">{sidebar.agentName}</p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{sidebar.context}</p>
              </div>
              <button onClick={() => setSidebar(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Amount <span className="text-red-500">*</span></label>
                <div className="relative">
                  <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-500">£</span>
                  <Input ref={amountRef} type="number" step="0.01" min="0.01" placeholder="0.00" value={sidebar.amountPaid} onChange={(e) => setSidebar((s) => s ? { ...s, amountPaid: e.target.value } : s)} className="pl-7 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100" />
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
                <Input type="date" value={sidebar.paymentDate} onChange={(e) => setSidebar((s) => s ? { ...s, paymentDate: e.target.value } : s)} className="dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:[color-scheme:dark]" />
              </div>
              {/* notes */}
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Notes <span className="text-slate-400 font-normal">(optional)</span></label>
                <textarea rows={3} placeholder="e.g. Paid via bank transfer, ref #12345" value={sidebar.notes} onChange={(e) => setSidebar((s) => s ? { ...s, notes: e.target.value } : s)} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:placeholder:text-slate-500" />
              </div>
              {sidebarError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">{sidebarError}</p>}
              {/* payment history */}
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
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(entry.logged_at))}
                            </p>
                            {entry.notes && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400"><span className="font-medium text-slate-400 dark:text-slate-500">Note:</span> {entry.notes}</p>}
                          </div>
                          <button onClick={() => sidebar.batchId && reversePayment(sidebar.batchId, entry.id)} disabled={!!saving} className="ml-3 shrink-0 rounded-md border border-red-200 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40">Reverse</button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
            </div>
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
