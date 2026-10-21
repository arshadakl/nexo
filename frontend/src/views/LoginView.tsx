import { useState, type FormEvent } from 'react';
import { AlertCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';

export function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitting) return;

    setError(null);
    setIsSubmitting(true);
    try {
      // The server validates credentials and first-login password requirements.
      await login(email.trim(), password);
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : 'Unable to sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 py-12 sm:px-8">
      <div className="w-full max-w-sm">
        <div className="mb-12 flex items-center gap-3">
          <img src="/resider.svg" alt="" className="size-8" />
          <span className="text-base font-semibold text-foreground">Resider</span>
        </div>

        <div className="mb-8 space-y-2">
          <h1 className="text-xl font-semibold leading-7 text-foreground">Sign in to your workspace</h1>
          <p className="text-sm leading-5 text-secondary-foreground">
            Continue to your conversations and customer work.
          </p>
        </div>

        <form onSubmit={handleSubmit} aria-busy={isSubmitting} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="work-email" className="block text-[13px] font-medium text-foreground">
              Work email
            </label>
            <Input
              id="work-email"
              name="email"
              type="email"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@company.com"
              readOnly={isSubmitting}
              aria-describedby={error ? 'sign-in-error' : undefined}
              className="h-11"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="block text-[13px] font-medium text-foreground">
              Password
            </label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              readOnly={isSubmitting}
              aria-describedby={error ? 'sign-in-error' : undefined}
              className="h-11"
            />
          </div>

          {error && (
            <div id="sign-in-error" role="alert" className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger/10 p-3 text-[13px] leading-5 text-danger">
              <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <Button type="submit" disabled={isSubmitting} className="h-11 w-full">
            {isSubmitting ? 'Signing in…' : 'Continue'}
            {!isSubmitting && <ArrowRight aria-hidden="true" className="size-4" />}
          </Button>
        </form>

        <footer className="mt-8 border-t border-border pt-6">
          <nav aria-label="Legal" className="flex flex-wrap gap-x-6 gap-y-3 text-xs text-muted-foreground">
            <a href="/privacy-policy" target="_blank" rel="noreferrer" className="py-2 underline-offset-4 hover:text-foreground hover:underline">
              Privacy policy
            </a>
            <a href="/terms" target="_blank" rel="noreferrer" className="py-2 underline-offset-4 hover:text-foreground hover:underline">
              Terms of service
            </a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
