<p align="center"><img src="frontend/assets/marca/logo-ambar.svg" width="300" alt="Âmbar"></p>

# Âmbar Ofertas · MySQL

Loja de ofertas sem preço fixo: o vendedor cadastra um produto e os compradores propõem quanto querem pagar por uma unidade. A loja decide qual oferta aceitar. A maior proposta aparece como referência, sem prazo automático ou obrigação de aceitar a mais alta.

**Projeto editável com HTML, CSS, JavaScript, Node.js, Express e MySQL 8.** O Express serve o frontend e a API na mesma origem. Todas as contas, produtos, propostas, pedidos e alterações são persistidos nas tabelas relacionais MySQL. Não é necessário compilar o frontend.

## 1. Rodar pela primeira vez

Pré-requisitos: Node.js 20+ (recomendado 22), npm e MySQL 8.0.16+ em execução. O usuário MySQL precisa poder criar o banco na instalação inicial.

Abra um terminal na pasta que contém este README:

```bash
npm install
```

Copie `backend/.env.example` para `backend/.env`.

No Windows (PowerShell ou CMD):

```powershell
copy backend\.env.example backend\.env
```

No Linux/macOS:

```bash
cp backend/.env.example backend/.env
```

Edite `backend/.env` e configure:

```dotenv
PORT=3000
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=root
DB_PASSWORD="sua-senha-do-mysql"
DB_NAME=ambar_marketplace
JWT_SECRET=cole-aqui-uma-chave-aleatoria-com-pelo-menos-32-caracteres
JWT_EXPIRES_IN=2h
```

Gere um segredo próprio e cole o resultado em `JWT_SECRET`:

```bash
node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"
```

Crie o banco de demonstração e inicie o servidor:

```bash
npm run db:criar
npm start
```

Abra **http://localhost:3000**. Mantenha o terminal do servidor aberto. Para editar com reinício automático do Node:

```bash
npm run dev
```

O comando `db:criar` recusa sobrescrever um banco existente. **Somente se quiser apagar e recriar todos os dados**, use `npm run db:criar -- --recriar`. Para criar sem dados demonstrativos, use `npm run db:criar -- --sem-dados`.

Também é possível instalar e executar dentro de `backend/`, usando `npm install`, `npm run db:criar` e `npm start`. Os comandos da raiz delegam para esse backend.

## 2. Atualizar uma instalação antiga do Âmbar

Se você já possui o banco original com as 19 tabelas, faça um backup e execute:

```bash
npm run db:migrar
```

A migração cria as tabelas de rodadas e lances, remove o preço fixo dos produtos e adapta pedidos para ofertas. Os pedidos históricos são preservados; a interface atual mostra apenas pedidos vinculados a uma oferta. As fotos do catálogo demonstrativo passam a apontar para os arquivos locais incluídos.

Execute a migração com a aplicação parada. A migração verifica se `rodadas_ofertas` já existe para evitar reexecutar um banco atualizado. Se uma migração tiver sido interrompida, restaure o backup e execute novamente; DDL MySQL não oferece rollback integral desse conjunto de alterações.

## 3. Contas para testar

Todas usam a senha didática **Ambar@2026**. Você pode preencher os campos ou usar os botões de perfil no login.

| Perfil | E-mail | Função |
| --- | --- | --- |
| Administrador | `admin@ambar.test` | Produtos e ofertas de todas as lojas, usuários, indicadores e auditoria. |
| Vendedor | `vendedor@ambar.test` | Ateliê Jacarandá: produtos, estoque, ofertas e pedidos da própria loja. |
| Comprador | `comprador@ambar.test` | Fazer ofertas, favoritar e acompanhar as negociações aceitas. |

Contas e catálogo de demonstração são fictícios. Antes de disponibilizar para usuários reais, substitua as contas demonstrativas, configure HTTPS e integre os serviços de pagamento e entrega necessários.

## 4. Fluxo que está implementado

