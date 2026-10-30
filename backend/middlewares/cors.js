// CORS decide quais origens de navegador podem ler as respostas da API.
// Não é autenticação: ferramentas como curl ignoram CORS e continuam passando
// pelo JWT e pela autorização.
const cors = require('cors');
const config = require('../config/ambiente');
const { ErroHttp } = require('../utils/erros');

module.exports = cors({
    origin: function verificarOrigem(origem, callback) {
        // Sem Origin: mesma origem ou clientes fora do navegador.
        if (!origem || config.origensPermitidas.includes(origem)) return callback(null, true);
        callback(new ErroHttp(403, 'Origem não permitida pelo CORS.'));
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset', 'Retry-After'],
    maxAge: 600
});
