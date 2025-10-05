var createError = require('http-errors');
var express = require('express');
var climaRouter = require('./routes/clima');
var path = require('path');
const axios = require('axios');

var cookieParser = require('cookie-parser');
var logger = require('morgan');
var app = express();
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
const apiRouter = require('./routes/api');
const trataDados = require('./scripts/trataDadosClimaticos');
const arduino = require('./arduino/arduino');


// Configurações do Express DEVEM vir ANTES das rotas
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Inicializa o sistema de monitoramento
trataDados.inicializar();

// ROTAS - Devem vir DEPOIS das configurações
app.use('/api', apiRouter);
app.use('/clima', climaRouter);
app.use('/users', usersRouter);
app.use('/', indexRouter);

// Rota para status do Arduino
app.get('/arduino-status', (req, res) => {
    const dados = arduino.obterDados();
    res.json({
        conectado: dados !== null,
        ultima_leitura: dados
    });
});

app.get("/teste", (req, res) => {
    res.render('index');
})

// Rota para obter previsão de qualidade do ar
app.get('/previsao-ar', (req, res) => {
    res.json(trataDados.obterRecomendacoes());
});

// Rota para definir localização (POST ou GET com query param)
app.post('/localizar', async (req, res) => {
    try {
        const local = req.body.local;
        if (!local) {
            return res.status(400).json({ erro: 'Parâmetro "local" é obrigatório' });
        }

        const novaLocalizacao = await trataDados.definirLocalizacao(local);
        res.json({
            sucesso: true,
            mensagem: 'Localização atualizada com sucesso',
            localizacao: novaLocalizacao
        });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota alternativa GET para definir localização
app.get('/localizar', async (req, res) => {
    try {
        const local = req.query.local;
        if (!local) {
            return res.status(400).json({
                erro: 'Parâmetro "local" é obrigatório',
                exemplo: '/localizar?local=Sorocaba, SP'
            });
        }

        const novaLocalizacao = await trataDados.definirLocalizacao(local);
        res.json({
            sucesso: true,
            mensagem: 'Localização atualizada com sucesso',
            localizacao: novaLocalizacao
        });
    } catch (error) {
        res.status(400).json({ erro: error.message });
    }
});

// Rota para obter localização atual (DUPLICADA - já existe em /api/localizacao-atual)
app.get('/localizacao-atual', (req, res) => {
    res.json(trataDados.obterLocalizacaoAtual());
});


// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

module.exports = app;