"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import { ArrowLeft, BadgePoundSterling, CalendarCheck, CheckCircle2, Clock3, Loader2, RefreshCcw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchWithAuth } from "@/lib/api";

type PaymentLog = {
  success: boolean;
  is_admin: boolean;
  client_id: number;
  totals: {
    payment_count: number;
    receipt_count: number;
    agent_commission_count: number;
    total_expected?: string;
    total_received?: string;
    total_outstanding?: string;
  };
  payments: Array<{
    id: string;
    contract_id: number | null;
    instalment_year: number;
    payment_policy_type: string | null;
    payment_period_label: string | null;
    payment_period_start: string | null;
    payment_period_end: string | null;
    supplier_name: string | null;
    aggregator: string | null;
    agent_name: string | null;
    due_date: string | null;
    status: string;
    last_checked_at: string | null;
    next_follow_up_date: string | null;
    expected_net_amount?: string;
    amount_received?: string;
    outstanding_amount?: string;
  }>;
  receipts: Array<{
    id: string;
    contract_id: number | null;
    instalment_year: number | null;
    payment_period_label: string | null;
    amount_received: string;
    date_received: string | null;
    notes: string | null;
    logged_by_name: string | null;
    created_at: string | null;
  }>;
  agent_commissions: Array<{
    id: string;
    contract_id: number | null;
    instalment_year: number | null;
    payment_period_label: string | null;
    commission_rate: string;
    commission_amount: string;
    batch_month: string | null;
    status: string;
    receipt_amount?: string;
    created_at: string | null;
  }>;
};

type PaymentGroup = {
  contractId: number | null;
  payments: PaymentLog["payments"];
};

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatMoney = (value?: string | number | null) => moneyFormatter.format(Number(value || 0));

const formatDate = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

const statusTone = (status?: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "received" || normalized === "commission paid") return "bg-emerald-100 text-emerald-700";
  if (normalized === "pending") return "bg-blue-100 text-blue-700";
  if (normalized === "partially paid" || normalized === "awaiting payment") return "bg-orange-100 text-orange-800";
  if (normalized === "chasing supplier" || normalized === "due") return "bg-red-100 text-red-700";
  if (normalized === "closed") return "bg-zinc-200 text-zinc-700";
  return "bg-slate-100 text-slate-700";
};

