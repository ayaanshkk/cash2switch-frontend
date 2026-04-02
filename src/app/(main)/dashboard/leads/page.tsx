"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Trash2, ChevronDown, Filter, AlertCircle,
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst,
  Upload, Users, UserCheck, Info, Loader2,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  LeadsTeamPerformanceStrip,
  loadTeamStatsWithFallback,
  type LeadsTeamStatRow,
} from "@/app/(main)/dashboard/default/_components/leads-team-performance-strip";

// ─── Constants ────────────────────────────────────────────────────────────────
const CUSTOMERS_PER_PAGE = 25;

// ✅ Use the same base URL pattern as renewals import
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const STATUS_OPTIONS = [
  { value: "Callback",           label: "Callback" },
  { value: "Not Answered",       label: "Not Answered" },
  { value: "Priced",             label: "Priced" },
  { value: "Converted",          label: "Converted" },
  { value: "Already Renewed",    label: "Already Renewed" },
  { value: "Renewed Directly",   label: "Renewed Directly" },
  { value: "Lost",               label: "Lost" },
  { value: "Lost COT",           label: "Lost COT" },
  { value: "Invalid Number",     label: "Invalid Number" },
  { value: "Incorrect Supplier", label: "Incorrect Supplier" },
  { value: "Meter De-energised", label: "Meter De-energised" },
  { value: "Broker in Place",    label: "Broker in Place" },
  { value: "End Date Changed",   label: "End Date Changed" },
  { value: "Complaint",          label: "Complaint" },
  { value: "Email Only",         label: "Email Only" },
];

