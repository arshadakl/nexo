import { Dialog } from '@/components/ui/Dialog';
import { CustomerDetails } from '@/components/inbox/CustomerDetails';

export function LeadDrawer({ leadId, onClose, onNavigateToInbox }: { leadId: string | null; onClose: () => void; onNavigateToInbox?: (id: string) => void }) {
  if (!leadId) return null;
  return <Dialog title="Customer profile" onClose={onClose} className="mr-0 h-dvh max-h-dvh max-w-xl rounded-none"><CustomerDetails leadId={leadId} onNavigateToInbox={onNavigateToInbox} /></Dialog>;
}
