"use client";

import { useEffect, useId } from "react";

type AppDialogProps = {
  open: boolean;
  title: string;
  eyebrow?: string;
  description?: string;
  size?: "sm" | "md" | "lg";
  tone?: "default" | "danger" | "success";
  onClose?: () => void;
  footer?: React.ReactNode;
  children?: React.ReactNode;
};

export function AppDialog({
  open,
  title,
  eyebrow,
  description,
  size = "md",
  tone = "default",
  onClose,
  footer,
  children,
}: AppDialogProps) {
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && onClose) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="app-dialog-layer"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && onClose) onClose();
      }}
    >
      <section
        className={"app-dialog app-dialog-" + size + " app-dialog-" + tone}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
      >
        <div className="app-dialog-handle" aria-hidden="true" />

        <header className="app-dialog-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h2 id={titleId}>{title}</h2>
            {description && <p id={descriptionId}>{description}</p>}
          </div>

          {onClose && (
            <button
              type="button"
              className="app-dialog-close"
              onClick={onClose}
              aria-label="Close dialog"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6.75 6.75 17.25 17.25M17.25 6.75 6.75 17.25" />
              </svg>
            </button>
          )}
        </header>

        {children && <div className="app-dialog-body">{children}</div>}

        {footer && <footer className="app-dialog-footer">{footer}</footer>}
      </section>
    </div>
  );
}
