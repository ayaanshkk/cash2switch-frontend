"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet, Search, Trash2, Filter, ChevronDown, ChevronFirst, ChevronLast, ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { toast } from "react-hot-toast";
import { useRouter } from "next/navigation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
const CASES_PER_PAGE = 25;

const STATUS_OPTIONS = [
  { value: "check",      label: "Check" },
  { value: "challenge",  label: "Challenge" },
  { value: "appeal",     label: "Appeal" },
  { value: "priced",     label: "Priced" },
  { value: "resolved",   label: "Resolved" },
  { value: "lost",       label: "Lost" },
];

type CaseRow = {
  opportunity_id: number;
  business_name: string | null;
  contact_person: string | null;
  tel_number: string | null;
  email: string | null;
  voa_reference: string | null;
  billing_authority?: string | null;
  current_rv?: number | null;
  proposed_rv?: number | null;
  case_opened_date: string | null;
  appeal_deadline?: string | null;
  case_stage?: string | null;
  stage_id: number | null;
  stage_name: string | null;
  created_at: string | null;
};

interface ImportResult {
  success: boolean;
  message: string;
  total_rows: number;
  successful: number;
  failed: number;
  errors?: string[];
}

const formatDate = (dateString: string | null | undefined): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return "—"; }
};

const formatRV = (rv: number | null | undefined): string => {
  if (!rv) return "—";
  return `£${rv.toLocaleString()}`;
};

const getStatusColor = (status: string | undefined): string => {
  if (!status) return "bg-gray-100 text-gray-800";
  switch (status.toLowerCase()) {
    case "resolved":  return "bg-green-100 text-green-800";
    case "check":     return "bg-blue-100 text-blue-800";
    case "challenge": return "bg-purple-100 text-purple-800";
    case "appeal":    return "bg-orange-100 text-orange-800";
    case "priced":    return "bg-teal-100 text-teal-800";
    case "lost":      return "bg-red-100 text-red-800";
    default:          return "bg-gray-100 text-gray-800";
  }
};

const getStatusLabel = (status: string | undefined): string => {
  if (!status) return "—";
  return STATUS_OPTIONS.find(o => o.value === status.toLowerCase())?.label || status;
};

const getCaseStageValue = (stageName?: string | null): string => {
  if (!stageName) return "";
  const normalized = stageName.toLowerCase().trim();
  return STATUS_OPTIONS.find(o => o.value === normalized || o.label.toLowerCase() === normalized)?.value || stageName;
};

