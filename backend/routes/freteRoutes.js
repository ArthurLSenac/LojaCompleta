const express = require('express');
const controller = require('../controllers/freteController');

const router = express.Router();
router.post('/calcular', controller.calcular);

module.exports = router;
