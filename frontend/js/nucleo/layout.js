// Topo, navegação, gaveta da sacola e rodapé — montados aqui e usados por todas as páginas.
import { el, $, debounce, ler, guardar, parametros } from './dom.js';
import { icone, iconeSacola } from './icones.js';
import { api, consulta } from './api.js';
import { obterSessao, encerrarSessao, paginaDoNivel } from './sessao.js';
import { obterConfig } from './config.js';
import { lerSacola, alterarQuantidade, removerItem, totalItens, subtotalCentavos } from './sacola.js';
import { moeda, cep as formatarCep, iniciais, primeiroNome, deCentavos } from './formato.js';
import { tocar, sonsLigados, definirSons, carregarManifesto } from './sons.js';
import { imagem } from './componentes.js';
import { abrirDialogo, avisar } from './ui.js';

let categoriasPedido = null;
export function obterCategorias() {
    if (!categoriasPedido) categoriasPedido = api('/categorias').then((d) => d.categorias).catch(() => []);
    return categoriasPedido;
}

export async function iniciarPagina({ ativo = '', simples = false } = {}) {
    carregarManifesto();
    const topo = document.getElementById('topo');
    const rodape = document.getElementById('rodape');
    if (topo) topo.replaceChildren(...montarTopo({ ativo, simples }));
    if (rodape) rodape.replaceChildren(...montarRodape({ simples }));
    if (!simples) {
        montarGaveta();
        atualizarSacolaTopo();
        window.addEventListener('ambar:sacola', () => { atualizarSacolaTopo(); if (gavetaAberta()) desenharGaveta(); });
        window.addEventListener('storage', (evento) => { if (evento.key === 'ambar:sacola') atualizarSacolaTopo(); });
    }
    window.addEventListener('ambar:sessao', () => desenharConta());
    const [config, categorias] = await Promise.all([obterConfig(), simples ? [] : obterCategorias()]);
    preencherAvisos(config);
    if (!simples) preencherCategorias(categorias);
    return { config, categorias };
}

// ---------------------------------------------------------------------
// Topo
// ---------------------------------------------------------------------
function montarTopo({ ativo, simples }) {
    const faixa = el('div', { classe: 'faixa-avisos', id: 'faixa-avisos' }, [el('div', { classe: 'conteiner' })]);
    const logo = el('a', { classe: 'topo-logo', href: 'index.html', attrs: { 'aria-label': 'Âmbar — página inicial' } }, [
        el('img', { src: 'assets/marca/logo-ambar-claro.svg', alt: 'Âmbar', width: 132, height: 36 })
    ]);
    if (simples) {
        return [el('header', { classe: 'topo' }, [el('div', { classe: 'topo-principal' }, [el('div', { classe: 'conteiner' }, [
            logo,
            el('span', { classe: 'topo-seguro' }, [icone('cadeado'), 'Ambiente seguro']),
            el('div', { classe: 'topo-acoes' }, [botaoSom()])
        ])])])];
    }
    const principal = el('div', { classe: 'topo-principal' }, [el('div', { classe: 'conteiner' }, [
        logo,
        botaoCep(),
        montarBusca(),
        el('div', { classe: 'topo-acoes' }, [
            botaoSom(),
            el('div', { classe: 'menu-conta', id: 'menu-conta' }),
            el('a', { classe: 'topo-icone', href: 'conta.html#favoritos', attrs: { 'aria-label': 'Favoritos', title: 'Favoritos' } }, [icone('coracao')]),
            el('button', { type: 'button', classe: 'topo-acao sacola-botao', attrs: { 'aria-label': 'Abrir sacola' }, ao: { click: abrirGaveta } }, [
                el('span', { classe: 'sacola-icone' }, [iconeSacola(), el('span', { classe: 'contador', id: 'contador-sacola', texto: '0' })]),
                el('span', { classe: 'rotulo-sacola' }, [el('small', { texto: 'Sua' }), el('strong', { texto: 'Sacola' })])
            ])
        ])
    ])]);
    const links = [
        ['ofertas', 'busca.html?desconto=1&ordem=desconto', 'Ofertas do dia', 'raio'],
        ['vendidos', 'busca.html?ordem=mais_vendidos', 'Mais vendidos', 'brilho'],
        ['novidades', 'busca.html?ordem=novidades', 'Novidades', null],
        ['lojas', 'index.html#lojas', 'Lojas independentes', 'loja'],
        ['curadoria', 'busca.html?destaque=1', 'Curadoria Âmbar', null]
    ];
    const nav = el('nav', { classe: 'topo-nav', attrs: { 'aria-label': 'Navegação principal' } }, [el('div', { classe: 'conteiner' }, [
        el('button', { type: 'button', id: 'botao-categorias', attrs: { 'aria-expanded': 'false', 'aria-controls': 'mega-menu' }, ao: { click: alternarMegaMenu } }, [icone('menu'), 'Todas as categorias']),
        ...links.map(([chave, href, texto, nomeIcone]) => el('a', { href, attrs: { 'aria-current': ativo === chave ? 'page' : null }, classe: chave === 'ofertas' ? 'destaque-nav' : '' }, [nomeIcone ? icone(nomeIcone) : null, texto])),
        el('a', { href: 'vender.html', classe: 'nav-direita', attrs: { 'aria-current': ativo === 'vender' ? 'page' : null } }, [icone('megafone'), 'Venda na Âmbar'])
    ])]);
    const mega = el('div', { classe: 'mega-menu', id: 'mega-menu', hidden: true }, [el('div', { classe: 'conteiner', id: 'mega-menu-itens' })]);
    const topo = el('header', { classe: 'topo' }, [principal, nav, mega]);
    queueMicrotask(desenharConta);
    return [el('a', { classe: 'pular-conteudo visualmente-oculto', href: '#conteudo', texto: 'Pular para o conteúdo' }), faixa, topo];
}

