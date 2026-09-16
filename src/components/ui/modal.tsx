import { useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  /** max-w-md (default) | max-w-sm | max-w-lg | max-w-xl | max-w-2xl */
  size?: "sm" | "md" | "lg" | "xl" | "2xl";
};

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  "2xl": "max-w-2xl",
} as const;

export function Modal({ open, onClose, children, className, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className={cn(
          "flex max-h-[85dvh] w-full flex-col overflow-hidden rounded-lg bg-surface shadow-[var(--shadow-window)]",
          sizeClasses[size],
          className,
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

export function ModalHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("shrink-0 px-6 pt-5 pb-2", className)}>{children}</div>;
}

export function ModalContent({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("flex-1 overflow-y-auto px-6 py-3", className)}>{children}</div>;
}

export function ModalFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("shrink-0 flex items-center justify-end gap-2 border-t border-border px-6 py-4", className)}>{children}</div>;
}

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "نعم، احذف",
  cancelLabel = "إلغاء",
  variant = "danger",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onCancel} size="sm">
      <ModalHeader>
        <h3 className="text-lg font-semibold">{title}</h3>
      </ModalHeader>
      {description ? (
        <ModalContent>
          <p className="text-sm text-fg-muted">{description}</p>
        </ModalContent>
      ) : null}
      <ModalFooter>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex h-11 items-center justify-center rounded-md bg-transparent px-5 text-sm font-medium text-fg-muted transition-colors hover:bg-bg-subtle"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className={cn(
            "inline-flex h-11 items-center justify-center rounded-md px-5 text-sm font-medium text-primary-fg transition-opacity hover:opacity-90",
            variant === "danger" ? "bg-danger" : "bg-primary",
          )}
        >
          {confirmLabel}
        </button>
      </ModalFooter>
    </Modal>
  );
}
