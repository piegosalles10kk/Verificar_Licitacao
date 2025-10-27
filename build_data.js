// process_single_csv.js
// USO: node process_single_csv.js nome_do_arquivo.csv

const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const iconv = require('iconv-lite');
const util = require('util');

// Define os caminhos
const csvDir = path.join(__dirname, 'db');

// --- 1. SOLICITAÇÃO DO NOME DO ARQUIVO ---
const filename = process.argv[2]; // Captura o terceiro argumento da linha de comando

if (!filename) {
    console.error("❌ ERRO: O nome do arquivo CSV é obrigatório.");
    console.log("USO CORRETO: node process_single_csv.js nome_do_arquivo.csv");
    process.exit(1); // Sai do script com erro
}

const inputFilePath = path.join(csvDir, filename);

if (!fs.existsSync(inputFilePath)) {
    console.error(`❌ ERRO: Arquivo não encontrado em: ${inputFilePath}`);
    console.log("Verifique se o arquivo está na pasta 'db'.");
    process.exit(1);
}

// O nome do arquivo de saída JSON será baseado no nome do CSV
const outputFilename = filename.replace('.csv', '.json');
const outputFilePath = path.join(csvDir, outputFilename);

// Configurações críticas
const CONFIG = {
    SEPARATOR: ';', 
    CODING: 'latin1' 
};

/**
 * Converte um único arquivo CSV para um JSON correspondente.
 */
function processarCSV() {
    return new Promise((resolve, reject) => {
        const resultados = [];
        let linhaCount = 0;

        console.log(`\nIniciando processamento de: ${filename}`);
        
        fs.createReadStream(inputFilePath)
            .pipe(iconv.decodeStream(CONFIG.CODING)) 
            .pipe(csv({ separator: CONFIG.SEPARATOR }))
            .on('data', (dados) => {
                resultados.push(dados);
                linhaCount++;
            })
            .on('end', () => {
                console.log(`✅ Processamento concluído: ${linhaCount} linhas lidas.`);
                
                // Salva o JSON
                const jsonContent = JSON.stringify(resultados, null, 2); 
                fs.writeFileSync(outputFilePath, jsonContent, 'utf8');
                console.log(`✅ Arquivo JSON salvo com sucesso em: ${outputFilename}`);

                if (resultados.length > 0) {
                    console.log("\nEstrutura do primeiro objeto (para conferência):");
                    console.log(util.inspect(resultados[0], { depth: 1 }));
                }
                resolve();
            })
            .on('error', (err) => {
                console.error(`❌ ERRO durante o processamento: ${err.message}`);
                reject(err);
            });
    });
}

processarCSV();