function preencherAvisos(config) {
    const caixa = $('#faixa-avisos .conteiner');
    if (!caixa) return;
    const icones = ['caminhao', 'pix', 'cupom'];
    caixa.replaceChildren(...(config.aviso_topo || []).slice(0, 3).map((texto, i) => el('span', {}, [icone(icones[i] || 'brilho'), texto])));
}

function botaoSom() {
    const botao = el('button', { type: 'button', classe: 'topo-icone', id: 'botao-som' });
    const desenhar = () => {
        const ligado = sonsLigados();
        botao.replaceChildren(icone(ligado ? 'som' : 'som-mudo'));
        botao.setAttribute('aria-pressed', String(ligado));
        botao.setAttribute('aria-label', ligado ? 'Desligar sons da loja' : 'Ligar sons da loja');
        botao.title = ligado ? 'Sons ligados' : 'Sons desligados';
    };
    botao.addEventListener('click', () => definirSons(!sonsLigados()));
    window.addEventListener('ambar:sons', desenhar);
    desenhar();
    return botao;
}

// ---------- CEP ----------
export function cepSalvo() {
    return ler('ambar:cep', null);
}

function botaoCep() {
    const botao = el('button', { type: 'button', classe: 'topo-acao topo-cep', id: 'botao-cep' });
    const desenhar = () => {
        const salvo = cepSalvo();
        botao.replaceChildren(icone('pin'), el('span', {}, [
            el('small', { texto: salvo ? 'Enviar para' : 'Olá! Informe' }),
            el('strong', { texto: salvo ? `${salvo.cidade ? salvo.cidade + ' ' : ''}${formatarCep(salvo.cep)}` : 'seu CEP' })
        ]));
    };
    botao.addEventListener('click', () => abrirDialogoCep(desenhar));
    window.addEventListener('ambar:cep', desenhar);
    desenhar();
    return botao;
}

export async function consultarCep(cep) {
    // ViaCEP: serviço público e gratuito de consulta de endereços pelo CEP.
    try {
        const resposta = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const dados = await resposta.json();
        return dados && !dados.erro ? dados : null;
    } catch (erro) {
        return null;
    }
}

