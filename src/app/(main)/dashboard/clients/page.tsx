"use client";

import React, { useState, useEffect, useMemo } from "react";
import { 
  Search, Plus, Edit, Trash2, ChevronDown, Filter, AlertCircle, 
  ChevronRight, ChevronLeft, ChevronLast, ChevronFirst, Zap, Building2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import { CreateCustomerModal } from "@/components/ui/CreateCustomerModal";
import { useAuth } from "@/contexts/AuthContext";

// ---------------- Constants ----------------
const CUSTOMERS_PER_PAGE = 25;
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000";

// ---------------- Types ----------------
interface EnergyCustomer {
  id: number;
  client_id: number;
  name: string;
  business_name: string;
  contact_person: string;
  phone: string;
  email?: string;
  address?: string;
  site_address?: string;
  
  // Energy specific fields
  mpan_mpr?: string;
  supplier_id?: number;
  supplier_name?: string;
  annual_usage?: number;
  start_date?: string;
  end_date?: string;
  unit_rate?: number;
  
  // Pipeline fields
  status?: string;
  stage_id?: number;
  opportunity_id?: number;
  
  // Assignment
  assigned_to_id?: number;
  assigned_to_name?: string;
  
  // Callback
  callback_date?: string;
  last_contact_date?: string;
  
  created_at: string;
}

interface Supplier {
  supplier_id: number;
  supplier_name: string;
  provisions: number;
  provisions_text: string;
}

interface Stage {
  stage_id: number;
  stage_name: string;
  description?: string;
}

// ---------------- Utility functions ----------------
const getStageColor = (stageName: string): string => {
  const lowerStage = stageName?.toLowerCase() || '';
  
  if (lowerStage.includes('lead') || lowerStage.includes('prospect')) {
    return "bg-gray-100 text-gray-800";
  }
  if (lowerStage.includes('quote') || lowerStage.includes('proposal')) {
    return "bg-blue-100 text-blue-800";
  }
  if (lowerStage.includes('negotiation')) {
    return "bg-yellow-100 text-yellow-800";
  }
  if (lowerStage.includes('won') || lowerStage.includes('active') || lowerStage.includes('converted')) {
    return "bg-green-100 text-green-800";
  }
  if (lowerStage.includes('lost') || lowerStage.includes('closed')) {
    return "bg-red-100 text-red-800";
  }
  
  return "bg-gray-100 text-gray-800";
};

const formatDate = (dateString: string | undefined): string => {
  if (!dateString) return "—";
  try {
    return new Date(dateString).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  } catch {
    return "—";
  }
};

const formatUsage = (usage: number | undefined): string => {
  if (!usage) return "—";
  return `${usage.toLocaleString()} kWh`;
};

// ---------------- Component ----------------
export default function EnergyCustomersPage() {
  const [allCustomers, setAllCustomers] = useState<EnergyCustomer[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [supplierFilter, setSupplierFilter] = useState<number | "All">("All");
  const [stageFilter, setStageFilter] = useState<number | "All">("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { user } = useAuth();

  // Fetch data initially
  useEffect(() => {
    fetchCustomers();
    fetchSuppliers();
    fetchStages();
  }, []);

  // Reset page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, supplierFilter, stageFilter]);

  // ---------------- Fetch Functions ----------------
  const fetchCustomers = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem("auth_token");
      if (!token) {
        setError("No authentication token found. Please log in.");
        setIsLoading(false);
        return;
      }

      console.log("🔄 Fetching energy customers from:", `${API_BASE_URL}/clients`);
      
      const response = await fetch(`${API_BASE_URL}/energy-clients`, {
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });

      console.log("📡 Response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        
        let errorMessage = "Failed to fetch energy clients";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`✅ Energy customers received: ${data.length} customers`, data);

      setAllCustomers(data);

    } catch (err) {
      console.error("❌ Error fetching energy clients:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setAllCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setSuppliers(data);
        console.log("✅ Suppliers loaded:", data.length);
      }
    } catch (err) {
      console.error("❌ Error fetching suppliers:", err);
    }
  };

  const fetchStages = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(`${API_BASE_URL}/stages`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (response.ok) {
        const data = await response.json();
        setStages(data);
        console.log("✅ Stages loaded:", data.length);
      }
    } catch (err) {
      console.error("❌ Error fetching stages:", err);
    }
  };

  // ✅ Sort customers by most recent first
  const sortedCustomers = useMemo(() => {
    return [...allCustomers].sort((a, b) => {
      const aDate = new Date(a.created_at).getTime();
      const bDate = new Date(b.created_at).getTime();
      return bDate - aDate;
    });
  }, [allCustomers]);

  // ✅ Apply search and filters
  const filteredCustomers = useMemo(() => {
    return sortedCustomers.filter((customer) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (customer.business_name || "").toLowerCase().includes(term) ||
        (customer.contact_person || "").toLowerCase().includes(term) ||
        (customer.email || "").toLowerCase().includes(term) ||
        (customer.phone || "").toLowerCase().includes(term) ||
        (customer.mpan_mpr || "").toLowerCase().includes(term);

      const matchesSupplier = supplierFilter === "All" || customer.supplier_id === supplierFilter;
      const matchesStage = stageFilter === "All" || customer.stage_id === stageFilter;

      return matchesSearch && matchesSupplier && matchesStage;
    });
  }, [sortedCustomers, searchTerm, supplierFilter, stageFilter]);

  // ---------------- Pagination Calculations ----------------
  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    const endIndex = startIndex + CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage]);

  // ---------------- Permissions ----------------
  const canEditCustomer = (customer: EnergyCustomer): boolean => {
    if (user?.role === "Admin") return true;
    if (user?.role === "Staff") {
      return customer.assigned_to_id === user.employee_id;
    }
    return false;
  };

  const canDeleteCustomer = (): boolean => user?.role === "Admin";

  // ---------------- Delete Customer ----------------
  const deleteCustomer = async (id: number) => {
    if (!canDeleteCustomer()) {
      alert("You don't have permission to delete clients.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this client and all related records?")) return;

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`${API_BASE_URL}/energy-clients/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error("Failed to delete client");

      setAllCustomers((prev) => prev.filter((c) => c.id !== id));
      
      if (paginatedCustomers.length === 1 && currentPage > 1) {
        setCurrentPage(prev => prev - 1);
      }
    } catch (err) {
      console.error("Delete error:", err);
      alert("Error deleting customer");
    }
  };

  // Get supplier name from ID
  const getSupplierName = (supplierId: number | undefined): string => {
    if (!supplierId) return "—";
    const supplier = suppliers.find(s => s.supplier_id === supplierId);
    return supplier?.supplier_name || "—";
  };

  // Get stage name from ID
  const getStageName = (stageId: number | undefined): string => {
    if (!stageId) return "—";
    const stage = stages.find(s => s.stage_id === stageId);
    return stage?.stage_name || "—";
  };

  // Pagination Component
  const PaginationControls = () => {
    if (totalPages <= 1) return null;

    return (
      <div className="flex items-center justify-between py-3 px-4 bg-gray-50 border-t">
        <div className="text-sm text-gray-700">
          Showing <span className="font-medium">{(currentPage - 1) * CUSTOMERS_PER_PAGE + 1}</span> to{" "}
          <span className="font-medium">
            {Math.min(currentPage * CUSTOMERS_PER_PAGE, filteredCustomers.length)}
          </span>{" "}
          of <span className="font-medium">{filteredCustomers.length}</span> clients
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
      <h1 className="mb-6 text-3xl font-bold">
        Energy Clients
      </h1>

      {/* Error Display */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-red-800">Error Loading Clients</h3>
            <p className="mt-1 text-sm text-red-700">{error}</p>
            <Button 
              onClick={fetchCustomers} 
              variant="outline" 
              size="sm" 
              className="mt-3"
            >
              Try Again
            </Button>
          </div>
        </div>
      )}

      {/* Search and Filter Bar */}
      <div className="mb-6 flex justify-between">
        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="text-muted-foreground absolute top-2.5 left-2 h-4 w-4" />
            <Input
              placeholder="Search clients..."
              className="pl-8"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

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
                  {supplier.supplier_name} ({supplier.provisions_text})
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Filter className="mr-2 h-4 w-4" />
                {stageFilter === "All" ? "All Stages" : getStageName(stageFilter as number)}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setStageFilter("All")}>
                All Stages
              </DropdownMenuItem>
              {stages.map(stage => (
                <DropdownMenuItem 
                  key={stage.stage_id} 
                  onClick={() => setStageFilter(stage.stage_id)}
                >
                  {stage.stage_name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Energy Client
        </Button>
      </div>

      {/* Customer Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  "ID",
                  "Name",
                  "Business Name",
                  "Contact Person",
                  "Tel Number",
                  "MPAN/MPR",
                  "Supplier",
                  "Annual Usage",
                  "Start Date",
                  "End Date",
                  "Status",
                  "Callback",
                  "Assigned To",
                  "Actions"
                ].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
                    <p className="mt-4 text-gray-500">Loading energy clients...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600">Failed to load energy clients</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-6 py-12 text-center text-gray-500">
                    <Zap className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-lg">No energy clients found.</p>
                    <p className="mt-2 text-sm">Create your first energy client to get started!</p>
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => {
                  const stageName = getStageName(customer.stage_id);
                  
                  return (
                    <tr
                      key={customer.id}
                      onClick={() => router.push(`/dashboard/clients/${customer.id}`)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer.id}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {customer.name || customer.contact_person}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-gray-400" />
                          {customer.business_name}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {customer.contact_person}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {customer.phone}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-blue-600">
                        {customer.mpan_mpr || "—"}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          <Zap className="h-3 w-3 text-amber-500" />
                          {customer.supplier_name || "—"}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 text-right">
                        {formatUsage(customer.annual_usage)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(customer.start_date)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(customer.end_date)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        {stageName !== "—" ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStageColor(stageName)}`}
                          >
                            {stageName}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(customer.callback_date)}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {customer.assigned_to_name || "—"}
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="flex gap-2 justify-end">
                          {canEditCustomer(customer) && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                router.push(`/dashboard/clients/${customer.id}/edit`);
                              }}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                          )}
                          {canDeleteCustomer() && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteCustomer(customer.id);
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {!isLoading && !error && filteredCustomers.length > 0 && <PaginationControls />}
      </div>

      {showCreateModal && (
        <CreateEnergyCustomerModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCustomerCreated={fetchCustomers}
          suppliers={suppliers}
          stages={stages}
        />
      )}
    </div>
  );
}