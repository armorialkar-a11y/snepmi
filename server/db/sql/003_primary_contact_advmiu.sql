-- Change the agency's primary contact without touching other settings or data.
UPDATE settings SET telegram = 'https://t.me/advmiu' WHERE id = 1;
-- Replace only the retired agency contact; keep any other individual contacts.
UPDATE bloggers SET ad_contact = 'https://t.me/advmiu'
WHERE trim(ad_contact) ~* '^(https?://)?(www\.)?(t\.me|telegram\.me)/nesssvt/?(\?.*)?$';
