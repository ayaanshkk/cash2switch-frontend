"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Search, Plus, Edit, Trash2, ChevronDown, Filter, AlertCircle, ChevronRight, ChevronLeft, ChevronLast, ChevronFirst, GraduationCap, Building2, User } from "lucide-react";
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

// ---------------- Types ----------------
type CustomerType = 'Individual' | 'Commercial';
type PipelineType = 'sales' | 'training';
type SalesStage = "Enquiry" | "Proposal" | "Converted";
type TrainingStage = "Training Scheduled" | "Training Conducted" | "Training Completed" | "PTI Created" | "Certificates Created" | "Certificates Dispatched";

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
  contact_made?: "Yes" | "No" | "Unknown";
  pipeline_type: PipelineType;
  sales_stage?: SalesStage;
  training_stage?: TrainingStage;
  status: string;
  notes?: string;
  created_at: string;
  created_by?: string;
  updated_at?: string;
  salesperson?: string;
}

// ---------------- Utility functions ----------------
const getSalesStageColor = (stage: SalesStage): string => {
  switch (stage) {
    case "Enquiry":
      return "bg-gray-100 text-gray-800";
    case "Proposal":
      return "bg-blue-100 text-blue-800";
    case "Converted":
      return "bg-green-100 text-green-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

const getTrainingStageColor = (stage: TrainingStage): string => {
  switch (stage) {
    case "Training Scheduled":
      return "bg-yellow-100 text-yellow-800";
    case "Training Conducted":
      return "bg-orange-100 text-orange-800";
    case "Training Completed":
      return "bg-green-100 text-green-800";
    case "PTI Created":
      return "bg-purple-100 text-purple-800";
    case "Certificates Created":
      return "bg-blue-100 text-blue-800";
    case "Certificates Dispatched":
      return "bg-indigo-100 text-indigo-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
};

// ---------------- Component ----------------
export default function CustomersPage() {
  const [allCustomers, setAllCustomers] = useState<Customer[]>([]); 
  const [searchTerm, setSearchTerm] = useState("");
  const [pipelineFilter, setPipelineFilter] = useState<PipelineType | "All">("All");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const router = useRouter();
  const { user } = useAuth();

  // Fetch customers initially
  useEffect(() => {
    fetchCustomers();
  }, []);

  // Reset page when filters/search change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, pipelineFilter]);

  // ---------------- Fetch Customers ----------------
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

      const headers: HeadersInit = { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      console.log("🔄 Fetching customers from: http://localhost:5000/clients");
      
      const response = await fetch("http://localhost:5000/clients", {
        headers,
      });

      console.log("📡 Response status:", response.status, response.statusText);

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Error response:", errorText);
        
        let errorMessage = "Failed to fetch clients";
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorJson.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log(`✅ Customers received: ${data.length} customers`, data);

      setAllCustomers(data);

    } catch (err) {
      console.error("❌ Error fetching clients:", err);
      const errorMessage = err instanceof Error ? err.message : "Unknown error occurred";
      setError(errorMessage);
      setAllCustomers([]);
    } finally {
      setIsLoading(false);
    }
  };

  // ✅ Apply role-based filtering
  const roleFilteredCustomers = useMemo(() => {
    if (user?.role === "Staff") {
      // Staff can only see customers they created
      return allCustomers.filter((customer) => {
        const customerCreatedBy = String(customer.created_by || "").trim();
        const userId = String(user.id || "").trim();
        return customerCreatedBy === userId;
      });
    }
    
    // Admin sees all customers
    return allCustomers;
  }, [allCustomers, user]);

  // ✅ Sort customers by most recent first
  const sortedCustomers = useMemo(() => {
    return [...roleFilteredCustomers].sort((a, b) => {
      const aDate = new Date(a.updated_at || a.created_at).getTime();
      const bDate = new Date(b.updated_at || b.created_at).getTime();
      return bDate - aDate;
    });
  }, [roleFilteredCustomers]);

  // ✅ Apply search and pipeline filters
  const filteredCustomers = useMemo(() => {
    return sortedCustomers.filter((customer) => {
      const term = searchTerm.toLowerCase();
      const matchesSearch =
        (customer.name || "").toLowerCase().includes(term) ||
        (customer.address || "").toLowerCase().includes(term) ||
        (customer.email || "").toLowerCase().includes(term) ||
        (customer.phone || "").toLowerCase().includes(term);

      const matchesPipeline = pipelineFilter === "All" || customer.pipeline_type === pipelineFilter;

      return matchesSearch && matchesPipeline;
    });
  }, [sortedCustomers, searchTerm, pipelineFilter]);

  // ---------------- Pagination Calculations ----------------
  const totalPages = Math.ceil(filteredCustomers.length / CUSTOMERS_PER_PAGE);

  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * CUSTOMERS_PER_PAGE;
    const endIndex = startIndex + CUSTOMERS_PER_PAGE;
    return filteredCustomers.slice(startIndex, endIndex);
  }, [filteredCustomers, currentPage]);

  // ---------------- Permissions ----------------
  const canEditCustomer = (customer: Customer): boolean => {
    if (user?.role === "Admin") return true;
    if (user?.role === "Staff") {
      const customerCreatedBy = String(customer.created_by || "").trim();
      const userId = String(user.id || "").trim();
      return customerCreatedBy === userId;
    }
    return false;
  };

  const canDeleteCustomer = (): boolean => user?.role === "Admin";

  // ---------------- Delete Customer ----------------
  const deleteCustomer = async (id: string) => {
    if (!canDeleteCustomer()) {
      alert("You don't have permission to delete clients.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this client?")) return;

    try {
      const token = localStorage.getItem("auth_token");
      const res = await fetch(`http://localhost:5000/clients/${id}`, {
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

  // Extract customer type from notes
  const getCustomerType = (customer: Customer): CustomerType | null => {
    if (!customer.notes) return null;
    if (customer.notes.includes("Customer Type: Individual")) return "Individual";
    if (customer.notes.includes("Customer Type: Commercial")) return "Commercial";
    return null;
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
        {user?.role === "Staff" ? "My Clients" : "Clients"}
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
                {pipelineFilter === "All" ? "All Pipelines" : pipelineFilter === "sales" ? "Sales" : "Training"}
                <ChevronDown className="ml-1 h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setPipelineFilter("All")}>
                All Pipelines
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPipelineFilter("sales")}>
                Sales Pipeline
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setPipelineFilter("training")}>
                Training Pipeline
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Customer Table */}
      <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {["Name", "Phone", "Email", "Address", "Type", "Pipeline", "Stage", "Actions"].map((h) => (
                  <th
                    key={h}
                    className="px-6 py-3 text-left text-xs font-medium tracking-wider text-gray-500 uppercase"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent text-gray-600"></div>
                    <p className="mt-4 text-gray-500">Loading clients...</p>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-3" />
                    <p className="text-lg text-red-600">Failed to load clients</p>
                    <p className="mt-2 text-sm">{error}</p>
                  </td>
                </tr>
              ) : paginatedCustomers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                    <p className="text-lg">No clients found.</p>
                    {user?.role === "Staff" && (
                      <p className="mt-2 text-sm">Create your first client to get started!</p>
                    )}
                  </td>
                </tr>
              ) : (
                paginatedCustomers.map((customer) => {
                  const customerType = getCustomerType(customer);
                  const currentStage = customer.pipeline_type === 'sales' ? customer.sales_stage : customer.training_stage;

                  return (
                    <tr
                      key={customer.id}
                      onClick={() => router.push(`/dashboard/clients/${customer.id}`)}
                      className="cursor-pointer hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                        {customer.name}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {customer.phone}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {customer.email || "—"}
                      </td>

                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {customer.address}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {customerType === 'Individual' ? (
                          <div className="flex items-center gap-2" title="Individual Client">
                            <User className="h-4 w-4 text-blue-600" />
                            <span className="text-xs text-gray-600">Individual</span>
                          </div>
                        ) : customerType === 'Commercial' ? (
                          <div className="flex items-center gap-2" title="Commercial Client">
                            <Building2 className="h-4 w-4 text-purple-600" />
                            <span className="text-xs text-gray-600">Commercial</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {customer.pipeline_type === 'sales' ? (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800">
                            Sales
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold bg-green-100 text-green-800">
                            <GraduationCap className="h-3 w-3" />
                            Training
                          </span>
                        )}
                      </td>

                      <td className="px-6 py-4 whitespace-nowrap">
                        {currentStage ? (
                          <span
                            className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                              customer.pipeline_type === 'sales'
                                ? getSalesStageColor(currentStage as SalesStage)
                                : getTrainingStageColor(currentStage as TrainingStage)
                            }`}
                          >
                            {currentStage}
                          </span>
                        ) : (
                          <span className="text-sm text-gray-400">—</span>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right whitespace-nowrap">
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
        <CreateCustomerModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCustomerCreated={fetchCustomers}
        />
      )}
    </div>
  );
}