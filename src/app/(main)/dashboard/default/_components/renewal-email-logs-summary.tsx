"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, MailCheck, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { fetchWithAuth } from "@/lib/api";

type LatestEmailLog = {
  id: number;
  sent_at: string;
  status: string;
  recipient_email: string;
  business_name?: string | null;
  customer_name?: string | null;
  service_label?: string | null;
  bucket_key?: string | null;
};

type EmailLogSummary = {
  sent_today: number;
  sent_last_7_days: number;
  failed_last_7_days: number;
  total_sent: number;
  total_logged: number;
  latest: LatestEmailLog[];
};

const emptySummary: EmailLogSummary = {
  sent_today: 0,
  sent_last_7_days: 0,
  failed_last_7_days: 0,
  total_sent: 0,
  total_logged: 0,
  latest: [],
};

function formatDate(value?: string) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function RenewalEmailLogsSummary() {
  const [summary, setSummary] = useState<EmailLogSummary>(emptySummary);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth("/internal/admin/renewal-email-logs/summary");
      setSummary({
        sent_today: Number(data.sent_today || 0),
        sent_last_7_days: Number(data.sent_last_7_days || 0),
        failed_last_7_days: Number(data.failed_last_7_days || 0),
        total_sent: Number(data.total_sent || 0),
        total_logged: Number(data.total_logged || 0),
        latest: Array.isArray(data.latest) ? data.latest : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load email logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSummary();
  }, []);

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Renewal email automation
          </p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Email logs</h2>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadSummary} disabled={loading}>
            <RefreshCw className={loading ? "animate-spin" : ""} />
            Refresh
          </Button>
          <Button asChild size="sm">
            <Link href="/dashboard/email-logs">
              <MailCheck />
              View all
            </Link>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="size-4" />
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 sm:grid-cols-4">
        {[
          ["Sent today", summary.sent_today],
          ["Sent 7 days", summary.sent_last_7_days],
          ["Failed 7 days", summary.failed_last_7_days],
          ["Total sent", summary.total_sent],
        ].map(([label, value]) => (
          <div key={label} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-slate-950">
              {loading ? "-" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-5 overflow-hidden rounded-md border border-slate-200">
        <div className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Recipient</span>
          <span>Customer</span>
          <span>Status</span>
          <span>Sent</span>
        </div>
        {summary.latest.length === 0 ? (
          <div className="px-3 py-5 text-sm text-slate-500">
            {loading ? "Loading recent emails..." : "No renewal emails logged yet."}
          </div>
        ) : (
          summary.latest.map((log) => (
            <div
              key={log.id}
              className="grid grid-cols-[1.2fr_1fr_0.8fr_0.8fr] items-center gap-3 border-t border-slate-100 px-3 py-3 text-sm"
            >
              <span className="min-w-0 truncate font-medium text-slate-900">{log.recipient_email}</span>
              <span className="min-w-0 truncate text-slate-600">
                {log.customer_name || log.business_name || "-"}
              </span>
              <Badge variant={log.status === "sent" ? "secondary" : "outline"}>{log.status}</Badge>
              <span className="text-slate-500">{formatDate(log.sent_at)}</span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
