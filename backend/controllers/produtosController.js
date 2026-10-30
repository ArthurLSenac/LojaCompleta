// Produtos: catálogo público (com busca e filtros) e CRUD para vendedores e administração.
const pool = require('../database/conexao');
const { transacao } = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { escaparLike } = require('../utils/texto');
const { SELECT_PRODUTO, FROM_PRODUTO, VISIVEL, formatarProduto, visivel } = require('../utils/produtos');
const { registrarAuditoria } = require('../services/auditoria');
const { obterValores } = require('../services/configuracoes');

// ---------------------------------------------------------------------
// Catálogo público
// ---------------------------------------------------------------------
function filtrosDoCatalogo(query, ignorar = []) {
    const condicoes = [VISIVEL];
    const parametros = [];
    let termo = null;
    if (query.q !== undefined && query.q !== '') {
        termo = v.texto(query.q, 'a busca', { max: 80 });
        const palavras = termo.split(' ').filter((p) => p.length >= 2).slice(0, 6);
        for (const palavra of palavras) {
            const padrao = '%' + escaparLike(palavra) + '%';
            // A collation utf8mb4_unicode_ci ignora acentos: "cafe" encontra "Café".
            condicoes.push('(p.nome LIKE ? OR p.descricao LIKE ? OR c.nome LIKE ? OR l.nome LIKE ?)');
            parametros.push(padrao, padrao, padrao, padrao);
        }
    }
    if (query.categoria && !ignorar.includes('categoria')) { condicoes.push('c.slug = ?'); parametros.push(String(query.categoria)); }
    if (query.loja && !ignorar.includes('loja')) { condicoes.push('l.slug = ?'); parametros.push(String(query.loja)); }
    if (!ignorar.includes('preco')) {
        if (query.min !== undefined && query.min !== '') { condicoes.push('p.preco >= ?'); parametros.push(v.dinheiro(query.min, 'o preço mínimo', { min: 0 })); }
        if (query.max !== undefined && query.max !== '') { condicoes.push('p.preco <= ?'); parametros.push(v.dinheiro(query.max, 'o preço máximo', { min: 0 })); }
    }
    if (query.avaliacao) { condicoes.push('p.avaliacao_media >= ?'); parametros.push(v.inteiro(query.avaliacao, 'a avaliação mínima', { min: 1, max: 5 })); }
    if (query.desconto === '1') condicoes.push('p.preco_original IS NOT NULL');
    if (query.frete === '1') condicoes.push('p.frete_gratis = 1');
    if (query.estoque === '1') condicoes.push('p.estoque > 0');
    if (query.destaque === '1') condicoes.push('p.destaque = 1');
    if (query.ids) {
        const ids = String(query.ids).split(',').slice(0, 60).map((id) => v.id(id, 'o produto'));
        condicoes.push(`p.id IN (${ids.map(() => '?').join(', ')})`);
        parametros.push(...ids);
    }
    return { where: condicoes.join(' AND '), parametros, termo };
}

const ORDENS = {
    mais_vendidos: 'p.total_vendido DESC',
    menor_preco: 'p.preco ASC',
    maior_preco: 'p.preco DESC',
    avaliacao: 'p.avaliacao_media DESC, p.total_avaliacoes DESC',
    novidades: 'p.criado_em DESC',
    desconto: '(p.preco_original IS NULL), (p.preco_original - p.preco) / p.preco_original DESC'
};

