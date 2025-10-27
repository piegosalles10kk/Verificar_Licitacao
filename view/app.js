// ========================================
// SISTEMA DE ANÁLISE DE LICITAÇÕES - JS
// ========================================

// ========================================
// CONFIGURAÇÃO DA API
// *** ALTERE AQUI A URL DA SUA API ***
// ========================================
const API_BASE_URL = 'http://localhost:2130/api';

// ========================================
// VARIÁVEIS GLOBAIS
// ========================================
let approvalChartInstance = null;
let locationChartInstance = null;
let allLicitacoes = []; // Armazena todas as licitações
let filteredLicitacoes = []; // Armazena licitações filtradas

// ========================================
// ELEMENTOS DO DOM
// ========================================
const searchForm = document.getElementById('searchForm');
const orgaoInput = document.getElementById('orgaoInput');
const objetoInput = document.getElementById('objetoInput');
const searchBtn = document.getElementById('searchBtn');
const loadingIndicator = document.getElementById('loadingIndicator');
const resultsContainer = document.getElementById('resultsContainer');

// Elementos de filtro
const tableSearch = document.getElementById('tableSearch');
const municipioFilter = document.getElementById('municipioFilter');
const ordenacaoFilter = document.getElementById('ordenacaoFilter');
const clearFiltersBtn = document.getElementById('clearFiltersBtn');

// ========================================
// EVENT LISTENERS
// ========================================
searchForm.addEventListener('submit', handleSearch);
tableSearch.addEventListener('input', applyFilters);
municipioFilter.addEventListener('change', applyFilters);
ordenacaoFilter.addEventListener('change', applyFilters);
clearFiltersBtn.addEventListener('click', clearFilters);

// ========================================
// FUNÇÃO PRINCIPAL DE BUSCA (COM VALIDAÇÃO)
// ========================================
async function handleSearch(event) {
    event.preventDefault();
    
    const orgao = orgaoInput.value.trim();
    const objeto = objetoInput.value.trim();
    
    if (!orgao || !objeto) {
        showErrorMessage(
            'Campos Obrigatórios',
            'Por favor, preencha todos os campos de busca (Órgão e Objeto).'
        );
        return;
    }
    
    // Mostrar loading inicial
    showLoading('Validando parâmetros de busca...');
    
    try {
        // ETAPA 1: Validar se existem licitações usando /licitacoes
        const validationResponse = await fetch(
            `${API_BASE_URL}/licitacoes?orgao=${encodeURIComponent(orgao)}&objeto=${encodeURIComponent(objeto)}`
        );
        
        if (!validationResponse.ok) {
            throw new Error(`Erro na requisição de validação: ${validationResponse.status}`);
        }
        
        const validationData = await validationResponse.json();
        
        // Verificar se há licitações disponíveis
        if (!validationData.licitacoes || validationData.licitacoes.length === 0) {
            showErrorMessage(
                'Nenhuma Licitação Encontrada',
                'Não há licitações disponíveis com os parâmetros informados.<br><br>' +
                '<strong>Sugestões:</strong><br>' +
                '• Tente ajustar os termos de busca<br>' +
                '• Utilize palavras-chave mais genéricas<br>' +
                '• Verifique a grafia dos termos'
            );
            return;
        }
        
        // Atualizar mensagem de loading com quantidade encontrada
        const quantidadeEncontrada = validationData.total_resultados;
        showLoading(
            'Validação concluída!',
            `Processando ${quantidadeEncontrada} ${quantidadeEncontrada === 1 ? 'licitação encontrada' : 'licitações encontradas'}...`
        );
        
        // Pequeno delay para o usuário ver a mensagem
        await new Promise(resolve => setTimeout(resolve, 800));
        
        // ETAPA 2: Se validação OK, buscar análise completa
        showLoading(
            `Processando ${quantidadeEncontrada} ${quantidadeEncontrada === 1 ? 'licitação' : 'licitações'}`,
            'Gerando análises e gráficos...'
        );
        
        const analysisResponse = await fetch(
            `${API_BASE_URL}/analise?orgao=${encodeURIComponent(orgao)}&objeto=${encodeURIComponent(objeto)}`
        );
        
        if (!analysisResponse.ok) {
            throw new Error(`Erro na requisição de análise: ${analysisResponse.status}`);
        }
        
        const analysisData = await analysisResponse.json();
        
        // Armazenar todas as licitações da validação
        allLicitacoes = validationData.licitacoes;
        
        // Processar e exibir resultados
        displayResults(analysisData);
        
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        showErrorMessage(
            'Erro de Conexão',
            'Não foi possível buscar dados da API.<br><br>' +
            '<strong>Possíveis causas:</strong><br>' +
            '• Servidor não está rodando<br>' +
            '• Problema de conexão de rede<br>' +
            '• URL da API incorreta<br><br>' +
            `<em>Detalhes técnicos: ${error.message}</em>`
        );
    }
}

