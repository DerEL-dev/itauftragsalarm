/* Ablauf, Ortssuche, Karte und Senden.
   Auswahllisten stehen in data.js, Kartenumrisse in geo.js, Orte und PLZ in places.js (wird nachgeladen). */
const FORM_ENDPOINT = 'https://alarm-form.haas-c79.workers.dev';

(() => {
  const { DETAILS, SIZES, KM, CITIES } = window.DATA;
  const { proj, SHAPES, W, H, unproj } = window.GEO;
  const $ = id => document.getElementById(id);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // kurzes Vibrieren auf Geräten, die das können (Android), sonst passiert nichts
  const tap = () => { if (navigator.vibrate && !reduced) { try { navigator.vibrate(6); } catch (_) {} } };

  /* ---------- Schritte ---------- */
  const form = $('f');
  const steps = [...form.querySelectorAll('.step')];
  const ids = steps.map(s => s.dataset.id);
  const last = steps.length - 1;
  const bar = document.querySelector('.progress span');
  const pb = $('progress');
  const go = $('go');
  const msg = $('msg');
  const GO_LABEL = { email: 'Alarm einrichten' };
  let cur = 0, sent = false, busy = false;

  const radio = () => form.querySelector('input[name="leistung"]:checked');
  const isOther = () => !!radio() && radio().value === 'Etwas anderes';
  const skipped = id => id === 'detail' && (isOther() || !radio() || !(DETAILS[radio().value] || []).length);

  function show(i, dir) {
    steps[cur].classList.remove('is-active', 'back-dir');
    cur = i;
    const s = steps[cur], id = ids[cur];
    s.classList.toggle('back-dir', dir === 'back');
    s.classList.add('is-active');
    document.body.dataset.step = id;
    const pct = Math.round((cur / last) * 100);
    bar.style.width = pct + '%';
    pb.setAttribute('aria-valuenow', pct);
    go.textContent = GO_LABEL[id] || 'Weiter';
    say('');
    if (id !== 'intro') loadPlaces();
    if (id === 'email') { fillSummary($('summary'), true); checkTypo(); }
    refresh();
    window.scrollTo(0, 0);
    const field = s.querySelector('[data-autofocus]');
    if (field && window.matchMedia('(hover:hover)').matches) field.focus();
    else (s.querySelector('h1,h2') || s).focus({ preventScroll: true });
  }
  function goTo(i) {
    if (i === cur) return;
    history.pushState({ i }, '');
    show(i, 'fwd');
  }
  function next() {
    let i = cur + 1;
    while (i < last && skipped(ids[i])) i++;
    goTo(Math.min(i, last));
  }
  function prev() {
    if (cur === 0 || sent) return;
    if (history.state && history.state.i === cur) history.back();
    else show(prevIndex(), 'back');
  }
  function prevIndex() {
    let i = cur - 1;
    while (i > 0 && skipped(ids[i])) i--;
    return Math.max(i, 0);
  }
  // Zurück-Taste des Browsers bzw. Wischgeste am Handy blättert einen Schritt zurück statt die Seite zu verlassen
  history.replaceState({ i: 0 }, '');
  window.addEventListener('popstate', e => {
    if (sent) return;
    let i = e.state && typeof e.state.i === 'number' ? e.state.i : 0;
    if (i >= last) i = 0;
    while (i > 0 && skipped(ids[i])) i--;
    show(i, i < cur ? 'back' : 'fwd');
  });

  /* ---------- Prüfen ---------- */
  const emailEl = $('email');
  const emailOk = () => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(emailEl.value.trim());

  // Liefert, was im Schritt noch fehlt (leer = alles gut)
  function problem(id) {
    if (id === 'leistung') {
      if (!radio()) return 'Wähle aus, was du anbietest.';
      if (isOther() && !$('andere-text').value.trim()) return 'Beschreib kurz, was du anbietest.';
    }
    if (id === 'detail' && detailOther() && !$('detail-andere-text').value.trim()) return 'Beschreib kurz, was du meinst.';
    if (id === 'ort' && km() && !pin) {
      return ortInput.value.trim() ? 'Wähle deinen Ort aus den Vorschlägen.' : 'Gib deine PLZ oder deinen Ort ein. Oder wähle „Ganz DACH“.';
    }
    if (id === 'email') {
      if (!emailOk()) return 'Gib eine gültige E-Mail-Adresse ein.';
      if (!form.elements.einwilligung.checked) return 'Setz bitte den Haken, sonst dürfen wir dir keine Aufträge schicken.';
    }
    return '';
  }
  function refresh() { go.classList.toggle('is-off', !!problem(ids[cur])); }
  function say(text) {
    msg.textContent = text || '';
    if (text && !reduced) { msg.classList.remove('shake'); void msg.offsetWidth; msg.classList.add('shake'); }
  }
  function focusProblem(id) {
    if (id === 'leistung' && isOther()) $('andere-text').focus();
    if (id === 'detail') $('detail-andere-text').focus();
    if (id === 'ort') { ortInput.focus(); if (ortInput.value.trim()) search(); }
    if (id === 'email' && !emailOk()) emailEl.focus();
  }

  function primary() {
    if (busy || sent) return;
    const id = ids[cur];
    const p = problem(id);
    if (p) { say(p); focusProblem(id); return; }
    say('');
    if (id !== 'email') { next(); return; }
    // Vor dem Senden alle Schritte prüfen (falls jemand per Browser-Verlauf gesprungen ist)
    for (const other of ['leistung', 'detail', 'ort']) {
      if (skipped(other)) continue;
      if (problem(other)) { goTo(ids.indexOf(other)); say(problem(other)); return; }
    }
    submit();
  }

  $('start').addEventListener('click', next);
  $('back').addEventListener('click', prev);
  form.addEventListener('submit', e => { e.preventDefault(); primary(); });
  form.addEventListener('keydown', e => {
    if (e.key !== 'Enter' || e.defaultPrevented || e.target.closest('button, a')) return;
    e.preventDefault();
    if (cur === 0) next(); else primary();
  });
  form.addEventListener('input', () => { if (msg.textContent) say(''); refresh(); });
  form.addEventListener('change', e => { if (e.target.matches('input[type=radio], input[type=checkbox]')) tap(); if (msg.textContent) say(''); refresh(); });

  /* ---------- Leistung ---------- */
  const andere = $('andere');
  const detailBox = $('detail-chips');
  const detailAndere = $('detail-andere');
  let lastLeistung = null;

  function buildDetail(value) {
    detailBox.innerHTML = '';
    const list = DETAILS[value] || [];
    (list.length ? [...list, 'Etwas anderes'] : []).forEach(t => {
      const l = document.createElement('label');
      l.className = 'chip';
      l.innerHTML = '<input type="checkbox" name="leistung_detail"><svg aria-hidden="true"><use href="#i-check"/></svg><span></span>';
      l.querySelector('input').value = t;
      l.querySelector('span').textContent = t;
      detailBox.appendChild(l);
    });
    detailAndere.hidden = true;
    $('detail-andere-text').value = '';
  }
  const detailOther = () => !!detailBox.querySelector('input[value="Etwas anderes"]:checked');
  detailBox.addEventListener('change', e => {
    if (e.target.value !== 'Etwas anderes') return;
    detailAndere.hidden = !e.target.checked;
    if (e.target.checked) {
      $('detail-andere-text').focus({ preventScroll: true });
      detailAndere.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
    }
  });
  form.querySelectorAll('input[name="leistung"]').forEach(r => {
    r.addEventListener('change', () => {
      const other = r.value === 'Etwas anderes';
      andere.hidden = !other;
      if (r.value !== lastLeistung) { lastLeistung = r.value; buildDetail(r.value); }
      if (other) {
        $('andere-text').focus({ preventScroll: true });
        andere.scrollIntoView({ block: 'nearest', behavior: reduced ? 'auto' : 'smooth' });
      }
    });
  });

  /* ---------- Orte: Daten und Suche ---------- */
  const COUNTRY = { DE: 'Deutschland', AT: 'Österreich', CH: 'Schweiz', LI: 'Liechtenstein' };
  const norm = s => s.toLowerCase()
    .replace(/[äàâ]/g, 'a').replace(/[öô]/g, 'o').replace(/[üû]/g, 'u').replace(/ß/g, 'ss').replace(/[éèê]/g, 'e')
    .replace(/ae/g, 'a').replace(/oe/g, 'o').replace(/ue/g, 'u')
    .replace(/\bsankt\b/g, 'st').replace(/[^a-z0-9]+/g, ' ').trim();

  let places = null, placesState = 'idle';
  const fallbackPlaces = () => Object.entries(CITIES).flatMap(([land, list]) =>
    list.map(([n, lon, lat]) => ({ n, lat, lon, z: [], k: norm(n), sub: land })));

  function parsePlaces(data) {
    return data.rows.split('\n').map(row => {
      const [n, s, lat, lon, z] = row.split('|');
      const [cc, state] = data.states[+s];
      const where = cc === 'DE' ? state : [state, COUNTRY[cc]].filter(Boolean).join(', ');
      return { n, lat: +lat, lon: +lon, z: z.split(','), k: norm(n), sub: state === n && cc === 'DE' ? '' : where };
    });
  }
  function loadPlaces() {
    if (placesState !== 'idle') return;
    placesState = 'loading';
    const done = list => {
      places = list; placesState = 'ready';
      if (pin && !pin.name) namePin();
      if (document.activeElement === ortInput && ortInput.value.trim() && !pin) search();
    };
    const s = document.createElement('script');
    s.src = 'js/places.js';
    s.async = true;
    s.onload = () => { try { done(parsePlaces(window.PLACES)); } catch (_) { done(fallbackPlaces()); } window.PLACES = null; };
    s.onerror = () => done(fallbackPlaces());
    document.head.appendChild(s);
  }

  function find(q) {
    const digits = /^\d{1,5}$/.test(q.trim());
    const out = [];
    if (digits) {
      const d = q.trim();
      for (const p of places) {
        const hit = p.z.find(z => z.startsWith(d));
        if (hit) out.push({ p, plz: hit, s: (hit === d ? 0 : 1) });
      }
      out.sort((a, b) => a.s - b.s || (a.plz < b.plz ? -1 : a.plz > b.plz ? 1 : 0) || b.p.z.length - a.p.z.length);
    } else {
      const k = norm(q);
      if (k.length < 2) return [];
      for (const p of places) {
        const at = p.k.indexOf(k);
        if (at < 0) continue;
        const s = at === 0 ? (p.k.length === k.length ? 0 : 1) : p.k[at - 1] === ' ' ? 2 : 3;
        if (s === 3 && k.length < 4) continue;
        out.push({ p, plz: '', s });
      }
      out.sort((a, b) => a.s - b.s || b.p.z.length - a.p.z.length || a.p.k.length - b.p.k.length || a.p.lat - b.p.lat);
    }
    return out.slice(0, 6);
  }
  const plzText = (p, hit) => hit || (p.z.length > 1 ? p.z[0] + ' – ' + p.z[p.z.length - 1] : p.z[0] || '');

  // Nächster Ort zu einem Punkt. Im Umkreis von 15 km gewinnt der größte Ort (meiste PLZ),
  // damit „Nähe Magdeburg“ statt eines kleinen Ortsteils erscheint.
  function nearest(lat, lon) {
    const cos = Math.cos(lat * Math.PI / 180);
    let best = null, bestKm = Infinity, big = null, bigKm = 0;
    for (const p of places || []) {
      const dy = p.lat - lat, dx = (p.lon - lon) * cos;
      const d = Math.sqrt(dx * dx + dy * dy) * 111;
      if (d < bestKm) { bestKm = d; best = p; }
      if (d < 15 && p.z.length > 1 && (!big || p.z.length > big.z.length)) { big = p; bigKm = d; }
    }
    if (!best) return null;
    return big && bestKm > 1.5 ? { p: big, km: bigKm } : { p: best, km: bestKm };
  }

  /* ---------- Orte: Eingabefeld ---------- */
  const combo = $('combo');
  const ortInput = $('ort-input');
  const ortList = $('ort-list');
  const ortClear = $('ort-clear');
  const ortMsg = $('ort-msg');
  const locate = $('locate');
  let pin = null, results = [], active = -1;

  const ortSay = (text, isErr) => { ortMsg.textContent = text || ''; ortMsg.classList.toggle('is-err', !!isErr); };
  function closeList() {
    ortList.hidden = true; ortList.innerHTML = ''; results = []; active = -1;
    ortInput.setAttribute('aria-expanded', 'false'); ortInput.removeAttribute('aria-activedescendant');
  }
  function setActive(i) {
    active = i;
    [...ortList.children].forEach((li, n) => li.setAttribute('aria-selected', n === i ? 'true' : 'false'));
    if (i >= 0) ortInput.setAttribute('aria-activedescendant', 'ort-opt-' + i); else ortInput.removeAttribute('aria-activedescendant');
  }
  function search() {
    const q = ortInput.value.trim();
    if (!q) { closeList(); return; }
    ortList.innerHTML = '';
    const note = text => { const li = document.createElement('li'); li.className = 'none'; li.textContent = text; ortList.appendChild(li); };
    if (placesState !== 'ready') { results = []; note('Orte werden geladen …'); }
    else {
      results = find(q);
      if (!results.length) {
        if (!/^\d+$/.test(q) && norm(q).length < 2) { closeList(); return; }
        note('Nichts gefunden. Probier es mit der PLZ oder tippe auf die Karte.');
      }
      results.forEach((r, i) => {
        const li = document.createElement('li');
        li.id = 'ort-opt-' + i; li.setAttribute('role', 'option');
        const b = document.createElement('b'); b.textContent = r.p.n;
        const sm = document.createElement('small'); sm.textContent = [plzText(r.p, r.plz), r.p.sub].filter(Boolean).join(' · ');
        li.append(b, sm);
        li.addEventListener('click', () => choose(i));
        li.addEventListener('pointermove', () => { if (active !== i) setActive(i); });
        ortList.appendChild(li);
      });
    }
    ortList.hidden = false;
    ortInput.setAttribute('aria-expanded', 'true');
    setActive(results.length ? 0 : -1);
  }
  function choose(i) {
    const r = results[i];
    if (!r) return;
    setPin({ lat: r.p.lat, lon: r.p.lon, name: r.p.n, plz: r.plz || (r.p.z.length === 1 ? r.p.z[0] : '') });
    closeList();
    // Handy: Tastatur schließen. Desktop: Fokus auf „Weiter“, damit Enter direkt weitergeht
    if (window.matchMedia('(hover:hover)').matches) go.focus({ preventScroll: true }); else ortInput.blur();
  }
  function setPin(p) {
    pin = p;
    if (p && !p.name) namePin();
    ortInput.value = pin ? (pin.name || 'Punkt auf der Karte') : '';
    combo.classList.toggle('has-pin', !!pin);
    ortClear.hidden = !ortInput.value;
    ortSay('');
    say('');
    draw();
    refresh();
  }
  // Kartenpunkt oder GPS-Position bekommt den Namen des nächsten Orts
  function namePin() {
    if (!pin || pin.name || !places) return;
    const near = nearest(pin.lat, pin.lon);
    if (near && near.km < 30) {
      pin.name = (near.km > 4 ? 'Nähe ' : '') + near.p.n;
      if (near.km <= 4 && near.p.z.length === 1) pin.plz = near.p.z[0];
      if (document.activeElement !== ortInput) ortInput.value = pin.name;
      draw();
    }
  }

  ortInput.addEventListener('input', () => {
    if (pin) { pin = null; combo.classList.remove('has-pin'); draw(); }
    ortClear.hidden = !ortInput.value;
    ortSay('');
    search();
    // eindeutige, vollständige PLZ direkt übernehmen
    const q = ortInput.value.trim();
    if (/^\d{4,5}$/.test(q) && results.length === 1 && results[0].plz === q) choose(0);
  });
  ortInput.addEventListener('focus', () => {
    clearTimeout(blurTimer);
    if (pin) ortInput.select(); else if (ortInput.value.trim()) search();
    if (window.matchMedia('(max-width: 719px)').matches) {
      setTimeout(() => combo.closest('.field').scrollIntoView({ block: 'start', behavior: reduced ? 'auto' : 'smooth' }), 250);
    }
  });
  let blurTimer = 0;
  ortInput.addEventListener('blur', () => { blurTimer = setTimeout(closeList, 120); });
  ortInput.addEventListener('keydown', e => {
    const open = !ortList.hidden && results.length;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      if (!open) { search(); return; }
      e.preventDefault();
      setActive((active + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
    } else if (e.key === 'Enter') {
      if (open) { e.preventDefault(); choose(Math.max(active, 0)); }
    } else if (e.key === 'Escape' && !ortList.hidden) {
      e.preventDefault(); closeList();
    }
  });
  ortList.addEventListener('pointerdown', e => e.preventDefault());   // Fokus bleibt im Feld
  ortClear.addEventListener('click', () => { setPin(null); ortInput.focus(); });

  if (!('geolocation' in navigator)) locate.hidden = true;
  locate.addEventListener('click', () => {
    const label = locate.querySelector('span');
    const text = label.textContent;
    locate.disabled = true; label.textContent = 'Standort wird ermittelt …';
    const finish = () => { locate.disabled = false; label.textContent = text; };
    navigator.geolocation.getCurrentPosition(pos => {
      finish();
      const { latitude: lat, longitude: lon } = pos.coords;
      if (lat < 45.7 || lat > 55.2 || lon < 5.7 || lon > 17.3) {
        ortSay('Dein Standort liegt außerhalb von Deutschland, Österreich und der Schweiz. Gib einen Ort ein.', true);
        return;
      }
      setPin({ lat: +lat.toFixed(2), lon: +lon.toFixed(2), name: '', plz: '' });
    }, err => {
      finish();
      ortSay(err.code === 1
        ? 'Standortfreigabe abgelehnt. Gib einfach deine PLZ oder deinen Ort ein.'
        : 'Standort ließ sich nicht ermitteln. Gib einfach deine PLZ oder deinen Ort ein.', true);
    }, { timeout: 10000, maximumAge: 600000 });
  });

  /* ---------- Umkreis ---------- */
  const rkm = $('rkm');
  const kmFill = $('km-fill'), kmOut = $('km-out');
  $('km-ticks').innerHTML = KM.map(() => '<i></i>').join('');
  const km = () => KM[+rkm.value];
  rkm.addEventListener('input', () => { ortSay(''); tap(); draw(); });

  /* ---------- Karte ---------- */
  const mapBox = $('map');
  const kmValue = $('km-value');
  const NS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); return el; };
  const xy = (lon, lat) => proj([lon, lat]).split(',').map(Number);
  const PX_KM = 0.9;                                  // Karteneinheiten pro Kilometer
  const svg = mk('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': 'Karte von Deutschland, Österreich und der Schweiz' });
  const clip = mk('clipPath', { id: 'dach' });
  svg.appendChild(mk('defs', {})).appendChild(clip);
  SHAPES.forEach(s => {
    const d = 'M' + s.pts.map(proj).join('L') + 'Z';
    svg.appendChild(mk('path', { d, class: 'country' }));
    clip.appendChild(mk('path', { d }));
  });
  const scaled = [];                                  // Elemente, die beim Zoomen gleich groß bleiben sollen
  SHAPES.forEach(s => {
    const [x, y] = xy(...s.label);
    const t = mk('text', { x, y, class: 'country-label' });
    t.textContent = s.name;
    svg.appendChild(t);
    scaled.push({ el: t, font: 11, wideOnly: true });
  });
  // Städte zur Orientierung, wichtigste zuerst (bei Platzmangel fallen die hinteren Beschriftungen weg)
  const BIG = ['Berlin', 'Hamburg', 'München', 'Köln', 'Frankfurt am Main', 'Wien', 'Zürich', 'Stuttgart', 'Leipzig', 'Hannover', 'Nürnberg', 'Dresden', 'Bremen', 'Dortmund', 'Düsseldorf', 'Graz', 'Bern', 'Genf', 'Basel', 'Linz', 'Salzburg', 'Innsbruck', 'Kassel', 'Erfurt', 'Rostock', 'Kiel', 'Magdeburg', 'Münster', 'Freiburg', 'Saarbrücken', 'Mannheim', 'Würzburg'];
  const rank = n => { const i = BIG.indexOf(n); return i < 0 ? 99 : i; };
  const cityLayer = mk('g', { 'pointer-events': 'none' });
  const cityLabels = [];
  Object.values(CITIES).flat().sort((a, b) => rank(a[0]) - rank(b[0])).forEach(([n, lon, lat]) => {
    const [x, y] = xy(lon, lat);
    const dot = mk('circle', { cx: x, cy: y, class: 'city-dot' });
    const t = mk('text', { class: 'city-label' });
    t.textContent = n.replace(' am Main', '').replace(' (Saale)', '');
    cityLayer.append(dot, t);
    scaled.push({ el: dot, r: 1.8, big: rank(n) < 99 });
    cityLabels.push({ el: t, x, y, len: t.textContent.length });
  });
  svg.appendChild(cityLayer);
  const reach = mk('circle', { class: 'reach', 'clip-path': 'url(#dach)', 'pointer-events': 'none' });
  const reachWrap = mk('g', { 'clip-path': 'url(#dach)', 'pointer-events': 'none' });
  reach.removeAttribute('clip-path');
  reachWrap.appendChild(reach);
  const dot = mk('circle', { class: 'pin', 'pointer-events': 'none' });
  svg.append(reachWrap, dot);
  scaled.push({ el: dot, r: 5 });
  mapBox.appendChild(svg);

  svg.addEventListener('click', ev => {
    const pt = new DOMPoint(ev.clientX, ev.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const [lon, lat] = unproj(pt.x, pt.y);
    const hit = document.elementFromPoint(ev.clientX, ev.clientY);
    if (!hit || !hit.classList.contains('country')) return;        // nur innerhalb der Länder
    setPin({ lat: +lat.toFixed(2), lon: +lon.toFixed(2), name: '', plz: '' });
  });

  // Ausschnitt: bei kleinem Umkreis zoomt die Karte heran, damit der Kreis sichtbar bleibt
  let view = [0, 0, W, H], anim = 0;
  function applyView(v) {
    view = v;
    svg.setAttribute('viewBox', v.map(n => n.toFixed(1)).join(' '));
    const z = v[2] / (svg.clientWidth || 190);          // Karteneinheiten pro Bildschirmpixel
    const zoomed = v[2] / W < 0.62;
    scaled.forEach(o => {
      if (o.r) o.el.setAttribute('r', (o.r * z).toFixed(2));
      if (o.font) o.el.setAttribute('font-size', (o.font * z).toFixed(2));
      if (o.wideOnly) o.el.style.display = zoomed ? 'none' : '';
      if (o.big === false) o.el.style.display = zoomed ? '' : 'none';
    });
    // Städtenamen nur im herangezoomten Ausschnitt, ohne Überlappungen und ohne Anschnitt am Rand
    const taken = [], fs = 9 * z, pad = 4 * z;
    if (pin) { const [px, py] = xy(pin.lon, pin.lat); taken.push([px - 9 * z, py - 9 * z, px + 9 * z, py + 9 * z]); }
    cityLabels.forEach(c => {
      let show = zoomed && c.x > v[0] && c.x < v[0] + v[2] && c.y > v[1] + fs && c.y < v[1] + v[3] - fs * 0.5;
      if (show) {
        const w = c.len * fs * 0.58;
        const left = c.x + pad + w > v[0] + v[2] - pad;
        const x0 = left ? c.x - pad - w : c.x + pad;
        const box = [x0, c.y - fs * 0.75, x0 + w, c.y + fs * 0.45];
        show = x0 > v[0] + pad && !taken.some(t => box[0] < t[2] && box[2] > t[0] && box[1] < t[3] && box[3] > t[1]);
        if (show) {
          taken.push(box);
          c.el.setAttribute('x', left ? c.x - pad : c.x + pad);
          c.el.setAttribute('y', c.y + fs * 0.34);
          c.el.setAttribute('text-anchor', left ? 'end' : 'start');
          c.el.setAttribute('font-size', fs.toFixed(2));
        }
      }
      c.el.style.display = show ? '' : 'none';
    });
  }
  function zoomTo(target) {
    cancelAnimationFrame(anim);
    if (reduced || mapBox.offsetParent === null) { applyView(target); return; }
    const from = view.slice(), t0 = performance.now(), dur = 420;
    const tick = now => {
      const t = Math.min((now - t0) / dur, 1), e = 1 - Math.pow(1 - t, 3);
      applyView(from.map((a, i) => a + (target[i] - a) * e));
      if (t < 1) anim = requestAnimationFrame(tick);
    };
    anim = requestAnimationFrame(tick);
  }

  function draw() {
    const k = km();
    const has = !!pin;
    let target = [0, 0, W, H];
    reach.style.display = has && k ? '' : 'none';
    dot.style.display = has ? '' : 'none';
    if (has) {
      const [x, y] = xy(pin.lon, pin.lat);
      dot.setAttribute('cx', x); dot.setAttribute('cy', y);
      reach.setAttribute('cx', x); reach.setAttribute('cy', y);
      if (k) {
        const r = k * PX_KM;
        reach.setAttribute('r', r.toFixed(1));
        const h = Math.max(r * 5.2, 200);
        if (h < H * 0.8) {
          const w = h * W / H;
          target = [Math.min(Math.max(x - w / 2, 0), W - w), Math.min(Math.max(y - h / 2, 0), H - h), w, h];
        }
      }
    }
    mapBox.classList.toggle('all', !k);
    zoomTo(target);
    kmFill.style.width = (+rkm.value / (KM.length - 1) * 100) + '%';
    kmOut.textContent = k ? k + ' km' : 'Ganz DACH';
    rkm.setAttribute('aria-valuetext', kmOut.textContent);
    const who = has ? (pin.name || 'deinen Punkt') : 'deinen Standort';
    kmValue.textContent = k ? `${k} km um ${who}` : 'Ganz DACH';
    $('out-km').value = k ? k + ' km' : 'ganz DACH';
    $('out-standort').value = has ? (pin.name || 'Kartenpunkt') : '';
    $('out-plz').value = has ? (pin.plz || '') : '';
    $('out-lat').value = has ? pin.lat : '';
    $('out-lon').value = has ? pin.lon : '';
    refresh();
  }
  applyView(view);
  draw();

  /* ---------- Auftragsgröße ---------- */
  const rmin = $('rmin'), rmax = $('rmax');
  const fill = $('range-fill'), out = $('groesse-out'), val = $('range-value');
  const top = SIZES.length - 1;
  $('range-ticks').innerHTML = SIZES.map(() => '<i></i>').join('');
  $('range-max').textContent = SIZES[top].toLocaleString('de-DE') + ' € und mehr';
  const fmt = v => v >= 1e6 ? (v / 1e6).toLocaleString('de-DE') + ' Mio. €' : v.toLocaleString('de-DE') + ' €';
  function updateRange(src) {
    let a = +rmin.value, b = +rmax.value;
    if (a > b) { if (src === rmin) { b = a; rmax.value = b; } else { a = b; rmin.value = a; } }
    fill.style.left = (a / top * 100) + '%';
    fill.style.width = ((b - a) / top * 100) + '%';
    let text;
    if (a === 0 && b === top) text = 'Egal';
    else if (a === 0 && b === 0) text = 'Bis ' + fmt(SIZES[1]);
    else if (a === 0) text = 'Bis ' + fmt(SIZES[b]);
    else if (b === top) text = 'Ab ' + fmt(SIZES[a]);
    else if (a === b) text = 'Etwa ' + fmt(SIZES[a]);
    else text = fmt(SIZES[a]) + ' bis ' + fmt(SIZES[b]);
    val.textContent = text === 'Egal' ? 'Jede Größe' : text;
    out.value = text;
    // der zuletzt bewegte Regler liegt oben; liegen beide am rechten Rand, muss der linke greifbar sein
    const front = a === top ? rmin : b === 0 ? rmax : src;
    rmin.style.zIndex = front === rmin ? 2 : 1;
    rmax.style.zIndex = front === rmin ? 1 : 2;
  }
  rmin.addEventListener('input', () => { tap(); updateRange(rmin); });
  rmax.addEventListener('input', () => { tap(); updateRange(rmax); });
  updateRange(rmax);

  /* ---------- Zusammenfassung ---------- */
  function fillSummary(dl, editable) {
    const details = [...form.querySelectorAll('input[name="leistung_detail"]:checked')].map(i => i.value === 'Etwas anderes' ? $('detail-andere-text').value.trim() : i.value);
    const leistung = isOther() ? $('andere-text').value.trim() : (radio() ? radio().value : '');
    const k = km();
    const rows = [
      ['Angebot', leistung, isOther() ? '' : (details.length ? details.join(', ') : 'Alle Teilbereiche'), 'leistung'],
      ['Gebiet', k ? `${k} km um ${pin ? pin.name || 'deinen Kartenpunkt' : '…'}` : 'Ganz DACH', k ? '' : 'Deutschland, Österreich, Schweiz', 'ort'],
      ['Größe', val.textContent, '', 'groesse']
    ];
    dl.innerHTML = '';
    rows.forEach(([label, main, sub, id]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt'); dt.textContent = label;
      const dd = document.createElement('dd'); dd.textContent = main;
      if (sub) { const s = document.createElement('small'); s.textContent = sub; dd.appendChild(s); }
      row.append(dt, dd);
      if (editable) {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'textlink'; b.textContent = 'Ändern';
        b.setAttribute('aria-label', label + ' ändern');
        b.addEventListener('click', () => goTo(ids.indexOf(id)));
        row.appendChild(b);
      }
      dl.appendChild(row);
    });
  }

  /* ---------- E-Mail: Tippfehler abfangen ---------- */
  const TYPOS = { 'gmial.com': 'gmail.com', 'gmai.com': 'gmail.com', 'gamil.com': 'gmail.com', 'gnail.com': 'gmail.com', 'gmail.con': 'gmail.com', 'gmail.co': 'gmail.com', 'googlemail.con': 'googlemail.com', 'gmx.dee': 'gmx.de', 'gmx.d': 'gmx.de', 'gmx.ed': 'gmx.de', 'web.d': 'web.de', 'web.dee': 'web.de', 'wep.de': 'web.de', 'outlok.com': 'outlook.com', 'outlook.con': 'outlook.com', 'outloook.com': 'outlook.com', 'hotmial.com': 'hotmail.com', 'hotmail.con': 'hotmail.com', 't-online.d': 't-online.de', 't-onlin.de': 't-online.de', 'tonline.de': 't-online.de', 'yahooo.com': 'yahoo.com', 'yaho.com': 'yahoo.com', 'icloud.con': 'icloud.com', 'iclod.com': 'icloud.com' };
  const hint = $('email-hint'), fix = $('email-fix');
  function checkTypo() {
    const v = emailEl.value.trim(), at = v.lastIndexOf('@');
    const good = at > 0 ? TYPOS[v.slice(at + 1).toLowerCase()] : '';
    hint.hidden = !good;
    if (good) fix.textContent = v.slice(0, at + 1) + good;
  }
  emailEl.addEventListener('input', checkTypo);
  fix.addEventListener('click', () => { emailEl.value = fix.textContent; checkTypo(); refresh(); emailEl.focus(); });

  /* ---------- Senden ---------- */
  async function submit() {
    if (form.elements.botcheck.checked) return;
    busy = true;
    go.classList.add('is-busy');
    go.textContent = 'Wird eingerichtet';
    try {
      emailEl.value = emailEl.value.trim();
      const fd = new FormData(form);
      const data = {};
      for (const k of new Set(fd.keys())) data[k] = fd.getAll(k).join(', ');
      delete data.botcheck;
      if (!isOther()) delete data.leistung_andere;
      if (isOther() || !detailOther()) delete data.leistung_detail_andere;
      if (!km()) { data.standort = data.standort || 'ganz DACH'; }
      const r = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      if (!r.ok) throw new Error('rejected');
      sent = true;
      $('done-mail').textContent = emailEl.value;
      fillSummary($('summary-done'), false);
      show(last, 'fwd');
    } catch (_) {
      say(navigator.onLine === false
        ? 'Du bist gerade offline. Prüf deine Internetverbindung und versuch es noch einmal.'
        : 'Das hat nicht geklappt. Versuch es bitte gleich noch einmal.');
      go.textContent = GO_LABEL.email;
    } finally {
      busy = false;
      go.classList.remove('is-busy');
    }
  }

  refresh();
})();
