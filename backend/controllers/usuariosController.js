// Gestão de usuários pela administração: busca, mudança de nível e bloqueio.
const pool = require('../database/conexao');
const { transacao } = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { slug, escaparLike } = require('../utils/texto');
const { registrarAuditoria } = require('../services/auditoria');

// GET /api/usuarios
async function listar(req, res) {
    const { pagina, limite, deslocamento } = v.paginacao(req.query, { limitePadrao: 20, limiteMaximo: 100 });
    const condicoes = ['1 = 1'];
    const parametros = [];
    if (req.query.q) {
        const padrao = '%' + escaparLike(v.texto(req.query.q, 'a busca', { max: 80 })) + '%';
        condicoes.push('(u.nome LIKE ? OR u.email LIKE ?)');
        parametros.push(padrao, padrao);
    }
    if (req.query.nivel) { condicoes.push('u.nivel = ?'); parametros.push(v.opcao(req.query.nivel, 'o nível', ['admin', 'vendedor', 'comprador'])); }
    if (req.query.status) { condicoes.push('u.status = ?'); parametros.push(v.opcao(req.query.status, 'o status', ['ativo', 'bloqueado'])); }
    const where = condicoes.join(' AND ');
    // Nunca selecionar senha_hash em consultas devolvidas ao navegador.
    const [usuarios] = await pool.execute(
        `SELECT u.id, u.nome, u.email, u.telefone, u.nivel, u.status, u.ultimo_login, u.criado_em,
                (u.bloqueado_ate IS NOT NULL AND u.bloqueado_ate > NOW()) AS bloqueio_temporario,
                l.nome AS loja_nome, l.slug AS loja_slug,
                (SELECT COUNT(*) FROM pedidos o WHERE o.comprador_id = u.id) AS total_pedidos,
                (SELECT COALESCE(SUM(o.total), 0) FROM pedidos o WHERE o.comprador_id = u.id AND o.status <> 'cancelado') AS total_gasto
           FROM usuarios u LEFT JOIN lojas l ON l.usuario_id = u.id
          WHERE ${where} ORDER BY u.id DESC LIMIT ${limite} OFFSET ${deslocamento}`, parametros);
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM usuarios u WHERE ${where}`, parametros);
    const [contagem] = await pool.execute('SELECT nivel, COUNT(*) AS total FROM usuarios GROUP BY nivel');
    res.json({
        itens: usuarios.map((u) => ({ ...u, bloqueio_temporario: Boolean(u.bloqueio_temporario) })),
        total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)),
        por_nivel: Object.fromEntries(contagem.map((c) => [c.nivel, c.total]))
    });
}

async function travarAdmins(conexao) {
    // Travar os administradores em ordem impede que dois pedidos simultâneos removam o último admin.
    const [admins] = await conexao.execute("SELECT id FROM usuarios WHERE nivel = 'admin' AND status = 'ativo' ORDER BY id FOR UPDATE");
    return admins;
}

// PUT /api/usuarios/:id/nivel
async function alterarNivel(req, res) {
    const id = v.id(req.params.id, 'o usuário');
    const nivel = v.opcao(req.body.nivel, 'o nível', ['admin', 'vendedor', 'comprador']);
    if (id === req.usuario.id) throw erros.conflito('Você não pode mudar o seu próprio nível. Peça a outro administrador.');
    const mensagem = await transacao(async (conexao) => {
        const admins = await travarAdmins(conexao);
        const [linhas] = await conexao.execute('SELECT id, nome, nivel FROM usuarios WHERE id = ? FOR UPDATE', [id]);
        const usuario = linhas[0];
        if (!usuario) throw erros.naoEncontrado('Usuário não encontrado.');
        if (usuario.nivel === nivel) throw erros.conflito('O usuário já tem esse nível.');
        if (usuario.nivel === 'admin' && admins.length <= 1 && admins.some((a) => a.id === id)) {
            throw erros.conflito('Mantenha pelo menos um administrador ativo no sistema.');
        }
        const [lojas] = await conexao.execute('SELECT id, ativa FROM lojas WHERE usuario_id = ?', [id]);
        let detalhe = '';
        if (nivel === 'vendedor') {
            if (lojas.length) {
                await conexao.execute('UPDATE lojas SET ativa = 1 WHERE id = ?', [lojas[0].id]);
            } else {
                const base = slug('Loja ' + usuario.nome);
                await conexao.execute(
                    "INSERT INTO lojas (usuario_id, nome, slug, descricao, cidade, uf) VALUES (?, ?, ?, ?, 'São Paulo', 'SP')",
                    [id, ('Loja ' + usuario.nome).slice(0, 60), `${base}-${id}`, 'Loja criada pela administração. O vendedor pode completar a descrição na Central do vendedor.']);
                detalhe = ' Uma loja foi criada para ele.';
            }
        } else if (lojas.length && lojas[0].ativa) {
            // Deixar de ser vendedor suspende a loja; os produtos saem da vitrine, o histórico fica.
            await conexao.execute('UPDATE lojas SET ativa = 0 WHERE id = ?', [lojas[0].id]);
            detalhe = ' A loja dele foi suspensa.';
        }
        await conexao.execute('UPDATE usuarios SET nivel = ? WHERE id = ?', [nivel, id]);
        await registrarAuditoria({ executor: conexao, req, acao: 'nivel_alterado', entidade: 'usuarios', entidadeId: id, detalhes: { de: usuario.nivel, para: nivel } });
        return 'Nível atualizado.' + detalhe;
    });
    res.json({ mensagem });
}

// PUT /api/usuarios/:id/status — bloquear também derruba as sessões abertas.
async function alterarStatus(req, res) {
    const id = v.id(req.params.id, 'o usuário');
    const status = v.opcao(req.body.status, 'o status', ['ativo', 'bloqueado']);
    if (id === req.usuario.id) throw erros.conflito('Você não pode bloquear a sua própria conta.');
    await transacao(async (conexao) => {
        const admins = await travarAdmins(conexao);
        const [linhas] = await conexao.execute('SELECT id, nivel, status FROM usuarios WHERE id = ? FOR UPDATE', [id]);
        const usuario = linhas[0];
        if (!usuario) throw erros.naoEncontrado('Usuário não encontrado.');
        if (usuario.status === status) throw erros.conflito(status === 'bloqueado' ? 'O usuário já está bloqueado.' : 'O usuário já está ativo.');
        if (status === 'bloqueado' && usuario.nivel === 'admin' && admins.length <= 1) throw erros.conflito('Mantenha pelo menos um administrador ativo.');
        if (status === 'bloqueado') {
            await conexao.execute("UPDATE usuarios SET status = 'bloqueado', token_versao = token_versao + 1 WHERE id = ?", [id]);
        } else {
            await conexao.execute("UPDATE usuarios SET status = 'ativo', tentativas_login = 0, bloqueado_ate = NULL WHERE id = ?", [id]);
        }
        await registrarAuditoria({ executor: conexao, req, acao: status === 'bloqueado' ? 'usuario_bloqueado' : 'usuario_desbloqueado', entidade: 'usuarios', entidadeId: id });
    });
    res.json({ mensagem: status === 'bloqueado' ? 'Usuário bloqueado. As sessões dele foram encerradas.' : 'Usuário desbloqueado.' });
}

module.exports = { listar, alterarNivel, alterarStatus };
