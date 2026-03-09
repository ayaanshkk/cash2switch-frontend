"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Plus, Edit, Trash2, ChevronDown, Filter, AlertCircle, 
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst, Zap, Building2, Upload, Users, UserCheck, Info
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
// import { useTaskProgress } from '@/hooks/useTaskProgress';
// import { ProgressDialog } from '@/components/ui/ProgressDialog';

// ---------------- Constants ----------------
const CUSTOMERS_PER_PAGE = 25;
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// Status options for dropdown
const STATUS_OPTIONS = [
  { value: "called", label: "Called" },
  { value: "not_answered", label: "Not Answered" },
  { value: "priced", label: "Priced" },
  { value: "lost", label: "Lost" },
  { value: "lost_cot", label: "Lost - COT" },
  { value: "already_renewed_cb_next_year", label: "Already Renewed - CB Next Year" },
  { value: "invalid_number_need_alternative", label: "Invalid Number - Need alternative" },
  { value: "meter_de_energised", label: "Meter De-Energised" },
  { value: "broker_in_place", label: "Broker in Place" },
];

// ---------------- Types ----------------
interface EnergyCustomer {
  id: number;
  client_id: number;
  display_id?: number;
  name: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email?: string;
  address?: string;
  site_address?: string;
  
  // Energy specific fields
  mpan_mpr?: string;
  supplier_id?: number;
  supplier_name?: string;
  annual_usage?: number;
  start_date?: string;
  end_date?: string;
  unit_rate?: number;
  
  // Pipeline fields
  status?: string;
  stage_id?: number;
  opportunity_id?: number;
  
  // Assignment
  assigned_to_id?: number;
  assigned_to_name?: string;
  
  created_at: string;

  // ✅ NEW Contact fields
  position?: string;
  company_number?: string;
  date_of_birth?: string;
  
  // ✅ NEW Site fields
  site_name?: string;
  month_sold?: string;
  house_name?: string;
  house_number?: string;
  
  // ✅ NEW Contract fields
  old_supplier_name?: string;
  net_notch?: number;
  rate_2?: number;
  rate_3?: number;
  comms_paid?: number;
  
  // ✅ NEW Banking fields
  charity_ltd_company_number?: string;
  partner_details?: string;
  home_door_number?: string;
  home_street?: string;
  home_post_code?: string;
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
  if (statusLower === 'called' || statusLower === 'priced') {
    return "bg-green-100 text-green-800";
  }
  if (statusLower === 'not_answered') {
    return "bg-yellow-100 text-yellow-800";
  }
  if (statusLower === 'lost') {
    return "bg-red-100 text-red-800";
  }
  return "bg-gray-100 text-gray-800";
};

const getStatusLabel = (status: string | undefined): string => {
  if (!status) return "—";
  const option = STATUS_OPTIONS.find(opt => opt.value === status);
  return option?.label || status;
};

// ✅ HYBRID: Hardcoded as fallback, API as source of truth
const STATUS_TO_STAGE_FALLBACK: Record<string, number> = {
  'called': 1,
  'not_answered': 2,
  'priced': 3,
  'lost': 4,
  'lost_cot': 5,
  'already_renewed_cb_next_year': 6,
  'invalid_number_need_alternative': 7,
  'meter_de_energised': 8,
  'broker_in_place': 9,
};

