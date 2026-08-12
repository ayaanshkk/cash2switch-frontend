"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Banknote,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Layers3,
  Loader2,
  ReceiptText,
  Search,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/api";

type PaymentStatus = "Scheduled" | "Pending" | "Due" | "Received" | "Partially Paid" | "Chasing Supplier" | "Closed";

type CommissionPayment = {
  id: string;
  client_id: number | null;
  project_id: number | null;
  contract_id: number | null;
  supplier_id: number | null;
  employee_id: number | null;
  instalment_year: number;
  payment_policy_type: string | null;
  payment_period_label: string | null;
  payment_period_start: string | null;
  payment_period_end: string | null;
  customer_name: string | null;
  business_name: string | null;
  supplier_name: string | null;
  mpan_number: string | null;
  mpan_bottom: string | null;
  contract_start_date: string | null;
  contract_end_date: string | null;
  service_id: number | null;
  service_title: string | null;
  aggregator: string | null;
  agent_name: string | null;
  expected_net_amount: string;
  due_date: string | null;
  amount_received: string;
  outstanding_amount: string;
  status: PaymentStatus;
  last_checked_at: string | null;
  next_follow_up_date: string | null;
};

type Receipt = {
  id: string;
  amount_received: string;
  date_received: string | null;
  notes: string | null;
  logged_by_name: string | null;
  created_at: string | null;
};

type FilterOption = {
  supplier_id?: number;
  supplier_name?: string | null;
  employee_id?: number;
  employee_name?: string | null;
};

type PaymentPagination = {
  page: number;
  page_size: number;
  total: number;
  total_pages: number;
};

type PaymentGroup = {
  key: string;
  clientId: number | null;
  title: string;
  subtitle: string;
  mpan: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
  serviceTitle: string | null;
  payments: CommissionPayment[];
  expected: number;
  received: number;
  outstanding: number;
  nextDue: string | null;
  statuses: PaymentStatus[];
};

const statusTone: Record<PaymentStatus, string> = {
  Scheduled: "bg-slate-100 text-slate-700 hover:bg-slate-100",
  Pending: "bg-blue-100 text-blue-700 hover:bg-blue-100",
  Due: "bg-orange-100 text-orange-800 hover:bg-orange-100",
  Received: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100",
  "Partially Paid": "bg-orange-100 text-orange-800 hover:bg-orange-100",
  "Chasing Supplier": "bg-red-100 text-red-700 hover:bg-red-100",
  Closed: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200",
};

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatMoney = (value: string | number | null | undefined) => moneyFormatter.format(Number(value || 0));

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(value));
};

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
};

