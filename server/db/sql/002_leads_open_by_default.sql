-- The original site accepted enquiries straight away, so lead intake starts open.
-- Admins can still switch it off from the settings tab.
ALTER TABLE settings ALTER COLUMN leads_ready SET DEFAULT true;
UPDATE settings SET leads_ready = true WHERE id = 1;
