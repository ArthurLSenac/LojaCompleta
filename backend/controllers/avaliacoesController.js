// Avaliações com "compra verificada": só avalia quem comprou e recebeu o produto.
const pool = require('../database/conexao');
const { transacao } = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { registrarAuditoria } = require('../services/auditoria');

/** Mostra só o primeiro nome e a inicial do sobrenome (privacidade). */
function nomePublico(nome) {
    const partes = String(nome).trim().split(/\s+/);
    return partes.length > 1 ? `${partes[0]} ${partes[partes.length - 1][0]}.` : partes[0];
}

/** Recalcula média e total do produto (só avaliações visíveis contam). */
async function recalcular(conexao, produtoId) {
    await conexao.execute(
        `UPDATE produtos SET
            avaliacao_media = COALESCE((SELECT ROUND(AVG(a.nota), 2) FROM avaliacoes a WHERE a.produto_id = ? AND a.visivel = 1), 0),
            total_avaliacoes = (SELECT COUNT(*) FROM avaliacoes a WHERE a.produto_id = ? AND a.visivel = 1)
          WHERE id = ?`, [produtoId, produtoId, produtoId]);
}

function validar(corpo) {
    v.objeto(corpo);
    return {
        nota: v.inteiro(corpo.nota, 'a nota', { min: 1, max: 5, campo: 'nota' }),
        titulo: v.texto(corpo.titulo, 'o título', { min: 3, max: 80, campo: 'titulo' }),
        comentario: v.texto(corpo.comentario, 'o comentário', { min: 10, max: 1000, multilinha: true, campo: 'comentario' })
    };
}

// GET /api/produtos/:id/avaliacoes
async function listarDoProduto(req, res) {
    const produtoId = v.id(req.params.id, 'o produto');
    const { pagina, limite, deslocamento } = v.paginacao(req.query, { limitePadrao: 6, limiteMaximo: 30 });
    const ordens = { recentes: 'a.criado_em DESC', melhores: 'a.nota DESC, a.criado_em DESC', piores: 'a.nota ASC, a.criado_em DESC' };
    const ordem = ordens[req.query.ordem] || ordens.recentes;
    const filtroNota = req.query.nota ? v.inteiro(req.query.nota, 'a nota', { min: 1, max: 5 }) : null;
    const parametros = filtroNota ? [produtoId, filtroNota] : [produtoId];
    const [linhas] = await pool.execute(
        `SELECT a.id, a.nota, a.titulo, a.comentario, a.criado_em, a.atualizado_em, u.nome
           FROM avaliacoes a JOIN usuarios u ON u.id = a.usuario_id
          WHERE a.produto_id = ? AND a.visivel = 1 ${filtroNota ? 'AND a.nota = ?' : ''}
          ORDER BY ${ordem} LIMIT ${limite} OFFSET ${deslocamento}`, parametros);
    const [[{ total }]] = await pool.execute(
        `SELECT COUNT(*) AS total FROM avaliacoes a WHERE a.produto_id = ? AND a.visivel = 1 ${filtroNota ? 'AND a.nota = ?' : ''}`, parametros);
    res.json({
        itens: linhas.map((a) => ({ id: a.id, nota: a.nota, titulo: a.titulo, comentario: a.comentario, criado_em: a.criado_em, editada: a.atualizado_em > a.criado_em, autor: nomePublico(a.nome), compra_verificada: true })),
        total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite))
    });
}

// POST /api/avaliacoes (comprador)
async function criar(req, res) {
    const produtoId = v.id(req.body.produto_id, 'o produto');
    const dados = validar(req.body);
    const id = await transacao(async (conexao) => {
        const [produtos] = await conexao.execute('SELECT id, vendedor_id FROM produtos WHERE id = ? FOR UPDATE', [produtoId]);
        if (!produtos.length) throw erros.naoEncontrado('Produto não encontrado.');
        const [compra] = await conexao.execute(
            `SELECT 1 FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id
              WHERE o.comprador_id = ? AND i.produto_id = ? AND o.status = 'entregue' LIMIT 1`, [req.usuario.id, produtoId]);
        if (!compra.length) throw erros.proibido('Você pode avaliar este produto depois de recebê-lo.');
        try {
            const [resultado] = await conexao.execute(
                'INSERT INTO avaliacoes (produto_id, usuario_id, nota, titulo, comentario) VALUES (?, ?, ?, ?, ?)',
                [produtoId, req.usuario.id, dados.nota, dados.titulo, dados.comentario]);
            await recalcular(conexao, produtoId);
            return resultado.insertId;
        } catch (erro) {
            if (erro.code === 'ER_DUP_ENTRY') throw erros.conflito('Você já avaliou este produto. Você pode editar a sua avaliação.');
            throw erro;
        }
    });
    await registrarAuditoria({ req, acao: 'avaliacao_criada', entidade: 'avaliacoes', entidadeId: id, detalhes: { produto_id: produtoId, nota: dados.nota } });
    res.status(201).json({ mensagem: 'Obrigado! Sua avaliação ajuda outras pessoas a escolher.', id });
}

