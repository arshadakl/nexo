import type { AIQualificationResult } from '@shared/types/ai.types';
import type { AISuggestion, ConfirmableLeadField, LeadQualification, LeadStatus } from '@shared/types/crm.types';

/**
 * Merges AI-extracted profile fields into a stored lead without letting uncertain guesses
 * replace known or dashboard-confirmed values. Pure: returns column updates for the caller to write.
 */

export interface StoredLeadProfile {
  fullName?: string | null;
  phoneOrEmail?: string | null;
  whatsappNumber?: string | null;
  nationality?: string | null;
  currentCountry?: string | null;
  currentCity?: string | null;
  currentLocation?: string | null;
  targetEmirate?: string | null;
  visaStatus?: string | null;
  timeline?: string | null;
  profession?: string | null;
  workBusinessActivity?: string | null;
  serviceVertical?: string | null;
  residencyIntent?: string | null;
  uaeLocationContext?: string | null;
  qualification?: string | null;
  confirmedFields?: string[];
}

export interface ProfileMergeResult {
  /** Column name -> value. Only columns that should change are present. */
  columns: Record<string, string | number | null>;
  /** Values the AI proposed but that were not applied (confirmed, uncertain, or invalid). */
  suggestions: AISuggestion[];
}

const COLUMN: Record<ConfirmableLeadField, string> = {
  fullName: 'full_name',
  phoneOrEmail: 'phone_or_email',
  whatsappNumber: 'whatsapp_number',
  nationality: 'nationality',
  currentCountry: 'current_country',
  currentCity: 'current_city',
  currentLocation: 'current_location',
  targetEmirate: 'target_emirate',
  visaStatus: 'visa_status',
  timeline: 'timeline',
  profession: 'profession',
  workBusinessActivity: 'work_business_activity',
  serviceVertical: 'service_vertical',
  residencyIntent: 'residency_intent',
  uaeLocationContext: 'uae_location_context',
};

export const CONFIRMABLE_FIELDS = Object.keys(COLUMN) as ConfirmableLeadField[];

// Changing an existing identity value needs an explicit, high-confidence statement.
const IDENTITY_FIELDS = new Set<ConfirmableLeadField>(['fullName', 'nationality', 'phoneOrEmail', 'whatsappNumber']);
const ENUM_UNSET = new Set(['unspecified', 'unknown']);
const PLACEHOLDER_NAMES = new Set(['applicant', 'instagram user', 'customer']);
const EMPTY_VALUES = new Set(['', 'null', 'none', 'unknown', 'n/a', 'na', 'not provided', 'not specified', 'undefined']);

const EMIRATES: Record<string, string> = {
  dubai: 'Dubai',
  'abu dhabi': 'Abu Dhabi',
  abudhabi: 'Abu Dhabi',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  'ras al khaimah': 'Ras Al Khaimah',
  rak: 'Ras Al Khaimah',
  fujairah: 'Fujairah',
  'umm al quwain': 'Umm Al Quwain',
  uaq: 'Umm Al Quwain',
  'al ain': 'Al Ain',
};
const UAE_NAMES = new Set(['uae', 'u.a.e', 'u.a.e.', 'united arab emirates', 'emirates', 'the uae']);
const UNDECIDED = new Set(['undecided', 'not decided', 'not sure', 'any', 'flexible', 'open']);

function clean(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return EMPTY_VALUES.has(trimmed.toLowerCase()) ? null : trimmed;
}

function emirateName(value: string): string | null {
  return EMIRATES[value.toLowerCase().replace(/[.,]/g, '').replace(/\s+/g, ' ').trim()] ?? null;
}

