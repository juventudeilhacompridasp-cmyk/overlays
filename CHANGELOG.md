# Changelog

Todas as mudanças com efeito observável do projeto são registradas neste arquivo.
Ele existe principalmente para que **outra IA** (ou você mesma, em outra sessão, sem memória
desta conversa) recupere contexto rapidamente: o que mudou, por que mudou, e como isso afeta
contratos já existentes (rotas, formato de dados, compatibilidade, segurança).

## Regras para escrever uma entrada

- **Sempre em português.**
- Toda mudança com efeito observável entra aqui: rotas novas/alteradas, formato de dados,
  comportamento de interface, regras de segurança, build ou deploy. Refatoração interna sem
  efeito observável não precisa de entrada.
- Escreva para quem **não viu o diff nem a conversa**. Não basta dizer "atualizado app.js";
  descreva o comportamento novo, o que ele substitui, e qualquer contrato que passou a valer
  (ex.: "`PUT /api/teams` agora exige sessão de administrador; `GET` continua público").
- Use a subseção certa dentro de `## [Não publicado]`: `Adicionado`, `Alterado`, `Corrigido`,
  `Removido` ou `Segurança`. Crie a subseção se ela ainda não existir no ciclo atual. Não crie
  categorias fora dessas cinco.
- Corrija a própria entrada no mesmo commit se a mudança for revista antes do push. Não deixe
  entradas desatualizadas ou contraditórias com o comportamento final.
- Ao publicar (merge na main que efetivamente vai para o GPT Sites), mova o conteúdo de
  `[Não publicado]` para uma seção `## [versão] - AAAA-MM-DD` e deixe `[Não publicado]` vazio
  (sem títulos de subseção) para o próximo ciclo.
- Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).
## [Não publicado]

- **Compatibilidade do Builder**: overlays criados antes (campos `layout`, `title`, `subtitle`, `media`, `animation`, `background`, `accent`, `textColor`) são convertidos ao carregar em elementos equivalentes (fundo, mídia, faixa de destaque, título e texto), mantendo aparência e animação aproximadas; os campos antigos continuam no estado, mas a edição e a saída passam a usar `elements`. Os controles antigos de largura/altura/título foram substituídos pelo editor visual. O limite de upload de assets `custom-*` subiu para 25 MB no Node e no Worker (antes valia 5 MB no servidor apesar de a interface anunciar 50 MB).
- **Refinamento visual do painel administrativo** (só CSS em `public/styles.css`, mais a classe `stat-<status>` nos cartões de status do Dashboard em app.js). Overlays, saídas do OBS e composição 1920×1080 não usam estas regras. Novos tokens: `--ui` (Roboto hospedada para o texto), `--heading` (Barlow Condensed para títulos, números e marca, estilo painel esportivo), `--radius`, `--shadow-card`, `--ring` e neutros ligeiramente reequilibrados. Mudanças: barra superior com desfoque e fio dourado; botões com hierarquia (primário em gradiente, foco visível por teclado); campos de 40 px; cartões com profundidade; títulos de página em caixa alta condensada; menu lateral mais denso, com barra dourada no item ativo e separadores de grupo; cartões da Central de módulos compactos; Dashboard com indicadores coloridos por status (Ao vivo em vermelho pulsante, Agendadas em azul, Finalizadas em verde); abas dos módulos como controle segmentado; tela de entrada compacta e centralizada. Textos de apoio que eram 9–11 px agora têm 11–12 px. `.broadcast-layer` mantém a fonte anterior para a prévia continuar idêntica à saída. Corrigido: `--font-ui`/`--ui-font` eram usados sem definição. Responsivo: o grid do Dashboard e das operações passa para uma coluna abaixo de 980 px (antes estourava a largura em celulares).

- **Fonte global de verdade**: as fontes individuais de cada overlay (`*Typeface`) agora têm o valor padrão `global` e seguem `state.typeface`; ao escolher a fonte global em Aparência, todas as individuais são redefinidas para `global` (depois é possível sobrepor uma a uma; o seletor ganhou "Fonte global do projeto"). Estados antigos com valor explícito (ex.: `rajdhani`) continuam iguais até o usuário escolher uma fonte global.
- Tela Usuários/Acessos (`/manage/access`) reconstruída: indicadores (administradores, times com acesso, usuários de
  times, pedidos de senha), alerta de pedidos de redefinição (`password-reset`) com "Gerar nova senha", busca por equipe
  ou usuário, filtro Todos/Com acesso/Sem acesso, cartões de administradores (selo "você", criação, último acesso,
  redefinição de senha; a própria conta e o último administrador não podem ser removidos) e cartões por equipe com todos
  os usuários, último acesso, redefinir/remover usuário, criação do primeiro acesso e medidor de força da senha.
  A senha gerada (12 caracteres) é exibida uma única vez e copiada junto com o link e as instruções de acesso.
  Continuam valendo os textos "Administradores do painel" e "Usuários dos times" e os ids dos campos de cadastro.
- Backend (Node e Worker): as listas de administradores devolvem `createdAt` e `lastLoginAt`; o login de administrador
  e de equipe grava `lastLoginAt` (também exposto em `GET /api/auth/team/credentials`); novo `PUT /api/auth/admin/accounts`
  (`id`, `password`) redefine a senha de um administrador. Não altera sessões nem o formato das senhas.

### Adicionado
- **Estúdio de artes** (`/manage/arts`, grupo Conteúdo do menu): módulo exclusivo que gera peças PNG para redes sociais no navegador (canvas), sem novas rotas ou dados no servidor. Usa o mesmo bundle público `/api/public/championship?id=` (partidas, classificação, grupos, artilharia, cartões, publicações) e o catálogo de times (atletas e escalações). Escolhas do usuário: **17 tipos de arte, uma para cada informação da plataforma** (resultado, jogo do dia, rodada·resultados, rodada·próximos jogos, classificação, artilharia, cartões e suspensos, tabelas dos grupos, ficha da equipe, escalação confirmada, elenco completo, cartão do atleta com foto, agenda do dia, parceiros e patrocinadores, notícia, campeão, aviso livre); 6 estilos (Noite dourada, Gramado, Neon, Jornal, Diagonal, Minimalista); 4 formatos (feed 1:1 1080×1080, retrato 4:5 1080×1350, stories 9:16 1080×1920, paisagem 16:9 1920×1080). **Personalização:** cor de destaque, cor de fundo (+ segundo tom), cor do texto, fonte dos títulos (Barlow Condensed, Oswald, Bebas Neue, Montserrat, Roboto), arredondamento dos blocos, imagem de fundo enviada (com escurecimento), logo da marca (logo do clube ou imagem enviada), nome na assinatura, escudos, faixa de patrocinadores. Imagens enviadas viram `data:image/…` apenas em memória (não são persistidas nem enviadas ao servidor; o canvas só aceita URLs same-origin ou `data:image/` para não ficar contaminado). Prévia ao vivo, baixar PNG, compartilhar (Web Share com arquivo), lote para todos os jogos da rodada e "Baixar nos 4 formatos". Opções de texto/cor ficam só em `localStorage` (`juventude.artes.v1`).
- **Overlays de campeonato para OBS** (`/obs/<visão>?c=<slug>&…`, configurados em `/manage/broadcast`, módulo "Overlays de campeonato"): novas saídas transparentes 1920×1080 alimentadas pelo bundle público do campeonato (`/api/public/championship?slug=` ou `?id=`; só campeonatos **públicos** funcionam no OBS, que não tem login). Visões: `standings` (tabela), `fixtures` (próximos jogos), `results` (últimos resultados), `scorers`, `discipline`, `matchcard` (jogo em destaque), `ticker` (faixa rolante de placares) e `champion`. Tudo é parametrizado por query string (nenhum estado novo no servidor): `style` (broadcast, glass, neon, light, minimal, gradient, stripe), `anim` (rise, slide, zoom, wipe, fade, flip, cascade, bounce, drop; entrada e saída via Web Animations API), `pos` (grade 3×3) + `dx`/`dy`, `scale`, `width`, `rows`, `font` (mesmo catálogo `TYPEFACES`; padrão = fonte global do projeto lida de `globalAppearance` em `/api/teams`), `accent` (padrão = cor de destaque global), `bg`, `text`, `surface`, `radius`, `logos`, `title`, `subtitle`, `group`, `round`, `match`, `cols` (min/std/full), `speed` (faixa), ciclo `hold`/`gap` (tempo no ar/fora), `rotate` (troca automática de páginas quando há mais itens que `rows`) e `refresh` (atualização dos dados). O módulo de configuração mostra a prévia ao vivo sobre fundo xadrez, gera o link, copia para a área de transferência e reproduz a animação. Rotas `/obs/*` servidas por `server.mjs` e pelo Worker (`build.mjs`) com o mesmo `index.html`; a página não usa sincronização por sala nem sessão de administrador.
- O hub de módulos passa a listar 24 cartões.

