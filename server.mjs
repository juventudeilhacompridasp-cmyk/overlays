import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';

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

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const room = String(url.searchParams.get('room') || 'principal').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'principal';
  if (url.pathname === '/health') {
    response.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    response.end(JSON.stringify({ ok: true, service: 'juventude-overlay-studio' }));
    return;
  }
  if (url.pathname === '/api/teams') {
    if (request.method === 'PUT') {
      let body = '';
      for await (const chunk of request) body += chunk;
      try {
        const candidate = JSON.parse(body);
        if (!Array.isArray(candidate.teams)) throw new Error('Invalid team catalog');
        const current = sharedStates.__team_catalog__;
        if (!current || Number(candidate.updatedAt || 0) >= Number(current.updatedAt || 0)) {
          sharedStates.__team_catalog__ = candidate;
          await fs.mkdir(path.dirname(storagePath), { recursive: true });
          await fs.writeFile(storagePath, JSON.stringify({ __rooms: sharedStates }), 'utf8');
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
    const token = String(url.searchParams.get('token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    const catalog = sharedStates.__team_catalog__;
    const team = catalog?.teams?.find(item => item.accessToken === token);
    if (!team) { response.writeHead(404).end('Team not found'); return; }
    if (request.method === 'PUT') {
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
        catalog.updatedAt = Date.now();
        await fs.mkdir(path.dirname(storagePath), { recursive: true });
        await fs.writeFile(storagePath, JSON.stringify({ __rooms: sharedStates }), 'utf8');
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
    const token = String(url.searchParams.get('token') || '').replace(/[^a-z0-9]/gi, '').slice(0, 40);
    const athleteId = String(url.searchParams.get('athlete') || '').replace(/[^a-z0-9-]/gi, '').slice(0, 56);
    const team = sharedStates.__team_catalog__?.teams?.find(item => item.accessToken === token);
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
      const photoUrl = `/api/team-athlete-photo?token=${encodeURIComponent(token)}&athlete=${encodeURIComponent(athleteId)}&v=${Date.now()}`;
      subject.photo = photoUrl;
      if (athleteId === 'coach') {
        const headCoach = team.staff?.find(member => member.role === 'Treinador') || team.staff?.[0];
        if (headCoach) headCoach.photo = photoUrl;
      }
      sharedStates.__team_catalog__.updatedAt = Date.now();
      await fs.writeFile(storagePath, JSON.stringify({ __rooms: sharedStates }), 'utf8');
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
    if (request.method === 'PUT') {
      let body = '';
      for await (const chunk of request) body += chunk;
      try {
        const candidate = JSON.parse(body);
        const current = sharedStates[room];
        if (!current || Number(candidate.updatedAt || 0) >= Number(current.updatedAt || 0)) {
          sharedStates[room] = candidate;
          await fs.mkdir(path.dirname(storagePath), { recursive: true });
          await fs.writeFile(storagePath, JSON.stringify({ __rooms: sharedStates }), 'utf8');
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
  process.stdout.write(`Juventude Overlay Studio ready at http://127.0.0.1:${port}\n`);
});

export { server };