function same(a: string | null | undefined, b: string | null | undefined): boolean {
  return (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();
}

/** Normalises location-related extraction so each value lands in exactly one field. */
export function sanitizeLocationFields(fields: AIQualificationResult['extractedFields']) {
  const out: Partial<Record<ConfirmableLeadField, string>> = {};
  const rejected: { field: ConfirmableLeadField; value: string; reason: string }[] = [];

  let country = clean(fields.currentCountry);
  let city = clean(fields.currentCity);
  const legacyLocation = clean(fields.currentLocation);

  // Older prompt versions only return a combined currentLocation.
  if (!country && !city && legacyLocation) {
    if (legacyLocation.includes(',')) {
      const parts = legacyLocation.split(',').map((p) => p.trim()).filter(Boolean);
      if (parts.length === 2 && !/(ian|ese|ish|i)$/i.test(parts[1]!)) {
        city = parts[0]!;
        country = parts[1]!;
      } else {
        rejected.push({ field: 'currentCountry', value: legacyLocation, reason: 'combined location' });
      }
    } else {
      country = legacyLocation;
    }
  }

  if (country) {
    const emirate = emirateName(country);
    if (emirate) {
      // "Dubai" is a city/emirate, never a country.
      city = city || emirate;
      country = 'United Arab Emirates';
    } else if (UAE_NAMES.has(country.toLowerCase())) {
      country = 'United Arab Emirates';
    } else if (country.includes(',') || / and /i.test(country)) {
      rejected.push({ field: 'currentCountry', value: country, reason: 'combined value' });
      country = null;
    }
  }
  if (country) out.currentCountry = country;
  if (city) out.currentCity = city;

  const nationality = clean(fields.nationality);
  if (nationality) {
    if (emirateName(nationality)) {
      rejected.push({ field: 'nationality', value: nationality, reason: 'a UAE place is not a nationality' });
    } else if (nationality.includes(',') || / and /i.test(nationality)) {
      rejected.push({ field: 'nationality', value: nationality, reason: 'combined value' });
    } else if (UAE_NAMES.has(nationality.toLowerCase())) {
      out.nationality = 'Emirati';
    } else {
      out.nationality = nationality;
    }
  }

  const target = clean(fields.targetEmirate);
  if (target) {
    const emirate = emirateName(target);
    if (emirate) out.targetEmirate = emirate;
    else if (UNDECIDED.has(target.toLowerCase())) out.targetEmirate = 'Undecided';
    else rejected.push({ field: 'targetEmirate', value: target, reason: 'not a UAE emirate' });
  }

  return { values: out, rejected };
}

export function mergeLeadProfile(
  existing: StoredLeadProfile | null,
  qualification: Pick<AIQualificationResult, 'extractedFields' | 'fieldConfidence'>,
  messageAt: number
): ProfileMergeResult {
  const fields = qualification.extractedFields || {};
  const confidence = qualification.fieldConfidence || {};
  const confirmed = new Set(existing?.confirmedFields || []);
  const columns: ProfileMergeResult['columns'] = {};
  const suggestions: AISuggestion[] = [];

  const location = sanitizeLocationFields(fields);
  for (const r of location.rejected) {
    suggestions.push({ field: r.field, value: `${r.value} (not saved: ${r.reason})`, keptValue: existing?.[r.field] ?? null, at: messageAt });
  }

  const name = clean(fields.fullName);
  const phone = clean(fields.phoneOrEmail) || clean(fields.phoneNumber);
  const proposed: Partial<Record<ConfirmableLeadField, string | undefined>> = {
    ...location.values,
    fullName: name && !PLACEHOLDER_NAMES.has(name.toLowerCase()) ? name : undefined,
    phoneOrEmail: phone ?? undefined,
    whatsappNumber: clean(fields.whatsappNumber) ?? undefined,
    visaStatus: clean(fields.visaStatus) ?? undefined,
    timeline: clean(fields.timeline) ?? undefined,
    profession: clean(fields.profession) ?? undefined,
    workBusinessActivity: clean(fields.workBusinessActivity) ?? undefined,
    serviceVertical: fields.serviceVertical && !ENUM_UNSET.has(fields.serviceVertical) ? fields.serviceVertical : undefined,
    residencyIntent: fields.residencyIntent && !ENUM_UNSET.has(fields.residencyIntent) ? fields.residencyIntent : undefined,
    uaeLocationContext: fields.uaeLocationContext && !ENUM_UNSET.has(fields.uaeLocationContext) ? fields.uaeLocationContext : undefined,
  };

  // The same number confirmed for WhatsApp fills both fields.
  const knownPhone = proposed.phoneOrEmail || existing?.phoneOrEmail || null;
  if (fields.whatsappSameAsPhone && knownPhone && !proposed.whatsappNumber) {
    proposed.whatsappNumber = knownPhone;
  }

  // Being located in a non-UAE country implies outside_uae unless the model said otherwise.
  if (!proposed.uaeLocationContext && proposed.currentCountry) {
    proposed.uaeLocationContext = proposed.currentCountry === 'United Arab Emirates' ? 'inside_uae' : 'outside_uae';
  }

  for (const field of CONFIRMABLE_FIELDS) {
    const value = proposed[field];
    if (!value) continue;
    const current = existing?.[field] ?? null;
    const isUnset =
      !current ||
      ENUM_UNSET.has(String(current)) ||
      (field === 'fullName' && PLACEHOLDER_NAMES.has(String(current).toLowerCase()));
    if (!isUnset && same(current, value)) continue;

    const conf = typeof confidence[field] === 'number' ? confidence[field]! : null;
    if (confirmed.has(field)) {
      suggestions.push({ field, value, keptValue: current, at: messageAt });
      continue;
    }
    if (conf !== null && conf < 0.5) {
      suggestions.push({ field, value, keptValue: current, at: messageAt });
      continue;
    }
    if (!isUnset) {
      const required = IDENTITY_FIELDS.has(field) ? 0.8 : 0.6;
      if ((conf ?? (IDENTITY_FIELDS.has(field) ? 0 : 1)) < required) {
        suggestions.push({ field, value, keptValue: current, at: messageAt });
        continue;
      }
    }
    columns[COLUMN[field]] = value;
  }

  if ('timeline' in columns) columns.timeline_stated_at = messageAt;
  if ('whatsapp_number' in columns && knownPhone && same(String(columns.whatsapp_number), knownPhone)) {
    columns.whatsapp_same_as_phone = 1;
  }
  if ('current_country' in columns || 'current_city' in columns) {
    const city = (columns.current_city as string | undefined) ?? existing?.currentCity ?? null;
    const country = (columns.current_country as string | undefined) ?? existing?.currentCountry ?? null;
    columns.current_location = [city, country].filter(Boolean).join(', ') || null;
  }
  if (phone || columns.whatsapp_number) columns.contact_pending = 0;
  else if (fields.contactPending && !existing?.phoneOrEmail) columns.contact_pending = 1;

  return { columns, suggestions };
}

/**
 * Qualification is the model's judgement with a recorded reason, bounded by lead status:
 * out-of-scope leads are a separate category, and a missing reason keeps the previous value.
 */
export function resolveQualification(
  proposed: LeadQualification | null | undefined,
  reason: string | null | undefined,
  leadStatus: LeadStatus
): { qualification: LeadQualification; reason: string | null } | null {
  if (leadStatus === 'outside_scope_request' || leadStatus === 'outside_scope_spam') {
    return { qualification: 'outside_scope', reason: reason || 'Enquiry is outside Resider’s current services' };
  }
  // 'unknown' is the column default; an evidence-free 'unknown' must not downgrade a scored lead.
  if (!proposed || proposed === 'outside_scope' || proposed === 'unknown' || !reason) return null;
  return { qualification: proposed, reason };
}
