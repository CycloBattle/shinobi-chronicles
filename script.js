'use strict';

/* ================= Utilitaires ================= */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const sg = n => (n > 0 ? '+' : '') + n;
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SAVE_KEY = 'shinobi-chronicles-save-v1';

/* Lieux cliquables (coordonnées en % de la carte) */
const LIEUX = [
  { id: 'konoha',  nom: 'Konoha (Village de la Feuille)', x: 42.7, y: 59.9 },
  { id: 'foret',   nom: 'Forêt de la Mort',               x: 43.4, y: 63.0 },
  { id: 'temple',  nom: 'Temple du Feu',                  x: 34.5, y: 55.2 },
  { id: 'vallee',  nom: 'Vallée de la Fin',               x: 45.4, y: 50.4 },
  { id: 'oto',     nom: 'Village du Son',                 x: 46.2, y: 44.1 },
  { id: 'taki',    nom: 'Village de la Cascade',          x: 37.4, y: 44.6 },
  { id: 'yu',      nom: 'Village des Sources Chaudes',    x: 50.8, y: 41.9 },
  { id: 'kusa',    nom: 'Village de l’Herbe',             x: 28.6, y: 54.5 },
  { id: 'ame',     nom: 'Village de la Pluie',            x: 27.3, y: 62.1 },
  { id: 'tetsu',   nom: 'Pays du Fer',                    x: 42.8, y: 33.4 },
  { id: 'iwa',     nom: 'Village de la Roche (Iwa)',      x: 24.3, y: 33.1 },
  { id: 'suna',    nom: 'Village du Sable (Suna)',        x: 19.8, y: 86.2 },
  { id: 'kumo',    nom: 'Village des Nuages (Kumo)',      x: 72.2, y: 28.3 },
  { id: 'kiri',    nom: 'Village de la Brume (Kiri)',     x: 82.9, y: 75.4 },
  { id: 'yuki',    nom: 'Village de la Neige',            x: 56.6, y: 4.0 }
];

/* ================= Scénario (moteur narratif simulé) =================
   effets possibles : pv, chakra, stats{}, relations{id:delta}, pays{id:delta},
   rencontre[], objet{}, quete{}, termine:'id', lieu:'idLieu'                */
