const axios = require('axios');
const arduino = require('../arduino/arduino');

const LIMITES = {
    PM25: 15,  // µg/m³
    NO2: 200,
    O3: 180,
    CO: 10,
    UMIDADE_MIN: 40,
    UMIDADE_MAX: 60
};

let ultimaRecomendacao = {
    fechar_janelas: false,
    ativar_purificador: false,
    usar_mascaras: false,
    controlar_umidade: false,
    tempo_para_pico: 0
};

// Configurações da API Meteomatics
const USERNAME = process.env.METEOMATICS_USER || 'lima_caique';
const PASSWORD = process.env.METEOMATICS_PASS || 'py01s7YnAEAc14VEM952';

// Localização padrão (será substituída por geocodificação)
let localizacaoAtual = {
    nome: process.env.LOCALIZACAO || 'São Paulo, SP, Brasil',
    lat: '-23.5505',
    lon: '-46.6333'
};

/**
 * Converte nome de localização em coordenadas usando API de geocodificação
 * @param {string} local - Nome da cidade/endereço
 * @returns {Promise<Object>} - {nome, lat, lon}
 */
async function obterCoordenadas(local) {
    // Usando OpenStreetMap Nominatim (gratuito e sem necessidade de API key)
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(local)}&limit=1`;

    const response = await axios.get(url, {
        headers: {
            'User-Agent': 'AtmosProject/1.0'
        },
        timeout: 5000
    });

    if (response.data && response.data.length > 0) {
        const resultado = response.data[0];
        return {
            nome: resultado.display_name,
            lat: resultado.lat,
            lon: resultado.lon
        };
    } else {
        throw new Error(`Localização "${local}" não encontrada`);
    }
}

/**
 * Define a localização atual do sistema
 * @param {string} local - Nome da cidade/endereço
 */
async function definirLocalizacao(local) {
    try {
        const novaLocalizacao = await obterCoordenadas(local);
        localizacaoAtual = novaLocalizacao;
        console.log(`Localização atualizada: ${novaLocalizacao.nome}`);
        console.log(`Coordenadas: ${novaLocalizacao.lat}, ${novaLocalizacao.lon}`);

        // Atualiza recomendações para a nova localização
        await atualizarRecomendacoes();

        return novaLocalizacao;
    } catch (error) {
        throw new Error(`Não foi possível definir localização: ${error.message}`);
    }
}

/**
 * Retorna a localização atual
 */
function obterLocalizacaoAtual() {
    return localizacaoAtual;
}

/**
 * Calcula a regressão linear para prever tendência de crescimento do poluente
 * @param {Array} dadosPoluente - Array com objetos {timestamp, valor}
 * @returns {Object|null} - {slope, intercept} ou null se dados insuficientes
 */
function calcularHoraPico(dadosPoluente) {
    const n = dadosPoluente.length;
    if (n < 2) return null;

    const y = dadosPoluente.map(d => d.valor);

    // Otimização: calcular médias uma única vez
    const yMedia = y.reduce((a, b) => a + b, 0) / n;
    const xMedia = (n - 1) / 2; // Média de índices 0..n-1

    let numer = 0, denom = 0;
    for (let i = 0; i < n; i++) {
        const xDiff = i - xMedia;
        numer += xDiff * (y[i] - yMedia);
        denom += xDiff * xDiff;
    }

    if (denom === 0) return null;

    const slope = numer / denom;
    const intercept = yMedia - slope * xMedia;

    return { slope, intercept };
}

/**
 * Calcula recomendações baseadas nos dados de poluentes e umidade
 * @param {Object} dados - Objeto com arrays de dados por poluente
 * @returns {Object} - Recomendações calculadas com horário de pico
 */
function calcularRecomendacoes(dados) {
    const poluentes = ['PM25', 'NO2', 'O3', 'CO'];
    let tempoHorasMin = null;
    let poluenteCritico = null;
    const previsoesPoluentes = {};

    // Calcula tempo para atingir limite crítico e horário de pico para cada poluente
    for (let poluente of poluentes) {
        if (!dados[poluente] || dados[poluente].length === 0) continue;

        const valorAtual = dados[poluente][0].valor;
        const result = calcularHoraPico(dados[poluente]);

        previsoesPoluentes[poluente] = {
            valor_atual: valorAtual,
            limite: LIMITES[poluente],
            tendencia: null,
            horas_para_limite: null,
            horario_pico: null,
            valores_previstos: dados[poluente].slice(0, 6).map(d => ({
                horario: new Date(d.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                valor: Math.round(d.valor * 10) / 10
            }))
        };

        if (!result) continue;

        const { slope } = result;
        const limite = LIMITES[poluente];

        // Define tendência
        if (slope > 0.5) previsoesPoluentes[poluente].tendencia = 'crescente';
        else if (slope < -0.5) previsoesPoluentes[poluente].tendencia = 'decrescente';
        else previsoesPoluentes[poluente].tendencia = 'estável';

        // Se está crescendo, calcula quando vai atingir o limite
        if (slope > 0) {
            const horasParaLimite = (limite - valorAtual) / slope;

            if (horasParaLimite >= 0) {
                const horarioPico = new Date(Date.now() + horasParaLimite * 60 * 60 * 1000);
                previsoesPoluentes[poluente].horas_para_limite = Math.round(horasParaLimite * 10) / 10;
                previsoesPoluentes[poluente].horario_pico = horarioPico.toLocaleString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                if (tempoHorasMin === null || horasParaLimite < tempoHorasMin) {
                    tempoHorasMin = horasParaLimite;
                    poluenteCritico = poluente;
                }
            }
        }
    }

    // Categoriza o tempo para pico e nível de alerta
    let tempo_categoria = 0;
    let nivel_alerta = 'BOM';
    let mensagem_alerta = 'Qualidade do ar em níveis aceitáveis';

    if (tempoHorasMin !== null) {
        if (tempoHorasMin <= 3) {
            tempo_categoria = 3;
            nivel_alerta = 'CRÍTICO';
            mensagem_alerta = `ATENÇÃO: ${poluenteCritico} atingirá nível crítico em menos de 3 horas!`;
        } else if (tempoHorasMin <= 6) {
            tempo_categoria = 2;
            nivel_alerta = 'ALTO';
            mensagem_alerta = `ALERTA: ${poluenteCritico} atingirá nível crítico em ${Math.round(tempoHorasMin)} horas`;
        } else if (tempoHorasMin <= 12) {
            tempo_categoria = 1;
            nivel_alerta = 'MODERADO';
            mensagem_alerta = `Atenção: ${poluenteCritico} pode atingir nível crítico em ${Math.round(tempoHorasMin)} horas`;
        } else {
            tempo_categoria = 0;
            nivel_alerta = 'BAIXO';
            mensagem_alerta = `${poluenteCritico} em tendência de crescimento mas ainda seguro`;
        }
    }

    // Pega valores atuais (primeiro item de cada array)
    const ultimo = {};
    for (let poluente of poluentes) {
        ultimo[poluente] = dados[poluente]?.[0]?.valor || 0;
    }
    const ultimaUmidade = dados['RH_2m']?.[0]?.valor || 50;

    // Calcula índice de qualidade do ar geral (0-100, quanto menor melhor)
    const indiceQualidade = Math.min(100, Math.round(
        (ultimo.PM25 / LIMITES.PM25 * 30) +
        (ultimo.NO2 / LIMITES.NO2 * 25) +
        (ultimo.O3 / LIMITES.O3 * 25) +
        (ultimo.CO / LIMITES.CO * 20)
    ));

    return {
        timestamp: new Date().toISOString(),
        nivel_alerta,
        tempo_categoria,
        mensagem: mensagem_alerta,
        poluente_critico: poluenteCritico,
        tempo_ate_pico: {
            horas: tempoHorasMin ? Math.floor(tempoHorasMin) : null,
            minutos: tempoHorasMin ? Math.round((tempoHorasMin % 1) * 60) : null,
            horario_estimado: tempoHorasMin ? new Date(Date.now() + tempoHorasMin * 60 * 60 * 1000).toLocaleString('pt-BR') : null
        },
        indice_qualidade_ar: {
            valor: indiceQualidade,
            categoria: indiceQualidade < 25 ? 'BOM' : indiceQualidade < 50 ? 'REGULAR' : indiceQualidade < 75 ? 'RUIM' : 'PÉSSIMO'
        },
        valores_atuais: ultimo,
        umidade_atual: ultimaUmidade,
        previsoes_por_poluente: previsoesPoluentes,
        recomendacoes: {
            fechar_janelas: ultimo.PM25 > LIMITES.PM25 || ultimo.NO2 > LIMITES.NO2,
            ativar_purificador: ultimo.PM25 > 35 || ultimo.O3 > 70,
            usar_mascaras: ultimo.PM25 > 55 || ultimo.CO > LIMITES.CO,
            'se_hidratar-Controlar_humidade': (ultimaUmidade < LIMITES.UMIDADE_MIN || ultimaUmidade > LIMITES.UMIDADE_MAX) || (nivel_alerta === 'CRÍTICO' || nivel_alerta === 'ALTO')
        }
    };
}

/**
 * Busca dados do Arduino e atualiza recomendações
 */
async function atualizarRecomendacoes() {
    try {
        const dadosArduino = arduino.obterDados();

        if (!dadosArduino) {
            console.warn('⏳ Aguardando dados do Arduino...');
            return;
        }

        // Monta estrutura compatível com calcularRecomendacoes
        const dados = {
            PM25: [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.pm25 || 0 }],
            NO2: [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.no2 || 0 }],
            O3: [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.o3 || 0 }],
            CO: [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.co || 0 }],
            RH_2m: [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.umidade || 50 }]
        };

        ultimaRecomendacao = calcularRecomendacoes(dados);
        ultimaRecomendacao.localizacao = 'Local (Arduino)';
        console.log(`[${new Date().toLocaleTimeString()}] ✅ Recomendação atualizada`);

        // Envia as recomendações de volta para o Arduino
        if (ultimaRecomendacao.recomendacoes) {
            arduino.enviarRecomendacoes(ultimaRecomendacao.recomendacoes);
        }

    } catch (error) {
        console.error('Erro ao atualizar recomendação:', error.message);
    }
}

/**
 * Retorna as recomendações atuais
 */
function obterRecomendacoes() {
    return ultimaRecomendacao;
}

/**
 * Inicializa o sistema de monitoramento
 */
async function inicializar() {
    console.log('🚀 Iniciando sistema via Arduino...');
    arduino.conectar();

    // Aguarda 3 segundos antes da primeira leitura
    setTimeout(() => {
        atualizarRecomendacoes();
        setInterval(atualizarRecomendacoes, 10000); // A cada 10 segundos
    }, 3000);
}

module.exports = {
    inicializar,
    obterRecomendacoes,
    calcularRecomendacoes,
    calcularHoraPico,
    definirLocalizacao,
    obterLocalizacaoAtual,
    obterCoordenadas,
    LIMITES
};