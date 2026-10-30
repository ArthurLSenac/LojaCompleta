const express = require('express');
const controller = require('../controllers/bannersController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();
const admin = [autenticar, autorizar('admin')];

router.get('/', controller.listar);
router.get('/gerenciar', ...admin, controller.gerenciar);
router.post('/', ...admin, controller.criar);
router.put('/:id', ...admin, controller.atualizar);
router.delete('/:id', ...admin, controller.excluir);

module.exports = router;
