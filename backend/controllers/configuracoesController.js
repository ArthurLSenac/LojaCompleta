// Configurações ajustáveis pela administração (frete grátis, Pix, parcelas, avisos...).
const { transacao } = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { carregar, limparCache } = require('../services/configuracoes');
const { registrarAuditoria } = require('../services/auditoria');

// Regras de validação por chave: a API nunca grava um valor fora da faixa.
const REGRAS = {
    frete_gratis_minimo: (valor) => v.dinheiro(valor, 'o valor mínimo para frete grátis', { min: 0, max: 10000 }),
    desconto_pix_percentual: (valor) => String(v.inteiro(valor, 'o desconto do Pix', { min: 0, max: 30 })),
    parcelas_sem_juros: (valor) => String(v.inteiro(valor, 'as parcelas sem juros', { min: 1, max: 12 })),
    parcela_minima: (valor) => v.dinheiro(valor, 'a parcela mínima', { min: 5, max: 1000 }),
    aviso_topo: (valor) => v.texto(valor, 'os avisos do topo', { min: 0, max: 300, opcional: true }) || '',
    loja_em_manutencao: (valor) => String(v.booleano(valor, 'o modo manutenção')),
    estoque_baixo: (valor) => String(v.inteiro(valor, 'o limite de estoque baixo', { min: 1, max: 100 })),
    limite_perguntas_abertas: (valor) => String(v.inteiro(valor, 'o limite de perguntas abertas', { min: 1, max: 20 }))
};

// GET /api/configuracoes/publicas
async function publicas(req, res) {
    const { linhas, valores } = await carregar();
    const resposta = {};
    for (const linha of linhas.filter((l) => l.publica)) resposta[linha.chave] = valores[linha.chave];
    resposta.aviso_topo = String(resposta.aviso_topo || '').split('|').map((t) => t.trim()).filter(Boolean);
    res.json(resposta);
}

// GET /api/configuracoes (admin)
async function listar(req, res) {
    const { linhas, valores } = await carregar({ forcar: true });
    res.json({ configuracoes: linhas.map((l) => ({ chave: l.chave, valor: valores[l.chave], tipo: l.tipo, descricao: l.descricao, publica: Boolean(l.publica), atualizado_em: l.atualizado_em })) });
}

// PUT /api/configuracoes (admin)  { chave: valor, ... }
async function atualizar(req, res) {
    v.objeto(req.body);
    const entradas = Object.entries(req.body);
    if (!entradas.length) throw erros.requisicao('Envie ao menos uma configuração.');
    // Valida tudo antes de gravar: ou todas as mudanças entram, ou nenhuma.
    const validadas = entradas.map(([chave, valor]) => {
        if (!REGRAS[chave]) throw erros.requisicao(`Configuração desconhecida: ${chave}.`);
        return [chave, REGRAS[chave](valor)];
    });
    await transacao(async (conexao) => {
        for (const [chave, valor] of validadas) {
            await conexao.execute('UPDATE configuracoes SET valor = ? WHERE chave = ?', [valor, chave]);
        }
    });
    const alteradas = validadas.map(([chave]) => chave);
    limparCache();
    await registrarAuditoria({ req, acao: 'configuracoes_alteradas', entidade: 'configuracoes', detalhes: { chaves: alteradas, valores: req.body } });
    res.json({ mensagem: 'Configurações salvas.', alteradas });
}

module.exports = { publicas, listar, atualizar };
