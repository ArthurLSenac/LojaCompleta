const express = require('express');
const controller = require('../controllers/auditoriaController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();
router.get('/', autenticar, autorizar('admin'), controller.listar);

module.exports = router;
