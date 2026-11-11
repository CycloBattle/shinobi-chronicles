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
const normaliser = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const idSur = s => normaliser(s).replace(/[^a-z0-9_]/g, '_').slice(0, 30);

const SAVE_KEY   = 'shinobi-v2-save';
const CFG_KEY    = 'shinobi-v2-config';
const PHOTOS_KEY = 'shinobi-v2-photos';
const VERSION = 3;
const STAT_KEYS = ['ninjutsu', 'taijutsu', 'genjutsu', 'fuinjutsu'];

/* ---------- Photos (stockées à part pour ne pas alourdir la sauvegarde) ---------- */
let photos = {};
try { photos = JSON.parse(localStorage.getItem(PHOTOS_KEY) || '{}') || {}; } catch (e) { photos = {}; }
function savePhotos() {
  try { localStorage.setItem(PHOTOS_KEY, JSON.stringify(photos)); }
  catch (e) { alert('Mémoire du navigateur pleine : essaie une image plus petite.'); }
}

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
    ver: VERSION, cree: false, perso: null,
    stats: {}, pv: { actuel: 100, max: 100 }, chakra: { actuel: 60, max: 60 },
    position: { id: 'konoha', detail: '' }, visites: [],
    chars: [], canonIndex: 0, divergences: [], memo: [], journal: [],
    histo: [], choix: [], log: [], tour: 1, derniere: null, undo: null, manuelDemarre: false, fil: []
  };
}
let state = etatVide();

const ia = {
  cfg: { mode: 'direct', apiKey: '', proxyUrl: '', model: 'gemini-3.8-flash', fallback: '' },
  busy: false, derniereAction: null, delais: [4000, 10000], timeout: 100000
};
try { Object.assign(ia.cfg, JSON.parse(localStorage.getItem(CFG_KEY) || '{}')); } catch (e) {}
if (ia.cfg.model === 'gemini-2.5-flash') ia.cfg.model = 'gemini-3.8-flash';   // ancien modèle retiré par Google
const iaPret = () => ia.cfg.mode === 'manuel' ? true : ia.cfg.mode === 'proxy' ? !!ia.cfg.proxyUrl : !!ia.cfg.apiKey;

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) { console.warn('Sauvegarde impossible', e); }
}

/* ---------- Initialisation ---------- */
const nouveauPNJ = b => ({ ...b, relation: clamp(Number(b.relation) || 0, -100, 100), rencontre: false, rencontre_tour: 0, dernier: 0, note: '' });

async function init() {
  try {
    const [chars, canon] = await Promise.all([
      fetch('data/characters.json').then(r => r.json()),
      fetch('data/canon.json').then(r => r.json())
    ]);
    CHARS_BASE = chars; CANON = canon;
  } catch (e) {
    console.error(e);
    document.body.innerHTML = "<p style='padding:2rem'>Impossible de charger les données. Lance le projet via GitHub Pages ou un serveur local, pas en double-cliquant sur index.html.</p>";
    return;
  }
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch (e) {}
  if (saved && saved.cree) {
    if (!saved.ver) saved.canonIndex = (saved.canonIndex || 0) + 1;   // ancienne chronologie sans l'événement de départ e00
    state = { ...etatVide(), ...saved, ver: VERSION };
    CHARS_BASE.forEach(b => { if (!state.chars.some(c => c.id === b.id)) state.chars.push(nouveauPNJ(b)); });
  } else {
    state = etatVide();
    state.chars = CHARS_BASE.map(nouveauPNJ);
  }
  bindUI();
  if (state.cree) { $('#creation').hidden = true; lancerOuReprendre(); }
  else ouvrirCreation();
}

/* ---------- Création de personnage ---------- */
let photoCreation = null;

/* Niveau de départ calculé automatiquement : cohérent avec les autres élèves */
const CLAN_BONUS = {
  hyuga: { taijutsu: 3, ninjutsu: 1 }, uchiha: { ninjutsu: 2, genjutsu: 2 }, uzumaki: { fuinjutsu: 4, ninjutsu: 1 },
  nara: { ninjutsu: 2, genjutsu: 1 }, yamanaka: { genjutsu: 3, ninjutsu: 1 }, akimichi: { taijutsu: 3, ninjutsu: 1 },
  inuzuka: { taijutsu: 3 }, aburame: { ninjutsu: 3 }, senju: { ninjutsu: 2, taijutsu: 2 }, sarutobi: { ninjutsu: 2 },
  hatake: { ninjutsu: 2, taijutsu: 1 }, yuki: { ninjutsu: 3 }, kaguya: { taijutsu: 4 }, hozuki: { ninjutsu: 2, taijutsu: 1 }
};
const MOTS = {
  ninjutsu:  /ninjutsu|chakra|\belement|\bfeu\b|\beau\b|\bvent\b|\bfoudre\b|\bterre\b|strateg|intelligen|etudi|studieu|erudit/g,
  taijutsu:  /taijutsu|\bcombat|\bforce\b|muscl|bagarr|\bsport|\bboxe|physique|endurant|\brapide|vitesse|athlet|arts martiaux/g,
  genjutsu:  /genjutsu|illusion|\bmental|manipul|observ|discret|perspicac|psycholog|hypno/g,
  fuinjutsu: /fuinjutsu|sceau|scell|calligraph|parchemin|barriere|\bencre/g
};
const DECALAGE = { ninjutsu: 0, taijutsu: 0, genjutsu: -2, fuinjutsu: -4 };

