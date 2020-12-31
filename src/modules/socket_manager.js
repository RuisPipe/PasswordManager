const {WebSocket} = require('../../app');
const accountManager = require('../modules/account_manager');

let webSocketServer;
let clients = new Map();

exports.create = (server) => {
  webSocketServer = new WebSocket.Server({clientTracking: false, server});

  webSocketServer.on('connection', async (ws, req) => {
    if (!req.headers.cookie) {
      ws.close();
      return;
    }

    const cookies = req.headers.cookie.split('; ');
    const result = cookies.find(element => element.startsWith('user_session'));

    if (!result) return;

    const sessionId = result.split('=')[1];

    const sessionValid = await accountManager.sessionIdValid(sessionId);

    if (!sessionValid) {
      ws.close();
      return;
    }

    ws.id = sessionId;
    clients.set(sessionId, ws);

    ws.on('pong', async () => {});

    ws.on('close', async () => {
      for (const client of clients) {
        if (client[0] === ws.id) {
          clients.delete(client[0]);
        }
      }
    });
  });
}

function noop() {}

setInterval(() => {
  for (const client of clients) {
    client[1].ping(noop);
  }
}, 30000);

exports.sendClientMessage = async (sessionId, message) => {
  for (const client of clients) {
    if (client[0] === sessionId) {
      client[1].send(JSON.stringify(message));
    }
  }
}

exports.sendClientMessageByAccountId = async (accountId, message) => {
  const sessions = await accountManager.getSessionsByAccountId(accountId);

  for (const session of sessions) {
    for (const client of clients) {
      if (client[0] === session.id) {
        client[1].send(JSON.stringify(message));
      }
    }
  }
}

exports.broadcast = async (message) => {
  for (const client of clients) {
    const account = await accountManager.getAccountBySessionId(client[0]);

    if (account && account.permissionsLevel !== 0) {
      client[1].send(JSON.stringify(message));
    }
  }
}