// Pequenos ajudantes para manipular o DOM sem innerHTML.
// Texto vindo da API sempre entra como textContent: nunca é interpretado como HTML.

/**
 * Cria um elemento.
 * el('a', { classe: 'link', href: '/x', texto: 'Ver', ao: { click: fn } }, [filhos])
 */
export function el(tag, props = {}, filhos = []) {
    const no = document.createElement(tag);
    for (const [chave, valor] of Object.entries(props)) {
        if (valor === undefined || valor === null || valor === false) continue;
        if (chave === 'classe') no.className = valor;
        else if (chave === 'texto') no.textContent = valor;
        else if (chave === 'attrs') for (const [nome, v] of Object.entries(valor)) { if (v !== undefined && v !== null && v !== false) no.setAttribute(nome, v === true ? '' : v); }
        else if (chave === 'dados') Object.assign(no.dataset, valor);
        else if (chave === 'ao') for (const [evento, funcao] of Object.entries(valor)) no.addEventListener(evento, funcao);
        else if (chave === 'estilo') for (const [prop, v] of Object.entries(valor)) no.style.setProperty(prop, v);
        else if (chave in no) no[chave] = valor;
        else no.setAttribute(chave, valor);
    }
    const lista = Array.isArray(filhos) ? filhos : [filhos];
    for (const filho of lista.flat()) {
        if (filho === null || filho === undefined || filho === false) continue;
        no.append(filho instanceof Node ? filho : document.createTextNode(String(filho)));
    }
    return no;
}

export const $ = (seletor, raiz = document) => raiz.querySelector(seletor);
export const $$ = (seletor, raiz = document) => [...raiz.querySelectorAll(seletor)];

export function debounce(funcao, espera = 250) {
    let temporizador;
    return function adiada(...argumentos) {
        clearTimeout(temporizador);
        temporizador = setTimeout(() => funcao.apply(this, argumentos), espera);
    };
}

export function parametros() {
    return new URLSearchParams(window.location.search);
}

/** localStorage com proteção: em janelas privadas ou bloqueadas, apenas não guarda. */
export function ler(chave, padrao = null) {
    try {
        const valor = localStorage.getItem(chave);
        return valor === null ? padrao : JSON.parse(valor);
    } catch (erro) {
        return padrao;
    }
}

export function guardar(chave, valor) {
    try {
        localStorage.setItem(chave, JSON.stringify(valor));
    } catch (erro) {
        /* armazenamento indisponível */
    }
}

export function remover(chave) {
    try { localStorage.removeItem(chave); } catch (erro) { /* ignorar */ }
}

/** Liga/desliga um estado "carregando" visual em um botão enquanto a promessa roda. */
export async function comCarregamento(botao, tarefa) {
    if (!botao) return tarefa();
    botao.disabled = true;
    botao.classList.add('carregando');
    botao.setAttribute('aria-busy', 'true');
    try {
        return await tarefa();
    } finally {
        botao.disabled = false;
        botao.classList.remove('carregando');
        botao.removeAttribute('aria-busy');
    }
}

export const pausa = (ms) => new Promise((resolver) => setTimeout(resolver, ms));

export const reduzirMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
