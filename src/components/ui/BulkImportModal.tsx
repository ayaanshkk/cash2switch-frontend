"use client";

import React, { useState, useRef } from "react";
import { Upload, Download, X, CheckCircle, AlertCircle, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// ✅ Fixed: errors can be string or object {row, mpan, error}
interface ImportResult {
  success: boolean;
  message: string;
  total_rows: number;
  successful: number;
  failed: number;
  errors?: any[];
}

interface BulkImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportComplete: () => void;
  uploadEndpoint: string;
  confirmEndpoint?: string;
  templateEndpoint: string;
  templateFilename?: string;
}

export function BulkImportModal({
  isOpen,
  onClose,
  onImportComplete,
  uploadEndpoint,
  confirmEndpoint,
  templateEndpoint,
  templateFilename,
}: BulkImportModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) validateAndSetFile(selectedFile);
  };

  const validateAndSetFile = (selectedFile: File) => {
    const validExtensions = [".xlsx", ".xls", ".csv"];
    const extension = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf("."));
    if (!validExtensions.includes(extension)) {
      alert("Please upload a valid Excel (.xlsx, .xls) or CSV (.csv) file");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      alert("File size must be less than 10MB");
      return;
    }
    setFile(selectedFile);
    setResult(null);
  };

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) validateAndSetFile(droppedFile);
  };

  // ✅ Fixed: format error whether string or object {row, mpan, error}
  const formatError = (error: any): string => {
    if (typeof error === "string") return error;
    if (typeof error === "object" && error !== null) {
      const row = error.row ? `Row ${error.row}: ` : "";
      const mpan = error.mpan ? `MPAN ${error.mpan} - ` : "";
      const msg = error.error || error.message || "Unknown error";
      return `${row}${mpan}${msg}`;
    }
    return String(error);
  };

  const handleUpload = async () => {
    if (!file) return;
    setIsUploading(true);
    setUploadProgress(0);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";

      if (confirmEndpoint) {
        // ✅ 2-step flow: preview → confirm
        const previewResponse = await fetch(`${API_BASE_URL}${uploadEndpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId,
          },
          body: formData,
        });

        if (!previewResponse.ok) {
          const errorData = await previewResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Preview failed: ${previewResponse.status}`);
        }

        const previewData = await previewResponse.json();
        const previewRows = Array.isArray(previewData.rows) ? previewData.rows : [];
        setUploadProgress(50);

        const confirmResponse = await fetch(`${API_BASE_URL}${confirmEndpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(previewRows),
        });

        if (!confirmResponse.ok) {
          const errorData = await confirmResponse.json().catch(() => ({}));
          throw new Error(errorData.error || `Import failed: ${confirmResponse.status}`);
        }

        const confirmData = await confirmResponse.json();
        setUploadProgress(100);

        setResult({
          success: Boolean(confirmData.success),
          message: confirmData.message || "Import complete",
          total_rows: Number(previewData.total_rows || previewRows.length || 0),
          successful: Number(confirmData.inserted || 0),
          failed: Number(previewData.invalid_rows || 0) + Number(confirmData.skipped || 0),
          errors: confirmData.errors || [],
        });

        if (Number(confirmData.inserted) > 0) onImportComplete();

      } else {
        // ✅ Single-step flow
        const response = await fetch(`${API_BASE_URL}${uploadEndpoint}`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": tenantId,
          },
          body: formData,
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Upload failed");

        setResult(data);
        if (data.successful > 0) onImportComplete();
      }
    } catch (error) {
      console.error("Upload error:", error);
      setResult({
        success: false,
        message: error instanceof Error ? error.message : "Upload failed",
        total_rows: 0,
        successful: 0,
        failed: 1,
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const tenantId = localStorage.getItem("tenant_id") || "1";
      const response = await fetch(`${API_BASE_URL}${templateEndpoint}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": tenantId,
        },
      });
      if (!response.ok) throw new Error("Failed to download template");
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = templateFilename || "import_template.csv";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Template download error:", error);
      alert("Failed to download template");
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    setIsUploading(false);
    setUploadProgress(0);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import Energy Customers</DialogTitle>
          <DialogDescription>
            Upload an Excel or CSV file to import multiple customers at once
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
                <Button onClick={handleDownloadTemplate} variant="outline" size="sm" className="mt-3">
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </div>
          </div>

          {/* File Upload Area */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              isDragging ? "border-blue-500 bg-blue-50"
              : file ? "border-green-500 bg-green-50"
              : "border-gray-300 bg-gray-50"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileChange} className="hidden" />
            {file ? (
              <div className="flex items-center justify-center gap-3">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-900">{file.name}</p>
                  <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(2)} KB</p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setFile(null)} className="ml-4">
                  <X className="h-4 w-4" />
                </Button>
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

          {/* Upload Progress */}
          {isUploading && (
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Uploading...</span>
                <span className="text-gray-500">{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
              </div>
            </div>
          )}

          {/* Upload Result */}
          {result && (
            <div className={`p-4 rounded-lg border ${
              result.success && result.failed === 0 ? "bg-green-50 border-green-200"
              : result.successful > 0 ? "bg-yellow-50 border-yellow-200"
              : "bg-red-50 border-red-200"
            }`}>
              <div className="flex items-start gap-3">
                {result.success && result.failed === 0 ? (
                  <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className="text-sm font-medium text-gray-900">Import Results</h3>
                  <div className="mt-2 space-y-1 text-sm">
                    <p>Total rows processed: <span className="font-medium">{result.total_rows}</span></p>
                    <p className="text-green-700">Successful: <span className="font-medium">{result.successful}</span></p>
                    {result.failed > 0 && (
                      <p className="text-red-700">Failed: <span className="font-medium">{result.failed}</span></p>
                    )}
                  </div>

                  {/* ✅ Fixed: handles both string and object errors */}
                  {result.errors && result.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-red-900 mb-2">Errors:</p>
                      <div className="bg-white rounded border border-red-200 p-3 max-h-40 overflow-y-auto">
                        <ul className="text-xs text-red-800 space-y-1">
                          {result.errors.map((error: any, index: number) => (
                            <li key={index}>• {formatError(error)}</li>
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
            <Button variant="outline" onClick={handleClose}>Cancel</Button>
            <Button onClick={handleUpload} disabled={!file || isUploading}>
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
              <li>• <strong>Tel Number</strong> (required)</li>
              <li>• Contact Person, Email, Address (optional)</li>
              <li>• Site Address, MPAN/MPR, Supplier (optional)</li>
              <li>• Annual Usage, Start Date, End Date (optional)</li>
            </ul>
            <p className="mt-3 text-xs text-gray-600">
              Note: Status, Callback, and Assigned To will be set to defaults and can be updated later.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}