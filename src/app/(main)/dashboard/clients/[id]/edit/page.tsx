"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Save, Search, AlertCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/contexts/AuthContext";
import { fetchWithAuth } from "@/lib/api";

const FIELD_LABELS: Record<string, string> = {
  first_name: "First Name",
  last_name: "Last Name",
  email: "Email",
  kitchen_size: "Kitchen Size",
  bedroom_count: "Number of Bedrooms",
};

type ProjectType = "Bedroom" | "Kitchen" | "Other";

interface Address {
  line_1: string;
  line_2?: string;
  line_3?: string;
  post_town: string;
  postcode: string;
  formatted_address: string;
}

// Define stage permissions by role
const ROLE_STAGE_PERMISSIONS: Record<string, string[]> = {
  Sales: ["Lead", "Quote", "Consultation", "Survey", "Measure", "Design", "Quoted"],
  Production: ["Lead", "Quote", "Consultation", "Survey", "Measure", "Design", "Quoted", "Accepted", "Rejected", "Production", "Delivery", "Installation"],
  Manager: ["Lead", "Quote", "Consultation", "Survey", "Measure", "Design", "Quoted", "Accepted", "Rejected", "Production", "Delivery", "Installation", "Complete", "Remedial", "Cancelled"],
  HR: ["Lead", "Quote", "Consultation", "Survey", "Measure", "Design", "Quoted", "Accepted", "Rejected", "Production", "Delivery", "Installation", "Complete", "Remedial", "Cancelled"],
};

