"use client";

import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Users,
  Phone,
  Mail,
  Calendar,
  Search,
  MoreHorizontal,
  UserPlus,
  Filter,
  TrendingUp,
  DollarSign,
  Activity,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { fetchWithAuth } from "@/lib/api";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  status: "Lead" | "Customer" | "Prospect";
  last_contact?: string;
  value?: number;
}

export default function CRMPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      setLoading(true);
      const response = await fetchWithAuth("customers");

      if (response.ok) {
        const data = await response.json();
        const mappedContacts = data.map((customer: any) => ({
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          company: customer.company,
          status: customer.stage === "Lead" ? "Lead" : "Customer",
          last_contact: customer.updated_at,
          value: customer.estimated_value,
        }));
        setContacts(mappedContacts);
      }
    } catch (error) {
      console.error("Error fetching contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const matchesSearch =
      contact.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      contact.company?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = filterStatus === "all" || contact.status === filterStatus;

    return matchesSearch && matchesStatus;
  });

  const stats = {
    totalContacts: contacts.length,
    leads: contacts.filter((c) => c.status === "Lead").length,
    customers: contacts.filter((c) => c.status === "Customer").length,
    totalValue: contacts.reduce((sum, c) => sum + (c.value || 0), 0),
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="py-12 text-center">Loading CRM data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">CRM</h1>
          <p className="mt-1 text-gray-500">Manage customer relationships and sales pipeline</p>
        </div>
        <Button onClick={() => router.push("/dashboard/clients/new")}>
          <UserPlus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalContacts}</div>
            <p className="text-muted-foreground text-xs">Active contacts in system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Leads</CardTitle>
            <TrendingUp className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.leads}</div>
            <p className="text-muted-foreground text-xs">Potential opportunities</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Customers</CardTitle>
            <Activity className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.customers}</div>
            <p className="text-muted-foreground text-xs">Active customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pipeline Value</CardTitle>
            <DollarSign className="text-muted-foreground h-4 w-4" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.totalValue.toLocaleString()}</div>
            <p className="text-muted-foreground text-xs">Total estimated value</p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 transform text-gray-400" />
              <Input
                placeholder="Search contacts..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filter: {filterStatus === "all" ? "All" : filterStatus}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFilterStatus("all")}>All Contacts</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Lead")}>Leads</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Customer")}>Customers</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setFilterStatus("Prospect")}>Prospects</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      {/* Contacts Table */}
      <Card>
        <CardHeader>
          <CardTitle>Contacts ({filteredContacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Company</TableHead>
                <TableHead>Contact</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Contact</TableHead>
                <TableHead>Value</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredContacts.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-gray-500">
                    No contacts found
                  </TableCell>
                </TableRow>
              ) : (
                filteredContacts.map((contact) => (
                  <TableRow key={contact.id}>
                    <TableCell className="font-medium">{contact.name}</TableCell>
                    <TableCell>{contact.company || "—"}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {contact.email && (
                          <div className="flex items-center text-sm">
                            <Mail className="mr-1 h-3 w-3 text-gray-400" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center text-sm">
                            <Phone className="mr-1 h-3 w-3 text-gray-400" />
                            {contact.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          contact.status === "Customer"
                            ? "default"
                            : contact.status === "Lead"
                              ? "secondary"
                              : "outline"
                        }
                      >
                        {contact.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {contact.last_contact ? new Date(contact.last_contact).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell>{contact.value ? `£${contact.value.toLocaleString()}` : "—"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => router.push(`/dashboard/clients/${contact.id}`)}>
                            View Details
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Mail className="mr-2 h-4 w-4" />
                            Send Email
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Phone className="mr-2 h-4 w-4" />
                            Call
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Calendar className="mr-2 h-4 w-4" />
                            Schedule Meeting
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
