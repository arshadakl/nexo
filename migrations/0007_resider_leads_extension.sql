-- Migration 0007: RESIDER Leads Extension
-- Adds explicit fields for current location, nationality, profession, WhatsApp details, and confusions/unanswered questions tracking

ALTER TABLE leads ADD COLUMN current_location TEXT;
ALTER TABLE leads ADD COLUMN nationality TEXT;
ALTER TABLE leads ADD COLUMN profession TEXT;
ALTER TABLE leads ADD COLUMN whatsapp_number TEXT;
ALTER TABLE leads ADD COLUMN whatsapp_same_as_phone INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN whatsapp_contact_permission INTEGER DEFAULT 0;
ALTER TABLE leads ADD COLUMN unanswered_questions_json TEXT;
ALTER TABLE leads ADD COLUMN confusions_json TEXT;