- **Competição completa (mapeamento em docs/MAPEAMENTO_FUNCIONALIDADES.md)**. Nova biblioteca `competition.mjs` com as regras de competição, compartilhada por `server.mjs` (import) e pelo Worker (inlinada por `build.mjs`). Campeonatos ganham `slug`, `sport`, `format` (`league|groups|knockout`), `rules` (`pointsWin/Draw/Loss`, `tiebreakers` em ordem entre `wins`, `goalDiff`, `goalsFor`, `goalsAgainst`, `headToHead`, `fewerCards`, `alphabetical`, `yellowLimit`, `redGames`), `teamIds`, `groups`, `knockout`, `isPublic`, `organizer`, `organizerName`, `description`, `moderators` e `championId`; partidas ganham `stage`, `group`, `roundNumber`, `leg`, `homeScore`, `awayScore`, `homePenalties`, `awayPenalties` e `generated` (dados antigos continuam válidos: campos ausentes valem liga, sem placar). Novas ações em `POST /api/operations`: `generate-fixtures` (todos contra todos com folga para número ímpar e turno/returno, grupos sorteados em serpentina, mata-mata com byes para os melhores quando o total não é potência de 2 e ida e volta opcional; cria uma sala de overlay por jogo com calendário a partir de data, horário, intervalo e local; recusa regerar sem `replace` e nunca substitui jogos iniciados), `generate-next-round` (grupos para mata-mata e rodadas seguintes; exige jogos finalizados e vencedor definido, empate só se resolve com pênaltis ou agregado; ao restar um vencedor encerra o campeonato e grava `championId`), `set-result`, `upsert-post`, `delete-post`. O resultado de uma partida finalizada vem do registro ou, na falta dele, do placar da sala de transmissão. Operadores só alteram campeonatos que os listam em `moderators` (lista vazia = qualquer operador; administradores sempre podem); recusas retornam 403. Respostas de `/api/operations` agora incluem `result` quando a ação produz um (ex.: `created`, `champion`).
- **API pública e páginas sem login**: `GET /api/public/championships?q=&organizer=`, `GET /api/public/championship?slug=` (ou `?id=` para administradores, inclusive privados), `GET /api/public/organizer?slug=` e `GET /api/public/room-table?room=` (somente leitura, `access-control-allow-origin: *`, cache de 5 s). Campeonatos nascem privados; só `isPublic` com `slug` aparecem. O pacote do campeonato traz classificação (ou tabelas por grupo, com desempate configurável), jogos, artilharia, cartões, suspensos (amarelos acumulados e vermelhos cumpridos nos jogos seguintes) e publicações. Interface pública: `/campeonatos` (busca, filtros, "seguir" no aparelho), `/c/<slug>` (classificação, jogos com filtro por equipe, artilharia, disciplina, notícias e fotos, ao vivo, patrocinadores, compartilhar), `/o/<slug>` e widgets `/embed/standings|matches|scorers?c=<slug>[&theme=light]` para iframes. PWA: `manifest.webmanifest` e `sw.js` (rede primeiro, sem cache de `/api/`), registrado nas páginas públicas e no portal do time. Servidor e Worker passam a servir `index.html` para essas rotas.
- **Painel**: Campeonatos reescrito em seções (dados, regras e desempate com ordem ajustável, equipes participantes, geração de partidas e fases, divulgação com link público e moderadores); Partidas ganha placar, pênaltis e "Importar placar da sala de transmissão"; Classificação e súmulas passa a usar o pacote do servidor (tabelas por grupo, forma recente, suspensos) e gera **artes em PNG** (resultado 1080×1080 e tabela 1080×1350) para baixar ou compartilhar; novo módulo **Notícias e mídia** (`/manage/feed`: notícia, foto ou vídeo por campeonato e rodada, com upload de imagem de até 5 MB); **importação de planilha** de times e atletas em Times (CSV com `;`, `,` ou tab; colunas Equipe, Sigla, Cor, Número, Atleta, Posição, Altura, Função; modelo para baixar).
- **Builder + dados de campeonato**: novos dados `{champ.name}` e `{table.N.name|short|points|played|won|drawn|lost|gf|ga|gd|position}` (N de 1 a 16), alimentados por `/api/public/room-table` a cada 20 s apenas quando algum texto usa esses dados; durante a edição aparecem linhas de exemplo. Novo modelo "Classificação (top 6)".

