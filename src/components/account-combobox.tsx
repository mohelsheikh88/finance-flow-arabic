import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalized } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Account = {
  id: string;
  code: string;
  name_ar?: string | null;
  name_en?: string | null;
  is_group?: boolean;
};

type Props = {
  accounts: Account[];
  value: string | null | undefined;
  onChange: (id: string | null) => void;
  placeholder?: string;
  /** Extra label for the "no selection" option, e.g. "—" */
  allowClear?: boolean;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
};

/**
 * Searchable Chart-of-Accounts picker — used anywhere a GL account is
 * selected (categories, products, invoice/bill/journal lines...). Type to
 * filter by code or name (AR/EN) instead of scrolling a long flat list.
 */
export function AccountCombobox({
  accounts,
  value,
  onChange,
  placeholder,
  allowClear = true,
  className,
  triggerClassName,
  disabled,
}: Props) {
  const localized = useLocalized();
  const [open, setOpen] = useState(false);
  const selectable = accounts.filter((a) => !a.is_group);
  const selected = selectable.find((a) => a.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", !selected && "text-muted-foreground", triggerClassName)}
        >
          <span className="truncate">
            {selected ? `${selected.code} — ${localized(selected, "name")}` : placeholder ?? "—"}
          </span>
          <ChevronsUpDown className="ms-2 h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className={cn("w-[--radix-popover-trigger-width] p-0", className)}>
        <Command filter={(itemValue, search) => (itemValue.includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder={placeholder ?? "—"} className="h-9" />
          <CommandList>
            <CommandEmpty>—</CommandEmpty>
            <CommandGroup>
              {allowClear && (
                <CommandItem
                  value="__none__ —"
                  onSelect={() => { onChange(null); setOpen(false); }}
                >
                  <Check className={cn("me-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  —
                </CommandItem>
              )}
              {selectable.map((a) => {
                const label = `${a.code} — ${localized(a, "name")}`;
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.code} ${a.name_ar ?? ""} ${a.name_en ?? ""}`.toLowerCase()}
                    onSelect={() => { onChange(a.id); setOpen(false); }}
                  >
                    <Check className={cn("me-2 h-4 w-4", value === a.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
