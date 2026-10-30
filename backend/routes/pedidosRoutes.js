const express = require('express');
const controller = require('../controllers/pedidosController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();
router.use(autenticar);

// Compras são feitas por contas de cliente.
router.post('/', autorizar('comprador'), controller.criar);
router.post('/simular', autorizar('comprador'), controller.simular);

// Rotas fixas antes de "/:id" para "meus" e "vendedor" não virarem identificadores.
router.get('/meus', controller.meus);
router.get('/vendedor', autorizar('vendedor'), controller.daLoja);
router.get('/', autorizar('admin'), controller.listar);
router.get('/:id', controller.detalhar);

router.post('/:id/cancelar', autorizar('comprador', 'admin'), controller.cancelar);
router.post('/:id/pagar', autorizar('comprador'), controller.pagar);
router.put('/:id/status', autorizar('admin', 'vendedor'), controller.alterarStatus);

module.exports = router;
