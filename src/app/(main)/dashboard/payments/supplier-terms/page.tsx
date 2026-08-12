"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Save, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { fetchWithAuth } from "@/lib/api";

type PaymentPolicy = "annual" | "upfront" | "upfront_reconciliation" | "monthly_actual" | "quarterly_actual" | "";

type SupplierTerm = {
  supplier_id: number;
  supplier_company_name: string | null;
  supplier_contact_name: string | null;
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

type DraftTerm = {
  policy: PaymentPolicy;
  delayDays: string;
  upfrontPercentage: string;
  invoiceDelayDays: string;
  customerPaymentDays: string;
  graceDays: string;
};

const emptyDraft: DraftTerm = {
  policy: "",
  delayDays: "",
  upfrontPercentage: "",
  invoiceDelayDays: "",
  customerPaymentDays: "",
  graceDays: "",
};

const toInput = (value: number | string | null | undefined) => (value === null || value === undefined ? "" : String(value));

const buildDraft = (supplier: SupplierTerm): DraftTerm => ({
  policy:
    supplier.commission_payment_type ||
    (supplier.multi_year_commission_payment_mode === "upfront" ? "upfront" : "") ||
    (supplier.multi_year_commission_payment_mode === "annual" ? "annual" : ""),
  delayDays: toInput(supplier.commission_payment_delay_days),
  upfrontPercentage: toInput(supplier.upfront_percentage),
  invoiceDelayDays: toInput(supplier.invoice_delay_days),
  customerPaymentDays: toInput(supplier.customer_payment_days),
  graceDays: toInput(supplier.grace_days),
});

const policyLabel = (policy: PaymentPolicy) => {
  if (policy === "upfront") return "Full contract upfront";
  if (policy === "upfront_reconciliation") return "Upfront + reconciliation";
  if (policy === "monthly_actual") return "Monthly actual usage";
  if (policy === "quarterly_actual") return "Quarterly actual usage";
  if (policy === "annual") return "Annual estimated";
  return "Select policy";
};

export default function SupplierTermsPage() {
  const [suppliers, setSuppliers] = useState<SupplierTerm[]>([]);
  const [drafts, setDrafts] = useState<Record<number, DraftTerm>>({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "missing" | "configured">("all");

  const unconfiguredCount = useMemo(
    () => suppliers.filter((supplier) => !supplier.terms_configured).length,
    [suppliers],
  );

  const filteredSuppliers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return suppliers
      .filter((supplier) => {
        if (statusFilter === "missing") return !supplier.terms_configured;
        if (statusFilter === "configured") return supplier.terms_configured;
        return true;
      })
      .filter((supplier) => {
        if (!query) return true;
        return [supplier.supplier_company_name, supplier.supplier_contact_name, String(supplier.supplier_id)]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(query));
      })
      .sort((a, b) => {
        if (a.terms_configured !== b.terms_configured) return a.terms_configured ? 1 : -1;
        return (a.supplier_company_name || "").localeCompare(b.supplier_company_name || "");
      });
  }, [searchTerm, statusFilter, suppliers]);

  const loadSupplierTerms = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchWithAuth("/api/commission/supplier-terms");
      const rows: SupplierTerm[] = data.suppliers || [];
      setSuppliers(rows);
      setDrafts(
        rows.reduce<Record<number, DraftTerm>>((result, supplier) => {
          result[supplier.supplier_id] = buildDraft(supplier);
          return result;
        }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load supplier terms");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSupplierTerms();
  }, []);

  const updateDraft = (supplierId: number, patch: Partial<DraftTerm>) => {
    setDrafts((current) => ({
      ...current,
      [supplierId]: { ...(current[supplierId] || emptyDraft), ...patch },
    }));
  };

  const saveSupplier = async (supplier: SupplierTerm) => {
    const draft = drafts[supplier.supplier_id];
    if (!draft?.policy) {
      setError("Select a payment policy before saving.");
      return;
    }

    setSavingId(supplier.supplier_id);
    setError(null);
    setSuccessMessage(null);
    try {
      const isLegacyUpfront = draft.policy === "upfront";
      const data = await fetchWithAuth(`/api/commission/supplier-terms/${supplier.supplier_id}`, {
        method: "PUT",
        body: JSON.stringify({
          commission_payment_type: isLegacyUpfront ? null : draft.policy,
          multi_year_commission_payment_mode: isLegacyUpfront ? "upfront" : draft.policy === "annual" ? "annual" : undefined,
          commission_payment_delay_days: draft.delayDays === "" ? null : Number(draft.delayDays),
          upfront_percentage: draft.upfrontPercentage === "" ? null : Number(draft.upfrontPercentage),
          reconciliation_required: draft.policy === "upfront_reconciliation",
          invoice_delay_days: draft.invoiceDelayDays === "" ? null : Number(draft.invoiceDelayDays),
          customer_payment_days: draft.customerPaymentDays === "" ? null : Number(draft.customerPaymentDays),
          grace_days: draft.graceDays === "" ? null : Number(draft.graceDays),
        }),
      });
      const updated: SupplierTerm = data.supplier;
      setSuppliers((current) => current.map((item) => (item.supplier_id === updated.supplier_id ? updated : item)));
      setDrafts((current) => ({ ...current, [updated.supplier_id]: buildDraft(updated) }));
      setSuccessMessage(`Saved payment terms for ${updated.supplier_company_name || "supplier"}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save supplier terms");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <div className="rounded-lg border bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Payments</p>
          <div className="mt-1 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-slate-950">Supplier Payment Terms</h1>
              <p className="mt-2 max-w-4xl text-sm text-slate-600">
                Control when commission is expected. Client-approved suppliers are already configured for upfront,
                monthly, or quarterly payment schedules.
              </p>
            </div>
            <Badge variant={unconfiguredCount > 0 ? "destructive" : "secondary"} className="w-fit">
              {unconfiguredCount} unconfigured
            </Badge>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {successMessage && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {successMessage}
          </div>
        )}

        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>Commission policies</CardTitle>
                <CardDescription>Changes affect newly generated commission schedules only.</CardDescription>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <div className="relative">
                  <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input className="w-full pl-9 sm:w-72" placeholder="Search suppliers..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
                </div>
                <Select value={statusFilter} onValueChange={(value: "all" | "missing" | "configured") => setStatusFilter(value)}>
                  <SelectTrigger className="w-full sm:w-40"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All terms</SelectItem>
                    <SelectItem value="missing">Missing</SelectItem>
                    <SelectItem value="configured">Configured</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex min-h-48 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading supplier terms...</div>
            ) : (
              <div className="space-y-3">
                {filteredSuppliers.map((supplier) => {
                  const draft = drafts[supplier.supplier_id] || emptyDraft;
                  const isUsageBased = draft.policy === "monthly_actual" || draft.policy === "quarterly_actual";
                  return (
                    <div key={supplier.supplier_id} className="overflow-hidden rounded-lg border bg-white shadow-sm">
                      <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="break-words font-semibold text-slate-950">
                            {supplier.supplier_company_name || `Supplier #${supplier.supplier_id}`}
                          </p>
                          <p className="mt-1 break-words text-xs text-slate-500">
                            ID {supplier.supplier_id}
                            {supplier.supplier_contact_name ? ` · ${supplier.supplier_contact_name}` : ""}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-3 self-start sm:self-auto">
                          {supplier.terms_configured ? (
                            <Badge className="gap-1 whitespace-nowrap bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                              <CheckCircle2 className="h-3.5 w-3.5" />Configured
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1 whitespace-nowrap">
                              <AlertTriangle className="h-3.5 w-3.5" />Missing
                            </Badge>
                          )}
                          <Button size="sm" onClick={() => saveSupplier(supplier)} disabled={savingId === supplier.supplier_id}>
                            {savingId === supplier.supplier_id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}Save
                          </Button>
                        </div>
                      </div>

                      <div className="grid gap-5 border-t bg-slate-50/70 p-4 lg:grid-cols-[minmax(220px,280px)_minmax(0,1fr)]">
                        <div className="min-w-0">
                          <Label className="mb-1.5 block text-xs text-slate-500">Payment policy</Label>
                          <Select value={draft.policy || undefined} onValueChange={(value: Exclude<PaymentPolicy, "">) => updateDraft(supplier.supplier_id, { policy: value })}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select policy" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="annual">Annual estimated</SelectItem>
                              <SelectItem value="upfront">Full contract upfront</SelectItem>
                              <SelectItem value="upfront_reconciliation">Upfront + reconciliation</SelectItem>
                              <SelectItem value="monthly_actual">Monthly actual usage</SelectItem>
                              <SelectItem value="quarterly_actual">Quarterly actual usage</SelectItem>
                            </SelectContent>
                          </Select>
                          {draft.policy && <p className="mt-2 text-xs font-medium text-slate-500">{policyLabel(draft.policy)}</p>}
                        </div>

                        <div className="min-w-0">
                          {draft.policy === "upfront_reconciliation" ? (
                            <div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-end">
                              <div className="min-w-0">
                                <Label className="mb-1.5 block text-xs text-slate-500">Upfront percentage</Label>
                                <div className="flex min-w-0">
                                  <Input className="min-w-0 rounded-r-none" min={0} max={100} type="number" value={draft.upfrontPercentage} onChange={(event) => updateDraft(supplier.supplier_id, { upfrontPercentage: event.target.value })} />
                                  <span className="flex h-9 w-11 shrink-0 items-center justify-center rounded-r-md border border-l-0 bg-white text-sm text-slate-500">%</span>
                                </div>
                              </div>
                              <p className="pb-2 text-sm text-slate-600">The remaining balance is reconciled at contract end.</p>
                            </div>
                          ) : isUsageBased ? (
                            <div className="grid gap-3 sm:grid-cols-3">
                              {([
                                ["Invoice issued", "invoiceDelayDays"],
                                ["Customer pays", "customerPaymentDays"],
                                ["Grace period", "graceDays"],
                              ] as const).map(([label, field]) => (
                                <div key={field} className="min-w-0">
                                  <Label className="mb-1.5 block min-h-4 text-xs text-slate-500">{label}</Label>
                                  <div className="flex min-w-0">
                                    <Input className="min-w-0 rounded-r-none" min={0} type="number" value={draft[field]} onChange={(event) => updateDraft(supplier.supplier_id, { [field]: event.target.value })} />
                                    <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-r-md border border-l-0 bg-white text-xs text-slate-500">days</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : draft.policy === "annual" || draft.policy === "upfront" ? (
                            <div className="max-w-60">
                              <Label className="mb-1.5 block text-xs text-slate-500">Delay after live date</Label>
                              <div className="flex min-w-0">
                                <Input className="min-w-0 rounded-r-none" min={0} type="number" value={draft.delayDays} onChange={(event) => updateDraft(supplier.supplier_id, { delayDays: event.target.value })} />
                                <span className="flex h-9 w-14 shrink-0 items-center justify-center rounded-r-md border border-l-0 bg-white text-xs text-slate-500">days</span>
                              </div>
                            </div>
                          ) : (
                            <div className="flex min-h-16 items-center rounded-md border border-dashed bg-white px-4 text-sm text-slate-500">
                              Select how this supplier pays commission.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredSuppliers.length === 0 && <div className="rounded-lg border border-dashed px-4 py-12 text-center text-slate-500">No suppliers match the current filters.</div>}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
