"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import {
  ArrowLeft,
  Banknote,
  CalendarCheck,
  CheckCheck,
  CheckCircle2,
  Download,
  Edit,
  Eraser,
  ExternalLink,
  Layers3,
  ListChecks,
  Loader2,
  Mail,
  MessageCircleQuestion,
  RefreshCcw,
  ReceiptText,
  XCircle,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { API_BASE_URL, fetchWithAuth } from "@/lib/api";

// ─── Types ───────────────────────────────────────────────────────────────────

type Payment = {
  id: string;
  contract_id: number | null;
  instalment_year: number;
  payment_policy_type: string | null;
  payment_period_label: string | null;
  payment_period_start: string | null;
  payment_period_end: string | null;
  supplier_name: string | null;
  supplier_id: number | null;
  mpan_number: string | null;
  mpan_bottom: string | null;
  aggregator: string | null;
  agent_name: string | null;
  due_date: string | null;
  status: string;
  last_checked_at: string | null;
  next_follow_up_date: string | null;
  follow_up_count: number;
  expected_net_amount?: string;
  amount_received?: string;
  outstanding_amount?: string;
};

type Receipt = {
  id: string;
  commission_payment_id: string;
  contract_id: number | null;
  instalment_year: number | null;
  payment_period_label: string | null;
  amount_received: string | null;
  date_received: string | null;
  notes: string | null;
  logged_by_name: string | null;
  created_at: string | null;
};

type AgentCommission = {
  id: string;
  commission_payment_receipt_id?: string | null;
  contract_id: number | null;
  instalment_year: number | null;
  payment_period_label: string | null;
  commission_rate: string;
  commission_amount: string;
  batch_month: string | null;
  status: string;
  receipt_amount?: string;
  created_at: string | null;
};

type CustomerLog = {
  success: boolean;
  is_admin: boolean;
  client_id: number;
  client_name?: string | null;
  totals: {
    payment_count: number;
    receipt_count: number;
    agent_commission_count: number;
    total_expected?: string;
    total_received?: string;
    total_outstanding?: string;
  };
  payments: Payment[];
  receipts: Receipt[];
  agent_commissions: AgentCommission[];
};

type ContractGroup = {
  contractId: number | null;
  key: string;
  payments: Payment[];
  expected: number;
  received: number;
  outstanding: number;
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const moneyFmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const formatMoney = (v?: string | number | null) => moneyFmt.format(Number(v || 0));

const formatDate = (v?: string | null) => {
  if (!v) return "-";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(v));
};

const formatDateTime = (v?: string | null) => {
  if (!v) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  }).format(new Date(v));
};

const statusTone: Record<string, string> = {
  Received: "bg-emerald-100 text-emerald-700",
  "Commission Paid": "bg-emerald-100 text-emerald-700",
  Pending: "bg-blue-100 text-blue-700",
  "Partially Paid": "bg-orange-100 text-orange-800",
  "Awaiting Payment": "bg-orange-100 text-orange-800",
  "Chasing Supplier": "bg-red-100 text-red-700",
  Due: "bg-red-100 text-red-700",
  Closed: "bg-zinc-200 text-zinc-700",
  "Received - Written Off": "bg-zinc-200 text-zinc-700",
  "Query Raised": "bg-purple-100 text-purple-700",
};
const statusClass = (s?: string) => statusTone[s ?? ""] ?? "bg-slate-100 text-slate-700";

// ─── Component ────────────────────────────────────────────────────────────────

