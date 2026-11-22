"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Save,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/api";

type PaymentPolicy = "annual" | "upfront" | "upfront_reconciliation" | "monthly_actual" | "quarterly_actual" | "";

type Supplier = {
  supplier_id: number;
  supplier_display_id: string | null;
  supplier_company_name: string | null;
  supplier_contact_name: string | null;
  supplier_email: string | null;
  supplier_email_secondary: string | null;
  supplier_phone: string | null;
  supplier_website: string | null;
  supplier_address: string | null;
  visible_in_leads: boolean | null;
  visible_in_renewals: boolean | null;
  commission_payment_delay_days: number | null;
  multi_year_commission_payment_mode: "annual" | "upfront" | null;
  commission_payment_type: Exclude<PaymentPolicy, ""> | null;
  upfront_percentage: string | null;
  reconciliation_required: boolean | null;
  invoice_delay_days: number | null;
  customer_payment_days: number | null;
  grace_days: number | null;
  commission_payment_frequency: string | null;
  terms_configured: boolean;
};

type DraftDetails = {
  supplier_display_id: string;
  supplier_company_name: string;
  supplier_contact_name: string;
  supplier_email: string;
  supplier_email_secondary: string;
  supplier_phone: string;
  supplier_website: string;
  supplier_address: string;
};

type DraftTerms = {
  policy: PaymentPolicy;
  delayDays: string;
  upfrontPercentage: string;
  invoiceDelayDays: string;
  customerPaymentDays: string;
  graceDays: string;
};

const toStr = (v: string | null | undefined) => v ?? "";
const toInput = (v: number | string | null | undefined) => (v === null || v === undefined ? "" : String(v));

function buildDetailsDraft(s: Supplier): DraftDetails {
  return {
    supplier_display_id: toStr(s.supplier_display_id),
    supplier_company_name: toStr(s.supplier_company_name),
    supplier_contact_name: toStr(s.supplier_contact_name),
    supplier_email: toStr(s.supplier_email),
    supplier_email_secondary: toStr(s.supplier_email_secondary),
    supplier_phone: toStr(s.supplier_phone),
    supplier_website: toStr(s.supplier_website),
    supplier_address: toStr(s.supplier_address),
  };
}

function buildTermsDraft(s: Supplier): DraftTerms {
  return {
    policy:
      s.commission_payment_type ||
      (s.multi_year_commission_payment_mode === "upfront" ? "upfront" : "") ||
      (s.multi_year_commission_payment_mode === "annual" ? "annual" : ""),
    delayDays: toInput(s.commission_payment_delay_days),
    upfrontPercentage: toInput(s.upfront_percentage),
    invoiceDelayDays: toInput(s.invoice_delay_days),
    customerPaymentDays: toInput(s.customer_payment_days),
    graceDays: toInput(s.grace_days),
  };
}

