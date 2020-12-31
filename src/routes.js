const {config} = require('../app');
const accountManager = require('./modules/account_manager');
const passwordManager = require('./modules/password_manager');
const serverManager = require('./modules/server_manager');
const logManager = require('./modules/log_manager');

module.exports = (app) => {
  app.get('/', async (req, res) => {
    if (!req.cookies['user_session']) {
      res.redirect(config.redirectPath);
      return
    }

    const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

    if (!sessionIdValid) {
      accountManager.handleInvalidSession(res);
      res.redirect(config.redirectPath);

      logManager.log('unkown', `GET <strong>/</strong> [Browser: <strong>${req.useragent.browser}</strong>, Platform: <strong>${req.useragent.platform}</strong>]`);
      return;
    }

    logManager.log(req.cookies['user_session'], `GET <strong>/</strong> [Browser: <strong>${req.useragent.browser}</strong>, Platform: <strong>${req.useragent.platform}</strong>]`);

    const account = await accountManager.getAccountBySessionId(req.cookies['user_session']);

    res.cookie('username', account.username, {maxAge: config.cookieMaxAge, secure: true});
    res.cookie('permissions_level', account.permissionsLevel, {maxAge: config.cookieMaxAge, httpOnly: false, secure: true});

    res.sendFile(`${__dirname}/public/pages/index.html`);

    accountManager.updateSession(req);
  });

  app.get('/login', async (req, res) => {
    res.sendFile(__dirname + '/public/pages/login/index.html');

    logManager.log('unkown', `GET <strong>/login</strong> [Browser: <strong>${req.useragent.browser}</strong>, Platform: <strong>${req.useragent.platform}</strong>]`);
  });

  app.post('/login', async (req, res) => {
    accountManager.handleLogin(req, res);

    logManager.log('unkown', `POST <strong>/login</strong> [${req.body.email ? `email: <strong>${req.body.email}</strong>,` : `username: <strong>${req.body.username}</strong>,`} Browser: <strong>${req.useragent.browser}</strong>, Platform: <strong>${req.useragent.platform}</strong>]`);
  });

  app.get('/login/data', async (req, res) => {
    res.status(200).json({username: {min: config.account.username.min, max: config.account.username.max}, 
      email: {min: config.account.email.min, max: config.account.email.max}, 
      password: {min: config.account.password.min, max: config.account.password.max}});
  });

  app.post('/logout', async (req, res) => {
    accountManager.logOut(req, res);
  });

  app.post('/password/create', async (req, res) => {
    if (req.body.type === 0) {
      passwordManager.createPassword(req, res);
    } else if (req.body.type === 1) {
      passwordManager.createpasswords(req, res);
    } else {
      res.end();
    }
  });

  app.post('/passwords', async (req, res) => {
    passwordManager.getPasswords(req, res);
  });

  app.post('/password/check', async (req, res) => {
    passwordManager.checkPassword(req, res);
  });

  app.post('/password/delete', async (req, res) => {
    passwordManager.deletePassword(req, res);
  });

  app.post('/password/update', async (req, res) => {
    passwordManager.updatePassword(req, res);
  });

  app.get('/accounts', async (req, res) => {
    accountManager.sendAccounts(req, res);
  });

  app.get('/account/data', async (req, res) => {
    accountManager.sendData(req, res);
  });

  app.post('/account/update', async (req, res) => {
    if (req.body.type === 'my') {
      accountManager.updateMyAccount(req, res);
    } else {
      accountManager.updateAccount(req, res);
    }
  });

  app.post('/account/check', async (req, res) => {
    accountManager.checkAccount(req, res);
  });

  app.post('/account/create', async (req, res) => {
    accountManager.createAccount(req, res);
  });

  app.post('/account/delete', async (req, res) => {
    accountManager.deleteAccount(req, res);
  });

  app.post('/server/log', async (req, res) => {
    if (req.body.type === 'dates') {
      logManager.getLogDates(req, res);
    } else {
      logManager.getLog(req, res);
    }
  });

  app.post('/server/edit', async (req, res) => {
    serverManager.edit(req, res);
  });

  app.get('/server/template', async (req, res) => {
    if (req.query.type === 'export') {
      res.json({content: await serverManager.getTemplate('password', 'export')});
    }
  });

  app.post('/session/revoke', async (req, res) => {
    accountManager.revokeSession(req, res);
  });

  app.get('*', async (req, res) => {
    res.status(404).sendFile(`${__dirname}/public/pages/error.html`);

    logManager.log('unkown', `GET <strong>${req.url}</strong> [Browser: <strong>${req.useragent.browser}</strong>, Platform: <strong>${req.useragent.platform}</strong>]`);
  });

  app.post('*', async (req, res) => {
    res.sendStatus(404);
    logManager.log('unkown', `POST <strong>${req.url}</strong> [Browser: <strong>${req.useragent.browser}</strong>, Platform: <strong>${req.useragent.platform}</strong>]`);
  });
};