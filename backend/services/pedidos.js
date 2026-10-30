// Regras de negócio dos pedidos: criação (checkout) e mudanças de status.
// Tudo que mexe em dinheiro ou estoque acontece dentro de uma transação.
const crypto = require('node:crypto');
const { transacao } = require('../database/conexao');
const { centavos, decimal, percentual } = require('../utils/dinheiro');
const { erros } = require('../utils/erros');
const v = require('../utils/validacao');
const { calcularFrete } = require('./frete');
const { avaliarCupom } = require('./cupons');
const { obterValores } = require('./configuracoes');
const { registrarAuditoria } = require('./auditoria');

const STATUS = ['aguardando_pagamento', 'pago', 'em_separacao', 'enviado', 'entregue', 'cancelado'];
const ROTULOS = {
    aguardando_pagamento: 'Aguardando pagamento', pago: 'Pago', em_separacao: 'Em separação',
    enviado: 'Enviado', entregue: 'Entregue', cancelado: 'Cancelado'
};
// Máquina de estados: de cada status, para quais é possível ir.
const TRANSICOES = {
    aguardando_pagamento: ['pago', 'cancelado'],
    pago: ['em_separacao', 'cancelado'],
    em_separacao: ['enviado', 'cancelado'],
    enviado: ['entregue'],
    entregue: [],
    cancelado: []
};
const TEXTOS = {
    pago: 'Pagamento confirmado.',
    em_separacao: 'A loja está separando os produtos.',
    enviado: 'Pedido enviado.',
    entregue: 'Pedido entregue. Aproveite!',
    cancelado: 'Pedido cancelado. O estoque foi devolvido.'
};
const RASTREIO = /^[A-Z]{2}\d{9}[A-Z]{2}$/; // padrão dos Correios, ex.: QB123456789BR

function gerarCodigo() {
    const alfabeto = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // sem 0/O e 1/I para não confundir
    return 'AMB-' + [...crypto.randomBytes(6)].map((byte) => alfabeto[byte % alfabeto.length]).join('');
}

function validarItens(itens) {
    if (!Array.isArray(itens) || itens.length === 0 || itens.length > 30) {
        throw erros.requisicao('Envie entre 1 e 30 produtos no pedido.');
    }
    const vistos = new Set();
    return itens.map((item) => {
        if (!item || typeof item !== 'object') throw erros.requisicao('Item do pedido inválido.');
        const produtoId = v.id(item.produto_id, 'o produto');
        const quantidade = v.inteiro(item.quantidade, 'a quantidade', { min: 1, max: 10 });
        if (vistos.has(produtoId)) throw erros.requisicao('Cada produto deve aparecer uma vez no pedido.');
        vistos.add(produtoId);
        return { produto_id: produtoId, quantidade };
    });
}

/** Trava e confere os produtos (em ordem de id, para evitar deadlock entre compras simultâneas). */
async function conferirProdutos(conexao, itens) {
    const ordenados = [...itens].sort((a, b) => a.produto_id - b.produto_id);
    const conferidos = [];
    for (const item of ordenados) {
        const [linhas] = await conexao.execute(
            `SELECT p.id, p.nome, p.preco, p.estoque, p.imagem, p.vendedor_id, p.frete_gratis, p.ativo,
                    l.ativa AS loja_ativa, vend.status AS vendedor_status, c.ativa AS categoria_ativa
               FROM produtos p
               JOIN lojas l ON l.usuario_id = p.vendedor_id
               JOIN usuarios vend ON vend.id = p.vendedor_id
               JOIN categorias c ON c.id = p.categoria_id
              WHERE p.id = ? FOR UPDATE`,
            [item.produto_id]
        );
        const produto = linhas[0];
        if (!produto || !produto.ativo || !produto.loja_ativa || produto.vendedor_status !== 'ativo' || !produto.categoria_ativa) {
            throw erros.conflito('Um produto da sacola não está mais disponível. Atualize a sacola e tente de novo.', { produto_id: item.produto_id });
        }
        if (produto.estoque < item.quantidade) {
            throw erros.conflito(`Estoque insuficiente para ${produto.nome}. Disponível: ${produto.estoque}.`, { produto_id: produto.id, disponivel: produto.estoque });
        }
        const preco = centavos(produto.preco); // o preço vem do banco, nunca do navegador
        conferidos.push({ produto, quantidade: item.quantidade, preco, subtotal: preco * item.quantidade });
    }
    return conferidos;
}

