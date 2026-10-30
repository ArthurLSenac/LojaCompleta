// Pedidos: checkout, acompanhamento e mudanças de status.
// As regras ficam em services/pedidos.js; aqui ficam permissões e respostas.
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { escaparLike } = require('../utils/texto');
const servico = require('../services/pedidos');
const { obterValores } = require('../services/configuracoes');
const { centavos, decimal } = require('../utils/dinheiro');
const { calcularFrete } = require('../services/frete');

// POST /api/pedidos (comprador)
async function criar(req, res) {
    const pedido = await servico.criarPedido({ usuario: req.usuario, corpo: req.body, req });
    res.status(201).json({ mensagem: pedido.status === 'pago' ? 'Pedido confirmado e pagamento aprovado!' : 'Pedido criado! Agora é só concluir o pagamento.', pedido });
}

// POST /api/pedidos/simular — prévia do checkout sem gravar nada (mesmas regras, sem travas).
async function simular(req, res) {
    const config = await obterValores();
    const enderecoId = v.id(req.body.endereco_id, 'o endereço');
    const [enderecos] = await pool.execute('SELECT cep FROM enderecos WHERE id = ? AND usuario_id = ?', [enderecoId, req.usuario.id]);
    if (!enderecos.length) throw erros.naoEncontrado('Endereço não encontrado.');
    const itens = req.body.itens;
    if (!Array.isArray(itens) || !itens.length || itens.length > 30) throw erros.requisicao('Envie os itens da sacola.');
    const conexao = await pool.getConnection();
    try {
        const conferidos = await servico.conferirProdutos(conexao, itens.map((i) => ({ produto_id: v.id(i && i.produto_id, 'o produto'), quantidade: v.inteiro(i && i.quantidade, 'a quantidade', { min: 1, max: 10 }) })));
        const forma = v.opcao(req.body.forma_pagamento || 'pix', 'a forma de pagamento', ['pix', 'cartao', 'boleto']);
        const modalidade = v.opcao(req.body.frete_modalidade || 'economica', 'a entrega', ['economica', 'expressa']);
        const cupom = v.texto(req.body.cupom, 'o cupom', { opcional: true, max: 30 });
        const valores = await servico.calcularValores(conexao, { conferidos, cupomCodigo: cupom, usuarioId: req.usuario.id, cep: enderecos[0].cep, modalidade, formaPagamento: forma, config, bloquearCupom: false });
        const opcoesFrete = calcularFrete({
            cep: enderecos[0].cep, quantidadeItens: conferidos.reduce((s, i) => s + i.quantidade, 0),
            valorProdutosCentavos: valores.subtotal - valores.descontoCupom, todosFreteGratis: conferidos.every((i) => i.produto.frete_gratis),
            freteGratisMinimoCentavos: centavos(config.frete_gratis_minimo)
        }).opcoes.map((o) => ({ ...o, valor: decimal(o.valor) }));
        res.json({
            subtotal: decimal(valores.subtotal), desconto_cupom: decimal(valores.descontoCupom), desconto_pix: decimal(valores.descontoPix),
            frete: decimal(valores.frete.valor), total: decimal(valores.total), prazo_dias: valores.frete.prazo_dias, regiao: valores.regiao,
            opcoes_frete: opcoesFrete, parcelas_maximas: servico.parcelasMaximas(valores.total, config),
            cupom: valores.cupom ? { codigo: valores.cupom.codigo, descricao: valores.cupom.descricao } : null
        });
    } finally {
        conexao.release();
    }
}

async function carregarItens(pedidoIds, vendedorId = null) {
    if (!pedidoIds.length) return {};
    const [itens] = await pool.query(
        `SELECT i.pedido_id, i.produto_id, i.vendedor_id, i.produto_nome, i.produto_imagem, i.quantidade, i.preco_unitario, i.subtotal,
                l.nome AS loja_nome, l.slug AS loja_slug
           FROM pedido_itens i LEFT JOIN lojas l ON l.usuario_id = i.vendedor_id
          WHERE i.pedido_id IN (?) ${vendedorId ? 'AND i.vendedor_id = ?' : ''} ORDER BY i.id`,
        vendedorId ? [pedidoIds, vendedorId] : [pedidoIds]);
    const porPedido = {};
    for (const item of itens) (porPedido[item.pedido_id] ||= []).push(item);
    return porPedido;
}

