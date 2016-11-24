var extend = require('deep-extend');
var Client = require('ssh2').Client;
var Promise = require('bluebird');
var socks = require('socksv5');
var timeoutTime = 20000;

var tunnels = {};
var servers = {};

function open(opt) {
  return new Promise(function (resolve, reject) {
    if (tunnels[opt.host]) return resolve();

    var conn = new Client();

    conn.on('ready', function () {
      console.log('Connected to', opt.host);

      openShell(conn).then(function () {
        return createServer(opt.tunport, conn).then(function () {
          tunnels[opt.host] = conn;
          resolve();
        });
      }).catch(reject);
    }).on('error', function (err) {
      console.log(err);
      reject(err);
    }).connect(extend({
      readyTimeout: timeoutTime,
      algorithms: {
        kex: [
          'diffie-hellman-group1-sha1',
          'diffie-hellman-group14-sha1',
          'diffie-hellman-group-exchange-sha1',
          'diffie-hellman-group-exchange-sha256',
          'ecdh-sha2-nistp256',
          'ecdh-sha2-nistp384',
          'ecdh-sha2-nistp521',
          'diffie-hellman-group1-sha1'
        ],
        serverHostKey: [
          'ssh-rsa',
          'ssh-dss'
        ]
      }
    }, opt));
    setTimeout(function () {
      reject({ message: 'Connection timeout.' });
    }, timeoutTime);
  });
}

function openShell(conn) {
  return new Promise(function (resolve, reject) {
    conn.shell(function (err, stream) {
      if (err) return reject(err);
      stream.on('close', resolve)
        .on('data', function (data) {
          data = String(data);
          if (data.match(/login failed/)) return reject({ message: data });
          resolve();
        }).stderr.on('data', function (data) {
        console.log('STDERR: ' + data);
        reject(String(data));
      });
    });
  });
}

function createServer(tunport, conn) {
  return new Promise(function (resolve, reject) {
    if (servers[tunport]) return reject({ message: 'Tunnel port is busy with another host' });

    var server = socks.createServer(function (info, accept, deny) {
      conn.forwardOut(info.srcAddr,
        info.srcPort,
        info.dstAddr,
        info.dstPort,
        function (err, stream) {
          if (err) {
            console.log(err);
            return deny();
          }

          var clientSocket;
          if (clientSocket = accept(true)) {
            stream.pipe(clientSocket).pipe(stream).on('close', function () {
              conn.end();
            });
          } else {
            conn.end();
          }
          accept();
        });

    }).on('error', function (err) {
      console.log(err);
      reject(err);
    }).listen(tunport, '0.0.0.0', function () {
      servers[tunport] = server;
      console.log('SOCKSv5 proxy server started on port ' + tunport);
      resolve();
    }).useAuth(socks.auth.None());
  });
}

function close(host, tunport) {
  return new Promise(function (resolve, reject) {
    if (!tunnels[host] || !servers[tunport]) return resolve();

    tunnels[host].end();
    delete tunnels[host];

    servers[tunport].close();
    delete servers[tunport];

    resolve();
  });
}

module.exports = {
  open: open,
  close: close
};
