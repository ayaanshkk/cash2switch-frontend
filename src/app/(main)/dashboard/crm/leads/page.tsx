"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  Search,
  Filter,
  Phone,
  ChevronLeft,
  ChevronRight,
  Plus,
} from "lucide-react";
import { api } from "@/lib/api";

interface Lead {
  opportunity_id: number;
  client_id: number;
  business_name: string;
  contact_person: string;
  phone: string;
  email: string;
  lead_status: string;
  assigned_employee: string;
  assigned_employee_id: number;
  customer_type: "NEW" | "EXISTING";
  last_call_date: string | null;
  last_call_result: string | null;
  next_follow_up_date: string | null;
  opportunity_value: number;
  opportunity_title: string;
  annual_usage?: number; // Will need to be added or mapped
  supplier?: string; // Will need to be added or mapped
}

export default function LeadsPage() {
  const [activeTab, setActiveTab] = useState<"NEW" | "EXISTING">("NEW");
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [leadStatusFilter, setLeadStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  
  // Call Summary Form State
  const [callStatus, setCallStatus] = useState<string>("Phone");
  const [callResult, setCallResult] = useState<string>("");
  const [remarks, setRemarks] = useState<string>("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState<string>("");
  
  const itemsPerPage = 10;

  useEffect(() => {
    fetchLeads();
  }, [activeTab, leadStatusFilter, currentPage]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      if (leadStatusFilter !== "all") {
        filters.lead_status = leadStatusFilter;
      }
      
      const response = await api.getLeadsByCustomerType(activeTab, filters);
      
      if (response.success && response.data) {
        setLeads(response.data);
        setTotalPages(Math.ceil(response.data.length / itemsPerPage));
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateCallSummary = async () => {
    if (!selectedClientId) return;
    
    try {
      await api.createCallSummary(selectedClientId, {
        call_status: callStatus,
        call_result: callResult,
        remarks: remarks,
        next_follow_up_date: nextFollowUpDate || undefined,
      });
      
      // Reset form and close modal
      setCallStatus("Phone");
      setCallResult("");
      setRemarks("");
      setNextFollowUpDate("");
      setIsCallModalOpen(false);
      setSelectedClientId(null);
      
      // Refresh leads to show updated call info
      fetchLeads();
    } catch (error) {
      console.error("Error creating call summary:", error);
      alert("Failed to create call summary. Please try again.");
    }
  };

  const openCallModal = (clientId: number) => {
    setSelectedClientId(clientId);
    setIsCallModalOpen(true);
  };

  const filteredLeads = leads.filter((lead) => {
    const matchesSearch =
      lead.business_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead.phone?.includes(searchTerm) ||
      lead.email?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const paginatedLeads = filteredLeads.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const getStatusBadgeVariant = (status: string) => {
    const statusLower = status?.toLowerCase() || "";
    if (statusLower.includes("won") || statusLower.includes("complete")) {
      return "default";
    } else if (statusLower.includes("lost") || statusLower.includes("rejected")) {
      return "destructive";
    } else {
      return "secondary";
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="py-12 text-center">Loading leads...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Leads Management</h1>
          <p className="mt-1 text-gray-500">Manage new and existing customer leads</p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(value) => {
        setActiveTab(value as "NEW" | "EXISTING");
        setCurrentPage(1);
      }}>
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="NEW">New Customers</TabsTrigger>
          <TabsTrigger value="EXISTING">Existing Customers</TabsTrigger>
        </TabsList>

        <TabsContent value="NEW" className="space-y-4">
          <LeadsTable
            leads={paginatedLeads}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            leadStatusFilter={leadStatusFilter}
            setLeadStatusFilter={setLeadStatusFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            totalLeads={filteredLeads.length}
            openCallModal={openCallModal}
            getStatusBadgeVariant={getStatusBadgeVariant}
          />
        </TabsContent>

        <TabsContent value="EXISTING" className="space-y-4">
          <LeadsTable
            leads={paginatedLeads}
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            leadStatusFilter={leadStatusFilter}
            setLeadStatusFilter={setLeadStatusFilter}
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
            totalPages={totalPages}
            totalLeads={filteredLeads.length}
            openCallModal={openCallModal}
            getStatusBadgeVariant={getStatusBadgeVariant}
          />
        </TabsContent>
      </Tabs>

      {/* Call Summary Modal */}
      <Dialog open={isCallModalOpen} onOpenChange={setIsCallModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Log Call Summary</DialogTitle>
            <DialogDescription>
              Record details of your call with this client
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="call-status">Call Status</Label>
              <Select value={callStatus} onValueChange={setCallStatus}>
                <SelectTrigger>
                  <SelectValue placeholder="Select call status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Meeting">Meeting</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="call-result">Call Result</Label>
              <Textarea
                id="call-result"
                placeholder="Brief summary of the call outcome..."
                value={callResult}
                onChange={(e) => setCallResult(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="remarks">Remarks</Label>
              <Textarea
                id="remarks"
                placeholder="Additional notes or remarks..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={3}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="next-follow-up">Next Follow-up Date</Label>
              <Input
                id="next-follow-up"
                type="date"
                value={nextFollowUpDate}
                onChange={(e) => setNextFollowUpDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCallModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateCallSummary}>
              Save Call Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Separate component for table content to avoid duplication
function LeadsTable({
  leads,
  searchTerm,
  setSearchTerm,
  leadStatusFilter,
  setLeadStatusFilter,
  currentPage,
  setCurrentPage,
  totalPages,
  totalLeads,
  openCallModal,
  getStatusBadgeVariant,
}: {
  leads: Lead[];
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  leadStatusFilter: string;
  setLeadStatusFilter: (value: string) => void;
  currentPage: number;
  setCurrentPage: (value: number) => void;
  totalPages: number;
  totalLeads: number;
  openCallModal: (clientId: number) => void;
  getStatusBadgeVariant: (status: string) => "default" | "secondary" | "destructive";
}) {
  return (
    <>
      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <Input
                placeholder="Search by name, business, phone, or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={leadStatusFilter} onValueChange={setLeadStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="Lead">Lead</SelectItem>
                <SelectItem value="Proposal">Proposal</SelectItem>
                <SelectItem value="Won">Won</SelectItem>
                <SelectItem value="Site Survey">Site Survey</SelectItem>
                <SelectItem value="Procurement">Procurement</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Leads Table */}
      <Card>
        <CardHeader>
          <CardTitle>Leads ({totalLeads})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client ID</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Business Name</TableHead>
                <TableHead>Contact Person</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Annual Usage</TableHead>
                <TableHead>Lead Status</TableHead>
                <TableHead>Assigned Employee</TableHead>
                <TableHead>Last Call Result</TableHead>
                <TableHead>Next Follow-up</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={12} className="py-8 text-center text-gray-500">
                    No leads found
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <TableRow key={lead.opportunity_id}>
                    <TableCell className="font-medium">{lead.client_id}</TableCell>
                    <TableCell>{lead.contact_person || "—"}</TableCell>
                    <TableCell>{lead.business_name || "—"}</TableCell>
                    <TableCell>{lead.contact_person || "—"}</TableCell>
                    <TableCell>{lead.phone || "—"}</TableCell>
                    <TableCell>{lead.supplier || "—"}</TableCell>
                    <TableCell>{lead.annual_usage ? `${lead.annual_usage.toLocaleString()} kWh` : "—"}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(lead.lead_status)}>
                        {lead.lead_status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell>{lead.assigned_employee || "—"}</TableCell>
                    <TableCell className="max-w-[200px] truncate">
                      {lead.last_call_result || "—"}
                    </TableCell>
                    <TableCell>
                      {lead.next_follow_up_date
                        ? new Date(lead.next_follow_up_date).toLocaleDateString()
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openCallModal(lead.client_id)}
                      >
                        <Phone className="mr-2 h-4 w-4" />
                        Log Call
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-500">
                Showing {(currentPage - 1) * 10 + 1} to {Math.min(currentPage * 10, totalLeads)} of {totalLeads} leads
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
