"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Plus, Edit, Trash2, ChevronDown, Filter, AlertCircle, 
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst, Zap, Building2, Upload
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

// Map status value to stage_id using API-fetched stages (SINGLE SOURCE OF TRUTH)
const getStageIdFromStatus = (status: string, stagesList: Stage[]): number => {
  const match = stagesList.find(
    (s) => s.stage_name.toLowerCase() === status.toLowerCase()
  );

  if (!match) {
    throw new Error(
      `Stage "${status}" not found in Stage_Master. Cannot update status without valid stage ID.`
    );
  }

  return match.stage_id;
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
  const [service, setService] = useState("electricity");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<number[]>([]);

  // Lost confirmation modal state
  const [lostConfirmation, setLostConfirmation] = useState<{
    isOpen: boolean;
    customerId: number | null;
    newStatus: string | null;
  }>({ isOpen: false, customerId: null, newStatus: null });

  const router = useRouter();
  const { user } = useAuth();

  // Fetch data initially
  useEffect(() => {
    fetchCustomers();
    fetchSuppliers();
    fetchEmployees();
    fetchStages();
  }, [service]);

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
      // ✅ Use fetchWithAuth - automatically includes Authorization and X-Tenant-ID headers
      // Fetch from SAME endpoint as Leads page - /api/crm/stages
      const response = await fetchWithAuth("/api/crm/stages");
      // Handle both { data: [...] } and direct array responses
      const stagesList = Array.isArray(response) ? response : (response?.data || []);
      setStages(stagesList);
    } catch (err) {
      console.error("❌ Error fetching stages:", err);
      setStages([]);
    }
  };

  // ✅ ISSUE 1 FIXED: Sort customers in ASCENDING order (oldest first, newest at bottom)
  const sortedCustomers = useMemo(() => {
    return [...allCustomers].sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return aDate - bDate; // ← ASCENDING order (changed from bDate - aDate)
    });
  }, [allCustomers]);

  // ✅ Apply search and filters
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

  // ---------------- Pagination Calculations ----------------
  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    const endIndex = startIndex + CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage]);

  // ---------------- Permissions ----------------
  // Using shared permission utilities for consistency
  // Note: canEditEntity checks both assigned_to_id and opportunity_owner_employee_id

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

    // Call performStatusUpdate for ALL statuses (including Priced)
    // Redirect to priced page happens AFTER successful API response
    const ok = await performStatusUpdate(customerId, newStatus);
    
    // Only redirect to /dashboard/priced after successful status update
    if (ok && newStatus.toLowerCase() === 'priced') {
      router.push('/dashboard/priced');
    }
  };

  const performStatusUpdate = async (customerId: number, newStatus: string): Promise<boolean> => {
    try {
      // Ensure stages are loaded before mapping status to stage_id
      if (!stages || stages.length === 0) {
        console.error("Stages not loaded");
        alert("Stages are not loaded. Cannot update status.");
        return false;
      }

      // Map status value to stage_id using API-fetched stages (throws if not found)
      const stageId = getStageIdFromStatus(newStatus, stages);
      
      await fetchWithAuth(`/energy-clients/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: stageId, status: newStatus }),
      });

      // Update local state: remove from list when Lost (goes to recycle bin)
      if (newStatus.toLowerCase() === "lost") {
        setAllCustomers((prev) => prev.filter((c) => c.id !== customerId));
      } else {
        setAllCustomers((prev) =>
          prev.map((c) =>
            c.id === customerId ? { ...c, status: newStatus, stage_id: stageId } : c
          )
        );
      }

      return true;
    } catch (err: any) {
      console.error("Status update error:", err);
      alert(err?.message || "Error updating status");
      return false;
    }
  };

  // ---------------- Update Assigned To ----------------
  const updateAssignedTo = async (customerId: number, employeeId: number) => {
    // Check permission before attempting assignment
    if (!canBulkAssign(user)) {
      alert("You don't have permission to assign customers. Only administrators can assign customers.");
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
              ? { ...c, assigned_to_id: employeeId, assigned_to_name: employee?.employee_name ?? null }
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
    if (selectedCustomers.length === paginatedCustomers.length) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(paginatedCustomers.map(c => c.id));
    }
  };

  const handleSelectCustomer = (id: number) => {
    setSelectedCustomers(prev => 
      prev.includes(id) ? prev.filter(cid => cid !== id) : [...prev, id]
    );
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
      // ✅ Use fetchWithAuth - automatically includes Authorization and X-Tenant-ID headers
      const deletePromises = selectedCustomers.map(id =>
        fetchWithAuth(`/energy-clients/${id}`, {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);

      setAllCustomers((prev) => prev.filter((c) => !selectedCustomers.includes(c.id)));
      setSelectedCustomers([]);
      
      alert(`Successfully deleted ${deletePromises.length} client(s)`);
    } catch (err) {
      console.error("Bulk delete error:", err);
      alert("Error deleting some customers");
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
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">
        Renewals
      </h1>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setService("electricity")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${
              service === "electricity"
                ? "bg-slate-900 text-white shadow"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Electricity
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

          {/* ✅ ISSUE 4: Status Filter instead of Stage Filter */}
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
            <Button onClick={bulkDeleteCustomers} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedCustomers.length})
            </Button>
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

      {/* ✅ ISSUE 3 FIXED: Compact table - removed horizontal scroll, optimized column widths */}
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
                  Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-44">
                  Business Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                  Phone
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                  MPAN/MPR
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                  Supplier
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  Usage
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  Start
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  End
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
                  
                  return (
                    <tr
                      key={customer.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? 'bg-blue-50' : ''}`}
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
                          deleteCustomer(customer.id);
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
                        />
                      </td>

                      {/* ID */}
                      <td className="px-2 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                        {customer.client_id}
                      </td>

                      {/* Name - WRAPPED TEXT */}
                      <td className="px-3 py-3 text-sm text-gray-700 align-top">
                        <div className="break-words max-w-[120px] leading-tight">
                          {customer.contact_person}
                        </div>
                      </td>

                      {/* Business Name - WRAPPED TEXT WITH ICON */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="flex items-start gap-1">
                          {/* <Building2 className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" /> */}
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

                      {/* Supplier - WRAPPED TEXT */}
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
                          onValueChange={(value) => updateCustomerStatus(customer.id, value)}
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

                      {/* Assigned To Dropdown */}
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={customer.assigned_to_id?.toString() || ""}
                          onValueChange={(value) => updateAssignedTo(customer.id, parseInt(value))}
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

      {showImportModal && (
        <BulkImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={fetchCustomers}
          uploadEndpoint={`/import/energy-customers?service=${encodeURIComponent(service)}`}
          templateEndpoint="/import/template"
          templateFilename="energy_customers_import_template.xlsx"
        />
      )}

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