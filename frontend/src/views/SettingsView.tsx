import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog } from '@/components/ui/Dialog';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, User, Building2, Sun, RotateCcw } from 'lucide-react';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import { apiFetch } from '@/lib/apiClient';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/queries/queryKeys';

export function SettingsView() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isResetOpen, setIsResetOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const handleResetTestingData = async () => {
    setIsResetting(true);
    setResetError(null);
    try {
      await apiFetch('/api/conversations/reset-testing', {
        method: 'POST',
      });
      queryClient.invalidateQueries({ queryKey: queryKeys.conversations.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.drafts.all });
      setIsResetOpen(false);
    } catch (err: unknown) {
      setResetError(err instanceof Error ? err.message : 'Failed to reset testing data. Please try again.');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-content-primary">
          Settings & workspace
        </h2>
        <p className="text-xs text-content-secondary mt-0.5">
          Account identity and workspace configuration.
        </p>
      </div>

      <Card className="bg-surface-panel border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-content-primary flex items-center gap-2">
            <User className="w-4 h-4 text-accent" aria-hidden="true" />
            Current session & role
          </CardTitle>
          <CardDescription className="text-xs text-content-secondary mt-0.5">
            Your authenticated identity in this Resider tenant workspace.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-3 rounded-md border border-border bg-surface-base">
              <span className="text-[11px] text-content-secondary block">Account name</span>
              <span className="text-xs font-semibold text-content-primary mt-1 block">
                {user?.name || 'Active Operator'}
              </span>
            </div>

            <div className="p-3 rounded-md border border-border bg-surface-base">
              <span className="text-[11px] text-content-secondary block">Email address</span>
              <span className="text-xs font-semibold text-content-primary font-mono mt-1 block">
                {user?.email || 'operator@workspace.local'}
              </span>
            </div>

            <div className="p-3 rounded-md border border-border bg-surface-base">
              <span className="text-[11px] text-content-secondary block">Workspace role</span>
              <span className="text-xs font-semibold text-accent capitalize mt-1 block">
                {user?.role || 'operator'}
              </span>
            </div>

            <div className="p-3 rounded-md border border-border bg-surface-base">
              <span className="text-[11px] text-content-secondary block">Tenant identifier</span>
              <span className="text-xs font-semibold text-content-primary font-mono mt-1 block">
                {user?.tenantId || 'default'}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-panel border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-content-primary flex items-center gap-2">
            <Sun className="w-4 h-4 text-accent" aria-hidden="true" />
            Appearance & theme
          </CardTitle>
          <CardDescription className="text-xs text-content-secondary mt-0.5">
            Choose your preferred workspace visual theme or sync with your system preference.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 rounded-md border border-border bg-surface-base">
            <div>
              <p className="font-medium text-content-primary">Theme preference</p>
              <p className="text-[11px] text-content-secondary">
                Switch between Light, Dark, or System automated color schemes.
              </p>
            </div>
            <ThemeToggle variant="compact" />
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-panel border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-content-primary flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-success" aria-hidden="true" />
            Tenant Data Retention Policy
          </CardTitle>
          <CardDescription className="text-xs text-content-secondary mt-0.5">
            Applicant communication data retention is managed at the Cloudflare D1 environment level.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-content-secondary space-y-3">
          <p>
            Customer message logs, internal consultation notes, and AI inference telemetry are isolated by tenant ID and retained for 180 days by default.
          </p>
          <div className="p-3 rounded-md border border-border bg-surface-base flex items-center justify-between">
            <div>
              <p className="font-medium text-content-primary">Automated conversation purge</p>
              <p className="text-[11px] text-content-secondary">Configured via tenant provisioning</p>
            </div>
            <span className="font-mono text-xs text-content-primary font-medium">180 days</span>
          </div>
        </CardContent>
      </Card>

      <Card className="bg-surface-panel border-border">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-content-primary flex items-center gap-2">
            <Building2 className="w-4 h-4 text-accent" aria-hidden="true" />
            Team members & administration
          </CardTitle>
          <CardDescription className="text-xs text-content-secondary mt-0.5">
            Role-based access control and invitation policy.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs text-content-secondary">
          <p>
            Team member provisioning is controlled by your enterprise administrator. To add new consulting operators or update permissions, contact your workspace administrator.
          </p>
        </CardContent>
      </Card>
      <Card className="bg-surface-panel border-destructive/40">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-destructive flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-destructive" aria-hidden="true" />
            Testing Environment Reset
          </CardTitle>
          <CardDescription className="text-xs text-content-secondary mt-0.5">
            Wipes all customer DMs, chat history, AI drafts, and Leads data for testing while preserving login credentials and active integrations.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <p className="text-content-secondary">
            Use this button during testing to get a clean slate. It completely deletes all conversations, messages, drafts, and leads pipeline records across all channels, without disconnecting your WhatsApp/Instagram accounts or logging you out.
          </p>
          <div className="flex items-center justify-between pt-2">
            <div>
              <span className="font-medium text-content-primary block">Wipe all DMs & Leads</span>
              <span className="text-[11px] text-content-secondary block">
                Preserves user accounts, memberships, and Meta integration tokens
              </span>
            </div>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setIsResetOpen(true)}
              className="gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
              Reset testing data
            </Button>
          </div>
        </CardContent>
      </Card>

      {isResetOpen && (
        <Dialog
          alert
          title="Reset all testing data?"
          onClose={() => !isResetting && setIsResetOpen(false)}
          isBusy={isResetting}
        >
          <div className="space-y-4 p-4 text-xs">
            <p className="leading-5 text-foreground/90">
              This will permanently delete all <strong>conversations</strong>, <strong>messages</strong>,{' '}
              <strong>message drafts</strong>, and <strong>leads</strong> for this tenant.
            </p>
            <div className="p-3 rounded-lg border border-border bg-surface-base space-y-1.5">
              <div className="font-semibold text-content-primary">What will be removed:</div>
              <ul className="list-disc pl-4 space-y-0.5 text-content-secondary">
                <li>All Inbox message threads & conversation logs</li>
                <li>All CRM Leads in the Leads section</li>
                <li>All staged AI review drafts</li>
              </ul>
              <div className="font-semibold text-content-primary pt-2">What will stay safe:</div>
              <ul className="list-disc pl-4 space-y-0.5 text-content-secondary">
                <li>Your user account and login session</li>
                <li>Instagram & WhatsApp connected integrations</li>
                <li>Configured AI providers & API keys</li>
              </ul>
            </div>

            {resetError && (
              <p role="alert" className="text-[13px] text-danger">
                {resetError}
              </p>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={isResetting}
                onClick={() => setIsResetOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={isResetting}
                onClick={handleResetTestingData}
              >
                {isResetting ? 'Resetting…' : 'Yes, wipe testing data'}
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
