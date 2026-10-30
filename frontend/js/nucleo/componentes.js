// Peças de interface da vitrine: cartões de produto e de loja, preço, estrelas,
// carrossel, paginação e contagem regressiva. Tudo montado com o DOM.
import { el } from './dom.js';
import { icone } from './icones.js';
import { moeda, partesPreco, numero, descontoPercentual, iniciais } from './formato.js';
import { precoPix, parcelamento } from './config.js';
import { adicionar } from './sacola.js';
import { tocar } from './sons.js';
import { avisar } from './ui.js';
import { api } from './api.js';
import { estaLogado, enderecoAtual, obterUsuario } from './sessao.js';

// Fotos de demonstração que acompanham o projeto: funcionam mesmo sem internet.
const FOTOS_LOCAIS = new Set([
    'photo-1441986300917-64674bd600d8', 'photo-1497366754035-f200968a6e72', 'photo-1505740420928-5e560c06d30e',
    'photo-1507473885765-e6ed057f782c', 'photo-1511499767150-a48a237f0083', 'photo-1516035069371-29a1b244cc32',
    'photo-1524805444758-089113d48a6d', 'photo-1542291026-7eec264c27ff', 'photo-1553062407-98eeb64c6a62',
    'photo-1602143407151-7111542de6e8'
]);
export const IMAGEM_RESERVA = 'assets/fotos/produto.svg';

/** Ajusta o tamanho das fotos do Unsplash e troca pelas cópias locais quando existem. */
export function urlImagem(url, { largura = 600, altura, qualidade = 78, dpr = 1 } = {}) {
    try {
        const endereco = new URL(url, window.location.href);
        if (endereco.hostname === 'images.unsplash.com') {
            const foto = endereco.pathname.slice(1);
            if (FOTOS_LOCAIS.has(foto)) return `assets/fotos/${foto}.jpg`;
            const busca = endereco.searchParams;
            busca.set('auto', 'format');
            busca.set('fit', 'crop');
            busca.set('w', String(largura));
            busca.set('q', String(qualidade));
            if (altura) { busca.set('h', String(altura)); busca.set('crop', 'entropy'); }
            if (dpr > 1) busca.set('dpr', String(dpr));
            return endereco.href;
        }
        if (!['http:', 'https:'].includes(endereco.protocol)) return IMAGEM_RESERVA;
        return endereco.href;
    } catch (erro) {
        return IMAGEM_RESERVA;
    }
}

export function imagem(url, alt, { largura = 600, altura, classe, prioridade = false } = {}) {
    const img = el('img', { alt: alt || '', decoding: 'async', classe });
    img.loading = prioridade ? 'eager' : 'lazy';
    if (prioridade) img.fetchPriority = 'high';
    if (largura && altura) { img.width = largura; img.height = altura; }
    const normal = urlImagem(url, { largura, altura });
    img.src = normal;
    if (normal.includes('images.unsplash.com')) img.srcset = `${normal} 1x, ${urlImagem(url, { largura, altura, dpr: 2 })} 2x`;
    img.addEventListener('error', function trocarPorReserva() {
        if (img.src.endsWith(IMAGEM_RESERVA)) return;
        img.removeAttribute('srcset');
        img.src = IMAGEM_RESERVA;
        img.classList.add('imagem-reserva');
    });
    return img;
}

export function estrelas(nota, total, { compacto = false } = {}) {
    const valor = Number(nota) || 0;
    const rotulo = total ? `Nota ${valor.toFixed(1).replace('.', ',')} de 5, ${total} avaliações` : 'Sem avaliações ainda';
    return el('span', { classe: 'estrelas', attrs: { 'aria-label': rotulo, title: rotulo }, estilo: { '--nota': String(valor) } }, [
        el('span', { classe: 'estrelas-icones', attrs: { 'aria-hidden': 'true' } }),
        total ? el('strong', { texto: valor.toFixed(1).replace('.', ',') }) : null,
        compacto ? (total ? `(${numero(total)})` : null) : (total ? `${numero(total)} ${total === 1 ? 'avaliação' : 'avaliações'}` : 'Novo')
    ]);
}

export function valorGrande(valor) {
    const partes = partesPreco(valor);
    return el('span', { classe: 'preco-valor', attrs: { 'aria-label': moeda(valor) } }, [
        el('span', { classe: 'moeda', texto: 'R$' }), partes.inteiro, el('span', { classe: 'centavos', texto: ',' + partes.centavos })
    ]);
}

