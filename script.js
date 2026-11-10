'use strict';
/* =====================================================================
   Shinobi Chronicles – JDR textuel Naruto propulsé par Gemini
   ===================================================================== */

/* ---------- Utilitaires ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sg  = n => (n > 0 ? '+' : '') + n;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const idSur = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9_]/g, '_').slice(0, 30);
const SAVE_KEY = 'shinobi-v2-save';
const CFG_KEY  = 'shinobi-v2-config';
const STAT_KEYS = ['ninjutsu', 'taijutsu', 'genjutsu', 'fuinjutsu'];
const BUDGET = 100;
const TYPES_OBJ = ['arme', 'parchemin', 'soin', 'equipement', 'autre'];

/* Lieux de la carte (coordonnées en % de l'image) – le MJ choisit l'id, le pion suit */
const LIEUX = [
  { id: 'konoha',    nom: 'Konoha (Village de la Feuille)', x: 42.6, y: 59.9 },
  { id: 'foret',     nom: 'Forêt de la Mort',               x: 43.4, y: 63.0 },
  { id: 'temple',    nom: 'Temple du Feu',                  x: 34.5, y: 55.2 },
  { id: 'vallee',    nom: 'Vallée de la Fin',               x: 45.4, y: 50.4 },
  { id: 'oto',       nom: 'Village du Son (Oto)',           x: 46.2, y: 44.1 },
  { id: 'ryuchi',    nom: 'Grotte de Ryūchi',               x: 48.4, y: 45.3 },
  { id: 'taki',      nom: 'Village de la Cascade',          x: 37.4, y: 44.6 },
  { id: 'yu',        nom: 'Village des Sources Chaudes',    x: 50.8, y: 41.8 },
  { id: 'kusa',      nom: 'Village de l’Herbe',             x: 28.6, y: 54.5 },
  { id: 'ame',       nom: 'Village de la Pluie (Ame)',      x: 27.3, y: 62.0 },
  { id: 'tetsu',     nom: 'Pays du Fer',                    x: 42.8, y: 33.4 },
  { id: 'iwa',       nom: 'Village de la Roche (Iwa)',      x: 24.3, y: 33.0 },
  { id: 'suna',      nom: 'Village du Sable (Suna)',        x: 19.8, y: 86.1 },
  { id: 'kumo',      nom: 'Village des Nuages (Kumo)',      x: 72.2, y: 28.2 },
  { id: 'kiri',      nom: 'Village de la Brume (Kiri)',     x: 82.9, y: 75.4 },
  { id: 'yuki',      nom: 'Pays de la Neige',               x: 56.6, y: 4.0 },
  { id: 'nami',      nom: 'Pays des Vagues',                x: 73.7, y: 46.4 },
  { id: 'myoboku',   nom: 'Mont Myōboku',                   x: 95.3, y: 33.6 },
  { id: 'uzu',       nom: 'Ruines d’Uzushio (tourbillons)', x: 63.5, y: 69.2 },
  { id: 'cimetiere', nom: 'Cimetière de la montagne',       x: 48.0, y: 16.1 }
];

/* ---------- État ---------- */
let CHARS_BASE = [];
let CANON = { debuts: [], evenements: [] };

function etatVide() {
  return {
    cree: false, perso: null,
    stats: {}, pv: { actuel: 100, max: 100 }, chakra: { actuel: 60, max: 60 },
    inventaire: [], position: { id: 'konoha', detail: '' }, visites: [],
    chars: [], canonIndex: 0, divergences: [], memo: [], journal: [],
    histo: [], choix: [], log: [], tour: 1, derniere: null, pendant: [], undo: null
  };
}
let state = etatVide();

const ia = {
  cfg: { mode: 'direct', apiKey: '', proxyUrl: '', model: 'gemini-3.8-flash', fallback: '' },
  busy: false, derniereAction: null, delais: [4000, 10000], timeout: 100000
};
try { Object.assign(ia.cfg, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) {}
if (ia.cfg.model === 'gemini-2.5-flash') ia.cfg.model = 'gemini-3.8-flash';   // ancien modèle retiré par Google
const iaPret = () => ia.cfg.mode === 'proxy' ? !!ia.cfg.proxyUrl : !!ia.cfg.apiKey;

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Sauvegarde impossible', e); }
}

/* ---------- Initialisation ---------- */
async function init() {
  try {
    const [chars, canon] = await Promise.all([
      fetch('data/characters.json').then(r => r.json()),
      fetch('data/canon.json').then(r => r.json())
    ]);
    CHARS_BASE = chars; CANON = canon;
  } catch (e) {
    console.error(e);
    document.body.innerHTML = "<p style='padding:2rem'>Impossible de charger les données. Lance le projet via GitHub Pages ou un serveur local (<code>python -m http.server</code>), pas en double-cliquant sur index.html.</p>";
    return;
  }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  if (saved && saved.cree) {
    state = { ...etatVide(), ...saved };
    CHARS_BASE.forEach(b => { if (!state.chars.some(c => c.id === b.id)) state.chars.push(nouveauPNJ(b)); });
  } else {
    state = etatVide();
    state.chars = CHARS_BASE.map(nouveauPNJ);
  }
  bindUI();
  if (state.cree) { $('#creation').hidden = true; lancerOuReprendre(); }
  else ouvrirCreation();
}
const nouveauPNJ = b => ({ ...b, relation: clamp(Number(b.relation) || 0, -100, 100), rencontre: false, rencontre_tour: 0, dernier: 0, note: '' });

