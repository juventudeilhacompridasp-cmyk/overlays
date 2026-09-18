const initialParams = new URLSearchParams(location.search);
let requestedRoom = initialParams.get('room');
if (!requestedRoom) {
  try { requestedRoom = localStorage.getItem('juventude.overlay.lastRoom'); } catch {}
  if (location.pathname === '/') requestedRoom ||= `partida-${Math.random().toString(36).slice(2, 8)}`;
  if (requestedRoom) globalThis.history?.replaceState?.({}, '', `${location.pathname}?room=${encodeURIComponent(requestedRoom)}`);
}
const ROOM_ID = (requestedRoom || 'principal').toLowerCase().replace(/[^a-z0-9-]/g, '').slice(0, 48) || 'principal';
try { localStorage.setItem('juventude.overlay.lastRoom', ROOM_ID); } catch {}
const STORAGE_KEY = `juventude.overlay-studio.v2.${ROOM_ID}`;
const TEAM_CATALOG_KEY = 'juventude.overlay-team-catalog.v1';
const CHANNEL_NAME = `juventude-overlay-live.${ROOM_ID}`;
const channel = typeof BroadcastChannel === 'function' ? new BroadcastChannel(CHANNEL_NAME) : null;
const isOutput = location.pathname === '/overlay';
const isPreview = location.pathname === '/preview';
const isTeamPortal = location.pathname === '/team';
const isManagement = location.pathname === '/manage' || location.pathname.startsWith('/manage/');
const managementModule = isManagement ? (location.pathname.split('/').filter(Boolean)[1] || 'hub') : '';
const isAdminPanel = !isOutput && !isPreview && !isTeamPortal;
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
  { key: 'championships', label: 'Campeonatos', caption: 'Temporadas e organização das competições', layer: 'all', icon: icons.layers },
  { key: 'matches', label: 'Partidas', caption: 'Agenda e salas específicas de transmissão', layer: 'all', icon: icons.monitor },
  { key: 'scoreboard', label: 'Placar', caption: 'Resultado, tempo e formato', layer: 'scoreboard', icon: icons.monitor },
  { key: 'events', label: 'Eventos', caption: 'Gols, cartões, substituições e GC', layer: 'event', icon: icons.card },
  { key: 'lineup', label: 'Escalações', caption: 'Titulares, reservas, treinador e tática', layer: 'photo-lineup', icon: icons.users },
  { key: 'sponsors', label: 'Patrocinadores', caption: 'Marcas, formatos e looping', layer: 'sponsor', icon: icons.layers },
  { key: 'sponsor-bar', label: 'Barra de Patrocinadores', caption: 'Saída independente 1500 × 200', layer: 'sponsor-bar', icon: icons.layers },
  { key: 'builder', label: 'Builder de Overlays', caption: 'Crie saídas independentes sem desenvolvimento', layer: 'custom', icon: icons.layers },
  { key: 'pregame', label: 'Resumo pré-jogo', caption: 'Consulta rápida para narração', layer: 'all', icon: icons.list },
  { key: 'report', label: 'Relatório', caption: 'Histórico completo da partida', layer: 'all', icon: icons.text },
  { key: 'teams', label: 'Times', caption: 'Elencos e escudos', layer: 'all', icon: icons.list },
  { key: 'appearance', label: 'Aparência', caption: 'Estilos, posições e animações', layer: 'all', icon: icons.eye },
  { key: 'audit', label: 'Avisos e logs', caption: 'Delegações concluídas e histórico de ações', layer: 'all', icon: icons.list },
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
      roster,
      athletes,
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

const FORMATIONS = {
  '4-3-3': [[50,89],[17,70],[39,73],[61,73],[83,70],[27,48],[50,54],[73,48],[18,24],[50,18],[82,24]],
  '4-4-2': [[50,89],[17,70],[39,73],[61,73],[83,70],[17,45],[39,49],[61,49],[83,45],[36,20],[64,20]],
  '4-2-3-1': [[50,89],[17,70],[39,73],[61,73],[83,70],[37,55],[63,55],[18,35],[50,31],[82,35],[50,13]],
  '3-5-2': [[50,89],[25,70],[50,74],[75,70],[12,48],[35,51],[50,43],[65,51],[88,48],[35,19],[65,19]],
};

const TYPEFACES = {
  rajdhani: { label: 'Condensada', stack: "'Arial Narrow', 'Roboto Condensed', sans-serif" },
  oswald: { label: 'Impacto', stack: "Impact, Haettenschweiler, 'Arial Narrow Bold', sans-serif" },
  montserrat: { label: 'Moderna', stack: "Arial, 'Segoe UI', sans-serif" },
  orbitron: { label: 'Técnica', stack: "'Lucida Console', Monaco, monospace" },
};

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
    scoreboardScale: 100, scoreboardFont: 100, scoreboardTypeface: 'rajdhani', scoreboardX: 4, scoreboardY: 7, scoreboardLayout: 'compact', scoreboardStyle: 'classic', scoreboardRadius: 4, scoreboardSurface: 100, scoreboardAccent: 2, scoreboardShadow: 'soft', scoreboardAnimation: 'assemble', scoreboardAnimationSpeed: 100,
    eventScale: 100, eventFont: 100, eventTypeface: 'rajdhani', eventX: 2, eventY: 72, eventPosition: 'left', eventStyle: 'broadcast',
    lineupScale: 100, lineupFont: 100, lineupTypeface: 'rajdhani', lineupX: 7, lineupY: 18, lineupStyle: 'panel',
    photoLineupScale: 100, photoLineupFont: 100, photoLineupTypeface: 'rajdhani', photoLineupX: 7, photoLineupY: 12, photoLineupSurface: 96, photoLineupRadius: 2, photoLineupSponsorCount: 6, photoLineupSponsorBarSize: 100, photoLineupIndividualDuration: 3, photoLineupPanelDuration: 5, photoLineupStyle: 'editorial',
    sponsorScale: 100, sponsorFont: 100, sponsorTypeface: 'rajdhani', sponsorX: 78, sponsorY: 7, sponsorFormat: 'banner-name', sponsorAnimation: 'fade', sponsorAnimationSpeed: 100, sponsorDuration: 10, sponsorStyle: 'boxed',
    sponsorBarDuration: 10, sponsorBarAnimationSpeed: 100, sponsorBarTransition: 'fade', sponsorBarFit: 'cover', sponsorBarScale: 100, sponsorBarOpacity: 100, sponsorBarRadius: 0, sponsorBarBackground: '#08090d',
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
    visible: { scoreboard: true, sponsor: false, sponsorBar: false, lineup: false, photoLineup: false },
    sponsor: 'PATROCINADOR',
    sponsorBanner: '',
    sponsors: [{ id: 'sponsor-1', name: 'PATROCINADOR', banner: '', logo: '', wideAsset: '', lineupMedia: '', lineupMediaType: 'image' }],
    sponsorBarMode: 'images',
    sponsorBarVideo: '',
    sponsorBarItems: [{ id: 'bar-1', asset: '' }],
    sponsorBarActiveIndex: 0,
    sponsorBarLoop: false,
    sponsorBarTransition: null,
    sponsorBarExpiresAt: 0,
    sponsorBarNextIndex: null,
    customOverlays: [],
    activeSponsorIndex: 0,
    sponsorLoop: false,
    lineupTeam: 'home',
    photoLineupShowSponsors: true,
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
    appearance: { ...defaults.appearance, ...(saved.appearance || {}), sponsorFormat: ['text','logo-name','banner','banner-name'].includes(saved.appearance?.sponsorFormat) ? saved.appearance.sponsorFormat : defaults.appearance.sponsorFormat },
    sponsors: migratedSponsors,
    activeSponsorIndex: clampNumber(saved.activeSponsorIndex, 0, migratedSponsors.length - 1, 0),
    sponsorLoop: Boolean(saved.sponsorLoop),
    sponsorBarMode: saved.sponsorBarMode === 'video' ? 'video' : 'images',
    sponsorBarItems,
    sponsorBarActiveIndex: clampNumber(saved.sponsorBarActiveIndex, 0, Math.max(0, sponsorBarItems.length - 1), 0),
    sponsorBarLoop: Boolean(saved.sponsorBarLoop),
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
let adminSession = { status: isAdminPanel ? 'checking' : 'idle', username: null, error: '' };
let teamSession = { status: isTeamPortal ? 'checking' : 'idle', teamId: null, teamName: null, error: '' };
let teamLoginTeams = [];
let accessAdmins = [];
let accessTeamCredentials = [];
let accessStatus = 'idle';
let operationsData = { championships: [], matches: [], notifications: [], logs: [], delegationStatus: {}, updatedAt: 0 };
let operationsStatus = 'idle';
let selectedChampionshipId = '';
let selectedMatchId = '';
let championshipDraft = null;
let matchDraft = null;
let teamDelegation = { status: 'draft' };
let teamDelegationCompletion = { complete: false, missing: [] };
let lastClock = '';
let syncStatus = 'connecting';
let lastSyncAt = 0;
let consecutiveFailures = 0;
let outputFingerprints = {};
let moduleTab = 'information';
let reportSelection = 0;
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

