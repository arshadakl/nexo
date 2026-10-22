import type { LeadStatus } from '@shared/types/crm.types';

export const leadLabels: Record<LeadStatus, string> = {
  needs_clarification: 'Needs clarification',
  exploring: 'Exploring',
  ready_for_team: 'Ready for team',
  handover_requested: 'Needs Human Hand',
  handed_over: 'Staff Handled',
  support_enquiry: 'Support enquiry',
  outside_scope_request: 'Outside scope request',
  outside_scope_spam: 'Outside scope / spam',
};
export function humanize(value: string | null | undefined) {
  return value ? value.replace(/_/g, ' ') : 'Not recorded';
}
