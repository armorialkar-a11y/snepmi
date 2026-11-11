-- Add Irina to an existing catalogue, leaving all existing records untouched.
-- On a new empty database the normal seed inserts the complete catalogue instead.
INSERT INTO bloggers
  (id, name, image_url, social_url, platform, social_links, topics, audience, geography,
   image_kind, published, sort_order, category, ad_contact)
SELECT 'eb14420a-b50e-45f2-b0bb-e812a0977ff2'::uuid, 'Ирина Тихомирова', '/images/bloggers/eb14420a.webp', 'https://t.me/tihomirno_obo_vsem',
       'Telegram', '[{"platform": "Telegram", "url": "https://t.me/tihomirno_obo_vsem"}, {"platform": "Instagram", "url": "https://www.instagram.com/irina.tiho.mirova"}]'::jsonb, '["семейный лайфстайл", "материнство", "дети", "семья", "повседневная жизнь", "личный блог"]'::jsonb,
       'Женщины 25–40 (предположительно)', 'Уточняется', 'photo', true, 1000, 'unassigned', 'https://t.me/advmiu'
WHERE EXISTS (SELECT 1 FROM bloggers)
  AND NOT EXISTS (
    SELECT 1 FROM bloggers b
    WHERE lower(rtrim(coalesce(b.social_url, ''), '/')) IN
          ('https://t.me/tihomirno_obo_vsem', 'https://www.instagram.com/irina.tiho.mirova')
       OR EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(b.social_links, '[]'::jsonb)) AS link
                  WHERE lower(rtrim(coalesce(link->>'url', ''), '/')) IN
                    ('https://t.me/tihomirno_obo_vsem', 'https://www.instagram.com/irina.tiho.mirova'))
  )
ON CONFLICT (id) DO NOTHING;
