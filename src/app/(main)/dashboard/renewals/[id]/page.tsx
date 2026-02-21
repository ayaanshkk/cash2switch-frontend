"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Edit, Loader2, AlertCircle, Save, X,
  MapPin, Calendar, User, FileText, MoreVertical,
  Upload, File, Download, Trash2, TrendingDown, Building2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { toast } from "react-hot-toast";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// Business rates tabs — replaces energy broker tabs
const TABS = [
  { id: "contact",    label: "Contact Information",    icon: User },
  { id: "case",       label: "Case & Assessment",       icon: TrendingDown },
  { id: "address",    label: "Property Address",        icon: MapPin },
  { id: "documents",  label: "Documents",               icon: FileText },
  { id: "notes",      label: "Notes & History",         icon: MoreVertical },
];

// CCA pipeline stages
const STAGE_OPTIONS = [
  { value: "check",     label: "Check" },
  { value: "challenge", label: "Challenge" },
  { value: "appeal",    label: "Appeal" },
  { value: "priced",    label: "Priced" },
  { value: "resolved",  label: "Resolved" },
  { value: "lost",      label: "Lost" },
];

interface RatesClient {
  id: number;
  client_id: number;
  business_name: string;
  contact_person: string;
  phone: string;
  email?: string;
  address?: string;
  post_code?: string;

  // Business rates fields
  voa_reference?: string;         // was mpan_mpr
  billing_authority?: string;     // was supplier_name
  billing_authority_id?: number;
  current_rv?: number;            // current rateable value
  proposed_rv?: number;           // challenged/proposed RV
  rates_multiplier?: number;      // pence in the pound multiplier
  projected_saving?: number;      // (current_rv - proposed_rv) × multiplier
  case_opened_date?: string;      // was start_date
  appeal_deadline?: string;       // was end_date

  // CCA pipeline
  case_stage?: string;            // Misc_Col1 value
  stage_id?: number;

  // Assignment — single operator, no staff reassignment
  assigned_to_name?: string;
  assigned_to_id?: number;

  // Interaction / follow-up
  last_contact_date?: string;
  next_follow_up_date?: string;
  comments?: string;

  created_at?: string;
}

const formatDate = (dateString?: string) => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return "—"; }
};

const formatRV = (rv?: number) =>
  rv ? `£${rv.toLocaleString()}` : "—";

const getStageColor = (stage?: string) => {
  switch (stage?.toLowerCase()) {
    case "resolved":  return "bg-green-100 text-green-800";
    case "check":     return "bg-blue-100 text-blue-800";
    case "challenge": return "bg-purple-100 text-purple-800";
    case "appeal":    return "bg-orange-100 text-orange-800";
    case "priced":    return "bg-teal-100 text-teal-800";
    case "lost":      return "bg-red-100 text-red-800";
    default:          return "bg-gray-100 text-gray-800";
  }
};