function appearanceFont(key) {
  return TYPEFACES[state.appearance?.[key]] || TYPEFACES.rajdhani;
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

function motionOffset(startedAt, maximum) {
  // OBS receives state by polling. Replaying from a negative delay made the first
  // visible frame jump into the middle of the transition and look clipped.
  // Isolated browser outputs mount each changed layer once, so they can safely
  // play the complete GPU animation from its first frame.
  if (isOutput) return 0;
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

function lineupGroups(team = activeLineupTeam()) {
  const matchTeam = state[state.lineupTeam] || state.home;
  const athletes = Array.isArray(team?.athletes) && team.athletes.length ? team.athletes : athletesFromRoster(matchTeam.roster);
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
  </div>`;
}

function previewCompositeMarkup() {
  return ['scoreboard','event','sponsor','sponsor-bar','lineup','photo-lineup'].map(layer => overlayMarkup(layer)).join('');
}

function renderTeamScorebug(team, key, options = {}) {
  const volleyball = state.sportData.volleyball;
  const basketball = state.sportData.basketball;
  const hasServe = state.sport === 'volleyball' && volleyball.serve === key;
  const hasPossession = state.sport === 'basketball' && basketball.possession === key;
  const name = options.expanded ? team.name.toUpperCase() : team.short.slice(0, 3).toUpperCase();
  return `<div class="scorebug-team ${hasServe || hasPossession ? 'has-possession' : ''}">${options.expanded ? `<i class="scorebug-dot" style="--dot-color:${safeColor(team.color)}"></i>` : ''}<span class="scorebug-team-name">${escapeHtml(name)}</span>${hasServe ? '<i class="serve-indicator" title="Saque">●</i>' : ''}${hasPossession ? '<i class="possession-arrow" title="Posse">◀</i>' : ''}${options.showSets ? `<span class="scorebug-sets">${volleyball.sets[key]}</span>` : ''}</div>`;
}

function renderSportScorebug() {
  const appearance = state.appearance || defaultAppearance();
  const layout = appearance.scoreboardLayout === 'expanded' ? 'expanded' : 'compact';
  const volleyball = state.sportData.volleyball;
  const futsal = state.sportData.futsal;
  const basketball = state.sportData.basketball;
  const showSets = state.sport === 'volleyball';
  const home = renderTeamScorebug(state.home, 'home', { showSets, expanded: layout === 'expanded' });
  const away = renderTeamScorebug(state.away, 'away', { showSets, expanded: layout === 'expanded' });
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

function renderSponsorBarOverlay() {
  const appearance = state.appearance || defaultAppearance();
  const sponsor = activeSponsorBar();
  const transition = state.sponsorBarTransition && Number(state.sponsorBarTransition.expiresAt || 0) > Date.now() ? state.sponsorBarTransition.type : '';
  const transitionStyle = ['fade', 'slide', 'zoom'].includes(appearance.sponsorBarTransition) ? appearance.sponsorBarTransition : 'fade';
  const transitionClass = transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'} sponsor-animation-${transitionStyle}` : '';
  const duration = sponsorBarMotionDuration();
  const offset = motionOffset(state.sponsorBarTransition?.startedAt || (Number(state.sponsorBarTransition?.expiresAt || 0) - duration), duration);
  const videoMode = state.sponsorBarMode === 'video' && state.sponsorBarVideo;
  const asset = sponsor.asset;
  const media = videoMode
    ? `<video class="sponsor-wide-media sponsor-fit-${escapeHtml(appearance.sponsorBarFit || 'cover')}" src="${escapeHtml(state.sponsorBarVideo)}" autoplay muted loop playsinline preload="auto" aria-label="Vídeo da barra de patrocinadores"></video>`
    : asset ? `<img class="sponsor-wide-media sponsor-fit-${escapeHtml(appearance.sponsorBarFit || 'cover')}" src="${escapeHtml(asset)}" alt="Banner de patrocinador">` : `<div class="sponsor-wide-placeholder"><strong>BARRA DE PATROCINADORES</strong><small>1500 × 200</small></div>`;
  return `<div class="sponsor-wide-bar sponsor-style-${escapeHtml(appearance.sponsorStyle || 'boxed')}${transitionClass}" style="--sponsor-motion-duration:${duration}ms;--sponsor-motion-offset:${offset}ms;--sponsor-bar-scale:${clampNumber(appearance.sponsorBarScale, 60, 180, 100) / 100};--sponsor-bar-opacity:${clampNumber(appearance.sponsorBarOpacity, 20, 100, 100) / 100};--sponsor-bar-radius:${clampNumber(appearance.sponsorBarRadius, 0, 24, 0)}px;--sponsor-bar-background:${safeColor(appearance.sponsorBarBackground, '#08090d')};${overlayThemeStyle('sponsorBar')}" data-overlay="sponsor-bar">${media}</div>`;
}

function customOverlayMarkup(item, preview = false) {
  if (!item) return '<div class="broadcast-layer custom-overlay-output"></div>';
  const transition = item.transition && Number(item.transition.expiresAt || 0) > Date.now() ? item.transition.type : '';
  if (!preview && !item.visible && transition !== 'exit') return '<div class="broadcast-layer custom-overlay-output"></div>';
  const media = item.media ? (item.mediaType === 'video'
    ? `<video src="${escapeHtml(item.media)}" autoplay muted loop playsinline preload="auto"></video>`
    : `<img src="${escapeHtml(item.media)}" alt="">`) : '<div class="custom-overlay-placeholder">MÍDIA</div>';
  const text = `<div class="custom-overlay-copy">${item.title ? `<strong>${escapeHtml(item.title)}</strong>` : ''}${item.subtitle ? `<span>${escapeHtml(item.subtitle)}</span>` : ''}</div>`;
  const content = item.layout === 'media' ? media : item.layout === 'text' ? text : `${media}${text}`;
  return `<div class="broadcast-layer custom-overlay-output"><section class="custom-overlay custom-layout-${escapeHtml(item.layout)} custom-animation-${escapeHtml(item.animation)}${transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'}` : ''}" style="--custom-bg:${safeColor(item.background, '#10131a')};--custom-accent:${safeColor(item.accent, '#2f7df6')};--custom-text:${safeColor(item.textColor, '#ffffff')}" data-overlay="custom">${content}</section></div>`;
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
    const formation = FORMATIONS[team.formation] ? team.formation : '4-3-3';
    const points = FORMATIONS[formation];
    content = `<div class="tactical-board"><div class="tactical-pitch"><i class="pitch-half"></i><i class="pitch-circle"></i>${starters.map((player, index) => { const point = points[index] || [50, 50]; return `<article class="tactical-player" style="--player-x:${point[0]}%;--player-y:${point[1]}%;--player-index:${index}"><b>${escapeHtml(player.number || String(index + 1))}</b><span><strong>${escapeHtml(String(player.name || `Atleta ${index + 1}`).split(/\s+/).slice(-1)[0])}</strong><small>${escapeHtml(player.position || 'TIT')}</small></span></article>`; }).join('')}</div><aside><small>FORMAÇÃO</small><strong>${escapeHtml(formation)}</strong><span>${escapeHtml(matchTeam.short)} · ${starters.length} TITULARES</span></aside></div>`;
  }
  return `<section class="photo-lineup photo-lineup-style-${escapeHtml(state.appearance?.photoLineupStyle || 'editorial')} photo-lineup-stage-${escapeHtml(stage)}${transition ? ` is-${transition === 'enter' ? 'entering' : 'exiting'}` : ''}${stageActive ? ' is-stage-changing' : ''}${playerDirection ? ` is-player-${escapeHtml(playerDirection)}` : ''}" style="--photo-lineup-motion-offset:${lineupOffset}ms;--photo-lineup-stage-offset:${stageOffset}ms;--photo-team-color:${safeColor(matchTeam.color)}" data-overlay="photo-lineup" data-stage="${escapeHtml(stage)}"><header class="photo-lineup-head"><div class="photo-lineup-team-mark">${matchTeam.logo ? `<img src="${escapeHtml(matchTeam.logo)}" alt="Escudo ${escapeHtml(matchTeam.name)}">` : escapeHtml(matchTeam.short)}</div><div><h2>${escapeHtml(matchTeam.name.toUpperCase())}</h2></div>${labels[stage] ? `<span>${escapeHtml(labels[stage])}</span>` : ''}</header><div class="photo-lineup-body">${content}</div>${sponsorFooter}</section>`;
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
    adminSession = { status: data.authenticated ? 'authenticated' : 'login', username: data.username || null, error: '' };
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
    adminSession = { status: 'authenticated', username: data.username, error: '' };
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
  if (managementModule !== 'access') return;
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
      logs: Array.isArray(data.logs) ? data.logs : [],
      delegationStatus: data.delegationStatus && typeof data.delegationStatus === 'object' ? data.delegationStatus : {},
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
  } catch {
    operationsStatus = 'error';
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
      method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name: teamPortalTeam.name, short: teamPortalTeam.short, color: teamPortalTeam.color, logo: teamPortalTeam.logo, athletes: teamPortalTeam.athletes, staff: teamPortalTeam.staff, coach: teamPortalTeam.coach, formation: teamPortalTeam.formation }),
    });
    if (response.status === 401) { teamSession = { status: 'login', teamId: null, teamName: null, error: 'Sessão expirada. Entre novamente.' }; render(); return; }
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    teamPortalTeam = normalizeTeamCatalog([data.team])[0];
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