function calcStats(profil, depart) {
  const base = depart.niveau || 10, ageRef = depart.age_ref || 12;
  const adj = clamp(Math.round((profil.age - ageRef) * 1.2), -4, 8);
  const clan = normaliser(profil.clan);
  const texte = normaliser([profil.personnalite, profil.background, profil.entourage].join(' '));
  const out = {};
  STAT_KEYS.forEach(k => {
    let v = base + DECALAGE[k] + adj;
    Object.entries(CLAN_BONUS).forEach(([c, b]) => { if (clan.includes(c) && b[k]) v += b[k]; });
    v += Math.min(4, 2 * (texte.match(MOTS[k]) || []).length);
    out[k] = clamp(Math.round(v), 3, base + 12);
  });
  return out;
}

function profilForm() {
  const f = new FormData($('#form-perso'));
  const g = k => String(f.get(k) || '').trim();
  return { age: clamp(Number(g('age')) || 12, 6, 60), clan: g('clan'), personnalite: g('personnalite'),
           background: g('background'), entourage: g('entourage'), depart: g('depart') };
}
function majApercu() {
  const p = profilForm();
  const d = CANON.debuts.find(x => x.id === p.depart) || CANON.debuts[0];
  if (!d) return;
  const st = calcStats(p, d);
  $('#apercu').innerHTML = STAT_KEYS.map(k =>
    `<div class="bar-row"><span>${cap(k)}</span><span>${st[k]}</span></div>
     <div class="bar"><div class="fill ${k}" style="width:${st[k]}%"></div></div>`).join('');
}