// GET /api/pedidos/meus
async function meus(req, res) {
    const [pedidos] = await pool.execute(
        `SELECT id, codigo, status, forma_pagamento, parcelas, total, frete_modalidade, prazo_dias, codigo_rastreio, criado_em, atualizado_em
           FROM pedidos WHERE comprador_id = ? ORDER BY id DESC`, [req.usuario.id]);
    const itens = await carregarItens(pedidos.map((p) => p.id));
    res.json({ pedidos: pedidos.map((p) => ({ ...p, itens: itens[p.id] || [] })) });
}

// GET /api/pedidos/:id — comprador dono, administração ou vendedor com itens no pedido.
async function detalhar(req, res) {
    const id = v.id(req.params.id, 'o pedido');
    const [linhas] = await pool.execute(
        `SELECT o.*, u.nome AS comprador_nome, u.email AS comprador_email, c.codigo AS cupom_codigo
           FROM pedidos o JOIN usuarios u ON u.id = o.comprador_id LEFT JOIN cupons c ON c.id = o.cupom_id
          WHERE o.id = ?`, [id]);
    const pedido = linhas[0];
    if (!pedido) throw erros.naoEncontrado('Pedido não encontrado.');
    const usuario = req.usuario;
    let itens;
    let visao = 'completa';
    if (usuario.nivel === 'admin' || pedido.comprador_id === usuario.id) {
        itens = (await carregarItens([id]))[id] || [];
    } else if (usuario.nivel === 'vendedor') {
        itens = (await carregarItens([id], usuario.id))[id] || [];
        if (!itens.length) throw erros.naoEncontrado('Pedido não encontrado.');
        visao = 'vendedor';
    } else {
        throw erros.proibido('Você só pode ver os seus pedidos.');
    }
    const [historico] = await pool.execute(
        `SELECT h.status, h.observacao, h.criado_em, u.nivel AS autor_nivel
           FROM pedido_historico h LEFT JOIN usuarios u ON u.id = h.usuario_id WHERE h.pedido_id = ? ORDER BY h.criado_em, h.id`, [id]);
    const [donos] = await pool.execute('SELECT COUNT(DISTINCT vendedor_id) AS lojas FROM pedido_itens WHERE pedido_id = ?', [id]);
    const resposta = { ...pedido, itens, historico, visao, lojas_no_pedido: donos[0].lojas };
    if (visao === 'vendedor') {
        // O vendedor vê só os próprios itens: sem totais, cupons ou dados de pagamento de outras lojas.
        for (const campo of ['subtotal', 'desconto_cupom', 'desconto_pix', 'frete', 'total', 'cupom_id', 'cupom_codigo', 'comprador_email']) delete resposta[campo];
        resposta.subtotal_loja = decimal(itens.reduce((soma, item) => soma + centavos(item.subtotal), 0));
    }
    res.json({ pedido: resposta });
}

// POST /api/pedidos/:id/cancelar
async function cancelar(req, res) {
    const id = v.id(req.params.id, 'o pedido');
    const resultado = await servico.mudarStatus({ pedidoId: id, novoStatus: 'cancelado', usuario: req.usuario, observacao: req.body.motivo, req });
    res.json({ mensagem: 'Pedido cancelado. O estoque foi devolvido.', ...resultado });
}

// POST /api/pedidos/:id/pagar — simulação de pagamento para Pix e boleto.
async function pagar(req, res) {
    const id = v.id(req.params.id, 'o pedido');
    const resultado = await servico.mudarStatus({ pedidoId: id, novoStatus: 'pago', usuario: req.usuario, req });
    res.json({ mensagem: 'Pagamento confirmado! A loja já foi avisada.', ...resultado });
}

// PUT /api/pedidos/:id/status (admin ou vendedor de pedido exclusivo da loja)
async function alterarStatus(req, res) {
    const id = v.id(req.params.id, 'o pedido');
    const resultado = await servico.mudarStatus({
        pedidoId: id, novoStatus: req.body.status, usuario: req.usuario,
        codigoRastreio: req.body.codigo_rastreio, observacao: req.body.observacao, req
    });
    res.json({ mensagem: `Status atualizado para "${servico.ROTULOS[resultado.status]}".`, ...resultado });
}

