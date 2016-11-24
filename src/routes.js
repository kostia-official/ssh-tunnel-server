var ssh = require('./ssh');

module.exports = function (app) {
  app.post('/', function (req, res) {
    if (req.body.close == 1) return closeTunnel(req, res);
    openTunnel(req, res);
  });
};

function closeTunnel(req, res) {
  ssh.close(req.body.host, req.body.tunport)
    .then(function () {
      res.send({ host: req.body.host, status: 'Connection closed' });
    })
    .catch(function (err) {
      res.status(400).send({ error: err.message });
    });
}

function openTunnel(req, res) {
  ssh.open({
    host: req.body.host,
    username: req.body.user,
    password: req.body.pass,
    tunport: req.body.tunport
  }).then(function () {
    res.send({ host: req.body.host, status: 'Connected' });
  }).catch(function (err) {
    res.status(400).send({ error: err.message });
  });
}