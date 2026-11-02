// @ts-nocheck — filter pills with fluid animated indicator (motion layoutId).
// Built for KIN/D v2.0: ChatGPT picked Pill Nav for "subject filters ... fluid animated
// indicator", but PillNav is a full navbar; this gives the same indicator interaction
// sized for filter rows.
import { motion } from 'motion/react';

export interface FilterPillItem {
  id: string;
  label: string;
  color?: string;
}

interface Props {
  items: FilterPillItem[];
  activeId: string;
  onSelect: (id: string) => void;
  idPrefix: string;
}

export default function FilterPills({ items, activeId, onSelect, idPrefix }: Props) {
  return (
    <div className="flex flex-wrap gap-2" role="tablist">
      {items.map(item => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item.id)}
            className="relative px-4 py-2 rounded-full text-[12px] font-medium outline-none transition-colors"
            style={{ color: active ? 'var(--void)' : 'var(--muted)' }}
          >
            {active && (
              <motion.span
                layoutId={`${idPrefix}-pill`}
                className="absolute inset-0 rounded-full"
                style={{ background: item.color || 'var(--ke-text)' }}
                transition={{ type: 'spring', bounce: 0.18, duration: 0.5 }}
              />
            )}
            <span className="relative z-10">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}
