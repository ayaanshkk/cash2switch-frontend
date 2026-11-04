"use client";

import React, { useState } from "react";
import { Check, ChevronsUpDown, Filter, Trash2 } from "lucide-react";
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

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
  deletable?: boolean;
}

interface SearchableFilterComboboxProps {
  options: FilterOption[];
  value: string;
  onChange: (value: string) => void;
  onDelete?: (value: string) => void;
  placeholder?: string;
  triggerClassName?: string;
  showFilterIcon?: boolean;
}

export function SearchableFilterCombobox({
  options,
  value,
  onChange,
  onDelete,
  placeholder = "All",
  triggerClassName,
  showFilterIcon = false,
}: SearchableFilterComboboxProps) {
  const [open, setOpen] = useState(false);
  const deletingRef = React.useRef(false);
  const selectedLabel = options.find(o => o.value === value)?.label ?? placeholder;

  const handleDelete = (e: React.MouseEvent, optionValue: string) => {
    e.stopPropagation();
    e.preventDefault();
    if (!onDelete) return;
    deletingRef.current = true;
    onDelete(optionValue);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && deletingRef.current) {
      // Swallow the close triggered by parent re-render after delete
      deletingRef.current = false;
      return;
    }
    setOpen(next);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal min-w-0", triggerClassName)}
        >
          {showFilterIcon && <Filter className="mr-2 h-4 w-4 shrink-0" />}
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 min-w-[var(--radix-popper-anchor-width)]" align="start">
        <Command>
          <CommandInput placeholder="Search..." />
          <CommandList>
            <CommandEmpty>No results.</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  className={cn("flex items-center justify-between pr-1", onDelete && o.deletable && "group")}
                >
                  <span className="flex items-center min-w-0 flex-1 overflow-hidden">
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4 shrink-0",
                        value === o.value ? "opacity-100" : "opacity-0"
                      )}
                    />
                    <span className="truncate">{o.label}</span>
                  </span>
                  <span className="flex items-center gap-1 ml-1 shrink-0">
                    {o.count != null && o.count > 0 && (
                      <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 rounded px-1 py-0.5 leading-none">
                        {o.count}
                      </span>
                    )}
                  </span>
                  {onDelete && o.deletable && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, o.value)}
                      className="ml-2 shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-all"
                      title="Delete supplier"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