1. Vendedor cadastra produto com nome, descrição, categoria, imagem e estoque. **Não existe campo de preço fixo.**
2. Comprador envia uma oferta positiva por uma unidade. Não há preço inicial determinado pela loja.
3. O comprador pode aumentar sua própria proposta. A anterior fica marcada como superada; propostas de pessoas diferentes podem ter qualquer valor positivo.
4. Histórico e maior oferta aparecem no produto; enquanto a página estiver visível, o histórico é atualizado a cada 10 segundos. Os nomes públicos são abreviados.
5. A loja aceita uma proposta em “Ofertas recebidas”. Uma transação MySQL bloqueia produto e rodada, reserva uma unidade e cria um pedido pelo valor aceito. Duas ofertas não podem reservar a mesma unidade.
6. O comprador escolhido vê a negociação e pode simular o pagamento.
7. Vendedor avança pelas etapas preparação → enviado → entregue. O histórico é gravado no banco.
8. Antes da preparação, comprador ou administrador pode cancelar; o estoque volta uma única vez.
9. Após entrega/cancelamento, o vendedor pode abrir uma nova rodada, se o produto estiver ativo e com estoque. O histórico anterior permanece.

Também estão integrados: cadastro/login, perfil, troca de senha, logout com invalidação de JWT, favoritos, endereços, perguntas, solicitação de vendedor, newsletter, CRUD de produtos, bloqueio de usuários e auditoria. O frontend tem animações discretas e respeita a preferência de movimento reduzido.

## 5. Estrutura para modificar

```text
ambar-marketplace/
├── frontend/
│   ├── index.html e demais páginas HTML
│   ├── css/ambar.css             # aparência e animações
│   ├── js/ambar.js               # telas, eventos e chamadas Fetch
│   ├── js/nucleo/icones.js       # ícones usados pela interface
│   └── assets/                  # marca, fontes, fotos e vídeo
├── backend/
│   ├── app.js                   # Express, cookies JWT, rotas e arquivos estáticos
│   ├── server.js                # validação da configuração e inicialização
│   ├── routes/interfaceRoutes.js # contratos usados pelo frontend atual
│   ├── services/ofertas.js      # regras de lances, aceite, estoque e pedidos
│   ├── routes/ e controllers/   # demais recursos da API
│   ├── middlewares/            # autenticação, autorização, limites e segurança
│   ├── database/conexao.js      # pool mysql2 e transações
│   ├── scripts/                # criação/migração do banco
│   ├── tests/integracao.test.js # testes contra MySQL real
│   └── .env.example            # modelo de configuração sem segredos
├── sql/                        # estrutura, dados e migração de ofertas
├── docs/                       # modelo do banco e roteiro de apresentação
├── package.json e package-lock.json
└── README.md
```

Os HTML carregam a interface de `frontend/js/ambar.js`. Para mudar textos, componentes ou páginas, edite esse JavaScript; para cores, espaçamento e animações, edite `frontend/css/ambar.css`. Os arquivos antigos em `js/paginas/` e outros módulos de `js/nucleo/` são preservados como referência do desenvolvimento original; a interface atual não os importa, exceto `icones.js`.

`interfaceRoutes.js` adapta os contratos usados pelas telas atuais. As demais rotas originais continuam disponíveis para categorias, banners, configurações, moderação e outros recursos. O checkout antigo de preço fixo é bloqueado com HTTP 410.

## 6. Banco relacional

São **21 tabelas InnoDB**: as 19 originais mais `rodadas_ofertas` e `lances`, relacionadas a produtos, compradores e pedidos por chaves estrangeiras. Produtos têm `preco` e `preco_original` nulos; uma restrição CHECK impede definir preço fixo.

- `sql/01_estrutura.sql`: estrutura original; é destrutivo se executado manualmente sobre um banco existente.
- `sql/02_dados_demo.sql`: 42 usuários, 11 lojas, 11 categorias, 69 produtos e histórico demonstrativo original.
- `sql/03_ofertas.sql`: novo modelo e referências locais das fotos.

