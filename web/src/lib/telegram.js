/**
 * Thin wrapper over the Telegram Mini Apps SDK (telegram-web-app.js).
 * Every helper degrades to plain browser behaviour when the app is opened
 * outside Telegram, so the same build works as a website.
 */

const sdk = () => (typeof window === 'undefined' ? null : window.Telegram?.WebApp ?? null);

/** Older clients ignore (and loudly warn about) methods they do not implement yet. */
function atLeast(version) {
  const tg = sdk();
  return !tg?.isVersionAtLeast || tg.isVersionAtLeast(version);
}

export function initDataRaw() {
  return sdk()?.initData || '';
}

export function isMiniApp() {
  const tg = sdk();
  return Boolean(tg && tg.initData && tg.initData.length > 20 && tg.platform !== 'unknown');
}

export function currentUser() {
  const tg = sdk();
  return tg?.initDataUnsafe?.user ?? null;
}

export function startParam() {
  const tg = sdk();
  if (tg?.initDataUnsafe?.start_param) return tg.initDataUnsafe.start_param;
  // The SDK can still be initialising on a cold launch; Telegram also puts the
  // payload in the query string as `?startapp=`.
  return new URLSearchParams(window.location.search).get('startapp') || '';
}

export function ready() {
  const tg = sdk();
  if (!tg) return;
  try {
    tg.ready();
    tg.expand();
    if (atLeast('6.9')) tg.setHeaderColor?.('#ffffff');
    if (atLeast('7.4')) tg.setBackgroundColor?.('#ffffff');
  } catch {
    /* SDK can be half-initialised in desktop previews */
  }
}

export function haptic(kind = 'light') {
  if (!atLeast('6.1')) return;
  const impact = { light: 'light', medium: 'medium', heavy: 'heavy' };
  const notification = { success: 'success', error: 'error', warning: 'warning' };
  const tg = sdk();
  if (notification[kind]) tg?.HapticFeedback?.notificationOccurred?.(notification[kind]);
  else tg?.HapticFeedback?.impactOccurred?.(impact[kind] || 'light');
}

/** Sends an arbitrary payload back to the bot through the Mini App. */
export function sendData(payload) {
  const tg = sdk();
  if (tg?.sendData && atLeast('6.9')) {
    try {
      tg.sendData(typeof payload === 'string' ? payload : JSON.stringify(payload));
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

function isTelegramLink(url) {
  try {
    const host = new URL(url).hostname;
    return host === 't.me' || host.endsWith('.t.me') || host === 'telegram.dog';
  } catch {
    return false;
  }
}

export function openLink(url) {
  if (!url) return;
  const tg = sdk();
  if (isTelegramLink(url) && tg?.openTelegramLink && atLeast('6.1')) {
    tg.openTelegramLink(url);
    return;
  }
  // openLink landed in SDK 6.4; older clients warn and swallow the call, which
  // would leave the user staring at an unresponsive button.
  if (tg?.openLink && atLeast('6.4')) {
    tg.openLink(url);
    return;
  }
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function showPopup(title, message, buttons = [{ type: 'ok' }]) {
  const tg = sdk();
  if (tg?.showPopup && atLeast('6.2')) {
    tg.showPopup({ title, message, buttons });
    return true;
  }
  return false;
}

/**
 * `window.confirm` is silently blocked inside Mini App webviews, so destructive
 * actions go through Telegram's own popup and only fall back to the browser one
 * outside of Telegram.
 */
export function confirmAction(message, title = 'Подтверждение') {
  const tg = sdk();
  if (!tg?.showPopup || !atLeast('6.2')) return Promise.resolve(window.confirm(message));
  return new Promise((resolve) => {
    tg.showPopup(
      {
        title,
        message,
        buttons: [
          { type: 'ok', id: 'ok' },
          { type: 'close', id: 'cancel', label: 'Отмена' },
        ],
      },
      (buttonId) => resolve(buttonId === 'ok')
    );
  });
}

export function onBackClick(handler) {
  const tg = sdk();
  // `BackButton` exists in every SDK build, but show()/onClick() only warn and
  // no-op below version 6.1, so gate on the version rather than the property.
  if (!tg?.BackButton || !atLeast('6.1')) return () => {};
  tg.BackButton.show();
  tg.BackButton.onClick(handler);
  return () => {
    tg.BackButton.onClickRemove?.(handler);
    tg.BackButton.hide?.();
  };
}