export default function PaymentCheckerPage() {
  const router = useRouter();
  const [payments, setPayments] = useState<CommissionPayment[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<CommissionPayment | null>(null);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [statuses, setStatuses] = useState<PaymentStatus[]>([]);
  const [suppliers, setSuppliers] = useState<FilterOption[]>([]);
  const [agents, setAgents] = useState<FilterOption[]>([]);
  const [filters, setFilters] = useState({
    status: "all",
    supplier: "all",
    agent: "all",
    due_from: "",
    due_to: "",
  });
  const [searchTerm, setSearchTerm] = useState("");
  const [pagination, setPagination] = useState<PaymentPagination>({
    page: 1,
    page_size: 10,
    total: 0,
    total_pages: 1,
  });
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [totals, setTotals] = useState({ expected: 0, received: 0, outstanding: 0 });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [receiptDraft, setReceiptDraft] = useState({
    amount_received: "",
    date_received: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const filteredPayments = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) return payments;

    return payments.filter((payment) =>
      [
        payment.business_name,
        payment.customer_name,
        payment.supplier_name,
        payment.mpan_number,
        payment.mpan_bottom,
        payment.service_title,
        payment.aggregator,
        payment.agent_name,
        payment.contract_id ? String(payment.contract_id) : null,
      ]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(query)),
    );
  }, [payments, searchTerm]);

  const paymentGroups = useMemo<PaymentGroup[]>(() => {
    const groups = new Map<string, PaymentGroup>();

    filteredPayments.forEach((payment) => {
      const key = payment.contract_id ? `contract-${payment.contract_id}` : `payment-${payment.id}`;
      const title = payment.business_name || payment.customer_name || `Client #${payment.client_id}`;
      const subtitle = [
        payment.contract_id ? `Contract #${payment.contract_id}` : null,
        payment.supplier_name || "Supplier missing",
        payment.agent_name || "Unassigned agent",
      ]
        .filter(Boolean)
        .join(" · ");

      const group = groups.get(key) || {
        key,
        title,
        subtitle,
        clientId: payment.client_id,
        mpan: payment.mpan_number || payment.mpan_bottom || null,
        contractStartDate: payment.contract_start_date,
        contractEndDate: payment.contract_end_date,
        serviceTitle: payment.service_title,
        payments: [],
        expected: 0,
        received: 0,
        outstanding: 0,
        nextDue: null,
        statuses: [],
      };

      group.payments.push(payment);
      group.expected += Number(payment.expected_net_amount || 0);
      group.received += Number(payment.amount_received || 0);
      group.outstanding += Number(payment.outstanding_amount || 0);
      group.statuses = Array.from(new Set([...group.statuses, payment.status]));
      if (payment.due_date && (!group.nextDue || payment.due_date < group.nextDue)) {
        group.nextDue = payment.due_date;
      }

      groups.set(key, group);
    });

    return Array.from(groups.values()).sort((a, b) => {
      if (a.nextDue && b.nextDue) return a.nextDue.localeCompare(b.nextDue);
      if (a.nextDue) return -1;
      if (b.nextDue) return 1;
      return a.title.localeCompare(b.title);
    });
  }, [filteredPayments]);

  const buildQuery = () => {
    const params = new URLSearchParams({
      page: String(pagination.page),
      page_size: String(pagination.page_size),
    });
    if (filters.status !== "all") params.set("status", filters.status);
    if (filters.supplier !== "all") params.set("supplier", filters.supplier);
    if (filters.agent !== "all") params.set("agent", filters.agent);
    if (filters.due_from) params.set("due_from", filters.due_from);
    if (filters.due_to) params.set("due_to", filters.due_to);
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    return params.toString();
  };

  const loadPayments = async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await fetchWithAuth(`/api/commission/payments?${buildQuery()}`);
      setPayments(data.payments || []);
      setTotals({
        expected: Number(data.summary?.expected || 0),
        received: Number(data.summary?.received || 0),
        outstanding: Number(data.summary?.outstanding || 0),
      });
      setPagination(data.pagination || pagination);
      setStatuses(data.filters?.statuses || []);
      setSuppliers(data.filters?.suppliers || []);
      setAgents(data.filters?.agents || []);
      const rows: CommissionPayment[] = data.payments || [];
      const groupKeys: string[] = Array.from(
        new Set(
          rows.map((payment: CommissionPayment) =>
            payment.contract_id ? `contract-${payment.contract_id}` : `payment-${payment.id}`,
          ),
        ),
      );
      setExpandedGroups(
        groupKeys.reduce<Record<string, boolean>>((acc, key) => {
          acc[key] = groupKeys.length <= 8;
          return acc;
        }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load commission payments");
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    if (pagination.page === 1) {
      loadPayments();
      return;
    }
    setPagination((current) => ({ ...current, page: 1 }));
  };

  const changePage = (nextPage: number) => {
    setPagination((current) => ({
      ...current,
      page: Math.min(Math.max(nextPage, 1), current.total_pages || 1),
    }));
  };

  useEffect(() => {
    if (!loading) {
      loadPayments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagination.page, pagination.page_size]);

  useEffect(() => {
    loadPayments();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPayment = async (payment: CommissionPayment) => {
    setSelectedPayment(payment);
    setReceipts([]);
    setDetailLoading(true);
    setError(null);

    try {
      const data = await fetchWithAuth(`/api/commission/payments/${payment.id}`);
      setSelectedPayment(data.payment);
      setReceipts(data.receipts || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment details");
    } finally {
      setDetailLoading(false);
    }
  };

  const updatePaymentInList = (payment: CommissionPayment) => {
    setPayments((current) => current.map((item) => (item.id === payment.id ? payment : item)));
    setSelectedPayment(payment);
  };

  const submitReceipt = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPayment) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await fetchWithAuth(`/api/commission/payments/${selectedPayment.id}/receipts`, {
        method: "POST",
        body: JSON.stringify({
          amount_received: Number(receiptDraft.amount_received),
          date_received: receiptDraft.date_received,
          notes: receiptDraft.notes,
        }),
      });
      updatePaymentInList(data.payment);
      setReceipts((current) => [data.receipt, ...current]);
      setReceiptDraft({
        amount_received: "",
        date_received: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      setSuccessMessage("Payment receipt logged.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log payment receipt");
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (status: "Chasing Supplier" | "Closed") => {
    if (!selectedPayment) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await fetchWithAuth(`/api/commission/payments/${selectedPayment.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      updatePaymentInList(data.payment);
      setSuccessMessage(status === "Closed" ? "Payment closed." : "Marked as chasing supplier.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment status");
    } finally {
      setSaving(false);
    }
  };

  const selectedIsClosed = selectedPayment?.status === "Closed";

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border bg-white p-5 shadow-sm md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500">Payments</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">Payment Checker</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              Track supplier commission receipts, outstanding balances, and follow-up actions.
            </p>
          </div>
          <Button onClick={applyFilters} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
            Apply Filters
          </Button>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        )}

        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <CircleDollarSign className="h-4 w-4 text-slate-900" />
                Expected
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatMoney(totals.expected)}</CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                Received
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatMoney(totals.received)}</CardContent>
          </Card>
          <Card className="border-slate-200 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-sm font-medium text-slate-600">
                <CalendarCheck className="h-4 w-4 text-orange-600" />
                Outstanding
              </CardTitle>
            </CardHeader>
            <CardContent className="text-2xl font-semibold">{formatMoney(totals.outstanding)}</CardContent>
          </Card>
        </div>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filters</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(220px,1.3fr)_150px_minmax(220px,1fr)_minmax(170px,0.8fr)_160px_160px]">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                className="pl-9"
                placeholder="Search customer, supplier, agent, contract..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>

            <Select
              value={filters.status}
              onValueChange={(status) => setFilters((current) => ({ ...current, status }))}
            >
              <SelectTrigger className="min-w-0 [&>span]:truncate">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="max-w-80">
                <SelectItem value="all">All statuses</SelectItem>
                {statuses.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.supplier}
              onValueChange={(supplier) => setFilters((current) => ({ ...current, supplier }))}
            >
              <SelectTrigger className="min-w-0 [&>span]:truncate">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent className="max-w-96">
                <SelectItem value="all">All suppliers</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.supplier_id} value={String(supplier.supplier_id)}>
                    {supplier.supplier_name || `Supplier #${supplier.supplier_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.agent} onValueChange={(agent) => setFilters((current) => ({ ...current, agent }))}>
              <SelectTrigger className="min-w-0 [&>span]:truncate">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent className="max-w-80">
                <SelectItem value="all">All agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.employee_id} value={String(agent.employee_id)}>
                    {agent.employee_name || `Agent #${agent.employee_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              value={filters.due_from}
              onChange={(event) => setFilters((current) => ({ ...current, due_from: event.target.value }))}
            />
            <Input
              type="date"
              value={filters.due_to}
              onChange={(event) => setFilters((current) => ({ ...current, due_to: event.target.value }))}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base">
                <Layers3 className="h-4 w-4" />
                Commission Payments
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span>
                  Showing {paymentGroups.length} of {pagination.total} renewals
                </span>
                <Select
                  value={String(pagination.page_size)}
                  onValueChange={(value) =>
                    setPagination((current) => ({ ...current, page: 1, page_size: Number(value) }))
                  }
                >
                  <SelectTrigger className="h-8 w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading commission payments...
              </div>
            ) : (
              <div className="border-t bg-slate-50/70">
                <div className="space-y-4 p-4">
                  {paymentGroups.map((group, index) => {
                    const expanded = expandedGroups[group.key] ?? false;
                    const orderedPayments = group.payments
                      .slice()
                      .sort((a, b) => a.instalment_year - b.instalment_year);

                    return (
                      <section
                        key={group.key}
                        className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm ring-1 ring-slate-100"
                      >
                        <div
                          className={`border-l-4 ${
                            index % 2 === 0 ? "border-l-slate-950" : "border-l-blue-600"
                          } bg-white px-4 py-4`}
                        >
                          <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                            <div className="flex min-w-0 flex-1 items-start gap-3">
                              <button
                                type="button"
                                className="mt-1 rounded-md border bg-slate-50 p-1"
                                onClick={() => setExpandedGroups((current) => ({ ...current, [group.key]: !expanded }))}
                                aria-label={expanded ? "Collapse renewal" : "Expand renewal"}
                              >
                                {expanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-600" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-600" />
                                )}
                              </button>
                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    className="text-left text-base font-semibold text-slate-950 hover:underline"
                                    onClick={() =>
                                      group.clientId && router.push(`/dashboard/payments/history/${group.clientId}`)
                                    }
                                  >
                                    {group.title}
                                  </button>
                                  <Badge className="bg-slate-900 text-white hover:bg-slate-900">
                                    Renewal {index + 1}
                                  </Badge>
                                  <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">
                                    {group.payments.length} instalment{group.payments.length === 1 ? "" : "s"}
                                  </Badge>
                                </div>
                                <div className="mt-1 text-sm break-words text-slate-500">{group.subtitle}</div>
                                <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
                                  <span className="rounded bg-slate-100 px-2 py-1">
                                    {group.serviceTitle || "Service missing"}
                                  </span>
                                  <span className="rounded bg-slate-100 px-2 py-1">
                                    MPAN/MPR: {group.mpan || "-"}
                                  </span>
                                  <span className="rounded bg-slate-100 px-2 py-1">
                                    Start: {formatDate(group.contractStartDate)}
                                  </span>
                                  <span className="rounded bg-slate-100 px-2 py-1">
                                    End: {formatDate(group.contractEndDate)}
                                  </span>
                                </div>
                                <Button
                                  className="mt-3"
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    group.clientId && router.push(`/dashboard/payments/history/${group.clientId}`)
                                  }
                                  disabled={!group.clientId}
                                >
                                  <ReceiptText className="mr-2 h-4 w-4" />
                                  Open Payment History
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-4 xl:min-w-[560px]">
                              <div className="rounded-md bg-slate-50 px-3 py-2">
                                <p className="text-xs font-medium text-slate-500">Expected</p>
                                <p className="font-semibold text-slate-950">{formatMoney(group.expected)}</p>
                              </div>
                              <div className="rounded-md bg-emerald-50 px-3 py-2">
                                <p className="text-xs font-medium text-emerald-700">Received</p>
                                <p className="font-semibold text-emerald-900">{formatMoney(group.received)}</p>
                              </div>
                              <div className="rounded-md bg-orange-50 px-3 py-2">
                                <p className="text-xs font-medium text-orange-700">Outstanding</p>
                                <p className="font-semibold text-orange-900">{formatMoney(group.outstanding)}</p>
                              </div>
                              <div className="rounded-md bg-blue-50 px-3 py-2">
                                <p className="text-xs font-medium text-blue-700">Next Due</p>
                                <p className="font-semibold text-blue-950">{formatDate(group.nextDue)}</p>
                              </div>
                            </div>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-1">
                            {group.statuses.map((status) => (
                              <Badge key={status} className={statusTone[status]}>
                                {status}
                              </Badge>
                            ))}
                          </div>
                        </div>

                        {expanded && (
                          <div className="border-t bg-white">
                            <div className="overflow-x-auto">
                              <table className="w-full min-w-[1280px] text-sm">
                                <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                  <tr>
                                    <th className="px-4 py-3">Instalment</th>
                                    <th className="px-4 py-3">Supplier</th>
                                    <th className="px-4 py-3">Service</th>
                                    <th className="px-4 py-3">MPAN/MPR</th>
                                    <th className="px-4 py-3">Contract Dates</th>
                                    <th className="px-4 py-3">Aggregator</th>
                                    <th className="px-4 py-3">Agent</th>
                                    <th className="px-4 py-3 text-right">Expected</th>
                                    <th className="px-4 py-3">Due Date</th>
                                    <th className="px-4 py-3 text-right">Received</th>
                                    <th className="px-4 py-3 text-right">Outstanding</th>
                                    <th className="px-4 py-3">Status</th>
                                    <th className="px-4 py-3">Last Checked</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y bg-white">
                                  {orderedPayments.map((payment) => (
                                    <tr
                                      key={payment.id}
                                      className="cursor-pointer transition-colors hover:bg-slate-50"
                                      onClick={() => openPayment(payment)}
                                    >
                                      <td className="px-4 py-3">
                                        <div className="font-medium text-slate-900">
                                          {payment.payment_period_label || `Year ${payment.instalment_year}`}
                                        </div>
                                        <div className="text-xs text-slate-500">ID {payment.id.slice(0, 8)}</div>
                                      </td>
                                      <td className="px-4 py-3 text-slate-700">{payment.supplier_name || "-"}</td>
                                      <td className="px-4 py-3 text-slate-700">{payment.service_title || "-"}</td>
                                      <td className="px-4 py-3 font-mono text-xs text-slate-700">
                                        {payment.mpan_number || payment.mpan_bottom || "-"}
                                      </td>
                                      <td className="px-4 py-3 text-slate-700">
                                        {formatDate(payment.contract_start_date)} - {formatDate(payment.contract_end_date)}
                                      </td>
                                      <td className="px-4 py-3 text-slate-700">{payment.aggregator || "-"}</td>
                                      <td className="px-4 py-3 text-slate-700">{payment.agent_name || "-"}</td>
                                      <td className="px-4 py-3 text-right font-medium">
                                        {formatMoney(payment.expected_net_amount)}
                                      </td>
                                      <td className="px-4 py-3 text-slate-700">{formatDate(payment.due_date)}</td>
                                      <td className="px-4 py-3 text-right">{formatMoney(payment.amount_received)}</td>
                                      <td className="px-4 py-3 text-right">
                                        {formatMoney(payment.outstanding_amount)}
                                      </td>
                                      <td className="px-4 py-3">
                                        <Badge className={statusTone[payment.status]}>{payment.status}</Badge>
                                      </td>
                                      <td className="px-4 py-3 text-slate-700">
                                        {formatDateTime(payment.last_checked_at)}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        )}
                      </section>
                    );
                  })}
                  {paymentGroups.length === 0 && (
                    <div className="rounded-lg border border-dashed bg-white px-4 py-12 text-center text-slate-500">
                      No commission payments match the current filters.
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-3 border-t bg-white px-4 py-3 text-sm text-slate-600 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    Page {pagination.page} of {pagination.total_pages || 1}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changePage(pagination.page - 1)}
                      disabled={loading || pagination.page <= 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => changePage(pagination.page + 1)}
                      disabled={loading || pagination.page >= (pagination.total_pages || 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Sheet open={Boolean(selectedPayment)} onOpenChange={(open) => !open && setSelectedPayment(null)}>
          <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
            <SheetHeader className="border-b px-6 py-5 pr-12">
              <SheetTitle>Commission Payment</SheetTitle>
            </SheetHeader>

            {selectedPayment && (
              <div className="space-y-6 px-6 py-6">
                <div className="rounded-lg border p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="pr-2 text-lg font-semibold break-words text-slate-950">
                        {selectedPayment.business_name || selectedPayment.customer_name || "Customer"}
                      </h2>
                      <p className="mt-1 text-sm break-words text-slate-500">
                        {selectedPayment.supplier_name || "Supplier"} · {selectedPayment.agent_name || "Unassigned"}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-700">
                        {selectedPayment.payment_period_label || `Year ${selectedPayment.instalment_year}`}
                      </p>
                    </div>
                    <Badge className={`${statusTone[selectedPayment.status]} shrink-0`}>{selectedPayment.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500">Service</p>
                      <p className="font-semibold">{selectedPayment.service_title || "-"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">MPAN/MPR</p>
                      <p className="font-mono text-xs font-semibold break-words">
                        {selectedPayment.mpan_number || selectedPayment.mpan_bottom || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500">Contract start</p>
                      <p className="font-semibold">{formatDate(selectedPayment.contract_start_date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Contract end</p>
                      <p className="font-semibold">{formatDate(selectedPayment.contract_end_date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Expected</p>
                      <p className="font-semibold">{formatMoney(selectedPayment.expected_net_amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Outstanding</p>
                      <p className="font-semibold">{formatMoney(selectedPayment.outstanding_amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Due date</p>
                      <p className="font-semibold">{formatDate(selectedPayment.due_date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Last checked</p>
                      <p className="font-semibold">{formatDateTime(selectedPayment.last_checked_at)}</p>
                    </div>
                  </div>
                </div>

                {selectedIsClosed ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700">
                    This payment is closed. Receipts and chasing actions are no longer available.
                  </div>
                ) : (
                  <>
                    <form onSubmit={submitReceipt} className="space-y-4 rounded-lg border p-4">
                      <div className="flex items-center gap-2 text-sm font-semibold">
                        <Banknote className="h-4 w-4" />
                        Log Payment
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="amount_received">Amount received</Label>
                          <Input
                            id="amount_received"
                            min="0.01"
                            step="0.01"
                            type="number"
                            value={receiptDraft.amount_received}
                            onChange={(event) =>
                              setReceiptDraft((current) => ({ ...current, amount_received: event.target.value }))
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date_received">Date received</Label>
                          <Input
                            id="date_received"
                            type="date"
                            value={receiptDraft.date_received}
                            onChange={(event) =>
                              setReceiptDraft((current) => ({ ...current, date_received: event.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes">Notes</Label>
                        <Textarea
                          id="notes"
                          value={receiptDraft.notes}
                          onChange={(event) =>
                            setReceiptDraft((current) => ({ ...current, notes: event.target.value }))
                          }
                          rows={3}
                        />
                      </div>
                      <Button type="submit" disabled={saving}>
                        {saving ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Banknote className="mr-2 h-4 w-4" />
                        )}
                        Log Payment
                      </Button>
                    </form>

                    <div className="rounded-lg border p-4">
                      <div className="mb-3 text-sm font-semibold text-slate-950">Actions</div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => patchStatus("Chasing Supplier")} disabled={saving}>
                          <CalendarCheck className="mr-2 h-4 w-4" />
                          Mark as Chasing Supplier
                        </Button>
                        <Button variant="destructive" onClick={() => patchStatus("Closed")} disabled={saving}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Close
                        </Button>
                      </div>
                    </div>
                  </>
                )}

                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-950">Receipt history</h3>
                  {detailLoading ? (
                    <div className="flex items-center text-sm text-slate-500">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading receipts...
                    </div>
                  ) : receipts.length > 0 ? (
                    receipts.map((receipt) => (
                      <div key={receipt.id} className="rounded-lg border p-3 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-semibold">{formatMoney(receipt.amount_received)}</p>
                          <p className="text-slate-500">{formatDate(receipt.date_received)}</p>
                        </div>
                        <p className="mt-1 text-slate-500">
                          {receipt.logged_by_name || "Logged"} · {formatDateTime(receipt.created_at)}
                        </p>
                        {receipt.notes && <p className="mt-2 text-slate-700">{receipt.notes}</p>}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed p-4 text-sm text-slate-500">
                      No receipts logged for this payment.
                    </div>
                  )}
                </div>
              </div>
            )}
          </SheetContent>
        </Sheet>
      </div>
    </div>
  );
}
