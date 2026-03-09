"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft,
  Edit,
  Loader2,
  AlertCircle,
  Save,
  X,
  MapPin,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";

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
  { value: "Callback", label: "Callback" },
  { value: "Called", label: "Called" },
  { value: "Not Answered", label: "Not Answered" },
  { value: "Priced", label: "Priced" },
  { value: "Lost", label: "Lost" },
  { value: "Lost COT", label: "Lost COT" },
  { value: "Already Renewed", label: "Already Renewed" },
  { value: "Invalid Number", label: "Invalid Number" },
  { value: "Meter De-energised", label: "Meter De-energised" },
  { value: "Broker in Place", label: "Broker in Place" },
  { value: "End Date Changed", label: "End Date Changed" },
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
  rate_1?: number;
  
  bank_name?: string;
  bank_sort_code?: string;
  bank_account_number?: string;
  
  trading_type?: string;
  trading_number?: string;
  
  night_charge?: number;
  eve_weekend_charge?: number;
  other_charges_1?: number;
  other_charges_2?: number;
  other_charges_3?: number;
  
  meter_ref?: string;
  payment_type?: string;
  aggregator?: string;
  uplift?: number;
  term_sold?: number;
  comments?: string;
  
  position?: string;
  company_number?: string;
  date_of_birth?: string;
  
  site_name?: string;
  month_sold?: string;
  house_name?: string;
  house_number?: string;
  door_number?: string;
  town?: string;
  county?: string;
  
  old_supplier_name?: string;
  old_supplier_id?: number;
  net_notch?: number;
  rate_2?: number;
  rate_3?: number;
  comms_paid?: number;
  
  charity_ltd_company_number?: string;
  partner_details?: string;
}

interface Employee {
  employee_id: number;
  employee_name: string;
  email: string;
}

interface InteractionHistory {
  interaction_id: number;
  interaction_type: string;
  contact_date?: string;
  reminder_date?: string;
  notes?: string;
  created_at?: string;
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
  
