"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Trash2 } from "lucide-react";
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

interface Supplier {
  supplier_id: number;
  supplier_name: string;
}

interface Props {
  supplierId?: number | null;
  supplierName?: string | null;
  suppliers: Supplier[];
  onChange: (newSupplierId: number) => void;
  onDelete: (supplierId: number, supplierName: string) => void;
}

export function SupplierCellCombobox({
  supplierId,
  supplierName,
  suppliers,
  onChange,
  onDelete,
}: Props) {
  const [open, setOpen] = useState(false);

  const displayName =
    supplierName ||
    suppliers.find((s) => s.supplier_id === supplierId)?.supplier_name ||
    "—";

  const handleDelete = (e: React.MouseEvent, s: Supplier) => {
    e.stopPropagation();
    e.preventDefault();
    setOpen(false);
    onDelete(s.supplier_id, s.supplier_name);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="h-7 w-full justify-between font-normal px-2 py-0 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="truncate">{displayName}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50 flex-shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[220px]" align="start">
        <Command>
          <CommandInput placeholder="Search supplier..." className="h-8" />
          <CommandList>
            <CommandEmpty>No suppliers found.</CommandEmpty>
            <CommandGroup>
              {suppliers.map((s) => (
                <CommandItem
                  key={s.supplier_id}
                  value={s.supplier_name}
                  onSelect={() => {
                    onChange(s.supplier_id);
                    setOpen(false);
                  }}
                  className="flex items-center justify-between pr-1 group"
                >
                  <span className="flex items-center min-w-0">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        supplierId === s.supplier_id ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{s.supplier_name}</span>
                  </span>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, s)}
                    className="ml-2 shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all"
                    title="Delete supplier"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
