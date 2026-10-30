// Favoritos: relação N:N entre usuário e produto.
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { SELECT_PRODUTO, formatarProduto, visivel } = require('../utils/produtos');

// GET /api/favoritos
async function listar(req, res) {
    const [linhas] = await pool.execute(
        `${SELECT_PRODUTO} JOIN favoritos f ON f.produto_id = p.id WHERE f.usuario_id = ? ORDER BY f.criado_em DESC`, [req.usuario.id]);
    res.json({ itens: linhas.map((linha) => ({ ...formatarProduto(linha), disponivel: visivel(linha) })) });
}

// GET /api/favoritos/ids — leve, para marcar os corações na vitrine.
async function ids(req, res) {
    const [linhas] = await pool.execute('SELECT produto_id FROM favoritos WHERE usuario_id = ?', [req.usuario.id]);
    res.json({ ids: linhas.map((l) => l.produto_id) });
}

// POST /api/favoritos/:produtoId
async function adicionar(req, res) {
    const produtoId = v.id(req.params.produtoId, 'o produto');
    const [produtos] = await pool.execute('SELECT id FROM produtos WHERE id = ? AND ativo = 1', [produtoId]);
    if (!produtos.length) throw erros.naoEncontrado('Produto não encontrado.');
    // INSERT IGNORE: favoritar duas vezes não gera erro nem duplicidade (a chave primária é composta).
    await pool.execute('INSERT IGNORE INTO favoritos (usuario_id, produto_id) VALUES (?, ?)', [req.usuario.id, produtoId]);
    res.status(201).json({ mensagem: 'Salvo nos favoritos.' });
}

// DELETE /api/favoritos/:produtoId
async function remover(req, res) {
    const produtoId = v.id(req.params.produtoId, 'o produto');
    await pool.execute('DELETE FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [req.usuario.id, produtoId]);
    res.json({ mensagem: 'Removido dos favoritos.' });
}

module.exports = { listar, ids, adicionar, remover };
