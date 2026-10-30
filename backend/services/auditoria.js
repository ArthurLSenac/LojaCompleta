// Registro de auditoria: quem fez o quê, quando e de qual IP.
// Aceita o pool ou a conexão de uma transação, para gravar junto com a operação.
const pool = require('../database/conexao');

async function registrarAuditoria({ executor = pool, req, usuarioId, acao, entidade = null, entidadeId = null, detalhes = null }) {
    const autor = usuarioId !== undefined ? usuarioId : (req && req.usuario ? req.usuario.id : null);
    const ip = req ? String(req.ip || '').slice(0, 45) : null;
    try {
        await executor.execute(
            'INSERT INTO logs_auditoria (usuario_id, acao, entidade, entidade_id, detalhes, ip) VALUES (?, ?, ?, ?, ?, ?)',
            [autor || null, acao, entidade, entidadeId, detalhes ? JSON.stringify(detalhes) : null, ip]
        );
    } catch (erro) {
        // A auditoria não deve derrubar a operação principal; o erro fica no log do servidor.
        console.error('Falha ao registrar auditoria:', acao, erro.code || erro.message);
    }
}

module.exports = { registrarAuditoria };
