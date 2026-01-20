"use client";

import React, { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { ArrowLeft, Save, Plus, Trash2, Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Image from "next/image";

interface Client {
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
  terms_conditions: string;
  notes: string;
}

export default function CreateProposalPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  const [proposalData, setProposalData] = useState<ProposalData>({
    customer_id: searchParams?.get("customerId") || "",
    customer_name: searchParams?.get("customerName") || "",
    customer_designation: "",
    customer_company: "",
    customer_address: searchParams?.get("customerAddress") || "",
    customer_mobile: searchParams?.get("customerPhone") || "",
    customer_email: searchParams?.get("customerEmail") || "",
    quotation_number: "",
    date: new Date().toISOString().split("T")[0],
    ifo_number: "",
    mode_of_enquiry: "Email",
    payment_terms: "",
    items: [
      {
        id: "1",
        sr_no: 1,
        code: "",
        description: "",
        nop: 1,
        unit_rate: 0,
        amount: 0,
      },
    ],
    discount_percentage: 0,
    igst_percentage: 18,
    bank_name: "",
    branch_name: "",
    account_number: "",
    ifsc_code: "",
    gst_number: "",
    valid_for_days: 30,
    terms_conditions: "",
    notes: "",
  });

  useEffect(() => {
    fetchClients();
    generateQuotationNumber();
  }, []);

  const fetchClients = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("auth_token");
      
      if (!token) {
        console.error("No auth token found");
        alert("Please login again - session expired");
        router.push("/login");
        return;
      }

      console.log("Fetching clients with token:", token.substring(0, 20) + "...");
      
      const response = await fetch("http://localhost:5000/clients", {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      console.log("Response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("Fetched clients:", data);
        setClients(data);
      } else if (response.status === 401) {
        console.error("Authentication failed - token may be expired");
        alert("Your session has expired. Please login again.");
        localStorage.removeItem("auth_token");
        router.push("/login");
      } else {
        console.error("Failed to fetch clients:", response.status);
        const errorData = await response.json().catch(() => ({}));
        console.error("Error details:", errorData);
      }
    } catch (error) {
      console.error("Error fetching clients:", error);
      alert("Failed to load clients. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const generateQuotationNumber = () => {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, "0");
    const random = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    setProposalData((prev) => ({
      ...prev,
      quotation_number: `${year}${month}${random}`,
    }));
  };

  const handleClientChange = (clientId: string) => {
    console.log("Selected client ID:", clientId); // Debug log
    const client = clients.find((c) => c.id === clientId);
    console.log("Found client:", client); // Debug log
    
    if (client) {
      setProposalData((prev) => ({
        ...prev,
        customer_id: client.id,
        customer_name: client.name,
        customer_address: client.address || "",
        customer_mobile: client.phone || "",
        customer_email: client.email || "",
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
    if (proposalData.items.length <= 1) {
      alert("At least one item is required");
      return;
    }
    
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
          const updated = { ...item };
          
          // Update the field
          if (field === "nop" || field === "unit_rate") {
            updated[field] = parseFloat(value) || 0;
          } else {
            updated[field] = value;
          }
          
          // Calculate amount based on NOP
          const nop = updated.nop || 0;
          const unit_rate = updated.unit_rate || 0;
          
          // If NOP is 0, amount = unit_rate (lump sum)
          // If NOP > 0, amount = nop × unit_rate (per-participant)
          if (nop === 0) {
            updated.amount = unit_rate;
          } else {
            updated.amount = nop * unit_rate;
          }
          
          return updated;
        }
        return item;
      }),
    }));
  };

  const calculateSubTotal = () => {
    return proposalData.items.reduce((sum, item) => sum + (item.amount || 0), 0);
  };

  const calculateDiscount = () => {
    return (calculateSubTotal() * (proposalData.discount_percentage || 0)) / 100;
  };

  const calculateIGST = () => {
    const afterDiscount = calculateSubTotal() - calculateDiscount();
    return (afterDiscount * (proposalData.igst_percentage || 0)) / 100;
  };

  const calculateGrandTotal = () => {
    return calculateSubTotal() - calculateDiscount() + calculateIGST();
  };

  const handleSave = async () => {
    if (!proposalData.customer_id) {
      alert("Please select a client");
      return;
    }

    if (proposalData.items.length === 0) {
      alert("Please add at least one item");
      return;
    }

    setSaving(true);

    try {
      const token = localStorage.getItem("auth_token");

      // Convert terms_conditions string to array (split by newlines)
      const termsArray = proposalData.terms_conditions
        .split("\n")
        .filter((term) => term.trim() !== "");

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
        terms_conditions: termsArray,
        notes: proposalData.notes,
        status: "Draft",
        created_by: user?.id,
      };

      const response = await fetch("http://localhost:5000/proposals", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (response.ok) {
        const data = await response.json();
        alert("Proposal created successfully!");
        router.push(`/dashboard/proposals/${data.id}`);
      } else {
        const error = await response.json();
        alert(`Failed to create proposal: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Error creating proposal:", error);
      alert("Failed to create proposal. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      {/* Navigation Header - ABOVE company header */}
      <div className="mx-auto mb-6 max-w-5xl flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="flex items-center"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
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
              Save Proposal
            </>
          )}
        </Button>
      </div>

      {/* FAI Header with Company Details */}
      <div className="mx-auto mb-6 max-w-5xl overflow-hidden rounded-lg border-4 border-blue-600 bg-white">
        <div className="bg-blue-600 py-2 text-center">
          <h2 className="text-xl font-bold text-white">Training Proposal</h2>
        </div>
        <div className="flex items-start justify-between p-6">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Image
              src="/images/fai-logo.png"
              alt="FAI Logo"
              width={120}
              height={120}
              className="object-contain"
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
          <div className="w-[120px] flex-shrink-0"></div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl space-y-6">
        {/* Client Information */}
        <div className="rounded-lg bg-white p-6 shadow">
          <h2 className="mb-4 text-lg font-semibold">Client Information</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Select Client *</Label>
              <Select
                value={proposalData.customer_id}
                onValueChange={handleClientChange}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select client" />
                </SelectTrigger>
                <SelectContent>
                  {clients.length === 0 ? (
                    <SelectItem value="no-clients" disabled>
                      No clients found
                    </SelectItem>
                  ) : (
                    clients.map((client) => (
                      <SelectItem key={client.id} value={client.id}>
                        {client.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Client Name</Label>
              <Input
                value={proposalData.customer_name}
                onChange={(e) =>
                  setProposalData((prev) => ({
                    ...prev,
                    customer_name: e.target.value,
                  }))
                }
                placeholder="Enter client name"
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
                placeholder="e.g., Manager, Procurement"
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
                placeholder="Enter company name"
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
                placeholder="Enter complete address"
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
                placeholder="Enter mobile number"
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
                placeholder="Enter email address"
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
                placeholder="Enter IFO number"
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
                placeholder="e.g., 50% advance, balance on completion"
              />
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
                      placeholder="Enter training description"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label>N.O.P</Label>
                    <Input
                      type="number"
                      value={item.nop}
                      onChange={(e) =>
                        updateItem(item.id, "nop", e.target.value)
                      }
                      min="0"
                    />
                  </div>
                  <div className="col-span-1">
                    <Label>Unit Rate (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={item.unit_rate}
                      onChange={(e) =>
                        updateItem(item.id, "unit_rate", e.target.value)
                      }
                      min="0"
                    />
                  </div>
                </div>
                <div className="mt-2 text-right">
                  <span className="text-sm font-semibold">
                    Amount: ₹{(item.amount || 0).toFixed(2)}
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
                placeholder="Enter bank name"
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
                placeholder="Enter branch name"
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
                placeholder="Enter account number"
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
                placeholder="Enter IFSC code"
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
                placeholder="Enter GST number"
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
          <h2 className="mb-4 text-lg font-semibold">Terms & Conditions</h2>
          <p className="mb-2 text-sm text-gray-600">
            Enter each term on a new line
          </p>
          <Textarea
            value={proposalData.terms_conditions}
            onChange={(e) =>
              setProposalData((prev) => ({
                ...prev,
                terms_conditions: e.target.value,
              }))
            }
            rows={10}
          />
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