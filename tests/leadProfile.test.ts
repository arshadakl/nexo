import { describe, expect, it } from 'vitest';
import { mergeLeadProfile, resolveQualification, sanitizeLocationFields } from '../worker/lib/leadProfile';
import { buildResiderSystemPrompt } from '../worker/lib/residerPrompt';
import { AIQualificationResultSchema } from '../shared/schemas/ai.schema';
import { evaluateReplyPolicy } from '../worker/lib/policyEngine';
import { classifyAttachments, hasCustomerText, placeholderText } from '../worker/lib/inboundContent';
import { instagramWebhookAdapter } from '../worker/adapters/meta/instagramWebhook';
import { whatsappWebhookAdapter } from '../worker/adapters/meta/whatsappWebhook';

const AT = 1_760_000_000_000;

describe('D. location extraction keeps fields separate', () => {
  it('Indian person currently in Brazil, planning Dubai next month', () => {
    const { columns } = mergeLeadProfile(
      null,
      {
        extractedFields: { nationality: 'Indian', currentCountry: 'Brazil', targetEmirate: 'Dubai', timeline: 'next month' },
        fieldConfidence: {},
      },
      AT
    );
    expect(columns).toMatchObject({
      nationality: 'Indian',
      current_country: 'Brazil',
      target_emirate: 'Dubai',
      timeline: 'next month',
      timeline_stated_at: AT,
      current_location: 'Brazil',
      uae_location_context: 'outside_uae',
    });
  });

  it('never stores an emirate as a country, or a combined value', () => {
    expect(sanitizeLocationFields({ currentCountry: 'Dubai' }).values).toEqual({
      currentCountry: 'United Arab Emirates',
      currentCity: 'Dubai',
    });
    const combined = sanitizeLocationFields({ currentLocation: 'Brazil, Indian', nationality: 'Brazil, Indian' });
    expect(combined.values).toEqual({});
    expect(combined.rejected.map((r) => r.field)).toEqual(['currentCountry', 'nationality']);
    expect(sanitizeLocationFields({ targetEmirate: 'Brazil' }).values).toEqual({});
  });
});

describe('E. ambiguous "my country is Dubai"', () => {
  it('does not invent a nationality and does not overwrite a known one', () => {
    const result = mergeLeadProfile(
      { nationality: 'Indian' },
      { extractedFields: { nationality: 'Dubai' }, fieldConfidence: { nationality: 0.9 } },
      AT
    );
    expect(result.columns).not.toHaveProperty('nationality');
    expect(result.suggestions[0]).toMatchObject({ field: 'nationality', keptValue: 'Indian' });
  });

  it('prompt instructs the model to clarify instead of guessing', () => {
    const prompt = buildResiderSystemPrompt({ channel: 'instagram', approvedKnowledge: [] });
    expect(prompt).toContain('"my country is Dubai"');
    expect(prompt).toContain('leave nationality and currentCountry null');
    expect(prompt).toContain('Dubai and other emirates are never a country');
  });
});

describe('L. confirmed and uncertain values', () => {
  it('never replaces a dashboard-confirmed field', () => {
    const result = mergeLeadProfile(
      { nationality: 'Indian', confirmedFields: ['nationality'] },
      { extractedFields: { nationality: 'Pakistani' }, fieldConfidence: { nationality: 0.99 } },
      AT
    );
    expect(result.columns).toEqual({});
    expect(result.suggestions[0]).toMatchObject({ field: 'nationality', value: 'Pakistani', keptValue: 'Indian' });
  });

  it('ignores low-confidence guesses and needs an explicit statement to change identity fields', () => {
    expect(
      mergeLeadProfile(null, { extractedFields: { profession: 'Engineer' }, fieldConfidence: { profession: 0.3 } }, AT).columns
    ).toEqual({});
    expect(
      mergeLeadProfile({ fullName: 'Adinan' }, { extractedFields: { fullName: 'Arshad' }, fieldConfidence: {} }, AT).columns
    ).toEqual({});
    expect(
      mergeLeadProfile({ fullName: 'Adinan' }, { extractedFields: { fullName: 'Adinan Sayed' }, fieldConfidence: { fullName: 0.95 } }, AT)
        .columns
    ).toEqual({ full_name: 'Adinan Sayed' });
    // Placeholder names are not real values.
    expect(mergeLeadProfile({ fullName: 'Applicant' }, { extractedFields: { fullName: 'Adinan' }, fieldConfidence: {} }, AT).columns)
      .toEqual({ full_name: 'Adinan' });
  });
});

describe('B. contact details', () => {
  it('confirmed same WhatsApp number fills both fields', () => {
    const { columns } = mergeLeadProfile(
      null,
      { extractedFields: { phoneOrEmail: '+971501234567', whatsappSameAsPhone: true }, fieldConfidence: {} },
      AT
    );
    expect(columns).toMatchObject({
      phone_or_email: '+971501234567',
      whatsapp_number: '+971501234567',
      whatsapp_same_as_phone: 1,
      contact_pending: 0,
    });
  });

  it('records contact pending when the person declines', () => {
    expect(mergeLeadProfile(null, { extractedFields: { contactPending: true }, fieldConfidence: {} }, AT).columns).toEqual({
      contact_pending: 1,
    });
  });
});

