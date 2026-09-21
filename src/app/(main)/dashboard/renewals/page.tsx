"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Plus, Edit, Trash2, ChevronDown, Filter, AlertCircle, 
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst, Zap, Building2, Upload, Users, UserCheck, Info, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar, X, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { BulkImportModal } from "@/components/ui/BulkImportModal";
import { useAuth } from "@/contexts/AuthContext";
import { canEditEntity, canBulkAssign } from "@/lib/permissions";
import { fetchWithAuth } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from 'react-hot-toast';
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { AddEnergyClientModal } from "@/components/ui/AddEnergyClientModal";

// ---------------- Constants ----------------
const CUSTOMERS_PER_PAGE = 25;
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// Status options for dropdown
const STATUS_OPTIONS = [
  { value: "Not Called", label: "Not Called" },
  { value: "Callback", label: "Callback" },
  // { value: "Called", label: "Called" },
  { value: "Not Answered", label: "Not Answered" },
  { value: "Dead", label: "Dead" },
  { value: "Priced", label: "Priced" },
  { value: "Sold", label: "Sold" },
  { value: "Already Renewed", label: "Already Renewed" },
  { value: "Renewed Directly", label: "Renewed Directly" },        
  { value: "Lost", label: "Lost" },
  { value: "Lost COT", label: "Lost COT" },
  { value: "Invalid Number", label: "Invalid Number" },
  { value: "Incorrect Supplier", label: "Incorrect Supplier" },
  { value: "Meter De-energised", label: "Meter De-energised" },
  { value: "Broker in Place", label: "Broker in Place" },
  { value: "End Date Changed", label: "End Date Changed" },     
  { value: "Complaint", label: "Complaint" },
  { value: "Email Only", label: "Email Only" },
  { value: "Duplicate", label: "Duplicate" },
];

// Status configuration
const statusConfig: Record<string, {
  requiresDate: boolean;
  requiresSold: boolean;
  deletesRecord: boolean;
  requiresNotes: boolean;
  requiresNewEndDate: boolean;
  requiresSupplierChange: boolean;
  requiresAddressChange: boolean;
}> = {
  "Callback": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  // "Called": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Answered": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Priced": { requiresDate: false, requiresSold: true, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Sold": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true, requiresSupplierChange: true, requiresAddressChange: true },
  "Lost": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Already Renewed": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true, requiresSupplierChange: true, requiresAddressChange: true },
  "Invalid Number": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Meter De-energised": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Broker in Place": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "End Date Changed": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true, requiresSupplierChange: false, requiresAddressChange: false },
  "Complaint": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Email Only": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Renewed Directly": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Incorrect Supplier": { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Called": { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Dead": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Duplicate": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false }
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
  email?: string;
  address?: string;
  site_address?: string;
  mpan_mpr?: string;
  mpan_top?: string;
  mpan_bottom?: string;
  supplier_id?: number;
  supplier_name?: string;
  annual_usage?: number;
  start_date?: string;
  end_date?: string;
  unit_rate?: number;
  status?: string;
  stage_id?: number;
  opportunity_id?: number;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  assignment_notes?: string;
  created_at: string;
  position?: string;
  company_number?: string;
  date_of_birth?: string;
  site_name?: string;
  month_sold?: string;
  house_name?: string;
  house_number?: string;
  old_supplier_name?: string;
  net_notch?: number;
  rate_2?: number;
  rate_3?: number;
  comms_paid?: number;
  charity_ltd_company_number?: string;
  partner_details?: string;
  home_door_number?: string;
  home_street?: string;
  home_post_code?: string;
  is_archived?: boolean;
  is_cleansed?: boolean;
}

interface Supplier {
  supplier_id: number;
  supplier_name: string;
  provisions: number;
  provisions_text: string;
}

interface Employee {
  employee_id: number;
  employee_name: string;
  email?: string;
}

interface Stage {
  stage_id: number;
  stage_name: string;
  stage_description?: string;
  preceding_stage_id?: number | null;
  stage_type?: string;
}

// ---------------- Utility functions ----------------
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return "—";
  }
};

const formatUsage = (usage: number | undefined): string => {
  if (!usage) return "—";
  return `${usage.toLocaleString()} kWh`;
};

const getStatusColor = (status: string | undefined): string => {
  if (!status) return "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300";
  const statusLower = status.toLowerCase();
  if (statusLower === 'called' || statusLower === 'priced' || statusLower === 'callback') {
    return "bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300";
  }
  if (statusLower === 'not answered') {
    return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300";
  }
  if (statusLower === 'lost' || statusLower === 'lost cot') {
    return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300";
  }
  if (statusLower === 'not called') {
    return "bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400";
  }
  if (statusLower === 'dead') {
    return "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200";
  }
  return "bg-gray-100 text-gray-800 dark:bg-slate-800 dark:text-slate-300";
};

const getStatusLabel = (status: string | undefined): string => {
  if (!status) return "—";
  const option = STATUS_OPTIONS.find(opt => opt.value === status);
  if (option) return option.label;
  const optionCaseInsensitive = STATUS_OPTIONS.find(
    opt => opt.value.toLowerCase() === status.toLowerCase()
  );
  return optionCaseInsensitive?.label || status;
};

const STATUS_TO_STAGE_FALLBACK: Record<string, number> = {
  'callback': 1,
  // 'called': 2,
  'not answered': 3,
  'priced': 4,
  'sold': 17,
  'lost': 5,
  'lost cot': 6,
  'already renewed': 7,
  'invalid number': 8,
  'meter de-energised': 9,
  'broker in place': 10,
  'end date changed': 11,
  'complaint': 12,
  'email only': 13,
  'renewed directly': 14,
  'incorrect supplier': 15,
  'not called': 16,
  'dead': 18,
};    

const getStageIdFromStatus = (status: string, stagesList?: Stage[]): number => {
  if (stagesList && stagesList.length > 0) {
    const match = stagesList.find(
      (s) => s.stage_name.toLowerCase() === status.toLowerCase()
    );
    if (match) return match.stage_id;
  }
  const stageId = STATUS_TO_STAGE_FALLBACK[status.toLowerCase()];
  if (!stageId) {
    console.warn(`⚠️ No stage_id found for status: ${status}, using 0`);
    return 0;
  }
  return stageId;
};

