"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Trash2, ChevronDown, Filter, AlertCircle,
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst, Zap,
  Users, UserCheck, Info, Loader2, CheckCircle2, RotateCcw,
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
import { fetchWithAuth } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { toast, Toaster } from "react-hot-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";

// ---------------- Constants ----------------
const CUSTOMERS_PER_PAGE = 25;
const CLEANSING_REASONS = ["Invalid Number", "Incorrect Supplier"] as const;
type CleansingReason = (typeof CLEANSING_REASONS)[number];

// ---------------- Types ----------------
interface CleansingRecord {
  id: number;
  client_id: number;
  display_id?: number;
  display_order?: number;
  business_name: string;
  contact_person: string | null;
  phone: string | null;
  mobile_no?: string | null;
  mpan_mpr?: string | null;
  mpan_top?: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  annual_usage?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  cleansing_reason: CleansingReason;
  flagged_at: string | null;
  notes?: string | null;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  source: "lead" | "energy_client";
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

// ---------------- Utility functions — identical to renewals ----------------
const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return "—"; }
};

const getReasonColor = (reason: CleansingReason) =>
  reason === "Invalid Number"
    ? "bg-amber-100 text-amber-800"
    : "bg-rose-100 text-rose-800";

// ================================================================
// PAGE
// ================================================================
export default function CleansingPage() {
  const [allRecords, setAllRecords] = useState<CleansingRecord[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [reasonFilter, setReasonFilter] = useState<CleansingReason | "All">("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecords, setSelectedRecords] = useState<number[]>([]);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);

  // Fix modal state
  const [showFixModal, setShowFixModal] = useState(false);
  const [fixingRecord, setFixingRecord] = useState<CleansingRecord | null>(null);
  const [fixPhone, setFixPhone] = useState("");
  const [fixSupplier, setFixSupplier] = useState("");
  const [fixNotes, setFixNotes] = useState("");
  const [fixError, setFixError] = useState("");
  const [isSubmittingFix, setIsSubmittingFix] = useState(false);

  // Delete modal state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<CleansingRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Derived counts
  const invalidCount = allRecords.filter(r => r.cleansing_reason === "Invalid Number").length;
  const incorrectSupplierCount = allRecords.filter(r => r.cleansing_reason === "Incorrect Supplier").length;

  // ---------------- Data Fetching ----------------
  const fetchRecords = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth("/api/crm/cleansing");
      setAllRecords(data.records ?? []);
    } catch (e: any) {
      setError(e.message ?? "Failed to load cleansing records");
      setAllRecords([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetchWithAuth("/suppliers");
      setSuppliers(Array.isArray(res) ? res : res?.data ?? []);
    } catch { setSuppliers([]); }
  };

  const fetchEmployees = async () => {
    try {
      const res = await fetchWithAuth("/employees");
      setEmployees(Array.isArray(res) ? res : res?.data ?? []);
    } catch { setEmployees([]); }
  };

  useEffect(() => {
    fetchRecords();
    fetchSuppliers();
    fetchEmployees();
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, reasonFilter]);

  // ---------------- Filter / Paginate ----------------
  const filteredRecords = useMemo(() => {
    return allRecords.filter(r => {
      const term = searchTerm.toLowerCase();
      const matchSearch =
        (r.business_name ?? "").toLowerCase().includes(term) ||
        (r.contact_person ?? "").toLowerCase().includes(term) ||
        (r.phone ?? "").includes(term) ||
        (r.supplier_name ?? "").toLowerCase().includes(term) ||
        (r.mpan_mpr ?? "").toLowerCase().includes(term);
      const matchReason = reasonFilter === "All" || r.cleansing_reason === reasonFilter;
      return matchSearch && matchReason;
    });
  }, [allRecords, searchTerm, reasonFilter]);

  const totalPages = Math.ceil(filteredRecords.length / CUSTOMERS_PER_PAGE);

  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    return filteredRecords.slice(start, start + CUSTOMERS_PER_PAGE);
  }, [filteredRecords, currentPage]);

  // ---------------- Selection — identical to renewals ----------------
  const handleSelectAll = () => {
    if (isSelectAllChecked) {
      setSelectedRecords([]);
      setIsSelectAllChecked(false);
    } else {
      setSelectedRecords(filteredRecords.map(r => r.client_id));
      setIsSelectAllChecked(true);
    }
  };

  const handleSelectRecord = (clientId: number) => {
    setSelectedRecords(prev => {
      const next = prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId];
      setIsSelectAllChecked(next.length === filteredRecords.length);
      return next;
    });
  };

  // ---------------- Fix & Restore ----------------
  const openFixModal = (record: CleansingRecord) => {
    setFixingRecord(record);
    setFixPhone(record.phone ?? "");
    setFixSupplier(record.supplier_name ?? "");
    setFixNotes("");
    setFixError("");
    setShowFixModal(true);
  };

  const handleSubmitFix = async () => {
    if (!fixingRecord) return;
    setFixError("");

    if (fixingRecord.cleansing_reason === "Invalid Number" && !fixPhone.trim()) {
      setFixError("Please enter the corrected phone number");
      return;
    }
    if (fixingRecord.cleansing_reason === "Incorrect Supplier" && !fixSupplier.trim()) {
      setFixError("Please enter the correct supplier name");
      return;
    }

    setIsSubmittingFix(true);
    try {
      const endpoint =
        fixingRecord.source === "lead"
          ? `/api/crm/leads/${fixingRecord.id}/cleanse`
          : `/energy-clients/${fixingRecord.client_id}/cleanse`;

      const response = await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "fix",
          tel_number: fixPhone.trim() || undefined,
          new_supplier: fixSupplier.trim() || undefined,
          notes: fixNotes.trim() || undefined,
          is_cleansed: true, // ✅ Mark as cleansed
        }),
      });

      if (!response || response.error) {
        throw new Error(response?.error || "Failed to fix record");
      }

      setAllRecords(prev => prev.filter(r => r.client_id !== fixingRecord.client_id));
      setSelectedRecords(prev => prev.filter(id => id !== fixingRecord.client_id));
      
      const destination = fixingRecord.source === "lead" ? "Leads" : "Renewals";
      toast.success(`✅ Record fixed and restored to ${destination}`);
      setShowFixModal(false);
    } catch (e: any) {
      setFixError(e.message ?? "Failed to fix record");
    } finally {
      setIsSubmittingFix(false);
    }
  };

  // ---------------- Delete (via context menu, same as renewals) ----------------
  const deleteRecord = async (record: CleansingRecord) => {
    if (!window.confirm("Are you sure you want to permanently delete this record?")) return;
    try {
      const endpoint =
        record.source === "lead"
          ? `/api/crm/leads/${record.id}/cleanse`
          : `/api/energy-clients/${record.client_id}/cleanse`;

      await fetchWithAuth(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete" }),
      });

      setAllRecords(prev => prev.filter(r => r.client_id !== record.client_id));
      setSelectedRecords(prev => prev.filter(id => id !== record.client_id));
      toast.success("🗑️ Record permanently deleted");
    } catch (e: any) {
      toast.error(e.message ?? "Failed to delete record");
    }
  };

  // ---------------- Bulk Delete ----------------
  const bulkDeleteRecords = async () => {
    if (selectedRecords.length === 0) return;
    if (!window.confirm(`Are you sure you want to permanently delete ${selectedRecords.length} record(s)?`)) return;
    try {
      const targets = allRecords.filter(r => selectedRecords.includes(r.client_id));
      await Promise.all(targets.map(r => {
        const endpoint =
          r.source === "lead"
            ? `/api/crm/leads/${r.id}/cleanse`
            : `/api/energy-clients/${r.client_id}/cleanse`;
        return fetchWithAuth(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "delete" }),
        });
      }));
      setAllRecords(prev => prev.filter(r => !selectedRecords.includes(r.client_id)));
      setSelectedRecords([]);
      setIsSelectAllChecked(false);
      toast.success(`✅ Deleted ${targets.length} record(s)`);
    } catch {
      toast.error("Error deleting some records");
    }
  };

  // ---------------- Pagination Controls — identical to renewals ----------------
  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredRecords.length)}</span>{" "}
          of <span className="font-medium">{filteredRecords.length}</span> records
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

  // ================================================================
  // RENDER
  // ================================================================
  return (
    <div className="w-full p-6">
      <Toaster position="top-right" />
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">Cleansing</h1>

      {/* Stats — same style as Team Overview in renewals */}
      <div className="mb-6">
        <h2 className="text-sm font-medium text-gray-700 mb-3">Overview</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
            <div className="flex items-center gap-2 mb-2">
              <Zap className="h-4 w-4 text-slate-600" />
              <span className="text-xs font-medium text-gray-500">Total</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-gray-900">{allRecords.length}</span>
              <span className="text-xs text-gray-500">awaiting cleanse</span>
            </div>
          </div>
          <div
            className="bg-amber-50 border border-amber-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setReasonFilter(reasonFilter === "Invalid Number" ? "All" : "Invalid Number")}
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-600">Invalid Number</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-amber-700">{invalidCount}</span>
              <span className="text-xs text-amber-600">record{invalidCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
          <div
            className="bg-rose-50 border border-rose-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
            onClick={() => setReasonFilter(reasonFilter === "Incorrect Supplier" ? "All" : "Incorrect Supplier")}
          >
            <div className="flex items-center gap-2 mb-2">
              <Users className="h-4 w-4 text-rose-600" />
              <span className="text-xs font-medium text-rose-600">Incorrect Supplier</span>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-rose-700">{incorrectSupplierCount}</span>
              <span className="text-xs text-rose-600">record{incorrectSupplierCount !== 1 ? "s" : ""}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Records</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button onClick={fetchRecords} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {/* Bulk selection bar — identical to renewals */}
      {selectedRecords.length > 0 && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <UserCheck className="h-5 w-5 text-blue-600" />
              <div>
                <h3 className="font-semibold text-blue-900">{selectedRecords.length} record(s) selected</h3>
                <p className="text-sm text-blue-700">You can bulk delete the selected records</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => { setSelectedRecords([]); setIsSelectAllChecked(false); }}>
              Clear Selection
            </Button>
          </div>
        </div>
      )}

      {/* Search & Filter Bar — same layout as renewals */}
      <div className="mb-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Search records..."
              className="pl-8"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {reasonFilter === "All" ? "All Reasons" : reasonFilter}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setReasonFilter("All")}>All Reasons</DropdownMenuItem>
              {CLEANSING_REASONS.map(r => (
                <DropdownMenuItem key={r} onClick={() => setReasonFilter(r)}>{r}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex gap-2 items-center">
          <Button variant="outline" onClick={fetchRecords}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
          {selectedRecords.length > 0 && (
            <Button onClick={bulkDeleteRecords} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedRecords.length})
            </Button>
          )}
        </div>
      </div>

      {/* Table — exact same structure/classes as renewals */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 table-fixed">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={selectedRecords.length === paginatedRecords.length && paginatedRecords.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                {/* ID — same border-r-2 as renewals */}
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-20 border-r-2 border-gray-300">
                  ID
                </th>
                {/* Same widths as renewals */}
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                  Client Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[10%]">
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
                {/* Reason replaces Status */}
                <th className="px-3 py-3 text-center text-xs font-medium tracking-wider text-gray-500 uppercase w-[10%]">
                  Reason
                </th>
                {/* Assigned To — same as renewals */}
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[12%]">
                  Assigned To
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
                    <p className="mt-4 text-gray-500">Loading cleansing records...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600">Failed to load records</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </td>
                </tr>
              ) : paginatedRecords.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    <CheckCircle2 className="h-12 w-12 text-green-400 mx-auto mb-3" />
                    <p className="text-lg">
                      {searchTerm || reasonFilter !== "All" ? "No matching records found" : "All clean!"}
                    </p>
                    <p className="mt-2 text-sm">
                      {searchTerm || reasonFilter !== "All"
                        ? "Try adjusting your search or filter"
                        : "No records need cleansing right now"}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedRecords.map(record => {
                  const isSelected = selectedRecords.includes(record.client_id);
                  const displayId = record.display_order || record.display_id || record.id;

                  return (
                    <tr
                      key={record.client_id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? "bg-blue-50" : ""}`}
                      onClick={() => openFixModal(record)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const menu = document.createElement("div");
                        menu.className = "fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 py-1";
                        menu.style.left = `${e.pageX}px`;
                        menu.style.top = `${e.pageY}px`;

                        const fixBtn = document.createElement("button");
                        fixBtn.className = "w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2";
                        fixBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg> Fix & Restore';
                        fixBtn.onclick = () => { openFixModal(record); document.body.removeChild(menu); };

                        const deleteBtn = document.createElement("button");
                        deleteBtn.className = "w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2";
                        deleteBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete';
                        deleteBtn.onclick = () => { deleteRecord(record); document.body.removeChild(menu); };

                        menu.appendChild(fixBtn);
                        menu.appendChild(deleteBtn);
                        document.body.appendChild(menu);

                        const closeMenu = (ev: MouseEvent) => {
                          if (!menu.contains(ev.target as Node)) {
                            if (document.body.contains(menu)) document.body.removeChild(menu);
                            document.removeEventListener("click", closeMenu);
                          }
                        };
                        setTimeout(() => document.addEventListener("click", closeMenu), 0);
                      }}
                    >
                      {/* Checkbox */}
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 mt-1"
                          checked={isSelected}
                          onChange={() => handleSelectRecord(record.client_id)}
                        />
                      </td>

                      {/* ID — same as renewals with border-r-2 */}
                      <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                        <div className="flex items-center gap-1 whitespace-nowrap">
                          {displayId}
                          {record.source === "lead" && (
                            <span title="From Leads" className="inline-flex">
                              <Info className="h-3 w-3 text-blue-500" />
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Client Name — same as renewals */}
                      <td className="px-3 py-3 text-sm text-gray-700 align-top">
                        {record.contact_person || "—"}
                      </td>

                      {/* Trading Name — same as renewals */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        {record.business_name}
                      </td>

                      {/* Tel No — plain gray, same as renewals, no colour */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">
                          {record.phone ? String(record.phone).replace(/\.0$/, "") : "—"}
                        </div>
                      </td>

                      {/* Mobile No — same as renewals */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">
                          {record.mobile_no ? String(record.mobile_no).replace(/\.0$/, "") : "—"}
                        </div>
                      </td>

                      {/* MPAN Top — same as renewals */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                        <div className="truncate" title={record.mpan_top || ""}>{record.mpan_top || "—"}</div>
                      </td>

                      {/* Supplier — same as renewals */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                        <div className="truncate" title={record.supplier_name || ""}>{record.supplier_name || "—"}</div>
                      </td>

                      {/* Annual Usage — same as renewals */}
                      <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">
                          {record.annual_usage ? record.annual_usage.toLocaleString() : "—"}
                        </div>
                      </td>

                      {/* Start Date — same as renewals */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{formatDate(record.start_date)}</div>
                      </td>

                      {/* Contract End — same as renewals */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{formatDate(record.end_date)}</div>
                      </td>

                      {/* Reason badge — replaces Status dropdown */}
                      <td className="px-3 py-3 align-top text-center" onClick={e => e.stopPropagation()}>
                        <Badge variant="outline" className={`text-xs ${getReasonColor(record.cleansing_reason)}`}>
                          {record.cleansing_reason}
                        </Badge>
                      </td>

                      {/* Assigned To */}
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <Select
                          value={record.assigned_to_id?.toString() || "0"}
                          onValueChange={(value) => {
                            // optimistic update
                            setAllRecords(prev =>
                              prev.map(r =>
                                r.client_id === record.client_id
                                  ? {
                                      ...r,
                                      assigned_to_id: value === "0" ? null : parseInt(value),
                                      assigned_to_name: value === "0" ? null : employees.find(e => e.employee_id === parseInt(value))?.employee_name || null,
                                    }
                                  : r
                              )
                            );
                            // persist
                            const endpoint = record.source === "lead"
                              ? `/api/crm/leads/${record.id}/cleanse-assign`
                              : `/api/energy-clients/${record.client_id}`;
                            fetchWithAuth(endpoint, {
                              method: "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify({ assigned_to_id: value === "0" ? null : parseInt(value) }),
                            }).catch(() => toast.error("Failed to assign"));
                          }}
                        >
                          <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                            <SelectValue placeholder="Assign">
                              {record.assigned_to_name || "Unassigned"}
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
                      </td>

                      {/* Actions */}
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 px-2 text-xs"
                          onClick={() => openFixModal(record)}
                        >
                          Fix & Restore
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && !error && filteredRecords.length > 0 && <PaginationControls />}
      </div>

      {/* ────────────── Fix & Restore Modal ────────────── */}
      <Dialog open={showFixModal} onOpenChange={setShowFixModal}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Fix & Restore Record</DialogTitle>
            <DialogDescription>
              Correct the information below, then restore it back to {fixingRecord?.source === "lead" ? "Leads" : "Renewals"}.
            </DialogDescription>
          </DialogHeader>

          {fixingRecord && (
            <div className="space-y-4 py-4">
              {fixError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{fixError}</AlertDescription>
                </Alert>
              )}

              <div className="p-3 bg-gray-50 border rounded-lg space-y-1">
                <p className="text-sm font-semibold text-gray-900">{fixingRecord.business_name}</p>
                {fixingRecord.contact_person && (
                  <p className="text-xs text-gray-500">{fixingRecord.contact_person}</p>
                )}
                <Badge variant="outline" className={`text-xs mt-1 ${getReasonColor(fixingRecord.cleansing_reason)}`}>
                  {fixingRecord.cleansing_reason}
                </Badge>
              </div>

              {fixingRecord.cleansing_reason === "Invalid Number" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Correct Phone Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="tel"
                    placeholder="e.g. 0207 123 4567"
                    value={fixPhone}
                    onChange={e => setFixPhone(e.target.value)}
                  />
                  {fixingRecord.phone && (
                    <p className="text-xs text-gray-500">Current value: {fixingRecord.phone}</p>
                  )}
                </div>
              )}

              {fixingRecord.cleansing_reason === "Incorrect Supplier" && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Correct Supplier <span className="text-red-500">*</span>
                  </label>
                  <Select value={fixSupplier} onValueChange={setFixSupplier}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map(s => (
                        <SelectItem key={s.supplier_id} value={s.supplier_name}>
                          {s.supplier_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    type="text"
                    placeholder="Or type supplier name if not listed above"
                    value={fixSupplier}
                    onChange={e => setFixSupplier(e.target.value)}
                  />
                  {fixingRecord.supplier_name && (
                    <p className="text-xs text-gray-500">Current value: {fixingRecord.supplier_name}</p>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Notes <span className="text-gray-400 text-xs">(optional)</span>
                </label>
                <Textarea
                  placeholder="Add any context about this fix..."
                  value={fixNotes}
                  onChange={e => setFixNotes(e.target.value)}
                  rows={3}
                />
              </div>

              <Alert>
                <RotateCcw className="h-4 w-4" />
                <AlertDescription>
                  Once fixed, this record will be restored to <strong>{fixingRecord.source === "lead" ? "Leads" : "Renewals"}</strong> with the corrected information.
                </AlertDescription>
              </Alert>
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowFixModal(false)} disabled={isSubmittingFix}>
              Cancel
            </Button>
            <Button onClick={handleSubmitFix} disabled={isSubmittingFix}>
              {isSubmittingFix
                ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                : `Fix & Restore to ${fixingRecord?.source === "lead" ? "Leads" : "Renewals"}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}