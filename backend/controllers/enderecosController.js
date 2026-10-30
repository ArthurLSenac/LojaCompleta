// Endereços de entrega do próprio usuário (CRUD). O id do dono vem sempre do JWT.
const pool = require('../database/conexao');
const { transacao } = require('../database/conexao');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');

const MAXIMO = 10;

function validar(corpo) {
    v.objeto(corpo);
    return {
        apelido: v.texto(corpo.apelido, 'o apelido do endereço', { min: 2, max: 40, campo: 'apelido' }),
        destinatario: v.texto(corpo.destinatario, 'o nome de quem recebe', { min: 2, max: 100, campo: 'destinatario' }),
        cep: v.cep(corpo.cep),
        logradouro: v.texto(corpo.logradouro, 'a rua', { min: 3, max: 120, campo: 'logradouro' }),
        numero: v.texto(corpo.numero, 'o número', { min: 1, max: 10, campo: 'numero' }),
        complemento: v.texto(corpo.complemento, 'o complemento', { opcional: true, max: 60, campo: 'complemento' }),
        bairro: v.texto(corpo.bairro, 'o bairro', { min: 2, max: 80, campo: 'bairro' }),
        cidade: v.texto(corpo.cidade, 'a cidade', { min: 2, max: 80, campo: 'cidade' }),
        uf: v.uf(corpo.uf),
        principal: v.booleano(corpo.principal, 'o endereço principal', { padrao: false })
    };
}

const formatar = (e) => ({ ...e, principal: Boolean(e.principal) });

// GET /api/enderecos
async function listar(req, res) {
    const [enderecos] = await pool.execute('SELECT * FROM enderecos WHERE usuario_id = ? ORDER BY principal DESC, id', [req.usuario.id]);
    res.json({ enderecos: enderecos.map(formatar) });
}

// POST /api/enderecos
async function criar(req, res) {
    const dados = validar(req.body);
    const endereco = await transacao(async (conexao) => {
        const [existentes] = await conexao.execute('SELECT id FROM enderecos WHERE usuario_id = ? FOR UPDATE', [req.usuario.id]);
        if (existentes.length >= MAXIMO) throw erros.conflito(`Você pode guardar até ${MAXIMO} endereços.`);
        const principal = dados.principal || existentes.length === 0; // o primeiro vira principal
        if (principal) await conexao.execute('UPDATE enderecos SET principal = 0 WHERE usuario_id = ?', [req.usuario.id]);
        const [resultado] = await conexao.execute(
            `INSERT INTO enderecos (usuario_id, apelido, destinatario, cep, logradouro, numero, complemento, bairro, cidade, uf, principal)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [req.usuario.id, dados.apelido, dados.destinatario, dados.cep, dados.logradouro, dados.numero, dados.complemento, dados.bairro, dados.cidade, dados.uf, principal]);
        const [linhas] = await conexao.execute('SELECT * FROM enderecos WHERE id = ?', [resultado.insertId]);
        return formatar(linhas[0]);
    });
    res.status(201).json({ mensagem: 'Endereço salvo.', endereco });
}

// PUT /api/enderecos/:id
async function atualizar(req, res) {
    const id = v.id(req.params.id, 'o endereço');
    const dados = validar(req.body);
    await transacao(async (conexao) => {
        const [linhas] = await conexao.execute('SELECT id, principal FROM enderecos WHERE id = ? AND usuario_id = ? FOR UPDATE', [id, req.usuario.id]);
        if (!linhas.length) throw erros.naoEncontrado('Endereço não encontrado.');
        const principal = dados.principal || Boolean(linhas[0].principal);
        if (dados.principal) await conexao.execute('UPDATE enderecos SET principal = 0 WHERE usuario_id = ?', [req.usuario.id]);
        await conexao.execute(
            `UPDATE enderecos SET apelido = ?, destinatario = ?, cep = ?, logradouro = ?, numero = ?, complemento = ?, bairro = ?, cidade = ?, uf = ?, principal = ?
              WHERE id = ? AND usuario_id = ?`,
            [dados.apelido, dados.destinatario, dados.cep, dados.logradouro, dados.numero, dados.complemento, dados.bairro, dados.cidade, dados.uf, principal, id, req.usuario.id]);
    });
    res.json({ mensagem: 'Endereço atualizado.' });
}

// PUT /api/enderecos/:id/principal
async function tornarPrincipal(req, res) {
    const id = v.id(req.params.id, 'o endereço');
    await transacao(async (conexao) => {
        const [linhas] = await conexao.execute('SELECT id FROM enderecos WHERE id = ? AND usuario_id = ? FOR UPDATE', [id, req.usuario.id]);
        if (!linhas.length) throw erros.naoEncontrado('Endereço não encontrado.');
        await conexao.execute('UPDATE enderecos SET principal = (id = ?) WHERE usuario_id = ?', [id, req.usuario.id]);
    });
    res.json({ mensagem: 'Endereço principal definido.' });
}

// DELETE /api/enderecos/:id — pedidos antigos guardam uma cópia do endereço, então nada se perde.
async function excluir(req, res) {
    const id = v.id(req.params.id, 'o endereço');
    await transacao(async (conexao) => {
        const [linhas] = await conexao.execute('SELECT id, principal FROM enderecos WHERE id = ? AND usuario_id = ? FOR UPDATE', [id, req.usuario.id]);
        if (!linhas.length) throw erros.naoEncontrado('Endereço não encontrado.');
        await conexao.execute('DELETE FROM enderecos WHERE id = ?', [id]);
        if (linhas[0].principal) {
            await conexao.execute('UPDATE enderecos SET principal = 1 WHERE usuario_id = ? ORDER BY id LIMIT 1', [req.usuario.id]);
        }
    });
    res.json({ mensagem: 'Endereço removido.' });
}

module.exports = { listar, criar, atualizar, tornarPrincipal, excluir };