/* ---------- Création de personnage ---------- */
function ouvrirCreation() {
  $('#creation').hidden = false;
  $('#depart').innerHTML = CANON.debuts.map(d => `<option value="${d.id}">${esc(d.titre)}</option>`).join('');
  const maj = () => { const d = CANON.debuts.find(x => x.id === $('#depart').value); $('#depart-desc').textContent = d ? d.description : ''; };
  $('#depart').onchange = maj; maj();
  $('#alloc').innerHTML = STAT_KEYS.map(k => `
    <div class="alloc-row"><span>${cap(k)}</span>
      <input type="range" class="alloc-range" data-k="${k}" min="5" max="50" value="25"><b class="alloc-val">25</b></div>`).join('');
  $$('.alloc-range').forEach(r => r.addEventListener('input', () => majAlloc(r)));
  majAlloc();
}
function majAlloc(changed) {
  const inputs = $$('.alloc-range');
  let total = inputs.reduce((s, r) => s + Number(r.value), 0);
  if (changed && total > BUDGET) { changed.value = Number(changed.value) - (total - BUDGET); total = inputs.reduce((s, r) => s + Number(r.value), 0); }
  inputs.forEach(r => { r.nextElementSibling.textContent = r.value; });
  $('#alloc-reste').textContent = `Points restants : ${BUDGET - total}`;
}
function kitDepart(k) {
  const kit = [
    { id: 'kunai', nom: 'Kunai', type: 'arme', quantite: k === 'eleve' ? 4 : 8, description: 'Lame polyvalente, lancer ou mêlée.' },
    { id: 'shuriken', nom: 'Shuriken', type: 'arme', quantite: k === 'eleve' ? 6 : 15, description: 'Projectiles de précision.' },
    { id: 'trousse', nom: 'Trousse de soins', type: 'soin', quantite: 2, description: 'Bandages et onguents. Restaure 15 PV.', effet: { pv: 15 } }
  ];
  if (k !== 'eleve') kit.push({ id: 'bandeau', nom: 'Bandeau frontal', type: 'equipement', quantite: 1, description: 'Symbole de ton appartenance au village.' });
  if (k !== 'eleve') kit.push({ id: 'pilule_chakra', nom: 'Pilule de chakra', type: 'soin', quantite: 1, description: 'Restaure 25 points de chakra.', effet: { chakra: 25 } });
  if (k === 'chunin') kit.push({ id: 'gilet', nom: 'Gilet tactique', type: 'equipement', quantite: 1, description: 'Nombreuses poches, protection légère.' });
  return kit;
}
function creerPerso(e) {
  e.preventDefault();
  const f = new FormData($('#form-perso'));
  const g = k => String(f.get(k) || '').trim();
  const depart = CANON.debuts.find(d => d.id === g('depart')) || CANON.debuts[0];
  state.perso = {
    prenom: g('prenom'), nom: g('nom'), age: clamp(Number(g('age')) || 12, 6, 60), sexe: g('sexe'),
    clan: g('clan') || 'Aucun', village: g('village') || 'Konohagakure',
    rang: depart.rang, depart: depart.id, departTitre: depart.titre, entourage: g('entourage'),
    apparence: g('apparence'), particularites: g('particularites'), personnalite: g('personnalite'),
    background: g('background'), secret: g('secret')
  };
  STAT_KEYS.forEach(k => { state.stats[k] = Number($(`.alloc-range[data-k="${k}"]`).value); });
  state.pv = { actuel: depart.pv, max: depart.pv };
  state.chakra = { actuel: depart.chakra, max: depart.chakra };
  state.inventaire = kitDepart(depart.kit);
  state.canonIndex = Math.max(0, CANON.evenements.findIndex(ev => ev.id === depart.canon));
  state.position = { id: depart.lieu, detail: depart.lieu_detail || '' };
  state.visites = [depart.lieu];
  state.cree = true;
  state.tour = 1;
  save();
  $('#creation').hidden = true;
  lancerOuReprendre();
}

/* ---------- Lancement / reprise ---------- */
function premierMessage() {
  return "[DÉBUT DE PARTIE] Ouvre l'histoire comme le tout premier épisode de la partie, à partir du point de départ du joueur : plante le décor (lieu, ambiance, heure), fais apparaître naturellement les personnages canoniques de la scène (utilise « rencontre » pour eux) et fixe leurs premières impressions du joueur via « relations ». Ne décide rien à la place du joueur.";
}
function lancerOuReprendre() {
  renderAll(); placePion(); buildMarkers(); rebuildLog(); changeTab('mj');
  if (!iaPret()) {
    mjEcrire('systeme', "⚙️ Configure le Maître du Jeu IA (bouton « ⚙️ IA » en haut à droite) pour commencer l'aventure.", null, null, false);
    $('#mj-choix').innerHTML = '';
    const b = document.createElement('button'); b.className = 'choice'; b.textContent = '⚙️ Configurer l’IA et commencer';
    b.addEventListener('click', async () => { if (await ouvrirReglages()) lancerOuReprendre(); });
    $('#mj-choix').appendChild(b);
    return;
  }
  if (!state.derniere) tourIA(premierMessage(), false);
  else renderChoix();
}

