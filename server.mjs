import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as auth from './auth.mjs';

const root = path.join(import.meta.dirname, 'public');
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || '0.0.0.0';
const storagePath = process.env.OVERLAY_STATE_FILE || path.join(import.meta.dirname, '.data', 'overlay-state.json');
let sharedStates = {};

try {
  const saved = JSON.parse(await fs.readFile(storagePath, 'utf8'));
  sharedStates = saved && saved.__rooms ? saved.__rooms : { principal: saved };
} catch (error) {
  if (error.code !== 'ENOENT') process.stderr.write(`Could not read saved overlay state: ${error.message}\n`);
}

async function persist() {
  await fs.mkdir(path.dirname(storagePath), { recursive: true });
  await fs.writeFile(storagePath, JSON.stringify({ __rooms: sharedStates }), 'utf8');
}

sharedStates.__admins__ ||= { accounts: [], updatedAt: 0 };
sharedStates.__team_credentials__ ||= { entries: [], updatedAt: 0 };
if (!sharedStates.__auth_secret__) {
  sharedStates.__auth_secret__ = { value: auth.randomSecretHex() };
  await persist();
}
const AUTH_SECRET = sharedStates.__auth_secret__.value;
const SETUP_TOKEN = process.env.OVERLAY_SETUP_TOKEN || auth.randomSecretHex();
if (!process.env.OVERLAY_SETUP_TOKEN && sharedStates.__admins__.accounts.length === 0) {
  process.stderr.write('Código de instalação local (primeiro administrador): ' + SETUP_TOKEN + '\n');
}

function normalizeUsername(value) {
  return String(value || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 40);
}

function validPassword(value) {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  return trimmed.length >= 8 && trimmed.length <= 200;
}

async function readBody(request) {
  let body = '';
  for await (const chunk of request) body += chunk;
  return body;
}

function sendJson(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
  response.end(JSON.stringify(body));
}

function isSecureRequest(request) {
  return Boolean(request.socket && request.socket.encrypted) || request.headers['x-forwarded-proto'] === 'https';
}

async function setSessionCookie(response, request, name, payload) {
  const token = await auth.signSession({ ...payload, exp: Date.now() + auth.SESSION_TTL_MS }, AUTH_SECRET);
  response.setHeader('Set-Cookie', auth.serializeCookie(name, token, { maxAge: Math.floor(auth.SESSION_TTL_MS / 1000), secure: isSecureRequest(request) }));
}

function clearSessionCookie(response, request, name) {
  response.setHeader('Set-Cookie', auth.serializeCookie(name, '', { maxAge: 0, secure: isSecureRequest(request) }));
}

async function getAdminSession(request) {
  const cookies = auth.parseCookies(request.headers.cookie);
  const payload = await auth.verifySession(cookies.joa_admin, AUTH_SECRET);
  return payload?.kind === 'admin' && sharedStates.__admins__.accounts.some(a => a.username === payload.username && a.id === payload.accountId) ? payload : null;
}

async function getTeamSession(request) {
  const cookies = auth.parseCookies(request.headers.cookie);
  const payload = await auth.verifySession(cookies.joa_team, AUTH_SECRET);
  return payload?.kind === 'team' && sharedStates.__team_credentials__.entries.some(e => e.teamId === payload.teamId && e.username === payload.username && e.updatedAt === payload.credentialVersion) ? payload : null;
}

async function requireAdmin(request, response) {
  const session = await getAdminSession(request);
  if (!session) sendJson(response, 401, { ok: false, error: 'Autenticação necessária' });
  return session;
}

async function requireTeamAccess(request, response, teamId) {
  const admin = await getAdminSession(request);
  if (admin) return true;
  const team = await getTeamSession(request);
  if (team && team.teamId === teamId) return true;
  sendJson(response, 401, { ok: false, error: 'Autenticação necessária' });
  return false;
}

