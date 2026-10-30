// Perguntas e respostas nos produtos: clientes perguntam, a loja responde.
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { registrarAuditoria } = require('../services/auditoria');
const { obterValores } = require('../services/configuracoes');
const { nomePublico } = require('./avaliacoesController');

// GET /api/produtos/:id/perguntas
async function listarDoProduto(req, res) {
    const produtoId = v.id(req.params.id, 'o produto');
    const [linhas] = await pool.execute(
        `SELECT q.id, q.pergunta, q.resposta, q.criado_em, q.respondido_em, u.nome
           FROM perguntas q JOIN usuarios u ON u.id = q.usuario_id
          WHERE q.produto_id = ? ORDER BY (q.resposta IS NULL), q.criado_em DESC LIMIT 50`, [produtoId]);
    res.json({ itens: linhas.map((q) => ({ id: q.id, pergunta: q.pergunta, resposta: q.resposta, criado_em: q.criado_em, respondido_em: q.respondido_em, autor: nomePublico(q.nome) })) });
}

// POST /api/perguntas
async function criar(req, res) {
    const produtoId = v.id(req.body.produto_id, 'o produto');
    const pergunta = v.texto(req.body.pergunta, 'a pergunta', { min: 10, max: 500, multilinha: true, campo: 'pergunta' });
    const [produtos] = await pool.execute('SELECT id, vendedor_id FROM produtos WHERE id = ? AND ativo = 1', [produtoId]);
    if (!produtos.length) throw erros.naoEncontrado('Produto não encontrado.');
    if (produtos[0].vendedor_id === req.usuario.id) throw erros.conflito('Você não pode perguntar no seu próprio produto.');
    const config = await obterValores();
    const [[{ abertas }]] = await pool.execute(
        'SELECT COUNT(*) AS abertas FROM perguntas WHERE produto_id = ? AND usuario_id = ? AND resposta IS NULL', [produtoId, req.usuario.id]);
    if (abertas >= config.limite_perguntas_abertas) {
        throw erros.conflito('Você já tem perguntas aguardando resposta neste produto. Aguarde a loja responder.');
    }
    const [resultado] = await pool.execute('INSERT INTO perguntas (produto_id, usuario_id, pergunta) VALUES (?, ?, ?)', [produtoId, req.usuario.id, pergunta]);
    res.status(201).json({ mensagem: 'Pergunta enviada. A loja costuma responder em poucas horas.', id: resultado.insertId });
}

// PUT /api/perguntas/:id/resposta (vendedor dono do produto ou administração)
async function responder(req, res) {
    const id = v.id(req.params.id, 'a pergunta');
    const resposta = v.texto(req.body.resposta, 'a resposta', { min: 2, max: 1000, multilinha: true, campo: 'resposta' });
    const [linhas] = await pool.execute(
        'SELECT q.id, p.vendedor_id FROM perguntas q JOIN produtos p ON p.id = q.produto_id WHERE q.id = ?', [id]);
    const pergunta = linhas[0];
    if (!pergunta) throw erros.naoEncontrado('Pergunta não encontrada.');
    if (req.usuario.nivel !== 'admin' && pergunta.vendedor_id !== req.usuario.id) throw erros.proibido('Só a loja do produto pode responder.');
    await pool.execute('UPDATE perguntas SET resposta = ?, respondido_por = ?, respondido_em = NOW() WHERE id = ?', [resposta, req.usuario.id, id]);
    res.json({ mensagem: 'Resposta publicada.' });
}

// DELETE /api/perguntas/:id (administração, ou o autor enquanto não houver resposta)
async function excluir(req, res) {
    const id = v.id(req.params.id, 'a pergunta');
    const [linhas] = await pool.execute('SELECT id, usuario_id, resposta FROM perguntas WHERE id = ?', [id]);
    const pergunta = linhas[0];
    if (!pergunta) throw erros.naoEncontrado('Pergunta não encontrada.');
    const autor = pergunta.usuario_id === req.usuario.id && !pergunta.resposta;
    if (req.usuario.nivel !== 'admin' && !autor) throw erros.proibido('Você não pode remover esta pergunta.');
    await pool.execute('DELETE FROM perguntas WHERE id = ?', [id]);
    if (req.usuario.nivel === 'admin') await registrarAuditoria({ req, acao: 'pergunta_removida', entidade: 'perguntas', entidadeId: id });
    res.json({ mensagem: 'Pergunta removida.' });
}

// GET /api/perguntas/vendedor?status=pendentes|respondidas
async function daLoja(req, res) {
    const filtro = req.query.status === 'respondidas' ? 'AND q.resposta IS NOT NULL' : req.query.status === 'pendentes' ? 'AND q.resposta IS NULL' : '';
    const [linhas] = await pool.execute(
        `SELECT q.id, q.pergunta, q.resposta, q.criado_em, q.respondido_em, u.nome, p.id AS produto_id, p.nome AS produto_nome, p.imagem AS produto_imagem
           FROM perguntas q JOIN produtos p ON p.id = q.produto_id JOIN usuarios u ON u.id = q.usuario_id
          WHERE p.vendedor_id = ? ${filtro} ORDER BY (q.resposta IS NULL) DESC, q.criado_em DESC LIMIT 200`, [req.usuario.id]);
    res.json({ itens: linhas.map((q) => ({ ...q, nome: undefined, autor: nomePublico(q.nome) })) });
}

// GET /api/perguntas (admin)
async function gerenciar(req, res) {
    const filtro = req.query.status === 'pendentes' ? 'WHERE q.resposta IS NULL' : req.query.status === 'respondidas' ? 'WHERE q.resposta IS NOT NULL' : '';
    const [linhas] = await pool.execute(
        `SELECT q.id, q.pergunta, q.resposta, q.criado_em, q.respondido_em, u.nome AS autor_nome, p.id AS produto_id, p.nome AS produto_nome, l.nome AS loja_nome
           FROM perguntas q JOIN produtos p ON p.id = q.produto_id JOIN usuarios u ON u.id = q.usuario_id JOIN lojas l ON l.usuario_id = p.vendedor_id
          ${filtro} ORDER BY q.criado_em DESC LIMIT 300`);
    res.json({ itens: linhas });
}

module.exports = { listarDoProduto, criar, responder, excluir, daLoja, gerenciar };
