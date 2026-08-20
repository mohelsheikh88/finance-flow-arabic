import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLocalized } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

type Product = {
  id: string;
  code: string;
  name_ar?: string | null;
  name_en?: string | null;
  barcode?: string | null;
};

type Props = {
  products: Product[];
  value: string | null | undefined;
  onChange: (id: string | null, product: Product | null) => void;
  placeholder?: string;
  allowClear?: boolean;
  className?: string;
  triggerClassName?: string;
  disabled?: boolean;
};

/**
 * Searchable product picker — type to filter by code, name (AR/EN), or
 * barcode instead of scrolling a long flat list. Used anywhere a product
 * line is added (Purchase Orders, ...).
 */
export function ProductCombobox({
  products,
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
  const selected = products.find((p) => p.id === value);

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
                <CommandItem value="__none__ —" onSelect={() => { onChange(null, null); setOpen(false); }}>
                  <Check className={cn("me-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  —
                </CommandItem>
              )}
              {products.map((p) => {
                const label = `${p.code} — ${localized(p, "name")}`;
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.code} ${p.name_ar ?? ""} ${p.name_en ?? ""} ${p.barcode ?? ""}`.toLowerCase()}
                    onSelect={() => { onChange(p.id, p); setOpen(false); }}
                  >
                    <Check className={cn("me-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
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
