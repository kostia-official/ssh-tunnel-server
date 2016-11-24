var app = require('./app');
var port = 7000;

app.listen(port, function () {
  console.log('Server was started on http://0.0.0.0:' + port);
});