- **Builder de overlays por elementos** (módulo `builder`, `/manage/builder`): cada overlay agora é um canvas livre com até 60 elementos (`item.elements`) do tipo texto, imagem, vídeo e forma (retângulo/círculo), em vez do layout fixo mídia + título. Cada elemento tem posição e tamanho em % do canvas (`x`, `y`, `w`, `h`), rotação, opacidade, ordem de camada (posição na lista), visibilidade e trava; texto (fonte da lista global ou "global", tamanho em px do canvas, peso, cor, alinhamento H/V, caixa alta, itálico, espaçamento, entrelinha, recuo, texto rolante em loop); caixa (fundo sólido ou degradê, opacidade, cantos, borda, sombra); mídia (`cover`/`contain`, upload de até 25 MB por elemento em `/api/assets/<sala>/custom-<overlay>-<elemento>`) e animação própria de entrada/saída (`none`, `fade`, `slide-left|right|up|down`, `zoom`, `pop`, `wipe`, `flip`) com atraso e duração, o que permite sequências; "Cascata" escalona todos os atrasos. As animações usam só `transform`/`opacity` (valem no OBS). O overlay ganhou `canvasBg` (fundo do canvas, vazio = transparente) e `autoHide` (segundos até sumir sozinho, 0 = manual; `expiresAt` é definido ao colocar no ar). A duração da entrada/saída (`transition.expiresAt`) passa a ser a do elemento mais demorado (`customTransitionDuration`). Edição visual: arrastar e redimensionar no canvas com guias de encaixe (Alt desliga), Shift mantém a proporção nas alças de canto, setas do teclado, Delete, Ctrl+D, Esc, grade dos terços, painel de camadas (mostrar/ocultar, travar, subir/descer) e inspetor com abas Posição, Estilo, Conteúdo e Animação; "Testar animação" reproduz entrada e saída no próprio canvas.
- **Dados ao vivo nos overlays do Builder**: textos aceitam `{home.name}`, `{home.short}`, `{home.score}`, `{away.name}`, `{away.short}`, `{away.score}`, `{clock}`, `{period}`, `{competition}`, `{sponsor}` e `{time}`, e imagens aceitam as fontes `token:home.logo`, `token:away.logo` e `token:sponsor`. Um relógio de 250 ms atualiza só o texto dos elementos com dados (sem recriar o overlay, portanto sem piscar). A assinatura da camada `custom` para o OBS inclui os logos e a fonte global.
- **Modelos e reaproveitamento**: 7 modelos prontos (Em branco, Lower third, Mini-placar, Aviso central, Intervalo/resultado, Selo de patrocínio, Faixa rolante), duplicar overlay, exportar/importar JSON (`{ format: 'juventude-overlay', version: 1, overlay }`, até 1 MB, sempre sanitizado ao importar) e **Modelos da plataforma**: `/manage/builder` sem `?room=` edita a sala reservada `biblioteca-overlays` (mesmo mecanismo da biblioteca de patrocínios); dentro de uma partida, "Salvar como modelo" copia o overlay para essa sala e "Usar nesta partida" copia um modelo para a partida (sem ir ao ar). Menu da plataforma: Conteúdo > Builder de Overlays.

- **Papéis das contas do painel** (`role`: `admin` | `operator` | `viewer`; segurança em `server.mjs` e no Worker). `admin` tem acesso total; `operator` opera transmissão e cadastros mas **não** acessa `/api/auth/admin/accounts` nem `/api/auth/team/credentials` (403); `viewer` só faz leituras (`GET`/`HEAD`): qualquer escrita falha fechada com 401 porque `getAdminSession` não devolve sessão para leitor em métodos de escrita. O papel é lido da conta a cada requisição, então mudar o papel vale de imediato para a sessão em curso. Contas antigas sem o campo continuam `admin`. `POST /api/auth/admin/accounts` aceita `role` (padrão `admin`); `PUT` aceita `role` e/ou `password` (pelo menos um; papel inválido = 400); o último `admin` não pode ser rebaixado nem removido (409). `GET /api/auth/admin/session` e as respostas de login/setup passam a incluir `role`; a lista de contas inclui `role`. Interface: seletor de papel por conta e na criação (tela Usuários/Acessos), aviso "Acesso somente leitura" para leitor e menu sem Usuários/Backup para quem não é `admin`. Documentado em docs/AUTH.md.
- **Ao vivo agora** (`/manage/live`): partidas com status "Ao vivo" com placar e tempo (lidos da sala a cada 3 s), overlays no ar, links para operar e abrir a prévia, "Retirar tudo do ar" (busca o estado da sala, zera `visible` e regrava) e lista das partidas que começam nas próximas 24 h.
- **Classificação e súmulas** (`/manage/standings`): por campeonato, tabela (P, J, V, E, D, GP, GC, SG; vitória 3, empate 1), artilharia, cartões e súmula por partida finalizada (lances com minuto, equipe, atleta e placar), com impressão. Calculado no navegador a partir do placar e dos eventos guardados na sala de cada partida (até 80 salas); não há dado novo no backend. Limitação: depende de o autor do gol/cartão estar preenchido nos eventos e de a partida estar marcada como "Finalizada".
- **Backup e exportação** (`/manage/backup`, somente `admin`): backup JSON (times e atletas, campeonatos, partidas, comunicados, delegações, biblioteca de patrocínios; sem senhas, sessões nem estado ao vivo) e CSV de times/atletas, partidas, campeonatos e auditoria. A restauração continua manual (não há rota de importação).

- **Menu do Super Administrador reorganizado por função** (plataforma, sem `?room=`): grupos recolhíveis **Operação** (Campeonatos, Partidas), **Cadastros** (Times, Delegações), **Conteúdo** (Patrocinadores, Barra de Patrocinadores), **Comunicação** (Comunicados, Avisos e logs) e **Administração** (Usuários/Acessos), com contador por grupo, estado aberto/fechado lembrado em `localStorage` (`juventude.sidebar.groups.v1`), busca de telas no topo do menu e atalho `/` para focar a busca. Definição em `PLATFORM_MENU_GROUPS` (app.js). O menu da partida (`?room=`) não mudou.
- **Portal do time com menu lateral** (`/team`): substitui as 2 abas por **Início** (verificações, prazo, indicadores, próximos jogos com situação da escalação, último comunicado, atalhos), **Comunicados**, **Campeonatos** (inscrição e escalação por partida, como antes), **Calendário** (jogos agrupados por mês, prazo de cadastro e exportação `.ics` para o celular), **Elenco**, **Comissão técnica**, **Identidade** (escudo, cores, apoiadores) e **Conta e dados** (exportação do elenco em CSV, dados completos em JSON e calendário). Os dados e rotas do portal não mudaram; as antigas seções de cadastro foram apenas separadas por tela (`portal-tab` aceita agora `home`, `announcements`, `championships`, `calendar`, `squad`, `staff`, `identity`, `account`). Novas ações locais: `portal-open-match`, `portal-export-csv|json|ics`.
- **Comunicados da organização para as equipes**: novo módulo `/manage/announcements` (Super Admin) e seção Comunicados no portal do time. Novas ações em `POST /api/operations` (admin): `upsert-announcement` (`item: { id?, title ≤120, body ≤2000, teamIds[] (vazio = todas), pinned }`; título e mensagem obrigatórios, senão 400) e `delete-announcement` (`id`). Ficam em `operations.announcements` (máx. 100, mais recente primeiro; ausente em dados antigos = lista vazia), com auditoria `announcement.created|updated|deleted`. O portal recebe apenas os destinados à equipe (ou a todas) em `context.announcements` de `GET /api/team-portal`, até 30. Implementado em `server.mjs` e no Worker (`build.mjs`); a marcação de lidos é local ao navegador da equipe (`juventude.portal.read.<teamId>`).

