import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';

const baseURL = process.env.TEST_URL || 'http://127.0.0.1:4173';
const script = await fs.readFile(new URL('./public/app.js', import.meta.url), 'utf8');
const stylesheet = await fs.readFile(new URL('./public/styles.css', import.meta.url), 'utf8');
const activeTimers = new Set();
const broadcastChannels = new Map();
const checks = [];
const testDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'juventude-overlay-test-'));
const testStatePath = path.join(testDirectory, 'state.json');
const setupToken = 'isolated-test-setup-token-0123456789';
process.env.OVERLAY_SETUP_TOKEN = setupToken;
process.env.OVERLAY_STATE_FILE = testStatePath;
process.env.HOST = '127.0.0.1';
const { server } = await import('./server.mjs');
if (!server.listening) await once(server, 'listening');
const baseOrigin = new URL(baseURL).origin;
let adminCookie = '';

function verify(name, predicate) {
  assert.ok(predicate, name);
  checks.push(name);
}

function makeRuntime(pathname = '/?room=principal', options = {}) {
  const app = { innerHTML: '', handlers: {}, addEventListener(type, callback) { this.handlers[type] = callback; } };
  const location = new URL(pathname, baseURL);
  const room = (location.searchParams.get('room') || 'principal').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'principal';
  const storage = new Map();
  if (options.savedState) storage.set(`juventude.overlay-studio.v2.${room}`, JSON.stringify(options.savedState));
  const form = new Map();
  const classes = new Set();
  const documentHandlers = {};
  const copied = [];
  const opened = [];
  const printed = [];
  const bodyElements = new Set();

  class FakeChannel {
    constructor(name) {
      this.name = name;
      this.handler = null;
      const collection = broadcastChannels.get(name) || new Set();
      collection.add(this);
      broadcastChannels.set(name, collection);
    }
    addEventListener(type, callback) { if (type === 'message') this.handler = callback; }
    postMessage(data) {
      for (const listener of broadcastChannels.get(this.name) || []) {
        if (listener !== this) listener.handler?.({ data: structuredClone(data) });
      }
    }
  }

  const document = {
    activeElement: null,
    body: {
      classList: { add(...values) { values.forEach(value => classes.add(value)); } },
      dataset: {},
      append(element) { bodyElements.add(element); },
    },
    getElementById(id) { return id === 'app' ? app : form.get(id) || null; },
    querySelector(selector) {
      if (selector === '[data-emergency-hide-all]') return [...bodyElements].find(element => element.dataset.emergencyHideAll) || null;
      if (selector === '.toast') return null;
      return null;
    },
    querySelectorAll() { return []; },
    createElement() {
      const element = { className: '', textContent: '', style: {}, remove() { bodyElements.delete(this); }, select() {} };
      Object.defineProperty(element, 'dataset', { value: {}, writable: false });
      return element;
    },
    addEventListener(type, callback) { documentHandlers[type] = callback; },
    execCommand() { return true; },
  };

  const sandbox = {
    document,
    location,
    navigator: { clipboard: { async writeText(value) { copied.push(value); } } },
    localStorage: { getItem(key) { return storage.get(key) || null; }, setItem(key, value) { storage.set(key, value); } },
    URL,
    URLSearchParams,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Object,
    JSON,
    structuredClone,
    console,
    fetch(input, init = {}) {
      const target = new URL(input, location.origin);
      if (adminCookie && target.origin === baseOrigin) {
        const headers = new Headers(init.headers || {});
        headers.set('cookie', adminCookie);
        return fetch(target, { ...init, headers });
      }
      return fetch(target, init);
    },
    setTimeout(callback, ms) { const timer = setTimeout(callback, ms); activeTimers.add(timer); return timer; },
    clearTimeout(timer) { clearTimeout(timer); activeTimers.delete(timer); },
    setInterval(callback, ms) { const timer = setInterval(callback, ms); activeTimers.add(timer); return timer; },
    clearInterval(timer) { clearInterval(timer); activeTimers.delete(timer); },
  };
  sandbox.window = sandbox;
  sandbox.addEventListener = () => {};
  sandbox.open = (...args) => {
    opened.push(args);
    return { opener: sandbox, document: { write(value) { printed.push(value); }, close() {} } };
  };
  if (options.broadcast !== false) sandbox.BroadcastChannel = FakeChannel;

  vm.runInNewContext(script, sandbox, { filename: 'public/app.js' });
  sandbox.__overlayStudio?.setAdminSession?.('authenticated', 'sala-admin');

  function click(action, value) {
    const target = {
      dataset: { action, value },
      matches: () => false,
      closest(selector) { return selector === '[data-action]' ? this : null; },
    };
    app.handlers.click({ target });
  }

  function input(dataset, value, type = 'text') {
    const target = {
      dataset,
      value,
      type,
      matches(selector) {
        if (selector === '[data-field]') return Boolean(this.dataset.field);
        if (selector === '[data-team-field]') return Boolean(this.dataset.teamField);
        if (selector === '[data-appearance]') return Boolean(this.dataset.appearance);
        return false;
      },
    };
    app.handlers.input({ target });
  }

  return { app, sandbox, document, form, classes, copied, opened, printed, click, input, getState: () => sandbox.__overlayStudio.getState() };
}

