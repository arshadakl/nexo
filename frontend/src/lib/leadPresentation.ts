import type { AutomationState, LeadQualification, LeadStatus } from '@shared/types/crm.types';

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

export const qualificationLabels: Record<LeadQualification, string> = {
  hot: 'Hot',
  warm: 'Warm',
  cold: 'Cold',
  unknown: 'Unknown',
  outside_scope: 'Outside scope',
};

export const qualificationVariant: Record<LeadQualification, 'destructive' | 'warning' | 'secondary' | 'outline'> = {
  hot: 'destructive',
  warm: 'warning',
  cold: 'secondary',
  unknown: 'outline',
  outside_scope: 'outline',
};

/** Who may reply right now. Shown separately from lead qualification. */
export const automationLabels: Record<AutomationState, string> = {
  ai_active: 'AI active',
  approval_pending: 'Approval pending',
  approval_sending: 'Sending approved reply',
  send_failed: 'Send failed',
  human_takeover: 'Human takeover',
  ai_off: 'AI off',
};

export const automationDescriptions: Record<AutomationState, string> = {
  ai_active: 'The AI replies automatically.',
  approval_pending: 'AI replies paused until the held reply is approved, edited or rejected.',
  approval_sending: 'An approved reply is being sent. The AI resumes once delivery is confirmed.',
  send_failed: 'An approved reply was not delivered. Retry, edit or reject it to continue.',
  human_takeover: 'A team member is handling this conversation. AI stays paused until resumed.',
  ai_off: 'AI replies are turned off for this conversation.',
};

export const reviewKindLabels: Record<string, string> = {
  business_confirmation: 'Needs business confirmation',
  human_requested: 'Customer asked for a person',
  policy_block: 'Blocked by reply policy',
  model_fallback: 'AI could not produce a valid reply',
  ai_review: 'Needs review',
};
