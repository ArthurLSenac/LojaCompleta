const express = require('express');
const controller = require('../controllers/solicitacoesController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();
router.use(autenticar);

router.post('/', autorizar('comprador'), controller.criar);
router.get('/minha', controller.minha);
router.get('/', autorizar('admin'), controller.listar);
router.put('/:id/aprovar', autorizar('admin'), controller.aprovar);
router.put('/:id/recusar', autorizar('admin'), controller.recusar);

module.exports = router;
