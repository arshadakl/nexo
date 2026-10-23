/**
 * Server-side intake checklist. The model is told exactly which details are still missing and
 * which single question to ask next, so the conversation progresses to a summary and next step
 * instead of drifting or repeating questions.
 */

export interface IntakeLead {
  service_vertical?: string | null;
  residency_intent?: string | null;
  profession?: string | null;
  work_business_activity?: string | null;
  current_country?: string | null;
  current_location?: string | null;
  uae_location_context?: string | null;
  visa_status?: string | null;
  target_emirate?: string | null;
  timeline?: string | null;
  full_name?: string | null;
  nationality?: string | null;
  phone_or_email?: string | null;
  contact_pending?: number | null;
  whatsapp_number?: string | null;
  whatsapp_same_as_phone?: number | null;
  external_sharing_permission?: number | null;
  lead_status?: string | null;
}

export interface IntakeItem {
  key: string;
  question: string;
}

export interface IntakeChecklist {
  service: 'residency' | 'business_setup' | 'both' | 'unspecified';
  stillNeeded: IntakeItem[];
  nextQuestion: string | null;
  complete: boolean;
  /** The closing summary was already sent (lead moved to ready_for_team or beyond). */
  summarySent: boolean;
}

const has = (v: unknown) => typeof v === 'string' && v.trim().length > 0 && !['unspecified', 'unknown'].includes(v);

const Q = {
  service: 'Are you looking for help setting up a company, residency for yourself, or both?',
  profession: 'What kind of work do you do?',
  activity: 'What kind of business activity or sector are you planning?',
  route: 'Do you need a free zone permit with the residency visa, or would you like the team to assess the right route for you?',
  location: 'Which country are you currently in?',
  visaStatus: 'What visa are you currently on in the UAE?',
  emirate: 'Which emirate would you prefer, or are you open to options?',
  timeline: 'When are you hoping to get started?',
  timelineInUae: 'When would you like to proceed?',
  name: 'May I have your name?',
  nationality: 'What is your nationality?',
  phone: 'What number can the team reach you on, including country code?',
  whatsapp: 'Is that also your WhatsApp number?',
  sharing: 'Are you happy for us to share your enquiry details with a verified business-setup expert so they can contact you?',
};

export function buildIntakeChecklist(lead: IntakeLead | null): IntakeChecklist {
  const l = lead || {};
  const service = (has(l.service_vertical) ? l.service_vertical : 'unspecified') as IntakeChecklist['service'];
  const residency = service === 'residency' || service === 'both';
  const business = service === 'business_setup' || service === 'both';
  const inUae = l.uae_location_context === 'inside_uae' || l.current_country === 'United Arab Emirates';
  const items: IntakeItem[] = [];

  if (service === 'unspecified') {
    items.push({ key: 'service', question: Q.service });
  } else {
    // C. Service-specific questions first.
    if (business && !has(l.work_business_activity)) items.push({ key: 'businessActivity', question: Q.activity });
    if (residency && !has(l.profession) && !has(l.work_business_activity)) items.push({ key: 'profession', question: Q.profession });
    if (residency && !has(l.residency_intent)) items.push({ key: 'residencyRoute', question: Q.route });
    if (!has(l.current_country) && !has(l.current_location) && !inUae) items.push({ key: 'currentLocation', question: Q.location });
    if (residency && inUae && !has(l.visa_status)) items.push({ key: 'visaStatus', question: Q.visaStatus });
    if (!has(l.target_emirate)) items.push({ key: 'preferredEmirate', question: Q.emirate });
    if (!has(l.timeline)) items.push({ key: 'timeline', question: inUae ? Q.timelineInUae : Q.timeline });
  }

  // D. Profile and contact details once the need is understood.
  if (service !== 'unspecified') {
    if (!has(l.full_name)) items.push({ key: 'name', question: Q.name });
    if (!has(l.nationality)) items.push({ key: 'nationality', question: Q.nationality });
    if (business && !residency && !has(l.profession) && !has(l.work_business_activity)) {
      items.push({ key: 'profession', question: Q.profession });
    }
    if (!has(l.phone_or_email) && l.contact_pending !== 1) items.push({ key: 'phone', question: Q.phone });
    if (has(l.phone_or_email) && !has(l.whatsapp_number) && l.whatsapp_same_as_phone !== 1) {
      items.push({ key: 'whatsapp', question: Q.whatsapp });
    }
    if (business && l.external_sharing_permission !== 1) items.push({ key: 'expertSharingPermission', question: Q.sharing });
  }

  const summarySent = ['ready_for_team', 'handed_over'].includes(String(l.lead_status || ''));
  return {
    service,
    stillNeeded: items,
    nextQuestion: items[0]?.question ?? null,
    complete: items.length === 0,
    summarySent,
  };
}

/** Lower-cased word set used to spot a reply that repeats an earlier one. */
function words(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 2)
  );
}

/** True when `reply` says essentially the same thing as one of the recent outbound messages. */
export function isNearDuplicateReply(reply: string, recentOutbound: string[], threshold = 0.75): boolean {
  const a = words(reply);
  if (a.size === 0) return false;
  return recentOutbound.some((text) => {
    const b = words(text);
    if (b.size === 0) return false;
    let shared = 0;
    a.forEach((w) => {
      if (b.has(w)) shared++;
    });
    return shared / (a.size + b.size - shared) >= threshold;
  });
}
