import fs from 'node:fs/promises';
import path from 'node:path';

const root = import.meta.dirname;
const output = path.join(root, 'dist');
const serverOutput = path.join(output, 'server');
const assets = path.join(output, 'client');
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(assets, { recursive: true });
await fs.mkdir(serverOutput, { recursive: true });

const textAssets = ['index.html', 'styles.css', 'app.js'];
const assetMap = {};
for (const filename of textAssets) {
  const source = await fs.readFile(path.join(root, 'public', filename), 'utf8');
  await fs.writeFile(path.join(assets, filename), source);
  assetMap[`/${filename}`] = source;
}

// Binary assets (logos, images) are not embedded in the Worker script; they're
// copied as-is so the ASSETS binding (see wrangler.json) serves them directly.
for (const filename of await fs.readdir(path.join(root, 'public'))) {
  if (textAssets.includes(filename)) continue;
  await fs.copyFile(path.join(root, 'public', filename), path.join(assets, filename));
}

const authModule = (await fs.readFile(path.join(root, 'auth.mjs'), 'utf8'))
  .replace(/^export \{[^}]*\};\s*/gm, '');

const worker = `${authModule}
const assets = ${JSON.stringify(assetMap)};
const fallbackStates = new Map();
let databaseReady;
let legacyPhotosHydrated = false;
let authSecretPromise;
const types = { '/index.html': 'text/html; charset=utf-8', '/styles.css': 'text/css; charset=utf-8', '/app.js': 'text/javascript; charset=utf-8' };

async function ensureDatabase(database) {
  if (!databaseReady) {
    databaseReady = database.prepare('CREATE TABLE IF NOT EXISTS overlay_state (room TEXT PRIMARY KEY, payload TEXT NOT NULL, updated_at INTEGER NOT NULL)').run();
  }
  await databaseReady;
}

function safeRoom(value) {
  return String(value || 'principal').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'principal';
}

async function readState(env, room) {
  if (!env?.DB) return fallbackStates.get(room) || {};
  await ensureDatabase(env.DB);
  const row = await env.DB.prepare('SELECT payload FROM overlay_state WHERE room = ?').bind(room).first();
  return row?.payload ? JSON.parse(row.payload) : {};
}

async function persistState(env, room, candidate) {
  if (!env?.DB) {
    const current = fallbackStates.get(room);
    if (!current || Number(candidate.updatedAt || 0) >= Number(current.updatedAt || 0)) fallbackStates.set(room, candidate);
    return fallbackStates.get(room);
  }
  await ensureDatabase(env.DB);
  await env.DB.prepare('INSERT INTO overlay_state (room, payload, updated_at) VALUES (?, ?, ?) ON CONFLICT(room) DO UPDATE SET payload = excluded.payload, updated_at = excluded.updated_at WHERE excluded.updated_at >= overlay_state.updated_at').bind(room, JSON.stringify(candidate), Number(candidate.updatedAt || 0)).run();
  return readState(env, room);
}

async function persistStateIfCurrent(env, room, candidate, expectedUpdatedAt) {
  if (!env?.DB) {
    const current = fallbackStates.get(room) || {};
    if (Number(current.updatedAt || 0) !== Number(expectedUpdatedAt || 0)) return { ok: false, state: current };
    fallbackStates.set(room, candidate);
    return { ok: true, state: candidate };
  }
  await ensureDatabase(env.DB);
  const result = Number(expectedUpdatedAt || 0) === 0
    ? await env.DB.prepare('INSERT OR IGNORE INTO overlay_state (room, payload, updated_at) VALUES (?, ?, ?)').bind(room, JSON.stringify(candidate), Number(candidate.updatedAt || 0)).run()
    : await env.DB.prepare('UPDATE overlay_state SET payload = ?, updated_at = ? WHERE room = ? AND updated_at = ?').bind(JSON.stringify(candidate), Number(candidate.updatedAt || 0), room, Number(expectedUpdatedAt || 0)).run();
  if (Number(result?.meta?.changes || 0) < 1) return { ok: false, state: await readState(env, room) };
  return { ok: true, state: candidate };
}

async function insertPrivateOnce(env, key, candidate) {
  if (!env?.DB) {
    if (!fallbackStates.has(key)) fallbackStates.set(key, candidate);
    return fallbackStates.get(key);
  }
  await ensureDatabase(env.DB);
  await env.DB.prepare('INSERT OR IGNORE INTO overlay_state (room, payload, updated_at) VALUES (?, ?, ?)').bind(key, JSON.stringify(candidate), Number(candidate.updatedAt || 0)).run();
  return readState(env, key);
}

async function getAuthSecret(env) {
  if (!authSecretPromise) {
    authSecretPromise = (async () => {
      const existing = await readState(env, '__auth_secret__');
      if (existing?.value) return existing.value;
      const persisted = await insertPrivateOnce(env, '__auth_secret__', { value: randomSecretHex(), updatedAt: Date.now() });
      return persisted.value;
    })();
  }
  return authSecretPromise;
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
}

function validPassword(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= 8 && trimmed.length <= 200;
}

function safeId(value, fallback = '') {
  const normalized = String(value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 64);
  return normalized || fallback;
}

function normalizeOperations(candidate) {
  const store = candidate && typeof candidate === 'object' ? candidate : {};
  store.championships = Array.isArray(store.championships) ? store.championships : [];
  store.matches = Array.isArray(store.matches) ? store.matches : [];
  store.notifications = Array.isArray(store.notifications) ? store.notifications : [];
  store.logs = Array.isArray(store.logs) ? store.logs : [];
  store.delegationStatus = store.delegationStatus && typeof store.delegationStatus === 'object' ? store.delegationStatus : {};
  return store;
}

async function getOperations(env) {
  return normalizeOperations(await readState(env, '__operations__'));
}

function addAudit(store, action, actor, target = '', details = '') {
  store.logs.unshift({ id: crypto.randomUUID(), action, actor: String(actor || 'sistema').slice(0, 80), target: String(target || '').slice(0, 120), details: String(details || '').slice(0, 300), createdAt: Date.now() });
  store.logs = store.logs.slice(0, 500);
}

function delegationCheck(team) {
  const athletes = Array.isArray(team?.athletes) ? team.athletes : [];
  const staff = Array.isArray(team?.staff) ? team.staff : [];
  const missing = [];
  if (!String(team?.name || '').trim()) missing.push('nome da equipe');
  if (String(team?.short || '').trim().length < 2) missing.push('sigla');
  if (!athletes.length) missing.push('ao menos um atleta');
  if (athletes.some(item => !String(item?.name || '').trim() || !String(item?.number || '').trim())) missing.push('nome e número de todos os atletas');
  if (!staff.length) missing.push('comissão técnica');
  if (staff.some(item => !String(item?.name || '').trim() || !String(item?.role || '').trim())) missing.push('nome e função de toda a comissão');
  return { complete: missing.length === 0, missing };
}

function markDelegationChanged(store, team, actor) {
  const current = store.delegationStatus[team.id];
  if (current?.status !== 'completed') return;
  store.delegationStatus[team.id] = { ...current, status: 'needs-review', changedAt: Date.now() };
  store.notifications.unshift({ id: crypto.randomUUID(), type: 'delegation-changed', teamId: team.id, title: team.name + ' alterou a delegação', message: 'O cadastro foi modificado depois de ter sido concluído.', read: false, createdAt: Date.now() });
  store.notifications = store.notifications.slice(0, 200);
  addAudit(store, 'delegation.changed', actor, team.name, 'Cadastro alterado após a conclusão.');
}

function unauthorized() {
  return Response.json({ ok: false, error: 'Autenticação necessária' }, { status: 401, headers: { 'cache-control': 'no-store' } });
}

async function getAdminSession(request, secret, env) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const payload = await verifySession(cookies.joa_admin, secret);
  const admins = await readState(env, '__admins__');
  return payload?.kind === 'admin' && admins.accounts?.some(a => a.username === payload.username && a.id === payload.accountId) ? payload : null;
}

async function getTeamSession(request, secret, env) {
  const cookies = parseCookies(request.headers.get('cookie'));
  const payload = await verifySession(cookies.joa_team, secret);
  const credentials = await readState(env, '__team_credentials__');
  return payload?.kind === 'team' && credentials.entries?.some(e => e.teamId === payload.teamId && e.username === payload.username && e.updatedAt === payload.credentialVersion) ? payload : null;
}

async function sessionCookieHeader(request, url, name, payload, secret) {
  const token = await signSession({ ...payload, exp: Date.now() + SESSION_TTL_MS }, secret);
  return serializeCookie(name, token, { maxAge: Math.floor(SESSION_TTL_MS / 1000), secure: url.protocol === 'https:' });
}

function clearCookieHeader(url, name) {
  return serializeCookie(name, '', { maxAge: 0, secure: url.protocol === 'https:' });
}

async function hydrateLegacyTeamPhotos(env, catalog) {
  if (legacyPhotosHydrated || !env?.BUCKET?.list || !catalog?.teams?.length) return catalog;
  try {
    const listed = await env.BUCKET.list({ prefix: 'team-portals/' });
    const keys = new Set((listed.objects || []).map(object => object.key));
    let changed = false;
    for (const team of catalog.teams) {
      const subjects = [...(team.athletes || []), ...(team.staff || [])];
      if (!team.staff?.length && team.coach) subjects.push({ ...team.coach, id: 'coach', legacyCoach: true });
      for (const subject of subjects) {
        const key = 'team-portals/' + team.id + '/' + subject.id;
        if (subject.photo || !keys.has(key)) continue;
        subject.photo = '/api/team-athlete-photo?team=' + encodeURIComponent(team.id) + '&athlete=' + encodeURIComponent(subject.id) + '&v=restored';
        if (subject.legacyCoach) team.coach.photo = subject.photo;
        changed = true;
      }
    }
    if (changed) {
      catalog.updatedAt = Date.now();
      await persistState(env, 'team-catalog', catalog);
    }
    legacyPhotosHydrated = true;
  } catch {}
  return catalog;
}

function findTeamByRequest(url, catalog) {
  const teamId = String(url.searchParams.get('team') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
  if (teamId) return catalog?.teams?.find(item => item.id === teamId);
  const token = String(url.searchParams.get('token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
  if (token) return catalog?.teams?.find(item => item.accessToken === token);
  return undefined;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = safeRoom(url.searchParams.get('room'));
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'juventude-overlay-studio' }, { headers: { 'cache-control': 'no-store' } });

    if (url.pathname === '/api/auth/admin/status') {
      const admins = await readState(env, '__admins__');
      return Response.json({ hasAdmins: (admins?.accounts?.length || 0) > 0 }, { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/auth/admin/setup') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const secret = await getAuthSecret(env);
      const admins = (await readState(env, '__admins__')) || { accounts: [], updatedAt: 0 };
      if ((admins.accounts || []).length > 0) return Response.json({ ok: false, error: 'Já existe um administrador configurado' }, { status: 409 });
      if (!env?.OVERLAY_SETUP_TOKEN || env.OVERLAY_SETUP_TOKEN.length < 32) return Response.json({ ok: false, error: 'Cadastro inicial indisponível. Configure o código de instalação no servidor.' }, { status: 503 });
      try {
        const candidate = await request.json();
        if (!validSetupToken(candidate.setupToken, env.OVERLAY_SETUP_TOKEN)) return Response.json({ ok: false, error: 'Código de instalação inválido' }, { status: 403 });
        const username = normalizeUsername(candidate.username);
        if (username.length < 3 || !validPassword(candidate.password)) return Response.json({ ok: false, error: 'Usuário ou senha inválidos' }, { status: 400 });
        admins.accounts = [{ id: crypto.randomUUID(), username, passwordHash: await hashPassword(candidate.password), createdAt: Date.now() }];
        admins.updatedAt = Date.now();
        const saved = await insertPrivateOnce(env, '__admins__', admins);
        if (saved.accounts?.[0]?.id !== admins.accounts[0].id) return Response.json({ ok: false, error: 'Administrador já configurado' }, { status: 409 });
        const cookie = await sessionCookieHeader(request, url, 'joa_admin', { kind: 'admin', username, accountId: admins.accounts[0].id }, secret);
        return Response.json({ ok: true, username }, { headers: { 'set-cookie': cookie, 'cache-control': 'no-store' } });
      } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    }
    if (url.pathname === '/api/auth/admin/login') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const secret = await getAuthSecret(env);
      const admins = await readState(env, '__admins__');
      try {
        const candidate = await request.json();
        const username = normalizeUsername(candidate.username);
        const account = admins?.accounts?.find(item => item.username === username);
        if (!account || !(await verifyPassword(candidate.password, account.passwordHash))) return Response.json({ ok: false, error: 'Usuário ou senha incorretos' }, { status: 401 });
        const cookie = await sessionCookieHeader(request, url, 'joa_admin', { kind: 'admin', username, accountId: account.id }, secret);
        return Response.json({ ok: true, username }, { headers: { 'set-cookie': cookie, 'cache-control': 'no-store' } });
      } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    }
    if (url.pathname === '/api/auth/admin/logout') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      return Response.json({ ok: true }, { headers: { 'set-cookie': clearCookieHeader(url, 'joa_admin'), 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/auth/admin/session') {
      const secret = await getAuthSecret(env);
      const session = await getAdminSession(request, secret, env);
      return Response.json({ authenticated: Boolean(session), username: session?.username || null }, { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/auth/admin/accounts') {
      const secret = await getAuthSecret(env);
      if (!(await getAdminSession(request, secret, env))) return unauthorized();
      const admins = (await readState(env, '__admins__')) || { accounts: [], updatedAt: 0 };
      if (request.method === 'GET') {
        return Response.json({ accounts: (admins.accounts || []).map(item => ({ id: item.id, username: item.username })) }, { headers: { 'cache-control': 'no-store' } });
      }
      if (request.method === 'DELETE') {
        const id = String(url.searchParams.get('id') || '');
        if ((admins.accounts || []).length <= 1) return Response.json({ ok: false, error: 'Mantenha ao menos um administrador.' }, { status: 409 });
        const remaining = admins.accounts.filter(item => item.id !== id);
        if (remaining.length === admins.accounts.length) return Response.json({ ok: false, error: 'Administrador não encontrado.' }, { status: 404 });
        admins.accounts = remaining;
        admins.updatedAt = Date.now();
        await persistState(env, '__admins__', admins);
        return Response.json({ ok: true, accounts: admins.accounts.map(item => ({ id: item.id, username: item.username })) }, { headers: { 'cache-control': 'no-store' } });
      }
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      try {
        const candidate = await request.json();
        const username = normalizeUsername(candidate.username);
        if (username.length < 3 || !validPassword(candidate.password)) return Response.json({ ok: false, error: 'Usuário ou senha inválidos' }, { status: 400 });
        if ((admins.accounts || []).some(item => item.username === username)) return Response.json({ ok: false, error: 'Usuário já existe' }, { status: 409 });
        admins.accounts = [...(admins.accounts || []), { id: crypto.randomUUID(), username, passwordHash: await hashPassword(candidate.password), createdAt: Date.now() }];
        admins.updatedAt = Date.now();
        await persistState(env, '__admins__', admins);
        return Response.json({ ok: true, accounts: admins.accounts.map(item => ({ id: item.id, username: item.username })) }, { headers: { 'cache-control': 'no-store' } });
      } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    }
    if (url.pathname === '/api/auth/team/login') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      const secret = await getAuthSecret(env);
      const credentials = await readState(env, '__team_credentials__');
      try {
        const candidate = await request.json();
        const teamId = String(candidate.teamId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
        const username = normalizeUsername(candidate.username);
        const entry = credentials?.entries?.find(item => item.teamId === teamId && item.username === username);
        if (!entry || !(await verifyPassword(candidate.password, entry.passwordHash))) return Response.json({ ok: false, error: 'Usuário ou senha incorretos' }, { status: 401 });
        const catalog = await readState(env, 'team-catalog');
        const team = catalog?.teams?.find(item => item.id === teamId);
        const cookie = await sessionCookieHeader(request, url, 'joa_team', { kind: 'team', teamId, username, credentialVersion: entry.updatedAt }, secret);
        return Response.json({ ok: true, teamId, teamName: team?.name || '' }, { headers: { 'set-cookie': cookie, 'cache-control': 'no-store' } });
      } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    }
    if (url.pathname === '/api/auth/team/logout') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      return Response.json({ ok: true }, { headers: { 'set-cookie': clearCookieHeader(url, 'joa_team'), 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/auth/team/session') {
      const secret = await getAuthSecret(env);
      const session = await getTeamSession(request, secret, env);
      const catalog = session ? await readState(env, 'team-catalog') : null;
      const team = catalog?.teams?.find(item => item.id === session?.teamId);
      return Response.json({ authenticated: Boolean(session), teamId: session?.teamId || null, teamName: team?.name || null }, { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/auth/team/credentials') {
      const teamId = String(url.searchParams.get('teamId') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
      const secret = await getAuthSecret(env);
      if (request.method === 'PUT') {
        if (!(await getAdminSession(request, secret, env))) return unauthorized();
        const credentials = (await readState(env, '__team_credentials__')) || { entries: [], updatedAt: 0 };
        try {
          const candidate = await request.json();
          const bodyTeamId = String(candidate.teamId || teamId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
          const username = normalizeUsername(candidate.username);
          if (!bodyTeamId || username.length < 3 || !validPassword(candidate.password)) return Response.json({ ok: false, error: 'Dados inválidos' }, { status: 400 });
          const entries = (credentials.entries || []).filter(item => item.teamId !== bodyTeamId);
          entries.push({ teamId: bodyTeamId, username, passwordHash: await hashPassword(candidate.password), updatedAt: Date.now() });
          credentials.entries = entries;
          credentials.updatedAt = Date.now();
          await persistState(env, '__team_credentials__', credentials);
          return Response.json({ ok: true, teamId: bodyTeamId, username }, { headers: { 'cache-control': 'no-store' } });
        } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
      }
      if (request.method === 'DELETE') {
        if (!(await getAdminSession(request, secret, env))) return unauthorized();
        const credentials = (await readState(env, '__team_credentials__')) || { entries: [], updatedAt: 0 };
        const before = (credentials.entries || []).length;
        credentials.entries = (credentials.entries || []).filter(item => item.teamId !== teamId);
        if (credentials.entries.length === before) return Response.json({ ok: false, error: 'Acesso não encontrado.' }, { status: 404 });
        credentials.updatedAt = Date.now();
        await persistState(env, '__team_credentials__', credentials);
        return Response.json({ ok: true }, { headers: { 'cache-control': 'no-store' } });
      }
      if (!(await getAdminSession(request, secret, env))) return unauthorized();
      const credentials = await readState(env, '__team_credentials__');
      if (teamId) {
        const entry = credentials?.entries?.find(item => item.teamId === teamId);
        return Response.json({ teamId, username: entry?.username || null, hasPassword: Boolean(entry) }, { headers: { 'cache-control': 'no-store' } });
      }
      return Response.json({ entries: (credentials?.entries || []).map(item => ({ teamId: item.teamId, username: item.username, updatedAt: item.updatedAt })) }, { headers: { 'cache-control': 'no-store' } });
    }

    if (url.pathname === '/api/operations') {
      const secret = await getAuthSecret(env);
      const admin = await getAdminSession(request, secret, env);
      if (!admin) return unauthorized();
      let store = await getOperations(env);
      if (request.method === 'GET') return Response.json(store, { headers: { 'cache-control': 'no-store' } });
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      try {
        const candidate = await request.json();
        const baseUpdatedAt = Number(candidate.baseUpdatedAt || 0);
        const current = await getOperations(env);
        if (baseUpdatedAt !== Number(current.updatedAt || 0)) return Response.json({ ok: false, error: 'Os dados foram atualizados por outro administrador.', operations: current }, { status: 409 });
        store = structuredClone(current);
        const action = String(candidate.action || '');
        if (action === 'upsert-championship') {
          const item = candidate.item || {};
          const id = safeId(item.id || item.name, 'campeonato-' + Date.now().toString(36));
          const championship = { id, name: String(item.name || '').trim().slice(0, 100), season: String(item.season || '').trim().slice(0, 40), startDate: String(item.startDate || '').slice(0, 10), endDate: String(item.endDate || '').slice(0, 10), status: ['planned', 'active', 'finished'].includes(item.status) ? item.status : 'planned', updatedAt: Date.now() };
          if (!championship.name) return Response.json({ ok: false, error: 'Informe o nome do campeonato.' }, { status: 400 });
          const index = store.championships.findIndex(entry => entry.id === id);
          if (index >= 0) store.championships[index] = championship; else store.championships.unshift(championship);
          addAudit(store, index >= 0 ? 'championship.updated' : 'championship.created', admin.username, championship.name, championship.season);
        } else if (action === 'delete-championship') {
          const id = safeId(candidate.id);
          if (store.matches.some(match => match.championshipId === id)) return Response.json({ ok: false, error: 'O campeonato possui partidas vinculadas.' }, { status: 409 });
          const existing = store.championships.find(entry => entry.id === id);
          store.championships = store.championships.filter(entry => entry.id !== id);
          if (existing) addAudit(store, 'championship.deleted', admin.username, existing.name);
        } else if (action === 'upsert-match') {
          const item = candidate.item || {};
          const id = safeId(item.id, 'partida-' + Date.now().toString(36));
          const previous = store.matches.find(entry => entry.id === id);
          const roomId = safeId(previous?.room || item.room || id, id).slice(0, 48);
          if (store.matches.some(entry => entry.room === roomId && entry.id !== id)) return Response.json({ ok: false, error: 'Já existe uma partida usando esta sala.' }, { status: 409 });
          const match = { id, championshipId: safeId(item.championshipId), homeTeamId: safeId(item.homeTeamId), awayTeamId: safeId(item.awayTeamId), kickoffAt: String(item.kickoffAt || '').slice(0, 24), venue: String(item.venue || '').trim().slice(0, 120), round: String(item.round || '').trim().slice(0, 60), status: ['scheduled', 'live', 'finished', 'cancelled'].includes(item.status) ? item.status : 'scheduled', room: roomId, updatedAt: Date.now() };
          if (!match.championshipId || !match.homeTeamId || !match.awayTeamId || match.homeTeamId === match.awayTeamId) return Response.json({ ok: false, error: 'Selecione campeonato, mandante e visitante diferentes.' }, { status: 400 });
          const index = store.matches.findIndex(entry => entry.id === id);
          if (index >= 0) store.matches[index] = match; else store.matches.unshift(match);
          addAudit(store, index >= 0 ? 'match.updated' : 'match.created', admin.username, roomId, match.homeTeamId + ' x ' + match.awayTeamId);
        } else if (action === 'delete-match') {
          const id = safeId(candidate.id);
          const existing = store.matches.find(entry => entry.id === id);
          store.matches = store.matches.filter(entry => entry.id !== id);
          if (existing) addAudit(store, 'match.deleted', admin.username, existing.room);
        } else if (action === 'mark-notification-read') {
          const notification = store.notifications.find(entry => entry.id === candidate.id);
          if (notification) notification.read = true;
        } else if (action === 'mark-all-notifications-read') {
          store.notifications.forEach(entry => { entry.read = true; });
        } else {
          return Response.json({ ok: false, error: 'Ação inválida.' }, { status: 400 });
        }
        store.updatedAt = Date.now();
        const persisted = await persistStateIfCurrent(env, '__operations__', store, baseUpdatedAt);
        if (!persisted.ok) return Response.json({ ok: false, error: 'Os dados foram atualizados por outro administrador.', operations: normalizeOperations(persisted.state) }, { status: 409 });
        return Response.json({ ok: true, operations: store }, { headers: { 'cache-control': 'no-store' } });
      } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    }

    if (url.pathname === '/api/team-delegation/complete') {
      if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 });
      try {
        const candidate = await request.json();
        const teamId = safeId(candidate.teamId);
        const secret = await getAuthSecret(env);
        const admin = await getAdminSession(request, secret, env);
        const teamSession = admin ? null : await getTeamSession(request, secret, env);
        if (!admin && !(teamSession && teamSession.teamId === teamId)) return unauthorized();
        const catalog = await readState(env, 'team-catalog');
        const team = catalog?.teams?.find(item => item.id === teamId);
        if (!team) return Response.json({ ok: false, error: 'Equipe não encontrada.' }, { status: 404 });
        const check = delegationCheck(team);
        if (!check.complete) return Response.json({ ok: false, error: 'Complete os campos obrigatórios antes de concluir.', missing: check.missing }, { status: 409 });
        const store = await getOperations(env);
        const actor = admin?.username || teamSession?.username || team.name;
        const completedAt = Date.now();
        store.delegationStatus[team.id] = { status: 'completed', completedAt, completedBy: actor };
        store.notifications.unshift({ id: crypto.randomUUID(), type: 'delegation-completed', teamId: team.id, title: team.name + ' concluiu a delegação', message: (team.athletes?.length || 0) + ' atletas e ' + (team.staff?.length || 0) + ' membros da comissão foram confirmados.', read: false, createdAt: completedAt });
        store.notifications = store.notifications.slice(0, 200);
        addAudit(store, 'delegation.completed', actor, team.name, (team.athletes?.length || 0) + ' atletas; ' + (team.staff?.length || 0) + ' membros da comissão.');
        store.updatedAt = completedAt;
        await persistState(env, '__operations__', store);
        return Response.json({ ok: true, delegation: store.delegationStatus[team.id] }, { headers: { 'cache-control': 'no-store' } });
      } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
    }

    if (url.pathname === '/api/teams') {
      if (request.method === 'PUT') {
        const secret = await getAuthSecret(env);
        if (!(await getAdminSession(request, secret, env))) return unauthorized();
        try {
          const candidate = await request.json();
          if (!Array.isArray(candidate.teams)) return new Response('Invalid team catalog', { status: 400 });
          const baseUpdatedAt = Number(candidate.baseUpdatedAt || 0);
          const current = await readState(env, 'team-catalog');
          if (baseUpdatedAt !== Number(current.updatedAt || 0)) return Response.json({ ok: false, error: 'Catálogo atualizado por outro administrador.', catalog: current }, { status: 409 });
          delete candidate.baseUpdatedAt;
          const persisted = await persistStateIfCurrent(env, 'team-catalog', candidate, baseUpdatedAt);
          if (!persisted.ok) return Response.json({ ok: false, error: 'Catálogo atualizado por outro administrador.', catalog: persisted.state }, { status: 409 });
          return Response.json(persisted.state, { headers: { 'cache-control': 'no-store' } });
        } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
      }
      return Response.json(await hydrateLegacyTeamPhotos(env, await readState(env, 'team-catalog')), { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/team-portal') {
      const catalog = await hydrateLegacyTeamPhotos(env, await readState(env, 'team-catalog'));
      const team = findTeamByRequest(url, catalog);
      if (!team) return new Response('Team not found', { status: 404 });
      if (request.method === 'PUT') {
        const secret = await getAuthSecret(env);
        const admin = await getAdminSession(request, secret, env);
        const teamSession = admin ? null : await getTeamSession(request, secret, env);
        if (!admin && !(teamSession && teamSession.teamId === team.id)) return unauthorized();
        try {
          const candidate = await request.json();
          team.name = String(candidate.name || team.name || '').slice(0, 80);
          team.short = String(candidate.short || team.short || 'TIM').toUpperCase().slice(0, 3);
          team.color = /^#[0-9a-f]{6}$/i.test(String(candidate.color || '')) ? candidate.color : team.color;
          team.logo = String(candidate.logo || team.logo || '').slice(0, 500);
          team.athletes = Array.isArray(candidate.athletes) ? candidate.athletes.slice(0, 100).map((athlete, index) => ({
            id: String(athlete?.id || 'atleta-' + (index + 1)).replace(/[^a-z0-9-]/gi, '').slice(0, 56),
            name: String(athlete?.name || '').slice(0, 100), number: String(athlete?.number || '').slice(0, 6),
            height: String(athlete?.height || '').slice(0, 5), photo: String(athlete?.photo || '').slice(0, 500),
            squadRole: athlete?.squadRole === 'reserve' ? 'reserve' : athlete?.squadRole === 'starter' ? 'starter' : index < 11 ? 'starter' : 'reserve',
            position: String(athlete?.position || '').toUpperCase().replace(/[^A-ZÀ-Ü0-9-]/g, '').slice(0, 6),
          })) : team.athletes || [];
          team.staff = Array.isArray(candidate.staff) && candidate.staff.length ? candidate.staff.slice(0, 30).map((member, index) => ({
            id: String(member?.id || 'staff-' + (index + 1)).replace(/[^a-z0-9-]/gi, '').slice(0, 56),
            name: String(member?.name || '').slice(0, 100),
            role: String(member?.role || (index === 0 ? 'Treinador' : 'Auxiliar técnico')).slice(0, 60),
            photo: String(member?.photo || '').slice(0, 500),
          })) : team.staff || [{ id: 'coach', name: candidate?.coach?.name || team?.coach?.name || 'Treinador', role: 'Treinador', photo: candidate?.coach?.photo || team?.coach?.photo || '' }];
          const headCoach = team.staff.find(member => member.role === 'Treinador') || team.staff[0];
          team.coach = { name: String(headCoach?.name || candidate?.coach?.name || 'Treinador').slice(0, 100), photo: String(headCoach?.photo || candidate?.coach?.photo || '').slice(0, 500) };
          team.formation = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'].includes(candidate?.formation) ? candidate.formation : team.formation || '4-3-3';
          team.roster = team.athletes.map(athlete => ((athlete.number || '') + ' ' + (athlete.name || '')).trim()).filter(Boolean).join('\\n');
          const operations = await getOperations(env);
          const actor = admin?.username || teamSession?.username || team.name;
          markDelegationChanged(operations, team, actor);
          addAudit(operations, 'delegation.saved', actor, team.name, team.athletes.length + ' atletas; ' + team.staff.length + ' membros da comissão.');
          operations.updatedAt = Date.now();
          catalog.updatedAt = operations.updatedAt;
          await persistState(env, 'team-catalog', catalog);
          await persistState(env, '__operations__', operations);
          return Response.json({ team, delegation: operations.delegationStatus[team.id] || { status: 'draft' } }, { headers: { 'cache-control': 'no-store' } });
        } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
      }
      const operations = await getOperations(env);
      return Response.json({ team, delegation: operations.delegationStatus[team.id] || { status: 'draft' }, completion: delegationCheck(team) }, { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/team-athlete-photo') {
      const catalog = await readState(env, 'team-catalog');
      const team = findTeamByRequest(url, catalog);
      const athleteId = String(url.searchParams.get('athlete') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 56);
      if (team && athleteId === 'coach' && !team.coach) team.coach = { name: 'Treinador', photo: '' };
      let staffMember = team?.staff?.find(item => item.id === athleteId);
      if (team && request.method === 'PUT' && !staffMember && athleteId.startsWith('staff-')) {
        team.staff ||= [];
        staffMember = { id: athleteId, name: '', role: 'Auxiliar técnico', photo: '' };
        team.staff.push(staffMember);
      }
      let athlete = team?.athletes?.find(item => item.id === athleteId);
      if (team && request.method === 'PUT' && !athlete && athleteId.startsWith('atleta-')) {
        team.athletes ||= [];
        athlete = { id: athleteId, name: '', number: '', height: '', photo: '', squadRole: 'reserve', position: '' };
        team.athletes.push(athlete);
      }
      const subject = staffMember || (athleteId === 'coach' ? team?.coach : athlete);
      if (!team || !subject) return new Response('Presentation subject not found', { status: 404 });
      if (!env?.BUCKET) return new Response('Asset storage unavailable', { status: 503 });
      const key = 'team-portals/' + team.id + '/' + athleteId;
      if (request.method === 'PUT') {
        const secret = await getAuthSecret(env);
        const admin = await getAdminSession(request, secret, env);
        const teamSession = admin ? null : await getTeamSession(request, secret, env);
        if (!admin && !(teamSession && teamSession.teamId === team.id)) return unauthorized();
        const length = Number(request.headers.get('content-length') || 0);
        if (length > 5000000) return new Response('Asset too large', { status: 413 });
        await env.BUCKET.put(key, request.body, { httpMetadata: { contentType: request.headers.get('content-type') || 'image/png' } });
        const photoUrl = '/api/team-athlete-photo?team=' + encodeURIComponent(team.id) + '&athlete=' + encodeURIComponent(athleteId) + '&v=' + Date.now();
        subject.photo = photoUrl;
        if (athleteId === 'coach') {
          const headCoach = team.staff?.find(member => member.role === 'Treinador') || team.staff?.[0];
          if (headCoach) headCoach.photo = photoUrl;
        }
        catalog.updatedAt = Date.now();
        await persistState(env, 'team-catalog', catalog);
        return Response.json({ ok: true, url: photoUrl });
      }
      const object = await env.BUCKET.get(key);
      if (!object) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('cache-control', 'private, max-age=3600');
      return new Response(object.body, { headers });
    }
    if (url.pathname.startsWith('/api/assets/')) {
      const parts = url.pathname.split('/');
      const assetRoom = safeRoom(parts[3] || room);
      const assetName = String(parts[4] || 'logo').toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 64) || 'logo';
      const key = 'overlay-assets/' + assetRoom + '/' + assetName;
      if (!env?.BUCKET) return new Response('Asset storage unavailable', { status: 503 });
      if (request.method === 'PUT') {
        const secret = await getAuthSecret(env);
        if (assetRoom === 'team-portals') {
          const ownerId = assetName.replace(/-logo$/, '');
          const admin = await getAdminSession(request, secret, env);
          const teamSession = admin ? null : await getTeamSession(request, secret, env);
          if (!admin && !(teamSession && teamSession.teamId === ownerId)) return unauthorized();
        } else if (!(await getAdminSession(request, secret, env))) return unauthorized();
        const length = Number(request.headers.get('content-length') || 0);
        const maxLength = assetName === 'sponsors-wide-video' ? 50000000 : assetName.endsWith('-lineup-media') ? 25000000 : assetName.endsWith('-wide') ? 8000000 : 5000000;
        if (length > maxLength) return new Response('Asset too large', { status: 413 });
        await env.BUCKET.put(key, request.body, { httpMetadata: { contentType: request.headers.get('content-type') || 'image/png' } });
        return Response.json({ ok: true, url: '/api/assets/' + assetRoom + '/' + assetName });
      }
      const object = await env.BUCKET.get(key);
      if (!object) return new Response('Not found', { status: 404 });
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('etag', object.httpEtag);
      headers.set('cache-control', 'public, max-age=31536000, immutable');
      return new Response(object.body, { headers });
    }
    if (url.pathname === '/api/state') {
      if (isReservedRoom(room)) return Response.json({ ok: false, error: 'Sala reservada' }, { status: 403 });
      if (request.method === 'PUT') {
        const secret = await getAuthSecret(env);
        if (!(await getAdminSession(request, secret, env))) return unauthorized();
        try {
          const candidate = await request.json();
          const state = await persistState(env, room, candidate);
          return Response.json({ ok: true, updatedAt: state.updatedAt, persistent: Boolean(env?.DB), serverTime: Date.now() }, { headers: { 'cache-control': 'no-store, no-cache, must-revalidate' } });
        } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 500, headers: { 'cache-control': 'no-store' } }); }
      }
      try {
        return Response.json(await readState(env, room), { headers: { 'cache-control': 'no-store, no-cache, must-revalidate' } });
      } catch (error) {
        return Response.json({ ok: false, error: error.message }, { status: 500, headers: { 'cache-control': 'no-store' } });
      }
    }
    const name = ['/', '/overlay', '/preview', '/team'].includes(url.pathname) || url.pathname === '/manage' || url.pathname.startsWith('/manage/') ? '/index.html' : url.pathname;
    if (Object.hasOwn(assets, name)) {
      return new Response(assets[name], { headers: { 'content-type': types[name], 'cache-control': 'no-store' } });
    }
    if (env?.ASSETS) return env.ASSETS.fetch(request);
    return new Response('Not found', { status: 404 });
  }
};
`;

await fs.writeFile(path.join(serverOutput, 'index.js'), worker);
await fs.writeFile(path.join(serverOutput, 'package.json'), '{"type":"module"}\n');
await fs.mkdir(path.join(output, '.openai'), { recursive: true });
await fs.copyFile(path.join(root, '.openai', 'hosting.json'), path.join(output, '.openai', 'hosting.json'));
process.stdout.write(`Built self-contained production worker and ${Object.keys(assetMap).length} static assets.\n`);
