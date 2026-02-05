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
  Building2,
  Loader2,
  AlertCircle,
  Save,
  X,
  MapPin,
  Zap,
  Calendar,
  User,
  DollarSign,
  FileText,
  CreditCard,
  MoreVertical,
  Upload,        
  File,          
  Download,      
  Trash2,        
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// Tab configuration
const TABS = [
  { id: "contact", label: "Contact Information", icon: User },
  { id: "contract", label: "Contract & Billing Details", icon: FileText },
  { id: "address", label: "Address", icon: MapPin },
  { id: "charges", label: "Charges", icon: DollarSign },
  { id: "banking", label: "Bank & Trading Account Details", icon: CreditCard },
  { id: "others", label: "Others", icon: MoreVertical },
];

// Status options
const STATUS_OPTIONS = [
  { value: "called", label: "Called" },
  { value: "not_answered", label: "Not Answered" },
  { value: "priced", label: "Priced" },
  { value: "lost", label: "Lost" },
];

interface EnergyCustomer {
  id: number;
  client_id: number;
  name: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email?: string;
  address?: string;
  post_code?: string;
  site_address?: string;
  mpan_mpr?: string;
  supplier_name?: string;
  supplier_id?: number;
  annual_usage?: number;
  start_date?: string;
  end_date?: string;
  unit_rate?: number;
  standing_charge?: number;
  status?: string;
  assigned_to_name?: string;
  assigned_to_id?: number;
  created_at?: string;
  // Banking details
  bank_name?: string;
  bank_sort_code?: string;
  bank_account_number?: string;
  // Trading details
  trading_type?: string;
  trading_number?: string;
  // Additional charges
  night_charge?: number;
  eve_weekend_charge?: number;
  other_charges_1?: number;
  other_charges_2?: number;
  other_charges_3?: number;
  // Other fields
  meter_ref?: string;
  payment_type?: string;
  aggregator?: string;
  uplift?: number;
  term_sold?: number;
  comments?: string;
}

interface Employee {
  employee_id: number;
  employee_name: string;
  email: string;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const getStatusColor = (status?: string) => {
  switch (status) {
    case "called":
    case "priced":
      return "bg-green-100 text-green-800";
    case "not_answered":
      return "bg-yellow-100 text-yellow-800";
    case "lost":
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getStatusLabel = (status?: string) => {
  const option = STATUS_OPTIONS.find((opt) => opt.value === status);
  return option ? option.label : status || "—";
};

export default function EnergyCustomerDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [customer, setCustomer] = useState<EnergyCustomer | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("contact");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedCustomer, setEditedCustomer] = useState<Partial<EnergyCustomer>>({});
  
  // Action panel state
  const [followUpDate, setFollowUpDate] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [isUpdatingAction, setIsUpdatingAction] = useState(false);
  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([]);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  useEffect(() => {
    loadCustomerData();
    loadEmployees();
  }, [id]);

  const loadCustomerData = async () => {
    setLoading(true);
    setError(null);

    const token = localStorage.getItem("auth_token");

    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load customer data");

      const data = await response.json();
      setCustomer(data);
      setEditedCustomer(data);
      if (data.document_details) {  // ✅ Correct
        try {
          const docs = JSON.parse(data.document_details);
          setUploadedDocuments(Array.isArray(docs) ? docs : []);
        } catch {
          setUploadedDocuments([]);
        }
      }
    } catch (error) {
      console.error("Error loading customer:", error);
      setError("Failed to load customer data. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEmployees(data);
      }
    } catch (error) {
      console.error("Error loading employees:", error);
    }
  };