export function blocoPreco(produto, config, { detalhado = true } = {}) {
    const desconto = descontoPercentual(produto.preco, produto.preco_original);
    const parcelas = parcelamento(produto.preco, config);
    return el('div', { classe: 'preco' }, [
        produto.preco_original ? el('span', { classe: 'preco-de', texto: moeda(produto.preco_original), attrs: { 'aria-label': 'Preço anterior ' + moeda(produto.preco_original) } }) : null,
        el('div', { classe: 'preco-por' }, [valorGrande(produto.preco), desconto >= 1 ? el('span', { classe: 'preco-desconto', texto: `${desconto}% OFF` }) : null]),
        detalhado ? el('span', { classe: 'preco-pix', texto: `${moeda(precoPix(produto.preco, config))} no Pix` }) : null,
        detalhado && parcelas.vezes > 1 ? el('span', { classe: 'preco-parcelas', texto: `em até ${parcelas.vezes}x de ${moeda(parcelas.valor)} sem juros` }) : null
    ]);
}

// ---------- Favoritos ----------
let favoritosPedido = null;
export function carregarFavoritos() {
    if (!estaLogado()) return Promise.resolve(new Set());
    if (!favoritosPedido) {
        favoritosPedido = api('/favoritos/ids').then((dados) => new Set(dados.ids)).catch(() => new Set());
    }
    return favoritosPedido;
}

export function botaoFavorito(produtoId, favoritos, { classe = 'botao-favorito' } = {}) {
    const marcado = () => favoritos && favoritos.has(produtoId);
    const botao = el('button', { type: 'button', classe, attrs: { 'aria-pressed': String(marcado()), 'aria-label': marcado() ? 'Remover dos favoritos' : 'Salvar nos favoritos' } }, [icone('coracao')]);
    botao.addEventListener('click', async (evento) => {
        evento.preventDefault();
        evento.stopPropagation();
        if (!estaLogado()) {
            window.location.href = 'login.html?voltar=' + encodeURIComponent(enderecoAtual());
            return;
        }
        const ativo = marcado();
        botao.setAttribute('aria-pressed', String(!ativo));
        botao.classList.add('animar');
        try {
            await api('/favoritos/' + produtoId, { metodo: ativo ? 'DELETE' : 'POST' });
            if (ativo) favoritos.delete(produtoId); else favoritos.add(produtoId);
            botao.setAttribute('aria-label', ativo ? 'Salvar nos favoritos' : 'Remover dos favoritos');
            if (!ativo) tocar('favoritar');
        } catch (erro) {
            botao.setAttribute('aria-pressed', String(ativo));
            avisar(erro.message, { tipo: 'erro' });
        } finally {
            setTimeout(() => botao.classList.remove('animar'), 400);
        }
    });
    return botao;
}

// ---------- Adicionar à sacola com animação ----------
export function adicionarComEfeito(produto, origem, quantidade = 1) {
    const usuario = obterUsuario();
    if (usuario && usuario.nivel !== 'comprador') {
        avisar('Compras são feitas com uma conta de cliente. Entre como comprador para usar a sacola.', { tipo: 'info' });
        return false;
    }
    const resultado = adicionar(produto, quantidade);
    if (!resultado.ok) {
        avisar(resultado.mensagem, { tipo: 'erro' });
        return false;
    }
    tocar('adicionar');
    voarParaSacola(origem);
    if (resultado.limitado) avisar(resultado.mensagem, { tipo: 'info', som: false });
    return true;
}

