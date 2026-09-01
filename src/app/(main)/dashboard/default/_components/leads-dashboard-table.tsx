"use client";

import { useState, useEffect, useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Eye } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

export interface LeadRow {
  opportunity_id: number;
  business_name: string | null;
  contact_person: string | null;
  tel_number: string | null;
  email: string | null;
  mpan_mpr: string | null;
  stage_name: string | null;
  end_date: string | null;
  annual_usage?: number | null;
  assigned_to_name: string | null;
}

interface LeadsDashboardTableProps {
  employeeId?: number | null;
}

export function LeadsDashboardTable({ employeeId }: LeadsDashboardTableProps) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeads();
  }, [employeeId]);

  const fetchLeads = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      
      // Build query params
      const params = new URLSearchParams({
        service: 'utilities',
        exclude_stage: 'Lost',
      });
      
      if (employeeId) {
        params.append('employee_id', employeeId.toString());
      }

      const response = await fetch(
        `${API_BASE_URL}/api/crm/leads?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (response.ok) {
        const data = await response.json();
        // Handle both array response and {data: []} response format
        const leadsData = Array.isArray(data) ? data : (data.data || []);
        setLeads(leadsData);
      } else {
        console.error("Failed to fetch leads");
        setLeads([]);
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      setLeads([]);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnDef<LeadRow>[] = useMemo(
    () => [
      {
        accessorKey: "opportunity_id",
        header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
        cell: ({ row }) => (
          <span className="font-mono text-sm font-medium text-slate-800">{row.original.opportunity_id}</span>
        ),
      },
      {
        accessorKey: "contact_person",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
        cell: ({ row }) => (
          <div>
            <div className="font-medium text-slate-900">{row.original.contact_person || "—"}</div>
            <div className="max-w-[160px] truncate text-xs text-muted-foreground">
              {row.original.business_name || ""}
            </div>
          </div>
        ),
      },
      {
        accessorKey: "tel_number",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
        cell: ({ row }) => <span className="text-sm">{row.original.tel_number || "—"}</span>,
      },
      {
        accessorKey: "stage_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Stage" />,
        cell: ({ row }) => (
          <Badge variant="outline" className="border-violet-200 bg-violet-50 font-normal text-violet-900">
            {row.original.stage_name || "—"}
          </Badge>
        ),
      },
      {
        accessorKey: "mpan_mpr",
        header: ({ column }) => <DataTableColumnHeader column={column} title="MPAN/MPR" />,
        cell: ({ row }) => (
          <div className="max-w-[160px] truncate font-mono text-sm text-slate-800" title={row.original.mpan_mpr || ""}>
            {row.original.mpan_mpr || "—"}
          </div>
        ),
      },
      {
        accessorKey: "end_date",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Contract end" />,
        cell: ({ row }) => {
          const d = row.original.end_date;
          return (
            <span className="text-sm tabular-nums">
              {d ? format(new Date(d), "dd MMM yyyy") : "—"}
            </span>
          );
        },
      },
      {
        accessorKey: "annual_usage",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Annual usage" />,
        cell: ({ row }) => (
          <div className="text-right">
            <span className="font-medium tabular-nums">
              {row.original.annual_usage != null ? row.original.annual_usage.toLocaleString() : "—"}
            </span>
            <div className="text-xs text-muted-foreground">kWh</div>
          </div>
        ),
      },
      {
        accessorKey: "assigned_to_name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned" />,
        cell: ({ row }) => <span className="text-sm">{row.original.assigned_to_name || "—"}</span>,
      },
      {
        id: "actions",
        cell: ({ row }) => (
          <Button
            variant="outline"
            size="sm"
            className="border-slate-200 bg-white text-slate-800 hover:bg-slate-50 hover:text-slate-900"
            onClick={() => window.open(`/dashboard/leads/${row.original.opportunity_id}`, "_blank", "noopener,noreferrer")}
          >
            <Eye className="h-4 w-4" />
            <span className="ml-1">Open</span>
          </Button>
        ),
        enableSorting: false,
      },
    ],
    []
  );

  const table = useDataTableInstance({
    data: leads,
    columns,
    getRowId: (row, index) => (row.opportunity_id != null ? String(row.opportunity_id) : String(index)),
  });

  if (loading) {
    return (
      <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
        <CardContent className="flex h-64 items-center justify-center">
          <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-violet-600" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl border-0 bg-white shadow-md shadow-slate-200/50 ring-1 ring-slate-100">
      <CardHeader>
        <CardTitle className="text-lg font-bold text-slate-900">
          {employeeId ? "My leads" : "Pipeline leads"}
        </CardTitle>
        <CardDescription>
          {employeeId
            ? "Your active opportunities (Lost excluded)"
            : "Active tenant pipeline — open a lead for full detail"}
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <DataTableViewOptions table={table} />
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex size-full flex-col gap-4">
        {leads.length === 0 ? (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-16 text-center">
            <p className="text-sm font-medium text-slate-600">No leads in pipeline</p>
            <p className="mt-1 max-w-sm text-xs text-slate-500">
              Import leads from the Leads page or adjust filters when data is available.
            </p>
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-lg border border-slate-200/80 bg-slate-50/30">
              <DataTable table={table} columns={columns} />
            </div>
            <DataTablePagination table={table} />
          </>
        )}
      </CardContent>
    </Card>
  );
}
