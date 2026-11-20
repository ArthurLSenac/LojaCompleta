# Apresentação da entrega 4 · Âmbar Ofertas

**Duração sugerida de 7 a 10 minutos.** Prepare o banco demonstrativo conforme o README e abra a aplicação. Use sessões independentes para comprador, vendedor e administrador, ou faça logout antes de trocar de perfil.

| Tempo | Demonstração | O que explicar |
| --- | --- | --- |
| 1 min | Abra o catálogo e escolha um exemplo de pequeno lojista que recebe propostas por mensagens. | A loja reúne interessados e valores por produto. O vendedor decide qual proposta aceitar. |
| 2 min | Como vendedor, cadastre um produto ativo com estoque 1. Como administrador, destaque-o. Volte ao vendedor, edite a descrição e confirme o destaque na tela do administrador. | Visitantes consultam, compradores propõem valores, vendedores gerenciam a própria loja e o administrador cuida da vitrine. A API verifica o perfil e a propriedade. |
| 2 min | Como comprador, faça uma oferta de R$ 50 e melhore para R$ 60. Abra o histórico. | Cada oferta pertence a um comprador e a uma rodada. A primeira fica superada. O estoque ainda é 1. |
| 2 min | Como vendedor, aceite R$ 60. Mostre o pedido, o valor e o estoque em 0. Simule o pagamento como comprador e avance o pedido como vendedor. | O banco confirma a oferta aceita, a reserva e a criação do pedido em uma transação. Se uma etapa falhar, as alterações são desfeitas. |
| 1 min | Desative o item e procure-o na vitrine e no gerenciamento. | A exclusão lógica retira o item de circulação e preserva o histórico. |
| 1–2 min | Mostre o diagrama do banco e localize o código de uma ação demonstrada. | O formulário usa Fetch. O Express recebe a chamada, o middleware identifica o usuário pelo JWT e a rota aplica as permissões. O MySQL persiste os dados relacionados. |

### Arquivos para abrir durante a explicação

- `frontend/js/ambar.js` contém o formulário e as chamadas Fetch.
- `backend/middlewares/autenticacao.js` valida o JWT e carrega o usuário da sessão.
- `backend/routes/interfaceRoutes.js` implementa as rotas usadas pela tela de produtos.
- `backend/services/ofertas.js` implementa o aceite e a movimentação do estoque.
- `docs/banco-de-dados.md` apresenta o diagrama. No MySQL, acompanhe os registros de `produtos`, `rodadas_ofertas`, `lances`, `pedidos` e `pedido_historico`.

Antes de apresentar, execute `npm test` com MySQL 8 configurado. A suíte prepara um banco separado de teste. Use o resultado dessa execução para demonstrar as verificações de permissão e de concorrência.
