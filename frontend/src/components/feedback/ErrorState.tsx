import { AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center gap-2 border-b border-danger/20 bg-danger/10 px-4 py-3 text-[13px] leading-5 text-danger"
    >
      <AlertCircle aria-hidden="true" className="size-4 shrink-0" />
      <span className="min-w-0 flex-1">{message}</span>
      {onRetry && (
        <Button type="button" variant="ghost" size="sm" onClick={onRetry} className="text-danger">
          Retry
        </Button>
      )}
    </div>
  );
}
