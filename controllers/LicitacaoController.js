// Importações de Módulos
const path = require('path');
// Importação do SDK do Google Gen AI
// (Requer 'npm install @google/genai')
const { GoogleGenAI } = require('@google/genai'); 

// --- CONFIGURAÇÃO DE CARREGAMENTO DE DADOS (DATABASE JSON) ---
const JSON_FILE_NAME = 'licitacoes_master.json';
const JSON_PATH = path.join(__dirname, '..', 'db', JSON_FILE_NAME);

let licitacoesData = [];

try {
    // Carrega os dados JSON
    const rawData = require(JSON_PATH); 
    licitacoesData = rawData;
    console.log(`[DATA LOAD] ${licitacoesData.length} licitações carregadas do JSON MESTRE.`);
} catch (error) {
    console.error(`[ERRO CRÍTICO] Falha ao carregar o arquivo JSON: ${error.message}`);
    console.log(`Verifique se o arquivo ${JSON_FILE_NAME} foi gerado em db/ e reinicie o servidor.`);
}
// -------------------------------------------------------------

// --- CONFIGURAÇÃO DA IA ---
// Tenta carregar a chave da variável de ambiente (definida no .env e carregada pelo dotenv)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY; 
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
const MODEL_NAME = "gemini-2.5-flash"; // Modelo ideal para tarefas de texto e análise.
// -------------------------------------------------------------


// Função de normalização (mantida)
function normalizarString(str) {
    if (!str) return '';
    return str
        .normalize('NFD') 
        .replace(/[\u0300-\u036f]/g, "") 
        .toUpperCase() 
        .trim(); 
}

// Configurações de coluna (Adicionando Nome UG para busca flexível, mas mantendo Nome Órgão como principal)
const CONFIG = {
    ORGAO_COLUNA: 'Nome Órgão',    
    OBJETO_COLUNA: 'Objeto',
    SITUACAO_COLUNA: 'Situação Licitação',
    VALOR_COLUNA: 'Valor Licitação',       
    MUNICIPIO_COLUNA: 'Município'          
};

/**
 * Função utilitária para aplicar o filtro de busca.
 * Inclui a coluna 'Nome UG' na busca do Órgão para flexibilizar (ex: "EMBRAPA").
 */
function aplicarFiltro(orgao, objeto) {
    const termoOrgaoNormalizado = normalizarString(orgao);
    const termoObjetoNormalizado = normalizarString(objeto);
    
    return licitacoesData.filter(licitacao => {
        // Busca em Nome Órgão OU Nome UG
        const orgaoPrincipalNormalizado = normalizarString(licitacao[CONFIG.ORGAO_COLUNA]);
        const ugNormalizada = normalizarString(licitacao['Nome UG']); // Assume que Nome UG existe
        
        const objetoNormalizado = normalizarString(licitacao[CONFIG.OBJETO_COLUNA]);

        const orgaoMatch = orgaoPrincipalNormalizado.includes(termoOrgaoNormalizado) || ugNormalizada.includes(termoOrgaoNormalizado);
        
        return (
            orgaoMatch &&
            objetoNormalizado.includes(termoObjetoNormalizado)
        );
    });
}


// --------------------------------------------------------------------------------
// FUNÇÃO DE CÁLCULO DE MÉTRICAS (REFINADA)
// --------------------------------------------------------------------------------

/**
 * Função utilitária para calcular as métricas (sucesso, valor, top locais).
 */
// ... (código anterior) ...

/**
 * Função utilitária para calcular as métricas (sucesso, valor, top locais).
 * CRITÉRIO REFINADO: Agora usa Situação E Data Resultado Compra.
 */
