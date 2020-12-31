const app = require('../../app.js');
const socketManager = require('./socket_manager');

exports.sendNewStats = async () => {
  const stats = await this.getStats();

  socketManager.broadcast({
    type: 'updateServer',
    accounts: stats.accounts, 
    passwords: stats.passwords
  });
}

exports.getStats = async () => {
  return new Promise(resolve => {
    resolve(app.database.get('server.stats').value());
  });
}

exports.countStats = async (name, countUp, number) => {
  app.database.get('server.stats').update(name, count => countUp === true 
    ? (number !== undefined ? count + number : count + 1) 
    : (number !== undefined ? count - number : count - 1)).write();
}

const templates = new Map();

exports.loadTemplates = async () => {
  const loadedTemplates = new Map();
  const directories = await app.fs.readdir(`${app.path}/templates/`);

  for await (const directory of directories) {
    if (!directory.endsWith('.html')) {
      const filenames = await app.fs.readdir(`${app.path}/templates/${directory}`);

      for await (const filename of filenames) {
        const fileData = await app.fs.readFile(`${app.path}/templates/${directory}/${filename}`);
        const fileContent = fileData.toString();

        let newContent = undefined;

        if (filename === 'header.html') {
          newContent = fileContent.replace(/%informationsName%/g, app.config.informations.name);
        } else if (filename === 'footer.html') {
          newContent = fileContent.replace(/%informationsSupportEmail%/g, app.config.informations.supportEmail);
        }

        loadedTemplates.set(directory + filename.split('.')[0], newContent === undefined ? fileContent : newContent);
      }
    }

    for await (const loadedTemplate of loadedTemplates) {
      if (loadedTemplate[0].name !== 'header' && loadedTemplate[0].name !== 'footer') {
        templates.set(loadedTemplate[0], loadedTemplate[1].replace('%header%', loadedTemplates.get('emailheader')).replace('%footer%', loadedTemplates.get('emailfooter')))
      }
    }
  }
}

exports.getTemplate = async (type, name) => {
  return templates.get(type + name);
}