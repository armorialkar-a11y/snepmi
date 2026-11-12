import { randomUUID } from 'node:crypto';
import { query } from '../db/pool.js';
import { notifyNewLead } from '../bot.js';

// A short lease and a unique token prevent a late worker from deleting a job
// that another instance has reclaimed. No lead content is stored in the queue.
export async function claimNotification(dbQuery = query) {
  const token = randomUUID();
  const { rows } = await dbQuery(`
    WITH candidate AS (
      SELECT lead_id FROM lead_notification_outbox
      WHERE next_attempt_at <= now() AND (locked_until IS NULL OR locked_until <= now())
      ORDER BY next_attempt_at, lead_id
      FOR UPDATE SKIP LOCKED LIMIT 1
    ), claimed AS (
      UPDATE lead_notification_outbox AS o
      SET attempts = o.attempts + 1, locked_until = now() + interval '2 minutes', lease_token = $1::uuid
      FROM candidate c WHERE o.lead_id = c.lead_id
      RETURNING o.lead_id, o.attempts, o.lease_token
    )
    SELECT l.id, l.name, l.company, l.contact, l.budget, l.launch_date, l.task,
           l.blogger_names AS names, c.attempts, c.lease_token
    FROM claimed c JOIN leads l ON l.id = c.lead_id`, [token]);
  return rows[0] || null;
}

export async function finishNotification(job, dbQuery = query) {
  await dbQuery('DELETE FROM lead_notification_outbox WHERE lead_id = $1 AND lease_token = $2::uuid', [job.id, job.lease_token]);
}

export function retryDelaySeconds(attempts) {
  return Math.min(3600, 15 * 2 ** Math.min(Math.max(Number(attempts) - 1, 0), 8));
}

export async function rescheduleNotification(job, dbQuery = query) {
  await dbQuery(`UPDATE lead_notification_outbox
    SET next_attempt_at = now() + ($3::integer * interval '1 second'), locked_until = NULL, lease_token = NULL
    WHERE lead_id = $1 AND lease_token = $2::uuid`, [job.id, job.lease_token, retryDelaySeconds(job.attempts)]);
}

// Telegram can accept a message just before the process dies; the retry can then
// produce a duplicate. Delivery is at-least-once, not exactly-once.
export async function processNotification({ claim = claimNotification, send = notifyNewLead, finish = finishNotification, retry = rescheduleNotification } = {}) {
  const job = await claim();
  if (!job) return false;
  let sent = false;
  try { sent = await send(job); }
  catch (error) { console.error('notification attempt failed:', error.message); }
  if (sent) await finish(job);
  else await retry(job);
  return true;
}

export function startNotificationWorker({ process = processNotification, intervalMs = 15000, log = console } = {}) {
  let stopped = false;
  let timer;
  let running = Promise.resolve();
  const tick = () => {
    if (stopped) return;
    running = (async () => {
      try {
        // Bound work per tick, so the server remains responsive after an outage.
        for (let i = 0; i < 10 && !stopped; i++) if (!(await process())) break;
      } catch (error) { log.error('notification queue failed:', error.message); }
      if (!stopped) { timer = setTimeout(tick, intervalMs); timer.unref?.(); }
    })();
  };
  tick();
  return { async stop() { stopped = true; clearTimeout(timer); await running; } };
}
