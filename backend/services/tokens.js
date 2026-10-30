// Emissão do JWT. O token carrega só o necessário: id (sub), nível e versão.
// A versão permite invalidar todos os tokens de um usuário de uma vez.
const jwt = require('jsonwebtoken');
const config = require('../config/ambiente');

function gerarToken(usuario) {
    return jwt.sign({ nivel: usuario.nivel, ver: usuario.token_versao }, config.jwt.segredo, {
        algorithm: 'HS256',
        expiresIn: config.jwt.expiraEm,
        subject: String(usuario.id),
        issuer: config.jwt.emissor,
        audience: config.jwt.publico
    });
}

module.exports = { gerarToken };