O script Node aplica os três arquivos em ordem. `DB_NAME` pode ser alterado no `.env`; os scripts Node substituem o nome padrão com validação do identificador. Executando SQL manualmente no Workbench, os arquivos usam `ambar_marketplace`.

As tabelas `produtos`, `usuarios`, `lances`, `rodadas_ofertas`, `pedidos`, `pedido_itens`, `pedido_historico`, `favoritos` e demais recursos são a fonte dos dados da aplicação; editar esses registros no MySQL se reflete na API. O banco antigo de demonstração não é usado como uma cópia paralela.

## 7. Rotas principais

| Método | Rota | Acesso |
| --- | --- | --- |
| GET | `/api/saude` | Público, verifica MySQL. |
| POST | `/api/auth/cadastro`, `/api/auth/login` | Público. |
| GET | `/api/auth/me` (ou `/eu`) | Autenticado. |
| PUT | `/api/auth/perfil`, `/api/auth/senha` | Autenticado. |
| POST | `/api/auth/logout`, `/api/auth/logout-todos` | Autenticado; invalida os tokens da conta. |
| GET | `/api/produtos`, `/api/produtos/:id` | Público. |
| GET | `/api/produtos/gerenciar` | Vendedor/admin. |
| POST/PUT/DELETE | `/api/produtos[/id]` | Vendedor proprietário/admin. |
| GET/POST | `/api/produtos/:id/lances` | Leitura pública; escrita comprador. |
| GET | `/api/lances/meus` | Comprador. |
| GET | `/api/lances/vendedor` | Vendedor/admin. |
| POST | `/api/lances/:id/aceitar` | Vendedor proprietário/admin. |
| POST | `/api/produtos/:id/reabrir` | Vendedor proprietário/admin. |
| GET | `/api/pedidos/meus`, `/vendedor`, `/admin` | Conforme o perfil. |
| GET | `/api/pedidos/:id` | Comprador envolvido, vendedor envolvido ou admin. |
| POST | `/api/pedidos/:id/pagar`, `/cancelar`, `/status` | Conforme a ação e o perfil. |
| GET/POST/DELETE | `/api/favoritos` | Autenticado. |
| GET/POST | `/api/enderecos` | Autenticado. |
| DELETE | `/api/enderecos/:id` | Dono do endereço. |
| GET/POST | `/api/produtos/:id/perguntas` | Público/autenticado. |
| GET/POST | `/api/produtos/:id/avaliacoes` | Público/comprador com entrega confirmada. |
| GET | `/api/dashboard/vendedor`, `/api/dashboard/admin` | Conforme o perfil. |
| GET/PUT | `/api/usuarios[/id]` | Admin. |
| GET | `/api/auditoria` | Admin. |
| GET | `/api/sons` | Público; informa sons sintetizados. |

Os testes também cobrem resposta 401 sem sessão e 403 quando o perfil ou a propriedade não permite a ação.

## 8. Segurança

Senhas usam bcrypt. JWT usa HS256, emissor, público e validade configurados; o segredo fica no `.env`. O frontend recebe JWT em cookie HttpOnly/SameSite; clientes de API também podem usar `Authorization: Bearer`. Cada requisição consulta o usuário e a versão do token no MySQL. Bloqueio, troca de senha e logout invalidam sessões anteriores.

Login possui bloqueio temporário após cinco senhas incorretas e limite de requisições por IP. A API usa parâmetros SQL, permissões por perfil/proprietário, transações e locks InnoDB. Helmet aplica cabeçalhos e CSP; estilos inline são permitidos porque a interface usa atributos de estilo, enquanto scripts permanecem restritos à própria origem.

Em produção, use `NODE_ENV=production`, HTTPS e `HOST=0.0.0.0` se necessário para sua hospedagem. Cookies ficam `Secure` em produção. O segredo JWT deve ser próprio, e o usuário MySQL da aplicação deve receber apenas as permissões necessárias depois da instalação. Nenhum software garante ausência absoluta de falhas.

## 9. Testes em banco separado

