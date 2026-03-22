"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Plus, Edit, Trash2, ChevronDown, Filter, AlertCircle, 
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst, Zap, Building2, Upload, Users, UserCheck, Info, Loader2, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Calendar,
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
  { value: "Callback", label: "Callback" },
  // { value: "Called", label: "Called" },
  { value: "Not Answered", label: "Not Answered" },
  { value: "Priced", label: "Priced" },
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
];

// ✅ Status configuration
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
  "Lost": { requiresDate: true, requiresSold: false, deletesRecord: true, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost COT": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Already Renewed": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true, requiresSupplierChange: true, requiresAddressChange: true },
  "Invalid Number": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Meter De-energised": { requiresDate: false, requiresSold: false, deletesRecord: true, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Broker in Place": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "End Date Changed": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true, requiresSupplierChange: false, requiresAddressChange: false },
  "Complaint": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Email Only": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Renewed Directly": { requiresDate: true, requiresSold: false, deletesRecord: false, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Incorrect Supplier": { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: true, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
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
  if (!status) return "bg-gray-100 text-gray-800";
  const statusLower = status.toLowerCase();
  if (statusLower === 'called' || statusLower === 'priced' || statusLower === 'callback') {
    return "bg-green-100 text-green-800";
  }
  if (statusLower === 'not answered') {
    return "bg-yellow-100 text-yellow-800";
  }
  if (statusLower === 'lost' || statusLower === 'lost cot') {
    return "bg-red-100 text-red-800";
  }
  return "bg-gray-100 text-gray-800";
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
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<number | "All">("All");
  const [statusFilter, setStatusFilter] = useState<string | "All">("All");
  const [service, setService] = useState("utilities");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [bulkImportFile, setBulkImportFile] = useState<File | null>(null);
  const [bulkImporting, setBulkImporting] = useState(false);
  const [assignToEmployee, setAssignToEmployee] = useState<number | null>(null);
  const [bulkImportResult, setBulkImportResult] = useState<{
    success: boolean;
    successful: number;
    errors: string[];
    assigned_to?: string;
  } | null>(null);
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
  // ✅ FIX: selectedCustomers now stores client_id values directly
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
  const [newEndDate, setNewEndDate] = useState("");
  const [isSold, setIsSold] = useState<string>("");
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [callbackError, setCallbackError] = useState("");
  const [newSupplier, setNewSupplier] = useState("");
  const [newAddress, setNewAddress] = useState("");
  const [usageSort, setUsageSort] = useState<"none" | "low-high" | "high-low">("none");
  const [endDateFilter, setEndDateFilter] = useState<"all" | "expired" | "30" | "60" | "90" | "90+">("all");
  const [performanceStats, setPerformanceStats] = useState({
    renewed: 0,
    in_progress: 0,
    not_contacted: 0,
    lost: 0,
    success_rate: 0,
    renewed_directly: 0,
    end_date_changed: 0,
    priced: 0,
  });
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceFilter, setPerformanceFilter] = useState<'renewed' | 'in_progress' | 'not_contacted' | 'lost' | 'renewed_directly' | 'end_date_changed' | 'priced' | null>(null);
  const [performanceFilteredCustomers, setPerformanceFilteredCustomers] = useState<EnergyCustomer[]>([]);
  const [calledDate, setCalledDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [renewedBy, setRenewedBy] = useState<"customer" | "agent" | "">("");

  const router = useRouter();
  const { user } = useAuth();

  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";

  const fetchPerformanceStats = async () => {
    try {
      const response = await fetchWithAuth(
        `/energy-renewals/performance?use_current_user=true&service=${encodeURIComponent(service)}`
      );
      if (response && !response.error) {
        setPerformanceStats({
          renewed: response.renewed_count || 0,
          in_progress: response.contacted_count || 0,
          not_contacted: response.not_contacted_count || 0,
          lost: response.lost_count || 0,
          success_rate: response.success_rate || 0,
          renewed_directly: response.renewed_directly_count || 0,
          end_date_changed: response.end_date_changed_count || 0,
          priced: response.priced_count || 0,
        });
      }
    } catch (err) {
      console.error("Error fetching performance stats:", err);
    }
  };

  useEffect(() => {
    fetchCustomers();
    fetchSuppliers();
    fetchEmployees();
    fetchStages();
    fetchPerformanceStats();
    if (isAdmin) {
      fetchEmployeeStats();
    }
  }, [service, isAdmin]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, supplierFilter, statusFilter, usageSort, endDateFilter]);

  // ---------------- Fetch Functions ----------------
  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`/energy-clients?service=${encodeURIComponent(service)}`);
      const activeData = Array.isArray(response) ? response : (response?.data || []);
      
      let archivedData: EnergyCustomer[] = [];
      try {
        const archiveResponse = await fetchWithAuth(`/energy-clients/archives?service=${encodeURIComponent(service)}`);
        archivedData = Array.isArray(archiveResponse) ? archiveResponse : [];
      } catch (archiveErr) {
        console.log('No archived records available');
      }
      
      setAllCustomers([...activeData, ...archivedData]);
    } catch (err) {
      console.error("❌ Error fetching clients:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setAllCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const response = await fetchWithAuth("/suppliers");
      const data = Array.isArray(response) ? response : (response?.data || []);
      setSuppliers(data);
    } catch (err) {
      console.error("❌ Error fetching suppliers:", err);
      setSuppliers([]);
    }
  };

  const fetchEmployees = async () => {
    try {
      const employeesBody = await fetchWithAuth("/employees");
      const employeesList = Array.isArray(employeesBody.data)
        ? employeesBody.data
        : Array.isArray(employeesBody)
        ? employeesBody
        : [];
      setEmployees(employeesList);
    } catch (err) {
      console.error("❌ Error fetching employees:", err);
    }
  };

  const fetchStages = async () => {
    try {
      const response = await fetchWithAuth("/stages");
      const stagesList = Array.isArray(response) ? response : (response?.data || []);
      setStages(stagesList);
    } catch (err) {
      console.error("❌ Error fetching stages:", err);
      setStages([]);
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
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
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
          case "30": matchesEndDate = daysUntilEnd >= 0 && daysUntilEnd <= 30; break;
          case "60": matchesEndDate = daysUntilEnd > 30 && daysUntilEnd <= 60; break;
          case "90": matchesEndDate = daysUntilEnd > 60 && daysUntilEnd <= 90; break;
          case "90+": matchesEndDate = daysUntilEnd > 90 && daysUntilEnd <= 365; break;
        }
      }

      return matchesSearch && matchesSupplier && matchesStatus && matchesEndDate;
    });

    if (usageSort !== "none") {
      filtered = [...filtered].sort((a, b) => {
        const aUsage = a.annual_usage || 0;
        const bUsage = b.annual_usage || 0;
        return usageSort === "low-high" ? aUsage - bUsage : bUsage - aUsage;
      });
    }

    return filtered;
  }, [sortedCustomers, searchTerm, supplierFilter, statusFilter, endDateFilter, usageSort]);

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
    if (config.requiresSold) return isSold === "yes";
    return config.requiresDate;
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
    if (callbackStatus === "Already Renewed" && !renewedBy) {
      setCallbackError("Please select if renewed by customer or agent");
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
      if (config?.requiresNewEndDate && newEndDate) payload.new_end_date = newEndDate;
      if (callbackStatus === "Already Renewed" && renewedBy) payload.renewed_by = renewedBy;
      if (config?.requiresSupplierChange && newSupplier.trim()) payload.new_supplier = newSupplier.trim();
      if (config?.requiresAddressChange && newAddress.trim()) payload.new_address = newAddress.trim();

      const response = await fetchWithAuth(`/energy-clients/${selectedCustomerForCallback}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response || response.error) throw new Error(response?.error || "Failed to save callback");

      if (response.moved_to_cleansing) {
        // Invalid Number or Incorrect Supplier → goes to Cleansing page
        setAllCustomers((prev) => prev.filter((c) => c.client_id !== selectedCustomerForCallback));
        setSelectedCustomers((prev) => prev.filter((id) => id !== selectedCustomerForCallback));
        toast.success("🧹 Moved to Cleansing");
        setShowCallbackModal(false);
      } else if (response.moved_to_recycle_bin) {
        // Lost, Lost COT, Meter De-energised → recycle bin
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
        if (callbackStatus === "End Date Changed" || callbackStatus === "Already Renewed") {
          // ✅ Optimistically update supplier on list before refetch
          if (callbackStatus === "Already Renewed" && newSupplier.trim()) {
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
        if (isAdmin) {
          setAllCustomers((prev) =>
            prev.map((c) =>
              c.client_id === assigningCustomerId
                ? {
                    ...c,
                    assigned_to_id: assignToEmployeeId === "0" ? null : parseInt(assignToEmployeeId),
                    assigned_to_name: assignToEmployeeId === "0"
                      ? null
                      : employees.find((e) => e.employee_id === parseInt(assignToEmployeeId))?.employee_name || null,
                    assignment_notes: assignmentNotes.trim() || undefined,
                  }
                : c
            )
          );
        } else {
          setAllCustomers((prev) => prev.filter((c) => c.client_id !== assigningCustomerId));
        }
        toast.success("✅ Salesperson assigned successfully");
        setShowAssignModal(false);
        setAssignToEmployeeId("");
        setAssignmentNotes("");
        setAssigningCustomerId(null);
      } else {
        toast.error(response?.error || "Failed to assign salesperson");
      }
    } catch (error) {
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
      // ✅ FIX: filter by client_id
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
  // ✅ FIX: handleSelectAll now uses client_id
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

  // ✅ FIX: handleSelectCustomer now uses client_id
  const handleSelectCustomer = (clientId: number) => {
    setSelectedCustomers(prev => {
      const newSelection = prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId];
      setIsSelectAllChecked(newSelection.length === filteredCustomers.length);
      return newSelection;
    });
  };

  // ✅ Bulk assign
  const handleBulkAssignWithNotes = async () => {
    if (selectedCustomers.length === 0 || !bulkAssignEmployeeId) {
      toast.error("Please select customers and a salesperson");
      return;
    }
    setIsBulkAssigning(true);
    try {
      // ✅ FIX: selectedCustomers already contains client_ids directly
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
        toast.success(`✅ ${response.updated_count} clients assigned to ${response.employee_name}`);
        if (!isAdmin) {
          setAllCustomers((prev) => prev.filter((c) => !selectedCustomers.includes(c.client_id)));
        } else {
          setAllCustomers((prev) => 
            prev.map((c) => 
              selectedCustomers.includes(c.client_id)
                ? {
                    ...c,
                    assigned_to_id: bulkAssignEmployeeId,
                    assigned_to_name: bulkAssignEmployeeName,
                    assignment_notes: bulkAssignmentNotes.trim() || undefined,
                  }
                : c
            )
          );
        }
        setSelectedCustomers([]);
        setIsSelectAllChecked(false);
        setShowBulkAssignModal(false);
        setBulkAssignmentNotes("");
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
      // ✅ FIX: selectedCustomers already contains client_ids directly
      const deletePromises = selectedCustomers.map(clientId =>
        fetchWithAuth(`/energy-clients/${clientId}`, { method: "DELETE" })
      );
      await Promise.all(deletePromises);

      // ✅ FIX: filter by client_id
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

      toast.success(`✅ Successfully deleted ${selectedCustomers.length} client(s)`);
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
    // ✅ FIX: filter by client_id
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
    if (!bulkImportFile) { alert("Please select a file"); return; }
    setBulkImporting(true);
    setBulkImportResult(null);
    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();
      formData.append('file', bulkImportFile);
      if (assignToEmployee) formData.append('assigned_employee_id', assignToEmployee.toString());

      const res = await fetch(
        `${API_BASE_URL}/import/energy-customers?service=${encodeURIComponent(service)}`,
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData }
      );
      const data = await res.json();

      if (res.ok && data.success) {
        setBulkImportResult({ success: true, successful: data.successful, errors: data.errors || [], assigned_to: data.assigned_to });
        toast.success(`✅ Imported ${data.successful} customers successfully!`);
        await fetchCustomers();
        if (isAdmin) await fetchEmployeeStats();
        setBulkImportFile(null);
        setAssignToEmployee(null);
      } else {
        setBulkImportResult({ success: false, successful: data.successful || 0, errors: data.errors || [data.error || 'Import failed'] });
        toast.error(data.error || 'Import failed');
      }
    } catch (error) {
      toast.error("Network error during import");
      setBulkImportResult({ success: false, successful: 0, errors: ['Network error occurred'] });
    } finally {
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

  const handlePerformanceClick = async (type: 'renewed' | 'in_progress' | 'not_contacted' | 'lost' | 'renewed_directly' | 'end_date_changed' | 'priced') => {
    setPerformanceFilter(type);
    try {
      const response = await fetchWithAuth(`/energy-renewals?use_current_user=true&service=${encodeURIComponent(service)}`);
      if (response && Array.isArray(response)) {
        let filtered: EnergyCustomer[] = [];
        switch (type) {
          case 'renewed':
            filtered = response.filter(c => {
              const s = (c.status || '').toLowerCase();
              return s === 'priced' || s === 'renewed' || s === 'already renewed' || s === 'end date changed';
            });
            break;
          case 'in_progress':
            filtered = response.filter(c => {
              const s = (c.status || '').toLowerCase();
              return s === 'called' || s === 'callback' || s === 'contacted';
            });
            break;
          case 'not_contacted':
            filtered = response.filter(c => {
              const s = (c.status || '').toLowerCase();
              const hasNoStatus = !c.status || s === '' || s === 'none' || s === 'pending';
              return hasNoStatus || s === 'not answered' || s === 'not contacted';
            });
            break;
          case 'lost':
            filtered = response.filter(c => {
              const s = (c.status || '').toLowerCase();
              return s === 'lost' || s === 'lost cot';
            });
            break;
          case 'renewed_directly':
            filtered = response.filter(c => (c.status || '').toLowerCase() === 'renewed directly');
            break;
          case 'end_date_changed':
            filtered = response.filter(c => (c.status || '').toLowerCase() === 'end date changed');
            break;
          case 'priced':
            filtered = response.filter(c => (c.status || '').toLowerCase() === 'priced');
            break;
        }
        setPerformanceFilteredCustomers(filtered);
        setShowPerformanceModal(true);
      } else {
        toast.error("Failed to load customers");
      }
    } catch (err) {
      console.error("❌ Error fetching performance customers:", err);
      toast.error("Failed to load customers");
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
      default: return '';
    }
  };

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)}</span>{" "}
          of <span className="font-medium">{filteredCustomers.length}</span> clients
        </div>
        <div className="flex space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center px-3 text-sm text-gray-700">Page {currentPage} of {totalPages}</div>
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

  return (
    <div className="w-full p-6">
      <Toaster position="top-right" />
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">Renewals</h1>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur">
          <button type="button" onClick={() => setService("utilities")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${service === "utilities" ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
            Utilities
          </button>
          <button type="button" onClick={() => setService("water")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${service === "water" ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"}`}>
            Water
          </button>
        </div>
      </div>

      {isAdmin && employeeStats.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Team Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {employeeStats.map((stat) => (
              <div key={stat.employee_id} className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-500 truncate">{stat.employee_name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">{stat.count}</span>
                  <span className="text-xs text-gray-500">customer{stat.count !== 1 ? 's' : ''}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!isAdmin && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg"><Users className="h-5 w-5 text-white" /></div>
              <div>
                <p className="text-sm text-gray-600">Your Customers</p>
                <p className="text-2xl font-bold text-gray-900">{allCustomers.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Clients</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button onClick={fetchCustomers} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {selectedCustomers.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">{selectedCustomers.length} client(s) selected</h3>
                <p className="text-sm text-blue-700">Click on a salesperson to assign these clients</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedCustomers([]); setIsSelectAllChecked(false); }}>
              Clear Selection
            </Button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {employees.map((employee) => (
              <Button key={employee.employee_id} variant="outline" size="sm"
                className="hover:bg-blue-100 hover:border-blue-400"
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
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Renewal Performance</h2>
            <p className="text-sm text-gray-600">{isAdmin ? "Overall renewal success metrics" : "Your renewal success metrics"}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-7 gap-7">
            <div className="text-center p-6 border rounded-lg bg-green-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('renewed')}>
              <div className="text-4xl font-bold text-green-700">{performanceStats.renewed}</div>
              <div className="text-sm text-green-600 mt-2 font-medium">Renewed</div>
              <div className="mt-3"><CheckCircle2 className="h-6 w-6 text-green-600 mx-auto" /></div>
            </div>
            <div className="text-center p-6 border rounded-lg bg-blue-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('in_progress')}>
              <div className="text-4xl font-bold text-blue-700">{performanceStats.in_progress}</div>
              <div className="text-sm text-blue-600 mt-2 font-medium">In Progress</div>
              <div className="mt-3"><TrendingUp className="h-6 w-6 text-blue-600 mx-auto" /></div>
            </div>
            <div className="text-center p-6 border rounded-lg bg-teal-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('renewed_directly')}>
              <div className="text-4xl font-bold text-teal-700">{performanceStats.renewed_directly}</div>
              <div className="text-sm text-teal-600 mt-2 font-medium">Renewed Directly</div>
              <div className="mt-3"><CheckCircle2 className="h-6 w-6 text-teal-600 mx-auto" /></div>
            </div>
            <div className="text-center p-6 border rounded-lg bg-purple-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('end_date_changed')}>
              <div className="text-4xl font-bold text-purple-700">{performanceStats.end_date_changed}</div>
              <div className="text-sm text-purple-600 mt-2 font-medium">End Date Changed</div>
              <div className="mt-3"><Calendar className="h-6 w-6 text-purple-600 mx-auto" /></div>
            </div>
            <div className="text-center p-6 border rounded-lg bg-yellow-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('priced')}>
              <div className="text-4xl font-bold text-yellow-700">{performanceStats.priced}</div>
              <div className="text-sm text-yellow-600 mt-2 font-medium">Priced</div>
              <div className="mt-3"><TrendingUp className="h-6 w-6 text-yellow-600 mx-auto" /></div>
            </div>
            <div className="text-center p-6 border rounded-lg bg-orange-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('not_contacted')}>
              <div className="text-4xl font-bold text-orange-700">{performanceStats.not_contacted}</div>
              <div className="text-sm text-orange-600 mt-2 font-medium">Not Contacted</div>
              <div className="mt-3"><AlertTriangle className="h-6 w-6 text-orange-600 mx-auto" /></div>
            </div>
            <div className="text-center p-6 border rounded-lg bg-red-50 cursor-pointer hover:shadow-md transition-shadow" onClick={() => handlePerformanceClick('lost')}>
              <div className="text-4xl font-bold text-red-700">{performanceStats.lost}</div>
              <div className="text-sm text-red-600 mt-2 font-medium">Lost</div>
              <div className="mt-3"><TrendingDown className="h-6 w-6 text-red-600 mx-auto" /></div>
            </div>
          </div>
          <div className="mt-4 text-center border-t pt-4">
            <div className="text-sm text-gray-600">
              Renewal success rate: <span className="font-semibold text-gray-900">{performanceStats.success_rate}%</span>
            </div>
          </div>
        </div>
      </div>
      
      {/* Performance Modal */}
      <Dialog open={showPerformanceModal} onOpenChange={setShowPerformanceModal}>
        <DialogContent className="max-w-[95vw] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader className="pb-4 border-b flex-shrink-0">
            <DialogTitle className="text-2xl font-bold">
              {performanceFilter ? getPerformanceLabel(performanceFilter) : 'Customers'}
            </DialogTitle>
            <DialogDescription>
              Showing {performanceFilteredCustomers.length} customer{performanceFilteredCustomers.length !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
            {performanceFilteredCustomers.length === 0 ? (
              <div className="text-center py-16 text-gray-500">
                <p className="text-lg">No customers found in this category</p>
              </div>
            ) : (
              <div className="space-y-3 py-4">
                {performanceFilteredCustomers.map((customer) => (
                  <div key={customer.client_id}
                    className="p-5 border rounded-xl hover:bg-gray-50 hover:shadow-sm cursor-pointer transition-all"
                    onClick={() => { setShowPerformanceModal(false); window.open(`/dashboard/renewals/${customer.client_id}`, "_blank"); }}>
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="text-lg font-bold text-gray-900 truncate">{customer.business_name}</h3>
                          {customer.status && (
                            <Badge variant="outline" className={`text-xs flex-shrink-0 ${getStatusColor(customer.status)}`}>
                              {getStatusLabel(customer.status)}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{customer.contact_person} · {customer.phone}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {customer.annual_usage && <p className="text-sm font-semibold text-gray-700">{formatUsage(customer.annual_usage)}</p>}
                        {customer.end_date && <p className="text-xs text-gray-500 mt-1">End: {formatDate(customer.end_date)}</p>}
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-4 pt-3 border-t border-gray-100">
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">Supplier</p>
                        <p className="font-semibold text-sm text-gray-900 truncate">{customer.supplier_name || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">MPAN</p>
                        <p className="font-semibold text-sm text-gray-900 font-mono truncate">{customer.mpan_mpr || customer.mpan_bottom || '—'}</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">Annual Usage</p>
                        <p className="font-semibold text-sm text-gray-900 truncate">{customer.annual_usage?.toLocaleString() || '—'} kWh</p>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-500 uppercase mb-1">Assigned To</p>
                        <p className="font-semibold text-sm text-purple-700 flex items-center gap-1 truncate">
                          <Users className="h-3 w-3 flex-shrink-0" />
                          <span className="truncate">{customer.assigned_to_name || 'Unassigned'}</span>
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

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input placeholder="Search clients..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
            {isSearching && (
              <div className="absolute right-2 top-2.5">
                <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full"></div>
              </div>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {supplierFilter === "All" ? "All Suppliers" : getSupplierName(supplierFilter as number)}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSupplierFilter("All")}>All Suppliers</DropdownMenuItem>
              {suppliers.map(supplier => (
                <DropdownMenuItem key={supplier.supplier_id} onClick={() => setSupplierFilter(supplier.supplier_id)}>
                  {supplier.supplier_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {statusFilter === "All" ? "All Status" : getStatusLabel(statusFilter as string)}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("All")}>All Status</DropdownMenuItem>
              {STATUS_OPTIONS.map(status => (
                <DropdownMenuItem key={status.value} onClick={() => setStatusFilter(status.value)}>
                  {status.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <Select value={endDateFilter} onValueChange={(value: any) => setEndDateFilter(value)}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Contracts</SelectItem>
              <SelectItem value="30">Ending in 30 days</SelectItem>
              <SelectItem value="60">Ending in 31-60 days</SelectItem>
              <SelectItem value="90">Ending in 61-90 days</SelectItem>
              <SelectItem value="90+">Ending in 90+ days</SelectItem>
              <SelectItem value="expired">Expired Contracts</SelectItem>
            </SelectContent>
          </Select>

          <Select value={usageSort} onValueChange={(value: any) => setUsageSort(value)}>
            <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Usage: Default</SelectItem>
              <SelectItem value="low-high">Usage: Low to High</SelectItem>
              <SelectItem value="high-low">Usage: High to Low</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 items-center">
          <Button onClick={() => setShowImportModal(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Energy Client
          </Button>
          {selectedCustomers.length > 0 && user && (
            <Button onClick={bulkDeleteCustomers} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedCustomers.length})
            </Button>
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
                  {/* ✅ FIX: checked state uses client_id based selection */}
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-10 border-r-2 border-gray-300">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                  Client Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[11%]">
                  Trading Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[8%]">
                  Tel No
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[8%]">
                  Mobile No
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[10%]">
                  MPAN Top
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                  Supplier
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                  Annual Usage
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                  Start Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                  Contract End
                </th>
                <th className="px-3 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase w-[12%]">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                  Assigned To
                </th>
                {/* ✅ REMOVED: Notes column */}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
                    <p className="mt-4 text-gray-500">Loading renewals...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600">Failed to load renewals</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-lg">No clients found.</p>
                    <p className="mt-2 text-sm">Create your first client to get started!</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => {
                  // ✅ FIX: isSelected now checks client_id
                  const isSelected = selectedCustomers.includes(customer.client_id);
                  const displayId = customer.display_order || customer.display_id || customer.id;
                  const fromSearch = isFromSearch(customer);
                  const isArchived = customer.is_archived === true;
                  
                  return (
                    <tr
                      key={customer.client_id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50' : 
                        isArchived ? 'bg-gray-100 opacity-60' : 
                        fromSearch ? 'bg-amber-50' : ''
                      }`}
                      onClick={() => window.open(`/dashboard/renewals/${customer.client_id}`, "_blank")}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const menu = document.createElement('div');
                        menu.className = 'fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 py-1';
                        menu.style.left = `${e.pageX}px`;
                        menu.style.top = `${e.pageY}px`;
                        
                        const editBtn = document.createElement('button');
                        editBtn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2';
                        editBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit';
                        editBtn.onclick = () => { router.push(`/dashboard/renewals/${customer.client_id}/edit`); document.body.removeChild(menu); };
                        
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2';
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
                        {/* ✅ FIX: onChange uses client_id, checked uses client_id */}
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 mt-1"
                          checked={isSelected}
                          onChange={() => handleSelectCustomer(customer.client_id)}
                          disabled={fromSearch}
                        />
                      </td>

                      <td className="px-2 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                        <div className="flex items-center gap-1">
                          {displayId}
                          {fromSearch && (
                            <span title="From team search" className="inline-flex">
                              <Info className="h-3 w-3 text-amber-600" />
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-700 align-top overflow-hidden">
                        <div className="leading-tight">
                          <div className="whitespace-normal break-words">{customer.contact_person}</div>
                          {fromSearch && (
                            <Badge variant="outline" className="mt-1 text-xs bg-amber-100 text-amber-800 border-amber-300">
                              {customer.assigned_to_name || 'Other team'}
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                        <div className="leading-tight">
                          <div className="whitespace-normal break-words">{customer.business_name}</div>
                          {isArchived && (
                            <Badge variant="outline" className="mt-1 text-xs bg-gray-200 text-gray-600 border-gray-400 whitespace-nowrap">
                              ARCHIVED
                            </Badge>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">
                          {customer.phone ? String(customer.phone).replace(/\.0$/, '') : '—'}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">
                          {customer.mobile_no ? String(customer.mobile_no).replace(/\.0$/, '') : '—'}
                        </div>
                      </td>

                      {/* ✅ REMOVED: MPAN Bottom cell */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                        <div className="truncate" title={customer.mpan_top || ""}>{customer.mpan_top || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                        <div className="truncate" title={customer.supplier_name || ""}>{customer.supplier_name || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">
                          {customer.annual_usage ? customer.annual_usage.toLocaleString() : "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.start_date)}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
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
                            <SelectValue placeholder="Set status">
                              {customer.status ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(customer.status)}`}>
                                  {getStatusLabel(customer.status)}
                                </span>
                              ) : (
                                <span className="text-gray-500">Set status</span>
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                            ))}
                            {customer.status && (
                              <>
                                <div className="border-t my-1"></div>
                                <SelectItem value="CLEAR_STATUS" className="text-red-600 font-medium">✕ Clear Status</SelectItem>
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
                      {/* ✅ REMOVED: Notes cell */}
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
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Energy Customers</DialogTitle>
            <DialogDescription>Upload an Excel file (.xlsx) with customer data.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Excel File</label>
              <input type="file" accept=".xlsx,.xls" onChange={(e) => setBulkImportFile(e.target.files?.[0] || null)} className="block w-full text-sm border rounded-md p-2" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Assign To (Optional)</label>
              <Select value={assignToEmployee?.toString() || "0"} onValueChange={(value) => setAssignToEmployee(value === "0" ? null : Number(value))}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Keep unassigned (Admin only)" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Keep unassigned (Admin only)</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>{emp.employee_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="font-medium text-sm mb-2">📥 Download Template</h4>
              <Button variant="outline" size="sm" onClick={async () => {
                try {
                  await downloadFileWithAuth(`${API_BASE_URL}/import/template`, 'energy_customers_template.xlsx');
                } catch (error) {
                  alert(error instanceof Error ? error.message : 'Failed to download template');
                }
              }}>
                Download Template
              </Button>
            </div>
            {bulkImportResult && (
              <div className={`rounded-md p-4 ${bulkImportResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"}`}>
                <h4 className="font-medium text-sm mb-2">{bulkImportResult.success ? "✅ Import Successful" : "❌ Import Failed"}</h4>
                <p className="text-sm">Imported: <strong>{bulkImportResult.successful}</strong> customers</p>
                {bulkImportResult.assigned_to && <p className="text-sm text-green-700 mt-1">✅ Assigned to: <strong>{bulkImportResult.assigned_to}</strong></p>}
                {bulkImportResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Errors:</p>
                    <ul className="list-disc list-inside text-xs mt-1">
                      {bulkImportResult.errors.slice(0, 5).map((err, idx) => <li key={idx}>{err}</li>)}
                      {bulkImportResult.errors.length > 5 && <li>... and {bulkImportResult.errors.length - 5} more errors</li>}
                    </ul>
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => { setShowImportModal(false); setBulkImportFile(null); setAssignToEmployee(null); setBulkImportResult(null); }}>Cancel</Button>
              <Button onClick={handleBulkImport} disabled={!bulkImportFile || bulkImporting}>
                {bulkImporting ? (<><div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>Importing...</>) : "Import Customers"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Energy Client Modal */}
      <AddEnergyClientModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onClientCreated={fetchCustomers}
        service={service}
        suppliers={suppliers}
        employees={employees}
      />

      {/* Callback Modal */}
      <Dialog open={showCallbackModal} onOpenChange={setShowCallbackModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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
              <label className="text-sm font-medium">Status</label>
              <div className="p-2 bg-gray-50 rounded border">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(callbackStatus)}`}>
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
                <Input type="date" value={callbackDate} onChange={(e) => setCallbackDate(e.target.value)} />
              </div>
            )}
            {statusConfig[callbackStatus]?.requiresNewEndDate && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Contract End Date {callbackStatus === "End Date Changed" ? "*" : ""}</label>
                <Input type="date" value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} />
                <p className="text-xs text-gray-500">
                  {callbackStatus === "Already Renewed" ? "Optional: Update if the contract end date has changed" : "The contract end date will be updated to this new date"}
                </p>
              </div>
            )}
            {callbackStatus === "Already Renewed" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Renewed By <span className="text-red-500">*</span></label>
                <div className="flex flex-col gap-2 p-3 border rounded-lg bg-gray-50">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="renewedBy" value="customer" checked={renewedBy === "customer"} onChange={() => setRenewedBy("customer")} className="w-4 h-4 accent-black" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Renewed by Customer</span>
                      <p className="text-xs text-gray-500">Customer renewed directly without agent</p>
                    </div>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="renewedBy" value="agent" checked={renewedBy === "agent"} onChange={() => setRenewedBy("agent")} className="w-4 h-4 accent-black" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">Renewed by Agent</span>
                      <p className="text-xs text-gray-500">Agent successfully renewed the contract</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
            {statusConfig[callbackStatus]?.requiresSupplierChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Supplier (Optional)</label>
                <Input type="text" placeholder="Enter new supplier name" value={newSupplier} onChange={(e) => setNewSupplier(e.target.value)} />
              </div>
            )}
            {statusConfig[callbackStatus]?.requiresAddressChange && (
              <div className="space-y-2">
                <label className="text-sm font-medium">New Address (Optional)</label>
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
              <label className="text-sm font-medium">
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowCallbackModal(false)} disabled={isSubmittingCallback}>Cancel</Button>
            <Button onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
              {isSubmittingCallback ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>) : (callbackStatus ? `Save ${callbackStatus}` : "Save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Modal */}
      <Dialog open={showAssignModal} onOpenChange={setShowAssignModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Salesperson</DialogTitle>
            <DialogDescription>Add an optional note about this assignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Assigned To</label>
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
              <label className="text-sm font-medium text-gray-700">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why is this being assigned? Any specific instructions..." value={assignmentNotes} onChange={(e) => setAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowAssignModal(false); setAssignToEmployeeId(""); setAssignmentNotes(""); setAssigningCustomerId(null); }} disabled={isAssigning}>Cancel</Button>
            <Button onClick={handleAssignWithNotes} disabled={isAssigning}>
              {isAssigning ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</>) : "Assign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Bulk Assign Modal */}
      <Dialog open={showBulkAssignModal} onOpenChange={setShowBulkAssignModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Bulk Assign Customers</DialogTitle>
            <DialogDescription>Assign {selectedCustomers.length} customer(s) to {bulkAssignEmployeeName}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <UserCheck className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-900">{selectedCustomers.length} customer{selectedCustomers.length !== 1 ? 's' : ''} selected</span>
              </div>
              <div className="text-sm text-blue-700">Assigning to: <strong>{bulkAssignEmployeeName}</strong></div>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why are these being assigned? Any specific instructions..." value={bulkAssignmentNotes} onChange={(e) => setBulkAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowBulkAssignModal(false); setBulkAssignmentNotes(""); setBulkAssignEmployeeId(null); setBulkAssignEmployeeName(""); }} disabled={isBulkAssigning}>Cancel</Button>
            <Button onClick={handleBulkAssignWithNotes} disabled={isBulkAssigning}>
              {isBulkAssigning ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</>) : `Assign ${selectedCustomers.length} Customer${selectedCustomers.length !== 1 ? 's' : ''}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}