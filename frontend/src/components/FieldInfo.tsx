import { useEffect, useRef, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';

/**
 * Inline "info" icon that reveals a field description in a small popover on
 * click (replaces always-visible form-text hints). Accessible: the trigger is
 * a real button with `aria-expanded`/`aria-controls`, and the popover closes
 * on outside click or Escape (same hand-rolled pattern as UserMenu — no
 * Bootstrap JS).
 */
export function FieldInfo({
  id,
  label,
  children,
}: {
  /** DOM id for the popover panel (used by `aria-controls`). */
  id: string;
  /** Accessible name for the trigger, e.g. "About the admin username". */
  label: string;
  /** The description content shown inside the popover. */
  children: ReactNode;
}): ReactElement {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement | null>(null);

  // Close on outside click / Escape while open.
  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointerDown = (event: PointerEvent): void => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="field-info">
      <button
        type="button"
        className="field-info__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
      >
        {/* Bootstrap Icons "info-circle" (inline SVG — no new deps). */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          fill="currentColor"
          viewBox="0 0 16 16"
          aria-hidden="true"
        >
          <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16" />
          <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0" />
        </svg>
      </button>
      {open && (
        <span id={id} role="note" className="field-info__panel">
          {children}
        </span>
      )}
    </span>
  );
}