export function abrirDialogoCep(aoSalvar) {
    const entrada = el('input', { classe: 'entrada', name: 'cep', inputMode: 'numeric', autocomplete: 'postal-code', placeholder: '00000-000', maxLength: 9, value: cepSalvo() ? formatarCep(cepSalvo().cep) : '' });
    const formulario = el('form', { classe: 'pilha', id: 'form-cep' }, [
        el('p', { classe: 'suave', texto: 'Usamos o CEP para mostrar prazos e o valor do frete. Ele fica salvo só neste navegador.' }),
        el('div', { classe: 'campo' }, [el('label', { texto: 'CEP', htmlFor: 'cep-dialogo' }), entrada])
    ]);
    entrada.id = 'cep-dialogo';
    entrada.addEventListener('input', () => { entrada.value = entrada.value.replace(/\D/g, '').slice(0, 8).replace(/^(\d{5})(\d)/, '$1-$2'); });
    const { fechar } = abrirDialogo({
        titulo: 'Para onde vamos enviar?',
        conteudo: formulario,
        acoes: [{ texto: 'Salvar CEP', classe: 'botao-ambar', tipo: 'submit', form: 'form-cep' }]
    });
    formulario.addEventListener('submit', async (evento) => {
        evento.preventDefault();
        const digitos = entrada.value.replace(/\D/g, '');
        if (digitos.length !== 8) { avisar('Digite os 8 números do CEP.', { tipo: 'erro' }); return; }
        const endereco = await consultarCep(digitos);
        guardar('ambar:cep', { cep: digitos, cidade: endereco ? endereco.localidade : '', uf: endereco ? endereco.uf : '' });
        window.dispatchEvent(new CustomEvent('ambar:cep'));
        tocar('salvar');
        if (aoSalvar) aoSalvar();
        fechar();
    });
    setTimeout(() => entrada.focus(), 50);
}

// ---------- Busca com sugestões ----------
function montarBusca() {
    const atuais = parametros();
    const selecao = el('select', { name: 'categoria', attrs: { 'aria-label': 'Categoria da busca' } }, [el('option', { value: '', texto: 'Todas' })]);
    const entrada = el('input', {
        type: 'search', name: 'q', placeholder: 'Busque por produtos, lojas e marcas', autocomplete: 'off', value: atuais.get('q') || '',
        attrs: { 'aria-label': 'Buscar na Âmbar', role: 'combobox', 'aria-autocomplete': 'list', 'aria-expanded': 'false', 'aria-controls': 'sugestoes-busca' }
    });
    const lista = el('div', { classe: 'sugestoes', id: 'sugestoes-busca', hidden: true, attrs: { role: 'listbox' } });
    const formulario = el('form', { action: 'busca.html', attrs: { role: 'search' } }, [
        selecao, entrada,
        el('button', { type: 'submit', attrs: { 'aria-label': 'Buscar' } }, [icone('busca')])
    ]);
    formulario.addEventListener('submit', (evento) => {
        evento.preventDefault();
        const destino = 'busca.html' + consulta({ q: entrada.value.trim(), categoria: selecao.value });
        window.location.href = destino;
    });
    let controlador = null;
    const fecharLista = () => { lista.hidden = true; entrada.setAttribute('aria-expanded', 'false'); };
    const buscar = debounce(async () => {
        const termo = entrada.value.trim();
        if (termo.length < 2) return fecharLista();
        if (controlador) controlador.abort();
        controlador = new AbortController();
        try {
            const dados = await api('/produtos' + consulta({ q: termo, categoria: selecao.value, limite: 6 }), { sinal: controlador.signal });
            if (!dados.itens.length) {
                lista.replaceChildren(el('p', { classe: 'suave', estilo: { padding: '12px' }, texto: `Nada encontrado para “${termo}”. Tente outra palavra.` }));
            } else {
                lista.replaceChildren(
                    ...dados.itens.map((p) => el('a', { classe: 'sugestao', href: `produto.html?id=${p.id}`, attrs: { role: 'option' } }, [
                        imagem(p.imagem, '', { largura: 96, altura: 96 }),
                        el('span', {}, [el('strong', { texto: p.nome }), el('small', { texto: p.loja ? p.loja.nome : '' })]),
                        el('span', { classe: 'valor', texto: moeda(p.preco) })
                    ])),
                    el('a', { classe: 'ver-todos', href: 'busca.html' + consulta({ q: termo, categoria: selecao.value }), texto: `Ver todos os ${dados.total} resultados` })
                );
            }
            lista.hidden = false;
            entrada.setAttribute('aria-expanded', 'true');
        } catch (erro) {
            if (erro.name !== 'AbortError') fecharLista();
        }
    }, 220);
    entrada.addEventListener('input', buscar);
    entrada.addEventListener('focus', () => { if (lista.childElementCount && entrada.value.trim().length >= 2) lista.hidden = false; });
    entrada.addEventListener('keydown', (evento) => {
        if (evento.key === 'ArrowDown' && !lista.hidden) { evento.preventDefault(); lista.querySelector('a')?.focus(); }
        if (evento.key === 'Escape') fecharLista();
    });
    lista.addEventListener('keydown', (evento) => {
        const itens = [...lista.querySelectorAll('a')];
        const atual = itens.indexOf(document.activeElement);
        if (evento.key === 'ArrowDown') { evento.preventDefault(); itens[Math.min(itens.length - 1, atual + 1)]?.focus(); }
        if (evento.key === 'ArrowUp') { evento.preventDefault(); if (atual <= 0) entrada.focus(); else itens[atual - 1].focus(); }
        if (evento.key === 'Escape') { fecharLista(); entrada.focus(); }
    });
    document.addEventListener('click', (evento) => { if (!evento.target.closest('.busca')) fecharLista(); });
    return el('div', { classe: 'busca' }, [formulario, lista]);
}

