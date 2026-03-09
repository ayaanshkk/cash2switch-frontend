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

  // Contact fields
  position?: string;
  company_number?: string;
  date_of_birth?: string;
  
  // Site fields
  site_name?: string;
  month_sold?: string;
  house_name?: string;
  house_number?: string;
  
  // Contract fields
  old_supplier_name?: string;
  net_notch?: number;
  rate_2?: number;
  rate_3?: number;
  comms_paid?: number;
  
  // Banking fields
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

// HYBRID: Hardcoded as fallback, API as source of truth
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
  if (stagesList && stagesList.length > 0) {
    const match = stagesList.find(
      (s) => s.stage_name.toLowerCase() === status.toLowerCase()
    );
    if (match) {
      console.log(`✅ Using API-fetched stage_id: ${match.stage_id}`);
      return match.stage_id;
    }
  }

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
    successful: number; // ✅ CHANGED from imported_count to successful
    errors: string[];
    assigned_to?: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
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
      const response = await fetchWithAuth(`/energy-clients?service=${encodeURIComponent(service)}`);
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
      
      console.log("✅ Stages loaded:", stagesList);
      
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
      
      const nonZeroStats = stats.filter((stat: any) => stat.count > 0);
      
      setEmployeeStats(nonZeroStats);
    } catch (err) {
      console.error("❌ Error fetching employee stats:", err);
      setEmployeeStats([]);
    }
  };

  // Search across all customers (debounced)
  useEffect(() => {
    const searchAllCustomers = async () => {
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

    const timeoutId = setTimeout(searchAllCustomers, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, service, user]);

  const sortedCustomers = useMemo(() => {
    const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";
    
    if (isAdmin) {
      return [...allCustomers].sort((a, b) => {
        const aDate = new Date(a.created_at).getTime();
        const bDate = new Date(b.created_at).getTime();
        return aDate - bDate;
      });
    }
    
    if (searchTerm && searchResults.length > 0) {
      const assignedIds = new Set(allCustomers.map(c => c.client_id));
      const uniqueSearchResults = searchResults.filter(c => !assignedIds.has(c.client_id));
      
      return [...allCustomers, ...uniqueSearchResults].sort((a, b) => {
        const aDate = new Date(a.created_at || new Date()).getTime();
        const bDate = new Date(b.created_at || new Date()).getTime();
        return aDate - bDate;
      });
    }
    
    return [...allCustomers].sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return aDate - bDate;
    });
  }, [allCustomers, searchResults, searchTerm, user]);

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
    if (newStatus.toLowerCase() === 'lost') {
      setLostConfirmation({
        isOpen: true,
        customerId,
        newStatus,
      });
      return;
    }

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

      const stageId = getStageIdFromStatus(newStatus, stages.length > 0 ? stages : undefined);
      
      console.log("✅ Mapped to stage_id:", stageId);
      
      await fetchWithAuth(`/energy-clients/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId, status: newStatus }),
      });

      if (newStatus.toLowerCase() === "lost" || newStatus.toLowerCase() === "priced") {
        setAllCustomers((prev) => prev.filter((c) => c.id !== customerId));
        
        if (newStatus.toLowerCase() === "priced") {
          toast.success("✅ Customer moved to Priced page");
        } else {
          toast.success("🗑️ Customer moved to recycle bin");
        }
      } else {
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
    const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";
    const isSelfAssignment = user?.id === employeeId;
    
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
      setSelectedCustomers([]);
      setIsSelectAllChecked(false);
    } else {
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
      
      setIsSelectAllChecked(newSelection.length === filteredCustomers.length);
      
      return newSelection;
    });
  };

  // ✅ OPTIMIZED: Bulk assign using new endpoint
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

      // ✅ Use optimized endpoint
      const response = await fetchWithAuth('/api/bulk-assign-optimized', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_ids: customerIdsToAssign,
          employee_id: employeeId,
        }),
      });

      if (response.success) {
        toast.success(`✅ ${response.updated_count} clients assigned to ${response.employee_name}`);
        
        // Remove from current view (BOTH admin and non-admin)
        setAllCustomers((prev) => 
          prev.filter((c) => !customerIdsToAssign.includes(c.client_id))
        );
        
        setSelectedCustomers([]);
        setIsSelectAllChecked(false);
        
        // Refresh stats if admin
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
      const customerIdsToDelete = selectedCustomers
        .map(displayId => allCustomers.find(c => c.id === displayId)?.client_id)
        .filter((id): id is number => id !== undefined);

      const deletePromises = customerIdsToDelete.map(clientId =>
        fetchWithAuth(`/energy-clients/${clientId}`, {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);

      setAllCustomers((prev) => prev.filter((c) => !selectedCustomers.includes(c.id)));
      setSelectedCustomers([]);
      
      const remainingCustomers = allCustomers.filter((c) => !selectedCustomers.includes(c.id));
      
      if (remainingCustomers.length === 0) {
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
      
      const allClientIds = customersToDelete.map(c => c.client_id);
      
      toast.success(`🗑️ Deleting ${allClientIds.length} customers...`);

      const deletePromises = allClientIds.map(clientId =>
        fetchWithAuth(`/energy-clients/${clientId}`, {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);

      toast.success("✅ All customers deleted, resetting sequence...");

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

  // ✅ OPTIMIZED: Bulk import handler
  const handleBulkImport = async () => {
    if (!bulkImportFile) {
      alert("Please select a file");
      return;
    }

    setBulkImporting(true);
    setBulkImportResult(null);

    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();
      formData.append('file', bulkImportFile);
      
      if (assignToEmployee) {
        formData.append('assigned_employee_id', assignToEmployee.toString());
      }

      console.log(`🚀 Starting optimized bulk import for service: ${service}`);

      // ✅ Use optimized import endpoint (note: removed /api prefix to match your backend)
      const res = await fetch(
        `${API_BASE_URL}/api/import/energy-customers?service=${encodeURIComponent(service)}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        }
      );

      const data = await res.json();

      if (res.ok && data.success) {
        setBulkImportResult({
          success: true,
          successful: data.successful, // ✅ Use 'successful' field
          errors: data.errors || [],
          assigned_to: data.assigned_to,
        });

        toast.success(`✅ Imported ${data.successful} customers successfully!`);

        // Refresh customer list
        await fetchCustomers();
        
        // Refresh stats if admin
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
      setBulkImporting(false);
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

      {/* Table - keeping your existing table code */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            {/* Your existing table structure - unchanged for brevity */}
            {/* ... rest of table code ... */}
          </table>
        </div>

        {!isLoading && !error && filteredCustomers.length > 0 && <PaginationControls />}
      </div>

      {/* Import Modal */}
      <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Energy Customers</DialogTitle>
            <DialogDescription>
              Upload an Excel file (.xlsx) with customer data. You can optionally assign all imported customers to a salesperson.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
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