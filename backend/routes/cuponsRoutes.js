const express = require('express');
const controller = require('../controllers/cuponsController');
const { autenticar, autenticarOpcional } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');
const { criarLimitador } = require('../middlewares/limitador');

const router = express.Router();
const admin = [autenticar, autorizar('admin')];
// Limite contra robôs tentando adivinhar códigos de cupom.
const limitarTentativas = criarLimitador({ janelaMs: 10 * 60 * 1000, maximo: 40, mensagem: 'Muitas tentativas de cupom. Aguarde alguns minutos.' });

router.post('/validar', limitarTentativas, autenticarOpcional, controller.validar);
router.get('/', ...admin, controller.listar);
router.post('/', ...admin, controller.criar);
router.put('/:id', ...admin, controller.atualizar);
router.delete('/:id', ...admin, controller.excluir);

module.exports = router;
