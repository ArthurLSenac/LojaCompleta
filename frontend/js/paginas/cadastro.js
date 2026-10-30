// Cadastro de comprador: valida no navegador para ajudar, mas quem decide é a API.
import { $, $$, comCarregamento, parametros } from '../nucleo/dom.js';
import { icone } from '../nucleo/icones.js';
import { api } from '../nucleo/api.js';
import { salvarSessao, obterSessao, paginaDoNivel, destinoSeguro } from '../nucleo/sessao.js';
import { mostrarErro, limparErros, prepararSenha, dadosDoFormulario, celebrar } from '../nucleo/ui.js';
import { tocar, carregarManifesto } from '../nucleo/sons.js';

carregarManifesto();
$$('[data-icone]').forEach((alvo) => alvo.replaceWith(icone(alvo.dataset.icone)));

const voltar = destinoSeguro(parametros().get('voltar'));
const sessaoAtual = obterSessao();
if (sessaoAtual) window.location.replace(voltar || paginaDoNivel(sessaoAtual.usuario.nivel));
if (voltar) $('#link-login').href = 'login.html?voltar=' + encodeURIComponent(voltar);

const formulario = $('#form-cadastro');
prepararSenha($('#senha'), { medidor: $('#forca-senha') });
prepararSenha($('#confirmacao'));

function validar(dados) {
    if (dados.nome.length < 2) return { campo: 'nome', message: 'Informe seu nome.' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(dados.email)) return { campo: 'email', message: 'Informe um e-mail válido.' };
    const senha = $('#senha').value;
    if (senha.length < 8 || !/[a-z]/.test(senha) || !/[A-Z]/.test(senha) || !/\d/.test(senha)) {
        return { campo: 'senha', message: 'A senha precisa de 8 caracteres, com maiúsculas, minúsculas e números.' };
    }
    if (senha !== $('#confirmacao').value) return { campo: 'confirmacao', message: 'As senhas não são iguais.' };
    return null;
}

formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros(formulario);
    const dados = dadosDoFormulario(formulario);
    const problema = validar(dados);
    if (problema) {
        mostrarErro(formulario, problema);
        return;
    }
    const botao = formulario.querySelector('button[type="submit"]');
    try {
        const resposta = await comCarregamento(botao, () => api('/auth/cadastro', {
            metodo: 'POST',
            corpo: { nome: dados.nome, email: dados.email, senha: $('#senha').value }
        }));
        salvarSessao({ token: resposta.token, usuario: resposta.usuario }, true);
        tocar('sucesso');
        celebrar();
        setTimeout(() => window.location.replace(voltar || 'index.html?boas-vindas=1'), 1100);
    } catch (erro) {
        mostrarErro(formulario, erro);
    }
});
