// ============================================================
// notifiche.js — AIA Sezione Valdarno
// Gestione notifiche push (Web Push API) ed email (Edge Functions)
// ============================================================

import { supabase } from './supabase-client.js';

const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY'; // da configurare

/**
 * Converte una stringa base64url in Uint8Array (necessario per VAPID).
 */
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

/**
 * Richiede il permesso per le notifiche push e salva la subscription in Supabase.
 * @param {string} userId
 * @returns {Promise<boolean>} true se attivate correttamente
 */
export async function richiediPermesso(userId) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push non supportato da questo browser.');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const subJson = subscription.toJSON();
    const { error } = await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
    }, { onConflict: 'user_id' });

    if (error) throw error;
    return true;
  } catch (err) {
    console.error('Errore richiediPermesso:', err);
    return false;
  }
}

/**
 * Invia una notifica push tramite Edge Function.
 * @param {string} userId
 * @param {string} titolo
 * @param {string} messaggio
 */
export async function inviaNotificaPush(userId, titolo, messaggio) {
  // Recupera la subscription dell'utente
  const { data: sub, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId)
    .single();

  if (error || !sub) return;

  await supabase.functions.invoke('send-push', {
    body: {
      endpoint: sub.endpoint,
      p256dh: sub.p256dh,
      auth: sub.auth,
      titolo,
      messaggio,
    },
  });
}

/**
 * Invia una notifica email tramite Edge Function.
 * @param {string} userId
 * @param {string} titolo
 * @param {string} messaggio
 * @param {string} [eventoData]
 */
export async function inviaNotificaEmail(userId, titolo, messaggio, eventoData = '') {
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('email, full_name, notifiche_email')
    .eq('id', userId)
    .single();

  if (error || !profile || !profile.notifiche_email) return;

  await supabase.functions.invoke('send-email', {
    body: {
      email: profile.email,
      nome: profile.full_name || 'Arbitro',
      titolo,
      messaggio,
      evento_data: eventoData,
    },
  });
}

/**
 * Notifica tutti gli arbitri per un nuovo evento.
 * Crea record in-app, invia push e email per ogni arbitro.
 * @param {string} eventId
 */
export async function notificaArbitri(eventId) {
  // Recupera l'evento
  const { data: evento, error: evErr } = await supabase
    .from('events')
    .select('*')
    .eq('id', eventId)
    .single();
  if (evErr || !evento) return;

  // Recupera tutti gli arbitri con notifiche attive
  const { data: arbitri, error: arErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, notifiche_email')
    .eq('role', 'arbitro');
  if (arErr || !arbitri?.length) return;

  const titolo = `Nuovo evento: ${evento.title}`;
  const messaggio = `${evento.type} il ${evento.date}${evento.time ? ' alle ' + evento.time : ''}${evento.notes ? ' — ' + evento.notes : ''}`;

  for (const arbitro of arbitri) {
    // Notifica in-app
    await supabase.from('notifiche').insert([{
      user_id: arbitro.id,
      event_id: eventId,
      messaggio: `${titolo}: ${messaggio}`,
    }]);

    // Push (se ha subscription)
    await inviaNotificaPush(arbitro.id, titolo, messaggio);

    // Email (se ha notifiche_email = true)
    if (arbitro.notifiche_email) {
      await inviaNotificaEmail(arbitro.id, titolo, messaggio, evento.date);
    }
  }
}

/**
 * Carica le notifiche non lette dell'utente corrente.
 * @param {string} userId
 * @returns {Promise<Array>}
 */
export async function getNotificheNonLette(userId) {
  const { data, error } = await supabase
    .from('notifiche')
    .select('*, events(*)')
    .eq('user_id', userId)
    .eq('letta', false)
    .order('created_at', { ascending: false });

  if (error) { console.error('Errore getNotifiche:', error.message); return []; }
  return data || [];
}

/**
 * Segna una notifica come letta.
 * @param {string} notificaId
 */
export async function segnaComeLetta(notificaId) {
  await supabase.from('notifiche').update({ letta: true }).eq('id', notificaId);
}
