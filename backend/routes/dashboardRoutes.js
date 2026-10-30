const express = require('express');
const controller = require('../controllers/dashboardController');
const { autenticar } = require('../middlewares/autenticacao');
const { autorizar } = require('../middlewares/autorizacao');

const router = express.Router();
router.use(autenticar);

router.get('/admin', autorizar('admin'), controller.admin);
router.get('/vendedor', autorizar('vendedor'), controller.vendedor);

module.exports = router;
