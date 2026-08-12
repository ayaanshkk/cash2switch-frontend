"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  Upload, RefreshCw, Trash2, Zap,
  ChevronLeft, ChevronRight, ChevronFirst, ChevronLast,
  Users, Search,
} from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const DRAFTS_PER_PAGE = 25;
const POLL_INTERVAL_MS = 2000;

interface Employee { employee_id: number; employee_name: string; }
interface Supplier  { supplier_id: number; supplier_name: string; }

interface ImportProgress {
  pct: number;
  processed: number;
  total: number;
  successful: number;
  status: "running" | "done" | "failed";
}

interface DraftLead {
  opportunity_id: number;
  tenant_lead_id?: number | null;
  business_name?: string | null;
  contact_person?: string | null;
  tel_number?: string | number | null;
  mobile_no?: string | number | null;
  email?: string | null;
  mpan_mpr?: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  stage_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  annual_usage?: number | string | null;
  assigned_to_name?: string | null;
  opportunity_owner_employee_id?: number | null;
  created_at?: string | null;
}

// ---------------------------------------------------------------------------
// Pure helpers
// ---------------------------------------------------------------------------

const isUnassigned = (v: unknown) =>
  v === null || v === undefined || v === "" || v === 0;

function formatListDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return "—"; }
}

function formatTel(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\.0$/, "");
}