const SCENES = {
  start: {
    titre: 'Aube sur Konoha',
    texte: "Les premiers rayons éclairent le monument des Hokage. Une rumeur circule : un déserteur de Kiri rôderait près de la Forêt de la Mort, et des silhouettes à manteau noir ont été aperçues aux frontières du Pays du Feu. Tsunade t'a laissé carte blanche pour décider de ta priorité.",
    choix: [
      { label: "🥋 Rejoindre Kakashi pour un entraînement avant la mission", next: 'kakashi',
        res: "Kakashi t'attend près du terrain 7, un livre orange à la main. « Tu es en avance. Voyons ce que tu vaux vraiment. »",
        effets: { rencontre: ['kakashi'], relations: { kakashi: 8 }, chakra: -15, stats: { taijutsu: 3, ninjutsu: 2 } } },
      { label: "🌲 Enquêter seul dans la Forêt de la Mort", next: 'foret',
        res: "Tu t'enfonces sous la canopée dense. L'air est lourd, saturé de chakra étranger.",
        effets: { lieu: 'foret' } },
      { label: "⛩️ Rejoindre le Daimyo en pèlerinage au Temple du Feu", next: 'temple',
        res: "Le sentier mène au Temple du Feu, gardé par quelques moines et une escorte discrète.",
        effets: { lieu: 'temple', rencontre: ['daimyo'] } }
    ]
  },
  kakashi: {
    titre: 'Sous l’œil du Sharingan',
    texte: "Après l'échange, Kakashi range son livre. « Un ninja de Kiri a été vu dans la forêt. Je ne peux pas quitter le village ce matin… mais toi, si. Ou bien va informer le Daimyo : sa sécurité prime. »",
    choix: [
      { label: "🌲 Partir pour la Forêt de la Mort", next: 'foret', res: "Kakashi hoche la tête : « Reviens vivant. »", effets: { lieu: 'foret' } },
      { label: "⛩️ Escorter le Daimyo au Temple du Feu", next: 'temple', res: "Tu files vers le Temple du Feu.", effets: { lieu: 'temple', rencontre: ['daimyo'] } },
      { label: "🍵 Te reposer au village", next: 'hub', res: "Tu retrouves un peu de souffle dans une échoppe de thé.", effets: { pv: 15, chakra: 20 } }
    ]
  },
  foret: {
    titre: 'Forêt de la Mort',
    texte: "Une lame traverse l'obscurité et se plante dans un tronc à quelques centimètres de ton visage. Ryōga Hozuki, nukenin de Kiri, descend d'une branche, son immense épée sur l'épaule. « Un ninja de Konoha… Le Mizukage me veut mort, mais toi, tu vas m'être utile. »",
    choix: [
      { label: "⚔️ Engager le combat", next: 'akatsuki', res: "L'échange est brutal. Tu parviens à le repousser, mais sa lame t'a entaillé le flanc.",
        effets: { rencontre: ['ryoga'], relations: { ryoga: -25 }, pv: -22, chakra: -20, stats: { taijutsu: 3 } } },
      { label: "🗣️ Tenter de négocier", next: 'akatsuki', res: "Tu abaisses ta garde. Ryōga rit, puis raconte qu'on l'a trahi. Il te laisse partir avec une information.",
        effets: { rencontre: ['ryoga'], relations: { ryoga: 20 }, chakra: -5, pays: { eau: -3 } } },
      { label: "💨 Utiliser une bombe fumigène et fuir", next: 'hub', res: "Tu disparais dans la fumée. Ryōga hurle de rage derrière toi.",
        effets: { rencontre: ['ryoga'], relations: { ryoga: -10 }, chakra: -8, lieu: 'konoha' } }
    ]
  },
  temple: {
    titre: 'Le Temple du Feu',
    texte: "Le Daimyo t'accueille entre deux prières. « Les temps sont troublés, jeune shinobi. On m'a dit que l'Akatsuki cherche à déstabiliser mon pays. Je te confie une mission : découvre qui rôde aux frontières. »",
    choix: [
      { label: "✅ Accepter la mission du Daimyo", next: 'foret', res: "Le Daimyo te remet un sceau officiel. Ton nom sera désormais cité à la cour.",
        effets: { relations: { daimyo: 15 }, pays: { feu: 4 }, objet: { id: 'sceau', nom: 'Sceau du Daimyo', type: 'equipement', quantite: 1, description: "Ouvre les portes des villes du Pays du Feu." },
                  quete: { id: 'q_frontieres', titre: 'Les ombres des frontières', description: "Enquêter sur la présence de l'Akatsuki aux frontières du Pays du Feu.", recompense: '2 000 Ryō' }, lieu: 'foret' } },
      { label: "🙇 Décliner poliment", next: 'hub', res: "Le Daimyo fronce les sourcils, mais n'insiste pas.", effets: { relations: { daimyo: -10 }, pays: { feu: -2 } } }
    ]
  },
  akatsuki: {
    titre: 'Manteau aux nuages rouges',
    texte: "Une explosion déchire le ciel. Deidara, de l'Akatsuki, plane sur un oiseau d'argile. « Quel beau spectacle en perspective, hm ! Ton village serait une magnifique œuvre d'art. »",
    choix: [
      { label: "🔥 L'affronter", next: 'hub', res: "Tu esquives de justesse une vague d'explosifs. Ton Ninjutsu progresse sous la pression, mais tu es blessé.",
        effets: { rencontre: ['deidara'], relations: { deidara: -30 }, pv: -30, chakra: -25, stats: { ninjutsu: 4 }, pays: { feu: 2 } } },
      { label: "🤝 Gagner du temps avec un genjutsu", next: 'hub', res: "Ton illusion le déconcerte quelques secondes ; il se retire en jurant de revenir.",
        effets: { rencontre: ['deidara'], relations: { deidara: -10 }, chakra: -20, stats: { genjutsu: 4 } } },
      { label: "📨 Alerter l'Hokage immédiatement", next: 'hub', res: "Tu envoies un faucon messager. Tsunade déploie des ANBU aux frontières.",
        effets: { rencontre: ['tsunade'], relations: { tsunade: 12 }, pays: { feu: 3, vent: -1 }, chakra: -5, termine: 'q_frontieres' } }
    ]
  },
  hub: {
    titre: 'Entre deux missions',
    texte: "Le calme revient pour quelques heures. Le monde shinobi, lui, ne dort jamais. Que décides-tu de faire ?",
    choix: [
      { label: "🏯 Retourner à Konoha et recevoir de nouvelles missions", next: 'start', res: "Tu rentres au village.", effets: { lieu: 'konoha' } },
      { label: "🌲 Poursuivre l'enquête sur le terrain", next: 'foret', res: "Tu repars vers la forêt.", effets: { lieu: 'foret' } }
    ]
  }
};

