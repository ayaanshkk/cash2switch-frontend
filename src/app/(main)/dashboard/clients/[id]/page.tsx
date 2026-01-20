"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Edit,
  Phone,
  Mail,
  MessageSquare,
  Calendar,
  User,
  Building2,
  Loader2,
  AlertCircle,
  Save,
  X,
  FileText,
  Eye,
  DollarSign,
  Plus,
  ChevronDown,
  Trash2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { useAuth } from "@/contexts/AuthContext";

// ---------------- Types ----------------
type PipelineType = 'sales' | 'training';
type SalesStage = "Enquiry" | "Proposal" | "Converted";
type TrainingStage = "Training Scheduled" | "Training Conducted" | "Training Completed" | "PTI Created" | "Certificates Created" | "Certificates Dispatched";
type CustomerType = 'Individual' | 'Commercial';
type MHEType = 'Forklift' | 'Reach Truck' | 'Stacker' | 'BOPT' | 'Other';

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  contact_made?: "Yes" | "No" | "Unknown";
  pipeline_type: PipelineType;
  sales_stage?: SalesStage;
  training_stage?: TrainingStage;
  status: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
  salesperson?: string;
  preferred_contact_method?: "Phone" | "Email" | "WhatsApp";
}

interface Quotation {
  id: number;
  reference_number: string;
  total: number;
  status: string;
  notes: string;
  created_at: string;
  items_count?: number;
  customer_id?: string;
}

interface Invoice {
  id: number;
  invoice_number: string;
  total: number;
  status: string;
  created_at: string;
  customer_id: string;
}

interface FinancialDocument {
  id: string | number;
  type: "quotation" | "invoice";
  title: string;
  reference?: string;
  total?: number;
  created_at: string;
  status?: string;
  customer_id?: string;
}

// ---------------- Utility functions ----------------
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

