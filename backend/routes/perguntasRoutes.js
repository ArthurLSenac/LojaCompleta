const express = require('express');
const controller = require('../controllers/perguntasController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');
const { criarLimitador } = require('../middlewares/limitador');

const router = express.Router();
const limitarPerguntas = criarLimitador({ janelaMs: 60 * 1000, maximo: 6, mensagem: 'Você está perguntando rápido demais. Aguarde um minuto.' });
router.use(autenticar);

router.post('/', limitarPerguntas, controller.criar);
router.get('/', autorizar('admin'), controller.gerenciar);
router.get('/vendedor', autorizar('vendedor'), controller.daLoja);
router.put('/:id/resposta', autorizar('vendedor', 'admin'), controller.responder);
router.delete('/:id', controller.excluir);

module.exports = router;