// ========================================
// FUNÇÃO PARA EXIBIR RESULTADOS
// ========================================
function displayResults(data) {
    // Ocultar loading
    hideLoading();
    
    // Extrair dados
    const analise = data.analise;
    const relatorio = data.relatorio_gerencial_estruturado;
    
    // Atualizar KPIs
    updateKPIs(analise);
    
    // Atualizar gráficos (agora com TODOS os municípios)
    updateCharts(analise, allLicitacoes);
    
    // Atualizar relatório gerencial
    updateReport(relatorio);
    
    // Atualizar tabela com TODAS as licitações
    populateMunicipioFilter();
    filteredLicitacoes = [...allLicitacoes];
    updateSampleTable(filteredLicitacoes);
    
    // Mostrar container de resultados
    resultsContainer.style.display = 'block';
    
    // Scroll suave para os resultados
    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ========================================
// ATUALIZAR KPIs
// ========================================
function updateKPIs(analise) {
    document.getElementById('kpiTotal').textContent = formatNumber(analise.totalAmostra);
    document.getElementById('kpiAprovadas').textContent = formatNumber(analise.totalAprovadas);
    document.getElementById('kpiTaxa').textContent = analise.porcentagemSucesso;
    document.getElementById('kpiValor').textContent = formatCurrency(analise.valorTotalAmostra);
}

// ========================================
// ATUALIZAR GRÁFICOS
// ========================================
function updateCharts(analise, licitacoes) {
    // Gráfico 1: Taxa de Aprovação (Doughnut)
    updateApprovalChart(analise);
    
    // Gráfico 2: Distribuição Geográfica - TODOS os municípios
    updateLocationChart(licitacoes);
}

// Gráfico de Taxa de Aprovação
function updateApprovalChart(analise) {
    const ctx = document.getElementById('approvalChart').getContext('2d');
    
    const aprovadas = analise.totalAprovadas;
    const naoAprovadas = analise.totalAmostra - analise.totalAprovadas;
    
    // Destruir gráfico anterior se existir
    if (approvalChartInstance) {
        approvalChartInstance.destroy();
    }
    
    approvalChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Aprovadas', 'Não Aprovadas'],
            datasets: [{
                data: [aprovadas, naoAprovadas],
                backgroundColor: [
                    '#2d6a4f',  // Verde corporativo
                    '#c77700'   // Laranja corporativo
                ],
                borderWidth: 3,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        font: {
                            size: 14,
                            family: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif"
                        },
                        padding: 20,
                        usePointStyle: true
                    }
                },
                tooltip: {
                    backgroundColor: '#1a4d7a',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 4,
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = context.parsed || 0;
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((value / total) * 100).toFixed(1);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// Gráfico de Distribuição Geográfica - TODOS OS MUNICÍPIOS
function updateLocationChart(licitacoes) {
    const ctx = document.getElementById('locationChart').getContext('2d');
    
    // Contar aprovações por município
    const municipioCount = {};
    
    licitacoes.forEach(lic => {
        const municipio = lic['Município'] || 'Não informado';
        const situacao = normalizarString(lic['Situação Licitação'] || '');
        
        // Verificar se é aprovada
        const isApproved = isLicitacaoAprovada(situacao);
        
        if (isApproved) {
            municipioCount[municipio] = (municipioCount[municipio] || 0) + 1;
        }
    });
    
    // Se não há dados de municípios
    if (Object.keys(municipioCount).length === 0) {
        ctx.canvas.parentElement.innerHTML = '<p style="text-align: center; padding: 40px; color: #767676;">Dados geográficos não disponíveis</p>';
        return;
    }
    
    // Ordenar municípios por quantidade de aprovações
    const sortedMunicipios = Object.entries(municipioCount)
        .sort(([, a], [, b]) => b - a);
    
    const labels = sortedMunicipios.map(([municipio]) => municipio);
    const valores = sortedMunicipios.map(([, count]) => count);
    
    // Destruir gráfico anterior se existir
    if (locationChartInstance) {
        locationChartInstance.destroy();
    }
    
    locationChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Licitações Aprovadas',
                data: valores,
                backgroundColor: '#1a4d7a',
                borderColor: '#0f3554',
                borderWidth: 2,
                borderRadius: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            indexAxis: labels.length > 10 ? 'y' : 'x', // Horizontal se muitos municípios
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        color: '#e9ecef'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: '#1a4d7a',
                    titleFont: { size: 14, weight: 'bold' },
                    bodyFont: { size: 13 },
                    padding: 12,
                    cornerRadius: 4
                }
            }
        }
    });
}

