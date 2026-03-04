// ============================================================
// auth.js — AIA Sezione Valdarno
// Gestione autenticazione, ruoli e navbar dinamica
// ============================================================

import { supabase, getUserProfile } from './supabase-client.js';

const ROLE_REDIRECTS = {
  superadmin: '/admin/dashboard.html',
  admin: '/admin/eventi.html',
  arbitro: '/arbitro/area-personale.html',
  pubblico: '/index.html',
};

/**
 * Effettua il login con email e password.
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };

  const profile = await getUserProfile(data.user.id);
  const role = profile?.role ?? 'pubblico';
  const redirect = ROLE_REDIRECTS[role] ?? '/index.html';
  window.location.href = redirect;
  return { success: true, error: null };
}

/**
 * Effettua il logout e reindirizza a index.html.
 */
export async function logout() {
  await supabase.auth.signOut();
  window.location.href = '/index.html';
}

/**
 * Restituisce la sessione corrente.
 * @returns {Promise<object|null>}
 */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/**
 * Controlla che l'utente abbia uno dei ruoli specificati.
 * Se non autenticato o non autorizzato, reindirizza.
 * @param {string[]} rolesArray
 * @returns {Promise<object>} profile
 */
export async function requireRole(rolesArray) {
  const session = await getSession();
  if (!session) {
    window.location.href = '/login.html';
    return null;
  }
  const profile = await getUserProfile(session.user.id);
  if (!profile || !rolesArray.includes(profile.role)) {
    window.location.href = '/index.html';
    return null;
  }
  return profile;
}

/**
 * Inizializza la navbar in base al ruolo utente.
 * Mostra/nasconde voci di menu in base all'attributo data-role.
 */
export async function initNavbar() {
  const session = await getSession();
  let role = 'pubblico';
  let profile = null;

  if (session) {
    profile = await getUserProfile(session.user.id);
    role = profile?.role ?? 'pubblico';
  }

  // Mostra/nascondi elementi con data-role
  document.querySelectorAll('[data-role]').forEach(el => {
    const allowedRoles = el.dataset.role.split(',').map(r => r.trim());
    const show = allowedRoles.includes(role) ||
                 (allowedRoles.includes('auth') && session) ||
                 (allowedRoles.includes('guest') && !session);
    el.style.display = show ? '' : 'none';
  });

  // Nome utente in navbar
  const nameEl = document.querySelector('[data-user-name]');
  if (nameEl && profile) {
    nameEl.textContent = profile.full_name || profile.email;
  }

  // Logout button
  document.querySelectorAll('[data-action="logout"]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      logout();
    });
  });

  // Hamburger menu toggle
  const toggle = document.getElementById('navbar-toggle');
  const nav = document.getElementById('navbar-nav');
  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
    });
  }

  return { role, profile, session };
}
