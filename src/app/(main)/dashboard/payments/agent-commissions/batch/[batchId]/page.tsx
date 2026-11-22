"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  Download,
  Loader2,
  RefreshCcw,
  RotateCcw,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { API_BASE_URL, fetchWithAuth } from "@/lib/api";

type BatchItem = {
  id: string;
  commission_payment_receipt_id?: string | null;
  client_name: string | null;
  date_received?: string | null;
  receipt_amount?: string;
  commission_rate: string;
  commission_amount: string;
  status: string;
};

type LogEntry = {
  id: string;
  amount: string;
  date: string;
  notes: string | null;
  logged_at: string;
  receipt_id?: string | null;
};

type Batch = {
  id: string;
  agent_name: string;
  batch_month: string;
  total_amount: string;
  amount_paid: string;
  payment_log: LogEntry[];
  status: string;
  paid_at: string | null;
  items: BatchItem[];
};

const fmt = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" });
const money = (v?: string | number | null) => fmt.format(Number(v || 0));

const fmtDate = (v?: string | null) => {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(v));
};
const fmtDateTime = (v?: string | null) => {
  if (!v) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(v));
};

const statusCls: Record<string, string> = {
  "Awaiting Payment": "bg-amber-100 text-amber-800",
  "Partially Paid":   "bg-blue-100 text-blue-800",
  "Commission Paid":  "bg-emerald-100 text-emerald-700",
};

