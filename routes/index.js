var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', function(req, res, next) {
  res.render('index', { title: 'Express' });
});

router.get('/nasa', function(req, res, next) {
  res.render('nasa', { title: 'Dados NASA - AtmosSentinel' });
});

module.exports = router;
