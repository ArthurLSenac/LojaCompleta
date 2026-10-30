// O pool reutiliza conexões com o MySQL. A versão "promise" permite usar await
// e devolve [linhas, metadados]. DECIMAL chega como texto para não perder centavos.
const mysql = require('mysql2/promise');
const config = require('../config/ambiente');

const pool = mysql.createPool({
    ...config.db,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 100,
    connectTimeout: 10000,
    charset: 'utf8mb4',
    timezone: 'Z',
    dateStrings: false
});

// A API trabalha em UTC: o driver (timezone 'Z') e a sessão do MySQL usam o mesmo fuso.
// O navegador converte para o horário local na hora de exibir.
pool.on('connection', function configurarFuso(conexao) {
    conexao.query("SET SESSION time_zone = '+00:00'", function verificar(erro) {
        if (erro) {
            console.error('Falha ao configurar o fuso da conexão MySQL:', erro.code || erro.message);
            conexao.destroy();
        }
    });
});

/**
 * Executa uma função dentro de uma transação. Se qualquer passo lançar erro,
 * tudo é desfeito (rollback) e a conexão sempre volta ao pool.
 */
async function transacao(trabalho) {
    const conexao = await pool.getConnection();
    try {
        await conexao.beginTransaction();
        const resultado = await trabalho(conexao);
        await conexao.commit();
        return resultado;
    } catch (erro) {
        try {
            await conexao.rollback();
        } catch (erroRollback) {
            console.error('Falha no rollback:', erroRollback.code || erroRollback.message);
        }
        throw erro;
    } finally {
        conexao.release();
    }
}

module.exports = pool;
module.exports.transacao = transacao;