function preencherCategorias(categorias) {
    const selecao = $('.busca select');
    const atual = parametros().get('categoria');
    if (selecao) {
        categorias.forEach((c) => selecao.append(el('option', { value: c.slug, texto: c.nome, selected: c.slug === atual })));
    }
    const mega = $('#mega-menu-itens');
    if (mega) {
        mega.replaceChildren(...categorias.map((c) => el('a', { href: `busca.html?categoria=${c.slug}` }, [
            el('span', { classe: 'icone-categoria' }, [icone(c.icone)]),
            el('span', {}, [el('strong', { texto: c.nome }), el('small', { texto: `${c.total_produtos} produtos` })])
        ])));
    }
}

function alternarMegaMenu() {
    const mega = $('#mega-menu');
    const botao = $('#botao-categorias');
    const abrir = mega.hidden;
    mega.hidden = !abrir;
    botao.setAttribute('aria-expanded', String(abrir));
    if (abrir) {
        tocar('abrir');
        const fechar = (evento) => {
            if (evento.type === 'keydown' && evento.key !== 'Escape') return;
            if (evento.type === 'click' && (evento.target.closest('#mega-menu') || evento.target.closest('#botao-categorias'))) return;
            mega.hidden = true;
            botao.setAttribute('aria-expanded', 'false');
            document.removeEventListener('click', fechar);
            document.removeEventListener('keydown', fechar);
        };
        setTimeout(() => { document.addEventListener('click', fechar); document.addEventListener('keydown', fechar); });
    }
}

// ---------- Conta ----------
function linksDaConta(nivel) {
    if (nivel === 'admin') return [['grafico', 'admin.html', 'Painel administrativo'], ['pacote', 'admin.html#pedidos', 'Pedidos'], ['usuarios', 'admin.html#usuarios', 'Usuários'], ['loja', 'admin.html#lojas', 'Lojas e solicitações']];
    if (nivel === 'vendedor') return [['grafico', 'vendedor.html', 'Central do vendedor'], ['tag', 'vendedor.html#produtos', 'Meus produtos'], ['pacote', 'vendedor.html#pedidos', 'Pedidos da loja'], ['chat', 'vendedor.html#perguntas', 'Perguntas de clientes']];
    return [['usuario', 'conta.html', 'Minha conta'], ['pacote', 'conta.html#pedidos', 'Meus pedidos'], ['coracao', 'conta.html#favoritos', 'Favoritos'], ['pin', 'conta.html#enderecos', 'Endereços'], ['loja', 'vender.html', 'Quero vender na Âmbar']];
}

