// ============================================================
// admin.js — AIA Sezione Valdarno
// CRUD eventi, gestione utenti, inviti magic link
// ============================================================

import { supabase } from './supabase-client.js';
import { notificaArbitri } from './notifiche.js';

// ─────────────────────────────────────────────
// EVENTI
// ─────────────────────────────────────────────

/**
 * Carica tutti gli eventi con filtri opzionali.
 * @param {{ tipo?: string, mese?: string }} filtri
 * @returns {Promise<Array>}
 */
export async function loadEventi(filtri = {}) {
  let query = supabase.from('events').select('*, profiles(full_name)').order('date', { ascending: true });

  if (filtri.tipo && filtri.tipo !== 'tutti') query = query.eq('type', filtri.tipo);
  if (filtri.mese) {
    const [year, month] = filtri.mese.split('-');
    const startDate = `${year}-${month}-01`;
    const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];
    query = query.gte('date', startDate).lte('date', endDate);
  }

  const { data, error } = await query;
  if (error) { console.error('loadEventi:', error.message); return []; }
  return data || [];
}

/**
 * Crea un nuovo evento e notifica gli arbitri.
 * @param {object} payload
 * @returns {Promise<{data: object|null, error: string|null}>}
 */
export async function creaEvento(payload) {
  const { data: { session } } = await supabase.auth.getSession();
  const eventData = { ...payload, created_by: session?.user?.id };

  const { data, error } = await supabase.from('events').insert([eventData]).select().single();
  if (error) return { data: null, error: error.message };

  // Trigger notifica arbitri in background
  notificaArbitri(data.id).catch(console.error);

  return { data, error: null };
}

/**
 * Aggiorna un evento esistente.
 * @param {string} eventId
 * @param {object} payload
 * @returns {Promise<{error: string|null}>}
 */
export async function aggiornaEvento(eventId, payload) {
  const { error } = await supabase.from('events').update(payload).eq('id', eventId);
  return { error: error?.message ?? null };
}

/**
 * Elimina un evento.
 * @param {string} eventId
 * @returns {Promise<{error: string|null}>}
 */
export async function eliminaEvento(eventId) {
  const { error } = await supabase.from('events').delete().eq('id', eventId);
  return { error: error?.message ?? null };
}

// ─────────────────────────────────────────────
// UTENTI
// ─────────────────────────────────────────────

/**
 * Carica tutti i profili utente (solo per superadmin).
 * @returns {Promise<Array>}
 */
export async function loadUtenti() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.error('loadUtenti:', error.message); return []; }
  return data || [];
}

/**
 * Cambia il ruolo di un utente.
 * @param {string} userId
 * @param {string} nuovoRuolo
 * @returns {Promise<{error: string|null}>}
 */
export async function cambiaRuolo(userId, nuovoRuolo) {
  const { error } = await supabase
    .from('profiles')
    .update({ role: nuovoRuolo, updated_at: new Date().toISOString() })
    .eq('id', userId);
  return { error: error?.message ?? null };
}

/**
 * Elimina un utente (tramite admin API — richiede service role key lato Edge Function).
 * Qui eliminiamo solo il profilo; il superadmin dovrà eliminare l'auth user dalla dashboard Supabase.
 * @param {string} userId
 * @returns {Promise<{error: string|null}>}
 */
export async function eliminaUtente(userId) {
  const { error } = await supabase.from('profiles').delete().eq('id', userId);
  return { error: error?.message ?? null };
}

/**
 * Carica le statistiche per la dashboard.
 * @returns {Promise<object>}
 */
export async function loadDashboardStats() {
  const [utentiRes, eventiRes, notificheRes] = await Promise.all([
    supabase.from('profiles').select('role'),
    supabase.from('events').select('id, date'),
    supabase.from('notifiche').select('push_inviata, email_inviata'),
  ]);

  const utenti = utentiRes.data || [];
  const eventi = eventiRes.data || [];
  const notifiche = notificheRes.data || [];

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

  return {
    totaleUtenti: utenti.length,
    perRuolo: {
      superadmin: utenti.filter(u => u.role === 'superadmin').length,
      admin: utenti.filter(u => u.role === 'admin').length,
      arbitro: utenti.filter(u => u.role === 'arbitro').length,
      pubblico: utenti.filter(u => u.role === 'pubblico').length,
    },
    eventiMese: eventi.filter(e => e.date >= startOfMonth && e.date <= endOfMonth).length,
    totaleEventi: eventi.length,
    pushInviate: notifiche.filter(n => n.push_inviata).length,
    emailInviate: notifiche.filter(n => n.email_inviata).length,
  };
}

// ─────────────────────────────────────────────
// INVITI
// ─────────────────────────────────────────────

/**
 * Invia un magic link di invito a un nuovo arbitro.
 * Usa la Admin API di Supabase (richiede service role key).
 * In questo contesto static, invoca un'Edge Function dedicata.
 * @param {string} email
 * @returns {Promise<{error: string|null}>}
 */
export async function invitaArbitro(email) {
  const { error } = await supabase.functions.invoke('invita-arbitro', {
    body: { email },
  });
  return { error: error?.message ?? null };
}
