// Limite de requisições por janela de tempo (rate limiting), guardado em memória.
// Protege contra robôs que testam senhas ou enchem o banco de perguntas.
// Em produção com vários servidores, o contador ficaria num Redis compartilhado.

function criarLimitador({ janelaMs, maximo, mensagem, chave = (req) => req.ip || 'desconhecido' }) {
    const registros = new Map();

    const limpeza = setInterval(function limparExpirados() {
        const agora = Date.now();
        for (const [identificador, registro] of registros) {
            if (registro.reinicio <= agora) registros.delete(identificador);
        }
    }, janelaMs);
    limpeza.unref(); // não impede o processo de encerrar

    function limitar(req, res, next) {
        const agora = Date.now();
        const identificador = chave(req);
        let registro = registros.get(identificador);
        if (!registro || registro.reinicio <= agora) {
            registro = { contagem: 0, reinicio: agora + janelaMs };
            registros.set(identificador, registro);
        }
        registro.contagem += 1;
        const segundos = Math.ceil((registro.reinicio - agora) / 1000);
        res.set('RateLimit-Limit', String(maximo));
        res.set('RateLimit-Remaining', String(Math.max(0, maximo - registro.contagem)));
        res.set('RateLimit-Reset', String(segundos));
        if (registro.contagem > maximo) {
            res.set('Retry-After', String(segundos));
            return res.status(429).json({ mensagem });
        }
        next();
    }

    limitar.reiniciar = () => registros.clear();
    return limitar;
}

module.exports = { criarLimitador };
