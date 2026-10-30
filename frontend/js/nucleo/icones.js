// Conjunto de ícones da Âmbar (24 × 24, traço de 1,8). Criados com o DOM,
// sem innerHTML, então podem ser usados em qualquer lugar com segurança.
const SVG = 'http://www.w3.org/2000/svg';
const circulo = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${r * 2} 0a${r} ${r} 0 1 0 ${-r * 2} 0`;

const CAMINHOS = {
    sacola: ['M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z', 'M9 8V6.5a3 3 0 0 1 6 0V8'],
    busca: [circulo(11, 11, 7), 'm20 20-4.2-4.2'],
    usuario: ['M20 21a8 8 0 0 0-16 0', circulo(12, 8, 4)],
    coracao: ['M12 20.5s-7.5-4.6-9.2-9.3C1.6 7.6 4 4.5 7.3 4.5c2 0 3.6 1.1 4.7 2.7 1.1-1.6 2.7-2.7 4.7-2.7 3.3 0 5.7 3.1 4.5 6.7-1.7 4.7-9.2 9.3-9.2 9.3Z'],
    pin: ['M12 21s-7-5.6-7-11.2A7 7 0 0 1 19 9.8C19 15.4 12 21 12 21Z', circulo(12, 10, 2.5)],
    menu: ['M4 6h16M4 12h16M4 18h16'],
    fechar: ['M6 6l12 12M18 6 6 18'],
    'seta-direita': ['M5 12h14M13 6l6 6-6 6'],
    'seta-esquerda': ['M19 12H5M11 6l-6 6 6 6'],
    'seta-cima': ['M12 19V5M6 11l6-6 6 6'],
    'chevron-direita': ['m9 6 6 6-6 6'],
    'chevron-esquerda': ['m15 6-6 6 6 6'],
    'chevron-baixo': ['m6 9 6 6 6-6'],
    mais: ['M12 5v14M5 12h14'],
    menos: ['M5 12h14'],
    lixeira: ['M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3'],
    estrela: ['m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z'],
    caminhao: ['M3 6h11v10H3zM14 9h4l3 3.5V16h-7', circulo(7.5, 17.5, 1.8), circulo(17.5, 17.5, 1.8)],
    escudo: ['M12 3l8 3v6c0 4.6-3.4 8.2-8 9-4.6-.8-8-4.4-8-9V6l8-3Z', 'm8.5 12 2.5 2.5 4.5-5'],
    pix: ['M12 3.5 20.5 12 12 20.5 3.5 12Z', 'M8 12h1.5L12 9.5l2.5 2.5H16'],
    cartao: ['M3 6.5A1.5 1.5 0 0 1 4.5 5h15A1.5 1.5 0 0 1 21 6.5v11a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17.5Z', 'M3 10h18M7 15h4'],
    boleto: ['M4 5v14M7 5v14M10 5v10M12.5 5v14M15 5v10M18 5v14M20.5 5v14'],
    cupom: ['M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2a3 3 0 0 0 0 6v2a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-2a3 3 0 0 0 0-6Z', 'M14 7v2M14 11v2M14 15v2'],
    presente: ['M4 11h16v9H4zM3 7h18v4H3zM12 7v13', 'M12 7S10.5 3 8 3.8C6 4.5 7 7 9 7M12 7s1.5-4 4-3.2C18 4.5 17 7 15 7'],
    loja: ['M4 10v10h16V10M3 10l2-6h14l2 6', 'M3 10a3 3 0 0 0 6 0 3 3 0 0 0 6 0 3 3 0 0 0 6 0', 'M10 20v-5h4v5'],
    pacote: ['m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z', 'M4 7.5l8 4.5 8-4.5M12 12v9', 'm8 5.2 8 4.6'],
    check: ['m5 12.5 4.5 4.5L19 7.5'],
    alerta: ['M12 4 21 19.5H3L12 4Z', 'M12 10v4M12 17v.01'],
    info: [circulo(12, 12, 9), 'M12 11v5M12 8v.01'],
    editar: ['M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z', 'm13.5 6.5 4 4'],
    olho: ['M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z', circulo(12, 12, 3)],
    'olho-fechado': ['M3 3l18 18', 'M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.6 3.3', 'M6.4 7.6A17 17 0 0 0 2.5 12S6 18 12 18a9 9 0 0 0 4.3-1.1', 'M9.9 9.9a3 3 0 0 0 4.2 4.2'],
    sair: ['M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9'],
    grafico: ['M3 20h18', 'M6 17v-5M11 17V7M16 17v-8M21 17v-3'],
    usuarios: [circulo(9, 8, 3.5), 'M2.5 20a6.5 6.5 0 0 1 13 0', 'M16 4.5a3.5 3.5 0 0 1 0 7M18.5 20h3a6 6 0 0 0-4-5.6'],
    tag: ['M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9-9-9Z', circulo(7.5, 7.5, 1.5)],
    imagem: ['M3 5h18v14H3z', 'm3 16 5-5 4 4 3-3 6 6', circulo(9, 9, 1.6)],
    megafone: ['M3 10v4h3l7 5V5L6 10H3Z', 'M16 9a4 4 0 0 1 0 6M18.5 6.5a7.5 7.5 0 0 1 0 11'],
    ajustes: ['M4 7h9M17 7h3M4 17h3M11 17h9', circulo(15, 7, 2), circulo(9, 17, 2)],
    historico: ['M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5', 'M12 7v5l3 2'],
    relogio: [circulo(12, 12, 9), 'M12 7v5l3.5 2'],
    som: ['M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z', 'M16.5 9a4 4 0 0 1 0 6M19 6.5a7.5 7.5 0 0 1 0 11'],
    'som-mudo': ['M4 9.5v5h3.5L13 19V5L7.5 9.5H4Z', 'm17 9.5 5 5M22 9.5l-5 5'],
    filtro: ['M4 5h16l-6 7.5V19l-4 1.5v-8L4 5Z'],
    grade: ['M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z'],
    lista: ['M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01'],
    raio: ['M13 2 4 14h7l-1 8 9-12h-7l1-8Z'],
    chat: ['M4 5h16v11H9l-5 4V5Z', 'M8 9.5h8M8 12.5h5'],
    copiar: ['M8 8h11v13H8z', 'M16 8V4H5v13h3'],
    compartilhar: [circulo(18, 5, 2.5), circulo(6, 12, 2.5), circulo(18, 19, 2.5), 'm8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5'],
    play: ['M7 5v14l12-7L7 5Z'],
    pausa: ['M8 5v14M16 5v14'],
    casa: ['M3 11 12 3.5 21 11', 'M5.5 9V20h13V9', 'M10 20v-6h4v6'],
    baixar: ['M12 3v12M7 10l5 5 5-5M4 21h16'],
    onda: ['M3 12h2M7 8v8M11 4.5v15M15 8.5v7M19 6.5v11'],
    verificado: ['M12 2.8l2.4 1.7 2.9-.1.9 2.8 2.3 1.8-.9 2.8.9 2.8-2.3 1.8-.9 2.8-2.9-.1L12 21.2l-2.4-1.7-2.9.1-.9-2.8-2.3-1.8.9-2.8-.9-2.8 2.3-1.8.9-2.8 2.9.1L12 2.8Z', 'm8.8 12 2.2 2.2 4.4-4.4'],
    devolucao: ['M9 14 4 9l5-5', 'M4 9h11a5 5 0 0 1 0 10h-3'],
    cadeado: ['M5 11h14v10H5z', 'M8 11V7.5a4 4 0 0 1 8 0V11'],
    brilho: ['M12 3c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7Z', 'M19 15.5c.2 1.5 1 2.3 2.5 2.5-1.5.2-2.3 1-2.5 2.5-.2-1.5-1-2.3-2.5-2.5 1.5-.2 2.3-1 2.5-2.5Z'],
    cesta: ['M3 9h18l-2 11H5L3 9Z', 'M8 9l4-6 4 6M9 13v4M15 13v4'],
    // Categorias
    fone: ['M4 15v-3a8 8 0 0 1 16 0v3', 'M4 15a2 2 0 0 1 2-2h1v7H6a2 2 0 0 1-2-2v-3ZM20 15a2 2 0 0 0-2-2h-1v7h1a2 2 0 0 0 2-2v-3Z'],
    controle: ['M7 7h10a5 5 0 0 1 4.8 6.4l-1 3.3a2.6 2.6 0 0 1-4.5.9L14.5 15h-5l-1.8 2.6a2.6 2.6 0 0 1-4.5-.9l-1-3.3A5 5 0 0 1 7 7Z', 'M8 10v3M6.5 11.5h3M15.5 10.5h.01M17.5 12.5h.01'],
    camiseta: ['M8.5 3.5 4 6l-1.5 4 3 1.5V20h13v-8.5l3-1.5L20 6l-4.5-2.5a3.5 3.5 0 0 1-7 0Z'],
    bolsa: ['M4 10h16l-1.5 10h-13L4 10Z', 'M8 10V8a4 4 0 0 1 8 0v2'],
    joia: ['M6 3h12l3 5-9 13L3 8l3-5Z', 'M3 8h18M9.5 3 8 8l4 13 4-13-1.5-5'],
    cafe: ['M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z', 'M17 10.5h1.5a2.5 2.5 0 0 1 0 5H17', 'M8 3.5c-.6 1 .6 2 0 3M12 3.5c-.6 1 .6 2 0 3'],
    beleza: ['M7 9h10v11a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V9Z', 'M9.5 9V6.5h5V9M11 6.5V4h2v2.5', 'M10 14h4'],
    esporte: ['M6.5 6.5v11M17.5 6.5v11M3.5 9v6M20.5 9v6M6.5 12h11'],
    pet: [circulo(6.5, 10, 1.6), circulo(10, 6.5, 1.6), circulo(14, 6.5, 1.6), circulo(17.5, 10, 1.6), 'M12 11c-2.6 0-5 3.3-5 5.5 0 1.6 1.2 2.5 2.6 2.5.9 0 1.6-.5 2.4-.5s1.5.5 2.4.5c1.4 0 2.6-.9 2.6-2.5 0-2.2-2.4-5.5-5-5.5Z'],
    livro: ['M12 6.5C10.5 5 8.2 4.5 3 4.5v14c5.2 0 7.5.5 9 2 1.5-1.5 3.8-2 9-2v-14c-5.2 0-7.5.5-9 2Z', 'M12 6.5v14'],
    caixa: ['m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z', 'M4 7.5l8 4.5 8-4.5M12 12v9']
};

const PREENCHIDOS = new Set(['estrela', 'play']);

export function icone(nome, { classe = 'icone', titulo, preenchido = false } = {}) {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('class', classe);
    svg.setAttribute('fill', preenchido || PREENCHIDOS.has(nome) ? 'currentColor' : 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.8');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');
    if (titulo) {
        svg.setAttribute('role', 'img');
        const t = document.createElementNS(SVG, 'title');
        t.textContent = titulo;
        svg.appendChild(t);
    } else {
        svg.setAttribute('aria-hidden', 'true');
    }
    for (const d of CAMINHOS[nome] || CAMINHOS.caixa) {
        const caminho = document.createElementNS(SVG, 'path');
        caminho.setAttribute('d', d);
        svg.appendChild(caminho);
    }
    return svg;
}

/** Sacola do topo: o interior "enche de âmbar" conforme a quantidade de itens. */
export function iconeSacola() {
    const svg = document.createElementNS(SVG, 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('aria-hidden', 'true');
    const id = 'corpo-sacola-' + Math.random().toString(36).slice(2, 8);
    const corpo = 'M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8L5 8Z';
    const defs = document.createElementNS(SVG, 'defs');
    const clip = document.createElementNS(SVG, 'clipPath');
    clip.setAttribute('id', id);
    const forma = document.createElementNS(SVG, 'path');
    forma.setAttribute('d', corpo);
    clip.appendChild(forma);
    const grad = document.createElementNS(SVG, 'linearGradient');
    grad.setAttribute('id', id + '-g');
    grad.setAttribute('x1', '0'); grad.setAttribute('y1', '0'); grad.setAttribute('x2', '0'); grad.setAttribute('y2', '1');
    [['0', '#ffd06a'], ['1', '#e88d0c']].forEach(([offset, cor]) => {
        const parada = document.createElementNS(SVG, 'stop');
        parada.setAttribute('offset', offset);
        parada.setAttribute('stop-color', cor);
        grad.appendChild(parada);
    });
    defs.append(clip, grad);
    const grupo = document.createElementNS(SVG, 'g');
    grupo.setAttribute('clip-path', `url(#${id})`);
    const nivel = document.createElementNS(SVG, 'rect');
    nivel.setAttribute('x', '4'); nivel.setAttribute('y', '8'); nivel.setAttribute('width', '16'); nivel.setAttribute('height', '14');
    nivel.setAttribute('fill', `url(#${id}-g)`);
    nivel.setAttribute('class', 'nivel');
    nivel.style.transform = 'scaleY(0)';
    grupo.appendChild(nivel);
    const contorno = icone('sacola');
    const caminhos = [...contorno.querySelectorAll('path')];
    const traco = document.createElementNS(SVG, 'g');
    traco.setAttribute('fill', 'none');
    traco.setAttribute('stroke', 'currentColor');
    traco.setAttribute('stroke-width', '1.8');
    traco.setAttribute('stroke-linecap', 'round');
    traco.setAttribute('stroke-linejoin', 'round');
    caminhos.forEach((c) => traco.appendChild(c));
    svg.append(defs, grupo, traco);
    return svg;
}