function voarParaSacola(origem) {
    const destino = document.querySelector('.sacola-icone');
    if (!origem || !destino || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const a = origem.getBoundingClientRect();
    const b = destino.getBoundingClientRect();
    const gota = el('span', { classe: 'gota-ambar', attrs: { 'aria-hidden': 'true' } });
    document.body.appendChild(gota);
    const x0 = a.left + a.width / 2 - 9;
    const y0 = a.top + a.height / 2 - 9;
    const dx = b.left + b.width / 2 - 9 - x0;
    const dy = b.top + b.height / 2 - 9 - y0;
    gota.style.left = x0 + 'px';
    gota.style.top = y0 + 'px';
    gota.animate([
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 90}px) scale(1.15)`, opacity: 1, offset: 0.45 },
        { transform: `translate(${dx}px, ${dy}px) scale(.35)`, opacity: .8 }
    ], { duration: 720, easing: 'cubic-bezier(.45, 0, .25, 1)' }).finished.then(() => {
        gota.remove();
        const botao = destino.closest('.sacola-botao');
        if (botao) {
            botao.classList.remove('pulsar');
            void botao.offsetWidth;
            botao.classList.add('pulsar');
        }
    }).catch(() => gota.remove());
}

// ---------- Cartão de produto ----------
export function cartaoProduto(p, { config, favoritos } = {}) {
    const desconto = descontoPercentual(p.preco, p.preco_original);
    const esgotado = Number(p.estoque) <= 0;
    const link = `produto.html?id=${p.id}`;
    const selos = el('div', { classe: 'cartao-selos' }, [
        desconto >= 5 ? el('span', { classe: 'selo selo-rubi', texto: `-${desconto}%` }) : null,
        p.destaque ? el('span', { classe: 'selo selo-escuro' }, [icone('brilho'), 'Curadoria']) : null
    ]);
    const botaoAdicionar = el('button', {
        type: 'button', classe: 'cartao-adicionar', disabled: esgotado,
        attrs: { 'aria-label': esgotado ? 'Produto esgotado' : `Adicionar ${p.nome} à sacola`, title: 'Adicionar à sacola' }
    }, [icone('sacola'), el('span', { texto: esgotado ? 'Esgotado' : 'Adicionar' })]);
    botaoAdicionar.addEventListener('click', (evento) => {
        evento.preventDefault();
        if (adicionarComEfeito(p, botaoAdicionar)) avisar(p.nome, { tipo: 'sucesso', titulo: 'Na sua sacola', som: false, duracao: 2600 });
    });
    const estoqueBaixo = !esgotado && Number(p.estoque) <= 5;
    return el('article', { classe: 'cartao-produto' + (esgotado ? ' esgotado' : '') }, [
        el('div', { classe: 'cartao-midia' }, [
            el('a', { href: link, attrs: { tabindex: '-1', 'aria-hidden': 'true' } }, [imagem(p.imagem, '', { largura: 520, altura: 520 })]),
            selos,
            botaoFavorito(p.id, favoritos),
            esgotado ? el('span', { classe: 'faixa-esgotado', texto: 'Esgotado' }) : null,
            botaoAdicionar
        ]),
        el('div', { classe: 'cartao-info' }, [
            p.loja ? el('a', { classe: 'cartao-loja', href: `loja.html?slug=${encodeURIComponent(p.loja.slug)}`, texto: p.loja.nome }) : null,
            el('h3', { classe: 'cartao-nome' }, [el('a', { href: link, texto: p.nome })]),
            estrelas(p.avaliacao_media, p.total_avaliacoes, { compacto: true }),
            config ? blocoPreco(p, config) : null,
            el('div', { classe: 'cartao-extras' }, [
                p.frete_gratis ? el('span', { classe: 'selo selo-esmeralda' }, [icone('caminhao'), 'Frete grátis']) : null,
                estoqueBaixo ? el('span', { classe: 'selo selo-ambar', texto: `Só ${p.estoque} em estoque` }) : null
            ])
        ])
    ]);
}

export function cartoesEsqueleto(quantidade = 6) {
    return Array.from({ length: quantidade }, () => el('div', { classe: 'cartao-produto cartao-esqueleto', attrs: { 'aria-hidden': 'true' } }, [
        el('div', { classe: 'esqueleto cartao-esqueleto-midia' }),
        el('div', { classe: 'esqueleto', estilo: { height: '14px', width: '45%', margin: '14px 14px 8px' } }),
        el('div', { classe: 'esqueleto', estilo: { height: '16px', width: '85%', margin: '0 14px 8px' } }),
        el('div', { classe: 'esqueleto', estilo: { height: '26px', width: '55%', margin: '0 14px 16px' } })
    ]));
}

// ---------- Carrossel horizontal ----------
export function carrossel(nos, { rotulo = 'Produtos', classe = '' } = {}) {
    const trilho = el('div', { classe: 'carrossel-trilho', attrs: { role: 'list' } },
        nos.map((no) => el('div', { classe: 'carrossel-item', attrs: { role: 'listitem' } }, [no])));
    const anterior = el('button', { type: 'button', classe: 'carrossel-seta anterior', attrs: { 'aria-label': 'Ver anteriores' } }, [icone('chevron-esquerda')]);
    const proximo = el('button', { type: 'button', classe: 'carrossel-seta proximo', attrs: { 'aria-label': 'Ver próximos' } }, [icone('chevron-direita')]);
    const rolar = (direcao) => trilho.scrollBy({ left: direcao * trilho.clientWidth * 0.86, behavior: 'smooth' });
    anterior.addEventListener('click', () => rolar(-1));
    proximo.addEventListener('click', () => rolar(1));
    const atualizar = () => {
        anterior.disabled = trilho.scrollLeft <= 4;
        proximo.disabled = trilho.scrollLeft + trilho.clientWidth >= trilho.scrollWidth - 4;
    };
    trilho.addEventListener('scroll', atualizar, { passive: true });
    new ResizeObserver(atualizar).observe(trilho);
    return el('div', { classe: 'carrossel ' + classe, attrs: { role: 'region', 'aria-label': rotulo } }, [anterior, trilho, proximo]);
}

// ---------- Paginação ----------
export function paginacao({ pagina, paginas, aoMudar }) {
    if (paginas <= 1) return el('nav', { hidden: true });
    const numeros = new Set([1, paginas, pagina - 1, pagina, pagina + 1].filter((n) => n >= 1 && n <= paginas));
    const ordenados = [...numeros].sort((a, b) => a - b);
    const botoes = [];
    let anterior = 0;
    for (const n of ordenados) {
        if (n - anterior > 1) botoes.push(el('span', { classe: 'paginacao-reticencias', texto: '…' }));
        botoes.push(el('button', {
            type: 'button', classe: 'paginacao-numero', texto: String(n),
            attrs: { 'aria-current': n === pagina ? 'page' : null, 'aria-label': `Página ${n}` },
            ao: { click: () => aoMudar(n) }
        }));
        anterior = n;
    }
    return el('nav', { classe: 'paginacao', attrs: { 'aria-label': 'Paginação' } }, [
        el('button', { type: 'button', classe: 'botao botao-pequeno', disabled: pagina <= 1, ao: { click: () => aoMudar(pagina - 1) } }, [icone('chevron-esquerda'), 'Anterior']),
        el('div', { classe: 'paginacao-numeros' }, botoes),
        el('button', { type: 'button', classe: 'botao botao-pequeno', disabled: pagina >= paginas, ao: { click: () => aoMudar(pagina + 1) } }, ['Próxima', icone('chevron-direita')])
    ]);
}

// ---------- Contagem regressiva ----------
export function contagemRegressiva(alvo) {
    const partes = ['h', 'min', 's'].map((rotulo) => el('span', { classe: 'contagem-bloco' }, [el('strong', { texto: '00' }), el('small', { texto: rotulo })]));
    const caixa = el('span', { classe: 'contagem', attrs: { role: 'timer', 'aria-label': 'Tempo restante da oferta' } }, partes);
    const atualizar = () => {
        const restante = Math.max(0, alvo.getTime() - Date.now());
        const valores = [Math.floor(restante / 3600000), Math.floor((restante % 3600000) / 60000), Math.floor((restante % 60000) / 1000)];
        valores.forEach((valor, i) => { partes[i].firstChild.textContent = String(valor).padStart(2, '0'); });
    };
    atualizar();
    const temporizador = setInterval(() => { if (!caixa.isConnected) clearInterval(temporizador); else atualizar(); }, 1000);
    return caixa;
}

// ---------- Lojas ----------
export function monograma(nome, cor) {
    return el('span', { classe: 'monograma', texto: iniciais(nome), estilo: { '--cor-loja': cor || '#9a5208' }, attrs: { 'aria-hidden': 'true' } });
}

export function cartaoLoja(loja) {
    return el('a', { classe: 'cartao-loja-destaque', href: `loja.html?slug=${encodeURIComponent(loja.slug)}`, estilo: { '--cor-loja': loja.cor } }, [
        el('div', { classe: 'cartao-loja-faixa' }, (loja.vitrine || []).slice(0, 3).map((foto) => imagem(foto, '', { largura: 220, altura: 220 }))),
        el('div', { classe: 'cartao-loja-corpo' }, [
            monograma(loja.nome, loja.cor),
            el('div', {}, [
                el('h3', { texto: loja.nome }),
                el('p', { classe: 'pequeno suave' }, [icone('pin'), `${loja.cidade}, ${loja.uf}`])
            ])
        ]),
        el('div', { classe: 'cartao-loja-rodape' }, [
            estrelas(loja.avaliacao_media, loja.total_avaliacoes, { compacto: true }),
            el('span', { classe: 'pequeno suave', texto: `${numero(loja.total_produtos)} produtos` })
        ])
    ]);
}

// ---------- Outros ----------
export function estadoVazio({ nomeIcone = 'sacola', titulo, texto, acao } = {}) {
    return el('div', { classe: 'estado-vazio' }, [
        icone(nomeIcone),
        el('h3', { texto: titulo }),
        texto ? el('p', { texto }) : null,
        acao ? el('a', { classe: 'botao botao-ambar', href: acao.href, texto: acao.texto }) : null
    ]);
}

export function tituloSecao(titulo, { subtitulo, link, id } = {}) {
    return el('div', { classe: 'titulo-secao' }, [
        el('div', {}, [el('h2', { texto: titulo, id }), subtitulo ? el('p', { texto: subtitulo }) : null]),
        link ? el('a', { classe: 'link', href: link.href }, [link.texto]) : null
    ]);
}
