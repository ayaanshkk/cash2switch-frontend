"use client";

import { Download, Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardAction } from "@/components/ui/card";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";
import { fetchWithAuth } from "@/lib/api";

import { recentLeadsColumns } from "./columns.crm";
import { generateRecentLeadsData } from "./crm.config";

// Define the interface for accepted customers
interface AcceptedCustomer {
  id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  salesperson: string;
  project_count: number;
  created_at: string;
  stage: string;
}

export function TableCards() {
  const router = useRouter();
  const [userRole, setUserRole] = useState<string | null>(null);
  const [acceptedCustomers, setAcceptedCustomers] = useState<AcceptedCustomer[]>([]);
  const [recentLeads, setRecentLeads] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Get user role from localStorage or context
  useEffect(() => {
    const role = localStorage.getItem("user_role");
    setUserRole(role);
  }, []);

  // Fetch data based on role
  useEffect(() => {
    if (userRole === "Production") {
      fetchAcceptedCustomers();
    } else {
      fetchRecentLeads();
    }
  }, [userRole]);

  const fetchAcceptedCustomers = async () => {
    try {
      const response = await fetchWithAuth("customers");

      if (response.ok) {
        const customers: AcceptedCustomer[] = await response.json();
        // Filter only customers in "Accepted" stage
        const accepted = customers.filter((customer) => customer.stage === "Accepted");
        setAcceptedCustomers(accepted);
      }
    } catch (error) {
      console.error("Error fetching accepted customers:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRecentLeads = async () => {
    try {
      const response = await fetchWithAuth("pipeline");

      if (response.ok) {
        const pipelineData = await response.json();
        // Generate recent leads from pipeline data
        const leads = generateRecentLeadsData(pipelineData);
        setRecentLeads(leads);
      }
    } catch (error) {
      console.error("Error fetching recent leads:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCustomerClick = (customerId: string) => {
    router.push(`/dashboard/clients/${customerId}`);
  };

  const handleProjectTimelineClick = (customerId: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent row click
    router.push(`/dashboard/clients/${customerId}?tab=timeline`);
  };

  // For non-production users, show the regular Recent Leads table
  const table = useDataTableInstance({
    data: recentLeads,
    columns: recentLeadsColumns,
    getRowId: (row) => row.id.toString(),
  });

  // Production View - Show Accepted Customers
  if (userRole === "Production") {
    return (
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
        <Card>
          <CardHeader>
            <CardTitle>Accepted Customers</CardTitle>
            <CardDescription>Customers ready for production - order materials and track progress.</CardDescription>
            <CardAction>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fetchAcceptedCustomers()}>
                  Refresh
                </Button>
                <Button variant="outline" size="sm">
                  <Download />
                  <span className="hidden lg:inline">Export</span>
                </Button>
              </div>
            </CardAction>
          </CardHeader>
          <CardContent className="flex size-full flex-col gap-4">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground text-sm">Loading accepted customers...</p>
              </div>
            ) : acceptedCustomers.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <p className="text-muted-foreground text-sm">No customers in Accepted stage.</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-md border">
                <table className="w-full">
                  <thead className="bg-muted/50 border-b">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Email</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Phone</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Salesperson</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Projects</th>
                      <th className="px-4 py-3 text-left text-sm font-medium">Date Added</th>
                      <th className="px-4 py-3 text-center text-sm font-medium">Timeline</th>
                    </tr>
                  </thead>
                  <tbody>
                    {acceptedCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b transition-colors hover:bg-muted/50 cursor-pointer"
                        onClick={() => handleCustomerClick(customer.id)}
                      >
                        <td className="px-4 py-3 text-sm font-medium">{customer.name}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{customer.email || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{customer.phone || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{customer.salesperson || "—"}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{customer.project_count}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {customer.created_at
                            ? new Date(customer.created_at).toLocaleDateString("en-GB", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                              })
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleProjectTimelineClick(customer.id, e)}
                            className="hover:bg-primary/10"
                          >
                            <Calendar className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Regular View - Show Recent Leads (for other roles)
  return (
    <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:shadow-xs">
      <Card>
        <CardHeader>
          <CardTitle>Recent Leads</CardTitle>
          <CardDescription>Track and manage your latest leads and their status.</CardDescription>
          <CardAction>
            <div className="flex items-center gap-2">
              <DataTableViewOptions table={table} />
              <Button variant="outline" size="sm">
                <Download />
                <span className="hidden lg:inline">Export</span>
              </Button>
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="flex size-full flex-col gap-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm">Loading recent leads...</p>
            </div>
          ) : recentLeads.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <p className="text-muted-foreground text-sm">No recent leads found.</p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-md border">
                <DataTable table={table} columns={recentLeadsColumns} />
              </div>
              <DataTablePagination table={table} />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}