function findTeamByRequest(url) {
  const catalog = sharedStates.__team_catalog__;
  const teamId = String(url.searchParams.get('team') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
  if (teamId) return catalog?.teams?.find(item => item.id === teamId);
  const token = String(url.searchParams.get('token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
  if (token) return catalog?.teams?.find(item => item.accessToken === token);
  return undefined;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const room = String(url.searchParams.get('room') || 'principal').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'principal';
  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, service: 'juventude-overlay-studio' }));
    return;
  }

  if (url.pathname === '/api/auth/admin/status') {
    sendJson(response, 200, { hasAdmins: sharedStates.__admins__.accounts.length > 0 });
    return;
  }

  if (url.pathname === '/api/auth/admin/setup') {
    if (request.method !== 'POST') { response.writeHead(405).end('Method not allowed'); return; }
    if (sharedStates.__admins__.accounts.length > 0) { sendJson(response, 409, { ok: false, error: 'Já existe um administrador configurado' }); return; }
    try {
      const candidate = JSON.parse(await readBody(request));
      if (!auth.validSetupToken(candidate.setupToken, SETUP_TOKEN)) { sendJson(response, 403, { ok: false, error: 'Código de instalação inválido' }); return; }
      const username = normalizeUsername(candidate.username);
      if (username.length < 3 || !validPassword(candidate.password)) { sendJson(response, 400, { ok: false, error: 'Usuário ou senha inválidos' }); return; }
      const account = { id: crypto.randomUUID(), username, passwordHash: await auth.hashPassword(candidate.password), createdAt: Date.now() };
      if (sharedStates.__admins__.accounts.length > 0) { sendJson(response, 409, { ok: false, error: 'Administrador já configurado' }); return; }
      sharedStates.__admins__.accounts.push(account);
      sharedStates.__admins__.updatedAt = Date.now();
      await persist();
      await setSessionCookie(response, request, 'joa_admin', { kind: 'admin', username, accountId: account.id });
      sendJson(response, 200, { ok: true, username });
    } catch { sendJson(response, 400, { ok: false, error: 'JSON inválido' }); }
    return;
  }

  if (url.pathname === '/api/auth/admin/login') {
    if (request.method !== 'POST') { response.writeHead(405).end('Method not allowed'); return; }
    try {
      const candidate = JSON.parse(await readBody(request));
      const username = normalizeUsername(candidate.username);
      const account = sharedStates.__admins__.accounts.find(item => item.username === username);
      if (!account || !(await auth.verifyPassword(candidate.password, account.passwordHash))) { sendJson(response, 401, { ok: false, error: 'Usuário ou senha incorretos' }); return; }
      await setSessionCookie(response, request, 'joa_admin', { kind: 'admin', username, accountId: account.id });
      sendJson(response, 200, { ok: true, username });
    } catch { sendJson(response, 400, { ok: false, error: 'JSON inválido' }); }
    return;
  }

  if (url.pathname === '/api/auth/admin/logout') {
    if (request.method !== 'POST') { response.writeHead(405).end('Method not allowed'); return; }
    clearSessionCookie(response, request, 'joa_admin');
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/auth/admin/session') {
    const session = await getAdminSession(request);
    sendJson(response, 200, { authenticated: Boolean(session), username: session?.username || null });
    return;
  }

  if (url.pathname === '/api/auth/admin/accounts') {
    if (!(await requireAdmin(request, response))) return;
    if (request.method === 'GET') {
      sendJson(response, 200, { accounts: sharedStates.__admins__.accounts.map(item => ({ id: item.id, username: item.username })) });
      return;
    }
    if (request.method === 'DELETE') {
      const id = String(url.searchParams.get('id') || '');
      if (sharedStates.__admins__.accounts.length <= 1) { sendJson(response, 409, { ok: false, error: 'Mantenha ao menos um administrador.' }); return; }
      const remaining = sharedStates.__admins__.accounts.filter(item => item.id !== id);
      if (remaining.length === sharedStates.__admins__.accounts.length) { sendJson(response, 404, { ok: false, error: 'Administrador não encontrado.' }); return; }
      sharedStates.__admins__.accounts = remaining;
      sharedStates.__admins__.updatedAt = Date.now();
      await persist();
      sendJson(response, 200, { ok: true, accounts: sharedStates.__admins__.accounts.map(item => ({ id: item.id, username: item.username })) });
      return;
    }
    if (request.method !== 'POST') { response.writeHead(405).end('Method not allowed'); return; }
    try {
      const candidate = JSON.parse(await readBody(request));
      const username = normalizeUsername(candidate.username);
      if (username.length < 3 || !validPassword(candidate.password)) { sendJson(response, 400, { ok: false, error: 'Usuário ou senha inválidos' }); return; }
      if (sharedStates.__admins__.accounts.some(item => item.username === username)) { sendJson(response, 409, { ok: false, error: 'Usuário já existe' }); return; }
      const account = { id: crypto.randomUUID(), username, passwordHash: await auth.hashPassword(candidate.password), createdAt: Date.now() };
      sharedStates.__admins__.accounts.push(account);
      sharedStates.__admins__.updatedAt = Date.now();
      await persist();
      sendJson(response, 200, { ok: true, accounts: sharedStates.__admins__.accounts.map(item => ({ id: item.id, username: item.username })) });
    } catch { sendJson(response, 400, { ok: false, error: 'JSON inválido' }); }
    return;
  }

  if (url.pathname === '/api/auth/team/login') {
    if (request.method !== 'POST') { response.writeHead(405).end('Method not allowed'); return; }
    try {
      const candidate = JSON.parse(await readBody(request));
      const teamId = String(candidate.teamId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
      const username = normalizeUsername(candidate.username);
      const entry = sharedStates.__team_credentials__.entries.find(item => item.teamId === teamId && item.username === username);
      if (!entry || !(await auth.verifyPassword(candidate.password, entry.passwordHash))) { sendJson(response, 401, { ok: false, error: 'Usuário ou senha incorretos' }); return; }
      const team = sharedStates.__team_catalog__?.teams?.find(item => item.id === teamId);
      await setSessionCookie(response, request, 'joa_team', { kind: 'team', teamId, username, credentialVersion: entry.updatedAt });
      sendJson(response, 200, { ok: true, teamId, teamName: team?.name || '' });
    } catch { sendJson(response, 400, { ok: false, error: 'JSON inválido' }); }
    return;
  }

  if (url.pathname === '/api/auth/team/logout') {
    if (request.method !== 'POST') { response.writeHead(405).end('Method not allowed'); return; }
    clearSessionCookie(response, request, 'joa_team');
    sendJson(response, 200, { ok: true });
    return;
  }

  if (url.pathname === '/api/auth/team/session') {
    const session = await getTeamSession(request);
    const team = session ? sharedStates.__team_catalog__?.teams?.find(item => item.id === session.teamId) : null;
    sendJson(response, 200, { authenticated: Boolean(session), teamId: session?.teamId || null, teamName: team?.name || null });
    return;
  }

  if (url.pathname === '/api/auth/team/credentials') {
    const teamId = String(url.searchParams.get('teamId') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
    if (request.method === 'PUT') {
      if (!(await requireAdmin(request, response))) return;
      try {
        const candidate = JSON.parse(await readBody(request));
        const bodyTeamId = String(candidate.teamId || teamId || '').replace(/[^a-z0-9-]/gi, '').slice(0, 64);
        const username = normalizeUsername(candidate.username);
        if (!bodyTeamId || username.length < 3 || !validPassword(candidate.password)) { sendJson(response, 400, { ok: false, error: 'Dados inválidos' }); return; }
        const entries = sharedStates.__team_credentials__.entries.filter(item => item.teamId !== bodyTeamId);
        entries.push({ teamId: bodyTeamId, username, passwordHash: await auth.hashPassword(candidate.password), updatedAt: Date.now() });
        sharedStates.__team_credentials__.entries = entries;
        sharedStates.__team_credentials__.updatedAt = Date.now();
        await persist();
        sendJson(response, 200, { ok: true, teamId: bodyTeamId, username });
      } catch { sendJson(response, 400, { ok: false, error: 'JSON inválido' }); }
      return;
    }
    if (request.method === 'DELETE') {
      if (!(await requireAdmin(request, response))) return;
      const before = sharedStates.__team_credentials__.entries.length;
      sharedStates.__team_credentials__.entries = sharedStates.__team_credentials__.entries.filter(item => item.teamId !== teamId);
      if (sharedStates.__team_credentials__.entries.length === before) { sendJson(response, 404, { ok: false, error: 'Acesso não encontrado.' }); return; }
      sharedStates.__team_credentials__.updatedAt = Date.now();
      await persist();
      sendJson(response, 200, { ok: true });
      return;
    }
    if (!(await requireAdmin(request, response))) return;
    if (teamId) {
      const entry = sharedStates.__team_credentials__.entries.find(item => item.teamId === teamId);
      sendJson(response, 200, { teamId, username: entry?.username || null, hasPassword: Boolean(entry) });
      return;
    }
    sendJson(response, 200, { entries: sharedStates.__team_credentials__.entries.map(item => ({ teamId: item.teamId, username: item.username, updatedAt: item.updatedAt })) });
    return;
  }

  if (url.pathname === '/api/teams') {
    if (request.method === 'PUT') {
      if (!(await requireAdmin(request, response))) return;
      let body = '';
      for await (const chunk of request) body += chunk;
      try {
        const candidate = JSON.parse(body);
        if (!Array.isArray(candidate.teams)) throw new Error('Invalid team catalog');
        const current = sharedStates.__team_catalog__;
        if (!current || Number(candidate.updatedAt || 0) >= Number(current.updatedAt || 0)) {
          sharedStates.__team_catalog__ = candidate;
          await persist();
        }
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify(sharedStates.__team_catalog__));
      } catch { response.writeHead(400).end('Invalid JSON'); }
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(sharedStates.__team_catalog__ || {}));
    return;
  }

  if (url.pathname === '/api/team-portal') {
    const team = findTeamByRequest(url);
    if (!team) { response.writeHead(404).end('Team not found'); return; }
    if (request.method === 'PUT') {
      if (!(await requireTeamAccess(request, response, team.id))) return;
      let body = '';
      for await (const chunk of request) body += chunk;
      try {
        const candidate = JSON.parse(body);
        team.name = String(candidate.name || team.name || '').slice(0, 80);
        team.short = String(candidate.short || team.short || 'TIM').toUpperCase().slice(0, 3);
        team.color = /^#[0-9a-f]{6}$/i.test(String(candidate.color || '')) ? candidate.color : team.color;
        team.logo = String(candidate.logo || team.logo || '').slice(0, 500);
        team.athletes = Array.isArray(candidate.athletes) ? candidate.athletes.slice(0, 100).map((athlete, index) => ({
          id: String(athlete?.id || `atleta-${index + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 56),
          name: String(athlete?.name || '').slice(0, 100), number: String(athlete?.number || '').slice(0, 6),
          height: String(athlete?.height || '').slice(0, 5), photo: String(athlete?.photo || '').slice(0, 500),
          squadRole: athlete?.squadRole === 'reserve' ? 'reserve' : athlete?.squadRole === 'starter' ? 'starter' : index < 11 ? 'starter' : 'reserve',
          position: String(athlete?.position || '').toUpperCase().replace(/[^A-ZÀ-Ü0-9-]/g, '').slice(0, 6),
        })) : team.athletes || [];
        team.staff = Array.isArray(candidate.staff) && candidate.staff.length ? candidate.staff.slice(0, 30).map((member, index) => ({
          id: String(member?.id || `staff-${index + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 56),
          name: String(member?.name || '').slice(0, 100),
          role: String(member?.role || (index === 0 ? 'Treinador' : 'Auxiliar técnico')).slice(0, 60),
          photo: String(member?.photo || '').slice(0, 500),
        })) : team.staff || [{ id: 'coach', name: candidate?.coach?.name || team?.coach?.name || 'Treinador', role: 'Treinador', photo: candidate?.coach?.photo || team?.coach?.photo || '' }];
        const headCoach = team.staff.find(member => member.role === 'Treinador') || team.staff[0];
        team.coach = { name: String(headCoach?.name || candidate?.coach?.name || 'Treinador').slice(0, 100), photo: String(headCoach?.photo || candidate?.coach?.photo || '').slice(0, 500) };
        team.formation = ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'].includes(candidate?.formation) ? candidate.formation : team.formation || '4-3-3';
        team.roster = team.athletes.map(athlete => `${athlete.number || ''} ${athlete.name || ''}`.trim()).filter(Boolean).join('\n');
        sharedStates.__team_catalog__.updatedAt = Date.now();
        await persist();
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ team }));
      } catch { response.writeHead(400).end('Invalid JSON'); }
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ team }));
    return;
  }

  if (url.pathname === '/api/team-athlete-photo') {
    const team = findTeamByRequest(url);
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
    if (!team || !subject) { response.writeHead(404).end('Presentation subject not found'); return; }
    const assetPath = path.join(path.dirname(storagePath), 'assets', 'team-portals', team.id, athleteId);
    if (request.method === 'PUT') {
      if (!(await requireTeamAccess(request, response, team.id))) return;
      const chunks = [];
      let size = 0;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > 5_000_000) { response.writeHead(413).end('Asset too large'); return; }
        chunks.push(chunk);
      }
      await fs.mkdir(path.dirname(assetPath), { recursive: true });
      await fs.writeFile(assetPath, Buffer.concat(chunks));
      await fs.writeFile(`${assetPath}.type`, request.headers['content-type'] || 'image/png');
      const photoUrl = `/api/team-athlete-photo?team=${encodeURIComponent(team.id)}&athlete=${encodeURIComponent(athleteId)}&v=${Date.now()}`;
      subject.photo = photoUrl;
      if (athleteId === 'coach') {
        const headCoach = team.staff?.find(member => member.role === 'Treinador') || team.staff?.[0];
        if (headCoach) headCoach.photo = photoUrl;
      }
      sharedStates.__team_catalog__.updatedAt = Date.now();
      await persist();
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: true, url: photoUrl }));
      return;
    }
    try {
      const [data, type] = await Promise.all([fs.readFile(assetPath), fs.readFile(`${assetPath}.type`, 'utf8')]);
      response.writeHead(200, { 'content-type': type, 'cache-control': 'private, max-age=3600' });
      response.end(data);
    } catch { response.writeHead(404).end('Not found'); }
    return;
  }

  if (url.pathname.startsWith('/api/assets/')) {
    const [, , , assetRoom = room, assetName = 'logo'] = url.pathname.split('/');
    const safeRoom = assetRoom.toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'principal';
    const safeName = assetName.toLowerCase().replace(/[^a-z0-9.-]/g, '').slice(0, 64) || 'logo';
    const assetPath = path.join(path.dirname(storagePath), 'assets', safeRoom, safeName);
    if (request.method === 'PUT') {
      if (safeRoom === 'team-portals') {
        if (!(await requireTeamAccess(request, response, safeName.replace(/-logo$/, '')))) return;
      } else if (!(await requireAdmin(request, response))) return;
      const chunks = [];
      let size = 0;
      const maxSize = safeName === 'sponsors-wide-video' ? 50_000_000 : safeName.endsWith('-lineup-media') ? 25_000_000 : safeName.endsWith('-wide') ? 8_000_000 : 5_000_000;
      for await (const chunk of request) {
        size += chunk.length;
        if (size > maxSize) { response.writeHead(413).end('Asset too large'); return; }
        chunks.push(chunk);
      }
      await fs.mkdir(path.dirname(assetPath), { recursive: true });
      await fs.writeFile(assetPath, Buffer.concat(chunks));
      await fs.writeFile(`${assetPath}.type`, request.headers['content-type'] || 'image/png');
      response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
      response.end(JSON.stringify({ ok: true, url: `/api/assets/${safeRoom}/${safeName}` }));
      return;
    }
    try {
      const [data, type] = await Promise.all([fs.readFile(assetPath), fs.readFile(`${assetPath}.type`, 'utf8')]);
      response.writeHead(200, { 'content-type': type, 'cache-control': 'public, max-age=31536000, immutable' });
      response.end(data);
    } catch { response.writeHead(404).end('Not found'); }
    return;
  }

  if (url.pathname === '/api/state') {
    if (auth.isReservedRoom(room)) { sendJson(response, 403, { ok: false, error: 'Sala reservada' }); return; }
    if (request.method === 'PUT') {
      if (!(await requireAdmin(request, response))) return;
      let body = '';
      for await (const chunk of request) body += chunk;
      try {
        const candidate = JSON.parse(body);
        const current = sharedStates[room];
        if (!current || Number(candidate.updatedAt || 0) >= Number(current.updatedAt || 0)) {
          sharedStates[room] = candidate;
          await persist();
        }
        response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
        response.end(JSON.stringify({ ok: true, updatedAt: sharedStates[room].updatedAt, serverTime: Date.now() }));
      } catch {
        response.writeHead(400).end('Invalid JSON');
      }
      return;
    }
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify(sharedStates[room] || {}));
    return;
  }

  const relative = ['/', '/overlay', '/preview', '/team'].includes(url.pathname) || url.pathname === '/manage' || url.pathname.startsWith('/manage/') ? 'index.html' : url.pathname.slice(1);
  const filename = path.resolve(root, relative);
  if (!filename.startsWith(root + path.sep)) {
    response.writeHead(403).end('Forbidden');
    return;
  }
  try {
    const data = await fs.readFile(filename);
    const extension = path.extname(filename);
    const contentType = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.json': 'application/json; charset=utf-8',
    }[extension] || 'application/octet-stream';
    response.writeHead(200, { 'content-type': contentType, 'cache-control': 'no-store' });
    response.end(data);
  } catch {
    response.writeHead(404).end('Not found');
  }
});

server.listen(port, host, () => {
  process.stdout.write(`Juventude Esporte Clube ready at http://127.0.0.1:${port}\n`);
});

export { server };
