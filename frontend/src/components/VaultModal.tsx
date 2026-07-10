import { useEffect, useRef, type ReactElement, type ReactNode } from 'react';

/**
 * Accessible modal dialog used by the vault dialogs (create section, add/edit
 * chord). Hand-rolled (no Bootstrap JS, consistent with the rest of the app): it
 * renders a backdrop + a `role="dialog"` panel, traps focus within the panel,
 * restores focus to the previously focused element on close, and closes on Escape
 * or a backdrop click. Meets WCAG 2.1 AA keyboard expectations.
 */
export interface VaultModalProps {
  /** Accessible title; also used as the `aria-labelledby` target. */
  title: string;
  /** Called when the user requests to close (Esc, backdrop, or Cancel). */
  onClose: () => void;
  /** Dialog body content. */
  children: ReactNode;
  /** Footer actions (buttons). */
  footer: ReactNode;
  /** Optional actions rendered in the header, right-aligned next to the title
   * (e.g. an icon-only delete control). */
  headerActions?: ReactNode;
}

/** Selector for focusable elements used by the focus trap. */
const FOCUSABLE =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

export function VaultModal({
  title,
  onClose,
  children,
  footer,
  headerActions,
}: VaultModalProps): ReactElement {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useRef(`vault-modal-${Math.random().toString(36).slice(2)}`);

  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const panel = panelRef.current;
    // Focus the first focusable element inside the panel.
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE);
    first?.focus();

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab' || !panel) {
        return;
      }
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) {
        return;
      }
      const firstEl = focusable[0];
      const lastEl = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === firstEl) {
        event.preventDefault();
        lastEl.focus();
      } else if (!event.shiftKey && document.activeElement === lastEl) {
        event.preventDefault();
        firstEl.focus();
      }
    }

    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      previouslyFocused.current?.focus();
    };
  }, [onClose]);

  return (
    <div
      className="vault-modal__backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={panelRef}
        className="vault-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
      >
        <div className="vault-modal__header">
          <h2 id={titleId.current} className="h5 mb-0">
            {title}
          </h2>
          {headerActions && <div className="vault-modal__header-actions">{headerActions}</div>}
        </div>
        <div className="vault-modal__body">{children}</div>
        <div className="vault-modal__footer">{footer}</div>
      </div>
    </div>
  );
}