function desenharConta() {
    const caixa = $('#menu-conta');
    if (!caixa) return;
    const sessao = obterSessao();
    const usuario = sessao && sessao.usuario;
    const painel = el('div', { classe: 'menu-conta-painel', hidden: true, id: 'painel-conta' });
    const botao = el('button', { type: 'button', classe: 'topo-acao topo-acao-conta', attrs: { 'aria-expanded': 'false', 'aria-controls': 'painel-conta' } }, [
        icone('usuario'),
        el('span', { classe: 'topo-acao-texto' }, [
            el('small', { texto: usuario ? `Olá, ${primeiroNome(usuario.nome)}` : 'Olá, faça seu login' }),
            el('strong', {}, [usuario ? 'Conta e pedidos' : 'Entrar ou cadastrar'])
        ])
    ]);
    if (usuario) {
        painel.append(
            el('div', { classe: 'cabecalho' }, [
                el('span', { classe: 'avatar', texto: iniciais(usuario.nome) }),
                el('div', {}, [el('strong', { texto: usuario.nome }), el('small', { classe: 'sutil', texto: usuario.email })])
            ]),
            ...linksDaConta(usuario.nivel).map(([nomeIcone, href, texto]) => el('a', { href }, [icone(nomeIcone), texto])),
            el('div', { classe: 'separador' }),
            el('button', { type: 'button', classe: 'item', ao: { click: sair } }, [icone('sair'), 'Sair'])
        );
    } else {
        painel.append(
            el('div', { classe: 'pilha', estilo: { '--espaco': '8px', padding: '8px' } }, [
                el('a', { classe: 'botao botao-ambar', href: 'login.html?voltar=' + encodeURIComponent(location.pathname.split('/').pop() + location.search), texto: 'Entrar' }),
                el('p', { classe: 'pequeno suave', estilo: { 'text-align': 'center' } }, ['Cliente novo? ', el('a', { classe: 'link', href: 'cadastro.html', texto: 'Crie sua conta' })])
            ]),
            el('div', { classe: 'separador' }),
            el('a', { href: 'vender.html' }, [icone('loja'), 'Venda na Âmbar'])
        );
    }
    botao.addEventListener('click', (evento) => {
        evento.stopPropagation();
        const abrir = painel.hidden;
        painel.hidden = !abrir;
        botao.setAttribute('aria-expanded', String(abrir));
    });
    document.addEventListener('click', (evento) => { if (!evento.target.closest('#menu-conta')) { painel.hidden = true; botao.setAttribute('aria-expanded', 'false'); } });
    caixa.replaceChildren(botao, painel);
}

export function sair() {
    tocar('logout');
    encerrarSessao();
    setTimeout(() => { window.location.href = 'index.html'; }, 250);
}

// ---------------------------------------------------------------------
// Sacola no topo e gaveta
// ---------------------------------------------------------------------
function atualizarSacolaTopo() {
    const contador = $('#contador-sacola');
    if (!contador) return;
    const quantidade = totalItens();
    contador.textContent = String(quantidade);
    contador.hidden = quantidade === 0;
    const nivel = $('.sacola-icone .nivel');
    if (nivel) nivel.style.transform = `scaleY(${Math.min(1, quantidade / 6)})`;
}

const gavetaAberta = () => $('#gaveta-sacola')?.classList.contains('aberta');

