const express = require('express');
const controller = require('../controllers/favoritosController');
const { autenticar } = require('../middlewares/autenticacao');

const router = express.Router();
router.use(autenticar);

router.get('/', controller.listar);
router.get('/ids', controller.ids);
router.post('/:produtoId', controller.adicionar);
router.delete('/:produtoId', controller.remover);

module.exports = router;
