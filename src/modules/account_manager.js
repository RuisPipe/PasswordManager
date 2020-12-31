const app = require('../../app');
const passwordManager = require('./password_manager');
const emailManager = require('./email_manager');
const socketManager = require('./socket_manager');
const serverManager = require('./server_manager');
const logManager = require('./log_manager');
const Cache = require('./cache_manager');

exports.createAccount = async (req, res) => {
  const sessionIdValid = await this.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    this.handleInvalidSession(res, true);
    return; 
  }

  let hashedPassword = undefined;
  let generatedPassword = undefined;

  if (req.body.password) {
    hashedPassword = await app.bcrypt.hash(req.body.password, 10);
  } else {
    generatedPassword = await passwordManager.generatePassword({letters: true, numbers: true, symbols: false}, null, 16); 
    hashedPassword = await app.bcrypt.hash(generatedPassword, 10);
  }
  
  const accountId = await this.generateUniqueAccountId();
 
  const account = {
    id: accountId,
    username: req.body.username,
    email: req.body.email,
    password: hashedPassword,
    permissionsLevel: parseInt(req.body.permissionsLevel),
    sessions: [],
    passwords: [],
    symbols: app.config.symbols.default,
    passwordLimit: parseInt(req.body.passwordLimit),
    createdAt: Date.now()
  };

  await app.database.get('accounts').push(account).write();
  await this.createAccountDirectories(accountId);

  res.status(200).json({success: true});

  socketManager.broadcast({
    type: 'addAccount',
    id: accountId,
    username: req.body.username,
    email: req.body.email,
    permissionsLevel: parseInt(req.body.permissionsLevel),
    passwordLimit: account.passwordLimit,
    passwords: 0,
    createdAt: account.createdAt,
    dates: await logManager.getAccountDates(accountId)
  });

  serverManager.countStats('accounts', true);
  serverManager.sendNewStats();

  logManager.log(req.cookies['user_session'], `created account <strong>${req.body.username} #${accountId}</strong> [email: <strong>${req.body.email}</strong>, rank: <strong>${await this.getRankName(req.body.permissionsLevel)}</strong>, passwordLimit: <strong>${req.body.passwordLimit}</strong>]`);
  
  if (req.body.sendEmail) {
    const design = await serverManager.getTemplate('email', 'accountCreated');
    emailManager.sendEmail(req.body.email, 'Your login credentials', design.replace(/%username%/g, req.body.username)
      .replace('%email%', req.body.email)
      .replace('%password%', req.body.password === undefined ? generatedPassword : req.body.password)
      .replace('%informationsDomain%', app.config.informations.domain));
  }
}

exports.createMasterAccount = async () => {
  const rl = app.readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  console.log('\nCreate the main account of your password manager \n');

  const account = {min: app.config.account.username.min, max: app.config.account.username.max};
  const email = {min: app.config.account.email.min, max: app.config.account.email.max};
  const password = {min: app.config.password.password.min, max: app.config.password.password.max};

  const steps = {
    start: async () => {
      const username = await steps.questionUsername();
      const email = await steps.questionEmail();
      const password = await steps.questionPassword();

      steps.end(username, email, password);
    },
    questionUsername: () => {
      return new Promise((resolve) => {
        rl.question(`Choose your username between ${account.min} and ${account.max} characters\nUsername: `, (answer) => {
          if (answer.length < account.min) {
            console.log('\nError: Username is too short\n');
            return steps.start();
          } else if (answer.length > account.max) {
            console.log('\nError: Username is too long\n');
            return steps.start();
          } else {
            resolve(answer);
          }
        });
      });
    },
    questionEmail: () => {
      return new Promise((resolve) => {
        rl.question(`\nChoose your email between ${email.min} and ${email.max} characters\nEmail: `, (answer) => {
          if (answer.length < email.min) {
            console.log('\nError: Email is too short\n');
            return steps.start();
          } else if (answer.length > email.max) {
            console.log('\nError: Email is too long\n');
            return steps.start();
          } else {
            resolve(answer);
          }
        });
      });
    },
    questionPassword: () => {
      return new Promise((resolve) => {
        rl.question(`\nChoose your password between ${password.min} and ${password.max} characters\nPassword: `, (answer) => {
          if (answer.length < password.min) {
            console.log('\nError: Password is too short\n');
            return steps.start();
          } else if (answer.length > password.max) {
            console.log('\nError: Password is too long\n');
            return steps.start();
          } else {
            resolve(answer);
          }
        });
      });
    },
    end: async (username, email, password) => {
      console.log(' ');
      this.createDefaultAccount(username, email, password, 2);
      rl.close();
    }
  }
  
  steps.start();
}