- **Biblioteca de patrocínios, sem partida vinculada** (`/manage/sponsors` e `/manage/sponsor-bar` na plataforma, sem `?room=`). As telas de Patrocinadores e Barra de Patrocinadores passam a existir também no nível da plataforma, editando uma sala especial reservada por convenção (`biblioteca-patrocinios`, constante `LIBRARY_ROOM` em app.js). Como é uma sala comum, uploads, prévia, looping e URLs do OBS funcionam iguais; os links `/overlay?layer=sponsor|sponsor-bar&room=biblioteca-patrocinios` (botão "Saídas OBS" na biblioteca) permitem exibir patrocínios fixos sem partida. Novo grupo "Biblioteca de patrocínios" no menu da plataforma.
- **Herança da biblioteca nas partidas** (`state.sponsorSource`: `platform` | `match`). Partidas com `platform` recebem `sponsors`, `sponsorBarMode`, `sponsorBarVideo`, `sponsorBarItems`, `sponsorBarAutoSchedule` e `sponsorBarScheduleInterval` da biblioteca (consulta `GET /api/state?room=biblioteca-patrocinios` a cada 2,5–4 s, aplicada localmente em painel, prévia e saída OBS; o que está no ar e os índices de rotação continuam por partida). Compatibilidade: salas já salvas sem o campo ficam como `match` (mantêm os patrocínios que têm); salas novas nascem `platform`. Nas telas de patrocínio da partida há um aviso com "Personalizar esta partida" (vira cópia editável) e "Usar biblioteca" (volta a herdar); enquanto herda, a edição fica somente leitura. Sem backend novo: a biblioteca usa as rotas de estado de sala existentes nos dois runtimes.
- **Fontes globais hospedadas no projeto**: Roboto, Barlow Condensed, Oswald, Montserrat e Bebas Neue (OFL, subconjunto latino woff2 em `public/fonts/`, declaradas com `@font-face` no topo de styles.css; sem depender de internet no OBS). Entram como novas opções da fonte global em Aparência (`roboto`, `barlow`, `oswaldweb`, `montserratweb`, `bebas`); as 4 antigas seguem como estavam. O build agora copia subpastas de `public/` (`fs.cp` recursivo) e o servidor Node serve `.woff2`.

- **Escalação · 5 conceitos de layout** (`appearance.photoLineupLayout`: `classic` | `tunnel` | `poster` | `sidebar` | `stadium` | `matchday`, padrão `classic`). Diferente dos "estilos" (que só recolorem a mesma grade), cada conceito tem composição, visual e animação próprios e vale para os quatro painéis (titulares, jogador individual, reservas, esquema tático): **Túnel de entrada** (colunas altas em tela cheia, nomes na vertical, sobem em sequência), **Carta de coleção** (cartas com moldura de foil que viram em 3D e ganham brilho), **Coluna lateral** (lista compacta de 26% da largura que deixa o jogo livre; entra deslizando com linhas em cascata), **Telão de estádio** (painel LED em duas colunas, números luminosos, liga com cintilação e varredura) e **Programa do jogo** (papel claro, serifa, fotos com fita adesiva; desdobra e carimba). Com um conceito diferente de `classic`, `photoLineupStyle`/`photoLineupAnimation` são ignorados e a tela de configurações os oculta. As animações usam só `transform`/`opacity`, então também valem na fonte do OBS. Valor desconhecido cai em `classic`; estados antigos não têm o campo e continuam iguais. Código: `renderPhotoLineupOverlay`, `lineupConceptControls` (app.js) e bloco "conceitos de layout" no fim de styles.css.
- **Escalação · foto do atleta no esquema tático** (`photoLineupFormationMark`: `number` | `photo`, padrão `number`; `photoLineupFormationPhotoSize` 60–200%, padrão 100). No modo `photo`, cada posição mostra a foto redonda no lugar do número; atleta sem foto continua com o número. O tamanho é controlado por um controle deslizante que só aparece nesse modo (`--formation-photo` no `.tactical-board`). Só interface: sem mudança de rotas ou de formato de dados no backend.
- Novo overlay **Estatísticas** (`/overlay?layer=stats`, módulo `/manage/stats`), com três visualizações escolhidas no
  painel: comparativo (barras lado a lado com até 6 indicadores), gols e cartões (registros por equipe) e destaque do
  atleta (foto, camisa, gols e cartões contados pelos eventos com o mesmo nome). Dados na sala: `state.stats`
  (`shots`, `shotsOnTarget`, `corners`, `fouls`, `offsides`, `saves` por equipe e `possession` do mandante, com o
  visitante sendo 100 menos a posse), `statsView`, `statsMetrics` e `statsPlayer`. Gols, cartões e substituições
  são derivados dos eventos da linha do tempo (a equipe do evento é a sigla, como já era gravado). Aparência em
  `appearance.stats*` (escala, fonte, posição, estilo `broadcast|glass|minimal`, animação
  `rise|slide|zoom|wipe|fade`, `statsDuration` em segundos com 0 = manter no ar). Camada própria de visibilidade
  (`visible.stats`, `statsTransition`, `statsExpiresAt`), URL do OBS, sincronização, "Desativar todos" e variante
  leve (só transform/opacidade) no modo OBS. Estados antigos recebem os padrões.
- Configurações dos módulos organizadas em seções recolhíveis (Estilo e animação, Tamanho/fonte/posição, período,
  tema, exibição), com o estado aberto/fechado lembrado durante o uso, e botão "Restaurar padrões do módulo" que
  volta só as chaves `appearance` daquele módulo (placar, eventos, escalação, patrocinadores, barra e estatísticas).
- Portal da equipe (`/team`): nova aba "Campeonatos e partidas". A equipe escolhe o campeonato, inscreve os atletas que
  disputarão aquele campeonato (com número de camisa próprio opcional e esquema tático padrão do campeonato), vê as
  partidas da equipe no campeonato e define, para cada partida, titulares (até 11, com ordem que define a posição no
  esquema tático), reservas e esquema. Só atletas inscritos no campeonato podem ser escalados.
- Dados (Node e Worker): cada equipe do catálogo ganha `registrations[championshipId] = { athleteIds, numbers,
  formation }` e `matchSquads[matchId] = { starters, reserves, formation, updatedAt }`. `PUT /api/team-portal`
  valida tudo no servidor (campeonato e partida existentes, partida da própria equipe, atletas da equipe e inscritos
  no campeonato da partida, máximo de 11 titulares) e ignora alterações em partidas `live`, `finished` ou `cancelled`.
  `GET`/`PUT /api/team-portal` passam a devolver `context` com os campeonatos e as partidas da equipe (com nomes
  dos adversários). Salvar só inscrição ou escalação não devolve a delegação aprovada para revisão nem cria versão no
  histórico (o log usa `team.planning.saved`); só mudanças no cadastro da equipe fazem isso.
- Overlay e painel: a apresentação da equipe usa automaticamente a escalação enviada pela equipe para a partida da
  sala (`state.matchId`), incluindo titulares, reservas, ordem no esquema, esquema tático e números do campeonato. O
  ajuste manual da sala (`state.squad`) continua tendo prioridade. A lista de partidas do painel mostra se cada equipe
  já enviou a escalação.

