"use client";
import React, { useState } from "react";
import { X, Building2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
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
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { fetchWithAuth } from "@/lib/api";

type CustomerType = 'Individual' | 'Commercial';
type MHEType = 'Forklift' | 'BOPT' | 'Reach Truck' | 'Stacker' | 'Other';
type ServiceType = 'Training' | 'MHE Audit' | 'Workplace Audit' | 'Other';

interface CreateCustomerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCustomerCreated: () => void;
}

export function CreateCustomerModal({
    isOpen,
    onClose,
    onCustomerCreated,
}: CreateCustomerModalProps) {
    const [customerType, setCustomerType] = useState<CustomerType>('Individual');
    
    // Individual Customer Fields
    const [individualData, setIndividualData] = useState({
        name: "",
        phone: "",
        address: "",
        mhe_type: "" as MHEType | "",
        mhe_type_other: "",
        notes: "",
    });

    // Commercial Customer Fields
    const [commercialData, setCommercialData] = useState({
        company_name: "",
        address: "",
        phone: "",
        manager_name: "",
        participants_count: "",
        mhe_type: "" as MHEType | "",
        mhe_type_other: "",
        service_needed: [] as ServiceType[],
        service_other: "",
        notes: "",
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [submitting, setSubmitting] = useState(false);

    const handleIndividualChange = (field: keyof typeof individualData, value: string) => {
        setIndividualData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleCommercialChange = (field: keyof typeof commercialData, value: string | string[]) => {
        setCommercialData((prev) => ({ ...prev, [field]: value }));
        if (errors[field]) {
            setErrors((prev) => {
                const newErrors = { ...prev };
                delete newErrors[field];
                return newErrors;
            });
        }
    };

    const handleServiceToggle = (service: ServiceType) => {
        setCommercialData((prev) => {
            const currentServices = prev.service_needed || [];
            const newServices = currentServices.includes(service)
                ? currentServices.filter((s) => s !== service)
                : [...currentServices, service];
            return { ...prev, service_needed: newServices };
        });
    };

    const validateIndividual = () => {
        const newErrors: Record<string, string> = {};

        if (!individualData.name.trim()) {
            newErrors.name = "Name is required";
        }
        if (!individualData.phone.trim()) {
            newErrors.phone = "Phone number is required";
        }
        if (!individualData.address.trim()) {
            newErrors.address = "Address is required";
        }
        if (!individualData.mhe_type) {
            newErrors.mhe_type = "MHE Type is required";
        }
        if (individualData.mhe_type === 'Other' && !individualData.mhe_type_other.trim()) {
            newErrors.mhe_type_other = "Please specify MHE type";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const validateCommercial = () => {
        const newErrors: Record<string, string> = {};

        if (!commercialData.company_name.trim()) {
            newErrors.company_name = "Company name is required";
        }
        if (!commercialData.phone.trim()) {
            newErrors.phone = "Phone number is required";
        }
        if (!commercialData.address.trim()) {
            newErrors.address = "Address is required";
        }
        if (!commercialData.manager_name.trim()) {
            newErrors.manager_name = "Manager name is required";
        }
        if (!commercialData.participants_count.trim()) {
            newErrors.participants_count = "Number of participants is required";
        }
        if (!commercialData.mhe_type) {
            newErrors.mhe_type = "MHE Type is required";
        }
        if (commercialData.mhe_type === 'Other' && !commercialData.mhe_type_other.trim()) {
            newErrors.mhe_type_other = "Please specify MHE type";
        }
        if (commercialData.service_needed.length === 0) {
            newErrors.service_needed = "Please select at least one service";
        }
        if (commercialData.service_needed.includes('Other') && !commercialData.service_other.trim()) {
            newErrors.service_other = "Please specify service type";
        }

        setErrors(newErrors);
        return Object.keys(newErrors).length === 0;
    };

    const handleSubmit = async () => {
        const isValid = customerType === 'Individual' 
            ? validateIndividual() 
            : validateCommercial();

        if (!isValid) return;

        setSubmitting(true);

        try {
            let payload: any = {};

            if (customerType === 'Individual') {
                const mheType = individualData.mhe_type === 'Other' 
                    ? individualData.mhe_type_other 
                    : individualData.mhe_type;

                payload = {
                    name: individualData.name,
                    phone: individualData.phone,
                    address: individualData.address,
                    notes: `Customer Type: Individual | MHE Type: ${mheType}${individualData.notes ? ` | ${individualData.notes}` : ''}`,
                    salesperson: "", // Can be assigned later
                    status: "Active",
                };
            } else {
                const mheType = commercialData.mhe_type === 'Other' 
                    ? commercialData.mhe_type_other 
                    : commercialData.mhe_type;

                const services = commercialData.service_needed.map(s => 
                    s === 'Other' ? commercialData.service_other : s
                ).join(', ');

                payload = {
                    name: commercialData.company_name,
                    phone: commercialData.phone,
                    address: commercialData.address,
                    notes: `Customer Type: Commercial | Manager: ${commercialData.manager_name} | Participants: ${commercialData.participants_count} | MHE Type: ${mheType} | Services: ${services}${commercialData.notes ? ` | ${commercialData.notes}` : ''}`,
                    salesperson: "", // Can be assigned later
                    status: "Active",
                };
            }

            const response = await fetchWithAuth('/clients', {
                method: "POST",
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || "Failed to create customer");
            }

            onCustomerCreated();
            handleClose();
        } catch (error) {
            console.error("Error creating customer:", error);
            alert(`Error: ${error instanceof Error ? error.message : 'Please try again.'}`);
        } finally {
            setSubmitting(false);
        }
    };

    const handleClose = () => {
        setCustomerType('Individual');
        setIndividualData({
            name: "",
            phone: "",
            address: "",
            mhe_type: "",
            mhe_type_other: "",
            notes: "",
        });
        setCommercialData({
            company_name: "",
            address: "",
            phone: "",
            manager_name: "",
            participants_count: "",
            mhe_type: "",
            mhe_type_other: "",
            service_needed: [],
            service_other: "",
            notes: "",
        });
        setErrors({});
        onClose();
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Create New Customer</DialogTitle>
                    <DialogDescription>
                        Add a new customer for forklift training services.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-6 py-4">
                    {/* Customer Type Selection */}
                    <div className="flex flex-col space-y-3">
                        <Label>Customer Type <span className="text-red-500">*</span></Label>
                        <RadioGroup value={customerType} onValueChange={(value) => setCustomerType(value as CustomerType)}>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                                <RadioGroupItem value="Individual" id="individual" />
                                <Label htmlFor="individual" className="flex items-center gap-2 cursor-pointer flex-1">
                                    <User className="h-4 w-4" />
                                    <div>
                                        <div className="font-medium">Individual</div>
                                        <div className="text-xs text-gray-500">Personal training for one person</div>
                                    </div>
                                </Label>
                            </div>
                            <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50">
                                <RadioGroupItem value="Commercial" id="commercial" />
                                <Label htmlFor="commercial" className="flex items-center gap-2 cursor-pointer flex-1">
                                    <Building2 className="h-4 w-4" />
                                    <div>
                                        <div className="font-medium">Commercial</div>
                                        <div className="text-xs text-gray-500">Company/organization training</div>
                                    </div>
                                </Label>
                            </div>
                        </RadioGroup>
                    </div>

                    {/* INDIVIDUAL CUSTOMER FORM */}
                    {customerType === 'Individual' && (
                        <>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="name">
                                    Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    placeholder="Enter full name"
                                    value={individualData.name}
                                    onChange={(e) => handleIndividualChange("name", e.target.value)}
                                    className={errors.name ? "border-red-500" : ""}
                                />
                                {errors.name && <span className="text-red-500 text-xs">{errors.name}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="phone">
                                    Phone Number <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="phone"
                                    placeholder="+91-XXXXXXXXXX"
                                    value={individualData.phone}
                                    onChange={(e) => handleIndividualChange("phone", e.target.value)}
                                    className={errors.phone ? "border-red-500" : ""}
                                />
                                {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="address">
                                    Address <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="address"
                                    placeholder="Enter full address with city and PIN code"
                                    value={individualData.address}
                                    onChange={(e) => handleIndividualChange("address", e.target.value)}
                                    rows={3}
                                    className={errors.address ? "border-red-500" : ""}
                                />
                                {errors.address && <span className="text-red-500 text-xs">{errors.address}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="mhe_type">
                                    MHE Type <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={individualData.mhe_type}
                                    onValueChange={(value) => handleIndividualChange("mhe_type", value as MHEType)}
                                >
                                    <SelectTrigger className={errors.mhe_type ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select MHE type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Equipment Type</SelectLabel>
                                            <SelectItem value="Forklift">Forklift</SelectItem>
                                            <SelectItem value="BOPT">BOPT (Battery Operated Pallet Truck)</SelectItem>
                                            <SelectItem value="Reach Truck">Reach Truck</SelectItem>
                                            <SelectItem value="Stacker">Stacker</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                {errors.mhe_type && <span className="text-red-500 text-xs">{errors.mhe_type}</span>}
                            </div>

                            {individualData.mhe_type === 'Other' && (
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="mhe_type_other">
                                        Specify MHE Type <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="mhe_type_other"
                                        placeholder="Enter equipment type"
                                        value={individualData.mhe_type_other}
                                        onChange={(e) => handleIndividualChange("mhe_type_other", e.target.value)}
                                        className={errors.mhe_type_other ? "border-red-500" : ""}
                                    />
                                    {errors.mhe_type_other && <span className="text-red-500 text-xs">{errors.mhe_type_other}</span>}
                                </div>
                            )}

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="notes">Additional Notes</Label>
                                <Textarea
                                    id="notes"
                                    placeholder="Any special requirements or notes"
                                    value={individualData.notes}
                                    onChange={(e) => handleIndividualChange("notes", e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </>
                    )}

                    {/* COMMERCIAL CUSTOMER FORM */}
                    {customerType === 'Commercial' && (
                        <>
                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="company_name">
                                    Company Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="company_name"
                                    placeholder="Enter company name"
                                    value={commercialData.company_name}
                                    onChange={(e) => handleCommercialChange("company_name", e.target.value)}
                                    className={errors.company_name ? "border-red-500" : ""}
                                />
                                {errors.company_name && <span className="text-red-500 text-xs">{errors.company_name}</span>}
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="manager_name">
                                        Manager Name <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="manager_name"
                                        placeholder="Contact person name"
                                        value={commercialData.manager_name}
                                        onChange={(e) => handleCommercialChange("manager_name", e.target.value)}
                                        className={errors.manager_name ? "border-red-500" : ""}
                                    />
                                    {errors.manager_name && <span className="text-red-500 text-xs">{errors.manager_name}</span>}
                                </div>

                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="phone">
                                        Phone Number <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="phone"
                                        placeholder="+91-XXXXXXXXXX"
                                        value={commercialData.phone}
                                        onChange={(e) => handleCommercialChange("phone", e.target.value)}
                                        className={errors.phone ? "border-red-500" : ""}
                                    />
                                    {errors.phone && <span className="text-red-500 text-xs">{errors.phone}</span>}
                                </div>
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="address">
                                    Company Address <span className="text-red-500">*</span>
                                </Label>
                                <Textarea
                                    id="address"
                                    placeholder="Enter company address with city and PIN code"
                                    value={commercialData.address}
                                    onChange={(e) => handleCommercialChange("address", e.target.value)}
                                    rows={3}
                                    className={errors.address ? "border-red-500" : ""}
                                />
                                {errors.address && <span className="text-red-500 text-xs">{errors.address}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="participants_count">
                                    Number of Participants <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="participants_count"
                                    type="number"
                                    placeholder="How many people need training?"
                                    value={commercialData.participants_count}
                                    onChange={(e) => handleCommercialChange("participants_count", e.target.value)}
                                    className={errors.participants_count ? "border-red-500" : ""}
                                />
                                {errors.participants_count && <span className="text-red-500 text-xs">{errors.participants_count}</span>}
                            </div>

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="commercial_mhe_type">
                                    MHE Type <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={commercialData.mhe_type}
                                    onValueChange={(value) => handleCommercialChange("mhe_type", value as MHEType)}
                                >
                                    <SelectTrigger className={errors.mhe_type ? "border-red-500" : ""}>
                                        <SelectValue placeholder="Select MHE type" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectGroup>
                                            <SelectLabel>Equipment Type</SelectLabel>
                                            <SelectItem value="Forklift">Forklift</SelectItem>
                                            <SelectItem value="BOPT">BOPT (Battery Operated Pallet Truck)</SelectItem>
                                            <SelectItem value="Reach Truck">Reach Truck</SelectItem>
                                            <SelectItem value="Stacker">Stacker</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectGroup>
                                    </SelectContent>
                                </Select>
                                {errors.mhe_type && <span className="text-red-500 text-xs">{errors.mhe_type}</span>}
                            </div>

                            {commercialData.mhe_type === 'Other' && (
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="commercial_mhe_type_other">
                                        Specify MHE Type <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="commercial_mhe_type_other"
                                        placeholder="Enter equipment type"
                                        value={commercialData.mhe_type_other}
                                        onChange={(e) => handleCommercialChange("mhe_type_other", e.target.value)}
                                        className={errors.mhe_type_other ? "border-red-500" : ""}
                                    />
                                    {errors.mhe_type_other && <span className="text-red-500 text-xs">{errors.mhe_type_other}</span>}
                                </div>
                            )}

                            <div className="flex flex-col space-y-1.5">
                                <Label>
                                    Services Needed <span className="text-red-500">*</span>
                                </Label>
                                <div className="flex flex-col space-y-2 mt-2">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="training"
                                            checked={commercialData.service_needed.includes('Training')}
                                            onCheckedChange={() => handleServiceToggle('Training')}
                                        />
                                        <label htmlFor="training" className="text-sm font-medium cursor-pointer">
                                            Training
                                        </label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="mhe_audit"
                                            checked={commercialData.service_needed.includes('MHE Audit')}
                                            onCheckedChange={() => handleServiceToggle('MHE Audit')}
                                        />
                                        <label htmlFor="mhe_audit" className="text-sm font-medium cursor-pointer">
                                            MHE Audit
                                        </label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="workplace_audit"
                                            checked={commercialData.service_needed.includes('Workplace Audit')}
                                            onCheckedChange={() => handleServiceToggle('Workplace Audit')}
                                        />
                                        <label htmlFor="workplace_audit" className="text-sm font-medium cursor-pointer">
                                            Workplace Audit
                                        </label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="service_other"
                                            checked={commercialData.service_needed.includes('Other')}
                                            onCheckedChange={() => handleServiceToggle('Other')}
                                        />
                                        <label htmlFor="service_other" className="text-sm font-medium cursor-pointer">
                                            Other
                                        </label>
                                    </div>
                                </div>
                                {errors.service_needed && <span className="text-red-500 text-xs">{errors.service_needed}</span>}
                            </div>

                            {commercialData.service_needed.includes('Other') && (
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="service_other">
                                        Specify Service <span className="text-red-500">*</span>
                                    </Label>
                                    <Input
                                        id="service_other"
                                        placeholder="Enter service type"
                                        value={commercialData.service_other}
                                        onChange={(e) => handleCommercialChange("service_other", e.target.value)}
                                        className={errors.service_other ? "border-red-500" : ""}
                                    />
                                    {errors.service_other && <span className="text-red-500 text-xs">{errors.service_other}</span>}
                                </div>
                            )}

                            <div className="flex flex-col space-y-1.5">
                                <Label htmlFor="commercial_notes">Additional Notes</Label>
                                <Textarea
                                    id="commercial_notes"
                                    placeholder="Any special requirements or notes"
                                    value={commercialData.notes}
                                    onChange={(e) => handleCommercialChange("notes", e.target.value)}
                                    rows={2}
                                />
                            </div>
                        </>
                    )}
                </div>

                <div className="flex justify-end space-x-2 pt-4 border-t">
                    <Button variant="outline" onClick={handleClose}>
                        Cancel
                    </Button>
                    <Button onClick={handleSubmit} disabled={submitting}>
                        {submitting ? "Creating..." : "Create Customer"}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}