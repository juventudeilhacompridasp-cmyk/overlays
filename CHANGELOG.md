# Changelog

Todas as mudanças relevantes do projeto são registradas neste arquivo.

O formato segue [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/), com seções por versão/PR.
Adicione uma entrada aqui em todo PR que alterar comportamento observável (rotas, dados, interface).
Uma entrada curta é suficiente: o que mudou e por quê, não a lista de arquivos tocados (isso já está no diff).

## [Não publicado]

### Adicionado
- Login de administrador para o painel geral (`/` e `/manage/*`), com múltiplas contas de admin.
  Primeiro acesso cria a conta via tela de setup com código de instalação privado (sem senha padrão).
- Login por usuário e senha para os responsáveis de cada time em `/team`, substituindo o antigo
  link com token na URL. O acesso de cada time é vinculado pelo admin.
- Módulo "Usuários/Acessos" em `/manage/access`: lista e gerencia administradores do painel e as
  credenciais de cada time em uma tela só.
- Sessão via cookie assinado (HMAC, Web Crypto) com segredo gerado e persistido automaticamente,
  sem exigir configuração manual no Cloudflare.
- Barra de rolagem e agrupamento (Overlays / Partida / Configuração) no menu lateral do `/manage`.

### Alterado
- `/api/teams`, `/api/state` e `/api/assets/*` (escrita) agora exigem sessão de administrador.
  Leitura (`GET`) permanece pública para não quebrar fontes do OBS e o `/preview`.
- `/api/team-portal` e `/api/team-athlete-photo` passam a identificar o time por `?team=<id>`
  (mantendo `?token=` como fallback de leitura para links antigos já salvos).

### Segurança
- Senhas usam PBKDF2 (100k iterações, SHA-256) via Web Crypto, com comparação em tempo constante.
- Campos de senha na tela de Acessos usam `autocomplete="off"` para evitar que o gerenciador de
  senhas do navegador sobrescreva o valor digitado ao provisionar acesso de outra pessoa.

### Integração a partir da versão publicada 23
- Cadastro inicial protegido por código privado; registros internos inacessíveis pela API de salas.
- Criação atômica do administrador e segredo de sessão no D1; revogação de sessões ao remover acessos.
- Preservados login de equipes, gestão de acessos, menu agrupado e funcionalidades de transmissão.
- Docker inclui auth.mjs; suíte usa pasta temporária portátil no Windows/Linux.
- CLAUDE.md importa as regras comuns e docs/AUTH.md descreve instalação e contratos de segurança.
