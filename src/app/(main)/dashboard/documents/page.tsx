"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Upload, Download, FileText, Trash2, Search, X, ExternalLink, File } from "lucide-react";
import { toast } from "react-hot-toast";

type Document = {
  public_id?: string;     // legacy Cloudinary — kept for backward compat
  pathname?: string;      // Vercel Blob pathname (preferred identifier)
  document_name: string;
  url: string;
  download_url?: string;
  format: string;
  file_size: number;
  created_at: string;
  category?: string;
};

// Business rates document categories
const CATEGORIES = [
  { value: "VOA_LETTER",      label: "VOA Assessment Letter" },
  { value: "RATES_BILL",      label: "Rates Bill" },
  { value: "APPEAL",          label: "Appeal Submission" },
  { value: "EVIDENCE",        label: "Supporting Evidence" },
  { value: "CORRESPONDENCE",  label: "Client Correspondence" },
  { value: "OTHER",           label: "Other" },
];

export default function DocumentsPage() {
  const { loading: authLoading } = useAuth();
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Upload modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    document_name: "",
    category: "VOA_LETTER",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter state
  const [searchTerm, setSearchTerm] = useState("");

  const resetUploadForm = () => {
    setFile(null);
    setUploadForm({ document_name: "", category: "VOA_LETTER" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const loadDocuments = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await api.getDocuments();
      setDocuments(result.data || []);
    } catch (err: any) {
      console.error("Error loading documents:", err);
      setError(err.message || "Failed to load documents");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) loadDocuments();
  }, [authLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    const validTypes = [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!validTypes.includes(selectedFile.type)) {
      toast.error("Invalid file type. Please upload PDF, Word, or Excel files.");
      return;
    }
    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("File size must be less than 10MB");
      return;
    }

    setFile(selectedFile);
    if (!uploadForm.document_name) {
      setUploadForm(prev => ({
        ...prev,
        document_name: selectedFile.name.replace(/\.[^/.]+$/, ""),
      }));
    }
  };

  const handleUpload = async () => {
    if (!file) { toast.error("Please select a file"); return; }
    if (!uploadForm.document_name.trim()) { toast.error("Please enter a document name"); return; }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("document_name", uploadForm.document_name);
      formData.append("category", uploadForm.category);

      const result = await api.uploadDocument(formData);
      if (!result.success) throw new Error(result.message || result.error || "Upload failed");

      toast.success("Document uploaded successfully");
      setUploadModalOpen(false);
      resetUploadForm();
      await loadDocuments();
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(error.message || "Failed to upload document");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (downloadUrl: string, filename: string, fmt: string) => {
    try {
      const ext = fmt ? `.${fmt}` : "";
      const name = filename.includes(".") ? filename : `${filename}${ext}`;
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = name;
      link.target = "_blank";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Download started");
    } catch {
      toast.error("Failed to download file");
    }
  };

  const handleView = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleDelete = async (doc: Document) => {
    // Use pathname (Vercel Blob) if available, fall back to public_id (legacy)
    const identifier = doc.pathname || doc.public_id;
    if (!identifier) { toast.error("Cannot delete: missing file identifier"); return; }
    if (!window.confirm(`Are you sure you want to delete "${doc.document_name}"?`)) return;

    try {
      const result = await api.deleteDocument(identifier);
      if (!result.success) throw new Error(result.error || "Delete failed");
      toast.success("Document deleted successfully");
      await loadDocuments();
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(err.message || "Failed to delete document");
    }
  };

  const getFileIcon = (fmt: string) => {
    const t = fmt?.toLowerCase() || "";
    if (t === "pdf")                  return <FileText className="h-8 w-8 text-red-500" />;
    if (t === "doc" || t === "docx")  return <FileText className="h-8 w-8 text-blue-500" />;
    if (t === "xls" || t === "xlsx")  return <FileText className="h-8 w-8 text-green-500" />;
    return <File className="h-8 w-8 text-gray-500" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return "Unknown";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + " KB";
    return (bytes / (1024 * 1024)).toFixed(2) + " MB";
  };

  const getCategoryLabel = (value?: string) =>
    CATEGORIES.find(c => c.value === value)?.label ?? value ?? "";

  const filteredDocuments = documents.filter(doc =>
    !searchTerm || doc.document_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="w-full p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Documents</h1>
          <p className="text-muted-foreground mt-1">
            VOA letters, rates bills, appeal submissions, evidence and client correspondence
          </p>
        </div>
        <Button onClick={() => setUploadModalOpen(true)}>
          <Upload className="mr-2 h-4 w-4" />
          Upload Document
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative w-64">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
          <Input
            placeholder="Search documents..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600" />
            <p className="mt-4 text-gray-500">Loading documents...</p>
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-sm text-destructive">{error}</div>
            </CardContent>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-lg text-gray-600">No documents found</p>
                <p className="mt-2 text-sm text-gray-500">
                  {searchTerm ? "Try adjusting your search" : "Upload the first document for this case"}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc) => {
              const key = doc.pathname || doc.public_id || doc.document_name;
              return (
                <Card key={key} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {getFileIcon(doc.format)}
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base truncate">
                            {doc.document_name}
                          </CardTitle>
                          <CardDescription className="text-xs">
                            {doc.format?.toUpperCase()} • {formatFileSize(doc.file_size)}
                            {doc.category && (
                              <span className="ml-2 text-blue-600">
                                {getCategoryLabel(doc.category)}
                              </span>
                            )}
                          </CardDescription>
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="text-xs text-gray-500 mb-4">
                      Uploaded {format(new Date(doc.created_at), "MMM d, yyyy")}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDownload(doc.download_url || doc.url, doc.document_name, doc.format)}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleView(doc.url)}
                        title="View in new tab"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(doc)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={(open) => {
        setUploadModalOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Document</DialogTitle>
            <DialogDescription>
              Upload a case document (PDF, Word, or Excel — max 10MB)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">File *</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                onChange={handleFileChange}
                className="mt-1"
              />
              {file && (
                <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {file.name} ({formatFileSize(file.size)})
                  <button
                    onClick={() => { setFile(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-red-500 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <div>
              <Label htmlFor="document_name">Document Name *</Label>
              <Input
                id="document_name"
                value={uploadForm.document_name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, document_name: e.target.value }))}
                placeholder="e.g., VOA Assessment Letter — Unit 4 Manchester"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="category">Category</Label>
              <Select
                value={uploadForm.category}
                onValueChange={(value) => setUploadForm(prev => ({ ...prev, category: value }))}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => { setUploadModalOpen(false); resetUploadForm(); }}>
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading || !uploadForm.document_name.trim()}
              >
                {uploading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}