// ========================================
// ATUALIZAR RELATÓRIO GERENCIAL
// ========================================
function updateReport(relatorio) {
    const reportContent = document.getElementById('reportContent');
    
    // Verificar se há erro no relatório
    if (relatorio.erro || relatorio.erro_ia) {
        reportContent.innerHTML = `
            <div style="padding: 20px; background: #fff3cd; border-left: 4px solid #ffc107; border-radius: 4px;">
                <strong>⚠️ Relatório de IA Indisponível</strong>
                <p style="margin-top: 10px;">${relatorio.erro || relatorio.erro_ia}</p>
            </div>
        `;
        return;
    }
    
    let html = '';
    
    // Sumário Executivo
    if (relatorio.sumario_executivo) {
        html += `
            <h3>Sumário Executivo</h3>
            <p>${relatorio.sumario_executivo}</p>
        `;
    }
    
    // Análise de Performance
    if (relatorio.analise_performance) {
        html += `
            <h3>Análise de Performance</h3>
            <p>${relatorio.analise_performance}</p>
        `;
    }
    
    // Foco Geográfico
    if (relatorio.foco_geografico) {
        html += `
            <h3>Foco Geográfico</h3>
            <p>${relatorio.foco_geografico}</p>
        `;
    }
    
    // Recomendações de Ação
    if (relatorio.recomendacoes_acao && relatorio.recomendacoes_acao.length > 0) {
        html += `
            <h3>Recomendações Estratégicas</h3>
            <ul>
        `;
        
        relatorio.recomendacoes_acao.forEach(recomendacao => {
            html += `<li>${recomendacao}</li>`;
        });
        
        html += `</ul>`;
    }
    
    reportContent.innerHTML = html;
}

// ========================================
// POPULAR FILTRO DE MUNICÍPIOS
// ========================================
function populateMunicipioFilter() {
    const select = document.getElementById('municipioFilter');
    
    // Limpar opções antigas (manter apenas "Todos")
    select.innerHTML = '<option value="">Todos os Municípios</option>';
    
    // Obter lista única de municípios
    const municipios = [...new Set(allLicitacoes.map(lic => lic['Município'] || 'Não informado'))];
    municipios.sort();
    
    // Adicionar opções
    municipios.forEach(municipio => {
        const option = document.createElement('option');
        option.value = municipio;
        option.textContent = municipio;
        select.appendChild(option);
    });
}

