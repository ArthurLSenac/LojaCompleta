// Categorias: leitura pública e CRUD da administração.
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { slug } = require('../utils/texto');
const { FROM_PRODUTO, VISIVEL } = require('../utils/produtos');
const { registrarAuditoria } = require('../services/auditoria');

const ICONES = ['fone', 'controle', 'camiseta', 'bolsa', 'joia', 'casa', 'cafe', 'beleza', 'esporte', 'pet', 'livro', 'caixa', 'presente', 'tag'];

// GET /api/categorias — só as ativas, com a quantidade de produtos visíveis.
async function listar(req, res) {
    // O alias "cat" evita confusão com o "c" usado dentro da subconsulta de produtos.
    const [categorias] = await pool.execute(
        `SELECT cat.id, cat.nome, cat.slug, cat.descricao, cat.icone, cat.imagem, cat.ordem,
                (SELECT COUNT(*) ${FROM_PRODUTO} WHERE ${VISIVEL} AND p.categoria_id = cat.id) AS total_produtos
           FROM categorias cat WHERE cat.ativa = 1 ORDER BY cat.ordem, cat.nome`
    );
    res.json({ categorias });
}

// GET /api/categorias/gerenciar — todas, com totais (administração).
async function gerenciar(req, res) {
    const [categorias] = await pool.execute(
        `SELECT c.*, (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id) AS total_produtos,
                (SELECT COUNT(*) FROM produtos p WHERE p.categoria_id = c.id AND p.ativo = 1) AS produtos_ativos
           FROM categorias c ORDER BY c.ordem, c.nome`
    );
    res.json({ categorias: categorias.map((c) => ({ ...c, ativa: Boolean(c.ativa) })), icones: ICONES });
}

function validar(corpo) {
    v.objeto(corpo);
    return {
        nome: v.texto(corpo.nome, 'o nome da categoria', { min: 3, max: 60, campo: 'nome' }),
        descricao: v.texto(corpo.descricao, 'a descrição', { min: 5, max: 300, campo: 'descricao' }),
        icone: v.opcao(corpo.icone || 'caixa', 'o ícone', ICONES),
        imagem: v.url(corpo.imagem, 'a URL da imagem', { opcional: true, campo: 'imagem' }),
        ordem: v.inteiro(corpo.ordem ?? 0, 'a ordem', { min: 0, max: 999, campo: 'ordem' }),
        ativa: v.booleano(corpo.ativa, 'a situação', { padrao: true })
    };
}

// POST /api/categorias
async function criar(req, res) {
    const dados = validar(req.body);
    try {
        const [resultado] = await pool.execute(
            'INSERT INTO categorias (nome, slug, descricao, icone, imagem, ordem, ativa) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [dados.nome, slug(dados.nome), dados.descricao, dados.icone, dados.imagem, dados.ordem, dados.ativa]
        );
        await registrarAuditoria({ req, acao: 'categoria_criada', entidade: 'categorias', entidadeId: resultado.insertId, detalhes: { nome: dados.nome } });
        res.status(201).json({ mensagem: 'Categoria criada.', id: resultado.insertId });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') throw erros.conflito('Já existe uma categoria com esse nome.', { campo: 'nome' });
        throw erro;
    }
}

// PUT /api/categorias/:id
async function atualizar(req, res) {
    const id = v.id(req.params.id, 'a categoria');
    const dados = validar(req.body);
    try {
        const [resultado] = await pool.execute(
            'UPDATE categorias SET nome = ?, slug = ?, descricao = ?, icone = ?, imagem = ?, ordem = ?, ativa = ? WHERE id = ?',
            [dados.nome, slug(dados.nome), dados.descricao, dados.icone, dados.imagem, dados.ordem, dados.ativa, id]
        );
        if (!resultado.affectedRows) throw erros.naoEncontrado('Categoria não encontrada.');
        await registrarAuditoria({ req, acao: 'categoria_atualizada', entidade: 'categorias', entidadeId: id, detalhes: { nome: dados.nome, ativa: dados.ativa } });
        res.json({ mensagem: dados.ativa ? 'Categoria atualizada.' : 'Categoria atualizada e escondida da vitrine.' });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') throw erros.conflito('Já existe uma categoria com esse nome.', { campo: 'nome' });
        throw erro;
    }
}

// DELETE /api/categorias/:id — só remove se nenhum produto usa a categoria.
async function excluir(req, res) {
    const id = v.id(req.params.id, 'a categoria');
    const [[uso]] = await pool.execute('SELECT COUNT(*) AS total FROM produtos WHERE categoria_id = ?', [id]);
    if (uso.total > 0) {
        throw erros.conflito(`Esta categoria tem ${uso.total} produto(s). Mova os produtos ou desative a categoria em vez de excluir.`);
    }
    const [resultado] = await pool.execute('DELETE FROM categorias WHERE id = ?', [id]);
    if (!resultado.affectedRows) throw erros.naoEncontrado('Categoria não encontrada.');
    await registrarAuditoria({ req, acao: 'categoria_excluida', entidade: 'categorias', entidadeId: id });
    res.json({ mensagem: 'Categoria excluída.' });
}

module.exports = { listar, gerenciar, criar, atualizar, excluir, ICONES };