Com o MySQL disponível e as credenciais configuradas em `backend/.env`:

```bash
npm test
```

O `pretest` **recria somente o banco de testes** `ambar_marketplace_test`, aplica os três SQLs e executa as verificações HTTP contra o Express real. Seu banco normal configurado em `DB_NAME` não é apagado. Para outro nome de testes, defina `TEST_DB_NAME` com sufixo `_test`; o script rejeita qualquer nome sem esse sufixo.

A conta MySQL usada nos testes precisa poder criar esse banco. Os testes abrem uma porta local temporária e fecham o servidor e o pool no final. `JWT_SECRET` é gerado temporariamente se estiver ausente no ambiente de testes.

A suíte de integração está em `backend/tests/integracao.test.js` e contém verificações de autenticação, permissões, ofertas, pedidos e recursos auxiliares. A presença dos testes no repositório não equivale a uma execução aprovada: o resultado deve ser conferido ao executar `npm test` no ambiente configurado.

Esta documentação não declara uma quantidade de testes aprovados nem execução automática pelo GitHub. O comando acima executa os testes localmente.

## 10. Registro das alterações no GitHub

Mantenha as atualizações no mesmo repositório utilizado nas entregas. O envio pode ser realizado pela interface do GitHub ou pelo Git local. Agrupe alterações relacionadas e escreva mensagens que indiquem o que foi alterado.

Exemplos de mensagens, a utilizar somente quando corresponderem ao trabalho realizado:

- `Adiciona gitignore para arquivos locais e dependências`
- `Corrige referências da documentação das entregas`
- `Atualiza documentação do banco para o modelo de ofertas`

Antes de enviar os arquivos, crie ou confira o `.gitignore` na raiz do repositório, ao lado deste README, com o seguinte conteúdo:

```gitignore
node_modules/
.env
.env.*
!.env.example
*.log
coverage/
.DS_Store
Thumbs.db
```

Mantenha `backend/.env.example` versionado como modelo de configuração. Não envie o `.env` real nem dependências instaladas. O `.gitignore` não remove arquivos já versionados; confira os arquivos incluídos em cada alteração, inclusive quando utilizar upload pela interface do GitHub.

O GitHub armazena o código e o histórico das alterações. Para acessar a aplicação online, é necessária uma hospedagem que execute Node.js e MySQL. GitHub Pages sozinho serve apenas os arquivos estáticos.

## 11. Escopo e créditos

Esta versão cobre o modelo de ofertas descrito neste README. Pagamentos e entregas são simulados; não há gateway financeiro, logística ou envio real de newsletter. Aprovação de vendedores, respostas e administração de categorias/banners/configurações possuem recursos na API original, mas ainda não têm todas as telas de gestão na interface atual. Os áudios do ElevenLabs não vieram no projeto: sons opcionais são sintetizados no navegador.

Fotos: Unsplash, usadas como ilustração do catálogo e incluídas localmente. Fontes: Fraunces e Instrument Sans, com licenças OFL incluídas. Marca e vídeo: arquivos do projeto original. O planejamento histórico de preço fixo foi preservado em `docs/README-original.md`; ele documenta a etapa anterior e não substitui o escopo atual.

Roteiro para apresentar o sistema: `docs/APRESENTACAO.md`.

## Problema identificado

Pequenos lojistas e vendedores independentes frequentemente negociam produtos por mensagens e redes sociais. Nesse processo, as propostas dos compradores ficam espalhadas em conversas, dificultando comparar valores, acompanhar interessados e registrar qual negociação foi aceita.

O controle manual também pode causar conflitos de estoque: duas pessoas podem acreditar que compraram a mesma unidade, enquanto o vendedor não possui um registro centralizado das ofertas, reservas e etapas do pedido.

O projeto trabalha esse problema por meio de uma loja de ofertas sem preço fixo, reunindo catálogo, propostas, decisão do vendedor e acompanhamento da negociação em um único sistema.

## Público afetado

