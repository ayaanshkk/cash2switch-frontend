"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Upload, RefreshCw, Trash2, Zap, ChevronLeft, ChevronRight, ChevronFirst, ChevronLast, Users, Search } from "lucide-react";
import { toast, Toaster } from "react-hot-toast";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchWithAuth } from "@/lib/api";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:5000";
const DRAFTS_PER_PAGE = 25;

type DraftKind = "leads" | "renewals";

interface Employee {
  employee_id: number;
  employee_name: string;
}

interface Supplier {
  supplier_id: number;
  supplier_name: string;
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
  supplier_id?: number | null;
}

const isUnassigned = (value: unknown) => value === null || value === undefined || value === "" || value === 0;

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
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [selectedLeadIds, setSelectedLeadIds] = useState<number[]>([]);
  const [selectedRenewalIds, setSelectedRenewalIds] = useState<number[]>([]);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  
  // Pagination state
  const [currentLeadsPage, setCurrentLeadsPage] = useState(1);
  const [currentRenewalsPage, setCurrentRenewalsPage] = useState(1);

  // Bulk assignment state
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignEmployeeId, setBulkAssignEmployeeId] = useState("");
  const [bulkAssigning, setBulkAssigning] = useState(false);

  // ✅ Filter state - inline filters
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("all");

  // ✅ Apply filters
  const applyFilters = (items: DraftLead[] | DraftRenewal[]) => {
    let filtered = [...items];

    // Search filter
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter((item) => {
        const business = ("business_name" in item ? item.business_name : "") || "";
        const contact = ("contact_person" in item ? item.contact_person : "") || "";
        const mpan = ("mpan_mpr" in item ? item.mpan_mpr : "mpan_top" in item ? item.mpan_top : "") || "";
        
        return (
          business.toLowerCase().includes(search) ||
          contact.toLowerCase().includes(search) ||
          mpan.toLowerCase().includes(search)
        );
      });
    }

    // Supplier filter
    if (selectedSupplier !== "all") {
      filtered = filtered.filter((item) => {
        const supplierId = "supplier_id" in item ? item.supplier_id : null;
        return supplierId?.toString() === selectedSupplier;
      });
    }

    return filtered;
  };

  const draftLeads = useMemo(() => {
    const unassigned = leads.filter((lead) => isUnassigned(lead.opportunity_owner_employee_id));
    return applyFilters(unassigned) as DraftLead[];
  }, [leads, searchTerm, selectedSupplier]);

  const draftRenewals = useMemo(() => {
    const unassigned = renewals.filter((renewal) => isUnassigned(renewal.assigned_to_id));
    return applyFilters(unassigned) as DraftRenewal[];
  }, [renewals, searchTerm, selectedSupplier]);

  const selectedIds = activeTab === "leads" ? selectedLeadIds : selectedRenewalIds;

  // Pagination calculations
  const totalLeadsPages = Math.ceil(draftLeads.length / DRAFTS_PER_PAGE);
  const totalRenewalsPages = Math.ceil(draftRenewals.length / DRAFTS_PER_PAGE);
  
  const paginatedLeads = useMemo(() => {
    const startIndex = (currentLeadsPage - 1) * DRAFTS_PER_PAGE;
    return draftLeads.slice(startIndex, startIndex + DRAFTS_PER_PAGE);
  }, [draftLeads, currentLeadsPage]);

  const paginatedRenewals = useMemo(() => {
    const startIndex = (currentRenewalsPage - 1) * DRAFTS_PER_PAGE;
    return draftRenewals.slice(startIndex, startIndex + DRAFTS_PER_PAGE);
  }, [draftRenewals, currentRenewalsPage]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [leadRows, renewalRows, employeeRows, supplierRows] = await Promise.all([
        fetchWithAuth("/api/crm/leads/drafts"),
        fetchWithAuth("/energy-clients/drafts?service=utilities"),
        fetchWithAuth("/employees"),
        fetchWithAuth("/suppliers"),
      ]);
      setLeads(Array.isArray(leadRows) ? leadRows : leadRows?.data || []);
      setRenewals(Array.isArray(renewalRows) ? renewalRows : []);
      setEmployees(Array.isArray(employeeRows) ? employeeRows : employeeRows?.data || []);
      setSuppliers(Array.isArray(supplierRows) ? supplierRows : supplierRows?.data || []);
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
          : `${API_BASE_URL}/import/renewals?service=utilities`;

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

  const assignDraft = async (id: number, employeeIdStr: string) => {
    if (!employeeIdStr || employeeIdStr === "0") {
      toast.error("Select a salesperson");
      return;
    }

    setAssigning(true);
    try {
      const employeeId = Number(employeeIdStr);
      const selectedEmployee = employees.find(e => e.employee_id === employeeId);
      
      if (activeTab === "leads") {
        await fetchWithAuth("/api/crm/leads/assign", {
          method: "PATCH",
          body: JSON.stringify({ lead_ids: [id], employee_id: employeeId }),
        });
        setLeads((prev) => prev.filter((lead) => lead.opportunity_id !== id));
        setSelectedLeadIds((prev) => prev.filter((leadId) => leadId !== id));
      } else {
        await fetchWithAuth(`/energy-clients/${id}`, {
          method: "PUT",
          body: JSON.stringify({ assigned_to_id: employeeId }),
        });
        setRenewals((prev) => prev.filter((renewal) => renewal.client_id !== id));
        setSelectedRenewalIds((prev) => prev.filter((clientId) => clientId !== id));
      }
      
      toast.success(`Draft assigned to ${selectedEmployee?.employee_name || 'salesperson'}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Assignment failed");
    } finally {
      setAssigning(false);
    }
  };

  const handleBulkAssign = async () => {
    if (!bulkAssignEmployeeId || selectedIds.length === 0) {
      toast.error("Select a salesperson and at least one draft");
      return;
    }

    setBulkAssigning(true);
    try {
      const employeeId = Number(bulkAssignEmployeeId);
      const selectedEmployee = employees.find(e => e.employee_id === employeeId);

      if (activeTab === "leads") {
        await fetchWithAuth("/api/crm/leads/assign", {
          method: "PATCH",
          body: JSON.stringify({ lead_ids: selectedLeadIds, employee_id: employeeId }),
        });
        setLeads((prev) => prev.filter((lead) => !selectedLeadIds.includes(lead.opportunity_id)));
        setSelectedLeadIds([]);
        toast.success(`Assigned ${selectedLeadIds.length} leads to ${selectedEmployee?.employee_name}`);
      } else {
        const promises = selectedRenewalIds.map(clientId =>
          fetchWithAuth(`/energy-clients/${clientId}`, {
            method: "PUT",
            body: JSON.stringify({ assigned_to_id: employeeId }),
          })
        );
        await Promise.all(promises);
        setRenewals((prev) => prev.filter((renewal) => !selectedRenewalIds.includes(renewal.client_id)));
        setSelectedRenewalIds([]);
        toast.success(`Assigned ${selectedRenewalIds.length} renewals to ${selectedEmployee?.employee_name}`);
      }

      setBulkAssignOpen(false);
      setBulkAssignEmployeeId("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Bulk assignment failed");
    } finally {
      setBulkAssigning(false);
    }
  };

  const toggleLead = (id: number) => {
    setSelectedLeadIds((prev) => (prev.includes(id) ? prev.filter((leadId) => leadId !== id) : [...prev, id]));
  };

  const toggleRenewal = (id: number) => {
    setSelectedRenewalIds((prev) => (prev.includes(id) ? prev.filter((clientId) => clientId !== id) : [...prev, id]));
  };

  const toggleAllLeads = () => {
    const allPageIds = paginatedLeads.map((lead) => lead.opportunity_id);
    const allSelected = allPageIds.every(id => selectedLeadIds.includes(id));
    
    if (allSelected) {
      setSelectedLeadIds((prev) => prev.filter(id => !allPageIds.includes(id)));
    } else {
      setSelectedLeadIds((prev) => [...new Set([...prev, ...allPageIds])]);
    }
  };

  const toggleAllRenewals = () => {
    const allPageIds = paginatedRenewals.map((renewal) => renewal.client_id);
    const allSelected = allPageIds.every(id => selectedRenewalIds.includes(id));
    
    if (allSelected) {
      setSelectedRenewalIds((prev) => prev.filter(id => !allPageIds.includes(id)));
    } else {
      setSelectedRenewalIds((prev) => [...new Set([...prev, ...allPageIds])]);
    }
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

  const PaginationControls = ({ 
    currentPage, 
    totalPages, 
    onPageChange,
    totalItems 
  }: { 
    currentPage: number; 
    totalPages: number; 
    onPageChange: (page: number) => void;
    totalItems: number;
  }) => {
    if (totalPages <= 1) return null;
    
    const startIndex = (currentPage - 1) * DRAFTS_PER_PAGE + 1;
    const endIndex = Math.min(currentPage * DRAFTS_PER_PAGE, totalItems);
    
    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{startIndex}</span> to{" "}
          <span className="font-medium">{endIndex}</span> of{" "}
          <span className="font-medium">{totalItems}</span> {activeTab}
        </div>
        <div className="flex space-x-1">
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => onPageChange(1)} 
            disabled={currentPage === 1}
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => onPageChange(currentPage - 1)} 
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center px-3 text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => onPageChange(currentPage + 1)} 
            disabled={currentPage === totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="icon" 
            onClick={() => onPageChange(totalPages)} 
            disabled={currentPage === totalPages}
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
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

      {/* ✅ Inline Filters - Same as Renewals page */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search clients..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9"
          />
        </div>

        <Select value={selectedSupplier} onValueChange={setSelectedSupplier}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Suppliers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Suppliers</SelectItem>
            {suppliers.map((supplier) => (
              <SelectItem key={supplier.supplier_id} value={supplier.supplier_id.toString()}>
                {supplier.supplier_name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DraftKind)}>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="leads">Leads</TabsTrigger>
            <TabsTrigger value="renewals">Renewals</TabsTrigger>
          </TabsList>
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              variant="default" 
              onClick={() => setBulkAssignOpen(true)} 
              disabled={selectedIds.length === 0}
            >
              <Users className="mr-2 h-4 w-4" />
              Assign Selected
            </Button>
            <Button variant="destructive" onClick={() => setDeleteOpen(true)} disabled={selectedIds.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete Selected
            </Button>
            <Button onClick={() => setImportOpen(true)}>
              <Upload className="mr-2 h-4 w-4" />
              Import {activeTab === "leads" ? "Leads" : "Renewals"}
            </Button>
          </div>
        </div>

        <TabsContent value="leads">
          <DraftLeadsTable
            loading={loading}
            rows={paginatedLeads}
            emptyLabel="No draft leads"
            selectedIds={selectedLeadIds}
            onToggle={toggleLead}
            onToggleAll={toggleAllLeads}
            onAssign={assignDraft}
            employees={employees}
            allSelected={paginatedLeads.length > 0 && paginatedLeads.every(l => selectedLeadIds.includes(l.opportunity_id))}
          />
          {!loading && draftLeads.length > 0 && (
            <PaginationControls
              currentPage={currentLeadsPage}
              totalPages={totalLeadsPages}
              onPageChange={setCurrentLeadsPage}
              totalItems={draftLeads.length}
            />
          )}
        </TabsContent>

        <TabsContent value="renewals">
          <DraftRenewalsTable
            loading={loading}
            rows={paginatedRenewals}
            emptyLabel="No draft renewals"
            selectedIds={selectedRenewalIds}
            onToggle={toggleRenewal}
            onToggleAll={toggleAllRenewals}
            onAssign={assignDraft}
            employees={employees}
            allSelected={paginatedRenewals.length > 0 && paginatedRenewals.every(r => selectedRenewalIds.includes(r.client_id))}
          />
          {!loading && draftRenewals.length > 0 && (
            <PaginationControls
              currentPage={currentRenewalsPage}
              totalPages={totalRenewalsPages}
              onPageChange={setCurrentRenewalsPage}
              totalItems={draftRenewals.length}
            />
          )}
        </TabsContent>
      </Tabs>

      {/* Bulk Assignment Dialog */}
      <Dialog open={bulkAssignOpen} onOpenChange={setBulkAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Selected Drafts</DialogTitle>
            <DialogDescription>
              Assign {selectedIds.length} selected {activeTab} to a salesperson. They will appear in the salesperson's account.
            </DialogDescription>
          </DialogHeader>
          <Select value={bulkAssignEmployeeId} onValueChange={setBulkAssignEmployeeId}>
            <SelectTrigger>
              <SelectValue placeholder="Select salesperson" />
            </SelectTrigger>
            <SelectContent>
              {employees.map((emp) => (
                <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                  {emp.employee_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setBulkAssignOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleBulkAssign} disabled={!bulkAssignEmployeeId || bulkAssigning}>
              {bulkAssigning && <span className="mr-2">⏳</span>}
              Assign {selectedIds.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              {importing && <span className="mr-2">⏳</span>}
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
              {deleting && <span className="mr-2">⏳</span>}
              Delete {selectedIds.length}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Table components remain exactly the same as before...
function DraftLeadsTable({
  loading,
  rows,
  emptyLabel,
  selectedIds,
  onToggle,
  onToggleAll,
  onAssign,
  employees,
  allSelected,
}: {
  loading: boolean;
  rows: DraftLead[];
  emptyLabel: string;
  selectedIds: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onAssign: (id: number, employeeId: string) => void;
  employees: Employee[];
  allSelected: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left w-8">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={allSelected}
                  onChange={onToggleAll}
                  disabled={loading || rows.length === 0}
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-20 border-r-2 border-gray-300">
                ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                Client Name
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[11%]">
                Trading Name
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[8%]">
                Tel No
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[8%]">
                Mobile No
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[10%]">
                MPAN Top
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                Supplier
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                Annual Usage
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                Start Date
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                Contract End
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                Assigned To
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={12} className="px-6 py-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
                  <p className="mt-4 text-gray-500">Loading drafts...</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg">{emptyLabel}</p>
                  <p className="mt-2 text-sm">Import drafts to get started!</p>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isSelected = selectedIds.includes(row.opportunity_id);
                const displayId = index + 1;

                return (
                  <tr
                    key={row.opportunity_id}
                    className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 mt-1"
                        checked={isSelected}
                        onChange={() => onToggle(row.opportunity_id)}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                      <div className="whitespace-nowrap">{displayId}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700 align-top overflow-hidden">
                      <div className="leading-tight whitespace-normal break-words">{row.contact_person ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="leading-tight whitespace-normal break-words">{row.business_name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatTel(row.tel_number)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatTel(row.mobile_no)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="truncate" title={row.mpan_mpr || ""}>{row.mpan_mpr || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="truncate" title={row.supplier_name || ""}>{row.supplier_name || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                      <div className="whitespace-nowrap">{parseAnnualUsage(row.annual_usage)?.toLocaleString() || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatListDate(row.start_date)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatListDate(row.end_date)}</div>
                    </td>
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={row.opportunity_owner_employee_id?.toString() || "0"}
                        onValueChange={(value) => onAssign(row.opportunity_id, value)}
                      >
                        <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                          <SelectValue placeholder="Assign">
                            {row.assigned_to_name || "Unassigned"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Unassigned</SelectItem>
                          {employees.map((emp) => (
                            <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                              {emp.employee_name}
                            </SelectItem>
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
    </div>
  );
}

function DraftRenewalsTable({
  loading,
  rows,
  emptyLabel,
  selectedIds,
  onToggle,
  onToggleAll,
  onAssign,
  employees,
  allSelected,
}: {
  loading: boolean;
  rows: DraftRenewal[];
  emptyLabel: string;
  selectedIds: number[];
  onToggle: (id: number) => void;
  onToggleAll: () => void;
  onAssign: (id: number, employeeId: string) => void;
  employees: Employee[];
  allSelected: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 table-fixed">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-3 py-3 text-left w-8">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={allSelected}
                  onChange={onToggleAll}
                  disabled={loading || rows.length === 0}
                />
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-20 border-r-2 border-gray-300">
                ID
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                Client Name
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[11%]">
                Trading Name
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[8%]">
                Tel No
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[8%]">
                Mobile No
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[10%]">
                MPAN Top
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                Supplier
              </th>
              <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                Annual Usage
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                Start Date
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%] whitespace-nowrap">
                Contract End
              </th>
              <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-[9%]">
                Assigned To
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-200 bg-white">
            {loading ? (
              <tr>
                <td colSpan={12} className="px-6 py-12 text-center">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
                  <p className="mt-4 text-gray-500">Loading drafts...</p>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-lg">{emptyLabel}</p>
                  <p className="mt-2 text-sm">Import drafts to get started!</p>
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const isSelected = selectedIds.includes(row.client_id);
                const displayId = index + 1;

                return (
                  <tr
                    key={row.client_id}
                    className={`hover:bg-gray-50 transition-colors ${isSelected ? 'bg-blue-50' : ''}`}
                  >
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 mt-1"
                        checked={isSelected}
                        onChange={() => onToggle(row.client_id)}
                      />
                    </td>
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                      <div className="whitespace-nowrap">{displayId}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-700 align-top overflow-hidden">
                      <div className="leading-tight whitespace-normal break-words">{row.contact_person ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="leading-tight whitespace-normal break-words">{row.business_name ?? "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatTel(row.phone)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatTel(row.mobile_no)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="truncate" title={row.mpan_top || row.mpan_mpr || ""}>{row.mpan_top || row.mpan_mpr || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top overflow-hidden">
                      <div className="truncate" title={row.supplier_name || ""}>{row.supplier_name || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                      <div className="whitespace-nowrap">{parseAnnualUsage(row.annual_usage)?.toLocaleString() || "—"}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatListDate(row.start_date)}</div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">{formatListDate(row.end_date)}</div>
                    </td>
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <Select
                        value={row.assigned_to_id?.toString() || "0"}
                        onValueChange={(value) => onAssign(row.client_id, value)}
                      >
                        <SelectTrigger className="h-7 text-xs w-full max-w-[150px]">
                          <SelectValue placeholder="Assign">
                            {row.assigned_to_name || "Unassigned"}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">Unassigned</SelectItem>
                          {employees.map((emp) => (
                            <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                              {emp.employee_name}
                            </SelectItem>
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
    </div>
  );
}