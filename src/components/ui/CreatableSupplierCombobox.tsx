"use client";

import React, { useState, useEffect } from "react";
import { Check, ChevronsUpDown, Plus, Loader2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { fetchWithAuth } from "@/lib/api";

export interface Supplier {
  supplier_id: number;
  supplier_name: string;
}

interface CreatableSupplierComboboxProps {
  suppliers: Supplier[];
  value: string; // supplier_id as string, "" for no selection
  onChange: (value: string) => void;
  onAddSupplier?: (supplier: Supplier) => void;
  onDeleteSupplier?: (supplier_id: number) => void;
  placeholder?: string;
  fallbackLabel?: string; // shown when value is set but not found in suppliers list
  triggerClassName?: string;
  disabled?: boolean;
  allowNone?: boolean;
  hasError?: boolean;
}

export function CreatableSupplierCombobox({
  suppliers,
  value,
  onChange,
  onAddSupplier,
  onDeleteSupplier,
  placeholder = "Select supplier",
  fallbackLabel,
  triggerClassName,
  disabled = false,
  allowNone = false,
  hasError = false,
}: CreatableSupplierComboboxProps) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [localSuppliers, setLocalSuppliers] = useState<Supplier[]>(suppliers);

  useEffect(() => {
    setLocalSuppliers(prev => {
      // Merge: keep locally-created ones not yet in the incoming list
      const incomingIds = new Set(suppliers.map(s => s.supplier_id));
      const localOnly = prev.filter(s => !incomingIds.has(s.supplier_id));
      return [...suppliers, ...localOnly];
    });
  }, [suppliers]);

  const selectedSupplier = localSuppliers.find(
    s => s.supplier_id.toString() === value
  );

  const filtered = localSuppliers.filter(s =>
    s.supplier_name.toLowerCase().includes(inputValue.toLowerCase())
  );

  const exactMatch = localSuppliers.some(
    s => s.supplier_name.toLowerCase() === inputValue.trim().toLowerCase()
  );

  const showCreateOption = inputValue.trim().length > 0 && !exactMatch;

  const handleDelete = async (e: React.MouseEvent, supplierId: number) => {
    e.stopPropagation();
    e.preventDefault();
    if (deletingId) return;
    setDeletingId(supplierId);
    try {
      await fetchWithAuth(`/suppliers/${supplierId}`, { method: "DELETE" });
      setLocalSuppliers(prev => prev.filter(s => s.supplier_id !== supplierId));
      onDeleteSupplier?.(supplierId);
      // If the deleted supplier was selected, clear the selection
      if (value === supplierId.toString()) {
        onChange("0");
      }
    } catch (err) {
      console.error("Failed to delete supplier:", err);
    } finally {
      setDeletingId(null);
    }
  };

  const handleCreate = async () => {
    const name = inputValue.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const data = await fetchWithAuth("/suppliers", {
        method: "POST",
        body: JSON.stringify({ supplier_name: name }),
      });
      const newSupplier: Supplier = {
        supplier_id: data.supplier_id,
        supplier_name: data.supplier_name,
      };
      setLocalSuppliers(prev => {
        const alreadyExists = prev.some(s => s.supplier_id === newSupplier.supplier_id);
        return alreadyExists ? prev : [...prev, newSupplier];
      });
      onAddSupplier?.(newSupplier);
      onChange(data.supplier_id.toString());
      setInputValue("");
      setOpen(false);
    } catch (err) {
      console.error("Failed to create supplier:", err);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn(
            "w-full justify-between font-normal",
            !value && !fallbackLabel && "text-muted-foreground",
            hasError && "border-red-500",
            triggerClassName
          )}
        >
          <span className="truncate">
            {selectedSupplier
              ? selectedSupplier.supplier_name
              : (value && value !== "0" && fallbackLabel)
                ? fallbackLabel
                : placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 min-w-[var(--radix-popper-anchor-width)]"
        align="start"
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search or type new supplier..."
            value={inputValue}
            onValueChange={setInputValue}
          />
          <CommandList>
            {allowNone && (
              <CommandItem
                value="none"
                onSelect={() => {
                  onChange("0");
                  setInputValue("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "0" ? "opacity-100" : "opacity-0"
                  )}
                />
                — None —
              </CommandItem>
            )}
            {filtered.length === 0 && !showCreateOption && (
              <CommandEmpty>No suppliers found.</CommandEmpty>
            )}
            {filtered.map(s => (
              <CommandItem
                key={s.supplier_id}
                value={s.supplier_id.toString()}
                onSelect={() => {
                  onChange(s.supplier_id.toString());
                  setInputValue("");
                  setOpen(false);
                }}
                className="group flex items-center justify-between pr-1"
              >
                <span className="flex items-center min-w-0">
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4 shrink-0",
                      value === s.supplier_id.toString() ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{s.supplier_name}</span>
                </span>
                <button
                  type="button"
                  onClick={(e) => handleDelete(e, s.supplier_id)}
                  className="ml-2 shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all"
                  title="Remove supplier"
                >
                  {deletingId === s.supplier_id ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </button>
              </CommandItem>
            ))}
            {showCreateOption && (
              <CommandItem
                value="__create__"
                onSelect={handleCreate}
                disabled={creating}
              >
                {creating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="mr-2 h-4 w-4" />
                )}
                Create &quot;{inputValue.trim()}&quot;
              </CommandItem>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
