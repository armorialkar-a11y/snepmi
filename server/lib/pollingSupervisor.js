/** Keep a Telegram polling rejection from becoming an unhandled server crash.
 * A rolling deploy may briefly have two pollers for the same bot token.
 * Persistent 409s still need the extra bot process stopped by the operator.
 */
export function createPollingSupervisor(bot, { log = console, wait = interruptibleWait } = {}) {
  const controller = new AbortController();
  const { signal } = controller;
  const done = (async () => {
    let conflicts = 0;
    while (!signal.aborted) {
      try {
        await bot.start();
        return true;
      } catch (error) {
        if (signal.aborted) return false;
        if (error?.error_code !== 409) {
          log.error(`Telegram polling stopped (code ${Number(error?.error_code) || 'unknown'}). Web server remains running; check bot configuration.`);
          return false;
        }
        const delay = Math.min(30_000, 5_000 * 2 ** Math.min(conflicts++, 3));
        log.warn(`Telegram polling conflict (409): another process uses this bot. Retrying in ${delay / 1000}s. If this persists, stop the duplicate bot process.`);
        await wait(delay, signal);
      }
    }
    return false;
  })();
  return {
    done,
    async stop() {
      controller.abort();
      if (bot.isRunning()) {
        try { await bot.stop(); }
        catch (error) {
          // grammy confirms the last offset during stop, which may also see 409.
          if (error?.error_code !== 409) log.warn('Telegram polling shutdown could not confirm the last update offset.');
        }
      }
      await done;
    },
  };
}

function interruptibleWait(ms, signal) {
  if (signal.aborted) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => { clearTimeout(timer); signal.removeEventListener('abort', finish); resolve(); };
    const timer = setTimeout(finish, ms);
    signal.addEventListener('abort', finish, { once: true });
  });
}
