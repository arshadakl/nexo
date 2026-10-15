import { RefreshCw, Unplug } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

export function IntegrationsView() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Instagram Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md">
                  IG
                </div>
                <div>
                  <CardTitle className="text-base font-bold">Instagram Professional</CardTitle>
                  <CardDescription className="text-xs">Meta Instagram Login with DM messaging scopes</CardDescription>
                </div>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Account Handle:</span>
                <span className="font-semibold text-foreground">@visahorizon.official</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Granted Scopes:</span>
                <span className="font-mono text-[11px] text-foreground">instagram_business_manage_messages</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Webhook Subscribed:</span>
                <span className="text-emerald-400 font-medium">Yes (Active)</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-8">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Re-verify Connection</span>
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5 text-xs h-8 px-3">
                <Unplug className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* WhatsApp Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
                  WA
                </div>
                <div>
                  <CardTitle className="text-base font-bold">WhatsApp Business</CardTitle>
                  <CardDescription className="text-xs">Meta Embedded Signup & Cloud Messaging API</CardDescription>
                </div>
              </div>
              <Badge variant="success">Connected</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            <div className="p-3 rounded-lg bg-secondary/40 border border-border space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Business Number:</span>
                <span className="font-semibold text-foreground">+1 (555) 019-2834</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">WABA ID:</span>
                <span className="font-mono text-[11px] text-muted-foreground">9283748291029</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Messaging Tier:</span>
                <span className="text-foreground font-medium">Standard Cloud API</span>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs h-8">
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync Templates</span>
              </Button>
              <Button size="sm" variant="destructive" className="gap-1.5 text-xs h-8 px-3">
                <Unplug className="w-3.5 h-3.5" />
                <span>Disconnect</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