/* ---------- Rendu : fiche, inventaire, relations, journal ---------- */
function bar(label, val, max, cls) {
  const pct = Math.round(clamp(val / max, 0, 1) * 100);
  return `<div class="bar-row"><span>${label}</span><span>${val}${max !== 100 || cls === 'pv' || cls === 'chakra' ? ' / ' + max : ''}</span></div>
          <div class="bar"><div class="fill ${cls}" data-w="${pct}"></div></div>`;
}
function animateBars() {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.fill[data-w]').forEach(f => f.style.width = f.dataset.w + '%')));
}
function renderFiche() {
  const p = state.perso; if (!p) return;
  const lore = (t, v) => v ? `<p class="lore"><b>${t} :</b> ${esc(v)}</p>` : '';
  $('#tab-fiche').innerHTML = `
    <div class="card"><h2>${esc(p.prenom)} ${esc(p.nom)}</h2>
      <dl class="ident">
        <dt>Âge</dt><dd>${p.age} ans · ${esc(p.sexe)}</dd>
        <dt>Clan</dt><dd>${esc(p.clan)}</dd>
        <dt>Village</dt><dd>${esc(p.village)}</dd>
        <dt>Rang</dt><dd>${esc(p.rang)}</dd>
      </dl>
      ${lore('Apparence', p.apparence)}${lore('Particularités', p.particularites)}${lore('Personnalité', p.personnalite)}
      ${lore('Entourage', p.entourage)}${lore('Passé', p.background)}
      ${p.secret ? `<details class="secret-box"><summary>🔒 Background caché (spoiler pour toi !)</summary><p>${esc(p.secret)}</p></details>` : ''}
    </div>
    <div class="card"><h3>Vitalité</h3>
      ${bar('Points de vie', state.pv.actuel, state.pv.max, 'pv')}
      ${bar('Réserve de chakra', state.chakra.actuel, state.chakra.max, 'chakra')}</div>
    <div class="card"><h3>Maîtrise des arts shinobi</h3>
      ${STAT_KEYS.map(k => bar(cap(k), state.stats[k], 100, k)).join('')}</div>`;
  animateBars();
}
function renderInventaire() {
  const types = { arme: '⚔️ Armes', parchemin: '📜 Parchemins', soin: '💊 Soins', equipement: '🛡️ Équipements', autre: '🎒 Divers' };
  const inv = state.inventaire;
  $('#tab-inventaire').innerHTML = Object.entries(types).map(([t, titre]) => {
    const items = inv.filter(o => o.type === t);
    if (!items.length) return '';
    return `<div class="card"><h3>${titre}</h3>${items.map(o => `
      <div class="item"><div><span class="qty">×${o.quantite}</span><strong>${esc(o.nom)}</strong><small>${esc(o.description)}</small></div>
      ${o.effet && (o.effet.pv || o.effet.chakra) ? `<button class="btn" data-use="${esc(o.id)}">Utiliser</button>` : ''}</div>`).join('')}</div>`;
  }).join('') || '<p class="hint">Inventaire vide.</p>';
}
function relColor(v) { const h = v < 0 ? (v + 100) * 0.3 : 30 + v * 0.9; return `hsl(${h} 75% 48%)`; }
function relLabel(v) {
  return v <= -60 ? 'Ennemi juré' : v < -20 ? 'Hostile' : v <= 20 ? 'Neutre' : v < 60 ? 'Amical' : v < 90 ? 'Allié' : 'Lien profond';
}
function renderPNJ() {
  const prev = {};
  $$('#tab-pnj .pnj').forEach(c => { const k = $('.knob', c); if (k) prev[c.dataset.id] = k.style.left; });
  const met = state.chars.filter(c => c.rencontre).sort((a, b) => (a.rencontre_tour || 0) - (b.rencontre_tour || 0));
  $('#tab-pnj').innerHTML = `<p class="hint" style="margin-bottom:.6rem">${met.length} personnage(s) rencontré(s). Les fiches apparaissent au fil de l’histoire et les jauges évoluent selon tes choix.</p>` +
    (met.map(c => {
      const col = relColor(c.relation);
      const d = c.dernier ? `<span class="delta ${c.dernier > 0 ? 'up' : 'down'}">${c.dernier > 0 ? '▲' : '▼'} ${sg(c.dernier)}</span>` : '';
      return `<article class="card pnj" data-id="${esc(c.id)}" style="--rc:${col}">
        <header><h3>${esc(c.prenom)} ${esc(c.nom)}</h3><span class="badge">${esc(c.village)}</span></header>
        <p class="meta">${esc(c.age)} ans · Clan ${esc(c.clan)} · ${esc(c.role)}</p>
        <p>${esc(c.description)}</p>
        ${c.note ? `<p class="pense">💭 ${esc(c.note)}</p>` : ''}
        <div class="rel-head"><span style="color:${col}">${relLabel(c.relation)}</span><strong class="rel-val" style="color:${col}">${sg(c.relation)}%${d}</strong></div>
        <div class="meter"><span class="knob" style="left:${prev[c.id] || '50%'}" data-l="${(c.relation + 100) / 2}%"></span></div>
        <div class="scale"><span>−100%</span><span>0</span><span>+100%</span></div>
      </article>`;
    }).join('') || '<p class="hint">Tu n’as encore rencontré personne.</p>');
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.knob[data-l]').forEach(k => k.style.left = k.dataset.l)));
}
function renderJournal() {
  const paras = t => String(t || '').split(/\n+/).filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('');
  $('#tab-journal').innerHTML = `
    <div class="card journal-head"><h2>📰 Le Journal de Konoha</h2>
      <p class="hint">Chronique du monde : ce qui se passe ailleurs, les conversations entre personnages et les événements majeurs de l’histoire, en dehors de ton point de vue.</p></div>` +
    (state.journal.map(j => `<article class="card news"><div class="news-meta">Tour ${j.tour} · ${esc(j.arc)}</div><h3>${esc(j.titre)}</h3>${paras(j.texte)}</article>`).join('')
      || '<p class="hint">Aucune édition pour l’instant. Le journal se remplira au fil de l’histoire.</p>');
}
function renderHeader() {
  $('#tour-indicator').textContent = 'Tour ' + state.tour;
  const ev = CANON.evenements[state.canonIndex];
  $('#canon-indicator').innerHTML = ev ? `📺 <b>${esc(ev.arc)}</b> · ${esc(ev.titre)}` : '';
  $('#btn-ia').textContent = iaPret() ? '🤖 IA : Gemini' : '⚙️ Activer l’IA';
}
function renderAll() { renderFiche(); renderInventaire(); renderPNJ(); renderJournal(); renderHeader(); majBoutonUndo(); save(); }