/* ================= État ================= */
const state = { player: null, chars: [], scene: 'start', tour: 1 };

/* ================= Chargement ================= */
async function init() {
  try {
    const [player, chars] = await Promise.all([
      fetch('data/player.json').then(r => r.json()),
      fetch('data/characters.json').then(r => r.json())
    ]);
    state.player = player; state.chars = chars;
    const saved = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
    if (saved) Object.assign(state, saved);
  } catch (e) {
    console.error(e);
    $('#tab-mj').innerHTML = "<p class='msg systeme'>Impossible de charger les données. Lance le projet via GitHub Pages ou un serveur local (ex : <code>python -m http.server</code>), pas en double-cliquant sur index.html.</p>";
    return;
  }
  bindUI();
  renderAll();
  placePion(false);
  buildMarkers();
  mjIntro();
}

function save() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify({ player: state.player, chars: state.chars, scene: state.scene, tour: state.tour })); } catch (e) {}
}

/* ================= Rendu ================= */
function bar(label, val, max, cls) {
  const pct = Math.round(clamp(val / max, 0, 1) * 100);
  return `<div class="bar-row"><span>${label}</span><span>${val}${max !== 100 || cls === 'pv' ? ' / ' + max : ''}</span></div>
          <div class="bar"><div class="fill ${cls}" data-w="${pct}"></div></div>`;
}
function animateBars() {
  requestAnimationFrame(() => requestAnimationFrame(() => $$('.fill[data-w]').forEach(f => f.style.width = f.dataset.w + '%')));
}

function renderFiche() {
  const p = state.player, i = p.identite;
  $('#tab-fiche').innerHTML = `
    <div class="card"><h2>${i.prenom} ${i.nom}</h2>
      <dl class="ident">
        <dt>Clan</dt><dd>${i.clan}</dd><dt>Village</dt><dd>${i.village}</dd>
        <dt>Âge</dt><dd>${i.age} ans</dd><dt>Rang</dt><dd>${i.rang}</dd>
      </dl></div>
    <div class="card"><h3>Vitalité</h3>
      ${bar('Points de vie', p.pv.actuel, p.pv.max, 'pv')}
      ${bar('Réserve de chakra', p.chakra.actuel, p.chakra.max, 'chakra')}</div>
    <div class="card"><h3>Maîtrise des arts shinobi</h3>
      ${Object.entries(p.stats).map(([k, v]) => bar(cap(k), v, 100, k)).join('')}</div>`;
  animateBars();
}

function renderInventaire() {
  const types = { arme: '⚔️ Armes', parchemin: '📜 Parchemins', soin: '💊 Soins', equipement: '🛡️ Équipements spéciaux' };
  const inv = state.player.inventaire;
  $('#tab-inventaire').innerHTML = Object.entries(types).map(([t, titre]) => {
    const items = inv.filter(o => o.type === t);
    if (!items.length) return '';
    return `<div class="card"><h3>${titre}</h3>${items.map(o => `
      <div class="item"><div><span class="qty">×${o.quantite}</span><strong>${o.nom}</strong><small>${o.description}</small></div>
      ${o.effet ? `<button class="btn" data-use="${o.id}">Utiliser</button>` : ''}</div>`).join('')}</div>`;
  }).join('') || '<p class="hint">Inventaire vide.</p>';
}

function renderQuetes() {
  const p = state.player, q = p.quetes;
  const li = (x, done) => `<div class="item"><div><strong>${x.titre}</strong><small>${x.description}</small>
      <small>🎁 ${x.recompense || '—'}</small></div><span class="badge ${done ? 'done' : ''}">${done ? 'Terminée' : 'Active'}</span></div>`;
  const statut = v => v >= 70 ? 'Stable' : v >= 40 ? 'Tendu' : 'En crise';
  $('#tab-quetes').innerHTML = `
    <div class="card"><h3>⭐ Quête principale</h3>
      <div class="item"><div><strong>${p.quete_principale.titre}</strong><small>${p.quete_principale.description}</small></div><span class="badge">Principale</span></div></div>
    <div class="card"><h3>Missions actives</h3>${q.filter(x => x.statut === 'active').map(x => li(x, false)).join('') || '<p class="hint">Aucune mission active.</p>'}</div>
    <div class="card"><h3>Missions terminées</h3>${q.filter(x => x.statut === 'terminee').map(x => li(x, true)).join('') || '<p class="hint">Aucune mission terminée.</p>'}</div>
    <div class="card"><h3>🌍 Géopolitique des 5 Grands Pays</h3>
      ${p.geopolitique.map(g => `<div class="bar-row"><span>${g.nom} <small>(${g.capitale})</small></span><span>${statut(g.stabilite)} · ${g.stabilite}%</span></div>
        <div class="bar"><div class="fill stab" data-w="${g.stabilite}"></div></div>
        <small class="hint">${g.note}</small>`).join('')}</div>`;
  animateBars();
}

