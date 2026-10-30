// Ponto de entrada: valida a configuração, testa o banco e só então abre a porta.
const app = require('./app');
const pool = require('./database/conexao');
const config = require('./config/ambiente');

async function iniciar() {
    try {
        config.validarConfiguracao();
        // Falhar cedo dá uma mensagem clara quando o MySQL ou o script SQL não estão prontos.
        await pool.query('SELECT id FROM usuarios LIMIT 1');
        await pool.query('SELECT id FROM rodadas_ofertas LIMIT 1');
        await new Promise(function abrirPorta(resolve, reject) {
            const servidor = app.listen(config.porta, config.host);
            servidor.once('listening', resolve);
            servidor.once('error', reject);
        });
        console.log(`Âmbar Marketplace disponível em http://localhost:${config.porta}`);
    } catch (erro) {
        const dicas = {
            ECONNREFUSED: 'O MySQL não respondeu. Ele está em execução? Confira DB_HOST e DB_PORT.',
            ER_ACCESS_DENIED_ERROR: 'Usuário ou senha do MySQL incorretos. Confira DB_USER e DB_PASSWORD no .env.',
            ER_BAD_DB_ERROR: 'O banco não existe. Rode os scripts da pasta sql/ ou "npm run db:criar".',
            ER_NO_SUCH_TABLE: 'As tabelas não existem. Rode os scripts da pasta sql/ ou "npm run db:criar".',
            EADDRINUSE: `A porta ${config.porta} já está em uso. Feche o outro servidor ou mude PORT no .env.`
        };
        console.error('Falha ao iniciar:', dicas[erro.code] || erro.message);
        await pool.end().catch(() => {});
        process.exitCode = 1;
    }
}

// Ao importar o app nos testes, o servidor não abre porta sozinho.
if (require.main === module) iniciar();

module.exports = { iniciar };
