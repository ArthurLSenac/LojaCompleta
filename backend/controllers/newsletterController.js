// Inscrição na newsletter (rota pública, com limite por IP).
const pool = require('../database/conexao');
const v = require('../utils/validacao');

// POST /api/newsletter
async function inscrever(req, res) {
    const email = v.email(req.body.email);
    const [resultado] = await pool.execute('INSERT IGNORE INTO newsletter (email) VALUES (?)', [email]);
    // A resposta é igual nos dois casos: não revela quais e-mails já estão cadastrados.
    res.status(resultado.affectedRows ? 201 : 200).json({ mensagem: 'Pronto! Você vai receber os achados da semana no seu e-mail.' });
}

module.exports = { inscrever };
