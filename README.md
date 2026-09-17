# Juventude Overlay Studio

Aplicação web para controle de placar, escalações, eventos, patrocinadores e outras artes de transmissões esportivas. Pode ser executada localmente, em uma rede privada ou em um servidor próprio.

## Desenvolvimento com IA e publicação

- [AGENTS.md](AGENTS.md): padrões obrigatórios para as IAs.
- [Guia de desenvolvimento](docs/DEVELOPMENT.md): OpenCode, branches e validação.
- [Fluxo de deploy](docs/DEPLOY.md): publicação de commits aprovados no GPT Sites.

O GitHub executa testes e build; a publicação no GPT Sites é realizada pelo conector Sites.
Um push na main não atualiza o Site automaticamente.

## Início rápido com Docker

### Requisitos

- Docker Desktop 4.x ou Docker Engine 24+
- Docker Compose v2
- Uma porta TCP livre; o padrão é `4173`

### Executar

Na pasta do projeto:

```bash
docker compose up -d --build
```

Abra no navegador:

- Painel: `http://localhost:4173`
- Verificação: `http://localhost:4173/health`

Para encerrar:

```bash
docker compose down
```

Os dados continuam salvos no volume Docker `juventude_overlay_studio_data`.

### Usar outra porta

Crie um arquivo `.env` com:

```env
OVERLAY_PORT=8080
```

Depois execute `docker compose up -d --build` e acesse `http://localhost:8080`.

## Uso na rede local e no OBS

Descubra o IP do computador que executa o Docker. No Windows, use `ipconfig`. Se o IP for `192.168.1.50`, o painel ficará em:

```text
http://192.168.1.50:4173
```

Exemplos de fontes Navegador do OBS, sempre usando a mesma sala:

```text
http://192.168.1.50:4173/overlay?layer=scoreboard&room=principal
http://192.168.1.50:4173/overlay?layer=event&room=principal
http://192.168.1.50:4173/overlay?layer=lineup&room=principal
http://192.168.1.50:4173/overlay?layer=photo-lineup&room=principal
http://192.168.1.50:4173/overlay?layer=sponsor&room=principal
http://192.168.1.50:4173/overlay?layer=all&room=principal
```

Configure a fonte Navegador em `1920 × 1080`. Para preservar o estado durante trocas de cena, deixe desmarcada a opção do OBS que desliga a fonte quando ela não está visível.

Se outro computador não conseguir acessar, libere a porta escolhida no Firewall do Windows e confirme que ambos estão na mesma rede.

## Executar sem Docker

Requer Node.js 20 ou superior. O projeto não usa pacotes externos em produção.

```bash
npm start
```

Por padrão, o servidor escuta em `0.0.0.0:4173` e grava o estado em `.data/overlay-state.json`.

No PowerShell, uma configuração personalizada pode ser iniciada assim:

```powershell
$env:PORT="8080"
$env:OVERLAY_STATE_FILE="C:\overlay-data\state.json"
npm start
```

## Estrutura do projeto

```text
public/
  index.html       Shell HTML da aplicação
  app.js           Interface, estado, overlays e controles
  styles.css       Painel, overlays, responsividade e animações
server.mjs         Servidor HTTP e persistência local
build.mjs          Gera a versão Cloudflare Worker/Sites
test.mjs           Verificações automatizadas
Dockerfile         Imagem de produção
docker-compose.yml Execução local com volume persistente
TECHNICAL_SPEC.md  Especificação técnica detalhada
```

## Desenvolvimento

1. Edite os arquivos de `public/` para alterar interface e overlays.
2. Edite `server.mjs` para mudar APIs ou persistência local.
3. Execute `npm test` antes de publicar.
4. Reconstrua o contêiner com `docker compose up -d --build`.

Não edite `dist/` manualmente. Ele é recriado por `npm run build`.

## Backup e restauração

### Backup do volume Docker

```bash
docker run --rm -v juventude_overlay_studio_data:/data -v "${PWD}:/backup" alpine tar czf /backup/overlay-backup.tar.gz -C /data .
```

### Restauração

Pare a aplicação antes da restauração:

```bash
docker compose down
docker run --rm -v juventude_overlay_studio_data:/data -v "${PWD}:/backup" alpine sh -c "rm -rf /data/* && tar xzf /backup/overlay-backup.tar.gz -C /data"
docker compose up -d
```

O backup contém estados das salas, catálogo de equipes e mídias enviadas.

## Hospedagem própria

O contêiner pode ser publicado em qualquer serviço que aceite Docker, como uma VPS, Coolify, Easypanel, Railway, Render ou Fly.io. A plataforma precisa oferecer:

- porta HTTP;
- volume persistente montado em `/app/.data`;
- suporte a uploads de até 50 MB;
- HTTPS quando o painel for acessado pela internet.

Para exposição pública, coloque a aplicação atrás de um proxy reverso com HTTPS e autenticação. O link de equipe usa um token de acesso, mas o painel administrativo local não implementa autenticação completa por usuário.

## Atualizações

Antes de substituir uma versão:

1. faça backup do volume;
2. atualize os arquivos do projeto;
3. execute `npm test`;
4. execute `docker compose up -d --build`.

O volume existente será reutilizado.
