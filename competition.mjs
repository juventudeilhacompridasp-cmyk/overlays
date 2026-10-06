// Regras de competição compartilhadas pelo servidor Node (server.mjs) e pelo Worker (build.mjs inlina este arquivo).
// Só funções puras e mutações do "store" de operações; nada aqui depende de Node, de Worker ou do navegador.

export const SPORT_KEYS = ['football', 'futsal', 'volleyball', 'basketball', 'esports', 'other'];
export const FORMATS = ['league', 'groups', 'knockout'];
export const TIEBREAKERS = ['wins', 'goalDiff', 'goalsFor', 'goalsAgainst', 'headToHead', 'fewerCards', 'alphabetical'];
export const DEFAULT_RULES = { pointsWin: 3, pointsDraw: 1, pointsLoss: 0, tiebreakers: ['wins', 'goalDiff', 'goalsFor', 'headToHead'], yellowLimit: 3, redGames: 1 };

function clamp(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(maximum, Math.max(minimum, number)) : fallback;
}

export function slugify(value, fallback = '') {
  const slug = String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return slug || fallback;
}

export function normalizeRules(raw) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const tiebreakers = [...new Set((Array.isArray(source.tiebreakers) ? source.tiebreakers : []).filter(key => TIEBREAKERS.includes(key)))];
  return {
    pointsWin: clamp(source.pointsWin, 0, 10, DEFAULT_RULES.pointsWin),
    pointsDraw: clamp(source.pointsDraw, 0, 10, DEFAULT_RULES.pointsDraw),
    pointsLoss: clamp(source.pointsLoss, 0, 10, DEFAULT_RULES.pointsLoss),
    tiebreakers: tiebreakers.length ? tiebreakers : [...DEFAULT_RULES.tiebreakers],
    yellowLimit: Math.round(clamp(source.yellowLimit, 0, 10, DEFAULT_RULES.yellowLimit)),
    redGames: Math.round(clamp(source.redGames, 0, 10, DEFAULT_RULES.redGames)),
  };
}

// Campos de campeonato acrescentados à versão original (nome, temporada, datas e status).
export function championshipExtras(item, previous = {}, safeId = value => slugify(value)) {
  const source = item && typeof item === 'object' ? item : {};
  const teamIds = (Array.isArray(source.teamIds) ? source.teamIds : previous.teamIds || []).map(value => safeId(value)).filter(Boolean);
  const moderators = (Array.isArray(source.moderators) ? source.moderators : previous.moderators || []).map(value => String(value || '').toLowerCase().trim().slice(0, 40)).filter(Boolean);
  return {
    slug: slugify(source.slug || previous.slug || source.name, ''),
    sport: SPORT_KEYS.includes(source.sport) ? source.sport : SPORT_KEYS.includes(previous.sport) ? previous.sport : 'football',
    format: FORMATS.includes(source.format) ? source.format : FORMATS.includes(previous.format) ? previous.format : 'league',
    description: String(source.description ?? previous.description ?? '').trim().slice(0, 600),
    organizer: slugify(source.organizer ?? previous.organizer ?? '', ''),
    organizerName: String(source.organizerName ?? previous.organizerName ?? '').trim().slice(0, 80),
    isPublic: source.isPublic === undefined ? Boolean(previous.isPublic) : Boolean(source.isPublic),
    rules: normalizeRules(source.rules ?? previous.rules),
    teamIds: [...new Set(teamIds)].slice(0, 128),
    moderators: [...new Set(moderators)].slice(0, 20),
    groups: previous.groups && typeof previous.groups === 'object' ? previous.groups : {},
    knockout: previous.knockout && typeof previous.knockout === 'object' ? previous.knockout : { byes: [], advance: 0, twoLegs: false },
    championId: String(previous.championId || '').slice(0, 64),
    // Dados do sorteio: só mudam por generate-fixtures, save-draw-config e clear-draw (o formulário do campeonato os preserva).
    draw: previous.draw && typeof previous.draw === 'object' ? previous.draw : null,
    drawHistory: Array.isArray(previous.drawHistory) ? previous.drawHistory.slice(0, 10) : [],
    drawConfig: previous.drawConfig && typeof previous.drawConfig === 'object' ? previous.drawConfig : { pots: {}, avoid: [] },
    adjustments: previous.adjustments && typeof previous.adjustments === 'object' ? previous.adjustments : { standings: {}, players: [] },
  };
}

// ---------- Geração de jogos ----------

