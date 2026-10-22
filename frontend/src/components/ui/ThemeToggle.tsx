import { Sun, Moon, Laptop } from 'lucide-react';
import { useTheme } from '@/lib/ThemeContext';
import { Button } from '@/components/ui/button';

export function ThemeToggle({
  variant = 'icon',
  className = '',
}: {
  variant?: 'icon' | 'dropdown' | 'compact';
  className?: string;
}) {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  if (variant === 'compact') {
    return (
      <div className={`inline-flex items-center rounded-lg border border-border bg-surface-base p-0.5 ${className}`}>
        <button
          type="button"
          onClick={() => setTheme('light')}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            theme === 'light'
              ? 'bg-surface-panel text-content-primary shadow-sm'
              : 'text-content-secondary hover:text-content-primary'
          }`}
          aria-label="Light theme"
        >
          <Sun className="size-3.5" />
          <span>Light</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('dark')}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            theme === 'dark'
              ? 'bg-surface-panel text-content-primary shadow-sm'
              : 'text-content-secondary hover:text-content-primary'
          }`}
          aria-label="Dark theme"
        >
          <Moon className="size-3.5" />
          <span>Dark</span>
        </button>
        <button
          type="button"
          onClick={() => setTheme('system')}
          className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            theme === 'system'
              ? 'bg-surface-panel text-content-primary shadow-sm'
              : 'text-content-secondary hover:text-content-primary'
          }`}
          aria-label="System theme"
        >
          <Laptop className="size-3.5" />
          <span>Auto</span>
        </button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={`size-9 text-content-secondary hover:text-content-primary transition-colors ${className}`}
      onClick={toggleTheme}
      title={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode (current: ${theme})`}
      aria-label={`Switch to ${resolvedTheme === 'dark' ? 'light' : 'dark'} mode`}
    >
      {resolvedTheme === 'dark' ? (
        <Sun className="size-4 transition-transform hover:rotate-45" aria-hidden="true" />
      ) : (
        <Moon className="size-4 transition-transform hover:-rotate-12" aria-hidden="true" />
      )}
    </Button>
  );
}
