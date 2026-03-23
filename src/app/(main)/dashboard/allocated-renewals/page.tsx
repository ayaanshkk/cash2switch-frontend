"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Filter, AlertCircle, ChevronRight, ChevronLeft,
  ChevronLast, ChevronFirst, Users, UserCheck, Loader2, ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";
import { toast, Toaster } from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

// ---------------- Constants ----------------
const CUSTOMERS_PER_PAGE = 25;

const STATUS_OPTIONS = [
  { value: "Callback", label: "Callback" },
  { value: "Called", label: "Called" },
  { value: "Not Answered", label: "Not Answered" },
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
  "Callback":          { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Called":            { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
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
  if (!status) return "bg-gray-100 text-gray-800";
  const s = status.toLowerCase();
  if (s === "called" || s === "priced" || s === "callback") return "bg-green-100 text-green-800";
  if (s === "not answered") return "bg-yellow-100 text-yellow-800";
  if (s === "lost" || s === "lost cot") return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
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
  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";

  // Data
  const [allCustomers, setAllCustomers] = useState<EnergyCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
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
  const [endDateFilter, setEndDateFilter] = useState<"all" | "expired" | "30" | "60" | "90" | "90+">("all");
  const [usageSort, setUsageSort] = useState<"none" | "low-high" | "high-low">("none");

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

  useEffect(() => { setCurrentPage(1); }, [searchTerm, supplierFilter, statusFilter, salespersonFilter, endDateFilter, usageSort]);

  // ---------------- Fetch ----------------
  const fetchAllocatedContacts = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await fetchWithAuth(`/energy-clients/allocated?service=${encodeURIComponent(service)}`);
      const data: EnergyCustomer[] = Array.isArray(response) ? response : (response?.data || []);
      setAllCustomers(data);

      // Derive employee stats from the data itself
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
        else if (endDateFilter === "30") matchesEndDate = days >= 0 && days <= 30;
        else if (endDateFilter === "60") matchesEndDate = days > 30 && days <= 60;
        else if (endDateFilter === "90") matchesEndDate = days > 60 && days <= 90;
        else if (endDateFilter === "90+") matchesEndDate = days > 90 && days <= 365;
      }

      return matchesSearch && matchesSupplier && matchesStatus && matchesSalesperson && matchesEndDate;
    });

    if (usageSort !== "none") {
      filtered = [...filtered].sort((a, b) =>
        usageSort === "low-high"
          ? (a.annual_usage || 0) - (b.annual_usage || 0)
          : (b.annual_usage || 0) - (a.annual_usage || 0)
      );
    }

    return filtered;
  }, [allCustomers, searchTerm, supplierFilter, statusFilter, salespersonFilter, endDateFilter, usageSort, isAdmin]);

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
        // Update local state — update assigned_to in place for admin
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
        // Refresh employee stats since counts changed
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
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing{" "}
          <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)}</span>{" "}
          of <span className="font-medium">{filteredCustomers.length}</span> contacts
        </div>
        <div className="flex space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center px-3 text-sm text-gray-700">Page {currentPage} of {totalPages}</div>
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
  const colSpan = isAdmin ? 14 : 13;

  return (
    <div className="w-full p-6">
      <Toaster position="top-right" />

      <h1 className="mb-2 text-4xl font-semibold tracking-tight text-slate-900">Allocated Renewals</h1>
      <p className="mb-6 text-sm text-gray-500">
        {isAdmin
          ? "Records that have been reassigned from one salesperson to another."
          : "Records assigned to you by an administrator or reassigned from another salesperson."}
      </p>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur">
          {["utilities", "water"].map(s => (
            <button
              key={s}
              type="button"
              onClick={() => setService(s)}
              className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${
                service === s ? "bg-slate-900 text-white shadow" : "text-slate-700 hover:bg-slate-100"
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
          <h2 className="text-sm font-medium text-gray-700 mb-3">Allocated per Salesperson</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
            {employeeStats.map(stat => (
              <div
                key={stat.employee_id}
                onClick={() => setSalespersonFilter(salespersonFilter === stat.employee_id ? "All" : stat.employee_id)}
                className={`bg-white border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer ${
                  salespersonFilter === stat.employee_id
                    ? "border-indigo-400 ring-1 ring-indigo-300 bg-indigo-50"
                    : "border-gray-200"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span className="text-xs font-medium text-gray-500 truncate">{stat.employee_name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-gray-900">{stat.count}</span>
                  <span className="text-xs text-gray-500">contact{stat.count !== 1 ? "s" : ""}</span>
                </div>
              </div>
            ))}
          </div>
          {salespersonFilter !== "All" && (
            <button
              className="mt-2 text-xs text-indigo-600 hover:underline"
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
          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <UserCheck className="h-5 w-5 text-white" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Allocated to You</p>
                <p className="text-2xl font-bold text-gray-900">{allCustomers.length}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Contacts</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button onClick={fetchAllocatedContacts} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {/* Search & Filters */}
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="relative w-64">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input
            placeholder="Search contacts..."
            className="pl-8"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Admin: salesperson dropdown */}
        {isAdmin && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Users className="mr-2 h-4 w-4" />
                {salespersonFilter === "All"
                  ? "All Salespersons"
                  : employees.find(e => e.employee_id === salespersonFilter)?.employee_name || "Salesperson"}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSalespersonFilter("All")}>All Salespersons</DropdownMenuItem>
              {employees.map(e => (
                <DropdownMenuItem key={e.employee_id} onClick={() => setSalespersonFilter(e.employee_id)}>
                  {e.employee_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Supplier filter */}
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
            {suppliers.map(s => (
              <DropdownMenuItem key={s.supplier_id} onClick={() => setSupplierFilter(s.supplier_id)}>
                {s.supplier_name}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Status filter */}
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
            {STATUS_OPTIONS.map(s => (
              <DropdownMenuItem key={s.value} onClick={() => setStatusFilter(s.value)}>{s.label}</DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* End date filter */}
        <Select value={endDateFilter} onValueChange={(v: any) => setEndDateFilter(v)}>
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

        {/* Usage sort */}
        <Select value={usageSort} onValueChange={(v: any) => setUsageSort(v)}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Usage: Default</SelectItem>
            <SelectItem value="low-high">Usage: Low to High</SelectItem>
            <SelectItem value="high-low">Usage: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-2 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-10 border-r-2 border-gray-300">ID</th>
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
                {isAdmin && (
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">Assigned To</th>
                )}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={colSpan} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600" />
                    <p className="mt-4 text-gray-500">Loading allocated renewals...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={colSpan} className="px-6 py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600">Failed to load contacts</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={colSpan} className="px-6 py-12 text-center text-gray-500">
                    <UserCheck className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-lg">No allocated renewals yet.</p>
                    <p className="mt-2 text-sm">
                      {isAdmin
                        ? "Reassigned records will appear here."
                        : "Records assigned to you by an admin will appear here."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map(customer => {
                  const displayId = customer.display_order || customer.display_id || customer.id;
                  return (
                    <tr
                      key={customer.client_id}
                      className="hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => window.open(`/dashboard/renewals/${displayId}?cid=${customer.client_id}&from=allocated`, "_blank")}
                    >
                      <td className="px-2 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                        {displayId}
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-700 align-top overflow-hidden">
                        <div className="whitespace-normal break-words leading-tight">{customer.contact_person || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                        <div className="whitespace-normal break-words leading-tight">{customer.business_name || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{customer.phone ? String(customer.phone).replace(/\.0$/, "") : "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{customer.mobile_no ? String(customer.mobile_no).replace(/\.0$/, "") : "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                        <div className="truncate" title={customer.mpan_top || ""}>{customer.mpan_top || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                        <div className="truncate" title={customer.supplier_name || ""}>{customer.supplier_name || "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">{customer.annual_usage ? customer.annual_usage.toLocaleString() : "—"}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.start_date)}</div>
                      </td>

                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{formatDate(customer.end_date)}</div>
                      </td>

                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <Select
                          value={customer.status || ""}
                          onValueChange={value => openCallbackModal(customer.client_id, value === "CLEAR_STATUS" ? "" : value)}
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
                            {STATUS_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                            {customer.status && (
                              <>
                                <div className="border-t my-1" />
                                <SelectItem value="CLEAR_STATUS" className="text-red-600 font-medium">✕ Clear Status</SelectItem>
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
                            <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
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
                          <span className="text-sm text-gray-700">{customer.assigned_to_name || "—"}</span>
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
                <p className="text-xs text-gray-500">
                  {callbackStatus === "Already Renewed"
                    ? "Optional: Update if the contract end date has changed"
                    : "The contract end date will be updated to this new date"}
                </p>
              </div>
            )}

            {callbackStatus === "Already Renewed" && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Renewed By <span className="text-red-500">*</span></label>
                <div className="flex flex-col gap-2 p-3 border rounded-lg bg-gray-50">
                  {(["customer", "agent"] as const).map(val => (
                    <label key={val} className="flex items-center gap-3 cursor-pointer">
                      <input
                        type="radio"
                        name="renewedBy"
                        value={val}
                        checked={renewedBy === val}
                        onChange={() => setRenewedBy(val)}
                        className="w-4 h-4 accent-black"
                      />
                      <div>
                        <span className="text-sm font-medium text-gray-900">
                          {val === "customer" ? "Renewed by Customer" : "Renewed by Agent"}
                        </span>
                        <p className="text-xs text-gray-500">
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
              {statusConfig[callbackStatus]?.requiresNotes && (
                <p className="text-xs text-gray-500">Required: Please explain the reason for this status</p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
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
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Salesperson</DialogTitle>
            <DialogDescription>
              Add an optional note about this assignment
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Assigned To</label>
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
              <label className="text-sm font-medium text-gray-700">
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

          <div className="flex justify-end gap-2 mt-4">
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