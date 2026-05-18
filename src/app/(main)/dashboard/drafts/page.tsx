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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWithAuth } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const DRAFTS_PER_PAGE = 25;
const POLL_INTERVAL_MS = 2000;

type DraftKind = "leads" | "renewals";

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

interface DraftRenewal {
  id?: number;
  client_id: number;
  display_id?: number | null;
  display_order?: number | null;
  business_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  mobile_no?: string | null;
  email?: string | null;
  mpan_top?: string | null;
  mpan_mpr?: string | null;
  supplier_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  annual_usage?: number | string | null;
  status?: string | null;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  created_at?: string | null;
  supplier_id?: number | null;
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
  const [activeTab, setActiveTab] = useState<DraftKind>("leads");
  const [leads, setLeads]         = useState<DraftLead[]>([]);
  const [renewals, setRenewals]   = useState<DraftRenewal[]>([]);
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
  const [selectedRenewalIds, setSelectedRenewalIds] = useState<number[]>([]);

  const [currentLeadsPage, setCurrentLeadsPage]     = useState(1);
  const [currentRenewalsPage, setCurrentRenewalsPage] = useState(1);

  const [bulkAssignOpen, setBulkAssignOpen]         = useState(false);
  const [bulkAssignEmployeeId, setBulkAssignEmployeeId] = useState("");
  const [bulkAssigning, setBulkAssigning]           = useState(false);

  const [searchTerm, setSearchTerm]         = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");