/* ---------- Carte : tracker automatique ---------- */
function lieuActuel() { return LIEUX.find(l => l.id === state.position.id) || LIEUX[0]; }
function buildMarkers() {
  const box = $('#markers'); box.innerHTML = '';
  state.visites.forEach(id => {
    const l = LIEUX.find(x => x.id === id); if (!l) return;
    const m = document.createElement('div');
    m.className = 'marker'; m.title = l.nom; m.style.left = l.x + '%'; m.style.top = l.y + '%';
    box.appendChild(m);
  });
}
function placePion() {
  const l = lieuActuel();
  $('#pion').style.left = l.x + '%'; $('#pion').style.top = l.y + '%';
  $('#coord-lieu').textContent = l.nom;
  $('#coord-detail').textContent = state.position.detail ? '— ' + state.position.detail : '';
}

/* ---------- Console du Maître du Jeu ---------- */
function mjEcrire(type, texte, titre, notes, persist = true) {
  const log = $('#mj-log'), d = document.createElement('div');
  d.className = 'msg ' + type;
  if (titre) { const h = document.createElement('h4'); h.textContent = titre; d.appendChild(h); }
  const para = document.createElement('p'); para.textContent = texte; d.appendChild(para);
  if (notes && notes.length) {
    const c = document.createElement('div'); c.className = 'chips';
    notes.forEach(n => { const s = document.createElement('span'); s.className = 'chip ' + n.type; s.textContent = n.txt; c.appendChild(s); });
    d.appendChild(c);
  }
  log.appendChild(d); log.scrollTop = log.scrollHeight;
  if (persist) { state.log.push({ type, texte, titre: titre || null, notes: notes || null }); if (state.log.length > 60) state.log.shift(); }
  return d;
}
function rebuildLog() {
  $('#mj-log').innerHTML = '';
  state.log.forEach(m => mjEcrire(m.type, m.texte, m.titre, m.notes, false));
}
function renderChoix(bloque = false) {
  const box = $('#mj-choix'); box.innerHTML = '';
  state.choix.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice'; b.textContent = `${i + 1}. ${c}`; b.disabled = bloque;
    b.addEventListener('click', () => tourIA(c));
    box.appendChild(b);
  });
}
function renderRetry() {
  renderChoix(false);
  const b = document.createElement('button'); b.className = 'choice'; b.textContent = '↻ Réessayer';
  b.addEventListener('click', () => { const a = ia.derniereAction; if (a) tourIA(a.action, false); });
  $('#mj-choix').prepend(b);
}
function majBoutonUndo() { const b = $('#btn-undo'); if (b) b.disabled = !state.undo || ia.busy; }

