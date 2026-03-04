// ============================================================
// supabase-client.js — AIA Sezione Valdarno
// Inizializza il client Supabase ed esporta le utility base
// ============================================================

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://pljtgyzzuvggcvgxinlz.supabase.co';
const SUPABASE_KEY = 'sb_publishable_fxsuCWDUbfyHle9Wa0qkHg_KYFm3tVX';

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

/**
 * Recupera il profilo completo di un utente dalla tabella `profiles`.
 * @param {string} userId - UUID dell'utente
 * @returns {Promise<object|null>}
 */
export async function getUserProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    console.error('Errore getUserProfile:', error.message);
    return null;
  }
  return data;
}

/**
 * Restituisce il ruolo dell'utente corrente, o 'pubblico' se non autenticato.
 * @returns {Promise<string>}
 */
export async function getCurrentRole() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return 'pubblico';
  const profile = await getUserProfile(session.user.id);
  return profile?.role ?? 'pubblico';
}