/** Calcula todos os valores do pedido em centavos. Usado no checkout. */
async function calcularValores(conexao, { conferidos, cupomCodigo, usuarioId, cep, modalidade, formaPagamento, config, bloquearCupom }) {
    const subtotal = conferidos.reduce((soma, item) => soma + item.subtotal, 0);
    if (subtotal > 99999999) throw erros.requisicao('O valor do pedido excede o limite permitido.');
    let descontoCupom = 0;
    let cupom = null;
    if (cupomCodigo) {
        const resultado = await avaliarCupom(conexao, { codigo: cupomCodigo, usuarioId, subtotalCentavos: subtotal, bloquear: bloquearCupom });
        cupom = resultado.cupom;
        descontoCupom = resultado.descontoCentavos;
    }
    const base = subtotal - descontoCupom;
    const frete = calcularFrete({
        cep,
        quantidadeItens: conferidos.reduce((soma, item) => soma + item.quantidade, 0),
        valorProdutosCentavos: base,
        todosFreteGratis: conferidos.every((item) => item.produto.frete_gratis),
        freteGratisMinimoCentavos: centavos(config.frete_gratis_minimo)
    });
    const opcao = frete.opcoes.find((o) => o.modalidade === modalidade);
    const descontoPix = formaPagamento === 'pix' ? percentual(base, config.desconto_pix_percentual) : 0;
    const total = base - descontoPix + opcao.valor;
    return { subtotal, descontoCupom, cupom, descontoPix, frete: opcao, total, regiao: frete.regiao };
}

function parcelasMaximas(totalCentavos, config) {
    return Math.max(1, Math.min(config.parcelas_sem_juros, Math.floor(totalCentavos / centavos(config.parcela_minima))));
}

