"use client";

import React, { useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Save, Download, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

// ControlledCurrencyInput component definition remains the same
const ControlledCurrencyInput = ({ value, onChange, className, placeholder }: any) => {
  const [localValue, setLocalValue] = useState(value);

  React.useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleFocus = (e: any) => {
    if (localValue === "0.00") {
      setLocalValue("");
    } else {
      e.target.select();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let newValue = e.target.value;
    let cleanValue = newValue.replace(/[^0-9.]/g, "");
    const decimalCount = (cleanValue.match(/\./g) || []).length;
    if (decimalCount > 1) {
      return;
    }
    setLocalValue(cleanValue);
    onChange(cleanValue);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    let finalValue = e.target.value;
    let num = Number(finalValue);
    if (isNaN(num) || finalValue === "" || finalValue === ".") {
      num = 0;
    }
    const formatted = num.toFixed(2);
    setLocalValue(formatted);
    onChange(formatted);
  };

  return (
    <input
      type="text"
      value={localValue}
      onChange={handleChange}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder}
      className={className}
    />
  );
};

export default function ReceiptViewPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const today = new Date().toISOString().split("T")[0];

  const getParam = (key: string, defaultValue: string): string => {
    const value = searchParams.get(key);
    if (key === "receiptDate" && value) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split("T")[0];
        }
      } catch (e) {
        // Fallback
      }
    }
    return value || defaultValue;
  };

  const customerId = getParam("customerId", "N/A");
  const customerName = getParam("customerName", "");
  const customerAddress = getParam("customerAddress", "");
  const customerPhone = getParam("customerPhone", "");
  const receiptType = getParam("type", "receipt");
  const paymentMethod = getParam("paymentMethod", "BACS");
  const paymentDescription = getParam("paymentDescription", "Payment received for your Kitchen/Bedroom Cabinetry.");

  const [paidAmount, setPaidAmount] = useState<string>(getParam("paidAmount", "0.00"));
  const [totalPaidToDate, setTotalPaidToDate] = useState<string>(getParam("totalPaidToDate", "0.00"));
  const [balanceToPay, setBalanceToPay] = useState<string>(getParam("balanceToPay", "0.00"));
  const [receiptDate, setReceiptDate] = useState<string>(getParam("receiptDate", today));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [approvalStatus, setApprovalStatus] = useState<string>("pending");


  // Approval workflow state
  // const [submissionId, setSubmissionId] = useState<number | null>(null);
  // const [approvalStatus, setApprovalStatus] = useState<string>("pending");
  // const [rejectionReason, setRejectionReason] = useState<string>("");

  const displayDate = new Date(receiptDate).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  const getReceiptData = () => ({
    customerId,
    customerName,
    customerAddress,
    customerPhone,
    receiptType,
    receiptDate,
    paidAmount: Number(paidAmount),
    totalPaidToDate: Number(totalPaidToDate),
    balanceToPay: Number(balanceToPay),
    paymentMethod,
    paymentDescription,
    // submission_id: submissionId, // Include for download check
  });

  const handleSave = async () => {
    setIsSubmitting(true);
    setSaveMessage("");

    const data = getReceiptData();

    try {
      const response = await fetch(`http://localhost:5000/receipts/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await response.json();

      if (response.ok) {
        // Store submission ID and approval status
        // setSubmissionId(result.form_submission_id);
        // setApprovalStatus(result.approval_status || "pending");

        if (result.approval_status === "pending") {
          setSaveMessage("✅ Receipt saved and sent to manager for approval!");
        } else {
          setSaveMessage("✅ Receipt saved successfully!");
        }
      } else {
        setSaveMessage(`❌ Failed to save receipt: ${result.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Network error during save:", error);
      setSaveMessage("❌ Network error: Could not connect to the server.");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSaveMessage(""), 5000);
    }
  };

  // Check approval status before download
  // const checkApprovalStatus = async () => {
  //   if (!submissionId) {
  //     setSaveMessage("⚠️ Please save the receipt first.");
  //     return false;
  //   }

  //   try {
  //     const response = await fetch(`http://localhost:5000/approvals/status/${submissionId}`);
  //     const data = await response.json();

  //     setApprovalStatus(data.approval_status);
  //     setRejectionReason(data.rejection_reason || "");

  //     if (data.approval_status === "rejected") {
  //       setSaveMessage(`❌ This receipt was rejected. Reason: ${data.rejection_reason}`);
  //       return false;
  //     } else if (data.approval_status === "pending") {
  //       setSaveMessage("⚠️ This receipt is pending manager approval. You cannot download it yet.");
  //       return false;
  //     }

  //     return true;
  //   } catch (error) {
  //     setSaveMessage("❌ Failed to check approval status.");
  //     return false;
  //   }
  // };

  const handleDownloadPdf = async () => {
    // Check approval status first
    // const canDownload = await checkApprovalStatus();
    // if (!canDownload) {
    //   setTimeout(() => setSaveMessage(""), 5000);
    //   return;
    // }

    setSaveMessage("⌛ Generating PDF on server...");
    const data = getReceiptData();

    try {
      const response = await fetch(`http://localhost:5000/receipts/download-pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        const blob = await response.blob();
        const filename = `${receiptType.toUpperCase()}_Receipt_${customerName.replace(/\s/g, "_")}_${receiptDate.replace(/-/g, "")}.pdf`;
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        setSaveMessage("✅ PDF successfully generated and downloaded!");
      } else {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        setSaveMessage(`❌ Failed to generate PDF: ${errorData.error || response.statusText}`);
      }
    } catch (error) {
      console.error("Network error during PDF download:", error);
      setSaveMessage("❌ Network error: Could not connect to the server for PDF generation.");
    } finally {
      setTimeout(() => setSaveMessage(""), 5000);
    }
  };

  const handlePrint = () => {
    // For simplicity, we'll just log an action. In a real app, you might use a print-friendly view or an existing PDF.
    window.print();
  };

  const getStatusVariant = () => {
    switch (approvalStatus) {
      case "approved":
        return "text-green-600 bg-green-100 border-green-300";
      case "rejected":
        return "text-red-600 bg-red-100 border-red-300";
      case "pending":
      default:
        return "text-yellow-600 bg-yellow-100 border-yellow-300";
    }
  };

  return (
    <div className="container mx-auto space-y-8 p-4 md:p-8">
      <header className="mb-6 flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()} className="text-lg">
          <ArrowLeft className="mr-2 h-5 w-5" />
          Back
        </Button>
        <h1 className="text-3xl font-bold capitalize">{receiptType} View</h1>
        <div className="flex space-x-2">
          <Button onClick={handlePrint} variant="outline" title="Print">
            <Printer className="h-5 w-5" />
          </Button>
          <Button
            onClick={handleDownloadPdf}
            title="Download PDF"
            variant="outline"
          >
            <Download className="mr-2 h-5 w-5" />
            Download
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting} title="Save Receipt">
            <Save className="mr-2 h-5 w-5" />
            {isSubmitting ? "Saving..." : "Save"}
          </Button>
        </div>
      </header>

      {saveMessage && (
        <div
          className={`rounded-md border p-3 text-sm ${saveMessage.startsWith("❌") ? "border-red-400 bg-red-100 text-red-700" : saveMessage.startsWith("✅") ? "border-green-400 bg-green-100 text-green-700" : "border-yellow-400 bg-yellow-100 text-yellow-700"}`}
        >
          {saveMessage}
        </div>
      )}

      {/* Approval Status and Rejection Reason */}
      {/* <div className={`flex items-center space-x-3 rounded-lg border p-4 ${getStatusVariant()}`}>
        <AlertCircle className="h-5 w-5 flex-shrink-0" />
        <div className="flex flex-col">
          <span className="font-semibold capitalize">Approval Status: {approvalStatus}</span>
          {approvalStatus === "rejected" && rejectionReason && (
            <p className="mt-1 text-sm">
              Rejection Reason: <span className="font-normal">{rejectionReason}</span>
            </p>
          )}
        </div>
      </div> */}

      {/* --- */}

      <section className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* Customer Information Card */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>Customer Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div>
              <p className="text-gray-500">Customer ID</p>
              <p className="font-medium">{customerId}</p>
            </div>
            <div>
              <p className="text-gray-500">Name</p>
              <p className="font-medium">{customerName || "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-500">Address</p>
              <p className="font-medium">{customerAddress || "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-500">Phone</p>
              <p className="font-medium">{customerPhone || "N/A"}</p>
            </div>
          </CardContent>
        </Card>

        {/* Receipt Details Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Transaction Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Date
                </label>
                <Input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  max={today}
                  className="mt-1"
                />
                <p className="mt-1 text-xs text-gray-500">Display Date: {displayDate}</p>
              </div>
              <div>
                <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Payment Method
                </label>
                <Input value={paymentMethod} readOnly className="mt-1 bg-gray-50" />
              </div>
            </div>

            <div>
              <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                Payment Description
              </label>
              <Input value={paymentDescription} readOnly className="mt-1 bg-gray-50" />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Paid Amount (£)
                </label>
                <ControlledCurrencyInput
                  value={paidAmount}
                  onChange={setPaidAmount}
                  placeholder="0.00"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Total Paid To Date (£)
                </label>
                <ControlledCurrencyInput
                  value={totalPaidToDate}
                  onChange={setTotalPaidToDate}
                  placeholder="0.00"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
              <div>
                <label className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  Balance To Pay (£)
                </label>
                <ControlledCurrencyInput
                  value={balanceToPay}
                  onChange={setBalanceToPay}
                  placeholder="0.00"
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring mt-1 flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
