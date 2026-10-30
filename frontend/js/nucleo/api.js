// Comunicação com a API REST por Fetch.
// Todo pedido passa por aqui: o JWT vai no cabeçalho Authorization e os erros
// viram mensagens amigáveis em português.
import { obterToken, encerrarSessao } from './sessao.js';

// Pelo Live Server (porta 5500) o front fica separado da API; pelo Express, é a mesma origem.
export const API_BASE = ['5500', '5501'].includes(window.location.port) ? 'http://localhost:3000' : window.location.origin;

export class ErroApi extends Error {
    constructor(mensagem, status, dados) {
        super(mensagem);
        this.name = 'ErroApi';
        this.status = status;
        this.campo = dados && dados.campo;
        this.dados = dados;
    }
}

export async function api(caminho, { metodo = 'GET', corpo, sinal } = {}) {
    const cabecalhos = { Accept: 'application/json' };
    const token = obterToken();
    if (token) cabecalhos.Authorization = 'Bearer ' + token;
    const opcoes = { method: metodo, headers: cabecalhos, signal: sinal };
    if (corpo !== undefined) {
        cabecalhos['Content-Type'] = 'application/json';
        opcoes.body = JSON.stringify(corpo); // objeto JavaScript -> texto JSON
    }

    let resposta;
    try {
        resposta = await fetch(API_BASE + '/api' + caminho, opcoes);
    } catch (erro) {
        if (erro.name === 'AbortError') throw erro;
        throw new ErroApi('Não foi possível falar com a loja. Confira sua conexão e se o servidor está ligado.', 0);
    }

    let dados = null;
    if ((resposta.headers.get('Content-Type') || '').includes('application/json')) {
        dados = await resposta.json().catch(() => null); // texto JSON -> objeto JavaScript
    }
    if (resposta.status === 401 && token) encerrarSessao();
    if (!resposta.ok) {
        throw new ErroApi((dados && dados.mensagem) || 'Algo deu errado. Tente novamente.', resposta.status, dados);
    }
    return dados;
}

/** Monta a query string ignorando valores vazios: { q: 'fone', pagina: 2 } -> "?q=fone&pagina=2" */
export function consulta(parametros) {
    const busca = new URLSearchParams();
    for (const [chave, valor] of Object.entries(parametros)) {
        if (valor === undefined || valor === null || valor === '' || valor === false) continue;
        busca.set(chave, valor === true ? '1' : String(valor));
    }
    const texto = busca.toString();
    return texto ? '?' + texto : '';
}
