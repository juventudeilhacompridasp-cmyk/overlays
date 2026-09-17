# Publicação no GPT Sites

## Estado deste fluxo
Definido em 17/09/2026 a partir das ferramentas e skills Sites disponíveis nesta conta.
GitHub Actions valida o projeto. A publicação no GPT Sites continua sendo uma etapa
executada pelo conector Sites, em uma sessão autorizada. Não há integração automática
GitHub → Sites configurada por estes arquivos.
Não foi estabelecido aqui um endpoint público ou uma credencial de CI para publicação externa.
Não confunda o Git do Sites com o repositório GitHub.

- Código aprovado: https://github.com/juventudeilhacompridasp-cmyk/overlays (main).
- Site existente: https://juventude-futebol-overlay-studio.juventude-ilhacompri.chatgpt.site
- Identidade e bindings: ler .openai/hosting.json; reutilizar project_id, DB e BUCKET.
- Publicador: agente/sessão com conector Sites autenticado e acesso ao projeto.
- Estado e mídias de produção ficam no D1/R2, não no GitHub.

## Primeiro deploy com login

Configure OVERLAY_SETUP_TOKEN como segredo no Sites antes de publicar e entregue o código
ao proprietário por canal privado. Nunca coloque esse valor no Git ou no manifesto.
O cadastro inicial fica bloqueado sem esse código. Veja docs/AUTH.md.

## Fluxo operacional
1. Desenvolver no OpenCode com qualquer modelo e enviar uma branch/PR.
2. Executar a CI e integrar a alteração na main. Registrar o SHA completo aprovado.
3. Solicitar ao publicador: “Publique no Juventude Overlay Studio o commit <SHA> do
   repositório juventudeilhacompridasp-cmyk/overlays, seguindo docs/DEPLOY.md.”
4. O publicador executa o procedimento abaixo e informa URL, versão e resultado.
5. Conferir o fluxo alterado usando uma sala de teste. Testes não devem alterar a partida real.

Um push ou uma CI verde significam “código disponível/validado”; somente o status terminal
de sucesso do deploy confirma publicação. O simples reload do navegador não publica código.

## Procedimento do publicador
Use as skills sites-building/sites-hosting instaladas e os schemas atuais do conector.
Este guia não substitui instruções de autenticação, empacotamento ou audiência dessas ferramentas.

1. Consulte o Site existente e sua audiência. Verifique o SHA aprovado e a CI correspondente.
   Serializar publicações: uma por vez para este Site.
2. Reutilize o checkout do Sites ou obtenha credencial temporária para o mesmo project_id
   e clone a URL/branch retornadas. Use autorização HTTP somente no comando; nunca salve
   token no Git, no remoto, em arquivos ou em secrets de longa duração.
3. Busque o commit aprovado do GitHub. Compare com o código atual do Sites antes de integrar.
   Se houver mudanças exclusivas do Sites, reconcilie-as no GitHub e valide a revisão final.
   Não sobreponha silenciosamente mudanças feitas por outra conversa.
4. Integre a revisão aprovada preservando o histórico do Sites, sem force-push.
   A importação inicial para o GitHub criou um histórico diferente do histórico Sites.
   Pode ser necessário um merge inicial com históricos não relacionados; resolva conflitos
   explicitamente e confira a árvore resultante. Não use resolução automática “ours/theirs”.
   Se a integração exigir mudanças funcionais, volte ao GitHub para revisão e CI.
5. Configure o perfil local pelos helpers da skill, execute build e testes e confira a saída.
   O Worker deve exportar default.fetch; dist/.openai/hosting.json deve corresponder ao
   manifesto raiz. Preserve migrations, D1, R2, arquivos e dados existentes.
6. Faça commit da árvore exata e envie para o remoto/branch retornados pelo Sites.
   Copie git rev-parse --verify HEAD completo como commit_sha. Esse SHA pode diferir do
   SHA GitHub por causa do merge de integração; registre os dois.
   A árvore publicada deve corresponder à revisão aprovada, incluindo o build revisado.
7. Empacote essa mesma revisão com o helper package-site.mjs da skill. Não altere
   código/artefato entre o push, o empacotamento e o salvamento.
8. Use save_site_version com o commit_sha enviado e o caminho absoluto do arquivo local.
   Publique a versão retornada pelo caminho compatível com a audiência atual.
   Para um Site público, use deploy_site_version. Não o torne privado automaticamente.
   Não habilite publish_on_push=private para este fluxo público.
9. Consulte get_deployment_status até sucesso ou falha terminal. Em timeout, confira a
   versão/deploy já existentes antes de repetir. Não crie versões duplicadas por incerteza.
10. Registre no relatório de publicação: SHA GitHub, SHA Sites, versão, ID do deploy,
    data, URL, validações e possíveis limitações. Não registre tokens nem dados pessoais.

## Falhas e rollback
CI vermelha, conflito não resolvido ou alteração inesperada na origem impede a publicação.
Se falhar antes do deploy, a versão anterior continua sendo a referência; confirme o estado
com o conector em vez de presumir sucesso.
Para rollback, identifique uma versão anterior com artefato salvo e compatível com os dados,
republique-a pela operação de audiência apropriada e verifique o status.
Registre qual versão ficou ativa. Reverter GitHub sozinho não reverte o Site.
Rollback de código não reverte migrações, partidas, fotos ou uploads; planeje compatibilidade
e backup quando uma mudança afetar dados.

## Automação futura
Um monitor autorizado no ambiente com Sites pode acompanhar commits aprovados e executar
este mesmo procedimento, com registro de progresso, bloqueio de concorrência e repetição segura.
Isso ainda não foi configurado e não é um webhook do GitHub.
Uma CI externa só deve publicar diretamente se houver uma integração oficialmente suportada,
credenciais adequadas e teste completo do fluxo. Não reutilize tokens temporários do Sites.
