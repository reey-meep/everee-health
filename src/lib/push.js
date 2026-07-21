import { VAPID_PUBLIC_KEY } from './vapid-public'
import { savePushSubscription, deletePushSubscription } from './db'

// Web Push registration.
//
// Note on scheduling: there is no browser API for scheduling a local
// notification. Chrome's Notification Triggers (showTrigger/TimestampTrigger)
// was abandoned, and a service worker is killed after ~30s idle so setTimeout
// cannot hold a timer for hours. Every scheduled prompt therefore has to be
// sent from the server -- see supabase/functions/send-scheduled-push.

const SW_PATH = `${process.env.PUBLIC_URL || ''}/sw.js`
const SW_SCOPE = `${process.env.PUBLIC_URL || ''}/`

export const pushSupported = () =>
  'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window

export const permission = () => (typeof Notification === 'undefined' ? 'unsupported' : Notification.permission)

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = window.atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export async function registerServiceWorker() {
  if (!pushSupported()) return null
  return navigator.serviceWorker.register(SW_PATH, { scope: SW_SCOPE })
}

export async function getSubscription() {
  if (!pushSupported()) return null
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  if (!reg) return null
  return reg.pushManager.getSubscription()
}

// Returns { ok, reason }. Never throws, so the caller can show a real message
// instead of a silent failure.
export async function enablePush() {
  if (!pushSupported()) return { ok: false, reason: 'This browser does not support push notifications.' }

  const perm = await Notification.requestPermission()
  if (perm !== 'granted') {
    return {
      ok: false,
      reason: perm === 'denied'
        ? 'Notifications are blocked. Enable them for this site in Chrome settings, then try again.'
        : 'Notification permission was dismissed.',
    }
  }

  const reg = await registerServiceWorker()
  if (!reg) return { ok: false, reason: 'Service worker failed to register.' }
  await navigator.serviceWorker.ready

  let sub = await reg.pushManager.getSubscription()
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })
    } catch (e) {
      return { ok: false, reason: `Subscribe failed: ${e?.message || e}` }
    }
  }

  try {
    await savePushSubscription(sub)
  } catch (e) {
    return { ok: false, reason: 'Subscribed, but could not save to the database.' }
  }
  return { ok: true }
}

export async function disablePush() {
  const sub = await getSubscription()
  if (!sub) return { ok: true }
  const endpoint = sub.endpoint
  try { await sub.unsubscribe() } catch (e) { /* fall through -- still drop the row */ }
  try { await deletePushSubscription(endpoint) } catch (e) { return { ok: false, reason: 'Could not remove the saved subscription.' } }
  return { ok: true }
}

// Fires a notification through the worker without the server, to prove the
// delivery path end-to-end before trusting the schedule.
export async function sendTestNotification() {
  const reg = await navigator.serviceWorker.getRegistration(SW_SCOPE)
  if (!reg) return { ok: false, reason: 'Service worker not registered.' }
  await reg.showNotification('everee health', {
    body: 'Test notification — delivery is working.',
    tag: 'everee-test',
    vibrate: [100],
  })
  return { ok: true }
}
