import { useEffect, useId, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  className?: string;
  isBusy?: boolean;
  alert?: boolean;
}

/** Native modal dialog supplies focus containment, inert background and focus return. */
export function Dialog({
  title,
  children,
  onClose,
  className,
  isBusy = false,
  alert = false,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog?.showModal();
    return () => {
      if (dialog?.open) dialog.close();
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, []);

  return (
    <dialog
      ref={ref}
      role={alert ? 'alertdialog' : 'dialog'}
      aria-modal="true"
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        if (!isBusy) onClose();
      }}
      className={cn(
        'm-auto max-h-[90dvh] w-[calc(100%_-_2rem)] max-w-md overflow-y-auto rounded-lg border border-border bg-popover p-0 text-foreground backdrop:bg-black/70',
        className,
      )}
    >
      <div className="flex items-center justify-between gap-4 border-b border-border px-4 py-3">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Close ${title}`}
          onClick={onClose}
          disabled={isBusy}
          className="size-9"
        >
          <X aria-hidden="true" className="size-4" />
        </Button>
      </div>
      {children}
    </dialog>
  );
}