export default function BatchDetailPage() {
  const params = useParams();
  const router = useRouter();
  const batchId = params?.batchId as string;

  const [batch, setBatch] = useState<Batch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const msgRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // payment form
  const [amount, setAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // statement selection
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [downloading, setDownloading] = useState(false);

  const showMsg = (msg: string) => {
    setMessage(msg);
    if (msgRef.current) clearTimeout(msgRef.current);
    msgRef.current = setTimeout(() => setMessage(null), 4000);
  };

  const load = async () => {
    setLoading(true); setError(null);
    try {
      const data = await fetchWithAuth(`/api/commission/batches/${batchId}`);
      setBatch(data.batch);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const submitPayment = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amt = Number(amount);
    if (!amount || isNaN(amt) || amt <= 0) { setFormError("Enter a valid amount."); return; }
    setSaving("pay");
    try {
      await fetchWithAuth(`/api/commission/batches/${batchId}/log-payment`, {
        method: "POST",
        body: JSON.stringify({ amount_paid: amount, payment_date: payDate, notes: notes || null, receipt_id: null }),
      });
      showMsg(`Payment of ${money(amt)} logged.`);
      setAmount(""); setNotes("");
      await load();
    } catch (e) { setFormError(e instanceof Error ? e.message : "Failed to log payment"); }
    finally { setSaving(null); }
  };

  const reversePayment = async (logEntryId: string) => {
    setSaving(`rev-${logEntryId}`);
    try {
      await fetchWithAuth(`/api/commission/batches/${batchId}/reverse-payment`, {
        method: "POST",
        body: JSON.stringify({ log_entry_id: logEntryId }),
      });
      showMsg("Payment reversed.");
      await load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed to reverse"); }
    finally { setSaving(null); }
  };

  const downloadStatement = async (receiptIds: string[]) => {
    if (!receiptIds.length) return;
    setDownloading(true);
    try {
      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const res = await fetch(`${API_BASE_URL}/api/commission/statement/custom`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ receipt_ids: receiptIds, agent_name: batch?.agent_name ?? "Agent" }),
      });
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const url = URL.createObjectURL(await res.blob());
      Object.assign(document.createElement("a"), {
        href: url,
        download: `commission-${batch?.agent_name?.replace(/\s+/g, "-") ?? "agent"}-${batch?.batch_month ?? "batch"}.pdf`,
      }).click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e instanceof Error ? e.message : "Download failed"); }
    finally { setDownloading(false); }
  };

  const selectableIds = (batch?.items ?? [])
    .map((i) => i.commission_payment_receipt_id)
    .filter(Boolean) as string[];
  const allChecked = selectableIds.length > 0 && selectableIds.every((id) => selected.has(id));
  const someChecked = selectableIds.some((id) => selected.has(id)) && !allChecked;
  const selectedList = selectableIds.filter((id) => selected.has(id));
  const selectedTotal = (batch?.items ?? [])
    .filter((i) => i.commission_payment_receipt_id && selected.has(i.commission_payment_receipt_id))
    .reduce((s, i) => s + Number(i.commission_amount || 0), 0);

  const totalAmt   = Number(batch?.total_amount || 0);
  const paidAmt    = Number(batch?.amount_paid || 0);
  const outstanding = Math.max(totalAmt - paidAmt, 0);
  const isFullyPaid = batch?.status === "Commission Paid";

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <button
                type="button"
                className="mb-3 inline-flex items-center text-sm font-medium text-slate-500 hover:text-slate-900"
                onClick={() => router.push("/dashboard/payments/agent-commissions")}
              >
                <ArrowLeft className="mr-1.5 h-4 w-4" />
                Back to Agent Commissions
              </button>
              <h1 className="text-2xl font-semibold tracking-tight text-slate-950">
                {batch ? `${batch.agent_name} — ${fmtDate(batch.batch_month)}` : "Commission Batch"}
              </h1>
              <p className="mt-1 text-sm text-slate-500">Commission payment management &amp; statement download</p>
            </div>
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {error   && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-lg border bg-white text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : !batch ? null : (
          <>
            {/* Summary cards */}
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {[
                { label: "Total Commission", value: money(totalAmt),   cls: "" },
                { label: "Paid",             value: money(paidAmt),    cls: "text-emerald-700" },
                { label: "Outstanding",      value: money(outstanding), cls: outstanding > 0 ? "text-orange-700" : "text-slate-900" },
                { label: "Status",           isStatus: true },
              ].map(({ label, value, cls, isStatus }) => (
                <Card key={label} className="border-slate-200 shadow-sm">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium text-slate-500">{label}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {isStatus ? (
                      <Badge className={statusCls[batch.status] ?? "bg-slate-100 text-slate-700"}>{batch.status}</Badge>
                    ) : (
                      <span className={`text-2xl font-semibold ${cls}`}>{value}</span>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Log Payment form */}
            {!isFullyPaid && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Log Payment</CardTitle>
                </CardHeader>
                <CardContent>
                  <form onSubmit={submitPayment} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-1.5">
                        <Label htmlFor="amt">Amount <span className="text-red-500">*</span></Label>
                        <div className="relative">
                          <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">£</span>
                          <Input
                            id="amt"
                            type="number" step="0.01" min="0.01"
                            placeholder={outstanding > 0 ? outstanding.toFixed(2) : "0.00"}
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="pl-6"
                          />
                        </div>
                        {Number(amount) > 0 && (
                          <p className={`text-xs ${Number(amount) >= outstanding ? "text-emerald-600" : "text-orange-600"}`}>
                            {Number(amount) >= outstanding ? "Full payment — will mark as Commission Paid" : "Partial payment"}
                          </p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="pdate">Payment date</Label>
                        <Input id="pdate" type="date" value={payDate} onChange={(e) => setPayDate(e.target.value)} />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="notes">Notes <span className="text-slate-400 font-normal">(optional)</span></Label>
                      <textarea
                        id="notes"
                        rows={2}
                        placeholder="e.g. Paid via bank transfer, ref #12345"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                      />
                    </div>
                    {formError && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>}
                    <Button type="submit" disabled={!!saving}>
                      {saving === "pay" && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      Log Payment
                    </Button>
                  </form>
                </CardContent>
              </Card>
            )}

            {/* Payment History */}
            {batch.payment_log.length > 0 && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Payment History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {batch.payment_log.map((entry) => (
                      <div key={entry.id} className="flex items-start justify-between px-5 py-4">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{money(entry.amount)}</p>
                          <p className="mt-0.5 text-xs text-slate-500">
                            {fmtDate(entry.date)}{entry.notes ? ` · ${entry.notes}` : ""}
                          </p>
                          <p className="text-xs text-slate-400">{fmtDateTime(entry.logged_at)}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => reversePayment(entry.id)}
                          disabled={!!saving}
                          className="flex items-center gap-1.5 rounded-md border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40"
                        >
                          {saving === `rev-${entry.id}` ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <RotateCcw className="h-3 w-3" />
                          )}
                          Reverse
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Commission Items with statement download */}
            <Card className="border-slate-200 shadow-sm">
              <CardHeader className="pb-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">Commission Items</CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedList.length > 0 && (
                      <Button size="sm" onClick={() => downloadStatement(selectedList)} disabled={downloading}>
                        {downloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                        Download Selected ({selectedList.length}) — {money(selectedTotal)}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => downloadStatement(selectableIds)}
                      disabled={downloading || selectableIds.length === 0}
                    >
                      {downloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                      Download All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto border-t border-slate-100">
                  <table className="w-full min-w-[640px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="w-10 px-4 py-3">
                          <input
                            type="checkbox"
                            checked={allChecked}
                            ref={(el) => { if (el) el.indeterminate = someChecked; }}
                            onChange={() => {
                              setSelected(allChecked
                                ? new Set()
                                : new Set(selectableIds));
                            }}
                            className="h-4 w-4 rounded border-slate-300 accent-slate-800 cursor-pointer"
                            title="Select all"
                          />
                        </th>
                        <th className="px-4 py-3">Client</th>
                        <th className="px-4 py-3">Receipt Date</th>
                        <th className="px-4 py-3 text-right">Supplier Receipt</th>
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-right">Commission</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {batch.items.length === 0 ? (
                        <tr><td colSpan={6} className="px-4 py-10 text-center text-slate-500">No items in this batch.</td></tr>
                      ) : batch.items.map((item) => {
                        const rid = item.commission_payment_receipt_id;
                        const checked = !!rid && selected.has(rid);
                        return (
                          <tr key={item.id} className={`transition-colors ${checked ? "bg-blue-50" : "hover:bg-slate-50"}`}>
                            <td className="px-4 py-3">
                              {rid && (
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => {
                                    setSelected((prev) => {
                                      const s = new Set(prev);
                                      s.has(rid) ? s.delete(rid) : s.add(rid);
                                      return s;
                                    });
                                  }}
                                  className="h-4 w-4 rounded border-slate-300 accent-slate-800 cursor-pointer"
                                />
                              )}
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-900">{item.client_name || "—"}</td>
                            <td className="px-4 py-3 text-slate-500">{fmtDate(item.date_received)}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{money(item.receipt_amount)}</td>
                            <td className="px-4 py-3 text-right text-slate-700">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{money(item.commission_amount)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    {batch.items.length > 0 && (
                      <tfoot>
                        <tr className="border-t border-slate-200 bg-slate-50">
                          <td colSpan={5} className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">Total</td>
                          <td className="px-4 py-3 text-right font-bold text-slate-900">{money(totalAmt)}</td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
