const express = require('express');
const ctrl = require('../controllers/authController');

const router = express.Router();

router.post('/login', ctrl.login);
router.post('/register', ctrl.register);
router.get('/verify', ctrl.verify);

module.exports = router;
