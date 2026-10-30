// Erro com status HTTP: os controllers lançam e o middleware de erros responde em JSON.
class ErroHttp extends Error {
    constructor(status, mensagem, extra) {
        super(mensagem);
        this.name = 'ErroHttp';
        this.status = status;
        this.extra = extra;
    }
}

const erros = {
    requisicao: (mensagem, extra) => new ErroHttp(400, mensagem, extra),
    naoAutenticado: (mensagem = 'Entre na sua conta para continuar.') => new ErroHttp(401, mensagem),
    proibido: (mensagem = 'Você não tem permissão para esta ação.') => new ErroHttp(403, mensagem),
    naoEncontrado: (mensagem = 'Não encontrado.') => new ErroHttp(404, mensagem),
    conflito: (mensagem, extra) => new ErroHttp(409, mensagem, extra),
    muitasTentativas: (mensagem) => new ErroHttp(429, mensagem),
    indisponivel: (mensagem) => new ErroHttp(503, mensagem)
};

module.exports = { ErroHttp, erros };