  const [uploadedDocuments, setUploadedDocuments] = useState<string[]>([]);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);
  const [showCallbackModal, setShowCallbackModal] = useState(false);
  const [callbackStatus, setCallbackStatus] = useState("");
  const [callbackDate, setCallbackDate] = useState("");
  const [callbackNotes, setCallbackNotes] = useState("");
  const [isSold, setIsSold] = useState<string>("");
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [callbackError, setCallbackError] = useState("");
  const [history, setHistory] = useState<InteractionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    loadCustomerData();
    loadEmployees();
    loadHistory();
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
      if (data.document_details) {
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

  const loadHistory = async () => {
    setLoadingHistory(true);
    const token = localStorage.getItem("auth_token");
    
    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}/history`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setHistory(data.interactions || []);
      }
    } catch (error) {
      console.error("Error loading history:", error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const statusConfig: Record<string, { requiresDate: boolean; requiresSold: boolean; deletesRecord: boolean }> = {
    "Callback": { requiresDate: true, requiresSold: false, deletesRecord: false },
    "Called": { requiresDate: true, requiresSold: false, deletesRecord: false },
    "Not Answered": { requiresDate: true, requiresSold: false, deletesRecord: false },
    "Priced": { requiresDate: false, requiresSold: true, deletesRecord: false },
    "Lost": { requiresDate: true, requiresSold: false, deletesRecord: false },
    "Lost COT": { requiresDate: false, requiresSold: false, deletesRecord: true },
    "Already Renewed": { requiresDate: true, requiresSold: false, deletesRecord: false },
    "Invalid Number": { requiresDate: false, requiresSold: false, deletesRecord: true },
    "Meter De-energised": { requiresDate: false, requiresSold: false, deletesRecord: true },
    "Broker in Place": { requiresDate: true, requiresSold: false, deletesRecord: false },
    "End Date Changed": { requiresDate: true, requiresSold: false, deletesRecord: false },
  };

  const isDateRequired = () => {
    if (!callbackStatus) return false;
    
    const config = statusConfig[callbackStatus];
    if (!config) return false;
    
    if (config.requiresSold) {
      return isSold === "yes";
    }
    
    return config.requiresDate;
  };

  const handleOpenCallbackModal = () => {
    setCallbackStatus("");
    setCallbackDate("");
    setCallbackNotes("");
    setIsSold("");
    setCallbackError("");
    setShowCallbackModal(true);
  };

  const handleSubmitCallback = async () => {
    setCallbackError("");

    if (!callbackStatus) {
      setCallbackError("Please select a status");
      return;
    }

    const config = statusConfig[callbackStatus];

    if (config?.requiresSold && !isSold) {
      setCallbackError("Please select if the contract was sold");
      return;
    }

    if (isDateRequired() && !callbackDate) {
      setCallbackError("Please select a callback date");
      return;
    }

    setIsSubmittingCallback(true);

    try {
      const token = localStorage.getItem("auth_token");

      const payload: any = {
        status: callbackStatus,
        notes: callbackNotes,
      };

      if (isDateRequired() && callbackDate) {
        payload.callback_date = callbackDate;
      }

      if (config?.requiresSold) {
        payload.is_sold = isSold === "yes";
      }

      const response = await fetch(`${API_BASE_URL}/energy-clients/${id}/callback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save callback");
      }

      const data = await response.json();

      if (data.deleted) {
        alert("✅ Record removed from renewals list");
        router.push("/dashboard/renewals");
      } else if (data.moved_to_priced) {
        alert("✅ Moved to Priced page");
        router.push("/dashboard/priced");
      } else {
        alert("✅ Callback saved successfully");
        setShowCallbackModal(false);
        loadCustomerData();
        loadHistory();
      }
    } catch (err: any) {
      setCallbackError(err.message || "Failed to save callback");
    } finally {
      setIsSubmittingCallback(false);
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

  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingDocument(true);

    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        alert("No authentication token found. Please log in again.");
        return;
      }
      
      const formData = new FormData();
      
      Array.from(files).forEach((file) => {
        formData.append("documents", file);
      });
      
      formData.append("client_id", id);

      const response = await fetch(`${API_BASE_URL}/upload-documents`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        try {
          const errorJson = JSON.parse(errorText);
          alert(`Failed to upload: ${errorJson.error || errorJson.message || errorText}`);
        } catch {
          alert(`Failed to upload: ${errorText}`);
        }
        return;
      }

      const result = await response.json();

      if (!result.file_paths || result.file_paths.length === 0) {
        alert("Upload succeeded but no file paths were returned");
        return;
      }

      const newDocuments = result.file_paths;
      const updatedDocuments = [...uploadedDocuments, ...newDocuments];
      setUploadedDocuments(updatedDocuments);

      await updateDocumentDetails(updatedDocuments);
      
      alert(`✅ ${newDocuments.length} document(s) uploaded successfully!`);
      
    } catch (error: unknown) {
      alert(`Network error: ${error instanceof Error ? error.message : 'Could not upload documents'}`);
    } finally {
      setIsUploadingDocument(false);
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
    
    await updateDocumentDetails(updatedDocuments);
    
    alert("✅ Document removed successfully!");
  };

  const getFileNameFromPath = (path: string) => {
    return path.split("/").pop() || path;
  };

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
  const currentConfig = callbackStatus ? statusConfig[callbackStatus] : null;

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

                {/* Client Name (Person) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Client Name</label>
                  <Input
                    value={displayCustomer.contact_person || ""}
                    onChange={(e) => handleUpdateField("contact_person", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Business Name (Trading Name) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Trading Name</label>
                  <Input
                    value={displayCustomer.business_name || ""}
                    onChange={(e) => handleUpdateField("business_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Position */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Position</label>
                  <Input
                    value={displayCustomer.position || ""}
                    onChange={(e) => handleUpdateField("position", e.target.value)}
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

                {/* Company Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Company Number</label>
                  <Input
                    value={displayCustomer.company_number || ""}
                    onChange={(e) => handleUpdateField("company_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                  <Input
                    type="date"
                    value={displayCustomer.date_of_birth?.split("T")[0] || ""}
                    onChange={(e) => handleUpdateField("date_of_birth", e.target.value)}
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

                {/* Old Supplier */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Old Supplier</label>
                  <Input
                    value={displayCustomer.old_supplier_name || ""}
                    disabled
                    className="mt-1 bg-gray-50"
                  />
                </div>

                {/* Site Name */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Site Name</label>
                  <Input
                    value={displayCustomer.site_name || ""}
                    onChange={(e) => handleUpdateField("site_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Month Sold */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Month Sold</label>
                  <Input
                    value={displayCustomer.month_sold || ""}
                    onChange={(e) => handleUpdateField("month_sold", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
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

                {/* Data Source */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Data Source</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                {/* Annual Usage */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Annual Usage (kWh)</label>
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
                  <label className="text-sm font-medium text-gray-700">Contract End</label>
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
                  <label className="text-sm font-medium text-gray-700">Term Sold (Months)</label>
                  <Input
                    type="number"
                    value={displayCustomer.term_sold || ""}
                    onChange={(e) => handleUpdateField("term_sold", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Net Notch */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Net Notch</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.net_notch || ""}
                    onChange={(e) => handleUpdateField("net_notch", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Comms Paid */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Comms Paid (£)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.comms_paid || ""}
                    onChange={(e) => handleUpdateField("comms_paid", parseFloat(e.target.value))}
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

                {/* Documents Section */}
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
                  <Input
                    value={displayCustomer.house_name || ""}
                    onChange={(e) => handleUpdateField("house_name", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* House Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">House Number</label>
                  <Input
                    value={displayCustomer.house_number || ""}
                    onChange={(e) => handleUpdateField("house_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Door Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Door Number</label>
                  <Input
                    value={displayCustomer.door_number || ""}
                    onChange={(e) => handleUpdateField("door_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
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
                  <Input
                    value={displayCustomer.town || ""}
                    onChange={(e) => handleUpdateField("town", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* County */}
                <div>
                  <label className="text-sm font-medium text-gray-700">County</label>
                  <Input
                    value={displayCustomer.county || ""}
                    onChange={(e) => handleUpdateField("county", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
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
                  <label className="text-sm font-medium text-gray-700">Standing Charge (£)</label>
                  <Input
                    type="number"
                    step="0.01"
                    value={displayCustomer.standing_charge || ""}
                    onChange={(e) => handleUpdateField("standing_charge", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Rate 1 (Unit Charge) */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Rate 1 (p/kWh)</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={displayCustomer.unit_rate || ""}
                    onChange={(e) => handleUpdateField("unit_rate", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Rate 2 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Rate 2 (p/kWh)</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={displayCustomer.rate_2 || ""}
                    onChange={(e) => handleUpdateField("rate_2", parseFloat(e.target.value))}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Rate 3 */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Rate 3 (p/kWh)</label>
                  <Input
                    type="number"
                    step="0.0001"
                    value={displayCustomer.rate_3 || ""}
                    onChange={(e) => handleUpdateField("rate_3", parseFloat(e.target.value))}
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

                {/* Account Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Account Number</label>
                  <Input
                    value={displayCustomer.bank_account_number || ""}
                    onChange={(e) => handleUpdateField("bank_account_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Sort Code */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Sort Code</label>
                  <Input
                    value={displayCustomer.bank_sort_code || ""}
                    onChange={(e) => handleUpdateField("bank_sort_code", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                    placeholder="XX-XX-XX"
                  />
                </div>

                {/* Charity/Ltd Company Number */}
                <div>
                  <label className="text-sm font-medium text-gray-700">Charity/Ltd Company Number</label>
                  <Input
                    value={displayCustomer.charity_ltd_company_number || ""}
                    onChange={(e) => handleUpdateField("charity_ltd_company_number", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                  />
                </div>

                {/* Partner Details */}
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Partner Details</label>
                  <Textarea
                    value={displayCustomer.partner_details || ""}
                    onChange={(e) => handleUpdateField("partner_details", e.target.value)}
                    disabled={!isEditing}
                    className="mt-1"
                    rows={3}
                    placeholder="Enter partner details..."
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

      {/* ✅ CALLBACK MODAL */}
      <Dialog open={showCallbackModal} onOpenChange={setShowCallbackModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Callback</DialogTitle>
            <DialogDescription>
              Record customer interaction and set follow-up
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {callbackError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{callbackError}</AlertDescription>
              </Alert>
            )}

            {/* Status Selection */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Status *</label>
              <Select 
                value={callbackStatus} 
                onValueChange={(value) => {
                  setCallbackStatus(value);
                  setCallbackDate("");
                  setIsSold("");
                  setCallbackError("");
                }}
              >
                <SelectTrigger>
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

            {/* Conditional "Sold?" Question for Priced Status */}
            {currentConfig?.requiresSold && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Was it sold? *</label>
                <Select value={isSold} onValueChange={setIsSold}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes">Yes - Sold</SelectItem>
                    <SelectItem value="no">No - Move to Priced page</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Conditional Date Picker */}
            {isDateRequired() && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Callback Date *</label>
                <Input
                  type="date"
                  value={callbackDate}
                  onChange={(e) => setCallbackDate(e.target.value)}
                />
              </div>
            )}

            {/* Deletion Warning */}
            {currentConfig?.deletesRecord && (
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Warning:</strong> This will permanently remove the record from the renewals list.
                </AlertDescription>
              </Alert>
            )}

            {/* Notes */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Notes (Optional)</label>
              <Textarea
                placeholder="Add any additional notes..."
                value={callbackNotes}
                onChange={(e) => setCallbackNotes(e.target.value)}
                rows={3}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button 
              variant="outline" 
              onClick={() => setShowCallbackModal(false)} 
              disabled={isSubmittingCallback}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
              {isSubmittingCallback ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Callback"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

{/* ✅ SIMPLE ACTION PANEL (Right Side) - Direct Form, No Modal */}
      <div className="fixed right-0 top-0 h-full w-80 border-l border-gray-200 bg-gray-50 p-6 overflow-y-auto">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Action</h3>

        <div className="space-y-4">
          {/* Assign To */}
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

          {/* Status Selection */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Status: <span className="text-red-500">*</span>
            </label>
            <Select 
              value={callbackStatus} 
              onValueChange={(value) => {
                setCallbackStatus(value);
                setCallbackDate("");
                setIsSold("");
                setCallbackError("");
              }}
            >
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

          {/* Conditional "Sold?" for Priced Status */}
          {currentConfig?.requiresSold && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Was it sold? <span className="text-red-500">*</span>
              </label>
              <Select value={isSold} onValueChange={setIsSold}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes - Sold</SelectItem>
                  <SelectItem value="no">No - Move to Priced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Conditional Date Picker */}
          {isDateRequired() && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                Callback Date: <span className="text-red-500">*</span>
              </label>
              <Input
                type="date"
                className="mt-1"
                value={callbackDate}
                onChange={(e) => setCallbackDate(e.target.value)}
              />
            </div>
          )}

          {/* Deletion Warning */}
          {currentConfig?.deletesRecord && (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <strong>Warning:</strong> This will permanently delete the record.
              </AlertDescription>
            </Alert>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700">Notes:</label>
            <Textarea
              className="mt-1"
              rows={3}
              placeholder="Add notes..."
              value={callbackNotes}
              onChange={(e) => setCallbackNotes(e.target.value)}
            />
          </div>

          {/* Error Display */}
          {callbackError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{callbackError}</AlertDescription>
            </Alert>
          )}

          {/* Save Button */}
          <Button
            className="w-full bg-black hover:bg-gray-800"
            onClick={handleSubmitCallback}
            disabled={isSubmittingCallback}
          >
            {isSubmittingCallback ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Callback"
            )}
          </Button>
        </div>

        {/* ✅ History Section */}
        <div className="mt-8">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">History</h3>
          
          {loadingHistory ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-500">No interactions yet</p>
          ) : (
            <div className="space-y-3">
              {history.map((interaction) => (
                <div 
                  key={interaction.interaction_id} 
                  className="p-3 bg-white border border-gray-200 rounded-lg text-sm"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">
                      {interaction.interaction_type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatDate(interaction.created_at)}
                    </span>
                  </div>
                  
                  {interaction.notes && (
                    <p className="text-gray-600 text-xs mb-2">{interaction.notes}</p>
                  )}
                  
                  {interaction.reminder_date && (
                    <div className="flex items-center gap-1 text-xs text-purple-700">
                      <Calendar className="h-3 w-3" />
                      <span>Callback: {formatDate(interaction.reminder_date)}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}