// Sessão do usuário no navegador.
// "Manter conectado" guarda no localStorage; caso contrário, no sessionStorage
// (some ao fechar a aba). O nível guardado aqui só organiza a navegação:
// quem decide o que pode ou não é sempre a API.
const CHAVE = 'ambar:sessao';
let sessaoEmMemoria = null; // usada quando o navegador bloqueia o armazenamento

function deposito(tipo) {
    try {
        return tipo === 'local' ? window.localStorage : window.sessionStorage;
    } catch (erro) {
        return null;
    }
}

function lerPayload(token) {
    try {
        const parte = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(parte.padEnd(parte.length + ((4 - (parte.length % 4)) % 4), '=')));
    } catch (erro) {
        return null;
    }
}

function avisarMudanca() {
    window.dispatchEvent(new CustomEvent('ambar:sessao'));
}

function apagarTudo() {
    for (const tipo of ['sessao', 'local']) {
        try { deposito(tipo)?.removeItem(CHAVE); } catch (erro) { /* ignorar */ }
    }
    sessaoEmMemoria = null;
}

export function salvarSessao({ token, usuario }, lembrar = true) {
    apagarTudo();
    const dados = { token, usuario };
    try {
        deposito(lembrar ? 'local' : 'sessao').setItem(CHAVE, JSON.stringify(dados));
    } catch (erro) {
        sessaoEmMemoria = { ...dados, lembrar };
    }
    avisarMudanca();
}

export function obterSessao() {
    let sessao = sessaoEmMemoria;
    for (const tipo of ['sessao', 'local']) {
        if (sessao) break;
        try {
            const bruto = deposito(tipo)?.getItem(CHAVE);
            if (bruto) sessao = { ...JSON.parse(bruto), lembrar: tipo === 'local' };
        } catch (erro) { /* dado corrompido: tratado como sem sessão */ }
    }
    if (!sessao || !sessao.token) return null;
    const payload = lerPayload(sessao.token);
    if (!payload || !payload.exp || payload.exp * 1000 <= Date.now()) {
        apagarTudo();
        return null;
    }
    return sessao;
}

export const obterToken = () => obterSessao()?.token || null;
export const obterUsuario = () => obterSessao()?.usuario || null;
export const estaLogado = () => Boolean(obterSessao());

/** Atualiza dados guardados (ex.: nome editado, novo token após trocar a senha). */
export function atualizarSessao({ token, usuario = {} } = {}) {
    const sessao = obterSessao();
    if (!sessao) return;
    salvarSessao({ token: token || sessao.token, usuario: { ...sessao.usuario, ...usuario } }, sessao.lembrar);
}

export function encerrarSessao() {
    apagarTudo();
    avisarMudanca();
}

export function paginaDoNivel(nivel) {
    return { admin: 'admin.html', vendedor: 'vendedor.html', comprador: 'conta.html' }[nivel] || 'index.html';
}

/** Só aceita voltar para páginas da própria loja (evita redirecionar para sites externos). */
export function destinoSeguro(valor) {
    return valor && /^[a-z0-9-]+\.html([?#][^\s]*)?$/i.test(valor) ? valor : null;
}

export function enderecoAtual() {
    const pagina = window.location.pathname.split('/').pop() || 'index.html';
    return pagina + window.location.search + window.location.hash;
}

/** Protege uma página: sem login vai para o login; nível errado vai para o painel certo. */
export function exigirLogin(...niveis) {
    const sessao = obterSessao();
    if (!sessao) {
        window.location.replace('login.html?voltar=' + encodeURIComponent(enderecoAtual()));
        return null;
    }
    if (niveis.length && !niveis.includes(sessao.usuario.nivel)) {
        window.location.replace(paginaDoNivel(sessao.usuario.nivel));
        return null;
    }
    return sessao;
}
