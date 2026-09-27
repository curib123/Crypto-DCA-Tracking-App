"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { AppDialog } from "@/components/ui/app-dialog";

type DialogTone = "default" | "danger" | "success";

type AlertOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  tone?: DialogTone;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: DialogTone;
};

type DialogContextValue = {
  alert: (options: AlertOptions) => Promise<void>;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

type DialogRequest =
  | ({
      kind: "alert";
      resolve: () => void;
    } & AlertOptions)
  | ({
      kind: "confirm";
      resolve: (value: boolean) => void;
    } & ConfirmOptions);

const DialogContext = createContext<DialogContextValue | null>(null);

export function DialogProvider({ children }: { children: React.ReactNode }) {
  const [request, setRequest] = useState<DialogRequest | null>(null);

  const alert = useCallback((options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      setRequest({
        kind: "alert",
        ...options,
        resolve,
      });
    });
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setRequest({
        kind: "confirm",
        ...options,
        resolve,
      });
    });
  }, []);

  const value = useMemo(() => ({ alert, confirm }), [alert, confirm]);

  function closeAlert() {
    if (!request || request.kind !== "alert") return;
    request.resolve();
    setRequest(null);
  }

  function closeConfirm(value: boolean) {
    if (!request || request.kind !== "confirm") return;
    request.resolve(value);
    setRequest(null);
  }

  return (
    <DialogContext.Provider value={value}>
      {children}

      {request?.kind === "alert" && (
        <AppDialog
          open
          title={request.title}
          description={request.description}
          tone={request.tone || "default"}
          size="sm"
          onClose={closeAlert}
          footer={
            <button type="button" className="button button-dark button-wide" onClick={closeAlert}>
              {request.confirmLabel || "Okay"}
            </button>
          }
        />
      )}

      {request?.kind === "confirm" && (
        <AppDialog
          open
          title={request.title}
          description={request.description}
          tone={request.tone || "default"}
          size="sm"
          onClose={() => closeConfirm(false)}
          footer={
            <>
              <button type="button" className="button button-light" onClick={() => closeConfirm(false)}>
                {request.cancelLabel || "Cancel"}
              </button>
              <button
                type="button"
                className={request.tone === "danger" ? "button button-danger" : "button button-dark"}
                onClick={() => closeConfirm(true)}
              >
                {request.confirmLabel || "Confirm"}
              </button>
            </>
          }
        />
      )}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);

  if (!context) {
    throw new Error("useDialog must be used inside DialogProvider.");
  }

  return context;
}