function calcularMetricas(licitacoesFiltradas) {
    const total = licitacoesFiltradas.length;
    let totalSucesso = 0;
    let valorTotal = 0;
    const contagemMunicipios = {};

    // Situações que indicam sucesso/homologação (mesmo termos parciais)
    const STATUS_APROVADO = ['HOMOLOGADO', 'CONTRATADO', 'ADJUDICADO', 'EVENTO DE RESULTADO', 'ENCERRADO']; 

    // Situações que indicam Fracasso/Insucesso EXPLICITAMENTE (usaremos para exclusão)
    const STATUS_FALHA = ['CANCELADO', 'FRACASSADO', 'SUSPENSA', 'DESERTA'];

    licitacoesFiltradas.forEach(licitacao => {
        const situacaoNormalizada = normalizarString(licitacao[CONFIG.SITUACAO_COLUNA]);
        const municipio = licitacao[CONFIG.MUNICIPIO_COLUNA];
        const dataResultado = licitacao[CONFIG.DATA_RESULTADO_COLUNA]; // Novo campo!
        
        // Tenta parsear o valor
        const valorRaw = String(licitacao[CONFIG.VALOR_COLUNA] || '0').replace(',', '.').trim();
        const valor = parseFloat(valorRaw);
        
        let isSuccess = false;

        // CRITÉRIO DE SUCESSO REFINADO:
        // 1. A situação contém um termo de sucesso (HOMOLOGADO, CONTRATADO, etc.)
        const matchSuccessStatus = STATUS_APROVADO.some(status => situacaoNormalizada.includes(normalizarString(status)));
        
        // 2. A situação NÃO é uma falha explícita (CANCELADO, FRACASSADO, etc.)
        const matchFailureStatus = STATUS_FALHA.some(status => situacaoNormalizada.includes(normalizarString(status)));

        // 3. A licitação tem uma Data de Resultado, indicando que o processo terminou formalmente.
        const hasResultDate = dataResultado && dataResultado.trim() !== '';

        // UMA licitação é considerada sucesso se:
        // (A Situação indica APROVAÇÃO) OU
        // (Tem Data de Resultado E a Situação não é uma FALHA explícita)
        if (matchSuccessStatus || (hasResultDate && !matchFailureStatus)) {
            isSuccess = true;
        }

        // 1. Contagem de Sucesso (aprovada/finalizada)
        if (isSuccess) {
            totalSucesso++;
            
            // 2. Contagem de Sucesso por Município
            if (municipio) {
                contagemMunicipios[municipio] = (contagemMunicipios[municipio] || 0) + 1;
            }
        }
        
        // 3. Valor Total (mantido)
        if (!isNaN(valor)) {
            valorTotal += valor;
        }
    });

    // ... (Restante do cálculo de porcentagem e topMunicipios) ...
    
    const porcentagemSucesso = total > 0 
        ? ((totalSucesso / total) * 100).toFixed(2)
        : 0;

    // Encontra o Top 3 Municípios
    const topMunicipios = Object.entries(contagemMunicipios)
        .sort(([, a], [, b]) => b - a) 
        .slice(0, 3)
        .map(([municipio, contagem]) => ({ municipio, aprovacoes: contagem }));

    return {
        totalAmostra: total,
        totalAprovadas: totalSucesso,
        porcentagemSucesso: `${porcentagemSucesso}%`,
        valorTotalAmostra: parseFloat(valorTotal.toFixed(2)),
        topMunicipiosSucesso: topMunicipios,
    };
}


// --------------------------------------------------------------------------------
// FUNÇÃO DE GERAÇÃO DE RELATÓRIO PELA IA
// --------------------------------------------------------------------------------
async function gerarRelatorioComIA(analiseJson) {
    if (!GEMINI_API_KEY) {
        return { erro: "Chave da API Gemini não configurada. Relatório de IA indisponível." };
    }
    
    const systemInstruction = `Você é um Analista de Business Intelligence (BI) sênior, especializado em licitações públicas. Sua função é analisar o JSON fornecido e transformá-lo em uma análise estruturada. **O retorno DEVE ser um objeto JSON válido, aderente ao schema fornecido, e NUNCA texto livre ou Markdown.**`;

    const prompt = `
        Gere uma análise de BI concisa e profissional baseada nos dados de licitações fornecidos.

        Preencha os campos do objeto de resposta JSON:
        1. sumario_executivo: Destaque os principais KPIs (Amostra, Valor Total, Porcentagem de Sucesso).
        2. analise_performance: Interprete a Porcentagem de Sucesso (ex: "16.67% é baixa, indicando gargalos...").
        3. foco_geografico: Analise a distribuição de sucesso nos Top 3 Municípios.
        4. recomendacoes_acao: Liste 3 ações práticas e específicas (ex: "Analisar perdas em PE e CE", "Focar em BH e Salvador").

        **Dados de Análise em JSON:**
        ${JSON.stringify(analiseJson, null, 2)}
    `;
    
    // Definição do Schema JSON esperado (para guiar o modelo)
    const analysisSchema = {
        type: "object",
        properties: {
            sumario_executivo: {
                type: "string",
                description: "Resumo executivo conciso e profissional sobre os principais KPIs."
            },
            analise_performance: {
                type: "string",
                description: "Interpretação da taxa de sucesso e o que ela implica (gargalos, desafios, etc.)."
            },
            foco_geografico: {
                type: "string",
                description: "Análise da distribuição de sucesso nos municípios mais aprovados."
            },
            recomendacoes_acao: {
                type: "array",
                description: "Lista de 3 ações estratégicas e acionáveis.",
                items: {
                    type: "string"
                }
            }
        },
        required: ["sumario_executivo", "analise_performance", "foco_geografico", "recomendacoes_acao"]
    };

    try {
        const response = await ai.models.generateContent({
            model: MODEL_NAME,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: {
                systemInstruction: systemInstruction,
                // CHAVE: Define o tipo de retorno como JSON
                responseMimeType: "application/json", 
                responseSchema: analysisSchema
            },
        });
        
        // Retorna a string JSON. Precisamos parsear no endpoint.
        return response.text; 

    } catch (error) {
        console.error("ERRO na chamada à API da IA:", error.message);
        return JSON.stringify({ erro: `Falha técnica ao gerar o relatório com IA: ${error.message}` });
    }
}


