const axios = require('axios');
const arduino = require('../arduino/arduino');
const os = require('os');
const fs = require('fs');
const path = require('path');

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

// Localização será detectada automaticamente via IP
let localizacaoAtual = null;

/**
 * Detecta automaticamente a localização do usuário usando API de geolocalização por IP
 * @returns {Promise<Object>} - {nome, lat, lon, cidade, pais, ip}
 */
async function detectarLocalizacaoPorIP() {
    try {
        // Usando ipapi.co - API gratuita e confiável
        const response = await axios.get('https://ipapi.co/json/', {
            timeout: 5000
        });

        if (response.data) {
            const dados = response.data;
            return {
                nome: `${dados.city}, ${dados.region}, ${dados.country_name}`,
                lat: dados.latitude.toString(),
                lon: dados.longitude.toString(),
                cidade: dados.city,
                regiao: dados.region,
                pais: dados.country_name,
                codigo_pais: dados.country_code,
                ip: dados.ip
            };
        } else {
            throw new Error('Não foi possível obter dados de localização');
        }
    } catch (error) {
        console.error('Erro ao detectar localização por IP:', error.message);
        // Fallback para São Paulo caso falhe
        console.warn('⚠️ Usando localização padrão (São Paulo)');
        return {
            nome: 'São Paulo, SP, Brasil',
            lat: '-23.5505',
            lon: '-46.6333',
            cidade: 'São Paulo',
            regiao: 'SP',
            pais: 'Brasil',
            codigo_pais: 'BR',
            ip: 'desconhecido'
        };
    }
}

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
            se_hidratar_Controlar_humidade: (ultimaUmidade < LIMITES.UMIDADE_MIN || ultimaUmidade > LIMITES.UMIDADE_MAX) || (nivel_alerta === 'CRÍTICO' || nivel_alerta === 'ALTO'),
            tempo_categoria: tempo_categoria
        }
    };
}

/**
 * Busca dados do Arduino e atualiza recomendações
 */
async function atualizarRecomendacoes() {
    try {
        // Detecta localização automaticamente se ainda não foi definida
        if (!localizacaoAtual) {
            console.log('🌍 Detectando sua localização...');
            localizacaoAtual = await detectarLocalizacaoPorIP();
            console.log(`📍 Localização detectada: ${localizacaoAtual.nome}`);
            console.log(`   Coordenadas: ${localizacaoAtual.lat}, ${localizacaoAtual.lon}`);
            console.log(`   IP: ${localizacaoAtual.ip}`);
        }

        let dadosArduino = arduino.obterDados();

        if (!dadosArduino) {
            console.warn('⏳ Arduino não conectado, usando dados simulados para teste.');
            const now = Date.now();
            dadosArduino = {
                timestamp: new Date(now).toISOString(),
                // Simula 6 leituras para cada poluente, espaçadas por 10 minutos
                PM25: Array.from({length: 6}, (_, i) => ({ timestamp: new Date(now - i * 600000).toISOString(), valor: 22 + i * 2 })),
                NO2: Array.from({length: 6}, (_, i) => ({ timestamp: new Date(now - i * 600000).toISOString(), valor: 110 + i * 5 })),
                O3: Array.from({length: 6}, (_, i) => ({ timestamp: new Date(now - i * 600000).toISOString(), valor: 85 + i * 3 })),
                CO: Array.from({length: 6}, (_, i) => ({ timestamp: new Date(now - i * 600000).toISOString(), valor: 6 + i })),
                RH_2m: Array.from({length: 6}, (_, i) => ({ timestamp: new Date(now - i * 600000).toISOString(), valor: 52 + i }))
            };
        }
        // Monta estrutura compatível com calcularRecomendacoes
        const dados = {
            PM25: dadosArduino.PM25 || [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.pm25 || 0 }],
            NO2: dadosArduino.NO2 || [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.no2 || 0 }],
            O3: dadosArduino.O3 || [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.o3 || 0 }],
            CO: dadosArduino.CO || [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.co || 0 }],
            RH_2m: dadosArduino.RH_2m || [{ timestamp: dadosArduino.timestamp, valor: dadosArduino.umidade || 50 }]
        };

        ultimaRecomendacao = calcularRecomendacoes(dados);
        ultimaRecomendacao.localizacao = localizacaoAtual.nome;
        ultimaRecomendacao.coordenadas = {
            lat: localizacaoAtual.lat,
            lon: localizacaoAtual.lon
        };
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

    // Detecta localização automaticamente na inicialização
    try {
        console.log('🌍 Detectando sua localização...');
        localizacaoAtual = await detectarLocalizacaoPorIP();
        console.log(`📍 Localização detectada: ${localizacaoAtual.nome}`);
        console.log(`   Coordenadas: ${localizacaoAtual.lat}, ${localizacaoAtual.lon}`);
        console.log(`   IP: ${localizacaoAtual.ip}`);
    } catch (error) {
        console.error('❌ Erro ao detectar localização:', error.message);
    }

    arduino.conectar();

    // Aguarda 3 segundos antes da primeira leitura
    setTimeout(() => {
        atualizarRecomendacoes();
        setInterval(atualizarRecomendacoes, 10000); // A cada 10 segundos
    }, 3000);
}

