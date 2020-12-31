const app = require('../../app.js');
const Cache = require('./cache_manager');

const cache = new Cache(20);

exports.update = async (category, name, value) => {
  if (category) {
    app.database.get(`server.config.${category}`).update(name, data => data = value).write();
    cache.set(`${category}.${name}`, value);
  } else {
    app.database.get('server.config').update(name, data => data = value).write();
    cache.set(name, value);
  }
}

exports.get = (category, name) => {
  if (category) {
    return new Promise((resolve) => {
      if (!cache.has(`${category}.${name}`)) {
        cache.set(`${category}.${name}`, app.database.get(`server.config.${category}.${name}`).value());
      }
      resolve(cache.get(`${category}.${name}`));
    });
  } else {
    return new Promise((resolve) => {
      if (!cache.has(`${name}`)) {
        cache.set(name, app.database.get(`server.config.${name}`).value());
      }
      resolve(config.get(name));
    });
  }
}