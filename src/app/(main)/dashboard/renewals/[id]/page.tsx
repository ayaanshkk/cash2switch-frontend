"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Edit,
  Loader2,
  AlertCircle,
  Save,
  X,
  MapPin,
  Calendar,
  User,
  DollarSign,
  FileText,
  CreditCard,
  MoreVertical,
  Upload,
  File,
  Download,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// Tab configuration
const TABS = [
  { id: "contact", label: "Contact Information", icon: User },
  { id: "contract", label: "Contract & Billing Details", icon: FileText },
  { id: "payments", label: "Payments Log", icon: CreditCard },
  { id: "address", label: "Address", icon: MapPin },
  { id: "charges", label: "Charges", icon: DollarSign },
  { id: "banking", label: "Bank & Trading Account Details", icon: CreditCard },
  { id: "others", label: "Others", icon: MoreVertical },
];

// Status options
const STATUS_OPTIONS = [
  { value: "Not Called", label: "Not Called" },
  { value: "Callback", label: "Callback" },
  { value: "Not Answered", label: "Not Answered" },
  { value: "Dead", label: "Dead" },
  { value: "Priced", label: "Priced" },
  { value: "Sold", label: "Sold" },
  { value: "Lost", label: "Lost" },
  { value: "Lost COT", label: "Lost COT" },
  { value: "Already Renewed", label: "Already Renewed" },
  { value: "Invalid Number", label: "Invalid Number" },
  { value: "Meter De-energised", label: "Meter De-energised" },
  { value: "Broker in Place", label: "Broker in Place" },
  { value: "End Date Changed", label: "End Date Changed" },
  { value: "Complaint", label: "Complaint" },
  { value: "Email Only", label: "Email Only" },
  { value: "Renewed Directly", label: "Renewed Directly" },
  { value: "Incorrect Supplier", label: "Incorrect Supplier" },
  { value: "Duplicate", label: "Duplicate" },
];

const getStatusColor = (status: string | undefined): string => {
  if (!status) return "bg-gray-100 text-gray-800";
  const statusLower = status.toLowerCase();
  if (statusLower === "called" || statusLower === "priced" || statusLower === "callback") {
    return "bg-green-100 text-green-800";
  }
  if (statusLower === "not answered") {
    return "bg-yellow-100 text-yellow-800";
  }
  if (statusLower === "lost" || statusLower === "lost cot") {
    return "bg-red-100 text-red-800";
  }
  if (statusLower === "not called") {
    return "bg-gray-100 text-gray-500";
  }
  if (statusLower === "dead") {
    return "bg-red-200 text-red-900";
  }
  return "bg-gray-100 text-gray-800";
};

/** Whitelist fields sent on PUT — avoids oversized/invalid payloads breaking assign & save */
function buildCustomerUpdatePayload(data: Partial<EnergyCustomer>, extra?: Record<string, unknown>) {
  const payload: Record<string, unknown> = { ...extra };
  const fields = [
    "business_name",
    "contact_person",
    "phone",
    "mobile_no",
    "email",
    "address",
    "post_code",
    "website",
    "site_address",
    "site_name",
    "annual_usage",
    "month_sold",
    "house_name",
    "house_number",
    "mpan_top",
    "mpan_bottom",
    "supplier_id",
    "old_supplier_id",
    "start_date",
    "end_date",
    "unit_rate",
    "rate_1",
    "rate_2",
    "rate_3",
    "net_notch",
    "comms_paid",
    "payment_type",
    "terms_of_sale",
    "aggregator",
    "term_sold",
    "assigned_to_id",
    "status",
    "document_details",
    "comments",
  ] as const;
  for (const key of fields) {
    if (key in data && (data as Record<string, unknown>)[key] !== undefined) {
      payload[key] = (data as Record<string, unknown>)[key];
    }
  }
  return payload;
}

const getStatusLabel = (status: string | undefined): string => {
  if (!status) return "—";
  // Direct match first
  const option = STATUS_OPTIONS.find((opt) => opt.value === status);
  if (option) return option.label;

  // Fallback: case-insensitive match
  const optionCaseInsensitive = STATUS_OPTIONS.find((opt) => opt.value.toLowerCase() === status.toLowerCase());
  return optionCaseInsensitive?.label || status;
};

interface EnergyCustomer {
  id: number;
  client_id: number;
  display_id?: number;
  display_order?: number;
  name: string;
  business_name: string;
  contact_person: string;
  phone: string;
  mobile_no?: string;
  email?: string;
  address?: string;
  post_code?: string;
  site_address?: string;
  mpan_top?: string;
  mpan_bottom?: string;
  supplier_name?: string;
  supplier_id?: number;
  annual_usage?: number;
  start_date?: string;
  end_date?: string;
  unit_rate?: number;
  standing_charge?: number;
  status?: string;
  assigned_to_name?: string | null;
  assigned_to_id?: number | null;
  created_at?: string;
  rate_1?: number;

  bank_name?: string;
  bank_sort_code?: string;
  bank_account_number?: string;

  trading_type?: string;
  trading_number?: string;

  night_charge?: number;
  eve_weekend_charge?: number;
  other_charges_1?: number;
  other_charges_2?: number;
  other_charges_3?: number;

  meter_ref?: string;
  payment_type?: string;
  aggregator?: string;
  uplift?: number;
  term_sold?: number;
  comments?: string;

  position?: string;
  company_number?: string;
  date_of_birth?: string;

  site_name?: string;
  month_sold?: string;
  house_name?: string;
  house_number?: string;
  door_number?: string;
  town?: string;
  county?: string;

  old_supplier_name?: string;
  old_supplier_id?: number;
  net_notch?: number;
  rate_2?: number;
  rate_3?: number;
  comms_paid?: number;

  charity_ltd_company_number?: string;
  partner_details?: string;
}

interface Employee {
  employee_id: number;
  employee_name: string;
  email: string;
}

interface InteractionHistory {
  interaction_id: number;
  interaction_type: string;
  contact_date?: string;
  reminder_date?: string;
  notes?: string;
  created_at?: string;
}

interface CustomerPaymentLog {
  success: boolean;
  is_admin: boolean;
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
    commission_payment_id: string;
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
    client_name: string | null;
    commission_rate: string;
    commission_amount: string;
    batch_month: string | null;
    status: string;
    receipt_amount?: string;
    created_at: string | null;
  }>;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const moneyFormatter = new Intl.NumberFormat("en-GB", {
  style: "currency",
  currency: "GBP",
});

const formatMoney = (value?: string | number | null) => moneyFormatter.format(Number(value || 0));

const formatDateTime = (dateString?: string | null) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const paymentStatusClass = (status?: string) => {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "received" || normalized === "commission paid") return "bg-emerald-100 text-emerald-700";
  if (normalized === "pending") return "bg-blue-100 text-blue-700";
  if (normalized === "partially paid" || normalized === "awaiting payment") return "bg-orange-100 text-orange-800";
  if (normalized === "chasing supplier" || normalized === "due") return "bg-red-100 text-red-700";
  if (normalized === "closed") return "bg-zinc-200 text-zinc-700";
  return "bg-slate-100 text-slate-700";
};