  const handleSave = async () => {
    if (!customer) return;

    setIsSaving(true);
    const token = localStorage.getItem("auth_token");

    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(editedCustomer),
      });

      if (response.ok) {
        const data = await response.json();
        setCustomer(data.customer || data);
        setIsEditing(false);
        alert("✅ Customer updated successfully!");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        alert(`Failed to update customer: ${errorData.error}`);
      }
    } catch (error) {
      console.error("Error updating customer:", error);
      alert("Network error: Could not update customer");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedCustomer(customer || {});
    setIsEditing(false);
  };

  const handleUpdateField = (field: keyof EnergyCustomer, value: any) => {
    setEditedCustomer((prev) => ({ ...prev, [field]: value }));
  };

  const updateStatus = async (newStatus: string) => {
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: newStatus }),
      });

      if (response.ok) {
        setCustomer((prev) => (prev ? { ...prev, status: newStatus } : null));
      }
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  const updateAssignedTo = async (employeeId: number) => {
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ assigned_to_id: employeeId }),
      });

      if (response.ok) {
        const employee = employees.find((e) => e.employee_id === employeeId);
        setCustomer((prev) =>
          prev
            ? {
                ...prev,
                assigned_to_id: employeeId,
                assigned_to_name: employee?.employee_name,
              }
            : null
        );
      }
    } catch (error) {
      console.error("Error updating assignment:", error);
    }
  };

  const handleActionUpdate = async () => {
    if (!customer?.status) {
      alert("Please select a callback parameter");
      return;
    }

    if (!followUpDate) {
      alert("Please select a follow-up date");
      return;
    }

    if (!actionComment.trim()) {
      alert("Please enter a comment");
      return;
    }

    setIsUpdatingAction(true);
    const token = localStorage.getItem("auth_token");

    try {
      // In a real implementation, you would update the customer record
      // and possibly create a history/activity log entry
      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          status: customer.status,
          // Add follow_up_date and comments to your database schema if needed
          // follow_up_date: followUpDate,
          // action_comment: actionComment,
        }),
      });

      if (response.ok) {
        alert("✅ Action updated successfully!");
        // Clear the form
        setFollowUpDate("");
        setActionComment("");
        // Optionally reload customer data to get updated history
        loadCustomerData();
      } else {
        alert("Failed to update action");
      }
    } catch (error) {
      console.error("Error updating action:", error);
      alert("Network error: Could not update action");
    } finally {
      setIsUpdatingAction(false);
    }
  };

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) {
      console.log("No files selected");
      return;
    }

    console.log("=== STARTING UPLOAD ===");
    console.log("Files selected:", files.length);
    
    setIsUploadingDocument(true);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        alert("No authentication token found. Please log in again.");
        return;
      }
      console.log("Auth token found:", token.substring(0, 20) + "...");
      
      const formData = new FormData();
      
      // Append all selected files
      Array.from(files).forEach((file, index) => {
        formData.append("documents", file);
        console.log(`File ${index + 1}:`, {
          name: file.name,
          size: file.size,
          type: file.type
        });
      });
      
      formData.append("client_id", id);
      console.log("Client ID:", id);
      console.log("Upload URL:", `${API_BASE_URL}/upload-documents`);

      const response = await fetch(`${API_BASE_URL}/upload-documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Upload failed - Response:", errorText);
        
        // Try to parse as JSON for better error message
        try {
          const errorJson = JSON.parse(errorText);
          alert(`Failed to upload: ${errorJson.error || errorJson.message || errorText}`);
        } catch {
          alert(`Failed to upload: ${errorText}`);
        }
        return;
      }

      const result = await response.json();
      console.log("Upload successful - Result:", result);

      if (!result.file_paths || result.file_paths.length === 0) {
        console.error("No file paths in result:", result);
        alert("Upload succeeded but no file paths were returned");
        return;
      }

      const newDocuments = result.file_paths;
      console.log("New documents:", newDocuments);
      
      const updatedDocuments = [...uploadedDocuments, ...newDocuments];
      setUploadedDocuments(updatedDocuments);
      console.log("Updated documents list:", updatedDocuments);

      // Update the customer record with new document details
      console.log("Updating database...");
      await updateDocumentDetails(updatedDocuments);
      
      alert(`✅ ${newDocuments.length} document(s) uploaded successfully!`);
      console.log("=== UPLOAD COMPLETE ===");
      
    } catch (error: unknown) {
      console.error("=== UPLOAD ERROR ===");
      
      if (error instanceof Error) {
        console.error("Error type:", error.constructor.name);
        console.error("Error message:", error.message);
        console.error("Full error:", error);
      } else {
        console.error("Unknown error type:", typeof error);
        console.error("Error value:", error);
      }
      
      alert(`Network error: ${error instanceof Error ? error.message : 'Could not upload documents'}`);
    } finally {
      setIsUploadingDocument(false);
      // Reset file input
      if (event.target) {
        event.target.value = "";
      }
    }
  };

  const updateDocumentDetails = async (documents: string[]) => {
    if (!customer) return;
    
    const token = localStorage.getItem("auth_token");
    try {
      await fetch(`${API_BASE_URL}/energy-clients/${customer.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          document_details: JSON.stringify(documents),
        }),
      });
    } catch (error) {
      console.error("Error updating document details:", error);
    }
  };

  const handleDeleteDocument = async (docIndex: number) => {
    if (!window.confirm("Are you sure you want to delete this document?")) return;

    const updatedDocuments = uploadedDocuments.filter((_, index) => index !== docIndex);
    setUploadedDocuments(updatedDocuments);
    
    // Update the customer record
    await updateDocumentDetails(updatedDocuments);
    
    alert("✅ Document removed successfully!");
  };

  const getFileNameFromPath = (path: string) => {
    return path.split("/").pop() || path;
  };

  const canEdit = (): boolean => {
    return true; // Adjust based on your permission logic
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-600" />
          <p className="mt-4 text-gray-600">Loading customer details...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !customer) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-900">
            {error || "Customer not found"}
          </h3>
          <Button onClick={() => router.push("/dashboard/renewals")} className="mt-4">
            Back to Customers
          </Button>
        </div>
      </div>
    );
  }

  const displayCustomer = isEditing ? editedCustomer : customer;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 pr-[340px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push("/dashboard/renewals")}
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Consumer Details</h1>
              <p className="text-sm text-gray-500">ID: {customer.client_id}</p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isEditing ? (
              <>
                <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" />
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-black hover:bg-gray-800">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </>
            ) : (
              <>
                <Button onClick={() => setIsEditing(true)} variant="outline">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                {/* Commented out - not needed for renewal database
                <Button className="bg-gray-700 hover:bg-gray-800">Place to Sales Agent</Button>
                <Button className="bg-green-600 hover:bg-green-700">Move to resolved</Button>
                <Button className="bg-orange-600 hover:bg-orange-700">Send to callback</Button>
                */}
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex space-x-1 border-b border-gray-200">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "border-b-2 border-black text-black"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 pr-[340px]">
        <div className="rounded-lg bg-white p-6 shadow-sm">
          {/* Contact Information Tab */}
          {activeTab === "contact" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* ID */}
                <div>
                  <label className="text-sm font-medium text-gray-700">ID</label>
                  <Input
                    value={displayCustomer.client_id || ""}
                    disabled
                    className="mt-1 bg-gray-50"
                  />
                </div>

                {/* Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Name</label>
                  <Input
                    value={displayCustomer.contact_person || ""}
                    onChange={(e) => handleUpdateField("contact_person", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Business Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Business Name</label>
                  <Input
                    value={displayCustomer.business_name || ""}
                    onChange={(e) => handleUpdateField("business_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Contact Person */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Person</label>
                  <Input
                    value={displayCustomer.contact_person || ""}
                    onChange={(e) => handleUpdateField("contact_person", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Tel Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Tel Number <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={displayCustomer.phone || ""}
                    onChange={(e) => handleUpdateField("phone", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Tel Number 2 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Tel Number 2</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* Email */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input
                    value={displayCustomer.email || ""}
                    onChange={(e) => handleUpdateField("email", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Agent Allocated */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Agent Allocated</label>
                  {isEditing ? (
                    <Select
                      value={displayCustomer.assigned_to_id?.toString() || ""}
                      onValueChange={(value) => handleUpdateField("assigned_to_id", parseInt(value))}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {employees.map((employee) => (
                          <SelectItem
                            key={employee.employee_id}
                            value={employee.employee_id.toString()}
                          >
                            {employee.employee_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={displayCustomer.assigned_to_name || ""}
                      disabled
                      className="mt-1 bg-gray-50"
                    />
                  )}
                </div>

                {/* Agent Sold */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Agent Sold</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>
              </div>
            </div>
          )}

          {/* Contract & Billing Details Tab */}
          {activeTab === "contract" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Contract & Billing Details</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Supplier */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Supplier</label>
                  <Input
                    value={displayCustomer.supplier_name || ""}
                    disabled
                    className="mt-1 bg-gray-50"
                  />
                </div>

                {/* Data Source */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Data Source</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* MPAN/MPR */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Mpan MPR</label>
                  <Input
                    value={displayCustomer.mpan_mpr || ""}
                    onChange={(e) => handleUpdateField("mpan_mpr", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Top Line */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Top Line</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* Annual Usage */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Annual Usage</label>
                  <Input
                    type="number"
                    value={displayCustomer.annual_usage || ""}
                    onChange={(e) => handleUpdateField("annual_usage", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Payment Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Payment Type</label>
                  <Input
                    value={displayCustomer.payment_type || ""}
                    onChange={(e) => handleUpdateField("payment_type", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Start Date */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Start Date</label>
                  <Input
                    type="date"
                    value={displayCustomer.start_date?.split("T")[0] || ""}
                    onChange={(e) => handleUpdateField("start_date", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* End Date */}
                <div>
                  <label className="text-sm font-medium text-gray-700">End Date</label>
                  <Input
                    type="date"
                    value={displayCustomer.end_date?.split("T")[0] || ""}
                    onChange={(e) => handleUpdateField("end_date", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Term Sold */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Term Sold</label>
                  <Input
                    type="number"
                    value={displayCustomer.term_sold || ""}
                    onChange={(e) => handleUpdateField("term_sold", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
                <div className="md:col-span-2 border-t pt-6 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-700">Documents</label>
                    <div>
                      <input
                        type="file"
                        id="document-upload"
                        multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={handleDocumentUpload}
                        className="hidden"
                        disabled={isUploadingDocument}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => document.getElementById("document-upload")?.click()}
                        disabled={isUploadingDocument}
                      >
                        {isUploadingDocument ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Upload className="mr-2 h-4 w-4" />
                            Upload Documents
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {uploadedDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {uploadedDocuments.map((doc, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200"
                        >
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">
                              {getFileNameFromPath(doc)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => window.open(doc, "_blank")}
                              title="Download"
                            >
                              <Download className="h-4 w-4" />
                            </Button>
                            {isEditing && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteDocument(index)}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                      <File className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">No documents uploaded yet</p>
                      <p className="text-xs text-gray-400 mt-1">
                        Click "Upload Documents" to add files
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Address Tab */}
          {activeTab === "address" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Address</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* House Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700">House Name</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* Door Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Door Number</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* Street */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Street</label>
                  <Input
                    value={displayCustomer.address || ""}
                    onChange={(e) => handleUpdateField("address", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Town */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Town</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* Locality */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Locality</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* County */}
                <div>
                  <label className="text-sm font-medium text-gray-700">County</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* Post Code */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Post Code</label>
                  <Input
                    value={displayCustomer.post_code || ""}
                    onChange={(e) => handleUpdateField("post_code", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Charges Tab */}
          {activeTab === "charges" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Charges</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Standing Charge */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Standing Charge</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.standing_charge || ""}
                    onChange={(e) => handleUpdateField("standing_charge", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Unit Charge */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Unit Charge</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.unit_rate || ""}
                    onChange={(e) => handleUpdateField("unit_rate", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Night Charge */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Night Charge</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.night_charge || ""}
                    onChange={(e) => handleUpdateField("night_charge", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Eve/Weekend Charge */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Eve/Weekend Charge</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.eve_weekend_charge || ""}
                    onChange={(e) =>
                      handleUpdateField("eve_weekend_charge", parseFloat(e.target.value))
                    }
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Other Charges 1 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Other Charges 1</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.other_charges_1 || ""}
                    onChange={(e) =>
                      handleUpdateField("other_charges_1", parseFloat(e.target.value))
                    }
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Other Charges 2 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Other Charges 2</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.other_charges_2 || ""}
                    onChange={(e) =>
                      handleUpdateField("other_charges_2", parseFloat(e.target.value))
                    }
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Other Charges 3 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Other Charges 3</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.other_charges_3 || ""}
                    onChange={(e) =>
                      handleUpdateField("other_charges_3", parseFloat(e.target.value))
                    }
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Banking Tab */}
          {activeTab === "banking" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Bank & Trading Account Details
              </h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Trading Type */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Trading Type</label>
                  <Input
                    value={displayCustomer.trading_type || ""}
                    onChange={(e) => handleUpdateField("trading_type", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Trading Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Trading Number</label>
                  <Input
                    value={displayCustomer.trading_number || ""}
                    onChange={(e) => handleUpdateField("trading_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Bank Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank Name</label>
                  <Input
                    value={displayCustomer.bank_name || ""}
                    onChange={(e) => handleUpdateField("bank_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Bank Sort Code */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank Sort Code</label>
                  <Input
                    value={displayCustomer.bank_sort_code || ""}
                    onChange={(e) => handleUpdateField("bank_sort_code", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Bank Account Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Bank Account Number
                  </label>
                  <Input
                    value={displayCustomer.bank_account_number || ""}
                    onChange={(e) => handleUpdateField("bank_account_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Others Tab */}
          {activeTab === "others" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Others</h2>

              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Meter Ref */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Meter Ref</label>
                  <Input
                    value={displayCustomer.meter_ref || ""}
                    onChange={(e) => handleUpdateField("meter_ref", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Aggregator */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Aggregator</label>
                  <Input
                    value={displayCustomer.aggregator || ""}
                    onChange={(e) => handleUpdateField("aggregator", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Uplift */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Uplift</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.uplift || ""}
                    onChange={(e) => handleUpdateField("uplift", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Comments */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Comments</label>
                  <Textarea
                    value={displayCustomer.comments || ""}
                    onChange={(e) => handleUpdateField("comments", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                    rows={4}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Action Panel (Right Side) */}
      <div className="fixed right-0 top-0 h-full w-80 border-l border-gray-200 bg-gray-50 p-6 overflow-y-auto">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Action</h3>

        <div className="space-y-4">
          {/* Assign To - Accessible to all roles for now */}
          {/* {user?.role === "Admin" && ( */}
          <div>
            <label className="text-sm font-medium text-gray-700">Assign to:</label>
            <Select
              value={customer.assigned_to_id?.toString() || ""}
              onValueChange={(value) => updateAssignedTo(parseInt(value))}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((employee) => (
                  <SelectItem key={employee.employee_id} value={employee.employee_id.toString()}>
                    {employee.employee_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* )} */}

          {/* Call Back Parameter - Accessible to all roles */}
          {/* {(user?.role === "Admin" || user?.role === "Staff") && ( */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Call back parameter: <span className="text-red-500">*</span>
            </label>
            <Select value={customer.status || ""} onValueChange={updateStatus}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* )} */}

          {/* Follow up on - Accessible to all roles */}
          {/* {(user?.role === "Admin" || user?.role === "Staff") && ( */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Follow up on: <span className="text-red-500">*</span>
            </label>
            <Input
              type="date"
              className="mt-1"
              value={followUpDate}
              onChange={(e) => setFollowUpDate(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter datetime in European London (UTC+00:00) timezone.
            </p>
          </div>
          {/* )} */}

          {/* Comment - Accessible to all roles */}
          {/* {(user?.role === "Admin" || user?.role === "Staff") && ( */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Comment: <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="mt-1"
              rows={4}
              placeholder="Enter comment..."
              value={actionComment}
              onChange={(e) => setActionComment(e.target.value)}
            />
          </div>
          {/* )} */}

          {/* Update Button - Accessible to all roles */}
          {/* {(user?.role === "Admin" || user?.role === "Staff") && ( */}
          <Button
            className="w-full bg-black hover:bg-gray-800"
            onClick={handleActionUpdate}
            disabled={isUpdatingAction}
          >
            {isUpdatingAction ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Updating...
              </>
            ) : (
              "Update"
            )}
          </Button>
          {/* )} */}
        </div>

        {/* History Section */}
        <div className="mt-8">
          <h3 className="mb-2 text-lg font-semibold text-gray-900">History</h3>
          <p className="text-sm text-gray-500">Not Found</p>
        </div>
      </div>
    </div>
  );
}