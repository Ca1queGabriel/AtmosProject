// routes/api.js - API REST para monitoramento de qualidade do ar
const express = require('express');
const router = express.Router();
const trataDados = require('../scripts/trataDadosClimaticos');

/**
 * GET /api/dados-completos
 * ROTA UNIFICADA - Retorna TODOS os dados de uma vez:
 * - Busca dados FRESCOS da API Meteomatics
 * - Calcula recomendações
 * - Retorna qualidade do ar, localização e limites
 */
router.get('/dados-completos', async (req, res) => {
    try {
        console.log('🔄 Rota /dados-completos chamada - Buscando dados da API Meteomatics...');

        // Chama a função que busca dados da API Meteomatics e atualiza as recomendações
        await trataDados.atualizarRecomendacoes();

        // Obtém os dados atualizados
        const recomendacoes = trataDados.obterRecomendacoes();
        const localizacao = trataDados.obterLocalizacaoAtual();
        const limites = trataDados.LIMITES;

        console.log('✅ Dados obtidos com sucesso!');

        res.json({
            sucesso: true,
            timestamp: new Date().toISOString(),
            dados: {
                qualidade_ar: recomendacoes,
                localizacao: localizacao,
                limites: limites,
                status: 'online'
            }
        });
    } catch (error) {
        console.error('❌ Erro ao buscar dados:', error.message);
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

/**
 * GET /api/qualidade-ar
 * Retorna as recomendações atuais de qualidade do ar
 */
router.get('/qualidade-ar', (req, res) => {
    try {
        const recomendacoes = trataDados.obterRecomendacoes();
        res.json({
            sucesso: true,
            dados: recomendacoes
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

/**
 * GET /api/qualidade-ar/localizacao
 * Retorna a localização atual configurada
 */
router.get('/qualidade-ar/localizacao', (req, res) => {
    try {
        const localizacao = trataDados.obterLocalizacaoAtual();
        res.json({
            sucesso: true,
            localizacao
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

/**
 * POST /api/qualidade-ar/localizacao
 * Define uma nova localização e atualiza os dados
 * Body: { "local": "São Paulo, SP" }
 */
router.post('/qualidade-ar/localizacao', async (req, res) => {
    try {
        const { local } = req.body;

        if (!local) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Parâmetro "local" é obrigatório'
            });
        }

        const novaLocalizacao = await trataDados.definirLocalizacao(local);

        res.json({
            sucesso: true,
            mensagem: 'Localização atualizada com sucesso',
            localizacao: novaLocalizacao
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

/**
 * GET /api/qualidade-ar/coordenadas?local=NomeDaCidade
 * Converte um nome de localização em coordenadas
 */
router.get('/qualidade-ar/coordenadas', async (req, res) => {
    try {
        const { local } = req.query;

        if (!local) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Parâmetro "local" é obrigatório'
            });
        }

        const coordenadas = await trataDados.obterCoordenadas(local);

        res.json({
            sucesso: true,
            coordenadas
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

/**
 * GET /api/qualidade-ar/limites
 * Retorna os limites de segurança configurados
 */
router.get('/qualidade-ar/limites', (req, res) => {
    res.json({
        sucesso: true,
        limites: trataDados.LIMITES
    });
});

/**
 * GET /api/health
 * Verifica se a API está funcionando
 */
router.get('/health', (req, res) => {
    res.json({
        sucesso: true,
        status: 'online',
        timestamp: new Date().toISOString()
    });
});

/**
 * GET /api/dados-nasa
 * Retorna dados da NASA (airdust + wildfire) usando localização atual
 */
router.get('/dados-nasa', async (req, res) => {
    try {
        const local = trataDados.obterLocalizacaoAtual();
        if (!local || !local.lat || !local.lon) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Localização não definida. Aguarde alguns segundos e tente novamente.'
            });
        }
        const dadosNASA = await trataDados.obterDadosNASA(parseFloat(local.lat), parseFloat(local.lon));
        res.json({
            sucesso: true,
            dados: dadosNASA
        });
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

/**
 * GET /api/localizacao-atual
 * Retorna a localização atual detectada pelo sistema
 */
router.get('/localizacao-atual', (req, res) => {
    try {
        const localizacao = trataDados.obterLocalizacaoAtual();
        if (!localizacao) {
            return res.status(400).json({
                sucesso: false,
                erro: 'Localização ainda não foi detectada. Aguarde alguns segundos.'
            });
        }
        res.json(localizacao);
    } catch (error) {
        res.status(500).json({
            sucesso: false,
            erro: error.message
        });
    }
});

module.exports = router;
