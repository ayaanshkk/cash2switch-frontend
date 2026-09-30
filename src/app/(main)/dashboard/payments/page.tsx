"use client";

import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import {
  AlertTriangle,
  Banknote,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDollarSign,
  Edit,
  ExternalLink,
  Layers3,
  Loader2,
  ReceiptText,
  Search,
  X,
  XCircle,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  follow_up_count?: number | null;
  is_archived?: boolean;
  is_deleted?: boolean;
};

type Receipt = {
  id: string;
  commission_payment_id?: string;
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
  aggregator?: string | null;
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
  isArchived: boolean;
  isDeleted: boolean;
  needsChasing: boolean;
};

type PaymentColumnKey =
  | "supplier"
  | "mpan"
  | "contractDates"
  | "aggregator"
  | "agent"
  | "expected"
  | "dueDate"
  | "received"
  | "outstanding"
  | "status"
  | "lastChecked";

const paymentColumnOptions: Array<{ key: PaymentColumnKey; label: string; defaultVisible: boolean; align?: "right" }> = [
  { key: "supplier", label: "Supplier", defaultVisible: true },
  { key: "mpan", label: "MPAN/MPR", defaultVisible: true },
  { key: "contractDates", label: "Payment Period", defaultVisible: true },
  { key: "aggregator", label: "Aggregator", defaultVisible: false },
  { key: "agent", label: "Agent", defaultVisible: true },
  { key: "expected", label: "Expected", defaultVisible: true, align: "right" },
  { key: "dueDate", label: "Due Date", defaultVisible: true },
  { key: "received", label: "Received", defaultVisible: true, align: "right" },
  { key: "outstanding", label: "Outstanding", defaultVisible: true, align: "right" },
  { key: "status", label: "Status", defaultVisible: true },
  { key: "lastChecked", label: "Last Checked", defaultVisible: false },
];

