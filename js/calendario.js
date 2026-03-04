// ============================================================
// calendario.js — AIA Sezione Valdarno
// Griglia mensile interattiva con eventi da Supabase
// ============================================================

import { supabase } from './supabase-client.js';
import { getSession, getUserProfile } from './supabase-client.js';

const MESI = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno',
               'Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre'];
const GIORNI = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

const TIPO_COLORS = {
  Raduno: { dot: 'dot-raduno', badge: 'badge-blue', border: '#3498db' },
  RTO:    { dot: 'dot-rto',    badge: 'badge-green', border: '#27ae60' },
  Corso:  { dot: 'dot-corso',  badge: 'badge-orange', border: '#e67e22' },
  Partita:{ dot: 'dot-partita',badge: 'badge-red', border: '#e74c3c' },
  Altro:  { dot: 'dot-altro',  badge: 'badge-gray', border: '#888888' },
};

let currentYear = new Date().getFullYear();
let currentMonth = new Date().getMonth(); // 0-based
let allEvents = [];
let userRole = 'pubblico';
let isAdminMode = false;

/**
 * Inizializza il calendario nella pagina.
 * @param {string} containerId - ID del div contenitore
 * @param {boolean} adminMode - true = admin può aggiungere/modificare eventi
 */
export async function initCalendario(containerId, adminMode = false) {
  isAdminMode = adminMode;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      const profile = await getUserProfile(session.user.id);
      userRole = profile?.role ?? 'pubblico';
    }
    await loadEvents();
  } catch (err) {
    console.warn('Supabase non raggiungibile, calendario vuoto:', err?.message ?? err);
    allEvents = [];
  }

  renderCalendar(containerId);
}