const statusConfig: Record<string, {
  requiresDate: boolean; requiresSold: boolean; deletesRecord: boolean;
  requiresNotes: boolean; requiresNewEndDate: boolean;
  requiresSupplierChange: boolean; requiresAddressChange: boolean;
}> = {
  "Callback":          { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Answered":      { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Priced":            { requiresDate: false, requiresSold: true,  deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost":              { requiresDate: true,  requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost COT":          { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Already Renewed":   { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: true,  requiresAddressChange: true  },
  "Invalid Number":    { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Meter De-energised":{ requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Broker in Place":   { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "End Date Changed":  { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: false, requiresAddressChange: false },
  "Complaint":         { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Email Only":        { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Renewed Directly":  { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Incorrect Supplier":{ requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Converted":         { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
};

const STATUS_TO_STAGE_FALLBACK: Record<string, number> = {
  "callback": 1, "not answered": 3, "priced": 4, "lost": 5, "lost cot": 6,
  "already renewed": 7, "invalid number": 8, "meter de-energised": 9,
  "broker in place": 10, "end date changed": 11, "complaint": 12,
  "email only": 13, "renewed directly": 14, "incorrect supplier": 15, "converted": 16,
};

// ─── Types ────────────────────────────────────────────────────────────────────
interface LeadCustomer {
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
  is_allocated?: boolean;
  display_id?: number;
  display_order?: number;
}

interface Supplier { supplier_id: number; supplier_name: string; }
interface Employee { employee_id: number; employee_name: string; email?: string; }
interface Stage { stage_id: number; stage_name: string; stage_description?: string; }

// ─── Utilities ────────────────────────────────────────────────────────────────
const formatDate = (d: string | null | undefined) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return "—"; }
};

const formatUsage = (u: number | null | undefined) => u ? `${u.toLocaleString()} kWh` : "—";

const getStatusColor = (s: string | undefined) => {
  if (!s) return "bg-gray-100 text-gray-800";
  const l = s.toLowerCase();
  if (["callback", "priced", "called", "converted"].includes(l)) return "bg-green-100 text-green-800";
  if (l === "not answered") return "bg-yellow-100 text-yellow-800";
  if (["lost", "lost cot"].includes(l)) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
};

const getStatusLabel = (s: string | undefined) => {
  if (!s) return "—";
  return STATUS_OPTIONS.find(o => o.value === s)?.label ||
    STATUS_OPTIONS.find(o => o.value.toLowerCase() === s.toLowerCase())?.label || s;
};

const getStageIdFromStatus = (status: string, stagesList?: Stage[]): number => {
  if (stagesList?.length) {
    const m = stagesList.find(s => s.stage_name.toLowerCase() === status.toLowerCase());
    if (m) return m.stage_id;
  }
  const id = STATUS_TO_STAGE_FALLBACK[status.toLowerCase()];
  if (!id) { console.warn(`⚠️ No stage_id for status: ${status}`); return 0; }
  return id;
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function LeadsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";

  // ── Data ───────────────────────────────────────────────────────────────────
  const [allLeads, setAllLeads]           = useState<LeadCustomer[]>([]);
  const [suppliers, setSuppliers]         = useState<Supplier[]>([]);
  const [employees, setEmployees]         = useState<Employee[]>([]);
  const [stages, setStages]               = useState<Stage[]>([]);
  const [searchResults, setSearchResults] = useState<LeadCustomer[]>([]);
  const [teamStripStats, setTeamStripStats] = useState<LeadsTeamStatRow[]>([]);

  // ── Loading / error ────────────────────────────────────────────────────────
  const [isLoading, setIsLoading]     = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // ── Filters / pagination ───────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [service, setService]         = useState("utilities");
  const [searchTerm, setSearchTerm]         = useState("");
  const [supplierFilter, setSupplierFilter] = useState<number | "All">("All");
  const [statusFilter, setStatusFilter]     = useState<string | "All">("All");
  const [endDateFilter, setEndDateFilter]   = useState<"all" | "expired" | "30" | "60" | "90" | "90+">("all");
  const [usageSort, setUsageSort]           = useState<"none" | "low-high" | "high-low">("none");

  // ── Selection ──────────────────────────────────────────────────────────────
  const [selectedLeads, setSelectedLeads]           = useState<number[]>([]);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);

  // ── Import modal ───────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal]   = useState(false);
  const [bulkImportFile, setBulkImportFile]     = useState<File | null>(null);
  const [bulkImporting, setBulkImporting]       = useState(false);
  // ✅ Default assignToEmployee to null — backend will auto-assign to the importing user
  const [assignToEmployee, setAssignToEmployee] = useState<number | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<{
    success: boolean; successful: number; duplicates?: number; errors: string[]; assigned_to?: string;
    duplicate_report?: string[];
  } | null>(null);

  // ── Callback modal ─────────────────────────────────────────────────────────
  const [showCallbackModal, setShowCallbackModal]               = useState(false);
  const [selectedLeadForCallback, setSelectedLeadForCallback]   = useState<number | null>(null);
  const [callbackStatus, setCallbackStatus]                     = useState("");
  const [callbackDate, setCallbackDate]                         = useState("");
  const [callbackNotes, setCallbackNotes]                       = useState("");
  const [newEndDate, setNewEndDate]                             = useState("");
  const [isSold, setIsSold]                                     = useState("");
  const [isSubmittingCallback, setIsSubmittingCallback]         = useState(false);
  const [callbackError, setCallbackError]                       = useState("");
  const [newSupplier, setNewSupplier]                           = useState("");
  const [newAddress, setNewAddress]                             = useState("");
  const [calledDate, setCalledDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [renewedBy, setRenewedBy]   = useState<"customer" | "agent" | "">("");

  // ── Assign modal ───────────────────────────────────────────────────────────
  const [showAssignModal, setShowAssignModal]       = useState(false);
  const [assigningLeadId, setAssigningLeadId]       = useState<number | null>(null);
  const [assignToEmployeeId, setAssignToEmployeeId] = useState("");
  const [assignmentNotes, setAssignmentNotes]       = useState("");
  const [isAssigning, setIsAssigning]               = useState(false);

  // ── Bulk assign modal ──────────────────────────────────────────────────────
  const [showBulkAssignModal, setShowBulkAssignModal]       = useState(false);
  const [bulkAssignEmployeeId, setBulkAssignEmployeeId]     = useState<number | null>(null);
  const [bulkAssignEmployeeName, setBulkAssignEmployeeName] = useState("");
  const [bulkAssignmentNotes, setBulkAssignmentNotes]       = useState("");
  const [isBulkAssigning, setIsBulkAssigning]               = useState(false);

  // ── Performance ────────────────────────────────────────────────────────────
  const [performanceStats, setPerformanceStats] = useState({
    converted: 0, renewed: 0, in_progress: 0, not_contacted: 0, lost: 0,
    success_rate: 0, renewed_directly: 0, end_date_changed: 0, priced: 0,
  });
  const [showPerformanceModal, setShowPerformanceModal]         = useState(false);
  const [performanceFilter, setPerformanceFilter]               = useState<string | null>(null);
  const [performanceFilteredLeads, setPerformanceFilteredLeads] = useState<LeadCustomer[]>([]);

  // Reset page when filters change
  useEffect(() => { setCurrentPage(1); }, [searchTerm, supplierFilter, statusFilter, usageSort, endDateFilter]);

  // ─── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchLeads = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const settled = await Promise.allSettled([
        fetchWithAuth(`/api/crm/leads?exclude_stage=Lost&service=${encodeURIComponent(service)}`),
        fetchWithAuth("/suppliers"),
        fetchWithAuth("/employees"),
        fetchWithAuth("/api/crm/stages"),
        loadTeamStatsWithFallback(service),
      ]);

      const [leadsSettled, suppSettled, empSettled, stagesSettled, teamBundleSettled] = settled;

      if (leadsSettled.status !== "fulfilled") {
        const reason =
          leadsSettled.reason instanceof Error
            ? leadsSettled.reason.message
            : "Failed to load leads";
        throw new Error(reason);
      }

      const leadsResp = leadsSettled.value;
      const active: LeadCustomer[] = Array.isArray(leadsResp)
        ? leadsResp
        : (leadsResp?.data || []);
      setAllLeads(active);

      if (suppSettled.status === "fulfilled") {
        const suppResp = suppSettled.value;
        setSuppliers(Array.isArray(suppResp) ? suppResp : (suppResp?.data || []));
      } else {
        console.warn("suppliers fetch failed:", suppSettled.reason);
        setSuppliers([]);
      }

      if (empSettled.status === "fulfilled") {
        const empResp = empSettled.value;
        const empList = Array.isArray(empResp?.data) ? empResp.data : (Array.isArray(empResp) ? empResp : []);
        setEmployees(empList);
      } else {
        console.warn("employees fetch failed:", empSettled.reason);
        setEmployees([]);
      }

      if (stagesSettled.status === "fulfilled") {
        const stagesResp = stagesSettled.value;
        setStages(Array.isArray(stagesResp) ? stagesResp : (stagesResp?.data || []));
      } else {
        console.warn("stages fetch failed:", stagesSettled.reason);
        setStages([]);
      }

      if (teamBundleSettled.status === "fulfilled") {
        const { teamStripStats: strip } = teamBundleSettled.value;
        setTeamStripStats(strip.filter((s) => s.count > 0));
      } else {
        console.warn("team lead stats fetch failed:", teamBundleSettled.reason);
        setTeamStripStats([]);
      }
    } catch (err: any) {
      console.error("❌ fetchLeads error:", err);
      setError(err.message || "Failed to load leads");
      setAllLeads([]);
      setTeamStripStats([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchPerformanceStats = async () => {
    try {
      const resp = await fetchWithAuth(
        `/api/crm/leads/performance?service=${encodeURIComponent(service)}`
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
    } catch { /* optional */ }
  };

  useEffect(() => {
    fetchLeads();
    fetchPerformanceStats();
  }, [service]);

  // ── Cross-team text search (debounced) ─────────────────────────────────────
  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) { setSearchResults([]); return; }
    const tid = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetchWithAuth(
          `/api/crm/leads/search-all?q=${encodeURIComponent(searchTerm)}&service=${encodeURIComponent(service)}`
        );
        setSearchResults(Array.isArray(resp) ? resp : (resp?.data || []));
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(tid);
  }, [searchTerm, service]);

  // ── Derived lists ──────────────────────────────────────────────────────────
  const sortedLeads = useMemo(() => {
    const base = [...allLeads];
    if (searchTerm && searchResults.length > 0) {
      const existingIds = new Set(base.map(l => l.opportunity_id));
      const extras = searchResults.filter(l => !existingIds.has(l.opportunity_id));
      return [...base, ...extras].sort((a, b) => {
        const orderA = a.display_order ?? 999999;
        const orderB = b.display_order ?? 999999;
        return orderA - orderB;  // ✅ ASCENDING
      });
    }
    return base.sort((a, b) => {
      const orderA = a.display_order ?? 999999;
      const orderB = b.display_order ?? 999999;
      return orderA - orderB;  // ✅ ASCENDING
    });
  }, [allLeads, searchResults, searchTerm]);

  const filteredLeads = useMemo(() => {
    let list = sortedLeads.filter(l => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (l.business_name  || "").toLowerCase().includes(term) ||
        (l.contact_person || "").toLowerCase().includes(term) ||
        (l.email          || "").toLowerCase().includes(term) ||
        (l.tel_number     || "").toLowerCase().includes(term) ||
        (l.mpan_mpr       || "").toLowerCase().includes(term);
      const matchSupplier = supplierFilter === "All" || l.supplier_id === supplierFilter;
      const matchStatus   = statusFilter   === "All" || l.stage_name === statusFilter;
      let matchEndDate = true;
      if (endDateFilter !== "all" && l.end_date) {
        const today = new Date();
        const end   = new Date(l.end_date);
        const days  = Math.ceil((end.getTime() - today.getTime()) / 86400000);
        if      (endDateFilter === "expired") matchEndDate = days < 0;
        else if (endDateFilter === "30")      matchEndDate = days >= 0 && days <= 30;
        else if (endDateFilter === "60")      matchEndDate = days > 30 && days <= 60;
        else if (endDateFilter === "90")      matchEndDate = days > 60 && days <= 90;
        else if (endDateFilter === "90+")     matchEndDate = days > 90 && days <= 365;
      }
      return matchSearch && matchSupplier && matchStatus && matchEndDate;
    });
    if (usageSort !== "none") {
      list = [...list].sort((a, b) => {
        const au = a.annual_usage || 0, bu = b.annual_usage || 0;
        return usageSort === "low-high" ? au - bu : bu - au;
      });
    }
    return list;
  }, [sortedLeads, searchTerm, supplierFilter, statusFilter, endDateFilter, usageSort]);

  const totalPages    = Math.ceil(filteredLeads.length / CUSTOMERS_PER_PAGE);
  const paginatedLeads = useMemo(() => {
    const s = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    return filteredLeads.slice(s, s + CUSTOMERS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  // A lead is "from search" when it's in search results but not in the user's own list
  const isFromSearch = (l: LeadCustomer) => {
    if (isAdmin) return false;
    const ownIds = new Set(allLeads.map(x => x.opportunity_id));
    return !ownIds.has(l.opportunity_id);
  };

  const getSupplierName = (id?: number | null) =>
    suppliers.find(s => s.supplier_id === id)?.supplier_name || "—";

  const isDateRequired = () => {
    if (!callbackStatus) return false;
    const cfg = statusConfig[callbackStatus];
    if (!cfg) return false;
    if (cfg.requiresSold) return isSold === "yes";
    return cfg.requiresDate;
  };

  // ── Status / callback ──────────────────────────────────────────────────────
  const updateLeadStatus = (leadId: number, newStatus: string) => {
    if (!newStatus || newStatus === "CLEAR_STATUS") {
      fetchWithAuth(`/api/crm/leads/${leadId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: 1 }),
      }).then(() => {
        setAllLeads(prev => prev.map(l =>
          l.opportunity_id === leadId ? { ...l, stage_name: null, stage_id: 1 } : l
        ));
        toast.success("✅ Status cleared");
      }).catch((e: any) => toast.error(`Failed to clear status: ${e?.message || ""}`));
      return;
    }
    setSelectedLeadForCallback(leadId);
    setCallbackStatus(newStatus);
    setCallbackDate(""); setCallbackNotes(""); setIsSold("");
    setNewEndDate(""); setNewSupplier(""); setNewAddress("");
    setCalledDate(new Date().toISOString().split("T")[0]);
    setCallbackError(""); setRenewedBy("");
    setShowCallbackModal(true);
  };

  const handleSubmitCallback = async () => {
    setCallbackError("");
    if (!callbackStatus || !selectedLeadForCallback) { setCallbackError("Please select a status"); return; }
    const cfg = statusConfig[callbackStatus];
    if (cfg?.requiresSold && !isSold) { setCallbackError("Please select if the contract was sold"); return; }
    if (cfg?.requiresNotes && !callbackNotes.trim()) { setCallbackError("Please enter the reason for this status"); return; }
    if (callbackStatus === "Already Renewed" && !renewedBy) { setCallbackError("Please select if renewed by customer or agent"); return; }
    if (callbackStatus === "End Date Changed" && !newEndDate) { setCallbackError("Please enter the new contract end date"); return; }

    setIsSubmittingCallback(true);
    try {
      const stageId = getStageIdFromStatus(callbackStatus, stages.length ? stages : undefined);
      const payload: any = { stage_id: stageId, status: callbackStatus, notes: callbackNotes };
      if (calledDate) payload.called_date = calledDate;
      if (isDateRequired() && callbackDate) payload.callback_date = callbackDate;
      if (cfg?.requiresSold) payload.is_sold = isSold === "yes";
      if (cfg?.requiresNewEndDate && newEndDate) payload.new_end_date = newEndDate;
      if (callbackStatus === "Already Renewed" && renewedBy) payload.renewed_by = renewedBy;
      if (cfg?.requiresSupplierChange && newSupplier.trim()) payload.new_supplier = newSupplier.trim();
      if (cfg?.requiresAddressChange && newAddress.trim()) payload.new_address = newAddress.trim();

      const response = await fetchWithAuth(
        `/api/crm/leads/${selectedLeadForCallback}/callback`,
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }
      );
      if (!response || response.error) throw new Error(response?.error || "Failed to save");

      if (response.moved_to_recycle_bin) {
        setAllLeads(prev => prev.filter(l => l.opportunity_id !== selectedLeadForCallback));
        setSelectedLeads(prev => prev.filter(id => id !== selectedLeadForCallback));
        toast.success("🗑️ Moved to recycle bin");
      } else if (response.moved_to_priced) {
        setAllLeads(prev => prev.filter(l => l.opportunity_id !== selectedLeadForCallback));
        setSelectedLeads(prev => prev.filter(id => id !== selectedLeadForCallback));
        toast.success("✅ Moved to Priced page");
      } else if (callbackStatus === "End Date Changed" || callbackStatus === "Already Renewed") {
        if (callbackStatus === "Already Renewed" && newSupplier.trim()) {
          setAllLeads(prev => prev.map(l =>
            l.opportunity_id === selectedLeadForCallback ? { ...l, supplier_name: newSupplier.trim() } : l
          ));
        }
        await fetchLeads();
        await fetchPerformanceStats();
        toast.success(`✅ ${callbackStatus === "Already Renewed" ? "Lead updated" : "End date updated"}`);
      } else {
        setAllLeads(prev => prev.map(l =>
          l.opportunity_id === selectedLeadForCallback ? { ...l, stage_name: callbackStatus } : l
        ));
        toast.success("✅ Callback saved");
      }
      setShowCallbackModal(false);
    } catch (err: any) {
      setCallbackError(err.message || "Failed to save callback");
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  // ── Assignment ─────────────────────────────────────────────────────────────
  const handleAssignWithNotes = async () => {
    if (!assigningLeadId) return;
    setIsAssigning(true);
    try {
      const empId = assignToEmployeeId === "0" ? null : parseInt(assignToEmployeeId);
      const payload: any = { employee_id: empId, lead_ids: [assigningLeadId] };
      if (assignmentNotes.trim()) payload.assignment_notes = assignmentNotes.trim();

      await fetchWithAuth("/api/crm/leads/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // ✅ Mirror renewals: assigning away removes from non-admin view
      if (isAdmin) {
        const empName = employees.find(e => e.employee_id === empId)?.employee_name || null;
        setAllLeads(prev => prev.map(l =>
          l.opportunity_id === assigningLeadId
            ? { ...l, opportunity_owner_employee_id: empId, assigned_to_name: empName }
            : l
        ));
        await fetchLeads(); // refresh team stats
      } else {
        // Non-admin: assigned lead moves away (becomes allocated), remove from view
        setAllLeads(prev => prev.filter(l => l.opportunity_id !== assigningLeadId));
        setSelectedLeads(prev => prev.filter(id => id !== assigningLeadId));
      }

      toast.success("✅ Salesperson assigned successfully");
      setShowAssignModal(false);
      setAssignToEmployeeId(""); setAssignmentNotes(""); setAssigningLeadId(null);
    } catch { toast.error("Failed to assign salesperson"); }
    finally { setIsAssigning(false); }
  };

  const handleBulkAssignWithNotes = async () => {
    if (!selectedLeads.length || !bulkAssignEmployeeId) {
      toast.error("Please select leads and a salesperson"); return;
    }
    setIsBulkAssigning(true);
    try {
      const payload: any = { lead_ids: selectedLeads, employee_id: bulkAssignEmployeeId };
      if (bulkAssignmentNotes.trim()) payload.assignment_notes = bulkAssignmentNotes.trim();

      await fetchWithAuth("/api/crm/leads/assign", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      // ✅ Mirror renewals exactly
      if (isAdmin) {
        setAllLeads(prev => prev.map(l =>
          selectedLeads.includes(l.opportunity_id)
            ? { ...l, opportunity_owner_employee_id: bulkAssignEmployeeId, assigned_to_name: bulkAssignEmployeeName }
            : l
        ));
        await fetchLeads(); // refresh team stats
      } else {
        // Non-admin: bulk assigned leads are removed from view (they go to allocated)
        setAllLeads(prev => prev.filter(l => !selectedLeads.includes(l.opportunity_id)));
      }

      setSelectedLeads([]); setIsSelectAllChecked(false);
      setShowBulkAssignModal(false); setBulkAssignmentNotes("");
      toast.success(`✅ ${selectedLeads.length} leads assigned to ${bulkAssignEmployeeName}`);
    } catch { toast.error("❌ Error assigning leads"); }
    finally { setIsBulkAssigning(false); }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteLead = async (id: number) => {
    if (!window.confirm("Delete this lead and all related records?")) return;
    try {
      await fetchWithAuth(`/api/crm/leads/${id}`, { method: "DELETE" });
      setAllLeads(prev => prev.filter(l => l.opportunity_id !== id));
      setSelectedLeads(prev => prev.filter(x => x !== id));
      toast.success("Lead deleted");
    } catch { toast.error("Error deleting lead"); }
  };

  const bulkDeleteLeads = async () => {
    if (!selectedLeads.length) { alert("Please select leads to delete"); return; }
    if (!window.confirm(`Delete ${selectedLeads.length} lead(s)?`)) return;
    try {
      await Promise.all(selectedLeads.map(id =>
        fetchWithAuth(`/api/crm/leads/${id}`, { method: "DELETE" })
      ));
      setAllLeads(prev => prev.filter(l => !selectedLeads.includes(l.opportunity_id)));
      setSelectedLeads([]); setIsSelectAllChecked(false);
      toast.success(`✅ Deleted ${selectedLeads.length} lead(s)`);
    } catch { toast.error("Error deleting some leads"); }
  };

  // ── Selection ──────────────────────────────────────────────────────────────
  const handleSelectAll = () => {
    if (isSelectAllChecked) { setSelectedLeads([]); setIsSelectAllChecked(false); }
    else {
      setSelectedLeads(filteredLeads.map(l => l.opportunity_id));
      setIsSelectAllChecked(true);
    }
  };
  const handleSelectLead = (id: number) => {
    setSelectedLeads(prev => {
      const n = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
      setIsSelectAllChecked(n.length === filteredLeads.length);
      return n;
    });
  };

  // ── Import ─────────────────────────────────────────────────────────────────
  // ✅ Download template from /import/leads/template — same pattern as renewals
  const downloadTemplate = async () => {
    const token    = localStorage.getItem("auth_token");
    const tenantId = localStorage.getItem("tenant_id") || "";
    try {
      const res = await fetch(`${API_BASE_URL}/import/leads/template`, {
        headers: { Authorization: `Bearer ${token}`, "X-Tenant-ID": tenantId },
      });
      if (!res.ok) throw new Error("Failed to download");
      const blob = await res.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a"); a.href = url; a.download = "leads_template.xlsx";
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch (e) { alert(e instanceof Error ? e.message : "Failed"); }
  };

  // ✅ KEY FIX: Use /import/leads (same backend as renewals uses /import/energy-customers)
  // This endpoint in import_routes.py auto-assigns to the importing user when no
  // assigned_employee_id is provided — exactly what we want.
  const handleBulkImport = async () => {
    if (!bulkImportFile) { alert("Please select a file"); return; }
    setBulkImporting(true); setBulkImportResult(null);
    try {
      const token    = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id") || "";
      const fd = new FormData();
      fd.append("file", bulkImportFile);
      // ✅ If no employee selected, DO NOT append assigned_employee_id at all.
      // The backend (/import/leads) will default to the authenticated user's employee_id.
      if (assignToEmployee) {
        fd.append("assigned_employee_id", assignToEmployee.toString());
      }

      const res = await fetch(
        `${API_BASE_URL}/import/leads?service=${encodeURIComponent(service)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId,
          },
          body: fd,
        }
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setBulkImportResult({
          success:          true,
          successful:       data.successful,
          duplicates:       data.duplicates,
          errors:           data.errors || [],
          assigned_to:      data.assigned_to,
          duplicate_report: data.duplicate_report,
        });
        toast.success(`✅ Imported ${data.successful} leads!`);
        await fetchLeads();
        setBulkImportFile(null);
        setAssignToEmployee(null);
      } else {
        setBulkImportResult({
          success:    false,
          successful: data.successful || 0,
          errors:     data.errors || [data.error || "Import failed"],
        });
        toast.error(data.error || "Import failed");
      }
    } catch {
      toast.error("Network error");
      setBulkImportResult({ success: false, successful: 0, errors: ["Network error"] });
    } finally { setBulkImporting(false); }
  };

  // ── Performance modal ──────────────────────────────────────────────────────
  const handlePerformanceClick = async (type: string) => {
    setPerformanceFilter(type);
    try {
      const resp = await fetchWithAuth(
        `/api/crm/leads?service=${encodeURIComponent(service)}`
      );
      const all: LeadCustomer[] = Array.isArray(resp) ? resp : (resp?.data || []);
      let filtered: LeadCustomer[] = [];
      switch (type) {
        case "converted":       filtered = all.filter(l => (l.stage_name || "").toLowerCase() === "converted"); break;
        case "renewed":         filtered = all.filter(l => { const s = (l.stage_name || "").toLowerCase(); return ["priced","already renewed","end date changed"].includes(s); }); break;
        case "in_progress":     filtered = all.filter(l => { const s = (l.stage_name || "").toLowerCase(); return ["callback","not answered"].includes(s); }); break;
        case "not_contacted":   filtered = all.filter(l => { const s = (l.stage_name || "").toLowerCase(); return !s || s === "not called"; }); break;
        case "lost":            filtered = all.filter(l => { const s = (l.stage_name || "").toLowerCase(); return ["lost","lost cot"].includes(s); }); break;
        case "renewed_directly":filtered = all.filter(l => (l.stage_name || "").toLowerCase() === "renewed directly"); break;
        case "end_date_changed":filtered = all.filter(l => (l.stage_name || "").toLowerCase() === "end date changed"); break;
        case "priced":          filtered = all.filter(l => (l.stage_name || "").toLowerCase() === "priced"); break;
      }
      setPerformanceFilteredLeads(filtered);
      setShowPerformanceModal(true);
    } catch { toast.error("Failed to load leads"); }
  };

  const getPerformanceLabel = (type: string) => ({
    converted: "Converted", renewed: "Renewed", in_progress: "In Progress",
    not_contacted: "Not Contacted", lost: "Lost", renewed_directly: "Renewed Directly",
    end_date_changed: "End Date Changed", priced: "Priced",
  }[type] || "");

  // ── Pagination ─────────────────────────────────────────────────────────────
  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredLeads.length)}</span>{" "}
          of <span className="font-medium">{filteredLeads.length}</span> leads
        </div>
        <div className="flex space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronFirst className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex items-center px-3 text-sm text-gray-700">Page {currentPage} of {totalPages}</div>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronLast className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full p-6">
      <Toaster position="top-right" />
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">Leads</h1>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur">
          {["utilities", "water"].map(svc => (
            <button key={svc} type="button" onClick={() => setService(svc)}
              className={`px-8 py-3 rounded-full text-base font-semibold transition-all capitalize ${service === svc ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
              {svc.charAt(0).toUpperCase() + svc.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Team lead load — same shell as dashboard Team Performance (crm-panel, rings, legend) */}
      <div className="mb-6">
        <LeadsTeamPerformanceStrip
          stats={teamStripStats}
          loading={isLoading}
          isAdmin={isAdmin}
          myLeadCount={allLeads.length}
        />
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Leads</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button onClick={fetchLeads} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {/* Bulk selection bar */}
      {selectedLeads.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">{selectedLeads.length} lead(s) selected</h3>
                <p className="text-sm text-blue-700">Click a salesperson to assign</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedLeads([]); setIsSelectAllChecked(false); }}>Clear Selection</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {employees.map(emp => (
              <Button key={emp.employee_id} variant="outline" size="sm" className="hover:bg-blue-100 hover:border-blue-400"
                onClick={() => { setBulkAssignEmployeeId(emp.employee_id); setBulkAssignEmployeeName(emp.employee_name); setBulkAssignmentNotes(""); setShowBulkAssignModal(true); }}>
                <Users className="h-4 w-4 mr-2" />Assign to {emp.employee_name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Performance metrics: same color pattern as renewals; full class names so Tailwind includes them */}
      <div className="mb-6">
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Lead Performance</h2>
            <p className="text-sm text-gray-600">{isAdmin ? "Overall lead success metrics" : "Your lead success metrics"}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-7">
            <div
              className="text-center p-6 border rounded-lg bg-emerald-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePerformanceClick("converted")}
            >
              <div className="text-4xl font-bold text-emerald-700">{performanceStats.converted}</div>
              <div className="text-sm text-emerald-600 mt-2 font-medium">Converted</div>
              <div className="mt-3"><CheckCircle2 className="h-6 w-6 text-emerald-600 mx-auto" /></div>
            </div>
            <div
              className="text-center p-6 border rounded-lg bg-green-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePerformanceClick("renewed")}
            >
              <div className="text-4xl font-bold text-green-700">{performanceStats.renewed}</div>
              <div className="text-sm text-green-600 mt-2 font-medium">Renewed</div>
              <div className="mt-3"><CheckCircle2 className="h-6 w-6 text-green-600 mx-auto" /></div>
            </div>
            <div
              className="text-center p-6 border rounded-lg bg-blue-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePerformanceClick("in_progress")}
            >
              <div className="text-4xl font-bold text-blue-700">{performanceStats.in_progress}</div>
              <div className="text-sm text-blue-600 mt-2 font-medium">In Progress</div>
              <div className="mt-3"><TrendingUp className="h-6 w-6 text-blue-600 mx-auto" /></div>
            </div>
            <div
              className="text-center p-6 border rounded-lg bg-teal-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePerformanceClick("renewed_directly")}
            >
              <div className="text-4xl font-bold text-teal-700">{performanceStats.renewed_directly}</div>
              <div className="text-sm text-teal-600 mt-2 font-medium">Renewed Directly</div>
              <div className="mt-3"><CheckCircle2 className="h-6 w-6 text-teal-600 mx-auto" /></div>
            </div>
            <div
              className="text-center p-6 border rounded-lg bg-purple-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePerformanceClick("end_date_changed")}
            >
              <div className="text-4xl font-bold text-purple-700">{performanceStats.end_date_changed}</div>
              <div className="text-sm text-purple-600 mt-2 font-medium">End Date Changed</div>
              <div className="mt-3"><Calendar className="h-6 w-6 text-purple-600 mx-auto" /></div>
            </div>
            <div
              className="text-center p-6 border rounded-lg bg-yellow-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePerformanceClick("priced")}
            >
              <div className="text-4xl font-bold text-yellow-700">{performanceStats.priced}</div>
              <div className="text-sm text-yellow-600 mt-2 font-medium">Priced</div>
              <div className="mt-3"><TrendingUp className="h-6 w-6 text-yellow-600 mx-auto" /></div>
            </div>
            <div
              className="text-center p-6 border rounded-lg bg-orange-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePerformanceClick("not_contacted")}
            >
              <div className="text-4xl font-bold text-orange-700">{performanceStats.not_contacted}</div>
              <div className="text-sm text-orange-600 mt-2 font-medium">Not Contacted</div>
              <div className="mt-3"><AlertTriangle className="h-6 w-6 text-orange-600 mx-auto" /></div>
            </div>
            <div
              className="text-center p-6 border rounded-lg bg-red-50 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => handlePerformanceClick("lost")}
            >
              <div className="text-4xl font-bold text-red-700">{performanceStats.lost}</div>
              <div className="text-sm text-red-600 mt-2 font-medium">Lost</div>
              <div className="mt-3"><TrendingDown className="h-6 w-6 text-red-600 mx-auto" /></div>
            </div>
          </div>
          <div className="mt-4 text-center border-t pt-4">
            <div className="text-sm text-gray-600">
              Lead success rate: <span className="font-semibold text-gray-900">{performanceStats.success_rate}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Modal */}
      <Dialog open={showPerformanceModal} onOpenChange={setShowPerformanceModal}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-2xl font-bold">{performanceFilter ? getPerformanceLabel(performanceFilter) : "Leads"}</DialogTitle>
            <DialogDescription>Showing {performanceFilteredLeads.length} lead{performanceFilteredLeads.length !== 1 ? "s" : ""}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {performanceFilteredLeads.length === 0 ? (
              <div className="text-center py-16 text-gray-500"><p className="text-lg">No leads in this category</p></div>
            ) : (
              <div className="space-y-3 py-4">
                {performanceFilteredLeads.map(l => (
                  <div key={l.opportunity_id}
                    className="p-5 border rounded-xl hover:bg-gray-50 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => { setShowPerformanceModal(false); window.open(`/dashboard/leads/${l.opportunity_id}`, "_blank"); }}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 truncate">{l.business_name}</h3>
                          {l.stage_name && (
                            <Badge variant="outline" className={`text-xs flex-shrink-0 ${getStatusColor(l.stage_name)}`}>{getStatusLabel(l.stage_name)}</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{l.contact_person} · {l.tel_number}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {l.annual_usage && <p className="text-sm font-semibold text-gray-700">{formatUsage(l.annual_usage)}</p>}
                        {l.end_date && <p className="text-xs text-gray-500 mt-1">End: {formatDate(l.end_date)}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 pt-3 border-t border-gray-100">
                      <div><p className="text-xs text-gray-500 uppercase mb-1">Supplier</p><p className="font-semibold text-sm text-gray-900 truncate">{l.supplier_name || getSupplierName(l.supplier_id)}</p></div>
                      <div><p className="text-xs text-gray-500 uppercase mb-1">MPAN</p><p className="font-semibold text-sm text-gray-900 font-mono truncate">{l.mpan_mpr || "—"}</p></div>
                      <div><p className="text-xs text-gray-500 uppercase mb-1">Annual Usage</p><p className="font-semibold text-sm text-gray-900">{l.annual_usage?.toLocaleString() || "—"} kWh</p></div>
                      <div><p className="text-xs text-gray-500 uppercase mb-1">Assigned To</p>
                        <p className="font-semibold text-sm text-purple-700 flex items-center gap-1 truncate">
                          <Users className="h-3 w-3 flex-shrink-0" /><span className="truncate">{l.assigned_to_name || "Unassigned"}</span>
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setShowPerformanceModal(false)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Search / Filter Bar */}
      <div className="mb-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input placeholder="Search leads..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
            {isSearching && (
              <div className="absolute right-2 top-2.5">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Filter className="mr-2 h-4 w-4" />{supplierFilter === "All" ? "All Suppliers" : getSupplierName(supplierFilter as number)}<ChevronDown className="ml-1 h-3 w-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSupplierFilter("All")}>All Suppliers</DropdownMenuItem>
              {suppliers.map(s => <DropdownMenuItem key={s.supplier_id} onClick={() => setSupplierFilter(s.supplier_id)}>{s.supplier_name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline"><Filter className="mr-2 h-4 w-4" />{statusFilter === "All" ? "All Status" : getStatusLabel(statusFilter as string)}<ChevronDown className="ml-1 h-3 w-3" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("All")}>All Status</DropdownMenuItem>
              {STATUS_OPTIONS.map(o => <DropdownMenuItem key={o.value} onClick={() => setStatusFilter(o.value)}>{o.label}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={endDateFilter} onValueChange={(v: any) => setEndDateFilter(v)}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
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
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Usage: Default</SelectItem>
              <SelectItem value="low-high">Usage: Low to High</SelectItem>
              <SelectItem value="high-low">Usage: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 items-center">
          <Button onClick={() => setShowImportModal(true)} variant="outline"><Upload className="mr-2 h-4 w-4" />Bulk Import</Button>
          <Button onClick={() => setShowImportModal(true)}><Plus className="mr-2 h-4 w-4" />Add Lead</Button>
          {selectedLeads.length > 0 && (
            <Button onClick={bulkDeleteLeads} variant="destructive"><Trash2 className="mr-2 h-4 w-4" />Delete Selected ({selectedLeads.length})</Button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left w-8">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                    onChange={handleSelectAll} />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-20 border-r-2 border-gray-300">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">Client Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[11%]">Trading Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[8%]">Tel No</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[8%]">Mobile No</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[10%]">MPAN Top</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">Supplier</th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">Annual Usage</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">Start Date</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">Contract End</th>
                <th className="px-3 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase w-[12%]">Status</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">Assigned To</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr><td colSpan={13} className="px-6 py-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600" />
                  <p className="mt-4 text-gray-500">Loading leads...</p>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={13} className="px-6 py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                  <p className="text-lg text-red-600">Failed to load leads</p>
                  <p className="mt-2 text-sm">{error}</p>
                </td></tr>
              ) : paginatedLeads.length === 0 ? (
                <tr><td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg">No leads found.</p>
                  <p className="mt-2 text-sm">{searchTerm || statusFilter !== "All" ? "Try adjusting your filters." : "Use Bulk Import to add leads."}</p>
                </td></tr>
              ) : paginatedLeads.map(lead => {
                const isSelected = selectedLeads.includes(lead.opportunity_id);
                const fromSearch = isFromSearch(lead);
                const displayId = lead.tenant_lead_id || lead.opportunity_id;
                return (
                  <tr key={lead.opportunity_id}
                    className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? "bg-blue-50" : fromSearch ? "bg-amber-50" : ""}`}
                    onClick={() => window.open(`/dashboard/leads/${lead.opportunity_id}`, "_blank")}
                    onContextMenu={e => {
                      e.preventDefault();
                      const menu = document.createElement("div");
                      menu.className = "fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 py-1";
                      menu.style.left = `${e.pageX}px`; menu.style.top = `${e.pageY}px`;
                      const del = document.createElement("button");
                      del.className = "w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2";
                      del.innerHTML = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete`;
                      del.onclick = () => { deleteLead(lead.opportunity_id); document.body.removeChild(menu); };
                      menu.appendChild(del); document.body.appendChild(menu);
                      const close = (ev: MouseEvent) => { if (!menu.contains(ev.target as Node)) { try { document.body.removeChild(menu); } catch {} document.removeEventListener("click", close); } };
                      setTimeout(() => document.addEventListener("click", close), 0);
                    }}>

                    <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-gray-300 mt-1"
                        checked={isSelected}
                        onChange={() => handleSelectLead(lead.opportunity_id)}
                        disabled={fromSearch} />
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        {displayId}
                        {fromSearch && <span title="From team search" className="inline-flex"><Info className="h-3 w-3 text-amber-600" /></span>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700 align-top overflow-hidden">
                      <div className="leading-tight">
                        <div className="truncate" title={lead.contact_person || ""}>{lead.contact_person || "—"}</div>
                        {fromSearch && <Badge variant="outline" className="mt-1 text-xs bg-amber-100 text-amber-800 border-amber-300">{lead.assigned_to_name || "Other team"}</Badge>}
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="truncate" title={lead.business_name || ""}>{lead.business_name || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{lead.tel_number ? String(lead.tel_number).replace(/\.0$/, "") : "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{lead.mobile_no ? String(lead.mobile_no).replace(/\.0$/, "") : "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="truncate" title={lead.mpan_mpr || ""}>{lead.mpan_mpr || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="truncate">{lead.supplier_name || getSupplierName(lead.supplier_id)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                      <div className="whitespace-nowrap">{lead.annual_usage ? lead.annual_usage.toLocaleString() : "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatDate(lead.start_date)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatDate(lead.end_date)}</div>
                    </td>
                    <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                      <Select value={lead.stage_name || ""} onValueChange={v => { if (v === "CLEAR_STATUS") updateLeadStatus(lead.opportunity_id, ""); else updateLeadStatus(lead.opportunity_id, v); }}>
                        <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                          <SelectValue placeholder="Set status">
                            {lead.stage_name
                              ? <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(lead.stage_name)}`}>{getStatusLabel(lead.stage_name)}</span>
                              : <span className="text-gray-500">Set status</span>}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                          {lead.stage_name && (<><div className="border-t my-1" /><SelectItem value="CLEAR_STATUS" className="text-red-600 font-medium">✕ Clear Status</SelectItem></>)}
                        </SelectContent>
                      </Select>
                    </td>
                    <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                      <Select
                        value={lead.opportunity_owner_employee_id?.toString() || "0"}
                        onValueChange={v => { setAssigningLeadId(lead.opportunity_id); setAssignToEmployeeId(v); setShowAssignModal(true); }}>
                        <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                          <SelectValue placeholder="Assign">{lead.assigned_to_name || "Unassigned"}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Unassigned</SelectItem>
                          {employees.map(e => <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!isLoading && !error && filteredLeads.length > 0 && <PaginationControls />}
      </div>

      {/* ── Bulk Import Modal ─────────────────────────────────────────────────── */}
      {/*
        ✅ This now mirrors the renewals import modal exactly:
        - Uses /import/leads endpoint (import_routes.py)
        - When "Assign To" is left blank, the backend auto-assigns to the importing user
        - Shows duplicate report just like renewals
      */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Leads</DialogTitle>
            <DialogDescription>
              Upload an Excel or CSV file. Leads will be assigned to <strong>you</strong> by default unless you select someone else below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select File (.xlsx, .xls, .csv)</label>
              <input type="file" accept=".xlsx,.xls,.csv" onChange={e => setBulkImportFile(e.target.files?.[0] || null)} className="block w-full text-sm border rounded-md p-2" />
            </div>

            {/* ✅ "Assign To" — admin can pick someone; leaving blank = self-assign */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium mb-2">
                  Assign To <span className="text-gray-400 font-normal">(optional — defaults to your account)</span>
                </label>
                <Select value={assignToEmployee?.toString() || "0"} onValueChange={v => setAssignToEmployee(v === "0" ? null : Number(v))}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Assign to myself (default)" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Assign to myself (default)</SelectItem>
                    {employees.map(e => <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="font-medium text-sm mb-2">📥 Download Template</h4>
              <p className="text-xs text-blue-700 mb-2">Same format as the Renewals import template.</p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>Download Template</Button>
            </div>

            {bulkImportResult && (
              <div className={`rounded-md p-4 ${bulkImportResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <h4 className="font-medium text-sm mb-2">{bulkImportResult.success ? "✅ Import Successful" : "❌ Import Failed"}</h4>
                <p className="text-sm">Imported: <strong>{bulkImportResult.successful}</strong> leads</p>
                {bulkImportResult.duplicates != null && bulkImportResult.duplicates > 0 && (
                  <p className="text-sm text-orange-700 mt-1">⚠️ Duplicates skipped: <strong>{bulkImportResult.duplicates}</strong></p>
                )}
                {bulkImportResult.assigned_to && (
                  <p className="text-sm text-green-700 mt-1">✅ Assigned to: <strong>{bulkImportResult.assigned_to}</strong></p>
                )}
                {bulkImportResult.duplicate_report && bulkImportResult.duplicate_report.length > 0 && (
                  <details className="mt-2">
                    <summary className="text-xs cursor-pointer text-orange-700 font-medium">View duplicate report</summary>
                    <ul className="list-none text-xs mt-1 max-h-32 overflow-y-auto space-y-0.5">
                      {bulkImportResult.duplicate_report.map((line, i) => <li key={i} className="text-gray-600">{line}</li>)}
                    </ul>
                  </details>
                )}
                {bulkImportResult.errors.length > 0 && (
                  <div className="mt-2"><p className="text-sm font-medium">Errors:</p>
                    <ul className="list-disc list-inside text-xs mt-1 max-h-40 overflow-y-auto">
                      {bulkImportResult.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                      {bulkImportResult.errors.length > 5 && <li>... and {bulkImportResult.errors.length - 5} more</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowImportModal(false); setBulkImportFile(null); setAssignToEmployee(null); setBulkImportResult(null); }}>Cancel</Button>
              <Button onClick={handleBulkImport} disabled={!bulkImportFile || bulkImporting}>
                {bulkImporting ? <><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />Importing...</> : "Import Leads"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Callback Modal */}
      <Dialog open={showCallbackModal} onOpenChange={setShowCallbackModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{callbackStatus ? `Add ${callbackStatus}` : "Add Action"}</DialogTitle>
            <DialogDescription>Record lead interaction and set follow-up</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {callbackError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{callbackError}</AlertDescription></Alert>}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <div className="p-2 bg-gray-50 rounded border">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(callbackStatus)}`}>{getStatusLabel(callbackStatus)}</span>
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
                <label className="text-sm font-medium">New Contract End Date {callbackStatus === "End Date Changed" ? "*" : ""}</label>
                <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
                <p className="text-xs text-gray-500">{callbackStatus === "Already Renewed" ? "Optional: Update if the contract end date has changed" : "The contract end date will be updated to this new date"}</p>
              </div>
            )}
            {callbackStatus === "Already Renewed" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Renewed By <span className="text-red-500">*</span></label>
                <div className="flex flex-col gap-2 p-3 border rounded-lg bg-gray-50">
                  {(["customer", "agent"] as const).map(v => (
                    <label key={v} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="renewedBy" value={v} checked={renewedBy === v} onChange={() => setRenewedBy(v)} className="w-4 h-4 accent-black" />
                      <div>
                        <span className="text-sm font-medium text-gray-900">Renewed by {v.charAt(0).toUpperCase() + v.slice(1)}</span>
                        <p className="text-xs text-gray-500">{v === "customer" ? "Customer renewed directly without agent" : "Agent successfully renewed the contract"}</p>
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
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription><strong>Warning:</strong> This will move the record to the recycle bin.</AlertDescription></Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes {statusConfig[callbackStatus]?.requiresNotes && <span className="text-red-500">*</span>}</label>
              <Textarea placeholder={statusConfig[callbackStatus]?.requiresNotes ? "Enter required notes..." : "Add any additional notes..."} value={callbackNotes} onChange={e => setCallbackNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCallbackModal(false)} disabled={isSubmittingCallback}>Cancel</Button>
            <Button onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
              {isSubmittingCallback ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : (callbackStatus ? `Save ${callbackStatus}` : "Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Assign Salesperson</DialogTitle><DialogDescription>Add an optional note about this assignment</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Assigned To</label>
              <Select value={assignToEmployeeId} onValueChange={setAssignToEmployeeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Unassigned</SelectItem>
                  {employees.map(e => <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why is this being assigned?" value={assignmentNotes} onChange={e => setAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowAssignModal(false); setAssignToEmployeeId(""); setAssignmentNotes(""); setAssigningLeadId(null); }} disabled={isAssigning}>Cancel</Button>
            <Button onClick={handleAssignWithNotes} disabled={isAssigning}>
              {isAssigning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</> : "Assign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Modal */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Bulk Assign Leads</DialogTitle><DialogDescription>Assign {selectedLeads.length} lead(s) to {bulkAssignEmployeeName}</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2"><UserCheck className="h-4 w-4 text-blue-600" /><span className="text-sm font-medium text-blue-900">{selectedLeads.length} lead{selectedLeads.length !== 1 ? "s" : ""} selected</span></div>
              <div className="text-sm text-blue-700">Assigning to: <strong>{bulkAssignEmployeeName}</strong></div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why are these being assigned?" value={bulkAssignmentNotes} onChange={e => setBulkAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowBulkAssignModal(false); setBulkAssignmentNotes(""); setBulkAssignEmployeeId(null); setBulkAssignEmployeeName(""); }} disabled={isBulkAssigning}>Cancel</Button>
            <Button onClick={handleBulkAssignWithNotes} disabled={isBulkAssigning}>
              {isBulkAssigning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</> : `Assign ${selectedLeads.length} Lead${selectedLeads.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}