/* ---------- Prompt système (reconstruit à chaque tour) ---------- */
function promptSysteme() {
  const p = state.perso, ev = CANON.evenements, i = state.canonIndex;
  const cur = ev[i], prev = ev[i - 1], next = ev.slice(i + 1, i + 4);
  const lieu = lieuActuel();
  const rencontres = state.chars.filter(c => c.rencontre).map(c =>
    `- id "${c.id}" : ${c.prenom} ${c.nom} (${c.role || '?'}, ${c.village}) — relation ${sg(c.relation)} (${relLabel(c.relation)})${c.note ? ' — pense : ' + c.note : ''}`).join('\n') || '(aucun pour l’instant)';
  const inconnus = state.chars.filter(c => !c.rencontre).map(c => `${c.id}=${(c.prenom + ' ' + c.nom).trim()}`).join(', ');
  const inv = state.inventaire.map(o => `${o.id} (${o.nom} ×${o.quantite})`).join(', ') || 'rien';
  const lieux = LIEUX.map(l => `${l.id}=${l.nom}`).join(' ; ');
  const memo = state.memo.slice(-40).map(m => '- ' + m).join('\n') || '(rien encore)';
  const diverg = state.divergences.slice(-25).map(m => '- ' + m).join('\n') || '(aucune : le canon est respecté)';

  return `Tu es le Maître du Jeu d'un JDR textuel solo dans l'univers de NARUTO. Ta mission : faire vivre la série au joueur comme s'il était DANS l'anime, avec un narrateur immersif et cinématographique.

== STYLE ==
- Français, 2e personne (« tu »). Ton d'anime shōnen : ambiance, décor, sensations, regards, silences, tension, humour aussi. Dialogues vivants entre tirets ou guillemets, fidèles aux personnalités (Naruto exubérant, Sasuke froid et laconique, Kakashi nonchalant, Shikamaru blasé, etc.). Reprends les scènes et répliques emblématiques quand elles arrivent, sans les recopier mécaniquement.
- 180 à 300 mots dans "texte". Pas de méta-commentaire, pas de liste, pas de statistiques dans le texte.
- Ne joue JAMAIS les actions, paroles ou pensées du joueur à sa place. Décris le monde et les réactions des PNJ, puis rends la main sur une situation qui appelle une réaction.
- Les actions ont des conséquences réalistes : pas de victoire automatique, les combats coûtent des PV et du chakra, une technique au-dessus du niveau ou du chakra du joueur échoue ou coûte cher. Si l'action est absurde ou toute-puissante, détourne-la de façon cohérente.
- Violence de la série acceptée, sans gore explicite. Si les PV du joueur sont très bas, il est gravement blessé ; ne le tue jamais sans qu'une menace mortelle claire ait été annoncée au tour précédent.

== FIDÉLITÉ AU CANON ==
Chronologie à suivre fidèlement, dans l'ordre, au rythme d'une série :
- Événement précédent : ${prev ? prev.titre + ' (' + prev.arc + ')' : '—'}
- ÉVÉNEMENT EN COURS : ${cur ? `« ${cur.titre} » (arc ${cur.arc}) — ${cur.resume}` : 'Fin de la chronologie : histoire libre dans la continuité du canon.'}
- Prochains événements : ${next.length ? next.map(e => '« ' + e.titre + ' »').join(' → ') : '—'}
Règles :
- Un événement s'étale sur plusieurs tours (3 à 6) : joue les scènes dans l'ordre, une à la fois, avec leurs enjeux et dialogues. Ne résume pas, ne saute pas d'étape.
- Quand l'événement en cours est vraiment terminé dans la narration, mets "canon_avance": 1 (2 au maximum si tu enchaînes). Sinon 0.
- Le joueur peut changer le cours de l'histoire : ses actes ont de vraies conséquences et tu adaptes la suite avec logique (effet papillon). Mais sans intervention réelle du joueur, les événements arrivent comme dans le canon. Les PNJ canoniques ne savent que ce qu'ils savent dans la série.
- Si le joueur change un fait canonique, note-le en une phrase dans "divergence" ; sinon null.
- Le joueur n'est PAS un personnage canonique : intègre-le avec cohérence (équipe, classe, entourage) sans voler la place des protagonistes.

== SECRET DU JOUEUR (ne JAMAIS le révéler directement) ==
${p.secret || '(aucun fourni)'}
Le personnage l'ignore. Distille des indices subtils (rêves, réactions troublées de PNJ, coïncidences, objets, regards) et laisse ce secret influencer le destin du personnage ; ne le révèle pleinement qu'à un moment dramatique pertinent, après plusieurs indices.

== JOUEUR ==
${p.prenom} ${p.nom}, ${p.age} ans, ${p.sexe}, clan ${p.clan}, village ${p.village}, rang ${p.rang}. Départ : ${p.departTitre}.
Apparence : ${p.apparence || '—'} | Particularités : ${p.particularites || '—'} | Personnalité : ${p.personnalite || '—'}
Entourage / place dans la classe : ${p.entourage || '—'}
Passé connu : ${p.background || '—'}
PV ${state.pv.actuel}/${state.pv.max} · Chakra ${state.chakra.actuel}/${state.chakra.max}
Stats (sur 100) : ${STAT_KEYS.map(k => k + ' ' + state.stats[k]).join(', ')}
Position : ${lieu.nom} (id ${lieu.id})${state.position.detail ? ' — ' + state.position.detail : ''}
Inventaire : ${inv}

== PNJ DÉJÀ RENCONTRÉS (relation de -100 à +100) ==
${rencontres}

== PERSONNAGES CANONIQUES PAS ENCORE RENCONTRÉS (id=nom) ==
${inconnus || '(tous rencontrés)'}

== MÉMOIRE DE LA PARTIE (faits établis) ==
${memo}

== DIVERGENCES AVEC LE CANON ==
${diverg}

== LIEUX DE LA CARTE (id=nom) ==
${lieux}

== RÈGLES DU JSON ==
- Un personnage « rencontré » = il apparaît dans la scène et le joueur interagit avec lui ou le voit clairement. Mets son id (de la liste ci-dessus) dans "effets.rencontre" lors de sa première apparition. Pour un personnage absent de la liste (élève secondaire, villageois important, nouveau personnage original), crée-le dans "nouveaux_pnj" avec un id unique en minuscules sans espace.
- "relations" : variation de la relation de chaque PNJ envers le joueur selon ses choix. Entiers entre -30 et +30 (petits écarts de 1 à 10 le plus souvent ; grands écarts seulement pour des actes marquants). Ne change que ce qui a vraiment bougé.
- "notes_pnj" : en une courte phrase (moins de 15 mots), ce qu'un PNJ pense du joueur maintenant. Facultatif, uniquement pour les PNJ rencontrés.
- Amplitudes : pv et chakra entre -40 et +40 ; stats entre -4 et +4 (progression lente et justifiée : entraînement, combat, révélation).
- "lieu" : id d'un lieu de la carte si le joueur est (ou va) dans ce lieu, sinon null. Choisis le lieu le plus proche si l'endroit exact n'est pas listé (ex : une salle de l'Académie → konoha). "lieu_detail" : précision courte (ex : « Terrain d'entraînement n°3 »).
- "objets" : "gagnes" = objets obtenus {id, nom, type (arme|parchemin|soin|equipement|autre), quantite, description, effet facultatif {pv, chakra}} ; "perdus" = [{id, quantite}] pour les objets de l'inventaire utilisés ou perdus (utilise leurs ids exacts).
- "journal" : entrée du « Journal de Konoha », une chronique en 3e personne (60 à 130 mots) de ce qui se passe AILLEURS dans le monde du manga, hors du regard du joueur : événements canoniques importants, conversations entre personnages (Naruto et Iruka, Sasuke seul, Hokage et conseillers…), rumeurs, mouvements d'Orochimaru, de l'Akatsuki, etc. Elle suit le canon et tient compte des divergences causées par le joueur. Ne révèle jamais le secret du joueur. Mets une entrée la plupart des tours (au moins un tour sur deux) ; sinon null.
- "memo" : UNE phrase factuelle résumant ce qui vient de se passer de durable (qui a dit/fait quoi, décisions, blessures, promesses).
- "choix" : exactement 3 suggestions courtes (moins de 15 mots) : une prudente, une audacieuse, une sociale ou stratégique. Le joueur peut aussi écrire librement.

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour ni balises Markdown, de cette forme :
{
  "titre": "Titre court de la scène",
  "texte": "Narration…",
  "effets": { "pv": 0, "chakra": -5, "stats": {"taijutsu": 1}, "relations": {"naruto": 4}, "notes_pnj": {"naruto": "Il te trouve étrange mais sympa."}, "rencontre": ["naruto"], "lieu": "konoha", "lieu_detail": "Académie" },
  "nouveaux_pnj": [ { "id": "exemple", "prenom": "…", "nom": "…", "age": 12, "clan": "…", "village": "…", "role": "…", "relation": 0, "description": "…" } ],
  "objets": { "gagnes": [], "perdus": [] },
  "journal": { "titre": "…", "texte": "…" },
  "canon_avance": 0,
  "divergence": null,
  "memo": "…",
  "choix": ["…", "…", "…"]
}`;
}

