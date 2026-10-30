// Cabeçalhos de segurança com o helmet.
// A Content-Security-Policy (CSP) diz ao navegador de onde scripts, imagens e
// vídeos podem vir. Mesmo que algum texto malicioso chegasse à página, um script
// injetado de outro domínio não seria executado.
const helmet = require('helmet');
const config = require('../config/ambiente');

const cabecalhos = helmet({
    contentSecurityPolicy: {
        useDefaults: false,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:', 'blob:', 'https:'],          // fotos de produtos são URLs https
            mediaSrc: ["'self'", 'blob:', 'https://assets.mixkit.co'], // vídeos da vitrine
            fontSrc: ["'self'"],
            connectSrc: ["'self'", 'https://viacep.com.br'],             // preenchimento de endereço pelo CEP
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"]                                 // impede a loja dentro de iframes (clickjacking)
        }
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    // HSTS só faz sentido com HTTPS; em desenvolvimento local fica desligado.
    strictTransportSecurity: config.ambiente === 'production' ? { maxAge: 15552000, includeSubDomains: true } : false
});

function permissoes(req, res, next) {
    // Bloqueia recursos do navegador que a loja não usa.
    res.set('Permissions-Policy', 'camera=(), geolocation=(), microphone=(), payment=(), usb=()');
    next();
}

module.exports = [cabecalhos, permissoes];
