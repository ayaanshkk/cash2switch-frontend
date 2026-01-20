"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, Plus, Trash2, Loader2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface Customer {
  id: string;
  name: string;
  address: string;
  phone: string;
  email?: string;
}

interface ProposalItem {
  id: string;
  sr_no: number;
  code: string;
  description: string;
  nop: number;
  unit_rate: number;
  amount: number;
}

interface ProposalData {
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
  discount_percentage: number;
  igst_percentage: number;
  bank_name: string;
  branch_name: string;
  account_number: string;
  ifsc_code: string;
  gst_number: string;
  valid_for_days: number;
  terms_conditions: string[];
  notes: string;
  status: string;
}

export default function EditProposalPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const proposalId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [proposalData, setProposalData] = useState<ProposalData>({
    customer_id: "",
    customer_name: "",
    customer_designation: "",
    customer_company: "",
    customer_address: "",
    customer_mobile: "",
    customer_email: "",
    quotation_number: "",
    date: "",
    ifo_number: "",
    mode_of_enquiry: "Email",
    payment_terms: "50% advance, balance on completion of training",
    items: [],
    discount_percentage: 5,
    igst_percentage: 18,
    bank_name: "Oriental Bank Of Commerce",
    branch_name: "Kandwa Branch Pune",
    account_number: "11281140200 - Current",
    ifsc_code: "ORBC0101128",
    gst_number: "27AAEFF1562M1Z8",
    valid_for_days: 30,
    terms_conditions: [],
    notes: "",
    status: "Draft",
  });

  useEffect(() => {
    if (proposalId) {
      fetchProposal();
      fetchCustomers();
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
      
      // Format the data for editing
      setProposalData({
        customer_id: data.customer_id || "",
        customer_name: data.customer_name || "",
        customer_designation: data.customer_designation || "",
        customer_company: data.customer_company || "",
        customer_address: data.customer_address || "",
        customer_mobile: data.customer_mobile || "",
        customer_email: data.customer_email || "",
        quotation_number: data.quotation_number || "",
        date: data.date ? data.date.split("T")[0] : "",
        ifo_number: data.ifo_number || "",
        mode_of_enquiry: data.mode_of_enquiry || "Email",
        payment_terms: data.payment_terms || "50% advance, balance on completion of training",
        items: Array.isArray(data.items) ? data.items : [],
        discount_percentage: data.discount_percentage || 5,
        igst_percentage: data.igst_percentage || 18,
        bank_name: data.bank_name || "Oriental Bank Of Commerce",
        branch_name: data.branch_name || "Kandwa Branch Pune",
        account_number: data.account_number || "11281140200 - Current",
        ifsc_code: data.ifsc_code || "ORBC0101128",
        gst_number: data.gst_number || "27AAEFF1562M1Z8",
        valid_for_days: data.valid_for_days || 30,
        terms_conditions: Array.isArray(data.terms_conditions) ? data.terms_conditions : [],
        notes: data.notes || "",
        status: data.status || "Draft",
      });
    } catch (err) {
      console.error("Error fetching proposal:", err);
      setError(err instanceof Error ? err.message : "Failed to load proposal");
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem("auth_token");
      const response = await fetch("http://localhost:5000/clients", {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setCustomers(data);
      }
    } catch (error) {
      console.error("Error fetching customers:", error);
    }
  };

  const handleCustomerChange = (customerId: string) => {
    const customer = customers.find((c) => c.id === customerId);
    if (customer) {
      setProposalData((prev) => ({
        ...prev,
        customer_id: customer.id,
        customer_name: customer.name,
        customer_address: customer.address,
        customer_mobile: customer.phone,
        customer_email: customer.email || "",
      }));
    }
  };

  const addItem = () => {
    const newItem: ProposalItem = {
      id: String(Date.now()),
      sr_no: proposalData.items.length + 1,
      code: "",
      description: "",
      nop: 1,
      unit_rate: 0,
      amount: 0,
    };
    setProposalData((prev) => ({
      ...prev,
      items: [...prev.items, newItem],
    }));
  };

  const removeItem = (id: string) => {
    setProposalData((prev) => ({
      ...prev,
      items: prev.items
        .filter((item) => item.id !== id)
        .map((item, index) => ({
          ...item,
          sr_no: index + 1,
        })),
    }));
  };

  const updateItem = (id: string, field: keyof ProposalItem, value: any) => {
    setProposalData((prev) => ({
      ...prev,
      items: prev.items.map((item) => {
        if (item.id === id) {
          const updated = { ...item, [field]: value };
          // Auto-calculate amount
          if (field === "nop" || field === "unit_rate") {
            updated.amount = updated.nop * updated.unit_rate;
          }
          return updated;
        }
        return item;
      }),
    }));
  };

  const calculateSubTotal = () => {
    return proposalData.items.reduce((sum, item) => sum + item.amount, 0);
  };

  const calculateDiscount = () => {
    return (calculateSubTotal() * proposalData.discount_percentage) / 100;
  };

  const calculateIGST = () => {
    const afterDiscount = calculateSubTotal() - calculateDiscount();
    return (afterDiscount * proposalData.igst_percentage) / 100;
  };

  const calculateGrandTotal = () => {
    return calculateSubTotal() - calculateDiscount() + calculateIGST();
  };

  const handleSave = async () => {
    if (!proposalData.customer_id) {
      alert("Please select a customer");
      return;
    }

    if (proposalData.items.length === 0) {
      alert("Please add at least one item");
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("auth_token");

      const payload = {
        customer_id: proposalData.customer_id,
        customer_name: proposalData.customer_name,
        customer_designation: proposalData.customer_designation,
        customer_company: proposalData.customer_company,
        customer_address: proposalData.customer_address,
        customer_mobile: proposalData.customer_mobile,
        customer_email: proposalData.customer_email,
        quotation_number: proposalData.quotation_number,
        date: proposalData.date,
        ifo_number: proposalData.ifo_number,
        mode_of_enquiry: proposalData.mode_of_enquiry,
        payment_terms: proposalData.payment_terms,
        items: proposalData.items,
        sub_total: calculateSubTotal(),
        discount_percentage: proposalData.discount_percentage,
        discount_amount: calculateDiscount(),
        igst_percentage: proposalData.igst_percentage,
        igst_amount: calculateIGST(),
        grand_total: calculateGrandTotal(),
        bank_name: proposalData.bank_name,
        branch_name: proposalData.branch_name,
        account_number: proposalData.account_number,
        ifsc_code: proposalData.ifsc_code,
        gst_number: proposalData.gst_number,
        valid_for_days: proposalData.valid_for_days,
        terms_conditions: proposalData.terms_conditions,
        notes: proposalData.notes,
        status: proposalData.status,
        updated_by: user?.id,
      };

      const response = await fetch(
        `http://localhost:5000/proposals/${proposalId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        }
      );

      if (response.ok) {
        alert("Proposal updated successfully!");
        router.push(`/dashboard/proposals/${proposalId}`);
      } else {
        const error = await response.json();
        alert(`Failed to update proposal: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error updating proposal:", error);
      alert("Failed to update proposal. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const addTermCondition = () => {
    setProposalData((prev) => ({
      ...prev,
      terms_conditions: [...prev.terms_conditions, ""],
    }));
  };

  const updateTermCondition = (index: number, value: string) => {
    setProposalData((prev) => ({
      ...prev,
      terms_conditions: prev.terms_conditions.map((term, i) =>
        i === index ? value : term
      ),
    }));
  };

  const removeTermCondition = (index: number) => {
    setProposalData((prev) => ({
      ...prev,
      terms_conditions: prev.terms_conditions.filter((_, i) => i !== index),
    }));
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

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-red-600">Error</h3>
          <p className="mt-2 text-gray-600">{error}</p>
          <Button onClick={() => router.back()} className="mt-4">
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="flex items-center"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Edit Training Proposal</h1>
            <p className="text-sm text-gray-600">
              Quotation #{proposalData.quotation_number}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/proposals/${proposalId}`)}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6">
        {/* Customer Information */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Customer Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Select Customer *</Label>
              <Select
                value={proposalData.customer_id}
                onValueChange={handleCustomerChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={customer.id}>
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Customer Name</Label>
              <Input
                value={proposalData.customer_name}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    customer_name: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Designation</Label>
              <Input
                value={proposalData.customer_designation}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    customer_designation: e.target.value,
                  }))
                }
                placeholder="e.g., Indirect Category Manager, Procurement"
              />
            </div>
            <div>
              <Label>Company</Label>
              <Input
                value={proposalData.customer_company}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    customer_company: e.target.value,
                  }))
                }
                placeholder="e.g., Air Liquide North India Pvt. Ltd."
              />
            </div>
            <div className="col-span-2">
              <Label>Address</Label>
              <Textarea
                value={proposalData.customer_address}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    customer_address: e.target.value,
                  }))
                }
                rows={2}
              />
            </div>
            <div>
              <Label>Mobile</Label>
              <Input
                value={proposalData.customer_mobile}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    customer_mobile: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={proposalData.customer_email}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    customer_email: e.target.value,
                  }))
                }
              />
            </div>
          </div>
        </div>

        {/* Proposal Details */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Proposal Details</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>Quotation #</Label>
              <Input
                value={proposalData.quotation_number}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    quotation_number: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={proposalData.date}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    date: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>IFO Number</Label>
              <Input
                value={proposalData.ifo_number}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    ifo_number: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Mode of Enquiry</Label>
              <Select
                value={proposalData.mode_of_enquiry}
                onValueChange={(value) =>
                  setProposalData((prev) => ({
                    ...prev,
                    mode_of_enquiry: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                  <SelectItem value="In Person">In Person</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2">
              <Label>Payment Terms</Label>
              <Input
                value={proposalData.payment_terms}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    payment_terms: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Status</Label>
              <Select
                value={proposalData.status}
                onValueChange={(value) =>
                  setProposalData((prev) => ({
                    ...prev,
                    status: value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Draft">Draft</SelectItem>
                  <SelectItem value="Sent">Sent</SelectItem>
                  <SelectItem value="Pending">Pending</SelectItem>
                  <SelectItem value="Approved">Approved</SelectItem>
                  <SelectItem value="Rejected">Rejected</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Training Items</h2>
            <Button onClick={addItem} size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          </div>

          <div className="space-y-4">
            {proposalData.items.map((item, index) => (
              <div
                key={item.id}
                className="rounded-lg border border-gray-200 p-4"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="font-semibold">Item {item.sr_no}</span>
                  {proposalData.items.length > 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  )}
                </div>
                <div className="grid grid-cols-6 gap-4">
                  <div className="col-span-1">
                    <Label>Code</Label>
                    <Input
                      value={item.code}
                      onChange={(e) =>
                        updateItem(item.id, "code", e.target.value)
                      }
                      placeholder="WS-005"
                    />
                  </div>
                  <div className="col-span-3">
                    <Label>Description</Label>
                    <Textarea
                      value={item.description}
                      onChange={(e) =>
                        updateItem(item.id, "description", e.target.value)
                      }
                      rows={3}
                    />
                  </div>
                  <div className="col-span-1">
                    <Label>N.O.P</Label>
                    <Input
                      type="number"
                      value={item.nop}
                      onChange={(e) =>
                        updateItem(item.id, "nop", Number(e.target.value))
                      }
                    />
                  </div>
                  <div className="col-span-1">
                    <Label>Unit Rate (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_rate}
                      onChange={(e) =>
                        updateItem(
                          item.id,
                          "unit_rate",
                          Number(e.target.value)
                        )
                      }
                    />
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-sm font-semibold">
                    Amount: ₹{item.amount.toFixed(2)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div className="mt-6 space-y-2 border-t pt-4">
            <div className="flex justify-between">
              <span>Sub Total:</span>
              <span className="font-semibold">
                ₹{calculateSubTotal().toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span>Discount:</span>
                <Input
                  type="number"
                  className="w-20"
                  value={proposalData.discount_percentage}
                  onChange={(e) =>
                    setProposalData((prev) => ({
                      ...prev,
                      discount_percentage: Number(e.target.value),
                    }))
                  }
                />
                <span>%</span>
              </div>
              <span className="font-semibold">
                ₹{calculateDiscount().toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span>IGST @</span>
                <Input
                  type="number"
                  className="w-20"
                  value={proposalData.igst_percentage}
                  onChange={(e) =>
                    setProposalData((prev) => ({
                      ...prev,
                      igst_percentage: Number(e.target.value),
                    }))
                  }
                />
                <span>%</span>
              </div>
              <span className="font-semibold">
                ₹{calculateIGST().toFixed(2)}
              </span>
            </div>
            <div className="flex justify-between border-t pt-2 text-lg font-bold">
              <span>GRAND TOTAL:</span>
              <span className="text-blue-600">
                ₹{calculateGrandTotal().toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Bank Details */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Bank Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Bank Name</Label>
              <Input
                value={proposalData.bank_name}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    bank_name: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Branch Name</Label>
              <Input
                value={proposalData.branch_name}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    branch_name: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Account Number</Label>
              <Input
                value={proposalData.account_number}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    account_number: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>IFSC Code</Label>
              <Input
                value={proposalData.ifsc_code}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    ifsc_code: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>GST Number</Label>
              <Input
                value={proposalData.gst_number}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    gst_number: e.target.value,
                  }))
                }
              />
            </div>
            <div>
              <Label>Valid For (Days)</Label>
              <Input
                type="number"
                value={proposalData.valid_for_days}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    valid_for_days: Number(e.target.value),
                  }))
                }
              />
            </div>
          </div>
        </div>

        {/* Terms & Conditions */}
        <div className="rounded-lg bg-white p-6 shadow">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Terms & Conditions</h2>
            <Button onClick={addTermCondition} size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add Term
            </Button>
          </div>
          <div className="space-y-3">
            {proposalData.terms_conditions.map((term, index) => (
              <div key={index} className="flex items-start space-x-2">
                <span className="mt-2 text-sm font-medium">{index + 1}.</span>
                <Textarea
                  value={term}
                  onChange={(e) => updateTermCondition(index, e.target.value)}
                  rows={2}
                  className="flex-1"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeTermCondition(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-500" />
                </Button>
              </div>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Additional Notes</h2>
          <Textarea
            value={proposalData.notes}
            onChange={(e) =>
              setProposalData((prev) => ({
                ...prev,
                notes: e.target.value,
              }))
            }
            rows={4}
            placeholder="Add any additional notes or information..."
          />
        </div>
      </div>
    </div>
  );
}