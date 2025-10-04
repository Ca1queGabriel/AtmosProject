console.log("Peixe");
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var app = express();
var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
/*app.get('/', (req, res) => {
    console.log('Welcome')
    res.download("public/images/bambiemo.jpg");
   res.status(404).json({status: 'erro'}); //status do request se tirar o status, ele associa como um 200

}); */
// view engine setup
//template de uma requisição
app.get('/', (req, res) => {
    res.json({isActive: true})
});

app.set('views', path.join(__dirname, 'views'));

app.set('view engine', 'pug');
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());


app.use(express.static(path.join(__dirname, 'public')));
app.use('/users', usersRouter);
app.use('/', indexRouter);

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