exports.createDefaultAccount = async (username, email, password, permissionsLevel) => {
  let hashedPassword;

  if (password) {
    hashedPassword = await app.bcrypt.hash(password, 10);
  } else {
    password = await passwordManager.generatePassword({letters: true, numbers: true, symbols: false}, null, 16); 
    hashedPassword = await app.bcrypt.hash(password, 10);
  }
  
  const accountId = await this.generateUniqueAccountId();

  const account = {
    id: accountId,
    username: username,
    email: email,
    password: hashedPassword,
    permissionsLevel: permissionsLevel,
    sessions: [],
    passwords: [],
    symbols: app.config.symbols.default,
    passwordLimit: app.config.account.password.limit,
    createdAt: Date.now(),
  };

  await app.database.get('accounts').push(account).write();

  serverManager.countStats('accounts', true);

  await this.createAccountDirectories(accountId);

  console.log('Default account created');
  console.log(' ');
  console.log('Username:', username);
  console.log('Email:', email);
  console.log('Password:', password);
  console.log(' ');
  console.log(`Open your browser and go to https://${app.config.hostname}:${app.config.port}${app.config.redirectPath}`);
}

exports.createAccountDirectories = async (accountId) => {
  return new Promise((resolve) => {
    const path = `${app.path}/src/database/accounts/${accountId}/logs/`;

    app.fs.mkdir(path, {recursive: true}).catch(err => console.error(err));
  
    resolve();
  });
}

exports.handleInvalidSession = async (res, location) => {
  res.clearCookie('user_session');
  res.clearCookie('username');
  res.clearCookie('user_content');
  res.clearCookie('user_content_serversettings');
  res.clearCookie('permissions_level');

  if (location) {
    res.status(200).json({logout: app.config.redirectPath});
  }
}

const cache = new Cache(1);

exports.handleLogin = async (req, res) => {
  let credentialsCorrect;

  const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;

  if (cache.get(ip)) {
    res.status(429).json({});
    return;
  }

  cache.set(ip, ' ');

  if (req.body.email) {
    credentialsCorrect = await this.checkAccountCredentials({email: req.body.email, password: req.body.password});
  } else {
    credentialsCorrect = await this.checkAccountCredentials({username: req.body.username, password: req.body.password});
  }

  if (!credentialsCorrect) {
    res.status(200).json({success: false});
    return;
  }

  let account = req.body.email ? await this.getAccountByEmail(req.body.email) : await this.getAccountByUsername(req.body.username);
  const timestamp = Date.now();

  for (const session of account.sessions) {
    if (session.expiresOn < (timestamp - app.config.cookieMaxAge)) {
      const index = account.sessions.indexOf(session);

      if (index > -1) {
        account.sessions.splice(index, 1);
      }
    }
  }

  const newSession = {
    id: await this.generateUniqueSessionId(),
    browser: req.useragent.browser,
    platform: req.useragent.platform,
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    lastAccessed: timestamp,
    expiresOn: timestamp + app.config.cookieMaxAge
  };

  account.sessions.push(newSession);

  await app.database.get('accounts')
                    .find({id: account.id})
                    .assign({sessions: account.sessions, lastLogin: timestamp})
                    .write();

  res.cookie('user_session', newSession.id, {maxAge: app.config.cookieMaxAge, httpOnly: false, secure: true});
  res.status(200).json({success: true, location: '/'});

  socketManager.broadcast({
    type: 'updateAccount',
    id: account.id,
    lastLogin: timestamp
  });

  if (account.permissionsLevel === 0) {
    socketManager.sendClientMessageByAccountId(account.id, {
      type: 'updateUser',
      lastLogin: timestamp
    });
  }
 
  logManager.log(newSession.id, 'logged in...');

  const design = await serverManager.getTemplate('email', 'newAccountLogin');

  emailManager.sendEmail(account.email, `New login to ${app.config.informations.name} from ${req.useragent.browser} on ${req.useragent.platform}`, 
    design.replace('%username%', account.username)
          .replace('%browser%', req.useragent.browser)
          .replace('%platform%', req.useragent.platform)
          .replace('%date%', await app.getFullTime(timestamp))
          .replace('%ip%', req.headers['x-forwarded-for'] || req.connection.remoteAddress));
}

