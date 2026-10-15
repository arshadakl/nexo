import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function SettingsView() {
  return (
    <div className="space-y-6 max-w-4xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Tenant Data Retention Policy</CardTitle>
          <CardDescription className="text-xs">
            Automatically purge inactive applicant chat history according to your consultancy compliance rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-xs">
          <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20">
            <div>
              <p className="font-semibold text-foreground">Message Retention Period</p>
              <p className="text-muted-foreground text-[10px]">Purges DM content older than the set days</p>
            </div>
            <div className="flex items-center gap-2">
              <Input defaultValue="180" className="w-20 text-center font-mono text-xs h-8" />
              <span className="text-muted-foreground text-xs">days</span>
            </div>
          </div>
          <Button size="sm" className="text-xs h-8">Save Retention Policy</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base font-bold">Staff Role-Based Access (RBAC)</CardTitle>
          <CardDescription className="text-xs">
            Manage your visa consultants, supervisors, and admin permissions.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-xs space-y-3">
          <div className="p-3 rounded-lg border border-border bg-secondary/20 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">Sarah Jenkins (You)</p>
              <p className="text-muted-foreground text-[10px]">sarah@visahorizon.com • Owner Role</p>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-primary/20 text-primary">Owner</span>
          </div>

          <div className="p-3 rounded-lg border border-border bg-secondary/20 flex items-center justify-between">
            <div>
              <p className="font-semibold text-foreground">David Miller</p>
              <p className="text-muted-foreground text-[10px]">david@visahorizon.com • Case Reviewer</p>
            </div>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-secondary text-foreground">Supervisor</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