export default function RatesClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id as string;

  const [client, setClient] = useState<RatesClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("contact");
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editedClient, setEditedClient] = useState<Partial<RatesClient>>({});

  // Action panel
  const [followUpDate, setFollowUpDate] = useState("");
  const [actionComment, setActionComment] = useState("");
  const [isUpdatingAction, setIsUpdatingAction] = useState(false);

  // Documents
  const [documents, setDocuments] = useState<{ pathname: string; url: string; name: string }[]>([]);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);

  useEffect(() => { loadClientData(); }, [id]);

  const loadClientData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth(`/api/crm/rates-clients/${id}`);
      const clientData = data.data || data;
      setClient(clientData);
      setEditedClient(clientData);

      // Load documents from Vercel Blob via document endpoint
      const docsData = await fetchWithAuth(`/api/crm/documents/client/${id}`);
      setDocuments(Array.isArray(docsData.data) ? docsData.data : []);

    } catch (err) {
      console.error("Error loading client:", err);
      setError("Failed to load client data. Please refresh.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!client) return;
    setIsSaving(true);
    try {
      await fetchWithAuth(`/api/crm/leads/${client.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editedClient),
      });
      setClient(prev => prev ? { ...prev, ...editedClient } : null);
      setIsEditing(false);
      toast.success("Client updated successfully");
    } catch (err) {
      console.error("Error saving client:", err);
      toast.error("Failed to save changes");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setEditedClient(client || {});
    setIsEditing(false);
  };

  const handleField = (field: keyof RatesClient, value: any) => {
    setEditedClient(prev => ({ ...prev, [field]: value }));
  };

  const updateStage = async (newStage: string) => {
    try {
      await fetchWithAuth(`/api/crm/leads/${client?.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStage }),
      });
      setClient(prev => prev ? { ...prev, case_stage: newStage } : null);
      toast.success(`Case moved to ${newStage}`);
    } catch {
      toast.error("Error updating case stage");
    }
  };

  const handleActionUpdate = async () => {
    if (!followUpDate) { toast.error("Please select a follow-up date"); return; }
    if (!actionComment.trim()) { toast.error("Please enter a comment"); return; }

    setIsUpdatingAction(true);
    try {
      // Log as an interaction (call summary / note)
      await fetchWithAuth(`/api/crm/clients/${client?.client_id}/interactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_method: 2,                   // Email/written correspondence
          notes: actionComment,
          reminder_date: followUpDate,
          opportunity_id: client?.id,
        }),
      });
      setFollowUpDate("");
      setActionComment("");
      toast.success("Follow-up logged successfully");
    } catch {
      toast.error("Failed to log follow-up");
    } finally {
      setIsUpdatingAction(false);
    }
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploadingDoc(true);
    try {
      const token = localStorage.getItem("auth_token");
      const formData = new FormData();
      Array.from(files).forEach(f => formData.append("file", f));
      formData.append("document_name", files[0].name.replace(/\.[^/.]+$/, ""));
      formData.append("category", "CORRESPONDENCE");
      formData.append("client_id", id);

      const resp = await fetch(`${API_BASE_URL}/api/crm/documents`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const result = await resp.json();
      if (!result.success) throw new Error(result.error || "Upload failed");

      // Reload docs
      const docsData = await fetchWithAuth(`/api/crm/documents/client/${id}`);
      setDocuments(Array.isArray(docsData.data) ? docsData.data : []);
      toast.success("Document uploaded successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to upload document");
    } finally {
      setIsUploadingDoc(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDeleteDocument = async (pathname: string, docName: string) => {
    if (!window.confirm(`Delete "${docName}"?`)) return;
    try {
      await fetchWithAuth(`/api/crm/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pathname }),
      });
      setDocuments(prev => prev.filter(d => d.pathname !== pathname));
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  // Computed values
  const projectedSaving = (() => {
    const c = isEditing ? editedClient : client;
    if (!c?.current_rv || !c?.proposed_rv || !c?.rates_multiplier) return null;
    return (c.current_rv - c.proposed_rv) * c.rates_multiplier;
  })();

  const daysToDeadline = client?.appeal_deadline
    ? Math.floor((new Date(client.appeal_deadline).getTime() - Date.now()) / 86400000)
    : null;

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="mx-auto h-12 w-12 animate-spin text-gray-600" />
          <p className="mt-4 text-gray-600">Loading case details...</p>
        </div>
      </div>
    );
  }

  if (error || !client) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-medium text-red-900">{error || "Client not found"}</h3>
          <Button onClick={() => router.push("/dashboard/rates-clients")} className="mt-4">
            Back to Clients
          </Button>
        </div>
      </div>
    );
  }

  const display = isEditing ? editedClient : client;

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Header */}
      <div className="border-b border-gray-200 bg-white px-6 py-4 pr-[340px]">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <button
              onClick={() => router.push("/dashboard/rates-clients")}
              className="rounded-lg p-2 hover:bg-gray-100"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{client.business_name}</h1>
              <p className="text-sm text-gray-500">
                Client ID: {client.client_id}
                {client.voa_reference && (
                  <span className="ml-3 font-mono text-xs text-blue-600">
                    VOA: {client.voa_reference}
                  </span>
                )}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Stage badge */}
            {client.case_stage && (
              <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold capitalize ${getStageColor(client.case_stage)}`}>
                {client.case_stage}
              </span>
            )}

            {isEditing ? (
              <>
                <Button onClick={handleCancel} variant="outline" disabled={isSaving}>
                  <X className="mr-2 h-4 w-4" /> Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving} className="bg-black hover:bg-gray-800">
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : <><Save className="mr-2 h-4 w-4" /> Save Changes</>}
                </Button>
              </>
            ) : (
              <Button onClick={() => setIsEditing(true)} variant="outline">
                <Edit className="mr-2 h-4 w-4" /> Edit
              </Button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-4 flex space-x-1 border-b border-gray-200">
          {TABS.map(tab => {
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

      {/* Tab Content */}
      <div className="p-6 pr-[340px]">
        <div className="rounded-lg bg-white p-6 shadow-sm">

          {/* ── Contact Information ── */}
          {activeTab === "contact" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Contact Information</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Client ID</label>
                  <Input value={display.client_id || ""} disabled className="mt-1 bg-gray-50" />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Business Name</label>
                  <Input
                    value={display.business_name || ""}
                    onChange={e => handleField("business_name", e.target.value)}
                    disabled={!isEditing} className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Contact Person</label>
                  <Input
                    value={display.contact_person || ""}
                    onChange={e => handleField("contact_person", e.target.value)}
                    disabled={!isEditing} className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Tel Number</label>
                  <Input
                    value={display.phone || ""}
                    onChange={e => handleField("phone", e.target.value)}
                    disabled={!isEditing} className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Email</label>
                  <Input
                    value={display.email || ""}
                    onChange={e => handleField("email", e.target.value)}
                    disabled={!isEditing} className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Case Handler</label>
                  <Input
                    value={display.assigned_to_name || "—"}
                    disabled className="mt-1 bg-gray-50"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Case & Assessment ── */}
          {activeTab === "case" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Case & Assessment Details</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">

                <div>
                  <label className="text-sm font-medium text-gray-700">VOA Reference</label>
                  <Input
                    value={display.voa_reference || ""}
                    onChange={e => handleField("voa_reference", e.target.value)}
                    disabled={!isEditing} className="mt-1 font-mono"
                    placeholder="e.g. 123456789000"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Billing Authority</label>
                  <Input
                    value={display.billing_authority || ""}
                    disabled className="mt-1 bg-gray-50"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Current Rateable Value (RV)</label>
                  <Input
                    type="number"
                    value={display.current_rv || ""}
                    onChange={e => handleField("current_rv", parseFloat(e.target.value))}
                    disabled={!isEditing} className="mt-1"
                    placeholder="e.g. 45000"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Proposed RV</label>
                  <Input
                    type="number"
                    value={display.proposed_rv || ""}
                    onChange={e => handleField("proposed_rv", parseFloat(e.target.value))}
                    disabled={!isEditing} className="mt-1"
                    placeholder="e.g. 32000"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Rates Multiplier (pence in the £)
                  </label>
                  <Input
                    type="number"
                    step="0.001"
                    value={display.rates_multiplier || ""}
                    onChange={e => handleField("rates_multiplier", parseFloat(e.target.value))}
                    disabled={!isEditing} className="mt-1"
                    placeholder="e.g. 0.512"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Projected Annual Saving</label>
                  <Input
                    value={projectedSaving !== null ? `£${projectedSaving.toLocaleString(undefined, { maximumFractionDigits: 2 })}` : (display.projected_saving ? formatRV(display.projected_saving as number) : "—")}
                    disabled className="mt-1 bg-gray-50 font-semibold text-green-700"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Case Opened Date</label>
                  <Input
                    type="date"
                    value={display.case_opened_date?.split("T")[0] || ""}
                    onChange={e => handleField("case_opened_date", e.target.value)}
                    disabled={!isEditing} className="mt-1"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Appeal Deadline</label>
                  <Input
                    type="date"
                    value={display.appeal_deadline?.split("T")[0] || ""}
                    onChange={e => handleField("appeal_deadline", e.target.value)}
                    disabled={!isEditing}
                    className={`mt-1 ${daysToDeadline !== null && daysToDeadline <= 30 ? "border-red-400 text-red-700 font-semibold" : daysToDeadline !== null && daysToDeadline <= 60 ? "border-orange-400" : ""}`}
                  />
                  {daysToDeadline !== null && (
                    <p className={`mt-1 text-xs font-medium ${daysToDeadline <= 30 ? "text-red-600" : daysToDeadline <= 60 ? "text-orange-600" : "text-gray-500"}`}>
                      {daysToDeadline > 0 ? `${daysToDeadline} days remaining` : "Deadline passed"}
                    </p>
                  )}
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">Case Stage</label>
                  {isEditing ? (
                    <Select
                      value={display.case_stage?.toLowerCase() || ""}
                      onValueChange={v => handleField("case_stage", v)}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Select stage" />
                      </SelectTrigger>
                      <SelectContent>
                        {STAGE_OPTIONS.map(o => (
                          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={display.case_stage ? display.case_stage.charAt(0).toUpperCase() + display.case_stage.slice(1) : "—"}
                      disabled className="mt-1 bg-gray-50 capitalize"
                    />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Property Address ── */}
          {activeTab === "address" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Property Address</h2>
              <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="text-sm font-medium text-gray-700">Street / Address</label>
                  <Input
                    value={display.address || ""}
                    onChange={e => handleField("address", e.target.value)}
                    disabled={!isEditing} className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Post Code</label>
                  <Input
                    value={display.post_code || ""}
                    onChange={e => handleField("post_code", e.target.value)}
                    disabled={!isEditing} className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          {/* ── Documents ── */}
          {activeTab === "documents" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Documents</h2>
                <div>
                  <input
                    type="file" id="doc-upload" multiple
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png"
                    onChange={handleDocumentUpload}
                    className="hidden"
                    disabled={isUploadingDoc}
                  />
                  <Button
                    type="button" variant="outline" size="sm"
                    onClick={() => document.getElementById("doc-upload")?.click()}
                    disabled={isUploadingDoc}
                  >
                    {isUploadingDoc
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Uploading...</>
                      : <><Upload className="mr-2 h-4 w-4" /> Upload Document</>
                    }
                  </Button>
                </div>
              </div>

              {documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map(doc => (
                    <div key={doc.pathname} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <div className="flex items-center space-x-3 flex-1 min-w-0">
                        <File className="h-5 w-5 text-gray-400 flex-shrink-0" />
                        <span className="text-sm text-gray-700 truncate">{doc.name}</span>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <Button variant="ghost" size="sm" onClick={() => window.open(doc.url, "_blank")} title="View/Download">
                          <Download className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost" size="sm"
                          onClick={() => handleDeleteDocument(doc.pathname, doc.name)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                  <File className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                  <p className="text-sm text-gray-500">No documents uploaded for this case</p>
                  <p className="text-xs text-gray-400 mt-1">
                    Upload VOA letters, rates bills, appeal submissions, or supporting evidence
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Notes & History ── */}
          {activeTab === "notes" && (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold text-gray-900">Notes & History</h2>
              <div>
                <label className="text-sm font-medium text-gray-700">Case Notes</label>
                <Textarea
                  value={display.comments || ""}
                  onChange={e => handleField("comments", e.target.value)}
                  disabled={!isEditing}
                  className="mt-1"
                  rows={6}
                  placeholder="Add case notes, key dates, VOA correspondence details..."
                />
              </div>
              {client.last_contact_date && (
                <div>
                  <label className="text-sm font-medium text-gray-700">Last Contact</label>
                  <Input value={formatDate(client.last_contact_date)} disabled className="mt-1 bg-gray-50" />
                </div>
              )}
            </div>
          )}

        </div>
      </div>

      {/* Action Panel (Right Side) — single operator, no staff assignment */}
      <div className="fixed right-0 top-0 h-full w-80 border-l border-gray-200 bg-gray-50 p-6 overflow-y-auto">
        <h3 className="mb-4 text-lg font-semibold text-gray-900">Case Actions</h3>

        <div className="space-y-4">

          {/* Case Stage */}
          <div>
            <label className="text-sm font-medium text-gray-700">CCA Stage</label>
            <Select
              value={client.case_stage?.toLowerCase() || ""}
              onValueChange={updateStage}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Select stage" />
              </SelectTrigger>
              <SelectContent>
                {STAGE_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Key dates summary */}
          <div className="rounded-lg bg-white border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Key Dates</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Case Opened</span>
              <span>{formatDate(client.case_opened_date)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Appeal Deadline</span>
              <span className={daysToDeadline !== null && daysToDeadline <= 30 ? "text-red-600 font-semibold" : daysToDeadline !== null && daysToDeadline <= 60 ? "text-orange-600 font-semibold" : ""}>
                {formatDate(client.appeal_deadline)}
              </span>
            </div>
            {daysToDeadline !== null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Days Remaining</span>
                <span className={daysToDeadline <= 30 ? "text-red-600 font-bold" : daysToDeadline <= 60 ? "text-orange-600 font-semibold" : "font-medium"}>
                  {daysToDeadline > 0 ? daysToDeadline : "Overdue"}
                </span>
              </div>
            )}
          </div>

          {/* RV summary */}
          <div className="rounded-lg bg-white border border-gray-200 p-3 space-y-2">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Assessment</p>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Current RV</span>
              <span>{formatRV(client.current_rv)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Proposed RV</span>
              <span>{formatRV(client.proposed_rv)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold border-t pt-2 mt-2">
              <span className="text-gray-700">Projected Saving</span>
              <span className="text-green-700">
                {projectedSaving !== null
                  ? `£${projectedSaving.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : formatRV(client.projected_saving)}
              </span>
            </div>
          </div>

          {/* Follow-up */}
          <div>
            <label className="text-sm font-medium text-gray-700">
              Follow-up Date <span className="text-red-500">*</span>
            </label>
            <Input
              type="date" className="mt-1"
              value={followUpDate}
              onChange={e => setFollowUpDate(e.target.value)}
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">
              Note / Comment <span className="text-red-500">*</span>
            </label>
            <Textarea
              className="mt-1" rows={4}
              placeholder="Enter case note, call outcome, next steps..."
              value={actionComment}
              onChange={e => setActionComment(e.target.value)}
            />
          </div>

          <Button
            className="w-full bg-black hover:bg-gray-800"
            onClick={handleActionUpdate}
            disabled={isUpdatingAction}
          >
            {isUpdatingAction
              ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Logging...</>
              : "Log Follow-up"
            }
          </Button>
        </div>

        {/* Interaction history placeholder */}
        <div className="mt-8">
          <h3 className="mb-2 text-lg font-semibold text-gray-900">Interaction History</h3>
          <p className="text-sm text-gray-500">No interactions logged yet.</p>
        </div>
      </div>
    </div>
  );
}