exports.updateSession = async (req) => {
  const account = await this.getAccountBySessionId(req.cookies['user_session']);

  const updatedSession = {
    browser: req.useragent.browser,
    platform: req.useragent.platform,
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress,
    lastAccessed: Date.now()
  };

  app.database.get('accounts')
              .find({id: account.id})
              .get('sessions')
              .find({id: req.cookies['user_session']})
              .assign(updatedSession)
              .write();

  updatedSession.id = req.cookies['user_session'].split('-')[0];

  for (const session of account.sessions) {
    if (!session.id.startsWith(updatedSession.id)) {
      socketManager.sendClientMessage(session.id, {
        type: 'updateSession',
        session: updatedSession
      });
    }
  }
}

exports.revokeSession = async (req, res) => {
  const sessionIdValid = await this.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    this.handleInvalidSession(res, true);
    return;
  }

  const account = await this.getAccountBySessionId(req.cookies['user_session']);
  const userSessionId = account.sessions.find(session => session.id.startsWith(req.body.id));

  socketManager.sendClientMessage(userSessionId.id, {
    type: 'logout',
    location: app.config.redirectPath
  });

  app.database.get('accounts')
              .find({id: account.id})
              .get('sessions')
              .remove({id: userSessionId.id})
              .write();

  socketManager.sendClientMessageByAccountId(account.id, {
    type: 'removeSession',
    id: req.body.id
  });

  res.json({});
}

exports.logOut = async (req, res) => {
  if (!req.cookies['user_session']) return;

  const accountId = await this.getAccountIdBySessionId(req.cookies['user_session']);                                    

  if (!accountId) return;

  await logManager.log(req.cookies['user_session'], 'logged out...');

  app.database.get('accounts')
              .find({id: accountId})
              .get('sessions')
              .remove({id: req.cookies['user_session']})
              .write();

  this.handleInvalidSession(res, true);

  socketManager.sendClientMessageByAccountId(accountId, {
    type: 'removeSession',
    id: req.cookies['user_session'].split('-')[0]
  });
}

exports.checkAccountCredentials = async (credentials) => {
  return new Promise ((resolve) => {
    if (credentials.email) {
      const account = app.database.get('accounts')
                                  .find({email: credentials.email})
                                  .value();

      !account ? resolve(false): app.bcrypt.compare(credentials.password, account.password)
        .then(result => result === true ? resolve(true) : resolve(false))
        .catch(error => console.error(error));
    } else {
      const account = app.database.get('accounts')
                                  .find({username: credentials.username})
                                  .value();

      !account ? resolve(false) : app.bcrypt.compare(credentials.password, account.password)
        .then(result => result === true ? resolve(true) : resolve(false))
        .catch(error => console.error(error));
    }
 });
}