// PUT /api/avaliacoes/:id (autor)
async function atualizar(req, res) {
    const id = v.id(req.params.id, 'a avaliação');
    const dados = validar(req.body);
    await transacao(async (conexao) => {
        const [linhas] = await conexao.execute('SELECT id, produto_id, usuario_id FROM avaliacoes WHERE id = ? FOR UPDATE', [id]);
        const avaliacao = linhas[0];
        if (!avaliacao) throw erros.naoEncontrado('Avaliação não encontrada.');
        if (avaliacao.usuario_id !== req.usuario.id) throw erros.proibido('Você só pode editar as suas avaliações.');
        await conexao.execute('UPDATE avaliacoes SET nota = ?, titulo = ?, comentario = ? WHERE id = ?', [dados.nota, dados.titulo, dados.comentario, id]);
        await recalcular(conexao, avaliacao.produto_id);
    });
    res.json({ mensagem: 'Avaliação atualizada.' });
}

// DELETE /api/avaliacoes/:id (autor ou administração)
async function excluir(req, res) {
    const id = v.id(req.params.id, 'a avaliação');
    await transacao(async (conexao) => {
        const [linhas] = await conexao.execute('SELECT id, produto_id, usuario_id FROM avaliacoes WHERE id = ? FOR UPDATE', [id]);
        const avaliacao = linhas[0];
        if (!avaliacao) throw erros.naoEncontrado('Avaliação não encontrada.');
        if (req.usuario.nivel !== 'admin' && avaliacao.usuario_id !== req.usuario.id) throw erros.proibido('Você só pode excluir as suas avaliações.');
        await conexao.execute('DELETE FROM avaliacoes WHERE id = ?', [id]);
        await recalcular(conexao, avaliacao.produto_id);
        await registrarAuditoria({ executor: conexao, req, acao: 'avaliacao_excluida', entidade: 'avaliacoes', entidadeId: id });
    });
    res.json({ mensagem: 'Avaliação excluída.' });
}

// GET /api/avaliacoes (admin) — moderação
async function gerenciar(req, res) {
    const { pagina, limite, deslocamento } = v.paginacao(req.query, { limitePadrao: 20, limiteMaximo: 100 });
    const condicoes = ['1 = 1'];
    const parametros = [];
    if (req.query.visivel === '0' || req.query.visivel === '1') { condicoes.push('a.visivel = ?'); parametros.push(Number(req.query.visivel)); }
    if (req.query.nota) { condicoes.push('a.nota = ?'); parametros.push(v.inteiro(req.query.nota, 'a nota', { min: 1, max: 5 })); }
    const where = condicoes.join(' AND ');
    const [linhas] = await pool.execute(
        `SELECT a.*, u.nome AS autor_nome, u.email AS autor_email, p.nome AS produto_nome, p.imagem AS produto_imagem, l.nome AS loja_nome
           FROM avaliacoes a JOIN usuarios u ON u.id = a.usuario_id JOIN produtos p ON p.id = a.produto_id
           JOIN lojas l ON l.usuario_id = p.vendedor_id
          WHERE ${where} ORDER BY a.criado_em DESC LIMIT ${limite} OFFSET ${deslocamento}`, parametros);
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM avaliacoes a WHERE ${where}`, parametros);
    res.json({ itens: linhas.map((a) => ({ ...a, visivel: Boolean(a.visivel) })), total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)) });
}

// PUT /api/avaliacoes/:id/visibilidade (admin)
async function alterarVisibilidade(req, res) {
    const id = v.id(req.params.id, 'a avaliação');
    const visivel = v.booleano(req.body.visivel, 'a visibilidade');
    await transacao(async (conexao) => {
        const [linhas] = await conexao.execute('SELECT produto_id FROM avaliacoes WHERE id = ? FOR UPDATE', [id]);
        if (!linhas.length) throw erros.naoEncontrado('Avaliação não encontrada.');
        await conexao.execute('UPDATE avaliacoes SET visivel = ? WHERE id = ?', [visivel, id]);
        await recalcular(conexao, linhas[0].produto_id);
        await registrarAuditoria({ executor: conexao, req, acao: visivel ? 'avaliacao_publicada' : 'avaliacao_ocultada', entidade: 'avaliacoes', entidadeId: id });
    });
    res.json({ mensagem: visivel ? 'Avaliação publicada novamente.' : 'Avaliação ocultada. A média do produto foi recalculada.' });
}

// GET /api/avaliacoes/vendedor — avaliações dos produtos da loja.
async function daLoja(req, res) {
    const [linhas] = await pool.execute(
        `SELECT a.id, a.nota, a.titulo, a.comentario, a.criado_em, a.visivel, u.nome, p.id AS produto_id, p.nome AS produto_nome, p.imagem AS produto_imagem
           FROM avaliacoes a JOIN produtos p ON p.id = a.produto_id JOIN usuarios u ON u.id = a.usuario_id
          WHERE p.vendedor_id = ? ORDER BY a.criado_em DESC LIMIT 200`, [req.usuario.id]);
    res.json({ itens: linhas.map((a) => ({ ...a, nome: undefined, autor: nomePublico(a.nome), visivel: Boolean(a.visivel) })) });
}

module.exports = { listarDoProduto, criar, atualizar, excluir, gerenciar, alterarVisibilidade, daLoja, nomePublico, recalcular };
