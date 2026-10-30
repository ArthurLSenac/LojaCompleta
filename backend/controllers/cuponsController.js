// Cupons: validação para clientes e CRUD para a administração.
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { decimal, centavos } = require('../utils/dinheiro');
const { avaliarCupom } = require('../services/cupons');
const { registrarAuditoria } = require('../services/auditoria');
const { FROM_PRODUTO, VISIVEL } = require('../utils/produtos');

async function subtotalDosItens(itens) {
    if (!Array.isArray(itens) || itens.length === 0 || itens.length > 30) throw erros.requisicao('Envie os itens da sacola.');
    let total = 0;
    for (const item of itens) {
        const produtoId = v.id(item && item.produto_id, 'o produto');
        const quantidade = v.inteiro(item && item.quantidade, 'a quantidade', { min: 1, max: 10 });
        const [linhas] = await pool.execute(`SELECT p.preco ${FROM_PRODUTO} WHERE p.id = ? AND ${VISIVEL}`, [produtoId]);
        if (linhas.length) total += centavos(linhas[0].preco) * quantidade;
    }
    return total;
}

// POST /api/cupons/validar — prévia do desconto (login opcional; com login, confere as regras pessoais).
async function validar(req, res) {
    const codigo = v.texto(req.body.codigo, 'o código do cupom', { max: 30, campo: 'cupom' }).toUpperCase();
    const subtotal = await subtotalDosItens(req.body.itens);
    const { cupom, descontoCentavos } = await avaliarCupom(pool, { codigo, usuarioId: req.usuario ? req.usuario.id : null, subtotalCentavos: subtotal });
    res.json({
        mensagem: `Cupom ${cupom.codigo} aplicado!`,
        cupom: { codigo: cupom.codigo, descricao: cupom.descricao, tipo: cupom.tipo, valor: cupom.valor },
        subtotal: decimal(subtotal),
        desconto: decimal(descontoCentavos)
    });
}

function validarCupom(corpo) {
    v.objeto(corpo);
    const dados = {
        codigo: v.texto(corpo.codigo, 'o código', { min: 3, max: 30, campo: 'codigo' }).toUpperCase(),
        descricao: v.texto(corpo.descricao, 'a descrição', { min: 5, max: 160, campo: 'descricao' }),
        tipo: v.opcao(corpo.tipo, 'o tipo', ['percentual', 'valor']),
        valor: v.dinheiro(corpo.valor, 'o valor do desconto', { min: 0.01, max: 100000, campo: 'valor' }),
        valorMinimo: v.dinheiro(corpo.valor_minimo ?? 0, 'o valor mínimo', { min: 0, campo: 'valor_minimo' }),
        descontoMaximo: v.dinheiro(corpo.desconto_maximo, 'o desconto máximo', { opcional: true, min: 0.01, campo: 'desconto_maximo' }),
        limiteUso: v.inteiro(corpo.limite_uso, 'o limite de usos', { opcional: true, min: 1, max: 1000000, campo: 'limite_uso' }),
        unico: v.booleano(corpo.uso_unico_por_cliente, 'o uso único', { padrao: true }),
        primeiraCompra: v.booleano(corpo.primeira_compra, 'a regra de primeira compra', { padrao: false }),
        inicio: v.dataHora(corpo.inicio, 'o início'),
        fim: v.dataHora(corpo.fim, 'o fim'),
        ativo: v.booleano(corpo.ativo, 'a situação', { padrao: true })
    };
    if (!/^[A-Z0-9]+$/.test(dados.codigo)) throw erros.requisicao('Use só letras e números no código, sem espaços.', { campo: 'codigo' });
    if (dados.tipo === 'percentual' && Number(dados.valor) > 90) throw erros.requisicao('Cupons percentuais vão até 90%.', { campo: 'valor' });
    if (dados.fim <= dados.inicio) throw erros.requisicao('O fim precisa ser depois do início.', { campo: 'fim' });
    return dados;
}

