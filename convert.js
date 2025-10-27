// convert.js
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const util = require('util');

// Define os caminhos dos arquivos
const inputFilePath = path.join(__dirname, 'db', '202401_Licitação.csv');
const outputFilePath = path.join(__dirname, 'db', 'licitacoes_202401.json');

// Configurações críticas
const CONFIG = {
    SEPARATOR: ';', 
    CODING: 'latin1' // Codificação dos CSVs do governo
};

const resultados = [];

console.log(`Iniciando conversão de: ${path.basename(inputFilePath)}`);
console.log(`Saída para: ${path.basename(outputFilePath)}`);

fs.createReadStream(inputFilePath)
    // 1. PIPE: Decodifica o buffer do arquivo de 'latin1' (ISO-8859-1) para UTF-8
    .pipe(iconv.decodeStream(CONFIG.CODING)) 
    // 2. PIPE: Envia o stream decodificado para o CSV-Parser
    .pipe(csv({ 
        separator: CONFIG.SEPARATOR,
        // Garante que o cabeçalho não será alterado, ele usará os nomes corretos do debug.
    }))
    .on('data', (dados) => {
        // O csv-parser já gera um objeto JavaScript por linha.
        resultados.push(dados);
    })
    .on('end', () => {
        console.log(`\nConversão concluída. Total de ${resultados.length} linhas lidas.`);
        
        // Converte o array de objetos para uma string JSON formatada
        const jsonContent = JSON.stringify(resultados, null, 2); 
        
        // 3. Salva o conteúdo no arquivo JSON de saída
        fs.writeFileSync(outputFilePath, jsonContent, 'utf8');
        console.log(`Arquivo JSON salvo com sucesso em: ${outputFilePath}`);

        // Opcional: Verifica se os nomes de coluna estão corretos no primeiro item
        if (resultados.length > 0) {
            console.log("\nEstrutura do primeiro objeto (para conferência):");
            // Usa util.inspect para mostrar o objeto de forma legível
            console.log(util.inspect(resultados[0], { depth: 1 }));
        }
    })
    .on('error', (err) => {
        console.error('\n[ERRO] Falha durante a leitura ou escrita do arquivo:', err.message);
    });