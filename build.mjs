import fs from 'node:fs/promises';
import path from 'node:path';

const root = import.meta.dirname;
const output = path.join(root, 'dist');
const serverOutput = path.join(output, 'server');
const assets = path.join(output, 'client');
await fs.rm(output, { recursive: true, force: true });
await fs.mkdir(assets, { recursive: true });
await fs.mkdir(serverOutput, { recursive: true });

const assetMap = {};
for (const filename of ['index.html', 'styles.css', 'app.js']) {
  const source = await fs.readFile(path.join(root, 'public', filename), 'utf8');
  await fs.writeFile(path.join(assets, filename), source);
  assetMap[`/${filename}`] = source;
}

const worker = `const assets = ${JSON.stringify(assetMap)};
const fallbackStates = new Map();
let databaseReady;
let legacyPhotosHydrated = false;
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
        subject.photo = '/api/team-athlete-photo?token=' + encodeURIComponent(team.accessToken) + '&athlete=' + encodeURIComponent(subject.id) + '&v=restored';
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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const room = safeRoom(url.searchParams.get('room'));
    if (url.pathname === '/health') return Response.json({ ok: true, service: 'juventude-overlay-studio' }, { headers: { 'cache-control': 'no-store' } });
    if (url.pathname === '/api/teams') {
      if (request.method === 'PUT') {
        try {
          const candidate = await request.json();
          if (!Array.isArray(candidate.teams)) return new Response('Invalid team catalog', { status: 400 });
          return Response.json(await persistState(env, 'team-catalog', candidate), { headers: { 'cache-control': 'no-store' } });
        } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
      }
      return Response.json(await hydrateLegacyTeamPhotos(env, await readState(env, 'team-catalog')), { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/team-portal') {
      const token = String(url.searchParams.get('token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
      const catalog = await hydrateLegacyTeamPhotos(env, await readState(env, 'team-catalog'));
      const team = catalog?.teams?.find(item => item.accessToken === token);
      if (!team) return new Response('Team not found', { status: 404 });
      if (request.method === 'PUT') {
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
          catalog.updatedAt = Date.now();
          await persistState(env, 'team-catalog', catalog);
          return Response.json({ team }, { headers: { 'cache-control': 'no-store' } });
        } catch (error) { return Response.json({ ok: false, error: error.message }, { status: 400 }); }
      }
      return Response.json({ team }, { headers: { 'cache-control': 'no-store' } });
    }
    if (url.pathname === '/api/team-athlete-photo') {
      const token = String(url.searchParams.get('token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
      const athleteId = String(url.searchParams.get('athlete') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 56);
      const catalog = await readState(env, 'team-catalog');
      const team = catalog?.teams?.find(item => item.accessToken === token);
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
        const length = Number(request.headers.get('content-length') || 0);
        if (length > 5000000) return new Response('Asset too large', { status: 413 });
        await env.BUCKET.put(key, request.body, { httpMetadata: { contentType: request.headers.get('content-type') || 'image/png' } });
        const photoUrl = '/api/team-athlete-photo?token=' + encodeURIComponent(token) + '&athlete=' + encodeURIComponent(athleteId) + '&v=' + Date.now();
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
      if (request.method === 'PUT') {
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