### Alterado
- As artes de resultado e classificação do módulo de Classificação (`art-result`/`art-standings`) agora usam o renderizador do Estúdio (`renderArt`); a gaveta continua existindo e aponta para o Estúdio. Escudos externos (URL não same-origin) continuam fora das artes para não contaminar o canvas.
- **Escritas simultâneas de administradores** (`POST /api/operations`, `POST /api/team-delegation/complete`, pedido de redefinição de senha de equipe). As ações já eram intenções (ex.: `set-result`, `upsert-match`), mas o servidor recusava com 409 qualquer cliente cujo `baseUpdatedAt` estivesse velho, mesmo quando a edição era em outro item. Agora o `baseUpdatedAt` enviado pelo cliente é aceito mas ignorado: no Worker a ação é aplicada sobre a versão mais recente de `__operations__` e gravada só se `updated_at` não mudou (compare-and-swap), com até 6 releituras/reaplicações (helper `mutateOperations` e laço em `/api/operations`); no Node a alteração é síncrona no processo. Se as tentativas se esgotarem a resposta é 409 com `operations` atualizado. Contrato mantido: formato dos dados, URLs, rooms e tokens não mudaram. Edições na mesma entidade seguem "última gravação vence". `PUT /api/teams` (catálogo inteiro) continua exigindo `baseUpdatedAt` atual.
- **Gravação em disco do Node** (`server.mjs`): `persist()` passou a usar fila e escrita atômica (arquivo temporário + `rename`), evitando arquivo corrompido quando duas requisições gravam ao mesmo tempo.

### Corrigido
- **Tela "Overlays de campeonato" (`/manage/broadcast`) travava a aba** quando algum campeonato não tinha `slug` (cadastros antigos): `loadObsBundle` comparava `obsOptions.slug` com `undefined` e chamava `render()` em laço infinito. Agora o ajuste de alvo ocorre uma única vez por campeonato (`obsAutoSlug`) e campeonatos sem slug passam a usar `?id=<id>` no link do OBS.
- **Ids duplicados em criações no mesmo milissegundo**: avisos, partidas e campeonatos sem nome usavam só `Date.now()` no id padrão e se sobrescreviam; agora levam sufixo aleatório (Node e Worker).

## [32] - 2026-09-29

### Adicionado
- Módulo da plataforma `/manage/delegations` ("Delegações"): painel de pendências por equipe (percentual de
  preenchimento, faltas obrigatórias, números repetidos, atletas sem foto, nomes acima de 26 letras, sem escudo,
  titulares diferentes de 11), status (em preenchimento, aguardando revisão, devolvida ou alterada, aprovada), botão
  "Cobrar equipe" (copia a mensagem pronta), "Aprovar", "Devolver" com motivo e histórico de versões com "Restaurar".
  O dashboard da plataforma mostra também delegações para revisar e prazos vencidos.
- Backend (Node e Worker): `operationsStore` ganha `teamHistory` (até 15 versões por equipe, gravadas a cada salvamento
  no portal; `GET/POST /api/operations` devolvem só os metadados, sem o snapshot) e as ações `review-delegation`
  (`teamId`, `decision` = `approved` | `returned`, `comment` obrigatório ao devolver; grava `reviewComment`,
  `reviewedAt`, `reviewedBy` em `delegationStatus`) e `restore-team-version` (`teamId`, `versionId`; guarda a versão
  atual antes de restaurar). `markDelegationChanged` também volta uma delegação `approved` para `needs-review`.
- Prazo de cadastro por partida: campo `registrationDeadline` (AAAA-MM-DD) em `upsert-match` e no editor de partidas.
  `GET /api/team-portal` devolve `deadline` (menor prazo das próximas partidas da equipe). Não há envio automático de
  e-mail ou mensagem; os alertas aparecem no painel e no portal.
- Portal da equipe: faixas de prazo/aprovação/devolução, verificações do cadastro, importação do elenco por CSV
  (`número;nome;posição;altura;titular|reserva`; números existentes são atualizados), envio de fotos em lote pelo número
  no nome do arquivo (aviso acima de 1,5 MB, limite de 5 MB) e "Kit de mídia": `color2` e `sponsors` (até 6 apoiadores
  com `name`, `logo` reservado) em `/api/team-portal` e no catálogo, com prévia de placar. `color2` vira o realce da
  apresentação e os apoiadores aparecem no painel do esquema tático.
- Elenco por partida: `state.squad[teamId] = { called, starters, formation, positions }` na sala. O módulo Escalações
  ganhou "Elenco desta partida" (relacionados, titulares até o limite do esporte e esquema próprio) e as bolinhas do
  esquema tático podem ser arrastadas na prévia do painel; a saída OBS respeita o elenco, o esquema e as posições.
  Sem `squad` o comportamento anterior (função de cada atleta no cadastro) é mantido.
- Acesso das equipes com vários usuários: `PUT /api/auth/team/credentials` agora adiciona ou atualiza pelo par
  equipe+usuário (antes substituía o único acesso da equipe) e `DELETE` aceita `&username=` para remover só um usuário
  (sem `username` remove todos, como antes). A tela Usuários/Acessos lista e remove cada usuário.
- Recuperação de senha: `POST /api/auth/team/reset-request` (`teamId`, `username`) cria um aviso `password-reset` para
  os administradores, no máximo um não lido a cada 10 minutos por equipe, e responde sempre `ok` para não revelar quais
  usuários existem. Botão "Esqueci minha senha" no login da equipe; a nova senha continua sendo gerada pelo administrador.
- Versionamento visível: a versão vem de `package.json` (`32.0.0`, correspondente à seção `[32]` deste changelog;
  ao publicar a seção `[N]`, atualize `version` para `N.0.0`). `GET /health` passa a devolver `version` no servidor
  Node e no Worker (`build.mjs` embute a versão no build). A interface mostra "Versão X" no rodapé das telas de
  login (administrador e equipe) e no rodapé da barra lateral do painel.
- Visão geral da plataforma: abrir `/` ou `/manage/*` sem `?room=` é o "modo plataforma", sem partida selecionada
  (a sala não é mais gerada aleatoriamente nem restaurada de `localStorage`; `overlay`, `preview` e `team` mantêm o
  comportamento anterior). Mostra só os módulos da plataforma (Visão geral, Campeonatos, Partidas, Times, Usuários/Acessos,
  Avisos e logs), sem botão "Desativar todos", seletor de partida ou saídas OBS. O dashboard ganhou a seção
  "Campeonatos" com a contagem de partidas de cada um.

### Alterado
- Com `?room=` (partida selecionada) a barra lateral mostra o cabeçalho da partida, o link "← Plataforma" e a lista
  completa de módulos (agrupados como antes). URLs existentes com `?room=` continuam funcionando; módulos da plataforma
  acessados sem sala caem na visão geral. A Central de módulos passou a ter 16 cartões (inclui Delegações).

## [31] - 2026-09-29

### Adicionado
- Apresentação da equipe (`photo-lineup`): três novos estilos em `appearance.photoLineupStyle`, inspirados em
  transmissões profissionais — `premier` (blocos de cor da equipe, cortes diagonais e placa branca de nome),
  `champions` (azul profundo, filete dourado e número em círculo) e `diagonal` (cards em paralelogramo).
  Os valores antigos (`editorial`, `cards`, `glass`) continuam válidos; estados sem valor usam `editorial`.
- Novo campo `appearance.photoLineupAnimation` (`slide` padrão, `wipe`, `rise`, `zoom`, `split`, `cascade`),
  aplicado à entrada/saída e à troca de painel (titulares, individual, esquema, reservas). O overlay recebe a
  classe `photo-lineup-anim-<valor>`; valores desconhecidos caem em `slide`. No modo OBS as variantes usam apenas
  transform/opacidade (sem clip-path animado), então o desempenho do Browser Source não muda. O esquema tático e
  os reservas ganharam entrada em cascata (bolinhas com `scale`, sem alterar o posicionamento).