- Vendedores e pequenos lojistas que recebem propostas e precisam organizar produtos, interessados e estoque.
- Compradores que desejam propor um valor e acompanhar a resposta da loja.
- Administradores responsáveis por acompanhar usuários, produtos e o funcionamento da plataforma.

## Justificativa

Centralizar as ofertas permite consultar o histórico das propostas, identificar seus participantes e registrar a decisão do vendedor.

A integração com um banco relacional possibilita relacionar compradores, produtos, ofertas e pedidos. O uso de transações na aceitação evita que duas propostas reservem a mesma unidade ao mesmo tempo.

Assim, a solução busca organizar uma negociação que normalmente dependeria de mensagens e controles manuais.

## Proposta de solução

A Âmbar é uma aplicação web na qual o vendedor cadastra produtos sem definir um preço fixo. Os compradores informam quanto desejam pagar por uma unidade, e a loja escolhe qual proposta aceitar.

A maior oferta é apresentada como referência. Não há encerramento automático por prazo nem obrigação de aceitar a proposta mais alta.

Quando uma oferta é aceita, o sistema reserva uma unidade do estoque e cria uma negociação pelo valor escolhido. O comprador e o vendedor podem acompanhar suas etapas.

## Objetivo geral

Desenvolver um sistema web que organize a negociação de produtos por ofertas, com controle de acesso, histórico das propostas e reserva consistente de estoque.

## Objetivos específicos

1. Permitir cadastro e autenticação de usuários.
2. Diferenciar permissões de comprador, vendedor e administrador.
3. Disponibilizar cadastro, consulta, edição e desativação de produtos.
4. Permitir o envio e o acompanhamento de ofertas.
5. Registrar a aceitação de uma proposta pelo vendedor.
6. Reservar estoque e criar o pedido em uma única transação.
7. Permitir acompanhar pagamento simulado, preparação, envio, entrega e cancelamento.
8. Manter registros de auditoria das principais ações.

## Principais funcionalidades da solução

- Cadastro, login e autenticação com JWT.
- Perfis de comprador, vendedor e administrador.
- Catálogo com busca, categorias e ordenação.
- CRUD de produtos integrado ao frontend, à API e ao MySQL.
- Envio e histórico de ofertas por produto.
- Acompanhamento das propostas do comprador.
- Painel de ofertas recebidas pelo vendedor.
- Aceitação transacional com reserva de estoque.
- Acompanhamento e cancelamento de negociações.
- Reabertura de rodadas, preservando o histórico.
- Favoritos, endereços, perguntas e indicadores.
- Controle de permissões e registro de auditoria.

## Tipos de usuário e responsabilidades

| Perfil | Ações principais |
| --- | --- |
| Visitante | Consultar produtos, lojas e ofertas públicas; pesquisar e criar uma conta. |
| Comprador | Fazer e melhorar suas ofertas, acompanhar propostas aceitas, favoritar produtos e gerenciar seus dados. |
| Vendedor | Gerenciar os próprios produtos e estoque, consultar propostas recebidas, aceitar ofertas e acompanhar os pedidos da loja. |
| Administrador | Acompanhar produtos e ofertas de todas as lojas, gerenciar o acesso dos usuários e consultar indicadores e auditoria. |

As permissões são verificadas pela API. Esconder um botão no frontend não concede nem substitui autorização.

## Fluxo básico de funcionamento

1. O vendedor cadastra um produto sem preço fixo.
2. O visitante consulta o catálogo.
3. O comprador entra na conta e envia uma oferta por uma unidade.
4. O sistema registra a proposta e apresenta o histórico.
5. O vendedor escolhe uma oferta e confirma sua aceitação.
6. Uma transação MySQL reserva a unidade e cria o pedido pelo valor aceito.
7. O comprador pode simular o pagamento.
8. O vendedor atualiza as etapas de preparação, envio e entrega.
9. Quando permitido, o cancelamento devolve a unidade ao estoque.
10. Uma nova rodada pode ser aberta após a conclusão ou o cancelamento, desde que haja estoque.

## Regras de negócio principais