function relColor(v) { const h = v < 0 ? (v + 100) * 0.3 : 30 + v * 0.9; return `hsl(${h} 75% 48%)`; }
function relLabel(v) {
  return v <= -60 ? 'Ennemi juré' : v < -20 ? 'Hostile' : v <= 20 ? 'Neutre' : v < 60 ? 'Amical' : v < 90 ? 'Allié' : 'Lien profond';
}
function majRel(card) {
  const c = state.chars.find(x => x.id === card.dataset.id), col = relColor(c.relation);
  card.style.setProperty('--rc', col);
  const val = $('.rel-val', card); val.textContent = sg(c.relation) + '%'; val.style.color = col;
  const lab = $('.rel-label', card); lab.textContent = relLabel(c.relation); lab.style.color = col;
}
function renderPNJ() {
  const met = state.chars.filter(c => c.rencontre);
  $('#tab-pnj').innerHTML = `<p class="hint">${met.length} / ${state.chars.length} personnages rencontrés</p>` +
    (met.map(c => `
      <article class="card pnj" data-id="${c.id}">
        <header><h3>${c.prenom} ${c.nom}</h3><span class="badge">${c.village}</span></header>
        <p class="meta">${c.age} ans · Clan ${c.clan} · ${c.role}</p>
        <p>${c.description}</p>
        <div class="rel"><div class="rel-head"><span class="rel-label"></span><strong class="rel-val"></strong></div>
          <input type="range" class="rel-range" min="-100" max="100" step="1" value="${c.relation}" aria-label="Relation avec ${c.prenom}"></div>
      </article>`).join('') || '<p class="hint">Tu n’as encore rencontré personne.</p>');
  $$('.pnj').forEach(majRel);
}

function renderHeader() { $('#tour-indicator').textContent = 'Tour ' + state.tour; }
function renderAll() { renderFiche(); renderInventaire(); renderQuetes(); renderPNJ(); renderHeader(); save(); }

/* ================= Carte & déplacement ================= */
function buildMarkers() {
  $('#markers').innerHTML = '';
  LIEUX.forEach(l => {
    const m = document.createElement('div');
    m.className = 'marker'; m.title = l.nom;
    m.style.left = l.x + '%'; m.style.top = l.y + '%';
    m.addEventListener('click', e => { e.stopPropagation(); deplacer(l.x, l.y); });
    $('#markers').appendChild(m);
  });
}
function lieuProche(x, y) {
  let best = null, d = Infinity;
  LIEUX.forEach(l => { const dd = Math.hypot((l.x - x) * 1.76, l.y - y); if (dd < d) { d = dd; best = l; } });
  return { lieu: best, dist: d };
}
function placePion() {
  const { x, y } = state.player.position;
  const pion = $('#pion'); pion.style.left = x + '%'; pion.style.top = y + '%';
  $('#coord-x').value = x.toFixed(1); $('#coord-y').value = y.toFixed(1);
  $('#coord-xv').textContent = x.toFixed(1); $('#coord-yv').textContent = y.toFixed(1);
  const { lieu, dist } = lieuProche(x, y);
  $('#coord-lieu').textContent = dist < 4 ? lieu.nom : 'Près de ' + lieu.nom.split(' (')[0];
}
function deplacer(x, y, gratuit = false) {
  const p = state.player;
  x = clamp(+x, 0, 100); y = clamp(+y, 0, 100);
  const dist = Math.hypot((x - p.position.x) * 1.76, y - p.position.y);
  const cout = gratuit ? 0 : Math.round(dist / 6);
  if (cout > p.chakra.actuel) { mjEcrire('systeme', `Pas assez de chakra pour ce trajet (${cout} requis, ${p.chakra.actuel} disponible). Repose-toi ou choisis une destination plus proche.`); return false; }
  p.chakra.actuel -= cout; p.position = { x, y };
  placePion(); renderFiche(); save();
  const { lieu, dist: d } = lieuProche(x, y);
  mjEcrire('systeme', `Déplacement vers ${d < 4 ? lieu.nom : 'les environs de ' + lieu.nom.split(' (')[0]}${cout ? ` (−${cout} chakra)` : ''}.`);
  return true;
}