const getSalesStageColor = (stage: SalesStage): string => {
  switch (stage) {
    case "Enquiry":
      return "bg-gray-100 text-gray-800";
    case "Proposal":
      return "bg-blue-100 text-blue-800";
    case "Converted":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getTrainingStageColor = (stage: TrainingStage): string => {
  switch (stage) {
    case "Training Scheduled":
      return "bg-yellow-100 text-yellow-800";
    case "Training Conducted":
      return "bg-orange-100 text-orange-800";
    case "Training Completed":
      return "bg-green-100 text-green-800";
    case "PTI Created":
      return "bg-purple-100 text-purple-800";
    case "Certificates Created":
      return "bg-blue-100 text-blue-800";
    case "Certificates Dispatched":
      return "bg-indigo-100 text-indigo-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// Extract customer type from notes
const getCustomerType = (notes: string | undefined): CustomerType | null => {
  if (!notes) return null;
  if (notes.includes("Customer Type: Individual")) return "Individual";
  if (notes.includes("Customer Type: Commercial")) return "Commercial";
  return null;
};

// Extract MHE type from notes
const getMHEType = (notes: string | undefined): MHEType | null => {
  if (!notes) return null;
  if (notes.includes("MHE Type: Forklift")) return "Forklift";
  if (notes.includes("MHE Type: Reach Truck")) return "Reach Truck";
  if (notes.includes("MHE Type: Stacker")) return "Stacker";
  if (notes.includes("MHE Type: BOPT")) return "BOPT";
  if (notes.includes("MHE Type: Other")) return "Other";
  return null;
};

// Clean notes by removing metadata and stage change logs
const getCleanNotes = (notes: string | undefined): string => {
  if (!notes) return "";
  
  return notes
    .split("\n")
    .filter((line) => {
      // Remove customer type lines
      if (line.includes("Customer Type:")) return false;
      // Remove MHE type lines
      if (line.includes("MHE Type:")) return false;
      // Remove stage change logs
      if (line.includes("Stage changed:")) return false;
      // Remove pipeline change logs
      if (line.includes("pipeline)")) return false;
      return true;
    })
    .join("\n")
    .trim();
};

export default function CustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [financialDocuments, setFinancialDocuments] = useState<FinancialDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState("");
  const [isSavingNotes, setIsSavingNotes] = useState(false);
  const [deletingQuoteId, setDeletingQuoteId] = useState<number | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [quoteToDelete, setQuoteToDelete] = useState<{ id: number; reference: string } | null>(null);

  useEffect(() => {
    if (!id) return;
    loadCustomerData();
  }, [id]);

  const loadCustomerData = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem("auth_token");
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    try {
      const customerRes = await fetch(`http://localhost:5000/clients/${id}`, { headers });

      if (!customerRes.ok) {
        throw new Error("Failed to load client data");
      }

      const customerData = await customerRes.json();
      setCustomer(customerData);

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

      // ✅ Fetch quotations and invoices in parallel
      const [quotationsData, invoicesData] = await Promise.all([
        fetchWithFallback(`http://localhost:5000/proposals?customer_id=${id}`),
        fetchWithFallback(`http://localhost:5000/invoices?customer_id=${id}`)
      ]);

      // ✅ Process and combine all financial documents
      const allFinancialDocs: FinancialDocument[] = [];

      // Quotations
      if (quotationsData && Array.isArray(quotationsData)) {
        quotationsData.forEach((quote: Quotation) => {
          allFinancialDocs.push({
            id: quote.id,
            type: 'quotation',
            title: `Quotation ${quote.reference_number}`,
            reference: quote.reference_number,
            total: quote.total,
            status: quote.status,
            created_at: quote.created_at,
          });
        });
      }

      // Invoices
      if (invoicesData && Array.isArray(invoicesData)) {
        invoicesData.forEach((invoice: Invoice) => {
          allFinancialDocs.push({
            id: invoice.id,
            type: 'invoice',
            title: invoice.invoice_number || `Invoice #${invoice.id}`,
            reference: invoice.invoice_number,
            total: invoice.total,
            status: invoice.status,
            created_at: invoice.created_at,
          });
        });
      }

      // Sort by created date (newest first)
      allFinancialDocs.sort((a, b) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setFinancialDocuments(allFinancialDocs);

    } catch (error) {
      console.error("Error loading client data:", error);
      setError("Failed to load client data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNotes = async () => {
    if (!customer) return;
    
    setIsSavingNotes(true);
    const token = localStorage.getItem("auth_token");

    try {
      // Preserve customer type and MHE type metadata
      const customerType = getCustomerType(customer.notes);
      const mheType = getMHEType(customer.notes);
      
      let finalNotes = editedNotes.trim();
      
      // Re-add metadata to notes
      if (customerType) {
        finalNotes = `Customer Type: ${customerType}\n${finalNotes}`;
      }
      if (mheType) {
        finalNotes = `MHE Type: ${mheType}\n${finalNotes}`;
      }

      const response = await fetch(`http://localhost:5000/clients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notes: finalNotes }),
      });

      if (response.ok) {
        const updatedCustomer = await response.json();
        setCustomer(updatedCustomer.customer || updatedCustomer);
        setIsEditingNotes(false);
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to update notes: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error updating notes:", error);
      alert("Network error: Could not update notes");
    } finally {
      setIsSavingNotes(false);
    }
  };

  const handleCreateQuote = () => {
    if (!canEdit()) {
      alert("You don't have permission to create quotations.");
      return;
    }
    const queryParams = new URLSearchParams({
      customerId: String(id),
      customerName: customer?.name || "",
      customerAddress: customer?.address || "",
      customerPhone: customer?.phone || "",
      customerEmail: customer?.email || "",
      type: "quotation",
      source: "customer",
    });
    router.push(`/dashboard/quotes/create?${queryParams.toString()}`);
  };

  const handleCreateInvoice = () => {
    if (!canEdit()) {
      alert("You don't have permission to create invoices.");
      return;
    }
    const queryParams = new URLSearchParams({
      customerId: String(id),
      customerName: customer?.name || "",
      customerAddress: customer?.address || "",
      customerPhone: customer?.phone || "",
      customerEmail: customer?.email || "",
    });
    router.push(`/dashboard/invoices/create?${queryParams.toString()}`);
  };

  const handleViewFinancialDocument = (doc: FinancialDocument) => {
    switch (doc.type) {
      case 'quotation':
        window.open(`/dashboard/quotes/${doc.id}`, '_blank');
        break;
      case 'invoice':
        window.open(`/dashboard/invoices/${doc.id}`, '_blank');
        break;
      default:
        alert('Document viewer not available');
    }
  };

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
      
      await loadCustomerData(); 
      
      alert('✅ Quotation deleted successfully!');
    } catch (error) {
      console.error('❌ Error deleting quotation:', error);
      alert('❌ Failed to delete quotation. Please try again.');
    } finally {
      setDeletingQuoteId(null);
      setDeleteDialogOpen(false);
      setQuoteToDelete(null);
    }
  };

  const getFinancialDocIcon = (type: string) => {
    switch (type) {
      case 'quotation':
        return <FileText className="h-5 w-5 text-blue-600" />;
      case 'invoice':
        return <FileText className="h-5 w-5 text-indigo-600" />;
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
      default:
        return 'from-gray-50 to-gray-100';
    }
  };

  const canEdit = (): boolean => {
    if (!customer) return false;
    const allowedRoles = ["Manager", "HR", "Production", "Sales", "Admin"];
    return allowedRoles.includes(user?.role || "");
  };

  const handleEdit = () => {
    if (!canEdit()) {
      alert("You don't have permission to edit this client.");
      return;
    }
    router.push(`/dashboard/clients/${id}/edit`);
  };

  const getContactMethodIcon = (method: string) => {
    switch (method) {
      case "Phone":
        return <Phone className="h-4 w-4" />;
      case "Email":
        return <Mail className="h-4 w-4" />;
      case "WhatsApp":
        return <MessageSquare className="h-4 w-4" />;
      default:
        return null;
    }
  };

  // Error state
  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex h-64 items-center justify-center">
          <div className="text-center">
            <AlertCircle className="mx-auto mb-4 h-12 w-12 text-red-500" />
            <h3 className="mb-2 text-lg font-medium text-red-900">Error Loading Data</h3>
            <p className="mb-4 text-red-600">{error}</p>
            <Button onClick={() => window.location.reload()}>Try Again</Button>
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="container mx-auto space-y-8 p-6">
        <div className="flex items-center justify-between">
          <div className="h-10 w-64 bg-gray-200 rounded animate-pulse" />
          <div className="h-10 w-24 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="rounded-lg border bg-white p-6 shadow-sm">
          <div className="h-6 w-48 bg-gray-200 rounded animate-pulse mb-6" />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 bg-gray-200 rounded animate-pulse" />
                <div className="h-6 w-full bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!customer) return <div className="p-8">Customer not found.</div>;

  const customerType = getCustomerType(customer.notes);
  const mheType = getMHEType(customer.notes);
  const cleanNotes = getCleanNotes(customer.notes);
  const currentStage = customer.pipeline_type === 'sales' ? customer.sales_stage : customer.training_stage;

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div
              onClick={() => router.push("/dashboard/clients")}
              className="flex cursor-pointer items-center text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
            </div>
            <h1 className="text-3xl font-semibold text-gray-900">Client Details</h1>
          </div>
          
          <div className="flex items-center space-x-3">
            {canEdit() && (
              <>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex items-center space-x-2">
                      <Plus className="h-4 w-4" />
                      <span>Create</span>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onClick={handleCreateQuote} className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Quotation</span>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleCreateInvoice} className="flex items-center space-x-2">
                      <FileText className="h-4 w-4" />
                      <span>Invoice</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={handleEdit} className="flex items-center space-x-2">
                  <Edit className="h-4 w-4" />
                  <span>Edit Client</span>
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="px-8 py-6">
        {/* Contact Information Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Contact Information</h2>
          
          <div className="space-y-8">
            {/* Row 1: Name, Phone, Email */}
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Name</span>
                <span className="mt-1 text-base font-medium text-gray-900">{customer.name || "—"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">
                  Phone <span className="text-red-500">*</span>
                </span>
                <span className="mt-1 text-base text-gray-900">{customer.phone || "—"}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Email</span>
                <span className="mt-1 text-base text-gray-900">{customer.email || "—"}</span>
              </div>
            </div>

            {/* Row 2: Address, Customer Type, MHE Type */}
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">
                  Address <span className="text-red-500">*</span>
                </span>
                <span className="mt-1 text-base text-gray-900">{customer.address || "—"}</span>
              </div>
              
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Customer Type</span>
                <div className="mt-1">
                  {customerType === 'Individual' ? (
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-blue-600" />
                      <span className="text-base font-medium text-blue-600">Individual</span>
                    </div>
                  ) : customerType === 'Commercial' ? (
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-purple-600" />
                      <span className="text-base font-medium text-purple-600">Commercial</span>
                    </div>
                  ) : (
                    <span className="text-base text-gray-400">—</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">MHE Type</span>
                <div className="mt-1">
                  {mheType ? (
                    <span className="inline-flex rounded-full px-3 py-1 text-sm font-semibold bg-green-100 text-green-800">
                      {mheType}
                    </span>
                  ) : (
                    <span className="text-base text-gray-400">—</span>
                  )}
                </div>
              </div>
            </div>

            {/* Row 3: Preferred Contact, Pipeline Stage, Customer Since */}
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-3">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Preferred Contact</span>
                <div className="mt-1">
                  {customer.preferred_contact_method ? (
                    <div className="flex items-center space-x-2">
                      {getContactMethodIcon(customer.preferred_contact_method)}
                      <span className="text-base text-gray-900">{customer.preferred_contact_method}</span>
                    </div>
                  ) : (
                    <span className="text-base text-gray-900">—</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Pipeline Stage</span>
                <div className="mt-1">
                  {currentStage ? (
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${
                        customer.pipeline_type === 'sales'
                          ? getSalesStageColor(currentStage as SalesStage)
                          : getTrainingStageColor(currentStage as TrainingStage)
                      }`}
                    >
                      {currentStage}
                    </span>
                  ) : (
                    <span className="text-base text-gray-900">—</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col">
                <span className="text-sm font-medium text-gray-500">Customer Since</span>
                <div className="mt-1 flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="text-base text-gray-900">{formatDate(customer.created_at)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Notes Section */}
        <div className="mb-8 border-t border-gray-200 pt-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Notes</h2>
            {canEdit() && !isEditingNotes && (
              <Button
                onClick={() => {
                  setEditedNotes(cleanNotes);
                  setIsEditingNotes(true);
                }}
                variant="outline"
                className="flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Edit Notes</span>
              </Button>
            )}
          </div>

          {isEditingNotes ? (
            <div className="space-y-4">
              <Textarea
                value={editedNotes}
                onChange={(e) => setEditedNotes(e.target.value)}
                className="min-h-[200px] w-full rounded-lg border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                placeholder="Add notes about this client..."
              />
              <div className="flex items-center space-x-2">
                <Button
                  onClick={handleSaveNotes}
                  disabled={isSavingNotes}
                  className="flex items-center space-x-2"
                >
                  {isSavingNotes ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4" />
                      <span>Save Notes</span>
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setIsEditingNotes(false);
                    setEditedNotes("");
                  }}
                  variant="outline"
                  disabled={isSavingNotes}
                >
                  <X className="h-4 w-4 mr-2" />
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div>
              {cleanNotes ? (
                <div className="rounded-lg bg-gray-50 p-4">
                  <pre className="whitespace-pre-wrap text-base text-gray-900 font-sans">
                    {cleanNotes}
                  </pre>
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 p-8 text-center">
                  <p className="text-gray-500">No notes added yet.</p>
                  {canEdit() && (
                    <Button
                      onClick={() => {
                        setEditedNotes("");
                        setIsEditingNotes(true);
                      }}
                      variant="outline"
                      className="mt-4"
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Add Notes
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Financial Documents Section */}
        <div className="mb-8 border-t border-gray-200 pt-8">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              Financial Documents ({financialDocuments.length})
            </h2>
            {financialDocuments.length > 0 && (
              <div className="text-sm text-gray-600">
                {financialDocuments.filter(d => d.type === 'quotation').length} Quotation{financialDocuments.filter(d => d.type === 'quotation').length !== 1 ? 's' : ''} • {' '}
                {financialDocuments.filter(d => d.type === 'invoice').length} Invoice{financialDocuments.filter(d => d.type === 'invoice').length !== 1 ? 's' : ''}
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
                          <p className="text-xs text-gray-600 capitalize">{doc.type}</p>
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
                            <span className="font-semibold text-gray-900">₹{doc.total.toFixed(2)}</span>
                          </p>
                        )}

                        <p className="text-xs text-gray-600">
                          <Calendar className="mr-1 inline h-3 w-3" />
                          {formatDate(doc.created_at)}
                        </p>
                      </div>
                    </div>
                  </div>

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
                    
                    {/* Delete Button - ONLY for quotations */}
                    {doc.type === 'quotation' && canEdit() && (
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
                Create quotations or invoices to track this customer's financial activity.
              </p>
              {canEdit() && (
                <div className="flex flex-wrap justify-center gap-4">
                  <Button onClick={handleCreateQuote} className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>Create Quotation</span>
                  </Button>
                  <Button onClick={handleCreateInvoice} variant="outline" className="flex items-center space-x-2">
                    <FileText className="h-4 w-4" />
                    <span>Create Invoice</span>
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Quotation Confirmation Dialog */}
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
    </div>
  );
}