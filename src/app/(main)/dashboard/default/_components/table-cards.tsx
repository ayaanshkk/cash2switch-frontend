"use client";

import { useState, useEffect } from "react";
import { Download } from "lucide-react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";

import { DataTable } from "@/components/data-table/data-table";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardAction } from "@/components/ui/card";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";
import { fetchWithAuth } from "@/lib/api"; // Import the centralized API helper

// --- Define Types for Fetched Data ---

interface PipelineItem {
  id: string;
  type: "customer" | "job";
  customer: {
    id: string;
    name: string;
    email: string;
    phone: string;
    salesperson: string;
    created_at: string;
    stage: string;
  };
  job?: {
    id: string;
    stage: string;
  };
}

// --- Define Columns for Recent Leads Table ---
export const recentLeadsColumns: ColumnDef<PipelineItem>[] = [
  {
    accessorKey: "customer.name",
    header: "Name",
    cell: ({ row }) => <span>{row.original.customer.name}</span>,
  },
  {
    accessorKey: "customer.email",
    header: "Email",
    cell: ({ row }) => <span>{row.original.customer.email}</span>,
  },
  {
    accessorKey: "customer.phone",
    header: "Phone",
    cell: ({ row }) => <span>{row.original.customer.phone}</span>,
  },
  {
    accessorKey: "customer.salesperson",
    header: "Salesperson",
    cell: ({ row }) => <span>{row.original.customer.salesperson || "N/A"}</span>,
  },
  {
    accessorKey: "customer.created_at",
    header: "Date Added",
    cell: ({ row }) => {
      const date = row.original.customer.created_at;
      return <span>{format(new Date(date), "dd MMM yyyy")}</span>;
    },
  },
];

export function TableCards() {
  const [recentLeads, setRecentLeads] = useState<PipelineItem[]>([]);

  useEffect(() => {
    const fetchRecentLeads = async () => {
      try {
        // Use centralized fetchWithAuth
        const res = await fetchWithAuth("pipeline");

        if (!res.ok) throw new Error("Failed to fetch pipeline data");

        const pipelineItems: PipelineItem[] = await res.json();

        // Filter for items in the 'Lead' stage
        // Sort by creation date, descending, to show newest first
        const newLeads = pipelineItems
          .filter((item) => {
            const stage = item.job?.stage || item.customer.stage;
            return stage === "Lead";
          })
          .sort((a, b) => new Date(b.customer.created_at).getTime() - new Date(a.customer.created_at).getTime());

        setRecentLeads(newLeads);
      } catch (error) {
        console.error("Error fetching recent leads:", error);
      }
    };

    fetchRecentLeads();
  }, []);

  const table = useDataTableInstance({
    data: recentLeads,
    columns: recentLeadsColumns,
    getRowId: (row) => row.id,
  });

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
          <div className="overflow-hidden rounded-md border">
            <DataTable table={table} columns={recentLeadsColumns} />
          </div>
          <DataTablePagination table={table} />
        </CardContent>
      </Card>
    </div>
  );
}