/* ---------- Appel Gemini (délai maximum, nouvelles tentatives, modèle de secours) ---------- */
const CODES_TEMP = [429, 500, 502, 503, 504];
function erreurHttp(status, txt, model) {
  let msg = String(txt || '').slice(0, 250);
  try { msg = JSON.parse(txt).error.message || msg; } catch (e) {}
  const err = new Error(`HTTP ${status} (${model}) — ${msg}`);
  err.temp = CODES_TEMP.includes(status); err.status = status;
  return err;
}
function corpsRequete(model) {
  const gc = { responseMimeType: 'application/json', temperature: 0.95 };
  if (/^gemini-(3|4)/.test(model)) gc.thinkingConfig = { thinkingLevel: 'low' };   // réponses plus rapides
  return {
    systemInstruction: { parts: [{ text: promptSysteme() }] },
    contents: state.histo.slice(-14),
    generationConfig: gc,
    safetySettings: ['HARM_CATEGORY_HARASSMENT', 'HARM_CATEGORY_HATE_SPEECH', 'HARM_CATEGORY_SEXUALLY_EXPLICIT', 'HARM_CATEGORY_DANGEROUS_CONTENT']
      .map(category => ({ category, threshold: 'BLOCK_ONLY_HIGH' }))
  };
}
async function envoyer(model, body) {
  const ctrl = new AbortController(), t = setTimeout(() => ctrl.abort(), ia.timeout);
  try {
    if (ia.cfg.mode === 'proxy') {
      return await fetch(ia.cfg.proxyUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ model, body }), signal: ctrl.signal });
    }
    return await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ia.cfg.apiKey },
      body: JSON.stringify(body), signal: ctrl.signal
    });
  } catch (e) {
    const err = new Error(e.name === 'AbortError' ? `Délai dépassé (${model} met trop de temps à répondre).` : `Connexion impossible : ${e.message}`);
    err.temp = true; throw err;
  } finally { clearTimeout(t); }
}
async function tenterModele(model) {
  const body = corpsRequete(model);
  let res = await envoyer(model, body);
  if (res.status === 400 && body.generationConfig.thinkingConfig) {          // ce modèle n'accepte pas ce réglage : on réessaie sans
    const t = await res.text();
    if (!/think/i.test(t)) throw erreurHttp(400, t, model);
    delete body.generationConfig.thinkingConfig;
    res = await envoyer(model, body);
  }
  if (!res.ok) throw erreurHttp(res.status, await res.text(), model);
  const data = await res.json();
  const txt = (data.candidates?.[0]?.content?.parts || []).filter(p => !p.thought).map(p => p.text || '').join('');
  if (!txt) {
    const err = new Error(data.promptFeedback?.blockReason ? 'Requête bloquée par les filtres de sécurité (' + data.promptFeedback.blockReason + ').' : 'Réponse vide du modèle.');
    err.temp = !data.promptFeedback?.blockReason; throw err;
  }
  let rep;
  try { rep = JSON.parse(txt.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim()); }
  catch (e) { const err = new Error('Réponse illisible (JSON incomplet).'); err.temp = true; throw err; }
  if (!rep.texte) { const err = new Error('JSON incomplet renvoyé par le modèle.'); err.temp = true; throw err; }
  if (!Array.isArray(rep.choix) || rep.choix.length < 2) rep.choix = ['Observer la situation avant d’agir', 'Parler à quelqu’un', 'Passer à l’action'];
  return rep;
}
async function appelGemini(action, statut) {
  state.histo.push({ role: 'user', parts: [{ text: action }] });
  const modeles = [ia.cfg.model];
  if (ia.cfg.fallback && ia.cfg.fallback !== ia.cfg.model) modeles.push(ia.cfg.fallback);
  let derniere;
  try {
    for (let m = 0; m < modeles.length; m++) {
      for (let essai = 0; essai < 3; essai++) {
        try {
          const rep = await tenterModele(modeles[m]);
          state.histo.push({ role: 'model', parts: [{ text: String(rep.texte).slice(0, 1500) }] });
          return rep;
        } catch (e) {
          derniere = e;
          if (!e.temp) throw e;
          if (essai < 2) { statut && statut(`Google est occupé… nouvel essai ${essai + 2}/3 dans quelques secondes`); await sleep(ia.delais[essai]); }
        }
      }
      if (m < modeles.length - 1) statut && statut('Bascule vers le modèle de secours…');
    }
    throw derniere;
  } catch (e) {
    state.histo.pop();                       // garde l'alternance user/model
    throw e;
  }
}

