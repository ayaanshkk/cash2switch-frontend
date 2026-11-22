"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, ExternalLink, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/api";

type Aggregator = {
  aggregator_id: number;
  aggregator_company_name: string | null;
  aggregator_contact_name: string | null;
  aggregator_email: string | null;
  aggregator_email_secondary: string | null;
  aggregator_phone: string | null;
  aggregator_website: string | null;
  aggregator_address: string | null;
};

export default function AggregatorDetailPage() {
  const params = useParams();
  const router = useRouter();
  const aggregatorId = params.id as string;

  const [aggregator, setAggregator] = useState<Aggregator | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    aggregator_company_name: "",
    aggregator_contact_name: "",
    aggregator_email: "",
    aggregator_email_secondary: "",
    aggregator_phone: "",
    aggregator_website: "",
    aggregator_address: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetchWithAuth(`/api/commission/aggregators/${aggregatorId}`)
      .then((data) => {
        const a: Aggregator = data.aggregator;
        setAggregator(a);
        setForm({
          aggregator_company_name: a.aggregator_company_name ?? "",
          aggregator_contact_name: a.aggregator_contact_name ?? "",
          aggregator_email: a.aggregator_email ?? "",
          aggregator_email_secondary: a.aggregator_email_secondary ?? "",
          aggregator_phone: a.aggregator_phone ?? "",
          aggregator_website: a.aggregator_website ?? "",
          aggregator_address: a.aggregator_address ?? "",
        });
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load aggregator"))
      .finally(() => setLoading(false));
  }, [aggregatorId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const data = await fetchWithAuth(`/api/commission/aggregators/${aggregatorId}/details`, {
        method: "PATCH",
        body: JSON.stringify(form),
      });
      setAggregator(data.aggregator);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save details");
    } finally {
      setSaving(false);
    }
  }

  function normalizeUrl(url: string) {
    if (!url) return url;
    return /^https?:\/\//i.test(url) ? url : `https://${url}`;
  }

  if (loading) {
    return (
      <div className="flex min-h-96 items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !aggregator) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error || "Aggregator not found"}</div>
        <Button variant="ghost" className="mt-4" onClick={() => router.back()}>← Back</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <Button variant="ghost" size="sm" className="mb-3 -ml-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
            onClick={() => router.push("/dashboard/payments/aggregators")}>
            <ArrowLeft className="mr-1.5 h-4 w-4" />Back to Aggregators
          </Button>
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Aggregators</p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950 dark:text-slate-50">
            {aggregator.aggregator_company_name || `Aggregator #${aggregator.aggregator_id}`}
          </h1>
        </div>

        {/* Details form */}
        <div className="rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-200 dark:border-slate-700 px-6 py-4">
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Contact Details</h2>
          </div>
          <form onSubmit={handleSave}>
            <div className="px-6 py-5 space-y-5">
              {saveError && (
                <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{saveError}</div>
              )}
              {saveSuccess && (
                <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400">Details saved successfully.</div>
              )}

              <div>
                <Label className="mb-1.5 block text-xs text-slate-500">Company Name</Label>
                <Input value={form.aggregator_company_name}
                  onChange={(e) => setForm({ ...form, aggregator_company_name: e.target.value })}
                  className="dark:border-slate-700 dark:bg-slate-950" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Contact Person</Label>
                  <Input value={form.aggregator_contact_name}
                    onChange={(e) => setForm({ ...form, aggregator_contact_name: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Phone</Label>
                  <Input value={form.aggregator_phone}
                    onChange={(e) => setForm({ ...form, aggregator_phone: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Primary Email</Label>
                  <Input type="email" value={form.aggregator_email}
                    onChange={(e) => setForm({ ...form, aggregator_email: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <div>
                  <Label className="mb-1.5 block text-xs text-slate-500">Secondary Email</Label>
                  <Input type="email" value={form.aggregator_email_secondary}
                    onChange={(e) => setForm({ ...form, aggregator_email_secondary: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950" />
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-xs text-slate-500">Website</Label>
                  <div className="flex items-center gap-2">
                    <Input value={form.aggregator_website}
                      onChange={(e) => setForm({ ...form, aggregator_website: e.target.value })}
                      className="dark:border-slate-700 dark:bg-slate-950" placeholder="https://www.aggregator.com" />
                    {form.aggregator_website && (
                      <a href={normalizeUrl(form.aggregator_website)} target="_blank" rel="noopener noreferrer"
                        className="flex shrink-0 items-center gap-1 text-xs text-blue-600 hover:underline dark:text-blue-400">
                        Visit site <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="sm:col-span-2">
                  <Label className="mb-1.5 block text-xs text-slate-500">Address</Label>
                  <Textarea value={form.aggregator_address}
                    onChange={(e) => setForm({ ...form, aggregator_address: e.target.value })}
                    className="dark:border-slate-700 dark:bg-slate-950 resize-none" rows={3} />
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-slate-200 dark:border-slate-700 px-6 py-4">
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Details
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
