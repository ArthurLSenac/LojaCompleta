// Validações do servidor. O front-end também valida, mas só a API é confiável:
// qualquer pessoa pode enviar requisições diretamente, sem passar pelo navegador.
// Cada função devolve o valor limpo ou lança ErroHttp 400 com uma mensagem clara.
const { erros } = require('./erros');

const UFS = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR',
    'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

const maiuscula = (texto) => texto.charAt(0).toUpperCase() + texto.slice(1);
const vazio = (valor) => valor === undefined || valor === null || (typeof valor === 'string' && valor.trim() === '');

function falhar(mensagem, campo) {
    throw erros.requisicao(mensagem, campo ? { campo } : undefined);
}

function texto(valor, rotulo, { min = 1, max = 255, opcional = false, multilinha = false, campo } = {}) {
    if (vazio(valor)) {
        if (opcional) return null;
        falhar(`Informe ${rotulo}.`, campo);
    }
    if (typeof valor !== 'string') falhar(`${maiuscula(rotulo)} deve ser um texto.`, campo);
    // Remove caracteres de controle invisíveis; textos de uma linha também têm espaços normalizados.
    let limpo = valor.replace(multilinha ? /[\u0000-\u0009\u000B\u000C\u000E-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g, '').trim();
    if (!multilinha) limpo = limpo.replace(/\s+/g, ' ');
    else limpo = limpo.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n');
    if (limpo.length < min) falhar(`${maiuscula(rotulo)} deve ter pelo menos ${min} caracteres.`, campo);
    if (limpo.length > max) falhar(`${maiuscula(rotulo)} deve ter no máximo ${max} caracteres.`, campo);
    return limpo;
}

function inteiro(valor, rotulo, { min = 0, max = 2147483647, opcional = false, campo } = {}) {
    if (vazio(valor)) {
        if (opcional) return null;
        falhar(`Informe ${rotulo}.`, campo);
    }
    const numero = typeof valor === 'string' && /^-?\d+$/.test(valor.trim()) ? Number(valor) : valor;
    if (!Number.isSafeInteger(numero)) falhar(`${maiuscula(rotulo)} deve ser um número inteiro.`, campo);
    if (numero < min || numero > max) falhar(`${maiuscula(rotulo)} deve estar entre ${min} e ${max}.`, campo);
    return numero;
}

function id(valor, rotulo = 'o identificador') {
    return inteiro(valor, rotulo, { min: 1 });
}

/** Valor monetário com até 2 casas. Devolve texto "199.90", pronto para DECIMAL. */
function dinheiro(valor, rotulo, { min = 0.01, max = 999999.99, opcional = false, campo } = {}) {
    if (vazio(valor)) {
        if (opcional) return null;
        falhar(`Informe ${rotulo}.`, campo);
    }
    const textoValor = typeof valor === 'number' ? String(valor) : String(valor).trim().replace(',', '.');
    if (!/^\d{1,7}(\.\d{1,2})?$/.test(textoValor)) {
        falhar(`${maiuscula(rotulo)} deve ser um valor com até duas casas decimais.`, campo);
    }
    const numero = Number(textoValor);
    if (numero < min || numero > max) {
        falhar(`${maiuscula(rotulo)} deve estar entre R$ ${min.toFixed(2).replace('.', ',')} e R$ ${max.toFixed(2).replace('.', ',')}.`, campo);
    }
    return numero.toFixed(2);
}

function booleano(valor, rotulo, { padrao } = {}) {
    if (vazio(valor) && padrao !== undefined) return padrao;
    if (valor === true || valor === 1 || valor === '1' || valor === 'true') return true;
    if (valor === false || valor === 0 || valor === '0' || valor === 'false') return false;
    falhar(`${maiuscula(rotulo)} deve ser verdadeiro ou falso.`);
}

function opcao(valor, rotulo, opcoes, { opcional = false } = {}) {
    if (vazio(valor) && opcional) return null;
    if (!opcoes.includes(valor)) falhar(`Escolha ${rotulo} entre: ${opcoes.join(', ')}.`);
    return valor;
}

function email(valor, { campo = 'email' } = {}) {
    const limpo = texto(valor, 'o e-mail', { max: 180, campo }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(limpo)) falhar('Informe um e-mail válido.', campo);
    return limpo;
}

/** Senha forte: 8 a 72 bytes (limite do bcrypt), com maiúscula, minúscula e número. */
function senhaForte(valor, { campo = 'senha' } = {}) {
    if (typeof valor !== 'string' || valor.length === 0) falhar('Informe a senha.', campo);
    if (valor.length < 8) falhar('A senha deve ter pelo menos 8 caracteres.', campo);
    if (Buffer.byteLength(valor, 'utf8') > 72) falhar('A senha deve ter no máximo 72 bytes.', campo);
    if (!/[a-z]/.test(valor) || !/[A-Z]/.test(valor) || !/\d/.test(valor)) {
        falhar('A senha precisa ter letras maiúsculas, minúsculas e números.', campo);
    }
    return valor;
}

/** URL http(s) sem usuário/senha embutidos. Opcionalmente aceita caminhos locais "assets/...". */
function url(valor, rotulo, { opcional = false, permitirLocal = false, campo } = {}) {
    if (vazio(valor)) {
        if (opcional) return null;
        falhar(`Informe ${rotulo}.`, campo);
    }
    if (typeof valor !== 'string' || valor.length > 600) falhar(`${maiuscula(rotulo)} deve ter no máximo 600 caracteres.`, campo);
    const limpo = valor.trim();
    if (permitirLocal && /^assets\/[\w\-./]+$/.test(limpo) && !limpo.includes('..')) return limpo;
    try {
        const endereco = new URL(limpo);
        if (!['http:', 'https:'].includes(endereco.protocol) || endereco.username || endereco.password) throw new Error();
        return endereco.href;
    } catch (erro) {
        falhar(`${maiuscula(rotulo)} deve ser um endereço http:// ou https:// válido.`, campo);
    }
}

function cep(valor) {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (!/^\d{8}$/.test(digitos)) falhar('Informe um CEP com 8 dígitos.', 'cep');
    return digitos;
}

function uf(valor) {
    const sigla = String(valor || '').trim().toUpperCase();
    if (!UFS.includes(sigla)) falhar('Informe uma UF válida, como SP ou MG.', 'uf');
    return sigla;
}

function telefone(valor, { opcional = false } = {}) {
    if (vazio(valor)) {
        if (opcional) return null;
        falhar('Informe o telefone.', 'telefone');
    }
    const digitos = String(valor).replace(/\D/g, '');
    if (!/^\d{10,11}$/.test(digitos)) falhar('Informe um telefone com DDD, como (11) 98765-4321.', 'telefone');
    const meio = digitos.length === 11 ? 5 : 4;
    return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 2 + meio)}-${digitos.slice(2 + meio)}`;
}

function cor(valor, { opcional = false } = {}) {
    if (vazio(valor) && opcional) return null;
    if (typeof valor !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(valor)) falhar('Informe uma cor no formato #RRGGBB.', 'cor');
    return valor.toUpperCase();
}

function dataHora(valor, rotulo, { opcional = false } = {}) {
    if (vazio(valor)) {
        if (opcional) return null;
        falhar(`Informe ${rotulo}.`);
    }
    const data = new Date(valor);
    if (Number.isNaN(data.getTime()) || data.getFullYear() < 2000 || data.getFullYear() > 2037) {
        falhar(`${maiuscula(rotulo)} deve ser uma data válida.`);
    }
    return data;
}

/** Garante objeto simples no corpo (sem arrays) e devolve o próprio objeto. */
function objeto(valor, rotulo = 'o corpo da requisição') {
    if (!valor || typeof valor !== 'object' || Array.isArray(valor)) falhar(`Envie ${rotulo} como um objeto JSON.`);
    return valor;
}

/** Lê parâmetros de busca (?pagina=2&limite=24) com valores padrão seguros. */
function paginacao(query, { limitePadrao = 20, limiteMaximo = 60 } = {}) {
    const pagina = query.pagina === undefined ? 1 : inteiro(query.pagina, 'a página', { min: 1, max: 10000 });
    const limite = query.limite === undefined ? limitePadrao : inteiro(query.limite, 'o limite', { min: 1, max: limiteMaximo });
    return { pagina, limite, deslocamento: (pagina - 1) * limite };
}

module.exports = {
    UFS, texto, inteiro, id, dinheiro, booleano, opcao, email, senhaForte, url, cep, uf, telefone, cor, dataHora, objeto, paginacao, falhar
};
