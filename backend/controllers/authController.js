const bcrypt = require('bcryptjs');
const pool = require('../database/conexao');
const config = require('../config/ambiente');
const v = require('../utils/validacao');
const { erros } = require('../utils/erros');
const { gerarToken } = require('../services/tokens');
const { registrarAuditoria } = require('../services/auditoria');

// Hash usado quando o e-mail não existe: o bcrypt roda do mesmo jeito,
// então o tempo de resposta não revela se a conta existe.
let hashFicticio;
function obterHashFicticio() {
    if (!hashFicticio) hashFicticio = bcrypt.hashSync('conta-inexistente-' + Date.now(), config.seguranca.custoBcrypt);
    return hashFicticio;
}

async function buscarLoja(usuarioId) {
    const [lojas] = await pool.execute('SELECT id, nome, slug, ativa, cor FROM lojas WHERE usuario_id = ?', [usuarioId]);
    return lojas[0] ? { ...lojas[0], ativa: Boolean(lojas[0].ativa) } : null;
}

function usuarioPublico(usuario, loja = null) {
    return { id: usuario.id, nome: usuario.nome, email: usuario.email, nivel: usuario.nivel, telefone: usuario.telefone || null, loja };
}

// POST /api/auth/cadastro — sempre cria um comprador.
async function cadastrar(req, res) {
    const nome = v.texto(req.body.nome, 'o nome', { min: 2, max: 100, campo: 'nome' });
    const email = v.email(req.body.email);
    const senha = v.senhaForte(req.body.senha);
    const senhaHash = await bcrypt.hash(senha, config.seguranca.custoBcrypt);
    try {
        // O nível é fixo no SQL: um campo "nivel" enviado de propósito é ignorado.
        const [resultado] = await pool.execute(
            "INSERT INTO usuarios (nome, email, senha_hash, nivel) VALUES (?, ?, ?, 'comprador')",
            [nome, email, senhaHash]
        );
        const usuario = { id: resultado.insertId, nome, email, nivel: 'comprador', token_versao: 0 };
        await registrarAuditoria({ req, usuarioId: usuario.id, acao: 'cadastro', entidade: 'usuarios', entidadeId: usuario.id });
        res.status(201).json({ mensagem: 'Conta criada. Boas compras!', token: gerarToken(usuario), usuario: usuarioPublico(usuario) });
    } catch (erro) {
        if (erro.code === 'ER_DUP_ENTRY') throw erros.conflito('Já existe uma conta com este e-mail.', { campo: 'email' });
        throw erro;
    }
}

// POST /api/auth/login
async function login(req, res) {
    const email = v.email(req.body.email);
    const senha = req.body.senha;
    if (typeof senha !== 'string' || senha.length === 0 || Buffer.byteLength(senha, 'utf8') > 72) {
        throw erros.requisicao('Informe a senha.', { campo: 'senha' });
    }
    const [linhas] = await pool.execute(
        'SELECT id, nome, email, telefone, senha_hash, nivel, status, token_versao, bloqueado_ate FROM usuarios WHERE email = ?',
        [email]
    );
    const usuario = linhas[0];

    // Bloqueio temporário: nem compara a senha enquanto estiver valendo.
    if (usuario && usuario.bloqueado_ate && new Date(usuario.bloqueado_ate) > new Date()) {
        const minutos = Math.max(1, Math.ceil((new Date(usuario.bloqueado_ate) - Date.now()) / 60000));
        throw erros.muitasTentativas(`Muitas tentativas incorretas. Tente novamente em ${minutos} minuto${minutos > 1 ? 's' : ''}.`);
    }

    const senhaConfere = await bcrypt.compare(senha, usuario ? usuario.senha_hash : obterHashFicticio());
    if (!usuario || !senhaConfere) {
        if (usuario) {
            await pool.execute('UPDATE usuarios SET tentativas_login = tentativas_login + 1 WHERE id = ?', [usuario.id]);
            const [[{ tentativas_login: tentativas }]] = await pool.execute('SELECT tentativas_login FROM usuarios WHERE id = ?', [usuario.id]);
            if (tentativas >= config.seguranca.tentativasLogin) {
                await pool.execute(
                    'UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = DATE_ADD(NOW(), INTERVAL ? MINUTE) WHERE id = ?',
                    [config.seguranca.minutosBloqueio, usuario.id]
                );
                await registrarAuditoria({ req, usuarioId: usuario.id, acao: 'login_bloqueado', entidade: 'usuarios', entidadeId: usuario.id });
                throw erros.muitasTentativas(`Muitas tentativas incorretas. Por segurança, o acesso foi pausado por ${config.seguranca.minutosBloqueio} minutos.`);
            }
        }
        await registrarAuditoria({ req, usuarioId: usuario ? usuario.id : null, acao: 'login_falhou', entidade: 'usuarios', detalhes: { email } });
        throw erros.naoAutenticado('E-mail ou senha incorretos.');
    }

    if (usuario.status === 'bloqueado') {
        await registrarAuditoria({ req, usuarioId: usuario.id, acao: 'login_conta_bloqueada', entidade: 'usuarios', entidadeId: usuario.id });
        throw erros.proibido('Esta conta foi bloqueada pela administração. Fale com o suporte da Âmbar.');
    }

    await pool.execute('UPDATE usuarios SET tentativas_login = 0, bloqueado_ate = NULL, ultimo_login = NOW() WHERE id = ?', [usuario.id]);
    await registrarAuditoria({ req, usuarioId: usuario.id, acao: 'login', entidade: 'usuarios', entidadeId: usuario.id });
    const loja = usuario.nivel === 'vendedor' ? await buscarLoja(usuario.id) : null;
    res.json({ mensagem: `Olá, ${usuario.nome.split(' ')[0]}!`, token: gerarToken(usuario), usuario: usuarioPublico(usuario, loja) });
}