function shuffle(list, random = Math.random) {
  const copy = [...list];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

// Método do círculo: todos contra todos. Número ímpar de equipes ganha folga (null) que é descartada.
export function roundRobinRounds(teamIds, { doubleRound = false } = {}) {
  const teams = [...teamIds];
  if (teams.length < 2) return [];
  if (teams.length % 2) teams.push(null);
  const half = teams.length / 2;
  const rounds = [];
  let rotation = [...teams];
  for (let round = 0; round < teams.length - 1; round += 1) {
    const pairs = [];
    for (let index = 0; index < half; index += 1) {
      const a = rotation[index];
      const b = rotation[rotation.length - 1 - index];
      if (a === null || b === null) continue;
      // Alterna o mando para equilibrar casa e fora.
      pairs.push((round + index) % 2 === 1 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    rotation = [rotation[0], rotation[rotation.length - 1], ...rotation.slice(1, -1)];
  }
  if (!doubleRound) return rounds;
  return [...rounds, ...rounds.map(pairs => pairs.map(([home, away]) => [away, home]))];
}

export function drawGroups(teamIds, groupCount, random = Math.random, shuffled = true) {
  const count = Math.max(1, Math.min(26, Math.round(groupCount) || 1));
  const order = shuffled ? shuffle(teamIds, random) : [...teamIds];
  const groups = {};
  for (let index = 0; index < count; index += 1) groups[String.fromCharCode(65 + index)] = [];
  const letters = Object.keys(groups);
  order.forEach((teamId, index) => {
    // Serpentina: distribui de forma equilibrada quando o sorteio é por cabeças de chave.
    const lap = Math.floor(index / letters.length);
    const position = index % letters.length;
    groups[letters[lap % 2 === 0 ? position : letters.length - 1 - position]].push(teamId);
  });
  return groups;
}

export function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

export function knockoutRoundName(teamsInRound) {
  if (teamsInRound <= 2) return 'Final';
  if (teamsInRound === 4) return 'Semifinal';
  if (teamsInRound === 8) return 'Quartas de final';
  if (teamsInRound === 16) return 'Oitavas de final';
  return `Fase de ${teamsInRound}`;
}

// Ordem de chaveamento padrão (1 contra S, melhores semeados só se enfrentam nas fases finais).
export function bracketOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap(seed => [seed, total - seed]);
  }
  return order;
}

// Primeira rodada de mata-mata a partir de uma lista de cabeças de chave (índice 0 = melhor).
// Se o total não é potência de 2, as melhores equipes ficam isentas (byes) e entram na rodada seguinte.
export function firstKnockoutRound(seeds) {
  const teams = [...seeds];
  if (teams.length < 2) return { pairs: [], byes: teams };
  const size = nextPowerOfTwo(teams.length);
  if (size === teams.length) {
    const order = bracketOrder(size);
    const pairs = [];
    for (let index = 0; index < size; index += 2) pairs.push([teams[order[index] - 1], teams[order[index + 1] - 1]]);
    return { pairs, byes: [] };
  }
  const byes = teams.slice(0, size - teams.length === 0 ? 0 : size - teams.length);
  const playing = teams.slice(byes.length);
  const pairs = [];
  for (let index = 0; index < playing.length / 2; index += 1) pairs.push([playing[index], playing[playing.length - 1 - index]]);
  return { pairs, byes };
}

// Rodada seguinte: isentos (melhores) + vencedores na ordem dos jogos; pareia extremos quando houve isentos.
export function nextKnockoutRound(winners, byes = []) {
  const entries = [...byes, ...winners];
  const pairs = [];
  if (byes.length) {
    for (let index = 0; index < Math.floor(entries.length / 2); index += 1) pairs.push([entries[index], entries[entries.length - 1 - index]]);
  } else {
    for (let index = 0; index + 1 < entries.length; index += 2) pairs.push([entries[index], entries[index + 1]]);
  }
  return { pairs, odd: entries.length % 2 ? entries[entries.length - 1] : '' };
}

export function scheduleSlots({ startDate = '', time = '15:00', intervalDays = 7, slotMinutes = 90 } = {}) {
  const base = /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? new Date(`${startDate}T12:00:00Z`) : null;
  const [hour, minute] = /^\d{2}:\d{2}$/.test(time) ? time.split(':').map(Number) : [15, 0];
  return (roundIndex, slotIndex) => {
    if (!base) return '';
    const day = new Date(base.getTime() + roundIndex * Math.max(0, intervalDays) * 86400000);
    const minutes = hour * 60 + minute + slotIndex * Math.max(30, slotMinutes);
    const date = new Date(day.getTime() + Math.floor(minutes / 1440) * 86400000);
    const clock = minutes % 1440;
    return `${date.toISOString().slice(0, 10)}T${String(Math.floor(clock / 60)).padStart(2, '0')}:${String(clock % 60).padStart(2, '0')}`;
  };
}

// ---------- Resultados e classificação ----------

export function resultOf(match, roomScore) {
  const home = Number.isFinite(Number(match?.homeScore)) && match?.homeScore !== null && match?.homeScore !== '' ? Number(match.homeScore) : null;
  const away = Number.isFinite(Number(match?.awayScore)) && match?.awayScore !== null && match?.awayScore !== '' ? Number(match.awayScore) : null;
  if (home !== null && away !== null) return { home, away, source: 'match' };
  if (roomScore && Number.isFinite(roomScore.home) && Number.isFinite(roomScore.away)) return { home: roomScore.home, away: roomScore.away, source: 'room' };
  return null;
}

function penaltiesOf(match) {
  const home = match?.homePenalties === null || match?.homePenalties === undefined || match?.homePenalties === '' ? null : Number(match.homePenalties);
  const away = match?.awayPenalties === null || match?.awayPenalties === undefined || match?.awayPenalties === '' ? null : Number(match.awayPenalties);
  return Number.isFinite(home) && Number.isFinite(away) ? { home, away } : null;
}

// Vencedor de uma partida única (empate resolvido por pênaltis) ou null quando indefinido.
export function matchWinner(match, result) {
  if (!result) return '';
  if (result.home > result.away) return match.homeTeamId;
  if (result.away > result.home) return match.awayTeamId;
  const penalties = penaltiesOf(match);
  if (penalties && penalties.home !== penalties.away) return penalties.home > penalties.away ? match.homeTeamId : match.awayTeamId;
  return '';
}

export function computeStandings(matches, resultsByMatch, { rules = DEFAULT_RULES, teamIds = [], names = {}, cards = {}, adjust = {} } = {}) {
  const config = normalizeRules(rules);
  const rows = new Map();
  const row = id => {
    if (!rows.has(id)) rows.set(id, { teamId: id, name: names[id] || id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0, form: [], cards: cards[id] || 0 });
    return rows.get(id);
  };
  teamIds.forEach(row);
  const played = [];
  for (const match of matches) {
    const result = resultsByMatch[match.id];
    if (!result || match.status === 'cancelled') continue;
    if (match.status !== 'finished') continue;
    const home = row(match.homeTeamId);
    const away = row(match.awayTeamId);
    home.played += 1; away.played += 1;
    home.gf += result.home; home.ga += result.away; away.gf += result.away; away.ga += result.home;
    if (result.home > result.away) { home.won += 1; away.lost += 1; home.points += config.pointsWin; away.points += config.pointsLoss; home.form.push('V'); away.form.push('D'); }
    else if (result.home < result.away) { away.won += 1; home.lost += 1; away.points += config.pointsWin; home.points += config.pointsLoss; away.form.push('V'); home.form.push('D'); }
    else { home.drawn += 1; away.drawn += 1; home.points += config.pointsDraw; away.points += config.pointsDraw; home.form.push('E'); away.form.push('E'); }
    played.push({ match, result });
  }
  // Ajustes manuais (campeonato já em andamento ou punições): somados ao que as partidas cadastradas geraram.
  for (const [id, delta] of Object.entries(adjust || {})) {
    const target = rows.get(id);
    if (!target || !delta) continue;
    for (const key of ['played', 'won', 'drawn', 'lost', 'gf', 'ga', 'points']) target[key] += Number(delta[key]) || 0;
  }
  for (const entry of rows.values()) { entry.gd = entry.gf - entry.ga; entry.form = entry.form.slice(-5); }

  const miniTable = cluster => {
    const ids = new Set(cluster.map(item => item.teamId));
    const mini = new Map(cluster.map(item => [item.teamId, { points: 0, gd: 0, gf: 0 }]));
    for (const { match, result } of played) {
      if (!ids.has(match.homeTeamId) || !ids.has(match.awayTeamId)) continue;
      const home = mini.get(match.homeTeamId); const away = mini.get(match.awayTeamId);
      home.gf += result.home; away.gf += result.away; home.gd += result.home - result.away; away.gd += result.away - result.home;
      if (result.home > result.away) home.points += config.pointsWin; else if (result.home < result.away) away.points += config.pointsWin; else { home.points += config.pointsDraw; away.points += config.pointsDraw; }
    }
    return mini;
  };

  const keys = {
    wins: item => -item.won, goalDiff: item => -item.gd, goalsFor: item => -item.gf, goalsAgainst: item => item.ga, fewerCards: item => item.cards,
    alphabetical: item => item.name.toLocaleLowerCase('pt-BR'),
  };
  const split = (cluster, getKey) => {
    const buckets = new Map();
    for (const item of cluster) { const key = getKey(item); buckets.set(key, [...(buckets.get(key) || []), item]); }
    return [...buckets.entries()].sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0)).map(entry => entry[1]);
  };
  const resolve = (cluster, index) => {
    if (cluster.length <= 1) return cluster;
    if (index >= config.tiebreakers.length) return [...cluster].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    const criterion = config.tiebreakers[index];
    if (criterion === 'headToHead') {
      const mini = miniTable(cluster);
      const groups = split(cluster, item => { const value = mini.get(item.teamId); return -(value.points * 1e6 + value.gd * 1e3 + value.gf); });
      return groups.flatMap(group => (group.length === cluster.length ? resolve(group, index + 1) : resolve(group, index)));
    }
    return split(cluster, keys[criterion]).flatMap(group => resolve(group, index + 1));
  };
  const byPoints = split([...rows.values()], item => -item.points);
  return byPoints.flatMap(group => resolve(group, 0)).map((item, position) => ({ ...item, position: position + 1 }));
}

// ---------- Eventos (gols, cartões) vindos do estado de cada sala de transmissão ----------

export function parseRoomEvents(roomState) {
  const home = String(roomState?.home?.short || '');
  const away = String(roomState?.away?.short || '');
  const events = [];
  for (const event of [...(Array.isArray(roomState?.events) ? roomState.events : [])].reverse()) {
    const title = String(event?.title || '').toLocaleLowerCase('pt-BR');
    const kind = /go+l|cesta|ponto/.test(title) ? 'goal' : /amarelo/.test(title) ? 'yellow' : /vermelho/.test(title) ? 'red' : /substitui/.test(title) ? 'sub' : '';
    const side = event?.team === home ? 'home' : event?.team === away ? 'away' : '';
    if (!kind || !side) continue;
    events.push({ kind, side, minute: String(event.minute || '').slice(0, 12), name: String(event.name || '').trim().slice(0, 80), note: String(event.note || '').slice(0, 80) });
  }
  return events;
}

export function roomScore(roomState) {
  const home = Number(roomState?.home?.score);
  const away = Number(roomState?.away?.score);
  return Number.isFinite(home) && Number.isFinite(away) && roomState?.updatedAt ? { home, away } : null;
}

export function aggregateStats(matches, eventsByMatch, rules = DEFAULT_RULES, names = {}, adjustments = []) {
  const config = normalizeRules(rules);
  const scorers = new Map();
  const discipline = new Map();
  const cardsByTeam = {};
  const entry = (map, name, teamId) => {
    const key = `${name}|${teamId}`;
    if (!map.has(key)) map.set(key, { name, teamId, teamName: names[teamId] || teamId, goals: 0, yellow: 0, red: 0 });
    return map.get(key);
  };
  const counted = matches.filter(match => ['finished', 'live'].includes(match.status));
  for (const match of counted) {
    for (const event of eventsByMatch[match.id] || []) {
      const teamId = event.side === 'home' ? match.homeTeamId : match.awayTeamId;
      if (event.kind === 'yellow') cardsByTeam[teamId] = (cardsByTeam[teamId] || 0) + 1;
      if (event.kind === 'red') cardsByTeam[teamId] = (cardsByTeam[teamId] || 0) + 3;
      if (!event.name) continue;
      if (event.kind === 'goal') entry(scorers, event.name, teamId).goals += 1;
      else if (event.kind === 'yellow') entry(discipline, event.name, teamId).yellow += 1;
      else if (event.kind === 'red') entry(discipline, event.name, teamId).red += 1;
    }
  }
  for (const adj of Array.isArray(adjustments) ? adjustments : []) {
    if (!adj || !adj.name || !adj.teamId) continue;
    if (adj.goals) entry(scorers, adj.name, adj.teamId).goals += adj.goals;
    if (adj.yellow) { entry(discipline, adj.name, adj.teamId).yellow += adj.yellow; cardsByTeam[adj.teamId] = (cardsByTeam[adj.teamId] || 0) + adj.yellow; }
    if (adj.red) { entry(discipline, adj.name, adj.teamId).red += adj.red; cardsByTeam[adj.teamId] = (cardsByTeam[adj.teamId] || 0) + adj.red * 3; }
  }
  // Suspensão: cartão vermelho = redGames jogos; cada yellowLimit amarelos = 1 jogo. Cumpre-se nos jogos
  // finalizados seguintes da própria equipe; o que ainda sobra vale para a próxima partida.
  const owed = new Map();
  const yellows = new Map();
  const roster = new Map();
  const finished = counted.filter(match => match.status === 'finished').sort((a, b) => String(a.kickoffAt || '').localeCompare(String(b.kickoffAt || '')));
  for (const match of finished) {
    const serving = [...owed].filter(([key, games]) => games > 0 && [match.homeTeamId, match.awayTeamId].includes(key.split('|')[1])).map(([key]) => key);
    for (const event of eventsByMatch[match.id] || []) {
      if ((event.kind !== 'yellow' && event.kind !== 'red') || !event.name) continue;
      const teamId = event.side === 'home' ? match.homeTeamId : match.awayTeamId;
      const key = `${event.name}|${teamId}`;
      roster.set(key, { name: event.name, teamId });
      if (event.kind === 'red') owed.set(key, (owed.get(key) || 0) + config.redGames);
      else if (config.yellowLimit) {
        yellows.set(key, (yellows.get(key) || 0) + 1);
        if (yellows.get(key) >= config.yellowLimit) { yellows.set(key, 0); owed.set(key, (owed.get(key) || 0) + 1); }
      }
    }
    for (const key of serving) owed.set(key, owed.get(key) - 1);
  }
  return {
    scorers: [...scorers.values()].sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 30).map(({ name, teamId, teamName, goals }) => ({ name, teamId, teamName, goals })),
    cards: [...discipline.values()].sort((a, b) => (b.red * 3 + b.yellow) - (a.red * 3 + a.yellow) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, 40).map(({ name, teamId, teamName, yellow, red }) => ({ name, teamId, teamName, yellow, red })),
    players: [...new Set([...scorers.keys(), ...discipline.keys()])].map(key => ({ name: (scorers.get(key) || discipline.get(key)).name, teamId: (scorers.get(key) || discipline.get(key)).teamId, goals: scorers.get(key)?.goals || 0, yellow: discipline.get(key)?.yellow || 0, red: discipline.get(key)?.red || 0 })),
    suspended: [...owed].filter(([, games]) => games > 0).map(([key, games]) => ({ ...roster.get(key), teamName: names[roster.get(key).teamId] || roster.get(key).teamId, games })),
    cardsByTeam,
  };
}