type Tab = "details" | "payment-terms";

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("details");

  const [detailsDraft, setDetailsDraft] = useState<DraftDetails | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailsSuccess, setDetailsSuccess] = useState<string | null>(null);
  const [detailsError, setDetailsError] = useState<string | null>(null);

  const [termsDraft, setTermsDraft] = useState<DraftTerms | null>(null);
  const [savingTerms, setSavingTerms] = useState(false);
  const [termsSuccess, setTermsSuccess] = useState<string | null>(null);
  const [termsError, setTermsError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/commission/supplier-terms/${supplierId}`)
      .then((data) => {
        const s: Supplier = data.supplier;
        setSupplier(s);
        setDetailsDraft(buildDetailsDraft(s));
        setTermsDraft(buildTermsDraft(s));
      })
      .catch(() => {
        // silent — handled by null supplier state
      })
      .finally(() => setLoading(false));
  }, [supplierId]);

  async function saveDetails() {
    if (!detailsDraft) return;
    setSavingDetails(true);
    setDetailsError(null);
    setDetailsSuccess(null);
    try {
      const data = await fetchWithAuth(`/api/commission/supplier-terms/${supplierId}/details`, {
        method: "PATCH",
        body: JSON.stringify(detailsDraft),
      });
      const s: Supplier = data.supplier;
      setSupplier(s);
      setDetailsDraft(buildDetailsDraft(s));
      setDetailsSuccess("Supplier details saved.");
    } catch (err) {
      setDetailsError(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setSavingDetails(false);
    }
  }

  async function saveTerms() {
    if (!termsDraft) return;
    if (!termsDraft.policy) {
      setTermsError("Select a payment policy before saving.");
      return;
    }
    setSavingTerms(true);
    setTermsError(null);
    setTermsSuccess(null);
    try {
      const isLegacyUpfront = termsDraft.policy === "upfront";
      const data = await fetchWithAuth(`/api/commission/supplier-terms/${supplierId}`, {
        method: "PUT",
        body: JSON.stringify({
          commission_payment_type: isLegacyUpfront ? null : termsDraft.policy,
          multi_year_commission_payment_mode: isLegacyUpfront
            ? "upfront"
            : termsDraft.policy === "annual"
            ? "annual"
            : undefined,
          commission_payment_delay_days:
            termsDraft.delayDays === "" ? null : Number(termsDraft.delayDays),
          upfront_percentage:
            termsDraft.upfrontPercentage === "" ? null : Number(termsDraft.upfrontPercentage),
          reconciliation_required: termsDraft.policy === "upfront_reconciliation",
          invoice_delay_days:
            termsDraft.invoiceDelayDays === "" ? null : Number(termsDraft.invoiceDelayDays),
          customer_payment_days:
            termsDraft.customerPaymentDays === "" ? null : Number(termsDraft.customerPaymentDays),
          grace_days: termsDraft.graceDays === "" ? null : Number(termsDraft.graceDays),
        }),
      });
      const s: Supplier = data.supplier;
      setSupplier(s);
      setTermsDraft(buildTermsDraft(s));
      setTermsSuccess(`Payment terms saved for ${s.supplier_company_name || "supplier"}.`);
    } catch (err) {
      setTermsError(err instanceof Error ? err.message : "Failed to save payment terms");
    } finally {
      setSavingTerms(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!supplier || !detailsDraft || !termsDraft) {
    return (
      <div className="p-6 text-center text-slate-500">Supplier not found.</div>
    );
  }

  const isUsageBased =
    termsDraft.policy === "monthly_actual" || termsDraft.policy === "quarterly_actual";

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[900px] space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/payments/supplier-terms")}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-slate-500">Payments / Suppliers</p>
            <h1 className="text-2xl font-semibold text-slate-950 dark:text-slate-50 truncate">
              {supplier.supplier_company_name || `Supplier #${supplier.supplier_id}`}
            </h1>
          </div>
          {supplier.terms_configured ? (
            <Badge className="shrink-0 gap-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />Configured
            </Badge>
          ) : (
            <Badge variant="destructive" className="shrink-0 gap-1">
              <AlertTriangle className="h-3.5 w-3.5" />Missing terms
            </Badge>
          )}
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-200 dark:border-slate-700">
          {(["details", "payment-terms"] as Tab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
                activeTab === tab
                  ? "border-slate-900 text-slate-900 dark:border-slate-100 dark:text-slate-100"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {tab === "details" ? "Details" : "Payment Terms"}
            </button>
          ))}
        </div>

        {/* Details tab */}
        {activeTab === "details" && (
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-950 dark:text-slate-50">Supplier Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {detailsError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {detailsError}
                </div>
              )}
              {detailsSuccess && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                  {detailsSuccess}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-xs text-slate-500">Company Name</Label>
                  <Input
                    value={detailsDraft.supplier_company_name}
                    onChange={(e) => setDetailsDraft({ ...detailsDraft, supplier_company_name: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950"
                    placeholder="e.g. British Gas"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Main Contact Person</Label>
                  <Input
                    value={detailsDraft.supplier_contact_name}
                    onChange={(e) => setDetailsDraft({ ...detailsDraft, supplier_contact_name: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950"
                    placeholder="e.g. John Smith"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Phone Number</Label>
                  <Input
                    value={detailsDraft.supplier_phone}
                    onChange={(e) => setDetailsDraft({ ...detailsDraft, supplier_phone: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950"
                    placeholder="+44 20 1234 5678"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Primary Email Address</Label>
                  <Input
                    type="email"
                    value={detailsDraft.supplier_email}
                    onChange={(e) => setDetailsDraft({ ...detailsDraft, supplier_email: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950"
                    placeholder="commissions@supplier.com"
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Secondary Email Address</Label>
                  <Input
                    type="email"
                    value={detailsDraft.supplier_email_secondary}
                    onChange={(e) => setDetailsDraft({ ...detailsDraft, supplier_email_secondary: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950"
                    placeholder="accounts@supplier.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <Label className="text-xs text-slate-500">Website</Label>
                    {detailsDraft.supplier_website && (
                      <a
                        href={detailsDraft.supplier_website.startsWith("http") ? detailsDraft.supplier_website : `https://${detailsDraft.supplier_website}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                      >
                        Visit site ↗
                      </a>
                    )}
                  </div>
                  <Input
                    value={detailsDraft.supplier_website}
                    onChange={(e) => setDetailsDraft({ ...detailsDraft, supplier_website: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950"
                    placeholder="https://www.supplier.com"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-xs text-slate-500">Address</Label>
                  <Textarea
                    value={detailsDraft.supplier_address}
                    onChange={(e) => setDetailsDraft({ ...detailsDraft, supplier_address: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950 resize-none"
                    rows={3}
                    placeholder="123 Energy Street, London, EC1A 1BB"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={saveDetails} disabled={savingDetails}>
                  {savingDetails ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Payment Terms tab */}
        {activeTab === "payment-terms" && (
          <Card className="border-slate-200 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <CardHeader>
              <CardTitle className="text-slate-950 dark:text-slate-50">Payment Terms</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {termsError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
                  {termsError}
                </div>
              )}
              {termsSuccess && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">
                  {termsSuccess}
                </div>
              )}

              <div className="grid gap-5 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Payment policy</Label>
                  <Select
                    value={termsDraft.policy || undefined}
                    onValueChange={(v: Exclude<PaymentPolicy, "">) =>
                      setTermsDraft({ ...termsDraft, policy: v })
                    }
                  >
                    <SelectTrigger className="w-full dark:border-slate-700 dark:bg-slate-950">
                      <SelectValue placeholder="Select policy" />
                    </SelectTrigger>
                    <SelectContent className="dark:border-slate-800 dark:bg-slate-900">
                      <SelectItem value="annual">Annual estimated</SelectItem>
                      <SelectItem value="upfront">Full contract upfront</SelectItem>
                      <SelectItem value="upfront_reconciliation">Upfront + reconciliation</SelectItem>
                      <SelectItem value="monthly_actual">Monthly actual usage</SelectItem>
                      <SelectItem value="quarterly_actual">Quarterly actual usage</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  {termsDraft.policy === "upfront_reconciliation" ? (
                    <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-end">
                      <div>
                        <Label className="mb-1.5 block text-xs text-slate-500">Upfront percentage</Label>
                        <div className="flex">
                          <Input
                            className="rounded-r-none dark:border-slate-700 dark:bg-slate-950"
                            min={0}
                            max={100}
                            type="number"
                            value={termsDraft.upfrontPercentage}
                            onChange={(e) => setTermsDraft({ ...termsDraft, upfrontPercentage: e.target.value })}
                          />
                          <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-white text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">%</span>
                        </div>
                      </div>
                      <p className="pb-2 text-sm text-slate-600 dark:text-slate-400">The remaining balance is reconciled at contract end.</p>
                    </div>
                  ) : isUsageBased ? (
                    <div className="grid gap-3 sm:grid-cols-3">
                      {([
                        ["Invoice issued", "invoiceDelayDays"],
                        ["Customer pays", "customerPaymentDays"],
                        ["Grace period", "graceDays"],
                      ] as const).map(([label, field]) => (
                        <div key={field}>
                          <Label className="mb-1.5 block text-xs text-slate-500">{label}</Label>
                          <div className="flex">
                            <Input
                              className="rounded-r-none dark:border-slate-700 dark:bg-slate-950"
                              min={0}
                              type="number"
                              value={termsDraft[field]}
                              onChange={(e) => setTermsDraft({ ...termsDraft, [field]: e.target.value })}
                            />
                            <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-white text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">days</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : termsDraft.policy === "annual" || termsDraft.policy === "upfront" ? (
                    <div className="max-w-60">
                      <Label className="mb-1.5 block text-xs text-slate-500">Delay after live date</Label>
                      <div className="flex">
                        <Input
                          className="rounded-r-none dark:border-slate-700 dark:bg-slate-950"
                          min={0}
                          type="number"
                          value={termsDraft.delayDays}
                          onChange={(e) => setTermsDraft({ ...termsDraft, delayDays: e.target.value })}
                        />
                        <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-white text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">days</span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex min-h-16 items-center rounded-md border border-dashed border-slate-300 bg-white px-4 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                      Select how this supplier pays commission.
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <Button onClick={saveTerms} disabled={savingTerms}>
                  {savingTerms ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Terms
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
