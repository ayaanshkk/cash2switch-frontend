"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { RotateCcw, Trash2, Eye, Search, AlertCircle, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

// ==========================================
// TYPES
// ==========================================

type DeletedLead = {
  opportunity_id: number;
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
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  deleted_reason: string;
  deleted_at: string;
  assigned_to_name?: string;
  mpan_mpr?: string;
  supplier_name?: string;
  end_date?: string;
};

const DAYS_UNTIL_DELETE = 30;

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
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
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
// MAIN COMPONENT
// ==========================================

export default function UnifiedRecycleBinPage() {
  const { loading: authLoading } = useAuth();
  const router = useRouter();
  
  // Leads state
  const [leads, setLeads] = useState<DeletedLead[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [leadsError, setLeadsError] = useState<string | null>(null);
  const [notCalledStageId, setNotCalledStageId] = useState<number | null>(null);
  const [restoringLeadIds, setRestoringLeadIds] = useState<Record<number, boolean>>({});
  const [leadsSearchTerm, setLeadsSearchTerm] = useState("");
  
  // Renewals state
  const [customers, setCustomers] = useState<DeletedCustomer[]>([]);
  const [customersLoading, setCustomersLoading] = useState(true);
  const [customersError, setCustomersError] = useState<string | null>(null);
  const [customersSearchTerm, setCustomersSearchTerm] = useState("");

  // ==========================================
  // LEADS FUNCTIONS
  // ==========================================

  const loadDeletedLeads = async () => {
    try {
      setLeadsLoading(true);
      setLeadsError(null);
      
      console.log("🔄 Loading deleted leads...");
      
      const leadsData = await fetchWithAuth("/api/crm/leads");
      console.log("📊 Leads response:", leadsData);
      
      const allLeads = Array.isArray(leadsData.data) ? leadsData.data : [];
      
      // Filter for "Lost" stage leads
      const deletedLeads = allLeads.filter((lead: any) => 
        lead.stage_name?.toLowerCase() === "lost"
      );
      
      console.log(`🗑️ Found ${deletedLeads.length} deleted leads`);
      setLeads(deletedLeads);
      
      // Find "Not Called" stage ID for restoration
      if (!notCalledStageId) {
        const notCalledLead = allLeads.find((lead: any) => 
          lead.stage_name?.toLowerCase() === "not called"
        );
        if (notCalledLead?.stage_id) {
          setNotCalledStageId(notCalledLead.stage_id);
          console.log("✅ Not Called stage ID:", notCalledLead.stage_id);
        }
      }
      
    } catch (err: any) {
      console.error("❌ Failed to load deleted leads:", err);
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
      console.log(`🔄 Restoring lead ${lead.opportunity_id} to stage ${notCalledStageId}`);
      
      await fetchWithAuth(`/api/crm/leads/${lead.opportunity_id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ stage_id: notCalledStageId })
      });

      console.log(`✅ Lead ${lead.opportunity_id} restored successfully`);

      // Update localStorage with restored lead
      try {
        const key = "restored_lead_ids";
        const raw = localStorage.getItem(key);
        const ids = new Set<number>((raw ? JSON.parse(raw) : []) as number[]);
        ids.add(lead.opportunity_id);
        localStorage.setItem(key, JSON.stringify(Array.from(ids)));
        window.dispatchEvent(new Event("restored-leads-updated"));
      } catch {
        // ignore storage errors
      }

      // Remove from list
      setLeads(prev => prev.filter(r => r.opportunity_id !== lead.opportunity_id));
      
    } catch (err: any) {
      console.error(`❌ Failed to restore lead ${lead.opportunity_id}:`, err);
      setLeadsError(err.message || "Failed to restore lead");
    } finally {
      setRestoringLeadIds(prev => ({ ...prev, [lead.opportunity_id]: false }));
    }
  };

  // ==========================================
  // RENEWALS/CUSTOMERS FUNCTIONS
  // ==========================================

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

      if (!response.ok) {
        throw new Error("Failed to fetch deleted customers");
      }

      const data = await response.json();
      console.log("📊 Deleted customers loaded:", data.length);
      setCustomers(data);
    } catch (err: any) {
      console.error("❌ Error fetching deleted customers:", err);
      setCustomersError(err.message || "Failed to load deleted customers");
    } finally {
      setCustomersLoading(false);
    }
  };

  const handleRestoreCustomer = async (clientId: number, businessName: string) => {
    if (!confirm(`Restore "${businessName}" back to renewals list?`)) {
      return;
    }

    const token = localStorage.getItem("auth_token");
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/energy-clients/${clientId}/restore`,
        {
          method: "POST",
          headers: { 
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": localStorage.getItem("tenant_id") || "2"
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to restore customer");
      }

      console.log(`✅ Customer ${clientId} restored`);
      alert(`✅ "${businessName}" restored successfully`);
      loadDeletedCustomers(); // Refresh the list
    } catch (err: any) {
      console.error("❌ Error restoring customer:", err);
      alert(`❌ Failed to restore customer: ${err.message}`);
    }
  };

  const handlePermanentDeleteCustomer = async (clientId: number, businessName: string) => {
    if (
      !confirm(
        `⚠️ PERMANENTLY DELETE "${businessName}"?\n\nThis action CANNOT be undone. All data will be lost forever.`
      )
    ) {
      return;
    }

    // Second confirmation for safety
    if (
      !confirm(
        `Are you ABSOLUTELY SURE you want to permanently delete "${businessName}"?\n\nClick OK to confirm permanent deletion.`
      )
    ) {
      return;
    }

    const token = localStorage.getItem("auth_token");
    
    try {
      const response = await fetch(
        `${API_BASE_URL}/energy-clients/${clientId}/permanent-delete`,
        {
          method: "DELETE",
          headers: { 
            Authorization: `Bearer ${token}`,
            "X-Tenant-ID": localStorage.getItem("tenant_id") || "2"
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to permanently delete customer");
      }

      console.log(`✅ Customer ${clientId} permanently deleted`);
      alert(`✅ "${businessName}" permanently deleted`);
      loadDeletedCustomers(); // Refresh the list
    } catch (err: any) {
      console.error("❌ Error deleting customer:", err);
      alert(`❌ Failed to delete customer: ${err.message}`);
    }
  };

  const handleViewCustomerDetails = (clientId: number) => {
    router.push(`/dashboard/renewals/${clientId}`);
  };

  // ==========================================
  // LOAD DATA ON MOUNT
  // ==========================================

  useEffect(() => {
    if (!authLoading) {
      loadDeletedLeads();
      loadDeletedCustomers();
    }
  }, [authLoading]);

  // ==========================================
  // FILTER DATA
  // ==========================================

  const filteredLeads = leads.filter((lead) => {
    const searchLower = leadsSearchTerm.toLowerCase();
    return (
      lead.business_name?.toLowerCase().includes(searchLower) ||
      lead.contact_person?.toLowerCase().includes(searchLower) ||
      lead.tel_number?.toLowerCase().includes(searchLower) ||
      lead.email?.toLowerCase().includes(searchLower) ||
      lead.mpan_mpr?.toLowerCase().includes(searchLower)
    );
  });

  const filteredCustomers = customers.filter((customer) => {
    const searchLower = customersSearchTerm.toLowerCase();
    return (
      customer.business_name?.toLowerCase().includes(searchLower) ||
      customer.contact_person?.toLowerCase().includes(searchLower) ||
      customer.phone?.toLowerCase().includes(searchLower) ||
      customer.email?.toLowerCase().includes(searchLower) ||
      customer.mpan_mpr?.toLowerCase().includes(searchLower) ||
      customer.deleted_reason?.toLowerCase().includes(searchLower)
    );
  });

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recycle Bin</CardTitle>
              <CardDescription>
                Deleted leads and customers are shown here
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="leads" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="leads">
                Leads ({filteredLeads.length})
              </TabsTrigger>
              <TabsTrigger value="renewals">
                Renewals ({filteredCustomers.length})
              </TabsTrigger>
            </TabsList>

            {/* ==========================================
                LEADS TAB
                ========================================== */}
            <TabsContent value="leads">
              {/* Search Bar */}
              <div className="mb-4 flex items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search leads..."
                    value={leadsSearchTerm}
                    onChange={(e) => setLeadsSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={loadDeletedLeads}>
                  Refresh
                </Button>
              </div>

              {/* Info Alert */}
              <Alert className="mb-4 border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Lost leads will be permanently removed after 30 days.
                </AlertDescription>
              </Alert>

              {/* Error */}
              {leadsError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{leadsError}</AlertDescription>
                </Alert>
              )}

              {/* Loading */}
              {leadsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : filteredLeads.length === 0 ? (
                <div className="p-12 text-center">
                  <Trash2 className="mx-auto h-16 w-16 text-gray-300" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    {leadsSearchTerm ? "No matching leads" : "No deleted leads"}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {leadsSearchTerm ? "Try adjusting your search" : "Deleted leads will appear here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>ID</TableHead>
                        <TableHead>Contact Person</TableHead>
                        <TableHead>Business Name</TableHead>
                        <TableHead>Tel Number</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>MPAN/MPR</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Deletion</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredLeads.map((lead) => (
                        <TableRow key={lead.opportunity_id}>
                          <TableCell>{lead.opportunity_id}</TableCell>
                          <TableCell>{lead.contact_person || "—"}</TableCell>
                          <TableCell>{lead.business_name || "—"}</TableCell>
                          <TableCell>{lead.tel_number || "—"}</TableCell>
                          <TableCell>{lead.email || "—"}</TableCell>
                          <TableCell>{lead.mpan_mpr || "—"}</TableCell>
                          <TableCell>
                            {lead.start_date ? format(new Date(lead.start_date), "dd/MM/yyyy") : "—"}
                          </TableCell>
                          <TableCell className="text-red-600">
                            {(() => {
                              const daysLeft = getDaysRemaining(lead.created_at);
                              return daysLeft === null ? "—" : `${daysLeft} days remaining`;
                            })()}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleRestoreLead(lead)}
                              disabled={restoringLeadIds[lead.opportunity_id]}
                              className="gap-2"
                            >
                              <RotateCcw className="h-4 w-4" />
                              Restore
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>

            {/* ==========================================
                RENEWALS TAB
                ========================================== */}
            <TabsContent value="renewals">
              {/* Search Bar */}
              <div className="mb-4 flex items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search renewals..."
                    value={customersSearchTerm}
                    onChange={(e) => setCustomersSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button variant="outline" size="sm" onClick={loadDeletedCustomers}>
                  Refresh
                </Button>
              </div>

              {/* Info Alert */}
              <Alert className="mb-4 border-blue-200 bg-blue-50">
                <AlertCircle className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  Deleted customers can be restored or permanently removed from the database.
                </AlertDescription>
              </Alert>

              {/* Error */}
              {customersError && (
                <Alert variant="destructive" className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{customersError}</AlertDescription>
                </Alert>
              )}

              {/* Loading */}
              {customersLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="p-12 text-center">
                  <Trash2 className="mx-auto h-16 w-16 text-gray-300" />
                  <h3 className="mt-4 text-lg font-medium text-gray-900">
                    {customersSearchTerm ? "No matching customers" : "No deleted customers"}
                  </h3>
                  <p className="mt-2 text-sm text-gray-500">
                    {customersSearchTerm ? "Try adjusting your search" : "Deleted customers will appear here"}
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50">
                        <TableHead>Business Name</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Deleted At</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer) => (
                        <TableRow key={customer.client_id}>
                          <TableCell className="font-medium">
                            {customer.business_name || "—"}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <div className="font-medium text-gray-900">
                                {customer.contact_person || "—"}
                              </div>
                              <div className="text-gray-500">{customer.email || "—"}</div>
                            </div>
                          </TableCell>
                          <TableCell>{customer.phone || "—"}</TableCell>
                          <TableCell>
                            <span
                              className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getReasonBadgeColor(
                                customer.deleted_reason
                              )}`}
                            >
                              {customer.deleted_reason}
                            </span>
                          </TableCell>
                          <TableCell>{formatDate(customer.deleted_at)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleViewCustomerDetails(customer.client_id)}
                                title="View Details"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  handleRestoreCustomer(customer.client_id, customer.business_name)
                                }
                                className="text-green-600 hover:bg-green-50 hover:text-green-700"
                                title="Restore"
                              >
                                <RotateCcw className="mr-1 h-4 w-4" />
                                Restore
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() =>
                                  handlePermanentDeleteCustomer(
                                    customer.client_id,
                                    customer.business_name
                                  )
                                }
                                title="Delete Permanently"
                              >
                                <Trash2 className="mr-1 h-4 w-4" />
                                Delete
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}