// Resultados (placar da partida ou, na falta dele, da sala de transmissão) e eventos de cada partida.
export async function collectResults(matches, getRoomState) {
  const resultsByMatch = {};
  const eventsByMatch = {};
  for (const match of matches) {
    if (!['finished', 'live'].includes(match.status)) continue;
    const room = await getRoomState(match.room);
    const result = resultOf(match, roomScore(room));
    if (result) resultsByMatch[match.id] = result;
    eventsByMatch[match.id] = parseRoomEvents(room);
  }
  return { resultsByMatch, eventsByMatch };
}

// ---------- Ações sobre o store de operações (mutam o store; devolvem { error, status } em caso de recusa) ----------

const MATCH_STATUS = ['scheduled', 'live', 'finished', 'cancelled'];

export function canManageChampionship(admin, championship) {
  if (!admin) return false;
  if (admin.role === 'admin' || !admin.role) return true;
  if (admin.role === 'operator') return !championship?.moderators?.length || championship.moderators.includes(String(admin.username || '').toLowerCase());
  return false;
}

function numberOrNull(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Math.round(Number(value));
  return Number.isFinite(number) && number >= 0 && number < 1000 ? number : null;
}

function uniqueRoom(store, base) {
  const taken = new Set(store.matches.map(match => match.room));
  let room = base.slice(0, 48) || 'partida';
  let counter = 2;
  while (taken.has(room)) { const suffix = `-${counter}`; room = `${base.slice(0, 48 - suffix.length)}${suffix}`; counter += 1; }
  return room;
}

function buildMatches(store, championship, plannedRounds, { stage, schedule, venue, roundOffset = 0, group = '', now, idPrefix }) {
  const created = [];
  plannedRounds.forEach((round, roundIndex) => {
    round.pairs.forEach(([home, away], slotIndex) => {
      const roundNumber = roundOffset + roundIndex + 1;
      const id = `${idPrefix}-${stage[0]}${roundNumber}-${group ? group.toLowerCase() : ''}${slotIndex + 1}-${Math.random().toString(36).slice(2, 6)}`.slice(0, 64);
      const room = uniqueRoom(store, slugify(`${championship.slug || championship.id}-${stage === 'knockout' ? 'k' : 'r'}${roundNumber}${group ? `-${group.toLowerCase()}` : ''}-${slotIndex + 1}`));
      const match = {
        id, championshipId: championship.id, homeTeamId: home, awayTeamId: away, kickoffAt: schedule(roundIndex, slotIndex),
        venue: String(venue || '').slice(0, 120), registrationDeadline: '', round: round.label, status: 'scheduled', room, updatedAt: now,
        stage, group, roundNumber, leg: round.leg || 0, homeScore: null, awayScore: null, homePenalties: null, awayPenalties: null, generated: true,
      };
      store.matches.push(match);
      created.push(match);
    });
  });
  return created;
}

export function matchExtras(item, previous = {}) {
  const pick = key => (item && item[key] !== undefined ? item[key] : previous[key]);
  return {
    stage: ['league', 'group', 'knockout'].includes(pick('stage')) ? pick('stage') : 'league',
    group: String(pick('group') || '').slice(0, 2).toUpperCase(),
    roundNumber: Math.round(clamp(pick('roundNumber'), 0, 200, 0)),
    leg: Math.round(clamp(pick('leg'), 0, 2, 0)),
    generated: Boolean(previous.generated),
    homeScore: numberOrNull(pick('homeScore')), awayScore: numberOrNull(pick('awayScore')),
    homePenalties: numberOrNull(pick('homePenalties')), awayPenalties: numberOrNull(pick('awayPenalties')),
    // Controle de reagendamento: só muda por reschedule-match/shift-matches; o formulário de partida apenas preserva.
    originalKickoffAt: String(previous.originalKickoffAt || '').slice(0, 24),
    rescheduleKind: ['postponed', 'advanced'].includes(previous.rescheduleKind) ? previous.rescheduleKind : '',
    postponeReason: String(previous.postponeReason || '').slice(0, 200),
    rescheduleHistory: Array.isArray(previous.rescheduleHistory) ? previous.rescheduleHistory.slice(0, 20) : [],
  };
}


// ---------- Sorteio: potes, restrições, travas, pré-visualização e confirmação ----------

function lcg(seed) {
  let value = seed >>> 0 || 1;
  return () => { value = (value * 1664525 + 1013904223) >>> 0; return value / 4294967296; };
}

export const DRAW_MAX_POT = 8;

function normalizePots(raw, teamIds) {
  const pots = {};
  if (raw && typeof raw === 'object') for (const id of teamIds) { const value = Math.round(Number(raw[id])); if (value >= 1 && value <= DRAW_MAX_POT) pots[id] = value; }
  return pots;
}

function normalizeAvoid(raw, teamIds) {
  const known = new Set(teamIds);
  const seen = new Set();
  const pairs = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    const [a, b] = Array.isArray(entry) ? entry : [];
    if (!known.has(a) || !known.has(b) || a === b) continue;
    const key = [a, b].sort().join('|');
    if (seen.has(key)) continue;
    seen.add(key); pairs.push([a, b]);
  }
  return pairs.slice(0, 60);
}

// Sorteio de grupos por potes (um de cada pote por grupo, sempre que possível), com equipes travadas e pares que não podem se enfrentar.
// Devolve null se as restrições forem impossíveis. Sem potes, trava ou restrição, o chamador usa drawGroups (comportamento histórico).
export function drawGroupsConstrained(teamIds, groupCount, random, { pots = {}, avoid = [], locked = {} } = {}) {
  const letters = Array.from({ length: Math.max(1, Math.min(26, groupCount)) }, (_, index) => String.fromCharCode(65 + index));
  const sizes = Object.fromEntries(letters.map((letter, index) => [letter, Math.floor(teamIds.length / letters.length) + (index < teamIds.length % letters.length ? 1 : 0)]));
  const enemies = new Map();
  for (const [a, b] of avoid) { enemies.set(a, [...(enemies.get(a) || []), b]); enemies.set(b, [...(enemies.get(b) || []), a]); }
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const groups = Object.fromEntries(letters.map(letter => [letter, []]));
    const where = {};
    let ok = true;
    for (const [id, letter] of Object.entries(locked)) {
      if (!teamIds.includes(id) || !groups[letter] || groups[letter].length >= sizes[letter] || (enemies.get(id) || []).some(other => where[other] === letter)) { ok = false; break; }
      groups[letter].push(id); where[id] = letter;
    }
    if (!ok) return null;
    const free = teamIds.filter(id => !where[id]);
    const potValues = [...new Set(free.map(id => pots[id] || 1))].sort((a, b) => a - b);
    for (const pot of potValues) {
      for (const id of shuffle(free.filter(team => (pots[team] || 1) === pot), random)) {
        const open = letters.filter(letter => groups[letter].length < sizes[letter] && !(enemies.get(id) || []).some(other => where[other] === letter));
        if (!open.length) { ok = false; break; }
        const samePot = letter => groups[letter].filter(team => (pots[team] || 1) === pot).length;
        const least = Math.min(...open.map(samePot));
        const candidates = open.filter(letter => samePot(letter) === least);
        const letter = candidates[Math.floor(random() * candidates.length)];
        groups[letter].push(id); where[id] = letter;
      }
      if (!ok) break;
    }
    if (ok) return groups;
  }
  return null;
}

