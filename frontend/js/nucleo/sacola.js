// Sacola de compras guardada no navegador (funciona também sem login).
// Guardamos só id, quantidade e uma "foto" do produto para exibir rápido.
// Na hora de comprar, a API ignora esses valores e consulta preço e estoque no banco.
import { ler, guardar } from './dom.js';
import { centavos } from './formato.js';

const CHAVE = 'ambar:sacola';
const MAXIMO_POR_ITEM = 10;

function avisarMudanca(detalhe = {}) {
    window.dispatchEvent(new CustomEvent('ambar:sacola', { detail: detalhe }));
}

function valido(item) {
    return item && Number.isSafeInteger(item.id) && item.id > 0 && Number.isSafeInteger(item.quantidade) && item.quantidade > 0 && item.produto;
}

export function lerSacola() {
    const itens = ler(CHAVE, []);
    return Array.isArray(itens) ? itens.filter(valido) : [];
}

function salvar(itens, detalhe) {
    guardar(CHAVE, itens);
    avisarMudanca(detalhe);
}

/** Cópia enxuta do produto vinda da API. */
export function retratoProduto(p) {
    return {
        nome: p.nome,
        preco: p.preco,
        preco_original: p.preco_original || null,
        imagem: p.imagem,
        estoque: p.estoque,
        frete_gratis: Boolean(p.frete_gratis),
        loja: p.loja ? p.loja.nome : (p.loja_nome || '')
    };
}

export function limiteDoItem(produto) {
    return Math.max(0, Math.min(MAXIMO_POR_ITEM, Number(produto.estoque) || 0));
}

export function adicionar(produto, quantidade = 1) {
    const itens = lerSacola();
    const existente = itens.find((item) => item.id === produto.id);
    const limite = limiteDoItem(produto);
    if (limite === 0) return { ok: false, mensagem: 'Este produto está esgotado no momento.' };
    const desejado = (existente ? existente.quantidade : 0) + quantidade;
    if (desejado > limite) {
        if (existente) existente.quantidade = limite;
        else itens.push({ id: produto.id, quantidade: limite, produto: retratoProduto(produto) });
        salvar(itens, { tipo: 'adicionar', id: produto.id });
        return { ok: true, limitado: true, mensagem: `Você pode levar até ${limite} unidade${limite > 1 ? 's' : ''} deste produto.` };
    }
    if (existente) {
        existente.quantidade = desejado;
        existente.produto = retratoProduto(produto);
    } else {
        itens.push({ id: produto.id, quantidade, produto: retratoProduto(produto) });
    }
    salvar(itens, { tipo: 'adicionar', id: produto.id });
    return { ok: true };
}

export function alterarQuantidade(id, quantidade) {
    const itens = lerSacola();
    const item = itens.find((i) => i.id === id);
    if (!item) return;
    item.quantidade = Math.max(1, Math.min(quantidade, limiteDoItem(item.produto) || 1));
    salvar(itens, { tipo: 'quantidade', id });
}

export function removerItem(id) {
    salvar(lerSacola().filter((item) => item.id !== id), { tipo: 'remover', id });
}

export function esvaziar() {
    salvar([], { tipo: 'esvaziar' });
}

export const totalItens = () => lerSacola().reduce((soma, item) => soma + item.quantidade, 0);
export const subtotalCentavos = (itens = lerSacola()) => itens.reduce((soma, item) => soma + centavos(item.produto.preco) * item.quantidade, 0);

/**
 * Atualiza os retratos com os dados atuais da API. Produtos que saíram do catálogo
 * são removidos e quantidades acima do estoque são ajustadas. Devolve o que mudou.
 */
export function sincronizar(produtosAtuais) {
    const mapa = new Map(produtosAtuais.map((p) => [p.id, p]));
    const mudancas = [];
    const itens = [];
    for (const item of lerSacola()) {
        const atual = mapa.get(item.id);
        if (!atual) { mudancas.push(`${item.produto.nome} não está mais disponível e saiu da sacola.`); continue; }
        if (atual.preco !== item.produto.preco) mudancas.push(`O preço de ${atual.nome} mudou.`);
        const limite = limiteDoItem(atual);
        if (limite === 0) { mudancas.push(`${atual.nome} esgotou e saiu da sacola.`); continue; }
        if (item.quantidade > limite) mudancas.push(`Ajustamos ${atual.nome} para ${limite} unidade${limite > 1 ? 's' : ''}, o estoque disponível.`);
        itens.push({ id: item.id, quantidade: Math.min(item.quantidade, limite), produto: retratoProduto(atual) });
    }
    salvar(itens, { tipo: 'sincronizar' });
    return mudancas;
}
