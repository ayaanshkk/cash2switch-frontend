"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Mail, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/api";

type SupplierEmails = { primary: string | null; secondary: string | null };

type ChaseEmailDraft = {
  paymentId: string;
  mpan: string;
  businessName: string;
  supplierName: string;
  startDate: string;
  endDate: string;
  expected: string;
  received: string;
  supplierId?: number | null;
  supplierEmails?: SupplierEmails;
};

function buildDefaultBody(d: ChaseEmailDraft): string {
  return (
    `Hi,\n\n` +
    `Raising a query for the payment for MPAN ${d.mpan}.\n\n` +
    `Business Name:     ${d.businessName}\n` +
    `Supplier:          ${d.supplierName}\n` +
    `Start Date:        ${d.startDate}\n` +
    `End Date:          ${d.endDate}\n` +
    `Expected Payment:  £${d.expected}\n` +
    `Received to Date:  £${d.received}\n\n` +
    `Please confirm when this will be resolved and reply back to this email.\n\n` +
    `Regards\n` +
    `Business Gas`
  );
}

function buildDefaultSubject(d: ChaseEmailDraft): string {
  return `Commission Payment Query — MPAN ${d.mpan} (${d.supplierName})`;
}

export default function ChaseEmailPage() {
  const router = useRouter();

  const [draft, setDraft] = useState<ChaseEmailDraft | null>(null);
  const [supplierEmails, setSupplierEmails] = useState<SupplierEmails>({ primary: null, secondary: null });
  const [emailTarget, setEmailTarget] = useState<"primary" | "secondary" | "both">("primary");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let d: ChaseEmailDraft;
    try {
      const raw = sessionStorage.getItem("chaseEmailDraft");
      if (!raw) { router.replace("/dashboard/payments"); return; }
      d = JSON.parse(raw);
    } catch {
      router.replace("/dashboard/payments");
      return;
    }

    setDraft(d);
    setSubject(buildDefaultSubject(d));
    setBody(buildDefaultBody(d));

    // Always fetch supplier emails fresh from the API — the sessionStorage copy may be stale or missing
    if (d.supplierId != null) {
      fetchWithAuth(`/api/commission/supplier-terms/${d.supplierId}`)
        .then((data) => {
          const s = data.supplier;
          const emails: SupplierEmails = {
            primary: s.supplier_email || null,
            secondary: s.supplier_email_secondary || null,
          };
          setSupplierEmails(emails);
          setEmailTarget(emails.primary ? "primary" : "secondary");
        })
        .catch(() => {
          // Fall back to whatever was stored in sessionStorage
          if (d.supplierEmails) {
            setSupplierEmails(d.supplierEmails);
            setEmailTarget(d.supplierEmails.primary ? "primary" : "secondary");
          }
        });
    } else if (d.supplierEmails) {
      setSupplierEmails(d.supplierEmails);
      setEmailTarget(d.supplierEmails.primary ? "primary" : "secondary");
    }
  }, [router]);

  async function handleSend() {
    if (!draft) return;
    const to: string[] = [];
    if ((emailTarget === "primary" || emailTarget === "both") && supplierEmails.primary) to.push(supplierEmails.primary);
    if ((emailTarget === "secondary" || emailTarget === "both") && supplierEmails.secondary) to.push(supplierEmails.secondary);
    if (!to.length) { setError("Please select a recipient before sending."); return; }

    setSending(true);
    setError(null);
    try {
      await fetchWithAuth(`/api/commission/payments/${draft.paymentId}/chase-email`, {
        method: "POST",
        body: JSON.stringify({ to, subject, body }),
      });
      await fetchWithAuth(`/api/commission/payments/${draft.paymentId}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "Chasing Supplier" }),
      });
      setSent(true);
      sessionStorage.removeItem("chaseEmailDraft");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send email. Please try again.");
    } finally {
      setSending(false);
    }
  }

  const hasBoth = !!(supplierEmails.primary && supplierEmails.secondary);
  const hasNone = !supplierEmails.primary && !supplierEmails.secondary;

  if (!draft) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (sent) {
    return (
      <div className="min-h-screen bg-transparent px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-xl">
          <div className="rounded-2xl border border-emerald-200 bg-white shadow-sm dark:border-emerald-900/40 dark:bg-slate-900 overflow-hidden">
            <div className="bg-emerald-50 dark:bg-emerald-950/30 px-8 py-10 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/60 ring-4 ring-emerald-50 dark:ring-emerald-950">
                <Mail className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-emerald-900 dark:text-emerald-100">Email Sent Successfully</h2>
              <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">
                The supplier has been contacted. This payment has been marked as{" "}
                <span className="font-semibold">Chasing Supplier</span>.
              </p>
              <Button className="mt-6 bg-emerald-700 hover:bg-emerald-800 text-white" onClick={() => router.push("/dashboard/payments")}>
                Back to Payment Tracker
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Breadcrumb */}
        <button
          onClick={() => router.push("/dashboard/payments")}
          className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Payment Tracker
        </button>

        {/* Page title */}
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Chase Supplier Email
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Review and edit before sending. The payment will be marked as{" "}
            <strong className="text-slate-700 dark:text-slate-300">Chasing Supplier</strong> once sent.
          </p>
        </div>

        {/* Email composer card */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">

          {/* To field */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-start gap-4">
              <span className="pt-0.5 w-16 shrink-0 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">To</span>
              {hasNone ? (
                <p className="text-sm text-amber-600 dark:text-amber-400">
                  No email addresses found for this supplier.{" "}
                  <button
                    className="underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300 transition-colors"
                    onClick={() => router.push("/dashboard/payments/supplier-terms")}
                  >
                    Add them in Suppliers
                  </button>{" "}
                  first.
                </p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {supplierEmails.primary && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
                      border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600
                      has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50 dark:has-[:checked]:border-slate-400 dark:has-[:checked]:bg-slate-800/60">
                      <input type="radio" name="emailTarget" value="primary"
                        checked={emailTarget === "primary"} onChange={() => setEmailTarget("primary")}
                        className="accent-slate-800" />
                      <span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">Primary</span>
                        <span className="ml-1.5 text-slate-500 dark:text-slate-400">{supplierEmails.primary}</span>
                      </span>
                    </label>
                  )}
                  {supplierEmails.secondary && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
                      border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600
                      has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50 dark:has-[:checked]:border-slate-400 dark:has-[:checked]:bg-slate-800/60">
                      <input type="radio" name="emailTarget" value="secondary"
                        checked={emailTarget === "secondary"} onChange={() => setEmailTarget("secondary")}
                        className="accent-slate-800" />
                      <span>
                        <span className="font-medium text-slate-700 dark:text-slate-300">Secondary</span>
                        <span className="ml-1.5 text-slate-500 dark:text-slate-400">{supplierEmails.secondary}</span>
                      </span>
                    </label>
                  )}
                  {hasBoth && (
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition-colors
                      border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600
                      has-[:checked]:border-slate-800 has-[:checked]:bg-slate-50 dark:has-[:checked]:border-slate-400 dark:has-[:checked]:bg-slate-800/60">
                      <input type="radio" name="emailTarget" value="both"
                        checked={emailTarget === "both"} onChange={() => setEmailTarget("both")}
                        className="accent-slate-800" />
                      <span className="font-medium text-slate-700 dark:text-slate-300">Both</span>
                    </label>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Subject field */}
          <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center gap-4">
              <span className="w-16 shrink-0 text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500 select-none">Subject</span>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 px-0 text-sm font-medium text-slate-800 dark:text-slate-200 bg-transparent placeholder:text-slate-400 dark:bg-transparent"
                placeholder="Email subject…"
              />
            </div>
          </div>

          {/* Body */}
          <div className="px-6 py-5">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={18}
              className="w-full border-0 shadow-none focus-visible:ring-0 px-0 resize-none text-sm leading-7 text-slate-700 dark:text-slate-300 bg-transparent dark:bg-transparent placeholder:text-slate-400"
              placeholder="Compose your message…"
            />
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center justify-between pb-10">
          <button
            onClick={() => router.push("/dashboard/payments")}
            disabled={sending}
            className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors disabled:opacity-40"
          >
            Cancel
          </button>
          <Button
            onClick={handleSend}
            disabled={sending || hasNone}
            className="gap-2 px-6 bg-slate-900 hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-200"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {sending ? "Sending…" : "Send & Mark as Chasing"}
          </Button>
        </div>

      </div>
    </div>
  );
}
