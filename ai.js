'use strict';
/* =====================================================
   ai.js – Maître du Jeu propulsé par Gemini
   À charger APRÈS script.js
   ===================================================== */
const IA_SAVE_KEY = 'shinobi-ia-v1';
const IA_CFG_KEY  = 'shinobi-ia-config';
const ia = {
  cfg: { mode: 'direct', apiKey: '', proxyUrl: '', model: 'gemini-2.5-flash' },
  histo: [], choix: [], derniere: null, actif: false
};

/* ---------- Config & sauvegarde ---------- */
try { Object.assign(ia.cfg, JSON.parse(localStorage.getItem(IA_CFG_KEY) || '{}')); } catch (e) {}
try { Object.assign(ia, JSON.parse(localStorage.getItem(IA_SAVE_KEY) || '{}')); } catch (e) {}
ia.actif = ia.cfg.mode === 'proxy' ? !!ia.cfg.proxyUrl : !!ia.cfg.apiKey;

function sauverIA() {
  try { localStorage.setItem(IA_SAVE_KEY, JSON.stringify({ histo: ia.histo, choix: ia.choix, derniere: ia.derniere })); } catch (e) {}
}

/* ---------- Prompt système (reconstruit à chaque tour avec l'état réel) ---------- */
function promptSysteme() {
  const p = state.player, i = p.identite;
  const { lieu } = lieuProche(p.position.x, p.position.y);
  const pnj = state.chars.map(c => `- id "${c.id}" : ${c.prenom} ${c.nom} (${c.role}, ${c.village}) relation ${c.relation}${c.rencontre ? '' : ' [pas encore rencontré]'}`).join('\n');
  const pays = p.geopolitique.map(g => `- id "${g.id}" : ${g.nom}, stabilité ${g.stabilite}`).join('\n');
  const quetes = p.quetes.filter(q => q.statut === 'active').map(q => `${q.id} (${q.titre})`).join(' ; ') || 'aucune';
  const lieux = LIEUX.map(l => `${l.id}`).join(', ');
  const inv = p.inventaire.map(o => `${o.nom} ×${o.quantite}`).join(', ');

  return `Tu es le Maître du Jeu d'un JDR solo narratif et stratégique dans l'univers de Naruto. Ton style : sombre, immersif, cohérent avec le lore. Tu écris en français, à la deuxième personne ("tu").

JOUEUR : ${i.prenom} ${i.nom}, ${i.age} ans, clan ${i.clan}, village ${i.village}, rang ${i.rang}.
PV ${p.pv.actuel}/${p.pv.max} · Chakra ${p.chakra.actuel}/${p.chakra.max}
Stats (sur 100) : ${Object.entries(p.stats).map(([k, v]) => k + ' ' + v).join(', ')}
Position : près de "${lieu.nom}" (id ${lieu.id})
Inventaire : ${inv}
Quête principale : ${p.quete_principale.titre} — ${p.quete_principale.description}
Quêtes actives : ${quetes}

PNJ CONNUS :
${pnj}

PAYS (stabilité 0-100) :
${pays}

LIEUX DISPONIBLES (ids) : ${lieux}

RÈGLES :
- Narration de 80 à 150 mots. Les actions ont des conséquences réalistes : pas de victoire automatique, les actions risquées coûtent des PV et du chakra. Respecte l'état du joueur (chakra insuffisant = technique impossible).
- Si l'action du joueur est absurde ou toute-puissante (ex : "je tue Madara d'un doigt"), fais-la échouer ou détourne-la de façon cohérente.
- Fais vivre le monde : les PNJ ont leurs motivations, la géopolitique évolue selon les actes du joueur.
- Propose toujours exactement 3 choix courts (moins de 15 mots) : un stratégique, un prudent, un audacieux.
- Amplitudes : pv et chakra entre -40 et +40 ; stats entre -4 et +4 ; relations entre -30 et +30 ; pays entre -5 et +5. Mets 0 ou omets ce qui ne change pas.
- N'utilise que les ids existants pour relations, pays, lieu et rencontre. Pour un personnage inconnu, crée-le dans "nouveaux_pnj" (id unique en minuscules sans espace).
- "lieu" : id d'un lieu disponible si le joueur s'y déplace, sinon null.

Réponds UNIQUEMENT par un objet JSON valide, sans texte autour, de cette forme :
{
  "titre": "Titre court de la scène",
  "texte": "Narration…",
  "effets": {
    "pv": 0, "chakra": -10,
    "stats": { "taijutsu": 2 },
    "relations": { "kakashi": 5 },
    "pays": { "feu": 1 },
    "rencontre": ["kakashi"],
    "lieu": null
  },
  "nouveaux_pnj": [ { "id": "ex", "prenom": "…", "nom": "…", "age": 20, "clan": "…", "village": "…", "role": "…", "relation": 0, "description": "…" } ],
  "nouvelle_quete": { "id": "q_ex", "titre": "…", "description": "…", "recompense": "…" },
  "quete_terminee": null,
  "choix": ["Choix 1", "Choix 2", "Choix 3"]
}`;
}

