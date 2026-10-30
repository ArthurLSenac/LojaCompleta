const express = require('express');
const controller = require('../controllers/newsletterController');
const { criarLimitador } = require('../middlewares/limitador');

const router = express.Router();
const limitar = criarLimitador({ janelaMs: 60 * 60 * 1000, maximo: 10, mensagem: 'Muitas inscrições a partir desta rede. Tente mais tarde.' });
router.post('/', limitar, controller.inscrever);

module.exports = router;
