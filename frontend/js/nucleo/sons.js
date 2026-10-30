// Identidade sonora da Âmbar.
// Os efeitos são gerados com o ElevenLabs (pasta assets/sons, listados pela API em /api/sons).
// Quando um arquivo não existe, um som equivalente é sintetizado na hora com a Web Audio API,
// então a loja nunca fica muda. Os sons só tocam em resposta a ações da pessoa.
import { ler, guardar } from './dom.js';
import { API_BASE } from './api.js';

const CHAVE = 'ambar:sons';
let ligado = ler(CHAVE, true) !== false;
let contexto = null;
let mestre = null;
let manifesto = {};
let manifestoPedido = null;
const buffers = new Map();

function obterContexto() {
    if (contexto) {
        if (contexto.state === 'suspended') contexto.resume().catch(() => {});
        return contexto;
    }
    const Contexto = window.AudioContext || window.webkitAudioContext;
    if (!Contexto) return null;
    contexto = new Contexto();
    mestre = contexto.createGain();
    mestre.gain.value = 0.55;
    mestre.connect(contexto.destination);
    return contexto;
}

export const sonsLigados = () => ligado;

export function definirSons(valor) {
    ligado = Boolean(valor);
    guardar(CHAVE, ligado);
    window.dispatchEvent(new CustomEvent('ambar:sons', { detail: { ligado } }));
    if (ligado) tocar('clique');
}

export function carregarManifesto() {
    if (!manifestoPedido) {
        manifestoPedido = fetch(API_BASE + '/api/sons', { headers: { Accept: 'application/json' } })
            .then((resposta) => (resposta.ok ? resposta.json() : { sons: [] }))
            .then((dados) => {
                manifesto = Object.fromEntries((dados.sons || []).filter((s) => s.arquivo && s.ativo !== false).map((s) => [s.chave, s]));
                return manifesto;
            })
            .catch(() => manifesto);
    }
    return manifestoPedido;
}

async function obterBuffer(item) {
    if (buffers.has(item.arquivo)) return buffers.get(item.arquivo);
    const promessa = fetch(item.arquivo)
        .then((resposta) => { if (!resposta.ok) throw new Error('som ausente'); return resposta.arrayBuffer(); })
        .then((bytes) => contexto.decodeAudioData(bytes));
    buffers.set(item.arquivo, promessa);
    return promessa;
}

export function tocar(chave) {
    if (!ligado) return;
    const ctx = obterContexto();
    if (!ctx) return;
    const item = manifesto[chave];
    if (item && item.tipo !== 'voz') {
        obterBuffer(item).then((buffer) => {
            const fonte = ctx.createBufferSource();
            const volume = ctx.createGain();
            volume.gain.value = Number(item.volume || 0.6);
            fonte.buffer = buffer;
            fonte.connect(volume).connect(mestre);
            fonte.start();
        }).catch(() => {
            buffers.delete(item.arquivo);
            sintetizar(chave, ctx);
        });
        return;
    }
    sintetizar(chave, ctx);
}

/** Frases da marca: arquivo do ElevenLabs ou, na falta dele, a voz do próprio navegador. */
export function falar(chave, texto) {
    if (!ligado) return;
    const item = manifesto[chave];
    if (item && item.arquivo) {
        const audio = new Audio(item.arquivo);
        audio.volume = Math.min(1, Number(item.volume || 0.9));
        audio.play().catch(() => falarComNavegador(texto));
        return;
    }
    falarComNavegador(texto);
}

function falarComNavegador(texto) {
    if (!texto || !('speechSynthesis' in window)) return;
    const fala = new SpeechSynthesisUtterance(texto);
    fala.lang = 'pt-BR';
    fala.rate = 1.02;
    const voz = speechSynthesis.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('pt-br'));
    if (voz) fala.voice = voz;
    speechSynthesis.cancel();
    speechSynthesis.speak(fala);
}

// Na primeira interação o navegador libera o áudio.
['pointerdown', 'keydown'].forEach((evento) => window.addEventListener(evento, function liberar() {
    if (ligado) obterContexto();
    carregarManifesto();
}, { once: true, passive: true }));

// ---------------------------------------------------------------------
// Síntese (reserva): pequenas peças sonoras feitas com osciladores e ruído.
// ---------------------------------------------------------------------
function nota(ctx, { freq, fim, tipo = 'sine', inicio = 0, duracao = 0.25, volume = 0.18, ataque = 0.004 }) {
    const t = ctx.currentTime + inicio;
    const osc = ctx.createOscillator();
    const ganho = ctx.createGain();
    osc.type = tipo;
    osc.frequency.setValueAtTime(freq, t);
    if (fim) osc.frequency.exponentialRampToValueAtTime(fim, t + duracao * 0.8);
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(volume, t + ataque);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
    osc.connect(ganho).connect(mestre);
    osc.start(t);
    osc.stop(t + duracao + 0.05);
}