exports.getAccountIdByUsername = async (username) => {
  return new Promise((resolve) => {
    const account = app.database.get('accounts').find({username: username}).value();

    account ? resolve(account.id) : resolve(null);
  });
}

exports.getAccountIdByEmail = async (email) => {
  return new Promise((resolve) => {
    const account = app.database.get('accounts').find({email: email}).value();

    account ? resolve(account.id) : resolve(null);
  });
}

exports.generateUniqueSessionId = async () => {
  return new Promise ((resolve) => {
    resolve(app.uuid.v4());
 });
}

exports.generateUniqueAccountId = async () => {
  return new Promise ((resolve) => {
    const string = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789';
    let unique = false;
    let n = 16;

    while (!unique) {
      let generatedUniqueAccountId = '';

      for (let i = 0; i < n; i++) {
        generatedUniqueAccountId += string[Math.floor(Math.random() * string.length)];
     }
  
      const uniqueAccountId = app.database.get('accounts')
                                          .find({id: generatedUniqueAccountId})
                                          .value();

      if (!uniqueAccountId) {
        unique = true;
        resolve(generatedUniqueAccountId);
      } else {
        n++;
      }
    }
 });
}

exports.getUsernameBySessionId = async (sessionId) => {
  return new Promise ((resolve) => {
    this.getAccountBySessionId(sessionId)
      .then(account => account ? resolve(account.username) : resolve(null));
 });
}

exports.getEmailBySessionId = async (sessionId) => {
  return new Promise ((resolve) => {
    this.getAccountBySessionId(sessionId)
      .then(account => account ? resolve(account.email) : resolve(null));
 });
}

exports.getUsernameByAccountId = async (accountId) => {
  return new Promise ((resolve) => {
    const account = app.database.get('accounts')
                                .find({id: accountId})
                                .value();

    account ? resolve(account.username) : resolve(null);
 });
}

exports.getAccountBySessionId = async (sessionId) => {
  return new Promise(resolve => {
    const accounts = app.database.get('accounts').value();
    const result = accounts.find(account => account.sessions.find(session => session.id === sessionId));
    
    result ? resolve(result) : resolve(null);
  });
}

exports.getAccountByEmail = async (email) => {
  return new Promise(resolve => {
    const accounts = app.database.get('accounts').value();
    const result = accounts.find(account => account.email === email);
    
    result ? resolve(result) : resolve(null);
  });
}

exports.getAccountByUsername = async (username) => {
  return new Promise(resolve => {
    const accounts = app.database.get('accounts').value();
    const result = accounts.find(account => account.username === username);
    
    result ? resolve(result) : resolve(null);
  });
}

exports.getSessionsByAccountId = async (accountId) => {
  return new Promise(resolve => {
    const sessions = app.database.get('accounts').find({id: accountId}).get('sessions').value();

    sessions === undefined ? resolve(null) : resolve(sessions);
  });
}

exports.getAccounts = async () => {
  return new Promise(async resolve => {
    const accountsFromDatabase = await app.database.get('accounts').value();

    if (!accountsFromDatabase) {
      resolve([]);
      return;
    }

    const accounts = [];

    for await (let account of accountsFromDatabase) {
      const dates = await logManager.getAccountDates(account.id);

      const data = {
        id: account.id,
        username: account.username,
        email: account.email,
        permissionsLevel: account.permissionsLevel,
        lastLogin: account.lastLogin,
        createdAt: account.createdAt,
        modifiedAt: account.modifiedAt,
        passwords: account.passwords.length,
        passwordLimit: account.passwordLimit,
        dates: dates
      };

      accounts.push(data);
    }

    accounts.sort((a, b) => {
      return a.permissionsLevel > b.permissionsLevel ? -1 : a.permissionsLevel < b.permissionsLevel ? 1 : 0; 
    });

    resolve(accounts);
  });
}

