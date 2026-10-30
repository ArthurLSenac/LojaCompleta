// Dinheiro é calculado em centavos (números inteiros) para evitar erros como 0.1 + 0.2.
// O MySQL devolve DECIMAL como texto ("199.90"); convertemos sem passar por float.

function centavos(valor) {
    const texto = typeof valor === 'number' ? valor.toFixed(2) : String(valor).trim();
    if (!/^\d+(\.\d{1,2})?$/.test(texto)) {
        throw new TypeError('Valor monetário inválido: ' + texto);
    }
    const [inteiro, fracao = ''] = texto.split('.');
    return Number(inteiro) * 100 + Number(fracao.padEnd(2, '0'));
}

function decimal(valorEmCentavos) {
    return (valorEmCentavos / 100).toFixed(2);
}

function percentual(valorEmCentavos, porcentagem) {
    // Arredonda para baixo: o desconto nunca passa do percentual anunciado.
    return Math.floor((valorEmCentavos * porcentagem) / 100);
}

module.exports = { centavos, decimal, percentual };
