const spdy = require('spdy');
const express = require('express');
const compression = require('compression');
const bodyParser = require('body-parser');
const fs = require('fs-extra');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const crypto = require('crypto-js');
const nodemailer = require('nodemailer');
const zlib = require('zlib');
const {promisify} = require('util');
const {pipeline} = require('stream');
const useragent = require('express-useragent');
const uuid = require('uuid');
const WebSocket = require('ws');
const lowdb = require('lowdb');

const privateKey = fs.readFileSync('./src/sslcert/localhost.key', 'utf8');
const certificate = fs.readFileSync('./src/sslcert/localhost.crt', 'utf8');

const credentials = {key: privateKey, cert: certificate};
const app = express();

const FileAsync = require('lowdb/adapters/FileAsync');
const adapter = new FileAsync('./src/database/database.json');

const config = require('./config');

function initDatabase() {
  return new Promise((resolve) => {
    lowdb(adapter).then((database) => {
      module.exports.database = database;
    
      // Set database default values
      database.defaults({
        server: {
          stats: {
            accounts: 0, 
            passwords: 0 
          },
        },
        accounts: []
      }).write();
      
      resolve(database);
    });
  });
}

app.use(express.static(`${__dirname}/src/public`));
app.use(compression());
app.use(bodyParser.urlencoded({extended: true}));
app.use(bodyParser.json({limit: '50mb'}));
app.use((req, res, next) => {
  res.header('x-powered-by', 'PasswordManager');
  next();
});
app.use(cookieParser());
app.use(useragent.express());

module.exports = {
  lowdb,
  fs,
  promisify,
  getFullTime,
  getTime,
  getDate,
  bcrypt,
  crypto,
  config,
  path: __dirname,
  nodemailer,
  doGzip,
  zlib,
  WebSocket,
  uuid
};

require('./src/routes.js')(app);

const server = spdy.createServer(credentials, app).listen(config.port, config.hostname, async () => {
  console.log(`[Server] Listening on ${config.hostname}:${config.port}`);

  initDatabase()
    .then(async (database) => {
      const accountsCount = await database.get('accounts').size().value();

      if (accountsCount === 0) {
        await createDefaultDirectories();

        const accountManager = require('./src/modules/account_manager');
        accountManager.createDefaultAccount('RuisPipe', 'ruispipe@roese.dev', 'ruispipe', 2);
        accountManager.createDefaultAccount('Gast', 'gast@roese.dev', 'gast1234', 1);
      }

      require('./src/modules/email_manager').connect();
      require('./src/modules/server_manager').loadTemplates();
      
      const logManager = require('./src/modules/log_manager');
      logManager.start();
      logManager.log('server', 'Started server...');
    });
});

function createDefaultDirectories() {
  return new Promise((resolve) => {
    const paths = [
      `${__dirname}/src/database`,
      `${__dirname}/src/database/accounts`,
      `${__dirname}/src/database/logs`
    ];
  
    for (let path of paths) {
      fs.access(path, fs.constants.F_OK, (err) => {
        if (err) fs.mkdir(path, {recursive: true});
      })
    }

    resolve();
  });
}

require('./src/modules/socket_manager').create(server);

function getFullTime(timestamp) {
  return new Promise((resolve) => {
    const date = timestamp !== undefined ? new Date(timestamp) : new Date();

    const day = ('0' + date.getDate()).slice(-2);
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const year = date.getFullYear();
    const hours = ('0' + date.getHours()).slice(-2);
    const minutes = ('0' + date.getMinutes()).slice(-2);
    const seconds = ('0' + date.getSeconds()).slice(-2);
    
    resolve(`${day}/${month}/${year} ${hours}:${minutes}:${seconds}`);
  });
}

function getDate(symbol) {
  return new Promise((resolve) => {
    const today = new Date();

    const day = ('0' + today.getDate()).slice(-2);
    const month = ('0' + (today.getMonth() + 1)).slice(-2);
    const year = today.getFullYear();
    
    resolve(`${day}${symbol}${month}${symbol}${year}`);
  });
}

function getTime() {
  return new Promise((resolve) => {
    const today = new Date();

    const hours = ('0' + today.getHours()).slice(-2);
    const minutes = ('0' + today.getMinutes()).slice(-2);
    const seconds = ('0' + today.getSeconds()).slice(-2);
    
    resolve(`${hours}:${minutes}:${seconds}`);
  });
}

const pipe = promisify(pipeline);

async function doGzip(input, output) {
  const gzip = zlib.createGzip();
  const source = fs.createReadStream(input);
  const destination = fs.createWriteStream(output);
  await pipe(source, gzip, destination);
}