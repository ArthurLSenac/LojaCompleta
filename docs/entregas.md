# Registro das entregas

Este documento relaciona as entregas planejadas às evidências presentes no projeto. O README principal descreve a versão atual e suas instruções de execução.

## Entrega 1 — Problema e estrutura inicial

- Definição do problema, do público afetado e da justificativa nas seções “Problema identificado”, “Público afetado” e “Justificativa” do README.
- Planejamento da solução nas seções “Proposta de solução”, “Objetivo geral” e “Objetivos específicos”.
- Funcionalidades, perfis e fluxo nas seções “Principais funcionalidades da solução”, “Tipos de usuário e responsabilidades” e “Fluxo básico de funcionamento”.
- Organização do projeto em `backend/`, `frontend/`, `sql/` e `docs/`, com documentação principal no `README.md`.
- Separação do back-end em `routes/`, `controllers/`, `middlewares/`, `services/`, `database/`, `utils/` e `config/`.
- Estrutura descrita na seção “5. Estrutura para modificar” do README.
- Identidade visual com logotipo, ícones e fontes em `frontend/assets/`.
- O `.gitignore` deve permanecer na raiz para excluir configurações locais, dependências e arquivos temporários do versionamento.

## Entrega 2 — Banco de dados e autenticação

### Banco de dados

- Estrutura relacional original com 19 tabelas em `sql/01_estrutura.sql`, incluindo chaves primárias, estrangeiras e restrições de integridade.
- Dados de demonstração em `sql/02_dados_demo.sql`.
- Evolução para o modelo de ofertas em `sql/03_ofertas.sql`, acrescentando `rodadas_ofertas` e `lances`.
- A versão atual utiliza 21 tabelas após a aplicação dos três scripts.
- Criação do banco pelo comando `npm run db:criar`.
- Conexão com MySQL em `backend/database/conexao.js`.
- Documentação complementar em `docs/banco-de-dados.md`, que deve acompanhar as alterações do modelo atual.

### Cadastro, login e controle de acesso

- Cadastro e login em `backend/controllers/authController.js`, com rotas em `backend/routes/authRoutes.js`.
- Armazenamento de senhas com hash bcrypt.
- Autenticação com JWT e configuração por variáveis de ambiente.
- Verificação de autenticação em `backend/middlewares/autenticacao.js`.
- Controle de permissões em `backend/middlewares/autorizacao.js`.
- Perfis de comprador, vendedor e administrador.
- Recursos de proteção contra tentativas repetidas de login e limitação de requisições.
- Interface de cadastro e login no frontend.

### Verificação da entrega

Antes da apresentação, conferir:

1. Criação do banco conforme as instruções do README.
2. Existência das 21 tabelas e de seus relacionamentos.
3. Cadastro de usuário com persistência no MySQL e senha armazenada como hash.
4. Login com credenciais válidas e recusa de credenciais inválidas.
5. Recusa de acesso a rotas protegidas sem autenticação.
6. Recusa de acesso a recursos administrativos por uma conta de comprador.
7. Correspondência entre a documentação do banco e a estrutura atual.

Esta lista descreve verificações a realizar; não representa um registro de testes já aprovados.

## Revisão atual — Ofertas com MySQL

O fluxo original de carrinho e preço fixo foi substituído pelo modelo de ofertas descrito no README atual.

A versão atual contém recursos para cadastro de produtos, envio e acompanhamento de ofertas, aceitação de propostas, reserva de estoque e acompanhamento de pedidos, com integração entre frontend, API Express e MySQL.

Esses recursos contextualizam a evolução do projeto. Sua presença não altera o foco planejado da entrega 2: banco de dados, cadastro, login, autenticação e controle de acesso.

O planejamento histórico está preservado em `docs/README-original.md`. As instruções atuais de instalação e execução estão no README principal.

## Testes e limitações

- A suíte de integração está em `backend/tests/integracao.test.js`.
- A execução local utiliza `npm test` e exige o ambiente MySQL configurado.
- O comando prepara um banco de testes; consulte a seção “9. Testes em banco separado” do README antes de executar.
- Resultados de aprovação devem ser registrados somente após a execução dos testes na versão entregue.
- Pagamentos e entregas são simulados.
- Recursos auxiliares sem interface completa estão identificados na seção “11. Escopo e créditos” do README.

## Registro no GitHub

As atualizações devem permanecer no mesmo repositório, com commits que descrevam as alterações realizadas.

O envio pode ser feito pela interface do GitHub ou pelo Git local. Cada commit deve reunir alterações relacionadas e utilizar uma mensagem específica.

Arquivos `.env`, dependências instaladas e credenciais privadas não devem ser enviados. O arquivo `backend/.env.example` deve permanecer disponível como modelo de configuração.
