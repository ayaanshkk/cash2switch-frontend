"use client";
import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Calendar,
  Package,
  FileText,
  Eye,
  Upload,
  Trash2,
  Image,
  Clock,
  Plus,
  X,
  ChevronDown,
  CheckSquare,
  Receipt,
  DollarSign,
  Edit,
  Loader2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
// import { useToast } from "@/components/ui/use-toast";


interface Project {
  id: string;
  project_name: string;
  project_type: "Kitchen" | "Bedroom" | "Wardrobe" | "Remedial" | "Other";
  stage: string;
  date_of_measure: string | null;
  notes: string;
  form_count: number;
  created_at: string;
  customer_id: string;
}

interface Customer {
  id: string;
  name: string;
  address: string;
  postcode: string;
  phone: string;
  email: string;
}

interface DrawingDocument {
  id: string;
  filename: string;
  url: string;
  type: "pdf" | "image" | "other";
  created_at: string;
  project_id?: string;
}

interface FormSubmission {
  id: number;
  token_used: string;
  submitted_at: string;
  form_data: any;
  project_id?: string;
  created_by?: number;
}

interface Quotation {
  id: number;
  reference_number: string;
  total: number;
  status: string;
  notes: string;
  created_at: string;
  items_count?: number;
  project_id?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  total: number;
  status: string;
  created_at: string;
  customer_id?: string;
  project_id?: string;
}

interface Receipt {
  id: number;
  receipt_type: string;
  amount_paid: number;
  total_paid_to_date: number;
  balance_to_pay: number;
  payment_date: string;
  created_at: string;
  customer_id?: string;
  project_id?: string;
}

interface PaymentTerms {
  id: number;
  terms_title: string;
  total_amount: number;
  created_at: string;
  customer_id?: string;
  project_id?: string;
}

interface FinancialDocument {
  id: string | number;
  type: "quotation" | "invoice" | "proforma" | "receipt" | "deposit" | "final" | "payment_terms" | "terms";
  title: string;
  reference?: string;
  total?: number;
  amount_paid?: number;
  balance?: number;
  created_at: string;
  created_by?: string;
  status?: string;
  form_submission_id?: number;
  project_id?: string;
  customer_id?: string;
}

const DRAWING_DOCUMENT_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-4 w-4 text-red-600" />,
  image: <Image className="h-4 w-4 text-green-600" />,
  other: <FileText className="h-4 w-4 text-gray-600" />,
};

const formatDate = (dateString: string) => {
  if (!dateString) return "—";
  try {
    const isoLike = /^\d{4}-\d{2}-\d{2}$/;
    const date = isoLike.test(dateString) ? new Date(dateString + "T00:00:00") : new Date(dateString);
    if (isNaN(date.getTime())) return dateString;
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateString;
  }
};

