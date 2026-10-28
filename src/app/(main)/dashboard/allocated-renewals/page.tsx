"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Filter, AlertCircle, ChevronRight, ChevronLeft,
  ChevronLast, ChevronFirst, Users, UserCheck, Loader2, X, ChevronDown, Download,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SearchableFilterCombobox } from "@/components/ui/SearchableFilterCombobox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";
import { toast, Toaster } from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SupplierCellCombobox } from "@/components/ui/SupplierCellCombobox";
import { SupplierDeleteDialog } from "@/components/ui/SupplierDeleteDialog";

// ---------------- Constants ----------------
const CUSTOMERS_PER_PAGE = 25;

const STATUS_OPTIONS = [
  { value: "Callback", label: "Callback" },
  { value: "Called", label: "Called" },
  { value: "Not Answered", label: "Not Answered" },
  { value: "Dead", label: "Dead" },
  { value: "Priced", label: "Priced" },
  { value: "Lost", label: "Lost" },
  { value: "Lost COT", label: "Lost COT" },
  { value: "Already Renewed", label: "Already Renewed" },
  { value: "Renewed Directly", label: "Renewed Directly" },
  { value: "Invalid Number", label: "Invalid Number" },
  { value: "Incorrect Supplier", label: "Incorrect Supplier" },
  { value: "Meter De-energised", label: "Meter De-energised" },
  { value: "Broker in Place", label: "Broker in Place" },
  { value: "End Date Changed", label: "End Date Changed" },
  { value: "Complaint", label: "Complaint" },
  { value: "Email Only", label: "Email Only" },
];

