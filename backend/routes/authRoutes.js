const express = require('express');
const controller = require('../controllers/authController');
const { autenticar } = require('../middlewares/autenticacao');
const { criarLimitador } = require('../middlewares/limitador');
const config = require('../config/ambiente');

const router = express.Router();

// Cadastro e login são públicos, mas limitados por IP contra robôs.
const limitarAcesso = criarLimitador({
    janelaMs: 15 * 60 * 1000,
    maximo: config.limites.loginPorJanela,
    mensagem: 'Muitas tentativas a partir desta rede. Aguarde alguns minutos e tente de novo.'
});

router.post('/cadastro', limitarAcesso, controller.cadastrar);
router.post('/login', limitarAcesso, controller.login);

router.get('/eu', autenticar, controller.eu);
router.put('/perfil', autenticar, controller.atualizarPerfil);
router.put('/senha', autenticar, controller.alterarSenha);
router.post('/sair-de-todos', autenticar, controller.sairDeTodos);

module.exports = router;
