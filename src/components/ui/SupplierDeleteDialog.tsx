"use client";

import React, { useState, useEffect } from "react";
import { Loader2, AlertTriangle, Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { fetchWithAuth } from "@/lib/api";

interface Supplier {
  supplier_id: number;
  supplier_name: string;
}

interface Contract {
  id: number;
  type: "lead" | "renewal";
  business_name: string;
  trading_name?: string | null;
  mpan?: string | null;
}

interface Props {
  supplierId: number | null;
  supplierName: string;
  allSuppliers: Supplier[];
  onClose: () => void;
  onDeleted: (supplierId: number) => void;
  /** Which page is triggering the delete — scopes the usage check and deletion */
  page?: "leads" | "renewals";
}

type Step = "checking" | "has_contracts" | "reassigning" | "confirm_delete";

export function SupplierDeleteDialog({
  supplierId,
  supplierName,
  allSuppliers,
  onClose,
  onDeleted,
  page,
}: Props) {
  const [step, setStep] = useState<Step>("checking");
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [newSupplierId, setNewSupplierId] = useState<string>("");
  const [supplierSearch, setSupplierSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (supplierId === null) return;
    setStep("checking");
    setContracts([]);
    setNewSupplierId("");
    setError(null);

    const pageParam = page ? `?page=${page}` : "";
    fetchWithAuth(`/suppliers/${supplierId}/usage${pageParam}`)
      .then((data) => {
        if (data.count === 0) {
          // No contracts on this page — attempt direct delete/hide
          return fetchWithAuth(`/suppliers/${supplierId}${pageParam}`, { method: "DELETE" })
            .then((res) => {
              if (res?.error === "Cannot delete a supplier not created by your account") {
                setError("You can only delete suppliers you added.");
                setStep("has_contracts");
              } else {
                onDeleted(supplierId);
                onClose();
              }
            });
        }
        setContracts(data.contracts);
        setStep("has_contracts");
      })
      .catch((err) => {
        const msg = err?.message || "";
        if (msg.includes("403") || msg.includes("not created by your account")) {
          setError("You can only delete suppliers you added.");
        } else {
          setError("Failed to check supplier usage. Please try again.");
        }
        setStep("has_contracts");
      });
  }, [supplierId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleReassignConfirm = async () => {
    if (!newSupplierId || supplierId === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchWithAuth(`/suppliers/${supplierId}/reassign`, {
        method: "POST",
        body: JSON.stringify({ new_supplier_id: parseInt(newSupplierId), page: page || null }),
      });
      onDeleted(supplierId);
      onClose();
    } catch (err: any) {
      const msg = err?.message || "";
      setError(msg.includes("403") || msg.includes("not created by your account")
        ? "You can only delete suppliers you added."
        : "Failed to reassign. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (supplierId === null) return;
    setSubmitting(true);
    setError(null);
    try {
      await fetchWithAuth(`/suppliers/${supplierId}/reassign`, {
        method: "POST",
        body: JSON.stringify({ new_supplier_id: null, page: page || null }),
      });
      onDeleted(supplierId);
      onClose();
    } catch (err: any) {
      const msg = err?.message || "";
      setError(msg.includes("403") || msg.includes("not created by your account")
        ? "You can only delete suppliers you added."
        : "Failed to delete. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const otherSuppliers = allSuppliers.filter((s) => s.supplier_id !== supplierId);
  const contractWord = contracts.length === 1 ? "contract" : "contracts";

  return (
    <Dialog open={supplierId !== null} onOpenChange={(open) => { if (!open && !submitting) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Delete Supplier</DialogTitle>
        </DialogHeader>

        {/* Step: Checking */}
        {step === "checking" && (
          <div className="flex items-center gap-3 py-4 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin shrink-0" />
            Checking for contracts using <strong className="text-foreground">{supplierName}</strong>…
          </div>
        )}

        {/* Step: Contracts found — ask to reassign */}
        {step === "has_contracts" && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
              <div className="text-sm">
                <p className="font-medium text-amber-800 dark:text-amber-300">
                  {contracts.length} {contractWord}{" "}
                  {contracts.length === 1 ? "is" : "are"} using{" "}
                  <strong>{supplierName}</strong>.
                </p>
                <p className="mt-1 text-amber-700 dark:text-amber-400">
                  Would you like to reassign {contracts.length === 1 ? "it" : "them"} to a
                  different supplier before deleting?
                </p>
              </div>
            </div>

            {contracts.length <= 6 && (
              <ul className="space-y-2 pl-1">
                {contracts.map((c) => (
                  <li key={`${c.type}-${c.id}`} className="flex gap-2">
                    <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs capitalize">
                      {c.type}
                    </span>
                    <div className="min-w-0 text-sm">
                      <p className="font-medium text-foreground truncate">{c.business_name}</p>
                      {c.trading_name && (
                        <p className="text-xs text-muted-foreground truncate">Trading: {c.trading_name}</p>
                      )}
                      {c.mpan && (
                        <p className="text-xs text-muted-foreground">MPAN: {c.mpan}</p>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose} disabled={submitting}>
                Cancel
              </Button>
              <Button
                variant="outline"
                onClick={() => setStep("confirm_delete")}
                disabled={submitting}
              >
                No, Just Delete
              </Button>
              <Button onClick={() => { setStep("reassigning"); setSupplierSearch(""); setNewSupplierId(""); }} disabled={submitting}>
                Yes, Reassign
              </Button>
            </div>
          </div>
        )}

        {/* Step: Pick replacement supplier */}
        {step === "reassigning" && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select a supplier to reassign{" "}
              <strong className="text-foreground">
                {contracts.length} {contractWord}
              </strong>{" "}
              to:
            </p>

            <div className="border rounded-md overflow-hidden dark:border-slate-700">
              <div className="px-3 py-2 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
                <Input
                  autoFocus
                  placeholder="Search suppliers…"
                  value={supplierSearch}
                  onChange={e => setSupplierSearch(e.target.value)}
                  className="h-7 text-sm border-0 bg-transparent shadow-none focus-visible:ring-0 p-0"
                />
              </div>
              <ul className="max-h-52 overflow-y-auto py-1">
                {otherSuppliers
                  .filter(s => s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase()))
                  .map(s => (
                    <li
                      key={s.supplier_id}
                      onClick={() => setNewSupplierId(s.supplier_id.toString())}
                      className={`px-3 py-2 text-sm cursor-pointer flex items-center justify-between gap-2 ${
                        newSupplierId === s.supplier_id.toString()
                          ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800"
                      }`}
                    >
                      {s.supplier_name}
                      {newSupplierId === s.supplier_id.toString() && <Check className="h-3.5 w-3.5 shrink-0" />}
                    </li>
                  ))}
                {otherSuppliers.filter(s => s.supplier_name.toLowerCase().includes(supplierSearch.toLowerCase())).length === 0 && (
                  <li className="px-3 py-2 text-sm text-muted-foreground">No suppliers found.</li>
                )}
              </ul>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("has_contracts")}
                disabled={submitting}
              >
                Back
              </Button>
              <Button
                disabled={!newSupplierId || submitting}
                onClick={handleReassignConfirm}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reassign & Delete
              </Button>
            </div>
          </div>
        )}

        {/* Step: Confirm deletion without reassign */}
        {step === "confirm_delete" && (
          <div className="space-y-4">
            <div className="flex gap-3 rounded-lg border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600 dark:text-red-400" />
              <p className="text-sm text-red-800 dark:text-red-300">
                <strong>{contracts.length} {contractWord}</strong> will have their
                supplier removed and will show no supplier assigned. Do you wish to proceed?
                {page && (
                  <span className="block mt-1 text-xs text-red-600">
                    This supplier will remain visible in {page === "leads" ? "renewals" : "leads"}.
                  </span>
                )}
              </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setStep("has_contracts")}
                disabled={submitting}
              >
                No, Go Back
              </Button>
              <Button
                variant="destructive"
                disabled={submitting}
                onClick={handleDeleteConfirm}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Yes, Proceed
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
