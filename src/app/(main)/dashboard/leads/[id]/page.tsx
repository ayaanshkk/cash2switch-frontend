"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
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
import { fetchWithAuth } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const TABS = [
  { id: "contact",  label: "Contact Information",           icon: User },
  { id: "contract", label: "Contract & Billing Details",    icon: FileText },
  { id: "address",  label: "Address",                       icon: MapPin },
  { id: "charges",  label: "Charges",                       icon: DollarSign },
  { id: "banking",  label: "Bank & Trading Account Details",icon: CreditCard },
  { id: "others",   label: "Others",                        icon: MoreVertical },
];

const STATUS_OPTIONS = [
  { value: "Callback",           label: "Callback" },
  { value: "Not Answered",       label: "Not Answered" },
  { value: "Priced",             label: "Priced" },
  { value: "Converted",          label: "Converted" },
  { value: "Lost",               label: "Lost" },
  { value: "Lost COT",           label: "Lost COT" },
  { value: "Already Renewed",    label: "Already Renewed" },
  { value: "Renewed Directly",   label: "Renewed Directly" },
  { value: "Invalid Number",     label: "Invalid Number" },
  { value: "Meter De-energised", label: "Meter De-energised" },
  { value: "Broker in Place",    label: "Broker in Place" },
  { value: "End Date Changed",   label: "End Date Changed" },
  { value: "Complaint",          label: "Complaint" },
  { value: "Email Only",         label: "Email Only" },
  { value: "Incorrect Supplier", label: "Incorrect Supplier" },
];

const STATUS_TO_STAGE_FALLBACK: Record<string, number> = {
  "callback": 1, "not answered": 3, "priced": 4, "lost": 5, "lost cot": 6,
  "already renewed": 7, "invalid number": 8, "meter de-energised": 9,
  "broker in place": 10, "end date changed": 11, "complaint": 12,
  "email only": 13, "renewed directly": 14, "incorrect supplier": 15, "converted": 16,
};

const getStatusColor = (status: string | undefined): string => {
  if (!status) return "bg-gray-100 text-gray-800";
  const l = status.toLowerCase();
  if (["called", "priced", "callback", "converted"].includes(l)) return "bg-green-100 text-green-800";
  if (l === "not answered") return "bg-yellow-100 text-yellow-800";
  if (["lost", "lost cot"].includes(l)) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
};

const getStatusLabel = (status: string | undefined): string => {
  if (!status) return "—";
  return (
    STATUS_OPTIONS.find(o => o.value === status)?.label ||
    STATUS_OPTIONS.find(o => o.value.toLowerCase() === status.toLowerCase())?.label ||
    status
  );
};

// ── Lead shape mirrors Opportunity_Details ─────────────────────────────────
interface Lead {
  opportunity_id: number;
  tenant_lead_id?: number;
  // contact
  business_name?: string | null;
  contact_person?: string | null;
  tel_number?: string | null;
  mobile_no?: string | null;
  email?: string | null;
  position?: string | null;
  company_number?: string | null;
  date_of_birth?: string | null;
  // assignment
  opportunity_owner_employee_id?: number | null;
  assigned_to_name?: string | null;
  // contract
  mpan_mpr?: string | null;
  mpan_bottom?: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  annual_usage?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  payment_type?: string | null;
  term_sold?: number | null;
  net_notch?: number | null;
  comms_paid?: number | null;
  aggregator?: string | null;
  site_name?: string | null;
  month_sold?: string | null;
  // address  (Opportunity_Details uses postcode not post_code)
  house_name?: string | null;
  house_number?: string | null;
  door_number?: string | null;
  address?: string | null;
  town?: string | null;
  county?: string | null;
  postcode?: string | null;
  // charges  (stand_charge not standing_charge)
  stand_charge?: number | null;
  rate_1?: number | null;
  rate_2?: number | null;
  rate_3?: number | null;
  night_charge?: number | null;
  eve_weekend_charge?: number | null;
  other_charges_1?: number | null;
  other_charges_2?: number | null;
  other_charges_3?: number | null;
  // banking
  bank_name?: string | null;
  bank_account_number?: string | null;
  bank_sort_code?: string | null;
  charity_ltd_company_number?: string | null;
  partner_details?: string | null;
  // others
  meter_ref?: string | null;
  uplift?: number | null;
  comments?: string | null;
  // meta
  stage_id?: number | null;
  stage_name?: string | null;
  created_at?: string | null;
  document_details?: string | null;
  service_id?: number | null;
}

interface Employee  { employee_id: number; employee_name: string; email?: string; }
interface Stage     { stage_id: number; stage_name: string; }
interface Supplier  { supplier_id: number; supplier_name: string; }

interface InteractionHistory {
  interaction_id: number;
  interaction_type: string;
  contact_date?: string;
  reminder_date?: string;
  notes?: string;
  created_at?: string;
}

const formatDate = (d?: string | null) => {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }); }
  catch { return "—"; }
};

