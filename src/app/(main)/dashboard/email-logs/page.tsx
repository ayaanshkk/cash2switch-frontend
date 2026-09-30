"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  ChevronLeft,
  ChevronRight,
  MailCheck,
  PieChart,
  RefreshCw,
  Search,
  Send,
  SlidersHorizontal,
  Users,
  X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";

type EmailLog = {
  id: number;
  sent_at: string;
  status: string;
  bucket_key: string;
  recipient_email: string;
  provider_message_id?: string | null;
  error_message?: string | null;
  contract_end_date?: string | null;
  service_label?: string | null;
  business_name?: string | null;
  customer_name?: string | null;
  site_address?: string | null;
  supplier_name?: string | null;
  advisor_name?: string | null;
  days_remaining?: number | null;
};

type BreakdownItem = {
  label: string;
  value: number;
};

type DailyItem = {
  label: string;
  sent: number;
  other: number;
  total: number;
};

type EmailLogResponse = {
  items: EmailLog[];
  advisors?: string[];
  page: number;
  page_size: number;
  total: number;
};

type EmailLogSummary = {
  sent_today: number;
  sent_last_7_days: number;
  failed_last_7_days: number;
  total_sent: number;
  total_logged: number;
  by_status: BreakdownItem[];
  by_advisor: BreakdownItem[];
  by_service: BreakdownItem[];
  daily: DailyItem[];
};

const pageSize = 25;

const emptySummary: EmailLogSummary = {
  sent_today: 0,
  sent_last_7_days: 0,
  failed_last_7_days: 0,
  total_sent: 0,
  total_logged: 0,
  by_status: [],
  by_advisor: [],
  by_service: [],
  daily: [],
};

const statusColors = ["#0f766e", "#d97706", "#dc2626", "#be123c", "#64748b", "#4d7c0f"];

function formatDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatShortDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value));
}