function drawMatchCount(mode, teamCount, groups, options) {
  const robin = size => size * (size - 1) / 2 * (options.doubleRound ? 2 : 1);
  if (mode === 'league') return robin(teamCount);
  if (mode === 'groups') return Object.values(groups || {}).reduce((total, members) => total + robin(members.length), 0);
  const size = nextPowerOfTwo(teamCount);
  const pairs = size === teamCount ? teamCount / 2 : teamCount - size / 2;
  return pairs * (options.twoLegs && size > 2 ? 2 : 1);
}

// Decide o sorteio (aleatório com potes/restrições ou explícito vindo do administrador). Não altera o store.
export function planDraw(championship, candidate, ctx) {
  const teamIds = [...new Set((Array.isArray(candidate.teamIds) ? candidate.teamIds : championship.teamIds || []).map(value => ctx.safeId(value)).filter(Boolean))];
  const mode = FORMATS.includes(candidate.mode) ? candidate.mode : championship.format || 'league';
  if (teamIds.length < 2) return { status: 400, error: 'Vincule ao menos 2 equipes ao campeonato para sortear.' };
  const config = championship.drawConfig || {};
  const pots = normalizePots(candidate.pots ?? config.pots, teamIds);
  const avoid = normalizeAvoid(candidate.avoid ?? config.avoid, teamIds);
  const seed = Number.isInteger(candidate.seed) && candidate.seed > 0 ? candidate.seed >>> 0 : Math.floor(Math.random() * 2147483646) + 1;
  const random = lcg(seed);
  const options = { doubleRound: Boolean(candidate.doubleRound), twoLegs: Boolean(candidate.twoLegs) };
  const warnings = [];
  const plan = { mode, teamIds, seed, pots, avoid, groups: {}, order: [], pairs: [], byes: [], advance: 0, manual: false, warnings };
  const permutation = list => Array.isArray(list) && list.length === teamIds.length && teamIds.every(id => list.includes(id)) && new Set(list).size === list.length;
  if (mode === 'groups') {
    const explicit = candidate.assignment && typeof candidate.assignment === 'object' ? candidate.assignment : null;
    const count = explicit ? Object.keys(explicit).length : Math.max(2, Math.min(teamIds.length >> 1, Math.round(Number(candidate.groups)) || 2));
    if (explicit) {
      const letters = Object.keys(explicit);
      const flat = letters.flatMap(letter => Array.isArray(explicit[letter]) ? explicit[letter].map(value => ctx.safeId(value)) : []);
      if (letters.length < 2 || letters.length > 26 || !letters.every((letter, index) => letter === String.fromCharCode(65 + index)) || !permutation(flat)) return { status: 400, error: 'A distribuição dos grupos precisa conter cada equipe vinculada exatamente uma vez.' };
      plan.groups = Object.fromEntries(letters.map(letter => [letter, explicit[letter].map(value => ctx.safeId(value))]));
      plan.manual = true;
    } else {
      const locked = {};
      for (const [id, letter] of Object.entries(candidate.locked && typeof candidate.locked === 'object' ? candidate.locked : {})) if (teamIds.includes(ctx.safeId(id))) locked[ctx.safeId(id)] = String(letter).toUpperCase().slice(0, 1);
      const constrained = Object.keys(pots).length || avoid.length || Object.keys(locked).length;
      if (constrained) {
        const groups = drawGroupsConstrained(teamIds, count, random, { pots, avoid, locked });
        if (!groups) return { status: 409, error: 'Não foi possível sortear respeitando as restrições (equipes travadas e pares que não podem se enfrentar). Afrouxe alguma regra.' };
        plan.groups = groups;
      } else plan.groups = drawGroups(teamIds, count, random, candidate.shuffle !== false);
    }
    plan.advance = Math.max(1, Math.min(4, Math.round(Number(candidate.advance)) || 2));
    plan.order = Object.values(plan.groups).flat();
    const sizes = Object.values(plan.groups).map(members => members.length);
    if (Math.max(...sizes) - Math.min(...sizes) > 1) warnings.push('Os grupos ficaram com tamanhos diferentes.');
    if (sizes.some(size => size < 2)) warnings.push('Há grupo com menos de 2 equipes: ele não terá partidas.');
    const biggestPot = Math.max(0, ...Object.values(Object.values(pots).reduce((tally, pot) => ({ ...tally, [pot]: (tally[pot] || 0) + 1 }), {})));
    if (biggestPot > count) warnings.push('Algum pote tem mais equipes que grupos; duas do mesmo pote cairão juntas.');
  } else {
    if (Array.isArray(candidate.order)) {
      const order = candidate.order.map(value => ctx.safeId(value));
      if (!permutation(order)) return { status: 400, error: 'A ordem das equipes precisa conter cada equipe vinculada exatamente uma vez.' };
      plan.order = order; plan.manual = true;
    } else if (candidate.shuffle === false) plan.order = teamIds;
    else if (Object.keys(pots).length && mode === 'knockout') {
      // Cabeças de chave: o pote 1 forma os melhores semeados; dentro de cada pote a ordem é sorteada.
      const byPot = {};
      for (const id of teamIds) { const pot = pots[id] || DRAW_MAX_POT + 1; byPot[pot] = [...(byPot[pot] || []), id]; }
      plan.order = Object.keys(byPot).map(Number).sort((a, b) => a - b).flatMap(pot => shuffle(byPot[pot], random));
    } else plan.order = shuffle(teamIds, random);
    if (mode === 'knockout') {
      const { pairs, byes } = firstKnockoutRound(plan.order);
      plan.pairs = pairs; plan.byes = byes;
      if (byes.length) warnings.push(`${byes.length} equipe(s) avançam direto para a segunda fase (folga).`);
    }
  }
  plan.matchCount = drawMatchCount(mode, teamIds.length, plan.groups, options);
  return plan;
}

// Pré-visualização: calcula o sorteio sem gravar nada.
export function previewDraw(store, candidate, admin, ctx) {
  const championship = store.championships.find(item => item.id === ctx.safeId(candidate.championshipId));
  if (!championship) return { status: 404, error: 'Campeonato não encontrado.' };
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const plan = planDraw(championship, candidate, ctx);
  if (plan.error) return plan;
  const existing = store.matches.filter(match => match.championshipId === championship.id);
  return { mode: plan.mode, seed: plan.seed, groups: plan.groups, order: plan.order, pairs: plan.pairs, byes: plan.byes, advance: plan.advance, matchCount: plan.matchCount, warnings: plan.warnings, manual: plan.manual, hasGenerated: existing.some(match => match.generated), started: existing.some(match => match.generated && ['live', 'finished'].includes(match.status)) };
}

// Guarda potes e pares que não podem se enfrentar, para o sorteio poder ser configurado antes de ser feito.
export function saveDrawConfig(store, candidate, admin, ctx) {
  const championship = store.championships.find(item => item.id === ctx.safeId(candidate.championshipId));
  if (!championship) return { status: 404, error: 'Campeonato não encontrado.' };
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const teamIds = championship.teamIds || [];
  championship.drawConfig = { pots: normalizePots(candidate.pots, teamIds), avoid: normalizeAvoid(candidate.avoid, teamIds) };
  championship.updatedAt = ctx.now();
  ctx.addAudit(store, 'draw.configured', admin.username, championship.name, `${Object.keys(championship.drawConfig.pots).length} equipe(s) em potes · ${championship.drawConfig.avoid.length} restrição(ões)`);
  return {};
}

// Desfaz o sorteio: remove as partidas geradas (se nenhuma começou) e limpa grupos, chaveamento e campeão.
export function clearDraw(store, candidate, admin, ctx) {
  const championship = store.championships.find(item => item.id === ctx.safeId(candidate.championshipId));
  if (!championship) return { status: 404, error: 'Campeonato não encontrado.' };
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const generated = store.matches.filter(match => match.championshipId === championship.id && match.generated);
  if (generated.some(match => ['live', 'finished'].includes(match.status))) return { status: 409, error: 'Há partidas sorteadas já iniciadas ou finalizadas; não é possível desfazer o sorteio.' };
  store.matches = store.matches.filter(match => !(match.championshipId === championship.id && match.generated));
  championship.groups = {}; championship.knockout = { byes: [], advance: 0, twoLegs: false }; championship.championId = ''; championship.draw = null;
  championship.updatedAt = ctx.now();
  ctx.addAudit(store, 'draw.cleared', admin.username, championship.name, `${generated.length} partida(s) removida(s)`);
  return { removed: generated.length };
}

