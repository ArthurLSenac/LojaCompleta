// Componentes de interface reutilizáveis: avisos, diálogos, erros de formulário e celebração.
import { el, $$, reduzirMovimento } from './dom.js';
import { icone } from './icones.js';
import { tocar } from './sons.js';

// ---------- Avisos (toasts) ----------
function caixaDeAvisos() {
    let caixa = document.querySelector('.avisos');
    if (!caixa) {
        caixa = el('div', { classe: 'avisos', attrs: { role: 'status', 'aria-live': 'polite' } });
        document.body.appendChild(caixa);
    }
    return caixa;
}

export function avisar(mensagem, { tipo = 'info', titulo, duracao = 5200, som = true } = {}) {
    const nomeIcone = { sucesso: 'check', erro: 'alerta', info: 'brilho' }[tipo] || 'info';
    const aviso = el('div', { classe: `aviso aviso-${tipo}` }, [
        icone(nomeIcone),
        el('p', {}, [titulo ? el('strong', { texto: titulo }) : null, mensagem]),
        el('button', { type: 'button', attrs: { 'aria-label': 'Fechar aviso' }, ao: { click: () => fechar() } }, [icone('fechar')])
    ]);
    caixaDeAvisos().appendChild(aviso);
    if (som) tocar(tipo === 'erro' ? 'erro' : 'notificacao');
    let temporizador = setTimeout(fechar, duracao);
    aviso.addEventListener('mouseenter', () => clearTimeout(temporizador));
    aviso.addEventListener('mouseleave', () => { temporizador = setTimeout(fechar, 2000); });
    function fechar() {
        clearTimeout(temporizador);
        aviso.classList.add('saindo');
        setTimeout(() => aviso.remove(), 220);
    }
    return fechar;
}

export const avisarErro = (erro, titulo) => avisar(erro && erro.message ? erro.message : String(erro), { tipo: 'erro', titulo });

// ---------- Diálogos ----------
export function abrirDialogo({ titulo, conteudo, acoes = [], largo = false, aoFechar } = {}) {
    const corpo = el('div', { classe: 'dialogo-corpo' }, [conteudo]);
    const dialogo = el('dialog', { classe: 'dialogo' + (largo ? ' dialogo-largo' : ''), attrs: { 'aria-label': titulo } }, [
        el('div', { classe: 'dialogo-topo' }, [
            el('h2', { texto: titulo }),
            el('button', { type: 'button', classe: 'botao botao-fantasma botao-icone', attrs: { 'aria-label': 'Fechar' }, ao: { click: () => fechar() } }, [icone('fechar')])
        ]),
        corpo,
        acoes.length ? el('div', { classe: 'dialogo-rodape' }, acoes.map((acao) => el('button', {
            type: acao.tipo || 'button',
            classe: 'botao ' + (acao.classe || ''),
            texto: acao.texto,
            attrs: acao.form ? { form: acao.form } : undefined,
            ao: acao.aoClicar ? { click: (evento) => acao.aoClicar(evento, fechar) } : undefined
        }))) : null
    ]);
    document.body.appendChild(dialogo);
    dialogo.addEventListener('close', () => {
        dialogo.remove();
        if (aoFechar) aoFechar();
    });
    dialogo.addEventListener('click', (evento) => { if (evento.target === dialogo) fechar(); });
    dialogo.showModal();
    tocar('abrir');
    function fechar() {
        if (dialogo.open) dialogo.close();
    }
    return { dialogo, corpo, fechar };
}

export function confirmar({ titulo = 'Tem certeza?', mensagem, textoConfirmar = 'Confirmar', perigo = false } = {}) {
    return new Promise((resolver) => {
        let resposta = false;
        abrirDialogo({
            titulo,
            conteudo: el('p', { classe: 'suave', texto: mensagem }),
            acoes: [
                { texto: 'Voltar', classe: 'botao-fantasma', aoClicar: (e, fechar) => fechar() },
                { texto: textoConfirmar, classe: perigo ? 'botao-perigo' : 'botao-ambar', aoClicar: (e, fechar) => { resposta = true; fechar(); } }
            ],
            aoFechar: () => resolver(resposta)
        });
    });
}

// ---------- Formulários ----------
export function limparErros(formulario) {
    $$('.campo.invalido', formulario).forEach((campo) => campo.classList.remove('invalido'));
    $$('.erro-campo', formulario).forEach((mensagem) => mensagem.remove());
}

