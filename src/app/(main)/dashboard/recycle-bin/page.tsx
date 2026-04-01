"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { RotateCcw, Trash2, Eye, Search, AlertCircle, Loader2, Users, ChevronLeft, ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// ==========================================
// TYPES
// ==========================================

type DeletedLead = {
  opportunity_id: number;
  display_id?: number;
  tenant_lead_id?: number;
  business_name: string | null;
  contact_person: string | null;
  tel_number: string | null;
  email: string | null;
  mpan_mpr: string | null;
  start_date: string | null;
  stage_name: string | null;
  stage_id?: number;
  created_at: string | null;
};

type DeletedCustomer = {
  client_id: number;
  display_id?: number;
  tenant_client_id?: number;
  business_name: string;
  contact_person: string;
  phone: string;
  mobile_no?: string;
  email: string;
  deleted_reason: string;
  deleted_at: string;
  assigned_to_name?: string;
  assigned_to_id?: number;
  mpan_mpr?: string;
  mpan_top?: string;
  supplier_name?: string;
  annual_usage?: number;
  start_date?: string;
  end_date?: string;
};

type Employee = {
  employee_id: number;
  employee_name: string;
};

const DAYS_UNTIL_DELETE = 30;
const ITEMS_PER_PAGE = 25;

// ==========================================
// HELPER FUNCTIONS
// ==========================================

const getDaysRemaining = (createdAt?: string | null): number | null => {
  if (!createdAt) return null;
  const createdTime = new Date(createdAt).getTime();
  if (Number.isNaN(createdTime)) return null;
  const now = Date.now();
  const elapsedDays = Math.floor((now - createdTime) / (1000 * 60 * 60 * 24));
  return Math.max(DAYS_UNTIL_DELETE - elapsedDays, 0);
};

const formatDate = (dateString?: string | null) => {
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

const getReasonBadgeColor = (reason: string) => {
  switch (reason?.toLowerCase()) {
    case "lost":
    case "lost cot":
      return "bg-yellow-100 text-yellow-800";
    case "invalid number":
      return "bg-red-100 text-red-800";
    case "meter de-energised":
      return "bg-gray-100 text-gray-800";
    default:
      return "bg-blue-100 text-blue-800";
  }
};

// ==========================================
// PAGINATION COMPONENT
// ==========================================

type PaginationProps = {
  currentPage: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
};

function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  
  if (totalPages <= 1) return null;

  const startItem = (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200">
      <div className="flex items-center gap-2 text-sm text-gray-700">
        <span>
          Showing <span className="font-medium">{startItem}</span> to{" "}
          <span className="font-medium">{endItem}</span> of{" "}
          <span className="font-medium">{totalItems}</span> results
        </span>
      </div>
      
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <ChevronLeft className="h-4 w-4" />
          Previous
        </Button>
        
        <div className="flex items-center gap-1">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
            // Show first page, last page, current page, and pages around current
            const showPage =
              page === 1 ||
              page === totalPages ||
              (page >= currentPage - 1 && page <= currentPage + 1);
            
            const showEllipsis =
              (page === currentPage - 2 && currentPage > 3) ||
              (page === currentPage + 2 && currentPage < totalPages - 2);

            if (showEllipsis) {
              return (
                <span key={page} className="px-2 text-gray-500">
                  ...
                </span>
              );
            }

            if (!showPage) return null;

            return (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                onClick={() => onPageChange(page)}
                className="min-w-[2.5rem]"
              >
                {page}
              </Button>
            );
          })}
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// ==========================================
// MAIN COMPONENT
// ==========================================