const formatar = (c) => ({ ...c, uso_unico_por_cliente: Boolean(c.uso_unico_por_cliente), primeira_compra: Boolean(c.primeira_compra), ativo: Boolean(c.ativo) });

// GET /api/cupons (admin)
async function listar(req, res) {
    const [cupons] = await pool.execute(
        `SELECT c.*, (SELECT COALESCE(SUM(o.desconto_cupom), 0) FROM pedidos o WHERE o.cupom_id = c.id AND o.status <> 'cancelado') AS desconto_concedido
           FROM cupons c ORDER BY c.ativo DESC, c.fim DESC`);
    res.json({ cupons: cupons.map(formatar) });
}

// POST /api/cupons (admin)
async function criar(req, res) {
    const d = validarCupom(req.body);
    try {
        const [resultado] = await pool.execute(
            `INSERT INTO cupons (codigo, descricao, tipo, valor, valor_minimo, desconto_maximo, limite_uso, uso_unico_por_cliente, primeira_compra, inicio, fim, ativo, criado_por)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [d.codigo, d.descricao, d.tipo, d.valor, d.valorMinimo, d.descontoMaximo, d.limiteUso, d.unico, d.primeiraCompra, d.inicio, d.fim, d.ativo, req.usuario.id]);
        await registrarAuditoria({ req, acao: 'cupom_criado', entidade: 'cupons', entidadeId: resultado.insertId, detalhes: { codigo: d.codigo } });
        res.status(201).json({ mensagem: `Cupom ${d.codigo} criado.`, id: resultado.insertId });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') throw erros.conflito('Já existe um cupom com esse código.', { campo: 'codigo' });
        throw erro;
    }
}

// PUT /api/cupons/:id (admin)
async function atualizar(req, res) {
    const id = v.id(req.params.id, 'o cupom');
    const d = validarCupom(req.body);
    try {
        const [resultado] = await pool.execute(
            `UPDATE cupons SET codigo = ?, descricao = ?, tipo = ?, valor = ?, valor_minimo = ?, desconto_maximo = ?, limite_uso = ?,
                    uso_unico_por_cliente = ?, primeira_compra = ?, inicio = ?, fim = ?, ativo = ? WHERE id = ?`,
            [d.codigo, d.descricao, d.tipo, d.valor, d.valorMinimo, d.descontoMaximo, d.limiteUso, d.unico, d.primeiraCompra, d.inicio, d.fim, d.ativo, id]);
        if (!resultado.affectedRows) throw erros.naoEncontrado('Cupom não encontrado.');
        await registrarAuditoria({ req, acao: 'cupom_atualizado', entidade: 'cupons', entidadeId: id, detalhes: { codigo: d.codigo, ativo: d.ativo } });
        res.json({ mensagem: 'Cupom atualizado.' });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') throw erros.conflito('Já existe um cupom com esse código.', { campo: 'codigo' });
        throw erro;
    }
}

// DELETE /api/cupons/:id (admin) — cupom já usado só pode ser desativado (os pedidos apontam para ele).
async function excluir(req, res) {
    const id = v.id(req.params.id, 'o cupom');
    const [[uso]] = await pool.execute('SELECT COUNT(*) AS total FROM pedidos WHERE cupom_id = ?', [id]);
    if (uso.total > 0) throw erros.conflito('Este cupom já foi usado em pedidos. Desative-o em vez de excluir.');
    const [resultado] = await pool.execute('DELETE FROM cupons WHERE id = ?', [id]);
    if (!resultado.affectedRows) throw erros.naoEncontrado('Cupom não encontrado.');
    await registrarAuditoria({ req, acao: 'cupom_excluido', entidade: 'cupons', entidadeId: id });
    res.json({ mensagem: 'Cupom excluído.' });
}

module.exports = { validar, listar, criar, atualizar, excluir, subtotalDosItens };