// ---------------- Component ----------------
export default function EnergyCustomersPage() {
  const [allCustomers, setAllCustomers] = useState<EnergyCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [searchTerm, setSearchTerm] = useState(() => sessionStorage.getItem('renewals_search') || "");
  const [supplierFilter, setSupplierFilter] = useState<number | "All">(() => {
    const saved = sessionStorage.getItem('renewals_supplier');
    return saved && saved !== "All" ? parseInt(saved) : "All";
  });
  const [statusFilter, setStatusFilter] = useState<string | "All">(() => sessionStorage.getItem('renewals_status') || "All");
  const [service, setService] = useState(() => sessionStorage.getItem('renewals_service') || "utilities");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [assignToEmployee, setAssignToEmployee] = useState<number | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<{
    success: boolean;
    successful: number;
    errors: string[];
    assigned_to?: string;
  } | null>(null);

  type DuplicateDetail = {
    row?: number;
    company?: string;
    client_name: string;
    company_name: string;
    mpan_top?: string;
    start_date?: string;
    end_date?: string;
    duplicate_type: "mpan" | "details";
    reason: string;
    assigned_to?: string;
  };

  const [duplicateDetails, setDuplicateDetails] = useState<DuplicateDetail[]>([]);
  const [showDuplicateResult, setShowDuplicateResult] = useState(false);
  const [showAllDuplicates, setShowAllDuplicates] = useState(false);

  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [bulkAssignEmployeeId, setBulkAssignEmployeeId] = useState<number | null>(null);
  const [bulkAssignEmployeeName, setBulkAssignEmployeeName] = useState("");
  const [bulkAssignmentNotes, setBulkAssignmentNotes] = useState("");
  const [isBulkAssigning, setIsBulkAssigning] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assigningCustomerId, setAssigningCustomerId] = useState<number | null>(null);
  const [assignToEmployeeId, setAssignToEmployeeId] = useState<string>("");
  const [assignmentNotes, setAssignmentNotes] = useState("");
  const [isAssigning, setIsAssigning] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<EnergyCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [employeeStats, setEmployeeStats] = useState<{
    employee_id: number;
    employee_name: string;
    count: number;
    max_display_id?: number;
  }[]>([]);

  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [selectedCustomerForCallback, setSelectedCustomerForCallback] = useState<number | null>(null);
  const [callbackStatus, setCallbackStatus] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackNotes, setCallbackNotes] = useState("");
  const [newStartDate, setNewStartDate] = useState("");
  const [newEndDate, setNewEndDate] = useState("");
  const [isSold, setIsSold] = useState<string>("");
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [callbackError, setCallbackError] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [usageSort, setUsageSort] = useState<"none" | "low-high" | "high-low">(() => (sessionStorage.getItem('renewals_usage_sort') as any) || "none");
  const [endDateFilter, setEndDateFilter] = useState<"all" | "expired" | "365" | "30" | "60" | "90" | "90+">(() => (sessionStorage.getItem('renewals_end_date') as any) || "all");
  const [performanceStats, setPerformanceStats] = useState({
    renewed: 0,
    in_progress: 0,
    not_contacted: 0,
    lost: 0,
    success_rate: 0,
    renewed_directly: 0,
    end_date_changed: 0,
    priced: 0,
    not_due: 0,
  });
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<'priced' | 'lost' | 'renewed' | 'in_progress' | 'not_contacted' | 'renewed_directly' | 'end_date_changed' | 'not_due' | null>(null);
  const [performanceFilteredCustomers, setPerformanceFilteredCustomers] = useState<EnergyCustomer[]>([]);
  const [calledDate, setCalledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [renewedBy, setRenewedBy] = useState<"customer" | "supplier" | "agent" | "">("");
  const [showFilterSidebar, setShowFilterSidebar] = useState(false);
  const [salespersonFilter, setSalespersonFilter] = useState<number | "All">(() => {
    const saved = sessionStorage.getItem('renewals_salesperson');
    return saved && saved !== "All" ? parseInt(saved) : "All";
  });
  const [performancePeriod, setPerformancePeriod] = useState<'daily' | 'weekly' | 'monthly' | 'alltime'>('alltime');

  const router = useRouter();
  const { user } = useAuth();

  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";

  const fetchPerformanceStats = async (period = performancePeriod) => {
    try {
      const response = await fetchWithAuth(
        `/energy-renewals/performance?use_current_user=true&service=${encodeURIComponent(service)}&period=${period}`
      );
      if (response && !response.error) {
        setPerformanceStats({
          renewed:          response.renewed_count          || 0,
          in_progress:      response.contacted_count        || 0,
          not_contacted:    response.not_contacted_count    || 0,
          lost:             response.lost_count             || 0,
          success_rate:     response.success_rate           || 0,
          renewed_directly: response.renewed_directly_count || 0,
          end_date_changed: response.end_date_changed_count || 0,
          priced:           response.priced_count           || 0,
          not_due:          response.not_due                || 0,
        });
      }
    } catch (err) {
      console.error("Error fetching performance stats:", err);
    }
  };

  useEffect(() => {
    fetchPerformanceStats(performancePeriod);
  }, [performancePeriod, service]);
  
  useEffect(() => {
    const loadPageData = async () => {
      await Promise.all([
        fetchCustomers(),
        fetchInitData(),
        fetchPerformanceStats(),
        ...(isAdmin ? [fetchEmployeeStats()] : []),
      ]);
    };

    loadPageData();
  }, [service, isAdmin]);

  useEffect(() => {
    fetchPerformanceStats(performancePeriod);
  }, [performancePeriod, service]);

  useEffect(() => {
    const handleFocus = () => fetchPerformanceStats(performancePeriod);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [performancePeriod, service]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, supplierFilter, statusFilter, usageSort, endDateFilter, salespersonFilter]);

  useEffect(() => {
    sessionStorage.setItem('renewals_search', searchTerm);
  }, [searchTerm]);

  useEffect(() => {
    sessionStorage.setItem('renewals_supplier', supplierFilter.toString());
  }, [supplierFilter]);

  useEffect(() => {
    sessionStorage.setItem('renewals_status', statusFilter.toString());
  }, [statusFilter]);

  useEffect(() => {
    sessionStorage.setItem('renewals_service', service);
  }, [service]);

  useEffect(() => {
    sessionStorage.setItem('renewals_usage_sort', usageSort);
  }, [usageSort]);

  useEffect(() => {
    sessionStorage.setItem('renewals_end_date', endDateFilter);
  }, [endDateFilter]);

  useEffect(() => {
    sessionStorage.setItem('renewals_salesperson', salespersonFilter.toString());
  }, [salespersonFilter]);

  // ---------------- Fetch Functions ----------------
  const fetchCustomers = async (showLoader = true) => {
    if (showLoader) {
      setIsLoading(true);
    }

    setError(null);

    try {
      const [activeResponse, archiveResponse] = await Promise.allSettled([
        fetchWithAuth(`/energy-clients?service=${encodeURIComponent(service)}`),
        fetchWithAuth(`/energy-clients/archives?service=${encodeURIComponent(service)}`),
      ]);

      const activeData: EnergyCustomer[] =
        activeResponse.status === "fulfilled"
          ? activeResponse.value?.data || (Array.isArray(activeResponse.value) ? activeResponse.value : [])
          : [];

      const archivedData: EnergyCustomer[] =
        archiveResponse.status === "fulfilled"
          ? Array.isArray(archiveResponse.value) ? archiveResponse.value : []
          : [];

      const seen = new Set<number>();
      const combined: EnergyCustomer[] = [];

      for (const c of activeData) {
        if (!seen.has(c.client_id)) { seen.add(c.client_id); combined.push(c); }
      }
      for (const c of archivedData) {
        if (!seen.has(c.client_id)) { seen.add(c.client_id); combined.push(c); }
      }

      setAllCustomers(combined);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setAllCustomers([]);
    } finally {
      if (showLoader) {
        setIsLoading(false);
      }
    }
  };

  const fetchInitData = async () => {
    try {
      const response = await fetchWithAuth("/energy-clients/init-data");
      if (response && !response.error) {
        setSuppliers(response.suppliers || []);
        setEmployees(response.employees || []);
        setStages(response.stages || []);
      }
    } catch (err) {
      console.error("❌ Error fetching init data:", err);
    }
  };

  const fetchEmployeeStats = async () => {
    try {
      const response = await fetchWithAuth(`/energy-clients/stats-by-employee?service=${encodeURIComponent(service)}`);
      const stats = Array.isArray(response.stats) ? response.stats : [];
      setEmployeeStats(stats.filter((stat: any) => stat.count > 0));
    } catch (err) {
      console.error("❌ Error fetching employee stats:", err);
      setEmployeeStats([]);
    }
  };

  useEffect(() => {
    const searchAllCustomers = async () => {
      if (!searchTerm || searchTerm.length < 2) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const response = await fetchWithAuth(
          `/energy-clients/search-all?q=${encodeURIComponent(searchTerm)}&service=${encodeURIComponent(service)}`
        );
        const results = Array.isArray(response) ? response : (response?.data || []);
        setSearchResults(results);
      } catch (err) {
        console.error("Search error:", err);
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    };

    const timeoutId = setTimeout(searchAllCustomers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, service, user]);

  const sortedCustomers = useMemo(() => {
    const customersToShow = searchTerm.trim() 
      ? allCustomers  
      : allCustomers.filter(c => !c.is_archived);
      
    if (searchTerm && searchResults.length > 0) {
      const assignedIds = new Set(customersToShow.map(c => c.client_id));
      const uniqueSearchResults = searchResults.filter(c => !assignedIds.has(c.client_id));
      return [...customersToShow, ...uniqueSearchResults].sort((a, b) => {
        return new Date(a.created_at || new Date()).getTime() - new Date(b.created_at || new Date()).getTime();
      });
    }
      
    return [...customersToShow].sort((a, b) => {
      return (a.display_order ?? 9999) - (b.display_order ?? 9999);
    });
  }, [allCustomers, searchResults, searchTerm, user]);

  const filteredCustomers = useMemo(() => {
    let filtered = sortedCustomers.filter((customer) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (customer.business_name || "").toLowerCase().includes(term) ||
        (customer.contact_person || "").toLowerCase().includes(term) ||
        (customer.email || "").toLowerCase().includes(term) ||
        (customer.phone || "").toLowerCase().includes(term) ||
        (customer.mpan_mpr || "").toLowerCase().includes(term);

      const matchesSupplier = supplierFilter === "All" || customer.supplier_id === supplierFilter;
      const matchesStatus = statusFilter === "All" || customer.status === statusFilter;

      let matchesEndDate = true;
      if (endDateFilter !== "all" && customer.end_date) {
        const today = new Date();
        const endDate = new Date(customer.end_date);
        const daysUntilEnd = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        switch (endDateFilter) {
          case "expired": matchesEndDate = daysUntilEnd < 0; break;
          case "365": matchesEndDate = daysUntilEnd >= 0 && daysUntilEnd <= 365; break;
          case "30": matchesEndDate = daysUntilEnd >= 0 && daysUntilEnd <= 30; break;
          case "60": matchesEndDate = daysUntilEnd > 30 && daysUntilEnd <= 60; break;
          case "90": matchesEndDate = daysUntilEnd > 60 && daysUntilEnd <= 90; break;
          case "90+": matchesEndDate = daysUntilEnd > 90 && daysUntilEnd <= 365; break;
        }
      }

      const matchesSalesperson = !isAdmin || salespersonFilter === "All" ||
        Number(customer.assigned_to_id) === Number(salespersonFilter);

      return matchesSearch && matchesSupplier && matchesStatus && matchesEndDate && matchesSalesperson;
    });

    if (usageSort !== "none") {
      filtered = [...filtered].sort((a, b) => {
        const aUsage = a.annual_usage || 0;
        const bUsage = b.annual_usage || 0;
        return usageSort === "low-high" ? aUsage - bUsage : bUsage - aUsage;
      });
    }

    return filtered;
  }, [sortedCustomers, searchTerm, supplierFilter, statusFilter, endDateFilter, usageSort, salespersonFilter]);

  const isFromSearch = (customer: EnergyCustomer) => {
    if (isAdmin) return false;
    return customer.assigned_to_id !== user?.id;
  };

  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(startIndex, startIndex + CUSTOMERS_PER_PAGE);
  }, [filteredCustomers, currentPage]);

  const isDateRequired = () => {
    if (!callbackStatus) return false;
    const config = statusConfig[callbackStatus];
    if (!config) return false;
    return config.requiresSold ? isSold === "yes" : config.requiresDate;
  };

  // ---------------- Update Status ----------------
  const updateCustomerStatus = async (customerId: number, newStatus: string) => {
    if (newStatus === "" || newStatus === "CLEAR_STATUS") {
      try {
        const response = await fetchWithAuth(`/energy-clients/${customerId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: null }),
        });
        if (!response || response.error) throw new Error(response?.error || "Failed to clear status");
        setAllCustomers((prev) =>
          prev.map((c) => c.client_id === customerId ? { ...c, status: undefined } : c)
        );
        toast.success("✅ Status cleared");
        return;
      } catch (err: any) {
        toast.error(err.message || "Failed to clear status");
        return;
      }
    }

    setSelectedCustomerForCallback(customerId);
    setCallbackStatus(newStatus);
    setCallbackDate("");
    setCallbackNotes("");
    setIsSold("");
    setNewStartDate("");
    setNewEndDate("");
    setNewSupplier("");
    setNewAddress("");
    setCalledDate(new Date().toISOString().split('T')[0]);
    setCallbackError("");
    setShowCallbackModal(true);
    setRenewedBy("");
  };

  const handleSubmitCallback = async () => {
    setCallbackError("");
    if (!callbackStatus || !selectedCustomerForCallback) {
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
      const payload: any = { status: callbackStatus, notes: callbackNotes };
      if (calledDate) payload.called_date = calledDate;
      if (isDateRequired() && callbackDate) payload.callback_date = callbackDate;
      if (config?.requiresSold) payload.is_sold = isSold === "yes";
      if (isRenewalOrSoldAction && newStartDate) payload.new_start_date = newStartDate;
      if (config?.requiresNewEndDate && newEndDate) payload.new_end_date = newEndDate;
      if (isRenewalOrSoldAction && renewedBy) payload.renewed_by = renewedBy;
      if (config?.requiresSupplierChange && newSupplier.trim()) payload.new_supplier = newSupplier.trim();
      if (config?.requiresAddressChange && newAddress.trim()) payload.new_address = newAddress.trim();

      const response = await fetchWithAuth(`/energy-clients/${selectedCustomerForCallback}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response || response.error) throw new Error(response?.error || "Failed to save callback");

      if (response.display_only || callbackStatus === "Dead") {
        await fetchCustomers();
        await fetchPerformanceStats();
        toast.success(`Status set to ${callbackStatus}`);
        setShowCallbackModal(false);
        setCallbackStatus("");
        setCallbackNotes("");
        return;
      }

      if (response.moved_to_cleansing) {
        setAllCustomers((prev) => prev.filter((c) => c.client_id !== selectedCustomerForCallback));
        setSelectedCustomers((prev) => prev.filter((id) => id !== selectedCustomerForCallback));
        toast.success("🧹 Moved to Cleansing");
        setShowCallbackModal(false);
      } else if (response.moved_to_recycle_bin) {
        setAllCustomers((prev) => prev.filter((c) => c.client_id !== selectedCustomerForCallback));
        setSelectedCustomers((prev) => prev.filter((id) => id !== selectedCustomerForCallback));
        toast.success("🗑️ Moved to recycle bin");
        setShowCallbackModal(false);
      } else if (response.moved_to_priced) {
        setAllCustomers((prev) => prev.filter((c) => c.client_id !== selectedCustomerForCallback));
        setSelectedCustomers((prev) => prev.filter((id) => id !== selectedCustomerForCallback));
        toast.success("✅ Moved to Priced page");
        setShowCallbackModal(false);
      } else {
        if (response.date_change && response.new_client_id) {
          setAllCustomers(prev => prev.filter(c => c.client_id !== selectedCustomerForCallback));
          setSelectedCustomers(prev => prev.filter(id => id !== selectedCustomerForCallback));
          await fetchCustomers();
          await fetchPerformanceStats();
          toast.success("✅ Contract dates updated — old record archived, new record created");
          setShowCallbackModal(false);
          return;
        }

        if (callbackStatus === "End Date Changed" || callbackStatus === "Already Renewed" || callbackStatus === "Sold") {
          if (isRenewalOrSoldAction && newSupplier.trim()) {
            setAllCustomers(prev =>
              prev.map(c =>
                c.client_id === selectedCustomerForCallback
                  ? { ...c, supplier_name: newSupplier.trim() }
                  : c
              )
            );
          }
          await fetchCustomers();
          await fetchPerformanceStats();
          toast.success(`✅ ${callbackStatus === "Already Renewed" ? "Customer information updated" : "Contract end date updated"}`);
        } else {
          const stageId = getStageIdFromStatus(callbackStatus, stages.length > 0 ? stages : undefined);
          setAllCustomers((prev) =>
            prev.map((c) =>
              c.client_id === selectedCustomerForCallback
                ? { ...c, status: callbackStatus, stage_id: stageId }
                : c
            )
          );
          toast.success(`✅ Callback saved successfully`);
        }
        setShowCallbackModal(false);
      }
    } catch (err: any) {
      setCallbackError(err.message || "Failed to save callback");
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  // ---------------- Update Assigned To ----------------
  const updateAssignedTo = async (customerId: number, employeeId: number) => {
    const isSelfAssignment = user?.id === employeeId;
    if (!isAdmin && !isSelfAssignment) {
      toast.error("You can only assign customers to yourself.");
      return;
    }
    try {
      await fetchWithAuth(`/energy-clients/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to_id: employeeId }),
      });
      const employee = employees.find((e) => e.employee_id === employeeId);
      setAllCustomers((prev) =>
        prev.map((c) =>
          c.client_id === customerId
            ? { ...c, assigned_to_id: employeeId, assigned_to_name: employee?.employee_name || undefined }
            : c
        )
      );
      toast.success(`✅ Assigned to ${employee?.employee_name || 'salesperson'}`);
    } catch (err) {
      toast.error("❌ Error updating assignment");
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
        const assignedToSelf = parseInt(assignToEmployeeId) === user?.employee_id;
        
        if (assignedToSelf) {
          setAllCustomers((prev) =>
            prev.map((c) =>
              c.client_id === assigningCustomerId
                ? {
                    ...c,
                    assigned_to_id: parseInt(assignToEmployeeId),
                    assigned_to_name: employees.find((e) => e.employee_id === parseInt(assignToEmployeeId))?.employee_name || null,
                    assignment_notes: assignmentNotes.trim() || undefined,
                  }
                : c
            )
          );
        } else {
          setAllCustomers((prev) => prev.filter((c) => c.client_id !== assigningCustomerId));
          setSelectedCustomers((prev) => prev.filter((id) => id !== assigningCustomerId));
        }
        
        toast.success("✅ Salesperson assigned successfully");
        setShowAssignModal(false);
        setAssignToEmployeeId("");
        setAssignmentNotes("");
        setAssigningCustomerId(null);
        
        if (isAdmin) fetchEmployeeStats();
      } else {
        toast.error(response?.error || "Failed to assign salesperson");
      }
    } catch (error) {
      console.error("Assignment error:", error);
      toast.error("Failed to assign salesperson");
    } finally {
      setIsAssigning(false);
    }
  };

  // ---------------- Delete Customer ----------------
  const deleteCustomer = async (clientId: number) => {
    if (!user) {
      alert("You don't have permission to delete clients.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this client and all related records?")) return;
    try {
      await fetchWithAuth(`/energy-clients/${clientId}`, { method: "DELETE" });
      setAllCustomers((prev) => prev.filter((c) => c.client_id !== clientId));
      setSelectedCustomers((prev) => prev.filter((id) => id !== clientId));
      if (paginatedCustomers.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting customer");
    }
  };

  // ---------------- Selection Handlers ----------------
  const handleSelectAll = () => {
    if (isSelectAllChecked) {
      setSelectedCustomers([]);
      setIsSelectAllChecked(false);
    } else {
      const allIds = filteredCustomers.map(c => c.client_id);
      setSelectedCustomers(allIds);
      setIsSelectAllChecked(true);
    }
  };

  const handleSelectCustomer = (clientId: number) => {
    setSelectedCustomers(prev => {
      const newSelection = prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId];
      setIsSelectAllChecked(newSelection.length === filteredCustomers.length);
      return newSelection;
    });
  };

  // Bulk assign
  const handleBulkAssignWithNotes = async () => {
    if (selectedCustomers.length === 0 || !bulkAssignEmployeeId) {
      toast.error("Please select customers and a salesperson");
      return;
    }
    setIsBulkAssigning(true);
    try {
      const payload: any = {
        client_ids: selectedCustomers,
        employee_id: bulkAssignEmployeeId,
      };
      if (bulkAssignmentNotes.trim()) payload.assignment_notes = bulkAssignmentNotes.trim();

      const response = await fetchWithAuth('/energy-clients/bulk-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (response.success) {
        setAllCustomers((prev) => prev.filter((c) => !selectedCustomers.includes(c.client_id)));
        
        setSelectedCustomers([]);
        setIsSelectAllChecked(false);
        setShowBulkAssignModal(false);
        setBulkAssignmentNotes("");
        
        toast.success(`✅ ${response.updated_count} clients assigned to ${response.employee_name}`);
        
        if (isAdmin) fetchEmployeeStats();
      }
    } catch (err) {
      console.error("Bulk assign error:", err);
      toast.error("❌ Error assigning customers");
    } finally {
      setIsBulkAssigning(false);
    }
  };

  // ---------------- Bulk Delete ----------------
  const bulkDeleteCustomers = async () => {
    if (!user) {
      alert("You don't have permission to delete clients.");
      return;
    }
    if (selectedCustomers.length === 0) {
      alert("Please select customers to delete");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedCustomers.length} client(s) and all related records?`)) {
      return;
    }
    try {
      const deletePromises = selectedCustomers.map(clientId =>
        fetchWithAuth(`/energy-clients/${clientId}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);

      setAllCustomers((prev) => prev.filter((c) => !selectedCustomers.includes(c.client_id)));
      setSelectedCustomers([]);
      setIsSelectAllChecked(false);

      const remainingCount = allCustomers.filter(c => !selectedCustomers.includes(c.client_id)).length;
      if (remainingCount === 0) {
        try {
          await fetchWithAuth('/energy-clients/reset-sequence', { method: 'POST' });
          toast.success('✅ Sequence reset successfully');
        } catch (resetErr) {
          console.error('⚠️ Error resetting sequence:', resetErr);
        }
      }
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast.error("Error deleting some customers");
    }
  };

  const deleteAllAndReset = async () => {
    if (!user) {
      alert("You don't have permission to delete clients.");
      return;
    }
    const customersToDelete = selectedCustomers.length > 0 
      ? allCustomers.filter(c => selectedCustomers.includes(c.client_id))
      : allCustomers;
      
    const totalCount = customersToDelete.length;
    if (totalCount === 0) { alert("No customers to delete"); return; }
      
    const confirmation = prompt(`⚠️ WARNING: This will DELETE ${totalCount} energy customer(s) and RESET the ID numbering.\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" to confirm:`);
    if (confirmation !== "DELETE ALL") { alert("Deletion cancelled."); return; }

    try {
      setIsLoading(true);
      const allClientIds = customersToDelete.map(c => c.client_id);
      toast.success(`🗑️ Deleting ${allClientIds.length} customers...`);

      await Promise.all(allClientIds.map(clientId =>
        fetchWithAuth(`/energy-clients/${clientId}`, { method: "DELETE" })
      ));

      await fetchWithAuth('/energy-clients/reset-sequence', { method: 'POST' });

      setAllCustomers([]);
      setSelectedCustomers([]);
      setIsSelectAllChecked(false);
      alert(`✅ Successfully deleted ${allClientIds.length} customers and reset ID numbering.`);
    } catch (err) {
      console.error("Delete all error:", err);
      alert("Error deleting customers");
    } finally {
      setIsLoading(false);
    }
  };

  const handleBulkImport = async () => {
    if (!bulkImportFile) {
      alert("Please select a file");
      return;
    }

    setBulkImporting(true);
    setImportProgress(0);
    setBulkImportResult(null);
    setDuplicateDetails([]);
    setShowAllDuplicates(false);

    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();

      formData.append("file", bulkImportFile);

      if (assignToEmployee) {
        formData.append(
          "assigned_employee_id",
          assignToEmployee.toString()
        );
      }

      const res = await fetch(
        `${API_BASE_URL}/import/energy-customers?service=${encodeURIComponent(service)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (!res.ok || !data.job_id) {
        setBulkImportResult({
          success: false,
          successful: 0,
          errors: [
            data.error || "Failed to start import",
          ],
        });

        toast.error(data.error || "Failed to start import");
        setBulkImporting(false);
        return;
      }

      const jobId = data.job_id;

      const poll = async (): Promise<void> => {
        return new Promise((resolve) => {
          const interval = setInterval(async () => {
            try {
              const statusRes = await fetch(
                `${API_BASE_URL}/import/status/${jobId}`,
                {
                  headers: {
                    Authorization: `Bearer ${token}`,
                  },
                }
              );

              const statusData = await statusRes.json();

              if (statusData.status === "done") {
                clearInterval(interval);
                setImportProgress(100);

                const duplicates: DuplicateDetail[] =
                  Array.isArray(statusData.duplicate_details)
                    ? statusData.duplicate_details
                    : [];

                setDuplicateDetails(duplicates);

                setBulkImportResult({
                  success: statusData.successful > 0,
                  successful: statusData.successful || 0,
                  errors: statusData.errors || [],
                });

                if (statusData.successful > 0) {
                  await fetchCustomers(false);

                  if (isAdmin) {
                    await fetchEmployeeStats();
                  }
                }

                setBulkImportFile(null);
                setAssignToEmployee(null);
                setBulkImporting(false);

                resolve();

              } else if (statusData.status === "failed") {
                clearInterval(interval);

                setBulkImportResult({
                  success: false,
                  successful: statusData.successful || 0,
                  errors:
                    statusData.errors?.length
                      ? statusData.errors
                      : ["Import failed"],
                });

                toast.error("Import failed");

                setBulkImporting(false);
                resolve();

              } else {
                const pct = Math.floor(
                  Number(statusData.progress_pct || 0)
                );

                setImportProgress(pct);
              }

            } catch (pollErr) {
              clearInterval(interval);

              setBulkImportResult({
                success: false,
                successful: 0,
                errors: ["Lost connection during import"],
              });

              toast.error("Connection error during import");

              setBulkImporting(false);
              resolve();
            }
          }, 100);
        });
      };

      await poll();

    } catch (error) {
      toast.error("Network error during import");

      setBulkImportResult({
        success: false,
        successful: 0,
        errors: ["Network error occurred"],
      });

      setBulkImporting(false);
    }
  };

  const downloadFileWithAuth = async (url: string, filename: string) => {
    const token = localStorage.getItem('auth_token');
    const tenantId = localStorage.getItem('tenant_id');
    if (!token) throw new Error('No authentication token found');
    const response = await fetch(url, {
      headers: { 'Authorization': `Bearer ${token}`, 'X-Tenant-ID': tenantId || '' },
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Download failed (${response.status})`);
    }
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(downloadUrl);
    document.body.removeChild(a);
  };

  const getSupplierName = (supplierId: number | undefined): string => {
    if (!supplierId) return "—";
    return suppliers.find(s => s.supplier_id === supplierId)?.supplier_name || "—";
  };

  const [performanceModalLoading, setPerformanceModalLoading] = useState(false);

  const handlePerformanceClick = async (type: 'renewed' | 'in_progress' | 'not_contacted' | 'lost' | 'renewed_directly' | 'end_date_changed' | 'priced' | 'not_due') => {
    setPerformanceFilter(type);
    setShowPerformanceModal(true);
    setPerformanceFilteredCustomers([]);
    setPerformanceModalLoading(true);

    try {
      const resp = await fetchWithAuth(
        `/energy-renewals/performance?use_current_user=true&service=${encodeURIComponent(service)}&return_records=true&stage_filter=${encodeURIComponent(type)}`
      );
      setPerformanceFilteredCustomers(resp?.records || []);
    } catch {
      toast.error("Failed to load customers");
      setPerformanceFilteredCustomers([]);
    } finally {
      setPerformanceModalLoading(false);
    }
  };
  
  const getPerformanceLabel = (type: string): string => {
    switch (type) {
      case 'renewed': return 'Renewed (Already Renewed)';
      case 'in_progress': return 'In Progress';
      case 'not_contacted': return 'Not Contacted';
      case 'lost': return 'Lost';
      case 'renewed_directly': return 'Renewed Directly';
      case 'end_date_changed': return 'End Date Changed';
      case 'priced': return 'Priced';
      case 'not_due': return 'Not Due (365+ Days)';
      default: return '';
    }
  };

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-3 px-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)}</span>{" "}
          of <span className="font-medium">{filteredCustomers.length}</span> clients
        </div>
        <div className="flex flex-wrap items-center justify-center space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center px-3 text-sm text-gray-700 dark:text-gray-300">Page {currentPage} of {totalPages}</div>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const downloadRenewalsCsv = () => {
    const escapeCsv = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const headers = [
      "ID",
      "Client Name",
      "Trading Name",
      "Phone",
      "Email",
      "MPAN/MPR",
      "Supplier",
      "Annual Usage",
      "Start Date",
      "End Date",
      "Status",
      "Assigned To",
    ];
    const rows = filteredCustomers.map((customer) => [
      customer.display_id ?? customer.display_order ?? customer.client_id,
      customer.contact_person,
      customer.business_name,
      customer.phone,
      customer.email,
      customer.mpan_top || customer.mpan_mpr,
      customer.supplier_name,
      customer.annual_usage,
      formatDate(customer.start_date),
      formatDate(customer.end_date),
      getStatusLabel(customer.status),
      customer.assigned_to_name,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsv).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `renewals-${service}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden p-4 sm:p-6 text-slate-900 dark:text-slate-100">
      <Toaster position="top-right" />
      <h1 className="mb-6 text-2xl sm:text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">Renewals</h1>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 p-1 shadow-sm backdrop-blur w-full sm:w-auto">
          <button type="button" onClick={() => setService("utilities")}
            className={`flex-1 sm:flex-initial px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-semibold transition-all ${
              service === "utilities" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow" 
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}>
            Utilities
          </button>
          <button type="button" onClick={() => setService("water")}
            className={`flex-1 sm:flex-initial px-6 sm:px-8 py-2.5 sm:py-3 rounded-full text-sm sm:text-base font-semibold transition-all ${
              service === "water" 
                ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 shadow" 
                : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}>
            Water
          </button>
        </div>
      </div>

      {isAdmin && employeeStats.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">Team Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {employeeStats.map((stat) => (
              <div key={stat.employee_id} className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-600 dark:text-blue-400 shrink-0" />
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 truncate">{stat.employee_name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900 dark:text-slate-100">{stat.count}</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">customer{stat.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/40 dark:to-indigo-950/40 border border-blue-200 dark:border-blue-900 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 dark:bg-blue-500 p-2 rounded-lg shrink-0"><Users className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-sm text-gray-600 dark:text-gray-400">Your Customers</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-slate-100">{allCustomers.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error Loading Clients</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
            <Button onClick={() => fetchCustomers()} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {selectedCustomers.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-600 dark:text-blue-400 shrink-0" />
              <div>
                <h3 className="font-semibold text-blue-900 dark:text-blue-200">{selectedCustomers.length} client(s) selected</h3>
                <p className="text-sm text-blue-700 dark:text-blue-400">Click on a salesperson to assign these clients</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedCustomers([]); setIsSelectAllChecked(false); }}>
              Clear Selection
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {employees.map((employee) => (
              <Button key={employee.employee_id} variant="outline" size="sm"
                className="hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:border-blue-400 dark:hover:border-blue-600"
                onClick={() => {
                  setBulkAssignEmployeeId(employee.employee_id);
                  setBulkAssignEmployeeName(employee.employee_name);
                  setBulkAssignmentNotes("");
                  setShowBulkAssignModal(true);
                }}>
                <Users className="h-4 w-4 mr-2" />
                Assign to {employee.employee_name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Performance Metrics */}
      <div className="mb-6">
        <div className="bg-white dark:bg-slate-900 rounded-lg border border-gray-200 dark:border-slate-800 p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-slate-100">Renewal Performance</h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">{isAdmin ? "Overall renewal success metrics" : "Your renewal success metrics"}</p>
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
            <div className="text-center p-4 sm:p-6 border rounded-lg bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-900/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('renewed')}>
              <div className="text-3xl sm:text-4xl font-bold text-green-700 dark:text-green-300">{performanceStats.renewed}</div>
              <div className="text-xs sm:text-sm text-green-600 dark:text-green-400 mt-2 font-medium">Renewed</div>
              <div className="mt-3"><CheckCircle2 className="h-6 w-6 text-green-600 dark:text-green-400 mx-auto" /></div>
            </div>
            <div className="text-center p-4 sm:p-6 border rounded-lg bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-900/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('in_progress')}>
              <div className="text-3xl sm:text-4xl font-bold text-blue-700 dark:text-blue-300">{performanceStats.in_progress}</div>
              <div className="text-xs sm:text-sm text-blue-600 dark:text-blue-400 mt-2 font-medium">In Progress</div>
              <div className="mt-3"><TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400 mx-auto" /></div>
            </div>
            <div className="text-center p-4 sm:p-6 border rounded-lg bg-teal-50 dark:bg-teal-950/30 border-teal-200 dark:border-teal-900/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('renewed_directly')}>
              <div className="text-3xl sm:text-4xl font-bold text-teal-700 dark:text-teal-300">{performanceStats.renewed_directly}</div>
              <div className="text-xs sm:text-sm text-teal-600 dark:text-teal-400 mt-2 font-medium">Renewed Directly</div>
              <div className="mt-3"><CheckCircle2 className="h-6 w-6 text-teal-600 dark:text-teal-400 mx-auto" /></div>
            </div>
            <div className="text-center p-4 sm:p-6 border rounded-lg bg-purple-50 dark:bg-purple-950/30 border-purple-200 dark:border-purple-900/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('end_date_changed')}>
              <div className="text-3xl sm:text-4xl font-bold text-purple-700 dark:text-purple-300">{performanceStats.end_date_changed}</div>
              <div className="text-xs sm:text-sm text-purple-600 dark:text-purple-400 mt-2 font-medium">End Date Changed</div>
              <div className="mt-3"><Calendar className="h-6 w-6 text-purple-600 dark:text-purple-400 mx-auto" /></div>
            </div>
            <div className="text-center p-4 sm:p-6 border rounded-lg bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-900/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('priced')}>
              <div className="text-3xl sm:text-4xl font-bold text-yellow-700 dark:text-yellow-300">{performanceStats.priced}</div>
              <div className="text-xs sm:text-sm text-yellow-600 dark:text-yellow-400 mt-2 font-medium">Priced</div>
              <div className="mt-3"><TrendingUp className="h-6 w-6 text-yellow-600 dark:text-yellow-400 mx-auto" /></div>
            </div>
            <div className="text-center p-4 sm:p-6 border rounded-lg bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-900/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('not_due')}>
              <div className="text-3xl sm:text-4xl font-bold text-cyan-700 dark:text-cyan-300">{performanceStats.not_due}</div>
              <div className="text-xs sm:text-sm text-cyan-600 dark:text-cyan-400 mt-2 font-medium">Not Due (365+)</div>
              <div className="mt-3"><Calendar className="h-6 w-6 text-cyan-600 dark:text-cyan-400 mx-auto" /></div>
            </div>
            <div className="text-center p-4 sm:p-6 border rounded-lg bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-900/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('not_contacted')}>
              <div className="text-3xl sm:text-4xl font-bold text-orange-700 dark:text-orange-300">{performanceStats.not_contacted}</div>
              <div className="text-xs sm:text-sm text-orange-600 dark:text-orange-400 mt-2 font-medium">Not Contacted</div>
              <div className="mt-3"><AlertTriangle className="h-6 w-6 text-orange-600 dark:text-orange-400 mx-auto" /></div>
            </div>
            <div className="text-center p-4 sm:p-6 border rounded-lg bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900/60 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('lost')}>
              <div className="text-3xl sm:text-4xl font-bold text-red-700 dark:text-red-300">{performanceStats.lost}</div>
              <div className="text-xs sm:text-sm text-red-600 dark:text-red-400 mt-2 font-medium">Lost</div>
              <div className="mt-3"><TrendingDown className="h-6 w-6 text-red-600 dark:text-red-400 mx-auto" /></div>
            </div>
          </div>
          <div className="mt-4 text-center border-t border-gray-200 dark:border-slate-800 pt-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Renewal success rate: <span className="font-semibold text-gray-900 dark:text-slate-100">{performanceStats.success_rate}%</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Modal */}
      <Dialog open={showPerformanceModal} onOpenChange={setShowPerformanceModal}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b border-gray-200 dark:border-slate-800 flex-shrink-0">
            <DialogTitle className="text-2xl font-bold text-gray-900 dark:text-slate-100">
              {performanceFilter ? getPerformanceLabel(performanceFilter) : 'Customers'}
            </DialogTitle>
            <DialogDescription>
              Showing {performanceFilteredCustomers.length} customer{performanceFilteredCustomers.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {performanceModalLoading ? (
              <div className="flex min-h-64 items-center justify-center text-slate-500 dark:text-slate-400">
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Loading customers...
              </div>
            ) : performanceFilteredCustomers.length === 0 ? (
              <div className="text-center py-16 text-gray-500 dark:text-gray-400">
                <p className="text-lg">No customers found in this category</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {performanceFilteredCustomers.map((customer) => (
                  <div key={customer.client_id}
                    className="p-4 sm:p-5 border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => { setShowPerformanceModal(false); window.open(`/dashboard/renewals/${customer.client_id}`, "_blank"); }}>
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <h3 className="text-base sm:text-lg font-bold text-gray-900 dark:text-slate-100 truncate">{customer.business_name}</h3>
                          {customer.status && (
                            <Badge variant="outline" className={`text-xs shrink-0 ${getStatusColor(customer.status)}`}>
                              {getStatusLabel(customer.status)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{customer.contact_person} · {customer.phone}</p>
                      </div>
                      <div className="text-left sm:text-right shrink-0">
                        {customer.annual_usage && <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">{formatUsage(customer.annual_usage)}</p>}
                        {customer.end_date && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">End: {formatDate(customer.end_date)}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-4 pt-3 border-t border-gray-100 dark:border-slate-800">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Supplier</p>
                        <p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{customer.supplier_name || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Status</p>
                        <p className="font-semibold text-sm text-gray-900 dark:text-slate-100 truncate">{customer.status || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 dark:text-gray-400 uppercase mb-1">Assigned To</p>
                        <p className="font-semibold text-sm text-purple-700 dark:text-purple-400 flex items-center gap-1 truncate">
                          <Users className="h-3 w-3 shrink-0" />
                          <span className="truncate">{customer.assigned_to_name || 'Unassigned'}</span>
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

      {/* Search and Filter Bar */}
      <div className="mb-6 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid min-w-0 grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
            <Search className="text-muted-foreground absolute left-2.5 top-2.5 h-4 w-4" />
            <Input
              placeholder="Search clients..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Supplier Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-w-0 justify-between w-full"
              >
                <Filter className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {supplierFilter === "All"
                    ? "All Suppliers"
                    : getSupplierName(supplierFilter as number)}
                </span>
                <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSupplierFilter("All")}>
                All Suppliers
              </DropdownMenuItem>
              {suppliers.map((supplier) => (
                <DropdownMenuItem
                  key={supplier.supplier_id}
                  onClick={() => setSupplierFilter(supplier.supplier_id)}
                >
                  {supplier.supplier_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Status Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="min-w-0 justify-between w-full"
              >
                <Filter className="mr-2 h-4 w-4 shrink-0" />
                <span className="truncate">
                  {statusFilter === "All"
                    ? "All Status"
                    : getStatusLabel(statusFilter as string)}
                </span>
                <ChevronDown className="ml-1 h-3 w-3 shrink-0 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("All")}>
                All Status
              </DropdownMenuItem>
              {STATUS_OPTIONS.map((status) => (
                <DropdownMenuItem
                  key={status.value}
                  onClick={() => setStatusFilter(status.value)}
                >
                  {status.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* All Contracts */}
          <Select
            value={endDateFilter}
            onValueChange={(value: any) => setEndDateFilter(value)}
          >
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contracts</SelectItem>
              <SelectItem value="365">Ending in 0-365 days</SelectItem>
              <SelectItem value="30">Ending in 30 days</SelectItem>
              <SelectItem value="60">Ending in 31-60 days</SelectItem>
              <SelectItem value="90">Ending in 61-90 days</SelectItem>
              <SelectItem value="90+">Ending in 90+ days</SelectItem>
              <SelectItem value="expired">Expired Contracts</SelectItem>
            </SelectContent>
          </Select>

          {/* Usage */}
          <Select
            value={usageSort}
            onValueChange={(value: any) => setUsageSort(value)}
          >
            <SelectTrigger className="w-full min-w-0"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Usage: Default</SelectItem>
              <SelectItem value="low-high">Usage: Low to High</SelectItem>
              <SelectItem value="high-low">Usage: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {/* All Filters */}
          <Button
            variant="outline"
            onClick={() => setShowFilterSidebar(true)}
            className="relative flex-none whitespace-nowrap"
          >
            <Filter className="mr-2 h-4 w-4" />
            All Filters
            {isAdmin && salespersonFilter !== "All" && (
              <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-black dark:bg-white" />
            )}
          </Button>

          {/* Download Renewals */}
          {isAdmin && (
            <Button
              onClick={downloadRenewalsCsv}
              variant="outline"
              disabled={filteredCustomers.length === 0}
              className="flex-none whitespace-nowrap"
            >
              <Download className="mr-2 h-4 w-4 shrink-0" />
              Download Renewals
            </Button>
          )}

          {/* Bulk Import */}
          <Button
            variant="outline"
            onClick={() => {
              setBulkImportResult(null);
              setDuplicateDetails([]);
              setShowAllDuplicates(false);
              setBulkImportFile(null);
              setAssignToEmployee(null);
              setImportProgress(0);
              setBulkImporting(false);
              setShowImportModal(true);
            }}
            className="flex-none whitespace-nowrap"
          >
            <Upload className="mr-2 h-4 w-4 shrink-0" />
            Bulk Import
          </Button>

          {/* Add Renewal */}
          <Button
            onClick={() => setShowCreateModal(true)}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4 shrink-0" />
            Add Renewal
          </Button>

          {/* Delete Selected */}
          {selectedCustomers.length > 0 && user && (
            <Button
              onClick={bulkDeleteCustomers}
              variant="destructive"
              className="w-full sm:w-auto"
            >
              <Trash2 className="mr-2 h-4 w-4 shrink-0" />
              Delete Selected ({selectedCustomers.length})
            </Button>
          )}
        </div>
      </div>

      {/* All Filters Sidebar */}
      {showFilterSidebar && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 z-40 bg-black/40 dark:bg-black/60"
            onClick={() => setShowFilterSidebar(false)}
          />

          {/* Sidebar */}
          <div className="fixed right-0 top-0 z-50 flex h-screen w-full sm:w-[420px] flex-col border-l border-border bg-background text-foreground shadow-2xl">
            {/* Header */}
            <div className="flex h-[64px] shrink-0 items-center justify-between border-b border-border px-6">
              <h2 className="text-lg font-semibold text-foreground">
                All Filters
              </h2>
              <button
                type="button"
                onClick={() => setShowFilterSidebar(false)}
                className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter Content */}
            <div className="flex-1 overflow-y-auto px-6 py-6">
              {/* Salesperson */}
              {isAdmin && (
                <div className="mb-6">
                  <label className="mb-2 block text-sm font-medium text-foreground">
                    Salesperson
                  </label>
                  <Select
                    value={salespersonFilter.toString()}
                    onValueChange={(value) =>
                      setSalespersonFilter(
                        value === "All" ? "All" : Number(value)
                      )
                    }
                  >
                    <SelectTrigger className="h-10 w-full border-border bg-background text-foreground">
                      <SelectValue placeholder="All Salespersons" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="All">
                        All Salespersons
                      </SelectItem>
                      {employees.map((employee) => (
                        <SelectItem
                          key={employee.employee_id}
                          value={employee.employee_id.toString()}
                        >
                          {employee.employee_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Divider */}
              <div className="mb-6 border-t border-border" />

              {/* Quick Filters */}
              <div className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Quick Filters
              </div>

              {/* Supplier */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Supplier
                </label>
                <Select
                  value={
                    supplierFilter === "All"
                      ? "All"
                      : String(supplierFilter)
                  }
                  onValueChange={(value) =>
                    setSupplierFilter(
                      value === "All" ? "All" : Number(value)
                    )
                  }
                >
                  <SelectTrigger className="h-10 w-full border-border bg-background text-foreground">
                    <SelectValue placeholder="All Suppliers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">
                      All Suppliers
                    </SelectItem>
                    {suppliers.map((supplier) => (
                      <SelectItem
                        key={supplier.supplier_id}
                        value={supplier.supplier_id.toString()}
                      >
                        {supplier.supplier_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Status */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Status
                </label>
                <Select
                  value={statusFilter}
                  onValueChange={(value) =>
                    setStatusFilter(value)
                  }
                >
                  <SelectTrigger className="h-10 w-full border-border bg-background text-foreground">
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="All">
                      All Status
                    </SelectItem>
                    {STATUS_OPTIONS.map((status) => (
                      <SelectItem
                        key={status.value}
                        value={status.value}
                      >
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Contract End Date */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Contract End Date
                </label>
                <Select
                  value={endDateFilter}
                  onValueChange={(value: any) =>
                    setEndDateFilter(value)
                  }
                >
                  <SelectTrigger className="h-10 w-full border-border bg-background text-foreground">
                    <SelectValue placeholder="All Contracts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      All Contracts
                    </SelectItem>
                    <SelectItem value="365">
                      Ending in 0-365 days
                    </SelectItem>
                    <SelectItem value="30">
                      Ending in 30 days
                    </SelectItem>
                    <SelectItem value="60">
                      Ending in 31-60 days
                    </SelectItem>
                    <SelectItem value="90">
                      Ending in 61-90 days
                    </SelectItem>
                    <SelectItem value="90+">
                      Ending in 90+ days
                    </SelectItem>
                    <SelectItem value="expired">
                      Expired Contracts
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Annual Usage Sort */}
              <div className="mb-6">
                <label className="mb-2 block text-sm font-medium text-foreground">
                  Annual Usage Sort
                </label>
                <Select
                  value={usageSort}
                  onValueChange={(value: any) =>
                    setUsageSort(value)
                  }
                >
                  <SelectTrigger className="h-10 w-full border-border bg-background text-foreground">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">
                      Default
                    </SelectItem>
                    <SelectItem value="low-high">
                      Low to High
                    </SelectItem>
                    <SelectItem value="high-low">
                      High to Low
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Footer */}
            <div className="flex shrink-0 gap-2 border-t border-border bg-background p-4">
              {/* Clear All */}
              <Button
                type="button"
                variant="outline"
                className="h-10 flex-1 border-border bg-muted text-foreground hover:bg-muted/80"
                onClick={() => {
                  setSalespersonFilter("All");
                  setSupplierFilter("All");
                  setStatusFilter("All");
                  setEndDateFilter("all");
                  setUsageSort("none");
                }}
              >
                Clear All
              </Button>

              {/* Done */}
              <Button
                type="button"
                className="h-10 flex-1"
                onClick={() => setShowFilterSidebar(false)}
              >
                Done
              </Button>
            </div>
          </div>
        </>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-[1200px] w-full divide-y divide-gray-200 dark:divide-slate-800 table-auto">
            <thead className="bg-gray-50 dark:bg-slate-800/50">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800"
                    checked={selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-16 border-r-2 border-gray-300 dark:border-slate-700">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase whitespace-nowrap">
                  Client Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[11%]">
                  Trading Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[8%]">
                  Tel No
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 dark:text-gray-400 uppercase w-[8%]">
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
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600 dark:text-gray-400"></div>
                    <p className="mt-4 text-gray-500 dark:text-gray-400">Loading renewals...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600 dark:text-red-400">Failed to load renewals</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <Zap className="h-12 w-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-lg text-gray-700 dark:text-gray-200 font-medium">No clients found.</p>
                    <p className="mt-2 text-sm">Create your first client to get started!</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => {
                  const isSelected = selectedCustomers.includes(customer.client_id);
                  const displayId = customer.display_order ?? customer.display_id ?? customer.id;
                  const fromSearch = isFromSearch(customer);
                  const isArchived = customer.is_archived === true;
                  
                  return (
                    <tr
                      key={customer.client_id}
                      className={`hover:bg-gray-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer ${
                        isSelected 
                          ? 'bg-blue-50 dark:bg-blue-950/40' : 
                        isArchived 
                          ? 'bg-gray-100 dark:bg-slate-800/50 opacity-60' : 
                        fromSearch 
                          ? 'bg-amber-50 dark:bg-amber-950/30' : ''
                      }`}
                      onClick={() => window.open(`/dashboard/renewals/${customer.client_id}`, "_blank")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const menu = document.createElement('div');
                        menu.className = 'fixed bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 rounded-md shadow-lg z-50 py-1';
                        menu.style.left = `${e.pageX}px`;
                        menu.style.top = `${e.pageY}px`;
                        
                        const editBtn = document.createElement('button');
                        editBtn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-700 dark:text-gray-200 flex items-center gap-2';
                        editBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit';
                        editBtn.onclick = () => { router.push(`/dashboard/renewals/${customer.client_id}/edit`); document.body.removeChild(menu); };
                        
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-red-50 dark:hover:bg-red-950/40 text-red-600 dark:text-red-400 flex items-center gap-2';
                        deleteBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete';
                        deleteBtn.onclick = () => { deleteCustomer(customer.client_id); document.body.removeChild(menu); };
                        
                        menu.appendChild(editBtn);
                        if (user) menu.appendChild(deleteBtn);
                        document.body.appendChild(menu);
                        
                        const closeMenu = (e: MouseEvent) => {
                          if (!menu.contains(e.target as Node)) { document.body.removeChild(menu); document.removeEventListener('click', closeMenu); }
                        };
                        setTimeout(() => document.addEventListener('click', closeMenu), 0);
                      }}
                    >
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800 mt-1"
                          checked={isSelected}
                          onChange={() => handleSelectCustomer(customer.client_id)}
                          disabled={fromSearch}
                        />
                      </td>

                      <td className="px-3 py-3 text-sm font-medium text-gray-900 dark:text-slate-100 border-r-2 border-gray-300 dark:border-slate-700 align-top">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          {displayId}
                          {fromSearch && (
                            <span title="From team search" className="inline-flex">
                              <Info className="h-3 w-3 text-amber-600 dark:text-amber-400" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-700 dark:text-gray-300 align-top overflow-hidden">
                        <div className="leading-tight">
                          <div className="whitespace-normal break-words">{customer.contact_person}</div>
                          {fromSearch && (
                            <Badge variant="outline" className="mt-1 text-xs bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800">
                              {customer.assigned_to_name || 'Other team'}
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-100 align-top overflow-hidden">
                        <div className="leading-tight">
                          <div className="whitespace-normal break-words">{customer.business_name}</div>
                          {customer.is_cleansed && (
                            <Badge 
                              variant="outline" 
                              className="mt-1 text-xs bg-green-100 text-green-800 border-green-300 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800 whitespace-nowrap animate-pulse cursor-pointer hover:animate-none"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await fetchWithAuth(`/energy-clients/${customer.client_id}`, {
                                    method: "PUT",
                                    headers: { "Content-Type": "application/json" },
                                    body: JSON.stringify({ is_cleansed: false }),
                                  });
                                  setAllCustomers(prev =>
                                    prev.map(c => c.client_id === customer.client_id ? { ...c, is_cleansed: false } : c)
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
                          {isArchived && (
                            <Badge variant="outline" className="mt-1 text-xs bg-gray-200 text-gray-600 border-gray-400 dark:bg-slate-800 dark:text-gray-400 dark:border-slate-700 whitespace-nowrap">
                              ARCHIVED
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                        <div className="whitespace-nowrap">
                          {customer.phone ? String(customer.phone).replace(/\.0$/, '') : '—'}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                        <div className="whitespace-nowrap">
                          {customer.mobile_no ? String(customer.mobile_no).replace(/\.0$/, '') : '—'}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                        <div className="truncate" title={customer.mpan_top || ""}>{customer.mpan_top || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top overflow-hidden">
                        <div className="truncate" title={customer.supplier_name || ""}>{customer.supplier_name || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 text-right align-top">
                        <div className="whitespace-nowrap">
                          {customer.annual_usage ? customer.annual_usage.toLocaleString() : "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.start_date)}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 dark:text-slate-200 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.end_date)}</div>
                      </td>

                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={customer.status || ""}
                          onValueChange={(value) => {
                            if (value === "CLEAR_STATUS") {
                              updateCustomerStatus(customer.client_id, "");
                            } else {
                              updateCustomerStatus(customer.client_id, value);
                            }
                          }}
                          disabled={isArchived}
                        >
                          <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                            <SelectValue placeholder="Not Called">
                              {customer.status ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(customer.status)}`}>
                                  {getStatusLabel(customer.status)}
                                </span>
                              ) : (
                                <span className="text-gray-500 dark:text-gray-400">Not Called</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                            {customer.status && (
                              <>
                                <div className="border-t border-gray-200 dark:border-slate-800 my-1"></div>
                                <SelectItem value="CLEAR_STATUS" className="text-red-600 dark:text-red-400 font-medium">✕ Clear Status</SelectItem>
                              </>
                            )}
                          </SelectContent>
                        </Select>
                      </td>

                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={customer.assigned_to_id?.toString() || "0"}
                          onValueChange={(value) => {
                            setAssigningCustomerId(customer.client_id);
                            setAssignToEmployeeId(value);
                            setShowAssignModal(true);
                          }}
                          disabled={isArchived}
                        >
                          <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                            <SelectValue placeholder="Assign">
                              {customer.assigned_to_name || "Unassigned"}
                            </SelectValue>
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

      {/* Bulk Import Modal */}
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
        <DialogContent className="max-w-2xl w-[90vw] sm:w-full max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Bulk Import Energy Customers</DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xlsx) with customer data.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                Select Excel File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) =>
                  setBulkImportFile(e.target.files?.[0] || null)
                }
                className="block w-full text-sm border border-gray-300 dark:border-slate-700 dark:bg-slate-800 text-gray-900 dark:text-slate-100 rounded-md p-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-900 dark:text-slate-100 mb-2">
                Assign To (Optional)
              </label>

              <Select
                value={assignToEmployee?.toString() || "0"}
                onValueChange={(value) =>
                  setAssignToEmployee(
                    value === "0" ? null : Number(value)
                  )
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Keep unassigned (Admin only)" />
                </SelectTrigger>

                <SelectContent>
                  <SelectItem value="0">
                    Keep unassigned (Admin only)
                  </SelectItem>

                  {employees.map((emp) => (
                    <SelectItem
                      key={emp.employee_id}
                      value={emp.employee_id.toString()}
                    >
                      {emp.employee_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-md p-4">
              <h4 className="font-medium text-sm text-blue-900 dark:text-blue-200 mb-2">
                📥 Download Template
              </h4>

              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await downloadFileWithAuth(
                      `${API_BASE_URL}/import/template`,
                      "energy_customers_template.xlsx"
                    );
                  } catch (error) {
                    alert(
                      error instanceof Error
                        ? error.message
                        : "Failed to download template"
                    );
                  }
                }}
              >
                Download Template
              </Button>
            </div>

            {!bulkImporting && !bulkImportResult && (
              <div className="flex justify-end">
                <Button
                  onClick={handleBulkImport}
                  disabled={!bulkImportFile}
                >
                  Import Customers
                </Button>
              </div>
            )}

            {bulkImporting && (
              <div className="py-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Importing renewals...
                  </span>

                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
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
                  Please wait while the renewals are being imported...
                </p>
              </div>
            )}

            {bulkImportResult && !bulkImporting && (
              <div
                className={`rounded-md p-4 border ${
                  bulkImportResult.success
                    ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-900 dark:text-green-200"
                    : "bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900 text-red-900 dark:text-red-200"
                }`}
              >
                <h4 className="font-medium text-sm mb-2">
                  {bulkImportResult.success
                    ? "✅ Import Successful"
                    : "❌ Import Failed"}
                </h4>

                <p className="text-sm">
                  Imported:{" "}
                  <strong>{bulkImportResult.successful}</strong>{" "}
                  customers
                </p>

                <p className="text-sm text-red-600 dark:text-red-400">
                  Duplicates skipped:{" "}
                  <strong>{duplicateDetails.length}</strong>
                </p>

                {bulkImportResult.success && duplicateDetails.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm font-medium text-red-600 dark:text-red-400 mb-2">
                      Duplicate Records
                    </p>

                    <div className="space-y-2">
                      {duplicateDetails.slice(0, 5).map((duplicate, index) => (
                        <div
                          key={index}
                          className="rounded-md border border-red-200 dark:border-red-900/60 bg-red-50/50 dark:bg-red-950/30 p-2 text-xs"
                        >
                          <p className="font-semibold text-red-600 dark:text-red-400">
                            Row {duplicate.row || "—"} {""}
                            {duplicate.company_name || duplicate.company || "—"}
                          </p>

                          {duplicate.mpan_top && (
                            <p className="text-gray-600 dark:text-gray-400">
                              MPAN: {duplicate.mpan_top}
                            </p>
                          )}

                          {duplicate.duplicate_type === "mpan" && (
                            <p className="text-red-600 dark:text-red-400">
                              Duplicate MPAN - skipped
                            </p>
                          )}

                          {duplicate.duplicate_type === "details" && (
                            <p className="text-red-600 dark:text-red-400">
                              Duplicate details - skipped
                            </p>
                          )}

                          <p className="text-gray-500 dark:text-gray-400">
                            Assigned to: {duplicate.assigned_to || "Unassigned"}
                          </p>
                        </div>
                      ))}
                    </div>

                    {duplicateDetails.length > 5 && (
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAllDuplicates(true)}
                          className="mt-2 text-sm text-red-600 dark:text-red-400 hover:underline"
                        >
                          See More
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {bulkImportResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Errors:</p>

                    <ul className="list-disc list-inside text-xs mt-1 max-h-32 overflow-y-auto">
                      {bulkImportResult.errors
                        .slice(0, 5)
                        .map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}

                      {bulkImportResult.errors.length > 5 && (
                        <li>
                          ... and{" "}
                          {bulkImportResult.errors.length - 5} more
                        </li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* All Duplicate Records Popup */}
      <Dialog
        open={showAllDuplicates}
        onOpenChange={setShowAllDuplicates}
      >
        <DialogContent className="max-w-2xl w-[90vw] sm:w-full p-0">
          <DialogHeader className="border-b border-gray-200 dark:border-slate-800 px-5 py-4">
            <DialogTitle className="text-red-600 dark:text-red-400">Duplicate Records</DialogTitle>
            <DialogDescription>
              {duplicateDetails.length} duplicate records found
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto px-4 py-3 space-y-2">
            {duplicateDetails.map((duplicate, index) => (
              <div
                key={index}
                className="rounded-md border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/40 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-800 dark:text-gray-200">
                      {duplicate.client_name || "—"}
                    </p>

                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {duplicate.company_name || "—"}
                    </p>
                  </div>

                  <span className="rounded bg-red-100 dark:bg-red-900/60 px-2 py-1 text-xs font-semibold text-red-700 dark:text-red-300">
                    {duplicate.duplicate_type === "mpan"
                      ? "MPAN Duplicate"
                      : "Details Duplicate"}
                  </span>
                </div>

                {duplicate.duplicate_type === "mpan" && (
                  <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="font-medium">MPAN:</span>{" "}
                    {duplicate.mpan_top || "—"}
                  </p>
                )}

                {duplicate.duplicate_type === "details" && (
                  <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <p>
                      <span className="font-medium">Start Date:</span>{" "}
                      {duplicate.start_date || "—"}
                    </p>

                    <p>
                      <span className="font-medium">End Date:</span>{" "}
                      {duplicate.end_date || "—"}
                    </p>
                  </div>
                )}

                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {duplicate.reason}
                </p>
              </div>
            ))}
          </div>

          <div className="flex justify-end border-t border-gray-200 dark:border-slate-800 px-5 py-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowAllDuplicates(false)}
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Callback Modal */}
      <Dialog
        open={showCallbackModal}
        onOpenChange={setShowCallbackModal}
      >
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
              <Input type="date" value={calledDate} onChange={(e) => setCalledDate(e.target.value)} />
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
                <Input type="date" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)} />
              </div>
            )}
            {(callbackStatus === "Already Renewed" || callbackStatus === "Sold") && renewedBy === "agent" && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  Contract Start Date <span className="text-red-500">*</span>
                </label>
                <Input type="date" value={newStartDate} onChange={(e) => setNewStartDate(e.target.value)} />
              </div>
            )}
            {statusConfig[callbackStatus]?.requiresNewEndDate && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">New Contract End Date {callbackStatus === "End Date Changed" ? "*" : ""}</label>
                <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {callbackStatus === "Already Renewed" || callbackStatus === "Sold" ? "Update if the contract end date has changed" : "The contract end date will be updated to this new date"}
                </p>
              </div>
            )}
            {(callbackStatus === "Already Renewed" || callbackStatus === "Sold") && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">
                  {callbackStatus === "Sold" ? "Sold By" : "Renewed By"} <span className="text-red-500">*</span>
                </label>
                <div className="flex flex-col gap-2 p-3 border border-gray-200 dark:border-slate-800 rounded-lg bg-gray-50 dark:bg-slate-900">
                  {callbackStatus === "Sold" ? (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="renewedBy" value="supplier" checked={renewedBy === "supplier"} onChange={() => setRenewedBy("supplier")} className="w-4 h-4 accent-black dark:accent-white" />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Sold by Supplier</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Sold directly by supplier</p>
                      </div>
                    </label>
                  ) : (
                    <label className="flex items-center gap-3 cursor-pointer">
                      <input type="radio" name="renewedBy" value="customer" checked={renewedBy === "customer"} onChange={() => setRenewedBy("customer")} className="w-4 h-4 accent-black dark:accent-white" />
                      <div>
                        <span className="text-sm font-medium text-gray-900 dark:text-slate-100">Renewed by Customer</span>
                        <p className="text-xs text-gray-500 dark:text-gray-400">Customer renewed directly without agent</p>
                      </div>
                    </label>
                  )}
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="renewedBy" value="agent" checked={renewedBy === "agent"} onChange={() => setRenewedBy("agent")} className="w-4 h-4 accent-black dark:accent-white" />
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-slate-100">{callbackStatus === "Sold" ? "Sold by Agent" : "Renewed by Agent"}</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{callbackStatus === "Sold" ? "Agent sold the contract" : "Agent successfully renewed the contract"}</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
            {statusConfig[callbackStatus]?.requiresSupplierChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">New Supplier (Optional)</label>
                <Input type="text" placeholder="Enter new supplier name" value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />
              </div>
            )}
            {statusConfig[callbackStatus]?.requiresAddressChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900 dark:text-slate-100">New Address (Optional)</label>
                <Textarea placeholder="Enter new address if changed" value={newAddress} onChange={(e) => setNewAddress(e.target.value)} rows={2} />
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
                placeholder={statusConfig[callbackStatus]?.requiresNotes ? "Enter required notes explaining the reason for this status..." : "Add any additional notes..."}
                value={callbackNotes}
                onChange={(e) => setCallbackNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCallbackModal(false)} disabled={isSubmittingCallback}>Cancel</Button>
            <Button onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
              {isSubmittingCallback ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (callbackStatus ? `Save ${callbackStatus}` : "Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Assign Salesperson</DialogTitle>
            <DialogDescription>Add an optional note about this assignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assigned To</label>
              <Select value={assignToEmployeeId} onValueChange={setAssignToEmployeeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Unassigned</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>{emp.employee_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why is this being assigned? Any specific instructions..." value={assignmentNotes} onChange={(e) => setAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowAssignModal(false); setAssignToEmployeeId(""); setAssignmentNotes(""); setAssigningCustomerId(null); }} disabled={isAssigning}>Cancel</Button>
            <Button onClick={handleAssignWithNotes} disabled={isAssigning}>
              {isAssigning ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</>) : "Assign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Modal */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full">
          <DialogHeader>
            <DialogTitle>Bulk Assign Customers</DialogTitle>
            <DialogDescription>Assign {selectedCustomers.length} customer(s) to {bulkAssignEmployeeName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-200">{selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected</span>
              </div>
              <div className="text-sm text-blue-700 dark:text-blue-300">Assigning to: <strong>{bulkAssignEmployeeName}</strong></div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why are these being assigned? Any specific instructions..." value={bulkAssignmentNotes} onChange={(e) => setBulkAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowBulkAssignModal(false); setBulkAssignmentNotes(""); setBulkAssignEmployeeId(null); setBulkAssignEmployeeName(""); }} disabled={isBulkAssigning}>Cancel</Button>
            <Button onClick={handleBulkAssignWithNotes} disabled={isBulkAssigning}>
              {isBulkAssigning ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</>) : `Assign ${selectedCustomers.length} Customer${selectedCustomers.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Energy Client Modal */}
      <AddEnergyClientModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => {
          setShowCreateModal(false);
          fetchCustomers();
          if (isAdmin) fetchEmployeeStats();
        }}
        service={service}
        suppliers={suppliers}
        employees={employees}
      />
    </div>
  );
}