export default function UnifiedRecycleBinPage() {
  const { loading: authLoading, user } = useAuth();
  const router = useRouter();

  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<number | 'all'>('all');

  const [leads, setLeads] = useState<DeletedLead[]>([]);
  const [allLeads, setAllLeads] = useState<DeletedLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [notCalledStageId, setNotCalledStageId] = useState<number | null>(null);
  const [restoringLeadIds, setRestoringLeadIds] = useState<Record<number, boolean>>({});
  const [leadsSearchTerm, setLeadsSearchTerm] = useState("");
  const [leadsCurrentPage, setLeadsCurrentPage] = useState(1);

  const [customers, setCustomers] = useState<DeletedCustomer[]>([]);
  const [allCustomers, setAllCustomers] = useState<DeletedCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [customersSearchTerm, setCustomersSearchTerm] = useState("");
  const [customersCurrentPage, setCustomersCurrentPage] = useState(1);

  useEffect(() => {
    if (selectedEmployee === 'all') {
      setLeads(allLeads);
      setCustomers(allCustomers);
    } else {
      setLeads(allLeads.filter(l => (l as any).assigned_to_id === selectedEmployee));
      setCustomers(allCustomers.filter(c => c.assigned_to_id === selectedEmployee));
    }
    // Reset to page 1 when filter changes
    setLeadsCurrentPage(1);
    setCustomersCurrentPage(1);
  }, [selectedEmployee, allLeads, allCustomers]);

  const fetchEmployees = async () => {
    try {
      const response = await fetchWithAuth('/employees');
      const list = Array.isArray(response.data) ? response.data :
                   Array.isArray(response) ? response : [];
      setEmployees(list);
    } catch (err) {
      console.error('Error fetching employees:', err);
    }
  };

  const loadDeletedLeads = async () => {
    try {
      setLeadsLoading(true);
      setLeadsError(null);
      const leadsData = await fetchWithAuth("/api/crm/leads");
      const allLeadsData = Array.isArray(leadsData.data) ? leadsData.data : [];
      const deletedLeads = allLeadsData.filter((lead: any) =>
        lead.stage_name?.toLowerCase() === "lost"
      );
      setAllLeads(deletedLeads);
      if (selectedEmployee === 'all') setLeads(deletedLeads);
      else setLeads(deletedLeads.filter((l: any) => l.assigned_to_id === selectedEmployee));
      if (!notCalledStageId) {
        const notCalledLead = allLeadsData.find((lead: any) =>
          lead.stage_name?.toLowerCase() === "not called"
        );
        if (notCalledLead?.stage_id) setNotCalledStageId(notCalledLead.stage_id);
      }
    } catch (err: any) {
      setLeadsError(err.message || "Failed to load deleted leads");
    } finally {
      setLeadsLoading(false);
    }
  };

  const handleRestoreLead = async (lead: DeletedLead) => {
    if (!notCalledStageId) {
      setLeadsError("Not Called stage not available. Please refresh.");
      return;
    }
    setRestoringLeadIds(prev => ({ ...prev, [lead.opportunity_id]: true }));
    try {
      await fetchWithAuth(`/api/crm/leads/${lead.opportunity_id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ stage_id: notCalledStageId })
      });
      try {
        const key = "restored_lead_ids";
        const raw = localStorage.getItem(key);
        const ids = new Set<number>((raw ? JSON.parse(raw) : []) as number[]);
        ids.add(lead.opportunity_id);
        localStorage.setItem(key, JSON.stringify(Array.from(ids)));
        window.dispatchEvent(new Event("restored-leads-updated"));
      } catch { /* ignore */ }
      setAllLeads(allLeads.filter(r => r.opportunity_id !== lead.opportunity_id));
    } catch (err: any) {
      setLeadsError(err.message || "Failed to restore lead");
    } finally {
      setRestoringLeadIds(prev => ({ ...prev, [lead.opportunity_id]: false }));
    }
  };

  const loadDeletedCustomers = async () => {
    setCustomersLoading(true);
    setCustomersError(null);
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/recycle-bin`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": localStorage.getItem("tenant_id") || "2"
        },
      });
      if (!response.ok) throw new Error("Failed to fetch deleted customers");
      const data = await response.json();
      setAllCustomers(data);
      if (selectedEmployee === 'all') setCustomers(data);
      else setCustomers(data.filter((c: DeletedCustomer) => c.assigned_to_id === selectedEmployee));
    } catch (err: any) {
      setCustomersError(err.message || "Failed to load deleted customers");
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleRestoreCustomer = async (clientId: number, businessName: string) => {
    if (!confirm(`Restore "${businessName}" back to renewals list?`)) return;
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${clientId}/restore`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": localStorage.getItem("tenant_id") || "2"
        },
      });
      if (!response.ok) throw new Error("Failed to restore customer");
      alert(`✅ "${businessName}" restored successfully`);
      loadDeletedCustomers();
    } catch (err: any) {
      alert(`❌ Failed to restore customer: ${err.message}`);
    }
  };

  const handlePermanentDeleteCustomer = async (clientId: number, businessName: string) => {
    if (!confirm(`⚠️ PERMANENTLY DELETE "${businessName}"?\n\nThis action CANNOT be undone.`)) return;
    if (!confirm(`Are you ABSOLUTELY SURE?\n\nClick OK to confirm permanent deletion.`)) return;
    const token = localStorage.getItem("auth_token");
    try {
      const response = await fetch(`${API_BASE_URL}/energy-clients/${clientId}/permanent-delete`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
          "X-Tenant-ID": localStorage.getItem("tenant_id") || "2"
        },
      });
      if (!response.ok) throw new Error("Failed to permanently delete customer");
      alert(`✅ "${businessName}" permanently deleted`);
      loadDeletedCustomers();
    } catch (err: any) {
      alert(`❌ Failed to delete customer: ${err.message}`);
    }
  };

  const handleViewLeadDetails = (opportunityId: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    window.open(`/dashboard/leads/${opportunityId}?from=recycle-bin`, '_blank');
  };

  const handleViewCustomerDetails = (clientId: number, event?: React.MouseEvent) => {
    if (event) {
      event.stopPropagation();
    }
    window.open(`/dashboard/renewals/${clientId}?from=recycle-bin`, '_blank');
  };

  useEffect(() => {
    if (!authLoading) {
      if (isAdmin) fetchEmployees();
      loadDeletedLeads();
      loadDeletedCustomers();
    }
  }, [authLoading]);

  // Filter leads and reset page when search changes
  const filteredLeads = leads.filter((lead) => {
    const s = leadsSearchTerm.toLowerCase();
    return (
      lead.business_name?.toLowerCase().includes(s) ||
      lead.contact_person?.toLowerCase().includes(s) ||
      lead.tel_number?.toLowerCase().includes(s) ||
      lead.email?.toLowerCase().includes(s) ||
      lead.mpan_mpr?.toLowerCase().includes(s)
    );
  });

  // Filter customers and reset page when search changes
  const filteredCustomers = customers.filter((customer) => {
    const s = customersSearchTerm.toLowerCase();
    return (
      customer.business_name?.toLowerCase().includes(s) ||
      customer.contact_person?.toLowerCase().includes(s) ||
      customer.phone?.toLowerCase().includes(s) ||
      customer.mobile_no?.toLowerCase().includes(s) ||
      customer.email?.toLowerCase().includes(s) ||
      customer.mpan_top?.toLowerCase().includes(s) ||
      customer.mpan_mpr?.toLowerCase().includes(s) ||
      customer.supplier_name?.toLowerCase().includes(s) ||
      customer.deleted_reason?.toLowerCase().includes(s)
    );
  });

  // Reset to page 1 when search changes
  useEffect(() => {
    setLeadsCurrentPage(1);
  }, [leadsSearchTerm]);

  useEffect(() => {
    setCustomersCurrentPage(1);
  }, [customersSearchTerm]);

  // Paginate leads
  const paginatedLeads = filteredLeads.slice(
    (leadsCurrentPage - 1) * ITEMS_PER_PAGE,
    leadsCurrentPage * ITEMS_PER_PAGE
  );

  // Paginate customers
  const paginatedCustomers = filteredCustomers.slice(
    (customersCurrentPage - 1) * ITEMS_PER_PAGE,
    customersCurrentPage * ITEMS_PER_PAGE
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recycle Bin</CardTitle>
              <CardDescription>Deleted leads and customers are shown here</CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>

          {isAdmin && employees.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-6 border border-gray-200">
              <div className="flex items-center gap-2 mb-3">
                <Users className="h-5 w-5 text-black" />
                <span className="text-sm font-medium text-black">Filter by Salesperson</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedEmployee('all')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    selectedEmployee === 'all'
                      ? 'bg-black text-white'
                      : 'bg-white text-black border border-gray-300 hover:bg-gray-100'
                  }`}
                >
                  All Salespeople
                </button>
                {employees.map((emp) => (
                  <button
                    key={emp.employee_id}
                    onClick={() => setSelectedEmployee(emp.employee_id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      selectedEmployee === emp.employee_id
                        ? 'bg-black text-white'
                        : 'bg-white text-black border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    {emp.employee_name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <Tabs defaultValue="leads" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="leads">Leads ({filteredLeads.length})</TabsTrigger>
              <TabsTrigger value="renewals">Renewals ({filteredCustomers.length})</TabsTrigger>
            </TabsList>

            {/* ==========================================
                LEADS TAB
                ========================================== */}
            <TabsContent value="leads">
              <div className="mb-4 flex items-center justify-between">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search leads..."
                    value={leadsSearchTerm}
                    onChange={(e) => setLeadsSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={loadDeletedLeads}>Refresh</Button>
              </div>

              <Alert className="mb-4 border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Lost leads will be permanently removed after 30 days.
                </AlertDescription>
              </Alert>

              {leadsError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{leadsError}</AlertDescription>
                </Alert>
              )}

              {leadsLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600" />
                  <p className="mt-4 text-gray-500">Loading...</p>
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-12 text-center">
                  <Trash2 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-lg text-gray-500">
                    {leadsSearchTerm ? "No matching leads found" : "No deleted leads"}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    {leadsSearchTerm ? "Try adjusting your search" : "Deleted leads will appear here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-20 border-r-2 border-gray-300">ID</th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Client Name</th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Trading Name</th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Tel No</th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Email</th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">MPAN/MPR</th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Created At</th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {paginatedLeads.map((lead) => (
                          <tr 
                            key={lead.opportunity_id} 
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => handleViewLeadDetails(lead.opportunity_id)}
                          >
                            <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                              <div className="whitespace-nowrap">
                                {lead.display_id || lead.tenant_lead_id || lead.opportunity_id}
                              </div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-700 align-top">
                              <div className="break-words max-w-[120px] leading-tight">{lead.contact_person || "—"}</div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="break-words max-w-[160px] leading-tight">{lead.business_name || "—"}</div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="whitespace-nowrap">{lead.tel_number || "—"}</div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="break-words max-w-[160px] leading-tight">{lead.email || "—"}</div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="whitespace-nowrap">{lead.mpan_mpr || "—"}</div>
                            </td>
                            <td className="px-3 py-3 text-sm text-gray-700 align-top">
                              <div className="whitespace-nowrap">{formatDate(lead.created_at)}</div>
                            </td>
                            <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleViewLeadDetails(lead.opportunity_id, e)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestoreLead(lead)}
                                  disabled={restoringLeadIds[lead.opportunity_id]}
                                  title="Restore Lead"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  {restoringLeadIds[lead.opportunity_id]
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <RotateCcw className="h-4 w-4" />
                                  }
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <Pagination
                    currentPage={leadsCurrentPage}
                    totalItems={filteredLeads.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setLeadsCurrentPage}
                  />
                </div>
              )}
            </TabsContent>

            {/* ==========================================
                RENEWALS TAB
                ========================================== */}
            <TabsContent value="renewals">
              <div className="mb-4 flex items-center justify-between">
                <div className="relative w-64">
                  <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search renewals..."
                    value={customersSearchTerm}
                    onChange={(e) => setCustomersSearchTerm(e.target.value)}
                    className="pl-8"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={loadDeletedCustomers}>Refresh</Button>
              </div>

              <Alert className="mb-4 border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Deleted customers can be restored or permanently removed from the database.
                </AlertDescription>
              </Alert>

              {customersError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{customersError}</AlertDescription>
                </Alert>
              )}

              {customersLoading ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600" />
                  <p className="mt-4 text-gray-500">Loading...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-12 text-center">
                  <Trash2 className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                  <p className="text-lg text-gray-500">
                    {customersSearchTerm ? "No matching customers found" : "No deleted customers"}
                  </p>
                  <p className="mt-2 text-sm text-gray-400">
                    {customersSearchTerm ? "Try adjusting your search" : "Deleted customers will appear here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-16 border-r-2 border-gray-300">
                            ID
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                            Client Name
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-36">
                            Trading Name
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                            Tel No
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                            Mobile No
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-36">
                            MPAN Top
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                            Supplier
                          </th>
                          <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                            Annual Usage
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                            Start Date
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                            Contract End
                          </th>
                          {isAdmin && (
                            <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                              Assigned To
                            </th>
                          )}
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                            Reason
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                            Deleted At
                          </th>
                          <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 bg-white">
                        {paginatedCustomers.map((customer) => (
                          <tr
                            key={customer.client_id}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => handleViewCustomerDetails(customer.client_id)}
                          >
                            {/* ID */}
                            <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                              <div className="whitespace-nowrap">
                                {customer.display_id || customer.tenant_client_id || customer.client_id}
                              </div>
                            </td>

                            {/* Client Name */}
                            <td className="px-3 py-3 text-sm text-gray-700 align-top">
                              <div className="break-words max-w-[120px] leading-tight">
                                {customer.contact_person || "—"}
                              </div>
                            </td>

                            {/* Trading Name */}
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="break-words max-w-[140px] leading-tight">
                                {customer.business_name || "—"}
                              </div>
                            </td>

                            {/* Tel No */}
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="whitespace-nowrap">
                                {customer.phone ? String(customer.phone).replace(/\.0$/, '') : '—'}
                              </div>
                            </td>

                            {/* Mobile No */}
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="whitespace-nowrap">
                                {customer.mobile_no ? String(customer.mobile_no).replace(/\.0$/, '') : '—'}
                              </div>
                            </td>

                            {/* MPAN Top */}
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="whitespace-nowrap">
                                {customer.mpan_top || customer.mpan_mpr || "—"}
                              </div>
                            </td>

                            {/* Supplier */}
                            <td className="px-3 py-3 text-sm text-gray-900 align-top">
                              <div className="break-words max-w-[100px] leading-tight">
                                {customer.supplier_name || "—"}
                              </div>
                            </td>

                            {/* Annual Usage */}
                            <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                              <div className="whitespace-nowrap">
                                {customer.annual_usage
                                  ? Number(customer.annual_usage).toLocaleString()
                                  : "—"}
                              </div>
                            </td>

                            {/* Start Date */}
                            <td className="px-3 py-3 text-sm text-gray-700 align-top">
                              <div className="whitespace-nowrap">{formatDate(customer.start_date)}</div>
                            </td>

                            {/* Contract End */}
                            <td className="px-3 py-3 text-sm text-gray-700 align-top">
                              <div className="whitespace-nowrap">{formatDate(customer.end_date)}</div>
                            </td>

                            {/* Assigned To */}
                            {isAdmin && (
                              <td className="px-3 py-3 text-sm text-gray-600 align-top">
                                <div className="break-words max-w-[100px] leading-tight">
                                  {customer.assigned_to_name || "—"}
                                </div>
                              </td>
                            )}

                            {/* Reason */}
                            <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                              <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold whitespace-nowrap ${getReasonBadgeColor(customer.deleted_reason)}`}>
                                {customer.deleted_reason}
                              </span>
                            </td>

                            {/* Deleted At */}
                            <td className="px-3 py-3 text-sm text-gray-700 align-top">
                              <div className="whitespace-nowrap">{formatDate(customer.deleted_at)}</div>
                            </td>

                            {/* Actions */}
                            <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => handleViewCustomerDetails(customer.client_id, e)}
                                  title="View Details"
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestoreCustomer(customer.client_id, customer.business_name)}
                                  title="Restore"
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handlePermanentDeleteCustomer(customer.client_id, customer.business_name)}
                                  title="Permanently Delete"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  
                  <Pagination
                    currentPage={customersCurrentPage}
                    totalItems={filteredCustomers.length}
                    itemsPerPage={ITEMS_PER_PAGE}
                    onPageChange={setCustomersCurrentPage}
                  />
                </div>
              )}
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}