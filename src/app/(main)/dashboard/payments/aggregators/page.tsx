"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, ChevronLeft, ChevronRight, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchWithAuth } from "@/lib/api";

const emptyForm = {
  aggregator_company_name: "",
  aggregator_contact_name: "",
  aggregator_phone: "",
  aggregator_email: "",
  aggregator_email_secondary: "",
  aggregator_website: "",
  aggregator_address: "",
};

type Aggregator = {
  aggregator_id: number;
  aggregator_company_name: string | null;
  aggregator_contact_name: string | null;
  aggregator_email: string | null;
  aggregator_phone: string | null;
};

type InlineDraft = {
  aggregator_company_name: string;
  aggregator_contact_name: string;
  aggregator_email: string;
  aggregator_phone: string;
};

export default function AggregatorsPage() {
  const router = useRouter();
  const [aggregators, setAggregators] = useState<Aggregator[]>([]);
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

  const filteredAggregators = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return aggregators
      .filter((a) => {
        if (!query) return true;
        return [a.aggregator_company_name, a.aggregator_contact_name, a.aggregator_email, a.aggregator_phone]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(query));
      })
      .sort((a, b) => b.aggregator_id - a.aggregator_id);
  }, [searchTerm, aggregators]);

  const totalPages = Math.max(1, Math.ceil(filteredAggregators.length / PER_PAGE));
  const pagedAggregators = filteredAggregators.slice((page - 1) * PER_PAGE, page * PER_PAGE);
  const pagedIds = pagedAggregators.map((a) => a.aggregator_id);
  const allPageSelected = pagedIds.length > 0 && pagedIds.every((id) => selected.has(id));
  const somePageSelected = pagedIds.some((id) => selected.has(id));

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchWithAuth("/api/commission/aggregators")
      .then((data) => setAggregators(data.aggregators || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load aggregators"))
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

  function startEdit(e: React.MouseEvent, a: Aggregator) {
    e.stopPropagation();
    setEditingId(a.aggregator_id);
    setEditDraft({
      aggregator_company_name: a.aggregator_company_name ?? "",
      aggregator_contact_name: a.aggregator_contact_name ?? "",
      aggregator_email: a.aggregator_email ?? "",
      aggregator_phone: a.aggregator_phone ?? "",
    });
  }

  function cancelEdit(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
    setEditDraft(null);
  }

  async function saveEdit(e: React.MouseEvent, aggregatorId: number) {
    e.stopPropagation();
    if (!editDraft) return;
    setEditSaving(true);
    try {
      const data = await fetchWithAuth(`/api/commission/aggregators/${aggregatorId}/details`, {
        method: "PATCH",
        body: JSON.stringify(editDraft),
      });
      const updated = data.aggregator;
      setAggregators((prev) => prev.map((a) => a.aggregator_id === aggregatorId ? { ...a, ...updated } : a));
      setEditingId(null);
      setEditDraft(null);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setEditSaving(false);
    }
  }

  async function handleDelete(e: React.MouseEvent, aggregatorId: number, name: string) {
    e.stopPropagation();
    if (!window.confirm(`Delete "${name}"? This cannot be undone.`)) return;
    setDeletingId(aggregatorId);
    setDeleteError(null);
    try {
      await fetchWithAuth(`/api/commission/aggregators/${aggregatorId}`, { method: "DELETE" });
      setAggregators((prev) => prev.filter((a) => a.aggregator_id !== aggregatorId));
      setSelected((prev) => { const n = new Set(prev); n.delete(aggregatorId); return n; });
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete aggregator");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleAddAggregator(e: React.FormEvent) {
    e.preventDefault();
    if (!addForm.aggregator_company_name.trim()) { setAddError("Company name is required."); return; }
    if (!addForm.aggregator_contact_name.trim()) { setAddError("Main contact person is required."); return; }
    if (!addForm.aggregator_phone.trim()) { setAddError("Phone number is required."); return; }
    if (!addForm.aggregator_email.trim()) { setAddError("Primary email address is required."); return; }
    setAddSaving(true);
    setAddError(null);
    try {
      const createData = await fetchWithAuth("/api/commission/aggregators", {
        method: "POST",
        body: JSON.stringify(addForm),
      });
      setAggregators((prev) => [createData.aggregator, ...prev]);
      setShowAddModal(false);
      setAddForm({ ...emptyForm });
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add aggregator");
    } finally {
      setAddSaving(false);
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selected);
    const names = aggregators.filter((a) => ids.includes(a.aggregator_id)).map((a) => a.aggregator_company_name || `#${a.aggregator_id}`).join(", ");
    if (!window.confirm(`Delete ${ids.length} aggregator${ids.length > 1 ? "s" : ""} (${names})? This cannot be undone.`)) return;
    setBulkDeleting(true);
    setDeleteError(null);
    const failed: number[] = [];
    for (const id of ids) {
      try { await fetchWithAuth(`/api/commission/aggregators/${id}`, { method: "DELETE" }); }
      catch { failed.push(id); }
    }
    setAggregators((prev) => prev.filter((a) => !ids.includes(a.aggregator_id) || failed.includes(a.aggregator_id)));
    setSelected(new Set(failed));
    if (failed.length) setDeleteError(`${failed.length} aggregator(s) could not be deleted.`);
    setBulkDeleting(false);
  }

  return (
    <div className="min-h-screen bg-transparent px-4 py-6 text-slate-900 dark:bg-transparent dark:text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        {/* Header */}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Payments</p>
          <div className="mt-1">
            <h1 className="text-3xl font-semibold text-slate-950 dark:text-slate-50">Aggregators</h1>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              View and manage aggregator contact details. Click a row to open full details.
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
              placeholder="Search aggregators..."
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
            />
          </div>
          <Button onClick={() => { setAddForm({ ...emptyForm }); setAddError(null); setShowAddModal(true); }} className="ml-auto shrink-0">
            <Plus className="mr-2 h-4 w-4" />Add Aggregator
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
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading aggregators...
            </div>
          ) : (
            <table className="w-full text-sm table-fixed">
              <colgroup>
                <col style={{ width: "3%" }} />
                <col style={{ width: "4%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "18%" }} />
                <col style={{ width: "24%" }} />
                <col style={{ width: "15%" }} />
                <col style={{ width: "11%" }} />
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
                  <th className="text-left px-4 py-3 font-medium">Aggregator Name</th>
                  <th className="text-left px-4 py-3 font-medium">Contact Person</th>
                  <th className="text-left px-4 py-3 font-medium">Email</th>
                  <th className="text-left px-4 py-3 font-medium">Phone</th>
                  <th className="text-center px-3 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {pagedAggregators.length === 0 ? (
                  <tr><td colSpan={7} className="text-center py-16 text-slate-400">No aggregators found.</td></tr>
                ) : (
                  pagedAggregators.map((a, i) => {
                    const isEditing = editingId === a.aggregator_id;
                    const displayName = a.aggregator_company_name || `Aggregator #${a.aggregator_id}`;
                    const rowNum = filteredAggregators.length - ((page - 1) * PER_PAGE + i);
                    const isSelected = selected.has(a.aggregator_id);
                    return (
                      <tr
                        key={a.aggregator_id}
                        className={`border-t border-slate-100 dark:border-slate-700 transition-colors ${
                          isEditing
                            ? "bg-amber-50/60 dark:bg-amber-950/10"
                            : isSelected
                            ? "bg-blue-50 dark:bg-blue-950/20"
                            : i % 2 === 0
                            ? "hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                            : "bg-slate-50/40 dark:bg-slate-800/20 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer"
                        }`}
                        onClick={isEditing ? undefined : () => router.push(`/dashboard/payments/aggregators/${a.aggregator_id}`)}
                      >
                        <td className="px-3 py-2 text-center" onClick={(e) => toggleOne(e, a.aggregator_id)}>
                          <input type="checkbox" className="h-4 w-4 rounded accent-slate-700 cursor-pointer" checked={isSelected} onChange={() => {}} />
                        </td>
                        <td className="px-2 py-2 text-slate-400 text-xs">{rowNum}</td>

                        {/* Name */}
                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-slate-100 truncate">
                          {isEditing && editDraft ? (
                            <Input value={editDraft.aggregator_company_name}
                              onChange={(e) => setEditDraft({ ...editDraft, aggregator_company_name: e.target.value })}
                              className="h-8 text-sm dark:border-slate-600 dark:bg-slate-800"
                              onClick={(e) => e.stopPropagation()} />
                          ) : displayName}
                        </td>

                        {/* Contact */}
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 truncate">
                          {isEditing && editDraft ? (
                            <Input value={editDraft.aggregator_contact_name}
                              onChange={(e) => setEditDraft({ ...editDraft, aggregator_contact_name: e.target.value })}
                              className="h-8 text-sm dark:border-slate-600 dark:bg-slate-800"
                              onClick={(e) => e.stopPropagation()} />
                          ) : (a.aggregator_contact_name ?? <span className="text-slate-400">—</span>)}
                        </td>

                        {/* Email */}
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 truncate">
                          {isEditing && editDraft ? (
                            <Input type="email" value={editDraft.aggregator_email}
                              onChange={(e) => setEditDraft({ ...editDraft, aggregator_email: e.target.value })}
                              className="h-8 text-sm dark:border-slate-600 dark:bg-slate-800"
                              onClick={(e) => e.stopPropagation()} />
                          ) : (a.aggregator_email ?? <span className="text-slate-400">—</span>)}
                        </td>

                        {/* Phone */}
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-300 truncate">
                          {isEditing && editDraft ? (
                            <Input value={editDraft.aggregator_phone}
                              onChange={(e) => setEditDraft({ ...editDraft, aggregator_phone: e.target.value })}
                              className="h-8 text-sm dark:border-slate-600 dark:bg-slate-800"
                              onClick={(e) => e.stopPropagation()} />
                          ) : (a.aggregator_phone ?? <span className="text-slate-400">—</span>)}
                        </td>

                        {/* Actions */}
                        <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                          {isEditing ? (
                            <div className="flex items-center justify-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                                disabled={editSaving} onClick={(e) => saveEdit(e, a.aggregator_id)}>
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
                                onClick={(e) => startEdit(e, a)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                disabled={deletingId === a.aggregator_id} onClick={(e) => handleDelete(e, a.aggregator_id, displayName)}>
                                {deletingId === a.aggregator_id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                              </Button>
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
        {filteredAggregators.length > PER_PAGE && (
          <div className="flex items-center justify-between text-sm text-slate-500">
            <span>Showing {(page - 1) * PER_PAGE + 1}–{Math.min(page * PER_PAGE, filteredAggregators.length)} of {filteredAggregators.length}</span>
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

      {/* Add Aggregator Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddModal(false)} />
          <div className="relative w-full max-w-lg rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900 overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-700 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">Add Aggregator</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-md p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAddAggregator}>
              <div className="px-6 py-5 space-y-4 max-h-[72vh] overflow-y-auto">
                {addError && (
                  <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400">{addError}</div>
                )}
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block text-xs text-slate-500">Company Name <span className="text-red-500">*</span></Label>
                    <Input value={addForm.aggregator_company_name} onChange={(e) => setAddForm({ ...addForm, aggregator_company_name: e.target.value })}
                      placeholder="e.g. Utility Exchange" className="dark:border-slate-700 dark:bg-slate-950" autoFocus />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Main Contact Person <span className="text-red-500">*</span></Label>
                    <Input value={addForm.aggregator_contact_name} onChange={(e) => setAddForm({ ...addForm, aggregator_contact_name: e.target.value })}
                      placeholder="e.g. Jane Doe" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Phone Number <span className="text-red-500">*</span></Label>
                    <Input value={addForm.aggregator_phone} onChange={(e) => setAddForm({ ...addForm, aggregator_phone: e.target.value })}
                      placeholder="+44 20 1234 5678" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Primary Email <span className="text-red-500">*</span></Label>
                    <Input type="email" value={addForm.aggregator_email} onChange={(e) => setAddForm({ ...addForm, aggregator_email: e.target.value })}
                      placeholder="contact@aggregator.com" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div>
                    <Label className="mb-1.5 block text-xs text-slate-500">Secondary Email</Label>
                    <Input type="email" value={addForm.aggregator_email_secondary} onChange={(e) => setAddForm({ ...addForm, aggregator_email_secondary: e.target.value })}
                      placeholder="accounts@aggregator.com" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block text-xs text-slate-500">Website</Label>
                    <Input value={addForm.aggregator_website} onChange={(e) => setAddForm({ ...addForm, aggregator_website: e.target.value })}
                      placeholder="https://www.aggregator.com" className="dark:border-slate-700 dark:bg-slate-950" />
                  </div>
                  <div className="sm:col-span-2">
                    <Label className="mb-1.5 block text-xs text-slate-500">Address</Label>
                    <Textarea value={addForm.aggregator_address} onChange={(e) => setAddForm({ ...addForm, aggregator_address: e.target.value })}
                      placeholder="123 Energy Street, London, EC1A 1BB" className="dark:border-slate-700 dark:bg-slate-950 resize-none" rows={2} />
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-slate-200 dark:border-slate-700 px-6 py-4">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)}>Cancel</Button>
                <Button type="submit" disabled={addSaving}>
                  {addSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
                  Add Aggregator
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
