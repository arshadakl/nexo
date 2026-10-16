import * as React from 'react';
import { X, ShieldCheck, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useConnectWhatsApp } from '@/hooks/useWhatsApp';

interface WhatsAppConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WhatsAppConnectModal({ isOpen, onClose }: WhatsAppConnectModalProps) {
  const [phoneNumberId, setPhoneNumberId] = React.useState('');
  const [wabaId, setWabaId] = React.useState('');
  const [accessToken, setAccessToken] = React.useState('');
  const [displayName, setDisplayName] = React.useState('');
  const [phoneNumber, setPhoneNumber] = React.useState('');
  const [formError, setFormError] = React.useState<string | null>(null);

  const connectMutation = useConnectWhatsApp();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()) {
      setFormError('Phone Number ID, WABA ID, and System Access Token are all required.');
      return;
    }

    connectMutation.mutate(
      {
        phoneNumberId: phoneNumberId.trim(),
        wabaId: wabaId.trim(),
        accessToken: accessToken.trim(),
        displayName: displayName.trim() || undefined,
        phoneNumber: phoneNumber.trim() || undefined,
      },
      {
        onSuccess: () => {
          onClose();
        },
        onError: (err: any) => {
          setFormError(err?.message || 'Failed to connect WhatsApp account.');
        },
      }
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/20">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs">
              WA
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Connect WhatsApp Cloud API</h3>
              <p className="text-[11px] text-muted-foreground">Meta Business Platform credentials</p>
            </div>
          </div>
          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-foreground">Phone Number ID *</label>
            <Input
              value={phoneNumberId}
              onChange={(e) => setPhoneNumberId(e.target.value)}
              placeholder="e.g. 100234567890123"
              className="h-8 text-xs font-mono"
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-foreground">
              WhatsApp Business Account (WABA) ID *
            </label>
            <Input
              value={wabaId}
              onChange={(e) => setWabaId(e.target.value)}
              placeholder="e.g. 109876543210987"
              className="h-8 text-xs font-mono"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-foreground">Display Name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. Visa Support"
                className="h-8 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-medium text-foreground">Phone Number</label>
              <Input
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                placeholder="e.g. +1 555 123 4567"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-medium text-foreground">
                System User Permanent Token *
              </label>
              <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-400" /> AES-256-GCM
              </span>
            </div>
            <Input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="EAABw..."
              className="h-8 text-xs font-mono"
              required
            />
          </div>

          <div className="pt-2 flex items-center justify-end gap-2">
            <Button type="button" size="sm" variant="outline" className="text-xs h-8" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              size="sm"
              disabled={connectMutation.isPending}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5"
            >
              {connectMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Connecting...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Connect WhatsApp</span>
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