/* ---------- Appel Gemini ---------- */
async function appelGemini(action) {
  ia.histo.push({ role: 'user', parts: [{ text: action }] });
  const hist = ia.histo.slice(-13);          // commence toujours par un message "user"
  const body = {
    systemInstruction: { parts: [{ text: promptSysteme() }] },
    contents: hist,
    generationConfig: { responseMimeType: 'application/json', temperature: 0.9 }
  };
  try {
    let res;
    if (ia.cfg.mode === 'proxy') {
      res = await fetch(ia.cfg.proxyUrl, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: ia.cfg.model, body })
      });
    } else {
      res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(ia.cfg.model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': ia.cfg.apiKey },
        body: JSON.stringify(body)
      });
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} — ${(await res.text()).slice(0, 250)}`);
    const data = await res.json();
    const txt = (data.candidates?.[0]?.content?.parts || []).map(p => p.text || '').join('');
    if (!txt) throw new Error('Réponse vide ou bloquée par les filtres de sécurité.');
    const rep = JSON.parse(txt.replace(/^\s*```(?:json)?/i, '').replace(/```\s*$/, '').trim());
    if (!rep.texte || !Array.isArray(rep.choix)) throw new Error('JSON incomplet renvoyé par le modèle.');
    ia.histo.push({ role: 'model', parts: [{ text: `${rep.texte}\n[Choix proposés : ${rep.choix.join(' | ')}]` }] });
    return rep;
  } catch (e) {
    ia.histo.pop();                           // garde l'alternance user/model
    throw e;
  }
}

/* ---------- Application sécurisée des effets ---------- */
function bornes(obj, min, max, clefsValides) {
  const out = {};
  Object.entries(obj || {}).forEach(([k, v]) => {
    v = Math.round(Number(v));
    if (!Number.isFinite(v) || (clefsValides && !clefsValides.includes(k))) return;
    out[k] = clamp(v, min, max);
  });
  return out;
}
function effetsDepuisReponse(r) {
  const p = state.player, e0 = r.effets || {};
  (r.nouveaux_pnj || []).forEach(n => {
    if (!n || !n.id || state.chars.some(c => c.id === n.id)) return;
    state.chars.push({ nom: '', age: '?', clan: 'Inconnu', village: 'Inconnu', role: '', description: '', ...n,
      relation: clamp(Math.round(Number(n.relation) || 0), -100, 100), rencontre: true });
  });
  const e = {
    pv: clamp(Math.round(Number(e0.pv) || 0), -40, 40),
    chakra: clamp(Math.round(Number(e0.chakra) || 0), -40, 40),
    stats: bornes(e0.stats, -4, 4, Object.keys(p.stats)),
    relations: bornes(e0.relations, -30, 30, state.chars.map(c => c.id)),
    pays: bornes(e0.pays, -5, 5, p.geopolitique.map(g => g.id)),
    rencontre: (e0.rencontre || []).filter(id => state.chars.some(c => c.id === id)),
    lieu: LIEUX.some(l => l.id === e0.lieu) ? e0.lieu : null
  };
  const q = r.nouvelle_quete;
  if (q && q.id && q.titre) e.quete = { id: q.id, titre: q.titre, description: q.description || '', recompense: q.recompense || '—' };
  if (r.quete_terminee) e.termine = r.quete_terminee;
  return e;
}

/* ---------- Tour de jeu ---------- */
function renderChoixIA(bloque = false) {
  const box = $('#mj-choix'); box.innerHTML = '';
  ia.choix.forEach((c, i) => {
    const b = document.createElement('button');
    b.className = 'choice'; b.textContent = `${i + 1}. ${c}`; b.disabled = bloque;
    b.addEventListener('click', () => choisir(i));
    box.appendChild(b);
  });
}
async function tourIA(action, afficherJoueur = true) {
  renderChoixIA(true);
  $('#mj-input').disabled = true;
  if (afficherJoueur) mjEcrire('joueur', action);
  mjEcrire('systeme', 'Le Maître du Jeu réfléchit…');
  const attente = $('#mj-log').lastElementChild;
  try {
    const rep = await appelGemini(action);
    attente.remove();
    const notes = appliquer(effetsDepuisReponse(rep));
    mjEcrire('mj', rep.texte, rep.titre || 'Le récit continue', notes);
    ia.choix = rep.choix.slice(0, 3).map(String);
    ia.derniere = { titre: rep.titre, texte: rep.texte };
    state.tour++;
    renderAll(); sauverIA();
    renderChoixIA();
  } catch (e) {
    console.error(e);
    attente.remove();
    mjEcrire('systeme', `⚠️ Erreur IA : ${e.message}. Vérifie ta clé / ton modèle dans ⚙️ IA, puis réessaie.`);
    ia.choix = ia.choix.length ? ia.choix : ['Réessayer'];
    renderChoixIA();
  } finally {
    $('#mj-input').disabled = false;
  }
}

/* ---------- Branchement sur le jeu existant ---------- */
const simu = { intro: mjIntro, choisir: choisir, libre: soumettreLibre, renderChoix: renderChoix };

mjIntro = function () {
  if (!ia.actif) return simu.intro();
  mjEcrire('systeme', 'Maître du Jeu IA (Gemini) connecté.');
  if (ia.derniere && ia.choix.length) {
    mjEcrire('mj', ia.derniere.texte, ia.derniere.titre);
    renderChoixIA();
  } else {
    tourIA("[DÉBUT DE PARTIE] Décris la scène d'ouverture à Konoha en lien avec ma quête principale.", false);
  }
};
choisir = function (i) {
  if (!ia.actif) return simu.choisir(i);
  const c = ia.choix[i];
  if (c === 'Réessayer') return tourIA('Continue le récit.', false);
  tourIA(c);
};
soumettreLibre = function (texte) { return ia.actif ? tourIA(texte) : simu.libre(texte); };
renderChoix = function (b) { return ia.actif ? renderChoixIA(b) : simu.renderChoix(b); };

/* ---------- Fenêtre de réglages ---------- */
(function reglages() {
  const btn = document.createElement('button');
  btn.className = 'btn-ghost'; btn.id = 'btn-ia';
  btn.textContent = ia.actif ? '🤖 IA : Gemini' : '⚙️ Activer l’IA';
  $('.topbar-right').prepend(btn);

  const dlg = document.createElement('dialog'); dlg.id = 'dlg-ia';
  dlg.innerHTML = `
    <form method="dialog" class="ia-form">
      <h3>⚙️ Maître du Jeu IA (Gemini)</h3>
      <label>Mode
        <select id="ia-mode">
          <option value="direct">Ma clé API (stockée dans ce navigateur)</option>
          <option value="proxy">Proxy Cloudflare (clé cachée côté serveur)</option>
        </select></label>
      <label id="ia-l-key">Clé API Gemini <input type="password" id="ia-key" placeholder="AIza…" autocomplete="off"></label>
      <label id="ia-l-proxy">URL du proxy <input type="url" id="ia-proxy" placeholder="https://mon-worker.mon-compte.workers.dev"></label>
      <label>Modèle <input type="text" id="ia-model" placeholder="gemini-2.5-flash"></label>
      <p class="hint">La clé reste dans le localStorage de ce navigateur et n'est envoyée qu'à Google. Ne la publie jamais dans le dépôt.</p>
      <div class="ia-actions">
        <button type="button" class="btn-ghost" id="ia-cancel">Annuler</button>
        <button type="button" class="btn-ghost" id="ia-off">Désactiver l'IA</button>
        <button type="button" class="btn" id="ia-save">Enregistrer</button>
      </div>
    </form>`;
  document.body.appendChild(dlg);

  const maj = () => {
    const proxy = $('#ia-mode').value === 'proxy';
    $('#ia-l-key').style.display = proxy ? 'none' : '';
    $('#ia-l-proxy').style.display = proxy ? '' : 'none';
  };
  btn.addEventListener('click', () => {
    $('#ia-mode').value = ia.cfg.mode; $('#ia-key').value = ia.cfg.apiKey;
    $('#ia-proxy').value = ia.cfg.proxyUrl; $('#ia-model').value = ia.cfg.model;
    maj(); dlg.showModal();
  });
  $('#ia-mode').addEventListener('change', maj);
  $('#ia-cancel').addEventListener('click', () => dlg.close());
  $('#ia-off').addEventListener('click', () => {
    localStorage.removeItem(IA_CFG_KEY); localStorage.removeItem(IA_SAVE_KEY); location.reload();
  });
  $('#ia-save').addEventListener('click', () => {
    const cfg = {
      mode: $('#ia-mode').value, apiKey: $('#ia-key').value.trim(),
      proxyUrl: $('#ia-proxy').value.trim(), model: $('#ia-model').value.trim() || 'gemini-2.5-flash'
    };
    localStorage.setItem(IA_CFG_KEY, JSON.stringify(cfg));
    localStorage.removeItem(IA_SAVE_KEY);       // nouvelle histoire avec la nouvelle config
    location.reload();
  });
})();