// ========================================
// ATUALIZAR TABELA COM TODAS AS LICITAÇÕES
// ========================================
function updateSampleTable(licitacoes) {
    const tbody = document.getElementById('sampleTableBody');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const totalCount = document.getElementById('totalLicitacoesCount');
    
    tbody.innerHTML = '';
    
    if (!licitacoes || licitacoes.length === 0) {
        tbody.style.display = 'none';
        noResultsMessage.style.display = 'block';
        totalCount.textContent = '0';
        return;
    }
    
    tbody.style.display = '';
    noResultsMessage.style.display = 'none';
    totalCount.textContent = licitacoes.length;
    
    licitacoes.forEach(lic => {
        const row = document.createElement('tr');
        
        // Verificar se é aprovada
        const situacao = normalizarString(lic['Situação Licitação'] || '');
        const isApproved = isLicitacaoAprovada(situacao);
        
        if (isApproved) {
            row.classList.add('approved-row');
        }
        
        // Extrair e formatar dados
        const orgao = lic['Nome Órgão'] || '-';
        const objeto = truncateText(lic['Objeto'] || '-', 100);
        const situacaoOriginal = lic['Situação Licitação'] || '-';
        const municipio = lic['Município'] || 'Não informado';
        const valor = formatCurrency(parseFloat(lic['Valor Licitação']) || 0);
        
        // Badge de status
        const statusBadge = isApproved 
            ? '<span class="status-badge approved">Aprovada</span>'
            : '<span class="status-badge not-approved">Não Aprovada</span>';
        
        row.innerHTML = `
            <td>${statusBadge}</td>
            <td><strong>${orgao}</strong></td>
            <td>${objeto}</td>
            <td>${situacaoOriginal}</td>
            <td>${municipio}</td>
            <td style="text-align: right; font-weight: 600;">${valor}</td>
        `;
        
        tbody.appendChild(row);
    });
}

// ========================================
// APLICAR FILTROS
// ========================================
function applyFilters() {
    const searchTerm = tableSearch.value.toLowerCase();
    const selectedMunicipio = municipioFilter.value;
    const ordenacao = ordenacaoFilter.value;
    
    // Filtrar
    filteredLicitacoes = allLicitacoes.filter(lic => {
        // Filtro de busca por texto
        const matchesSearch = searchTerm === '' || 
            (lic['Nome Órgão'] || '').toLowerCase().includes(searchTerm) ||
            (lic['Objeto'] || '').toLowerCase().includes(searchTerm) ||
            (lic['Situação Licitação'] || '').toLowerCase().includes(searchTerm) ||
            (lic['Município'] || '').toLowerCase().includes(searchTerm);
        
        // Filtro de município
        const matchesMunicipio = selectedMunicipio === '' || 
            (lic['Município'] || 'Não informado') === selectedMunicipio;
        
        return matchesSearch && matchesMunicipio;
    });
    
    // Ordenar
    sortLicitacoes(filteredLicitacoes, ordenacao);
    
    // Atualizar tabela
    updateSampleTable(filteredLicitacoes);
}

