"use client";
import React, { useState, useEffect } from "react";
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

interface Supplier {
  supplier_id: number;
  supplier_name: string;
}

interface Employee {
  employee_id: number;
  employee_name: string;
}

interface AddEnergyClientModalProps {
    isOpen: boolean;
    onClose: () => void;
    onClientCreated: () => void;
    service: string;
    suppliers: Supplier[];
    employees: Employee[];
}

export function AddEnergyClientModal({
    isOpen,
    onClose,
    onClientCreated,
    service: parentService,
    suppliers,
    employees,
}: AddEnergyClientModalProps) {
    const [formData, setFormData] = useState({
        service: parentService,
        contact_person: "",
        business_name: "",
        phone: "",
        email: "",
        address: "",
        post_code: "",
        site_address: "",
        mpan_top: "",
        mpan_bottom: "",
        supplier_id: "",
        annual_usage: "",
        start_date: "",
        end_date: "",
        unit_rate: "",
        assigned_to_id: "",
        notes: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        setFormData(prev => ({ ...prev, service: parentService }));
    }, [parentService]);

    const handleChange = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const validate = () => {
        const newErrors: Record<string, string> = {};

        if (!formData.contact_person.trim()) {
            newErrors.contact_person = "Client name is required";
        }
        if (!formData.business_name.trim()) {
            newErrors.business_name = "Trading name is required";
        }
        if (!formData.phone.trim()) {
            newErrors.phone = "Phone number is required";
        }
        if (!formData.end_date) {
            newErrors.end_date = "Contract end date is required";
        }
        if (!formData.service) {
            newErrors.service = "Service type is required";
        }
        if (!formData.supplier_id) {
            newErrors.supplier_id = "Supplier is required";
        }
        if (formData.annual_usage && isNaN(Number(formData.annual_usage))) {
            newErrors.annual_usage = "Annual usage must be a number";
        }
        if (formData.unit_rate && isNaN(Number(formData.unit_rate))) {
            newErrors.unit_rate = "Unit rate must be a number";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        if (!validate()) return;

        setSubmitting(true);

        try {
            const payload: any = {
                contact_person: formData.contact_person.trim(),
                business_name: formData.business_name.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim() || undefined,
                address: formData.address.trim() || undefined,
                post_code: formData.post_code.trim() || undefined,
                site_address: formData.site_address.trim() || undefined,
                mpan_top: formData.mpan_top.trim() || undefined,
                mpan_bottom: formData.mpan_bottom.trim() || undefined,
                supplier_id: formData.supplier_id ? Number(formData.supplier_id) : undefined,
                annual_usage: formData.annual_usage ? Number(formData.annual_usage) : undefined,
                start_date: formData.start_date || undefined,
                end_date: formData.end_date || undefined,
                unit_rate: formData.unit_rate ? Number(formData.unit_rate) : 0,
                assigned_to_id: formData.assigned_to_id ? Number(formData.assigned_to_id) : undefined,
                notes: formData.notes.trim() || undefined,
                service: formData.service,
            };

            const response = await fetchWithAuth('/energy-clients', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (response.error) {
                throw new Error(response.error);
            }

            onClientCreated();
            handleClose();
        } catch (error) {
            console.error("Error creating energy client:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Please try again.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setFormData({
            service: parentService,
            contact_person: "",
            business_name: "",
            phone: "",
            email: "",
            address: "",
            post_code: "",
            site_address: "",
            mpan_top: "",
            mpan_bottom: "",
            supplier_id: "",
            annual_usage: "",
            start_date: "",
            end_date: "",
            unit_rate: "",
            assigned_to_id: "",
            notes: "",
        });
        setErrors({});
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Add Lead</DialogTitle>
                    <DialogDescription>
                        Add a new lead to the leads list.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">

                    {/* Service Type */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Service Type</h3>
                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="service">
                                Service <span className="text-red-500">*</span>
                            </Label>
                            <Select
                                value={formData.service}
                                onValueChange={(value) => handleChange("service", value)}
                            >
                                <SelectTrigger className={errors.service ? "border-red-500" : ""}>
                                    <SelectValue placeholder="Select service type" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="utilities">Utilities (Electricity/Gas)</SelectItem>
                                    <SelectItem value="water">Water</SelectItem>
                                </SelectContent>
                            </Select>
                            {errors.service && <span className="text-red-500 text-xs">{errors.service}</span>}
                            <p className="text-xs text-gray-500">
                                Select which service category this customer belongs to
                            </p>
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Contact Information</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="contact_person">
                                    Client Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="contact_person"
                                    placeholder="e.g., John Smith"
                                    value={formData.contact_person}
                                    onChange={(e) => handleChange("contact_person", e.target.value)}
                                    className={errors.contact_person ? "border-red-500" : ""}
                                />
                                {errors.contact_person && <span className="text-red-500 text-xs">{errors.contact_person}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="business_name">
                                    Trading Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="business_name"
                                    placeholder="e.g., Smith Ltd"
                                    value={formData.business_name}
                                    onChange={(e) => handleChange("business_name", e.target.value)}
                                    className={errors.business_name ? "border-red-500" : ""}
                                />
                                {errors.business_name && <span className="text-red-500 text-xs">{errors.business_name}</span>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="phone">
                                    Phone Number <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="phone"
                                    placeholder="e.g., 07912345678"
                                    value={formData.phone}
                                    onChange={(e) => handleChange("phone", e.target.value)}
                                    className={errors.phone ? "border-red-500" : ""}
                                />
                                {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="e.g., john@example.com"
                                    value={formData.email}
                                    onChange={(e) => handleChange("email", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address Information */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Address Information</h3>

                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="address">Address</Label>
                            <Textarea
                                id="address"
                                placeholder="Enter full address"
                                value={formData.address}
                                onChange={(e) => handleChange("address", e.target.value)}
                                rows={2}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="post_code">Post Code</Label>
                                <Input
                                    id="post_code"
                                    placeholder="e.g., SW1A 1AA"
                                    value={formData.post_code}
                                    onChange={(e) => handleChange("post_code", e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="site_address">Site Address (if different)</Label>
                                <Input
                                    id="site_address"
                                    placeholder="Alternative site location"
                                    value={formData.site_address}
                                    onChange={(e) => handleChange("site_address", e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Contract Details */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Contract Details</h3>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="mpan_top">MPAN Top</Label>
                                <Input
                                    id="mpan_top"
                                    placeholder="MPAN top"
                                    value={formData.mpan_top}
                                    onChange={(e) => handleChange("mpan_top", e.target.value)}
                                    maxLength={13}
                                    className={errors.mpan_top ? "border-red-500" : ""}
                                />
                                {errors.mpan_top && <span className="text-red-500 text-xs">{errors.mpan_top}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="mpan_bottom">MPAN Bottom</Label>
                                <Input
                                    id="mpan_bottom"
                                    placeholder="MPAN bottom"
                                    value={formData.mpan_bottom}
                                    onChange={(e) => handleChange("mpan_bottom", e.target.value)}
                                    maxLength={13}
                                    className={errors.mpan_bottom ? "border-red-500" : ""}
                                />
                                {errors.mpan_bottom && <span className="text-red-500 text-xs">{errors.mpan_bottom}</span>}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="supplier_id">
                                    Supplier <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.supplier_id}
                                    onValueChange={(value) => handleChange("supplier_id", value)}
                                >
                                    <SelectTrigger className={errors.supplier_id ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select supplier" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {suppliers.map((supplier) => (
                                            <SelectItem key={supplier.supplier_id} value={supplier.supplier_id.toString()}>
                                                {supplier.supplier_name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                                {errors.supplier_id && <span className="text-red-500 text-xs">{errors.supplier_id}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="annual_usage">Annual Usage (kWh)</Label>
                                <Input
                                    id="annual_usage"
                                    type="number"
                                    placeholder="e.g., 25000"
                                    value={formData.annual_usage}
                                    onChange={(e) => handleChange("annual_usage", e.target.value)}
                                    className={errors.annual_usage ? "border-red-500" : ""}
                                />
                                {errors.annual_usage && <span className="text-red-500 text-xs">{errors.annual_usage}</span>}
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="start_date">Contract Start</Label>
                                <Input
                                    id="start_date"
                                    type="date"
                                    value={formData.start_date}
                                    onChange={(e) => handleChange("start_date", e.target.value)}
                                />
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="end_date">
                                    Contract End <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="end_date"
                                    type="date"
                                    value={formData.end_date}
                                    onChange={(e) => handleChange("end_date", e.target.value)}
                                    className={errors.end_date ? "border-red-500" : ""}
                                />
                                {errors.end_date && <span className="text-red-500 text-xs">{errors.end_date}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="unit_rate">Unit Rate (p/kWh)</Label>
                                <Input
                                    id="unit_rate"
                                    type="number"
                                    step="0.01"
                                    placeholder="e.g., 15.50"
                                    value={formData.unit_rate}
                                    onChange={(e) => handleChange("unit_rate", e.target.value)}
                                    className={errors.unit_rate ? "border-red-500" : ""}
                                />
                                {errors.unit_rate && <span className="text-red-500 text-xs">{errors.unit_rate}</span>}
                            </div>
                        </div>
                    </div>

                    {/* Assignment */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Assignment</h3>

                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="assigned_to_id">Assign To</Label>
                            <Select
                                value={formData.assigned_to_id}
                                onValueChange={(value) => handleChange("assigned_to_id", value)}
                            >
                                <SelectTrigger>
                                    <SelectValue placeholder="Select salesperson" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="0">Unassigned</SelectItem>
                                    {employees.map((emp) => (
                                        <SelectItem key={emp.employee_id} value={emp.employee_id.toString()}>
                                            {emp.employee_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Additional Notes */}
                    <div className="space-y-4">
                        <h3 className="text-sm font-semibold text-gray-900 border-b pb-2">Additional Notes</h3>

                        <div className="flex flex-col space-y-1.5">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Any additional information or special requirements"
                                value={formData.notes}
                                onChange={(e) => handleChange("notes", e.target.value)}
                                rows={3}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? "Creating..." : "Add Lead"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}