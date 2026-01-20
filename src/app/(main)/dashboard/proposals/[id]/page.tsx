"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Edit,
  FileText,
  Trash2,
  Download,
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  Send,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

interface ProposalItem {
  id: string;
  sr_no: number;
  code: string;
  description: string;
  nop: number;
  unit_rate: number;
  amount: number;
}

interface Proposal {
  id: number;
  customer_id: string;
  customer_name: string;
  customer_designation: string;
  customer_company: string;
  customer_address: string;
  customer_mobile: string;
  customer_email: string;
  quotation_number: string;
  date: string;
  ifo_number: string;
  mode_of_enquiry: string;
  payment_terms: string;
  items: ProposalItem[];
  sub_total: number;
  discount_percentage: number;
  discount_amount: number;
  igst_percentage: number;
  igst_amount: number;
  grand_total: number;
  bank_name: string;
  branch_name: string;
  account_number: string;
  ifsc_code: string;
  gst_number: string;
  valid_for_days: number;
  terms_conditions: string[];
  notes: string;
  status: string;
  created_at: string;
  updated_at: string;
  created_by: number;
  created_by_name?: string;
}

const formatDate = (dateString: string) => {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case "approved":
    case "accepted":
      return "bg-green-100 text-green-800 border-green-300";
    case "draft":
      return "bg-gray-100 text-gray-800 border-gray-300";
    case "sent":
    case "pending":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    case "rejected":
    case "cancelled":
      return "bg-red-100 text-red-800 border-red-300";
    default:
      return "bg-blue-100 text-blue-800 border-blue-300";
  }
};