export function generateFixtures(store, candidate, admin, ctx) {
  const championship = store.championships.find(item => item.id === ctx.safeId(candidate.championshipId));
  if (!championship) return { status: 404, error: 'Campeonato não encontrado.' };
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const plan = planDraw(championship, candidate, ctx);
  if (plan.error) return plan;
  const { teamIds, mode } = plan;
  const existing = store.matches.filter(match => match.championshipId === championship.id);
  const playedGenerated = existing.some(match => match.generated && (match.status === 'finished' || match.status === 'live'));
  if (existing.some(match => match.generated) && !candidate.replace) return { status: 409, error: 'Este campeonato já tem partidas geradas. Marque "substituir" para gerar de novo.' };
  if (candidate.replace && playedGenerated) return { status: 409, error: 'Há partidas geradas já iniciadas ou finalizadas; elas não podem ser substituídas.' };
  const schedule = scheduleSlots({ startDate: String(candidate.startDate || ''), time: String(candidate.time || '15:00'), intervalDays: clamp(candidate.intervalDays, 1, 60, 7), slotMinutes: clamp(candidate.slotMinutes, 30, 600, 90) });
  const venue = candidate.venue;
  if (candidate.replace) store.matches = store.matches.filter(match => !(match.championshipId === championship.id && match.generated));
  championship.teamIds = teamIds;
  championship.format = mode;
  championship.groups = {};
  championship.knockout = { byes: [], advance: 0, twoLegs: Boolean(candidate.twoLegs) };
  championship.championId = '';
  const now = ctx.now();
  const prefix = (championship.slug || championship.id).slice(0, 20);
  let created = [];
  if (mode === 'league') {
    const rounds = roundRobinRounds(plan.order, { doubleRound: Boolean(candidate.doubleRound) });
    created = buildMatches(store, championship, rounds.map((pairs, index) => ({ pairs, label: `Rodada ${index + 1}` })), { stage: 'league', schedule, venue, now, idPrefix: prefix });
  } else if (mode === 'groups') {
    championship.groups = plan.groups;
    championship.knockout.advance = plan.advance;
    for (const [letter, members] of Object.entries(championship.groups)) {
      const rounds = roundRobinRounds(members, { doubleRound: Boolean(candidate.doubleRound) });
      created.push(...buildMatches(store, championship, rounds.map((pairs, index) => ({ pairs, label: `Grupo ${letter} · Rodada ${index + 1}` })), { stage: 'group', group: letter, schedule, venue, now, idPrefix: prefix }));
    }
  } else {
    const { pairs, byes } = { pairs: plan.pairs, byes: plan.byes };
    championship.knockout.byes = byes;
    const teamsInRound = nextPowerOfTwo(plan.order.length);
    created = buildMatches(store, championship, [{ pairs, label: knockoutRoundName(teamsInRound) }], { stage: 'knockout', schedule, venue, now, idPrefix: prefix });
    if (championship.knockout.twoLegs && teamsInRound > 2) {
      const legTwo = buildMatches(store, championship, [{ pairs: pairs.map(([home, away]) => [away, home]), label: `${knockoutRoundName(teamsInRound)} · volta`, leg: 2 }], { stage: 'knockout', schedule: (roundIndex, slotIndex) => schedule(roundIndex + 1, slotIndex), venue, now, idPrefix: prefix });
      created.forEach(match => { match.leg = 1; match.round = `${match.round} · ida`; });
      created.push(...legTwo);
    }
  }
  championship.updatedAt = now;
  championship.draw = { seed: plan.seed, mode, at: now, by: String(admin.username || '').slice(0, 80), manual: plan.manual, groups: plan.groups, order: plan.order };
  championship.drawHistory = [{ at: now, by: String(admin.username || '').slice(0, 80), seed: plan.seed, mode, teams: teamIds.length, matches: created.length, manual: plan.manual }, ...(championship.drawHistory || [])].slice(0, 10);
  ctx.addAudit(store, 'fixtures.generated', admin.username, championship.name, `${created.length} partidas · ${mode} · semente ${plan.seed}`);
  return { created: created.length, seed: plan.seed };
}

function tieWinner(legs, resultsByMatch) {
  if (legs.length === 1) return matchWinner(legs[0], resultsByMatch[legs[0].id]);
  const totals = new Map();
  for (const match of legs) {
    const result = resultsByMatch[match.id];
    if (!result) return '';
    totals.set(match.homeTeamId, (totals.get(match.homeTeamId) || 0) + result.home);
    totals.set(match.awayTeamId, (totals.get(match.awayTeamId) || 0) + result.away);
  }
  const [a, b] = [...totals.keys()];
  if (totals.get(a) !== totals.get(b)) return totals.get(a) > totals.get(b) ? a : b;
  const last = legs[legs.length - 1];
  const penalties = penaltiesOf(last);
  if (penalties && penalties.home !== penalties.away) return penalties.home > penalties.away ? last.homeTeamId : last.awayTeamId;
  return '';
}

export function groupQualifiers(championship, matches, resultsByMatch, names, cardsByTeam = {}) {
  const advance = championship.knockout?.advance || 2;
  const perGroup = Object.entries(championship.groups || {}).map(([letter, members]) => ({
    letter,
    table: computeStandings(matches.filter(match => match.group === letter), resultsByMatch, { rules: championship.rules, teamIds: members, names, cards: cardsByTeam }),
  }));
  const seeds = [];
  for (let place = 0; place < advance; place += 1) for (const { table } of perGroup) if (table[place]) seeds.push(table[place].teamId);
  return { perGroup, seeds, advance };
}

export function generateNextRound(store, candidate, admin, ctx) {
  const championship = store.championships.find(item => item.id === ctx.safeId(candidate.championshipId));
  if (!championship) return { status: 404, error: 'Campeonato não encontrado.' };
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const matches = store.matches.filter(match => match.championshipId === championship.id);
  const resultsByMatch = ctx.resultsByMatch || {};
  const names = ctx.names || {};
  const schedule = scheduleSlots({ startDate: String(candidate.startDate || ''), time: String(candidate.time || '15:00'), intervalDays: clamp(candidate.intervalDays, 1, 60, 7), slotMinutes: clamp(candidate.slotMinutes, 30, 600, 90) });
  const now = ctx.now();
  const prefix = (championship.slug || championship.id).slice(0, 20);
  const knockout = matches.filter(match => match.stage === 'knockout');
  const groupMatches = matches.filter(match => match.stage === 'group');
  const finishedAll = list => list.length > 0 && list.every(match => match.status === 'finished' && resultsByMatch[match.id]);
  let seeds = [];
  let byes = [];
  let roundNumber = 1;
  if (!knockout.length) {
    if (!groupMatches.length) return { status: 400, error: 'Este campeonato não tem fase de grupos nem mata-mata em andamento.' };
    if (!finishedAll(groupMatches)) return { status: 409, error: 'Finalize todas as partidas da fase de grupos antes de gerar o mata-mata.' };
    seeds = groupQualifiers(championship, groupMatches, resultsByMatch, names, ctx.cardsByTeam).seeds;
    const first = firstKnockoutRound(seeds);
    byes = first.byes;
    championship.knockout = { ...championship.knockout, byes };
    const teamsInRound = nextPowerOfTwo(seeds.length);
    const created = buildMatches(store, championship, [{ pairs: first.pairs, label: knockoutRoundName(teamsInRound) }], { stage: 'knockout', schedule, venue: candidate.venue, now, idPrefix: prefix });
    ctx.addAudit(store, 'fixtures.generated', admin.username, championship.name, `${created.length} partidas · mata-mata`);
    return { created: created.length };
  }
  const lastRound = Math.max(...knockout.map(match => match.roundNumber || 1));
  const roundMatches = knockout.filter(match => (match.roundNumber || 1) === lastRound);
  if (!finishedAll(roundMatches)) return { status: 409, error: 'Finalize todas as partidas da rodada atual antes de gerar a próxima.' };
  const ties = new Map();
  for (const match of roundMatches) {
    const key = [match.homeTeamId, match.awayTeamId].sort().join('|');
    ties.set(key, [...(ties.get(key) || []), match].sort((a, b) => (a.leg || 0) - (b.leg || 0)));
  }
  const winners = [];
  for (const legs of ties.values()) {
    const winner = tieWinner(legs, resultsByMatch);
    if (!winner) return { status: 409, error: 'Há confronto empatado sem vencedor: informe os pênaltis ou corrija o resultado.' };
    winners.push(winner);
  }
  const carriedByes = lastRound === 1 ? championship.knockout?.byes || [] : [];
  const entries = [...carriedByes, ...winners];
  if (entries.length === 1) {
    championship.championId = entries[0];
    championship.status = 'finished';
    championship.updatedAt = now;
    ctx.addAudit(store, 'championship.finished', admin.username, championship.name, `Campeão: ${names[entries[0]] || entries[0]}`);
    return { champion: entries[0], created: 0 };
  }
  const { pairs } = nextKnockoutRound(winners, carriedByes);
  roundNumber = lastRound + 1;
  const teamsInRound = pairs.length * 2;
  const twoLegs = Boolean(championship.knockout?.twoLegs) && teamsInRound > 2;
  const rounds = [{ pairs, label: knockoutRoundName(teamsInRound) + (twoLegs ? ' · ida' : ''), leg: twoLegs ? 1 : 0 }];
  if (twoLegs) rounds.push({ pairs: pairs.map(([home, away]) => [away, home]), label: `${knockoutRoundName(teamsInRound)} · volta`, leg: 2 });
  const created = [];
  rounds.forEach((round, index) => {
    const matchesCreated = buildMatches(store, championship, [round], { stage: 'knockout', schedule: (roundIndex, slotIndex) => schedule(roundIndex + index + 1, slotIndex), venue: candidate.venue, now, idPrefix: prefix, roundOffset: roundNumber - 1 });
    created.push(...matchesCreated);
  });
  championship.knockout = { ...championship.knockout, byes: [] };
  championship.updatedAt = now;
  ctx.addAudit(store, 'fixtures.generated', admin.username, championship.name, `${created.length} partidas · ${knockoutRoundName(teamsInRound)}`);
  return { created: created.length };
}

