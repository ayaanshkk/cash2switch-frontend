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
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";

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
      
      const response = await fetch(`${API_BASE_URL}/api/crm/leads/import`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
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

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(`${API_BASE_URL}/api/crm/leads/import/template`, {
        headers: {
          'Authorization': `Bearer ${token}`,
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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Leads</CardTitle>
              <CardDescription>List of imported leads (oldest first).</CardDescription>
            </div>
            <Button 
              onClick={() => {
                handleCloseModal();
                setImportModalOpen(true);
              }}
              className="gap-2"
            >
              <Upload className="h-4 w-4" />
              Import Leads
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {statusError && (
            <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-600">{statusError}</p>
            </div>
          )}

          {loading ? (
            <div className="grid gap-3">
              <div className="h-64 animate-pulse bg-gray-100 rounded" />
            </div>
          ) : error ? (
            <div className="text-center text-sm text-destructive">{error}</div>
          ) : rows.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No leads found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1200px]">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium min-w-[80px]">ID</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[160px]">Contact Person</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[180px]">Business Name</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">Phone</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[200px]">Email</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[140px]">MPAN/MPR</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[130px]">Start Date</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[130px]">End Date</th>
                    <th className="text-left p-3 text-sm font-medium min-w-[160px]">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((r) => (
                    <tr key={r.opportunity_id} className="border-b hover:bg-gray-50">
                      <td className="p-3 text-sm min-w-[80px]">{r.opportunity_id}</td>
                      <td className="p-3 text-sm min-w-[160px]">{r.contact_person || "—"}</td>
                      <td className="p-3 text-sm min-w-[180px]">{r.business_name || "—"}</td>
                      <td className="p-3 text-sm min-w-[140px]">{r.tel_number || "—"}</td>
                      <td className="p-3 text-sm min-w-[200px]">{r.email || "—"}</td>
                      <td className="p-3 text-sm min-w-[140px]">{r.mpan_mpr || "—"}</td>
                      <td className="p-3 text-sm min-w-[130px]">{r.start_date ? format(new Date(r.start_date), "yyyy-MM-dd") : "—"}</td>
                      <td className="p-3 text-sm min-w-[130px]">{r.end_date ? format(new Date(r.end_date), "yyyy-MM-dd") : "—"}</td>
                      <td className="p-3 text-sm min-w-[160px]">
                        <Select
                          value={normalizeStatus(r.stage_name)}
                          onValueChange={(value) => handleStatusChange(r.opportunity_id, value)}
                          disabled={updatingStatus[r.opportunity_id] || false}
                        >
                          <SelectTrigger className={`w-[140px] h-8 text-xs font-medium ${getStageColor(r.stage_name)}`}>
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Leads Modal */}
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