exports.sendAccounts = async (req, res) => {
  const sessionIdValid = await this.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    this.handleInvalidSession(res, true);
    return; 
  }

  res.status(200).json({accounts: await this.getAccounts()});

  logManager.log(req.cookies['user_session'], 'loaded accounts');
}

exports.getAccountsIds = async () => {
  return new Promise((resolve) => {
    const accounts = app.database.get('accounts').value();
    const ids = [];

    for (let account of accounts) {
      ids.push(account.id);
    }

    resolve(ids);
  });
}

exports.checkAccount = async (req, res) => {
  const sessionIdValid = await this.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    this.handleInvalidSession(res, true);
    return;
  }

  if (req.body.username) {
    if (req.body.username.length < app.config.account.username.min || req.body.username.length > app.config.account.username.max) return res.status(200).json({available: false});

    const available = await app.database.get('accounts')
                                        .find({username: req.body.username})
                                        .value();
  
    if (!available) {
      res.status(200).json({available: true});
      return;
    }
  
    res.status(200).json({available: false});
    return;
  }
  
  if (req.body.email) {
    if (req.body.email.length < app.config.account.email.min || req.body.email.length > app.config.account.email.max) return res.status(200).json({available: false});

    const available = await app.database.get('accounts')
                                        .find({email: req.body.email})
                                        .value();
  
    if (!available) {
      res.status(200).json({available: true});
      return;
    }
  
    res.status(200).json({available: false});
    return;
 }
  res.sendStatus(400);
}

exports.sessionIdValid = (sessionId) => {
  return new Promise ((resolve) => {
    const accounts = app.database.get('accounts').value();
    const result = accounts.find(account => account.sessions.find(session => session.id === sessionId));

    result ? resolve(true) : resolve(false);
 });
}

exports.getAccountIdBySessionId = (sessionId) => {
  return new Promise ((resolve) => {
    const accounts = app.database.get('accounts').value();
    const result = accounts.find(account => account.sessions.find(session => session.id === sessionId));

    result ? resolve(result.id) : resolve(null);
 });
}

exports.isAccountAdmin = (accountId) => {
  return new Promise ((resolve) => {
    const account = app.database.get('accounts').find({id: accountId}).value();

    !account ? resolve(false) : account.permissionsLevel > 0 ? resolve(true) : resolve(false);
 });
}

exports.getAccountPermissionsLevel = (accountId) => {
  return new Promise((resolve) => {
    const account = app.database.get('accounts').find({id: accountId}).value();

    if (!account) return resolve(0);
    resolve(account.permissionsLevel);
 });
}

exports.updateMyAccount = async (req, res) => {
  const sessionIdValid = await this.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    this.handleInvalidSession(res, true);
    return;
  }

  const newData = {};

  if (req.body.username) newData.username = req.body.username;
  if (req.body.email) newData.email = req.body.email;
  if (req.body.symbols) newData.symbols = req.body.symbols;
  if (req.body.newpassword) {
    newData.password = await app.bcrypt.hash(req.body.newpassword, 10)
    newData.sessions = [];
    newData.passwords = req.body.passwords;
    
    socketManager.sendClientMessageByAccountId(req.body.id, {
      type: 'logout',
      location: app.config.redirectPath
    });
  }
  newData.modifiedAt = Date.now();

  socketManager.sendClientMessageByAccountId(req.body.id, {
    type: 'updateUser',
    username: newData.username,
    email: newData.email,
    symbols: newData.symbols,
    modifiedAt: newData.modifiedAt
  });

  if (req.body.sendEmail) {
      const design = await serverManager.getTemplate('email', 'passwordChanged');

      emailManager.sendEmail(!newData.email
        ? await this.getEmailBySessionId(req.cookies['user_session']) 
        : newData.email, 'Password changed', 
          design.replace('%newPassword%', req.body.newpassword).replace('%informationsDomain%', app.config.informations.domain));
  }

  const updated = [];

  if (req.body.username) updated.push(`username: <strong>${req.body.username}</strong>`);
  if (req.body.email) updated.push(`email: <strong>${req.body.email}</strong>`);
  if (req.body.symbols) updated.push(`symbols`);
  if (req.body.newpassword) updated.push(`new password`);

  await logManager.log(req.cookies['user_session'], `updated his account #${req.body.id} [${updated.join(', ')}]`);

  await app.database.get('accounts')
                    .find({id: req.body.id})
                    .assign(newData)
                    .write();

  res.status(200).json({success: true});
};

