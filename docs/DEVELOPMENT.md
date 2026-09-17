# Desenvolvimento com OpenCode e outros modelos

## Primeira execução
Clone https://github.com/juventudeilhacompridasp-cmyk/overlays.git e abra a pasta overlays no OpenCode.
Use Node.js 22. O projeto atual não requer npm install: não há dependências externas.
Configure seus provedores e créditos na configuração pessoal do OpenCode; não versione chaves.

O OpenCode lê AGENTS.md na raiz automaticamente. opencode.json carrega este guia como instrução
adicional e não fixa um provedor ou modelo. Em outras ferramentas, solicite a leitura de AGENTS.md.
Documentação oficial: https://opencode.ai/docs/rules/ e https://opencode.ai/docs/config/

Comandos:
```sh
git clone https://github.com/juventudeilhacompridasp-cmyk/overlays.git
cd overlays
git switch -c feat/minha-alteracao
npm run dev
```
Abra http://localhost:4173. Para testes automatizados, encerre o servidor de desenvolvimento
que ocupa essa porta; test.mjs inicia seu próprio servidor.

## Validação
```sh
npm run build
npm test
git diff --check
git diff --stat
```
O build deve preceder os testes: a suíte também importa o Worker de dist/server/index.js.
Os testes existentes usam um caminho /tmp e são executados na CI Ubuntu.
No Windows, prefira WSL/Linux para a suíte enquanto esse caminho não for tornado portátil;
não informe sucesso se o teste falhar por causa do ambiente.
Revise o diff e inclua a saída de dist/ regenerada junto com mudanças que afetem o build.

Teste manualmente o fluxo alterado no painel e no OBS. Use uma room de teste.
Verifique salas isoladas, recarga, sincronização entre duas janelas e persistência pertinente.
Mudanças de API exigem cobertura do servidor Node e do Worker; mocks não substituem uma
verificação do comportamento relevante em D1/R2 após publicação.

## Trabalho entre modelos
Cada tarefa começa com git status e leitura do diff existente.
Use branches separadas para trabalhos simultâneos, nunca duas IAs gravando na mesma árvore.
Ao trocar de modelo, forneça objetivo, branch, arquivos alterados, validações e pendências.
Mantenha decisões duráveis na documentação; não copie conversas inteiras nem invente requisitos.

Prompt inicial sugerido:
> Leia AGENTS.md e docs/DEVELOPMENT.md. Implemente [objetivo] preservando Node/Docker e Sites.
> Execute build e testes, revise dist/ e prepare a alteração para PR. Informe qualquer
> validação que não conseguiu executar. A publicação no GPT Sites segue docs/DEPLOY.md.

## GitHub
A CI “Validate project” executa build, testes, verificação do Worker e conferência de dist/
em PRs para main e pushes em main. Ela não usa credenciais de produção.
O PR deve explicar o efeito observável e como foi verificado.
Recomenda-se configurar proteção da main exigindo a CI; essa proteção não é instalada por
um arquivo YAML e precisa ser configurada nas regras do repositório.