// GET /api/produtos
async function listar(req, res) {
    const { pagina, limite, deslocamento } = v.paginacao(req.query, { limitePadrao: 24, limiteMaximo: 60 });
    const { where, parametros, termo } = filtrosDoCatalogo(req.query);
    const ordem = req.query.ordem || 'relevancia';
    let ordenacao;
    const parametrosOrdem = [];
    if (ordem === 'relevancia') {
        if (termo) {
            ordenacao = 'CASE WHEN p.nome LIKE ? THEN 0 WHEN p.nome LIKE ? THEN 1 ELSE 2 END, p.destaque DESC, p.total_vendido DESC';
            parametrosOrdem.push(escaparLike(termo) + '%', '%' + escaparLike(termo) + '%');
        } else {
            ordenacao = 'p.destaque DESC, p.total_vendido DESC';
        }
    } else {
        ordenacao = ORDENS[v.opcao(ordem, 'a ordenação', Object.keys(ORDENS).concat('relevancia'))];
    }
    // LIMIT/OFFSET vêm de inteiros já validados; os demais valores seguem como parâmetros "?".
    const [linhas] = await pool.execute(
        `${SELECT_PRODUTO} WHERE ${where} ORDER BY ${ordenacao}, p.id DESC LIMIT ${limite} OFFSET ${deslocamento}`,
        [...parametros, ...parametrosOrdem]
    );
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total ${FROM_PRODUTO} WHERE ${where}`, parametros);
    const resposta = { itens: linhas.map((linha) => formatarProduto(linha)), total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)) };

    if (req.query.facetas === '1') {
        const semCategoria = filtrosDoCatalogo(req.query, ['categoria']);
        const [categorias] = await pool.execute(
            `SELECT c.slug, c.nome, c.icone, COUNT(*) AS total ${FROM_PRODUTO} WHERE ${semCategoria.where}
             GROUP BY c.id, c.slug, c.nome, c.icone, c.ordem ORDER BY c.ordem`, semCategoria.parametros);
        const semLoja = filtrosDoCatalogo(req.query, ['loja']);
        const [lojas] = await pool.execute(
            `SELECT l.slug, l.nome, COUNT(*) AS total ${FROM_PRODUTO} WHERE ${semLoja.where}
             GROUP BY l.id, l.slug, l.nome ORDER BY total DESC, l.nome`, semLoja.parametros);
        const semPreco = filtrosDoCatalogo(req.query, ['preco']);
        const [[faixa]] = await pool.execute(`SELECT MIN(p.preco) AS minimo, MAX(p.preco) AS maximo ${FROM_PRODUTO} WHERE ${semPreco.where}`, semPreco.parametros);
        resposta.facetas = { categorias, lojas, preco: faixa };
    }
    res.json(resposta);
}

// GET /api/produtos/:id
async function detalhar(req, res) {
    const id = v.id(req.params.id, 'o produto');
    const [linhas] = await pool.execute(`${SELECT_PRODUTO} WHERE p.id = ?`, [id]);
    const linha = linhas[0];
    const gestor = req.usuario && linha && (req.usuario.nivel === 'admin' || req.usuario.id === linha.vendedor_id);
    if (!linha || (!visivel(linha) && !gestor)) throw erros.naoEncontrado('Produto não encontrado ou fora do catálogo.');
    const produto = formatarProduto(linha, { completo: true });

    const [imagens] = await pool.execute('SELECT url FROM produto_imagens WHERE produto_id = ? ORDER BY ordem, id', [id]);
    const [[loja]] = await pool.execute(
        `SELECT l.id, l.nome, l.slug, l.descricao, l.cidade, l.uf, l.cor, l.criado_em,
                (SELECT COUNT(*) FROM produtos x WHERE x.vendedor_id = l.usuario_id AND x.ativo = 1) AS total_produtos,
                (SELECT ROUND(AVG(a.nota), 2) FROM avaliacoes a JOIN produtos x ON x.id = a.produto_id
                  WHERE x.vendedor_id = l.usuario_id AND a.visivel = 1) AS avaliacao_media,
                (SELECT COUNT(*) FROM avaliacoes a JOIN produtos x ON x.id = a.produto_id
                  WHERE x.vendedor_id = l.usuario_id AND a.visivel = 1) AS total_avaliacoes,
                (SELECT COALESCE(SUM(i.quantidade), 0) FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id
                  WHERE i.vendedor_id = l.usuario_id AND o.status <> 'cancelado') AS total_vendas
           FROM lojas l WHERE l.id = ?`, [produto.loja.id]);
    const [distribuicao] = await pool.execute('SELECT nota, COUNT(*) AS total FROM avaliacoes WHERE produto_id = ? AND visivel = 1 GROUP BY nota', [id]);
    const [[{ perguntas }]] = await pool.execute('SELECT COUNT(*) AS perguntas FROM perguntas WHERE produto_id = ?', [id]);
    const [relacionados] = await pool.execute(
        `${SELECT_PRODUTO} WHERE ${VISIVEL} AND p.categoria_id = ? AND p.id <> ? ORDER BY p.total_vendido DESC, p.id DESC LIMIT 10`,
        [produto.categoria.id, id]);

    const usuario = { favoritado: false, pode_avaliar: false, minha_avaliacao: null, dono: false };
    if (req.usuario) {
        usuario.dono = req.usuario.id === produto.vendedor_id;
        const [favorito] = await pool.execute('SELECT 1 FROM favoritos WHERE usuario_id = ? AND produto_id = ?', [req.usuario.id, id]);
        usuario.favoritado = favorito.length > 0;
        const [minha] = await pool.execute('SELECT id, nota, titulo, comentario, criado_em FROM avaliacoes WHERE produto_id = ? AND usuario_id = ?', [id, req.usuario.id]);
        usuario.minha_avaliacao = minha[0] || null;
        if (!usuario.minha_avaliacao && req.usuario.nivel === 'comprador') {
            const [compra] = await pool.execute(
                `SELECT 1 FROM pedido_itens i JOIN pedidos o ON o.id = i.pedido_id
                  WHERE o.comprador_id = ? AND i.produto_id = ? AND o.status = 'entregue' LIMIT 1`, [req.usuario.id, id]);
            usuario.pode_avaliar = compra.length > 0;
        }
    }

    res.json({
        produto,
        imagens: imagens.length ? imagens.map((i) => i.url) : [produto.imagem],
        loja: { ...loja, avaliacao_media: Number(loja.avaliacao_media || 0), total_vendas: Number(loja.total_vendas) },
        avaliacoes: {
            media: produto.avaliacao_media,
            total: produto.total_avaliacoes,
            distribuicao: Object.fromEntries([5, 4, 3, 2, 1].map((nota) => [nota, (distribuicao.find((d) => d.nota === nota) || { total: 0 }).total]))
        },
        total_perguntas: perguntas,
        relacionados: relacionados.map((r) => formatarProduto(r)),
        usuario
    });
}

// ---------------------------------------------------------------------
// Gestão (vendedor e administração)
// ---------------------------------------------------------------------

// GET /api/produtos/gerenciar
async function gerenciar(req, res) {
    const { pagina, limite, deslocamento } = v.paginacao(req.query, { limitePadrao: 20, limiteMaximo: 100 });
    const config = await obterValores();
    const condicoes = ['1 = 1'];
    const parametros = [];
    if (req.usuario.nivel === 'vendedor') { condicoes.push('p.vendedor_id = ?'); parametros.push(req.usuario.id); }
    if (req.query.loja && req.usuario.nivel === 'admin') { condicoes.push('l.slug = ?'); parametros.push(String(req.query.loja)); }
    if (req.query.q) {
        const padrao = '%' + escaparLike(v.texto(req.query.q, 'a busca', { max: 80 })) + '%';
        condicoes.push('(p.nome LIKE ? OR l.nome LIKE ?)');
        parametros.push(padrao, padrao);
    }
    if (req.query.categoria) { condicoes.push('p.categoria_id = ?'); parametros.push(v.id(req.query.categoria, 'a categoria')); }
    const status = req.query.status || 'todos';
    if (status === 'ativos') condicoes.push('p.ativo = 1');
    if (status === 'inativos') condicoes.push('p.ativo = 0');
    if (req.query.estoque === 'baixo') { condicoes.push('p.ativo = 1 AND p.estoque > 0 AND p.estoque <= ?'); parametros.push(config.estoque_baixo); }
    if (req.query.estoque === 'zerado') condicoes.push('p.ativo = 1 AND p.estoque = 0');
    const ordens = { recentes: 'p.criado_em DESC', nome: 'p.nome ASC', estoque: 'p.estoque ASC', vendidos: 'p.total_vendido DESC', preco: 'p.preco DESC' };
    const ordenacao = ordens[req.query.ordem] || ordens.recentes;
    const where = condicoes.join(' AND ');
    const [linhas] = await pool.execute(`${SELECT_PRODUTO} WHERE ${where} ORDER BY ${ordenacao}, p.id DESC LIMIT ${limite} OFFSET ${deslocamento}`, parametros);
    const [[{ total }]] = await pool.execute(`SELECT COUNT(*) AS total ${FROM_PRODUTO} WHERE ${where}`, parametros);

    const escopo = req.usuario.nivel === 'vendedor' ? 'WHERE p.vendedor_id = ?' : '';
    const [[resumo]] = await pool.execute(
        `SELECT COUNT(*) AS total, COALESCE(SUM(p.ativo = 1), 0) AS ativos, COALESCE(SUM(p.ativo = 0), 0) AS inativos,
                COALESCE(SUM(p.ativo = 1 AND p.estoque > 0 AND p.estoque <= ?), 0) AS estoque_baixo,
                COALESCE(SUM(p.ativo = 1 AND p.estoque = 0), 0) AS sem_estoque
           FROM produtos p ${escopo}`,
        req.usuario.nivel === 'vendedor' ? [config.estoque_baixo, req.usuario.id] : [config.estoque_baixo]);

    res.json({
        itens: linhas.map((linha) => ({ ...formatarProduto(linha), loja_ativa: Boolean(linha.loja_ativa), visivel: visivel(linha) })),
        total, pagina, limite, paginas: Math.max(1, Math.ceil(total / limite)),
        resumo: Object.fromEntries(Object.entries(resumo).map(([chave, valor]) => [chave, Number(valor)])),
        estoque_baixo: config.estoque_baixo
    });
}

async function validarProduto(corpo, usuario) {
    v.objeto(corpo);
    const dados = {
        nome: v.texto(corpo.nome, 'o nome do produto', { min: 3, max: 120, campo: 'nome' }),
        descricao: v.texto(corpo.descricao, 'a descrição', { min: 20, max: 3000, multilinha: true, campo: 'descricao' }),
        preco: v.dinheiro(corpo.preco, 'o preço', { min: 0.5, campo: 'preco' }),
        precoOriginal: v.dinheiro(corpo.preco_original, 'o preço original', { opcional: true, min: 0.5, campo: 'preco_original' }),
        estoque: v.inteiro(corpo.estoque, 'o estoque', { min: 0, max: 100000, campo: 'estoque' }),
        categoriaId: v.id(corpo.categoria_id, 'a categoria'),
        imagem: v.url(corpo.imagem, 'a URL da imagem', { campo: 'imagem' }),
        freteGratis: v.booleano(corpo.frete_gratis, 'o frete grátis', { padrao: false })
    };
    if (dados.precoOriginal && Number(dados.precoOriginal) <= Number(dados.preco)) {
        throw erros.requisicao('O preço original ("de") precisa ser maior que o preço de venda.', { campo: 'preco_original' });
    }
    const extras = corpo.imagens === undefined || corpo.imagens === null ? [] : corpo.imagens;
    if (!Array.isArray(extras) || extras.length > 5) throw erros.requisicao('Envie no máximo 5 imagens extras.', { campo: 'imagens' });
    dados.imagens = [...new Set(extras.filter((url) => url !== '').map((url) => v.url(url, 'cada imagem extra', { campo: 'imagens' })))].filter((url) => url !== dados.imagem);
    dados.destaque = usuario.nivel === 'admin' ? v.booleano(corpo.destaque, 'o destaque', { padrao: false }) : null;
    const [categorias] = await pool.execute('SELECT id FROM categorias WHERE id = ? AND ativa = 1', [dados.categoriaId]);
    if (!categorias.length) throw erros.requisicao('Escolha uma categoria ativa.', { campo: 'categoria_id' });
    return dados;
}

async function salvarImagens(conexao, produtoId, dados) {
    await conexao.execute('DELETE FROM produto_imagens WHERE produto_id = ?', [produtoId]);
    const todas = [dados.imagem, ...dados.imagens];
    for (const [ordem, url] of todas.entries()) {
        await conexao.execute('INSERT INTO produto_imagens (produto_id, url, ordem) VALUES (?, ?, ?)', [produtoId, url, ordem]);
    }
}

// POST /api/produtos
async function criar(req, res) {
    const dados = await validarProduto(req.body, req.usuario);
    let vendedorId = req.usuario.id;
    if (req.usuario.nivel === 'vendedor') {
        if (!req.usuario.loja_id) throw erros.proibido('Sua loja ainda não foi criada.');
        if (!req.usuario.loja_ativa) throw erros.proibido('Sua loja está suspensa. Fale com a administração.');
    } else {
        // A administração cadastra em nome de uma loja existente.
        vendedorId = v.id(req.body.vendedor_id, 'a loja (vendedor)');
        const [donos] = await pool.execute("SELECT l.id FROM lojas l JOIN usuarios u ON u.id = l.usuario_id WHERE l.usuario_id = ? AND u.nivel = 'vendedor'", [vendedorId]);
        if (!donos.length) throw erros.requisicao('Escolha uma loja existente para o produto.', { campo: 'vendedor_id' });
    }
    const produtoId = await transacao(async (conexao) => {
        const [resultado] = await conexao.execute(
            `INSERT INTO produtos (vendedor_id, categoria_id, nome, descricao, preco, preco_original, estoque, imagem, destaque, frete_gratis)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [vendedorId, dados.categoriaId, dados.nome, dados.descricao, dados.preco, dados.precoOriginal, dados.estoque, dados.imagem, Boolean(dados.destaque), dados.freteGratis]
        );
        await salvarImagens(conexao, resultado.insertId, dados);
        await registrarAuditoria({ executor: conexao, req, acao: 'produto_criado', entidade: 'produtos', entidadeId: resultado.insertId, detalhes: { nome: dados.nome, preco: dados.preco } });
        return resultado.insertId;
    });
    res.status(201).json({ mensagem: 'Produto cadastrado e publicado na vitrine.', id: produtoId });
}