- Campo tático: marcação da pequena área e da marca do pênalti, e goleiro destacado em amarelo.
- Barra de patrocinadores (horizontal): `appearance.sponsorBarBorder` (`none`, `thin` padrão, `accent`) e
  `appearance.sponsorBarShadow` (`none` padrão, `soft`, `strong`), refletidos na saída 1500 × 200 e no programa.
  Estados antigos recebem os padrões por mesclagem com `defaultAppearance()`.
- Nova ação `appearance-option` (`data-value="campo|valor"`), validada contra `OVERLAY_STYLE_OPTIONS`, usada pelos
  seletores visuais; e `sponsor-bar-preset` (Limpa, Destaque, Discreta) que grava um conjunto coerente de valores.

### Alterado
- Tela de aparência da barra de patrocinadores reorganizada: prévia ao vivo da barra (1500 × 200) com estado
  NO AR/FORA DO AR, predefinições, seções Transição, Arte e acabamento e Exibição, e botões visuais no lugar dos
  selects de transição e ajuste da mídia. Os sliders de escala, opacidade, arredondamento e cor de fundo mantêm
  `data-appearance`.
- Estilo e animação da apresentação passaram a ser escolhidos por grades visuais (aba Aparência e módulo
  Escalações) em vez do select "Estilo da apresentação com fotos"; o formato dos dados gravados não mudou.

## [30] - 2026-09-29

### Adicionado
- Aba Aparência: novo cartão "Barra de patrocinadores" com tamanho (`appearance.sponsorBarScale`, 60–180%)
  e posição horizontal/vertical (`appearance.sponsorBarX`/`sponsorBarY`, 0–100%, padrão 50/91, centro da
  barra) no programa completo. Estados antigos recebem os padrões por mesclagem com `defaultAppearance()`.
  A saída independente `layer=sponsor-bar` (1500 × 200) continua ocupando todo o quadro e ignora X/Y.
  No CSS a barra agora é centralizada com `translate(-50%,-50%)` (keyframes ajustados) e usa `--sponsor-bar-x/y`.

### Corrigido
- Esquema tático: `FORMATIONS` agora guarda posições `[x, y]` já em meio campo (goleiro à esquerda, ataque à
  direita, valores por formação), e o campo passou a ser desenhado como meio campo (área e arco central) em vez
  de campo inteiro com linha do meio. Formações e contratos de dados não mudaram.
- Overlay de patrocínio no painel: o drawer "Patrocinador" pedia texto livre ("Marca exibida") e só renomeava o
  patrocinador ativo, mantendo o banner antigo. Agora lista os patrocinadores cadastrados; ao confirmar, define
  `activeSponsorIndex` e coloca no ar o nome e o banner do escolhido (`sponsor`/`sponsorBanner`).

## [29] - 2026-09-18

### Segurança
- O botão flutuante "DESATIVAR TODOS" só aparece nos painéis com sessão administrativa
  (Super Admin) autenticada. É removido ao sair e não aparece no login, cadastro inicial,
  portais de equipes, prévias ou fontes OBS. A ação também verifica a sessão no cliente;
  a API mantém a exigência existente de autenticação administrativa para gravar o estado.
  Nenhuma rota, formato de estado ou permissão de leitura dos overlays foi alterada.

### Adicionado
- Na tela **Usuários/Acessos**, os campos de senha (administradores e usuários dos times)
  ganharam um botão "gerar senha" que preenche o campo com uma senha aleatória de 8 caracteres
  (letras maiúsculas, minúsculas, números e símbolos, sem caracteres ambíguos como `0`/`O` ou
  `1`/`l`/`I`) e um botão "copiar" que envia usuário e senha formatados para a área de
  transferência. A geração e a cópia acontecem só no navegador; nenhuma rota, formato de dados
  ou regra de validação de senha (mínimo de 8 caracteres) mudou — o botão apenas preenche o
  campo de texto existente, que continua sendo salvo por `PUT /api/auth/team/credentials` ou
  `POST /api/auth/admin/accounts` como antes.
- Barra de Patrocinadores (rodapé 1500 × 200): a transição de entrada/saída ganhou duas opções
  além de fade/slide/zoom — "Virada 3D" e "Elástico" (`sponsorBarTransition`, validado no
  cliente e persistido em `appearance`; novos keyframes CSS `sponsor-bar-flip-*` e
  `sponsor-bar-elastic-*`, incluindo variante para a saída OBS isolada `data-output-layer="sponsor-bar"`).
  A tela de configurações da barra também ganhou um botão "Exibir/Ocultar barra agora"
  (reaproveita a ação já existente `overlay-sponsor-bar`) e uma nova **exibição automática por
  intervalo**: ao ativar (`sponsorBarAutoSchedule`), a barra aparece sozinha a cada N minutos
  (`sponsorBarScheduleInterval`, 1–60 min) pela duração configurada em "Tempo entre
  patrocinadores", sem exigir clique manual. Esses três campos novos (`sponsorBarAutoSchedule`,
  `sponsorBarScheduleInterval`, `sponsorBarScheduleNextAt`) são persistidos no estado da sala
  como os demais campos de `sponsorBar*`; não há mudança de rota, só de formato do JSON de
  estado (campos adicionais, com fallback seguro em `normalizeState` para salas antigas).
- No painel de cada partida, o módulo **Relatório** ganhou um seletor "Conteúdo do PDF" com três
  opções — **Escalação** (somente titulares, comissão técnica e reservas de cada equipe),
  **Atividades** (resumo de gols/cartões/substituições, placar por período e linha do tempo
  completa, sem escalação) e **Tudo** (o relatório completo que já existia). A opção escolhida
  passa a controlar o que os botões "Finalizar partida e gerar PDF", "Abrir PDF final" e
  "Exportar relatório selecionado" produzem — o mecanismo de exportação continua sendo impressão
  do navegador (`window.print` sobre uma aba com o HTML do relatório), sem novas rotas ou
  dependências. O histórico de relatórios finalizados (`completedReports`) e a API de estado não
  mudaram de formato.
- Nova aba **Dashboard**, disponível em `/manage/dashboard`, como visão geral da plataforma:
  agenda e contagem de partidas por status, partidas ao vivo e próximas, avisos/atividade
  recentes (reaproveita os dados já carregados em `/api/operations`), contagem de times/acessos
  cadastrados (reaproveita `/api/auth/admin/accounts` e `/api/auth/team/credentials`, agora
  também carregados quando essa aba está aberta) e estatísticas agregadas de gols/cartões/
  substituições somadas de todas as partidas com sala registrada. As estatísticas agregadas são
  calculadas no navegador buscando `GET /api/state?room=<sala>` (rota pública já existente) para
  cada partida cadastrada em `/api/operations` — não há nova rota nem novo dado persistido no
  servidor. A tela principal de cada partida (`/?room=...`) também ganhou um resumo compacto
  "Resumo da partida" (placar, contagem de eventos por tipo e quantos overlays estão no ar) logo
  abaixo do seletor de modalidade.
