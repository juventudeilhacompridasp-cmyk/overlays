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
  `Removido` ou `Segurança`. Crie a subseção se ela ainda não existir no ciclo atual.
- Corrija a própria entrada no mesmo commit se a mudança for revista antes do push. Não deixe
  entradas desatualizadas ou contraditórias com o comportamento final.
- Ao abrir o PR, mova o conteúdo de `[Não publicado]` para uma seção `## [data ou versão]` e
  deixe `[Não publicado]` vazio (com os títulos de subseção removidos) para o próximo ciclo.
- Formato baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/).

## [Não publicado]

### Adicionado
- Login de administrador para o painel geral (rotas `/` e `/manage/*`), com suporte a múltiplas
  contas de administrador. No primeiro acesso, sem nenhum admin cadastrado, o painel mostra uma
  tela de setup que cria a primeira conta — não existe usuário/senha padrão de fábrica.
- Login por usuário e senha para o responsável de cada time em `/team`: a pessoa escolhe o time
  num seletor, informa usuário e senha próprios daquele time, e recebe uma sessão. Isso substitui
  o antigo esquema de link mágico `/team?token=...` (o `accessToken` do catálogo de times deixou
  de ser usado como mecanismo de autenticação; links antigos com `?token=` continuam funcionando
  apenas para **leitura** de dados já públicos, nunca mais para autorizar escrita).
- Novo módulo `/manage/access` ("Usuários/Acessos"): tela única onde o administrador lista/cria/
  remove contas de administrador (não deixa remover a última) e vincula/atualiza/revoga o usuário
  e senha de cada time cadastrado.
- Sessão implementada como cookie HttpOnly assinado (HMAC-SHA256 via Web Crypto). O segredo de
  assinatura é gerado automaticamente no primeiro boot e persistido no próprio armazenamento já
  existente (arquivo local no Node; tabela `overlay_state` sob a chave `auth-secret` no D1 do
  Worker) — não é necessário configurar nenhum binding ou variável de ambiente nova no Cloudflare.
- Novo arquivo `auth.mjs`: hashing de senha (PBKDF2, 100 000 iterações, SHA-256) e utilitários de
  cookie/sessão usando apenas Web Crypto (`crypto.subtle`), para rodar idêntico em Node 20+ e em
  Cloudflare Workers. `build.mjs` injeta o conteúdo desse arquivo dentro do Worker gerado, então
  qualquer mudança em `auth.mjs` já vale para os dois ambientes sem precisar duplicar código.
- Novas rotas de API: `GET /api/auth/admin/status`, `POST /api/auth/admin/setup`,
  `POST /api/auth/admin/login`, `POST /api/auth/admin/logout`, `GET /api/auth/admin/session`,
  `GET|POST|DELETE /api/auth/admin/accounts`, `POST /api/auth/team/login`,
  `POST /api/auth/team/logout`, `GET /api/auth/team/session`,
  `GET|PUT|DELETE /api/auth/team/credentials` (sem `teamId` na query, o `GET` retorna a lista
  completa de vínculos time→usuário, usada pela tela de Acessos).
- CHANGELOG.md (este arquivo) como padrão obrigatório do projeto a partir de agora.

### Alterado
- `PUT /api/state`, `PUT /api/teams` e `PUT /api/assets/<sala>/<nome>` agora exigem sessão de
  administrador válida (cookie `joa_admin`), respondendo `401` sem ela. Os métodos `GET`
  equivalentes continuam **públicos**, sem exigir login — isso é intencional e não deve mudar,
  pois as fontes de navegador do OBS e a rota `/preview` dependem de acesso sem autenticação.
- `PUT /api/team-portal` e `PUT /api/team-athlete-photo` passam a identificar o time pelo
  parâmetro `?team=<id>` (em vez de `?token=<accessToken>`) e exigem sessão de administrador
  **ou** sessão do próprio time (cookie `joa_team` com `teamId` correspondente). Os `GET`
  equivalentes continuam públicos e aceitam tanto `?team=` quanto `?token=` (compatibilidade).
- `PUT /api/assets/team-portals/<teamId>-logo` (upload do escudo pelo portal do time) passa a
  aceitar tanto sessão de administrador quanto sessão do time dono daquele escudo, diferente do
  restante de `/api/assets/*`, que continua exclusivo de administrador.
- Menu lateral do `/manage`: agrupamento por chave de módulo (`Overlays` / `Partida` /
  `Configuração`) em vez de por posição fixa no array, e rolagem interna (`overflow-y: auto`)
  para não cortar itens quando a lista de módulos cresce.
- Item de menu "Times" teve a legenda simplificada ("Elencos e escudos"); a gestão de acesso do
  time saiu de dentro do editor de time e foi para o novo módulo `/manage/access`.

### Corrigido
- Login de time podia falhar com "Usuário ou senha incorretos" mesmo com a senha certa, porque o
  campo de senha da tela de Acessos era `type="password"` e o gerenciador de senhas do navegador
  autopreenchia com uma senha salva (ex.: a do próprio administrador) por cima do valor digitado
  ao vincular o acesso de um time. O campo agora é `type="text"` com `autocomplete="off"` e o
  rótulo deixa explícito que a senha fica visível — é o admin provisionando acesso de outra
  pessoa, então conferir o valor exato é desejável, diferente de um campo de login comum.
- Hashing e verificação de senha agora removem espaços nas pontas de forma simétrica (`trim()`
  em `hashPassword` e em `verifyPassword`), evitando que um espaço colado por acidente na hora de
  salvar (e ausente na hora de logar, ou vice-versa) quebre silenciosamente o login.

### Segurança
- Senhas nunca são armazenadas em texto plano; apenas o hash PBKDF2 (`pbkdf2$<iterações>$<salt
  hex>$<hash hex>`) é persistido. A verificação usa comparação em tempo constante.
- O catálogo de times (`GET /api/teams`, sempre público) deixou de ser a fonte de autorização:
  antes, o `accessToken` ali exposto era suficiente para editar o time; agora as credenciais de
  time ficam numa coleção separada (`__team_credentials__` / room `team-credentials`) nunca
  incluída nas respostas públicas.
