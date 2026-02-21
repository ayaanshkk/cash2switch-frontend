"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  Search, Plus, Trash2, ChevronDown, Filter, AlertCircle,
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst, Upload, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";
import { toast } from "react-hot-toast";

// ---------------- Constants ----------------
const CLIENTS_PER_PAGE = 25;
const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// CCA pipeline stages
const STAGE_OPTIONS = [
  { value: "check",     label: "Check" },
  { value: "challenge", label: "Challenge" },
  { value: "appeal",    label: "Appeal" },
  { value: "priced",    label: "Priced" },
  { value: "resolved",  label: "Resolved" },
  { value: "lost",      label: "Lost" },
];

// ---------------- Types ----------------
interface RatesClient {
  id: number;
  client_id: number;
  name: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email?: string;
  address?: string;

  // Business rates specific fields
  voa_reference?: string;
  billing_authority?: string;     
  billing_authority_id?: number;  
  current_rv?: number;            
  proposed_rv?: number;
  rates_multiplier?: number;
  case_opened_date?: string;      
  appeal_deadline?: string;       

  // Pipeline fields
  case_stage?: string;
  stage_id?: number;
  opportunity_id?: number;


  created_at: string;
}

interface BillingAuthority {
  supplier_id: number;
  billing_authority: string;
  region?: string;
}

interface Stage {
  stage_id: number;
  stage_name: string;
  description?: string;
}

// ---------------- Utility functions ----------------
const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit", month: "2-digit", year: "numeric",
    });
  } catch { return "—"; }
};

const formatRV = (rv: number | undefined): string => {
  if (!rv) return "—";
  return `£${rv.toLocaleString()}`;
};

