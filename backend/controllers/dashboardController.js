// Indicadores dos painéis. "Receita" considera pedidos pagos ou além (não conta
// pedidos aguardando pagamento nem cancelados).
const pool = require('../database/conexao');
const { obterValores } = require('../services/configuracoes');

const PAGOS = "('pago', 'em_separacao', 'enviado', 'entregue')";

/** Preenche os dias sem vendas para o gráfico não ter buracos. */
function serieCompleta(linhas, dias = 30) {
    const mapa = new Map(linhas.map((l) => [new Date(l.dia).toISOString().slice(0, 10), l]));
    const serie = [];
    const hoje = new Date();
    for (let i = dias - 1; i >= 0; i--) {
        const dia = new Date(Date.UTC(hoje.getUTCFullYear(), hoje.getUTCMonth(), hoje.getUTCDate() - i));
        const chave = dia.toISOString().slice(0, 10);
        const linha = mapa.get(chave);
        serie.push({ dia: chave, receita: linha ? Number(linha.receita) : 0, pedidos: linha ? Number(linha.pedidos) : 0 });
    }
    return serie;
}

const numeros = (objeto) => Object.fromEntries(Object.entries(objeto).map(([chave, valor]) => [chave, valor === null ? 0 : Number(valor)]));

// GET /api/dashboard/admin
async function admin(req, res) {
    const config = await obterValores();
    const [[receita]] = await pool.execute(
        `SELECT COALESCE(SUM(CASE WHEN criado_em >= NOW() - INTERVAL 30 DAY THEN total END), 0) AS receita_30d,
                COALESCE(SUM(CASE WHEN criado_em >= NOW() - INTERVAL 60 DAY AND criado_em < NOW() - INTERVAL 30 DAY THEN total END), 0) AS receita_anterior,
                COALESCE(SUM(criado_em >= NOW() - INTERVAL 30 DAY), 0) AS pedidos_30d,
                COALESCE(SUM(criado_em >= NOW() - INTERVAL 60 DAY AND criado_em < NOW() - INTERVAL 30 DAY), 0) AS pedidos_anterior
           FROM pedidos WHERE status IN ${PAGOS}`);
    const [[contagens]] = await pool.execute(
        `SELECT (SELECT COUNT(*) FROM usuarios WHERE nivel = 'comprador') AS clientes,
                (SELECT COUNT(*) FROM usuarios WHERE nivel = 'comprador' AND criado_em >= NOW() - INTERVAL 30 DAY) AS clientes_novos,
                (SELECT COUNT(*) FROM produtos p JOIN lojas l ON l.usuario_id = p.vendedor_id WHERE p.ativo = 1 AND l.ativa = 1) AS produtos_ativos,
                (SELECT COUNT(*) FROM produtos WHERE ativo = 1 AND estoque <= ?) AS estoque_baixo,
                (SELECT COUNT(*) FROM lojas WHERE ativa = 1) AS lojas_ativas,
                (SELECT COUNT(*) FROM solicitacoes_vendedor WHERE status = 'pendente') AS solicitacoes_pendentes,
                (SELECT COUNT(*) FROM perguntas WHERE resposta IS NULL) AS perguntas_pendentes,
                (SELECT COUNT(*) FROM pedidos WHERE status IN ('pago', 'em_separacao')) AS pedidos_para_enviar,
                (SELECT COUNT(*) FROM pedidos WHERE status = 'cancelado' AND criado_em >= NOW() - INTERVAL 30 DAY) AS cancelados_30d,
                (SELECT COUNT(*) FROM pedidos WHERE criado_em >= NOW() - INTERVAL 30 DAY) AS todos_30d,
                (SELECT ROUND(AVG(nota), 2) FROM avaliacoes WHERE visivel = 1) AS avaliacao_media,
                (SELECT COUNT(*) FROM newsletter) AS newsletter`, [config.estoque_baixo]);
    const [dias] = await pool.execute(
        `SELECT DATE(criado_em) AS dia, SUM(total) AS receita, COUNT(*) AS pedidos FROM pedidos
          WHERE status IN ${PAGOS} AND criado_em >= CURDATE() - INTERVAL 29 DAY GROUP BY DATE(criado_em) ORDER BY dia`);
    const [porCategoria] = await pool.execute(
        `SELECT c.nome, c.slug, SUM(i.subtotal) AS receita, SUM(i.quantidade) AS unidades
           FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id JOIN produtos p ON p.id = i.produto_id JOIN categorias c ON c.id = p.categoria_id
          WHERE o.status IN ${PAGOS} AND o.criado_em >= NOW() - INTERVAL 30 DAY GROUP BY c.id, c.nome, c.slug ORDER BY receita DESC`);
    const [porStatus] = await pool.execute(
        'SELECT status, COUNT(*) AS total FROM pedidos WHERE criado_em >= NOW() - INTERVAL 30 DAY GROUP BY status');
    const [formas] = await pool.execute(
        `SELECT forma_pagamento AS forma, COUNT(*) AS pedidos, SUM(total) AS receita FROM pedidos
          WHERE status IN ${PAGOS} AND criado_em >= NOW() - INTERVAL 30 DAY GROUP BY forma_pagamento ORDER BY receita DESC`);
    const [topProdutos] = await pool.execute(
        `SELECT i.produto_id AS id, MAX(i.produto_nome) AS nome, MAX(i.produto_imagem) AS imagem, SUM(i.quantidade) AS unidades, SUM(i.subtotal) AS receita
           FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id
          WHERE o.status IN ${PAGOS} AND o.criado_em >= NOW() - INTERVAL 30 DAY GROUP BY i.produto_id ORDER BY unidades DESC, receita DESC LIMIT 5`);
    const [topLojas] = await pool.execute(
        `SELECT l.nome, l.slug, l.cor, SUM(i.subtotal) AS receita, COUNT(DISTINCT i.pedido_id) AS pedidos
           FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id JOIN lojas l ON l.usuario_id = i.vendedor_id
          WHERE o.status IN ${PAGOS} AND o.criado_em >= NOW() - INTERVAL 30 DAY GROUP BY l.id, l.nome, l.slug, l.cor ORDER BY receita DESC LIMIT 5`);
    const [recentes] = await pool.execute(
        `SELECT o.id, o.codigo, o.status, o.total, o.forma_pagamento, o.criado_em, u.nome AS comprador_nome
           FROM pedidos o JOIN usuarios u ON u.id = o.comprador_id ORDER BY o.id DESC LIMIT 6`);

    const r = numeros(receita);
    const c = numeros(contagens);
    res.json({
        kpis: {
            receita_30d: r.receita_30d, receita_anterior: r.receita_anterior,
            pedidos_30d: r.pedidos_30d, pedidos_anterior: r.pedidos_anterior,
            ticket_medio: r.pedidos_30d ? r.receita_30d / r.pedidos_30d : 0,
            taxa_cancelamento: c.todos_30d ? c.cancelados_30d / c.todos_30d : 0,
            ...c
        },
        serie: serieCompleta(dias),
        por_categoria: porCategoria.map((x) => ({ ...x, receita: Number(x.receita), unidades: Number(x.unidades) })),
        por_status: Object.fromEntries(porStatus.map((s) => [s.status, s.total])),
        formas_pagamento: formas.map((f) => ({ ...f, receita: Number(f.receita) })),
        top_produtos: topProdutos.map((p) => ({ ...p, unidades: Number(p.unidades), receita: Number(p.receita) })),
        top_lojas: topLojas.map((l) => ({ ...l, receita: Number(l.receita) })),
        pedidos_recentes: recentes,
        estoque_baixo_limite: config.estoque_baixo
    });
}

