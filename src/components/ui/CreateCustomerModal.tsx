"use client";
import React, { useState, useEffect } from "react";
import { Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";
import { toast } from "react-hot-toast";

interface BillingAuthority {
  supplier_id: number;
  billing_authority: string;
  region?: string;
}

interface CreateClientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onClientCreated: () => void;
}

export function CreateClientModal({
  isOpen,
  onClose,
  onClientCreated,
}: CreateClientModalProps) {
  const [billingAuthorities, setBillingAuthorities] = useState<BillingAuthority[]>([]);

  const [formData, setFormData] = useState({
    business_name: "",
    contact_person: "",
    phone: "",
    email: "",
    address: "",
    post_code: "",
    voa_reference: "",
    billing_authority_id: "",
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) loadBillingAuthorities();
  }, [isOpen]);

  const loadBillingAuthorities = async () => {
    try {
      const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const token = localStorage.getItem("auth_token");
      const resp = await fetch(`${API_BASE_URL}/api/crm/suppliers`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (resp.ok) setBillingAuthorities(await resp.json());
    } catch (err) {
      console.error("Error loading billing authorities:", err);
    }
  };

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => { const e = { ...prev }; delete e[field]; return e; });
    }
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.business_name.trim()) newErrors.business_name = "Business name is required";
    if (!formData.phone.trim())         newErrors.phone         = "Phone number is required";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    try {
      const payload: Record<string, any> = {
        business_name:  formData.business_name.trim(),
        contact_person: formData.contact_person.trim(),
        phone:          formData.phone.trim(),
        email:          formData.email.trim(),
        address:        formData.address.trim(),
        post_code:      formData.post_code.trim(),
        voa_reference:  formData.voa_reference.trim(),
        notes:          formData.notes.trim(),
      };
      if (formData.billing_authority_id) {
        payload.billing_authority_id = parseInt(formData.billing_authority_id);
      }

      await fetchWithAuth("/api/crm/clients", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      toast.success("Client created successfully. Cases can be added via import.");
      onClientCreated();
      handleClose();
    } catch (error) {
      console.error("Error creating client:", error);
      toast.error(error instanceof Error ? error.message : "Failed to create client");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setFormData({
      business_name: "",
      contact_person: "",
      phone: "",
      email: "",
      address: "",
      post_code: "",
      voa_reference: "",
      billing_authority_id: "",
      notes: "",
    });
    setErrors({});
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Add New Client
          </DialogTitle>
          <DialogDescription>
            Create a new business rates client. Cases must be added separately via Excel import.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-4">

          {/* Business Name */}
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="business_name">
              Business Name <span className="text-red-500">*</span>
            </Label>
            <Input
              id="business_name"
              placeholder="e.g. Acme Ltd"
              value={formData.business_name}
              onChange={e => handleChange("business_name", e.target.value)}
              className={errors.business_name ? "border-red-500" : ""}
            />
            {errors.business_name && <span className="text-red-500 text-xs">{errors.business_name}</span>}
          </div>

          {/* Contact Person + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="contact_person">Contact Person</Label>
              <Input
                id="contact_person"
                placeholder="e.g. John Smith"
                value={formData.contact_person}
                onChange={e => handleChange("contact_person", e.target.value)}
              />
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="phone">
                Phone Number <span className="text-red-500">*</span>
              </Label>
              <Input
                id="phone"
                placeholder="e.g. 0161 123 4567"
                value={formData.phone}
                onChange={e => handleChange("phone", e.target.value)}
                className={errors.phone ? "border-red-500" : ""}
              />
              {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g. contact@acme.co.uk"
              value={formData.email}
              onChange={e => handleChange("email", e.target.value)}
            />
          </div>

          {/* VOA Reference + Billing Authority */}
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="voa_reference">VOA Reference</Label>
              <Input
                id="voa_reference"
                placeholder="e.g. 123456789000"
                value={formData.voa_reference}
                onChange={e => handleChange("voa_reference", e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-gray-500">VOA property reference or UPRN</p>
            </div>
            <div className="flex flex-col space-y-1.5">
              <Label htmlFor="billing_authority">Billing Authority</Label>
              <Select
                value={formData.billing_authority_id}
                onValueChange={v => handleChange("billing_authority_id", v)}
              >
                <SelectTrigger id="billing_authority">
                  <SelectValue placeholder="Select billing authority" />
                </SelectTrigger>
                <SelectContent>
                  {billingAuthorities.map(b => (
                    <SelectItem key={b.supplier_id} value={b.supplier_id.toString()}>
                      {b.billing_authority}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">Local council issuing rates bill</p>
            </div>
          </div>

          {/* Property Address + Post Code */}
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="address">Property Address</Label>
            <Textarea
              id="address"
              placeholder="e.g. Unit 4, Trafford Park, Manchester"
              value={formData.address}
              onChange={e => handleChange("address", e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="post_code">Post Code</Label>
            <Input
              id="post_code"
              placeholder="e.g. M17 1AA"
              value={formData.post_code}
              onChange={e => handleChange("post_code", e.target.value)}
              className="max-w-[160px]"
            />
          </div>

          {/* Notes */}
          <div className="flex flex-col space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional information about this client or case..."
              value={formData.notes}
              onChange={e => handleChange("notes", e.target.value)}
              rows={3}
            />
          </div>

          {/* Info banner */}
          <div className="rounded-lg bg-blue-50 border border-blue-200 p-3 text-sm text-blue-800">
            <strong>Note:</strong> This creates the client record only. To add cases (VOA appeals, assessments),
            use the <strong>Bulk Import</strong> feature on the Cases page.
          </div>
        </div>

        <div className="flex justify-end space-x-2 pt-4 border-t">
          <Button variant="outline" onClick={handleClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-black hover:bg-gray-800">
            {submitting ? "Creating..." : "Create Client"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}