const getStageIdFromStatus = (status: string, stagesList?: Stage[]): number => {
  // ✅ Try API-fetched stages first
  if (stagesList && stagesList.length > 0) {
    const match = stagesList.find(
      (s) => s.stage_name.toLowerCase() === status.toLowerCase()
    );
    if (match) {
      console.log(`✅ Using API-fetched stage_id: ${match.stage_id}`);
      return match.stage_id;
    }
  }

  // ✅ Fallback to hardcoded mapping
  const stageId = STATUS_TO_STAGE_FALLBACK[status.toLowerCase()];
  
  if (!stageId) {
    throw new Error(`Unknown status: ${status}`);
  }

  console.log(`⚠️ Using fallback stage_id: ${stageId}`);
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
    // imported_count: number;
    errors: string[];
    assigned_to?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);
  const [searchResults, setSearchResults] = useState<EnergyCustomer[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [importTaskId, setImportTaskId] = useState<string | null>(null);
  const [assignTaskId, setAssignTaskId] = useState<string | null>(null);
  const [showProgressDialog, setShowProgressDialog] = useState(false);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [employeeStats, setEmployeeStats] = useState<{
  employee_id: number;
  employee_name: string;
  count: number;
  max_display_id?: number;
}[]>([]);

  // Lost confirmation modal state
  const [lostConfirmation, setLostConfirmation] = useState<{
    isOpen: boolean;
    customerId: number | null;
    newStatus: string | null;
  }>({ isOpen: false, customerId: null, newStatus: null });

  const router = useRouter();
  const { user } = useAuth();

  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";

  useEffect(() => {
    fetchCustomers();
    fetchSuppliers();
    fetchEmployees();
    fetchStages();
    
    // ✅ Fetch stats if admin
    if (isAdmin) {
      fetchEmployeeStats();
    }
  }, [service, isAdmin]);

  // Reset page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, supplierFilter, statusFilter]);

  // ---------------- Fetch Functions ----------------
  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      // ✅ Use fetchWithAuth - automatically includes Authorization and X-Tenant-ID headers
      const response = await fetchWithAuth(`/energy-clients?service=${encodeURIComponent(service)}`);
      // Handle both { data: [...] } and direct array responses
      const data = Array.isArray(response) ? response : (response?.data || []);
      setAllCustomers(data);
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
      // ✅ Use fetchWithAuth - automatically includes Authorization and X-Tenant-ID headers
      const response = await fetchWithAuth("/suppliers");
      // Handle both { data: [...] } and direct array responses
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
      // ✅ Use the correct endpoint from customer_routes.py
      const response = await fetchWithAuth("/stages");
      // Handle both { data: [...] } and direct array responses
      const stagesList = Array.isArray(response) ? response : (response?.data || []);
      
      console.log("✅ Stages loaded:", stagesList);  // Debug log
      
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
      
      // Only show employees with count > 0
      const nonZeroStats = stats.filter((stat: any) => stat.count > 0);
      
      setEmployeeStats(nonZeroStats);
    } catch (err) {
      console.error("❌ Error fetching employee stats:", err);
      setEmployeeStats([]);
    }
  };


  // ✅ NEW: Search across all customers (debounced)
  useEffect(() => {
    const searchAllCustomers = async () => {
      // Only search if user is NOT admin and has typed at least 2 characters
      const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";
      
      if (isAdmin || !searchTerm || searchTerm.length < 2) {
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

    // Debounce search
    const timeoutId = setTimeout(searchAllCustomers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, service, user]);

  // ✅ ISSUE 1 FIXED: Sort customers in ASCENDING order (oldest first, newest at bottom)
  const sortedCustomers = useMemo(() => {
    const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";
    
    // Admin sees all customers from regular fetch
    if (isAdmin) {
      return [...allCustomers].sort((a, b) => {
        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        return aDate - bDate; // ASCENDING order
      });
    }
    
    // Salesperson: combine their assigned customers + search results
    if (searchTerm && searchResults.length > 0) {
      // Merge: their assigned customers + search results (avoid duplicates)
      const assignedIds = new Set(allCustomers.map(c => c.client_id));
      const uniqueSearchResults = searchResults.filter(c => !assignedIds.has(c.client_id));
      
      return [...allCustomers, ...uniqueSearchResults].sort((a, b) => {
        const aDate = new Date(a.created_at || new Date()).getTime();
        const bDate = new Date(b.created_at || new Date()).getTime();
        return aDate - bDate;
      });
    }
    
    // Default: only their assigned customers
    return [...allCustomers].sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return aDate - bDate;
    });
  }, [allCustomers, searchResults, searchTerm, user]);

  // ✅ Apply filters (rest remains the same)
  const filteredCustomers = useMemo(() => {
    return sortedCustomers.filter((customer) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (customer.business_name || "").toLowerCase().includes(term) ||
        (customer.contact_person || "").toLowerCase().includes(term) ||
        (customer.email || "").toLowerCase().includes(term) ||
        (customer.phone || "").toLowerCase().includes(term) ||
        (customer.mpan_mpr || "").toLowerCase().includes(term);

      const matchesSupplier = supplierFilter === "All" || customer.supplier_id === supplierFilter;
      const matchesStatus = statusFilter === "All" || customer.status === statusFilter;

      return matchesSearch && matchesSupplier && matchesStatus;
    });
  }, [sortedCustomers, searchTerm, supplierFilter, statusFilter]);

  const isFromSearch = (customer: EnergyCustomer) => {
    const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";
    if (isAdmin) return false;
    
    const currentUserId = user?.id;
    return customer.assigned_to_id !== currentUserId;
  };

  // ---------------- Pagination Calculations ----------------
  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    const endIndex = startIndex + CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage]);


  // ---------------- Update Status ----------------
  const updateCustomerStatus = async (customerId: number, newStatus: string) => {
    // Check if user is selecting "Lost" - show confirmation first
    if (newStatus.toLowerCase() === 'lost') {
      setLostConfirmation({
        isOpen: true,
        customerId,
        newStatus,
      });
      return;
    }

    // Call performStatusUpdate for ALL statuses
    const ok = await performStatusUpdate(customerId, newStatus);
  };

  const performStatusUpdate = async (customerId: number, newStatus: string): Promise<boolean> => {
    try {
      console.log("🔄 performStatusUpdate called:", {
        customerId,
        newStatus,
        stagesAvailable: stages.length > 0,
        stagesCount: stages.length
      });

      // ✅ Get stage_id using hybrid approach (API + fallback)
      const stageId = getStageIdFromStatus(newStatus, stages.length > 0 ? stages : undefined);
      
      console.log("✅ Mapped to stage_id:", stageId);
      
      await fetchWithAuth(`/energy-clients/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId, status: newStatus }),
      });

      // ✅ Remove from list for BOTH "Lost" and "Priced"
      if (newStatus.toLowerCase() === "lost" || newStatus.toLowerCase() === "priced") {
        setAllCustomers((prev) => prev.filter((c) => c.id !== customerId));
        
        // ✅ Show appropriate success message
        if (newStatus.toLowerCase() === "priced") {
          toast.success("✅ Customer moved to Priced page");
        } else {
          toast.success("🗑️ Customer moved to recycle bin");
        }
      } else {
        // For other statuses, just update the status in place
        setAllCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId ? { ...c, status: newStatus, stage_id: stageId } : c
          )
        );
        
        toast.success(`✅ Status updated to ${getStatusLabel(newStatus)}`);
      }

      return true;
      
    } catch (err: any) {
      console.error("❌ Status update error:", err);
      console.error("❌ Error details:", {
        message: err?.message,
        stack: err?.stack
      });
      toast.error(`❌ ${err?.message || "Error updating status"}`);
      return false;
    }
  };

  // ---------------- Update Assigned To ----------------
  const updateAssignedTo = async (customerId: number, employeeId: number) => {
    // ✅ Platform Admin and Tenant Super Admin can assign to anyone
    // ✅ Individual users can assign to themselves
    const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";
    const isSelfAssignment = user?.id === employeeId;  // ✅ Changed from employee_id to id
    
    if (!isAdmin && !isSelfAssignment) {
      alert("You can only assign customers to yourself. Only administrators can assign to other team members.");
      return;
    }

    try {
      const res = await fetchWithAuth(`/energy-clients/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assigned_to_id: employeeId }),
      });

      // Use server response so assigned_to_name is correct (from backend join)
      const updated = res?.customer ?? res;
      if (updated && (updated.id === customerId || updated.client_id === customerId)) {
        setAllCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? {
                  ...c,
                  assigned_to_id: updated.assigned_to_id ?? employeeId,
                  assigned_to_name: updated.assigned_to_name ?? (employees.find((e) => Number(e.employee_id) === Number(employeeId))?.employee_name ?? null),
                }
              : c
          )
        );
      } else {
        // Fallback: update from local employees list or refetch
        const employee = employees.find((e) => Number(e.employee_id) === Number(employeeId));
        setAllCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId
              ? { ...c, assigned_to_id: employeeId, assigned_to_name: employee?.employee_name }
              : c
          )
        );
      }
    } catch (err) {
      console.error("Assignment update error:", err);
      alert("Error updating assignment");
    }
  };

  // ---------------- Delete Customer ----------------
  const deleteCustomer = async (id: number) => {
    if (!user) {
      alert("You don't have permission to delete clients.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this client and all related records?")) return;

    try {
      // ✅ Use fetchWithAuth - automatically includes Authorization and X-Tenant-ID headers
      await fetchWithAuth(`/energy-clients/${id}`, {
        method: "DELETE",
      });
      
      setAllCustomers((prev) => prev.filter((c) => c.id !== id));
      setSelectedCustomers((prev) => prev.filter((cid) => cid !== id));
      
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
      // Deselect all
      setSelectedCustomers([]);
      setIsSelectAllChecked(false);
    } else {
      // Select all visible customers
      const allIds = filteredCustomers.map(c => c.id);
      setSelectedCustomers(allIds);
      setIsSelectAllChecked(true);
    }
  };

  const handleSelectCustomer = (id: number) => {
    setSelectedCustomers(prev => {
      const newSelection = prev.includes(id)
        ? prev.filter(customerId => customerId !== id)
        : [...prev, id];
      
      // Update select-all checkbox state
      setIsSelectAllChecked(newSelection.length === filteredCustomers.length);
      
      return newSelection;
    });
  };

  // ✅ FIXED: Bulk assign now uses client_id consistently
  const bulkAssignToEmployee = async (employeeId: number, employeeName: string) => {
    if (selectedCustomers.length === 0) {
      alert("Please select customers to assign");
      return;
    }

    if (!window.confirm(`Assign ${selectedCustomers.length} client(s) to ${employeeName}?`)) {
      return;
    }

    try {
      // Map display IDs to actual client_ids
      const customerIdsToAssign = selectedCustomers
        .map(displayId => allCustomers.find(c => c.id === displayId)?.client_id)
        .filter((id): id is number => id !== undefined);

      console.log(`🚀 Bulk assigning ${customerIdsToAssign.length} clients to ${employeeName}`);

      // ✅ Call optimized synchronous endpoint
      const response = await fetchWithAuth('/api/bulk-assign-optimized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_ids: customerIdsToAssign,
          employee_id: employeeId,
        }),
      });

      // ✅ Handle immediate response
      if (response.success) {
        toast.success(`✅ ${response.updated_count} clients assigned to ${response.employee_name}`);
        
        // Remove from current view (BOTH admin and non-admin)
        setAllCustomers((prev) => 
          prev.filter((c) => !customerIdsToAssign.includes(c.client_id))
        );
        
        setSelectedCustomers([]);
        setIsSelectAllChecked(false);
        
        if (isAdmin) {
          fetchEmployeeStats();
        }
      }
    } catch (err) {
      console.error("Bulk assign error:", err);
      toast.error("❌ Error assigning customers");
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
    // ✅ FIX: Map selectedCustomers (which are display IDs) to actual client_ids
    const customerIdsToDelete = selectedCustomers
      .map(displayId => allCustomers.find(c => c.id === displayId)?.client_id)
      .filter((id): id is number => id !== undefined);

    const deletePromises = customerIdsToDelete.map(clientId =>
      fetchWithAuth(`/energy-clients/${clientId}`, { // ✅ Use client_id
        method: "DELETE",
      })
    );

    await Promise.all(deletePromises);

    setAllCustomers((prev) => prev.filter((c) => !selectedCustomers.includes(c.id)));
    setSelectedCustomers([]);
    
    // ✅ Check if all customers are deleted
    const remainingCustomers = allCustomers.filter((c) => !selectedCustomers.includes(c.id));
    
    if (remainingCustomers.length === 0) {
      // Reset sequence when all customers are deleted
      try {
        await fetchWithAuth('/energy-clients/reset-sequence', {
          method: 'POST',
        });
        toast.success('✅ Sequence reset successfully');
      } catch (resetErr) {
        console.error('⚠️ Error resetting sequence:', resetErr);
      }
    }
    
    alert(`Successfully deleted ${deletePromises.length} client(s)`);
  } catch (err) {
    console.error("Bulk delete error:", err);
    alert("Error deleting some customers");
  }
};

  const deleteAllAndReset = async () => {
    if (!user) {
      alert("You don't have permission to delete clients.");
      return;
    }

    // ✅ CHANGED: Use selectedCustomers if any are selected, otherwise all customers
    const customersToDelete = selectedCustomers.length > 0 
      ? allCustomers.filter(c => selectedCustomers.includes(c.id))
      : allCustomers;
    
    const totalCount = customersToDelete.length;
    
    if (totalCount === 0) {
      alert("No customers to delete");
      return;
    }
    
    const confirmMessage = `⚠️ WARNING: This will DELETE ${totalCount} energy customer(s) and RESET the ID numbering to start from 1.\n\nThis action CANNOT be undone!\n\nType "DELETE ALL" to confirm:`;
    
    const confirmation = prompt(confirmMessage);
    
    if (confirmation !== "DELETE ALL") {
      alert("Deletion cancelled. You must type exactly: DELETE ALL");
      return;
    }

    try {
      setIsLoading(true);
      
      // Get all customer client_ids to delete
      const allClientIds = customersToDelete.map(c => c.client_id);
      
      toast.success(`🗑️ Deleting ${allClientIds.length} customers...`);

      // Delete all customers
      const deletePromises = allClientIds.map(clientId =>
        fetchWithAuth(`/energy-clients/${clientId}`, {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);

      toast.success("✅ All customers deleted, resetting sequence...");

      // Reset sequence
      await fetchWithAuth('/energy-clients/reset-sequence', {
        method: 'POST',
      });

      toast.success("✅ Sequence reset complete");

      setAllCustomers([]);
      setSelectedCustomers([]);
      setIsSelectAllChecked(false);
      
      alert(`✅ Successfully deleted ${allClientIds.length} customers and reset ID numbering to 1.\n\nYou can now upload your new file.`);
      
    } catch (err) {
      console.error("Delete all error:", err);
      alert("Error deleting customers");
    } finally {
      setIsLoading(false);
    }
  };

  // const { taskProgress } = useTaskProgress(
  //   importTaskId || assignTaskId,
  //   // onComplete
  //   (result) => {
  //     console.log('✅ Task complete:', result);
  //     fetchCustomers(); // Refresh customer list
  //     setShowProgressDialog(true); // Keep dialog open to show results
  //   },
  //   // onError
  //   (error) => {
  //     console.error('❌ Task failed:', error);
  //     toast.error(`Task failed: ${error}`);
  //     setShowProgressDialog(true);
  //   }
  // );

  const handleBulkImport = async () => {
    if (!bulkImportFile) {
      alert("Please select a file");
      return;
    }

    setBulkImporting(true);  // ✅ Show loading spinner
    setBulkImportResult(null);

    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();
      formData.append('file', bulkImportFile);
      
      if (assignToEmployee) {
        formData.append('assigned_employee_id', assignToEmployee.toString());
      }

      console.log(`🚀 Starting optimized bulk import for service: ${service}`);

      // ✅ Call optimized synchronous endpoint
      const res = await fetch(
        `${API_BASE_URL}/import/energy-customers?service=${encodeURIComponent(service)}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        }
      );

      const data = await res.json();

      // ✅ Handle immediate response (no task_id, just results)
      if (res.ok && data.success) {
        setBulkImportResult({
          success: true,
          successful: data.successful,  // ✅ Use 'successful' field
          errors: data.errors || [],
          assigned_to: data.assigned_to,
        });

        toast.success(`✅ Imported ${data.successful} customers successfully!`);

        // Refresh customer list
        await fetchCustomers();
        
        if (isAdmin) {
          await fetchEmployeeStats();
        }

        // Reset file input
        setBulkImportFile(null);
        setAssignToEmployee(null);
      } else {
        setBulkImportResult({
          success: false,
          successful: data.successful || 0,
          errors: data.errors || [data.error || 'Import failed'],
        });
        toast.error(data.error || 'Import failed');
      }
    } catch (error) {
      console.error("Error during import:", error);
      toast.error("Network error during import");
      setBulkImportResult({
        success: false,
        successful: 0,
        errors: ['Network error occurred'],
      });
    } finally {
      setBulkImporting(false);  // ✅ Hide loading spinner
    }
  };

  const downloadFileWithAuth = async (url: string, filename: string) => {
    try {
      const token = localStorage.getItem('auth_token');
      const tenantId = localStorage.getItem('tenant_id');
      
      if (!token) {
        throw new Error('No authentication token found');
      }
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId || '',
        },
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

    } catch (error) {
      console.error('Download error:', error);
      throw error;
    }
  };

  // Get supplier name from ID
  const getSupplierName = (supplierId: number | undefined): string => {
    if (!supplierId) return "—";
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    return supplier?.supplier_name || "—";
  };

  // Pagination Component
  const PaginationControls = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">
            {Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)}
          </span>{" "}
          of <span className="font-medium">{filteredCustomers.length}</span> clients
        </div>
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First Page"
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center px-3 text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last Page"
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-6">
    <Toaster position="top-right" />
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">
        Renewals
      </h1>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setService("utilities")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${
              service === "utilities"
                ? "bg-slate-900 text-white shadow"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Utilities
          </button>
          <button
            type="button"
            onClick={() => setService("water")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${
              service === "water"
                ? "bg-slate-900 text-white shadow"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Water
          </button>
        </div>
      </div>

      {isAdmin && employeeStats.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-medium text-gray-700 mb-3">Team Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {employeeStats.map((stat) => (
              <div
                key={stat.employee_id}
                className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-500 truncate">
                    {stat.employee_name}
                  </span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">
                    {stat.count}
                  </span>
                  <span className="text-xs text-gray-500">
                    customer{stat.count !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ✅ NEW: Salesperson Stats Card - Non-Admin Only */}
      {!isAdmin && (
        <div className="mb-6">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Your Customers</p>
                <p className="text-2xl font-bold text-gray-900">
                  {allCustomers.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Clients</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button 
              onClick={fetchCustomers} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* ✅ NEW: Bulk Assign Bar - Shows when customers are selected */}
      {selectedCustomers.length > 0 && (user?.role === "Platform Admin" || user?.role === "Tenant Super Admin") && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">
                  {selectedCustomers.length} client(s) selected
                </h3>
                <p className="text-sm text-blue-700">
                  Click on a salesperson to assign these clients
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedCustomers([])}
            >
              Clear Selection
            </Button>
          </div>
          
          {/* Salesperson Buttons */}
          <div className="mt-4 flex flex-wrap gap-2">
            {employees.map((employee) => (
              <Button
                key={employee.employee_id}
                variant="outline"
                size="sm"
                className="hover:bg-blue-100 hover:border-blue-400"
                onClick={() => bulkAssignToEmployee(employee.employee_id, employee.employee_name)}
              >
                <Users className="h-4 w-4 mr-2" />
                Assign to {employee.employee_name}
              </Button>
            ))}
          </div>
        </div>
      )}

      {!isAdmin && searchTerm && searchResults.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
          <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 text-sm">
            <p className="font-medium text-blue-900">
              Showing {searchResults.length} result(s) from team database
            </p>
            <p className="text-blue-700 mt-1">
              Customers assigned to other team members are included in search results to help you assist callers.
            </p>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Search clients..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
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
              <DropdownMenuItem onClick={() => setSupplierFilter("All")}>
                All Suppliers
              </DropdownMenuItem>
              {suppliers.map(supplier => (
                <DropdownMenuItem 
                  key={supplier.supplier_id} 
                  onClick={() => setSupplierFilter(supplier.supplier_id)}
                >
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
              <DropdownMenuItem onClick={() => setStatusFilter("All")}>
                All Status
              </DropdownMenuItem>
              {STATUS_OPTIONS.map(status => (
                <DropdownMenuItem 
                  key={status.value} 
                  onClick={() => setStatusFilter(status.value)}
                >
                  {status.label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex gap-2">
          {selectedCustomers.length > 0 && user && (
            <>
              <Button onClick={bulkDeleteCustomers} variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete Selected ({selectedCustomers.length})
              </Button>
              
              <Button 
                onClick={deleteAllAndReset}
                variant="destructive"
                className="bg-red-600 hover:bg-red-700"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete All & Reset
              </Button>
            </>
          )}
          
          <Button onClick={() => setShowImportModal(true)} variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          
          <Button onClick={() => setShowCreateModal(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Energy Client
          </Button>
        </div>
      </div>

        {/* Responsive table wrapper */}
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedCustomers.length === paginatedCustomers.length && paginatedCustomers.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-16 border-r-2 border-gray-300">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                  Client Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-44">
                  Trading Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                  Tel No
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                  MPAN
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                  Supplier
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  Annual Usage
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  Start Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  Contract End
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-40">
                  Status
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-36">
                  Assigned To
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
                    <p className="mt-4 text-gray-500">Loading renewals...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600">Failed to load renewals</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                    <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-lg">No clients found.</p>
                    <p className="mt-2 text-sm">Create your first client to get started!</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer, idx) => {
                  const isSelected = selectedCustomers.includes(customer.id);
                  const displayId = (currentPage - 1) * CUSTOMERS_PER_PAGE + idx + 1;
                  const fromSearch = isFromSearch(customer);
                  
                  return (
                    <tr
                      key={customer.client_id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                        isSelected ? 'bg-blue-50' : fromSearch ? 'bg-amber-50' : ''
                      }`}
                      onClick={() => router.push(`/dashboard/renewals/${customer.client_id}`)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const menu = document.createElement('div');
                        menu.className = 'fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 py-1';
                        menu.style.left = `${e.pageX}px`;
                        menu.style.top = `${e.pageY}px`;
                        
                        const editBtn = document.createElement('button');
                        editBtn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2';
                        editBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit';
                        editBtn.onclick = () => {
                          router.push(`/dashboard/renewals/${customer.client_id}/edit`);
                          document.body.removeChild(menu);
                        };
                        
                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2';
                        deleteBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete';
                        deleteBtn.onclick = () => {
                          deleteCustomer(customer.client_id);
                          document.body.removeChild(menu);
                        };
                        
                        menu.appendChild(editBtn);
                        if (user) {
                          menu.appendChild(deleteBtn);
                        }
                        
                        document.body.appendChild(menu);
                        
                        const closeMenu = (e: MouseEvent) => {
                          if (!menu.contains(e.target as Node)) {
                            document.body.removeChild(menu);
                            document.removeEventListener('click', closeMenu);
                          }
                        };
                        setTimeout(() => document.addEventListener('click', closeMenu), 0);
                      }}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 mt-1"
                          checked={isSelected}
                          onChange={() => handleSelectCustomer(customer.id)}
                          disabled={fromSearch}
                        />
                      </td>

                      {/* ID */}
                      <td className="px-2 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                        <div className="flex items-center gap-1">
                          {customer.display_id || customer.id}
                          {fromSearch && (
                            <span title="From team search" className="inline-flex">
                              <Info className="h-3 w-3 text-amber-600" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Name */}
                      <td className="px-3 py-3 text-sm text-gray-700 align-top">
                        <div className="break-words max-w-[120px] leading-tight">
                          {customer.contact_person}
                          {fromSearch && (
                            <Badge variant="outline" className="mt-1 text-xs bg-amber-100 text-amber-800 border-amber-300">
                              {customer.assigned_to_name || 'Other team'}
                            </Badge>
                          )}
                        </div>
                      </td>

                      {/* Business Name */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="flex items-start gap-1">
                          <span className="break-words max-w-[160px] leading-tight">
                            {customer.business_name}
                          </span>
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">
                          {customer.phone ? String(customer.phone).replace(/\.0$/, '') : '—'}
                        </div>
                      </td>

                      {/* MPAN/MPR */}
                      <td className="px-3 py-3 text-xs font-mono text-gray-900 align-top">
                        <div className="break-all max-w-[120px] leading-tight">
                          {customer.mpan_mpr || "—"}
                        </div>
                      </td>

                      {/* Supplier */}
                      <td className="px-3 py-3 text-xs text-gray-900 align-top">
                        <div className="break-words max-w-[120px] leading-tight">
                          {customer.supplier_name || "—"}
                        </div>
                      </td>

                      {/* Usage */}
                      <td className="px-3 py-3 text-xs text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">
                          {customer.annual_usage ? customer.annual_usage.toLocaleString() : "—"}
                        </div>
                      </td>

                      {/* Start Date */}
                      <td className="px-3 py-3 text-xs text-gray-700 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.start_date)}</div>
                      </td>

                      {/* End Date */}
                      <td className="px-3 py-3 text-xs text-gray-700 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.end_date)}</div>
                      </td>

                      {/* Status Dropdown */}
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={customer.status || ""}
                          onValueChange={(value) => updateCustomerStatus(customer.client_id, value)}
                        >
                          <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                            <SelectValue placeholder="Set status">
                              {customer.status ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(customer.status)}`}>
                                  {getStatusLabel(customer.status)}
                                </span>
                              ) : (
                                "—"
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>

                      {/* Assigned To */}
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        {fromSearch ? (
                          <div className="text-xs text-amber-700 font-medium px-2 py-1 bg-amber-100 rounded">
                            {customer.assigned_to_name || 'Unassigned'}
                          </div>
                        ) : (
                          <Select
                            value={customer.assigned_to_id?.toString() || ""}
                            onValueChange={(value) => updateAssignedTo(customer.client_id, parseInt(value))}
                          >
                            <SelectTrigger className="h-7 text-xs w-full max-w-[130px]">
                              <SelectValue placeholder="Assign">
                                <span className="truncate text-xs">{customer.assigned_to_name || "—"}</span>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {employees.map((employee) => (
                                <SelectItem key={employee.employee_id} value={employee.employee_id.toString()}>
                                  {employee.employee_name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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

      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Energy Customers</DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xlsx) with customer data. You can optionally assign all imported customers to a salesperson.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Select Excel File
              </label>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => setBulkImportFile(e.target.files?.[0] || null)}
                className="block w-full text-sm border rounded-md p-2"
              />
            </div>

            {/* Assignment Dropdown */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Assign To (Optional)
              </label>
              <Select
                value={assignToEmployee?.toString() || "0"}
                onValueChange={(value) => setAssignToEmployee(value === "0" ? null : Number(value))}
              > 
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Keep unassigned (Admin only)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Keep unassigned (Admin only)</SelectItem>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                      {emp.employee_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500 mt-1">
                If selected, all imported customers will be assigned to this salesperson and appear in their dashboard.
              </p>
            </div>

            {/* Template Download */}
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h4 className="font-medium text-sm mb-2">📥 Download Template</h4>
              <p className="text-xs text-gray-600 mb-2">
                Use the Excel template with all required columns
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    await downloadFileWithAuth(
                      `${API_BASE_URL}/import/template`,
                      'energy_customers_template.xlsx'
                    );
                  } catch (error) {
                    alert(error instanceof Error ? error.message : 'Failed to download template');
                  }
                }}
              >
                Download Template
              </Button>
            </div>

            {/* Import Results */}
            {bulkImportResult && (
              <div
                className={`rounded-md p-4 ${
                  bulkImportResult.success ? "bg-green-50 border border-green-200" : "bg-red-50 border border-red-200"
                }`}
              >
                <h4 className="font-medium text-sm mb-2">
                  {bulkImportResult.success ? "✅ Import Successful" : "❌ Import Failed"}
                </h4>
                <p className="text-sm">
                  Imported: <strong>{bulkImportResult.successful}</strong> customers
                </p>
                {bulkImportResult.assigned_to && (
                  <p className="text-sm text-green-700 mt-1">
                    ✅ Assigned to: <strong>{bulkImportResult.assigned_to}</strong>
                  </p>
                )}
                {bulkImportResult.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium">Errors:</p>
                    <ul className="list-disc list-inside text-xs mt-1">
                      {bulkImportResult.errors.slice(0, 5).map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                      {bulkImportResult.errors.length > 5 && (
                        <li>... and {bulkImportResult.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ✅ Progress Dialog
            <ProgressDialog
              open={showProgressDialog}
              onOpenChange={setShowProgressDialog}
              title={importTaskId ? "Importing Customers" : "Assigning Customers"}
              progress={taskProgress?.progress || 0}
              status={taskProgress?.status || 'Starting...'}
              state={taskProgress?.state || 'PENDING'}
              successful={taskProgress?.successful}
              errors={taskProgress?.errors}
              currentBatch={taskProgress?.current_batch}
              totalBatches={taskProgress?.total_batches}
              result={taskProgress?.result}
              error={taskProgress?.error}
              onComplete={() => {
                setImportTaskId(null);
                setAssignTaskId(null);
                setShowProgressDialog(false);
              }}
            /> */}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setShowImportModal(false);
                  setBulkImportFile(null);
                  setAssignToEmployee(null);
                  setBulkImportResult(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleBulkImport}
                disabled={!bulkImportFile || bulkImporting}
              >
                {bulkImporting ? (
                  <>
                    <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                    Importing...
                  </>
                ) : (
                  "Import Customers"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lost Confirmation Modal */}
      <Dialog 
        open={lostConfirmation.isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setLostConfirmation({ isOpen: false, customerId: null, newStatus: null });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Customer as Lost?</DialogTitle>
            <DialogDescription>
              This customer will be marked as lost. You can still view and update it later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setLostConfirmation({ isOpen: false, customerId: null, newStatus: null });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const { customerId, newStatus } = lostConfirmation;
                setLostConfirmation({ isOpen: false, customerId: null, newStatus: null });
                if (customerId && newStatus) {
                  await performStatusUpdate(customerId, newStatus);
                }
              }}
            >
              Mark as Lost
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}