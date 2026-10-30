// Consulta do registro de auditoria (somente administração).
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { escaparLike } = require('../utils/texto');

// GET /api/auditoria
async function listar(req, res) {
    const { pagina, limite, deslocamento } = v.paginacao(req.query, { limitePadrao: 30, limiteMaximo: 200 });
    const condicoes = ['1 = 1'];
    const parametros = [];
    if (req.query.acao) { condicoes.push('a.acao = ?'); parametros.push(v.texto(req.query.acao, 'a ação', { max: 60 })); }
    if (req.query.q) {
        const padrao = '%' + escaparLike(v.texto(req.query.q, 'a busca', { max: 80 })) + '%';
        condicoes.push('(u.nome LIKE ? OR u.email LIKE ? OR a.ip LIKE ? OR a.entidade LIKE ?)');
        parametros.push(padrao, padrao, padrao, padrao);
    }
    if (req.query.seguranca === '1') condicoes.push("a.acao IN ('login_falhou', 'login_bloqueado', 'login_conta_bloqueada', 'usuario_bloqueado', 'senha_alterada', 'sessoes_encerradas', 'nivel_alterado')");
    const where = condicoes.join(' AND ');
    const [itens] = await pool.execute(
        `SELECT a.id, a.acao, a.entidade, a.entidade_id, a.detalhes, a.ip, a.criado_em, u.nome AS usuario_nome, u.email AS usuario_email, u.nivel AS usuario_nivel
           FROM logs_auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id
          WHERE ${where} ORDER BY a.id DESC LIMIT ${limite} OFFSET ${deslocamento}`, parametros);
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total FROM logs_auditoria a LEFT JOIN usuarios u ON u.id = a.usuario_id WHERE ${where}`, parametros);
    const [acoes] = await pool.execute('SELECT acao, COUNT(*) AS total FROM logs_auditoria GROUP BY acao ORDER BY acao');
    const [[resumo]] = await pool.execute(
        `SELECT COALESCE(SUM(acao = 'login_falhou' AND criado_em >= NOW() - INTERVAL 1 DAY), 0) AS falhas_24h,
                COALESCE(SUM(acao = 'login_bloqueado' AND criado_em >= NOW() - INTERVAL 7 DAY), 0) AS bloqueios_7d,
                COALESCE(SUM(acao = 'login' AND criado_em >= NOW() - INTERVAL 1 DAY), 0) AS logins_24h
           FROM logs_auditoria`);
    res.json({
        itens, total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)), acoes,
        resumo: Object.fromEntries(Object.entries(resumo).map(([chave, valor]) => [chave, Number(valor)]))
    });
}

module.exports = { listar };