export default function PaymentHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.client_id as string;

  const [log, setLog] = useState<CustomerLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Individual instalment sheet
  const [sheetPaymentId, setSheetPaymentId] = useState<string | null>(null);
  const [sheetReceiptDraft, setSheetReceiptDraft] = useState({
    amount_received: "", date_received: new Date().toISOString().slice(0, 10), notes: "",
  });
  const [sheetSaving, setSheetSaving] = useState(false);
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState({ amount_received: "", date_received: "", notes: "" });
  const [sheetNotesDraft, setSheetNotesDraft] = useState("");
  const [sheetNoteSaving, setSheetNoteSaving] = useState(false);
  const [sheetFollowUpDate, setSheetFollowUpDate] = useState("");
  const [sheetPatching, setSheetPatching] = useState(false);

  // Bulk log modal (per contract)
  const [bulkLogGroup, setBulkLogGroup] = useState<ContractGroup | null>(null);
  const [bulkAmount, setBulkAmount] = useState("");
  const [bulkDate, setBulkDate] = useState(new Date().toISOString().slice(0, 10));
  const [bulkNotes, setBulkNotes] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  // Sidebar note
  const [sidebarNote, setSidebarNote] = useState("");
  const [sidebarNoteSaving, setSidebarNoteSaving] = useState(false);

  // Status patching
  const [patchingContractKey, setPatchingContractKey] = useState<string | null>(null);

  // Chase supplier dialog (shared by sidebar group actions + individual sheet)
  const [chaseDialog, setChaseDialog] = useState<{ group?: ContractGroup; payment?: Payment } | null>(null);

  // Inline expected amount editing
  const [editingExpectedId, setEditingExpectedId] = useState<string | null>(null);
  const [editingExpectedValue, setEditingExpectedValue] = useState("");
  const [editingGroupExpectedKey, setEditingGroupExpectedKey] = useState<string | null>(null);
  const [editingGroupExpectedValue, setEditingGroupExpectedValue] = useState("");

  // Statement download
  const [selectedCommissions, setSelectedCommissions] = useState<Set<string>>(new Set());
  const [downloadingStatement, setDownloadingStatement] = useState(false);

  const activityBottomRef = useRef<HTMLDivElement>(null);

  // ── Derived ────────────────────────────────────────────────────────────────

  const groupedPayments = useMemo<ContractGroup[]>(() => {
    if (!log) return [];
    const groups = new Map<string, ContractGroup>();
    log.payments.forEach((p) => {
      const key = p.contract_id ? String(p.contract_id) : p.id;
      const g = groups.get(key) || {
        contractId: p.contract_id,
        key,
        payments: [] as Payment[],
        expected: 0, received: 0, outstanding: 0,
      };
      g.payments.push(p);
      g.expected += Number(p.expected_net_amount || 0);
      g.received += Number(p.amount_received || 0);
      g.outstanding += Number(p.outstanding_amount || 0);
      groups.set(key, g);
    });
    return Array.from(groups.values()).map((g) => ({
      ...g,
      payments: g.payments.slice().sort((a, b) => a.instalment_year - b.instalment_year),
    }));
  }, [log]);

  const sheetPayment = log?.payments.find((p) => p.id === sheetPaymentId) ?? null;
  const sheetReceipts = log?.receipts.filter((r) => r.commission_payment_id === sheetPaymentId) ?? [];

  // All activity sorted newest first (admin only gets receipts)
  const allActivity = useMemo(() => (log?.receipts ?? []).slice().sort(
    (a, b) => new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
  ), [log?.receipts]);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadLog = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`/api/commission/customer-log/${clientId}`);
      setLog(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLog(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [clientId]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const saveGroupExpected = async (group: ContractGroup, value: string) => {
    const parsed = Number(value);
    setEditingGroupExpectedKey(null);
    if (isNaN(parsed) || parsed < 0 || !group.contractId) return;
    const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
    const oldAmount = fmt.format(group.expected);
    const newAmount = fmt.format(parsed);
    try {
      await fetchWithAuth(`/api/commission/contracts/${group.contractId}/expected-amount`, {
        method: "PATCH",
        body: JSON.stringify({ total_amount: parsed }),
      });
      await fetchWithAuth("/api/commission/payments/group-note", {
        method: "POST",
        body: JSON.stringify({
          payment_ids: group.payments.map((p) => p.id),
          notes: `Expected amount changed from ${oldAmount} to ${newAmount}`,
        }),
      }).catch(() => {});
      await loadLog();
    } catch {
      setError("Failed to update expected amount");
    }
  };

  const saveInlineExpected = async (paymentId: string, value: string) => {
    const parsed = Number(value);
    setEditingExpectedId(null);
    if (isNaN(parsed) || parsed < 0) return;
    const payment = log?.payments.find((p) => p.id === paymentId);
    const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
    const oldAmount = fmt.format(Number(payment?.expected_net_amount || 0));
    const newAmount = fmt.format(parsed);
    try {
      await fetchWithAuth(`/api/commission/payments/${paymentId}`, {
        method: "PATCH",
        body: JSON.stringify({ expected_net_amount: parsed }),
      });
      const label = payment?.payment_period_label || `Year ${payment?.instalment_year ?? ""}`;
      await fetchWithAuth(`/api/commission/payments/${paymentId}/receipts`, {
        method: "POST",
        body: JSON.stringify({
          notes: `Expected amount for ${label} changed from ${oldAmount} to ${newAmount}`,
        }),
      }).catch(() => {});
      await loadLog();
    } catch {
      setError("Failed to update expected amount");
    }
  };

  const patchContractStatus = async (group: ContractGroup, status: string) => {
    setPatchingContractKey(group.key);
    try {
      await Promise.all(
        group.payments
          .filter((p) => !["Received", "Closed", "Received - Written Off"].includes(p.status))
          .map((p) => fetchWithAuth(`/api/commission/payments/${p.id}/status`, {
            method: "PATCH", body: JSON.stringify({ status }),
          }))
      );
      await loadLog();
    } catch {
      setError("Failed to update status");
    } finally {
      setPatchingContractKey(null);
    }
  };

  const openBulkLog = (group: ContractGroup) => {
    setBulkLogGroup(group);
    setBulkAmount(group.outstanding.toFixed(2));
    setBulkDate(new Date().toISOString().slice(0, 10));
    setBulkNotes("");
  };

  const submitBulkLog = async () => {
    if (!bulkLogGroup || !bulkAmount || Number(bulkAmount) <= 0) return;
    setBulkSaving(true);
    try {
      await fetchWithAuth(`/api/commission/contracts/${bulkLogGroup.contractId}/bulk-receipt`, {
        method: "POST",
        body: JSON.stringify({ total_amount: Number(bulkAmount), date_received: bulkDate, notes: bulkNotes || undefined }),
      });
      setBulkLogGroup(null);
      await loadLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log bulk payment");
    } finally {
      setBulkSaving(false);
    }
  };

  const submitSidebarNote = async () => {
    if (!log || !sidebarNote.trim()) return;
    setSidebarNoteSaving(true);
    try {
      await fetchWithAuth("/api/commission/payments/group-note", {
        method: "POST",
        body: JSON.stringify({
          payment_ids: log.payments.map((p) => p.id),
          notes: sidebarNote.trim(),
        }),
      });
      setSidebarNote("");
      await loadLog();
    } catch {
      // silent
    } finally {
      setSidebarNoteSaving(false);
    }
  };

  // Individual payment actions (sheet)
  const patchSheetStatus = async (status: string) => {
    if (!sheetPaymentId) return;
    setSheetPatching(true);
    try {
      const body: Record<string, unknown> = { status };
      if (sheetFollowUpDate) body.next_follow_up_date = sheetFollowUpDate;
      await fetchWithAuth(`/api/commission/payments/${sheetPaymentId}/status`, {
        method: "PATCH", body: JSON.stringify(body),
      });
      await loadLog();
    } catch {
      setError("Failed to update status");
    } finally {
      setSheetPatching(false);
    }
  };

  const submitSheetNote = async () => {
    if (!sheetPaymentId || !sheetNotesDraft.trim()) return;
    setSheetNoteSaving(true);
    try {
      await fetchWithAuth(`/api/commission/payments/${sheetPaymentId}/receipts`, {
        method: "POST",
        body: JSON.stringify({ notes: sheetNotesDraft.trim() }),
      });
      setSheetNotesDraft("");
      await loadLog();
    } catch {
      // silent
    } finally {
      setSheetNoteSaving(false);
    }
  };

  const goToChaseEmailSingle = (payment: Payment) => {
    setChaseDialog({ payment });
  };

  const goToChaseEmail = (group: ContractGroup) => {
    setChaseDialog({ group });
  };

  const navigateToChaseEmail = (payment: Payment) => {
    const draft = {
      paymentId: payment.id,
      mpan: payment.mpan_number || payment.mpan_bottom || "",
      businessName: log?.client_name || `Client ${clientId}`,
      supplierName: payment.supplier_name || "",
      startDate: payment.payment_period_start || "",
      endDate: payment.payment_period_end || "",
      expected: payment.expected_net_amount || "0",
      received: payment.amount_received || "0",
      supplierId: payment.supplier_id ?? null,
      followUpCount: payment.follow_up_count ?? 0,
    };
    sessionStorage.setItem("chaseEmailDraft", JSON.stringify(draft));
    router.push("/dashboard/payments/chase-email");
  };

  const confirmChaseDialog = (composeEmail: boolean) => {
    if (!chaseDialog) return;
    if (chaseDialog.payment) {
      if (composeEmail) {
        navigateToChaseEmail(chaseDialog.payment);
      } else {
        patchSheetStatus("Chasing Supplier");
      }
    } else if (chaseDialog.group) {
      if (composeEmail) {
        const first = chaseDialog.group.payments.find((p) => !["Received", "Closed", "Received - Written Off"].includes(p.status));
        if (first) navigateToChaseEmail(first);
      } else {
        patchContractStatus(chaseDialog.group, "Chasing Supplier");
      }
    }
    setChaseDialog(null);
  };

  // Individual instalment logging
  const submitSheetReceipt = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!sheetPaymentId) return;
    setSheetSaving(true);
    try {
      await fetchWithAuth(`/api/commission/payments/${sheetPaymentId}/receipts`, {
        method: "POST",
        body: JSON.stringify({
          amount_received: Number(sheetReceiptDraft.amount_received),
          date_received: sheetReceiptDraft.date_received,
          notes: sheetReceiptDraft.notes,
        }),
      });
      setSheetReceiptDraft({ amount_received: "", date_received: new Date().toISOString().slice(0, 10), notes: "" });
      await loadLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log receipt");
    } finally {
      setSheetSaving(false);
    }
  };

  const submitReceiptEdit = async (e: FormEvent<HTMLFormElement>, receipt: Receipt) => {
    e.preventDefault();
    setSheetSaving(true);
    try {
      await fetchWithAuth(`/api/commission/payments/${receipt.commission_payment_id}/receipts/${receipt.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          amount_received: Number(editDraft.amount_received),
          date_received: editDraft.date_received,
          notes: editDraft.notes,
        }),
      });
      setEditingReceiptId(null);
      await loadLog();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update receipt");
    } finally {
      setSheetSaving(false);
    }
  };

  const downloadStatement = async (receiptIds: string[]) => {
    if (!receiptIds.length) return;
    setDownloadingStatement(true);
    const agentName = log?.payments.find((p) => p.agent_name)?.agent_name ?? `Client ${clientId}`;
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/commission/statement/custom`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_ids: receiptIds, agent_name: agentName }),
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), { href: url, download: `commission-statement-client-${clientId}.pdf` }).click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setDownloadingStatement(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50/50 dark:bg-slate-950">
      {/* Page header */}
      <div className="border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 sm:px-6 lg:px-8 py-4">
        <div className="mx-auto max-w-screen-2xl flex flex-wrap items-center justify-between gap-3">
          <div>
            <button
              type="button"
              className="mb-1.5 inline-flex items-center text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 transition-colors"
              onClick={() => router.push("/dashboard/payments")}
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Payment Tracker
            </button>
            <h1 className="text-xl font-semibold text-slate-950 dark:text-slate-50">
              {log?.client_name ? `${log.client_name} — Payment History` : "Payment History"}
            </h1>
            {log && (
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                {log.totals.payment_count} instalments · {log.totals.receipt_count} receipts logged
                {log.is_admin && log.totals.total_outstanding && Number(log.totals.total_outstanding) > 0 &&
                  ` · ${formatMoney(log.totals.total_outstanding)} outstanding`}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => window.open(`/dashboard/renewals/${clientId}`, "_blank")}>
              <ExternalLink className="mr-1.5 h-4 w-4" /> Customer Details
            </Button>
            <Button size="sm" variant="outline" onClick={loadLog} disabled={loading}>
              {loading ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-1.5 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-700 dark:text-red-400">{error}</div>
        </div>
      )}

      {loading ? (
        <div className="flex min-h-64 items-center justify-center text-slate-500 dark:text-slate-400">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading payment history…
        </div>
      ) : !log ? (
        <div className="mx-auto max-w-screen-2xl px-4 py-12 text-center text-slate-500 dark:text-slate-400">
          No payment history found for this customer.
        </div>
      ) : (
        <div className="mx-auto max-w-screen-2xl px-4 sm:px-6 lg:px-8 py-6">
          {/* Two-column layout: main + sidebar */}
          <div className="flex gap-6 items-start">

            {/* ── Main content ── */}
            <div className="flex-1 min-w-0 space-y-5">

              {/* Summary strip */}
              {log.is_admin && (
                <div className="grid grid-cols-3 gap-3">
                  {/* Total Expected — editable by clicking the amount */}
                  <div
                    className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 cursor-pointer group"
                    title="Click to edit total expected"
                    onClick={() => {
                      if (editingGroupExpectedKey !== "__total__") {
                        setEditingGroupExpectedKey("__total__");
                        setEditingGroupExpectedValue(Number(log.totals.total_expected || 0).toFixed(2));
                      }
                    }}
                  >
                    <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
                      Total Expected
                      <Edit className="h-3 w-3 opacity-0 group-hover:opacity-60 transition-opacity" />
                    </p>
                    {editingGroupExpectedKey === "__total__" ? (
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        autoFocus
                        className="mt-0.5 w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-black"
                        value={editingGroupExpectedValue}
                        onChange={(e) => setEditingGroupExpectedValue(e.target.value)}
                        onBlur={async () => {
                          const parsed = Number(editingGroupExpectedValue);
                          setEditingGroupExpectedKey(null);
                          if (isNaN(parsed) || parsed < 0) return;
                          const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
                          const oldFormatted = fmt.format(Number(log.totals.total_expected || 0));
                          const formatted = fmt.format(parsed);
                          // Apply evenly across all contracts
                          for (const group of groupedPayments) {
                            if (!group.contractId) continue;
                            const share = parsed * (group.expected / (Number(log.totals.total_expected) || 1));
                            await fetchWithAuth(`/api/commission/contracts/${group.contractId}/expected-amount`, {
                              method: "PATCH",
                              body: JSON.stringify({ total_amount: parseFloat(share.toFixed(2)) }),
                            }).catch(() => {});
                          }
                          // Log the change as a note across all payments
                          const allIds = groupedPayments.flatMap((g) => g.payments.map((p) => p.id));
                          if (allIds.length > 0) {
                            await fetchWithAuth("/api/commission/payments/group-note", {
                              method: "POST",
                              body: JSON.stringify({
                                payment_ids: allIds,
                                notes: `Total expected amount changed from ${oldFormatted} to ${formatted}`,
                              }),
                            }).catch(() => {});
                          }
                          await loadLog();
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                          if (e.key === "Escape") setEditingGroupExpectedKey(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <p className="mt-0.5 text-lg font-semibold text-slate-900 dark:text-slate-100">{formatMoney(log.totals.total_expected)}</p>
                    )}
                  </div>
                  {/* Total Received */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Received</p>
                    <p className="mt-0.5 text-lg font-semibold text-emerald-700 dark:text-emerald-400">{formatMoney(log.totals.total_received)}</p>
                  </div>
                  {/* Total Outstanding */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3">
                    <p className="text-xs text-slate-500 dark:text-slate-400">Total Outstanding</p>
                    <p className="mt-0.5 text-lg font-semibold text-orange-700 dark:text-orange-400">{formatMoney(log.totals.total_outstanding)}</p>
                  </div>
                </div>
              )}

              {/* Contract groups */}
              {groupedPayments.map((group) => {
                const statuses = Array.from(new Set(group.payments.map((p) => p.status)));
                const isPatching = patchingContractKey === group.key;
                const firstPayment = group.payments[0];
                // Contract date range: earliest start → latest end across all instalments
                const periodStart = group.payments.map(p => p.payment_period_start).filter(Boolean).sort()[0];
                const periodEnd = group.payments.map(p => p.payment_period_end).filter(Boolean).sort().at(-1);
                // Next due: first unpaid instalment's due_date
                const nextDue = group.payments.find(p => !["Received", "Closed", "Received - Written Off"].includes(p.status))?.due_date;

                return (
                  <section key={group.key} className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    {/* Contract group header */}
                    <div className="border-b border-slate-100 dark:border-slate-800 px-5 pt-4 pb-4">

                      {/* Title row: name + contract # + badges + actions */}
                      <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-base font-semibold text-slate-950 dark:text-slate-50">{log.client_name || `Client ${clientId}`}</span>
                          <span className="text-xs text-slate-400 dark:text-slate-500 font-normal">· Contract #{group.contractId || "—"}</span>
                          <div className="flex flex-wrap gap-1">
                            {statuses.map((s) => (
                              <Badge key={s} className={`${statusClass(s)} text-xs`}>{s}</Badge>
                            ))}
                          </div>
                        </div>

                      </div>

                      {/* Customer information box */}
                      <div className="rounded-lg border border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 px-4 py-3">
                        <p className="text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-2.5">Customer Information</p>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-3 text-xs">
                          {[
                            { label: "Supplier", value: firstPayment?.supplier_name },
                            { label: "Aggregator", value: firstPayment?.aggregator },
                            { label: "Agent", value: firstPayment?.agent_name },
                            { label: "MPAN/MPR", value: firstPayment?.mpan_number || firstPayment?.mpan_bottom, mono: true },
                            {
                              label: "Period",
                              value: (periodStart || periodEnd)
                                ? `${formatDate(periodStart)} – ${formatDate(periodEnd)}`
                                : null,
                              nowrap: true,
                            },
                            { label: "Next Due", value: nextDue ? formatDate(nextDue) : null },
                          ].map(({ label, value, mono, nowrap }) => (
                            <div key={label}>
                              <p className="text-slate-400 dark:text-slate-500 uppercase tracking-wide font-semibold mb-0.5">{label}</p>
                              <p className={`font-medium text-slate-800 dark:text-slate-200 ${mono ? "font-mono" : ""} ${nowrap ? "whitespace-nowrap" : ""}`}>
                                {value || "—"}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Instalment table */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-2.5">Period</th>
                            {log.is_admin && <th className="px-4 py-2.5 text-right">Expected</th>}
                            {log.is_admin && <th className="px-4 py-2.5 text-right">Received</th>}
                            {log.is_admin && <th className="px-4 py-2.5 text-right">Outstanding</th>}
                            <th className="px-4 py-2.5">Due Date</th>
                            <th className="px-4 py-2.5">Status</th>
                            <th className="px-4 py-2.5">Last Checked</th>
                            {log.is_admin && <th className="px-4 py-2.5 text-right">Action</th>}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {group.payments.map((payment) => {
                            const isClosed = ["Received", "Closed", "Received - Written Off"].includes(payment.status);
                            return (
                              <tr
                                key={payment.id}
                                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors cursor-pointer"
                                onClick={() => { setSheetPaymentId(payment.id); setSheetNotesDraft(""); setSheetFollowUpDate(""); setEditingReceiptId(null); }}
                              >
                                <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                  {payment.payment_period_label}
                                  {(payment.payment_period_start || payment.payment_period_end) && (
                                    <span className="block text-xs text-slate-400 font-normal">
                                      {formatDate(payment.payment_period_start)} – {formatDate(payment.payment_period_end)}
                                    </span>
                                  )}
                                </td>
                                {log.is_admin && (
                                  <td
                                    className="px-4 py-2.5 text-right font-medium text-slate-900 dark:text-slate-100 cursor-pointer group/exp"
                                    title="Click to edit expected amount"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setEditingExpectedId(payment.id);
                                      setEditingExpectedValue(Number(payment.expected_net_amount || 0).toFixed(2));
                                    }}
                                  >
                                    {editingExpectedId === payment.id ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        autoFocus
                                        className="w-24 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-right text-sm font-medium text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-black"
                                        value={editingExpectedValue}
                                        onChange={(e) => setEditingExpectedValue(e.target.value)}
                                        onBlur={() => saveInlineExpected(payment.id, editingExpectedValue)}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter") { e.preventDefault(); saveInlineExpected(payment.id, editingExpectedValue); }
                                          if (e.key === "Escape") setEditingExpectedId(null);
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    ) : (
                                      <span className="inline-flex items-center gap-1 justify-end">
                                        {formatMoney(payment.expected_net_amount)}
                                        <Edit className="h-3 w-3 opacity-0 group-hover/exp:opacity-50 transition-opacity shrink-0" />
                                      </span>
                                    )}
                                  </td>
                                )}
                                {log.is_admin && <td className="px-4 py-2.5 text-right text-emerald-700 dark:text-emerald-400">{formatMoney(payment.amount_received)}</td>}
                                {log.is_admin && <td className="px-4 py-2.5 text-right text-orange-700 dark:text-orange-400">{formatMoney(payment.outstanding_amount)}</td>}
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{formatDate(payment.due_date)}</td>
                                <td className="px-4 py-2.5">
                                  <Badge className={`${statusClass(payment.status)} text-xs`}>{payment.status}</Badge>
                                </td>
                                <td className="px-4 py-2.5 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(payment.last_checked_at)}</td>
                                {log.is_admin && (
                                  <td className="px-4 py-2.5 text-right" onClick={(e) => e.stopPropagation()}>
                                    {isClosed ? (
                                      <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">✓ Done</span>
                                    ) : (
                                      <Button size="sm" variant="outline" className="h-6 px-2 text-xs dark:border-slate-700" onClick={(e) => { e.stopPropagation(); setSheetPaymentId(payment.id); setSheetNotesDraft(""); setSheetFollowUpDate(""); setEditingReceiptId(null); }}>
                                        <Banknote className="h-3 w-3 mr-1" /> Log
                                      </Button>
                                    )}
                                  </td>
                                )}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}

              {/* Agent commissions */}
              {log.agent_commissions.length > 0 && (() => {
                const selectableIds = log.agent_commissions.map((i) => i.commission_payment_receipt_id).filter(Boolean) as string[];
                const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selectedCommissions.has(id));
                const someChecked = selectableIds.some((id) => selectedCommissions.has(id)) && !allChecked;
                const selectedList = selectableIds.filter((id) => selectedCommissions.has(id));
                const selectedTotal = log.agent_commissions.filter((i) => i.commission_payment_receipt_id && selectedCommissions.has(i.commission_payment_receipt_id))
                  .reduce((s, i) => s + Number(i.commission_amount || 0), 0);

                return (
                  <section className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 border-b border-slate-100 dark:border-slate-800">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Agent Commission Entries</h2>
                      <div className="flex items-center gap-2">
                        {selectedList.length > 0 && (
                          <Button size="sm" onClick={() => downloadStatement(selectedList)} disabled={downloadingStatement}>
                            {downloadingStatement ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                            Download Selected ({selectedList.length}) — {moneyFmt.format(selectedTotal)}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => downloadStatement(selectableIds)} disabled={downloadingStatement || selectableIds.length === 0}>
                          {downloadingStatement ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                          Download All
                        </Button>
                      </div>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-slate-50 dark:bg-slate-800/60 text-left text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400 uppercase border-b border-slate-100 dark:border-slate-800">
                          <tr>
                            <th className="px-4 py-2.5 w-10">
                              <input type="checkbox" checked={allChecked}
                                ref={(el) => { if (el) el.indeterminate = someChecked; }}
                                onChange={() => {
                                  if (allChecked) setSelectedCommissions((s) => { const n = new Set(s); selectableIds.forEach((id) => n.delete(id)); return n; });
                                  else setSelectedCommissions((s) => { const n = new Set(s); selectableIds.forEach((id) => n.add(id)); return n; });
                                }}
                                className="h-4 w-4 rounded border-slate-300 accent-slate-800 cursor-pointer" />
                            </th>
                            <th className="px-4 py-2.5">Contract / Period</th>
                            {log.is_admin && <th className="px-4 py-2.5 text-right">Receipt Amt</th>}
                            <th className="px-4 py-2.5 text-right">Rate</th>
                            <th className="px-4 py-2.5 text-right">Commission</th>
                            <th className="px-4 py-2.5">Batch Month</th>
                            <th className="px-4 py-2.5">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {log.agent_commissions.map((item) => {
                            const rid = item.commission_payment_receipt_id;
                            const checked = !!rid && selectedCommissions.has(rid);
                            return (
                              <tr key={item.id} className={`transition-colors ${checked ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                                <td className="px-4 py-2.5">
                                  {rid && <input type="checkbox" checked={checked}
                                    onChange={() => setSelectedCommissions((s) => { const n = new Set(s); n.has(rid) ? n.delete(rid) : n.add(rid); return n; })}
                                    className="h-4 w-4 rounded border-slate-300 accent-slate-800 cursor-pointer" />}
                                </td>
                                <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-slate-100">
                                  #{item.contract_id || "—"}
                                  <span className="block text-xs text-slate-500 dark:text-slate-400 font-normal">{item.payment_period_label || `Year ${item.instalment_year}`}</span>
                                </td>
                                {log.is_admin && <td className="px-4 py-2.5 text-right">{formatMoney(item.receipt_amount)}</td>}
                                <td className="px-4 py-2.5 text-right">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                                <td className="px-4 py-2.5 text-right font-semibold">{formatMoney(item.commission_amount)}</td>
                                <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{formatDate(item.batch_month)}</td>
                                <td className="px-4 py-2.5"><Badge className={`${statusClass(item.status)} text-xs`}>{item.status}</Badge></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })()}
            </div>

            {/* ── Sticky sidebar ── */}
            <div className="w-80 shrink-0 sticky top-6 self-start flex flex-col gap-4" style={{ maxHeight: "calc(100vh - 7rem)" }}>

              {/* Quick Actions panel */}
              {log.is_admin && groupedPayments.length > 0 && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Actions</h3>
                  <div className="flex flex-col gap-2">
                    {groupedPayments.map((group) => {
                      const isPatching = patchingContractKey === group.key;
                      const firstPayment = group.payments[0];
                      return (
                        <div key={group.key} className="space-y-2">
                          {groupedPayments.length > 1 && (
                            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Contract #{group.contractId} — {firstPayment?.supplier_name}</p>
                          )}
                          <div className="flex flex-wrap gap-1.5">
                            {group.outstanding > 0 && (
                              <Button size="sm" className="h-7 text-xs bg-black hover:bg-gray-900 text-white gap-1.5" disabled={isPatching}
                                onClick={() => openBulkLog(group)}>
                                <ListChecks className="h-3 w-3" /> Log Payment
                              </Button>
                            )}
                            <Button size="sm" variant="outline" className="h-7 text-xs dark:border-slate-700 dark:hover:bg-slate-800 gap-1.5" disabled={isPatching}
                              onClick={() => goToChaseEmail(group)}>
                              <CalendarCheck className="h-3 w-3" /> Chasing Supplier
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-amber-200 text-amber-700 hover:bg-amber-50 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30 gap-1.5" disabled={isPatching}
                              onClick={() => goToChaseEmail(group)}>
                              <XCircle className="h-3 w-3" /> No Payment Received
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs dark:border-slate-700 dark:hover:bg-slate-800 gap-1.5" disabled={isPatching}
                              onClick={() => patchContractStatus(group, "Query Raised")}>
                              <MessageCircleQuestion className="h-3 w-3" /> Raise a Query
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30 gap-1.5" disabled={isPatching}
                              onClick={() => patchContractStatus(group, "Closed")}>
                              <CheckCheck className="h-3 w-3" /> Payment Received Completely
                            </Button>
                            <Button size="sm" variant="outline" className="h-7 text-xs border-orange-200 text-orange-700 hover:bg-orange-50 dark:border-orange-900/50 dark:text-orange-400 dark:hover:bg-orange-950/30 gap-1.5" disabled={isPatching}
                              onClick={() => patchContractStatus(group, "Received - Written Off")}>
                              <Eraser className="h-3 w-3" /> Supplier No Longer Trading
                            </Button>
                            {isPatching && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-400 self-center" />}
                          </div>
                          {groupedPayments.length > 1 && groupedPayments.indexOf(group) < groupedPayments.length - 1 && (
                            <div className="border-t border-slate-100 dark:border-slate-800 pt-2" />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add note panel */}
              {log.is_admin && (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide">Add Note</h3>
                  <textarea
                    rows={3}
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black dark:text-slate-100 dark:placeholder:text-slate-500"
                    placeholder="e.g. Called supplier, awaiting callback…"
                    value={sidebarNote}
                    onChange={(e) => setSidebarNote(e.target.value)}
                  />
                  <Button
                    size="sm"
                    className="w-full bg-black hover:bg-gray-900 text-white gap-1.5"
                    disabled={sidebarNoteSaving || !sidebarNote.trim()}
                    onClick={submitSidebarNote}
                  >
                    {sidebarNoteSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ReceiptText className="h-3.5 w-3.5" />}
                    Save Note
                  </Button>
                </div>
              )}

              {/* Activity log */}
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col overflow-hidden" style={{ maxHeight: "calc(100vh - 20rem)" }}>
                <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 shrink-0 flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wide flex items-center gap-1.5">
                    <Layers3 className="h-3.5 w-3.5" /> Activity Log
                  </h3>
                  <span className="text-xs text-slate-400 dark:text-slate-500">{allActivity.length} entries</span>
                </div>

                <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                  {allActivity.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      No activity logged yet.
                    </div>
                  ) : (
                    allActivity.map((receipt) => {
                      const isChase = receipt.notes?.startsWith("Chase email sent");
                      const hasAmount = Number(receipt.amount_received) > 0;
                      return (
                        <div key={receipt.id} className="px-4 py-3 text-sm">
                          {/* Period label */}
                          <p className="text-xs text-slate-400 dark:text-slate-500 mb-1">
                            {receipt.payment_period_label || `Year ${receipt.instalment_year || "—"}`} · {formatDateTime(receipt.created_at)}
                          </p>

                          {hasAmount ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(receipt.amount_received)}</span>
                                <span className="text-xs text-slate-400">· {formatDate(receipt.date_received)}</span>
                              </div>
                              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{receipt.logged_by_name || "Logged"}</p>
                              {receipt.notes && <p className="text-slate-600 dark:text-slate-300 mt-0.5 text-xs">{receipt.notes}</p>}
                            </div>
                          ) : isChase ? (
                            <div className="flex gap-2">
                              <div className="mt-0.5 h-5 w-5 shrink-0 flex items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/60">
                                <Mail className="h-3 w-3 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 uppercase tracking-wide">Chase Email</p>
                                <p className="text-xs text-slate-500 dark:text-slate-400">{receipt.logged_by_name || "System"}</p>
                                <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">{receipt.notes}</p>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="text-xs font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">Note</p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{receipt.logged_by_name || "Logged"}</p>
                              {receipt.notes && <p className="text-slate-600 dark:text-slate-300 mt-0.5 text-xs">{receipt.notes}</p>}
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                  <div ref={activityBottomRef} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Individual instalment sheet ── */}
      <Sheet open={Boolean(sheetPaymentId)} onOpenChange={(open) => { if (!open) { setSheetPaymentId(null); setSheetNotesDraft(""); setSheetFollowUpDate(""); setEditingReceiptId(null); } }}>
        <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-xl dark:bg-slate-900">
          <SheetHeader className="border-b border-slate-200 dark:border-slate-800 px-6 py-5 pr-12">
            <SheetTitle className="dark:text-slate-100">Commission Payment</SheetTitle>
          </SheetHeader>

          {sheetPayment && (
            <div className="space-y-5 px-6 py-5">
              {/* Payment info */}
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 dark:bg-slate-900 p-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-lg font-semibold text-slate-950 dark:text-slate-50 break-words">
                      {log?.client_name || `Client ${clientId}`}
                    </p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 break-words">
                      {sheetPayment.supplier_name || "Supplier"} · {sheetPayment.agent_name || "Unassigned"}
                    </p>
                    <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                      {sheetPayment.payment_period_label || `Year ${sheetPayment.instalment_year}`}
                    </p>
                  </div>
                  <Badge className={`${statusClass(sheetPayment.status)} shrink-0 whitespace-nowrap`}>{sheetPayment.status}</Badge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm border-t border-slate-100 dark:border-slate-800 pt-3">
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">MPAN/MPR</p>
                    <p className="font-mono text-xs font-semibold break-words text-slate-900 dark:text-slate-100">{sheetPayment.mpan_number || sheetPayment.mpan_bottom || "—"}</p>
                  </div>
                  {log?.is_admin && (
                    <div
                      className="cursor-pointer group/sexp"
                      title="Click to edit"
                      onClick={() => { setEditingExpectedId(`sheet_${sheetPayment.id}`); setEditingExpectedValue(Number(sheetPayment.expected_net_amount || 0).toFixed(2)); }}
                    >
                      <p className="text-slate-500 dark:text-slate-400 flex items-center gap-1">
                        Expected <Edit className="h-3 w-3 opacity-0 group-hover/sexp:opacity-50 transition-opacity" />
                      </p>
                      {editingExpectedId === `sheet_${sheetPayment.id}` ? (
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          autoFocus
                          className="w-full rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-0.5 text-sm font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-black"
                          value={editingExpectedValue}
                          onChange={(e) => setEditingExpectedValue(e.target.value)}
                          onBlur={() => saveInlineExpected(sheetPayment.id, editingExpectedValue)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); saveInlineExpected(sheetPayment.id, editingExpectedValue); }
                            if (e.key === "Escape") setEditingExpectedId(null);
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : (
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(sheetPayment.expected_net_amount)}</p>
                      )}
                    </div>
                  )}
                  {log?.is_admin && (
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Outstanding</p>
                      <p className="font-semibold text-orange-700 dark:text-orange-400">{formatMoney(sheetPayment.outstanding_amount)}</p>
                    </div>
                  )}
                  {log?.is_admin && (
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Received</p>
                      <p className="font-semibold text-emerald-700 dark:text-emerald-400">{formatMoney(sheetPayment.amount_received)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Due date</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(sheetPayment.due_date)}</p>
                  </div>
                  <div>
                    <p className="text-slate-500 dark:text-slate-400">Last checked</p>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDateTime(sheetPayment.last_checked_at)}</p>
                  </div>
                  {sheetPayment.next_follow_up_date && (
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Next follow-up</p>
                      <p className="font-semibold text-amber-700 dark:text-amber-400">{formatDate(sheetPayment.next_follow_up_date)}</p>
                    </div>
                  )}
                  {sheetPayment.follow_up_count > 0 && (
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Times chased</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{sheetPayment.follow_up_count}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Closed message or Log Payment + Notes + Actions */}
              {["Closed", "Received - Written Off"].includes(sheetPayment.status) ? (
                <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                  This payment is closed. Receipts and chasing actions are no longer available.
                </div>
              ) : (
                <>
                  {/* Log payment form */}
                  {log?.is_admin && (
                    <form onSubmit={submitSheetReceipt} className="rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-4 space-y-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                          <Banknote className="h-4 w-4" /> Log Payment
                        </div>
                        {Number(sheetPayment.outstanding_amount) > 0 && (
                          <Button type="button" size="sm" className="h-7 text-xs bg-black hover:bg-gray-900 text-white gap-1" disabled={sheetSaving}
                            onClick={async () => {
                              const amt = Number(sheetPayment.outstanding_amount || sheetPayment.expected_net_amount);
                              if (!amt || !sheetPaymentId) return;
                              setSheetSaving(true);
                              try {
                                await fetchWithAuth(`/api/commission/payments/${sheetPaymentId}/receipts`, {
                                  method: "POST",
                                  body: JSON.stringify({ amount_received: amt, date_received: new Date().toISOString().slice(0, 10) }),
                                });
                                await loadLog();
                              } catch { /* silent */ } finally { setSheetSaving(false); }
                            }}>
                            <Zap className="h-3 w-3" /> Received {formatMoney(sheetPayment.outstanding_amount || sheetPayment.expected_net_amount)}
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label className="dark:text-slate-300">Amount received</Label>
                          <Input min="0.01" step="0.01" type="number" required value={sheetReceiptDraft.amount_received}
                            onChange={(e) => setSheetReceiptDraft((c) => ({ ...c, amount_received: e.target.value }))}
                            className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" />
                        </div>
                        <div className="space-y-2">
                          <Label className="dark:text-slate-300">Date received</Label>
                          <Input type="date" value={sheetReceiptDraft.date_received}
                            onChange={(e) => setSheetReceiptDraft((c) => ({ ...c, date_received: e.target.value }))}
                            className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="dark:text-slate-300">Notes</Label>
                        <Textarea rows={3} value={sheetReceiptDraft.notes}
                          onChange={(e) => setSheetReceiptDraft((c) => ({ ...c, notes: e.target.value }))}
                          className="resize-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
                      </div>
                      <Button type="submit" disabled={sheetSaving}>
                        {sheetSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Banknote className="mr-2 h-4 w-4" />}
                        Log Payment
                      </Button>
                    </form>
                  )}

                  {/* Notes */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                      <ReceiptText className="h-4 w-4" /> Notes
                    </div>
                    <Textarea
                      placeholder="Add any notes about this payment, follow-up actions, or supplier communications..."
                      value={sheetNotesDraft}
                      onChange={(e) => setSheetNotesDraft(e.target.value)}
                      rows={4}
                      className="resize-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    <Button type="button" size="sm" variant="outline" disabled={sheetNoteSaving || !sheetNotesDraft.trim()} onClick={submitSheetNote}
                      className="dark:border-slate-700 dark:hover:bg-slate-800">
                      {sheetNoteSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
                      Save Note
                    </Button>
                  </div>

                  {/* Actions */}
                  <div className="rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-4 space-y-3">
                    <div className="text-sm font-semibold text-slate-950 dark:text-slate-50">Actions</div>

                    {(sheetPayment.follow_up_count > 0 || sheetPayment.next_follow_up_date) && (
                      <div className="rounded-md bg-amber-50 border border-amber-200 dark:bg-amber-950/30 dark:border-amber-900/50 px-3 py-2 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                        {sheetPayment.follow_up_count > 0 && (
                          <p>Chased <strong>{sheetPayment.follow_up_count}</strong> time{sheetPayment.follow_up_count !== 1 ? "s" : ""}</p>
                        )}
                        {sheetPayment.next_follow_up_date && (
                          <p>Next follow-up: <strong>{formatDate(sheetPayment.next_follow_up_date)}</strong></p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <CalendarCheck className="h-3.5 w-3.5" />
                        <span>Follow up on</span>
                        <Input type="date" className="h-7 text-xs w-36 py-0 dark:border-slate-700 dark:bg-slate-950 dark:[color-scheme:dark]"
                          value={sheetFollowUpDate} onChange={(e) => setSheetFollowUpDate(e.target.value)} />
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => sheetPayment && goToChaseEmailSingle(sheetPayment)} disabled={sheetPatching}
                          className="dark:border-slate-700 dark:hover:bg-slate-800">
                          <CalendarCheck className="mr-2 h-4 w-4" /> Mark as Chasing Supplier
                        </Button>
                        <Button variant="outline" onClick={() => patchSheetStatus("Query Raised")} disabled={sheetPatching}
                          className="dark:border-slate-700 dark:hover:bg-slate-800">
                          <MessageCircleQuestion className="mr-2 h-4 w-4" /> Raise a Query
                        </Button>
                        <Button variant="outline" onClick={() => sheetPayment && goToChaseEmailSingle(sheetPayment)} disabled={sheetPatching}
                          className="border-amber-200 text-amber-700 hover:bg-amber-50 hover:border-amber-300 dark:border-amber-900/50 dark:text-amber-400 dark:hover:bg-amber-950/30">
                          <XCircle className="mr-2 h-4 w-4" /> No Payment Received
                        </Button>
                        <Button variant="outline" onClick={() => patchSheetStatus("Closed")} disabled={sheetPatching}
                          className="border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:border-emerald-300 dark:border-emerald-900/50 dark:text-emerald-400 dark:hover:bg-emerald-950/30">
                          <CheckCheck className="mr-2 h-4 w-4" /> Payment Received Completely
                        </Button>
                      </div>
                    </div>

                    <div className="border-t border-slate-100 dark:border-slate-800 pt-3">
                      <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Supplier has completely ceased trading — all instalments will be zeroed out.</p>
                      <Button variant="outline" onClick={() => patchSheetStatus("Received - Written Off")} disabled={sheetPatching}
                        className="border-orange-200 text-orange-700 hover:bg-orange-50 hover:border-orange-300 dark:border-orange-900/50 dark:text-orange-400 dark:hover:bg-orange-950/30">
                        <XCircle className="mr-2 h-4 w-4" /> Supplier No Longer Trading
                      </Button>
                    </div>
                  </div>
                </>
              )}

              {/* Receipt & note history */}
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Receipt &amp; note history</h3>
                {sheetReceipts.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 dark:border-slate-800 p-4 text-sm text-slate-500 dark:text-slate-400">
                    No receipts logged for this payment.
                  </div>
                ) : (
                  sheetReceipts.map((r) => (
                    <div key={r.id} className="rounded-lg border border-slate-200 dark:border-slate-800 dark:bg-slate-900 p-3 text-sm">
                      {editingReceiptId === r.id ? (
                        <form onSubmit={(e) => submitReceiptEdit(e, r)} className="space-y-3">
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label className="dark:text-slate-300">Amount received</Label>
                              <Input step="0.01" type="number" required value={editDraft.amount_received}
                                onChange={(e) => setEditDraft((c) => ({ ...c, amount_received: e.target.value }))}
                                className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100" />
                            </div>
                            <div className="space-y-2">
                              <Label className="dark:text-slate-300">Date received</Label>
                              <Input type="date" value={editDraft.date_received}
                                onChange={(e) => setEditDraft((c) => ({ ...c, date_received: e.target.value }))}
                                className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]" />
                            </div>
                          </div>
                          <Textarea rows={2} value={editDraft.notes}
                            onChange={(e) => setEditDraft((c) => ({ ...c, notes: e.target.value }))}
                            className="resize-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
                          <div className="flex flex-wrap gap-2">
                            <Button type="submit" size="sm" disabled={sheetSaving}>
                              {sheetSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null} Save
                            </Button>
                            <Button type="button" size="sm" variant="outline" onClick={() => setEditingReceiptId(null)} className="dark:border-slate-700 dark:hover:bg-slate-800">Cancel</Button>
                          </div>
                        </form>
                      ) : (
                        <>
                          {Number(r.amount_received) > 0 ? (
                            <>
                              <div className="flex items-center justify-between gap-3">
                                <p className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(r.amount_received)}</p>
                                <p className="text-slate-500 dark:text-slate-400">{formatDate(r.date_received)}</p>
                              </div>
                              <p className="mt-1 text-slate-500 dark:text-slate-400">
                                {r.logged_by_name || "Logged"} · {formatDateTime(r.created_at)}
                              </p>
                              {r.notes && <p className="mt-2 text-slate-700 dark:text-slate-300">{r.notes}</p>}
                            </>
                          ) : r.notes?.startsWith("Chase email sent") ? (
                            <div className="flex gap-2.5">
                              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950/60">
                                <Mail className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-semibold text-blue-700 uppercase tracking-wide dark:text-blue-400">Chase Email Sent</span>
                                  <span className="text-xs text-slate-400 dark:text-slate-500">· {formatDateTime(r.created_at)}</span>
                                </div>
                                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{r.logged_by_name || "System"}</p>
                                <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">{r.notes}</p>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-slate-400 uppercase tracking-wide dark:text-slate-500">Note</span>
                                <span className="text-xs text-slate-400 dark:text-slate-500">· {formatDateTime(r.created_at)}</span>
                              </div>
                              <p className="mt-1 text-slate-500 dark:text-slate-400 text-xs">{r.logged_by_name || "Logged"}</p>
                              {r.notes && <p className="mt-1 text-slate-700 dark:text-slate-300">{r.notes}</p>}
                            </>
                          )}
                          {!r.notes?.startsWith("Chase email sent") && (
                            <div className="mt-3 flex gap-2">
                              <Button type="button" size="sm" variant="outline" className="dark:border-slate-700 dark:hover:bg-slate-800"
                                onClick={() => { setEditingReceiptId(r.id); setEditDraft({ amount_received: String(r.amount_received || ""), date_received: r.date_received || "", notes: r.notes || "" }); }}>
                                <Edit className="mr-2 h-4 w-4" /> Edit
                              </Button>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── Bulk log modal ── */}
      <Dialog open={!!bulkLogGroup} onOpenChange={(open) => { if (!open && !bulkSaving) setBulkLogGroup(null); }}>
        <DialogContent className="max-w-md dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
              <ListChecks className="h-5 w-5" /> Log Total Payment
            </DialogTitle>
          </DialogHeader>
          {bulkLogGroup && (
            <div className="flex flex-col gap-4">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 p-3 text-sm">
                <p className="font-semibold text-slate-900 dark:text-slate-100">Contract #{bulkLogGroup.contractId}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{bulkLogGroup.payments.length} instalments · {formatMoney(bulkLogGroup.outstanding)} outstanding</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium dark:text-slate-300">Total Amount Received</Label>
                <Input type="number" step="0.01" min="0" value={bulkAmount}
                  onChange={(e) => setBulkAmount(e.target.value)}
                  className="dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium dark:text-slate-300">Date Received</Label>
                <Input type="date" value={bulkDate} onChange={(e) => setBulkDate(e.target.value)}
                  className="dark:border-slate-700 dark:bg-slate-950 dark:[color-scheme:dark]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-medium dark:text-slate-300">Notes <span className="font-normal text-slate-400">(optional)</span></Label>
                <textarea rows={2} className="w-full rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 dark:text-slate-100 px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="e.g. Received via BACS…" value={bulkNotes} onChange={(e) => setBulkNotes(e.target.value)} />
              </div>
              <Button className="w-full bg-black hover:bg-gray-900 text-white gap-2" disabled={bulkSaving || !bulkAmount || Number(bulkAmount) <= 0} onClick={submitBulkLog}>
                {bulkSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ListChecks className="h-4 w-4" />}
                Log {bulkAmount ? formatMoney(Number(bulkAmount)) : "Amount"} Across Instalments
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Chase Supplier Dialog ── */}
      <Dialog open={!!chaseDialog} onOpenChange={(open) => { if (!open) setChaseDialog(null); }}>
        <DialogContent className="max-w-sm dark:bg-slate-900">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 dark:text-slate-100">
              <Mail className="h-4 w-4 text-blue-500" />
              Chase Supplier
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Would you like to send a payment query email to the supplier before marking this as Chasing Supplier?
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="outline" className="dark:border-slate-700" onClick={() => confirmChaseDialog(false)}>
                No, just mark it
              </Button>
              <Button onClick={() => confirmChaseDialog(true)}>
                <Mail className="mr-2 h-4 w-4" /> Yes, compose email
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