function montarGaveta() {
    if ($('#gaveta-sacola')) return;
    const veu = el('div', { classe: 'veu', id: 'veu-gaveta', ao: { click: fecharGaveta } });
    const gaveta = el('aside', { classe: 'gaveta', id: 'gaveta-sacola', attrs: { 'aria-label': 'Sua sacola', 'aria-hidden': 'true' } }, [
        el('div', { classe: 'gaveta-topo' }, [
            el('h2', { texto: 'Sua sacola' }),
            el('button', { type: 'button', classe: 'botao botao-fantasma botao-icone', attrs: { 'aria-label': 'Fechar sacola' }, ao: { click: fecharGaveta } }, [icone('fechar')])
        ]),
        el('div', { classe: 'gaveta-corpo', id: 'gaveta-itens' }),
        el('div', { classe: 'gaveta-rodape', id: 'gaveta-rodape' })
    ]);
    document.body.append(veu, gaveta);
    document.addEventListener('keydown', (evento) => { if (evento.key === 'Escape' && gavetaAberta()) fecharGaveta(); });
}

export function abrirGaveta() {
    desenharGaveta();
    $('#veu-gaveta').classList.add('visivel');
    const gaveta = $('#gaveta-sacola');
    gaveta.classList.add('aberta');
    gaveta.setAttribute('aria-hidden', 'false');
    tocar('abrir');
    setTimeout(() => gaveta.querySelector('button')?.focus(), 60);
}

function fecharGaveta() {
    $('#veu-gaveta')?.classList.remove('visivel');
    const gaveta = $('#gaveta-sacola');
    gaveta?.classList.remove('aberta');
    gaveta?.setAttribute('aria-hidden', 'true');
}

