const initialParams = new URLSearchParams(location.search);
let requestedRoom = initialParams.get('room');
const isAdminRoute = !['/overlay', '/preview', '/team'].includes(location.pathname);
if (!requestedRoom && !isAdminRoute) {
  try { requestedRoom = localStorage.getItem('juventude.overlay.lastRoom'); } catch {}
}
// Biblioteca de patrocínios: uma sala especial, sem partida, editada pelos módulos de patrocínio na plataforma.
const LIBRARY_ROOM = 'biblioteca-patrocinios';
const BUILDER_LIBRARY_ROOM = 'biblioteca-overlays';
const LIBRARY_MODULES = ['sponsors', 'sponsor-bar', 'builder'];
const libraryMode = !requestedRoom && (location.pathname === '/manage' || location.pathname.startsWith('/manage/')) && LIBRARY_MODULES.includes(location.pathname.split('/').filter(Boolean)[1]);
const ROOM_ID = libraryMode ? (location.pathname.split('/').filter(Boolean)[1] === 'builder' ? BUILDER_LIBRARY_ROOM : LIBRARY_ROOM) : (requestedRoom || 'principal').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'principal';
if (requestedRoom) { try { localStorage.setItem('juventude.overlay.lastRoom', ROOM_ID); } catch {} }
const STORAGE_KEY = `juventude.overlay-studio.v2.${ROOM_ID}`;
const TEAM_CATALOG_KEY = 'juventude.overlay-team-catalog.v1';
const CHANNEL_NAME = `juventude-overlay-live.${ROOM_ID}`;
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
const isOutput = location.pathname === '/overlay';
const isPreview = location.pathname === '/preview';
const isTeamPortal = location.pathname === '/team';
const isManagement = location.pathname === '/manage' || location.pathname.startsWith('/manage/');
const isPublicPage = location.pathname === '/campeonatos' || /^\/(c|o|embed)\//.test(location.pathname);
const isAdminPanel = !isOutput && !isPreview && !isTeamPortal && !isPublicPage;
const platformMode = isAdminPanel && !requestedRoom;
const PLATFORM_MODULE_KEYS = ['dashboard', 'championships', 'matches', 'teams', 'delegations', 'audit', 'access', 'sponsors', 'sponsor-bar', 'announcements', 'live', 'backup', 'standings', 'builder', 'feed', 'arts'];
const requestedModule = isManagement ? (location.pathname.split('/').filter(Boolean)[1] || 'hub') : '';
const managementModule = platformMode ? (PLATFORM_MODULE_KEYS.includes(requestedModule) ? requestedModule : 'dashboard') : requestedModule;
let appVersion = '';
const outputLayer = new URLSearchParams(location.search).get('layer') || 'all';
const outputCustomId = new URLSearchParams(location.search).get('id') || '';
const app = document.getElementById('app');
const apiUrl = path => `${path}${path.includes('?') ? '&' : '?'}room=${encodeURIComponent(ROOM_ID)}`;

const icons = {
  monitor: '<svg viewBox="0 0 18 18" fill="none"><rect x="2" y="3" width="14" height="10" rx="1.5" stroke="currentColor" stroke-width="1.5"/><path d="M6 16h6M9 13v3" stroke="currentColor" stroke-width="1.5"/></svg>',
  users: '<svg viewBox="0 0 18 18" fill="none"><circle cx="7" cy="6" r="2.3" stroke="currentColor" stroke-width="1.4"/><path d="M2.8 14c.3-2.2 1.8-3.5 4.2-3.5s3.9 1.3 4.2 3.5M12.3 4.1a2 2 0 010 3.7M12.5 10.6c1.7.2 2.6 1.3 2.8 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>',
  list: '<svg viewBox="0 0 18 18" fill="none"><path d="M6.2 5h9M6.2 9h9M6.2 13h9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><circle cx="3.2" cy="5" r="1" fill="currentColor"/><circle cx="3.2" cy="9" r="1" fill="currentColor"/><circle cx="3.2" cy="13" r="1" fill="currentColor"/></svg>',
  play: '<svg viewBox="0 0 18 18" fill="currentColor"><path d="M6 4.2v9.6L14 9 6 4.2z"/></svg>',
  pause: '<svg viewBox="0 0 18 18" fill="currentColor"><rect x="5" y="4" width="3" height="10" rx=".7"/><rect x="10" y="4" width="3" height="10" rx=".7"/></svg>',
  refresh: '<svg viewBox="0 0 18 18" fill="none"><path d="M14.1 7A5.2 5.2 0 104 12.5M14.2 3.5V7H10.7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  soccer: '<svg viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="6.5" stroke="currentColor" stroke-width="1.4"/><path d="M9 5.7l-2.2 1.6.8 2.6h2.8l.8-2.6L9 5.7zM9 2.5v3.2M2.9 7l3.9.4M4.8 14l2.8-4.1M13.2 14l-2.8-4.1M15.1 7l-3.9.4" stroke="currentColor" stroke-width="1.1"/></svg>',
  card: '<svg viewBox="0 0 18 18" fill="currentColor"><rect x="5" y="2.5" width="8" height="13" rx="1.3"/></svg>',
  swap: '<svg viewBox="0 0 18 18" fill="none"><path d="M3 6h11m0 0l-3-3m3 3l-3 3M15 12H4m0 0l3-3m-3 3l3 3" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  text: '<svg viewBox="0 0 18 18" fill="none"><path d="M3 4h12M9 4v11M6.5 15h5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  layers: '<svg viewBox="0 0 18 18" fill="none"><path d="M9 2.5L2.5 6 9 9.5 15.5 6 9 2.5zM2.5 9.3L9 12.8l6.5-3.5M2.5 12.2L9 15.7l6.5-3.5" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  eye: '<svg viewBox="0 0 18 18" fill="none"><path d="M1.8 9s2.6-4.4 7.2-4.4S16.2 9 16.2 9s-2.6 4.4-7.2 4.4S1.8 9 1.8 9z" stroke="currentColor" stroke-width="1.4"/><circle cx="9" cy="9" r="2" stroke="currentColor" stroke-width="1.4"/></svg>',
  copy: '<svg viewBox="0 0 18 18" fill="none"><rect x="6" y="6" width="9" height="9" rx="1.3" stroke="currentColor" stroke-width="1.4"/><path d="M12 6V4.3C12 3.6 11.4 3 10.7 3H4.3C3.6 3 3 3.6 3 4.3v6.4c0 .7.6 1.3 1.3 1.3H6" stroke="currentColor" stroke-width="1.4"/></svg>',
  external: '<svg viewBox="0 0 18 18" fill="none"><path d="M10 3h5v5M15 3L8 10M14 10v4.2c0 .5-.4.8-.8.8H3.8a.8.8 0 01-.8-.8V4.8c0-.5.4-.8.8-.8H8" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 18 18" fill="none"><path d="M4 4l10 10M14 4L4 14" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  lock: '<svg viewBox="0 0 18 18" fill="none"><rect x="4" y="8" width="10" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/><path d="M6 8V5.5a3 3 0 016 0V8" stroke="currentColor" stroke-width="1.4"/></svg>',
};

const BRAND_NAME = 'Juventude Esporte Clube';
function brandMark() {
  return `<img class="brand-mark" src="/brand-logo.png" alt="Brasão da ${BRAND_NAME}">`;
}

const MANAGEMENT_MODULES = [
  { key: 'dashboard', label: 'Dashboard', caption: 'Visão geral de agenda, avisos, acessos e estatísticas da plataforma', layer: 'all', icon: icons.monitor },
  { key: 'live', label: 'Ao vivo agora', caption: 'Partidas em andamento, placar, o que está no ar e atalhos de emergência', layer: 'all', icon: icons.monitor },
  { key: 'standings', label: 'Classificação e súmulas', caption: 'Tabela do campeonato, artilharia, cartões e súmula de cada partida', layer: 'all', icon: icons.list },
  { key: 'arts', label: 'Estúdio de artes', caption: 'Artes prontas para redes sociais: resultados, jogos, tabelas, artilharia, escalações e avisos', layer: 'all', icon: icons.layers },
  { key: 'feed', label: 'Notícias e mídia', caption: 'Notícias, fotos e vídeos por campeonato e rodada, exibidos na página pública', layer: 'all', icon: icons.text },
  { key: 'championships', label: 'Campeonatos', caption: 'Temporadas e organização das competições', layer: 'all', icon: icons.layers },
  { key: 'matches', label: 'Partidas', caption: 'Agenda e salas específicas de transmissão', layer: 'all', icon: icons.monitor },
  { key: 'scoreboard', label: 'Placar', caption: 'Resultado, tempo e formato', layer: 'scoreboard', icon: icons.monitor },
  { key: 'events', label: 'Eventos', caption: 'Gols, cartões, substituições e GC', layer: 'event', icon: icons.card },
  { key: 'lineup', label: 'Escalações', caption: 'Titulares, reservas, treinador e tática', layer: 'photo-lineup', icon: icons.users },
  { key: 'sponsors', label: 'Patrocinadores', caption: 'Marcas, formatos e looping', layer: 'sponsor', icon: icons.layers },
  { key: 'sponsor-bar', label: 'Barra de Patrocinadores', caption: 'Saída independente 1500 × 200', layer: 'sponsor-bar', icon: icons.layers },
  { key: 'stats', label: 'Estatísticas', caption: 'Comparativo, gols e cartões, destaque do atleta', layer: 'stats', icon: icons.list },
  { key: 'builder', label: 'Builder de Overlays', caption: 'Crie saídas independentes sem desenvolvimento', layer: 'custom', icon: icons.layers },
  { key: 'pregame', label: 'Resumo pré-jogo', caption: 'Consulta rápida para narração', layer: 'all', icon: icons.list },
  { key: 'report', label: 'Relatório', caption: 'Histórico completo da partida', layer: 'all', icon: icons.text },
  { key: 'teams', label: 'Times', caption: 'Elencos e escudos', layer: 'all', icon: icons.list },
  { key: 'delegations', label: 'Delegações', caption: 'Pendências, revisão, prazos e histórico das equipes', layer: 'all', icon: icons.users },
  { key: 'appearance', label: 'Aparência', caption: 'Estilos, posições e animações', layer: 'all', icon: icons.eye },
  { key: 'announcements', label: 'Comunicados', caption: 'Recados da organização para todas as equipes ou para equipes específicas', layer: 'all', icon: icons.text },
  { key: 'audit', label: 'Avisos e logs', caption: 'Delegações concluídas e histórico de ações', layer: 'all', icon: icons.list },
  { key: 'backup', label: 'Backup e exportação', caption: 'Cópia dos dados da plataforma e planilhas CSV', layer: 'all', icon: icons.list },
  { key: 'access', label: 'Usuários/Acessos', caption: 'Administradores do painel e usuários dos times', layer: 'all', icon: icons.lock },
];

const defaultRoster = [
  '1 Gabriel Martins', '2 Rafael Santos', '3 Lucas Oliveira', '4 Matheus Costa',
  '5 Thiago Ribeiro', '6 Bruno Almeida', '7 Pedro Henrique', '8 Felipe Souza',
  '9 João Victor', '10 Leonardo Lima', '11 Diego Ferreira',
];

const STAFF_ROLES = ['Treinador', 'Auxiliar técnico', 'Preparador físico', 'Preparador de goleiros', 'Fisioterapeuta', 'Médico', 'Massagista', 'Analista', 'Coordenador', 'Diretor'];

function normalizedPhotoUrl(value) {
  return String(value || '').slice(0, 500).replace(/([?&]athlete=[^?&]+)\?v=/, '$1&v=');
}

function teamId(value, fallback = 'time') {
  return String(value || fallback).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || fallback;
}

function accessToken(value) {
  const normalized = String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 40);
  return normalized || `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

function athleteId(value, index = 0) {
  const normalized = teamId(value, `atleta-${index + 1}`);
  return `${normalized}-${index + 1}`.slice(0, 56);
}

function normalizedStaff(team) {
  const legacyCoach = team?.coach || { name: 'Treinador', photo: '' };
  const source = Array.isArray(team?.staff) && team.staff.length
    ? team.staff
    : [{ id: 'coach', name: legacyCoach.name || 'Treinador', role: 'Treinador', photo: legacyCoach.photo || '' }];
  return source.slice(0, 30).map((member, index) => ({
    id: String(member?.id || `staff-${index + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 56) || `staff-${index + 1}`,
    name: String(member?.name || '').slice(0, 100),
    role: STAFF_ROLES.includes(member?.role) ? member.role : index === 0 ? 'Treinador' : 'Auxiliar técnico',
    photo: normalizedPhotoUrl(member?.photo),
  }));
}

function syncLegacyCoach(team) {
  if (!team) return;
  team.staff = normalizedStaff(team);
  const headCoach = team.staff.find(member => member.role === 'Treinador') || team.staff[0];
  team.coach = { name: headCoach?.name || 'Treinador', photo: headCoach?.photo || '' };
}

function athletesFromRoster(roster) {
  return rosterPlayers(roster).map((player, index) => ({
    id: athleteId(player.name, index), name: player.name, number: player.number, height: '', photo: '',
    squadRole: index < 11 ? 'starter' : 'reserve', position: '',
  }));
}

function teamRosterText(team) {
  const athletes = Array.isArray(team?.athletes) ? team.athletes : [];
  if (athletes.length) return athletes.map(athlete => `${athlete.number || ''} ${athlete.name || ''}`.trim()).filter(Boolean).join('\n');
  return String(team?.roster || '');
}

function defaultTeamCatalog() {
  const entries = [
    { id: 'team-juventude', name: 'Juventude E.C.', short: 'JUV', color: '#8253cd', logo: '', roster: defaultRoster.join('\n'), formation: '4-3-3', coach: { name: 'Treinador', photo: '' }, staff: [{ id: 'coach', name: 'Treinador', role: 'Treinador', photo: '' }], accessToken: accessToken() },
    { id: 'team-atletico-ilha', name: 'Atlético Ilha', short: 'ATL', color: '#4588b5', logo: '', roster: defaultRoster.map((name, index) => name.replace(/^[0-9]+/, String(index + 12))).join('\n'), formation: '4-4-2', coach: { name: 'Treinador', photo: '' }, staff: [{ id: 'coach', name: 'Treinador', role: 'Treinador', photo: '' }], accessToken: accessToken() },
  ];
  return entries.map(team => ({ ...team, athletes: athletesFromRoster(team.roster) }));
}

function normalizeTeamRegistrations(value) {
  const result = {};
  if (!value || typeof value !== 'object') return result;
  for (const [key, entry] of Object.entries(value).slice(0, 20)) {
    const numbers = {};
    for (const [athleteKey, number] of Object.entries(entry?.numbers || {}).slice(0, 100)) numbers[String(athleteKey).slice(0, 56)] = String(number).replace(/\D/g, '').slice(0, 3);
    result[String(key).replace(/[^a-z0-9-]/gi, '').slice(0, 64)] = { athleteIds: (Array.isArray(entry?.athleteIds) ? entry.athleteIds : []).map(String).slice(0, 100), numbers, formation: FORMATIONS[entry?.formation] ? entry.formation : '' };
  }
  return result;
}

function normalizeTeamMatchSquads(value) {
  const result = {};
  if (!value || typeof value !== 'object') return result;
  for (const [key, entry] of Object.entries(value).slice(0, 80)) {
    result[String(key).replace(/[^a-z0-9-]/gi, '').slice(0, 64)] = { starters: (Array.isArray(entry?.starters) ? entry.starters : []).map(String).slice(0, 11), reserves: (Array.isArray(entry?.reserves) ? entry.reserves : []).map(String).slice(0, 60), formation: FORMATIONS[entry?.formation] ? entry.formation : '', updatedAt: Number(entry?.updatedAt || 0) };
  }
  return result;
}

function normalizeTeamCatalog(value) {
  const source = Array.isArray(value) ? value : [];
  const seen = new Set();
  const teams = source.slice(0, 100).map((team, index) => {
    let id = teamId(team?.id || team?.name, `team-${index + 1}`);
    while (seen.has(id)) id = `${id}-${index + 1}`;
    seen.add(id);
    const roster = String(team?.roster || '').slice(0, 12000);
    const rawAthletes = Array.isArray(team?.athletes) && team.athletes.length ? team.athletes : athletesFromRoster(roster);
    const athletes = rawAthletes.slice(0, 100).map((athlete, athleteIndex) => ({
      id: String(athlete?.id || athleteId(athlete?.name, athleteIndex)).replace(/[^a-z0-9-]/gi, '').slice(0, 56) || `atleta-${athleteIndex + 1}`,
      name: String(athlete?.name || '').slice(0, 100),
      number: String(athlete?.number || '').replace(/[^0-9a-z-]/gi, '').slice(0, 6),
      height: String(athlete?.height || '').replace(',', '.').replace(/[^0-9.]/g, '').slice(0, 5),
      photo: normalizedPhotoUrl(athlete?.photo),
      squadRole: athlete?.squadRole === 'reserve' ? 'reserve' : athlete?.squadRole === 'starter' ? 'starter' : athleteIndex < 11 ? 'starter' : 'reserve',
      position: String(athlete?.position || '').toUpperCase().replace(/[^A-ZÀ-Ü0-9-]/g, '').slice(0, 6),
    }));
    const staff = normalizedStaff(team);
    const headCoach = staff.find(member => member.role === 'Treinador') || staff[0] || { name: 'Treinador', photo: '' };
    const normalizedTeam = {
      id,
      name: String(team?.name || `Novo time ${index + 1}`).slice(0, 80),
      short: String(team?.short || 'TIM').toUpperCase().slice(0, 3),
      color: safeColor(team?.color, '#8253cd'),
      logo: String(team?.logo || '').slice(0, 500),
      color2: /^#[0-9a-f]{6}$/i.test(String(team?.color2 || '')) ? team.color2 : '',
      sponsors: (Array.isArray(team?.sponsors) ? team.sponsors : []).slice(0, 6).map((sponsor, sponsorIndex) => ({ id: String(sponsor?.id || `patrocinio-${sponsorIndex + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 40), name: String(sponsor?.name || '').slice(0, 60), logo: String(sponsor?.logo || '').slice(0, 500) })),
      roster,
      athletes,
      registrations: normalizeTeamRegistrations(team?.registrations),
      matchSquads: normalizeTeamMatchSquads(team?.matchSquads),
      formation: ['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'].includes(team?.formation) ? team.formation : '4-3-3',
      staff,
      coach: { name: headCoach.name || 'Treinador', photo: normalizedPhotoUrl(headCoach.photo) },
      accessToken: accessToken(team?.accessToken),
    };
    normalizedTeam.roster = teamRosterText(normalizedTeam);
    return normalizedTeam;
  });
  return teams.length ? teams : defaultTeamCatalog();
}

function loadTeamCatalog() {
  try {
    const saved = JSON.parse(localStorage.getItem(TEAM_CATALOG_KEY));
    return { updatedAt: Number(saved?.updatedAt || 0), teams: normalizeTeamCatalog(saved?.teams || saved), championshipThemes: saved?.championshipThemes && typeof saved.championshipThemes === 'object' ? saved.championshipThemes : {}, globalAppearance: saved?.globalAppearance && typeof saved.globalAppearance === 'object' ? saved.globalAppearance : null };
  } catch {
    return { updatedAt: 0, teams: defaultTeamCatalog(), championshipThemes: {}, globalAppearance: null };
  }
}

function rosterPlayers(roster) {
  return String(roster || '').split('\n').map(line => line.trim()).filter(Boolean).slice(0, 100).map((line, index) => {
    const match = line.match(/^(\d+)\s+(.+)$/);
    return match ? { number: match[1], name: match[2].trim() } : { number: String(index + 1), name: line };
  });
}

function mergeAthletesFromRoster(team, roster) {
  const existing = Array.isArray(team?.athletes) ? team.athletes : [];
  const byName = new Map(existing.map(athlete => [String(athlete.name || '').trim().toLocaleLowerCase('pt-BR'), athlete]));
  return rosterPlayers(roster).map((player, index) => {
    const previous = byName.get(player.name.toLocaleLowerCase('pt-BR'));
    return previous ? { ...previous, number: player.number, name: player.name } : { id: athleteId(player.name, index), name: player.name, number: player.number, height: '', photo: '', squadRole: index < 11 ? 'starter' : 'reserve', position: '' };
  });
}

const SPORTS = {
  football: {
    label: 'Futebol', short: 'CAMPO', icon: '⚽', scoring: 'Gols', teamSize: 11,
    periods: [['1T', '1º T'], ['INT', 'INTER'], ['2T', '2º T'], ['PRO', 'PROR'], ['PEN', 'PÊN']],
    duration: 0, court: 'football',
  },
  futsal: {
    label: 'Futsal', short: 'QUADRA', icon: '◉', scoring: 'Gols', teamSize: 5,
    periods: [['1T', '1º T'], ['INT', 'INTER'], ['2T', '2º T'], ['PRO', 'PROR'], ['PEN', 'PÊN']],
    duration: 20 * 60, court: 'futsal',
  },
  volleyball: {
    label: 'Vôlei', short: 'SETS', icon: '◉', scoring: 'Pontos', teamSize: 6,
    periods: [['S1', '1º SET'], ['S2', '2º SET'], ['S3', '3º SET'], ['S4', '4º SET'], ['S5', 'TIE']],
    duration: 0, court: 'volleyball',
  },
  basketball: {
    label: 'Basquete', short: 'QUARTOS', icon: '◉', scoring: 'Pontos', teamSize: 5,
    periods: [['Q1', '1º Q'], ['Q2', '2º Q'], ['Q3', '3º Q'], ['Q4', '4º Q'], ['PRO', 'PROR']],
    duration: 10 * 60, court: 'basketball',
  },
};

// Posições [x, y] em % do meio campo exibido: x = profundidade (goleiro à esquerda, ataque à direita), y = largura.
const FORMATIONS = {
  '4-3-3': [[8,50],[27,14],[27,38],[27,62],[27,86],[52,25],[52,50],[52,75],[78,18],[80,50],[78,82]],
  '4-4-2': [[8,50],[27,14],[27,38],[27,62],[27,86],[52,14],[52,38],[52,62],[52,86],[78,35],[78,65]],
  '4-2-3-1': [[8,50],[27,14],[27,38],[27,62],[27,86],[44,36],[44,64],[62,18],[62,50],[62,82],[82,50]],
  '3-5-2': [[8,50],[27,25],[27,50],[27,75],[50,8],[46,50],[54,30],[54,70],[50,92],[80,35],[80,65]],
};

const STATS_METRICS = [
  { key: 'possession', label: 'Posse de bola', suffix: '%', manual: true },
  { key: 'shots', label: 'Finalizações', manual: true },
  { key: 'shotsOnTarget', label: 'Chutes no gol', manual: true },
  { key: 'corners', label: 'Escanteios', manual: true },
  { key: 'fouls', label: 'Faltas', manual: true },
  { key: 'offsides', label: 'Impedimentos', manual: true },
  { key: 'saves', label: 'Defesas', manual: true },
  { key: 'goals', label: 'Gols', derived: true },
  { key: 'yellow', label: 'Cartões amarelos', derived: true },
  { key: 'red', label: 'Cartões vermelhos', derived: true },
  { key: 'subs', label: 'Substituições', derived: true },
];

const TYPEFACES = {
  rajdhani: { label: 'Condensada', stack: "'Arial Narrow', 'Roboto Condensed', sans-serif" },
  oswald: { label: 'Impacto', stack: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" },
  montserrat: { label: 'Moderna', stack: "Arial, 'Segoe UI', sans-serif" },
  orbitron: { label: 'Técnica', stack: "'Lucida Console', Monaco, monospace" },
  // Fontes hospedadas em /fonts (ver @font-face no início de styles.css).
  roboto: { label: 'Roboto', stack: "'Roboto', 'Segoe UI', Arial, sans-serif" },
  barlow: { label: 'Barlow Condensed', stack: "'Barlow Condensed', 'Arial Narrow', sans-serif" },
  oswaldweb: { label: 'Oswald', stack: "'Oswald', Impact, 'Arial Narrow Bold', sans-serif" },
  montserratweb: { label: 'Montserrat', stack: "'Montserrat', 'Segoe UI', Arial, sans-serif" },
  bebas: { label: 'Bebas Neue', stack: "'Bebas Neue', Impact, 'Arial Narrow Bold', sans-serif" },
};

// ===== Builder de overlays: elementos livres sobre um canvas (texto, imagem/vídeo, formas) =====
const BUILDER_TYPES = ['text', 'image', 'video', 'shape'];
const BUILDER_ANIMATIONS = [['none', 'Sem animação'], ['fade', 'Fade'], ['slide-left', 'Deslizar da esquerda'], ['slide-right', 'Deslizar da direita'], ['slide-up', 'Subir'], ['slide-down', 'Descer'], ['zoom', 'Zoom'], ['pop', 'Pop com ressalto'], ['wipe', 'Cortina'], ['flip', 'Virar']];
const BUILDER_ANIMATION_KEYS = BUILDER_ANIMATIONS.map(([key]) => key);
const BUILDER_TOKENS = [['{home.name}', 'Mandante'], ['{home.short}', 'Sigla mandante'], ['{home.score}', 'Placar mandante'], ['{away.name}', 'Visitante'], ['{away.short}', 'Sigla visitante'], ['{away.score}', 'Placar visitante'], ['{clock}', 'Cronômetro'], ['{period}', 'Período'], ['{competition}', 'Competição'], ['{sponsor}', 'Patrocinador'], ['{time}', 'Hora'], ['{champ.name}', 'Campeonato (tabela)'], ['{table.1.name}', '1º colocado'], ['{table.1.points}', 'Pontos do 1º'], ['{table.2.name}', '2º colocado']];
const BUILDER_IMAGE_TOKENS = [['token:home.logo', 'Escudo do mandante'], ['token:away.logo', 'Escudo do visitante'], ['token:sponsor', 'Logo do patrocinador ativo']];
const BUILDER_SIZES = [['1920x1080', 'Tela cheia 1920 × 1080'], ['1280x720', 'Tela cheia 1280 × 720'], ['1080x1920', 'Vertical 1080 × 1920'], ['1500x200', 'Barra 1500 × 200'], ['1200x260', 'Lower third 1200 × 260'], ['800x450', 'Cartão 800 × 450'], ['600x600', 'Quadrado 600 × 600']];
const BUILDER_ELEMENT_NAMES = { text: 'Texto', image: 'Imagem', video: 'Vídeo', shape: 'Forma' };

function normalizedCustomElement(raw, index = 0) {
  const type = BUILDER_TYPES.includes(raw?.type) ? raw.type : 'text';
  const anim = value => BUILDER_ANIMATION_KEYS.includes(value) ? value : 'fade';
  const optionalColor = value => value ? safeColor(value, '') : '';
  const src = String(raw?.src || '').slice(0, 500);
  return {
    id: String(raw?.id || `el-${index + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 24) || `el-${index + 1}`,
    type,
    name: String(raw?.name || BUILDER_ELEMENT_NAMES[type]).slice(0, 60),
    x: clampNumber(raw?.x, -100, 200, 10), y: clampNumber(raw?.y, -100, 200, 10),
    w: clampNumber(raw?.w, 0.5, 300, 30), h: clampNumber(raw?.h, 0.5, 300, 12),
    rotation: clampNumber(raw?.rotation, -360, 360, 0), opacity: clampNumber(raw?.opacity, 0, 100, 100),
    visible: raw?.visible !== false, locked: Boolean(raw?.locked),
    text: String(raw?.text ?? (type === 'text' ? 'Texto' : '')).slice(0, 400),
    font: raw?.font === 'global' || TYPEFACES[raw?.font] ? raw.font : 'global',
    size: clampNumber(raw?.size, 6, 800, 48),
    weight: [400, 500, 600, 700, 800, 900].includes(Number(raw?.weight)) ? Number(raw.weight) : 700,
    color: safeColor(raw?.color, '#ffffff'),
    align: ['left', 'center', 'right'].includes(raw?.align) ? raw.align : 'left',
    valign: ['top', 'middle', 'bottom'].includes(raw?.valign) ? raw.valign : 'middle',
    transform: raw?.transform === 'uppercase' ? 'uppercase' : 'none',
    spacing: clampNumber(raw?.spacing, -10, 40, 0), lineHeight: clampNumber(raw?.lineHeight, 70, 220, 110),
    italic: Boolean(raw?.italic), marquee: Boolean(raw?.marquee), marqueeSpeed: clampNumber(raw?.marqueeSpeed, 2, 90, 14),
    fill: optionalColor(raw?.fill), fill2: optionalColor(raw?.fill2), fillAngle: clampNumber(raw?.fillAngle, 0, 360, 135), fillOpacity: clampNumber(raw?.fillOpacity, 0, 100, 100),
    radius: clampNumber(raw?.radius, 0, 800, 0), borderColor: safeColor(raw?.borderColor, '#ffffff'), borderWidth: clampNumber(raw?.borderWidth, 0, 80, 0),
    shadow: ['none', 'soft', 'strong'].includes(raw?.shadow) ? raw.shadow : 'none', padding: clampNumber(raw?.padding, 0, 300, 0),
    src: /^(\/api\/assets\/|https?:\/\/|token:)/.test(src) ? src : '',
    fit: raw?.fit === 'contain' ? 'contain' : 'cover', shape: raw?.shape === 'circle' ? 'circle' : 'rect',
    animIn: anim(raw?.animIn), animOut: raw?.animOut === 'same' || BUILDER_ANIMATION_KEYS.includes(raw?.animOut) ? raw.animOut : 'same',
    delay: clampNumber(raw?.delay, 0, 10000, 0), duration: clampNumber(raw?.duration, 100, 5000, 600),
  };
}

// Overlays criados antes do Builder por elementos (mídia + título + texto) viram elementos equivalentes.
function legacyCustomElements(item) {
  const w = clampNumber(item?.width, 200, 3840, 1920);
  const background = safeColor(item?.background, '#10131a');
  const accent = safeColor(item?.accent, '#2f7df6');
  const textColor = safeColor(item?.textColor, '#ffffff');
  const media = String(item?.media || '');
  const layout = ['media', 'text', 'media-text'].includes(item?.layout) ? item.layout : 'media-text';
  const animIn = ['fade', 'slide', 'zoom'].includes(item?.animation) ? { fade: 'fade', slide: 'slide-left', zoom: 'zoom' }[item.animation] : 'fade';
  const base = { animIn, animOut: 'same', delay: 0, duration: 650 };
  const list = [{ ...base, id: 'el-bg', type: 'shape', name: 'Fundo', x: 0, y: 0, w: 100, h: 100, fill: background }];
  const hasMedia = layout !== 'text';
  const hasText = layout !== 'media';
  const textX = hasMedia && hasText ? 57 : 0;
  if (hasMedia) list.push({ ...base, id: 'el-media', type: /\.(mp4|webm)(\?|$)/i.test(media) || item?.mediaType === 'video' ? 'video' : 'image', name: 'Mídia', x: 0, y: 0, w: hasText ? 57 : 100, h: 100, src: media, fit: 'cover' });
  if (hasText) {
    list.push({ ...base, id: 'el-accent', type: 'shape', name: 'Destaque', x: textX, y: 0, w: 0.5, h: 100, fill: accent });
    const pad = (100 - textX) * 0.08;
    list.push({ ...base, id: 'el-title', type: 'text', name: 'Título', x: textX + pad, y: 20, w: 100 - textX - pad * 2, h: 36, text: String(item?.title || '').slice(0, 120), size: Math.round(w * 0.042 * ((100 - textX) / 43)), weight: 800, color: textColor, transform: 'uppercase', lineHeight: 95, valign: 'bottom' });
    list.push({ ...base, id: 'el-subtitle', type: 'text', name: 'Texto complementar', x: textX + pad, y: 60, w: 100 - textX - pad * 2, h: 30, text: String(item?.subtitle || '').slice(0, 240), size: Math.round(w * 0.016), weight: 500, color: textColor, opacity: 75, valign: 'top' });
  }
  return list;
}

function normalizedCustomElements(item) {
  const source = Array.isArray(item?.elements) ? item.elements : legacyCustomElements(item);
  const seen = new Set();
  return source.slice(0, 60).map((raw, index) => {
    const element = normalizedCustomElement(raw, index);
    while (seen.has(element.id)) element.id = `${element.id.slice(0, 20)}-${index}`;
    seen.add(element.id);
    return element;
  });
}

function newBuilderId(prefix, taken = []) {
  let id;
  do { id = `${prefix}-${Math.random().toString(36).slice(2, 8)}`; } while (taken.includes(id));
  return id;
}

function freshSportData() {
  return {
    volleyball: { sets: { home: 0, away: 0 }, serve: 'home', timeouts: { home: 0, away: 0 } },
    futsal: { fouls: { home: 0, away: 0 } },
    basketball: {
      fouls: { home: 0, away: 0 }, timeouts: { home: 0, away: 0 }, possession: 'home',
      shotClock: { remaining: 24, running: false, startedAt: null },
    },
  };
}

function defaultAppearance() {
  return {
    scoreboardScale: 100, scoreboardFont: 100, scoreboardTypeface: 'global', scoreboardX: 4, scoreboardY: 7, scoreboardLayout: 'compact', scoreboardShowBadge: false, scoreboardStyle: 'classic', scoreboardRadius: 4, scoreboardSurface: 100, scoreboardAccent: 2, scoreboardShadow: 'soft', scoreboardAnimation: 'assemble', scoreboardAnimationSpeed: 100,
    eventScale: 100, eventFont: 100, eventTypeface: 'global', eventX: 2, eventY: 72, eventPosition: 'left', eventStyle: 'broadcast',
    lineupScale: 100, lineupFont: 100, lineupTypeface: 'global', lineupX: 7, lineupY: 18, lineupStyle: 'panel',
    photoLineupScale: 100, photoLineupFont: 100, photoLineupTypeface: 'global', photoLineupX: 7, photoLineupY: 12, photoLineupSurface: 96, photoLineupRadius: 2, photoLineupSponsorCount: 6, photoLineupSponsorBarSize: 100, photoLineupIndividualDuration: 3, photoLineupPanelDuration: 5, photoLineupLayout: 'classic', photoLineupFormationMark: 'number', photoLineupFormationPhotoSize: 100, photoLineupStyle: 'editorial', photoLineupAnimation: 'slide',
    sponsorScale: 100, sponsorFont: 100, sponsorTypeface: 'global', sponsorX: 78, sponsorY: 7, sponsorFormat: 'banner-name', sponsorAnimation: 'fade', sponsorAnimationSpeed: 100, sponsorDuration: 10, sponsorStyle: 'boxed',
    statsScale: 100, statsFont: 100, statsTypeface: 'global', statsX: 30, statsY: 56, statsStyle: 'broadcast', statsAnimation: 'rise', statsDuration: 12,
    sponsorBarDuration: 10, sponsorBarAnimationSpeed: 100, sponsorBarTransition: 'fade', sponsorBarFit: 'cover', sponsorBarBorder: 'thin', sponsorBarShadow: 'none', sponsorBarScale: 100, sponsorBarX: 50, sponsorBarY: 91, sponsorBarOpacity: 100, sponsorBarRadius: 0, sponsorBarBackground: '#08090d',
    periodScale: 100, periodFont: 100, periodSurface: 100, extraTimeScale: 100,
    goalText: 'GOOOL', goalWordDuration: 2, goalTeamDuration: 2, goalAnimation: 'typewriter', cardDisplayMode: 'lower-third',
  };
}

function currentSport() {
  return SPORTS[state.sport] || SPORTS.football;
}

function createDefaultState() {
  return {
    matchId: '',
    championshipId: '',
    sport: 'football',
    competition: 'Campeonato Municipal de Futebol 2026',
    venue: 'Ilha Comprida · SP',
    home: { name: 'Juventude E.C.', short: 'JUV', color: '#8253cd', score: 0, logo: '', roster: defaultRoster.join('\n') },
    away: { name: 'Atlético Ilha', short: 'ATL', color: '#4588b5', score: 0, logo: '', roster: defaultRoster.map((name, index) => name.replace(/^[0-9]+/, String(index + 12))).join('\n') },
    selectedTeams: { home: 'team-juventude', away: 'team-atletico-ilha' },
    clock: { elapsed: 0, running: false, startedAt: null },
    period: '1T',
    extraTime: 0,
    matchStartedAt: null,
    matchEndedAt: null,
    periodScores: {},
    completedReports: [],
    championshipTheme: { name: 'Tema do campeonato', primary: '#8253cd', secondary: '#d8ad56', support1: '#131119', support2: '#ffffff', enabled: false, overrides: {} },
    theme: 'aurum',
    customPrimary: '#8253cd',
    customAccent: '#d8ad56',
    typeface: 'rajdhani',
    appearance: defaultAppearance(),
    sportData: freshSportData(),
    visible: { scoreboard: true, sponsor: false, sponsorBar: false, lineup: false, photoLineup: false, stats: false },
    sponsor: 'PATROCINADOR',
    sponsorBanner: '',
    sponsors: [{ id: 'sponsor-1', name: 'PATROCINADOR', banner: '', logo: '', wideAsset: '', lineupMedia: '', lineupMediaType: 'image' }],
    sponsorSource: 'platform',
    sponsorBarMode: 'images',
    sponsorBarVideo: '',
    sponsorBarItems: [{ id: 'bar-1', asset: '' }],
    sponsorBarActiveIndex: 0,
    sponsorBarLoop: false,
    sponsorBarTransition: null,
    sponsorBarExpiresAt: 0,
    sponsorBarNextIndex: null,
    sponsorBarAutoSchedule: false,
    sponsorBarScheduleInterval: 5,
    sponsorBarScheduleNextAt: 0,
    customOverlays: [],
    activeSponsorIndex: 0,
    sponsorLoop: false,
    lineupTeam: 'home',
    photoLineupShowSponsors: true,
    squad: {},
    stats: defaultStats(),
    statsView: 'compare',
    statsMetrics: ['possession', 'shots', 'shotsOnTarget', 'corners', 'fouls'],
    statsPlayer: { team: 'home', name: '', note: '' },
    statsTransition: null,
    statsExpiresAt: 0,
    photoLineupStage: 'starters',
    photoLineupPlayerIndex: 0,
    photoLineupAuto: { running: false, nextAt: 0 },
    photoLineupStageTransition: null,
    activeEvent: null,
    eventExpiresAt: 0,
    motion: null,
    scoreboardTransition: null,
    scoreboardMorph: null,
    sponsorTransition: null,
    sponsorExpiresAt: 0,
    sponsorNextIndex: null,
    lineupTransition: null,
    photoLineupTransition: null,
    goalGraphic: null,
    scoreboardCard: null,
    scoreboardRecovery: null,
    events: [],
    updatedAt: 0,
  };
}

function normalizeState(saved) {
  const defaults = createDefaultState();
  if (!saved || typeof saved !== 'object') return defaults;
  const sportData = saved.sportData || {};
  const volleyball = sportData.volleyball || {};
  const futsal = sportData.futsal || {};
  const basketball = sportData.basketball || {};
  const migratedSponsors = Array.isArray(saved.sponsors) && saved.sponsors.length
    ? saved.sponsors.slice(0, 20).map((sponsor, index) => ({
      id: String(sponsor?.id || `sponsor-${index + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 40) || `sponsor-${index + 1}`,
      name: String(sponsor?.name || `PATROCINADOR ${index + 1}`).slice(0, 80),
      banner: String(sponsor?.banner || '').slice(0, 500),
      logo: String(sponsor?.logo || '').slice(0, 500),
      wideAsset: String(sponsor?.wideAsset || '').slice(0, 500),
      lineupMedia: String(sponsor?.lineupMedia || '').slice(0, 500),
      lineupMediaType: sponsor?.lineupMediaType === 'video' ? 'video' : 'image',
    }))
    : [{ id: 'sponsor-1', name: String(saved.sponsor || defaults.sponsor), banner: String(saved.sponsorBanner || ''), logo: '', wideAsset: '', lineupMedia: '', lineupMediaType: 'image' }];
  const migratedStage = saved.photoLineupStage === 'coach' ? 'starters' : saved.photoLineupStage;
  const photoLineupStage = ['individual', 'starters', 'reserves', 'formation'].includes(migratedStage) ? migratedStage : 'starters';
  const sponsorBarItems = (Array.isArray(saved.sponsorBarItems) && saved.sponsorBarItems.length
    ? saved.sponsorBarItems
    : migratedSponsors.filter(item => item.wideAsset).map((item, index) => ({ id: `bar-${index + 1}`, asset: item.wideAsset })))
    .slice(0, 30).map((item, index) => ({
      id: String(item?.id || `bar-${index + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 48) || `bar-${index + 1}`,
      asset: String(item?.asset || '').slice(0, 500),
    }));
  if (!sponsorBarItems.length) sponsorBarItems.push({ id: 'bar-1', asset: '' });
  const customOverlays = (Array.isArray(saved.customOverlays) ? saved.customOverlays : []).slice(0, 30).map((item, index) => ({
    id: String(item?.id || `overlay-${index + 1}`).replace(/[^a-z0-9-]/gi, '').slice(0, 48) || `overlay-${index + 1}`,
    name: String(item?.name || `Overlay ${index + 1}`).slice(0, 80),
    width: clampNumber(item?.width, 200, 3840, 1920), height: clampNumber(item?.height, 100, 2160, 1080),
    title: String(item?.title || '').slice(0, 120), subtitle: String(item?.subtitle || '').slice(0, 240),
    media: String(item?.media || '').slice(0, 500), mediaType: item?.mediaType === 'video' ? 'video' : 'image',
    layout: ['media','text','media-text'].includes(item?.layout) ? item.layout : 'media-text',
    animation: ['fade','slide','zoom'].includes(item?.animation) ? item.animation : 'fade',
    background: safeColor(item?.background, '#10131a'), accent: safeColor(item?.accent, '#2f7df6'), textColor: safeColor(item?.textColor, '#ffffff'),
    visible: Boolean(item?.visible), transition: item?.transition && typeof item.transition === 'object' ? item.transition : null,
    elements: normalizedCustomElements(item),
    canvasBg: item?.canvasBg ? safeColor(item.canvasBg, '') : '',
    autoHide: clampNumber(item?.autoHide, 0, 3600, 0), expiresAt: Number(item?.expiresAt) > 0 ? Number(item.expiresAt) : 0,
  }));
  const savedClock = saved.clock && typeof saved.clock === 'object' ? saved.clock : {};
  const clockElapsed = Number.isFinite(Number(savedClock.elapsed)) ? Math.max(0, Number(savedClock.elapsed)) : 0;
  const clockRunning = Boolean(savedClock.running);
  const clockStartedAt = Number(savedClock.startedAt);
  const normalizedClock = {
    elapsed: clockElapsed,
    running: clockRunning,
    startedAt: clockRunning && Number.isFinite(clockStartedAt) && clockStartedAt > 0 ? clockStartedAt : clockRunning ? Date.now() : null,
  };
  return {
    ...defaults, ...saved,
    sport: SPORTS[saved.sport] ? saved.sport : 'football',
    typeface: TYPEFACES[saved.typeface] ? saved.typeface : 'rajdhani',
    home: { ...defaults.home, ...saved.home },
    away: { ...defaults.away, ...saved.away },
    clock: normalizedClock,
    visible: { ...defaults.visible, ...saved.visible },
    selectedTeams: { ...defaults.selectedTeams, ...(saved.selectedTeams || {}) },
    squad: normalizedSquad(saved.squad),
    stats: normalizedStats(saved.stats),
    statsView: ['compare', 'timeline', 'player'].includes(saved.statsView) ? saved.statsView : 'compare',
    statsMetrics: normalizedStatsMetrics(saved.statsMetrics),
    statsPlayer: { team: saved.statsPlayer?.team === 'away' ? 'away' : 'home', name: String(saved.statsPlayer?.name || '').slice(0, 80), note: String(saved.statsPlayer?.note || '').slice(0, 120) },
    appearance: { ...defaults.appearance, ...(saved.appearance || {}), sponsorFormat: ['text','logo-name','banner','banner-name'].includes(saved.appearance?.sponsorFormat) ? saved.appearance.sponsorFormat : defaults.appearance.sponsorFormat },
    // Salas já salvas sem o campo mantêm os próprios patrocínios; salas novas herdam a biblioteca da plataforma.
    sponsorSource: saved.sponsorSource === 'platform' || (saved.sponsorSource == null && !saved.updatedAt) ? 'platform' : 'match',
    sponsors: migratedSponsors,
    activeSponsorIndex: clampNumber(saved.activeSponsorIndex, 0, migratedSponsors.length - 1, 0),
    sponsorLoop: Boolean(saved.sponsorLoop),
    sponsorBarMode: saved.sponsorBarMode === 'video' ? 'video' : 'images',
    sponsorBarItems,
    sponsorBarActiveIndex: clampNumber(saved.sponsorBarActiveIndex, 0, Math.max(0, sponsorBarItems.length - 1), 0),
    sponsorBarLoop: Boolean(saved.sponsorBarLoop),
    sponsorBarAutoSchedule: Boolean(saved.sponsorBarAutoSchedule),
    sponsorBarScheduleInterval: clampNumber(saved.sponsorBarScheduleInterval, 1, 60, 5),
    sponsorBarScheduleNextAt: Number.isFinite(Number(saved.sponsorBarScheduleNextAt)) ? Number(saved.sponsorBarScheduleNextAt) : 0,
    customOverlays,
    championshipTheme: { ...defaults.championshipTheme, ...(saved.championshipTheme || {}), overrides: { ...(saved.championshipTheme?.overrides || {}) } },
    periodScores: saved.periodScores && typeof saved.periodScores === 'object' ? saved.periodScores : {},
    completedReports: Array.isArray(saved.completedReports) ? saved.completedReports.slice(0, 50) : [],
    photoLineupStage,
    photoLineupPlayerIndex: clampNumber(saved.photoLineupPlayerIndex, 0, 99, 0),
    photoLineupAuto: { running: Boolean(saved.photoLineupAuto?.running), nextAt: Number(saved.photoLineupAuto?.nextAt || 0) },
    sportData: {
      volleyball: {
        ...defaults.sportData.volleyball, ...volleyball,
        sets: { ...defaults.sportData.volleyball.sets, ...volleyball.sets },
        timeouts: { ...defaults.sportData.volleyball.timeouts, ...volleyball.timeouts },
      },
      futsal: { ...defaults.sportData.futsal, ...futsal, fouls: { ...defaults.sportData.futsal.fouls, ...futsal.fouls } },
      basketball: {
        ...defaults.sportData.basketball, ...basketball,
        fouls: { ...defaults.sportData.basketball.fouls, ...basketball.fouls },
        timeouts: { ...defaults.sportData.basketball.timeouts, ...basketball.timeouts },
        shotClock: { ...defaults.sportData.basketball.shotClock, ...basketball.shotClock },
      },
    },
  };
}

function loadState() {
  try { return normalizeState(JSON.parse(localStorage.getItem(STORAGE_KEY))); }
  catch { return createDefaultState(); }
}

let state = loadState();
let teamCatalogState = loadTeamCatalog();
let teamCatalog = teamCatalogState.teams;
let teamCatalogServerUpdatedAt = Number(teamCatalogState.updatedAt || 0);
let selectedCatalogTeamId = teamCatalog.find(team => team.id === state.selectedTeams?.home)?.id || teamCatalog[0]?.id;
let currentTab = 'match';
let drawer = null;
let toastTimeout = null;
let pushTimeout = null;
let teamCatalogPushTimeout = null;
let teamPortalTeam = null;
let teamPortalStatus = isTeamPortal ? 'loading' : 'idle';
let adminSession = { status: isAdminPanel ? 'checking' : 'idle', username: null, role: 'admin', error: '' };
const ADMIN_ROLE_LABELS = { admin: 'Administrador', operator: 'Operador', viewer: 'Leitor' };
const ADMIN_ROLE_HINTS = { admin: 'Acesso total, inclusive usuários e acessos', operator: 'Opera transmissão e cadastros; não gerencia usuários', viewer: 'Somente leitura; não altera nada' };
let teamSession = { status: isTeamPortal ? 'checking' : 'idle', teamId: null, teamName: null, error: '' };
let teamLoginTeams = [];
let accessAdmins = [];
let accessTeamCredentials = [];
let accessStatus = 'idle';
let accessSearch = '';
let accessTeamFilter = 'all';
let accessRevealed = {};
let dashboardStats = { status: 'idle', byRoom: {} };
let operationsData = { championships: [], matches: [], notifications: [], announcements: [], posts: [], logs: [], delegationStatus: {}, teamHistory: {}, updatedAt: 0 };
let operationsStatus = 'idle';
let selectedChampionshipId = '';
let selectedMatchId = '';
let championshipDraft = null;
let matchDraft = null;
let teamDelegation = { status: 'draft' };
let teamDelegationCompletion = { complete: false, missing: [] };
let teamPortalDeadline = '';
let teamPortalContext = { championships: [], matches: [] };
let teamPortalTab = 'home';
let teamPortalChampionshipId = '';
let teamPortalMatchId = '';
try { teamPortalChampionshipId = localStorage.getItem('juventude.team.championship') || ''; } catch {}
let lastClock = '';
let syncStatus = 'connecting';
let lastSyncAt = 0;
let consecutiveFailures = 0;
let outputFingerprints = {};
let moduleTab = 'information';
let reportSelection = 0;
let reportExportType = 'full';
let selectedCustomOverlayId = state.customOverlays?.[0]?.id || '';

function appearanceSnapshot(source = state) {
  return {
    theme: source.theme,
    customPrimary: source.customPrimary,
    customAccent: source.customAccent,
    typeface: source.typeface,
    appearance: structuredClone(source.appearance || defaultAppearance()),
    championshipTheme: structuredClone(source.championshipTheme || createDefaultState().championshipTheme),
  };
}

function applyGlobalAppearance(target, globalAppearance) {
  if (!globalAppearance || typeof globalAppearance !== 'object') return target;
  const defaults = createDefaultState();
  target.theme = String(globalAppearance.theme || defaults.theme);
  target.customPrimary = safeColor(globalAppearance.customPrimary, defaults.customPrimary);
  target.customAccent = safeColor(globalAppearance.customAccent, defaults.customAccent);
  target.typeface = TYPEFACES[globalAppearance.typeface] ? globalAppearance.typeface : defaults.typeface;
  target.appearance = { ...defaultAppearance(), ...(globalAppearance.appearance || {}) };
  target.championshipTheme = { ...defaults.championshipTheme, ...(globalAppearance.championshipTheme || {}), overrides: { ...(globalAppearance.championshipTheme?.overrides || {}) } };
  return target;
}

function appearanceFingerprint(source = state) {
  return JSON.stringify(appearanceSnapshot(source));
}

if (teamCatalogState.globalAppearance) applyGlobalAppearance(state, teamCatalogState.globalAppearance);

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[character]));
}

function safeColor(value, fallback = '#8253cd') {
  return /^#[0-9a-f]{6}$/i.test(String(value || '')) ? value : fallback;
}

function clampNumber(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

function cssNumber(value) {
  return Number(Number(value).toFixed(4));
}

// 'global' (padrão) segue a fonte escolhida em Aparência; um valor próprio sobrepõe só aquele overlay.
function appearanceFont(key) {
  return TYPEFACES[state.appearance?.[key]] || TYPEFACES[state.typeface] || TYPEFACES.rajdhani;
}

function goalLetters(value = state.appearance?.goalText) {
  const word = String(value || 'GOOOL').slice(0, 16).toUpperCase();
  return [...word].map((letter, index) => `<span style="--letter-index:${index}">${letter === ' ' ? '&nbsp;' : escapeHtml(letter)}</span>`).join('');
}

function scoreboardTransitionDuration() {
  const speed = clampNumber(state.appearance?.scoreboardAnimationSpeed, 50, 160, 100);
  return Math.round(850 * (100 / speed));
}

function scoreboardMorphDuration() {
  const speed = clampNumber(state.appearance?.scoreboardAnimationSpeed, 50, 160, 100);
  return Math.round(720 * (100 / speed));
}

function sponsorMotionDuration(appearance = state.appearance) {
  const speed = clampNumber(appearance?.sponsorAnimationSpeed, 50, 160, 100);
  return Math.round(680 * (100 / speed));
}

function sponsorBarMotionDuration(appearance = state.appearance) {
  const speed = clampNumber(appearance?.sponsorBarAnimationSpeed, 50, 160, 100);
  return Math.round(680 * (100 / speed));
}

// OBS receives state by polling. The very first time a given transition (identified
// by its startedAt) is painted, replaying from a negative delay made that first frame
// jump into the middle of the transition and look clipped — so it plays from frame 0.
// But unrelated content changes (a score edit, a settings tweak) can force the isolated
// layer to re-render while that SAME transition is still in flight; without this map,
// motionOffset used to return 0 again on every such re-render, restarting the CSS
// animation from scratch and making it look cut/stuttered mid-playback. Once a
// startedAt has been seen, later renders resume it from the real elapsed time instead.
const seenMotionStarts = new Map();

function pruneSeenMotionStarts() {
  if (seenMotionStarts.size < 200) return;
  const cutoff = Date.now() - 30000;
  for (const [startedAt, firstSeenAt] of seenMotionStarts) {
    if (firstSeenAt < cutoff) seenMotionStarts.delete(startedAt);
  }
}

function motionOffset(startedAt, maximum) {
  const key = Number(startedAt || 0);
  if (isOutput) {
    if (!key) return 0;
    if (!seenMotionStarts.has(key)) {
      seenMotionStarts.set(key, Date.now());
      return 0;
    }
    return -Math.min(Math.max(0, Date.now() - key), maximum);
  }
  return -Math.min(Math.max(0, Date.now() - Number(startedAt || Date.now())), maximum);
}

function activeSponsor(draft = state) {
  const sponsors = Array.isArray(draft.sponsors) && draft.sponsors.length ? draft.sponsors : [{ id: 'sponsor-1', name: draft.sponsor || 'PATROCINADOR', banner: draft.sponsorBanner || '', logo: '' }];
  const index = clampNumber(draft.activeSponsorIndex, 0, sponsors.length - 1, 0);
  return sponsors[index];
}

function activeSponsorBar(draft = state) {
  const items = Array.isArray(draft.sponsorBarItems) ? draft.sponsorBarItems : [];
  const index = clampNumber(draft.sponsorBarActiveIndex, 0, Math.max(0, items.length - 1), 0);
  return items[index] || { id: 'bar-empty', asset: '' };
}

function selectedCustomOverlay(draft = state) {
  const items = Array.isArray(draft.customOverlays) ? draft.customOverlays : [];
  return items.find(item => item.id === (isOutput ? outputCustomId : selectedCustomOverlayId)) || items[0] || null;
}

function overlayThemeStyle(key) {
  const theme = state.championshipTheme;
  if (!theme?.enabled) return '';
  const override = theme.overrides?.[key] || {};
  return `--overlay-primary:${safeColor(override.primary, theme.primary)};--overlay-accent:${safeColor(override.secondary, theme.secondary)};--overlay-dark:${safeColor(theme.support1, '#131119')};--overlay-light:${safeColor(theme.support2, '#ffffff')};`;
}

function putSponsorOnAir(draft) {
  const now = Date.now();
  const sponsor = activeSponsor(draft);
  draft.sponsor = sponsor.name;
  draft.sponsorBanner = sponsor.banner;
  draft.visible.sponsor = true;
  draft.sponsorNextIndex = null;
  draft.sponsorExpiresAt = now + clampNumber(draft.appearance?.sponsorDuration, 3, 60, 10) * 1000;
  draft.sponsorTransition = { type: 'enter', startedAt: now, expiresAt: now + sponsorMotionDuration(draft.appearance) };
}

function putSponsorBarOnAir(draft) {
  const now = Date.now();
  draft.visible.sponsorBar = true;
  draft.sponsorBarNextIndex = null;
  draft.sponsorBarExpiresAt = draft.sponsorBarMode === 'video' ? 0 : now + clampNumber(draft.appearance?.sponsorBarDuration, 3, 60, 10) * 1000;
  draft.sponsorBarTransition = { type: 'enter', startedAt: now, expiresAt: now + sponsorBarMotionDuration(draft.appearance) };
}

function setLineupVisibility(draft, visible) {
  const now = Date.now();
  draft.visible.lineup = visible;
  draft.lineupTransition = { type: visible ? 'enter' : 'exit', startedAt: now, expiresAt: now + 600 };
}

function setPhotoLineupVisibility(draft, visible) {
  const now = Date.now();
  draft.visible.photoLineup = visible;
  if (!visible) draft.photoLineupAuto = { running: false, nextAt: 0 };
  draft.photoLineupTransition = { type: visible ? 'enter' : 'exit', startedAt: now, expiresAt: now + 900 };
}

function activeLineupTeam() {
  const matchTeam = state[state.lineupTeam] || state.home;
  return teamCatalog.find(team => team.id === state.selectedTeams?.[state.lineupTeam]) || matchTeam;
}

function squadKey(team) {
  return String(team?.id || state.lineupTeam || 'home').replace(/[^a-z0-9-]/gi, '').slice(0, 64) || 'home';
}

function normalizedSquad(value) {
  const squad = {};
  if (!value || typeof value !== 'object') return squad;
  const ids = list => (Array.isArray(list) ? list : []).map(id => String(id).replace(/[^a-z0-9-]/gi, '').slice(0, 56)).filter(Boolean).slice(0, 100);
  for (const [key, entry] of Object.entries(value).slice(0, 40)) {
    const positions = {};
    for (const [athleteKey, point] of Object.entries(entry?.positions || {}).slice(0, 30)) {
      if (Array.isArray(point) && point.length === 2) positions[String(athleteKey).replace(/[^a-z0-9-]/gi, '').slice(0, 56)] = [clampNumber(point[0], 2, 98, 50), clampNumber(point[1], 2, 98, 50)];
    }
    squad[String(key).replace(/[^a-z0-9-]/gi, '').slice(0, 64)] = { called: ids(entry?.called), starters: ids(entry?.starters), formation: FORMATIONS[entry?.formation] ? entry.formation : '', positions };
  }
  return squad;
}

function teamMatchSquad(team) {
  const entry = state.matchId ? team?.matchSquads?.[state.matchId] : null;
  if (!entry?.starters?.length) return null;
  const registration = team.registrations?.[state.championshipId] || {};
  return { called: [...entry.starters, ...(entry.reserves || [])], starters: entry.starters, formation: entry.formation || registration.formation || '', positions: {}, numbers: registration.numbers || {} };
}

function effectiveSquad(team) {
  return state.squad?.[squadKey(team)] || teamMatchSquad(team);
}

function lineupGroups(team = activeLineupTeam()) {
  const matchTeam = state[state.lineupTeam] || state.home;
  const athletes = Array.isArray(team?.athletes) && team.athletes.length ? team.athletes : athletesFromRoster(matchTeam.roster);
  const squad = effectiveSquad(team);
  if (squad?.starters?.length) {
    const called = squad.called?.length ? new Set(squad.called) : null;
    const pool = (called ? athletes.filter(athlete => called.has(athlete.id)) : athletes).map(athlete => squad.numbers?.[athlete.id] ? { ...athlete, number: squad.numbers[athlete.id] } : athlete);
    const byId = new Map(pool.map(athlete => [athlete.id, athlete]));
    const chosen = squad.starters.map(id => byId.get(id)).filter(Boolean).slice(0, currentSport().teamSize);
    if (chosen.length) {
      const chosenIds = new Set(chosen.map(athlete => athlete.id));
      return { starters: chosen, reserves: pool.filter(athlete => !chosenIds.has(athlete.id)) };
    }
  }
  const preferred = athletes.filter(athlete => athlete.squadRole !== 'reserve');
  const remaining = athletes.filter(athlete => athlete.squadRole === 'reserve');
  const starters = [...preferred, ...remaining].slice(0, currentSport().teamSize);
  const starterIds = new Set(starters.map(athlete => athlete.id));
  return { starters, reserves: athletes.filter(athlete => !starterIds.has(athlete.id)) };
}

function photoLineupStageDuration(stage = state.photoLineupStage) {
  const seconds = stage === 'individual'
    ? clampNumber(state.appearance?.photoLineupIndividualDuration, 2, 10, 3)
    : clampNumber(state.appearance?.photoLineupPanelDuration, 3, 15, 5);
  return seconds * 1000;
}

function setPhotoLineupStage(draft, stage, playerIndex = draft.photoLineupPlayerIndex, keepAuto = false, playerDirection = '') {
  const allowed = ['individual', 'starters', 'reserves', 'formation'];
  const now = Date.now();
  const wasVisible = Boolean(draft.visible.photoLineup);
  draft.photoLineupStage = allowed.includes(stage) ? stage : 'starters';
  draft.photoLineupPlayerIndex = Math.max(0, Number(playerIndex || 0));
  draft.visible.photoLineup = true;
  draft.photoLineupTransition = wasVisible ? null : { type: 'enter', startedAt: now, expiresAt: now + 900 };
  draft.photoLineupStageTransition = { startedAt: now, expiresAt: now + 850, playerDirection: playerDirection === 'previous' ? 'previous' : playerDirection === 'next' ? 'next' : '' };
  if (!keepAuto) draft.photoLineupAuto = { running: false, nextAt: 0 };
}

function startPhotoLineupSequence(draft) {
  setLineupVisibility(draft, false);
  setPhotoLineupStage(draft, 'individual', 0, true);
  draft.photoLineupTransition = { type: 'enter', startedAt: Date.now(), expiresAt: Date.now() + 900 };
  draft.photoLineupAuto = { running: true, nextAt: Date.now() + photoLineupStageDuration('individual') };
}

function advancePhotoLineupSequence(draft) {
  const { starters, reserves } = lineupGroups();
  let nextStage = draft.photoLineupStage;
  let nextIndex = Number(draft.photoLineupPlayerIndex || 0);
  if (draft.photoLineupStage === 'individual' && nextIndex < starters.length - 1) nextIndex += 1;
  else if (draft.photoLineupStage === 'individual') { nextStage = 'starters'; nextIndex = 0; }
  else if (draft.photoLineupStage === 'starters') nextStage = 'formation';
  else if (draft.photoLineupStage === 'formation') nextStage = reserves.length ? 'reserves' : '';
  else if (draft.photoLineupStage === 'reserves') nextStage = '';
  else {
    setPhotoLineupVisibility(draft, false);
    return;
  }
  if (!nextStage) { setPhotoLineupVisibility(draft, false); return; }
  setPhotoLineupStage(draft, nextStage, nextIndex, true, nextStage === 'individual' ? 'next' : '');
  draft.photoLineupAuto = { running: true, nextAt: Date.now() + photoLineupStageDuration(nextStage) };
}

function putGoalOnAir(draft, team) {
  if (!['football', 'futsal'].includes(draft.sport)) return false;
  const now = Date.now();
  if (!draft.visible.scoreboard) {
    draft.visible.scoreboard = true;
    draft.scoreboardTransition = { type: 'enter', startedAt: now, expiresAt: now + scoreboardTransitionDuration() };
  }
  const wordDuration = clampNumber(draft.appearance?.goalWordDuration, 1, 6, 2) * 1000;
  const teamDuration = clampNumber(draft.appearance?.goalTeamDuration, 1, 6, 2) * 1000;
  const exitDuration = 450;
  draft.goalGraphic = {
    team,
    text: String(draft.appearance?.goalText || 'GOOOL').slice(0, 16).toUpperCase(),
    shownAt: now,
    phaseEndsAt: now + wordDuration,
    exitStartsAt: now + wordDuration + teamDuration,
    expiresAt: now + wordDuration + teamDuration + exitDuration,
    teamShown: false,
  };
  draft.scoreboardRecovery = null;
  draft.scoreboardCard = null;
  return true;
}

function putIntegratedCardOnAir(draft, type, team, name) {
  const now = Date.now();
  if (!draft.visible.scoreboard) draft.scoreboardTransition = { type: 'enter', startedAt: now, expiresAt: now + scoreboardTransitionDuration() };
  draft.visible.scoreboard = true;
  draft.scoreboardCard = {
    type: type === 'red' ? 'red' : 'yellow', team, name: String(name || '').slice(0, 100),
    shownAt: now, exitStartsAt: now + 5000, expiresAt: now + 5450,
  };
  draft.scoreboardRecovery = null;
  draft.goalGraphic = null;
}

function clockSeconds(clock = state.clock, now = Date.now()) {
  const elapsed = Number.isFinite(Number(clock?.elapsed)) ? Math.max(0, Number(clock.elapsed)) : 0;
  const startedAt = Number(clock?.startedAt);
  const runningDelta = clock?.running && Number.isFinite(startedAt) && startedAt > 0 ? Math.max(0, (now - startedAt) / 1000) : 0;
  return Math.max(0, Math.floor(elapsed + runningDelta));
}

function clockText() {
  const elapsed = clockSeconds();
  const seconds = currentSport().duration ? Math.max(0, currentSport().duration - elapsed) : elapsed;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function shotClockSeconds() {
  const shot = state.sportData.basketball.shotClock;
  return Math.max(0, Math.ceil(Number(shot.remaining || 0) - (shot.running && shot.startedAt ? (Date.now() - shot.startedAt) / 1000 : 0)));
}

function minuteText() {
  return `${Math.floor(clockSeconds() / 60)}′`;
}

function badge(team, compact = false) {
  if (team.logo) {
    return `<div class="team-badge" style="--team-color:${safeColor(team.color)}"><img src="${escapeHtml(team.logo)}" alt="Escudo ${escapeHtml(team.name)}" style="width:85%;height:85%;object-fit:contain"></div>`;
  }
  return `<div class="team-badge" style="--team-color:${safeColor(team.color)}">${escapeHtml(team.short.slice(0, compact ? 1 : 2))}</div>`;
}

function scorebugBadge(team) {
  if (team.logo) {
    return `<span class="scorebug-badge" style="--team-color:${safeColor(team.color)}"><img src="${escapeHtml(team.logo)}" alt="Escudo ${escapeHtml(team.name)}"></span>`;
  }
  return `<span class="scorebug-badge scorebug-badge-fallback" style="--team-color:${safeColor(team.color)}">${escapeHtml((team.short || '').slice(0, 2).toUpperCase())}</span>`;
}

function eventPhase() {
  if (!state.activeEvent || !state.eventExpiresAt) return state.activeEvent ? 'visible' : 'hidden';
  const now = Date.now();
  if (state.eventExpiresAt <= now) return state.eventExpiresAt + 550 > now ? 'exiting' : 'hidden';
  if (Number(state.activeEvent.shownAt || 0) + 580 > now) return 'entering';
  return 'visible';
}

function eventIsVisible() {
  return eventPhase() !== 'hidden';
}

function overlayMarkup(layer = 'all') {
  if (layer === 'custom') return renderCustomOverlay();
  const transitionActive = state.scoreboardTransition && Number(state.scoreboardTransition.expiresAt || 0) > Date.now();
  const sponsorTransitionActive = state.sponsorTransition && Number(state.sponsorTransition.expiresAt || 0) > Date.now();
  const showScore = (layer === 'all' || layer === 'scoreboard') && (state.visible.scoreboard || (transitionActive && state.scoreboardTransition.type === 'exit'));
  const showEvent = (layer === 'all' || layer === 'event') && eventIsVisible() && state.activeEvent?.kind !== 'goal';
  const showSponsor = (layer === 'all' || layer === 'sponsor') && (state.visible.sponsor || (sponsorTransitionActive && state.sponsorTransition.type === 'exit'));
  const sponsorBarTransitionActive = state.sponsorBarTransition && Number(state.sponsorBarTransition.expiresAt || 0) > Date.now();
  const showSponsorBar = (layer === 'all' || layer === 'sponsor-bar') && (state.visible.sponsorBar || (sponsorBarTransitionActive && state.sponsorBarTransition.type === 'exit'));
  const statsTransitionActive = state.statsTransition && Number(state.statsTransition.expiresAt || 0) > Date.now();
  const showStats = (layer === 'all' || layer === 'stats') && (state.visible.stats || (statsTransitionActive && state.statsTransition.type === 'exit'));
  const lineupTransitionActive = state.lineupTransition && Number(state.lineupTransition.expiresAt || 0) > Date.now();
  const showLineup = (layer === 'all' || layer === 'lineup') && (state.visible.lineup || (lineupTransitionActive && state.lineupTransition.type === 'exit'));
  const photoLineupTransitionActive = state.photoLineupTransition && Number(state.photoLineupTransition.expiresAt || 0) > Date.now();
  const showPhotoLineup = (layer === 'all' || layer === 'photo-lineup') && (state.visible.photoLineup || (photoLineupTransitionActive && state.photoLineupTransition.type === 'exit'));
  const themeClass = `theme-${escapeHtml(state.theme)}${state.theme === 'custom' ? ' custom-theme' : ''}`;
  const typography = TYPEFACES[state.typeface] || TYPEFACES.rajdhani;
  const appearance = state.appearance || defaultAppearance();
  const scoreFont = clampNumber(appearance.scoreboardFont, 60, 180, 100) / 100;
  const eventFont = clampNumber(appearance.eventFont, 60, 180, 100) / 100;
  const lineupFont = clampNumber(appearance.lineupFont, 60, 180, 100) / 100;
  const photoLineupFont = clampNumber(appearance.photoLineupFont, 60, 180, 100) / 100;
  const sponsorFont = clampNumber(appearance.sponsorFont, 60, 180, 100) / 100;
  const activeEventPhase = eventPhase();
  const eventMotionStart = activeEventPhase === 'exiting' ? state.eventExpiresAt : state.activeEvent?.shownAt;
  const eventMotionOffset = motionOffset(eventMotionStart, activeEventPhase === 'exiting' ? 550 : 580);
  const styles = `--custom-primary:${safeColor(state.customPrimary)};--custom-accent:${safeColor(state.customAccent, '#d8ad56')};--overlay-font:${escapeHtml(typography.stack)};--scoreboard-font:${escapeHtml(appearanceFont('scoreboardTypeface').stack)};--event-font:${escapeHtml(appearanceFont('eventTypeface').stack)};--lineup-font:${escapeHtml(appearanceFont('lineupTypeface').stack)};--photo-lineup-font:${escapeHtml(appearanceFont('photoLineupTypeface').stack)};--sponsor-font:${escapeHtml(appearanceFont('sponsorTypeface').stack)};--scoreboard-scale:${clampNumber(appearance.scoreboardScale, 60, 180, 100) / 100};--event-scale:${clampNumber(appearance.eventScale, 60, 180, 100) / 100};--lineup-scale:${clampNumber(appearance.lineupScale, 60, 180, 100) / 100};--photo-lineup-scale:${clampNumber(appearance.photoLineupScale, 60, 180, 100) / 100};--photo-lineup-sponsor-size:${clampNumber(appearance.photoLineupSponsorBarSize, 60, 180, 100) / 100};--sponsor-scale:${clampNumber(appearance.sponsorScale, 60, 180, 100) / 100};--scoreboard-x:${clampNumber(appearance.scoreboardX, 0, 100, 4)}%;--scoreboard-y:${clampNumber(appearance.scoreboardY, 0, 100, 7)}%;--event-x:${clampNumber(appearance.eventX, 0, 100, 4)}%;--event-y:${clampNumber(appearance.eventY, 0, 100, 72)}%;--lineup-x:${clampNumber(appearance.lineupX, 0, 100, 7)}%;--lineup-y:${clampNumber(appearance.lineupY, 0, 100, 18)}%;--photo-lineup-x:${clampNumber(appearance.photoLineupX, 0, 100, 7)}%;--photo-lineup-y:${clampNumber(appearance.photoLineupY, 0, 100, 16)}%;--photo-lineup-surface:${clampNumber(appearance.photoLineupSurface, 55, 100, 94)}%;--photo-lineup-radius:${clampNumber(appearance.photoLineupRadius, 0, 20, 8)}px;--sponsor-x:${clampNumber(appearance.sponsorX, 0, 100, 78)}%;--sponsor-y:${clampNumber(appearance.sponsorY, 0, 100, 7)}%;--scoreboard-radius:${clampNumber(appearance.scoreboardRadius, 0, 20, 4)}px;--scoreboard-surface:${clampNumber(appearance.scoreboardSurface, 55, 100, 100)}%;--scoreboard-accent:${clampNumber(appearance.scoreboardAccent, 0, 8, 2)}px;--score-root-size:${cssNumber(2.05 * scoreFont)}cqw;--score-goal-size:${cssNumber(2.8 * scoreFont)}cqw;--event-head-size:${cssNumber(1.1 * eventFont)}cqw;--event-name-size:${cssNumber(2.75 * eventFont)}cqw;--goal-word-size:${cssNumber(3.24 * eventFont)}cqw;--event-note-size:${cssNumber(eventFont)}cqw;--lineup-title-size:${cssNumber(2.5 * lineupFont)}cqw;--lineup-player-size:${cssNumber(1.2 * lineupFont)}cqw;--photo-lineup-title-size:${cssNumber(2.2 * photoLineupFont)}cqw;--photo-lineup-name-size:${cssNumber(1.08 * photoLineupFont)}cqw;--photo-lineup-number-size:${cssNumber(1.75 * photoLineupFont)}cqw;--sponsor-small-size:${cssNumber(0.8 * sponsorFont)}cqw;--sponsor-name-size:${cssNumber(1.8 * sponsorFont)}cqw`;
  return `<div class="broadcast-layer ${themeClass} sport-${escapeHtml(state.sport)}" style="${styles}${overlayThemeStyle(layer === 'photo-lineup' || layer === 'lineup' ? 'lineup' : layer)}">
    ${showScore ? renderSportScorebug() : ''}
    ${showEvent ? `<div class="event-banner event-style-${escapeHtml(appearance.eventStyle || 'broadcast')} event-position-${escapeHtml(appearance.eventPosition || 'left')} ${activeEventPhase === 'entering' ? 'is-entering' : activeEventPhase === 'exiting' ? 'is-exiting' : ''}" style="--event-motion-offset:${eventMotionOffset}ms" data-overlay="event"><div class="event-banner-head">${escapeHtml(state.activeEvent.title)}</div><div class="event-banner-name">${escapeHtml(state.activeEvent.name)}</div>${state.activeEvent.note ? `<div class="event-banner-note">${escapeHtml(state.activeEvent.note)}</div>` : ''}</div>` : ''}
    ${showSponsor ? renderSponsorOverlay() : ''}
    ${showSponsorBar ? renderSponsorBarOverlay() : ''}
    ${showLineup ? renderLineupOverlay() : ''}
    ${showPhotoLineup ? renderPhotoLineupOverlay() : ''}
    ${showStats ? renderStatsOverlay() : ''}
  </div>`;
}

function previewCompositeMarkup() {
  return ['scoreboard','event','sponsor','sponsor-bar','lineup','photo-lineup','stats'].map(layer => overlayMarkup(layer)).join('');
}

const SCOREBOARD_LAYOUTS = [
  ['compact', 'Compacto', '3 letras + placar + tempo'],
  ['expanded', 'Aberto', 'Nome completo das equipes'],
  ['card', 'Cartão', 'Escudo em destaque e nome completo'],
  ['duel', 'Duelo', 'Divisão diagonal nas cores das equipes'],
];

function renderTeamScorebug(team, key, options = {}) {
  const volleyball = state.sportData.volleyball;
  const basketball = state.sportData.basketball;
  const hasServe = state.sport === 'volleyball' && volleyball.serve === key;
  const hasPossession = state.sport === 'basketball' && basketball.possession === key;
  const name = options.expanded ? team.name.toUpperCase() : team.short.slice(0, 3).toUpperCase();
  return `<div class="scorebug-team ${hasServe || hasPossession ? 'has-possession' : ''}" style="--team-color:${safeColor(team.color)}">${options.showBadge ? scorebugBadge(team) : ''}${options.expanded ? `<i class="scorebug-dot" style="--dot-color:${safeColor(team.color)}"></i>` : ''}<span class="scorebug-team-name">${escapeHtml(name)}</span>${hasServe ? '<i class="serve-indicator" title="Saque">●</i>' : ''}${hasPossession ? '<i class="possession-arrow" title="Posse">◀</i>' : ''}${options.showSets ? `<span class="scorebug-sets">${volleyball.sets[key]}</span>` : ''}</div>`;
}

function renderSportScorebug() {
  const appearance = state.appearance || defaultAppearance();
  const layout = SCOREBOARD_LAYOUTS.some(([value]) => value === appearance.scoreboardLayout) ? appearance.scoreboardLayout : 'compact';
  const showBadge = Boolean(appearance.scoreboardShowBadge);
  const nameExpanded = layout === 'expanded' || layout === 'card';
  const volleyball = state.sportData.volleyball;
  const futsal = state.sportData.futsal;
  const basketball = state.sportData.basketball;
  const showSets = state.sport === 'volleyball';
  const home = renderTeamScorebug(state.home, 'home', { showSets, expanded: nameExpanded, showBadge });
  const away = renderTeamScorebug(state.away, 'away', { showSets, expanded: nameExpanded, showBadge });
  const periodLabel = currentSport().periods.find(([value]) => value === state.period)?.[1] || state.period;
  const extraTime = Math.max(0, Number(state.extraTime || 0));
  let status = `<div class="scorebug-status-group"><div class="scorebug-clock"><span data-clock>${clockText()}</span>${extraTime ? `<b class="scorebug-extra" style="--extra-scale:${clampNumber(appearance.extraTimeScale,60,160,100) / 100}">+${extraTime}</b>` : ''}</div><div class="scorebug-period" style="--period-scale:${clampNumber(appearance.periodScale,60,160,100) / 100};--period-font:${clampNumber(appearance.periodFont,60,160,100) / 100};--period-surface:${clampNumber(appearance.periodSurface,55,100,100) / 100}"><span>${escapeHtml(periodLabel)}</span>${extraTime ? `<small>ACRÉSCIMO +${extraTime}</small>` : '<small>PERÍODO</small>'}</div></div>`;

  if (showSets) {
    const setNumber = Number(state.period.replace('S', '')) || 1;
    const setTarget = setNumber === 5 ? 15 : 25;
    status = `<div class="scorebug-status-group"><div class="scorebug-clock scorebug-set-label"><span>${setNumber}º SET</span><small>ATÉ ${setTarget}</small></div></div>`;
  } else if (state.sport === 'basketball') {
    status += `<div class="scorebug-shot ${shotClockSeconds() <= 5 ? 'shot-warning' : ''}" data-shot-clock>${shotClockSeconds()}</div>`;
  } else if (state.sport === 'futsal') {
    status += `<div class="scorebug-fouls"><span>FALTAS</span><strong>${futsal.fouls.home} · ${futsal.fouls.away}</strong></div>`;
  }

  const now = Date.now();
  const animate = key => state.motion?.team === key && Number(state.motion.expiresAt || 0) > now ? ' score-pop' : '';
  const scoreMotionOffset = motionOffset(state.motion?.startedAt || (Number(state.motion?.expiresAt || 0) - 1100), 1100);
  const score = `<div class="scorebug-goals${animate('home')}" style="--score-motion-offset:${scoreMotionOffset}ms" data-clock-independent="home">${state.home.score}</div><div class="scorebug-divider">:</div><div class="scorebug-goals${animate('away')}" style="--score-motion-offset:${scoreMotionOffset}ms" data-clock-independent="away">${state.away.score}</div>`;
  const animation = ['assemble', 'slide', 'zoom', 'flip', 'elastic', 'glitch'].includes(appearance.scoreboardAnimation) ? appearance.scoreboardAnimation : 'assemble';
  const style = ['classic', 'glass', 'minimal', 'contrast', 'neon', 'ribbon', 'gradient'].includes(appearance.scoreboardStyle) ? appearance.scoreboardStyle : 'classic';
  const shadow = ['none', 'soft', 'strong'].includes(appearance.scoreboardShadow) ? appearance.scoreboardShadow : 'soft';
  const transitionDuration = scoreboardTransitionDuration();
  const transition = state.scoreboardTransition && Number(state.scoreboardTransition.expiresAt || 0) > now ? state.scoreboardTransition.type : '';
  const transitionClass = transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'} scorebug-animation-${animation}` : '';
  const transitionStart = state.scoreboardTransition?.startedAt || (Number(state.scoreboardTransition?.expiresAt || 0) - transitionDuration);
  const scoreboardMotionOffset = motionOffset(transitionStart, transitionDuration);
  const morphDuration = scoreboardMorphDuration();
  const morph = state.scoreboardMorph && Number(state.scoreboardMorph.expiresAt || 0) > now ? state.scoreboardMorph.direction : '';
  const morphClass = morph ? ` is-morphing morph-to-${morph}` : '';
  const morphStart = state.scoreboardMorph?.startedAt || (Number(state.scoreboardMorph?.expiresAt || 0) - morphDuration);
  const scoreboardMorphOffset = motionOffset(morphStart, morphDuration);
  const recoveryActive = state.scoreboardRecovery && Number(state.scoreboardRecovery.expiresAt || 0) > now;
  const recoveryClass = recoveryActive ? ' is-recovering' : '';
  const recoveryOffset = motionOffset(state.scoreboardRecovery?.startedAt, 520);
  const goalActive = state.goalGraphic && Number(state.goalGraphic.expiresAt || 0) > now;
  const goalAnimation = ['typewriter', 'bounce', 'sweep'].includes(appearance.goalAnimation) ? appearance.goalAnimation : 'typewriter';
  const goalTeam = goalActive ? state[state.goalGraphic.team] : null;
  const teamPhase = goalActive && (state.goalGraphic.teamShown || Number(state.goalGraphic.phaseEndsAt || 0) <= now);
  const goalExiting = goalActive && Number(state.goalGraphic.exitStartsAt || state.goalGraphic.expiresAt) <= now;
  const goalEntering = goalActive && Number(state.goalGraphic.shownAt || 0) + 420 > now;
  const goalBallIndex = goalActive ? [...String(state.goalGraphic.text || 'GOOOL')].length : 0;
  const goalTeamName = String(goalTeam?.name || '').trim();
  const goalNameLengthClass = goalTeamName.length > 26 ? ' goal-name-xlong' : goalTeamName.length > 18 ? ' goal-name-long' : '';
  const goalContent = teamPhase
    ? `<strong class="goal-team-only${goalNameLengthClass}">${escapeHtml(goalTeamName)}</strong>`
    : `<strong class="goal-word-in-scoreboard">${goalLetters(state.goalGraphic?.text)}<i class="goal-ball" style="--letter-index:${goalBallIndex}" aria-hidden="true">⚽</i></strong>`;
  const goalOffset = motionOffset(state.goalGraphic?.shownAt, 420);
  const goalPhaseOffset = motionOffset(teamPhase ? state.goalGraphic?.phaseEndsAt : state.goalGraphic?.shownAt, 1200);
  const goalExitOffset = motionOffset(state.goalGraphic?.exitStartsAt, 450);
  const goalOverlay = goalActive ? `<div class="scorebug-goal-celebration goal-phase-${teamPhase ? 'team' : 'word'} goal-animation-${goalAnimation}${goalEntering ? ' is-entering' : ''}${goalExiting ? ' is-exiting' : ''}" style="--goal-team-color:${safeColor(goalTeam?.color)};--goal-entry-offset:${goalOffset}ms;--goal-phase-offset:${goalPhaseOffset}ms;--goal-exit-offset:${goalExitOffset}ms">${goalContent}</div>` : '';
  const cardActive = state.scoreboardCard && Number(state.scoreboardCard.expiresAt || 0) > now;
  const cardTeam = cardActive ? state[state.scoreboardCard.team] : null;
  const cardExiting = cardActive && Number(state.scoreboardCard.exitStartsAt || 0) <= now;
  const cardEntering = cardActive && Number(state.scoreboardCard.shownAt || 0) + 420 > now;
  const cardType = state.scoreboardCard?.type === 'red' ? 'red' : 'yellow';
  const cardOffset = motionOffset(cardExiting ? state.scoreboardCard?.exitStartsAt : state.scoreboardCard?.shownAt, cardExiting ? 450 : 420);
  const cardOverlay = cardActive ? `<div class="scorebug-card-notice card-${cardType}${cardEntering ? ' is-entering' : ''}${cardExiting ? ' is-exiting' : ''}" style="--card-team-color:${safeColor(cardTeam?.color)};--card-motion-offset:${cardOffset}ms"><i aria-hidden="true"></i><div><small>${cardType === 'red' ? 'CARTÃO VERMELHO' : 'CARTÃO AMARELO'}</small><strong>${escapeHtml(state.scoreboardCard.name)}</strong></div><span>${escapeHtml(cardTeam?.short || '')}</span></div>` : '';
  const competition = String(state.competition || '').trim();
  const competitionLabel = competition ? `<div class="scorebug-competition" title="${escapeHtml(competition)}">${escapeHtml(competition)}</div>` : '';
  return `<div class="scorebug scorebug-${escapeHtml(state.sport)} scorebug-layout-${layout} scorebug-style-${style} scorebug-shadow-${shadow}${transitionClass}${morphClass}${recoveryClass}" style="--scoreboard-motion-duration:${transitionDuration}ms;--scoreboard-motion-offset:${scoreboardMotionOffset}ms;--scoreboard-morph-duration:${morphDuration}ms;--scoreboard-morph-offset:${scoreboardMorphOffset}ms;--scoreboard-recovery-offset:${recoveryOffset}ms" data-overlay="scoreboard" data-sport="${escapeHtml(state.sport)}" data-layout="${layout}">${home}${score}${away}${status}${goalOverlay}${cardOverlay}${competitionLabel}</div>`;
}

function renderSponsorOverlay() {
  const appearance = state.appearance || defaultAppearance();
  const sponsor = activeSponsor();
  const animation = ['slide', 'zoom', 'flip', 'fade'].includes(appearance.sponsorAnimation) ? appearance.sponsorAnimation : 'slide';
  const transition = state.sponsorTransition && Number(state.sponsorTransition.expiresAt || 0) > Date.now() ? state.sponsorTransition.type : '';
  const transitionClass = transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'} sponsor-animation-${animation}` : '';
  const sponsorDuration = sponsorMotionDuration();
  const sponsorOffset = motionOffset(state.sponsorTransition?.startedAt || (Number(state.sponsorTransition?.expiresAt || 0) - sponsorDuration), sponsorDuration);
  const motionStyle = `--sponsor-motion-duration:${sponsorDuration}ms;--sponsor-motion-offset:${sponsorOffset}ms;${overlayThemeStyle('sponsor')}`;
  if (appearance.sponsorFormat === 'logo-name') {
    const logo = sponsor.logo
      ? `<img src="${escapeHtml(sponsor.logo)}" alt="Logo de ${escapeHtml(sponsor.name)}">`
      : `<span>${escapeHtml(sponsor.name.slice(0, 2).toUpperCase())}</span>`;
    return `<div class="sponsor-banner sponsor-logo-name sponsor-style-${escapeHtml(appearance.sponsorStyle || 'boxed')}${transitionClass}" style="${motionStyle}" data-overlay="sponsor" data-format="logo-name"><div class="sponsor-logo-box">${logo}</div><div><small>OFERECIMENTO</small><strong>${escapeHtml(sponsor.name)}</strong></div></div>`;
  }
  if (appearance.sponsorFormat === 'banner' || appearance.sponsorFormat === 'banner-name') {
    const content = sponsor.banner
      ? `<img src="${escapeHtml(sponsor.banner)}" alt="Banner do patrocinador ${escapeHtml(sponsor.name)}">`
      : `<div class="sponsor-banner-placeholder"><small>OFERECIMENTO</small><strong>${escapeHtml(sponsor.name)}</strong><span>ARTE 16:9</span></div>`;
    const name = appearance.sponsorFormat === 'banner-name' ? `<div class="sponsor-banner-name"><small>OFERECIMENTO</small><strong>${escapeHtml(sponsor.name)}</strong></div>` : '';
    return `<div class="sponsor-banner sponsor-banner-graphic sponsor-style-${escapeHtml(appearance.sponsorStyle || 'boxed')}${appearance.sponsorFormat === 'banner-name' ? ' sponsor-banner-with-name' : ''}${transitionClass}" style="${motionStyle}" data-overlay="sponsor" data-format="${escapeHtml(appearance.sponsorFormat)}">${content}${name}</div>`;
  }
  return `<div class="sponsor-banner sponsor-banner-text sponsor-style-${escapeHtml(appearance.sponsorStyle || 'boxed')}${transitionClass}" style="${motionStyle}" data-overlay="sponsor" data-format="text"><small>OFERECIMENTO</small><strong>${escapeHtml(sponsor.name)}</strong></div>`;
}

function defaultStats() {
  const side = () => ({ shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, offsides: 0, saves: 0, possession: 50 });
  return { home: side(), away: side() };
}

function normalizedStats(value) {
  const base = defaultStats();
  for (const side of ['home', 'away']) {
    for (const key of Object.keys(base[side])) base[side][key] = clampNumber(value?.[side]?.[key], 0, key === 'possession' ? 100 : 999, base[side][key]);
  }
  base.away.possession = 100 - base.home.possession;
  return base;
}

function normalizedStatsMetrics(value) {
  const valid = STATS_METRICS.map(item => item.key);
  const list = (Array.isArray(value) ? value : []).filter((key, index, all) => valid.includes(key) && all.indexOf(key) === index).slice(0, 6);
  return list.length ? list : ['possession', 'shots', 'shotsOnTarget', 'corners', 'fouls'];
}

function statsMotionDuration() {
  return 650;
}

function derivedStats() {
  const totals = { home: { goals: Number(state.home.score || 0), yellow: 0, red: 0, subs: 0 }, away: { goals: Number(state.away.score || 0), yellow: 0, red: 0, subs: 0 } };
  const timeline = [];
  for (const event of [...(state.events || [])].reverse()) {
    const side = event.team === state.home.short ? 'home' : event.team === state.away.short ? 'away' : '';
    const title = String(event.title || '').toLocaleLowerCase('pt-BR');
    const kind = /go+l|cesta|ponto/.test(title) ? 'goal' : /amarelo/.test(title) ? 'yellow' : /vermelho/.test(title) ? 'red' : /substitui/.test(title) ? 'sub' : '';
    if (!side || !kind) continue;
    if (kind === 'yellow') totals[side].yellow += 1;
    else if (kind === 'red') totals[side].red += 1;
    else if (kind === 'sub') totals[side].subs += 1;
    timeline.push({ side, kind, minute: String(event.minute || ''), name: String(event.name || ''), note: String(event.note || '') });
  }
  return { totals, timeline };
}

function statsValue(side, key, derived) {
  if (key === 'possession') return side === 'home' ? state.stats.home.possession : 100 - state.stats.home.possession;
  const metric = STATS_METRICS.find(item => item.key === key);
  return metric?.derived ? Number(derived.totals[side][key] || 0) : Number(state.stats[side][key] || 0);
}

function putStatsOnAir(draft) {
  const now = Date.now();
  const duration = clampNumber(draft.appearance?.statsDuration, 0, 60, 12);
  draft.visible.stats = true;
  draft.statsExpiresAt = duration ? now + duration * 1000 : 0;
  draft.statsTransition = { type: 'enter', startedAt: now, expiresAt: now + statsMotionDuration() };
}

function statsIcon(kind) {
  return kind === 'goal' ? '<i class="stats-icon stats-icon-goal"></i>' : kind === 'yellow' ? '<i class="stats-icon stats-icon-yellow"></i>' : kind === 'red' ? '<i class="stats-icon stats-icon-red"></i>' : '<i class="stats-icon stats-icon-sub">⇄</i>';
}

function renderStatsOverlay() {
  const appearance = state.appearance || defaultAppearance();
  const view = ['compare', 'timeline', 'player'].includes(state.statsView) ? state.statsView : 'compare';
  const derived = derivedStats();
  const transition = state.statsTransition && Number(state.statsTransition.expiresAt || 0) > Date.now() ? state.statsTransition.type : '';
  const animation = OVERLAY_STYLE_OPTIONS.statsAnimation.some(([value]) => value === appearance.statsAnimation) ? appearance.statsAnimation : 'rise';
  const style = OVERLAY_STYLE_OPTIONS.statsStyle.some(([value]) => value === appearance.statsStyle) ? appearance.statsStyle : 'broadcast';
  const offset = motionOffset(state.statsTransition?.startedAt || (Number(state.statsTransition?.expiresAt || 0) - statsMotionDuration()), statsMotionDuration());
  const vars = `--stats-x:${clampNumber(appearance.statsX, 0, 100, 30)}%;--stats-y:${clampNumber(appearance.statsY, 0, 100, 56)}%;--stats-scale:${clampNumber(appearance.statsScale, 60, 180, 100) / 100};--stats-font-scale:${clampNumber(appearance.statsFont, 60, 180, 100) / 100};--stats-font:${escapeHtml(appearanceFont('statsTypeface').stack)};--stats-motion-offset:${offset}ms;--stats-home:${safeColor(state.home.color)};--stats-away:${safeColor(state.away.color)}`;
  const head = `<header class="stats-head"><div class="stats-team">${badge(state.home)}<strong>${escapeHtml(state.home.short)}</strong></div><b class="stats-score">${state.home.score} × ${state.away.score}</b><div class="stats-team stats-team-away"><strong>${escapeHtml(state.away.short)}</strong>${badge(state.away)}</div></header>`;
  let title = 'ESTATÍSTICAS DA PARTIDA';
  let body = '';
  if (view === 'compare') {
    body = `<div class="stats-rows">${normalizedStatsMetrics(state.statsMetrics).map((key, index) => {
      const metric = STATS_METRICS.find(item => item.key === key);
      const home = statsValue('home', key, derived);
      const away = statsValue('away', key, derived);
      const total = home + away;
      const homeShare = total ? Math.round((home / total) * 100) : 50;
      return `<div class="stats-row" style="--row:${index}"><b>${home}${metric.suffix || ''}</b><span>${escapeHtml(metric.label)}</span><b>${away}${metric.suffix || ''}</b><div class="stats-bar"><i class="stats-bar-home" style="width:${homeShare}%"></i><i class="stats-bar-away" style="width:${100 - homeShare}%"></i></div></div>`;
    }).join('')}</div>`;
  } else if (view === 'timeline') {
    title = 'GOLS E CARTÕES';
    const column = side => {
      const items = derived.timeline.filter(item => item.side === side && item.kind !== 'sub').slice(-6);
      return `<div class="stats-column stats-column-${side}">${items.length ? items.map((item, index) => `<div class="stats-event" style="--row:${index}">${statsIcon(item.kind)}<span>${escapeHtml(item.minute)}</span><strong>${escapeHtml(item.name || '—')}</strong></div>`).join('') : '<div class="stats-empty">Sem registros</div>'}</div>`;
    };
    body = `<div class="stats-columns">${column('home')}${column('away')}</div>`;
  } else {
    title = 'DESTAQUE DO ATLETA';
    const side = state.statsPlayer?.team === 'away' ? 'away' : 'home';
    const name = String(state.statsPlayer?.name || '').trim();
    const catalogTeam = teamCatalog.find(item => item.id === state.selectedTeams?.[side]);
    const athlete = (catalogTeam?.athletes || []).find(item => String(item.name).toLowerCase() === name.toLowerCase()) || rosterPlayers(state[side].roster).find(item => String(item.name).toLowerCase() === name.toLowerCase()) || {};
    const mine = derived.timeline.filter(item => item.side === side && String(item.name).toLowerCase() === name.toLowerCase());
    const count = kind => mine.filter(item => item.kind === kind).length;
    body = `<div class="stats-player" style="--stats-side:var(--stats-${side})"><div class="stats-player-photo">${athlete.photo ? `<img src="${escapeHtml(athlete.photo)}" alt="Foto de ${escapeHtml(name)}">` : `<span>${escapeHtml(athlete.number || '—')}</span>`}</div><div class="stats-player-copy"><small>${escapeHtml(state[side].name)}${athlete.position ? ` · ${escapeHtml(athlete.position)}` : ''}</small><h3>${escapeHtml(name || 'Selecione um atleta')}</h3><div class="stats-chips"><span>${count('goal')}<small>Gols</small></span><span>${count('yellow')}<small>Amarelos</small></span><span>${count('red')}<small>Vermelhos</small></span></div>${state.statsPlayer?.note ? `<p>${escapeHtml(state.statsPlayer.note)}</p>` : ''}</div></div>`;
  }
  return `<section class="stats-overlay stats-view-${view} stats-style-${style} stats-anim-${animation}${transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'}` : ''}" style="${vars}" data-overlay="stats"><div class="stats-title">${title}</div>${view === 'player' ? '' : head}${body}</section>`;
}

function renderSponsorBarOverlay() {
  const appearance = state.appearance || defaultAppearance();
  const sponsor = activeSponsorBar();
  const transition = state.sponsorBarTransition && Number(state.sponsorBarTransition.expiresAt || 0) > Date.now() ? state.sponsorBarTransition.type : '';
  const transitionStyle = ['fade', 'slide', 'zoom', 'flip', 'elastic'].includes(appearance.sponsorBarTransition) ? appearance.sponsorBarTransition : 'fade';
  const transitionClass = transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'} sponsor-animation-${transitionStyle}` : '';
  const duration = sponsorBarMotionDuration();
  const offset = motionOffset(state.sponsorBarTransition?.startedAt || (Number(state.sponsorBarTransition?.expiresAt || 0) - duration), duration);
  const videoMode = state.sponsorBarMode === 'video' && state.sponsorBarVideo;
  const asset = sponsor.asset;
  const media = videoMode
    ? `<video class="sponsor-wide-media sponsor-fit-${escapeHtml(appearance.sponsorBarFit || 'cover')}" src="${escapeHtml(state.sponsorBarVideo)}" autoplay muted loop playsinline preload="auto" aria-label="Vídeo da barra de patrocinadores"></video>`
    : asset ? `<img class="sponsor-wide-media sponsor-fit-${escapeHtml(appearance.sponsorBarFit || 'cover')}" src="${escapeHtml(asset)}" alt="Banner de patrocinador">` : `<div class="sponsor-wide-placeholder"><strong>BARRA DE PATROCINADORES</strong><small>1500 × 200</small></div>`;
  const borderStyle = OVERLAY_STYLE_OPTIONS.sponsorBarBorder.some(([value]) => value === appearance.sponsorBarBorder) ? appearance.sponsorBarBorder : 'thin';
  const shadowStyle = OVERLAY_STYLE_OPTIONS.sponsorBarShadow.some(([value]) => value === appearance.sponsorBarShadow) ? appearance.sponsorBarShadow : 'none';
  return `<div class="sponsor-wide-bar sponsor-style-${escapeHtml(appearance.sponsorStyle || 'boxed')} sponsor-bar-border-${borderStyle} sponsor-bar-shadow-${shadowStyle}${transitionClass}" style="--sponsor-motion-duration:${duration}ms;--sponsor-motion-offset:${offset}ms;--sponsor-bar-scale:${clampNumber(appearance.sponsorBarScale, 60, 180, 100) / 100};--sponsor-bar-x:${clampNumber(appearance.sponsorBarX, 0, 100, 50)}%;--sponsor-bar-y:${clampNumber(appearance.sponsorBarY, 0, 100, 91)}%;--sponsor-bar-opacity:${clampNumber(appearance.sponsorBarOpacity, 20, 100, 100) / 100};--sponsor-bar-radius:${clampNumber(appearance.sponsorBarRadius, 0, 24, 0)}px;--sponsor-bar-background:${safeColor(appearance.sponsorBarBackground, '#08090d')};${overlayThemeStyle('sponsorBar')}" data-overlay="sponsor-bar">${media}</div>`;
}

let overlayTable = { rows: [], championship: null, loadedAt: 0, loading: false };
const SAMPLE_TABLE = [['Equipe A', 'EQA', 9, 3, 2], ['Equipe B', 'EQB', 7, 3, 1], ['Equipe C', 'EQC', 4, 3, 0], ['Equipe D', 'EQD', 3, 3, -1], ['Equipe E', 'EQE', 1, 3, -2], ['Equipe F', 'EQF', 0, 3, -3]].map(([name, short, points, played, gd], index) => ({ position: index + 1, name, short, points, played, gd, won: Math.floor(points / 3), drawn: points % 3, lost: played - Math.floor(points / 3) - (points % 3), gf: 0, ga: 0 }));

async function loadOverlayTable() {
  if (overlayTable.loading || Date.now() - overlayTable.loadedAt < 20000) return;
  overlayTable.loading = true;
  overlayTable.loadedAt = Date.now();
  try {
    const response = await fetch(`/api/public/room-table?room=${encodeURIComponent(ROOM_ID)}`, { cache: 'no-store' });
    if (response.ok) { const data = await response.json(); overlayTable.rows = data.rows || []; overlayTable.championship = data.championship || null; }
  } catch {}
  overlayTable.loading = false;
}

function builderTokenValues() {
  const sport = currentSport();
  const table = overlayTable.rows.length || !isAdminPanel ? overlayTable.rows : SAMPLE_TABLE;
  const tableValues = {};
  table.slice(0, 16).forEach((row, index) => { for (const key of ['name', 'short', 'points', 'played', 'won', 'drawn', 'lost', 'gf', 'ga', 'gd', 'position']) tableValues[`table.${index + 1}.${key}`] = row[key]; });
  return {
    ...tableValues, 'champ.name': overlayTable.championship?.name || (isAdminPanel ? 'Campeonato' : ''),
    'home.name': state.home.name, 'home.short': state.home.short, 'home.score': state.home.score,
    'away.name': state.away.name, 'away.short': state.away.short, 'away.score': state.away.score,
    clock: clockText(), period: (sport.periods || []).find(([value]) => value === state.period)?.[1] || '',
    competition: state.competition, sponsor: activeSponsor()?.name || '', time: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
  };
}

function resolveBuilderText(template, values = builderTokenValues()) {
  return String(template ?? '').replace(/\{([a-z0-9.]+)\}/g, (match, key) => (key in values ? String(values[key] ?? '') : match));
}

function resolveBuilderSource(src) {
  if (src === 'token:home.logo') return state.home.logo || '';
  if (src === 'token:away.logo') return state.away.logo || '';
  if (src === 'token:sponsor') { const sponsor = activeSponsor(); return sponsor?.logo || sponsor?.banner || ''; }
  return src || '';
}

// Duração total da entrada/saída: o maior (atraso + duração) entre os elementos animados.
function customTransitionDuration(item) {
  const spans = (item.elements || []).filter(el => el.visible && (el.animIn !== 'none' || el.animOut !== 'same')).map(el => el.delay + el.duration);
  return Math.max(400, ...spans) + 120;
}

function builderElementStyle(el, item, index) {
  const unit = value => `${(value / item.width * 100).toFixed(4)}cqw`;
  const parts = [`left:${el.x}%`, `top:${el.y}%`, `width:${el.w}%`, `height:${el.h}%`, `rotate:${el.rotation}deg`, `--cel-o:${el.opacity / 100}`, `opacity:${el.opacity / 100}`, `z-index:${index + 1}`, `--cel-delay:${el.delay}ms`, `--cel-dur:${el.duration}ms`];
  if (el.fill) {
    const alpha = el.fillOpacity;
    const paint = color => (alpha < 100 ? `color-mix(in srgb, ${color} ${alpha}%, transparent)` : color);
    parts.push(el.fill2 ? `background:linear-gradient(${el.fillAngle}deg, ${paint(el.fill)}, ${paint(el.fill2)})` : `background:${paint(el.fill)}`);
  }
  if (el.borderWidth) parts.push(`border:${unit(el.borderWidth)} solid ${el.borderColor}`);
  parts.push(`border-radius:${el.shape === 'circle' && el.type === 'shape' ? '50%' : unit(el.radius)}`);
  if (el.shadow === 'soft') parts.push(`box-shadow:0 ${unit(6)} ${unit(18)} rgba(0,0,0,.35)`);
  if (el.shadow === 'strong') parts.push(`box-shadow:0 ${unit(10)} ${unit(32)} rgba(0,0,0,.65)`);
  return parts.join(';');
}

function builderElementMarkup(el, item, index, values, editor) {
  const editorAttrs = editor ? ` data-el-id="${escapeHtml(el.id)}"` : '';
  const classes = `cel cel-${el.type} cel-in-${el.animIn} cel-out-${el.animOut === 'same' ? el.animIn : el.animOut}${el.locked && editor ? ' is-locked' : ''}`;
  const unit = value => `${(value / item.width * 100).toFixed(4)}cqw`;
  let inner = '';
  if (el.type === 'text') {
    const template = el.text;
    const font = (TYPEFACES[el.font === 'global' ? state.typeface : el.font] || TYPEFACES.rajdhani).stack;
    const justify = { left: 'flex-start', center: 'center', right: 'flex-end' }[el.align];
    const alignItems = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[el.valign];
    const style = `justify-content:${justify};align-items:${alignItems};text-align:${el.align};font-family:${escapeHtml(font)};font-size:${unit(el.size)};font-weight:${el.weight};color:${el.color};letter-spacing:${el.spacing / 100}em;line-height:${el.lineHeight / 100};text-transform:${el.transform};font-style:${el.italic ? 'italic' : 'normal'};padding:${unit(el.padding)}`;
    const dynamic = template.includes('{') ? ` data-cel-text="${escapeHtml(template)}"` : '';
    inner = `<div class="cel-text${el.marquee ? ' is-marquee' : ''}" style="${style};--marquee-dur:${el.marqueeSpeed}s"><span${dynamic}>${escapeHtml(resolveBuilderText(template, values))}</span></div>`;
  } else if (el.type === 'image' || el.type === 'video') {
    const src = resolveBuilderSource(el.src);
    const dynamicSrc = el.src.startsWith('token:') ? ` data-cel-src="${escapeHtml(el.src)}"` : '';
    if (!src) inner = editor ? `<div class="cel-empty">${{ 'token:home.logo': 'ESCUDO MANDANTE', 'token:away.logo': 'ESCUDO VISITANTE', 'token:sponsor': 'LOGO DO PATROCINADOR' }[el.src] || (el.type === 'video' ? 'VÍDEO' : 'IMAGEM')}</div>` : '';
    else inner = el.type === 'video'
      ? `<video src="${escapeHtml(src)}" style="object-fit:${el.fit}" autoplay muted loop playsinline preload="auto"></video>`
      : `<img src="${escapeHtml(src)}" style="object-fit:${el.fit}" alt=""${dynamicSrc}>`;
  }
  return `<div class="${classes}"${editorAttrs} style="${builderElementStyle(el, item, index)}">${inner}</div>`;
}

function customOverlayMarkup(item, preview = false, options = {}) {
  if (!item) return '<div class="broadcast-layer custom-overlay-output"></div>';
  const editor = Boolean(options.editor);
  const transition = options.animate || (item.transition && Number(item.transition.expiresAt || 0) > Date.now() ? item.transition.type : '');
  if (!preview && !item.visible && transition !== 'exit') return '<div class="broadcast-layer custom-overlay-output"></div>';
  const values = builderTokenValues();
  const elements = (item.elements || []).map((el, index) => (el.visible || editor ? { el, index } : null)).filter(Boolean);
  const content = elements.map(({ el, index }) => (el.visible ? builderElementMarkup(el, item, index, values, editor) : '')).join('');
  return `<div class="broadcast-layer custom-overlay-output"><section class="custom-overlay${transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'}` : ''}" style="${item.canvasBg ? `background:${item.canvasBg};` : ''}" data-overlay="custom">${content}</section></div>`;
}

function renderCustomOverlay() { return customOverlayMarkup(selectedCustomOverlay()); }

function renderLineupOverlay() {
  const team = state[state.lineupTeam] || state.home;
  const appearance = state.appearance || defaultAppearance();
  const players = team.roster.split('\n').map(line => line.trim()).filter(Boolean).slice(0, currentSport().teamSize);
  const transition = state.lineupTransition && Number(state.lineupTransition.expiresAt || 0) > Date.now() ? state.lineupTransition.type : '';
  const lineupOffset = motionOffset(state.lineupTransition?.startedAt || (Number(state.lineupTransition?.expiresAt || 0) - 600), 600);
  return `<div class="lineup-banner lineup-style-${escapeHtml(appearance.lineupStyle || 'panel')}${transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'}` : ''}" style="--lineup-motion-offset:${lineupOffset}ms" data-overlay="lineup"><div class="lineup-banner-title">${escapeHtml(team.name.toUpperCase())} · ESCALAÇÃO</div>${players.map((player, index) => {
    const [, number = '', name = player] = player.match(/^(\d+)\s+(.+)$/) || [];
    return `<div class="lineup-player" style="--player-index:${index}"><span>${escapeHtml(number)}</span>${escapeHtml(name)}</div>`;
  }).join('')}</div>`;
}

function renderPhotoLineupOverlay() {
  const matchTeam = state[state.lineupTeam] || state.home;
  const team = activeLineupTeam();
  const { starters, reserves } = lineupGroups(team);
  const stage = ['individual', 'starters', 'reserves', 'formation'].includes(state.photoLineupStage) ? state.photoLineupStage : 'starters';
  const transition = state.photoLineupTransition && Number(state.photoLineupTransition.expiresAt || 0) > Date.now() ? state.photoLineupTransition.type : '';
  const lineupOffset = motionOffset(state.photoLineupTransition?.startedAt || (Number(state.photoLineupTransition?.expiresAt || 0) - 900), 900);
  const stageActive = state.photoLineupStageTransition && Number(state.photoLineupStageTransition.expiresAt || 0) > Date.now();
  const stageOffset = motionOffset(state.photoLineupStageTransition?.startedAt, 850);
  const playerDirection = stageActive && stage === 'individual' ? state.photoLineupStageTransition?.playerDirection : '';
  const lineupSponsor = activeSponsor();
  const initials = name => String(name || 'AT').split(/\s+/).filter(Boolean).slice(0, 2).map(part => part[0]).join('').toUpperCase();
  const athleteImage = (athlete, className = '') => athlete?.photo
    ? `<img class="${className}" src="${escapeHtml(athlete.photo)}" alt="Foto de ${escapeHtml(athlete.name)}">`
    : `<span class="photo-player-fallback">${escapeHtml(athlete?.number || initials(athlete?.name))}</span>`;
  const lineupSponsorAsset = lineupSponsor?.lineupMedia || lineupSponsor?.wideAsset || lineupSponsor?.banner || lineupSponsor?.logo;
  const lineupSponsorMedia = lineupSponsor?.lineupMedia && lineupSponsor.lineupMediaType === 'video'
    ? `<video src="${escapeHtml(lineupSponsor.lineupMedia)}" autoplay muted loop playsinline preload="auto" aria-label="Banner do patrocinador"></video>`
    : lineupSponsorAsset ? `<img src="${escapeHtml(lineupSponsorAsset)}" alt="Banner do patrocinador">` : '<div class="photo-lineup-sponsor-placeholder">BANNER 1500 × 200</div>';
  const sponsorFooter = state.photoLineupShowSponsors ? `<div class="photo-lineup-sponsors"><div class="photo-lineup-sponsor">${lineupSponsorMedia}</div></div>` : '';
  const lineupAnimation = OVERLAY_STYLE_OPTIONS.photoLineupAnimation.some(([value]) => value === state.appearance?.photoLineupAnimation) ? state.appearance.photoLineupAnimation : 'slide';
  const labels = { individual: '', starters: 'TITULARES + COMISSÃO', reserves: 'BANCO DE RESERVAS', formation: 'ESQUEMA TÁTICO' };
  let content = '';
  if (stage === 'individual') {
    const index = Math.min(Math.max(0, Number(state.photoLineupPlayerIndex || 0)), Math.max(0, starters.length - 1));
    const player = starters[index] || { name: 'Atleta', number: '—', position: '' };
    content = `<article class="lineup-spotlight"><div class="lineup-spotlight-photo">${athleteImage(player)}</div><div class="lineup-spotlight-number">${escapeHtml(player.number || String(index + 1))}</div><div class="lineup-spotlight-copy"><small>${escapeHtml(player.position || 'TITULAR')}</small><h3>${escapeHtml(player.name || `Atleta ${index + 1}`)}</h3>${player.height ? `<p>${escapeHtml(String(player.height).replace('.', ','))} m</p>` : ''}</div></article>`;
  } else if (stage === 'starters') {
    const staff = normalizedStaff(team);
    const headCoach = staff.find(member => member.role === 'Treinador') || staff[0];
    const supportStaff = staff.filter(member => member.id !== headCoach?.id);
    content = `<div class="starters-with-staff"><div class="photo-lineup-grid">${starters.map((player, index) => `<article class="photo-player" style="--player-index:${index}"><div class="photo-player-image">${athleteImage(player)}<b>${escapeHtml(player.number || String(index + 1))}</b></div><div class="photo-player-copy"><strong>${escapeHtml(player.name || `Atleta ${index + 1}`)}</strong><small>${escapeHtml(player.position || 'TITULAR')}</small></div></article>`).join('')}</div><div class="lineup-staff-strip">${supportStaff.map((member, index) => `<span style="--player-index:${index}"><small>${escapeHtml(member.role)}</small><strong>${escapeHtml(member.name || member.role)}</strong></span>`).join('')}${headCoach ? `<article class="head-coach-highlight"><div class="coach-photo">${headCoach.photo ? `<img src="${escapeHtml(headCoach.photo)}" alt="Foto de ${escapeHtml(headCoach.name)}">` : `<span>${escapeHtml(initials(headCoach.name))}</span>`}</div><div><small>TÉCNICO</small><h3>${escapeHtml(headCoach.name || 'Treinador')}</h3><p>${escapeHtml(matchTeam.name)}</p></div></article>` : ''}</div></div>`;
  } else if (stage === 'reserves') {
    content = reserves.length ? `<div class="bench-list">${reserves.map((player, index) => `<article class="bench-player" style="--player-index:${index}"><div>${athleteImage(player)}</div><b>${escapeHtml(player.number || '—')}</b><span><strong>${escapeHtml(player.name || `Reserva ${index + 1}`)}</strong><small>${escapeHtml(player.position || 'RESERVA')}</small></span></article>`).join('')}</div>` : '<div class="lineup-empty-stage"><strong>RESERVAS</strong><span>Nenhum atleta foi marcado como reserva.</span></div>';
  } else {
    const squad = effectiveSquad(team);
    const formation = FORMATIONS[squad?.formation] ? squad.formation : FORMATIONS[team.formation] ? team.formation : '4-3-3';
    const points = FORMATIONS[formation];
    const formationPhoto = state.appearance?.photoLineupFormationMark === 'photo';
    const photoSize = clampNumber(state.appearance?.photoLineupFormationPhotoSize, 60, 200, 100) / 100;
    content = `<div class="tactical-board" style="--formation-photo:${photoSize}"><div class="tactical-pitch"><i class="pitch-half"></i><i class="pitch-circle"></i><i class="pitch-spot"></i>${starters.map((player, index) => { const point = squad?.positions?.[player.id] || points[index] || [50, 50]; return `<article class="tactical-player" data-player-id="${escapeHtml(player.id || '')}" data-squad-team="${escapeHtml(squadKey(team))}" style="--player-x:${point[0]}%;--player-y:${point[1]}%;--player-index:${index}">${formationPhoto && player.photo ? `<b class="has-photo"><img src="${escapeHtml(player.photo)}" alt="Foto de ${escapeHtml(player.name)}"></b>` : `<b>${escapeHtml(player.number || String(index + 1))}</b>`}<span><strong>${escapeHtml(String(player.name || `Atleta ${index + 1}`).split(/\s+/).slice(-1)[0])}</strong><small>${escapeHtml(player.position || 'TIT')}</small></span></article>`; }).join('')}</div><aside><small>FORMAÇÃO</small><strong>${escapeHtml(formation)}</strong><span>${escapeHtml(matchTeam.short)} · ${starters.length} TITULARES</span>${(team.sponsors || []).some(item => item.name) ? `<em>APOIO · ${escapeHtml(team.sponsors.filter(item => item.name).map(item => item.name).join(' · '))}</em>` : ''}</aside></div>`;
  }
  const lineupLayout = OVERLAY_STYLE_OPTIONS.photoLineupLayout.some(([value]) => value === state.appearance?.photoLineupLayout) ? state.appearance.photoLineupLayout : 'classic';
  const lineupLook = lineupLayout === 'classic' ? `photo-lineup-style-${escapeHtml(state.appearance?.photoLineupStyle || 'editorial')} photo-lineup-anim-${lineupAnimation}` : `photo-lineup-layout-${lineupLayout}`;
  return `<section class="photo-lineup ${lineupLook} photo-lineup-stage-${escapeHtml(stage)}${transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'}` : ''}${stageActive ? ' is-stage-changing' : ''}${playerDirection ? ` is-player-${escapeHtml(playerDirection)}` : ''}" style="--photo-lineup-motion-offset:${lineupOffset}ms;--photo-lineup-stage-offset:${stageOffset}ms;--photo-team-color:${safeColor(matchTeam.color)};${team?.color2 ? `--photo-team-color2:${safeColor(team.color2)};` : ''}" data-overlay="photo-lineup" data-stage="${escapeHtml(stage)}"><header class="photo-lineup-head"><div class="photo-lineup-team-mark">${matchTeam.logo ? `<img src="${escapeHtml(matchTeam.logo)}" alt="Escudo ${escapeHtml(matchTeam.name)}">` : escapeHtml(matchTeam.short)}</div><div><h2>${escapeHtml(matchTeam.name.toUpperCase())}</h2></div>${labels[stage] ? `<span>${escapeHtml(labels[stage])}</span>` : ''}</header><div class="photo-lineup-body">${content}</div>${sponsorFooter}</section>`;
}

function writeLocal() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch {}
}

function schedulePush(immediate = false) {
  clearTimeout(pushTimeout);
  pushTimeout = setTimeout(async () => {
    syncStatus = 'syncing';
    updateSyncIndicator();
    try {
      const response = await fetch(apiUrl('/api/state'), {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(state),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      syncStatus = 'online';
      consecutiveFailures = 0;
      lastSyncAt = Date.now();
    } catch (error) {
      consecutiveFailures += 1;
      syncStatus = 'offline';
      console.warn('Falha ao sincronizar o placar:', error?.message || error);
    }
    updateSyncIndicator();
  }, immediate ? 0 : 90);
}

function commit(mutator, options = {}) {
  const previousAppearance = appearanceFingerprint();
  if (options.backup !== false) {
    const snapshot = structuredClone(state);
    delete snapshot._backup;
    state._backup = snapshot;
  }
  mutator(state);
  if (appearanceFingerprint() !== previousAppearance) {
    teamCatalogState.globalAppearance = appearanceSnapshot(state);
    scheduleTeamCatalogPush(options.immediate);
  }
  state.updatedAt = Math.max(Date.now(), Number(state.updatedAt || 0) + 1);
  writeLocal();
  channel?.postMessage({ type: 'state', state });
  schedulePush(options.immediate);
  render();
}

function applyCatalogTeam(draft, side, team) {
  if (!team || !['home', 'away'].includes(side)) return;
  const score = Number(draft[side]?.score || 0);
  draft[side] = {
    ...draft[side], name: team.name, short: team.short, color: team.color,
    logo: team.logo, roster: teamRosterText(team), score,
  };
  draft.selectedTeams = { ...(draft.selectedTeams || {}), [side]: team.id };
}

function syncCatalogTeamToMatch(draft, team) {
  for (const side of ['home', 'away']) {
    if (draft.selectedTeams?.[side] === team.id) applyCatalogTeam(draft, side, team);
  }
}

function writeTeamCatalogLocal() {
  try { localStorage.setItem(TEAM_CATALOG_KEY, JSON.stringify(teamCatalogState)); } catch {}
}

function scheduleTeamCatalogPush(immediate = false) {
  teamCatalogState = { updatedAt: Math.max(Date.now(), Number(teamCatalogState.updatedAt || 0) + 1), teams: teamCatalog, championshipThemes: teamCatalogState.championshipThemes || {}, globalAppearance: teamCatalogState.globalAppearance || appearanceSnapshot(state) };
  writeTeamCatalogLocal();
  clearTimeout(teamCatalogPushTimeout);
  teamCatalogPushTimeout = setTimeout(async () => {
    try {
      const response = await fetch('/api/teams', {
        method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ ...teamCatalogState, baseUpdatedAt: teamCatalogServerUpdatedAt }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 409) {
        teamCatalogServerUpdatedAt = Number(data.catalog?.updatedAt || teamCatalogServerUpdatedAt);
        toast('Outro administrador alterou a configuração global. Revise e salve novamente.');
        return;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      teamCatalogServerUpdatedAt = Number(data.updatedAt || teamCatalogState.updatedAt || 0);
      syncStatus = 'online';
      lastSyncAt = Date.now();
    } catch (error) {
      syncStatus = 'offline';
      console.warn('Falha ao sincronizar o cadastro de times:', error?.message || error);
    }
    updateSyncIndicator();
  }, immediate ? 0 : 140);
}

function commitTeamCatalog(mutator, options = {}) {
  mutator(teamCatalog);
  teamCatalog = normalizeTeamCatalog(teamCatalog);
  teamCatalogState.teams = teamCatalog;
  scheduleTeamCatalogPush(options.immediate);
  render();
}

function persistChampionshipTheme() {
  teamCatalogState.globalAppearance = appearanceSnapshot(state);
  scheduleTeamCatalogPush();
}

async function initializeTeamCatalog() {
  if (isTeamPortal) return;
  try {
    const response = await fetch(`/api/teams?ts=${Date.now()}`, { cache: 'no-store' });
    const remote = response.ok ? await response.json() : null;
    if (remote?.teams?.length && Number(remote.updatedAt || 0) >= Number(teamCatalogState.updatedAt || 0)) {
      teamCatalogState = { updatedAt: Number(remote.updatedAt || 0), teams: normalizeTeamCatalog(remote.teams), championshipThemes: remote.championshipThemes || {}, globalAppearance: remote.globalAppearance || null };
      teamCatalogServerUpdatedAt = teamCatalogState.updatedAt;
      teamCatalog = teamCatalogState.teams;
      if (!teamCatalog.some(team => team.id === selectedCatalogTeamId)) selectedCatalogTeamId = teamCatalog[0]?.id;
      writeTeamCatalogLocal();
      if (teamCatalogState.globalAppearance) applyGlobalAppearance(state, teamCatalogState.globalAppearance);
      else if (!isOutput && !isPreview) { teamCatalogState.globalAppearance = appearanceSnapshot(state); scheduleTeamCatalogPush(true); }
      render();
    } else if (!isOutput && !isPreview) {
      scheduleTeamCatalogPush(true);
    }
  } catch {
    if (!isOutput && !isPreview) scheduleTeamCatalogPush(true);
  }
}

async function pollTeamCatalog() {
  if (isTeamPortal) return;
  try {
    const response = await fetch(`/api/teams?ts=${Date.now()}`, { cache: 'no-store' });
    const remote = response.ok ? await response.json() : null;
    if (!remote?.teams?.length || Number(remote.updatedAt || 0) <= Number(teamCatalogState.updatedAt || 0)) return;
    teamCatalogState = { updatedAt: Number(remote.updatedAt), teams: normalizeTeamCatalog(remote.teams), championshipThemes: remote.championshipThemes || {}, globalAppearance: remote.globalAppearance || null };
    teamCatalogServerUpdatedAt = teamCatalogState.updatedAt;
    teamCatalog = teamCatalogState.teams;
    if (teamCatalogState.globalAppearance) applyGlobalAppearance(state, teamCatalogState.globalAppearance);
    writeTeamCatalogLocal();
    if (isOutput || isPreview) { render(); return; }
    commit(draft => {
      for (const side of ['home', 'away']) {
        const team = teamCatalog.find(item => item.id === draft.selectedTeams?.[side]);
        if (team) applyCatalogTeam(draft, side, team);
      }
    }, { backup: false, immediate: true });
  } catch {}
}

async function loadTeamLoginTeams() {
  try {
    const response = await fetch('/api/teams', { cache: 'no-store' });
    const data = response.ok ? await response.json() : { teams: [] };
    teamLoginTeams = Array.isArray(data.teams) ? data.teams.map(team => ({ id: team.id, name: team.name })) : [];
  } catch { teamLoginTeams = []; }
}

async function checkTeamSession() {
  if (!isTeamPortal) return;
  await loadTeamLoginTeams();
  try {
    const response = await fetch('/api/auth/team/session', { cache: 'no-store' });
    const data = response.ok ? await response.json() : { authenticated: false };
    if (data.authenticated) {
      teamSession = { status: 'authenticated', teamId: data.teamId, teamName: data.teamName, error: '' };
      render();
      initializeTeamPortal();
      return;
    }
    teamSession = { status: 'login', teamId: null, teamName: null, error: '' };
  } catch {
    teamSession = { status: 'login', teamId: null, teamName: null, error: 'Falha ao verificar a sessão.' };
  }
  render();
}

async function submitTeamLogin(teamIdValue, username, password) {
  try {
    const response = await fetch('/api/auth/team/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: teamIdValue, username, password }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { teamSession = { ...teamSession, error: data.error || 'Não foi possível entrar.' }; render(); return; }
    teamSession = { status: 'authenticated', teamId: data.teamId, teamName: data.teamName, error: '' };
    render();
    initializeTeamPortal();
  } catch {
    teamSession = { ...teamSession, error: 'Falha de conexão.' };
    render();
  }
}

async function logoutTeamPortal() {
  try { await fetch('/api/auth/team/logout', { method: 'POST' }); } catch {}
  location.reload();
}

async function checkAdminSession() {
  if (!isAdminPanel) return;
  try {
    const statusResponse = await fetch('/api/auth/admin/status', { cache: 'no-store' });
    const statusData = statusResponse.ok ? await statusResponse.json() : { hasAdmins: true };
    if (!statusData.hasAdmins) { adminSession = { status: 'setup', username: null, error: '' }; render(); return; }
    const response = await fetch('/api/auth/admin/session', { cache: 'no-store' });
    const data = response.ok ? await response.json() : { authenticated: false };
    adminSession = { status: data.authenticated ? 'authenticated' : 'login', username: data.username || null, role: data.role || 'admin', error: '' };
    if (data.authenticated) { loadAccessData(); loadOperationsData(); }
  } catch {
    adminSession = { status: 'login', username: null, error: 'Falha ao verificar a sessão.' };
  }
  render();
}

async function submitAdminAuth(mode, username, password, setupToken) {
  try {
    const response = await fetch(mode === 'setup' ? '/api/auth/admin/setup' : '/api/auth/admin/login', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password, setupToken }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { adminSession = { ...adminSession, error: data.error || 'Não foi possível entrar.' }; render(); return; }
    adminSession = { status: 'authenticated', username: data.username, role: data.role || 'admin', error: '' };
    render();
    loadAccessData();
    loadOperationsData();
  } catch {
    adminSession = { ...adminSession, error: 'Falha de conexão.' };
    render();
  }
}

async function logoutAdmin() {
  try { await fetch('/api/auth/admin/logout', { method: 'POST' }); } catch {}
  location.reload();
}

async function loadAccessData() {
  if (!['access', 'dashboard'].includes(managementModule)) return;
  accessStatus = 'loading';
  render();
  try {
    const [adminsResponse, credentialsResponse] = await Promise.all([
      fetch('/api/auth/admin/accounts', { cache: 'no-store' }),
      fetch('/api/auth/team/credentials', { cache: 'no-store' }),
    ]);
    accessAdmins = adminsResponse.ok ? (await adminsResponse.json()).accounts || [] : [];
    accessTeamCredentials = credentialsResponse.ok ? (await credentialsResponse.json()).entries || [] : [];
    accessStatus = 'ready';
  } catch {
    accessStatus = 'error';
  }
  render();
}

async function loadOperationsData() {
  if (!isAdminPanel || adminSession.status !== 'authenticated') return;
  operationsStatus = operationsData.updatedAt ? 'ready' : 'loading';
  if (!operationsData.updatedAt) render();
  try {
    const response = await fetch(`/api/operations?ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (Number(data.updatedAt || 0) === Number(operationsData.updatedAt || 0)) { operationsStatus = 'ready'; return; }
    operationsData = {
      championships: Array.isArray(data.championships) ? data.championships : [],
      matches: Array.isArray(data.matches) ? data.matches : [],
      notifications: Array.isArray(data.notifications) ? data.notifications : [],
      announcements: Array.isArray(data.announcements) ? data.announcements : [],
      posts: Array.isArray(data.posts) ? data.posts : [],
      logs: Array.isArray(data.logs) ? data.logs : [],
      delegationStatus: data.delegationStatus && typeof data.delegationStatus === 'object' ? data.delegationStatus : {},
      teamHistory: data.teamHistory && typeof data.teamHistory === 'object' ? data.teamHistory : {},
      updatedAt: Number(data.updatedAt || 0),
    };
    const linkedMatch = operationsData.matches.find(item => item.room === ROOM_ID);
    if (linkedMatch && state.matchId !== linkedMatch.id) {
      const championship = operationsData.championships.find(item => item.id === linkedMatch.championshipId);
      commit(draft => {
        draft.matchId = linkedMatch.id;
        draft.championshipId = linkedMatch.championshipId;
        if (championship?.name) draft.competition = `${championship.name}${championship.season ? ` · ${championship.season}` : ''}`;
        if (linkedMatch.venue) draft.venue = linkedMatch.venue;
        for (const side of ['home', 'away']) {
          const selectedId = side === 'home' ? linkedMatch.homeTeamId : linkedMatch.awayTeamId;
          const team = teamCatalog.find(item => item.id === selectedId);
          if (team) applyCatalogTeam(draft, side, team);
        }
      }, { backup: false, immediate: true });
    }
    if (selectedChampionshipId && !operationsData.championships.some(item => item.id === selectedChampionshipId)) selectedChampionshipId = '';
    if (selectedMatchId && !operationsData.matches.some(item => item.id === selectedMatchId)) selectedMatchId = '';
    operationsStatus = 'ready';
    loadDashboardStats();
  } catch {
    operationsStatus = 'error';
  }
  render();
}

async function loadDashboardStats() {
  if (managementModule !== 'dashboard') return;
  const rooms = [...new Set(operationsData.matches.map(item => item.room).filter(Boolean))];
  if (!rooms.length) { dashboardStats = { status: 'ready', byRoom: {} }; render(); return; }
  dashboardStats = { status: 'loading', byRoom: dashboardStats.byRoom };
  render();
  try {
    const results = await Promise.all(rooms.map(async room => {
      try {
        const response = await fetch(`/api/state?room=${encodeURIComponent(room)}`, { cache: 'no-store' });
        return response.ok ? [room, await response.json()] : [room, null];
      } catch { return [room, null]; }
    }));
    const byRoom = {};
    for (const [room, data] of results) if (data && typeof data === 'object') byRoom[room] = data;
    dashboardStats = { status: 'ready', byRoom };
  } catch {
    dashboardStats = { status: 'error', byRoom: dashboardStats.byRoom };
  }
  render();
}

async function postOperation(action, payload = {}) {
  try {
    const response = await fetch('/api/operations', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, baseUpdatedAt: Number(operationsData.updatedAt || 0), ...payload }) });
    const data = await response.json().catch(() => ({}));
    if (response.status === 409 && data.operations) {
      operationsData = data.operations;
      operationsStatus = 'ready';
      toast('Outro administrador atualizou esses dados. Seu rascunho foi mantido; revise e salve novamente.');
      render();
      return false;
    }
    if (!response.ok) { toast(data.error || 'Não foi possível concluir a ação.'); return false; }
    operationsData = data.operations || operationsData;
    operationsStatus = 'ready';
    render();
    return true;
  } catch {
    toast('Não foi possível concluir a ação.');
    return false;
  }
}

async function initializeTeamPortal() {
  if (!isTeamPortal || teamSession.status !== 'authenticated') return;
  try {
    const response = await fetch(`/api/team-portal?team=${encodeURIComponent(teamSession.teamId)}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const remoteTeam = data.team;
    teamPortalTeam = remoteTeam ? normalizeTeamCatalog([remoteTeam])[0] : null;
    teamDelegation = data.delegation || { status: 'draft' };
    teamDelegationCompletion = data.completion || { complete: false, missing: [] };
    teamPortalDeadline = String(data.deadline || '');
    teamPortalContext = data.context || teamPortalContext;
    teamPortalStatus = teamPortalTeam ? 'ready' : 'invalid';
  } catch {
    teamPortalStatus = 'invalid';
  }
  render();
}

async function saveTeamPortal() {
  if (!teamPortalTeam || teamSession.status !== 'authenticated') return;
  teamPortalStatus = 'saving';
  render();
  try {
    const response = await fetch(`/api/team-portal?team=${encodeURIComponent(teamSession.teamId)}`, {
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: teamPortalTeam.name, short: teamPortalTeam.short, color: teamPortalTeam.color, logo: teamPortalTeam.logo, color2: teamPortalTeam.color2, sponsors: teamPortalTeam.sponsors, registrations: teamPortalTeam.registrations, matchSquads: teamPortalTeam.matchSquads, athletes: teamPortalTeam.athletes, staff: teamPortalTeam.staff, coach: teamPortalTeam.coach, formation: teamPortalTeam.formation }),
    });
    if (response.status === 401) { teamSession = { status: 'login', teamId: null, teamName: null, error: 'Sessão expirada. Entre novamente.' }; render(); return; }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    teamPortalTeam = normalizeTeamCatalog([data.team])[0];
    teamPortalContext = data.context || teamPortalContext;
    teamDelegation = data.delegation || { status: 'draft' };
    teamDelegationCompletion = delegationCompletion(teamPortalTeam);
    teamPortalStatus = 'saved';
    render();
    setTimeout(() => { if (teamPortalStatus === 'saved') { teamPortalStatus = 'ready'; render(); } }, 1800);
  } catch {
    teamPortalStatus = 'error';
    render();
  }
}

function delegationCompletion(team) {
  const athletes = Array.isArray(team?.athletes) ? team.athletes : [];
  const staff = normalizedStaff(team);
  const missing = [];
  if (!String(team?.name || '').trim()) missing.push('nome da equipe');
  if (String(team?.short || '').trim().length < 2) missing.push('sigla');
  if (!athletes.length) missing.push('ao menos um atleta');
  if (athletes.some(item => !String(item?.name || '').trim() || !String(item?.number || '').trim())) missing.push('nome e número de todos os atletas');
  if (!staff.length) missing.push('comissão técnica');
  if (staff.some(item => !String(item?.name || '').trim() || !String(item?.role || '').trim())) missing.push('nome e função de toda a comissão');
  return { complete: missing.length === 0, missing };
}

async function completeTeamDelegation() {
  if (!teamPortalTeam) return;
  await saveTeamPortal();
  const localCheck = delegationCompletion(teamPortalTeam);
  if (!localCheck.complete) { teamDelegationCompletion = localCheck; toast(`Complete: ${localCheck.missing.join(', ')}.`); render(); return; }
  try {
    const response = await fetch('/api/team-delegation/complete', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: teamPortalTeam.id }) });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) { teamDelegationCompletion = { complete: false, missing: data.missing || [] }; toast(data.error || 'Não foi possível concluir a delegação.'); render(); return; }
    teamDelegation = data.delegation;
    teamDelegationCompletion = { complete: true, missing: [] };
    toast('Delegação concluída. O Super Admin foi avisado.');
    render();
  } catch { toast('Não foi possível avisar o Super Admin.'); }
}

async function uploadTeamPresentationPhoto(team, subjectId, file) {
  if (!team || !file) return null;
  if (file.size > 5_000_000) { toast('Escolha uma foto de até 5 MB.'); return null; }
  const response = await fetch(`/api/team-athlete-photo?team=${encodeURIComponent(team.id)}&athlete=${encodeURIComponent(subjectId)}`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const result = await response.json();
  return `${result.url}${String(result.url).includes('?') ? '&' : '?'}v=${Date.now()}`;
}

let sponsorLibrary = null;
const SPONSOR_LIBRARY_FIELDS = ['sponsors', 'sponsorBarMode', 'sponsorBarVideo', 'sponsorBarItems', 'sponsorBarAutoSchedule', 'sponsorBarScheduleInterval'];

function applySponsorLibrary(target = state) {
  if (libraryMode || !sponsorLibrary || target.sponsorSource !== 'platform') return false;
  const signature = source => JSON.stringify(SPONSOR_LIBRARY_FIELDS.map(field => source[field]));
  if (signature(target) === signature(sponsorLibrary.fields)) return false;
  for (const field of SPONSOR_LIBRARY_FIELDS) target[field] = JSON.parse(JSON.stringify(sponsorLibrary.fields[field]));
  target.activeSponsorIndex = clampNumber(target.activeSponsorIndex, 0, Math.max(0, target.sponsors.length - 1), 0);
  target.sponsorBarActiveIndex = clampNumber(target.sponsorBarActiveIndex, 0, Math.max(0, target.sponsorBarItems.length - 1), 0);
  return true;
}

async function pollSponsorLibrary() {
  if (libraryMode || isTeamPortal) return;
  try {
    const response = await fetch(`/api/state?room=${LIBRARY_ROOM}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const remote = await response.json();
    if (!remote?.updatedAt) return;
    const normalized = normalizeState(remote);
    sponsorLibrary = { updatedAt: Number(remote.updatedAt), fields: Object.fromEntries(SPONSOR_LIBRARY_FIELDS.map(field => [field, normalized[field]])) };
    if (applySponsorLibrary()) { writeLocal(); render(); } else if (isManagement) render();
  } catch {}
}

function receiveState(incoming) {
  if (!incoming || typeof incoming !== 'object' || !incoming.updatedAt || Number(incoming.updatedAt) <= Number(state.updatedAt)) return;
  state = normalizeState(incoming);
  if (teamCatalogState.globalAppearance) applyGlobalAppearance(state, teamCatalogState.globalAppearance);
  applySponsorLibrary(state);
  writeLocal();
  render();
}

channel?.addEventListener('message', event => {
  if (event.data?.type === 'state') receiveState(event.data.state);
});

window.addEventListener('storage', event => {
  if (event.key !== STORAGE_KEY || !event.newValue) return;
  try { receiveState(JSON.parse(event.newValue)); } catch {}
});

async function pollServer() {
  try {
    const response = await fetch(apiUrl(`/api/state?ts=${Date.now()}`), { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    receiveState(await response.json());
    syncStatus = 'online';
    consecutiveFailures = 0;
    lastSyncAt = Date.now();
  } catch {
    consecutiveFailures += 1;
    if (consecutiveFailures >= 2) syncStatus = 'offline';
  }
  updateSyncIndicator();
}

async function initializeSharedState() {
  try {
    const response = await fetch(apiUrl(`/api/state?ts=${Date.now()}`), { cache: 'no-store' });
    const remote = response.ok ? await response.json() : null;
    if (remote?.updatedAt && Number(remote.updatedAt) >= Number(state.updatedAt || 0)) {
      receiveState(remote);
    } else if (!isOutput && !isPreview) {
      if (!state.updatedAt) {
        state.updatedAt = Date.now();
        writeLocal();
      }
      schedulePush(true);
    }
  } catch {
    if (!isOutput && !isPreview) {
      if (!state.updatedAt) {
        state.updatedAt = Date.now();
        writeLocal();
      }
      schedulePush(true);
    }
  }
}

function updateSyncIndicator() {
  document.querySelectorAll('[data-sync-status]').forEach(element => {
    element.dataset.syncStatus = syncStatus;
    const label = syncStatus === 'online' ? 'Sincronizado' : syncStatus === 'syncing' ? 'Enviando…' : syncStatus === 'offline' ? 'Sem conexão' : 'Conectando…';
    const text = element.querySelector('[data-sync-label]');
    if (text) text.textContent = label;
    element.title = lastSyncAt ? `Última sincronização: ${new Date(lastSyncAt).toLocaleTimeString('pt-BR')}` : label;
  });
}

function addTimeline(title, team = '', name = '', note = '') {
  state.events.unshift({ id: Date.now() + Math.random(), minute: minuteText(), title, team, name, note, period: state.period, occurredAt: Date.now(), score: `${state.home.score} × ${state.away.score}` });
  state.events = state.events.slice(0, 200);
}

function showEvent(title, name, note = '', duration = 9500, kind = 'event') {
  state.activeEvent = { title, name, note, kind, shownAt: Date.now() };
  state.eventExpiresAt = duration ? Date.now() + duration : 0;
}

function hideEventAnimated(draft = state) {
  if (!draft.activeEvent) return;
  draft.eventExpiresAt = Date.now();
}

function toast(message) {
  document.querySelector('.toast')?.remove();
  const element = document.createElement('div');
  element.className = 'toast';
  element.textContent = message;
  document.body.append(element);
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.remove(), 2800);
}

function renderPeriodExtraControls() {
  return `<div class="period-extra-controls"><div class="field"><label>Período exibido</label><select data-field="period">${currentSport().periods.map(([value,label]) => `<option value="${value}" ${state.period === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label>Acréscimos (minutos)</label><input type="number" min="0" max="30" step="1" data-field="extraTime" value="${Math.max(0, Number(state.extraTime || 0))}"></div></div>`;
}

function renderPeriodStyleControls() {
  const appearance = state.appearance || defaultAppearance();
  return `<section class="goal-settings"><div class="section-header"><div><h3 class="section-title">Período e acréscimos</h3><p class="help-text">Estilização independente dos blocos à direita do relógio.</p></div></div>${appearanceRange('periodScale','Tamanho do bloco de período',appearance.periodScale,60,160,'%')}${appearanceRange('periodFont','Tamanho da fonte',appearance.periodFont,60,160,'%')}${appearanceRange('periodSurface','Opacidade da superfície',appearance.periodSurface,55,100,'%')}${appearanceRange('extraTimeScale','Tamanho dos acréscimos',appearance.extraTimeScale,60,160,'%')}</section>`;
}

function renderScoreboardLayoutControl() {
  const layout = SCOREBOARD_LAYOUTS.some(([value]) => value === state.appearance?.scoreboardLayout) ? state.appearance.scoreboardLayout : 'compact';
  const showBadge = Boolean(state.appearance?.scoreboardShowBadge);
  return `<div class="scoreboard-layout-control"><span>Formato do placar</span><div role="group" aria-label="Formato do placar">${SCOREBOARD_LAYOUTS.map(([value, label, caption]) => `<button class="layout-choice ${layout === value ? 'active' : ''}" data-action="scoreboard-layout" data-value="${value}" aria-pressed="${layout === value}"><strong>${label}</strong><small>${caption}</small></button>`).join('')}</div></div>
    <div class="photo-lineup-option"><div><strong>Escudos dos times no placar</strong><small>Exibe o escudo enviado em cada equipe, com fallback nas siglas.</small></div><button class="button subtle ${showBadge ? 'active' : ''}" data-action="toggle-scoreboard-badge" aria-pressed="${showBadge}">${showBadge ? 'Exibindo' : 'Oculto'}</button></div>`;
}

function renderMatchTab() {
  const sport = currentSport();
  const unit = sport.scoring.toLowerCase();
  return `<div class="field"><label for="competition">Competição</label><input id="competition" data-field="competition" value="${escapeHtml(state.competition)}"></div>
    ${renderScoreboardLayoutControl()}
    <div class="scoreboard-control"><div class="teams-grid">
      <div>${badge(state.home)}<div class="team-short-name">${escapeHtml(state.home.name)}${state.sport === 'volleyball' && state.sportData.volleyball.serve === 'home' ? ' · ●' : ''}</div><div class="score-controls"><button class="goal-control" data-action="score-home-minus" aria-label="Diminuir ${unit} mandante">−</button><span class="score-number" data-score="home">${state.home.score}</span><button class="goal-control" data-action="score-home-plus" aria-label="Aumentar ${unit} mandante">+</button></div></div>
      <span class="score-x">×</span>
      <div>${badge(state.away)}<div class="team-short-name">${escapeHtml(state.away.name)}${state.sport === 'volleyball' && state.sportData.volleyball.serve === 'away' ? ' · ●' : ''}</div><div class="score-controls"><button class="goal-control" data-action="score-away-minus" aria-label="Diminuir ${unit} visitante">−</button><span class="score-number" data-score="away">${state.away.score}</span><button class="goal-control" data-action="score-away-plus" aria-label="Aumentar ${unit} visitante">+</button></div></div>
    </div></div>
    ${renderSportMetrics()}
    <div class="tiny-label">${sport.duration ? 'Cronômetro regressivo' : 'Cronômetro da partida'}</div><div class="clock-box"><span class="clock-time" data-clock>${clockText()}</span><div class="clock-buttons"><button class="button square ${state.clock.running ? '' : 'primary'}" data-action="clock-toggle" aria-label="${state.clock.running ? 'Pausar cronômetro' : 'Iniciar cronômetro'}">${state.clock.running ? icons.pause : icons.play}</button><button class="button square" data-action="clock-back" aria-label="Voltar um minuto">−1</button><button class="button square" data-action="clock-forward" aria-label="Avançar um minuto">+1</button><button class="button square" data-action="clock-reset" aria-label="Zerar cronômetro">${icons.refresh}</button></div></div>
    <div class="period-buttons">${sport.periods.map(([value,label]) => `<button class="period-button ${state.period === value ? 'active' : ''}" data-action="period" data-value="${value}">${label}</button>`).join('')}</div>${renderPeriodExtraControls()}
    ${renderSportActions()}`;
}

function metricStepper(title, values, action, options = {}) {
  const highlight = options.warnAt;
  return `<div class="metric-section"><div class="metric-title">${escapeHtml(title)}</div><div class="metric-grid">${['home', 'away'].map(key => `<div class="metric-cell ${highlight && values[key] >= highlight ? 'metric-warning' : ''}"><span class="metric-team">${escapeHtml(state[key].short)}</span><button class="metric-adjust" data-action="${action}" data-value="${key}:-1" aria-label="Reduzir ${title}">−</button><strong>${Number(values[key] || 0)}</strong><button class="metric-adjust" data-action="${action}" data-value="${key}:1" aria-label="Aumentar ${title}">+</button></div>`).join('')}</div></div>`;
}

function renderSportMetrics() {
  if (state.sport === 'volleyball') {
    const volley = state.sportData.volleyball;
    return `<div class="sport-metrics">${metricStepper('Sets conquistados', volley.sets, 'volley-set')}${metricStepper('Tempos técnicos', volley.timeouts, 'volley-timeout')}<div class="serve-controls"><span>Saque</span>${['home','away'].map(key => `<button class="serve-button ${volley.serve === key ? 'active' : ''}" data-action="volley-serve" data-value="${key}">● ${escapeHtml(state[key].short)}</button>`).join('')}</div></div>`;
  }
  if (state.sport === 'futsal') {
    return `<div class="sport-metrics">${metricStepper('Faltas acumuladas', state.sportData.futsal.fouls, 'futsal-foul', { warnAt: 5 })}<p class="metric-note">A partir da 5ª falta, a contagem recebe destaque.</p></div>`;
  }
  if (state.sport === 'basketball') {
    const basketball = state.sportData.basketball;
    return `<div class="sport-metrics">${metricStepper('Faltas da equipe', basketball.fouls, 'basket-foul', { warnAt: 4 })}${metricStepper('Tempos pedidos', basketball.timeouts, 'basket-timeout')}<div class="shot-controls"><span>Relógio de ataque</span><strong data-shot-clock>${shotClockSeconds()}</strong><button class="button square" data-action="shot-reset" data-value="24">24</button><button class="button square" data-action="shot-reset" data-value="14">14</button></div><div class="serve-controls"><span>Posse</span>${['home','away'].map(key => `<button class="serve-button ${basketball.possession === key ? 'active' : ''}" data-action="basket-possession" data-value="${key}">◀ ${escapeHtml(state[key].short)}</button>`).join('')}</div></div>`;
  }
  return '';
}

function renderSportActions() {
  let actions = '';
  if (state.sport === 'volleyball') {
    actions = `<button class="event-action scoring-action" data-action="volley-point" data-value="home">${icons.soccer} Ponto · ${escapeHtml(state.home.short)}</button><button class="event-action scoring-action" data-action="volley-point" data-value="away">${icons.soccer} Ponto · ${escapeHtml(state.away.short)}</button><button class="event-action" data-action="volley-timeout-event" data-value="home">${icons.pause} Tempo · ${escapeHtml(state.home.short)}</button><button class="event-action" data-action="volley-timeout-event" data-value="away">${icons.pause} Tempo · ${escapeHtml(state.away.short)}</button><button class="event-action" data-action="substitution">${icons.swap} Substituição</button><button class="event-action" data-action="lower-third">${icons.text} GC / nome</button>`;
  } else if (state.sport === 'basketball') {
    actions = ['home','away'].map(key => [1,2,3].map(points => `<button class="event-action scoring-action" data-action="basket-points" data-value="${key}:${points}">+${points} ${escapeHtml(state[key].short)}</button>`).join('')).join('') + `<button class="event-action" data-action="substitution">${icons.swap} Substituição</button><button class="event-action" data-action="lower-third">${icons.text} GC / nome</button>`;
  } else {
    actions = `<button class="event-action" data-action="goal-home">${icons.soccer} Gol · ${escapeHtml(state.home.short)}</button><button class="event-action" data-action="goal-away">${icons.soccer} Gol · ${escapeHtml(state.away.short)}</button><button class="event-action" data-action="yellow">${icons.card} Amarelo</button><button class="event-action" data-action="red">${icons.card} Vermelho</button><button class="event-action" data-action="substitution">${icons.swap} Substituição</button><button class="event-action" data-action="lower-third">${icons.text} GC / nome</button>`;
  }
  return `<div class="quick-actions"><div class="section-header"><h3 class="section-title">Ações de ${escapeHtml(currentSport().label.toLowerCase())}</h3><span class="section-kicker">Ao vivo</span></div><div class="action-grid ${state.sport === 'basketball' ? 'basket-action-grid' : ''}">${actions}</div></div>`;
}

function renderTeamsTab() {
  const selected = teamCatalog.find(team => team.id === selectedCatalogTeamId) || teamCatalog[0];
  const options = (selectedId) => teamCatalog.map(team => `<option value="${escapeHtml(team.id)}" ${team.id === selectedId ? 'selected' : ''}>${escapeHtml(team.name)} · ${escapeHtml(team.short)}</option>`).join('');
  if (!selected) return '<div class="empty-events">Nenhum time cadastrado.</div>';
  return `<div class="team-match-picker"><div class="section-header"><div><h3 class="section-title">Times da partida</h3><p class="help-text">Selecione dois times cadastrados para preencher escudo, cores e atletas.</p></div></div><div class="field-row"><div class="field"><label for="match-home-team">Mandante</label><select id="match-home-team" data-match-team="home">${options(state.selectedTeams?.home)}</select></div><div class="field"><label for="match-away-team">Visitante</label><select id="match-away-team" data-match-team="away">${options(state.selectedTeams?.away)}</select></div></div></div>
    <div class="team-catalog"><div class="team-catalog-head"><div><strong>Cadastro de times</strong><small>Biblioteca permanente para todas as partidas.</small></div><div class="inline-actions"><label class="button subtle" title="Colunas: Equipe;Sigla;Cor;Número;Atleta;Posição;Altura;Função">Importar planilha<input type="file" data-teams-import accept=".csv,.tsv,.txt,text/csv" hidden></label><button class="button subtle" data-action="teams-template">Modelo (.csv)</button><button class="button subtle" data-action="add-team">+ Novo time</button></div></div>
      <div class="field"><label for="catalog-team-select">Time em edição</label><select id="catalog-team-select">${options(selected.id)}</select></div>
      <div class="team-editor"><div class="team-title"><strong>${escapeHtml(selected.name)}</strong><div class="color-field"><input type="color" id="catalog-team-color" data-catalog-field="color" data-catalog-id="${escapeHtml(selected.id)}" value="${safeColor(selected.color)}" aria-label="Cor principal do time"></div></div>
        <div class="field"><label for="catalog-team-name">Nome da equipe</label><input id="catalog-team-name" data-catalog-field="name" data-catalog-id="${escapeHtml(selected.id)}" maxlength="80" value="${escapeHtml(selected.name)}"></div>
        <div class="field"><label for="catalog-team-short">Sigla no placar compacto · 3 letras</label><input id="catalog-team-short" data-catalog-field="short" data-catalog-id="${escapeHtml(selected.id)}" maxlength="3" value="${escapeHtml(selected.short)}"></div>
        <div class="field"><label>Escudo PNG ou JPG</label><input data-catalog-logo="${escapeHtml(selected.id)}" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml" style="padding:7px;font-size:10px"></div>
        <div class="field roster-editor"><label for="catalog-team-roster">Relação de atletas · número e nome</label><textarea id="catalog-team-roster" data-catalog-field="roster" data-catalog-id="${escapeHtml(selected.id)}">${escapeHtml(teamRosterText(selected))}</textarea></div>
        <div class="team-access-box"><div><strong>Acesso da equipe em /team</strong><small>Defina o usuário e a senha em <a href="${escapeHtml(moduleUrl('access'))}">Usuários/Acessos</a>.</small></div></div>
        <button class="button danger-button" data-action="remove-team" data-value="${escapeHtml(selected.id)}" ${teamCatalog.length <= 1 ? 'disabled' : ''}>Remover time do cadastro</button>
      </div>
    </div><p class="help-text">As alterações do time entram na partida atual e ficam disponíveis para as próximas transmissões.</p>`;
}

function relativeTime(value) {
  if (!value) return 'Nunca acessou';
  const minutes = Math.floor((Date.now() - Number(value)) / 60000);
  if (minutes < 1) return 'Agora há pouco';
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  const days = Math.floor(hours / 24);
  return days < 30 ? `há ${days} dia${days === 1 ? '' : 's'}` : new Date(Number(value)).toLocaleDateString('pt-BR');
}

const PASSWORD_LEVELS = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte'];

function passwordStrength(value) {
  const text = String(value || '');
  let score = 0;
  if (text.length >= 8) score += 1;
  if (text.length >= 12) score += 1;
  if (/[a-z]/.test(text) && /[A-Z]/.test(text)) score += 1;
  if (/\d/.test(text) && (/[^A-Za-z0-9]/.test(text) || text.length >= 10)) score += 1;
  return text ? Math.min(4, score) : 0;
}

function passwordMeter(value = '') {
  const level = passwordStrength(value);
  return `<div class="pw-meter" data-level="${level}"><i></i><i></i><i></i><i></i><span>${value ? PASSWORD_LEVELS[level] : 'Mínimo de 8 caracteres'}</span></div>`;
}

function accessInstructions(kind, name, username, password) {
  return kind === 'admin'
    ? `Acesso ao painel da ${BRAND_NAME}\nLink: ${location.origin}/\nUsuário: ${username}\nSenha: ${password}`
    : `Acesso ao portal da equipe ${name}\nLink: ${location.origin}/team\nUsuário: ${username}\nSenha: ${password}`;
}

function avatarBadge(label, color = '') {
  return `<span class="access-avatar" ${color ? `style="--avatar:${safeColor(color)}"` : ''}>${escapeHtml(String(label || '?').trim().slice(0, 2).toUpperCase())}</span>`;
}

function revealBox(key) {
  const password = accessRevealed[key];
  if (!password) return '';
  return `<div class="access-reveal"><div><small>Nova senha (exibida só agora)</small><code>${escapeHtml(password)}</code></div><button class="button subtle" data-action="copy-access-instructions" data-value="${escapeHtml(key)}">Copiar instruções</button><button class="button square subtle" data-action="dismiss-access-reveal" data-value="${escapeHtml(key)}" aria-label="Ocultar senha">${icons.close}</button></div>`;
}

function renderAccessModule() {
  if (accessStatus === 'loading' || accessStatus === 'idle') return '<div class="module-section"><div class="portal-empty">Carregando acessos…</div></div>';
  if (accessStatus === 'error') return '<div class="module-section"><div class="portal-empty">Não foi possível carregar os acessos. Recarregue a página.</div></div>';
  const term = accessSearch.trim().toLowerCase();
  const pendingResets = operationsData.notifications.filter(item => item.type === 'password-reset' && !item.read);
  const usersByTeam = new Map();
  for (const entry of accessTeamCredentials) usersByTeam.set(entry.teamId, [...(usersByTeam.get(entry.teamId) || []), entry]);
  const withAccess = teamCatalog.filter(team => usersByTeam.has(team.id)).length;
  const tiles = [[accessAdmins.length, 'Administradores'], [`${withAccess}/${teamCatalog.length}`, 'Times com acesso'], [accessTeamCredentials.length, 'Usuários de times'], [pendingResets.length, 'Pedidos de senha']];
  const alerts = pendingResets.length ? `<section class="access-alerts"><strong>Pedidos de redefinição de senha</strong>${pendingResets.map(item => {
    const username = String(item.message || '').match(/Usuário: (\S+?)\.(?:\s|$)/)?.[1] || '';
    return `<div class="access-alert-row"><span>${escapeHtml(item.title)}${username ? ` · <b>${escapeHtml(username)}</b>` : ''}</span><div><button class="button primary" data-action="access-handle-reset" data-value="${escapeHtml(item.id)}|${escapeHtml(item.teamId)}|${escapeHtml(username)}" ${username ? '' : 'disabled'}>Gerar nova senha</button><button class="button subtle" data-action="read-notification" data-value="${escapeHtml(item.id)}">Dispensar</button></div></div>`;
  }).join('')}</section>` : '';
  const matches = (...values) => !term || values.some(value => String(value || '').toLowerCase().includes(term));
  const adminCards = accessAdmins.filter(account => matches(account.username)).map(account => {
    const isSelf = account.username === adminSession.username;
    return `<article class="access-card"><div class="access-card-head">${avatarBadge(account.username)}<div><strong>${escapeHtml(account.username)}${isSelf ? ' <em class="access-you">você</em>' : ''}</strong><small>${escapeHtml(ADMIN_ROLE_HINTS[account.role] || ADMIN_ROLE_HINTS.admin)}</small></div></div><div class="field access-role-field"><label for="role-${escapeHtml(account.id)}">Papel</label><select id="role-${escapeHtml(account.id)}" data-admin-role="${escapeHtml(account.id)}">${Object.entries(ADMIN_ROLE_LABELS).map(([value, label]) => `<option value="${value}" ${(account.role || 'admin') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></div><dl class="access-meta"><div><dt>Último acesso</dt><dd>${escapeHtml(relativeTime(account.lastLoginAt))}</dd></div><div><dt>Criado em</dt><dd>${account.createdAt ? new Date(account.createdAt).toLocaleDateString('pt-BR') : '—'}</dd></div></dl>${revealBox(`admin:${account.id}`)}<div class="access-card-actions"><button class="button subtle" data-action="admin-reset-password" data-value="${escapeHtml(account.id)}">Redefinir senha</button><button class="button subtle" data-action="remove-admin-account" data-value="${escapeHtml(account.id)}" ${accessAdmins.length <= 1 || isSelf ? 'disabled' : ''} title="${isSelf ? 'Você não pode remover a própria conta' : 'Remover administrador'}">Remover</button></div></article>`;
  }).join('') || '<div class="portal-empty">Nenhum administrador encontrado.</div>';
  const teamCards = teamCatalog.filter(team => {
    const users = usersByTeam.get(team.id) || [];
    if (accessTeamFilter === 'with' && !users.length) return false;
    if (accessTeamFilter === 'without' && users.length) return false;
    return matches(team.name, team.short, ...users.map(user => user.username));
  }).map(team => {
    const users = usersByTeam.get(team.id) || [];
    const id = escapeHtml(team.id);
    const status = operationsData.delegationStatus[team.id]?.status || 'draft';
    const userRows = users.map(user => `<div class="access-user"><div><strong>${escapeHtml(user.username)}</strong><small>Último acesso: ${escapeHtml(relativeTime(user.lastLoginAt))}</small></div><div class="access-user-actions"><button class="button subtle" data-action="team-user-reset" data-value="${id}|${escapeHtml(user.username)}">Redefinir senha</button><button class="button square subtle" data-action="remove-team-credentials" data-value="${id}|${escapeHtml(user.username)}" aria-label="Remover ${escapeHtml(user.username)}">${icons.close}</button></div></div>${revealBox(`team:${team.id}|${user.username}`)}`).join('');
    return `<article class="access-card access-team-card ${users.length ? '' : 'is-empty'}"><div class="access-card-head">${avatarBadge(team.short || team.name, team.color)}<div><strong>${escapeHtml(team.name)}</strong><small>${users.length ? `${users.length} usuário${users.length === 1 ? '' : 's'}` : 'Sem acesso ao portal'} · ${escapeHtml(DELEGATION_LABELS[status] || status)}</small></div></div>${userRows}
      <details class="access-add" ${users.length ? '' : 'open'}><summary>${users.length ? '+ Adicionar ou atualizar usuário' : 'Criar primeiro acesso'}</summary><div class="field-row"><div class="field"><label for="access-username-${id}">Usuário</label><input id="access-username-${id}" name="acesso-time-${id}" maxlength="40" autocomplete="off" placeholder="ex: gestor.time"></div><div class="field"><label for="access-password-${id}">Senha · visível para conferência</label><div class="password-field"><input id="access-password-${id}" name="chave-time-${id}" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="mínimo 8 caracteres" data-pw-meter><button type="button" class="button square subtle" data-action="generate-team-password" data-value="${id}" title="Gerar senha automática">${icons.refresh}</button><button type="button" class="button square subtle" data-action="copy-team-credentials" data-value="${id}" title="Copiar usuário e senha">${icons.copy}</button></div>${passwordMeter()}</div></div><button class="button primary access-row-save" data-action="set-team-credentials" data-value="${id}">${users.length ? 'Salvar usuário' : 'Vincular acesso'}</button></details></article>`;
  }).join('') || '<div class="portal-empty">Nenhuma equipe corresponde ao filtro.</div>';
  const filterChips = [['all', 'Todos'], ['with', 'Com acesso'], ['without', 'Sem acesso']].map(([value, label]) => `<button class="access-chip ${accessTeamFilter === value ? 'active' : ''}" data-action="access-team-filter" data-value="${value}" aria-pressed="${accessTeamFilter === value}">${label}</button>`).join('');
  return `<div class="module-section access-screen"><div class="dashboard-stats">${tiles.map(([value, label]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}</div>${alerts}
    <div class="access-toolbar"><input type="search" data-access-search value="${escapeHtml(accessSearch)}" maxlength="60" placeholder="Buscar por equipe ou usuário" aria-label="Buscar acessos"><div class="access-chips" role="group" aria-label="Filtrar equipes">${filterChips}</div></div>
    <section class="access-section"><div class="section-header"><div><h3 class="section-title">Administradores do painel</h3><p class="help-text">Contas do painel e seus papéis: administrador (acesso total), operador (transmissão e cadastros) e leitor (somente leitura). Mantenha ao menos um administrador com acesso total.</p></div></div>
      <div class="access-grid">${adminCards}<article class="access-card access-new"><div class="access-card-head">${avatarBadge('+')}<div><strong>Nova conta do painel</strong><small>Escolha o papel e defina a senha</small></div></div><div class="field"><label for="access-admin-role">Papel</label><select id="access-admin-role">${Object.entries(ADMIN_ROLE_LABELS).map(([value, label]) => `<option value="${value}">${label} · ${escapeHtml(ADMIN_ROLE_HINTS[value])}</option>`).join('')}</select></div><div class="field"><label for="access-admin-username">Novo usuário</label><input id="access-admin-username" name="acesso-admin-usuario" maxlength="40" autocomplete="off" placeholder="ex: leonardo.adm"></div><div class="field"><label for="access-admin-password">Senha · visível para conferência</label><div class="password-field"><input id="access-admin-password" name="chave-admin" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="mínimo 8 caracteres" data-pw-meter><button type="button" class="button square subtle" data-action="generate-admin-password" title="Gerar senha automática">${icons.refresh}</button><button type="button" class="button square subtle" data-action="copy-admin-credentials" title="Copiar usuário e senha">${icons.copy}</button></div>${passwordMeter()}</div><button class="button primary access-row-save" data-action="add-admin-account">+ Adicionar administrador</button></article></div></section>
    <section class="access-section"><div class="section-header"><div><h3 class="section-title">Usuários dos times</h3><p class="help-text">Cada time acessa <strong>/team</strong> com o usuário e a senha definidos aqui para cadastrar atletas, fotos e comissão técnica. Uma equipe pode ter vários usuários.</p></div></div><div class="access-grid">${teamCards}</div></section></div>`;
}

function operationTeamName(id) {
  return teamCatalog.find(team => team.id === id)?.name || id || 'Time não definido';
}

function operationChampionshipName(id) {
  return operationsData.championships.find(item => item.id === id)?.name || 'Campeonato não definido';
}

function operationDate(value, includeTime = false) {
  if (!value) return 'Data não definida';
  const date = new Date(includeTime ? value : `${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('pt-BR', includeTime ? { dateStyle: 'short', timeStyle: 'short' } : { dateStyle: 'short' }).format(date);
}

function renderOperationsState() {
  if (operationsStatus === 'loading' || operationsStatus === 'idle') return '<div class="portal-empty">Carregando dados operacionais…</div>';
  if (operationsStatus === 'error') return '<div class="portal-empty">Não foi possível carregar os dados. Recarregue a página.</div>';
  return '';
}

function renderMatchSwitcher() {
  if (!operationsData.matches.length) return `<a class="button" href="${escapeHtml(moduleUrl('matches'))}">Cadastrar partida</a>`;
  const sorted = [...operationsData.matches].sort((a, b) => String(a.kickoffAt || '').localeCompare(String(b.kickoffAt || '')));
  return `<label class="active-match-switcher"><span>Partida ativa</span><select id="active-match-switcher">${sorted.map(item => `<option value="${escapeHtml(item.room)}" ${item.room === ROOM_ID ? 'selected' : ''}>${escapeHtml(operationTeamName(item.homeTeamId))} × ${escapeHtml(operationTeamName(item.awayTeamId))} · ${escapeHtml(item.round || operationDate(item.kickoffAt, true))}</option>`).join('')}</select></label>`;
}

const SPORT_LABELS = { football: 'Futebol', futsal: 'Futsal', volleyball: 'Vôlei', basketball: 'Basquete', esports: 'E-sports', other: 'Outra modalidade' };
const FORMAT_LABELS = { league: 'Pontos corridos (todos contra todos)', groups: 'Fase de grupos + mata-mata', knockout: 'Mata-mata' };
const TIEBREAKER_LABELS = { wins: 'Mais vitórias', goalDiff: 'Saldo de gols', goalsFor: 'Gols marcados', goalsAgainst: 'Menos gols sofridos', headToHead: 'Confronto direto', fewerCards: 'Menos cartões', alphabetical: 'Ordem alfabética' };
const CHAMPIONSHIP_STATUS_LABELS = { planned: 'Planejado', active: 'Em andamento', finished: 'Encerrado' };
const DEFAULT_TIEBREAKERS = ['wins', 'goalDiff', 'goalsFor', 'headToHead'];
let fixtureOptions = { mode: '', doubleRound: false, groups: 2, advance: 2, twoLegs: false, startDate: '', time: '15:00', intervalDays: 7, venue: '', shuffle: true, replace: false };
let championshipSectionsOpen = { general: true };

function blankChampionship() {
  return { name: '', season: '', startDate: '', endDate: '', status: 'planned', sport: 'football', format: 'league', description: '', isPublic: false, slug: '', organizer: '', organizerName: '', rules: { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, tiebreakers: [...DEFAULT_TIEBREAKERS], yellowLimit: 3, redGames: 1 }, teamIds: [], moderators: [] };
}

function championshipPublicUrl(item) {
  return item?.slug ? `${location.origin}/c/${item.slug}` : '';
}

function renderChampionshipsModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const selected = operationsData.championships.find(item => item.id === selectedChampionshipId) || null;
  championshipDraft ||= selected ? structuredClone(selected) : null;
  const editor = { ...blankChampionship(), ...(championshipDraft || {}) };
  editor.rules = { ...blankChampionship().rules, ...(editor.rules || {}) };
  const matchesOf = selected ? operationsData.matches.filter(match => match.championshipId === selected.id) : [];
  const list = operationsData.championships.map(item => `<button class="operations-item ${item.id === selected?.id ? 'active' : ''}" data-action="select-championship" data-value="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(SPORT_LABELS[item.sport] || 'Futebol')} · ${escapeHtml(FORMAT_LABELS[item.format] || FORMAT_LABELS.league).split(' (')[0]} · ${operationsData.matches.filter(match => match.championshipId === item.id).length} partida(s)${item.isPublic ? ' · público' : ''}</small></span><b>${CHAMPIONSHIP_STATUS_LABELS[item.status] || 'Planejado'}</b></button>`).join('') || '<div class="portal-empty">Nenhum campeonato cadastrado.</div>';
  const field = (label, path, value, attrs = '', type = 'text') => `<div class="field"><label>${label}</label><input data-ch-field="${path}" ${type === 'number' ? 'data-ch-type="number"' : ''} type="${type}" value="${escapeHtml(String(value ?? ''))}" ${attrs}></div>`;
  const select = (label, path, value, options) => `<div class="field"><label>${label}</label><select data-ch-field="${path}">${options.map(([key, text]) => `<option value="${escapeHtml(key)}" ${value === key ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></div>`;
  const check = (label, path, checked) => `<label class="builder-check"><input type="checkbox" data-ch-field="${path}" data-ch-type="bool" ${checked ? 'checked' : ''}> ${label}</label>`;
  const section = (key, title, caption, body) => `<details class="settings-section" data-champ-section="${key}" ${championshipSectionsOpen[key] ?? false ? 'open' : ''}><summary><span><strong>${title}</strong><small>${caption}</small></span></summary><div class="settings-section-body">${body}</div></details>`;
  const order = [...editor.rules.tiebreakers, ...Object.keys(TIEBREAKER_LABELS).filter(key => !editor.rules.tiebreakers.includes(key))];
  const tiebreakers = `<div class="tiebreak-list">${order.map(key => { const on = editor.rules.tiebreakers.includes(key); const position = editor.rules.tiebreakers.indexOf(key); return `<div class="tiebreak-row ${on ? 'is-on' : ''}"><label><input type="checkbox" data-action="ch-tb" data-value="${key}|toggle" ${on ? 'checked' : ''}> ${on ? `<b>${position + 1}º</b>` : ''} ${TIEBREAKER_LABELS[key]}</label>${on ? `<span><button class="button subtle" data-action="ch-tb" data-value="${key}|up" ${position === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="button subtle" data-action="ch-tb" data-value="${key}|down" ${position === editor.rules.tiebreakers.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button></span>` : ''}</div>`; }).join('')}</div>`;
  const teams = teamCatalog.map(team => `<label class="announce-team"><input type="checkbox" data-ch-team="${escapeHtml(team.id)}" ${editor.teamIds.includes(team.id) ? 'checked' : ''}> ${escapeHtml(team.name)}</label>`).join('') || '<p class="help-text">Cadastre equipes no módulo Times.</p>';
  const mode = fixtureOptions.mode || editor.format;
  const fx = (label, key, type = 'text', attrs = '') => `<div class="field"><label>${label}</label><input data-fx="${key}" type="${type}" value="${escapeHtml(String(fixtureOptions[key] ?? ''))}" ${attrs}></div>`;
  const fxCheck = (label, key) => `<label class="builder-check"><input type="checkbox" data-fx="${key}" data-fx-bool ${fixtureOptions[key] ? 'checked' : ''}> ${label}</label>`;
  const generator = selected ? `<div class="field"><label>Formato</label><select data-fx="mode">${Object.entries(FORMAT_LABELS).map(([key, text]) => `<option value="${key}" ${mode === key ? 'selected' : ''}>${text}</option>`).join('')}</select></div>
    <div class="field-row">${fx('Primeira rodada em', 'startDate', 'date')}${fx('Horário', 'time', 'time')}${fx('Dias entre rodadas', 'intervalDays', 'number', 'min="1" max="60"')}</div>${fx('Local (opcional)', 'venue', 'text', 'maxlength="120"')}
    ${mode !== 'knockout' ? fxCheck('Turno e returno (ida e volta)', 'doubleRound') : fxCheck('Ida e volta nas fases até a semifinal', 'twoLegs')}${mode === 'groups' ? `<div class="field-row">${fx('Número de grupos', 'groups', 'number', 'min="2" max="16"')}${fx('Classificados por grupo', 'advance', 'number', 'min="1" max="4"')}</div>` : ''}
    ${fxCheck('Sortear a ordem das equipes', 'shuffle')}${matchesOf.some(match => match.generated) ? fxCheck('Substituir as partidas geradas anteriormente (só se nenhuma começou)', 'replace') : ''}
    <div class="operations-actions"><button class="button primary" data-action="generate-fixtures">Gerar partidas (${editor.teamIds.length} equipes)</button>${mode !== 'league' ? '<button class="button" data-action="generate-next-round">Gerar próxima fase</button>' : ''}</div><p class="help-text">${matchesOf.length} partida(s) neste campeonato. O mata-mata só avança quando a fase anterior estiver finalizada; empates exigem pênaltis. As salas de overlay de cada jogo são criadas automaticamente.</p>` : '<p class="help-text">Salve o campeonato para gerar as partidas.</p>';
  const moderatorsBody = adminSession.role === 'admin' ? ((accessAdmins.filter(account => account.role === 'operator').map(account => `<label class="announce-team"><input type="checkbox" data-ch-mod="${escapeHtml(account.username)}" ${editor.moderators.includes(account.username) ? 'checked' : ''}> ${escapeHtml(account.username)} <small>(operador)</small></label>`).join('')) || '<p class="help-text">Nenhum operador cadastrado. Crie contas com o papel Operador em Usuários/Acessos.</p>') + '<p class="help-text">Sem moderadores marcados, qualquer operador administra este campeonato. Com moderadores, só eles (e os administradores) podem editar.</p>' : '<p class="help-text">Somente administradores definem moderadores.</p>';
  const publicLink = championshipPublicUrl(selected || editor);
  return `<div class="operations-layout"><section class="operations-list"><div class="operations-list-head"><div><strong>Campeonatos</strong><small>${operationsData.championships.length} cadastrado${operationsData.championships.length === 1 ? '' : 's'}</small></div><button class="button primary" data-action="new-championship">+ Novo</button></div>${list}</section><section class="operations-editor"><div class="section-header"><div><h3 class="section-title">${selected ? escapeHtml(editor.name || 'Editar campeonato') : 'Novo campeonato'}</h3><p class="help-text">Organize formato, regras, equipes e partidas. Cada seção abaixo pode ser aberta ou recolhida.</p></div></div>
    ${section('general', 'Dados gerais', 'Nome, modalidade, período e descrição', `${field('Nome', 'name', editor.name, 'maxlength="100" placeholder="Ex.: Campeonato Municipal"')}<div class="field-row">${field('Temporada', 'season', editor.season, 'maxlength="40" placeholder="2026"')}${select('Status', 'status', editor.status, Object.entries(CHAMPIONSHIP_STATUS_LABELS))}</div><div class="field-row">${select('Modalidade', 'sport', editor.sport, Object.entries(SPORT_LABELS))}${select('Formato', 'format', editor.format, Object.entries(FORMAT_LABELS))}</div><div class="field-row">${field('Início', 'startDate', editor.startDate, '', 'date')}${field('Fim', 'endDate', editor.endDate, '', 'date')}</div><div class="field"><label>Descrição (página pública)</label><textarea data-ch-field="description" maxlength="600" rows="3">${escapeHtml(editor.description || '')}</textarea></div>`)}
    ${section('rules', 'Regras e desempate', 'Pontuação, critérios de desempate e suspensões', `<div class="field-row">${field('Vitória', 'rules.pointsWin', editor.rules.pointsWin, 'min="0" max="10"', 'number')}${field('Empate', 'rules.pointsDraw', editor.rules.pointsDraw, 'min="0" max="10"', 'number')}${field('Derrota', 'rules.pointsLoss', editor.rules.pointsLoss, 'min="0" max="10"', 'number')}</div><strong class="tiny-label">Critérios de desempate (em ordem)</strong>${tiebreakers}<div class="field-row">${field('Amarelos para suspender (0 = off)', 'rules.yellowLimit', editor.rules.yellowLimit, 'min="0" max="10"', 'number')}${field('Jogos por vermelho', 'rules.redGames', editor.rules.redGames, 'min="0" max="10"', 'number')}</div>`)}
    ${section('teams', 'Equipes participantes', `${editor.teamIds.length} selecionada(s)`, `<div class="announce-teams">${teams}</div>`)}
    ${section('fixtures', 'Gerar partidas e fases', 'Todos contra todos, grupos ou mata-mata', generator)}
    ${section('public', 'Divulgação e página pública', editor.isPublic ? 'Publicado' : 'Privado', `${check('Publicar página pública deste campeonato (qualquer pessoa com o link vê)', 'isPublic', editor.isPublic)}${field('Endereço (slug)', 'slug', editor.slug, 'maxlength="48" placeholder="gerado a partir do nome"')}${field('Nome do organizador (exibido)', 'organizerName', editor.organizerName, 'maxlength="80"')}${field('Endereço do organizador', 'organizer', editor.organizer, 'maxlength="48" placeholder="ex.: prefeitura-cajati"')}${publicLink ? `<div class="copy-row"><input readonly value="${escapeHtml(publicLink)}" aria-label="Link público"><button class="button" data-action="copy-public-link" data-value="${escapeHtml(publicLink)}">${icons.copy} Copiar</button><a class="button subtle" href="${escapeHtml(publicLink)}" target="_blank" rel="noopener">Abrir</a></div>` : '<p class="help-text">O link aparece depois de salvar.</p>'}`)}
    ${section('moderators', 'Moderadores', 'Quem pode administrar este campeonato', moderatorsBody)}
    <div class="operations-actions"><button class="button primary" data-action="save-championship" data-value="${escapeHtml(selected?.id || '')}">Salvar campeonato</button>${selected ? `<button class="button subtle danger" data-action="delete-championship" data-value="${escapeHtml(selected.id)}">Excluir</button>` : ''}</div></section></div>`;
}

let standingsRooms = {};
let standingsChampionshipId = '';
let standingsSummaryId = '';
let standingsLoadedAt = 0;
let standingsBundle = null;
let standingsBundleFor = '';

async function loadStandingsRooms(force = false) {
  if (!isAdminPanel || adminSession.status !== 'authenticated' || managementModule !== 'standings' || !standingsChampionshipId) return;
  if (!force && Date.now() - standingsLoadedAt < 12000 && standingsBundleFor === standingsChampionshipId) return;
  standingsLoadedAt = Date.now();
  try {
    const response = await fetch(`/api/public/championship?id=${encodeURIComponent(standingsChampionshipId)}&ts=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) { standingsBundle = await response.json(); standingsBundleFor = standingsChampionshipId; }
    const summary = standingsBundle?.matches.find(match => match.id === standingsSummaryId);
    if (summary) { const room = await fetch(`/api/state?room=${encodeURIComponent(summary.room)}&ts=${Date.now()}`, { cache: 'no-store' }); if (room.ok) standingsRooms[summary.room] = await room.json(); }
  } catch {}
  if (managementModule === 'standings') render();
}

function eventKind(title) {
  const value = String(title || '').toLocaleLowerCase('pt-BR');
  return /go+l|cesta|ponto/.test(value) ? 'goal' : /amarelo/.test(value) ? 'yellow' : /vermelho/.test(value) ? 'red' : /substitui/.test(value) ? 'sub' : '';
}

function formChips(form = []) {
  return `<span class="form-chips">${form.map(item => `<i class="form-${item === 'V' ? 'w' : item === 'E' ? 'd' : 'l'}" title="${item === 'V' ? 'Vitória' : item === 'E' ? 'Empate' : 'Derrota'}">${item}</i>`).join('')}</span>`;
}

function standingsTableMarkup(rows, teams = [], compact = false) {
  if (!rows.length) return '<div class="portal-empty">Sem partidas finalizadas ainda.</div>';
  const logo = id => { const team = teams.find(item => item.id === id); return team?.logo ? `<img class="table-logo" src="${escapeHtml(team.logo)}" alt="">` : `<span class="table-logo is-initials" style="--team-color:${safeColor(team?.color)}">${escapeHtml((team?.short || '').slice(0, 3))}</span>`; };
  return `<div class="table-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Equipe</th><th>P</th><th>J</th>${compact ? '' : '<th>V</th><th>E</th><th>D</th><th>GP</th><th>GC</th>'}<th>SG</th>${compact ? '' : '<th>Últimos</th>'}</tr></thead><tbody>${rows.map(row => `<tr><td>${row.position}</td><td><span class="table-team">${logo(row.teamId)}${escapeHtml(row.name)}</span></td><td><b>${row.points}</b></td><td>${row.played}</td>${compact ? '' : `<td>${row.won}</td><td>${row.drawn}</td><td>${row.lost}</td><td>${row.gf}</td><td>${row.ga}</td>`}<td>${row.gd}</td>${compact ? '' : `<td>${formChips(row.form)}</td>`}</tr>`).join('')}</tbody></table></div>`;
}

function renderMatchSummary(match) {
  const remote = standingsRooms[match.room];
  const kindLabel = { goal: 'Gol', yellow: 'Cartão amarelo', red: 'Cartão vermelho', sub: 'Substituição' };
  const rows = remote ? [...(remote.events || [])].reverse().map(event => ({ event, kind: eventKind(event.title) })).filter(item => item.kind).map(({ event, kind }) => `<tr><td>${escapeHtml(event.minute || '')}</td><td>${escapeHtml(kindLabel[kind])}</td><td>${escapeHtml(event.team || '')}</td><td>${escapeHtml(event.name || '—')}${event.note ? ` <small>(${escapeHtml(event.note)})</small>` : ''}</td><td>${escapeHtml(event.score || '')}</td></tr>`).join('') || '<tr><td colspan="5">Nenhum lance registrado.</td></tr>' : '<tr><td colspan="5">Carregando súmula…</td></tr>';
  const score = match.homeScore === null ? '–' : `${match.homeScore} × ${match.awayScore}`;
  return `<section class="dashboard-section standings-summary"><div class="section-header"><div><h3 class="section-title">Súmula · ${escapeHtml(match.homeName)} ${score} ${escapeHtml(match.awayName)}</h3><p class="help-text">${escapeHtml(match.round || '')} · ${escapeHtml(operationDate(match.kickoffAt, true))}${match.venue ? ` · ${escapeHtml(match.venue)}` : ''}</p></div><div class="operations-actions"><button class="button" data-action="art-result" data-value="${escapeHtml(match.id)}">Gerar arte do resultado</button><button class="button subtle" data-action="standings-print">Imprimir</button><button class="button subtle" data-action="standings-summary" data-value="">Fechar</button></div></div><table class="standings-table"><thead><tr><th>Min</th><th>Lance</th><th>Equipe</th><th>Atleta</th><th>Placar</th></tr></thead><tbody>${rows}</tbody></table></section>`;
}

function renderStandingsModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  if (!standingsChampionshipId || !operationsData.championships.some(item => item.id === standingsChampionshipId)) standingsChampionshipId = (operationsData.championships.find(item => item.status === 'active') || operationsData.championships[0])?.id || '';
  if (!operationsData.championships.length) return '<div class="portal-empty">Cadastre um campeonato e partidas para gerar a classificação.</div>';
  loadStandingsRooms();
  const options = operationsData.championships.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === standingsChampionshipId ? 'selected' : ''}>${escapeHtml(item.name)}${item.season ? ` · ${escapeHtml(item.season)}` : ''}</option>`).join('');
  const bundle = standingsBundleFor === standingsChampionshipId ? standingsBundle : null;
  if (!bundle) return `<div class="module-section"><div class="field standings-select"><label for="standings-championship">Campeonato</label><select id="standings-championship">${options}</select></div><div class="portal-empty">Carregando classificação…</div></div>`;
  const tables = bundle.groups.length ? bundle.groups.map(group => `<section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Grupo ${escapeHtml(group.group)}</h3></div></div>${standingsTableMarkup(group.table, bundle.teams)}</section>`).join('') : `<section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Classificação</h3><p class="help-text">Pontos: vitória ${bundle.championship.rules.pointsWin}, empate ${bundle.championship.rules.pointsDraw}. Desempate: ${bundle.championship.rules.tiebreakers.map(key => TIEBREAKER_LABELS[key]).join(' › ')}.</p></div><button class="button" data-action="art-standings">Gerar arte da tabela</button></div>${standingsTableMarkup(bundle.standings, bundle.teams)}</section>`;
  const scorerRows = bundle.scorers.slice(0, 10).map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.teamName)}</td><td><b>${item.goals}</b></td></tr>`).join('');
  const cardRows = bundle.cards.slice(0, 10).map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.teamName)}</td><td>${item.yellow}</td><td>${item.red}</td></tr>`).join('');
  const suspended = bundle.suspended.map(item => `<div class="dashboard-mini-row"><span>${escapeHtml(item.name)} · ${escapeHtml(item.teamName)}</span><small>${item.games} jogo(s)</small></div>`).join('');
  const finished = bundle.matches.filter(match => match.status === 'finished');
  const matchRows = finished.map(match => `<button class="operations-item ${standingsSummaryId === match.id ? 'active' : ''}" data-action="standings-summary" data-value="${escapeHtml(match.id)}"><span><strong>${escapeHtml(match.homeName)} ${match.homeScore === null ? '–' : match.homeScore} × ${match.awayScore === null ? '–' : match.awayScore} ${escapeHtml(match.awayName)}</strong><small>${escapeHtml(match.round || 'Rodada')} · ${escapeHtml(operationDate(match.kickoffAt, true))}</small></span><b>Súmula</b></button>`).join('') || '<div class="portal-empty">Sem partidas finalizadas.</div>';
  const openMatch = finished.find(match => match.id === standingsSummaryId);
  const link = bundle.championship.slug ? `${location.origin}/c/${bundle.championship.slug}` : '';
  return `<div class="module-section"><div class="standings-head"><div class="field standings-select"><label for="standings-championship">Campeonato</label><select id="standings-championship">${options}</select></div>${link ? `<a class="button subtle" href="${escapeHtml(link)}" target="_blank" rel="noopener">Abrir página pública</a>` : '<span class="help-text">Publique o campeonato para ter uma página pública.</span>'}</div>
    ${bundle.championship.championName ? `<div class="library-banner is-inherited"><div><strong>Campeão: ${escapeHtml(bundle.championship.championName)}</strong></div></div>` : ''}${tables}
    <div class="dashboard-grid"><section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Artilharia</h3></div></div>${scorerRows ? `<table class="standings-table"><thead><tr><th>#</th><th>Atleta</th><th>Equipe</th><th>Gols</th></tr></thead><tbody>${scorerRows}</tbody></table>` : '<div class="portal-empty">Nenhum gol com autor identificado.</div>'}</section>
    <section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Cartões e suspensões</h3></div></div>${cardRows ? `<table class="standings-table"><thead><tr><th>Atleta</th><th>Equipe</th><th>🟨</th><th>🟥</th></tr></thead><tbody>${cardRows}</tbody></table>` : '<div class="portal-empty">Nenhum cartão registrado.</div>'}${suspended ? `<div class="dashboard-list"><strong>Suspensos para a próxima partida</strong>${suspended}</div>` : ''}</section></div>
    <section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Súmulas das partidas</h3><p class="help-text">Abra a súmula com os lances registrados em cada jogo e gere a arte do resultado.</p></div></div><div class="dashboard-list">${matchRows}</div></section>${openMatch ? renderMatchSummary(openMatch) : ''}</div>`;
}

// ===== Estúdio de artes: peças prontas para redes sociais (canvas → PNG) =====
const ART_FORMATS = [['feed', 'Feed 1:1', 1080, 1080], ['portrait', 'Retrato 4:5', 1080, 1350], ['stories', 'Stories 9:16', 1080, 1920], ['wide', 'Paisagem 16:9', 1920, 1080]];
const ART_TYPES = [
  ['result', 'Resultado do jogo', 'Placar final com escudos', 'match'],
  ['matchday', 'Jogo do dia', 'Confronto, horário e local', 'match'],
  ['round-results', 'Rodada · resultados', 'Todos os placares da rodada', 'round'],
  ['round-fixtures', 'Rodada · próximos jogos', 'Agenda de uma rodada', 'round'],
  ['standings', 'Classificação', 'Tabela dos melhores colocados', 'top'],
  ['scorers', 'Artilharia', 'Ranking de goleadores', 'top'],
  ['discipline', 'Cartões e suspensos', 'Disciplina do campeonato', 'top'],
  ['lineup', 'Escalação confirmada', 'Titulares e técnico de uma equipe', 'lineup'],
  ['champion', 'Campeão', 'Comemoração do título', 'none'],
  ['notice', 'Aviso ou comunicado', 'Título e texto livres', 'text'],
];

function artShade(hex, amount) {
  const value = safeColor(hex, '#8253cd').slice(1);
  const channel = index => { const base = parseInt(value.slice(index * 2, index * 2 + 2), 16); return Math.round(amount < 0 ? base * (1 + amount) : base + (255 - base) * amount); };
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

const ART_THEMES = {
  gold: { name: 'Noite dourada', accent: '#d8ad56', onAccent: '#16120b', text: '#ffffff', muted: '#b4b6c2', panel: 'rgba(255,255,255,.08)', panelAlt: 'rgba(255,255,255,.035)', swatch: ['#07080c', '#1a1233', '#d8ad56'],
    paint(c, w, h, accent) { const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, '#07080c'); g.addColorStop(1, '#1a1233'); c.fillStyle = g; c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(216,173,86,.13)'; c.beginPath(); c.moveTo(w * .55, 0); c.lineTo(w, 0); c.lineTo(w, h * .4); c.closePath(); c.fill(); c.fillStyle = accent; c.fillRect(0, 0, w, 14); } },
  pitch: { name: 'Gramado', accent: '#f2cb79', onAccent: '#10261a', text: '#ffffff', muted: '#cfe6d8', panel: 'rgba(0,0,0,.28)', panelAlt: 'rgba(0,0,0,.14)', swatch: ['#0d4a2b', '#168a4f', '#f2cb79'],
    paint(c, w, h, accent) { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0d4a2b'); g.addColorStop(1, '#146c43'); c.fillStyle = g; c.fillRect(0, 0, w, h); const stripe = w / 10; for (let i = 0; i < 10; i += 2) { c.fillStyle = 'rgba(255,255,255,.05)'; c.fillRect(i * stripe, 0, stripe, h); } c.strokeStyle = 'rgba(255,255,255,.2)'; c.lineWidth = 5; c.strokeRect(36, 36, w - 72, h - 72); c.beginPath(); c.arc(w / 2, h / 2, Math.min(w, h) * .2, 0, Math.PI * 2); c.stroke(); c.beginPath(); c.moveTo(36, h / 2); c.lineTo(w - 36, h / 2); c.stroke(); c.fillStyle = accent; c.fillRect(0, 0, w, 12); } },
  neon: { name: 'Neon', accent: '#00e5ff', onAccent: '#001418', text: '#ffffff', muted: '#a8b3c7', panel: 'rgba(255,255,255,.06)', panelAlt: 'rgba(255,255,255,.025)', glow: true, swatch: ['#05060a', '#ff2bd6', '#00e5ff'],
    paint(c, w, h, accent) { c.fillStyle = '#05060a'; c.fillRect(0, 0, w, h); const a = c.createRadialGradient(w * .1, h * .05, 0, w * .1, h * .05, Math.max(w, h) * .7); a.addColorStop(0, 'rgba(255,43,214,.3)'); a.addColorStop(1, 'rgba(255,43,214,0)'); c.fillStyle = a; c.fillRect(0, 0, w, h); const b = c.createRadialGradient(w * .95, h * .95, 0, w * .95, h * .95, Math.max(w, h) * .7); b.addColorStop(0, 'rgba(0,229,255,.28)'); b.addColorStop(1, 'rgba(0,229,255,0)'); c.fillStyle = b; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(255,255,255,.045)'; c.lineWidth = 2; for (let x = 0; x < w; x += 72) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y < h; y += 72) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } c.fillStyle = accent; c.shadowColor = accent; c.shadowBlur = 24; c.fillRect(0, 0, w, 8); c.shadowBlur = 0; } },
  paper: { name: 'Jornal', accent: '#c1272d', onAccent: '#ffffff', text: '#17140d', muted: '#5b564a', panel: 'rgba(0,0,0,.06)', panelAlt: 'rgba(0,0,0,.025)', light: true, swatch: ['#f3eee2', '#ffffff', '#c1272d'],
    paint(c, w, h, accent) { c.fillStyle = '#f3eee2'; c.fillRect(0, 0, w, h); c.strokeStyle = 'rgba(0,0,0,.035)'; c.lineWidth = 2; for (let i = -h; i < w; i += 22) { c.beginPath(); c.moveTo(i, 0); c.lineTo(i + h, h); c.stroke(); } c.fillStyle = accent; c.fillRect(0, 0, w, 26); c.fillStyle = '#17140d'; c.fillRect(0, 26, w, 4); } },
  diagonal: { name: 'Diagonal', accent: '#2f7df6', onAccent: '#ffffff', text: '#ffffff', muted: '#c4cada', panel: 'rgba(0,0,0,.34)', panelAlt: 'rgba(0,0,0,.18)', swatch: ['#0b0d12', '#2f7df6', '#ffffff'],
    paint(c, w, h, accent) { c.fillStyle = '#0b0d12'; c.fillRect(0, 0, w, h); const g = c.createLinearGradient(0, 0, w, h); g.addColorStop(0, accent); g.addColorStop(1, artShade(accent, -.45)); c.fillStyle = g; c.beginPath(); c.moveTo(0, 0); c.lineTo(w * .66, 0); c.lineTo(w * .3, h); c.lineTo(0, h); c.closePath(); c.fill(); c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 8; c.beginPath(); c.moveTo(w * .7, 0); c.lineTo(w * .34, h); c.stroke(); } },
  mono: { name: 'Minimalista', accent: '#8253cd', onAccent: '#ffffff', text: '#ffffff', muted: 'rgba(255,255,255,.72)', panel: 'rgba(255,255,255,.12)', panelAlt: 'rgba(255,255,255,.06)', swatch: ['#3a2766', '#8253cd', '#ffffff'],
    paint(c, w, h, accent) { c.fillStyle = artShade(accent, -.55); c.fillRect(0, 0, w, h); c.fillStyle = 'rgba(255,255,255,.07)'; c.beginPath(); c.arc(w * .92, h * .08, Math.min(w, h) * .38, 0, Math.PI * 2); c.fill(); } },
};

const ART_OPTIONS_KEY = 'juventude.artes.v1';
function loadArtOptions() {
  const defaults = { championshipId: '', type: 'result', theme: 'gold', format: 'feed', matchId: '', round: '', side: 'home', topN: 8, title: '', text: '', accent: '', logos: true, sponsors: true, brand: true };
  try { return { ...defaults, ...(JSON.parse(localStorage.getItem(ART_OPTIONS_KEY)) || {}) }; } catch { return defaults; }
}
let artOptions = loadArtOptions();
let artBundle = null;
let artBundleFor = '';
let artBundleAt = 0;
let artSponsorImages = [];
let artSponsorsLoaded = false;
let artStudio = { sig: '', busy: false, url: '', blob: null, error: '', width: 0, height: 0 };
let artTimer = 0;
let artPreview = null;

function saveArtOptions() { try { localStorage.setItem(ART_OPTIONS_KEY, JSON.stringify(artOptions)); } catch {} }

function artImage(url) {
  return new Promise(resolve => {
    if (!url || !String(url).startsWith('/')) { resolve(null); return; }
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = url;
  });
}

function artWrap(g, text, maxWidth, size, weight, body) {
  const { ctx } = g;
  ctx.font = `${weight} ${size}px ${body ? 'Roboto, Arial, sans-serif' : '"Barlow Condensed", "Arial Narrow", sans-serif'}`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  const lines = [];
  for (const paragraph of String(text).split(/\n/)) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) { lines.push(line); line = word; } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

// Texto: tamanho em unidades de 1080 (multiplicado por g.u); x, y e max em pixels absolutos.
function artT(g, text, x, y, o = {}) {
  const { ctx, u, theme } = g;
  let size = (o.size || 40) * u;
  const family = o.body ? 'Roboto, Arial, sans-serif' : '"Barlow Condensed", "Arial Narrow", sans-serif';
  ctx.textAlign = o.align || 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = o.color || theme.text;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${(o.spacing || 0) * u}px`;
  const value = o.upper ? String(text).toUpperCase() : String(text);
  ctx.font = `${o.weight || 700} ${size}px ${family}`;
  let shown = value;
  if (o.max) {
    while (ctx.measureText(shown).width > o.max && size > (o.size || 40) * u * .62) { size -= 2; ctx.font = `${o.weight || 700} ${size}px ${family}`; }
    let guard = 0;
    while (ctx.measureText(shown).width > o.max && shown.length > 3 && guard++ < 120) shown = `${shown.slice(0, -2).trimEnd()}…`;
  }
  if (theme.glow && o.glow) { ctx.shadowColor = o.color || g.accent; ctx.shadowBlur = 18 * u; }
  ctx.fillText(shown, x, y);
  ctx.shadowBlur = 0;
}

function artBadge(g, team, cx, cy, r) {
  const { ctx, u } = g;
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.closePath();
  ctx.fillStyle = '#ffffff'; ctx.fill(); ctx.clip();
  const image = g.options.logos ? g.images[team?.id] : null;
  if (image) ctx.drawImage(image, cx - r * .8, cy - r * .8, r * 1.6, r * 1.6);
  else { ctx.fillStyle = team?.color || '#8253cd'; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); artT(g, team?.short || '?', cx, cy, { size: r / u * .72, color: '#ffffff' }); }
  ctx.restore();
  ctx.lineWidth = Math.max(3, 6 * u); ctx.strokeStyle = g.accent; ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
}

function artPanel(g, x, y, w, h, alt = false, accent = false) {
  const { ctx, u } = g;
  ctx.fillStyle = accent ? g.accent : alt ? g.theme.panelAlt : g.theme.panel;
  const r = 14 * u;
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); ctx.fill();
}

function artTeams(g, match) {
  const find = id => g.bundle.teams.find(team => team.id === id) || { id, name: id, short: String(id).slice(0, 3).toUpperCase(), color: '#8253cd' };
  return { home: { ...find(match.homeTeamId), name: match.homeName || find(match.homeTeamId).name }, away: { ...find(match.awayTeamId), name: match.awayName || find(match.awayTeamId).name } };
}

function artWhen(match, long = false) {
  const date = match.kickoffAt ? new Date(match.kickoffAt) : null;
  if (!date || Number.isNaN(date.getTime())) return { day: 'A DEFINIR', time: '', short: '', long: '' };
  const sameDay = date.toDateString() === new Date().toDateString();
  return {
    day: sameDay ? 'HOJE' : new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date).toUpperCase(),
    time: new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(date),
    short: new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(date).replace('.', '').toUpperCase(),
    long: new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full', timeStyle: 'short' }).format(date),
  };
}

function artScore(match) {
  return match.homeScore === null || match.awayScore === null ? null : [match.homeScore, match.awayScore];
}

function artRows(g, body, count, { min = 58, max = 104 } = {}) {
  const fit = Math.max(1, Math.floor(body.h / (min * g.u)));
  const shown = Math.min(count, fit);
  const rowH = Math.min(max * g.u, body.h / Math.max(1, shown));
  return { shown, rowH, top: body.y + Math.max(0, (body.h - rowH * shown) / 2) };
}

function artEmpty(g, body, message) {
  artT(g, message, g.w / 2, body.y + body.h / 2, { size: 44, weight: 500, color: g.theme.muted, body: true, max: body.w });
}

const ART_DRAWERS = {
  result(g, body) {
    const match = g.bundle.matches.find(item => item.id === g.options.matchId);
    if (!match) return artEmpty(g, body, 'Escolha uma partida');
    const { home, away } = artTeams(g, match);
    const wide = g.w > g.h * 1.3;
    const r = Math.min(body.w * (wide ? .09 : .12), body.h * .2, 120 * g.u);
    const cy = body.y + body.h * (wide ? .4 : .34);
    const lx = body.x + body.w * .17;
    const rx = body.x + body.w * .83;
    artBadge(g, home, lx, cy, r); artBadge(g, away, rx, cy, r);
    const score = artScore(match);
    artT(g, score ? `${score[0]}  ×  ${score[1]}` : 'VS', g.w / 2, cy, { size: Math.min(body.w * .13, body.h * .2, 150 * g.u) / g.u, glow: true, max: body.w * .3 });
    artT(g, home.name, lx, cy + r + 62 * g.u, { size: 50, upper: true, max: body.w * .34 });
    artT(g, away.name, rx, cy + r + 62 * g.u, { size: 50, upper: true, max: body.w * .34 });
    if (match.homePenalties !== null && match.awayPenalties !== null) artT(g, `(${match.homePenalties} × ${match.awayPenalties} nos pênaltis)`, g.w / 2, cy + r * 1.35, { size: 38, weight: 500, color: g.accent, body: true });
    const when = artWhen(match);
    const lineY = body.y + body.h * .78;
    artT(g, [match.round, match.status === 'finished' ? 'FIM DE JOGO' : match.status === 'live' ? 'AO VIVO' : ''].filter(Boolean).join('  ·  '), g.w / 2, lineY, { size: 40, upper: true, spacing: 5, color: g.accent });
    artT(g, when.long, g.w / 2, lineY + 58 * g.u, { size: 34, weight: 500, color: g.theme.muted, body: true, max: body.w });
    if (match.venue) artT(g, match.venue, g.w / 2, lineY + 106 * g.u, { size: 32, weight: 500, color: g.theme.muted, body: true, max: body.w });
  },
  matchday(g, body) {
    const match = g.bundle.matches.find(item => item.id === g.options.matchId);
    if (!match) return artEmpty(g, body, 'Escolha uma partida');
    const { home, away } = artTeams(g, match);
    const when = artWhen(match);
    const wide = g.w > g.h * 1.3;
    artT(g, when.day === 'HOJE' ? 'JOGO DO DIA' : 'PRÓXIMO JOGO', g.w / 2, body.y + body.h * .09, { size: 52, spacing: 10, color: g.accent, glow: true });
    const r = Math.min(body.w * (wide ? .11 : .15), body.h * .21, 150 * g.u);
    const cy = body.y + body.h * (wide ? .42 : .36);
    const lx = body.x + body.w * .19;
    const rx = body.x + body.w * .81;
    artBadge(g, home, lx, cy, r); artBadge(g, away, rx, cy, r);
    artT(g, 'VS', g.w / 2, cy, { size: Math.min(body.w * .15, 150 * g.u) / g.u, glow: true });
    artT(g, home.name, lx, cy + r + 60 * g.u, { size: 50, upper: true, max: body.w * .36 });
    artT(g, away.name, rx, cy + r + 60 * g.u, { size: 50, upper: true, max: body.w * .36 });
    const base = body.y + body.h * .76;
    artT(g, when.time || 'A DEFINIR', g.w / 2, base, { size: Math.min(body.w * .16, 150 * g.u) / g.u, color: g.accent, glow: true });
    artT(g, when.day === 'HOJE' ? 'HOJE' : when.day, g.w / 2, base + 84 * g.u, { size: 40, upper: true, spacing: 4, max: body.w });
    if (match.venue) artT(g, match.venue, g.w / 2, base + 138 * g.u, { size: 34, weight: 500, color: g.theme.muted, body: true, max: body.w });
  },
  'round-results': (g, body) => artRoundList(g, body, true),
  'round-fixtures': (g, body) => artRoundList(g, body, false),
  standings(g, body) {
    const rows = (g.bundle.standings.length ? g.bundle.standings : g.bundle.groups.flatMap(group => group.table)).slice(0, g.options.topN);
    if (!rows.length) return artEmpty(g, body, 'Sem jogos finalizados ainda');
    const { shown, rowH, top } = artRows(g, body, rows.length, { min: 62, max: 96 });
    const columns = [['P', 0], ['J', 1], ['SG', 2], ['GP', 3]].slice(0, g.w > g.h ? 4 : 3);
    const right = body.x + body.w - 50 * g.u;
    columns.forEach(([label, index]) => artT(g, label, right - (columns.length - 1 - index) * 110 * g.u, top - 22 * g.u, { size: 28, weight: 500, color: g.theme.muted, body: true }));
    rows.slice(0, shown).forEach((row, index) => {
      const y = top + rowH * index + rowH / 2;
      artPanel(g, body.x, y - rowH / 2 + 4 * g.u, body.w, rowH - 8 * g.u, index % 2 === 1, index === 0);
      const onFirst = index === 0 ? g.theme.onAccent : g.theme.text;
      artT(g, row.position, body.x + 46 * g.u, y, { size: 44, color: index === 0 ? onFirst : index < 3 ? g.accent : g.theme.text });
      artT(g, row.name, body.x + 100 * g.u, y, { size: 44, upper: true, align: 'left', color: onFirst, max: body.w - 460 * g.u });
      const values = [row.points, row.played, row.gd, row.gf];
      columns.forEach(([, valueIndex], position) => artT(g, values[valueIndex], right - (columns.length - 1 - position) * 110 * g.u, y, { size: 44, color: position === 0 ? (index === 0 ? onFirst : g.accent) : onFirst }));
    });
  },
  scorers(g, body) {
    const rows = g.bundle.scorers.slice(0, g.options.topN);
    if (!rows.length) return artEmpty(g, body, 'Nenhum gol com autor identificado');
    const { shown, rowH, top } = artRows(g, body, rows.length, { min: 70, max: 104 });
    rows.slice(0, shown).forEach((row, index) => {
      const y = top + rowH * index + rowH / 2;
      artPanel(g, body.x, y - rowH / 2 + 4 * g.u, body.w, rowH - 8 * g.u, index % 2 === 1, index === 0);
      const color = index === 0 ? g.theme.onAccent : g.theme.text;
      artT(g, index + 1, body.x + 46 * g.u, y, { size: 46, color: index === 0 ? color : index < 3 ? g.accent : g.theme.text });
      artT(g, row.name, body.x + 100 * g.u, y - 12 * g.u, { size: 44, upper: true, align: 'left', color, max: body.w - 300 * g.u });
      artT(g, row.teamName, body.x + 100 * g.u, y + 26 * g.u, { size: 26, weight: 500, align: 'left', color: index === 0 ? color : g.theme.muted, body: true, max: body.w - 300 * g.u });
      artT(g, row.goals, body.x + body.w - 60 * g.u, y, { size: 62, color: index === 0 ? color : g.accent, glow: true });
    });
  },
  discipline(g, body) {
    const cards = g.bundle.cards.slice(0, g.options.topN);
    const suspended = g.bundle.suspended.slice(0, 5);
    if (!cards.length && !suspended.length) return artEmpty(g, body, 'Nenhum cartão registrado');
    const total = cards.length + (suspended.length ? suspended.length + 1 : 0);
    const { shown, rowH, top } = artRows(g, body, total, { min: 66, max: 96 });
    let index = 0;
    for (const row of cards.slice(0, Math.max(0, shown - (suspended.length ? suspended.length + 1 : 0)))) {
      const y = top + rowH * index + rowH / 2;
      artPanel(g, body.x, y - rowH / 2 + 4 * g.u, body.w, rowH - 8 * g.u, index % 2 === 1);
      artT(g, row.name, body.x + 40 * g.u, y - 10 * g.u, { size: 42, upper: true, align: 'left', max: body.w - 330 * g.u });
      artT(g, row.teamName, body.x + 40 * g.u, y + 26 * g.u, { size: 25, weight: 500, align: 'left', color: g.theme.muted, body: true, max: body.w - 330 * g.u });
      g.ctx.fillStyle = '#f1bf52'; g.ctx.fillRect(body.x + body.w - 250 * g.u, y - 22 * g.u, 30 * g.u, 42 * g.u);
      artT(g, row.yellow, body.x + body.w - 190 * g.u, y, { size: 46 });
      g.ctx.fillStyle = '#fa626e'; g.ctx.fillRect(body.x + body.w - 130 * g.u, y - 22 * g.u, 30 * g.u, 42 * g.u);
      artT(g, row.red, body.x + body.w - 70 * g.u, y, { size: 46 });
      index += 1;
    }
    if (suspended.length) {
      artT(g, 'SUSPENSOS PARA A PRÓXIMA', g.w / 2, top + rowH * index + rowH / 2, { size: 36, spacing: 6, color: g.accent });
      index += 1;
      for (const row of suspended) {
        const y = top + rowH * index + rowH / 2;
        artT(g, `${row.name} · ${row.teamName}`, body.x + 40 * g.u, y, { size: 38, upper: true, align: 'left', max: body.w - 220 * g.u });
        artT(g, `${row.games} jogo(s)`, body.x + body.w - 40 * g.u, y, { size: 32, weight: 500, align: 'right', color: g.theme.muted, body: true });
        index += 1;
      }
    }
  },
  lineup(g, body) {
    const match = g.bundle.matches.find(item => item.id === g.options.matchId);
    if (!match) return artEmpty(g, body, 'Escolha uma partida');
    const { home, away } = artTeams(g, match);
    const side = g.options.side === 'away' ? away : home;
    const opponent = side === away ? home : away;
    const team = (g.catalog || []).find(item => item.id === side.id);
    const athletes = Array.isArray(team?.athletes) ? team.athletes : [];
    const squad = team?.matchSquads?.[match.id];
    const starters = (squad?.starters?.length ? squad.starters.map(id => athletes.find(item => item.id === id)).filter(Boolean) : athletes.filter(item => item.squadRole !== 'reserve')).slice(0, 12);
    artBadge(g, side, g.w / 2, body.y + 74 * g.u, 62 * g.u);
    artT(g, side.name, g.w / 2, body.y + 178 * g.u, { size: 62, upper: true, max: body.w, glow: true });
    artT(g, `ESCALAÇÃO · ${[`x ${opponent.name}`, artWhen(match).short].filter(Boolean).join(' · ')}`.toUpperCase(), g.w / 2, body.y + 232 * g.u, { size: 30, weight: 500, spacing: 4, color: g.theme.muted, body: true, max: body.w });
    if (!starters.length) return artEmpty(g, { ...body, y: body.y + 260 * g.u, h: body.h - 260 * g.u }, 'Escalação ainda não definida');
    const columns = g.w > g.h ? 3 : 2;
    const perColumn = Math.ceil(starters.length / columns);
    const area = { x: body.x, y: body.y + 275 * g.u, w: body.w, h: body.h - 275 * g.u - 70 * g.u };
    const rowH = Math.min(88 * g.u, area.h / perColumn);
    const columnW = area.w / columns;
    starters.forEach((athlete, index) => {
      const column = Math.floor(index / perColumn);
      const row = index % perColumn;
      const x = area.x + columnW * column;
      const y = area.y + rowH * row + rowH / 2;
      artPanel(g, x + 6 * g.u, y - rowH / 2 + 4 * g.u, columnW - 12 * g.u, rowH - 8 * g.u, row % 2 === 1);
      artT(g, athlete.number || '', x + 52 * g.u, y, { size: 46, color: g.accent, glow: true });
      artT(g, athlete.name || '', x + 100 * g.u, y - (athlete.position ? 8 * g.u : 0), { size: 38, upper: true, align: 'left', max: columnW - 120 * g.u });
      if (athlete.position) artT(g, athlete.position, x + 100 * g.u, y + 24 * g.u, { size: 22, weight: 500, align: 'left', color: g.theme.muted, body: true });
    });
    const coach = (Array.isArray(team?.staff) ? team.staff.find(member => member.role === 'Treinador') : null)?.name || team?.coach?.name || '';
    const formation = squad?.formation || team?.formation || '';
    artT(g, [coach ? `TÉCNICO: ${coach}` : '', formation ? `ESQUEMA ${formation}` : ''].filter(Boolean).join('   ·   ').toUpperCase(), g.w / 2, body.y + body.h - 30 * g.u, { size: 32, weight: 500, spacing: 3, color: g.accent, body: true, max: body.w });
  },
  champion(g, body) {
    const info = g.bundle.championship;
    const team = g.bundle.teams.find(item => item.id === info.championId);
    if (!team) return artEmpty(g, body, 'O campeão aparece quando a final termina');
    const { ctx, u } = g;
    const cx = g.w / 2;
    const top = body.y + body.h * .05;
    ctx.fillStyle = g.accent;
    ctx.beginPath(); ctx.moveTo(cx - 90 * u, top); ctx.lineTo(cx + 90 * u, top); ctx.quadraticCurveTo(cx + 90 * u, top + 150 * u, cx, top + 170 * u); ctx.quadraticCurveTo(cx - 90 * u, top + 150 * u, cx - 90 * u, top); ctx.fill();
    ctx.fillRect(cx - 14 * u, top + 165 * u, 28 * u, 56 * u); ctx.fillRect(cx - 64 * u, top + 219 * u, 128 * u, 24 * u);
    ctx.lineWidth = 16 * u; ctx.strokeStyle = g.accent; ctx.beginPath(); ctx.arc(cx - 96 * u, top + 62 * u, 40 * u, Math.PI * .5, Math.PI * 1.5); ctx.stroke(); ctx.beginPath(); ctx.arc(cx + 96 * u, top + 62 * u, 40 * u, Math.PI * 1.5, Math.PI * .5); ctx.stroke();
    artT(g, 'CAMPEÃO', cx, body.y + body.h * .36, { size: Math.min(body.w * .2, 200 * u) / u, color: g.accent, glow: true, spacing: 6, max: body.w });
    artBadge(g, team, cx, body.y + body.h * .58, Math.min(body.w * .16, body.h * .14, 130 * u));
    artT(g, team.name, cx, body.y + body.h * .76, { size: 76, upper: true, max: body.w, glow: true });
    artT(g, [info.name, info.season].filter(Boolean).join(' · '), cx, body.y + body.h * .86, { size: 38, weight: 500, color: g.theme.muted, body: true, upper: true, spacing: 3, max: body.w });
  },
  notice(g, body) {
    const title = g.options.title || 'AVISO';
    const lines = artWrap(g, g.options.text || 'Escreva o texto do aviso no painel ao lado.', body.w - 40 * g.u, 50 * g.u, 500, true);
    const bodySize = lines.length > 9 ? 40 : lines.length > 6 ? 46 : 52;
    const wrapped = artWrap(g, g.options.text || 'Escreva o texto do aviso no painel ao lado.', body.w - 40 * g.u, bodySize * g.u, 500, true);
    const titleLines = artWrap(g, String(title).toUpperCase(), body.w, 96 * g.u, 700, false);
    const titleH = titleLines.length * 100 * g.u;
    const textH = wrapped.length * bodySize * 1.4 * g.u;
    let y = body.y + Math.max(20 * g.u, (body.h - titleH - textH - 60 * g.u) / 2);
    g.ctx.fillStyle = g.accent; g.ctx.fillRect(body.x + 20 * g.u, y, 140 * g.u, 10 * g.u);
    y += 70 * g.u;
    for (const line of titleLines) { artT(g, line, body.x + 20 * g.u, y, { size: 96, align: 'left', glow: true, color: g.theme.text }); y += 100 * g.u; }
    y += 20 * g.u;
    for (const line of wrapped) { artT(g, line, body.x + 20 * g.u, y, { size: bodySize, weight: 500, align: 'left', body: true, color: g.theme.text }); y += bodySize * 1.4 * g.u; }
  },
};

function artRoundList(g, body, results) {
  const rounds = g.options.round ? g.bundle.matches.filter(match => match.round === g.options.round) : [];
  if (!rounds.length) return artEmpty(g, body, 'Escolha uma rodada');
  const { shown, rowH, top } = artRows(g, body, rounds.length, { min: 74, max: g.h > g.w ? 150 : 116 });
  const center = g.w / 2;
  const centerW = 190 * g.u;
  rounds.slice(0, shown).forEach((match, index) => {
    const { home, away } = artTeams(g, match);
    const y = top + rowH * index + rowH / 2;
    artPanel(g, body.x, y - rowH / 2 + 4 * g.u, body.w, rowH - 8 * g.u, index % 2 === 1);
    const r = Math.min(rowH * .3, 40 * g.u);
    const badgeGap = centerW / 2 + r + 14 * g.u;
    artBadge(g, home, center - badgeGap, y, r); artBadge(g, away, center + badgeGap, y, r);
    const nameMax = (body.w - centerW - r * 4 - 60 * g.u) / 2;
    artT(g, home.name, center - badgeGap - r - 16 * g.u, y, { size: 38, upper: true, align: 'right', max: nameMax });
    artT(g, away.name, center + badgeGap + r + 16 * g.u, y, { size: 38, upper: true, align: 'left', max: nameMax });
    const score = artScore(match);
    if (results) artT(g, score ? `${score[0]} × ${score[1]}` : '– × –', center, y, { size: 54, color: score ? g.accent : g.theme.muted, glow: Boolean(score) });
    else { const when = artWhen(match); artT(g, when.time || '--:--', center, y - 12 * g.u, { size: 46, color: g.accent }); artT(g, when.short, center, y + 24 * g.u, { size: 24, weight: 500, color: g.theme.muted, body: true }); }
  });
  if (shown < rounds.length) artT(g, `+ ${rounds.length - shown} jogo(s)`, center, top + rowH * shown + 24 * g.u, { size: 28, weight: 500, color: g.theme.muted, body: true });
}

async function renderArt(bundle, options, extras = {}) {
  const format = ART_FORMATS.find(([key]) => key === options.format) || ART_FORMATS[0];
  const [, , width, height] = format;
  const theme = ART_THEMES[options.theme] || ART_THEMES.gold;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  try { await Promise.all([document.fonts.load('700 60px "Barlow Condensed"'), document.fonts.load('500 40px "Barlow Condensed"'), document.fonts.load('500 30px "Roboto"'), document.fonts.load('700 30px "Roboto"')]); } catch {}
  const accent = options.accent && /^#[0-9a-f]{6}$/i.test(options.accent) ? options.accent : theme.accent;
  const u = Math.min(width, height) / 1080;
  theme.paint(ctx, width, height, accent);
  const images = {};
  await Promise.all(bundle.teams.map(async team => { const image = await artImage(team.logo); if (image) images[team.id] = image; }));
  const g = { ctx, w: width, h: height, u, theme, accent, bundle, options, images, catalog: extras.catalog || [] };
  const pad = 64 * u;
  const typeInfo = ART_TYPES.find(([key]) => key === options.type) || ART_TYPES[0];
  const sponsors = options.sponsors ? (extras.sponsors || []).slice(0, 5) : [];
  const footerH = (options.brand ? 120 : 40) * u + (sponsors.length ? 120 * u : 0);
  const headerH = (width > height * 1.3 ? 190 : 230) * u;
  artT(g, bundle.championship.name, width / 2, 96 * u, { size: 56, color: accent, spacing: 4, upper: true, max: width - pad * 2, glow: true });
  artT(g, options.title && options.type !== 'notice' ? options.title : typeInfo[1], width / 2, 164 * u, { size: 38, weight: 500, color: theme.muted, spacing: 7, upper: true, body: true, max: width - pad * 2 });
  const body = { x: pad, y: headerH, w: width - pad * 2, h: height - headerH - footerH };
  (ART_DRAWERS[options.type] || ART_DRAWERS.result)(g, body);
  let footerY = height - footerH;
  if (sponsors.length) {
    const images2 = await Promise.all(sponsors.map(item => artImage(item.wideAsset || item.banner || item.logo)));
    const usable = images2.filter(Boolean);
    if (usable.length) {
      const slotW = Math.min(260 * u, (width - pad * 2) / usable.length - 16 * u);
      const total = usable.length * (slotW + 16 * u) - 16 * u;
      usable.forEach((image, index) => {
        const x = width / 2 - total / 2 + index * (slotW + 16 * u);
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.roundRect?.(x, footerY + 6 * u, slotW, 88 * u, 12 * u); if (!ctx.roundRect) ctx.rect(x, footerY + 6 * u, slotW, 88 * u); ctx.fill();
        const scale = Math.min((slotW - 20 * u) / image.width, (88 * u - 16 * u) / image.height);
        ctx.drawImage(image, x + (slotW - image.width * scale) / 2, footerY + 6 * u + (88 * u - image.height * scale) / 2, image.width * scale, image.height * scale);
      });
    }
    footerY += 120 * u;
  }
  if (options.brand) {
    artT(g, 'JUVENTUDE ESPORTE CLUBE', width / 2, height - 66 * u, { size: 32, color: accent, spacing: 8 });
    artT(g, location.host, width / 2, height - 26 * u, { size: 22, weight: 500, color: theme.muted, body: true });
  }
  return canvas;
}

async function loadArtBundle(force = false) {
  if (!isAdminPanel || adminSession.status !== 'authenticated' || managementModule !== 'arts') return;
  if (!artOptions.championshipId || !operationsData.championships.some(item => item.id === artOptions.championshipId)) {
    artOptions.championshipId = (operationsData.championships.find(item => item.status === 'active') || operationsData.championships[0])?.id || '';
    saveArtOptions();
  }
  if (!artOptions.championshipId) return;
  if (!force && artBundleFor === artOptions.championshipId && Date.now() - artBundleAt < 15000) return;
  artBundleAt = Date.now();
  try {
    const response = await fetch(`/api/public/championship?id=${encodeURIComponent(artOptions.championshipId)}&ts=${Date.now()}`, { cache: 'no-store' });
    if (response.ok) { artBundle = await response.json(); artBundleFor = artOptions.championshipId; }
  } catch {}
  if (managementModule === 'arts') render();
}

async function loadArtSponsors() {
  if (artSponsorsLoaded) return;
  artSponsorsLoaded = true;
  try {
    const response = await fetch(`/api/state?room=${LIBRARY_ROOM}`, { cache: 'no-store' });
    const remote = response.ok ? await response.json() : null;
    if (remote?.updatedAt) artSponsorImages = normalizeState(remote).sponsors.filter(item => String(item.wideAsset || item.banner || item.logo || '').startsWith('/'));
  } catch {}
}

// Escolhe padrões úteis (partida, rodada) quando o campeonato muda ou ainda não há escolha.
function artDefaults(bundle) {
  const matches = bundle.matches;
  const valid = id => matches.some(match => match.id === id);
  if (!valid(artOptions.matchId)) {
    const finished = matches.filter(match => match.status === 'finished').pop();
    const upcoming = matches.find(match => match.status === 'scheduled' || match.status === 'live');
    artOptions.matchId = (artOptions.type === 'matchday' ? upcoming || finished : finished || upcoming)?.id || matches[0]?.id || '';
  }
  const rounds = [...new Set(matches.map(match => match.round).filter(Boolean))];
  if (!rounds.includes(artOptions.round)) artOptions.round = (artOptions.type === 'round-fixtures' ? matches.find(match => match.status !== 'finished') : [...matches].reverse().find(match => match.status === 'finished'))?.round || rounds[0] || '';
}

function scheduleArtRender(bundle) {
  const signature = JSON.stringify([artOptions, bundle.generatedAt, artSponsorImages.length, teamCatalog.length]);
  if (artStudio.sig === signature) return;
  clearTimeout(artTimer);
  artTimer = setTimeout(async () => {
    artStudio.sig = signature;
    try {
      const canvas = await renderArt(bundle, artOptions, { catalog: teamCatalog, sponsors: artSponsorImages });
      const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (artStudio.url) URL.revokeObjectURL(artStudio.url);
      artStudio = { ...artStudio, sig: signature, url: blob ? URL.createObjectURL(blob) : '', blob, error: blob ? '' : 'Não foi possível gerar a imagem.', width: canvas.width, height: canvas.height };
    } catch (error) { artStudio = { ...artStudio, error: 'Falha ao desenhar a arte.' }; }
    if (managementModule === 'arts') render();
  }, 140);
}

function scheduleArtRenderSoon() {
  if (artBundle && artBundleFor === artOptions.championshipId) { artDefaults(artBundle); scheduleArtRender(artBundle); }
}

function renderArtsModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  if (!operationsData.championships.length) return '<div class="portal-empty">Cadastre um campeonato (e partidas) para gerar artes.</div>';
  loadArtBundle();
  loadArtSponsors();
  const bundle = artBundleFor === artOptions.championshipId ? artBundle : null;
  const championshipOptions = operationsData.championships.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === artOptions.championshipId ? 'selected' : ''}>${escapeHtml(item.name)}${item.season ? ` · ${escapeHtml(item.season)}` : ''}</option>`).join('');
  const typeInfo = ART_TYPES.find(([key]) => key === artOptions.type) || ART_TYPES[0];
  const typeCards = ART_TYPES.map(([key, name, caption]) => `<button type="button" class="art-type ${artOptions.type === key ? 'active' : ''}" data-action="arts-set" data-value="type|${key}" aria-pressed="${artOptions.type === key}"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(caption)}</small></button>`).join('');
  const themeCards = Object.entries(ART_THEMES).map(([key, theme]) => `<button type="button" class="art-theme ${artOptions.theme === key ? 'active' : ''}" data-action="arts-set" data-value="theme|${key}" aria-pressed="${artOptions.theme === key}"><span style="background:linear-gradient(135deg, ${theme.swatch[0]} 0 45%, ${theme.swatch[1]} 45% 75%, ${theme.swatch[2]} 75%)"></span>${escapeHtml(theme.name)}</button>`).join('');
  const formatChips = ART_FORMATS.map(([key, label]) => `<button type="button" class="access-chip ${artOptions.format === key ? 'active' : ''}" data-action="arts-set" data-value="format|${key}" aria-pressed="${artOptions.format === key}">${escapeHtml(label)}</button>`).join('');
  let dataControls = '';
  if (bundle) {
    artDefaults(bundle);
    const matchOptions = [...bundle.matches].sort((a, b) => (b.status === 'finished') - (a.status === 'finished') || String(b.kickoffAt).localeCompare(String(a.kickoffAt))).map(match => `<option value="${escapeHtml(match.id)}" ${match.id === artOptions.matchId ? 'selected' : ''}>${escapeHtml(match.homeName)} ${match.homeScore === null ? '×' : `${match.homeScore} × ${match.awayScore}`} ${escapeHtml(match.awayName)} · ${escapeHtml(match.round || '')}</option>`).join('');
    const rounds = [...new Set(bundle.matches.map(match => match.round).filter(Boolean))];
    const match = bundle.matches.find(item => item.id === artOptions.matchId);
    const kind = typeInfo[3];
    dataControls = `${kind === 'match' || kind === 'lineup' ? `<div class="field"><label for="art-match">Partida</label><select id="art-match" data-art-field="matchId">${matchOptions}</select></div>` : ''}${kind === 'round' ? `<div class="field"><label for="art-round">Rodada ou fase</label><select id="art-round" data-art-field="round">${rounds.map(round => `<option value="${escapeHtml(round)}" ${round === artOptions.round ? 'selected' : ''}>${escapeHtml(round)}</option>`).join('')}</select></div>` : ''}${kind === 'lineup' && match ? `<div class="field"><label for="art-side">Equipe</label><select id="art-side" data-art-field="side"><option value="home" ${artOptions.side !== 'away' ? 'selected' : ''}>${escapeHtml(match.homeName)}</option><option value="away" ${artOptions.side === 'away' ? 'selected' : ''}>${escapeHtml(match.awayName)}</option></select></div>` : ''}${kind === 'top' ? `<div class="field"><label for="art-top">Quantidade de linhas</label><input id="art-top" type="number" min="3" max="20" data-art-field="topN" value="${artOptions.topN}"></div>` : ''}${kind === 'text' ? '<div class="field"><label for="art-notice-title">Título</label><input id="art-notice-title" data-art-field="title" maxlength="80" value="' + escapeHtml(artOptions.title) + '"></div><div class="field"><label for="art-notice-text">Texto</label><textarea id="art-notice-text" data-art-field="text" maxlength="600" rows="5">' + escapeHtml(artOptions.text) + '</textarea></div>' : kind !== 'text' ? `<div class="field"><label for="art-subtitle">Subtítulo (opcional)</label><input id="art-subtitle" data-art-field="title" maxlength="60" value="${escapeHtml(artOptions.title)}" placeholder="${escapeHtml(typeInfo[1])}"></div>` : ''}`;
  }
  const batch = bundle && (artOptions.type === 'result' || artOptions.type === 'matchday') ? '<button class="button" data-action="arts-batch">Gerar de todos os jogos da rodada</button>' : '';
  const preview = !bundle ? '<div class="art-placeholder">Carregando dados do campeonato…</div>' : artStudio.error ? `<div class="art-placeholder">${escapeHtml(artStudio.error)}</div>` : artStudio.url ? `<img class="art-canvas" src="${escapeHtml(artStudio.url)}" alt="Prévia da arte" style="aspect-ratio:${artStudio.width}/${artStudio.height}">` : '<div class="art-placeholder">Gerando a arte…</div>';
  if (bundle) scheduleArtRender(bundle);
  return `<div class="arts-layout"><aside class="arts-controls"><section><h3 class="arts-step"><b>1</b> Tipo de arte</h3><div class="art-types">${typeCards}</div></section><section><h3 class="arts-step"><b>2</b> Dados</h3><div class="field"><label for="art-championship">Campeonato</label><select id="art-championship" data-art-field="championshipId">${championshipOptions}</select></div>${dataControls}</section><section><h3 class="arts-step"><b>3</b> Estilo</h3><div class="art-themes">${themeCards}</div><div class="field"><label>Formato</label><div class="access-chips">${formatChips}</div></div><div class="builder-color-field"><label><input type="color" data-art-field="accent" value="${safeColor(artOptions.accent || (ART_THEMES[artOptions.theme] || ART_THEMES.gold).accent, '#d8ad56')}"><span>Cor de destaque${artOptions.accent ? '' : ' (do estilo)'}</span></label><button class="button subtle" data-action="arts-set" data-value="accent|" ${artOptions.accent ? '' : 'disabled'}>Padrão</button></div><label class="builder-check"><input type="checkbox" data-art-field="logos" ${artOptions.logos ? 'checked' : ''}> Mostrar escudos</label><label class="builder-check"><input type="checkbox" data-art-field="sponsors" ${artOptions.sponsors ? 'checked' : ''}> Patrocinadores no rodapé${artSponsorImages.length ? '' : ' (cadastre na biblioteca)'}</label><label class="builder-check"><input type="checkbox" data-art-field="brand" ${artOptions.brand ? 'checked' : ''}> Assinatura do clube</label></section></aside>
    <section class="arts-stage"><div class="arts-actions"><button class="button primary" data-action="arts-download" ${artStudio.blob ? '' : 'disabled'}>Baixar PNG</button><button class="button" data-action="arts-share" ${artStudio.blob ? '' : 'disabled'}>Compartilhar</button>${artStudio.url ? `<a class="button subtle" href="${escapeHtml(artStudio.url)}" target="_blank" rel="noopener">Abrir no tamanho real</a>` : ''}${batch}<span class="help-text">${artStudio.width ? `${artStudio.width} × ${artStudio.height} px · PNG` : ''}</span></div><div class="arts-preview">${preview}</div></section></div>`;
}

async function buildQuickArt(bundle, overrides) {
  await loadArtSponsors();
  return renderArt(bundle, { ...artOptions, ...overrides }, { catalog: teamCatalog, sponsors: artSponsorImages });
}

function downloadBlobFile(name, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function setArtOption(field, value) {
  const allowed = {
    type: () => ART_TYPES.some(([key]) => key === value), theme: () => Boolean(ART_THEMES[value]), format: () => ART_FORMATS.some(([key]) => key === value),
    side: () => ['home', 'away'].includes(value), accent: () => value === '' || /^#[0-9a-f]{6}$/i.test(value),
    topN: () => Number.isFinite(Number(value)), championshipId: () => true, matchId: () => true, round: () => true, title: () => true, text: () => true,
    logos: () => true, sponsors: () => true, brand: () => true,
  };
  if (!allowed[field]?.()) return;
  if (field === 'topN') artOptions.topN = Math.max(3, Math.min(20, Math.round(Number(value))));
  else if (['logos', 'sponsors', 'brand'].includes(field)) artOptions[field] = value === true || value === 'true';
  else if (field === 'title') artOptions.title = String(value).slice(0, 80);
  else if (field === 'text') artOptions.text = String(value).slice(0, 600);
  else artOptions[field] = value;
  if (field === 'championshipId') { artOptions.matchId = ''; artOptions.round = ''; artBundle = null; artBundleFor = ''; artBundleAt = 0; }
  if (field === 'type') { artOptions.matchId = ''; artOptions.round = ''; }
  saveArtOptions();
}

async function openArt(canvas, name) {
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) { toast('Não foi possível gerar a imagem.'); return; }
  if (artPreview?.url) URL.revokeObjectURL(artPreview.url);
  artPreview = { url: URL.createObjectURL(blob), blob, name };
  drawer = { type: 'art' };
  render();
}

function renderArtDrawer() {
  return `<div class="drawer-backdrop" data-backdrop><aside class="drawer art-drawer"><div class="drawer-head"><h2>Arte pronta</h2><button class="button square" data-action="close-drawer">${icons.close}</button></div><img class="art-preview" src="${escapeHtml(artPreview?.url || '')}" alt="Prévia da arte"><div class="operations-actions"><button class="button primary" data-action="art-download">Baixar PNG</button><button class="button" data-action="art-share">Compartilhar (Instagram / WhatsApp)</button></div><p class="help-text">Para mais estilos e formatos (stories, paisagem), abra o <a href="${escapeHtml(platformUrl('arts'))}">Estúdio de artes</a>.</p></aside></div>`;
}

const LIVE_LAYER_LABELS = { scoreboard: 'Placar', sponsor: 'Patrocinador', sponsorBar: 'Barra de patrocinadores', lineup: 'Escalação simples', photoLineup: 'Apresentação', stats: 'Estatísticas' };
let liveRooms = {};

async function loadLiveRooms() {
  if (!isAdminPanel || adminSession.status !== 'authenticated' || managementModule !== 'live') return;
  const rooms = operationsData.matches.filter(match => match.status === 'live').map(match => match.room);
  await Promise.all(rooms.map(async room => {
    try {
      const response = await fetch(`/api/state?room=${encodeURIComponent(room)}&ts=${Date.now()}`, { cache: 'no-store' });
      if (response.ok) liveRooms[room] = await response.json();
    } catch {}
  }));
  if (managementModule === 'live') render();
}

function liveClockText(remote) {
  const sport = SPORTS[remote?.sport] || SPORTS.football;
  const elapsed = clockSeconds(remote?.clock);
  const seconds = sport.duration ? Math.max(0, sport.duration - elapsed) : elapsed;
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

function renderLiveModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const live = operationsData.matches.filter(match => match.status === 'live');
  const soon = operationsData.matches.filter(match => match.status === 'scheduled' && match.kickoffAt && new Date(match.kickoffAt).getTime() - Date.now() < 24 * 3600e3 && new Date(match.kickoffAt).getTime() > Date.now() - 3600e3).sort((a, b) => String(a.kickoffAt).localeCompare(String(b.kickoffAt)));
  const cards = live.map(match => {
    const remote = liveRooms[match.room];
    const visible = remote?.visible || {};
    const onAir = Object.entries(LIVE_LAYER_LABELS).filter(([key]) => visible[key]).map(([, label]) => `<span class="portal-chip is-live">${escapeHtml(label)}</span>`).join('') || '<span class="portal-chip">Nada no ar</span>';
    const score = remote ? `${Number(remote.home?.score || 0)} × ${Number(remote.away?.score || 0)}` : '— × —';
    return `<article class="live-card"><header><span class="live-tag">AO VIVO</span><small>${escapeHtml(operationChampionshipName(match.championshipId))}${match.round ? ` · ${escapeHtml(match.round)}` : ''}</small></header><div class="live-score"><strong>${escapeHtml(operationTeamName(match.homeTeamId))}</strong><b>${score}</b><strong>${escapeHtml(operationTeamName(match.awayTeamId))}</strong></div><div class="live-meta"><span>${remote ? liveClockText(remote) : '—'}</span><span>Sala · ${escapeHtml(match.room)}</span></div><div class="live-onair">${onAir}</div><div class="operations-actions"><a class="button primary" href="/?room=${encodeURIComponent(match.room)}">Operar partida</a><a class="button" href="/preview?room=${encodeURIComponent(match.room)}" target="_blank" rel="noopener">Prévia</a><button class="button subtle danger" data-action="live-hide-all" data-value="${escapeHtml(match.room)}">Retirar tudo do ar</button></div></article>`;
  }).join('');
  const soonRows = soon.map(match => `<a class="dashboard-mini-row" href="/?room=${encodeURIComponent(match.room)}"><span>${escapeHtml(operationTeamName(match.homeTeamId))} × ${escapeHtml(operationTeamName(match.awayTeamId))}</span><small>${operationDate(match.kickoffAt, true)}</small></a>`).join('');
  return `<div class="live-grid">${cards || '<div class="portal-empty">Nenhuma partida ao vivo agora. Marque uma partida como "Ao vivo" na agenda para acompanhá-la aqui.</div>'}</div>${soonRows ? `<section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Começam em breve</h3><p class="help-text">Partidas agendadas para as próximas 24 horas.</p></div></div><div class="dashboard-list">${soonRows}</div></section>` : ''}`;
}

function csvText(rows) {
  const cell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return `\uFEFF${rows.map(row => row.map(cell).join(';')).join('\r\n')}`;
}

function exportRows(kind) {
  if (kind === 'teams') {
    const rows = [['Equipe', 'Sigla', 'Número', 'Atleta', 'Posição', 'Altura (m)', 'Função']];
    for (const team of teamCatalog) for (const athlete of team.athletes || []) rows.push([team.name, team.short, athlete.number, athlete.name, athlete.position, athlete.height, athlete.squadRole === 'reserve' ? 'Reserva' : 'Titular']);
    return { name: 'times-e-atletas', rows };
  }
  if (kind === 'matches') {
    const status = { scheduled: 'Agendada', live: 'Ao vivo', finished: 'Finalizada', cancelled: 'Cancelada' };
    const rows = [['Campeonato', 'Rodada', 'Mandante', 'Visitante', 'Data e hora', 'Local', 'Status', 'Sala']];
    for (const match of operationsData.matches) rows.push([operationChampionshipName(match.championshipId), match.round, operationTeamName(match.homeTeamId), operationTeamName(match.awayTeamId), match.kickoffAt, match.venue, status[match.status] || match.status, match.room]);
    return { name: 'partidas', rows };
  }
  if (kind === 'championships') {
    const rows = [['Campeonato', 'Temporada', 'Status', 'Início', 'Fim', 'Partidas']];
    for (const item of operationsData.championships) rows.push([item.name, item.season, item.status, item.startDate, item.endDate, operationsData.matches.filter(match => match.championshipId === item.id).length]);
    return { name: 'campeonatos', rows };
  }
  const rows = [['Data', 'Ação', 'Alvo', 'Responsável', 'Detalhes']];
  for (const item of operationsData.logs) rows.push([new Date(item.createdAt).toLocaleString('pt-BR'), OPERATION_ACTION_LABELS[item.action] || item.action, item.target, item.actor, item.details]);
  return { name: 'auditoria', rows };
}

function renderBackupModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const exports = [['teams', 'Times e atletas', `${teamCatalog.length} equipes`], ['matches', 'Partidas', `${operationsData.matches.length} partidas`], ['championships', 'Campeonatos', `${operationsData.championships.length} campeonatos`], ['logs', 'Auditoria', `${operationsData.logs.length} registros`]];
  return `<div class="module-section"><section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Backup completo</h3><p class="help-text">Um arquivo JSON com times e atletas, campeonatos, partidas, comunicados, situação das delegações e a biblioteca de patrocínios. Não inclui senhas, sessões nem o estado ao vivo das partidas. Guarde em local seguro: contém dados de atletas.</p></div><button class="button primary" data-action="backup-json">Baixar backup (JSON)</button></section>
    <section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Planilhas (CSV)</h3><p class="help-text">Abrem direto no Excel ou no Google Planilhas.</p></div></div><div class="dashboard-list">${exports.map(([kind, label, count]) => `<div class="dashboard-mini-row"><span>${label} <small>${count}</small></span><button class="button subtle" data-action="export-csv" data-value="${kind}">Baixar CSV</button></div>`).join('')}</div></section>
    <p class="help-text">A restauração de um backup é feita pela equipe técnica; esta tela só gera as cópias.</p></div>`;
}

let selectedAnnouncementId = '';

function renderAnnouncementsModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const list = operationsData.announcements || [];
  const selected = list.find(item => item.id === selectedAnnouncementId) || null;
  const editor = selected || { title: '', body: '', teamIds: [], pinned: false };
  const allTeams = !editor.teamIds?.length;
  const audience = item => item.teamIds?.length ? `${item.teamIds.length} equipe${item.teamIds.length === 1 ? '' : 's'}` : 'Todas as equipes';
  const items = list.map(item => `<button class="operations-item ${item.id === selected?.id ? 'active' : ''}" data-action="select-announcement" data-value="${escapeHtml(item.id)}"><span><strong>${item.pinned ? '📌 ' : ''}${escapeHtml(item.title)}</strong><small>${escapeHtml(audience(item))} · ${escapeHtml(operationDate(item.createdAt, true))}</small></span></button>`).join('') || '<div class="portal-empty">Nenhum comunicado publicado.</div>';
  const teamChecks = teamCatalog.map(team => `<label class="announce-team"><input type="checkbox" data-announce-team="${escapeHtml(team.id)}" ${editor.teamIds?.includes(team.id) ? 'checked' : ''}> ${escapeHtml(team.name)}</label>`).join('');
  return `<div class="operations-layout"><section class="operations-list"><div class="operations-list-head"><div><strong>Comunicados</strong><small>${list.length} publicado${list.length === 1 ? '' : 's'}</small></div><button class="button primary" data-action="new-announcement">+ Novo</button></div>${items}</section><section class="operations-editor"><div class="section-header"><div><h3 class="section-title">${selected ? 'Editar comunicado' : 'Novo comunicado'}</h3><p class="help-text">Aparece no portal das equipes escolhidas, na seção Comunicados. Deixe "Todas as equipes" para avisos gerais.</p></div></div>
    <div class="field"><label for="announce-title">Título</label><input id="announce-title" maxlength="120" value="${escapeHtml(editor.title)}" placeholder="Ex.: Prazo de inscrição prorrogado"></div>
    <div class="field"><label for="announce-body">Mensagem</label><textarea id="announce-body" maxlength="2000" rows="6" placeholder="Escreva o recado para as equipes">${escapeHtml(editor.body)}</textarea></div>
    <div class="announce-audience"><span class="tiny-label">Destinatários</span><label class="announce-team"><input type="checkbox" id="announce-all" ${allTeams ? 'checked' : ''}> Todas as equipes</label><div class="announce-teams">${teamChecks}</div></div>
    <label class="announce-team"><input type="checkbox" id="announce-pinned" ${editor.pinned ? 'checked' : ''}> Fixar no topo do portal</label>
    <div class="operations-actions"><button class="button primary" data-action="save-announcement" data-value="${escapeHtml(selected?.id || '')}">${selected ? 'Salvar alterações' : 'Publicar comunicado'}</button>${selected ? `<button class="button subtle danger" data-action="delete-announcement" data-value="${escapeHtml(selected.id)}">Excluir</button>` : ''}</div></section></div>`;
}

function renderMatchesModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const selected = operationsData.matches.find(item => item.id === selectedMatchId) || null;
  const editor = matchDraft || selected || { championshipId: '', homeTeamId: '', awayTeamId: '', kickoffAt: '', status: 'scheduled', round: '', venue: '', room: '' };
  const teamOptions = value => teamCatalog.map(team => `<option value="${escapeHtml(team.id)}" ${team.id === value ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('');
  const championshipOptions = operationsData.championships.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === editor.championshipId ? 'selected' : ''}>${escapeHtml(item.name)}${item.season ? ` · ${escapeHtml(item.season)}` : ''}</option>`).join('');
  const sorted = [...operationsData.matches].sort((a, b) => String(a.kickoffAt || '').localeCompare(String(b.kickoffAt || '')));
  const list = sorted.map(item => `<article class="match-operation-card ${item.id === selected?.id ? 'active' : ''}"><button data-action="select-match" data-value="${escapeHtml(item.id)}"><span>${escapeHtml(operationChampionshipName(item.championshipId))} · ${escapeHtml(item.round || 'Rodada')}</span><strong>${escapeHtml(operationTeamName(item.homeTeamId))} <b>×</b> ${escapeHtml(operationTeamName(item.awayTeamId))}</strong><small>${operationDate(item.kickoffAt, true)} · ${escapeHtml(item.venue || 'Local não informado')}${item.homeScore !== null && item.homeScore !== undefined && item.awayScore !== null && item.awayScore !== undefined ? ` · <b>${item.homeScore} × ${item.awayScore}</b>` : ''}${item.stage === 'group' ? ` · Grupo ${escapeHtml(item.group)}` : item.stage === 'knockout' ? ' · Mata-mata' : ''}</small><small>Escalação: ${['homeTeamId', 'awayTeamId'].map(side => `${escapeHtml(operationTeamName(item[side]))} ${teamCatalog.find(team => team.id === item[side])?.matchSquads?.[item.id]?.starters?.length ? '✓' : '—'}`).join(' · ')}</small></button><a class="button subtle" href="/?room=${encodeURIComponent(item.room)}">Abrir transmissão</a></article>`).join('') || '<div class="portal-empty">Nenhuma partida agendada.</div>';
  return `<div class="operations-layout"><section class="operations-list"><div class="operations-list-head"><div><strong>Agenda de partidas</strong><small>${operationsData.matches.length} partida${operationsData.matches.length === 1 ? '' : 's'}</small></div><button class="button primary" data-action="new-operation-match">+ Nova</button></div>${list}</section><section class="operations-editor"><div class="section-header"><div><h3 class="section-title">${selected ? 'Editar partida' : 'Nova partida'}</h3><p class="help-text">Cada partida recebe uma sala própria. Placar, eventos, escalações e URLs do OBS ficam isolados nessa sala.</p></div></div>${operationsData.championships.length ? `<div class="field"><label for="match-championship">Campeonato</label><select id="match-championship"><option value="">Selecione</option>${championshipOptions}</select></div><div class="field-row"><div class="field"><label for="operation-home">Mandante</label><select id="operation-home"><option value="">Selecione</option>${teamOptions(editor.homeTeamId)}</select></div><div class="field"><label for="operation-away">Visitante</label><select id="operation-away"><option value="">Selecione</option>${teamOptions(editor.awayTeamId)}</select></div></div><div class="field-row"><div class="field"><label for="match-kickoff">Data e horário</label><input id="match-kickoff" type="datetime-local" value="${escapeHtml(editor.kickoffAt || '')}"></div><div class="field"><label for="match-status">Status</label><select id="match-status"><option value="scheduled" ${editor.status === 'scheduled' ? 'selected' : ''}>Agendada</option><option value="live" ${editor.status === 'live' ? 'selected' : ''}>Ao vivo</option><option value="finished" ${editor.status === 'finished' ? 'selected' : ''}>Finalizada</option><option value="cancelled" ${editor.status === 'cancelled' ? 'selected' : ''}>Cancelada</option></select></div></div><div class="field-row"><div class="field"><label for="match-round">Rodada / fase</label><input id="match-round" maxlength="60" value="${escapeHtml(editor.round || '')}" placeholder="Ex.: Semifinal"></div><div class="field"><label for="match-deadline">Prazo do cadastro das equipes</label><input id="match-deadline" type="date" value="${escapeHtml(editor.registrationDeadline || '')}"></div><div class="field"><label for="match-venue">Local</label><input id="match-venue" maxlength="120" value="${escapeHtml(editor.venue || '')}" placeholder="Estádio ou ginásio"></div></div><div class="field-row"><div class="field"><label for="match-home-score">Placar do mandante</label><input id="match-home-score" type="number" min="0" max="999" value="${editor.homeScore ?? ''}"></div><div class="field"><label for="match-away-score">Placar do visitante</label><input id="match-away-score" type="number" min="0" max="999" value="${editor.awayScore ?? ''}"></div><div class="field"><label for="match-home-pen">Pênaltis mandante</label><input id="match-home-pen" type="number" min="0" max="999" value="${editor.homePenalties ?? ''}"></div><div class="field"><label for="match-away-pen">Pênaltis visitante</label><input id="match-away-pen" type="number" min="0" max="999" value="${editor.awayPenalties ?? ''}"></div></div>${selected ? `<div class="operations-actions"><button class="button subtle" data-action="match-import-score" data-value="${escapeHtml(selected.room)}">Importar placar da sala de transmissão</button></div>` : ''}<p class="help-text">O resultado alimenta a classificação e as páginas públicas. Com o status "Finalizada" e sem placar aqui, o placar da sala de transmissão é usado.</p><div class="field"><label for="match-room">Código da sala</label><input id="match-room" maxlength="48" value="${escapeHtml(editor.room || '')}" ${selected ? 'readonly' : ''} placeholder="Gerado automaticamente se ficar vazio"><small>${selected ? 'A sala é permanente para preservar os overlays e URLs desta partida.' : 'Este código aparece em todas as URLs dos overlays desta partida.'}</small></div><div class="operations-actions"><button class="button primary" data-action="save-operation-match" data-value="${escapeHtml(selected?.id || '')}">Salvar partida</button>${selected ? `<a class="button" href="/?room=${encodeURIComponent(selected.room)}">Abrir transmissão</a><button class="button subtle danger" data-action="delete-operation-match" data-value="${escapeHtml(selected.id)}">Excluir</button>` : ''}</div>` : '<div class="portal-empty">Cadastre um campeonato antes de criar partidas.</div>'}</section></div>`;
}

const OPERATION_ACTION_LABELS = { 'delegation.completed': 'Delegação concluída', 'delegation.changed': 'Delegação alterada', 'delegation.saved': 'Cadastro de delegação salvo', 'championship.created': 'Campeonato criado', 'championship.updated': 'Campeonato atualizado', 'championship.deleted': 'Campeonato excluído', 'match.created': 'Partida criada', 'match.updated': 'Partida atualizada', 'match.deleted': 'Partida excluída', 'delegation.approved': 'Delegação aprovada', 'delegation.returned': 'Delegação devolvida', 'team.restored': 'Versão do time restaurada', 'team.planning.saved': 'Inscrição ou escalação salva', 'announcement.created': 'Comunicado publicado', 'announcement.updated': 'Comunicado atualizado', 'announcement.deleted': 'Comunicado excluído', 'fixtures.generated': 'Partidas geradas', 'result.saved': 'Resultado lançado', 'result.cleared': 'Resultado removido', 'championship.finished': 'Campeonato encerrado', 'post.created': 'Publicação criada', 'post.updated': 'Publicação atualizada', 'post.deleted': 'Publicação excluída' };

function renderDashboardModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const matches = operationsData.matches;
  const statusLabel = { scheduled: 'Agendadas', live: 'Ao vivo', finished: 'Finalizadas', cancelled: 'Canceladas' };
  const statusCounts = Object.keys(statusLabel).map(status => [status, matches.filter(item => item.status === status).length]);
  const liveNow = matches.filter(item => item.status === 'live');
  const upcoming = matches.filter(item => item.status === 'scheduled').sort((a, b) => String(a.kickoffAt || '').localeCompare(String(b.kickoffAt || ''))).slice(0, 5);
  const matchRow = item => `<a class="dashboard-mini-row" href="/?room=${encodeURIComponent(item.room)}"><span>${escapeHtml(operationTeamName(item.homeTeamId))} × ${escapeHtml(operationTeamName(item.awayTeamId))}</span><small>${operationDate(item.kickoffAt, true)}</small></a>`;
  const unread = operationsData.notifications.filter(item => !item.read).length;
  const recentLogs = operationsData.logs.slice(0, 6).map(item => `<div class="dashboard-mini-row"><span>${escapeHtml(OPERATION_ACTION_LABELS[item.action] || item.action)} · ${escapeHtml(item.target)}</span><small>${operationDate(item.createdAt, true)}</small></div>`).join('') || '<div class="portal-empty">Nenhuma ação registrada.</div>';
  const statsRooms = Object.values(dashboardStats.byRoom);
  const aggregated = statsRooms.reduce((totals, data) => {
    for (const [label, value] of reportSummaryEntries({ events: data.events || [] })) totals[label] = (totals[label] || 0) + value;
    return totals;
  }, {});
  const aggregatedTiles = Object.entries(aggregated);
  return `<div class="dashboard-grid">
    <section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Agenda e status de partidas</h3><p class="help-text">${matches.length} partida${matches.length === 1 ? '' : 's'} cadastrada${matches.length === 1 ? '' : 's'} no total.</p></div><a class="button subtle" href="${escapeHtml(moduleUrl('matches'))}">Ver agenda completa</a></div>
      <div class="dashboard-stats">${statusCounts.map(([status, count]) => `<article class="stat-${status}"><strong>${count}</strong><span>${statusLabel[status]}</span></article>`).join('')}</div>
      ${liveNow.length ? `<div class="dashboard-list"><strong>Ao vivo agora</strong>${liveNow.map(matchRow).join('')}</div>` : ''}
      ${upcoming.length ? `<div class="dashboard-list"><strong>Próximas partidas</strong>${upcoming.map(matchRow).join('')}</div>` : '<div class="portal-empty">Nenhuma partida agendada.</div>'}
    </section>
    <section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Campeonatos</h3><p class="help-text">${operationsData.championships.length} campeonato${operationsData.championships.length === 1 ? '' : 's'} · escolha uma partida para abrir seus painéis e overlays.</p></div><a class="button subtle" href="${escapeHtml(moduleUrl('championships'))}">Gerenciar campeonatos</a></div>
      <div class="dashboard-list">${operationsData.championships.map(item => `<div class="dashboard-mini-row"><span>${escapeHtml(item.name)}${item.season ? ` · ${escapeHtml(item.season)}` : ''}</span><small>${matches.filter(match => match.championshipId === item.id).length} partida(s)</small></div>`).join('') || '<div class="portal-empty">Nenhum campeonato cadastrado.</div>'}</div>
    </section>
    <section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Atividade e avisos</h3><p class="help-text">${unread} aviso${unread === 1 ? '' : 's'} não lido${unread === 1 ? '' : 's'} de delegações das equipes.</p></div><a class="button subtle" href="${escapeHtml(moduleUrl('audit'))}">Ver avisos e logs</a></div>
      <div class="dashboard-list">${recentLogs}</div>
    </section>
    <section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Acessos e times cadastrados</h3><p class="help-text">Usuários com acesso ao painel e aos portais de equipe.</p></div><a class="button subtle" href="${escapeHtml(moduleUrl('access'))}">Gerenciar acessos</a></div>
      <div class="dashboard-stats"><article><strong>${teamCatalog.length}</strong><span>Times cadastrados</span></article><article><strong>${new Set(accessTeamCredentials.map(entry => entry.teamId)).size}</strong><span>Times com acesso vinculado</span></article><article><strong>${accessAdmins.length}</strong><span>Administradores</span></article><article><strong>${delegationRows().filter(row => row.status === 'completed').length}</strong><span>Delegações para revisar</span></article><article><strong>${delegationRows().filter(row => row.late).length}</strong><span>Prazos vencidos</span></article></div>
    </section>
    <section class="dashboard-section"><div class="section-header"><div><h3 class="section-title">Estatísticas agregadas</h3><p class="help-text">${dashboardStats.status === 'loading' ? 'Calculando a partir dos dados de cada partida…' : `Somado de ${statsRooms.length} de ${matches.length} partida${matches.length === 1 ? '' : 's'} com sala registrada.`}</p></div><button class="button subtle" data-action="refresh-dashboard-stats">${dashboardStats.status === 'loading' ? 'Calculando…' : 'Atualizar'}</button></div>
      ${aggregatedTiles.length ? `<div class="dashboard-stats">${aggregatedTiles.map(([label, value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}</div>` : '<div class="portal-empty">Sem dados suficientes ainda. Finalize partidas para ver estatísticas somadas.</div>'}
    </section>
  </div>`;
}

function renderAuditModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const unread = operationsData.notifications.filter(item => !item.read).length;
  const notifications = operationsData.notifications.slice(0, 30).map(item => `<article class="notification-card ${item.read ? '' : 'unread'}"><div><span>${item.type === 'delegation-completed' ? 'Delegação concluída' : 'Delegação alterada'}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${operationDate(item.createdAt, true)}</small></div>${item.read ? '<b>Lido</b>' : `<button class="button subtle" data-action="read-notification" data-value="${escapeHtml(item.id)}">Marcar como lido</button>`}</article>`).join('') || '<div class="portal-empty">Nenhum aviso recebido.</div>';
  const logs = operationsData.logs.slice(0, 100).map(item => `<tr><td>${operationDate(item.createdAt, true)}</td><td>${escapeHtml(item.actor)}</td><td>${escapeHtml(OPERATION_ACTION_LABELS[item.action] || item.action)}</td><td><strong>${escapeHtml(item.target)}</strong><small>${escapeHtml(item.details)}</small></td></tr>`).join('') || '<tr><td colspan="4">Nenhuma ação registrada.</td></tr>';
  return `<div class="audit-grid"><section><div class="section-header"><div><h3 class="section-title">Avisos do Super Admin</h3><p class="help-text">Cadastros concluídos ou modificados pelas equipes aparecem aqui.</p></div>${unread ? `<button class="button subtle" data-action="read-all-notifications">Marcar ${unread} como lido${unread === 1 ? '' : 's'}</button>` : ''}</div><div class="notification-list">${notifications}</div></section><section><div class="section-header"><div><h3 class="section-title">Log de ações</h3><p class="help-text">Histórico operacional sem senhas ou conteúdo sensível.</p></div></div><div class="audit-table-wrap"><table class="audit-table"><thead><tr><th>Data</th><th>Responsável</th><th>Ação</th><th>Registro</th></tr></thead><tbody>${logs}</tbody></table></div></section></div>`;
}

function staffRoleOptions(selectedRole) {
  return STAFF_ROLES.map(role => `<option value="${escapeHtml(role)}" ${role === selectedRole ? 'selected' : ''}>${escapeHtml(role)}</option>`).join('');
}

function renderStaffManager(team, portal = false) {
  const staff = normalizedStaff(team);
  const teamIdValue = escapeHtml(team?.id || '');
  const prefix = portal ? 'portal' : 'lineup';
  return `<section class="staff-manager"><div class="staff-manager-head"><div><strong>Comissão técnica e equipe de apoio</strong><small>Cadastre treinador, auxiliares e todos os profissionais que serão apresentados.</small></div><button class="button subtle" data-action="${prefix}-add-staff" ${staff.length >= 30 ? 'disabled' : ''}>+ Adicionar membro</button></div><div class="staff-manager-list">${staff.map((member, index) => `<article class="staff-manager-row"><div class="staff-manager-photo">${member.photo ? `<img src="${escapeHtml(member.photo)}" alt="Foto de ${escapeHtml(member.name || member.role)}">` : `<span>${escapeHtml(String(member.name || member.role).slice(0, 2).toUpperCase())}</span>`}<label>${member.photo ? 'Trocar' : 'Foto'}<input type="file" data-${prefix}-staff-photo="${escapeHtml(member.id)}" ${portal ? '' : `data-lineup-team-id="${teamIdValue}"`} accept="image/png,image/jpeg,image/webp"></label></div><div class="staff-manager-fields"><label><span>Nome</span><input data-${prefix}-staff-name="${escapeHtml(member.id)}" ${portal ? '' : `data-lineup-team-id="${teamIdValue}"`} maxlength="100" value="${escapeHtml(member.name)}" placeholder="Nome completo"></label><label><span>Função</span><select data-${prefix}-staff-role="${escapeHtml(member.id)}" ${portal ? '' : `data-lineup-team-id="${teamIdValue}"`}>${staffRoleOptions(member.role)}</select></label></div><button class="button square subtle" data-action="${prefix}-remove-staff" data-value="${escapeHtml(member.id)}" ${portal ? '' : `data-team-id="${teamIdValue}"`} ${staff.length <= 1 ? 'disabled' : ''} aria-label="Remover ${escapeHtml(member.name || member.role)}">×</button></article>`).join('')}</div></section>`;
}

function renderRosterTab() {
  const selectedTeamId = state.selectedTeams?.[state.lineupTeam];
  const selectedTeam = teamCatalog.find(team => team.id === selectedTeamId);
  const team = selectedTeam || state[state.lineupTeam];
  const athletes = Array.isArray(team?.athletes) ? team.athletes : athletesFromRoster(team?.roster || '');
  const { starters, reserves } = lineupGroups(team);
  const stageButtons = [['individual','Individual'],['starters','Titulares + Comissão'],['formation','Esquema tático'],['reserves','Reservas']];
  return `<div class="field"><label for="roster-team">Equipe</label><select id="roster-team" data-action="roster-select"><option value="home" ${state.lineupTeam === 'home' ? 'selected' : ''}>${escapeHtml(state.home.name)}</option><option value="away" ${state.lineupTeam === 'away' ? 'selected' : ''}>${escapeHtml(state.away.name)}</option></select></div>
    <div class="field roster-editor"><label for="roster-input">Jogadores · número e nome</label><textarea id="roster-input" data-team="${state.lineupTeam}" data-team-field="roster">${escapeHtml(state[state.lineupTeam].roster)}</textarea></div>
    <div class="lineup-output-choices"><button class="button ${state.visible.lineup ? 'primary' : ''}" data-action="toggle-lineup">${icons.list} ${state.visible.lineup ? 'Retirar escalação simples' : 'Exibir escalação simples'}</button><button class="button ${state.visible.photoLineup ? 'primary' : ''}" data-action="toggle-photo-lineup">${icons.users} ${state.visible.photoLineup ? 'Retirar apresentação' : 'Exibir apresentação'}</button></div>
    <section class="lineup-director"><div class="lineup-director-head"><div><strong>Direção da apresentação</strong><small>Controle cada bloco ou rode a sequência completa.</small></div><button class="button primary" data-action="start-lineup-sequence">${icons.play} Apresentar sequência</button></div><div class="lineup-stage-tabs">${stageButtons.map(([value,label]) => `<button class="${state.photoLineupStage === value ? 'active' : ''}" data-action="set-photo-lineup-stage" data-value="${value}">${label}</button>`).join('')}</div><div class="lineup-director-status"><span>${state.photoLineupAuto?.running ? 'Sequência automática no ar' : 'Controle manual'}</span><strong>${starters.length} titulares · ${reserves.length} reservas</strong></div><div class="individual-nav"><button class="button subtle" data-action="previous-lineup-player">← Anterior</button><span>Titular ${Math.min(Number(state.photoLineupPlayerIndex || 0) + 1, Math.max(1, starters.length))} de ${starters.length}</span><button class="button subtle" data-action="next-lineup-player">Próximo →</button></div></section>
    ${selectedTeam ? `<section class="lineup-registration"><div class="section-header"><div><h3 class="section-title">Cadastro da apresentação</h3><p class="help-text">Defina foto, função e posição sem sair do painel.</p></div></div><div class="lineup-staff-row"><label><span>Esquema tático</span><select data-lineup-formation="${escapeHtml(selectedTeam.id)}">${Object.keys(FORMATIONS).map(value => `<option value="${value}" ${selectedTeam.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label><span>Treinador</span><input data-lineup-coach-name="${escapeHtml(selectedTeam.id)}" maxlength="100" value="${escapeHtml(selectedTeam.coach?.name || 'Treinador')}"></label><label class="lineup-upload">${selectedTeam.coach?.photo ? 'Trocar foto do treinador' : 'Foto do treinador'}<input type="file" data-lineup-coach-photo="${escapeHtml(selectedTeam.id)}" accept="image/png,image/jpeg,image/webp"></label></div>${renderMatchSquadEditor(selectedTeam, athletes)}<div class="lineup-athlete-manager">${athletes.map((athlete, index) => `<article class="lineup-athlete-row"><div class="lineup-athlete-thumb">${athlete.photo ? `<img src="${escapeHtml(athlete.photo)}" alt="Foto de ${escapeHtml(athlete.name)}">` : `<span>${escapeHtml(athlete.number || String(index + 1))}</span>`}<label>${athlete.photo ? 'Trocar' : 'Foto'}<input type="file" data-lineup-athlete-photo="${escapeHtml(athlete.id)}" data-lineup-team-id="${escapeHtml(selectedTeam.id)}" accept="image/png,image/jpeg,image/webp"></label></div><div><strong>${escapeHtml(athlete.number || '—')} · ${escapeHtml(athlete.name || `Atleta ${index + 1}`)}</strong><small>${athlete.height ? `${escapeHtml(String(athlete.height).replace('.', ','))} m` : 'Altura não informada'}</small></div><select data-lineup-athlete-role="${escapeHtml(athlete.id)}" data-lineup-team-id="${escapeHtml(selectedTeam.id)}" aria-label="Função de ${escapeHtml(athlete.name)}"><option value="starter" ${athlete.squadRole !== 'reserve' ? 'selected' : ''}>Titular</option><option value="reserve" ${athlete.squadRole === 'reserve' ? 'selected' : ''}>Reserva</option></select><input class="lineup-position-input" data-lineup-athlete-position="${escapeHtml(athlete.id)}" data-lineup-team-id="${escapeHtml(selectedTeam.id)}" maxlength="6" value="${escapeHtml(athlete.position || '')}" placeholder="POS" aria-label="Posição de ${escapeHtml(athlete.name)}"></article>`).join('')}</div></section>` : '<p class="help-text">Selecione um time cadastrado para gerenciar fotos, reservas, treinador e esquema tático.</p>'}
    ${selectedTeam ? renderStaffManager(selectedTeam) : ''}
    <div class="photo-lineup-option"><div><strong>Patrocinadores no rodapé</strong><small>Usa a mídia exclusiva, logo ou banner de cada marca.</small></div><button class="button subtle ${state.photoLineupShowSponsors ? 'active' : ''}" data-action="toggle-photo-lineup-sponsors">${state.photoLineupShowSponsors ? 'Exibindo' : 'Oculto'}</button></div>
    ${appearanceRange('photoLineupSponsorBarSize', 'Tamanho da barra de patrocinadores', state.appearance.photoLineupSponsorBarSize, 60, 180, '%')}
    <p class="help-text">Informe um jogador por linha. Exemplo: <strong>10 Leonardo Lima</strong>. ${selectedTeam ? `Esta relação também atualiza o cadastro de ${escapeHtml(selectedTeam.name)}.` : ''} O fluxo usa até ${currentSport().teamSize} titulares e apresenta o restante como reservas.</p>`;
}

function appearanceRange(field, label, value, minimum = 60, maximum = 180, suffix = '%') {
  return `<label class="parameter-control"><span>${escapeHtml(label)} <strong data-parameter-value="${field}">${escapeHtml(value)}${suffix}</strong></span><input type="range" min="${minimum}" max="${maximum}" step="1" value="${escapeHtml(value)}" data-appearance="${field}"></label>`;
}

function appearanceTypeface(field, value) {
  return `<label class="parameter-select"><span>Tipografia</span><select data-appearance="${field}"><option value="global" ${value === 'global' || !TYPEFACES[value] ? 'selected' : ''}>Fonte global do projeto</option>${Object.entries(TYPEFACES).map(([key, font]) => `<option value="${key}" ${value === key ? 'selected' : ''}>${font.label}</option>`).join('')}</select></label>`;
}

const OVERLAY_STYLE_OPTIONS = {
  scoreboardStyle: [['classic','Clássico TV'],['minimal','Minimalista'],['glass','Vidro'],['contrast','Alto impacto'],['neon','Neon'],['ribbon','Faixa dinâmica'],['gradient','Gradiente']],
  eventStyle: [['broadcast','Faixa TV'],['minimal','Linha limpa'],['block','Bloco esportivo']],
  lineupStyle: [['panel','Painel'],['clean','Lista limpa'],['columns','Duas colunas']],
  photoLineupFormationMark: [['number','Número','Bolinha com o número da camisa'],['photo','Foto do atleta','Foto no lugar do número; sem foto, mostra o número']],
  photoLineupLayout: [
    ['classic','Clássico','Grade de cards com estilo e animação à escolha'],
    ['tunnel','Túnel de entrada','Colunas altas em tela cheia, nomes na vertical; sobem em sequência'],
    ['poster','Carta de coleção','Cartas com moldura de foil; viram em 3D, uma a uma'],
    ['sidebar','Coluna lateral','Lista compacta à esquerda que deixa o jogo livre'],
    ['stadium','Telão de estádio','Painel LED em duas colunas; liga com varredura e cintilação'],
    ['matchday','Programa do jogo','Papel claro, tipografia de jornal; desdobra e carimba'],
  ],
  photoLineupStyle: [
    ['editorial','Editorial','Faixa da equipe, TV aberta'],
    ['cards','Cards','Cartas com cantos suaves'],
    ['glass','Vidro premium','Painel translúcido'],
    ['premier','Liga principal','Blocos de cor, corte diagonal e placa branca'],
    ['champions','Noite de gala','Azul profundo, filete dourado e números centrais'],
    ['diagonal','Diagonal esportivo','Cards em paralelogramo e número em destaque'],
  ],
  photoLineupAnimation: [
    ['slide','Deslize','Entra pela lateral'],
    ['wipe','Cortina','Revela da esquerda para a direita'],
    ['rise','Subida','Sobe do rodapé com suavidade'],
    ['zoom','Zoom de estúdio','Aproxima do centro'],
    ['split','Abertura central','Abre a partir do meio'],
    ['cascade','Cascata','Cards entram um a um'],
  ],
  sponsorBarTransition: [['fade','Fade suave','Dissolve a arte'],['slide','Deslizamento','Entra e sai pelos lados'],['zoom','Zoom elegante','Aproxima levemente'],['flip','Virada 3D','Gira no eixo horizontal'],['elastic','Elástico','Entrada com ressalto']],
  sponsorBarFit: [['cover','Preencher','Corta o excesso da arte'],['contain','Conter','Mostra a arte inteira']],
  statsStyle: [['broadcast','Painel TV','Fundo escuro com barras nas cores das equipes'],['glass','Vidro','Painel translúcido'],['minimal','Minimal','Sem painel, só texto e barras']],
  statsAnimation: [['rise','Subida','Sobe do rodapé'],['slide','Deslize','Entra pela lateral'],['zoom','Zoom','Aproxima do centro'],['wipe','Cortina','Revela da esquerda'],['fade','Fade','Aparece suavemente']],
  sponsorBarBorder: [['none','Sem moldura'],['thin','Fina'],['accent','Destaque']],
  sponsorBarShadow: [['none','Sem sombra'],['soft','Suave'],['strong','Forte']],
  sponsorStyle: [['boxed','Box'],['clean','Limpo'],['ribbon','Faixa']],
};

function overlayStyleControl(field, label) {
  const options = OVERLAY_STYLE_OPTIONS[field] || [];
  const current = state.appearance?.[field] || options[0]?.[0] || '';
  return `<div class="overlay-style-control"><div><strong>${escapeHtml(label)}</strong><small>Altere e confira imediatamente na prévia e no OBS.</small></div><select data-appearance="${field}" aria-label="${escapeHtml(label)}">${options.map(([value, name]) => `<option value="${value}" ${current === value ? 'selected' : ''}>${name}</option>`).join('')}</select></div>`;
}

function renderAppearanceComponent(title, caption, prefix) {
  const appearance = state.appearance || defaultAppearance();
  const gcPositions = prefix === 'event' ? `<div class="gc-position-presets"><span>Locais padrão do GC</span><div>${[['left','Esquerda'],['center','Centro'],['right','Direita']].map(([value, label]) => `<button class="button subtle ${appearance.eventPosition === value ? 'active' : ''}" data-action="event-position" data-value="${value}">${label}</button>`).join('')}</div></div>` : '';
  return `<div class="parameter-card"><div class="parameter-card-head"><div><strong>${escapeHtml(title)}</strong><small>${escapeHtml(caption)}</small></div><span>${escapeHtml(appearance[`${prefix}Scale`])}%</span></div>${appearanceRange(`${prefix}Scale`, 'Tamanho do elemento', appearance[`${prefix}Scale`])}${appearanceRange(`${prefix}Font`, 'Tamanho da fonte', appearance[`${prefix}Font`])}${appearanceTypeface(`${prefix}Typeface`, appearance[`${prefix}Typeface`])}${gcPositions}<div class="position-controls"><strong>Posição no overlay</strong>${appearanceRange(`${prefix}X`, 'Horizontal', appearance[`${prefix}X`], 0, 100, '%')}${appearanceRange(`${prefix}Y`, 'Vertical', appearance[`${prefix}Y`], 0, 100, '%')}</div></div>`;
}

function renderMatchSquadEditor(team, athletes) {
  const key = squadKey(team);
  const squad = state.squad?.[key];
  const { starters } = lineupGroups(team);
  const starterIds = new Set(starters.map(athlete => athlete.id));
  const calledIds = squad?.called?.length ? new Set(squad.called) : new Set(athletes.map(athlete => athlete.id));
  const limit = currentSport().teamSize;
  return `<div class="match-squad"><div class="section-header"><div><h3 class="section-title">Elenco desta partida</h3><p class="help-text">Escolha quem foi relacionado e os ${limit} titulares só para este jogo. Arraste as bolinhas na prévia do esquema tático para ajustar posições.</p></div><button class="button subtle" data-action="reset-squad" data-value="${escapeHtml(key)}" ${squad ? '' : 'disabled'}>Voltar ao padrão do time</button></div><div class="lineup-staff-row"><label><span>Esquema nesta partida</span><select data-squad-formation="${escapeHtml(key)}"><option value="">Padrão do time (${escapeHtml(team.formation || '4-3-3')})</option>${Object.keys(FORMATIONS).map(value => `<option value="${value}" ${squad?.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><button class="button subtle" data-action="reset-squad-positions" data-value="${escapeHtml(key)}" ${Object.keys(squad?.positions || {}).length ? '' : 'disabled'}>Restaurar posições</button></div><div class="match-squad-list">${athletes.map(athlete => `<div class="match-squad-row"><strong>${escapeHtml(athlete.number || '—')} · ${escapeHtml(athlete.name || 'Atleta')}</strong><label><input type="checkbox" data-squad-called="${escapeHtml(athlete.id)}" data-squad-team="${escapeHtml(key)}" ${calledIds.has(athlete.id) ? 'checked' : ''}> Relacionado</label><label><input type="checkbox" data-squad-starter="${escapeHtml(athlete.id)}" data-squad-team="${escapeHtml(key)}" ${starterIds.has(athlete.id) ? 'checked' : ''}> Titular</label></div>`).join('')}</div><small class="help-text">${starters.length} de ${limit} titulares definidos.</small></div>`;
}

function teamForSquad(key) {
  return teamCatalog.find(item => squadKey(item) === key) || activeLineupTeam();
}

function ensureSquad(draft, team, athletes) {
  const key = squadKey(team);
  draft.squad ||= {};
  if (!draft.squad[key]) {
    const { starters } = lineupGroups(team);
    draft.squad[key] = { called: athletes.map(athlete => athlete.id), starters: starters.map(athlete => athlete.id), formation: '', positions: {} };
  }
  return draft.squad[key];
}

function renderSponsorManager() {
  const sponsors = state.sponsors || [];
  return `<div class="sponsor-manager"><div class="sponsor-manager-head"><div><strong>Patrocinadores cadastrados</strong><small>Escolha o ativo ou ative o looping para alternar automaticamente.</small></div><button class="button subtle" data-action="add-sponsor">+ Adicionar</button></div><div class="sponsor-list">${sponsors.map((sponsor, index) => `<div class="sponsor-item ${state.activeSponsorIndex === index ? 'active' : ''}" data-sponsor-row="${escapeHtml(sponsor.id)}"><button class="sponsor-select" data-action="select-sponsor" data-value="${index}" aria-label="Selecionar ${escapeHtml(sponsor.name)}"><span>${String(index + 1).padStart(2, '0')}</span></button><div class="sponsor-fields"><input data-sponsor-name="${escapeHtml(sponsor.id)}" maxlength="80" value="${escapeHtml(sponsor.name)}" aria-label="Nome do patrocinador ${index + 1}"><div class="sponsor-upload-actions"><label class="sponsor-upload-button">${sponsor.logo ? 'Trocar logo' : 'Enviar logo'}<input type="file" data-sponsor-logo="${escapeHtml(sponsor.id)}" accept="image/png,image/jpeg,image/webp"></label><label class="sponsor-upload-button">${sponsor.banner ? 'Trocar banner' : 'Enviar banner'}<input type="file" data-sponsor-banner="${escapeHtml(sponsor.id)}" accept="image/png,image/jpeg,image/webp"></label><label class="sponsor-upload-button lineup-media-upload">${sponsor.lineupMedia ? 'Trocar mídia da escalação' : 'Mídia da escalação'}<input type="file" data-sponsor-lineup-media="${escapeHtml(sponsor.id)}" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"></label>${sponsor.lineupMedia ? `<button class="sponsor-upload-button sponsor-media-remove" data-action="remove-sponsor-lineup-media" data-value="${escapeHtml(sponsor.id)}">Remover mídia · ${sponsor.lineupMediaType === 'video' ? 'VÍDEO' : 'IMAGEM'}</button>` : ''}</div></div>${sponsor.logo ? `<img class="sponsor-thumb sponsor-logo-thumb" src="${escapeHtml(sponsor.logo)}" alt="Logo de ${escapeHtml(sponsor.name)}">` : sponsor.banner ? `<img class="sponsor-thumb" src="${escapeHtml(sponsor.banner)}" alt="Arte de ${escapeHtml(sponsor.name)}">` : '<div class="sponsor-thumb sponsor-thumb-empty">LOGO</div>'}<button class="button square subtle" data-action="remove-sponsor" data-value="${escapeHtml(sponsor.id)}" aria-label="Remover patrocinador">×</button></div>`).join('')}</div><div class="sponsor-loop-control"><button class="button ${state.sponsorLoop ? 'primary' : ''}" data-action="toggle-sponsor-loop">${state.sponsorLoop ? 'Parar looping' : 'Iniciar looping'}</button><span>${sponsors.length} patrocinador${sponsors.length === 1 ? '' : 'es'} · ${clampNumber(state.appearance?.sponsorDuration, 3, 60, 10)}s cada</span></div></div>`;
}

function renderAppearanceTab() {
  const appearance = state.appearance || defaultAppearance();
  const scoreboardStyles = [['classic','Clássico','Blocos sólidos'],['glass','Vidro','Transparência'],['minimal','Minimal','Sem excesso'],['contrast','Contraste','Contorno forte'],['neon','Neon','Brilho de contorno'],['ribbon','Faixa dinâmica','Corte diagonal'],['gradient','Gradiente','Barra em degradê']];
  return `<div class="appearance-intro"><strong>Personalização por elemento</strong><p>Ajuste tamanho, fonte, posição e acabamento visual em toda a área 1920 × 1080. Tudo entra imediatamente na prévia e nas URLs do OBS.</p></div><div class="appearance-presets"><span>Predefinições rápidas</span><div><button class="button subtle" data-action="appearance-preset" data-value="compact">Compacto</button><button class="button subtle" data-action="appearance-preset" data-value="broadcast">Padrão TV</button><button class="button subtle" data-action="appearance-preset" data-value="impact">Impacto</button></div></div><section class="overlay-style-board"><div><strong>Variações de layout</strong><small>Uma identidade diferente para cada tipo de overlay.</small></div>${overlayStyleControl('scoreboardStyle','Estilo do placar')}${overlayStyleControl('eventStyle','Estilo dos eventos e GC')}${overlayStyleControl('lineupStyle','Estilo da escalação simples')}${overlayStyleControl('sponsorStyle','Estilo dos patrocinadores')}</section><div class="parameter-grid">
    ${renderAppearanceComponent('Placar', 'Equipes, resultado e cronômetro', 'scoreboard')}
    ${renderAppearanceComponent('GC e lower third', 'Gols, cartões e identificações', 'event')}
    ${renderAppearanceComponent('Escalação', 'Título e nomes dos jogadores', 'lineup')}
    ${renderAppearanceComponent('Apresentação da equipe', 'Titulares, reservas, treinador e esquema', 'photoLineup')}
    ${renderAppearanceComponent('Patrocinador', 'Marca exibida no canto superior', 'sponsor')}
    <div class="parameter-card"><div class="parameter-card-head"><div><strong>Barra de patrocinadores</strong><small>Tamanho e posição no programa completo (a saída 1500 × 200 independente não muda de posição)</small></div><span>${escapeHtml(appearance.sponsorBarScale)}%</span></div>${appearanceRange('sponsorBarScale', 'Tamanho da barra', appearance.sponsorBarScale, 60, 180, '%')}<div class="position-controls"><strong>Posição no overlay</strong>${appearanceRange('sponsorBarX', 'Horizontal', appearance.sponsorBarX, 0, 100, '%')}${appearanceRange('sponsorBarY', 'Vertical', appearance.sponsorBarY, 0, 100, '%')}</div></div>
  </div>
  <div class="goal-settings photo-lineup-settings"><div class="section-header"><div><h3 class="section-title">Acabamento da escalação com fotos e sequência</h3><p class="help-text">Escolha o estilo e a animação; refine o painel, os tempos da sequência e a faixa de marcas exibida no rodapé.</p></div></div>${lineupConceptControls()}${appearanceRange('photoLineupSurface', 'Opacidade da superfície', appearance.photoLineupSurface, 55, 100, '%')}${appearanceRange('photoLineupRadius', 'Arredondamento dos blocos', appearance.photoLineupRadius, 0, 20, 'px')}${appearanceRange('photoLineupIndividualDuration', 'Tempo por titular', appearance.photoLineupIndividualDuration, 2, 10, 's')}${appearanceRange('photoLineupPanelDuration', 'Tempo por painel', appearance.photoLineupPanelDuration, 3, 15, 's')}${appearanceRange('photoLineupSponsorCount', 'Máximo de patrocinadores', appearance.photoLineupSponsorCount, 1, 8, '')}${appearanceRange('photoLineupSponsorBarSize', 'Tamanho da barra de patrocinadores', appearance.photoLineupSponsorBarSize, 60, 180, '%')}</div>
  <div class="goal-settings scoreboard-style-settings"><div class="section-header"><div><h3 class="section-title">Estilo visual do placar</h3><p class="help-text">Escolha uma base e refine cantos, transparência, destaque e sombra.</p></div></div><div class="scoreboard-style-grid">${scoreboardStyles.map(([key,label,caption]) => `<button class="scoreboard-style-choice ${appearance.scoreboardStyle === key ? 'active' : ''}" data-action="scoreboard-style" data-value="${key}" aria-pressed="${appearance.scoreboardStyle === key}"><i class="style-swatch style-swatch-${key}"></i><span><strong>${label}</strong><small>${caption}</small></span></button>`).join('')}</div>${appearanceRange('scoreboardRadius', 'Arredondamento', appearance.scoreboardRadius, 0, 20, 'px')}${appearanceRange('scoreboardSurface', 'Opacidade da superfície', appearance.scoreboardSurface, 55, 100, '%')}${appearanceRange('scoreboardAccent', 'Espessura do destaque', appearance.scoreboardAccent, 0, 8, 'px')}<div class="field"><label>Sombra</label><select data-appearance="scoreboardShadow"><option value="none" ${appearance.scoreboardShadow === 'none' ? 'selected' : ''}>Sem sombra</option><option value="soft" ${appearance.scoreboardShadow === 'soft' ? 'selected' : ''}>Suave</option><option value="strong" ${appearance.scoreboardShadow === 'strong' ? 'selected' : ''}>Forte</option></select></div></div>
  <div class="goal-settings sponsor-format-settings"><div class="section-header"><div><h3 class="section-title">Patrocinadores</h3><p class="help-text">Cadastre nome, logo, banner e uma mídia exclusiva para a escalação.</p></div><button class="button subtle" data-action="test-sponsor-animation">Testar ativo</button></div><div class="field-row"><div class="field"><label>Formato</label><select data-appearance="sponsorFormat"><option value="logo-name" ${appearance.sponsorFormat === 'logo-name' ? 'selected' : ''}>Logo + nome</option><option value="banner-name" ${appearance.sponsorFormat === 'banner-name' ? 'selected' : ''}>Banner + nome</option><option value="banner" ${appearance.sponsorFormat === 'banner' ? 'selected' : ''}>Somente banner 16:9</option><option value="text" ${appearance.sponsorFormat === 'text' ? 'selected' : ''}>Somente nome</option></select></div><div class="field"><label>Animação</label><select data-appearance="sponsorAnimation"><option value="slide" ${appearance.sponsorAnimation === 'slide' ? 'selected' : ''}>Deslizamento</option><option value="zoom" ${appearance.sponsorAnimation === 'zoom' ? 'selected' : ''}>Zoom suave</option><option value="flip" ${appearance.sponsorAnimation === 'flip' ? 'selected' : ''}>Virada 3D</option><option value="fade" ${appearance.sponsorAnimation === 'fade' ? 'selected' : ''}>Dissolver</option></select></div></div>${appearanceRange('sponsorDuration', 'Tempo por patrocinador', appearance.sponsorDuration, 3, 60, 's')}${appearanceRange('sponsorAnimationSpeed', 'Velocidade da animação', appearance.sponsorAnimationSpeed, 50, 160, '%')}${renderSponsorManager()}<p class="help-text">Logo e banner: até 5 MB. Mídia exclusiva da escalação: PNG, JPG, WebP, MP4 ou WebM de até 25 MB.</p></div>
  <div class="goal-settings scoreboard-motion-settings"><div class="section-header"><div><h3 class="section-title">Entrada e saída do placar</h3><p class="help-text">Estas opções são usadas somente ao colocar ou retirar o placar do ar. A troca compacto ↔ aberto usa uma expansão contínua própria.</p></div><button class="button subtle" data-action="test-scoreboard-animation">Testar entrada</button></div><div class="field"><label>Variação</label><select data-appearance="scoreboardAnimation"><option value="assemble" ${appearance.scoreboardAnimation === 'assemble' ? 'selected' : ''}>Montagem por módulos</option><option value="slide" ${appearance.scoreboardAnimation === 'slide' ? 'selected' : ''}>Deslizamento lateral</option><option value="zoom" ${appearance.scoreboardAnimation === 'zoom' ? 'selected' : ''}>Zoom de transmissão</option><option value="flip" ${appearance.scoreboardAnimation === 'flip' ? 'selected' : ''}>Virada 3D</option><option value="elastic" ${appearance.scoreboardAnimation === 'elastic' ? 'selected' : ''}>Elástico</option><option value="glitch" ${appearance.scoreboardAnimation === 'glitch' ? 'selected' : ''}>Glitch digital</option></select></div>${appearanceRange('scoreboardAnimationSpeed', 'Velocidade', appearance.scoreboardAnimationSpeed, 50, 160, '%')}</div>
  <div class="goal-settings"><div class="section-header"><div><h3 class="section-title">Gol dentro do placar · futebol e futsal</h3><p class="help-text">Primeiro aparece “GOOOL ⚽” na cor da equipe; depois, somente o nome do time; por fim, o placar retorna com sua animação configurada.</p></div><button class="button subtle" data-action="test-goal">Testar no placar</button></div><div class="field-row"><div class="field"><label>Texto do gol</label><input maxlength="16" data-appearance="goalText" value="${escapeHtml(appearance.goalText)}"></div><div class="field"><label>Estilo</label><select data-appearance="goalAnimation"><option value="typewriter" ${appearance.goalAnimation === 'typewriter' ? 'selected' : ''}>Escrita letra por letra</option><option value="bounce" ${appearance.goalAnimation === 'bounce' ? 'selected' : ''}>Impacto elástico</option><option value="sweep" ${appearance.goalAnimation === 'sweep' ? 'selected' : ''}>Varredura esportiva</option></select></div></div><div class="field-row">${appearanceRange('goalWordDuration', 'Tempo do “GOOOL ⚽”', appearance.goalWordDuration, 1, 6, 's')}${appearanceRange('goalTeamDuration', 'Tempo do nome da equipe', appearance.goalTeamDuration, 1, 6, 's')}</div><button class="button" data-action="reset-appearance" style="width:100%;margin-top:14px">Restaurar tamanhos padrão</button></div>`;
}

function renderControls() {
  return `<section class="panel control-panel" aria-label="Painel de controle da partida"><div class="tabs">
    <button class="tab ${currentTab === 'match' ? 'active' : ''}" data-action="tab" data-value="match">${icons.monitor} Partida</button>
    <button class="tab ${currentTab === 'teams' ? 'active' : ''}" data-action="tab" data-value="teams">${icons.users} Equipes</button>
    <button class="tab ${currentTab === 'roster' ? 'active' : ''}" data-action="tab" data-value="roster">${icons.list} Escalação</button>
    <button class="tab ${currentTab === 'appearance' ? 'active' : ''}" data-action="tab" data-value="appearance">${icons.layers} Aparência</button>
  </div><div class="control-body ${currentTab === 'appearance' ? 'appearance-body' : ''}">${currentTab === 'teams' ? renderTeamsTab() : currentTab === 'roster' ? renderRosterTab() : currentTab === 'appearance' ? renderAppearanceTab() : renderMatchTab()}</div></section>`;
}

function renderThemes() {
  const themes = [
    { key: 'aurum', name: 'Aurum', colors: ['#8253cd','#d8ad56','#131119'] },
    { key: 'nocturno', name: 'Noturno', colors: ['#5974ef','#90a6ff','#0b1022'] },
    { key: 'campo', name: 'Campo', colors: ['#1f8154','#8cdda6','#0e1813'] },
    { key: 'clean', name: 'Clean', colors: ['#f3f3f2','#a6abb6','#171a1f'] },
  ];
  return `<section class="panel themes-panel"><div class="section-header"><h3 class="section-title">Identidade visual</h3><span class="section-kicker">Tema em tempo real</span></div><div class="theme-list">${themes.map(theme => `<button class="theme-choice ${state.theme === theme.key ? 'active' : ''}" data-action="theme" data-value="${theme.key}"><div class="swatches">${theme.colors.map(color => `<i style="background:${color}"></i>`).join('')}</div><span>${theme.name}</span></button>`).join('')}</div><div class="custom-colors"><label class="color-field"><input type="color" data-field="customPrimary" value="${safeColor(state.customPrimary)}"><span>Cor principal</span></label><label class="color-field"><input type="color" data-field="customAccent" value="${safeColor(state.customAccent, '#d8ad56')}"><span>Destaque</span></label></div><div class="typeface-title">Tipografia do placar</div><div class="typeface-options">${Object.entries(TYPEFACES).map(([key, font]) => `<button class="typeface-choice ${state.typeface === key ? 'active' : ''}" data-action="typeface" data-value="${key}" style="font-family:${escapeHtml(font.stack)}">${font.label}</button>`).join('')}</div></section>`;
}

function renderEvents() {
  return `<section class="panel events-panel"><div class="section-header"><h3 class="section-title">Linha do tempo</h3><button class="button subtle" data-action="clear-events" style="height:26px;font-size:10px">Limpar</button></div><div class="event-list">${state.events.length ? state.events.slice(0, 6).map(event => `<div class="event-line"><div class="event-side"><span class="event-minute">${escapeHtml(event.minute)}</span><span class="event-copy">${escapeHtml(event.title)}</span></div><span class="event-meta">${escapeHtml(event.name || event.team)}</span></div>`).join('') : '<div class="empty-events">Os acontecimentos da partida aparecem aqui.</div>'}</div></section>`;
}

function renderMonitor() {
  return `<section class="panel monitor-panel" aria-label="Pré-visualização ao vivo"><div class="section-header"><h3 class="section-title">Pré-visualização ao vivo</h3><div class="inline-actions"><div class="status-row"><i class="live-dot"></i> Programa</div><button class="button subtle preview-action" data-action="open-preview" aria-label="Abrir visualização completa">${icons.external} Tela cheia</button></div></div><div class="monitor-screen">${renderPreviewBackground()}<div id="preview-overlay">${overlayMarkup()}</div><div class="monitor-label">PRÉVIA · ${escapeHtml(currentSport().label.toUpperCase())}</div></div><div class="monitor-footer"><span>Saída completa sincronizada</span><span class="resolution-badge">1920 × 1080 · 60 fps</span></div>
    <div class="overlay-library"><div class="section-header"><h3 class="section-title">Overlays de transmissão</h3><button class="button subtle" data-action="hide-event" style="height:28px;font-size:10px">Limpar GC</button></div><div class="library-grid">
      ${renderOverlayCard('scoreboard','Placar', 'Tempo + gols', icons.monitor, state.visible.scoreboard)}
      ${renderOverlayCard('lineup','Escalação', `${currentSport().teamSize} titulares`, icons.list, state.visible.lineup)}
      ${renderOverlayCard('photo-lineup','Apresentação da equipe', 'Jogadores + reservas + técnico', icons.users, state.visible.photoLineup)}
      ${renderOverlayCard('sponsor','Patrocínio', `${state.appearance?.sponsorFormat === 'banner' ? 'Banner 16:9' : 'Tarja'} · ${clampNumber(state.appearance?.sponsorDuration, 3, 60, 10)}s`, icons.layers, state.visible.sponsor)}
      ${renderOverlayCard('sponsor-bar','Barra de Patrocinadores', `1500 × 200 · ${clampNumber(state.appearance?.sponsorBarDuration, 3, 60, 10)}s`, icons.layers, state.visible.sponsorBar)}
      ${renderOverlayCard('stats','Estatísticas', 'Comparativo · gols e cartões · atleta', icons.list, state.visible.stats)}
      ${renderOverlayCard('event','GC / evento', 'Nome + detalhes', icons.text, eventIsVisible())}
    </div></div></section>`;
}

function renderPreviewBackground() {
  return `<div class="pitch court-${escapeHtml(currentSport().court)}"><i class="center-circle"></i><i class="penalty-box left"></i><i class="penalty-box right"></i></div>`;
}

function renderSportSwitcher() {
  return `<div class="sport-switcher" role="group" aria-label="Modalidade esportiva">${Object.entries(SPORTS).map(([key, sport]) => `<button class="sport-choice ${state.sport === key ? 'active' : ''}" data-action="sport" data-value="${key}" aria-pressed="${state.sport === key}"><span class="sport-choice-icon">${sport.icon}</span><span class="sport-choice-text"><strong>${sport.label}</strong><small>${sport.short}</small></span></button>`).join('')}</div>`;
}

function renderOverlayCard(key, title, caption, icon, active) {
  return `<button class="overlay-card ${active ? 'active' : ''}" data-action="overlay-${key}" aria-label="${active ? 'Ocultar' : 'Exibir'} ${title}"><div class="overlay-card-top"><span class="overlay-icon">${icon}</span><i class="toggle ${active ? 'on' : ''}"></i></div><div><strong>${title}</strong><small>${caption}</small></div></button>`;
}

function moduleUrl(key = '') {
  return `${location.origin}/manage${key ? `/${key}` : ''}${platformMode ? '' : `?room=${encodeURIComponent(ROOM_ID)}`}`;
}

function platformUrl(key = 'dashboard') {
  return `${location.origin}/manage/${key}`;
}

function versionLabel() {
  return `Versão ${appVersion || '…'}`;
}

async function loadAppVersion() {
  try {
    const response = await fetch('/health', { cache: 'no-store' });
    const data = response.ok ? await response.json() : {};
    if (data.version) { appVersion = String(data.version).slice(0, 20); render(); }
  } catch {}
}

function renderScoreboardModuleControls() {
  const sport = currentSport();
  return `<div class="module-section"><div class="field"><label for="competition">Competição</label><input id="competition" data-field="competition" value="${escapeHtml(state.competition)}"></div>${renderScoreboardLayoutControl()}<div class="scoreboard-control"><div class="teams-grid"><div>${badge(state.home)}<div class="team-short-name">${escapeHtml(state.home.name)}</div><div class="score-controls"><button class="goal-control" data-action="score-home-minus">−</button><span class="score-number">${state.home.score}</span><button class="goal-control" data-action="score-home-plus">+</button></div></div><span class="score-x">×</span><div>${badge(state.away)}<div class="team-short-name">${escapeHtml(state.away.name)}</div><div class="score-controls"><button class="goal-control" data-action="score-away-minus">−</button><span class="score-number">${state.away.score}</span><button class="goal-control" data-action="score-away-plus">+</button></div></div></div></div>${renderSportMetrics()}<div class="tiny-label">${sport.duration ? 'Cronômetro regressivo' : 'Cronômetro da partida'}</div><div class="clock-box"><span class="clock-time" data-clock>${clockText()}</span><div class="clock-buttons"><button class="button square ${state.clock.running ? '' : 'primary'}" data-action="clock-toggle">${state.clock.running ? icons.pause : icons.play}</button><button class="button square" data-action="clock-back">−1</button><button class="button square" data-action="clock-forward">+1</button><button class="button square" data-action="clock-reset">${icons.refresh}</button></div></div><div class="period-buttons">${sport.periods.map(([value,label]) => `<button class="period-button ${state.period === value ? 'active' : ''}" data-action="period" data-value="${value}">${label}</button>`).join('')}</div></div>`;
}

function renderSponsorModuleControls() {
  const appearance = state.appearance || defaultAppearance();
  return `<div class="module-section"><div class="field-row"><div class="field"><label>Formato</label><select data-appearance="sponsorFormat"><option value="logo-name" ${appearance.sponsorFormat === 'logo-name' ? 'selected' : ''}>Logo + nome</option><option value="banner-name" ${appearance.sponsorFormat === 'banner-name' ? 'selected' : ''}>Banner + nome</option><option value="banner" ${appearance.sponsorFormat === 'banner' ? 'selected' : ''}>Banner 16:9</option><option value="text" ${appearance.sponsorFormat === 'text' ? 'selected' : ''}>Somente nome</option></select></div><div class="field"><label>Animação</label><select data-appearance="sponsorAnimation"><option value="slide" ${appearance.sponsorAnimation === 'slide' ? 'selected' : ''}>Deslizamento</option><option value="zoom" ${appearance.sponsorAnimation === 'zoom' ? 'selected' : ''}>Zoom suave</option><option value="flip" ${appearance.sponsorAnimation === 'flip' ? 'selected' : ''}>Virada 3D</option><option value="fade" ${appearance.sponsorAnimation === 'fade' ? 'selected' : ''}>Dissolver</option></select></div></div>${appearanceRange('sponsorDuration', 'Tempo por patrocinador', appearance.sponsorDuration, 3, 60, 's')}${appearanceRange('sponsorAnimationSpeed', 'Velocidade da animação', appearance.sponsorAnimationSpeed, 50, 160, '%')}${renderSponsorManager()}</div>`;
}

function renderSponsorWideControls() {
  const videoActive = state.sponsorBarMode === 'video';
  return `<section class="sponsor-wide-controls"><div class="section-header"><div><h3 class="section-title">Barra independente · 1500 × 200</h3><p class="help-text">Mídias próprias desta saída. Não utiliza nem altera os patrocinadores dos outros overlays.</p></div>${!videoActive ? '<button class="button subtle" data-action="add-sponsor-bar-item">+ Adicionar banner</button>' : ''}</div><div class="lineup-output-choices"><button class="button ${!videoActive ? 'primary' : ''}" data-action="sponsor-bar-mode" data-value="images">Imagens individuais</button><button class="button ${videoActive ? 'primary' : ''}" data-action="sponsor-bar-mode" data-value="video">Vídeo único</button></div>${videoActive ? `<label class="sponsor-upload-button wide-video-upload">${state.sponsorBarVideo ? 'Trocar vídeo 1500 × 200' : 'Enviar vídeo 1500 × 200'}<input type="file" data-sponsor-wide-video accept="video/mp4,video/webm"></label>` : `<div class="sponsor-wide-list">${state.sponsorBarItems.length ? state.sponsorBarItems.map((item, index) => `<label><span>Banner ${String(index + 1).padStart(2, '0')}</span><b>${item.asset ? 'Arte enviada' : '1500 × 200'}</b><input type="file" data-sponsor-wide-image="${escapeHtml(item.id)}" accept="image/png,image/jpeg,image/webp"><button type="button" class="button square subtle" data-action="remove-sponsor-bar-item" data-value="${escapeHtml(item.id)}" aria-label="Remover banner">×</button></label>`).join('') : '<div class="empty-events">Adicione um banner 1500 × 200 para iniciar.</div>'}</div>`}</section>`;
}

function lineupConceptControls() {
  const appearance = state.appearance || defaultAppearance();
  const classic = (appearance.photoLineupLayout || 'classic') === 'classic';
  const size = appearance.photoLineupFormationMark === 'photo' ? appearanceRange('photoLineupFormationPhotoSize', 'Tamanho das fotos no esquema', clampNumber(appearance.photoLineupFormationPhotoSize, 60, 200, 100), 60, 200) : '';
  const classicChoices = classic
    ? `${appearanceChoices('photoLineupStyle', 'Estilo da apresentação', '', true)}${appearanceChoices('photoLineupAnimation', 'Animação de entrada e troca de painel', 'Vale para entrada, saída e troca entre titulares, esquema e reservas.')}`
    : '<p class="help-text">Este conceito usa o visual e a animação próprios. Volte para "Clássico" para escolher estilo e animação separadamente.</p>';
  return `${appearanceChoices('photoLineupLayout', 'Conceito da apresentação', 'Cada conceito traz layout, visual e animação próprios.')}${appearanceChoices('photoLineupFormationMark', 'Jogadores no esquema tático', 'Escolha o que aparece dentro de cada posição.')}${size}${classicChoices}`;
}

function appearanceChoices(field, label, caption, swatches = false) {
  const options = OVERLAY_STYLE_OPTIONS[field] || [];
  const current = options.some(([value]) => value === state.appearance?.[field]) ? state.appearance[field] : options[0]?.[0];
  return `<div class="appearance-choices"><div class="appearance-choices-head"><strong>${escapeHtml(label)}</strong>${caption ? `<small>${escapeHtml(caption)}</small>` : ''}</div><div class="appearance-choice-grid" role="group" aria-label="${escapeHtml(label)}">${options.map(([value, name, hint]) => `<button type="button" class="appearance-choice ${current === value ? 'active' : ''}" data-action="appearance-option" data-value="${field}|${value}" aria-pressed="${current === value}">${swatches ? `<i class="choice-swatch choice-swatch-${value}"></i>` : ''}<span><strong>${escapeHtml(name)}</strong>${hint ? `<small>${escapeHtml(hint)}</small>` : ''}</span></button>`).join('')}</div></div>`;
}

const SPONSOR_BAR_PRESETS = {
  clean: { label: 'Limpa', caption: 'Arte pura, sem moldura', values: { sponsorBarScale: 100, sponsorBarOpacity: 100, sponsorBarRadius: 0, sponsorBarBorder: 'none', sponsorBarShadow: 'none', sponsorBarFit: 'cover' } },
  highlight: { label: 'Destaque', caption: 'Cantos suaves, moldura e sombra', values: { sponsorBarScale: 100, sponsorBarOpacity: 100, sponsorBarRadius: 10, sponsorBarBorder: 'accent', sponsorBarShadow: 'strong', sponsorBarFit: 'cover' } },
  discreet: { label: 'Discreta', caption: 'Menor e levemente translúcida', values: { sponsorBarScale: 88, sponsorBarOpacity: 88, sponsorBarRadius: 6, sponsorBarBorder: 'thin', sponsorBarShadow: 'soft', sponsorBarFit: 'contain' } },
};

function renderSponsorBarSettings() {
  const appearance = state.appearance || defaultAppearance();
  const autoSchedule = Boolean(state.sponsorBarAutoSchedule);
  const presets = Object.entries(SPONSOR_BAR_PRESETS).map(([key, preset]) => `<button type="button" class="sponsor-bar-preset" data-action="sponsor-bar-preset" data-value="${key}"><strong>${preset.label}</strong><small>${preset.caption}</small></button>`).join('');
  return `<div class="module-section sponsor-bar-settings">
    <section class="sponsor-bar-preview-card"><div class="sponsor-bar-preview-head"><div><strong>Prévia da barra</strong><small>1500 × 200 · reflete ajuste, opacidade, moldura e sombra atuais</small></div><span class="sponsor-bar-status ${state.visible.sponsorBar ? 'is-live' : ''}">${state.visible.sponsorBar ? 'NO AR' : 'FORA DO AR'}</span></div><div class="sponsor-bar-preview" style="--overlay-primary:#8253cd;--overlay-accent:#d8ad56;--overlay-dark:#131119;--overlay-light:#ffffff">${renderSponsorBarOverlay()}</div><div class="sponsor-bar-presets"><span>Predefinições</span><div>${presets}</div></div></section>
    <section class="sponsor-bar-group"><header><strong>Transição</strong><small>Como a barra entra e sai do ar.</small></header>${appearanceChoices('sponsorBarTransition', 'Animação', '')}<div class="field-row">${appearanceRange('sponsorBarAnimationSpeed', 'Velocidade da transição', appearance.sponsorBarAnimationSpeed, 50, 160, '%')}${appearanceRange('sponsorBarDuration', 'Tempo entre patrocinadores', appearance.sponsorBarDuration, 3, 60, 's')}</div></section>
    <section class="sponsor-bar-group"><header><strong>Arte e acabamento</strong><small>Ajuste da mídia dentro dos 1500 × 200 e moldura da barra.</small></header>${appearanceChoices('sponsorBarFit', 'Ajuste da mídia', '')}<div class="field-row">${appearanceRange('sponsorBarScale', 'Escala interna da arte', appearance.sponsorBarScale, 60, 180, '%')}${appearanceRange('sponsorBarOpacity', 'Opacidade', appearance.sponsorBarOpacity, 20, 100, '%')}</div><div class="field-row">${appearanceRange('sponsorBarRadius', 'Arredondamento', appearance.sponsorBarRadius, 0, 24, 'px')}<label class="color-field"><span>Fundo da barra</span><input type="color" data-appearance="sponsorBarBackground" value="${safeColor(appearance.sponsorBarBackground, '#08090d')}"></label></div>${appearanceChoices('sponsorBarBorder', 'Moldura', '')}${appearanceChoices('sponsorBarShadow', 'Sombra', '')}<p class="help-text">A saída permanece independente em 1500 × 200. Posição e tamanho no programa completo ficam na aba Aparência.</p></section>
    <section class="sponsor-bar-group"><header><strong>Exibição</strong><small>Controle manual, looping e agendamento automático.</small></header><div class="inline-actions"><button class="button ${state.visible.sponsorBar ? 'primary' : ''}" data-action="overlay-sponsor-bar">${state.visible.sponsorBar ? 'Ocultar barra agora' : 'Exibir barra agora'}</button><button class="button ${state.sponsorBarLoop ? 'primary' : ''}" data-action="toggle-sponsor-bar-loop">${state.sponsorBarLoop ? 'Parar looping' : 'Iniciar looping'}</button><button class="button" data-action="next-sponsor-bar">Próximo patrocinador</button></div>
    <div class="team-access-box"><div><strong>Exibição automática por intervalo</strong><small>${autoSchedule ? `A barra aparece por ${clampNumber(appearance.sponsorBarDuration, 3, 60, 10)}s a cada ${clampNumber(state.sponsorBarScheduleInterval, 1, 60, 5)} min, sem precisar clicar em exibir.` : 'Desativada. A barra só aparece por ação manual ou looping.'}</small></div><button class="button ${autoSchedule ? 'primary' : 'subtle'}" data-action="toggle-sponsor-bar-schedule">${autoSchedule ? 'Desativar' : 'Ativar'}</button></div>
    ${autoSchedule ? `<label class="parameter-control"><span>Intervalo entre exibições <strong>${clampNumber(state.sponsorBarScheduleInterval, 1, 60, 5)} min</strong></span><input type="range" min="1" max="60" step="1" value="${clampNumber(state.sponsorBarScheduleInterval, 1, 60, 5)}" data-field="sponsorBarScheduleInterval"></label>` : ''}</section></div>`;
}

function formatReportDateTime(value, options = {}) {
  if (!value) return 'Não registrado';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Não registrado';
  return options.timeOnly ? date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : date.toLocaleString('pt-BR');
}

function formatMatchDuration(startedAt, endedAt) {
  if (!startedAt || !endedAt) return 'Não registrada';
  const seconds = Math.max(0, Math.round((Number(endedAt) - Number(startedAt)) / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  return `${hours ? `${hours}h ` : ''}${String(minutes).padStart(2, '0')}min ${String(rest).padStart(2, '0')}s`;
}

function reportSnapshot(source = state, finalized = false) {
  const teamDetails = side => {
    const catalog = teamCatalog.find(team => team.id === source.selectedTeams?.[side]);
    const teamSource = catalog || source[side];
    const groups = lineupGroups(teamSource);
    return { name: source[side].name, short: source[side].short, logo: source[side].logo || teamSource.logo || '', color: source[side].color, score: Number(source[side].score || 0), starters: groups.starters, reserves: groups.reserves, staff: normalizedStaff(teamSource), formation: teamSource.formation || '4-3-3' };
  };
  const createdAt = Date.now();
  const endedAt = source.matchEndedAt || (finalized ? createdAt : null);
  return {
    id: `${ROOM_ID}-${endedAt || 'andamento'}`, schemaVersion: 2, status: finalized || source.matchEndedAt ? 'final' : 'live', room: ROOM_ID, createdAt, competition: source.competition,
    venue: source.venue || 'Não informado', sport: source.sport, sportLabel: SPORTS[source.sport]?.label || source.sport,
    date: source.matchStartedAt ? new Date(source.matchStartedAt).toLocaleDateString('pt-BR') : new Date().toLocaleDateString('pt-BR'),
    startedAt: source.matchStartedAt, endedAt, duration: formatMatchDuration(source.matchStartedAt, endedAt), clockElapsed: clockSeconds(source.clock),
    home: teamDetails('home'), away: teamDetails('away'),
    events: structuredClone(source.events || []).reverse(), extraTime: Number(source.extraTime || 0), periodScores: structuredClone(source.periodScores || {}),
    finalScore: `${source.home.score} × ${source.away.score}`, generatedAt: createdAt,
  };
}

function reportEventRows(report) {
  return (report.events || []).map(event => `<tr><td>${escapeHtml(event.minute || '—')}</td><td>${escapeHtml(event.period || '—')}</td><td>${escapeHtml(event.title)}</td><td>${escapeHtml(event.team || '—')}</td><td>${escapeHtml(event.name || '—')}</td><td>${escapeHtml(event.note || '—')}</td><td>${escapeHtml(event.score || '—')}</td></tr>`).join('');
}

function reportTeamSection(team, side) {
  return `<section class="report-team"><header><div class="report-team-mark" style="--team-report-color:${safeColor(team.color, '#2f7df6')}">${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="">` : escapeHtml(team.short || side)}</div><div><small>${side}</small><h2>${escapeHtml(team.name)}</h2><p>Esquema ${escapeHtml(team.formation)} · ${team.score} gol${team.score === 1 ? '' : 's'}</p></div></header><h3>Titulares</h3><ol class="report-roster">${team.starters.map(player => `<li><b>${escapeHtml(player.number || '—')}</b><span>${escapeHtml(player.name)}<small>${escapeHtml(player.position || 'Posição não informada')}</small></span></li>`).join('')}</ol><h3>Comissão técnica</h3><ul class="report-staff">${team.staff.map(member => `<li><span>${escapeHtml(member.role)}</span><strong>${escapeHtml(member.name)}</strong></li>`).join('')}</ul><h3>Reservas</h3><ol class="report-roster">${team.reserves.map(player => `<li><b>${escapeHtml(player.number || '—')}</b><span>${escapeHtml(player.name)}<small>${escapeHtml(player.position || 'Posição não informada')}</small></span></li>`).join('')}</ol></section>`;
}

function reportSummaryEntries(report) {
  const eventTitles = (report.events || []).map(event => String(event.title || '').toLocaleLowerCase('pt-BR'));
  const count = matcher => eventTitles.filter(title => matcher.test(title)).length;
  return [['Gols', count(/gol|cesta|ponto/)], ['Amarelos', count(/amarelo/)], ['Vermelhos', count(/vermelho/)], ['Substituições', count(/substitui/)], ['Outros eventos', Math.max(0, eventTitles.length - count(/gol|cesta|ponto|amarelo|vermelho|substitui/))]];
}

function reportPeriodScoresHtml(report) {
  const periodScores = Object.entries(report.periodScores || {}).map(([period, score]) => `<div><span>${escapeHtml(period)}</span><strong>${escapeHtml(score)}</strong></div>`).join('');
  return periodScores || '<p>Sem parciais registradas.</p>';
}

function reportCoverHtml(report, kicker) {
  return `<header class="report-cover"><div class="report-brand"><span>JEC</span><div><strong>JUVENTUDE OVERLAY STUDIO</strong><small>${escapeHtml(kicker)}</small></div></div><div class="report-status">${report.status === 'final' ? 'FINALIZADO' : 'PRÉVIA'}</div><div class="report-score"><div><small>MANDANTE</small><strong>${escapeHtml(report.home.name)}</strong></div><b>${escapeHtml(report.finalScore)}</b><div><small>VISITANTE</small><strong>${escapeHtml(report.away.name)}</strong></div></div><p>${escapeHtml(report.competition)} · ${escapeHtml(report.sportLabel || report.sport)} · ${escapeHtml(report.date)}</p></header>`;
}

function reportFactsHtml(report) {
  return `<section class="report-facts"><div><span>Local</span><strong>${escapeHtml(report.venue || 'Não informado')}</strong></div><div><span>Início real</span><strong>${escapeHtml(formatReportDateTime(report.startedAt, { timeOnly: true }))}</strong></div><div><span>Encerramento</span><strong>${escapeHtml(formatReportDateTime(report.endedAt, { timeOnly: true }))}</strong></div><div><span>Duração real</span><strong>${escapeHtml(report.duration || formatMatchDuration(report.startedAt, report.endedAt))}</strong></div><div><span>Acréscimos</span><strong>+${Number(report.extraTime || 0)} min</strong></div></section>`;
}

function reportFooterHtml(report) {
  return `<footer class="report-footer"><span>Documento ${escapeHtml(report.id)}</span><span>Gerado em ${escapeHtml(formatReportDateTime(report.generatedAt || report.createdAt))}</span></footer>`;
}

function printableReport(report) {
  return `<article class="match-report-print report-document">${reportCoverHtml(report, 'RELATÓRIO FINAL DA PARTIDA')}
  ${reportFactsHtml(report)}
  <section class="report-summary"><h2>Resumo da partida</h2><div>${reportSummaryEntries(report).map(([label,value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}</div></section>
  <div class="report-team-grid">${reportTeamSection(report.home, 'MANDANTE')}${reportTeamSection(report.away, 'VISITANTE')}</div>
  <section class="report-periods"><h2>Placar por período</h2><div>${reportPeriodScoresHtml(report)}</div></section>
  <section class="report-events"><h2>Linha do tempo completa</h2><table><thead><tr><th>Min.</th><th>Período</th><th>Evento</th><th>Equipe</th><th>Atleta</th><th>Detalhe</th><th>Placar</th></tr></thead><tbody>${reportEventRows(report) || '<tr><td colspan="7">Nenhum evento registrado.</td></tr>'}</tbody></table></section>
  ${reportFooterHtml(report)}</article>`;
}

function printableLineupReport(report) {
  return `<article class="match-report-print report-document">${reportCoverHtml(report, 'ESCALAÇÃO DA PARTIDA')}
  ${reportFactsHtml(report)}
  <div class="report-team-grid">${reportTeamSection(report.home, 'MANDANTE')}${reportTeamSection(report.away, 'VISITANTE')}</div>
  ${reportFooterHtml(report)}</article>`;
}

function printableActivitiesReport(report) {
  return `<article class="match-report-print report-document">${reportCoverHtml(report, 'ATIVIDADES DA PARTIDA')}
  ${reportFactsHtml(report)}
  <section class="report-summary"><h2>Resumo da partida</h2><div>${reportSummaryEntries(report).map(([label,value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}</div></section>
  <section class="report-periods"><h2>Placar por período</h2><div>${reportPeriodScoresHtml(report)}</div></section>
  <section class="report-events"><h2>Linha do tempo completa</h2><table><thead><tr><th>Min.</th><th>Período</th><th>Evento</th><th>Equipe</th><th>Atleta</th><th>Detalhe</th><th>Placar</th></tr></thead><tbody>${reportEventRows(report) || '<tr><td colspan="7">Nenhum evento registrado.</td></tr>'}</tbody></table></section>
  ${reportFooterHtml(report)}</article>`;
}

const REPORT_EXPORT_TYPES = { full: { label: 'Tudo', build: printableReport, kicker: 'Relatório' }, lineup: { label: 'Escalação', build: printableLineupReport, kicker: 'Escalação' }, activities: { label: 'Atividades', build: printableActivitiesReport, kicker: 'Atividades' } };
function printableByType(report, type) {
  return (REPORT_EXPORT_TYPES[type] || REPORT_EXPORT_TYPES.full).build(report);
}

function printablePregame() {
  return `<article class="report-document pregame-print"><header class="report-cover"><div class="report-brand"><span>JEC</span><div><strong>JUVENTUDE OVERLAY STUDIO</strong><small>RESUMO PRÉ-JOGO</small></div></div><h1>${escapeHtml(state.home.name)} × ${escapeHtml(state.away.name)}</h1><p>${escapeHtml(state.competition)} · ${escapeHtml(state.venue)} · ${new Date().toLocaleDateString('pt-BR')}</p></header><div class="pregame-grid">${renderPregameTeam('home')}${renderPregameTeam('away')}</div><footer class="report-footer"><span>Sala ${escapeHtml(ROOM_ID)}</span><span>Gerado em ${escapeHtml(formatReportDateTime(Date.now()))}</span></footer></article>`;
}

function openPrintableDocument(title, content, printWindow = null) {
  const target = printWindow || window.open('', '_blank');
  if (!target?.document) { toast('O navegador bloqueou a janela do PDF. Permita pop-ups e tente novamente.'); return false; }
  try { target.opener = null; } catch {}
  target.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(title)}</title><link rel="stylesheet" href="/styles.css"></head><body class="print-document">${content}<script>addEventListener('load',()=>setTimeout(()=>print(),350))<\/script></body></html>`);
  target.document.close();
  return true;
}

function renderReportModule() {
  const reports = [reportSnapshot(), ...(state.completedReports || [])];
  const report = reports[Math.min(reportSelection, reports.length - 1)];
  const typeChoices = Object.entries(REPORT_EXPORT_TYPES).map(([key, meta]) => `<button class="layout-choice ${reportExportType === key ? 'active' : ''}" data-action="report-export-type" data-value="${key}"><strong>${escapeHtml(meta.label)}</strong></button>`).join('');
  return `<div class="report-toolbar"><div><strong>Relatório da partida</strong><small>${state.matchEndedAt ? `Finalizado em ${formatReportDateTime(state.matchEndedAt)}` : 'Ao finalizar, o relatório é congelado no histórico e preparado em PDF.'}</small></div><div class="inline-actions"><button class="button primary" data-action="${state.matchEndedAt ? 'print-final-report' : 'finish-match'}">${state.matchEndedAt ? 'Abrir PDF final' : 'Finalizar partida e gerar PDF'}</button><button class="button" data-action="print-report">Exportar relatório selecionado</button></div></div>
  <div class="scoreboard-layout-control"><span>Conteúdo do PDF</span><div role="group" aria-label="Tipo de relatório para exportação">${typeChoices}</div></div>
  ${state.completedReports?.length ? `<div class="field"><label>Histórico de partidas finalizadas</label><select data-report-selection><option value="0">Prévia da partida atual</option>${state.completedReports.map((item, index) => `<option value="${index + 1}" ${reportSelection === index + 1 ? 'selected' : ''}>${escapeHtml(item.date)} · ${escapeHtml(item.home.name)} ${escapeHtml(item.finalScore)} ${escapeHtml(item.away.name)}</option>`).join('')}</select></div>` : ''}${printableByType(report, reportExportType)}`;
}

function renderPregameTeam(side) {
  const catalog = teamCatalog.find(team => team.id === state.selectedTeams?.[side]);
  const team = catalog || state[side];
  const groups = lineupGroups(team);
  const staff = normalizedStaff(team);
  const coach = staff.find(member => member.role === 'Treinador') || staff[0];
  const rows = players => players.map(player => `<tr><td>${escapeHtml(player.number || '—')}</td><td>${escapeHtml(player.name || 'Atleta')}</td><td>${escapeHtml(player.position || '—')}</td></tr>`).join('');
  return `<article class="pregame-team"><header>${badge(state[side])}<div><small>${side === 'home' ? 'MANDANTE' : 'VISITANTE'}</small><h2>${escapeHtml(state[side].name)}</h2></div></header><h3>Titulares</h3><table><thead><tr><th>Nº</th><th>Nome</th><th>Posição</th></tr></thead><tbody>${rows(groups.starters)}</tbody></table><h3>Comissão técnica</h3>${coach ? `<div class="pregame-coach"><small>TÉCNICO</small><strong>${escapeHtml(coach.name)}</strong></div>` : ''}<ul>${staff.filter(item => item.id !== coach?.id).map(member => `<li><span>${escapeHtml(member.role)}</span><strong>${escapeHtml(member.name)}</strong></li>`).join('')}</ul><h3>Reservas</h3><table><thead><tr><th>Nº</th><th>Nome</th><th>Posição</th></tr></thead><tbody>${rows(groups.reserves)}</tbody></table></article>`;
}

function renderPregameModule() {
  return `<div class="pregame-head"><div><span>Consulta rápida</span><h2>Resumo pré-jogo para narradores</h2></div><button class="button" data-action="print-pregame">Exportar PDF</button></div><div class="pregame-grid">${renderPregameTeam('home')}${renderPregameTeam('away')}</div>`;
}

function renderChampionshipTheme() {
  const theme = state.championshipTheme;
  return `<section class="championship-theme"><div class="section-header"><div><h3 class="section-title">Tema global do campeonato</h3><p class="help-text">Aplicado automaticamente a todos os overlays; cada módulo pode ter uma cor própria.</p></div><button class="button ${theme.enabled ? 'primary' : ''}" data-action="toggle-championship-theme">${theme.enabled ? 'Tema ativo' : 'Ativar tema'}</button></div><div class="field"><label>Nome do tema</label><input data-championship-field="name" value="${escapeHtml(theme.name)}"></div><div class="theme-color-grid">${[['primary','Principal'],['secondary','Secundária'],['support1','Apoio 1'],['support2','Apoio 2']].map(([key,label]) => `<label class="color-field"><input type="color" data-championship-field="${key}" value="${safeColor(theme[key])}"><span>${label}</span></label>`).join('')}</div><div class="theme-overrides"><strong>Sobrescrita por overlay</strong>${['scoreboard','lineup','event','sponsor','sponsorBar'].map(key => `<label><span>${{scoreboard:'Placar',lineup:'Escalações',event:'Cartões / lower thirds',sponsor:'Patrocinadores',sponsorBar:'Barra de Patrocinadores'}[key]}</span><input type="color" data-theme-override="${key}" value="${safeColor(theme.overrides?.[key]?.primary, theme.primary)}"></label>`).join('')}</div></section>`;
}

function moduleTabs() {
  const tabs = [['information','Informações'],['settings','Configurações'],['media','Mídias'],['control','Prévia / Controle']];
  return `<div class="module-content-tabs" role="tablist">${tabs.map(([key,label]) => `<button class="${moduleTab === key ? 'active' : ''}" data-action="module-tab" data-value="${key}">${label}</button>`).join('')}</div>`;
}

function customOverlayUrl(item) {
  return `${location.origin}/overlay?layer=custom&id=${encodeURIComponent(item.id)}&room=${encodeURIComponent(ROOM_ID)}`;
}

const BUILDER_TEMPLATES = [
  { key: 'blank', name: 'Em branco', caption: 'Comece do zero', width: 1920, height: 1080, elements: [] },
  { key: 'lower-third', name: 'Lower third', caption: 'Nome e cargo com barra de destaque', width: 1200, height: 260, elements: [
    { type: 'shape', name: 'Faixa de destaque', x: 0, y: 18, w: 1.4, h: 64, fill: '#d8ad56', animIn: 'wipe', duration: 500 },
    { type: 'shape', name: 'Painel', x: 1.4, y: 18, w: 98.6, h: 64, fill: '#10131a', fillOpacity: 94, animIn: 'slide-left', delay: 120, duration: 600 },
    { type: 'text', name: 'Nome', text: 'NOME DO ENTREVISTADO', x: 5, y: 24, w: 90, h: 32, size: 54, weight: 800, transform: 'uppercase', valign: 'bottom', animIn: 'slide-left', delay: 280 },
    { type: 'text', name: 'Cargo', text: 'Cargo ou função', x: 5, y: 56, w: 90, h: 20, size: 30, weight: 500, color: '#d8ad56', valign: 'top', animIn: 'fade', delay: 460 },
  ] },
  { key: 'mini-scoreboard', name: 'Mini-placar', caption: 'Placar compacto com tempo', width: 900, height: 200, elements: [
    { type: 'shape', name: 'Fundo', x: 0, y: 6, w: 100, h: 88, fill: '#0d0f15', radius: 18, shadow: 'soft', animIn: 'zoom' },
    { type: 'text', name: 'Mandante', text: '{home.short}', x: 3, y: 10, w: 26, h: 60, size: 64, weight: 800, align: 'center', animIn: 'fade', delay: 200 },
    { type: 'shape', name: 'Caixa do placar', x: 30, y: 12, w: 40, h: 62, fill: '#d8ad56', radius: 14, animIn: 'pop', delay: 120 },
    { type: 'text', name: 'Placar', text: '{home.score} × {away.score}', x: 30, y: 12, w: 40, h: 62, size: 78, weight: 800, align: 'center', color: '#10131a', animIn: 'pop', delay: 240 },
    { type: 'text', name: 'Visitante', text: '{away.short}', x: 71, y: 10, w: 26, h: 60, size: 64, weight: 800, align: 'center', animIn: 'fade', delay: 200 },
    { type: 'text', name: 'Tempo', text: '{clock} · {period}', x: 30, y: 74, w: 40, h: 18, size: 30, weight: 600, align: 'center', color: '#b4b6c2', animIn: 'fade', delay: 400 },
  ] },
  { key: 'announcement', name: 'Aviso central', caption: 'Cartão com título, texto e patrocinador', width: 1280, height: 720, elements: [
    { type: 'shape', name: 'Fundo', x: 0, y: 0, w: 100, h: 100, fill: '#0d1230', fill2: '#1b1240', fillAngle: 145, animIn: 'fade' },
    { type: 'shape', name: 'Linha', x: 8, y: 30, w: 14, h: 0.8, fill: '#d8ad56', animIn: 'wipe', delay: 200, duration: 600 },
    { type: 'text', name: 'Título', text: 'AVISO IMPORTANTE', x: 8, y: 32, w: 84, h: 24, size: 96, weight: 800, transform: 'uppercase', valign: 'top', animIn: 'slide-up', delay: 300 },
    { type: 'text', name: 'Texto', text: 'Escreva aqui a mensagem para o público.', x: 8, y: 58, w: 70, h: 24, size: 38, weight: 500, color: '#c9cbe0', valign: 'top', animIn: 'fade', delay: 550 },
    { type: 'image', name: 'Patrocinador', src: 'token:sponsor', x: 76, y: 74, w: 16, h: 16, fit: 'contain', animIn: 'fade', delay: 700 },
  ] },
  { key: 'halftime', name: 'Intervalo / resultado', caption: 'Tela cheia com escudos e placar', width: 1920, height: 1080, elements: [
    { type: 'shape', name: 'Fundo', x: 0, y: 0, w: 100, h: 100, fill: '#0a0b10', fill2: '#1a1330', fillAngle: 160, animIn: 'fade' },
    { type: 'text', name: 'Competição', text: '{competition}', x: 10, y: 8, w: 80, h: 8, size: 44, weight: 600, align: 'center', color: '#d8ad56', transform: 'uppercase', spacing: 12, animIn: 'fade', delay: 200 },
    { type: 'image', name: 'Escudo mandante', src: 'token:home.logo', x: 10, y: 28, w: 20, h: 36, fit: 'contain', animIn: 'slide-left', delay: 300 },
    { type: 'image', name: 'Escudo visitante', src: 'token:away.logo', x: 70, y: 28, w: 20, h: 36, fit: 'contain', animIn: 'slide-right', delay: 300 },
    { type: 'text', name: 'Placar', text: '{home.score}  ×  {away.score}', x: 30, y: 30, w: 40, h: 30, size: 200, weight: 800, align: 'center', animIn: 'pop', delay: 500 },
    { type: 'text', name: 'Mandante', text: '{home.name}', x: 6, y: 68, w: 28, h: 10, size: 46, weight: 700, align: 'center', transform: 'uppercase', animIn: 'slide-up', delay: 650 },
    { type: 'text', name: 'Visitante', text: '{away.name}', x: 66, y: 68, w: 28, h: 10, size: 46, weight: 700, align: 'center', transform: 'uppercase', animIn: 'slide-up', delay: 650 },
    { type: 'text', name: 'Período', text: '{period}', x: 30, y: 62, w: 40, h: 7, size: 40, weight: 600, align: 'center', color: '#b4b6c2', animIn: 'fade', delay: 800 },
  ] },
  { key: 'standings', name: 'Classificação (top 6)', caption: 'Tabela do campeonato ao vivo, pela API', width: 900, height: 620, elements: [
    { type: 'shape', name: 'Fundo', x: 0, y: 0, w: 100, h: 100, fill: '#0d0f15', fillOpacity: 94, radius: 18, shadow: 'soft', animIn: 'zoom' },
    { type: 'shape', name: 'Faixa', x: 0, y: 0, w: 100, h: 13, fill: '#d8ad56', radius: 18, animIn: 'slide-down', delay: 100 },
    { type: 'text', name: 'Título', text: '{champ.name}', x: 4, y: 0, w: 92, h: 13, size: 40, weight: 800, color: '#10131a', transform: 'uppercase', animIn: 'fade', delay: 250 },
    ...[1, 2, 3, 4, 5, 6].flatMap(position => [
      { type: 'text', name: `Posição ${position}`, text: `{table.${position}.position}`, x: 4, y: 14 + (position - 1) * 14, w: 7, h: 14, size: 34, weight: 800, align: 'center', color: '#d8ad56', animIn: 'slide-left', delay: 300 + position * 90 },
      { type: 'text', name: `Equipe ${position}`, text: `{table.${position}.name}`, x: 13, y: 14 + (position - 1) * 14, w: 55, h: 14, size: 36, weight: 700, transform: 'uppercase', animIn: 'slide-left', delay: 340 + position * 90 },
      { type: 'text', name: `Pontos ${position}`, text: `{table.${position}.points} pts`, x: 68, y: 14 + (position - 1) * 14, w: 14, h: 14, size: 36, weight: 800, align: 'right', color: '#d8ad56', animIn: 'fade', delay: 380 + position * 90 },
      { type: 'text', name: `Saldo ${position}`, text: `SG {table.${position}.gd}`, x: 83, y: 14 + (position - 1) * 14, w: 14, h: 14, size: 26, weight: 500, align: 'right', color: '#b4b6c2', animIn: 'fade', delay: 400 + position * 90 },
    ]),
  ] },
  { key: 'sponsor-tag', name: 'Selo de patrocínio', caption: '"Apresentado por" com logo', width: 700, height: 200, elements: [
    { type: 'shape', name: 'Fundo', x: 0, y: 8, w: 100, h: 84, fill: '#ffffff', radius: 100, shadow: 'soft', animIn: 'slide-left' },
    { type: 'text', name: 'Rótulo', text: 'APRESENTADO POR', x: 8, y: 22, w: 46, h: 24, size: 24, weight: 700, color: '#5b5f6e', spacing: 14, animIn: 'fade', delay: 300 },
    { type: 'text', name: 'Marca', text: '{sponsor}', x: 8, y: 46, w: 46, h: 34, size: 46, weight: 800, color: '#10131a', transform: 'uppercase', animIn: 'fade', delay: 380 },
    { type: 'image', name: 'Logo', src: 'token:sponsor', x: 58, y: 18, w: 34, h: 64, fit: 'contain', animIn: 'zoom', delay: 450 },
  ] },
  { key: 'ticker', name: 'Faixa rolante', caption: 'Texto corrido em loop', width: 1920, height: 100, elements: [
    { type: 'shape', name: 'Faixa', x: 0, y: 0, w: 100, h: 100, fill: '#10131a', fillOpacity: 95, animIn: 'slide-up', duration: 500 },
    { type: 'shape', name: 'Selo', x: 0, y: 0, w: 12, h: 100, fill: '#d8ad56', animIn: 'slide-right', delay: 200 },
    { type: 'text', name: 'Selo', text: 'AVISO', x: 0, y: 0, w: 12, h: 100, size: 40, weight: 800, align: 'center', color: '#10131a', animIn: 'fade', delay: 300 },
    { type: 'text', name: 'Texto rolante', text: 'Escreva aqui o aviso que vai rolar na tela  •  {competition}  •  {home.short} {home.score} × {away.score} {away.short}', x: 13, y: 0, w: 86, h: 100, size: 42, weight: 600, marquee: true, marqueeSpeed: 22, animIn: 'fade', delay: 400 },
  ] },
];

const BUILDER_ADD_PRESETS = [
  ['text', 'Texto', { type: 'text', text: 'Novo texto', w: 34, h: 12 }],
  ['image', 'Imagem', { type: 'image', w: 24, h: 30, fit: 'contain' }],
  ['video', 'Vídeo', { type: 'video', w: 30, h: 30 }],
  ['rect', 'Retângulo', { type: 'shape', shape: 'rect', fill: '#2f7df6', w: 30, h: 16 }],
  ['circle', 'Círculo', { type: 'shape', shape: 'circle', fill: '#d8ad56', w: 14, h: 25 }],
  ['home-logo', 'Escudo casa', { type: 'image', name: 'Escudo mandante', src: 'token:home.logo', w: 14, h: 25, fit: 'contain' }],
  ['away-logo', 'Escudo fora', { type: 'image', name: 'Escudo visitante', src: 'token:away.logo', w: 14, h: 25, fit: 'contain' }],
  ['score', 'Placar', { type: 'text', name: 'Placar', text: '{home.score} × {away.score}', w: 30, h: 16, size: 72, align: 'center' }],
  ['clock', 'Cronômetro', { type: 'text', name: 'Cronômetro', text: '{clock}', w: 20, h: 12, size: 56, align: 'center' }],
];

function overlayFromTemplate(template, existing = []) {
  const taken = existing.map(entry => entry.id);
  return {
    id: newBuilderId('overlay', taken), name: template.key === 'blank' ? `Overlay ${existing.length + 1}` : template.name, width: template.width, height: template.height,
    title: '', subtitle: '', media: '', mediaType: 'image', layout: 'media-text', animation: 'fade', background: '#10131a', accent: '#2f7df6', textColor: '#ffffff',
    visible: false, transition: null, canvasBg: '', autoHide: 0, expiresAt: 0,
    elements: template.elements.map((raw, index) => normalizedCustomElement({ ...raw, id: `el-${index + 1}` }, index)),
  };
}

function commitOverlay(mutator, options = { immediate: true }) {
  commit(draft => { const item = selectedCustomOverlay(draft); if (item) mutator(item, draft); }, options);
}

let platformOverlays = [];
let platformOverlaysLoadedAt = 0;

async function loadPlatformOverlays(force = false) {
  if (!isAdminPanel || libraryMode || managementModule !== 'builder' || adminSession.status !== 'authenticated') return;
  if (!force && Date.now() - platformOverlaysLoadedAt < 10000) return;
  platformOverlaysLoadedAt = Date.now();
  try {
    const response = await fetch(`/api/state?room=${BUILDER_LIBRARY_ROOM}&ts=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) return;
    const remote = await response.json();
    const next = remote?.updatedAt ? normalizeState(remote).customOverlays : [];
    if (JSON.stringify(next) !== JSON.stringify(platformOverlays)) { platformOverlays = next; render(); }
  } catch {}
}

let builderSelectedEl = '';
let builderTab = 'position';
let builderPreviewAnim = '';
let builderGrid = false;

function selectedBuilderElement(item = selectedCustomOverlay()) {
  return item?.elements?.find(el => el.id === builderSelectedEl) || null;
}

function builderFieldNumber(label, field, value, min, max, step = 1) {
  return `<div class="field"><label>${label}</label><input type="number" data-el-field="${field}" min="${min}" max="${max}" step="${step}" value="${escapeHtml(String(value))}"></div>`;
}

function builderFieldSelect(label, field, value, options) {
  return `<div class="field"><label>${label}</label><select data-el-field="${field}">${options.map(([key, text]) => `<option value="${escapeHtml(String(key))}" ${String(value) === String(key) ? 'selected' : ''}>${escapeHtml(text)}</option>`).join('')}</select></div>`;
}

function builderFieldColor(label, field, value, clearable = false) {
  return `<div class="builder-color-field"><label><input type="color" data-el-field="${field}" value="${safeColor(value, '#000000')}"><span>${label}</span></label>${clearable ? `<button class="button subtle" data-action="builder-clear" data-value="${field}" ${value ? '' : 'disabled'}>Limpar</button>` : ''}</div>`;
}

function builderInspector(item, el) {
  if (!el) return `<div class="builder-inspector-empty"><strong>Nenhum elemento selecionado</strong><p>Clique em um elemento do canvas ou da lista de camadas. Use os botões acima do canvas para adicionar texto, imagem, formas e dados da partida.</p><div class="builder-tokens-help"><small>Dados ao vivo que funcionam em qualquer texto:</small><div>${BUILDER_TOKENS.map(([token, label]) => `<code title="${escapeHtml(label)}">${escapeHtml(token)}</code>`).join('')}</div></div></div>`;
  const tabs = [['position', 'Posição'], ['style', 'Estilo'], ['content', el.type === 'text' ? 'Texto' : el.type === 'shape' ? 'Forma' : 'Mídia'], ['animation', 'Animação']];
  let body = '';
  if (builderTab === 'position') {
    body = `<div class="field-row">${builderFieldNumber('X (%)', 'x', el.x, -100, 200, 0.5)}${builderFieldNumber('Y (%)', 'y', el.y, -100, 200, 0.5)}</div><div class="field-row">${builderFieldNumber('Largura (%)', 'w', el.w, 0.5, 300, 0.5)}${builderFieldNumber('Altura (%)', 'h', el.h, 0.5, 300, 0.5)}</div><div class="field-row">${builderFieldNumber('Rotação (°)', 'rotation', el.rotation, -360, 360, 1)}${builderFieldNumber('Opacidade (%)', 'opacity', el.opacity, 0, 100, 1)}</div>
      <div class="builder-align"><span>Alinhar no canvas</span><div>${[['left', '⟸ Esquerda'], ['hcenter', '↔ Centro'], ['right', 'Direita ⟹'], ['top', '⟰ Topo'], ['vmiddle', '↕ Meio'], ['bottom', 'Base ⟱']].map(([key, label]) => `<button class="button subtle" data-action="builder-align" data-value="${key}">${label}</button>`).join('')}</div></div><p class="help-text">Arraste no canvas para mover, use as alças para redimensionar e as setas do teclado para ajustar (Shift = passos maiores). Shift + alça de canto mantém a proporção.</p>`;
  } else if (builderTab === 'style') {
    const fonts = [['global', 'Fonte global do projeto'], ...Object.entries(TYPEFACES).map(([key, font]) => [key, font.label])];
    const textStyle = el.type === 'text' ? `<div class="builder-group"><strong>Texto</strong>${builderFieldSelect('Fonte', 'font', el.font, fonts)}<div class="field-row">${builderFieldNumber('Tamanho (px)', 'size', el.size, 6, 800, 1)}${builderFieldSelect('Peso', 'weight', el.weight, [[400, 'Regular'], [500, 'Médio'], [600, 'Semibold'], [700, 'Negrito'], [800, 'Extra'], [900, 'Black']])}</div>${builderFieldColor('Cor do texto', 'color', el.color)}<div class="field-row">${builderFieldSelect('Horizontal', 'align', el.align, [['left', 'Esquerda'], ['center', 'Centro'], ['right', 'Direita']])}${builderFieldSelect('Vertical', 'valign', el.valign, [['top', 'Topo'], ['middle', 'Meio'], ['bottom', 'Base']])}</div><div class="field-row">${builderFieldNumber('Espaçamento', 'spacing', el.spacing, -10, 40, 1)}${builderFieldNumber('Entrelinha (%)', 'lineHeight', el.lineHeight, 70, 220, 5)}</div>${builderFieldNumber('Recuo interno (px)', 'padding', el.padding, 0, 300, 1)}<label class="builder-check"><input type="checkbox" data-el-field="transform" ${el.transform === 'uppercase' ? 'checked' : ''}> Caixa alta</label><label class="builder-check"><input type="checkbox" data-el-field="italic" ${el.italic ? 'checked' : ''}> Itálico</label><label class="builder-check"><input type="checkbox" data-el-field="marquee" ${el.marquee ? 'checked' : ''}> Texto rolante (loop)</label>${el.marquee ? builderFieldNumber('Duração do loop (s)', 'marqueeSpeed', el.marqueeSpeed, 2, 90, 1) : ''}</div>` : '';
    const mediaStyle = el.type === 'image' || el.type === 'video' ? `<div class="builder-group"><strong>Mídia</strong>${builderFieldSelect('Ajuste', 'fit', el.fit, [['cover', 'Preencher (corta)'], ['contain', 'Conter (inteira)']])}</div>` : '';
    body = `${textStyle}${mediaStyle}<div class="builder-group"><strong>Caixa</strong>${builderFieldColor('Fundo', 'fill', el.fill || '#000000', true)}${el.fill ? `<div class="field-row">${builderFieldNumber('Opacidade do fundo (%)', 'fillOpacity', el.fillOpacity, 0, 100, 1)}${builderFieldNumber('Ângulo (°)', 'fillAngle', el.fillAngle, 0, 360, 5)}</div>${builderFieldColor('Segunda cor (degradê)', 'fill2', el.fill2 || '#000000', true)}` : ''}<div class="field-row">${builderFieldNumber('Cantos (px)', 'radius', el.radius, 0, 800, 1)}${builderFieldNumber('Borda (px)', 'borderWidth', el.borderWidth, 0, 80, 1)}</div>${el.borderWidth ? builderFieldColor('Cor da borda', 'borderColor', el.borderColor) : ''}${builderFieldSelect('Sombra', 'shadow', el.shadow, [['none', 'Sem sombra'], ['soft', 'Suave'], ['strong', 'Forte']])}</div>`;
  } else if (builderTab === 'content') {
    if (el.type === 'text') body = `<div class="field"><label>Texto</label><textarea data-el-field="text" maxlength="400" rows="4">${escapeHtml(el.text)}</textarea></div><div class="builder-tokens-help"><small>Clique para inserir um dado ao vivo:</small><div>${BUILDER_TOKENS.map(([token, label]) => `<button type="button" class="builder-token" data-action="builder-token" data-value="${escapeHtml(token)}" title="${escapeHtml(label)}">${escapeHtml(label)}</button>`).join('')}</div></div>`;
    else if (el.type === 'shape') body = builderFieldSelect('Formato', 'shape', el.shape, [['rect', 'Retângulo'], ['circle', 'Círculo / elipse']]);
    else {
      const tokenValue = el.src.startsWith('token:') ? el.src : '';
      body = `<div class="field"><label>Fonte da mídia</label><select data-el-field="src"><option value="" ${!el.src ? 'selected' : ''}>Nenhuma</option>${BUILDER_IMAGE_TOKENS.map(([token, label]) => `<option value="${token}" ${tokenValue === token ? 'selected' : ''}>${label} (dado ao vivo)</option>`).join('')}${el.src && !tokenValue ? `<option value="${escapeHtml(el.src)}" selected>Arquivo enviado</option>` : ''}</select></div><label class="sponsor-upload-button builder-media-upload">${el.src && !tokenValue ? 'Trocar arquivo' : 'Enviar imagem ou vídeo'}<input type="file" data-el-media="${escapeHtml(item.id)}|${escapeHtml(el.id)}" accept="image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm"></label><p class="help-text">Imagens e vídeos de até 25 MB. Vídeos tocam sem som e em loop.</p>`;
    }
  } else {
    const outOptions = [['same', 'Igual à entrada (invertida)'], ...BUILDER_ANIMATIONS];
    body = `${builderFieldSelect('Entrada', 'animIn', el.animIn, BUILDER_ANIMATIONS)}${builderFieldSelect('Saída', 'animOut', el.animOut, outOptions)}<div class="field-row">${builderFieldNumber('Atraso (ms)', 'delay', el.delay, 0, 10000, 50)}${builderFieldNumber('Duração (ms)', 'duration', el.duration, 100, 5000, 50)}</div><button class="button" data-action="builder-play" data-value="enter">▶ Reproduzir entrada</button><p class="help-text">Os atrasos permitem montar sequências: um elemento entra depois do outro. Use "Cascata" na barra do overlay para escalonar todos de uma vez.</p>`;
  }
  return `<div class="builder-tabs" role="tablist">${tabs.map(([key, label]) => `<button class="${builderTab === key ? 'active' : ''}" data-action="builder-tab" data-value="${key}">${label}</button>`).join('')}</div><div class="builder-props">${body}</div><div class="builder-el-actions"><button class="button subtle" data-action="builder-dup-el">Duplicar</button><button class="button subtle" data-action="builder-z" data-value="front">Trazer p/ frente</button><button class="button subtle" data-action="builder-z" data-value="back">Enviar p/ trás</button><button class="button subtle danger" data-action="builder-remove-el">Excluir elemento</button></div>`;
}

function builderLayers(item) {
  const typeIcon = { text: 'T', image: '▣', video: '▶', shape: '◆' };
  const rows = [...item.elements].map((el, index) => ({ el, index })).reverse().map(({ el, index }) => `<div class="builder-layer ${el.id === builderSelectedEl ? 'active' : ''} ${el.visible ? '' : 'is-hidden'}" data-action="builder-select" data-value="${escapeHtml(el.id)}"><span class="builder-layer-icon">${typeIcon[el.type]}</span><strong>${escapeHtml(el.name)}</strong><span class="builder-layer-actions"><button data-action="builder-toggle" data-value="${escapeHtml(el.id)}|visible" title="${el.visible ? 'Ocultar' : 'Mostrar'}" aria-label="${el.visible ? 'Ocultar' : 'Mostrar'}">${el.visible ? '◉' : '○'}</button><button data-action="builder-toggle" data-value="${escapeHtml(el.id)}|locked" title="${el.locked ? 'Destravar' : 'Travar'}" aria-label="${el.locked ? 'Destravar' : 'Travar'}">${el.locked ? '🔒' : '🔓'}</button><button data-action="builder-z" data-value="${escapeHtml(el.id)}|up" title="Subir camada" aria-label="Subir camada" ${index === item.elements.length - 1 ? 'disabled' : ''}>↑</button><button data-action="builder-z" data-value="${escapeHtml(el.id)}|down" title="Descer camada" aria-label="Descer camada" ${index === 0 ? 'disabled' : ''}>↓</button></span></div>`).join('');
  return rows || '<div class="portal-empty">Sem elementos. Adicione texto, imagem ou uma forma.</div>';
}

function renderOverlayBuilder() {
  const item = selectedCustomOverlay();
  const templates = BUILDER_TEMPLATES.map(template => `<button class="builder-template" data-action="builder-template" data-value="${template.key}"><strong>${escapeHtml(template.name)}</strong><small>${escapeHtml(template.caption)} · ${template.width} × ${template.height}</small></button>`).join('');
  const side = `<aside class="builder-side"><div class="section-header"><strong>Meus overlays</strong><button class="button subtle" data-action="add-custom-overlay">+ Novo</button></div>${(state.customOverlays || []).map(overlay => `<button class="builder-list-item ${item && overlay.id === item.id ? 'active' : ''}" data-action="select-custom-overlay" data-value="${escapeHtml(overlay.id)}"><i class="${overlay.visible ? 'on' : ''}"></i><span><strong>${escapeHtml(overlay.name)}</strong><small>${overlay.width} × ${overlay.height} · ${overlay.elements.length} elemento${overlay.elements.length === 1 ? '' : 's'}</small></span></button>`).join('') || '<p class="help-text">Nenhum overlay criado ainda.</p>'}<div class="section-header builder-side-title"><strong>Modelos</strong></div><div class="builder-templates">${templates}</div>${libraryMode ? '' : `<div class="section-header builder-side-title"><strong>Modelos da plataforma</strong></div>${platformOverlays.length ? platformOverlays.map(model => `<div class="builder-template"><strong>${escapeHtml(model.name)}</strong><small>${model.width} × ${model.height} · ${model.elements.length} elemento${model.elements.length === 1 ? '' : 's'}</small><button class="button subtle" data-action="builder-use-platform" data-value="${escapeHtml(model.id)}">Usar nesta partida</button></div>`).join('') : '<p class="help-text">Nenhum modelo salvo. Use "Salvar como modelo" em um overlay para reaproveitá-lo em todas as partidas.</p>'}<a class="button subtle" href="${escapeHtml(platformUrl('builder'))}">Gerenciar modelos</a>`}<label class="button subtle builder-import">Importar overlay (.json)<input type="file" data-builder-import accept="application/json,.json" hidden></label></aside>`;
  if (!item) return `<div class="overlay-builder">${side}<section class="overlay-builder-empty"><div><span>BUILDER DE OVERLAYS</span><h2>Monte qualquer overlay, sem programar</h2><p>Combine textos, imagens, vídeos e formas em um canvas livre, com dados ao vivo da partida (placar, tempo, escudos), animações de entrada e saída e uma URL exclusiva para o OBS. Comece por um modelo ao lado ou por um canvas em branco.</p></div><button class="button primary" data-action="add-custom-overlay">Criar overlay em branco</button></section></div>`;
  const el = selectedBuilderElement(item);
  const sizeKey = `${item.width}x${item.height}`;
  const sizeOptions = [...BUILDER_SIZES, ...(BUILDER_SIZES.some(([key]) => key === sizeKey) ? [] : [[sizeKey, `Personalizado ${item.width} × ${item.height}`]])];
  const addBar = BUILDER_ADD_PRESETS.map(([key, label]) => `<button class="button" data-action="builder-add" data-value="${key}">+ ${label}</button>`).join('');
  const selection = el && !builderPreviewAnim ? `<div class="builder-selection ${el.locked ? 'is-locked' : ''}" data-el-selection style="left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;rotate:${el.rotation}deg">${el.locked ? '' : ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map(handle => `<i data-el-handle="${handle}" class="h-${handle}"></i>`).join('')}</div>` : '';
  return `<div class="overlay-builder">${side}
    <section class="builder-main"><div class="builder-topbar"><div class="field builder-name"><label>Nome</label><input data-custom-field="name" value="${escapeHtml(item.name)}" maxlength="80"></div><div class="field"><label>Tamanho do canvas</label><select data-size-preset>${sizeOptions.map(([key, label]) => `<option value="${key}" ${key === sizeKey ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field"><label>Fundo do canvas</label><div class="builder-color-field"><label><input type="color" data-custom-field="canvasBg" value="${safeColor(item.canvasBg, '#000000')}"><span>${item.canvasBg ? 'Cor' : 'Transparente'}</span></label><button class="button subtle" data-action="builder-clear" data-value="canvasBg" ${item.canvasBg ? '' : 'disabled'}>Limpar</button></div></div><div class="field"><label>Sumir sozinho (s)</label><input type="number" min="0" max="3600" step="1" data-custom-field="autoHide" value="${item.autoHide}" title="0 = manual"></div></div>
      <div class="builder-actionbar"><button class="button ${item.visible ? '' : 'primary'}" data-action="toggle-custom-overlay" data-value="${escapeHtml(item.id)}">${item.visible ? 'Retirar do ar' : 'Colocar no ar'}</button><button class="button" data-action="builder-play" data-value="both">▶ Testar animação</button><button class="button subtle" data-action="builder-stagger">Cascata</button><button class="button" data-action="copy-custom-url" data-value="${escapeHtml(item.id)}">${icons.copy} URL OBS</button><button class="button subtle ${builderGrid ? 'active' : ''}" data-action="builder-grid">Grade</button><button class="button subtle" data-action="builder-duplicate-overlay">Duplicar</button>${libraryMode ? '' : '<button class="button subtle" data-action="builder-save-platform">Salvar como modelo</button>'}<button class="button subtle" data-action="builder-export">Exportar</button><button class="button subtle danger" data-action="remove-custom-overlay" data-value="${escapeHtml(item.id)}">Excluir</button></div>
      <div class="builder-addbar"><span>Adicionar</span>${addBar}</div>
      <div class="builder-stage"><div class="builder-canvas ${builderGrid ? 'has-grid' : ''}" data-builder-canvas style="aspect-ratio:${item.width}/${item.height}">${customOverlayMarkup(item, true, { editor: true, animate: builderPreviewAnim })}${selection}<i class="builder-guide-v" data-guide="v" hidden></i><i class="builder-guide-h" data-guide="h" hidden></i></div><div class="builder-stage-foot"><span>Canvas ${item.width} × ${item.height}</span><small>Na fonte Navegador do OBS, use exatamente estas dimensões e a URL do overlay.</small></div></div>
    </section>
    <aside class="builder-inspector"><div class="builder-panel-title">Camadas</div><div class="builder-layers">${builderLayers(item)}</div><div class="builder-panel-title">${el ? escapeHtml(el.name) : 'Propriedades'}</div>${builderInspector(item, el)}</aside></div>`;
}

function renderModuleControls(key) {
  if (key === 'dashboard') return renderDashboardModule();
  if (key === 'delegations') return renderDelegationsModule();
  if (key === 'championships') return renderChampionshipsModule();
  if (key === 'matches') return renderMatchesModule();
  if (key === 'audit') return renderAuditModule();
  if (key === 'builder') return renderOverlayBuilder();
  if (key === 'pregame') return renderPregameModule();
  if (key === 'report') return renderReportModule();
  if (key === 'access') return renderAccessModule();
  if (key === 'announcements') return renderAnnouncementsModule();
  if (key === 'live') return renderLiveModule();
  if (key === 'standings') return renderStandingsModule();
  if (key === 'feed') return renderFeedModule();
  if (key === 'arts') return renderArtsModule();
  if (key === 'backup') return renderBackupModule();
  let content = '';
  if (moduleTab === 'control') content = `<div class="module-section"><div class="inline-actions"><button class="button primary" data-action="${key === 'scoreboard' ? 'overlay-scoreboard' : key === 'lineup' ? 'overlay-photo-lineup' : key === 'sponsors' ? 'overlay-sponsor' : key === 'sponsor-bar' ? 'overlay-sponsor-bar' : key === 'stats' ? 'overlay-stats' : 'overlay-event'}">Mostrar / Ocultar</button>${key === 'scoreboard' ? '<button class="button" data-action="test-scoreboard-animation">Testar entrada</button><button class="button" data-action="test-goal">Testar gol</button>' : key === 'sponsors' ? '<button class="button" data-action="test-sponsor-animation">Testar transição</button>' : key === 'sponsor-bar' ? '<button class="button" data-action="next-sponsor-bar">Testar troca</button>' : ''}</div></div>`;
  else if (moduleTab === 'settings') content = renderModuleSettings(key);
  else if (moduleTab === 'media') content = key === 'sponsors' ? renderSponsorModuleControls() : key === 'sponsor-bar' ? renderSponsorWideControls() : key === 'lineup' ? `<div class="module-section">${renderRosterTab()}</div>` : key === 'scoreboard' ? `<div class="module-section">${renderTeamsTab()}</div>` : '<div class="empty-events">Este overlay não precisa de mídias próprias.</div>';
  else if (key === 'scoreboard') content = `${renderScoreboardModuleControls()}${renderPeriodExtraControls()}`;
  else if (key === 'stats') content = renderStatsModuleControls();
  if (key === 'events' && !content) content = `<div class="module-section">${renderSportActions()}</div>${renderEvents()}`;
  if (key === 'lineup' && !content) content = `<div class="module-section">${renderRosterTab()}</div>`;
  if (key === 'sponsors' && !content) content = renderSponsorModuleControls();
  if (key === 'sponsor-bar' && !content) content = `${renderSponsorBarSettings()}${renderSponsorWideControls()}`;
  if (key === 'teams') return `<div class="module-section">${renderTeamsTab()}</div>`;
  if (key === 'appearance') return `<div class="module-section">${renderChampionshipTheme()}${renderAppearanceTab()}</div>`;
  if (LIBRARY_MODULES.includes(key)) {
    const locked = !libraryMode && sponsorLibrary && state.sponsorSource === 'platform' && moduleTab !== 'control' && moduleTab !== 'settings';
    return `${renderSponsorSourceBanner()}${moduleTabs()}${locked ? `<fieldset class="library-locked" disabled>${content}</fieldset>` : content}`;
  }
  return `${moduleTabs()}${content}`;
}

function renderSponsorSourceBanner() {
  const editUrl = platformUrl('sponsors');
  if (libraryMode) return '<div class="library-banner"><div><strong>Biblioteca da plataforma</strong><p>Marcas, mídias e barra cadastradas aqui valem para todas as partidas que usam a biblioteca. Também podem ir ao ar sem partida: use <b>Saídas OBS</b> para copiar os links fixos desta biblioteca.</p></div></div>';
  if (!sponsorLibrary) return `<div class="library-banner"><div><strong>Patrocínios só desta partida</strong><p>Crie a biblioteca da plataforma para cadastrar marcas uma vez e usar em todas as partidas.</p></div><a class="button" href="${escapeHtml(editUrl)}">Criar biblioteca</a></div>`;
  const inherited = state.sponsorSource === 'platform';
  return `<div class="library-banner ${inherited ? 'is-inherited' : ''}"><div><strong>${inherited ? 'Usando a biblioteca da plataforma' : 'Personalizado para esta partida'}</strong><p>${inherited ? 'Marcas e barra vêm da biblioteca; para alterar, edite a biblioteca ou personalize só esta partida.' : 'Esta partida usa marcas próprias. Volte à biblioteca para receber as atualizações da plataforma.'}</p></div><div class="library-banner-actions"><a class="button subtle" href="${escapeHtml(editUrl)}">Editar biblioteca</a><button class="button ${inherited ? '' : 'primary'}" data-action="sponsor-source" data-value="${inherited ? 'match' : 'platform'}">${inherited ? 'Personalizar esta partida' : 'Usar biblioteca'}</button></div></div>`;
}

function moduleOnAir(layer) {
  if (layer === 'scoreboard') return state.visible.scoreboard;
  if (layer === 'event') return eventIsVisible();
  if (layer === 'photo-lineup') return state.visible.photoLineup;
  if (layer === 'sponsor') return state.visible.sponsor;
  if (layer === 'sponsor-bar') return state.visible.sponsorBar;
  if (layer === 'stats') return state.visible.stats;
  return true;
}

function renderModuleMonitor(module) {
  const active = moduleOnAir(module.layer);
  const action = { scoreboard: 'overlay-scoreboard', event: 'overlay-event', 'photo-lineup': 'overlay-photo-lineup', sponsor: 'overlay-sponsor', 'sponsor-bar': 'overlay-sponsor-bar', stats: 'overlay-stats' }[module.layer];
  return `<section class="panel module-monitor"><div class="section-header"><div><h3 class="section-title">Prévia isolada</h3><span class="module-air-state ${active ? 'on' : ''}">${active ? 'NO AR' : 'FORA DO AR'}</span></div><div class="inline-actions">${action ? `<button class="button ${active ? '' : 'primary'}" data-action="${action}">${active ? 'Retirar' : 'Exibir'}</button>` : ''}<button class="button subtle" data-action="copy-url" data-value="${escapeHtml(module.layer)}">${icons.copy} URL OBS</button></div></div><div class="monitor-screen module-monitor-screen">${renderPreviewBackground()}<div id="preview-overlay">${overlayMarkup(module.layer)}</div>${active ? '' : '<div class="module-empty-preview">Overlay fora do ar</div>'}<div class="monitor-label">${escapeHtml(module.label.toUpperCase())} · 1920 × 1080</div></div></section>`;
}

let settingsOpen = {};

const MODULE_APPEARANCE_PREFIXES = { scoreboard: ['scoreboard', 'period', 'extraTime', 'goal'], events: ['event'], lineup: ['photoLineup'], sponsors: ['sponsor'], 'sponsor-bar': ['sponsorBar'], stats: ['stats'] };

function settingsFooter(key) {
  return `<div class="settings-footer"><div><strong>Restaurar padrões</strong><small>Volta somente as configurações visuais deste módulo. Dados da partida não são alterados.</small></div><button class="button subtle" data-action="reset-module-appearance" data-value="${key}">Restaurar padrões do módulo</button></div>`;
}

function renderModuleSettings(key) {
  if (key === 'sponsor-bar') return `${renderSponsorBarSettings()}${settingsFooter(key)}`;
  const appearance = state.appearance || defaultAppearance();
  const sections = key === 'scoreboard' ? [
    ['style', 'Estilo e layout', 'Aparência geral do placar', overlayStyleControl('scoreboardStyle', 'Estilo do placar')],
    ['size', 'Tamanho, fonte e posição', 'Ajuste fino na área 1920 × 1080', renderAppearanceComponent('Placar', 'Tamanho, fonte e posição', 'scoreboard')],
    ['period', 'Período e tempo extra', 'Indicador de período do jogo', renderPeriodStyleControls()],
    ['theme', 'Tema do campeonato', 'Cores compartilhadas por todos os overlays', renderChampionshipTheme()],
  ] : key === 'lineup' ? [
    ['style', 'Estilo e animação', 'Baseados em transmissões profissionais', lineupConceptControls()],
    ['size', 'Tamanho, fonte e posição', 'Ajuste fino na área 1920 × 1080', renderAppearanceComponent('Escalação', 'Tamanho, fonte e posição', 'photoLineup')],
  ] : key === 'sponsors' ? [
    ['style', 'Estilo', 'Aparência do patrocínio', overlayStyleControl('sponsorStyle', 'Estilo dos patrocinadores')],
    ['size', 'Tamanho, fonte e posição', 'Ajuste fino na área 1920 × 1080', renderAppearanceComponent('Patrocinador', 'Logo, banner ou nome', 'sponsor')],
  ] : key === 'stats' ? [
    ['style', 'Estilo e animação', 'Como o painel aparece e sai', `${appearanceChoices('statsStyle', 'Estilo do painel', '')}${appearanceChoices('statsAnimation', 'Animação de entrada e saída', '')}`],
    ['size', 'Tamanho, fonte e posição', 'Ajuste fino na área 1920 × 1080', renderAppearanceComponent('Estatísticas', 'Tamanho, fonte e posição', 'stats')],
    ['timing', 'Exibição', 'Tempo em tela', `${appearanceRange('statsDuration', 'Ocultar automaticamente após', appearance.statsDuration, 0, 60, 's')}<p class="help-text">Use 0 para manter no ar até você ocultar manualmente.</p>`],
  ] : [
    ['style', 'Estilo', 'Aparência dos eventos e GC', overlayStyleControl('eventStyle', 'Estilo dos eventos')],
    ['size', 'Tamanho, fonte e posição', 'Ajuste fino na área 1920 × 1080', renderAppearanceComponent('Eventos', 'Cartões, substituições e lower thirds', 'event')],
  ];
  return `<div class="module-section settings-stack">${sections.map(([id, title, caption, body], index) => {
    const sectionKey = `${key}:${id}`;
    const open = settingsOpen[sectionKey] ?? index === 0;
    return `<details class="settings-section" data-settings-section="${escapeHtml(sectionKey)}" ${open ? 'open' : ''}><summary><span><strong>${escapeHtml(title)}</strong><small>${escapeHtml(caption)}</small></span></summary><div class="settings-section-body">${body}</div></details>`;
  }).join('')}${settingsFooter(key)}</div>`;
}

function renderStatsModuleControls() {
  const derived = derivedStats();
  const views = [['compare', 'Comparativo', 'Barras lado a lado'], ['timeline', 'Gols e cartões', 'Registros por equipe'], ['player', 'Destaque do atleta', 'Cartão de um jogador']];
  const viewButtons = views.map(([value, label, hint]) => `<button type="button" class="appearance-choice ${state.statsView === value ? 'active' : ''}" data-action="stats-view" data-value="${value}" aria-pressed="${state.statsView === value}"><span><strong>${label}</strong><small>${hint}</small></span></button>`).join('');
  const stepper = (side, metric) => `<div class="stats-stepper"><button type="button" class="button square subtle" data-action="stats-adjust" data-value="${side}|${metric.key}|-1" aria-label="Diminuir">−</button><b>${state.stats[side][metric.key]}</b><button type="button" class="button square subtle" data-action="stats-adjust" data-value="${side}|${metric.key}|1" aria-label="Aumentar">+</button></div>`;
  const manualRows = STATS_METRICS.filter(metric => metric.manual && metric.key !== 'possession').map(metric => `<div class="stats-input-row"><span>${escapeHtml(metric.label)}</span>${stepper('home', metric)}${stepper('away', metric)}</div>`).join('');
  const derivedRows = STATS_METRICS.filter(metric => metric.derived).map(metric => `<div class="stats-input-row is-derived"><span>${escapeHtml(metric.label)}</span><b>${derived.totals.home[metric.key]}</b><b>${derived.totals.away[metric.key]}</b></div>`).join('');
  const selected = normalizedStatsMetrics(state.statsMetrics);
  const chips = STATS_METRICS.map(metric => `<button type="button" class="access-chip ${selected.includes(metric.key) ? 'active' : ''}" data-action="stats-toggle-metric" data-value="${metric.key}" aria-pressed="${selected.includes(metric.key)}">${escapeHtml(metric.label)}</button>`).join('');
  const side = state.statsPlayer?.team === 'away' ? 'away' : 'home';
  const players = rosterPlayers(state[side].roster);
  return `<div class="module-section stats-module">
    <section class="stats-block"><div class="section-header"><div><h3 class="section-title">Visualização no ar</h3><p class="help-text">Escolha o que o overlay de estatísticas mostra. Gols, cartões e substituições vêm dos eventos registrados na partida.</p></div></div><div class="appearance-choice-grid">${viewButtons}</div></section>
    <section class="stats-block"><div class="section-header"><div><h3 class="section-title">Indicadores do comparativo</h3><p class="help-text">Até 6 indicadores, na ordem em que forem marcados.</p></div></div><div class="access-chips" role="group" aria-label="Indicadores">${chips}</div></section>
    <section class="stats-block"><div class="section-header"><div><h3 class="section-title">Dados da partida</h3><p class="help-text">Lance os números durante o jogo. As colunas são ${escapeHtml(state.home.short)} (esquerda) e ${escapeHtml(state.away.short)} (direita).</p></div><button class="button subtle" data-action="stats-reset">Zerar</button></div>
      <label class="parameter-control"><span>Posse de bola <strong>${state.stats.home.possession}% × ${100 - state.stats.home.possession}%</strong></span><input type="range" min="0" max="100" step="1" value="${state.stats.home.possession}" data-stats-possession></label>
      <div class="stats-input-head"><span></span><b>${escapeHtml(state.home.short)}</b><b>${escapeHtml(state.away.short)}</b></div>${manualRows}<div class="stats-input-head"><span>Automático (eventos)</span><b></b><b></b></div>${derivedRows}</section>
    <section class="stats-block"><div class="section-header"><div><h3 class="section-title">Destaque do atleta</h3><p class="help-text">Usado na visualização "Destaque do atleta". Gols e cartões do atleta são contados pelos eventos com o mesmo nome.</p></div></div>
      <div class="field-row"><div class="field"><label>Equipe</label><select data-stats-player="team"><option value="home" ${side === 'home' ? 'selected' : ''}>${escapeHtml(state.home.name)}</option><option value="away" ${side === 'away' ? 'selected' : ''}>${escapeHtml(state.away.name)}</option></select></div><div class="field"><label>Atleta</label><input data-stats-player="name" list="stats-player-options" maxlength="80" value="${escapeHtml(state.statsPlayer?.name || '')}" placeholder="Digite ou escolha"><datalist id="stats-player-options">${players.map(player => `<option value="${escapeHtml(player.name)}">${escapeHtml(player.number ? `Camisa ${player.number}` : '')}</option>`).join('')}</datalist></div></div>
      <div class="field"><label>Observação (opcional)</label><input data-stats-player="note" maxlength="120" value="${escapeHtml(state.statsPlayer?.note || '')}" placeholder="Ex.: Artilheiro do campeonato"></div></section></div>`;
}

function renderModuleHub() {
  return `<section class="module-hub"><div class="module-hub-head"><span>Central de módulos</span><h1>Uma tela para cada operação</h1><p>Abra somente o que precisa durante a transmissão. Todos os módulos continuam sincronizados na mesma sala.</p></div><div class="module-hub-grid">${MANAGEMENT_MODULES.map(module => `<a href="${escapeHtml(moduleUrl(module.key))}" class="module-hub-card"><span>${module.icon}</span><div><strong>${escapeHtml(module.label)}</strong><small>${escapeHtml(module.caption)}</small></div><b>→</b></a>`).join('')}</div><div class="recommended-flow"><strong>Fluxo recomendado para o pré-jogo</strong><div><span><b>1</b> Times e elenco</span><span><b>2</b> Escalações e apresentação</span><span><b>3</b> Placar e eventos ao vivo</span></div></div></section>`;
}

// Grupos do menu do Super Administrador: separados por função (operar, cadastrar, publicar, comunicar, administrar).
const PLATFORM_MENU_GROUPS = [
  ['operation', 'Operação', ['live', 'championships', 'matches', 'standings']],
  ['registry', 'Cadastros', ['teams', 'delegations']],
  ['content', 'Conteúdo', ['arts', 'feed', 'sponsors', 'sponsor-bar', 'builder']],
  ['communication', 'Comunicação', ['announcements', 'audit']],
  ['administration', 'Administração', ['access', 'backup']],
];
const SIDEBAR_GROUPS_KEY = 'juventude.sidebar.groups.v1';
let sidebarSearch = '';
let sidebarGroupsOpen = (() => { try { return JSON.parse(localStorage.getItem(SIDEBAR_GROUPS_KEY)) || {}; } catch { return {}; } })();

function collapsibleGroup(id, label, allItems, hrefFor, activeKey, link) {
  const term = sidebarSearch.trim().toLowerCase();
  const items = term ? allItems.filter(item => `${item.label} ${item.caption}`.toLowerCase().includes(term)) : allItems;
  if (!items.length) return '';
  const hasActive = items.some(item => item.key === activeKey);
  const open = Boolean(term) || hasActive || sidebarGroupsOpen[id] !== false;
  return `<details class="module-sidebar-group" data-sidebar-group="${id}" ${open ? 'open' : ''}><summary><span>${label}</span><small>${items.length}</small></summary>${items.map(item => link(item, hrefFor(item))).join('')}</details>`;
}

function renderManagementSidebar(activeKey = 'overview') {
  const link = (item, href = moduleUrl(item.key)) => `<a class="${activeKey === item.key ? 'active' : ''}" href="${escapeHtml(href)}">${item.icon}<span>${escapeHtml(item.label)}</span></a>`;
  const byKey = keys => MANAGEMENT_MODULES.filter(item => keys.includes(item.key));
  const group = (label, items, hrefFor) => `<span class="module-sidebar-label module-sidebar-label-spaced">${label}</span>${items.map(item => link(item, hrefFor(item))).join('')}`;
  const footer = `<p class="app-version module-sidebar-version">${versionLabel()}</p>`;
  if (platformMode) {
    const platformHref = item => platformUrl(item.key);
    return `<aside class="module-sidebar" aria-label="Navegação da plataforma"><input type="search" class="module-sidebar-search" data-sidebar-search value="${escapeHtml(sidebarSearch)}" maxlength="40" placeholder="Buscar tela…  ( / )" aria-label="Buscar tela do menu" autocomplete="off"><a class="module-sidebar-overview ${activeKey === 'dashboard' ? 'active' : ''}" href="${escapeHtml(platformUrl('dashboard'))}">${icons.monitor}<span>Visão geral da plataforma</span></a>${PLATFORM_MENU_GROUPS.map(([id, label, keys]) => collapsibleGroup(id, label, byKey(keys.filter(key => !['access', 'backup'].includes(key) || adminSession.role === 'admin')), platformHref, activeKey, link)).join('')}${footer}</aside>`;
  }
  const matchTitle = `${escapeHtml(state.home.short)} × ${escapeHtml(state.away.short)}`;
  const groupLabels = { championships: 'Organização', scoreboard: 'Overlays', pregame: 'Partida', teams: 'Configuração' };
  const links = MANAGEMENT_MODULES.map(item => `${groupLabels[item.key] ? `<span class="module-sidebar-label ${item.key === 'scoreboard' ? '' : 'module-sidebar-label-spaced'}">${groupLabels[item.key]}</span>` : ''}${link(item)}`).join('');
  return `<aside class="module-sidebar" aria-label="Navegação dos overlays"><a class="module-sidebar-back" href="${escapeHtml(platformUrl('dashboard'))}">← Plataforma</a><div class="module-sidebar-match"><small>Partida selecionada</small><strong>${matchTitle}</strong><span>${escapeHtml(state.competition)}</span></div><a class="module-sidebar-overview ${activeKey === 'overview' ? 'active' : ''}" href="/?room=${encodeURIComponent(ROOM_ID)}">${icons.monitor}<span>Visão geral da partida</span></a>${links}<a class="module-sidebar-home ${activeKey === 'hub' ? 'active' : ''}" href="${escapeHtml(moduleUrl())}">${icons.layers}<span>Central de módulos</span></a>${footer}</aside>`;
}

function renderModuleApp() {
  const module = MANAGEMENT_MODULES.find(item => item.key === managementModule);
  const unread = operationsData.notifications.filter(item => !item.read).length;
  const isOperational = ['dashboard', 'championships', 'matches', 'delegations', 'audit', 'builder', 'access', 'announcements', 'live', 'backup', 'standings', 'feed', 'arts'].includes(module?.key);
  return `<div class="studio module-studio"><header class="topbar"><a class="brand" href="${platformMode ? escapeHtml(platformUrl('dashboard')) : `/?room=${encodeURIComponent(ROOM_ID)}`}">${brandMark()}<span class="brand-copy"><strong class="brand-name">Juventude</strong><span class="brand-caption">Esporte Clube</span></span></a><div class="top-actions">${platformMode ? (libraryMode ? '<span class="room-badge">Biblioteca · sem partida</span>' : '') : `<span class="room-badge">Sala · ${escapeHtml(ROOM_ID)}</span>`}<a class="button notification-button ${unread ? 'has-unread' : ''}" href="${escapeHtml(moduleUrl('audit'))}">${icons.list} Avisos${unread ? `<b>${unread}</b>` : ''}</a>${platformMode ? (libraryMode ? `<button class="button primary" data-action="open-obs">${icons.external} Saídas OBS</button>` : '') : `<a class="button" href="/?room=${encodeURIComponent(ROOM_ID)}">Visão geral da partida</a><button class="button primary" data-action="open-obs">${icons.external} Saídas OBS</button>`}<button class="button subtle" data-action="admin-logout">Sair</button></div></header><main class="module-workspace">${renderManagementSidebar(module?.key || 'hub')}<div class="module-main">${module ? `<header class="module-page-head"><div><span>${module.key === 'builder' ? 'Criação sem desenvolvimento' : ['championships','matches','delegations','audit','announcements','live','standings'].includes(module.key) ? 'Gestão da transmissão' : libraryMode ? 'Biblioteca da plataforma' : platformMode ? 'Plataforma' : `${escapeHtml(currentSport().label)} · módulo dedicado`}</span><h1>${escapeHtml(module.key === 'dashboard' && platformMode ? 'Visão geral da plataforma' : module.label)}</h1><p>${escapeHtml(module.caption)}</p></div>${platformMode ? '' : `<a class="button subtle" href="${escapeHtml(moduleUrl())}">Todos os módulos</a>`}</header>${adminSession.role === 'viewer' ? '<div class="library-banner"><div><strong>Acesso somente leitura</strong><p>Seu papel é Leitor: você pode consultar dados e prévias, mas alterações não são salvas.</p></div></div>' : ''}${isOperational ? `<section class="panel builder-panel">${renderModuleControls(module.key)}</section>` : `${libraryMode ? '' : renderSportSwitcher()}<div class="module-grid"><section class="panel module-controls">${renderModuleControls(module.key)}</section>${renderModuleMonitor(module)}</div>`}` : renderModuleHub()}</div></main></div>${drawer ? renderDrawer() : ''}`;
}

function renderMatchDashboard() {
  const overlayLayers = ['scoreboard', 'event', 'sponsor', 'sponsor-bar', 'photo-lineup', 'stats'];
  const overlaysOnAir = overlayLayers.filter(layer => moduleOnAir(layer)).length;
  const summary = reportSummaryEntries({ events: state.events || [] });
  const status = state.matchEndedAt ? 'Finalizada' : state.clock.running ? 'Ao vivo' : 'Em preparação';
  return `<section class="panel match-dashboard"><div class="section-header"><div><h3 class="section-title">Resumo da partida</h3><span class="section-kicker">${escapeHtml(status)}</span></div><a class="button subtle" href="${escapeHtml(moduleUrl('report'))}">Relatório completo</a></div>
    <div class="match-dashboard-head"><div>${badge(state.home)}<strong>${escapeHtml(state.home.short)}</strong></div><b>${state.home.score} × ${state.away.score}</b><div><strong>${escapeHtml(state.away.short)}</strong>${badge(state.away)}</div></div>
    <div class="dashboard-stats">${summary.map(([label, value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}<article><strong>${overlaysOnAir}/${overlayLayers.length}</strong><span>Overlays no ar</span></article></div>
  </section>`;
}

function renderApp() {
  const unread = operationsData.notifications.filter(item => !item.read).length;
  return `<div class="studio"><header class="topbar"><a class="brand" href="/?room=${encodeURIComponent(ROOM_ID)}">${brandMark()}<span class="brand-copy"><strong class="brand-name">Juventude</strong><span class="brand-caption">Esporte Clube</span></span></a><div class="top-actions"><div class="status-row sync-status" data-sync-status="${syncStatus}"><i class="live-dot"></i><span data-sync-label>${syncStatus === 'online' ? 'Sincronizado' : 'Conectando…'}</span><span class="status-time" data-clock>${clockText()}</span></div><a class="button notification-button ${unread ? 'has-unread' : ''}" href="${escapeHtml(moduleUrl('audit'))}">${icons.list} Avisos${unread ? `<b>${unread}</b>` : ''}</a><a class="button" href="${escapeHtml(moduleUrl())}">${icons.layers} Módulos</a><button class="button primary" data-action="open-obs">${icons.external} Saídas OBS</button><button class="button subtle" data-action="admin-logout">Sair</button></div></header>
    <main class="module-workspace dashboard-workspace">${renderManagementSidebar('overview')}<div class="workspace dashboard-main"><div class="page-head"><div><div class="eyebrow">Central de transmissão · ${escapeHtml(currentSport().label)}</div><h1 class="page-title">Controle da partida</h1><p class="page-caption">${escapeHtml(state.competition)} · ${escapeHtml(state.venue)}</p></div><div class="match-tools"><span class="room-badge">Sala · ${escapeHtml(ROOM_ID)}</span><button class="button subtle" data-action="undo" ${state._backup ? '' : 'disabled'}>↶ Desfazer</button><button class="button" data-action="new-match">Nova partida</button></div></div>${renderSportSwitcher()}${renderMatchDashboard()}
      <div class="workspace-grid"><div class="control-column">${renderControls()}${renderEvents()}</div><div class="preview-column">${renderMonitor()}${renderThemes()}</div></div>
    </div></main></div>${drawer ? renderDrawer() : ''}`;
}

function renderAuthWait(message) {
  return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>${escapeHtml(message)}</h1><p>Aguarde um instante.</p></section></main>`;
}

function teamIssues(team) {
  const athletes = Array.isArray(team?.athletes) ? team.athletes : [];
  const issues = [];
  const byNumber = new Map();
  for (const athlete of athletes) {
    const number = String(athlete?.number || '').trim();
    if (number) byNumber.set(number, [...(byNumber.get(number) || []), athlete.name || 'sem nome']);
  }
  for (const [number, names] of byNumber) if (names.length > 1) issues.push({ level: 'error', text: `Número ${number} repetido: ${names.join(', ')}.` });
  const withoutPhoto = athletes.filter(athlete => !athlete.photo);
  if (withoutPhoto.length) issues.push({ level: 'warn', text: `${withoutPhoto.length} atleta(s) sem foto.` });
  for (const athlete of athletes.filter(item => String(item.name || '').length > 26).slice(0, 3)) issues.push({ level: 'warn', text: `Nome longo: "${String(athlete.name).slice(0, 26)}…" será cortado no card (limite de 26 letras).` });
  if (!team?.logo) issues.push({ level: 'warn', text: 'Equipe sem escudo.' });
  const starters = athletes.filter(athlete => athlete.squadRole !== 'reserve').length;
  if (athletes.length && starters !== 11) issues.push({ level: 'warn', text: `${starters} titular(es) marcado(s); o esquema tático usa 11.` });
  return issues;
}

function deadlineInfo(deadline) {
  if (!deadline) return null;
  const days = Math.ceil((new Date(`${deadline}T23:59:59`).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return null;
  return { days, date: String(deadline).split('-').reverse().join('/'), level: days < 0 ? 'late' : days <= 2 ? 'soon' : 'ok', label: days < 0 ? `Prazo vencido há ${Math.abs(days)} dia(s)` : days === 0 ? 'O prazo termina hoje' : `Faltam ${days} dia(s)` };
}

function renderPortalChecks() {
  const info = deadlineInfo(teamPortalDeadline);
  const status = teamDelegation.status;
  const banners = [
    info && status !== 'approved' ? `<div class="portal-banner portal-banner-${info.level}"><strong>Prazo do cadastro: ${escapeHtml(info.date)}</strong><span>${escapeHtml(info.label)}</span></div>` : '',
    status === 'approved' ? '<div class="portal-banner portal-banner-ok"><strong>Cadastro aprovado pela organização</strong><span>Alterações novas voltam para revisão.</span></div>' : '',
    status === 'needs-review' && teamDelegation.reviewComment ? `<div class="portal-banner portal-banner-late"><strong>Devolvido pela organização</strong><span>${escapeHtml(teamDelegation.reviewComment)}</span></div>` : '',
  ].join('');
  const issues = teamIssues(teamPortalTeam);
  return `${banners}<section class="portal-checks"><div><strong>Verificações do cadastro</strong><small>Alertas antes de concluir a delegação.</small></div>${issues.length ? `<ul>${issues.map(issue => `<li class="portal-check-${issue.level}">${escapeHtml(issue.text)}</li>`).join('')}</ul>` : '<p class="portal-check-good">Tudo certo: sem números repetidos, fotos faltando ou nomes longos.</p>'}</section>`;
}

function renderTeamKit() {
  const team = teamPortalTeam;
  const sponsors = team.sponsors || [];
  return `<section class="portal-kit"><div class="section-header"><div><h3 class="section-title">Kit de mídia da equipe</h3><p class="help-text">Cor secundária e apoiadores da equipe.</p></div><button class="button subtle" data-action="portal-add-sponsor" ${sponsors.length >= 6 ? 'disabled' : ''}>+ Apoiador</button></div><label class="color-field"><span>Cor secundária</span><input type="color" data-portal-team-field="color2" value="${safeColor(team.color2, '#d8ad56')}"></label>${sponsors.map(sponsor => `<div class="portal-sponsor-row"><input data-portal-sponsor-name="${escapeHtml(sponsor.id)}" maxlength="60" value="${escapeHtml(sponsor.name)}" placeholder="Nome do apoiador"><button class="button square subtle" data-action="portal-remove-sponsor" data-value="${escapeHtml(sponsor.id)}" aria-label="Remover apoiador">${icons.close}</button></div>`).join('')}<div class="kit-preview" style="--kit-a:${safeColor(team.color)};--kit-b:${safeColor(team.color2, '#d8ad56')}"><span class="kit-shield">${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="">` : escapeHtml(team.short)}</span><b>${escapeHtml(team.short)}</b><span class="kit-name">${escapeHtml(team.name)}</span><span class="kit-score">0</span>${sponsors.filter(sponsor => sponsor.name).map(sponsor => `<em>${escapeHtml(sponsor.name)}</em>`).join('')}</div></section>`;
}

function renderPortalImport() {
  return `<details class="portal-import"><summary>Importar elenco por planilha e fotos em lote</summary><p class="help-text">Uma linha por atleta: <code>número;nome;posição;altura;titular ou reserva</code> (posição, altura e função são opcionais). Números que já existem são atualizados.</p><textarea id="portal-csv" rows="6" placeholder="10;Leonardo Lima;MEI;1,78;titular"></textarea><div class="inline-actions"><button class="button subtle" data-action="portal-import-csv">Importar elenco</button><label class="button subtle portal-file-button">Abrir arquivo CSV<input type="file" data-portal-csv-file accept=".csv,text/csv,text/plain"></label><label class="button subtle portal-file-button">Fotos em lote<input type="file" multiple data-portal-batch-photos accept="image/png,image/jpeg,image/webp"></label></div><small class="help-text">Nas fotos em lote, o nome do arquivo deve conter o número da camisa (ex.: 10.jpg). Até 5 MB cada; prefira menos de 1,5 MB.</small></details>`;
}

// Planilha de times e atletas (CSV com ; , ou tab): Equipe;Sigla;Cor;Número;Atleta;Posição;Altura;Função
function parseTeamsSpreadsheet(text) {
  const rows = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (rows.length && /^(equipe|time)\b/i.test(rows[0])) rows.shift();
  const teams = new Map();
  for (const row of rows) {
    const delimiter = row.includes(';') ? ';' : row.includes('\t') ? '\t' : ',';
    const cells = row.split(delimiter).map(cell => cell.trim().replace(/^"|"$/g, ''));
    const [name = '', short = '', color = '', number = '', athlete = '', position = '', height = '', role = ''] = cells;
    if (!name) continue;
    const key = name.toLocaleLowerCase('pt-BR');
    if (!teams.has(key)) teams.set(key, { name: name.slice(0, 80), short: short.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3), color: /^#[0-9a-f]{6}$/i.test(color) ? color : '', athletes: [] });
    const team = teams.get(key);
    if (short && !team.short) team.short = short.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
    if (/^#[0-9a-f]{6}$/i.test(color) && !team.color) team.color = color;
    const digits = number.replace(/\D/g, '').slice(0, 3);
    if (athlete && digits) team.athletes.push({ number: digits, name: athlete.slice(0, 100), position: position.toUpperCase().replace(/[^A-ZÀ-Ü0-9-]/g, '').slice(0, 6), height: height.replace(',', '.').replace(/[^0-9.]/g, '').slice(0, 5), squadRole: /reserva/i.test(role) ? 'reserve' : 'starter' });
  }
  return [...teams.values()].slice(0, 64);
}

function importRosterCsv(text) {
  const rows = String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  if (rows.length && /^n[uú]mero|^n[º°o]\b/i.test(rows[0])) rows.shift();
  let added = 0;
  let updated = 0;
  for (const [index, row] of rows.entries()) {
    const delimiter = row.includes(';') ? ';' : row.includes('\t') ? '\t' : ',';
    const [rawNumber = '', rawName = '', rawPosition = '', rawHeight = '', rawRole = ''] = row.split(delimiter).map(cell => cell.trim());
    const number = rawNumber.replace(/\D/g, '').slice(0, 3);
    if (!number || !rawName) continue;
    const fields = { name: rawName.slice(0, 100), number, position: rawPosition.toUpperCase().replace(/[^A-ZÀ-Ü0-9-]/g, '').slice(0, 6), height: rawHeight.replace(',', '.').replace(/[^0-9.]/g, '').slice(0, 5) };
    const existing = teamPortalTeam.athletes.find(athlete => String(athlete.number).trim() === number);
    if (existing) { Object.assign(existing, fields); if (rawRole) existing.squadRole = /reserva/i.test(rawRole) ? 'reserve' : 'starter'; updated += 1; continue; }
    if (teamPortalTeam.athletes.length >= 100) break;
    const role = rawRole ? (/reserva/i.test(rawRole) ? 'reserve' : 'starter') : (teamPortalTeam.athletes.length < 11 ? 'starter' : 'reserve');
    teamPortalTeam.athletes.push({ id: `atleta-${Date.now().toString(36)}${index}`, photo: '', squadRole: role, ...fields });
    added += 1;
  }
  return { added, updated };
}

async function importBatchPhotos(files) {
  if (!teamPortalTeam) return;
  await saveTeamPortal();
  let sent = 0;
  let heavy = 0;
  const failed = [];
  for (const file of files) {
    const number = (file.name.match(/\d+/) || [''])[0];
    const athlete = number ? teamPortalTeam.athletes.find(item => String(item.number).trim() === number) : null;
    if (!athlete || file.size > 5_000_000) { failed.push(file.name); continue; }
    if (file.size > 1_500_000) heavy += 1;
    try {
      const response = await fetch(`/api/team-athlete-photo?team=${encodeURIComponent(teamSession.teamId)}&athlete=${encodeURIComponent(athlete.id)}`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file });
      if (!response.ok) throw new Error();
      const result = await response.json();
      athlete.photo = `${result.url}${String(result.url).includes('?') ? '&' : '?'}v=${Date.now()}`;
      sent += 1;
    } catch { failed.push(file.name); }
  }
  teamPortalStatus = 'ready';
  render();
  await saveTeamPortal();
  toast(`${sent} foto(s) enviada(s)${heavy ? `; ${heavy} acima de 1,5 MB` : ''}${failed.length ? `; sem correspondência ou falha: ${failed.slice(0, 3).join(', ')}` : ''}.`);
}

const DELEGATION_LABELS = { draft: 'Em preenchimento', completed: 'Aguardando revisão', 'needs-review': 'Devolvida ou alterada', approved: 'Aprovada' };

function teamNextDeadline(teamId) {
  return operationsData.matches.filter(match => (match.homeTeamId === teamId || match.awayTeamId === teamId) && match.registrationDeadline && !['finished', 'cancelled'].includes(match.status)).map(match => match.registrationDeadline).sort()[0] || '';
}

function delegationRows() {
  return teamCatalog.map(team => {
    const status = operationsData.delegationStatus[team.id]?.status || 'draft';
    const check = delegationCompletion(team);
    const deadline = deadlineInfo(teamNextDeadline(team.id));
    return { team, status, check, deadline, percent: Math.round(((7 - check.missing.length) / 7) * 100), late: Boolean(deadline && deadline.days < 0 && !['completed', 'approved'].includes(status)) };
  });
}

function renderDelegationsModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const rows = delegationRows();
  const count = predicate => rows.filter(predicate).length;
  const tiles = [[rows.length, 'Equipes'], [count(row => row.status === 'approved'), 'Aprovadas'], [count(row => row.status === 'completed'), 'Aguardando revisão'], [count(row => row.late), 'Prazo vencido']];
  const cards = rows.map(({ team, status, check, deadline, percent, late }) => {
    const id = escapeHtml(team.id);
    const review = operationsData.delegationStatus[team.id] || {};
    const issues = teamIssues(team);
    const history = (operationsData.teamHistory[team.id] || []).slice(0, 5);
    return `<article class="delegation-row ${late ? 'is-late' : ''}"><div class="delegation-row-head"><div><strong>${escapeHtml(team.name)}</strong><small>${escapeHtml(DELEGATION_LABELS[status] || status)}${review.reviewedBy ? ` · por ${escapeHtml(review.reviewedBy)}` : ''}</small></div>${deadline ? `<span class="delegation-deadline delegation-deadline-${deadline.level}">${escapeHtml(deadline.date)} · ${escapeHtml(deadline.label)}</span>` : ''}</div>
      <div class="delegation-progress" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><i style="width:${percent}%"></i><span>${percent}%</span></div>
      ${check.missing.length ? `<p class="help-text">Falta: ${escapeHtml(check.missing.join(', '))}.</p>` : ''}
      ${issues.length ? `<ul class="delegation-issues">${issues.map(issue => `<li class="portal-check-${issue.level}">${escapeHtml(issue.text)}</li>`).join('')}</ul>` : ''}
      ${review.reviewComment && status === 'needs-review' ? `<p class="help-text">Motivo da devolução: ${escapeHtml(review.reviewComment)}</p>` : ''}
      <div class="delegation-actions"><button class="button subtle" data-action="delegation-remind" data-value="${id}">Cobrar equipe</button>${status === 'completed' ? `<button class="button primary" data-action="delegation-approve" data-value="${id}">Aprovar</button>` : ''}<input id="delegation-comment-${id}" maxlength="300" placeholder="Motivo para devolver ao time"><button class="button subtle" data-action="delegation-return" data-value="${id}">Devolver</button></div>
      <details class="delegation-history"><summary>Histórico de versões (${(operationsData.teamHistory[team.id] || []).length})</summary>${history.map(version => `<div class="dashboard-mini-row"><span>${escapeHtml(operationDate(version.at, true))} · ${escapeHtml(version.actor)} · ${escapeHtml(version.summary)}</span><button class="button subtle" data-action="restore-team-version" data-value="${id}|${escapeHtml(version.id)}">Restaurar</button></div>`).join('') || '<div class="portal-empty">Sem versões registradas ainda.</div>'}</details></article>`;
  }).join('') || '<div class="portal-empty">Nenhuma equipe cadastrada.</div>';
  return `<div class="module-section"><div class="dashboard-stats">${tiles.map(([value, label]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}</div><div class="delegation-list">${cards}</div><p class="help-text">O prazo vem do campo "Prazo do cadastro das equipes" de cada partida. Os alertas aparecem aqui e no portal da equipe; não há envio automático de e-mail ou mensagem.</p></div>`;
}

const MATCH_STATUS_LABELS = { scheduled: 'Agendada', live: 'Ao vivo', finished: 'Finalizada', cancelled: 'Cancelada' };

function portalStatusLabel() {
  return teamPortalStatus === 'saving' ? 'Salvando…' : teamPortalStatus === 'saved' ? 'Dados salvos' : teamPortalStatus === 'error' ? 'Erro ao salvar' : 'Alterações salvas manualmente';
}

function portalMatchSquad() {
  if (!teamPortalTeam || !teamPortalMatchId) return null;
  teamPortalTeam.matchSquads ||= {};
  return teamPortalTeam.matchSquads[teamPortalMatchId] ||= { starters: [], reserves: [], formation: '', updatedAt: 0 };
}

function pruneChampionshipSquads(championshipId, registration) {
  const allowed = new Set(registration.athleteIds);
  for (const match of teamPortalContext.matches.filter(item => item.championshipId === championshipId)) {
    const squad = teamPortalTeam.matchSquads?.[match.id];
    if (!squad) continue;
    squad.starters = squad.starters.filter(id => allowed.has(id));
    squad.reserves = squad.reserves.filter(id => allowed.has(id));
  }
}

const PORTAL_SECTIONS = [
  ['home', 'Início', 'Resumo do cadastro, prazos e próximos jogos'],
  ['announcements', 'Comunicados', 'Recados da organização para a sua equipe'],
  ['championships', 'Campeonatos', 'Escolha o campeonato, inscreva o elenco e defina a escalação de cada jogo'],
  ['calendar', 'Calendário', 'Jogos e prazos da equipe, com exportação para o celular'],
  ['squad', 'Elenco', 'Nome, número, altura, função, posição e foto dos atletas'],
  ['staff', 'Comissão técnica', 'Treinador e demais membros da comissão'],
  ['identity', 'Identidade', 'Escudo, cores e apoiadores usados nos overlays'],
  ['account', 'Conta e dados', 'Sessão, exportação e segurança'],
];

function downloadTextFile(name, type, text) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const link = document.createElement('a');
  link.href = url; link.download = name;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function portalRosterCsv() {
  const cell = value => `"${String(value ?? '').replace(/"/g, '""')}"`;
  const rows = [['Número', 'Nome', 'Posição', 'Altura (m)', 'Função']];
  for (const athlete of teamPortalTeam?.athletes || []) rows.push([athlete.number, athlete.name, athlete.position, athlete.height, athlete.squadRole === 'reserve' ? 'Reserva' : 'Titular']);
  return `\uFEFF${rows.map(row => row.map(cell).join(';')).join('\r\n')}`;
}

function portalUpcomingMatches() {
  return (teamPortalContext.matches || []).filter(match => !['finished', 'cancelled'].includes(match.status)).sort((a, b) => String(a.kickoffAt || '9').localeCompare(String(b.kickoffAt || '9')));
}

function portalOpponent(match) {
  return match.homeTeamId === teamPortalTeam.id ? match.awayName : match.homeName;
}

function portalCalendarIcs() {
  const stamp = value => String(value || '').replace(/[-:]/g, '').slice(0, 13).padEnd(13, '0') + '00';
  const escapeIcs = value => String(value || '').replace(/[\\,;]/g, char => `\\${char}`).replace(/\n/g, ' ');
  const events = (teamPortalContext.matches || []).filter(match => match.kickoffAt).map(match => {
    const end = new Date(new Date(match.kickoffAt).getTime() + 2 * 3600e3);
    const endLocal = `${end.getFullYear()}${String(end.getMonth() + 1).padStart(2, '0')}${String(end.getDate()).padStart(2, '0')}T${String(end.getHours()).padStart(2, '0')}${String(end.getMinutes()).padStart(2, '0')}00`;
    return ['BEGIN:VEVENT', `UID:${match.id}@juventude-overlay`, `DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').slice(0, 15)}Z`, `DTSTART:${stamp(match.kickoffAt)}`, `DTEND:${endLocal}`, `SUMMARY:${escapeIcs(`${match.homeName} × ${match.awayName}`)}`, `LOCATION:${escapeIcs(match.venue)}`, `DESCRIPTION:${escapeIcs(match.round || '')}`, 'END:VEVENT'].join('\r\n');
  });
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Juventude Overlay Studio//PT-BR', ...events, 'END:VCALENDAR'].join('\r\n');
}

function portalAnnouncements() {
  return [...(teamPortalContext.announcements || [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function portalReadKey() { return `juventude.portal.read.${teamPortalTeam?.id || 'time'}`; }

function portalReadAnnouncements() {
  try { return new Set(JSON.parse(localStorage.getItem(portalReadKey())) || []); } catch { return new Set(); }
}

function markAnnouncementsRead() {
  const read = portalReadAnnouncements();
  const pending = portalAnnouncements().filter(item => !read.has(item.id));
  if (!pending.length) return;
  pending.forEach(item => read.add(item.id));
  try { localStorage.setItem(portalReadKey(), JSON.stringify([...read])); } catch {}
}

function renderPortalAnnouncements() {
  const list = portalAnnouncements();
  if (!list.length) return '<div class="portal-empty">Nenhum comunicado da organização por enquanto.</div>';
  return list.map(item => `<article class="portal-panel portal-announcement ${item.pinned ? 'is-pinned' : ''}"><header><strong>${item.pinned ? '📌 ' : ''}${escapeHtml(item.title)}</strong><small>${escapeHtml(operationDate(item.createdAt, true))}</small></header><p>${escapeHtml(item.body).replace(/\n/g, '<br>')}</p></article>`).join('');
}

function renderPortalSidebar(activeKey) {
  const issues = teamIssues(teamPortalTeam).filter(issue => issue.level === 'error').length;
  const unreadAnnouncements = portalAnnouncements().filter(item => !portalReadAnnouncements().has(item.id)).length;
  const badge = { home: issues || '', announcements: unreadAnnouncements || '', championships: (teamPortalContext.matches || []).length || '', squad: (teamPortalTeam.athletes || []).length || '', staff: normalizedStaff(teamPortalTeam).length || '' };
  return `<nav class="portal-sidebar" aria-label="Seções do portal">${PORTAL_SECTIONS.map(([key, label]) => `<button class="${activeKey === key ? 'active' : ''}" data-action="portal-tab" data-value="${key}" ${activeKey === key ? 'aria-current="page"' : ''}><span>${escapeHtml(label)}</span>${badge[key] ? `<b class="${key === 'home' || key === 'announcements' ? 'is-alert' : ''}">${badge[key]}</b>` : ''}</button>`).join('')}</nav>`;
}

function portalShell(sectionKey, content) {
  const team = teamPortalTeam;
  const section = PORTAL_SECTIONS.find(([key]) => key === sectionKey) || PORTAL_SECTIONS[0];
  return `<main class="team-portal-shell"><section class="team-portal-card portal-app"><header class="team-portal-head"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><div style="display:flex;align-items:center;gap:10px"><span class="portal-status portal-status-${escapeHtml(teamPortalStatus)}">${portalStatusLabel()}</span><button class="button square subtle" data-action="team-logout" aria-label="Sair">${icons.close}</button></div></header><div class="team-portal-team"><div class="portal-team-logo">${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="Escudo de ${escapeHtml(team.name)}">` : escapeHtml(team.short)}</div><div><span>${escapeHtml(section[1])}</span><h1>${escapeHtml(team.name)}</h1><p>${escapeHtml(section[2])}</p></div></div><div class="portal-layout">${renderPortalSidebar(sectionKey)}<div class="portal-content">${content}</div></div></section></main>`;
}

function renderPortalHome() {
  const team = teamPortalTeam;
  const upcoming = portalUpcomingMatches();
  const info = deadlineInfo(teamPortalDeadline);
  const status = teamDelegation.status || 'draft';
  const tiles = [[(team.athletes || []).length, 'Atletas'], [normalizedStaff(team).length, 'Comissão'], [upcoming.length, 'Próximos jogos'], [info ? info.date : '—', 'Prazo do cadastro'], [DELEGATION_LABELS[status] || status, 'Situação']];
  const rows = upcoming.slice(0, 4).map(match => {
    const done = Boolean(team.matchSquads?.[match.id]?.starters?.length);
    return `<article class="portal-next-match"><div><strong>${match.homeTeamId === team.id ? 'vs' : '@'} ${escapeHtml(portalOpponent(match))}</strong><small>${escapeHtml(operationDate(match.kickoffAt, true))}${match.venue ? ` · ${escapeHtml(match.venue)}` : ''}${match.round ? ` · ${escapeHtml(match.round)}` : ''}</small></div><span class="portal-chip ${done ? 'is-ok' : 'is-warn'}">${done ? 'Escalação definida' : 'Escalação pendente'}</span><button class="button subtle" data-action="portal-open-match" data-value="${escapeHtml(match.championshipId)}|${escapeHtml(match.id)}">${done ? 'Ver' : 'Definir'}</button></article>`;
  }).join('') || '<div class="portal-empty">Nenhum jogo agendado para a sua equipe.</div>';
  return `${renderPortalChecks()}<div class="dashboard-stats portal-home-stats">${tiles.map(([value, label]) => `<article class="${String(value).length > 9 ? 'is-text' : ''}"><strong>${escapeHtml(String(value))}</strong><span>${label}</span></article>`).join('')}</div>
    <section class="portal-panel"><div class="section-header"><div><h3 class="section-title">Próximos jogos</h3><p class="help-text">Defina titulares e reservas de cada partida.</p></div><button class="button subtle" data-action="portal-tab" data-value="calendar">Ver calendário</button></div><div class="portal-next-list">${rows}</div></section>
${portalAnnouncements().length ? `<section class="portal-panel"><div class="section-header"><div><h3 class="section-title">Último comunicado</h3></div><button class="button subtle" data-action="portal-tab" data-value="announcements">Ver todos</button></div><div class="portal-announcement"><header><strong>${escapeHtml(portalAnnouncements()[0].title)}</strong><small>${escapeHtml(operationDate(portalAnnouncements()[0].createdAt, true))}</small></header><p>${escapeHtml(portalAnnouncements()[0].body).slice(0, 220)}</p></div></section>` : ''}
    <section class="portal-panel"><div class="section-header"><div><h3 class="section-title">Atalhos</h3></div></div><div class="portal-shortcuts"><button class="button" data-action="portal-tab" data-value="squad">+ Atletas e fotos</button><button class="button" data-action="portal-tab" data-value="championships">Inscrição em campeonatos</button><button class="button" data-action="portal-tab" data-value="identity">Escudo e apoiadores</button><button class="button" data-action="portal-export-csv">Baixar elenco (CSV)</button></div></section>`;
}

function renderPortalCalendar() {
  const matches = [...(teamPortalContext.matches || [])].sort((a, b) => String(a.kickoffAt || '9').localeCompare(String(b.kickoffAt || '9')));
  if (!matches.length) return '<div class="portal-empty">Nenhum jogo agendado para a sua equipe.</div>';
  const statusLabel = { scheduled: 'Agendada', live: 'Ao vivo', finished: 'Finalizada', cancelled: 'Cancelada' };
  const groups = new Map();
  for (const match of matches) {
    const date = match.kickoffAt ? new Date(match.kickoffAt) : null;
    const monthName = date && !Number.isNaN(date.getTime()) ? new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(date) : 'Sem data definida';
    const month = monthName.charAt(0).toUpperCase() + monthName.slice(1);
    groups.set(month, [...(groups.get(month) || []), match]);
  }
  const team = teamPortalTeam;
  return `<div class="inline-actions"><button class="button primary" data-action="portal-export-ics">Adicionar ao calendário do celular (.ics)</button></div>${[...groups].map(([month, items]) => `<section class="portal-panel"><h3 class="section-title portal-month">${escapeHtml(month)}</h3><div class="portal-next-list">${items.map(match => {
    const deadline = deadlineInfo(match.registrationDeadline);
    const done = Boolean(team.matchSquads?.[match.id]?.starters?.length);
    return `<article class="portal-next-match"><div><strong>${escapeHtml(match.homeName)} × ${escapeHtml(match.awayName)}</strong><small>${escapeHtml(operationDate(match.kickoffAt, true))}${match.venue ? ` · ${escapeHtml(match.venue)}` : ''}${deadline ? ` · cadastro até ${escapeHtml(deadline.date)}` : ''}</small></div><span class="portal-chip ${match.status === 'live' ? 'is-live' : match.status === 'finished' ? 'is-done' : done ? 'is-ok' : 'is-warn'}">${escapeHtml(statusLabel[match.status] || match.status)}${match.status === 'scheduled' ? (done ? ' · escalada' : ' · sem escalação') : ''}</span><button class="button subtle" data-action="portal-open-match" data-value="${escapeHtml(match.championshipId)}|${escapeHtml(match.id)}">Abrir</button></article>`;
  }).join('')}</div></section>`).join('')}`;
}

function renderPortalAccount() {
  return `<section class="portal-panel"><div class="section-header"><div><h3 class="section-title">Sessão</h3><p class="help-text">Conectado como responsável pela equipe <strong>${escapeHtml(teamSession.teamName || teamPortalTeam.name)}</strong>.</p></div><button class="button" data-action="team-logout">Sair do portal</button></div></section>
    <section class="portal-panel"><div class="section-header"><div><h3 class="section-title">Exportar dados</h3><p class="help-text">Cópias para conferência e arquivo da equipe.</p></div></div><div class="portal-shortcuts"><button class="button" data-action="portal-export-csv">Elenco (CSV)</button><button class="button" data-action="portal-export-json">Dados completos da equipe (JSON)</button><button class="button" data-action="portal-export-ics">Calendário de jogos (.ics)</button></div></section>
    <section class="portal-panel"><div class="section-header"><div><h3 class="section-title">Senha e acessos</h3><p class="help-text">Para trocar a senha ou incluir outro responsável, use "Esqueci a senha" na tela de acesso ou fale com a organização; ela cria e redefine os usuários da equipe.</p></div></div></section>`;
}

function portalRegistration(championshipId) {
  return teamPortalTeam.registrations?.[championshipId] || { athleteIds: [], numbers: {}, formation: '' };
}

function slotLabel(point) {
  const x = point?.[0] ?? 50;
  return x <= 12 ? 'Goleiro' : x <= 35 ? 'Defesa' : x <= 68 ? 'Meio-campo' : 'Ataque';
}

function renderPortalSquadEditor(match, registration) {
  const team = teamPortalTeam;
  const squad = team.matchSquads?.[match.id] || { starters: [], reserves: [], formation: '' };
  const formation = FORMATIONS[squad.formation] ? squad.formation : FORMATIONS[registration.formation] ? registration.formation : team.formation || '4-3-3';
  const locked = ['live', 'finished', 'cancelled'].includes(match.status);
  const registered = team.athletes.filter(athlete => registration.athleteIds.includes(athlete.id));
  const roleOf = id => squad.starters.includes(id) ? 'starter' : squad.reserves.includes(id) ? 'reserve' : 'out';
  const numberOf = athlete => registration.numbers?.[athlete.id] || athlete.number || '—';
  const roleButton = (athlete, role, label) => `<button type="button" class="portal-role ${roleOf(athlete.id) === role ? 'active portal-role-' + role : ''}" data-action="portal-squad-role" data-value="${escapeHtml(athlete.id)}|${role}" ${locked ? 'disabled' : ''}>${label}</button>`;
  const points = FORMATIONS[formation] || [];
  const starterRows = squad.starters.map((id, index) => {
    const athlete = team.athletes.find(item => item.id === id);
    if (!athlete) return '';
    return `<div class="portal-slot"><span>${index + 1}º · ${escapeHtml(slotLabel(points[index]))}</span><strong>${escapeHtml(numberOf(athlete))} · ${escapeHtml(athlete.name || 'Atleta')}</strong><div><button class="button square subtle" data-action="portal-squad-move" data-value="${escapeHtml(id)}|up" ${locked || index === 0 ? 'disabled' : ''} aria-label="Subir">↑</button><button class="button square subtle" data-action="portal-squad-move" data-value="${escapeHtml(id)}|down" ${locked || index === squad.starters.length - 1 ? 'disabled' : ''} aria-label="Descer">↓</button></div></div>`;
  }).join('');
  const warnings = [];
  if (squad.starters.length !== 11) warnings.push(`${squad.starters.length} titular(es) definido(s); o esquema usa 11.`);
  if (!squad.reserves.length) warnings.push('Nenhum reserva definido.');
  return `<section class="portal-squad"><div class="section-header"><div><h3 class="section-title">Escalação · ${escapeHtml(match.homeName)} × ${escapeHtml(match.awayName)}</h3><p class="help-text">${escapeHtml(operationDate(match.kickoffAt, true))} · ${escapeHtml(match.venue || 'Local não informado')}. Só aparecem os atletas inscritos neste campeonato.</p></div><button class="button subtle" data-action="portal-close-match">Fechar</button></div>
    ${locked ? `<div class="portal-banner portal-banner-late"><strong>Escalação bloqueada</strong><span>Partida ${escapeHtml((MATCH_STATUS_LABELS[match.status] || match.status).toLowerCase())}: não é possível alterar.</span></div>` : ''}
    <div class="field"><label>Esquema tático nesta partida</label><select data-squad-match-formation ${locked ? 'disabled' : ''}><option value="">Padrão do campeonato (${escapeHtml(FORMATIONS[registration.formation] ? registration.formation : team.formation || '4-3-3')})</option>${Object.keys(FORMATIONS).map(value => `<option value="${value}" ${squad.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
    <div class="portal-squad-list">${registered.map(athlete => `<div class="portal-squad-row"><strong>${escapeHtml(numberOf(athlete))} · ${escapeHtml(athlete.name || 'Atleta')}<small>${escapeHtml(athlete.position || '')}</small></strong><div class="portal-roles">${roleButton(athlete, 'starter', 'Titular')}${roleButton(athlete, 'reserve', 'Reserva')}${roleButton(athlete, 'out', 'Fora')}</div></div>`).join('')}</div>
    <div class="portal-slots"><strong>Ordem no esquema ${escapeHtml(formation)}</strong><small class="help-text">A ordem define a posição de cada titular no campo tático (1º é o goleiro).</small>${starterRows || '<div class="portal-empty">Escolha os titulares acima.</div>'}</div>
    ${warnings.length ? `<ul class="portal-checks-list">${warnings.map(text => `<li class="portal-check-warn">${escapeHtml(text)}</li>`).join('')}</ul>` : '<p class="portal-check-good">Escalação completa: 11 titulares e reservas definidos.</p>'}
    <div class="inline-actions"><button class="button primary" data-action="portal-save-squad" ${locked ? 'disabled' : ''}>Salvar escalação</button><span class="help-text">${squad.updatedAt ? `Última alteração: ${escapeHtml(operationDate(squad.updatedAt, true))}` : 'Ainda não enviada.'}</span></div></section>`;
}

function renderPortalChampionships() {
  const team = teamPortalTeam;
  const championships = teamPortalContext.championships || [];
  const matches = teamPortalContext.matches || [];
  const selected = championships.find(item => item.id === teamPortalChampionshipId) || championships.find(item => matches.some(match => match.championshipId === item.id)) || championships[0] || null;
  if (selected) teamPortalChampionshipId = selected.id;
  const registration = selected ? portalRegistration(selected.id) : null;
  const championshipMatches = selected ? matches.filter(match => match.championshipId === selected.id).sort((a, b) => String(a.kickoffAt || '').localeCompare(String(b.kickoffAt || ''))) : [];
  const openMatch = championshipMatches.find(match => match.id === teamPortalMatchId) || null;
  const cards = championships.map(item => `<button class="portal-champ-card ${selected?.id === item.id ? 'active' : ''}" data-action="portal-select-championship" data-value="${escapeHtml(item.id)}"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.season || 'Temporada não informada')}</small><span>${matches.filter(match => match.championshipId === item.id).length} partida(s) · ${portalRegistration(item.id).athleteIds.length} inscrito(s)</span></button>`).join('') || '<div class="portal-empty">Nenhum campeonato cadastrado pela organização ainda.</div>';
  let body = '';
  if (selected) {
    const byNumber = new Map();
    for (const athlete of team.athletes.filter(item => registration.athleteIds.includes(item.id))) {
      const number = registration.numbers?.[athlete.id] || athlete.number;
      if (number) byNumber.set(number, [...(byNumber.get(number) || []), athlete.name || 'sem nome']);
    }
    const duplicates = [...byNumber].filter(([, names]) => names.length > 1);
    const athleteRows = team.athletes.map(athlete => `<div class="portal-reg-row"><label><input type="checkbox" data-reg-athlete="${escapeHtml(athlete.id)}" ${registration.athleteIds.includes(athlete.id) ? 'checked' : ''}> <strong>${escapeHtml(athlete.name || 'Atleta sem nome')}</strong><small>${escapeHtml(athlete.position || '')}</small></label><label class="portal-reg-number">Nº<input data-reg-number="${escapeHtml(athlete.id)}" inputmode="numeric" maxlength="3" value="${escapeHtml(registration.numbers?.[athlete.id] || '')}" placeholder="${escapeHtml(athlete.number || '—')}" ${registration.athleteIds.includes(athlete.id) ? '' : 'disabled'}></label></div>`).join('') || '<div class="portal-empty">Cadastre atletas na aba Cadastro da equipe primeiro.</div>';
    const matchCards = championshipMatches.map(match => {
      const opponent = match.homeTeamId === team.id ? match.awayName : match.homeName;
      const squad = team.matchSquads?.[match.id];
      const locked = ['live', 'finished', 'cancelled'].includes(match.status);
      const deadline = deadlineInfo(match.registrationDeadline);
      return `<article class="portal-match ${openMatch?.id === match.id ? 'active' : ''}"><div><strong>${match.homeTeamId === team.id ? 'vs' : '@'} ${escapeHtml(opponent)}</strong><small>${escapeHtml(operationDate(match.kickoffAt, true))} · ${escapeHtml(match.venue || 'Local não informado')}${match.round ? ` · ${escapeHtml(match.round)}` : ''}</small><span class="portal-match-status">${escapeHtml(MATCH_STATUS_LABELS[match.status] || match.status)}${deadline ? ` · escalação até ${escapeHtml(deadline.date)} (${escapeHtml(deadline.label.toLowerCase())})` : ''}</span></div><div class="portal-match-actions"><span class="${squad?.starters?.length ? 'portal-check-good' : 'portal-check-warn'}">${squad?.starters?.length ? `${squad.starters.length} titulares · ${squad.reserves.length} reservas` : 'Sem escalação'}</span><button class="button ${locked ? 'subtle' : 'primary'}" data-action="portal-open-match" data-value="${escapeHtml(match.id)}" ${registration.athleteIds.length ? '' : 'disabled'}>${locked ? 'Ver escalação' : 'Definir escalação'}</button></div></article>`;
    }).join('') || '<div class="portal-empty">Nenhuma partida da sua equipe neste campeonato ainda.</div>';
    body = `<section class="portal-registration"><div class="section-header"><div><h3 class="section-title">Inscrição da equipe · ${escapeHtml(selected.name)}</h3><p class="help-text">Marque os atletas inscritos neste campeonato e, se a camisa for diferente, informe o número. Só eles podem ser escalados nas partidas.</p></div><div class="inline-actions"><button class="button subtle" data-action="portal-reg-all">Inscrever todos</button><button class="button subtle" data-action="portal-reg-none">Limpar</button></div></div>
      <div class="field"><label>Esquema tático padrão no campeonato</label><select data-reg-formation><option value="">Padrão da equipe (${escapeHtml(team.formation || '4-3-3')})</option>${Object.keys(FORMATIONS).map(value => `<option value="${value}" ${registration.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></div>
      <div class="portal-reg-list">${athleteRows}</div>
      ${duplicates.length ? `<ul class="portal-checks-list">${duplicates.map(([number, names]) => `<li class="portal-check-error">Número ${escapeHtml(number)} repetido: ${escapeHtml(names.join(', '))}.</li>`).join('')}</ul>` : ''}
      <div class="inline-actions"><button class="button primary" data-action="portal-save-registration">Salvar inscrição</button><span class="help-text">${registration.athleteIds.length} atleta(s) inscrito(s).</span></div></section>
      <section class="portal-matches"><div class="section-header"><div><h3 class="section-title">Partidas do campeonato</h3><p class="help-text">Escolha uma partida para definir titulares e reservas entre os inscritos.</p></div></div>${matchCards}</section>${openMatch ? renderPortalSquadEditor(openMatch, registration) : ''}`;
  }
  return `<div class="portal-champ-grid">${cards}</div>${body}`;
}

function renderTeamAuthGate() {
  if (teamSession.status === 'checking') return renderAuthWait('Verificando sessão…');
  const options = teamLoginTeams.map(team => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
  return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state auth-card"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>Acesso da equipe</h1><p>Selecione a equipe e informe o usuário e a senha cadastrados pela organização.</p>
    <div class="auth-form"><div class="field"><label for="team-select">Equipe</label><select id="team-select">${options || '<option value="">Nenhuma equipe cadastrada</option>'}</select></div><div class="field"><label for="team-username">Usuário</label><input id="team-username" autocomplete="username" maxlength="40"></div><div class="field"><label for="team-password">Senha</label><input id="team-password" type="password" autocomplete="current-password" maxlength="200"></div>${teamSession.error ? `<p class="auth-error">${escapeHtml(teamSession.error)}</p>` : ''}<button class="button primary" data-action="team-login-submit" style="width:100%">Entrar</button><button class="button subtle" data-action="team-reset-request" style="width:100%">Esqueci minha senha</button></div><p class="app-version">${versionLabel()}</p></section></main>`;
}

function renderAdminAuthGate() {
  if (adminSession.status === 'checking') return renderAuthWait('Verificando sessão…');
  const isSetup = adminSession.status === 'setup';
  return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state auth-card"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>${isSetup ? 'Criar administrador' : 'Entrar no painel'}</h1><p>${isSetup ? 'Defina o primeiro usuário e senha do painel administrativo.' : 'Informe seu usuário e senha para acessar o painel.'}</p>
    <div class="auth-form"><div class="field"><label for="admin-username">Usuário</label><input id="admin-username" autocomplete="username" maxlength="40"></div><div class="field"><label for="admin-password">Senha</label><input id="admin-password" type="password" autocomplete="${isSetup ? 'new-password' : 'current-password'}" maxlength="200"></div>${isSetup ? `<div class="field"><label for="admin-setup-token">Código de instalação</label><input id="admin-setup-token" type="password" autocomplete="off"><small>Use o código fornecido pelo responsável pela instalação.</small></div>` : ''}${adminSession.error ? `<p class="auth-error">${escapeHtml(adminSession.error)}</p>` : ''}<button class="button primary" data-action="${isSetup ? 'admin-setup-submit' : 'admin-login-submit'}" style="width:100%">${isSetup ? 'Criar administrador' : 'Entrar'}</button><a class="button subtle auth-team-link" href="/team">${icons.users} Acesso da equipe</a></div><p class="app-version">${versionLabel()}</p></section></main>`;
}

function renderTeamPortal() {
  if (teamPortalStatus === 'loading') return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>Carregando cadastro…</h1><p>Aguarde enquanto buscamos os dados da equipe.</p></section></main>`;
  if (teamPortalStatus === 'invalid' || !teamPortalTeam) return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>Equipe não encontrada</h1><p>Fale com o responsável pela transmissão para verificar seu acesso.</p><button class="button subtle" data-action="team-logout" style="margin-top:16px">Sair</button></section></main>`;
  const athletes = Array.isArray(teamPortalTeam.athletes) ? teamPortalTeam.athletes : [];
  const completion = delegationCompletion(teamPortalTeam);
  const delegationDone = teamDelegation.status === 'completed';
  const identityHtml = `<section class="portal-team-settings"><div class="field"><label>Nome da equipe</label><input data-portal-team-field="name" maxlength="80" value="${escapeHtml(teamPortalTeam.name)}"></div><div class="field"><label>Sigla (3 letras)</label><input data-portal-team-field="short" maxlength="3" value="${escapeHtml(teamPortalTeam.short)}"></div><div class="field"><label>Cor principal</label><input type="color" data-portal-team-field="color" value="${safeColor(teamPortalTeam.color)}"></div><label class="sponsor-upload-button">${teamPortalTeam.logo ? 'Trocar escudo' : 'Enviar escudo'}<input type="file" data-portal-team-logo accept="image/png,image/jpeg,image/webp,image/svg+xml"></label></section>${renderTeamKit()}`;
  const staffHtml = `<section class="portal-coach"><div class="portal-athlete-photo">${teamPortalTeam.coach?.photo ? `<img src="${escapeHtml(teamPortalTeam.coach.photo)}" alt="Foto de ${escapeHtml(teamPortalTeam.coach.name)}">` : '<span>TC</span>'}<label>${teamPortalTeam.coach?.photo ? 'Trocar foto' : 'Enviar foto'}<input type="file" data-portal-coach-photo accept="image/png,image/jpeg,image/webp"></label></div><label><span>Treinador</span><input data-portal-coach-name maxlength="100" value="${escapeHtml(teamPortalTeam.coach?.name || 'Treinador')}" placeholder="Nome do treinador"></label><label><span>Esquema tático</span><select data-portal-formation>${Object.keys(FORMATIONS).map(value => `<option value="${value}" ${teamPortalTeam.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></section>${renderStaffManager(teamPortalTeam, true)}`;
  const squadHtml = `<div class="portal-toolbar"><div><strong>${athletes.length} atleta${athletes.length === 1 ? '' : 's'}</strong><small>Nome, número, altura, função, posição e foto.</small></div><button class="button subtle" data-action="portal-add-athlete">+ Adicionar atleta</button></div>${renderPortalImport()}<div class="portal-athlete-list">${athletes.length ? athletes.map((athlete, index) => `<article class="portal-athlete" data-athlete-id="${escapeHtml(athlete.id)}"><div class="portal-athlete-photo">${athlete.photo ? `<img src="${escapeHtml(athlete.photo)}" alt="Foto de ${escapeHtml(athlete.name || `atleta ${index + 1}`)}">` : `<span>${escapeHtml((athlete.name || 'A').slice(0, 1).toUpperCase())}</span>`}<label>${athlete.photo ? 'Trocar foto' : 'Enviar foto'}<input type="file" data-portal-athlete-photo="${escapeHtml(athlete.id)}" accept="image/png,image/jpeg,image/webp"></label></div><div class="portal-athlete-fields"><label><span>Nome completo</span><input data-portal-athlete-field="name" data-athlete-id="${escapeHtml(athlete.id)}" maxlength="100" value="${escapeHtml(athlete.name)}" placeholder="Nome do atleta"></label><div><label><span>Número</span><input data-portal-athlete-field="number" data-athlete-id="${escapeHtml(athlete.id)}" maxlength="6" value="${escapeHtml(athlete.number)}" inputmode="numeric" placeholder="10"></label><label><span>Altura (m)</span><input data-portal-athlete-field="height" data-athlete-id="${escapeHtml(athlete.id)}" maxlength="5" value="${escapeHtml(athlete.height)}" inputmode="decimal" placeholder="1,78"></label><label><span>Função</span><select data-portal-athlete-field="squadRole" data-athlete-id="${escapeHtml(athlete.id)}"><option value="starter" ${athlete.squadRole !== 'reserve' ? 'selected' : ''}>Titular</option><option value="reserve" ${athlete.squadRole === 'reserve' ? 'selected' : ''}>Reserva</option></select></label><label><span>Posição</span><input data-portal-athlete-field="position" data-athlete-id="${escapeHtml(athlete.id)}" maxlength="6" value="${escapeHtml(athlete.position || '')}" placeholder="ZAG"></label></div></div><button class="button square subtle portal-remove-athlete" data-action="portal-remove-athlete" data-value="${escapeHtml(athlete.id)}" aria-label="Remover ${escapeHtml(athlete.name || 'atleta')}">×</button></article>`).join('') : '<div class="portal-empty">Nenhum atleta cadastrado. Use “Adicionar atleta” para começar.</div>'}</div>`;
  const completionHtml = `<section class="delegation-completion ${delegationDone ? 'is-complete' : teamDelegation.status === 'needs-review' ? 'needs-review' : ''}"><div><span>${delegationDone ? 'Cadastro concluído' : teamDelegation.status === 'needs-review' ? 'Revisão necessária' : 'Conclusão da delegação'}</span><strong>${delegationDone ? 'O Super Admin já foi avisado.' : completion.complete ? 'Todos os campos obrigatórios estão preenchidos.' : 'Ainda faltam dados para concluir.'}</strong>${completion.missing.length ? `<p>Complete: ${escapeHtml(completion.missing.join(', '))}.</p>` : '<p>Ao concluir, um aviso será enviado ao Super Admin e a ação ficará registrada no histórico.</p>'}</div><button class="button primary" data-action="complete-team-delegation" ${!completion.complete || delegationDone || teamPortalStatus === 'saving' ? 'disabled' : ''}>${delegationDone ? 'Delegação concluída' : 'Concluir e avisar'}</button></section>`;
  const footerHtml = `<footer class="portal-footer"><p>As fotos devem estar em PNG, JPG ou WebP e ter até 5 MB.</p><button class="button portal-save" data-action="portal-save" ${teamPortalStatus === 'saving' ? 'disabled' : ''}>${teamPortalStatus === 'saving' ? 'Salvando…' : 'Salvar rascunho'}</button></footer>`;
  if (teamPortalTab === 'championships') return portalShell('championships', renderPortalChampionships());
  if (teamPortalTab === 'calendar') return portalShell('calendar', renderPortalCalendar());
  if (teamPortalTab === 'squad') return portalShell('squad', `${squadHtml}${footerHtml}`);
  if (teamPortalTab === 'staff') return portalShell('staff', `${staffHtml}${footerHtml}`);
  if (teamPortalTab === 'identity') return portalShell('identity', `${identityHtml}${footerHtml}`);
  if (teamPortalTab === 'account') return portalShell('account', renderPortalAccount());
  if (teamPortalTab === 'announcements') { markAnnouncementsRead(); return portalShell('announcements', renderPortalAnnouncements()); }
  return portalShell('home', `${renderPortalHome()}${completionHtml}`);
}

function renderDrawer() {
  if (drawer.type === 'art') return renderArtDrawer();
  if (drawer.type === 'obs') return renderObsDrawer();
  return renderEventDrawer();
}

function overlayUrl(layer) {
  return `${location.origin}/overlay?layer=${encodeURIComponent(layer)}&room=${encodeURIComponent(ROOM_ID)}`;
}

function renderObsDrawer() {
  const links = [['all','Programa completo'],['scoreboard','Placar (inclui animação de gol)'],['event','GC, cartões e identificações'],['lineup','Escalação simples'],['photo-lineup','Apresentação completa da equipe'],['sponsor','Patrocinador'],['sponsor-bar','Barra de Patrocinadores · 1500 × 200'],['stats','Estatísticas da partida']];
  const customLinks = (state.customOverlays || []).map(item => `<label class="tiny-label">${escapeHtml(item.name)} · ${item.width} × ${item.height}</label><div class="copy-row"><input readonly value="${escapeHtml(customOverlayUrl(item))}" aria-label="URL ${escapeHtml(item.name)}"><button class="button square" data-action="copy-custom-url" data-value="${escapeHtml(item.id)}" aria-label="Copiar ${escapeHtml(item.name)}">${icons.copy}</button></div>`).join('');
  return `<div class="drawer-backdrop" data-backdrop><aside class="drawer"><div class="drawer-head"><h2>Saídas individuais para o OBS</h2><button class="button square" data-action="close-drawer">${icons.close}</button></div><div class="instruction"><strong>Sala protegida: ${escapeHtml(ROOM_ID)}</strong><br>Cada item abaixo tem uma URL transparente independente. Adicione uma fonte Navegador por item no OBS e configure todas em <strong>1920 × 1080</strong>, exceto as saídas que indicam dimensões próprias.</div><div class="drawer-section"><h3>Uma URL para cada overlay</h3>${links.map(([layer,label]) => `<label class="tiny-label">${label}</label><div class="copy-row"><input readonly value="${escapeHtml(overlayUrl(layer))}" aria-label="URL ${label}"><button class="button square" data-action="copy-url" data-value="${layer}" aria-label="Copiar ${label}">${icons.copy}</button></div>`).join('')}${customLinks ? `<h3>Overlays criados no builder</h3>${customLinks}` : ''}</div><div class="drawer-section"><button class="button primary" data-action="open-output" style="width:100%">${icons.external} Abrir programa em outra aba</button><button class="button" data-action="open-preview" style="width:100%;margin-top:8px">${icons.monitor} Abrir visualização completa</button></div><div class="drawer-section"><h3>Atalhos de teclado</h3><div class="shortcut-list"><div><span>Ponto / gol mandante</span><kbd>1</kbd></div><div><span>Ponto / gol visitante</span><kbd>2</kbd></div><div><span>Iniciar / pausar cronômetro</span><kbd>Espaço</kbd></div><div><span>Mostrar / ocultar escalação simples</span><kbd>L</kbd></div><div><span>Mostrar / ocultar escalação com fotos</span><kbd>Shift L</kbd></div><div><span>Desfazer última alteração</span><kbd>Ctrl Z</kbd></div><div><span>Limpar GC / fechar janela</span><kbd>Esc</kbd></div></div></div></aside></div>`;
}

function renderEventDrawer() {
  const configurations = {
    yellow: { heading: 'Cartão amarelo', title: 'CARTÃO AMARELO', placeholder: 'Nome do jogador' },
    red: { heading: 'Cartão vermelho', title: 'CARTÃO VERMELHO', placeholder: 'Nome do jogador' },
    substitution: { heading: 'Substituição', title: 'SUBSTITUIÇÃO', placeholder: 'Jogador que entra', note: 'Jogador que sai' },
    'lower-third': { heading: 'GC / identificação', title: 'AO VIVO', placeholder: 'Nome do entrevistado', note: 'Cargo, função ou complemento' },
    goal: { heading: 'Gol', title: 'GOOOL', placeholder: 'Autor do gol' },
    sponsor: { heading: 'Patrocinador', title: 'PATROCINADOR', placeholder: 'Nome do patrocinador' },
  };
  const config = configurations[drawer.type] || configurations['lower-third'];
  const selectedTeamKey = drawer.team === 'away' ? 'away' : 'home';
  const players = rosterPlayers(state[selectedTeamKey]?.roster);
  const hasAthleteSelector = ['yellow', 'red', 'substitution', 'goal'].includes(drawer.type);
  const isCardEvent = drawer.type === 'yellow' || drawer.type === 'red';
  const cardMode = drawer.cardMode || state.appearance?.cardDisplayMode || 'lower-third';
  const playerOptions = players.map(player => `<option value="${escapeHtml(player.name)}">${escapeHtml(player.number ? `Camisa ${player.number}` : '')}</option>`).join('');
  return `<div class="drawer-backdrop" data-backdrop><aside class="drawer"><div class="drawer-head"><h2>${config.heading}</h2><button class="button square" data-action="close-drawer">${icons.close}</button></div>
    ${drawer.type !== 'lower-third' && drawer.type !== 'sponsor' ? `<div class="field"><label for="event-team">Equipe</label><select id="event-team"><option value="home" ${selectedTeamKey === 'home' ? 'selected' : ''}>${escapeHtml(state.home.name)}</option><option value="away" ${selectedTeamKey === 'away' ? 'selected' : ''}>${escapeHtml(state.away.name)}</option></select></div>` : ''}
    ${isCardEvent ? `<div class="field"><label for="event-card-mode">Modo de exibição</label><select id="event-card-mode"><option value="lower-third" ${cardMode === 'lower-third' ? 'selected' : ''}>GC completo · como aparece atualmente</option><option value="scoreboard" ${cardMode === 'scoreboard' ? 'selected' : ''}>Integrado somente ao placar</option></select><small class="field-hint">No modo integrado, o cartão e o atleta aparecem dentro do placar por 5 segundos.</small></div>` : ''}
    ${hasAthleteSelector ? `<datalist id="event-player-options">${playerOptions}</datalist>` : ''}
    ${drawer.type === 'sponsor' ? `<div class="field"><label for="event-sponsor">Patrocinador</label><select id="event-sponsor">${(state.sponsors || []).map((sponsor, index) => `<option value="${index}" ${clampNumber(state.activeSponsorIndex, 0, Math.max(0, state.sponsors.length - 1), 0) === index ? 'selected' : ''}>${escapeHtml(sponsor.name)}${sponsor.banner ? '' : ' (sem banner)'}</option>`).join('')}</select><small class="field-hint">O banner e o nome cadastrados para o patrocinador escolhido entram no ar.</small></div>` : `<div class="field"><label for="event-name">${drawer.type === 'sponsor' ? 'Marca exibida' : drawer.type === 'substitution' ? 'Jogador que entra' : hasAthleteSelector ? 'Atleta' : 'Nome'}</label><input id="event-name" ${hasAthleteSelector ? 'list="event-player-options" autocomplete="off"' : ''} placeholder="${escapeHtml(config.placeholder)}" value="${drawer.type === 'sponsor' ? escapeHtml(state.sponsor) : ''}" autofocus>${hasAthleteSelector ? `<small class="field-hint">Digite algumas letras para localizar entre ${players.length} atletas de ${escapeHtml(state[selectedTeamKey].name)}.</small>` : ''}</div>`}
    ${config.note ? `<div class="field"><label for="event-note">${drawer.type === 'substitution' ? 'Jogador que sai' : 'Complemento'}</label><input id="event-note" ${drawer.type === 'substitution' ? 'list="event-player-options" autocomplete="off"' : ''} placeholder="${escapeHtml(config.note)}"></div>` : ''}
    ${drawer.type === 'lower-third' ? '<div class="field"><label for="event-title">Título da tarja</label><input id="event-title" value="AO VIVO"></div>' : ''}
    <button class="button primary" data-action="confirm-event" style="width:100%;margin-top:8px">${icons.eye} ${drawer.type === 'sponsor' ? 'Aplicar patrocinador' : 'Exibir na transmissão'}</button>
    <p class="help-text">A arte entra imediatamente na visualização e nas saídas de overlay.</p></aside></div>`;
}

function outputFingerprint(layer) {
  const common = { sport: state.sport, theme: state.theme, customPrimary: state.customPrimary, customAccent: state.customAccent, championshipTheme: state.championshipTheme, typeface: state.typeface };
  const appearanceFor = prefix => Object.fromEntries(Object.entries(state.appearance || {}).filter(([key]) => key.startsWith(prefix) || (prefix === 'scoreboard' && (key.startsWith('goal') || key === 'cardDisplayMode'))));
  if (layer === 'scoreboard') return JSON.stringify({ ...common, competition: state.competition, appearance: appearanceFor('scoreboard'), home: state.home, away: state.away, clock: state.clock, period: state.period, extraTime: state.extraTime, sportData: state.sportData, visible: state.visible.scoreboard, goal: state.goalGraphic ? { ...state.goalGraphic, exiting: undefined } : null, card: state.scoreboardCard ? { ...state.scoreboardCard, exiting: undefined } : null });
  if (layer === 'event') return JSON.stringify({ ...common, appearance: appearanceFor('event'), activeEvent: state.activeEvent });
  if (layer === 'sponsor') return JSON.stringify({ ...common, appearance: appearanceFor('sponsor'), visible: state.visible.sponsor, sponsors: state.sponsors.map(sponsor => ({ id: sponsor.id, name: sponsor.name, banner: sponsor.banner, logo: sponsor.logo })), activeSponsorIndex: state.activeSponsorIndex });
  if (layer === 'sponsor-bar') return JSON.stringify({ ...common, appearance: { sponsorBarDuration: state.appearance?.sponsorBarDuration, sponsorBarAnimationSpeed: state.appearance?.sponsorBarAnimationSpeed, sponsorBarTransition: state.appearance?.sponsorBarTransition, sponsorBarFit: state.appearance?.sponsorBarFit, sponsorBarScale: state.appearance?.sponsorBarScale, sponsorBarX: state.appearance?.sponsorBarX, sponsorBarY: state.appearance?.sponsorBarY, sponsorBarOpacity: state.appearance?.sponsorBarOpacity, sponsorBarRadius: state.appearance?.sponsorBarRadius, sponsorBarBorder: state.appearance?.sponsorBarBorder, sponsorBarShadow: state.appearance?.sponsorBarShadow, sponsorBarBackground: state.appearance?.sponsorBarBackground }, visible: state.visible.sponsorBar, items: state.sponsorBarItems, activeSponsorIndex: state.sponsorBarActiveIndex, mode: state.sponsorBarMode, video: state.sponsorBarVideo });
  if (layer === 'stats') return JSON.stringify({ ...common, appearance: appearanceFor('stats'), visible: state.visible.stats, view: state.statsView, metrics: state.statsMetrics, stats: state.stats, player: state.statsPlayer, home: state.home, away: state.away, events: (state.events || []).slice(0, 40), selectedTeams: state.selectedTeams });
  if (layer === 'lineup') return JSON.stringify({ ...common, appearance: appearanceFor('lineup'), visible: state.visible.lineup, lineupTeam: state.lineupTeam, home: state.home, away: state.away });
  if (layer === 'custom') { const item = selectedCustomOverlay(); return JSON.stringify(item ? { ...item, transition: undefined, logos: [state.home.logo, state.away.logo, activeSponsor()?.logo, activeSponsor()?.banner], typeface: state.typeface } : null); }
  return JSON.stringify({ ...common, appearance: appearanceFor('photoLineup'), visible: state.visible.photoLineup, lineupTeam: state.lineupTeam, squad: state.squad, matchId: state.matchId, championshipId: state.championshipId, selectedTeams: state.selectedTeams, home: state.home, away: state.away, teamCatalog, stage: state.photoLineupStage, player: state.photoLineupPlayerIndex, showSponsors: state.photoLineupShowSponsors, sponsor: activeSponsor() });
}

function outputAnimationFingerprint(layer) {
  const now = Date.now();
  const active = value => value && Number(value.expiresAt || 0) > now ? value : null;
  if (layer === 'scoreboard') {
    const value = { motion: active(state.motion), transition: active(state.scoreboardTransition), morph: active(state.scoreboardMorph), recovery: active(state.scoreboardRecovery), goalExiting: state.goalGraphic?.exiting ? true : null, cardExiting: state.scoreboardCard?.exiting ? true : null };
    return Object.values(value).some(Boolean) ? JSON.stringify(value) : '';
  }
  if (layer === 'event') return ['entering','exiting'].includes(eventPhase()) ? eventPhase() : '';
  if (layer === 'sponsor') return JSON.stringify(active(state.sponsorTransition));
  if (layer === 'sponsor-bar') return JSON.stringify(active(state.sponsorBarTransition));
  if (layer === 'stats') return JSON.stringify(active(state.statsTransition));
  if (layer === 'lineup') return JSON.stringify(active(state.lineupTransition));
  if (layer === 'photo-lineup') return JSON.stringify({ transition: active(state.photoLineupTransition), stage: active(state.photoLineupStageTransition) });
  if (layer === 'custom') return JSON.stringify(active(selectedCustomOverlay()?.transition));
  return '';
}

function renderIsolatedOutput() {
  if (typeof app.querySelector !== 'function') { app.innerHTML = overlayMarkup(outputLayer); return; }
  const layers = outputLayer === 'all' ? ['scoreboard','event','sponsor','sponsor-bar','lineup','photo-lineup','stats'] : [outputLayer];
  if (!app.querySelector?.('[data-isolated-output]')) {
    app.innerHTML = `<div data-isolated-output>${layers.map(layer => `<div class="isolated-layer-slot" data-layer-slot="${layer}"></div>`).join('')}</div>`;
    outputFingerprints = {};
  }
  for (const layer of layers) {
    const fingerprint = outputFingerprint(layer);
    const animation = outputAnimationFingerprint(layer);
    const previous = outputFingerprints[layer];
    const shouldRender = !previous || previous.content !== fingerprint || (animation !== '' && animation !== '{}' && animation !== 'null' && previous.animation !== animation);
    outputFingerprints[layer] = { content: fingerprint, animation };
    if (!shouldRender) continue;
    const slot = app.querySelector(`[data-layer-slot="${layer}"]`);
    if (slot) slot.innerHTML = overlayMarkup(layer);
  }
}

function rememberFocusedField() {
  const focused = document.activeElement;
  if (!focused?.matches?.('input:not([type="file"]), textarea, [contenteditable="true"]')) return null;
  const attributes = ['data-art-field','data-public-search','data-public-team','data-field','data-custom-field','data-el-field','data-size-preset','data-ch-field','data-fx','data-team-field','data-team','data-appearance','data-sponsor-name','data-catalog-field','data-catalog-id','data-lineup-coach-name','data-lineup-athlete-position','data-lineup-team-id','data-portal-athlete-field','data-athlete-id','data-portal-staff-name','data-portal-coach-name','data-portal-team-field','data-championship-field','data-theme-override','data-access-search','data-sidebar-search','data-stats-player'];
  let selector = focused.id ? `#${focused.id}` : '';
  if (!selector) selector = attributes.filter(name => focused.hasAttribute?.(name)).map(name => `[${name}="${String(focused.getAttribute(name)).replace(/"/g, '\\"')}"]`).join('');
  return selector ? { selector, start: focused.selectionStart, end: focused.selectionEnd } : null;
}

function ensureEmergencyButton() {
  const existing = document.querySelector('[data-emergency-hide-all]');
  if (!isAdminPanel || platformMode || adminSession.status !== 'authenticated') {
    existing?.remove();
    return;
  }
  if (existing) return;
  const button = document.createElement('button');
  button.className = 'emergency-hide-all';
  button.textContent = 'DESATIVAR TODOS';
  button.dataset.emergencyHideAll = 'true';
  button.onclick = () => handleAction('hide-all', { dataset: {} });
  document.body.append(button);
}

function ensureMatchSwitcher() {
  if (!isAdminPanel || platformMode || adminSession.status !== 'authenticated' || !operationsData.matches.length || document.getElementById('active-match-switcher')) return;
  const actions = document.querySelector('.top-actions');
  if (!actions) return;
  const wrapper = document.createElement('label');
  wrapper.className = 'active-match-switcher';
  wrapper.innerHTML = renderMatchSwitcher();
  const nested = wrapper.querySelector('.active-match-switcher');
  if (nested) wrapper.innerHTML = nested.innerHTML;
  actions.prepend(wrapper);
}

// ===== Páginas públicas (sem login): /campeonatos, /c/<slug>, /o/<slug> e /embed/<visão>?c=<slug> =====
let publicData = { status: 'loading', home: null, bundle: null, organizer: null, sponsors: [], query: '', filter: 'all', team: '' };
let publicSearchTimer = 0;

function publicRoute() {
  const parts = location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'c' && parts[1]) return { kind: 'championship', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'o' && parts[1]) return { kind: 'organizer', slug: decodeURIComponent(parts[1]) };
  if (parts[0] === 'embed') return { kind: 'embed', view: parts[1] || 'standings', slug: new URLSearchParams(location.search).get('c') || '' };
  return { kind: 'home' };
}

async function loadPublicData() {
  const route = publicRoute();
  try {
    if (route.kind === 'home') {
      const response = await fetch(`/api/public/championships${publicData.query ? `?q=${encodeURIComponent(publicData.query)}` : ''}`, { cache: 'no-store' });
      publicData.home = await response.json();
    } else if (route.kind === 'organizer') {
      const response = await fetch(`/api/public/organizer?slug=${encodeURIComponent(route.slug)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('404');
      publicData.organizer = await response.json();
    } else {
      const response = await fetch(`/api/public/championship?slug=${encodeURIComponent(route.slug)}`, { cache: 'no-store' });
      if (!response.ok) throw new Error('404');
      const bundle = await response.json();
      const same = publicData.bundle && JSON.stringify({ ...publicData.bundle, generatedAt: 0 }) === JSON.stringify({ ...bundle, generatedAt: 0 });
      publicData.bundle = bundle;
      if (same) return;
    }
    publicData.status = 'ready';
  } catch { publicData.status = 'error'; }
  render();
}

async function loadPublicSponsors() {
  try {
    const response = await fetch(`/api/state?room=${LIBRARY_ROOM}`, { cache: 'no-store' });
    const remote = response.ok ? await response.json() : null;
    if (remote?.updatedAt) { publicData.sponsors = normalizeState(remote).sponsors.filter(item => item.wideAsset || item.banner || item.logo).slice(0, 6); render(); }
  } catch {}
}

function initializePublicPage() {
  loadPublicData();
  const route = publicRoute();
  if (route.kind !== 'home') setInterval(loadPublicData, 15000);
  if (route.kind === 'championship' || route.kind === 'home') loadPublicSponsors();
  window.addEventListener('hashchange', render);
}

const FAVORITES_KEY = 'juventude.favoritos.v1';

function publicFavorites() {
  try { return JSON.parse(localStorage.getItem(FAVORITES_KEY)) || []; } catch { return []; }
}

const PUBLIC_STATUS = { scheduled: 'Agendada', live: 'Ao vivo', finished: 'Encerrada', cancelled: 'Cancelada' };
const PUBLIC_TABS = [['classificacao', 'Classificação'], ['jogos', 'Jogos'], ['artilharia', 'Artilharia'], ['disciplina', 'Disciplina'], ['noticias', 'Notícias e fotos']];

function publicHeader(extra = '') {
  return `<header class="public-header"><a class="public-brand" href="/campeonatos">${brandMark()}<span><strong>Juventude</strong><small>Esporte Clube</small></span></a><nav><a href="/campeonatos">Campeonatos</a></nav>${extra}</header>`;
}

function publicFooter() {
  const sponsors = publicData.sponsors.map(item => `<img src="${escapeHtml(item.wideAsset || item.banner || item.logo)}" alt="${escapeHtml(item.name || 'Patrocinador')}" loading="lazy">`).join('');
  return `${sponsors ? `<section class="public-sponsors"><small>Patrocinadores</small><div>${sponsors}</div></section>` : ''}<footer class="public-footer"><span>Juventude Esporte Clube</span><a href="/api/public/championships" rel="noopener">API JSON</a></footer>`;
}

function publicMatchRow(match) {
  const when = match.kickoffAt ? new Date(match.kickoffAt) : null;
  const dateText = when && !Number.isNaN(when.getTime()) ? new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(when) : 'A definir';
  const timeText = when && !Number.isNaN(when.getTime()) ? new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(when) : '';
  const hasScore = match.homeScore !== null && match.awayScore !== null;
  const penalties = match.homePenalties !== null && match.awayPenalties !== null ? `<small>(${match.homePenalties} × ${match.awayPenalties} pên.)</small>` : '';
  return `<article class="public-match is-${escapeHtml(match.status)}"><div class="public-match-when"><b>${escapeHtml(dateText)}</b><small>${escapeHtml(timeText)}</small></div><div class="public-match-teams"><span class="home">${escapeHtml(match.homeName)}</span><strong class="public-score">${hasScore ? `${match.homeScore} × ${match.awayScore}` : timeText || 'vs'}</strong><span class="away">${escapeHtml(match.awayName)}</span></div><div class="public-match-meta"><span class="portal-chip ${match.status === 'live' ? 'is-live' : match.status === 'finished' ? 'is-done' : ''}">${escapeHtml(PUBLIC_STATUS[match.status] || match.status)}</span>${penalties}${match.venue ? `<small>${escapeHtml(match.venue)}</small>` : ''}</div></article>`;
}

function publicChampionshipTab(bundle, tab) {
  if (tab === 'jogos') {
    const teamFilter = publicData.team;
    const matches = bundle.matches.filter(match => !teamFilter || match.homeTeamId === teamFilter || match.awayTeamId === teamFilter);
    const rounds = new Map();
    for (const match of matches) rounds.set(match.round || 'Partidas', [...(rounds.get(match.round || 'Partidas') || []), match]);
    const options = `<option value="">Todas as equipes</option>${bundle.teams.map(team => `<option value="${escapeHtml(team.id)}" ${team.id === teamFilter ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('')}`;
    return `<div class="public-filter"><select data-public-team aria-label="Filtrar por equipe">${options}</select></div>${[...rounds].map(([round, list]) => `<section class="public-round"><h3>${escapeHtml(round)}</h3>${list.map(publicMatchRow).join('')}</section>`).join('') || '<div class="portal-empty">Nenhuma partida cadastrada.</div>'}`;
  }
  if (tab === 'artilharia') return bundle.scorers.length ? `<div class="table-scroll"><table class="standings-table"><thead><tr><th>#</th><th>Atleta</th><th>Equipe</th><th>Gols</th></tr></thead><tbody>${bundle.scorers.map((item, index) => `<tr><td>${index + 1}</td><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.teamName)}</td><td><b>${item.goals}</b></td></tr>`).join('')}</tbody></table></div>` : '<div class="portal-empty">A artilharia aparece conforme os gols forem registrados.</div>';
  if (tab === 'disciplina') return `${bundle.suspended.length ? `<section class="public-round"><h3>Suspensos para a próxima partida</h3>${bundle.suspended.map(item => `<div class="public-line"><span>${escapeHtml(item.name)} · ${escapeHtml(item.teamName)}</span><small>${item.games} jogo(s)</small></div>`).join('')}</section>` : ''}${bundle.cards.length ? `<div class="table-scroll"><table class="standings-table"><thead><tr><th>Atleta</th><th>Equipe</th><th>🟨</th><th>🟥</th></tr></thead><tbody>${bundle.cards.map(item => `<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.teamName)}</td><td>${item.yellow}</td><td>${item.red}</td></tr>`).join('')}</tbody></table></div>` : '<div class="portal-empty">Nenhum cartão registrado até agora.</div>'}`;
  if (tab === 'noticias') return bundle.posts.length ? `<div class="public-posts">${bundle.posts.map(post => `<article class="public-post">${post.media ? `<img src="${escapeHtml(post.media)}" alt="" loading="lazy">` : ''}<div><small>${escapeHtml(POST_KIND_LABELS[post.kind] || 'Notícia')}${post.round ? ` · ${escapeHtml(post.round)}` : ''} · ${escapeHtml(operationDate(post.createdAt))}</small><h3>${escapeHtml(post.title)}</h3><p>${escapeHtml(post.body).replace(/\n/g, '<br>')}</p>${post.link ? `<a href="${escapeHtml(post.link)}" target="_blank" rel="noopener noreferrer">Abrir link</a>` : ''}</div></article>`).join('')}</div>` : '<div class="portal-empty">Ainda não há notícias, fotos ou vídeos.</div>';
  const tables = bundle.groups.length ? bundle.groups.map(group => `<section class="public-round"><h3>Grupo ${escapeHtml(group.group)}</h3>${standingsTableMarkup(group.table, bundle.teams)}</section>`).join('') : standingsTableMarkup(bundle.standings, bundle.teams);
  const knockout = bundle.matches.filter(match => match.stage === 'knockout');
  return `${tables}<p class="help-text">Pontos: vitória ${bundle.championship.rules.pointsWin}, empate ${bundle.championship.rules.pointsDraw}. Desempate: ${bundle.championship.rules.tiebreakers.map(key => TIEBREAKER_LABELS[key]).join(' › ')}.</p>${knockout.length ? `<section class="public-round"><h3>Mata-mata</h3>${knockout.map(publicMatchRow).join('')}</section>` : ''}`;
}

function renderPublicApp() {
  const route = publicRoute();
  if (publicData.status === 'loading') return `<div class="public-shell">${publicHeader()}<div class="portal-empty">Carregando…</div></div>`;
  if (publicData.status === 'error') return `<div class="public-shell">${publicHeader()}<section class="public-hero"><div><h1>Página não encontrada</h1><p>O campeonato ou organizador não existe ou ainda não foi publicado.</p><a class="button primary" href="/campeonatos">Ver campeonatos</a></div></section></div>`;
  if (route.kind === 'home') {
    const data = publicData.home || { championships: [], organizers: [] };
    const showChampionships = publicData.filter !== 'organizers';
    const showOrganizers = publicData.filter !== 'championships';
    const chips = [['all', 'Todos'], ['championships', 'Campeonatos'], ['organizers', 'Organizadores']].map(([key, label]) => `<button class="access-chip ${publicData.filter === key ? 'active' : ''}" data-action="public-filter" data-value="${key}">${label}</button>`).join('');
    const followed = publicFavorites();
    const followedCards = !publicData.query && showChampionships ? data.championships.filter(item => followed.includes(item.slug)) : [];
    const cards = showChampionships ? data.championships.map(item => `<a class="public-card" href="/c/${encodeURIComponent(item.slug)}"><small>${escapeHtml(SPORT_LABELS[item.sport] || 'Futebol')} · ${escapeHtml(item.season || 'Temporada')}</small><strong>${escapeHtml(item.name)}</strong><span>${item.teams} equipes · ${item.matches} partidas</span><b class="portal-chip ${item.status === 'active' ? 'is-ok' : ''}">${escapeHtml(CHAMPIONSHIP_STATUS_LABELS[item.status] || '')}</b></a>`).join('') : '';
    const organizers = showOrganizers ? data.organizers.map(item => `<a class="public-card is-organizer" href="/o/${encodeURIComponent(item.slug)}"><small>Organizador</small><strong>${escapeHtml(item.name)}</strong><span>${item.championships} campeonato(s)</span></a>`).join('') : '';
    return `<div class="public-shell">${publicHeader()}<section class="public-hero"><div><span class="public-kicker">Juventude Esporte Clube</span><h1>Acompanhe os campeonatos</h1><p>Classificação ao vivo, jogos, artilharia e notícias, direto no celular.</p></div></section><section class="public-search"><input type="search" data-public-search value="${escapeHtml(publicData.query)}" placeholder="Buscar campeonato ou organizador" aria-label="Buscar"><div class="access-chips">${chips}</div></section>${followedCards.length ? `<section class="public-followed"><h3>Seus campeonatos</h3><div class="public-cards">${followedCards.map(item => `<a class="public-card" href="/c/${encodeURIComponent(item.slug)}"><small>★ Seguindo</small><strong>${escapeHtml(item.name)}</strong><span>${item.teams} equipes · ${item.matches} partidas</span></a>`).join('')}</div></section>` : ''}<section class="public-cards">${cards}${organizers}${cards || organizers ? '' : '<div class="portal-empty">Nenhum resultado.</div>'}</section>${publicFooter()}</div>`;
  }
  if (route.kind === 'organizer') {
    const { organizer, championships } = publicData.organizer;
    document.title = `${organizer.name} · Juventude Esporte Clube`;
    return `<div class="public-shell">${publicHeader()}<section class="public-hero"><div><span class="public-kicker">Organizador</span><h1>${escapeHtml(organizer.name)}</h1><p>${championships.length} campeonato(s)</p></div></section><section class="public-cards">${championships.map(item => `<a class="public-card" href="/c/${encodeURIComponent(item.slug)}"><small>${escapeHtml(SPORT_LABELS[item.sport] || 'Futebol')} · ${escapeHtml(item.season || '')}</small><strong>${escapeHtml(item.name)}</strong><span>${item.teams} equipes · ${item.matches} partidas</span></a>`).join('')}</section>${publicFooter()}</div>`;
  }
  const bundle = publicData.bundle;
  document.title = `${bundle.championship.name} · Juventude Esporte Clube`;
  if (route.kind === 'embed') {
    const view = route.view;
    const body = view === 'matches' ? bundle.matches.filter(match => match.status !== 'cancelled').slice(-12).map(publicMatchRow).join('') : view === 'scorers' ? publicChampionshipTab(bundle, 'artilharia') : publicChampionshipTab(bundle, 'classificacao');
    return `<div class="embed-shell"><h2>${escapeHtml(bundle.championship.name)}</h2>${body}<a class="embed-credit" href="${location.origin}/c/${encodeURIComponent(bundle.championship.slug)}" target="_blank" rel="noopener">Ver campeonato completo</a></div>`;
  }
  const tab = PUBLIC_TABS.some(([key]) => key === location.hash.slice(1)) ? location.hash.slice(1) : 'classificacao';
  const live = bundle.matches.filter(match => match.status === 'live');
  const info = bundle.championship;
  return `<div class="public-shell">${publicHeader(`<button class="button subtle" data-action="public-favorite" data-value="${escapeHtml(info.slug)}">${publicFavorites().includes(info.slug) ? '★ Seguindo' : '☆ Seguir'}</button><button class="button subtle" data-action="public-share">Compartilhar</button>`)}<section class="public-hero"><div><span class="public-kicker">${escapeHtml(SPORT_LABELS[info.sport] || 'Futebol')}${info.season ? ` · ${escapeHtml(info.season)}` : ''}</span><h1>${escapeHtml(info.name)}</h1>${info.description ? `<p>${escapeHtml(info.description)}</p>` : ''}<div class="public-chips"><span class="portal-chip ${info.status === 'active' ? 'is-ok' : ''}">${escapeHtml(CHAMPIONSHIP_STATUS_LABELS[info.status] || '')}</span><span class="portal-chip">${escapeHtml((FORMAT_LABELS[info.format] || '').split(' (')[0])}</span>${info.organizer ? `<a class="portal-chip" href="/o/${encodeURIComponent(info.organizer)}">${escapeHtml(info.organizerName || info.organizer)}</a>` : ''}</div>${info.championName ? `<div class="public-champion">🏆 Campeão: <strong>${escapeHtml(info.championName)}</strong></div>` : ''}</div></section>
    ${live.length ? `<section class="public-live"><h3><i></i> Ao vivo</h3>${live.map(publicMatchRow).join('')}</section>` : ''}
    <nav class="public-tabs" aria-label="Seções">${PUBLIC_TABS.map(([key, label]) => `<a class="${tab === key ? 'active' : ''}" href="#${key}">${label}</a>`).join('')}</nav>
    <section class="public-content">${publicChampionshipTab(bundle, tab)}</section>${publicFooter()}</div>`;
}

function render() {
  if (isOutput) { renderIsolatedOutput(); return; }
  const remembered = rememberFocusedField();
  if (isPublicPage) {
    app.innerHTML = renderPublicApp();
  } else if (isTeamPortal) {
    app.innerHTML = teamSession.status === 'authenticated' ? renderTeamPortal() : renderTeamAuthGate();
  } else if (isPreview) {
    app.innerHTML = `<div class="full-preview-stage">${renderPreviewBackground()}${previewCompositeMarkup()}<div class="safe-guides"><i></i><i></i></div><div class="monitor-label">VISUALIZAÇÃO COMPLETA · ${escapeHtml(currentSport().label.toUpperCase())} · SALA ${escapeHtml(ROOM_ID)}</div></div>`;
  } else if (isAdminPanel && adminSession.status !== 'authenticated') {
    app.innerHTML = renderAdminAuthGate();
  } else if (isManagement || platformMode) {
    app.innerHTML = renderModuleApp();
  } else app.innerHTML = renderApp();
  if (remembered?.selector) {
    const replacement = document.querySelector(remembered.selector);
    if (replacement) {
      replacement.focus({ preventScroll: true });
      try { replacement.setSelectionRange(remembered.start, remembered.end); } catch {}
    }
  }
  ensureMatchSwitcher();
  ensureEmergencyButton();
}

function changeScore(team, delta, celebrate = false) {
  commit(draft => {
    const now = Date.now();
    draft[team].score = Math.max(0, Number(draft[team].score) + delta);
    if (delta > 0) draft.motion = { type: celebrate ? 'goal' : 'score', team, startedAt: now, expiresAt: now + 1100 };
    if (celebrate && delta > 0) {
      putGoalOnAir(draft, team);
      addTimeline('Gol', draft[team].short, draft[team].name);
    }
  }, { immediate: true });
}

function toggleClock() {
  commit(draft => {
    if (draft.clock.running) {
      draft.clock.elapsed = clockSeconds(draft.clock);
      draft.clock.running = false;
      draft.clock.startedAt = null;
      if (draft.sport === 'basketball') {
        const shot = draft.sportData.basketball.shotClock;
        shot.remaining = shotClockSeconds();
        shot.running = false;
        shot.startedAt = null;
      }
    } else {
      if (!draft.matchStartedAt) draft.matchStartedAt = Date.now();
      draft.clock.elapsed = Number.isFinite(Number(draft.clock.elapsed)) ? Math.max(0, Number(draft.clock.elapsed)) : 0;
      draft.clock.running = true;
      draft.clock.startedAt = Date.now();
      if (draft.sport === 'basketball') {
        const shot = draft.sportData.basketball.shotClock;
        shot.running = true;
        shot.startedAt = Date.now();
      }
    }
  }, { immediate: true });
}

function switchSport(key) {
  if (!SPORTS[key] || key === state.sport) return;
  currentTab = 'match';
  commit(draft => {
    draft.sport = key;
    draft.period = SPORTS[key].periods[0][0];
    draft.home.score = 0;
    draft.away.score = 0;
    draft.clock = { elapsed: 0, running: false, startedAt: null };
    draft.sportData = freshSportData();
    draft.activeEvent = null;
    draft.eventExpiresAt = 0;
    draft.motion = null;
    draft.scoreboardTransition = null;
    draft.scoreboardMorph = null;
    draft.goalGraphic = null;
    draft.scoreboardCard = null;
    draft.scoreboardRecovery = null;
    draft.visible.lineup = false;
    draft.visible.photoLineup = false;
    draft.photoLineupStage = 'starters';
    draft.photoLineupPlayerIndex = 0;
    draft.photoLineupAuto = { running: false, nextAt: 0 };
    draft.photoLineupStageTransition = null;
    draft.events = [];
    if (/^Campeonato Municipal de (Futebol|Futsal|Vôlei|Basquete) 2026$/.test(draft.competition)) {
      draft.competition = `Campeonato Municipal de ${SPORTS[key].label} 2026`;
    }
  }, { immediate: true });
  toast(`Modo ${SPORTS[key].label} ativado.`);
}

function addVolleyPoint(team) {
  commit(draft => {
    const now = Date.now();
    draft[team].score += 1;
    draft.sportData.volleyball.serve = team;
    draft.motion = { type: 'point', team, startedAt: now, expiresAt: now + 1100 };
    const setNumber = Number(draft.period.replace('S', '')) || 1;
    const threshold = setNumber === 5 ? 15 : 25;
    const rival = team === 'home' ? 'away' : 'home';
    if (draft[team].score >= threshold && draft[team].score - draft[rival].score >= 2) {
      const finalScore = `${draft.home.score} × ${draft.away.score}`;
      draft.sportData.volleyball.sets[team] += 1;
      addTimeline(`Set ${setNumber} vencido`, draft[team].short, finalScore);
      showEvent('SET ENCERRADO', draft[team].name, `${setNumber}º set · ${finalScore}`, 10500);
      if (draft.sportData.volleyball.sets[team] < 3 && setNumber < 5) {
        draft.period = `S${setNumber + 1}`;
        draft.home.score = 0;
        draft.away.score = 0;
        draft.sportData.volleyball.timeouts = { home: 0, away: 0 };
      }
    }
  }, { immediate: true });
}

function changeMetric(group, property, rawValue) {
  const [team, change] = String(rawValue || '').split(':');
  if (!['home', 'away'].includes(team)) return;
  commit(draft => {
    const values = draft.sportData[group][property];
    values[team] = Math.max(0, Number(values[team] || 0) + Number(change || 0));
  });
}

async function copyText(value, successMessage = 'Link copiado para a área de transferência.', failureMessage = 'Copie o link exibido na caixa.') {
  try {
    await navigator.clipboard.writeText(value);
    toast(successMessage);
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    toast(copied ? successMessage : failureMessage);
  }
}

const PASSWORD_CHARSETS = ['ABCDEFGHJKLMNPQRSTUVWXYZ', 'abcdefghjkmnpqrstuvwxyz', '23456789', '!@#$%&*'];
function generatePassword(length = 8) {
  const all = PASSWORD_CHARSETS.join('');
  const randomChar = set => set[Math.floor(Math.random() * set.length)];
  const chars = PASSWORD_CHARSETS.map(randomChar);
  while (chars.length < length) chars.push(randomChar(all));
  for (let i = chars.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join('');
}

function confirmEvent() {
  const type = drawer.type;
  const cardMode = (type === 'yellow' || type === 'red') && (document.getElementById('event-card-mode')?.value === 'scoreboard' || drawer.cardMode === 'scoreboard') ? 'scoreboard' : 'lower-third';
  const teamKey = document.getElementById('event-team')?.value || 'home';
  if (type === 'sponsor') {
    const chosen = Number(document.getElementById('event-sponsor')?.value);
    drawer = null;
    commit(draft => {
      draft.activeSponsorIndex = clampNumber(chosen, 0, Math.max(0, (draft.sponsors || []).length - 1), 0);
      putSponsorOnAir(draft);
    }, { immediate: true });
    toast(`Patrocinador exibido por ${clampNumber(state.appearance.sponsorDuration, 3, 60, 10)} segundos.`);
    return;
  }
  const name = document.getElementById('event-name')?.value.trim();
  const note = document.getElementById('event-note')?.value.trim() || '';
  if (!name) { toast('Informe o nome antes de colocar no ar.'); return; }
  const titles = { yellow: 'CARTÃO AMARELO', red: 'CARTÃO VERMELHO', substitution: 'SUBSTITUIÇÃO', goal: 'GOOOL', 'lower-third': document.getElementById('event-title')?.value.trim() || 'AO VIVO' };
  const team = state[teamKey];
  const eventNote = type === 'substitution' && note ? `Entra: ${name} · Sai: ${note}` : type === 'lower-third' ? note : `${team.name}${note ? ` · ${note}` : ''}`;
  drawer = null;
  commit(draft => {
    if (type === 'goal') draft[teamKey].score += 1;
    if ((type === 'yellow' || type === 'red') && cardMode === 'scoreboard') {
      draft.appearance.cardDisplayMode = 'scoreboard';
      draft.activeEvent = null;
      draft.eventExpiresAt = 0;
      putIntegratedCardOnAir(draft, type, teamKey, name);
    } else {
      if (type === 'yellow' || type === 'red') draft.appearance.cardDisplayMode = 'lower-third';
      showEvent(titles[type], name, eventNote);
    }
    addTimeline(type === 'yellow' ? 'Cartão amarelo' : type === 'red' ? 'Cartão vermelho' : type === 'substitution' ? 'Substituição' : type === 'goal' ? 'Gol' : 'GC no ar', team.short, name, note);
  }, { immediate: true });
  toast(`${titles[type]} exibido ${cardMode === 'scoreboard' ? 'dentro do placar' : 'na transmissão'}.`);
}

function handleAction(action, target) {
  if ((action.startsWith('portal-add-') || action.startsWith('portal-remove-')) && teamDelegation.status === 'completed') teamDelegation = { ...teamDelegation, status: 'needs-review' };
  if (action === 'admin-login-submit' || action === 'admin-setup-submit') {
    const username = document.getElementById('admin-username')?.value || '';
    const password = document.getElementById('admin-password')?.value || '';
    submitAdminAuth(action === 'admin-setup-submit' ? 'setup' : 'login', username, password, document.getElementById('admin-setup-token')?.value || '');
    return;
  }
  if (action === 'admin-logout') { logoutAdmin(); return; }
  if (action === 'team-login-submit') {
    const teamIdValue = document.getElementById('team-select')?.value || '';
    const username = document.getElementById('team-username')?.value || '';
    const password = document.getElementById('team-password')?.value || '';
    submitTeamLogin(teamIdValue, username, password);
    return;
  }
  if (action === 'team-logout') { logoutTeamPortal(); return; }
  if (action === 'complete-team-delegation') { completeTeamDelegation(); return; }
  if (action === 'new-championship') { selectedChampionshipId = ''; championshipDraft = blankChampionship(); championshipSectionsOpen = { general: true }; render(); return; }
  if (action === 'select-championship') { selectedChampionshipId = target.dataset.value; championshipDraft = structuredClone(operationsData.championships.find(item => item.id === selectedChampionshipId) || null); render(); return; }
  if (action === 'art-result') {
    const match = standingsBundle?.matches.find(item => item.id === target.dataset.value);
    if (match) buildQuickArt(standingsBundle, { type: 'result', matchId: match.id, championshipId: standingsChampionshipId }).then(canvas => openArt(canvas, `resultado-${match.id}`));
    return;
  }
  if (action === 'art-standings') { if (standingsBundle) buildQuickArt(standingsBundle, { type: 'standings', championshipId: standingsChampionshipId, format: 'portrait' }).then(canvas => openArt(canvas, `classificacao-${standingsBundle.championship.slug || 'campeonato'}`)); return; }
  if (action === 'arts-set') {
    const [field, value = ''] = String(target.dataset.value || '').split('|');
    setArtOption(field, value);
    render();
    return;
  }
  if (action === 'arts-download' || action === 'arts-share') {
    if (!artStudio.blob) return;
    const name = `arte-${artOptions.type}-${artOptions.format}`;
    if (action === 'arts-download') { downloadBlobFile(`${name}.png`, artStudio.blob); return; }
    const file = new File([artStudio.blob], `${name}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: 'Arte' }).catch(() => {});
    else { toast('Seu navegador não compartilha arquivos; a imagem será baixada.'); downloadBlobFile(`${name}.png`, artStudio.blob); }
    return;
  }
  if (action === 'arts-batch') {
    const bundle = artBundle;
    const current = bundle?.matches.find(item => item.id === artOptions.matchId);
    const list = bundle?.matches.filter(item => item.round === current?.round && item.status !== 'cancelled') || [];
    if (!list.length) { toast('Escolha uma partida com rodada definida.'); return; }
    toast(`Gerando ${list.length} arte(s)… o navegador pode pedir permissão para baixar vários arquivos.`);
    (async () => {
      for (const match of list) {
        const canvas = await buildQuickArt(bundle, { matchId: match.id });
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        if (blob) downloadBlobFile(`arte-${artOptions.type}-${match.room}.png`, blob);
        await new Promise(resolve => setTimeout(resolve, 450));
      }
      toast('Artes da rodada geradas.');
    })();
    return;
  }
  if (action === 'art-download') {
    if (!artPreview) return;
    const link = document.createElement('a'); link.href = artPreview.url; link.download = `${artPreview.name}.png`;
    document.body.appendChild(link); link.click(); link.remove();
    return;
  }
  if (action === 'art-share') {
    if (!artPreview) return;
    const file = new File([artPreview.blob], `${artPreview.name}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) navigator.share({ files: [file], title: 'Resultado' }).catch(() => {});
    else { toast('Seu navegador não compartilha arquivos; a imagem será baixada.'); handleAction('art-download', { dataset: {} }); }
    return;
  }
  if (action === 'standings-summary') { standingsSummaryId = target.dataset.value || ''; render(); if (standingsSummaryId) loadStandingsRooms(true); return; }
  if (action === 'standings-print') { window.print(); return; }
  if (action === 'export-csv') {
    const { name, rows } = exportRows(target.dataset.value);
    downloadTextFile(`${name}-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv;charset=utf-8', csvText(rows));
    return;
  }
  if (action === 'backup-json') {
    Promise.all([fetch('/api/teams', { cache: 'no-store' }), fetch('/api/operations', { cache: 'no-store' }), fetch(`/api/state?room=${LIBRARY_ROOM}`, { cache: 'no-store' })])
      .then(async ([teams, operations, library]) => ({ teams: teams.ok ? await teams.json() : null, operations: operations.ok ? await operations.json() : null, sponsorLibrary: library.ok ? await library.json() : null }))
      .then(data => {
        if (!data.teams || !data.operations) { toast('Não foi possível reunir os dados para o backup.'); return; }
        const { teamHistory, ...operations } = data.operations;
        downloadTextFile(`backup-plataforma-${new Date().toISOString().slice(0, 10)}.json`, 'application/json', JSON.stringify({ exportedAt: new Date().toISOString(), version: appVersion, teams: data.teams, operations, sponsorLibrary: data.sponsorLibrary && data.sponsorLibrary.updatedAt ? { sponsors: data.sponsorLibrary.sponsors, sponsorBarMode: data.sponsorLibrary.sponsorBarMode, sponsorBarVideo: data.sponsorLibrary.sponsorBarVideo, sponsorBarItems: data.sponsorLibrary.sponsorBarItems } : null }, null, 2));
        toast('Backup gerado.');
      })
      .catch(() => toast('Falha de conexão ao gerar o backup.'));
    return;
  }
  if (action === 'live-hide-all') {
    const room = String(target.dataset.value || '');
    if (!room || !confirm('Retirar do ar todos os overlays desta partida?')) return;
    fetch(`/api/state?room=${encodeURIComponent(room)}&ts=${Date.now()}`, { cache: 'no-store' })
      .then(response => response.json())
      .then(remote => {
        if (!remote?.visible) throw new Error('sem estado');
        for (const key of Object.keys(remote.visible)) remote.visible[key] = false;
        remote.updatedAt = Date.now();
        return fetch(`/api/state?room=${encodeURIComponent(room)}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(remote) });
      })
      .then(response => { if (!response.ok) throw new Error('falha'); toast('Overlays retirados do ar.'); loadLiveRooms(); })
      .catch(() => toast('Não foi possível retirar os overlays do ar.'));
    return;
  }
  if (action === 'public-filter') { publicData.filter = target.dataset.value || 'all'; render(); return; }
  if (action === 'public-favorite') {
    const slug = target.dataset.value;
    const favorites = new Set(publicFavorites());
    if (favorites.has(slug)) favorites.delete(slug); else favorites.add(slug);
    try { localStorage.setItem(FAVORITES_KEY, JSON.stringify([...favorites].slice(0, 50))); } catch {}
    toast(favorites.has(slug) ? 'Você segue este campeonato; ele aparece no topo da lista.' : 'Você deixou de seguir.');
    render();
    return;
  }
  if (action === 'public-share') {
    const data = { title: publicData.bundle?.championship.name || 'Campeonato', url: location.href.split('#')[0] };
    if (navigator.share) navigator.share(data).catch(() => {}); else copyText(data.url, 'Link copiado.');
    return;
  }
  if (action === 'new-post') { selectedPostId = ''; postMediaUrl = ''; render(); return; }
  if (action === 'select-post') { selectedPostId = target.dataset.value || ''; postMediaUrl = ''; render(); return; }
  if (action === 'clear-post-media') { postMediaUrl = '-'; render(); return; }
  if (action === 'save-post') {
    const existing = (operationsData.posts || []).find(item => item.id === target.dataset.value);
    const item = { id: target.dataset.value || '', championshipId: document.getElementById('post-championship')?.value || '', kind: document.getElementById('post-kind')?.value || 'news', round: document.getElementById('post-round')?.value || '', title: document.getElementById('post-title')?.value || '', body: document.getElementById('post-body')?.value || '', link: document.getElementById('post-link')?.value || '', media: postMediaUrl === '-' ? '' : postMediaUrl || existing?.media || '' };
    postOperation('upsert-post', { item }).then(ok => { if (!ok) return; selectedPostId = ''; postMediaUrl = ''; toast('Publicação salva.'); render(); });
    return;
  }
  if (action === 'delete-post') {
    if (!confirm('Excluir esta publicação?')) return;
    postOperation('delete-post', { id: target.dataset.value }).then(ok => { if (ok) { selectedPostId = ''; postMediaUrl = ''; toast('Publicação excluída.'); } });
    return;
  }
  if (action === 'new-announcement') { selectedAnnouncementId = ''; render(); return; }
  if (action === 'select-announcement') { selectedAnnouncementId = target.dataset.value || ''; render(); return; }
  if (action === 'save-announcement') {
    const all = document.getElementById('announce-all')?.checked;
    const teamIds = all ? [] : [...document.querySelectorAll('[data-announce-team]:checked')].map(box => box.dataset.announceTeam);
    if (!all && !teamIds.length) { toast('Escolha ao menos uma equipe ou marque "Todas as equipes".'); return; }
    const item = { id: target.dataset.value || '', title: document.getElementById('announce-title')?.value || '', body: document.getElementById('announce-body')?.value || '', teamIds, pinned: Boolean(document.getElementById('announce-pinned')?.checked) };
    postOperation('upsert-announcement', { item }).then(ok => { if (!ok) return; selectedAnnouncementId = ''; toast('Comunicado publicado.'); render(); });
    return;
  }
  if (action === 'delete-announcement') {
    if (!confirm('Excluir este comunicado?')) return;
    postOperation('delete-announcement', { id: target.dataset.value }).then(ok => { if (ok) { selectedAnnouncementId = ''; toast('Comunicado excluído.'); } });
    return;
  }
  if (action === 'ch-tb') {
    const [key, move] = String(target.dataset.value || '').split('|');
    championshipDraft ||= blankChampionship();
    const rules = championshipDraft.rules ||= blankChampionship().rules;
    const list = [...rules.tiebreakers];
    const index = list.indexOf(key);
    if (move === 'toggle') { if (index >= 0) { if (list.length > 1) list.splice(index, 1); } else list.push(key); }
    else if (index >= 0) { const to = move === 'up' ? index - 1 : index + 1; if (to >= 0 && to < list.length) [list[index], list[to]] = [list[to], list[index]]; }
    rules.tiebreakers = list;
    championshipSectionsOpen.rules = true;
    render();
    return;
  }
  if (action === 'copy-public-link') { copyText(target.dataset.value, 'Link público copiado.'); return; }
  if (action === 'save-championship' || action === 'generate-fixtures' || action === 'generate-next-round') {
    const draft = championshipDraft || operationsData.championships.find(item => item.id === selectedChampionshipId);
    if (!draft || !String(draft.name || '').trim()) { toast('Informe o nome do campeonato.'); return; }
    const item = { ...draft, id: target.dataset.value || draft.id || selectedChampionshipId || '' };
    postOperation('upsert-championship', { item }).then(ok => {
      if (!ok) return;
      const saved = operationsData.championships.find(entry => entry.id === item.id) || operationsData.championships.find(entry => entry.name === item.name);
      selectedChampionshipId = saved?.id || selectedChampionshipId;
      championshipDraft = saved ? structuredClone(saved) : null;
      if (action === 'save-championship') { toast('Campeonato salvo.'); render(); return; }
      const payload = { championshipId: saved.id, ...fixtureOptions, mode: fixtureOptions.mode || saved.format, teamIds: saved.teamIds, groups: Number(fixtureOptions.groups) || 2, advance: Number(fixtureOptions.advance) || 2, intervalDays: Number(fixtureOptions.intervalDays) || 7 };
      return postOperation(action, payload).then(done => {
        if (!done) return;
        championshipDraft = structuredClone(operationsData.championships.find(entry => entry.id === saved.id) || saved);
        fixtureOptions.replace = false;
        toast(action === 'generate-fixtures' ? 'Partidas geradas. Veja na Agenda de partidas.' : 'Próxima fase gerada.');
        render();
      });
    });
    return;
  }
  if (action === 'delete-championship') {
    if (!confirm('Excluir este campeonato?')) return;
    postOperation('delete-championship', { id: target.dataset.value }).then(ok => { if (ok) { selectedChampionshipId = ''; toast('Campeonato excluído.'); } });
    return;
  }
  if (action === 'new-operation-match') { selectedMatchId = ''; matchDraft = { championshipId: '', homeTeamId: '', awayTeamId: '', kickoffAt: '', status: 'scheduled', round: '', venue: '', room: '' }; render(); return; }
  if (action === 'select-match') { selectedMatchId = target.dataset.value; matchDraft = structuredClone(operationsData.matches.find(item => item.id === selectedMatchId) || null); render(); return; }
  if (action === 'save-operation-match') {
    const item = { homeScore: document.getElementById('match-home-score')?.value ?? '', awayScore: document.getElementById('match-away-score')?.value ?? '', homePenalties: document.getElementById('match-home-pen')?.value ?? '', awayPenalties: document.getElementById('match-away-pen')?.value ?? '', id: target.dataset.value || '', championshipId: document.getElementById('match-championship')?.value || '', homeTeamId: document.getElementById('operation-home')?.value || '', awayTeamId: document.getElementById('operation-away')?.value || '', kickoffAt: document.getElementById('match-kickoff')?.value || '', status: document.getElementById('match-status')?.value || 'scheduled', round: document.getElementById('match-round')?.value || '', venue: document.getElementById('match-venue')?.value || '', registrationDeadline: document.getElementById('match-deadline')?.value || '', room: document.getElementById('match-room')?.value || '' };
    postOperation('upsert-match', { item }).then(ok => { if (!ok) return; const saved = operationsData.matches.find(entry => entry.id === item.id) || operationsData.matches[0]; selectedMatchId = saved?.id || ''; matchDraft = null; toast('Partida salva com uma sala própria de overlays.'); render(); });
    return;
  }
  if (action === 'match-import-score') {
    fetch(`/api/state?room=${encodeURIComponent(target.dataset.value)}&ts=${Date.now()}`, { cache: 'no-store' })
      .then(response => response.json())
      .then(remote => {
        if (!remote?.updatedAt) throw new Error('vazio');
        document.getElementById('match-home-score').value = Number(remote.home?.score || 0);
        document.getElementById('match-away-score').value = Number(remote.away?.score || 0);
        const status = document.getElementById('match-status');
        if (status) { status.value = 'finished'; status.dispatchEvent(new Event('input', { bubbles: true })); }
        toast('Placar importado. Revise e clique em Salvar partida.');
      })
      .catch(() => toast('Esta sala ainda não tem placar registrado.'));
    return;
  }
  if (action === 'delete-operation-match') {
    if (!confirm('Excluir esta partida da agenda? O estado já salvo na sala não será apagado.')) return;
    postOperation('delete-match', { id: target.dataset.value }).then(ok => { if (ok) { selectedMatchId = ''; toast('Partida removida da agenda.'); } });
    return;
  }
  if (action === 'read-notification') { postOperation('mark-notification-read', { id: target.dataset.value }); return; }
  if (action === 'read-all-notifications') { postOperation('mark-all-notifications-read'); return; }
  if (action === 'refresh-dashboard-stats') { loadDashboardStats(); return; }
  if (action === 'module-tab') { moduleTab = target.dataset.value; render(); return; }
  if (action === 'add-custom-overlay' || action === 'builder-template') {
    if ((state.customOverlays || []).length >= 30) { toast('Limite de 30 overlays por partida.'); return; }
    const template = BUILDER_TEMPLATES.find(entry => entry.key === (action === 'builder-template' ? target.dataset.value : 'blank')) || BUILDER_TEMPLATES[0];
    let created = null;
    commit(draft => { created = overlayFromTemplate(template, draft.customOverlays); draft.customOverlays.push(created); }, { immediate: true });
    selectedCustomOverlayId = created.id;
    builderSelectedEl = created.elements[0]?.id || '';
    builderTab = 'position';
    render();
    return;
  }
  if (action === 'select-custom-overlay') { selectedCustomOverlayId = target.dataset.value; builderSelectedEl = ''; render(); return; }
  if (action === 'copy-custom-url') { const item = state.customOverlays.find(entry => entry.id === target.dataset.value); if (item) copyText(customOverlayUrl(item)); return; }
  if (action === 'toggle-custom-overlay') {
    commit(draft => {
      const item = draft.customOverlays.find(entry => entry.id === target.dataset.value);
      if (!item) return;
      const now = Date.now();
      item.visible = !item.visible;
      const duration = customTransitionDuration(item);
      item.transition = { type: item.visible ? 'enter' : 'exit', startedAt: now, expiresAt: now + duration };
      item.expiresAt = item.visible && item.autoHide ? now + duration + item.autoHide * 1000 : 0;
    }, { immediate: true });
    return;
  }
  if (action === 'remove-custom-overlay') {
    if (!confirm('Excluir este overlay?')) return;
    commit(draft => { draft.customOverlays = draft.customOverlays.filter(entry => entry.id !== target.dataset.value); }, { immediate: true });
    selectedCustomOverlayId = state.customOverlays[0]?.id || '';
    builderSelectedEl = '';
    render();
    return;
  }
  if (action === 'builder-select') { builderSelectedEl = target.dataset.value || ''; render(); return; }
  if (action === 'builder-tab') { builderTab = ['position', 'style', 'content', 'animation'].includes(target.dataset.value) ? target.dataset.value : 'position'; render(); return; }
  if (action === 'builder-grid') { builderGrid = !builderGrid; render(); return; }
  if (action === 'builder-add') {
    const preset = BUILDER_ADD_PRESETS.find(([key]) => key === target.dataset.value);
    const item = selectedCustomOverlay();
    if (!preset || !item) return;
    if (item.elements.length >= 60) { toast('Limite de 60 elementos por overlay.'); return; }
    let newId = '';
    commitOverlay(overlay => {
      newId = newBuilderId('el', overlay.elements.map(el => el.id));
      overlay.elements.push(normalizedCustomElement({ x: 35, y: 35, animIn: 'fade', ...preset[2], id: newId, name: preset[2].name || `${preset[1]} ${overlay.elements.length + 1}` }, overlay.elements.length));
    });
    builderSelectedEl = newId;
    builderTab = 'position';
    render();
    return;
  }
  if (action === 'builder-remove-el') { const id = builderSelectedEl; commitOverlay(overlay => { overlay.elements = overlay.elements.filter(el => el.id !== id); }); builderSelectedEl = ''; render(); return; }
  if (action === 'builder-dup-el') {
    let newId = '';
    commitOverlay(overlay => {
      const index = overlay.elements.findIndex(el => el.id === builderSelectedEl);
      if (index < 0 || overlay.elements.length >= 60) return;
      newId = newBuilderId('el', overlay.elements.map(el => el.id));
      overlay.elements.splice(index + 1, 0, normalizedCustomElement({ ...overlay.elements[index], id: newId, name: `${overlay.elements[index].name} (cópia)`, x: overlay.elements[index].x + 2, y: overlay.elements[index].y + 2 }, index + 1));
    });
    if (newId) builderSelectedEl = newId;
    render();
    return;
  }
  if (action === 'builder-z') {
    const [rawId, rawDirection] = String(target.dataset.value || '').split('|');
    const id = rawDirection ? rawId : builderSelectedEl;
    const direction = rawDirection || rawId;
    commitOverlay(overlay => {
      const index = overlay.elements.findIndex(el => el.id === id);
      if (index < 0) return;
      const [moved] = overlay.elements.splice(index, 1);
      const to = direction === 'front' ? overlay.elements.length : direction === 'back' ? 0 : direction === 'up' ? Math.min(overlay.elements.length, index + 1) : Math.max(0, index - 1);
      overlay.elements.splice(to, 0, moved);
    });
    render();
    return;
  }
  if (action === 'builder-toggle') {
    const [id, field] = String(target.dataset.value || '').split('|');
    if (!['visible', 'locked'].includes(field)) return;
    commitOverlay(overlay => { const el = overlay.elements.find(entry => entry.id === id); if (el) el[field] = !el[field]; });
    render();
    return;
  }
  if (action === 'builder-align') {
    commitOverlay(overlay => {
      const el = overlay.elements.find(entry => entry.id === builderSelectedEl);
      if (!el) return;
      const map = { left: () => { el.x = 0; }, hcenter: () => { el.x = Math.round((100 - el.w) / 2 * 10) / 10; }, right: () => { el.x = Math.round((100 - el.w) * 10) / 10; }, top: () => { el.y = 0; }, vmiddle: () => { el.y = Math.round((100 - el.h) / 2 * 10) / 10; }, bottom: () => { el.y = Math.round((100 - el.h) * 10) / 10; } };
      map[target.dataset.value]?.();
    });
    render();
    return;
  }
  if (action === 'builder-clear') {
    const field = target.dataset.value;
    commitOverlay(overlay => {
      if (field === 'canvasBg') overlay.canvasBg = '';
      else { const el = overlay.elements.find(entry => entry.id === builderSelectedEl); if (el && ['fill', 'fill2'].includes(field)) el[field] = ''; }
    });
    render();
    return;
  }
  if (action === 'builder-token') {
    commitOverlay(overlay => {
      const el = overlay.elements.find(entry => entry.id === builderSelectedEl);
      if (el && el.type === 'text') el.text = `${el.text}${el.text && !/\s$/.test(el.text) ? ' ' : ''}${target.dataset.value}`.slice(0, 400);
    });
    render();
    return;
  }
  if (action === 'builder-stagger') {
    commitOverlay(overlay => { overlay.elements.filter(el => el.visible).forEach((el, index) => { el.delay = Math.min(10000, index * 120); if (el.animIn === 'none') el.animIn = 'fade'; }); });
    toast('Entrada em cascata aplicada: cada elemento entra 120 ms depois do anterior.');
    render();
    return;
  }
  if (action === 'builder-play') {
    const item = selectedCustomOverlay();
    if (!item) return;
    const duration = customTransitionDuration(item);
    builderPreviewAnim = target.dataset.value === 'exit' ? 'exit' : 'enter';
    render();
    setTimeout(() => {
      if (target.dataset.value === 'both') { builderPreviewAnim = 'exit'; render(); setTimeout(() => { builderPreviewAnim = ''; render(); }, duration + 250); }
      else { builderPreviewAnim = ''; render(); }
    }, duration + 350);
    return;
  }
  if (action === 'builder-duplicate-overlay') {
    const item = selectedCustomOverlay();
    if (!item || (state.customOverlays || []).length >= 30) { toast('Limite de 30 overlays por partida.'); return; }
    let created = null;
    commit(draft => { created = { ...JSON.parse(JSON.stringify(selectedCustomOverlay(draft))), id: newBuilderId('overlay', draft.customOverlays.map(entry => entry.id)), visible: false, transition: null, expiresAt: 0 }; created.name = `${created.name} (cópia)`.slice(0, 80); draft.customOverlays.push(created); }, { immediate: true });
    selectedCustomOverlayId = created.id;
    render();
    return;
  }
  if (action === 'builder-use-platform') {
    const model = platformOverlays.find(entry => entry.id === target.dataset.value);
    if (!model || (state.customOverlays || []).length >= 30) { toast(model ? 'Limite de 30 overlays por partida.' : 'Modelo não encontrado.'); return; }
    let created = null;
    commit(draft => {
      created = { ...JSON.parse(JSON.stringify(model)), id: newBuilderId('overlay', draft.customOverlays.map(entry => entry.id)), visible: false, transition: null, expiresAt: 0 };
      draft.customOverlays.push(created);
    }, { immediate: true });
    selectedCustomOverlayId = created.id;
    builderSelectedEl = '';
    toast('Modelo copiado para esta partida. Mídias enviadas continuam apontando para o arquivo original.');
    render();
    return;
  }
  if (action === 'builder-save-platform') {
    const item = selectedCustomOverlay();
    if (!item) return;
    fetch(`/api/state?room=${BUILDER_LIBRARY_ROOM}&ts=${Date.now()}`, { cache: 'no-store' })
      .then(response => response.json())
      .then(remote => {
        const library = remote?.updatedAt ? normalizeState(remote) : createDefaultState();
        if (library.customOverlays.length >= 30) throw new Error('limite');
        const copy = { ...JSON.parse(JSON.stringify(item)), id: newBuilderId('overlay', library.customOverlays.map(entry => entry.id)), visible: false, transition: null, expiresAt: 0 };
        library.customOverlays.push(copy);
        library.updatedAt = Date.now();
        return fetch(`/api/state?room=${BUILDER_LIBRARY_ROOM}`, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(library) });
      })
      .then(response => { if (!response.ok) throw new Error('falha'); toast('Modelo salvo na plataforma. Ele aparece em todas as partidas.'); loadPlatformOverlays(true); })
      .catch(error => toast(error.message === 'limite' ? 'A biblioteca já tem 30 modelos.' : 'Não foi possível salvar o modelo.'));
    return;
  }
  if (action === 'builder-export') {
    const item = selectedCustomOverlay();
    if (!item) return;
    const { name, width, height, canvasBg, autoHide, elements } = item;
    downloadTextFile(`overlay-${teamId(name, 'overlay')}.json`, 'application/json', JSON.stringify({ format: 'juventude-overlay', version: 1, overlay: { name, width, height, canvasBg, autoHide, elements } }, null, 2));
    toast('Overlay exportado. Mídias enviadas continuam apontando para esta partida; prefira escudos e patrocinador como dados ao vivo para reaproveitar em outras salas.');
    return;
  }
  if (action === 'hide-all') {
    if (!isAdminPanel || adminSession.status !== 'authenticated') return;
    commit(draft => {
      const now = Date.now();
      if (draft.visible.scoreboard) draft.scoreboardTransition = { type: 'exit', startedAt: now, expiresAt: now + scoreboardTransitionDuration() };
      if (draft.visible.sponsor) draft.sponsorTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorMotionDuration(draft.appearance) };
      if (draft.visible.sponsorBar) draft.sponsorBarTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorBarMotionDuration(draft.appearance) };
      if (draft.visible.stats) draft.statsTransition = { type: 'exit', startedAt: now, expiresAt: now + statsMotionDuration() };
      if (draft.visible.lineup) draft.lineupTransition = { type: 'exit', startedAt: now, expiresAt: now + 600 };
      if (draft.visible.photoLineup) draft.photoLineupTransition = { type: 'exit', startedAt: now, expiresAt: now + 900 };
      for (const item of draft.customOverlays || []) { if (item.visible) { item.visible = false; item.transition = { type: 'exit', startedAt: now, expiresAt: now + customTransitionDuration(item) }; item.expiresAt = 0; } }
      draft.visible = { ...draft.visible, scoreboard: false, sponsor: false, sponsorBar: false, lineup: false, photoLineup: false, stats: false };
      draft.photoLineupAuto = { running: false, nextAt: 0 };
      draft.sponsorLoop = false; draft.sponsorExpiresAt = 0; draft.sponsorNextIndex = null;
      draft.sponsorBarLoop = false; draft.sponsorBarExpiresAt = 0; draft.sponsorBarNextIndex = null;
      hideEventAnimated(draft);
    }, { immediate: true });
    toast('Todos os overlays foram ocultados sem apagar os dados.');
    return;
  }
  if (action === 'toggle-championship-theme') { commit(draft => { draft.championshipTheme.enabled = !draft.championshipTheme.enabled; if (draft.championshipTheme.enabled) { draft.theme = 'custom'; draft.customPrimary = draft.championshipTheme.primary; draft.customAccent = draft.championshipTheme.secondary; } }, { immediate: true }); persistChampionshipTheme(); return; }
  if (action === 'sponsor-bar-mode') {
    commit(draft => { draft.sponsorBarMode = target.dataset.value === 'video' ? 'video' : 'images'; }, { immediate: true });
    return;
  }
  if (action === 'report-export-type') {
    reportExportType = REPORT_EXPORT_TYPES[target.dataset.value] ? target.dataset.value : 'full';
    render();
    return;
  }
  if (action === 'finish-match') {
    const pdfWindow = window.open('', '_blank');
    commit(draft => {
      draft.matchEndedAt = Date.now();
      if (draft.clock.running) { draft.clock.elapsed = clockSeconds(); draft.clock.running = false; draft.clock.startedAt = null; }
      draft.periodScores[draft.period] = `${draft.home.score} × ${draft.away.score}`;
      const report = reportSnapshot(draft, true);
      draft.completedReports = [report, ...(draft.completedReports || []).filter(item => item.id !== report.id)].slice(0, 50);
    }, { immediate: true });
    reportSelection = 1;
    render();
    const finalReport = state.completedReports[0];
    openPrintableDocument(`${REPORT_EXPORT_TYPES[reportExportType].kicker} final · ${finalReport.home.short} ${finalReport.finalScore} ${finalReport.away.short}`, printableByType(finalReport, reportExportType), pdfWindow);
    toast('Partida finalizada. Relatório salvo e PDF preparado.');
    return;
  }
  if (action === 'print-final-report') {
    const finalReport = state.completedReports?.[0] || reportSnapshot(state, true);
    openPrintableDocument(`${REPORT_EXPORT_TYPES[reportExportType].kicker} final · ${finalReport.home.short} ${finalReport.finalScore} ${finalReport.away.short}`, printableByType(finalReport, reportExportType));
    return;
  }
  if (action === 'print-report' || action === 'print-pregame') {
    const selected = ([reportSnapshot(), ...(state.completedReports || [])])[reportSelection] || reportSnapshot();
    const content = action === 'print-pregame' ? printablePregame() : printableByType(selected, reportExportType);
    openPrintableDocument(action === 'print-pregame' ? `Resumo pré-jogo · ${state.home.short} × ${state.away.short}` : `${REPORT_EXPORT_TYPES[reportExportType].kicker} · ${selected.home.short} ${selected.finalScore} ${selected.away.short}`, content);
    return;
  }
  if (action === 'undo') {
    if (!state._backup) { toast('Nenhuma alteração disponível para desfazer.'); return; }
    const current = structuredClone(state);
    delete current._backup;
    const restored = normalizeState(state._backup);
    restored._backup = current;
    state = restored;
    state.updatedAt = Math.max(Date.now(), Number(state.updatedAt || 0) + 1);
    writeLocal();
    channel?.postMessage({ type: 'state', state });
    schedulePush(true);
    render();
    toast('Última alteração desfeita.');
    return;
  }
  if (action === 'new-match') {
    location.href = moduleUrl('matches');
    return;
  }
  if (action === 'reset-appearance') {
    commit(draft => { draft.appearance = defaultAppearance(); }, { immediate: true });
    toast('Tamanhos, estilos, posições e animações restaurados.');
    return;
  }
  if (action === 'appearance-preset') {
    const preset = target.dataset.value;
    const presets = {
      compact: { scoreboardScale: 82, scoreboardFont: 88, scoreboardStyle: 'minimal', scoreboardRadius: 2, scoreboardSurface: 92, scoreboardShadow: 'none', eventScale: 88, eventFont: 92, eventStyle: 'minimal', lineupScale: 88, lineupFont: 90, lineupStyle: 'clean', photoLineupScale: 88, photoLineupFont: 90, photoLineupStyle: 'cards', sponsorScale: 85, sponsorFont: 90, sponsorStyle: 'clean', scoreboardAnimation: 'slide', scoreboardAnimationSpeed: 125, goalAnimation: 'typewriter' },
      broadcast: defaultAppearance(),
      impact: { scoreboardScale: 118, scoreboardFont: 112, scoreboardStyle: 'contrast', scoreboardRadius: 7, scoreboardSurface: 100, scoreboardAccent: 4, scoreboardShadow: 'strong', eventScale: 125, eventFont: 125, eventStyle: 'block', lineupScale: 108, lineupFont: 110, lineupStyle: 'columns', photoLineupScale: 106, photoLineupFont: 112, photoLineupStyle: 'glass', sponsorScale: 105, sponsorFont: 108, sponsorStyle: 'ribbon', scoreboardAnimation: 'zoom', scoreboardAnimationSpeed: 90, goalAnimation: 'bounce' },
    };
    if (!presets[preset]) return;
    commit(draft => { draft.appearance = { ...draft.appearance, ...presets[preset] }; }, { immediate: true });
    toast(`Predefinição ${preset === 'compact' ? 'Compacto' : preset === 'impact' ? 'Impacto' : 'Padrão TV'} aplicada.`);
    return;
  }
  if (action === 'test-goal') {
    commit(draft => {
      draft.visible.scoreboard = true;
      putGoalOnAir(draft, 'home');
    }, { immediate: true });
    toast('Comemoração exibida dentro do placar.');
    return;
  }
  if (action === 'test-scoreboard-animation') {
    commit(draft => {
      const now = Date.now();
      draft.visible.scoreboard = true;
      draft.scoreboardTransition = { type: 'enter', startedAt: now, expiresAt: now + scoreboardTransitionDuration() };
    }, { immediate: true });
    toast('Animação de entrada do placar exibida.');
    return;
  }
  if (action === 'test-sponsor-animation') {
    commit(draft => { putSponsorOnAir(draft); }, { immediate: true });
    toast(`Patrocinador exibido por ${clampNumber(state.appearance.sponsorDuration, 3, 60, 10)} segundos.`);
    return;
  }
  if (action === 'teams-template') {
    downloadTextFile('modelo-times-e-atletas.csv', 'text/csv;charset=utf-8', csvText([['Equipe', 'Sigla', 'Cor', 'Número', 'Atleta', 'Posição', 'Altura', 'Função'], ['Juventude E.C.', 'JUV', '#8253cd', '1', 'Gabriel Martins', 'GOL', '1.85', 'Titular'], ['Juventude E.C.', '', '', '12', 'Pedro Henrique', 'GOL', '1.82', 'Reserva'], ['Atlético Ilha', 'ATL', '#4588b5', '1', 'Rafael Souza', 'GOL', '1.80', 'Titular']]));
    return;
  }
  if (action === 'add-team') {
    const id = `team-${Date.now().toString(36)}`;
    const newTeam = { id, name: `Novo time ${teamCatalog.length + 1}`, short: 'TIM', color: '#8253cd', logo: '', roster: '', athletes: [], formation: '4-3-3', coach: { name: 'Treinador', photo: '' }, accessToken: accessToken() };
    selectedCatalogTeamId = id;
    commitTeamCatalog(catalog => { catalog.push(newTeam); }, { immediate: true });
    toast('Novo time criado. Complete os dados e a relação de atletas.');
    return;
  }
  if (action === 'remove-team') {
    const id = target.dataset.value;
    if (teamCatalog.length <= 1) { toast('Mantenha pelo menos um time cadastrado.'); return; }
    if (state.selectedTeams?.home === id || state.selectedTeams?.away === id) { toast('Troque o time da partida antes de removê-lo.'); return; }
    commitTeamCatalog(catalog => {
      const index = catalog.findIndex(team => team.id === id);
      if (index >= 0) catalog.splice(index, 1);
      selectedCatalogTeamId = catalog[0]?.id;
    }, { immediate: true });
    toast('Time removido do cadastro.');
    return;
  }
  if (action === 'access-team-filter') { accessTeamFilter = ['with', 'without'].includes(target.dataset.value) ? target.dataset.value : 'all'; render(); return; }
  if (action === 'dismiss-access-reveal') { delete accessRevealed[target.dataset.value]; render(); return; }
  if (action === 'copy-access-instructions') {
    const key = String(target.dataset.value || '');
    const password = accessRevealed[key];
    if (!password) return;
    if (key.startsWith('admin:')) {
      const account = accessAdmins.find(item => item.id === key.slice(6));
      if (account) copyText(accessInstructions('admin', '', account.username, password), 'Instruções de acesso copiadas.', 'Copie a senha exibida.');
    } else {
      const [teamKey, userKey] = key.slice(5).split('|');
      copyText(accessInstructions('team', operationTeamName(teamKey), userKey, password), 'Instruções de acesso copiadas.', 'Copie a senha exibida.');
    }
    return;
  }
  if (action === 'team-user-reset' || action === 'access-handle-reset') {
    const parts = String(target.dataset.value || '').split('|');
    const [teamKey, userKey] = action === 'team-user-reset' ? parts : [parts[1], parts[2]];
    if (!teamKey || !userKey) return;
    const password = generatePassword(12);
    fetch('/api/auth/team/credentials', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: teamKey, username: userKey, password }) })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!ok) { toast(data.error || 'Falha ao redefinir a senha.'); return; }
        accessRevealed[`team:${teamKey}|${userKey}`] = password;
        copyText(accessInstructions('team', operationTeamName(teamKey), userKey, password), `Nova senha de "${userKey}" gerada e copiada.`, 'Nova senha gerada; copie a senha exibida.');
        if (action === 'access-handle-reset') postOperation('mark-notification-read', { id: parts[0] });
        render();
      })
      .catch(() => toast('Falha ao redefinir a senha.'));
    return;
  }
  if (action === 'admin-reset-password') {
    const id = target.dataset.value;
    const password = generatePassword(12);
    fetch('/api/auth/admin/accounts', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, password }) })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!ok) { toast(data.error || 'Falha ao redefinir a senha.'); return; }
        accessAdmins = data.accounts;
        accessRevealed[`admin:${id}`] = password;
        const account = accessAdmins.find(item => item.id === id);
        copyText(accessInstructions('admin', '', account?.username || '', password), 'Nova senha gerada e copiada.', 'Nova senha gerada; copie a senha exibida.');
        render();
      })
      .catch(() => toast('Falha ao redefinir a senha.'));
    return;
  }
  if (action === 'generate-team-password') {
    const teamIdValue = target.dataset.value;
    const field = document.getElementById(`access-password-${teamIdValue}`);
    if (field) field.value = generatePassword();
    return;
  }
  if (action === 'copy-team-credentials') {
    const teamIdValue = target.dataset.value;
    const username = document.getElementById(`access-username-${teamIdValue}`)?.value.trim() || '';
    const password = document.getElementById(`access-password-${teamIdValue}`)?.value.trim() || '';
    if (!username || !password) { toast('Preencha usuário e senha antes de copiar.'); return; }
    copyText(`Usuário: ${username}\nSenha: ${password}`, 'Usuário e senha copiados para a área de transferência.', 'Copie o usuário e a senha exibidos nos campos.');
    return;
  }
  if (action === 'generate-admin-password') {
    const field = document.getElementById('access-admin-password');
    if (field) field.value = generatePassword();
    return;
  }
  if (action === 'copy-admin-credentials') {
    const username = document.getElementById('access-admin-username')?.value.trim() || '';
    const password = document.getElementById('access-admin-password')?.value.trim() || '';
    if (!username || !password) { toast('Preencha usuário e senha antes de copiar.'); return; }
    copyText(`Usuário: ${username}\nSenha: ${password}`, 'Usuário e senha copiados para a área de transferência.', 'Copie o usuário e a senha exibidos nos campos.');
    return;
  }
  if (action === 'set-team-credentials') {
    const teamIdValue = target.dataset.value;
    const username = document.getElementById(`access-username-${teamIdValue}`)?.value || '';
    const password = document.getElementById(`access-password-${teamIdValue}`)?.value || '';
    if (username.trim().length < 3 || password.trim().length < 8) { toast('Informe usuário (mín. 3 letras) e senha (mín. 8 caracteres).'); return; }
    fetch('/api/auth/team/credentials', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: teamIdValue, username, password }) })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ok) accessTeamCredentials = [...accessTeamCredentials.filter(entry => !(entry.teamId === teamIdValue && entry.username === data.username)), { teamId: teamIdValue, username: data.username, updatedAt: Date.now() }];
        toast(ok ? `Acesso de "${data.username}" salvo para a equipe.` : (data.error || 'Falha ao salvar acesso da equipe.'));
        render();
      })
      .catch(() => toast('Falha ao salvar acesso da equipe.'));
    return;
  }
  if (action === 'remove-team-credentials') {
    const [teamIdValue, removedUser = ''] = String(target.dataset.value || '').split('|');
    fetch(`/api/auth/team/credentials?teamId=${encodeURIComponent(teamIdValue)}${removedUser ? `&username=${encodeURIComponent(removedUser)}` : ''}`, { method: 'DELETE' })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ok) accessTeamCredentials = accessTeamCredentials.filter(entry => entry.teamId !== teamIdValue || (removedUser && entry.username !== removedUser));
        toast(ok ? 'Acesso da equipe removido.' : (data.error || 'Falha ao remover acesso da equipe.'));
        render();
      })
      .catch(() => toast('Falha ao remover acesso da equipe.'));
    return;
  }
  if (action === 'add-admin-account') {
    const username = document.getElementById('access-admin-username')?.value || '';
    const password = document.getElementById('access-admin-password')?.value || '';
    if (username.trim().length < 3 || password.trim().length < 8) { toast('Informe usuário (mín. 3 letras) e senha (mín. 8 caracteres).'); return; }
    fetch('/api/auth/admin/accounts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password, role: document.getElementById('access-admin-role')?.value || 'admin' }) })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ok) accessAdmins = data.accounts;
        toast(ok ? 'Administrador adicionado.' : (data.error || 'Falha ao adicionar administrador.'));
        render();
      })
      .catch(() => toast('Falha ao adicionar administrador.'));
    return;
  }
  if (action === 'remove-admin-account') {
    const id = target.dataset.value;
    fetch(`/api/auth/admin/accounts?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ok) accessAdmins = data.accounts;
        toast(ok ? 'Administrador removido.' : (data.error || 'Falha ao remover administrador.'));
        render();
      })
      .catch(() => toast('Falha ao remover administrador.'));
    return;
  }
  if (action === 'reset-squad') { commit(draft => { delete draft.squad?.[target.dataset.value]; }, { immediate: true }); toast('Elenco da partida voltou ao padrão do time.'); return; }
  if (action === 'reset-squad-positions') { commit(draft => { if (draft.squad?.[target.dataset.value]) draft.squad[target.dataset.value].positions = {}; }, { immediate: true }); return; }
  if (action === 'portal-tab') { teamPortalTab = PORTAL_SECTIONS.some(([key]) => key === target.dataset.value) ? target.dataset.value : 'home'; render(); window.scrollTo?.({ top: 0 }); return; }
  if (action === 'portal-open-match') {
    const [championshipId, matchId] = String(target.dataset.value || '').split('|');
    teamPortalTab = 'championships'; teamPortalChampionshipId = championshipId; teamPortalMatchId = matchId; render(); return;
  }
  if (action === 'portal-export-csv') { downloadTextFile(`elenco-${teamId(teamPortalTeam?.short || 'time')}.csv`, 'text/csv;charset=utf-8', portalRosterCsv()); return; }
  if (action === 'portal-export-json') { downloadTextFile(`equipe-${teamId(teamPortalTeam?.short || 'time')}.json`, 'application/json', JSON.stringify(teamPortalTeam, null, 2)); return; }
  if (action === 'portal-export-ics') { downloadTextFile(`jogos-${teamId(teamPortalTeam?.short || 'time')}.ics`, 'text/calendar;charset=utf-8', portalCalendarIcs()); return; }
  if (action === 'portal-select-championship') {
    teamPortalChampionshipId = target.dataset.value;
    teamPortalMatchId = '';
    try { localStorage.setItem('juventude.team.championship', teamPortalChampionshipId); } catch {}
    render();
    return;
  }
  if (action === 'portal-open-match') { teamPortalMatchId = target.dataset.value; render(); return; }
  if (action === 'portal-close-match') { teamPortalMatchId = ''; render(); return; }
  if (action === 'portal-reg-all' || action === 'portal-reg-none') {
    if (!teamPortalTeam || !teamPortalChampionshipId) return;
    teamPortalTeam.registrations ||= {};
    const registration = teamPortalTeam.registrations[teamPortalChampionshipId] ||= { athleteIds: [], numbers: {}, formation: '' };
    registration.athleteIds = action === 'portal-reg-all' ? teamPortalTeam.athletes.map(athlete => athlete.id) : [];
    if (action === 'portal-reg-none') pruneChampionshipSquads(teamPortalChampionshipId, registration);
    render();
    return;
  }
  if (action === 'portal-save-registration') { saveTeamPortal().then(() => toast('Inscrição da equipe salva.')); return; }
  if (action === 'portal-save-squad') { saveTeamPortal().then(() => toast('Escalação enviada.')); return; }
  if (action === 'portal-squad-role') {
    const [athleteKey, role] = String(target.dataset.value || '').split('|');
    const squad = portalMatchSquad();
    if (!squad || !athleteKey) return;
    if (role === 'starter' && !squad.starters.includes(athleteKey) && squad.starters.length >= 11) { toast('Máximo de 11 titulares. Mova alguém para reserva antes.'); return; }
    squad.starters = squad.starters.filter(id => id !== athleteKey);
    squad.reserves = squad.reserves.filter(id => id !== athleteKey);
    if (role === 'starter') squad.starters.push(athleteKey);
    else if (role === 'reserve') squad.reserves.push(athleteKey);
    teamPortalStatus = 'ready';
    render();
    return;
  }
  if (action === 'portal-squad-move') {
    const [athleteKey, direction] = String(target.dataset.value || '').split('|');
    const squad = portalMatchSquad();
    const index = squad ? squad.starters.indexOf(athleteKey) : -1;
    const swap = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || swap < 0 || swap >= squad.starters.length) return;
    [squad.starters[index], squad.starters[swap]] = [squad.starters[swap], squad.starters[index]];
    render();
    return;
  }
  if (action === 'delegation-approve') { postOperation('review-delegation', { teamId: target.dataset.value, decision: 'approved' }).then(ok => { if (ok) toast('Delegação aprovada.'); }); return; }
  if (action === 'delegation-return') {
    const comment = document.getElementById(`delegation-comment-${target.dataset.value}`)?.value.trim() || '';
    if (!comment) { toast('Informe o motivo da devolução.'); return; }
    postOperation('review-delegation', { teamId: target.dataset.value, decision: 'returned', comment }).then(ok => { if (ok) toast('Delegação devolvida ao time.'); });
    return;
  }
  if (action === 'restore-team-version') {
    const [restoreTeamId, versionId] = String(target.dataset.value || '').split('|');
    if (!confirm('Restaurar esta versão do cadastro? A versão atual continua guardada no histórico.')) return;
    postOperation('restore-team-version', { teamId: restoreTeamId, versionId }).then(ok => { if (ok) { toast('Versão restaurada.'); pollTeamCatalog(); } });
    return;
  }
  if (action === 'delegation-remind') {
    const row = delegationRows().find(item => item.team.id === target.dataset.value);
    if (!row) return;
    const message = `Olá! Ainda há pendências no cadastro da delegação ${row.team.name}${row.check.missing.length ? ` (falta: ${row.check.missing.join(', ')})` : ''}.${row.deadline ? ` Prazo: ${row.deadline.date}.` : ''} Acesse ${location.origin}/team para completar.`;
    copyText(message, 'Mensagem de cobrança copiada. Cole no WhatsApp ou e-mail da equipe.');
    return;
  }
  if (action === 'team-reset-request') {
    const requestedTeam = document.getElementById('team-select')?.value || '';
    const requestedUser = document.getElementById('team-username')?.value.trim() || '';
    if (!requestedTeam || requestedUser.length < 3) { toast('Selecione a equipe e informe o usuário para pedir a redefinição.'); return; }
    fetch('/api/auth/team/reset-request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: requestedTeam, username: requestedUser }) })
      .then(() => toast('Se o usuário existir, a organização foi avisada e vai gerar uma nova senha.'))
      .catch(() => toast('Não foi possível enviar o pedido agora.'));
    return;
  }
  if (action === 'portal-add-sponsor') {
    if (!teamPortalTeam || (teamPortalTeam.sponsors || []).length >= 6) return;
    teamPortalTeam.sponsors = [...(teamPortalTeam.sponsors || []), { id: `patrocinio-${Date.now().toString(36)}`, name: '', logo: '' }];
    render();
    return;
  }
  if (action === 'portal-remove-sponsor') {
    if (!teamPortalTeam) return;
    teamPortalTeam.sponsors = (teamPortalTeam.sponsors || []).filter(item => item.id !== target.dataset.value);
    render();
    return;
  }
  if (action === 'portal-import-csv') {
    if (!teamPortalTeam) return;
    const result = importRosterCsv(document.getElementById('portal-csv')?.value || '');
    if (!result.added && !result.updated) { toast('Nenhuma linha válida encontrada. Use: número;nome;posição;altura;função.'); return; }
    toast(`${result.added} atleta(s) adicionado(s) e ${result.updated} atualizado(s). Salvando…`);
    saveTeamPortal();
    return;
  }
  if (action === 'portal-add-athlete') {
    if (!teamPortalTeam) return;
    const index = teamPortalTeam.athletes.length;
    teamPortalTeam.athletes.push({ id: `atleta-${Date.now().toString(36)}`, name: '', number: '', height: '', photo: '', squadRole: index < currentSport().teamSize ? 'starter' : 'reserve', position: '' });
    render();
    return;
  }
  if (action === 'portal-remove-athlete') {
    if (!teamPortalTeam) return;
    teamPortalTeam.athletes = teamPortalTeam.athletes.filter(athlete => athlete.id !== target.dataset.value);
    render();
    return;
  }
  if (action === 'portal-add-staff') {
    if (!teamPortalTeam) return;
    teamPortalTeam.staff = normalizedStaff(teamPortalTeam);
    teamPortalTeam.staff.push({ id: `staff-${Date.now().toString(36)}`, name: '', role: 'Auxiliar técnico', photo: '' });
    syncLegacyCoach(teamPortalTeam);
    render();
    return;
  }
  if (action === 'portal-remove-staff') {
    if (!teamPortalTeam || normalizedStaff(teamPortalTeam).length <= 1) return;
    teamPortalTeam.staff = normalizedStaff(teamPortalTeam).filter(member => member.id !== target.dataset.value);
    syncLegacyCoach(teamPortalTeam);
    render();
    return;
  }
  if (action === 'lineup-add-staff') {
    const team = teamCatalog.find(item => item.id === state.selectedTeams?.[state.lineupTeam]);
    if (!team) return;
    team.staff = normalizedStaff(team);
    team.staff.push({ id: `staff-${Date.now().toString(36)}`, name: '', role: 'Auxiliar técnico', photo: '' });
    syncLegacyCoach(team);
    scheduleTeamCatalogPush(true);
    render();
    return;
  }
  if (action === 'lineup-remove-staff') {
    const team = teamCatalog.find(item => item.id === target.dataset.teamId);
    if (!team || normalizedStaff(team).length <= 1) return;
    team.staff = normalizedStaff(team).filter(member => member.id !== target.dataset.value);
    syncLegacyCoach(team);
    scheduleTeamCatalogPush(true);
    render();
    return;
  }
  if (action === 'portal-save') { saveTeamPortal(); return; }
  if (action === 'start-lineup-sequence') {
    commit(draft => { startPhotoLineupSequence(draft); }, { immediate: true });
    toast('Sequência completa de escalação iniciada.');
    return;
  }
  if (action === 'set-photo-lineup-stage') {
    commit(draft => {
      setPhotoLineupStage(draft, target.dataset.value, target.dataset.value === 'individual' ? draft.photoLineupPlayerIndex : 0);
      if (draft.visible.lineup) setLineupVisibility(draft, false);
    }, { immediate: true });
    return;
  }
  if (action === 'previous-lineup-player' || action === 'next-lineup-player') {
    const players = lineupGroups().starters;
    if (!players.length) { toast('Cadastre os titulares antes de apresentar.'); return; }
    const direction = action === 'next-lineup-player' ? 1 : -1;
    commit(draft => {
      const nextIndex = (Number(draft.photoLineupPlayerIndex || 0) + direction + players.length) % players.length;
      setPhotoLineupStage(draft, 'individual', nextIndex, false, direction > 0 ? 'next' : 'previous');
      if (draft.visible.lineup) setLineupVisibility(draft, false);
    }, { immediate: true });
    return;
  }
  if (action === 'sport') { switchSport(target.dataset.value); return; }
  if (action === 'tab') { currentTab = target.dataset.value; render(); return; }
  if (action === 'open-obs') { drawer = { type: 'obs' }; render(); return; }
  if (action === 'close-drawer') { drawer = null; render(); return; }
  if (action === 'clock-toggle') { toggleClock(); return; }
  if (action === 'clock-reset') { commit(draft => { draft.clock = { elapsed: 0, running: false, startedAt: null }; }, { immediate: true }); return; }
  if (action === 'clock-forward' || action === 'clock-back') {
    commit(draft => {
      const now = Date.now();
      const elapsed = clockSeconds(draft.clock, now);
      draft.clock.elapsed = Math.max(0, elapsed + (action === 'clock-forward' ? 60 : -60));
      draft.clock.startedAt = draft.clock.running ? now : null;
    }, { immediate: true });
    return;
  }
  if (action.startsWith('score-')) {
    const [, team, direction] = action.split('-');
    if (state.sport === 'volleyball' && direction === 'plus') addVolleyPoint(team);
    else changeScore(team, direction === 'plus' ? 1 : -1);
    return;
  }
  if (action === 'goal-home' || action === 'goal-away') { changeScore(action.endsWith('home') ? 'home' : 'away', 1, true); return; }
  if (action === 'period') { commit(draft => { draft.periodScores[draft.period] = `${draft.home.score} × ${draft.away.score}`; draft.period = target.dataset.value; addTimeline(`Período: ${draft.period}`); }); return; }
  if (['yellow','red','substitution','lower-third'].includes(action)) { drawer = { type: action }; render(); return; }
  if (action === 'confirm-event') { confirmEvent(); return; }
  if (action === 'theme') { commit(draft => { draft.theme = target.dataset.value; }); return; }
  if (action === 'typeface') {
    // A fonte global vale para todos os overlays: zera as fontes individuais para que sigam esta escolha.
    if (TYPEFACES[target.dataset.value]) commit(draft => { draft.typeface = target.dataset.value; for (const key of Object.keys(draft.appearance)) if (key.endsWith('Typeface')) draft.appearance[key] = 'global'; }, { immediate: true });
    return;
  }
  if (action === 'appearance-option') {
    const [field, value] = String(target.dataset.value || '').split('|');
    const options = OVERLAY_STYLE_OPTIONS[field];
    if (!options) return;
    const chosen = options.some(([option]) => option === value) ? value : options[0][0];
    commit(draft => { draft.appearance[field] = chosen; }, { immediate: true });
    return;
  }
  if (action === 'sponsor-source') {
    const source = target.dataset.value === 'platform' ? 'platform' : 'match';
    if (source === 'platform' && !sponsorLibrary) { toast('A biblioteca da plataforma ainda não foi criada.'); return; }
    commit(draft => { draft.sponsorSource = source; applySponsorLibrary(draft); }, { immediate: true });
    toast(source === 'platform' ? 'Esta partida voltou a usar a biblioteca da plataforma.' : 'Esta partida agora usa patrocínios próprios (cópia da biblioteca).');
    return;
  }
  if (action === 'sponsor-bar-preset') {
    const preset = SPONSOR_BAR_PRESETS[target.dataset.value];
    if (!preset) return;
    commit(draft => { Object.assign(draft.appearance, preset.values); }, { immediate: true });
    toast(`Predefinição "${preset.label}" aplicada à barra.`);
    return;
  }
  if (action === 'scoreboard-style') {
    const style = ['classic', 'glass', 'minimal', 'contrast', 'neon', 'ribbon', 'gradient'].includes(target.dataset.value) ? target.dataset.value : 'classic';
    commit(draft => { draft.appearance.scoreboardStyle = style; }, { immediate: true });
    toast('Estilo do placar atualizado.');
    return;
  }
  if (action === 'scoreboard-layout') {
    const layout = SCOREBOARD_LAYOUTS.some(([value]) => value === target.dataset.value) ? target.dataset.value : 'compact';
    const previousLayout = state.appearance.scoreboardLayout;
    if (layout === previousLayout) return;
    const morphPair = ['compact', 'expanded'];
    commit(draft => {
      const now = Date.now();
      draft.appearance.scoreboardLayout = layout;
      draft.visible.scoreboard = true;
      draft.scoreboardTransition = null;
      draft.scoreboardMorph = morphPair.includes(layout) && morphPair.includes(previousLayout)
        ? { direction: layout, startedAt: now, expiresAt: now + scoreboardMorphDuration() }
        : null;
    }, { immediate: true });
    toast(`Placar em layout ${SCOREBOARD_LAYOUTS.find(([value]) => value === layout)?.[1] || layout}.`);
    return;
  }
  if (action === 'toggle-scoreboard-badge') {
    commit(draft => { draft.appearance.scoreboardShowBadge = !draft.appearance.scoreboardShowBadge; }, { immediate: true });
    toast(state.appearance.scoreboardShowBadge ? 'Escudos exibidos no placar.' : 'Escudos ocultos no placar.');
    return;
  }
  if (action === 'event-position') {
    const position = ['left', 'center', 'right'].includes(target.dataset.value) ? target.dataset.value : 'left';
    const x = { left: 2, center: 50, right: 98 }[position];
    commit(draft => { draft.appearance.eventPosition = position; draft.appearance.eventX = x; }, { immediate: true });
    toast(`GC posicionado à ${position === 'left' ? 'esquerda' : position === 'right' ? 'direita' : 'centro'}.`);
    return;
  }
  if (action === 'volley-point') { addVolleyPoint(target.dataset.value); return; }
  if (action === 'volley-set') { changeMetric('volleyball', 'sets', target.dataset.value); return; }
  if (action === 'volley-timeout') { changeMetric('volleyball', 'timeouts', target.dataset.value); return; }
  if (action === 'volley-serve') { commit(draft => { draft.sportData.volleyball.serve = target.dataset.value; }); return; }
  if (action === 'volley-timeout-event') {
    const team = target.dataset.value;
    commit(draft => {
      draft.sportData.volleyball.timeouts[team] += 1;
      showEvent('TEMPO TÉCNICO', draft[team].name, `${draft.sportData.volleyball.timeouts[team]}º tempo solicitado`);
      addTimeline('Tempo técnico', draft[team].short);
    }, { immediate: true });
    return;
  }
  if (action === 'futsal-foul') { changeMetric('futsal', 'fouls', target.dataset.value); return; }
  if (action === 'basket-foul') { changeMetric('basketball', 'fouls', target.dataset.value); return; }
  if (action === 'basket-timeout') { changeMetric('basketball', 'timeouts', target.dataset.value); return; }
  if (action === 'basket-possession') { commit(draft => { draft.sportData.basketball.possession = target.dataset.value; }); return; }
  if (action === 'basket-points') {
    const [team, points] = String(target.dataset.value || '').split(':');
    if (!['home', 'away'].includes(team) || ![1,2,3].includes(Number(points))) return;
    commit(draft => {
      const now = Date.now();
      draft[team].score += Number(points);
      draft.motion = { type: 'basket', team, startedAt: now, expiresAt: now + 1250 };
      draft.sportData.basketball.possession = team === 'home' ? 'away' : 'home';
      addTimeline(`Cesta +${points}`, draft[team].short);
      if (Number(points) === 3) showEvent('CESTA DE 3', draft[team].name, `${draft.home.score} × ${draft.away.score}`);
    }, { immediate: true });
    return;
  }
  if (action === 'shot-reset') {
    const remaining = Number(target.dataset.value);
    if (![14,24].includes(remaining)) return;
    commit(draft => {
      draft.sportData.basketball.shotClock = { remaining, running: draft.clock.running, startedAt: draft.clock.running ? Date.now() : null };
    }, { immediate: true });
    return;
  }
  if (action === 'clear-events') { commit(draft => { draft.events = []; }); return; }
  if (action === 'hide-event') { commit(draft => { hideEventAnimated(draft); }, { immediate: true }); return; }
  if (action === 'toggle-lineup' || action === 'overlay-lineup') {
    commit(draft => {
      const visible = !draft.visible.lineup;
      setLineupVisibility(draft, visible);
      if (visible && draft.visible.photoLineup) setPhotoLineupVisibility(draft, false);
    }, { immediate: true });
    return;
  }
  if (action === 'toggle-photo-lineup' || action === 'overlay-photo-lineup') {
    commit(draft => {
      const visible = !draft.visible.photoLineup;
      setPhotoLineupVisibility(draft, visible);
      if (visible && draft.visible.lineup) setLineupVisibility(draft, false);
    }, { immediate: true });
    return;
  }
  if (action === 'toggle-photo-lineup-sponsors') {
    commit(draft => { draft.photoLineupShowSponsors = !draft.photoLineupShowSponsors; }, { immediate: true });
    toast(state.photoLineupShowSponsors ? 'Patrocinadores ativados no rodapé da escalação.' : 'Rodapé de patrocinadores ocultado.');
    return;
  }
  if (action === 'overlay-scoreboard') {
    commit(draft => {
      const now = Date.now();
      const duration = scoreboardTransitionDuration();
      if (draft.visible.scoreboard) {
        draft.visible.scoreboard = false;
        draft.scoreboardTransition = { type: 'exit', startedAt: now, expiresAt: now + duration };
      } else {
        draft.visible.scoreboard = true;
        draft.scoreboardTransition = { type: 'enter', startedAt: now, expiresAt: now + duration };
      }
    }, { immediate: true });
    return;
  }
  if (action === 'overlay-sponsor') {
    if (state.visible.sponsor) {
      commit(draft => {
        const now = Date.now();
        draft.visible.sponsor = false;
        draft.sponsorExpiresAt = 0;
        draft.sponsorNextIndex = null;
        draft.sponsorTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorMotionDuration(draft.appearance) };
      }, { immediate: true });
    }
    else { drawer = { type: 'sponsor' }; render(); }
    return;
  }
  if (action === 'overlay-stats') {
    commit(draft => {
      if (draft.visible.stats) {
        const now = Date.now();
        draft.visible.stats = false;
        draft.statsExpiresAt = 0;
        draft.statsTransition = { type: 'exit', startedAt: now, expiresAt: now + statsMotionDuration() };
      } else putStatsOnAir(draft);
    }, { immediate: true });
    return;
  }
  if (action === 'stats-view') { commit(draft => { draft.statsView = ['compare', 'timeline', 'player'].includes(target.dataset.value) ? target.dataset.value : 'compare'; }, { immediate: true }); return; }
  if (action === 'stats-adjust') {
    const [side, metric, delta] = String(target.dataset.value || '').split('|');
    if (!['home', 'away'].includes(side) || !(metric in state.stats.home) || metric === 'possession') return;
    commit(draft => { draft.stats[side][metric] = clampNumber(Number(draft.stats[side][metric]) + Number(delta), 0, 999, 0); }, { immediate: true });
    return;
  }
  if (action === 'stats-toggle-metric') {
    const metric = target.dataset.value;
    if (!STATS_METRICS.some(item => item.key === metric)) return;
    const current = normalizedStatsMetrics(state.statsMetrics);
    if (!current.includes(metric) && current.length >= 6) { toast('Máximo de 6 indicadores. Desmarque algum antes.'); return; }
    if (current.includes(metric) && current.length === 1) { toast('Mantenha ao menos um indicador.'); return; }
    commit(draft => { draft.statsMetrics = current.includes(metric) ? current.filter(item => item !== metric) : [...current, metric]; }, { immediate: true });
    return;
  }
  if (action === 'stats-reset') {
    if (!confirm('Zerar todas as estatísticas lançadas manualmente nesta partida?')) return;
    commit(draft => { draft.stats = defaultStats(); }, { immediate: true });
    return;
  }
  if (action === 'reset-module-appearance') {
    const moduleKey = target.dataset.value;
    const prefixes = MODULE_APPEARANCE_PREFIXES[moduleKey];
    if (!prefixes) return;
    if (!confirm('Restaurar os padrões visuais deste módulo? As configurações atuais serão substituídas.')) return;
    const defaults = defaultAppearance();
    commit(draft => {
      for (const key of Object.keys(defaults)) {
        if (prefixes.some(prefix => key.startsWith(prefix)) && !(moduleKey === 'sponsors' && key.startsWith('sponsorBar'))) draft.appearance[key] = defaults[key];
      }
    }, { immediate: true });
    toast('Padrões do módulo restaurados.');
    return;
  }
  if (action === 'overlay-sponsor-bar') {
    commit(draft => {
      if (draft.visible.sponsorBar) {
        const now = Date.now();
        draft.visible.sponsorBar = false;
        draft.sponsorBarLoop = false;
        draft.sponsorBarExpiresAt = 0;
        draft.sponsorBarNextIndex = null;
        draft.sponsorBarTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorBarMotionDuration(draft.appearance) };
      } else putSponsorBarOnAir(draft);
    }, { immediate: true });
    return;
  }
  if (action === 'toggle-sponsor-bar-loop') {
    commit(draft => {
      draft.sponsorBarLoop = !draft.sponsorBarLoop;
      if (draft.sponsorBarLoop) putSponsorBarOnAir(draft);
      else {
        const now = Date.now();
        draft.visible.sponsorBar = false;
        draft.sponsorBarExpiresAt = 0;
        draft.sponsorBarNextIndex = null;
        draft.sponsorBarTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorBarMotionDuration(draft.appearance) };
      }
    }, { immediate: true });
    toast(state.sponsorBarLoop ? 'Looping da barra iniciado.' : 'Looping da barra interrompido.');
    return;
  }
  if (action === 'toggle-sponsor-bar-schedule') {
    commit(draft => {
      draft.sponsorBarAutoSchedule = !draft.sponsorBarAutoSchedule;
      draft.sponsorBarScheduleNextAt = draft.sponsorBarAutoSchedule ? Date.now() + clampNumber(draft.sponsorBarScheduleInterval, 1, 60, 5) * 60000 : 0;
    }, { immediate: true });
    toast(state.sponsorBarAutoSchedule ? 'Exibição automática da barra ativada.' : 'Exibição automática da barra desativada.');
    return;
  }
  if (action === 'next-sponsor-bar') {
    commit(draft => {
      draft.sponsorBarActiveIndex = (Number(draft.sponsorBarActiveIndex || 0) + 1) % Math.max(1, draft.sponsorBarItems.length);
      putSponsorBarOnAir(draft);
    }, { immediate: true });
    return;
  }
  if (action === 'add-sponsor-bar-item') {
    commit(draft => { draft.sponsorBarItems.push({ id: `bar-${Date.now().toString(36)}`, asset: '' }); }, { immediate: true });
    return;
  }
  if (action === 'remove-sponsor-bar-item') {
    commit(draft => {
      draft.sponsorBarItems = draft.sponsorBarItems.filter(item => item.id !== target.dataset.value);
      draft.sponsorBarActiveIndex = Math.min(draft.sponsorBarActiveIndex, Math.max(0, draft.sponsorBarItems.length - 1));
    }, { immediate: true });
    return;
  }
  if (action === 'add-sponsor') {
    commit(draft => {
      const id = `sponsor-${Date.now().toString(36)}`;
      draft.sponsors.push({ id, name: `PATROCINADOR ${draft.sponsors.length + 1}`, banner: '', logo: '', lineupMedia: '', lineupMediaType: 'image' });
      draft.activeSponsorIndex = draft.sponsors.length - 1;
    }, { immediate: true });
    toast('Novo patrocinador adicionado.');
    return;
  }
  if (action === 'select-sponsor') {
    commit(draft => { draft.activeSponsorIndex = clampNumber(target.dataset.value, 0, draft.sponsors.length - 1, 0); putSponsorOnAir(draft); }, { immediate: true });
    toast('Patrocinador selecionado e exibido.');
    return;
  }
  if (action === 'remove-sponsor') {
    if (state.sponsors.length <= 1) { toast('Mantenha pelo menos um patrocinador cadastrado.'); return; }
    commit(draft => {
      const index = draft.sponsors.findIndex(sponsor => sponsor.id === target.dataset.value);
      if (index < 0) return;
      draft.sponsors.splice(index, 1);
      draft.activeSponsorIndex = Math.min(draft.activeSponsorIndex, draft.sponsors.length - 1);
      const sponsor = activeSponsor(draft);
      draft.sponsor = sponsor.name;
      draft.sponsorBanner = sponsor.banner;
    }, { immediate: true });
    toast('Patrocinador removido.');
    return;
  }
  if (action === 'toggle-sponsor-loop') {
    commit(draft => {
      draft.sponsorLoop = !draft.sponsorLoop;
      if (draft.sponsorLoop) putSponsorOnAir(draft);
      else {
        const now = Date.now();
        draft.visible.sponsor = false;
        draft.sponsorExpiresAt = 0;
        draft.sponsorNextIndex = null;
        draft.sponsorTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorMotionDuration(draft.appearance) };
      }
    }, { immediate: true });
    toast(state.sponsorLoop ? 'Looping de patrocinadores iniciado.' : 'Looping de patrocinadores interrompido.');
    return;
  }
  if (action === 'remove-sponsor-banner') {
    commit(draft => { draft.sponsorBanner = ''; }, { immediate: true });
    toast('Arte 16:9 removida. O cartão de patrocinador continua disponível.');
    return;
  }
  if (action === 'remove-sponsor-lineup-media') {
    commit(draft => {
      const sponsor = draft.sponsors.find(item => item.id === target.dataset.value);
      if (!sponsor) return;
      sponsor.lineupMedia = '';
      sponsor.lineupMediaType = 'image';
    }, { immediate: true });
    toast('Mídia exclusiva removida. A escalação voltará a usar o logo ou banner da marca.');
    return;
  }
  if (action === 'overlay-event') {
    if (eventIsVisible()) commit(draft => { hideEventAnimated(draft); }, { immediate: true });
    else { drawer = { type: 'lower-third' }; render(); }
    return;
  }
  if (action === 'copy-url') { copyText(overlayUrl(target.dataset.value)); return; }
  if (action === 'open-output') { window.open(overlayUrl('all'), '_blank', 'noopener,noreferrer'); return; }
  if (action === 'open-preview') { window.open(`${location.origin}/preview?room=${encodeURIComponent(ROOM_ID)}`, '_blank', 'noopener,noreferrer'); }
}

app.addEventListener('toggle', event => {
  const champSection = event.target.closest?.('[data-champ-section]');
  if (champSection) championshipSectionsOpen[champSection.dataset.champSection] = champSection.open;
  const sidebarGroup = event.target.closest?.('[data-sidebar-group]');
  if (sidebarGroup) {
    sidebarGroupsOpen[sidebarGroup.dataset.sidebarGroup] = sidebarGroup.open;
    try { localStorage.setItem(SIDEBAR_GROUPS_KEY, JSON.stringify(sidebarGroupsOpen)); } catch {}
  }
  const section = event.target.closest?.('[data-settings-section]');
  if (section) settingsOpen[section.dataset.settingsSection] = section.open;
}, true);

let tacticalDrag = null;
app.addEventListener('pointerdown', event => {
  const dot = isAdminPanel ? event.target.closest?.('.tactical-player[data-player-id]') : null;
  const pitch = dot?.closest('.tactical-pitch');
  if (!dot || !pitch || event.button > 0) return;
  event.preventDefault();
  tacticalDrag = { dot, pitch, playerId: dot.dataset.playerId, teamKey: dot.dataset.squadTeam, point: null };
  dot.setPointerCapture?.(event.pointerId);
});
app.addEventListener('pointermove', event => {
  if (!tacticalDrag) return;
  const box = tacticalDrag.pitch.getBoundingClientRect();
  const x = clampNumber(((event.clientX - box.left) / box.width) * 100, 4, 96, 50);
  const y = clampNumber(((event.clientY - box.top) / box.height) * 100, 6, 94, 50);
  tacticalDrag.point = [Math.round(x), Math.round(y)];
  tacticalDrag.dot.style.setProperty('--player-x', `${tacticalDrag.point[0]}%`);
  tacticalDrag.dot.style.setProperty('--player-y', `${tacticalDrag.point[1]}%`);
});
const finishTacticalDrag = () => {
  const drag = tacticalDrag;
  tacticalDrag = null;
  if (!drag?.point) return;
  const team = teamForSquad(drag.teamKey);
  commit(draft => { ensureSquad(draft, team, Array.isArray(team?.athletes) ? team.athletes : []).positions[drag.playerId] = drag.point; }, { immediate: true });
};
app.addEventListener('pointerup', finishTacticalDrag);
app.addEventListener('pointercancel', finishTacticalDrag);

// ===== Builder: arrastar, redimensionar (com encaixe nas guias) e atalhos de teclado =====
let builderDrag = null;

function builderSnapPoints(item, skipId) {
  const xs = [0, 50, 100];
  const ys = [0, 50, 100];
  for (const other of item.elements) {
    if (other.id === skipId || !other.visible) continue;
    xs.push(other.x, other.x + other.w / 2, other.x + other.w);
    ys.push(other.y, other.y + other.h / 2, other.y + other.h);
  }
  return { xs, ys };
}

// Devolve o menor deslocamento que encosta algum dos pontos numa guia (até 0,8% do canvas).
function builderSnapDelta(points, candidates) {
  let best = null;
  for (const point of points) for (const candidate of candidates) {
    const delta = candidate - point;
    if (Math.abs(delta) <= 0.8 && (best === null || Math.abs(delta) < Math.abs(best.delta))) best = { delta, guide: candidate };
  }
  return best;
}

app.addEventListener('pointerdown', event => {
  if (!isAdminPanel || event.button > 0) return;
  let canvas = event.target.closest?.('[data-builder-canvas]');
  if (!canvas) return;
  const item = selectedCustomOverlay();
  if (!item) return;
  const handle = event.target.closest('[data-el-handle]');
  const node = event.target.closest('[data-el-id]');
  const shift = event.shiftKey;
  const start = { x: event.clientX, y: event.clientY };
  if (!handle && !node) { if (builderSelectedEl) { builderSelectedEl = ''; render(); } return; }
  event.preventDefault();
  const id = handle ? builderSelectedEl : node.dataset.elId;
  if (id !== builderSelectedEl) { builderSelectedEl = id; render(); canvas = document.querySelector('[data-builder-canvas]'); }
  const el = selectedBuilderElement(item);
  if (!el || el.locked || !canvas) return;
  builderDrag = { mode: handle ? 'resize' : 'move', handle: handle?.dataset.elHandle || '', id, box: canvas.getBoundingClientRect(), start, orig: { x: el.x, y: el.y, w: el.w, h: el.h }, next: null, shift, snaps: builderSnapPoints(item, id) };
});

app.addEventListener('pointermove', event => {
  if (!builderDrag) return;
  const drag = builderDrag;
  const dx = (event.clientX - drag.start.x) / drag.box.width * 100;
  const dy = (event.clientY - drag.start.y) / drag.box.height * 100;
  let { x, y, w, h } = drag.orig;
  let guideX = null;
  let guideY = null;
  if (drag.mode === 'move') {
    x += dx; y += dy;
    if (!event.altKey) {
      const snapX = builderSnapDelta([x, x + w / 2, x + w], drag.snaps.xs);
      const snapY = builderSnapDelta([y, y + h / 2, y + h], drag.snaps.ys);
      if (snapX) { x += snapX.delta; guideX = snapX.guide; }
      if (snapY) { y += snapY.delta; guideY = snapY.guide; }
    }
  } else {
    const handle = drag.handle;
    if (handle.includes('e')) w = drag.orig.w + dx;
    if (handle.includes('s')) h = drag.orig.h + dy;
    if (handle.includes('w')) { x = drag.orig.x + dx; w = drag.orig.w - dx; }
    if (handle.includes('n')) { y = drag.orig.y + dy; h = drag.orig.h - dy; }
    if ((event.shiftKey || drag.shift) && handle.length === 2) {
      const ratio = drag.orig.w / drag.orig.h;
      const scale = Math.max(w / drag.orig.w, h / drag.orig.h);
      w = drag.orig.w * scale; h = w / ratio;
      if (handle.includes('w')) x = drag.orig.x + drag.orig.w - w;
      if (handle.includes('n')) y = drag.orig.y + drag.orig.h - h;
    }
    if (!event.altKey) {
      const moving = handle.includes('e') ? [x + w] : handle.includes('w') ? [x] : [];
      const movingY = handle.includes('s') ? [y + h] : handle.includes('n') ? [y] : [];
      const snapX = moving.length ? builderSnapDelta(moving, drag.snaps.xs) : null;
      const snapY = movingY.length ? builderSnapDelta(movingY, drag.snaps.ys) : null;
      if (snapX) { if (handle.includes('e')) w += snapX.delta; else { x += snapX.delta; w -= snapX.delta; } guideX = snapX.guide; }
      if (snapY) { if (handle.includes('s')) h += snapY.delta; else { y += snapY.delta; h -= snapY.delta; } guideY = snapY.guide; }
    }
    w = Math.max(1, w); h = Math.max(1, h);
  }
  drag.next = { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, w: Math.round(w * 10) / 10, h: Math.round(h * 10) / 10 };
  for (const node of document.querySelectorAll(`[data-el-id="${drag.id}"], [data-el-selection]`)) {
    node.style.left = `${drag.next.x}%`; node.style.top = `${drag.next.y}%`; node.style.width = `${drag.next.w}%`; node.style.height = `${drag.next.h}%`;
  }
  const guideV = document.querySelector('[data-guide="v"]');
  const guideH = document.querySelector('[data-guide="h"]');
  if (guideV) { guideV.hidden = guideX === null; if (guideX !== null) guideV.style.left = `${guideX}%`; }
  if (guideH) { guideH.hidden = guideY === null; if (guideY !== null) guideH.style.top = `${guideY}%`; }
});

const finishBuilderDrag = () => {
  const drag = builderDrag;
  builderDrag = null;
  document.querySelectorAll('[data-guide]').forEach(guide => { guide.hidden = true; });
  if (!drag?.next) return;
  commitOverlay(item => { const el = item.elements.find(entry => entry.id === drag.id); if (el) Object.assign(el, drag.next); }, { immediate: true });
};
app.addEventListener('pointerup', finishBuilderDrag);
app.addEventListener('pointercancel', finishBuilderDrag);

document.addEventListener('keydown', event => {
  if (!isAdminPanel || managementModule !== 'builder' || event.ctrlKey && event.key !== 'd' || event.metaKey && event.key !== 'd') return;
  const tag = event.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
  const item = selectedCustomOverlay();
  const el = selectedBuilderElement(item);
  if (!el) return;
  const step = event.shiftKey ? 2 : 0.5;
  const arrows = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
  if (arrows[event.key] && !el.locked) {
    event.preventDefault();
    const [dx, dy] = arrows[event.key];
    commitOverlay(overlay => { const target = overlay.elements.find(entry => entry.id === el.id); if (target) { target.x = Math.round((target.x + dx) * 10) / 10; target.y = Math.round((target.y + dy) * 10) / 10; } }, { backup: false });
  } else if (event.key === 'Delete' || event.key === 'Backspace') {
    event.preventDefault();
    handleAction('builder-remove-el', { dataset: {} });
  } else if ((event.ctrlKey || event.metaKey) && event.key === 'd') {
    event.preventDefault();
    handleAction('builder-dup-el', { dataset: {} });
  } else if (event.key === 'Escape') {
    builderSelectedEl = '';
    render();
  }
});

app.addEventListener('click', event => {
  if (event.target.matches('[data-backdrop]')) { drawer = null; render(); return; }
  const actionable = event.target.closest('[data-action]');
  if (actionable) handleAction(actionable.dataset.action, actionable);
});

app.addEventListener('input', event => {
  const target = event.target;
  if (target.matches('[data-art-field]')) {
    const field = target.dataset.artField;
    setArtOption(field, target.type === 'checkbox' ? target.checked : target.value);
    if (field === 'championshipId') loadArtBundle(true);
    if (['title', 'text', 'topN', 'accent'].includes(field)) { clearTimeout(artTimer); scheduleArtRenderSoon(); return; }
    render();
    return;
  }
  if (target.matches('[data-public-search]')) {
    publicData.query = target.value;
    clearTimeout(publicSearchTimer);
    publicSearchTimer = setTimeout(loadPublicData, 250);
    return;
  }
  if (target.matches('[data-public-team]')) { publicData.team = target.value; render(); return; }
  if (target.matches('[data-sidebar-search]')) { sidebarSearch = target.value; render(); return; }
  if (target.matches('[data-access-search]')) { accessSearch = target.value; render(); return; }
  if (target.matches('[data-stats-possession]')) {
    const value = clampNumber(target.value, 0, 100, 50);
    commit(draft => { draft.stats.home.possession = value; draft.stats.away.possession = 100 - value; }, { backup: false });
    return;
  }
  if (target.matches('[data-stats-player]')) {
    const field = target.dataset.statsPlayer;
    commit(draft => {
      draft.statsPlayer ||= { team: 'home', name: '', note: '' };
      draft.statsPlayer[field] = field === 'team' ? (target.value === 'away' ? 'away' : 'home') : target.value.slice(0, field === 'name' ? 80 : 120);
    }, { backup: false });
    return;
  }
  if (target.matches('[data-pw-meter]')) {
    const meter = target.closest('.field')?.querySelector('.pw-meter');
    const level = passwordStrength(target.value);
    if (meter) { meter.dataset.level = String(level); meter.querySelector('span').textContent = target.value ? PASSWORD_LEVELS[level] : 'Mínimo de 8 caracteres'; }
    return;
  }
  if (target.matches('[data-ch-field]')) {
    championshipDraft ||= structuredClone(operationsData.championships.find(item => item.id === selectedChampionshipId) || blankChampionship());
    const path = target.dataset.chField.split('.');
    const value = target.dataset.chType === 'bool' ? target.checked : target.dataset.chType === 'number' ? Number(target.value) : target.value;
    let holder = championshipDraft;
    for (const key of path.slice(0, -1)) holder = holder[key] ||= {};
    holder[path[path.length - 1]] = value;
    if (['format', 'sport'].includes(path[0]) && target.matches('select')) { if (path[0] === 'format') fixtureOptions.mode = ''; render(); }
    return;
  }
  if (target.matches('[data-ch-team]')) {
    championshipDraft ||= structuredClone(operationsData.championships.find(item => item.id === selectedChampionshipId) || blankChampionship());
    const teams = new Set(championshipDraft.teamIds || []);
    if (target.checked) teams.add(target.dataset.chTeam); else teams.delete(target.dataset.chTeam);
    championshipDraft.teamIds = [...teams];
    document.querySelector('[data-champ-section="teams"] summary small')?.replaceChildren(`${championshipDraft.teamIds.length} selecionada(s)`);
    return;
  }
  if (target.matches('[data-ch-mod]')) {
    championshipDraft ||= structuredClone(operationsData.championships.find(item => item.id === selectedChampionshipId) || blankChampionship());
    const moderators = new Set(championshipDraft.moderators || []);
    if (target.checked) moderators.add(target.dataset.chMod); else moderators.delete(target.dataset.chMod);
    championshipDraft.moderators = [...moderators];
    return;
  }
  if (target.matches('[data-fx]')) {
    fixtureOptions[target.dataset.fx] = target.matches('[data-fx-bool]') ? target.checked : target.value;
    if (target.dataset.fx === 'mode') render();
    return;
  }
  const championshipFields = { 'championship-name': 'name', 'championship-season': 'season', 'championship-start': 'startDate', 'championship-end': 'endDate', 'championship-status': 'status' };
  if (championshipFields[target.id]) {
    championshipDraft ||= structuredClone(operationsData.championships.find(item => item.id === selectedChampionshipId) || { name: '', season: '', startDate: '', endDate: '', status: 'planned' });
    championshipDraft[championshipFields[target.id]] = target.value;
    return;
  }
  const matchFields = { 'match-championship': 'championshipId', 'operation-home': 'homeTeamId', 'operation-away': 'awayTeamId', 'match-kickoff': 'kickoffAt', 'match-status': 'status', 'match-round': 'round', 'match-venue': 'venue', 'match-room': 'room' };
  if (matchFields[target.id]) {
    matchDraft ||= structuredClone(operationsData.matches.find(item => item.id === selectedMatchId) || { championshipId: '', homeTeamId: '', awayTeamId: '', kickoffAt: '', status: 'scheduled', round: '', venue: '', room: '' });
    matchDraft[matchFields[target.id]] = target.value;
    return;
  }
  if (target.matches('[data-portal-team-field], [data-portal-athlete-field], [data-portal-staff-name], [data-portal-staff-role], [data-portal-coach-name]') && teamDelegation.status === 'completed') teamDelegation = { ...teamDelegation, status: 'needs-review' };
  if (target.matches('[data-custom-field]')) {
    const field = target.dataset.customField;
    commitOverlay(item => {
      if (field === 'width') item.width = clampNumber(target.value, 200, 3840, item.width);
      else if (field === 'height') item.height = clampNumber(target.value, 100, 2160, item.height);
      else if (field === 'canvasBg') item.canvasBg = safeColor(target.value, '');
      else if (field === 'autoHide') item.autoHide = clampNumber(target.value, 0, 3600, 0);
      else if (field === 'name') item.name = target.value.slice(0, 80);
    }, { backup: false });
    return;
  }
  if (target.matches('[data-el-field]')) {
    const field = target.dataset.elField;
    const value = target.type === 'checkbox' ? (field === 'transform' ? (target.checked ? 'uppercase' : 'none') : target.checked) : target.value;
    commitOverlay(item => {
      const el = item.elements.find(entry => entry.id === builderSelectedEl);
      if (!el) return;
      Object.assign(el, normalizedCustomElement({ ...el, [field]: value }, 0), { id: el.id });
    }, { backup: false });
    return;
  }
  if (target.matches('[data-reg-number]')) {
    const registration = teamPortalTeam?.registrations?.[teamPortalChampionshipId];
    if (!registration) return;
    const digits = target.value.replace(/\D/g, '').slice(0, 3);
    if (digits) registration.numbers[target.dataset.regNumber] = digits; else delete registration.numbers[target.dataset.regNumber];
    return;
  }
  if (target.matches('[data-reg-athlete], [data-reg-formation], [data-squad-match-formation]')) {
    if (!teamPortalTeam || !teamPortalChampionshipId) return;
    teamPortalTeam.registrations ||= {};
    const registration = teamPortalTeam.registrations[teamPortalChampionshipId] ||= { athleteIds: [], numbers: {}, formation: '' };
    if (target.matches('[data-reg-formation]')) registration.formation = FORMATIONS[target.value] ? target.value : '';
    else if (target.matches('[data-squad-match-formation]')) { const squad = portalMatchSquad(); if (squad) squad.formation = FORMATIONS[target.value] ? target.value : ''; }
    else {
      const id = target.dataset.regAthlete;
      registration.athleteIds = target.checked ? [...new Set([...registration.athleteIds, id])] : registration.athleteIds.filter(item => item !== id);
      if (!target.checked) { delete registration.numbers[id]; pruneChampionshipSquads(teamPortalChampionshipId, registration); }
    }
    render();
    return;
  }
  if (target.matches('[data-portal-sponsor-name]')) {
    const sponsor = teamPortalTeam?.sponsors?.find(item => item.id === target.dataset.portalSponsorName);
    if (sponsor) { sponsor.name = target.value.slice(0, 60); teamPortalStatus = 'ready'; }
    return;
  }
  if (target.matches('[data-portal-team-field]')) {
    const key = target.dataset.portalTeamField;
    if (!teamPortalTeam) return;
    teamPortalTeam[key] = key === 'short' ? target.value.toUpperCase().slice(0, 3) : key === 'color' || key === 'color2' ? safeColor(target.value, teamPortalTeam[key] || '#8253cd') : target.value.slice(0, 80);
    teamPortalStatus = 'ready';
    return;
  }
  if (target.matches('[data-championship-field]')) {
    const key = target.dataset.championshipField;
    commit(draft => { draft.championshipTheme[key] = key === 'name' ? target.value.slice(0, 80) : safeColor(target.value, draft.championshipTheme[key]); if (draft.championshipTheme.enabled && key === 'primary') { draft.theme = 'custom'; draft.customPrimary = draft.championshipTheme.primary; } if (draft.championshipTheme.enabled && key === 'secondary') { draft.theme = 'custom'; draft.customAccent = draft.championshipTheme.secondary; } }, { backup: false }); persistChampionshipTheme();
    return;
  }
  if (target.matches('[data-theme-override]')) {
    const key = target.dataset.themeOverride;
    commit(draft => { draft.championshipTheme.overrides[key] = { ...(draft.championshipTheme.overrides[key] || {}), primary: safeColor(target.value, draft.championshipTheme.primary) }; }, { backup: false }); persistChampionshipTheme();
    return;
  }
  if (target.matches('[data-portal-athlete-field]')) {
    const athlete = teamPortalTeam?.athletes?.find(item => item.id === target.dataset.athleteId);
    if (!athlete) return;
    const field = target.dataset.portalAthleteField;
    if (field === 'number') athlete.number = target.value.replace(/[^0-9a-z-]/gi, '').slice(0, 6);
    else if (field === 'height') athlete.height = target.value.replace(',', '.').replace(/[^0-9.]/g, '').slice(0, 5);
    else if (field === 'squadRole') athlete.squadRole = target.value === 'reserve' ? 'reserve' : 'starter';
    else if (field === 'position') athlete.position = target.value.toUpperCase().replace(/[^A-ZÀ-Ü0-9-]/g, '').slice(0, 6);
    else athlete.name = target.value.slice(0, 100);
    teamPortalStatus = 'ready';
    return;
  }
  if (target.matches('[data-portal-staff-name]') || target.matches('[data-portal-staff-role]')) {
    const memberId = target.dataset.portalStaffName || target.dataset.portalStaffRole;
    const member = teamPortalTeam?.staff?.find(item => item.id === memberId);
    if (!member) return;
    if (target.dataset.portalStaffRole) member.role = STAFF_ROLES.includes(target.value) ? target.value : 'Auxiliar técnico';
    else member.name = target.value.slice(0, 100);
    syncLegacyCoach(teamPortalTeam);
    teamPortalStatus = 'ready';
    return;
  }
  if (target.matches('[data-portal-coach-name]')) {
    teamPortalTeam.coach ||= { name: 'Treinador', photo: '' };
    teamPortalTeam.coach.name = target.value.slice(0, 100);
    teamPortalTeam.staff = normalizedStaff(teamPortalTeam);
    const headCoach = teamPortalTeam.staff.find(member => member.role === 'Treinador') || teamPortalTeam.staff[0];
    if (headCoach) headCoach.name = teamPortalTeam.coach.name;
    teamPortalStatus = 'ready';
    return;
  }
  if (target.matches('[data-lineup-coach-name]')) {
    const team = teamCatalog.find(item => item.id === target.dataset.lineupCoachName);
    if (!team) return;
    team.coach ||= { name: 'Treinador', photo: '' };
    team.coach.name = target.value.slice(0, 100);
    team.staff = normalizedStaff(team);
    const headCoach = team.staff.find(member => member.role === 'Treinador') || team.staff[0];
    if (headCoach) headCoach.name = team.coach.name;
    scheduleTeamCatalogPush();
    return;
  }
  if (target.matches('[data-lineup-staff-name]') || target.matches('[data-lineup-staff-role]')) {
    const team = teamCatalog.find(item => item.id === target.dataset.lineupTeamId);
    const memberId = target.dataset.lineupStaffName || target.dataset.lineupStaffRole;
    const member = team?.staff?.find(item => item.id === memberId);
    if (!member) return;
    if (target.dataset.lineupStaffRole) member.role = STAFF_ROLES.includes(target.value) ? target.value : 'Auxiliar técnico';
    else member.name = target.value.slice(0, 100);
    syncLegacyCoach(team);
    scheduleTeamCatalogPush();
    return;
  }
  if (target.matches('[data-lineup-athlete-position]')) {
    const team = teamCatalog.find(item => item.id === target.dataset.lineupTeamId);
    const athlete = team?.athletes?.find(item => item.id === target.dataset.lineupAthletePosition);
    if (!athlete) return;
    athlete.position = target.value.toUpperCase().replace(/[^A-ZÀ-Ü0-9-]/g, '').slice(0, 6);
    scheduleTeamCatalogPush();
    return;
  }
  if (target.matches('[data-catalog-field]')) {
    const team = teamCatalog.find(item => item.id === target.dataset.catalogId);
    if (!team) return;
    const field = target.dataset.catalogField;
    if (field === 'color') team.color = safeColor(target.value, team.color);
    else if (field === 'short') team.short = target.value.toUpperCase().slice(0, 3);
    else if (field === 'roster') {
      team.roster = target.value.slice(0, 12000);
      team.athletes = mergeAthletesFromRoster(team, team.roster);
    } else team[field] = target.value.slice(0, 80);
    scheduleTeamCatalogPush();
    commit(draft => { syncCatalogTeamToMatch(draft, team); }, { backup: false });
    return;
  }
  if (target.matches('[data-appearance]')) {
    const key = target.dataset.appearance;
    commit(draft => {
      const numericFields = ['scoreboardScale','scoreboardFont','scoreboardX','scoreboardY','scoreboardRadius','scoreboardSurface','scoreboardAccent','scoreboardAnimationSpeed','periodScale','periodFont','periodSurface','extraTimeScale','eventScale','eventFont','eventX','eventY','lineupScale','lineupFont','lineupX','lineupY','photoLineupScale','photoLineupFont','photoLineupX','photoLineupY','photoLineupSurface','photoLineupRadius','photoLineupSponsorCount','photoLineupSponsorBarSize','photoLineupFormationPhotoSize','photoLineupIndividualDuration','photoLineupPanelDuration','sponsorScale','sponsorFont','sponsorX','sponsorY','sponsorDuration','sponsorAnimationSpeed','sponsorBarDuration','sponsorBarAnimationSpeed','statsScale','statsFont','statsX','statsY','statsDuration','sponsorBarScale','sponsorBarX','sponsorBarY','sponsorBarOpacity','sponsorBarRadius','goalWordDuration','goalTeamDuration'];
      if (numericFields.includes(key)) {
        const isPosition = key.endsWith('X') || key.endsWith('Y');
        const bounds = {
          goalWordDuration: [1, 6], goalTeamDuration: [1, 6], sponsorDuration: [3, 60], sponsorBarDuration: [3, 60], scoreboardAnimationSpeed: [50, 160], sponsorAnimationSpeed: [50, 160], sponsorBarAnimationSpeed: [50, 160],
          scoreboardRadius: [0, 20], scoreboardSurface: [55, 100], scoreboardAccent: [0, 8], periodScale: [60,160], periodFont: [60,160], periodSurface: [55,100], extraTimeScale: [60,160], sponsorBarScale: [60, 180], statsDuration: [0, 60], sponsorBarOpacity: [20, 100], sponsorBarRadius: [0, 24],
          photoLineupSurface: [55, 100], photoLineupRadius: [0, 20], photoLineupSponsorCount: [1, 8], photoLineupSponsorBarSize: [60, 180], photoLineupFormationPhotoSize: [60, 200], photoLineupIndividualDuration: [2, 10], photoLineupPanelDuration: [3, 15],
        };
        const [minimum, maximum] = isPosition ? [0, 100] : bounds[key] || [60, 180];
        draft.appearance[key] = clampNumber(target.value, minimum, maximum, draft.appearance[key]);
        if (key === 'eventX') draft.appearance.eventPosition = 'custom';
        if (key === 'sponsorDuration' && draft.visible.sponsor) draft.sponsorExpiresAt = Date.now() + draft.appearance.sponsorDuration * 1000;
      }
      else if (key.endsWith('Typeface')) draft.appearance[key] = TYPEFACES[target.value] ? target.value : 'global';
      else if (OVERLAY_STYLE_OPTIONS[key]) draft.appearance[key] = OVERLAY_STYLE_OPTIONS[key].some(([value]) => value === target.value) ? target.value : OVERLAY_STYLE_OPTIONS[key][0][0];
      else if (key === 'goalAnimation') draft.appearance[key] = ['typewriter','bounce','sweep'].includes(target.value) ? target.value : 'typewriter';
      else if (key === 'scoreboardAnimation') draft.appearance[key] = ['assemble','slide','zoom','flip','elastic','glitch'].includes(target.value) ? target.value : 'assemble';
      else if (key === 'scoreboardShadow') draft.appearance.scoreboardShadow = ['none','soft','strong'].includes(target.value) ? target.value : 'soft';
      else if (key === 'sponsorAnimation') draft.appearance.sponsorAnimation = ['slide','zoom','flip','fade'].includes(target.value) ? target.value : 'slide';
      else if (key === 'sponsorBarTransition') draft.appearance.sponsorBarTransition = ['fade','slide','zoom','flip','elastic'].includes(target.value) ? target.value : 'fade';
      else if (key === 'sponsorBarFit') draft.appearance.sponsorBarFit = ['cover','contain'].includes(target.value) ? target.value : 'cover';
      else if (key === 'sponsorBarBackground') draft.appearance.sponsorBarBackground = safeColor(target.value, draft.appearance.sponsorBarBackground);
      else if (key === 'sponsorFormat') {
        draft.appearance.sponsorFormat = ['text','logo-name','banner','banner-name'].includes(target.value) ? target.value : 'banner-name';
        if (['banner','banner-name'].includes(draft.appearance.sponsorFormat) && Number(draft.appearance.sponsorX) > 72) draft.appearance.sponsorX = 70;
      }
      else if (key === 'goalText') draft.appearance[key] = target.value.slice(0, 16).toUpperCase();
    });
    return;
  }
  if (target.matches('[data-field]')) {
    const key = target.dataset.field;
    commit(draft => {
      draft[key] = key === 'extraTime' ? clampNumber(target.value, 0, 30, 0) : key === 'sponsorBarScheduleInterval' ? clampNumber(target.value, 1, 60, 5) : key.toLowerCase().includes('color') || key.startsWith('custom') ? safeColor(target.value, draft[key]) : target.value;
      if (key === 'customPrimary' || key === 'customAccent') draft.theme = 'custom';
    });
    return;
  }
  if (target.matches('[data-sponsor-name]')) {
    const sponsorId = target.dataset.sponsorName;
    commit(draft => {
      const sponsor = draft.sponsors.find(item => item.id === sponsorId);
      if (!sponsor) return;
      sponsor.name = target.value.slice(0, 80);
      if (activeSponsor(draft).id === sponsorId) draft.sponsor = sponsor.name;
    });
    return;
  }
  if (target.matches('[data-team-field]') && target.type !== 'file') {
    const key = target.dataset.teamField;
    commit(draft => {
      draft[target.dataset.team][key] = key === 'color' ? safeColor(target.value, draft[target.dataset.team][key]) : key === 'short' ? target.value.toUpperCase().slice(0, 3) : target.value;
    });
    const catalogId = state.selectedTeams?.[target.dataset.team];
    const team = teamCatalog.find(item => item.id === catalogId);
    if (team) {
      if (key === 'roster') {
        team.roster = target.value.slice(0, 12000);
        team.athletes = mergeAthletesFromRoster(team, team.roster);
      } else team[key] = state[target.dataset.team][key];
      scheduleTeamCatalogPush();
    }
  }
});

app.addEventListener('change', event => {
  const target = event.target;
  if (target.matches('[data-size-preset]')) {
    const [width, height] = String(target.value).split('x').map(Number);
    if (width && height) commitOverlay(item => { item.width = clampNumber(width, 200, 3840, item.width); item.height = clampNumber(height, 100, 2160, item.height); });
    return;
  }
  if (target.matches('#standings-championship')) { standingsChampionshipId = target.value; standingsSummaryId = ''; standingsLoadedAt = 0; standingsBundle = null; render(); return; }
  if (target.matches('[data-admin-role]')) {
    const id = target.dataset.adminRole;
    fetch('/api/auth/admin/accounts', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id, role: target.value }) })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (!ok) toast(data.error || 'Não foi possível alterar o papel.');
        else { accessAdmins = data.accounts; toast('Papel atualizado. Vale imediatamente para a sessão dessa conta.'); }
        render();
      })
      .catch(() => { toast('Falha de conexão ao alterar o papel.'); render(); });
    return;
  }
  if (target.matches('#active-match-switcher')) {
    const room = String(target.value || '').replace(/[^a-z0-9-]/gi, '').slice(0, 48);
    if (room && room !== ROOM_ID) {
      try { localStorage.setItem('juventude.overlay.lastRoom', room); } catch {}
      location.href = `${location.pathname}?room=${encodeURIComponent(room)}`;
    }
    return;
  }
  if (target.matches('[data-portal-team-logo], [data-portal-athlete-photo], [data-portal-staff-photo], [data-portal-coach-photo], [data-portal-formation]') && teamDelegation.status === 'completed') teamDelegation = { ...teamDelegation, status: 'needs-review' };
  if (target.matches('[data-teams-import]') && target.files?.[0]) {
    const file = target.files[0];
    if (file.size > 2_000_000) { toast('Planilha grande demais (máximo de 2 MB).'); return; }
    file.text().then(text => {
      const parsed = parseTeamsSpreadsheet(text);
      if (!parsed.length) { toast('Nenhuma equipe encontrada. Use o modelo de planilha.'); return; }
      const total = parsed.reduce((sum, team) => sum + team.athletes.length, 0);
      if (!confirm(`Importar ${parsed.length} equipe(s) e ${total} atleta(s)? Equipes com o mesmo nome são atualizadas; atletas com o mesmo número são sobrescritos.`)) return;
      let created = 0;
      let updated = 0;
      commitTeamCatalog(catalog => {
        for (const entry of parsed) {
          let team = catalog.find(item => item.name.toLocaleLowerCase('pt-BR') === entry.name.toLocaleLowerCase('pt-BR'));
          if (!team) {
            team = { id: `team-${Date.now().toString(36)}${created}`, name: entry.name, short: entry.short || entry.name.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || 'TIM', color: entry.color || '#8253cd', logo: '', roster: '', athletes: [], formation: '4-3-3', coach: { name: 'Treinador', photo: '' }, accessToken: accessToken() };
            catalog.push(team); created += 1;
          } else { updated += 1; if (entry.short) team.short = entry.short; if (entry.color) team.color = entry.color; }
          team.athletes ||= [];
          for (const athlete of entry.athletes) {
            const existing = team.athletes.find(item => String(item.number).trim() === athlete.number);
            if (existing) Object.assign(existing, athlete);
            else if (team.athletes.length < 100) team.athletes.push({ id: `atleta-${Date.now().toString(36)}${team.athletes.length}${Math.random().toString(36).slice(2, 4)}`, photo: '', ...athlete });
          }
          team.roster = team.athletes.filter(item => item.squadRole !== 'reserve').map(item => `${item.number} ${item.name}`).join('\n');
        }
      }, { immediate: true });
      toast(`Planilha importada: ${created} equipe(s) nova(s), ${updated} atualizada(s) e ${total} atleta(s).`);
    }).catch(() => toast('Não foi possível ler a planilha.'));
    target.value = '';
    return;
  }
  if (target.matches('[data-post-media]') && target.files?.[0]) {
    const file = target.files[0];
    const championshipId = document.getElementById('post-championship')?.value || 'geral';
    if (!file.type.startsWith('image/') || file.size > 5_000_000) { toast('Escolha uma imagem de até 5 MB.'); return; }
    fetch(`/api/assets/${encodeURIComponent(`feed-${championshipId}`.slice(0, 48))}/post-${Date.now().toString(36)}`, { method: 'PUT', headers: { 'content-type': file.type }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { postMediaUrl = result.url; toast('Imagem enviada.'); render(); })
      .catch(() => toast('Não foi possível enviar a imagem.'));
    return;
  }
  if (target.matches('[data-builder-import]') && target.files?.[0]) {
    const file = target.files[0];
    if (file.size > 1_000_000) { toast('Arquivo grande demais para um overlay exportado.'); return; }
    file.text().then(text => {
      const data = JSON.parse(text);
      if (data?.format !== 'juventude-overlay' || !data.overlay || typeof data.overlay !== 'object') throw new Error('formato');
      const source = data.overlay;
      if ((state.customOverlays || []).length >= 30) { toast('Limite de 30 overlays por partida.'); return; }
      let created = null;
      commit(draft => {
        created = { ...overlayFromTemplate({ key: 'import', name: 'Importado', width: clampNumber(source.width, 200, 3840, 1920), height: clampNumber(source.height, 100, 2160, 1080), elements: [] }, draft.customOverlays), name: String(source.name || 'Overlay importado').slice(0, 80), canvasBg: source.canvasBg ? safeColor(source.canvasBg, '') : '', autoHide: clampNumber(source.autoHide, 0, 3600, 0) };
        created.elements = normalizedCustomElements({ elements: Array.isArray(source.elements) ? source.elements : [] });
        draft.customOverlays.push(created);
      }, { immediate: true });
      selectedCustomOverlayId = created.id;
      builderSelectedEl = '';
      toast('Overlay importado.');
      render();
    }).catch(() => toast('Arquivo inválido: use um overlay exportado por este Builder.'));
    target.value = '';
    return;
  }
  if (target.matches('[data-el-media]') && target.files?.[0]) {
    const file = target.files[0];
    const [overlayId, elementId] = target.dataset.elMedia.split('|');
    const isVideo = file.type.startsWith('video/');
    if ((!isVideo && !file.type.startsWith('image/')) || file.size > 25_000_000) { toast('Escolha uma imagem ou vídeo de até 25 MB.'); return; }
    fetch(`/api/assets/${encodeURIComponent(ROOM_ID)}/custom-${encodeURIComponent(overlayId)}-${encodeURIComponent(elementId)}`, { method: 'PUT', headers: { 'content-type': file.type || (isVideo ? 'video/mp4' : 'image/png') }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => {
        commit(draft => {
          const item = draft.customOverlays.find(entry => entry.id === overlayId);
          const el = item?.elements.find(entry => entry.id === elementId);
          if (el) { el.src = `${result.url}?v=${Date.now()}`; el.type = isVideo ? 'video' : 'image'; }
        }, { immediate: true });
        toast('Mídia adicionada ao elemento.');
      })
      .catch(() => toast('Não foi possível enviar a mídia.'));
    return;
  }
  if (target.matches('[data-portal-team-logo]') && target.files?.[0]) {
    const file = target.files[0];
    if (!teamPortalTeam || file.size > 2_000_000) { toast('Escolha um escudo de até 2 MB.'); return; }
    fetch(`/api/assets/team-portals/${encodeURIComponent(teamPortalTeam.id)}-logo`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { teamPortalTeam.logo = `${result.url}?v=${Date.now()}`; teamPortalStatus = 'ready'; render(); })
      .catch(() => { teamPortalStatus = 'error'; render(); });
    return;
  }
  if (target.matches('[data-report-selection]')) { reportSelection = clampNumber(target.value, 0, state.completedReports.length, 0); render(); return; }
  if (target.matches('[data-portal-formation]')) { teamPortalTeam.formation = FORMATIONS[target.value] ? target.value : '4-3-3'; teamPortalStatus = 'ready'; return; }
  if (target.matches('[data-squad-called], [data-squad-starter], [data-squad-formation]')) {
    const team = teamForSquad(target.dataset.squadTeam || target.dataset.squadFormation);
    const athletes = Array.isArray(team?.athletes) ? team.athletes : [];
    const limit = currentSport().teamSize;
    if (target.matches('[data-squad-formation]')) {
      commit(draft => { ensureSquad(draft, team, athletes).formation = FORMATIONS[target.value] ? target.value : ''; }, { immediate: true });
      return;
    }
    const athleteKey = target.dataset.squadCalled || target.dataset.squadStarter;
    let blocked = false;
    commit(draft => {
      const squad = ensureSquad(draft, team, athletes);
      const has = list => list.includes(athleteKey);
      if (target.dataset.squadCalled) {
        if (target.checked) { if (!has(squad.called)) squad.called.push(athleteKey); }
        else { squad.called = squad.called.filter(id => id !== athleteKey); squad.starters = squad.starters.filter(id => id !== athleteKey); }
      } else if (target.checked) {
        if (squad.starters.length >= limit && !has(squad.starters)) { blocked = true; return; }
        if (!has(squad.called)) squad.called.push(athleteKey);
        if (!has(squad.starters)) squad.starters.push(athleteKey);
      } else {
        squad.starters = squad.starters.filter(id => id !== athleteKey);
      }
    }, { immediate: true });
    if (blocked) { toast(`Máximo de ${limit} titulares. Desmarque alguém antes.`); render(); }
    return;
  }
  if (target.matches('[data-lineup-formation]')) {
    const team = teamCatalog.find(item => item.id === target.dataset.lineupFormation);
    if (!team) return;
    team.formation = FORMATIONS[target.value] ? target.value : '4-3-3';
    scheduleTeamCatalogPush(true);
    commit(draft => { setPhotoLineupStage(draft, 'formation'); }, { backup: false, immediate: true });
    toast(`Esquema ${team.formation} selecionado.`);
    return;
  }
  if (target.matches('[data-lineup-athlete-role]')) {
    const team = teamCatalog.find(item => item.id === target.dataset.lineupTeamId);
    const athlete = team?.athletes?.find(item => item.id === target.dataset.lineupAthleteRole);
    if (!athlete) return;
    athlete.squadRole = target.value === 'reserve' ? 'reserve' : 'starter';
    scheduleTeamCatalogPush(true);
    render();
    return;
  }
  if (target.matches('#event-team')) { drawer.team = target.value === 'away' ? 'away' : 'home'; render(); return; }
  if (target.matches('#event-card-mode')) { drawer.cardMode = target.value === 'scoreboard' ? 'scoreboard' : 'lower-third'; return; }
  if (target.matches('#catalog-team-select')) { selectedCatalogTeamId = target.value; render(); return; }
  if (target.matches('[data-match-team]')) {
    const team = teamCatalog.find(item => item.id === target.value);
    if (!team) return;
    commit(draft => { applyCatalogTeam(draft, target.dataset.matchTeam, team); }, { immediate: true });
    toast(`${team.name} definido como ${target.dataset.matchTeam === 'home' ? 'mandante' : 'visitante'}.`);
    return;
  }
  if (target.matches('#roster-team')) { commit(draft => { draft.lineupTeam = target.value; }); return; }
  if (target.matches('[data-portal-staff-photo]') && target.files?.[0]) {
    const memberId = target.dataset.portalStaffPhoto;
    const member = teamPortalTeam?.staff?.find(item => item.id === memberId);
    if (!member) return;
    teamPortalStatus = 'saving';
    render();
    uploadTeamPresentationPhoto(teamPortalTeam, memberId, target.files[0])
      .then(url => { if (!url) return; member.photo = url; syncLegacyCoach(teamPortalTeam); teamPortalStatus = 'ready'; render(); })
      .catch(() => { teamPortalStatus = 'error'; render(); });
    return;
  }
  if (target.matches('[data-portal-csv-file]') && target.files?.[0]) {
    target.files[0].text().then(text => { const box = document.getElementById('portal-csv'); if (box) box.value = text.slice(0, 40000); toast('Planilha carregada. Revise e clique em "Importar elenco".'); });
    return;
  }
  if (target.matches('[data-portal-batch-photos]') && target.files?.length) {
    importBatchPhotos([...target.files]);
    return;
  }
  if (target.matches('[data-portal-athlete-photo]') && target.files?.[0]) {
    const file = target.files[0];
    if (file.size > 5_000_000) { toast('Escolha uma foto de até 5 MB.'); return; }
    const athleteIdValue = target.dataset.portalAthletePhoto;
    teamPortalStatus = 'saving';
    render();
    fetch(`/api/team-athlete-photo?team=${encodeURIComponent(teamSession.teamId)}&athlete=${encodeURIComponent(athleteIdValue)}`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => {
        const athlete = teamPortalTeam?.athletes?.find(item => item.id === athleteIdValue);
        if (athlete) athlete.photo = `${result.url}${String(result.url).includes('?') ? '&' : '?'}v=${Date.now()}`;
        teamPortalStatus = 'ready';
        render();
      })
      .catch(() => { teamPortalStatus = 'error'; render(); });
    return;
  }
  if (target.matches('[data-portal-coach-photo]') && target.files?.[0]) {
    const file = target.files[0];
    teamPortalStatus = 'saving';
    render();
    uploadTeamPresentationPhoto(teamPortalTeam, 'coach', file)
      .then(url => { if (!url) return; teamPortalTeam.coach ||= { name: 'Treinador', photo: '' }; teamPortalTeam.coach.photo = url; teamPortalTeam.staff = normalizedStaff(teamPortalTeam); const headCoach = teamPortalTeam.staff.find(member => member.role === 'Treinador') || teamPortalTeam.staff[0]; if (headCoach) headCoach.photo = url; teamPortalStatus = 'ready'; render(); })
      .catch(() => { teamPortalStatus = 'error'; render(); });
    return;
  }
  if (target.matches('[data-lineup-athlete-photo]') && target.files?.[0]) {
    const team = teamCatalog.find(item => item.id === target.dataset.lineupTeamId);
    const athlete = team?.athletes?.find(item => item.id === target.dataset.lineupAthletePhoto);
    if (!team || !athlete) return;
    uploadTeamPresentationPhoto(team, athlete.id, target.files[0])
      .then(url => { if (!url) return; athlete.photo = url; scheduleTeamCatalogPush(true); render(); toast(`Foto de ${athlete.name || 'atleta'} salva.`); })
      .catch(() => toast('Não foi possível enviar a foto do atleta.'));
    return;
  }
  if (target.matches('[data-lineup-staff-photo]') && target.files?.[0]) {
    const team = teamCatalog.find(item => item.id === target.dataset.lineupTeamId);
    const member = team?.staff?.find(item => item.id === target.dataset.lineupStaffPhoto);
    if (!team || !member) return;
    uploadTeamPresentationPhoto(team, member.id, target.files[0])
      .then(url => { if (!url) return; member.photo = url; syncLegacyCoach(team); scheduleTeamCatalogPush(true); render(); toast(`Foto de ${member.name || member.role} salva.`); })
      .catch(() => toast('Não foi possível enviar a foto da comissão.'));
    return;
  }
  if (target.matches('[data-lineup-coach-photo]') && target.files?.[0]) {
    const team = teamCatalog.find(item => item.id === target.dataset.lineupCoachPhoto);
    if (!team) return;
    uploadTeamPresentationPhoto(team, 'coach', target.files[0])
      .then(url => { if (!url) return; team.coach ||= { name: 'Treinador', photo: '' }; team.coach.photo = url; team.staff = normalizedStaff(team); const headCoach = team.staff.find(member => member.role === 'Treinador') || team.staff[0]; if (headCoach) headCoach.photo = url; scheduleTeamCatalogPush(true); render(); toast('Foto do treinador salva.'); })
      .catch(() => toast('Não foi possível enviar a foto do treinador.'));
    return;
  }
  if (target.matches('[data-catalog-logo]') && target.files?.[0]) {
    const file = target.files[0];
    if (file.size > 2_000_000) { toast('Escolha um escudo de até 2 MB.'); return; }
    const catalogId = target.dataset.catalogLogo;
    fetch(`/api/assets/catalog/${encodeURIComponent(catalogId)}-logo`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => {
        const team = teamCatalog.find(item => item.id === catalogId);
        if (!team) return;
        team.logo = `${result.url}?v=${Date.now()}`;
        scheduleTeamCatalogPush(true);
        commit(draft => { syncCatalogTeamToMatch(draft, team); }, { immediate: true });
        toast('Escudo salvo no cadastro do time.');
      })
      .catch(() => toast('Não foi possível enviar o escudo. Tente novamente.'));
    return;
  }
  if (target.matches('[data-sponsor-wide-video]') && target.files?.[0]) {
    const file = target.files[0];
    if (!file.type.startsWith('video/') || file.size > 50_000_000) { toast('Escolha um vídeo MP4 ou WebM de até 50 MB.'); return; }
    fetch(`/api/assets/${encodeURIComponent(ROOM_ID)}/sponsors-wide-video`, { method: 'PUT', headers: { 'content-type': file.type || 'video/mp4' }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { commit(draft => { draft.sponsorBarVideo = `${result.url}?v=${Date.now()}`; draft.sponsorBarMode = 'video'; }, { immediate: true }); toast('Vídeo da barra 1500 × 200 salvo.'); })
      .catch(() => toast('Não foi possível enviar o vídeo.'));
    return;
  }
  if (target.matches('[data-sponsor-wide-image]') && target.files?.[0]) {
    const file = target.files[0];
    const itemId = target.dataset.sponsorWideImage;
    if (!file.type.startsWith('image/') || file.size > 8_000_000) { toast('Escolha uma imagem de até 8 MB.'); return; }
    fetch(`/api/assets/${encodeURIComponent(ROOM_ID)}/${encodeURIComponent(itemId)}-wide`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { commit(draft => { const item = draft.sponsorBarItems.find(entry => entry.id === itemId); if (item) item.asset = `${result.url}?v=${Date.now()}`; draft.sponsorBarMode = 'images'; }, { immediate: true }); toast('Banner 1500 × 200 salvo na barra independente.'); })
      .catch(() => toast('Não foi possível enviar a imagem.'));
    return;
  }
  if (target.matches('[data-sponsor-lineup-media]') && target.files?.[0]) {
    const file = target.files[0];
    const sponsorId = target.dataset.sponsorLineupMedia || activeSponsor().id;
    const isVideo = file.type.startsWith('video/');
    if (!isVideo && !file.type.startsWith('image/')) { toast('Escolha uma imagem, MP4 ou WebM.'); return; }
    if (file.size > 25_000_000) { toast('Escolha uma mídia de até 25 MB.'); return; }
    syncStatus = 'syncing';
    updateSyncIndicator();
    fetch(`/api/assets/${encodeURIComponent(ROOM_ID)}/${encodeURIComponent(sponsorId)}-lineup-media`, { method: 'PUT', headers: { 'content-type': file.type || (isVideo ? 'video/mp4' : 'image/png') }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => {
        commit(draft => {
          const sponsor = draft.sponsors.find(item => item.id === sponsorId);
          if (!sponsor) return;
          sponsor.lineupMedia = `${result.url}?v=${Date.now()}`;
          sponsor.lineupMediaType = isVideo ? 'video' : 'image';
        }, { immediate: true });
        toast(`${isVideo ? 'Vídeo' : 'Imagem'} salvo para a faixa de patrocinadores da escalação.`);
      })
      .catch(() => { syncStatus = 'offline'; updateSyncIndicator(); toast('Não foi possível enviar a mídia da escalação. Tente novamente.'); });
    return;
  }
  if (target.matches('[data-sponsor-banner]') && target.files?.[0]) {
    const file = target.files[0];
    const sponsorId = target.dataset.sponsorBanner || activeSponsor().id;
    if (file.size > 5_000_000) { toast('Escolha uma arte de até 5 MB.'); return; }
    syncStatus = 'syncing';
    updateSyncIndicator();
    fetch(`/api/assets/${encodeURIComponent(ROOM_ID)}/${encodeURIComponent(sponsorId)}-banner`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => {
        commit(draft => {
          const sponsor = draft.sponsors.find(item => item.id === sponsorId);
          if (!sponsor) return;
          sponsor.banner = `${result.url}?v=${Date.now()}`;
          draft.activeSponsorIndex = draft.sponsors.findIndex(item => item.id === sponsorId);
          draft.sponsor = sponsor.name;
          draft.sponsorBanner = sponsor.banner;
          draft.appearance.sponsorFormat = 'banner-name';
          if (Number(draft.appearance.sponsorX) > 72) draft.appearance.sponsorX = 70;
          putSponsorOnAir(draft);
        }, { immediate: true });
        toast('Banner armazenado e exibido junto com o nome do patrocinador.');
      })
      .catch(() => { syncStatus = 'offline'; updateSyncIndicator(); toast('Não foi possível enviar o banner. Tente novamente.'); });
    return;
  }
  if (target.matches('[data-sponsor-logo]') && target.files?.[0]) {
    const file = target.files[0];
    const sponsorId = target.dataset.sponsorLogo || activeSponsor().id;
    if (file.size > 5_000_000) { toast('Escolha um logo de até 5 MB.'); return; }
    syncStatus = 'syncing';
    updateSyncIndicator();
    fetch(`/api/assets/${encodeURIComponent(ROOM_ID)}/${encodeURIComponent(sponsorId)}-logo`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => {
        commit(draft => {
          const sponsor = draft.sponsors.find(item => item.id === sponsorId);
          if (!sponsor) return;
          sponsor.logo = `${result.url}?v=${Date.now()}`;
          draft.activeSponsorIndex = draft.sponsors.findIndex(item => item.id === sponsorId);
          draft.sponsor = sponsor.name;
          draft.appearance.sponsorFormat = 'logo-name';
          putSponsorOnAir(draft);
        }, { immediate: true });
        toast('Logo salvo e exibido junto com o nome do patrocinador.');
      })
      .catch(() => { syncStatus = 'offline'; updateSyncIndicator(); toast('Não foi possível enviar o logo. Tente novamente.'); });
    return;
  }
  if (target.matches('[data-team-field="logo"]') && target.files?.[0]) {
    const file = target.files[0];
    if (file.size > 2_000_000) { toast('Escolha um escudo de até 2 MB.'); return; }
    const team = target.dataset.team;
    syncStatus = 'syncing';
    updateSyncIndicator();
    fetch(`/api/assets/${encodeURIComponent(ROOM_ID)}/${team}-logo`, { method: 'PUT', headers: { 'content-type': file.type || 'image/png' }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => {
        commit(draft => { draft[team].logo = `${result.url}?v=${Date.now()}`; }, { immediate: true });
        toast('Escudo armazenado e atualizado na transmissão.');
      })
      .catch(() => { syncStatus = 'offline'; updateSyncIndicator(); toast('Não foi possível enviar o escudo. Tente novamente.'); });
  }
});

document.addEventListener('keydown', event => {
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.target.matches('input, textarea, select, [contenteditable="true"]')) {
    event.preventDefault();
    handleAction('undo', { dataset: {} });
    return;
  }
  if (event.key === 'Escape') {
    if (drawer) { drawer = null; render(); }
    else commit(draft => { hideEventAnimated(draft); }, { immediate: true });
    return;
  }
  if (event.target.matches('input, textarea, select, [contenteditable="true"]')) {
    if (event.key === 'Enter' && drawer && event.target.tagName !== 'TEXTAREA') confirmEvent();
    else if (event.key === 'Enter' && event.target.matches('#admin-username, #admin-password, #admin-setup-token')) handleAction(adminSession.status === 'setup' ? 'admin-setup-submit' : 'admin-login-submit', { dataset: {} });
    else if (event.key === 'Enter' && event.target.matches('#team-username, #team-password')) handleAction('team-login-submit', { dataset: {} });
    return;
  }
  if (event.code === 'Space') { event.preventDefault(); toggleClock(); }
  if (event.key === '1') state.sport === 'volleyball' ? addVolleyPoint('home') : changeScore('home', 1, state.sport !== 'basketball');
  if (event.key === '2') state.sport === 'volleyball' ? addVolleyPoint('away') : changeScore('away', 1, state.sport !== 'basketball');
  if (event.key.toLowerCase() === 'l' && event.shiftKey) commit(draft => {
    const visible = !draft.visible.photoLineup;
    setPhotoLineupVisibility(draft, visible);
    if (visible && draft.visible.lineup) setLineupVisibility(draft, false);
  }, { immediate: true });
  else if (event.key.toLowerCase() === 'l') commit(draft => {
    const visible = !draft.visible.lineup;
    setLineupVisibility(draft, visible);
    if (visible && draft.visible.photoLineup) setPhotoLineupVisibility(draft, false);
  }, { immediate: true });
});

if (isOutput) { document.body.classList.add('overlay-output', 'obs-render-mode'); document.body.dataset.outputLayer = outputLayer; }
else if (isPreview) document.body.classList.add('preview-output');
else if (isTeamPortal) document.body.classList.add('team-portal-output');
if (isPublicPage) document.body.classList.add('public-page', new URLSearchParams(location.search).get('theme') === 'light' ? 'public-light' : 'public-dark');
render();
if ((isPublicPage || isTeamPortal) && 'serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
if (isPublicPage) initializePublicPage();
else if (isTeamPortal) checkTeamSession();
else {
  if (isAdminPanel) checkAdminSession();
  if (!isOutput) loadAppVersion();
  initializeSharedState();
  initializeTeamCatalog();
  pollSponsorLibrary();
  setInterval(pollSponsorLibrary, isOutput || isPreview ? 2500 : 4000);
  setInterval(pollServer, isOutput || isPreview ? 320 : 800);
  setInterval(pollTeamCatalog, isOutput || isPreview ? 1600 : 5000);
  if (isAdminPanel) setInterval(loadOperationsData, 5000);
  if (isAdminPanel) setInterval(loadLiveRooms, 3000);
  if (isAdminPanel) setInterval(() => loadStandingsRooms(), 15000);
  if (isAdminPanel) { loadPlatformOverlays(); setInterval(() => loadPlatformOverlays(), 10000); }
}
setInterval(() => {
  if (isTeamPortal || isPublicPage) return;
  if (isOutput) pruneSeenMotionStarts();
  const nextClock = clockText();
  if (nextClock !== lastClock) {
    document.querySelectorAll('[data-clock]').forEach(element => { element.textContent = nextClock; });
    lastClock = nextClock;
  }
  if (state.sport === 'basketball') {
    const remaining = shotClockSeconds();
    document.querySelectorAll('[data-shot-clock]').forEach(element => { element.textContent = remaining; });
    if (remaining === 0 && state.sportData.basketball.shotClock.running && !isOutput && !isPreview) {
      commit(draft => { draft.sportData.basketball.shotClock = { remaining: 0, running: false, startedAt: null }; });
    }
  }
  if (state.motion && state.motion.expiresAt <= Date.now()) {
    state.motion = null;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (state.scoreboardTransition && state.scoreboardTransition.expiresAt <= Date.now()) {
    state.scoreboardTransition = null;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (state.scoreboardMorph && state.scoreboardMorph.expiresAt <= Date.now()) {
    state.scoreboardMorph = null;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (state.visible.sponsor && state.sponsorExpiresAt && state.sponsorExpiresAt <= Date.now()) {
    if (state.sponsorLoop && state.sponsors.length > 1) {
      const now = Date.now();
      state.sponsorNextIndex = (Number(state.activeSponsorIndex || 0) + 1) % state.sponsors.length;
      state.visible.sponsor = false;
      state.sponsorExpiresAt = 0;
      state.sponsorTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorMotionDuration() };
    } else {
      const now = Date.now();
      state.visible.sponsor = false;
      state.sponsorExpiresAt = 0;
      state.sponsorTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorMotionDuration() };
    }
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false, immediate: true });
  }
  if (state.sponsorTransition && state.sponsorTransition.expiresAt <= Date.now()) {
    if (state.sponsorNextIndex !== null && state.sponsorNextIndex !== undefined && state.sponsorLoop) {
      state.activeSponsorIndex = clampNumber(state.sponsorNextIndex, 0, state.sponsors.length - 1, 0);
      state.sponsorNextIndex = null;
      putSponsorOnAir(state);
    } else {
      state.sponsorTransition = null;
      state.sponsorNextIndex = null;
    }
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (state.visible.stats && state.statsExpiresAt && state.statsExpiresAt <= Date.now()) {
    const now = Date.now();
    state.visible.stats = false;
    state.statsExpiresAt = 0;
    state.statsTransition = { type: 'exit', startedAt: now, expiresAt: now + statsMotionDuration() };
    if (isOutput || isPreview) render(); else commit(() => {}, { backup: false, immediate: true });
  }
  if (state.visible.sponsorBar && state.sponsorBarMode === 'images' && state.sponsorBarExpiresAt && state.sponsorBarExpiresAt <= Date.now()) {
    const now = Date.now();
    if (state.sponsorBarLoop && state.sponsorBarItems.length > 1) state.sponsorBarNextIndex = (Number(state.sponsorBarActiveIndex || 0) + 1) % state.sponsorBarItems.length;
    state.visible.sponsorBar = false;
    state.sponsorBarExpiresAt = 0;
    state.sponsorBarTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorBarMotionDuration() };
    if (isOutput || isPreview) render(); else commit(() => {}, { backup: false, immediate: true });
  }
  if (state.sponsorBarTransition && state.sponsorBarTransition.expiresAt <= Date.now()) {
    if (state.sponsorBarNextIndex !== null && state.sponsorBarNextIndex !== undefined && state.sponsorBarLoop) {
      state.sponsorBarActiveIndex = clampNumber(state.sponsorBarNextIndex, 0, Math.max(0, state.sponsorBarItems.length - 1), 0);
      state.sponsorBarNextIndex = null;
      putSponsorBarOnAir(state);
    } else {
      state.sponsorBarTransition = null;
      state.sponsorBarNextIndex = null;
    }
    if (isOutput || isPreview) render(); else commit(() => {}, { backup: false });
  }
  if (state.sponsorBarAutoSchedule && !state.visible.sponsorBar && !(state.sponsorBarTransition && Number(state.sponsorBarTransition.expiresAt || 0) > Date.now()) && state.sponsorBarScheduleNextAt && state.sponsorBarScheduleNextAt <= Date.now()) {
    putSponsorBarOnAir(state);
    state.sponsorBarExpiresAt = Date.now() + clampNumber(state.appearance?.sponsorBarDuration, 3, 60, 10) * 1000;
    state.sponsorBarScheduleNextAt = Date.now() + clampNumber(state.sponsorBarScheduleInterval, 1, 60, 5) * 60000;
    if (isOutput || isPreview) render(); else commit(() => {}, { backup: false, immediate: true });
  }
  if (state.lineupTransition && state.lineupTransition.expiresAt <= Date.now()) {
    state.lineupTransition = null;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (state.photoLineupTransition && state.photoLineupTransition.expiresAt <= Date.now()) {
    state.photoLineupTransition = null;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (state.photoLineupStageTransition && state.photoLineupStageTransition.expiresAt <= Date.now()) {
    state.photoLineupStageTransition = null;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (!isOutput && !isPreview && state.photoLineupAuto?.running && Number(state.photoLineupAuto.nextAt || 0) <= Date.now()) {
    commit(draft => { advancePhotoLineupSequence(draft); }, { backup: false, immediate: true });
  }
  if (state.goalGraphic && !state.goalGraphic.teamShown && state.goalGraphic.phaseEndsAt <= Date.now() && state.goalGraphic.expiresAt > Date.now()) {
    state.goalGraphic.teamShown = true;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false, immediate: true });
  }
  if (state.goalGraphic && !state.goalGraphic.exiting && state.goalGraphic.exitStartsAt <= Date.now() && state.goalGraphic.expiresAt > Date.now()) {
    state.goalGraphic.exiting = true;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false, immediate: true });
  }
  if (state.goalGraphic && state.goalGraphic.expiresAt <= Date.now()) {
    const now = Date.now();
    state.goalGraphic = null;
    state.scoreboardRecovery = { startedAt: now, expiresAt: now + 520 };
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (state.scoreboardCard && !state.scoreboardCard.exiting && state.scoreboardCard.exitStartsAt <= Date.now() && state.scoreboardCard.expiresAt > Date.now()) {
    state.scoreboardCard.exiting = true;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false, immediate: true });
  }
  if (state.scoreboardCard && state.scoreboardCard.expiresAt <= Date.now()) {
    const now = Date.now();
    state.scoreboardCard = null;
    state.scoreboardRecovery = { startedAt: now, expiresAt: now + 520 };
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if (state.scoreboardRecovery && state.scoreboardRecovery.expiresAt <= Date.now()) {
    state.scoreboardRecovery = null;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  }
  if ((state.customOverlays || []).length) {
    if (state.customOverlays.some(item => item.elements.some(el => el.type === 'text' && el.text.includes('{table.') || el.text.includes('{champ.')))) loadOverlayTable();
    const values = builderTokenValues();
    document.querySelectorAll('[data-cel-text]').forEach(node => {
      const next = resolveBuilderText(node.dataset.celText, values);
      if (node.textContent !== next) node.textContent = next;
    });
    const expired = state.customOverlays.find(item => item.visible && item.expiresAt && item.expiresAt <= Date.now());
    if (expired) {
      const now = Date.now();
      expired.visible = false;
      expired.expiresAt = 0;
      expired.transition = { type: 'exit', startedAt: now, expiresAt: now + customTransitionDuration(expired) };
      if (isOutput || isPreview) render(); else commit(() => {}, { backup: false });
    }
  }
  const finishedCustomTransition = (state.customOverlays || []).find(item => item.transition && item.transition.expiresAt <= Date.now());
  if (finishedCustomTransition) {
    finishedCustomTransition.transition = null;
    if (isOutput || isPreview) render(); else commit(() => {}, { backup: false });
  }
  if (state.activeEvent && state.eventExpiresAt && state.eventExpiresAt + 550 <= Date.now()) {
    state.activeEvent = null;
    state.eventExpiresAt = 0;
    if (isOutput || isPreview) render();
    else commit(() => {}, { backup: false });
  } else if (state.activeEvent && state.eventExpiresAt && state.eventExpiresAt <= Date.now() && eventPhase() === 'exiting') {
    render();
  }
}, 250);

window.__overlayStudio = {
  getState: () => structuredClone(state), outputLayer, isOutput, isPreview,
  setAdminSession(status, username) { adminSession = { status, username: username || null, error: '' }; render(); },
  refreshPlatformOverlays: () => loadPlatformOverlays(true),
  setTeamSession(status, teamId, teamName) { teamSession = { status, teamId: teamId || null, teamName: teamName || null, error: '' }; render(); },
};

document.addEventListener('keydown', event => {
  if (event.key !== '/' || event.ctrlKey || event.metaKey || event.altKey) return;
  const tag = event.target?.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
  const search = document.querySelector('[data-sidebar-search]');
  if (search) { event.preventDefault(); search.focus(); }
});
