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
