"use client";

import { useEffect, useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canBulkAssign } from "@/lib/permissions";
import { Search, Trash2, Filter, ChevronDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Plus, Upload, AlertCircle } from "lucide-react";
import { BulkImportModal } from "@/components/ui/BulkImportModal";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast"; // ✅ ADD THIS IMPORT
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const CUSTOMERS_PER_PAGE = 25;

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

interface Employee {
  employee_id: number;
  employee_name: string;
  email: string;
  phone: string | null;
}

interface Stage {
  stage_id: number;
  stage_name: string;
  description?: string;
}

type LeadRow = {
  opportunity_id: number;
  business_name: string | null;
  contact_person: string | null;
  tel_number: string | null;
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
};

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const formatUsage = (usage: number | null | undefined): string => {
  if (!usage) return "—";
  return `${usage.toLocaleString()} kWh`;
};

const getStatusColor = (status: string | undefined): string => {
  if (!status) return "bg-gray-100 text-gray-800";

  const statusLower = status.toLowerCase();
  if (statusLower === "called" || statusLower === "priced") {
    return "bg-green-100 text-green-800";
  }
  if (statusLower === "not_answered") {
    return "bg-yellow-100 text-yellow-800";
  }
  if (statusLower === "lost") {
    return "bg-red-100 text-red-800";
  }
  return "bg-gray-100 text-gray-800";
};

const getStatusLabel = (status: string | undefined): string => {
  if (!status) return "—";
  const option = STATUS_OPTIONS.find((opt) => opt.value === status);
  return option?.label || status;
};

const getLeadStatusValue = (stageName?: string | null): string => {
  if (!stageName) return "";
  const normalized = stageName.toLowerCase().trim();
  const byValue = STATUS_OPTIONS.find((opt) => opt.value === normalized);
  if (byValue) return byValue.value;
  const byLabel = STATUS_OPTIONS.find((opt) => opt.label.toLowerCase() === normalized);
  if (byLabel) return byLabel.value;
  if (normalized === "not called") return "not_answered";
  return stageName;
};