const statusConfig: Record<string, {
  requiresDate: boolean;
  requiresSold: boolean;
  deletesRecord: boolean;
  requiresNotes: boolean;
  requiresNewEndDate: boolean;
  requiresSupplierChange: boolean;
  requiresAddressChange: boolean;
}> = {
  "Callback":           { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Called":             { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Answered":       { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Dead":               { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Priced":             { requiresDate: false, requiresSold: true,  deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost":               { requiresDate: true,  requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost COT":           { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Already Renewed":    { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: true,  requiresAddressChange: true  },
  "Invalid Number":     { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Meter De-energised": { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Broker in Place":    { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "End Date Changed":   { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: false, requiresAddressChange: false },
  "Complaint":          { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Email Only":         { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Renewed Directly":   { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Incorrect Supplier": { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
};

// ---------------- Types ----------------
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
  mpan_top?: string;
  mpan_bottom?: string;
  supplier_id?: number;
  supplier_name?: string;
  annual_usage?: number;
  start_date?: string;
  end_date?: string;
  status?: string;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  assignment_notes?: string;
  created_at: string;
  is_allocated?: boolean;
}

interface Supplier {
  supplier_id: number;
  supplier_name: string;
}

interface Employee {
  employee_id: number;
  employee_name: string;
}

interface EmployeeStat {
  employee_id: number;
  employee_name: string;
  count: number;
}

// ---------------- Utilities ----------------
const formatDate = (d?: string) => {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return "—"; }
};

const getStatusColor = (status?: string) => {
  if (!status) return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
  const s = status.toLowerCase();
  if (s === "called" || s === "priced" || s === "callback") {
    return "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300";
  }
  if (s === "not answered") {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300";
  }
  if (s === "lost" || s === "lost cot") {
    return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";
  }
  return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300";
};

const getStatusLabel = (status?: string) => {
  if (!status) return "—";
  return (
    STATUS_OPTIONS.find(o => o.value === status)?.label ||
    STATUS_OPTIONS.find(o => o.value.toLowerCase() === status.toLowerCase())?.label ||
    status
  );
};

// ---------------- Component ----------------
export default function AllocatedContactsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const isAdmin = !!(user?.role && user.role.toLowerCase().includes("admin"));

  // Data
  const [allCustomers, setAllCustomers] = useState<EnergyCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [deleteSupplier, setDeleteSupplier] = useState<{ id: number; name: string } | null>(null);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStat[]>([]);

  // UI
  const [service, setService] = useState("utilities");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<number | "All">("All");
  const [statusFilter, setStatusFilter] = useState<string | "All">("All");
  const [salespersonFilter, setSalespersonFilter] = useState<number | "All">("All");
  const [endDateFilter, setEndDateFilter] = useState<"all" | "expired" | "365" | "30" | "60" | "90" | "90+">("all");
  const [usageSort, setUsageSort] = useState<"none" | "low-high" | "high-low">("none");
  const [allocSort,  setAllocSort]  = useState<"none" | "newest" | "oldest" | "custom">("none");
  const [allocFrom,  setAllocFrom]  = useState("");
  const [allocTo,    setAllocTo]    = useState("");
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);

  // Performance panel
  const [performanceStats, setPerformanceStats] = useState({
    renewed: 0, in_progress: 0, not_contacted: 0, lost: 0,
    success_rate: 0, renewed_directly: 0, end_date_changed: 0, priced: 0, not_due: 0,
  });
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<string | null>(null);
  const [performanceFilteredCustomers2, setPerformanceFilteredCustomers2] = useState<EnergyCustomer[]>([]);
  const [performanceModalLoading, setPerformanceModalLoading] = useState(false);
  const [performancePeriod, setPerformancePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('alltime');

  // Callback modal
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [selectedCustomerForCallback, setSelectedCustomerForCallback] = useState<number | null>(null);
  const [callbackStatus, setCallbackStatus] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackNotes, setCallbackNotes] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [isSold, setIsSold] = useState("");
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [callbackError, setCallbackError] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [calledDate, setCalledDate] = useState("");
  const [renewedBy, setRenewedBy] = useState<"customer" | "agent" | "">("");
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningCustomerId, setAssigningCustomerId] = useState<number | null>(null);
  const [assignToEmployeeId, setAssignToEmployeeId] = useState<string>("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);

  // ---------------- Effects ----------------
  useEffect(() => {
    fetchAllocatedContacts();
    fetchSuppliers();
    if (isAdmin) fetchEmployees();
  }, [service, isAdmin]);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, supplierFilter, statusFilter, salespersonFilter, endDateFilter, usageSort, allocSort, allocFrom, allocTo]);

  useEffect(() => {
    const tid = setTimeout(() => fetchPerformanceStats(performancePeriod), 600);
    return () => clearTimeout(tid);
  }, [service, performancePeriod]);

  useEffect(() => {
    const handleFocus = () => fetchPerformanceStats(performancePeriod);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [performancePeriod, service]);

  // ---------------- Fetch ----------------
  const fetchAllocatedContacts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`/energy-clients/allocated?service=${encodeURIComponent(service)}`);
      const data: EnergyCustomer[] = Array.isArray(response) ? response : (response?.data || []);
      setAllCustomers(data);

      if (isAdmin) {
        const countMap: Record<number, { name: string; count: number }> = {};
        data.forEach(c => {
          if (c.assigned_to_id && c.assigned_to_name) {
            if (!countMap[c.assigned_to_id]) {
              countMap[c.assigned_to_id] = { name: c.assigned_to_name, count: 0 };
            }
            countMap[c.assigned_to_id].count++;
          }
        });
        setEmployeeStats(
          Object.entries(countMap)
            .map(([id, v]) => ({ employee_id: Number(id), employee_name: v.name, count: v.count }))
            .sort((a, b) => a.employee_name.localeCompare(b.employee_name))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setAllCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAllocatedRenewalsCsv = () => {
    try {
      const escapeCsv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = ["ID","Client Name","Trading Name","Phone","Mobile","MPAN","Supplier","Annual Usage","Start Date","Contract End","Status","Assigned To"];
      const rows = filteredCustomers.map(c => [
        c.display_id ?? c.client_id, c.contact_person, c.business_name,
        c.phone, c.mobile_no, c.mpan_top,
        c.supplier_name, c.annual_usage,
        formatDate(c.start_date), formatDate(c.end_date), c.status, c.assigned_to_name,
      ]);
      const csv = [headers, ...rows].map(r => r.map(escapeCsv).join(",")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `allocated-renewals-${service}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch { toast.error("Failed to export CSV"); }
  };

  const fetchPerformanceStats = async (period = performancePeriod) => {
    try {
      const resp = await fetchWithAuth(
        `/energy-renewals/performance?use_current_user=true&service=${encodeURIComponent(service)}&period=${period}&allocated=true`
      );
      if (resp && !resp.error) {
        setPerformanceStats({
          renewed:          resp.renewed_count          || 0,
          in_progress:      resp.contacted_count        || 0,
          not_contacted:    resp.not_contacted_count    || 0,
          lost:             resp.lost_count             || 0,
          success_rate:     resp.success_rate           || 0,
          renewed_directly: resp.renewed_directly_count || 0,
          end_date_changed: resp.end_date_changed_count || 0,
          priced:           resp.priced_count           || 0,
          not_due:          resp.not_due                || 0,
        });
      }
    } catch {}
  };

  const handlePerformanceClick = async (type: string) => {
    setPerformanceFilter(type); setShowPerformanceModal(true);
    setPerformanceFilteredCustomers2([]); setPerformanceModalLoading(true);
    try {
      const resp = await fetchWithAuth(
        `/energy-renewals/performance?use_current_user=true&service=${encodeURIComponent(service)}&return_records=true&stage_filter=${encodeURIComponent(type)}&allocated=true`
      );
      setPerformanceFilteredCustomers2(resp?.records || []);
    } catch { toast.error("Failed to load customers"); setPerformanceFilteredCustomers2([]); }
    finally { setPerformanceModalLoading(false); }
  };

  const getPerformanceLabel = (type: string): string => ({
    renewed: "Renewed", in_progress: "In Progress", not_contacted: "Not Contacted",
    lost: "Lost", renewed_directly: "Renewed Directly", end_date_changed: "End Date Changed",
    priced: "Priced", not_due: "Not Due (365+ Days)",
  }[type] || "");

  const fetchSuppliers = async () => {
    try {
      const r = await fetchWithAuth("/suppliers");
      setSuppliers(Array.isArray(r) ? r : (r?.data || []));
    } catch { setSuppliers([]); }
  };

  const fetchEmployees = async () => {
    try {
      const r = await fetchWithAuth("/employees");
      setEmployees(Array.isArray(r) ? r : (r?.data || []));
    } catch { setEmployees([]); }
  };

  const getSupplierName = (id?: number) =>
    suppliers.find(s => s.supplier_id === id)?.supplier_name || "—";

  const updateRenewalSupplier = async (clientId: number, newSupplierId: number) => {
    const sup = suppliers.find(s => s.supplier_id === newSupplierId);
    try {
      await fetchWithAuth(`/energy-clients/${clientId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: newSupplierId }),
      });
      setAllCustomers(prev => prev.map(c =>
        c.client_id === clientId
          ? { ...c, supplier_id: newSupplierId, supplier_name: sup?.supplier_name }
          : c
      ));
      toast.success("✅ Supplier updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update supplier");
    }
  };

  // ---------------- Filters ----------------
  const filteredCustomers = useMemo(() => {
    let filtered = allCustomers.filter(c => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (c.business_name || "").toLowerCase().includes(term) ||
        (c.contact_person || "").toLowerCase().includes(term) ||
        (c.phone || "").toLowerCase().includes(term) ||
        (c.mpan_top || "").toLowerCase().includes(term) ||
        (c.mpan_bottom || "").toLowerCase().includes(term);

      const matchesSupplier = supplierFilter === "All" || c.supplier_id === supplierFilter;
      const matchesStatus = statusFilter === "All" || c.status === statusFilter;
      const matchesSalesperson = !isAdmin || salespersonFilter === "All" || c.assigned_to_id === salespersonFilter;

      let matchesEndDate = true;
      if (endDateFilter !== "all" && c.end_date) {
        const days = Math.ceil((new Date(c.end_date).getTime() - Date.now()) / 86400000);
        if (endDateFilter === "expired") matchesEndDate = days < 0;
        else if (endDateFilter === "365") matchesEndDate = days >= 0 && days <= 365;
        else if (endDateFilter === "30") matchesEndDate = days >= 0 && days <= 30;
        else if (endDateFilter === "60") matchesEndDate = days > 30 && days <= 60;
        else if (endDateFilter === "90") matchesEndDate = days > 60 && days <= 90;
        else if (endDateFilter === "90+") matchesEndDate = days > 90 && days <= 365;
      }

      let matchesAlloc = true;
      if (allocSort === "custom" && (allocFrom || allocTo)) {
        const created = c.created_at ? new Date(c.created_at) : null;
        if (!created || isNaN(created.getTime())) {
          matchesAlloc = false;
        } else {
          if (allocFrom) matchesAlloc = matchesAlloc && created >= new Date(allocFrom);
          if (allocTo) {
            const toEnd = new Date(allocTo);
            toEnd.setHours(23, 59, 59, 999);
            matchesAlloc = matchesAlloc && created <= toEnd;
          }
        }
      }

      return matchesSearch && matchesSupplier && matchesStatus && matchesSalesperson && matchesEndDate && matchesAlloc;
    });

    if (allocSort !== "none" && usageSort === "none") {
      return [...filtered].sort((a, b) => {
        const diff = new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
        if (diff !== 0) return allocSort === "oldest" ? -diff : diff;
        return allocSort === "oldest" ? (a.client_id ?? 0) - (b.client_id ?? 0) : (b.client_id ?? 0) - (a.client_id ?? 0);
      });
    }

    if (usageSort !== "none") {
      filtered = [...filtered].sort((a, b) =>
        usageSort === "low-high"
          ? (a.annual_usage || 0) - (b.annual_usage || 0)
          : (b.annual_usage || 0) - (a.annual_usage || 0)
      );
    }

    return filtered;
  }, [allCustomers, searchTerm, supplierFilter, statusFilter, salespersonFilter, endDateFilter, usageSort, allocSort, allocFrom, allocTo, isAdmin]);

  // ---------------- Pagination ----------------
  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);
  const paginatedCustomers = useMemo(() => {
    const start = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(start, start + CUSTOMERS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  // ---------------- Callback ----------------
  const isDateRequired = () => {
    if (!callbackStatus) return false;
    const config = statusConfig[callbackStatus];
    if (!config) return false;
    return config.requiresSold ? isSold === "yes" : config.requiresDate;
  };

  const openCallbackModal = (customerId: number, newStatus: string) => {
    if (newStatus === "" || newStatus === "CLEAR_STATUS") {
      fetchWithAuth(`/energy-clients/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: null }),
      })
        .then(() => {
          setAllCustomers(prev => prev.map(c => c.client_id === customerId ? { ...c, status: undefined } : c));
          toast.success("✅ Status cleared");
        })
        .catch((err: any) => toast.error(err.message || "Failed to clear status"));
      return;
    }
    setSelectedCustomerForCallback(customerId);
    setCallbackStatus(newStatus);
    setCallbackDate(""); setCallbackNotes(""); setIsSold(""); setNewEndDate("");
    setNewSupplier(""); setNewAddress(""); setCalledDate(""); setCallbackError(""); setRenewedBy("");
    setShowCallbackModal(true);
  };

  const handleSubmitCallback = async () => {
    setCallbackError("");
    if (!callbackStatus || !selectedCustomerForCallback) { setCallbackError("Please select a status"); return; }
    const config = statusConfig[callbackStatus];
    if (config?.requiresSold && !isSold) { setCallbackError("Please select if the contract was sold"); return; }
    if (config?.requiresNotes && !callbackNotes.trim()) { setCallbackError("Please enter the reason for this status"); return; }
    if (callbackStatus === "Already Renewed" && !renewedBy) { setCallbackError("Please select if renewed by customer or agent"); return; }
    if (callbackStatus === "End Date Changed" && !newEndDate) { setCallbackError("Please enter the new contract end date"); return; }

    setIsSubmittingCallback(true);
    try {
      const payload: any = { status: callbackStatus, notes: callbackNotes };
      if (calledDate) payload.called_date = calledDate;
      if (isDateRequired() && callbackDate) payload.callback_date = callbackDate;
      if (config?.requiresSold) payload.is_sold = isSold === "yes";
      if (config?.requiresNewEndDate && newEndDate) payload.new_end_date = newEndDate;
      if (callbackStatus === "Already Renewed" && renewedBy) payload.renewed_by = renewedBy;
      if (config?.requiresSupplierChange && newSupplier.trim()) payload.new_supplier = newSupplier.trim();
      if (config?.requiresAddressChange && newAddress.trim()) payload.new_address = newAddress.trim();

      const response = await fetchWithAuth(`/energy-clients/${selectedCustomerForCallback}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response || response.error) throw new Error(response?.error || "Failed to save");

      if (response.moved_to_recycle_bin || response.moved_to_priced) {
        setAllCustomers(prev => prev.filter(c => c.client_id !== selectedCustomerForCallback));
        toast.success(response.moved_to_recycle_bin ? "🗑️ Moved to recycle bin" : "✅ Moved to Priced page");
      } else if (callbackStatus === "End Date Changed" || callbackStatus === "Already Renewed") {
        await fetchAllocatedContacts();
        toast.success(callbackStatus === "Already Renewed" ? "✅ Customer information updated" : "✅ Contract end date updated");
      } else {
        setAllCustomers(prev =>
          prev.map(c => c.client_id === selectedCustomerForCallback ? { ...c, status: callbackStatus } : c)
        );
        toast.success("✅ Callback saved successfully");
      }
      setShowCallbackModal(false);
    } catch (err: any) {
      setCallbackError(err.message || "Failed to save callback");
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  const handleAssignWithNotes = async () => {
    if (!assigningCustomerId) return;
    setIsAssigning(true);
    try {
      const payload: any = {
        assigned_to_id: assignToEmployeeId === "0" ? null : parseInt(assignToEmployeeId),
      };
      if (assignmentNotes.trim()) payload.assignment_notes = assignmentNotes.trim();

      const response = await fetchWithAuth(`/energy-clients/${assigningCustomerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (response && !response.error) {
        setAllCustomers(prev =>
          prev.map(c =>
            c.client_id === assigningCustomerId
              ? {
                  ...c,
                  assigned_to_id: assignToEmployeeId === "0" ? null : parseInt(assignToEmployeeId),
                  assigned_to_name: assignToEmployeeId === "0"
                    ? null
                    : employees.find(e => e.employee_id === parseInt(assignToEmployeeId))?.employee_name || null,
                  assignment_notes: assignmentNotes.trim() || undefined,
                }
              : c
          )
        );
        fetchAllocatedContacts();
        toast.success("✅ Salesperson reassigned successfully");
        setShowAssignModal(false);
        setAssignToEmployeeId("");
        setAssignmentNotes("");
        setAssigningCustomerId(null);
      } else {
        toast.error(response?.error || "Failed to reassign");
      }
    } catch (err) {
      toast.error("Failed to reassign salesperson");
    } finally {
      setIsAssigning(false);
    }
  };

  // ---------------- Pagination Controls ----------------
  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing{" "}
          <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)}</span>{" "}
          of <span className="font-medium">{filteredCustomers.length}</span> contacts
        </div>
        <div className="flex flex-wrap items-center justify-center space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center px-3 text-sm text-gray-700 dark:text-gray-300">Page {currentPage} of {totalPages}</div>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // ---------------- Render ----------------
  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 text-slate-900 dark:bg-slate-950 dark:text-slate-100 min-h-screen">
      <Toaster position="top-right" />

      <SupplierDeleteDialog
        supplierId={deleteSupplier?.id ?? null}
        supplierName={deleteSupplier?.name ?? ""}
        allSuppliers={suppliers}
        onClose={() => setDeleteSupplier(null)}
        onDeleted={(id) => {
          setSuppliers(prev => prev.filter(s => s.supplier_id !== id));
          setAllCustomers(prev => prev.map(c => c.supplier_id === id ? { ...c, supplier_id: undefined, supplier_name: undefined } : c));
          setDeleteSupplier(null);
        }}
      />

      <h1 className="mb-2 text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">Allocated Renewals</h1>
      <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">
        {isAdmin
          ? "Records that have been reassigned from one salesperson to another."
          : "Records assigned to you by an administrator or reassigned from another salesperson."}
      </p>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-1 shadow-sm backdrop-blur w-full sm:w-auto">
          {["utilities", "water"].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setService(s)}
              className={`flex-1 sm:flex-initial px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-semibold transition-all capitalize ${
                service === s 
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── ADMIN: Employee stats grid (clickable to filter) ── */}
      {isAdmin && employeeStats.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Allocated per Salesperson</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {employeeStats.map(stat => (
              <div
                key={stat.employee_id}
                onClick={() => setSalespersonFilter(salespersonFilter === stat.employee_id ? "All" : stat.employee_id)}
                className={`bg-white dark:bg-slate-900 border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  salespersonFilter === stat.employee_id
                    ? "border-indigo-400 ring-1 ring-indigo-300 dark:ring-indigo-500 bg-indigo-50 dark:bg-indigo-950/40"
                    : "border-gray-200 dark:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{stat.employee_name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stat.count}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">contact{stat.count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
          {salespersonFilter !== "All" && (
            <button
              className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              onClick={() => setSalespersonFilter("All")}
            >
              ✕ Clear salesperson filter
            </button>
          )}
        </div>
      )}

      {/* ── SALESPERSON: summary card ── */}
      {!isAdmin && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 dark:bg-indigo-500 p-2 rounded-lg shrink-0">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Allocated to You</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{allCustomers.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error Loading Contacts</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
            <Button onClick={fetchAllocatedContacts} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {/* Renewal Performance Panel */}
      <div className="mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Renewal Performance</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{isAdmin ? "Overall renewal success metrics" : "Your renewal success metrics"}</p>
          </div>
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Period:</span>
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 p-1 shrink-0">
              {(['daily', 'weekly', 'monthly', 'alltime'] as const).map((p) => (
                <button key={p} type="button" onClick={() => setPerformancePeriod(p)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all duration-150 ${
                    performancePeriod === p
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}>
                  {p === 'alltime' ? 'All Time' : p}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { key: "renewed",          label: "Renewed",          cardBg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/60", numColor: "text-green-700 dark:text-green-300", labelColor: "text-green-600 dark:text-green-400", icon: <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto" />, val: performanceStats.renewed },
              { key: "in_progress",      label: "In Progress",      cardBg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60", numColor: "text-blue-700 dark:text-blue-300", labelColor: "text-blue-600 dark:text-blue-400", icon: <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto" />, val: performanceStats.in_progress },
              { key: "renewed_directly", label: "Renewed Directly", cardBg: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60", numColor: "text-teal-700 dark:text-teal-300", labelColor: "text-teal-600 dark:text-teal-400", icon: <CheckCircle2 className="h-6 w-6 text-teal-600 dark:text-teal-400 mx-auto" />, val: performanceStats.renewed_directly },
              { key: "end_date_changed", label: "End Date Changed", cardBg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/60", numColor: "text-purple-700 dark:text-purple-300", labelColor: "text-purple-600 dark:text-purple-400", icon: <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto" />, val: performanceStats.end_date_changed },
              { key: "priced",           label: "Priced",           cardBg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900/60", numColor: "text-yellow-700 dark:text-yellow-300", labelColor: "text-yellow-600 dark:text-yellow-400", icon: <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mx-auto" />, val: performanceStats.priced },
              { key: "not_due",          label: "Not Due",          cardBg: "bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900/60", numColor: "text-cyan-700 dark:text-cyan-300", labelColor: "text-cyan-600 dark:text-cyan-400", icon: <Calendar className="h-6 w-6 text-cyan-600 dark:text-cyan-400 mx-auto" />, val: performanceStats.not_due },
              { key: "not_contacted",    label: "Not Contacted",    cardBg: "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/60", numColor: "text-orange-700 dark:text-orange-300", labelColor: "text-orange-600 dark:text-orange-400", icon: <AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mx-auto" />, val: performanceStats.not_contacted },
              { key: "lost",             label: "Lost",             cardBg: "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60", numColor: "text-red-700 dark:text-red-300", labelColor: "text-red-600 dark:text-red-400", icon: <TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400 mx-auto" />, val: performanceStats.lost },
            ].map(({ key, label, cardBg, numColor, labelColor, icon, val }) => (
              <div key={key}
                className={`text-center p-4 sm:p-6 border rounded-lg ${cardBg} cursor-pointer hover:shadow-md transition-shadow`}
                onClick={() => handlePerformanceClick(key)}>
                <div className={`text-3xl sm:text-4xl font-bold ${numColor}`}>{val}</div>
                <div className={`text-xs sm:text-sm ${labelColor} mt-2 font-medium`}>{label}</div>
                <div className="mt-3">{icon}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 text-center border-t border-gray-200 dark:border-slate-800 pt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Success rate: <span className="font-semibold text-gray-900 dark:text-slate-100">{performanceStats.success_rate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Modal */}
      <Dialog open={showPerformanceModal} onOpenChange={setShowPerformanceModal}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-slate-100">{performanceFilter ? getPerformanceLabel(performanceFilter) : "Renewals"}</DialogTitle>
            <DialogDescription>Showing {performanceFilteredCustomers2.length} renewal{performanceFilteredCustomers2.length !== 1 ? "s" : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {performanceModalLoading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500 dark:text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading renewals...
              </div>
            ) : performanceFilteredCustomers2.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <p className="text-lg">No renewals in this category</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {performanceFilteredCustomers2.map(c => (
                  <div key={c.client_id}
                    className="p-4 sm:p-5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => { setShowPerformanceModal(false); window.open(`/dashboard/renewals/${c.client_id}`, "_blank"); }}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{c.business_name}</h3>
                          {c.status && (
                            <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(c.status)}`}>{getStatusLabel(c.status)}</Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{c.contact_person} · {c.phone}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        {c.annual_usage && <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">{c.annual_usage.toLocaleString()} kWh</p>}
                        {c.end_date && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">End: {formatDate(c.end_date)}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Supplier</p><p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{c.supplier_name || "—"}</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">MPAN</p><p className="font-semibold text-sm text-gray-900 dark:text-slate-100 font-mono truncate">{c.mpan_top || "—"}</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Annual Usage</p><p className="font-semibold text-sm text-gray-900 dark:text-slate-100">{c.annual_usage?.toLocaleString() || "—"} kWh</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Assigned To</p>
                        <p className="font-semibold text-sm text-purple-700 dark:text-purple-400 flex items-center gap-1 truncate">
                          <Users className="h-3 w-3 shrink-0" /><span className="truncate">{c.assigned_to_name || "Unassigned"}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t border-gray-200 dark:border-slate-800 shrink-0">
            <Button variant="outline" onClick={() => setShowPerformanceModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search & Filters */}
      <div className="mb-6 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input placeholder="Search contacts..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>
          <SearchableFilterCombobox
            options={[
              { value: "All", label: "All Suppliers" },
              ...suppliers.map(s => ({ value: s.supplier_id.toString(), label: s.supplier_name, deletable: true })),
            ]}
            value={supplierFilter === "All" ? "All" : String(supplierFilter)}
            onChange={v => setSupplierFilter(v === "All" ? "All" : parseInt(v))}
            onDelete={(v) => {
              const s = suppliers.find(x => x.supplier_id === Number(v));
              if (s) setDeleteSupplier({ id: s.supplier_id, name: s.supplier_name });
            }}
            showFilterIcon
          />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-0 justify-between w-full">
                <Filter className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{statusFilter === "All" ? "All Status" : statusFilter}</span>
                <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56 max-h-80 overflow-y-auto">
              <DropdownMenuItem onClick={() => setStatusFilter("All")}>All Status</DropdownMenuItem>
              {STATUS_OPTIONS.map(o => (
                <DropdownMenuItem key={o.value} onClick={() => setStatusFilter(o.value)}>{o.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Select value={endDateFilter} onValueChange={(v: any) => setEndDateFilter(v)}>
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contracts</SelectItem>
              <SelectItem value="365">Ending in 0–365 days</SelectItem>
              <SelectItem value="30">Ending in 30 days</SelectItem>
              <SelectItem value="60">Ending in 31–60 days</SelectItem>
              <SelectItem value="90">Ending in 61–90 days</SelectItem>
              <SelectItem value="90+">Ending in 90+ days</SelectItem>
              <SelectItem value="expired">Expired Contracts</SelectItem>
            </SelectContent>
          </Select>
          <Select value={usageSort} onValueChange={(v: any) => setUsageSort(v)}>
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Usage: Default</SelectItem>
              <SelectItem value="low-high">Usage: Low to High</SelectItem>
              <SelectItem value="high-low">Usage: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          <Button variant="outline" onClick={() => setShowFilterSidebar(true)} className="relative flex-none whitespace-nowrap">
            <Filter className="mr-2 h-4 w-4" />
            All Filters
            {(supplierFilter !== "All" || statusFilter !== "All" || endDateFilter !== "all" || usageSort !== "none" || allocSort !== "none" || (isAdmin && salespersonFilter !== "All")) && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-black dark:bg-white" />
            )}
          </Button>
          {isAdmin && (
            <Button onClick={downloadAllocatedRenewalsCsv} variant="outline" disabled={filteredCustomers.length === 0} className="flex-none whitespace-nowrap">
              <Download className="mr-2 h-4 w-4" />Download Renewals
            </Button>
          )}
        </div>
      </div>

      {/* Filter Sidebar */}
      <div
        className={`fixed inset-0 z-50 flex transition-opacity duration-300 ${showFilterSidebar ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}
      >
        <div className="flex-1 bg-black/30 dark:bg-black/60" onClick={() => setShowFilterSidebar(false)} />
        <div
          className={`w-80 bg-white dark:bg-slate-900 border-l border-gray-200 dark:border-slate-800 h-full shadow-2xl flex flex-col transition-transform duration-300 ease-in-out ${showFilterSidebar ? "translate-x-0" : "translate-x-full"}`}
          style={{ willChange: "transform" }}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-slate-800 shrink-0">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-slate-100">All Filters</h2>
            <button onClick={() => setShowFilterSidebar(false)} className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800">
              <X className="h-5 w-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6 min-h-0">
            {isAdmin && (
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Salesperson</label>
                <SearchableFilterCombobox
                  options={[
                    { value: "All", label: "All Salespersons" },
                    ...employees.map(e => ({ value: e.employee_id.toString(), label: e.employee_name })),
                  ]}
                  value={salespersonFilter.toString()}
                  onChange={v => setSalespersonFilter(v === "All" ? "All" : parseInt(v))}
                />
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-slate-800 pt-6">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Quick Filters</p>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Supplier</label>
              <SearchableFilterCombobox
                options={[
                  { value: "All", label: "All Suppliers" },
                  ...suppliers.map(s => ({ value: s.supplier_id.toString(), label: s.supplier_name, deletable: true })),
                ]}
                value={supplierFilter === "All" ? "All" : String(supplierFilter)}
                onChange={v => setSupplierFilter(v === "All" ? "All" : parseInt(v))}
                onDelete={(v) => {
                  const s = suppliers.find(x => x.supplier_id === Number(v));
                  if (s) setDeleteSupplier({ id: s.supplier_id, name: s.supplier_name });
                }}
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Status</label>
              <Select value={statusFilter.toString()} onValueChange={v => setStatusFilter(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="w-72 z-[60]">
                  <SelectItem value="All">All Status</SelectItem>
                  {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Contract End Date</label>
              <Select value={endDateFilter} onValueChange={(v: any) => setEndDateFilter(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="w-72 z-[60]">
                  <SelectItem value="all">All Contracts</SelectItem>
                  <SelectItem value="365">Ending in 0–365 days</SelectItem>
                  <SelectItem value="30">Ending in 30 days</SelectItem>
                  <SelectItem value="60">Ending in 31–60 days</SelectItem>
                  <SelectItem value="90">Ending in 61–90 days</SelectItem>
                  <SelectItem value="90+">Ending in 90+ days</SelectItem>
                  <SelectItem value="expired">Expired Contracts</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Annual Usage Sort</label>
              <Select value={usageSort} onValueChange={(v: any) => setUsageSort(v)}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="w-72 z-[60]">
                  <SelectItem value="none">Default</SelectItem>
                  <SelectItem value="low-high">Low to High</SelectItem>
                  <SelectItem value="high-low">High to Low</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Recently Uploaded</label>
              <Select value={allocSort} onValueChange={(v: any) => { setAllocSort(v); if (v !== "custom") { setAllocFrom(""); setAllocTo(""); } }}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="w-72 z-[60]">
                  <SelectItem value="none">Default</SelectItem>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
              {allocSort === "custom" && (
                <div className="mt-2 space-y-2">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">From</label>
                    <Input type="date" value={allocFrom} onChange={e => setAllocFrom(e.target.value)} className="w-full" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">To</label>
                    <Input type="date" value={allocTo} onChange={e => setAllocTo(e.target.value)} className="w-full" />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="px-6 py-4 border-t border-gray-200 dark:border-slate-800 shrink-0 flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => {
                setSupplierFilter("All");
                setStatusFilter("All");
                setEndDateFilter("all");
                setUsageSort("none");
                setSalespersonFilter("All");
                setAllocSort("none");
                setAllocFrom("");
                setAllocTo("");
              }}
            >
              Clear All
            </Button>
            <Button
              className="flex-1 bg-black text-white hover:bg-gray-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
              onClick={() => setShowFilterSidebar(false)}
            >
              Done
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div>
          <table className="w-full table-fixed divide-y divide-gray-200 dark:divide-slate-800 min-w-[1200px]">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[5%] border-r-2 border-gray-300 dark:border-slate-700">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%]">Client Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%]">Trading Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[6%]">Tel No</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[6%]">Mobile No</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%]">MPAN Top</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[10%]">Supplier</th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[7%] whitespace-nowrap">Annual Usage</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[7%] whitespace-nowrap">Start Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[7%] whitespace-nowrap">Contract End</th>
                <th className="px-3 py-3 text-center text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[12%]">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[13%]">Assigned To</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600 dark:text-gray-400" />
                    <p className="mt-4 text-gray-500 dark:text-gray-400">Loading allocated renewals...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600 dark:text-red-400">Failed to load contacts</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <UserCheck className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">No allocated renewals yet.</p>
                    <p className="mt-2 text-sm">
                      {isAdmin
                        ? "Records that have been reassigned will appear here."
                        : "Records assigned to you by an admin or reassigned from another salesperson will appear here."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(customer => {
                  const displayId = customer.display_order || customer.display_id || customer.id;
                  return (
                    <tr
                      key={customer.client_id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                      onClick={() => window.open(`/dashboard/renewals/${customer.client_id}?from=allocated`, "_blank")}
                    >
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 border-r-2 border-gray-300 dark:border-slate-700 align-top">
                        <div className="whitespace-nowrap">{displayId}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 align-top overflow-hidden">
                        <div className="whitespace-normal break-words leading-tight">{customer.contact_person || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-100 align-top overflow-hidden">
                        <div className="whitespace-normal break-words leading-tight">{customer.business_name || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                        <div className="truncate" title={customer.phone ? String(customer.phone).replace(/\.0$/, "") : ""}>{customer.phone ? String(customer.phone).replace(/\.0$/, "") : "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                        <div className="truncate" title={customer.mobile_no ? String(customer.mobile_no).replace(/\.0$/, "") : ""}>{customer.mobile_no ? String(customer.mobile_no).replace(/\.0$/, "") : "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                        <div className="truncate" title={customer.mpan_top || ""}>{customer.mpan_top || "—"}</div>
                      </td>

                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <SupplierCellCombobox
                          supplierId={customer.supplier_id}
                          supplierName={customer.supplier_name}
                          suppliers={suppliers}
                          onChange={(newId) => updateRenewalSupplier(customer.client_id, newId)}
                          onDelete={(id, name) => setDeleteSupplier({ id, name })}
                        />
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 text-right align-top">
                        <div className="whitespace-nowrap">{customer.annual_usage ? customer.annual_usage.toLocaleString() : "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.start_date)}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.end_date)}</div>
                      </td>

                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <Select
                          value={customer.status || ""}
                          onValueChange={value => openCallbackModal(customer.client_id, value === "CLEAR_STATUS" ? "" : value)}
                        >
                          <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue placeholder="Set status">
                              {customer.status ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(customer.status)}`}>
                                  {getStatusLabel(customer.status)}
                                </span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">Set status</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                            {customer.status && (
                              <>
                                <div className="border-t border-gray-200 dark:border-slate-800 my-1" />
                                <SelectItem value="CLEAR_STATUS" className="text-red-600 dark:text-red-400 font-medium">✕ Clear Status</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        {isAdmin ? (
                          <Select
                            value={customer.assigned_to_id?.toString() || "0"}
                            onValueChange={(value) => {
                              setAssigningCustomerId(customer.client_id);
                              setAssignToEmployeeId(value);
                              setAssignmentNotes("");
                              setShowAssignModal(true);
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-full">
                              <SelectValue placeholder="Assign">
                                {customer.assigned_to_name || "Unassigned"}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="0">Unassigned</SelectItem>
                              {employees.map(emp => (
                                <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                                  {emp.employee_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span className="text-sm text-gray-700 dark:text-gray-300">{customer.assigned_to_name || "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && !error && filteredCustomers.length > 0 && <PaginationControls />}
      </div>

      {/* Callback Modal */}
      <Dialog open={showCallbackModal} onOpenChange={setShowCallbackModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{callbackStatus ? `Add ${callbackStatus}` : "Add Action"}</DialogTitle>
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
              <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Status</label>
              <div className="p-2 bg-gray-50 dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-800">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(callbackStatus)}`}>
                  {getStatusLabel(callbackStatus)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Called Date</label>
              <Input type="date" value={calledDate} onChange={e => setCalledDate(e.target.value)} />
            </div>

            {statusConfig[callbackStatus]?.requiresSold && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Was it sold? *</label>
                <Select value={isSold} onValueChange={setIsSold}>
                  <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes - Sold</SelectItem>
                    <SelectItem value="no">No - Move to Priced page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {isDateRequired() && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Callback Date</label>
                <Input type="date" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} />
              </div>
            )}

            {statusConfig[callbackStatus]?.requiresNewEndDate && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  New Contract End Date {callbackStatus === "End Date Changed" ? "*" : ""}
                </label>
                <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {callbackStatus === "Already Renewed"
                    ? "Optional: Update if the contract end date has changed"
                    : "The contract end date will be updated to this new date"}
                </p>
              </div>
            )}

            {callbackStatus === "Already Renewed" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Renewed By <span className="text-red-500">*</span></label>
                <div className="flex flex-col gap-2 p-3 border border-gray-200 dark:border-slate-800 rounded-lg bg-gray-50 dark:bg-slate-900">
                  {(["customer", "agent"] as const).map(val => (
                    <label key={val} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="renewedBy"
                        value={val}
                        checked={renewedBy === val}
                        onChange={() => setRenewedBy(val)}
                        className="w-4 h-4 accent-black dark:accent-white"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          Renewed by {val.charAt(0).toUpperCase() + val.slice(1)}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {val === "customer" ? "Customer renewed directly without agent" : "Agent successfully renewed the contract"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {statusConfig[callbackStatus]?.requiresSupplierChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">New Supplier (Optional)</label>
                <Input type="text" placeholder="Enter new supplier name" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} />
              </div>
            )}

            {statusConfig[callbackStatus]?.requiresAddressChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">New Address (Optional)</label>
                <Textarea placeholder="Enter new address if changed" value={newAddress} onChange={e => setNewAddress(e.target.value)} rows={2} />
              </div>
            )}

            {statusConfig[callbackStatus]?.deletesRecord && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription><strong>Warning:</strong> This will move the record to the recycle bin.</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                Notes {statusConfig[callbackStatus]?.requiresNotes && <span className="text-red-500">*</span>}
              </label>
              <Textarea
                placeholder={statusConfig[callbackStatus]?.requiresNotes
                  ? "Enter required notes explaining the reason for this status..."
                  : "Add any additional notes..."}
                value={callbackNotes}
                onChange={e => setCallbackNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCallbackModal(false)} disabled={isSubmittingCallback}>
              Cancel
            </Button>
            <Button onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
              {isSubmittingCallback
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                : callbackStatus ? `Save ${callbackStatus}` : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Assign Salesperson</DialogTitle>
            <DialogDescription>
              Add an optional note about this assignment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned To</label>
              <Select value={assignToEmployeeId} onValueChange={setAssignToEmployeeId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select salesperson" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Unassigned</SelectItem>
                  {employees.map(emp => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                      {emp.employee_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Assignment Notes (Optional)
              </label>
              <Textarea
                className="mt-1"
                placeholder="Why is this being assigned? Any specific instructions..."
                value={assignmentNotes}
                onChange={e => setAssignmentNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowAssignModal(false);
                setAssignToEmployeeId("");
                setAssignmentNotes("");
                setAssigningCustomerId(null);
              }}
              disabled={isAssigning}
            >
              Cancel
            </Button>
            <Button onClick={handleAssignWithNotes} disabled={isAssigning}>
              {isAssigning ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</>
              ) : (
                "Assign"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}