export default function CasesPage() {
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [billingAuthorities, setBillingAuthorities] = useState<{ supplier_id: number; billing_authority: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [importModalOpen, setImportModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCases, setSelectedCases] = useState<number[]>([]);
  const [billingAuthorityFilter, setBillingAuthorityFilter] = useState<number | "All">("All");
  const [statusFilter, setStatusFilter] = useState<string | "All">("All");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const [lostConfirmation, setLostConfirmation] = useState<{
    isOpen: boolean;
    opportunityId: number | null;
    currentStatus: string | null;
  }>({ isOpen: false, opportunityId: null, currentStatus: null });

  useEffect(() => { setCurrentPage(1); }, [searchTerm, billingAuthorityFilter, statusFilter]);

  const loadCases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const suppliersResp = await fetch(`${API_BASE_URL}/api/crm/suppliers`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("auth_token")}` },
      });
      if (suppliersResp.ok) {
        const data = await suppliersResp.json();
        setBillingAuthorities(Array.isArray(data) ? data : []);
      }

      const body = await fetchWithAuth(`/api/crm/leads?exclude_stage=Lost`);
      setRows(Array.isArray(body.data) ? body.data : []);
    } catch (err: any) {
      console.error("Cases page: fetch error", err);
      setError(err.message || "Failed to load cases");
      setRows([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { if (!authLoading) loadCases(); }, [authLoading]);

  const sortedRows = useMemo(() =>
    [...rows].sort((a, b) =>
      new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
    ), [rows]);

  const validateAndSetFile = (f: File) => {
    const ext = f.name.toLowerCase().slice(f.name.lastIndexOf("."));
    if (![".xlsx", ".xls", ".csv"].includes(ext)) { alert("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file"); return; }
    if (f.size > 10 * 1024 * 1024) { alert("File size must be less than 10MB"); return; }
    setFile(f);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) validateAndSetFile(f); };
  const handleDragOver   = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave  = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop       = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files[0]; if (f) validateAndSetFile(f); };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    setResult(null);
    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();
      formData.append("file", file);

      const previewResp = await fetch(`${API_BASE_URL}/api/crm/leads/import/preview`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const previewData = await previewResp.json();
      if (!previewResp.ok) throw new Error(previewData.error || "Preview failed");

      const previewRows = Array.isArray(previewData.rows) ? previewData.rows : [];
      const confirmResp = await fetch(`${API_BASE_URL}/api/crm/leads/import/confirm`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(previewRows),
      });
      const confirmData = await confirmResp.json();
      if (!confirmResp.ok) throw new Error(confirmData.error || "Import failed");

      const inserted = Number(confirmData.inserted || 0);
      const skipped  = Number(confirmData.skipped  || 0);
      const invalid  = Number(previewData.invalid_rows || 0);

      setResult({
        success:    Boolean(confirmData.success),
        message:    confirmData.message || "Import complete",
        total_rows: Number(previewData.total_rows || previewRows.length || 0),
        successful: inserted,
        failed:     invalid + skipped,
        errors:     confirmData.errors || [],
      });

      if (inserted > 0) await loadCases();
    } catch (err) {
      setResult({ success: false, message: err instanceof Error ? err.message : "Upload failed", total_rows: 0, successful: 0, failed: 1 });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token    = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";
      const resp     = await fetch(`${API_BASE_URL}/api/crm/leads/import/template`, {
        headers: { Authorization: `Bearer ${token}`, "X-Tenant-ID": tenantId },
      });
      if (!resp.ok) throw new Error("Failed to download template");
      const blob = await resp.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href = url; a.download = "rates_cases_import_template.xlsx";
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
    } catch { alert("Failed to download template"); }
  };

  const handleCloseModal = () => { setFile(null); setResult(null); setIsUploading(false); setUploadProgress(0); setImportModalOpen(false); };

  const handleSelectAll  = () => setSelectedCases(selectedCases.length === paginatedRows.length ? [] : paginatedRows.map(r => r.opportunity_id));
  const handleSelectCase = (id: number) => setSelectedCases(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const deleteCase = async (opportunityId: number) => {
    if (!window.confirm("Are you sure you want to delete this case?")) return;
    try {
      await fetchWithAuth(`/api/crm/leads/${opportunityId}`, { method: "DELETE" });
      setRows(prev => prev.filter(r => r.opportunity_id !== opportunityId));
      setSelectedCases(prev => prev.filter(id => id !== opportunityId));
      toast.success("Case deleted successfully");
    } catch { toast.error("Error deleting case"); }
  };

  const bulkDeleteCases = async () => {
    if (!selectedCases.length) { alert("Please select cases to delete"); return; }
    if (!window.confirm(`Are you sure you want to delete ${selectedCases.length} case(s)?`)) return;
    try {
      await Promise.all(selectedCases.map(id => fetchWithAuth(`/api/crm/leads/${id}`, { method: "DELETE" })));
      setRows(prev => prev.filter(r => !selectedCases.includes(r.opportunity_id)));
      setSelectedCases([]);
      toast.success(`Deleted ${selectedCases.length} case(s)`);
    } catch { toast.error("Error deleting some cases"); }
  };

  const getBillingAuthorityName = (id: number | undefined | null): string => {
    if (!id) return "—";
    return billingAuthorities.find(b => b.supplier_id === id)?.billing_authority || "—";
  };

  const filteredRows = useMemo(() => sortedRows.filter(row => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (row.business_name  || "").toLowerCase().includes(term) ||
      (row.contact_person || "").toLowerCase().includes(term) ||
      (row.email          || "").toLowerCase().includes(term) ||
      (row.tel_number     || "").toLowerCase().includes(term) ||
      (row.voa_reference  || "").toLowerCase().includes(term);
    const matchesAuthority = billingAuthorityFilter === "All" || true;
    const matchesStatus    = statusFilter === "All" || getCaseStageValue(row.stage_name) === statusFilter;
    return matchesSearch && matchesAuthority && matchesStatus;
  }), [sortedRows, searchTerm, billingAuthorityFilter, statusFilter]);

  const totalPages    = Math.ceil(filteredRows.length / CASES_PER_PAGE);
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * CASES_PER_PAGE;
    return filteredRows.slice(start, start + CASES_PER_PAGE);
  }, [filteredRows, currentPage]);

  const updateCaseStatus = async (opportunityId: number, newStatus: string) => {
    if (newStatus.toLowerCase() === "lost") {
      setLostConfirmation({ isOpen: true, opportunityId, currentStatus: newStatus });
      return;
    }
    if (newStatus.toLowerCase() === "priced") { router.push("/dashboard/priced"); return; }
    await performStatusUpdate(opportunityId, newStatus);
  };

  const performStatusUpdate = async (opportunityId: number, newStatus: string) => {
    try {
      await fetchWithAuth(`/api/crm/leads/${opportunityId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      setRows(prev => prev.map(r =>
        r.opportunity_id === opportunityId ? { ...r, stage_name: newStatus, case_stage: newStatus } : r
      ));
    } catch { toast.error("Error updating case stage"); }
  };

  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CASES_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CASES_PER_PAGE, filteredRows.length)}</span> of{" "}
          <span className="font-medium">{filteredRows.length}</span> cases
        </div>
        <div className="flex space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)}                               disabled={currentPage === 1}><ChevronFirst className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}        disabled={currentPage === 1}><ChevronLeft  className="h-4 w-4" /></Button>
          <div className="flex items-center px-3 text-sm text-gray-700">Page {currentPage} of {totalPages}</div>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)}                     disabled={currentPage === totalPages}><ChevronLast  className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-6">
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">Cases</h1>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Cases</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button onClick={loadCases} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      <div className="mb-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input placeholder="Search cases..." className="pl-8" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {billingAuthorityFilter === "All" ? "All Billing Authorities" : getBillingAuthorityName(billingAuthorityFilter as number)}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setBillingAuthorityFilter("All")}>All Billing Authorities</DropdownMenuItem>
              {billingAuthorities.map(b => (
                <DropdownMenuItem key={b.supplier_id} onClick={() => setBillingAuthorityFilter(b.supplier_id)}>
                  {b.billing_authority}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {statusFilter === "All" ? "All Stages" : getStatusLabel(statusFilter as string)}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStatusFilter("All")}>All Stages</DropdownMenuItem>
              {STATUS_OPTIONS.map(s => (
                <DropdownMenuItem key={s.value} onClick={() => setStatusFilter(s.value)}>{s.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex gap-2">
          {selectedCases.length > 0 && (
            <Button onClick={bulkDeleteCases} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedCases.length})
            </Button>
          )}
          <Button onClick={() => { handleCloseModal(); setImportModalOpen(true); }} variant="outline">
            <Upload className="mr-2 h-4 w-4" /> Bulk Import
          </Button>
          <Button onClick={() => { handleCloseModal(); setImportModalOpen(true); toast("Cases must be added via import"); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Case
          </Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {isLoading ? (
          <div className="px-6 py-12 text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600" />
            <p className="mt-4 text-gray-500">Loading cases...</p>
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center text-gray-500">
            <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
            <p className="text-lg text-red-600">Failed to load cases</p>
          </div>
        ) : paginatedRows.length === 0 ? (
          <div className="px-6 py-12 text-center text-muted-foreground">
            <Upload className="h-12 w-12 text-gray-400 mx-auto mb-3" />
            <p className="text-lg">No cases found.</p>
            <p className="mt-2 text-sm">
              {searchTerm || statusFilter !== "All" ? "Try adjusting your filters." : "Import your first cases to get started!"}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left w-10">
                    <input type="checkbox" className="rounded border-gray-300"
                      checked={selectedCases.length === paginatedRows.length && paginatedRows.length > 0}
                      onChange={handleSelectAll} />
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-16 border-r-2 border-gray-300">ID</th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-44">Business Name</th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">Contact</th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">Phone</th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">VOA Reference</th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">Billing Authority</th>
                  <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24">Current RV</th>
                  <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24">Proposed RV</th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">Opened</th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">Deadline</th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-40">Stage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {paginatedRows.map(r => {
                  const isSelected = selectedCases.includes(r.opportunity_id);
                  const stageValue = getCaseStageValue(r.case_stage || r.stage_name);
                  return (
                    <tr
                      key={r.opportunity_id}
                      className={`hover:bg-gray-50 transition-colors ${isSelected ? "bg-blue-50" : ""}`}
                      onContextMenu={e => {
                        e.preventDefault();
                        const menu = document.createElement("div");
                        menu.className = "fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 py-1";
                        menu.style.left = `${e.pageX}px`; menu.style.top = `${e.pageY}px`;
                        const btn = document.createElement("button");
                        btn.className = "w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2";
                        btn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete';
                        btn.onclick = () => { deleteCase(r.opportunity_id); document.body.removeChild(menu); };
                        menu.appendChild(btn); document.body.appendChild(menu);
                        const close = (ev: MouseEvent) => {
                          if (!menu.contains(ev.target as Node)) { document.body.removeChild(menu); document.removeEventListener("click", close); }
                        };
                        setTimeout(() => document.addEventListener("click", close), 0);
                      }}
                    >
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded border-gray-300 mt-1"
                          checked={isSelected} onChange={() => handleSelectCase(r.opportunity_id)} />
                      </td>
                      <td className="px-2 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">{r.opportunity_id}</td>
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="break-words max-w-[160px] leading-tight">{r.business_name || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 align-top">
                        <div className="break-words max-w-[120px] leading-tight">{r.contact_person || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{r.tel_number || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-900 align-top">
                        <div className="break-all max-w-[120px] leading-tight">{r.voa_reference || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900 align-top">
                        <div className="break-words max-w-[120px] leading-tight">{r.billing_authority || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">{formatRV(r.current_rv)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">{formatRV(r.proposed_rv)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-700 align-top">
                        <div className="whitespace-nowrap">{formatDate(r.case_opened_date)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs align-top">
                        <div className={`whitespace-nowrap font-medium ${
                          r.appeal_deadline && (new Date(r.appeal_deadline).getTime() - Date.now()) / 86400000 <= 30
                            ? "text-red-600"
                            : r.appeal_deadline && (new Date(r.appeal_deadline).getTime() - Date.now()) / 86400000 <= 60
                              ? "text-orange-600" : "text-gray-700"
                        }`}>
                          {formatDate(r.appeal_deadline)}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <Select value={stageValue} onValueChange={v => updateCaseStatus(r.opportunity_id, v)}>
                          <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                            <SelectValue placeholder="Set stage">
                              {stageValue ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStatusColor(stageValue)}`}>
                                  {getStatusLabel(stageValue)}
                                </span>
                              ) : "—"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
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

      {/* Import Modal */}
      <Dialog open={importModalOpen} onOpenChange={open => { setImportModalOpen(open); if (!open) handleCloseModal(); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Cases</DialogTitle>
            <DialogDescription>Upload an Excel or CSV file to import multiple business rates cases at once</DialogDescription>
          </DialogHeader>
          <div className="space-y-6">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900">Need a template?</h3>
                  <p className="mt-1 text-sm text-blue-700">Download our Excel template with the correct column headers and example data.</p>
                  <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="mt-3">
                    <Download className="mr-2 h-4 w-4" /> Download Template
                  </Button>
                </div>
              </div>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging ? "border-blue-500 bg-blue-50" : file ? "border-green-500 bg-green-50" : "border-gray-300 bg-gray-50"
              }`}
              onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="ml-4"><X className="h-4 w-4" /></Button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm font-medium text-gray-900 mb-2">Drop your file here or click to browse</p>
                  <p className="text-xs text-gray-500 mb-4">Supports .xlsx, .xls, and .csv files (max 10MB)</p>
                  <Button variant="outline" onClick={() => fileInputRef.current?.click()}>Select File</Button>
                </>
              )}
            </div>

            {result && (
              <div className={`p-4 rounded-lg border ${
                result.success && result.failed === 0 ? "bg-green-50 border-green-200"
                  : result.successful > 0 ? "bg-yellow-50 border-yellow-200"
                  : "bg-red-50 border-red-200"
              }`}>
                <div className="flex items-start gap-3">
                  {result.success && result.failed === 0
                    ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                    : <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">Import Results</h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>Total rows: <span className="font-medium">{result.total_rows}</span></p>
                      <p className="text-green-700">Imported: <span className="font-medium">{result.successful}</span></p>
                      {result.failed > 0 && <p className="text-red-700">Failed/skipped: <span className="font-medium">{result.failed}</span></p>}
                    </div>
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-red-900 mb-2">Errors:</p>
                        <div className="bg-white rounded border border-red-200 p-3 max-h-40 overflow-y-auto">
                          <ul className="text-xs text-red-800 space-y-1">
                            {result.errors.map((err, i) => (
                              <li key={i}>• {typeof err === "string" ? err : `Row ${(err as any).row}: ${(err as any).error}`}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCloseModal}>Cancel</Button>
              <Button onClick={handleUpload} disabled={!file || isUploading}>
                {isUploading
                  ? <><span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2" />Uploading...</>
                  : <><Upload className="mr-2 h-4 w-4" />Upload & Import</>}
              </Button>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Required Columns:</h4>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <strong>Business Name</strong> (required)</li>
                <li>• <strong>VOA Reference</strong> — VOA property reference or UPRN (recommended)</li>
                <li>• <strong>Tel Number</strong> (recommended)</li>
                <li>• Contact Person, Email, Billing Authority (optional)</li>
                <li>• Current RV, Proposed RV, Rates Multiplier (optional)</li>
                <li>• Case Opened Date, Appeal Deadline, Case Stage (optional)</li>
              </ul>
              <p className="mt-3 text-xs text-gray-600">Cases will be imported at Check stage and can be progressed through the CCA pipeline.</p>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Lost Confirmation Modal */}
      <Dialog open={lostConfirmation.isOpen} onOpenChange={open => {
        if (!open) setLostConfirmation({ isOpen: false, opportunityId: null, currentStatus: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Case as Lost?</DialogTitle>
            <DialogDescription>This case will be marked as lost and moved to the recycle bin. You can still view it later.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setLostConfirmation({ isOpen: false, opportunityId: null, currentStatus: null })}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              const { opportunityId, currentStatus } = lostConfirmation;
              setLostConfirmation({ isOpen: false, opportunityId: null, currentStatus: null });
              if (opportunityId && currentStatus) await performStatusUpdate(opportunityId, currentStatus);
            }}>Mark as Lost</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}