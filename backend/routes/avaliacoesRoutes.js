const express = require('express');
const controller = require('../controllers/avaliacoesController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();
router.use(autenticar);

router.post('/', autorizar('comprador'), controller.criar);
router.get('/', autorizar('admin'), controller.gerenciar);
router.get('/vendedor', autorizar('vendedor'), controller.daLoja);
router.put('/:id', autorizar('comprador'), controller.atualizar);
router.delete('/:id', autorizar('comprador', 'admin'), controller.excluir);
router.put('/:id/visibilidade', autorizar('admin'), controller.alterarVisibilidade);

module.exports = router;
