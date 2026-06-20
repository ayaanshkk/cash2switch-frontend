"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronLeft, ChevronRight, MailCheck, RefreshCw, Search } from "lucide-react";

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

type EmailLogResponse = {
  items: EmailLog[];
  advisors?: string[];
  page: number;
  page_size: number;
  total: number;
};

const pageSize = 25;

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

function formatPlainDate(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
}

function statusVariant(status: string) {
  return status?.toLowerCase() === "sent" ? "secondary" : "outline";
}

export default function RenewalEmailLogsPage() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [advisor, setAdvisor] = useState("");
  const [sort, setSort] = useState("sent_desc");
  const [advisors, setAdvisors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userRole = user?.role?.toLowerCase() || "";
  const isAdmin = userRole.includes("admin");
  const totalPages = Math.max(Math.ceil(total / pageSize), 1);

  const query = useMemo(() => {
    const params = new URLSearchParams({
      page: String(page),
      page_size: String(pageSize),
    });
    if (search.trim()) params.set("search", search.trim());
    if (status) params.set("status", status);
    if (advisor) params.set("advisor", advisor);
    if (sort) params.set("sort", sort);
    return params.toString();
  }, [page, search, status, advisor, sort]);

  const loadLogs = async () => {
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    try {
      const data = (await fetchWithAuth(`/api/entrypoint/renewal-email-logs?${query}`)) as EmailLogResponse;
      setLogs(Array.isArray(data.items) ? data.items : []);
      setAdvisors(Array.isArray(data.advisors) ? data.advisors : []);
      setTotal(Number(data.total || 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load renewal email logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [query, isAdmin]);

  if (!isAdmin) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-amber-800">
        Admin access is required to view renewal email logs.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 rounded-2xl bg-slate-50/90 p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Admin / Renewal automation
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-slate-900">Email logs</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Review renewal emails sent by the automation, including recipient, customer, advisor,
            service, status, and sent date.
          </p>
        </div>
        <Button variant="outline" onClick={loadLogs} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : ""} />
          Refresh
        </Button>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_180px_220px_220px]">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => {
                setPage(1);
                setSearch(event.target.value);
              }}
              className="pl-9"
              placeholder="Search recipient, customer, advisor, or message id"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setPage(1);
              setStatus(event.target.value);
            }}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none focus:border-slate-400"
            aria-label="Filter by email status"
          >
            <option value="">All statuses</option>
            <option value="sent">Sent</option>
            <option value="failed">Failed</option>
            <option value="dry_run">Dry run</option>
          </select>
          <select
            value={advisor}
            onChange={(event) => {
              setPage(1);
              setAdvisor(event.target.value);
            }}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none focus:border-slate-400"
            aria-label="Filter by renewal advisor"
          >
            <option value="">All advisors</option>
            {advisors.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <select
            value={sort}
            onChange={(event) => {
              setPage(1);
              setSort(event.target.value);
            }}
            className="h-9 rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-xs outline-none focus:border-slate-400"
            aria-label="Sort email logs"
          >
            <option value="sent_desc">Uploaded recently</option>
            <option value="sent_asc">Oldest sent first</option>
            <option value="advisor_asc">Advisor A-Z</option>
            <option value="advisor_desc">Advisor Z-A</option>
            <option value="end_date_asc">End date soonest</option>
            <option value="end_date_desc">End date latest</option>
          </select>
        </div>

        {error ? (
          <div className="mt-4 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="size-4" />
            {error}
          </div>
        ) : null}

        <div className="mt-4 overflow-hidden rounded-md border border-slate-200">
          <Table className="min-w-[980px] table-fixed">
            <colgroup>
              <col className="w-[22%]" />
              <col className="w-[25%]" />
              <col className="w-[14%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
              <col className="w-[8%]" />
              <col className="w-[9%]" />
            </colgroup>
            <TableHeader>
              <TableRow className="bg-slate-50">
                <TableHead>Recipient</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Advisor</TableHead>
                <TableHead>Service</TableHead>
                <TableHead>End date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-28 text-center text-slate-500">
                    {loading ? "Loading renewal email logs..." : "No renewal email logs found."}
                  </TableCell>
                </TableRow>
              ) : (
                logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="whitespace-normal break-words pr-4 align-top font-medium leading-5 text-slate-950">
                      <span className="line-clamp-2">{log.recipient_email}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words pr-4 align-top leading-5">
                      <div className="line-clamp-2 font-medium text-slate-900">
                        {log.customer_name || log.business_name || "-"}
                      </div>
                      <div className="mt-1 line-clamp-2 text-xs leading-4 text-slate-500">
                        {log.site_address || log.business_name || ""}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal break-words pr-3 align-top leading-5">
                      <span className="line-clamp-2">{log.advisor_name || "-"}</span>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">{log.service_label || "-"}</TableCell>
                    <TableCell className="whitespace-normal align-top leading-5">
                      <div>{formatPlainDate(log.contract_end_date)}</div>
                      <div className="text-xs text-slate-500">
                        {typeof log.days_remaining === "number" ? `${log.days_remaining} days` : ""}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top">
                      <Badge variant={statusVariant(log.status)}>{log.status}</Badge>
                    </TableCell>
                    <TableCell className="whitespace-normal align-top text-sm leading-5">{formatDate(log.sent_at)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <MailCheck className="size-4 text-slate-400" />
            {total} email log{total === 1 ? "" : "s"}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.max(current - 1, 1))}
              disabled={loading || page <= 1}
            >
              <ChevronLeft />
              Previous
            </Button>
            <span className="min-w-24 text-center text-sm text-slate-600">
              Page {page} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((current) => Math.min(current + 1, totalPages))}
              disabled={loading || page >= totalPages}
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
