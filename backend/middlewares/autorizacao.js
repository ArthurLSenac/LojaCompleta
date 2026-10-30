// Autorização por nível. A fábrica recebe os níveis aceitos e devolve um middleware.
// Ela não substitui a checagem de "dono do recurso", feita nos controllers
// (ex.: um vendedor só edita os próprios produtos).
function autorizar(...niveisPermitidos) {
    return function verificarNivel(req, res, next) {
        if (!req.usuario) {
            return res.status(401).json({ mensagem: 'Entre na sua conta para continuar.' });
        }
        if (!niveisPermitidos.includes(req.usuario.nivel)) {
            return res.status(403).json({ mensagem: 'Seu perfil não tem permissão para esta ação.' });
        }
        next();
    };
}

module.exports = { autorizar };
