"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api } from "@/lib/api";
import { Upload, FileText, X } from "lucide-react";
import { toast } from "react-hot-toast";

interface ClientDocumentUploadProps {
  clientId: number;
  onUploadSuccess?: () => void;
}

export default function ClientDocumentUpload({ clientId, onUploadSuccess }: ClientDocumentUploadProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploadForm, setUploadForm] = useState({
    document_name: "",
    document_description: "",
    category: "CLIENT_UPLOAD",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      
      if (!uploadForm.document_name) {
        setUploadForm(prev => ({
          ...prev,
          document_name: selectedFile.name
        }));
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Please select a file");
      return;
    }

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_name', uploadForm.document_name || file.name);
      formData.append('document_description', uploadForm.document_description);
      formData.append('category', uploadForm.category);

      const result = await api.clientUploadDocument(clientId, formData);

      if (!result.success) {
        throw new Error(result.error || 'Upload failed');
      }

      toast.success('Document uploaded successfully');
      setModalOpen(false);
      resetUploadForm();
      
      if (onUploadSuccess) {
        onUploadSuccess();
      }
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  const resetUploadForm = () => {
    setFile(null);
    setUploadForm({
      document_name: "",
      document_description: "",
      category: "CLIENT_UPLOAD",
    });
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  return (
    <>
      <Button onClick={() => setModalOpen(true)} variant="outline" size="sm">
        <Upload className="mr-2 h-4 w-4" />
        Upload Document
      </Button>

      <Dialog open={modalOpen} onOpenChange={(open) => {
        setModalOpen(open);
        if (!open) resetUploadForm();
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Client Document</DialogTitle>
            <DialogDescription>
              Upload a document for this client
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="file">File *</Label>
              <Input
                ref={fileInputRef}
                id="file"
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt"
                onChange={handleFileChange}
                className="mt-1"
              />
              {file && (
                <div className="mt-2 text-sm text-gray-600 flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {file.name} ({formatFileSize(file.size)})
                  <button
                    onClick={() => {
                      setFile(null);
                      if (fileInputRef.current) {
                        fileInputRef.current.value = "";
                      }
                    }}
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
                placeholder="e.g., Signed Contract"
                className="mt-1"
              />
            </div>

            <div>
              <Label htmlFor="document_description">Description</Label>
              <Textarea
                id="document_description"
                value={uploadForm.document_description}
                onChange={(e) => setUploadForm(prev => ({ ...prev, document_description: e.target.value }))}
                placeholder="Optional description..."
                className="mt-1"
                rows={3}
              />
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  setModalOpen(false);
                  resetUploadForm();
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
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
    </>
  );
}