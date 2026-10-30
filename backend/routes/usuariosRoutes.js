const express = require('express');
const controller = require('../controllers/usuariosController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();
// Todo o recurso é exclusivo da administração.
router.use(autenticar, autorizar('admin'));

router.get('/', controller.listar);
router.put('/:id/nivel', controller.alterarNivel);
router.put('/:id/status', controller.alterarStatus);

module.exports = router;