- **Escudos dos times no placar**: novo botão "Escudos dos times no placar" (aba Partida e módulo
  dedicado `/manage/scoreboard`) liga/desliga a exibição do escudo enviado em cada equipe dentro
  do placar da transmissão (`appearance.scoreboardShowBadge`, `false` por padrão — nenhuma sala
  existente muda de aparência sem ação do usuário). Sem escudo cadastrado, mostra as iniciais da
  equipe sobre a cor do time como alternativa. O campo é validado e persistido como os demais
  campos de `appearance`; não há mudança de rota ou de contrato de estado além do novo campo.
- **Dois novos layouts de placar**, além de Compacto e Aberto: **Cartão** (escudo em destaque,
  nome completo da equipe, moldura em formato de pílula) e **Duelo** (divisão diagonal nas cores
  de cada equipe, siglas de 3 letras, visual mais dramático). Selecionáveis no mesmo controle
  "Formato do placar" da aba Partida e do módulo `/manage/scoreboard`
  (`appearance.scoreboardLayout` passa a aceitar `compact`, `expanded`, `card` ou `duel`, com
  fallback para `compact` em salas antigas ou valores inválidos). A transição animada suave
  (morph) continua restrita à troca entre Compacto ↔ Aberto, como antes; a troca envolvendo
  Cartão ou Duelo troca o layout diretamente, sem a animação de expansão/contração.

### Corrigido
- **Transições cortadas nas saídas do OBS (`/overlay?...`)**: identificadas duas causas raiz e
  as duas foram corrigidas.
  1. Cada saída isolada (`/overlay?layer=...`) só substitui o HTML de um placar/lower
     third/patrocinador quando o conteúdo daquela camada muda OU quando a animação em
     andamento muda de identidade (`outputFingerprint`/`outputAnimationFingerprint`,
     comportamento já existente). O problema: quando uma troca de conteúdo *não relacionada*
     (ex.: o operador altera o placar ou outro campo) forçava a recriação do elemento
     enquanto uma transição de entrada/saída daquela MESMA camada ainda estava em andamento,
     `motionOffset()` sempre devolvia `0` para saídas OBS (`isOutput`), fazendo a animação
     reiniciar do zero a cada nova renderização em vez de continuar de onde parou — visível
     como um "corte"/soluço no meio da transição. Agora `motionOffset()` guarda, em
     `seenMotionStarts`, os horários de início (`startedAt`) de transições já pintadas: a
     primeira renderização de uma transição nova continua começando do quadro zero (evita o
     corte inicial "no meio" que esse comportamento já corrigia antes), mas qualquer
     renderização seguinte da mesma transição agora retoma pelo tempo decorrido real, sem
     reiniciar a animação CSS. O mapa é limpo periodicamente (a cada 250 ms, entradas com
     mais de 30 s) para não crescer indefinidamente em transmissões longas.
  2. O modo de performance do OBS (`.obs-render-mode`) já trocava os keyframes de cada estilo
     de transição (montagem, deslizamento, zoom, virada 3D, elástico, glitch) por versões mais
     leves baseadas só em `transform`/`opacity` (`obs-enter-*`/`obs-exit-*`), mas só substituía
     `animation-name` — a curva de aceleração (`animation-timing-function`) de cada estilo
     original continuava valendo, incluindo `steps(7,end)` do estilo "Glitch digital" (que por
     design pula entre quadros, ficando muito mais perceptível sem o efeito visual original que
     o acompanhava) e a curva com "overshoot" do estilo "Elástico". Agora cada regra
     `.obs-render-mode` que troca o keyframe também fixa uma curva suave
     (`cubic-bezier(.16,1,.3,1)` na entrada, `cubic-bezier(.7,0,.84,0)` na saída), então
     qualquer estilo de transição escolhido pelo operador chega fluido no OBS, independente da
     curva original daquele estilo. Nenhuma opção de transição foi removida; o comportamento
     fora do OBS (painel, prévia `/preview`) não muda.

## [27] - 2026-09-18

### Adicionado
- Seletor de **partida ativa** nos painéis administrativos. A escolha persiste no navegador e
  passa a ser reutilizada em todas as rotas administrativas sem `room`, permitindo alternar
  entre partidas já cadastradas sem perder seus estados individuais de placar e transmissão.

### Alterado
- A configuração visual completa dos overlays (`theme`, cores, tipografia, parâmetros de
  aparência e tema visual) agora é armazenada como `globalAppearance` no catálogo compartilhado
  e aplicada a todas as partidas, prévias e saídas do OBS. A sala continua isolando somente os
  dados operacionais da partida.
- O código da sala se torna imutável depois que a partida é criada, preservando o vínculo com o
  estado persistido e com as URLs já configuradas no OBS.
- Gravações de campeonatos, partidas e catálogo global passam a enviar `baseUpdatedAt`. O servidor
  rejeita com HTTP 409 uma edição baseada em versão antiga, em vez de sobrescrever silenciosamente
  mudanças feitas por outro Super Admin.

### Corrigido
- Os formulários de campeonato e partida mantêm rascunhos em memória durante sincronizações e
  atualizações de tela. A consulta periódica só redesenha o painel quando a versão remota mudou,
  eliminando a piscada que apagava texto em digitação.

## [26] - 2026-09-18

### Adicionado
- Conceito operacional de **campeonatos e partidas** no painel: `/manage/championships` mantém
  nome, temporada, período e status da competição; `/manage/matches` agenda cada confronto com
  campeonato, mandante, visitante, data, local, fase e uma `room` exclusiva. Ao abrir uma
  partida, o painel vincula a sala ao cadastro e preenche competição e equipes, enquanto placar,
  eventos, escalações, mídias e URLs do OBS continuam isolados pelo contrato de `room` existente.
- Fluxo formal de conclusão da delegação no portal `/team`. O gestor salva o rascunho e usa
  **Concluir e avisar** quando todos os atletas possuem nome/número e toda a comissão possui
  nome/função. A conclusão cria um aviso não lido para o Super Admin; alterações posteriores
  reabrem a revisão e geram um novo aviso.
- Módulo `/manage/audit` com central de avisos e log das ações de campeonato, partida e
  delegação. Os administradores podem marcar avisos individualmente ou em lote como lidos; o
  histórico é limitado aos 500 eventos mais recentes e não armazena senhas, cookies ou arquivos.
- APIs administrativas `GET/POST /api/operations` e API autenticada
  `POST /api/team-delegation/complete`, implementadas tanto no servidor Node quanto no Worker.
  Os dados usam o registro privado `__operations__`, que não pode ser lido nem sobrescrito por
  uma `room` escolhida pelo usuário.

## [25] - 2026-09-18

### Adicionado
- Três novos estilos de placar em "Estilo do placar" (`/manage/scoreboard` → Aparência, e no
  seletor genérico da aba Aparência): **Neon** (contorno e sombra com brilho na cor de destaque
  do campeonato, número do placar com `text-shadow`), **Faixa dinâmica** (`ribbon`, corte
  diagonal via `clip-path` no canto esquerdo do placar, blocos de gol em degradê) e **Gradiente**
  (barra inteira em gradiente diagonal entre a cor primária e a cor de destaque, cantos bem
  arredondados, sombra difusa). Os quatro estilos existentes (Clássico, Vidro, Minimalista,
  Alto impacto) continuam disponíveis; nenhum comportamento anterior muda.