try {
  const homepage = await fetch(baseURL);
  verify('Dashboard returns HTTP 200', homepage.status === 200);
  const html = await homepage.text();
  verify('HTML identifies Juventude Esporte Clube', html.includes('Juventude Esporte Clube'));
  const health = await (await fetch(`${baseURL}/health`)).json();
  verify('Health endpoint identifies a ready local service', health.ok === true && health.service === 'juventude-overlay-studio');
  verify('JavaScript asset returns HTTP 200', (await fetch(`${baseURL}/app.js`)).status === 200);
  verify('Stylesheet asset returns HTTP 200', (await fetch(`${baseURL}/styles.css`)).status === 200);
  const brandLogo = await fetch(`${baseURL}/brand-logo.png`);
  verify('Official crest asset is served with an image content type', brandLogo.status === 200 && (brandLogo.headers.get('content-type') || '').includes('image/png'));
  verify('Full-screen preview route returns HTTP 200', (await fetch(`${baseURL}/preview`)).status === 200);
  verify('Dedicated management routes return the application shell', (await fetch(`${baseURL}/manage/lineup?room=principal`)).status === 200 && (await fetch(`${baseURL}/manage/scoreboard?room=principal`)).status === 200);
  verify('Unknown routes return HTTP 404', (await fetch(`${baseURL}/missing-route`)).status === 404);
  const unauthorizedWrite = await fetch(`${baseURL}/api/state?room=probe`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ updatedAt: 1, ok: true }) });
  verify('Match-state writes are rejected without an administrator session', unauthorizedWrite.status === 401);
  const adminStatusBefore = await (await fetch(`${baseURL}/api/auth/admin/status`)).json();
  verify('No administrator exists before the first setup call', adminStatusBefore.hasAdmins === false);
  const missingSetupCode = await fetch(`${baseURL}/api/auth/admin/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'intruder', password: 'test-password' }) });
  verify('Local initial setup requires the installation code', missingSetupCode.status === 403);
  const adminSetup = await fetch(`${baseURL}/api/auth/admin/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'sala-admin', password: 'senha-teste-123', setupToken }) });
  adminCookie = (adminSetup.headers.get('set-cookie') || '').split(';')[0];
  verify('The local server creates the first administrator and starts a session', adminSetup.status === 200 && adminCookie.startsWith('joa_admin='));
  const repeatSetup = await fetch(`${baseURL}/api/auth/admin/setup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'outro-admin', password: 'senha-teste-123' }) });
  verify('A second setup call is rejected once an administrator exists', repeatSetup.status === 409);
  const wrongLogin = await fetch(`${baseURL}/api/auth/admin/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'sala-admin', password: 'senha-errada' }) });
  verify('Admin login rejects an incorrect password', wrongLogin.status === 401);
  const probeWrite = await fetch(`${baseURL}/api/state?room=probe`, { method: 'PUT', headers: { 'content-type': 'application/json', cookie: adminCookie }, body: JSON.stringify({ updatedAt: 1, ok: true }) });
  const probeRead = await (await fetch(`${baseURL}/api/state?room=probe`)).json();
  verify('Room-aware local state endpoint accepts and returns state for an authenticated administrator', probeWrite.ok && probeRead.ok === true);

  const dashboard = makeRuntime('/?room=principal');
  const emergencyButton = () => dashboard.sandbox.document.querySelector('[data-emergency-hide-all]');
  verify('Authenticated Super Admin sees the emergency hide-all button', Boolean(emergencyButton()));
  for (const status of ['checking', 'setup', 'login']) {
    dashboard.sandbox.__overlayStudio.setAdminSession(status, null);
    verify(`Emergency hide-all button is absent during ${status}`, !emergencyButton());
  }
  dashboard.sandbox.__overlayStudio.setAdminSession('login', null);
  verify('Admin login screen offers a direct link to the team access login', dashboard.app.innerHTML.includes('href="/team"') && dashboard.app.innerHTML.includes('Acesso da equipe') && dashboard.app.innerHTML.includes('Juventude Esporte Clube'));
  verify('Brand mark renders the official crest image, not an inline icon', dashboard.app.innerHTML.includes('<img class="brand-mark" src="/brand-logo.png"'));
  dashboard.sandbox.__overlayStudio.setAdminSession('authenticated', 'sala-admin');
  verify('Emergency hide-all button returns after administrator login', Boolean(emergencyButton()));
  for (const route of ['/team', '/preview', '/overlay']) {
    const runtime = makeRuntime(`${route}?room=emergency-button-test`, { broadcast: false });
    verify(`Emergency hide-all button is absent from ${route}`, !runtime.sandbox.document.querySelector('[data-emergency-hide-all]'));
  }
  const moduleHub = makeRuntime('/manage?room=module-hub', { broadcast: false });
  verify('Dashboard exposes a persistent sidebar with every dedicated overlay route', dashboard.app.innerHTML.includes('aria-label="Navegação dos overlays"') && (dashboard.app.innerHTML.match(/\/manage\//g) || []).length >= 6);
  verify('Sidebar groups modules and scrolls when the list exceeds the viewport', ['Organização', 'Overlays', 'Partida', 'Configuração'].every(label => dashboard.app.innerHTML.includes(`>${label}<`)) && dashboard.app.innerHTML.includes('/manage/access') && /\.module-sidebar \{[^}]*overflow-y: auto/.test(stylesheet));
  verify('Management hub exposes one dedicated route for every operational module', moduleHub.app.innerHTML.includes('Uma tela para cada operação') && (moduleHub.app.innerHTML.match(/class="module-hub-card"/g) || []).length === 15);
  const lineupModule = makeRuntime('/manage/lineup?room=module-lineup', { broadcast: false });
  verify('Dedicated routes share the same navigation and mark the selected overlay', lineupModule.app.innerHTML.includes('aria-label="Navegação dos overlays"') && /class="active" href="[^"]*\/manage\/lineup/.test(lineupModule.app.innerHTML));
  verify('Lineup module combines dedicated controls, isolated preview, and OBS URL access', lineupModule.app.innerHTML.includes('Direção da apresentação') && lineupModule.app.innerHTML.includes('Prévia isolada') && lineupModule.app.innerHTML.includes('data-value="photo-lineup"'));
  const sponsorBarModule = makeRuntime('/manage/sponsor-bar?room=module-sponsor-bar', { broadcast: false });
  verify('Sponsor bar has its own management route and 1500 × 200 media controls', sponsorBarModule.app.innerHTML.includes('Barra de Patrocinadores') && sponsorBarModule.app.innerHTML.includes('data-sponsor-wide-image') && sponsorBarModule.app.innerHTML.includes('data-value="sponsor-bar"'));
  const scoreboardModule = makeRuntime('/manage/scoreboard?room=module-scoreboard', { broadcast: false });
  verify('Scoreboard shows the configured competition above the score', scoreboardModule.app.innerHTML.includes('class="scorebug-competition"') && scoreboardModule.app.innerHTML.includes('Campeonato Municipal de Futebol 2026') && stylesheet.includes('.scorebug-competition'));
  sponsorBarModule.click('overlay-sponsor-bar');
  verify('Sponsor bar visibility is independent from the legacy sponsor overlay', sponsorBarModule.getState().visible.sponsorBar && !sponsorBarModule.getState().visible.sponsor);
  const separateSponsorBarOutput = makeRuntime('/overlay?layer=sponsor-bar&room=module-sponsor-bar', { broadcast: false });
  await delay(420);
  verify('Sponsor bar has a dedicated OBS output containing no legacy sponsor component', separateSponsorBarOutput.app.innerHTML.includes('data-overlay="sponsor-bar"') && !separateSponsorBarOutput.app.innerHTML.includes('data-overlay="sponsor"'));
  verify('Dedicated sponsor bar output is marked for exact 1500 × 200 canvas styling', separateSponsorBarOutput.document.body.dataset.outputLayer === 'sponsor-bar' && stylesheet.includes('[data-output-layer="sponsor-bar"] .sponsor-wide-bar'));
  verify('Independent sponsor bar owns its media collection instead of reusing legacy sponsors', sponsorBarModule.getState().sponsorBarItems.length >= 1 && script.includes('Mídias próprias desta saída'));
  verify('Sponsor bar exposes independent visual parameter controls', ['sponsorBarTransition','sponsorBarFit','sponsorBarScale','sponsorBarOpacity','sponsorBarRadius','sponsorBarBackground'].every(field => sponsorBarModule.app.innerHTML.includes(`data-appearance="${field}"`)) && stylesheet.includes('@keyframes sponsor-bar-slide-in') && stylesheet.includes('--sponsor-bar-background'));
  sponsorBarModule.input({ appearance: 'sponsorBarTransition' }, 'slide', 'select');
  sponsorBarModule.input({ appearance: 'sponsorBarFit' }, 'contain', 'select');
  sponsorBarModule.input({ appearance: 'sponsorBarScale' }, '135', 'range');
  sponsorBarModule.input({ appearance: 'sponsorBarOpacity' }, '82', 'range');
  sponsorBarModule.input({ appearance: 'sponsorBarRadius' }, '14', 'range');
  sponsorBarModule.input({ appearance: 'sponsorBarBackground' }, '#10131a', 'color');
  const sponsorBarAppearance = sponsorBarModule.getState().appearance;
  verify('Sponsor bar parameter changes stay scoped to its appearance state', sponsorBarAppearance.sponsorBarTransition === 'slide' && sponsorBarAppearance.sponsorBarFit === 'contain' && sponsorBarAppearance.sponsorBarScale === 135 && sponsorBarAppearance.sponsorBarOpacity === 82 && sponsorBarAppearance.sponsorBarRadius === 14 && sponsorBarAppearance.sponsorBarBackground === '#10131a');
  const builderModule = makeRuntime('/manage/builder?room=module-builder', { broadcast: false });
  builderModule.click('add-custom-overlay');
  verify('Overlay builder creates independent configurable outputs', builderModule.getState().customOverlays.length === 1 && builderModule.app.innerHTML.includes('data-custom-field="width"') && builderModule.app.innerHTML.includes('copy-custom-url'));
  const accessModule = makeRuntime('/manage/access?room=module-access', { broadcast: false });
  await delay(300);
  verify('Access module lists administrators and per-team credential controls', accessModule.app.innerHTML.includes('Administradores do painel') && accessModule.app.innerHTML.includes('Usuários dos times') && accessModule.app.innerHTML.includes('data-action="add-admin-account"'));
  const reportModule = makeRuntime('/manage/report?room=module-report', { broadcast: false });
  reportModule.click('finish-match');
  const finalReport = reportModule.getState().completedReports[0];
  verify('Finishing a match freezes a complete final report in history', Boolean(reportModule.getState().matchEndedAt) && finalReport.status === 'final' && finalReport.schemaVersion === 2 && finalReport.home.starters.length === 11 && finalReport.away.starters.length === 11);
  verify('Finishing a match prepares the standardized PDF document', reportModule.printed.some(value => value.includes('RELATÓRIO FINAL DA PARTIDA') && value.includes('Linha do tempo completa') && value.includes('Placar por período')));
  const pregameModule = makeRuntime('/manage/pregame?room=module-pregame', { broadcast: false });
  pregameModule.click('print-pregame');
  verify('Pregame PDF uses the same standardized document identity', pregameModule.printed.some(value => value.includes('JUVENTUDE OVERLAY STUDIO') && value.includes('RESUMO PRÉ-JOGO')));
  await delay(150);
  verify('Control dashboard renders live monitor', dashboard.app.innerHTML.includes('Pré-visualização ao vivo'));
  verify('Four preconfigured themes are available', (dashboard.app.innerHTML.match(/class="theme-choice/g) || []).length === 4);
  verify('Four sports are available in the modality selector', (dashboard.app.innerHTML.match(/class="sport-choice /g) || []).length === 4);
  verify('Four broadcast typefaces are available', (dashboard.app.innerHTML.match(/class="typeface-choice /g) || []).length === 4);
  verify('Starting score is zero to zero', dashboard.getState().home.score === 0 && dashboard.getState().away.score === 0);
  verify('Compact scoreboard is the default and uses three-letter team abbreviations', dashboard.getState().appearance.scoreboardLayout === 'compact' && dashboard.app.innerHTML.includes('data-layout="compact"') && dashboard.app.innerHTML.includes('<span class="scorebug-team-name">JUV</span>'));

  dashboard.click('goal-home');
  verify('Home goal increments the scoreboard', dashboard.getState().home.score === 1);
  verify('Home goal animates inside the scoreboard', dashboard.getState().goalGraphic.team === 'home' && dashboard.app.innerHTML.includes('scorebug-goal-celebration'));
  verify('Goal celebration does not create a separate lower third', !dashboard.app.innerHTML.includes('data-overlay="event"'));
  verify('Home goal is recorded on the match timeline', dashboard.getState().events[0].title === 'Gol');
  verify('Score changes apply animated score transitions', dashboard.app.innerHTML.includes('score-pop'));
  await delay(150);

  const separateScoreOutput = makeRuntime('/overlay?layer=scoreboard', { broadcast: false });
  await delay(420);
  verify('A separate browser context receives server-synchronized scores', separateScoreOutput.getState().home.score === 1);
  verify('Score-only output includes the scoreboard', separateScoreOutput.app.innerHTML.includes('data-overlay="scoreboard"'));
  verify('Score-only output excludes lower-thirds', !separateScoreOutput.app.innerHTML.includes('data-overlay="event"'));
  verify('OBS output activates transparent-background and optimized render modes', separateScoreOutput.classes.has('overlay-output') && separateScoreOutput.classes.has('obs-render-mode') && stylesheet.includes('background: transparent !important'));
  const freshMotionStart = Date.now() - 300;
  verify('A transition never before painted on an OBS output plays from its first frame', separateScoreOutput.sandbox.motionOffset(freshMotionStart, 1000) === 0);
  await delay(30);
  const resumedOffset = separateScoreOutput.sandbox.motionOffset(freshMotionStart, 1000);
  verify('The same transition re-rendered later (e.g. because unrelated content changed) resumes instead of restarting from frame 0', resumedOffset < 0 && resumedOffset > -1000);
  const fullPreview = makeRuntime('/preview', { broadcast: false });
  await delay(120);
  verify('Full preview uses a complete 16:9 broadcast stage', fullPreview.classes.has('preview-output') && fullPreview.app.innerHTML.includes('full-preview-stage'));
  verify('Full preview shares the same state as the independent OBS session', fullPreview.getState().home.score === 1);

  dashboard.click('theme', 'campo');
  verify('Theme selector changes the graphics immediately', dashboard.app.innerHTML.includes('broadcast-layer theme-campo'));
  dashboard.input({ field: 'customAccent' }, '#e4bd52', 'color');
  verify('Custom accent activates a personalized theme', dashboard.getState().theme === 'custom' && dashboard.getState().customAccent === '#e4bd52');

  dashboard.click('tab', 'teams');
  verify('Teams editor exposes names and badge uploads', dashboard.app.innerHTML.includes('Nome da equipe') && dashboard.app.innerHTML.includes('Escudo PNG ou JPG'));
  verify('Reusable team catalog exposes match selectors and points to the Access module for team logins', dashboard.app.innerHTML.includes('Cadastro de times') && dashboard.app.innerHTML.includes('data-match-team="home"') && dashboard.app.innerHTML.includes('/manage/access'));
  dashboard.input({ team: 'home', teamField: 'name' }, 'Juventude Ilha');
  dashboard.input({ team: 'home', teamField: 'short' }, 'jec');
  verify('Team names and abbreviations update in real time', dashboard.getState().home.name === 'Juventude Ilha' && dashboard.getState().home.short === 'JEC');

  dashboard.click('tab', 'match');
  verify('Match controls expose compact and expanded scoreboard formats', dashboard.app.innerHTML.includes('3 letras + placar + tempo') && dashboard.app.innerHTML.includes('Nome completo das equipes'));
  dashboard.click('scoreboard-layout', 'expanded');
  verify('Expanded scoreboard morphs in place while rendering complete team names', dashboard.getState().appearance.scoreboardLayout === 'expanded' && dashboard.getState().scoreboardMorph.direction === 'expanded' && dashboard.app.innerHTML.includes('is-morphing morph-to-expanded') && !dashboard.app.innerHTML.includes('is-entering scorebug-animation') && dashboard.app.innerHTML.includes('<span class="scorebug-team-name">JUVENTUDE ILHA</span>'));
  dashboard.click('scoreboard-layout', 'compact');
  verify('Compact scoreboard contracts without leaving the screen', dashboard.getState().appearance.scoreboardLayout === 'compact' && dashboard.getState().scoreboardMorph.direction === 'compact' && dashboard.app.innerHTML.includes('is-morphing morph-to-compact') && dashboard.app.innerHTML.includes('<span class="scorebug-team-name">JEC</span>'));
  dashboard.click('clock-toggle');
  verify('The match clock starts correctly', dashboard.getState().clock.running && dashboard.getState().clock.startedAt);
  await delay(1100);
  verify('The running match clock advances from its timestamp', dashboard.getState().clock.running && dashboard.getState().clock.elapsed === 0);
  dashboard.click('clock-forward');
  verify('The clock supports one-minute adjustments while running', dashboard.getState().clock.elapsed >= 61 && dashboard.getState().clock.startedAt);
  dashboard.click('clock-toggle');
  const pausedClock = dashboard.getState().clock.elapsed;
  verify('Pausing the match clock preserves the elapsed time', !dashboard.getState().clock.running && pausedClock >= 61 && !dashboard.getState().clock.startedAt);
  const repairedClock = makeRuntime('/?room=repaired-clock', { broadcast: false, savedState: { ...dashboard.getState(), updatedAt: Date.now() + 1000, clock: { elapsed: 75, running: true, startedAt: null } } });
  verify('A running saved clock with a missing timestamp is repaired instead of freezing', repairedClock.getState().clock.running && repairedClock.getState().clock.startedAt);
  dashboard.click('period', '2T');
  verify('The period selector updates the live scoreboard', dashboard.getState().period === '2T');

  dashboard.click('yellow');
  verify('Player events expose a searchable athlete list for the selected team', dashboard.app.innerHTML.includes('list="event-player-options"') && dashboard.app.innerHTML.includes('Digite algumas letras para localizar'));
  dashboard.form.set('event-team', { value: 'away' });
  dashboard.form.set('event-name', { value: 'Rafael Costa' });
  dashboard.click('confirm-event');
  verify('Yellow-card lower thirds contain player and team', dashboard.app.innerHTML.includes('CARTÃO AMARELO') && dashboard.app.innerHTML.includes('Rafael Costa'));
  dashboard.click('red');
  verify('Card controls offer current lower-third and scoreboard-integrated modes', dashboard.app.innerHTML.includes('GC completo · como aparece atualmente') && dashboard.app.innerHTML.includes('Integrado somente ao placar'));
  dashboard.form.set('event-team', { value: 'home' });
  dashboard.form.set('event-card-mode', { value: 'scoreboard' });
  dashboard.form.set('event-name', { value: 'Lucas Oliveira' });
  dashboard.click('confirm-event');
  verify('Red cards can appear only inside the scoreboard', dashboard.getState().scoreboardCard.type === 'red' && dashboard.app.innerHTML.includes('scorebug-card-notice card-red') && dashboard.app.innerHTML.includes('Lucas Oliveira') && !dashboard.app.innerHTML.includes('data-overlay="event"'));

  dashboard.click('substitution');
  dashboard.form.set('event-team', { value: 'home' });
  dashboard.form.set('event-name', { value: 'Pedro Henrique' });
  dashboard.form.set('event-note', { value: 'Diego Ferreira' });
  dashboard.click('confirm-event');
  verify('Substitution graphics identify incoming and outgoing players', dashboard.app.innerHTML.includes('Pedro Henrique') && dashboard.app.innerHTML.includes('Diego Ferreira'));

  dashboard.click('tab', 'roster');
  dashboard.click('toggle-lineup');
  verify('Lineup overlay can be placed on air', dashboard.app.innerHTML.includes('data-overlay="lineup"'));
  verify('Lineup overlay shows exactly eleven players', (dashboard.app.innerHTML.match(/class="lineup-player"/g) || []).length === 11);
  dashboard.click('toggle-lineup');
  verify('Lineup stays mounted while its exit animation plays', !dashboard.getState().visible.lineup && dashboard.getState().lineupTransition.type === 'exit' && /lineup-banner[^\"]*is-exiting/.test(dashboard.app.innerHTML));
  dashboard.click('toggle-lineup');
  dashboard.click('toggle-photo-lineup');
  verify('Photo lineup is a separate on-air overlay and replaces the simple lineup safely', dashboard.getState().visible.photoLineup && !dashboard.getState().visible.lineup && dashboard.app.innerHTML.includes('data-overlay="photo-lineup"'));
  verify('Photo lineup renders the complete starting team as redesigned athlete cards', (dashboard.app.innerHTML.match(/class="photo-player"/g) || []).length === 11 && dashboard.app.innerHTML.includes('photo-player-fallback') && stylesheet.includes('gap: .42cqw') && stylesheet.includes('box-shadow: 0 .38cqw .8cqw'));
  verify('Photo lineup displays a full-width 1500 × 200 sponsor block without a name label', dashboard.getState().photoLineupShowSponsors && dashboard.app.innerHTML.includes('photo-lineup-sponsors') && dashboard.app.innerHTML.includes('BANNER 1500 × 200') && !dashboard.app.innerHTML.includes('PARCEIROS'));
  verify('Lineup controls expose a resizable sponsor bar', dashboard.app.innerHTML.includes('data-appearance="photoLineupSponsorBarSize"'));
  verify('Sponsor footer renders dedicated video media safely for broadcast', script.includes('lineupSponsor.lineupMediaType === \'video\'') && script.includes('autoplay muted loop playsinline'));
  verify('Lineup control exposes player photos, roles, positions, full staff, and formation', dashboard.app.innerHTML.includes('data-lineup-athlete-photo') && dashboard.app.innerHTML.includes('data-lineup-athlete-role') && dashboard.app.innerHTML.includes('data-lineup-athlete-position') && dashboard.app.innerHTML.includes('data-lineup-staff-photo') && dashboard.app.innerHTML.includes('data-lineup-formation'));
  dashboard.click('set-photo-lineup-stage', 'individual');
  verify('Individual presentation focuses only on the player without redundant labels or counter', dashboard.app.innerHTML.includes('data-stage="individual"') && dashboard.app.innerHTML.includes('lineup-spotlight') && !dashboard.app.innerHTML.includes('APRESENTAÇÃO INDIVIDUAL') && !dashboard.app.innerHTML.includes('FUTEBOL · ESCALAÇÃO') && !/\d{2} \/ \d{2}/.test(dashboard.app.innerHTML));
  verify('Individual presentation uses stronger player typography', stylesheet.includes('font-size: 4.45cqw') && stylesheet.includes('font-size: 1.35cqw'));
  dashboard.click('next-lineup-player');
  verify('Player changes use a directional broadcast transition', dashboard.app.innerHTML.includes('is-player-next') && stylesheet.includes('player-transition-sweep') && stylesheet.includes('player-photo-reveal'));
  dashboard.click('set-photo-lineup-stage', 'reserves');
  verify('Reserve presentation has its own broadcast stage', dashboard.app.innerHTML.includes('data-stage="reserves"') && dashboard.app.innerHTML.includes('BANCO DE RESERVAS'));
  dashboard.click('set-photo-lineup-stage', 'starters');
  verify('Technical staff closes the starters stage with a highlighted coach', dashboard.app.innerHTML.includes('data-stage="starters"') && dashboard.app.innerHTML.includes('lineup-staff-strip') && dashboard.app.innerHTML.includes('head-coach-highlight'));
  dashboard.click('lineup-add-staff');
  dashboard.click('set-photo-lineup-stage', 'starters');
  verify('Lineup management can add and present assistants with the coach', dashboard.app.innerHTML.includes('lineup-staff-strip') && dashboard.app.innerHTML.includes('Auxiliar técnico'));
  dashboard.click('set-photo-lineup-stage', 'formation');
  verify('Tactical presentation renders the selected formation on a pitch', dashboard.app.innerHTML.includes('data-stage="formation"') && dashboard.app.innerHTML.includes('tactical-pitch') && dashboard.app.innerHTML.includes('4-3-3'));
  dashboard.click('start-lineup-sequence');
  verify('Complete lineup sequence starts with individual players and automatic progression', dashboard.getState().photoLineupAuto.running && dashboard.getState().photoLineupStage === 'individual');
  dashboard.click('set-photo-lineup-stage', 'starters');
  dashboard.click('toggle-photo-lineup-sponsors');
  verify('Photo lineup sponsor footer can be hidden independently', !dashboard.getState().photoLineupShowSponsors && !dashboard.app.innerHTML.includes('class="photo-lineup-sponsors"'));
  dashboard.click('toggle-photo-lineup-sponsors');

  dashboard.click('overlay-sponsor');
  dashboard.form.set('event-name', { value: 'Patrocínio Local' });
  dashboard.click('confirm-event');
  verify('Sponsor graphics support a custom advertiser name', dashboard.getState().visible.sponsor && dashboard.app.innerHTML.includes('Patrocínio Local'));

  dashboard.click('open-obs');
  verify('OBS drawer supplies seven separate overlay URLs', (dashboard.app.innerHTML.match(/class="copy-row"/g) || []).length === 7);
  verify('OBS drawer includes an isolated photo-lineup URL', dashboard.app.innerHTML.includes('/overlay?layer=photo-lineup'));
  verify('OBS drawer includes the independent 1500 × 200 sponsor bar URL', dashboard.app.innerHTML.includes('/overlay?layer=sponsor-bar'));
  verify('OBS drawer explains that goal animation belongs to the isolated scoreboard output', dashboard.app.innerHTML.includes('Placar (inclui animação de gol)') && dashboard.app.innerHTML.includes('uma URL transparente independente'));
  verify('OBS program URL points to the complete transparent output', dashboard.app.innerHTML.includes('/overlay?layer=all'));
  dashboard.click('copy-url', 'all');
  await delay(10);
  verify('OBS links can be copied to the clipboard with the active room', dashboard.copied[0]?.endsWith('/overlay?layer=all&room=principal'));
  dashboard.click('open-output');
  verify('Complete program output opens in a dedicated tab', dashboard.opened[0]?.[0].endsWith('/overlay?layer=all&room=principal'));
  dashboard.click('open-preview');
  verify('Complete broadcast preview opens in a dedicated tab with its room', dashboard.opened.at(-1)?.[0].includes('/preview?room=principal'));
  dashboard.click('close-drawer');

  const eventOutput = makeRuntime('/overlay?layer=event', { broadcast: false });
  const lineupOutput = makeRuntime('/overlay?layer=lineup', { broadcast: false });
  const photoLineupOutput = makeRuntime('/overlay?layer=photo-lineup', { broadcast: false });
  const sponsorOutput = makeRuntime('/overlay?layer=sponsor', { broadcast: false });
  await delay(420);
  verify('Event output isolates lower thirds from all other graphics', eventOutput.app.innerHTML.includes('data-overlay="event"') && !eventOutput.app.innerHTML.includes('data-overlay="scoreboard"') && !eventOutput.app.innerHTML.includes('data-overlay="lineup"'));
  verify('Lineup output isolates the team list', lineupOutput.app.innerHTML.includes('data-overlay="lineup"') && !lineupOutput.app.innerHTML.includes('data-overlay="scoreboard"'));
  verify('Photo-lineup output isolates athlete cards and its sponsor footer', photoLineupOutput.app.innerHTML.includes('data-overlay="photo-lineup"') && photoLineupOutput.app.innerHTML.includes('photo-lineup-sponsors') && !photoLineupOutput.app.innerHTML.includes('data-overlay="scoreboard"'));
  verify('Sponsor output isolates the advertiser graphic', sponsorOutput.app.innerHTML.includes('data-overlay="sponsor"') && !sponsorOutput.app.innerHTML.includes('data-overlay="scoreboard"'));

  dashboard.click('typeface', 'oswald');
  verify('Scoreboard typography can be changed independently', dashboard.getState().typeface === 'oswald' && dashboard.app.innerHTML.includes('Impacto'));

  dashboard.click('tab', 'appearance');
  verify('Advanced appearance panel exposes per-overlay controls', dashboard.app.innerHTML.includes('Personalização por elemento') && (dashboard.app.innerHTML.match(/class="parameter-card"/g) || []).length === 5);
  verify('Every overlay type exposes selectable visual variations', ['scoreboardStyle','eventStyle','lineupStyle','photoLineupStyle','sponsorStyle'].every(field => dashboard.app.innerHTML.includes(`data-appearance="${field}"`)));
  dashboard.input({ appearance: 'eventStyle' }, 'block');
  dashboard.input({ appearance: 'photoLineupStyle' }, 'glass');
  verify('Overlay style variations update live state independently', dashboard.getState().appearance.eventStyle === 'block' && dashboard.getState().appearance.photoLineupStyle === 'glass');
  verify('Photo-lineup appearance controls include surface, rounding, sponsor count, and sponsor bar size', dashboard.app.innerHTML.includes('Acabamento da escalação com fotos') && dashboard.app.innerHTML.includes('data-appearance="photoLineupSurface"') && dashboard.app.innerHTML.includes('data-appearance="photoLineupSponsorCount"') && dashboard.app.innerHTML.includes('data-appearance="photoLineupSponsorBarSize"'));
  verify('Scoreboard styling panel exposes seven visual foundations and fine controls', (dashboard.app.innerHTML.match(/class="scoreboard-style-choice /g) || []).length === 7 && dashboard.app.innerHTML.includes('Opacidade da superfície') && dashboard.app.innerHTML.includes('Espessura do destaque'));
  dashboard.click('scoreboard-style', 'glass');
  dashboard.input({ appearance: 'scoreboardRadius' }, '12', 'range');
  dashboard.input({ appearance: 'scoreboardSurface' }, '76', 'range');
  dashboard.input({ appearance: 'scoreboardAccent' }, '5', 'range');
  dashboard.input({ appearance: 'scoreboardShadow' }, 'strong');
  verify('Scoreboard finish, radius, opacity, accent, and shadow are independently configurable', dashboard.getState().appearance.scoreboardStyle === 'glass' && dashboard.getState().appearance.scoreboardRadius === 12 && dashboard.getState().appearance.scoreboardSurface === 76 && dashboard.getState().appearance.scoreboardAccent === 5 && dashboard.getState().appearance.scoreboardShadow === 'strong');
  verify('Scoreboard style controls are emitted into the live graphic', dashboard.app.innerHTML.includes('scorebug-style-glass') && dashboard.app.innerHTML.includes('scorebug-shadow-strong') && dashboard.app.innerHTML.includes('--scoreboard-radius:12px') && dashboard.app.innerHTML.includes('--scoreboard-surface:76%') && dashboard.app.innerHTML.includes('--scoreboard-accent:5px'));
  for (const key of ['neon', 'ribbon', 'gradient']) {
    dashboard.click('scoreboard-style', key);
    verify(`New scoreboard style "${key}" is selectable and renders its own class into the live graphic`, dashboard.getState().appearance.scoreboardStyle === key && dashboard.app.innerHTML.includes(`scorebug-style-${key}`));
  }
  for (const key of ['elastic', 'glitch']) {
    dashboard.input({ appearance: 'scoreboardAnimation' }, key);
    verify(`New scoreboard transition "${key}" is selectable`, dashboard.getState().appearance.scoreboardAnimation === key);
  }
  verify('New scoreboard styles and transitions ship real CSS keyframes, not just markers', ['scorebug-style-neon', 'scorebug-style-ribbon', 'scorebug-style-gradient'].every(cls => stylesheet.includes(`.${cls}`)) && ['score-elastic-in', 'score-glitch-in'].every(name => stylesheet.includes(`@keyframes ${name}`)));
  verify('Sponsor settings accept multiple named 16:9 banners', dashboard.app.innerHTML.includes('Patrocinadores cadastrados') && dashboard.app.innerHTML.includes('data-sponsor-banner') && dashboard.app.innerHTML.includes('1920 × 1080'));
  dashboard.input({ appearance: 'sponsorFormat' }, 'banner-name');
  verify('Sponsor banner and name can be shown together', dashboard.getState().appearance.sponsorFormat === 'banner-name' && dashboard.app.innerHTML.includes('sponsor-banner-with-name') && dashboard.app.innerHTML.includes('data-format="banner-name"'));
  dashboard.input({ appearance: 'sponsorFormat' }, 'logo-name');
  verify('Sponsor graphics support dedicated logo plus name and lineup image/video media', dashboard.getState().appearance.sponsorFormat === 'logo-name' && dashboard.app.innerHTML.includes('data-format="logo-name"') && dashboard.app.innerHTML.includes('data-sponsor-logo') && dashboard.app.innerHTML.includes('data-sponsor-lineup-media') && dashboard.app.innerHTML.includes('video/mp4'));
  dashboard.click('add-sponsor');
  verify('Additional sponsors can be added to the rotation', dashboard.getState().sponsors.length === 2 && (dashboard.app.innerHTML.match(/class="sponsor-item /g) || []).length === 2);
  dashboard.click('toggle-sponsor-loop');
  verify('Sponsor rotation can run in a timed loop', dashboard.getState().sponsorLoop && dashboard.getState().visible.sponsor && dashboard.getState().sponsorExpiresAt > Date.now());
  dashboard.click('toggle-sponsor-loop');
  dashboard.input({ appearance: 'sponsorFormat' }, 'banner');
  verify('Sponsor output can switch from text to a 16:9 graphic', dashboard.getState().appearance.sponsorFormat === 'banner' && dashboard.app.innerHTML.includes('sponsor-banner-graphic') && dashboard.app.innerHTML.includes('data-format="banner"'));
  dashboard.input({ appearance: 'sponsorAnimation' }, 'flip');
  dashboard.input({ appearance: 'sponsorDuration' }, '12', 'range');
  dashboard.input({ appearance: 'sponsorAnimationSpeed' }, '135', 'range');
  const sponsorStartedAt = Date.now();
  dashboard.click('test-sponsor-animation');
  verify('Sponsor animation, speed, and on-air duration are parameterized', dashboard.getState().appearance.sponsorAnimation === 'flip' && dashboard.getState().appearance.sponsorAnimationSpeed === 135 && dashboard.getState().sponsorExpiresAt >= sponsorStartedAt + 11900 && dashboard.app.innerHTML.includes('is-entering sponsor-animation-flip'));
  dashboard.click('overlay-sponsor');
  verify('Sponsor manual removal plays its configured exit before unmounting', !dashboard.getState().visible.sponsor && dashboard.getState().sponsorTransition.type === 'exit' && dashboard.app.innerHTML.includes('is-exiting sponsor-animation-flip'));
  dashboard.input({ appearance: 'scoreboardScale' }, '125', 'range');
  dashboard.input({ appearance: 'scoreboardX' }, '18', 'range');
  dashboard.input({ appearance: 'scoreboardY' }, '22', 'range');
  dashboard.input({ appearance: 'eventFont' }, '135', 'range');
  dashboard.input({ appearance: 'eventX' }, '31', 'range');
  dashboard.input({ appearance: 'eventY' }, '64', 'range');
  dashboard.click('event-position', 'right');
  verify('GC offers left, center, and right broadcast-safe presets', dashboard.getState().appearance.eventPosition === 'right' && dashboard.getState().appearance.eventX === 98 && dashboard.app.innerHTML.includes('event-position-right'));
  dashboard.click('event-position', 'left');
  dashboard.input({ appearance: 'eventX' }, '31', 'range');
  dashboard.input({ appearance: 'lineupTypeface' }, 'montserrat');
  dashboard.input({ appearance: 'photoLineupScale' }, '112', 'range');
  dashboard.input({ appearance: 'photoLineupFont' }, '118', 'range');
  dashboard.input({ appearance: 'photoLineupTypeface' }, 'oswald');
  dashboard.input({ appearance: 'photoLineupX' }, '9', 'range');
  dashboard.input({ appearance: 'photoLineupY' }, '12', 'range');
  dashboard.input({ appearance: 'photoLineupSurface' }, '88', 'range');
  dashboard.input({ appearance: 'photoLineupRadius' }, '12', 'range');
  dashboard.input({ appearance: 'photoLineupSponsorCount' }, '4', 'range');
  dashboard.input({ appearance: 'photoLineupSponsorBarSize' }, '135', 'range');
  verify('Overlay scale, text size, and typeface are independently configurable', dashboard.getState().appearance.scoreboardScale === 125 && dashboard.getState().appearance.eventFont === 135 && dashboard.getState().appearance.lineupTypeface === 'montserrat');
  verify('Photo lineup has independent scale, typography, position, finishing, and sponsor bar controls', dashboard.getState().appearance.photoLineupScale === 112 && dashboard.getState().appearance.photoLineupFont === 118 && dashboard.getState().appearance.photoLineupTypeface === 'oswald' && dashboard.getState().appearance.photoLineupX === 9 && dashboard.getState().appearance.photoLineupY === 12 && dashboard.getState().appearance.photoLineupSurface === 88 && dashboard.getState().appearance.photoLineupRadius === 12 && dashboard.getState().appearance.photoLineupSponsorCount === 4 && dashboard.getState().appearance.photoLineupSponsorBarSize === 135);
  verify('Every overlay can be positioned horizontally and vertically', dashboard.getState().appearance.scoreboardX === 18 && dashboard.getState().appearance.scoreboardY === 22 && dashboard.getState().appearance.eventX === 31 && dashboard.getState().appearance.eventY === 64);
  verify('Appearance and position parameters are emitted as live overlay variables', dashboard.app.innerHTML.includes('--scoreboard-scale:1.25') && dashboard.app.innerHTML.includes('--event-name-size:3.7125cqw') && dashboard.app.innerHTML.includes('--scoreboard-x:18%') && dashboard.app.innerHTML.includes('--event-y:64%'));
  verify('Photo lineup settings are emitted as live overlay variables', dashboard.app.innerHTML.includes('--photo-lineup-scale:1.12') && dashboard.app.innerHTML.includes('--photo-lineup-x:9%') && dashboard.app.innerHTML.includes('--photo-lineup-y:12%') && dashboard.app.innerHTML.includes('--photo-lineup-surface:88%') && dashboard.app.innerHTML.includes('--photo-lineup-radius:12px') && dashboard.app.innerHTML.includes('--photo-lineup-sponsor-size:1.35'));
  dashboard.input({ appearance: 'goalText' }, 'É GOOOL');
  dashboard.input({ appearance: 'goalAnimation' }, 'bounce');
  dashboard.input({ appearance: 'goalWordDuration' }, '3', 'range');
  dashboard.input({ appearance: 'goalTeamDuration' }, '4', 'range');
  dashboard.click('test-goal');
  verify('Goal wording, animation style, and phase durations are configurable', dashboard.getState().goalGraphic.text === 'É GOOOL' && dashboard.getState().appearance.goalWordDuration === 3 && dashboard.getState().appearance.goalTeamDuration === 4 && dashboard.app.innerHTML.includes('goal-animation-bounce'));
  verify('Animated goal wording is rendered inside the scoreboard letter by letter', dashboard.app.innerHTML.includes('scorebug-goal-celebration') && (dashboard.app.innerHTML.match(/--letter-index:/g) || []).length >= 6);
  dashboard.input({ team: 'home', teamField: 'name' }, 'Juventude Esporte Clube da Ilha Comprida');
  await delay(3400);
  verify('Goal team phase keeps the complete long team name without ellipsis', dashboard.app.innerHTML.includes('Juventude Esporte Clube da Ilha Comprida') && dashboard.app.innerHTML.includes('goal-name-xlong') && !dashboard.app.innerHTML.includes('Juventude Esporte Clube da Ilha Comprida...'));
  dashboard.input({ team: 'home', teamField: 'name' }, 'Juventude Ilha');
  dashboard.input({ appearance: 'scoreboardAnimation' }, 'flip');
  dashboard.input({ appearance: 'scoreboardAnimationSpeed' }, '135', 'range');
  dashboard.click('test-scoreboard-animation');
  verify('Scoreboard transition style and speed are configurable', dashboard.getState().appearance.scoreboardAnimation === 'flip' && dashboard.getState().appearance.scoreboardAnimationSpeed === 135 && dashboard.app.innerHTML.includes('is-entering scorebug-animation-flip'));
  dashboard.click('overlay-scoreboard');
  verify('Hiding the scoreboard keeps it mounted for its exit animation', !dashboard.getState().visible.scoreboard && dashboard.getState().scoreboardTransition.type === 'exit' && dashboard.app.innerHTML.includes('is-exiting scorebug-animation-flip'));
  dashboard.click('overlay-scoreboard');
  dashboard.click('reset-appearance');
  verify('Appearance settings can be restored safely', dashboard.getState().appearance.scoreboardScale === 100 && dashboard.getState().appearance.scoreboardStyle === 'classic' && dashboard.getState().appearance.goalAnimation === 'typewriter');
  dashboard.click('appearance-preset', 'impact');
  verify('Quick visual presets configure multiple overlays together', dashboard.getState().appearance.scoreboardScale === 118 && dashboard.getState().appearance.scoreboardStyle === 'contrast' && dashboard.getState().appearance.eventScale === 125 && dashboard.getState().appearance.goalAnimation === 'bounce');
  dashboard.click('reset-appearance');

  dashboard.click('sport', 'volleyball');
  verify('Volleyball starts in set one with a fresh score', dashboard.getState().sport === 'volleyball' && dashboard.getState().period === 'S1' && dashboard.getState().home.score === 0);
  verify('Volleyball scoreboard displays sets and serve indicator', dashboard.app.innerHTML.includes('scorebug-sets') && dashboard.app.innerHTML.includes('serve-indicator'));
  verify('Volleyball preview displays a dedicated court', dashboard.app.innerHTML.includes('court-volleyball'));
  dashboard.click('volley-point', 'home');
  dashboard.click('volley-point', 'away');
  verify('Volleyball scoring transfers the serve automatically', dashboard.getState().away.score === 1 && dashboard.getState().sportData.volleyball.serve === 'away');
  for (let index = 0; index < 24; index++) dashboard.click('volley-point', 'home');
  verify('A regular volleyball set closes automatically at 25 points', dashboard.getState().sportData.volleyball.sets.home === 1 && dashboard.getState().period === 'S2');
  verify('A new volleyball set resets both point counters', dashboard.getState().home.score === 0 && dashboard.getState().away.score === 0);
  dashboard.click('volley-timeout-event', 'away');
  verify('Volleyball timeouts update both the counter and the live graphic', dashboard.getState().sportData.volleyball.timeouts.away === 1 && dashboard.app.innerHTML.includes('TEMPO TÉCNICO'));
  dashboard.click('period', 'S5');
  for (let index = 0; index < 15; index++) dashboard.click('volley-point', 'home');
  verify('The volleyball tie-break closes at 15 points', dashboard.getState().sportData.volleyball.sets.home === 2 && dashboard.getState().home.score === 15);

  dashboard.click('sport', 'basketball');
  verify('Basketball starts with a ten-minute countdown and quarter one', dashboard.getState().period === 'Q1' && dashboard.app.innerHTML.includes('10:00'));
  verify('Basketball graphics include a shot clock', dashboard.app.innerHTML.includes('scorebug-shot') && dashboard.app.innerHTML.includes('court-basketball'));
  dashboard.click('basket-points', 'home:3');
  dashboard.click('basket-points', 'away:2');
  verify('Basketball supports one-, two-, and three-point scoring', dashboard.getState().home.score === 3 && dashboard.getState().away.score === 2);
  verify('Basketball possession changes after a basket', dashboard.getState().sportData.basketball.possession === 'home');
  dashboard.click('shot-reset', '14');
  verify('Basketball shot clock resets to fourteen seconds', dashboard.getState().sportData.basketball.shotClock.remaining === 14);
  dashboard.click('basket-foul', 'home:1');
  dashboard.click('basket-timeout', 'away:1');
  verify('Basketball tracks team fouls and timeouts', dashboard.getState().sportData.basketball.fouls.home === 1 && dashboard.getState().sportData.basketball.timeouts.away === 1);
  dashboard.click('period', 'Q4');
  verify('Basketball quarter selection updates the scoreboard', dashboard.getState().period === 'Q4');

  dashboard.click('sport', 'futsal');
  verify('Futsal begins with a twenty-minute countdown', dashboard.getState().period === '1T' && dashboard.app.innerHTML.includes('20:00'));
  verify('Futsal graphics display accumulated fouls and a dedicated court', dashboard.app.innerHTML.includes('scorebug-fouls') && dashboard.app.innerHTML.includes('court-futsal'));
  for (let index = 0; index < 5; index++) dashboard.click('futsal-foul', 'home:1');
  verify('The fifth futsal foul receives a visual warning', dashboard.getState().sportData.futsal.fouls.home === 5 && dashboard.app.innerHTML.includes('metric-warning'));
  dashboard.click('goal-away');
  verify('Futsal goal controls remain compatible with in-scoreboard graphics', dashboard.getState().away.score === 1 && dashboard.app.innerHTML.includes('scorebug-goal-celebration'));

  dashboard.click('sport', 'football');
  verify('Football can be restored without losing customized team names', dashboard.getState().sport === 'football' && dashboard.getState().home.name === 'Juventude Ilha');
  verify('Switching sports preserves the selected visual typeface', dashboard.getState().typeface === 'oswald');

  verify('Responsive layouts are defined for tablets and phones', stylesheet.includes('@media (max-width: 800px)') && stylesheet.includes('@media (max-width: 490px)'));
  verify('Stable overlays animate only while explicitly entering or exiting', stylesheet.includes('.event-banner.is-entering') && stylesheet.includes('.lineup-banner.is-entering') && stylesheet.includes('.photo-lineup.is-entering') && !/\.event-banner \{[^}]*animation:/s.test(stylesheet) && !/\.lineup-banner \{[^}]*animation:/s.test(stylesheet) && !/\.photo-lineup \{[^}]*animation:/s.test(stylesheet));
  verify('Animation timelines preserve progress when another overlay rerenders', stylesheet.includes('--scoreboard-motion-offset') && stylesheet.includes('--event-motion-offset') && stylesheet.includes('--lineup-motion-offset') && stylesheet.includes('--photo-lineup-motion-offset') && stylesheet.includes('--sponsor-motion-offset') && stylesheet.includes('--goal-phase-offset'));
  verify('OBS outputs track already-painted transitions so re-renders resume them instead of restarting from a delayed midpoint', script.includes('seenMotionStarts') && script.includes("classList.add('overlay-output', 'obs-render-mode')"));
  verify('OBS performance mode normalizes every entrance/exit easing so no per-style curve (steps, overshoot) leaks into the lightweight swapped keyframes', /\.obs-render-mode \.scorebug\.is-entering\[class\*="scorebug-animation-"\] \{ animation-name: obs-enter-left; animation-timing-function: cubic-bezier\([^)]+\); \}/.test(stylesheet));
  verify('OBS performance mode replaces expensive effects with compositor-only animations', stylesheet.includes('@keyframes obs-enter-left') && stylesheet.includes('.obs-render-mode [data-overlay] * { filter: none !important; backdrop-filter: none !important; }') && stylesheet.includes('contain: layout paint style'));
  verify('OBS output keeps mounted elements when only an animation lifecycle finishes', script.includes('const shouldRender = !previous || previous.content !== fingerprint') && script.includes('outputAnimationFingerprint'));
  verify('Lineup sponsor banner fills a 1500 × 200 block without sponsor name text', stylesheet.includes('aspect-ratio: 7.5 / 1') && stylesheet.includes('.photo-lineup-sponsor img, .photo-lineup-sponsor video { width: 100%; height: 100%') && !script.includes('photo-lineup-sponsor">${media}<strong>'));
  const legacySponsorFingerprint = script.match(/if \(layer === 'sponsor'\) return JSON\.stringify\(([^;]+);/)?.[1] || '';
  verify('Independent sponsor bar state cannot invalidate the legacy sponsor output', script.includes("if (layer === 'sponsor-bar') return JSON.stringify") && !legacySponsorFingerprint.includes('sponsorBarMode') && !legacySponsorFingerprint.includes('sponsorBarVideo'));
  verify('Scorebugs, cards, morphing layouts, sponsors, lower thirds, lineups, and goals have complete animation sequences', stylesheet.includes('@keyframes score-number-pop') && stylesheet.includes('@keyframes score-content-return') && stylesheet.includes('@keyframes card-notice-in') && stylesheet.includes('@keyframes card-notice-out') && stylesheet.includes('@keyframes score-layout-expand') && stylesheet.includes('@keyframes score-layout-contract') && stylesheet.includes('@keyframes sponsor-slide-in') && stylesheet.includes('@keyframes sponsor-flip-out') && stylesheet.includes('@keyframes score-piece-in') && stylesheet.includes('@keyframes banner-arrive') && stylesheet.includes('@keyframes lineup-arrive') && stylesheet.includes('@keyframes lineup-leave') && stylesheet.includes('@keyframes photo-lineup-arrive') && stylesheet.includes('@keyframes photo-lineup-leave') && stylesheet.includes('@keyframes photo-player-arrive') && stylesheet.includes('@keyframes goal-overlay-in') && stylesheet.includes('@keyframes goal-overlay-out') && stylesheet.includes('@keyframes goal-letter-write'));
  verify('The site uses local fallback-safe broadcast typography', stylesheet.includes("--font: 'Segoe UI'") && stylesheet.includes("--display: 'Arial Narrow'"));

  await delay(130);
  const locallyPersisted = JSON.parse(await fs.readFile(testStatePath, 'utf8'));
  verify('The local server persists shared match data by room', locallyPersisted.__rooms.principal.sport === 'football');
  const localCatalog = await (await fetch(`${baseURL}/api/teams`)).json();
  verify('The local server persists a reusable team catalog', Array.isArray(localCatalog.teams) && localCatalog.teams.length >= 2);
  const localPortal = await (await fetch(`${baseURL}/api/team-portal?token=${localCatalog.teams[0].accessToken}`)).json();
  verify('Each registered team has a dedicated athlete-registration portal', localPortal.team.name === localCatalog.teams[0].name && Array.isArray(localPortal.team.athletes));

  const worker = (await import('./dist/server/index.js')).default;
  verify('Production worker serves the dashboard', (await worker.fetch(new Request('https://example.test/'), {})).status === 200);
  verify('Production worker serves the isolated overlay route', (await worker.fetch(new Request('https://example.test/overlay?layer=all'), {})).status === 200);
  verify('Production worker serves the complete preview route', (await worker.fetch(new Request('https://example.test/preview'), {})).status === 200);
  verify('Production worker serves the team registration portal route', (await worker.fetch(new Request('https://example.test/team?token=test'), {})).status === 200);
  verify('Production worker serves dedicated overlay management routes', (await worker.fetch(new Request('https://example.test/manage/scoreboard?room=principal'), {})).status === 200 && (await worker.fetch(new Request('https://example.test/manage/lineup?room=principal'), {})).status === 200);
  verify('Production worker serves stylesheet and JavaScript', (await worker.fetch(new Request('https://example.test/styles.css'), {})).status === 200 && (await worker.fetch(new Request('https://example.test/app.js'), {})).status === 200);
  const workerUnauthorizedWrite = await worker.fetch(new Request('https://example.test/api/state', { method: 'PUT', body: JSON.stringify({ updatedAt: 1 }), headers: { 'content-type': 'application/json' } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('Production worker rejects match-state writes without an administrator session', workerUnauthorizedWrite.status === 401);
  const initialSetupRequest = () => new Request('https://example.test/api/auth/admin/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'intruder', password: 'test-password' }) });
  verify('Worker setup fails closed when no installation code is configured', (await worker.fetch(initialSetupRequest(), {})).status === 503);
  verify('Worker setup rejects an unknown installation code', (await worker.fetch(initialSetupRequest(), { OVERLAY_SETUP_TOKEN: setupToken })).status === 403);
  const workerAdminSetup = await worker.fetch(new Request('https://example.test/api/auth/admin/setup', { method: 'POST', body: JSON.stringify({ username: 'sala-admin', password: 'senha-teste-123', setupToken }), headers: { 'content-type': 'application/json' } }), { OVERLAY_SETUP_TOKEN: setupToken });
  let workerAdminCookie = (workerAdminSetup.headers.get('set-cookie') || '').split(';')[0];
  verify('Production worker creates the first administrator and starts a session', workerAdminSetup.status === 200 && workerAdminCookie.startsWith('joa_admin='));
  const candidate = { updatedAt: Date.now(), home: { score: 4 } };
  await worker.fetch(new Request('https://example.test/api/state', { method: 'PUT', body: JSON.stringify(candidate), headers: { 'content-type': 'application/json', cookie: workerAdminCookie } }), { OVERLAY_SETUP_TOKEN: setupToken });
  const persisted = await (await worker.fetch(new Request('https://example.test/api/state'), {})).json();
  verify('Production worker synchronizes overlay state through its API', persisted.home.score === 4);
  const secondRoom = { updatedAt: Date.now() + 1, home: { score: 1 }, away: { score: 3 } };
  await worker.fetch(new Request('https://example.test/api/state?room=final-futsal', { method: 'PUT', body: JSON.stringify(secondRoom), headers: { 'content-type': 'application/json', cookie: workerAdminCookie } }), { OVERLAY_SETUP_TOKEN: setupToken });
  const isolatedRoom = await (await worker.fetch(new Request('https://example.test/api/state?room=final-futsal'), {})).json();
  const unchangedPrimary = await (await worker.fetch(new Request('https://example.test/api/state?room=principal'), {})).json();
  verify('Independent match rooms cannot overwrite one another', isolatedRoom.home.score === 1 && unchangedPrimary.home.score === 4);
  const catalogCandidate = { baseUpdatedAt: 0, updatedAt: Date.now() + 20, globalAppearance: { theme: 'custom', customPrimary: '#123456', customAccent: '#abcdef', typeface: 'rajdhani', appearance: {}, championshipTheme: {} }, teams: [{ id: 'team-test', name: 'Time Teste', short: 'TST', color: '#8253cd', logo: '', roster: '9 Ana Souza', accessToken: 'token123', athletes: [{ id: 'ana-1', name: 'Ana Souza', number: '9', height: '1.75', photo: '' }] }] };
  const catalogWrite = await worker.fetch(new Request('https://example.test/api/teams', { method: 'PUT', body: JSON.stringify(catalogCandidate), headers: { 'content-type': 'application/json', cookie: workerAdminCookie } }), { OVERLAY_SETUP_TOKEN: setupToken });
  const catalogRead = await (await worker.fetch(new Request('https://example.test/api/teams'), {})).json();
  verify('Overlay appearance is persisted globally with the shared catalog', catalogWrite.status === 200 && catalogRead.globalAppearance.customPrimary === '#123456');
  const teamCredentialsWrite = await worker.fetch(new Request('https://example.test/api/auth/team/credentials', { method: 'PUT', body: JSON.stringify({ teamId: 'team-test', username: 'time-teste', password: 'senha-time-123' }), headers: { 'content-type': 'application/json', cookie: workerAdminCookie } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('An administrator can set login credentials for a registered team', teamCredentialsWrite.status === 200);
  const teamLoginWrongPassword = await worker.fetch(new Request('https://example.test/api/auth/team/login', { method: 'POST', body: JSON.stringify({ teamId: 'team-test', username: 'time-teste', password: 'senha-errada' }), headers: { 'content-type': 'application/json' } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('Team login rejects an incorrect password', teamLoginWrongPassword.status === 401);
  const teamLoginPaddedPassword = await worker.fetch(new Request('https://example.test/api/auth/team/login', { method: 'POST', body: JSON.stringify({ teamId: 'team-test', username: 'time-teste', password: '  senha-time-123  ' }), headers: { 'content-type': 'application/json' } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('Team login tolerates a password pasted with surrounding spaces', teamLoginPaddedPassword.status === 200);
  const teamLogin = await worker.fetch(new Request('https://example.test/api/auth/team/login', { method: 'POST', body: JSON.stringify({ teamId: 'team-test', username: 'time-teste', password: 'senha-time-123' }), headers: { 'content-type': 'application/json' } }), { OVERLAY_SETUP_TOKEN: setupToken });
  let teamCookie = (teamLogin.headers.get('set-cookie') || '').split(';')[0];
  verify('A team logs in with its own credentials and receives a scoped session', teamLogin.status === 200 && teamCookie.startsWith('joa_team='));
  const portalRead = await (await worker.fetch(new Request('https://example.test/api/team-portal?token=token123'), {})).json();
  const portalUpdate = await (await worker.fetch(new Request('https://example.test/api/team-portal?team=team-test', { method: 'PUT', body: JSON.stringify({ athletes: [{ id: 'ana-1', name: 'Ana Souza', number: '10', height: '1.76', photo: '', squadRole: 'reserve', position: 'ATA' }], staff: [{ id: 'coach', name: 'Carlos Silva', role: 'Treinador', photo: '' }, { id: 'staff-assistant', name: 'Paulo Lima', role: 'Auxiliar técnico', photo: '' }], coach: { name: 'Carlos Silva', photo: '' }, formation: '4-2-3-1' }), headers: { 'content-type': 'application/json', cookie: teamCookie } }), {})).json();
  verify('Production catalog and team portal share athletes and complete technical staff', catalogWrite.status === 200 && portalRead.team.athletes[0].height === '1.75' && portalUpdate.team.roster === '10 Ana Souza' && portalUpdate.team.athletes[0].squadRole === 'reserve' && portalUpdate.team.athletes[0].position === 'ATA' && portalUpdate.team.coach.name === 'Carlos Silva' && portalUpdate.team.staff.length === 2 && portalUpdate.team.staff[1].name === 'Paulo Lima' && portalUpdate.team.formation === '4-2-3-1');
  const unauthorizedOperations = await worker.fetch(new Request('https://example.test/api/operations'), {});
  verify('Operational catalogs and audit logs require an administrator session', unauthorizedOperations.status === 401);
  const operationsBeforeCreate = await (await worker.fetch(new Request('https://example.test/api/operations', { headers: { cookie: workerAdminCookie } }), {})).json();
  const championshipCreate = await worker.fetch(new Request('https://example.test/api/operations', { method: 'POST', body: JSON.stringify({ action: 'upsert-championship', baseUpdatedAt: operationsBeforeCreate.updatedAt || 0, item: { name: 'Copa Teste', season: '2026', status: 'active' } }), headers: { 'content-type': 'application/json', cookie: workerAdminCookie } }), {});
  const championshipData = await championshipCreate.json();
  const championshipId = championshipData.operations.championships[0].id;
  const matchCreate = await worker.fetch(new Request('https://example.test/api/operations', { method: 'POST', body: JSON.stringify({ action: 'upsert-match', baseUpdatedAt: championshipData.operations.updatedAt, item: { championshipId, homeTeamId: 'team-test', awayTeamId: 'team-rival', room: 'copa-teste-final', kickoffAt: '2026-09-20T18:00', status: 'scheduled' } }), headers: { 'content-type': 'application/json', cookie: workerAdminCookie } }), {});
  const matchData = await matchCreate.json();
  verify('An administrator can organize championships and match-specific overlay rooms', championshipCreate.status === 200 && matchCreate.status === 200 && matchData.operations.matches[0].room === 'copa-teste-final');
  const staleOperationWrite = await worker.fetch(new Request('https://example.test/api/operations', { method: 'POST', body: JSON.stringify({ action: 'mark-all-notifications-read', baseUpdatedAt: championshipData.operations.updatedAt }), headers: { 'content-type': 'application/json', cookie: workerAdminCookie } }), {});
  verify('Concurrent Super Admin updates reject stale operational data', staleOperationWrite.status === 409);
  const delegationComplete = await worker.fetch(new Request('https://example.test/api/team-delegation/complete', { method: 'POST', body: JSON.stringify({ teamId: 'team-test' }), headers: { 'content-type': 'application/json', cookie: teamCookie } }), {});
  const operationsAfterCompletion = await (await worker.fetch(new Request('https://example.test/api/operations', { headers: { cookie: workerAdminCookie } }), {})).json();
  verify('Completing a team delegation creates an unread Super Admin notification and an audit entry', delegationComplete.status === 200 && operationsAfterCompletion.notifications.some(item => item.teamId === 'team-test' && !item.read) && operationsAfterCompletion.logs.some(item => item.action === 'delegation.completed' && item.target === 'Time Teste'));
  const portalWriteByOtherTeam = await worker.fetch(new Request('https://example.test/api/team-portal?team=team-test', { method: 'PUT', body: JSON.stringify({ name: 'Invasão' }), headers: { 'content-type': 'application/json' } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('Team portal writes are rejected without a matching session', portalWriteByOtherTeam.status === 401);
  const teamCredentialsList = await (await worker.fetch(new Request('https://example.test/api/auth/team/credentials', { headers: { cookie: workerAdminCookie } }), {})).json();
  verify('An administrator can list every team login on file', Array.isArray(teamCredentialsList.entries) && teamCredentialsList.entries.some(entry => entry.teamId === 'team-test' && entry.username === 'time-teste'));
  const teamCredentialsDelete = await worker.fetch(new Request('https://example.test/api/auth/team/credentials?teamId=team-test', { method: 'DELETE', headers: { cookie: workerAdminCookie } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('An administrator can revoke a team login', teamCredentialsDelete.status === 200);
  const teamLoginAfterRevoke = await worker.fetch(new Request('https://example.test/api/auth/team/login', { method: 'POST', body: JSON.stringify({ teamId: 'team-test', username: 'time-teste', password: 'senha-time-123' }), headers: { 'content-type': 'application/json' } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('A revoked team login can no longer authenticate', teamLoginAfterRevoke.status === 401);
  const adminAccountsList = await (await worker.fetch(new Request('https://example.test/api/auth/admin/accounts', { headers: { cookie: workerAdminCookie } }), {})).json();
  verify('An administrator can list every administrator account', adminAccountsList.accounts.length === 1 && adminAccountsList.accounts[0].username === 'sala-admin');
  const soleAdminDelete = await worker.fetch(new Request(`https://example.test/api/auth/admin/accounts?id=${adminAccountsList.accounts[0].id}`, { method: 'DELETE', headers: { cookie: workerAdminCookie } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('The last remaining administrator account cannot be removed', soleAdminDelete.status === 409);
  const secondAdminCreate = await worker.fetch(new Request('https://example.test/api/auth/admin/accounts', { method: 'POST', body: JSON.stringify({ username: 'segundo-admin', password: 'senha-teste-456' }), headers: { 'content-type': 'application/json', cookie: workerAdminCookie } }), { OVERLAY_SETUP_TOKEN: setupToken });
  const secondAdminData = await secondAdminCreate.json();
  verify('An administrator can add another administrator account', secondAdminCreate.status === 200 && secondAdminData.accounts.length === 2);
  const firstAdminId = secondAdminData.accounts.find(account => account.username === 'sala-admin').id;
  const firstAdminDelete = await worker.fetch(new Request(`https://example.test/api/auth/admin/accounts?id=${firstAdminId}`, { method: 'DELETE', headers: { cookie: workerAdminCookie } }), { OVERLAY_SETUP_TOKEN: setupToken });
  verify('An administrator account can be removed once another one remains', firstAdminDelete.status === 200 && (await firstAdminDelete.json()).accounts.length === 1);

  const revokedAdmin = await worker.fetch(new Request('https://example.test/api/auth/admin/accounts', { headers: { cookie: workerAdminCookie } }), {});
  verify('Removing an administrator also revokes their active cookie', revokedAdmin.status === 401);
  const revokedTeam = await worker.fetch(new Request('https://example.test/api/auth/team/session', { headers: { cookie: teamCookie } }), {});
  verify('Removing team credentials also revokes the active cookie', (await revokedTeam.json()).authenticated === false);
  const replacementLogin = await worker.fetch(new Request('https://example.test/api/auth/admin/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username: 'segundo-admin', password: 'senha-teste-456' }) }), {});
  workerAdminCookie = replacementLogin.headers.get('set-cookie').split(';')[0];
  await worker.fetch(new Request('https://example.test/api/auth/team/credentials', { method: 'PUT', headers: { 'content-type': 'application/json', cookie: workerAdminCookie }, body: JSON.stringify({ teamId: 'team-test', username: 'time-teste', password: 'senha-time-123' }) }), {});
  const replacementTeamLogin = await worker.fetch(new Request('https://example.test/api/auth/team/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: 'team-test', username: 'time-teste', password: 'senha-time-123' }) }), {});
  teamCookie = replacementTeamLogin.headers.get('set-cookie').split(';')[0];

  const objects = new Map();
  const bucket = {
    async put(key, body, options) { objects.set(key, { data: await new Response(body).arrayBuffer(), type: options.httpMetadata.contentType }); },
    async get(key) {
      const item = objects.get(key);
      return item ? { body: item.data, httpEtag: 'test-etag', writeHttpMetadata(headers) { headers.set('content-type', item.type); } } : null;
    },
  };
  const badgeUpload = await worker.fetch(new Request('https://example.test/api/assets/principal/home-logo', { method: 'PUT', body: new Uint8Array([1,2,3]), headers: { 'content-type': 'image/png', cookie: workerAdminCookie } }), { BUCKET: bucket });
  const badgeRead = await worker.fetch(new Request('https://example.test/api/assets/principal/home-logo'), { BUCKET: bucket });
  verify('Team badges are stored separately from live scoreboard state', badgeUpload.status === 200 && badgeRead.status === 200 && badgeRead.headers.get('content-type') === 'image/png');
  const sponsorUpload = await worker.fetch(new Request('https://example.test/api/assets/principal/sponsor-banner', { method: 'PUT', body: new Uint8Array([4,5,6]), headers: { 'content-type': 'image/webp', cookie: workerAdminCookie } }), { BUCKET: bucket });
  const sponsorRead = await worker.fetch(new Request('https://example.test/api/assets/principal/sponsor-banner'), { BUCKET: bucket });
  verify('16:9 sponsor artwork is stored and served independently', sponsorUpload.status === 200 && sponsorRead.status === 200 && sponsorRead.headers.get('content-type') === 'image/webp');
  const lineupMediaUpload = await worker.fetch(new Request('https://example.test/api/assets/principal/sponsor-1-lineup-media', { method: 'PUT', body: new Uint8Array([0,0,0,24]), headers: { 'content-type': 'video/mp4', cookie: workerAdminCookie } }), { BUCKET: bucket });
  const lineupMediaRead = await worker.fetch(new Request('https://example.test/api/assets/principal/sponsor-1-lineup-media'), { BUCKET: bucket });
  verify('Dedicated sponsor video media is persisted and served with its video type', lineupMediaUpload.status === 200 && lineupMediaRead.status === 200 && lineupMediaRead.headers.get('content-type') === 'video/mp4');
  const athletePhotoUpload = await worker.fetch(new Request('https://example.test/api/team-athlete-photo?team=team-test&athlete=ana-1', { method: 'PUT', body: new Uint8Array([7,8,9]), headers: { 'content-type': 'image/jpeg', cookie: teamCookie } }), { BUCKET: bucket });
  const athletePhotoRead = await worker.fetch(new Request('https://example.test/api/team-athlete-photo?team=team-test&athlete=ana-1'), { BUCKET: bucket });
  const catalogAfterPhoto = await (await worker.fetch(new Request('https://example.test/api/teams'), { BUCKET: bucket })).json();
  verify('Uploaded athlete photos persist immediately and use a valid cache-safe URL', athletePhotoUpload.status === 200 && athletePhotoRead.status === 200 && athletePhotoRead.headers.get('content-type') === 'image/jpeg' && catalogAfterPhoto.teams[0].athletes[0].photo.includes('&v=') && !catalogAfterPhoto.teams[0].athletes[0].photo.includes('ana-1?v='));
  const staffPhotoUpload = await worker.fetch(new Request('https://example.test/api/team-athlete-photo?team=team-test&athlete=staff-assistant', { method: 'PUT', body: new Uint8Array([9,8,7]), headers: { 'content-type': 'image/webp', cookie: teamCookie } }), { BUCKET: bucket });
  const catalogAfterStaffPhoto = await (await worker.fetch(new Request('https://example.test/api/teams'), { BUCKET: bucket })).json();
  verify('Technical staff photos share the durable presentation asset flow', staffPhotoUpload.status === 200 && catalogAfterStaffPhoto.teams[0].staff[1].photo.includes('staff-assistant') && catalogAfterStaffPhoto.teams[0].staff[1].photo.includes('&v='));
  const coachPhotoUpload = await worker.fetch(new Request('https://example.test/api/team-athlete-photo?team=team-test&athlete=coach', { method: 'PUT', body: new Uint8Array([10,11,12]), headers: { 'content-type': 'image/webp', cookie: teamCookie } }), { BUCKET: bucket });
  const coachPhotoRead = await worker.fetch(new Request('https://example.test/api/team-athlete-photo?team=team-test&athlete=coach'), { BUCKET: bucket });
  verify('Coach photos use the same protected presentation asset flow', coachPhotoUpload.status === 200 && coachPhotoRead.status === 200 && coachPhotoRead.headers.get('content-type') === 'image/webp');

  const rows = new Map();
  const database = {
    prepare(sql) {
      return {
        args: [],
        bind(...args) { this.args = args; return this; },
        async run() {
          if (sql.startsWith('INSERT')) {
            const [room, payload, updatedAt] = this.args;
            const previous = rows.get(room);
            if (!previous || (!sql.startsWith('INSERT OR IGNORE') && Number(updatedAt) >= Number(previous.updated_at))) rows.set(room, { payload, updated_at: updatedAt });
          }
          return { success: true };
        },
        async first() { return rows.get(this.args[0]) || null; },
      };
    },
  };
  const writer = (await import('./dist/server/index.js?writer=isolated')).default;
  const reader = (await import('./dist/server/index.js?reader=isolated')).default;
  const writerAdminSetup = await writer.fetch(new Request('https://example.test/api/auth/admin/setup', { method: 'POST', body: JSON.stringify({ username: 'sala-admin', password: 'senha-teste-123', setupToken }), headers: { 'content-type': 'application/json' } }), { DB: database, OVERLAY_SETUP_TOKEN: setupToken });
  const writerAdminCookie = (writerAdminSetup.headers.get('set-cookie') || '').split(';')[0];
  const durableCandidate = { updatedAt: Date.now() + 50, sport: 'volleyball', home: { score: 22 }, away: { score: 19 } };
  const writeResponse = await writer.fetch(new Request('https://example.test/api/state', { method: 'PUT', body: JSON.stringify(durableCandidate), headers: { 'content-type': 'application/json', cookie: writerAdminCookie } }), { DB: database, OVERLAY_SETUP_TOKEN: setupToken });
  const durableRead = await (await reader.fetch(new Request('https://example.test/api/state'), { DB: database, OVERLAY_SETUP_TOKEN: setupToken })).json();
  verify('A control session and an isolated OBS worker share durable D1-backed state', writeResponse.status === 200 && durableRead.home.score === 22 && durableRead.away.score === 19);
  const readerSessionCheck = await reader.fetch(new Request('https://example.test/api/auth/admin/session', { headers: { cookie: writerAdminCookie } }), { DB: database, OVERLAY_SETUP_TOKEN: setupToken });
  verify('An isolated reader isolate verifies a session cookie signed by another isolate through the shared D1-backed secret', (await readerSessionCheck.json()).authenticated === true);
  const older = { updatedAt: durableCandidate.updatedAt - 5, home: { score: 0 } };
  await reader.fetch(new Request('https://example.test/api/state', { method: 'PUT', body: JSON.stringify(older), headers: { 'content-type': 'application/json', cookie: writerAdminCookie } }), { DB: database, OVERLAY_SETUP_TOKEN: setupToken });
  const protectedState = await (await writer.fetch(new Request('https://example.test/api/state'), { DB: database, OVERLAY_SETUP_TOKEN: setupToken })).json();
  verify('Older browser sessions cannot overwrite a newer shared scoreboard', protectedState.home.score === 22);
  for (const room of ['auth-secret', 'admins', 'team-credentials', 'team-catalog', 'operations', '__auth_secret__', '__admins__', '__team_credentials__', '__operations__', 'AUTH-SECRET']) {
    for (const method of ['GET', 'PUT']) {
      const options = { method, headers: { 'content-type': 'application/json', cookie: writerAdminCookie } };
      if (method === 'PUT') options.body = JSON.stringify({ updatedAt: Date.now(), value: 'attack' });
      const response = await writer.fetch(new Request('https://example.test/api/state?room=' + encodeURIComponent(room), options), { DB: database });
      verify('Worker blocks private room ' + room + ' via ' + method, response.status === 403);
      const localResponse = await fetch(baseURL + '/api/state?room=' + encodeURIComponent(room), { method });
      verify('Node blocks private room ' + room + ' via ' + method, localResponse.status === 403);
    }
  }
  // Independent isolates racing to create the secret must use the same winner.
  const raceA = (await import('./dist/server/index.js?race=A')).default;
  const raceB = (await import('./dist/server/index.js?race=B')).default;
  rows.clear();
  const raceRequest = username => new Request('https://example.test/api/auth/admin/setup', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password: 'race-password-123', setupToken }) });
  const raceResponses = await Promise.all([raceA.fetch(raceRequest('race-a'), { DB: database, OVERLAY_SETUP_TOKEN: setupToken }), raceB.fetch(raceRequest('race-b'), { DB: database, OVERLAY_SETUP_TOKEN: setupToken })]);
  verify('Concurrent setup creates exactly one first administrator', raceResponses.filter(r => r.status === 200).length === 1 && raceResponses.filter(r => r.status === 409).length === 1);
  const winningCookie = raceResponses.find(r => r.status === 200).headers.get('set-cookie').split(';')[0];
  for (const isolated of [raceA, raceB]) {
    const check = await isolated.fetch(new Request('https://example.test/api/auth/admin/session', { headers: { cookie: winningCookie } }), { DB: database });
    verify('Racing isolates share one secret and validate the winning session', (await check.json()).authenticated === true);
  }
  const hostingConfig = JSON.parse(await fs.readFile(new URL('./.openai/hosting.json', import.meta.url), 'utf8'));
  verify('The deployed site requests a durable D1 database binding', hostingConfig.d1 === 'DB');
  verify('The deployed site requests R2 storage for team badges and sponsor artwork', hostingConfig.r2 === 'BUCKET');

  process.stdout.write(`PASS · ${checks.length} verified checks covering dashboard interactions, football graphics, real-time isolated-client synchronization, transparent output, OBS URLs, production worker routes, and responsive styles.\n`);
} finally {
  for (const timer of activeTimers) { clearTimeout(timer); clearInterval(timer); }
  await new Promise(resolve => server.close(resolve));
  await fs.rm(testDirectory, { recursive: true, force: true });
}