function receiveState(incoming) {
  if (!incoming || typeof incoming !== 'object' || !incoming.updatedAt || Number(incoming.updatedAt) <= Number(state.updatedAt)) return;
  state = normalizeState(incoming);
  if (teamCatalogState.globalAppearance) applyGlobalAppearance(state, teamCatalogState.globalAppearance);
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

function renderMatchTab() {
  const sport = currentSport();
  const unit = sport.scoring.toLowerCase();
  const scoreboardLayout = state.appearance?.scoreboardLayout === 'expanded' ? 'expanded' : 'compact';
  return `<div class="field"><label for="competition">Competição</label><input id="competition" data-field="competition" value="${escapeHtml(state.competition)}"></div>
    <div class="scoreboard-layout-control"><span>Formato do placar</span><div role="group" aria-label="Formato do placar"><button class="layout-choice ${scoreboardLayout === 'compact' ? 'active' : ''}" data-action="scoreboard-layout" data-value="compact" aria-pressed="${scoreboardLayout === 'compact'}"><strong>Compacto</strong><small>3 letras + placar + tempo</small></button><button class="layout-choice ${scoreboardLayout === 'expanded' ? 'active' : ''}" data-action="scoreboard-layout" data-value="expanded" aria-pressed="${scoreboardLayout === 'expanded'}"><strong>Aberto</strong><small>Nome completo das equipes</small></button></div></div>
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
    <div class="team-catalog"><div class="team-catalog-head"><div><strong>Cadastro de times</strong><small>Biblioteca permanente para todas as partidas.</small></div><button class="button subtle" data-action="add-team">+ Novo time</button></div>
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

function renderAccessModule() {
  if (accessStatus === 'loading' || accessStatus === 'idle') return '<div class="module-section"><div class="portal-empty">Carregando acessos…</div></div>';
  if (accessStatus === 'error') return '<div class="module-section"><div class="portal-empty">Não foi possível carregar os acessos. Recarregue a página.</div></div>';
  const adminRows = accessAdmins.map(account => `<article class="access-row access-row-compact"><div><strong>${escapeHtml(account.username)}</strong><small>Acesso completo ao painel</small></div><button class="button square subtle" data-action="remove-admin-account" data-value="${escapeHtml(account.id)}" ${accessAdmins.length <= 1 ? 'disabled' : ''} aria-label="Remover ${escapeHtml(account.username)}">${icons.close}</button></article>`).join('') || '<div class="portal-empty">Nenhum administrador cadastrado.</div>';
  const credentialByTeam = new Map(accessTeamCredentials.map(entry => [entry.teamId, entry]));
  const teamRows = teamCatalog.map(team => {
    const entry = credentialByTeam.get(team.id);
    const id = escapeHtml(team.id);
    return `<article class="access-row"><div class="access-row-head"><div><strong>${escapeHtml(team.name)}</strong><small class="${entry ? 'access-linked' : ''}">${entry ? `Usuário vinculado: ${escapeHtml(entry.username)}` : 'Nenhum usuário vinculado'}</small></div>${entry ? `<button class="button square subtle" data-action="remove-team-credentials" data-value="${id}" aria-label="Remover acesso de ${escapeHtml(team.name)}">${icons.close}</button>` : ''}</div>
      <div class="field-row"><div class="field"><label for="access-username-${id}">Usuário</label><input id="access-username-${id}" name="acesso-time-${id}" maxlength="40" autocomplete="off" placeholder="${entry ? escapeHtml(entry.username) : 'ex: gestor.time'}"></div><div class="field"><label for="access-password-${id}">Senha · visível para conferência</label><input id="access-password-${id}" name="chave-time-${id}" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="mínimo 8 caracteres"></div></div>
      <button class="button subtle access-row-save" data-action="set-team-credentials" data-value="${id}">${entry ? 'Atualizar acesso' : 'Vincular acesso'}</button></article>`;
  }).join('') || '<div class="portal-empty">Nenhum time cadastrado.</div>';
  return `<div class="module-section"><div class="section-header"><div><h3 class="section-title">Administradores do painel</h3><p class="help-text">Contas com acesso completo ao painel e a todos os times cadastrados.</p></div></div>
    <div class="team-catalog"><div class="team-catalog-head"><div><strong>${accessAdmins.length} administrador${accessAdmins.length === 1 ? '' : 'es'}</strong><small>É necessário manter pelo menos um administrador ativo.</small></div></div>
      <div class="access-list">${adminRows}</div>
      <div class="field-row"><div class="field"><label for="access-admin-username">Novo usuário</label><input id="access-admin-username" name="acesso-admin-usuario" maxlength="40" autocomplete="off" placeholder="ex: leonardo.adm"></div><div class="field"><label for="access-admin-password">Senha · visível para conferência</label><input id="access-admin-password" name="chave-admin" type="text" maxlength="200" autocomplete="off" spellcheck="false" placeholder="mínimo 8 caracteres"></div></div>
      <button class="button primary access-row-save" data-action="add-admin-account">+ Adicionar administrador</button></div></div>
    <div class="module-section"><div class="section-header"><div><h3 class="section-title">Usuários dos times</h3><p class="help-text">Cada time acessa <strong>/team</strong> com o usuário e a senha vinculados aqui para cadastrar atletas, fotos e comissão técnica.</p></div></div>
      <div class="team-catalog"><div class="team-catalog-head"><div><strong>${teamCatalog.length} time${teamCatalog.length === 1 ? '' : 's'} cadastrado${teamCatalog.length === 1 ? '' : 's'}</strong><small>Salvar novamente substitui o usuário e a senha anteriores do time.</small></div></div>
        <div class="access-list">${teamRows}</div></div></div>`;
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

function renderChampionshipsModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const selected = operationsData.championships.find(item => item.id === selectedChampionshipId) || null;
  const editor = championshipDraft || selected || { name: '', season: '', startDate: '', endDate: '', status: 'planned' };
  const list = operationsData.championships.map(item => `<button class="operations-item ${item.id === selected?.id ? 'active' : ''}" data-action="select-championship" data-value="${escapeHtml(item.id)}"><span><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.season || 'Temporada não informada')} · ${operationDate(item.startDate)} → ${operationDate(item.endDate)}</small></span><b>${item.status === 'active' ? 'Em andamento' : item.status === 'finished' ? 'Encerrado' : 'Planejado'}</b></button>`).join('') || '<div class="portal-empty">Nenhum campeonato cadastrado.</div>';
  return `<div class="operations-layout"><section class="operations-list"><div class="operations-list-head"><div><strong>Campeonatos</strong><small>${operationsData.championships.length} cadastrado${operationsData.championships.length === 1 ? '' : 's'}</small></div><button class="button primary" data-action="new-championship">+ Novo</button></div>${list}</section><section class="operations-editor"><div class="section-header"><div><h3 class="section-title">${selected ? 'Editar campeonato' : 'Novo campeonato'}</h3><p class="help-text">O campeonato organiza temporadas, partidas e a identidade usada na transmissão.</p></div></div><div class="field"><label for="championship-name">Nome</label><input id="championship-name" maxlength="100" value="${escapeHtml(editor.name || '')}" placeholder="Ex.: Campeonato Municipal"></div><div class="field-row"><div class="field"><label for="championship-season">Temporada</label><input id="championship-season" maxlength="40" value="${escapeHtml(editor.season || '')}" placeholder="2026"></div><div class="field"><label for="championship-status">Status</label><select id="championship-status"><option value="planned" ${editor.status === 'planned' ? 'selected' : ''}>Planejado</option><option value="active" ${editor.status === 'active' ? 'selected' : ''}>Em andamento</option><option value="finished" ${editor.status === 'finished' ? 'selected' : ''}>Encerrado</option></select></div></div><div class="field-row"><div class="field"><label for="championship-start">Início</label><input id="championship-start" type="date" value="${escapeHtml(editor.startDate || '')}"></div><div class="field"><label for="championship-end">Fim</label><input id="championship-end" type="date" value="${escapeHtml(editor.endDate || '')}"></div></div><div class="operations-actions"><button class="button primary" data-action="save-championship" data-value="${escapeHtml(selected?.id || '')}">Salvar campeonato</button>${selected ? '<button class="button subtle danger" data-action="delete-championship" data-value="' + escapeHtml(selected.id) + '">Excluir</button>' : ''}</div></section></div>`;
}

function renderMatchesModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const selected = operationsData.matches.find(item => item.id === selectedMatchId) || null;
  const editor = matchDraft || selected || { championshipId: '', homeTeamId: '', awayTeamId: '', kickoffAt: '', status: 'scheduled', round: '', venue: '', room: '' };
  const teamOptions = value => teamCatalog.map(team => `<option value="${escapeHtml(team.id)}" ${team.id === value ? 'selected' : ''}>${escapeHtml(team.name)}</option>`).join('');
  const championshipOptions = operationsData.championships.map(item => `<option value="${escapeHtml(item.id)}" ${item.id === editor.championshipId ? 'selected' : ''}>${escapeHtml(item.name)}${item.season ? ` · ${escapeHtml(item.season)}` : ''}</option>`).join('');
  const sorted = [...operationsData.matches].sort((a, b) => String(a.kickoffAt || '').localeCompare(String(b.kickoffAt || '')));
  const list = sorted.map(item => `<article class="match-operation-card ${item.id === selected?.id ? 'active' : ''}"><button data-action="select-match" data-value="${escapeHtml(item.id)}"><span>${escapeHtml(operationChampionshipName(item.championshipId))} · ${escapeHtml(item.round || 'Rodada')}</span><strong>${escapeHtml(operationTeamName(item.homeTeamId))} <b>×</b> ${escapeHtml(operationTeamName(item.awayTeamId))}</strong><small>${operationDate(item.kickoffAt, true)} · ${escapeHtml(item.venue || 'Local não informado')}</small></button><a class="button subtle" href="/?room=${encodeURIComponent(item.room)}">Abrir transmissão</a></article>`).join('') || '<div class="portal-empty">Nenhuma partida agendada.</div>';
  return `<div class="operations-layout"><section class="operations-list"><div class="operations-list-head"><div><strong>Agenda de partidas</strong><small>${operationsData.matches.length} partida${operationsData.matches.length === 1 ? '' : 's'}</small></div><button class="button primary" data-action="new-operation-match">+ Nova</button></div>${list}</section><section class="operations-editor"><div class="section-header"><div><h3 class="section-title">${selected ? 'Editar partida' : 'Nova partida'}</h3><p class="help-text">Cada partida recebe uma sala própria. Placar, eventos, escalações e URLs do OBS ficam isolados nessa sala.</p></div></div>${operationsData.championships.length ? `<div class="field"><label for="match-championship">Campeonato</label><select id="match-championship"><option value="">Selecione</option>${championshipOptions}</select></div><div class="field-row"><div class="field"><label for="operation-home">Mandante</label><select id="operation-home"><option value="">Selecione</option>${teamOptions(editor.homeTeamId)}</select></div><div class="field"><label for="operation-away">Visitante</label><select id="operation-away"><option value="">Selecione</option>${teamOptions(editor.awayTeamId)}</select></div></div><div class="field-row"><div class="field"><label for="match-kickoff">Data e horário</label><input id="match-kickoff" type="datetime-local" value="${escapeHtml(editor.kickoffAt || '')}"></div><div class="field"><label for="match-status">Status</label><select id="match-status"><option value="scheduled" ${editor.status === 'scheduled' ? 'selected' : ''}>Agendada</option><option value="live" ${editor.status === 'live' ? 'selected' : ''}>Ao vivo</option><option value="finished" ${editor.status === 'finished' ? 'selected' : ''}>Finalizada</option><option value="cancelled" ${editor.status === 'cancelled' ? 'selected' : ''}>Cancelada</option></select></div></div><div class="field-row"><div class="field"><label for="match-round">Rodada / fase</label><input id="match-round" maxlength="60" value="${escapeHtml(editor.round || '')}" placeholder="Ex.: Semifinal"></div><div class="field"><label for="match-venue">Local</label><input id="match-venue" maxlength="120" value="${escapeHtml(editor.venue || '')}" placeholder="Estádio ou ginásio"></div></div><div class="field"><label for="match-room">Código da sala</label><input id="match-room" maxlength="48" value="${escapeHtml(editor.room || '')}" ${selected ? 'readonly' : ''} placeholder="Gerado automaticamente se ficar vazio"><small>${selected ? 'A sala é permanente para preservar os overlays e URLs desta partida.' : 'Este código aparece em todas as URLs dos overlays desta partida.'}</small></div><div class="operations-actions"><button class="button primary" data-action="save-operation-match" data-value="${escapeHtml(selected?.id || '')}">Salvar partida</button>${selected ? `<a class="button" href="/?room=${encodeURIComponent(selected.room)}">Abrir transmissão</a><button class="button subtle danger" data-action="delete-operation-match" data-value="${escapeHtml(selected.id)}">Excluir</button>` : ''}</div>` : '<div class="portal-empty">Cadastre um campeonato antes de criar partidas.</div>'}</section></div>`;
}

function renderAuditModule() {
  const pending = renderOperationsState();
  if (pending) return pending;
  const unread = operationsData.notifications.filter(item => !item.read).length;
  const notifications = operationsData.notifications.slice(0, 30).map(item => `<article class="notification-card ${item.read ? '' : 'unread'}"><div><span>${item.type === 'delegation-completed' ? 'Delegação concluída' : 'Delegação alterada'}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message)}</p><small>${operationDate(item.createdAt, true)}</small></div>${item.read ? '<b>Lido</b>' : `<button class="button subtle" data-action="read-notification" data-value="${escapeHtml(item.id)}">Marcar como lido</button>`}</article>`).join('') || '<div class="portal-empty">Nenhum aviso recebido.</div>';
  const labels = { 'delegation.completed': 'Delegação concluída', 'delegation.changed': 'Delegação alterada', 'delegation.saved': 'Cadastro de delegação salvo', 'championship.created': 'Campeonato criado', 'championship.updated': 'Campeonato atualizado', 'championship.deleted': 'Campeonato excluído', 'match.created': 'Partida criada', 'match.updated': 'Partida atualizada', 'match.deleted': 'Partida excluída' };
  const logs = operationsData.logs.slice(0, 100).map(item => `<tr><td>${operationDate(item.createdAt, true)}</td><td>${escapeHtml(item.actor)}</td><td>${escapeHtml(labels[item.action] || item.action)}</td><td><strong>${escapeHtml(item.target)}</strong><small>${escapeHtml(item.details)}</small></td></tr>`).join('') || '<tr><td colspan="4">Nenhuma ação registrada.</td></tr>';
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
    ${selectedTeam ? `<section class="lineup-registration"><div class="section-header"><div><h3 class="section-title">Cadastro da apresentação</h3><p class="help-text">Defina foto, função e posição sem sair do painel.</p></div></div><div class="lineup-staff-row"><label><span>Esquema tático</span><select data-lineup-formation="${escapeHtml(selectedTeam.id)}">${Object.keys(FORMATIONS).map(value => `<option value="${value}" ${selectedTeam.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label><span>Treinador</span><input data-lineup-coach-name="${escapeHtml(selectedTeam.id)}" maxlength="100" value="${escapeHtml(selectedTeam.coach?.name || 'Treinador')}"></label><label class="lineup-upload">${selectedTeam.coach?.photo ? 'Trocar foto do treinador' : 'Foto do treinador'}<input type="file" data-lineup-coach-photo="${escapeHtml(selectedTeam.id)}" accept="image/png,image/jpeg,image/webp"></label></div><div class="lineup-athlete-manager">${athletes.map((athlete, index) => `<article class="lineup-athlete-row"><div class="lineup-athlete-thumb">${athlete.photo ? `<img src="${escapeHtml(athlete.photo)}" alt="Foto de ${escapeHtml(athlete.name)}">` : `<span>${escapeHtml(athlete.number || String(index + 1))}</span>`}<label>${athlete.photo ? 'Trocar' : 'Foto'}<input type="file" data-lineup-athlete-photo="${escapeHtml(athlete.id)}" data-lineup-team-id="${escapeHtml(selectedTeam.id)}" accept="image/png,image/jpeg,image/webp"></label></div><div><strong>${escapeHtml(athlete.number || '—')} · ${escapeHtml(athlete.name || `Atleta ${index + 1}`)}</strong><small>${athlete.height ? `${escapeHtml(String(athlete.height).replace('.', ','))} m` : 'Altura não informada'}</small></div><select data-lineup-athlete-role="${escapeHtml(athlete.id)}" data-lineup-team-id="${escapeHtml(selectedTeam.id)}" aria-label="Função de ${escapeHtml(athlete.name)}"><option value="starter" ${athlete.squadRole !== 'reserve' ? 'selected' : ''}>Titular</option><option value="reserve" ${athlete.squadRole === 'reserve' ? 'selected' : ''}>Reserva</option></select><input class="lineup-position-input" data-lineup-athlete-position="${escapeHtml(athlete.id)}" data-lineup-team-id="${escapeHtml(selectedTeam.id)}" maxlength="6" value="${escapeHtml(athlete.position || '')}" placeholder="POS" aria-label="Posição de ${escapeHtml(athlete.name)}"></article>`).join('')}</div></section>` : '<p class="help-text">Selecione um time cadastrado para gerenciar fotos, reservas, treinador e esquema tático.</p>'}
    ${selectedTeam ? renderStaffManager(selectedTeam) : ''}
    <div class="photo-lineup-option"><div><strong>Patrocinadores no rodapé</strong><small>Usa a mídia exclusiva, logo ou banner de cada marca.</small></div><button class="button subtle ${state.photoLineupShowSponsors ? 'active' : ''}" data-action="toggle-photo-lineup-sponsors">${state.photoLineupShowSponsors ? 'Exibindo' : 'Oculto'}</button></div>
    ${appearanceRange('photoLineupSponsorBarSize', 'Tamanho da barra de patrocinadores', state.appearance.photoLineupSponsorBarSize, 60, 180, '%')}
    <p class="help-text">Informe um jogador por linha. Exemplo: <strong>10 Leonardo Lima</strong>. ${selectedTeam ? `Esta relação também atualiza o cadastro de ${escapeHtml(selectedTeam.name)}.` : ''} O fluxo usa até ${currentSport().teamSize} titulares e apresenta o restante como reservas.</p>`;
}

function appearanceRange(field, label, value, minimum = 60, maximum = 180, suffix = '%') {
  return `<label class="parameter-control"><span>${escapeHtml(label)} <strong data-parameter-value="${field}">${escapeHtml(value)}${suffix}</strong></span><input type="range" min="${minimum}" max="${maximum}" step="1" value="${escapeHtml(value)}" data-appearance="${field}"></label>`;
}

function appearanceTypeface(field, value) {
  return `<label class="parameter-select"><span>Tipografia</span><select data-appearance="${field}">${Object.entries(TYPEFACES).map(([key, font]) => `<option value="${key}" ${value === key ? 'selected' : ''}>${font.label}</option>`).join('')}</select></label>`;
}

const OVERLAY_STYLE_OPTIONS = {
  scoreboardStyle: [['classic','Clássico TV'],['minimal','Minimalista'],['glass','Vidro'],['contrast','Alto impacto'],['neon','Neon'],['ribbon','Faixa dinâmica'],['gradient','Gradiente']],
  eventStyle: [['broadcast','Faixa TV'],['minimal','Linha limpa'],['block','Bloco esportivo']],
  lineupStyle: [['panel','Painel'],['clean','Lista limpa'],['columns','Duas colunas']],
  photoLineupStyle: [['editorial','Editorial'],['cards','Cards'],['glass','Vidro premium']],
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

function renderSponsorManager() {
  const sponsors = state.sponsors || [];
  return `<div class="sponsor-manager"><div class="sponsor-manager-head"><div><strong>Patrocinadores cadastrados</strong><small>Escolha o ativo ou ative o looping para alternar automaticamente.</small></div><button class="button subtle" data-action="add-sponsor">+ Adicionar</button></div><div class="sponsor-list">${sponsors.map((sponsor, index) => `<div class="sponsor-item ${state.activeSponsorIndex === index ? 'active' : ''}" data-sponsor-row="${escapeHtml(sponsor.id)}"><button class="sponsor-select" data-action="select-sponsor" data-value="${index}" aria-label="Selecionar ${escapeHtml(sponsor.name)}"><span>${String(index + 1).padStart(2, '0')}</span></button><div class="sponsor-fields"><input data-sponsor-name="${escapeHtml(sponsor.id)}" maxlength="80" value="${escapeHtml(sponsor.name)}" aria-label="Nome do patrocinador ${index + 1}"><div class="sponsor-upload-actions"><label class="sponsor-upload-button">${sponsor.logo ? 'Trocar logo' : 'Enviar logo'}<input type="file" data-sponsor-logo="${escapeHtml(sponsor.id)}" accept="image/png,image/jpeg,image/webp"></label><label class="sponsor-upload-button">${sponsor.banner ? 'Trocar banner' : 'Enviar banner'}<input type="file" data-sponsor-banner="${escapeHtml(sponsor.id)}" accept="image/png,image/jpeg,image/webp"></label><label class="sponsor-upload-button lineup-media-upload">${sponsor.lineupMedia ? 'Trocar mídia da escalação' : 'Mídia da escalação'}<input type="file" data-sponsor-lineup-media="${escapeHtml(sponsor.id)}" accept="image/png,image/jpeg,image/webp,video/mp4,video/webm"></label>${sponsor.lineupMedia ? `<button class="sponsor-upload-button sponsor-media-remove" data-action="remove-sponsor-lineup-media" data-value="${escapeHtml(sponsor.id)}">Remover mídia · ${sponsor.lineupMediaType === 'video' ? 'VÍDEO' : 'IMAGEM'}</button>` : ''}</div></div>${sponsor.logo ? `<img class="sponsor-thumb sponsor-logo-thumb" src="${escapeHtml(sponsor.logo)}" alt="Logo de ${escapeHtml(sponsor.name)}">` : sponsor.banner ? `<img class="sponsor-thumb" src="${escapeHtml(sponsor.banner)}" alt="Arte de ${escapeHtml(sponsor.name)}">` : '<div class="sponsor-thumb sponsor-thumb-empty">LOGO</div>'}<button class="button square subtle" data-action="remove-sponsor" data-value="${escapeHtml(sponsor.id)}" aria-label="Remover patrocinador">×</button></div>`).join('')}</div><div class="sponsor-loop-control"><button class="button ${state.sponsorLoop ? 'primary' : ''}" data-action="toggle-sponsor-loop">${state.sponsorLoop ? 'Parar looping' : 'Iniciar looping'}</button><span>${sponsors.length} patrocinador${sponsors.length === 1 ? '' : 'es'} · ${clampNumber(state.appearance?.sponsorDuration, 3, 60, 10)}s cada</span></div></div>`;
}

function renderAppearanceTab() {
  const appearance = state.appearance || defaultAppearance();
  const scoreboardStyles = [['classic','Clássico','Blocos sólidos'],['glass','Vidro','Transparência'],['minimal','Minimal','Sem excesso'],['contrast','Contraste','Contorno forte'],['neon','Neon','Brilho de contorno'],['ribbon','Faixa dinâmica','Corte diagonal'],['gradient','Gradiente','Barra em degradê']];
  return `<div class="appearance-intro"><strong>Personalização por elemento</strong><p>Ajuste tamanho, fonte, posição e acabamento visual em toda a área 1920 × 1080. Tudo entra imediatamente na prévia e nas URLs do OBS.</p></div><div class="appearance-presets"><span>Predefinições rápidas</span><div><button class="button subtle" data-action="appearance-preset" data-value="compact">Compacto</button><button class="button subtle" data-action="appearance-preset" data-value="broadcast">Padrão TV</button><button class="button subtle" data-action="appearance-preset" data-value="impact">Impacto</button></div></div><section class="overlay-style-board"><div><strong>Variações de layout</strong><small>Uma identidade diferente para cada tipo de overlay.</small></div>${overlayStyleControl('scoreboardStyle','Estilo do placar')}${overlayStyleControl('eventStyle','Estilo dos eventos e GC')}${overlayStyleControl('lineupStyle','Estilo da escalação simples')}${overlayStyleControl('photoLineupStyle','Estilo da apresentação com fotos')}${overlayStyleControl('sponsorStyle','Estilo dos patrocinadores')}</section><div class="parameter-grid">
    ${renderAppearanceComponent('Placar', 'Equipes, resultado e cronômetro', 'scoreboard')}
    ${renderAppearanceComponent('GC e lower third', 'Gols, cartões e identificações', 'event')}
    ${renderAppearanceComponent('Escalação', 'Título e nomes dos jogadores', 'lineup')}
    ${renderAppearanceComponent('Apresentação da equipe', 'Titulares, reservas, treinador e esquema', 'photoLineup')}
    ${renderAppearanceComponent('Patrocinador', 'Marca exibida no canto superior', 'sponsor')}
  </div>
  <div class="goal-settings photo-lineup-settings"><div class="section-header"><div><h3 class="section-title">Acabamento da escalação com fotos e sequência</h3><p class="help-text">Refine o painel, os tempos da sequência e a faixa de marcas exibida no rodapé.</p></div></div>${appearanceRange('photoLineupSurface', 'Opacidade da superfície', appearance.photoLineupSurface, 55, 100, '%')}${appearanceRange('photoLineupRadius', 'Arredondamento dos blocos', appearance.photoLineupRadius, 0, 20, 'px')}${appearanceRange('photoLineupIndividualDuration', 'Tempo por titular', appearance.photoLineupIndividualDuration, 2, 10, 's')}${appearanceRange('photoLineupPanelDuration', 'Tempo por painel', appearance.photoLineupPanelDuration, 3, 15, 's')}${appearanceRange('photoLineupSponsorCount', 'Máximo de patrocinadores', appearance.photoLineupSponsorCount, 1, 8, '')}${appearanceRange('photoLineupSponsorBarSize', 'Tamanho da barra de patrocinadores', appearance.photoLineupSponsorBarSize, 60, 180, '%')}</div>
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
  return `${location.origin}/manage${key ? `/${key}` : ''}?room=${encodeURIComponent(ROOM_ID)}`;
}

