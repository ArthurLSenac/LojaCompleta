// Lojas: vitrine pública de cada vendedor, edição pelo dono e suspensão pela administração.
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { registrarAuditoria } = require('../services/auditoria');

const ESTATISTICAS = `
    (SELECT COUNT(*) FROM produtos p JOIN categorias c ON c.id = p.categoria_id
      WHERE p.vendedor_id = l.usuario_id AND p.ativo = 1 AND c.ativa = 1) AS total_produtos,
    (SELECT ROUND(AVG(a.nota), 2) FROM avaliacoes a JOIN produtos p ON p.id = a.produto_id
      WHERE p.vendedor_id = l.usuario_id AND a.visivel = 1) AS avaliacao_media,
    (SELECT COUNT(*) FROM avaliacoes a JOIN produtos p ON p.id = a.produto_id
      WHERE p.vendedor_id = l.usuario_id AND a.visivel = 1) AS total_avaliacoes,
    (SELECT COALESCE(SUM(i.quantidade), 0) FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id
      WHERE i.vendedor_id = l.usuario_id AND o.status <> 'cancelado') AS total_vendas`;

async function vitrine(usuarioId) {
    const [fotos] = await pool.execute(
        'SELECT imagem FROM produtos WHERE vendedor_id = ? AND ativo = 1 ORDER BY destaque DESC, total_vendido DESC LIMIT 3', [usuarioId]);
    return fotos.map((f) => f.imagem);
}

function formatar(loja) {
    return {
        id: loja.id, nome: loja.nome, slug: loja.slug, descricao: loja.descricao, cidade: loja.cidade, uf: loja.uf, cor: loja.cor,
        ativa: Boolean(loja.ativa), criado_em: loja.criado_em,
        total_produtos: Number(loja.total_produtos), avaliacao_media: Number(loja.avaliacao_media || 0),
        total_avaliacoes: Number(loja.total_avaliacoes), total_vendas: Number(loja.total_vendas)
    };
}

// GET /api/lojas — lojas ativas, das mais vendidas para as demais.
async function listar(req, res) {
    const [lojas] = await pool.execute(
        `SELECT l.*, ${ESTATISTICAS} FROM lojas l JOIN usuarios u ON u.id = l.usuario_id
          WHERE l.ativa = 1 AND u.status = 'ativo' ORDER BY total_vendas DESC, l.nome`);
    const resultado = [];
    for (const loja of lojas) resultado.push({ ...formatar(loja), vitrine: await vitrine(loja.usuario_id) });
    res.json({ lojas: resultado });
}

// GET /api/lojas/:slug
async function detalhar(req, res) {
    const [lojas] = await pool.execute(
        `SELECT l.*, u.status AS dono_status, ${ESTATISTICAS} FROM lojas l JOIN usuarios u ON u.id = l.usuario_id WHERE l.slug = ?`,
        [String(req.params.slug)]);
    const loja = lojas[0];
    if (!loja || !loja.ativa || loja.dono_status !== 'ativo') throw erros.naoEncontrado('Loja não encontrada ou temporariamente fora do ar.');
    res.json({ loja: { ...formatar(loja), vitrine: await vitrine(loja.usuario_id) } });
}

// GET /api/lojas/minha (vendedor)
async function minha(req, res) {
    const [lojas] = await pool.execute(`SELECT l.*, ${ESTATISTICAS} FROM lojas l WHERE l.usuario_id = ?`, [req.usuario.id]);
    if (!lojas.length) throw erros.naoEncontrado('Você ainda não tem uma loja.');
    res.json({ loja: formatar(lojas[0]) });
}

// PUT /api/lojas/minha (vendedor) — o endereço (slug) não muda para não quebrar links.
async function atualizarMinha(req, res) {
    v.objeto(req.body);
    const dados = {
        nome: v.texto(req.body.nome, 'o nome da loja', { min: 3, max: 60, campo: 'nome' }),
        descricao: v.texto(req.body.descricao, 'a descrição da loja', { min: 20, max: 500, multilinha: true, campo: 'descricao' }),
        cidade: v.texto(req.body.cidade, 'a cidade', { min: 2, max: 80, campo: 'cidade' }),
        uf: v.uf(req.body.uf),
        cor: v.cor(req.body.cor)
    };
    try {
        const [resultado] = await pool.execute(
            'UPDATE lojas SET nome = ?, descricao = ?, cidade = ?, uf = ?, cor = ? WHERE usuario_id = ?',
            [dados.nome, dados.descricao, dados.cidade, dados.uf, dados.cor, req.usuario.id]);
        if (!resultado.affectedRows) throw erros.naoEncontrado('Você ainda não tem uma loja.');
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') throw erros.conflito('Já existe uma loja com esse nome.', { campo: 'nome' });
        throw erro;
    }
    await registrarAuditoria({ req, acao: 'loja_atualizada', entidade: 'lojas', entidadeId: req.usuario.loja_id, detalhes: { nome: dados.nome } });
    res.json({ mensagem: 'Dados da loja atualizados.' });
}

// GET /api/lojas/gerenciar (admin)
async function gerenciar(req, res) {
    const [lojas] = await pool.execute(
        `SELECT l.*, u.nome AS dono_nome, u.email AS dono_email, u.status AS dono_status, ${ESTATISTICAS}
           FROM lojas l JOIN usuarios u ON u.id = l.usuario_id ORDER BY l.ativa DESC, total_vendas DESC, l.nome`);
    res.json({ lojas: lojas.map((loja) => ({ ...formatar(loja), dono: { id: loja.usuario_id, nome: loja.dono_nome, email: loja.dono_email, status: loja.dono_status } })) });
}

// PUT /api/lojas/:id/status (admin) — suspender esconde todos os produtos da loja.
async function alterarStatus(req, res) {
    const id = v.id(req.params.id, 'a loja');
    const ativa = v.booleano(req.body.ativa, 'a situação da loja');
    const [resultado] = await pool.execute('UPDATE lojas SET ativa = ? WHERE id = ?', [ativa, id]);
    if (!resultado.affectedRows) throw erros.naoEncontrado('Loja não encontrada.');
    await registrarAuditoria({ req, acao: ativa ? 'loja_reativada' : 'loja_suspensa', entidade: 'lojas', entidadeId: id });
    res.json({ mensagem: ativa ? 'Loja reativada. Os produtos voltaram à vitrine.' : 'Loja suspensa. Os produtos saíram da vitrine.' });
}

module.exports = { listar, detalhar, minha, atualizarMinha, gerenciar, alterarStatus };