export function setResult(store, candidate, admin, ctx) {
  const match = store.matches.find(item => item.id === ctx.safeId(candidate.matchId));
  if (!match) return { status: 404, error: 'Partida não encontrada.' };
  const championship = store.championships.find(item => item.id === match.championshipId);
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const clear = candidate.clear === true;
  const home = clear ? null : numberOrNull(candidate.homeScore);
  const away = clear ? null : numberOrNull(candidate.awayScore);
  if (!clear && (home === null || away === null)) return { status: 400, error: 'Informe os dois placares (números inteiros).' };
  match.homeScore = home;
  match.awayScore = away;
  match.homePenalties = clear ? null : numberOrNull(candidate.homePenalties);
  match.awayPenalties = clear ? null : numberOrNull(candidate.awayPenalties);
  if (!clear) match.status = MATCH_STATUS.includes(candidate.status) ? candidate.status : 'finished';
  else if (match.status === 'finished') match.status = 'scheduled';
  match.updatedAt = ctx.now();
  ctx.addAudit(store, clear ? 'result.cleared' : 'result.saved', admin.username, match.room, clear ? '' : `${home} × ${away}`);
  return {};
}

// ---------- Reagendamento: adiar, adiantar, reagendar, cancelar, reabrir e deslocar várias partidas ----------

const KICKOFF_SHAPE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/;

function validKickoff(value) {
  const text = String(value || '').slice(0, 24);
  const parts = text.match(KICKOFF_SHAPE);
  if (!parts) return '';
  const date = new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5]));
  return Number.isNaN(date.getTime()) || date.getUTCMonth() !== +parts[2] - 1 ? '' : text;
}

function kickoffMinutes(text) {
  const parts = String(text || '').match(KICKOFF_SHAPE);
  return parts ? Date.UTC(+parts[1], +parts[2] - 1, +parts[3], +parts[4], +parts[5]) / 60000 : null;
}

function shiftKickoff(text, days) {
  const parts = String(text || '').match(KICKOFF_SHAPE);
  return new Date(Date.UTC(+parts[1], +parts[2] - 1, +parts[3] + days, +parts[4], +parts[5])).toISOString().slice(0, 16);
}

// Choques não bloqueiam: o administrador decide. Mesma equipe com menos de 2 h de diferença ou mesmo local com menos de 1 h.
function kickoffConflicts(store, match) {
  const start = kickoffMinutes(match.kickoffAt);
  if (start === null) return [];
  return store.matches.filter(other => {
    if (other.id === match.id || ['finished', 'cancelled', 'postponed'].includes(other.status)) return false;
    const otherStart = kickoffMinutes(other.kickoffAt);
    if (otherStart === null) return false;
    const gap = Math.abs(otherStart - start);
    const sharesTeam = [other.homeTeamId, other.awayTeamId].some(id => id === match.homeTeamId || id === match.awayTeamId);
    const sharesVenue = Boolean(match.venue) && other.venue === match.venue;
    return (sharesTeam && gap < 120) || (sharesVenue && gap < 60);
  }).map(other => other.id);
}

function pushRescheduleHistory(match, entry) {
  match.rescheduleHistory = [entry, ...(Array.isArray(match.rescheduleHistory) ? match.rescheduleHistory : [])].slice(0, 20);
}

// Aplica uma nova data mantendo a data original e marcando se foi adiada ou adiantada.
function applyNewKickoff(match, at, reason) {
  const previous = match.kickoffAt || '';
  if (previous && !match.originalKickoffAt) match.originalKickoffAt = previous;
  const base = match.originalKickoffAt || previous;
  match.kickoffAt = at;
  match.status = 'scheduled';
  if (base && at === base) { match.rescheduleKind = ''; match.originalKickoffAt = ''; match.postponeReason = ''; }
  else { match.rescheduleKind = previous && at < previous ? 'advanced' : 'postponed'; match.postponeReason = reason; }
}

export function rescheduleMatch(store, candidate, admin, ctx) {
  const match = store.matches.find(item => item.id === ctx.safeId(candidate.matchId));
  if (!match) return { status: 404, error: 'Partida não encontrada.' };
  const championship = store.championships.find(item => item.id === match.championshipId);
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const kind = ['postpone', 'reschedule', 'cancel', 'reopen'].includes(candidate.kind) ? candidate.kind : '';
  if (!kind) return { status: 400, error: 'Ação de reagendamento inválida.' };
  if (['live', 'finished'].includes(match.status) && kind !== 'reopen') return { status: 409, error: 'Partidas em andamento ou encerradas não podem ser reagendadas.' };
  if (kind === 'reopen' && ['scheduled', 'live'].includes(match.status)) return { status: 409, error: 'A partida já está agendada.' };
  const reason = String(candidate.reason || '').trim().slice(0, 200);
  const at = validKickoff(candidate.kickoffAt);
  if (candidate.kickoffAt && !at) return { status: 400, error: 'Data e hora inválidas.' };
  if (kind === 'reschedule' && !at) return { status: 400, error: 'Informe a nova data e hora.' };
  if (at && at === match.kickoffAt && match.status === 'scheduled') return { status: 400, error: 'A nova data é igual à atual.' };
  const from = match.kickoffAt || '';
  if (kind === 'reschedule' || kind === 'postpone') {
    if (candidate.venue !== undefined) match.venue = String(candidate.venue || '').trim().slice(0, 120);
    if (at) applyNewKickoff(match, at, reason);
    else {
      if (from && !match.originalKickoffAt) match.originalKickoffAt = from;
      match.kickoffAt = ''; match.status = 'postponed'; match.rescheduleKind = 'postponed'; match.postponeReason = reason;
    }
  } else if (kind === 'cancel') {
    match.status = 'cancelled'; match.postponeReason = reason;
  } else {
    const restored = at || match.kickoffAt || match.originalKickoffAt;
    if (!restored) return { status: 400, error: 'Informe a data e hora para reabrir a partida.' };
    applyNewKickoff(match, restored, reason);
  }
  match.updatedAt = ctx.now();
  pushRescheduleHistory(match, { at: ctx.now(), by: String(admin.username || '').slice(0, 80), kind, from, to: match.kickoffAt || '', reason });
  const auditAction = { postpone: 'match.postponed', reschedule: 'match.rescheduled', cancel: 'match.cancelled', reopen: 'match.reopened' }[kind];
  ctx.addAudit(store, auditAction, admin.username, match.room, `${from || 'sem data'} → ${match.kickoffAt || 'a definir'}${reason ? ` · ${reason}` : ''}`);
  return { conflicts: match.status === 'scheduled' ? kickoffConflicts(store, match) : [] };
}

// Desloca em N dias todas as partidas agendadas escolhidas (ex.: rodada inteira ou o resultado de um filtro).
export function shiftMatches(store, candidate, admin, ctx) {
  const days = Math.round(Number(candidate.days));
  if (!Number.isFinite(days) || days === 0 || Math.abs(days) > 90) return { status: 400, error: 'Informe um deslocamento entre -90 e 90 dias (diferente de zero).' };
  const ids = new Set((Array.isArray(candidate.matchIds) ? candidate.matchIds : []).slice(0, 300).map(value => ctx.safeId(value)));
  const reason = String(candidate.reason || '').trim().slice(0, 200);
  let changed = 0, skipped = 0;
  const touched = [];
  for (const match of store.matches) {
    if (!ids.has(match.id)) continue;
    const championship = store.championships.find(item => item.id === match.championshipId);
    if (!canManageChampionship(admin, championship) || match.status !== 'scheduled' || !validKickoff(match.kickoffAt)) { skipped += 1; continue; }
    const from = match.kickoffAt;
    applyNewKickoff(match, shiftKickoff(from, days), reason);
    match.updatedAt = ctx.now();
    pushRescheduleHistory(match, { at: ctx.now(), by: String(admin.username || '').slice(0, 80), kind: 'shift', from, to: match.kickoffAt, reason });
    touched.push(match); changed += 1;
  }
  if (!changed) return { status: 409, error: 'Nenhuma partida agendada foi deslocada.', skipped };
  ctx.addAudit(store, 'match.shifted', admin.username, `${changed} partida(s)`, `${days > 0 ? '+' : ''}${days} dia(s)${reason ? ` · ${reason}` : ''}`);
  return { changed, skipped, conflicts: [...new Set(touched.flatMap(match => kickoffConflicts(store, match)))] };
}

// ---------- Equipes × campeonatos, campeonatos em andamento (lançamentos retroativos) ----------

// Cadastros antigos sem slug ganham um (só em memória até a próxima gravação), para a página pública abrir.
export function ensureSlugs(store) {
  for (const championship of store.championships || []) {
    if (championship.slug) continue;
    const base = (slugify(championship.name, championship.id || 'campeonato') || 'campeonato').slice(0, 44);
    let slug = base; let counter = 2;
    while (store.championships.some(other => other !== championship && other.slug === slug)) { slug = `${base}-${counter}`; counter += 1; }
    championship.slug = slug;
  }
}