/* ================= Effets de jeu ================= */
function appliquer(e = {}) {
  const p = state.player, notes = [];
  const add = (txt, pos) => notes.push({ txt, pos });
  if (e.pv)     { p.pv.actuel = clamp(p.pv.actuel + e.pv, 0, p.pv.max); add(`PV ${sg(e.pv)}`, e.pv > 0); }
  if (e.chakra) { p.chakra.actuel = clamp(p.chakra.actuel + e.chakra, 0, p.chakra.max); add(`Chakra ${sg(e.chakra)}`, e.chakra > 0); }
  Object.entries(e.stats || {}).forEach(([k, d]) => { p.stats[k] = clamp(p.stats[k] + d, 0, 100); add(`${cap(k)} ${sg(d)}`, d > 0); });
  (e.rencontre || []).forEach(id => { const c = state.chars.find(x => x.id === id); if (c && !c.rencontre) { c.rencontre = true; add(`Nouveau PNJ : ${c.prenom} ${c.nom}`, true); } });
  Object.entries(e.relations || {}).forEach(([id, d]) => {
    const c = state.chars.find(x => x.id === id); if (!c) return;
    c.relation = clamp(c.relation + d, -100, 100); c.rencontre = true; add(`${c.prenom} : relation ${sg(d)}%`, d > 0);
  });
  Object.entries(e.pays || {}).forEach(([id, d]) => {
    const g = p.geopolitique.find(x => x.id === id); if (!g) return;
    g.stabilite = clamp(g.stabilite + d, 0, 100); add(`${g.nom} : stabilité ${sg(d)}`, d > 0);
  });
  if (e.objet) {
    const ex = p.inventaire.find(o => o.id === e.objet.id);
    if (ex) ex.quantite += e.objet.quantite; else p.inventaire.push({ ...e.objet });
    add(`Objet obtenu : ${e.objet.nom}`, true);
  }
  if (e.quete && !p.quetes.some(q => q.id === e.quete.id)) { p.quetes.push({ ...e.quete, statut: 'active' }); add(`Nouvelle quête : ${e.quete.titre}`, true); }
  if (e.termine) { const q = p.quetes.find(x => x.id === e.termine); if (q && q.statut !== 'terminee') { q.statut = 'terminee'; add(`Quête terminée : ${q.titre}`, true); } }
  if (e.lieu) { const l = LIEUX.find(x => x.id === e.lieu); if (l) { p.position = { x: l.x, y: l.y }; placePion(); } }
  if (p.pv.actuel <= 0) {
    p.pv.actuel = 20; p.position = { x: LIEUX[0].x, y: LIEUX[0].y }; state.scene = 'hub'; placePion();
    add('KO : évacué à l’hôpital de Konoha (PV 20)', false);
  }
  return notes;
}

