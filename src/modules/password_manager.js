const app = require('../../app');
const accountManager = require('./account_manager');
const socketManager = require('./socket_manager');
const serverManager = require('./server_manager');
const logManager = require('./log_manager');

exports.createPassword = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  const password = {
    id: req.body.id,
    name: req.body.name,
    platform: req.body.platform,
    url: req.body.url,
    username: req.body.username,
    email: req.body.email,
    description: req.body.description,
    password: req.body.password,
    histories: [],
    createdAt: req.body.createdAt,
    modifiedAt: req.body.modifiedAt
  };

  const accountId = await accountManager.getAccountIdBySessionId(req.cookies['user_session']);

  await app.database.get('accounts')
                    .find({id: accountId})
                    .get('passwords')
                    .push(password)
                    .write();

  res.status(201).json({});

  const passwords = await app.database.get('accounts')
                                      .find({id: accountId})
                                      .get('passwords')
                                      .value();

  socketManager.broadcast({
    type: 'updateAccount',
    id: accountId, 
    passwords: passwords.length
  });

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'addPassword',
    password: password
  });

  serverManager.countStats('passwords', true);
  serverManager.sendNewStats();

  logManager.log(req.cookies['user_session'], 'created a new password');
}

exports.createpasswords = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  const accountId = await accountManager.getAccountIdBySessionId(req.cookies['user_session']);

  for (const password of req.body.passwords) {
    await app.database.get('accounts')
      .find({id: accountId})
      .get('passwords')
      .push(password)
      .write();
  }

  res.status(201).json({});

  const passwords = await app.database.get('accounts')
                                      .find({id: accountId})
                                      .get('passwords')
                                      .value();

  socketManager.broadcast({
    type: 'updateAccount',
    id: accountId, 
    passwords: passwords.length
  });

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'reload'
  });

  serverManager.countStats('passwords', true, req.body.passwords.length);
  serverManager.sendNewStats();

  logManager.log(req.cookies['user_session'], `imported ${req.body.passwords.length} passwords`);
}

exports.generatePassword = async (options, symbols, plength) => {
  return new Promise((resolve) => {
    let string = '';

    if (options.letters) string += 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';
    if (options.numbers) string += '01234567890';
    if (options.symbols && symbols) {
      string += symbols;
    }
    
    if (!options.letters && !options.numbers && !options.symbols) {
      string += 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz01234567890';
    }

    let generatedPassword = '';

    for (let i = 0; i < plength; i++) {
      generatedPassword += string[Math.floor(Math.random() * string.length)];
    }
    return resolve(generatedPassword);
  });
}

exports.getPasswords = async (sessionId) => {
  return new Promise(resolve => {
    accountManager.getAccountIdBySessionId(sessionId).then(accountId => {
      const passwords = app.database.get('accounts')
                                    .find({id: accountId})
                                    .get('passwords')
                                    .value();

      !passwords || passwords.length === 0 ? resolve(null) : resolve(passwords);
    });
  });
}

exports.checkPassword = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  if (req.body.name.length < app.config.password.name.min || req.body.name.length > app.config.password.name.max) return res.status(200).json({available: false});

  const available = await app.database.get('accounts')
                                      .find({sessionId: req.cookies['user_session']})
                                      .get('passwords')
                                      .find({name: req.body.name})
                                      .value();

  if (!available) return res.status(200).json({available: true});

  res.status(200).json({available: false});
}

exports.deletePassword = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  const accountId = await accountManager.getAccountIdBySessionId(req.cookies['user_session']);

  this.addPasswordToTrash(accountId, req.body.deletedAt, await app.database.get('accounts')
                                                                            .find({id: accountId})
                                                                            .get('passwords')
                                                                            .find({id: req.body.passwordId})
                                                                            .value());

  await app.database.get('accounts')
                    .find({id: accountId})
                    .get('passwords')
                    .remove({id: req.body.passwordId})
                    .write();

  const path = `${app.path}/src/database/accounts/${accountId}/passwords/${req.body.passwordId}`;

  app.fs.remove(path).catch(err => console.error(err));
  
  res.status(200).json({});

  const passwords = await app.database.get('accounts')
                                      .find({id: accountId})
                                      .get('passwords')
                                      .value();

  socketManager.broadcast({
    type: 'updateAccount',
    id: accountId,
    passwords: passwords.length
  });

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'deletePassword',
    id: req.body.passwordId
  });
  
  serverManager.countStats('passwords', false);
  serverManager.sendNewStats();

  logManager.log(req.cookies['user_session'], 'deleted a password');
}

exports.updatePassword = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  const updatedPassword = {
    id: req.body.id,
    name: req.body.name === undefined ? undefined : req.body.name,
    platform: req.body.platform === undefined ? undefined : req.body.platform,
    url: req.body.url === undefined ? undefined : req.body.url,
    username: req.body.username === undefined ? undefined : req.body.username,
    email: req.body.email === undefined ? undefined : req.body.email,
    description: req.body.description === undefined ? undefined : req.body.description,
    password: req.body.password === undefined ? undefined : req.body.password,
    histories: req.body.histories === undefined ? undefined : req.body.histories,
    modifiedAt: req.body.modifiedAt === undefined ? undefined : req.body.modifiedAt
  };

  const accountId = await accountManager.getAccountIdBySessionId(req.cookies['user_session']);

  await app.database.get('accounts')
                    .find({id: accountId})
                    .get('passwords')
                    .find({id: req.body.id})
                    .assign(updatedPassword)
                    .write();

  res.status(200).json({message: `Password <b>${req.body.name}</b> was edited`});

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'updatePassword',
    password: updatedPassword
  });

  logManager.log(req.cookies['user_session'], 'updated a password');
}

exports.addPasswordToTrash = async (accountId, deletedAt, password) => {
  password.deletedAt = deletedAt;

  await app.database.get('accounts')
                    .find({id: accountId})
                    .get('passwordTrash')
                    .push(password)
                    .write();

  trashPw = {
    id: password.id,
    name: password.name,
    deletedAt: password.deletedAt
  }

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'addPasswordToTrash',
    password: trashPw
  });
}

exports.restorePasswordFromTrash = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  
  const accountId = await accountManager.getAccountIdBySessionId(req.cookies['user_session']);

  const password = await app.database.get('accounts')
                                    .find({id: accountId})
                                    .get('passwordTrash')
                                    .find({id: req.body.id})
                                    .value();

  await app.database.get('accounts')
                    .find({id: accountId})
                    .get('passwords')
                    .push(password)
                    .write();

  res.status(201).json({});

  const passwords = await app.database.get('accounts')
                                      .find({id: accountId})
                                      .get('passwords')
                                      .value();

  socketManager.broadcast({
    type: 'updateAccount',
    id: accountId, 
    passwords: passwords.length
  });

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'addPassword',
    password: password
  });

  serverManager.countStats('passwords', true);
  serverManager.sendNewStats();

  logManager.log(req.cookies['user_session'], 'restored a password');

  await app.database.get('accounts')
                    .find({id: accountId})
                    .get('passwordTrash')
                    .remove({id: req.body.id})
                    .write();

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'deletePasswordFromTrash',
    id: req.body.id
  });
}

exports.deletePasswordFromTrash = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  const accountId = await accountManager.getAccountIdBySessionId(req.cookies['user_session']);

  await app.database.get('accounts')
              .find({id: accountId})
              .get('passwordTrash')
              .remove({id: req.body.id})
              .write();

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'deletePasswordFromTrash',
    id: req.body.id
  });

  res.status(200).json({});
}