const statusTone: Record<PaymentStatus, string> = {
  Scheduled: "bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-800",
  Pending: "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300 dark:hover:bg-blue-950/60",
  Due: "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-300 dark:hover:bg-orange-950/60",
  Received: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
  "Partially Paid": "bg-orange-100 text-orange-800 hover:bg-orange-100 dark:bg-orange-950/60 dark:text-orange-300 dark:hover:bg-orange-950/60",
  "Chasing Supplier": "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950/60 dark:text-red-300 dark:hover:bg-red-950/60",
  Closed: "bg-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800",
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
  const statuses: PaymentStatus[] = [
    "Scheduled",
    "Pending",
    "Due",
    "Received",
    "Partially Paid",
    "Chasing Supplier",
    "Closed",
  ];
  const [suppliers, setSuppliers] = useState<FilterOption[]>([]);
  const [agents, setAgents] = useState<FilterOption[]>([]);
  const [aggregators, setAggregators] = useState<FilterOption[]>([]);
  const [filters, setFilters] = useState({
    status: "all",
    supplier: "all",
    agent: "all",
    aggregator: "all",
    due_from: "",
    due_to: "",
    needs_chasing: "",
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
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [visiblePaymentColumns, setVisiblePaymentColumns] = useState<Record<PaymentColumnKey, boolean>>(
    () =>
      paymentColumnOptions.reduce(
        (acc, column) => ({ ...acc, [column.key]: column.defaultVisible }),
        {} as Record<PaymentColumnKey, boolean>,
      ),
  );
  const [receiptDraft, setReceiptDraft] = useState({
    amount_received: "",
    date_received: new Date().toISOString().slice(0, 10),
    notes: "",
  });
  const [editingReceiptId, setEditingReceiptId] = useState<string | null>(null);
  const [receiptEditDraft, setReceiptEditDraft] = useState({
    amount_received: "",
    date_received: "",
    notes: "",
  });
  const [followUpDate, setFollowUpDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().slice(0, 10);
  });
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  type ChasingSummaryRow = { supplier_id: number | null; supplier_name: string; overdue_count: number; total_outstanding: string };
  const [chasingSummary, setChasingSummary] = useState<ChasingSummaryRow[]>([]);

  useEffect(() => {
    fetchWithAuth('/api/commission/chasing-summary')
      .then((data) => setChasingSummary(data.suppliers || []))
      .catch(() => {/* non-fatal */});
  }, []);

  type SummaryModalType = 'expected' | 'received' | 'outstanding' | 'overdue' | null;
  const [summaryModal, setSummaryModal] = useState<SummaryModalType>(null);
  const [modalContracts, setModalContracts] = useState<PaymentGroup[]>([]);
  const [modalLoading, setModalLoading] = useState(false);

  const openSummaryModal = async (type: SummaryModalType) => {
    setSummaryModal(type);
    if (type === 'overdue') return; // uses chasingSummary already loaded
    setModalLoading(true);
    setModalContracts([]);
    try {
      const params = new URLSearchParams({ page: '1', page_size: '200' });
      if (type === 'received') params.set('status', 'Received');
      const data = await fetchWithAuth(`/api/commission/clients-with-payments?${params.toString()}`);
      const mapped: CommissionPayment[] = [];
      for (const client of data.clients || []) {
        for (const p of client.payments) {
          mapped.push({
            ...p,
            customer_name: client.business_name,
            business_name: client.business_name,
            supplier_name: client.supplier_name,
            agent_name: client.agent_name,
            mpan_number: client.mpan_number,
            mpan_bottom: client.mpan_bottom,
            contract_start_date: client.contract_start_date,
            contract_end_date: client.contract_end_date,
            service_id: client.service_id,
            service_title: client.service_title,
            aggregator: client.aggregator,
            is_archived: client.is_archived,
            is_deleted: client.is_deleted,
            payment_policy_type: null,
            next_follow_up_date: null,
          });
        }
      }
      // For outstanding modal, keep only rows with outstanding > 0
      const filtered = type === 'outstanding'
        ? mapped.filter((p) => Number(p.outstanding_amount || 0) > 0)
        : mapped;
      // Group by contract
      const groups = new Map<string, PaymentGroup>();
      filtered.forEach((payment) => {
        const key = payment.contract_id ? `contract-${payment.contract_id}` : `payment-${payment.id}`;
        const existing = groups.get(key);
        if (!existing) {
          groups.set(key, {
            key,
            title: payment.business_name || payment.customer_name || `Client #${payment.client_id}`,
            subtitle: payment.supplier_name || '',
            clientId: payment.client_id,
            mpan: payment.mpan_number || payment.mpan_bottom || null,
            contractStartDate: payment.contract_start_date,
            contractEndDate: payment.contract_end_date,
            serviceTitle: payment.service_title,
            payments: [payment],
            expected: Number(payment.expected_net_amount || 0),
            received: Number(payment.amount_received || 0),
            outstanding: Number(payment.outstanding_amount || 0),
            nextDue: payment.due_date || null,
            statuses: [payment.status],
            isArchived: payment.is_archived ?? false,
            isDeleted: payment.is_deleted ?? false,
            needsChasing: false,
          });
        } else {
          existing.payments.push(payment);
          existing.expected += Number(payment.expected_net_amount || 0);
          existing.received += Number(payment.amount_received || 0);
          existing.outstanding += Number(payment.outstanding_amount || 0);
          if (!existing.statuses.includes(payment.status)) existing.statuses.push(payment.status);
        }
      });
      setModalContracts(Array.from(groups.values()));
    } catch {
      // non-fatal
    } finally {
      setModalLoading(false);
    }
  };

  const overdueTotal = chasingSummary.reduce((sum, row) => sum + Number(row.total_outstanding || 0), 0);

  // Resolve virtual status sentinels into real query params
  const resolveFilters = (f: typeof filters) => {
    const today = new Date().toISOString().slice(0, 10);
    if (f.status === '__overdue__')    return { ...f, status: 'Due',  due_from: '', due_to: today };
    if (f.status === '__this_week__')  return { ...f, status: 'all', due_from: today, due_to: new Date(Date.now() + 7  * 86400000).toISOString().slice(0, 10) };
    if (f.status === '__this_month__') return { ...f, status: 'all', due_from: today, due_to: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10) };
    return f;
  };

  // When a supplier is clicked from the overdue modal, show that supplier's specific numbers
  const activeChasing = filters.supplier !== 'all' && filters.needs_chasing === 'true'
    ? chasingSummary.find((r) => String(r.supplier_id) === filters.supplier) ?? null
    : null;

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

      const group: PaymentGroup = groups.get(key) || {
        key,
        title,
        subtitle,
        clientId: payment.client_id,
        mpan: payment.mpan_number || payment.mpan_bottom || null,
        contractStartDate: payment.contract_start_date,
        contractEndDate: payment.contract_end_date,
        serviceTitle: payment.service_title,
        payments: [] as CommissionPayment[],
        expected: 0,
        received: 0,
        outstanding: 0,
        nextDue: null,
        statuses: [] as PaymentStatus[],
        isArchived: payment.is_archived ?? false,
        isDeleted: payment.is_deleted ?? false,
        needsChasing: (payment as any).needs_chasing ?? false,
      };

      group.payments.push(payment);
      group.expected    += Number(payment.expected_net_amount || 0);
      group.received    += Number(payment.amount_received || 0);
      group.outstanding += Number(payment.outstanding_amount || 0);
      group.statuses = Array.from(new Set([...group.statuses, payment.status]));

      if (payment.due_date && (!group.nextDue || payment.due_date < group.nextDue)) {
        group.nextDue = payment.due_date;
      }

      // Mark as needs chasing if any instalment is overdue with outstanding balance
      if (
        Number(payment.outstanding_amount || 0) > 0 &&
        payment.due_date &&
        new Date(payment.due_date) < new Date() &&
        !['Received', 'Closed'].includes(payment.status)
      ) {
        group.needsChasing = true;
      }

      groups.set(key, group);
    });

    return Array.from(groups.values()).sort((a, b) => {
      // Needs chasing always first
      if (a.needsChasing && !b.needsChasing) return -1;
      if (!a.needsChasing && b.needsChasing) return 1;

      // Then by next due date
      if (a.nextDue && b.nextDue) return a.nextDue.localeCompare(b.nextDue);
      if (a.nextDue) return -1;
      if (b.nextDue) return 1;

      return a.title.localeCompare(b.title);
    });
  }, [filteredPayments]);

  const buildQuery = (
    nextFilters = filters,
    nextSearchTerm = searchTerm,
    nextPagination = pagination,
  ) => {
    const f = resolveFilters(nextFilters);
    const params = new URLSearchParams({
      page: String(nextPagination.page),
      page_size: String(nextPagination.page_size),
    });
    if (f.status !== "all") params.set("status", f.status);
    if (f.supplier !== "all") params.set("supplier", f.supplier);
    if (f.agent !== "all") params.set("agent", f.agent);
    if (f.aggregator !== "all") params.set("aggregator", f.aggregator);
    if (f.due_from) params.set("due_from", f.due_from);
    if (f.due_to) params.set("due_to", f.due_to);
    if (f.needs_chasing) params.set("needs_chasing", f.needs_chasing);
    if (nextSearchTerm.trim()) params.set("search", nextSearchTerm.trim());
    return params.toString();
  };

  const loadPayments = async (
    nextFilters = filters,
    nextSearchTerm = searchTerm,
    nextPagination = pagination,
  ) => {
    setLoading(true);
    setError(null);

    try {
      const f = resolveFilters(nextFilters);
      const params = new URLSearchParams({
        page: String(nextPagination.page),
        page_size: String(nextPagination.page_size),
      });
      if (f.supplier !== "all") params.set("supplier", f.supplier);
      if (f.agent !== "all") params.set("agent", f.agent);
      if (f.status !== "all") params.set("status", f.status);
      if (f.aggregator !== "all") params.set("aggregator", f.aggregator);
      if (f.due_from) params.set("due_from", f.due_from);
      if (f.due_to) params.set("due_to", f.due_to);
      if (f.needs_chasing) params.set("needs_chasing", f.needs_chasing);
      if (nextSearchTerm.trim()) params.set("search", nextSearchTerm.trim());

      const data = await fetchWithAuth(`/api/commission/clients-with-payments?${params.toString()}`);

      const mappedPayments: CommissionPayment[] = [];
      for (const client of data.clients || []) {
        if (client.payments.length > 0) {
          for (const p of client.payments) {
            mappedPayments.push({
              ...p,
              customer_name: client.business_name,
              business_name: client.business_name,
              supplier_name: client.supplier_name,
              agent_name: client.agent_name,
              mpan_number: client.mpan_number,
              mpan_bottom: client.mpan_bottom,
              contract_start_date: client.contract_start_date,
              contract_end_date: client.contract_end_date,
              service_id: client.service_id,
              service_title: client.service_title,
              aggregator: client.aggregator,
              is_archived: client.is_archived,
              is_deleted: client.is_deleted,
              payment_policy_type: null,
              next_follow_up_date: null,
            });
          }
        } else {
          mappedPayments.push({
            id: `stub-${client.contract_id}`,
            client_id: client.client_id,
            project_id: null,
            contract_id: client.contract_id,
            supplier_id: null,
            employee_id: null,
            instalment_year: 0,
            payment_policy_type: null,
            payment_period_label: "No commission record",
            payment_period_start: null,
            payment_period_end: null,
            customer_name: client.business_name,
            business_name: client.business_name,
            supplier_name: client.supplier_name,
            agent_name: client.agent_name,
            mpan_number: client.mpan_number,
            mpan_bottom: client.mpan_bottom,
            contract_start_date: client.contract_start_date,
            contract_end_date: client.contract_end_date,
            service_id: client.service_id,
            service_title: client.service_title,
            aggregator: client.aggregator,
            expected_net_amount: "0.00",
            due_date: null,
            amount_received: "0.00",
            outstanding_amount: "0.00",
            status: "Pending" as PaymentStatus,
            last_checked_at: null,
            next_follow_up_date: null,
            is_archived: client.is_archived,
            is_deleted: client.is_deleted,
          });
        }
      }

      setPayments(mappedPayments);
      setTotals({
        expected: Number(data.summary?.expected || 0),
        received: Number(data.summary?.received || 0),
        outstanding: Number(data.summary?.outstanding || 0),
      });
      setPagination(data.pagination || nextPagination);
      setSuppliers(data.filters?.suppliers || []);
      setAgents(data.filters?.agents || []);
      setAggregators(data.filters?.aggregators || []);

      const groupKeys = Array.from(new Set(
        mappedPayments.map((p) => p.contract_id ? `contract-${p.contract_id}` : `payment-${p.id}`)
      ));
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
    const nextPagination = { ...pagination, page: 1 };
    setPagination(nextPagination);
    loadPayments(filters, searchTerm, nextPagination);
  };

  const applyStatusShortcut = (status: PaymentStatus) => {
    const nextFilters = { ...filters, status };
    const nextPagination = { ...pagination, page: 1 };
    setFilters(nextFilters);
    setPagination(nextPagination);
    loadPayments(nextFilters, searchTerm, nextPagination);
  };

  const openCustomerDetails = (clientId: number | null) => {
    if (!clientId) return;
    window.open(`/dashboard/renewals/${clientId}`, "_blank");
  };

  const openPaymentHistory = (clientId: number | null) => {
    if (!clientId) return;
    router.push(`/dashboard/payments/history/${clientId}`);
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

  useEffect(() => {
    const timer = setTimeout(() => {
      const nextPagination = { ...pagination, page: 1 };
      setPagination(nextPagination);
      loadPayments(filters, searchTerm, nextPagination);
    }, 500);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const openPayment = async (payment: CommissionPayment) => {
    if (String(payment.id).startsWith("stub-")) return;
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

  const togglePaymentGroup = (key: string) => {
    setExpandedGroups((current) => ({ ...current, [key]: !(current[key] ?? false) }));
  };

  const startEditingReceipt = (receipt: Receipt) => {
    setEditingReceiptId(receipt.id);
    setReceiptEditDraft({
      amount_received: String(receipt.amount_received || ""),
      date_received: receipt.date_received || new Date().toISOString().slice(0, 10),
      notes: receipt.notes || "",
    });
  };

  const cancelEditingReceipt = () => {
    setEditingReceiptId(null);
    setReceiptEditDraft({ amount_received: "", date_received: "", notes: "" });
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
        }),
      });
      setReceipts((current) => [data.receipt, ...current]);
      setReceiptDraft({
        amount_received: "",
        date_received: new Date().toISOString().slice(0, 10),
        notes: "",
      });
      setSuccessMessage("Payment receipt logged.");

      // Re-fetch payment detail so sheet totals are accurate
      const refreshed = await fetchWithAuth(`/api/commission/payments/${selectedPayment.id}`);
      setSelectedPayment(refreshed.payment);
      updatePaymentInList(refreshed.payment);

      // Reload outer table so group-level totals update
      await loadPayments(filters, searchTerm, pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to log payment receipt");
    } finally {
      setSaving(false);
    }
  };

  const submitReceiptEdit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedPayment || !editingReceiptId) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const data = await fetchWithAuth(`/api/commission/payments/${selectedPayment.id}/receipts/${editingReceiptId}`, {
        method: "PATCH",
        body: JSON.stringify({
          amount_received: Number(receiptEditDraft.amount_received),
          date_received: receiptEditDraft.date_received,
          notes: receiptEditDraft.notes,
        }),
      });
      // Update receipt list in sheet
      setReceipts((current) => current.map((receipt) => (receipt.id === editingReceiptId ? data.receipt : receipt)));
      cancelEditingReceipt();
      setSuccessMessage("Payment receipt updated.");

      // Re-fetch the full payment detail so sheet totals (received, outstanding) are accurate
      const refreshed = await fetchWithAuth(`/api/commission/payments/${selectedPayment.id}`);
      setSelectedPayment(refreshed.payment);
      updatePaymentInList(refreshed.payment);

      // Reload the outer table so group-level totals update
      await loadPayments(filters, searchTerm, pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment receipt");
    } finally {
      setSaving(false);
    }
  };

  const submitNote = async () => {
    if (!selectedPayment || !notesDraft.trim()) return;
    setSavingNote(true);
    setError(null);
    setSuccessMessage(null);
    try {
      const data = await fetchWithAuth(
        `/api/commission/payments/${selectedPayment.id}/receipts`,
        {
          method: "POST",
          body: JSON.stringify({ notes: notesDraft.trim() }),
        }
      );
      setReceipts((current) => [data.receipt, ...current]);
      setNotesDraft("");
      setSuccessMessage("Note saved.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  const deleteReceipt = async (receiptId: string) => {
    if (!selectedPayment) return;
    if (!window.confirm("Delete this entry? This cannot be undone.")) return;

    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    try {
      await fetchWithAuth(
        `/api/commission/payments/${selectedPayment.id}/receipts/${receiptId}`,
        { method: "DELETE" }
      );

      // Remove from local receipts list immediately
      setReceipts((current) => current.filter((r) => r.id !== receiptId));
      setSuccessMessage("Entry deleted.");

      // Always re-fetch the payment to get correct totals and status
      const refreshed = await fetchWithAuth(
        `/api/commission/payments/${selectedPayment.id}`
      );
      setSelectedPayment(refreshed.payment);
      updatePaymentInList(refreshed.payment);

      // Reload the outer table so group-level totals update
      await loadPayments(filters, searchTerm, pagination);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete entry");
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
      const body: Record<string, string> = { status };
      if (status === "Chasing Supplier" && followUpDate) body.next_follow_up_date = followUpDate;
      const data = await fetchWithAuth(`/api/commission/payments/${selectedPayment.id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
      updatePaymentInList(data.payment);
      setSuccessMessage(status === "Closed" ? "Payment closed." : "Marked as chasing supplier.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update payment status");
    } finally {
      setSaving(false);
    }
  };

  const isColumnVisible = (key: PaymentColumnKey) => visiblePaymentColumns[key];
  const visibleColumnCount = 1 + paymentColumnOptions.filter((column) => isColumnVisible(column.key)).length;

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Payments</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
              Payment Checker
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-400">
              Track all renewal commission receipts, outstanding balances, and follow-up actions.
            </p>
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
            {successMessage}
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <button
            type="button"
            onClick={() => openSummaryModal('expected')}
            className="text-left rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
              <CircleDollarSign className="h-4 w-4 text-slate-900" />
              Expected
            </div>
            <div className="text-2xl font-semibold text-slate-950">{formatMoney(totals.expected)}</div>
            <div className="mt-1 text-xs text-slate-400">Click to view contracts</div>
          </button>

          <button
            type="button"
            onClick={() => openSummaryModal('received')}
            className="text-left rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              Received
            </div>
            <div className="text-2xl font-semibold text-emerald-700">{formatMoney(totals.received)}</div>
            <div className="mt-1 text-xs text-slate-400">Click to view contracts</div>
          </button>

          <button
            type="button"
            onClick={() => openSummaryModal('outstanding')}
            className="text-left rounded-lg border border-slate-200 bg-white shadow-sm hover:shadow-md transition-shadow p-5 cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-slate-600 mb-2">
              <CalendarCheck className="h-4 w-4 text-orange-600" />
              Outstanding
            </div>
            <div className="text-2xl font-semibold text-orange-700">{formatMoney(totals.outstanding)}</div>
            <div className="mt-1 text-xs text-slate-400">Click to view contracts</div>
          </button>

          <button
            type="button"
            onClick={() => openSummaryModal('overdue')}
            className="text-left rounded-lg border border-red-200 bg-red-50 shadow-sm hover:shadow-md transition-shadow p-5 cursor-pointer"
          >
            <div className="flex items-center gap-2 text-sm font-medium text-red-700 mb-2">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              {activeChasing ? `Overdue — ${activeChasing.supplier_name}` : 'Overdue Payments'}
            </div>
            <div className="text-2xl font-semibold text-red-700">
              {formatMoney(activeChasing ? activeChasing.total_outstanding : overdueTotal)}
            </div>
            <div className="mt-1 text-xs text-red-400">
              {activeChasing
                ? `${activeChasing.overdue_count} contract${activeChasing.overdue_count !== 1 ? 's' : ''} overdue — click to view all`
                : `${chasingSummary.reduce((s, r) => s + r.overdue_count, 0)} contracts overdue — click to view`}
            </div>
          </button>
        </div>

        {/* Clear filters chip — only shown when something is active */}
        {(filters.status !== "all" || filters.due_from || filters.due_to || filters.needs_chasing || filters.supplier !== "all") && (
          <div className="flex">
            <button
              type="button"
              onClick={() => {
                const next = { ...filters, status: "all", due_from: "", due_to: "", needs_chasing: "", supplier: "all" };
                const nextPag = { ...pagination, page: 1 };
                setFilters(next);
                setPagination(nextPag);
                loadPayments(next, searchTerm, nextPag);
              }}
              className="rounded-full px-3 py-1 text-xs font-medium border border-slate-200 text-slate-400 hover:text-slate-700 bg-white cursor-pointer"
            >
              ✕ Clear all filters
            </button>
          </div>
        )}

        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-slate-950 dark:text-slate-50">Filters</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
              <Input
                className="pl-9 w-64 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                placeholder="Search..."
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
              />
            </div>
            
            <Select
              value={filters.status}
              onValueChange={(status) => {
                const nextFilters = { ...filters, status, needs_chasing: "" };
                const nextPagination = { ...pagination, page: 1 };
                setFilters(nextFilters);
                setPagination(nextPagination);
                loadPayments(nextFilters, searchTerm, nextPagination);
              }}
            >
              <SelectTrigger className="min-w-0 [&>span]:truncate dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="max-w-80">
                <SelectItem value="all">All statuses</SelectItem>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-xs text-slate-400 font-normal">Quick filters</SelectLabel>
                  <SelectItem value="__overdue__">⚠ Overdue</SelectItem>
                  <SelectItem value="__this_week__">📅 Due This Week</SelectItem>
                  <SelectItem value="__this_month__">📅 Due This Month</SelectItem>
                </SelectGroup>
                <SelectSeparator />
                <SelectGroup>
                  <SelectLabel className="text-xs text-slate-400 font-normal">Status</SelectLabel>
                  {statuses.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>

            <Select
              value={filters.supplier}
              onValueChange={(supplier) => {
                const nextFilters = { ...filters, supplier, needs_chasing: "" };
                const nextPagination = { ...pagination, page: 1 };
                setFilters(nextFilters);
                setPagination(nextPagination);
                loadPayments(nextFilters, searchTerm, nextPagination);
              }}
            >
              <SelectTrigger className="min-w-0 [&>span]:truncate dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                <SelectValue placeholder="Supplier" />
              </SelectTrigger>
              <SelectContent className="max-w-96 dark:border-slate-800 dark:bg-slate-900">
                <SelectItem value="all" className="dark:hover:bg-slate-800">All suppliers</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.supplier_id} value={String(supplier.supplier_id)} className="dark:hover:bg-slate-800">
                    {supplier.supplier_name || `Supplier #${supplier.supplier_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.agent}
              onValueChange={(agent) => {
                const nextFilters = { ...filters, agent };
                const nextPagination = { ...pagination, page: 1 };
                setFilters(nextFilters);
                setPagination(nextPagination);
                loadPayments(nextFilters, searchTerm, nextPagination);
              }}
            >
              <SelectTrigger className="min-w-0 [&>span]:truncate dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent className="max-w-80 dark:border-slate-800 dark:bg-slate-900">
                <SelectItem value="all" className="dark:hover:bg-slate-800">All agents</SelectItem>
                {agents.map((agent) => (
                  <SelectItem key={agent.employee_id} value={String(agent.employee_id)} className="dark:hover:bg-slate-800">
                    {agent.employee_name || `Agent #${agent.employee_id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select
              value={filters.aggregator}
              onValueChange={(aggregator) => {
                const nextFilters = { ...filters, aggregator };
                const nextPagination = { ...pagination, page: 1 };
                setFilters(nextFilters);
                setPagination(nextPagination);
                loadPayments(nextFilters, searchTerm, nextPagination);
              }}
            >
              <SelectTrigger className="min-w-0 [&>span]:truncate dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                <SelectValue placeholder="Aggregator" />
              </SelectTrigger>
              <SelectContent className="max-w-80 dark:border-slate-800 dark:bg-slate-900">
                <SelectItem value="all" className="dark:hover:bg-slate-800">All aggregators</SelectItem>
                {aggregators.filter((item): item is FilterOption & { aggregator: string } => Boolean(item.aggregator)).map((item) => (
                  <SelectItem key={item.aggregator} value={String(item.aggregator)} className="dark:hover:bg-slate-800">
                    {item.aggregator}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Input
              type="date"
              className="w-36 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
              value={filters.due_from}
              onChange={(event) => setFilters((current) => ({ ...current, due_from: event.target.value }))}
            />
            <Input
              type="date"
              className="w-36 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
              value={filters.due_to}
              onChange={(event) => setFilters((current) => ({ ...current, due_to: event.target.value }))}
            />
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <CardHeader className="pb-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle className="flex items-center gap-2 text-base text-slate-950 dark:text-slate-50">
                <Layers3 className="h-4 w-4" />
                Commission Payments
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <span>
                  Showing {paymentGroups.length} of {pagination.total} renewals
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-500 dark:text-slate-400">Rows per page</span>
                  <Select
                    value={String(pagination.page_size)}
                    onValueChange={(value) =>
                      setPagination((current) => ({ ...current, page: 1, page_size: Number(value) }))
                    }
                  >
                    <SelectTrigger className="h-8 w-24 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:border-slate-800 dark:bg-slate-900">
                      <SelectItem value="10" className="dark:hover:bg-slate-800">10</SelectItem>
                      <SelectItem value="25" className="dark:hover:bg-slate-800">25</SelectItem>
                      <SelectItem value="50" className="dark:hover:bg-slate-800">50</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500 dark:text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading commission payments...
              </div>
            ) : (
              <div className="border-t border-slate-200 dark:border-slate-800">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase border-b border-slate-200 dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400">
                      <tr>
                        <th className="px-3 py-2">Customer</th>
                        <th className="px-3 py-2">Supplier</th>
                        <th className="px-3 py-2">Aggregator</th>
                        <th className="px-3 py-2">Agent</th>
                        <th className="px-3 py-2">MPAN/MPR</th>
                        <th className="px-3 py-2">Start</th>
                        <th className="px-3 py-2">End</th>
                        <th className="px-3 py-2 text-right">Expected</th>
                        <th className="px-3 py-2 text-right">Received</th>
                        <th className="px-3 py-2 text-right">Outstanding</th>
                        <th className="px-3 py-2">Next Due</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                      {paymentGroups.map((group, index) => {
                        const expanded = expandedGroups[group.key] ?? false;
                        const orderedPayments = group.payments
                          .slice()
                          .sort((a, b) => a.instalment_year - b.instalment_year);

                        return (
                          <React.Fragment key={group.key}>
                            <tr
                              className={`cursor-pointer transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                                group.isDeleted
                                  ? "bg-red-50/40 dark:bg-red-950/20"
                                  : group.isArchived
                                  ? "bg-amber-50/40 dark:bg-amber-950/20"
                                  : ""
                              }`}
                              onClick={() => togglePaymentGroup(group.key)}
                            >
                              <td className="px-3 py-2">
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="rounded border border-slate-200 bg-slate-50 p-0.5 shrink-0 dark:border-slate-700 dark:bg-slate-800"
                                    onClick={(e) => { e.stopPropagation(); togglePaymentGroup(group.key); }}
                                  >
                                    {expanded
                                      ? <ChevronDown className="h-3 w-3 text-slate-600 dark:text-slate-300" />
                                      : <ChevronRight className="h-3 w-3 text-slate-600 dark:text-slate-300" />}
                                  </button>
                                  <div>
                                    <button
                                      type="button"
                                      className="font-semibold text-slate-950 hover:underline text-left dark:text-slate-100"
                                      onClick={(e) => { e.stopPropagation(); openCustomerDetails(group.clientId); }}
                                    >
                                      {group.title}
                                    </button>
                                    <div className="flex gap-1 mt-0.5 flex-wrap">
                                      <Badge className="bg-slate-900 text-white hover:bg-slate-900 text-xs dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-100">
                                        {group.payments.length} instalment{group.payments.length === 1 ? "" : "s"}
                                      </Badge>
                                      {group.isArchived && <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-xs dark:bg-amber-950/60 dark:text-amber-300">Archived</Badge>}
                                      {group.isDeleted && <Badge className="bg-red-100 text-red-700 hover:bg-red-100 text-xs dark:bg-red-950/60 dark:text-red-300">Deleted</Badge>}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{group.payments[0]?.supplier_name || "-"}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{group.payments[0]?.aggregator || "-"}</td>
                              <td className="px-3 py-2 text-slate-700 dark:text-slate-300">{group.payments[0]?.agent_name || "-"}</td>
                              <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{group.mpan || "-"}</td>
                              <td className="px-3 py-2 text-slate-700 whitespace-nowrap dark:text-slate-300">{formatDate(group.contractStartDate)}</td>
                              <td className="px-3 py-2 text-slate-700 whitespace-nowrap dark:text-slate-300">{formatDate(group.contractEndDate)}</td>
                              <td className="px-3 py-2 text-right font-medium text-slate-900 dark:text-slate-100">{formatMoney(group.expected)}</td>
                              <td className="px-3 py-2 text-right text-emerald-700 font-medium dark:text-emerald-400">{formatMoney(group.received)}</td>
                              <td className="px-3 py-2 text-right text-orange-700 font-medium dark:text-orange-400">{formatMoney(group.outstanding)}</td>
                              <td className="px-3 py-2 text-slate-700 whitespace-nowrap dark:text-slate-300">{formatDate(group.nextDue)}</td>
                              <td className="px-3 py-2">
                                <div className="flex flex-wrap gap-1">
                                  {group.statuses.map((status) => (
                                    <Badge key={status} className={statusTone[status]}>{status}</Badge>
                                  ))}
                                </div>
                              </td>
                              <td className="px-3 py-2">
                                <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => openPaymentHistory(group.clientId)}>
                                    <ReceiptText className="h-3 w-3" />
                                  </Button>
                                  <Button size="sm" variant="outline" className="h-7 px-2 text-xs dark:border-slate-700 dark:hover:bg-slate-800" onClick={() => openCustomerDetails(group.clientId)}>
                                    <ExternalLink className="h-3 w-3" />
                                  </Button>
                                </div>
                              </td>
                            </tr>

                            {expanded && (
                              <tr key={`${group.key}-expanded`}>
                                <td colSpan={13} className="p-0 bg-slate-50 dark:bg-slate-950/60">
                                  <table className="w-full text-sm border-t border-b border-slate-200 dark:border-slate-800">
                                    <thead className="bg-slate-100 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase dark:bg-slate-800/80 dark:text-slate-400">
                                      <tr>
                                        <th className="px-8 py-2">Instalment</th>
                                        <th className="px-4 py-2">Payment Period</th>
                                        <th className="px-4 py-2 text-right">Expected</th>
                                        <th className="px-4 py-2">Due Date</th>
                                        <th className="px-4 py-2 text-right">Received</th>
                                        <th className="px-4 py-2 text-right">Outstanding</th>
                                        <th className="px-4 py-2">Status</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
                                      {orderedPayments.map((payment) => (
                                        <tr
                                          key={payment.id}
                                          className={`transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 ${String(payment.id).startsWith("stub-") ? "opacity-50 cursor-default" : "cursor-pointer"}`}
                                          onClick={() => !String(payment.id).startsWith("stub-") && openPayment(payment)}
                                        >
                                          <td className="px-8 py-2 font-medium text-slate-900 dark:text-slate-100">
                                            {payment.payment_period_label || `Year ${payment.instalment_year}`}
                                          </td>
                                          <td className="px-4 py-2 text-slate-700 dark:text-slate-300">
                                            {formatDate(payment.payment_period_start || payment.contract_start_date)}
                                            {" – "}
                                            {formatDate(payment.payment_period_end || payment.contract_end_date)}
                                          </td>
                                          <td className="px-4 py-2 text-right font-medium text-slate-900 dark:text-slate-100">{formatMoney(payment.expected_net_amount)}</td>
                                          <td className="px-4 py-2 text-slate-700 dark:text-slate-300">{formatDate(payment.due_date)}</td>
                                          <td className="px-4 py-2 text-right text-slate-900 dark:text-slate-100">{formatMoney(payment.amount_received)}</td>
                                          <td className="px-4 py-2 text-right text-slate-900 dark:text-slate-100">{formatMoney(payment.outstanding_amount)}</td>
                                          <td className="px-4 py-2">
                                            <div className="flex flex-col gap-1">
                                              <Badge className={statusTone[payment.status]}>{payment.status}</Badge>
                                              {Number(payment.outstanding_amount) > 0 &&
                                                payment.due_date &&
                                                new Date(payment.due_date) < today &&
                                                !["Received", "Closed"].includes(payment.status) && (
                                                  <span className="text-xs font-semibold text-red-600">
                                                    {Math.floor((today.getTime() - new Date(payment.due_date).getTime()) / 86400000)}d overdue
                                                  </span>
                                                )}
                                            </div>
                                          </td>
                                        </tr>
                                      ))}
                                      {orderedPayments.length === 0 && (
                                        <tr>
                                          <td colSpan={7} className="px-8 py-4 text-center text-slate-500 dark:text-slate-400">
                                            No payment rows for this renewal.
                                          </td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                      {paymentGroups.length === 0 && (
                        <tr>
                          <td colSpan={13} className="px-4 py-12 text-center text-slate-500 dark:text-slate-400">
                            No commission payments match the current filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col gap-3 border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>Page {pagination.page} of {pagination.total_pages || 1}</span>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => changePage(pagination.page - 1)} disabled={loading || pagination.page <= 1} className="dark:border-slate-800 dark:hover:bg-slate-800">Previous</Button>
                    <Button variant="outline" size="sm" onClick={() => changePage(pagination.page + 1)} disabled={loading || pagination.page >= (pagination.total_pages || 1)} className="dark:border-slate-800 dark:hover:bg-slate-800">Next</Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Summary Modal */}
        {summaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 cursor-pointer" onClick={() => setSummaryModal(null)}>
            <div
              className="relative w-full max-w-5xl max-h-[85vh] flex flex-col rounded-xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className={`flex items-center justify-between px-6 py-4 border-b rounded-t-xl ${summaryModal === 'overdue' ? 'bg-red-50 border-red-200' : 'bg-white'}`}>
                <div>
                  <h2 className={`text-lg font-semibold ${summaryModal === 'overdue' ? 'text-red-800' : 'text-slate-950'}`}>
                    {summaryModal === 'expected' && '💰 Expected Payments'}
                    {summaryModal === 'received' && '✅ Received Payments'}
                    {summaryModal === 'outstanding' && '📅 Outstanding Payments'}
                    {summaryModal === 'overdue' && '⚠️ Overdue Payments — Needs Chasing'}
                  </h2>
                  <p className="text-sm text-slate-500 mt-0.5">
                    {summaryModal === 'expected' && `Total expected: ${formatMoney(totals.expected)}`}
                    {summaryModal === 'received' && `Total received: ${formatMoney(totals.received)}`}
                    {summaryModal === 'outstanding' && `Total outstanding: ${formatMoney(totals.outstanding)}`}
                    {summaryModal === 'overdue' && `Total overdue: ${formatMoney(overdueTotal)} across ${chasingSummary.length} suppliers`}
                  </p>
                </div>
                <button type="button" onClick={() => setSummaryModal(null)} className="rounded-md p-1 hover:bg-slate-100 transition-colors cursor-pointer">
                  <X className="h-5 w-5 text-slate-500" />
                </button>
              </div>

              {/* Modal body */}
              <div className="overflow-y-auto flex-1 p-6">
                {summaryModal === 'overdue' ? (
                  <div className="flex flex-wrap gap-3">
                    {chasingSummary.map((row) => (
                      <button
                        key={row.supplier_id ?? 'unknown'}
                        type="button"
                        onClick={() => {
                          setSummaryModal(null);
                          const next = { ...filters, supplier: row.supplier_id ? String(row.supplier_id) : 'all', needs_chasing: 'true' };
                          const nextPag = { ...pagination, page: 1 };
                          setFilters(next);
                          setPagination(nextPag);
                          loadPayments(next, searchTerm, nextPag);
                        }}
                        className="rounded-lg border border-red-200 bg-white px-4 py-3 text-left shadow-sm hover:shadow-md transition-shadow min-w-[160px] cursor-pointer"
                      >
                        <p className="text-xs font-semibold text-slate-800 truncate max-w-[180px]">{row.supplier_name}</p>
                        <p className="text-xl font-bold text-red-700 mt-1">{formatMoney(row.total_outstanding)}</p>
                        <p className="text-xs text-slate-500 mt-0.5">{row.overdue_count} contract{row.overdue_count !== 1 ? 's' : ''} overdue</p>
                      </button>
                    ))}
                    {chasingSummary.length === 0 && (
                      <p className="text-slate-500 text-sm">No overdue payments found.</p>
                    )}
                  </div>
                ) : modalLoading ? (
                  <div className="flex items-center justify-center py-16 text-slate-500">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Loading contracts...
                  </div>
                ) : modalContracts.length === 0 ? (
                  <p className="text-center text-slate-500 py-12">No contracts found.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase border-b">
                        <tr>
                          <th className="px-3 py-2">Customer</th>
                          <th className="px-3 py-2">Supplier</th>
                          <th className="px-3 py-2">Agent</th>
                          <th className="px-3 py-2">MPAN/MPR</th>
                          <th className="px-3 py-2 text-right">Expected</th>
                          <th className="px-3 py-2 text-right">Received</th>
                          <th className="px-3 py-2 text-right">Outstanding</th>
                          <th className="px-3 py-2">Status</th>
                          <th className="px-3 py-2">Next Due</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y bg-white">
                        {modalContracts.map((group) => (
                          <tr
                            key={group.key}
                            className="hover:bg-slate-50 cursor-pointer transition-colors"
                            onClick={() => {
                              setSummaryModal(null);
                              const next = { ...filters, supplier: 'all', needs_chasing: '' };
                              const nextPag = { ...pagination, page: 1 };
                              setFilters(next);
                              setPagination(nextPag);
                              loadPayments(next, searchTerm, nextPag);
                            }}
                          >
                            <td className="px-3 py-2 font-medium text-slate-900">{group.title}</td>
                            <td className="px-3 py-2 text-slate-600">{group.payments[0]?.supplier_name || '-'}</td>
                            <td className="px-3 py-2 text-slate-600">{group.payments[0]?.agent_name || '-'}</td>
                            <td className="px-3 py-2 font-mono text-xs text-slate-600">{group.mpan || '-'}</td>
                            <td className="px-3 py-2 text-right font-medium">{formatMoney(group.expected)}</td>
                            <td className="px-3 py-2 text-right text-emerald-700 font-medium">{formatMoney(group.received)}</td>
                            <td className="px-3 py-2 text-right text-orange-700 font-medium">{formatMoney(group.outstanding)}</td>
                            <td className="px-3 py-2">
                              <div className="flex flex-wrap gap-1">
                                {group.statuses.map((s) => (
                                  <Badge key={s} className={statusTone[s]}>{s}</Badge>
                                ))}
                              </div>
                            </td>
                            <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{formatDate(group.nextDue)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="text-xs text-slate-400 mt-3 text-center">Showing up to 200 contracts. Use the main table filters for more.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <Sheet
          open={Boolean(selectedPayment)}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedPayment(null);
              setNotesDraft("");
            }
          }}
        >
          <SheetContent className="w-full overflow-y-auto p-0 sm:max-w-2xl">
            <SheetHeader className="border-b px-6 py-5 pr-12">
              <SheetTitle>Commission Payment</SheetTitle>
            </SheetHeader>

            {selectedPayment && (
              <div className="space-y-6 px-6 py-6">
                <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="pr-2 text-left text-lg font-semibold break-words text-slate-950 hover:underline dark:text-slate-50"
                        onClick={() => openCustomerDetails(selectedPayment.client_id)}
                      >
                        {selectedPayment.business_name || selectedPayment.customer_name || "Customer"}
                      </button>
                      <p className="mt-1 text-sm break-words text-slate-500 dark:text-slate-400">
                        {selectedPayment.supplier_name || "Supplier"} · {selectedPayment.agent_name || "Unassigned"}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                        {selectedPayment.payment_period_label || `Year ${selectedPayment.instalment_year}`}
                      </p>
                    </div>
                    <Badge className={`${statusTone[selectedPayment.status]} shrink-0`}>{selectedPayment.status}</Badge>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Service</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{selectedPayment.service_title || "-"}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">MPAN/MPR</p>
                      <p className="font-mono text-xs font-semibold break-words text-slate-900 dark:text-slate-100">
                        {selectedPayment.mpan_number || selectedPayment.mpan_bottom || "-"}
                      </p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Contract start</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(selectedPayment.contract_start_date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Contract end</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(selectedPayment.contract_end_date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Expected</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(selectedPayment.expected_net_amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Outstanding</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(selectedPayment.outstanding_amount)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Due date</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDate(selectedPayment.due_date)}</p>
                    </div>
                    <div>
                      <p className="text-slate-500 dark:text-slate-400">Last checked</p>
                      <p className="font-semibold text-slate-900 dark:text-slate-100">{formatDateTime(selectedPayment.last_checked_at)}</p>
                    </div>
                    {selectedPayment.next_follow_up_date && (
                      <div>
                        <p className="text-slate-500">Next follow-up</p>
                        <p className="font-semibold text-amber-700">{formatDate(selectedPayment.next_follow_up_date)}</p>
                      </div>
                    )}
                    {selectedPayment.follow_up_count != null && selectedPayment.follow_up_count > 0 && (
                      <div>
                        <p className="text-slate-500">Times chased</p>
                        <p className="font-semibold">{selectedPayment.follow_up_count}</p>
                      </div>
                    )}
                  </div>
                </div>

                {selectedIsClosed ? (
                  <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
                    This payment is closed. Receipts and chasing actions are no longer available.
                  </div>
                ) : (
                  <>
                    <form onSubmit={submitReceipt} className="space-y-4 rounded-lg border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950 dark:text-slate-50">
                        <Banknote className="h-4 w-4" />
                        Log Payment
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label htmlFor="amount_received" className="dark:text-slate-300">Amount received</Label>
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
                            className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="date_received" className="dark:text-slate-300">Date received</Label>
                          <Input
                            id="date_received"
                            type="date"
                            value={receiptDraft.date_received}
                            onChange={(event) =>
                              setReceiptDraft((current) => ({ ...current, date_received: event.target.value }))
                            }
                            className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="notes" className="dark:text-slate-300">Notes</Label>
                        <Textarea
                          id="notes"
                          value={receiptDraft.notes}
                          onChange={(event) =>
                            setReceiptDraft((current) => ({ ...current, notes: event.target.value }))
                          }
                          rows={3}
                          className="resize-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
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

                    <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-800 dark:bg-slate-900">
                      <div className="mb-3 text-sm font-semibold text-slate-950 dark:text-slate-50">Actions</div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => patchStatus("Chasing Supplier")} disabled={saving} className="dark:border-slate-700 dark:hover:bg-slate-800">
                          <CalendarCheck className="mr-2 h-4 w-4" />
                          Mark as Chasing Supplier
                        </Button>
                        <Button variant="destructive" onClick={() => patchStatus("Closed")} disabled={saving}>
                          <XCircle className="mr-2 h-4 w-4" />
                          Close
                        </Button>
                      </div>
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
                  {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
                  )}
                  <Button type="submit" disabled={saving}>
                    {saving ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Banknote className="mr-2 h-4 w-4" />
                    )}
                    Log Payment
                  </Button>
                </form>

                {/* Notes — standalone, not part of log payment */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <ReceiptText className="h-4 w-4" />
                    Notes
                  </div>
                  <Textarea
                    placeholder="Add any notes about this payment, follow-up actions, or supplier communications..."
                    value={notesDraft}
                    onChange={(e) => setNotesDraft(e.target.value)}
                    rows={4}
                    className="resize-none"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={savingNote || !notesDraft.trim()}
                    onClick={submitNote}
                  >
                    {savingNote ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ReceiptText className="mr-2 h-4 w-4" />}
                    Save Note
                  </Button>
                </div>

                {/* Actions */}
                <div className="rounded-lg border p-4 space-y-3">
                  <div className="text-sm font-semibold text-slate-950">Actions</div>

                  {/* Follow-up info */}
                  {(selectedPayment.follow_up_count != null && selectedPayment.follow_up_count > 0 || selectedPayment.next_follow_up_date) && (
                    <div className="rounded-md bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-800 space-y-0.5">
                      {selectedPayment.follow_up_count != null && selectedPayment.follow_up_count > 0 && (
                        <p>Chased <strong>{selectedPayment.follow_up_count}</strong> time{selectedPayment.follow_up_count !== 1 ? "s" : ""}</p>
                      )}
                      {selectedPayment.next_follow_up_date && (
                        <p>Next follow-up: <strong>{formatDate(selectedPayment.next_follow_up_date)}</strong></p>
                      )}
                    </div>
                  )}

                  {/* Chasing Supplier — with follow-up date picker */}
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <CalendarCheck className="h-3.5 w-3.5" />
                      <span>Follow up on</span>
                      <Input
                        type="date"
                        className="h-7 text-xs w-36 py-0"
                        value={followUpDate}
                        onChange={(e) => setFollowUpDate(e.target.value)}
                      />
                    </div>
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
                </div>

                {/* Payment History */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-slate-950 dark:text-slate-50">Receipt history</h3>
                  {detailLoading ? (
                    <div className="flex items-center text-sm text-slate-500 dark:text-slate-400">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Loading receipts...
                    </div>
                  ) : receipts.length > 0 ? (
                    receipts.map((receipt) => (
                      <div key={receipt.id} className="rounded-lg border border-slate-200 p-3 text-sm dark:border-slate-800 dark:bg-slate-900">
                        {editingReceiptId === receipt.id ? (
                          <form onSubmit={submitReceiptEdit} className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2">
                                <Label htmlFor={`edit_amount_${receipt.id}`} className="dark:text-slate-300">Amount received</Label>
                                <Input
                                  id={`edit_amount_${receipt.id}`}
                                  step="0.01"
                                  type="number"
                                  value={receiptEditDraft.amount_received}
                                  onChange={(event) =>
                                    setReceiptEditDraft((current) => ({
                                      ...current,
                                      amount_received: event.target.value,
                                    }))
                                  }
                                  required
                                  className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
                                />
                              </div>
                              <div className="space-y-2">
                                <Label htmlFor={`edit_date_${receipt.id}`} className="dark:text-slate-300">Date received</Label>
                                <Input
                                  id={`edit_date_${receipt.id}`}
                                  type="date"
                                  value={receiptEditDraft.date_received}
                                  onChange={(event) =>
                                    setReceiptEditDraft((current) => ({ ...current, date_received: event.target.value }))
                                  }
                                  className="dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:[color-scheme:dark]"
                                />
                              </div>
                            </div>
                            <div className="space-y-2">
                              <Label htmlFor={`edit_notes_${receipt.id}`} className="dark:text-slate-300">Notes</Label>
                              <Textarea
                                id={`edit_notes_${receipt.id}`}
                                value={receiptEditDraft.notes}
                                onChange={(event) =>
                                  setReceiptEditDraft((current) => ({ ...current, notes: event.target.value }))
                                }
                                rows={2}
                                className="resize-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="submit" size="sm" disabled={saving}>
                                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Save
                              </Button>
                              <Button type="button" size="sm" variant="outline" onClick={cancelEditingReceipt} className="dark:border-slate-700 dark:hover:bg-slate-800">
                                Cancel
                              </Button>
                            </div>
                          </form>
                        ) : (
                          <>
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-semibold text-slate-900 dark:text-slate-100">{formatMoney(receipt.amount_received)}</p>
                              <p className="text-slate-500 dark:text-slate-400">{formatDate(receipt.date_received)}</p>
                            </div>
                            <p className="mt-1 text-slate-500 dark:text-slate-400">
                              {receipt.logged_by_name || "Logged"} · {formatDateTime(receipt.created_at)}
                            </p>
                            {receipt.notes && <p className="mt-2 text-slate-700 dark:text-slate-300">{receipt.notes}</p>}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="mt-3 dark:border-slate-700 dark:hover:bg-slate-800"
                              onClick={() => startEditingReceipt(receipt)}
                            >
                              <Edit className="mr-2 h-4 w-4" />
                              Edit Receipt
                            </Button>
                          </>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="rounded-lg border border-dashed border-slate-200 p-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
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