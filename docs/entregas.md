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

## Entrega 3 — CRUD de produtos

O vendedor cadastra, consulta, edita e desativa seus produtos. O administrador gerencia o catálogo de todas as lojas. A interface em `frontend/js/ambar.js` envia as operações com Fetch. A rota em `backend/routes/interfaceRoutes.js` verifica o perfil e a propriedade do produto. A desativação mantém o cadastro e o histórico de ofertas no banco.

## Entrega 4 — Projeto completo e apresentação

O fluxo final reúne produto, proposta do comprador, aceite pelo vendedor, reserva de estoque e pedido. As transações estão em `backend/services/ofertas.js`. O registro do preço fixo utilizado no planejamento anterior está em `docs/README-original.md`.

A revisão de permissões restringe a curadoria ao administrador no formulário e na API. Ao editar um produto de sua loja, o vendedor preserva o destaque atual, inclusive quando um cliente antigo envia esse campo. O teste de regressão está em `backend/tests/integracao.test.js`.

Consulte a seção 10 do [README](../README.md) para reproduzir o CRUD e a negociação com as contas demonstrativas. O [roteiro de apresentação](APRESENTACAO.md) cobre os quatro indicadores da etapa final.