exports.updateAccount = async (req, res) => {
  const sessionIdValid = await this.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    this.handleInvalidSession(res, true);
    return;
  }

  const senderAccount = await this.getAccountBySessionId(req.cookies['user_session']);

  if (senderAccount.permissionsLevel === 0 || senderAccount.permissionsLevel !== 2 && req.body.accountPermissionsLevel == 2) {
    res.status(400).json({message: app.config.messages.noPermissions});
    return;
  }

  const timestamp = Date.now();

  const newData = {modifiedAt: timestamp};
  const updated = [];

  const account = app.database.get('accounts')
                              .find({id: req.body.accountId})
                              .value();

  if (req.body.accountUsername) {
    newData.username = req.body.accountUsername;
    updated.push(`username: <strong>${req.body.accountUsername}</strong>`);
  }
  if (req.body.accountEmail) {
    newData.email = req.body.accountEmail;
    updated.push(`email: <strong>${req.body.accountEmail}</strong>`);
  }
  if (req.body.accountPermissionsLevel) {
    newData.permissionsLevel = parseInt(req.body.accountPermissionsLevel);
    updated.push(`passwordLimit: <strong>${req.body.accountpasswordLimit}</strong>`);
  }
  if (req.body.accountpasswordLimit) {
    newData.passwordLimit = parseInt(req.body.accountpasswordLimit);
    updated.push(`rank: <strong>${await this.getRankName(req.body.accountPermissionsLevel)}</strong>`);

    const stats = await serverManager.getStats();

    socketManager.sendClientMessageByAccountId(account.id, {
      type: 'updateServer',
      accounts: stats.accounts,
      passwords: stats.passwords
    });
  }

  await socketManager.broadcast({
    type: 'updateAccount',
    id: req.body.accountId,
    username: req.body.accountUsername,
    email: req.body.accountEmail,
    passwordLimit: req.body.accountpasswordLimit,
    permissionsLevel: req.body.accountPermissionsLevel,
    modifiedAt: timestamp
  });

  logManager.log(req.cookies['user_session'], `updated account <strong>${account.username} #${req.body.accountId}</strong> [${updated.join(', ')}]`);

  await app.database.get('accounts')
                    .find({id: req.body.accountId})
                    .assign(newData)
                    .write();

  res.status(200).json({success: true});

  if (req.body.sendEmail && senderAccount.id !== req.body.accountId) {
    const design = await serverManager.getTemplate('email', 'accountChangedByAdmin');

    emailManager.sendEmail(req.body.accountEmail === undefined ? account.email : req.body.accountEmail, 'Account updated', design.replace('%updatedByUsername%', senderAccount.username)
      .replace('%username%', req.body.accountUsername !== undefined ? req.body.accountUsername : account.username)
      .replace('%email%', req.body.accountEmail !== undefined ? req.body.accountEmail : account.email)
      .replace('%passwordLimit%', req.body.accountpasswordLimit !== undefined ? req.body.passwordLimit : account.passwordLimit)
      .replace('%rank%', req.body.accountPermissionsLevel !== undefined ? await this.getRankName(req.body.accountPermissionsLevel) : await this.getRankName(account.permissionsLevel))
      .replace('%date%', await app.getFullTime(timestamp)));
  }

  socketManager.sendClientMessageByAccountId(req.body.accountId, {
    type: 'updateUser',
    username: req.body.accountUsername,
    email: req.body.accountEmail,
    passwordLimit: req.body.accountpasswordLimit,
    permissionsLevel: req.body.accountPermissionsLevel,
    modifiedAt: timestamp
  });
}

