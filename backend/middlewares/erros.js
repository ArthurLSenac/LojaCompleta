// Tratamento central de erros. Mensagens técnicas (SQL, pilha, credenciais)
// ficam só no terminal do servidor; o navegador recebe um texto seguro em JSON.
const path = require('node:path');
const { ErroHttp } = require('../utils/erros');

function corpoJson(req, res, next) {
    // Rotas de escrita sempre recebem um objeto, mesmo sem corpo.
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        if (req.body === undefined) req.body = {};
        if (req.body === null || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({ mensagem: 'Envie um objeto JSON no corpo da requisição.' });
        }
    }
    next();
}

function rotaApiNaoEncontrada(req, res) {
    res.status(404).json({ mensagem: 'Rota não encontrada.' });
}

function paginaNaoEncontrada(req, res, next) {
    if (req.method !== 'GET' || req.path.startsWith('/api/')) return next();
    res.status(404).sendFile(path.join(__dirname, '..', '..', 'frontend', '404.html'), (erro) => erro && next());
}

// Quatro parâmetros: é assim que o Express reconhece um middleware de erro.
function tratarErros(erro, req, res, next) {
    if (res.headersSent) return next(erro);
    if (erro instanceof ErroHttp) {
        return res.status(erro.status).json({ mensagem: erro.message, ...(erro.extra || {}) });
    }
    if (erro.type === 'entity.parse.failed') return res.status(400).json({ mensagem: 'O JSON enviado é inválido.' });
    if (erro.type === 'entity.too.large') return res.status(413).json({ mensagem: 'O corpo da requisição é muito grande.' });
    if (erro.code === 'ER_LOCK_DEADLOCK' || erro.code === 'ER_LOCK_WAIT_TIMEOUT') {
        return res.status(409).json({ mensagem: 'Outra operação alterou esses dados ao mesmo tempo. Tente novamente.' });
    }
    if (erro.code === 'ER_DUP_ENTRY') return res.status(409).json({ mensagem: 'Já existe um registro com esses dados.' });
    if (erro.code === 'ER_CHECK_CONSTRAINT_VIOLATED') return res.status(400).json({ mensagem: 'Os dados enviados não respeitam as regras do cadastro.' });
    if (erro.code === 'ER_ROW_IS_REFERENCED_2') return res.status(409).json({ mensagem: 'Este registro está em uso e não pode ser removido.' });
    if (erro.status === 413) return res.status(413).json({ mensagem: 'O corpo da requisição é muito grande.' });
    console.error('[erro interno]', req.method, req.originalUrl, '-', erro.code || erro.name, erro.message);
    res.status(500).json({ mensagem: 'Não foi possível concluir a operação agora. Tente novamente em instantes.' });
}

module.exports = { corpoJson, rotaApiNaoEncontrada, paginaNaoEncontrada, tratarErros };
