# Autenticação e primeiro acesso

O painel exige login de administrador. A tela Usuários/Acessos permite criar e remover
administradores e definir usuário/senha de cada equipe. O último administrador não pode
ser removido. Equipes autenticadas só podem editar sua própria equipe.

## Primeiro administrador

No Sites, configure OVERLAY_SETUP_TOKEN como segredo de ambiente com pelo menos 32
caracteres aleatórios e publique a versão. O responsável pela instalação fornece esse
código de forma privada ao proprietário. Na tela inicial, preencha usuário, senha e código.
Sem o segredo configurado, o cadastro inicial fica bloqueado. Após criar a conta, o código
não permite criar outro primeiro administrador; as demais contas são criadas pelo painel.
As credenciais criadas em um servidor local não são transferidas automaticamente ao Sites.

No Node/Docker, use OVERLAY_SETUP_TOKEN ou consulte o código aleatório exibido no terminal
na primeira inicialização (docker compose logs overlay-studio). Sem variável, o código
muda ao reiniciar enquanto ainda não existe administrador. Nunca versione códigos ou senhas.

## Contratos de segurança

- Registros internos usam chaves com underscores, impossíveis de selecionar com safeRoom.
  A API /api/state também bloqueia aliases de autenticação e catálogo, para leitura e escrita.
- Primeiro administrador e segredo de sessão usam INSERT OR IGNORE no D1 para que instâncias
  simultâneas não criem donos diferentes nem sobrescrevam o segredo uma da outra.
- Cookies têm assinatura HMAC, expiração, HttpOnly, SameSite=Lax e Secure em HTTPS.
- A sessão administrativa referencia o id da conta. Remover a conta revoga sua sessão.
  A sessão de equipe referencia a versão das credenciais; remover/substituir o acesso revoga-a.
- Senhas usam PBKDF2; nunca retornam na API. Registros de autenticação não são salas de jogo.
- Leituras necessárias aos overlays continuam públicas. Login do painel não torna a transmissão
  privada. Links antigos de equipes continuam com fallback de leitura; escrita exige sessão.

Execute npm run build e npm test. A suíte cobre cadastro protegido, registros reservados,
revogação e concorrência entre Workers, além das funcionalidades esportivas.