export default function EnergyCustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = ["platform admin", "tenant super admin", "admin", "superadmin", "super admin"].includes(
    user?.role?.trim().toLowerCase() || "",
  );
  const id = params?.id as string;
  const searchParams = useSearchParams();
  const fromPage = searchParams?.get("from") || "renewals";

  const [customer, setCustomer] = useState<EnergyCustomer | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("contact");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Partial<EnergyCustomer>>({});

  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([]);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [callbackStatus, setCallbackStatus] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackNotes, setCallbackNotes] = useState("");
  const [isSold, setIsSold] = useState<string>("");
  const [newEndDate, setNewEndDate] = useState("");
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [callbackError, setCallbackError] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [history, setHistory] = useState<InteractionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [paymentLog, setPaymentLog] = useState<CustomerPaymentLog | null>(null);
  const [loadingPaymentLog, setLoadingPaymentLog] = useState(false);
  const [paymentLogError, setPaymentLogError] = useState<string | null>(null);
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assigningEmployeeId, setAssigningEmployeeId] = useState<string>("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [isAssigningEmployee, setIsAssigningEmployee] = useState(false);
  const [suppliers, setSuppliers] = useState<{ supplier_id: number; supplier_name: string }[]>([]);
  const [calledDate, setCalledDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [renewedBy, setRenewedBy] = useState<"customer" | "agent" | "">("");

  useEffect(() => {
    loadCustomerData();
    loadEmployees();
    loadHistory();
    loadSuppliers();
  }, [id]);

  useEffect(() => {
    if (isAdmin && customer?.client_id) {
      loadPaymentLog(customer.client_id);
    }
  }, [customer?.client_id, isAdmin]);

  const loadCustomerData = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem("auth_token");

    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load customer data");

      const data = await response.json();
      console.log("📥 Customer data loaded:", data);
      console.log("📥 Status from API:", data.status);

      setCustomer(data);
      setEditedCustomer(data);
      // ✅ ADD THIS: Populate the status dropdown with the value from API
      if (data.status) {
        setCallbackStatus(data.status);
      }

      if (data.document_details) {
        try {
          const docs = JSON.parse(data.document_details);
          setUploadedDocuments(Array.isArray(docs) ? docs : []);
        } catch {
          setUploadedDocuments([]);
        }
      }
    } catch (error) {
      console.error("Error loading customer:", error);
      setError("Failed to load customer data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const loadSuppliers = async () => {
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
      }
    } catch (error) {
      console.error("Error loading suppliers:", error);
    }
  };

  const loadEmployees = async () => {
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const resolveClientId = () => customer?.client_id ?? parseInt(id, 10);

  const loadHistory = async () => {
    setLoadingHistory(true);
    const token = localStorage.getItem("auth_token");
    const clientId = resolveClientId();

    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${clientId}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setHistory(data.interactions || []);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const loadPaymentLog = async (clientIdOverride?: number) => {
    setLoadingPaymentLog(true);
    setPaymentLogError(null);
    const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
    const clientId = clientIdOverride ?? resolveClientId();

    try {
      const response = await fetch(`${API_BASE_URL}/api/commission/customer-log/${clientId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.message || data?.error || "Failed to load payment log");
      }

      setPaymentLog(data);
    } catch (error) {
      setPaymentLogError(error instanceof Error ? error.message : "Failed to load payment log");
      setPaymentLog(null);
    } finally {
      setLoadingPaymentLog(false);
    }
  };

  const statusConfig: Record<
    string,
    {
      requiresDate: boolean;
      requiresSold: boolean;
      deletesRecord: boolean;
      requiresNotes: boolean;
      requiresNewEndDate: boolean;
      requiresSupplierChange: boolean;
      requiresAddressChange: boolean;
    }
  > = {
    Callback: {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    // "Called": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
    "Not Answered": {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    Priced: {
      requiresDate: false,
      requiresSold: true,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    Lost: {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: true,
      requiresNotes: true,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "Lost COT": {
      requiresDate: false,
      requiresSold: false,
      deletesRecord: true,
      requiresNotes: true,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "Already Renewed": {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: true,
      requiresSupplierChange: true,
      requiresAddressChange: true,
    },
    "Invalid Number": {
      requiresDate: false,
      requiresSold: false,
      deletesRecord: true,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "Meter De-energised": {
      requiresDate: false,
      requiresSold: false,
      deletesRecord: true,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "Broker in Place": {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "End Date Changed": {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: true,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    Complaint: {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: true,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "Email Only": {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "Renewed Directly": {
      requiresDate: true,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: true,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "Incorrect Supplier": {
      requiresDate: false,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: true,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    "Not Called": {
      requiresDate: false,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    Dead: {
      requiresDate: false,
      requiresSold: false,
      deletesRecord: false,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
    Duplicate: {
      requiresDate: false,
      requiresSold: false,
      deletesRecord: true,
      requiresNotes: false,
      requiresNewEndDate: false,
      requiresSupplierChange: false,
      requiresAddressChange: false,
    },
  };

  const isDateRequired = () => {
    if (!callbackStatus) return false;

    const config = statusConfig[callbackStatus];
    if (!config) return false;

    if (config.requiresSold) {
      return isSold === "yes";
    }

    return config.requiresDate;
  };

  const handleOpenCallbackModal = () => {
    setCallbackStatus("");
    setCallbackDate("");
    setCalledDate(new Date().toISOString().split("T")[0]);
    setCallbackNotes("");
    setIsSold("");
    setCallbackError("");
    setShowCallbackModal(true);
    setRenewedBy("");
  };

  const handleSubmitCallback = async () => {
    setCallbackError("");

    if (!callbackStatus) {
      setCallbackError("Please select a status");
      return;
    }

    const config = statusConfig[callbackStatus];

    if (config?.requiresSold && !isSold) {
      setCallbackError("Please select if the contract was sold");
      return;
    }

    if (config?.requiresNotes && !callbackNotes.trim()) {
      setCallbackError("Please enter the reason for this status");
      return;
    }

    if (callbackStatus === "Already Renewed" && !renewedBy) {
      setCallbackError("Please select if renewed by customer or agent");
      return;
    }

    if (config?.requiresNewEndDate && !newEndDate) {
      setCallbackError("Please enter the new contract end date");
      return;
    }

    setIsSubmittingCallback(true);

    try {
      const token = localStorage.getItem("auth_token");

      // ✅ Always include all fields — backend ignores what it doesn't need
      const payload: any = {
        status: callbackStatus,
        notes: callbackNotes,
        called_date: calledDate,
        callback_date: callbackDate || null, // ✅ always send, even if empty
      };

      if (config?.requiresSold) {
        payload.is_sold = isSold === "yes";
      }

      if (config?.requiresNewEndDate && newEndDate) {
        payload.new_end_date = newEndDate;
      }

      if (callbackStatus === "Already Renewed" && renewedBy) {
        payload.renewed_by = renewedBy;
      }

      if (config?.requiresSupplierChange && newSupplier.trim()) {
        payload.new_supplier = newSupplier.trim();
      }

      if (config?.requiresAddressChange && newAddress.trim()) {
        payload.new_address = newAddress.trim();
      }

      const clientId = resolveClientId();
      const response = await fetch(`${API_BASE_URL}/energy-clients/${clientId}/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save callback");
      }

      if (data.display_only || callbackStatus === "Dead") {
        await loadCustomerData();
        setCallbackStatus(callbackStatus);
        alert(`✅ Status set to ${callbackStatus}`);
        setCallbackNotes("");
        await loadHistory();
        return;
      }

      // ✅ ALWAYS reload customer data to get fresh values (including updated end date, supplier, address)
      await loadCustomerData();

      if (data.moved_to_cleansing) {
        alert("🧹 Moved to Cleansing");
        router.push("/dashboard/cleansing");
        return;
      }
      if (data.moved_to_recycle_bin || data.deleted) {
        alert("✅ Record removed from leads list");
        router.push("/dashboard/leads");
        return;
      }
      if (data.moved_to_priced) {
        alert("✅ Moved to Priced page");
        router.push("/dashboard/priced");
        return;
      }

      // ✅ Reload history FIRST before resetting state
      await loadHistory();

      if (data.customer) {
        setCustomer((prev) => (prev ? { ...prev, ...data.customer } : data.customer));
        setEditedCustomer((prev) => ({ ...prev, ...data.customer }));
      }

      if (callbackStatus === "Already Renewed") alert("✅ Lead information updated");
      else if (callbackStatus === "End Date Changed")
        alert(`✅ Contract end date updated to ${formatDate(newEndDate)}`);
      else if (callbackStatus === "Converted") alert("✅ Lead marked as Converted");
      else alert("✅ Action saved successfully");

      // Reset form fields only (not status)
      setCallbackDate("");
      setCallbackNotes("");
      setIsSold("");
      setNewEndDate("");
      setNewSupplier("");
      setNewAddress("");
      setCalledDate(new Date().toISOString().split("T")[0]);
      setRenewedBy("");
      setCallbackError("");

      try {
        localStorage.setItem("calendar-refetch-trigger", Date.now().toString());
        window.dispatchEvent(new CustomEvent("calendar-refetch", { detail: { action: "refetch-calendar" } }));
      } catch {
        /* non-blocking */
      }
    } catch (err: any) {
      console.error("❌ Callback error:", err);
      setCallbackError(err.message || "Failed to save callback");
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  const handleClearStatus = async () => {
    if (!window.confirm("Are you sure you want to clear the status?")) {
      return;
    }

    try {
      const token = localStorage.getItem("auth_token");

      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: null }),
      });

      if (!response.ok) {
        throw new Error("Failed to clear status");
      }

      // Reload customer data to get fresh state
      await loadCustomerData();

      // Reset the status dropdown
      setCallbackStatus("");

      alert("✅ Status cleared successfully");
    } catch (error) {
      console.error("Error clearing status:", error);
      alert("❌ Failed to clear status");
    }
  };

  const handleDeleteInteraction = async (interactionId: number) => {
    if (!window.confirm("Are you sure you want to delete this history entry?")) {
      return;
    }

    const token = localStorage.getItem("auth_token");

    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${resolveClientId()}/history/${interactionId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete interaction");
      }

      // Success - refresh history
      alert("✅ History entry deleted successfully");
      loadHistory();
    } catch (error) {
      console.error("Error deleting interaction:", error);
      alert("❌ Failed to delete history entry");
    }
  };

  const handleSave = async () => {
    if (!customer) return;

    setIsSaving(true);
    const token = localStorage.getItem("auth_token");
    const clientId = customer.client_id ?? parseInt(id, 10);

    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${clientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(buildCustomerUpdatePayload(editedCustomer)),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = data.customer || data;
        setCustomer(updated);
        setEditedCustomer(updated);
        setIsEditing(false);
        await loadHistory();
        alert("✅ Customer updated successfully!");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to update customer: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      alert("Network error: Could not update customer");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedCustomer(customer || {});
    setIsEditing(false);
  };

  const handleUpdateField = (field: keyof EnergyCustomer, value: any) => {
    setEditedCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const handleAssignEmployee = async () => {
    if (!assigningEmployeeId) return;

    setIsAssigningEmployee(true);
    try {
      const token = localStorage.getItem("auth_token");
      const clientId = customer?.client_id ?? parseInt(id, 10);
      const empId = assigningEmployeeId === "0" ? null : parseInt(assigningEmployeeId, 10);

      if (assigningEmployeeId !== "0" && Number.isNaN(empId)) {
        alert("Please select a valid salesperson");
        return;
      }

      const payload: Record<string, unknown> = { assigned_to_id: empId };
      if (assignmentNotes.trim()) {
        payload.assignment_notes = assignmentNotes.trim();
      }

      const response = await fetch(`${API_BASE_URL}/energy-clients/${clientId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        const updated = data.customer || null;
        const employee = employees.find((e) => e.employee_id === empId);

        if (updated) {
          setCustomer(updated);
          setEditedCustomer(updated);
        } else {
          setCustomer((prev) =>
            prev
              ? {
                  ...prev,
                  assigned_to_id: empId,
                  assigned_to_name: empId ? employee?.employee_name : undefined,
                }
              : null,
          );
        }

        alert("✅ Salesperson assigned successfully");
        setShowAssignmentModal(false);
        setAssigningEmployeeId("");
        setAssignmentNotes("");
        await loadHistory();
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to assign salesperson: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Error updating assignment:", error);
      alert("Failed to assign salesperson");
    } finally {
      setIsAssigningEmployee(false);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingDocument(true);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        alert("No authentication token found. Please log in again.");
        return;
      }

      const formData = new FormData();

      Array.from(files).forEach((file) => {
        formData.append("documents", file);
      });

      formData.append("client_id", id);

      // ✅ UPDATED ENDPOINT URL
      const response = await fetch(`${API_BASE_URL}/api/crm/documents/upload-customer-documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          alert(`Failed to upload: ${errorJson.error || errorJson.message || errorText}`);
        } catch {
          alert(`Failed to upload: ${errorText}`);
        }
        return;
      }

      const result = await response.json();

      if (!result.file_paths || result.file_paths.length === 0) {
        alert("Upload succeeded but no file paths were returned");
        return;
      }

      const newDocuments = result.file_paths;
      const updatedDocuments = [...uploadedDocuments, ...newDocuments];
      setUploadedDocuments(updatedDocuments);

      // ✅ This will update the database with new document URLs
      await updateDocumentDetails(updatedDocuments);

      alert(`✅ ${newDocuments.length} document(s) uploaded successfully!`);
    } catch (error: unknown) {
      alert(`Network error: ${error instanceof Error ? error.message : "Could not upload documents"}`);
    } finally {
      setIsUploadingDocument(false);
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const updateDocumentDetails = async (documents: string[]) => {
    if (!customer) return;

    const token = localStorage.getItem("auth_token");
    try {
      await fetch(`${API_BASE_URL}/energy-clients/${customer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_details: JSON.stringify(documents),
        }),
      });
    } catch (error) {
      console.error("Error updating document details:", error);
    }
  };

  const handleDeleteDocument = async (docIndex: number) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    const updatedDocuments = uploadedDocuments.filter((_, index) => index !== docIndex);
    setUploadedDocuments(updatedDocuments);

    await updateDocumentDetails(updatedDocuments);

    alert("✅ Document removed successfully!");
  };

  const getFileNameFromPath = (path: string) => {
    return path.split("/").pop() || path;
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-600" />
          <p className="mt-4 text-gray-600">Loading customer details...</p>
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-900">{error || "Customer not found"}</h3>
          <Button onClick={() => router.push("/dashboard/renewals")} className="mt-4">
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  const displayCustomer = isEditing ? editedCustomer : customer;
  const currentConfig = callbackStatus ? statusConfig[callbackStatus] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 pr-[340px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() =>
                router.push(
                  fromPage === "allocated"
                    ? "/dashboard/allocated-renewals"
                    : fromPage === "recycle-bin"
                      ? "/dashboard/recycle-bin"
                      : "/dashboard/renewals",
                )
              }
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Consumer Details</h1>
              <p className="text-sm text-gray-500">
                ID: {(customer as any).display_order || (customer as any).display_id || customer.client_id}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isEditing ? (
              <>
                <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-black hover:bg-gray-800">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex space-x-1 border-b border-gray-200">
          {TABS.filter((tab) => tab.id !== "payments" || isAdmin).map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "border-b-2 border-black text-black" : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 pr-[340px]">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          {/* Contact Information Tab */}
          {activeTab === "contact" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* ID */}
                <div>
                  <label className="text-sm font-medium text-gray-700">ID</label>
                  <Input
                    value={
                      (displayCustomer as any).display_order ||
                      (displayCustomer as any).display_id ||
                      displayCustomer.client_id ||
                      ""
                    }
                    disabled
                    className="mt-1 bg-gray-50"
                  />
                </div>

                {/* Client Name (Person) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Client Name</label>
                  <Input
                    value={displayCustomer.contact_person || ""}
                    onChange={(e) => handleUpdateField("contact_person", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Business Name (Trading Name) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Trading Name</label>
                  <Input
                    value={displayCustomer.business_name || ""}
                    onChange={(e) => handleUpdateField("business_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Position</label>
                  <Input
                    value={displayCustomer.position || ""}
                    onChange={(e) => handleUpdateField("position", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Tel Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Tel Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={displayCustomer.phone || ""}
                    onChange={(e) => handleUpdateField("phone", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Mobile Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Mobile Number</label>
                  <Input
                    value={displayCustomer.mobile_no || ""}
                    onChange={(e) => handleUpdateField("mobile_no", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input
                    value={displayCustomer.email || ""}
                    onChange={(e) => handleUpdateField("email", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Company Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Company Number</label>
                  <Input
                    value={displayCustomer.company_number || ""}
                    onChange={(e) => handleUpdateField("company_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                  <Input
                    type="date"
                    value={displayCustomer.date_of_birth?.split("T")[0] || ""}
                    onChange={(e) => handleUpdateField("date_of_birth", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Agent Allocated */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Agent Allocated</label>
                  {isEditing ? (
                    <Select
                      value={displayCustomer.assigned_to_id?.toString() || ""}
                      onValueChange={(value) => handleUpdateField("assigned_to_id", parseInt(value))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem key={employee.employee_id} value={employee.employee_id.toString()}>
                            {employee.employee_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={displayCustomer.assigned_to_name || ""} disabled className="mt-1 bg-gray-50" />
                  )}
                </div>

                {/* Agent Sold */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Agent Sold</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>
              </div>
            </div>
          )}

          {/* Contract & Billing Details Tab */}
          {activeTab === "contract" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Contract & Billing Details</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Supplier */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Old Supplier</label>
                  {isEditing ? (
                    <Select
                      value={displayCustomer.old_supplier_id?.toString() || ""}
                      onValueChange={(value) => handleUpdateField("old_supplier_id", parseInt(value))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select old supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">— None —</SelectItem>
                        {suppliers.map((s) => (
                          <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>
                            {s.supplier_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={displayCustomer.old_supplier_name || ""} disabled className="mt-1 bg-gray-50" />
                  )}
                </div>

                {/* New Supplier — this updates the active contract supplier */}
                <div>
                  <label className="text-sm font-medium text-gray-700">New Supplier</label>
                  {isEditing ? (
                    <Select
                      value={displayCustomer.supplier_id?.toString() || ""}
                      onValueChange={(value) => handleUpdateField("supplier_id", parseInt(value))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select new supplier" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">— None —</SelectItem>
                        {suppliers.map((s) => (
                          <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>
                            {s.supplier_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={displayCustomer.supplier_name || ""} disabled className="mt-1 bg-gray-50" />
                  )}
                </div>

                {/* Site Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Site Name</label>
                  <Input
                    value={displayCustomer.site_name || ""}
                    onChange={(e) => handleUpdateField("site_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Month Sold */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Month Sold</label>
                  <Input
                    value={
                      displayCustomer.month_sold
                        ? displayCustomer.month_sold.includes("T") || displayCustomer.month_sold.includes(" ")
                          ? new Date(displayCustomer.month_sold).toLocaleDateString("en-GB", {
                              month: "short",
                              year: "numeric",
                            })
                          : displayCustomer.month_sold
                        : ""
                    }
                    onChange={(e) => handleUpdateField("month_sold", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* MPAN Top */}
                <div>
                  <label className="text-sm font-medium text-gray-700">MPAN Top</label>
                  <Input
                    value={displayCustomer.mpan_top || ""}
                    onChange={(e) => handleUpdateField("mpan_top", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* MPAN Bottom */}
                <div>
                  <label className="text-sm font-medium text-gray-700">MPAN Bottom</label>
                  <Input
                    value={displayCustomer.mpan_bottom || ""}
                    onChange={(e) => handleUpdateField("mpan_bottom", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Data Source */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Data Source</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* Annual Usage */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Annual Usage (kWh)</label>
                  <Input
                    type="number"
                    value={displayCustomer.annual_usage || ""}
                    onChange={(e) => handleUpdateField("annual_usage", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Payment Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Payment Type</label>
                  <Input
                    value={displayCustomer.payment_type || ""}
                    onChange={(e) => handleUpdateField("payment_type", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Start Date</label>
                  <Input
                    type="date"
                    value={displayCustomer.start_date?.split("T")[0] || ""}
                    onChange={(e) => handleUpdateField("start_date", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Contract End</label>
                  <Input
                    type="date"
                    value={displayCustomer.end_date?.split("T")[0] || ""}
                    onChange={(e) => handleUpdateField("end_date", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Term Sold */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Term Sold (Years)</label>
                  <Input
                    type="number"
                    value={displayCustomer.term_sold || ""}
                    onChange={(e) => handleUpdateField("term_sold", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Net Notch */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Net Notch</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.net_notch || ""}
                    onChange={(e) => handleUpdateField("net_notch", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Comms Paid */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Comms Paid (£)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.comms_paid || ""}
                    onChange={(e) => handleUpdateField("comms_paid", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Aggregator */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Aggregator</label>
                  <Input
                    value={displayCustomer.aggregator || ""}
                    onChange={(e) => handleUpdateField("aggregator", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Documents Section */}
                <div className="mt-6 border-t pt-6 md:col-span-2">
                  <div className="mb-4 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">Documents</label>
                    <div>
                      <input
                        type="file"
                        id="document-upload"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={handleDocumentUpload}
                        className="hidden"
                        disabled={isUploadingDocument}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("document-upload")?.click()}
                        disabled={isUploadingDocument}
                      >
                        {isUploadingDocument ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Documents
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {uploadedDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {uploadedDocuments.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3"
                        >
                          <div className="flex min-w-0 flex-1 items-center space-x-3">
                            <File className="h-5 w-5 flex-shrink-0 text-gray-400" />
                            <span className="truncate text-sm text-gray-700">{getFileNameFromPath(doc)}</span>
                          </div>
                          <div className="ml-4 flex items-center space-x-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(doc, "_blank")}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteDocument(index)}
                              className="text-red-600 hover:bg-red-50 hover:text-red-700"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-6 text-center">
                      <File className="mx-auto mb-2 h-8 w-8 text-gray-400" />
                      <p className="text-sm text-gray-500">No documents uploaded yet</p>
                      <p className="mt-1 text-xs text-gray-400">Click "Upload Documents" to add files</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Payments Log Tab */}
          {activeTab === "payments" && (
            <div className="space-y-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900">Payments Log</h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Commission payment schedule, supplier receipt history, and agent commission entries for this
                    customer.
                  </p>
                </div>
                <Button
                  variant="outline"
                  onClick={() => loadPaymentLog(displayCustomer.client_id)}
                  disabled={loadingPaymentLog}
                >
                  {loadingPaymentLog ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Refresh
                </Button>
              </div>

              {paymentLogError && (
                <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  {paymentLogError}
                </div>
              )}

              {loadingPaymentLog ? (
                <div className="flex min-h-48 items-center justify-center rounded-lg border bg-gray-50 text-gray-500">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Loading payment log...
                </div>
              ) : !paymentLog ? (
                <div className="rounded-lg border border-dashed bg-gray-50 px-4 py-12 text-center text-sm text-gray-500">
                  No payment log is available for this customer yet.
                </div>
              ) : (
                <>
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border bg-white p-4">
                      <p className="text-sm font-medium text-gray-500">Payment Rows</p>
                      <p className="mt-2 text-2xl font-semibold">{paymentLog.totals.payment_count}</p>
                    </div>
                    <div className="rounded-lg border bg-white p-4">
                      <p className="text-sm font-medium text-gray-500">
                        {paymentLog.is_admin ? "Supplier Receipts" : "Agent Commission Entries"}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {paymentLog.is_admin
                          ? paymentLog.totals.receipt_count
                          : paymentLog.totals.agent_commission_count}
                      </p>
                    </div>
                    <div className="rounded-lg border bg-white p-4">
                      <p className="text-sm font-medium text-gray-500">
                        {paymentLog.is_admin ? "Outstanding" : "View"}
                      </p>
                      <p className="mt-2 text-2xl font-semibold">
                        {paymentLog.is_admin ? formatMoney(paymentLog.totals.total_outstanding) : "Own commissions"}
                      </p>
                    </div>
                  </div>

                  {paymentLog.is_admin && (
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="rounded-lg border bg-slate-50 p-4">
                        <p className="text-sm font-medium text-gray-500">Expected</p>
                        <p className="mt-1 text-xl font-semibold">{formatMoney(paymentLog.totals.total_expected)}</p>
                      </div>
                      <div className="rounded-lg border bg-emerald-50 p-4">
                        <p className="text-sm font-medium text-emerald-700">Received</p>
                        <p className="mt-1 text-xl font-semibold text-emerald-900">
                          {formatMoney(paymentLog.totals.total_received)}
                        </p>
                      </div>
                      <div className="rounded-lg border bg-orange-50 p-4">
                        <p className="text-sm font-medium text-orange-700">Outstanding</p>
                        <p className="mt-1 text-xl font-semibold text-orange-900">
                          {formatMoney(paymentLog.totals.total_outstanding)}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border bg-white">
                    <div className="border-b px-4 py-3">
                      <h3 className="font-semibold text-gray-900">Commission Payment Schedule</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[920px] text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                          <tr>
                            <th className="px-4 py-3">Contract / Year</th>
                            <th className="px-4 py-3">Supplier</th>
                            <th className="px-4 py-3">Aggregator</th>
                            <th className="px-4 py-3">Agent</th>
                            {paymentLog.is_admin && <th className="px-4 py-3 text-right">Expected</th>}
                            <th className="px-4 py-3">Due Date</th>
                            {paymentLog.is_admin && <th className="px-4 py-3 text-right">Received</th>}
                            {paymentLog.is_admin && <th className="px-4 py-3 text-right">Outstanding</th>}
                            <th className="px-4 py-3">Status</th>
                            <th className="px-4 py-3">Last Checked</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {paymentLog.payments.map((payment) => (
                            <tr key={payment.id}>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                Contract #{payment.contract_id || "-"}
                                <span className="block text-xs text-gray-500">
                                  {payment.payment_period_label || `Year ${payment.instalment_year}`}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{payment.supplier_name || "-"}</td>
                              <td className="px-4 py-3 text-gray-700">{payment.aggregator || "-"}</td>
                              <td className="px-4 py-3 text-gray-700">{payment.agent_name || "-"}</td>
                              {paymentLog.is_admin && (
                                <td className="px-4 py-3 text-right font-medium">
                                  {formatMoney(payment.expected_net_amount)}
                                </td>
                              )}
                              <td className="px-4 py-3 text-gray-700">{formatDate(payment.due_date || undefined)}</td>
                              {paymentLog.is_admin && (
                                <td className="px-4 py-3 text-right">{formatMoney(payment.amount_received)}</td>
                              )}
                              {paymentLog.is_admin && (
                                <td className="px-4 py-3 text-right font-medium">
                                  {formatMoney(payment.outstanding_amount)}
                                </td>
                              )}
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusClass(
                                    payment.status,
                                  )}`}
                                >
                                  {payment.status}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-gray-700">{formatDateTime(payment.last_checked_at)}</td>
                            </tr>
                          ))}
                          {paymentLog.payments.length === 0 && (
                            <tr>
                              <td
                                colSpan={paymentLog.is_admin ? 10 : 7}
                                className="px-4 py-10 text-center text-gray-500"
                              >
                                No commission payment rows have been generated for this customer yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {paymentLog.is_admin && (
                    <div className="rounded-lg border bg-white">
                      <div className="border-b px-4 py-3">
                        <h3 className="font-semibold text-gray-900">Supplier Receipt History</h3>
                      </div>
                      <div className="divide-y">
                        {paymentLog.receipts.map((receipt) => (
                          <div key={receipt.id} className="grid gap-3 px-4 py-3 text-sm md:grid-cols-[1fr_auto_auto]">
                            <div>
                              <p className="font-medium text-gray-900">
                                Contract #{receipt.contract_id || "-"} · {receipt.payment_period_label || `Year ${receipt.instalment_year || "-"}`}
                              </p>
                              <p className="text-gray-500">
                                Logged by {receipt.logged_by_name || "Unknown"} · {formatDateTime(receipt.created_at)}
                              </p>
                              {receipt.notes && <p className="mt-1 text-gray-700">{receipt.notes}</p>}
                            </div>
                            <div className="font-semibold text-gray-900">{formatMoney(receipt.amount_received)}</div>
                            <div className="text-gray-500">{formatDate(receipt.date_received || undefined)}</div>
                          </div>
                        ))}
                        {paymentLog.receipts.length === 0 && (
                          <div className="px-4 py-10 text-center text-sm text-gray-500">
                            No supplier receipts have been logged for this customer.
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="rounded-lg border bg-white">
                    <div className="border-b px-4 py-3">
                      <h3 className="font-semibold text-gray-900">Agent Commission Entries</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[720px] text-sm">
                        <thead className="bg-gray-50 text-left text-xs font-semibold text-gray-500 uppercase">
                          <tr>
                            <th className="px-4 py-3">Contract / Year</th>
                            {paymentLog.is_admin && <th className="px-4 py-3 text-right">Receipt Amount</th>}
                            <th className="px-4 py-3 text-right">Rate</th>
                            <th className="px-4 py-3 text-right">Commission</th>
                            <th className="px-4 py-3">Batch Month</th>
                            <th className="px-4 py-3">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {paymentLog.agent_commissions.map((item) => (
                            <tr key={item.id}>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                Contract #{item.contract_id || "-"}
                                <span className="block text-xs text-gray-500">
                                  {item.payment_period_label || `Year ${item.instalment_year || "-"}`}
                                </span>
                              </td>
                              {paymentLog.is_admin && (
                                <td className="px-4 py-3 text-right">{formatMoney(item.receipt_amount)}</td>
                              )}
                              <td className="px-4 py-3 text-right">{Number(item.commission_rate || 0).toFixed(2)}%</td>
                              <td className="px-4 py-3 text-right font-semibold">
                                {formatMoney(item.commission_amount)}
                              </td>
                              <td className="px-4 py-3 text-gray-700">{formatDate(item.batch_month || undefined)}</td>
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${paymentStatusClass(
                                    item.status,
                                  )}`}
                                >
                                  {item.status}
                                </span>
                              </td>
                            </tr>
                          ))}
                          {paymentLog.agent_commissions.length === 0 && (
                            <tr>
                              <td
                                colSpan={paymentLog.is_admin ? 6 : 5}
                                className="px-4 py-10 text-center text-gray-500"
                              >
                                No agent commission entries have been created for this customer yet.
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Address Tab */}
          {activeTab === "address" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Address</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* House Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700">House Name</label>
                  <Input
                    value={displayCustomer.house_name || ""}
                    onChange={(e) => handleUpdateField("house_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* House Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">House Number</label>
                  <Input
                    value={displayCustomer.house_number || ""}
                    onChange={(e) => handleUpdateField("house_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Door Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Door Number</label>
                  <Input
                    value={displayCustomer.door_number || ""}
                    onChange={(e) => handleUpdateField("door_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Street */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Street</label>
                  <Input
                    value={displayCustomer.address || ""}
                    onChange={(e) => handleUpdateField("address", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Town */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Town</label>
                  <Input
                    value={displayCustomer.town || ""}
                    onChange={(e) => handleUpdateField("town", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* County */}
                <div>
                  <label className="text-sm font-medium text-gray-700">County</label>
                  <Input
                    value={displayCustomer.county || ""}
                    onChange={(e) => handleUpdateField("county", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Post Code */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Post Code</label>
                  <Input
                    value={displayCustomer.post_code || ""}
                    onChange={(e) => handleUpdateField("post_code", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Charges Tab */}
          {activeTab === "charges" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Charges</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Standing Charge */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Standing Charge (£)</label>
                  <Input
                    type="text"
                    value={displayCustomer.standing_charge || ""}
                    onChange={(e) => handleUpdateField("standing_charge", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                    placeholder="e.g., 60p, 0.6, 25.2"
                  />
                </div>

                {/* Rate 1 (Unit Charge) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Rate 1 (p/kWh)</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={displayCustomer.unit_rate || ""}
                    onChange={(e) => handleUpdateField("unit_rate", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Rate 2 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Rate 2 (p/kWh)</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={displayCustomer.rate_2 || ""}
                    onChange={(e) => handleUpdateField("rate_2", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Rate 3 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Rate 3 (p/kWh)</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={displayCustomer.rate_3 || ""}
                    onChange={(e) => handleUpdateField("rate_3", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Night Charge */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Night Charge</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.night_charge || ""}
                    onChange={(e) => handleUpdateField("night_charge", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Eve/Weekend Charge */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Eve/Weekend Charge</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.eve_weekend_charge || ""}
                    onChange={(e) => handleUpdateField("eve_weekend_charge", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Other Charges 1 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Other Charges 1</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.other_charges_1 || ""}
                    onChange={(e) => handleUpdateField("other_charges_1", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Other Charges 2 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Other Charges 2</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.other_charges_2 || ""}
                    onChange={(e) => handleUpdateField("other_charges_2", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Other Charges 3 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Other Charges 3</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.other_charges_3 || ""}
                    onChange={(e) => handleUpdateField("other_charges_3", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Banking Tab */}
          {activeTab === "banking" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Bank & Trading Account Details</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Bank Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank Name</label>
                  <Input
                    value={displayCustomer.bank_name || ""}
                    onChange={(e) => handleUpdateField("bank_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Account Number</label>
                  <Input
                    value={displayCustomer.bank_account_number || ""}
                    onChange={(e) => handleUpdateField("bank_account_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Sort Code */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Sort Code</label>
                  <Input
                    value={displayCustomer.bank_sort_code || ""}
                    onChange={(e) => handleUpdateField("bank_sort_code", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                    placeholder="XX-XX-XX"
                  />
                </div>

                {/* Charity/Ltd Company Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Charity/Ltd Company Number</label>
                  <Input
                    value={displayCustomer.charity_ltd_company_number || ""}
                    onChange={(e) => handleUpdateField("charity_ltd_company_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Partner Details */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Partner Details</label>
                  <Textarea
                    value={displayCustomer.partner_details || ""}
                    onChange={(e) => handleUpdateField("partner_details", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                    rows={3}
                    placeholder="Enter partner details..."
                  />
                </div>
              </div>
            </div>
          )}

          {/* Others Tab */}
          {activeTab === "others" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Others</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Meter Ref */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Meter Ref</label>
                  <Input
                    value={displayCustomer.meter_ref || ""}
                    onChange={(e) => handleUpdateField("meter_ref", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Uplift */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Uplift</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.uplift || ""}
                    onChange={(e) => handleUpdateField("uplift", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Comments */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Comments</label>
                  <Textarea
                    value={displayCustomer.comments || ""}
                    onChange={(e) => handleUpdateField("comments", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ CALLBACK MODAL */}
      <Dialog open={showCallbackModal} onOpenChange={setShowCallbackModal}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Callback</DialogTitle>
            <DialogDescription>Record customer interaction and set follow-up</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {callbackError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{callbackError}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <div className="rounded border bg-gray-50 p-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(callbackStatus)}`}
                >
                  {getStatusLabel(callbackStatus)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Called Date</label>
              <Input type="date" value={calledDate} onChange={(e) => setCalledDate(e.target.value)} />
            </div>

            {statusConfig[callbackStatus]?.requiresSold && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Was it sold? *</label>
                <Select value={isSold} onValueChange={setIsSold}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes - Sold</SelectItem>
                    <SelectItem value="no">No - Move to Priced page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isDateRequired() && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  {callbackStatus === "End Date Changed" || callbackStatus === "Already Renewed"
                    ? "Action Date:"
                    : "Callback Date:"}{" "}
                  <span className="text-red-500">*</span>
                </label>
                <Input
                  type="date"
                  className="mt-1"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                />
              </div>
            )}

            {/* ✅ NEW: New End Date field for "End Date Changed" and "Already Renewed" */}
            {statusConfig[callbackStatus]?.requiresNewEndDate && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Contract End Date *</label>
                <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
                <p className="text-xs text-gray-500">The contract end date will be updated to this new date</p>
              </div>
            )}

            {/* ✅ New Supplier for Already Renewed */}
            {callbackStatus === "Already Renewed" && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  New Supplier <span className="font-normal text-gray-400">(Optional)</span>
                </label>
                <Input
                  type="text"
                  className="mt-1"
                  placeholder="Enter new supplier name"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank if supplier hasn't changed</p>
              </div>
            )}

            {/* ✅ New Address for Already Renewed */}
            {currentConfig?.requiresAddressChange && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  New Address <span className="font-normal text-gray-400">(Optional)</span>
                </label>
                <Textarea
                  className="mt-1"
                  rows={2}
                  placeholder="Enter new address if changed"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                />
                <p className="mt-1 text-xs text-gray-500">Leave blank if address hasn't changed</p>
              </div>
            )}

            {/* Renewed By - only for Already Renewed */}
            {callbackStatus === "Already Renewed" && (
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Renewed By <span className="text-red-500">*</span>
                </label>
                <div className="mt-1 flex flex-col gap-2 rounded-lg border bg-white p-3">
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="renewedBy_panel"
                      value="customer"
                      checked={renewedBy === "customer"}
                      onChange={() => setRenewedBy("customer")}
                      className="h-4 w-4 accent-black"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Renewed by Customer</span>
                      <p className="text-xs text-gray-500">Counts as Renewed Directly</p>
                    </div>
                  </label>
                  <label className="flex cursor-pointer items-center gap-3">
                    <input
                      type="radio"
                      name="renewedBy_panel"
                      value="agent"
                      checked={renewedBy === "agent"}
                      onChange={() => setRenewedBy("agent")}
                      className="h-4 w-4 accent-black"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Renewed by Agent</span>
                      <p className="text-xs text-gray-500">Counts as Renewed</p>
                    </div>
                  </label>
                </div>
              </div>
            )}

            {/* ✅ NEW: Supplier change field for "Already Renewed" */}
            {statusConfig[callbackStatus]?.requiresSupplierChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Supplier (Optional)</label>
                <Input
                  type="text"
                  placeholder="Enter new supplier name"
                  value={newSupplier}
                  onChange={(e) => setNewSupplier(e.target.value)}
                />
                <p className="text-xs text-gray-500">Leave blank if supplier hasn't changed</p>
              </div>
            )}

            {/* ✅ NEW: Address change field for "Already Renewed" */}
            {callbackStatus === "Already Renewed" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Address (Optional)</label>
                <Textarea
                  placeholder="Enter new address if changed"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  rows={2}
                />
                <p className="text-xs text-gray-500">Leave blank if address hasn't changed</p>
              </div>
            )}

            {statusConfig[callbackStatus]?.deletesRecord && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This will move the record to the recycle bin.
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium">
                Notes {statusConfig[callbackStatus]?.requiresNotes && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                placeholder={
                  statusConfig[callbackStatus]?.requiresNotes
                    ? "Enter required notes explaining the reason for this status..."
                    : "Add any additional notes..."
                }
                value={callbackNotes}
                onChange={(e) => setCallbackNotes(e.target.value)}
                rows={3}
              />
              {statusConfig[callbackStatus]?.requiresNotes && (
                <p className="text-xs text-gray-500">Required: Please explain the reason for this status</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCallbackModal(false)} disabled={isSubmittingCallback}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
              {isSubmittingCallback ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Callback"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Salesperson</DialogTitle>
            <DialogDescription>Add an optional note about this assignment</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Assigned To</label>
              <Select value={assigningEmployeeId} onValueChange={setAssigningEmployeeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select salesperson" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Unassigned</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                      {emp.employee_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700">Assignment Notes (Optional)</label>
              <Textarea
                className="mt-1"
                placeholder="Why is this being assigned? Any specific instructions..."
                value={assignmentNotes}
                onChange={(e) => setAssignmentNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignmentModal(false);
                setAssigningEmployeeId("");
                setAssignmentNotes("");
              }}
              disabled={isAssigningEmployee}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignEmployee} disabled={isAssigningEmployee}>
              {isAssigningEmployee ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                "Assign"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ✅ SIMPLE ACTION PANEL (Right Side) - Direct Form, No Modal */}
      <div className="fixed top-0 right-0 h-full w-80 overflow-y-auto border-l border-gray-200 bg-gray-50 p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Action</h3>

        <div className="space-y-4">
          {/* Assign To */}
          <div>
            <label className="text-sm font-medium text-gray-700">Assign to:</label>
            <Select
              value={customer.assigned_to_id?.toString() || "0"}
              onValueChange={(value) => {
                setAssigningEmployeeId(value);
                setAssignmentNotes("");
                setShowAssignmentModal(true);
              }}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Unassigned">{customer.assigned_to_name || "Unassigned"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Unassigned</SelectItem>
                {employees.map((employee) => (
                  <SelectItem key={employee.employee_id} value={employee.employee_id.toString()}>
                    {employee.employee_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Status: <span className="text-red-500">*</span>
            </label>
            <Select
              value={callbackStatus}
              onValueChange={(value) => {
                if (value === "CLEAR_STATUS") {
                  handleClearStatus();
                } else {
                  setCallbackStatus(value);
                  setCallbackDate("");
                  setCallbackNotes("");
                  setIsSold("");
                  setNewEndDate("");
                  setNewSupplier("");
                  setNewAddress("");
                  setRenewedBy("");
                }
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Set status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Not Called">Not Called</SelectItem>
                <SelectItem value="Callback">Callback</SelectItem>
                <SelectItem value="Not Answered">Not Answered</SelectItem>
                <SelectItem value="Dead">Dead</SelectItem>
                <SelectItem value="Priced">Priced</SelectItem>
                <SelectItem value="Sold">Sold</SelectItem>
                <SelectItem value="Lost">Lost</SelectItem>
                <SelectItem value="Lost COT">Lost COT</SelectItem>
                <SelectItem value="Already Renewed">Already Renewed</SelectItem>
                <SelectItem value="Renewed Directly">Renewed Directly</SelectItem>
                <SelectItem value="Invalid Number">Invalid Number</SelectItem>
                <SelectItem value="Incorrect Supplier">Incorrect Supplier</SelectItem>
                <SelectItem value="Meter De-energised">Meter De-energised</SelectItem>
                <SelectItem value="Broker in Place">Broker in Place</SelectItem>
                <SelectItem value="End Date Changed">End Date Changed</SelectItem>
                <SelectItem value="Complaint">Complaint</SelectItem>
                <SelectItem value="Email Only">Email Only</SelectItem>
                {customer.status && (
                  <>
                    <div className="my-1 border-t" />
                    <SelectItem value="CLEAR_STATUS" className="text-red-600">
                      ✕ Clear Status
                    </SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {callbackStatus && (
            <div>
              <label className="text-sm font-medium text-gray-700">Called Date</label>
              <Input type="date" className="mt-1" value={calledDate} onChange={(e) => setCalledDate(e.target.value)} />
            </div>
          )}

          {/* Conditional "Sold?" for Priced Status */}
          {currentConfig?.requiresSold && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Was it sold? <span className="text-red-500">*</span>
              </label>
              <Select value={isSold} onValueChange={setIsSold}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes - Sold</SelectItem>
                  <SelectItem value="no">No - Move to Priced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditional Date Picker */}
          {isDateRequired() && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Callback Date: <span className="font-normal text-gray-400"></span>
              </label>
              <Input
                type="date"
                className="mt-1"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
              />
            </div>
          )}

          {/* ✅ NEW: Contract End Date field for "End Date Changed" */}
          {currentConfig?.requiresNewEndDate && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                New Contract End Date: <span className="text-red-500">*</span>
              </label>
              <Input type="date" className="mt-1" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
              <p className="mt-1 text-xs text-gray-500">Contract end date will be updated</p>
            </div>
          )}

          {/* ✅ Renewed By - only for Already Renewed */}
          {callbackStatus === "Already Renewed" && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Renewed By <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex flex-col gap-2 rounded-lg border bg-white p-3">
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="renewedBy_action_panel"
                    value="customer"
                    checked={renewedBy === "customer"}
                    onChange={() => setRenewedBy("customer")}
                    className="h-4 w-4 accent-black"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Renewed by Customer</span>
                    <p className="text-xs text-gray-500">Counts as Renewed Directly</p>
                  </div>
                </label>
                <label className="flex cursor-pointer items-center gap-3">
                  <input
                    type="radio"
                    name="renewedBy_action_panel"
                    value="agent"
                    checked={renewedBy === "agent"}
                    onChange={() => setRenewedBy("agent")}
                    className="h-4 w-4 accent-black"
                  />
                  <div>
                    <span className="text-sm font-medium text-gray-900">Renewed by Agent</span>
                    <p className="text-xs text-gray-500">Counts as Renewed</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Deletion Warning */}
          {currentConfig?.deletesRecord && (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will permanently delete the record.
              </AlertDescription>
            </Alert>
          )}

          {/* New Supplier - Already Renewed */}
          {callbackStatus === "Already Renewed" && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                New Supplier <span className="font-normal text-gray-400">(Optional)</span>
              </label>
              <Input
                type="text"
                className="mt-1"
                placeholder="Enter new supplier name"
                value={newSupplier}
                onChange={(e) => setNewSupplier(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">Leave blank if supplier hasn't changed</p>
            </div>
          )}

          {/* New Address - Already Renewed */}
          {callbackStatus === "Already Renewed" && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                New Address <span className="font-normal text-gray-400">(Optional)</span>
              </label>
              <Textarea
                className="mt-1"
                rows={2}
                placeholder="Enter new address if changed"
                value={newAddress}
                onChange={(e) => setNewAddress(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">Leave blank if address hasn't changed</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Notes: {currentConfig?.requiresNotes && <span className="text-red-500">*</span>}
            </label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder={currentConfig?.requiresNotes ? "Enter reason why it was lost..." : "Add notes..."}
              value={callbackNotes}
              onChange={(e) => setCallbackNotes(e.target.value)}
            />
            {currentConfig?.requiresNotes && <p className="mt-1 text-xs text-gray-500">Required for Lost/Lost COT</p>}
          </div>

          {/* Error Display */}
          {callbackError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{callbackError}</AlertDescription>
            </Alert>
          )}

          {/* Save Button */}
          <Button
            className="w-full bg-black hover:bg-gray-800"
            onClick={handleSubmitCallback}
            disabled={isSubmittingCallback}
          >
            {isSubmittingCallback ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : callbackStatus ? (
              `Save ${callbackStatus}`
            ) : (
              "Save Action"
            )}
          </Button>
        </div>

        {/* ✅ History Section */}
        <div className="mt-8">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">History</h3>

          {loadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No interactions yet</p>
          ) : (
            <div className="space-y-3">
              {history.map((interaction) => {
                const rawNotes = interaction.notes || "";
                const cleanNotes = rawNotes.replace(/^\[.*?\]\s*/, "");
                const displayStatus = interaction.interaction_type || "Unknown";

                // ✅ Check if this is a callback with a reminder date
                const hasCallback =
                  interaction.reminder_date &&
                  [
                    "Callback",
                    "Called",
                    "Not Answered",
                    "Broker in Place",
                    "End Date Changed",
                    "Already Renewed",
                  ].includes(displayStatus);

                return (
                  <div
                    key={interaction.interaction_id}
                    className="group relative rounded-lg border border-gray-200 bg-white p-3 text-sm"
                  >
                    {/* ✅ DELETE BUTTON - Shows on hover */}
                    <button
                      onClick={() => handleDeleteInteraction(interaction.interaction_id)}
                      className="absolute top-2 right-2 rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-50"
                      title="Delete this entry"
                    >
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>

                    {/* ✅ Show the actual status */}
                    <div className="mb-2">
                      <span className="font-semibold text-gray-900">{displayStatus}</span>
                    </div>

                    {/* ✅ ALWAYS show notes if they exist */}
                    {cleanNotes && <p className="mb-2 pr-8 text-xs text-gray-600">{cleanNotes}</p>}

                    {/* ✅ Show callback/reminder date with calendar icon - ONLY for callback-type statuses */}
                    {hasCallback && (
                      <div className="mb-1 flex items-center gap-1 text-xs text-purple-700">
                        <Calendar className="h-3 w-3" />
                        <span>Callback: {formatDate(interaction.reminder_date)}</span>
                      </div>
                    )}

                    {/* ✅ Show timestamp for when this was created */}
                    {interaction.created_at && (
                      <div className="mt-1 text-xs text-gray-400">
                        {new Date(interaction.created_at).toLocaleString("en-GB", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