// GET /api/pedidos (admin)
async function listar(req, res) {
    const { pagina, limite, deslocamento } = v.paginacao(req.query, { limitePadrao: 20, limiteMaximo: 200 });
    const condicoes = ['1 = 1'];
    const parametros = [];
    if (req.query.status) { condicoes.push('o.status = ?'); parametros.push(v.opcao(req.query.status, 'o status', servico.STATUS)); }
    if (req.query.forma) { condicoes.push('o.forma_pagamento = ?'); parametros.push(v.opcao(req.query.forma, 'a forma de pagamento', ['pix', 'cartao', 'boleto'])); }
    if (req.query.q) {
        const padrao = '%' + escaparLike(v.texto(req.query.q, 'a busca', { max: 80 })) + '%';
        condicoes.push('(o.codigo LIKE ? OR u.nome LIKE ? OR u.email LIKE ?)');
        parametros.push(padrao, padrao, padrao);
    }
    if (req.query.de) { condicoes.push('o.criado_em >= ?'); parametros.push(v.dataHora(req.query.de, 'a data inicial')); }
    if (req.query.ate) { condicoes.push('o.criado_em <= ?'); parametros.push(v.dataHora(req.query.ate, 'a data final')); }
    const where = condicoes.join(' AND ');
    const [pedidos] = await pool.execute(
        `SELECT o.id, o.codigo, o.status, o.forma_pagamento, o.parcelas, o.total, o.frete, o.desconto_cupom, o.desconto_pix,
                o.codigo_rastreio, o.criado_em, o.atualizado_em, o.entrega_cidade, o.entrega_uf,
                u.nome AS comprador_nome, u.email AS comprador_email,
                (SELECT COUNT(*) FROM pedido_itens i WHERE i.pedido_id = o.id) AS total_itens,
                (SELECT COUNT(DISTINCT i.vendedor_id) FROM pedido_itens i WHERE i.pedido_id = o.id) AS total_lojas
           FROM pedidos o JOIN usuarios u ON u.id = o.comprador_id
          WHERE ${where} ORDER BY o.id DESC LIMIT ${limite} OFFSET ${deslocamento}`, parametros);
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM pedidos o JOIN usuarios u ON u.id = o.comprador_id WHERE ${where}`, parametros);
    const [porStatus] = await pool.execute('SELECT status, COUNT(*) AS total FROM pedidos GROUP BY status');
    res.json({
        itens: pedidos, total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)),
        por_status: Object.fromEntries(porStatus.map((s) => [s.status, s.total]))
    });
}

// GET /api/pedidos/vendedor — pedidos com itens da loja de quem está logado.
async function daLoja(req, res) {
    const condicoes = ['i.vendedor_id = ?'];
    const parametros = [req.usuario.id];
    if (req.query.status) { condicoes.push('o.status = ?'); parametros.push(v.opcao(req.query.status, 'o status', servico.STATUS)); }
    const [pedidos] = await pool.execute(
        `SELECT o.id, o.codigo, o.status, o.forma_pagamento, o.criado_em, o.atualizado_em, o.codigo_rastreio, o.frete_modalidade, o.prazo_dias,
                o.entrega_cidade, o.entrega_uf, u.nome AS comprador_nome,
                SUM(i.quantidade) AS unidades, SUM(i.subtotal) AS subtotal_loja,
                (SELECT COUNT(DISTINCT x.vendedor_id) FROM pedido_itens x WHERE x.pedido_id = o.id) AS total_lojas
           FROM pedidos o JOIN pedido_itens i ON i.pedido_id = o.id JOIN usuarios u ON u.id = o.comprador_id
          WHERE ${condicoes.join(' AND ')}
          GROUP BY o.id, o.codigo, o.status, o.forma_pagamento, o.criado_em, o.atualizado_em, o.codigo_rastreio, o.frete_modalidade, o.prazo_dias, o.entrega_cidade, o.entrega_uf, u.nome
          ORDER BY o.id DESC LIMIT 200`, parametros);
    const itens = await carregarItens(pedidos.map((p) => p.id), req.usuario.id);
    res.json({
        pedidos: pedidos.map((p) => ({ ...p, unidades: Number(p.unidades), exclusivo: p.total_lojas === 1, itens: itens[p.id] || [] }))
    });
}

module.exports = { criar, simular, meus, detalhar, cancelar, pagar, alterarStatus, listar, daLoja };
