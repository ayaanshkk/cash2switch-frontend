"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Search,
  Archive,
  ArchiveRestore,
  Eye,
  Calendar,
  Building2,
  Phone,
  MapPin,
  Zap,
  RefreshCw,
  ChevronDown,
  Filter,
  ChevronRight,
  ChevronLeft,
  ChevronLast,
  ChevronFirst,
  Info,
  AlertCircle,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast, Toaster } from "react-hot-toast";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const CUSTOMERS_PER_PAGE = 25;

interface EnergyCustomer {
  id: number;
  client_id: number;
  tenant_client_id?: number;
  display_id?: number;
  name: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email?: string;
  address?: string;
  post_code?: string;
  site_address?: string;
  mpan_top?: string;
  mpan_bottom?: string;
  supplier_id?: number;
  supplier_name?: string;
  annual_usage?: number;
  start_date?: string;
  end_date?: string;
  unit_rate?: number;
  status?: string;
  assigned_to_id?: number;
  assigned_to_name?: string;
  created_at?: string;
  is_archived?: boolean;
  archived_at?: string;
  archived_reason?: string;
}

interface Supplier {
  supplier_id: number;
  supplier_name: string;
}

interface Employee {
  employee_id: number;
  employee_name: string;
  email?: string;
}

const formatDate = (dateString?: string) => {
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

export default function ArchivesPage() {
  const router = useRouter();
  const { user } = useAuth();

  const isAdmin = user?.role === "Platform Admin" || user?.role === "Tenant Super Admin";


  const [allCustomers, setAllCustomers] = useState<EnergyCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<number | "All">("All");
  const [selectedService, setSelectedService] = useState("utilities");
  const [isRestoring, setIsRestoring] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [salespersonFilter, setSalespersonFilter] = useState<number | "All">("All");

  useEffect(() => {
    loadArchives();
    fetchSuppliers();
    fetchEmployees();
  }, [selectedService]);

  useEffect(() => {
  if (isAdmin) {
    loadArchives();
  }
}, [salespersonFilter]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, supplierFilter, sortOrder, salespersonFilter]);

  const loadArchives = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem("auth_token");

    try {
      // ✅ Build query params
      const params = new URLSearchParams({ service: selectedService });
      
      // ✅ Add salesperson filter if admin AND filter is not "All"
      if (isAdmin && salespersonFilter !== "All") {
        params.append("salesperson", salespersonFilter.toString());
      }

      const url = `${API_BASE_URL}/energy-clients/archives?${params.toString()}`;
      
      // ✅ DEBUG LOGS
      console.log("🔍 Loading archives with:");
      console.log("  - isAdmin:", isAdmin);
      console.log("  - salespersonFilter:", salespersonFilter);
      console.log("  - URL:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load archives");

      const data = await response.json();
      
      // ✅ DEBUG LOG
      console.log("✅ Received archives:", data.length, "records");
      if (data.length > 0) {
        console.log("  - First record assigned_to:", data[0].assigned_to_name);
        console.log("  - Sample assigned_to IDs:", data.slice(0, 3).map((c: any) => ({
          id: c.client_id,
          assigned_to_id: c.assigned_to_id,
          assigned_to_name: c.assigned_to_name
        })));
      }
      
      setAllCustomers(data);
    } catch (error) {
      console.error("Error loading archives:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setError(errorMessage);
      setAllCustomers([]);
    } finally {
      setLoading(false);
    }
  };


  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      setSuppliers(Array.isArray(data) ? data : data?.data || []);
    } catch (err) {
      console.error("❌ Error fetching suppliers:", err);
      setSuppliers([]);
    }
  };

  // ✅ ADD THIS FUNCTION
  const fetchEmployees = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/employees`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await response.json();
      const employeesList = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data)
        ? data
        : [];
      setEmployees(employeesList);
    } catch (err) {
      console.error("❌ Error fetching employees:", err);
      setEmployees([]);
    }
  };

  const sortedCustomers = useMemo(() => {
    return [...allCustomers].sort((a, b) => {
      // ✅ Sort by contract end date instead of archived date
      const aDate = new Date(a.end_date || 0).getTime();
      const bDate = new Date(b.end_date || 0).getTime();
      
      if (sortOrder === "newest") {
        return bDate - aDate; // Newest end date first
      } else {
        return aDate - bDate; // Oldest end date first
      }
    });
  }, [allCustomers, sortOrder]);

  const filteredCustomers = useMemo(() => {
    return sortedCustomers.filter((customer) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (customer.business_name || "").toLowerCase().includes(term) ||
        (customer.contact_person || "").toLowerCase().includes(term) ||
        (customer.email || "").toLowerCase().includes(term) ||
        (customer.phone || "").toLowerCase().includes(term) ||
        (customer.mpan_top || "").toLowerCase().includes(term) ||
        (customer.supplier_name || "").toLowerCase().includes(term) ||
        (customer.post_code || "").toLowerCase().includes(term);

      const matchesSupplier = supplierFilter === "All" || customer.supplier_id === supplierFilter;

      return matchesSearch && matchesSupplier;
    });
  }, [sortedCustomers, searchTerm, supplierFilter]);

  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    const endIndex = startIndex + CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage]);

  const handleUnarchive = async (clientId: number) => {
    if (!confirm("Restore this customer from archives to the active list?"))
      return;

    setIsRestoring(clientId);
    const token = localStorage.getItem("auth_token");

    try {
      const response = await fetch(
        `${API_BASE_URL}/energy-clients/${clientId}/unarchive`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        }
      );

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to restore customer");
      }

      toast.success("✅ Customer restored from archives");
      setAllCustomers((prev) => prev.filter((c) => c.client_id !== clientId));
      
      if (paginatedCustomers.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    } catch (error: any) {
      console.error("Error restoring customer:", error);
      toast.error(`Failed to restore: ${error.message}`);
    } finally {
      setIsRestoring(null);
    }
  };

  const handleViewDetails = (clientId: number) => {
    router.push(`/dashboard/renewals/${clientId}`);
  };

  const getSupplierName = (supplierId: number | undefined): string => {
    if (!supplierId) return "—";
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    return supplier?.supplier_name || "—";
  };

  const PaginationControls = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">
            {Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)}
          </span>{" "}
          of <span className="font-medium">{filteredCustomers.length}</span> archived records
        </div>
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First Page"
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            title="Previous Page"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center px-3 text-sm text-gray-700">
            Page {currentPage} of {totalPages}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            title="Next Page"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last Page"
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="w-full p-6">
      <Toaster position="top-right" />
      
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900">
        Archives
      </h1>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur">
          <button
            type="button"
            onClick={() => setSelectedService("utilities")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${
              selectedService === "utilities"
                ? "bg-slate-900 text-white shadow"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Utilities
          </button>
          <button
            type="button"
            onClick={() => setSelectedService("water")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${
              selectedService === "water"
                ? "bg-slate-900 text-white shadow"
                : "text-slate-700 hover:bg-slate-100"
            }`}
          >
            Water
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-2 rounded-lg">
              <Archive className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Archived Records</p>
              <p className="text-2xl font-bold text-gray-900">
                {allCustomers.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Archives</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button 
              onClick={loadArchives} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* ✅ NEW: Search and Filter Bar with Sort AND Salesperson Filter */}
      <div className="mb-6 flex flex-wrap gap-3 justify-between">
        <div className="flex flex-wrap gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Search archives..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Supplier Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {supplierFilter === "All" ? "All Suppliers" : getSupplierName(supplierFilter as number)}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setSupplierFilter("All")}>
                All Suppliers
              </DropdownMenuItem>
              {suppliers.map(supplier => (
                <DropdownMenuItem 
                  key={supplier.supplier_id} 
                  onClick={() => setSupplierFilter(supplier.supplier_id)}
                >
                  {supplier.supplier_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* ✅ NEW: Salesperson Filter (Admin Only) */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline">
                  <Users className="mr-2 h-4 w-4" />
                  {salespersonFilter === "All" 
                    ? "All Salespeople" 
                    : employees.find(e => e.employee_id === salespersonFilter)?.employee_name || "All Salespeople"}
                  <ChevronDown className="ml-1 h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => setSalespersonFilter("All")}>
                  All Salespeople
                </DropdownMenuItem>
                {employees.map(employee => (
                  <DropdownMenuItem 
                    key={employee.employee_id} 
                    onClick={() => setSalespersonFilter(employee.employee_id)}
                  >
                    {employee.employee_name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* Sort Filter */}
          <Select value={sortOrder} onValueChange={(value: "newest" | "oldest") => setSortOrder(value)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="newest">Newest First</SelectItem>
              <SelectItem value="oldest">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={loadArchives}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-20 border-r-2 border-gray-300">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                  Client Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-44">
                  Trading Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                  Tel No
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                  MPAN Top
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  MPAN Bottom
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32">
                  Supplier
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  Annual Usage
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  Contract End
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24">
                  Archived Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-64">
                  Reason
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
                    <p className="mt-4 text-gray-500">Loading archives...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600">Failed to load archives</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-500">
                    <Archive className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-lg">No archived records found</p>
                    <p className="mt-2 text-sm">
                      {searchTerm
                        ? "Try adjusting your search query"
                        : "Archived records will appear here when older contracts are superseded"}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => (
                  <tr
                    key={customer.client_id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => handleViewDetails(customer.client_id)}
                  >
                    {/* ID Column - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top">
                      <div className="whitespace-nowrap">
                        {customer.display_id || customer.tenant_client_id || customer.id}
                      </div>
                    </td>

                    {/* Client Name - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-700 align-top">
                      <div className="break-words max-w-[120px] leading-tight">
                        {customer.contact_person}
                      </div>
                    </td>

                    {/* Trading Name - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="flex items-start gap-1">
                        <span className="break-words max-w-[160px] leading-tight">
                          {customer.business_name}
                        </span>
                      </div>
                    </td>

                    {/* Phone - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">
                        {customer.phone ? String(customer.phone).replace(/\.0$/, '') : '—'}
                      </div>
                    </td>

                    {/* MPAN Top - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">
                        {customer.mpan_top || "—"}
                      </div>
                    </td>

                    {/* MPAN Bottom - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="whitespace-nowrap">
                        {customer.mpan_bottom || "—"}
                      </div>
                    </td>

                    {/* Supplier - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-900 align-top">
                      <div className="break-words max-w-[120px] leading-tight">
                        {customer.supplier_name || "—"}
                      </div>
                    </td>

                    {/* Annual Usage - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-900 text-right align-top">
                      <div className="whitespace-nowrap">
                        {customer.annual_usage ? customer.annual_usage.toLocaleString() : "—"}
                      </div>
                    </td>

                    {/* Contract End - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-700 align-top">
                      <div className="whitespace-nowrap">{formatDate(customer.end_date)}</div>
                    </td>

                    {/* Archived Date - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-700 align-top">
                      <div className="whitespace-nowrap">{formatDate(customer.archived_at)}</div>
                    </td>

                    {/* Reason - matches renewals exactly */}
                    <td className="px-3 py-3 text-sm text-gray-600 align-top">
                      <div className="max-w-[240px] leading-tight" title={customer.archived_reason}>
                        {customer.archived_reason || "—"}
                      </div>
                    </td>

                    {/* Actions - same as before */}
                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(customer.client_id)}
                          title="View Details"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnarchive(customer.client_id)}
                          disabled={isRestoring === customer.client_id}
                          title="Restore from Archives"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                        >
                          {isRestoring === customer.client_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <ArchiveRestore className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {!loading && !error && filteredCustomers.length > 0 && <PaginationControls />}
      </div>
    </div>
  );
}