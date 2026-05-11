"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Upload, RefreshCw, Users, Loader2, Trash2 } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWithAuth } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";

type DraftKind = "leads" | "renewals";

interface Employee {
  employee_id: number;
  employee_name: string;
}

interface DraftLead {
  opportunity_id: number;
  tenant_lead_id?: number | null;
  business_name?: string | null;
  contact_person?: string | null;
  tel_number?: string | number | null;
  mobile_no?: string | number | null;
  email?: string | null;
  mpan_mpr?: string | null;
  supplier_id?: number | null;
  supplier_name?: string | null;
  stage_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  annual_usage?: number | string | null;
  assigned_to_name?: string | null;
  opportunity_owner_employee_id?: number | null;
  created_at?: string | null;
}

interface DraftRenewal {
  id?: number;
  client_id: number;
  display_id?: number | null;
  display_order?: number | null;
  business_name?: string | null;
  contact_person?: string | null;
  phone?: string | null;
  mobile_no?: string | null;
  email?: string | null;
  mpan_top?: string | null;
  mpan_mpr?: string | null;
  supplier_name?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  annual_usage?: number | string | null;
  status?: string | null;
  assigned_to_id?: number | null;
  assigned_to_name?: string | null;
  created_at?: string | null;
}

const isUnassigned = (value: unknown) => value === null || value === undefined || value === "" || value === 0;

/** Same pattern as `/dashboard/leads` and `/dashboard/renewals` list tables. */
function formatListDate(value?: string | null) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

function formatTel(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value).replace(/\.0$/, "");
}

/** Mirrors `getStatusColor` on the main Leads page (pipeline / stage chip). */
function leadDraftStatusColor(stage: string | undefined) {
  if (!stage) return "bg-gray-100 text-gray-800";
  const l = stage.toLowerCase();
  if (["callback", "priced", "called", "converted"].includes(l)) return "bg-green-100 text-green-800";
  if (l === "not answered") return "bg-yellow-100 text-yellow-800";
  if (["lost", "lost cot"].includes(l)) return "bg-red-100 text-red-800";
  return "bg-gray-100 text-gray-800";
}

/** Mirrors `getStatusColor` on the main Renewals page. */
function renewalDraftStatusColor(status: string | undefined) {
  if (!status) return "bg-gray-100 text-gray-800";
  const statusLower = status.toLowerCase();
  if (statusLower === "called" || statusLower === "priced" || statusLower === "callback") {
    return "bg-green-100 text-green-800";
  }
  if (statusLower === "not answered") {
    return "bg-yellow-100 text-yellow-800";
  }
  if (statusLower === "lost" || statusLower === "lost cot") {
    return "bg-red-100 text-red-800";
  }
  return "bg-gray-100 text-gray-800";
}

