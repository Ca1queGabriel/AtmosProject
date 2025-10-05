//parte dedicada à conexão com o arduino

const { SerialPort } = require('serialport');
const { ReadlineParser } = require('@serialport/parser-readline');

let porta = null;
let parser = null;
let ultimaLeitura = null;

function conectar() {
    try {
        porta = new SerialPort({
            path: process.env.ARDUINO_PORT || 'COM3',
            baudRate: 9600
        });

        parser = porta.pipe(new ReadlineParser({ delimiter: '\n' }));

        porta.on('open', () => {
            console.log(`✅ Arduino conectado na porta ${process.env.ARDUINO_PORT || 'COM3'}`);
        });

        parser.on('data', (linha) => {
            try {
                const dados = JSON.parse(linha);
                ultimaLeitura = {
                    ...dados,
                    timestamp: new Date().toISOString()
                };
                console.log('📊 Dados recebidos:', ultimaLeitura);
            } catch (erro) {
                console.error('Erro ao parsear dados:', linha);
            }
        });

        porta.on('error', (erro) => {
            console.error('❌ Erro na porta serial:', erro.message);
        });

    } catch (erro) {
        console.error('❌ Falha ao conectar Arduino:', erro.message);
    }
}

function obterDados() {
    return ultimaLeitura;
}

function enviarRecomendacoes(recomendacoes) {
    if (!porta || !porta.isOpen) {
        console.warn('⚠️  Arduino não conectado. Não é possível enviar dados.');
        return false;
    }

    try {
        // Extrai apenas os 5 dados necessários
        const dados = {
            fechar_janelas: recomendacoes.fechar_janelas || false,
            ativar_purificador: recomendacoes.ativar_purificador || false,
            usar_mascaras: recomendacoes.usar_mascaras || false,
            se_hidratar_controlar_humidade: recomendacoes['se_hidratar/Controlar_humidade'] || false,
            tempo_categoria: recomendacoes.tempo_categoria || 0
        };

        // Converte para JSON e envia via serial
        const json = JSON.stringify(dados);
        porta.write(json + '\n', (err) => {
            if (err) {
                console.error('❌ Erro ao enviar dados:', err.message);
            } else {
                console.log('📤 Recomendações enviadas:', dados);
            }
        });

        return true;
    } catch (erro) {
        console.error('❌ Erro ao processar envio:', erro.message);
        return false;
    }
}

function desconectar() {
    if (porta && porta.isOpen) {
        porta.close();
        console.log('Arduino desconectado');
    }
}

module.exports = {
    conectar,
    obterDados,
    enviarRecomendacoes,
    desconectar
};
