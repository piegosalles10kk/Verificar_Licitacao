// server.js
require('dotenv').config();
const express = require('express');
const licitacaoRoutes = require('./routes/LicitacaoRoutes');

const app = express();
const PORT = 2130;

// Middleware para JSON (caso precise de POST, PUT, etc)
app.use(express.json()); 

// Usa as rotas de Licitações
app.use('/api', licitacaoRoutes);

// Rota de teste simples
app.get('/', (req, res) => {
    res.send(`Servidor de Licitações Local rodando na porta ${PORT}. 
    Use a rota: http://localhost:${PORT}/api/licitacoes?orgao=exercito&objeto=escritorio`);
});


app.listen(PORT, () => {
    console.log(`Servidor Express rodando em http://localhost:${PORT}`);
});