"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Trash2, ChevronDown, Filter, AlertCircle,
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst,
  Upload, Users, UserCheck, Info, Loader2, Download,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar, X,
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
import { AddLeadModal } from "@/components/ui/AddLeadModal";

// ─── Constants ────────────────────────────────────────────────────────────────
const CUSTOMERS_PER_PAGE = 25;
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const CRM_PROXY = `${API_BASE_URL}/api/crm`;
const BACKEND_PROXY = API_BASE_URL;
const LEADS_CACHE_PREFIX = "cash2switch_leads_cache";
const LEADS_PERFORMANCE_CACHE_PREFIX = "cash2switch_leads_performance_cache";
const MAX_CACHED_LEADS = 1200;

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
  { value: "Lost",               label: "Lost" },
  { value: "Lost COT",           label: "Lost COT" },
  { value: "Invalid Number",     label: "Invalid Number" },
  { value: "Incorrect Supplier", label: "Incorrect Supplier" },
  { value: "Meter De-energised", label: "Meter De-energised" },
  { value: "Broker in Place",    label: "Broker in Place" },
  { value: "End Date Changed",   label: "End Date Changed" },
  { value: "Complaint",          label: "Complaint" },
  { value: "Email Only",         label: "Email Only" },
  { value: "Duplicate",          label: "Duplicate" },
];