/* ---------- Application des effets (avec garde-fous) ---------- */
function bornes(obj, min, max, valides) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    v = Math.round(Number(v));
    if (!Number.isFinite(v) || (valides && !valides.includes(k))) return;
    out[k] = clamp(v, min, max);
  });
  return out;
}
function appliquerReponse(rep) {
  const e = rep.effets || {}, notes = [];
  const add = (txt, type) => notes.push({ txt, type });
  const rencontrer = c => { if (c && !c.rencontre) { c.rencontre = true; c.rencontre_tour = state.tour; add(`Nouvelle fiche : ${c.prenom} ${c.nom}`.trim(), 'info'); } };

  (rep.nouveaux_pnj || []).forEach(n => {
    if (!n) return;
    const id = idSur(n.id || n.prenom); if (!id || state.chars.some(c => c.id === id)) return;
    const c = { id, prenom: String(n.prenom || 'Inconnu'), nom: String(n.nom || ''), age: n.age ?? '?', clan: String(n.clan || 'Inconnu'),
      village: String(n.village || 'Inconnu'), role: String(n.role || ''), description: String(n.description || ''),
      relation: clamp(Math.round(Number(n.relation) || 0), -100, 100), rencontre: false, rencontre_tour: 0, dernier: 0, note: '' };
    state.chars.push(c); rencontrer(c);
  });
  (e.rencontre || []).forEach(id => rencontrer(state.chars.find(c => c.id === id)));

  Object.entries(bornes(e.relations, -30, 30, state.chars.map(c => c.id))).forEach(([id, d]) => {
    const c = state.chars.find(x => x.id === id); if (!c || !d) return;
    rencontrer(c);
    c.relation = clamp(c.relation + d, -100, 100); c.dernier = d;
    add(`${c.prenom} : relation ${sg(d)}%`, d > 0 ? 'pos' : 'neg');
  });
  Object.entries(e.notes_pnj || {}).forEach(([id, t]) => {
    const c = state.chars.find(x => x.id === id); if (c && c.rencontre && t) c.note = String(t).slice(0, 160);
  });

  const dpv = clamp(Math.round(Number(e.pv) || 0), -40, 40), dch = clamp(Math.round(Number(e.chakra) || 0), -40, 40);
  if (dpv) { state.pv.actuel = clamp(state.pv.actuel + dpv, 0, state.pv.max); add(`PV ${sg(dpv)}`, dpv > 0 ? 'pos' : 'neg'); }
  if (dch) { state.chakra.actuel = clamp(state.chakra.actuel + dch, 0, state.chakra.max); add(`Chakra ${sg(dch)}`, dch > 0 ? 'pos' : 'neg'); }
  if (state.pv.actuel <= 0) { state.pv.actuel = 1; add('À l’agonie (PV 1)', 'neg'); }
  Object.entries(bornes(e.stats, -4, 4, STAT_KEYS)).forEach(([k, d]) => {
    if (!d) return; state.stats[k] = clamp(state.stats[k] + d, 0, 100); add(`${cap(k)} ${sg(d)}`, d > 0 ? 'pos' : 'neg');
  });

  const ob = rep.objets || {};
  (ob.gagnes || []).forEach(o => {
    if (!o || !o.nom) return;
    const id = idSur(o.id || o.nom), q = clamp(Math.round(Number(o.quantite) || 1), 1, 99);
    const ex = state.inventaire.find(x => x.id === id);
    if (ex) ex.quantite += q;
    else {
      const eff = o.effet ? { pv: clamp(Math.round(Number(o.effet.pv) || 0), -50, 50), chakra: clamp(Math.round(Number(o.effet.chakra) || 0), -50, 50) } : null;
      state.inventaire.push({ id, nom: String(o.nom), type: TYPES_OBJ.includes(o.type) ? o.type : 'autre', quantite: q, description: String(o.description || ''), effet: eff });
    }
    add(`Objet obtenu : ${o.nom}`, 'pos');
  });
  (ob.perdus || []).forEach(o => {
    if (!o) return;
    const it = state.inventaire.find(x => x.id === o.id); if (!it) return;
    it.quantite -= clamp(Math.round(Number(o.quantite) || 1), 1, 99);
    add(`Objet perdu : ${it.nom}`, 'neg');
    if (it.quantite <= 0) state.inventaire = state.inventaire.filter(x => x !== it);
  });

  const l = LIEUX.find(x => x.id === e.lieu);
  if (l) {
    state.position = { id: l.id, detail: String(e.lieu_detail || '').slice(0, 60) };
    if (!state.visites.includes(l.id)) state.visites.push(l.id);
    add(`📍 ${l.nom.split(' (')[0]}`, 'info');
    placePion(); buildMarkers();
  } else if (e.lieu_detail) { state.position.detail = String(e.lieu_detail).slice(0, 60); placePion(); }

  const ev = CANON.evenements[state.canonIndex];
  if (rep.journal && rep.journal.texte) {
    state.journal.unshift({ tour: state.tour, arc: ev ? ev.arc : 'Chronique', titre: String(rep.journal.titre || 'Chronique'), texte: String(rep.journal.texte) });
    if (state.journal.length > 80) state.journal.pop();
    add('📰 Nouvelle édition du Journal', 'info');
  }
  const av = clamp(Math.round(Number(rep.canon_avance) || 0), 0, 2);
  if (av) {
    const ni = Math.min(state.canonIndex + av, CANON.evenements.length - 1);
    if (ni !== state.canonIndex) { state.canonIndex = ni; add(`📺 ${CANON.evenements[ni].arc} : ${CANON.evenements[ni].titre}`, 'info'); }
  }
  if (rep.divergence && typeof rep.divergence === 'string') { state.divergences.push(rep.divergence.slice(0, 220)); if (state.divergences.length > 40) state.divergences.shift(); }
  if (rep.memo && typeof rep.memo === 'string') { state.memo.push(rep.memo.slice(0, 260)); if (state.memo.length > 60) state.memo.shift(); }
  return notes;
}

