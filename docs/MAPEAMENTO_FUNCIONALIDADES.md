# Mapeamento de funcionalidades e plano de desenvolvimento

Este documento adapta ao nosso projeto o mapa de funcionalidades de um app de gestão de campeonatos
amadores (referência: CopaFácil), recebido em 02/10/2026. Ele diz o que o Overlay Studio já cobria, o
que foi construído a partir dele e o que fica fora do escopo de propósito. Atualize as caixas ao
entregar novas partes.

## Escopo adotado

O projeto é uma ferramenta para uma organização (o Juventude Esporte Clube e o campeonato que ela
transmite), com transmissão em OBS como diferencial. Por isso:

- **Entra:** formatos de campeonato, classificação, estatísticas, súmula, página pública, mídia,
  moderadores, importação de planilhas, API JSON, widgets e PWA.
- **Fica de fora (por escolha):** planos pagos e cobrança (a referência é multi-cliente; aqui há uma
  organização), multi-idioma (a interface é em português por regra do projeto), app nativo e push.

## Matriz de funcionalidades

Legenda: ✅ entregue · 🟡 parcial · ⬜ não feito (motivo ao lado).

| Área da referência | Funcionalidade | Estado | Onde |
|---|---|---|---|
| A. Montagem | Cadastro de equipes | ✅ | Times; importação por planilha CSV |
| A. Montagem | Geração automática de partidas (liga, grupos, mata-mata) | ✅ | Campeonatos > Gerar partidas |
| A. Montagem | Sorteio de grupos | ✅ | Campeonatos > Gerar partidas (formato grupos) |
| A. Montagem | Moderadores / permissões compartilhadas | ✅ | Papéis (admin, operador, leitor) + moderadores por campeonato |
| A. Montagem | Várias modalidades | 🟡 | Campo `sport` no campeonato; overlays continuam futebol, futsal, vôlei e basquete |
| B. Resultados | Classificação ao vivo | ✅ | Classificação e súmulas; página pública |
| B. Resultados | Critérios de desempate configuráveis | ✅ | Regras e desempate (ordem arrastável) |
| B. Resultados | Tela de partida com linha do tempo | ✅ | Súmula; os lances vêm da sala de transmissão |
| B. Resultados | Edição/correção de placar | ✅ | Partidas > Placar; `set-result` |
| C. Estatísticas | Artilharia, cartões | ✅ | Classificação e súmulas; página pública |
| C. Estatísticas | Suspensões automáticas | ✅ | Regras: amarelos para suspender e jogos por vermelho |
| C. Estatísticas | Rankings personalizáveis de jogadores | ⬜ | Só artilharia e cartões por ora |
| C. Estatísticas | Súmula de jogo | ✅ | Tela imprimível |
| C. Estatísticas | Relatórios por equipe/jogador | 🟡 | Exportações CSV de times, partidas, campeonatos e auditoria |
| D. Mídia | Feed com fotos, vídeos e notícias por rodada | ✅ | Notícias e mídia; aba Notícias da página pública |
| D. Mídia | Artes de resultado e ranking para redes | ✅ | Gerar arte (PNG, compartilhar no celular) |
| D. Mídia | Feed "ao vivo" | 🟡 | Seção Ao vivo nas páginas; sem atualização por push |
| E. Público | Link personalizado do campeonato | ✅ | `/c/<slug>` |
| E. Público | Página do organizador | ✅ | `/o/<slug>` |
| E. Público | Busca pública | ✅ | `/campeonatos` |
| F. Patrocínio | Banners nos campeonatos | ✅ | Biblioteca de patrocínios exibida nas páginas públicas |
| F. Patrocínio | Planos pagos / "sem propagandas" | ⬜ | Fora do escopo (uma organização) |
| G. Integração | API JSON | ✅ | `/api/public/...` (ver TECHNICAL_SPEC) |
| G. Integração | Embed em outros sites | ✅ | `/embed/standings\|matches\|scorers` |
| G. Integração | Importação de planilhas | ✅ | Times > Importar planilha (modelo disponível) |
| G. Integração | Dados em overlays do OBS | ✅ | Builder: `{table.N.*}`, modelo "Classificação" |
| H. Plataforma | Web responsiva e PWA | ✅ | Manifest e service worker nas páginas públicas e portal |
| H. Plataforma | App nativo iOS/Android | ⬜ | PWA cobre a instalação |
| H. Plataforma | Multi-idioma | ⬜ | Fora do escopo |
| H. Plataforma | Perfis de torcedor e notificações | 🟡 | "Seguir" campeonatos no aparelho; sem notificações push ou e-mail |

## Fases do plano e o que cada uma entregou

- [x] **Fase 0 — Fundação:** já existia (Node + Worker, D1/R2, autenticação, papéis).
- [x] **Fase 1 — MVP:** campeonatos, equipes, geração todos contra todos, resultado manual, tabela automática, agenda.
- [x] **Fase 2 — Formatos avançados:** grupos com sorteio, mata-mata (byes, ida e volta, pênaltis), desempate configurável, correção de placar.
- [x] **Fase 3 — Estatísticas e documentos:** artilharia, cartões, suspensões, súmula imprimível, exportações.
- [x] **Fase 4 — Página pública:** campeonato, organizador, busca, responsivo.
- [x] **Fase 5 — Mídia:** notícias e fotos por rodada, artes para redes.
- [x] **Fase 6 — Multiusuário:** moderadores por campeonato e papéis; torcedor só com "seguir" local.
- [~] **Fase 7 — Monetização:** apenas banners de patrocinador (biblioteca); planos pagos descartados.
- [x] **Fase 8 — Integrações:** API pública, widgets incorporáveis, importação de planilha, tabela ao vivo nos overlays.
- [~] **Fase 9 — Polimento:** PWA e testes automatizados feitos; notificações push/e-mail ficam para quando houver serviço de envio.

## Decisões de projeto

- **Uma regra, dois runtimes:** `competition.mjs` é a única implementação das regras (geração, desempate,
  suspensões, vencedores); o Worker a inlina no build. Mudou a regra? Mude lá e rode `npm test`.
- **Placar:** pode ser lançado na partida (agenda) ou, sem isso, vem do placar da sala de transmissão.
  Assim, quem já opera pelo painel de overlays não precisa digitar o resultado duas vezes.
- **Privacidade:** campeonatos nascem privados. Só `isPublic` + `slug` aparecem na API pública e nas
  buscas; administradores enxergam os privados por `?id=`.
- **Limites conhecidos:** a artilharia depende do nome do autor nos eventos da sala; suspensões usam o
  nome do atleta (não o id); o mata-mata só avança com todos os jogos da rodada finalizados.

## Próximos passos sugeridos

1. Rankings personalizáveis (assistências, defesas) com novos tipos de evento.
2. Notificações (e-mail/WhatsApp) quando houver provedor de envio autorizado.
3. Painel do torcedor com conta, se a organização quiser seguir campeonatos entre aparelhos.

## Complemento: artes e overlays de campeonato
- **Estúdio de artes** (`/manage/arts`): 17 tipos de arte (uma por informação da plataforma), 6 estilos, 4 formatos e personalização de cores, fonte, fundo e logo — cobre "artes para redes sociais".
- **Overlays de campeonato** (`/obs/<visão>`, configurados em `/manage/broadcast`): tabela, próximos jogos, resultados, artilharia, cartões, jogo em destaque, faixa de placares e campeão como fontes transparentes de OBS, com animações e parâmetros por URL.
