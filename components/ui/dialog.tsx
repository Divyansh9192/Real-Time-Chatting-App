import * as React from "react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({ open, onClose, title, children, className }: DialogProps) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        className="absolute inset-0 bg-slate-900/50"
        onClick={onClose}
        aria-label="Close dialog"
      />
      <div
        className={cn(
          "relative z-10 w-full max-w-md rounded-xl border border-slate-200 bg-white p-5 shadow-xl",
          className
        )}
        role="dialog"
        aria-modal="true"
      >
        <h2 className="mb-4 text-lg font-semibold text-slate-900">{title}</h2>
        {children}
      </div>
    </div>
  );
}
