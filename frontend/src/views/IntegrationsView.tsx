import * as React from 'react';
import {
  Unplug,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmAction } from '@/components/ui/ConfirmAction';
import {
  useIntegrations,
  useConnectInstagram,
  useDisconnectIntegration,
} from '@/hooks/useIntegrations';
import { WhatsAppConnectModal } from '@/components/integrations/WhatsAppConnectModal';

export function IntegrationsView() {
  const [isWAModalOpen, setIsWAModalOpen] = React.useState(false);
  const [disconnectingTarget, setDisconnectingTarget] = React.useState<{ id: string; provider: string } | null>(null);

  const { data: connections, isLoading, isError, refetch } = useIntegrations();
  const { connect: connectInstagram, isConnecting, notification, dismissNotification } = useConnectInstagram();
  const disconnectMutation = useDisconnectIntegration();

  const igConnection = connections?.find((c) => c.provider === 'instagram' && c.status === 'connected');
  const waConnection = connections?.find((c) => c.provider === 'whatsapp' && c.status === 'connected');

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-content-primary">
            Messaging channels
          </h2>
          <p className="text-xs text-content-secondary mt-0.5">
            Omnichannel customer messaging endpoints connected to your Resider AI workspace.
          </p>
        </div>

        <Button
          size="sm"
          variant="outline"
          className="text-xs h-8 gap-1.5 bg-surface-panel border-border"
          onClick={() => { void refetch(); }}
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
          <span>Refresh status</span>
        </Button>
      </div>

      {/* Banner: Notification */}
      {notification && (
        <div
          role="status"
          className={`p-3.5 rounded-md border text-xs flex items-center justify-between ${
            notification.success
              ? 'border-success/30 bg-success/10 text-success'
              : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          <span>{notification.message}</span>
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

      {isError && (
        <div role="alert" className="p-3.5 rounded-md border border-danger/30 bg-danger/10 text-xs text-danger">
          Could not fetch channels status. Please check your connection and retry.
        </div>
      )}

      {/* Main Grid: Channels */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Instagram Professional Card */}
        <Card className="bg-surface-panel border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-content-primary">
                  Instagram Direct Messaging
                </CardTitle>
                <CardDescription className="text-xs text-content-secondary mt-0.5">
                  Official Meta Instagram Business Login with DM webhook access
                </CardDescription>
              </div>

              {isLoading ? (
                <Skeleton className="h-5 w-20 rounded" />
              ) : igConnection ? (
                <span className="text-xs font-medium text-success">Connected</span>
              ) : (
                <span className="text-xs font-medium text-content-secondary">Disconnected</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : igConnection ? (
              <>
                <div className="p-3.5 rounded-md bg-surface-base border border-border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-content-secondary">Connected handle:</span>
                    <span className="font-medium text-content-primary">
                      @{igConnection.displayName || igConnection.externalAccountId}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-content-secondary">Account ID:</span>
                    <span className="font-mono text-content-primary">{igConnection.externalAccountId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-content-secondary">Webhooks:</span>
                    <span className="text-success font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" />
                      Active (Subscribed)
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-danger border-border hover:bg-danger/10 hover:text-danger"
                    onClick={() => setDisconnectingTarget({ id: igConnection.id, provider: 'Instagram' })}
                  >
                    <Unplug className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Disconnect</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 rounded-md bg-surface-base border border-border space-y-2 text-content-secondary">
                  <p>
                    Connect your Instagram Business or Creator account in a single step via Meta's secure OAuth popup.
                  </p>
                  <ul className="text-[11px] space-y-1 list-disc list-inside">
                    <li>60-day auto-refreshing access token</li>
                    <li>AES-256-GCM encrypted credential storage</li>
                    <li>Instant inbound DM webhook subscription</li>
                  </ul>
                </div>

                <Button
                  size="default"
                  className="w-full text-xs h-9 gap-2"
                  disabled={isConnecting}
                  onClick={() => connectInstagram()}
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{isConnecting ? 'Authorizing in popup…' : 'Connect Instagram account'}</span>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* WhatsApp Business Platform Card */}
        <Card className="bg-surface-panel border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-sm font-semibold text-content-primary">
                  WhatsApp Business Cloud API
                </CardTitle>
                <CardDescription className="text-xs text-content-secondary mt-0.5">
                  Meta Cloud Messaging API for customer chats
                </CardDescription>
              </div>

              {isLoading ? (
                <Skeleton className="h-5 w-20 rounded" />
              ) : waConnection ? (
                <span className="text-xs font-medium text-success">Connected</span>
              ) : (
                <span className="text-xs font-medium text-content-secondary">Disconnected</span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4 text-xs">
            {isLoading ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-9 w-full" />
              </div>
            ) : waConnection ? (
              <>
                <div className="p-3.5 rounded-md bg-surface-base border border-border space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-content-secondary">Account name:</span>
                    <span className="font-medium text-content-primary">{waConnection.displayName || 'WhatsApp Account'}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-content-secondary">Phone Number ID:</span>
                    <span className="text-content-primary font-mono">{waConnection.phoneNumberId || waConnection.externalAccountId}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-content-secondary">Encryption:</span>
                    <span className="text-success font-medium flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" aria-hidden="true" /> AES-256-GCM secured
                    </span>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 text-xs text-danger border-border hover:bg-danger/10 hover:text-danger"
                    onClick={() => setDisconnectingTarget({ id: waConnection.id, provider: 'WhatsApp' })}
                  >
                    <Unplug className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>Disconnect</span>
                  </Button>
                </div>
              </>
            ) : (
              <>
                <div className="p-3.5 rounded-md bg-surface-base border border-border space-y-2 text-content-secondary">
                  <p>
                    Connect your WhatsApp Cloud API phone number ID and system token to dispatch and receive customer messages.
                  </p>
                  <ul className="text-[11px] space-y-1 list-disc list-inside">
                    <li>24-hour customer service session window</li>
                    <li>Permanent system user token encrypted with AES-256-GCM</li>
                    <li>Automated Resider qualification & handover</li>
                  </ul>
                </div>

                <Button
                  size="default"
                  className="w-full text-xs h-9"
                  onClick={() => setIsWAModalOpen(true)}
                >
                  Connect WhatsApp Cloud API
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

      {disconnectingTarget && (
        <ConfirmAction
          title={`Disconnect ${disconnectingTarget.provider}?`}
          actionLabel="Disconnect channel"
          onConfirm={async () => {
            await disconnectMutation.mutateAsync(disconnectingTarget.id);
          }}
          onClose={() => setDisconnectingTarget(null)}
        >
          Incoming messages from {disconnectingTarget.provider} will no longer be received by Resider. Existing conversation history will remain intact.
        </ConfirmAction>
      )}
    </div>
  );
}