- Duas novas variações na "Entrada e saída do placar" (campo `scoreboardAnimation`): **Elástico**
  (entra com overshoot de escala, como uma mola) e **Glitch digital** (deslocamento/inclinação em
  degraus, efeito de interferência de transmissão). Reutilizam o mesmo mecanismo das variações
  existentes (montagem por módulos, deslizamento, zoom, virada 3D): a classe
  `scorebug-animation-<nome>` já herda automaticamente a simplificação de movimento usada na
  saída real do OBS (`.obs-render-mode`), sem precisar de CSS extra.
- Todos os novos estilos usam somente as variáveis CSS já existentes do tema
  (`--overlay-primary`, `--overlay-accent`, `--overlay-dark`, `--overlay-light` e
  `--scoreboard-radius`/`--scoreboard-surface`/`--scoreboard-accent`), então respeitam os temas
  prontos (Noturno, Campo, Clean) e a cor personalizada do campeonato sem nenhum código extra.
- Botão "Acesso da equipe" na tela de login do administrador (`renderAdminAuthGate`), levando
  direto a `/team`. Antes, quem chegasse em `/` ou `/manage/*` sem ser o time responsável não
  tinha como encontrar a tela de login de equipe sem saber o endereço de cor.

### Alterado
- Nome exibido do produto passou de "Juventude Overlay Studio" para **"Juventude Esporte
  Clube"** em todo lugar visível ao usuário: título da aba do navegador, cabeçalho do painel
  (`/` e `/manage/*`), e todas as telas de login/portal (`/team`, setup do admin). A marca
  agora vem de duas constantes centralizadas em `public/app.js` — `BRAND_NAME` (texto) e
  `brandMark()` (símbolo, ver entrada abaixo sobre o logo oficial). Identificadores técnicos
  não foram alterados nesta mudança:
  nome do pacote npm, nomes de container/volume no Docker, nome do Worker no `wrangler.json`,
  `project_id`/domínio do Site e a string `service` de `/health` continuam os mesmos de
  propósito — mudar esses exigiria coordenar infraestrutura já publicada, fora do escopo do
  pedido (só o nome da ferramenta, não a identidade técnica de deploy).
- `brandMark()` agora retorna a imagem oficial (`public/brand-logo.png`, brasão dourado com
  coroa, grinalda de louros e "J") em vez do ícone de coroa em SVG genérico. O ícone SVG
  (`icons.crown`) foi removido do código por ficar sem nenhum uso depois da troca.
- `build.mjs` passou a copiar qualquer arquivo binário solto em `public/` (além de
  `index.html`/`styles.css`/`app.js`, que continuam embutidos como texto no Worker) para
  `dist/client/`, para que a versão hospedada no Sites sirva o logo através do binding
  `ASSETS` declarado em `wrangler.json`. Sem essa mudança, a imagem funcionaria só localmente
  (o servidor Node já serve qualquer arquivo de `public/` sem precisar de build) e daria 404
  no Site publicado.
- `server.mjs` passou a reconhecer `.png`, `.jpg`/`.jpeg` e `.webp` no mapa de `content-type`
  dos arquivos estáticos (antes só tinha `.html`, `.css`, `.js`, `.svg`, `.json`; qualquer
  outra extensão virava `application/octet-stream`, o que podia levar o navegador a baixar a
  imagem em vez de exibi-la).
- A imagem original enviada (3481×3000, ~2,9 MB) foi redimensionada para 512 px de largura
  (~120 KB) antes de entrar no repositório, mantendo a transparência — o brasão é exibido a
  37×40 px no topo do painel e 28×31 px nas telas de login, então a resolução original não
  trazia benefício visual e deixaria o carregamento do painel bem mais pesado.

## [24] - 2026-09-17

### Adicionado
- Login de administrador para o painel geral (`/` e `/manage/*`), com múltiplas contas de admin.
  Primeiro acesso cria a conta via tela de setup que exige um **código de instalação** privado
  (`OVERLAY_SETUP_TOKEN` como variável de ambiente no Sites, ou um código aleatório impresso no
  terminal na primeira inicialização local/Docker) — sem esse código, o cadastro do primeiro
  administrador fica bloqueado. Depois de criada a primeira conta, o código não serve mais para
  criar outra; as demais contas são criadas pelo próprio painel (tela de Acessos).
- Login por usuário e senha para os responsáveis de cada time em `/team`, substituindo o antigo
  link com token na URL. O acesso de cada time é vinculado pelo admin na tela de Acessos.
- Módulo "Usuários/Acessos" em `/manage/access`: lista e gerencia administradores do painel e as
  credenciais de cada time em uma tela só.
- Sessão via cookie assinado (HMAC, Web Crypto) com segredo gerado e persistido automaticamente,
  sem exigir configuração manual de binding no Cloudflare.
- Barra de rolagem e agrupamento (Overlays / Partida / Configuração) no menu lateral do `/manage`.
- `CLAUDE.md` (importa `AGENTS.md` e `docs/DEVELOPMENT.md`) e `docs/AUTH.md` (contratos de
  segurança e passo a passo do primeiro acesso, local e no Sites).

### Alterado
- `/api/teams`, `/api/state` e `/api/assets/*` (escrita) agora exigem sessão de administrador.
  Leitura (`GET`) permanece pública para não quebrar fontes do OBS e o `/preview`.
- `/api/team-portal` e `/api/team-athlete-photo` passam a identificar o time por `?team=<id>`
  (mantendo `?token=` como fallback de leitura para links antigos já salvos; escrita sempre exige
  sessão).
- Nenhuma funcionalidade de transmissão (placar, eventos, patrocinadores, escalações) mudou de
  comportamento nesta rodada — a superfície alterada foi exclusivamente autenticação e acesso.

### Segurança
- Registros internos de autenticação (segredo de sessão, administradores, credenciais de time,
  catálogo de times) usam chaves com underscore, que `safeRoom` nunca consegue gerar a partir de
  um nome de sala escolhido pelo usuário — ou seja, não existe `?room=` que exponha esses dados
  pela API pública de estado de partida.
- Criação do primeiro administrador e do segredo de sessão usa `INSERT OR IGNORE` no D1: duas
  instâncias do Worker inicializando ao mesmo tempo não criam donos diferentes nem sobrescrevem o
  segredo uma da outra.
- A sessão de administrador referencia o id da conta (não só o usuário); remover a conta revoga
  a sessão imediatamente. A sessão de time referencia a versão da credencial; trocar ou remover o
  acesso de um time revoga qualquer sessão antiga daquele time.
- Senhas usam PBKDF2 (100k iterações, SHA-256) via Web Crypto, com comparação em tempo constante,
  e nunca são retornadas por nenhuma resposta de API.
- Campos de senha na tela de Acessos usam `autocomplete="off"` para evitar que o gerenciador de
  senhas do navegador sobrescreva o valor digitado ao provisionar acesso de outra pessoa.

### Corrigido
- Imagem Docker passou a incluir `auth.mjs` (faltava no `Dockerfile`, o que quebraria o boot em
  produção). A suíte de testes passou a usar um caminho de pasta temporária portátil, em vez de
  um caminho fixo, para não falhar no Windows.