exports.getRankColor = (permissionsLevel) => {
  return new Promise((resolve) => {
    resolve(permissionsLevel === 2 ? app.config.colors.rankMaster : (permissionsLevel === 1 ? app.config.colors.rankAdmin : app.config.colors.rankUser));
 });
}

exports.getRankName = (permissionsLevel) => {
  return new Promise(resolve => {
    const level = parseInt(permissionsLevel);
    resolve(level === 2 ? 'Master' : (level === 1 ? 'Admin' : 'User'));
  });
}

exports.sendData = async (req, res) => {
  const sessionIdValid = await this.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    this.handleInvalidSession(res, true);
    return;
  };

  const account = await this.getAccountBySessionId(req.cookies['user_session']);
  const sessions = [];

  for (const session of account.sessions) {
    sessions.push({
      id: session.id.split('-')[0],
      browser: session.browser,
      platform: session.platform,
      ip: session.ip,
      lastAccessed: req.cookies['user_session'] === session.id ? 'current' : session.lastAccessed
    });
  }

  res.status(200).send({
    stats: account.permissionsLevel === 0 ? undefined :await serverManager.getStats(),
    config: {
      messages: app.config.messages,
      colors: app.config.colors,
      password: app.config.password,
      account: app.config.account,
      symbols: app.config.symbols
    },
    account: {
      id: account.id,
      username: account.username,
      email: account.email,
      permissionsLevel: account.permissionsLevel,
      passwords: account.passwords.length,
      symbols: account.symbols,
      passwordLimit: account.passwordLimit,
      sessions: sessions,
      lastLogin: account.lastLogin,
      createdAt: account.createdAt,
      modifiedAt: account.modifiedAt == undefined ? '-/-' : account.modifiedAt,
      dates: await logManager.getAccountDates(account.id)
    },
    passwords: await passwordManager.getPasswords(req.cookies['user_session']),
    accounts: account.permissionsLevel === 0 ? undefined : await this.getAccounts()
  });
}

exports.deleteAccount = async (req, res) => {
  const sessionIdValid = await this.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    this.handleInvalidSession(res, true);
    return;
  }

  if (!req.body.accountId) {
    res.sendStatus(400);
    return;
  }

  app.fs.remove(`${app.path}/src/database/accounts/${req.body.accountId}/`);

  const passwords = await app.database.get('accounts')
                                      .find({id: req.body.accountId})
                                      .get('passwords')
                                      .value();

  app.database.get('server.stats').update('passwords', n => n - passwords.length).write();

  socketManager.sendClientMessageByAccountId(req.body.accountId, {
    type: 'logout',
    location: app.config.redirectPath
  });

  const account = await app.database.get('accounts')
                                    .remove({id: req.body.accountId})
                                    .write();

  res.status(200).json({success: true});

  socketManager.broadcast({
    type: 'removeAccount',
    id: req.body.accountId
  });

  serverManager.countStats('accounts', false);
  serverManager.sendNewStats();

  logManager.log(req.cookies['user_session'], `deleted account <strong>${account[0].username} #${req.body.accountId}</strong> [email: ${account[0].email}, rank: ${await this.getRankName(account[0].permissionsLevel)}]`);

  if (req.body.sendEmail) {
    const username = await this.getUsernameBySessionId(req.cookies['user_session']);
    const design = await serverManager.getTemplate('email', 'accountDeleted');

    emailManager.sendEmail(account[0].email, 'Account deleted', 
      design.replace('%deletedByUsername%', username)
            .replace('%username%', account[0].username)
            .replace('%email%', account[0].email)
            .replace('%date%', await app.getFullTime()), 
      account[0].passwords.length === 0 ? undefined : {filename: `passwords_${await app.getDate('-')}.json`, content: JSON.stringify(account[0].passwords)});
  }
}