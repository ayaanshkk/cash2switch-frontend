"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/api";

type PaymentPolicy = "annual" | "upfront" | "upfront_reconciliation" | "monthly_actual" | "quarterly_actual" | "";

const emptyForm = {
  supplier_company_name: "",
  supplier_contact_name: "",
  supplier_phone: "",
  supplier_email: "",
  supplier_email_secondary: "",
  supplier_website: "",
  supplier_address: "",
  policy: "" as PaymentPolicy,
  delayDays: "",
  upfrontPercentage: "",
  invoiceDelayDays: "",
  customerPaymentDays: "",
  graceDays: "",
};

type Supplier = {
  supplier_id: number;
  supplier_display_id: string | null;
  supplier_company_name: string | null;
  supplier_contact_name: string | null;
  supplier_email: string | null;
  supplier_phone: string | null;
  terms_configured: boolean;
};

type InlineDraft = {
  supplier_company_name: string;
  supplier_contact_name: string;
  supplier_email: string;
  supplier_phone: string;
};

function cleanContact(value: string | null, companyName: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v) return null;
  if (/auto.?import|auto.?creat/i.test(v)) return null;
  if (companyName) {
    const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const nv = norm(v);
    const nc = norm(companyName);
    if (nv.length >= 5 && nc.length >= 5 && (nv === nc || nc.includes(nv) || nv.includes(nc))) return null;
  }
  return v;
}