// GET /api/dashboard/vendedor
async function vendedor(req, res) {
    const config = await obterValores();
    const id = req.usuario.id;
    const [[vendas]] = await pool.execute(
        `SELECT COALESCE(SUM(CASE WHEN o.criado_em >= NOW() - INTERVAL 30 DAY THEN i.subtotal END), 0) AS receita_30d,
                COALESCE(SUM(CASE WHEN o.criado_em >= NOW() - INTERVAL 60 DAY AND o.criado_em < NOW() - INTERVAL 30 DAY THEN i.subtotal END), 0) AS receita_anterior,
                COALESCE(SUM(CASE WHEN o.criado_em >= NOW() - INTERVAL 30 DAY THEN i.quantidade END), 0) AS unidades_30d,
                COUNT(DISTINCT CASE WHEN o.criado_em >= NOW() - INTERVAL 30 DAY THEN o.id END) AS pedidos_30d
           FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id
          WHERE i.vendedor_id = ? AND o.status IN ${PAGOS}`, [id]);
    const [[contagens]] = await pool.execute(
        `SELECT (SELECT COUNT(*) FROM produtos WHERE vendedor_id = ? AND ativo = 1) AS produtos_ativos,
                (SELECT COUNT(*) FROM produtos WHERE vendedor_id = ? AND ativo = 1 AND estoque <= ?) AS estoque_baixo,
                (SELECT COUNT(*) FROM perguntas q JOIN produtos p ON p.id = q.produto_id WHERE p.vendedor_id = ? AND q.resposta IS NULL) AS perguntas_pendentes,
                (SELECT COUNT(DISTINCT o.id) FROM pedidos o JOIN pedido_itens i ON i.pedido_id = o.id WHERE i.vendedor_id = ? AND o.status IN ('pago', 'em_separacao')) AS pedidos_para_enviar,
                (SELECT ROUND(AVG(a.nota), 2) FROM avaliacoes a JOIN produtos p ON p.id = a.produto_id WHERE p.vendedor_id = ? AND a.visivel = 1) AS avaliacao_media,
                (SELECT COUNT(*) FROM avaliacoes a JOIN produtos p ON p.id = a.produto_id WHERE p.vendedor_id = ? AND a.visivel = 1) AS total_avaliacoes`,
        [id, id, config.estoque_baixo, id, id, id, id]);
    const [dias] = await pool.execute(
        `SELECT DATE(o.criado_em) AS dia, SUM(i.subtotal) AS receita, COUNT(DISTINCT o.id) AS pedidos
           FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id
          WHERE i.vendedor_id = ? AND o.status IN ${PAGOS} AND o.criado_em >= CURDATE() - INTERVAL 29 DAY
          GROUP BY DATE(o.criado_em) ORDER BY dia`, [id]);
    const [topProdutos] = await pool.execute(
        `SELECT i.produto_id AS id, MAX(i.produto_nome) AS nome, MAX(i.produto_imagem) AS imagem, SUM(i.quantidade) AS unidades, SUM(i.subtotal) AS receita
           FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id
          WHERE i.vendedor_id = ? AND o.status IN ${PAGOS} GROUP BY i.produto_id ORDER BY unidades DESC LIMIT 5`, [id]);
    const [estoqueBaixo] = await pool.execute(
        'SELECT id, nome, imagem, estoque FROM produtos WHERE vendedor_id = ? AND ativo = 1 AND estoque <= ? ORDER BY estoque, nome LIMIT 8', [id, config.estoque_baixo]);
    const [ultimas] = await pool.execute(
        `SELECT o.id AS pedido_id, o.codigo, o.status, o.criado_em, i.produto_nome, i.quantidade, i.subtotal
           FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id WHERE i.vendedor_id = ? ORDER BY o.id DESC, i.id LIMIT 6`, [id]);
    const vv = numeros(vendas);
    res.json({
        kpis: { ...vv, ticket_medio: vv.pedidos_30d ? vv.receita_30d / vv.pedidos_30d : 0, ...numeros(contagens) },
        serie: serieCompleta(dias),
        top_produtos: topProdutos.map((p) => ({ ...p, unidades: Number(p.unidades), receita: Number(p.receita) })),
        estoque_baixo: estoqueBaixo,
        ultimas_vendas: ultimas,
        estoque_baixo_limite: config.estoque_baixo
    });
}

module.exports = { admin, vendedor };