function lirePhoto(file, taille = 256) {
  return new Promise((resolve, reject) => {
    if (!file || !/^image\//.test(file.type)) return reject(new Error('Ce fichier n’est pas une image.'));
    const fr = new FileReader();
    fr.onerror = () => reject(new Error('Lecture de l’image impossible.'));
    fr.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image illisible.'));
      img.onload = () => {
        try {
          const c = document.createElement('canvas'); c.width = c.height = taille;
          const s = Math.min(img.width, img.height), sx = (img.width - s) / 2, sy = (img.height - s) * 0.2;   // carré, cadré vers le haut (visages)
          c.getContext('2d').drawImage(img, sx, sy, s, s, 0, 0, taille, taille);
          resolve(c.toDataURL('image/jpeg', 0.82));
        } catch (e) { reject(new Error('Impossible de traiter cette image.')); }
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

function ouvrirCreation() {
  $('#creation').hidden = false;
  $('#depart').innerHTML = CANON.debuts.map(d => `<option value="${d.id}">${esc(d.titre)}</option>`).join('');
  const maj = () => {
    const d = CANON.debuts.find(x => x.id === $('#depart').value);
    $('#depart-desc').textContent = d ? d.description : '';
    majApercu();
  };
  $('#depart').onchange = maj;
  $('#form-perso').addEventListener('input', majApercu);
  $('#photo-input').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try { photoCreation = await lirePhoto(f, 256); $('#photo-prev').src = photoCreation; $('#photo-prev').hidden = false; }
    catch (err) { alert(err.message); }
  };
  $('#photo-retirer').onclick = () => { photoCreation = null; $('#photo-prev').hidden = true; $('#photo-input').value = ''; };
  renderFilEditor($('#fil-creation'), []);
  maj();
}

function creerPerso(e) {
  e.preventDefault();
  const f = new FormData($('#form-perso'));
  const g = k => String(f.get(k) || '').trim();
  const depart = CANON.debuts.find(d => d.id === g('depart')) || CANON.debuts[0];
  const perso = {
    prenom: g('prenom'), nom: g('nom'), age: clamp(Number(g('age')) || 12, 6, 60), sexe: g('sexe'),
    clan: g('clan') || 'Aucun', village: g('village') || 'Konohagakure',
    rang: depart.rang, depart: depart.id, departTitre: depart.titre, entourage: g('entourage'),
    apparence: g('apparence'), particularites: g('particularites'), personnalite: g('personnalite'),
    background: g('background'), secret: g('secret')
  };
  state.perso = perso;
  state.stats = calcStats(perso, depart);
  state.pv = { actuel: depart.pv, max: depart.pv };
  state.chakra = { actuel: depart.chakra, max: depart.chakra };
  state.canonIndex = Math.max(0, CANON.evenements.findIndex(ev => ev.id === depart.canon));
  state.position = { id: depart.lieu, detail: depart.lieu_detail || '' };
  state.visites = [depart.lieu];
  state.fil = lireFil($('#fil-creation'));
  state.cree = true;
  state.tour = 1;
  if (photoCreation) photos.player = photoCreation; else delete photos.player;
  savePhotos();
  save();
  $('#creation').hidden = true;
  lancerOuReprendre();
}

/* ---------- Lancement / reprise ---------- */
function premierMessage() {
  const acad = state.perso && state.perso.depart === 'd_academie';
  return "[DÉBUT DE PARTIE] Ouvre l'histoire comme le tout premier épisode de la partie, à partir du point de départ du joueur : plante le décor (lieu, ambiance, heure), fais apparaître naturellement les personnages canoniques de la scène (utilise « rencontre » pour eux) et fixe leurs premières impressions du joueur via « relations ». "
    + (acad ? "Le joueur est élève de l'Académie : commence dans la vie quotidienne de la classe, quelques jours AVANT l'examen de diplôme (n'évoque l'examen que comme une échéance proche). " : "")
    + "Ne décide rien à la place du joueur.";
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

/* ---------- Rendu : photos, fiche, relations, journal ---------- */
function avatar(id, nom, cls = '') {
  const src = photos[id];
  if (src) return `<img class="avatar ${cls}" data-photo="${esc(id)}" src="${esc(src)}" alt="${esc(nom)}" title="Clique ou glisse une image pour changer la photo">`;
  const ini = (String(nom || '?').trim().charAt(0) || '?').toUpperCase();
  return `<div class="avatar vide ${cls}" data-photo="${esc(id)}" title="Clique ou glisse une image pour ajouter une photo">${esc(ini)}</div>`;
}
function avatarBloc(id, nom, cls = '') {
  return `<div class="avatar-wrap">${avatar(id, nom, cls)}<button type="button" class="avatar-url" data-url="${esc(id)}" title="Photo par adresse web (ou la supprimer)">🔗</button></div>`;
}

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
    <div class="card">
      <div class="fiche-top">
        <div>${avatarBloc('player', p.prenom, 'portrait')}</div>
        <div><h2>${esc(p.prenom)} ${esc(p.nom)}</h2>
          <dl class="ident">
            <dt>Âge</dt><dd>${p.age} ans · ${esc(p.sexe)}</dd>
            <dt>Clan</dt><dd>${esc(p.clan)}</dd>
            <dt>Village</dt><dd>${esc(p.village)}</dd>
            <dt>Rang</dt><dd>${esc(p.rang)}</dd>
          </dl></div>
      </div>
      ${lore('Apparence', p.apparence)}${lore('Particularités', p.particularites)}${lore('Personnalité', p.personnalite)}
      ${lore('Entourage', p.entourage)}${lore('Passé', p.background)}
      ${p.secret ? `<details class="secret-box"><summary>🔒 Background caché (spoiler pour toi !)</summary><p>${esc(p.secret)}</p></details>` : ''}
    </div>
    <div class="card"><h3>Vitalité</h3>
      ${bar('Points de vie', state.pv.actuel, state.pv.max, 'pv')}
      ${bar('Réserve de chakra', state.chakra.actuel, state.chakra.max, 'chakra')}</div>
    <div class="card"><h3>Maîtrise des arts shinobi</h3>
      ${STAT_KEYS.map(k => bar(cap(k), state.stats[k], 100, k)).join('')}
      <p class="hint" style="margin-top:.7rem">Repères : élève moyen ≈ 10 · Genin ≈ 20 · Chūnin ≈ 40 · Jōnin ≈ 65 · Kage ≈ 90</p></div>`;
  animateBars();
}
function relColor(v) { const h = v < 0 ? (v + 100) * 0.3 : 30 + v * 0.9; return `hsl(${h} 75% 48%)`; }
function relLabel(v) {
  return v <= -60 ? 'Ennemi juré' : v < -20 ? 'Hostile' : v <= 20 ? 'Neutre' : v < 60 ? 'Amical' : v < 90 ? 'Allié' : 'Lien profond';
}
function renderPNJ() {
  const prev = {};
  $$('#tab-pnj .pnj').forEach(c => { const k = $('.knob', c); if (k) prev[c.dataset.id] = k.style.left; });
  const met = state.chars.filter(c => c.rencontre).sort((a, b) => (a.rencontre_tour || 0) - (b.rencontre_tour || 0));
  $('#tab-pnj').innerHTML = `<p class="hint" style="margin-bottom:.6rem">${met.length} personnage(s) rencontré(s). Clique sur un portrait (ou glisse une image dessus) pour ajouter une photo.</p>` +
    (met.map(c => {
      const col = relColor(c.relation);
      const d = c.dernier ? `<span class="delta ${c.dernier > 0 ? 'up' : 'down'}">${c.dernier > 0 ? '▲' : '▼'} ${sg(c.dernier)}</span>` : '';
      return `<article class="card pnj" data-id="${esc(c.id)}" style="--rc:${col}">
        <div class="pnj-top">
          ${avatarBloc(c.id, c.prenom)}
          <div class="pnj-id">
            <header><h3>${esc(c.prenom)} ${esc(c.nom)}</h3><span class="badge">${esc(c.village)}</span></header>
            <p class="meta">${esc(c.age)} ans · Clan ${esc(c.clan)} · ${esc(c.role)}</p>
          </div>
        </div>
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
  $('#btn-ia').textContent = ia.cfg.mode === 'manuel' ? '📋 Mode manuel' : iaPret() ? '🤖 IA : Gemini' : '⚙️ Activer l’IA';
}
function renderAll() { renderFiche(); renderPNJ(); renderJournal(); renderHeader(); majBoutonUndo(); save(); }

/* ---------- Fil conducteur : événements voulus par le joueur à des moments précis de la série ---------- */
function optionsEvenements(sel) {
  return '<option value="">— moment libre (précise ci-dessous) —</option>' +
    CANON.evenements.map(e => `<option value="${e.id}"${e.id === sel ? ' selected' : ''}>${esc(e.arc)} · ${esc(e.titre)}</option>`).join('');
}
function ligneFil(b = {}) {
  const id = b.id || 'f' + Math.random().toString(36).slice(2, 8);
  return `<div class="fil-row${b.fait ? ' fil-fait' : ''}" data-id="${esc(id)}" data-fait="${b.fait ? 1 : 0}">
    <button type="button" class="btn-ghost fil-suppr" title="Supprimer cet événement">✕</button>
    ${b.fait ? '<span class="badge done">✅ Réalisé</span>' : ''}
    <select class="fil-quand">${optionsEvenements(b.quand)}</select>
    <input class="fil-prec" maxlength="160" placeholder="Précision du moment (ex : quand Naruto rencontre Jiraiya pour la première fois)" value="${esc(b.prec)}">
    <textarea class="fil-quoi" rows="2" maxlength="400" placeholder="Ce qui arrive à ton personnage (ex : il rencontre Tsunade)">${esc(b.quoi)}</textarea>
  </div>`;
}
function renderFilEditor(box, beats) {
  box.innerHTML = '<div class="fil-liste">' + (beats || []).map(ligneFil).join('') + '</div><button type="button" class="btn-ghost fil-ajout">＋ Ajouter un événement</button>';
}
function lireFil(root) {
  return $$('.fil-row', root).map(r => ({
    id: r.dataset.id, fait: r.dataset.fait === '1',
    quand: $('.fil-quand', r).value, prec: $('.fil-prec', r).value.trim(), quoi: $('.fil-quoi', r).value.trim()
  })).filter(b => b.quoi);
}
function initFilEditor(root) {
  root.addEventListener('click', e => {
    if (e.target.closest('.fil-ajout')) { root.querySelector('.fil-liste').insertAdjacentHTML('beforeend', ligneFil({})); return; }
    const s = e.target.closest('.fil-suppr'); if (s) s.closest('.fil-row').remove();
  });
}
function renderFil() {
  $('#tab-fil').innerHTML = `
    <div class="card"><h2>🧭 Fil conducteur</h2>
      <p class="hint">Les événements que tu veux voir arriver à ton personnage à des moments précis de la série. Le Maître du Jeu les met en scène au bon moment (jamais avant) et ajuste la suite du canon. Exemple : pendant le mois d’entraînement, quand Naruto rencontre Jiraiya → ton personnage rencontre Tsunade.</p></div>
    <div id="fil-editeur"></div>
    <div style="margin-top:.8rem"><button type="button" class="btn" id="fil-save">Enregistrer le fil conducteur</button> <span id="fil-msg" class="hint"></span></div>`;
  renderFilEditor($('#fil-editeur'), state.fil || []);
}
function filTexte() {
  const fil = state.fil || [];
  if (!fil.length) return '(aucun : suis simplement le canon et les actions du joueur)';
  const ev = CANON.evenements, i = state.canonIndex;
  return fil.map(b => {
    const idx = b.quand ? ev.findIndex(e => e.id === b.quand) : -1;
    const moment = (idx >= 0 ? `moment : « ${ev[idx].titre} » (arc ${ev[idx].arc})` : 'moment : libre') + (b.prec ? ` — précisément : ${b.prec}` : '');
    let statut;
    if (b.fait) statut = 'DÉJÀ RÉALISÉ';
    else if (idx < 0) statut = 'à placer toi-même au moment décrit (ne le déclenche pas avant)';
    else if (idx === i) statut = '⚠️ C’EST LE MOMENT : mets-le en scène dans ce tour ou très bientôt';
    else if (idx < i) statut = '⚠️ moment dépassé : rattrape-le au plus vite, de façon cohérente';
    else statut = 'à venir (ne le déclenche surtout pas avant son moment)';
    return `- id "${b.id}" : ${b.quoi} | ${moment} | ${statut}`;
  }).join('\n');
}

/* ---------- Photos : ajout facile (clic, glisser-déposer ou adresse web) ---------- */
let photoCible = null;
async function appliquerPhotoFichier(id, f) {
  try { photos[id] = await lirePhoto(f, 256); savePhotos(); renderFiche(); renderPNJ(); }
  catch (err) { alert(err.message); }
}
function photoParURL(id) {
  const actuelle = photos[id] && !String(photos[id]).startsWith('data:') ? photos[id] : '';
  const u = prompt('Adresse (URL) de l’image — laisse vide pour supprimer la photo :', actuelle);
  if (u === null) return;
  const v = u.trim();
  if (!v) delete photos[id];
  else if (/^https?:\/\//i.test(v)) photos[id] = v;
  else { alert('Adresse invalide : elle doit commencer par https://'); return; }
  savePhotos(); renderFiche(); renderPNJ();
}
function initPhotos() {
  const pick = $('#photo-pick');
  pick.addEventListener('change', () => { const f = pick.files[0]; pick.value = ''; if (f && photoCible) appliquerPhotoFichier(photoCible, f); });
  const clic = e => {
    const av = e.target.closest('.avatar');
    if (av) { photoCible = av.dataset.photo; pick.click(); return; }
    const u = e.target.closest('[data-url]');
    if (u) photoParURL(u.dataset.url);
  };
  ['#tab-fiche', '#tab-pnj'].forEach(sel => {
    const z = $(sel);
    z.addEventListener('click', clic);
    z.addEventListener('dragover', e => { if (e.target.closest('.avatar')) e.preventDefault(); });
    z.addEventListener('drop', e => {
      const av = e.target.closest('.avatar'); if (!av) return;
      e.preventDefault();
      const f = e.dataTransfer && e.dataTransfer.files[0];
      if (f) appliquerPhotoFichier(av.dataset.photo, f);
    });
  });
  document.addEventListener('error', e => {          // image distante cassée : on remet le portrait vide
    const t = e.target;
    if (t && t.tagName === 'IMG' && t.classList.contains('avatar')) {
      const d = document.createElement('div');
      d.className = 'avatar vide ' + [...t.classList].filter(c => c !== 'avatar').join(' ');
      d.dataset.photo = t.dataset.photo; d.textContent = '?';
      t.replaceWith(d);
    }
  }, true);
}

/* ---------- Carte : tracker automatique + zoom / déplacement ---------- */
const vue = { z: 1, x: 0, y: 0 };
function dimsCarte() { const w = $('#map-wrap'); return { W: w.clientWidth, H: w.clientHeight }; }
function appliquerVue(anim = false) {
  const { W, H } = dimsCarte(), inner = $('#map-inner');
  vue.z = clamp(vue.z, 1, 6);
  vue.x = clamp(vue.x, W - W * vue.z, 0);
  vue.y = clamp(vue.y, H - H * vue.z, 0);
  inner.style.transition = anim ? 'transform .5s ease' : 'none';
  inner.style.setProperty('--z', vue.z);
  inner.style.transform = `translate(${vue.x}px, ${vue.y}px) scale(${vue.z})`;
}
function zoomer(facteur, cx, cy) {
  const { W, H } = dimsCarte();
  if (cx === undefined) { cx = W / 2; cy = H / 2; }
  const nz = clamp(vue.z * facteur, 1, 6), k = nz / vue.z;
  vue.x = cx - (cx - vue.x) * k; vue.y = cy - (cy - vue.y) * k; vue.z = nz;
  appliquerVue();
}
function centrerSurPion(zoom, anim = true) {
  const { W, H } = dimsCarte(), l = lieuActuel();
  if (zoom) vue.z = zoom;
  vue.x = W / 2 - (l.x / 100) * W * vue.z;
  vue.y = H / 2 - (l.y / 100) * H * vue.z;
  appliquerVue(anim);
}
function initCarte() {
  const wrap = $('#map-wrap'), ptrs = new Map();
  let dist0 = 0;
  const pts = () => [...ptrs.values()];
  const distance = () => { const [a, b] = pts(); return Math.hypot(a.x - b.x, a.y - b.y); };
  const milieu = () => { const [a, b] = pts(); return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; };

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const r = wrap.getBoundingClientRect();
    zoomer(e.deltaY < 0 ? 1.25 : 0.8, e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  wrap.addEventListener('dblclick', e => { const r = wrap.getBoundingClientRect(); zoomer(1.7, e.clientX - r.left, e.clientY - r.top); });
  wrap.addEventListener('pointerdown', e => {
    if (e.target.closest('.map-tools')) return;
    if (wrap.setPointerCapture) { try { wrap.setPointerCapture(e.pointerId); } catch (err) {} }
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    wrap.classList.add('drag');
    if (ptrs.size === 2) dist0 = distance();
  });
  wrap.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId)) return;
    const p = ptrs.get(e.pointerId), dx = e.clientX - p.x, dy = e.clientY - p.y;
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (ptrs.size === 1) { vue.x += dx; vue.y += dy; appliquerVue(); }
    else if (ptrs.size === 2) {
      const d = distance();
      if (dist0) { const r = wrap.getBoundingClientRect(), c = milieu(); zoomer(d / dist0, c.x - r.left, c.y - r.top); }
      dist0 = d;
    }
  });
  const fin = e => { ptrs.delete(e.pointerId); if (!ptrs.size) wrap.classList.remove('drag'); dist0 = 0; };
  wrap.addEventListener('pointerup', fin);
  wrap.addEventListener('pointercancel', fin);

  $('#zoom-in').addEventListener('click', () => zoomer(1.4));
  $('#zoom-out').addEventListener('click', () => zoomer(1 / 1.4));
  $('#zoom-pion').addEventListener('click', () => centrerSurPion(3));
  $('#zoom-reset').addEventListener('click', () => { vue.z = 1; vue.x = 0; vue.y = 0; appliquerVue(true); });
  window.addEventListener('resize', () => appliquerVue());
}
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
  if (vue.z > 1) centrerSurPion(null, true);        // la vue suit le pion quand on est zoomé
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
- Un événement s'étale sur plusieurs tours (3 à 6, davantage pour la vie quotidienne de l'Académie) : joue les scènes dans l'ordre, une à la fois, avec leurs enjeux et dialogues. Ne résume pas, ne saute pas d'étape.
- Quand l'événement en cours est vraiment terminé dans la narration, mets "canon_avance": 1 (2 au maximum si tu enchaînes). Sinon 0.
- Le joueur peut changer le cours de l'histoire : ses actes ont de vraies conséquences et tu adaptes la suite avec logique (effet papillon). Mais sans intervention réelle du joueur, les événements arrivent comme dans le canon. Les PNJ canoniques ne savent que ce qu'ils savent dans la série.
- Si le joueur change un fait canonique, note-le en une phrase dans "divergence" ; sinon null.
- Le joueur n'est PAS un personnage canonique : intègre-le avec cohérence (équipe, classe, entourage) sans voler la place des protagonistes.

== BARÈME DES NIVEAUX (stats sur 100) ==
Élève moyen de l'Académie ≈ 10 · meilleurs élèves (Sasuke) ≈ 20 · Genin ≈ 15-25 · Chūnin ≈ 30-45 · Jōnin ≈ 55-75 · Sannin / Kage ≈ 85-100.
Le joueur n'est PAS un prodige (sauf si l'histoire le justifie) : il combat à égalité avec des élèves ou genin de niveau comparable, et perd contre un jōnin ou un protagoniste du canon. Progression lente : +1 pour un entraînement sérieux ou un combat marquant, +2 pour un exploit exceptionnel, 0 la plupart des tours.