export function metaFreteGratis(subtotal, config) {
    const minimo = Math.round(config.frete_gratis_minimo * 100);
    const falta = Math.max(0, minimo - subtotal);
    const atingida = falta === 0;
    return el('div', { classe: 'meta-frete' + (atingida ? ' atingida' : '') }, [
        atingida
            ? el('span', {}, [el('strong', { texto: 'Frete grátis liberado! ' }), 'Na entrega econômica para todo o Brasil.'])
            : el('span', {}, ['Faltam ', el('strong', { texto: moeda(deCentavos(falta)) }), ' para ganhar frete grátis.']),
        el('div', { classe: 'barra-meta', attrs: { role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': String(Math.round(Math.min(1, subtotal / minimo) * 100)) } }, [
            el('span', { estilo: { width: `${Math.min(100, (subtotal / minimo) * 100)}%` } })
        ])
    ]);
}

async function desenharGaveta() {
    const itens = lerSacola();
    const corpo = $('#gaveta-itens');
    const rodape = $('#gaveta-rodape');
    if (!itens.length) {
        corpo.replaceChildren(el('div', { classe: 'estado-vazio' }, [
            iconeSacola(),
            el('h3', { texto: 'Sua sacola está vazia' }),
            el('p', { texto: 'Explore as lojas independentes e encontre algo que brilhe.' }),
            el('a', { classe: 'botao botao-ambar', href: 'busca.html', texto: 'Explorar produtos' })
        ]));
        rodape.hidden = true;
        return;
    }
    rodape.hidden = false;
    corpo.replaceChildren(...itens.map((item) => el('div', { classe: 'item-gaveta' }, [
        el('a', { href: `produto.html?id=${item.id}` }, [imagem(item.produto.imagem, item.produto.nome, { largura: 144, altura: 144 })]),
        el('div', {}, [
            el('h3', {}, [el('a', { href: `produto.html?id=${item.id}`, texto: item.produto.nome })]),
            el('small', { classe: 'sutil', texto: item.produto.loja }),
            el('div', { classe: 'linha-flex' }, [
                seletorQuantidade(item.quantidade, item.produto.estoque, (n) => alterarQuantidade(item.id, n), () => { tocar('remover'); removerItem(item.id); }),
                el('strong', { classe: 'numero', texto: moeda(Number(item.produto.preco) * item.quantidade) })
            ])
        ])
    ])));
    const config = await obterConfig();
    const subtotal = subtotalCentavos(itens);
    rodape.replaceChildren(
        metaFreteGratis(subtotal, config),
        el('div', { classe: 'total-linha' }, [el('span', { texto: 'Subtotal' }), el('strong', { texto: moeda(deCentavos(subtotal)) })]),
        el('a', { classe: 'botao botao-ambar botao-grande', href: 'checkout.html' }, ['Finalizar compra', icone('seta-direita')]),
        el('a', { classe: 'botao', href: 'carrinho.html', texto: 'Ver sacola completa' })
    );
}

export function seletorQuantidade(valor, maximo, aoMudar, aoRemover) {
    const limite = Math.max(1, Math.min(10, Number(maximo) || 1));
    const saida = el('output', { texto: String(valor), attrs: { 'aria-live': 'polite' } });
    const menos = el('button', { type: 'button', attrs: { 'aria-label': valor <= 1 && aoRemover ? 'Remover item' : 'Diminuir quantidade' } }, [icone(valor <= 1 && aoRemover ? 'lixeira' : 'menos')]);
    const mais = el('button', { type: 'button', disabled: valor >= limite, attrs: { 'aria-label': 'Aumentar quantidade' } }, [icone('mais')]);
    menos.addEventListener('click', () => {
        if (valor <= 1) { if (aoRemover) aoRemover(); return; }
        tocar('clique');
        aoMudar(valor - 1);
    });
    mais.addEventListener('click', () => { tocar('clique'); aoMudar(valor + 1); });
    return el('div', { classe: 'quantidade' }, [menos, saida, mais]);
}

// ---------------------------------------------------------------------
// Rodapé
// ---------------------------------------------------------------------
function montarRodape({ simples }) {
    const coluna = (titulo, links) => el('div', {}, [el('h3', { texto: titulo }), el('ul', {}, links.map(([href, texto]) => el('li', {}, [el('a', { href, texto })])))]);
    const voltar = el('button', { type: 'button', classe: 'voltar-topo', ao: { click: () => window.scrollTo({ top: 0, behavior: 'smooth' }) } }, ['Voltar ao início']);
    const base = el('div', { classe: 'rodape-base' }, [el('div', { classe: 'conteiner' }, [
        el('span', { texto: `© ${new Date().getFullYear()} Âmbar Marketplace — projeto acadêmico. Pagamentos simulados: nenhuma cobrança é feita.` }),
        el('div', { classe: 'pagamentos', attrs: { 'aria-label': 'Formas de pagamento' } }, [
            el('span', {}, [icone('pix'), 'Pix']), el('span', {}, [icone('cartao'), 'Cartão']), el('span', {}, [icone('boleto'), 'Boleto'])
        ])
    ])]);
    if (simples) return [el('footer', { classe: 'rodape' }, [base])];
    return [el('footer', { classe: 'rodape' }, [
        voltar,
        el('div', { classe: 'conteiner rodape-colunas' }, [
            el('div', { classe: 'rodape-marca' }, [
                el('img', { src: 'assets/marca/logo-ambar-claro.svg', alt: 'Âmbar', width: 125, height: 34 }),
                el('p', { texto: 'Um marketplace de lojas independentes: ateliês, marcas autorais e produtores de todo o Brasil em uma vitrine só, com compra segura e entrega rastreada.' })
            ]),
            coluna('Compre', [['busca.html?desconto=1&ordem=desconto', 'Ofertas do dia'], ['busca.html?ordem=mais_vendidos', 'Mais vendidos'], ['busca.html?ordem=novidades', 'Novidades'], ['index.html#lojas', 'Lojas independentes']]),
            coluna('Venda', [['vender.html', 'Venda na Âmbar'], ['vender.html#como-funciona', 'Como funciona'], ['vender.html#regras', 'Regras da curadoria'], ['vendedor.html', 'Central do vendedor']]),
            coluna('Ajuda', [['conta.html', 'Minha conta'], ['conta.html#pedidos', 'Meus pedidos'], ['sobre.html#entregas', 'Entregas e prazos'], ['sobre.html#trocas', 'Trocas e devoluções']]),
            coluna('Sobre', [['sobre.html', 'O projeto Âmbar'], ['sobre.html#seguranca', 'Segurança e privacidade'], ['sobre.html#creditos', 'Créditos de imagens e sons']])
        ]),
        base
    ])];
}

export { paginaDoNivel };
