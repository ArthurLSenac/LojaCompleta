// Solicitações para virar vendedor: o comprador pede, a administração aprova ou recusa.
const pool = require('../database/conexao');
const { transacao } = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { slug } = require('../utils/texto');
const { registrarAuditoria } = require('../services/auditoria');

const CORES = ['#B4532A', '#2563A8', '#6D28D9', '#0F766E', '#8A4B1F', '#B7791F', '#7C4A2D', '#BE185D', '#15803D', '#DB2777', '#1E3A8A'];

// POST /api/solicitacoes (comprador)
async function criar(req, res) {
    v.objeto(req.body);
    const dados = {
        nomeLoja: v.texto(req.body.nome_loja, 'o nome da loja', { min: 3, max: 60, campo: 'nome_loja' }),
        descricao: v.texto(req.body.descricao, 'a descrição da loja', { min: 30, max: 500, multilinha: true, campo: 'descricao' }),
        cidade: v.texto(req.body.cidade, 'a cidade', { min: 2, max: 80, campo: 'cidade' }),
        uf: v.uf(req.body.uf),
        telefone: v.telefone(req.body.telefone)
    };
    const [pendentes] = await pool.execute("SELECT id FROM solicitacoes_vendedor WHERE usuario_id = ? AND status = 'pendente'", [req.usuario.id]);
    if (pendentes.length) throw erros.conflito('Você já tem uma solicitação em análise. Aguarde a resposta da curadoria.');
    const [nomes] = await pool.execute('SELECT id FROM lojas WHERE nome = ? OR slug = ?', [dados.nomeLoja, slug(dados.nomeLoja)]);
    if (nomes.length) throw erros.conflito('Já existe uma loja com esse nome. Escolha outro.', { campo: 'nome_loja' });
    const [resultado] = await pool.execute(
        'INSERT INTO solicitacoes_vendedor (usuario_id, nome_loja, descricao, cidade, uf, telefone) VALUES (?, ?, ?, ?, ?, ?)',
        [req.usuario.id, dados.nomeLoja, dados.descricao, dados.cidade, dados.uf, dados.telefone]);
    await registrarAuditoria({ req, acao: 'solicitacao_enviada', entidade: 'solicitacoes_vendedor', entidadeId: resultado.insertId, detalhes: { loja: dados.nomeLoja } });
    res.status(201).json({ mensagem: 'Solicitação enviada! A curadoria responde em até 2 dias úteis.', id: resultado.insertId });
}

// GET /api/solicitacoes/minha
async function minha(req, res) {
    const [linhas] = await pool.execute(
        'SELECT id, nome_loja, descricao, cidade, uf, telefone, status, motivo, criado_em, avaliado_em FROM solicitacoes_vendedor WHERE usuario_id = ? ORDER BY id DESC LIMIT 1',
        [req.usuario.id]);
    res.json({ solicitacao: linhas[0] || null });
}

// GET /api/solicitacoes (admin)
async function listar(req, res) {
    const status = req.query.status ? v.opcao(req.query.status, 'o status', ['pendente', 'aprovada', 'recusada']) : null;
    const [linhas] = await pool.execute(
        `SELECT s.*, u.nome AS usuario_nome, u.email AS usuario_email, a.nome AS avaliador_nome
           FROM solicitacoes_vendedor s
           JOIN usuarios u ON u.id = s.usuario_id
           LEFT JOIN usuarios a ON a.id = s.avaliado_por
          ${status ? 'WHERE s.status = ?' : ''}
          ORDER BY s.status = 'pendente' DESC, s.criado_em DESC`, status ? [status] : []);
    res.json({ solicitacoes: linhas });
}

async function travarPendente(conexao, id) {
    const [linhas] = await conexao.execute('SELECT * FROM solicitacoes_vendedor WHERE id = ? FOR UPDATE', [id]);
    const solicitacao = linhas[0];
    if (!solicitacao) throw erros.naoEncontrado('Solicitação não encontrada.');
    if (solicitacao.status !== 'pendente') throw erros.conflito('Esta solicitação já foi analisada.');
    return solicitacao;
}

// PUT /api/solicitacoes/:id/aprovar (admin) — cria a loja e promove o usuário, tudo ou nada.
async function aprovar(req, res) {
    const id = v.id(req.params.id, 'a solicitação');
    const loja = await transacao(async (conexao) => {
        const solicitacao = await travarPendente(conexao, id);
        const [usuarios] = await conexao.execute('SELECT id, nivel, status FROM usuarios WHERE id = ? FOR UPDATE', [solicitacao.usuario_id]);
        const usuario = usuarios[0];
        if (!usuario || usuario.status !== 'ativo') throw erros.conflito('A conta deste usuário está bloqueada.');
        if (usuario.nivel !== 'comprador') throw erros.conflito('Este usuário não é mais um comprador.');
        const [existente] = await conexao.execute('SELECT id FROM lojas WHERE usuario_id = ?', [usuario.id]);
        let lojaId;
        let endereco = slug(solicitacao.nome_loja);
        if (existente.length) {
            // Já foi vendedor antes: reaproveita e reativa a loja.
            lojaId = existente[0].id;
            await conexao.execute('UPDATE lojas SET ativa = 1 WHERE id = ?', [lojaId]);
        } else {
            const [mesmoSlug] = await conexao.execute('SELECT COUNT(*) AS total FROM lojas WHERE slug LIKE ?', [endereco + '%']);
            if (mesmoSlug[0].total > 0) endereco = `${endereco}-${mesmoSlug[0].total + 1}`;
            const [inserida] = await conexao.execute(
                'INSERT INTO lojas (usuario_id, nome, slug, descricao, cidade, uf, cor) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [usuario.id, solicitacao.nome_loja, endereco, solicitacao.descricao, solicitacao.cidade, solicitacao.uf, CORES[usuario.id % CORES.length]]);
            lojaId = inserida.insertId;
        }
        await conexao.execute("UPDATE usuarios SET nivel = 'vendedor', telefone = COALESCE(telefone, ?) WHERE id = ?", [solicitacao.telefone, usuario.id]);
        await conexao.execute("UPDATE solicitacoes_vendedor SET status = 'aprovada', avaliado_por = ?, avaliado_em = NOW() WHERE id = ?", [req.usuario.id, id]);
        await registrarAuditoria({ executor: conexao, req, acao: 'solicitacao_aprovada', entidade: 'solicitacoes_vendedor', entidadeId: id, detalhes: { loja: solicitacao.nome_loja, loja_id: lojaId } });
        return { id: lojaId, slug: endereco };
    });
    res.json({ mensagem: 'Solicitação aprovada. A loja já pode cadastrar produtos.', loja });
}

// PUT /api/solicitacoes/:id/recusar (admin)
async function recusar(req, res) {
    const id = v.id(req.params.id, 'a solicitação');
    const motivo = v.texto(req.body.motivo, 'o motivo da recusa', { min: 10, max: 300, campo: 'motivo' });
    await transacao(async (conexao) => {
        await travarPendente(conexao, id);
        await conexao.execute("UPDATE solicitacoes_vendedor SET status = 'recusada', motivo = ?, avaliado_por = ?, avaliado_em = NOW() WHERE id = ?", [motivo, req.usuario.id, id]);
        await registrarAuditoria({ executor: conexao, req, acao: 'solicitacao_recusada', entidade: 'solicitacoes_vendedor', entidadeId: id });
    });
    res.json({ mensagem: 'Solicitação recusada. A pessoa verá o motivo na conta dela.' });
}

module.exports = { criar, minha, listar, aprovar, recusar };
