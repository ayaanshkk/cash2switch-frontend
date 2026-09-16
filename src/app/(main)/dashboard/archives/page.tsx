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
  Trash2,
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
  const [selectedArchives, setSelectedArchives] = useState<number[]>([]);
  const [isSelectAllChecked, setIsSelectAllChecked] = useState(false);
  const [isDeletingArchives, setIsDeletingArchives] = useState(false);

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
      const params = new URLSearchParams({ service: selectedService });
      
      if (isAdmin && salespersonFilter !== "All") {
        params.append("salesperson", salespersonFilter.toString());
      }

      const url = `${API_BASE_URL}/energy-clients/archives?${params.toString()}`;

      console.log("🔍 Loading archives with:");
      console.log("  - isAdmin:", isAdmin);
      console.log("  - salespersonFilter:", salespersonFilter);
      console.log("  - URL:", url);

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) throw new Error("Failed to load archives");

      const data = await response.json();

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
      const aDate = new Date(a.end_date || 0).getTime();
      const bDate = new Date(b.end_date || 0).getTime();
      
      if (sortOrder === "newest") {
        return bDate - aDate;
      } else {
        return aDate - bDate;
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
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 dark:bg-slate-900 border-t border-gray-200 dark:border-slate-800">
        <div className="text-sm text-gray-700 dark:text-slate-300">
          Showing <span className="font-medium text-gray-900 dark:text-white">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium text-gray-900 dark:text-white">
            {Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)}
          </span>{" "}
          of <span className="font-medium text-gray-900 dark:text-white">{filteredCustomers.length}</span> archived records
        </div>
        <div className="flex space-x-1">
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            title="First Page"
            className="dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronFirst className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
            disabled={currentPage === 1}
            title="Previous Page"
            className="dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          
          <div className="flex items-center px-3 text-sm text-gray-700 dark:text-slate-300">
            Page {currentPage} of {totalPages}
          </div>
          
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
            disabled={currentPage === totalPages}
            title="Next Page"
            className="dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            onClick={() => setCurrentPage(totalPages)}
            disabled={currentPage === totalPages}
            title="Last Page"
            className="dark:border-slate-700 dark:hover:bg-slate-800"
          >
            <ChevronLast className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const handleSelectArchive = (clientId: number) => {
    setSelectedArchives(prev => {
      const next = prev.includes(clientId)
        ? prev.filter(id => id !== clientId)
        : [...prev, clientId];
      setIsSelectAllChecked(next.length === filteredCustomers.length);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (isSelectAllChecked) {
      setSelectedArchives([]);
      setIsSelectAllChecked(false);
    } else {
      setSelectedArchives(filteredCustomers.map(c => c.client_id));
      setIsSelectAllChecked(true);
    }
  };

  const handleDeleteSelected = async () => {
    if (!selectedArchives.length) return;
    if (!confirm(`Permanently delete ${selectedArchives.length} archived record(s)? This cannot be undone.`)) return;

    setIsDeletingArchives(true);
    const token = localStorage.getItem("auth_token");

    try {
      await Promise.all(
        selectedArchives.map(clientId =>
          fetch(`${API_BASE_URL}/energy-clients/${clientId}/permanent-delete`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` },
          })
        )
      );
      setAllCustomers(prev => prev.filter(c => !selectedArchives.includes(c.client_id)));
      setSelectedArchives([]);
      setIsSelectAllChecked(false);
      toast.success(`✅ Deleted ${selectedArchives.length} archived record(s)`);
    } catch (err) {
      toast.error("Failed to delete some records");
    } finally {
      setIsDeletingArchives(false);
    }
  };

  return (
    <div className="w-full max-w-full overflow-x-hidden p-6 text-slate-900 dark:text-slate-100">
      <Toaster position="top-right" />
      
      <h1 className="mb-6 text-4xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
        Archives
      </h1>

      {/* Service Tabs */}
      <div className="mb-6 flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white/80 p-1 shadow-sm backdrop-blur dark:border-slate-800 dark:bg-slate-900/80">
          <button
            type="button"
            onClick={() => setSelectedService("utilities")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${
              selectedService === "utilities"
                ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Utilities
          </button>
          <button
            type="button"
            onClick={() => setSelectedService("water")}
            className={`px-8 py-3 rounded-full text-base font-semibold transition-all ${
              selectedService === "water"
                ? "bg-slate-900 text-white shadow dark:bg-slate-100 dark:text-slate-900"
                : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
            }`}
          >
            Water
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6">
        <div className="bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-lg p-4 dark:from-orange-950/20 dark:to-amber-950/20 dark:border-orange-900/40">
          <div className="flex items-center gap-3">
            <div className="bg-orange-600 p-2 rounded-lg dark:bg-orange-500">
              <Archive className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-orange-200/70">Archived Records</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-orange-50">
                {allCustomers.length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3 dark:bg-red-950/30 dark:border-red-900/50">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-300">Error Loading Archives</h3>
            <p className="mt-1 text-sm text-red-700 dark:text-red-400">{error}</p>
            <Button 
              onClick={loadArchives} 
              variant="outline" 
              size="sm" 
              className="mt-3 dark:border-red-800 dark:hover:bg-red-950/50"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="mb-6 grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_auto]">
        <div className="grid min-w-0 grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-3">
          <div className="relative min-w-0 sm:col-span-2 xl:col-span-1">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4 dark:text-slate-400" />
            <Input
              placeholder="Search archives..."
              className="pl-8 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Supplier Filter */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="min-w-0 justify-between dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
                <Filter className="mr-2 h-4 w-4" />
                <span className="truncate">{supplierFilter === "All" ? "All Suppliers" : getSupplierName(supplierFilter as number)}</span>
                <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="dark:bg-slate-900 dark:border-slate-800">
              <DropdownMenuItem className="dark:hover:bg-slate-800" onClick={() => setSupplierFilter("All")}>
                All Suppliers
              </DropdownMenuItem>
              {suppliers.map(supplier => (
                <DropdownMenuItem 
                  key={supplier.supplier_id} 
                  className="dark:hover:bg-slate-800"
                  onClick={() => setSupplierFilter(supplier.supplier_id)}
                >
                  {supplier.supplier_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Salesperson Filter (Admin Only) */}
          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="min-w-0 justify-between dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
                  <Users className="mr-2 h-4 w-4" />
                  <span className="truncate">
                    {salespersonFilter === "All" 
                      ? "All Salespeople" 
                      : employees.find(e => e.employee_id === salespersonFilter)?.employee_name || "All Salespeople"}
                  </span>
                  <ChevronDown className="ml-1 h-3 w-3 flex-shrink-0" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="dark:bg-slate-900 dark:border-slate-800">
                <DropdownMenuItem className="dark:hover:bg-slate-800" onClick={() => setSalespersonFilter("All")}>
                  All Salespeople
                </DropdownMenuItem>
                {employees.map(employee => (
                  <DropdownMenuItem 
                    key={employee.employee_id} 
                    className="dark:hover:bg-slate-800"
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
            <SelectTrigger className="w-full min-w-0 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="dark:bg-slate-900 dark:border-slate-800">
              <SelectItem value="newest" className="dark:hover:bg-slate-800">Newest First</SelectItem>
              <SelectItem value="oldest" className="dark:hover:bg-slate-800">Oldest First</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {selectedArchives.length > 0 && (
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={isDeletingArchives}
            >
              {isDeletingArchives ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting...</>
              ) : (
                <>Delete Selected ({selectedArchives.length})</>
              )}
            </Button>
          )}
          <Button variant="outline" onClick={loadArchives} disabled={loading} className="dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800">
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full divide-y divide-gray-200 dark:divide-slate-800">
            <thead className="bg-gray-50 dark:bg-slate-800/60">
              <tr>
                <th className="px-3 py-3 text-left w-8">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:checked:bg-primary"
                    checked={isSelectAllChecked}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-20 border-r-2 border-gray-300 dark:border-slate-700 dark:text-slate-400">
                  ID
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32 dark:text-slate-400">
                  Client Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-44 dark:text-slate-400">
                  Trading Name
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28 dark:text-slate-400">
                  Tel No
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32 dark:text-slate-400">
                  MPAN Top
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24 dark:text-slate-400">
                  MPAN Bottom
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-32 dark:text-slate-400">
                  Supplier
                </th>
                <th className="px-3 py-3 text-right text-xs font-medium tracking-wider text-gray-500 uppercase w-24 dark:text-slate-400">
                  Annual Usage
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24 dark:text-slate-400">
                  Contract End
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-24 dark:text-slate-400">
                  Archived Date
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-64 dark:text-slate-400">
                  Reason
                </th>
                <th className="px-3 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase w-28 dark:text-slate-400">
                  Actions
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white dark:divide-slate-800 dark:bg-slate-900">
              {loading ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600 dark:text-slate-400"></div>
                    <p className="mt-4 text-gray-500 dark:text-slate-400">Loading archives...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600 dark:text-red-400">Failed to load archives</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={13} className="px-6 py-12 text-center text-gray-500 dark:text-slate-400">
                    <Archive className="h-12 w-12 text-gray-400 dark:text-slate-500 mx-auto mb-3" />
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
                    className={`hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${
                      selectedArchives.includes(customer.client_id) ? 'bg-blue-50 dark:bg-blue-950/40' : ''
                    }`}
                    onClick={() => handleViewDetails(customer.client_id)}
                  >
                    <td className="px-3 py-3 align-top" onClick={e => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        className="rounded border-gray-300 dark:border-slate-700 dark:bg-slate-800 dark:checked:bg-primary mt-1"
                        checked={selectedArchives.includes(customer.client_id)}
                        onChange={() => handleSelectArchive(customer.client_id)}
                      />
                    </td>

                    <td className="px-3 py-3 text-sm font-medium text-gray-900 border-r-2 border-gray-300 align-top dark:border-slate-700 dark:text-slate-200">
                      <div className="whitespace-nowrap">
                        {customer.display_id || customer.tenant_client_id || customer.id}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-700 align-top dark:text-slate-300">
                      <div className="break-words max-w-[120px] leading-tight">
                        {customer.contact_person}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-900 align-top dark:text-slate-200">
                      <div className="flex items-start gap-1">
                        <span className="break-words max-w-[160px] leading-tight font-medium">
                          {customer.business_name}
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-900 align-top dark:text-slate-300">
                      <div className="whitespace-nowrap">
                        {customer.phone ? String(customer.phone).replace(/\.0$/, '') : '—'}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-900 align-top dark:text-slate-300">
                      <div className="whitespace-nowrap font-mono text-xs">
                        {customer.mpan_top || "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-900 align-top dark:text-slate-300">
                      <div className="whitespace-nowrap font-mono text-xs">
                        {customer.mpan_bottom || "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-900 align-top dark:text-slate-200">
                      <div className="break-words max-w-[120px] leading-tight">
                        {customer.supplier_name || "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-900 text-right align-top dark:text-slate-300">
                      <div className="whitespace-nowrap font-mono">
                        {customer.annual_usage ? customer.annual_usage.toLocaleString() : "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-700 align-top dark:text-slate-300">
                      <div className="whitespace-nowrap">{formatDate(customer.end_date)}</div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-700 align-top dark:text-slate-300">
                      <div className="whitespace-nowrap">{formatDate(customer.archived_at)}</div>
                    </td>

                    <td className="px-3 py-3 text-sm text-gray-600 align-top dark:text-slate-400">
                      <div className="max-w-[240px] leading-tight" title={customer.archived_reason}>
                        {customer.archived_reason || "—"}
                      </div>
                    </td>

                    <td className="px-3 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetails(customer.client_id)}
                          title="View Details"
                          className="text-slate-700 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800"
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleUnarchive(customer.client_id)}
                          disabled={isRestoring === customer.client_id}
                          title="Restore from Archives"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:text-green-300 dark:hover:bg-green-950/40"
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