import * as React from 'react';
import { useConnectWhatsApp } from '@/hooks/useWhatsApp';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/Field';

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
      setFormError('Phone number ID, WABA ID, and permanent access token are all required.');
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
    <Dialog
      title="Connect WhatsApp Cloud API"
      onClose={onClose}
      isBusy={connectMutation.isPending}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-4">
        <p className="text-xs text-content-secondary">
          Enter credentials from your Meta Business Platform dashboard. Tokens are encrypted using AES-256-GCM.
        </p>

        {formError && (
          <p role="alert" className="text-xs text-danger">
            {formError}
          </p>
        )}

        <Field
          required
          label="Phone number ID *"
          placeholder="e.g. 100234567890123"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
        />

        <Field
          required
          label="WhatsApp Business Account (WABA) ID *"
          placeholder="e.g. 109876543210987"
          value={wabaId}
          onChange={(e) => setWabaId(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
          <Field
            label="Display name"
            placeholder="e.g. Visa Support"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
          />
          <Field
            label="Phone number"
            placeholder="e.g. +971 50 123 4567"
            value={phoneNumber}
            onChange={(e) => setPhoneNumber(e.target.value)}
          />
        </div>

        <Field
          required
          label="System user permanent access token *"
          type="password"
          placeholder="EAABw…"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
        />

        <div className="pt-3 border-t border-border flex items-center justify-end gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={connectMutation.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={connectMutation.isPending || !phoneNumberId.trim() || !wabaId.trim() || !accessToken.trim()}
          >
            {connectMutation.isPending ? 'Connecting…' : 'Connect WhatsApp'}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