describe('qualification', () => {
  it('requires a reason, never downgrades to unknown, and keeps outside-scope separate', () => {
    expect(resolveQualification('hot', 'Wants a call this week', 'ready_for_team')).toEqual({
      qualification: 'hot',
      reason: 'Wants a call this week',
    });
    expect(resolveQualification('cold', null, 'exploring')).toBeNull();
    expect(resolveQualification('unknown', 'no info', 'exploring')).toBeNull();
    expect(resolveQualification('warm', 'x', 'outside_scope_spam')?.qualification).toBe('outside_scope');
  });

  it('schema accepts model casing and degrades bad enrichment values instead of failing closed', () => {
    const parsed = AIQualificationResultSchema.parse({
      replyText: 'Hi',
      qualification: 'Hot',
      reviewKind: 'something odd',
      ambiguousStatements: 'not an array',
    });
    expect(parsed.qualification).toBe('hot');
    expect(parsed.reviewKind).toBeNull();
    expect(parsed.ambiguousStatements).toEqual([]);
  });
});

describe('A/B/C. conversation instructions', () => {
  const prompt = buildResiderSystemPrompt({
    channel: 'instagram',
    approvedKnowledge: [],
    lead: { fullName: 'Adinan', nationality: 'Indian', timeline: 'next month', serviceVertical: 'residency' },
    turn: { messages: ['What is the living cost in Dubai?', 'My name is Adinan.'] },
  });

  it('confirms the service before personal data for a broad business goal', () => {
    expect(prompt).toContain('Are you looking for help setting up the company, residency for yourself, or both?');
    expect(prompt).toContain('Do not ask for name, phone or nationality until the service need is understood');
  });

  it('greets, matches tone and is honest about identity', () => {
    expect(prompt).toContain('"Hey! 👋 What can we help you with?"');
    expect(prompt).toContain('Use "bro" only where');
    expect(prompt).toContain('Never claim to be Anas or any human');
  });

  it('passes known profile and the whole turn so nothing is asked twice', () => {
    expect(prompt).toContain('"nationality": "Indian"');
    expect(prompt).toContain('"customerMessagesThisTurn"');
    expect(prompt).toContain('My name is Adinan.');
    expect(prompt).toContain("Thanks, Adinan. I don't have a verified living-cost estimate to share.");
  });

  it('lists only the two approved services and forbids inventing experts or prices', () => {
    expect(prompt).toContain('These are the only services');
    expect(prompt).toContain('You never name, pick or contact an expert');
    expect(prompt).toContain('Never infer a cultural preference from nationality');
    expect(prompt).not.toMatch(/2-year/);
  });
});

describe('policy engine', () => {
  it('blocks unapproved figures and allows figures already confirmed for this customer', () => {
    expect(evaluateReplyPolicy('It costs AED 7500').allowed).toBe(false);
    expect(evaluateReplyPolicy('It costs AED 7500', { approvedFigures: ['7500'] }).allowed).toBe(true);
    expect(evaluateReplyPolicy('AED 7500 plus AED 900', { approvedFigures: ['7500'] }).allowed).toBe(false);
  });
});

describe('inbound normalisation', () => {
  it('keeps Instagram voice notes and drops echoes', () => {
    const events = instagramWebhookAdapter.normalizeWebhookPayload({
      object: 'instagram',
      entry: [
        {
          id: 'biz',
          messaging: [
            { sender: { id: 'u1' }, timestamp: 5, message: { mid: 'a', attachments: [{ type: 'audio', payload: { url: 'u' } }] } },
            { sender: { id: 'biz' }, timestamp: 6, message: { mid: 'b', text: 'our reply', is_echo: true } },
            { sender: { id: 'biz' }, timestamp: 7, message: { mid: 'c', text: 'sent from the app' } },
          ],
        },
      ],
    });
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ messageType: 'audio', messageText: '[Voice note]' });
  });

  it('keeps WhatsApp audio and image captions', () => {
    const events = whatsappWebhookAdapter.normalizeWebhookPayload({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: 'w',
          changes: [
            {
              field: 'messages',
              value: {
                metadata: { phone_number_id: 'p' },
                messages: [
                  { id: '1', from: '9715', timestamp: '1', type: 'audio', audio: { id: 'm' } },
                  { id: '2', from: '9715', timestamp: '2', type: 'image', image: { caption: 'my licence' } },
                ],
              },
            },
          ],
        },
      ],
    });
    expect(events.map((e) => [e.messageType, e.messageText])).toEqual([
      ['audio', '[Voice note]'],
      ['image', 'my licence'],
    ]);
    expect(hasCustomerText('image', 'my licence')).toBe(true);
    expect(hasCustomerText('audio', placeholderText(classifyAttachments([{ type: 'audio' }])))).toBe(false);
  });
});
