"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ColumnDef } from "@tanstack/react-table";
import { format } from "date-fns";
import { Eye, Phone, Mail, AlertTriangle } from "lucide-react";

import { DataTable } from "@/components/data-table/data-table";
import { DataTableColumnHeader } from "@/components/data-table/data-table-column-header";
import { DataTablePagination } from "@/components/data-table/data-table-pagination";
import { DataTableViewOptions } from "@/components/data-table/data-table-view-options";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardAction } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useDataTableInstance } from "@/hooks/use-data-table-instance";
import { cn } from "@/lib/utils";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

interface RenewalCustomer {
  client_id: number;
  contact_person: string;
  business_name: string;
  phone: string;
  email: string;
  supplier_name: string;
  end_date: string;
  annual_usage: number;
  days_until_expiry: number;
  status: string;
  assigned_to_name: string;
}

const getUrgencyColor = (days: number) => {
  if (days <= 30) return "text-red-600 bg-red-50 border-red-200";
  if (days <= 60) return "text-orange-600 bg-orange-50 border-orange-200";
  return "text-yellow-600 bg-yellow-50 border-yellow-200";
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "contacted":
    case "called":
      return "bg-blue-100 text-blue-700";
    case "renewed":
    case "priced":
      return "bg-green-100 text-green-700";
    case "lost":
      return "bg-red-100 text-red-700";
    case "not_answered":
      return "bg-yellow-100 text-yellow-700";
    default:
      return "bg-gray-100 text-gray-700";
  }
};

export function RenewalsTable() {
  const router = useRouter();
  const [renewals, setRenewals] = useState<RenewalCustomer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchRenewals();
  }, []);

  const fetchRenewals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");

      const response = await fetch(`${API_BASE_URL}/energy-renewals`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const data = await response.json();
        setRenewals(data);
      }
    } catch (error) {
      console.error("Error fetching renewals:", error);
    } finally {
      setLoading(false);
    }
  };

  const columns: ColumnDef<RenewalCustomer>[] = [
    {
      id: "select",
      header: ({ table }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
            aria-label="Select all"
          />
        </div>
      ),
      cell: ({ row }) => (
        <div className="flex items-center justify-center">
          <Checkbox
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
            aria-label="Select row"
          />
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
    },
    {
      accessorKey: "client_id",
      header: ({ column }) => <DataTableColumnHeader column={column} title="ID" />,
      cell: ({ row }) => (
        <span className="font-mono text-sm font-medium">{row.original.client_id}</span>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "contact_person",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Contact" />,
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.contact_person}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[150px]">
            {row.original.business_name}
          </div>
        </div>
      ),
      enableHiding: false,
    },
    {
      accessorKey: "phone",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Phone" />,
      cell: ({ row }) => (
        <a
          href={`tel:${row.original.phone}`}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700"
        >
          <Phone className="h-3 w-3" />
          <span className="text-sm">{row.original.phone}</span>
        </a>
      ),
    },
    {
      accessorKey: "email",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Email" />,
      cell: ({ row }) => (
        <a
          href={`mailto:${row.original.email}`}
          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 truncate max-w-[180px]"
        >
          <Mail className="h-3 w-3 flex-shrink-0" />
          <span className="text-sm truncate">{row.original.email}</span>
        </a>
      ),
    },
    {
      accessorKey: "supplier_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Supplier" />,
      cell: ({ row }) => (
        <Badge variant="outline" className="font-normal">
          {row.original.supplier_name}
        </Badge>
      ),
    },
    {
      accessorKey: "end_date",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Expiry Date" />,
      cell: ({ row }) => {
        const days = row.original.days_until_expiry;
        return (
          <div className="space-y-1">
            <div className="text-sm font-medium">
              {format(new Date(row.original.end_date), "dd MMM yyyy")}
            </div>
            <Badge className={cn("text-xs", getUrgencyColor(days))}>
              <AlertTriangle className="h-3 w-3 mr-1" />
              {days} days
            </Badge>
          </div>
        );
      },
    },
    {
      accessorKey: "annual_usage",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Annual Usage" />,
      cell: ({ row }) => (
        <div className="text-right">
          <div className="font-semibold">
            {row.original.annual_usage?.toLocaleString() || "—"}
          </div>
          <div className="text-xs text-muted-foreground">kWh/year</div>
        </div>
      ),
    },
    {
      accessorKey: "status",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
      cell: ({ row }) => (
        <Badge className={getStatusColor(row.original.status)}>
          {row.original.status || "Pending"}
        </Badge>
      ),
    },
    {
      accessorKey: "assigned_to_name",
      header: ({ column }) => <DataTableColumnHeader column={column} title="Assigned To" />,
      cell: ({ row }) => (
        <span className="text-sm">{row.original.assigned_to_name || "Unassigned"}</span>
      ),
    },
    {
      id: "actions",
      cell: ({ row }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/dashboard/renewals/${row.original.client_id}`)}
        >
          <Eye className="h-4 w-4" />
          <span className="ml-1">View</span>
        </Button>
      ),
      enableSorting: false,
    },
  ];

  const table = useDataTableInstance({
    data: renewals,
    columns,
    getRowId: (row) => row.client_id.toString(),
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Renewals</CardTitle>
        <CardDescription>
          Customers with contracts expiring in the next 90 days
        </CardDescription>
        <CardAction>
          <div className="flex items-center gap-2">
            <DataTableViewOptions table={table} />
            <Button variant="outline" size="sm" onClick={fetchRenewals}>
              Refresh
            </Button>
          </div>
        </CardAction>
      </CardHeader>
      <CardContent className="flex size-full flex-col gap-4">
        <div className="overflow-hidden rounded-md border">
          <DataTable table={table} columns={columns} />
        </div>
        <DataTablePagination table={table} />
      </CardContent>
    </Card>
  );
}