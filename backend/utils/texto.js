// Funções de apoio para textos.

/** "Ateliê Jacarandá" -> "atelie-jacaranda" (usado em URLs amigáveis). */
function slug(texto) {
    return String(texto)
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'item';
}

/** Escapa % e _ para usar o texto do usuário dentro de LIKE sem virar curinga. */
function escaparLike(texto) {
    return String(texto).replace(/[\\%_]/g, (caractere) => '\\' + caractere);
}

module.exports = { slug, escaparLike };
