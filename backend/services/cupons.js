// Regras de cupom, usadas na prévia do carrinho e de novo, com bloqueio, no checkout.
const { centavos, percentual } = require('../utils/dinheiro');
const { erros } = require('../utils/erros');

const TETO_DO_DESCONTO = 0.9; // nenhum cupom cobre mais de 90% dos produtos

function formatarReais(valorEmCentavos) {
    return 'R$ ' + (valorEmCentavos / 100).toFixed(2).replace('.', ',');
}

/**
 * Confere se o cupom pode ser usado e calcula o desconto em centavos.
 * @param executor  pool ou conexão da transação
 * @param bloquear  true no checkout: trava a linha do cupom (FOR UPDATE) até o commit
 */
async function avaliarCupom(executor, { codigo, usuarioId = null, subtotalCentavos, bloquear = false }) {
    const [linhas] = await executor.execute(
        `SELECT * FROM cupons WHERE codigo = ?${bloquear ? ' FOR UPDATE' : ''}`,
        [String(codigo).trim().toUpperCase()]
    );
    const cupom = linhas[0];
    if (!cupom || !cupom.ativo) throw erros.naoEncontrado('Cupom não encontrado ou desativado.');
    const agora = new Date();
    if (new Date(cupom.inicio) > agora) throw erros.requisicao('Este cupom ainda não começou a valer.', { campo: 'cupom' });
    if (new Date(cupom.fim) < agora) throw erros.requisicao('Este cupom expirou.', { campo: 'cupom' });
    if (cupom.limite_uso !== null && cupom.usos >= cupom.limite_uso) throw erros.conflito('Este cupom já atingiu o limite de usos.', { campo: 'cupom' });
    const minimo = centavos(cupom.valor_minimo);
    if (subtotalCentavos < minimo) {
        throw erros.requisicao(`Este cupom vale para compras a partir de ${formatarReais(minimo)}.`, { campo: 'cupom' });
    }
    if (usuarioId) {
        if (cupom.uso_unico_por_cliente) {
            const [usos] = await executor.execute('SELECT 1 FROM cupom_usos WHERE cupom_id = ? AND usuario_id = ? LIMIT 1', [cupom.id, usuarioId]);
            if (usos.length) throw erros.conflito('Você já usou este cupom.', { campo: 'cupom' });
        }
        if (cupom.primeira_compra) {
            const [compras] = await executor.execute("SELECT 1 FROM pedidos WHERE comprador_id = ? AND status <> 'cancelado' LIMIT 1", [usuarioId]);
            if (compras.length) throw erros.conflito('Este cupom é válido apenas na primeira compra.', { campo: 'cupom' });
        }
    }
    let desconto = cupom.tipo === 'percentual' ? percentual(subtotalCentavos, Number(cupom.valor)) : centavos(cupom.valor);
    if (cupom.desconto_maximo !== null) desconto = Math.min(desconto, centavos(cupom.desconto_maximo));
    desconto = Math.min(desconto, Math.floor(subtotalCentavos * TETO_DO_DESCONTO));
    return { cupom, descontoCentavos: desconto };
}

module.exports = { avaliarCupom };