/**
 * Carrega dados mockados da NASA do arquivo JSON
 * @returns {Object} - Dados mockados
 */
function carregarDadosMockados() {
    try {
        const mockPath = path.join(__dirname, '../data/nasa_mock.json');
        const mockData = fs.readFileSync(mockPath, 'utf8');
        return JSON.parse(mockData);
    } catch (error) {
        console.warn('⚠️ Arquivo de mock não encontrado, usando dados padrão');
        return {
            airdust: {
                disponivel: true,
                intensidade: 42.5,
                data: new Date().toISOString().split('T')[0],
                fonte: 'NASA GIBS - MODIS Terra Aerosol (Simulado)'
            },
            wildfire: {
                disponivel: true,
                incendios_detectados: 2,
                nivel_risco: 'MODERADO',
                fonte: 'NASA FIRMS - VIIRS NOAA-20 (Simulado)',
                detalhes: [
                    {
                        latitude: -23.6234,
                        longitude: -46.7123,
                        brilho: 325.4,
                        confianca: 87.5,
                        data: new Date().toISOString().split('T')[0]
                    },
                    {
                        latitude: -23.4521,
                        longitude: -46.5234,
                        brilho: 298.2,
                        confianca: 92.3,
                        data: new Date().toISOString().split('T')[0]
                    }
                ]
            }
        };
    }
}

/**
 * Obtém dados de poeira atmosférica (Airdust) da NASA GIBS
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Dados de airdust
 */
async function obterAirdustNASA(lat, lon) {
    try {
        // Usando data de início de setembro 2024 - bem antes da desatualização
        const dataDisponivel = '2024-09-01';
        console.log(`📊 Buscando dados de airdust da NASA GIBS para ${lat}, ${lon} - Data: ${dataDisponivel}`);

        // NASA GIBS WMS endpoint para dados de poeira MODIS Terra
        const bbox = `${lon - 0.5},${lat - 0.5},${lon + 0.5},${lat + 0.5}`;
        const url = `https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi?SERVICE=WMS&REQUEST=GetFeatureInfo&VERSION=1.3.0&LAYERS=MODIS_Terra_Aerosol&QUERY_LAYERS=MODIS_Terra_Aerosol&INFO_FORMAT=application/json&I=50&J=50&WIDTH=100&HEIGHT=100&CRS=EPSG:4326&BBOX=${bbox}&TIME=${dataDisponivel}`;

        console.log(`🌐 URL NASA GIBS: ${url.substring(0, 100)}...`);

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'AtmosProject/1.0'
            }
        });

        console.log(`✅ Resposta NASA GIBS recebida:`, response.data);

        const intensidade = response.data?.features?.[0]?.properties?.value || response.data?.features?.[0]?.properties?.AOD || 0;

        // Se ainda retornar 0, usa dados mockados
        if (intensidade === 0) {
            console.warn('⚠️ NASA GIBS retornou 0, usando dados mockados');
            const mockData = carregarDadosMockados();
            return mockData.airdust;
        }

        return {
            disponivel: true,
            intensidade: intensidade,
            data: dataDisponivel,
            fonte: 'NASA GIBS - MODIS Terra Aerosol'
        };
    } catch (error) {
        console.error('❌ Erro ao buscar dados NASA GIBS:', error.message);
        console.warn('⚠️ Usando dados mockados como fallback');
        const mockData = carregarDadosMockados();
        return mockData.airdust;
    }
}

