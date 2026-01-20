"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Trash2,
  FileText,
  Loader2,
  Download,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Proposal {
  id: number;
  quotation_number: string;
  customer_name: string;
  date: string;
  grand_total: number;
  status: string;
  created_at: string;
}

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "approved":
    case "accepted":
      return "bg-green-100 text-green-800";
    case "draft":
      return "bg-gray-100 text-gray-800";
    case "sent":
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-800";
    default:
      return "bg-blue-100 text-blue-800";
  }
};

const getRowColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "approved":
    case "accepted":
      return "bg-green-50 hover:bg-green-100";
    case "pending":
      return "bg-yellow-50 hover:bg-yellow-100";
    case "rejected":
    case "cancelled":
      return "bg-red-50 hover:bg-red-100";
    case "draft":
      return "bg-gray-50 hover:bg-gray-100";
    default:
      return "hover:bg-gray-50";
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
  }).format(amount);
};

export default function ProposalsPage() {
  const router = useRouter();
  const { user } = useAuth();

  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [filteredProposals, setFilteredProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    fetchProposals();
  }, []);

  useEffect(() => {
    filterProposals();
  }, [searchTerm, statusFilter, proposals]);

  const fetchProposals = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      const response = await fetch("http://localhost:5000/proposals", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setProposals(data);
        setFilteredProposals(data);
      } else {
        console.error("Failed to fetch proposals");
      }
    } catch (error) {
      console.error("Error fetching proposals:", error);
    } finally {
      setLoading(false);
    }
  };

  const filterProposals = () => {
    let filtered = proposals;

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(
        (p) =>
          p.quotation_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
          p.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Filter by status
    if (statusFilter !== "all") {
      filtered = filtered.filter(
        (p) => p.status.toLowerCase() === statusFilter.toLowerCase()
      );
    }

    setFilteredProposals(filtered);
  };

  const handleView = (proposalId: number) => {
    router.push(`/dashboard/proposals/${proposalId}`);
  };

  const handleEdit = (proposalId: number) => {
    router.push(`/dashboard/proposals/${proposalId}/edit`);
  };

  const handleDelete = async (proposalId: number) => {
    if (!confirm("Are you sure you want to delete this proposal?")) return;

    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `http://localhost:5000/proposals/${proposalId}`,
        {
          method: "DELETE",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (response.ok) {
        alert("Proposal deleted successfully!");
        fetchProposals();
      } else {
        alert("Failed to delete proposal");
      }
    } catch (error) {
      console.error("Error deleting proposal:", error);
      alert("Failed to delete proposal");
    }
  };

  const canEdit = () => {
    if (!user) return false;
    return ["Admin", "Manager", "Sales"].includes(user.role);
  };

  const canDelete = () => {
    if (!user) return false;
    return ["Admin", "Manager"].includes(user.role);
  };

  const canManage = () => {
    if (!user) return false;
    return ["Admin", "Manager"].includes(user.role);
  };

  const handleStatusChange = async (proposalId: number, newStatus: string) => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `http://localhost:5000/proposals/${proposalId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: newStatus }),
        }
      );

      if (response.ok) {
        alert(`Proposal ${newStatus.toLowerCase()} successfully!`);
        fetchProposals(); // Refresh the list
      } else {
        alert("Failed to update proposal status");
      }
    } catch (error) {
      console.error("Error updating status:", error);
      alert("Failed to update proposal status");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading proposals...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Training Proposals
            </h1>
            <p className="mt-1 text-gray-600">
              Manage all your training proposals and quotations
            </p>
          </div>
          <Button
            onClick={() => router.push("/dashboard/proposals/create")}
            className="flex items-center"
          >
            <Plus className="mr-2 h-4 w-4" />
            New Proposal
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            placeholder="Search by quotation # or customer name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="approved">Approved</SelectItem>
            <SelectItem value="rejected">Rejected</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Statistics */}
      <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Total Proposals</p>
          <p className="text-2xl font-bold">{proposals.length}</p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Draft</p>
          <p className="text-2xl font-bold">
            {proposals.filter((p) => p.status === "Draft").length}
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Pending</p>
          <p className="text-2xl font-bold">
            {
              proposals.filter(
                (p) => p.status === "Sent" || p.status === "Pending"
              ).length
            }
          </p>
        </div>
        <div className="rounded-lg bg-white p-4 shadow">
          <p className="text-sm text-gray-600">Approved</p>
          <p className="text-2xl font-bold text-green-600">
            {proposals.filter((p) => p.status === "Approved").length}
          </p>
        </div>
      </div>

      {/* Proposals Table */}
      <div className="overflow-hidden rounded-lg bg-white shadow">
        {filteredProposals.length === 0 ? (
          <div className="p-12 text-center">
            <FileText className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              No proposals found
            </h3>
            <p className="mt-2 text-gray-600">
              {searchTerm || statusFilter !== "all"
                ? "Try adjusting your filters"
                : "Get started by creating a new proposal"}
            </p>
            {!searchTerm && statusFilter === "all" && (
              <Button
                onClick={() => router.push("/dashboard/proposals/create")}
                className="mt-4"
              >
                <Plus className="mr-2 h-4 w-4" />
                Create Proposal
              </Button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proposal #</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                {canManage() && <TableHead>Manager Actions</TableHead>}
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProposals.map((proposal) => (
                <TableRow 
                  key={proposal.id} 
                  className={getRowColor(proposal.status)}
                >
                  <TableCell className="font-medium">
                    {proposal.quotation_number}
                  </TableCell>
                  <TableCell>{proposal.customer_name}</TableCell>
                  <TableCell>{formatDate(proposal.date)}</TableCell>
                  <TableCell className="font-semibold">
                    {formatCurrency(proposal.grand_total)}
                  </TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${getStatusColor(
                        proposal.status
                      )}`}
                    >
                      {proposal.status}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-gray-600">
                    {formatDate(proposal.created_at)}
                  </TableCell>
                  {canManage() && (
                    <TableCell>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(proposal.id, "Approved")}
                          className="border-green-500 text-green-600 hover:bg-green-50"
                          disabled={proposal.status === "Approved"}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(proposal.id, "Pending")}
                          className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                          disabled={proposal.status === "Pending"}
                        >
                          Pending
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleStatusChange(proposal.id, "Rejected")}
                          className="border-red-500 text-red-600 hover:bg-red-50"
                          disabled={proposal.status === "Rejected"}
                        >
                          Reject
                        </Button>
                      </div>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`/dashboard/proposals/${proposal.id}`, "_blank")}
                        title="View"
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          window.open(
                            `/dashboard/proposals/${proposal.id}/pdf`,
                            "_blank"
                          )
                        }
                        title="Download PDF"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(proposal.id)}
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete() && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(proposal.id)}
                          title="Delete"
                          className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}