function renderScoreboardModuleControls() {
  const sport = currentSport();
  const layout = state.appearance?.scoreboardLayout === 'expanded' ? 'expanded' : 'compact';
  return `<div class="module-section"><div class="field"><label for="competition">Competição</label><input id="competition" data-field="competition" value="${escapeHtml(state.competition)}"></div><div class="scoreboard-layout-control"><span>Formato do placar</span><div role="group" aria-label="Formato do placar"><button class="layout-choice ${layout === 'compact' ? 'active' : ''}" data-action="scoreboard-layout" data-value="compact"><strong>Compacto</strong><small>Siglas de 3 letras</small></button><button class="layout-choice ${layout === 'expanded' ? 'active' : ''}" data-action="scoreboard-layout" data-value="expanded"><strong>Aberto</strong><small>Nomes completos</small></button></div></div><div class="scoreboard-control"><div class="teams-grid"><div>${badge(state.home)}<div class="team-short-name">${escapeHtml(state.home.name)}</div><div class="score-controls"><button class="goal-control" data-action="score-home-minus">−</button><span class="score-number">${state.home.score}</span><button class="goal-control" data-action="score-home-plus">+</button></div></div><span class="score-x">×</span><div>${badge(state.away)}<div class="team-short-name">${escapeHtml(state.away.name)}</div><div class="score-controls"><button class="goal-control" data-action="score-away-minus">−</button><span class="score-number">${state.away.score}</span><button class="goal-control" data-action="score-away-plus">+</button></div></div></div></div>${renderSportMetrics()}<div class="tiny-label">${sport.duration ? 'Cronômetro regressivo' : 'Cronômetro da partida'}</div><div class="clock-box"><span class="clock-time" data-clock>${clockText()}</span><div class="clock-buttons"><button class="button square ${state.clock.running ? '' : 'primary'}" data-action="clock-toggle">${state.clock.running ? icons.pause : icons.play}</button><button class="button square" data-action="clock-back">−1</button><button class="button square" data-action="clock-forward">+1</button><button class="button square" data-action="clock-reset">${icons.refresh}</button></div></div><div class="period-buttons">${sport.periods.map(([value,label]) => `<button class="period-button ${state.period === value ? 'active' : ''}" data-action="period" data-value="${value}">${label}</button>`).join('')}</div></div>`;
}

function renderSponsorModuleControls() {
  const appearance = state.appearance || defaultAppearance();
  return `<div class="module-section"><div class="field-row"><div class="field"><label>Formato</label><select data-appearance="sponsorFormat"><option value="logo-name" ${appearance.sponsorFormat === 'logo-name' ? 'selected' : ''}>Logo + nome</option><option value="banner-name" ${appearance.sponsorFormat === 'banner-name' ? 'selected' : ''}>Banner + nome</option><option value="banner" ${appearance.sponsorFormat === 'banner' ? 'selected' : ''}>Banner 16:9</option><option value="text" ${appearance.sponsorFormat === 'text' ? 'selected' : ''}>Somente nome</option></select></div><div class="field"><label>Animação</label><select data-appearance="sponsorAnimation"><option value="slide" ${appearance.sponsorAnimation === 'slide' ? 'selected' : ''}>Deslizamento</option><option value="zoom" ${appearance.sponsorAnimation === 'zoom' ? 'selected' : ''}>Zoom suave</option><option value="flip" ${appearance.sponsorAnimation === 'flip' ? 'selected' : ''}>Virada 3D</option><option value="fade" ${appearance.sponsorAnimation === 'fade' ? 'selected' : ''}>Dissolver</option></select></div></div>${appearanceRange('sponsorDuration', 'Tempo por patrocinador', appearance.sponsorDuration, 3, 60, 's')}${appearanceRange('sponsorAnimationSpeed', 'Velocidade da animação', appearance.sponsorAnimationSpeed, 50, 160, '%')}${renderSponsorManager()}</div>`;
}

function renderSponsorWideControls() {
  const videoActive = state.sponsorBarMode === 'video';
  return `<section class="sponsor-wide-controls"><div class="section-header"><div><h3 class="section-title">Barra independente · 1500 × 200</h3><p class="help-text">Mídias próprias desta saída. Não utiliza nem altera os patrocinadores dos outros overlays.</p></div>${!videoActive ? '<button class="button subtle" data-action="add-sponsor-bar-item">+ Adicionar banner</button>' : ''}</div><div class="lineup-output-choices"><button class="button ${!videoActive ? 'primary' : ''}" data-action="sponsor-bar-mode" data-value="images">Imagens individuais</button><button class="button ${videoActive ? 'primary' : ''}" data-action="sponsor-bar-mode" data-value="video">Vídeo único</button></div>${videoActive ? `<label class="sponsor-upload-button wide-video-upload">${state.sponsorBarVideo ? 'Trocar vídeo 1500 × 200' : 'Enviar vídeo 1500 × 200'}<input type="file" data-sponsor-wide-video accept="video/mp4,video/webm"></label>` : `<div class="sponsor-wide-list">${state.sponsorBarItems.length ? state.sponsorBarItems.map((item, index) => `<label><span>Banner ${String(index + 1).padStart(2, '0')}</span><b>${item.asset ? 'Arte enviada' : '1500 × 200'}</b><input type="file" data-sponsor-wide-image="${escapeHtml(item.id)}" accept="image/png,image/jpeg,image/webp"><button type="button" class="button square subtle" data-action="remove-sponsor-bar-item" data-value="${escapeHtml(item.id)}" aria-label="Remover banner">×</button></label>`).join('') : '<div class="empty-events">Adicione um banner 1500 × 200 para iniciar.</div>'}</div>`}</section>`;
}