function parseAnnualUsage(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = typeof value === "number" ? value : Number(String(value).replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export default function DraftsPage() {
  const [activeTab, setActiveTab] = useState<DraftKind>("leads");
  const [leads, setLeads] = useState<DraftLead[]>([]);
  const [renewals, setRenewals] = useState<DraftRenewal[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [assignEmployeeId, setAssignEmployeeId] = useState("");
  const [assigning, setAssigning] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [selectedRenewalIds, setSelectedRenewalIds] = useState<number[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const draftLeads = useMemo(() => leads.filter((lead) => isUnassigned(lead.opportunity_owner_employee_id)), [leads]);
  const draftRenewals = useMemo(() => renewals.filter((renewal) => isUnassigned(renewal.assigned_to_id)), [renewals]);
  const selectedIds = activeTab === "leads" ? selectedLeadIds : selectedRenewalIds;

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadRows, renewalRows, employeeRows] = await Promise.all([
        fetchWithAuth("/api/crm/leads"),
        fetchWithAuth("/energy-clients?service=utilities"),
        fetchWithAuth("/employees"),
      ]);
      setLeads(Array.isArray(leadRows) ? leadRows : leadRows?.data || []);
      setRenewals(Array.isArray(renewalRows) ? renewalRows : []);
      setEmployees(Array.isArray(employeeRows) ? employeeRows : employeeRows?.data || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load drafts");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleImport = async () => {
    if (!importFile) {
      toast.error("Please select a file");
      return;
    }

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      formData.append("is_draft", "true");

      const endpoint =
        activeTab === "leads"
          ? `${API_BASE_URL}/import/leads?service=utilities`
          : `${API_BASE_URL}/import/energy-customers?service=utilities`;

      const token = localStorage.getItem("auth_token") || localStorage.getItem("token");
      const tenantId = localStorage.getItem("tenant_id") || "2";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: token ? `Bearer ${token}` : "",
          "X-Tenant-ID": tenantId,
        },
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || data?.message || "Import failed");

      toast.success(`Imported ${data.successful ?? 0} ${activeTab === "leads" ? "lead" : "renewal"} drafts`);
      setImportOpen(false);
      setImportFile(null);
      await loadData();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const openAssign = (id: number) => {
    setAssigningId(id);
    setAssignEmployeeId("");
  };

  const assignDraft = async () => {
    if (!assigningId || !assignEmployeeId) {
      toast.error("Select a salesperson");
      return;
    }

    setAssigning(true);
    try {
      const employeeId = Number(assignEmployeeId);
      if (activeTab === "leads") {
        await fetchWithAuth("/api/crm/leads/assign", {
          method: "PATCH",
          body: JSON.stringify({ lead_ids: [assigningId], employee_id: employeeId }),
        });
        setLeads((prev) => prev.filter((lead) => lead.opportunity_id !== assigningId));
        setSelectedLeadIds((prev) => prev.filter((id) => id !== assigningId));
      } else {
        await fetchWithAuth(`/energy-clients/${assigningId}`, {
          method: "PUT",
          body: JSON.stringify({ assigned_to_id: employeeId }),
        });
        setRenewals((prev) => prev.filter((renewal) => renewal.client_id !== assigningId));
        setSelectedRenewalIds((prev) => prev.filter((id) => id !== assigningId));
      }
      toast.success("Draft assigned successfully");
      setAssigningId(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assignment failed");
    } finally {
      setAssigning(false);
    }
  };

  const toggleLead = (id: number) => {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((leadId) => leadId !== id) : [...prev, id]));
  };

  const toggleRenewal = (id: number) => {
    setSelectedRenewalIds((prev) => (prev.includes(id) ? prev.filter((clientId) => clientId !== id) : [...prev, id]));
  };

  const toggleAllLeads = () => {
    const allIds = draftLeads.map((lead) => lead.opportunity_id);
    setSelectedLeadIds((prev) => (prev.length === allIds.length ? [] : allIds));
  };

  const toggleAllRenewals = () => {
    const allIds = draftRenewals.map((renewal) => renewal.client_id);
    setSelectedRenewalIds((prev) => (prev.length === allIds.length ? [] : allIds));
  };

  const deleteSelectedDrafts = async () => {
    if (selectedIds.length === 0) return;

    setDeleting(true);
    try {
      if (activeTab === "leads") {
        const result = await fetchWithAuth("/api/crm/leads/drafts", {
          method: "DELETE",
          body: JSON.stringify({ lead_ids: selectedLeadIds }),
        });
        const deletedIds = Array.isArray(result?.deleted_ids) ? result.deleted_ids : selectedLeadIds;
        setLeads((prev) => prev.filter((lead) => !deletedIds.includes(lead.opportunity_id)));
        setSelectedLeadIds([]);
        toast.success(`Deleted ${deletedIds.length} draft lead${deletedIds.length === 1 ? "" : "s"}`);
      } else {
        const result = await fetchWithAuth("/energy-clients/drafts", {
          method: "DELETE",
          body: JSON.stringify({ client_ids: selectedRenewalIds }),
        });
        const deletedIds = Array.isArray(result?.deleted_ids) ? result.deleted_ids : selectedRenewalIds;
        setRenewals((prev) => prev.filter((renewal) => !deletedIds.includes(renewal.client_id)));
        setSelectedRenewalIds([]);
        toast.success(`Deleted ${deletedIds.length} draft renewal${deletedIds.length === 1 ? "" : "s"}`);
      }
      setDeleteOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <Toaster position="top-right" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Drafts</h1>
          <p className="text-sm text-gray-600">Import draft leads and renewals, then assign them when ready.</p>
        </div>
        <Button variant="outline" onClick={loadData} disabled={loading}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DraftKind)}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="renewals">Renewals</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={selectedIds.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected{selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import {activeTab === "leads" ? "Leads" : "Renewals"}
            </Button>
          </div>
        </div>

        <TabsContent value="leads">
          <DraftTable
            loading={loading}
            rows={draftLeads}
            emptyLabel="No draft leads"
            getKey={(row) => row.opportunity_id}
            selectedIds={selectedLeadIds}
            onToggle={(row) => toggleLead(row.opportunity_id)}
            onToggleAll={toggleAllLeads}
            columns={[
              [
                "ID",
                (row) => (
                  <span className="font-mono text-sm font-medium text-gray-900">
                    {row.tenant_lead_id ?? row.opportunity_id}
                  </span>
                ),
              ],
              [
                "Client Name",
                (row) => (
                  <div className="max-w-[140px] truncate text-sm text-gray-700" title={row.contact_person ?? ""}>
                    {row.contact_person ?? "—"}
                  </div>
                ),
              ],
              [
                "Trading Name",
                (row) => (
                  <div className="max-w-[160px] truncate text-sm text-gray-900" title={row.business_name ?? ""}>
                    {row.business_name ?? "—"}
                  </div>
                ),
              ],
              [
                "Tel No",
                (row) => <div className="text-sm whitespace-nowrap text-gray-900">{formatTel(row.tel_number)}</div>,
              ],
              [
                "Mobile No",
                (row) => <div className="text-sm whitespace-nowrap text-gray-900">{formatTel(row.mobile_no)}</div>,
              ],
              [
                "MPAN Top",
                (row) => (
                  <div className="max-w-[120px] truncate text-sm text-gray-900" title={row.mpan_mpr ?? ""}>
                    {row.mpan_mpr ?? "—"}
                  </div>
                ),
              ],
              [
                "Supplier",
                (row) => <div className="max-w-[120px] truncate text-sm text-gray-900">{row.supplier_name ?? "—"}</div>,
              ],
              [
                "Annual Usage",
                (row) => {
                  const aq = parseAnnualUsage(row.annual_usage);
                  return (
                    <div className="text-right text-sm whitespace-nowrap text-gray-900">
                      {aq != null ? aq.toLocaleString() : "—"}
                    </div>
                  );
                },
              ],
              [
                "Start Date",
                (row) => (
                  <div className="text-sm whitespace-nowrap text-gray-900">{formatListDate(row.start_date)}</div>
                ),
              ],
              [
                "Contract End",
                (row) => <div className="text-sm whitespace-nowrap text-gray-900">{formatListDate(row.end_date)}</div>,
              ],
              [
                "Status",
                (row) => (
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${leadDraftStatusColor(row.stage_name ?? undefined)}`}
                  >
                    {row.stage_name ?? "—"}
                  </span>
                ),
              ],
              [
                "Assigned To",
                (row) => <span className="text-sm text-gray-900">{row.assigned_to_name ?? "Unassigned"}</span>,
              ],
            ]}
            onAssign={(row) => openAssign(row.opportunity_id)}
          />
        </TabsContent>

        <TabsContent value="renewals">
          <DraftTable
            loading={loading}
            rows={draftRenewals}
            emptyLabel="No draft renewals"
            getKey={(row) => row.client_id}
            selectedIds={selectedRenewalIds}
            onToggle={(row) => toggleRenewal(row.client_id)}
            onToggleAll={toggleAllRenewals}
            columns={[
              [
                "ID",
                (row) => (
                  <span className="font-mono text-sm font-medium text-gray-900">
                    {row.display_order ?? row.display_id ?? row.id ?? row.client_id}
                  </span>
                ),
              ],
              [
                "Client Name",
                (row) => (
                  <div className="max-w-[140px] text-sm leading-tight break-words text-gray-700">
                    {row.contact_person ?? "—"}
                  </div>
                ),
              ],
              [
                "Trading Name",
                (row) => (
                  <div className="max-w-[160px] text-sm leading-tight break-words text-gray-900">
                    {row.business_name ?? "—"}
                  </div>
                ),
              ],
              [
                "Tel No",
                (row) => <div className="text-sm whitespace-nowrap text-gray-900">{formatTel(row.phone)}</div>,
              ],
              [
                "Mobile No",
                (row) => <div className="text-sm whitespace-nowrap text-gray-900">{formatTel(row.mobile_no)}</div>,
              ],
              [
                "MPAN Top",
                (row) => {
                  const mpan = row.mpan_top ?? row.mpan_mpr;
                  return (
                    <div className="max-w-[120px] truncate text-sm text-gray-900" title={mpan ?? ""}>
                      {mpan ?? "—"}
                    </div>
                  );
                },
              ],
              [
                "Supplier",
                (row) => (
                  <div className="max-w-[120px] truncate text-sm text-gray-900" title={row.supplier_name ?? ""}>
                    {row.supplier_name ?? "—"}
                  </div>
                ),
              ],
              [
                "Annual Usage",
                (row) => {
                  const aq = parseAnnualUsage(row.annual_usage);
                  return (
                    <div className="text-right text-sm whitespace-nowrap text-gray-900">
                      {aq != null ? aq.toLocaleString() : "—"}
                    </div>
                  );
                },
              ],
              [
                "Start Date",
                (row) => (
                  <div className="text-sm whitespace-nowrap text-gray-900">{formatListDate(row.start_date)}</div>
                ),
              ],
              [
                "Contract End",
                (row) => <div className="text-sm whitespace-nowrap text-gray-900">{formatListDate(row.end_date)}</div>,
              ],
              [
                "Status",
                (row) => {
                  const raw = row.status?.trim();
                  const label = raw ? raw : "—";
                  return (
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${renewalDraftStatusColor(raw)}`}
                    >
                      {label}
                    </span>
                  );
                },
              ],
              [
                "Assigned To",
                (row) => <span className="text-sm text-gray-900">{row.assigned_to_name ?? "Unassigned"}</span>,
              ],
            ]}
            onAssign={(row) => openAssign(row.client_id)}
          />
        </TabsContent>
      </Tabs>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import {activeTab === "leads" ? "Lead" : "Renewal"} Drafts</DialogTitle>
            <DialogDescription>Imported records stay in drafts until they are assigned.</DialogDescription>
          </DialogHeader>
          <Input
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setImportOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleImport} disabled={!importFile || importing}>
              {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Import
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete selected drafts?</DialogTitle>
            <DialogDescription>
              This will permanently delete the selected draft {activeTab === "leads" ? "leads" : "renewals"} from the
              database.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={deleting}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={deleteSelectedDrafts}
              disabled={selectedIds.length === 0 || deleting}
            >
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete {selectedIds.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={assigningId !== null} onOpenChange={(open) => !open && setAssigningId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Draft</DialogTitle>
            <DialogDescription>
              Assigned drafts will appear in the salesperson account and the normal admin table.
            </DialogDescription>
          </DialogHeader>
          <Select value={assignEmployeeId} onValueChange={setAssignEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select salesperson" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((employee) => (
                <SelectItem key={employee.employee_id} value={String(employee.employee_id)}>
                  {employee.employee_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setAssigningId(null)}>
              Cancel
            </Button>
            <Button onClick={assignDraft} disabled={!assignEmployeeId || assigning}>
              {assigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Assign
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DraftTable<T>({
  loading,
  rows,
  columns,
  emptyLabel,
  getKey,
  onAssign,
  selectedIds,
  onToggle,
  onToggleAll,
}: {
  loading: boolean;
  rows: T[];
  columns: [string, (row: T) => React.ReactNode][];
  emptyLabel: string;
  getKey: (row: T) => number;
  onAssign: (row: T) => void;
  selectedIds: number[];
  onToggle: (row: T) => void;
  onToggleAll: () => void;
}) {
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1500px] text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">
            <tr>
              <th className="w-12 px-4 py-3">
                <Checkbox
                  aria-label="Select all drafts"
                  checked={allSelected}
                  disabled={loading || rows.length === 0}
                  onCheckedChange={onToggleAll}
                />
              </th>
              {columns.map(([label]) => (
                <th key={label} className="px-4 py-3 font-medium">
                  {label}
                </th>
              ))}
              <th className="px-4 py-3 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td className="px-4 py-10 text-center text-gray-500" colSpan={columns.length + 2}>
                  <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
                  Loading drafts
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-gray-500" colSpan={columns.length + 2}>
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr key={getKey(row)} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Checkbox
                      aria-label="Select draft"
                      checked={selectedIds.includes(getKey(row))}
                      onCheckedChange={() => onToggle(row)}
                    />
                  </td>
                  {columns.map(([label, render]) => (
                    <td key={label} className="px-4 py-3 text-gray-800">
                      {render(row)}
                    </td>
                  ))}
                  <td className="px-4 py-3 text-right">
                    <Button size="sm" onClick={() => onAssign(row)}>
                      <Users className="mr-2 h-4 w-4" />
                      Assign
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