async function criarPedido({ usuario, corpo, req }) {
    const config = await obterValores();
    if (config.loja_em_manutencao) throw erros.indisponivel('A loja está em manutenção. Novas compras voltam em breve.');
    const itens = validarItens(corpo.itens);
    const enderecoId = v.id(corpo.endereco_id, 'o endereço de entrega');
    const modalidade = v.opcao(corpo.frete_modalidade, 'a entrega', ['economica', 'expressa']);
    const formaPagamento = v.opcao(corpo.forma_pagamento, 'a forma de pagamento', ['pix', 'cartao', 'boleto']);
    const parcelas = formaPagamento === 'cartao' ? v.inteiro(corpo.parcelas ?? 1, 'o número de parcelas', { min: 1, max: 12 }) : 1;
    const cupomCodigo = v.texto(corpo.cupom, 'o cupom', { opcional: true, max: 30 });

    const resultado = await transacao(async (conexao) => {
        const [enderecos] = await conexao.execute('SELECT * FROM enderecos WHERE id = ? AND usuario_id = ?', [enderecoId, usuario.id]);
        if (!enderecos.length) throw erros.naoEncontrado('Escolha um endereço de entrega válido.');
        const endereco = enderecos[0];

        const conferidos = await conferirProdutos(conexao, itens);
        const valores = await calcularValores(conexao, {
            conferidos, cupomCodigo, usuarioId: usuario.id, cep: endereco.cep, modalidade, formaPagamento, config, bloquearCupom: true
        });
        if (formaPagamento === 'cartao' && parcelas > parcelasMaximas(valores.total, config)) {
            throw erros.requisicao(`Para este valor, o parcelamento vai até ${parcelasMaximas(valores.total, config)}x sem juros.`, { campo: 'parcelas' });
        }
        const status = formaPagamento === 'cartao' ? 'pago' : 'aguardando_pagamento';

        let pedidoId;
        let codigo;
        for (let tentativa = 1; ; tentativa++) {
            codigo = gerarCodigo();
            try {
                const [inserido] = await conexao.execute(
                    `INSERT INTO pedidos (codigo, comprador_id, status, forma_pagamento, parcelas, subtotal, desconto_cupom, desconto_pix,
                        frete, total, cupom_id, frete_modalidade, prazo_dias, entrega_destinatario, entrega_cep, entrega_logradouro,
                        entrega_numero, entrega_complemento, entrega_bairro, entrega_cidade, entrega_uf)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [codigo, usuario.id, status, formaPagamento, parcelas, decimal(valores.subtotal), decimal(valores.descontoCupom),
                        decimal(valores.descontoPix), decimal(valores.frete.valor), decimal(valores.total), valores.cupom ? valores.cupom.id : null,
                        modalidade, valores.frete.prazo_dias, endereco.destinatario, endereco.cep, endereco.logradouro, endereco.numero,
                        endereco.complemento, endereco.bairro, endereco.cidade, endereco.uf]
                );
                pedidoId = inserido.insertId;
                break;
            } catch (erro) {
                // Colisão de código é raríssima; a falha de uma instrução não desfaz a transação.
                if (erro.code !== 'ER_DUP_ENTRY' || tentativa >= 5) throw erro;
            }
        }

        for (const item of conferidos) {
            await conexao.execute(
                `INSERT INTO pedido_itens (pedido_id, produto_id, vendedor_id, produto_nome, produto_imagem, quantidade, preco_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [pedidoId, item.produto.id, item.produto.vendedor_id, item.produto.nome, item.produto.imagem, item.quantidade, decimal(item.preco), decimal(item.subtotal)]
            );
            // Atualização condicional: mesmo com o lock, o estoque nunca fica negativo.
            const [baixa] = await conexao.execute(
                'UPDATE produtos SET estoque = estoque - ?, total_vendido = total_vendido + ? WHERE id = ? AND estoque >= ?',
                [item.quantidade, item.quantidade, item.produto.id, item.quantidade]
            );
            if (baixa.affectedRows !== 1) throw erros.conflito('O estoque mudou durante a compra. Atualize a sacola e tente de novo.');
        }

        if (valores.cupom) {
            await conexao.execute('INSERT INTO cupom_usos (cupom_id, usuario_id, pedido_id) VALUES (?, ?, ?)', [valores.cupom.id, usuario.id, pedidoId]);
            await conexao.execute('UPDATE cupons SET usos = usos + 1 WHERE id = ?', [valores.cupom.id]);
        }

        await conexao.execute(
            'INSERT INTO pedido_historico (pedido_id, status, observacao, usuario_id) VALUES (?, ?, ?, ?)',
            [pedidoId, 'aguardando_pagamento', 'Pedido criado. Aguardando confirmação do pagamento.', usuario.id]
        );
        if (status === 'pago') {
            await conexao.execute(
                'INSERT INTO pedido_historico (pedido_id, status, observacao, usuario_id) VALUES (?, ?, ?, ?)',
                [pedidoId, 'pago', `Pagamento aprovado no cartão em ${parcelas}x sem juros (simulação).`, usuario.id]
            );
        }
        await registrarAuditoria({ executor: conexao, req, acao: 'pedido_criado', entidade: 'pedidos', entidadeId: pedidoId, detalhes: { codigo, total: decimal(valores.total) } });

        return {
            id: pedidoId, codigo, status, forma_pagamento: formaPagamento, parcelas,
            subtotal: decimal(valores.subtotal), desconto_cupom: decimal(valores.descontoCupom), desconto_pix: decimal(valores.descontoPix),
            frete: decimal(valores.frete.valor), total: decimal(valores.total), prazo_dias: valores.frete.prazo_dias
        };
    });
    return resultado;
}

/**
 * Muda o status respeitando a máquina de estados e o perfil de quem pede.
 * Cancelar devolve o estoque e libera o uso do cupom, tudo na mesma transação.
 */
async function mudarStatus({ pedidoId, novoStatus, usuario, codigoRastreio, observacao, req }) {
    v.opcao(novoStatus, 'o novo status', STATUS);
    return transacao(async (conexao) => {
        const [linhas] = await conexao.execute('SELECT * FROM pedidos WHERE id = ? FOR UPDATE', [pedidoId]);
        const pedido = linhas[0];
        if (!pedido) throw erros.naoEncontrado('Pedido não encontrado.');

        if (usuario.nivel === 'comprador') {
            if (pedido.comprador_id !== usuario.id) throw erros.proibido('Você só pode alterar os seus pedidos.');
            const podeCancelar = novoStatus === 'cancelado' && ['aguardando_pagamento', 'pago'].includes(pedido.status);
            const podePagar = novoStatus === 'pago' && pedido.status === 'aguardando_pagamento' && ['pix', 'boleto'].includes(pedido.forma_pagamento);
            if (!podeCancelar && !podePagar) {
                if (novoStatus === 'cancelado') throw erros.conflito('Este pedido já está com a loja e não pode mais ser cancelado por aqui. Fale com a loja.');
                throw erros.proibido('Esta mudança é feita pela loja ou pela administração.');
            }
        } else if (usuario.nivel === 'vendedor') {
            const [donos] = await conexao.execute('SELECT DISTINCT vendedor_id FROM pedido_itens WHERE pedido_id = ?', [pedidoId]);
            if (!donos.some((d) => d.vendedor_id === usuario.id)) throw erros.naoEncontrado('Pedido não encontrado.');
            if (donos.length > 1) throw erros.proibido('Este pedido tem produtos de outras lojas e é atualizado pela administração.');
            if (!['em_separacao', 'enviado', 'entregue', 'cancelado'].includes(novoStatus)) {
                throw erros.proibido('A confirmação de pagamento é feita pelo sistema de pagamento.');
            }
        }

        if (!TRANSICOES[pedido.status].includes(novoStatus)) {
            throw erros.conflito(`Não é possível mudar de "${ROTULOS[pedido.status]}" para "${ROTULOS[novoStatus]}".`);
        }

        let rastreio = pedido.codigo_rastreio;
        if (novoStatus === 'enviado') {
            rastreio = String(codigoRastreio || '').trim().toUpperCase();
            if (!RASTREIO.test(rastreio)) throw erros.requisicao('Informe o código de rastreio no formato AA123456789BR.', { campo: 'codigo_rastreio' });
        }
        const nota = v.texto(observacao, 'a observação', { opcional: true, max: 150 });

        if (novoStatus === 'cancelado') {
            const [itens] = await conexao.execute('SELECT produto_id, quantidade FROM pedido_itens WHERE pedido_id = ? ORDER BY produto_id', [pedidoId]);
            for (const item of itens) {
                await conexao.execute(
                    'UPDATE produtos SET estoque = estoque + ?, total_vendido = IF(total_vendido >= ?, total_vendido - ?, 0) WHERE id = ?',
                    [item.quantidade, item.quantidade, item.quantidade, item.produto_id]
                );
            }
            if (pedido.cupom_id) {
                await conexao.execute('DELETE FROM cupom_usos WHERE pedido_id = ?', [pedidoId]);
                await conexao.execute('UPDATE cupons SET usos = IF(usos > 0, usos - 1, 0) WHERE id = ?', [pedido.cupom_id]);
            }
        }

        await conexao.execute('UPDATE pedidos SET status = ?, codigo_rastreio = ? WHERE id = ?', [novoStatus, rastreio, pedidoId]);
        let texto = TEXTOS[novoStatus];
        if (novoStatus === 'pago' && usuario.nivel === 'comprador') texto = `Pagamento via ${pedido.forma_pagamento === 'pix' ? 'Pix' : 'boleto'} confirmado (simulação).`;
        if (novoStatus === 'enviado') texto += ` Código de rastreio: ${rastreio}.`;
        if (novoStatus === 'cancelado' && usuario.nivel === 'comprador') texto = 'Pedido cancelado por você. O estoque foi devolvido.';
        if (nota) texto += ' ' + nota;
        await conexao.execute(
            'INSERT INTO pedido_historico (pedido_id, status, observacao, usuario_id) VALUES (?, ?, ?, ?)',
            [pedidoId, novoStatus, texto.slice(0, 200), usuario.id]
        );
        await registrarAuditoria({ executor: conexao, req, acao: 'pedido_status', entidade: 'pedidos', entidadeId: pedidoId, detalhes: { codigo: pedido.codigo, de: pedido.status, para: novoStatus } });
        return { status: novoStatus, codigo_rastreio: rastreio };
    });
}

module.exports = { criarPedido, mudarStatus, conferirProdutos, calcularValores, parcelasMaximas, STATUS, ROTULOS, TRANSICOES };
