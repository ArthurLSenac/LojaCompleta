# Scripts do banco de dados — Âmbar Ofertas

O projeto utiliza MySQL 8 com InnoDB. A estrutura original possui 19 tabelas. A versão atual acrescenta `rodadas_ofertas` e `lances`, totalizando 21 tabelas.

## Arquivos e ordem de aplicação

| Ordem | Arquivo | Finalidade |
| --- | --- | --- |
| 1 | `01_estrutura.sql` | Apaga e recria o banco `ambar_marketplace`, com as 19 tabelas originais, chaves e restrições. |
| 2 | `02_dados_demo.sql` | Insere contas, lojas, produtos e demais dados de demonstração. |
| 3 | `03_ofertas.sql` | Cria rodadas e lances, adapta pedidos ao modelo de ofertas e deixa os preços dos produtos nulos. |

## Instalação nova

Na raiz do projeto, instale as dependências com `npm install`, copie `backend/.env.example` para `backend/.env` e configure a conexão MySQL e o segredo JWT, conforme o README principal.

Depois execute:

```bash
npm run db:criar
```

O comando aplica os três scripts em ordem e recusa sobrescrever um banco existente sem a opção explícita de recriação. Para iniciar a aplicação:

```bash
npm start
```

## Atualização de uma instalação antiga

Se o banco já possui as 19 tabelas do modelo original de preço fixo, faça backup, pare a aplicação e execute na raiz:

```bash
npm run db:migrar
```

A migração preserva pedidos históricos e acrescenta a estrutura de ofertas. Não execute novamente `01_estrutura.sql` para atualizar um banco com dados a preservar.

## Execução manual no MySQL

Os arquivos SQL utilizam o nome `ambar_marketplace`. Em uma instalação nova com dados demonstrativos, aplique os arquivos na ordem 01, 02 e 03. A migração 03 deve ser aplicada uma única vez sobre a estrutura original.

O arquivo `01_estrutura.sql` é destrutivo: apaga e recria o banco indicado. Confira o destino e preserve um backup antes de executá-lo sobre uma instalação existente.

## Modelo atual e documentação

- Produtos não possuem preço fixo: `preco` e `preco_original` permanecem nulos por CHECK.
- Compradores registram propostas em `lances`, vinculadas a `rodadas_ofertas`.
- O aceite de uma proposta utiliza transação na aplicação para reservar estoque e criar o pedido.
- Pedidos históricos permanecem sem oferta vinculada; pedidos do fluxo atual utilizam `oferta_id`.
- O diagrama e a descrição das 21 tabelas estão em `docs/banco-de-dados.md`, a partir da raiz do repositório.
- As instruções completas de configuração, execução e testes estão no `README.md` principal.