async function loadEvents() {
  let query = supabase.from('events').select('*').order('date', { ascending: true });

  if (userRole === 'pubblico') {
    query = query.eq('visibile_a', 'tutti');
  } else if (userRole === 'arbitro') {
    query = query.in('visibile_a', ['tutti', 'arbitri']);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  allEvents = data || [];
}

function renderCalendar(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = `
    <div class="cal-wrapper">
      ${renderNav()}
      ${renderLegenda()}
      ${renderGrid()}
    </div>
  `;

  // Event listeners nav
  container.querySelector('#cal-prev').addEventListener('click', () => {
    currentMonth--;
    if (currentMonth < 0) { currentMonth = 11; currentYear--; }
    renderCalendar(containerId);
  });
  container.querySelector('#cal-next').addEventListener('click', () => {
    currentMonth++;
    if (currentMonth > 11) { currentMonth = 0; currentYear++; }
    renderCalendar(containerId);
  });
  container.querySelector('#cal-today').addEventListener('click', () => {
    currentYear = new Date().getFullYear();
    currentMonth = new Date().getMonth();
    renderCalendar(containerId);
  });

  // Click su giorni
  container.querySelectorAll('.cal-day:not(.empty)').forEach(dayEl => {
    dayEl.addEventListener('click', () => {
      const dateStr = dayEl.dataset.date;
      const eventsForDay = allEvents.filter(e => e.date === dateStr);
      showDayPopup(dateStr, eventsForDay, containerId);
    });
  });

  // Pulsante aggiungi evento (solo admin mode)
  if (isAdminMode) {
    const addBtn = container.querySelector('#cal-add-event');
    if (addBtn) addBtn.addEventListener('click', () => showEventForm(null, containerId));
  }
}

function renderNav() {
  const addBtn = isAdminMode
    ? `<button id="cal-add-event" class="btn btn-primary btn-sm">+ Aggiungi Evento</button>`
    : '';
  return `
    <div class="cal-nav">
      <h2>${MESI[currentMonth]} ${currentYear}</h2>
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
        ${addBtn}
        <div class="cal-nav-btns">
          <button id="cal-prev" class="btn btn-secondary btn-sm">&#8592;</button>
          <button id="cal-today" class="btn btn-secondary btn-sm">Oggi</button>
          <button id="cal-next" class="btn btn-secondary btn-sm">&#8594;</button>
        </div>
      </div>
    </div>
  `;
}

function renderLegenda() {
  return `
    <div class="legenda">
      ${Object.entries(TIPO_COLORS).map(([tipo, c]) => `
        <div class="legenda-item">
          <span class="legenda-dot ${c.dot}"></span>
          <span>${tipo}</span>
        </div>
      `).join('')}
    </div>
  `;
}

function renderGrid() {
  const firstDay = new Date(currentYear, currentMonth, 1);
  const lastDay = new Date(currentYear, currentMonth + 1, 0);
  const today = new Date().toISOString().split('T')[0];

  // Giorno della settimana del primo giorno (0=Dom, adatto a Lun=0)
  let startDow = firstDay.getDay(); // 0=Dom
  startDow = (startDow + 6) % 7; // trasformo in Lun=0

  const cells = [];

  // Celle vuote iniziali
  for (let i = 0; i < startDow; i++) {
    cells.push('<div class="cal-day empty"></div>');
  }

  // Giorni del mese
  for (let d = 1; d <= lastDay.getDate(); d++) {
    const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const dayEvents = allEvents.filter(e => e.date === dateStr);
    const isToday = dateStr === today;

    const dots = dayEvents.slice(0, 4).map(e => {
      const color = TIPO_COLORS[e.type] || TIPO_COLORS.Altro;
      return `<span class="cal-event-dot ${color.dot}" title="${e.title}"></span>`;
    }).join('');

    cells.push(`
      <div class="cal-day${isToday ? ' today' : ''}" data-date="${dateStr}">
        <div class="cal-day-num">${d}</div>
        <div class="cal-events-dots">${dots}</div>
      </div>
    `);
  }

  const headers = GIORNI.map(g => `<div class="cal-day-header">${g}</div>`).join('');

  return `
    <div class="cal-grid">
      ${headers}
      ${cells.join('')}
    </div>
  `;
}

function showDayPopup(dateStr, events, containerId) {
  const existing = document.getElementById('day-popup');
  if (existing) existing.remove();

  const [year, month, day] = dateStr.split('-');
  const label = `${parseInt(day)} ${MESI[parseInt(month) - 1]} ${year}`;

  const eventsHtml = events.length === 0
    ? '<p style="color:var(--grigio);font-size:0.9rem;padding:8px 0;">Nessun evento in questo giorno.</p>'
    : events.map(e => {
        const c = TIPO_COLORS[e.type] || TIPO_COLORS.Altro;
        const adminActions = isAdminMode ? `
          <div style="margin-top:10px;display:flex;gap:8px;">
            <button class="btn btn-sm btn-secondary" onclick="editEvent('${e.id}')">Modifica</button>
            <button class="btn btn-sm btn-danger" onclick="deleteEvent('${e.id}')">Elimina</button>
          </div>` : '';
        return `
          <div style="border-left:3px solid ${c.border};padding:12px 14px;background:var(--grigio-pale);border-radius:0 8px 8px 0;margin-bottom:10px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;flex-wrap:wrap;">
              <span class="badge ${c.badge}">${e.type}</span>
              ${e.time ? `<span style="color:var(--grigio);font-size:0.82rem;">⏰ ${e.time}</span>` : ''}
            </div>
            <h4 style="margin-bottom:4px;color:var(--testo);font-size:1rem;">${e.title}</h4>
            ${e.notes ? `<p style="color:var(--grigio);font-size:0.85rem;margin-top:4px;">${e.notes}</p>` : ''}
            ${adminActions}
          </div>
        `;
      }).join('');

  const popup = document.createElement('div');
  popup.id = 'day-popup';
  popup.className = 'modal-overlay active';
  popup.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>📅 ${label}</h3>
        <button class="modal-close" id="close-day-popup">&times;</button>
      </div>
      <div>${eventsHtml}</div>
      ${isAdminMode ? `<div style="margin-top:16px;"><button class="btn btn-primary btn-sm" onclick="showEventFormDate('${dateStr}', '${containerId}')">+ Aggiungi evento in questo giorno</button></div>` : ''}
    </div>
  `;

  document.body.appendChild(popup);
  popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });
  popup.querySelector('#close-day-popup').addEventListener('click', () => popup.remove());
}

function showEventForm(event, containerId, prefillDate = '') {
  const existing = document.getElementById('event-form-popup');
  if (existing) existing.remove();

  const isEdit = !!event;
  const title = isEdit ? 'Modifica Evento' : 'Nuovo Evento';

  const popup = document.createElement('div');
  popup.id = 'event-form-popup';
  popup.className = 'modal-overlay active';
  popup.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>${title}</h3>
        <button class="modal-close" id="close-event-form">&times;</button>
      </div>
      <form id="event-form">
        <div class="form-group">
          <label>Titolo *</label>
          <input type="text" id="ef-title" required value="${event?.title || ''}" placeholder="Es. Raduno mensile">
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label>Data *</label>
            <input type="date" id="ef-date" required value="${event?.date || prefillDate}">
          </div>
          <div class="form-group">
            <label>Ora</label>
            <input type="time" id="ef-time" value="${event?.time || ''}">
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
          <div class="form-group">
            <label>Tipo</label>
            <select id="ef-type">
              ${['Raduno','RTO','Corso','Partita','Altro'].map(t =>
                `<option value="${t}" ${event?.type === t ? 'selected' : ''}>${t}</option>`
              ).join('')}
            </select>
          </div>
          <div class="form-group">
            <label>Visibile a</label>
            <select id="ef-visibile">
              <option value="tutti" ${event?.visibile_a === 'tutti' ? 'selected' : ''}>Tutti</option>
              <option value="arbitri" ${event?.visibile_a === 'arbitri' ? 'selected' : ''}>Arbitri</option>
              <option value="admin" ${event?.visibile_a === 'admin' ? 'selected' : ''}>Solo Admin</option>
            </select>
          </div>
        </div>
        <div class="form-group">
          <label>Note</label>
          <textarea id="ef-notes" placeholder="Note aggiuntive...">${event?.notes || ''}</textarea>
        </div>
        <div id="ef-error" class="alert alert-error" style="display:none;"></div>
        <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">
          <button type="button" class="btn btn-secondary" id="cancel-event-form">Annulla</button>
          <button type="submit" class="btn btn-primary">${isEdit ? 'Salva Modifiche' : 'Crea Evento'}</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(popup);
  popup.querySelector('#close-event-form').addEventListener('click', () => popup.remove());
  popup.querySelector('#cancel-event-form').addEventListener('click', () => popup.remove());
  popup.addEventListener('click', e => { if (e.target === popup) popup.remove(); });

  popup.querySelector('#event-form').addEventListener('submit', async e => {
    e.preventDefault();
    const errorEl = popup.querySelector('#ef-error');
    errorEl.style.display = 'none';

    const payload = {
      title: popup.querySelector('#ef-title').value.trim(),
      date: popup.querySelector('#ef-date').value,
      time: popup.querySelector('#ef-time').value || null,
      type: popup.querySelector('#ef-type').value,
      visibile_a: popup.querySelector('#ef-visibile').value,
      notes: popup.querySelector('#ef-notes').value.trim() || null,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from('events').update(payload).eq('id', event.id));
    } else {
      ({ error } = await supabase.from('events').insert([payload]));
    }

    if (error) {
      errorEl.textContent = error.message;
      errorEl.style.display = 'block';
    } else {
      popup.remove();
      const dayPopup = document.getElementById('day-popup');
      if (dayPopup) dayPopup.remove();
      await loadEvents();
      renderCalendar(containerId);
    }
  });
}

// Espone funzioni globali per uso inline nei popup
window.editEvent = async (id) => {
  const event = allEvents.find(e => e.id === id);
  if (event) showEventForm(event, 'calendario-container');
};

window.deleteEvent = async (id) => {
  if (!confirm('Sei sicuro di voler eliminare questo evento?')) return;
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (!error) {
    const popup = document.getElementById('day-popup');
    if (popup) popup.remove();
    await loadEvents();
    renderCalendar('calendario-container');
  }
};

window.showEventFormDate = (dateStr, containerId) => {
  const popup = document.getElementById('day-popup');
  if (popup) popup.remove();
  showEventForm(null, containerId, dateStr);
};
