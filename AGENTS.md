# Instruções para agentes — Juventude Esporte Clube

Leia este arquivo antes de alterar o projeto. Vale para qualquer modelo, IDE ou agente.
As instruções explícitas do usuário definem o escopo da tarefa.

## Contexto e arquivos
- Produto: painel em português para transmissões esportivas, fontes transparentes no OBS e portais de equipes.
- Leia README.md para execução e TECHNICAL_SPEC.md para rotas, dados e funcionalidades.
- Leia docs/DEVELOPMENT.md para trabalhar, docs/AUTH.md antes de alterar autenticação e
  docs/DEPLOY.md antes de publicar.
- Leia CHANGELOG.md para entender o histórico recente antes de propor uma mudança;
  ele existe para que outra IA (ou você mesma, em outra sessão) recupere contexto rápido.
- Interface: public/app.js, public/styles.css e public/index.html.
- Backend local: server.mjs. Backend hospedado: código do Worker gerado por build.mjs.
- dist/ é gerado e atualmente versionado. Nunca edite esse diretório à mão.
- Stack atual: JavaScript ESM, HTML e CSS, sem dependências externas de produção.
  Use Node 22 para desenvolvimento e CI; preserve a compatibilidade declarada no package.json.

## Padrão de implementação
- Faça mudanças pequenas ligadas ao pedido. Preserve a identidade visual e a interface em português.
- Siga o estilo do arquivo: dois espaços, ponto e vírgula e aspas simples no JavaScript quando aplicável.
- Prefira funções com responsabilidade clara e nomes descritivos. Explique decisões pouco óbvias, não cada linha.
- Não migre frameworks, arquitetura, armazenamento ou dependências apenas por preferência do modelo.
- Valide dados nas APIs e escape conteúdo fornecido pelo usuário antes de inseri-lo no HTML.
- Não coloque credenciais, tokens, fotos reais de usuários ou estados de partidas no Git.
- Mantenha .openai/hosting.json e seus bindings DB/BUCKET. Não troque project_id, domínio ou audiência como parte de uma mudança comum.
- Preserve contratos de URLs e isolamento por room, updatedAt, sincronização entre abas/dispositivos,
  tokens dos portais, uploads e compatibilidade com estados antigos.
- Alterações de backend devem tratar server.mjs e build.mjs. Quando houver diferença intencional
  entre Node/disco e Worker/D1/R2, documente e teste os dois comportamentos.
- Preserve transparência dos overlays, composição em 1920×1080 e links existentes do OBS.
  Controles administrativos não podem aparecer na saída transparente.

## Fluxo de trabalho
1. Confira git status, branch e alterações existentes. Não descarte trabalho de outra pessoa/IA.
2. Atualize a base antes de começar e use branch feat/<resumo>, fix/<resumo> ou docs/<resumo>.
   Se o usuário determinar outro fluxo, siga-o sem pedir autorização repetida.
3. Implemente e adicione testes para novos comportamentos ou regressões relevantes.
4. Execute npm run build e npm test; confira git diff, inclusive dist/.
5. Para mudanças visuais, confira o painel e a fonte /overlay com a mesma room de teste.
   Não use salas ou uploads de produção nos testes.
6. Atualize CHANGELOG.md em toda mudança com efeito observável (rotas, dados, interface, segurança,
   build/deploy). Regras obrigatórias para a entrada:
   - Sempre em português, sob `## [Não publicado]`, na subseção certa (Adicionado, Alterado,
     Corrigido, Removido ou Segurança — crie a subseção se faltar).
   - Detalhada o bastante para outra IA, sem ver esta conversa, entender o que mudou, por que
     mudou e como isso afeta contratos existentes (rotas, formato de dados, compatibilidade).
     Não basta nomear o arquivo tocado; descreva o comportamento novo/alterado.
   - Ao abrir o PR, mova a entrada de "Não publicado" para uma seção com a versão/data,
     mantendo "Não publicado" vazio para o próximo ciclo.
   - Corrija a entrada no mesmo commit se a mudança for revista antes do push; não acumule
     entradas desatualizadas ou contraditórias.
7. Envie a branch e abra PR quando houver autorização para trabalhar no GitHub.
   Descreva problema, resultado, validação e impactos em dados.
8. Ao concluir, informe arquivos relevantes, testes realmente executados, falhas e próximo passo.
   Não diga que publicou quando apenas fez commit/push ou quando a CI passou.

## Limites de publicação
GitHub é a fonte de código aprovada. main validada é candidata à publicação, não prova de deploy.
A CI não publica no GPT Sites. A publicação usa o conector Sites em um ambiente autorizado;
siga docs/DEPLOY.md. Não invente API pública, webhook, token permanente ou comando de deploy.
Não faça force-push, reset destrutivo, exclusão de dados ou troca de audiência como correção automática.
Não publique em produção apenas para testar. Reversões de código não restauram dados automaticamente.
