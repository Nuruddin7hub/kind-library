import { useEffect, useRef, type ReactNode, type TouchEvent as ReactTouchEvent } from 'react';
import './BottomSheet.css';

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: ReactNode;
  height?: string;        // CSS height, default '72vh'
  children: ReactNode;
  footer?: ReactNode;     // optional fixed footer (e.g. Apply/Reset)
}

/** Reusable mobile bottom sheet — ChatGPT Round B shared component (2026-11-03).
 *  Mounts on open (return null when !open), slides up, traps focus while open,
 *  locks body + .ap-root scroll, dismisses on backdrop tap, Escape, or a
 *  swipe-down on the header. Do not change the prop names — two sibling
 *  agents consume this API verbatim. */
export default function BottomSheet({ open, onClose, title, height = '72vh', children, footer }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const prevFocusRef = useRef<Element | null>(null);
  // simple swipe-down-to-dismiss state (refs only — no re-renders mid-drag)
  const dragStartY = useRef(0);
  const dragging = useRef(false);

  // On open: move focus into the sheet, remember the previously focused
  // element, and lock scroll (body + .ap-root). Restore both on close/unmount.
  useEffect(() => {
    if (!open) return;
    prevFocusRef.current = document.activeElement;
    sheetRef.current?.focus({ preventScroll: true });
    const prevBodyOverflow = document.body.style.overflow;
    const root = document.querySelector('.ap-root') as HTMLElement | null;
    const prevRootOverflow = root ? root.style.overflow : '';
    document.body.style.overflow = 'hidden';
    if (root) root.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevBodyOverflow;
      if (root) root.style.overflow = prevRootOverflow;
      const prev = prevFocusRef.current;
      if (prev instanceof HTMLElement) prev.focus({ preventScroll: true });
    };
  }, [open]);

  // Escape closes.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  // --- swipe-down on the header dismisses the sheet ---
  const onHeaderTouchStart = (e: ReactTouchEvent<HTMLDivElement>) => {
    dragging.current = true;
    dragStartY.current = e.touches[0].clientY;
  };
  const onHeaderTouchMove = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!dragging.current || !sheetRef.current) return;
    const dy = e.touches[0].clientY - dragStartY.current;
    if (dy > 0) sheetRef.current.style.transform = `translateY(${dy}px)`;
  };
  const onHeaderTouchEnd = (e: ReactTouchEvent<HTMLDivElement>) => {
    if (!dragging.current) return;
    dragging.current = false;
    const dy = e.changedTouches[0].clientY - dragStartY.current;
    if (sheetRef.current) sheetRef.current.style.transform = '';
    if (dy > 90) onClose();
  };

  return (
    <div className="bs-overlay" onClick={onClose}>
      <div
        ref={sheetRef}
        className="bs-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        style={{ height }}
        onClick={e => e.stopPropagation()}
      >
        <div
          className="bs-header"
          onTouchStart={onHeaderTouchStart}
          onTouchMove={onHeaderTouchMove}
          onTouchEnd={onHeaderTouchEnd}
        >
          <span className="bs-grip" aria-hidden="true" />
          <div className="bs-title-row">
            {title != null && <span className="bs-title">{title}</span>}
            <span className="bs-title-spacer" />
            <button type="button" className="bs-close" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>
        <div className="bs-body">{children}</div>
        {footer != null && <div className="bs-footer">{footer}</div>}
      </div>
    </div>
  );
}