export default function CustomerEditPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const id = params?.id;
  const [customer, setCustomer] = useState<any | null>(null);
  const [formData, setFormData] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loadingAddresses, setLoadingAddresses] = useState(false);
  const [showManualAddress, setShowManualAddress] = useState(false);
  const [selectedAddressIndex, setSelectedAddressIndex] = useState<string>("");

  useEffect(() => {
    if (!id) return;
    setLoading(true);

    fetchWithAuth(`/clients/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch customer");
        return res.json();
      })
      .then((data) => {
        // Check for receipt submission redirect
        const receiptSubmission = data.form_submissions?.find((sub: any) => {
          const submissionData =
            typeof sub.form_data === "string" ? JSON.parse(sub.form_data || "{}") : sub.form_data || {};
          return (
            submissionData["Is Receipt"] === "true" ||
            submissionData["Form Type"] === "Receipt Receipt" ||
            submissionData["Receipt Type"] !== undefined
          );
        });

        if (receiptSubmission) {
          const receiptData =
            typeof receiptSubmission.form_data === "string"
              ? JSON.parse(receiptSubmission.form_data || "{}")
              : receiptSubmission.form_data || {};

          const query = new URLSearchParams({
            customerId: id as string,
            customerName: receiptData["Customer Name"] || data.name || "N/A",
            customerAddress: receiptData["Customer Address"] || data.address || "N/A",
            customerPhone: receiptData["Customer Phone"] || data.phone || "N/A",
            type: receiptData["Receipt Type"]?.toLowerCase() || "receipt",
          }).toString();

          router.replace(`/dashboard/receipts?${query}`);
          return;
        }

        setCustomer(data);
        const submission =
          Array.isArray(data.form_submissions) && data.form_submissions.length > 0 ? data.form_submissions[0] : {};
        const parsedFormData =
          typeof submission.form_data === "string"
            ? JSON.parse(submission.form_data || "{}")
            : submission.form_data || {};

        // Filter out receipt-specific fields
        const filteredFormData: any = {};
        Object.entries(parsedFormData).forEach(([key, value]) => {
          if (
            !key.includes("Receipt") &&
            !key.includes("Customer Information") &&
            !key.includes("Design Specifications") &&
            !key.includes("Terms & Information") &&
            !key.includes("Customer Signature") &&
            key !== "Is Receipt" &&
            key !== "Form Type" &&
            key !== "Payment Method" &&
            key !== "Payment Description" &&
            key !== "Paid Amount" &&
            key !== "Total Paid To Date" &&
            key !== "Balance To Pay"
          ) {
            filteredFormData[key] = value;
          }
        });

        setFormData(filteredFormData);

        if (data.address) {
          setShowManualAddress(true);
        }
      })
      .catch((err) => console.error("Error loading customer:", err))
      .finally(() => setLoading(false));
  }, [id, router, user]);

  const handleCustomerChange = (field: string, value: string) => {
    setCustomer((prev: any) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleProjectTypeToggle = (type: ProjectType) => {
    setCustomer((prev: any) => {
      const currentTypes = prev.project_types || [];
      const newTypes = currentTypes.includes(type)
        ? currentTypes.filter((t: ProjectType) => t !== type)
        : [...currentTypes, type];
      return { ...prev, project_types: newTypes };
    });
  };

  const handleFormDataChange = (field: string, value: string) => {
    setFormData((prev: any) => ({ ...prev, [field]: value }));
  };

  const searchAddresses = async () => {
    if (!customer.postcode || customer.postcode.trim() === "") {
      setErrors((prev) => ({ ...prev, postcode: "Please enter a postcode" }));
      return;
    }

    setLoadingAddresses(true);
    setAddresses([]);
    setSelectedAddressIndex("");
    setShowManualAddress(false);

    try {
      const apiKey = process.env.NEXT_PUBLIC_GETADDRESS_API_KEY;
      const cleanPostcode = customer.postcode.replace(/\s/g, '');
      const response = await fetch(
        `https://api.getaddress.io/find/${encodeURIComponent(cleanPostcode)}?api-key=${apiKey}&expand=true`
      );

      if (response.ok) {
        const data = await response.json();

        if (data.addresses && data.addresses.length > 0) {
          const formattedAddresses: Address[] = data.addresses.map((addr: any) => ({
            line_1: addr.line_1 || addr.formatted_address?.[0] || '',
            line_2: addr.line_2 || addr.formatted_address?.[1] || '',
            line_3: addr.line_3 || addr.formatted_address?.[2] || '',
            post_town: addr.town_or_city || addr.formatted_address?.[5] || '',
            postcode: customer.postcode,
            formatted_address: addr.formatted_address?.filter(Boolean).join(', ') || 
                             [addr.line_1, addr.line_2, addr.line_3, addr.town_or_city, customer.postcode]
                               .filter(Boolean).join(', ')
          }));

          setAddresses(formattedAddresses);
        } else {
          setShowManualAddress(true);
        }
      } else {
        const errorText = await response.text();
        console.error("API Error:", response.status, response.statusText, errorText);

        if (response.status === 404) {
          alert(
            "No addresses found for this postcode, or API key issue. Please enter manually.",
          );
        }
        setShowManualAddress(true);
      }
    } catch (error) {
      console.error("Error fetching addresses:", error);
      setShowManualAddress(true);
    } finally {
      setLoadingAddresses(false);
    }
  };

  const selectAddress = (index: string) => {
    const address = addresses[parseInt(index)];
    if (address) {
      setSelectedAddressIndex(index);
      setCustomer((prev: any) => ({
        ...prev,
        address: address.formatted_address,
      }));
      if (errors.address) {
        setErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.address;
          return newErrors;
        });
      }
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!customer.phone || customer.phone.trim() === "") {
      newErrors.phone = "Phone is required";
    }

    if (!customer.address || customer.address.trim() === "") {
      newErrors.address = "Address is required";
    }

    if (!customer.postcode || customer.postcode.trim() === "") {
      newErrors.postcode = "Postcode is required";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      return;
    }

    setSubmitting(true);

    try {
      const updatedCustomer = {
        ...customer,
        form_submissions: [{ form_data: formData }],
      };

      const response = await fetchWithAuth(`/clients/${id}`, {
        method: "PUT",
        body: JSON.stringify(updatedCustomer),
      });

      if (!response.ok) throw new Error("Failed to update customer");
      router.push(`/dashboard/clients/${id}`);
    } catch (err) {
      console.error("Error updating customer:", err);
      alert("Error updating customer. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    router.push(`/dashboard/clients/${id}`);
  };

  const getAvailableStages = () => {
    const userRole = user?.role || "Sales";
    // Default to all stages if role not found in permissions
    return ROLE_STAGE_PERMISSIONS[userRole] || ROLE_STAGE_PERMISSIONS["Sales"];
  };

  const getRoleMessage = () => {
    const userRole = user?.role || "";
    
    if (userRole === "Sales") {
      return {
        title: "Sales User Permissions",
        message: "You can edit customer details and update stages up to 'Quoted'. For production stages and beyond, please contact your manager."
      };
    } else if (userRole === "Production") {
      return {
        title: "Production User Permissions",
        message: "You can edit customer details and update stages up to 'Installation'. For final stages, please contact your manager."
      };
    }
    
    return null;
  };

  if (loading) return <div className="p-8">Loading...</div>;

  if (!customer) return <div className="p-8">Customer not found.</div>;

  const availableStages = getAvailableStages();
  const roleMessage = getRoleMessage();

  return (
    <div className="min-h-screen bg-white">
      <div className="border-b border-gray-200 bg-white px-8 py-6">
        <div className="flex items-center space-x-2">
          <div
            onClick={() => router.push("/dashboard/clients")}
            className="flex cursor-pointer items-center text-gray-500 hover:text-gray-700"
          >
            <ArrowLeft className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-semibold text-gray-900">Update client details</h1>
        </div>
      </div>

      <div className="px-8 py-6">
        {roleMessage && (
          <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="mt-0.5 h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-800">{roleMessage.title}</p>
                <p className="mt-1 text-sm text-blue-700">{roleMessage.message}</p>
              </div>
            </div>
          </div>
        )}

        <div className="mb-8">
          <h2 className="mb-4 text-xl font-semibold text-gray-900">Contact Information</h2>
          <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="flex flex-col">
              <Label className="mb-1 text-sm font-medium text-gray-500">Name</Label>
              <Input value={customer.name || ""} onChange={(e) => handleCustomerChange("name", e.target.value)} />
            </div>

            <div className="flex flex-col">
              <Label className="mb-1 text-sm font-medium text-gray-500">
                Phone <span className="text-red-500">*</span>
              </Label>
              <Input
                value={customer.phone || ""}
                onChange={(e) => handleCustomerChange("phone", e.target.value)}
                className={errors.phone ? "border-red-500" : ""}
              />
              {errors.phone && <span className="mt-1 text-xs text-red-500">{errors.phone}</span>}
            </div>

            <div className="flex flex-col">
              <Label className="mb-1 text-sm font-medium text-gray-500">Email</Label>
              <Input
                type="email"
                value={customer.email || ""}
                onChange={(e) => handleCustomerChange("email", e.target.value)}
              />
            </div>

            <div className="flex flex-col">
              <Label className="mb-1 text-sm font-medium text-gray-500">
                Postcode <span className="text-red-500">*</span>
              </Label>
              <div className="flex gap-2">
                <Input
                  value={customer.postcode || ""}
                  onChange={(e) => {
                    handleCustomerChange("postcode", e.target.value.toUpperCase());
                    setAddresses([]);
                    setSelectedAddressIndex("");
                  }}
                  className={errors.postcode ? "border-red-500" : ""}
                  placeholder="Enter postcode"
                />
                <Button type="button" onClick={searchAddresses} disabled={loadingAddresses} variant="outline" size="sm">
                  <Search className="mr-2 h-4 w-4" />
                  {loadingAddresses ? "..." : "Find"}
                </Button>
              </div>
              {errors.postcode && <span className="mt-1 text-xs text-red-500">{errors.postcode}</span>}
            </div>
          </div>

          {addresses.length > 0 && (
            <div className="mt-6 flex flex-col">
              <Label className="mb-1 text-sm font-medium text-gray-500">
                Select Address <span className="text-red-500">*</span>
              </Label>
              <Select value={selectedAddressIndex} onValueChange={selectAddress}>
                <SelectTrigger className={errors.address ? "border-red-500" : ""}>
                  <SelectValue placeholder="Choose your address from the list" />
                </SelectTrigger>
                <SelectContent>
                  {addresses.map((addr, index) => (
                    <SelectItem key={index} value={index.toString()}>
                      {addr.formatted_address}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.address && <span className="mt-1 text-xs text-red-500">{errors.address}</span>}
              <Button
                type="button"
                variant="link"
                className="mt-2 h-auto self-start p-0 text-sm"
                onClick={() => {
                  setShowManualAddress(true);
                  setAddresses([]);
                  setSelectedAddressIndex("");
                }}
              >
                Can't find your address? Enter manually
              </Button>
            </div>
          )}

          {showManualAddress && (
            <div className="mt-6 flex flex-col">
              {addresses.length === 0 && (
                <div className="mb-3 rounded bg-amber-50 p-3 text-sm text-amber-600">
                  No addresses found for this postcode. Please enter your address manually.
                </div>
              )}
              <Label className="mb-1 text-sm font-medium text-gray-500">
                Address <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={customer.address || ""}
                onChange={(e) => handleCustomerChange("address", e.target.value)}
                className={errors.address ? "border-red-500" : ""}
                rows={3}
              />
              {errors.address && <span className="mt-1 text-xs text-red-500">{errors.address}</span>}
            </div>
          )}

          <div className="mt-6 grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
            <div className="flex flex-col">
              <Label className="mb-1 text-sm font-medium text-gray-500">Preferred Contact Method</Label>
              <Select
                value={customer.preferred_contact_method || "Phone"}
                onValueChange={(value) => handleCustomerChange("preferred_contact_method", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Phone">Phone</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="WhatsApp">WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col">
              <Label className="mb-1 text-sm font-medium text-gray-500">
                Stage
                {user?.role === "Sales" && <span className="ml-2 text-xs text-gray-500">(Up to Quoted)</span>}
                {user?.role === "Production" && <span className="ml-2 text-xs text-gray-500">(Up to Installation)</span>}
              </Label>
              <Select
                value={customer.status || "Lead"}
                onValueChange={(value) => handleCustomerChange("status", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableStages.map((stage) => (
                    <SelectItem key={stage} value={stage}>
                      {stage}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col">
              <Label className="mb-2 text-sm font-medium text-gray-500">Project Types</Label>
              <div className="flex flex-col space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="bedroom"
                    checked={customer.project_types?.includes("Bedroom")}
                    onCheckedChange={() => handleProjectTypeToggle("Bedroom")}
                  />
                  <label
                    htmlFor="bedroom"
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Bedroom
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="kitchen"
                    checked={customer.project_types?.includes("Kitchen")}
                    onCheckedChange={() => handleProjectTypeToggle("Kitchen")}
                  />
                  <label
                    htmlFor="kitchen"
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Kitchen
                  </label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="other"
                    checked={customer.project_types?.includes("Other")}
                    onCheckedChange={() => handleProjectTypeToggle("Other")}
                  />
                  <label
                    htmlFor="other"
                    className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Other
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <Label className="mb-1 text-sm font-medium text-gray-500">Notes</Label>
            <Textarea
              value={customer.notes || ""}
              onChange={(e) => handleCustomerChange("notes", e.target.value)}
              rows={4}
              className="mt-1"
            />
          </div>
        </div>

        {Object.keys(formData).length > 0 && (
          <div className="border-t border-gray-200 pt-8">
            <h2 className="mb-4 text-xl font-semibold text-gray-900">Additional Information</h2>
            <div className="grid grid-cols-1 gap-x-8 gap-y-6 md:grid-cols-2">
              {Object.entries(FIELD_LABELS).map(([key, label]) => {
                if (!formData.hasOwnProperty(key)) return null;

                return (
                  <div key={key} className="flex flex-col">
                    <Label className="mb-1 text-sm font-medium text-gray-500">{label}</Label>
                    <Input value={formData[key] || ""} onChange={(e) => handleFormDataChange(key, e.target.value)} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-8 flex justify-end space-x-2 border-t border-gray-200 pt-8">
          <Button onClick={handleCancel} variant="outline">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="flex items-center space-x-2">
            <Save className="h-4 w-4" />
            <span>{submitting ? "Saving..." : "Save Changes"}</span>
          </Button>
        </div>
      </div>
    </div>
  );
}