export default function PaymentHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params?.client_id as string;
  const [log, setLog] = useState<PaymentLog | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const groupedPayments = useMemo<PaymentGroup[]>(() => {
    if (!log) return [];
    const groups = new Map<string, PaymentGroup>();

    log.payments.forEach((payment) => {
      const key = payment.contract_id ? String(payment.contract_id) : payment.id;
      const group = groups.get(key) || {
        contractId: payment.contract_id,
        payments: [],
      };
      group.payments.push(payment);
      groups.set(key, group);
    });

    return Array.from(groups.values()).map((group) => ({
      ...group,
      payments: group.payments.slice().sort((a, b) => a.instalment_year - b.instalment_year),
    }));
  }, [log]);

  const loadLog = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchWithAuth(`/api/commission/customer-log/${clientId}`);
      setLog(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment history");
      setLog(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <button
                type="button"
                className="mb-3 inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-950"
                onClick={() => router.push("/dashboard/payments")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Payment Checker
              </button>
              <p className="text-sm font-medium text-slate-500">Payments</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Payment History</h1>
              <p className="mt-2 text-sm text-slate-600">
                Customer #{clientId} commission schedule, supplier receipts, and agent commission history.
              </p>
            </div>
            <Button onClick={loadLog} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <div className="flex min-h-64 items-center justify-center rounded-lg border bg-white text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Loading payment history...
          </div>
        ) : !log ? (
          <div className="rounded-lg border border-dashed bg-white px-4 py-12 text-center text-slate-500">
            No payment history found for this customer.
          </div>
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <BadgePoundSterling className="h-4 w-4 text-slate-900" />
                    Expected
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {log.is_admin ? formatMoney(log.totals.total_expected) : `${log.totals.payment_count} rows`}
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Received
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {log.is_admin ? formatMoney(log.totals.total_received) : `${log.totals.agent_commission_count} items`}
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <Clock3 className="h-4 w-4 text-orange-600" />
                    Outstanding
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">
                  {log.is_admin ? formatMoney(log.totals.total_outstanding) : "Own view"}
                </CardContent>
              </Card>
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                    <CalendarCheck className="h-4 w-4 text-blue-600" />
                    Receipts
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{log.totals.receipt_count}</CardContent>
              </Card>
            </div>

            <div className="space-y-4">
              {groupedPayments.map((group, index) => (
                <section
                  key={`${group.contractId}-${index}`}
                  className="overflow-hidden rounded-lg border bg-white shadow-sm"
                >
                  <div className="border-l-4 border-l-slate-950 px-5 py-4">
                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h2 className="text-lg font-semibold text-slate-950">Contract #{group.contractId || "-"}</h2>
                        <p className="text-sm text-slate-500">
                          {group.payments.length} instalment{group.payments.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {Array.from(new Set(group.payments.map((payment) => payment.status))).map((status) => (
                          <Badge key={status} className={statusTone(status)}>
                            {status}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="overflow-x-auto border-t">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                        <tr>
                          <th className="px-4 py-3">Year</th>
                          <th className="px-4 py-3">Supplier</th>
                          <th className="px-4 py-3">Aggregator</th>
                          <th className="px-4 py-3">Agent</th>
                          {log.is_admin && <th className="px-4 py-3 text-right">Expected</th>}
                          <th className="px-4 py-3">Due Date</th>
                          {log.is_admin && <th className="px-4 py-3 text-right">Received</th>}
                          {log.is_admin && <th className="px-4 py-3 text-right">Outstanding</th>}
                          <th className="px-4 py-3">Status</th>
                          <th className="px-4 py-3">Last Checked</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {group.payments.map((payment) => (
                          <tr key={payment.id}>
                            <td className="px-4 py-3 font-medium text-slate-950">
                              {payment.payment_period_label || `Year ${payment.instalment_year}`}
                            </td>
                            <td className="px-4 py-3 text-slate-700">{payment.supplier_name || "-"}</td>
                            <td className="px-4 py-3 text-slate-700">{payment.aggregator || "-"}</td>
                            <td className="px-4 py-3 text-slate-700">{payment.agent_name || "-"}</td>
                            {log.is_admin && (
                              <td className="px-4 py-3 text-right font-medium">
                                {formatMoney(payment.expected_net_amount)}
                              </td>
                            )}
                            <td className="px-4 py-3 text-slate-700">{formatDate(payment.due_date)}</td>
                            {log.is_admin && (
                              <td className="px-4 py-3 text-right">{formatMoney(payment.amount_received)}</td>
                            )}
                            {log.is_admin && (
                              <td className="px-4 py-3 text-right font-medium">
                                {formatMoney(payment.outstanding_amount)}
                              </td>
                            )}
                            <td className="px-4 py-3">
                              <Badge className={statusTone(payment.status)}>{payment.status}</Badge>
                            </td>
                            <td className="px-4 py-3 text-slate-700">{formatDateTime(payment.last_checked_at)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ))}
            </div>

            {log.is_admin && (
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Supplier Receipt History</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {log.receipts.map((receipt) => (
                      <div key={receipt.id} className="grid gap-3 px-5 py-4 text-sm md:grid-cols-[1fr_auto_auto]">
                        <div>
                          <p className="font-medium text-slate-950">
                            Contract #{receipt.contract_id || "-"} · {receipt.payment_period_label || `Year ${receipt.instalment_year || "-"}`}
                          </p>
                          <p className="text-slate-500">
                            Logged by {receipt.logged_by_name || "Unknown"} · {formatDateTime(receipt.created_at)}
                          </p>
                          {receipt.notes && <p className="mt-1 text-slate-700">{receipt.notes}</p>}
                        </div>
                        <div className="font-semibold">{formatMoney(receipt.amount_received)}</div>
                        <div className="text-slate-500">{formatDate(receipt.date_received)}</div>
                      </div>
                    ))}
                    {log.receipts.length === 0 && (
                      <div className="px-5 py-10 text-center text-sm text-slate-500">No receipts logged yet.</div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Agent Commission Entries</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      <tr>
                        <th className="px-4 py-3">Contract / Year</th>
                        {log.is_admin && <th className="px-4 py-3 text-right">Receipt Amount</th>}
                        <th className="px-4 py-3 text-right">Rate</th>
                        <th className="px-4 py-3 text-right">Commission</th>
                        <th className="px-4 py-3">Batch Month</th>
                        <th className="px-4 py-3">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y bg-white">
                      {log.agent_commissions.map((item) => (
                        <tr key={item.id}>
                          <td className="px-4 py-3 font-medium text-slate-950">
                            Contract #{item.contract_id || "-"}
                            <span className="block text-xs text-slate-500">
                              {item.payment_period_label || `Year ${item.instalment_year || "-"}`}
                            </span>
                          </td>
                          {log.is_admin && <td className="px-4 py-3 text-right">{formatMoney(item.receipt_amount)}</td>}
                          <td className="px-4 py-3 text-right">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                          <td className="px-4 py-3 text-right font-semibold">{formatMoney(item.commission_amount)}</td>
                          <td className="px-4 py-3 text-slate-700">{formatDate(item.batch_month)}</td>
                          <td className="px-4 py-3">
                            <Badge className={statusTone(item.status)}>{item.status}</Badge>
                          </td>
                        </tr>
                      ))}
                      {log.agent_commissions.length === 0 && (
                        <tr>
                          <td colSpan={log.is_admin ? 6 : 5} className="px-4 py-10 text-center text-slate-500">
                            No agent commission entries found yet.
                          </td>
                        </tr>
                      )}
                    </tbody>
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