/** Mostra o erro da API ao lado do campo indicado (quando há "campo") ou como aviso. */
export function mostrarErro(formulario, erro) {
    limparErros(formulario);
    const entrada = erro && erro.campo ? formulario.querySelector(`[name="${CSS.escape(erro.campo)}"]`) : null;
    if (entrada) {
        const campo = entrada.closest('.campo') || entrada.parentElement;
        campo.classList.add('invalido');
        campo.appendChild(el('span', { classe: 'erro-campo', texto: erro.message, attrs: { role: 'alert' } }));
        entrada.focus();
        tocar('erro');
    } else {
        avisarErro(erro);
    }
}

export function dadosDoFormulario(formulario) {
    const dados = {};
    for (const [chave, valor] of new FormData(formulario).entries()) dados[chave] = typeof valor === 'string' ? valor.trim() : valor;
    return dados;
}

/** Botão de mostrar/ocultar senha e medidor de força (0 a 4). */
export function prepararSenha(entrada, { medidor } = {}) {
    const envoltorio = entrada.parentElement;
    envoltorio.classList.add('campo-senha');
    const botao = el('button', { type: 'button', classe: 'mostrar-senha', attrs: { 'aria-label': 'Mostrar senha' } }, [icone('olho')]);
    botao.addEventListener('click', () => {
        const visivel = entrada.type === 'text';
        entrada.type = visivel ? 'password' : 'text';
        botao.replaceChildren(icone(visivel ? 'olho' : 'olho-fechado'));
        botao.setAttribute('aria-label', visivel ? 'Mostrar senha' : 'Ocultar senha');
    });
    envoltorio.appendChild(botao);
    if (medidor) {
        const atualizar = () => {
            const s = entrada.value;
            let nivel = 0;
            if (s.length >= 8) nivel++;
            if (/[a-z]/.test(s) && /[A-Z]/.test(s)) nivel++;
            if (/\d/.test(s)) nivel++;
            if (s.length >= 12 || /[^A-Za-z0-9]/.test(s)) nivel++;
            medidor.dataset.nivel = s ? String(Math.max(1, nivel)) : '0';
        };
        entrada.addEventListener('input', atualizar);
        atualizar();
    }
}

// ---------- Celebração ----------
/** Chuva de confetes em tons de âmbar e gemas (respeita "reduzir movimento"). */
export function celebrar() {
    if (reduzirMovimento()) return;
    const tela = el('canvas', { classe: 'confetes', attrs: { 'aria-hidden': 'true' } });
    Object.assign(tela.style, { position: 'fixed', inset: '0', width: '100%', height: '100%', pointerEvents: 'none', zIndex: '950' });
    document.body.appendChild(tela);
    const contexto = tela.getContext('2d');
    const escala = window.devicePixelRatio || 1;
    tela.width = innerWidth * escala;
    tela.height = innerHeight * escala;
    contexto.scale(escala, escala);
    const cores = ['#f5a524', '#ffd06a', '#e88d0c', '#c11d43', '#0e7a55', '#0f5f7a', '#fff1c9'];
    const pecas = Array.from({ length: 160 }, () => ({
        x: innerWidth / 2 + (Math.random() - .5) * 160,
        y: innerHeight * .38,
        vx: (Math.random() - .5) * 15,
        vy: -Math.random() * 15 - 5,
        tamanho: 5 + Math.random() * 7,
        giro: Math.random() * Math.PI,
        vgiro: (Math.random() - .5) * .3,
        cor: cores[Math.floor(Math.random() * cores.length)],
        forma: Math.random() > .5 ? 'retangulo' : 'gota'
    }));
    const inicio = performance.now();
    function quadro(agora) {
        const tempo = agora - inicio;
        contexto.clearRect(0, 0, innerWidth, innerHeight);
        contexto.globalAlpha = Math.max(0, 1 - tempo / 2600);
        for (const p of pecas) {
            p.vy += .38; p.vx *= .985; p.x += p.vx; p.y += p.vy; p.giro += p.vgiro;
            contexto.save();
            contexto.translate(p.x, p.y);
            contexto.rotate(p.giro);
            contexto.fillStyle = p.cor;
            if (p.forma === 'retangulo') contexto.fillRect(-p.tamanho / 2, -p.tamanho / 4, p.tamanho, p.tamanho / 2);
            else { contexto.beginPath(); contexto.ellipse(0, 0, p.tamanho / 2.4, p.tamanho / 1.6, 0, 0, Math.PI * 2); contexto.fill(); }
            contexto.restore();
        }
        if (tempo < 2600) requestAnimationFrame(quadro);
        else tela.remove();
    }
    requestAnimationFrame(quadro);
}