function parseAnnualUsage(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

// ---------------------------------------------------------------------------
// ProgressBar sub-component
// ---------------------------------------------------------------------------

function ImportProgressBar({ progress }: { progress: ImportProgress }) {
  return (
    <div className="mt-3 space-y-1">
      <div className="flex justify-between text-xs text-gray-500">
        <span>
          {progress.status === "done"
            ? `Complete — ${progress.successful.toLocaleString()} imported`
            : progress.status === "failed"
            ? "Import failed"
            : `Processing… ${progress.processed.toLocaleString()} / ${progress.total.toLocaleString()}`}
        </span>
        <span>{progress.pct}%</span>
      </div>
      <div className="w-full rounded-full bg-gray-200 h-2.5">
        <div
          className={`h-2.5 rounded-full transition-all duration-500 ${
            progress.status === "failed" ? "bg-red-500" : "bg-blue-600"
          }`}
          style={{ width: `${progress.pct}%` }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function DraftsPage() {
  const [leads, setLeads]         = useState<DraftLead[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading]     = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting]   = useState(false);
  const [importProgress, setImportProgress] = useState<ImportProgress | null>(null);
  const [assigning, setAssigning]   = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds]       = useState<number[]>([]);
  const [currentLeadsPage, setCurrentLeadsPage]     = useState(1);
  const [searchTerm, setSearchTerm]         = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");
  const [showBulkAssignModal, setShowBulkAssignModal]       = useState(false);
  const [bulkAssignEmployeeId, setBulkAssignEmployeeId]     = useState("");
  const [bulkAssignEmployeeName, setBulkAssignEmployeeName] = useState("");
  const [isBulkAssigning, setIsBulkAssigning]               = useState(false);
  const [endDateFilter, setEndDateFilter] = useState<"all" | "365" | "30" | "60" | "90" | "90+">("all");
  const [usageSort, setUsageSort] = useState<"none" | "low-high" | "high-low">("none");
  const [bulkAssignQuantity, setBulkAssignQuantity] = useState<string>("");


  // keep a ref so the polling loop can be cancelled when the dialog closes
  const pollAbortRef = useRef<AbortController | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadRows, employeeRows, supplierRows] = await Promise.all([
        fetchWithAuth("/api/crm/leads/drafts"),
        fetchWithAuth("/employees"),
        fetchWithAuth("/suppliers"),
      ]);
      setLeads(Array.isArray(leadRows) ? leadRows : leadRows?.data ?? []);
      setEmployees(Array.isArray(employeeRows) ? employeeRows : employeeRows?.data ?? []);
      setSuppliers(Array.isArray(supplierRows) ? supplierRows : supplierRows?.data ?? []);
      
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);
  useEffect(() => { setCurrentLeadsPage(1); }, [searchTerm, selectedSupplier, endDateFilter, usageSort]);

  // ── Filtering + pagination ────────────────────────────────────────────────

  const applyFilters = useCallback(
      (items: DraftLead[]) => {
        let filtered = [...items];
        if (searchTerm.trim()) {
          const s = searchTerm.toLowerCase();
          filtered = filtered.filter((item) => {
            const business = (item.business_name as string | null) ?? "";
            const contact  = (item.contact_person as string | null) ?? "";
            const mpan     = (item.mpan_mpr as string | null) ?? "";
            return (
              business.toLowerCase().includes(s) ||
              contact.toLowerCase().includes(s) ||
              mpan.toLowerCase().includes(s)
            );
          });
        }
        if (selectedSupplier !== "all") {
          filtered = filtered.filter((item) => {
            const sid = "supplier_id" in item ? item.supplier_id : null;
            return sid?.toString() === selectedSupplier;
          });
        }
        if (endDateFilter !== "all") {
          const today = new Date();
          filtered = filtered.filter((item) => {
            if (!item.end_date) return false;
            const end  = new Date(item.end_date);
            const days = Math.ceil((end.getTime() - today.getTime()) / 86400000);
            if (endDateFilter === "365") return days >= 0 && days <= 365;
            if (endDateFilter === "30")  return days >= 0 && days <= 30;
            if (endDateFilter === "60")  return days > 30 && days <= 60;
            if (endDateFilter === "90")  return days > 60 && days <= 90;
            if (endDateFilter === "90+") return days > 90;
            return true;
          });
        }
        if (usageSort !== "none") {
          filtered = [...filtered].sort((a, b) => {
            const au = parseAnnualUsage(a.annual_usage) ?? 0;
            const bu = parseAnnualUsage(b.annual_usage) ?? 0;
            return usageSort === "low-high" ? au - bu : bu - au;
          });
        }
        return filtered;
      },
      [searchTerm, selectedSupplier, endDateFilter, usageSort],
    );

  const draftLeads = useMemo(() => {
    const unassigned = leads.filter((l) => isUnassigned(l.opportunity_owner_employee_id));
    return applyFilters(unassigned) as DraftLead[];
  }, [leads, applyFilters]);

  const totalLeadsPages = Math.max(1, Math.ceil(draftLeads.length / DRAFTS_PER_PAGE));

  const paginatedLeads = useMemo(() => {
    const start = (currentLeadsPage - 1) * DRAFTS_PER_PAGE;
    return draftLeads.slice(start, start + DRAFTS_PER_PAGE);
  }, [draftLeads, currentLeadsPage]);

  const selectedIds = selectedLeadIds;

  // ── Import + polling ──────────────────────────────────────────────────────

  /**
   * Poll GET /import/status/<job_id> until done or failed.
   * Cancellable via AbortController stored in pollAbortRef.
   */
  const pollJob = useCallback(async (jobId: string): Promise<void> => {
    const ctrl = new AbortController();
    pollAbortRef.current = ctrl;

    const token    = localStorage.getItem("auth_token") ?? "";
    const tenantId = localStorage.getItem("tenant_id")  ?? "2";

    while (!ctrl.signal.aborted) {
      await new Promise<void>((res) => {
        const t = setTimeout(res, POLL_INTERVAL_MS);
        ctrl.signal.addEventListener("abort", () => { clearTimeout(t); res(); });
      });
      if (ctrl.signal.aborted) break;

      try {
        const res = await fetch(`${API_BASE_URL}/import/status/${jobId}`, {
          headers: { Authorization: `Bearer ${token}`, "X-Tenant-ID": tenantId },
          signal: ctrl.signal,
        });
        if (!res.ok) break;
        const data = await res.json();

        setImportProgress({
          pct:       data.progress_pct ?? 0,
          processed: data.processed    ?? 0,
          total:     data.total        ?? 0,
          successful: data.successful  ?? 0,
          status:    data.status,
        });

        if (data.status === "done") {
          toast.success(
            `Import complete — ${(data.successful ?? 0).toLocaleString()} records imported` +
            (data.duplicates ? `, ${data.duplicates.toLocaleString()} duplicates skipped` : ""),
          );
          break;
        }
        if (data.status === "failed") {
          toast.error(`Import failed: ${data.errors?.[0] ?? "Unknown error"}`);
          break;
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          toast.error("Lost connection to import job");
        }
        break;
      }
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!importFile) return;
    setImporting(true);
    setImportProgress({ pct: 0, processed: 0, total: 0, successful: 0, status: "running" });

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("is_draft", "true");

      const token    = localStorage.getItem("auth_token") ?? "";
      const tenantId = localStorage.getItem("tenant_id")  ?? "2";

      // Both endpoints now return { job_id, total_rows } with HTTP 202
      const endpoint = `${API_BASE_URL}/import/leads?service=utilities`;

      const res = await fetch(endpoint, {
        method:  "POST",
        headers: { Authorization: `Bearer ${token}`, "X-Tenant-ID": tenantId },
        body:    formData,
      });

      const body = await res.json();

      if (!res.ok) {
        throw new Error(body?.error ?? body?.message ?? "Upload failed");
      }

      const { job_id, total_rows } = body as { job_id: string; total_rows: number };

      toast.success(
        `File uploaded (${(total_rows ?? 0).toLocaleString()} rows). Processing in background…`,
      );

      // Poll until the job finishes
      await pollJob(job_id);

    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        toast.error(err instanceof Error ? err.message : "Import failed");
      }
    } finally {
      setImporting(false);
      // Keep the dialog open briefly so the user sees "Complete", then close
      setTimeout(async () => {
        setImportProgress(null);
        setImportOpen(false);
        setImportFile(null);
        await loadData();
      }, 1500);
    }
  }, [importFile, pollJob, loadData]);

  // Cancel poll when the dialog is force-closed
  const handleImportDialogClose = useCallback((open: boolean) => {
    if (!open) {
      pollAbortRef.current?.abort();
      if (!importing) {
        setImportProgress(null);
        setImportFile(null);
      }
    }
    setImportOpen(open);
  }, [importing]);

  // ── Assignment helpers ────────────────────────────────────────────────────

  const assignDraft = useCallback(async (id: number, employeeIdStr: string) => {
    if (!employeeIdStr || employeeIdStr === "0") {
      toast.error("Select a salesperson");
      return;
    }
    setAssigning(true);
    try {
      const employeeId = Number(employeeIdStr);
      const emp = employees.find((e) => e.employee_id === employeeId);

      await fetchWithAuth("/api/crm/leads/assign", {
        method: "PATCH",
        body:   JSON.stringify({ lead_ids: [id], employee_id: employeeId }),
      });
      setLeads((prev) => prev.filter((l) => l.opportunity_id !== id));
      setSelectedLeadIds((prev) => prev.filter((x) => x !== id));

      toast.success(`Assigned to ${emp?.employee_name ?? "salesperson"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setAssigning(false);
    }
  }, [employees]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleLead    = (id: number) =>
    setSelectedLeadIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleAllLeads = () => {
    const pageIds = paginatedLeads.map((l) => l.opportunity_id);
    const allSel  = pageIds.every((id) => selectedLeadIds.includes(id));
    setSelectedLeadIds((p) =>
      allSel ? p.filter((id) => !pageIds.includes(id)) : [...new Set([...p, ...pageIds])],
    );
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteSelectedDrafts = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      const result = await fetchWithAuth("/api/crm/leads/drafts", {
        method: "DELETE",
        body:   JSON.stringify({ lead_ids: selectedLeadIds }),
      });
      const deleted = Array.isArray(result?.deleted_ids) ? result.deleted_ids : selectedLeadIds;
      setLeads((p) => p.filter((l) => !deleted.includes(l.opportunity_id)));
      setSelectedLeadIds([]);
      toast.success(`Deleted ${deleted.length} draft lead${deleted.length === 1 ? "" : "s"}`);
      setDeleteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [selectedIds.length, selectedLeadIds]);

  const handleBulkAssign = useCallback(async () => {
      if (!bulkAssignEmployeeId) {
        toast.error("Select a salesperson");
        return;
      }

      const employeeId = Number(bulkAssignEmployeeId);
      const emp = employees.find((e) => e.employee_id === employeeId);

      // Determine which lead IDs to assign:
      // If quantity is entered, take that many from the full unassigned list (ignoring selection).
      // Otherwise use the selected IDs.
      let idsToAssign: number[];
      const qty = parseInt(bulkAssignQuantity, 10);
      if (!isNaN(qty) && qty > 0) {
        idsToAssign = draftLeads.slice(0, qty).map((l) => l.opportunity_id);
        if (idsToAssign.length === 0) {
          toast.error("No leads available to assign");
          return;
        }
      } else {
        if (selectedIds.length === 0) {
          toast.error("Select leads or enter a quantity");
          return;
        }
        idsToAssign = selectedLeadIds;
      }

      setIsBulkAssigning(true);
      try {
        await fetchWithAuth("/api/crm/leads/assign", {
          method: "PATCH",
          body:   JSON.stringify({ lead_ids: idsToAssign, employee_id: employeeId }),
        });
        setLeads((prev) => prev.filter((l) => !idsToAssign.includes(l.opportunity_id)));
        setSelectedLeadIds([]);
        toast.success(`Assigned ${idsToAssign.length} leads to ${emp?.employee_name}`);
        setShowBulkAssignModal(false);
        setBulkAssignEmployeeId("");
        setBulkAssignEmployeeName("");
        setBulkAssignQuantity("");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Bulk assignment failed");
      } finally {
        setIsBulkAssigning(false);
      }
    }, [bulkAssignEmployeeId, bulkAssignQuantity, draftLeads, employees, selectedIds.length, selectedLeadIds]);

  // ── Pagination sub-component ──────────────────────────────────────────────

  const PaginationControls = ({
      currentPage, totalPages, onPageChange, totalItems,
    }: { currentPage: number; totalPages: number; onPageChange: (p: number) => void; totalItems: number }) => {
      if (totalPages <= 1) return null;
      const start = (currentPage - 1) * DRAFTS_PER_PAGE + 1;
      const end   = Math.min(currentPage * DRAFTS_PER_PAGE, totalItems);
      return (
        <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
          <div className="text-sm text-gray-700">
            Showing <span className="font-medium">{start}</span> to{" "}
            <span className="font-medium">{end}</span> of{" "}
            <span className="font-medium">{totalItems}</span> leads
          </div>
          <div className="flex space-x-1">
            <Button variant="outline" size="icon" onClick={() => onPageChange(1)}                disabled={currentPage === 1}><ChevronFirst className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage - 1)} disabled={currentPage === 1}><ChevronLeft  className="h-4 w-4" /></Button>
            <div className="flex items-center px-3 text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </div>
            <Button variant="outline" size="icon" onClick={() => onPageChange(currentPage + 1)} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
            <Button variant="outline" size="icon" onClick={() => onPageChange(totalPages)}      disabled={currentPage === totalPages}><ChevronLast  className="h-4 w-4" /></Button>
          </div>
        </div>
      );
    };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster position="top-right" />

      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Drafts</h1>
          <p className="text-sm text-gray-600">
            Import draft leads and renewals, then assign them when ready.
          </p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Inline filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search clients…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map((s) => (
              <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>
                {s.supplier_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={endDateFilter} onValueChange={(v) => setEndDateFilter(v as typeof endDateFilter)}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Contract End" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Contracts</SelectItem>
            <SelectItem value="365">Ending in 0-365 days</SelectItem>
            <SelectItem value="30">Ending in 30 days</SelectItem>
            <SelectItem value="60">Ending in 31–60 days</SelectItem>
            <SelectItem value="90">Ending in 61–90 days</SelectItem>
            <SelectItem value="90+">Ending in 90+ days</SelectItem>
          </SelectContent>
        </Select>
        <Select value={usageSort} onValueChange={(v) => setUsageSort(v as typeof usageSort)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Usage Sort" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Usage: Default</SelectItem>
            <SelectItem value="low-high">Usage: Low to High</SelectItem>
            <SelectItem value="high-low">Usage: High to Low</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-medium text-gray-700">
            Leads {draftLeads.length > 0 && `(${draftLeads.length.toLocaleString()})`}
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" onClick={() => setShowBulkAssignModal(true)} disabled={selectedIds.length === 0}>
              <Users className="mr-2 h-4 w-4" />
              Assign Selected ({selectedIds.length})
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={selectedIds.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import Leads
            </Button>
          </div>
        </div>

        <DraftLeadsTable
          loading={loading}
          rows={paginatedLeads}
          emptyLabel="No draft leads"
          selectedIds={selectedLeadIds}
          onToggle={toggleLead}
          onToggleAll={toggleAllLeads}
          onAssign={assignDraft}
          employees={employees}
          allSelected={paginatedLeads.length > 0 && paginatedLeads.every((l) => selectedLeadIds.includes(l.opportunity_id))}
          currentPage={currentLeadsPage}
        />
        {!loading && (
          <PaginationControls
            currentPage={currentLeadsPage}
            totalPages={totalLeadsPages}
            onPageChange={setCurrentLeadsPage}
            totalItems={draftLeads.length}
          />
        )}
      </div>

      {/* ── Bulk assign dialog ── */}
      <Dialog open={showBulkAssignModal} onOpenChange={(open) => {
        setShowBulkAssignModal(open);
        if (!open) { setBulkAssignQuantity(""); setBulkAssignEmployeeId(""); setBulkAssignEmployeeName(""); }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bulk Assign Leads</DialogTitle>
            <DialogDescription>
              {bulkAssignQuantity && !isNaN(parseInt(bulkAssignQuantity, 10))
                ? `Will assign the first ${parseInt(bulkAssignQuantity, 10)} leads from the current list.`
                : selectedIds.length > 0
                ? `Will assign ${selectedIds.length} selected lead(s).`
                : "Select leads or enter a quantity below."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Salesperson</label>
              <Select value={bulkAssignEmployeeId} onValueChange={(v) => {
                setBulkAssignEmployeeId(v);
                setBulkAssignEmployeeName(employees.find(e => e.employee_id === Number(v))?.employee_name || "");
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select salesperson" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp) => (
                    <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                      {emp.employee_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Quantity <span className="text-gray-400 font-normal">(optional — overrides selection)</span>
              </label>
              <Input
                type="number"
                min={1}
                max={draftLeads.length}
                placeholder={`e.g. 100 (max ${draftLeads.length.toLocaleString()})`}
                value={bulkAssignQuantity}
                onChange={(e) => setBulkAssignQuantity(e.target.value)}
              />
              {bulkAssignQuantity && !isNaN(parseInt(bulkAssignQuantity, 10)) && (
                <p className="text-xs text-blue-600 mt-1">
                  Will assign the first {Math.min(parseInt(bulkAssignQuantity, 10), draftLeads.length).toLocaleString()} leads from the current filtered list.
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setShowBulkAssignModal(false)} disabled={isBulkAssigning}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign} disabled={!bulkAssignEmployeeId || isBulkAssigning}>
              {isBulkAssigning && <span className="mr-2">⏳</span>}
              {bulkAssignQuantity && !isNaN(parseInt(bulkAssignQuantity, 10))
                ? `Assign ${Math.min(parseInt(bulkAssignQuantity, 10), draftLeads.length).toLocaleString()} Leads`
                : `Assign ${selectedIds.length} Lead${selectedIds.length !== 1 ? "s" : ""}`}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import dialog ── */}
      <Dialog open={importOpen} onOpenChange={handleImportDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Import Lead Drafts
            </DialogTitle>
            <DialogDescription>
              Large files are processed in the background — you can track progress below.
              Imported records stay in drafts until assigned.
            </DialogDescription>
          </DialogHeader>

          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={importing}
            onChange={(e) => setImportFile(e.target.files?.[0] ?? null)}
          />

          {importProgress && <ImportProgressBar progress={importProgress} />}

          <div className="flex justify-end gap-2 pt-1">
            <Button
              variant="outline"
              onClick={() => handleImportDialogClose(false)}
              disabled={importing && importProgress?.status === "running"}
            >
              {importing ? "Running in background…" : "Cancel"}
            </Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing
                ? <><span className="mr-2">⏳</span>Importing…</>
                : "Import"
              }
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected drafts?</DialogTitle>
            <DialogDescription>
              This will permanently delete {selectedIds.length} draft{" "}
              leads from the database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteSelectedDrafts}
              disabled={selectedIds.length === 0 || deleting}
            >
              {deleting && <span className="mr-2">⏳</span>}
              Delete {selectedIds.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table sub-components
// ---------------------------------------------------------------------------

function DraftLeadsTable({
  loading, rows, emptyLabel, selectedIds, onToggle, onToggleAll, onAssign, employees, allSelected, currentPage,
}: {
  loading: boolean; rows: DraftLead[]; emptyLabel: string;
  selectedIds: number[]; onToggle: (id: number) => void; onToggleAll: () => void;
  onAssign: (id: number, empId: string) => void; employees: Employee[]; allSelected: boolean; currentPage: number;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left w-8">
                <input type="checkbox" className="rounded border-gray-300"
                  checked={allSelected} onChange={onToggleAll}
                  disabled={loading || rows.length === 0} />
              </th>
              {["ID","Client Name","Trading Name","Tel No","Mobile No","MPAN Top","Supplier","Annual Usage","Start Date","Contract End","Assigned To"].map((h, i) => (
                <th key={h} className={`px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase ${i === 0 ? "w-20 border-r-2 border-gray-300" : "w-[9%]"} ${["Annual Usage","Start Date","Contract End"].includes(h) ? "whitespace-nowrap" : ""} ${h === "Annual Usage" ? "text-right" : ""}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr><td colSpan={12} className="px-6 py-12 text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600" />
                <p className="mt-4 text-gray-500">Loading drafts…</p>
              </td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-lg">{emptyLabel}</p>
                <p className="mt-2 text-sm">Import drafts to get started!</p>
              </td></tr>
            ) : rows.map((row, idx) => {
              const isSel = selectedIds.includes(row.opportunity_id);
              return (
                <tr key={row.opportunity_id} className={`hover:bg-gray-50 transition-colors ${isSel ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-gray-300 mt-1"
                      checked={isSel} onChange={() => onToggle(row.opportunity_id)} />
                  </td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                    <div className="whitespace-nowrap">{(currentPage - 1) * DRAFTS_PER_PAGE + idx + 1}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700 align-top overflow-hidden">
                    <div className="leading-tight whitespace-normal break-words">{row.contact_person ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                    <div className="leading-tight whitespace-normal break-words">{row.business_name ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top"><div className="whitespace-nowrap">{formatTel(row.tel_number)}</div></td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top"><div className="whitespace-nowrap">{formatTel(row.mobile_no)}</div></td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                    <div className="truncate" title={row.mpan_mpr ?? ""}>{row.mpan_mpr || "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                    <div className="truncate" title={row.supplier_name ?? ""}>{row.supplier_name || "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                    <div className="whitespace-nowrap">{parseAnnualUsage(row.annual_usage)?.toLocaleString() || "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top"><div className="whitespace-nowrap">{formatListDate(row.start_date)}</div></td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top"><div className="whitespace-nowrap">{formatListDate(row.end_date)}</div></td>
                  <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                    <Select value={row.opportunity_owner_employee_id?.toString() || "0"}
                      onValueChange={(v) => onAssign(row.opportunity_id, v)}>
                      <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                        <SelectValue placeholder="Assign">{row.assigned_to_name || "Unassigned"}</SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Unassigned</SelectItem>
                        {employees.map((e) => (
                          <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>
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
    </div>
  );
}
