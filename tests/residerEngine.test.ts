import { describe, it, expect } from 'vitest';
import { buildResiderSystemPrompt } from '../worker/lib/residerPrompt';
import { AIQualificationResultSchema } from '../shared/schemas/ai.schema';
import type { BusinessKnowledgeItem } from '../shared/types/knowledge.types';
import type { VerifiedExpert } from '../shared/types/expert.types';

describe('RESIDER Conversational Engine & Specification Scenarios', () => {
  const mockApprovedKnowledge: BusinessKnowledgeItem[] = [
    {
      id: 'k_1',
      tenantId: 'tenant_1',
      category: 'residency_package',
      title: 'Green Visa Advisory',
      content: 'Includes entry permit, status change, medical examination, and Emirates ID processing.',
      priceAed: 6500,
      isApprovedByClient: true,
      approvalNotes: 'Client confirmed pricing on 2026-10-15',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ];

  const mockAvailableExperts: VerifiedExpert[] = [
    {
      id: 'exp_1',
      tenantId: 'tenant_1',
      fullName: 'Anwar Sadath',
      organizationName: 'Gulf Setup Partners',
      sectors: ['tech', 'e-commerce', 'consulting'],
      languages: ['en', 'ml'],
      emirates: ['dubai', 'sharjah'],
      servicesOffered: ['freezone_licence', 'mainland_llc'],
      isVerified: true,
      isAvailable: true,
      contactPhone: '+971501112233',
      contactEmail: 'anwar@gulfsetup.ae',
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
    },
  ];

  it('builds system prompt embedding all RESIDER core rules, voice, and price guardrails', () => {
    const prompt = buildResiderSystemPrompt({
      channel: 'instagram',
      lead: {
        fullName: 'Faisal Rahman',
        serviceVertical: 'residency',
        residencyIntent: 'understanding_options',
        workBusinessActivity: 'Software Engineer',
        uaeLocationContext: 'inside_uae',
        leadStatus: 'exploring',
        missingDetails: ['timeline'],
      },
      customerName: 'Faisal Rahman',
      approvedKnowledge: mockApprovedKnowledge,
      availableExperts: mockAvailableExperts,
    });

    // Check voice & identity
    expect(prompt).toContain('automated assistant for the team at Resider (UAE)');
    expect(prompt).toContain('Never claim to be Anas personally');
    expect(prompt).toContain('ഹായ് 👋 എന്താണ് അറിയേണ്ടത്?');
    expect(prompt).toContain('bro');

    // Check single question constraint & answer first rule
    expect(prompt).toContain('Ask exactly ONE useful question at a time');
    expect(prompt).toContain('Answer or acknowledge their question BEFORE asking your question');
    expect(prompt).toContain('Never collect nationality, passport copies, or identity cards');

    // Check unapproved price shield (Section 9)
    expect(prompt).toContain('Long-term permit + residency: AED 7,000–7,500');
    expect(prompt).toContain('Freelance permit / residency programme: from AED 7,500');
    expect(prompt).toContain('Residency visa: AED 15,000–20,000');
    expect(prompt).toContain('UNTIL approved, DO NOT automatically quote or recommend these figures!');

    // Check approved knowledge injection
    expect(prompt).toContain('[RESIDENCY_PACKAGE] Green Visa Advisory');
    expect(prompt).toContain('AED 6500');

    // Check expert database injection
    expect(prompt).toContain('Anwar Sadath (Gulf Setup Partners)');

    // Check known lead injection
    expect(prompt).toContain('Faisal Rahman');
    expect(prompt).toContain('Software Engineer');
  });

  it('Scenario 1 & 2: Handles Greeting Only without data interrogation', () => {
    // English greeting
    const enGreetingOutput = {
      intent: 'unknown',
      language: 'en',
      replyText: 'Hey 👋 How can we help?',
      rationale: 'Initial greeting only without interrogation',
      extractedFields: {},
      missingFields: [],
      questionsAnswered: [],
      leadStatus: 'needs_clarification',
      statusReason: 'Lead sent greeting only',
      humanReviewRequired: false,
      safetyFlags: [],
    };
    const parsedEn = AIQualificationResultSchema.parse(enGreetingOutput);
    expect(parsedEn.replyText).toBe('Hey 👋 How can we help?');
    expect(parsedEn.leadStatus).toBe('needs_clarification');

    // Malayalam greeting
    const mlGreetingOutput = {
      intent: 'unknown',
      language: 'ml',
      replyText: 'ഹായ് 👋 എന്താണ് അറിയേണ്ടത്?',
      rationale: 'Malayalam initial greeting',
      extractedFields: {},
      missingFields: [],
      questionsAnswered: [],
      leadStatus: 'needs_clarification',
      statusReason: 'Lead greeted in Malayalam',
      humanReviewRequired: false,
      safetyFlags: [],
    };
    const parsedMl = AIQualificationResultSchema.parse(mlGreetingOutput);
    expect(parsedMl.replyText).toBe('ഹായ് 👋 എന്താണ് അറിയേണ്ടത്?');
    expect(parsedMl.language).toBe('ml');
  });

  it('Scenario 3: General Enquiry explains both services and asks which is needed', () => {
    const generalEnquiryOutput = {
      intent: 'general_enquiry',
      language: 'en',
      replyText: 'We help with residency programmes and connecting people with suitable business-setup experts. Which are you looking for?',
      rationale: 'General service explanation and initial vertical routing',
      extractedFields: {},
      missingFields: ['serviceVertical'],
      questionsAnswered: [],
      leadStatus: 'needs_clarification',
      statusReason: 'Lead asked general enquiry about services offered',
      humanReviewRequired: false,
      safetyFlags: [],
    };
    const parsed = AIQualificationResultSchema.parse(generalEnquiryOutput);
    expect(parsed.intent).toBe('general_enquiry');
    expect(parsed.replyText).toContain('residency programmes and connecting people with suitable business-setup experts');
  });

  it('Scenario 4: Handles Unapproved Price Inquiry safely without quoting banned figures', () => {
    const unapprovedPriceOutput = {
      intent: 'residency',
      language: 'en',
      replyText: 'Our team can calculate the confirmed package costs based on your specific activity and jurisdiction. Would you like our team to go through the suitable options and confirmed costs with you?',
      rationale: 'Price shield applied: unapproved package pricing referred to team review',
      extractedFields: {
        serviceVertical: 'residency',
      },
      missingFields: ['workBusinessActivity', 'uaeLocationContext'],
      questionsAnswered: [],
      leadStatus: 'exploring',
      statusReason: 'Inquired about freelance permit cost; unapproved price shielded and referred to team',
      humanReviewRequired: false,
      safetyFlags: [],
    };
    const parsed = AIQualificationResultSchema.parse(unapprovedPriceOutput);
    expect(parsed.replyText).not.toContain('7,500');
    expect(parsed.replyText).not.toContain('7,000');
    expect(parsed.replyText).toContain('confirmed costs with you');
    expect(parsed.leadStatus).toBe('exploring');
  });

  it('Scenario 5: Multiple Needs records all and prioritizes first step', () => {
    const multipleNeedsOutput = {
      intent: 'both',
      language: 'en',
      replyText: 'We can certainly help with both business setup and your family visa. Which would you like to start with first?',
      rationale: 'Clarifying priority between multiple simultaneous service requests',
      extractedFields: {
        serviceVertical: 'both',
      },
      missingFields: ['workBusinessActivity'],
      questionsAnswered: [],
      leadStatus: 'exploring',
      statusReason: 'Lead requested both company setup and family residency visa',
      humanReviewRequired: false,
      safetyFlags: [],
    };
    const parsed = AIQualificationResultSchema.parse(multipleNeedsOutput);
    expect(parsed.intent).toBe('both');
    expect(parsed.replyText).toContain('Which would you like to start with first?');
  });

  it('Scenario 8: Fast-Track Handover on "Call me / I want to start"', () => {
    const fastTrackOutput = {
      intent: 'residency',
      language: 'en',
      replyText: 'Great, what is the best number and time for our team to call you?',
      rationale: 'Fast-track handover triggered on direct contact request',
      extractedFields: {
        serviceVertical: 'residency',
        contactMethodPreference: 'phone_call',
      },
      missingFields: [],
      questionsAnswered: [],
      leadStatus: 'handover_requested',
      statusReason: 'Customer explicitly asked for a phone call ("Call me")',
      humanReviewRequired: true,
      humanReviewReason: 'Customer requested direct team phone call',
      safetyFlags: [],
    };
    const parsed = AIQualificationResultSchema.parse(fastTrackOutput);
    expect(parsed.leadStatus).toBe('handover_requested');
    expect(parsed.humanReviewRequired).toBe(true);
    expect(parsed.extractedFields.contactMethodPreference).toBe('phone_call');
  });

  it('Scenario 9: Handles Guarantee / Eligibility request honestly', () => {
    const eligibilityOutput = {
      intent: 'residency',
      language: 'en',
      replyText: 'Our consulting experts assess each profile individually to confirm approval criteria before proceeding. What work or business activity do you plan to carry out?',
      rationale: 'Refused false guarantee; explained expert assessment criteria and asked activity',
      extractedFields: {
        serviceVertical: 'residency',
      },
      missingFields: ['workBusinessActivity'],
      questionsAnswered: [],
      leadStatus: 'exploring',
      statusReason: 'Lead asked for approval guarantee; clarified expert assessment',
      humanReviewRequired: false,
      safetyFlags: [],
    };
    const parsed = AIQualificationResultSchema.parse(eligibilityOutput);
    expect(parsed.replyText).not.toContain('guaranteed');
    expect(parsed.replyText).toContain('assess each profile individually');
  });

  it('Scenario 10: Complaint or frustration triggers immediate human handover', () => {
    const complaintOutput = {
      intent: 'human_request',
      language: 'en',
      replyText: 'I completely understand your frustration. I am handing this conversation over to a senior team member right away to assist you directly.',
      rationale: 'Complaint detected: sales stopped, immediate handover triggered',
      extractedFields: {},
      missingFields: [],
      questionsAnswered: [],
      leadStatus: 'handover_requested',
      statusReason: 'Customer expressed frustration regarding delay; paused AI and escalated to staff',
      humanReviewRequired: true,
      humanReviewReason: 'Customer complaint / escalation',
      safetyFlags: ['customer_frustration'],
    };
    const parsed = AIQualificationResultSchema.parse(complaintOutput);
    expect(parsed.leadStatus).toBe('handover_requested');
    expect(parsed.humanReviewRequired).toBe(true);
    expect(parsed.safetyFlags).toContain('customer_frustration');
  });

  it('Scenario 11: Business Setup expert matching enforces explicit permission gate', () => {
    const permissionGateOutput = {
      intent: 'business_setup',
      language: 'en',
      replyText: 'We work with verified partners specializing in tech setups in Dubai. May I have your permission to share your enquiry details with them for a direct introduction?',
      rationale: 'Explicit permission requested before external expert introduction',
      extractedFields: {
        serviceVertical: 'business_setup',
        workBusinessActivity: 'Software SaaS Agency',
        targetEmirate: 'Dubai',
      },
      missingFields: ['externalSharingPermission'],
      questionsAnswered: ['workBusinessActivity', 'targetEmirate'],
      leadStatus: 'exploring',
      statusReason: 'Tech business setup identified; awaiting consent to share details with verified partner',
      expertMatchCriteria: {
        sector: 'tech',
        language: 'en',
        location: 'dubai',
      },
      humanReviewRequired: false,
      safetyFlags: [],
    };
    const parsed = AIQualificationResultSchema.parse(permissionGateOutput);
    expect(parsed.replyText).toContain('May I have your permission to share your enquiry details');
    expect(parsed.expertMatchCriteria?.sector).toBe('tech');
  });

  it('Scenario 12: Ready for Team status requires relevant request and willingness to proceed', () => {
    const readyForTeamOutput = {
      intent: 'residency',
      language: 'en',
      replyText: 'Thank you, Zayed! Our team will review your freelance permit file and message you on WhatsApp with the confirmed options and costs shortly.',
      rationale: 'Consultation agreed, contact details collected, handing over to team',
      extractedFields: {
        fullName: 'Zayed Al Mansoori',
        phoneOrEmail: '+971501234567',
        serviceVertical: 'residency',
        residencyIntent: 'permit_with_residency',
        workBusinessActivity: 'Digital Marketing',
        uaeLocationContext: 'inside_uae',
        contactMethodPreference: 'whatsapp',
        contactPermission: true,
      },
      missingFields: [],
      questionsAnswered: ['fullName', 'phoneOrEmail', 'contactMethodPreference'],
      leadStatus: 'ready_for_team',
      statusReason: 'Customer agreed to team review of freelance permit costs and provided WhatsApp number',
      humanReviewRequired: false,
      safetyFlags: [],
    };
    const parsed = AIQualificationResultSchema.parse(readyForTeamOutput);
    expect(parsed.leadStatus).toBe('ready_for_team');
    expect(parsed.extractedFields.contactPermission).toBe(true);
    expect(parsed.statusReason).toContain('agreed to team review');
  });
});
