// Lê o arquivo backend/.env uma única vez e expõe a configuração já convertida.
// Segredos (senha do banco, JWT_SECRET, chave do ElevenLabs) nunca ficam no código.
const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

function numero(valor, padrao) {
    const convertido = Number(valor);
    return Number.isFinite(convertido) ? convertido : padrao;
}

const porta = numero(process.env.PORT, 3000);

const config = {
    ambiente: process.env.NODE_ENV || 'development',
    porta,
    host: process.env.HOST || '127.0.0.1',
    db: {
        host: process.env.DB_HOST || 'localhost',
        port: numero(process.env.DB_PORT, 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'ambar_marketplace'
    },
    jwt: {
        segredo: process.env.JWT_SECRET || '',
        expiraEm: process.env.JWT_EXPIRES_IN || '2h',
        emissor: 'ambar-api',
        publico: 'ambar-web'
    },
    // Origens extras do navegador (ex.: Live Server). A própria API já é permitida.
    origensPermitidas: (process.env.FRONTEND_ORIGIN || 'http://127.0.0.1:5500')
        .split(',').map((origem) => origem.trim()).filter(Boolean)
        .concat(['http://localhost:' + porta, 'http://127.0.0.1:' + porta]),
    limites: {
        loginPorJanela: numero(process.env.LIMITE_LOGIN, 20),
        apiPorJanela: numero(process.env.LIMITE_API, 900)
    },
    seguranca: {
        tentativasLogin: 5,
        minutosBloqueio: 15,
        custoBcrypt: numero(process.env.BCRYPT_CUSTO, 12)
    },
    elevenlabs: {
        chave: process.env.ELEVENLABS_API_KEY || '',
        vozId: process.env.ELEVENLABS_VOICE_ID || 'EbiSUflQjzm4g7S895SC',
        modeloVoz: process.env.ELEVENLABS_TTS_MODEL || 'eleven_multilingual_v2'
    }
};

function validarConfiguracao() {
    if (config.jwt.segredo.length < 32) {
        throw new Error('Configure JWT_SECRET com ao menos 32 caracteres em backend/.env (veja .env.example).');
    }
    if (!Number.isInteger(config.porta) || config.porta < 1 || config.porta > 65535) {
        throw new Error('Configure PORT com um número inteiro entre 1 e 65535.');
    }
}

module.exports = config;
module.exports.validarConfiguracao = validarConfiguracao;