function statusVariant(status: string) {
  return status?.toLowerCase() === "sent" ? "secondary" : "outline";
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function toNumber(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function buildPieGradient(items: BreakdownItem[]) {
  const total = items.reduce((sum, item) => sum + item.value, 0);
  if (!total) return "conic-gradient(#e2e8f0 0deg 360deg)";

  let current = 0;
  const parts = items.map((item, index) => {
    const degrees = (item.value / total) * 360;
    const start = current;
    current += degrees;
    return `${statusColors[index % statusColors.length]} ${start}deg ${current}deg`;
  });
  return `conic-gradient(${parts.join(", ")})`;
}

export default function RenewalEmailLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [summary, setSummary] = useState<EmailLogSummary>(emptySummary);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [sort, setSort] = useState("sent_desc");
  const [sentFrom, setSentFrom] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [advisors, setAdvisors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = user?.role?.toLowerCase() || "";
  const isAdmin = userRole.includes("admin");
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);
  const maxDailyTotal = Math.max(...summary.daily.map((item) => item.total), 1);
  const maxAdvisorTotal = Math.max(...summary.by_advisor.map((item) => item.value), 1);

  const baseQuery = useMemo(() => {
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (advisor) params.set("advisor", advisor);
    if (sentFrom) params.set("sent_from", sentFrom);
    if (sentTo) params.set("sent_to", sentTo);
    if (sort) params.set("sort", sort);
    return params;
  }, [search, status, advisor, sentFrom, sentTo, sort]);

  const listQuery = useMemo(() => {
    const params = new URLSearchParams(baseQuery);
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    return params.toString();
  }, [baseQuery, page]);

  const summaryQuery = useMemo(() => baseQuery.toString(), [baseQuery]);

  const loadLogs = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const [listData, summaryData] = await Promise.all([
        fetchWithAuth(`/api/entrypoint/renewal-email-logs?${listQuery}`) as Promise<EmailLogResponse>,
        fetchWithAuth(`/api/entrypoint/renewal-email-logs/summary?${summaryQuery}`),
      ]);

      setLogs(Array.isArray(listData.items) ? listData.items : []);
      setAdvisors(Array.isArray(listData.advisors) ? listData.advisors : []);
      setTotal(Number(listData.total || 0));
      setSummary({
        sent_today: toNumber(summaryData.sent_today),
        sent_last_7_days: toNumber(summaryData.sent_last_7_days),
        failed_last_7_days: toNumber(summaryData.failed_last_7_days),
        total_sent: toNumber(summaryData.total_sent),
        total_logged: toNumber(summaryData.total_logged),
        by_status: Array.isArray(summaryData.by_status)
          ? summaryData.by_status.map((item: BreakdownItem) => ({ label: item.label, value: toNumber(item.value) }))
          : [],
        by_advisor: Array.isArray(summaryData.by_advisor)
          ? summaryData.by_advisor.map((item: BreakdownItem) => ({ label: item.label, value: toNumber(item.value) }))
          : [],
        by_service: Array.isArray(summaryData.by_service)
          ? summaryData.by_service.map((item: BreakdownItem) => ({ label: item.label, value: toNumber(item.value) }))
          : [],
        daily: Array.isArray(summaryData.daily)
          ? summaryData.daily.map((item: DailyItem) => ({
              label: item.label,
              sent: toNumber(item.sent),
              other: toNumber(item.other),
              total: toNumber(item.total),
            }))
          : [],
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load renewal email logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [listQuery, summaryQuery, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300">
        Admin access is required to view renewal email logs.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 rounded-xl bg-slate-50/90 p-6 md:p-8 dark:bg-slate-950/60 dark:text-slate-100">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500 dark:text-slate-400">
            Admin / Renewal automation
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-50">Email logs</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Review renewal email performance, delivery status, advisor activity, and sent history.
          </p>
        </div>
        <Button
          variant="outline"
          className="bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          onClick={loadLogs}
          disabled={loading}
        >
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {[
          { label: "Sent today", value: summary.sent_today, Icon: Send },
          { label: "Sent 7 days", value: summary.sent_last_7_days, Icon: MailCheck },
          { label: "Failed 7 days", value: summary.failed_last_7_days, Icon: AlertTriangle },
          { label: "Total sent", value: summary.total_sent, Icon: BarChart3 },
          { label: "Total logged", value: summary.total_logged, Icon: Users },
        ].map(({ label, value, Icon }, index) => (
          <div
            key={label}
            className="relative overflow-hidden rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <span
              className={[
                "absolute inset-x-0 top-0 h-1",
                "bg-teal-600 dark:bg-teal-500",
                "bg-blue-600 dark:bg-blue-500",
                "bg-rose-500 dark:bg-rose-500",
                "bg-violet-600 dark:bg-violet-500",
                "bg-slate-700 dark:bg-slate-500",
              ][index]}
            />
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
              <span
                className={[
                  "grid size-8 place-items-center rounded-md bg-teal-50 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300",
                  "grid size-8 place-items-center rounded-md bg-blue-50 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
                  "grid size-8 place-items-center rounded-md bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300",
                  "grid size-8 place-items-center rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300",
                  "grid size-8 place-items-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                ][index]}
              >
                <Icon className="size-4" />
              </span>
            </div>
            <p
              className={[
                "mt-3 text-3xl font-semibold text-teal-700 dark:text-teal-400",
                "mt-3 text-3xl font-semibold text-blue-700 dark:text-blue-400",
                "mt-3 text-3xl font-semibold text-rose-600 dark:text-rose-400",
                "mt-3 text-3xl font-semibold text-violet-700 dark:text-violet-400",
                "mt-3 text-3xl font-semibold text-slate-900 dark:text-slate-100",
              ][index]}
            >
              {loading ? "-" : value}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-md bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <SlidersHorizontal className="size-4" />
          </span>
          <div>
            <h2 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Filter email activity</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Use sent date, advisor, status, or text search.</p>
          </div>
        </div>
        <div className="grid items-end gap-3 xl:grid-cols-[minmax(220px,1fr)_160px_200px_190px_160px_160px]">
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Search
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                className="pl-9 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Search recipient, customer, advisor, or message id"
              />
            </div>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Status
            <select
              value={status}
              onChange={(event) => {
                setPage(1);
                setStatus(event.target.value);
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 shadow-xs outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-slate-700"
            >
              <option value="">All statuses</option>
              <option value="sent">Sent</option>
              <option value="failed">Failed</option>
              <option value="dry_run">Dry run</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Advisor
            <select
              value={advisor}
              onChange={(event) => {
                setPage(1);
                setAdvisor(event.target.value);
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 shadow-xs outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-slate-700"
            >
              <option value="">All advisors</option>
              {advisors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Sort by
            <select
              value={sort}
              onChange={(event) => {
                setPage(1);
                setSort(event.target.value);
              }}
              className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm font-normal text-slate-700 shadow-xs outline-none focus:border-slate-400 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-slate-700"
            >
              <option value="sent_desc">Uploaded recently</option>
              <option value="sent_asc">Oldest sent first</option>
              <option value="advisor_asc">Advisor A-Z</option>
              <option value="advisor_desc">Advisor Z-A</option>
              <option value="end_date_asc">End date soonest</option>
              <option value="end_date_desc">End date latest</option>
            </select>
          </label>
          <label className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            Sent from
            <Input
              type="date"
              value={sentFrom}
              onChange={(event) => {
                setPage(1);
                setSentFrom(event.target.value);
              }}
              aria-label="Sent from date"
              className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
            />
          </label>
          <div className="grid gap-1 text-xs font-medium text-slate-600 dark:text-slate-300">
            <span>Sent to</span>
            <div className="flex gap-2">
              <Input
                type="date"
                value={sentTo}
                onChange={(event) => {
                  setPage(1);
                  setSentTo(event.target.value);
                }}
                aria-label="Sent to date"
                className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
              />
              {(sentFrom || sentTo) && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    setPage(1);
                    setSentFrom("");
                    setSentTo("");
                  }}
                  title="Clear date range"
                  className="dark:border-slate-800 dark:hover:bg-slate-800"
                >
                  <X className="size-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            <AlertTriangle className="size-4" />
            {error}
          </div>
        ) : null}
      </div>

      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Delivery status</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Status split</h2>
            </div>
            <PieChart className="size-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center">
            <div
              className="grid size-40 shrink-0 place-items-center rounded-full border border-slate-200 dark:border-slate-800"
              style={{ background: buildPieGradient(summary.by_status) }}
            >
              <div className="grid size-24 place-items-center rounded-full border border-slate-100 bg-white text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <span className="text-2xl font-semibold text-slate-950 dark:text-slate-50">{summary.total_logged}</span>
                <span className="text-[11px] font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">logs</span>
              </div>
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              {summary.by_status.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">No status data for this range.</p>
              ) : (
                summary.by_status.map((item, index) => (
                  <div key={item.label} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 rounded-full"
                        style={{ backgroundColor: statusColors[index % statusColors.length] }}
                      />
                      <span className="truncate text-slate-700 dark:text-slate-300">{titleCase(item.label)}</span>
                    </div>
                    <span className="font-semibold text-slate-950 dark:text-slate-100">{item.value}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Recent activity</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Emails sent by day</h2>
            </div>
            <BarChart3 className="size-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-3 flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="size-2 rounded-sm bg-teal-600 dark:bg-teal-500" /> Total logged
            </span>
            <span>Last 14 days</span>
          </div>
          <div className="mt-4 flex min-h-44 items-end gap-2">
            {summary.daily.length === 0 ? (
              <p className="self-center text-sm text-slate-500 dark:text-slate-400">No daily data for this range.</p>
            ) : (
              summary.daily.map((item) => (
                <div key={item.label} className="flex flex-1 flex-col items-center gap-2">
                  <div className="flex h-36 w-full items-end rounded-md bg-slate-100 px-1 dark:bg-slate-800/80">
                    <div
                      className="w-full rounded-t-md bg-teal-600 dark:bg-teal-500"
                      style={{ height: `${Math.max((item.total / maxDailyTotal) * 100, 6)}%` }}
                      title={`${item.total} email logs`}
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 dark:text-slate-400">{formatShortDate(item.label)}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Advisor performance</p>
              <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Email volume by advisor</h2>
            </div>
            <Users className="size-5 text-slate-400 dark:text-slate-500" />
          </div>
          <div className="mt-5 space-y-3">
            {summary.by_advisor.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No advisor data for this range.</p>
            ) : (
              summary.by_advisor.map((item) => (
                <div key={item.label} className="grid grid-cols-[150px_1fr_42px] items-center gap-3 text-sm">
                  <span className="truncate text-slate-700 dark:text-slate-300">{item.label}</span>
                  <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-2 rounded-full bg-blue-600 dark:bg-blue-500"
                      style={{ width: `${Math.max((item.value / maxAdvisorTotal) * 100, 4)}%` }}
                    />
                  </div>
                  <span className="text-right font-semibold text-blue-700 dark:text-blue-400">{item.value}</span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Service split</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950 dark:text-slate-50">Electricity and water</h2>
          <div className="mt-5 grid gap-3">
            {summary.by_service.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">No service data for this range.</p>
            ) : (
              summary.by_service.map((item, index) => (
                <div key={item.label} className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950">
                  <div className="flex items-center gap-2">
                    <span
                      className={[
                        "size-2.5 rounded-full bg-teal-600 dark:bg-teal-500",
                        "size-2.5 rounded-full bg-blue-600 dark:bg-blue-500",
                      ][index % 2]}
                    />
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{item.label}</p>
                  </div>
                  <p
                    className={
                      index % 2 === 0
                        ? "mt-1 text-2xl font-semibold text-teal-700 dark:text-teal-400"
                        : "mt-1 text-2xl font-semibold text-blue-700 dark:text-blue-400"
                    }
                  >
                    {item.value}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-950 dark:text-slate-50">Sent email history</h2>
          </div>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {total} records
          </span>
        </div>
        <div className="overflow-hidden rounded-md border border-slate-200 dark:border-slate-800">
          <Table className="min-w-[920px] table-fixed">
            <colgroup>
              <col className="w-[24%]" />
              <col className="w-[28%]" />
              <col className="w-[16%]" />
              <col className="w-[11%]" />
              <col className="w-[9%]" />
              <col className="w-[12%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60">
                <TableHead className="dark:text-slate-400">Recipient</TableHead>
                <TableHead className="dark:text-slate-400">Customer</TableHead>
                <TableHead className="dark:text-slate-400">Advisor</TableHead>
                <TableHead className="dark:text-slate-400">Service</TableHead>
                <TableHead className="dark:text-slate-400">Status</TableHead>
                <TableHead className="dark:text-slate-400">Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-slate-200 dark:divide-slate-800">
              {logs.length === 0 ? (
                <TableRow className="dark:border-slate-800">
                  <TableCell colSpan={6} className="h-28 text-center text-slate-500 dark:text-slate-400">
                    {loading ? "Loading renewal email logs..." : "No renewal email logs found."}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id} className="dark:border-slate-800 dark:hover:bg-slate-800/50">
                    <TableCell className="whitespace-normal break-words pr-4 align-top font-medium leading-5 text-slate-950 dark:text-slate-100">
                      <span className="line-clamp-2">{log.recipient_email}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words pr-4 align-top leading-5">
                      <div className="line-clamp-2 font-medium text-slate-900 dark:text-slate-200">
                        {log.customer_name || log.business_name || "-"}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500 dark:text-slate-400">
                        {log.site_address || log.business_name || ""}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words pr-3 align-top leading-5">
                      <span className="line-clamp-2 text-slate-700 dark:text-slate-300">{log.advisor_name || "-"}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top text-slate-700 dark:text-slate-300">
                      {log.service_label || "-"}
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <Badge variant={statusVariant(log.status)} className="dark:border-slate-700">
                        {log.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top text-sm leading-5 text-slate-700 dark:text-slate-300">
                      {formatDate(log.sent_at)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <MailCheck className="size-4 text-slate-400 dark:text-slate-500" />
            {total} email log{total === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={loading || page <= 1}
              className="dark:border-slate-800 dark:hover:bg-slate-800"
            >
              <ChevronLeft />
              Previous
            </Button>
            <span className="min-w-24 text-center text-sm text-slate-600 dark:text-slate-400">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={loading || page >= totalPages}
              className="dark:border-slate-800 dark:hover:bg-slate-800"
            >
              Next
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}