const express = require('express');
const controller = require('../controllers/enderecosController');
const { autenticar } = require('../middlewares/autenticacao');

const router = express.Router();
// Cada usuário só enxerga e altera os próprios endereços (filtrados pelo id do token).
router.use(autenticar);

router.get('/', controller.listar);
router.post('/', controller.criar);
router.put('/:id', controller.atualizar);
router.put('/:id/principal', controller.tornarPrincipal);
router.delete('/:id', controller.excluir);

module.exports = router;