/* ---------- Tour de jeu ---------- */
async function tourIA(action, afficher = true) {
  if (ia.busy) return;
  if (!iaPret()) { if (!(await ouvrirReglages())) return; }
  ia.busy = true;
  const avant = (() => { const u = state.undo; state.undo = null; const s = JSON.stringify(state); state.undo = u; return s; })();
  ia.derniereAction = { action, afficher };
  renderChoix(true); $('#mj-input').disabled = true; majBoutonUndo();
  if (afficher) mjEcrire('joueur', action);
  const attente = mjEcrire('systeme', 'Le Maître du Jeu écrit la suite…', null, null, false);
  try {
    const pre = state.pendant.length ? `[Info : ${state.pendant.join(' ; ')}] ` : '';
    const rep = await appelGemini(pre + action, t => { const p = attente.querySelector('p'); if (p) p.textContent = t; });
    state.pendant = [];
    attente.remove();
    const notes = appliquerReponse(rep);
    mjEcrire('mj', rep.texte, rep.titre || 'Le récit continue', notes);
    state.choix = rep.choix.slice(0, 3).map(String);
    state.derniere = { titre: rep.titre, texte: rep.texte };
    state.histo = state.histo.slice(-14);
    state.tour++; state.undo = avant;
    renderAll(); renderChoix();
  } catch (err) {
    console.error(err);
    attente.remove();
    mjEcrire('systeme', `⚠️ Erreur IA : ${err.message}\n${err.temp ? 'Le serveur de Google est surchargé ou injoignable : c’est temporaire. Clique sur « Réessayer » dans un instant (ou renseigne un modèle de secours dans ⚙️ IA).' : 'Vérifie ta clé et ton modèle (⚙️ IA) puis clique sur « Réessayer ».'}`, null, null, false);
    renderRetry();
  } finally {
    ia.busy = false; $('#mj-input').disabled = false; majBoutonUndo(); save();
  }
}
function annulerTour() {
  if (!state.undo || ia.busy) return;
  if (!confirm('Annuler le dernier tour et revenir juste avant ?')) return;
  state = { ...etatVide(), ...JSON.parse(state.undo), undo: null };
  renderAll(); placePion(); buildMarkers(); rebuildLog(); renderChoix();
}

/* ---------- Réglages IA ---------- */
function ouvrirReglages() {
  return new Promise(resolve => {
    const dlg = $('#dlg-ia');
    $('#ia-mode').value = ia.cfg.mode; $('#ia-key').value = ia.cfg.apiKey;
    $('#ia-proxy').value = ia.cfg.proxyUrl; $('#ia-model').value = ia.cfg.model; $('#ia-fallback').value = ia.cfg.fallback || '';
    majModeIA(); dlg._resolve = resolve; dlg.showModal();
  });
}
function majModeIA() {
  const proxy = $('#ia-mode').value === 'proxy';
  $('#ia-l-key').style.display = proxy ? 'none' : '';
  $('#ia-l-proxy').style.display = proxy ? '' : 'none';
}

/* ---------- Événements ---------- */
function changeTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'fiche') renderFiche();
}
function bindUI() {
  $$('.tab').forEach(b => b.addEventListener('click', () => changeTab(b.dataset.tab)));
  $('#form-perso').addEventListener('submit', creerPerso);

  $('#tab-inventaire').addEventListener('click', e => {
    const id = e.target.dataset.use; if (!id) return;
    const o = state.inventaire.find(x => x.id === id); if (!o || !o.effet) return;
    const notes = [];
    if (o.effet.pv) { state.pv.actuel = clamp(state.pv.actuel + o.effet.pv, 1, state.pv.max); notes.push({ txt: `PV ${sg(o.effet.pv)}`, type: o.effet.pv > 0 ? 'pos' : 'neg' }); }
    if (o.effet.chakra) { state.chakra.actuel = clamp(state.chakra.actuel + o.effet.chakra, 0, state.chakra.max); notes.push({ txt: `Chakra ${sg(o.effet.chakra)}`, type: o.effet.chakra > 0 ? 'pos' : 'neg' }); }
    o.quantite--; if (o.quantite <= 0) state.inventaire = state.inventaire.filter(x => x !== o);
    state.pendant.push(`le joueur a utilisé ${o.nom}`);
    mjEcrire('systeme', `Tu utilises : ${o.nom}.`, null, notes);
    renderAll();
  });

  const envoyer = () => { const v = $('#mj-input').value.trim(); if (!v || ia.busy) return; $('#mj-input').value = ''; tourIA(v); };
  $('#mj-form').addEventListener('submit', e => { e.preventDefault(); envoyer(); });
  $('#mj-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyer(); } });
  $('#btn-undo').addEventListener('click', annulerTour);

  $('#btn-reset').addEventListener('click', () => {
    if (confirm('Effacer cette partie et créer un nouveau personnage ? (ta clé API est conservée)')) { localStorage.removeItem(SAVE_KEY); location.reload(); }
  });

  /* Réglages IA */
  const dlg = $('#dlg-ia');
  $('#btn-ia').addEventListener('click', async () => { if (await ouvrirReglages()) { renderHeader(); if (state.cree) lancerOuReprendre(); } });
  $('#ia-mode').addEventListener('change', majModeIA);
  $('#ia-cancel').addEventListener('click', () => dlg.close('cancel'));
  $('#ia-clear').addEventListener('click', () => { localStorage.removeItem(CFG_KEY); ia.cfg = { mode: 'direct', apiKey: '', proxyUrl: '', model: 'gemini-3.8-flash', fallback: '' }; dlg.close('cancel'); renderHeader(); });
  $('#ia-save').addEventListener('click', () => {
    ia.cfg = { mode: $('#ia-mode').value, apiKey: $('#ia-key').value.trim(), proxyUrl: $('#ia-proxy').value.trim(), model: $('#ia-model').value.trim() || 'gemini-3.8-flash', fallback: $('#ia-fallback').value.trim() };
    try { localStorage.setItem(CFG_KEY, JSON.stringify(ia.cfg)); } catch (e) {}
    dlg.close('ok');
  });
  dlg.addEventListener('close', () => { if (dlg._resolve) { const r = dlg._resolve; dlg._resolve = null; r(dlg.returnValue === 'ok' && iaPret()); } });
}

document.addEventListener('DOMContentLoaded', init);
