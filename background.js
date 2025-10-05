// background.js - Executa chamadas automáticas à API Meteomatics em background
const trataDados = require('./scripts/trataDadosClimaticos');

// Intervalo de atualização em milissegundos (padrão: 10 minutos = 600000ms)
const intervaloMs = process.env.INTERVALO_ATUALIZACAO || 240000;

// Função que será executada a cada intervalo
async function executarAtualizacao() {
    const agora = new Date().toLocaleString('pt-BR');
    console.log(`\n[${agora}] 🔄 Executando atualização automática...`);

    try {
        // Busca dados da API Meteomatics
        const recomendacoes = trataDados.obterRecomendacoes();
        const localizacao = trataDados.obterLocalizacaoAtual();

        console.log(`✅ Dados atualizados com sucesso!`);
        console.log(`📍 Localização: ${localizacao.nome}`);
        console.log(`⚠️  Nível de alerta: ${recomendacoes.nivel_alerta || 'Calculando...'}`);

        if (recomendacoes.valores_atuais) {
            console.log(`📊 PM2.5: ${recomendacoes.valores_atuais.PM25?.toFixed(2) || 'N/A'} µg/m³`);
            console.log(`📊 NO2: ${recomendacoes.valores_atuais.NO2?.toFixed(2) || 'N/A'} µg/m³`);
            console.log(`📊 O3: ${recomendacoes.valores_atuais.O3?.toFixed(2) || 'N/A'} µg/m³`);
        }

        console.log(`⏭️  Próxima atualização em ${intervaloMs / 1000} segundos`);

    } catch (error) {
        console.error(`❌ Erro ao atualizar dados:`, error.message);
    }
}

// Função que inicia o monitoramento em background
async function start() {
    console.log('='.repeat(60));
    console.log('🚀 SISTEMA DE MONITORAMENTO AUTOMÁTICO INICIADO');
    console.log('='.repeat(60));
    console.log(`⏱️  Intervalo de atualização: ${intervaloMs}ms`);
    console.log(`📅 Iniciado em: ${new Date().toLocaleString('pt-BR')}`);
    console.log('='.repeat(60));

    console.log('\n🔄 Executando primeira atualização...\n');

    // Inicializa o tratamento de dados
    await trataDados.inicializar(intervaloMs);

    // Executa a primeira vez imediatamente
    await executarAtualizacao();

    // Configura execução periódica
    setInterval(executarAtualizacao, intervaloMs);

    console.log('\n✅ Sistema configurado! Aguardando próxima atualização...\n');
}

// Se executado diretamente (não importado), inicia automaticamente
if (require.main === module) {
    start();

    // Captura erros não tratados
    process.on('unhandledRejection', (error) => {
        console.error('❌ Erro não tratado:', error);
    });

    process.on('SIGINT', () => {
        console.log('\n\n👋 Sistema encerrado pelo usuário');
        process.exit(0);
    });
}

// Exporta a função start para ser usada em outros arquivos
module.exports = { start };