// ========================================
// ORDENAR LICITAÇÕES
// ========================================
function sortLicitacoes(licitacoes, criterio) {
    switch (criterio) {
        case 'status':
            // Aprovadas primeiro
            licitacoes.sort((a, b) => {
                const aApproved = isLicitacaoAprovada(normalizarString(a['Situação Licitação'] || ''));
                const bApproved = isLicitacaoAprovada(normalizarString(b['Situação Licitação'] || ''));
                return bApproved - aApproved;
            });
            break;
        
        case 'valor-desc':
            // Maior valor primeiro
            licitacoes.sort((a, b) => {
                const valorA = parseFloat(a['Valor Licitação']) || 0;
                const valorB = parseFloat(b['Valor Licitação']) || 0;
                return valorB - valorA;
            });
            break;
        
        case 'valor-asc':
            // Menor valor primeiro
            licitacoes.sort((a, b) => {
                const valorA = parseFloat(a['Valor Licitação']) || 0;
                const valorB = parseFloat(b['Valor Licitação']) || 0;
                return valorA - valorB;
            });
            break;
        
        case 'municipio':
            // Ordem alfabética por município
            licitacoes.sort((a, b) => {
                const municipioA = a['Município'] || 'Não informado';
                const municipioB = b['Município'] || 'Não informado';
                return municipioA.localeCompare(municipioB);
            });
            break;
    }
}

// ========================================
// LIMPAR FILTROS
// ========================================
function clearFilters() {
    tableSearch.value = '';
    municipioFilter.value = '';
    ordenacaoFilter.value = 'status';
    applyFilters();
}

// ========================================
// VERIFICAR SE LICITAÇÃO É APROVADA
// ========================================
function isLicitacaoAprovada(situacaoNormalizada) {
    const STATUS_APROVADO = ['HOMOLOGADO', 'CONTRATADO', 'ADJUDICADO', 'EVENTO DE RESULTADO', 'ENCERRADO'];
    const STATUS_FALHA = ['CANCELADO', 'FRACASSADO', 'SUSPENSA', 'DESERTA'];
    
    const matchSuccessStatus = STATUS_APROVADO.some(status => 
        situacaoNormalizada.includes(normalizarString(status))
    );
    
    const matchFailureStatus = STATUS_FALHA.some(status => 
        situacaoNormalizada.includes(normalizarString(status))
    );
    
    return matchSuccessStatus && !matchFailureStatus;
}

// ========================================
// FUNÇÕES UTILITÁRIAS
// ========================================

function normalizarString(str) {
    if (!str) return '';
    return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, "")
        .toUpperCase()
        .trim();
}

function showLoading(mainMessage = 'Processando análise de dados...', subMessage = '') {
    searchBtn.disabled = true;
    resultsContainer.style.display = 'none';
    
    const loadingIndicator = document.getElementById('loadingIndicator');
    const loadingMessageEl = document.getElementById('loadingMessage');
    const loadingSubMessageEl = document.getElementById('loadingSubMessage');
    
    // Remover classe de erro se existir
    loadingIndicator.classList.remove('error');
    
    // Garantir que o spinner está visível
    const spinner = loadingIndicator.querySelector('.spinner');
    if (spinner) {
        spinner.style.display = 'block';
    }
    
    loadingMessageEl.textContent = mainMessage;
    loadingSubMessageEl.textContent = subMessage;
    
    loadingIndicator.style.display = 'block';
}

function hideLoading() {
    searchBtn.disabled = false;
    document.getElementById('loadingIndicator').style.display = 'none';
}

function showErrorMessage(title, message) {
    searchBtn.disabled = false;
    resultsContainer.style.display = 'none';
    
    const loadingIndicator = document.getElementById('loadingIndicator');
    loadingIndicator.classList.add('error');
    
    // Esconder o spinner
    const spinner = loadingIndicator.querySelector('.spinner');
    if (spinner) {
        spinner.style.display = 'none';
    }
    
    loadingIndicator.innerHTML = `
        <div style="font-size: 64px; margin-bottom: 20px;">⚠️</div>
        <p class="error-message">${title}</p>
        <p class="error-details">${message}</p>
        <button class="retry-button" onclick="location.reload()">Tentar Novamente</button>
    `;
    
    loadingIndicator.style.display = 'block';
}

function formatNumber(num) {
    return new Intl.NumberFormat('pt-BR').format(num);
}

function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

function truncateText(text, maxLength) {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

