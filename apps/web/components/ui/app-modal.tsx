"use client";

import { useEffect, type ReactNode } from "react";

type AppModalProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  size?: "sm" | "md" | "lg";
  dismissible?: boolean;
};

export function AppModal({
  open,
  title,
  eyebrow,
  description,
  children,
  footer,
  onClose,
  size = "md",
  dismissible = true,
}: AppModalProps) {
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && dismissible) onClose();
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismissible, onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-layer" role="presentation">
      <button
        type="button"
        className="modal-backdrop"
        aria-label="Close modal"
        onClick={dismissible ? onClose : undefined}
      />
      <section
        className={`app-modal app-modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-modal-title"
      >
        <header className="modal-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id="app-modal-title">{title}</h2>
            {description && <p>{description}</p>}
          </div>
          {dismissible && (
            <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
              <span aria-hidden="true">×</span>
            </button>
          )}
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </section>
    </div>
  );
}

export function ConfirmModal({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  destructive = false,
  busy = false,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  return (
    <AppModal
      open={open}
      title={title}
      eyebrow="Confirmation"
      description={description}
      onClose={onClose}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <button type="button" className="button button-light" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`button ${destructive ? "button-danger" : "button-dark"}`}
            onClick={() => void onConfirm()}
            disabled={busy}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </>
      }
    >
      <div className={`confirm-icon ${destructive ? "danger" : ""}`} aria-hidden="true">
        {destructive ? "!" : "✓"}
      </div>
    </AppModal>
  );
}

export function AlertModal({
  open,
  title,
  description,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  onClose: () => void;
}) {
  return (
    <AppModal
      open={open}
      title={title}
      eyebrow="NextFi"
      description={description}
      onClose={onClose}
      size="sm"
      footer={<button type="button" className="button button-dark" onClick={onClose}>Done</button>}
    >
      <div className="confirm-icon" aria-hidden="true">✓</div>
    </AppModal>
  );
}
