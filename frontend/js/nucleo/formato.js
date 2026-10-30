// Formatação para o português do Brasil.
const moedaBR = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const numeroBR = new Intl.NumberFormat('pt-BR');
const dataCurta = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
const dataHoraBR = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const relativoBR = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

export const moeda = (valor) => moedaBR.format(Number(valor) || 0);
export const numero = (valor) => numeroBR.format(Number(valor) || 0);
export const data = (valor) => dataCurta.format(new Date(valor)).replace(/ de /g, ' ').replace('.', '');
export const dataHora = (valor) => dataHoraBR.format(new Date(valor)).replace(/ de /g, ' ').replace('.', '');

/** Valor em centavos a partir de "199.90" (evita somas com ponto flutuante). */
export function centavos(valor) {
    const [inteiro, fracao = ''] = String(valor).split('.');
    return Number(inteiro) * 100 + Number(fracao.padEnd(2, '0').slice(0, 2));
}
export const deCentavos = (valor) => (valor / 100).toFixed(2);

/** "349.90" -> { inteiro: '349', centavos: '90' } para o preço em destaque. */
export function partesPreco(valor) {
    const [inteiro, decimais] = Number(valor).toFixed(2).split('.');
    return { inteiro: numeroBR.format(Number(inteiro)), centavos: decimais };
}

export function relativo(valor) {
    const segundos = (new Date(valor).getTime() - Date.now()) / 1000;
    const unidades = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
    for (const [unidade, tamanho] of unidades) {
        if (Math.abs(segundos) >= tamanho) return relativoBR.format(Math.round(segundos / tamanho), unidade);
    }
    return 'agora mesmo';
}

export const cep = (valor) => String(valor || '').replace(/\D/g, '').replace(/^(\d{5})(\d{3})$/, '$1-$2');
export const plural = (quantidade, singular, pluralTexto) => `${numero(quantidade)} ${quantidade === 1 ? singular : pluralTexto}`;
export const iniciais = (nome) => String(nome || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase();
export const primeiroNome = (nome) => String(nome || '').trim().split(/\s+/)[0];

export const STATUS_PEDIDO = {
    aguardando_pagamento: 'Aguardando pagamento',
    pago: 'Pago',
    em_separacao: 'Em separação',
    enviado: 'Enviado',
    entregue: 'Entregue',
    cancelado: 'Cancelado'
};
export const PAGAMENTOS = { pix: 'Pix', cartao: 'Cartão de crédito', boleto: 'Boleto' };
export const NIVEIS = { admin: 'Administrador', vendedor: 'Vendedor', comprador: 'Comprador' };

export function descontoPercentual(preco, original) {
    if (!original) return 0;
    return Math.round((1 - Number(preco) / Number(original)) * 100);
}
