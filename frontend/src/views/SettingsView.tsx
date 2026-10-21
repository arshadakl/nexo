import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useAuth } from '@/lib/AuthContext';
import { ShieldCheck, User, Building2 } from 'lucide-react';

export function SettingsView() {
  const { user } = useAuth();

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
    </div>
  );
}
