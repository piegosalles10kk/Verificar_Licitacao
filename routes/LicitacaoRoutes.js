// routes/LicitacaoRoutes.js

const express = require('express');
const router = express.Router();
const licitacaoController = require('../controllers/LicitacaoController');

// Define a rota de consulta
// Exemplo de uso: GET http://localhost:3000/api/licitacoes?orgao=exercito&objeto=escritorio
router.get('/licitacoes', licitacaoController.buscarLicitacoes);

router.get('/analise', licitacaoController.analisarLicitacoes);

module.exports = router;