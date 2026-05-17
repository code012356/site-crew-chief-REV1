import { useState } from 'react';
import { Check, ChevronsUpDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface SearchableOption {
  value: string;
  label: string;       // primary display (e.g. name)
  code?: string;       // labor_id / equipment_no
  hint?: string;       // specialty / model
}

interface Props {
  options: SearchableOption[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
}

export default function SearchableSelect({ options, value, onChange, placeholder = '选择 Select', emptyText = '无匹配 No match', className }: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find(o => o.value === value);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn('h-9 w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate text-left">
            {selected ? (
              <>
                {selected.code && <span className="font-mono text-xs text-muted-foreground mr-1.5">{selected.code}</span>}
                {selected.label}
              </>
            ) : placeholder}
          </span>
          <ChevronsUpDown size={14} className="ml-2 opacity-50 shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[280px]" align="start">
        <Command
          filter={(itemValue, search) => {
            // itemValue is the SearchableOption.value (id) — not searchable; rely on keywords
            const opt = options.find(o => o.value === itemValue);
            if (!opt) return 0;
            const hay = `${opt.label} ${opt.code || ''} ${opt.hint || ''}`.toLowerCase();
            return hay.includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="搜索 编号/姓名 Search code/name..." className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map(o => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={() => { onChange(o.value); setOpen(false); }}
                  className="flex items-center gap-2"
                >
                  <Check size={14} className={cn('shrink-0', value === o.value ? 'opacity-100' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm truncate">
                      {o.code && <span className="font-mono text-xs text-muted-foreground mr-1.5">{o.code}</span>}
                      {o.label}
                    </div>
                    {o.hint && <div className="text-xs text-muted-foreground truncate">{o.hint}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}