const statusConfig: Record<string, {
  requiresDate: boolean; requiresSold: boolean; deletesRecord: boolean;
  requiresNotes: boolean; requiresNewEndDate: boolean;
  requiresSupplierChange: boolean; requiresAddressChange: boolean;
}> = {
  "Callback":           { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Answered":       { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Priced":             { requiresDate: false, requiresSold: true,  deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Sold":               { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: true,  requiresAddressChange: true  },
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
  "Won":                { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Converted":          { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Called":         { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Dead":               { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Duplicate":          { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
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
  is_archived?: boolean;
  is_allocated?: boolean;
  is_cleansed?: boolean;
  display_id?: number;
  display_order?: number;
}

interface TeamStat {
  employee_id: number | null;
  employee_name: string;
  lead_count?: number;
  count?: number;
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

const getStatusColor = (s?: string | null) => {
  if (!s) return "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300";
  const l = s.toLowerCase();
  if (l === "lead" || l === "not called") return "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400";
  if (["callback", "priced", "called", "converted", "won"].includes(l)) return "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300";
  if (l === "not answered") return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300";
  if (["lost", "lost cot"].includes(l)) return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";
  if (l === "dead") return "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200";
  return "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300";
};

const getStatusLabel = (s?: string | null) => {
  if (!s) return "—";
  if (s.toLowerCase() === "lead") return "Not Called";
  return STATUS_OPTIONS.find(o => o.value === s)?.label ||
    STATUS_OPTIONS.find(o => o.value.toLowerCase() === s.toLowerCase())?.label || s;
};

const getStageIdFromStatus = (status: string, stagesList?: Stage[]): number | null => {
  if (stagesList?.length) {
    const m = stagesList.find(s => s.stage_name.toLowerCase() === status.toLowerCase());
    if (m) return m.stage_id;
  }
  return null;
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
  const [employeeStats, setEmployeeStats] = useState<TeamStat[]>([]);

  // ── Loading / error ────────────────────────────────────────────────        
  const [isLoading, setIsLoading]     = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError]             = useState<string | null>(null);

  // ── Filters / pagination ───────────────────────────────────────────────────
  const [currentPage, setCurrentPage] = useState(1);
  const [service, setService] = useState(() => sessionStorage.getItem('leads_service') || "utilities");
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('leads_search') || "");
  const [supplierFilter, setSupplierFilter] = useState<number | "All">(() => {
    const saved = sessionStorage.getItem('leads_supplier');
    return saved && saved !== "All" ? parseInt(saved) : "All";
  });
  const [statusFilter, setStatusFilter] = useState<string | "All">(() => sessionStorage.getItem('leads_status') || "All");
  const [endDateFilter, setEndDateFilter] = useState<"all" | "expired" | "30" | "60" | "90" | "90+">(() => (sessionStorage.getItem('leads_end_date') as any) || "all");
  const [usageSort, setUsageSort] = useState<"none" | "low-high" | "high-low">(() => (sessionStorage.getItem('leads_usage_sort') as any) || "none");

  // ── Selection ──────────────────────────────────────────────────────────────
  const [selectedLeads, setSelectedLeads]            = useState<number[]>([]);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);

  // ── Import modal ───────────────────────────────────────────────────────────
  const [showImportModal, setShowImportModal] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [duplicateDetails, setDuplicateDetails] = useState<any[]>([]);
  const [showAllDuplicates, setShowAllDuplicates] = useState(false);
  const [assignToEmployee, setAssignToEmployee] = useState<number | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<{
    success: boolean;
    successful: number;
    duplicates?: number;
    errors: string[];
    assigned_to?: string;
    duplicate_report?: string[];
  } | null>(null);
  const [bulkAssignCount, setBulkAssignCount] = useState<number | "">("");

  // ── Callback modal ─────────────────────────────────────────────────────────
  const [showCallbackModal, setShowCallbackModal]               = useState(false);
  const [selectedLeadForCallback, setSelectedLeadForCallback]   = useState<number | null>(null);
  const [callbackStatus, setCallbackStatus]                     = useState("");
  const [callbackDate, setCallbackDate]                         = useState("");
  const [callbackNotes, setCallbackNotes]                       = useState("");
  const [newStartDate, setNewStartDate]                         = useState("");
  const [newEndDate, setNewEndDate]                             = useState("");
  const [isSold, setIsSold]                                     = useState("");
  const [isSubmittingCallback, setIsSubmittingCallback]         = useState(false);
  const [callbackError, setCallbackError]                       = useState("");
  const [newSupplier, setNewSupplier]                           = useState("");
  const [newAddress, setNewAddress]                             = useState("");
  const [calledDate, setCalledDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [renewedBy, setRenewedBy]   = useState<"customer" | "supplier" | "agent" | "">("");

  // ── Assign modal ───────────────────────────────────────────────────────────
  const [showAssignModal, setShowAssignModal]        = useState(false);
  const [assigningLeadId, setAssigningLeadId]        = useState<number | null>(null);
  const [assignToEmployeeId, setAssignToEmployeeId] = useState("");
  const [assignmentNotes, setAssignmentNotes]        = useState("");
  const [isAssigning, setIsAssigning]                = useState(false);

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
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [salespersonFilter, setSalespersonFilter] = useState<number | "All">(() => {
    const saved = sessionStorage.getItem('leads_salesperson');
    return saved && saved !== "All" ? parseInt(saved) : "All";
  });
  const [performanceModalLoading, setPerformanceModalLoading] = useState(false);
  const [performancePeriod, setPerformancePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('alltime');

  useEffect(() => { setCurrentPage(1); }, [searchTerm, supplierFilter, statusFilter, usageSort, endDateFilter, salespersonFilter]);

  const leadsCacheKey = `${LEADS_CACHE_PREFIX}_${service}`;
  const performanceCacheKey = `${LEADS_PERFORMANCE_CACHE_PREFIX}_${service}`;

  const saveLeadsCache = (leads: LeadCustomer[], teamStats: TeamStat[]) => {
    if (leads.length > MAX_CACHED_LEADS) return;
    try {
      sessionStorage.setItem(leadsCacheKey, JSON.stringify({ leads, teamStats }));
    } catch (e) {
      console.warn("Leads cache skipped (storage quota/availability):", e);
    }
  };

  const savePerformanceCache = (stats: typeof performanceStats) => {
    try {
      sessionStorage.setItem(performanceCacheKey, JSON.stringify(stats));
    } catch (e) {
      console.warn("Performance cache skipped (storage quota/availability):", e);
    }
  };

  // ─── Fetch helpers ──────────────────────────────────────────────────────────
  const fetchLeads = async (showLoader = true) => {
    if (showLoader) setIsLoading(true);
    setError(null);
    try {
      const [leadsResult, suppResult, empResult, stagesResult] = await Promise.allSettled([
        fetchWithAuth(`${CRM_PROXY}/leads?exclude_stage=Lost&service=${encodeURIComponent(service)}`),
        fetchWithAuth(`${BACKEND_PROXY}/suppliers`),
        fetchWithAuth(`${BACKEND_PROXY}/employees`),
        fetchWithAuth(`${CRM_PROXY}/stages`),
      ]);

      if (leadsResult.status === "rejected") throw leadsResult.reason;

      const leadsResp = leadsResult.value;
      const suppResp = suppResult.status === "fulfilled" ? suppResult.value : null;
      const empResp = empResult.status === "fulfilled" ? empResult.value : null;
      const stagesResp = stagesResult.status === "fulfilled" ? stagesResult.value : null;

      const active: LeadCustomer[] = Array.isArray(leadsResp)
        ? leadsResp
        : (leadsResp?.data || []);

      setAllLeads(active);
      setSuppliers(Array.isArray(suppResp) ? suppResp : (suppResp?.data || []));
      const empList = Array.isArray(empResp?.data) ? empResp.data : (Array.isArray(empResp) ? empResp : []);
      setEmployees(empList);
      setStages(Array.isArray(stagesResp) ? stagesResp : (stagesResp?.data || []));

      if (leadsResp?.team_stats && Array.isArray(leadsResp.team_stats)) {
        const stats: TeamStat[] = leadsResp.team_stats.map((s: any) => ({
          employee_id:   s.employee_id,
          employee_name: s.employee_name,
          count:         s.lead_count || s.count || 0,
        }));
        const visibleStats = stats.filter(s => (s.count ?? 0) > 0);
        setEmployeeStats(visibleStats);
        saveLeadsCache(active, visibleStats);
      } else {
        setEmployeeStats([]);
        saveLeadsCache(active, []);
      }
    } catch (err: any) {
      console.error("❌ fetchLeads error:", err);
      const cached = sessionStorage.getItem(leadsCacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached);
          setAllLeads(Array.isArray(parsed.leads) ? parsed.leads : []);
          setEmployeeStats(Array.isArray(parsed.teamStats) ? parsed.teamStats : []);
          setError(null);
        } catch {
          sessionStorage.removeItem(leadsCacheKey);
          setError(err?.message || "Failed to load leads");
          setAllLeads([]);
          setEmployeeStats([]);
        }
      } else {
        setError(err?.message || "Failed to load leads");
        setAllLeads([]);
        setEmployeeStats([]);
      }
    } finally {
      if (showLoader) setIsLoading(false);
    }
  };

  const fetchPerformanceStats = async (period = performancePeriod) => {
    try {
      const resp = await fetchWithAuth(
        `${CRM_PROXY}/leads/performance?service=${encodeURIComponent(service)}&period=${period}`
      );
      if (resp && !resp.error) {
        const nextStats = {
          converted:        resp.converted_count        || 0,
          renewed:          resp.renewed_count          || 0,
          in_progress:      resp.contacted_count        || 0,
          not_contacted:    resp.not_contacted_count    || 0,
          lost:             resp.lost_count             || 0,
          success_rate:     resp.success_rate           || 0,
          renewed_directly: resp.renewed_directly_count || 0,
          end_date_changed: resp.end_date_changed_count || 0,
          priced:           resp.priced_count           || 0,
        };
        setPerformanceStats(nextStats);
        savePerformanceCache(nextStats);
      }
    } catch (err) {
      console.error("Error fetching lead performance stats:", err);
      const cached = sessionStorage.getItem(performanceCacheKey);
      if (cached) {
        try { setPerformanceStats(JSON.parse(cached)); }
        catch { sessionStorage.removeItem(performanceCacheKey); }
      }
    }
  };

  useEffect(() => {
    fetchPerformanceStats(performancePeriod);
  }, [performancePeriod, service]);

  useEffect(() => {
    const handleFocus = () => fetchPerformanceStats(performancePeriod);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [performancePeriod, service]);

  useEffect(() => {
    Promise.all([
      fetchLeads(),
      fetchPerformanceStats(),
    ]);
  }, [service]);

  useEffect(() => { sessionStorage.setItem('leads_search', searchTerm); }, [searchTerm]);
  useEffect(() => { sessionStorage.setItem('leads_supplier', supplierFilter.toString()); }, [supplierFilter]);
  useEffect(() => { sessionStorage.setItem('leads_status', statusFilter.toString()); }, [statusFilter]);
  useEffect(() => { sessionStorage.setItem('leads_service', service); }, [service]);
  useEffect(() => { sessionStorage.setItem('leads_usage_sort', usageSort); }, [usageSort]);
  useEffect(() => { sessionStorage.setItem('leads_end_date', endDateFilter); }, [endDateFilter]);
  useEffect(() => { sessionStorage.setItem('leads_salesperson', salespersonFilter.toString()); }, [salespersonFilter]);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 2) { setSearchResults([]); return; }
    const tid = setTimeout(async () => {
      setIsSearching(true);
      try {
        const resp = await fetchWithAuth(
          `${CRM_PROXY}/leads/search-all?q=${encodeURIComponent(searchTerm)}&service=${encodeURIComponent(service)}`
        );
        setSearchResults(Array.isArray(resp) ? resp : (resp?.data || []));
      } catch { setSearchResults([]); }
      finally { setIsSearching(false); }
    }, 300);
    return () => clearTimeout(tid);
  }, [searchTerm, service]);

  // ── Derived lists ──────────────────────────────────────────────────────────
  const sortedLeads = useMemo(() => {
    const leadsToShow = searchTerm.trim() 
      ? allLeads  
      : allLeads.filter(l => !l.is_archived && !l.is_allocated);
      
    if (searchTerm && searchResults.length > 0) {
      const assignedIds = new Set(leadsToShow.map(l => l.opportunity_id));
      const uniqueSearchResults = searchResults.filter(l => !assignedIds.has(l.opportunity_id));
      return [...leadsToShow, ...uniqueSearchResults].sort((a, b) => {
        const dateA = new Date(a.created_at || 0).getTime();
        const dateB = new Date(b.created_at || 0).getTime();
        if (dateB !== dateA) return dateB - dateA;
        return (a.display_order ?? 9999) - (b.display_order ?? 9999);
      });
    }
      
    return [...leadsToShow].sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime();
      const dateB = new Date(b.created_at || 0).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return (a.display_order ?? 9999) - (b.display_order ?? 9999);
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
      const normaliseStage = (s: string | null | undefined) => {
        if (!s || s.toLowerCase() === 'lead') return 'Not Called';
        return s;
      };
      const matchStatus = statusFilter === "All" || normaliseStage(l.stage_name) === statusFilter;
      let matchEndDate = true;
      if (endDateFilter !== "all" && l.end_date) {
        const today = new Date();
        const end   = new Date(l.end_date);
        const days  = Math.ceil((end.getTime() - today.getTime()) / 86400000);
        if      (endDateFilter === "expired") matchEndDate = days < 0;
        else if (endDateFilter === "30")     matchEndDate = days >= 0 && days <= 30;
        else if (endDateFilter === "60")     matchEndDate = days > 30 && days <= 60;
        else if (endDateFilter === "90")     matchEndDate = days > 60 && days <= 90;
        else if (endDateFilter === "90+")     matchEndDate = days > 90 && days <= 365;
      }
      const matchSalesperson = !isAdmin || salespersonFilter === "All" ||
        Number(l.opportunity_owner_employee_id) === Number(salespersonFilter);

      return matchSearch && matchSupplier && matchStatus && matchEndDate && matchSalesperson;
    });
    if (usageSort !== "none") {
      list = [...list].sort((a, b) => {
        const au = a.annual_usage || 0, bu = b.annual_usage || 0;
        return usageSort === "low-high" ? au - bu : bu - au;
      });
    }
    return list;
  }, [sortedLeads, searchTerm, supplierFilter, statusFilter, endDateFilter, usageSort, salespersonFilter]);

  const totalPages    = Math.ceil(filteredLeads.length / CUSTOMERS_PER_PAGE);
  const paginatedLeads = useMemo(() => {
    const s = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    return filteredLeads.slice(s, s + CUSTOMERS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  const isFromSearch = (lead: LeadCustomer) => {
    if (isAdmin) return false;
    return lead.opportunity_owner_employee_id !== user?.employee_id;
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
      fetchWithAuth(`${CRM_PROXY}/leads/${leadId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: null }),
      })
      .then(() => {
        setAllLeads(prev => prev.map(l =>
          l.opportunity_id === leadId 
            ? { ...l, stage_name: null, stage_id: null } 
            : l
        ));
        toast.success("✅ Status cleared");
      })
      .catch((e: any) => {
        toast.error(`Failed to clear status: ${e?.message || "Unknown error"}`);
      });
      return;
    }

    setSelectedLeadForCallback(leadId);
    setCallbackStatus(newStatus);
    setCallbackDate("");
    setCallbackNotes("");
    setIsSold("");
    setNewStartDate("");
    setNewEndDate("");
    setNewSupplier("");
    setNewAddress("");
    setCalledDate(new Date().toISOString().split("T")[0]);
    setCallbackError("");
    setRenewedBy("");
    setAssignToEmployeeId("");
    setShowCallbackModal(true);
  };

  const handleSubmitCallback = async () => {
    setCallbackError("");
    if (!callbackStatus || !selectedLeadForCallback) { 
      setCallbackError("Please select a status"); 
      return; 
    }
    
    const cfg = statusConfig[callbackStatus];
    if (cfg?.requiresSold && !isSold) { 
      setCallbackError("Please select if the contract was sold"); 
      return; 
    }
    if (cfg?.requiresNotes && !callbackNotes.trim()) { 
      setCallbackError("Please enter the reason for this status"); 
      return; 
    }
    const isRenewalOrSoldAction = callbackStatus === "Already Renewed" || callbackStatus === "Sold";
    if (isRenewalOrSoldAction && !renewedBy) { 
      setCallbackError(callbackStatus === "Sold" ? "Please select if sold by supplier or agent" : "Please select if renewed by customer or agent"); 
      return; 
    }
    if (isRenewalOrSoldAction && renewedBy === "agent" && !newStartDate) {
      setCallbackError("Please enter the contract start date");
      return;
    }
    if (callbackStatus === "End Date Changed" && !newEndDate) { 
      setCallbackError("Please enter the new contract end date"); 
      return; 
    }

    setIsSubmittingCallback(true);
    try {
      const stageId = getStageIdFromStatus(callbackStatus, stages.length ? stages : undefined);
      const payload: any = {
        status: callbackStatus,
        notes: callbackNotes,
      };
      if (stageId) payload.stage_id = stageId;
      
      if (calledDate) payload.called_date = calledDate;
      if (isDateRequired() && callbackDate) payload.callback_date = callbackDate;
      if (cfg?.requiresSold) payload.is_sold = isSold === "yes";
      if (isRenewalOrSoldAction && newStartDate) payload.new_start_date = newStartDate;
      if (cfg?.requiresNewEndDate && newEndDate) payload.new_end_date = newEndDate;
      if (isRenewalOrSoldAction && renewedBy) payload.renewed_by = renewedBy;
      if ((callbackStatus === "Converted" || callbackStatus === "Won") && assignToEmployeeId && assignToEmployeeId !== "0") {
        payload.assigned_to = parseInt(assignToEmployeeId);
      }
      if (cfg?.requiresSupplierChange && newSupplier.trim()) payload.new_supplier = newSupplier.trim();
      if (cfg?.requiresAddressChange && newAddress.trim()) payload.new_address = newAddress.trim();

      const response = await fetchWithAuth(
        `${CRM_PROXY}/leads/${selectedLeadForCallback}/callback`,
        { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify(payload) 
        }
      );

      if (!response || response.error) {
        throw new Error(response?.error || "Failed to save");
      }

      if (response.display_only || callbackStatus === "Dead") {
        await fetchLeads();
        await fetchPerformanceStats();
        toast.success(`Status set to ${callbackStatus}`);
        setShowCallbackModal(false);
        setSelectedLeadForCallback(null);
        setCallbackStatus("");
        setCallbackNotes("");
        return;
      }

      if (response.moved_to_cleansing) {
        setAllLeads(prev => prev.filter(l => l.opportunity_id !== selectedLeadForCallback));
        setSelectedLeads(prev => prev.filter(id => id !== selectedLeadForCallback));
        toast.success("🧹 Moved to Cleansing");
      } else if (response.moved_to_recycle_bin || response.deleted) {
        setAllLeads(prev => prev.filter(l => l.opportunity_id !== selectedLeadForCallback));
        setSelectedLeads(prev => prev.filter(id => id !== selectedLeadForCallback));
        toast.success("🗑️ Moved to recycle bin");
      } else if (response.moved_to_priced) {
        setAllLeads(prev => prev.filter(l => l.opportunity_id !== selectedLeadForCallback));
        setSelectedLeads(prev => prev.filter(id => id !== selectedLeadForCallback));
        toast.success("✅ Moved to Priced page");
      } else if ((callbackStatus === "Converted" || callbackStatus === "Won") && response.allocated) {
        setAllLeads(prev => prev.filter(l => l.opportunity_id !== selectedLeadForCallback));
        setSelectedLeads(prev => prev.filter(id => id !== selectedLeadForCallback));
        toast.success("✅ Lead converted and assigned");
      } else {
        setAllLeads(prev =>
          prev.map(l =>
            l.opportunity_id === selectedLeadForCallback
              ? { 
                  ...l,
                  stage_name: response.lead?.stage_name || callbackStatus,
                  stage_id: response.lead?.stage_id || stageId || l.stage_id,
                  ...(response.lead || {}),
                }
              : l
          )
        );
        toast.success("✅ Callback saved");
      }

      setShowCallbackModal(false);
      setSelectedLeadForCallback(null);
      setCallbackStatus("");
      setCallbackDate("");
      setCallbackNotes("");
      setIsSold("");
      setNewStartDate("");
      setNewEndDate("");
      setNewSupplier("");
      setNewAddress("");
      setRenewedBy("");
      setAssignToEmployeeId("");
      
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

      await fetchWithAuth(`${CRM_PROXY}/leads/assign`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setAllLeads(prev => prev.filter(l => l.opportunity_id !== assigningLeadId));
      setSelectedLeads(prev => prev.filter(id => id !== assigningLeadId));

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
      const leadsToAssign = bulkAssignCount
        ? selectedLeads.slice(0, bulkAssignCount)
        : selectedLeads;

      const payload: any = { lead_ids: leadsToAssign, employee_id: bulkAssignEmployeeId };
      if (bulkAssignmentNotes.trim()) payload.assignment_notes = bulkAssignmentNotes.trim();

      let response: any = null;
      try {
        response = await fetchWithAuth(`${CRM_PROXY}/leads/assign`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } catch (fetchErr: any) {
        console.warn("Assign fetch error (may have succeeded in DB):", fetchErr);
      }

      if (response && response.error && !response.success) {
        throw new Error(response.error);
      }

      setAllLeads(prev => prev.filter(l => !leadsToAssign.includes(l.opportunity_id)));
      const remaining = selectedLeads.filter(id => !leadsToAssign.includes(id));
      setSelectedLeads(remaining);
      setIsSelectAllChecked(false);
      setShowBulkAssignModal(false);
      setBulkAssignmentNotes("");
      setBulkAssignCount("");
      toast.success(`✅ ${leadsToAssign.length} leads assigned to ${bulkAssignEmployeeName}`);

    } catch (err: any) {
      toast.error(`❌ Error assigning leads: ${err.message || "Unknown error"}`);
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // ── Delete ─────────────────────────────────────────────────────────────────
  const deleteLead = async (id: number) => {
    if (!window.confirm("Delete this lead and all related records?")) return;
    try {
      await fetchWithAuth(`${CRM_PROXY}/leads/${id}`, { method: "DELETE" });
      setAllLeads(prev => prev.filter(l => l.opportunity_id !== id));
      setSelectedLeads(prev => prev.filter(x => x !== id));
      toast.success("Lead deleted");
    } catch { toast.error("Error deleting lead"); }
  };

  const bulkDeleteLeads = async () => {
    if (!selectedLeads.length) { 
      alert("Please select leads to delete"); 
      return; 
    }
    if (!window.confirm(`Delete ${selectedLeads.length} lead(s)? This cannot be undone.`)) return;
    
    try {
      const response = await fetchWithAuth(`${CRM_PROXY}/leads/bulk-delete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ opportunity_ids: selectedLeads })
      });

      if (!response || response.error) {
        throw new Error(response?.error || 'Failed to delete leads');
      }

      setAllLeads(prev => prev.filter(l => !selectedLeads.includes(l.opportunity_id)));
      setSelectedLeads([]); 
      setIsSelectAllChecked(false);
      
    } catch (error: any) {
      console.error('Bulk delete error:', error);
      toast.error(`❌ Error deleting leads: ${error.message}`);
    }
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
  const downloadTemplate = async () => {
    const token    = localStorage.getItem("auth_token");
    const tenantId = localStorage.getItem("tenant_id") || "";
    try {
      const res = await fetch(`${BACKEND_PROXY}/import/leads/template`, {
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

  const handleBulkImport = async () => {
    if (!bulkImportFile) {
      alert("Please select a file");
      return;
    }

    setBulkImporting(true);
    setBulkImportResult(null);
    setDuplicateDetails([]);
    setShowAllDuplicates(false);
    setImportProgress(5);

    try {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id") || "";

      const fd = new FormData();
      fd.append("file", bulkImportFile);

      if (assignToEmployee) {
        fd.append("assigned_employee_id", assignToEmployee.toString());
      }

      setImportProgress(10);

      const res = await fetch(
        `${BACKEND_PROXY}/import/leads?service=${encodeURIComponent(service)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId,
          },
          body: fd,
        }
      );

      setImportProgress(30);

      const data = await res.json();

      if (!res.ok) {
        setBulkImportResult({
          success: false,
          successful: 0,
          duplicates: data.duplicates || 0,
          errors: [data.error || data.message || "Import failed"],
        });

        setImportProgress(100);
        toast.error(data.error || data.message || "Import failed");
        return;
      }

      if (data.job_id) {
        const jobId = data.job_id;

        const poll = async (): Promise<void> => {
          await new Promise((resolve) => setTimeout(resolve, 2000));

          try {
            const statusRes = await fetch(
              `${BACKEND_PROXY}/import/status/${jobId}`,
              {
                headers: {
                  Authorization: `Bearer ${token}`,
                  "X-Tenant-ID": tenantId,
                },
              }
            );

            const statusData = await statusRes.json();

            if (
              statusData.status === "running" ||
              statusData.status === "processing"
            ) {
              setImportProgress((prev) => Math.min(prev + 10, 90));
              return poll();
            }

            if (statusData.status === "done") {
              setImportProgress(95);

              const successful = statusData.successful || 0;
              const duplicates = statusData.duplicates || 0;
              const errors: string[] = statusData.errors || [];
              const details = statusData.duplicate_details || [];

              setDuplicateDetails(details);

              setBulkImportResult({
                success: successful > 0,
                successful,
                duplicates,
                errors,
                assigned_to: assignToEmployee
                  ? employees.find((e) => e.employee_id === assignToEmployee)?.employee_name
                  : "You",
                duplicate_report: statusData.duplicate_report || [],
              });

              setImportProgress(100);

              if (successful > 0) {
                await fetchLeads(false);
                setBulkImportFile(null);
                setAssignToEmployee(null);
              } else if (duplicates > 0) {
                toast.error("Import completed but all records were duplicates.");
              } else {
                toast.error("Import completed but no leads were inserted.");
              }
              return;
            }

            if (statusData.status === "failed") {
              const errors: string[] = statusData.errors || ["Import failed"];
              setBulkImportResult({
                success: false,
                successful: 0,
                duplicates: statusData.duplicates || 0,
                errors,
              });

              setImportProgress(100);
              toast.error("Import failed");
              return;
            }

            return poll();
          } catch {
            setBulkImportResult({
              success: false,
              successful: 0,
              errors: ["Network error while polling"],
            });

            setImportProgress(100);
            toast.error("Network error");
          }
        };

        await poll();
        return;
      }

      if (data.success) {
        const details = data.duplicate_details || [];
        setDuplicateDetails(details);

        setBulkImportResult({
          success: true,
          successful: data.successful || 0,
          duplicates: data.duplicates || 0,
          errors: data.errors || [],
          assigned_to: data.assigned_to,
          duplicate_report: data.duplicate_report || [],
        });

        setImportProgress(100);
        toast.success(`Imported ${data.successful || 0} leads!`);

        await fetchLeads(false);
        setBulkImportFile(null);
        setAssignToEmployee(null);
      } else {
        setBulkImportResult({
          success: false,
          successful: data.successful || 0,
          duplicates: data.duplicates || 0,
          errors: data.errors || [data.error || "Import failed"],
        });

        setImportProgress(100);
        toast.error(data.error || data.message || "Import failed");
      }
    } catch {
      setBulkImportResult({
        success: false,
        successful: 0,
        errors: ["Network error"],
      });

      setImportProgress(100);
      toast.error("Network error");
    } finally {
      setBulkImporting(false);
    }
  };

  // ── Performance modal ──────────────────────────────────────────────────────
  const handlePerformanceClick = async (type: string) => {
    setPerformanceFilter(type);
    setShowPerformanceModal(true);
    setPerformanceFilteredLeads([]);
    setPerformanceModalLoading(true);

    try {
      const resp = await fetchWithAuth(
        `${CRM_PROXY}/leads/performance?service=${encodeURIComponent(service)}&return_records=true&stage_filter=${encodeURIComponent(type)}`
      );
      setPerformanceFilteredLeads(resp?.records || []);
    } catch {
      toast.error("Failed to load leads");
      setPerformanceFilteredLeads([]);
    } finally {
      setPerformanceModalLoading(false);
    }
  };

  const getPerformanceLabel = (type: string) => ({
    converted: "Converted",
    renewed: "Renewed",
    in_progress: "In Progress",
    not_contacted: "Not Contacted",
    lost: "Lost",
    renewed_directly: "Renewed Directly",
    end_date_changed: "End Date Changed",
    priced: "Priced",
  }[type] || "");

  // ── Pagination ─────────────────────────────────────────────────────────────
  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredLeads.length)}</span>{" "}
          of <span className="font-medium">{filteredLeads.length}</span> leads
        </div>
        <div className="flex flex-wrap items-center justify-center space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}><ChevronFirst className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}><ChevronLeft className="h-4 w-4" /></Button>
          <div className="flex items-center px-3 text-sm text-gray-700 dark:text-gray-300">Page {currentPage} of {totalPages}</div>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}><ChevronLast className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  };

  const downloadLeadsCsv = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "ID",
      "Client Name",
      "Trading Name",
      "Phone",
      "Mobile",
      "Email",
      "MPAN/MPR",
      "Supplier",
      "Annual Usage",
      "Start Date",
      "End Date",
      "Status",
      "Assigned To",
    ];
    const rows = filteredLeads.map((lead) => [
      lead.tenant_lead_id ?? lead.opportunity_id,
      lead.contact_person,
      lead.business_name,
      lead.tel_number,
      lead.mobile_no,
      lead.email,
      lead.mpan_mpr,
      lead.supplier_name || getSupplierName(lead.supplier_id),
      lead.annual_usage,
      formatDate(lead.start_date),
      formatDate(lead.end_date),
      getStatusLabel(lead.stage_name || undefined),
      lead.assigned_to_name,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `leads-${service}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 text-slate-900 dark:text-slate-100">
      <Toaster position="top-right" />
      <h1 className="mb-6 text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Leads</h1>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-1 shadow-sm backdrop-blur w-full sm:w-auto">
          {["utilities", "water"].map(svc => (
            <button key={svc} type="button" onClick={() => setService(svc)}
              className={`flex-1 sm:flex-initial px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-semibold transition-all capitalize ${
                service === svc 
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}>
              {svc.charAt(0).toUpperCase() + svc.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Team Overview (admin only) */}
      {isAdmin && employeeStats.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Team Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {employeeStats.map(stat => (
              <div key={stat.employee_id ?? "unassigned"} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{stat.employee_name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stat.count ?? stat.lead_count ?? 0}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">lead{(stat.count ?? 0) !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* My Leads count (non-admin) */}
      {!isAdmin && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 dark:bg-blue-500 p-2 rounded-lg shrink-0"><Users className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your Leads</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{allLeads.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error Loading Leads</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
            <Button onClick={() => { fetchLeads(); fetchPerformanceStats(); }} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {/* Bulk selection bar */}
      {selectedLeads.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-200">{selectedLeads.length} lead(s) selected</h3>
                <p className="text-sm text-blue-700 dark:text-blue-400">Click a salesperson to assign</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedLeads([]); setIsSelectAllChecked(false); }}>Clear Selection</Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {employees.map(emp => (
              <Button key={emp.employee_id} variant="outline" size="sm" className="hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600"
                onClick={() => { setBulkAssignEmployeeId(emp.employee_id); setBulkAssignEmployeeName(emp.employee_name); setBulkAssignmentNotes(""); setShowBulkAssignModal(true); }}>
                <Users className="h-4 w-4 mr-2" />Assign to {emp.employee_name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Lead Performance</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{isAdmin ? "Overall lead success metrics" : "Your lead success metrics"}</p>
          </div>

          {/* Period selector */}
          <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2">
            <span className="text-xs font-medium text-gray-500 dark:text-gray-400 shrink-0">Period:</span>
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/60 p-1 shrink-0">
              {(['daily', 'weekly', 'monthly', 'alltime'] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPerformancePeriod(p)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium capitalize transition-all duration-150 ${
                    performancePeriod === p
                      ? 'bg-white dark:bg-slate-700 text-gray-900 dark:text-slate-100 shadow-sm'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'
                  }`}
                >
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
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading leads...
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
                        {l.annual_usage && <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">{formatUsage(l.annual_usage)}</p>}
                        {l.end_date && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">End: {formatDate(l.end_date)}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                      <div><p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Supplier</p><p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{l.supplier_name || getSupplierName(l.supplier_id)}</p></div>
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

      {/* Search / Filter Bar */}
      <div className="mb-6 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
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
              <Button variant="outline" className="min-w-0 justify-between w-full">
                <Filter className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{supplierFilter === "All" ? "All Suppliers" : getSupplierName(supplierFilter as number)}</span>
                <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSupplierFilter("All")}>All Suppliers</DropdownMenuItem>
              {suppliers.map(s => <DropdownMenuItem key={s.supplier_id} onClick={() => setSupplierFilter(s.supplier_id)}>{s.supplier_name}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-0 justify-between w-full">
                <Filter className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">{statusFilter === "All" ? "All Status" : getStatusLabel(statusFilter as string)}</span>
                <ChevronDown className="ml-1 h-3 w-3 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("All")}>All Status</DropdownMenuItem>
              {STATUS_OPTIONS.map(o => <DropdownMenuItem key={o.value} onClick={() => setStatusFilter(o.value)}>{o.label}</DropdownMenuItem>)}
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
          <Button variant="outline" onClick={() => setShowFilterSidebar(true)} className="flex-none whitespace-nowrap">
            <Filter className="mr-2 h-4 w-4" />
            All Filters
            {(isAdmin && salespersonFilter !== "All") && (
              <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-black dark:bg-white" />
            )}
          </Button>
          {isAdmin && (
            <Button onClick={downloadLeadsCsv} variant="outline" disabled={filteredLeads.length === 0} className="flex-none whitespace-nowrap">
              <Download className="mr-2 h-4 w-4" />Download Leads
            </Button>
          )}
          <Button onClick={() => {
              setBulkImportResult(null);
              setDuplicateDetails([]);
              setShowAllDuplicates(false);
              setBulkImportFile(null);
              setAssignToEmployee(null);
              setImportProgress(0);
              setBulkImporting(false);
              setShowImportModal(true);
            }} variant="outline" className="flex-none whitespace-nowrap">
            <Upload className="mr-2 h-4 w-4" />Bulk Import
          </Button>
          <Button onClick={() => setShowAddLeadModal(true)} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" />Add Lead
          </Button>
          {selectedLeads.length > 0 && (
            <Button onClick={bulkDeleteLeads} variant="destructive" className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" />Delete Selected ({selectedLeads.length})
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

            {/* Salesperson — admin only */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Salesperson</label>
                <Select
                  value={salespersonFilter.toString()}
                  onValueChange={v => setSalespersonFilter(v === "All" ? "All" : parseInt(v))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="All Salespersons" />
                  </SelectTrigger>
                  <SelectContent position="popper" side="bottom" sideOffset={4} className="w-72 z-[60]">
                    <SelectItem value="All">All Salespersons</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="border-t border-gray-200 dark:border-slate-800 pt-6">
              <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-4">Quick Filters</p>
            </div>

            {/* Supplier */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Supplier</label>
              <Select
                value={supplierFilter.toString()}
                onValueChange={v => setSupplierFilter(v === "All" ? "All" : parseInt(v))}
              >
                <SelectTrigger className="w-full"><SelectValue placeholder="All Suppliers" /></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="w-72 z-[60]">
                  <SelectItem value="All">All Suppliers</SelectItem>
                  {suppliers.map(s => (
                    <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>{s.supplier_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">Status</label>
              <Select value={statusFilter.toString()} onValueChange={v => setStatusFilter(v)}>
                <SelectTrigger className="w-full"><SelectValue placeholder="All Status" /></SelectTrigger>
                <SelectContent position="popper" side="bottom" sideOffset={4} className="w-72 z-[60]">
                  <SelectItem value="All">All Status</SelectItem>
                  {STATUS_OPTIONS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Contract End Date */}
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

            {/* Usage Sort */}
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
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-slate-800 min-w-[1000px]">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    checked={selectedLeads.length === paginatedLeads.length && paginatedLeads.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-16 border-r-2 border-gray-300 dark:border-slate-700">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%]">
                  Client Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[11%]">
                  Trading Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[8%] overflow-hidden">
                  Tel No
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[8%] overflow-hidden">
                  Mobile No
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[10%]">
                  MPAN Top
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%]">
                  Supplier
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%] whitespace-nowrap">
                  Annual Usage
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%] whitespace-nowrap">
                  Start Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%] whitespace-nowrap">
                  Contract End
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[12%]">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[9%]">
                  Assigned To
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
              {isLoading ? (
                <tr><td colSpan={13} className="px-6 py-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600 dark:text-gray-400" />
                  <p className="mt-4 text-gray-500 dark:text-gray-400">Loading leads...</p>
                </td></tr>
              ) : error ? (
                <tr><td colSpan={13} className="px-6 py-12 text-center">
                  <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                  <p className="text-lg text-red-600 dark:text-red-400">Failed to load leads</p>
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">{error}</p>
                </td></tr>
              ) : paginatedLeads.length === 0 ? (
                <tr><td colSpan={13} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                  <Upload className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">No leads found.</p>
                  <p className="mt-2 text-sm">{searchTerm || statusFilter !== "All" ? "Try adjusting your filters." : "Use Bulk Import to add leads."}</p>
                </td></tr>
              ) : paginatedLeads.map(lead => {
                const isSelected = selectedLeads.includes(lead.opportunity_id);
                const fromSearch = isFromSearch(lead);
                const displayId = lead.display_order ?? lead.tenant_lead_id ?? lead.opportunity_id;
                return (
                  <tr key={lead.opportunity_id}
                    className={`hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                      isSelected 
                        ? "bg-blue-50 dark:bg-blue-950/40" 
                        : fromSearch 
                          ? "bg-amber-50 dark:bg-amber-950/30" 
                          : ""
                    }`}
                    onClick={() => window.open(`/dashboard/leads/${lead.opportunity_id}`, "_blank")}
                    onContextMenu={e => {
                      e.preventDefault();
                      const menu = document.createElement("div");
                      menu.className = "fixed bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md shadow-lg z-50 py-1";
                      menu.style.left = `${e.pageX}px`; menu.style.top = `${e.pageY}px`;
                      const del = document.createElement("button");
                      del.className = "w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2";
                      del.innerHTML = `<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete`;
                      del.onclick = () => { 
                        deleteLead(lead.opportunity_id);  
                        document.body.removeChild(menu); 
                      };
                      menu.appendChild(del); document.body.appendChild(menu);
                      const close = (ev: MouseEvent) => { if (!menu.contains(ev.target as Node)) { try { document.body.removeChild(menu); } catch {} document.removeEventListener("click", close); } };
                      setTimeout(() => document.addEventListener("click", close), 0);
                    }}>

                    {/* Checkbox */}
                    <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800 mt-1"
                        checked={isSelected}
                        onChange={() => handleSelectLead(lead.opportunity_id)}
                        disabled={fromSearch} />
                    </td>

                    {/* ID */}
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 border-r-2 border-gray-300 dark:border-slate-700 align-top">
                      <div className="flex items-center gap-1 whitespace-nowrap">
                        {displayId}
                        {fromSearch && <span title="From team search" className="inline-flex"><Info className="h-3 w-3 text-amber-600 dark:text-amber-400" /></span>}
                      </div>
                    </td>

                    {/* Client Name */}
                    <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 align-top overflow-hidden">
                      <div className="leading-tight">
                        <div className="whitespace-normal break-words">{lead.contact_person || "—"}</div>
                        {fromSearch && (
                          <Badge variant="outline" className="mt-1 text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                            {lead.assigned_to_name || "Other team"}
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Trading Name */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-100 align-top overflow-hidden">
                      <div className="leading-tight">
                        <div className="whitespace-normal break-words">{lead.business_name || "—"}</div>
                        {lead.is_cleansed && (
                          <Badge 
                            variant="outline" 
                            className="mt-1 text-xs bg-green-100 text-green-800 border-green-300 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800 whitespace-nowrap animate-pulse cursor-pointer hover:animate-none"
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await fetchWithAuth(`${CRM_PROXY}/leads/${lead.opportunity_id}`, {
                                  method: "PATCH",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ is_cleansed: false }),
                                });
                                setAllLeads(prev =>
                                  prev.map(l => l.opportunity_id === lead.opportunity_id ? { ...l, is_cleansed: false } : l)
                                );
                                toast.success("✅ Cleansed tag removed");
                              } catch {
                                toast.error("Failed to remove tag");
                              }
                            }}
                          >
                            CLEANSED
                          </Badge>
                        )}
                      </div>
                    </td>

                    {/* Tel No */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                      <div className="truncate max-w-[100px]" title={lead.tel_number ? String(lead.tel_number).replace(/\.0$/, "") : ""}>
                        {lead.tel_number ? String(lead.tel_number).replace(/\.0$/, "") : "—"}
                      </div>
                    </td>

                    {/* Mobile No */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                      <div className="truncate max-w-[100px]" title={lead.mobile_no ? String(lead.mobile_no).replace(/\.0$/, "") : ""}>
                        {lead.mobile_no ? String(lead.mobile_no).replace(/\.0$/, "") : "—"}
                      </div>
                    </td>

                    {/* MPAN Top */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                      <div className="truncate" title={lead.mpan_mpr || ""}>{lead.mpan_mpr || "—"}</div>
                    </td>

                    {/* Supplier */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                      <div className="truncate" title={lead.supplier_name || ""}>
                        {lead.supplier_name || getSupplierName(lead.supplier_id)}
                      </div>
                    </td>

                    {/* Annual Usage */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 text-right align-top">
                      <div className="whitespace-nowrap">{lead.annual_usage ? lead.annual_usage.toLocaleString() : "—"}</div>
                    </td>

                    {/* Start Date */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                      <div className="whitespace-nowrap">{formatDate(lead.start_date)}</div>
                    </td>

                    {/* Contract End */}
                    <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                      <div className="whitespace-nowrap">{formatDate(lead.end_date)}</div>
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={lead.stage_name || ""}
                        onValueChange={(value) => {
                          if (value === "CLEAR_STATUS") {
                            updateLeadStatus(lead.opportunity_id, "");
                          } else {
                            updateLeadStatus(lead.opportunity_id, value);
                          }
                        }}
                      >
                        <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                          <SelectValue placeholder="Set status">
                            {lead.stage_name ? (
                              <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(lead.stage_name)}`}>
                                {getStatusLabel(lead.stage_name)}
                              </span>
                            ) : (
                              <span className="text-gray-500 dark:text-gray-400">Set status</span>
                            )}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((option) => (
                            <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                          ))}
                          {lead.stage_name && (
                            <>
                              <div className="border-t border-gray-200 dark:border-slate-800 my-1"></div>
                              <SelectItem value="CLEAR_STATUS" className="text-red-600 dark:text-red-400 font-medium">✕ Clear Status</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </td>

                    {/* Assigned To */}
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
      <Dialog
        open={showImportModal}
        onOpenChange={(open) => {
          setShowImportModal(open);
          if (!open) {
            setBulkImportResult(null);
            setDuplicateDetails([]);
            setShowAllDuplicates(false);
            setBulkImportFile(null);
            setAssignToEmployee(null);
            setImportProgress(0);
            setBulkImporting(false);
          }
        }}
      >
        <DialogContent className="max-w-md w-[90vw] sm:w-full max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import Leads</DialogTitle>
            <DialogDescription>
              Upload an Excel or CSV file. Leads will be assigned to{" "}
              <strong>you</strong> by default unless you select someone
              else below.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* FILE */}
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                Select File (.xlsx, .xls, .csv)
              </label>
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={(e) =>
                  setBulkImportFile(e.target.files?.[0] || null)
                }
                className="block w-full text-sm border border-gray-300 dark:border-slate-700 dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-md p-2"
                disabled={bulkImporting}
              />
            </div>

            {/* ASSIGN */}
            {isAdmin && (
              <div>
                <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                  Assign To{" "}
                  <span className="text-gray-400 dark:text-gray-500 font-normal">
                    (optional — defaults to your account)
                  </span>
                </label>
                <Select
                  value={assignToEmployee?.toString() || "0"}
                  onValueChange={(v) =>
                    setAssignToEmployee(v === "0" ? null : Number(v))
                  }
                  disabled={bulkImporting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Assign to myself (default)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">
                      Assign to myself (default)
                    </SelectItem>
                    {employees.map((e) => (
                      <SelectItem
                        key={e.employee_id}
                        value={e.employee_id.toString()}
                      >
                        {e.employee_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* TEMPLATE */}
            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-md p-4">
              <h4 className="font-medium text-sm text-blue-900 dark:text-blue-200 mb-2">
                Download Template
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                Same format as the Renewals import template.
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                disabled={bulkImporting}
              >
                Download Template
              </Button>
            </div>

            {/* PROGRESS */}
            {bulkImporting && (
              <div className="border border-gray-200 dark:border-slate-800 rounded-md p-4 bg-gray-50 dark:bg-slate-800/50">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                    Importing Leads...
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">
                    {importProgress}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500"
                    style={{ width: `${importProgress}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Processing your file. Please wait...
                </p>
              </div>
            )}

            {/* RESULT */}
            {bulkImportResult && (
              <div
                className={`rounded-md p-4 border ${
                  bulkImportResult.success
                    ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-900 dark:text-green-200"
                    : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200"
                }`}
              >
                <h4 className="font-medium text-sm mb-2">
                  {bulkImportResult.success ? "Import Successful" : "Import Failed"}
                </h4>
                <p className="text-sm">
                  Imported:{" "}
                  <strong>{bulkImportResult.successful}</strong> leads
                </p>

                {bulkImportResult.duplicates != null && bulkImportResult.duplicates > 0 && (
                  <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                    Duplicates skipped:{" "}
                    <strong>{bulkImportResult.duplicates}</strong>
                  </p>
                )}

                {/* FIRST 5 DUPLICATES */}
                {duplicateDetails.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                      Duplicate Records
                    </p>
                    <div className="space-y-2">
                      {duplicateDetails.slice(0, 5).map((duplicate, index) => (
                        <div
                          key={index}
                          className="border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 rounded-md p-2 text-xs"
                        >
                          <div className="font-medium text-red-700 dark:text-red-300">
                            Row {duplicate.row}
                            {duplicate.company ? ` — ${duplicate.company}` : ""}
                          </div>
                          {duplicate.mpan && (
                            <div className="text-gray-600 dark:text-gray-400">
                              MPAN: {duplicate.mpan}
                            </div>
                          )}
                          {duplicate.action && (
                            <div className="text-red-600 dark:text-red-400">
                              {duplicate.action}
                            </div>
                          )}
                          {duplicate.assigned_to && (
                            <div className="text-gray-600 dark:text-gray-400">
                              Assigned to: {duplicate.assigned_to}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {duplicateDetails.length > 5 && (
                      <div className="flex justify-end mt-2">
                        <Button
                          variant="link"
                          size="sm"
                          className="text-red-600 dark:text-red-400 px-0"
                          onClick={() => setShowAllDuplicates(true)}
                        >
                          See More
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {bulkImportResult.assigned_to && (
                  <p className="text-sm text-green-700 dark:text-green-300 mt-2">
                    Assigned to: <strong>{bulkImportResult.assigned_to}</strong>
                  </p>
                )}

                {bulkImportResult.errors.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium">Errors:</p>
                    <ul className="list-disc list-inside text-xs mt-1 max-h-32 overflow-y-auto">
                      {bulkImportResult.errors.slice(0, 5).map((err, index) => (
                        <li key={index}>{err}</li>
                      ))}
                      {bulkImportResult.errors.length > 5 && (
                        <li>... and {bulkImportResult.errors.length - 5} more</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* BUTTONS */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setBulkImportFile(null);
                  setAssignToEmployee(null);
                  setBulkImportResult(null);
                  setDuplicateDetails([]);
                  setShowAllDuplicates(false);
                  setImportProgress(0);
                }}
                disabled={bulkImporting}
              >
                Close
              </Button>
              {!bulkImporting && !bulkImportResult?.success && (
                <Button onClick={handleBulkImport} disabled={!bulkImportFile}>
                  Import Leads
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showAllDuplicates} onOpenChange={setShowAllDuplicates}>
        <DialogContent className="max-w-lg w-[90vw] sm:w-full max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader className="shrink-0">
            <DialogTitle className="text-lg font-semibold text-red-600 dark:text-red-400">
              Duplicate Records
            </DialogTitle>
            <DialogDescription>
              {duplicateDetails.length} duplicate records were skipped during this import.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto pr-2 space-y-2">
            {duplicateDetails.map((duplicate, index) => (
              <div
                key={index}
                className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3 text-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      Row {duplicate.row} — {duplicate.company || "—"}
                    </p>
                    {duplicate.mpan && (
                      <p className="text-gray-600 dark:text-gray-400 mt-1">
                        MPAN: {duplicate.mpan}
                      </p>
                    )}
                    <p className="text-red-600 dark:text-red-400 mt-1">
                      {duplicate.action || "Duplicate - skipped"}
                    </p>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                      Assigned to: {duplicate.assigned_to || "Unassigned"}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end pt-3 border-t border-gray-200 dark:border-slate-800 shrink-0">
            <Button variant="outline" onClick={() => setShowAllDuplicates(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Callback Modal */}
      <Dialog open={showCallbackModal} onOpenChange={setShowCallbackModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{callbackStatus ? `Add ${callbackStatus}` : "Add Action"}</DialogTitle>
            <DialogDescription>Record lead interaction and set follow-up</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {callbackError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{callbackError}</AlertDescription></Alert>}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Status</label>
              <div className="p-2 bg-gray-50 dark:bg-slate-900 rounded border border-gray-200 dark:border-slate-800">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(callbackStatus)}`}>{getStatusLabel(callbackStatus)}</span>
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
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {callbackStatus === "Already Renewed" || callbackStatus === "Sold" ? "Action Date" : "Callback Date"}
                </label>
                <Input type="date" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} />
              </div>
            )}
            {(callbackStatus === "Already Renewed" || callbackStatus === "Sold") && renewedBy === "agent" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  Contract Start Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" value={newStartDate} onChange={e => setNewStartDate(e.target.value)} />
              </div>
            )}
            {statusConfig[callbackStatus]?.requiresNewEndDate && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">New Contract End Date {callbackStatus === "End Date Changed" ? "*" : ""}</label>
                <Input type="date" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
                <p className="text-xs text-gray-500 dark:text-gray-400">{callbackStatus === "Already Renewed" || callbackStatus === "Sold" ? "Update if the contract end date has changed" : "The contract end date will be updated to this new date"}</p>
              </div>
            )}
            {(callbackStatus === "Already Renewed" || callbackStatus === "Sold") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {callbackStatus === "Sold" ? "Sold By" : "Renewed By"} <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-2 p-3 border border-gray-200 dark:border-slate-800 rounded-lg bg-gray-50 dark:bg-slate-900">
                  {(callbackStatus === "Sold" ? (["supplier", "agent"] as const) : (["customer", "agent"] as const)).map(v => (
                    <label key={v} className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="renewedBy" value={v} checked={renewedBy === v} onChange={() => setRenewedBy(v)} className="w-4 h-4 accent-black dark:accent-white" />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">
                          {callbackStatus === "Sold" ? `Sold by ${v.charAt(0).toUpperCase() + v.slice(1)}` : `Renewed by ${v.charAt(0).toUpperCase() + v.slice(1)}`}
                        </span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {v === "agent" ? "Counts for agent commission" : callbackStatus === "Sold" ? "Sold directly by supplier" : "Customer renewed directly without agent"}
                        </p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            )}
            {(callbackStatus === "Already Renewed" || callbackStatus === "Sold") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">New Supplier (Optional)</label>
                <Input type="text" placeholder="Enter new supplier name" value={newSupplier} onChange={e => setNewSupplier(e.target.value)} />
              </div>
            )}
            {(callbackStatus === "Already Renewed" || callbackStatus === "Sold") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">New Address (Optional)</label>
                <Textarea placeholder="Enter new address if changed" value={newAddress} onChange={e => setNewAddress(e.target.value)} rows={2} />
              </div>
            )}

            {callbackStatus === "Converted" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  Assign To <span className="text-gray-500 dark:text-gray-400">(Optional)</span>
                </label>
                <Select 
                  value={assignToEmployeeId || "0"} 
                  onValueChange={setAssignToEmployeeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Keep current assignment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Keep current assignment</SelectItem>
                    {employees.map(e => (
                      <SelectItem key={e.employee_id} value={e.employee_id.toString()}>
                        {e.employee_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Optionally reassign this converted lead to another team member
                </p>
              </div>
            )}
            {statusConfig[callbackStatus]?.deletesRecord && (
              <Alert><AlertCircle className="h-4 w-4" /><AlertDescription><strong>Warning:</strong> This will move the record to the recycle bin.</AlertDescription></Alert>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-900 dark:text-slate-100">Notes {statusConfig[callbackStatus]?.requiresNotes && <span className="text-red-500">*</span>}</label>
              <Textarea placeholder={statusConfig[callbackStatus]?.requiresNotes ? "Enter required notes..." : "Add any additional notes..."} value={callbackNotes} onChange={e => setCallbackNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCallbackModal(false)} disabled={isSubmittingCallback}>Cancel</Button>
            <Button onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
              {isSubmittingCallback ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</> : (callbackStatus ? `Save ${callbackStatus}` : "Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full">
          <DialogHeader><DialogTitle>Assign Salesperson</DialogTitle><DialogDescription>Add an optional note about this assignment</DialogDescription></DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned To</label>
              <Select value={assignToEmployeeId} onValueChange={setAssignToEmployeeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Unassigned</SelectItem>
                  {employees.map(e => <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why is this being assigned?" value={assignmentNotes} onChange={e => setAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowAssignModal(false); setAssignToEmployeeId(""); setAssignmentNotes(""); setAssigningLeadId(null); }} disabled={isAssigning}>Cancel</Button>
            <Button onClick={handleAssignWithNotes} disabled={isAssigning}>
              {isAssigning ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</> : "Assign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Lead Modal */}
      <AddLeadModal
        isOpen={showAddLeadModal}
        onClose={() => setShowAddLeadModal(false)}
        onLeadCreated={() => {
          setShowAddLeadModal(false);
          fetchLeads();
        }}
        service={service}
        suppliers={suppliers}
        employees={employees}
      />

      {/* Bulk Assign Modal */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Bulk Assign Leads</DialogTitle>
            <DialogDescription>
              Assign leads from your selection to {bulkAssignEmployeeName}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">
                  {selectedLeads.length} lead{selectedLeads.length !== 1 ? "s" : ""} selected
                </span>
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">
                Assigning to: <strong>{bulkAssignEmployeeName}</strong>
              </div>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Number of Leads to Assign{" "}
                <span className="text-gray-400 dark:text-gray-500 font-normal">
                  (max {selectedLeads.length})
                </span>
              </label>
              <Input
                type="number"
                min={1}
                max={selectedLeads.length}
                className="mt-1"
                placeholder={`Enter a number (default: all ${selectedLeads.length})`}
                value={bulkAssignCount}
                onChange={e => {
                  const val = parseInt(e.target.value);
                  if (e.target.value === "") {
                    setBulkAssignCount("");
                  } else if (!isNaN(val) && val >= 1 && val <= selectedLeads.length) {
                    setBulkAssignCount(val);
                  }
                }}
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Leave blank to assign all selected leads.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Assignment Notes (Optional)
              </label>
              <Textarea
                className="mt-1"
                placeholder="Why are these being assigned?"
                value={bulkAssignmentNotes}
                onChange={e => setBulkAssignmentNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setShowBulkAssignModal(false);
                setBulkAssignmentNotes("");
                setBulkAssignEmployeeId(null);
                setBulkAssignEmployeeName("");
                setBulkAssignCount("");
              }}
              disabled={isBulkAssigning}
            >
              Cancel
            </Button>
            <Button onClick={handleBulkAssignWithNotes} disabled={isBulkAssigning}>
              {isBulkAssigning ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Assigning...
                </>
              ) : (
                `Assign ${bulkAssignCount || selectedLeads.length} Lead${(bulkAssignCount || selectedLeads.length) !== 1 ? "s" : ""}`
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}