- Produtos não possuem preço fixo.
- Ofertas precisam ter valor positivo e até duas casas decimais.
- Para melhorar sua própria oferta, o comprador deve aumentar o valor anterior.
- Somente o vendedor proprietário ou o administrador pode aceitar uma proposta.
- Uma rodada aceita apenas uma oferta.
- A oferta, sozinha, não reserva estoque; a reserva ocorre na aceitação.
- Aceitação, reserva e criação do pedido são realizadas na mesma transação.
- O status do pedido deve avançar na sequência permitida.
- Um pedido cancelado não pode devolver estoque mais de uma vez.
- O histórico das rodadas anteriores é preservado.

## Escopo acadêmico e demonstração

O fluxo central do projeto é a negociação por ofertas, com CRUD de produtos, autenticação, permissões e persistência no MySQL.

### Recorte das entregas

O planejamento registrado no projeto organiza as entregas da seguinte forma. Os critérios oficiais da atividade devem ser consultados no enunciado do professor.

| Entrega | Foco do planejamento |
| --- | --- |
| 1 | Definição do problema, público, justificativa, proposta e estrutura inicial; documentação e registro no GitHub. |
| 2 | Banco relacional, cadastro, login, autenticação JWT e controle de acesso. |
| 3 | CRUDs integrados à interface, permissões e regras de negócio. |
| 4 | Integração final, testes, documentação e apresentação. |

Para a etapa 2, as principais evidências no código são os scripts em `sql/`, a documentação em `docs/banco-de-dados.md`, a conexão em `backend/database/conexao.js`, o cadastro e login em `backend/controllers/authController.js` e os middlewares de autenticação e autorização em `backend/middlewares/`.

O modelo original possui 19 tabelas. A versão de ofertas acrescenta `rodadas_ofertas` e `lances`, totalizando 21 tabelas após a aplicação dos três scripts SQL. O documento `docs/README-original.md` preserva o planejamento histórico; as instruções deste README descrevem a versão atual.

Os recursos das etapas posteriores são apresentados para contextualizar o projeto e não alteram o recorte de cada entrega.

### Conferência da etapa 2

1. Criar o banco seguindo as instruções de instalação e conferir tabelas, chaves e relacionamentos no MySQL.
2. Cadastrar uma conta e verificar sua persistência no banco, com senha armazenada como hash.
3. Fazer login com credenciais válidas e confirmar a recusa de credenciais inválidas.
4. Confirmar que uma rota protegida recusa uma requisição sem autenticação com status 401.
5. Confirmar que uma conta de comprador recebe status 403 ao tentar acessar um recurso administrativo.
6. Conferir se a documentação do banco representa o modelo atual de 21 tabelas.
7. Executar `npm test` no ambiente configurado e conferir o resultado antes de declarar aprovação dos testes.

### Referências para a documentação das entregas

Em `docs/entregas.md`, utilize os títulos das seções deste README em vez da numeração antiga: “Problema identificado”, “Público afetado”, “Justificativa”, “Proposta de solução”, “Principais funcionalidades da solução”, “Tipos de usuário e responsabilidades”, “Fluxo básico de funcionamento” e “5. Estrutura para modificar”. Atualize também a descrição do banco para distinguir as 19 tabelas originais das 21 tabelas da versão atual.

Pagamentos e entregas são simulados. Recursos auxiliares que ainda não possuem interface completa estão identificados na seção de escopo deste README e não são apresentados como funcionalidades finalizadas.

Na apresentação, serão demonstrados o problema escolhido, os perfis, o banco relacional, a arquitetura, a autenticação, o CRUD e o fluxo completo de uma oferta aceita.

## Acompanhamento pelo GitHub

O desenvolvimento e suas atualizações devem permanecer no mesmo repositório utilizado nas quatro entregas, com commits que representem as alterações realizadas.

O repositório deve conter código-fonte, scripts SQL, documentação e instruções de execução. Arquivos .env, node_modules e credenciais privadas não devem ser enviados.