function ruido(ctx, { inicio = 0, duracao = 0.25, volume = 0.12, de = 800, ate = 2400, q = 1.2, tipo = 'bandpass' }) {
    const t = ctx.currentTime + inicio;
    const tamanho = Math.ceil(ctx.sampleRate * duracao);
    const buffer = ctx.createBuffer(1, tamanho, ctx.sampleRate);
    const dados = buffer.getChannelData(0);
    for (let i = 0; i < tamanho; i++) dados[i] = Math.random() * 2 - 1;
    const fonte = ctx.createBufferSource();
    const filtro = ctx.createBiquadFilter();
    const ganho = ctx.createGain();
    fonte.buffer = buffer;
    filtro.type = tipo;
    filtro.Q.value = q;
    filtro.frequency.setValueAtTime(de, t);
    filtro.frequency.exponentialRampToValueAtTime(ate, t + duracao);
    ganho.gain.setValueAtTime(0.0001, t);
    ganho.gain.exponentialRampToValueAtTime(volume, t + duracao * 0.25);
    ganho.gain.exponentialRampToValueAtTime(0.0001, t + duracao);
    fonte.connect(filtro).connect(ganho).connect(mestre);
    fonte.start(t);
}

function sino(ctx, freq, inicio = 0, volume = 0.12, duracao = 0.9) {
    nota(ctx, { freq, inicio, duracao, volume });
    nota(ctx, { freq: freq * 2.76, inicio, duracao: duracao * 0.5, volume: volume * 0.35 });
    nota(ctx, { freq: freq * 5.4, inicio, duracao: duracao * 0.25, volume: volume * 0.15 });
}

const SINTESES = {
    adicionar(ctx) { nota(ctx, { freq: 480, fim: 920, duracao: 0.12, volume: 0.2 }); sino(ctx, 1760, 0.07, 0.07, 0.5); sino(ctx, 2349, 0.12, 0.05, 0.45); },
    favoritar(ctx) { nota(ctx, { freq: 620, fim: 1040, duracao: 0.11, volume: 0.16 }); nota(ctx, { freq: 2637, inicio: 0.08, duracao: 0.18, volume: 0.05 }); },
    remover(ctx) { nota(ctx, { freq: 420, fim: 190, duracao: 0.18, volume: 0.14 }); ruido(ctx, { duracao: 0.16, volume: 0.05, de: 1600, ate: 500 }); },
    sucesso(ctx) { [1046.5, 1318.5, 1568, 2093].forEach((f, i) => sino(ctx, f, i * 0.09, 0.09, 1.1)); },
    erro(ctx) { nota(ctx, { freq: 240, fim: 200, duracao: 0.12, volume: 0.16, tipo: 'triangle' }); nota(ctx, { freq: 190, fim: 160, inicio: 0.13, duracao: 0.16, volume: 0.14, tipo: 'triangle' }); },
    notificacao(ctx) { sino(ctx, 1318.5, 0, 0.08, 0.7); },
    cupom(ctx) { [1175, 1397, 1760, 2093, 2637].forEach((f, i) => nota(ctx, { freq: f, inicio: i * 0.045, duracao: 0.3, volume: 0.06, tipo: 'triangle' })); ruido(ctx, { duracao: 0.4, volume: 0.03, de: 3000, ate: 9000 }); },
    clique(ctx) { nota(ctx, { freq: 1900, fim: 1300, duracao: 0.035, volume: 0.07, tipo: 'triangle' }); },
    login(ctx) { sino(ctx, 784, 0, 0.1, 0.6); sino(ctx, 1046.5, 0.12, 0.1, 0.8); },
    logout(ctx) { ruido(ctx, { duracao: 0.38, volume: 0.07, de: 2200, ate: 380 }); },
    abrir(ctx) { ruido(ctx, { duracao: 0.24, volume: 0.05, de: 500, ate: 2600 }); },
    salvar(ctx) { nota(ctx, { freq: 2100, duracao: 0.03, volume: 0.08, tipo: 'square' }); nota(ctx, { freq: 1250, inicio: 0.045, duracao: 0.05, volume: 0.07, tipo: 'triangle' }); },
    excluir(ctx) { ruido(ctx, { duracao: 0.2, volume: 0.08, de: 2500, ate: 700, tipo: 'lowpass' }); nota(ctx, { freq: 140, fim: 90, inicio: 0.16, duracao: 0.2, volume: 0.16 }); },
    venda(ctx) { sino(ctx, 2637, 0, 0.08, 0.9); sino(ctx, 3136, 0.04, 0.05, 0.8); [0.14, 0.2, 0.27].forEach((t) => nota(ctx, { freq: 3400 + Math.random() * 600, inicio: t, duracao: 0.12, volume: 0.04 })); },
    vinheta(ctx) { [523.25, 659.25, 783.99, 987.77].forEach((f) => nota(ctx, { freq: f, duracao: 1.6, volume: 0.045, ataque: 0.35 })); sino(ctx, 2093, 0.9, 0.06, 0.9); sino(ctx, 2637, 1.0, 0.04, 0.8); },
    confete(ctx) { ruido(ctx, { duracao: 0.09, volume: 0.16, de: 1800, ate: 900 }); for (let i = 0; i < 9; i++) ruido(ctx, { inicio: 0.08 + i * 0.035, duracao: 0.03, volume: 0.04, de: 4000, ate: 6000 }); },
    moedas(ctx) { [0, 0.07, 0.13, 0.21].forEach((t, i) => { sino(ctx, 2800 + i * 260, t, 0.05, 0.35); }); }
};

function sintetizar(chave, ctx) {
    const peca = SINTESES[chave];
    if (peca) peca(ctx);
}
