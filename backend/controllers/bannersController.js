// Banners do carrossel da página inicial (CRUD da administração).
const pool = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { registrarAuditoria } = require('../services/auditoria');

const formatar = (b) => ({ ...b, ativo: Boolean(b.ativo) });

// GET /api/banners — ativos, na ordem definida.
async function listar(req, res) {
    const [banners] = await pool.execute('SELECT id, titulo, subtitulo, texto_botao, link, imagem, video, ordem FROM banners WHERE ativo = 1 ORDER BY ordem, id');
    res.json({ banners });
}

// GET /api/banners/gerenciar (admin)
async function gerenciar(req, res) {
    const [banners] = await pool.execute('SELECT * FROM banners ORDER BY ordem, id');
    res.json({ banners: banners.map(formatar) });
}

function validar(corpo) {
    v.objeto(corpo);
    const link = v.texto(corpo.link, 'o link do botão', { min: 1, max: 300, campo: 'link' });
    // Links do banner apontam para páginas da própria loja (sem javascript: ou sites externos).
    if (!/^[a-z0-9-]+\.html([?#][^\s]*)?$/i.test(link)) throw erros.requisicao('Use um link interno, como busca.html?desconto=1.', { campo: 'link' });
    return {
        titulo: v.texto(corpo.titulo, 'o título', { min: 3, max: 80, campo: 'titulo' }),
        subtitulo: v.texto(corpo.subtitulo, 'o subtítulo', { min: 3, max: 180, campo: 'subtitulo' }),
        textoBotao: v.texto(corpo.texto_botao, 'o texto do botão', { min: 2, max: 30, campo: 'texto_botao' }),
        link,
        imagem: v.url(corpo.imagem, 'a imagem', { permitirLocal: true, campo: 'imagem' }),
        video: v.url(corpo.video, 'o vídeo', { opcional: true, permitirLocal: true, campo: 'video' }),
        ordem: v.inteiro(corpo.ordem ?? 0, 'a ordem', { min: 0, max: 99, campo: 'ordem' }),
        ativo: v.booleano(corpo.ativo, 'a situação', { padrao: true })
    };
}

// POST /api/banners (admin)
async function criar(req, res) {
    const d = validar(req.body);
    const [resultado] = await pool.execute(
        'INSERT INTO banners (titulo, subtitulo, texto_botao, link, imagem, video, ordem, ativo) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [d.titulo, d.subtitulo, d.textoBotao, d.link, d.imagem, d.video, d.ordem, d.ativo]);
    await registrarAuditoria({ req, acao: 'banner_criado', entidade: 'banners', entidadeId: resultado.insertId, detalhes: { titulo: d.titulo } });
    res.status(201).json({ mensagem: 'Banner criado.', id: resultado.insertId });
}

// PUT /api/banners/:id (admin)
async function atualizar(req, res) {
    const id = v.id(req.params.id, 'o banner');
    const d = validar(req.body);
    const [resultado] = await pool.execute(
        'UPDATE banners SET titulo = ?, subtitulo = ?, texto_botao = ?, link = ?, imagem = ?, video = ?, ordem = ?, ativo = ? WHERE id = ?',
        [d.titulo, d.subtitulo, d.textoBotao, d.link, d.imagem, d.video, d.ordem, d.ativo, id]);
    if (!resultado.affectedRows) throw erros.naoEncontrado('Banner não encontrado.');
    await registrarAuditoria({ req, acao: 'banner_atualizado', entidade: 'banners', entidadeId: id });
    res.json({ mensagem: 'Banner atualizado.' });
}

// DELETE /api/banners/:id (admin)
async function excluir(req, res) {
    const id = v.id(req.params.id, 'o banner');
    const [resultado] = await pool.execute('DELETE FROM banners WHERE id = ?', [id]);
    if (!resultado.affectedRows) throw erros.naoEncontrado('Banner não encontrado.');
    await registrarAuditoria({ req, acao: 'banner_excluido', entidade: 'banners', entidadeId: id });
    res.json({ mensagem: 'Banner excluído.' });
}

module.exports = { listar, gerenciar, criar, atualizar, excluir };
