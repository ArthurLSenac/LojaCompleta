const express = require('express');
const controller = require('../controllers/configuracoesController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();

router.get('/publicas', controller.publicas);
router.get('/', autenticar, autorizar('admin'), controller.listar);
router.put('/', autenticar, autorizar('admin'), controller.atualizar);

module.exports = router;
