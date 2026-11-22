"use client";

import { useEffect, useState } from "react";
import { Loader2, BadgePoundSterling, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchWithAuth } from "@/lib/api";

type CommissionItem = {
  id: string;
  client_id: number | null;
  client_name: string | null;
  date_received: string | null;
  receipt_amount: string;
  commission_rate: string;
  commission_amount: string;
};

type CommissionBatch = {
  id: string;
  batch_month: string | null;
  status: string;
  total_amount: string;
  paid_at: string | null;
  items: CommissionItem[];
};

type Summary = {
  total_paid: string;
  total_pending: string;
  batch_count: number;
};

function fmt(d: string | null | undefined) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return d; }
}

export default function CommissionPage() {
  const [batches, setBatches] = useState<CommissionBatch[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchWithAuth("/api/commission/my-agent-commissions")
      .then((d) => {
        setBatches(d.batches || []);
        setSummary(d.summary || null);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load commissions"))
      .finally(() => setLoading(false));
  }, []);

  const isPaid = (status: string) => status === "Commission Paid";

  return (
    <div className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-6">

        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
            My Commission
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Your commission payments from supplier receipts.
          </p>
        </div>

        {/* Summary cards */}
        {summary && (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/40 dark:bg-emerald-950/20">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-400 opacity-80">Total Paid</p>
              <p className="mt-1 text-2xl font-bold text-emerald-800 dark:text-emerald-300">£{summary.total_paid}</p>
            </div>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
              <p className="text-xs font-medium uppercase tracking-wide text-amber-700 dark:text-amber-400 opacity-80">Awaiting Payment</p>
              <p className="mt-1 text-2xl font-bold text-amber-800 dark:text-amber-300">£{summary.total_pending}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900 col-span-2 sm:col-span-1">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 opacity-80">Total Months</p>
              <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-slate-200">{summary.batch_count}</p>
            </div>
          </div>
        )}

        {/* Loading / error */}
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        )}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Empty */}
        {!loading && !error && batches.length === 0 && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-16 text-center">
            <BadgePoundSterling className="mx-auto mb-3 h-10 w-10 text-slate-300 dark:text-slate-600" />
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No commission records yet</p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">Commission is generated when supplier receipts are logged against your contracts.</p>
          </div>
        )}

        {/* Batch cards */}
        {!loading && batches.map((batch) => (
          <div
            key={batch.id}
            className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            {/* Batch header */}
            <div className="flex items-center justify-between gap-4 px-5 py-4">
              <div>
                <p className="text-base font-semibold text-slate-900 dark:text-slate-100">
                  {batch.batch_month || "—"}
                </p>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Paid: <span className={`font-semibold ${isPaid(batch.status) ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>£{batch.total_amount}</span>
                  {batch.paid_at && (
                    <span className="ml-2 text-slate-400 dark:text-slate-500">· {fmt(batch.paid_at)}</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Badge
                  className={isPaid(batch.status)
                    ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 gap-1"
                    : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300 gap-1"}
                >
                  {isPaid(batch.status)
                    ? <><CheckCircle2 className="h-3 w-3" /> Commission Paid</>
                    : <><Clock className="h-3 w-3" /> Awaiting Payment</>}
                </Badge>
              </div>
            </div>

            {/* Items table */}
            {batch.items.length > 0 && (
              <div className="border-t border-slate-100 dark:border-slate-800">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 dark:bg-slate-800/50">
                      <th className="px-5 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Client</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Receipt Date</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Supplier Receipt</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Rate</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Commission</th>
                      <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {batch.items.map((item) => (
                      <tr
                        key={item.id}
                        onClick={() => item.client_id && window.open(`/dashboard/renewals/${item.client_id}`, "_blank")}
                        className={`transition-colors hover:bg-slate-50/60 dark:hover:bg-slate-800/40 ${item.client_id ? "cursor-pointer" : ""}`}
                      >
                        <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-200">
                          {item.client_name || "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {fmt(item.date_received)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-700 dark:text-slate-300">
                          £{item.receipt_amount}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400">
                          {item.commission_rate}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">
                          £{item.commission_amount}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge
                            className={isPaid(batch.status)
                              ? "bg-emerald-100 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300"
                              : "bg-amber-100 text-amber-800 hover:bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300"}
                          >
                            {isPaid(batch.status) ? "✓ Paid" : "Pending"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