/** Trava o produto e confere se quem pede é o dono ou a administração. */
async function produtoDoUsuario(conexao, id, usuario) {
    const [linhas] = await conexao.execute('SELECT id, vendedor_id, nome, destaque, ativo, preco FROM produtos WHERE id = ? FOR UPDATE', [id]);
    const produto = linhas[0];
    if (!produto) throw erros.naoEncontrado('Produto não encontrado.');
    if (usuario.nivel !== 'admin' && produto.vendedor_id !== usuario.id) throw erros.proibido('Você só pode alterar os produtos da sua loja.');
    return produto;
}

// PUT /api/produtos/:id
async function atualizar(req, res) {
    const id = v.id(req.params.id, 'o produto');
    const dados = await validarProduto(req.body, req.usuario);
    await transacao(async (conexao) => {
        const atual = await produtoDoUsuario(conexao, id, req.usuario);
        // O dono não muda na edição; "destaque" só a administração altera.
        const destaque = dados.destaque === null ? Boolean(atual.destaque) : dados.destaque;
        await conexao.execute(
            `UPDATE produtos SET nome = ?, descricao = ?, preco = ?, preco_original = ?, estoque = ?, imagem = ?,
                    categoria_id = ?, frete_gratis = ?, destaque = ? WHERE id = ?`,
            [dados.nome, dados.descricao, dados.preco, dados.precoOriginal, dados.estoque, dados.imagem, dados.categoriaId, dados.freteGratis, destaque, id]
        );
        await salvarImagens(conexao, id, dados);
        await registrarAuditoria({ executor: conexao, req, acao: 'produto_atualizado', entidade: 'produtos', entidadeId: id, detalhes: { preco_anterior: atual.preco, preco: dados.preco } });
    });
    res.json({ mensagem: 'Produto atualizado.' });
}

