"use client";

import React, { useState, useEffect } from "react";
import {
  Search, Filter, AlertCircle, ChevronRight, ChevronLeft,
  ChevronLast, ChevronFirst, UserCheck, Loader2, Phone, X, ChevronDown, Download,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar, Users,
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
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";
import { toast, Toaster } from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { SupplierCellCombobox } from "@/components/ui/SupplierCellCombobox";
import { SupplierDeleteDialog } from "@/components/ui/SupplierDeleteDialog";

// ---------------- Constants ----------------
const STATUS_OPTIONS = [
  { value: "Not Called",         label: "Not Called" },
  { value: "Callback",           label: "Callback" },
  { value: "Not Answered",       label: "Not Answered" },
  { value: "Dead",               label: "Dead" },
  { value: "Priced",             label: "Priced" },
  { value: "Sold",               label: "Sold" },
  { value: "Won",                label: "Won" },
  { value: "Converted",          label: "Converted" },
  { value: "Already Renewed",    label: "Already Renewed" },
  { value: "Renewed Directly",   label: "Renewed Directly" },
  { value: "Lost",              label: "Lost" },
  { value: "Lost COT",          label: "Lost COT" },
  { value: "Invalid Number",    label: "Invalid Number" },
  { value: "Incorrect Supplier", label: "Incorrect Supplier" },
  { value: "Meter De-energised", label: "Meter De-energised" },
  { value: "Broker in Place",    label: "Broker in Place" },
  { value: "End Date Changed",   label: "End Date Changed" },
  { value: "Complaint",          label: "Complaint" },
  { value: "Email Only",         label: "Email Only" },
  { value: "Duplicate",          label: "Duplicate" },
  { value: "No Contact",         label: "No Contact" },
];

const statusConfig: Record<string, {
  requiresDate: boolean; requiresSold: boolean; deletesRecord: boolean;
  requiresNotes: boolean; requiresNewEndDate: boolean;
  requiresSupplierChange: boolean; requiresAddressChange: boolean;
}> = {
  "No Contact":         { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Called":         { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Callback":           { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Answered":       { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Dead":               { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Priced":             { requiresDate: false, requiresSold: true,  deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Sold":               { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: true,  requiresAddressChange: true  },
  "Won":                { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Converted":          { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Already Renewed":    { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: true,  requiresAddressChange: true  },
  "Renewed Directly":   { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost":               { requiresDate: true,  requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost COT":           { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Invalid Number":     { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Incorrect Supplier": { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Meter De-energised": { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Broker in Place":    { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "End Date Changed":   { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: false, requiresAddressChange: false },
  "Complaint":          { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Email Only":         { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Duplicate":          { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
};


// ---------------- Types ----------------
interface AllocatedLead {
  opportunity_id: number;
  tenant_lead_id?: number;
  business_name: string | null;
  contact_person: string | null;
  tel_number: string | null;
  mobile_no?: string | null;
  email: string | null;
  mpan_mpr: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  annual_usage?: number | null;
  start_date: string | null;
  end_date: string | null;
  stage_id: number | null;
  stage_name: string | null;
  created_at: string | null;
  opportunity_owner_employee_id: number | null;
  assigned_to_name: string | null;
}

interface Supplier { supplier_id: number; supplier_name: string; }
interface Employee { employee_id: number; employee_name: string; }
interface Stage    { stage_id: number; stage_name: string; }
interface EmployeeStat { employee_id: number; employee_name: string; count: number; }

// ---------------- Utilities ----------------
const formatDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return "—"; }
};

const getStatusColor = (s?: string | null) => {
  if (!s) return "bg-muted text-muted-foreground";

  const l = s.toLowerCase();

  if (l === "lead" || l === "not called") {
    return "bg-muted text-muted-foreground";
  }

  if (["callback", "priced", "called", "converted", "won"].includes(l)) {
    return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
  }

  if (l === "not answered") {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
  }

  if (["lost", "lost cot"].includes(l)) {
    return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
  }

  if (l === "dead") {
    return "bg-red-200 text-red-900 dark:bg-red-900/50 dark:text-red-200";
  }

  return "bg-muted text-muted-foreground";
};

const getStatusLabel = (s?: string | null) => {
  if (!s) return "—";
  if (s.toLowerCase() === "lead") return "Not Called";
  return STATUS_OPTIONS.find(o => o.value === s)?.label ||
    STATUS_OPTIONS.find(o => o.value.toLowerCase() === s.toLowerCase())?.label || s;
};

const getStageIdFromStatus = (status: string, stages?: Stage[]): number | null => {
  if (stages?.length) {
    const m = stages.find(s => s.stage_name.toLowerCase() === status.toLowerCase());
    if (m) return m.stage_id;
  }
  return null;
};

// ---------------- Component ----------------
const PAGE_SIZE = 100;

export default function AllocatedLeadsPage() {
  const { user } = useAuth();
  const normalizedRole = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
  const isAdmin = normalizedRole.includes("admin");

  // Data
  const [leads, setLeads]                 = useState<AllocatedLead[]>([]);
  const [total, setTotal]                 = useState(0);
  const [suppliers, setSuppliers]         = useState<Supplier[]>([]);
  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [stages, setStages]               = useState<Stage[]>([]);
  const [employeeStats, setEmployeeStats] = useState<EmployeeStat[]>([]);
  const [deleteSupplier, setDeleteSupplier] = useState<{ id: number; name: string } | null>(null);

  // UI
  const [service, setService]     = useState("utilities");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError]         = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  // Filters — all sent to server
  const [searchTerm, setSearchTerm]               = useState("");
  const [supplierFilter, setSupplierFilter]       = useState<number | "All">("All");
  const [statusFilter, setStatusFilter]           = useState<string | "All">("All");
  const [salespersonFilter, setSalespersonFilter] = useState<number | "All">("All");
  const [endDateFilter, setEndDateFilter]         = useState<"all" | "expired" | "30" | "60" | "90" | "90+">("all");
  const [usageSort, setUsageSort]                 = useState<"none" | "low-high" | "high-low">("none");
  const [allocSort, setAllocSort]                 = useState<"none" | "newest" | "oldest" | "custom">("none");
  const [allocFrom, setAllocFrom]                 = useState("");
  const [allocTo,   setAllocTo]                   = useState("");
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);

  // Performance panel
  const [performanceStats, setPerformanceStats] = useState({
    converted: 0, renewed: 0, in_progress: 0, not_contacted: 0, lost: 0,
    success_rate: 0, renewed_directly: 0, end_date_changed: 0, priced: 0,
  });
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<string | null>(null);
  const [performanceFilteredLeads, setPerformanceFilteredLeads] = useState<AllocatedLead[]>([]);
  const [performanceModalLoading, setPerformanceModalLoading] = useState(false);
  const [performancePeriod, setPerformancePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('alltime');

  // Callback modal
  const [showCallbackModal, setShowCallbackModal]             = useState(false);
  const [selectedLeadForCallback, setSelectedLeadForCallback] = useState<number | null>(null);
  const [callbackStatus, setCallbackStatus]                   = useState("");
  const [callbackDate, setCallbackDate]                       = useState("");
  const [callbackNotes, setCallbackNotes]                     = useState("");
  const [newEndDate, setNewEndDate]                           = useState("");
  const [isSold, setIsSold]                                   = useState("");
  const [isSubmittingCallback, setIsSubmittingCallback]       = useState(false);
  const [callbackError, setCallbackError]                     = useState("");
  const [newSupplier, setNewSupplier]                         = useState("");
  const [newAddress, setNewAddress]                           = useState("");
  const [calledDate, setCalledDate]                           = useState(() => new Date().toISOString().split("T")[0]);
  const [renewedBy, setRenewedBy]                             = useState<"customer" | "supplier" | "agent" | "">("");

  // Assign modal
  const [showAssignModal, setShowAssignModal]       = useState(false);
  const [assigningLeadId, setAssigningLeadId]       = useState<number | null>(null);
  const [assignToEmployeeId, setAssignToEmployeeId] = useState("");
  const [assignmentNotes, setAssignmentNotes]       = useState("");
  const [isAssigning, setIsAssigning]               = useState(false);

  // ---------------- Effects ----------------
  // Debounced search — avoid firing on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Reset to page 1 when any filter changes
  useEffect(() => { setCurrentPage(1); }, [
    service, debouncedSearch, supplierFilter, statusFilter,
    salespersonFilter, endDateFilter, usageSort, allocSort, allocFrom, allocTo,
  ]);

  // Fetch whenever page or filters change
  useEffect(() => {
    fetchAllocatedLeads(currentPage);
  }, [currentPage, service, debouncedSearch, supplierFilter, statusFilter,
      salespersonFilter, endDateFilter, usageSort, allocSort, allocFrom, allocTo, isAdmin]);

  useEffect(() => {
    fetchSuppliers();
    fetchStages();
    if (isAdmin) fetchEmployees();
  }, [isAdmin]);

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
  const fetchAllocatedLeads = async (page = 1) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        service,
        exclude_stage: "Lost",
        page: String(page),
        page_size: String(PAGE_SIZE),
      });
      if (debouncedSearch)                          params.set("search",         debouncedSearch);
      if (supplierFilter !== "All")                 params.set("supplier_id",    String(supplierFilter));
      if (statusFilter !== "All")                   params.set("status",         statusFilter);
      if (isAdmin && salespersonFilter !== "All")   params.set("salesperson_id", String(salespersonFilter));
      if (endDateFilter !== "all")                  params.set("end_date_filter", endDateFilter);
      if (allocSort === "oldest")                   params.set("upload_sort",    "asc");
      else if (allocSort === "newest")              params.set("upload_sort",    "desc");
      if (allocSort === "custom" && allocFrom)      params.set("upload_from",    allocFrom);
      if (allocSort === "custom" && allocTo)        params.set("upload_to",      allocTo);
      if (usageSort !== "none")                     params.set("usage_sort",     usageSort);

      const resp = await fetchWithAuth(`/api/crm/leads/allocated?${params.toString()}`);
      const data: AllocatedLead[] = resp?.data ?? (Array.isArray(resp) ? resp : []);
      setLeads(data);
      setTotal(resp?.total ?? data.length);
      if (isAdmin && resp?.team_stats) setEmployeeStats(resp.team_stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLeads([]);
      setTotal(0);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAllocatedLeadsCsv = async () => {
    try {
      const params = new URLSearchParams({ service, exclude_stage: "Lost", page: "1", page_size: "5000" });
      if (debouncedSearch)                          params.set("search",         debouncedSearch);
      if (supplierFilter !== "All")                 params.set("supplier_id",    String(supplierFilter));
      if (statusFilter !== "All")                   params.set("status",         statusFilter);
      if (isAdmin && salespersonFilter !== "All")   params.set("salesperson_id", String(salespersonFilter));
      if (endDateFilter !== "all")                  params.set("end_date_filter", endDateFilter);
      if (allocSort === "oldest")                   params.set("upload_sort",    "asc");
      else if (allocSort === "newest")              params.set("upload_sort",    "desc");
      if (allocSort === "custom" && allocFrom)      params.set("upload_from",    allocFrom);
      if (allocSort === "custom" && allocTo)        params.set("upload_to",      allocTo);
      if (usageSort !== "none")                     params.set("usage_sort",     usageSort);
      const resp = await fetchWithAuth(`/api/crm/leads/allocated?${params.toString()}`);
      const allData: AllocatedLead[] = resp?.data ?? (Array.isArray(resp) ? resp : []);
      const escapeCsv = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
      const headers = ["ID","Client Name","Trading Name","Phone","Mobile","MPAN","Supplier","Annual Usage","Start Date","Contract End","Status","Assigned To"];
      const rows = allData.map(l => [
        l.tenant_lead_id ?? l.opportunity_id, l.contact_person, l.business_name,
        l.tel_number, l.mobile_no, l.mpan_mpr,
        l.supplier_name, l.annual_usage,
        formatDate(l.start_date), formatDate(l.end_date), l.stage_name, l.assigned_to_name,
      ]);
      const csv = [headers, ...rows].map(r => r.map(escapeCsv).join(",")).join("\r\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url; link.download = `allocated-leads-${service}-${new Date().toISOString().slice(0,10)}.csv`;
      document.body.appendChild(link); link.click();
      document.body.removeChild(link); URL.revokeObjectURL(url);
    } catch { toast.error("Failed to export CSV"); }
  };

  const fetchPerformanceStats = async (period = performancePeriod) => {
    try {
      const resp = await fetchWithAuth(
        `/api/crm/leads/performance?service=${encodeURIComponent(service)}&period=${period}&allocated=true`
      );
      if (resp && !resp.error) {
        setPerformanceStats({
          converted:        resp.converted_count        || 0,
          renewed:          resp.renewed_count          || 0,
          in_progress:      resp.contacted_count        || 0,
          not_contacted:    resp.not_contacted_count    || 0,
          lost:             resp.lost_count             || 0,
          success_rate:     resp.success_rate           || 0,
          renewed_directly: resp.renewed_directly_count || 0,
          end_date_changed: resp.end_date_changed_count || 0,
          priced:           resp.priced_count           || 0,
        });
      }
    } catch {}
  };

  const handlePerformanceClick = async (type: string) => {
    setPerformanceFilter(type); setShowPerformanceModal(true);
    setPerformanceFilteredLeads([]); setPerformanceModalLoading(true);
    try {
      const resp = await fetchWithAuth(
        `/api/crm/leads/performance?service=${encodeURIComponent(service)}&return_records=true&stage_filter=${encodeURIComponent(type)}&allocated=true`
      );
      setPerformanceFilteredLeads(resp?.records || []);
    } catch { toast.error("Failed to load leads"); setPerformanceFilteredLeads([]); }
    finally { setPerformanceModalLoading(false); }
  };

  const getPerformanceLabel = (type: string) => ({
    converted: "Converted", renewed: "Renewed", in_progress: "In Progress",
    not_contacted: "Not Contacted", lost: "Lost", renewed_directly: "Renewed Directly",
    end_date_changed: "End Date Changed", priced: "Priced",
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
      const list = Array.isArray(r?.data) ? r.data : (Array.isArray(r) ? r : []);
      setEmployees(list);
    } catch { setEmployees([]); }
  };

  const fetchStages = async () => {
    try {
      const r = await fetchWithAuth("/stages");
      setStages(Array.isArray(r) ? r : (r?.data || []));
    } catch { setStages([]); }
  };

  const getSupplierName = (id?: number | null) =>
    suppliers.find(s => s.supplier_id === id)?.supplier_name || "—";

  const updateLeadSupplier = async (leadId: number, newSupplierId: number) => {
    const sup = suppliers.find(s => s.supplier_id === newSupplierId);
    try {
      await fetchWithAuth(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplier_id: newSupplierId }),
      });
      setLeads(prev => prev.map(l =>
        l.opportunity_id === leadId
          ? { ...l, supplier_id: newSupplierId, supplier_name: sup?.supplier_name || null }
          : l
      ));
      toast.success("✅ Supplier updated");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update supplier");
    }
  };

  // ---------------- Pagination ----------------
  const totalPages = Math.ceil(total / PAGE_SIZE);

  // ---------------- Callback ----------------
  const isDateRequired = () => {
    if (!callbackStatus) return false;
    const cfg = statusConfig[callbackStatus];
    if (!cfg) return false;
    return cfg.requiresSold ? isSold === "yes" : cfg.requiresDate;
  };

  const openCallbackModal = (leadId: number, newStatus: string) => {
    if (!newStatus || newStatus === "CLEAR_STATUS") {
      fetchWithAuth(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: 1 }),
      })
        .then(() => {
          setLeads(prev => prev.map(l =>
            l.opportunity_id === leadId ? { ...l, stage_name: null, stage_id: 1 } : l
          ));
          toast.success("✅ Status cleared");
        })
        .catch((err: any) => toast.error(err.message || "Failed to clear status"));
      return;
    }
    setSelectedLeadForCallback(leadId);
    setCallbackStatus(newStatus);
    setCallbackDate(""); setCallbackNotes(""); setIsSold(""); setNewEndDate("");
    setNewSupplier(""); setNewAddress(""); setCallbackError(""); setRenewedBy("");
    setCalledDate(new Date().toISOString().split("T")[0]);
    setShowCallbackModal(true);
  };

  const handleSubmitCallback = async () => {
    setCallbackError("");
    if (!callbackStatus || !selectedLeadForCallback) { setCallbackError("Please select a status"); return; }
    const cfg = statusConfig[callbackStatus];
    if (cfg?.requiresSold && !isSold) { setCallbackError("Please select if the contract was sold"); return; }
    if (cfg?.requiresNotes && !callbackNotes.trim()) { setCallbackError("Please enter the reason for this status"); return; }
    const isRenewalOrSoldAction = callbackStatus === "Already Renewed" || callbackStatus === "Sold";
    if (isRenewalOrSoldAction && !renewedBy) {
      setCallbackError(callbackStatus === "Sold" ? "Please select if sold by supplier or agent" : "Please select if renewed by customer or agent");
      return;
    }
    if (callbackStatus === "End Date Changed" && !newEndDate) { setCallbackError("Please enter the new contract end date"); return; }

    setIsSubmittingCallback(true);
    try {
      const stageId = getStageIdFromStatus(callbackStatus, stages.length ? stages : undefined);
      const payload: any = { status: callbackStatus, notes: callbackNotes };
      if (stageId) payload.stage_id = stageId;
      if (calledDate) payload.called_date = calledDate;
      if (isDateRequired() && callbackDate) payload.callback_date = callbackDate;
      if (cfg?.requiresSold) payload.is_sold = isSold === "yes";
      if (cfg?.requiresNewEndDate && newEndDate) payload.new_end_date = newEndDate;
      if (callbackStatus === "Already Renewed" && renewedBy) payload.renewed_by = renewedBy;
      if (cfg?.requiresSupplierChange && newSupplier.trim()) payload.new_supplier = newSupplier.trim();
      if (cfg?.requiresAddressChange && newAddress.trim()) payload.new_address = newAddress.trim();

      const response = await fetchWithAuth(`/api/crm/leads/${selectedLeadForCallback}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response || response.error) throw new Error(response?.error || "Failed to save");

      if (response.moved_to_recycle_bin || response.moved_to_priced) {
        setLeads(prev => prev.filter(l => l.opportunity_id !== selectedLeadForCallback));
        setTotal(t => Math.max(0, t - 1));
        toast.success(response.moved_to_recycle_bin ? "🗑️ Moved to recycle bin" : "✅ Moved to Priced page");
      } else if (callbackStatus === "End Date Changed" || callbackStatus === "Already Renewed") {
        await fetchAllocatedLeads(currentPage);
        toast.success(callbackStatus === "Already Renewed" ? "✅ Lead information updated" : "✅ Contract end date updated");
      } else {
        setLeads(prev =>
          prev.map(l => l.opportunity_id === selectedLeadForCallback ? { ...l, stage_name: callbackStatus } : l)
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

  // ---------------- Assign ----------------
  const handleAssignWithNotes = async () => {
    if (!assigningLeadId) return;
    setIsAssigning(true);
    try {
      const empId = assignToEmployeeId === "0" ? null : parseInt(assignToEmployeeId);
      const payload: any = { lead_ids: [assigningLeadId], employee_id: empId };
      if (assignmentNotes.trim()) payload.assignment_notes = assignmentNotes.trim();

      await fetchWithAuth("/api/crm/leads/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await fetchAllocatedLeads(currentPage);
      toast.success("✅ Salesperson reassigned successfully");
      setShowAssignModal(false);
      setAssignToEmployeeId(""); setAssignmentNotes(""); setAssigningLeadId(null);
    } catch { toast.error("Failed to reassign salesperson"); }
    finally { setIsAssigning(false); }
  };

  // ---------------- Pagination Controls ----------------
  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    const from = (currentPage - 1) * PAGE_SIZE + 1;
    const to   = Math.min(currentPage * PAGE_SIZE, total);
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 bg-muted/50 border-t border-border">
        <div className="text-sm text-muted-foreground">
          Showing <span className="font-medium">{from}</span> to{" "}
          <span className="font-medium">{to}</span>{" "}
          of <span className="font-medium">{total}</span> leads
        </div>
        <div className="flex flex-wrap items-center justify-center space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronFirst className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex items-center px-3 text-sm text-muted-foreground">Page {currentPage} of {totalPages}</div>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronLast className="h-4 w-4" /></Button>
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
          setLeads(prev => prev.map(l => l.supplier_id === id ? { ...l, supplier_id: undefined, supplier_name: null } : l));
          setDeleteSupplier(null);
        }}
      />

      <h1 className="mb-2 text-2xl sm:text-4xl font-semibold tracking-tight text-foreground">Allocated Leads</h1>
      <p className="mb-6 text-sm text-muted-foreground">
        {isAdmin
          ? "Leads that have been assigned to salespersons across the team."
          : "Leads assigned to you by an administrator."}
      </p>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 p-1 shadow-sm backdrop-blur w-full sm:w-auto">
          {["utilities", "water"].map(s => (
            <button key={s} type="button" onClick={() => setService(s)}
              className={`flex-1 sm:flex-initial px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-semibold transition-all capitalize ${
                service === s
                  ? "bg-primary text-primary-foreground shadow"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Admin: Employee stats grid */}
      {isAdmin && employeeStats.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-foreground mb-3">Allocated per Salesperson</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {employeeStats.map(stat => (
              <div key={stat.employee_id}
                onClick={() => setSalespersonFilter(salespersonFilter === stat.employee_id ? "All" : stat.employee_id)}
                className={`bg-card border border-border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  salespersonFilter === stat.employee_id
                    ? "border-indigo-400 ring-1 ring-indigo-300 bg-indigo-50 dark:bg-indigo-950/40"
                    : "border-border"
                }`}>
                <div className="flex items-center gap-2 mb-2">
                  <Phone className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                  <span className="text-xs font-medium text-muted-foreground truncate">{stat.employee_name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">{stat.count}</span>
                  <span className="text-xs text-muted-foreground">lead{stat.count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
          {salespersonFilter !== "All" && (
            <button className="mt-2 text-xs text-indigo-600 dark:text-indigo-400 hover:underline" onClick={() => setSalespersonFilter("All")}>
              ✕ Clear salesperson filter
            </button>
          )}
        </div>
      )}

      {/* Salesperson: summary card */}
      {!isAdmin && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 dark:from-indigo-950/40 dark:to-blue-950/40 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg shrink-0"><UserCheck className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-sm text-muted-foreground">Allocated to You</p>
                <p className="text-2xl font-bold text-foreground">{total}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error Loading Leads</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-300">{error}</p>
            <Button onClick={() => fetchAllocatedLeads(1)} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {/* Lead Performance Panel */}
      <div className="mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Lead Performance</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{isAdmin ? "Overall lead success metrics" : "Your lead success metrics"}</p>
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
              { key: "converted",        label: "Converted",        cardBg: "bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/60", numColor: "text-emerald-700 dark:text-emerald-300", labelColor: "text-emerald-600 dark:text-emerald-400", icon: <CheckCircle2 className="h-6 w-6 text-emerald-600 dark:text-emerald-400 mx-auto" />, val: performanceStats.converted },
              { key: "renewed",          label: "Renewed",          cardBg: "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/60", numColor: "text-green-700 dark:text-green-300", labelColor: "text-green-600 dark:text-green-400", icon: <CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto" />, val: performanceStats.renewed },
              { key: "in_progress",      label: "In Progress",      cardBg: "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60", numColor: "text-blue-700 dark:text-blue-300", labelColor: "text-blue-600 dark:text-blue-400", icon: <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto" />, val: performanceStats.in_progress },
              { key: "renewed_directly", label: "Renewed Directly", cardBg: "bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60", numColor: "text-teal-700 dark:text-teal-300", labelColor: "text-teal-600 dark:text-teal-400", icon: <CheckCircle2 className="h-6 w-6 text-teal-600 dark:text-teal-400 mx-auto" />, val: performanceStats.renewed_directly },
              { key: "end_date_changed", label: "End Date Changed", cardBg: "bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/60", numColor: "text-purple-700 dark:text-purple-300", labelColor: "text-purple-600 dark:text-purple-400", icon: <Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto" />, val: performanceStats.end_date_changed },
              { key: "priced",           label: "Priced",           cardBg: "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900/60", numColor: "text-yellow-700 dark:text-yellow-300", labelColor: "text-yellow-600 dark:text-yellow-400", icon: <TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mx-auto" />, val: performanceStats.priced },
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
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-slate-100">{performanceFilter ? getPerformanceLabel(performanceFilter) : "Leads"}</DialogTitle>
            <DialogDescription>Showing {performanceFilteredLeads.length} lead{performanceFilteredLeads.length !== 1 ? "s" : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {performanceModalLoading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500 dark:text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading leads...
              </div>
            ) : performanceFilteredLeads.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <p className="text-lg">No leads in this category</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {performanceFilteredLeads.map(l => (
                  <div key={l.opportunity_id}
                    className="p-4 sm:p-5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => { setShowPerformanceModal(false); window.open(`/dashboard/leads/${l.opportunity_id}`, "_blank"); }}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{l.business_name}</h3>
                          {l.stage_name && (
                            <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(l.stage_name)}`}>{getStatusLabel(l.stage_name)}</Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{l.contact_person} · {l.tel_number}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        {l.annual_usage && <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">{l.annual_usage.toLocaleString()} kWh</p>}
                        {l.end_date && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">End: {formatDate(l.end_date)}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Supplier</p><p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{l.supplier_name || "—"}</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">MPAN</p><p className="font-semibold text-sm text-gray-900 dark:text-slate-100 font-mono truncate">{l.mpan_mpr || "—"}</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Annual Usage</p><p className="font-semibold text-sm text-gray-900 dark:text-slate-100">{l.annual_usage?.toLocaleString() || "—"} kWh</p></div>
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Assigned To</p>
                        <p className="font-semibold text-sm text-purple-700 dark:text-purple-400 flex items-center gap-1 truncate">
                          <Users className="h-3 w-3 shrink-0" /><span className="truncate">{l.assigned_to_name || "Unassigned"}</span>
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
            <Input placeholder="Search leads..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
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
            <Button onClick={downloadAllocatedLeadsCsv} variant="outline" disabled={leads.length === 0} className="flex-none whitespace-nowrap">
              <Download className="mr-2 h-4 w-4" />Download Leads
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
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%]">MPAN</th>
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
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-muted-foreground" />
                    <p className="mt-4 text-muted-foreground">Loading allocated leads...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600 dark:text-red-400">Failed to load leads</p>
                  </td>
                </tr>
              ) : leads.length === 0 ? (
                <tr>
                 <td colSpan={12} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <UserCheck className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />

                  <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">
                    No allocated leads yet.
                  </p>

                  <p className="mt-2 text-sm">
                    {isAdmin
                      ? "Assigned leads will appear here."
                      : "Leads assigned to you will appear here."}
                  </p>
                </td>
                </tr>
              ) : (
                leads.map(lead => {
                  const displayId = lead.tenant_lead_id || lead.opportunity_id;
                  return (
                    <tr
                      key={lead.opportunity_id}
                      className="hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer"
                      onClick={() => window.open(`/dashboard/leads/${lead.opportunity_id}`, "_blank")}
                    >
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 border-r-2 border-gray-300 dark:border-slate-700 align-top">
                        <div className="whitespace-nowrap">{displayId}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 align-top overflow-hidden">
                        <div className="whitespace-normal break-words leading-tight">{lead.contact_person || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-100 align-top overflow-hidden">
                        <div className="whitespace-normal break-words leading-tight">{lead.business_name || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                        <div className="truncate max-w-[100px]" title={lead.tel_number ? String(lead.tel_number).replace(/\.0$/, "") : ""}>
                          {lead.tel_number ? String(lead.tel_number).replace(/\.0$/, "") : "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                        <div className="truncate max-w-[100px]" title={lead.mobile_no ? String(lead.mobile_no).replace(/\.0$/, "") : ""}>
                          {lead.mobile_no ? String(lead.mobile_no).replace(/\.0$/, "") : "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                        <div className="truncate" title={lead.mpan_mpr || ""}>{lead.mpan_mpr || "—"}</div>
                      </td>

                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <SupplierCellCombobox
                          supplierId={lead.supplier_id}
                          supplierName={lead.supplier_name}
                          suppliers={suppliers}
                          onChange={(newId) => updateLeadSupplier(lead.opportunity_id, newId)}
                          onDelete={(id, name) => setDeleteSupplier({ id, name })}
                        />
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 text-right align-top">
                        <div className="whitespace-nowrap">
                          {lead.annual_usage ? lead.annual_usage.toLocaleString() : "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                        <div className="whitespace-nowrap">{formatDate(lead.start_date)}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                        <div className="whitespace-nowrap">{formatDate(lead.end_date)}</div>
                      </td>

                      {/* Status dropdown */}
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <Select
                          value={lead.stage_name || ""}
                          onValueChange={v => openCallbackModal(lead.opportunity_id, v === "CLEAR_STATUS" ? "" : v)}
                        >
                          <SelectTrigger className="h-7 text-xs w-full">
                            <SelectValue placeholder="Set status">
                              {lead.stage_name ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(lead.stage_name)}`}>
                                  {getStatusLabel(lead.stage_name)}
                                </span>
                              ) : (
                                <span className="text-muted-foreground text-xs">Set status</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                            {lead.stage_name && (
                              <>
                                <div className="border-t my-1" />
                                <SelectItem value="CLEAR_STATUS" className="text-red-600 font-medium">✕ Clear Status</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Assigned To */}
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        {isAdmin ? (
                          <Select
                            value={lead.opportunity_owner_employee_id?.toString() || "0"}
                            onValueChange={v => {
                              setAssigningLeadId(lead.opportunity_id);
                              setAssignToEmployeeId(v);
                              setAssignmentNotes("");
                              setShowAssignModal(true);
                            }}
                          >
                            <SelectTrigger className="h-7 text-xs w-full">
                              <SelectValue placeholder="Assign">
                                {lead.assigned_to_name || "Unassigned"}
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
                          <span className="text-sm text-foreground">{lead.assigned_to_name || "—"}</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && !error && total > PAGE_SIZE && <PaginationControls />}
      </div>

      {/* ── Callback Modal ── */}
      <Dialog open={showCallbackModal} onOpenChange={setShowCallbackModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{callbackStatus ? `Add ${callbackStatus}` : "Add Action"}</DialogTitle>
            <DialogDescription>Record lead interaction and set follow-up</DialogDescription>
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
              <div className="p-2 bg-muted/50 rounded border border-border">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(callbackStatus)}`}>
                  {getStatusLabel(callbackStatus)}
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Called Date</label>
              <Input type="date" value={calledDate} onChange={e => setCalledDate(e.target.value)} />
            </div>

            {statusConfig[callbackStatus]?.requiresSold && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Was it sold? *</label>
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
                <label className="text-sm font-medium">Callback Date</label>
                <Input type="date" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} />
              </div>
            )}

            {statusConfig[callbackStatus]?.requiresNewEndDate && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  New Contract End Date {callbackStatus === "End Date Changed" ? "*" : ""}
                </label>
                <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
                <p className="text-xs text-muted-foreground">
                  {callbackStatus === "Already Renewed"
                    ? "Optional: Update if the contract end date has changed"
                    : "The contract end date will be updated to this new date"}
                </p>
              </div>
            )}

            {(callbackStatus === "Already Renewed" || callbackStatus === "Sold") && (
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  {callbackStatus === "Sold" ? "Sold By" : "Renewed By"} <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-2 p-3 border border-border rounded-lg bg-muted/50">
                  {(callbackStatus === "Sold" ? (["supplier", "agent"] as const) : (["customer", "agent"] as const)).map(val => (
                    <label key={val} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="renewedBy" value={val} checked={renewedBy === val}
                        onChange={() => setRenewedBy(val as any)} className="w-4 h-4 accent-primary" />
                      <div>
                        <span className="text-sm font-medium text-foreground">
                          {callbackStatus === "Sold" ? `Sold by ${val.charAt(0).toUpperCase() + val.slice(1)}` : `Renewed by ${val.charAt(0).toUpperCase() + val.slice(1)}`}
                        </span>
                        <p className="text-xs text-muted-foreground">
                          {val === "agent" ? "Counts for agent commission" : callbackStatus === "Sold" ? "Sold directly by supplier" : "Customer renewed directly without agent"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {statusConfig[callbackStatus]?.requiresSupplierChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Supplier (Optional)</label>
                <Input type="text" placeholder="Enter new supplier name" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} />
              </div>
            )}

            {statusConfig[callbackStatus]?.requiresAddressChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Address (Optional)</label>
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
              <label className="text-sm font-medium">
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
            <Button variant="outline" onClick={() => setShowCallbackModal(false)} disabled={isSubmittingCallback}>Cancel</Button>
            <Button onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
              {isSubmittingCallback
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                : callbackStatus ? `Save ${callbackStatus}` : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Assign Modal ── */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Assign Salesperson</DialogTitle>
            <DialogDescription>Add an optional note about this assignment</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-foreground">Assigned To</label>
              <Select value={assignToEmployeeId} onValueChange={setAssignToEmployeeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select salesperson" /></SelectTrigger>
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
              <label className="text-sm font-medium text-foreground">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why is this being assigned?" value={assignmentNotes}
                onChange={e => setAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>

          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
            <Button variant="outline"
              onClick={() => { setShowAssignModal(false); setAssignToEmployeeId(""); setAssignmentNotes(""); setAssigningLeadId(null); }}
              disabled={isAssigning}>
              Cancel
            </Button>
            <Button onClick={handleAssignWithNotes} disabled={isAssigning}>
              {isAssigning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</> : "Assign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}