// --------------------------------------------------------------------------------
// ENDPOINT DE ANÁLISE (AGORA SINCRONIZANDO CÁLCULO E IA)
// --------------------------------------------------------------------------------

exports.analisarLicitacoes = async (req, res) => {
    // 1. Extrai os filtros DA QUERY STRING (Correção do erro "orgao is not defined")
    const { orgao = '', objeto = '' } = req.query; 

    // Verifica se os parâmetros estão presentes
    if (!orgao && !objeto) {
        return res.status(400).json({ 
            erro: "Faltam parâmetros de busca. Forneça pelo menos 'orgao' ou 'objeto'.",
            sugestao: "Use a URL /api/analise?orgao=<termo>&objeto=<termo>" 
        });
    }

    try {
        // 2. Filtra e calcula as métricas
        const licitacoesFiltradas = aplicarFiltro(orgao, objeto);
        const analise = calcularMetricas(licitacoesFiltradas);
        
        // 3. Prepara o payload para a IA
        const aiPayload = {
            filtro_aplicado: { orgao, objeto },
            analise: analise,
            sample_licitacoes: licitacoesFiltradas.slice(0, 5) 
        };

        // 4. GERA O RELATÓRIO USANDO A IA (Retorna uma string JSON)
        const relatorioString = await gerarRelatorioComIA(aiPayload);
        
        // 5. Converte a string JSON da IA em um objeto para anexar ao retorno
        let relatorioGerencialEstruturado;
        try {
            relatorioGerencialEstruturado = JSON.parse(relatorioString);
        } catch (e) {
            console.error("Erro ao fazer o parse do JSON da IA:", e);
            // Em caso de erro de parse, retorna o erro no objeto estruturado
            relatorioGerencialEstruturado = { 
                erro_ia: "Retorno da IA não é um JSON válido. Verifique o log do servidor.", 
                raw_data_inicio: relatorioString.substring(0, 100) 
            };
        }

        // 6. Retorna o resultado completo
        res.json({
            status: "sucesso",
            data_fonte: JSON_FILE_NAME,
            filtro_aplicado: { orgao, objeto },
            analise: analise, // Métricas numéricas
            relatorio_gerencial_estruturado: relatorioGerencialEstruturado, // Novo campo estruturado
            sample_licitacoes: licitacoesFiltradas.slice(0, 5) 
        });
        
    } catch (error) {
        console.error(`[ERRO ANALISE]: ${error.message}`);
        res.status(500).json({ erro: "Erro interno ao processar a análise." });
    }
};
// --------------------------------------------------------------------------------
// ENDPOINT DE BUSCA ORIGINAL (mantido para compatibilidade)
// --------------------------------------------------------------------------------

exports.buscarLicitacoes = async (req, res) => {
    // ... (Mantido o código do endpoint original) ...
    // 1. Extrai os filtros da Query String
    const { orgao, objeto } = req.query;
    
    if (!orgao || !objeto) {
        return res.status(400).json({ 
            erro: "Faltam parâmetros de busca.",
            sugestao: "Use a URL /api/licitacoes?orgao=<termo>&objeto=<termo>" 
        });
    }
    
    // 2. Filtra o array carregado na memória
    const licitacoesFiltradas = aplicarFiltro(orgao, objeto);

    // 3. Retorna o resultado
    res.json({
        status: "sucesso",
        data_fonte: JSON_FILE_NAME,
        filtro_aplicado: { orgao, objeto },
        total_resultados: licitacoesFiltradas.length,
        licitacoes: licitacoesFiltradas
    });
};