const getStageColor = (stage: string | undefined): string => {
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

const getStageLabel = (stage: string | undefined): string => {
  if (!stage) return "—";
  return STAGE_OPTIONS.find(o => o.value === stage.toLowerCase())?.label || stage;
};

// ---------------- Component ----------------
export default function RatesClientsPage() {
  const [allClients, setAllClients] = useState<RatesClient[]>([]);
  const [billingAuthorities, setBillingAuthorities] = useState<BillingAuthority[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [authorityFilter, setAuthorityFilter] = useState<number | "All">("All");
  const [stageFilter, setStageFilter] = useState<string | "All">("All");
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedClients, setSelectedClients] = useState<number[]>([]);

  const [lostConfirmation, setLostConfirmation] = useState<{
    isOpen: boolean;
    clientId: number | null;
    newStage: string | null;
  }>({ isOpen: false, clientId: null, newStage: null });

  const router = useRouter();
  const { } = useAuth();

  useEffect(() => {
    fetchClients();
    fetchBillingAuthorities();
    fetchStages();
  }, []);

  useEffect(() => { setCurrentPage(1); }, [searchTerm, authorityFilter, stageFilter]);

  // ---------------- Fetch Functions ----------------
  const fetchClients = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) { setError("No authentication token found. Please log in."); setIsLoading(false); return; }

      // Uses the CRM clients endpoint — no service param needed
      const response = await fetch(`${API_BASE_URL}/api/crm/leads`, {
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || errData.message || "Failed to fetch clients");
      }

      const data = await response.json();
      setAllClients(Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []);

    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error occurred";
      setError(msg);
      setAllClients([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchBillingAuthorities = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const resp  = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setBillingAuthorities(await resp.json());
    } catch (err) {
      console.error("Error fetching billing authorities:", err);
    }
  };

  const fetchStages = async () => {
    try {
      const body = await fetchWithAuth("/api/crm/stages");
      setStages(Array.isArray(body.data) ? body.data : []);
    } catch (err) {
      console.error("Error fetching stages:", err);
    }
  };

  // ---------------- Filtering & Sorting ----------------
  const sortedClients = useMemo(() =>
    [...allClients].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ), [allClients]);

  const filteredClients = useMemo(() => sortedClients.filter(client => {
    const term = searchTerm.toLowerCase();
    const matchesSearch =
      (client.business_name   || "").toLowerCase().includes(term) ||
      (client.contact_person  || "").toLowerCase().includes(term) ||
      (client.email           || "").toLowerCase().includes(term) ||
      (client.phone           || "").toLowerCase().includes(term) ||
      (client.voa_reference   || "").toLowerCase().includes(term) ||
      (client.billing_authority || "").toLowerCase().includes(term);

    const matchesAuthority = authorityFilter === "All" || client.billing_authority_id === authorityFilter;
    const matchesStage     = stageFilter === "All" || client.case_stage?.toLowerCase() === stageFilter;

    return matchesSearch && matchesAuthority && matchesStage;
  }), [sortedClients, searchTerm, authorityFilter, stageFilter]);

  const totalPages     = Math.ceil(filteredClients.length / CLIENTS_PER_PAGE);
  const paginatedClients = useMemo(() => {
    const start = (currentPage - 1) * CLIENTS_PER_PAGE;
    return filteredClients.slice(start, start + CLIENTS_PER_PAGE);
  }, [filteredClients, currentPage]);

  // ---------------- Status / Stage Update ----------------
  const updateClientStage = async (clientId: number, newStage: string) => {
    if (newStage.toLowerCase() === "lost") {
      setLostConfirmation({ isOpen: true, clientId, newStage });
      return;
    }
    if (newStage.toLowerCase() === "priced") {
      router.push("/dashboard/priced");
      return;
    }
    await performStageUpdate(clientId, newStage);
  };

  const performStageUpdate = async (clientId: number, newStage: string) => {
    try {
      // Find matching stage_id from Stage_Master
      const matchedStage = stages.find(s => s.stage_name.toLowerCase() === newStage.toLowerCase());

      await fetchWithAuth(`/api/crm/leads/${clientId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStage,
          ...(matchedStage ? { stage_id: matchedStage.stage_id } : {}),
        }),
      });

      setAllClients(prev => prev.map(c =>
        c.id === clientId ? { ...c, case_stage: newStage } : c
      ));
    } catch (err) {
      console.error("Stage update error:", err);
      toast.error("Error updating case stage");
    }
  };

  // ---------------- Delete ----------------
  const deleteClient = async (id: number) => {
    if (!window.confirm("Are you sure you want to delete this client and all related records?")) return;
    try {
      await fetchWithAuth(`/api/crm/leads/${id}`, { method: "DELETE" });
      setAllClients(prev => prev.filter(c => c.id !== id));
      setSelectedClients(prev => prev.filter(cid => cid !== id));
      toast.success("Client deleted");
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Error deleting client");
    }
  };

  const bulkDeleteClients = async () => {
    if (!selectedClients.length) { alert("Please select clients to delete"); return; }
    if (!window.confirm(`Delete ${selectedClients.length} client(s) and all related records?`)) return;
    try {
      await Promise.all(selectedClients.map(id => fetchWithAuth(`/api/crm/leads/${id}`, { method: "DELETE" })));
      setAllClients(prev => prev.filter(c => !selectedClients.includes(c.id)));
      setSelectedClients([]);
      toast.success(`Deleted ${selectedClients.length} client(s)`);
    } catch {
      toast.error("Error deleting some clients");
    }
  };

  // ---------------- Selection ----------------
  const handleSelectAll    = () => setSelectedClients(
    selectedClients.length === paginatedClients.length ? [] : paginatedClients.map(c => c.id)
  );
  const handleSelectClient = (id: number) =>
    setSelectedClients(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const getBillingAuthorityName = (id: number | undefined): string => {
    if (!id) return "—";
    return billingAuthorities.find(b => b.supplier_id === id)?.billing_authority || "—";
  };

  // ---------------- Pagination ----------------
  const PaginationControls = () => {
    if (totalPages <= 1) return null;
    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CLIENTS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">{Math.min(currentPage * CLIENTS_PER_PAGE, filteredClients.length)}</span> of{" "}
          <span className="font-medium">{filteredClients.length}</span> clients
        </div>
        <div className="flex space-x-1">
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(1)}                               disabled={currentPage === 1}><ChevronFirst className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.max(1, p - 1))}        disabled={currentPage === 1}><ChevronLeft  className="h-4 w-4" /></Button>
          <div className="flex items-center px-3 text-sm text-gray-700">Page {currentPage} of {totalPages}</div>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}><ChevronRight className="h-4 w-4" /></Button>
          <Button variant="outline" size="icon" onClick={() => setCurrentPage(totalPages)}                     disabled={currentPage === totalPages}><ChevronLast  className="h-4 w-4" /></Button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-6">
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">Renewals</h1>

      {/* Error */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Clients</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button onClick={fetchClients} variant="outline" size="sm" className="mt-3">Try Again</Button>
          </div>
        </div>
      )}

      {/* Filters & Actions */}
      <div className="mb-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Search clients, VOA reference..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {authorityFilter === "All" ? "All Billing Authorities" : getBillingAuthorityName(authorityFilter as number)}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setAuthorityFilter("All")}>All Billing Authorities</DropdownMenuItem>
              {billingAuthorities.map(b => (
                <DropdownMenuItem key={b.supplier_id} onClick={() => setAuthorityFilter(b.supplier_id)}>
                  {b.billing_authority}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {stageFilter === "All" ? "All Stages" : getStageLabel(stageFilter as string)}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStageFilter("All")}>All Stages</DropdownMenuItem>
              {STAGE_OPTIONS.map(s => (
                <DropdownMenuItem key={s.value} onClick={() => setStageFilter(s.value)}>{s.label}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="flex gap-2">
          {selectedClients.length > 0 && (
            <Button onClick={bulkDeleteClients} variant="destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected ({selectedClients.length})
            </Button>
          )}
          <Button onClick={() => router.push("/dashboard/rates-clients/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Client
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left w-10">
                  <input type="checkbox" className="rounded border-gray-300"
                    checked={selectedClients.length === paginatedClients.length && paginatedClients.length > 0}
                    onChange={handleSelectAll} />
                </th>
                <th className="px-2 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-16 border-r-2 border-gray-300">ID</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-44">Business Name</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">Contact</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">Phone</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">VOA Reference</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-36">Billing Authority</th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24">Current RV</th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24">Proposed RV</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">Opened</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">Deadline</th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-36">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600" />
                    <p className="mt-4 text-gray-500">Loading clients...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600">Failed to load clients</p>
                  </td>
                </tr>
              ) : paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500">
                    <Building2 className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-lg">No clients found.</p>
                    <p className="mt-2 text-sm">
                      {searchTerm || stageFilter !== "All" ? "Try adjusting your filters." : "Add your first client to get started."}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => {
                  const isSelected = selectedClients.includes(client.id);
                  const stageValue = client.case_stage?.toLowerCase() || "";
                  const daysToDeadline = client.appeal_deadline
                    ? Math.floor((new Date(client.appeal_deadline).getTime() - Date.now()) / 86400000)
                    : null;

                  return (
                    <tr
                      key={client.id}
                      className={`hover:bg-gray-50 transition-colors cursor-pointer ${isSelected ? "bg-blue-50" : ""}`}
                      onClick={() => router.push(`/dashboard/rates-clients/${client.client_id}`)}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        const menu = document.createElement("div");
                        menu.className = "fixed bg-white border border-gray-300 rounded-md shadow-lg z-50 py-1";
                        menu.style.left = `${e.pageX}px`;
                        menu.style.top  = `${e.pageY}px`;

                        const editBtn = document.createElement("button");
                        editBtn.className = "w-full px-4 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2";
                        editBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg> Edit';
                        editBtn.onclick = () => { router.push(`/dashboard/rates-clients/${client.client_id}/edit`); document.body.removeChild(menu); };

                        const delBtn = document.createElement("button");
                        delBtn.className = "w-full px-4 py-2 text-left text-sm hover:bg-red-50 text-red-600 flex items-center gap-2";
                        delBtn.innerHTML = '<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg> Delete';
                        delBtn.onclick = () => { deleteClient(client.id); document.body.removeChild(menu); };

                        menu.appendChild(editBtn);
                        if (user) menu.appendChild(delBtn);
                        document.body.appendChild(menu);

                        const close = (ev: MouseEvent) => {
                          if (!menu.contains(ev.target as Node)) { document.body.removeChild(menu); document.removeEventListener("click", close); }
                        };
                        setTimeout(() => document.addEventListener("click", close), 0);
                      }}
                    >
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" className="rounded border-gray-300 mt-1"
                          checked={isSelected} onChange={() => handleSelectClient(client.id)} />
                      </td>
                      <td className="px-2 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                        {client.client_id}
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="break-words max-w-[160px] leading-tight font-medium">{client.business_name || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-700 align-top">
                        <div className="break-words max-w-[120px] leading-tight">{client.contact_person || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-sm text-gray-900 align-top">
                        <div className="whitespace-nowrap">{client.phone ? String(client.phone).replace(/\.0$/, "") : "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs font-mono text-gray-900 align-top">
                        <div className="break-all max-w-[120px] leading-tight">{client.voa_reference || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900 align-top">
                        <div className="break-words max-w-[130px] leading-tight">{client.billing_authority || "—"}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">{formatRV(client.current_rv)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-900 text-right align-top">
                        <div className="whitespace-nowrap">{formatRV(client.proposed_rv)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-700 align-top">
                        <div className="whitespace-nowrap">{formatDate(client.case_opened_date)}</div>
                      </td>
                      <td className="px-3 py-3 text-xs align-top">
                        <div className={`whitespace-nowrap font-medium ${
                          daysToDeadline !== null && daysToDeadline <= 30 ? "text-red-600"
                          : daysToDeadline !== null && daysToDeadline <= 60 ? "text-orange-600"
                          : "text-gray-700"
                        }`}>
                          {formatDate(client.appeal_deadline)}
                        </div>
                      </td>
                      <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                        <Select value={stageValue} onValueChange={v => updateClientStage(client.id, v)}>
                          <SelectTrigger className="h-7 text-xs w-full max-w-[130px]">
                            <SelectValue placeholder="Set stage">
                              {stageValue ? (
                                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${getStageColor(stageValue)}`}>
                                  {getStageLabel(stageValue)}
                                </span>
                              ) : "—"}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {STAGE_OPTIONS.map(o => (
                              <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && !error && filteredClients.length > 0 && <PaginationControls />}
      </div>

      {/* Lost Confirmation Modal */}
      <Dialog open={lostConfirmation.isOpen} onOpenChange={open => {
        if (!open) setLostConfirmation({ isOpen: false, clientId: null, newStage: null });
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Case as Lost?</DialogTitle>
            <DialogDescription>
              This case will be marked as lost and moved to the recycle bin. You can restore it later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-3 mt-6">
            <Button variant="outline" onClick={() => setLostConfirmation({ isOpen: false, clientId: null, newStage: null })}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={async () => {
              const { clientId, newStage } = lostConfirmation;
              setLostConfirmation({ isOpen: false, clientId: null, newStage: null });
              if (clientId && newStage) await performStageUpdate(clientId, newStage);
            }}>
              Mark as Lost
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}