// PATCH /api/produtos/:id/estoque
async function atualizarEstoque(req, res) {
    const id = v.id(req.params.id, 'o produto');
    const estoque = v.inteiro(req.body.estoque, 'o estoque', { min: 0, max: 100000, campo: 'estoque' });
    await transacao(async (conexao) => {
        await produtoDoUsuario(conexao, id, req.usuario);
        await conexao.execute('UPDATE produtos SET estoque = ? WHERE id = ?', [estoque, id]);
        await registrarAuditoria({ executor: conexao, req, acao: 'estoque_atualizado', entidade: 'produtos', entidadeId: id, detalhes: { estoque } });
    });
    res.json({ mensagem: 'Estoque atualizado.', estoque });
}

// DELETE /api/produtos/:id — exclusão lógica: sai da vitrine, mas o histórico de vendas continua íntegro.
async function excluir(req, res) {
    const id = v.id(req.params.id, 'o produto');
    await transacao(async (conexao) => {
        const produto = await produtoDoUsuario(conexao, id, req.usuario);
        if (!produto.ativo) throw erros.conflito('Este produto já está fora da vitrine.');
        await conexao.execute('UPDATE produtos SET ativo = 0 WHERE id = ?', [id]);
        await registrarAuditoria({ executor: conexao, req, acao: 'produto_removido', entidade: 'produtos', entidadeId: id, detalhes: { nome: produto.nome } });
    });
    res.json({ mensagem: 'Produto retirado da vitrine. O histórico de vendas foi preservado.' });
}

// POST /api/produtos/:id/reativar
async function reativar(req, res) {
    const id = v.id(req.params.id, 'o produto');
    await transacao(async (conexao) => {
        const produto = await produtoDoUsuario(conexao, id, req.usuario);
        if (produto.ativo) throw erros.conflito('Este produto já está na vitrine.');
        await conexao.execute('UPDATE produtos SET ativo = 1 WHERE id = ?', [id]);
        await registrarAuditoria({ executor: conexao, req, acao: 'produto_reativado', entidade: 'produtos', entidadeId: id, detalhes: { nome: produto.nome } });
    });
    res.json({ mensagem: 'Produto de volta à vitrine.' });
}

module.exports = { listar, detalhar, gerenciar, criar, atualizar, atualizarEstoque, excluir, reativar };
