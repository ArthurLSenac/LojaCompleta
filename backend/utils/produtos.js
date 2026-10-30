// Consulta base e formatação de produtos, compartilhadas por vários controllers.

const COLUNAS_PRODUTO = `p.id, p.nome, p.descricao, p.preco, p.preco_original, p.estoque, p.imagem, p.destaque,
        p.frete_gratis, p.ativo, p.avaliacao_media, p.total_avaliacoes, p.total_vendido, p.criado_em, p.atualizado_em,
        p.vendedor_id, c.id AS categoria_id, c.nome AS categoria_nome, c.slug AS categoria_slug, c.ativa AS categoria_ativa,
        l.id AS loja_id, l.nome AS loja_nome, l.slug AS loja_slug, l.cidade AS loja_cidade, l.uf AS loja_uf, l.cor AS loja_cor,
        l.ativa AS loja_ativa, vend.status AS vendedor_status`;

// JOINs trazem categoria, loja e vendedor sem consultas extras para cada produto.
const FROM_PRODUTO = `FROM produtos p
   JOIN categorias c ON c.id = p.categoria_id
   JOIN lojas l ON l.usuario_id = p.vendedor_id
   JOIN usuarios vend ON vend.id = p.vendedor_id`;

const SELECT_PRODUTO = `SELECT ${COLUNAS_PRODUTO} ${FROM_PRODUTO}`;

// Só aparece no catálogo o produto ativo, de loja ativa, categoria ativa e vendedor não bloqueado.
const VISIVEL = "p.ativo = 1 AND l.ativa = 1 AND c.ativa = 1 AND vend.status = 'ativo'";

function percentualDesconto(preco, original) {
    if (!original) return 0;
    return Math.round((1 - Number(preco) / Number(original)) * 100);
}

function visivel(linha) {
    return Boolean(linha.ativo && linha.loja_ativa && linha.categoria_ativa && linha.vendedor_status === 'ativo');
}

function formatarProduto(linha, { completo = false } = {}) {
    const produto = {
        id: linha.id,
        nome: linha.nome,
        preco: linha.preco,
        preco_original: linha.preco_original,
        desconto: percentualDesconto(linha.preco, linha.preco_original),
        estoque: linha.estoque,
        imagem: linha.imagem,
        destaque: Boolean(linha.destaque),
        frete_gratis: Boolean(linha.frete_gratis),
        ativo: Boolean(linha.ativo),
        avaliacao_media: Number(linha.avaliacao_media),
        total_avaliacoes: linha.total_avaliacoes,
        total_vendido: linha.total_vendido,
        criado_em: linha.criado_em,
        categoria: { id: linha.categoria_id, nome: linha.categoria_nome, slug: linha.categoria_slug },
        loja: { id: linha.loja_id, nome: linha.loja_nome, slug: linha.loja_slug, cidade: linha.loja_cidade, uf: linha.loja_uf, cor: linha.loja_cor }
    };
    if (completo) {
        produto.descricao = linha.descricao;
        produto.atualizado_em = linha.atualizado_em;
        produto.vendedor_id = linha.vendedor_id;
        produto.visivel = visivel(linha);
    }
    return produto;
}

module.exports = { COLUNAS_PRODUTO, FROM_PRODUTO, SELECT_PRODUTO, VISIVEL, formatarProduto, percentualDesconto, visivel };
