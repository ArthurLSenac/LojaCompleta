// Frete simulado: o valor depende da região do CEP (primeiro dígito) e da quantidade de itens.
// Não há integração com transportadoras; as tabelas abaixo são a regra de negócio da loja.

const REGIOES = {
    0: { nome: 'Grande São Paulo', economica: 1490, expressa: 2490, prazoEconomica: 3, prazoExpressa: 1 },
    1: { nome: 'Interior de São Paulo', economica: 1790, expressa: 2890, prazoEconomica: 4, prazoExpressa: 2 },
    2: { nome: 'Rio de Janeiro e Espírito Santo', economica: 1990, expressa: 3290, prazoEconomica: 5, prazoExpressa: 2 },
    3: { nome: 'Minas Gerais', economica: 1890, expressa: 3190, prazoEconomica: 5, prazoExpressa: 2 },
    4: { nome: 'Bahia e Sergipe', economica: 2490, expressa: 3990, prazoEconomica: 7, prazoExpressa: 3 },
    5: { nome: 'Pernambuco, Alagoas, Paraíba e Rio Grande do Norte', economica: 2690, expressa: 4290, prazoEconomica: 8, prazoExpressa: 3 },
    6: { nome: 'Ceará, Piauí, Maranhão e Região Norte', economica: 3290, expressa: 5490, prazoEconomica: 10, prazoExpressa: 4 },
    7: { nome: 'Centro-Oeste e Tocantins', economica: 2390, expressa: 3890, prazoEconomica: 6, prazoExpressa: 3 },
    8: { nome: 'Paraná e Santa Catarina', economica: 1990, expressa: 3290, prazoEconomica: 5, prazoExpressa: 2 },
    9: { nome: 'Rio Grande do Sul', economica: 2190, expressa: 3590, prazoEconomica: 6, prazoExpressa: 3 }
};

// Cada unidade além da primeira acrescenta um valor, com teto.
const ADICIONAL_POR_ITEM = 250;
const ADICIONAL_MAXIMO = 1500;

function normalizarCep(cep) {
    const digitos = String(cep || '').replace(/\D/g, '');
    return /^\d{8}$/.test(digitos) ? digitos : null;
}

/**
 * @param {object} dados
 * @param {string} dados.cep                       CEP com 8 dígitos
 * @param {number} dados.quantidadeItens           soma das quantidades do carrinho
 * @param {number} dados.valorProdutosCentavos     produtos já com desconto de cupom
 * @param {boolean} dados.todosFreteGratis         todos os produtos têm frete grátis
 * @param {number} dados.freteGratisMinimoCentavos valor mínimo para frete econômico grátis
 */
function calcularFrete({ cep, quantidadeItens, valorProdutosCentavos, todosFreteGratis, freteGratisMinimoCentavos }) {
    const cepLimpo = normalizarCep(cep);
    if (!cepLimpo) return null;
    const regiao = REGIOES[cepLimpo[0]];
    const adicional = Math.min(Math.max(quantidadeItens - 1, 0) * ADICIONAL_POR_ITEM, ADICIONAL_MAXIMO);
    const economicaGratis = todosFreteGratis || valorProdutosCentavos >= freteGratisMinimoCentavos;
    return {
        cep: cepLimpo,
        regiao: regiao.nome,
        opcoes: [
            {
                modalidade: 'economica',
                nome: 'Econômica',
                valor: economicaGratis ? 0 : regiao.economica + adicional,
                prazo_dias: regiao.prazoEconomica,
                gratis: economicaGratis
            },
            {
                modalidade: 'expressa',
                nome: 'Expressa',
                valor: regiao.expressa + adicional,
                prazo_dias: regiao.prazoExpressa,
                gratis: false
            }
        ]
    };
}

module.exports = { calcularFrete, normalizarCep, REGIOES };