// GET /api/auth/eu — dados atualizados de quem está logado.
async function eu(req, res) {
    const [linhas] = await pool.execute('SELECT id, nome, email, telefone, nivel, criado_em FROM usuarios WHERE id = ?', [req.usuario.id]);
    const [[contagem]] = await pool.execute(
        `SELECT (SELECT COUNT(*) FROM pedidos WHERE comprador_id = ?) AS pedidos,
                (SELECT COUNT(*) FROM favoritos WHERE usuario_id = ?) AS favoritos,
                (SELECT COUNT(*) FROM enderecos WHERE usuario_id = ?) AS enderecos`,
        [req.usuario.id, req.usuario.id, req.usuario.id]
    );
    const loja = await buscarLoja(req.usuario.id);
    res.json({ usuario: { ...usuarioPublico(linhas[0], loja), criado_em: linhas[0].criado_em }, resumo: contagem });
}

// PUT /api/auth/perfil
async function atualizarPerfil(req, res) {
    const nome = v.texto(req.body.nome, 'o nome', { min: 2, max: 100, campo: 'nome' });
    const telefone = v.telefone(req.body.telefone, { opcional: true });
    await pool.execute('UPDATE usuarios SET nome = ?, telefone = ? WHERE id = ?', [nome, telefone, req.usuario.id]);
    await registrarAuditoria({ req, acao: 'perfil_atualizado', entidade: 'usuarios', entidadeId: req.usuario.id });
    res.json({ mensagem: 'Dados atualizados.', usuario: { nome, telefone } });
}

// PUT /api/auth/senha — exige a senha atual e encerra as outras sessões.
async function alterarSenha(req, res) {
    const senhaAtual = req.body.senhaAtual;
    if (typeof senhaAtual !== 'string' || !senhaAtual) throw erros.requisicao('Informe a senha atual.', { campo: 'senhaAtual' });
    const novaSenha = v.senhaForte(req.body.novaSenha, { campo: 'novaSenha' });
    const [linhas] = await pool.execute('SELECT id, nome, email, nivel, senha_hash, token_versao FROM usuarios WHERE id = ?', [req.usuario.id]);
    const usuario = linhas[0];
    if (!(await bcrypt.compare(senhaAtual, usuario.senha_hash))) {
        throw erros.requisicao('A senha atual não confere.', { campo: 'senhaAtual' });
    }
    if (await bcrypt.compare(novaSenha, usuario.senha_hash)) {
        throw erros.requisicao('A nova senha precisa ser diferente da atual.', { campo: 'novaSenha' });
    }
    const hash = await bcrypt.hash(novaSenha, config.seguranca.custoBcrypt);
    await pool.execute('UPDATE usuarios SET senha_hash = ?, token_versao = token_versao + 1 WHERE id = ?', [hash, usuario.id]);
    await registrarAuditoria({ req, acao: 'senha_alterada', entidade: 'usuarios', entidadeId: usuario.id });
    const token = gerarToken({ ...usuario, token_versao: usuario.token_versao + 1 });
    res.json({ mensagem: 'Senha alterada. As outras sessões foram encerradas.', token });
}

// POST /api/auth/sair-de-todos — invalida todos os tokens já emitidos.
async function sairDeTodos(req, res) {
    await pool.execute('UPDATE usuarios SET token_versao = token_versao + 1 WHERE id = ?', [req.usuario.id]);
    await registrarAuditoria({ req, acao: 'sessoes_encerradas', entidade: 'usuarios', entidadeId: req.usuario.id });
    res.json({ mensagem: 'Você saiu de todos os dispositivos.' });
}

module.exports = { cadastrar, login, eu, atualizarPerfil, alterarSenha, sairDeTodos };
