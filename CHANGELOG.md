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
  `brandMark()` (símbolo, hoje o ícone de coroa em SVG) — para trocar em um só lugar quando o
  logo oficial for aplicado. Identificadores técnicos não foram alterados nesta mudança:
  nome do pacote npm, nomes de container/volume no Docker, nome do Worker no `wrangler.json`,
  `project_id`/domínio do Site e a string `service` de `/health` continuam os mesmos de
  propósito — mudar esses exigiria coordenar infraestrutura já publicada, fora do escopo do
  pedido (só o nome da ferramenta, não a identidade técnica de deploy).
- **Pendente:** o logo oficial (brasão dourado com coroa, grinalda de louros e "J") foi
  enviado pelo usuário mas ainda não está no repositório — falta um meio de salvar o arquivo
  anexado no chat em disco. `brandMark()` continua retornando o ícone de coroa em SVG até o
  arquivo de imagem ser adicionado em `public/` e a função ser atualizada para usar `<img>`.

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