const statusConfig: Record<string, {
  requiresDate: boolean; requiresSold: boolean; deletesRecord: boolean;
  requiresNotes: boolean; requiresNewEndDate: boolean;
  requiresSupplierChange: boolean; requiresAddressChange: boolean;
}> = {
  "Callback":          { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Not Answered":      { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Priced":            { requiresDate: false, requiresSold: true,  deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Converted":         { requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost":              { requiresDate: true,  requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Lost COT":          { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Already Renewed":   { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: true,  requiresAddressChange: true  },
  "Invalid Number":    { requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Meter De-energised":{ requiresDate: false, requiresSold: false, deletesRecord: true,  requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Broker in Place":   { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "End Date Changed":  { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: true,  requiresSupplierChange: false, requiresAddressChange: false },
  "Complaint":         { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Email Only":        { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: false, requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Renewed Directly":  { requiresDate: true,  requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
  "Incorrect Supplier":{ requiresDate: false, requiresSold: false, deletesRecord: false, requiresNotes: true,  requiresNewEndDate: false, requiresSupplierChange: false, requiresAddressChange: false },
};

// ─────────────────────────────────────────────────────────────────────────────
export default function LeadDetailsPage() {
  const params       = useParams();
  const router       = useRouter();
  const { user }     = useAuth();
  const normalizedRole = typeof user?.role === "string" ? user.role.trim().toLowerCase() : "";
  const isAdmin      = normalizedRole.includes("admin");
  const id           = params?.id as string;
  const searchParams = useSearchParams();
  const fromPage     = searchParams?.get("from") || "leads";

  const [lead, setLead]               = useState<Lead | null>(null);
  const [employees, setEmployees]     = useState<Employee[]>([]);
  const [stages, setStages]           = useState<Stage[]>([]);
  const [suppliers, setSuppliers]     = useState<Supplier[]>([]);
  const [loading, setLoading]         = useState(true);
  const [error, setError]             = useState<string | null>(null);
  const [activeTab, setActiveTab]     = useState("contact");
  const [isEditing, setIsEditing]     = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  const [editedLead, setEditedLead]   = useState<Partial<Lead>>({});

  const [uploadedDocuments, setUploadedDocuments]     = useState<string[]>([]);
  const [isUploadingDocument, setIsUploadingDocument] = useState(false);

  // action panel
  const [callbackStatus, setCallbackStatus]             = useState("");
  const [callbackDate, setCallbackDate]                 = useState("");
  const [callbackNotes, setCallbackNotes]               = useState("");
  const [isSold, setIsSold]                             = useState<string>("");
  const [newEndDate, setNewEndDate]                     = useState("");
  const [newSupplier, setNewSupplier]                   = useState("");
  const [newAddress, setNewAddress]                     = useState("");
  const [calledDate, setCalledDate]                     = useState(() => new Date().toISOString().split("T")[0]);
  const [renewedBy, setRenewedBy]                       = useState<"customer" | "agent" | "">("");
  const [isSubmittingCallback, setIsSubmittingCallback] = useState(false);
  const [callbackError, setCallbackError]               = useState("");

  // history
  const [history, setHistory]               = useState<InteractionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // assign modal
  const [showAssignmentModal, setShowAssignmentModal] = useState(false);
  const [assigningEmployeeId, setAssigningEmployeeId] = useState<string>("");
  const [assignmentNotes, setAssignmentNotes]         = useState("");
  const [isAssigningEmployee, setIsAssigningEmployee] = useState(false);

  // ── data loading ────────────────────────────────────────────────────────
  useEffect(() => {
    loadLead();
    loadEmployees();
    loadStages();
    loadSuppliers();
    loadHistory();
  }, [id]);

  const loadLead = async () => {
    setLoading(true); setError(null);
    try {
      const raw = await fetchWithAuth(`/api/crm/leads/${id}`);
      console.log("📥 Lead API raw response:", raw);

      if (!raw) throw new Error("No response from server");
      if (raw.error) throw new Error(raw.error);

      // Unwrap all possible response shapes:
      //   { lead: {...} }  |  { data: {...} }  |  { opportunity: {...} }  |  plain object
      const data: Lead =
        raw.lead        ? raw.lead        :
        raw.opportunity ? raw.opportunity :
        raw.data        ? raw.data        :
        raw;

      // Normalise: some endpoints return opportunity_owner_employee_id under different keys
      if (!data.assigned_to_name && raw.assigned_to_name) data.assigned_to_name = raw.assigned_to_name;

      // Map any alternative column names the backend might return
      const normalised: Lead = {
        ...data,
        // opportunity_id might come back as "id" from some projections
        opportunity_id: data.opportunity_id ?? (raw as any).id,
        // stage comes as stage_name or status
        stage_name: data.stage_name ?? (raw as any).status ?? (raw as any).stage,
        // contact fields that may differ between endpoints
        tel_number:     data.tel_number     ?? (raw as any).phone ?? (raw as any).telephone,
        business_name:  data.business_name  ?? (raw as any).opportunity_title ?? (raw as any).client_company_name,
        contact_person: data.contact_person ?? (raw as any).client_contact_name,
        email:          data.email          ?? (raw as any).client_email,
        postcode:       data.postcode       ?? (raw as any).post_code ?? (raw as any).postcode,
        stand_charge:   data.stand_charge   ?? (raw as any).standing_charge,
      };

      console.log("📋 Normalised lead:", normalised);

      setLead(normalised);
      setEditedLead(normalised);

      if (normalised.stage_name) setCallbackStatus(normalised.stage_name);

      if (normalised.document_details) {
        try {
          const docs = JSON.parse(normalised.document_details);
          setUploadedDocuments(Array.isArray(docs) ? docs : []);
        } catch { setUploadedDocuments([]); }
      }
    } catch (e: any) {
      console.error("❌ loadLead error:", e);
      setError(e.message || "Failed to load lead");
    } finally {
      setLoading(false);
    }
  };

  const loadEmployees = async () => {
    try {
      const data = await fetchWithAuth("/employees");
      setEmployees(Array.isArray(data) ? data : (data?.data || []));
    } catch { /* silent */ }
  };

  const loadStages = async () => {
    try {
      const data = await fetchWithAuth("/stages");
      setStages(Array.isArray(data) ? data : (data?.data || []));
    } catch { /* silent */ }
  };

  const loadSuppliers = async () => {
    try {
      const data = await fetchWithAuth("/suppliers");
      setSuppliers(Array.isArray(data) ? data : (data?.data || []));
    } catch { /* silent */ }
  };

  const loadHistory = async () => {
    setLoadingHistory(true);
    try {
      const data = await fetchWithAuth(`/api/crm/leads/${id}/history`);
      setHistory(data?.interactions || []);
    } catch { /* silent */ }
    finally { setLoadingHistory(false); }
  };

  // ── helpers ──────────────────────────────────────────────────────────────
  const getStageIdFromStatus = (status: string): number => {
    if (stages.length) {
      const m = stages.find(s => s.stage_name.toLowerCase() === status.toLowerCase());
      if (m) return m.stage_id;
    }
    return STATUS_TO_STAGE_FALLBACK[status.toLowerCase()] || 0;
  };

  const isDateRequired = () => {
    if (!callbackStatus) return false;
    const cfg = statusConfig[callbackStatus];
    if (!cfg) return false;
    if (cfg.requiresSold) return isSold === "yes";
    return cfg.requiresDate;
  };

  const currentConfig = callbackStatus ? statusConfig[callbackStatus] : null;

  // ── edit / save ──────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!lead) return;
    setIsSaving(true);
    try {
      // Strip computed/non-DB fields — these don't exist as columns in Opportunity_Details
      const COMPUTED_FIELDS = new Set([
        'status', 'stage_name', 'supplier_name', 'assigned_to_name',
        'opportunity_title', 'tenant_lead_id', 'display_id', 'display_order',
        'created_at', 'service_id', 'tenant_id',
      ]);

      const safePayload = Object.fromEntries(
        Object.entries(editedLead).filter(([k]) => !COMPUTED_FIELDS.has(k))
      );

      const data = await fetchWithAuth(`/api/crm/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(safePayload),
      });
      if (data?.error) throw new Error(data.error);
      setLead(data?.lead || data);
      setIsEditing(false);
      alert("✅ Lead updated successfully!");
    } catch (e: any) {
      alert(`Failed to update lead: ${e.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => { setEditedLead(lead || {}); setIsEditing(false); };

  const handleUpdateField = (field: keyof Lead, value: any) =>
    setEditedLead(prev => ({ ...prev, [field]: value }));

  // ── callback / action ────────────────────────────────────────────────────
  const handleSubmitCallback = async () => {
    setCallbackError("");
    if (!callbackStatus) { setCallbackError("Please select a status"); return; }
    const cfg = statusConfig[callbackStatus];
    if (cfg?.requiresSold && !isSold) { setCallbackError("Please select if the contract was sold"); return; }
    if (cfg?.requiresNotes && !callbackNotes.trim()) { setCallbackError("Please enter the reason for this status"); return; }
    if (callbackStatus === "Already Renewed" && !renewedBy) { setCallbackError("Please select if renewed by customer or agent"); return; }
    if (callbackStatus === "End Date Changed" && !newEndDate) { setCallbackError("Please enter the new contract end date"); return; }

    setIsSubmittingCallback(true);
    try {
      const stageId = getStageIdFromStatus(callbackStatus);
      const payload: any = { stage_id: stageId, status: callbackStatus, notes: callbackNotes };
      if (calledDate) payload.called_date = calledDate;
      if (isDateRequired() && callbackDate) payload.callback_date = callbackDate;
      if (cfg?.requiresSold) payload.is_sold = isSold === "yes";
      if (cfg?.requiresNewEndDate && newEndDate) payload.new_end_date = newEndDate;
      if (callbackStatus === "Already Renewed" && renewedBy) payload.renewed_by = renewedBy;
      if (cfg?.requiresSupplierChange && newSupplier.trim()) payload.new_supplier = newSupplier.trim();
      if (cfg?.requiresAddressChange && newAddress.trim()) payload.new_address = newAddress.trim();

      const data = await fetchWithAuth(`/api/crm/leads/${id}/callback`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!data || data.error) throw new Error(data?.error || "Failed to save");

      // ✅ CRITICAL FIX: Update local state with returned lead data
      if (data.lead) {
        setLead(prev => prev ? { ...prev, ...data.lead } : data.lead);
        setEditedLead(prev => ({ ...prev, ...data.lead }));
        
        // ✅ Update the status in the action panel
        if (data.lead.stage_name) {
          setCallbackStatus(data.lead.stage_name);
        }
      }

      if (data.moved_to_cleansing) {
        alert("🧹 Moved to Cleansing");
        router.push("/dashboard/cleansing");
      } else if (data.moved_to_recycle_bin || data.deleted) {
        alert("✅ Record removed from leads list");
        router.push("/dashboard/leads");
      } else if (data.moved_to_priced) {
        alert("✅ Moved to Priced page");
        router.push("/dashboard/priced");
      } else {
        if (callbackStatus === "Already Renewed") alert("✅ Lead information updated");
        else if (callbackStatus === "End Date Changed") alert(`✅ Contract end date updated to ${formatDate(newEndDate)}`);
        else if (callbackStatus === "Converted") alert("✅ Lead marked as Converted");
        else alert("✅ Action saved successfully");

        // Reset action panel fields (keep status so it reflects current state)
        setCallbackDate(""); setCallbackNotes(""); setIsSold("");
        setNewEndDate(""); setNewSupplier(""); setNewAddress("");
        setCalledDate(new Date().toISOString().split("T")[0]);
        setRenewedBy("");
        loadHistory();
      }
    } catch (err: any) {
      setCallbackError(err.message || "Failed to save action");
    } finally {
      setIsSubmittingCallback(false);
    }
  };

  const handleClearStatus = async () => {
    if (!window.confirm("Are you sure you want to clear the status?")) return;
    try {
      await fetchWithAuth(`/api/crm/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage_id: 1 }), // 1 = "Lead" — never send null
      });
      // Update local lead state so UI shows "Lead" immediately
      setLead(prev => prev ? { ...prev, stage_id: 1, stage_name: "Lead" } : null);
      setEditedLead(prev => ({ ...prev, stage_id: 1, stage_name: "Lead" }));
      setCallbackStatus(""); // clear the action panel selection
      alert("✅ Status cleared successfully");
    } catch { alert("❌ Failed to clear status"); }
  };

  // ── assign ───────────────────────────────────────────────────────────────
  const handleAssignEmployee = async () => {
    if (!assigningEmployeeId) return;
    setIsAssigningEmployee(true);
    try {
      const empId = assigningEmployeeId === "0" ? null : parseInt(assigningEmployeeId);
      const payload: any = { lead_ids: [parseInt(id)], employee_id: empId };
      if (assignmentNotes.trim()) payload.assignment_notes = assignmentNotes.trim();

      await fetchWithAuth("/api/crm/leads/assign", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const emp = employees.find(e => e.employee_id === empId);
      setLead(prev => prev ? {
        ...prev,
        opportunity_owner_employee_id: empId,
        assigned_to_name: empId ? emp?.employee_name : undefined,
      } : null);

      alert("✅ Salesperson assigned successfully");
      setShowAssignmentModal(false);
      setAssigningEmployeeId(""); setAssignmentNotes("");
      loadHistory();
    } catch { alert("Failed to assign salesperson"); }
    finally { setIsAssigningEmployee(false); }
  };

  // ── history delete ───────────────────────────────────────────────────────
  const handleDeleteInteraction = async (interactionId: number) => {
    if (!window.confirm("Delete this history entry?")) return;
    try {
      await fetchWithAuth(`/api/crm/leads/${id}/history/${interactionId}`, { method: "DELETE" });
      alert("✅ History entry deleted");
      loadHistory();
    } catch { alert("❌ Failed to delete history entry"); }
  };

  // ── documents ────────────────────────────────────────────────────────────
  const handleDocumentUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files?.length) return;
    setIsUploadingDocument(true);
    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("documents", f));
      formData.append("client_id", id);

      const res = await fetch(`${API_BASE_URL}/api/crm/documents/upload-customer-documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      if (!res.ok) { alert(`Failed to upload: ${await res.text()}`); return; }
      const result = await res.json();
      if (!result.file_paths?.length) { alert("Upload succeeded but no file paths returned"); return; }

      const updated = [...uploadedDocuments, ...result.file_paths];
      setUploadedDocuments(updated);
      await updateDocumentDetails(updated);
      alert(`✅ ${result.file_paths.length} document(s) uploaded!`);
    } catch (e: any) {
      alert(`Network error: ${e.message || "Could not upload"}`);
    } finally {
      setIsUploadingDocument(false);
      if (event.target) event.target.value = "";
    }
  };

  const updateDocumentDetails = async (documents: string[]) => {
    try {
      await fetchWithAuth(`/api/crm/leads/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ document_details: JSON.stringify(documents) }),
      });
    } catch { /* silent */ }
  };

  const handleDeleteDocument = async (docIndex: number) => {
    if (!window.confirm("Delete this document?")) return;
    const updated = uploadedDocuments.filter((_, i) => i !== docIndex);
    setUploadedDocuments(updated);
    await updateDocumentDetails(updated);
    alert("✅ Document removed!");
  };

  const getFileName = (path: string) => path.split("/").pop() || path;

  // ── loading / error ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-600" />
          <p className="mt-4 text-gray-600">Loading lead details...</p>
        </div>
      </div>
    );
  }

  if (error || !lead) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-900">{error || "Lead not found"}</h3>
          <Button onClick={() => router.push("/dashboard/leads")} className="mt-4">Back to Leads</Button>
        </div>
      </div>
    );
  }

  const displayLead = isEditing ? editedLead : lead;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 pr-[340px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push(
                fromPage === "allocated" ? "/dashboard/allocated-renewals" : "/dashboard/leads"
              )}
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Lead Details</h1>
              <p className="text-sm text-gray-500">
                ID: {lead.tenant_lead_id || lead.opportunity_id}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {isEditing ? (
              <>
                <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" />Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-black hover:bg-gray-800">
                  {isSaving
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
                    : <><Save className="mr-2 h-4 w-4" />Save Changes</>}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="outline">
                <Edit className="mr-2 h-4 w-4" />Edit
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex space-x-1 border-b border-gray-200">
          {TABS.map(tab => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id ? "border-b-2 border-black text-black" : "text-gray-600 hover:text-gray-900"
                }`}>
                <Icon className="h-4 w-4" /><span>{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Tab Content ────────────────────────────────────────────────────── */}
      <div className="p-6 pr-[340px]">
        <div className="rounded-lg bg-white p-6 shadow-sm">

          {/* ── Contact ── */}
          {activeTab === "contact" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                <div>
                  <label className="text-sm font-medium text-gray-700">ID</label>
                  <Input value={lead.tenant_lead_id || lead.opportunity_id || ""} disabled className="mt-1 bg-gray-50" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Client Name</label>
                  <Input value={displayLead.contact_person || ""}
                    onChange={e => handleUpdateField("contact_person", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Trading Name</label>
                  <Input value={displayLead.business_name || ""}
                    onChange={e => handleUpdateField("business_name", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Position</label>
                  <Input value={displayLead.position || ""}
                    onChange={e => handleUpdateField("position", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Tel Number <span className="text-red-500">*</span>
                  </label>
                  <Input value={displayLead.tel_number || ""}
                    onChange={e => handleUpdateField("tel_number", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Mobile Number</label>
                  <Input value={displayLead.mobile_no || ""}
                    onChange={e => handleUpdateField("mobile_no", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input value={displayLead.email || ""}
                    onChange={e => handleUpdateField("email", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Company Number</label>
                  <Input value={displayLead.company_number || ""}
                    onChange={e => handleUpdateField("company_number", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Date of Birth</label>
                  <Input type="date" value={displayLead.date_of_birth?.split("T")[0] || ""}
                    onChange={e => handleUpdateField("date_of_birth", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Agent Allocated</label>
                  {isEditing ? (
                    <Select
                      value={displayLead.opportunity_owner_employee_id?.toString() || ""}
                      onValueChange={v => handleUpdateField("opportunity_owner_employee_id", parseInt(v))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select agent" /></SelectTrigger>
                      <SelectContent>
                        {employees.map(e => (
                          <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={displayLead.assigned_to_name || ""} disabled className="mt-1 bg-gray-50" />
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Agent Sold</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>
              </div>
            </div>
          )}

          {/* ── Contract ── */}
          {activeTab === "contract" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Contract & Billing Details</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                <div>
                  <label className="text-sm font-medium text-gray-700">New Supplier</label>
                  {isEditing ? (
                    <Select value={displayLead.supplier_id?.toString() || ""}
                      onValueChange={v => handleUpdateField("supplier_id", parseInt(v))}>
                      <SelectTrigger className="mt-1"><SelectValue placeholder="Select new supplier" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">— None —</SelectItem>
                        {suppliers.map(s => (
                          <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>{s.supplier_name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={displayLead.supplier_name || ""} disabled className="mt-1 bg-gray-50" />
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Site Name</label>
                  <Input value={displayLead.site_name || ""}
                    onChange={e => handleUpdateField("site_name", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Month Sold</label>
                  <Input value={
                    displayLead.month_sold
                      ? (displayLead.month_sold.includes("T") || displayLead.month_sold.includes(" ")
                        ? new Date(displayLead.month_sold).toLocaleDateString("en-GB", { month: "short", year: "numeric" })
                        : displayLead.month_sold)
                      : ""
                  }
                    onChange={e => handleUpdateField("month_sold", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">MPAN Top</label>
                  <Input value={displayLead.mpan_mpr || ""}
                    onChange={e => handleUpdateField("mpan_mpr", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">MPAN Bottom</label>
                  <Input value={displayLead.mpan_bottom || ""}
                    onChange={e => handleUpdateField("mpan_bottom", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Data Source</label>
                  <Input disabled className="mt-1 bg-gray-50" placeholder="—" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Annual Usage (kWh)</label>
                  <Input type="number" value={displayLead.annual_usage || ""}
                    onChange={e => handleUpdateField("annual_usage", parseFloat(e.target.value))}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Payment Type</label>
                  <Input value={displayLead.payment_type || ""}
                    onChange={e => handleUpdateField("payment_type", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Start Date</label>
                  <Input type="date" value={displayLead.start_date?.split("T")[0] || ""}
                    onChange={e => handleUpdateField("start_date", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Contract End</label>
                  <Input type="date" value={displayLead.end_date?.split("T")[0] || ""}
                    onChange={e => handleUpdateField("end_date", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Term Sold (Years)</label>
                  <Input type="number" value={displayLead.term_sold || ""}
                    onChange={e => handleUpdateField("term_sold", parseFloat(e.target.value))}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Net Notch</label>
                  <Input type="number" step="0.01" value={displayLead.net_notch || ""}
                    onChange={e => handleUpdateField("net_notch", parseFloat(e.target.value))}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Comms Paid (£)</label>
                  <Input type="number" step="0.01" value={displayLead.comms_paid || ""}
                    onChange={e => handleUpdateField("comms_paid", parseFloat(e.target.value))}
                    disabled={!isEditing} className="mt-1" />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Aggregator</label>
                  <Input value={displayLead.aggregator || ""}
                    onChange={e => handleUpdateField("aggregator", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>

                {/* Documents */}
                <div className="md:col-span-2 border-t pt-6 mt-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-medium text-gray-700">Documents</label>
                    <div>
                      <input type="file" id="document-upload" multiple
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                        onChange={handleDocumentUpload} className="hidden" disabled={isUploadingDocument} />
                      <Button type="button" variant="outline" size="sm"
                        onClick={() => document.getElementById("document-upload")?.click()}
                        disabled={isUploadingDocument}>
                        {isUploadingDocument
                          ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading...</>
                          : <><Upload className="mr-2 h-4 w-4" />Upload Documents</>}
                      </Button>
                    </div>
                  </div>
                  {uploadedDocuments.length > 0 ? (
                    <div className="space-y-2">
                      {uploadedDocuments.map((doc, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center space-x-3 flex-1 min-w-0">
                            <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                            <span className="text-sm text-gray-700 truncate">{getFileName(doc)}</span>
                          </div>
                          <div className="flex items-center space-x-2 ml-4">
                            <Button variant="ghost" size="sm" onClick={() => window.open(doc, "_blank")} title="Download">
                              <Download className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDeleteDocument(i)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50" title="Delete">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-6 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                      <File className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                      <p className="text-sm text-gray-500">No documents uploaded yet</p>
                      <p className="text-xs text-gray-400 mt-1">Click "Upload Documents" to add files</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Address ── */}
          {activeTab === "address" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Address</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {([
                  { label: "House Name",   field: "house_name"   },
                  { label: "House Number", field: "house_number" },
                  { label: "Door Number",  field: "door_number"  },
                  { label: "Street",       field: "address"      },
                  { label: "Town",         field: "town"         },
                  { label: "County",       field: "county"       },
                  // Opportunity_Details uses "postcode" not "post_code"
                  { label: "Post Code",    field: "postcode"     },
                ] as { label: string; field: keyof Lead }[]).map(({ label, field }) => (
                  <div key={field}>
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                    <Input value={(displayLead as any)[field] || ""}
                      onChange={e => handleUpdateField(field, e.target.value)}
                      disabled={!isEditing} className="mt-1" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Charges ── */}
          {activeTab === "charges" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Charges</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {([
                  { label: "Standing Charge (£)", field: "stand_charge",       step: "0.01"   },
                  { label: "Rate 1 (p/kWh)",      field: "rate_1",             step: "0.0001" },
                  { label: "Rate 2 (p/kWh)",      field: "rate_2",             step: "0.0001" },
                  { label: "Rate 3 (p/kWh)",      field: "rate_3",             step: "0.0001" },
                  { label: "Night Charge",         field: "night_charge",       step: "0.01"   },
                  { label: "Eve/Weekend Charge",   field: "eve_weekend_charge", step: "0.01"   },
                  { label: "Other Charges 1",      field: "other_charges_1",    step: "0.01"   },
                  { label: "Other Charges 2",      field: "other_charges_2",    step: "0.01"   },
                  { label: "Other Charges 3",      field: "other_charges_3",    step: "0.01"   },
                ] as { label: string; field: keyof Lead; step: string }[]).map(({ label, field, step }) => (
                  <div key={field}>
                    <label className="text-sm font-medium text-gray-700">{label}</label>
                    <Input type="number" step={step} value={(displayLead as any)[field] || ""}
                      onChange={e => handleUpdateField(field, parseFloat(e.target.value))}
                      disabled={!isEditing} className="mt-1" />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── Banking ── */}
          {activeTab === "banking" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Bank & Trading Account Details</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Bank Name</label>
                  <Input value={displayLead.bank_name || ""}
                    onChange={e => handleUpdateField("bank_name", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Account Number</label>
                  <Input value={displayLead.bank_account_number || ""}
                    onChange={e => handleUpdateField("bank_account_number", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Sort Code</label>
                  <Input value={displayLead.bank_sort_code || ""}
                    onChange={e => handleUpdateField("bank_sort_code", e.target.value)}
                    disabled={!isEditing} className="mt-1" placeholder="XX-XX-XX" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Charity/Ltd Company Number</label>
                  <Input value={displayLead.charity_ltd_company_number || ""}
                    onChange={e => handleUpdateField("charity_ltd_company_number", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Partner Details</label>
                  <Textarea value={displayLead.partner_details || ""}
                    onChange={e => handleUpdateField("partner_details", e.target.value)}
                    disabled={!isEditing} className="mt-1" rows={3} placeholder="Enter partner details..." />
                </div>
              </div>
            </div>
          )}

          {/* ── Others ── */}
          {activeTab === "others" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Others</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Meter Ref</label>
                  <Input value={displayLead.meter_ref || ""}
                    onChange={e => handleUpdateField("meter_ref", e.target.value)}
                    disabled={!isEditing} className="mt-1" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Uplift</label>
                  <Input type="number" step="0.01" value={displayLead.uplift || ""}
                    onChange={e => handleUpdateField("uplift", parseFloat(e.target.value))}
                    disabled={!isEditing} className="mt-1" />
                </div>
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Comments</label>
                  <Textarea value={displayLead.comments || ""}
                    onChange={e => handleUpdateField("comments", e.target.value)}
                    disabled={!isEditing} className="mt-1" rows={4} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Assign Modal ─────────────────────────────────────────────────────── */}
      <Dialog open={showAssignmentModal} onOpenChange={setShowAssignmentModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign Salesperson</DialogTitle>
            <DialogDescription>Add an optional note about this assignment</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Assigned To</label>
              <Select value={assigningEmployeeId} onValueChange={setAssigningEmployeeId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Unassigned</SelectItem>
                  {employees.map(e => (
                    <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Assignment Notes (Optional)</label>
              <Textarea className="mt-1" placeholder="Why is this being assigned? Any specific instructions..."
                value={assignmentNotes} onChange={e => setAssignmentNotes(e.target.value)} rows={3} />
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => { setShowAssignmentModal(false); setAssigningEmployeeId(""); setAssignmentNotes(""); }}
              disabled={isAssigningEmployee}>Cancel</Button>
            <Button onClick={handleAssignEmployee} disabled={isAssigningEmployee}>
              {isAssigningEmployee ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Assigning...</> : "Assign"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Action Panel (fixed right sidebar) ───────────────────────────────── */}
      <div className="fixed right-0 top-0 h-full w-80 border-l border-gray-200 bg-gray-50 p-6 pt-16 overflow-y-auto">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Action</h3>

        <div className="space-y-4">

          {/* Assign To */}
          <div>
            <label className="text-sm font-medium text-gray-700">Assign to:</label>
            <Select
              value={lead.opportunity_owner_employee_id?.toString() || "0"}
              onValueChange={v => { 
                setAssigningEmployeeId(v); 
                setAssignmentNotes(""); 
                setShowAssignmentModal(true); 
              }}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Unassigned">{lead.assigned_to_name || "Unassigned"}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Unassigned</SelectItem>
                {employees.map(e => (
                  <SelectItem key={e.employee_id} value={e.employee_id.toString()}>{e.employee_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Status: <span className="text-red-500">*</span>
            </label>
            <Select
              value={callbackStatus}
              onValueChange={v => {
                if (v === "CLEAR_STATUS") { 
                  handleClearStatus(); 
                  return; 
                }
                setCallbackStatus(v);
                setCallbackDate(""); 
                setCallbackNotes(""); 
                setIsSold("");
                setNewEndDate(""); 
                setNewSupplier(""); 
                setNewAddress("");
                setCalledDate(new Date().toISOString().split("T")[0]);
                setRenewedBy("");
              }}>
              <SelectTrigger className="w-full mt-1"><SelectValue placeholder="Set status" /></SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                {lead.stage_name && (
                  <>
                    <div className="border-t my-1" />
                    <SelectItem value="CLEAR_STATUS" className="text-red-600">✕ Clear Status</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Called Date */}
          {callbackStatus && (
            <div>
              <label className="text-sm font-medium text-gray-700">Called Date</label>
              <Input type="date" className="mt-1" value={calledDate} onChange={e => setCalledDate(e.target.value)} />
            </div>
          )}

          {/* Was it sold? */}
          {currentConfig?.requiresSold && (
            <div>
              <label className="text-sm font-medium text-gray-700">Was it sold? <span className="text-red-500">*</span></label>
              <Select value={isSold} onValueChange={setIsSold}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="yes">Yes - Sold</SelectItem>
                  <SelectItem value="no">No - Move to Priced</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Callback Date */}
          {isDateRequired() && (
            <div>
              <label className="text-sm font-medium text-gray-700">Callback Date:</label>
              <Input type="date" className="mt-1" value={callbackDate} onChange={e => setCallbackDate(e.target.value)} />
            </div>
          )}

          {/* New Contract End Date */}
          {currentConfig?.requiresNewEndDate && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                New Contract End Date:{" "}
                {callbackStatus === "End Date Changed"
                  ? <span className="text-red-500">*</span>
                  : <span className="text-gray-400">(Optional)</span>}
              </label>
              <Input type="date" className="mt-1" value={newEndDate} onChange={e => setNewEndDate(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">
                {callbackStatus === "Already Renewed" ? "Leave blank if end date hasn't changed" : "Contract end date will be updated"}
              </p>
            </div>
          )}

          {/* Renewed By */}
          {callbackStatus === "Already Renewed" && (
            <div>
              <label className="text-sm font-medium text-gray-700">Renewed By <span className="text-red-500">*</span></label>
              <div className="mt-1 flex flex-col gap-2 p-3 border rounded-lg bg-white">
                {(["customer", "agent"] as const).map(v => (
                  <label key={v} className="flex items-center gap-3 cursor-pointer">
                    <input type="radio" name="renewedBy_action_panel" value={v}
                      checked={renewedBy === v} onChange={() => setRenewedBy(v)} className="w-4 h-4 accent-black" />
                    <div>
                      <span className="text-sm font-medium text-gray-900">
                        Renewed by {v.charAt(0).toUpperCase() + v.slice(1)}
                      </span>
                      <p className="text-xs text-gray-500">
                        {v === "customer" ? "Counts as Renewed Directly" : "Counts as Renewed"}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Deletion Warning */}
          {currentConfig?.deletesRecord && (
            <Alert className="mt-2">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription><strong>Warning:</strong> This will permanently delete the record.</AlertDescription>
            </Alert>
          )}

          {/* New Supplier */}
          {callbackStatus === "Already Renewed" && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                New Supplier <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <Input type="text" className="mt-1" placeholder="Enter new supplier name"
                value={newSupplier} onChange={e => setNewSupplier(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Leave blank if supplier hasn't changed</p>
            </div>
          )}

          {/* New Address */}
          {callbackStatus === "Already Renewed" && (
            <div>
              <label className="text-sm font-medium text-gray-700">
                New Address <span className="text-gray-400 font-normal">(Optional)</span>
              </label>
              <Textarea className="mt-1" rows={2} placeholder="Enter new address if changed"
                value={newAddress} onChange={e => setNewAddress(e.target.value)} />
              <p className="text-xs text-gray-500 mt-1">Leave blank if address hasn't changed</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Notes: {currentConfig?.requiresNotes && <span className="text-red-500">*</span>}
            </label>
            <Textarea className="mt-1" rows={3}
              placeholder={currentConfig?.requiresNotes ? "Enter reason why it was lost..." : "Add notes..."}
              value={callbackNotes} onChange={e => setCallbackNotes(e.target.value)} />
            {currentConfig?.requiresNotes && (
              <p className="text-xs text-gray-500 mt-1">Required for Lost/Lost COT</p>
            )}
          </div>

          {/* Error */}
          {callbackError && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{callbackError}</AlertDescription>
            </Alert>
          )}

          {/* Save */}
          <Button className="w-full bg-black hover:bg-gray-800"
            onClick={handleSubmitCallback} disabled={isSubmittingCallback}>
            {isSubmittingCallback
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving...</>
              : callbackStatus ? `Save ${callbackStatus}` : "Save Action"}
          </Button>

        </div>

        {/* ── History ─────────────────────────────────────────────────────── */}
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
              {history.map(interaction => {
                const rawNotes      = interaction.notes || "";
                const cleanNotes    = rawNotes.replace(/^\[.*?\]\s*/, "");
                const displayStatus = interaction.interaction_type || "Unknown";
                return (
                  <div key={interaction.interaction_id}
                    className="p-3 bg-white border border-gray-200 rounded-lg text-sm relative group">
                    <button
                      onClick={() => handleDeleteInteraction(interaction.interaction_id)}
                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-red-50 rounded"
                      title="Delete this entry">
                      <Trash2 className="h-4 w-4 text-red-600" />
                    </button>
                    <div className="mb-2">
                      <span className="font-semibold text-gray-900">{displayStatus}</span>
                    </div>
                    {cleanNotes && (
                      <p className="text-gray-600 text-xs mb-2 pr-8">{cleanNotes}</p>
                    )}
                    {interaction.reminder_date &&
                      ["Callback","Called","Not Answered","Broker in Place","End Date Changed","Already Renewed"]
                        .includes(displayStatus) && (
                      <div className="flex items-center gap-1 text-xs text-purple-700">
                        <Calendar className="h-3 w-3" />
                        <span>Callback: {formatDate(interaction.reminder_date)}</span>
                      </div>
                    )}
                    {interaction.created_at && (
                      <div className="text-xs text-gray-400 mt-1">
                        {new Date(interaction.created_at).toLocaleString("en-GB", {
                          day: "2-digit", month: "2-digit", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div> 
    </div>   
  );
}
