const express = require('express');
const controller = require('../controllers/lojasController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();

router.get('/', controller.listar);
router.get('/minha', autenticar, autorizar('vendedor'), controller.minha);
router.put('/minha', autenticar, autorizar('vendedor'), controller.atualizarMinha);
router.get('/gerenciar', autenticar, autorizar('admin'), controller.gerenciar);
router.put('/:id/status', autenticar, autorizar('admin'), controller.alterarStatus);
router.get('/:slug', controller.detalhar);

module.exports = router;
