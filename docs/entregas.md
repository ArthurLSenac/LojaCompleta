# Registro das entregas

## Entrega 1 — Problema e estrutura inicial

- Definição do problema, do público afetado e da justificativa (README, seções 1 e 2).
- Funcionalidades previstas, perfis de usuário e fluxo básico (README, seções 3 a 5).
- Estrutura inicial com `backend/`, `frontend/`, `sql/`, `docs/`, `README.md` e `.gitignore`.
- Back-end planejado em `routes/`, `controllers/`, `middlewares/`, `services/`, `database/`, `utils/` e `config/`.
- Identidade visual: logotipo, ícone e fontes da marca em `frontend/assets/`.

## Entrega 2 — Banco de dados e autenticação

- Modelo relacional com 19 tabelas, chaves primárias e estrangeiras, `UNIQUE` e `CHECK` (`sql/01_estrutura.sql`).
- Dados de demonstração coerentes: totais de pedidos calculados com as mesmas regras da API (`sql/02_dados_demo.sql`).
- Script `npm run db:criar` para montar o banco sem abrir o Workbench.
- Cadastro e login integrados ao banco, senhas com bcrypt e política de senha forte.
- JWT com emissor, público, expiração e versão; middlewares `autenticar`, `autenticarOpcional` e `autorizar(...niveis)`.
- Bloqueio temporário após 5 senhas erradas, limite de requisições por IP, cabeçalhos de segurança (helmet/CSP) e auditoria.
- Front-end: base visual (cores, tipografia, componentes), páginas de login e cadastro e uma área protegida de teste.

## Revisão atual — Ofertas com MySQL

O fluxo de carrinho e preço fixo foi substituído pelo modelo de ofertas do README atual. A integração frontend/API é executada pelo Express e usa as 21 tabelas relacionais MySQL. Inclui CRUD de produtos, histórico de ofertas, aceitação transacional, reserva, pedidos, perfis, testes reais e roteiro de apresentação. Funcionalidades planejadas sem tela completa estão identificadas no README; não são declaradas concluídas por esta revisão.