export default function LeadsPage() {
  const { loading: authLoading, user } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<{ supplier_id: number; supplier_name: string }[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [supplierFilter, setSupplierFilter] = useState<number | "All">("All");
  const [statusFilter, setStatusFilter] = useState<string | "All">("All");
  const [service, setService] = useState("electricity");

  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  // Lost confirmation modal state
  const [lostConfirmation, setLostConfirmation] = useState<{
    isOpen: boolean;
    opportunityId: number | null;
    currentStatus: string | null;
  }>({ isOpen: false, opportunityId: null, currentStatus: null });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, supplierFilter, statusFilter]);

  const handleAssignSingle = async (leadId: number, employeeId: number) => {
    // Check permission before attempting assignment
    if (!canBulkAssign(user)) {
      toast.error("You don't have permission to assign leads. Only administrators can assign leads.");
      return;
    }

    try {
      await fetchWithAuth("/api/crm/leads/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lead_ids: [leadId],
          employee_id: employeeId
        })
      });

      toast.success("Lead assigned successfully");
      await loadLeads();
    } catch (err: any) {
      console.error("Single assign error:", err);
      toast.error(err.message || "Failed to assign lead");
    }
  };

  const fetchStages = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/stages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStages(data);
      }
    } catch (err) {
      console.error("Error fetching stages:", err);
    }
  };

  const loadLeads = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const employeesBody = await fetchWithAuth("/api/crm/employees");
      const employeesList = Array.isArray(employeesBody.data) ? employeesBody.data : [];
      setEmployees(employeesList);

      const suppliersResp = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (suppliersResp.ok) {
        const suppliersData = await suppliersResp.json();
        setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
      }

      const body = await fetchWithAuth(`/api/crm/leads?exclude_stage=Lost&service=${encodeURIComponent(service)}`);
      const allLeads = Array.isArray(body.data) ? body.data : [];
      setRows(allLeads);
    } catch (err: any) {
      console.error("Leads page: fetch error", err);
      setError(err.message || "Failed to load leads");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) {
      loadLeads();
      fetchStages();
    }
  }, [authLoading, service]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const aDate = new Date(a.created_at || 0).getTime();
      const bDate = new Date(b.created_at || 0).getTime();
      return aDate - bDate;
    });
  }, [rows]);

  const handleSelectAll = () => {
    if (selectedLeads.length === paginatedRows.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(paginatedRows.map(r => r.opportunity_id));
    }
  };

  const handleSelectLead = (id: number) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
    );
  };

  const deleteLead = async (opportunityId: number) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) return;

    try {
      // ✅ fetchWithAuth already returns parsed JSON
      await fetchWithAuth(`/api/crm/leads/${opportunityId}`, {
        method: 'DELETE',
      });

      setRows(prev => prev.filter(r => r.opportunity_id !== opportunityId));
      setSelectedLeads(prev => prev.filter(id => id !== opportunityId));
      if (paginatedRows.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
      
      toast.success("Lead deleted successfully");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Error deleting lead");
    }
  };

  const bulkDeleteLeads = async () => {
    if (selectedLeads.length === 0) {
      alert("Please select leads to delete");
      return;
    }

    if (!window.confirm(`Are you sure you want to delete ${selectedLeads.length} lead(s)?`)) {
      return;
    }

    try {
      const deletePromises = selectedLeads.map(id =>
        fetchWithAuth(`/api/crm/leads/${id}`, {
          method: "DELETE",
        })
      );

      await Promise.all(deletePromises);

      setRows(prev => prev.filter(r => !selectedLeads.includes(r.opportunity_id)));
      setSelectedLeads([]);
      if (paginatedRows.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
      
      toast.success(`Successfully deleted ${deletePromises.length} lead(s)`);
    } catch (err) {
      console.error("Bulk delete error:", err);
      toast.error("Error deleting some leads");
    }
  };

  const getSupplierName = (supplierId: number | undefined | null): string => {
    if (!supplierId) return "—";
    const supplier = suppliers.find((s) => s.supplier_id === supplierId);
    return supplier?.supplier_name || "—";
  };

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (row.business_name || "").toLowerCase().includes(term) ||
        (row.contact_person || "").toLowerCase().includes(term) ||
        (row.email || "").toLowerCase().includes(term) ||
        (row.tel_number || "").toLowerCase().includes(term) ||
        (row.mpan_mpr || "").toLowerCase().includes(term);

      const matchesSupplier = supplierFilter === "All" || row.supplier_id === supplierFilter;
      const matchesStatus = statusFilter === "All" || getLeadStatusValue(row.stage_name) === statusFilter;

      return matchesSearch && matchesSupplier && matchesStatus;
    });
  }, [sortedRows, searchTerm, supplierFilter, statusFilter]);

  const totalPages = Math.ceil(filteredRows.length / CUSTOMERS_PER_PAGE);

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    const endIndex = startIndex + CUSTOMERS_PER_PAGE;
    return filteredRows.slice(startIndex, endIndex);
  }, [filteredRows, currentPage]);

  const updateLeadStatus = async (opportunityId: number, newStatus: string) => {
    // Check if user is selecting "Lost" - show confirmation
    if (newStatus.toLowerCase() === 'lost') {
      setLostConfirmation({
        isOpen: true,
        opportunityId,
        currentStatus: newStatus,
      });
      return;
    }

    // Check if user is selecting "Priced" - redirect to priced page
    if (newStatus.toLowerCase() === 'priced') {
      router.push('/dashboard/priced');
      return;
    }

    // For other statuses, proceed directly
    await performStatusUpdate(opportunityId, newStatus);
  };

  const performStatusUpdate = async (opportunityId: number, newStatus: string) => {
    try {
      await fetchWithAuth(`/api/crm/leads/${opportunityId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });

      setRows((prev) =>
        prev.map((row) =>
          row.opportunity_id === opportunityId ? { ...row, stage_name: newStatus } : row
        )
      );
    } catch (err) {
      console.error("Status update error:", err);
      toast.error("Error updating status");
    }
  };

  const PaginationControls = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">
            {Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredRows.length)}
          </span>{" "}
          of <span className="font-medium">{filteredRows.length}</span> leads
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
            onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
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
            onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
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
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">Leads</h1>

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

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Leads</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button 
              onClick={loadLeads} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

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
        </div>

        <div className="flex gap-2">
          {selectedLeads.length > 0 && (
            <Button onClick={bulkDeleteLeads} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedLeads.length})
            </Button>
          )}
          <Button 
            onClick={() => {
              setShowImportModal(true);
              toast('Leads can only be added via import');
            }}
            variant="outline"
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
          <Button
            onClick={() => {
              setShowImportModal(true);
              toast('Leads can only be added via import');
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
            <p className="mt-4 text-gray-500">Loading leads...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-lg text-red-600">Failed to load leads</p>
            <p className="mt-2 text-sm">{error}</p>
          </div>
        ) : paginatedRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg">No leads found.</p>
            {searchTerm || statusFilter !== "All" ? (
              <p className="mt-2 text-sm">Try adjusting your filters.</p>
            ) : (
              <p className="mt-2 text-sm">Import your first leads to get started!</p>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedLeads.length === paginatedRows.length && paginatedRows.length > 0}
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
                {paginatedRows.map((r) => {
                  const isSelected = selectedLeads.includes(r.opportunity_id);
                  const statusValue = getLeadStatusValue(r.stage_name);

                  return (
                    <tr
                      key={r.opportunity_id}
                      className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const menu = document.createElement('div');
                        menu.className = 'fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 py-1';
                        menu.style.left = `${e.pageX}px`;
                        menu.style.top = `${e.pageY}px`;

                        const deleteBtn = document.createElement('button');
                        deleteBtn.className = 'w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2';
                        deleteBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete';
                        deleteBtn.onclick = () => {
                          deleteLead(r.opportunity_id);
                          document.body.removeChild(menu);
                        };

                        menu.appendChild(deleteBtn);
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
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 mt-1"
                          checked={isSelected}
                          onChange={() => handleSelectLead(r.opportunity_id)}
                        />
                      </td>

                      <td className="px-2 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                        {r.opportunity_id}
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-700 align-top">
                        <div className="break-words max-w-[120px] leading-tight">
                          {r.contact_person || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="break-words max-w-[160px] leading-tight">
                          {r.business_name || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">
                          {r.tel_number || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs font-mono text-gray-900 align-top">
                        <div className="break-all max-w-[120px] leading-tight">
                          {r.mpan_mpr || "—"}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs text-gray-900 align-top">
                        <div className="break-words max-w-[120px] leading-tight">
                          {r.supplier_name || getSupplierName(r.supplier_id)}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">
                          {formatUsage(r.annual_usage)}
                        </div>
                      </td>

                      <td className="px-3 py-3 text-xs text-gray-700 align-top">
                        <div className="whitespace-nowrap">{formatDate(r.start_date)}</div>
                      </td>

                      <td className="px-3 py-3 text-xs text-gray-700 align-top">
                        <div className="whitespace-nowrap">{formatDate(r.end_date)}</div>
                      </td>

                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={statusValue}
                          onValueChange={(value) => updateLeadStatus(r.opportunity_id, value)}
                        >
                          <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                            <SelectValue placeholder="Set status">
                              {statusValue ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(statusValue)}`}>
                                  {getStatusLabel(statusValue)}
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

                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <Select
                          value={r.opportunity_owner_employee_id?.toString() || ""}
                          onValueChange={(value) => handleAssignSingle(r.opportunity_id, parseInt(value))}
                        >
                          <SelectTrigger className="h-7 text-xs w-full max-w-[130px]">
                            <SelectValue placeholder="Assign">
                              <span className="truncate text-xs">{r.assigned_to_name || "—"}</span>
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
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
                })}
              </tbody>
            </table>
          </div>
        )}

        {!isLoading && !error && filteredRows.length > 0 && <PaginationControls />}
      </div>

      {showImportModal && (
        <BulkImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportComplete={loadLeads}
          uploadEndpoint={`/api/crm/leads/import?service=${encodeURIComponent(service)}`}
          templateEndpoint="/api/crm/leads/import/template"
          templateFilename="leads_import_template.xlsx"
        />
      )}

      {/* Lost Confirmation Modal */}
      <Dialog 
        open={lostConfirmation.isOpen} 
        onOpenChange={(open) => {
          if (!open) {
            setLostConfirmation({ isOpen: false, opportunityId: null, currentStatus: null });
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Lead as Lost?</DialogTitle>
            <DialogDescription>
              This lead will be marked as lost. You can still view and update it later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button
              variant="outline"
              onClick={() => {
                setLostConfirmation({ isOpen: false, opportunityId: null, currentStatus: null });
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                const { opportunityId, currentStatus } = lostConfirmation;
                setLostConfirmation({ isOpen: false, opportunityId: null, currentStatus: null });
                if (opportunityId && currentStatus) {
                  await performStatusUpdate(opportunityId, currentStatus);
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