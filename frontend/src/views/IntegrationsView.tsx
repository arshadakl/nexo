import * as React from 'react';
import {
  Unplug,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  ExternalLink,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useIntegrations,
  useConnectInstagram,
  useDisconnectIntegration,
} from '@/hooks/useIntegrations';
import { WhatsAppConnectModal } from '@/components/integrations/WhatsAppConnectModal';

export function IntegrationsView() {
  const [isWAModalOpen, setIsWAModalOpen] = React.useState(false);
  const { data: connections, isLoading, refetch } = useIntegrations();
  const { connect: connectInstagram, isConnecting, notification, dismissNotification } = useConnectInstagram();
  const disconnectMutation = useDisconnectIntegration();

  const igConnection = connections?.find((c) => c.provider === 'instagram' && c.status === 'connected');
  const waConnection = connections?.find((c) => c.provider === 'whatsapp' && c.status === 'connected');

  return (
    <div className="space-y-6">
      {/* Top Banner: Notification */}
      {notification && (
        <div
          className={`p-4 rounded-xl border text-xs flex items-center justify-between shadow-sm ${
            notification.success
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : 'border-destructive/30 bg-destructive/10 text-destructive'
          }`}
        >
          <div className="flex items-center gap-2.5">
            {notification.success ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
            )}
            <span className="font-medium">{notification.message}</span>
          </div>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 text-xs px-2"
            onClick={dismissNotification}
          >
            Dismiss
          </Button>
        </div>
      )}

      {/* Main Grid: Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Instagram Professional Card */}
        <Card className={igConnection ? 'border-pink-500/30 bg-card/90 shadow-sm' : 'border-border'}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 via-pink-500 to-purple-600 flex items-center justify-center text-white font-bold shadow-md shadow-pink-500/15">
                  IG
                </div>
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    Instagram Professional
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Official Meta Instagram Login with DM messaging access
                  </CardDescription>
                </div>
              </div>

              {isLoading ? (
                <Skeleton className="h-5 w-20 rounded-full" />
              ) : igConnection ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full rounded-lg" />
                <Skeleton className="h-9 w-full rounded-lg" />
              </div>
            ) : igConnection ? (
              <>
                <div className="p-3.5 rounded-lg bg-secondary/40 border border-border space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Connected Handle:</span>
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      @{igConnection.displayName || igConnection.externalAccountId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Account ID:</span>
                    <span className="font-mono text-muted-foreground">{igConnection.externalAccountId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Permissions:</span>
                    <span className="text-[11px] font-mono text-emerald-400">instagram_business_manage_messages</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Webhooks:</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      Active (Subscribed)
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full text-xs h-8 gap-1.5"
                    onClick={() => refetch()}
                  >
                    <span>Check Health</span>
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 text-xs h-8 px-3"
                    disabled={disconnectMutation.isPending}
                    onClick={() => {
                      if (confirm('Disconnect Instagram account? Incoming DMs will no longer be received.')) {
                        disconnectMutation.mutate(igConnection.id);
                      }
                    }}
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    <span>{disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                  <p className="text-muted-foreground leading-relaxed">
                    Connect your consultancy’s Instagram Business or Creator account in 1-click. Meta’s official consent dialog opens in a popup window.
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Zero copying or pasting of access tokens</li>
                    <li>Automatic 60-day token generation & AES-256-GCM encryption</li>
                    <li>Instant DM webhook subscription</li>
                  </ul>
                </div>

                <Button
                  size="default"
                  className="w-full text-xs h-10 gap-2 bg-gradient-to-r from-pink-500 via-purple-600 to-indigo-600 hover:opacity-90 text-white font-semibold shadow-md"
                  disabled={isConnecting}
                  onClick={() => connectInstagram()}
                >
                  {isConnecting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Authorizing in Meta Popup...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4" />
                      <span>Connect Instagram (1-Click Popup)</span>
                      <ExternalLink className="w-3.5 h-3.5 ml-auto opacity-70" />
                    </>
                  )}
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Business Platform Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white font-bold shadow-md shadow-emerald-500/20">
                  WA
                </div>
                <div>
                  <CardTitle className="text-base font-bold">WhatsApp Business</CardTitle>
                  <CardDescription className="text-xs">Meta Cloud Messaging API</CardDescription>
                </div>
              </div>
              {waConnection ? (
                <Badge variant="success">Connected</Badge>
              ) : (
                <Badge variant="outline">Not Connected</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {waConnection ? (
              <>
                <div className="p-3.5 rounded-lg bg-secondary/40 border border-border space-y-2.5">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Account Name:</span>
                    <span className="font-semibold text-foreground">{waConnection.displayName || 'WhatsApp Account'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Phone Number ID:</span>
                    <span className="text-foreground font-mono text-[11px]">{waConnection.phoneNumberId || waConnection.externalAccountId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Encryption:</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                      <ShieldCheck className="w-3.5 h-3.5" /> AES-256-GCM Secured
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Webhooks:</span>
                    <span className="text-emerald-400 font-medium flex items-center gap-1 text-[11px]">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Active & Receiving
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5 text-xs h-8 px-3"
                    disabled={disconnectMutation.isPending}
                    onClick={() => {
                      if (confirm('Disconnect WhatsApp account? Incoming WhatsApp inquiries will no longer be received.')) {
                        disconnectMutation.mutate(waConnection.id);
                      }
                    }}
                  >
                    <Unplug className="w-3.5 h-3.5" />
                    <span>{disconnectMutation.isPending ? 'Disconnecting...' : 'Disconnect'}</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="p-4 rounded-xl bg-secondary/30 border border-border space-y-2">
                  <p className="text-muted-foreground leading-relaxed">
                    Connect your Meta WhatsApp Business Cloud API to receive and reply to visa inquiries directly from applicants on WhatsApp.
                  </p>
                  <ul className="text-[11px] text-muted-foreground space-y-1 list-disc list-inside">
                    <li>Supports 24-hour customer service window</li>
                    <li>AES-256-GCM encrypted permanent token</li>
                    <li>Automatic AI lead qualification & counselor takeover</li>
                  </ul>
                </div>

                <Button
                  size="default"
                  className="w-full text-xs h-10 gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-md shadow-emerald-600/20"
                  onClick={() => setIsWAModalOpen(true)}
                >
                  <Sparkles className="w-4 h-4" />
                  <span>Connect WhatsApp Cloud API</span>
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <WhatsAppConnectModal
        isOpen={isWAModalOpen}
        onClose={() => setIsWAModalOpen(false)}
      />
    </div>
  );
}