function renderSponsorBarSettings() {
  const appearance = state.appearance || defaultAppearance();
  return `<div class="module-section"><div class="field-row"><div class="field"><label>Transição</label><select data-appearance="sponsorBarTransition"><option value="fade" ${appearance.sponsorBarTransition === 'fade' ? 'selected' : ''}>Fade suave</option><option value="slide" ${appearance.sponsorBarTransition === 'slide' ? 'selected' : ''}>Deslizamento</option><option value="zoom" ${appearance.sponsorBarTransition === 'zoom' ? 'selected' : ''}>Zoom elegante</option></select></div><div class="field"><label>Ajuste da mídia</label><select data-appearance="sponsorBarFit"><option value="cover" ${appearance.sponsorBarFit === 'cover' ? 'selected' : ''}>Preencher (cover)</option><option value="contain" ${appearance.sponsorBarFit === 'contain' ? 'selected' : ''}>Conter (contain)</option></select></div></div>${appearanceRange('sponsorBarDuration', 'Tempo entre patrocinadores', appearance.sponsorBarDuration, 3, 60, 's')}${appearanceRange('sponsorBarAnimationSpeed', 'Velocidade da transição', appearance.sponsorBarAnimationSpeed, 50, 160, '%')}<div class="field-row">${appearanceRange('sponsorBarScale', 'Escala interna da arte', appearance.sponsorBarScale, 60, 180, '%')}${appearanceRange('sponsorBarOpacity', 'Opacidade', appearance.sponsorBarOpacity, 20, 100, '%')}</div><div class="field-row">${appearanceRange('sponsorBarRadius', 'Arredondamento', appearance.sponsorBarRadius, 0, 24, 'px')}<label class="color-field"><span>Fundo da barra</span><input type="color" data-appearance="sponsorBarBackground" value="${safeColor(appearance.sponsorBarBackground, '#08090d')}"></label></div><p class="help-text">A saída permanece independente em 1500 × 200. A escala, opacidade e arredondamento alteram somente a aparência interna da barra.</p><div class="inline-actions"><button class="button ${state.sponsorBarLoop ? 'primary' : ''}" data-action="toggle-sponsor-bar-loop">${state.sponsorBarLoop ? 'Parar looping' : 'Iniciar looping'}</button><button class="button" data-action="next-sponsor-bar">Próximo patrocinador</button></div></div>`;
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

function printableReport(report) {
  const teamSection = (team, side) => `<section class="report-team"><header><div class="report-team-mark" style="--team-report-color:${safeColor(team.color, '#2f7df6')}">${team.logo ? `<img src="${escapeHtml(team.logo)}" alt="">` : escapeHtml(team.short || side)}</div><div><small>${side}</small><h2>${escapeHtml(team.name)}</h2><p>Esquema ${escapeHtml(team.formation)} · ${team.score} gol${team.score === 1 ? '' : 's'}</p></div></header><h3>Titulares</h3><ol class="report-roster">${team.starters.map(player => `<li><b>${escapeHtml(player.number || '—')}</b><span>${escapeHtml(player.name)}<small>${escapeHtml(player.position || 'Posição não informada')}</small></span></li>`).join('')}</ol><h3>Comissão técnica</h3><ul class="report-staff">${team.staff.map(member => `<li><span>${escapeHtml(member.role)}</span><strong>${escapeHtml(member.name)}</strong></li>`).join('')}</ul><h3>Reservas</h3><ol class="report-roster">${team.reserves.map(player => `<li><b>${escapeHtml(player.number || '—')}</b><span>${escapeHtml(player.name)}<small>${escapeHtml(player.position || 'Posição não informada')}</small></span></li>`).join('')}</ol></section>`;
  const eventTitles = (report.events || []).map(event => String(event.title || '').toLocaleLowerCase('pt-BR'));
  const count = matcher => eventTitles.filter(title => matcher.test(title)).length;
  const summary = [['Gols', count(/gol|cesta|ponto/)], ['Amarelos', count(/amarelo/)], ['Vermelhos', count(/vermelho/)], ['Substituições', count(/substitui/)], ['Outros eventos', Math.max(0, eventTitles.length - count(/gol|cesta|ponto|amarelo|vermelho|substitui/))]];
  const periodScores = Object.entries(report.periodScores || {}).map(([period, score]) => `<div><span>${escapeHtml(period)}</span><strong>${escapeHtml(score)}</strong></div>`).join('');
  return `<article class="match-report-print report-document"><header class="report-cover"><div class="report-brand"><span>JEC</span><div><strong>JUVENTUDE OVERLAY STUDIO</strong><small>RELATÓRIO FINAL DA PARTIDA</small></div></div><div class="report-status">${report.status === 'final' ? 'FINALIZADO' : 'PRÉVIA'}</div><div class="report-score"><div><small>MANDANTE</small><strong>${escapeHtml(report.home.name)}</strong></div><b>${escapeHtml(report.finalScore)}</b><div><small>VISITANTE</small><strong>${escapeHtml(report.away.name)}</strong></div></div><p>${escapeHtml(report.competition)} · ${escapeHtml(report.sportLabel || report.sport)} · ${escapeHtml(report.date)}</p></header>
  <section class="report-facts"><div><span>Local</span><strong>${escapeHtml(report.venue || 'Não informado')}</strong></div><div><span>Início real</span><strong>${escapeHtml(formatReportDateTime(report.startedAt, { timeOnly: true }))}</strong></div><div><span>Encerramento</span><strong>${escapeHtml(formatReportDateTime(report.endedAt, { timeOnly: true }))}</strong></div><div><span>Duração real</span><strong>${escapeHtml(report.duration || formatMatchDuration(report.startedAt, report.endedAt))}</strong></div><div><span>Acréscimos</span><strong>+${Number(report.extraTime || 0)} min</strong></div></section>
  <section class="report-summary"><h2>Resumo da partida</h2><div>${summary.map(([label,value]) => `<article><strong>${value}</strong><span>${label}</span></article>`).join('')}</div></section>
  <div class="report-team-grid">${teamSection(report.home, 'MANDANTE')}${teamSection(report.away, 'VISITANTE')}</div>
  <section class="report-periods"><h2>Placar por período</h2><div>${periodScores || '<p>Sem parciais registradas.</p>'}</div></section>
  <section class="report-events"><h2>Linha do tempo completa</h2><table><thead><tr><th>Min.</th><th>Período</th><th>Evento</th><th>Equipe</th><th>Atleta</th><th>Detalhe</th><th>Placar</th></tr></thead><tbody>${reportEventRows(report) || '<tr><td colspan="7">Nenhum evento registrado.</td></tr>'}</tbody></table></section>
  <footer class="report-footer"><span>Documento ${escapeHtml(report.id)}</span><span>Gerado em ${escapeHtml(formatReportDateTime(report.generatedAt || report.createdAt))}</span></footer></article>`;
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
  return `<div class="report-toolbar"><div><strong>Relatório completo da partida</strong><small>${state.matchEndedAt ? `Finalizado em ${formatReportDateTime(state.matchEndedAt)}` : 'Ao finalizar, o relatório é congelado no histórico e preparado em PDF.'}</small></div><div class="inline-actions"><button class="button primary" data-action="${state.matchEndedAt ? 'print-final-report' : 'finish-match'}">${state.matchEndedAt ? 'Abrir PDF final' : 'Finalizar partida e gerar PDF'}</button><button class="button" data-action="print-report">Exportar relatório selecionado</button></div></div>${state.completedReports?.length ? `<div class="field"><label>Histórico de partidas finalizadas</label><select data-report-selection><option value="0">Prévia da partida atual</option>${state.completedReports.map((item, index) => `<option value="${index + 1}" ${reportSelection === index + 1 ? 'selected' : ''}>${escapeHtml(item.date)} · ${escapeHtml(item.home.name)} ${escapeHtml(item.finalScore)} ${escapeHtml(item.away.name)}</option>`).join('')}</select></div>` : ''}${printableReport(report)}`;
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

function renderOverlayBuilder() {
  const item = selectedCustomOverlay();
  if (!item) return `<section class="overlay-builder-empty"><div><span>BUILDER DE OVERLAYS</span><h2>Crie uma saída independente</h2><p>Monte um overlay com mídia, textos, cores, dimensões e animação próprias. Cada criação recebe uma URL exclusiva para o OBS.</p></div><button class="button primary" data-action="add-custom-overlay">Criar primeiro overlay</button></section>`;
  return `<div class="overlay-builder">
    <aside class="builder-list"><div class="section-header"><strong>Meus overlays</strong><button class="button subtle" data-action="add-custom-overlay">+ Novo</button></div>${state.customOverlays.map(overlay => `<button class="builder-list-item ${overlay.id === item.id ? 'active' : ''}" data-action="select-custom-overlay" data-value="${escapeHtml(overlay.id)}"><i class="${overlay.visible ? 'on' : ''}"></i><span><strong>${escapeHtml(overlay.name)}</strong><small>${overlay.width} × ${overlay.height}</small></span></button>`).join('')}</aside>
    <section class="builder-editor"><div class="builder-toolbar"><div><span>EDIÇÃO VISUAL</span><h2>${escapeHtml(item.name)}</h2></div><div class="inline-actions"><button class="button ${item.visible ? '' : 'primary'}" data-action="toggle-custom-overlay" data-value="${escapeHtml(item.id)}">${item.visible ? 'Retirar do ar' : 'Colocar no ar'}</button><button class="button" data-action="copy-custom-url" data-value="${escapeHtml(item.id)}">${icons.copy} URL OBS</button><button class="button subtle" data-action="remove-custom-overlay" data-value="${escapeHtml(item.id)}">Excluir</button></div></div>
      <div class="builder-workspace"><div class="builder-fields">
        <div class="field"><label>Nome do overlay</label><input data-custom-field="name" value="${escapeHtml(item.name)}" maxlength="80"></div>
        <div class="field-row"><div class="field"><label>Largura</label><input type="number" min="200" max="3840" data-custom-field="width" value="${item.width}"></div><div class="field"><label>Altura</label><input type="number" min="100" max="2160" data-custom-field="height" value="${item.height}"></div></div>
        <div class="field"><label>Título</label><input data-custom-field="title" value="${escapeHtml(item.title)}" maxlength="120"></div>
        <div class="field"><label>Texto complementar</label><textarea data-custom-field="subtitle" maxlength="240">${escapeHtml(item.subtitle)}</textarea></div>
        <div class="field-row"><div class="field"><label>Composição</label><select data-custom-field="layout"><option value="media-text" ${item.layout === 'media-text' ? 'selected' : ''}>Mídia + texto</option><option value="media" ${item.layout === 'media' ? 'selected' : ''}>Somente mídia</option><option value="text" ${item.layout === 'text' ? 'selected' : ''}>Somente texto</option></select></div><div class="field"><label>Animação</label><select data-custom-field="animation"><option value="fade" ${item.animation === 'fade' ? 'selected' : ''}>Fade</option><option value="slide" ${item.animation === 'slide' ? 'selected' : ''}>Deslizamento</option><option value="zoom" ${item.animation === 'zoom' ? 'selected' : ''}>Zoom</option></select></div></div>
        <div class="builder-colors"><label><input type="color" data-custom-field="background" value="${safeColor(item.background, '#10131a')}"><span>Fundo</span></label><label><input type="color" data-custom-field="accent" value="${safeColor(item.accent, '#2f7df6')}"><span>Destaque</span></label><label><input type="color" data-custom-field="textColor" value="${safeColor(item.textColor, '#ffffff')}"><span>Texto</span></label></div>
        <label class="sponsor-upload-button builder-media-upload">${item.media ? 'Trocar mídia' : 'Enviar imagem ou vídeo'}<input type="file" data-custom-media="${escapeHtml(item.id)}" accept="image/png,image/jpeg,image/webp,image/svg+xml,video/mp4,video/webm"></label>
      </div><div class="builder-preview"><div class="builder-canvas" style="aspect-ratio:${item.width}/${item.height}">${customOverlayMarkup(item, true)}</div><div><span>Canvas ${item.width} × ${item.height}</span><small>Configure a fonte Navegador do OBS com estas mesmas dimensões.</small></div></div></div>
    </section></div>`;
}

function renderModuleControls(key) {
  if (key === 'championships') return renderChampionshipsModule();
  if (key === 'matches') return renderMatchesModule();
  if (key === 'audit') return renderAuditModule();
  if (key === 'builder') return renderOverlayBuilder();
  if (key === 'pregame') return renderPregameModule();
  if (key === 'report') return renderReportModule();
  if (key === 'access') return renderAccessModule();
  let content = '';
  if (moduleTab === 'control') content = `<div class="module-section"><div class="inline-actions"><button class="button primary" data-action="${key === 'scoreboard' ? 'overlay-scoreboard' : key === 'lineup' ? 'overlay-photo-lineup' : key === 'sponsors' ? 'overlay-sponsor' : key === 'sponsor-bar' ? 'overlay-sponsor-bar' : 'overlay-event'}">Mostrar / Ocultar</button>${key === 'scoreboard' ? '<button class="button" data-action="test-scoreboard-animation">Testar entrada</button><button class="button" data-action="test-goal">Testar gol</button>' : key === 'sponsors' ? '<button class="button" data-action="test-sponsor-animation">Testar transição</button>' : key === 'sponsor-bar' ? '<button class="button" data-action="next-sponsor-bar">Testar troca</button>' : ''}</div></div>`;
  else if (moduleTab === 'settings') content = key === 'sponsor-bar' ? renderSponsorBarSettings() : `<div class="module-section">${key === 'scoreboard' ? overlayStyleControl('scoreboardStyle','Estilo do placar') + renderAppearanceComponent('Placar','Tamanho, fonte e posição','scoreboard') + renderPeriodStyleControls() + renderChampionshipTheme() : key === 'lineup' ? overlayStyleControl('photoLineupStyle','Estilo da apresentação') + renderAppearanceComponent('Escalação','Tamanho, fonte e posição','photoLineup') : key === 'sponsors' ? overlayStyleControl('sponsorStyle','Estilo dos patrocinadores') + renderAppearanceComponent('Patrocinador','Logo, banner ou nome','sponsor') : overlayStyleControl('eventStyle','Estilo dos eventos') + renderAppearanceComponent('Eventos','Cartões, substituições e lower thirds','event')}</div>`;
  else if (moduleTab === 'media') content = key === 'sponsors' ? renderSponsorModuleControls() : key === 'sponsor-bar' ? renderSponsorWideControls() : key === 'lineup' ? `<div class="module-section">${renderRosterTab()}</div>` : key === 'scoreboard' ? `<div class="module-section">${renderTeamsTab()}</div>` : '<div class="empty-events">Este overlay não precisa de mídias próprias.</div>';
  else if (key === 'scoreboard') content = `${renderScoreboardModuleControls()}${renderPeriodExtraControls()}`;
  if (key === 'events' && !content) content = `<div class="module-section">${renderSportActions()}</div>${renderEvents()}`;
  if (key === 'lineup' && !content) content = `<div class="module-section">${renderRosterTab()}</div>`;
  if (key === 'sponsors' && !content) content = renderSponsorModuleControls();
  if (key === 'sponsor-bar' && !content) content = `${renderSponsorBarSettings()}${renderSponsorWideControls()}`;
  if (key === 'teams') return `<div class="module-section">${renderTeamsTab()}</div>`;
  if (key === 'appearance') return `<div class="module-section">${renderChampionshipTheme()}${renderAppearanceTab()}</div>`;
  return `${moduleTabs()}${content}`;
}

function moduleOnAir(layer) {
  if (layer === 'scoreboard') return state.visible.scoreboard;
  if (layer === 'event') return eventIsVisible();
  if (layer === 'photo-lineup') return state.visible.photoLineup;
  if (layer === 'sponsor') return state.visible.sponsor;
  if (layer === 'sponsor-bar') return state.visible.sponsorBar;
  return true;
}

function renderModuleMonitor(module) {
  const active = moduleOnAir(module.layer);
  const action = { scoreboard: 'overlay-scoreboard', event: 'overlay-event', 'photo-lineup': 'overlay-photo-lineup', sponsor: 'overlay-sponsor', 'sponsor-bar': 'overlay-sponsor-bar' }[module.layer];
  return `<section class="panel module-monitor"><div class="section-header"><div><h3 class="section-title">Prévia isolada</h3><span class="module-air-state ${active ? 'on' : ''}">${active ? 'NO AR' : 'FORA DO AR'}</span></div><div class="inline-actions">${action ? `<button class="button ${active ? '' : 'primary'}" data-action="${action}">${active ? 'Retirar' : 'Exibir'}</button>` : ''}<button class="button subtle" data-action="copy-url" data-value="${escapeHtml(module.layer)}">${icons.copy} URL OBS</button></div></div><div class="monitor-screen module-monitor-screen">${renderPreviewBackground()}<div id="preview-overlay">${overlayMarkup(module.layer)}</div>${active ? '' : '<div class="module-empty-preview">Overlay fora do ar</div>'}<div class="monitor-label">${escapeHtml(module.label.toUpperCase())} · 1920 × 1080</div></div></section>`;
}

function renderModuleHub() {
  return `<section class="module-hub"><div class="module-hub-head"><span>Central de módulos</span><h1>Uma tela para cada operação</h1><p>Abra somente o que precisa durante a transmissão. Todos os módulos continuam sincronizados na mesma sala.</p></div><div class="module-hub-grid">${MANAGEMENT_MODULES.map(module => `<a href="${escapeHtml(moduleUrl(module.key))}" class="module-hub-card"><span>${module.icon}</span><div><strong>${escapeHtml(module.label)}</strong><small>${escapeHtml(module.caption)}</small></div><b>→</b></a>`).join('')}</div><div class="recommended-flow"><strong>Fluxo recomendado para o pré-jogo</strong><div><span><b>1</b> Times e elenco</span><span><b>2</b> Escalações e apresentação</span><span><b>3</b> Placar e eventos ao vivo</span></div></div></section>`;
}

function renderManagementSidebar(activeKey = 'overview') {
  const groupLabels = { championships: 'Organização', scoreboard: 'Overlays', pregame: 'Partida', teams: 'Configuração' };
  const links = MANAGEMENT_MODULES.map(item => `${groupLabels[item.key] ? `<span class="module-sidebar-label ${item.key === 'scoreboard' ? '' : 'module-sidebar-label-spaced'}">${groupLabels[item.key]}</span>` : ''}<a class="${activeKey === item.key ? 'active' : ''}" href="${escapeHtml(moduleUrl(item.key))}">${item.icon}<span>${escapeHtml(item.label)}</span></a>`).join('');
  return `<aside class="module-sidebar" aria-label="Navegação dos overlays"><a class="module-sidebar-overview ${activeKey === 'overview' ? 'active' : ''}" href="/?room=${encodeURIComponent(ROOM_ID)}">${icons.monitor}<span>Visão geral</span></a>${links}<a class="module-sidebar-home ${activeKey === 'hub' ? 'active' : ''}" href="${escapeHtml(moduleUrl())}">${icons.layers}<span>Central de módulos</span></a></aside>`;
}

function renderModuleApp() {
  const module = MANAGEMENT_MODULES.find(item => item.key === managementModule);
  const unread = operationsData.notifications.filter(item => !item.read).length;
  const isOperational = ['championships', 'matches', 'audit', 'builder', 'access'].includes(module?.key);
  return `<div class="studio module-studio"><header class="topbar"><a class="brand" href="/?room=${encodeURIComponent(ROOM_ID)}">${brandMark()}<span class="brand-copy"><strong class="brand-name">Juventude</strong><span class="brand-caption">Esporte Clube</span></span></a><div class="top-actions"><span class="room-badge">Sala · ${escapeHtml(ROOM_ID)}</span><a class="button notification-button ${unread ? 'has-unread' : ''}" href="${escapeHtml(moduleUrl('audit'))}">${icons.list} Avisos${unread ? `<b>${unread}</b>` : ''}</a><a class="button" href="/?room=${encodeURIComponent(ROOM_ID)}">Visão geral</a><button class="button primary" data-action="open-obs">${icons.external} Saídas OBS</button><button class="button subtle" data-action="admin-logout">Sair</button></div></header><main class="module-workspace">${renderManagementSidebar(module?.key || 'hub')}<div class="module-main">${module ? `<header class="module-page-head"><div><span>${module.key === 'builder' ? 'Criação sem desenvolvimento' : ['championships','matches','audit'].includes(module.key) ? 'Gestão da transmissão' : `${escapeHtml(currentSport().label)} · módulo dedicado`}</span><h1>${escapeHtml(module.label)}</h1><p>${escapeHtml(module.caption)}</p></div><a class="button subtle" href="${escapeHtml(moduleUrl())}">Todos os módulos</a></header>${isOperational ? `<section class="panel builder-panel">${renderModuleControls(module.key)}</section>` : `${renderSportSwitcher()}<div class="module-grid"><section class="panel module-controls">${renderModuleControls(module.key)}</section>${renderModuleMonitor(module)}</div>`}` : renderModuleHub()}</div></main></div>${drawer ? renderDrawer() : ''}`;
}

function renderApp() {
  const unread = operationsData.notifications.filter(item => !item.read).length;
  return `<div class="studio"><header class="topbar"><a class="brand" href="/?room=${encodeURIComponent(ROOM_ID)}">${brandMark()}<span class="brand-copy"><strong class="brand-name">Juventude</strong><span class="brand-caption">Esporte Clube</span></span></a><div class="top-actions"><div class="status-row sync-status" data-sync-status="${syncStatus}"><i class="live-dot"></i><span data-sync-label>${syncStatus === 'online' ? 'Sincronizado' : 'Conectando…'}</span><span class="status-time" data-clock>${clockText()}</span></div><a class="button notification-button ${unread ? 'has-unread' : ''}" href="${escapeHtml(moduleUrl('audit'))}">${icons.list} Avisos${unread ? `<b>${unread}</b>` : ''}</a><a class="button" href="${escapeHtml(moduleUrl())}">${icons.layers} Módulos</a><button class="button primary" data-action="open-obs">${icons.external} Saídas OBS</button><button class="button subtle" data-action="admin-logout">Sair</button></div></header>
    <main class="module-workspace dashboard-workspace">${renderManagementSidebar('overview')}<div class="workspace dashboard-main"><div class="page-head"><div><div class="eyebrow">Central de transmissão · ${escapeHtml(currentSport().label)}</div><h1 class="page-title">Controle da partida</h1><p class="page-caption">${escapeHtml(state.competition)} · ${escapeHtml(state.venue)}</p></div><div class="match-tools"><span class="room-badge">Sala · ${escapeHtml(ROOM_ID)}</span><button class="button subtle" data-action="undo" ${state._backup ? '' : 'disabled'}>↶ Desfazer</button><button class="button" data-action="new-match">Nova partida</button></div></div>${renderSportSwitcher()}
      <div class="workspace-grid"><div class="control-column">${renderControls()}${renderEvents()}</div><div class="preview-column">${renderMonitor()}${renderThemes()}</div></div>
    </div></main></div>${drawer ? renderDrawer() : ''}`;
}

function renderAuthWait(message) {
  return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>${escapeHtml(message)}</h1><p>Aguarde um instante.</p></section></main>`;
}

function renderTeamAuthGate() {
  if (teamSession.status === 'checking') return renderAuthWait('Verificando sessão…');
  const options = teamLoginTeams.map(team => `<option value="${escapeHtml(team.id)}">${escapeHtml(team.name)}</option>`).join('');
  return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state auth-card"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>Acesso da equipe</h1><p>Selecione a equipe e informe o usuário e a senha cadastrados pela organização.</p>
    <div class="auth-form"><div class="field"><label for="team-select">Equipe</label><select id="team-select">${options || '<option value="">Nenhuma equipe cadastrada</option>'}</select></div><div class="field"><label for="team-username">Usuário</label><input id="team-username" autocomplete="username" maxlength="40"></div><div class="field"><label for="team-password">Senha</label><input id="team-password" type="password" autocomplete="current-password" maxlength="200"></div>${teamSession.error ? `<p class="auth-error">${escapeHtml(teamSession.error)}</p>` : ''}<button class="button primary" data-action="team-login-submit" style="width:100%">Entrar</button></div></section></main>`;
}

function renderAdminAuthGate() {
  if (adminSession.status === 'checking') return renderAuthWait('Verificando sessão…');
  const isSetup = adminSession.status === 'setup';
  return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state auth-card"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>${isSetup ? 'Criar administrador' : 'Entrar no painel'}</h1><p>${isSetup ? 'Defina o primeiro usuário e senha do painel administrativo.' : 'Informe seu usuário e senha para acessar o painel.'}</p>
    <div class="auth-form"><div class="field"><label for="admin-username">Usuário</label><input id="admin-username" autocomplete="username" maxlength="40"></div><div class="field"><label for="admin-password">Senha</label><input id="admin-password" type="password" autocomplete="${isSetup ? 'new-password' : 'current-password'}" maxlength="200"></div>${isSetup ? `<div class="field"><label for="admin-setup-token">Código de instalação</label><input id="admin-setup-token" type="password" autocomplete="off"><small>Use o código fornecido pelo responsável pela instalação.</small></div>` : ''}${adminSession.error ? `<p class="auth-error">${escapeHtml(adminSession.error)}</p>` : ''}<button class="button primary" data-action="${isSetup ? 'admin-setup-submit' : 'admin-login-submit'}" style="width:100%">${isSetup ? 'Criar administrador' : 'Entrar'}</button><a class="button subtle auth-team-link" href="/team">${icons.users} Acesso da equipe</a></div></section></main>`;
}

function renderTeamPortal() {
  if (teamPortalStatus === 'loading') return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>Carregando cadastro…</h1><p>Aguarde enquanto buscamos os dados da equipe.</p></section></main>`;
  if (teamPortalStatus === 'invalid' || !teamPortalTeam) return `<main class="team-portal-shell"><section class="team-portal-card team-portal-state"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><h1>Equipe não encontrada</h1><p>Fale com o responsável pela transmissão para verificar seu acesso.</p><button class="button subtle" data-action="team-logout" style="margin-top:16px">Sair</button></section></main>`;
  const athletes = Array.isArray(teamPortalTeam.athletes) ? teamPortalTeam.athletes : [];
  const completion = delegationCompletion(teamPortalTeam);
  const delegationDone = teamDelegation.status === 'completed';
  const statusLabel = teamPortalStatus === 'saving' ? 'Salvando…' : teamPortalStatus === 'saved' ? 'Dados salvos' : teamPortalStatus === 'error' ? 'Erro ao salvar' : 'Alterações salvas manualmente';
  return `<main class="team-portal-shell"><section class="team-portal-card"><header class="team-portal-head"><div class="portal-brand">${brandMark()}<strong>${BRAND_NAME}</strong></div><div style="display:flex;align-items:center;gap:10px"><span class="portal-status portal-status-${escapeHtml(teamPortalStatus)}">${statusLabel}</span><button class="button square subtle" data-action="team-logout" aria-label="Sair">${icons.close}</button></div></header><div class="team-portal-team"><div class="portal-team-logo">${teamPortalTeam.logo ? `<img src="${escapeHtml(teamPortalTeam.logo)}" alt="Escudo de ${escapeHtml(teamPortalTeam.name)}">` : escapeHtml(teamPortalTeam.short)}</div><div><span>Cadastro da escalação</span><h1>${escapeHtml(teamPortalTeam.name)}</h1><p>Preencha os dados usados nas apresentações individuais, escalação geral e Mídia Kit.</p></div></div>
    <section class="portal-team-settings"><div class="field"><label>Nome da equipe</label><input data-portal-team-field="name" maxlength="80" value="${escapeHtml(teamPortalTeam.name)}"></div><div class="field"><label>Sigla (3 letras)</label><input data-portal-team-field="short" maxlength="3" value="${escapeHtml(teamPortalTeam.short)}"></div><div class="field"><label>Cor principal</label><input type="color" data-portal-team-field="color" value="${safeColor(teamPortalTeam.color)}"></div><label class="sponsor-upload-button">${teamPortalTeam.logo ? 'Trocar escudo' : 'Enviar escudo'}<input type="file" data-portal-team-logo accept="image/png,image/jpeg,image/webp,image/svg+xml"></label></section>
    <section class="portal-coach"><div class="portal-athlete-photo">${teamPortalTeam.coach?.photo ? `<img src="${escapeHtml(teamPortalTeam.coach.photo)}" alt="Foto de ${escapeHtml(teamPortalTeam.coach.name)}">` : '<span>TC</span>'}<label>${teamPortalTeam.coach?.photo ? 'Trocar foto' : 'Enviar foto'}<input type="file" data-portal-coach-photo accept="image/png,image/jpeg,image/webp"></label></div><label><span>Treinador</span><input data-portal-coach-name maxlength="100" value="${escapeHtml(teamPortalTeam.coach?.name || 'Treinador')}" placeholder="Nome do treinador"></label><label><span>Esquema tático</span><select data-portal-formation>${Object.keys(FORMATIONS).map(value => `<option value="${value}" ${teamPortalTeam.formation === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label></section>
    ${renderStaffManager(teamPortalTeam, true)}
    <div class="portal-toolbar"><div><strong>${athletes.length} atleta${athletes.length === 1 ? '' : 's'}</strong><small>Nome, número, altura, função, posição e foto.</small></div><button class="button subtle" data-action="portal-add-athlete">+ Adicionar atleta</button></div>
    <div class="portal-athlete-list">${athletes.length ? athletes.map((athlete, index) => `<article class="portal-athlete" data-athlete-id="${escapeHtml(athlete.id)}"><div class="portal-athlete-photo">${athlete.photo ? `<img src="${escapeHtml(athlete.photo)}" alt="Foto de ${escapeHtml(athlete.name || `atleta ${index + 1}`)}">` : `<span>${escapeHtml((athlete.name || 'A').slice(0, 1).toUpperCase())}</span>`}<label>${athlete.photo ? 'Trocar foto' : 'Enviar foto'}<input type="file" data-portal-athlete-photo="${escapeHtml(athlete.id)}" accept="image/png,image/jpeg,image/webp"></label></div><div class="portal-athlete-fields"><label><span>Nome completo</span><input data-portal-athlete-field="name" data-athlete-id="${escapeHtml(athlete.id)}" maxlength="100" value="${escapeHtml(athlete.name)}" placeholder="Nome do atleta"></label><div><label><span>Número</span><input data-portal-athlete-field="number" data-athlete-id="${escapeHtml(athlete.id)}" maxlength="6" value="${escapeHtml(athlete.number)}" inputmode="numeric" placeholder="10"></label><label><span>Altura (m)</span><input data-portal-athlete-field="height" data-athlete-id="${escapeHtml(athlete.id)}" maxlength="5" value="${escapeHtml(athlete.height)}" inputmode="decimal" placeholder="1,78"></label><label><span>Função</span><select data-portal-athlete-field="squadRole" data-athlete-id="${escapeHtml(athlete.id)}"><option value="starter" ${athlete.squadRole !== 'reserve' ? 'selected' : ''}>Titular</option><option value="reserve" ${athlete.squadRole === 'reserve' ? 'selected' : ''}>Reserva</option></select></label><label><span>Posição</span><input data-portal-athlete-field="position" data-athlete-id="${escapeHtml(athlete.id)}" maxlength="6" value="${escapeHtml(athlete.position || '')}" placeholder="ZAG"></label></div></div><button class="button square subtle portal-remove-athlete" data-action="portal-remove-athlete" data-value="${escapeHtml(athlete.id)}" aria-label="Remover ${escapeHtml(athlete.name || 'atleta')}">×</button></article>`).join('') : '<div class="portal-empty">Nenhum atleta cadastrado. Use “Adicionar atleta” para começar.</div>'}</div>
    <section class="delegation-completion ${delegationDone ? 'is-complete' : teamDelegation.status === 'needs-review' ? 'needs-review' : ''}"><div><span>${delegationDone ? 'Cadastro concluído' : teamDelegation.status === 'needs-review' ? 'Revisão necessária' : 'Conclusão da delegação'}</span><strong>${delegationDone ? 'O Super Admin já foi avisado.' : completion.complete ? 'Todos os campos obrigatórios estão preenchidos.' : 'Ainda faltam dados para concluir.'}</strong>${completion.missing.length ? `<p>Complete: ${escapeHtml(completion.missing.join(', '))}.</p>` : '<p>Ao concluir, um aviso será enviado ao Super Admin e a ação ficará registrada no histórico.</p>'}</div><button class="button primary" data-action="complete-team-delegation" ${!completion.complete || delegationDone || teamPortalStatus === 'saving' ? 'disabled' : ''}>${delegationDone ? 'Delegação concluída' : 'Concluir e avisar'}</button></section>
    <footer class="portal-footer"><p>As fotos devem estar em PNG, JPG ou WebP e ter até 5 MB.</p><button class="button portal-save" data-action="portal-save" ${teamPortalStatus === 'saving' ? 'disabled' : ''}>${teamPortalStatus === 'saving' ? 'Salvando…' : 'Salvar rascunho'}</button></footer></section></main>`;
}

function renderDrawer() {
  if (drawer.type === 'obs') return renderObsDrawer();
  return renderEventDrawer();
}

function overlayUrl(layer) {
  return `${location.origin}/overlay?layer=${encodeURIComponent(layer)}&room=${encodeURIComponent(ROOM_ID)}`;
}

function renderObsDrawer() {
  const links = [['all','Programa completo'],['scoreboard','Placar (inclui animação de gol)'],['event','GC, cartões e identificações'],['lineup','Escalação simples'],['photo-lineup','Apresentação completa da equipe'],['sponsor','Patrocinador'],['sponsor-bar','Barra de Patrocinadores · 1500 × 200']];
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
    <div class="field"><label for="event-name">${drawer.type === 'sponsor' ? 'Marca exibida' : drawer.type === 'substitution' ? 'Jogador que entra' : hasAthleteSelector ? 'Atleta' : 'Nome'}</label><input id="event-name" ${hasAthleteSelector ? 'list="event-player-options" autocomplete="off"' : ''} placeholder="${escapeHtml(config.placeholder)}" value="${drawer.type === 'sponsor' ? escapeHtml(state.sponsor) : ''}" autofocus>${hasAthleteSelector ? `<small class="field-hint">Digite algumas letras para localizar entre ${players.length} atletas de ${escapeHtml(state[selectedTeamKey].name)}.</small>` : ''}</div>
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
  if (layer === 'sponsor-bar') return JSON.stringify({ ...common, appearance: { sponsorBarDuration: state.appearance?.sponsorBarDuration, sponsorBarAnimationSpeed: state.appearance?.sponsorBarAnimationSpeed, sponsorBarTransition: state.appearance?.sponsorBarTransition, sponsorBarFit: state.appearance?.sponsorBarFit, sponsorBarScale: state.appearance?.sponsorBarScale, sponsorBarOpacity: state.appearance?.sponsorBarOpacity, sponsorBarRadius: state.appearance?.sponsorBarRadius, sponsorBarBackground: state.appearance?.sponsorBarBackground }, visible: state.visible.sponsorBar, items: state.sponsorBarItems, activeSponsorIndex: state.sponsorBarActiveIndex, mode: state.sponsorBarMode, video: state.sponsorBarVideo });
  if (layer === 'lineup') return JSON.stringify({ ...common, appearance: appearanceFor('lineup'), visible: state.visible.lineup, lineupTeam: state.lineupTeam, home: state.home, away: state.away });
  if (layer === 'custom') { const item = selectedCustomOverlay(); return JSON.stringify(item ? { ...item, transition: undefined } : null); }
  return JSON.stringify({ ...common, appearance: appearanceFor('photoLineup'), visible: state.visible.photoLineup, lineupTeam: state.lineupTeam, selectedTeams: state.selectedTeams, home: state.home, away: state.away, teamCatalog, stage: state.photoLineupStage, player: state.photoLineupPlayerIndex, showSponsors: state.photoLineupShowSponsors, sponsor: activeSponsor() });
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
  if (layer === 'lineup') return JSON.stringify(active(state.lineupTransition));
  if (layer === 'photo-lineup') return JSON.stringify({ transition: active(state.photoLineupTransition), stage: active(state.photoLineupStageTransition) });
  if (layer === 'custom') return JSON.stringify(active(selectedCustomOverlay()?.transition));
  return '';
}

function renderIsolatedOutput() {
  if (typeof app.querySelector !== 'function') { app.innerHTML = overlayMarkup(outputLayer); return; }
  const layers = outputLayer === 'all' ? ['scoreboard','event','sponsor','sponsor-bar','lineup','photo-lineup'] : [outputLayer];
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
  const attributes = ['data-field','data-custom-field','data-team-field','data-team','data-appearance','data-sponsor-name','data-catalog-field','data-catalog-id','data-lineup-coach-name','data-lineup-athlete-position','data-lineup-team-id','data-portal-athlete-field','data-athlete-id','data-portal-staff-name','data-portal-coach-name','data-portal-team-field','data-championship-field','data-theme-override'];
  let selector = focused.id ? `#${focused.id}` : '';
  if (!selector) selector = attributes.filter(name => focused.hasAttribute?.(name)).map(name => `[${name}="${String(focused.getAttribute(name)).replace(/"/g, '\\"')}"]`).join('');
  return selector ? { selector, start: focused.selectionStart, end: focused.selectionEnd } : null;
}

function ensureEmergencyButton() {
  if (isOutput || isPreview || isTeamPortal || document.querySelector('[data-emergency-hide-all]')) return;
  const button = document.createElement('button');
  button.className = 'emergency-hide-all';
  button.textContent = 'DESATIVAR TODOS';
  button.dataset.emergencyHideAll = 'true';
  button.onclick = () => handleAction('hide-all', { dataset: {} });
  document.body.append(button);
}

function ensureMatchSwitcher() {
  if (!isAdminPanel || adminSession.status !== 'authenticated' || !operationsData.matches.length || document.getElementById('active-match-switcher')) return;
  const actions = document.querySelector('.top-actions');
  if (!actions) return;
  const wrapper = document.createElement('label');
  wrapper.className = 'active-match-switcher';
  wrapper.innerHTML = renderMatchSwitcher();
  const nested = wrapper.querySelector('.active-match-switcher');
  if (nested) wrapper.innerHTML = nested.innerHTML;
  actions.prepend(wrapper);
}

function render() {
  if (isOutput) { renderIsolatedOutput(); return; }
  const remembered = rememberFocusedField();
  if (isTeamPortal) {
    app.innerHTML = teamSession.status === 'authenticated' ? renderTeamPortal() : renderTeamAuthGate();
  } else if (isPreview) {
    app.innerHTML = `<div class="full-preview-stage">${renderPreviewBackground()}${previewCompositeMarkup()}<div class="safe-guides"><i></i><i></i></div><div class="monitor-label">VISUALIZAÇÃO COMPLETA · ${escapeHtml(currentSport().label.toUpperCase())} · SALA ${escapeHtml(ROOM_ID)}</div></div>`;
  } else if (isAdminPanel && adminSession.status !== 'authenticated') {
    app.innerHTML = renderAdminAuthGate();
  } else if (isManagement) {
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

async function copyText(value) {
  try {
    await navigator.clipboard.writeText(value);
    toast('Link copiado para a área de transferência.');
  } catch {
    const input = document.createElement('textarea');
    input.value = value;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.append(input);
    input.select();
    const copied = document.execCommand('copy');
    input.remove();
    toast(copied ? 'Link copiado para a área de transferência.' : 'Copie o link exibido na caixa.');
  }
}

function confirmEvent() {
  const type = drawer.type;
  const cardMode = (type === 'yellow' || type === 'red') && (document.getElementById('event-card-mode')?.value === 'scoreboard' || drawer.cardMode === 'scoreboard') ? 'scoreboard' : 'lower-third';
  const teamKey = document.getElementById('event-team')?.value || 'home';
  const name = document.getElementById('event-name')?.value.trim();
  const note = document.getElementById('event-note')?.value.trim() || '';
  if (!name) { toast('Informe o nome antes de colocar no ar.'); return; }
  if (type === 'sponsor') {
    drawer = null;
    commit(draft => {
      const sponsor = activeSponsor(draft);
      sponsor.name = name;
      draft.sponsor = name;
      putSponsorOnAir(draft);
    }, { immediate: true });
    toast(`Patrocinador exibido por ${clampNumber(state.appearance.sponsorDuration, 3, 60, 10)} segundos.`);
    return;
  }
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
  if (action === 'new-championship') { selectedChampionshipId = ''; championshipDraft = { name: '', season: '', startDate: '', endDate: '', status: 'planned' }; render(); return; }
  if (action === 'select-championship') { selectedChampionshipId = target.dataset.value; championshipDraft = structuredClone(operationsData.championships.find(item => item.id === selectedChampionshipId) || null); render(); return; }
  if (action === 'save-championship') {
    const item = { id: target.dataset.value || '', name: document.getElementById('championship-name')?.value || '', season: document.getElementById('championship-season')?.value || '', startDate: document.getElementById('championship-start')?.value || '', endDate: document.getElementById('championship-end')?.value || '', status: document.getElementById('championship-status')?.value || 'planned' };
    postOperation('upsert-championship', { item }).then(ok => { if (!ok) return; selectedChampionshipId = operationsData.championships.find(entry => entry.name === item.name)?.id || selectedChampionshipId; championshipDraft = null; toast('Campeonato salvo.'); render(); });
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
    const item = { id: target.dataset.value || '', championshipId: document.getElementById('match-championship')?.value || '', homeTeamId: document.getElementById('operation-home')?.value || '', awayTeamId: document.getElementById('operation-away')?.value || '', kickoffAt: document.getElementById('match-kickoff')?.value || '', status: document.getElementById('match-status')?.value || 'scheduled', round: document.getElementById('match-round')?.value || '', venue: document.getElementById('match-venue')?.value || '', room: document.getElementById('match-room')?.value || '' };
    postOperation('upsert-match', { item }).then(ok => { if (!ok) return; const saved = operationsData.matches.find(entry => entry.id === item.id) || operationsData.matches[0]; selectedMatchId = saved?.id || ''; matchDraft = null; toast('Partida salva com uma sala própria de overlays.'); render(); });
    return;
  }
  if (action === 'delete-operation-match') {
    if (!confirm('Excluir esta partida da agenda? O estado já salvo na sala não será apagado.')) return;
    postOperation('delete-match', { id: target.dataset.value }).then(ok => { if (ok) { selectedMatchId = ''; toast('Partida removida da agenda.'); } });
    return;
  }
  if (action === 'read-notification') { postOperation('mark-notification-read', { id: target.dataset.value }); return; }
  if (action === 'read-all-notifications') { postOperation('mark-all-notifications-read'); return; }
  if (action === 'module-tab') { moduleTab = target.dataset.value; render(); return; }
  if (action === 'add-custom-overlay') {
    const id = `overlay-${Date.now().toString(36)}`;
    commit(draft => { draft.customOverlays.push({ id, name: `Overlay ${draft.customOverlays.length + 1}`, width: 1920, height: 1080, title: 'NOVO OVERLAY', subtitle: '', media: '', mediaType: 'image', layout: 'media-text', animation: 'fade', background: '#10131a', accent: '#2f7df6', textColor: '#ffffff', visible: false, transition: null }); }, { immediate: true });
    selectedCustomOverlayId = id;
    render();
    return;
  }
  if (action === 'select-custom-overlay') { selectedCustomOverlayId = target.dataset.value; render(); return; }
  if (action === 'copy-custom-url') { const item = state.customOverlays.find(entry => entry.id === target.dataset.value); if (item) copyText(customOverlayUrl(item)); return; }
  if (action === 'toggle-custom-overlay') {
    commit(draft => { const item = draft.customOverlays.find(entry => entry.id === target.dataset.value); if (!item) return; const now = Date.now(); item.visible = !item.visible; item.transition = { type: item.visible ? 'enter' : 'exit', startedAt: now, expiresAt: now + 650 }; }, { immediate: true });
    return;
  }
  if (action === 'remove-custom-overlay') {
    commit(draft => { draft.customOverlays = draft.customOverlays.filter(entry => entry.id !== target.dataset.value); }, { immediate: true });
    selectedCustomOverlayId = state.customOverlays[0]?.id || '';
    render();
    return;
  }
  if (action === 'hide-all') {
    commit(draft => {
      const now = Date.now();
      if (draft.visible.scoreboard) draft.scoreboardTransition = { type: 'exit', startedAt: now, expiresAt: now + scoreboardTransitionDuration() };
      if (draft.visible.sponsor) draft.sponsorTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorMotionDuration(draft.appearance) };
      if (draft.visible.sponsorBar) draft.sponsorBarTransition = { type: 'exit', startedAt: now, expiresAt: now + sponsorBarMotionDuration(draft.appearance) };
      if (draft.visible.lineup) draft.lineupTransition = { type: 'exit', startedAt: now, expiresAt: now + 600 };
      if (draft.visible.photoLineup) draft.photoLineupTransition = { type: 'exit', startedAt: now, expiresAt: now + 900 };
      for (const item of draft.customOverlays || []) { if (item.visible) { item.visible = false; item.transition = { type: 'exit', startedAt: now, expiresAt: now + 650 }; } }
      draft.visible = { ...draft.visible, scoreboard: false, sponsor: false, sponsorBar: false, lineup: false, photoLineup: false };
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
    openPrintableDocument(`Relatório final · ${finalReport.home.short} ${finalReport.finalScore} ${finalReport.away.short}`, printableReport(finalReport), pdfWindow);
    toast('Partida finalizada. Relatório salvo e PDF preparado.');
    return;
  }
  if (action === 'print-final-report') {
    const finalReport = state.completedReports?.[0] || reportSnapshot(state, true);
    openPrintableDocument(`Relatório final · ${finalReport.home.short} ${finalReport.finalScore} ${finalReport.away.short}`, printableReport(finalReport));
    return;
  }
  if (action === 'print-report' || action === 'print-pregame') {
    const selected = ([reportSnapshot(), ...(state.completedReports || [])])[reportSelection] || reportSnapshot();
    const content = action === 'print-pregame' ? printablePregame() : printableReport(selected);
    openPrintableDocument(action === 'print-pregame' ? `Resumo pré-jogo · ${state.home.short} × ${state.away.short}` : `Relatório · ${selected.home.short} ${selected.finalScore} ${selected.away.short}`, content);
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
  if (action === 'set-team-credentials') {
    const teamIdValue = target.dataset.value;
    const username = document.getElementById(`access-username-${teamIdValue}`)?.value || '';
    const password = document.getElementById(`access-password-${teamIdValue}`)?.value || '';
    if (username.trim().length < 3 || password.trim().length < 8) { toast('Informe usuário (mín. 3 letras) e senha (mín. 8 caracteres).'); return; }
    fetch('/api/auth/team/credentials', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ teamId: teamIdValue, username, password }) })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ok) accessTeamCredentials = [...accessTeamCredentials.filter(entry => entry.teamId !== teamIdValue), { teamId: teamIdValue, username: data.username, updatedAt: Date.now() }];
        toast(ok ? `Acesso de "${data.username}" salvo para a equipe.` : (data.error || 'Falha ao salvar acesso da equipe.'));
        render();
      })
      .catch(() => toast('Falha ao salvar acesso da equipe.'));
    return;
  }
  if (action === 'remove-team-credentials') {
    const teamIdValue = target.dataset.value;
    fetch(`/api/auth/team/credentials?teamId=${encodeURIComponent(teamIdValue)}`, { method: 'DELETE' })
      .then(async response => ({ ok: response.ok, data: await response.json().catch(() => ({})) }))
      .then(({ ok, data }) => {
        if (ok) accessTeamCredentials = accessTeamCredentials.filter(entry => entry.teamId !== teamIdValue);
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
    fetch('/api/auth/admin/accounts', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ username, password }) })
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
  if (action === 'typeface') { if (TYPEFACES[target.dataset.value]) commit(draft => { draft.typeface = target.dataset.value; }); return; }
  if (action === 'scoreboard-style') {
    const style = ['classic', 'glass', 'minimal', 'contrast', 'neon', 'ribbon', 'gradient'].includes(target.dataset.value) ? target.dataset.value : 'classic';
    commit(draft => { draft.appearance.scoreboardStyle = style; }, { immediate: true });
    toast('Estilo do placar atualizado.');
    return;
  }
  if (action === 'scoreboard-layout') {
    const layout = target.dataset.value === 'expanded' ? 'expanded' : 'compact';
    if (layout === state.appearance.scoreboardLayout) return;
    commit(draft => {
      const now = Date.now();
      draft.appearance.scoreboardLayout = layout;
      draft.visible.scoreboard = true;
      draft.scoreboardTransition = null;
      draft.scoreboardMorph = { direction: layout, startedAt: now, expiresAt: now + scoreboardMorphDuration() };
    }, { immediate: true });
    toast(layout === 'expanded' ? 'Placar aberto com nomes completos.' : 'Placar compacto com siglas de 3 letras.');
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

app.addEventListener('click', event => {
  if (event.target.matches('[data-backdrop]')) { drawer = null; render(); return; }
  const actionable = event.target.closest('[data-action]');
  if (actionable) handleAction(actionable.dataset.action, actionable);
});

app.addEventListener('input', event => {
  const target = event.target;
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
    commit(draft => {
      const item = draft.customOverlays.find(entry => entry.id === selectedCustomOverlayId);
      if (!item) return;
      if (field === 'width') item.width = clampNumber(target.value, 200, 3840, item.width);
      else if (field === 'height') item.height = clampNumber(target.value, 100, 2160, item.height);
      else if (['background','accent','textColor'].includes(field)) item[field] = safeColor(target.value, item[field]);
      else if (field === 'layout') item.layout = ['media','text','media-text'].includes(target.value) ? target.value : 'media-text';
      else if (field === 'animation') item.animation = ['fade','slide','zoom'].includes(target.value) ? target.value : 'fade';
      else item[field] = target.value.slice(0, field === 'subtitle' ? 240 : field === 'title' ? 120 : 80);
    }, { backup: false });
    return;
  }
  if (target.matches('[data-portal-team-field]')) {
    const key = target.dataset.portalTeamField;
    if (!teamPortalTeam) return;
    teamPortalTeam[key] = key === 'short' ? target.value.toUpperCase().slice(0, 3) : key === 'color' ? safeColor(target.value, teamPortalTeam.color) : target.value.slice(0, 80);
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
      const numericFields = ['scoreboardScale','scoreboardFont','scoreboardX','scoreboardY','scoreboardRadius','scoreboardSurface','scoreboardAccent','scoreboardAnimationSpeed','periodScale','periodFont','periodSurface','extraTimeScale','eventScale','eventFont','eventX','eventY','lineupScale','lineupFont','lineupX','lineupY','photoLineupScale','photoLineupFont','photoLineupX','photoLineupY','photoLineupSurface','photoLineupRadius','photoLineupSponsorCount','photoLineupSponsorBarSize','photoLineupIndividualDuration','photoLineupPanelDuration','sponsorScale','sponsorFont','sponsorX','sponsorY','sponsorDuration','sponsorAnimationSpeed','sponsorBarDuration','sponsorBarAnimationSpeed','sponsorBarScale','sponsorBarOpacity','sponsorBarRadius','goalWordDuration','goalTeamDuration'];
      if (numericFields.includes(key)) {
        const isPosition = key.endsWith('X') || key.endsWith('Y');
        const bounds = {
          goalWordDuration: [1, 6], goalTeamDuration: [1, 6], sponsorDuration: [3, 60], sponsorBarDuration: [3, 60], scoreboardAnimationSpeed: [50, 160], sponsorAnimationSpeed: [50, 160], sponsorBarAnimationSpeed: [50, 160],
          scoreboardRadius: [0, 20], scoreboardSurface: [55, 100], scoreboardAccent: [0, 8], periodScale: [60,160], periodFont: [60,160], periodSurface: [55,100], extraTimeScale: [60,160], sponsorBarScale: [60, 180], sponsorBarOpacity: [20, 100], sponsorBarRadius: [0, 24],
          photoLineupSurface: [55, 100], photoLineupRadius: [0, 20], photoLineupSponsorCount: [1, 8], photoLineupSponsorBarSize: [60, 180], photoLineupIndividualDuration: [2, 10], photoLineupPanelDuration: [3, 15],
        };
        const [minimum, maximum] = isPosition ? [0, 100] : bounds[key] || [60, 180];
        draft.appearance[key] = clampNumber(target.value, minimum, maximum, draft.appearance[key]);
        if (key === 'eventX') draft.appearance.eventPosition = 'custom';
        if (key === 'sponsorDuration' && draft.visible.sponsor) draft.sponsorExpiresAt = Date.now() + draft.appearance.sponsorDuration * 1000;
      }
      else if (key.endsWith('Typeface')) draft.appearance[key] = TYPEFACES[target.value] ? target.value : 'rajdhani';
      else if (OVERLAY_STYLE_OPTIONS[key]) draft.appearance[key] = OVERLAY_STYLE_OPTIONS[key].some(([value]) => value === target.value) ? target.value : OVERLAY_STYLE_OPTIONS[key][0][0];
      else if (key === 'goalAnimation') draft.appearance[key] = ['typewriter','bounce','sweep'].includes(target.value) ? target.value : 'typewriter';
      else if (key === 'scoreboardAnimation') draft.appearance[key] = ['assemble','slide','zoom','flip','elastic','glitch'].includes(target.value) ? target.value : 'assemble';
      else if (key === 'scoreboardShadow') draft.appearance.scoreboardShadow = ['none','soft','strong'].includes(target.value) ? target.value : 'soft';
      else if (key === 'sponsorAnimation') draft.appearance.sponsorAnimation = ['slide','zoom','flip','fade'].includes(target.value) ? target.value : 'slide';
      else if (key === 'sponsorBarTransition') draft.appearance.sponsorBarTransition = ['fade','slide','zoom'].includes(target.value) ? target.value : 'fade';
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
      draft[key] = key === 'extraTime' ? clampNumber(target.value, 0, 30, 0) : key.toLowerCase().includes('color') || key.startsWith('custom') ? safeColor(target.value, draft[key]) : target.value;
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
  if (target.matches('#active-match-switcher')) {
    const room = String(target.value || '').replace(/[^a-z0-9-]/gi, '').slice(0, 48);
    if (room && room !== ROOM_ID) {
      try { localStorage.setItem('juventude.overlay.lastRoom', room); } catch {}
      location.href = `${location.pathname}?room=${encodeURIComponent(room)}`;
    }
    return;
  }
  if (target.matches('[data-portal-team-logo], [data-portal-athlete-photo], [data-portal-staff-photo], [data-portal-coach-photo], [data-portal-formation]') && teamDelegation.status === 'completed') teamDelegation = { ...teamDelegation, status: 'needs-review' };
  if (target.matches('[data-custom-media]') && target.files?.[0]) {
    const file = target.files[0];
    const overlayId = target.dataset.customMedia;
    const isVideo = file.type.startsWith('video/');
    if ((!isVideo && !file.type.startsWith('image/')) || file.size > 50_000_000) { toast('Escolha uma imagem ou vídeo de até 50 MB.'); return; }
    fetch(`/api/assets/${encodeURIComponent(ROOM_ID)}/custom-${encodeURIComponent(overlayId)}`, { method: 'PUT', headers: { 'content-type': file.type || (isVideo ? 'video/mp4' : 'image/png') }, body: file })
      .then(response => { if (!response.ok) throw new Error(); return response.json(); })
      .then(result => { commit(draft => { const item = draft.customOverlays.find(entry => entry.id === overlayId); if (item) { item.media = `${result.url}?v=${Date.now()}`; item.mediaType = isVideo ? 'video' : 'image'; } }, { immediate: true }); toast('Mídia adicionada ao overlay.'); })
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
render();
if (isTeamPortal) checkTeamSession();
else {
  if (isAdminPanel) checkAdminSession();
  initializeSharedState();
  initializeTeamCatalog();
  setInterval(pollServer, isOutput || isPreview ? 320 : 800);
  setInterval(pollTeamCatalog, isOutput || isPreview ? 1600 : 5000);
  if (isAdminPanel) setInterval(loadOperationsData, 5000);
}
setInterval(() => {
  if (isTeamPortal) return;
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
  setTeamSession(status, teamId, teamName) { teamSession = { status, teamId: teamId || null, teamName: teamName || null, error: '' }; render(); },
};
