const {config, fs, path, getTime, getDate, doGzip, zlib} = require('../../app');
const accountManager = require('./account_manager');
const socketManager = require('./socket_manager');
const Cache = require('./cache_manager');

const logPath = `${path}/src/database/logs`;
const accountPath = `${path}/src/database/accounts`;
let stream;

exports.log = async (user, message) => {
  if (!config.logs.enabled) return;

  const time = await getTime();
 
  new Promise(async (resolve) => {
    if (user === 'server') {
      socketManager.broadcast({
        type: 'updateLogs',
        message: `<span style="color: #808080;">${time}</span> ` +
            `<span style="color: #44bd32; font-weight: bold;">SERVER</span> ` +
            `<span style="color: #ddd">${message}</span>`
      });

      resolve('SERVER');
    } else if (user === 'unkown') {
      socketManager.broadcast({
        type: 'updateLogs',
        message: `<span style="color: #808080;">${time}</span> ` +
            `<span style="color: #fff; font-weight: bold;">UNKOWN</span> ` +
            `<span style="color: #ddd">${message}</span>`
      });
      
      resolve('UNKOWN');
    } else {
      const account = await accountManager.getAccountBySessionId(user);
      const rankColor = await accountManager.getRankColor(account.permissionsLevel);

      socketManager.broadcast({
        type: 'updateLogs',
        message: `<span style="color: #808080;">${time}</span> ` +
            `<span style="color: ${rankColor}; font-weight: bold;">${account.username}</span> ` +
            `<span style="color: #ddd">${message}</span>`
      });

      if (config.logs.enabled) {
        const date = await getDate('-');

        fs.appendFile(`${accountPath}/${account.id}/logs/${date}.log`, `${time} ${message.replace(/<\/?[^>]+(>|$)/g, '')}\n`, (err) => {
          if (err) {
            accountManager.createAccountDirectories(account.id);
          }
        });
      }

      resolve(account.username);
    }
  })
  .then((username) => {
    if (stream) {
      // remove all html tags from string
      stream.write(`${time} ${username} ${message.replace(/<\/?[^>]+(>|$)/g, '')}\n`);
    }
  })
  .catch((error) => console.error('Error: ', error));
}

let timeout;

exports.start = async () => {
  if (!config.logs.enabled) {
    stop();
    return;
  }

  const today = new Date();
  const now = Date.now();
  const night = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 24, 0, 0).getTime();
  const date = await getDate('-');

  /* flag a: Open file for appending. The file is created if it does not exist. */
  stream = fs.createWriteStream(`${logPath}/${date}.log`, {flags: 'a'});

  stream.on('error', (error) => {
    console.error('stream error: ', error);
    stream.close();
  });

  this.compressOldLogs();
  this.compressOldAccountLogs();

  timeout = setTimeout(async () => {
    this.log('server', 'test1');

    this.compressOldLogs();
    this.compressOldAccountLogs();

    this.log('server', 'Compress daily log...');

    this.start();
  }, (night - now));
}

exports.compressOldLogs = async () => {
  const date = await getDate('-');
  const today = new Date();
  const deleteDays = config.logs.deleteDays;
  const deleteDate = new Date(today.getFullYear(), today.getMonth(), (today.getDate() - deleteDays)).getTime();
  
  fs.readdir(logPath, async (err, logs) => {
    if (err || !logs) return;

    for (const log of logs) {
      const file = log.split('.');

      if (file[0] === date) continue;

      const logDate = log.split('.')[0].split('-');
      const logCreateTime = new Date(logDate[2], (logDate[0] - 1), logDate[1]).getTime();

      if (deleteDate > logCreateTime) {
        await fs.remove(`${logPath}/${log}`)
          .finally(() => this.log('server', `log ${file[0]} was deleted`))
          .catch(error => this.log('server', `deleteing file ${file[0]} failed: ${error}`));
      } else if (file[1] === 'log') {
        await doGzip(`${logPath}/${log}`, `${logPath}/${file[0]}.gz`)
          .finally(() => this.log('server', `log ${file[0]} successfully compressed...`))
          .catch(error => this.log('server', `compressing log ${file[0]} failed: ${error}`));
        
        await fs.remove(`${logPath}/${log}`);
      }
    }
  });
}

exports.compressOldAccountLogs = async () => {
  const date = await getDate('-');
  const today = new Date();
  const deleteDays = config.account.logs.deleteDays;
  const deleteDate = new Date(today.getFullYear(), today.getMonth(), (today.getDate() - deleteDays)).getTime();
  const accountsIds = await accountManager.getAccountsIds();

  for (const accountId of accountsIds) {
    const path = `${accountPath}/${accountId}/logs/`;
  
    fs.readdir(path, async (err, logs) => {
      if (err || !logs) return;

      for (const log of logs) {
        const file = log.split('.');
  
        if (file[0] === date) continue;
  
        const logDate = log.split('.')[0].split('-');
        const logCreateTime = new Date(logDate[2], (logDate[0] - 1), logDate[1]).getTime();
  
        if (deleteDate > logCreateTime) {
          await fs.remove(`${accountPath}/${accountId}/logs/${log}`)
            .finally(() => this.log('server', `account log ${file[0]} from ${accountId} was deleted`))
            .catch(error => this.log('server', `deleting account log ${file[0]} from ${accountId} failed: ${error}`));
        } else if (file[1] === 'log') {
          await doGzip(`${accountPath}/${accountId}/logs/${log}`, `${accountPath}/${accountId}/logs/${file[0]}.gz`)
            .finally(() => this.log('server', `account log ${file[0]} from ${accountId} successfully compressed...`))
            .catch(error => this.log('server', `compressing account log ${file[0]} from ${accountId} failed: ${error}`));
  
          await fs.remove(`${accountPath}/${accountId}/logs/${log}`);
        }
      }
    });
  }
}

