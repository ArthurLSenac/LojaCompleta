// Configurações da loja guardadas no banco (tabela configuracoes), com cache curto
// para não consultar o MySQL a cada requisição.
const pool = require('../database/conexao');

let cache = null;
let validoAte = 0;

function converter(linha) {
    if (linha.tipo === 'numero') return Number(linha.valor);
    if (linha.tipo === 'booleano') return linha.valor === 'true';
    return linha.valor;
}

async function carregar({ forcar = false } = {}) {
    if (!forcar && cache && Date.now() < validoAte) return cache;
    const [linhas] = await pool.execute('SELECT chave, valor, tipo, descricao, publica, atualizado_em FROM configuracoes ORDER BY chave');
    cache = { linhas, valores: Object.fromEntries(linhas.map((linha) => [linha.chave, converter(linha)])) };
    validoAte = Date.now() + 15000;
    return cache;
}

async function obterValores() {
    return (await carregar()).valores;
}

function limparCache() {
    cache = null;
}

module.exports = { carregar, obterValores, limparCache, converter };
