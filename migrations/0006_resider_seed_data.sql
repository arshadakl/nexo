-- ============================================================================
-- Migration: 0006_resider_seed_data.sql
-- Description: Seeds Resider initial knowledge base, escrowed packages, and verified experts
-- ============================================================================

-- Ensure fallback tenant exists
INSERT OR IGNORE INTO tenants (id, name, slug, status, created_at, updated_at)
VALUES ('tenant_default', 'Resider Advisory Default', 'resider-default', 'active', 1700000000000, 1700000000000);

-- 1. Initial Verified Consulting Partners for Business Setup
INSERT OR IGNORE INTO verified_experts (
    id,
    tenant_id,
    full_name,
    organization_name,
    sectors_json,
    languages_json,
    emirates_json,
    services_offered_json,
    is_verified,
    is_available,
    contact_phone,
    contact_email,
    created_at,
    updated_at
) VALUES 
(
    'exp_apex_corp_01',
    'tenant_visa_horizon_default',
    'Shaji Rahman',
    'Apex Corporate Services Dubai',
    '["tech","e-commerce","consulting","general"]',
    '["en","ml","ar"]',
    '["dubai","sharjah","all"]',
    '["freezone_licence","mainland_incorporation","corporate_tax"]',
    1,
    1,
    '+971 50 482 1928',
    'shaji@apexcorp.ae',
    1710000000000,
    1710000000000
),
(
    'exp_crescent_02',
    'tenant_visa_horizon_default',
    'Faisal Al-Nuaimi',
    'Crescent Business Advisory',
    '["trading","f&b","industrial","services"]',
    '["en","ar","ml"]',
    '["dubai","abu_dhabi","all"]',
    '["mainland_licence","commercial_brokerage","pro_services"]',
    1,
    1,
    '+971 52 391 7741',
    'faisal@crescentadvisory.ae',
    1710000000000,
    1710000000000
);

-- Also seed for tenant_default
INSERT OR IGNORE INTO verified_experts (
    id,
    tenant_id,
    full_name,
    organization_name,
    sectors_json,
    languages_json,
    emirates_json,
    services_offered_json,
    is_verified,
    is_available,
    contact_phone,
    contact_email,
    created_at,
    updated_at
) VALUES 
(
    'exp_apex_corp_01_td',
    'tenant_default',
    'Shaji Rahman',
    'Apex Corporate Services Dubai',
    '["tech","e-commerce","consulting","general"]',
    '["en","ml","ar"]',
    '["dubai","sharjah","all"]',
    '["freezone_licence","mainland_incorporation","corporate_tax"]',
    1,
    1,
    '+971 50 482 1928',
    'shaji@apexcorp.ae',
    1710000000000,
    1710000000000
);

-- 2. Initial Business Knowledge Items & Escrowed Packages (Section 9 Guardrails)
-- Note: The 3 draft prices must NOT be quoted unless approved by client (is_approved_by_client = 0)
INSERT OR IGNORE INTO business_knowledge_items (
    id,
    tenant_id,
    category,
    title,
    content,
    price_aed,
    is_approved_by_client,
    approval_notes,
    created_at,
    updated_at
) VALUES
(
    'pkg_long_term_permit',
    'tenant_visa_horizon_default',
    'residency_package',
    'Long-Term Residency Package (Permit + Residency)',
    'Comprehensive UAE long-term permit with full 2-year residency visa processing, establishment card, and medical/biometrics coordination.',
    7250.0,
    0,
    'Client Approval Required: Section 9 price shield active (AED 7,000–7,500). AI strictly prohibited from quoting until toggled approved.',
    1710000000000,
    1710000000000
),
(
    'pkg_freelance_visa',
    'tenant_visa_horizon_default',
    'residency_package',
    'Freelance Permit & Residency Visa Program',
    'Official freelance permit, establishment card, entry permit, and residency visa stamping for independent consultants and creators.',
    7500.0,
    0,
    'Client Approval Required: Section 9 price shield active (Starts from AED 7,500). AI strictly prohibited from quoting until toggled approved.',
    1710000000000,
    1710000000000
),
(
    'pkg_residency_visa_only',
    'tenant_visa_horizon_default',
    'residency_package',
    'Specialized Residency Visa Only Program',
    'Residency visa processing pathway for entrepreneurs with existing permits or investor setups, including priority medical and Emirates ID VIP biometrics.',
    17500.0,
    0,
    'Client Approval Required: Section 9 price shield active (AED 15,000–20,000). AI strictly prohibited from quoting until toggled approved.',
    1710000000000,
    1710000000000
),
(
    'pol_residency_stages',
    'tenant_visa_horizon_default',
    'policy',
    '6 UAE Residency Delivery Stages',
    'Our residency service follows 6 delivery stages: 1) Initial profile check, 2) Entry permit, 3) Status change, 4) Medical fitness test, 5) Emirates ID biometrics, 6) Residency visa stamping. We provide two distinct pathways: Permit with Residency or Residency Only.',
    NULL,
    1,
    'Standard operational service delivery policy approved for prompt injection.',
    1710000000000,
    1710000000000
),
(
    'pol_expert_handover',
    'tenant_visa_horizon_default',
    'business_service',
    'Verified Business Setup Partner Matching',
    'Resider connects qualified business setup enquiries with verified consulting partners based on sector activity, preferred language, and target Emirate. Specific license fees are never promised in chat without verified partner review, and explicit customer consent is mandatory before sharing contact details.',
    NULL,
    1,
    'Standard business setup handover protocol approved for prompt injection.',
    1710000000000,
    1710000000000
);
