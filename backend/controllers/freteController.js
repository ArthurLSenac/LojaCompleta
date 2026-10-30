// Cálculo de frete público (página do produto e sacola). O checkout recalcula tudo.
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { centavos, decimal } = require('../utils/dinheiro');
const { calcularFrete } = require('../services/frete');
const { obterValores } = require('../services/configuracoes');
const { FROM_PRODUTO, VISIVEL } = require('../utils/produtos');

// POST /api/frete/calcular  { cep, itens: [{ produto_id, quantidade }] }
async function calcular(req, res) {
    const cep = v.cep(req.body.cep);
    const itens = req.body.itens;
    if (!Array.isArray(itens) || itens.length === 0 || itens.length > 30) throw erros.requisicao('Envie os produtos para calcular o frete.');
    const config = await obterValores();
    let subtotal = 0;
    let quantidade = 0;
    let todosGratis = true;
    for (const item of itens) {
        const produtoId = v.id(item && item.produto_id, 'o produto');
        const qtd = v.inteiro(item && item.quantidade, 'a quantidade', { min: 1, max: 10 });
        const [linhas] = await pool.execute(`SELECT p.preco, p.frete_gratis ${FROM_PRODUTO} WHERE p.id = ? AND ${VISIVEL}`, [produtoId]);
        if (!linhas.length) continue;
        subtotal += centavos(linhas[0].preco) * qtd;
        quantidade += qtd;
        todosGratis = todosGratis && Boolean(linhas[0].frete_gratis);
    }
    if (!quantidade) throw erros.naoEncontrado('Nenhum produto disponível para calcular o frete.');
    const resultado = calcularFrete({ cep, quantidadeItens: quantidade, valorProdutosCentavos: subtotal, todosFreteGratis: todosGratis, freteGratisMinimoCentavos: centavos(config.frete_gratis_minimo) });
    res.json({
        cep: resultado.cep,
        regiao: resultado.regiao,
        opcoes: resultado.opcoes.map((o) => ({ ...o, valor: decimal(o.valor) }))
    });
}

module.exports = { calcular };
