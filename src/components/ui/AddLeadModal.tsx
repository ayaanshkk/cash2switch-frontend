"use client";
import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
    Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";

interface Supplier { supplier_id: number; supplier_name: string; }
interface Employee { employee_id: number; employee_name: string; }

interface AddLeadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLeadCreated: () => void;
    service: string;
    suppliers: Supplier[];
    employees: Employee[];
}

export function AddLeadModal({
    isOpen, onClose, onLeadCreated, service: parentService, suppliers, employees,
}: AddLeadModalProps) {
    const [formData, setFormData] = useState({
        service: parentService,
        contact_person: "",
        business_name: "",
        phone: "",
        email: "",
        address: "",
        post_code: "",
        mpan_top: "",
        mpan_bottom: "",
        supplier_id: "",
        annual_usage: "",
        start_date: "",
        end_date: "",
        assigned_to_id: "",
        notes: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setFormData(prev => ({ ...prev, service: parentService }));
    }, [parentService]);

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors(prev => { const n = { ...prev }; delete n[field]; return n; });
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};
        if (!formData.contact_person.trim()) newErrors.contact_person = "Client name is required";
        if (!formData.business_name.trim())  newErrors.business_name  = "Trading name is required";
        if (!formData.phone.trim())           newErrors.phone           = "Phone number is required";
        if (!formData.end_date)               newErrors.end_date        = "Contract end date is required";
        if (!formData.supplier_id)            newErrors.supplier_id     = "Supplier is required";
        if (formData.annual_usage && isNaN(Number(formData.annual_usage)))
            newErrors.annual_usage = "Annual usage must be a number";
        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;
        setSubmitting(true);
        try {
            // ✅ Posts to the CRM leads endpoint — creates Opportunity_Details, NOT Client_Master
            const payload: any = {
                opportunity_title: formData.business_name.trim(),
                business_name:     formData.business_name.trim(),
                contact_person:    formData.contact_person.trim(),
                tel_number:        formData.phone.trim(),
                email:             formData.email.trim()             || undefined,
                address:           formData.address.trim()           || undefined,
                postcode:          formData.post_code.trim()         || undefined,
                mpan_mpr:          formData.mpan_top.trim()          || undefined,
                mpan_bottom:       formData.mpan_bottom.trim()       || undefined,
                supplier_id:       formData.supplier_id ? Number(formData.supplier_id) : undefined,
                annual_usage:      formData.annual_usage ? Number(formData.annual_usage) : undefined,
                start_date:        formData.start_date               || undefined,
                end_date:          formData.end_date                 || undefined,
                service:           formData.service,
                // assigned employee — backend will use current user if not provided
                opportunity_owner_employee_id: formData.assigned_to_id && formData.assigned_to_id !== "0"
                    ? Number(formData.assigned_to_id)
                    : undefined,
                notes: formData.notes.trim() || undefined,
            };

            const response = await fetchWithAuth('/api/crm/leads', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    business_name:                formData.business_name.trim(),
                    contact_person:               formData.contact_person.trim(),
                    tel_number:                   formData.phone.trim(),
                    email:                        formData.email.trim()         || undefined,
                    address:                      formData.address.trim()       || undefined,
                    post_code:                    formData.post_code.trim()     || undefined,
                    mpan_top:                     formData.mpan_top.trim()      || undefined,
                    mpan_bottom:                  formData.mpan_bottom.trim()   || undefined,
                    supplier_id:                  formData.supplier_id ? Number(formData.supplier_id) : undefined,
                    annual_usage:                 formData.annual_usage ? Number(formData.annual_usage) : undefined,
                    start_date:                   formData.start_date           || undefined,
                    end_date:                     formData.end_date             || undefined,
                    service:                      formData.service,
                    opportunity_owner_employee_id: formData.assigned_to_id && formData.assigned_to_id !== "0"
                                                    ? Number(formData.assigned_to_id)
                                                    : undefined,
                    notes:                        formData.notes.trim()         || undefined,
                }),
            });


            if (response?.error) throw new Error(response.error);

            onLeadCreated();
            handleClose();
        } catch (error) {
            console.error("Error creating lead:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Please try again.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData({
            service: parentService,
            contact_person: "", business_name: "", phone: "", email: "",
            address: "", post_code: "", mpan_top: "", mpan_bottom: "",
            supplier_id: "", annual_usage: "", start_date: "", end_date: "",
            assigned_to_id: "", notes: "",
        });
        setErrors({});
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Lead</DialogTitle>
                    <DialogDescription>Add a new lead to the leads list.</DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">

                    {/* Service Type */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Service Type</h3>
                        <div className="flex flex-col space-y-1.5">
                            <Label>Service <span className="text-red-500">*</span></Label>
                            <Select value={formData.service} onValueChange={v => handleChange("service", v)}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Select service type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="utilities">Utilities (Electricity/Gas)</SelectItem>
                                    <SelectItem value="water">Water</SelectItem>
                                </SelectContent>
                            </Select>
                            <p className="text-xs text-gray-500">Select which service category this lead belongs to</p>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Contact Information</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label>Client Name <span className="text-red-500">*</span></Label>
                                <Input placeholder="e.g., John Smith" value={formData.contact_person}
                                    onChange={e => handleChange("contact_person", e.target.value)}
                                    className={errors.contact_person ? "border-red-500" : ""} />
                                {errors.contact_person && <span className="text-red-500 text-xs">{errors.contact_person}</span>}
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label>Trading Name <span className="text-red-500">*</span></Label>
                                <Input placeholder="e.g., Smith Ltd" value={formData.business_name}
                                    onChange={e => handleChange("business_name", e.target.value)}
                                    className={errors.business_name ? "border-red-500" : ""} />
                                {errors.business_name && <span className="text-red-500 text-xs">{errors.business_name}</span>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label>Phone Number <span className="text-red-500">*</span></Label>
                                <Input placeholder="e.g., 07912345678" value={formData.phone}
                                    onChange={e => handleChange("phone", e.target.value)}
                                    className={errors.phone ? "border-red-500" : ""} />
                                {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label>Email</Label>
                                <Input type="email" placeholder="e.g., john@example.com" value={formData.email}
                                    onChange={e => handleChange("email", e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Address</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label>Address</Label>
                                <Input placeholder="e.g., 123 High Street" value={formData.address}
                                    onChange={e => handleChange("address", e.target.value)} />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label>Post Code</Label>
                                <Input placeholder="e.g., SW1A 1AA" value={formData.post_code}
                                    onChange={e => handleChange("post_code", e.target.value)} />
                            </div>
                        </div>
                    </div>

                    {/* Contract Details */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Contract Details</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label>MPAN Top</Label>
                                <Input placeholder="MPAN top" value={formData.mpan_top}
                                    onChange={e => handleChange("mpan_top", e.target.value)} maxLength={13} />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label>MPAN Bottom</Label>
                                <Input placeholder="MPAN bottom" value={formData.mpan_bottom}
                                    onChange={e => handleChange("mpan_bottom", e.target.value)} maxLength={13} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label>Supplier <span className="text-red-500">*</span></Label>
                                <Select value={formData.supplier_id} onValueChange={v => handleChange("supplier_id", v)}>
                                    <SelectTrigger className={errors.supplier_id ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map(s => (
                                            <SelectItem key={s.supplier_id} value={s.supplier_id.toString()}>
                                                {s.supplier_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.supplier_id && <span className="text-red-500 text-xs">{errors.supplier_id}</span>}
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label>Annual Usage (kWh)</Label>
                                <Input type="number" placeholder="e.g., 25000" value={formData.annual_usage}
                                    onChange={e => handleChange("annual_usage", e.target.value)}
                                    className={errors.annual_usage ? "border-red-500" : ""} />
                                {errors.annual_usage && <span className="text-red-500 text-xs">{errors.annual_usage}</span>}
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label>Contract Start</Label>
                                <Input type="date" value={formData.start_date}
                                    onChange={e => handleChange("start_date", e.target.value)} />
                            </div>
                            <div className="flex flex-col space-y-1.5">
                                <Label>Contract End <span className="text-red-500">*</span></Label>
                                <Input type="date" value={formData.end_date}
                                    onChange={e => handleChange("end_date", e.target.value)}
                                    className={errors.end_date ? "border-red-500" : ""} />
                                {errors.end_date && <span className="text-red-500 text-xs">{errors.end_date}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Assignment */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Assignment</h3>
                        <div className="flex flex-col space-y-1.5">
                            <Label>Assign To</Label>
                            <Select value={formData.assigned_to_id} onValueChange={v => handleChange("assigned_to_id", v)}>
                                <SelectTrigger><SelectValue placeholder="Assign to myself (default)" /></SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Assign to myself (default)</SelectItem>
                                    {employees.map(e => (
                                        <SelectItem key={e.employee_id} value={e.employee_id.toString()}>
                                            {e.employee_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Notes */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Notes</h3>
                        <div className="flex flex-col space-y-1.5">
                            <Label>Notes</Label>
                            <Textarea placeholder="Any additional information..." value={formData.notes}
                                onChange={e => handleChange("notes", e.target.value)} rows={3} />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button variant="outline" onClick={handleClose}>Cancel</Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? "Creating..." : "Add Lead"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}