  // keep a ref so the polling loop can be cancelled when the dialog closes
  const pollAbortRef = useRef<AbortController | null>(null);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadRows, renewalRows, employeeRows, supplierRows] = await Promise.all([
        fetchWithAuth("/api/crm/leads/drafts"),
        fetchWithAuth("/energy-clients/drafts?service=utilities"),
        fetchWithAuth("/employees"),
        fetchWithAuth("/suppliers"),
      ]);
      setLeads(Array.isArray(leadRows) ? leadRows : leadRows?.data ?? []);
      setRenewals(Array.isArray(renewalRows) ? renewalRows : []);
      setEmployees(Array.isArray(employeeRows) ? employeeRows : employeeRows?.data ?? []);
      setSuppliers(Array.isArray(supplierRows) ? supplierRows : supplierRows?.data ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Filtering + pagination ────────────────────────────────────────────────

  const applyFilters = useCallback(
    (items: DraftLead[] | DraftRenewal[]) => {
      let filtered = [...items];
      if (searchTerm.trim()) {
        const s = searchTerm.toLowerCase();
        filtered = filtered.filter((item) => {
          const business = ("business_name" in item ? item.business_name : "") ?? "";
          const contact  = ("contact_person" in item ? item.contact_person : "") ?? "";
          const mpan     =
            ("mpan_mpr" in item ? item.mpan_mpr : null) ??
            ("mpan_top" in item ? item.mpan_top : null) ?? "";
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
      return filtered;
    },
    [searchTerm, selectedSupplier],
  );

  const draftLeads = useMemo(() => {
    const unassigned = leads.filter((l) => isUnassigned(l.opportunity_owner_employee_id));
    return applyFilters(unassigned) as DraftLead[];
  }, [leads, applyFilters]);

  const draftRenewals = useMemo(() => {
    const unassigned = renewals.filter((r) => isUnassigned(r.assigned_to_id));
    return applyFilters(unassigned) as DraftRenewal[];
  }, [renewals, applyFilters]);

  const totalLeadsPages   = Math.max(1, Math.ceil(draftLeads.length   / DRAFTS_PER_PAGE));
  const totalRenewalsPages = Math.max(1, Math.ceil(draftRenewals.length / DRAFTS_PER_PAGE));

  const paginatedLeads = useMemo(() => {
    const start = (currentLeadsPage - 1) * DRAFTS_PER_PAGE;
    return draftLeads.slice(start, start + DRAFTS_PER_PAGE);
  }, [draftLeads, currentLeadsPage]);

  const paginatedRenewals = useMemo(() => {
    const start = (currentRenewalsPage - 1) * DRAFTS_PER_PAGE;
    return draftRenewals.slice(start, start + DRAFTS_PER_PAGE);
  }, [draftRenewals, currentRenewalsPage]);

  const selectedIds = activeTab === "leads" ? selectedLeadIds : selectedRenewalIds;

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
      const endpoint =
        activeTab === "leads"
          ? `${API_BASE_URL}/import/leads?service=utilities`
          : `${API_BASE_URL}/import/energy-customers?service=utilities`;

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
  }, [importFile, activeTab, pollJob, loadData]);

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

      if (activeTab === "leads") {
        await fetchWithAuth("/api/crm/leads/assign", {
          method: "PATCH",
          body:   JSON.stringify({ lead_ids: [id], employee_id: employeeId }),
        });
        setLeads((prev) => prev.filter((l) => l.opportunity_id !== id));
        setSelectedLeadIds((prev) => prev.filter((x) => x !== id));
      } else {
        await fetchWithAuth(`/energy-clients/${id}`, {
          method: "PUT",
          body:   JSON.stringify({ assigned_to_id: employeeId }),
        });
        setRenewals((prev) => prev.filter((r) => r.client_id !== id));
        setSelectedRenewalIds((prev) => prev.filter((x) => x !== id));
      }
      toast.success(`Assigned to ${emp?.employee_name ?? "salesperson"}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assignment failed");
    } finally {
      setAssigning(false);
    }
  }, [activeTab, employees]);

  const handleBulkAssign = useCallback(async () => {
    if (!bulkAssignEmployeeId || selectedIds.length === 0) {
      toast.error("Select a salesperson and at least one draft");
      return;
    }
    setBulkAssigning(true);
    try {
      const employeeId = Number(bulkAssignEmployeeId);
      const emp = employees.find((e) => e.employee_id === employeeId);

      if (activeTab === "leads") {
        await fetchWithAuth("/api/crm/leads/assign", {
          method: "PATCH",
          body:   JSON.stringify({ lead_ids: selectedLeadIds, employee_id: employeeId }),
        });
        setLeads((prev) => prev.filter((l) => !selectedLeadIds.includes(l.opportunity_id)));
        setSelectedLeadIds([]);
        toast.success(`Assigned ${selectedLeadIds.length} leads to ${emp?.employee_name}`);
      } else {
        await Promise.all(
          selectedRenewalIds.map((cid) =>
            fetchWithAuth(`/energy-clients/${cid}`, {
              method: "PUT",
              body:   JSON.stringify({ assigned_to_id: employeeId }),
            }),
          ),
        );
        setRenewals((prev) => prev.filter((r) => !selectedRenewalIds.includes(r.client_id)));
        setSelectedRenewalIds([]);
        toast.success(`Assigned ${selectedRenewalIds.length} renewals to ${emp?.employee_name}`);
      }
      setBulkAssignOpen(false);
      setBulkAssignEmployeeId("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk assignment failed");
    } finally {
      setBulkAssigning(false);
    }
  }, [activeTab, bulkAssignEmployeeId, employees, selectedIds.length, selectedLeadIds, selectedRenewalIds]);

  // ── Selection helpers ─────────────────────────────────────────────────────

  const toggleLead    = (id: number) =>
    setSelectedLeadIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleRenewal = (id: number) =>
    setSelectedRenewalIds((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));

  const toggleAllLeads = () => {
    const pageIds = paginatedLeads.map((l) => l.opportunity_id);
    const allSel  = pageIds.every((id) => selectedLeadIds.includes(id));
    setSelectedLeadIds((p) =>
      allSel ? p.filter((id) => !pageIds.includes(id)) : [...new Set([...p, ...pageIds])],
    );
  };
  const toggleAllRenewals = () => {
    const pageIds = paginatedRenewals.map((r) => r.client_id);
    const allSel  = pageIds.every((id) => selectedRenewalIds.includes(id));
    setSelectedRenewalIds((p) =>
      allSel ? p.filter((id) => !pageIds.includes(id)) : [...new Set([...p, ...pageIds])],
    );
  };

  // ── Delete ────────────────────────────────────────────────────────────────

  const deleteSelectedDrafts = useCallback(async () => {
    if (selectedIds.length === 0) return;
    setDeleting(true);
    try {
      if (activeTab === "leads") {
        const result = await fetchWithAuth("/api/crm/leads/drafts", {
          method: "DELETE",
          body:   JSON.stringify({ lead_ids: selectedLeadIds }),
        });
        const deleted = Array.isArray(result?.deleted_ids) ? result.deleted_ids : selectedLeadIds;
        setLeads((p) => p.filter((l) => !deleted.includes(l.opportunity_id)));
        setSelectedLeadIds([]);
        toast.success(`Deleted ${deleted.length} draft lead${deleted.length === 1 ? "" : "s"}`);
      } else {
        const result = await fetchWithAuth("/energy-clients/drafts", {
          method: "DELETE",
          body:   JSON.stringify({ client_ids: selectedRenewalIds }),
        });
        const deleted = Array.isArray(result?.deleted_ids) ? result.deleted_ids : selectedRenewalIds;
        setRenewals((p) => p.filter((r) => !deleted.includes(r.client_id)));
        setSelectedRenewalIds([]);
        toast.success(`Deleted ${deleted.length} draft renewal${deleted.length === 1 ? "" : "s"}`);
      }
      setDeleteOpen(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  }, [activeTab, selectedIds.length, selectedLeadIds, selectedRenewalIds]);

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
          <span className="font-medium">{totalItems}</span> {activeTab}
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
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as DraftKind)}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="leads">
              Leads {draftLeads.length > 0 && `(${draftLeads.length.toLocaleString()})`}
            </TabsTrigger>
            <TabsTrigger value="renewals">
              Renewals {draftRenewals.length > 0 && `(${draftRenewals.length.toLocaleString()})`}
            </TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="default" onClick={() => setBulkAssignOpen(true)} disabled={selectedIds.length === 0}>
              <Users className="mr-2 h-4 w-4" />
              Assign Selected ({selectedIds.length})
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={selectedIds.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import {activeTab === "leads" ? "Leads" : "Renewals"}
            </Button>
          </div>
        </div>

        <TabsContent value="leads">
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
          />
          {!loading && (
            <PaginationControls
              currentPage={currentLeadsPage}
              totalPages={totalLeadsPages}
              onPageChange={setCurrentLeadsPage}
              totalItems={draftLeads.length}
            />
          )}
        </TabsContent>

        <TabsContent value="renewals">
          <DraftRenewalsTable
            loading={loading}
            rows={paginatedRenewals}
            emptyLabel="No draft renewals"
            selectedIds={selectedRenewalIds}
            onToggle={toggleRenewal}
            onToggleAll={toggleAllRenewals}
            onAssign={assignDraft}
            employees={employees}
            allSelected={paginatedRenewals.length > 0 && paginatedRenewals.every((r) => selectedRenewalIds.includes(r.client_id))}
          />
          {!loading && (
            <PaginationControls
              currentPage={currentRenewalsPage}
              totalPages={totalRenewalsPages}
              onPageChange={setCurrentRenewalsPage}
              totalItems={draftRenewals.length}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* ── Bulk assign dialog ── */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Selected Drafts</DialogTitle>
            <DialogDescription>
              Assign {selectedIds.length} selected {activeTab} to a salesperson.
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkAssignEmployeeId} onValueChange={setBulkAssignEmployeeId}>
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
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleBulkAssign} disabled={!bulkAssignEmployeeId || bulkAssigning}>
              {bulkAssigning && <span className="mr-2">⏳</span>}
              Assign {selectedIds.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Import dialog ── */}
      <Dialog open={importOpen} onOpenChange={handleImportDialogClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Import {activeTab === "leads" ? "Lead" : "Renewal"} Drafts
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
              {activeTab === "leads" ? "leads" : "renewals"} from the database.
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
  loading, rows, emptyLabel, selectedIds, onToggle, onToggleAll, onAssign, employees, allSelected,
}: {
  loading: boolean; rows: DraftLead[]; emptyLabel: string;
  selectedIds: number[]; onToggle: (id: number) => void; onToggleAll: () => void;
  onAssign: (id: number, empId: string) => void; employees: Employee[]; allSelected: boolean;
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
                    <div className="whitespace-nowrap">{idx + 1}</div>
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

function DraftRenewalsTable({
  loading, rows, emptyLabel, selectedIds, onToggle, onToggleAll, onAssign, employees, allSelected,
}: {
  loading: boolean; rows: DraftRenewal[]; emptyLabel: string;
  selectedIds: number[]; onToggle: (id: number) => void; onToggleAll: () => void;
  onAssign: (id: number, empId: string) => void; employees: Employee[]; allSelected: boolean;
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
              const isSel = selectedIds.includes(row.client_id);
              return (
                <tr key={row.client_id} className={`hover:bg-gray-50 transition-colors ${isSel ? "bg-blue-50" : ""}`}>
                  <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-gray-300 mt-1"
                      checked={isSel} onChange={() => onToggle(row.client_id)} />
                  </td>
                  <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                    <div className="whitespace-nowrap">{idx + 1}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-700 align-top overflow-hidden">
                    <div className="leading-tight whitespace-normal break-words">{row.contact_person ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                    <div className="leading-tight whitespace-normal break-words">{row.business_name ?? "—"}</div>
                  </td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top"><div className="whitespace-nowrap">{formatTel(row.phone)}</div></td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top"><div className="whitespace-nowrap">{formatTel(row.mobile_no)}</div></td>
                  <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                    <div className="truncate" title={row.mpan_top ?? row.mpan_mpr ?? ""}>{row.mpan_top || row.mpan_mpr || "—"}</div>
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
                    <Select value={row.assigned_to_id?.toString() || "0"}
                      onValueChange={(v) => onAssign(row.client_id, v)}>
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