/* ================= Console Maître du Jeu ================= */
function mjEcrire(type, texte, titre, notes) {
  const log = $('#mj-log'), d = document.createElement('div');
  d.className = 'msg ' + type;
  if (titre) { const h = document.createElement('h4'); h.textContent = titre; d.appendChild(h); }
  const para = document.createElement('p'); para.textContent = texte; d.appendChild(para);
  if (notes && notes.length) {
    const c = document.createElement('div'); c.className = 'chips';
    notes.forEach(n => { const s = document.createElement('span'); s.className = 'chip ' + (n.pos ? 'pos' : 'neg'); s.textContent = n.txt; c.appendChild(s); });
    d.appendChild(c);
  }
  log.appendChild(d); log.scrollTop = log.scrollHeight;
}
function renderChoix(bloque = false) {
  const box = $('#mj-choix'); box.innerHTML = '';
  SCENES[state.scene].choix.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice'; b.textContent = `${i + 1}. ${c.label}`; b.disabled = bloque;
    b.addEventListener('click', () => choisir(i)); box.appendChild(b);
  });
}
function mjIntro() {
  const s = SCENES[state.scene];
  mjEcrire('systeme', 'La partie commence. Le Maître du Jeu (simulation) prend la parole…');
  mjEcrire('mj', s.texte, s.titre); renderChoix();
}
async function choisir(i) {
  const c = SCENES[state.scene].choix[i];
  renderChoix(true);
  mjEcrire('joueur', c.label);
  await sleep(600);
  const notes = appliquer(c.effets);
  mjEcrire('mj', c.res, 'Conséquences', notes);
  state.tour++;
  const ko = state.scene === 'hub' && state.player.pv.actuel === 20 && notes.some(n => n.txt.startsWith('KO'));
  state.scene = ko ? 'hub' : (SCENES[c.next] ? c.next : 'hub');
  await sleep(700);
  const s = SCENES[state.scene];
  mjEcrire('mj', s.texte, s.titre);
  renderChoix(); renderAll();
}
function actionLibre(texte) {
  const t = texte.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (/repos|dorm|soign|medit|pause/.test(t)) return { res: "Tu t'accordes une pause, le temps de reprendre des forces.", effets: { pv: 15, chakra: 20 } };
  if (/entrain|pratiq|appren|exerc/.test(t))  return { res: "Tu t'exerces jusqu'à épuisement. Chaque geste devient plus précis.", effets: { chakra: -12, stats: { taijutsu: 2, ninjutsu: 1 } } };
  if (/scell|fuin|parchemin/.test(t))         return { res: "Tu traces des sceaux avec minutie, un art exigeant et précis.", effets: { chakra: -10, stats: { fuinjutsu: 3 } } };
  if (/illusion|genjutsu/.test(t))            return { res: "Tu travailles tes illusions, trompant tes propres sens.", effets: { chakra: -8, stats: { genjutsu: 3 } } };
  if (/attaq|combat|frappe|defi|bagarr/.test(t)) return { res: "Tu provoques un affrontement imprudent. Tu en sors meurtri, mais plus aguerri.", effets: { pv: -15, stats: { taijutsu: 2 } } };
  if (/parl|discut|negoc|salu|diplom/.test(t)) return { res: "Tes paroles circulent et renforcent ta réputation auprès des autorités locales.", effets: { pays: { feu: 1 } } };
  return { res: "Tu agis à ta façon. Le monde shinobi observe, sans qu'aucune conséquence immédiate n'apparaisse… pour l'instant.", effets: { chakra: -2 } };
}
async function soumettreLibre(texte) {
  mjEcrire('joueur', texte);
  await sleep(600);
  const r = actionLibre(texte), notes = appliquer(r.effets);
  mjEcrire('mj', r.res, 'Résultat de ton action', notes);
  state.tour++; renderAll(); renderChoix();
}

/* ================= Événements ================= */
function bindUI() {
  $$('.tab').forEach(b => b.addEventListener('click', () => {
    $$('.tab').forEach(t => t.classList.toggle('active', t === b));
    $$('.tab-panel').forEach(p => p.classList.toggle('active', p.id === 'tab-' + b.dataset.tab));
    if (b.dataset.tab === 'fiche') renderFiche();
    if (b.dataset.tab === 'quetes') renderQuetes();
  }));
  $('#map-wrap').addEventListener('click', e => {
    const r = $('#map-img').getBoundingClientRect();
    deplacer(((e.clientX - r.left) / r.width) * 100, ((e.clientY - r.top) / r.height) * 100);
  });
  $('#coord-go').addEventListener('click', () => deplacer($('#coord-x').value, $('#coord-y').value));
  $('#tab-pnj').addEventListener('input', e => {
    if (!e.target.classList.contains('rel-range')) return;
    const card = e.target.closest('.pnj');
    state.chars.find(c => c.id === card.dataset.id).relation = +e.target.value;
    majRel(card); save();
  });
  $('#tab-inventaire').addEventListener('click', e => {
    const id = e.target.dataset.use; if (!id) return;
    const o = state.player.inventaire.find(x => x.id === id); if (!o) return;
    const notes = appliquer(o.effet);
    o.quantite--; if (o.quantite <= 0) state.player.inventaire = state.player.inventaire.filter(x => x !== o);
    mjEcrire('mj', `Tu utilises : ${o.nom}.`, 'Objet utilisé', notes);
    renderAll();
  });
  $('#mj-form').addEventListener('submit', e => {
    e.preventDefault(); const v = $('#mj-input').value.trim(); if (!v) return;
    $('#mj-input').value = ''; soumettreLibre(v);
  });
  $('#btn-reset').addEventListener('click', () => {
    if (confirm('Effacer la sauvegarde et recommencer ?')) { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('shinobi-ia-v1'); location.reload(); }
  });
}

document.addEventListener('DOMContentLoaded', init);
