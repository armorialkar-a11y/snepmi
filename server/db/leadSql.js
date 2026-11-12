// Insert the lead and its notification together; either both commit or neither does.
export const INSERT_LEAD_SQL = `WITH new_lead AS (
       INSERT INTO leads (name, company, contact, social_url, task, blogger_ids, blogger_names,
                          budget, launch_date, consent, source, tg_user_id, tg_username)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8,$9,$10,$11,$12,$13)
       RETURNING id, created_at
       ), queued AS (
         INSERT INTO lead_notification_outbox (lead_id) SELECT id FROM new_lead RETURNING lead_id
       )
       SELECT n.id, n.created_at FROM new_lead n JOIN queued q ON q.lead_id = n.id`;