async function stop() {
  clearTimeout(timeout);
  if (steam) {
    stream.close();
  }
}

const cache = new Cache(60);

exports.getLogDates = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  if (cache.has('dates')) {
    const dates = await cache.get('dates');
    res.status(200).json({dates: dates});
  } else {
    const files = await fs.readdir(`${logPath}/`);
    const timestamps = [];

    for (const file of files) {
      const date = file.split('.')[0].split('-');
      const timestamp = new Date(date[2], date[1] - 1, date[0]).getTime();

      timestamps.push(timestamp);
    }

    timestamps.sort((a, b) => a - b);

    const dates = [];

    for (const timestamp of timestamps) {
      const date = await getDate('-', timestamp);
      dates.push(date);
    }

    cache.set('dates', dates);

    res.status(200).json({dates: dates});
  }

  this.log(req.cookies['user_session'], `joined live logs`);
}

exports.getAccountDates = async (accountId) => {
  return new Promise((resolve) => {
    if (cache.has(`dates-${accountId}`)) {
      resolve(cache.get(`dates-${accountId}`));
    } else {
      fs.readdir(`${path}/src/database/accounts/${accountId}/logs`, async (err, files) =>  {
        if (err || !files) {
          resolve([]);
          return;
        }

        const timestamps = [];

        for (const file of files) {
          const date = file.split('.')[0].split('-');
          const timestamp = new Date(date[2], date[1] - 1, date[0]).getTime();

          timestamps.push(timestamp);
        }

        timestamps.sort((a, b) => a - b);

        const dates = [];

        for (const timestamp of timestamps) {
          const date = await getDate('-', timestamp);
          dates.push(date);
        }
    
        cache.set(`dates-${accountId}`, dates);
        resolve(dates);
      });
    }
  });
}

exports.getLog = async (req, res) => {
  const sessionIdValid = await accountManager.sessionIdValid(req.cookies['user_session']);

  if (!sessionIdValid) {
    accountManager.handleInvalidSession(res, true);
    return;
  }

  const date = req.body.date;
  const line = parseInt(req.body.line);
  const endLine = line + 500;
  let logStream;
  let index = 0;
  let data = '';

  if (req.body.type === 'account') {
    loadLog(res, `log-${req.body.accountId}-${date}`, date, line, endLine, `${accountPath}/${req.body.accountId}/logs/${date}`);

    const accountUsername = await accountManager.getUsernameByAccountId(req.body.accountId);

    this.log(req.cookies['user_session'], `load account log from <strong>${accountUsername}</strong> [<strong>${req.body.date}</strong>, line <strong>${line}</strong> to <strong>${endLine}</strong>]`);
  } else {
    console.log('date', date)
    loadLog(res, `log-${date}`, date, line, endLine, `${logPath}/${date}`);
    this.log(req.cookies['user_session'], `load log [<strong>${req.body.date}</strong>, line <strong>${line}</strong> to <strong>${endLine}</strong>]`);
  }

  function loadLog(res, cacheValue, date, line, endLine, filePath) {
    new Promise(async (resolve) => {
      if (cache.has(cacheValue)) {
        let cachedMessages = await cache.get(cacheValue);
        let messages = [];
  
        for (let i = line; i < endLine; i++) {
          const message = cachedMessages.get(i);
          
          if (message === '' || message === undefined) {
            messages.push('end');
            break;
          }
          messages.push(message);
        }
  
        res.status(200).json({messages: messages});
      } else {
        const today = await getDate('-');
  
        if (date === today) {
          logStream = fs.createReadStream(`${filePath}.log`, 'utf8');
  
          logStream.on('data', async (chunk) => data += chunk);
  
          resolve();
        } else {
          fs.access(`${filePath}.gz`, fs.constants.F_OK, (err) => {
            if (err) {
              res.status(200).json({success: false});
            } else {
              logStream = fs.createReadStream(`${filePath}.gz`).pipe(zlib.createGunzip());
  
              logStream.on('data', async (chunk) => data += Buffer.from(chunk).toString("utf8"));
  
              resolve();
            }
          });
        }
      }
    })
    .then(() => {
      logStream.on('error', async (error) => {
        console.error('Error2', error)
        logStream.close();
      });
  
      logStream.on('end', async () => {
        let messagesMap = new Map();
        let messages = data.split('\n');
  
        for await (let message of messages) {
          messagesMap.set(index, message);
          index++;
        }
  
        cache.set(cacheValue, messagesMap);
  
        messages = [];
  
        const cachedMessages = await cache.get(cacheValue);
  
        for (let i = line; i < endLine; i++) {
          const message = cachedMessages.get(i);
          
          if (message === '' || message === undefined) {
            messages.push('end');
            break;
          }
          messages.push(message);
        }
  
        res.status(200).json({messages: messages});
      });
    });
  }
}