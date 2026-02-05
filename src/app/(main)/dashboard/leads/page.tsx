"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet, Search, Trash2, Filter, ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";


const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

const DEFAULT_STATUS = "Not Called";
const STATUS_OPTIONS = [DEFAULT_STATUS, "Called", "Priced", "Rejected"];

const normalizeStatus = (stageName?: string | null) =>
  STATUS_OPTIONS.includes(stageName || "") ? (stageName as string) : DEFAULT_STATUS;

type LeadRow = {
  opportunity_id: number;
  business_name: string | null;
  contact_person: string | null;
  tel_number: string | null;
  email: string | null;
  mpan_mpr: string | null;
  start_date: string | null;
  end_date: string | null;
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

function getBadgeVariant(stage?: string) {
  if (!stage) return "outline" as const;
  const s = stage.toLowerCase();
  if (s.includes("new") || s.includes("enquiry") || s.includes("open")) return "secondary" as const;
  if (s.includes("proposal") || s.includes("contact")) return "default" as const;
  // map positive/closed states to the default (green-like) visual using "default"
  if (s.includes("won") || s.includes("converted") || s.includes("completed")) return "default" as const;
  if (s.includes("lost") || s.includes("rejected") || s.includes("failed")) return "destructive" as const;
  return "outline" as const;
}

export default function LeadsPage() {
  const { loading: authLoading } = useAuth();
  const [rows, setRows] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Import modal state
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<number[]>([]);
  const [statusFilter, setStatusFilter] = useState<string | "All">("All");

  // Status update state
  const [updatingStatus, setUpdatingStatus] = useState<Record<number, boolean>>({});
  const [statusError, setStatusError] = useState<string | null>(null);

  const loadLeads = async () => {
    try {
      setLoading(true);
      setError(null);
      const resp = await fetchWithAuth("/api/crm/leads");
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.message || `Failed to fetch leads (${resp.status})`);
      }
      const body = await resp.json();
      setRows(Array.isArray(body.data) ? body.data : []);
    } catch (err: any) {
      console.error("Leads page: fetch error", err);
      setError(err.message || "Failed to load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        setLoading(true);
        setError(null);
        const resp = await fetchWithAuth("/api/crm/leads");
        if (!mounted) return;
        if (!resp.ok) {
          const body = await resp.json().catch(() => ({}));
          throw new Error(body?.message || `Failed to fetch leads (${resp.status})`);
        }
        const body = await resp.json();
        if (!mounted) return;
        setRows(Array.isArray(body.data) ? body.data : []);
      } catch (err: any) {
        console.error("Leads page: fetch error", err);
        if (mounted) setError(err.message || "Failed to load leads");
      } finally {
        if (mounted) setLoading(false);
      }
    };

    if (!authLoading) load();
    return () => {
      mounted = false;
    };
  }, [authLoading]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      return a.opportunity_id - b.opportunity_id; // Ascending order
    });
  }, [rows]);

  // File validation and selection
  const validateAndSetFile = (selectedFile: File) => {
    const validExtensions = ['.xlsx', '.xls', '.csv'];
    const extension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(extension)) {
      alert('Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file');
      return;
    }
    
    if (selectedFile.size > 10 * 1024 * 1024) { // 10MB limit
      alert('File size must be less than 10MB');
      return;
    }
    
    setFile(selectedFile);
    setResult(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndSetFile(selectedFile);
    }
  };

  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      validateAndSetFile(droppedFile);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!file) return;

    setIsUploading(true);
    setUploadProgress(0);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const token = localStorage.getItem('auth_token');
      const tenantId = localStorage.getItem('tenant_id') || '1'; // ✅ ADDED
      
      const response = await fetch(`${API_BASE_URL}/api/crm/leads/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId, // ✅ ADDED - Required for CRM endpoints
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Upload failed');
      }

      setResult(data);
      
      if (data.successful > 0) {
        await loadLeads();
      }

    } catch (error) {
      console.error('Upload error:', error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Upload failed',
        total_rows: 0,
        successful: 0,
        failed: 1,
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Download template - FIXED VERSION with X-Tenant-ID header
  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const tenantId = localStorage.getItem('tenant_id') || '1'; // ✅ ADDED
      
      const response = await fetch(`${API_BASE_URL}/api/crm/leads/import/template`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Tenant-ID': tenantId, // ✅ ADDED - Required for CRM endpoints
        },
      });

      if (!response.ok) {
        throw new Error('Failed to download template');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'leads_import_template.xlsx';
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Template download error:', error);
      alert('Failed to download template');
    }
  };

  // Reset modal
  const handleCloseModal = () => {
    setFile(null);
    setResult(null);
    setIsUploading(false);
    setUploadProgress(0);
    setImportModalOpen(false);
  };

  const handleSelectAll = () => {
    if (selectedLeads.length === filteredRows.length) {
      setSelectedLeads([]);
    } else {
      setSelectedLeads(filteredRows.map(r => r.opportunity_id));
    }
  };

  const handleSelectLead = (id: number) => {
    setSelectedLeads(prev => 
      prev.includes(id) ? prev.filter(lid => lid !== id) : [...prev, id]
    );
  };

  // Delete single lead
  const deleteLead = async (opportunityId: number) => {
    if (!window.confirm("Are you sure you want to delete this lead?")) return;

    try {
      const resp = await fetchWithAuth(`/api/crm/leads/${opportunityId}`, {
        method: 'DELETE',
      });
      
      if (!resp.ok) throw new Error("Failed to delete lead");

      setRows(prev => prev.filter(r => r.opportunity_id !== opportunityId));
      setSelectedLeads(prev => prev.filter(id => id !== opportunityId));
      
      alert("Lead deleted successfully");
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting lead");
    }
  };

  // Bulk delete leads
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
      
      alert(`Successfully deleted ${deletePromises.length} lead(s)`);
    } catch (err) {
      console.error("Bulk delete error:", err);
      alert("Error deleting some leads");
    }
  };

  // Get status label
  const getStatusLabel = (status: string | undefined): string => {
    if (!status) return "—";
    const option = STATUS_OPTIONS.find(opt => opt === status);
    return option || status;
  };

  // 4. UPDATE filteredRows to include status filter:
  const filteredRows = useMemo(() => {
    let filtered = sortedRows;
    
    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter((row) => {
        return (
          (row.business_name || "").toLowerCase().includes(term) ||
          (row.contact_person || "").toLowerCase().includes(term) ||
          (row.email || "").toLowerCase().includes(term) ||
          (row.tel_number || "").toLowerCase().includes(term) ||
          (row.mpan_mpr || "").toLowerCase().includes(term)
        );
      });
    }
    
    // Apply status filter
    if (statusFilter !== "All") {
      filtered = filtered.filter(row => row.stage_name === statusFilter);
    }
    
    return filtered;
  }, [sortedRows, searchTerm, statusFilter]);

  // Handle status change
  const handleStatusChange = async (opportunityId: number, newStageName: string) => {
    
    // Mark as updating
    setUpdatingStatus(prev => ({ ...prev, [opportunityId]: true }));
    setStatusError(null);

    try {
      const resp = await fetchWithAuth(`/api/crm/leads/${opportunityId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage_name: newStageName }),
      });

      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}));
        throw new Error(body?.message || 'Failed to update status');
      }

      const body = await resp.json().catch(() => ({}));
      const updatedLead = body?.data;

      // Optimistically update UI
      setRows(prevRows =>
        prevRows.map(row =>
          row.opportunity_id === opportunityId
            ? {
                ...row,
                ...(updatedLead || {}),
                stage_name: updatedLead?.stage_name || newStageName,
                stage_id: updatedLead?.stage_id ?? row.stage_id,
              }
            : row
        )
      );
    } catch (err: any) {
      console.error('Status update error:', err);
      setStatusError(err.message || 'Failed to update status');
      // Auto-clear error after 5 seconds
      setTimeout(() => setStatusError(null), 5000);
    } finally {
      setUpdatingStatus(prev => ({ ...prev, [opportunityId]: false }));
    }
  };

  // Map stage ID to name
  // Get color classes for stage
  const getStageColor = (stageName?: string | null): string => {
    switch ((stageName || DEFAULT_STATUS).toLowerCase()) {
      case 'called':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      case 'priced':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'rejected':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'not called':
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Get dot color for dropdown items
  const getDotColor = (stageName: string): string => {
    switch (stageName.toLowerCase()) {
      case 'called':
        return 'bg-blue-500';
      case 'priced':
        return 'bg-green-500';
      case 'rejected':
        return 'bg-red-500';
      case 'not called':
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="w-full p-6">
      <h1 className="mb-6 text-3xl font-bold">Leads</h1>

      {/* Error Display */}
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

      {/* Search and Filter Bar */}
      <div className="mb-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          {/* Search Input */}
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Search leads..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Status Filter */}
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
                  key={status} 
                  onClick={() => setStatusFilter(status)}
                >
                  {status}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2">
          {selectedLeads.length > 0 && (
            <Button onClick={bulkDeleteLeads} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedLeads.length})
            </Button>
          )}
          <Button 
            onClick={() => {
              handleCloseModal();
              setImportModalOpen(true);
            }}
            variant="outline"
          >
            <Upload className="mr-2 h-4 w-4" />
            Bulk Import
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        {statusError && (
          <div className="m-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-amber-600">{statusError}</p>
          </div>
        )}

        {loading ? (
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
        ) : filteredRows.length === 0 ? (
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
                  {/* Checkbox Column */}
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={selectedLeads.length === filteredRows.length && filteredRows.length > 0}
                      onChange={handleSelectAll}
                    />
                  </th>
                  <th className="px-2 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-16 border-r-2 border-gray-300">
                    ID
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                    Contact Person
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-44">
                    Business Name
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                    Phone
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-44">
                    Email
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                    MPAN/MPR
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                    Start Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                    End Date
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-40">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {filteredRows.map((r) => {
                  const isSelected = selectedLeads.includes(r.opportunity_id);
                  
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
                      {/* Checkbox */}
                      <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          className="rounded border-gray-300 mt-1"
                          checked={isSelected}
                          onChange={() => handleSelectLead(r.opportunity_id)}
                        />
                      </td>

                      {/* ID */}
                      <td className="px-2 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                        {r.opportunity_id}
                      </td>

                      {/* Contact Person */}
                      <td className="px-3 py-3 text-sm text-gray-700 align-top">
                        <div className="break-words max-w-[120px] leading-tight">
                          {r.contact_person || "—"}
                        </div>
                      </td>

                      {/* Business Name */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="break-words max-w-[160px] leading-tight">
                          {r.business_name || "—"}
                        </div>
                      </td>

                      {/* Phone */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">
                          {r.tel_number || "—"}
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="break-words max-w-[160px] leading-tight">
                          {r.email || "—"}
                        </div>
                      </td>

                      {/* MPAN/MPR */}
                      <td className="px-3 py-3 text-xs font-mono text-gray-900 align-top">
                        <div className="break-all max-w-[120px] leading-tight">
                          {r.mpan_mpr || "—"}
                        </div>
                      </td>

                      {/* Start Date */}
                      <td className="px-3 py-3 text-xs text-gray-700 align-top">
                        <div className="whitespace-nowrap">
                          {r.start_date ? format(new Date(r.start_date), "dd/MM/yyyy") : "—"}
                        </div>
                      </td>

                      {/* End Date */}
                      <td className="px-3 py-3 text-xs text-gray-700 align-top">
                        <div className="whitespace-nowrap">
                          {r.end_date ? format(new Date(r.end_date), "dd/MM/yyyy") : "—"}
                        </div>
                      </td>

                      {/* Status Dropdown */}
                      <td className="px-3 py-3 align-top">
                        <Select
                          value={normalizeStatus(r.stage_name)}
                          onValueChange={(value) => handleStatusChange(r.opportunity_id, value)}
                          disabled={updatingStatus[r.opportunity_id] || false}
                        >
                          <SelectTrigger className={`h-7 text-xs w-full max-w-[150px] ${getStageColor(r.stage_name)}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {STATUS_OPTIONS.map((status) => (
                              <SelectItem key={status} value={status}>
                                <div className="flex items-center gap-2">
                                  <div className={`w-2 h-2 rounded-full ${getDotColor(status)}`} />
                                  {status}
                                </div>
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
      </div>

      {/* Import Leads Modal - Keep as is */}
      <Dialog open={importModalOpen} onOpenChange={(open) => {
        setImportModalOpen(open);
        if (!open) handleCloseModal();
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Bulk Import Leads</DialogTitle>
            <DialogDescription>
              Upload an Excel or CSV file to import multiple leads at once
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Download Template */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <FileSpreadsheet className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-blue-900">Need a template?</h3>
                  <p className="mt-1 text-sm text-blue-700">
                    Download our Excel template with the correct column headers and example data.
                  </p>
                  <Button
                    onClick={handleDownloadTemplate}
                    variant="outline"
                    size="sm"
                    className="mt-3"
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Download Template
                  </Button>
                </div>
              </div>
            </div>

            {/* File Upload Area */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                isDragging
                  ? 'border-blue-500 bg-blue-50'
                  : file
                  ? 'border-green-500 bg-green-50'
                  : 'border-gray-300 bg-gray-50'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileChange}
                className="hidden"
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <FileSpreadsheet className="h-8 w-8 text-green-600" />
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">
                      {(file.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                    className="ml-4"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <>
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-sm font-medium text-gray-900 mb-2">
                    Drop your file here or click to browse
                  </p>
                  <p className="text-xs text-gray-500 mb-4">
                    Supports .xlsx, .xls, and .csv files (max 10MB)
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Select File
                  </Button>
                </>
              )}
            </div>

            {/* Upload Progress */}
            {isUploading && (
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">Uploading...</span>
                  <span className="text-gray-500">{uploadProgress}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  />
                </div>
              </div>
            )}

            {/* Upload Result */}
            {result && (
              <div
                className={`p-4 rounded-lg border ${
                  result.success && result.failed === 0
                    ? 'bg-green-50 border-green-200'
                    : result.successful > 0
                    ? 'bg-yellow-50 border-yellow-200'
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  {result.success && result.failed === 0 ? (
                    <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-gray-900">
                      Import Results
                    </h3>
                    <div className="mt-2 space-y-1 text-sm">
                      <p>Total rows processed: <span className="font-medium">{result.total_rows}</span></p>
                      <p className="text-green-700">Successful: <span className="font-medium">{result.successful}</span></p>
                      {result.failed > 0 && (
                        <p className="text-red-700">Failed: <span className="font-medium">{result.failed}</span></p>
                      )}
                    </div>

                    {/* Show errors */}
                    {result.errors && result.errors.length > 0 && (
                      <div className="mt-3">
                        <p className="text-sm font-medium text-red-900 mb-2">Errors:</p>
                        <div className="bg-white rounded border border-red-200 p-3 max-h-40 overflow-y-auto">
                          <ul className="text-xs text-red-800 space-y-1">
                            {result.errors.map((error, index) => (
                              <li key={index}>• {error}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={handleCloseModal}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || isUploading}
              >
                {isUploading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></span>
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload & Import
                  </>
                )}
              </Button>
            </div>

            {/* Instructions */}
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Required Columns:</h4>
              <ul className="text-xs text-gray-700 space-y-1">
                <li>• <strong>Business Name</strong> (required)</li>
                <li>• <strong>Contact Person</strong> (recommended)</li>
                <li>• <strong>Tel Number</strong> (recommended)</li>
                <li>• Email, MPAN/MPR (optional)</li>
                <li>• Start Date, End Date (optional)</li>
              </ul>
              <p className="mt-3 text-xs text-gray-600">
                Note: Leads will be imported with default status and can be updated later.
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