// Vincula/desvincula uma equipe de vários campeonatos de uma vez. Não desvincula quem já tem partidas no campeonato.
export function setTeamChampionships(store, candidate, admin, ctx) {
  const teamId = ctx.safeId(candidate.teamId);
  if (!teamId) return { status: 400, error: 'Equipe inválida.' };
  const wanted = new Set((Array.isArray(candidate.championshipIds) ? candidate.championshipIds : []).map(value => ctx.safeId(value)));
  const result = { linked: [], unlinked: [], blocked: [], skipped: [] };
  for (const championship of store.championships) {
    const has = (championship.teamIds || []).includes(teamId);
    const should = wanted.has(championship.id);
    if (has === should) continue;
    if (!canManageChampionship(admin, championship)) { result.skipped.push(championship.id); continue; }
    if (!should && store.matches.some(match => match.championshipId === championship.id && (match.homeTeamId === teamId || match.awayTeamId === teamId))) { result.blocked.push(championship.id); continue; }
    championship.teamIds = should ? [...(championship.teamIds || []), teamId].slice(0, 128) : championship.teamIds.filter(id => id !== teamId);
    if (!should && championship.drawConfig) {
      championship.drawConfig = { pots: Object.fromEntries(Object.entries(championship.drawConfig.pots || {}).filter(([id]) => id !== teamId)), avoid: (championship.drawConfig.avoid || []).filter(pair => !pair.includes(teamId)) };
    }
    championship.updatedAt = ctx.now();
    (should ? result.linked : result.unlinked).push(championship.id);
    ctx.addAudit(store, should ? 'team.linked' : 'team.unlinked', admin.username, teamId, championship.name);
  }
  if (!result.linked.length && !result.unlinked.length && (result.blocked.length || result.skipped.length)) {
    return { status: 409, error: result.blocked.length ? 'A equipe já tem partidas nesse campeonato; remova as partidas antes de desvincular.' : 'Você não administra esse campeonato.', ...result };
  }
  return result;
}

const intIn = (value, min, max) => Math.max(min, Math.min(max, Math.round(Number(value)) || 0));

// Pontos e estatísticas de quem entrou com o campeonato em andamento: somados ao calculado pelas partidas cadastradas.
export function setAdjustments(store, candidate, admin, ctx) {
  const championship = store.championships.find(item => item.id === ctx.safeId(candidate.championshipId));
  if (!championship) return { status: 404, error: 'Campeonato não encontrado.' };
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const members = new Set(championship.teamIds || []);
  const standings = {};
  for (const [rawId, delta] of Object.entries(candidate.standings && typeof candidate.standings === 'object' ? candidate.standings : {})) {
    const id = ctx.safeId(rawId);
    if (!members.has(id) || !delta || typeof delta !== 'object') continue;
    const clean = { played: intIn(delta.played, -999, 999), won: intIn(delta.won, -999, 999), drawn: intIn(delta.drawn, -999, 999), lost: intIn(delta.lost, -999, 999), gf: intIn(delta.gf, -9999, 9999), ga: intIn(delta.ga, -9999, 9999), points: intIn(delta.points, -9999, 9999) };
    if (Object.values(clean).some(Boolean)) standings[id] = clean;
  }
  const players = [];
  for (const entry of (Array.isArray(candidate.players) ? candidate.players : []).slice(0, 200)) {
    const teamId = ctx.safeId(entry?.teamId);
    const name = String(entry?.name || '').trim().slice(0, 60);
    if (!members.has(teamId) || !name) continue;
    const clean = { teamId, name, goals: intIn(entry.goals, 0, 999), yellow: intIn(entry.yellow, 0, 99), red: intIn(entry.red, 0, 99) };
    if (clean.goals || clean.yellow || clean.red) players.push(clean);
  }
  championship.adjustments = { standings, players };
  championship.updatedAt = ctx.now();
  ctx.addAudit(store, 'championship.adjusted', admin.username, championship.name, `${Object.keys(standings).length} equipe(s) · ${players.length} atleta(s)`);
  return { teams: Object.keys(standings).length, players: players.length };
}

// Lançamento em massa de jogos de um campeonato em andamento. Equipes são encontradas pelo nome (sem acento/caixa);
// com createTeams as que faltam entram no cadastro da plataforma e no campeonato.
export function importMatches(store, candidate, admin, ctx) {
  const championship = store.championships.find(item => item.id === ctx.safeId(candidate.championshipId));
  if (!championship) return { status: 404, error: 'Campeonato não encontrado.' };
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const rows = (Array.isArray(candidate.rows) ? candidate.rows : []).slice(0, 500);
  const teamNames = [...new Set((Array.isArray(candidate.teamNames) ? candidate.teamNames : []).map(value => String(value || '').trim().slice(0, 80)).filter(Boolean))].slice(0, 128);
  if (!rows.length && !teamNames.length) return { status: 400, error: 'Nenhuma linha ou equipe para importar.' };
  const fold = value => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const catalog = ctx.catalog && Array.isArray(ctx.catalog.teams) ? ctx.catalog : { teams: [] };
  const byName = new Map(catalog.teams.map(team => [fold(team.name), team]));
  const missing = [...new Map(rows.flatMap(row => [row?.home, row?.away]).concat(teamNames).map(value => String(value || '').trim()).filter(name => name && !byName.has(fold(name))).map(name => [fold(name), name])).values()];
  const unknownInRows = missing.filter(name => !teamNames.some(entry => fold(entry) === fold(name)));
  if (unknownInRows.length && !candidate.createTeams) return { status: 409, error: `Equipes não cadastradas: ${unknownInRows.slice(0, 8).join(', ')}${unknownInRows.length > 8 ? '…' : ''}. Cadastre antes ou marque "criar equipes que faltam".`, missing: unknownInRows };
  const palette = ['#8253cd', '#4588b5', '#d8ad56', '#38d996', '#fa626e', '#2f7df6', '#e0742c', '#9aa0b4'];
  const createdTeams = [];
  for (const name of missing) {
    const cleanName = name.slice(0, 80);
    let id = ctx.safeId(cleanName, 'time'); let counter = 2;
    while (catalog.teams.some(team => team.id === id)) { id = `${ctx.safeId(cleanName, 'time').slice(0, 56)}-${counter}`; counter += 1; }
    const team = { id, name: cleanName, short: fold(cleanName).replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() || 'TIM', color: palette[catalog.teams.length % palette.length], logo: '', roster: '', formation: '4-3-3', athletes: [], staff: [] };
    catalog.teams.push(team); byName.set(fold(cleanName), team); createdTeams.push(id);
  }
  let linkedNames = 0;
  for (const name of teamNames) {
    const team = byName.get(fold(name));
    if (team && !(championship.teamIds || []).includes(team.id)) { championship.teamIds = [...(championship.teamIds || []), team.id].slice(0, 128); linkedNames += 1; }
  }
  if (createdTeams.length) catalog.updatedAt = Math.max(ctx.now(), Number(catalog.updatedAt || 0) + 1);
  const prefix = (championship.slug || championship.id).slice(0, 20);
  const now = ctx.now();
  let created = 0, skipped = 0;
  const problems = [];
  rows.forEach((row, index) => {
    const home = byName.get(fold(row?.home)); const away = byName.get(fold(row?.away));
    const kickoff = validKickoff(row?.kickoffAt) || '';
    if (!home || !away || home.id === away.id) { problems.push(`Linha ${index + 1}: confronto inválido.`); skipped += 1; return; }
    const homeScore = numberOrNull(row.homeScore); const awayScore = numberOrNull(row.awayScore);
    const finished = homeScore !== null && awayScore !== null;
    const round = String(row.round || '').trim().slice(0, 60);
    const duplicate = store.matches.some(match => match.championshipId === championship.id && match.homeTeamId === home.id && match.awayTeamId === away.id && (match.round || '') === round && (match.kickoffAt || '').slice(0, 10) === kickoff.slice(0, 10));
    if (duplicate) { skipped += 1; return; }
    const id = `${prefix}-imp${index + 1}-${Math.random().toString(36).slice(2, 6)}`;
    store.matches.push({ id, championshipId: championship.id, homeTeamId: home.id, awayTeamId: away.id, kickoffAt: kickoff, venue: String(row.venue || '').trim().slice(0, 120), registrationDeadline: '', round, status: finished ? 'finished' : 'scheduled', room: id.slice(0, 48), updatedAt: now, stage: 'league', group: '', roundNumber: Math.round(clamp(row.roundNumber ?? String(round).match(/\d+/)?.[0], 0, 200, 0)), leg: 0, generated: false, homeScore: finished ? homeScore : null, awayScore: finished ? awayScore : null, homePenalties: null, awayPenalties: null, originalKickoffAt: '', rescheduleKind: '', postponeReason: '', rescheduleHistory: [] });
    for (const team of [home, away]) if (!(championship.teamIds || []).includes(team.id)) championship.teamIds = [...(championship.teamIds || []), team.id].slice(0, 128);
    created += 1;
  });
  if (!created && !createdTeams.length && !linkedNames) return { status: 409, error: problems[0] || 'Nenhuma partida nova (todas já existiam).', skipped, problems };
  championship.updatedAt = now;
  ctx.addAudit(store, 'matches.imported', admin.username, championship.name, `${created} partida(s) · ${createdTeams.length} equipe(s) criada(s)`);
  return { created, skipped, createdTeams: createdTeams.length, linkedTeams: linkedNames, problems: problems.slice(0, 10), catalogChanged: createdTeams.length > 0 };
}


