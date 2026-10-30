// Configurações públicas da loja (frete grátis, desconto no Pix, parcelas...).
// Vêm da API uma vez por página; se ela não responder, usamos valores padrão.
import { api } from './api.js';

const PADRAO = {
    frete_gratis_minimo: 199,
    desconto_pix_percentual: 5,
    parcelas_sem_juros: 10,
    parcela_minima: 20,
    aviso_topo: ['Frete grátis acima de R$ 199', '5% de desconto no Pix', 'Cupom BEMVINDO10 na primeira compra'],
    loja_em_manutencao: false
};

let pedido = null;

export function obterConfig() {
    if (!pedido) {
        pedido = api('/configuracoes/publicas')
            .then((dados) => ({ ...PADRAO, ...dados }))
            .catch(() => ({ ...PADRAO }));
    }
    return pedido;
}

/** Simulações exibidas no catálogo (a API recalcula tudo no checkout). */
export function precoPix(preco, config) {
    const total = Math.round(Number(preco) * 100);
    return (total - Math.floor((total * config.desconto_pix_percentual) / 100)) / 100;
}

export function parcelamento(preco, config) {
    const valor = Number(preco);
    const vezes = Math.max(1, Math.min(config.parcelas_sem_juros, Math.floor(valor / config.parcela_minima)));
    return { vezes, valor: Math.floor((valor * 100) / vezes) / 100 };
}