const getProjectTypeColor = (type: string) => {
  switch (type) {
    case "Kitchen":
      return "bg-blue-100 text-blue-800";
    case "Bedroom":
      return "bg-purple-100 text-purple-800";
    case "Wardrobe":
      return "bg-green-100 text-green-800";
    case "Remedial":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStageColor = (stage: string) => {
  switch (stage) {
    case "Complete":
      return "bg-green-100 text-green-800";
    case "Production":
      return "bg-blue-100 text-blue-800";
    case "Installation":
      return "bg-orange-100 text-orange-800";
    case "Measure":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// ✅ FIXED: Better form type detection
const getFormType = (submission: FormSubmission): string => {
  // First check form_data if it has form_type
  if (submission.form_data && submission.form_data.form_type) {
    return submission.form_data.form_type.toLowerCase();
  }
  
  // Then check token
  const token = (submission.token_used || "").toLowerCase();
  if (token.includes("bedroom")) return "bedroom";
  if (token.includes("kitchen")) return "kitchen";
  if (token.includes("remedial")) return "remedial";
  if (token.includes("checklist")) return "checklist";
  if (token.includes("quote") || token.includes("quotation")) return "quotation";
  if (token.includes("invoice") && !token.includes("proforma")) return "invoice";
  if (token.includes("proforma")) return "proforma";
  if (token.includes("receipt")) return "receipt";
  if (token.includes("payment")) return "payment";
  
  return "other";
};

// ✅ FIXED: Better form title generation
const getFormTitle = (submission: FormSubmission): string => {
  const formType = getFormType(submission);
  
  switch (formType) {
    case "bedroom":
      return "Bedroom Checklist";
    case "kitchen":
      return "Kitchen Checklist";
    case "remedial":
      return "Remedial Action Checklist";
    case "checklist":
      return "General Checklist";
    case "quotation":
      return "Quotation";
    case "invoice":
      return "Invoice";
    case "proforma":
      return "Proforma Invoice";
    case "receipt":
      return "Receipt";
    case "payment":
      return "Payment Terms";
    default:
      // If we still don't know, check if form_data has customer info
      if (submission.form_data) {
        if (submission.form_data.customer_name) {
          return `Form - ${submission.form_data.customer_name}`;
        }
      }
      return `Form #${submission.id}`;
  }
};

export default function ProjectDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const projectId = params?.id as string;
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [project, setProject] = useState<Project | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [drawings, setDrawings] = useState<DrawingDocument[]>([]);
  const [forms, setForms] = useState<FormSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDrawings, setSelectedDrawings] = useState<Set<string>>(new Set());
  const [showAddTaskDialog, setShowAddTaskDialog] = useState(false);
  const [showDeleteDrawingDialog, setShowDeleteDrawingDialog] = useState(false);
  const [drawingToDelete, setDrawingToDelete] = useState<DrawingDocument | null>(null);
  const [isDeletingDrawing, setIsDeletingDrawing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [financialDocuments, setFinancialDocuments] = useState<FinancialDocument[]>([]);
  const [showQuoteGenerationDialog, setShowQuoteGenerationDialog] = useState(false);
  const [formSubmissions, setFormSubmissions] = useState<any[]>([]);
  const [checklistForQuote, setChecklistForQuote] = useState<{
    type: string;
    id: number;
  } | null>(null);

  // ✅ NEW: Delete form dialog state
  const [showDeleteFormDialog, setShowDeleteFormDialog] = useState(false);
  const [formToDelete, setFormToDelete] = useState<FormSubmission | null>(null);
  const [isDeletingForm, setIsDeletingForm] = useState(false);

  const [deletingQuoteId, setDeletingQuoteId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: number; reference: string } | null>(null);

  // Task form state
  const [taskData, setTaskData] = useState({
    type: "Job",
    date: new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "17:00",
    endDate: new Date().toISOString().split("T")[0],
    assignTo: "",
    jobTask: "",
    notes: "",
  });

  const canEdit = useMemo(() => {
    const role = (user?.role || "").toLowerCase();
    return ["manager", "hr", "production", "sales"].includes(role);
  }, [user?.role]);

  const canDelete = useMemo(() => {
    const role = (user?.role || "").toLowerCase();
    return ["manager", "hr", "sales"].includes(role);
  }, [user?.role]);

  const canCreateFinancialDocs = useMemo(() => {
    const role = (user?.role || "").toLowerCase();
    return ["manager", "sales"].includes(role);
  }, [user?.role]);

  const loadProjectData = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    const token = localStorage.getItem("auth_token");
    const headers = {
      "Content-Type": "application/json",
      ...(token && { "Authorization": `Bearer ${token}` })
    };

    try {
      // ✅ Fetch project first
      const projectRes = await fetch(
        `http://localhost:5000/projects/${projectId}`, 
        { headers }
      );

      if (!projectRes.ok) {
        throw new Error("Failed to load project data");
      }

      const projectData = await projectRes.json();
      setProject(projectData);

      // ✅ Fetch customer data
      if (projectData.customer_id) {
        try {
          const customerRes = await fetch(
            `http://localhost:5000/clients/${projectData.customer_id}`,
            { headers }
          );
          if (customerRes.ok) {
            const customerData = await customerRes.json();
            setCustomer(customerData);
          }
        } catch (err) {
          console.warn("Failed to load customer:", err);
        }
      }

      // ✅ Helper function to safely fetch data
      const fetchWithFallback = async (url: string) => {
        try {
          const response = await fetch(url, { headers });
          if (!response.ok) {
            console.warn(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
            return null;
          }
          const contentType = response.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            return await response.json();
          }
          console.warn(`Non-JSON response from ${url}`);
          return null;
        } catch (error) {
          console.warn(`Error fetching ${url}:`, error);
          return null;
        }
      };

      // ✅ Parallel fetch with proper error handling
      const [
        formsData,
        drawingsData,
        quotationsData,
        invoicesData,
        receiptsData,
        paymentTermsData
      ] = await Promise.all([
        fetchWithFallback(`http://localhost:5000/form-submissions?project_id=${projectId}`),
        fetchWithFallback(`http://localhost:5000/files/drawings?project_id=${projectId}`),
        fetchWithFallback(`http://localhost:5000/proposals?project_id=${projectId}`),
        fetchWithFallback(`http://localhost:5000/invoices?project_id=${projectId}`),
        fetchWithFallback(`http://localhost:5000/receipts?project_id=${projectId}`),
        fetchWithFallback(`http://localhost:5000/payment-terms?project_id=${projectId}`)
      ]);

      // ✅ Process forms
      if (formsData && Array.isArray(formsData)) {
        setForms(formsData);
        setFormSubmissions(formsData);
      } else {
        setForms([]);
        setFormSubmissions([]);
      }

      // ✅ Process drawings
      if (drawingsData && Array.isArray(drawingsData)) {
        setDrawings(drawingsData);
      } else {
        setDrawings([]);
      }

      // ✅ Process financial documents
      const allFinancialDocs: FinancialDocument[] = [];

      // Quotations
      if (quotationsData && Array.isArray(quotationsData)) {
        quotationsData.forEach((quote) => {
          allFinancialDocs.push({
            id: quote.id,
            type: 'quotation',
            title: `Quotation ${quote.reference_number}`,
            reference: quote.reference_number,
            total: quote.total,
            status: quote.status,
            created_at: quote.created_at,
            project_id: quote.project_id,
          });
        });
      }

      // Invoices
      if (invoicesData && Array.isArray(invoicesData)) {
        invoicesData.forEach((invoice) => {
          allFinancialDocs.push({
            id: invoice.id,
            type: invoice.invoice_number?.toLowerCase().includes('proforma') ? 'proforma' : 'invoice',
            title: invoice.invoice_number || `Invoice #${invoice.id}`,
            reference: invoice.invoice_number,
            total: invoice.total,
            status: invoice.status,
            created_at: invoice.created_at,
            project_id: invoice.project_id,
          });
        });
      }

      // Receipts
      if (receiptsData && Array.isArray(receiptsData)) {
        receiptsData.forEach((receipt) => {
          const receiptType = receipt.receipt_type?.toLowerCase() || 'receipt';
          allFinancialDocs.push({
            id: receipt.id,
            type: receiptType.includes('deposit') ? 'deposit' : receiptType.includes('final') ? 'final' : 'receipt',
            title: `${receipt.receipt_type || 'Receipt'} - ${formatDate(receipt.payment_date)}`,
            reference: `#${receipt.id}`,
            amount_paid: receipt.amount_paid,
            balance: receipt.balance_to_pay,
            created_at: receipt.created_at,
            project_id: receipt.project_id,
          });
        });
      }

      // Payment Terms
      if (paymentTermsData && Array.isArray(paymentTermsData)) {
        paymentTermsData.forEach((terms) => {
          allFinancialDocs.push({
            id: terms.id,
            type: 'payment_terms',
            title: terms.terms_title || 'Payment Terms',
            reference: `#${terms.id}`,
            total: terms.total_amount,
            created_at: terms.created_at,
            project_id: terms.project_id,
          });
        });
      }

      // Sort by date
      allFinancialDocs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setFinancialDocuments(allFinancialDocs);

    } catch (error) {
      console.error("Error loading project data:", error);
      setError("Failed to load project data. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // ✅ Fixed useEffect
  useEffect(() => {
    if (!projectId || !user) return;
    loadProjectData();
  }, [projectId, user, loadProjectData]);

  // Financial Document Helper Functions
  const getFinancialDocIcon = (type: string) => {
    switch (type) {
      case 'quotation':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'invoice':
        return <FileText className="h-5 w-5 text-indigo-600" />;
      case 'proforma':
        return <FileText className="h-5 w-5 text-purple-600" />;
      case 'receipt':
        return <Receipt className="h-5 w-5 text-green-600" />;
      case 'deposit':
        return <Receipt className="h-5 w-5 text-emerald-600" />;
      case 'final':
        return <Receipt className="h-5 w-5 text-teal-600" />;
      case 'payment_terms':
        return <DollarSign className="h-5 w-5 text-orange-600" />;
      default:
        return <FileText className="h-5 w-5 text-gray-600" />;
    }
  };

  const getFinancialDocColor = (type: string) => {
    switch (type) {
      case 'quotation':
        return 'from-blue-50 to-blue-100';
      case 'invoice':
        return 'from-indigo-50 to-indigo-100';
      case 'proforma':
        return 'from-purple-50 to-purple-100';
      case 'receipt':
        return 'from-green-50 to-green-100';
      case 'deposit':
        return 'from-emerald-50 to-emerald-100';
      case 'final':
        return 'from-teal-50 to-teal-100';
      case 'payment_terms':
        return 'from-orange-50 to-orange-100';
      default:
        return 'from-gray-50 to-gray-100';
    }
  };

  const handleViewFinancialDocument = (doc: FinancialDocument) => {
    switch (doc.type) {
      case 'quotation':
        window.open(`/dashboard/quotes/${doc.id}`, '_blank');
        break;
      case 'invoice':
      case 'proforma':
        window.open(`/dashboard/invoices/${doc.id}`, '_blank');
        break;
      case 'receipt':
      case 'deposit':
      case 'final':
        window.open(`/dashboard/receipts/${doc.id}`, '_blank');
        break;
      case 'payment_terms':
        window.open(`/dashboard/payment-terms/${doc.id}`, '_blank');
        break;
      default:
        alert('Document viewer not available');
    }
  };

  useEffect(() => {
    if (!projectId) {
      console.error("No project ID provided");
      return;
    }
    
    if (!user) {
      console.log("Waiting for user authentication...");
      return;
    }

    console.log("Loading project:", projectId, "for user:", user.role);
    loadProjectData();
  }, [projectId, user, loadProjectData]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const token = localStorage.getItem("auth_token");
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    const uploadedDocs: DrawingDocument[] = [];

    for (const file of Array.from(files)) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("customer_id", project?.customer_id || "");
        formData.append("project_id", projectId);

        const response = await fetch("http://localhost:5000/files/drawings", {
          method: "POST",
          headers: headers,
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          if (data.drawing && data.drawing.id) {
            const newDoc: DrawingDocument = {
              id: data.drawing.id,
              filename: data.drawing.filename || data.drawing.file_name || file.name,
              url: data.drawing.url || data.drawing.file_url,
              type: data.drawing.type || data.drawing.category || "other",
              created_at: data.drawing.created_at || new Date().toISOString(),
              project_id: data.drawing.project_id,
            };
            uploadedDocs.push(newDoc);
          }
        }
      } catch (error) {
        console.error("Upload error:", error);
      }
    }

    if (uploadedDocs.length > 0) {
      setDrawings((prev) => {
        const updated = [...uploadedDocs, ...prev];
        return updated.sort((a, b) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
      });
    }

    if (event.target) event.target.value = "";
  }, [projectId, project?.customer_id]);

  const handleViewDrawing = useCallback((doc: DrawingDocument) => {
    const BACKEND_URL = "http://localhost:5000";
    let viewUrl = doc.url;

    if (viewUrl && viewUrl.startsWith("http")) {
      window.open(viewUrl, "_blank");
      return;
    }

    if (viewUrl && !viewUrl.startsWith("http")) {
      viewUrl = `${BACKEND_URL}${viewUrl.startsWith("/") ? viewUrl : "/" + viewUrl}`;
    } else if (!viewUrl) {
      alert("Error: Drawing URL is missing or invalid.");
      return;
    }

    window.open(viewUrl, "_blank");
  }, []);

  const handleDeleteDrawing = useCallback((doc: DrawingDocument) => {
    setDrawingToDelete(doc);
    setShowDeleteDrawingDialog(true);
  }, []);
  
  const handleConfirmDeleteDrawing = useCallback(async () => {
    if (!drawingToDelete || isDeletingDrawing) return;
    setIsDeletingDrawing(true);
    const token = localStorage.getItem("auth_token");
    const headers: HeadersInit = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(
        `http://localhost:5000/files/drawings/${drawingToDelete.id}`,
        { method: "DELETE", headers }
      );

      if (res.ok) {
        setDrawings((prev) => prev.filter((d) => d.id !== drawingToDelete.id));
        setSelectedDrawings((prev) => {
          const newSet = new Set(prev);
          newSet.delete(drawingToDelete.id);
          return newSet;
        });
        setShowDeleteDrawingDialog(false);
        setDrawingToDelete(null);
      } else {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        alert(`Failed to delete: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert("Network error");
    } finally {
      setIsDeletingDrawing(false);
    }
  }, [drawingToDelete, isDeletingDrawing]);

  const handleToggleDrawingSelection = useCallback((drawingId: string) => {
    setSelectedDrawings((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(drawingId)) {
        newSet.delete(drawingId);
      } else {
        newSet.add(drawingId);
      }
      return newSet;
    });
  }, []);

  const handleDeleteQuote = async (quoteId: number) => {
    setDeletingQuoteId(quoteId);
    
    try {
      const token = localStorage.getItem('auth_token');
      const response = await fetch(
        `http://localhost:5000/proposals/${quoteId}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete quotation');
      }

      console.log('✅ Quotation deleted successfully');
      
      await loadProjectData(); // or loadCustomerData() for customer page
      
      alert('✅ Quotation deleted successfully!'); // ← Simple alert
    } catch (error) {
      console.error('❌ Error deleting quotation:', error);
      alert('❌ Failed to delete quotation. Please try again.'); // ← Simple alert
    } finally {
      setDeletingQuoteId(null);
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    }
  };

  const handleAddTask = useCallback(async () => {
    const token = localStorage.getItem("auth_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const response = await fetch("http://localhost:5000/tasks", {
        method: "POST",
        headers: headers,
        body: JSON.stringify({
          ...taskData,
          project_id: projectId,
          customer_id: project?.customer_id,
        }),
      });

      if (response.ok) {
        alert("Task scheduled successfully!");
        setShowAddTaskDialog(false);
        setTaskData({
          type: "Job",
          date: new Date().toISOString().split("T")[0],
          startTime: "09:00",
          endTime: "17:00",
          endDate: new Date().toISOString().split("T")[0],
          assignTo: "",
          jobTask: `${project?.project_type} - ${project?.project_name}`,
          notes: `Customer: ${customer?.name}\nAddress: ${customer?.address}\nPhone: ${customer?.phone}`,
        });
      } else {
        const error = await response.json();
        alert(`Failed to create task: ${error.message || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error creating task:", error);
      alert("Network error: Could not create task");
    }
  }, [taskData, projectId, project, customer]);

  const generateToken = useCallback(async (type: string) => {
    const token = localStorage.getItem("auth_token");
    const headers: HeadersInit = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    setGenerating(true);
    try {
      const res = await fetch("http://localhost:5000/form-tokens", {
        method: "POST",
        headers,
        body: JSON.stringify({
          form_type: type,
          customer_id: customer?.id,
          project_id: projectId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const newToken = data.token;
        let formUrl = "";

        if (type === "kitchen") {
          formUrl = `http://localhost:5000/kitchen-checklist?token=${newToken}`;
        } else if (type === "bedroom") {
          formUrl = `http://localhost:5000/bedroom-checklist?token=${newToken}`;
        } else if (type === "remedial") {
          formUrl = `http://localhost:5000/remedial-checklist?token=${newToken}`;
        } else if (type === "checklist") {
          formUrl = `http://localhost:5000/checklist-form?token=${newToken}`;
        } else if (type === "proposals") {
          formUrl = `http://localhost:5000/proposals?token=${newToken}`;
        } else if (type === "invoice") {
          formUrl = `http://localhost:5000/invoice?token=${newToken}`;
        } else if (type === "proforma") {
          formUrl = `http://localhost:5000/proforma-invoice?token=${newToken}`;
        } else if (type === "receipt") {
          formUrl = `http://localhost:5000/receipt?token=${newToken}`;
        } else if (type === "deposit") {
          formUrl = `http://localhost:5000/deposit-receipt?token=${newToken}`;
        } else if (type === "final") {
          formUrl = `http://localhost:5000/final-receipt?token=${newToken}`;
        } else if (type === "payment") {
          formUrl = `http://localhost:5000/payment-terms?token=${newToken}`;
        }

        window.open(formUrl, "_blank");
      } else {
        const err = await res.json().catch(() => ({ error: "Failed" }));
        alert(`Error: ${err.error}`);
      }
    } catch (error) {
      console.error("Error generating token:", error);
      alert("Network error");
    } finally {
      setGenerating(false);
    }
  }, [customer?.id, projectId]);

  const handleCreateKitchenChecklist = useCallback(async () => {
    if (generating || !canEdit) return;

    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(
        `http://localhost:5000/clients/${customer.id}/generate-form-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ formType: "kitchen" }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const params = new URLSearchParams({
            type: "kitchen",
            customerId: customer.id,
            customerName: customer.name || "",
            customerAddress: customer.address || "",
            customerPhone: customer.phone || "",
            projectId: projectId,
          });
          router.push(`/form/${data.token}?${params.toString()}`);
        } else {
          alert(`Failed to generate kitchen form: ${data.error}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to generate kitchen form: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Network error generating kitchen form:", error);
      alert("Network error: Please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }, [generating, canEdit, customer, projectId, router]);

  const handleCreateBedroomChecklist = useCallback(async () => {
    if (generating || !canEdit) return;

    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }

    setGenerating(true);
    try {
      const response = await fetch(
        `http://localhost:5000/clients/${customer.id}/generate-form-link`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ formType: "bedroom" }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          const params = new URLSearchParams({
            type: "bedroom",
            customerId: customer.id,
            customerName: customer.name || "",
            customerAddress: customer.address || "",
            customerPhone: customer.phone || "",
            projectId: projectId,
          });
          router.push(`/form/${data.token}?${params.toString()}`);
        } else {
          alert(`Failed to generate bedroom form: ${data.error}`);
        }
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to generate bedroom form: ${errorData.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Network error generating bedroom form:", error);
      alert("Network error: Please check your connection and try again.");
    } finally {
      setGenerating(false);
    }
  }, [generating, canEdit, customer, projectId, router]);

  const handleCreateRemedialChecklist = useCallback(() => {
    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }
    const params = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.name || "",
      customerAddress: customer.address || "",
      customerPhone: customer.phone || "",
    });
    router.push(`/dashboard/checklists/remedial?${params.toString()}`);
  }, [customer, router]);

  const handleCreateChecklist = useCallback(() => {
    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }
    router.push(`/dashboard/checklists/create?customerId=${customer.id}`);
  }, [customer, router]);

  const handleCreateQuote = useCallback(async () => {
    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }

    // ✅ CHECK: Does this project have bedroom or kitchen checklist?
    const bedroomChecklist = forms.find((form) => {
      try {
        const formDataRaw = typeof form.form_data === "string" 
          ? JSON.parse(form.form_data) 
          : form.form_data;
        const formType = (formDataRaw?.form_type || "").toString().toLowerCase();
        return formType.includes("bed");
      } catch {
        return false;
      }
    });

    const kitchenChecklist = forms.find((form) => {
      try {
        const formDataRaw = typeof form.form_data === "string" 
          ? JSON.parse(form.form_data) 
          : form.form_data;
        const formType = (formDataRaw?.form_type || "").toString().toLowerCase();
        return formType.includes("kitchen");
      } catch {
        return false;
      }
    });

    // ✅ If checklist exists, show dialog
    if (bedroomChecklist || kitchenChecklist) {
      const checklistType = bedroomChecklist ? "bedroom" : "kitchen";
      const checklistId = bedroomChecklist?.id || kitchenChecklist?.id;
      
      setChecklistForQuote({ type: checklistType, id: checklistId! });
      setShowQuoteGenerationDialog(true);
      return;
    }

    // ✅ No checklist - create blank quote
    createBlankQuote();
  }, [customer, forms]);

  const createBlankQuote = useCallback(() => {
    if (!customer) return;
    
    const params = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.name || "",
      customerAddress: customer.address || "",
      customerPhone: customer.phone || "",
      customerEmail: customer.email || "",
      type: "quotation",
      source: "project",
      projectId: projectId,
    });
    router.push(`/dashboard/quotes/create?${params.toString()}`);
  }, [customer, projectId, router]);

  const handleGenerateFromChecklist = useCallback(async () => {
    if (!checklistForQuote) return;

    setShowQuoteGenerationDialog(false);
    
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `http://localhost:5000/proposals/generate-from-checklist/${checklistForQuote.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        
        // ✅ Open quote details page in new tab
        window.open(`/dashboard/quotes/${data.quotation_id}`, '_blank');
        
        // ✅ Reload project data to show new quote
        await loadProjectData();
        
        // Show success message
        alert(
          `✅ Quote generated successfully!\n\n` +
          `Reference: ${data.reference_number}\n` +
          `Items: ${data.items_count}\n` +
          `Total: £${data.total.toFixed(2)}`
        );
      } else {
        const error = await response.json();
        alert(`Failed to generate quote: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error generating quote:", error);
      alert("Network error: Could not generate quote");
    } finally {
      setChecklistForQuote(null);
    }
  }, [checklistForQuote, loadProjectData]);

