ALTER TABLE buyer_revisions ADD COLUMN claim_accepted_at TIMESTAMPTZ;
UPDATE buyer_revisions SET claim_accepted_at = created_at;
ALTER TABLE buyer_revisions ALTER COLUMN claim_accepted_at SET NOT NULL;
