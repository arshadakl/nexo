import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { Sparkles, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';

export function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState('timefade@gmail.com');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const hasMinLength = password.length >= 8;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const isValid = hasMinLength && hasUpper && hasLower;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isValid) {
      setError('Password must be at least 8 characters with at least one uppercase and one lowercase letter.');
      return;
    }

    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-screen flex flex-col items-center justify-center bg-background px-4 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-primary/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-primary to-indigo-400 flex items-center justify-center text-primary-foreground font-bold shadow-lg shadow-primary/25 mx-auto">
            <Sparkles className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Sign in to Nexo Edge
          </h1>
          <p className="text-xs text-muted-foreground">
            Fast edge authentication &bull; Ultra-low CPU overhead
          </p>
        </div>

        {/* Card */}
        <Card className="border-border bg-card/60 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg">Staff Authentication</CardTitle>
            <CardDescription className="text-xs">
              Enter your work email and password to enter the CRM.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/15 border border-destructive/30 flex items-start gap-2.5 text-xs text-destructive">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Work Email</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                  <Input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="counselor@visahorizon.com"
                    className="pl-9 text-xs h-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground">Password</label>
                  <span className="text-[10px] text-muted-foreground">Min 8 chars (1 Upper, 1 Lower)</span>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
                  <Input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="pl-9 text-xs h-9"
                  />
                </div>

                {/* Password Criteria indicators */}
                <div className="pt-2 flex flex-wrap gap-2 text-[10px]">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${hasMinLength ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-secondary/40 text-muted-foreground border-border'}`}>
                    <CheckCircle2 className="w-3 h-3" /> 8+ chars
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${hasUpper ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-secondary/40 text-muted-foreground border-border'}`}>
                    <CheckCircle2 className="w-3 h-3" /> 1 uppercase
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${hasLower ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-secondary/40 text-muted-foreground border-border'}`}>
                    <CheckCircle2 className="w-3 h-3" /> 1 lowercase
                  </span>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSubmitting || !isValid}
                className="w-full text-xs h-9 font-medium gap-1.5 mt-2"
              >
                {isSubmitting ? 'Authenticating (< 2ms)...' : 'Sign In to Dashboard'}
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Links to Privacy Policy and Terms */}
        <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
          <a
            href="/privacy-policy"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Privacy Policy
          </a>
          <span>&bull;</span>
          <a
            href="/terms"
            target="_blank"
            rel="noreferrer"
            className="hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Terms of Service
          </a>
        </div>
      </div>
    </div>
  );
}
