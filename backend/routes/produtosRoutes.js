const express = require('express');
const controller = require('../controllers/produtosController');
const avaliacoes = require('../controllers/avaliacoesController');
const perguntas = require('../controllers/perguntasController');
const { autenticar, autenticarOpcional } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();
const gestores = [autenticar, autorizar('admin', 'vendedor')];

// Leitura do catálogo é pública. Rotas fixas vêm antes de "/:id".
router.get('/', controller.listar);
router.get('/gerenciar', ...gestores, controller.gerenciar);
router.get('/:id', autenticarOpcional, controller.detalhar);
router.get('/:id/avaliacoes', avaliacoes.listarDoProduto);
router.get('/:id/perguntas', perguntas.listarDoProduto);

// Escrita: nível verificado aqui; a propriedade do produto é conferida no controller.
router.post('/', ...gestores, controller.criar);
router.put('/:id', ...gestores, controller.atualizar);
router.patch('/:id/estoque', ...gestores, controller.atualizarEstoque);
router.delete('/:id', ...gestores, controller.excluir);
router.post('/:id/reativar', ...gestores, controller.reativar);

module.exports = router;
