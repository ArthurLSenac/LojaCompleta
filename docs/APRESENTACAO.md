# Roteiro de apresentação · Âmbar Ofertas com MySQL

1. Execute a instalação do README e abra localhost:3000. Mostre que produtos não têm preço fixo.
2. Entre como Vendedor e cadastre um produto sem preço, com descrição, estoque, categoria e foto opcional.
3. Entre como Comprador. Faça uma oferta de R$ 50 e melhore para R$ 60. A primeira deve ficar superada.
4. Mostre Minhas ofertas e o histórico do produto. No MySQL Workbench, mostre as tabelas produtos, rodadas_ofertas e lances.
5. Volte ao Vendedor e aceite a proposta de R$ 60. Mostre a reserva de uma unidade, o pedido e a linha em pedido_historico.
6. Como Comprador, abra a negociação e simule o pagamento. Não há cobrança real.
7. Como Vendedor, avance preparação, envio e entrega. Se houver estoque, abra nova rodada e mostre que a anterior continua no histórico.
8. Mostre o administrador, os indicadores e os registros de auditoria.
9. Execute npm test: banco separado com sufixo _test, Express real e transações MySQL. Explique a disputa concorrente da última unidade.
10. Mostre o layout responsivo e as animações com preferência de movimento reduzido.

Duração sugerida: 7–10 minutos. Use somente dados fictícios na apresentação.