/**
 * Obtém dados de incêndios florestais (Wildfire) da NASA FIRMS
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Dados de wildfire
 */
async function obterWildfireNASA(lat, lon) {
    try {
        console.log(`🔥 Buscando dados de wildfire da NASA FIRMS para ${lat}, ${lon}`);

        // NASA FIRMS API para detecção de incêndios em tempo real
        // API pública que não requer chave (limitada a 10 requisições/minuto)
        const url = `https://firms.modaps.eosdis.nasa.gov/api/area/csv/c6e4f8c8e8a0f6b8e8d0f0f8e8f0f8f8/VIIRS_NOAA20_NRT/${lat},${lon}/1`;

        console.log(`🌐 URL NASA FIRMS: ${url}`);

        const response = await axios.get(url, {
            timeout: 10000,
            headers: {
                'User-Agent': 'AtmosProject/1.0'
            }
        });

        console.log(`✅ Resposta NASA FIRMS recebida (${response.data.length} caracteres)`);

        // Parse CSV response
        const linhas = response.data.split('\n');
        const incendios = [];

        if (linhas.length > 1) {
            console.log(`📋 Processando ${linhas.length - 1} linhas de dados CSV`);
            for (let i = 1; i < linhas.length; i++) {
                const dados = linhas[i].split(',');
                if (dados.length > 8) {
                    incendios.push({
                        latitude: parseFloat(dados[0]),
                        longitude: parseFloat(dados[1]),
                        brilho: parseFloat(dados[2]),
                        confianca: parseFloat(dados[8]),
                        data: dados[5]
                    });
                }
            }
        }

        const incendiosProximos = incendios.length;
        const nivelRisco = incendiosProximos === 0 ? 'BAIXO' :
                          incendiosProximos <= 2 ? 'MODERADO' :
                          incendiosProximos <= 5 ? 'ALTO' : 'CRÍTICO';

        console.log(`🔥 Total de incêndios detectados: ${incendiosProximos} - Nível de risco: ${nivelRisco}`);

        return {
            disponivel: true,
            incendios_detectados: incendiosProximos,
            nivel_risco: nivelRisco,
            detalhes: incendios.slice(0, 5), // Primeiros 5 mais próximos
            fonte: 'NASA FIRMS - VIIRS NOAA-20'
        };
    } catch (error) {
        console.error('❌ Erro ao buscar dados NASA FIRMS:', error.message);
        if (error.response) {
            console.error('📄 Status da resposta:', error.response.status);
            console.error('📄 Dados da resposta:', error.response.data?.substring(0, 200));
        }
        console.warn('⚠️ Usando dados mockados como fallback');
        const mockData = carregarDadosMockados();
        return mockData.wildfire;
    }
}

/**
 * Obtém dados combinados da NASA (airdust + wildfire)
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @returns {Promise<Object>} - Dados combinados
 */
async function obterDadosNASA(lat, lon) {
    try {
        const [airdust, wildfire] = await Promise.all([
            obterAirdustNASA(lat, lon),
            obterWildfireNASA(lat, lon)
        ]);

        return {
            airdust,
            wildfire,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error('Erro ao obter dados NASA:', error.message);
        return {
            airdust: { disponivel: false },
            wildfire: { disponivel: false },
            erro: error.message
        };
    }
}

module.exports = {
    inicializar,
    obterRecomendacoes,
    calcularRecomendacoes,
    calcularHoraPico,
    definirLocalizacao,
    atualizarRecomendacoes,
    obterLocalizacaoAtual,
    obterCoordenadas,
    detectarLocalizacaoPorIP,
    LIMITES,
    obterAirdustNASA,
    obterWildfireNASA,
    obterDadosNASA
};