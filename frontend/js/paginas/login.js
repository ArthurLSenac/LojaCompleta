// Página de login: envia e-mail e senha para a API e guarda o JWT recebido.
import { $, $$, comCarregamento, parametros } from '../nucleo/dom.js';
import { icone } from '../nucleo/icones.js';
import { api } from '../nucleo/api.js';
import { salvarSessao, obterSessao, paginaDoNivel, destinoSeguro } from '../nucleo/sessao.js';
import { mostrarErro, limparErros, prepararSenha, dadosDoFormulario } from '../nucleo/ui.js';
import { tocar, carregarManifesto } from '../nucleo/sons.js';

carregarManifesto();
$$('[data-icone]').forEach((alvo) => alvo.replaceWith(icone(alvo.dataset.icone)));

const voltar = destinoSeguro(parametros().get('voltar'));
const sessaoAtual = obterSessao();
if (sessaoAtual) window.location.replace(voltar || paginaDoNivel(sessaoAtual.usuario.nivel));
if (voltar) $('#link-cadastro').href = 'cadastro.html?voltar=' + encodeURIComponent(voltar);

const formulario = $('#form-login');
prepararSenha($('#senha'));

formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    limparErros(formulario);
    const dados = dadosDoFormulario(formulario);
    if (!dados.email || !dados.senha) {
        mostrarErro(formulario, { message: 'Preencha e-mail e senha.', campo: dados.email ? 'senha' : 'email' });
        return;
    }
    const botao = formulario.querySelector('button[type="submit"]');
    try {
        const resposta = await comCarregamento(botao, () => api('/auth/login', {
            metodo: 'POST',
            corpo: { email: dados.email, senha: $('#senha').value }
        }));
        salvarSessao({ token: resposta.token, usuario: resposta.usuario }, formulario.lembrar.checked);
        tocar('login');
        const destino = voltar || (resposta.usuario.nivel === 'comprador' ? 'index.html' : paginaDoNivel(resposta.usuario.nivel));
        setTimeout(() => window.location.replace(destino), 380);
    } catch (erro) {
        mostrarErro(formulario, { message: erro.message, campo: erro.status === 401 ? 'senha' : erro.campo });
    }
});

// Botões de demonstração: preenchem as credenciais de teste.
$$('[data-demo]').forEach((botao) => botao.addEventListener('click', () => {
    $('#email').value = botao.dataset.demo;
    $('#senha').value = 'Ambar@2026';
    tocar('clique');
    formulario.querySelector('button[type="submit"]').focus();
}));
