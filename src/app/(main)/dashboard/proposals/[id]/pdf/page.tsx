"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Loader2, Download, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";

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

const numberToWords = (num: number): string => {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];

  if (num === 0) return 'Zero';

  const convertHundreds = (n: number): string => {
    let str = '';
    if (n >= 100) {
      str += ones[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += tens[Math.floor(n / 10)] + ' ';
      n %= 10;
    } else if (n >= 10) {
      str += teens[n - 10] + ' ';
      return str;
    }
    if (n > 0) {
      str += ones[n] + ' ';
    }
    return str;
  };

  let result = '';
  if (num >= 10000000) {
    result += convertHundreds(Math.floor(num / 10000000)) + 'Crore ';
    num %= 10000000;
  }
  if (num >= 100000) {
    result += convertHundreds(Math.floor(num / 100000)) + 'Lakh ';
    num %= 100000;
  }
  if (num >= 1000) {
    result += convertHundreds(Math.floor(num / 1000)) + 'Thousand ';
    num %= 1000;
  }
  if (num > 0) {
    result += convertHundreds(num);
  }

  return result.trim() + ' Only';
};

export default function ProposalPDFPage() {
  const params = useParams();
  const proposalId = params?.id as string;

  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [loading, setLoading] = useState(true);
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

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    window.print();
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
          <h3 className="text-lg font-semibold text-red-600">Error</h3>
          <p className="mt-2 text-gray-600">{error || "Proposal not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Print/Download Buttons - Hidden when printing */}
      <div className="fixed right-6 top-6 z-50 flex gap-2 print:hidden">
        <Button onClick={handlePrint} className="flex items-center shadow-lg">
          <Printer className="mr-2 h-4 w-4" />
          Print
        </Button>
        <Button
          onClick={handleDownload}
          variant="outline"
          className="flex items-center shadow-lg"
        >
          <Download className="mr-2 h-4 w-4" />
          Download PDF
        </Button>
      </div>

      {/* PDF Content */}
      <div className="min-h-screen bg-white p-8">
        <div className="mx-auto max-w-[210mm]">
          {/* Company Header with Border */}
          <div className="mb-6 rounded-lg border-4 border-blue-600 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                {/* Logo */}
                <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-400">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-red-600">⚠️</div>
                    <div className="text-xs font-bold text-gray-800">FAI</div>
                  </div>
                </div>
                {/* Company Details */}
                <div>
                  <h1 className="text-xl font-bold text-gray-900">
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
                  <p className="mt-2 text-xs italic text-gray-600">
                    Life Member of Association of Commerce Industries & Agriculture
                  </p>
                </div>
              </div>
              {/* Training Proposal Badge */}
              <div className="text-center">
                <div className="rounded-lg bg-blue-600 px-6 py-3 text-white">
                  <div className="text-sm font-semibold">Training Proposal</div>
                </div>
              </div>
            </div>
          </div>

          {/* Customer & Proposal Info */}
          <div className="mb-6 grid grid-cols-2 gap-6">
            {/* Customer Info */}
            <div>
              <h3 className="mb-3 font-semibold text-gray-900">To,</h3>
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-gray-900">
                  {proposal.customer_name}
                </p>
                {proposal.customer_designation && (
                  <p className="text-gray-700">{proposal.customer_designation}</p>
                )}
                {proposal.customer_company && (
                  <p className="text-gray-700">{proposal.customer_company}</p>
                )}
                <p className="text-gray-700">{proposal.customer_address}</p>
                <div className="mt-2 space-y-1">
                  <p className="text-gray-700">
                    Mobile: {proposal.customer_mobile}
                  </p>
                  <p className="text-gray-700">
                    Email: {proposal.customer_email}
                  </p>
                </div>
              </div>
            </div>

            {/* Proposal Details */}
            <div className="rounded-lg bg-blue-50 p-4">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Quotation #</span>
                  <span className="font-semibold text-gray-900">
                    {proposal.quotation_number}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">Date</span>
                  <span className="text-gray-900">
                    {formatDate(proposal.date)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">IFO NUMBER</span>
                  <span className="text-gray-900">{proposal.ifo_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">
                    Mode of Enquiry
                  </span>
                  <span className="text-gray-900">{proposal.mode_of_enquiry}</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium text-gray-700">
                    Payment Terms
                  </span>
                  <span className="text-gray-900">{proposal.payment_terms}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Items Table */}
          <div className="mb-6">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-blue-600 text-white">
                  <th className="border border-gray-400 px-3 py-2 text-left text-sm font-semibold">
                    Sr. No.
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-left text-sm font-semibold">
                    CODE
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-left text-sm font-semibold">
                    Description
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-center text-sm font-semibold">
                    N.O.P.
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-right text-sm font-semibold">
                    UNIT RATE
                  </th>
                  <th className="border border-gray-400 px-3 py-2 text-right text-sm font-semibold">
                    AMOUNT
                  </th>
                </tr>
              </thead>
              <tbody>
                {proposal.items.map((item) => (
                  <tr key={item.id}>
                    <td className="border border-gray-400 px-3 py-2 text-sm">
                      {item.sr_no}
                    </td>
                    <td className="border border-gray-400 px-3 py-2 text-sm font-medium">
                      {item.code}
                    </td>
                    <td className="border border-gray-400 px-3 py-2 text-sm">
                      <div className="whitespace-pre-line">{item.description}</div>
                    </td>
                    <td className="border border-gray-400 px-3 py-2 text-center text-sm">
                      {item.nop}
                    </td>
                    <td className="border border-gray-400 px-3 py-2 text-right text-sm">
                      ₹ {item.unit_rate.toFixed(2)}
                    </td>
                    <td className="border border-gray-400 px-3 py-2 text-right text-sm font-semibold">
                      ₹ {item.amount.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Service Tax Code */}
            <div className="mt-2 text-xs text-gray-600">
              Service Tax Code No: AAEFF1562M5D001 16.5.2017
            </div>
          </div>

          {/* Totals Section */}
          <div className="mb-6">
            <div className="ml-auto max-w-md space-y-1 text-sm">
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-700">Sub Total</span>
                <span className="font-semibold">
                  ₹ {proposal.sub_total.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-700">
                  Discount {proposal.discount_percentage}%
                </span>
                <span className="font-semibold">
                  ₹ {proposal.discount_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-1 pt-1">
                <span className="text-gray-700">Our Bankers:</span>
                <span className="text-gray-900">{proposal.bank_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">{proposal.branch_name}</span>
                <span className="text-gray-700">
                  IGST @{proposal.igst_percentage}% (SAC: 999223)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-700">
                  Account No: {proposal.account_number}
                </span>
                <span className="font-semibold">
                  ₹ {proposal.igst_amount.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between border-b pb-1">
                <span className="text-gray-700">IFSC Code:</span>
                <span className="text-gray-900">{proposal.ifsc_code}</span>
              </div>
              <div className="flex justify-between bg-blue-600 px-3 py-2 text-white">
                <span className="font-bold">TOTAL</span>
                <span className="text-lg font-bold">
                  ₹ {proposal.grand_total.toFixed(2)}
                </span>
              </div>
              <div className="border-b pb-1 pt-1 text-xs">
                <span className="font-medium">GST IN:</span>{" "}
                <span>{proposal.gst_number}</span>
              </div>
              <div className="pt-1 text-xs">
                <span className="font-medium">Amount:</span>{" "}
                <span className="italic">
                  {numberToWords(Math.round(proposal.grand_total))}
                </span>
              </div>
            </div>
          </div>

          {/* E & O E and Validity */}
          <div className="mb-6 flex items-center justify-end">
            <div className="rounded-lg bg-yellow-50 px-4 py-2 text-center">
              <p className="text-sm font-semibold text-gray-900">
                Valid for {proposal.valid_for_days} days from the date mentioned
                above
              </p>
            </div>
          </div>

          {/* E & O E Label */}
          <div className="mb-2 text-right text-sm font-semibold">E. & O. E.</div>

          {/* Terms & Conditions */}
          <div className="mb-6 rounded-lg border-2 border-red-600 p-4">
            <h3 className="mb-3 border-b border-red-600 pb-2 text-center font-bold text-red-600">
              Terms & Conditions
            </h3>
            <div className="text-xs">
              <p className="mb-2 font-semibold">
                For FORKLIFT ACADEMY OF INDIA
              </p>
              <div className="space-y-1">
                {proposal.terms_conditions.map((term, index) => (
                  <div key={index} className="flex items-start">
                    <span className="mr-2 font-semibold">
                      {String.fromCharCode(65 + index)}.
                    </span>
                    <p className="flex-1 text-gray-700">{term}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Signature Section */}
            <div className="mt-6 flex justify-end">
              <div className="text-center">
                <div className="mb-2 h-12 w-40 border-b border-gray-400"></div>
                <p className="font-semibold text-gray-900">F C Shaikh</p>
                <p className="text-xs text-gray-600">Founder - CEO</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="text-center">
            <p className="text-xs text-gray-600">
              For more information about our Training programs, please visit{" "}
              <span className="font-semibold">www.forkliftacademy</span>
            </p>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body {
            margin: 0;
            padding: 0;
          }
          
          @page {
            size: A4;
            margin: 15mm;
          }
          
          .print\\:hidden {
            display: none !important;
          }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}</style>
    </>
  );
}