export function upsertPost(store, candidate, admin, ctx) {
  const item = candidate.item || {};
  const championship = store.championships.find(entry => entry.id === ctx.safeId(item.championshipId));
  if (!championship) return { status: 400, error: 'Escolha o campeonato da publicação.' };
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  const title = String(item.title || '').trim().slice(0, 140);
  const body = String(item.body || '').trim().slice(0, 4000);
  if (!title && !body) return { status: 400, error: 'Informe um título ou texto.' };
  const media = String(item.media || '').slice(0, 500);
  const id = ctx.safeId(item.id, `post-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`);
  const previous = store.posts.find(entry => entry.id === id);
  const post = {
    id, championshipId: championship.id, kind: ['news', 'photo', 'video'].includes(item.kind) ? item.kind : 'news', title, body,
    media: /^(\/api\/assets\/|https?:\/\/)/.test(media) ? media : '', link: /^https?:\/\//.test(String(item.link || '')) ? String(item.link).slice(0, 300) : '',
    round: String(item.round || '').trim().slice(0, 60), createdAt: previous ? previous.createdAt : ctx.now(), updatedAt: ctx.now(), author: admin.username,
  };
  store.posts = [post, ...store.posts.filter(entry => entry.id !== id)].slice(0, 300);
  ctx.addAudit(store, previous ? 'post.updated' : 'post.created', admin.username, title || post.kind, championship.name);
  return {};
}

export function deletePost(store, candidate, admin, ctx) {
  const id = ctx.safeId(candidate.id);
  const post = store.posts.find(entry => entry.id === id);
  if (!post) return {};
  const championship = store.championships.find(entry => entry.id === post.championshipId);
  if (!canManageChampionship(admin, championship)) return { status: 403, error: 'Você não administra este campeonato.' };
  store.posts = store.posts.filter(entry => entry.id !== id);
  ctx.addAudit(store, 'post.deleted', admin.username, post.title || post.kind, championship?.name || '');
  return {};
}

// ---------- Visão pública / API JSON ----------

const publicTeam = team => ({ id: team.id, name: team.name, short: team.short, color: team.color, logo: team.logo || '' });


// Elenco público de cada equipe no campeonato: só nome, número, posição e estatísticas (sem fotos nem contatos).
// Se a equipe fez a inscrição neste campeonato, valem os atletas e números inscritos; senão, o elenco cadastrado.
function buildPublicSquads(catalog, championship, teams, players = []) {
  const stat = new Map(players.map(item => [`${item.name}|${item.teamId}`, item]));
  const squads = {};
  for (const team of teams) {
    const source = (catalog?.teams || []).find(item => item.id === team.id) || {};
    const registration = source.registrations?.[championship.id];
    const athletes = Array.isArray(source.athletes) ? source.athletes : [];
    const chosen = registration?.athleteIds?.length ? athletes.filter(athlete => registration.athleteIds.includes(athlete.id)) : athletes;
    squads[team.id] = {
      coach: String((source.coach && typeof source.coach === 'object' ? source.coach.name : source.coach) || '').slice(0, 60),
      athletes: chosen.slice(0, 80).map(athlete => {
        const name = String(athlete.name || '').slice(0, 60);
        const found = stat.get(`${name}|${team.id}`) || {};
        return { id: athlete.id, name, number: String(registration?.numbers?.[athlete.id] || athlete.number || '').slice(0, 3), position: String(athlete.position || '').slice(0, 30), goals: found.goals || 0, yellow: found.yellow || 0, red: found.red || 0 };
      }),
    };
  }
  return squads;
}

export async function buildChampionshipBundle(store, championship, catalog, getRoomState) {
  const teams = (catalog?.teams || []).filter(team => (championship.teamIds || []).includes(team.id) || store.matches.some(match => match.championshipId === championship.id && (match.homeTeamId === team.id || match.awayTeamId === team.id)));
  const names = Object.fromEntries((catalog?.teams || []).map(team => [team.id, team.name]));
  const matches = store.matches.filter(match => match.championshipId === championship.id).sort((a, b) => String(a.kickoffAt || '9999').localeCompare(String(b.kickoffAt || '9999')) || (a.roundNumber || 0) - (b.roundNumber || 0));
  const { resultsByMatch, eventsByMatch } = await collectResults(matches, getRoomState);
  const stats = aggregateStats(matches, eventsByMatch, championship.rules, names, championship.adjustments?.players);
  const rules = normalizeRules(championship.rules);
  const teamIds = [...new Set([...(championship.teamIds || []), ...matches.flatMap(match => [match.homeTeamId, match.awayTeamId])])];
  const tableFor = (list, ids) => computeStandings(list, resultsByMatch, { rules, teamIds: ids, names, cards: stats.cardsByTeam, adjust: championship.adjustments?.standings });
  const groups = Object.keys(championship.groups || {}).length
    ? Object.entries(championship.groups).map(([letter, members]) => ({ group: letter, table: tableFor(matches.filter(match => match.group === letter), members) }))
    : [];
  const league = matches.filter(match => match.stage !== 'knockout' && match.stage !== 'group');
  const standings = groups.length ? [] : tableFor(league, teamIds);
  const decorate = match => {
    const result = resultsByMatch[match.id];
    return {
      id: match.id, round: match.round, stage: match.stage || 'league', group: match.group || '', roundNumber: match.roundNumber || 0, leg: match.leg || 0,
      homeTeamId: match.homeTeamId, awayTeamId: match.awayTeamId, homeName: names[match.homeTeamId] || match.homeTeamId, awayName: names[match.awayTeamId] || match.awayTeamId,
      kickoffAt: match.kickoffAt, venue: match.venue, status: match.status, room: match.room,
      rescheduleKind: match.rescheduleKind || '', originalKickoffAt: match.originalKickoffAt || '', postponeReason: match.postponeReason || '',
      homeScore: result ? result.home : null, awayScore: result ? result.away : null, homePenalties: match.homePenalties ?? null, awayPenalties: match.awayPenalties ?? null,
    };
  };
  return {
    championship: { id: championship.id, slug: championship.slug, name: championship.name, season: championship.season, status: championship.status, sport: championship.sport, format: championship.format, description: championship.description, startDate: championship.startDate, endDate: championship.endDate, organizer: championship.organizer, organizerName: championship.organizerName, rules, championId: championship.championId || '', championName: championship.championId ? names[championship.championId] || '' : '' },
    teams: teams.map(publicTeam),
    standings, groups,
    matches: matches.map(decorate),
    scorers: stats.scorers, cards: stats.cards, suspended: stats.suspended,
    squads: buildPublicSquads(catalog, championship, teams, stats.players),
    posts: store.posts.filter(post => post.championshipId === championship.id).slice(0, 50).map(post => ({ id: post.id, kind: post.kind, title: post.title, body: post.body, media: post.media, link: post.link, round: post.round, createdAt: post.createdAt })),
    generatedAt: Date.now(),
  };
}

export function publicChampionshipSummary(championship, store) {
  return { id: championship.id, slug: championship.slug, name: championship.name, season: championship.season, status: championship.status, sport: championship.sport, format: championship.format, organizer: championship.organizer, organizerName: championship.organizerName, teams: (championship.teamIds || []).length, matches: store.matches.filter(match => match.championshipId === championship.id).length };
}

export function searchPublic(store, query = '', organizer = '') {
  const term = String(query || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const fold = value => String(value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const visible = store.championships.filter(item => item.isPublic && item.slug);
  const championships = visible.filter(item => (!organizer || item.organizer === organizer) && (!term || fold(`${item.name} ${item.season} ${item.organizerName}`).includes(term))).map(item => publicChampionshipSummary(item, store));
  const organizersMap = new Map();
  for (const item of visible) if (item.organizer) organizersMap.set(item.organizer, { slug: item.organizer, name: item.organizerName || item.organizer, championships: (organizersMap.get(item.organizer)?.championships || 0) + 1 });
  const organizers = [...organizersMap.values()].filter(entry => !term || fold(`${entry.name} ${entry.slug}`).includes(term));
  return { championships, organizers };
}

// Tabela compacta para overlays: a do grupo da partida (ou a geral) com sigla de cada equipe.
export function roomTable(bundle, match) {
  const rows = bundle.groups.length ? (bundle.groups.find(group => group.table.some(row => row.teamId === match.homeTeamId))?.table || bundle.groups[0].table) : bundle.standings;
  const shortOf = id => bundle.teams.find(team => team.id === id)?.short || '';
  return { championship: { name: bundle.championship.name, season: bundle.championship.season }, rows: rows.map(row => ({ position: row.position, teamId: row.teamId, name: row.name, short: shortOf(row.teamId), points: row.points, played: row.played, won: row.won, drawn: row.drawn, lost: row.lost, gf: row.gf, ga: row.ga, gd: row.gd })) };
}
