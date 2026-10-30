// Autenticação: confere o JWT enviado em "Authorization: Bearer <token>".
// Depois de validar assinatura e validade, o usuário é buscado no banco a cada
// requisição. Assim, bloquear a conta, trocar a senha ou mudar o nível revoga
// o acesso na hora, mesmo que o token antigo ainda não tenha expirado.
const jwt = require('jsonwebtoken');
const pool = require('../database/conexao');
const config = require('../config/ambiente');

const ERROS_DE_TOKEN = ['TokenExpiredError', 'JsonWebTokenError', 'NotBeforeError'];

function extrairToken(req) {
    const cabecalho = req.get('Authorization');
    if (typeof cabecalho !== 'string') return null;
    const [tipo, token] = cabecalho.split(' ');
    return tipo === 'Bearer' && token ? token : null;
}

async function carregarUsuario(token) {
    // verify confere assinatura, algoritmo, emissor, público e expiração.
    const dados = jwt.verify(token, config.jwt.segredo, {
        algorithms: ['HS256'],
        issuer: config.jwt.emissor,
        audience: config.jwt.publico
    });
    const usuarioId = Number(dados.sub);
    if (!Number.isInteger(usuarioId) || usuarioId <= 0) return null;
    const [linhas] = await pool.execute(
        `SELECT u.id, u.nome, u.email, u.nivel, u.status, u.token_versao,
                l.id AS loja_id, l.nome AS loja_nome, l.slug AS loja_slug, l.ativa AS loja_ativa
           FROM usuarios u
           LEFT JOIN lojas l ON l.usuario_id = u.id
          WHERE u.id = ?`,
        [usuarioId]
    );
    const usuario = linhas[0];
    // Conta bloqueada ou token de uma "versão" anterior (senha trocada, sair de todos) não passam.
    if (!usuario || usuario.status !== 'ativo' || usuario.token_versao !== dados.ver) return null;
    return usuario;
}

async function autenticar(req, res, next) {
    const token = extrairToken(req);
    if (!token) return res.status(401).json({ mensagem: 'Entre na sua conta para continuar.' });
    try {
        const usuario = await carregarUsuario(token);
        if (!usuario) return res.status(401).json({ mensagem: 'Sua sessão não é mais válida. Entre novamente.' });
        req.usuario = usuario;
        next();
    } catch (erro) {
        if (ERROS_DE_TOKEN.includes(erro.name)) {
            return res.status(401).json({ mensagem: 'Sua sessão expirou. Entre novamente.' });
        }
        next(erro);
    }
}

/** Rotas públicas que mudam um pouco quando há login (ex.: mostrar "favoritado"). */
async function autenticarOpcional(req, res, next) {
    const token = extrairToken(req);
    if (!token) return next();
    try {
        req.usuario = (await carregarUsuario(token)) || undefined;
        next();
    } catch (erro) {
        if (ERROS_DE_TOKEN.includes(erro.name)) return next();
        next(erro);
    }
}

module.exports = { autenticar, autenticarOpcional };
