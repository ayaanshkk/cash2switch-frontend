"use client";

import { useState } from "react";
import { Upload, FileText, AlertCircle, CheckCircle, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

// Import the base URL for constructing API URLs
const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000";
const API_ROOT = `${BASE_URL}/streemlyne`;

interface ImportStatus {
  id: number;
  filename: string;
  import_type: string;
  status: "processing" | "completed" | "failed";
  records_processed: number;
  records_failed: number;
  error_log?: string;
  created_at: string;
  completed_at?: string;
}

interface DataImportProps {
  onImportComplete?: () => void;
  trigger?: React.ReactNode;
}

export default function DataImportComponent({ onImportComplete, trigger }: DataImportProps) {
  const [open, setOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importType, setImportType] = useState<string>("");
  const [importing, setImporting] = useState(false);
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [error, setError] = useState<string>("");

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      const allowedTypes = [".xlsx", ".xls", ".csv"];
      const fileExtension = "." + file.name.split(".").pop()?.toLowerCase();

      if (!allowedTypes.includes(fileExtension)) {
        setError("Invalid file type. Please select an Excel (.xlsx, .xls) or CSV file.");
        setSelectedFile(null);
        return;
      }

      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        setError("File size must be less than 10MB.");
        setSelectedFile(null);
        return;
      }

      setSelectedFile(file);
      setError("");
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !importType) {
      setError("Please select a file and import type");
      return;
    }

    setImporting(true);
    setError("");

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("import_type", importType);
      formData.append("imported_by", "System User"); // You might want to get this from auth context

      // Use the centralized API_ROOT for file upload
      // Note: For FormData, we don't set Content-Type header (browser sets it with boundary)
      const token = localStorage.getItem("auth_token");

      const response = await fetch(`${API_ROOT}/import/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      // --- IMPROVED ERROR HANDLING ---
      // Check the content type of the response
      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        // Try to parse error based on content type
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Upload failed");
        } else {
          // Server returned HTML (500 error page)
          const htmlText = await response.text();
          console.error("Server error response (HTML):", htmlText);

          // Try to extract meaningful error from HTML
          const tempDiv = document.createElement("div");
          tempDiv.innerHTML = htmlText;
          const errorText = tempDiv.textContent || "";

          // Look for common error patterns
          let errorMessage = "Server error occurred";
          if (errorText.includes("AttributeError")) {
            errorMessage = "Server configuration error. Please contact support.";
          } else if (errorText.includes("ImportError") || errorText.includes("ModuleNotFoundError")) {
            errorMessage = "Server dependency error. Please contact support.";
          } else if (errorText.includes("FileNotFoundError")) {
            errorMessage = "Upload directory not found. Please contact support.";
          } else if (errorText.includes("PermissionError")) {
            errorMessage = "File permission error. Please contact support.";
          } else if (errorText.length > 0) {
            // Extract first meaningful line
            const lines = errorText.split("\n").filter((l) => l.trim().length > 0);
            if (lines.length > 0) {
              errorMessage = lines[0].substring(0, 200);
            }
          }

          throw new Error(errorMessage);
        }
      }

      // Success - parse JSON response
      const result = await response.json();

      // Start polling for status
      pollImportStatus(result.import_id);
    } catch (error) {
      console.error("Import error:", error);
      setError(error instanceof Error ? error.message : "Import failed");
      setImporting(false);
    }
  };

  const pollImportStatus = async (importId: number) => {
    try {
      // Use the centralized API_ROOT for polling
      const token = localStorage.getItem("auth_token");

      const response = await fetch(`${API_ROOT}/import/${importId}/status`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      // --- IMPROVED ERROR HANDLING ---
      const contentType = response.headers.get("content-type");

      if (!response.ok) {
        if (contentType?.includes("application/json")) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to get import status");
        } else {
          throw new Error("Failed to get import status (server error)");
        }
      }

      const status: ImportStatus = await response.json();
      setImportStatus(status);

      if (status.status === "processing") {
        // Poll again in 2 seconds
        setTimeout(() => pollImportStatus(importId), 2000);
      } else {
        // Import completed or failed
        setImporting(false);

        if (status.status === "completed" && onImportComplete) {
          onImportComplete();
        }
      }
    } catch (error) {
      console.error("Status polling error:", error);
      setError("Failed to get import status");
      setImporting(false);
    }
  };

  const resetDialog = () => {
    setSelectedFile(null);
    setImportType("");
    setImportStatus(null);
    setError("");
    setImporting(false);
  };

  const handleClose = () => {
    if (!importing) {
      resetDialog();
      setOpen(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "processing":
        return <Badge variant="secondary">Processing</Badge>;
      case "completed":
        return <Badge variant="default">Completed</Badge>;
      case "failed":
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (isOpen) {
          setOpen(true);
        } else {
          handleClose(); // This now correctly calls your close/reset logic
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline">
            <Upload className="mr-2 h-4 w-4" />
            Import Data
          </Button>
        )}
      </DialogTrigger>

      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import Appliance Data</DialogTitle>
          <DialogDescription>
            Upload Excel files from Appliance Matrix or KBB Pricelist to bulk import products
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Import Configuration */}
          {!importStatus && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Import Type *</Label>
                <Select value={importType} onValueChange={setImportType}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select the type of data you're importing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="appliance_matrix">Appliance Matrix (Products with categories)</SelectItem>
                    <SelectItem value="kbb_pricelist">KBB Pricelist (Pricing data)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>File *</Label>
                <Input type="file" accept=".xlsx,.xls,.csv" onChange={handleFileSelect} />
                {selectedFile && (
                  <div className="text-muted-foreground flex items-center gap-2 text-sm">
                    <FileText className="h-4 w-4" />
                    <span>{selectedFile.name}</span>
                    <span>({(selectedFile.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              {/* Column Mapping Info */}
              {importType && (
                <div className="rounded-lg bg-gray-50 p-4">
                  <h4 className="mb-2 font-medium text-gray-900">
                    Expected Columns for {importType === "appliance_matrix" ? "Appliance Matrix" : "KBB Pricelist"}
                  </h4>
                  <div className="text-sm text-gray-700">
                    {importType === "appliance_matrix" ? (
                      <div className="grid grid-cols-2 gap-2">
                        <div>Required:</div>
                        <div>Optional:</div>
                        <div>• Brand</div>
                        <div>• Series</div>
                        <div>• Model Code</div>
                        <div>• Description</div>
                        <div>• Product Name</div>
                        <div>• Dimensions</div>
                        <div>• Category</div>
                        <div>• Weight</div>
                        <div>• Base Price</div>
                        <div>• Energy Rating</div>
                        <div></div>
                        <div>• Warranty Years</div>
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <div>Required:</div>
                        <div>Optional:</div>
                        <div>• Model Code</div>
                        <div>• Notes</div>
                        <div>• Low Tier Price</div>
                        <div>• Pack Name</div>
                        <div>• Mid Tier Price</div>
                        <div>• Lead Time</div>
                        <div>• High Tier Price</div>
                        <div></div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Import Progress */}
          {importing && !importStatus && (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="border-primary h-4 w-4 animate-spin rounded-full border-b-2"></div>
                <span>Uploading and validating file...</span>
              </div>
              <Progress value={30} />
            </div>
          )}

          {/* Import Status */}
          {importStatus && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Import Status</h4>
                {getStatusBadge(importStatus.status)}
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">File:</span>
                  <div className="font-medium">{importStatus.filename}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Type:</span>
                  <div className="font-medium capitalize">{importStatus.import_type.replace("_", " ")}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Started:</span>
                  <div>{formatDateTime(importStatus.created_at)}</div>
                </div>
                {importStatus.completed_at && (
                  <div>
                    <span className="text-muted-foreground">Completed:</span>
                    <div>{formatDateTime(importStatus.completed_at)}</div>
                  </div>
                )}
              </div>

              {/* Progress for ongoing imports */}
              {importStatus.status === "processing" && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="border-primary h-4 w-4 animate-spin rounded-full border-b-2"></div>
                    <span>Processing records...</span>
                  </div>
                  <Progress value={75} />
                  <p className="text-muted-foreground text-sm">{importStatus.records_processed} records processed</p>
                </div>
              )}

              {/* Results for completed imports */}
              {importStatus.status === "completed" && (
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    Import completed successfully! Processed {importStatus.records_processed} records
                    {importStatus.records_failed > 0 && (
                      <span className="text-orange-600"> ({importStatus.records_failed} failed)</span>
                    )}
                  </AlertDescription>
                </Alert>
              )}

              {/* Results for failed imports */}
              {importStatus.status === "failed" && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Import failed after processing {importStatus.records_processed} records
                    {importStatus.error_log && (
                      <details className="mt-2">
                        <summary className="cursor-pointer">View error details</summary>
                        <pre className="mt-2 overflow-auto rounded bg-gray-100 p-2 text-xs">
                          {importStatus.error_log}
                        </pre>
                      </details>
                    )}
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Download Templates */}
          <div className="border-t pt-4">
            <h4 className="mb-3 font-medium">Download Templates</h4>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                Appliance Matrix Template
              </Button>
              <Button variant="outline" size="sm">
                <Download className="mr-2 h-4 w-4" />
                KBB Pricelist Template
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            {importing ? "Import in Progress..." : "Cancel"}
          </Button>
          {!importStatus && (
            <Button onClick={handleImport} disabled={!selectedFile || !importType || importing}>
              {importing ? (
                <>
                  <div className="mr-2 h-4 w-4 animate-spin rounded-full border-b-2 border-white"></div>
                  Importing...
                </>
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Start Import
                </>
              )}
            </Button>
          )}
          {importStatus?.status === "completed" && (
            <Button onClick={handleClose}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Done
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}