const handleCreateInvoice = useCallback(() => {
  if (!customer?.id) {
    alert("Error: No customer associated with this project");
    return;
  }
  const params = new URLSearchParams({
    customerId: customer.id,
    customerName: customer.name || "",
    customerAddress: customer.address || "",
    customerPhone: customer.phone || "",
    customerEmail: customer.email || "",
    type: "invoice",
    source: "project",
    projectId: projectId
  });
  router.push(`/dashboard/checklists/invoice/?${params.toString()}`);
}, [customer, projectId, router]);

  const handleCreateProformaInvoice = useCallback(() => {
    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }
    const params = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.name || "",
      customerAddress: customer.address || "",
      customerPhone: customer.phone || "",
      customerEmail: customer.email || "",
      type: "proforma",
      source: "project",
      projectId: projectId
    });
    router.push(`/dashboard/checklists/invoice/?${params.toString()}`);
  }, [customer, projectId, router]);

  const handleCreateReceipt = useCallback(() => {
    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }
    const params = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.name || "",
      customerAddress: customer.address || "",
      customerPhone: customer.phone || "",
      type: "receipt",
      paidAmount: "0.00",
      totalPaidToDate: "0.00",
      balanceToPay: "0.00",
      receiptDate: new Date().toISOString().split("T")[0],
      paymentMethod: "BACS",
      paymentDescription: "Payment received for your Kitchen/Bedroom Cabinetry.",
      projectId: projectId  // ✅ ADD THIS
    });
    router.push(`/dashboard/checklists/receipt?${params.toString()}`);
  }, [customer, projectId, router]);

  const handleCreateDepositReceipt = useCallback(() => {
    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }
    const params = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.name || "",
      customerAddress: customer.address || "",
      customerPhone: customer.phone || "",
      type: "deposit",
      paidAmount: "0.00",
      totalPaidToDate: "0.00",
      balanceToPay: "0.00",
      receiptDate: new Date().toISOString().split("T")[0],
      paymentMethod: "BACS",
      paymentDescription: "Deposit payment received for your Kitchen/Bedroom Cabinetry.",
      projectId: projectId  // ✅ ADD THIS
    });
    router.push(`/dashboard/checklists/receipt?${params.toString()}`);
  }, [customer, projectId, router]);

  const handleCreateFinalReceipt = useCallback(() => {
    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }
    const params = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.name || "",
      customerAddress: customer.address || "",
      customerPhone: customer.phone || "",
      type: "final",
      paidAmount: "0.00",
      totalPaidToDate: "0.00",
      balanceToPay: "0.00",
      receiptDate: new Date().toISOString().split("T")[0],
      paymentMethod: "BACS",
      paymentDescription: "Final payment received for your Kitchen/Bedroom Cabinetry.",
      projectId: projectId  // ✅ ADD THIS
    });
    router.push(`/dashboard/checklists/receipt?${params.toString()}`);
  }, [customer, projectId, router]);

  const handleCreatePaymentTerms = useCallback(() => {
    if (!customer?.id) {
      alert("Error: No customer associated with this project");
      return;
    }
    const params = new URLSearchParams({
      customerId: customer.id,
      customerName: customer.name || "",
      customerAddress: customer.address || "",
      customerPhone: customer.phone || "",
      customerEmail: customer.email || "",
      type: "payment_terms",
      source: "project",
      projectId: projectId
    });
    router.push(`/dashboard/checklists/payment-terms/?${params.toString()}`);
  }, [customer, projectId, router]);

  const handleViewChecklist = useCallback((submission: FormSubmission) => {
    window.open(`/checklist-view?id=${submission.id}`, "_blank");
  }, []);

  // ✅ FIXED: Edit form handler - construct proper URL with token
  const handleEditForm = useCallback((submission: FormSubmission) => {
    console.log("🔧 Editing form:", submission);
    
    const formType = getFormType(submission);
    const token = submission.token_used;
    
    if (!token) {
      alert("Error: No token found for this form");
      return;
    }
    
    let editUrl = "";
    
    // Construct the proper edit URL based on form type
    if (formType === "bedroom") {
      editUrl = `/form/${token}?type=bedroom&edit=true`;
    } else if (formType === "kitchen") {
      editUrl = `/form/${token}?type=kitchen&edit=true`;
    } else if (formType === "remedial") {
      editUrl = `/remedial-checklist?token=${token}&edit=true`;
    } else if (formType === "checklist") {
      editUrl = `/checklist-form?token=${token}&edit=true`;
    } else if (formType === "quotation") {
      editUrl = `/quotation?token=${token}&edit=true`;
    } else if (formType === "invoice") {
      editUrl = `/invoice?token=${token}&edit=true`;
    } else if (formType === "proforma") {
      editUrl = `/proforma-invoice?token=${token}&edit=true`;
    } else if (formType === "receipt") {
      editUrl = `/receipt?token=${token}&edit=true`;
    } else if (formType === "payment") {
      editUrl = `/payment-terms?token=${token}&edit=true`;
    } else {
      // Generic fallback
      editUrl = `/checklist-view?id=${submission.id}`;
    }
    
    console.log("🔗 Opening edit URL:", editUrl);
    window.open(editUrl, "_blank");
  }, []);

  // ✅ NEW: Delete form handler
  const handleDeleteForm = useCallback((submission: FormSubmission) => {
    setFormToDelete(submission);
    setShowDeleteFormDialog(true);
  }, []);

  // ✅ NEW: Confirm delete form
  const handleConfirmDeleteForm = useCallback(async () => {
    if (!formToDelete || isDeletingForm) return;
    
    setIsDeletingForm(true);
    const token = localStorage.getItem("auth_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    try {
      const res = await fetch(
        `http://localhost:5000/form-submissions/${formToDelete.id}`,
        { 
          method: "DELETE", 
          headers 
        }
      );

      if (res.ok) {
        // Remove from state immediately
        setForms((prev) => prev.filter((f) => f.id !== formToDelete.id));
        setShowDeleteFormDialog(false);
        setFormToDelete(null);
        alert("Form deleted successfully!");
      } else {
        const err = await res.json().catch(() => ({ error: "Server error" }));
        alert(`Failed to delete form: ${err.error}`);
      }
    } catch (e) {
      console.error("Delete form error:", e);
      alert("Network error: Could not delete form");
    } finally {
      setIsDeletingForm(false);
    }
  }, [formToDelete, isDeletingForm]);

  // Loading state with skeleton
  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <div className="border-b border-gray-200 bg-white px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="h-10 w-10 bg-gray-200 rounded animate-pulse" />
              <div className="space-y-2">
                <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />
                <div className="h-4 w-96 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
            <div className="flex space-x-3">
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-40 bg-gray-200 rounded animate-pulse" />
            </div>
          </div>
        </div>

        <div className="px-8 py-6">
          <div className="mb-8 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                  <div className="h-6 w-32 bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8 rounded-lg border bg-white p-6">
            <div className="h-6 w-56 bg-gray-200 rounded animate-pulse mb-4" />
            <div className="grid grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 bg-gray-200 rounded animate-pulse" />
                  <div className="h-5 w-full bg-gray-100 rounded animate-pulse" />
                </div>
              ))}
            </div>
          </div>

          <div className="mb-8 border-t pt-8">
            <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-6" />
            <div className="space-y-4">
              {[1, 2].map((i) => (
                <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>

          <div className="border-t pt-8">
            <div className="flex items-center justify-between mb-6">
              <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
              <div className="h-10 w-32 bg-gray-200 rounded animate-pulse" />
            </div>
            <div className="grid grid-cols-2 gap-6">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!project) return <div className="p-8">Project not found.</div>;

  return (
    <div className="min-h-screen bg-white">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept=".pdf,image/png,image/jpeg,image/jpg,image/gif"
        multiple
        style={{ display: "none" }}
      />

      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => router.back()}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center space-x-3">
                <Package className="h-6 w-6 text-blue-600" />
                <h1 className="text-3xl font-semibold text-gray-900">{project.project_name}</h1>
              </div>
              {customer && (
                <p className="mt-1 text-sm text-gray-600">
                  Customer: {customer.name} • {customer.address}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-3">
            {canEdit && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="flex items-center space-x-2">
                    <Plus className="h-4 w-4" />
                    <span>Create</span>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  {user?.role?.toLowerCase() !== "sales" && (
                    <DropdownMenuItem onClick={handleCreateRemedialChecklist} className="flex items-center space-x-2" disabled={generating}>
                      <CheckSquare className="h-4 w-4" />
                      <span>Remedial Action Checklist</span>
                    </DropdownMenuItem>
                  )}
                  {/* <DropdownMenuItem onClick={handleCreateChecklist} className="flex items-center space-x-2" disabled={generating}>
                    <CheckSquare className="h-4 w-4" />
                    <span>Checklist</span>
                  </DropdownMenuItem> */}
                  <DropdownMenuItem onClick={handleCreateQuote} className="flex items-center space-x-2" disabled={generating}>
                    <FileText className="h-4 w-4" />
                    <span>Quotation</span>
                  </DropdownMenuItem>
                  {canCreateFinancialDocs && (
                    <>
                      <DropdownMenuItem onClick={handleCreateInvoice} className="flex items-center space-x-2" disabled={generating}>
                        <FileText className="h-4 w-4" />
                        <span>Invoice</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreateProformaInvoice} className="flex items-center space-x-2" disabled={generating}>
                        <FileText className="h-4 w-4" />
                        <span>Proforma Invoice</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreateReceipt} className="flex items-center space-x-2" disabled={generating}>
                        <Receipt className="h-4 w-4" />
                        <span>Receipt</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreateDepositReceipt} className="flex items-center space-x-2" disabled={generating}>
                        <Receipt className="h-4 w-4" />
                        <span>Deposit Receipt</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreateFinalReceipt} className="flex items-center space-x-2" disabled={generating}>
                        <Receipt className="h-4 w-4" />
                        <span>Final Receipt</span>
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={handleCreatePaymentTerms} className="flex items-center space-x-2" disabled={generating}>
                        <DollarSign className="h-4 w-4" />
                        <span>Payment Terms</span>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={handleCreateKitchenChecklist}
                    className="flex items-center space-x-2"
                    disabled={generating}
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Kitchen Checklist Form</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={handleCreateBedroomChecklist}
                    className="flex items-center space-x-2"
                    disabled={generating}
                  >
                    <CheckSquare className="h-4 w-4" />
                    <span>Bedroom Checklist Form</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <Button onClick={() => setShowAddTaskDialog(true)} className="flex items-center space-x-2">
              <Calendar className="h-4 w-4" />
              <span>Schedule Task</span>
            </Button>
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Project Overview */}
        <div className="mb-8 rounded-lg bg-gradient-to-br from-blue-50 to-indigo-50 p-6">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Project Overview</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-sm text-gray-600">Project Type</span>
              <div className="mt-1">
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getProjectTypeColor(project.project_type)}`}>
                  {project.project_type}
                </span>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Current Stage</span>
              <div className="mt-1">
                <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium ${getStageColor(project.stage)}`}>
                  {project.stage}
                </span>
              </div>
            </div>
            <div>
              <span className="text-sm text-gray-600">Measure Date</span>
              <p className="mt-1 text-gray-900">{formatDate(project.date_of_measure || "")}</p>
            </div>
            <div>
              <span className="text-sm text-gray-600">Created</span>
              <p className="mt-1 text-gray-900">{formatDate(project.created_at)}</p>
            </div>
          </div>
          {project.notes && (
            <div className="mt-4">
              <span className="text-sm text-gray-600">Notes</span>
              <p className="mt-1 rounded bg-white p-3 text-gray-900">{project.notes}</p>
            </div>
          )}
        </div>

        {/* Customer Information */}
        {customer && (
          <div className="mb-8 rounded-lg border bg-white p-6">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Customer Information</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <span className="text-sm text-gray-600">Name</span>
                <p className="mt-1 font-medium text-gray-900">{customer.name}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Phone</span>
                <p className="mt-1 text-gray-900">{customer.phone}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Email</span>
                <p className="mt-1 text-gray-900">{customer.email || "—"}</p>
              </div>
              <div className="md:col-span-2">
                <span className="text-sm text-gray-600">Address</span>
                <p className="mt-1 text-gray-900">{customer.address}</p>
              </div>
              <div>
                <span className="text-sm text-gray-600">Postcode</span>
                <p className="mt-1 text-gray-900">{customer.postcode}</p>
              </div>
            </div>
          </div>
        )}

        {/* ✅ FIXED: Checklists Section with proper display, edit, and delete */}
        <div className="mb-8 border-t border-gray-200 pt-8">
          <h2 className="mb-6 text-xl font-semibold text-gray-900">
            Checklists ({forms.length})
          </h2>
          {forms.length > 0 ? (
            <div className="space-y-4">
              {forms.map((form) => {
                const formTitle = getFormTitle(form);
                
                return (
                  <div
                    key={form.id}
                    className="flex items-center justify-between rounded-lg border bg-gray-50 p-4 transition hover:bg-gray-100"
                  >
                    <div className="flex flex-col">
                      <h3 className="text-lg font-semibold text-gray-900">{formTitle}</h3>
                      <span className="text-sm text-gray-500">Submitted: {formatDate(form.submitted_at)}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewChecklist(form)}
                        className="flex items-center space-x-1"
                      >
                        <Eye className="h-4 w-4" />
                        <span>View</span>
                      </Button>

                      {/* ✅ FIXED: Edit button - accessible to all roles */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditForm(form)}
                        className="flex items-center space-x-1"
                      >
                        <Edit className="h-4 w-4" />
                        <span>Edit</span>
                      </Button>

                      {/* ✅ NEW: Delete button - accessible to all roles */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteForm(form)}
                        className="flex items-center space-x-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                        <span>Delete</span>
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <CheckSquare className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No Checklists Yet</h3>
              <p className="text-sm text-gray-600">Create checklists for this project using the Create dropdown above.</p>
            </div>
          )}
        </div>

        {/* Drawings & Layouts */}
        <div className="mb-8 border-t border-gray-200 pt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Drawings & Layouts ({drawings.length})
            </h2>
            <Button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-2 bg-green-600 hover:bg-green-700"
            >
              <Upload className="h-4 w-4" />
              <span>Upload File</span>
            </Button>
          </div>

          {drawings.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
              {drawings
                .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
                .map((doc) => {
                  const fileExtension = doc.filename.split(".").pop()?.toLowerCase() || "other";
                  const docType =
                    doc.type ||
                    (fileExtension === "pdf"
                      ? "pdf"
                      : ["png", "jpg", "jpeg", "gif"].includes(fileExtension)
                        ? "image"
                        : "other");

                  return (
                    <div
                      key={doc.id}
                      className="rounded-lg border bg-white p-6 shadow-sm transition-all duration-200 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between">
                        <Checkbox
                          checked={selectedDrawings.has(doc.id)}
                          onCheckedChange={() => handleToggleDrawingSelection(doc.id)}
                          className="mr-4 mt-1"
                        />
                        <div className="flex flex-1 items-start space-x-4">
                          <div className="rounded-xl bg-gradient-to-br from-gray-50 to-gray-100 p-3">
                            {DRAWING_DOCUMENT_ICONS[docType] || <FileText className="h-5 w-5 text-gray-600" />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="truncate font-semibold text-gray-900">{doc.filename}</h3>
                            <p className="mt-1 text-sm text-gray-500">Uploaded: {formatDate(doc.created_at)}</p>
                          </div>
                        </div>
                        <div className="ml-6 flex items-center space-x-2">
                          <Button
                            onClick={() => handleViewDrawing(doc)}
                            variant="outline"
                            size="sm"
                            className="flex items-center space-x-2"
                          >
                            <Eye className="h-4 w-4" />
                            <span>View</span>
                          </Button>
                          <Button
                            onClick={() => handleDeleteDrawing(doc)}
                            disabled={isDeletingDrawing}
                            variant="outline"
                            size="sm"
                            className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
              <Image className="mx-auto mb-4 h-12 w-12 text-gray-300" />
              <h3 className="mb-2 text-lg font-medium text-gray-900">No Drawings Yet</h3>
              <p className="text-sm text-gray-600">Upload CADs, sketches, or photos for this project.</p>
            </div>
          )}
        </div>
      </div>

      {/* FINANCIAL DOCUMENTS SECTION - Only show if documents exist */}
      <div className="mb-8 border-t border-gray-200 pt-8 px-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900">
            Financial Documents ({financialDocuments.length})
          </h2>
          {financialDocuments.length > 0 && (
            <div className="text-sm text-gray-600">
              {financialDocuments.filter(d => d.type === 'quotation').length} Quotation{financialDocuments.filter(d => d.type === 'quotation').length !== 1 ? 's' : ''} • {' '}
              {financialDocuments.filter(d => d.type === 'invoice' || d.type === 'proforma').length} Invoice{financialDocuments.filter(d => d.type === 'invoice' || d.type === 'proforma').length !== 1 ? 's' : ''} • {' '}
              {financialDocuments.filter(d => d.type === 'receipt' || d.type === 'deposit' || d.type === 'final').length} Receipt{financialDocuments.filter(d => d.type === 'receipt' || d.type === 'deposit' || d.type === 'final').length !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {financialDocuments.length > 0 ? (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {financialDocuments.map((doc) => (
              <div
                key={`${doc.type}-${doc.id}`}
                className={`rounded-lg border bg-gradient-to-br ${getFinancialDocColor(doc.type)} p-6 shadow-sm transition-all duration-200 hover:shadow-md`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="mb-3 flex items-center space-x-3">
                      <div className="rounded-lg bg-white p-2 shadow-sm">
                        {getFinancialDocIcon(doc.type)}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900 line-clamp-1">{doc.title}</h3>
                        <p className="text-xs text-gray-600 capitalize">{doc.type.replace('_', ' ')}</p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {doc.status && (
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${
                            doc.status === 'Approved' || doc.status === 'Paid' ? 'bg-green-100 text-green-800' :
                            doc.status === 'Draft' || doc.status === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                            doc.status === 'Rejected' ? 'bg-red-100 text-red-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {doc.status}
                          </span>
                        </div>
                      )}

                      {doc.total !== undefined && (
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Total:</span>{' '}
                          <span className="font-semibold text-gray-900">£{doc.total.toFixed(2)}</span>
                        </p>
                      )}

                      {doc.amount_paid !== undefined && doc.amount_paid > 0 && (
                        <p className="text-sm text-green-700">
                          <span className="font-medium">Paid:</span>{' '}
                          <span className="font-semibold">£{doc.amount_paid.toFixed(2)}</span>
                        </p>
                      )}

                      {doc.balance !== undefined && doc.balance > 0 && (
                        <p className="text-sm text-red-700">
                          <span className="font-medium">Balance:</span>{' '}
                          <span className="font-semibold">£{doc.balance.toFixed(2)}</span>
                        </p>
                      )}

                      <p className="text-xs text-gray-600">
                        <Calendar className="mr-1 inline h-3 w-3" />
                        {formatDate(doc.created_at)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* ✅ CHANGED: Buttons now in flex row with gap */}
                <div className="mt-4 flex items-center gap-2">
                  <Button
                    onClick={() => handleViewFinancialDocument(doc)}
                    variant="outline"
                    size="sm"
                    className="flex-1 bg-white hover:bg-gray-50"
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </Button>
                  
                  {/* ✅ NEW: Delete Button - ONLY for quotations */}
                  {doc.type === 'quotation' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        setQuoteToDelete({ 
                          id: typeof doc.id === 'string' ? parseInt(doc.id) : doc.id, 
                          reference: doc.reference || doc.title 
                        });
                        setDeleteDialogOpen(true);
                      }}
                      disabled={deletingQuoteId === doc.id}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200"
                    >
                      {deletingQuoteId === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-12 text-center">
            <DollarSign className="mx-auto mb-6 h-16 w-16 text-gray-300" />
            <h3 className="mb-4 text-xl font-semibold text-gray-900">No Financial Documents</h3>
            <p className="mx-auto mb-8 max-w-2xl text-gray-600">
              Create financial documents for this project using the Create dropdown above.
            </p>
          </div>
        )}
      </div>

      {/* ✅ NEW: Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Quotation</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete quotation "{quoteToDelete?.reference}"? 
              This action cannot be undone and will permanently remove the quotation and all its items.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingQuoteId !== null}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (quoteToDelete) {
                  handleDeleteQuote(quoteToDelete.id);
                }
              }}
              disabled={deletingQuoteId !== null}
              className="bg-red-600 hover:bg-red-700"
            >
              {deletingQuoteId !== null ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete Quotation'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ADD TASK DIALOG */}
      <Dialog open={showAddTaskDialog} onOpenChange={setShowAddTaskDialog}>
        <DialogContent className="sm:max-w-[550px]">
          <DialogHeader>
            <DialogTitle>Add Task</DialogTitle>
            <DialogDescription>
              Schedule a task for {project.project_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="type" className="text-right">
                Type
              </Label>
              <Input
                id="type"
                value={taskData.type}
                onChange={(e) => setTaskData({ ...taskData, type: e.target.value })}
                className="col-span-3"
                disabled
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="startDate" className="text-right">
                Start Date
              </Label>
              <Input
                id="startDate"
                type="date"
                value={taskData.date}
                onChange={(e) => setTaskData({ ...taskData, date: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="endDate" className="text-right">
                End Date
              </Label>
              <Input
                id="endDate"
                type="date"
                value={taskData.endDate}
                onChange={(e) => setTaskData({ ...taskData, endDate: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input
                  id="startTime"
                  type="time"
                  value={taskData.startTime}
                  onChange={(e) => setTaskData({ ...taskData, startTime: e.target.value })}
                />
              </div>
              <div className="flex flex-col space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input
                  id="endTime"
                  type="time"
                  value={taskData.endTime}
                  onChange={(e) => setTaskData({ ...taskData, endTime: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="assignTo" className="text-right">
                Assign To
              </Label>
              <Input
                id="assignTo"
                placeholder="Type team member name..."
                value={taskData.assignTo}
                onChange={(e) => setTaskData({ ...taskData, assignTo: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="jobTask" className="text-right">
                Job/Task
              </Label>
              <Input
                id="jobTask"
                value={taskData.jobTask}
                onChange={(e) => setTaskData({ ...taskData, jobTask: e.target.value })}
                className="col-span-3"
              />
            </div>

            <div className="grid grid-cols-4 items-start gap-4">
              <Label htmlFor="notes" className="pt-2 text-right">
                Notes
              </Label>
              <Textarea
                id="notes"
                value={taskData.notes}
                onChange={(e) => setTaskData({ ...taskData, notes: e.target.value })}
                className="col-span-3"
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddTaskDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddTask}>Add Task</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DELETE DRAWING DIALOG */}
      <Dialog open={showDeleteDrawingDialog} onOpenChange={setShowDeleteDrawingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Drawing</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{drawingToDelete?.filename}</strong>? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDrawingDialog(false)} disabled={isDeletingDrawing}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeleteDrawing}
              disabled={isDeletingDrawing}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingDrawing ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ✅ NEW: DELETE FORM DIALOG */}
      <Dialog open={showDeleteFormDialog} onOpenChange={setShowDeleteFormDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Form</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{formToDelete && getFormTitle(formToDelete)}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => setShowDeleteFormDialog(false)} 
              disabled={isDeletingForm}
            >
              Cancel
            </Button>
            <Button
              onClick={handleConfirmDeleteForm}
              disabled={isDeletingForm}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {isDeletingForm ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUOTE GENERATION DIALOG */}
      <Dialog open={showQuoteGenerationDialog} onOpenChange={setShowQuoteGenerationDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl font-semibold">Generate Quotation</DialogTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowQuoteGenerationDialog(false);
                  setChecklistForQuote(null);
                }}
                className="h-8 w-8 rounded-full"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          
          <div className="py-6">
            <p className="mb-6 text-base text-gray-700">
              This project has a <span className="font-semibold text-blue-600">{checklistForQuote?.type}</span> checklist.
            </p>
            <p className="text-sm text-gray-600">
              Would you like to generate a quote from this checklist (auto-extract items) or create a blank quote manually?
            </p>
          </div>

          <DialogFooter className="flex flex-col space-y-2 sm:flex-row sm:space-x-2 sm:space-y-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowQuoteGenerationDialog(false);
                createBlankQuote();
                setChecklistForQuote(null);
              }}
              className="w-full sm:w-auto"
            >
              <X className="mr-2 h-4 w-4" />
              No - Create Blank Quote
            </Button>
            <Button
              onClick={handleGenerateFromChecklist}
              className="w-full bg-blue-600 hover:bg-blue-700 sm:w-auto"
            >
              <CheckSquare className="mr-2 h-4 w-4" />
              Yes - Generate from Checklist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}