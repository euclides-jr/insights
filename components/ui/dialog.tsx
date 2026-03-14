'use client';

import * as React from 'react';

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function Dialog({ open, onOpenChange, children }: DialogProps) {
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onOpenChange(false);
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [open, onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/25"
        onClick={() => onOpenChange(false)}
      />

      {/* Modal */}
      <div className="relative z-50">{children}</div>
    </div>
  );
}

interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({
  children,
  className = '',
}: DialogContentProps) {
  return (
    <div
      className={`
        bg-white border border-[#E8E8E8] shadow-[0_10px_20px_rgba(0,0,0,0.1)]
        w-[560px] p-8 flex flex-col gap-6
        ${className}
      `}
      onClick={(e) => e.stopPropagation()}
    >
      {children}
    </div>
  );
}

interface DialogHeaderProps {
  children: React.ReactNode;
}

export function DialogHeader({ children }: DialogHeaderProps) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

interface DialogTitleProps {
  children: React.ReactNode;
}

export function DialogTitle({ children }: DialogTitleProps) {
  return (
    <h2 className="text-2xl font-semibold font-[family-name:var(--font-space-grotesk)]">
      {children}
    </h2>
  );
}

interface DialogDescriptionProps {
  children: React.ReactNode;
}

export function DialogDescription({ children }: DialogDescriptionProps) {
  return <p className="text-sm text-[#7A7A7A]">{children}</p>;
}

interface DialogFooterProps {
  children: React.ReactNode;
}

export function DialogFooter({ children }: DialogFooterProps) {
  return <div className="flex justify-end gap-3">{children}</div>;
}