== FIL CONDUCTEUR DU JOUEUR (événements voulus par le joueur) ==
${filTexte()}
Règles : mets chaque événement en scène exactement à son moment, de façon naturelle et cinématographique, sans jamais le déclencher avant. Gère ensuite ses conséquences sur le canon et sur les PNJ (note-les dans "divergence"). Quand un événement a réellement eu lieu dans ta narration, ajoute son id dans "fil_realise". Ne l'annonce pas comme une consigne : fais-le vivre comme un fait de l'histoire.

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
- Amplitudes : pv et chakra entre -40 et +40 ; stats entre -2 et +2 (voir le barème : progression lente).
- "lieu" : id d'un lieu de la carte si le joueur est (ou va) dans ce lieu, sinon null. Choisis le lieu le plus proche si l'endroit exact n'est pas listé (ex : une salle de l'Académie → konoha). "lieu_detail" : précision courte (ex : « Terrain d'entraînement n°3 »).
- "journal" : entrée du « Journal de Konoha », une chronique en 3e personne (60 à 130 mots) de ce qui se passe AILLEURS dans le monde du manga, hors du regard du joueur : événements canoniques importants, conversations entre personnages (Naruto et Iruka, Sasuke seul, Hokage et conseillers…), rumeurs, mouvements d'Orochimaru, de l'Akatsuki, etc. Elle suit le canon et tient compte des divergences causées par le joueur. Ne révèle jamais le secret du joueur. Mets une entrée la plupart des tours (au moins un tour sur deux) ; sinon null.
- "memo" : UNE phrase factuelle résumant ce qui vient de se passer de durable (qui a dit/fait quoi, décisions, blessures, promesses).
- "choix" : exactement 3 suggestions courtes (moins de 15 mots) : une prudente, une audacieuse, une sociale ou stratégique. Le joueur peut aussi écrire librement.

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour ni balises Markdown, de cette forme :
{
  "titre": "Titre court de la scène",
  "texte": "Narration…",
  "effets": { "pv": 0, "chakra": -5, "stats": {"taijutsu": 1}, "relations": {"naruto": 4}, "notes_pnj": {"naruto": "Il te trouve étrange mais sympa."}, "rencontre": ["naruto"], "lieu": "konoha", "lieu_detail": "Académie" },
  "nouveaux_pnj": [ { "id": "exemple", "prenom": "…", "nom": "…", "age": 12, "clan": "…", "village": "…", "role": "…", "relation": 0, "description": "…" } ],
  "journal": { "titre": "…", "texte": "…" },
  "canon_avance": 0,
  "fil_realise": [],
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
  const gc = { responseMimeType: 'application/json' };   // pas de temperature : refusée par les modèles Gemini récents
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
function lireJSON(txt) {
  let t = String(txt || '').replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim();
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  let rep;
  try { rep = JSON.parse(t); }
  catch (e1) {
    try { rep = JSON.parse(t.replace(/[\u0000-\u001F]+/g, ' ')); }       // retours à la ligne bruts dans les textes
    catch (e2) { const err = new Error('Réponse illisible (JSON incomplet ou mal copié).'); err.temp = true; throw err; }
  }
  if (!rep || !rep.texte) { const err = new Error('JSON incomplet : le champ « texte » est absent.'); err.temp = true; throw err; }
  if (!Array.isArray(rep.choix) || rep.choix.length < 2) rep.choix = ['Observer la situation avant d’agir', 'Parler à quelqu’un', 'Passer à l’action'];
  return rep;
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
  return lireJSON(txt);
}

/* ---------- Mode manuel : copier-coller avec l'appli Gemini (ou tout autre chatbot) ---------- */
function rappelEtat() {
  const ev = CANON.evenements, i = state.canonIndex, cur = ev[i], lieu = lieuActuel();
  const pnj = state.chars.filter(c => c.rencontre).map(c => `${c.id} (${c.prenom} ${c.nom}) ${sg(c.relation)}`).join(' ; ') || 'aucun';
  return `[MISE À JOUR DE L'ÉTAT — tour ${state.tour}]
PV ${state.pv.actuel}/${state.pv.max} · Chakra ${state.chakra.actuel}/${state.chakra.max} · ${STAT_KEYS.map(k => k + ' ' + state.stats[k]).join(', ')}
Position : ${lieu.nom} (id ${lieu.id})${state.position.detail ? ' — ' + state.position.detail : ''}
PNJ rencontrés (relation) : ${pnj}
ÉVÉNEMENT CANON EN COURS : ${cur ? '« ' + cur.titre + ' » — ' + cur.resume : 'fin de la chronologie'}
Prochains : ${ev.slice(i + 1, i + 4).map(e => '« ' + e.titre + ' »').join(' → ') || '—'}
Mémoire récente : ${state.memo.slice(-5).join(' | ') || '—'}
Divergences : ${state.divergences.slice(-5).join(' | ') || 'aucune'}
FIL CONDUCTEUR DU JOUEUR (respecte les moments indiqués ; ajoute l'id dans "fil_realise" quand c'est mis en scène) :
${filTexte()}
(Rappel : continue l'histoire en respectant toutes les règles du prompt initial et réponds UNIQUEMENT par le JSON au même format.)`;
}
function copierSecours() { const z = $('#man-prompt'); z.select(); try { document.execCommand('copy'); } catch (e) {} }
function copier(texte) {
  if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(texte).catch(copierSecours);
  copierSecours(); return Promise.resolve();
}
function appelManuel(action, statut) {
  return new Promise((resolve, reject) => {
    const dlg = $('#dlg-manuel');
    const construire = () => {
      $('#man-prompt').value = $('#man-complet').checked
        ? promptSysteme() + '\n\n== PREMIÈRE ACTION DU JOUEUR ==\n' + action
        : rappelEtat() + '\n\nACTION DU JOUEUR : ' + action;
    };
    $('#man-complet').checked = !state.manuelDemarre;
    $('#man-complet').onchange = construire;
    $('#man-reponse').value = ''; $('#man-erreur').textContent = '';
    construire();
    if (statut) statut('En attente de la réponse de Gemini (mode copier-coller)…');
    $('#man-copier').onclick = async () => {
      await copier($('#man-prompt').value);
      $('#man-copier').textContent = '✅ Copié !';
      setTimeout(() => { $('#man-copier').textContent = '📋 Copier le prompt'; }, 1800);
    };
    $('#man-valider').onclick = () => {
      try {
        const rep = lireJSON($('#man-reponse').value);
        dlg._fini = true; state.manuelDemarre = true; dlg.close('ok'); resolve(rep);
      } catch (e) { $('#man-erreur').textContent = '⚠️ ' + e.message + ' Vérifie que tu as copié toute la réponse de Gemini.'; }
    };
    $('#man-annuler').onclick = () => dlg.close('cancel');
    const fermeture = () => {
      dlg.removeEventListener('close', fermeture);
      if (!dlg._fini) { const err = new Error('Tour annulé.'); err.annule = true; reject(err); }
      dlg._fini = false;
    };
    dlg.addEventListener('close', fermeture);
    dlg.showModal();
  });
}

async function appelGemini(action, statut) {
  if (ia.cfg.mode === 'manuel') return appelManuel(action, statut);
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
          if (essai < 2) { if (statut) statut(`Google est occupé… nouvel essai ${essai + 2}/3 dans quelques secondes`); await sleep(ia.delais[essai]); }
        }
      }
      if (m < modeles.length - 1 && statut) statut('Bascule vers le modèle de secours…');
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
  Object.entries(bornes(e.stats, -2, 2, STAT_KEYS)).forEach(([k, d]) => {
    if (!d) return; state.stats[k] = clamp(state.stats[k] + d, 0, 100); add(`${cap(k)} ${sg(d)}`, d > 0 ? 'pos' : 'neg');
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
  (Array.isArray(rep.fil_realise) ? rep.fil_realise : []).forEach(id => {
    const b = (state.fil || []).find(x => x.id === id);
    if (b && !b.fait) { b.fait = true; add(`🧭 Fil conducteur : ${b.quoi.slice(0, 40)}${b.quoi.length > 40 ? '…' : ''}`, 'info'); }
  });
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
    const rep = await appelGemini(action, t => { const p = attente.querySelector('p'); if (p) p.textContent = t; });
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
    mjEcrire('systeme', err.annule
      ? 'Tour annulé. Clique sur « Réessayer » quand tu veux continuer.'
      : `⚠️ Erreur IA : ${err.message}\n${err.temp ? 'Le serveur de Google est surchargé ou injoignable : c’est temporaire. Clique sur « Réessayer » dans un instant (ou renseigne un modèle de secours dans ⚙️ IA).' : 'Vérifie ta clé et ton modèle (⚙️ IA) puis clique sur « Réessayer ».'}`, null, null, false);
    renderRetry();
  } finally {
    ia.busy = false; $('#mj-input').disabled = false; majBoutonUndo(); save();
  }
}
function annulerTour() {
  if (!state.undo || ia.busy) return;
  if (!confirm('Annuler le dernier tour et revenir juste avant ?')) return;
  state = { ...etatVide(), ...JSON.parse(state.undo), undo: null };
  if (ia.cfg.mode === 'manuel') {
    state.manuelDemarre = false;
    mjEcrire('systeme', 'Mode manuel : ouvre une NOUVELLE conversation Gemini, le prochain prompt sera complet.', null, null, false);
  }
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
  const m = $('#ia-mode').value;
  $('#ia-l-key').style.display = m === 'direct' ? '' : 'none';
  $('#ia-l-proxy').style.display = m === 'proxy' ? '' : 'none';
  $('#ia-l-model').style.display = m === 'manuel' ? 'none' : '';
  $('#ia-l-fallback').style.display = m === 'manuel' ? 'none' : '';
  $('#ia-info-manuel').style.display = m === 'manuel' ? '' : 'none';
}

/* ---------- Événements ---------- */
function changeTab(name) {
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + name));
  if (name === 'fiche') renderFiche();
  if (name === 'fil') renderFil();
}
function bindUI() {
  initCarte(); initPhotos();
  initFilEditor($('#fil-creation')); initFilEditor($('#tab-fil'));
  $('#tab-fil').addEventListener('click', e => {
    if (e.target.id !== 'fil-save') return;
    state.fil = lireFil($('#fil-editeur'));
    save(); renderFil();
    const m = $('#fil-msg'); if (m) m.textContent = '✅ Enregistré';
  });
  $$('.tab').forEach(b => b.addEventListener('click', () => changeTab(b.dataset.tab)));
  $('#form-perso').addEventListener('submit', creerPerso);

  const envoyerLibre = () => { const v = $('#mj-input').value.trim(); if (!v || ia.busy) return; $('#mj-input').value = ''; tourIA(v); };
  $('#mj-form').addEventListener('submit', e => { e.preventDefault(); envoyerLibre(); });
  $('#mj-input').addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); envoyerLibre(); } });
  $('#btn-undo').addEventListener('click', annulerTour);

  $('#btn-reset').addEventListener('click', () => {
    if (confirm('Effacer cette partie et créer un nouveau personnage ? (ta clé API et les photos des PNJ sont conservées)')) {
      localStorage.removeItem(SAVE_KEY); delete photos.player; savePhotos(); location.reload();
    }
  });

  /* Réglages IA */
  const dlg = $('#dlg-ia');
  $('#btn-ia').addEventListener('click', async () => { if (await ouvrirReglages()) { renderHeader(); if (state.cree) lancerOuReprendre(); } });
  $('#ia-mode').addEventListener('change', majModeIA);
  $('#ia-cancel').addEventListener('click', () => dlg.close('cancel'));
  $('#ia-clear').addEventListener('click', () => {
    localStorage.removeItem(CFG_KEY);
    ia.cfg = { mode: 'direct', apiKey: '', proxyUrl: '', model: 'gemini-3.8-flash', fallback: '' };
    dlg.close('cancel'); renderHeader();
  });
  $('#ia-save').addEventListener('click', () => {
    ia.cfg = { mode: $('#ia-mode').value, apiKey: $('#ia-key').value.trim(), proxyUrl: $('#ia-proxy').value.trim(),
               model: $('#ia-model').value.trim() || 'gemini-3.8-flash', fallback: $('#ia-fallback').value.trim() };
    try { localStorage.setItem(CFG_KEY, JSON.stringify(ia.cfg)); } catch (e) {}
    dlg.close('ok');
  });
  dlg.addEventListener('close', () => {
    if (dlg._resolve) { const r = dlg._resolve; dlg._resolve = null; r(dlg.returnValue === 'ok' && iaPret()); }
  });
}

document.addEventListener('DOMContentLoaded', init);