export default function SuppliersPage() {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [page, setPage] = useState(1);
  const PER_PAGE = 20;

  // Add modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [addForm, setAddForm] = useState({ ...emptyForm });
  const [addSaving, setAddSaving] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  // Inline edit
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState<InlineDraft | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  const filteredSuppliers = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return suppliers
      .filter((s) => {
        if (!query) return true;
        return [s.supplier_company_name, s.supplier_contact_name, s.supplier_email, s.supplier_phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query));
      })
      .sort((a, b) => b.supplier_id - a.supplier_id);
  }, [searchTerm, suppliers]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / PER_PAGE));
  const pagedSuppliers = filteredSuppliers.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pagedIds = pagedSuppliers.map((s) => s.supplier_id);
  const allPageSelected = pagedIds.length > 0 && pagedIds.every((id) => selected.has(id));
  const somePageSelected = pagedIds.some((id) => selected.has(id));

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchWithAuth("/api/commission/supplier-terms")
      .then((data) => setSuppliers(data.suppliers || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load suppliers"))
      .finally(() => setLoading(false));
  }, []);

  function toggleOne(e: React.MouseEvent, id: number) {
    e.stopPropagation();
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll(e: React.ChangeEvent<HTMLInputElement>) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (e.target.checked) pagedIds.forEach((id) => next.add(id));
      else pagedIds.forEach((id) => next.delete(id));
      return next;
    });
  }

  function startEdit(e: React.MouseEvent, s: Supplier) {
    e.stopPropagation();
    setEditingId(s.supplier_id);
    setEditDraft({
      supplier_company_name: s.supplier_company_name ?? "",
      supplier_contact_name: cleanContact(s.supplier_contact_name, s.supplier_company_name) ?? "",
      supplier_email: s.supplier_email ?? "",
      supplier_phone: s.supplier_phone ?? "",
    });
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(e: React.MouseEvent, supplierId: number) {
    e.stopPropagation();
    if (!editDraft) return;
    setEditSaving(true);
    try {
      const data = await fetchWithAuth(`/api/commission/supplier-terms/${supplierId}/details`, {
        method: "PATCH",
        body: JSON.stringify(editDraft),
      });
      const updated = data.supplier;
      setSuppliers((prev) => prev.map((s) => s.supplier_id === supplierId ? { ...s, ...updated } : s));
      setEditingId(null);
      setEditDraft(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, supplierId: number, name: string) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(supplierId);
    setDeleteError(null);
    try {
      await fetchWithAuth(`/api/commission/supplier-terms/${supplierId}`, { method: "DELETE" });
      setSuppliers((prev) => prev.filter((s) => s.supplier_id !== supplierId));
      setSelected((prev) => { const n = new Set(prev); n.delete(supplierId); return n; });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete supplier");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.supplier_company_name.trim()) { setAddError("Company name is required."); return; }
    if (!addForm.supplier_contact_name.trim()) { setAddError("Main contact person is required."); return; }
    if (!addForm.supplier_phone.trim()) { setAddError("Phone number is required."); return; }
    if (!addForm.supplier_email.trim()) { setAddError("Primary email address is required."); return; }
    setAddSaving(true);
    setAddError(null);
    try {
      const createData = await fetchWithAuth("/api/commission/supplier-terms", {
        method: "POST",
        body: JSON.stringify(addForm),
      });
      let supplier = createData.supplier;
      const id = supplier.supplier_id;

      // Save payment terms if a policy was selected
      if (addForm.policy) {
        const isLegacyUpfront = addForm.policy === "upfront";
        const isUsageBased = addForm.policy === "monthly_actual" || addForm.policy === "quarterly_actual";
        const termsData = await fetchWithAuth(`/api/commission/supplier-terms/${id}`, {
          method: "PUT",
          body: JSON.stringify({
            commission_payment_type: isLegacyUpfront ? null : addForm.policy,
            multi_year_commission_payment_mode: isLegacyUpfront ? "upfront" : addForm.policy === "annual" ? "annual" : undefined,
            commission_payment_delay_days: addForm.delayDays === "" ? null : Number(addForm.delayDays),
            upfront_percentage: addForm.upfrontPercentage === "" ? null : Number(addForm.upfrontPercentage),
            reconciliation_required: addForm.policy === "upfront_reconciliation",
            invoice_delay_days: isUsageBased && addForm.invoiceDelayDays !== "" ? Number(addForm.invoiceDelayDays) : null,
            customer_payment_days: isUsageBased && addForm.customerPaymentDays !== "" ? Number(addForm.customerPaymentDays) : null,
            grace_days: isUsageBased && addForm.graceDays !== "" ? Number(addForm.graceDays) : null,
          }),
        });
        supplier = termsData.supplier;
      }

      setSuppliers((prev) => [supplier, ...prev]);
      setShowAddModal(false);
      setAddForm({ ...emptyForm });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add supplier");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    const names = suppliers.filter((s) => ids.includes(s.supplier_id)).map((s) => s.supplier_company_name || `#${s.supplier_id}`).join(", ");
    if (!window.confirm(`Delete ${ids.length} supplier${ids.length > 1 ? "s" : ""} (${names})? This cannot be undone.`)) return;
    setBulkDeleting(true);
    setDeleteError(null);
    const failed: number[] = [];
    for (const id of ids) {
      try { await fetchWithAuth(`/api/commission/supplier-terms/${id}`, { method: "DELETE" }); }
      catch { failed.push(id); }
    }
    setSuppliers((prev) => prev.filter((s) => !ids.includes(s.supplier_id) || failed.includes(s.supplier_id)));
    setSelected(new Set(failed));
    if (failed.length) setDeleteError(`${failed.length} supplier(s) could not be deleted (may have linked contracts).`);
    setBulkDeleting(false);
  }

  const addIsUsageBased = addForm.policy === "monthly_actual" || addForm.policy === "quarterly_actual";

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Header */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Payments</p>
          <div className="mt-1">
            <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Suppliers</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              View and manage supplier details and payment terms. Click a row to open full details.
            </p>
          </div>
        </div>

        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{error}</div>}
        {deleteError && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{deleteError}</div>}

        {/* Toolbar */}
        <div className="flex items-center gap-3">
          <div className="relative sm:max-w-72 flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              className="w-full pl-9 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100"
              placeholder="Search suppliers..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <Button onClick={() => { setAddForm({ ...emptyForm }); setAddError(null); setShowAddModal(true); }} className="ml-auto shrink-0">
            <Plus className="mr-2 h-4 w-4" />Add Supplier
          </Button>
          {selected.size > 0 && (
            <Button variant="destructive" size="sm" disabled={bulkDeleting} onClick={handleBulkDelete}>
              {bulkDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
              Delete Selected ({selected.size})
            </Button>
          )}
        </div>

        {/* Table */}
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-900 shadow-sm">
          {loading ? (
            <div className="flex min-h-48 items-center justify-center text-slate-500 dark:text-slate-400">
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading suppliers...
            </div>
          ) : (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: "3%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "23%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "3%" }} />
              </colgroup>
              <thead className="bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                <tr>
                  <th className="px-3 py-3 text-center">
                    <input type="checkbox" className="h-4 w-4 rounded accent-slate-700 cursor-pointer"
                      checked={allPageSelected}
                      ref={(el) => { if (el) el.indeterminate = somePageSelected && !allPageSelected; }}
                      onChange={toggleAll} />
                  </th>
                  <th className="px-2 py-3 text-left font-medium text-slate-400">#</th>
                  <th className="text-left px-4 py-3 font-medium">Supplier Name</th>
                  <th className="text-left px-4 py-3 font-medium">Contact Person</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Phone</th>
                  <th className="text-center px-3 py-3 font-medium">Action</th>
                  <th className="px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {pagedSuppliers.length === 0 ? (
                  <tr><td colSpan={8} className="text-center py-16 text-slate-400">No suppliers found.</td></tr>
                ) : (
                  pagedSuppliers.map((s, i) => {
                    const isEditing = editingId === s.supplier_id;
                    const contact = cleanContact(s.supplier_contact_name, s.supplier_company_name);
                    const displayName = s.supplier_company_name || `Supplier #${s.supplier_id}`;
                    const rowNum = filteredSuppliers.length - ((page - 1) * PER_PAGE + i);
                    const isSelected = selected.has(s.supplier_id);
                    return (
                      <tr
                        key={s.supplier_id}
                        className={`border-t border-slate-100 dark:border-slate-700 transition-colors ${
                          isEditing
                            ? "bg-amber-50/60 dark:bg-amber-950/10"
                            : isSelected
                            ? "bg-blue-50 dark:bg-blue-950/20"
                            : i % 2 === 0
                            ? "hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                            : "bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        }`}
                        onClick={isEditing ? undefined : () => router.push(`/dashboard/payments/supplier-terms/${s.supplier_id}`)}
                      >
                        <td className="px-3 py-2 text-center" onClick={(e) => toggleOne(e, s.supplier_id)}>
                          <input type="checkbox" className="h-4 w-4 rounded accent-slate-700 cursor-pointer" checked={isSelected} onChange={() => {}} />
                        </td>
                        <td className="px-2 py-2 text-slate-400 text-xs">{rowNum}</td>

                        {/* Supplier Name */}
                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100 truncate">
                          {isEditing && editDraft ? (
                            <Input value={editDraft.supplier_company_name}
                              onChange={(e) => setEditDraft({ ...editDraft, supplier_company_name: e.target.value })}
                              className="h-8 text-sm dark:border-slate-600 dark:bg-slate-800"
                              onClick={(e) => e.stopPropagation()} />
                          ) : displayName}
                        </td>

                        {/* Contact Person */}
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 truncate">
                          {isEditing && editDraft ? (
                            <Input value={editDraft.supplier_contact_name}
                              onChange={(e) => setEditDraft({ ...editDraft, supplier_contact_name: e.target.value })}
                              className="h-8 text-sm dark:border-slate-600 dark:bg-slate-800"
                              onClick={(e) => e.stopPropagation()} />
                          ) : (contact ?? <span className="text-slate-400">—</span>)}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 truncate">
                          {isEditing && editDraft ? (
                            <Input type="email" value={editDraft.supplier_email}
                              onChange={(e) => setEditDraft({ ...editDraft, supplier_email: e.target.value })}
                              className="h-8 text-sm dark:border-slate-600 dark:bg-slate-800"
                              onClick={(e) => e.stopPropagation()} />
                          ) : (s.supplier_email ?? <span className="text-slate-400">—</span>)}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 truncate">
                          {isEditing && editDraft ? (
                            <Input value={editDraft.supplier_phone}
                              onChange={(e) => setEditDraft({ ...editDraft, supplier_phone: e.target.value })}
                              className="h-8 text-sm dark:border-slate-600 dark:bg-slate-800"
                              onClick={(e) => e.stopPropagation()} />
                          ) : (s.supplier_phone ?? <span className="text-slate-400">—</span>)}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                disabled={editSaving} onClick={(e) => saveEdit(e, s.supplier_id)}>
                                {editSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                                onClick={cancelEdit}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                                onClick={(e) => startEdit(e, s)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                disabled={deletingId === s.supplier_id} onClick={(e) => handleDelete(e, s.supplier_id, displayName)}>
                                {deletingId === s.supplier_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
                            </div>
                          )}
                        </td>

                        {/* Alert */}
                        <td className="px-3 py-2 text-center">
                          {!s.terms_configured && (
                            <div className="relative inline-flex group">
                              <AlertTriangle className="h-4 w-4 text-red-500 cursor-default" />
                              <div className="pointer-events-none absolute top-1/2 right-full -translate-y-1/2 mr-2 rounded-md bg-slate-900 dark:bg-slate-100 px-3 py-1.5 text-xs text-white dark:text-slate-900 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap">
                                Payment terms not configured
                                <div className="absolute top-1/2 left-full -translate-y-1/2 border-4 border-transparent border-l-slate-900 dark:border-l-slate-100" />
                              </div>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filteredSuppliers.length > PER_PAGE && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filteredSuppliers.length)} of {filteredSuppliers.length}</span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="px-3 py-1 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                {page} / {totalPages}
              </span>
              <Button variant="outline" size="icon" className="h-8 w-8" disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Add Supplier Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Supplier</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddSupplier}>
              <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
                {addError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{addError}</div>
                )}

                {/* Contact info */}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block text-xs text-slate-500">Company Name <span className="text-red-500">*</span></Label>
                    <Input value={addForm.supplier_company_name} onChange={(e) => setAddForm({ ...addForm, supplier_company_name: e.target.value })}
                      placeholder="e.g. British Gas" className="dark:border-slate-700 dark:bg-slate-950" autoFocus />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Main Contact Person <span className="text-red-500">*</span></Label>
                    <Input value={addForm.supplier_contact_name} onChange={(e) => setAddForm({ ...addForm, supplier_contact_name: e.target.value })}
                      placeholder="e.g. John Smith" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Phone Number <span className="text-red-500">*</span></Label>
                    <Input value={addForm.supplier_phone} onChange={(e) => setAddForm({ ...addForm, supplier_phone: e.target.value })}
                      placeholder="+44 20 1234 5678" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Primary Email <span className="text-red-500">*</span></Label>
                    <Input type="email" value={addForm.supplier_email} onChange={(e) => setAddForm({ ...addForm, supplier_email: e.target.value })}
                      placeholder="commissions@supplier.com" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Secondary Email</Label>
                    <Input type="email" value={addForm.supplier_email_secondary} onChange={(e) => setAddForm({ ...addForm, supplier_email_secondary: e.target.value })}
                      placeholder="accounts@supplier.com" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block text-xs text-slate-500">Website</Label>
                    <Input value={addForm.supplier_website} onChange={(e) => setAddForm({ ...addForm, supplier_website: e.target.value })}
                      placeholder="https://www.supplier.com" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block text-xs text-slate-500">Address</Label>
                    <Textarea value={addForm.supplier_address} onChange={(e) => setAddForm({ ...addForm, supplier_address: e.target.value })}
                      placeholder="123 Energy Street, London, EC1A 1BB" className="dark:border-slate-700 dark:bg-slate-950 resize-none" rows={2} />
                  </div>
                </div>

                {/* Payment terms */}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 space-y-3">
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Payment Terms (optional)</p>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Payment Policy</Label>
                    <Select value={addForm.policy || undefined} onValueChange={(v: Exclude<PaymentPolicy, "">) => setAddForm({ ...addForm, policy: v })}>
                      <SelectTrigger className="dark:border-slate-700 dark:bg-slate-950">
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

                  {addForm.policy === "upfront_reconciliation" && (
                    <div className="max-w-48">
                      <Label className="mb-1.5 block text-xs text-slate-500">Upfront percentage</Label>
                      <div className="flex">
                        <Input type="number" min={0} max={100} value={addForm.upfrontPercentage}
                          onChange={(e) => setAddForm({ ...addForm, upfrontPercentage: e.target.value })}
                          className="rounded-r-none dark:border-slate-700 dark:bg-slate-950" />
                        <span className="flex h-9 w-10 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-800">%</span>
                      </div>
                    </div>
                  )}

                  {addIsUsageBased && (
                    <div className="grid grid-cols-3 gap-3">
                      {([["Invoice issued", "invoiceDelayDays"], ["Customer pays", "customerPaymentDays"], ["Grace period", "graceDays"]] as const).map(([label, field]) => (
                        <div key={field}>
                          <Label className="mb-1.5 block text-xs text-slate-500">{label}</Label>
                          <div className="flex">
                            <Input type="number" min={0} value={addForm[field]}
                              onChange={(e) => setAddForm({ ...addForm, [field]: e.target.value })}
                              className="rounded-r-none dark:border-slate-700 dark:bg-slate-950" />
                            <span className="flex h-9 w-12 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">days</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(addForm.policy === "annual" || addForm.policy === "upfront") && (
                    <div className="max-w-48">
                      <Label className="mb-1.5 block text-xs text-slate-500">Delay after live date</Label>
                      <div className="flex">
                        <Input type="number" min={0} value={addForm.delayDays}
                          onChange={(e) => setAddForm({ ...addForm, delayDays: e.target.value })}
                          className="rounded-r-none dark:border-slate-700 dark:bg-slate-950" />
                        <span className="flex h-9 w-12 items-center justify-center rounded-r-md border border-l-0 border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800">days</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={addSaving}>
                  {addSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add Supplier
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