const getStatusIcon = (status: string) => {
  switch (status?.toLowerCase()) {
    case "approved":
    case "accepted":
      return <CheckCircle className="h-4 w-4" />;
    case "rejected":
    case "cancelled":
      return <XCircle className="h-4 w-4" />;
    case "sent":
    case "pending":
      return <Clock className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
};

export default function ProposalViewPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const proposalId = params?.id as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (proposalId) {
      fetchProposal();
    }
  }, [proposalId]);

  const fetchProposal = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem("auth_token");
      const response = await fetch(
        `http://localhost:5000/proposals/${proposalId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to fetch proposal");
      }

      const data = await response.json();
      setProposal(data);
    } catch (err) {
      console.error("Error fetching proposal:", err);
      setError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);

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

      if (!response.ok) {
        throw new Error("Failed to delete proposal");
      }

      alert("Proposal deleted successfully!");
      router.push("/dashboard/clients");
    } catch (err) {
      console.error("Error deleting proposal:", err);
      alert("Failed to delete proposal");
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  const handleDownloadPDF = () => {
    window.open(`/dashboard/proposals/${proposalId}/pdf`, "_blank");
  };

  const canEdit = () => {
    if (!user || !proposal) return false;
    const allowedRoles = ["Admin", "Manager", "Sales"];
    return allowedRoles.includes(user.role);
  };

  const canDelete = () => {
    if (!user || !proposal) return false;
    return user.role === "Admin" || user.role === "Manager";
  };

  const canManage = () => {
    if (!user || !proposal) return false;
    return user.role === "Admin" || user.role === "Manager";
  };

  const handleStatusChange = async (newStatus: string) => {
    if (!confirm(`Are you sure you want to ${newStatus.toLowerCase()} this proposal?`)) {
      return;
    }

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

      if (!response.ok) {
        throw new Error("Failed to update proposal status");
      }

      alert(`Proposal ${newStatus.toLowerCase()} successfully!`);
      fetchProposal(); // Refresh the proposal data
    } catch (err) {
      console.error("Error updating status:", err);
      alert("Failed to update proposal status");
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <Loader2 className="mx-auto h-8 w-8 animate-spin text-blue-600" />
          <p className="mt-4 text-gray-600">Loading proposal...</p>
        </div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <XCircle className="mx-auto h-12 w-12 text-red-500" />
          <h3 className="mt-4 text-lg font-semibold text-gray-900">
            Error Loading Proposal
          </h3>
          <p className="mt-2 text-gray-600">{error || "Proposal not found"}</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="border-b bg-white px-8 py-6">
        <div className="mx-auto max-w-5xl">
          {/* Top Row - Back button and Title */}
          <div className="mb-4 flex items-center space-x-4">
            <Button
              variant="ghost"
              onClick={() => router.back()}
              className="flex items-center"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Training Proposal</h1>
              <p className="text-sm text-gray-600">
                Proposal #{proposal.quotation_number}
              </p>
            </div>
          </div>

          {/* Bottom Row - Status and Actions */}
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center space-x-2 rounded-full border px-3 py-1 ${getStatusColor(
                proposal.status
              )}`}
            >
              {getStatusIcon(proposal.status)}
              <span className="text-sm font-medium">{proposal.status}</span>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Manager Action Buttons */}
              {canManage() && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("Approved")}
                    disabled={proposal.status === "Approved"}
                    className="border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("Pending")}
                    disabled={proposal.status === "Pending"}
                    className="border-yellow-500 text-yellow-600 hover:bg-yellow-50"
                  >
                    <Clock className="mr-2 h-4 w-4" />
                    Pending
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleStatusChange("Rejected")}
                    disabled={proposal.status === "Rejected"}
                    className="border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </>
              )}
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadPDF}
                className="flex items-center"
              >
                <Download className="mr-2 h-4 w-4" />
                Download PDF
              </Button>
              {canEdit() && (
                <Button
                  size="sm"
                  onClick={() =>
                    router.push(`/dashboard/proposals/${proposalId}/edit`)
                  }
                  className="flex items-center"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              )}
              {canDelete() && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setShowDeleteDialog(true)}
                  className="flex items-center"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl px-8 py-6">
        {/* Company Header */}
        <div className="mb-6 rounded-lg border-4 border-blue-600 bg-white">
          <div className="bg-blue-600 py-2 text-center">
            <h2 className="text-xl font-bold text-white">Training Proposal</h2>
          </div>
          <div className="flex items-start justify-between p-6">
            {/* Logo */}
            <div className="flex-shrink-0">
              <img
                src="/images/fai-logo.png"
                alt="FAI Logo"
                className="h-24 w-24 object-contain"
              />
            </div>
            
            {/* Company Details */}
            <div className="flex-1 px-6 text-center">
              <h1 className="text-2xl font-bold text-gray-900">
                FORKLIFT ACADEMY OF INDIA
              </h1>
              <p className="text-sm italic text-gray-600">
                (A Journey Towards Zero Forklift Truck Accident)
              </p>
              <p className="mt-2 text-sm text-gray-700">
                F-201, Moyfair Eleganza II, NIBM Road, Kondhwa, Pune 411048.
              </p>
              <p className="text-sm text-gray-700">
                7038183772 | 8983840484 | 8983340497 | info@forkliftacademy
              </p>
              <p className="mt-1 text-xs italic text-gray-600">
                Life Member of Association of Commerce Industries & Agriculture
              </p>
            </div>
            
            {/* Empty space for balance */}
            <div className="w-24 flex-shrink-0"></div>
          </div>
        </div>

        {/* Customer & Proposal Info */}
        <div className="mb-6 grid grid-cols-2 gap-6">
          {/* Customer Info */}
          <div className="rounded-lg bg-white p-6 shadow">
            <h3 className="mb-4 font-semibold text-gray-900">To,</h3>
            <div className="space-y-2 text-sm">
              <p className="font-semibold">{proposal.customer_name}</p>
              {proposal.customer_designation && (
                <p className="text-gray-700">{proposal.customer_designation}</p>
              )}
              {proposal.customer_company && (
                <p className="text-gray-700">{proposal.customer_company}</p>
              )}
              <p className="text-gray-700">{proposal.customer_address}</p>
              <div className="mt-3 space-y-1">
                <p className="text-gray-700">
                  <span className="font-medium">Mobile:</span>{" "}
                  {proposal.customer_mobile}
                </p>
                <p className="text-gray-700">
                  <span className="font-medium">Email:</span>{" "}
                  {proposal.customer_email}
                </p>
              </div>
            </div>
          </div>

          {/* Proposal Details */}
          <div className="rounded-lg bg-blue-50 p-6 shadow">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Quotation #:</span>
                <span className="font-semibold text-gray-900">
                  {proposal.quotation_number}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Date:</span>
                <span className="text-gray-900">{formatDate(proposal.date)}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">IFO Number:</span>
                <span className="text-gray-900">{proposal.ifo_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Mode of Enquiry:</span>
                <span className="text-gray-900">{proposal.mode_of_enquiry}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium text-gray-700">Payment Terms:</span>
                <span className="text-gray-900">{proposal.payment_terms}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Items Table */}
        <div className="mb-6 overflow-hidden rounded-lg bg-white shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-blue-600 text-white">
                <tr>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Sr. No.
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    CODE
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold">
                    Description
                  </th>
                  <th className="px-4 py-3 text-center text-sm font-semibold">
                    N.O.P.
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    UNIT RATE
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-semibold">
                    AMOUNT
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {proposal.items.map((item) => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm">{item.sr_no}</td>
                    <td className="px-4 py-3 text-sm font-medium">
                      {item.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="whitespace-pre-line text-sm">
                        {item.description}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center text-sm">
                      {item.nop}
                    </td>
                    <td className="px-4 py-3 text-right text-sm">
                      ₹ {item.unit_rate.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-semibold">
                      ₹ {item.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Totals */}
          <div className="border-t border-gray-200 bg-gray-50 p-6">
            <div className="ml-auto max-w-md space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">Sub Total</span>
                <span className="font-semibold">
                  ₹ {proposal.sub_total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">
                  Discount {proposal.discount_percentage}%
                </span>
                <span className="font-semibold">
                  ₹ {proposal.discount_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2 text-sm">
                <span className="text-gray-700">Our Bankers:</span>
                <span className="text-gray-900">{proposal.bank_name}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">{proposal.branch_name}</span>
                <span className="text-gray-700">
                  IGST @{proposal.igst_percentage}% (SAC: 999223)
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-700">
                  Account No: {proposal.account_number}
                </span>
                <span className="font-semibold">
                  ₹ {proposal.igst_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-t pt-2">
                <span className="text-gray-700">IFSC Code:</span>
                <span className="text-gray-900">{proposal.ifsc_code}</span>
              </div>
              <div className="flex justify-between border-t border-blue-600 bg-blue-600 px-4 py-3 text-white">
                <span className="font-bold">GRAND TOTAL</span>
                <span className="text-lg font-bold">
                  ₹ {proposal.grand_total.toFixed(2)}
                </span>
              </div>
              <div className="text-sm italic text-gray-600">
                <span className="font-medium">Amount:</span> Eighty Eight Thousand
                Five Hundred Only
              </div>
            </div>
          </div>
        </div>

        {/* GST & Validity */}
        <div className="mb-6 rounded-lg bg-white p-6 shadow">
          <div className="flex justify-between text-sm">
            <div>
              <span className="font-medium text-gray-700">GST IN:</span>{" "}
              <span className="text-gray-900">{proposal.gst_number}</span>
            </div>
            <div className="rounded-lg bg-yellow-50 px-4 py-2">
              <span className="font-semibold text-gray-900">
                Valid for {proposal.valid_for_days} days from the date mentioned
                above
              </span>
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="mb-6 rounded-lg border-2 border-red-600 bg-white p-6 shadow">
          <h3 className="mb-4 border-b border-red-600 pb-2 text-center text-lg font-bold text-red-600">
            Terms & Conditions
          </h3>
          <div className="space-y-2">
            {proposal.terms_conditions.map((term, index) => (
              <div key={index} className="flex items-start space-x-2 text-sm">
                <span className="font-semibold text-gray-900">
                  {String.fromCharCode(65 + index)}.
                </span>
                <p className="flex-1 text-gray-700">{term}</p>
              </div>
            ))}
          </div>

          {/* Signature Section */}
          <div className="mt-8 flex justify-end">
            <div className="text-center">
              <div className="mb-2 h-16 w-48 border-b border-gray-400"></div>
              <p className="font-semibold text-gray-900">F C Shaikh</p>
              <p className="text-sm text-gray-600">Founder - CEO</p>
              <p className="mt-2 text-xs italic text-gray-500">
                For FORKLIFT ACADEMY OF INDIA
              </p>
            </div>
          </div>
        </div>

        {/* Additional Notes */}
        {proposal.notes && (
          <div className="mb-6 rounded-lg bg-blue-50 p-6 shadow">
            <h3 className="mb-3 font-semibold text-gray-900">
              Additional Notes
            </h3>
            <p className="whitespace-pre-line text-sm text-gray-700">
              {proposal.notes}
            </p>
          </div>
        )}

        {/* Footer Info */}
        <div className="rounded-lg bg-white p-6 text-center shadow">
          <p className="text-xs text-gray-600">
            For more information about our Training programs, please visit{" "}
            <span className="font-semibold text-blue-600">
              www.forkliftacademy
            </span>
          </p>
          <p className="mt-2 text-xs text-gray-500">
            Created on {formatDate(proposal.created_at)}
            {proposal.created_by_name && ` by ${proposal.created_by_name}`}
          </p>
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Proposal</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this proposal? This action cannot
              be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                "Delete Proposal"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}