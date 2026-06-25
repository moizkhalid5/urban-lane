"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type AccordionItem = { title: string; content: React.ReactNode };

export function Accordion({ items, defaultOpen = 0 }: { items: AccordionItem[]; defaultOpen?: number }) {
  const [open, setOpen] = useState<number | null>(defaultOpen);
  return (
    <div className="divide-y divide-line border-y border-line">
      {items.map((item, i) => (
        <div key={i}>
          <button
            onClick={() => setOpen((o) => (o === i ? null : i))}
            className="flex w-full items-center justify-between py-4 text-left text-sm font-medium uppercase tracking-wide"
            aria-expanded={open === i}
          >
            {item.title}
            <span className={cn("transition-transform", open === i && "rotate-45")}>+</span>
          </button>
          {open === i && <div className="prose-sm pb-4 text-sm leading-relaxed text-ink-soft">{item.content}</div>}
        </div>
      ))}
    </div>
  );
}
