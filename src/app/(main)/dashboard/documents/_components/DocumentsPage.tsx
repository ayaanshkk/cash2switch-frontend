"use client";

import { useEffect, useState, useRef } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { Upload, Download, FileText, Trash2, Search, X, ExternalLink, File } from "lucide-react";
import { toast } from "react-hot-toast";

interface DocumentsPageProps {
  category: string;
  title: string;
}

type Document = {
  public_id: string;
  document_name: string;
  url: string;
  download_url?: string;
  format: string;
  file_size: number;
  created_at: string;
  category?: string;
};

const CATEGORIES = [
  { value: "CONTRACT", label: "Contract" },
  { value: "LOA", label: "Letter of Authority" },
  { value: "APPLICATION", label: "Application Form" },
  { value: "INVOICE", label: "Invoice" },
  { value: "PROPOSAL", label: "Proposal" },
  { value: "OTHER", label: "Other" },
];

export default function DocumentsPage({ category, title }: DocumentsPageProps) {
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
    category: "CONTRACT",
    isNewConnection: false,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Filter state
  const [searchTerm, setSearchTerm] = useState("");

  // Check if we're on the New Connections page
  const isNewConnectionsPage = category === "NEW_CONNECTIONS";

  const resetUploadForm = () => {
    setFile(null);
    setUploadForm({
      document_name: "",
      category: "CONTRACT",
      isNewConnection: isNewConnectionsPage,
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
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
    if (!authLoading) {
      loadDocuments();
    }
  }, [authLoading]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      const validTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
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
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, "");
        setUploadForm(prev => ({
          ...prev,
          document_name: nameWithoutExt
        }));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    if (!uploadForm.document_name.trim()) {
      toast.error("Please enter a document name");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_name', uploadForm.document_name);
      
      const finalCategory = (isNewConnectionsPage || uploadForm.isNewConnection) 
        ? "NEW_CONNECTIONS" 
        : uploadForm.category;
      formData.append('category', finalCategory);

      console.log('📤 Uploading:', uploadForm.document_name, 'Category:', finalCategory);

      const result = await api.uploadDocument(formData);

      if (!result.success) {
        throw new Error(result.message || result.error || 'Upload failed');
      }

      toast.success('Document uploaded successfully');
      setUploadModalOpen(false);
      resetUploadForm();
      await loadDocuments();
    } catch (error: any) {
      console.error('❌ Upload error:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (downloadUrl: string, filename: string, format: string) => {
    try {
      const fileExtension = format ? `.${format}` : '';
      const filenameWithExtension = filename.includes('.') 
        ? filename 
        : `${filename}${fileExtension}`;
      
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = filenameWithExtension;
      link.target = '_blank';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success('Download started');
    } catch (error: any) {
      console.error('Download error:', error);
      toast.error('Failed to download file');
    }
  };

  const handleView = (url: string) => {
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (publicId: string, documentName: string) => {
    if (!window.confirm(`Are you sure you want to delete "${documentName}"?`)) {
      return;
    }

    try {
      const result = await api.deleteDocument(publicId);
      
      if (!result.success) {
        throw new Error(result.error || 'Delete failed');
      }
      
      toast.success("Document deleted successfully");
      await loadDocuments();
    } catch (err: any) {
      console.error("❌ Delete error:", err);
      toast.error(err.message || "Failed to delete document");
    }
  };

  const getFileIcon = (format: string) => {
    const type = format?.toLowerCase() || '';
    if (type === 'pdf') {
      return <FileText className="h-8 w-8 text-red-500 shrink-0" />;
    } else if (type === 'doc' || type === 'docx') {
      return <FileText className="h-8 w-8 text-blue-500 shrink-0" />;
    } else if (type === 'xls' || type === 'xlsx') {
      return <FileText className="h-8 w-8 text-green-500 shrink-0" />;
    }
    return <File className="h-8 w-8 text-gray-500 dark:text-slate-400 shrink-0" />;
  };

  const formatFileSize = (bytes: number): string => {
    if (!bytes) return 'Unknown';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const filteredDocuments = documents.filter(doc => {
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      if (!doc.document_name.toLowerCase().includes(term)) {
        return false;
      }
    }
    
    if (category === "ALL") {
      return true;
    } else if (category === "NEW_CONNECTIONS") {
      return doc.category === "NEW_CONNECTIONS" || doc.category === "APPLICATION";
    }
    
    return true;
  });

  return (
    <div className="w-full p-4 sm:p-6 text-slate-900 dark:text-slate-100">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 dark:text-slate-50">{title}</h1>
          <p className="text-sm text-muted-foreground mt-1 dark:text-slate-400">
            {category === "NEW_CONNECTIONS" 
              ? "Documents specifically for new customer connections"
              : "All document templates - contracts, LOAs, applications, and more"
            }
          </p>
        </div>
        <Button onClick={() => setUploadModalOpen(true)} className="w-full sm:w-auto dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200">
          <Upload className="mr-2 h-4 w-4" />
          Upload Template
        </Button>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative w-full sm:w-64">
          <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4 dark:text-slate-500" />
          <Input
            placeholder="Search documents..."
            className="pl-8 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Documents Grid */}
      <div className="grid gap-4">
        {loading ? (
          <div className="text-center py-12">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600 dark:text-slate-400"></div>
            <p className="mt-4 text-gray-500 dark:text-slate-400">Loading documents...</p>
          </div>
        ) : error ? (
          <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="pt-6">
              <div className="text-center text-sm text-destructive dark:text-red-400">{error}</div>
            </CardContent>
          </Card>
        ) : filteredDocuments.length === 0 ? (
          <Card className="border-slate-200 dark:border-slate-800 dark:bg-slate-900">
            <CardContent className="pt-6">
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-4" />
                <p className="text-lg text-gray-600 dark:text-slate-300">No documents found</p>
                {searchTerm ? (
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Try adjusting your search</p>
                ) : category === "NEW_CONNECTIONS" ? (
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">
                    Upload documents to show here
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-gray-500 dark:text-slate-400">Upload your first document to get started</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map((doc, index) => (
              <Card key={`${doc.public_id}-${index}`} className="border-slate-200 transition-shadow hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {getFileIcon(doc.format)}
                      <div className="flex-1 min-w-0">
                        <CardTitle className="text-base truncate text-slate-950 dark:text-slate-50">
                          {doc.document_name}
                        </CardTitle>
                        <CardDescription className="text-xs dark:text-slate-400 mt-0.5">
                          {doc.format?.toUpperCase()} • {formatFileSize(doc.file_size)}
                          {doc.category && (
                            <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-750 rounded text-[10px] dark:bg-blue-950/60 dark:text-blue-300">
                              {doc.category === "NEW_CONNECTIONS" ? "New Connection" : doc.category}
                            </span>
                          )}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="text-xs text-gray-500 dark:text-slate-400 mb-4">
                    Uploaded {format(new Date(doc.created_at), "MMM d, yyyy")}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1 dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => handleDownload(doc.download_url || doc.url, doc.document_name, doc.format)}
                    >
                      <Download className="h-4 w-4 mr-1 shrink-0" />
                      Download
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => handleView(doc.url)}
                      title="View in new tab"
                    >
                      <ExternalLink className="h-4 w-4 shrink-0" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="dark:border-slate-700 dark:hover:bg-slate-800"
                      onClick={() => handleDelete(doc.public_id, doc.document_name)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      <Dialog open={uploadModalOpen} onOpenChange={(open) => {
        setUploadModalOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="max-w-md w-[90vw] sm:w-full dark:border-slate-800 dark:bg-slate-950">
          <DialogHeader>
            <DialogTitle className="text-slate-950 dark:text-slate-50">Upload Document Template</DialogTitle>
            <DialogDescription className="dark:text-slate-400">
              {isNewConnectionsPage 
                ? "Upload a document for new customer connections"
                : "Upload a document template and categorize it"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file" className="dark:text-slate-300">File *</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx"
                disabled={uploading}
                onChange={handleFileChange}
                className="mt-1 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100"
              />
              {file && (
                <div className="mt-2 text-sm text-gray-600 dark:text-slate-300 flex items-center justify-between bg-gray-50 dark:bg-slate-900 p-2 rounded border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{file.name}</span> ({formatFileSize(file.size)})
                  </div>
                  <button
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
                    className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 shrink-0 ml-2"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs text-gray-500 dark:text-slate-400">
                Accepted: PDF, Word, Excel (max 10MB)
              </p>
            </div>

            <div>
              <Label htmlFor="document_name" className="dark:text-slate-300">Document Name *</Label>
              <Input
                id="document_name"
                value={uploadForm.document_name}
                onChange={(e) => setUploadForm(prev => ({ ...prev, document_name: e.target.value }))}
                placeholder="e.g., Business Energy LOA"
                className="mt-1 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              />
            </div>

            {/* Category selection */}
            {!isNewConnectionsPage && (
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3 items-start">
                <div>
                  <Label htmlFor="category" className="dark:text-slate-300">Category *</Label>
                  <Select
                    value={uploadForm.category}
                    onValueChange={(value) => setUploadForm(prev => ({ ...prev, category: value }))}
                    disabled={uploadForm.isNewConnection}
                  >
                    <SelectTrigger className="mt-1 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="dark:border-slate-800 dark:bg-slate-900">
                      {CATEGORIES.map(cat => (
                        <SelectItem key={cat.value} value={cat.value} className="dark:hover:bg-slate-800">
                          {cat.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* New Connection Checkbox */}
                <div className="sm:pt-7">
                  <div className="flex items-center space-x-2 pt-1 sm:pt-0">
                    <Checkbox
                      id="new_connection"
                      checked={uploadForm.isNewConnection}
                      onCheckedChange={(checked) => 
                        setUploadForm(prev => ({ ...prev, isNewConnection: !!checked }))
                      }
                      className="dark:border-slate-700 dark:bg-slate-800 dark:checked:bg-primary"
                    />
                    <Label 
                      htmlFor="new_connection" 
                      className="text-sm font-normal cursor-pointer whitespace-nowrap dark:text-slate-300"
                    >
                      New Connection
                    </Label>
                  </div>
                </div>
              </div>
            )}

            {/* Helper text */}
            {!isNewConnectionsPage && (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                {uploadForm.isNewConnection 
                  ? "This document will appear only in 'New Connections' page" 
                  : "This document will appear in 'All Documents' page"
                }
              </p>
            )}

            {isNewConnectionsPage && (
              <p className="text-xs text-gray-500 dark:text-slate-400">
                This document will appear in 'New Connections' page
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setUploadModalOpen(false);
                  resetUploadForm();
                }}
                className="dark:border-slate-700 dark:hover:bg-slate-800"
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading || !uploadForm.document_name.trim()}
                className="dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
              >
                {uploading ? (
                  <>
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-solid border-current border-r-transparent mr-2"></span>
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