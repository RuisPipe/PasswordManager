/* https://javascript-minifier.com/ */

if (!localStorage.getItem('key')) {
  window.location.href = '/login';
}

const webSocketServerLocation = `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;

let config = undefined;
let myAccount = undefined;
let clientIsAdmin = false;

function containsClassName(element, className) {
  return element.classList.contains(className);
}

function toggleClassName(element, className) {
  element.classList.contains(className) ? element.classList.remove(className) : element.classList.add(className);
}

function addClassName(element, className) {
  element.classList.add(className);
}

function removeClassName(element, className) {
  element.classList.remove(className);
}

function getFullTime(timestamp) {
  const today = new Date(parseInt(timestamp));
  
  const day = ('0' + today.getDate()).slice(-2);
  const month = ('0' + (today.getMonth() + 1)).slice(-2);
  const year = today.getFullYear();
  const hours = ('0' + today.getHours()).slice(-2);
  const minutes = ('0' + today.getMinutes()).slice(-2);
  const seconds = ('0' + today.getSeconds()).slice(-2);
  
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

const pageLoader = document.querySelector('#page-loader');
const pageLoaderSpinner = document.querySelectorAll('.spinner')[0];

function initSystem() {
  fetch(`account/data`)
  .then(response => response.json())
  .then(result => {
    if (result.logout) {
      window.location.href = result.logout;
      return; 
    }

    config = result.config;
    myAccount = result.account;

    main(result);
    
    setPageLoader(1);
  });
}

function setPageLoader(status) {
  pageLoader.style.opacity = 1;
  pageLoaderSpinner.style.opacity = 1;

  if (status === 0) {
    addClassName(pageLoader, 'active');
  } else {
    setPageLoaderStatus('finish');
  
    const fadeEffect = setInterval(() => {
      if (pageLoader.style.opacity > 0) {
        pageLoader.style.opacity -= 0.1;
        pageLoaderSpinner.style.opacity -= 0.1;
      } else {
        clearInterval(fadeEffect);
        removeClassName(pageLoader, 'active');
      }
    }, 30);
  }
}

const pageLoaderStatusText = document.querySelector('#page-loader-status');

function setPageLoaderStatus(text) {
  pageLoaderStatusText.innerText = text;
}

function main(result) {
  getCookie('permissions_level') > 0 ? clientIsAdmin = true : navItemServerSettings.style.display = 'none';

  if (!getCookie('user_content_serversettings')) {
    setCookie('user_content_serversettings', '0', 7);
  }
  
  localStorage.setItem('symbols', myAccount.symbols);

  initCreatePassword();
  initPasswordSearch();
  
  initModalAccountCreate();

  initModalAccountEdit();
  initAccountSearch();

  updateServerStats(result.stats);

  initModalMyAccountEdit();
  initMyAccountSettings();
  initMyAccountSessions(); 
  initMyAccountPasswordTrash();
  initModalPasswordsImport();
  initModalPasswordsExport();

  getCookie('user_content') ? changeContentTo(parseInt(getCookie('user_content'))) : changeContentTo(0);

  updateUser(myAccount);

  Password.clearPasswords();

  if (!result.passwords || result.passwords.length === 0) {
    showNoPasswordsMessage(true);
    if (passwordsMap.size !== 0) {
      Password.clearPasswords();
    }
  } else {
    showNoPasswordsMessage(false);

    try {
      const key = getKey();
    
      for (let encryptedPassword of result.passwords) {
        const decryptedPassword = {
          id: encryptedPassword.id,
          name: CryptoJS.AES.decrypt(encryptedPassword.name, key).toString(CryptoJS.enc.Utf8),
          password: CryptoJS.AES.decrypt(encryptedPassword.password, key).toString(CryptoJS.enc.Utf8),
          histories: [],
          platform: encryptedPassword.platform === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.platform, key).toString(CryptoJS.enc.Utf8),
          url: encryptedPassword.url === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.url, key).toString(CryptoJS.enc.Utf8),
          username: encryptedPassword.username === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.username, key).toString(CryptoJS.enc.Utf8),
          email: encryptedPassword.email === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.email, key).toString(CryptoJS.enc.Utf8),
          description: encryptedPassword.description === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.description, key).toString(CryptoJS.enc.Utf8),
          createdAt: CryptoJS.AES.decrypt(encryptedPassword.createdAt, key).toString(CryptoJS.enc.Utf8),
          modifiedAt: encryptedPassword.modifiedAt === undefined ? undefined : CryptoJS.AES.decrypt(encryptedPassword.modifiedAt, key).toString(CryptoJS.enc.Utf8),
        };

        for (const history of encryptedPassword.histories) {
          const encryptedHistory = {
            id: history.id,
            password: CryptoJS.AES.decrypt(history.password, key).toString(CryptoJS.enc.Utf8),
            deletedAt: CryptoJS.AES.decrypt(history.deletedAt, key).toString(CryptoJS.enc.Utf8)
          };

          decryptedPassword.histories.push(encryptedHistory);
        }

        new Password(decryptedPassword);
      }
    } catch (error) {
      console.error('key invalid', error)
      handleLogOut('/login');
    }

    Password.registerClickEvents();
  }

  initModalPasswordEdit();
  initAccounts(result.accounts);
}

function initAccounts(accounts) {
  if (myAccount.permissionsLevel === 0) return;

  accountSearch.clear();
  modalAccountCreate.close();
  modalAccountEdit.close();

  const oldCollapsibles = serverSettingsTabContentAccounts.querySelectorAll('.collapsible');
  const oldCollapsibleBodys = serverSettingsTabContentAccounts.querySelectorAll('.collapsible-body');

  for (let oldCollapsible of oldCollapsibles) {
    oldCollapsible.remove();
  }

  for (let oldCollapsibleBody of oldCollapsibleBodys) {
    oldCollapsibleBody.remove();
  }

  if (accounts.length === 0) {
    sendPopup('error', config.messages.noAccounts);
    return; 
  }

  for (let account of accounts) {
    modalAccountLog.setDates(account.dates);

    new ServerSettingsAccount(account).build();
  }

  ServerSettingsAccount.registerClickEvents();
}

function initMyAccountSettings() {
  setAccount('passwords', myAccount.passwords);
  setAccount('id', myAccount.id);
  setAccount('createdAt', getFullTime(myAccount.createdAt), config.colors.createdAt);

  contentAccountSettings.querySelector('.fa-upload').onclick = () => modalPasswordsImport.build();
  contentAccountSettings.querySelector('.fa-download').onclick = () => modalPasswordsExport.build();

  contentAccountSettings.querySelector('.fa-desktop').onclick = () => {
    !myAccount.dates || myAccount.dates.length === 0 ? sendPopup('error', config.messages.noAccountLogs) : modalAccountLog.build(myAccount.id, myAccount.dates);
  };

  contentAccountSettings.querySelector('.fa-cog').onclick = () => modalMyAccountEdit.build(myAccount.id);
}

function initMyAccountSessions() {
  contentAccountSettings.querySelector('#sessions').innerHTML = '';
  
  for (const session of myAccount.sessions) {
    addSession(session);
  }
}

function addSession(session) {
  const div = createElement('div', {id: `session-${session.id}`})
  contentAccountSettings.querySelector('#sessions').appendChild(div);

  const spaceBetween = createElement('div', {class: 'space-between'});
  div.appendChild(spaceBetween);

  const h4 = createElement('h4', {}, `${session.ip} - ${session.browser} on ${session.platform}`);
  spaceBetween.appendChild(h4);

  const icon = createElement('i', {class: 'fa fa-sign-out-alt', 'aria-hidden': true});
  spaceBetween.appendChild(icon);

  const p = createElement('p', {}, session.lastAccessed === 'current' ? `<span style="color: ${config.colors.session.current}">Your current session</span>` : `Last accessed on <span style="color: ${config.colors.session.lastAccessed}">${getFullTime(session.lastAccessed)}</span>`, true);
  div.appendChild(p);

  icon.onclick = () => {
    fetch('/session/revoke', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `id=${session.id}`
    })
    .then(response => response.json())
    .then(result => {
      if (result.logout) {
        window.location.href = result.logout;
        return; 
      }

      sendPopup('success', 'Session revoked');
    });
  };
}

function updateSession(session) {
  const div = contentAccountSettings.querySelector(`#session-${session.id}`);

  if (div) {
    div.querySelector('h4').innerHTML = `${session.ip} - ${session.browser} on ${session.platform}`;
    div.querySelector('p').innerHTML = `Last accessed on <span style="color: ${config.colors.session.lastAccessed}">${getFullTime(session.lastAccessed)}</span>`;
  } else {
    addSession(session);
  }
}

function removeSession(id) {
  contentAccountSettings.querySelector(`#session-${id}`).remove();
}

function initMyAccountPasswordTrash() {
  const div = contentAccountSettings.querySelector('#passwordTrash');
  const card = contentAccountSettings.querySelector('#card-passwordtrash');

  handleShowPasswordTrash();

  if (myAccount.passwordTrash.length !== 0) {
    div.innerHTML = '';

    for (const pwTrash of myAccount.passwordTrash) {
      console.log(pwTrash)
      addPasswordToTrash(pwTrash);
    }
  }

  console.log(myAccount.passwordTrash, div)
}

function handleShowPasswordTrash() {
  contentAccountSettings.querySelector('#card-passwordtrash').style.display = myAccount.passwordTrash.length === 0 ? 'none' : 'block';
}

function addPasswordToTrash(password) {
  const key = getKey();

  const decryptedPassword = {
    name: CryptoJS.AES.decrypt(password.name, key).toString(CryptoJS.enc.Utf8),
    deletedAt: CryptoJS.AES.decrypt(password.deletedAt, key).toString(CryptoJS.enc.Utf8)
  };

  console.log('pw', password, decryptedPassword)
  const div = contentAccountSettings.querySelector('#passwordTrash');

  const divPasswordTrash = createElement('div', {id: `password-trash-${password.id}`});
  div.appendChild(divPasswordTrash);

  const spaceBetween = createElement('div', {class: 'space-between'})
  divPasswordTrash.appendChild(spaceBetween);

  spaceBetween.appendChild(createElement('h4', {}, `${decryptedPassword.name} <span style="color: #d1d1d1">#</span>${password.id}`, true));

  const iconDiv = createElement('div');
  spaceBetween.appendChild(iconDiv);

  const iconRestore = createElement('i', {'class': 'fa fa-redo', 'aria-hidden': true})
  const iconDelete = createElement('i', {'class': 'fa fa-trash', 'aria-hidden': true})

  iconDiv.appendChild(iconRestore)
  iconDiv.appendChild(iconDelete)

  const p = createElement('p', {}, 'From: ');
  divPasswordTrash.appendChild(p)

  p.appendChild(createElement('span', {'style': {'color': '#c0392b'}}, getFullTime(decryptedPassword.deletedAt)))

  iconRestore.onclick = () => {
    fetch('/pwtrash/restore', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `id=${password.id}`
    })
    .then(response => response.json())
    .then(result => {
      if (result.logout) {
        window.location.href = result.logout;
        return; 
      }

      sendPopup('success', 'Password revoked');
    });
  };

  iconDelete.onclick = () => {
    fetch('/pwtrash/delete', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `id=${password.id}`
    })
    .then(response => response.json())
    .then(result => {
      if (result.logout) {
        window.location.href = result.logout;
        return; 
      }

      sendPopup('success', `Password <span style="color: #d1d1d1">#</span><b>${password.id}</b> was deleted from trash`);
    });
  };
}

function deletePasswordFromTrash(passwordId) {
  const el = document.querySelector(`#password-trash-${passwordId}`);

  if (el) {
    el.remove();
  }

  myAccount.passwordTrash = myAccount.passwordTrash.filter(password => password.id !== passwordId);
}

function setAccount(type, value, color) {
  const element = contentAccountSettings.querySelector(`#account-${type.toLowerCase()}`);
  element.innerHTML = value === null ? '-/-' : (type === 'permissionsLevel' ? getRankName(value) : value);
  if (color) {
    element.style.color = color;
  }
  myAccount[type] = value;
}

function showNoPasswordsMessage(boolean) {
  const noPasswordsElement = contentPasswords.querySelector('#nopasswords');

  noPasswordsElement.innerHTML = config.messages.noPasswords;
  boolean ? addClassName(noPasswordsElement, 'active') : removeClassName(noPasswordsElement, 'active');
}

class ModalPasswordsImport {
  constructor(modal, headerIconClose, form, importContainer, passwordContainer, previewContainer, table) {
    this.modal = modal;
    this.headerIconClose = headerIconClose;
    this.form = form;
    this.importContainer = importContainer;
    this.passwordContainer = passwordContainer;
    this.previewContainer = previewContainer;
    this.table = table;
    this.passwords = [];
  
    this.register();
  }

  open() {
    addClassName(this.modal, 'active');
  }

  close() {
    removeClassName(this.modal, 'active');
  }

  getModal() {
    return this.modal;
  }

  register() {
    this.headerIconClose.onclick = () => this.close();

    this.init();

    this.form.type.onchange = () => {
      if (this.form.type.value === 'decryptedCsv') {
        removeClassName(this.passwordContainer, 'active');
        this.form.password.removeAttribute('required');
      } else {
        addClassName(this.passwordContainer, 'active');
        this.form.password.setAttribute('required', '');
      }
    }

    this.form.buttonImport.onclick = () => {
      this.form.onsubmit = (event) => {
        event.preventDefault();

        if (containsClassName(this.importContainer, 'active')) {
          const input = createElement('input', {type: 'file'});
          input.click();

          input.onchange = () => {
            const file = input.files[0];

            if (this.form.type.value.endsWith('Csv')) {
              if (file.type === 'text/csv') {
                removeClassName(this.importContainer, 'active');
                addClassName(this.previewContainer, 'active');

                if (this.form.type.value === 'encryptedCsv') {
                  this.importCsvEncrypted(file);
                } else {
                  this.importCsvDecrypted(file);
                }
              } else {
                sendPopup('error', 'Please select file with csv type');
              }
            } else if (this.form.type.value.endsWith('Json')) {
              if (file.type === 'application/json') {
                removeClassName(this.importContainer, 'active');
                addClassName(this.previewContainer, 'active');

                this.importJsonEncrypted(file);
              } else {
                sendPopup('error', 'Please select file with json type');
              }
            } else {
              sendPopup('error', 'File type invalid');
            }
          };
        } else {
          const encryptedPasswords = [];
          const key = getKey();

          for (const password of this.passwords) {
            const nameAvailable = isPasswordNameAvailable(password.name);

            if (!nameAvailable) {
              let found = false;
              let n = 0;

              while (!found) {
                n++;

                if (isPasswordNameAvailable(`${password.name}${n}`)) {
                  found = true;
                  password.name = `${password.name}${n}`;
                }
              }
            }

            const encryptedPassword = {
              id: isPasswordIdAvailable(password.id) === true ? password.id : generateUniquePasswordId(),
              name: CryptoJS.AES.encrypt(password.name, key).toString(),
              password: CryptoJS.AES.encrypt(password.password, key).toString(),
              histories: [],
              platform: password.platform === undefined ? undefined : CryptoJS.AES.encrypt(password.platform, key).toString(),
              url: password.url === undefined ? undefined : CryptoJS.AES.encrypt(password.url, key).toString(),
              username: password.username === undefined ? undefined : CryptoJS.AES.encrypt(password.username, key).toString(),
              email: password.email === undefined ? undefined : CryptoJS.AES.encrypt(password.email, key).toString(),
              description: password.description === undefined ? undefined : CryptoJS.AES.encrypt(password.description, key).toString(),
              createdAt: CryptoJS.AES.encrypt(password.createdAt, key).toString(),
              modifiedAt: password.modifiedAt === undefined ? undefined : CryptoJS.AES.encrypt(password.modifiedAt, key).toString()
            };

            for (const history of password.histories) {
              const encryptedHistory = {
                id: history.id,
                password: CryptoJS.AES.encrypt(history.password, key).toString(),
                deletedAt: CryptoJS.AES.encrypt(history.deletedAt, key).toString()
              };

              encryptedPassword.histories.push(encryptedHistory);
            }

            encryptedPasswords.push(encryptedPassword);
          }

          fetch(`password/create`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json; charset=utf-8'
            },
            body: JSON.stringify({type: 1, passwords: encryptedPasswords}),
          })
          .then(response => response.json())
          .then(result => {
            if (result.logout) {
              window.location.href = result.logout;
              return; 
            }
            
            sendPopup('success', config.messages.password.imported);
          })
          .catch(error => console.error(error));
        }
      };
    };
  }

  init() {
    this.close();
  }

  reset() {
    this.passwords = [];

    this.form.type.value = 'decryptedCsv';

    removeClassName(this.passwordContainer, 'active');
    this.form.password.removeAttribute('required');
    this.form.password.value = '';
    this.form.password.style.boxShadow = 'none';

    this.table.innerHTML = `<tr>
                              <th>Id</th>
                              <th>Name</th>
                              <th>Password</th>
                              <th>Histories</th>
                              <th>Platform</th>
                              <th>Url</th>
                              <th>Username</th>
                              <th>Email</th>
                              <th>Description</th>
                              <th>Created at</th>
                              <th>Modified at</th>
                            </tr>`;
  }

  build() {
    this.reset();

    addClassName(this.importContainer, 'active');
    removeClassName(this.previewContainer, 'active');

    removeClassName(this.passwordContainer, 'active');

    this.open();
  }

  importCsvEncrypted(input) {
    let reader = new FileReader();
    reader.readAsBinaryString(input);
    reader.onload = (event) => {
      const list = event.target.result.split('\n');
      list.shift();

      const key = this.form.password.value;

      try {
        for (const res of list) {
          const data = res.split(',');

          if (data[0] !== '') {
            const password = {
              id:  CryptoJS.AES.decrypt(data[0], key).toString(CryptoJS.enc.Utf8),
              name: CryptoJS.AES.decrypt(data[1], key).toString(CryptoJS.enc.Utf8),
              password: CryptoJS.AES.decrypt(data[2], key).toString(CryptoJS.enc.Utf8),
              histories: JSON.parse(CryptoJS.AES.decrypt(data[3], key).toString(CryptoJS.enc.Utf8)),
              platform: CryptoJS.AES.decrypt(data[4], key).toString(CryptoJS.enc.Utf8),
              url: CryptoJS.AES.decrypt(data[5], key).toString(CryptoJS.enc.Utf8),
              username: CryptoJS.AES.decrypt(data[6], key).toString(CryptoJS.enc.Utf8),
              email: CryptoJS.AES.decrypt(data[7], key).toString(CryptoJS.enc.Utf8),
              description: CryptoJS.AES.decrypt(data[8], key).toString(CryptoJS.enc.Utf8),
              createdAt: CryptoJS.AES.decrypt(data[9], key).toString(CryptoJS.enc.Utf8),
              modifiedAt: CryptoJS.AES.decrypt(data[10], key).toString(CryptoJS.enc.Utf8),
            };

            this.passwords.push({
              id: password.id,
              name: password.name,
              password: password.password,
              histories: password.histories,
              platform: password.platform === '' ? undefined : password.platform,
              url: password.url === '' ? undefined : password.url,
              username: password.username === '' ? undefined : password.username,
              email: password.email === '' ? undefined : password.email,
              description: password.description === '' ? undefined : password.description,
              createdAt: password.createdAt === '' ? undefined : password.createdAt,
              modifiedAt: password.modifiedAt === '' ? undefined : password.modifiedAt
            });

            const tr = document.createElement('tr');
            this.table.appendChild(tr);

            for (const key in password) {
              tr.appendChild(createElement('td', {}, key === 'createdAt' || key === 'modifiedAt' ? (password[key] === '' ? '' : getFullTime(password[key])) : password[key]));
            }
          }
        }
      } catch (error) {
        sendPopup('error', 'Password is not correct');
        this.close();
      }
    };
  }

  importCsvDecrypted(input) {
    let reader = new FileReader();
    reader.readAsBinaryString(input);
    reader.onload = (event) => {
      const list = event.target.result.split('\n');
      list.shift();

      try {
        for (const res of list) {
          if (res != '') {
            const array = CSVtoArray(res);
  
            const password = {
              id: array[0],
              name: array[1] === '""' ? undefined : array[1],
              password: array[2] === '""' ? undefined : array[2],
              histories: array[3] === undefined ? [] : JSON.parse(array[3]),
              platform: array[4] === '""' ? undefined : array[4],
              url: array[5] === '""' ? undefined : array[5],
              username: array[6] === '""' ? undefined : array[6],
              email: array[7] === '""' ? undefined : array[7],
              description: array[8] === '""' ? undefined : array[8].replace(/%nl%/g, '\n'),
              createdAt: array[9] === '""' ? undefined : array[9],
              modifiedAt: array[10] === '""' ? undefined : array[10]
            };
            
            this.passwords.push(password);
            
            const tr = document.createElement('tr');
            this.table.appendChild(tr);
  
            for (let i = 0; i < array.length; i++) {
              tr.appendChild(createElement('td', {}, i > 8 ? (array[i] === '' ? '' : getFullTime(array[i])) : array[i])); 
            }
          }
        }
      } catch (error) {
        this.close();
        sendPopup('error', 'Error');
      }

      /* https://stackoverflow.com/questions/8493195/how-can-i-parse-a-csv-string-with-javascript-which-contains-comma-in-data */
      function CSVtoArray(text) {
        let ret = [''], i = 0, p = '', s = true;
        for (let l in text) {
          l = text[l];
          if ('"' === l) {
            s = !s;
            if ('"' === p) {
              ret[i] += '"';
              l = '-';
            } else if ('' === p) {
              l = '-';
            }
          } else if (s && ',' === l) {
            l = ret[++i] = '';
          } else {
            ret[i] += l;
          }
          p = l;
        }
        return ret;
      }
    };
  }

  importJsonEncrypted(input) {
    let reader = new FileReader();
    reader.readAsBinaryString(input);
    reader.onload = (event) => {
      try  {
        const passwords = JSON.parse(event.target.result);
        const key = this.form.password.value;

        for (const password of passwords) {
          const tr = document.createElement('tr');
          this.table.appendChild(tr);
            
          const decryptedPasword = {
            id:  password.id,
            name: CryptoJS.AES.decrypt(password.name, key).toString(CryptoJS.enc.Utf8),
            password: password.password === undefined ? undefined : CryptoJS.AES.decrypt(password.password, key).toString(CryptoJS.enc.Utf8),
            histories: [],
            platform: password.platform === undefined ? undefined : CryptoJS.AES.decrypt(password.platform, key).toString(CryptoJS.enc.Utf8),
            url: password.url === undefined ? undefined : CryptoJS.AES.decrypt(password.url, key).toString(CryptoJS.enc.Utf8),
            username: password.username === undefined ? undefined : CryptoJS.AES.decrypt(password.username, key).toString(CryptoJS.enc.Utf8),
            email: password.email === undefined ? undefined : CryptoJS.AES.decrypt(password.email, key).toString(CryptoJS.enc.Utf8),
            description: password.description === undefined ? undefined : CryptoJS.AES.decrypt(password.description, key).toString(CryptoJS.enc.Utf8),
            createdAt: CryptoJS.AES.decrypt(password.createdAt, key).toString(CryptoJS.enc.Utf8),
            modifiedAt: password.modifiedAt === undefined ? undefined : CryptoJS.AES.decrypt(password.modifiedAt, key).toString(CryptoJS.enc.Utf8),
          };

          for (const history of password.histories) {
            decryptedPasword.histories.push({
              id: history.id,
              password: CryptoJS.AES.decrypt(history.password, key).toString(CryptoJS.enc.Utf8),
              deletedAt: CryptoJS.AES.decrypt(history.deletedAt, key).toString(CryptoJS.enc.Utf8)
            });
          }

          this.passwords.push(decryptedPasword);

          for (const key in decryptedPasword) {
            tr.appendChild(createElement('td', {}, key === 'createdAt' || key === 'modifiedAt' ? (decryptedPasword[key] === undefined ? '' : getFullTime(decryptedPasword[key])) : decryptedPasword[key])); 
          }
        }
      } catch (error) {
        sendPopup('error', 'Password is not correct');
        this.close();
      }
    };
  }
}

let modalPasswordsImport = undefined;

function initModalPasswordsImport() {
  if (!modalPasswordsImport) {
    modalPasswordsImport = new ModalPasswordsImport(
      contentAccountSettings.querySelector('#modal-passwords-import'),
      contentAccountSettings.querySelector('#modal-passwords-import .modal-header #icon-close'),
      contentAccountSettings.querySelector('#modal-passwords-import form'),
      contentAccountSettings.querySelector('#modal-passwords-import #import-container'),
      contentAccountSettings.querySelector('#modal-passwords-import #password-container'),
      contentAccountSettings.querySelector('#modal-passwords-import #preview-container'),
      contentAccountSettings.querySelector('#modal-passwords-import table'),
    );
  } else {
    modalPasswordsImport.init();
  }
}

class ModalPasswordsExport {
  constructor(modal, headerIconClose, form, passwordContainer, min, max) {
    this.modal = modal;
    this.headerIconClose = headerIconClose;
    this.form = form;
    this.passwordContainer = passwordContainer;
    this.min = min;
    this.max = max;
  
    this.register();
  }

  open() {
    addClassName(this.modal, 'active');
  }

  close() {
    removeClassName(this.modal, 'active');
  }

  getModal() {
    return this.modal;
  }

  register() {
    this.headerIconClose.onclick = () => this.close();

    this.init();

    this.form.type.onchange = () => {
      if (this.form.type.value === 'encrypted') {
        addClassName(this.passwordContainer, 'active');
        this.form.password.setAttribute('required', '');
      } else {
        removeClassName(this.passwordContainer, 'active');
        this.form.password.removeAttribute('required');
      }
    }
    
    this.form.buttonExport.onclick = () => {
      this.form.onsubmit = (event) => {
        event.preventDefault();
        
        switch (this.form.type.value) {
          case 'decrypted':
            this.exportCsvDecrypted();
            break;
          
          case 'encrypted':
            this.exportCsvEncrypted();
            break;

          case 'html':
            this.exportHtml();
            break;

          default:
            throw new Error('form type undefined');
        }
      };
    };
  }

  init() {
    this.close();

    this.form.password.setAttribute('minlength', this.min);
    this.form.password.setAttribute('maxlength', this.max);

    checkInputValidation(this.form.password, this.min, this.max);
  }

  reset() {
    this.form.type.value = 'decrypted';

    removeClassName(this.passwordContainer, 'active');
    this.form.password.removeAttribute('required');
    this.form.password.value = '';
    this.form.password.style.boxShadow = 'none';
  }

  build() {
    this.reset();

    passwordsMap.size === 0 ? sendPopup('error', config.messages.noPasswords) : this.open();
  }
  
  exportCsvDecrypted() {
    let arrayHeader = ['Id', 'Name', 'Password', 'Histories', 'Platform', 'Url', 'Username', 'Email', 'Description', 'createdAt', 'lastModfied']; 
    let arrayData = [];

    passwordsMap.forEach(password => arrayData.push(password));

    let header = `"${arrayHeader.join('","')}"\n`;
    let csv = header;
    arrayData.forEach(obj => {
      let row = [];

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === 'histories') {
            row.push(JSON.stringify(obj[key]));
          } else {
            row.push(obj[key] === undefined ? '' : key === 'description' ? obj[key].replace(/\n/g, '%nl%') : obj[key]); 
          }
        }
      }

      csv += arrayToCSV(row) + '\n';
    });

    function arrayToCSV(row) {
      for (let i in row) {
        row[i] = row[i].replace(/"/g, '""');
      }
      return '"' + row.join('","') + '"';
    }

    let fileData = new Blob([csv], {type: 'text/csv'});
    let fileUrl = URL.createObjectURL(fileData);

    const date = getDate('-');

    createElement('a', {href: fileUrl, target: '_blank', download: `passwords_${date}.csv`}).click();

    this.close();
  }

  exportCsvEncrypted() {
    if (this.form.password.value.length < this.min || this.form.password.value.length > this.max) {
      sendPopup('error', 'Error');
      return;
    }

    let arrayHeader = ['Id', 'Name', 'Password', 'Histories', 'Platform', 'Url', 'Username', 'Email', 'Description', 'createdAt', 'modifiedAt']; 
    let arrayData = [];

    passwordsMap.forEach(password => arrayData.push(password));

    let header = `${arrayHeader.join(',')}\n`;
    let csv = header;
    arrayData.forEach(obj => {
      let row = [];

      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          if (key === 'histories') {
            row.push(CryptoJS.AES.encrypt(JSON.stringify(obj[key]), this.form.password.value));
          } else {
            row.push(CryptoJS.AES.encrypt(obj[key], this.form.password.value));
          }
        }
      }

      csv += `${row.join(',')}\n`;
    });

    let fileData = new Blob([csv], {type: 'text/csv'});  
    let fileUrl = URL.createObjectURL(fileData);

    const date = getDate('-');

    createElement('a', {href: fileUrl, target: '_blank', download: `passwords_${date}.csv`}).click();

    this.close();
  }

  exportHtml() {
    fetch('/server/template?type=export')
    .then(response => response.json())
    .then(result => {
      if (!result || !result.content) sendPopup('error', 'Error');

      let content = '';
      let historiesTable = ''; 

      const histories = [];

      for (const password of passwordsMap) {
        content += '<tr>';
  
        for (const property in password[1]) {
          if (property === 'histories') {
            histories.push(password[1][property]);
          } else {
            content += '<td>';

            const value = password[1][property];

            if (property === 'url') {
              content += `<a href="${value.startsWith('https://') || value.startsWith('http://') ? value : `https://${value}`}" target="_blank">${value}</a>`;
            } else if (property === 'createdAt' || property === 'modifiedAt') {
              console.log('val', value)
              content += value === undefined || value === '' ? '' : getFullTime(value);
            } else {
              content += value === undefined ? '' : value;
            }

            content += '</td>';
          }
        }

        content += '</tr>';
      }

      for (const passwordHistories of histories) {
        for (const history of passwordHistories) {
          historiesTable += `<tr>
                              <td>${history.id}</td>
                              <td>${history.password}</td>
                              <td>${getFullTime(history.deletedAt)}</td>
                            </tr>`;
        }
      }

  
      let fileContent = result.content.split('%list%').join(content);

      if (historiesTable != '') {
        fileContent = fileContent.split('%histories%').join(`<h1>Histories</h1>
          <table>
            <tr>
              <th style="min-width: 150px; width: 10%;">Id</th>
              <th style="min-width: 200px; width: 80%;">Password</th>
              <th style="min-width: 200px; width: 10%;">Deleted at</th>
            </tr>
            ${historiesTable}
          </table>`);
      } else {
        fileContent = fileContent.split('%histories%').join('');
      }
  
      const fileData = new Blob([fileContent], {type: 'text/html'});
      const fileUrl = URL.createObjectURL(fileData);

      const date = getDate('-');

      createElement('a', {href: fileUrl, target: '_blank', download: `passwords_${date}.html`}).click();
    });
  }
}

let modalPasswordsExport = undefined;

function initModalPasswordsExport() {
  if (!modalPasswordsExport) {
    modalPasswordsExport = new ModalPasswordsExport(
      contentAccountSettings.querySelector('#modal-passwords-export'),
      contentAccountSettings.querySelector('#modal-passwords-export .modal-header #icon-close'),
      contentAccountSettings.querySelector('#modal-passwords-export form'),
      contentAccountSettings.querySelector('#modal-passwords-export #password-container'),
      2,
      128
    );
  } else {
    modalPasswordsExport.init();
  }
}

class ModalMyAccountEdit {
  constructor(modal, headerTitle, headerIconClose, form, changePasswordContainer, buttonSave) {
    this.modal = modal;
    this.headerTitle = headerTitle;
    this.headerIconClose = headerIconClose;
    this.form = form;
    this.changePasswordContainer = changePasswordContainer,
    this.buttonSave = buttonSave;
  
    this.register();
  }

  open() {
    addClassName(this.modal, 'active');
  }

  close() {
    removeClassName(this.modal, 'active');
  }

  setHeaderTitle(title) {
    this.headerTitle.innerHTML = title;
  }

  getModal() {
    return this.modal;
  }

  register() {
    this.headerIconClose.onclick = () => removeClassName(this.modal, 'active');

    this.init();
    this.form.checkBoxChangePassword.onclick = () => toggleClassName(this.changePasswordContainer, 'active');

    this.buttonSave.onclick = () => {
      this.form.onsubmit = (event) => {
        event.preventDefault();
        this.save();
      };
    };
  }

  init() {
    this.close();

    this.form.username.setAttribute('minlength', config.account.username.min);
    this.form.username.setAttribute('maxlength', config.account.username.max);
    this.form.email.setAttribute('minlength', config.account.email.min);
    this.form.email.setAttribute('maxlength', config.account.email.max);
    this.form.symbols.setAttribute('minlength', config.symbols.min);
    this.form.symbols.setAttribute('maxlength', config.symbols.max);
    this.form.oldPassword.setAttribute('minlength', config.password.password.min);
    this.form.oldPassword.setAttribute('maxlength', config.password.password.max);
    this.form.newPassword.setAttribute('minlength', config.password.password.min);
    this.form.newPassword.setAttribute('maxlength', config.password.password.max);
    this.form.confirmNewPassword.setAttribute('minlength', config.password.password.min);
    this.form.confirmNewPassword.setAttribute('maxlength', config.password.password.max);
    
    isAccountDataAvailable(this.form.username, myAccount.username, true, config.account.username.min, config.account.username.max);
    isAccountDataAvailable(this.form.email, myAccount.email, true, config.account.email.min, config.account.email.max);
    checkInputValidation(this.form.symbols, config.symbols.min, config.symbols.max);

    const key = getKey();

    this.form.oldPassword.oninput = () => {
      if (this.form.oldPassword.value.length >= config.password.password.min && this.form.oldPassword.value.length <= config.password.password.max) {
        this.form.oldPassword.value === key ? setInputIcon(this.form.oldPassword, 'check') : setInputIcon(this.form.oldPassword, 'cross');
      } else {
        setInputIcon(this.form.oldPassword, 'cross');
      }
    };

    this.form.newPassword.oninput = () => {
      if (this.form.newPassword.value.length >= config.password.password.min && this.form.newPassword.value.length <= config.password.password.max) {
        if (this.form.newPassword.value === key) {
          setInputIcon(this.form.newPassword, 'cross');
          return;
        }

        setInputIcon(this.form.newPassword, 'check');

        this.form.newPassword.value === this.form.confirmNewPassword.value 
          ? setInputIcon(this.form.confirmNewPassword, 'check') 
          : setInputIcon(this.form.confirmNewPassword, 'cross');
      } else {
        setInputIcon(this.form.newPassword, 'cross');
      }
    };
  
    this.form.confirmNewPassword.oninput = () => {
      if (this.form.confirmNewPassword.value.length >= config.password.password.min && this.form.confirmNewPassword.value.length <= config.password.password.max) {
        if (this.form.confirmNewPassword.value === key) {
          setInputIcon(this.form.confirmNewPassword, 'cross');
          return;
        }
        
        this.form.newPassword.value === this.form.confirmNewPassword.value 
          ? setInputIcon(this.form.confirmNewPassword, 'check') 
          : setInputIcon(this.form.confirmNewPassword, 'cross');
      } else {
        setInputIcon(this.form.confirmNewPassword, 'cross');
      }
    };
  }

  reset() {
    setInputIcon(this.form.username, 'none');
    setInputIcon(this.form.email, 'none');
    setInputIcon(this.form.symbols, 'none');
    setInputIcon(this.form.oldPassword, 'none');
    setInputIcon(this.form.newPassword, 'none');
    setInputIcon(this.form.confirmNewPassword, 'none');

    this.form.username.value = myAccount.username;
    this.form.email.value = myAccount.email;
    this.form.symbols.value = myAccount.symbols;

    this.form.checkBoxChangePassword.checked = false;
    removeClassName(this.changePasswordContainer, 'active');
    this.form.oldPassword.value = '';
    this.form.oldPassword.style.boxShadow = 'none';
    this.form.newPassword.value = '';
    this.form.newPassword.style.boxShadow = 'none';
    this.form.confirmNewPassword.value = '';
    this.form.confirmNewPassword.style.boxShadow = 'none';
    this.form.checkBoxSendEmail.checked = true;

    this.buttonSave.value = 'save';
  }

  build() {
    this.reset();
    this.open();
  }

  save() {
    if (this.buttonSave.value === 'save') {
      this.buttonSave.value = 'sure?'; 
      return;
    }

    if (this.buttonSave.value !== 'sure?') return;

     if (this.form.username.value === myAccount.username 
      && this.form.email.value === myAccount.email
      && this.form.symbols.value === myAccount.symbols
      && this.form.checkBoxChangePassword.checked === false) {
        modalMyAccountEdit.close();
        sendPopup('success', config.messages.account.meUpdated);
        return;
    }

    const data = {type: 'my', id: myAccount.id};

    if (this.form.checkBoxChangePassword.checked) {
      const key = getKey();

      if (this.form.oldPassword.value !== key) {
        sendPopup('error', 'Old password not valid');
        setInputIcon(this.form.oldPassword, 'cross');
        return;
      }
      if (this.form.newPassword.value.length === 0 || this.form.newPassword.value === key) {
        sendPopup('error', 'new password is not valid')
        setInputIcon(this.form.newPassword, 'cross');
        setInputIcon(this.form.confirmNewPassword, 'cross');
        return;
      }
      if (this.form.confirmNewPassword.value.length === 0) {
        sendPopup('error', 'confirm password is empty');
        setInputIcon(this.form.confirmNewPassword, 'cross');
        return;
      }
      if (this.form.newPassword.value !== this.form.confirmNewPassword.value) {
        sendPopup('error', 'new password not equal to confirm password');
        return;
      }

      data.newpassword = this.form.newPassword.value;
    }

    this.checkUsername(this.form.username, myAccount.username, (callbackUsernameCheck) => {
      if (!callbackUsernameCheck) {
        sendPopup('error', config.messages.account.usernameNotAvailable.replace('%username%', this.form.username.value)); 
        return;
      }

      this.checkEmail(this.form.email, myAccount.email, (callbackEmailCheck) => {
        if (!callbackEmailCheck) {
          sendPopup('error', config.messages.account.emailNotAvailable.replace('%email%', this.form.email.value)); 
          return;
        }

        if (this.form.username.value !== myAccount.username) data.username = this.form.username.value;
        if (this.form.email.value !== myAccount.email) data.email = this.form.email.value;
        if (this.form.symbols.value.length !== 0 
          && this.form.symbols.value.length >= config.symbols.min 
          && this.form.symbols.value.length <= config.symbols.max 
          && this.form.symbols.value !== myAccount.symbols) {
          data.symbols = this.form.symbols.value;
        }

        if (this.form.checkBoxChangePassword.checked) {
          const newEncryptedPasswordsList = [];

          for (const oldPassword of passwordsMap) {
            const newPassword = {
              id: oldPassword[1].id,
              name: CryptoJS.AES.encrypt(oldPassword[1].name, this.form.newPassword.value).toString(),
              password: CryptoJS.AES.encrypt(oldPassword[1].password, this.form.newPassword.value).toString(),
              histories: [],
              platform: oldPassword[1].platform === '' ? undefined : CryptoJS.AES.encrypt(oldPassword[1].platform, this.form.newPassword.value).toString(),
              url: oldPassword[1].url === '' ? undefined : CryptoJS.AES.encrypt(oldPassword[1].url, this.form.newPassword.value).toString(),
              username: oldPassword[1].username === '' ? undefined : CryptoJS.AES.encrypt(oldPassword[1].username, this.form.newPassword.value).toString(),
              email: oldPassword[1].email === '' ? undefined : CryptoJS.AES.encrypt(oldPassword[1].email, this.form.newPassword.value).toString(),
              description: oldPassword[1].description === '' ? undefined : CryptoJS.AES.encrypt(oldPassword[1].description, this.form.newPassword.value).toString(),
              createdAt: CryptoJS.AES.encrypt(oldPassword[1].createdAt, this.form.newPassword.value).toString(),
              modifiedAt: oldPassword[1].modifiedAt === '' ? undefined : CryptoJS.AES.encrypt(oldPassword[1].modifiedAt, this.form.newPassword.value).toString(),
            };

            for (const history of oldPassword[1].histories) {
              newPassword.histories.push({
                id: history.id,
                password: CryptoJS.AES.encrypt(history.password, this.form.newPassword.value).toString(),
                deletedAt: CryptoJS.AES.encrypt(history.deletedAt, this.form.newPassword.value).toString()
              });
            }

            newEncryptedPasswordsList.push(newPassword);
          }
          
          data.passwords = newEncryptedPasswordsList;
          data.sendEmail = this.form.checkBoxSendEmail.checked;
        }

        fetch('account/update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json; charset=utf-8'
          },
          body: JSON.stringify(data),
        })
        .then(response => response.json())
        .then(result => {
          if (result.logout) {
            window.location.href = result.logout;
            return; 
          }

          this.close();
          result.success ? sendPopup('success', config.messages.account.meUpdated) : sendPopup('success', 'Error');
        });
      });
    });
  }

  checkUsername(element, oldUsername, callback) {
    if (element.value === oldUsername) return callback(true);
    isAccountDataAvailable(element, oldUsername, false, config.account.username.min, config.account.username.max, (callbackUsernameAvailable) => callback(callbackUsernameAvailable));
  }

  checkEmail(element, oldEmail, callback) {
    if (element.value === oldEmail) return callback(true);
    isAccountDataAvailable(element, oldEmail, false, config.account.email.min, config.account.email.max, (callbackEmailAvailable) => callback(callbackEmailAvailable));
  }
}

let modalMyAccountEdit = undefined;

function initModalMyAccountEdit() {
  if (!modalMyAccountEdit) {
    modalMyAccountEdit = new ModalMyAccountEdit(
      contentAccountSettings.querySelector('#modal-myaccount'),
      contentAccountSettings.querySelector('#modal-myaccount .modal-header .title'),
      contentAccountSettings.querySelector('#modal-myaccount .modal-header #icon-close'),
      contentAccountSettings.querySelector('#modal-myaccount form'),
      contentAccountSettings.querySelector('#modal-myaccount .change-password-container'),
      contentAccountSettings.querySelector('#modal-myaccount .button-save')
    );
  } else {
    modalMyAccountEdit.init();
  }

  modalMyAccountEdit.setHeaderTitle(`${myAccount.username} <span style="color: #d1d1d1">#</span>${myAccount.id}`);
}

const menuIcon = document.querySelector('.menu-icon');
const nav = document.querySelector('.nav');
const navIconClose = document.querySelector('.nav-icon-close');

menuIcon.onclick = () => toggleClassName(nav, 'active');
navIconClose.onclick = () => toggleClassName(nav, 'active');

const gridContainer = document.querySelector('.grid-container');

const contentCreatePassword = document.querySelector('.content-createpassword');
const contentPasswords = document.querySelector('.content-passwords');
const contentAccountSettings = document.querySelector('.content-accountsettings');
const contentServerSettings = document.querySelector('.content-serversettings');

const navItemCreatePassword = document.querySelector('.nav-item-createpassword');
const navItemPasswords = document.querySelector('.nav-item-passwords');
const navItemAccountSettings = document.querySelector('.nav-item-accountsettings');
const navItemServerSettings = document.querySelector('.nav-item-serversettings');
const navItemLogOut = document.querySelector('.nav-item-logout');

navItemCreatePassword.onclick = () => changeContentTo(0);
navItemPasswords.onclick = () => changeContentTo(1);
navItemAccountSettings.onclick = () => changeContentTo(2);
navItemServerSettings.onclick = () => changeContentTo(3);
navItemLogOut.onclick = () => handleLogOut();

function changeContentTo(number) {
  switch (number) {
    case 0:
      if (!containsClassName(navItemCreatePassword, 'active')) {
        addClassName(navItemCreatePassword, 'active');
        removeClassName(navItemPasswords, 'active');
        removeClassName(navItemAccountSettings, 'active');
        removeClassName(navItemServerSettings, 'active');

        contentCreatePassword.style.display = 'block';
        contentPasswords.style.display = 'none';
        contentAccountSettings.style.display = 'none';
        contentServerSettings.style.display = 'none';

        removeClassName(nav, 'active');
        resetCreatePasswordsValues();
        setCookie('user_content', '0', 7);
      }
      break;

    case 1:
      if (!containsClassName(navItemPasswords, 'active')) {
        removeClassName(navItemCreatePassword, 'active');
        addClassName(navItemPasswords, 'active');
        removeClassName(navItemAccountSettings, 'active');
        removeClassName(navItemServerSettings, 'active');

        contentCreatePassword.style.display = 'none';
        contentPasswords.style.display = 'block';
        contentAccountSettings.style.display = 'none';
        contentServerSettings.style.display = 'none';

        removeClassName(nav, 'active');
        setCookie('user_content', '1', 7);

        passwordSearch.clearAndReload();

        if (passwordsMap.size > 0) {
          showNoPasswordsMessage(false);
        }
      }
      break;

    case 2:
      if (!containsClassName(navItemAccountSettings, 'active')) {
        removeClassName(navItemCreatePassword, 'active');
        removeClassName(navItemPasswords, 'active');
        addClassName(navItemAccountSettings, 'active');
        removeClassName(navItemServerSettings, 'active');

        contentCreatePassword.style.display = 'none';
        contentPasswords.style.display = 'none';
        contentAccountSettings.style.display = 'block';
        contentServerSettings.style.display = 'none';

        removeClassName(nav, 'active');
        setCookie('user_content', '2', 7);
      }
      break;

    case 3:
      if (clientIsAdmin) {
        if (!containsClassName(navItemServerSettings, 'active')) {
          removeClassName(navItemCreatePassword, 'active');
          removeClassName(navItemPasswords, 'active');
          removeClassName(navItemAccountSettings, 'active');
          addClassName(navItemServerSettings, 'active');

          contentCreatePassword.style.display = 'none';
          contentPasswords.style.display = 'none';
          contentAccountSettings.style.display = 'none';
          contentServerSettings.style.display = 'block';

          removeClassName(nav, 'active');
          setCookie('user_content', '3', 7);

          if (!getCookie('user_content_serversettings')) changeServerSettingsContentTo(0);

          switch (parseInt(getCookie('user_content_serversettings'))) {
            case 0:
              removeClassName(serverSettingsTabItemAccounts, 'active');
              changeServerSettingsContentTo(0);
              break;
            case 1:
              removeClassName(serverSettingsTabItemLogs, 'active');
              changeServerSettingsContentTo(1);
              break;
          }
        }
      } else {
        navItemServerSettings.style.display = 'none';
        sendPopup('error', config.messages.noPermissions);
        changeContentTo(0);
      }
      break;
  }
}

function setInputIcon(element, value) {
  switch (value) {
    case 'loading':
      element.style.boxShadow = 'none';
      element.style.backgroundImage = 'url(/assets/img/loader.gif)';
      break;

    case 'check':
      element.style.boxShadow = 'none';
      element.style.backgroundImage = 'url(/assets/img/checkGreen.svg)';
      break;

    case 'cross':
      element.style.boxShadow = '0 0 2px 2px #c0392b';
      element.style.backgroundImage = 'url(/assets/img/crossRed.svg)';
      break;

    case 'none':
      element.style.boxShadow = 'none';
      element.style.backgroundImage = 'none';
      break;
    
    default: 
      throw new Error("Unknown Input Icon value");
  }
}

let delay = function() {
  let timer = 0;
  return function (callback, ms) {
    clearTimeout(timer);
    timer = setTimeout(callback, ms);
  }
}();

const popupContainer = document.querySelector('#popup-container');

function sendPopup(type, message) {
  const popup = createElement('div', {class: `popup popup-${type}`});
  popupContainer.appendChild(popup);

  const popupMessage = createElement('div', {class: 'popup-message'}, message, true);
  popup.appendChild(popupMessage);

  popup.onclick = () => fadeOut(popup);

  setTimeout(() => {
    if (popup) fadeOut(popup);
  }, 5000);

  function fadeOut(element) {
    const fadeEffect = setInterval(() => {
      if (popupContainer.contains(element)) {
        if (!element.style.opacity) {
          element.style.opacity = 0.8;
        }
        if (element.style.opacity > 0) {
          element.style.opacity -= 0.1;
        } else {
          clearInterval(fadeEffect);
          popupContainer.removeChild(element);
        }
      } else {
        clearInterval(fadeEffect);
      }
    }, 30);
  }
}

class Slider {
  constructor(textElement, sliderElement) {
    this.textElement = textElement;
    this.sliderElement = sliderElement;

    this.register();
  }

  set value(value) {
    this.sliderElement.value = value;
  }

  setText(value) {
    this.textElement.innerText = value;
  }

  get value() {
    return parseInt(this.sliderElement.value);
  }

  register() {
    this.sliderElement.oninput = () => this.setText(this.sliderElement.value);
  }
}

const createPasswordForm = contentCreatePassword.querySelector('form');
const createPasswordSliderText = contentCreatePassword.querySelector('.slider-text');

const createPasswordSlider = new Slider(createPasswordSliderText, createPasswordForm.slider);

function resetCreatePasswordsValues() {
  createPasswordForm.name.value = '';
  setInputIcon(createPasswordForm.name, 'none');

  createPasswordForm.platform.value = '';
  setInputIcon(createPasswordForm.platform, 'none');

  createPasswordForm.url.value = '';
  setInputIcon(createPasswordForm.url, 'none');

  createPasswordForm.username.value = '';
  setInputIcon(createPasswordForm.username, 'none');

  createPasswordForm.email.value = '';
  setInputIcon(createPasswordForm.email, 'none');

  createPasswordForm.description.value = '';
  setInputIcon(createPasswordForm.description, 'none');

  createPasswordForm.checkBoxLetters.checked = 'true';
  createPasswordForm.checkBoxNumbers.checked = 'true';
  createPasswordForm.checkBoxSymbols.checked = 'true';

  createPasswordForm.symbols.value = localStorage.getItem('symbols');

  createPasswordSlider.setText(config.password.password.default);
  createPasswordSlider.value = config.password.password.default;

  createPasswordForm.submit.value = 'create password';
}

const reg = /^([A-Za-z0-9_\-\.])+\@([A-Za-z0-9_\-\.])+\.([A-Za-z]{2,4})$/;

function isAccountDataAvailable(element, oldData, event, min, max, callback) {
  if (event) {
    element.oninput = () => {
      check(element, oldData, min, max, (callbackCheck) => {
        if (!callbackCheck) return;

        delay(function() {
          check(element, oldData, min, max, (callbackCheck) => {
            if (!callbackCheck) return;

            request(element);
          });
        }, 500);
      });
    };
  } else {
    check(element, oldData, min, max, (callbackCheck) => {
      if (!callbackCheck) return callback(false);

      request(element, (callbackRequest) => callback(callbackRequest));
    });
  }

  function check(element, oldData, min, max, callback) {
    if (element.value.length >= min && element.value.length <= max) {
      if (element.type === 'email' && !reg.test(element.value)) {
        setInputIcon(element, 'cross');
        callback(false);
        return;
      }
  
      if (oldData && element.value === oldData) {
        setInputIcon(element, 'none');
        callback(false);
        return;
      }
  
      setInputIcon(element, 'loading');
      callback(true);
    } else {
      setInputIcon(element, 'cross');
      callback(false);
    }
  }

  function request(element, callback) {
    fetch('account/check', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: element.value.includes('@') ? `email=${element.value.toLowerCase()}` : `username=${element.value}`,
    })
    .then(response => response.json())
    .then(result => {
      result.available ? setInputIcon(element, 'check') : setInputIcon(element, 'cross');

      if (callback) callback(result.available);
    });
  }
}

function checkInputValidation(element, min, max) {
  element.oninput = () => {
    if (element.value.length == 0) {
      setInputIcon(element, 'none');
    } else if (element.type === 'email') {
      if (reg.test(element.value) == false) {
        setInputIcon(element, 'cross');
      } else if (element.value.length >= min && element.value.length <= max) {
        isAccountDataAvailable(element, undefined, false, min, max);
      } else {
        setInputIcon(element, 'cross');
      }
    } else if (element.value.length >= min && element.value.length <= max) {
      setInputIcon(element, 'check');
    } else {
      setInputIcon(element, 'cross');
    }
  };
}

function initCreatePassword()  {
  createPasswordForm.name.setAttribute('minlength', config.password.name.min);
  createPasswordForm.name.setAttribute('maxlength', config.password.name.max);
  createPasswordForm.platform.setAttribute('minlength', config.password.platform.min);
  createPasswordForm.platform.setAttribute('maxlength', config.password.platform.max);
  createPasswordForm.url.setAttribute('minlength', config.password.url.min);
  createPasswordForm.url.setAttribute('maxlength', config.password.url.max);
  createPasswordForm.username.setAttribute('minlength', config.password.username.min);
  createPasswordForm.username.setAttribute('maxlength', config.password.username.max);
  createPasswordForm.email.setAttribute('minlength', config.password.email.min);
  createPasswordForm.email.setAttribute('maxlength', config.password.email.max);
  createPasswordForm.description.setAttribute('minlength', config.password.description.min);
  createPasswordForm.description.setAttribute('maxlength', config.password.description.max);
  createPasswordForm.symbols.setAttribute('minlength', config.symbols.min);
  createPasswordForm.symbols.setAttribute('maxlength', config.symbols.max);
  createPasswordForm.slider.setAttribute('min', config.password.password.min);
  createPasswordForm.slider.setAttribute('max', config.password.password.max);

  isPasswordNameAvailableEvent(createPasswordForm.name, config.password.name.min, config.password.name.max);
  checkInputValidation(createPasswordForm.platform, config.password.platform.min, config.password.platform.max);
  checkInputValidation(createPasswordForm.url, config.password.url.min, config.password.url.max);
  checkInputValidation(createPasswordForm.username, config.password.username.min, config.password.username.max);
  checkInputValidation(createPasswordForm.email, config.password.email.min, config.password.email.max);
  checkInputValidation(createPasswordForm.description, config.password.description.min, config.password.description.max);
}

createPasswordForm.onsubmit = (event) => {
  event.preventDefault();

  if (!createPasswordForm.name.value || !createPasswordForm.name.value.replace(/\s/g, '').length || createPasswordForm.name.value.length < config.password.name.min || createPasswordForm.name.value.length > config.password.name.max) {
    sendPopup('error', config.messages.password.typeNotValid.replace('%type%', createPasswordForm.name.value));
    return;
  }

  const nameAvailable = isPasswordNameAvailable(createPasswordForm.name.value);

  if (!nameAvailable) {
    sendPopup('error', config.messages.password.nameNotAvailable.replace('%name%', createPasswordForm.name.value));
    return;
  }

  if (createPasswordForm.platform.value.length !== 0 && createPasswordForm.platform.value.length < config.password.platform.min || createPasswordForm.platform.value.length > config.password.platform.max) {
    sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Platform'));
    return;
  }

  if (createPasswordForm.url.value.length !== 0 && createPasswordForm.url.value.length < config.password.url.min || createPasswordForm.url.value.length > config.password.url.max) {
    sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Url'));
    return;
  }

  if (createPasswordForm.username.value.length !== 0 && createPasswordForm.username.value.length < config.password.username.min || createPasswordForm.username.value.length > config.password.username.max) {
    sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Username'));
    return;
  }

  if (createPasswordForm.email.value.length !== 0 && createPasswordForm.email.value.length < config.password.email.min || createPasswordForm.email.value.length > config.password.email.max) {
    sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Email'));
    return;
  }

  if (createPasswordForm.description.value.length !== 0 && createPasswordForm.description.value.length < config.password.description.min || createPasswordForm.description.value.length > config.password.description.max) {
    sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Description'));
    return;
  }

  if (createPasswordForm.slider.value < config.password.password.min || createPasswordForm.slider.value > config.password.password.max) {
    sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Password length'));
    return;
  }

  try {
    const key = getKey();

    const generatedPassword = generatePassword({
        letters: createPasswordForm.checkBoxLetters.checked, 
        numbers: createPasswordForm.checkBoxNumbers.checked, 
        symbols: createPasswordForm.checkBoxSymbols.checked
      }, createPasswordForm.symbols.value, createPasswordSlider.value);

    const password = {
      type: 0,
      id: generateUniquePasswordId(),
      name: CryptoJS.AES.encrypt(createPasswordForm.name.value, key).toString(),
      password: CryptoJS.AES.encrypt(generatedPassword, key).toString(),
      platform: createPasswordForm.platform.value === '' ? undefined : CryptoJS.AES.encrypt(createPasswordForm.platform.value, key).toString(),
      url: createPasswordForm.url.value === '' ? undefined : CryptoJS.AES.encrypt(createPasswordForm.url.value, key).toString(),
      username: createPasswordForm.username.value === '' ? undefined : CryptoJS.AES.encrypt(createPasswordForm.username.value, key).toString(),
      email: createPasswordForm.email.value === '' ? undefined : CryptoJS.AES.encrypt(createPasswordForm.email.value, key).toString(),
      description: createPasswordForm.description.value === '' ? undefined : CryptoJS.AES.encrypt(createPasswordForm.description.value, key).toString(),
      createdAt: CryptoJS.AES.encrypt(Date.now().toString(), key).toString()
    };

    if (passwordsMap.size >= myAccount.passwordLimit) {
      sendPopup('error', config.messages.account.passwordLimitReached);
      return;
    }
  
    fetch(`password/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(password),
    })
    .then(response => response.json())
    .then(result => {
      if (result.logout) {
        window.location.href = result.logout;
        return; 
      }
  
      sendPopup('success', config.messages.password.created.replace('%name%', createPasswordForm.name.value));
      changeContentTo(1);
    })
    .catch(error => console.error(error));
  } catch (error) {
    console.error(error);
    sendPopup('error', 'Error');
    return;
  }
};

class Search {
  constructor(element, maxLength, collapsible, collapsibleBody) {
    this.element = element;
    this.maxLength = maxLength;
    this.collapsible = collapsible;
    this.collapsibleBody = collapsibleBody;

    this.register();
  }

  clear() {
    this.element.value = '';
  }

  clearAndReload() {
    this.clear();

    for (let i = 0; i < this.collapsible.length; i++) {
      this.collapsible[i].style.display = '';
      this.collapsibleBody[i].style.display = '';
    }
  }

  setMaxLength(value) {
    this.maxLength = value;
    this.element.setAttribute('maxlength', value);
  }

  register() {
    this.element.setAttribute('maxlength', this.maxLength);

    this.element.oninput = () => {
      const searchValue = this.element.value.toLowerCase();

      if (searchValue === '') {
        for (let i = 0; i < this.collapsible.length; i++) {
          this.collapsible[i].style.display = '';
          this.collapsibleBody[i].style.display = '';
        }
        return;
      }

      const characters = splitCharacters(searchValue);
      let show = false;

      for (let i = 0; i < this.collapsible.length; i++) {
        let textValue = this.collapsible[i].textContent.toLowerCase();

        for (const character of characters) {
          if (textValue.indexOf(character) > -1) {
            show = true;
          } else {
            show = false;
            break;
          }
        }

        if (show) {
          this.collapsible[i].style.display = '';
          this.collapsibleBody[i].style.display = '';
        } else {
          this.collapsible[i].style.display = 'none';     
          this.collapsibleBody[i].style.display = 'none';
        }
      }

      function splitCharacters(text) {
        const list = [];

        for (let i = 0; i < text.length; i++) {
          list.push(text.substr(i, 1));
        }

        return list;
      }
    };
  
    this.element.nextElementSibling.onclick = () => this.clearAndReload();
  }
}

function createElement(tag, attributes, text, html) {
  let element = document.createElement(tag), attributeName, styleName;
  if (attributes) {
    for (attributeName in attributes) {
      if (attributeName === 'style') {
        for (styleName in attributes.style) {
          element.style[styleName] = attributes.style[styleName];
        }
      } else {
        element.setAttribute(attributeName, attributes[attributeName]);
      }
    }
  }
  if (text) {
    html ? element.innerHTML = text : element.innerText = text;
  }
  return element;
}

let modalPasswordEdit = undefined;
let modalPasswordEditSlider = undefined;

function initModalPasswordEdit()  {
  if (!modalPasswordEdit) {
    modalPasswordEdit = new ModalPasswordEdit(
      contentPasswords.querySelector('.modal'),
      contentPasswords.querySelector('.modal-header .title'),
      contentPasswords.querySelector('.modal-header #icon-close'),
      contentPasswords.querySelector('.modal-body form'),
      contentPasswords.querySelector('.modal-body #icon-showpassword'),
      contentPasswords.querySelector('.modal-body .icon-generatenewpassword'),
      contentPasswords.querySelector('.modal-body .slider-text'),
      contentPasswords.querySelector('.modal-body .generatenewpassword-container'),
      contentPasswords.querySelector('.modal-body .password-histories'),
      contentPasswords.querySelector('.modal-body .button-delete'),
      contentPasswords.querySelector('.modal-body .button-save')
    );
  } else {
    modalPasswordEdit.init();
  }
}

class ModalPasswordEdit {
  constructor(modal, headerTitle, headerIconClose, form, iconShowPassword, 
      iconGenerateNewPassword, sliderText, generateNewPasswordContainer, passwordHistories, buttonDelete, buttonSave) {
    this.modal = modal;
    this.headerTitle = headerTitle;
    this.headerIconClose = headerIconClose;
    this.form = form;
    this.iconShowPassword = iconShowPassword;
    this.iconGenerateNewPassword = iconGenerateNewPassword;
    this.sliderText = sliderText;
    this.generateNewPasswordContainer = generateNewPasswordContainer;
    this.passwordHistories = passwordHistories;
    this.buttonDelete = buttonDelete;
    this.buttonSave = buttonSave;
    this.slider = undefined;

    this.register();
  }

  open() {
    addClassName(this.modal, 'active');
  }

  close() {
    removeClassName(this.modal, 'active');
  }

  setHeaderTitle(title) {
    this.headerTitle.innerHTML = title;
  }

  getModal() {
    return this.modal;
  }

  register() {
    this.headerIconClose.onclick = () => removeClassName(this.modal, 'active');

    this.init();

    this.iconGenerateNewPassword.onclick = () => toggleClassName(this.generateNewPasswordContainer, 'active');

    this.form.buttonGenerate.onclick = () => {
      this.form.password.value = generatePassword({
        letters: this.form.checkBoxLetters.checked,
        numbers: this.form.checkBoxNumbers.checked,
        symbols: this.form.checkBoxSymbols.checked,
      }, this.form.symbols.value, this.slider.value);
    };

    this.iconShowPassword.onclick = () => {
      if (containsClassName(this.iconShowPassword, 'fa-eye')) {
        this.iconShowPassword.setAttribute('class', 'fa fa-eye-slash');
        this.form.password.setAttribute('type', 'text');
        return;
      }
      this.iconShowPassword.setAttribute('class', 'fa fa-eye');
      this.form.password.setAttribute('type', 'password');
    };
  }

  init() {
    if (!Password.getPassword(this.headerTitle.innerText.split(' #')[1])) this.close();

    this.form.name.setAttribute('minlength', config.password.name.min);
    this.form.name.setAttribute('maxlength', config.password.name.max);
    this.form.platform.setAttribute('minlength', config.password.platform.min);
    this.form.platform.setAttribute('maxlength', config.password.platform.max);
    this.form.url.setAttribute('minlength', config.password.url.min);
    this.form.url.setAttribute('maxlength', config.password.url.max);
    this.form.username.setAttribute('minlength', config.password.username.min);
    this.form.username.setAttribute('maxlength', config.password.username.max);
    this.form.email.setAttribute('minlength', config.password.email.min);
    this.form.email.setAttribute('maxlength', config.password.email.max);
    this.form.description.setAttribute('minlength', config.password.description.min);
    this.form.description.setAttribute('maxlength', config.password.description.max);
    this.form.password.setAttribute('minlength', config.password.password.min);
    this.form.password.setAttribute('maxlength', config.password.password.max);
    this.form.slider.setAttribute('min', config.password.password.min);
    this.form.slider.setAttribute('max', config.password.password.max);
    
    if (!this.slider) {
      this.slider = new Slider(this.sliderText, this.form.slider);
    }
    
    this.slider.setText(config.password.password.default);
    this.slider.value = config.password.password.default;

    checkInputValidation(this.form.platform, config.password.platform.min, config.password.platform.max);
    checkInputValidation(this.form.url, config.password.url.min, config.password.url.max);
    checkInputValidation(this.form.username, config.password.username.min, config.password.username.max);
    checkInputValidation(this.form.email, config.password.email.min, config.password.email.max);
    checkInputValidation(this.form.description, config.password.description.min, config.password.description.max);
  }

  reset() {
    setInputIcon(this.form.name, 'none');
    setInputIcon(this.form.platform, 'none');
    setInputIcon(this.form.url, 'none');
    setInputIcon(this.form.username, 'none');
    setInputIcon(this.form.email, 'none');
    setInputIcon(this.form.description, 'none');

    this.form.password.boxShadow = 'none';

    removeClassName(this.generateNewPasswordContainer, 'active');
    this.form.checkBoxLetters.checked = true;
    this.form.checkBoxNumbers.checked = true;
    this.form.checkBoxSymbols.checked = true;
    this.form.symbols.value = localStorage.getItem('symbols');
    this.slider.setText(config.password.password.default);
    this.slider.value = config.password.password.default;

    this.iconShowPassword.setAttribute('class', 'fa fa-eye');
    this.form.password.setAttribute('type', 'password');

    const oldHistories = this.passwordHistories.querySelectorAll('.password-history');
    for (const oldHistory of oldHistories) {
      oldHistory.remove();
    }

    this.buttonDelete.value = 'delete';
    this.buttonSave.value = 'save';
  }

  build(password) {
    this.reset();

    this.setHeaderTitle(`${password.name} <span style="color: #d1d1d1">#</span>${password.id}`);
    
    this.form.name.oninput = () => {
      if (this.form.name.value === password.name) {
        setInputIcon(this.form.name, 'none');
        return;
      }

      const nameAvailable = isPasswordNameAvailable(this.form.name.value);
    
      if (this.form.name.value === password.name) {
        setInputIcon(this.form.name, 'none');
        return;
      }
      if (!nameAvailable || !this.form.name.value.replace(/\s/g, '').length || this.form.name.value.length < config.password.name.min || this.form.name.value.length > config.password.name.max) {
        setInputIcon(this.form.name, 'cross');
        return;
      }

      setInputIcon(this.form.name, 'check');
    };

    password.name === undefined ? this.form.name.value = '' : this.form.name.value = password.name;
    password.platform === undefined ? this.form.platform.value = '' : this.form.platform.value = password.platform;
    password.url === undefined ? this.form.url.value = '' : this.form.url.value = password.url;
    password.username === undefined ? this.form.username.value = '' : this.form.username.value = password.username;
    password.email === undefined ? this.form.email.value = '' : this.form.email.value = password.email;
    password.description === undefined ? this.form.description.value = '' : this.form.description.value = password.description;
    password.password === undefined ? this.form.password.value = '' : this.form.password.value = password.password; 

    this.form.description.style.height = '40px';

    if (password.histories.length != 0) {
      addClassName(this.passwordHistories, 'active');
  
      for (const history of password.histories) {
        const passwordHistory = createElement('div', {class: 'password-history'});
        this.passwordHistories.appendChild(passwordHistory);

        const popup = createElement('div', {class: 'popup'});
        passwordHistory.appendChild(popup);

        const popupText = createElement('p', {class: 'popup-text'}, `<b>Password from:</b> <br> <span style="color: ${config.colors.deletedAt}">${getFullTime(history.deletedAt)}</span>`, true);
        popup.appendChild(popupText);

        const p = document.createElement('p');
        popup.appendChild(p);

        const passwd = createElement('span', {id: `password-${history.id}`}, '••••••••••••••••');
        p.appendChild(passwd);

        passwd.onmouseover = () => popupText.style.visibility = 'visible';
        passwd.onmouseleave = () => popupText.style.visibility = 'hidden';

        const iconDiv = document.createElement('div');
        passwordHistory.appendChild(iconDiv);

        const iconEye = createElement('i', {id: `password-show-${history.id}`, class: 'fa fa-eye', 'aria-hidden': 'true' });
        iconDiv.appendChild(iconEye);

        iconEye.onclick = () => {
          if (containsClassName(iconEye, 'fa-eye')) {
            removeClassName(iconEye, 'fa-eye');
            addClassName(iconEye, 'fa-eye-slash');
            passwd.innerText = history.password;
          } else {
            removeClassName(iconEye, 'fa-eye-slash');
            addClassName(iconEye, 'fa-eye');
            passwd.innerText = '••••••••••••••••';
          }
        };

        const iconTrash = createElement('i', {id: `password-trash-${history.id}`, class: 'fa fa-trash', 'aria-hidden': 'true' });
        iconDiv.appendChild(iconTrash);

        iconTrash.onclick = () => containsClassName(iconTrash, 'delete') ? removeClassName(iconTrash, 'delete') : addClassName(iconTrash, 'delete');
      }
    } else {
      removeClassName(this.passwordHistories, 'active');
    }

    this.buttonDelete.onclick = () => {
      this.form.onsubmit = (event) => {
        event.preventDefault();

        this.delete(password);
      };
    };

    this.buttonSave.onclick = () => {
      this.form.onsubmit = (event) => {
        event.preventDefault();

        this.save(password);
      };
    };

    this.open();
  }

  delete(password) {
    if (this.buttonDelete.value === 'delete') {
      this.buttonDelete.value = 'sure?';
      return;
    }

    if (this.buttonDelete.value === 'sure?') {
      modalPasswordEdit.close();

      const key = getKey();
      const timestamp = Date.now().toString();
      const hash = CryptoJS.AES.encrypt(timestamp, key).toString();

      console.log('del', hash)

      fetch(`password/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify({passwordId: password.id, deletedAt: hash})
      })
      .then(response => response.json())
      .then(result => {
        if (result.logout) {
          window.location.href = result.logout;
          return; 
        }

        if (passwordsMap.size === 0) showNoPasswordsMessage(true);

        sendPopup('success', config.messages.password.deleted.replace('%name%', password.name));
      });
    }
  }

  save(password) {
    if (this.buttonSave.value === 'save') {
      this.buttonSave.value = 'sure?';
      return;
    }
  
    if (this.buttonSave.value === 'sure?') {
      let update = true;

      if (this.form.name.value === password.name 
          && this.form.platform.value == password.platform
          && this.form.url.value === password.url
          && this.form.username.value === password.username
          && this.form.email.value === password.email
          && this.form.description.value === password.description
          && this.form.password.value === password.password) {

        const found = password.histories.find(history => containsClassName(contentPasswords.querySelector(`#password-trash-${history.id}`), 'delete'));

        found === undefined ? update = false : update = true;
      }

      if (!update) {
        modalPasswordEdit.close();
        sendPopup('success', config.messages.password.updated.replace('%name%', this.form.name.value));
        return;
      }

      if (this.form.name.value !== password.name) {
        if (!this.form.name.value || !this.form.name.value.replace(/\s/g, '').length || this.form.name.value.length < config.password.name.min || this.form.name.value.length > config.password.name.max) {
          sendPopup('error', config.messages.password.typeNotValid.replace('%type%', this.form.name.value));
          return;
        }
      
        const nameAvailable = isPasswordNameAvailable(this.form.name.value);
      
        if (!nameAvailable) {
          sendPopup('error', config.messages.password.nameNotAvailable.replace('%name%', this.form.name.value));
          return;
        }
      }
    
      if (this.form.platform.value.length !== 0 && this.form.platform.value.length < config.password.platform.min || this.form.platform.value.length > config.password.platform.max) {
        sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Platform'));
        return;
      }
    
      if (this.form.url.value.length !== 0 && this.form.url.value.length < config.password.url.min || this.form.url.value.length > config.password.url.max) {
        sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Url'));
        return;
      }
    
      if (this.form.username.value.length !== 0 && this.form.username.value.length < config.password.username.min || this.form.username.value.length > config.password.username.max) {
        sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Username'));
        return;
      }
    
      if (this.form.email.value.length !== 0 && this.form.email.value.length < config.password.email.min || this.form.email.value.length > config.password.email.max) {
        sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Email'));
        return;
      }
    
      if (this.form.description.value.length !== 0 && this.form.description.value.length < config.password.description.min || this.form.description.value.length > config.password.description.max) {
        sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Description'));
        return;
      }

      if (this.form.password.value.length !== 0 && this.form.password.value.length < config.password.password.min || this.form.password.value.length > config.password.password.max) {
        sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Password'));
        return;
      }
    
      if (this.form.slider.value < config.password.password.min || this.form.slider.value > config.password.password.max) {
        sendPopup('error', config.messages.password.typeNotValid.replace('%type%', 'Password length'));
        return;
      }

      const key = getKey();
      const timestamp = Date.now().toString();

      const updatedPassword = {
        id: password.id,
        histories: password.histories,
        name: this.form.name.value === '' ? undefined : CryptoJS.AES.encrypt(this.form.name.value, key).toString(),
        platform: this.form.platform.value === '' ? undefined : CryptoJS.AES.encrypt(this.form.platform.value, key).toString(),
        url: this.form.url.value === '' ? undefined : CryptoJS.AES.encrypt(this.form.url.value, key).toString(),
        username: this.form.username.value === '' ? undefined : CryptoJS.AES.encrypt(this.form.username.value, key).toString(),
        email: this.form.email.value === '' ? undefined : CryptoJS.AES.encrypt(this.form.email.value, key).toString(),
        description: this.form.description.value === '' ? undefined : CryptoJS.AES.encrypt(this.form.description.value, key).toString(),
        modifiedAt: CryptoJS.AES.encrypt(timestamp, key).toString()
      };

      for (const history of updatedPassword.histories) {
        const deleteHistory = contentPasswords.querySelector(`#password-trash-${history.id}`);

        if (containsClassName(deleteHistory, 'delete')) {
          updatedPassword.histories = updatedPassword.histories.filter(newHistory => newHistory.id != history.id);
        }
      }

      if (password.password !== this.form.password.value) {
        const newHistory = {
          id: generateUniqueHistoryId(),
          password: password.password,
          deletedAt: timestamp
        };

        updatedPassword.password = CryptoJS.AES.encrypt(this.form.password.value, key).toString();
        updatedPassword.histories.push(newHistory);
      } else {
        updatedPassword.password = CryptoJS.AES.encrypt(password.password, key).toString();
      }

      const encryptedHistories = [];

      for (const history of updatedPassword.histories) {
        const encryptedHistory = {
          id: history.id,
          password: CryptoJS.AES.encrypt(history.password, key).toString(),
          deletedAt: CryptoJS.AES.encrypt(history.deletedAt, key).toString()
        };

        encryptedHistories.push(encryptedHistory);
      }

      updatedPassword.histories = encryptedHistories;
      modalPasswordEdit.close();

      fetch(`password/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: JSON.stringify(updatedPassword)
      })
      .then(response => response.json())
      .then(result => {
        if (result.logout) {
          window.location.href = result.logout;
          return; 
        }

        sendPopup('success', config.messages.password.updated.replace('%name%', this.form.name.value));
      })
      .catch(error => console.error(error));
    }
  }
}

let passwordSearch = undefined;

function initPasswordSearch() {
  if (!passwordSearch) {
    passwordSearch = new Search(
      contentPasswords.querySelector('#search-password'),
      config.password.name.max,
      contentPasswords.getElementsByClassName('collapsible'),
      contentPasswords.getElementsByClassName('collapsible-body'));
  } else {
    passwordSearch.setMaxLength(config.password.name.max);
  }
}

let passwordsMap = new Map();

function generatePassword(options, symbols, length) {
  let string = '';
    
  if (options.letters) string += 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz';
  if (options.numbers) string += '0123456789';
  if (options.symbols) string += symbols;

  if (!options.letters && !options.numbers && !options.symbols) {
    string += 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123457890';
  }
  
  let generatedPassword = '';

  for (let i = 0; i < length; i++) {
    generatedPassword += string[Math.floor(Math.random() * string.length)];
  }

  return generatedPassword;
}

function generateUniquePasswordId() {
  const string = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789';
  let unique = false;
  let n = 8;

  while (!unique) {
    let uniqueId = '';

    for (let i = 0; i < n; i++) {
      uniqueId += string[Math.floor(Math.random() * string.length)];
    }

    const available = isPasswordIdAvailable(unique);

    if (available) {
      unique = true;
      return uniqueId;
    } else {
      n++;
    }
  }
}

function generateUniqueHistoryId() {
  const string = 'AaBbCcDdEeFfGgHhIiJjKkLlMmNnOoPpQqRrSsTtUuVvWwXxYyZz0123456789';
  let unique = false;
  let n = 8;

  while (!unique) {
    let uniqueId = '';

    for (let i = 0; i < n; i++) {
      uniqueId += string[Math.floor(Math.random() * string.length)];
    }

    const available = isHistoryIdAvailable(unique);

    if (available) {
      unique = true;
      return uniqueId;
    } else {
      n++;
    }
  }
}

function isPasswordNameAvailableEvent(element, min, max) {
  element.oninput = () => {
    setInputIcon(element, 'loading');
    if (element.value && element.value.length >= min && element.value.length <= max) {
      if (passwordsMap.size === 0) {
        setInputIcon(element, 'check');
      } else {
        for (const password of passwordsMap) {
          if (password[1].name === element.value) {
            setInputIcon(element, 'cross');
            return
          }
          setInputIcon(element, 'check');
        }
      }
    } else {
      setInputIcon(element, 'cross');
    }
  };
}

function isPasswordNameAvailable(value) {
  for (const password of passwordsMap) {
    if (password[1].name === value) {
      return false;
    }
  }
  return true;
}

function isPasswordIdAvailable(id) {
  for (const password of passwordsMap) {
    if (password[1].id === id) {
      return false;
    }
  }
  return true;
}

function isHistoryIdAvailable(id) {
  for (const password of passwordsMap) {
    for (const history of password[1].histories) {
      if (history.id === id) {
        return false;
      }
    }
  }
  return true;
}

function copyToClipboard(text, clearBool) {
  let textarea = document.createElement('textarea');
  document.body.appendChild(textarea);
  textarea.value = text;
  textarea.select();
  document.execCommand('copy');
  document.body.removeChild(textarea);

  sendPopup('success', 'Copied');
}

let lastOpenCollapsible = undefined;

class Password {
  constructor(password) {
    this.id = password.id;
    this.name = password.name;
    this.password = password.password;
    this.histories = password.histories;
    this.platform = password.platform;
    this.url = password.url;
    this.username = password.username;
    this.email = password.email;
    this.description = password.description;
    this.createdAt = password.createdAt;
    this.modifiedAt = password.modifiedAt;

    passwordsMap.set(this.id, this);
    this.build();
  }

  build() {
    const collapsible = createElement('button', {class: 'collapsible', 'data-id': this.id});
    contentPasswords.appendChild(collapsible);

    collapsible.appendChild(createElement('p', {'data-name-id': this.id}, this.name));

    const iconSettings = createElement('i', {class: 'fa fa-cog', 'aria-hidden': 'true'});
    collapsible.appendChild(iconSettings);

    iconSettings.onclick = () => modalPasswordEdit.build(this);

    const collapsibleBody = createElement('div', {class: 'collapsible-body'});
    contentPasswords.appendChild(collapsibleBody);

    this.buildPassword(collapsibleBody);
    this.buildHistories(collapsibleBody);
    this.buildPlatform(collapsibleBody);
    this.buildUrl(collapsibleBody);
    this.buildUsername(collapsibleBody);
    this.buildEmail(collapsibleBody);
    this.buildDescription(collapsibleBody);
    this.buildCreatedAt(collapsibleBody);
    this.buildModifiedAt(collapsibleBody);
  }

  buildPassword(collapsibleBody) {
    collapsibleBody.appendChild(createElement('h4', {}, 'Password:'));

    const spaceBetween = createElement('div', {class: 'space-between' });
    collapsibleBody.appendChild(spaceBetween);
    
    const password = createElement('p', {'data-password-id': this.id}, '••••••••••••••••');
    spaceBetween.appendChild(password);

    const iconDiv = document.createElement('div');
    spaceBetween.appendChild(iconDiv);
    
    const iconEye = createElement('i', {id: `password-show-${this.id}`, class: 'fa fa-eye', 'aria-hidden': 'true'});
    iconDiv.appendChild(iconEye);

    iconEye.onclick = () => {
      if (containsClassName(iconEye, 'fa-eye')) {
        removeClassName(iconEye, 'fa-eye');
        addClassName(iconEye, 'fa-eye-slash');
        password.innerText = this.password;
        this.setCollapsibleBodyHeight();
      } else {
        removeClassName(iconEye, 'fa-eye-slash');
        addClassName(iconEye, 'fa-eye');
        password.innerText = '••••••••••••••••';
      }
    };

    const iconCopy = createElement('i', {class: 'far fa-copy', 'aria-hidden': 'true'});
    iconDiv.appendChild(iconCopy);

    iconCopy.onclick = () => copyToClipboard(this.password, true);
  }

  buildHistories(collapsibleBody) {
    const divHistory = createElement('div', {id: `show-history-${this.id}`, class: 'content-show'});

    if (this.histories.length !== 0) {
      addClassName(divHistory, 'active');
    }

    collapsibleBody.appendChild(divHistory);
    divHistory.appendChild(createElement('h4', {}, `Password histories:`));

    for (const history of this.histories) {
      this.buildHistory(divHistory, history);
    }
  }

  buildHistory(element, history) {
    const passwordHistory = createElement('div', {id: `password-history-${history.id}`, class: 'password-history'});
    element.appendChild(passwordHistory);

    const popup = createElement('div', {class: 'popup'});
    passwordHistory.appendChild(popup);

    const popupText = createElement('p', {class: 'popup-text' }, `<b>Password from:</b> \n <span style="color: ${config.colors.deletedAt}">${getFullTime(history.deletedAt)}</span>`, true);
    popup.appendChild(popupText);

    const p = document.createElement('p');
    popup.appendChild(p);

    const passwd = createElement('span', {'data-history-id': history.id}, '••••••••••••••••');
    p.appendChild(passwd);

    passwd.onmouseover = () => popupText.style.visibility = 'visible';
    passwd.onmouseleave = () => popupText.style.visibility = 'hidden';

    const icons = document.createElement('div');
    passwordHistory.appendChild(icons);

    const iconEye = createElement('i', {id: `history-show-${history.id}`, class: 'fa fa-eye', 'aria-hidden': 'true'});
    icons.appendChild(iconEye);

    iconEye.onclick = () => {
      if (containsClassName(iconEye, 'fa-eye')) {
        removeClassName(iconEye, 'fa-eye');
        addClassName(iconEye, 'fa-eye-slash');
        passwd.innerText = history.password;
        this.setCollapsibleBodyHeight();
      } else {
        removeClassName(iconEye, 'fa-eye-slash');
        addClassName(iconEye, 'fa-eye');
        passwd.innerText = '••••••••••••••••';
      }
    };

    const iconCopy = createElement('i', {class: 'far fa-copy', 'aria-hidden': 'true'});
    icons.appendChild(iconCopy);

    iconCopy.onclick = () => copyToClipboard(history.password, true);
  }

  buildPlatform(collapsibleBody) {
    const divPlatform = createElement('div', {id: `show-platform-${this.id}`, class: 'content-show'});

    if (this.platform) {
      addClassName(divPlatform, 'active');
    }

    collapsibleBody.appendChild(divPlatform);
    divPlatform.appendChild(createElement('h4', {}, 'Platform:'));

    const spaceBetween = createElement('div', {class: 'space-between'});
    divPlatform.appendChild(spaceBetween);

    spaceBetween.appendChild(createElement('p', {'data-platform-id': this.id}, this.platform));

    const iconCopy = createElement('i', {class: 'far fa-copy', 'aria-hidden': 'true'});
    spaceBetween.appendChild(iconCopy);

    iconCopy.onclick = () => copyToClipboard(this.platform, true);
  }

  buildUrl(collapsibleBody) {
    const divUrl = createElement('div', {id: `show-url-${this.id}`, class: 'content-show'});

    if (this.url) {
      addClassName(divUrl, 'active');
    }
    
    collapsibleBody.appendChild(divUrl);
    divUrl.appendChild(createElement('h4', {}, 'Url:'));

    const spaceBetween = createElement('div', {class: 'space-between'});
    divUrl.appendChild(spaceBetween);

    spaceBetween.appendChild(createElement('a', {'data-url-id': this.id, href: formatUrl(this.url), target: '_blank'}, this.url));

    const iconCopy = createElement('i', {class: 'far fa-copy', 'aria-hidden': 'true'});
    spaceBetween.appendChild(iconCopy);

    iconCopy.onclick = () => copyToClipboard(this.url, true);
  }

  buildUsername(collapsibleBody) {
    const divUsername = createElement('div', {id: `show-username-${this.id}`, class: 'content-show'});

    if (this.username) {
      addClassName(divUsername, 'active');
    }
    
    collapsibleBody.appendChild(divUsername);
    divUsername.appendChild(createElement('h4', {}, 'Username:'));

    const spaceBetween = createElement('div', {class: 'space-between'});
    divUsername.appendChild(spaceBetween);

    spaceBetween.appendChild(createElement('p', {'data-username-id': this.id}, this.username));

    const iconCopy = createElement('i', {class: 'far fa-copy', 'aria-hidden': 'true'});
    spaceBetween.appendChild(iconCopy);

    iconCopy.onclick = () => copyToClipboard(this.username, true);
  }

  buildEmail(collapsibleBody) {
    const divEmail = createElement('div', {id: `show-email-${this.id}`, class: 'content-show'});

    if (this.email) {
      addClassName(divEmail, 'active');
    }
    
    collapsibleBody.appendChild(divEmail);
    divEmail.appendChild(createElement('h4', {}, 'Email:'));

    const spaceBetween = createElement('div', {class: 'space-between' });
    divEmail.appendChild(spaceBetween);

    spaceBetween.appendChild(createElement('p', {'data-email-id': this.id}, this.email));

    const iconCopy = createElement('i', {class: 'far fa-copy', 'aria-hidden': 'true' });
    spaceBetween.appendChild(iconCopy);

    iconCopy.onclick = () => copyToClipboard(this.email, true);
  }

  buildDescription(collapsibleBody) {
    const divDescription = createElement('div', {id: `show-description-${this.id}`, class: 'content-show'});

    if (this.description) {
      addClassName(divDescription, 'active');
    }
    
    collapsibleBody.appendChild(divDescription);

    divDescription.appendChild(createElement('h4', {}, 'Description:'));
    divDescription.appendChild(createElement('p', {'data-description-id': this.id}, this.description));
  }

  buildCreatedAt(collapsibleBody) {
    const divCreatedAt = createElement('div', {id: `show-createdat-${this.id}`, class: 'content-show'});

    if (this.createdAt) {
      addClassName(divCreatedAt, 'active');
    }
    
    collapsibleBody.appendChild(divCreatedAt);

    divCreatedAt.appendChild(createElement('h4', {}, 'Created at:'));
    divCreatedAt.appendChild(createElement('p', {style: {color: config.colors.createdAt}}, getFullTime(this.createdAt)));
  }

  buildModifiedAt(collapsibleBody) {
    const divModifiedAt = createElement('div', {id: `show-modifiedat-${this.id}`, class: 'content-show'});

    if (this.modifiedAt) {
      addClassName(divModifiedAt, 'active');
    }
    
    collapsibleBody.appendChild(divModifiedAt);

    divModifiedAt.appendChild(createElement('h4', {}, 'Modified at:'));
    divModifiedAt.appendChild(createElement('p', {'data-modifiedat-id': this.id, style: {color: config.colors.modifiedAt}}, getFullTime(this.modifiedAt)));
  }

  static getPassword(id) {
    return passwordsMap.get(id);
  }

  getId() {
    return this.id;
  }

  show(type, boolean) {
    const element = contentPasswords.querySelector(`#show-${type}-${this.id}`);
    boolean === true ? addClassName(element, 'active') : removeClassName(element, 'active');
  }
  
  setCollapsibleBodyHeight() {
    const collapsible = contentPasswords.querySelector(`[data-id="${this.id}"]`);

    if (containsClassName(collapsible, 'active')) {
      const collapsibleBody = collapsible.nextElementSibling;
      collapsibleBody.style.maxHeight = collapsibleBody.scrollHeight + 'px';
    }
  }

  setName(name) {
    this.name = name;
    contentPasswords.querySelector(`[data-name-id="${this.id}"]`).innerText = name;
  }

  getName() {
    return this.name;
  }

  setPassword(password) {
    this.password = password;

    const element = contentPasswords.querySelector(`[data-password-id="${this.id}"]`);

    if (element.innerText !== '••••••••••••••••') {
      element.innerText = password;
    }
  }

  getPassword() {
    return this.password;
  }

  getHistories() {
    return this.histories;
  }

  addHistory(history) {
    const result = this.histories.find(({id}) => id === history.id);

    if (!result) this.histories.push(history);

    this.buildHistory(contentPasswords.querySelector(`#show-history-${this.id}`), history);
  }

  removeHistory(id) {
    this.histories = this.histories.filter(history => history.id != id);

    const history = contentPasswords.querySelector(`#password-history-${id}`);
    if (history) history.remove();
  }

  clearHistory() {
    this.histories = [];
  }

  setPlatform(platform) {
    this.platform = platform;
    contentPasswords.querySelector(`[data-platform-id="${this.id}"]`).innerText = platform;
  }

  getPlatform() {
    return this.password;
  }

  setUrl(url) {
    this.url = url;
    const element = contentPasswords.querySelector(`[data-url-id="${this.id}"]`);
    element.innerText = url;
    element.setAttribute('href', formatUrl(url));
  }

  getUrl() {
    return this.url;
  }

  setUsername(username) {
    this.username = username;
    contentPasswords.querySelector(`[data-username-id="${this.id}"]`).innerText = username;
  }

  getUsername() {
    return this.username;
  }

  setEmail(email) {
    this.email = email;
    contentPasswords.querySelector(`[data-email-id="${this.id}"]`).innerText = email;
  }

  getEmail() {
    return this.email;
  }

  setDescription(description) {
    this.description = description;
    contentPasswords.querySelector(`[data-description-id="${this.id}"]`).innerText = description;
  }

  getDescription() {
    return this.description;
  }

  setModifiedAt(modifiedAt) {
    this.modifiedAt = modifiedAt;
    contentPasswords.querySelector(`[data-modifiedat-id="${this.id}"]`).innerHTML = getFullTime(modifiedAt);
  }

  getModifiedAt() {
    return this.modifiedAt;
  }

  static deletePassword(id) {
    const collapsible = contentPasswords.querySelector(`[data-id="${id}"]`);
    const collapsibleBody = collapsible.nextElementSibling;

    collapsible.remove();
    collapsibleBody.remove();

    passwordsMap.delete(id);
  }

  static registerClickEvents() {
    const collapsibles = contentPasswords.querySelectorAll('.collapsible');

    for (const collapsible of collapsibles) {
      collapsible.onclick = function() {
        if (lastOpenCollapsible && lastOpenCollapsible != this) {
          const lastOpenCollapsibleBody = lastOpenCollapsible.nextElementSibling;

          if (lastOpenCollapsibleBody) {
            removeClassName(lastOpenCollapsible, 'active');
            lastOpenCollapsibleBody.style.maxHeight = null;
        
            const id = lastOpenCollapsible.dataset.id;

            const password = contentPasswords.querySelector(`[data-password-id="${id}"`);
            if (password.innerText != '••••••••••••••••') password.innerText = '••••••••••••••••';

            const passwordShow = contentPasswords.querySelector(`#password-show-${id}`);
            if (!containsClassName(passwordShow, 'fa fa-eye')) passwordShow.setAttribute('class', 'fa fa-eye');

            const passwordHistories = Password.getPassword(id).histories;

            for (const history of passwordHistories) {
              const password = contentPasswords.querySelector(`[data-history-id="${history.id}"`);

              if (!password) return;

              if (password.innerText != '••••••••••••••••') password.innerText = '••••••••••••••••';

              const passwordShow = contentPasswords.querySelector(`#history-show-${history.id}`);
              if (!containsClassName(passwordShow, 'fa fa-eye')) passwordShow.setAttribute('class', 'fa fa-eye');
            }
          }
        }
        
        lastOpenCollapsible = this;
        const collapsibleBody = this.nextElementSibling;

        if (containsClassName(modalPasswordEdit.getModal(), 'active')) {
          addClassName(this, 'active');
          collapsibleBody.style.maxHeight = collapsibleBody.scrollHeight + 'px';
        } else {
          toggleClassName(this, 'active');
          collapsibleBody.style.maxHeight ? collapsibleBody.style.maxHeight = null : collapsibleBody.style.maxHeight = collapsibleBody.scrollHeight + 'px';
        }
      };
    }
  }

  static clearPasswords() {
    passwordsMap.clear();

    const collapsibles = contentPasswords.querySelectorAll('.collapsible');

    for (const collapsible of collapsibles) {
      collapsible.nextElementSibling.remove();
      collapsible.remove();
    }
  }
}

const serverSettingsTabItemAccounts = contentServerSettings.querySelector('.tab-item-accounts');
const serverSettingsTabItemLogs = contentServerSettings.querySelector('.tab-item-logs');

const serverSettingsTabContentAccounts = contentServerSettings.querySelector('.tab-content-accounts');
const serverSettingsTabContentLogs = contentServerSettings.querySelector('.tab-content-logs');

serverSettingsTabItemAccounts.onclick = () => changeServerSettingsContentTo(0);
serverSettingsTabItemLogs.onclick = () => changeServerSettingsContentTo(1);

function changeServerSettingsContentTo(number) {
  switch (number) {
    case 0:
      if (!containsClassName(serverSettingsTabItemAccounts, 'active')) {
        addClassName(serverSettingsTabItemAccounts, 'active');
        removeClassName(serverSettingsTabItemLogs, 'active');

        serverSettingsTabContentAccounts.style.display = 'block';
        serverSettingsTabContentLogs.style.display = 'none';

        setCookie('user_content_serversettings', '0', 7);
      }
      break;

    case 1:
      if (!containsClassName(serverSettingsTabItemLogs, 'active')) {
        removeClassName(serverSettingsTabItemAccounts, 'active');
        addClassName(serverSettingsTabItemLogs, 'active');

        serverSettingsTabContentAccounts.style.display = 'none';
        serverSettingsTabContentLogs.style.display = 'block';

        setCookie('user_content_serversettings', '1', 7);

        handleServerSettingsLogs();
      }
      break;
    
    default:
      throw new Error('Unknown Server Settings content');
  }
}

class ModalAccountCreate {
  constructor(modal, headerTitle, headerIconClose, form, generateNewPasswordContainer, sliderPasswordLengthText, sliderPasswordsLimitText, buttonCreate) {
    this.modal = modal;
    this.headerTitle = headerTitle;
    this.headerIconClose = headerIconClose;
    this.form = form;
    this.generateNewPasswordContainer = generateNewPasswordContainer;
    this.sliderPasswordLengthText = sliderPasswordLengthText;
    this.sliderPasswordLength = undefined;
    this.sliderPasswordsLimitText = sliderPasswordsLimitText;
    this.sliderPasswordsLimit = undefined;
    this.buttonCreate = buttonCreate;
  
    this.register();
  }

  open() {
    addClassName(this.modal, 'active');
  }

  close() {
    removeClassName(this.modal, 'active');
  }

  setHeaderTitle(title) {
    this.headerTitle.innerHTML = title;
  }

  getModal() {
    return this.modal;
  }

  register() {
    this.headerIconClose.onclick = () => removeClassName(this.modal, 'active');

    this.init();

    this.form.checkBoxGeneratePassword.onclick = () => toggleClassName(this.generateNewPasswordContainer, 'active');

    this.form.buttonGenerate.onclick = () => {
      this.form.generatedPassword.value = generatePassword({
        letters: this.form.checkBoxLetters.checked,
        numbers: this.form.checkBoxNumbers.checked,
        symbols: this.form.checkBoxSymbols.checked,
      }, this.form.symbols.value, this.sliderPasswordLength.value);
    };

    this.buttonCreate.onclick = () => {
      this.form.onsubmit = (event) => {
        event.preventDefault();
  
        this.create();
      };
    };
  }

  init() {
    this.close();

    this.form.username.setAttribute('minlength', config.account.username.min);
    this.form.username.setAttribute('maxlength', config.account.username.max);
    this.form.email.setAttribute('minlength', config.account.email.min);
    this.form.email.setAttribute('maxlength', config.account.email.max);
    
    if (this.sliderPasswordLength === undefined) {
      this.sliderPasswordLength = new Slider(this.sliderPasswordLengthText, this.form.sliderPasswordLength);
    }

    if (this.sliderPasswordsLimit === undefined) {
      this.sliderPasswordsLimit = new Slider(this.sliderPasswordsLimitText, this.form.sliderPasswordsLimit);
    }

    this.form.sliderPasswordLength.setAttribute('min', config.account.password.min);
    this.form.sliderPasswordLength.setAttribute('max', config.account.password.max);
    this.form.sliderPasswordsLimit.setAttribute('min', 1);
    this.form.sliderPasswordsLimit.setAttribute('max', config.account.password.limit);

    isAccountDataAvailable(this.form.username, undefined, true, config.account.username.min, config.account.username.max);
    isAccountDataAvailable(this.form.email, undefined, true, config.account.email.min, config.account.email.max);
  }

  reset() {
    setInputIcon(this.form.username, 'none');
    setInputIcon(this.form.email, 'none');

    this.form.username.value = '';
    this.form.email.value = '';
    this.form.rank.value = 'user';

    this.form.checkBoxGeneratePassword.checked = true;
    this.form.checkBoxSendEmail.checked = true;

    removeClassName(this.generateNewPasswordContainer, 'active');

    this.form.checkBoxLetters.checked = true;
    this.form.checkBoxNumbers.checked = true;
    this.form.checkBoxSymbols.checked = true;

    this.form.symbols.value = localStorage.getItem('symbols');

    this.sliderPasswordLength.setText(config.account.password.default);
    this.sliderPasswordLength.value = config.account.password.default;

    this.sliderPasswordsLimit.setText(config.account.password.limit);
    this.sliderPasswordsLimit.value = config.account.password.limit;

    this.buttonCreate.value = 'create account';
  }

  build() {
    this.reset();
    this.open();

    this.form.generatedPassword.value = generatePassword({
      letters: this.form.checkBoxLetters.checked,
      numbers: this.form.checkBoxNumbers.checked,
      symbols: this.form.checkBoxSymbols.checked
    }, this.form.symbols.value, this.sliderPasswordLength.value);
  }

  create() {
    if (this.buttonCreate.value === 'create account') {
      this.buttonCreate.value = 'sure?'; 
      return;
    }

    isAccountDataAvailable(this.form.username, undefined, false, config.account.username.min, config.account.username.max, (callbackUsernameAvailable) => {
      if (!callbackUsernameAvailable) {
        sendPopup('error', config.messages.account.usernameNotAvailable.replace('%username%', this.form.username.value)); 
        return;
      }

      if (reg.test(this.form.email.value) == false) {
        setInputIcon(this.form.email, 'cross');
        sendPopup('error', config.messages.account.emailNotValid.replace('%email%', this.form.email.value));
        return;
      }

      isAccountDataAvailable(this.form.email, undefined, false, config.account.email.min, config.account.email.max, (callbackEmailAvailable) => {
        if (!callbackEmailAvailable) {
          sendPopup('error', config.messages.account.emailNotAvailable.replace('%email%', this.form.email.value)); 
          return;
        }

        if (this.buttonCreate.value === 'sure?') {
          let data = `username=${this.form.username.value}&email=${this.form.email.value}&permissionsLevel=${getPermissionsLevel(this.form.rank.value)}`;
          
          if (!this.form.checkBoxGeneratePassword.checked) data += `&password=${this.form.generatedPassword.value}`;
          if (this.form.checkBoxSendEmail.checked) data += '&sendEmail=true';
          this.sliderPasswordsLimit.value > 0 && this.sliderPasswordsLimit.value <= config.account.password.limit
            ? data += `&passwordLimit=${this.sliderPasswordsLimit.value}` : data += `&passwordLimit=${config.account.password.limit}`;

          fetch('account/create', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: data,
          })
          .then(response => response.json())
          .then(result => {
            if (result.logout) {
              window.location.href = result.logout;
              return; 
            }

            this.close();
            result.success ? sendPopup('success', config.messages.account.created.replace('%username%', this.form.username.value)) : sendPopup('success', 'Error');
          });
        }
      });
    });
  }
}

function formatUrl(url) {
  return !url.includes('http') && !url.includes('https') ? `https://${url}` : url;
}

let modalAccountCreate = undefined;

function initModalAccountCreate() {
  if (!modalAccountCreate) {
    modalAccountCreate = new ModalAccountCreate(
      serverSettingsTabContentAccounts.querySelector('#modal-account-create'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-create .modal-header .title'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-create .modal-header #icon-close'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-create form'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-create .generatenewpassword-container'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-create #slider-text-passwordlength'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-create #slider-text-passwordlimit'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-create .button-create')
    );
  } else {
    modalAccountCreate.init();
  }
}

serverSettingsTabContentAccounts.querySelector('#create-account').onclick = () => modalAccountCreate.build();

class ModalAccountLog {
  constructor(modal, headerTitle, headerIconClose, loader, ul, buttonLast, buttonNext) {
    this.modal = modal;
    this.headerTitle = headerTitle;
    this.headerIconClose = headerIconClose;
    this.loader = loader;
    this.ul = ul;
    this.buttonLast = buttonLast;
    this.buttonNext = buttonNext;

    this.logEnd = false;
    this.dates = null;
    this.dateIndex = 0;
    this.line = 0;

    this.register();
  }

  getModal() {
    return this.modal;
  }

  open() {
    addClassName(this.modal, 'active');
  }

  close() {
    removeClassName(this.modal, 'active');
    this.clearList()
  }

  setHeaderTitle(title) {
    this.headerTitle.innerHTML = title;
  }

  getHeaderTitle() {
    return this.headerTitle;
  }

  clearList() {
    this.ul.innerHTML = '';
  }

  setLoader(boolean) {
    boolean ? addClassName(this.loader, 'active') : removeClassName(this.loader, 'active');
  }

  setMouseLoader(boolean) {
    boolean ? document.body.style.cursor = 'progress' : document.body.style.cursor = 'auto';
  }

  setDates(dates) {
    this.dates = dates;
  }

  setButton(button, status) {
    if (status) {
      button.style.background = config.colors.buttonLastAndNext;
      button.style.cursor = 'pointer';
    } else {
      button.style.background = config.colors.red;
      button.style.cursor = 'not-allowed';
    }
  }

  register() {
    this.headerIconClose.onclick = () => removeClassName(this.modal, 'active');

    this.ul.onscroll = (event) => {
      const scrollTop = Math.round(this.ul.scrollTop);
      const scrollHeight = (event.target.scrollHeight - (event.target.clientHeight));
     
      if (scrollTop === scrollHeight || (scrollTop + 1) === scrollHeight) {
        if (this.logEnd) return;

        this.line += 500;
        this.setMouseLoader(true);

        const accountId = this.getHeaderTitle().innerText.split(' ')[1].replace('#', '');

        fetch(`server/log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `type=account&accountId=${accountId}&date=${this.dates[this.dateIndex]}&line=${this.line}`,
        })
        .then(response => response.json())
        .then(result => {
          if (result.logout) {
            window.location.href = result.logout;
            return; 
          }

          this.setMouseLoader(false);

          if (result.success === false) {
            const li = createElement('li', {}, `<span style="color: ${config.colors.red}; font-weight: bold">Log does not exist ...</span>`);
            this.ul.appendChild(li);
            return;
          }

          for (let message of result.messages) {
            if (message === 'end') {
              this.logEnd = true;
              break;
            } else {
              const li = createElement('li', {}, message);
              this.ul.appendChild(li);
            }
          }
        })
        .catch(error => console.error(error));
      }
    };

    this.buttonLast.onclick = () => {
      if (this.dateIndex === 0) return

      const accountId = this.getHeaderTitle().innerText.split(' ')[1].replace('#', '');

      this.dateIndex--;
      this.loadLog(accountId, this.dates[this.dateIndex]);
      this.setButton(this.buttonNext, true);

      if (this.dateIndex === 0) {
        this.setButton(this.buttonLast, false);
      }
    };

    this.buttonNext.onclick = () => {
      if (this.dateIndex >= (this.dates.length - 1)) return;

      const accountId = this.getHeaderTitle().innerText.split(' ')[1].replace('#', '');

      this.dateIndex++;
      this.loadLog(accountId, this.dates[this.dateIndex]);
      this.setButton(this.buttonLast, true);

      if (this.dateIndex >= (this.dates.length - 1)) {
        this.setButton(this.buttonNext, false);
      }
    };
  }

  loadLog(accountId, date) {
    this.setHeaderTitle(`${date} <span style="color: ${config.colors.hashtag}">#</span>${accountId}`);
    this.setLoader(true);
    this.setMouseLoader(true);
    this.clearList();
    this.logEnd = false;
    this.line = 0;

    fetch(`server/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `type=account&accountId=${accountId}&date=${date}&line=0`,
    })
    .then(response => response.json())
    .then(result => {
      if (result.logout) {
        window.location.href = result.logout;
        return; 
      }

      this.setLoader(false);
      this.setMouseLoader(false);

      this.clearList();

      if (result.success === false) {
        const li = createElement('li', {}, `<span style="color: ${config.colors.red}; font-weight: bold">Log does not exist ...</span>`, true);
        this.ul.appendChild(li);
        return;
      }
      
      for (let message of result.messages) {
        if (message === 'end') {
          this.logEnd = true;
        } else {
          const li = createElement('li', {}, message);
          this.ul.appendChild(li);
        }
      }
    })
    .catch(error => console.error(error));
  }

  reset() {
    this.logEnd = false;
    this.dateIndex = (this.dates.length - 1);
    this.line = 0;
    this.dates.length > 1 ? this.setButton(this.buttonLast, true) : this.setButton(this.buttonLast, false);
  }

  build(accountId, dates) {
    this.dates = dates;
    this.reset();

    this.loadLog(accountId, this.dates[this.dates.length - 1]);
    this.setButton(this.buttonNext, false);

    this.open();
  }
}

const modalAccountLog = new ModalAccountLog(
  document.querySelector('#modal-account-log'),
  document.querySelector('#modal-account-log .title'),
  document.querySelector('#modal-account-log #icon-close'),
  document.querySelector('#modal-account-log .modal-loader'),
  document.querySelector('#modal-account-log ul'),
  document.querySelector('#modal-account-log .button-last'),
  document.querySelector('#modal-account-log .button-next')
);

class ModalAccountEdit {
  constructor(modal, headerTitle, headerIconClose, form, sliderText, buttonDelete, buttonSave) {
    this.modal = modal;
    this.headerTitle = headerTitle;
    this.headerIconClose = headerIconClose;
    this.form = form;
    this.sliderText = sliderText;
    this.sliderPasswordsLimit = undefined;
    this.buttonDelete = buttonDelete;
    this.buttonSave = buttonSave;
  
    this.register();
  }

  open() {
    addClassName(this.modal, 'active');
  }

  close() {
    removeClassName(this.modal, 'active');
  }

  setHeaderTitle(title) {
    this.headerTitle.innerHTML = title;
  }

  getHeaderTitle() {
    return this.headerTitle.innerText;
  }

  getModal() {
    return this.modal;
  }

  register() {
    this.headerIconClose.onclick = () => this.close();
    this.init();
  }

  init() {
    this.close();

    this.form.username.setAttribute('minlength', config.account.username.min);
    this.form.username.setAttribute('maxlength', config.account.username.max);
    this.form.email.setAttribute('minlength', config.account.email.min);
    this.form.email.setAttribute('maxlength', config.account.email.max);
    this.form.sliderPasswordsLimit.setAttribute('min', 1);
    this.form.sliderPasswordsLimit.setAttribute('max', config.account.password.limit);
    
    if (this.sliderPasswordsLimit === undefined) {
      this.sliderPasswordsLimit = new Slider(this.sliderText, this.form.sliderPasswordsLimit);
    }
  }

  reset() {
    setInputIcon(this.form.username, 'none');
    setInputIcon(this.form.email, 'none');

    this.form.checkBoxSendEmail.checked = true;

    this.buttonDelete.value = 'delete';
    this.buttonSave.value = 'save';
  }

  build(account) {
    this.reset();

    const permissionsLevel = serverSettingsTabContentAccounts.querySelector(`button[data-id="${account.id}"]`).dataset.permissionslevel;
    
    permissionsLevel == 2 || myAccount.permissionsLevel !== 2 ? this.buttonDelete.style.cursor = 'not-allowed' : this.buttonDelete.style.cursor = 'pointer';
    
    if (permissionsLevel == 2) {
      if (getCookie('permissions_level') !== '2') {
        sendPopup('error', config.messages.noPermissions);
        return;
      }

      this.form.rank.value = 'master';
      this.form.rank.disabled = true;
    } else if (permissionsLevel == 1) {
      if (getCookie('permissions_level') !== '2' && account.username !== getCookie('username')) {
        sendPopup('error', config.messages.noPermissions);
        return;
      }

      permissionsLevel == 1 && account.username === getCookie('username') ? this.form.rank.disabled = true : this.form.rank.disabled = false;
        
      this.form.rank.value = 'admin';
    } else {
      this.form.rank.value = 'user';
      this.form.rank.disabled = false;
    }

    this.setHeaderTitle(`${serverSettingsTabContentAccounts.querySelector(`#username-${account.id}`).dataset.username} <span style="color: ${config.colors.hashtag}">#</span>${account.id}`);
    
    this.sliderPasswordsLimit.setText(account.passwordLimit);
    this.sliderPasswordsLimit.value = account.passwordLimit;

    isAccountDataAvailable(this.form.username, account.username, true, config.account.username.min, config.account.username.max);
    isAccountDataAvailable(this.form.email, account.email, true, config.account.email.min, config.account.email.max);

    this.form.username.value = account.username;
    this.form.email.value = account.email;
    this.form.checkBoxSendEmail.checked;

     this.buttonSave.onclick = () => {
      this.form.onsubmit = (event) => {
        event.preventDefault();

        this.save(account);
      }
    };

    this.buttonDelete.onclick = () => {
      this.form.onsubmit = (event) => {
        event.preventDefault();

        this.delete(account);
      }
    };

    this.open();
  }

  delete(account) {
    if (this.buttonDelete.value === 'delete') {
      if (myAccount.permissionsLevel !== 2 || serverSettingsTabContentAccounts.querySelector(`button[data-id="${account.id}"]`).dataset.permissionslevel == 2) {
        sendPopup('error', config.messages.noPermissions);
        this.close();
        return;
      }

      this.buttonDelete.value = 'sure?';
      return;
    }
  
    if (this.buttonDelete.value === 'sure?') {
      if (myAccount.permissionsLevel !== 2) {
        sendPopup('error', config.messages.noPermissions);
        this.close();
        return;
      }

      let data = `accountId=${account.id}`;
      if (this.form.checkBoxSendEmail.checked) data += '&sendEmail=true';

      this.close();

      fetch('account/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: data,
      })
      .then(response => response.json())
      .then(result => {
        if (result.logout) {
          window.location.href = result.logout;
          return; 
        }

        result.success ? sendPopup('success', config.messages.account.deleted.replace('%username%', account.username)) : sendPopup('success', 'Error');
      });
    }
  }

  isUsernameAvailable(newUsername, oldUsername, callback) {
    if (newUsername.value === oldUsername) {
      callback(true);
    } else {
       isAccountDataAvailable(newUsername, oldUsername, false, config.account.username.min, config.account.username.max, (callbackUsernameAvailable) => {
        callbackUsernameAvailable ? callback(true) : callback(false);
      });
    }
  }

  isEmailAvailable(newEmail, oldEmail, callback) {
    if (newEmail.type !== 'email') {
      sendPopup('error', 'Error');
      return;
    }

    if (newEmail.value === oldEmail) {
      callback(true);
    } else {
       isAccountDataAvailable(newEmail, oldEmail, false, config.account.email.min, config.account.email.max, (callbackEmailAvailable) => {
         callbackEmailAvailable ? callback(true) : callback(false);
      });
    }
  }

  save(account) {
    if (this.buttonSave.value === 'save') {
      this.buttonSave.value = 'sure?';
      return;
    }

    if (this.form.username.value === account.username 
        && this.form.email.value === account.email 
        && getPermissionsLevel(this.form.rank.value) == account.permissionsLevel
        && this.form.sliderPasswordsLimit.value == account.passwordLimit) {
      this.close();
      sendPopup('success', config.messages.account.updated.replace('%username%', this.form.username.value)); 
      return;
    }
   
    if (myAccount.id === account.id && getPermissionsLevel(this.form.rank.value) != myAccount.permissionsLevel) {
      sendPopup('error', 'Error');
      return;
    }

    if (getPermissionsLevel(this.form.rank.value) === 2 && myAccount.id !== account.id) {
      sendPopup('error', 'Error');
      return;
    }

    if (this.sliderPasswordsLimit.value < 1 || this.sliderPasswordsLimit.value > config.account.password.limit) {
      sendPopup('error', 'Error');
      return;
    }
  
    this.isUsernameAvailable(this.form.username, account.username, (callbackUsernameAvailable) => {
      if (!callbackUsernameAvailable) {
        sendPopup('error', config.messages.account.usernameNotAvailable.replace('%username%', this.form.username.value));
        return;
      }

      this.isEmailAvailable(this.form.email, account.email, (callbackEmailAvailable) => {
        if (!callbackEmailAvailable) {
          sendPopup('error', config.messages.account.emailNotAvailable.replace('%email%', this.form.email.value));
          return;
        }

        if (this.buttonSave.value === 'sure?') {
          let data = `accountId=${account.id}`;

          if (this.form.username.value !== account.username) data += `&accountUsername=${this.form.username.value}`;
          if (this.form.email.value !== account.email) data += `&accountEmail=${this.form.email.value}`;
          if (getPermissionsLevel(this.form.rank.value) != account.permissionsLevel) data += `&accountPermissionsLevel=${getPermissionsLevel(this.form.rank.value)}`;
          if (this.form.sliderPasswordsLimit.value != account.passwordLimit) data += `&accountPasswordsLimit=${this.form.sliderPasswordsLimit.value}`;
          if (this.form.checkBoxSendEmail.checked) data += '&sendEmail=true';
      
          this.close();

          fetch('account/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: data,
          })
          .then(response => response.json())
          .then(result => {
            if (result.logout) {
              window.location.href = result.logout;
              return; 
            }
    
            result.success ? sendPopup('success', config.messages.account.updated.replace('%username%', this.form.username.value)) : sendPopup('success', 'Error');
          });
        }
      });
    });
  }
}

let modalAccountEdit = undefined; 

function initModalAccountEdit() {
  if (!modalAccountEdit) {
    modalAccountEdit = new ModalAccountEdit(
      serverSettingsTabContentAccounts.querySelector('#modal-account-edit'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-edit .modal-header .title'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-edit .modal-header #icon-close'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-edit form'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-edit .slider-text'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-edit .button-delete'),
      serverSettingsTabContentAccounts.querySelector('#modal-account-edit .button-save')
    );
  } else {
    modalAccountEdit.init();
  }
}

let accountSearch = undefined;

function initAccountSearch() {
  if (!accountSearch) {
    accountSearch = new Search(
      serverSettingsTabContentAccounts.querySelector('#search-account'), 
      config.account.username.max,
      serverSettingsTabContentAccounts.getElementsByClassName('collapsible'), 
      serverSettingsTabContentAccounts.getElementsByClassName('collapsible-body'));
  } else {
    accountSearch.setMaxLength(config.account.username.max);
  }
}

let accountsMap = new Map();
let lastOpenAccountCollapsible = undefined;

class ServerSettingsAccount {
  constructor(account) {
    this.id = account.id;
    this.username = account.username;
    this.email = account.email;
    this.passwords = account.passwords;
    this.passwordLimit = account.passwordLimit;
    this.permissionsLevel = account.permissionsLevel;
    this.lastLogin = account.lastLogin;
    this.createdAt = account.createdAt;
    this.modifiedAt = account.modifiedAt;
    this.dates = account.dates;

    accountsMap.set(this.id, this);
  }

  static getAccount(id) {
    return accountsMap.get(id);
  }

  setUsername(username) {
    this.username = username;
  }

  setEmail(email) {
    this.email = email;
  }

  setPermissionsLevel(permissionsLevel) {
    this.permissionsLevel = permissionsLevel;
  }

  setPasswordsLimit(passwordLimit) {
    this.passwordLimit = passwordLimit;
  }

  build() {
    let element;

    if (this.permissionsLevel === 2) {
      element = serverSettingsTabContentAccounts.querySelector('.collapsible-masters');
    } else if (this.permissionsLevel === 1) {
      element = serverSettingsTabContentAccounts.querySelector('.collapsible-admins');
    } else {
      element = serverSettingsTabContentAccounts.querySelector('.collapsible-users');
    }

    const collapsible = createElement('button', {class: `collapsible`,  'data-id': this.id, 'data-permissionslevel': this.permissionsLevel});
    element.appendChild(collapsible);

    const username = createElement('p', {id: `username-${this.id}`, 'data-username': this.username}, this.username);
    username.style.color = getRankColor(this.permissionsLevel);
    collapsible.appendChild(username);

    const iconDiv = createElement('div');
    collapsible.appendChild(iconDiv);

    const iconLog = createElement('i', {class: 'fa fa-desktop', 'aria-hidden': 'true'});
    iconDiv.appendChild(iconLog);

    iconLog.onclick = () => !this.dates || this.dates.length === 0 ? sendPopup('error', config.messages.noAccountLogs) : modalAccountLog.build(this.id, this.dates);

    const iconSettings = createElement('i', {class: 'fa fa-cog', 'aria-hidden': 'true'});
    iconDiv.appendChild(iconSettings);

    iconSettings.onclick = () => modalAccountEdit.build({
      id: this.id,
      username: this.username,
      email: this.email,
      passwordLimit: this.passwordLimit,
      permissionsLevel: this.permissionsLevel
    });

    const collapsibleBody = createElement('div', {class: 'collapsible-body'});
    element.appendChild(collapsibleBody);

    if (this.id) {
      collapsibleBody.appendChild(createElement('h4', {}, 'ID:'));

      const spaceBetween = createElement('div', {class: 'space-between'});
      collapsibleBody.appendChild(spaceBetween);

      spaceBetween.appendChild(createElement('p', {}, this.id));

      const iconCopy = createElement('i', {class: 'far fa-copy', 'aria-hidden': 'true'});
      spaceBetween.appendChild(iconCopy);

      iconCopy.onclick = () => copyToClipboard(this.id, true);
    }

    if (this.email) {
      collapsibleBody.appendChild(createElement('h4', {}, 'Email:'));

      const spaceBetween = createElement('div', {class: 'space-between'});
      collapsibleBody.appendChild(spaceBetween);

      spaceBetween.appendChild(createElement('a', {id: `email-${this.id}`, href: `mailto:${this.email}`, 'data-email': this.email}, this.email));

      const iconCopy = createElement('i', {class: 'far fa-copy', 'aria-hidden': 'true'});
      spaceBetween.appendChild(iconCopy);

      iconCopy.onclick = () => copyToClipboard(serverSettingsTabContentAccounts.querySelector(`#email-${this.id}`).innerHTML, true);
    }

    collapsibleBody.appendChild(createElement('h4', {}, 'Passwords:'));
    collapsibleBody.appendChild(createElement('p', {id: `passwords-${this.id}`}, `${this.passwords}`));
   
    collapsibleBody.appendChild(createElement('h4', {}, 'Password limit:'));
    collapsibleBody.appendChild(createElement('p', {id: `passwordlimit-${this.id}`}, `${this.passwordLimit}`));

    collapsibleBody.appendChild(createElement('h4', {}, 'Rank:'));
    collapsibleBody.appendChild(createElement('p', {id: `permissionslevel-${this.id}`, style: {color: getRankColor(this.permissionsLevel)}}, getRankName(this.permissionsLevel)));
    
    collapsibleBody.appendChild(createElement('h4', {}, 'Last login:'));
    collapsibleBody.appendChild(createElement('p', {id: `lastlogin-${this.id}`},
      this.lastLogin === null || this.lastLogin === undefined ? '-/-' : getFullTime(this.lastLogin)));

    collapsibleBody.appendChild(createElement('h4', {}, 'Created at:'));
    collapsibleBody.appendChild(createElement('p', {style: {color: config.colors.createdAt}}, getFullTime(this.createdAt)));

    collapsibleBody.appendChild(createElement('h4', {}, 'Modified at:'));
    collapsibleBody.appendChild(createElement('p', {id: `modifiedat-${this.id}`, style: {color : config.colors.modifiedAt}}, 
      this.modifiedAt === null || this.modifiedAt === undefined ? '-/-' : getFullTime(this.modifiedAt)));
  }

  static registerClickEvents() {
    const collapsibles = serverSettingsTabContentAccounts.querySelectorAll('.collapsible');

    for (const collapsible of collapsibles) {
      collapsible.onclick = function() {
        if (lastOpenAccountCollapsible && lastOpenAccountCollapsible != this) {
          const lastOpenAccountCollapsibleBody = lastOpenAccountCollapsible.nextElementSibling;

          if (lastOpenAccountCollapsibleBody) {
            removeClassName(lastOpenAccountCollapsible, 'active');
            lastOpenAccountCollapsibleBody.style.maxHeight = null;
          }
        }

        lastOpenAccountCollapsible = this;
        const collapsibleBody = this.nextElementSibling;

        if (containsClassName(modalAccountEdit.getModal(), 'active') || containsClassName(modalAccountLog.getModal(), 'active')) {
          addClassName(this, 'active');
          collapsibleBody.style.maxHeight = collapsibleBody.scrollHeight + 'px';
        } else {
          toggleClassName(this, 'active');
          collapsibleBody.style.maxHeight ? collapsibleBody.style.maxHeight = null : collapsibleBody.style.maxHeight = collapsibleBody.scrollHeight + 'px';
        }
      };
    }
  }
}

function loadAccounts() {
  fetch(`accounts`)
  .then(response => response.json())
  .then(result => {
    if (result.logout) {
      window.location.href = result.logout;
      return; 
    }

    initAccounts(result.accounts);
  })
  .catch(error => console.error(error));
}

class ModalLogsHistory {
  constructor(modal, headerTitle, headerIconClose, loader, ul, buttonLast, buttonNext) {
    this.modal = modal;
    this.headerTitle = headerTitle;
    this.headerIconClose = headerIconClose;
    this.loader = loader;
    this.ul = ul;
    this.buttonLast = buttonLast;
    this.buttonNext = buttonNext;

    this.logEnd = false;
    this.dates = null;
    this.dateIndex = 0;
    this.line = 0;

    this.register();
  }

  getModal() {
    return this.modal;
  }

  open() {
    addClassName(this.modal, 'active');
  }

  close() {
    removeClassName(this.modal, 'active');
    this.clearList()
  }

  setHeaderTitle(title) {
    this.headerTitle.innerHTML = title;
  }

  clearList() {
    this.ul.innerHTML = '';
  }

  setLoader(boolean) {
    boolean ? addClassName(this.loader, 'active') : removeClassName(this.loader, 'active');
  }

  setMouseLoader(boolean) {
    boolean ? document.body.style.cursor = 'progress' : document.body.style.cursor = 'auto';
  }

  setDates(dates) {
    this.dates = dates;
  }

  setButton(button, status) {
    if (status) {
      button.style.background = config.colors.buttonLastAndNext;
      button.style.cursor = 'pointer';
    } else {
      button.style.background = config.colors.red;
      button.style.cursor = 'not-allowed';
    }
  }

  register() {
    this.headerIconClose.onclick = () => removeClassName(this.modal, 'active');

    this.ul.onscroll = (event) => {
      const scrollTop = Math.round(this.ul.scrollTop);
      const scrollHeight = (event.target.scrollHeight - (event.target.clientHeight));
     
      if (scrollTop === scrollHeight || (scrollTop + 1) === scrollHeight) {
        if (this.logEnd) return;

        this.line += 500;
        this.setMouseLoader(true);

        fetch(`server/log`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: `date=${this.dates[this.dateIndex]}&line=${this.line}`,
        })
        .then(response => response.json())
        .then(result => {
          if (result.logout) {
            window.location.href = result.logout;
            return; 
          } 

          this.setMouseLoader(false);

          if (result.success === false) {
            const li = createElement('li', {}, `<span style="color: ${config.colors.red}; font-weight: bold">Log does not exist ...</span>`);
            this.ul.appendChild(li);
            return;
          }

          for (let message of result.messages) {
            if (message === 'end') {
              this.logEnd = true;
              break;
            } else {
              const li = createElement('li', {}, message);
              this.ul.appendChild(li);
            }
          }
        })
        .catch(error => console.error(error));
      }
    };

    this.buttonLast.onclick = () => {
      if (this.dateIndex === 0) return

      this.dateIndex--;
      this.loadLog(this.dates[this.dateIndex]);
      this.setButton(this.buttonNext, true);

      if (this.dateIndex === 0) {
        this.setButton(this.buttonLast, false);
      }
    };

    this.buttonNext.onclick = () => {
      if (this.dateIndex >= (this.dates.length - 1)) return;

      this.dateIndex++;
      this.loadLog(this.dates[this.dateIndex]);
      this.setButton(this.buttonLast, true);

      if (this.dateIndex >= (this.dates.length - 1)) {
        this.setButton(this.buttonNext, false);
      }
    };
  }

  loadLog(date) {
    this.setHeaderTitle(date);
    this.setLoader(true);
    this.setMouseLoader(true);
    this.clearList();
    this.logEnd = false;
    this.line = 0;

    fetch(`server/log`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: `date=${date}&line=0`,
    })
    .then(response => response.json())
    .then(result => {
      if (result.logout) {
        window.location.href = result.logout;
        return; 
      }

      this.setLoader(false);
      this.setMouseLoader(false);

      this.clearList();

      if (result.success === false) {
        const li = createElement('li', {}, `<span style="color: ${config.colors.red}; font-weight: bold">Log does not exist ...</span>`);
        this.ul.appendChild(li);
        return;
      }
      
      for (let message of result.messages) {
        if (message === 'end') {
          this.logEnd = true;
        } else {
          const li = createElement('li', {}, message);
          this.ul.appendChild(li);
        }
      }
    })
    .catch(error => console.error(error));
  }

  reset() {
    this.logEnd = false;
    this.dateIndex = (this.dates.length - 1);
    this.line = 0;
    this.dates.length > 1 ? this.setButton(this.buttonLast, true) : this.setButton(this.buttonLast, false);
  }

  build() {
    this.reset();

    this.loadLog(this.dates[this.dates.length - 1]);
    this.setButton(this.buttonNext, false);

    this.open();
  }
}

function getDate(symbol) {
  const today = new Date();
  const date = ('0' + today.getDate()).slice(-2);
  const month = ('0' + (today.getMonth() + 1)).slice(-2);
  const year = today.getFullYear();

  return `${date}${symbol}${month}${symbol}${year}`;
}

function calculateDate(days) {
  const today = new Date();
  today.setDate(today.getDate() - days);
  const date = ('0' + today.getDate()).slice(-2);
  const month = ('0' + (today.getMonth() + 1)).slice(-2);
  const year = today.getFullYear();

  return `${date}-${month}-${year}`;
}

const modalLogsHistory = new ModalLogsHistory(
  serverSettingsTabContentLogs.querySelector('.modal'),
  serverSettingsTabContentLogs.querySelector('.modal .title'),
  serverSettingsTabContentLogs.querySelector('.modal #icon-close'),
  serverSettingsTabContentLogs.querySelector('.modal .modal-loader'),
  serverSettingsTabContentLogs.querySelector('.modal ul'),
  serverSettingsTabContentLogs.querySelector('.modal .button-last'),
  serverSettingsTabContentLogs.querySelector('.modal .button-next')
);

class ServerSettingsCardLogs {
  constructor(openIcon, ul, scrollButton) {
    this.openIcon = openIcon;
    this.ul = ul;
    this.scrollButton = scrollButton;

    this.register();
  }

  register() {
    this.openIcon.onclick = () => modalLogsHistory.build();

    this.ul.onscroll = (event) => {
      if (this.ul.scrollTop < (event.target.scrollHeight - (event.target.clientHeight + 10))) {
        this.showScrollButton();
      } else {
        this.hideScrollButton();
      }
    };

    this.scrollButton.onclick = () => {
      this.hideScrollButton();

      const li = this.ul.lastChild;
      li.parentNode.scrollTop = li.offsetTop;
    };
  }

  showScrollButton() {
    addClassName(this.scrollButton, 'active');
  }

  isScrollButtonShowing() {
    return containsClassName(this.scrollButton, 'active');
  }

  hideScrollButton() {
    removeClassName(this.scrollButton, 'active');
  }
  
  addMessage(message) {
    if (this.ul.childElementCount >= 500) {
      this.ul.removeChild(this.ul.firstChild);
    }

    const li = createElement('li', {}, message, true);
    this.ul.appendChild(li);

    if (!this.isScrollButtonShowing()) {
      li.parentNode.scrollTop = li.offsetTop;
    }
  }

  clearList() {
    while (this.ul.firstChild) {
      this.ul.removeChild(this.ul.firstChild);
    }
  }
}

const serverSettingsCardLogs = new ServerSettingsCardLogs(
  serverSettingsTabContentLogs.querySelector('.fa-history'),
  serverSettingsTabContentLogs.querySelector('.card ul'),
  serverSettingsTabContentLogs.querySelector('#scroll-bottom')
);

function handleServerSettingsLogs() {
  serverSettingsCardLogs.clearList();
  serverSettingsCardLogs.hideScrollButton();

  fetch(`server/log`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'type=dates',
  })
  .then(response => response.json())
  .then(result => {
    if (result.logout) {
      window.location.href = result.logout;
      return; 
    }

    modalLogsHistory.setDates(result.dates);
  })
  .catch(error => console.error(error));
}

function handleLogOut(location) {
  setCookie('username', '', 0);
  setCookie('permissions_level', '', 0);
  setCookie('user_content', '', 0);
  setCookie('user_content_serversettings', '', 0);
  localStorage.removeItem('symbols');
  localStorage.removeItem('key');

  if (!location) {
    fetch(`logout`, {method: 'POST'})
    .then(response => response.json())
    .then(result => {
      setCookie('user_session', '', 0);
      window.location.href = result.logout;
    });
  } else {
    setCookie('user_session', '', 0);
    window.location.href = location;
  }
}

window.onclick = (event) => {
  if (containsClassName(pageLoader, 'active')) return;

  if (event.target === modalPasswordEdit.getModal()) {
    modalPasswordEdit.close();
  }

  if (event.target === modalAccountCreate.getModal()) {
    modalAccountCreate.close();
  }

  if (event.target === modalAccountLog.getModal()) {
    modalAccountLog.close();
  }

  if (event.target === modalAccountEdit.getModal()) {
    modalAccountEdit.close();
  }

  if (event.target === modalLogsHistory.getModal()) {
    modalLogsHistory.close();
  }

  if (event.target === modalMyAccountEdit.getModal()) {
    modalMyAccountEdit.close();
  }

  if (event.target === modalPasswordsExport.getModal()) {
    modalPasswordsExport.close();
  }

  if (event.target === modalPasswordsImport.getModal()) {
    modalPasswordsImport.close();
  }
}

window.onkeyup = (event) => {
  if (containsClassName(pageLoader, 'active')) return;

  if (event.code === 'Escape') {
    if (containsClassName(navItemPasswords, 'active')) {
      passwordSearch.clearAndReload();
    }

    if (containsClassName(modalPasswordEdit.getModal(), 'active')) {
      modalPasswordEdit.close();
    }

    if (containsClassName(serverSettingsTabItemAccounts, 'active')) {
      accountSearch.clearAndReload();
    }

    if (containsClassName(modalAccountCreate.getModal(), 'active')) {
      modalAccountCreate.close();
    }
    
    if (containsClassName(modalAccountLog.getModal(), 'active')) {
      modalAccountLog.close();
    }

    if (containsClassName(modalAccountEdit.getModal(), 'active')) {
      modalAccountEdit.close();
    }

    if (containsClassName(modalLogsHistory.getModal(), 'active')) {
      modalLogsHistory.close();
    }

    if (containsClassName(modalMyAccountEdit.getModal(), 'active')) {
      modalMyAccountEdit.close();
    }

    if (containsClassName(modalPasswordsExport.getModal(), 'active')) {
      modalPasswordsExport.close();
    }

    if (containsClassName(modalPasswordsImport.getModal(), 'active')) {
      modalPasswordsImport.close();
    }
  }
};

function updateServerStats(data) {
  if (!data) return; 

  if (data.accounts !== undefined) {
    contentServerSettings.querySelector('#total-accounts').innerHTML = data.accounts;
  }

  if (data.passwords !== undefined) {
    contentServerSettings.querySelector('#total-passwords').innerHTML = data.passwords;
  }
}

const usernameContainer = document.querySelectorAll('.username-container');
const username = document.querySelectorAll('.username');

function updateUser(account) {
  if (account.username) {
    setCookie('username', account.username, 7);
    username[0].innerHTML = account.username;
    username[1].innerHTML = account.username;
    setAccount('username', account.username);
  }
  if (account.passwordLimit) {
    setAccount('passwordLimit', account.passwordLimit);
  }
  if (account.permissionsLevel != undefined) {
    setCookie('permissions_level', account.permissionsLevel, 7);

    const rankColor = getRankColor(account.permissionsLevel);

    usernameContainer[0].style.color = rankColor;
    username[0].style.color = rankColor;
    usernameContainer[1].style.color = rankColor;
    username[1].style.color = rankColor;

    setAccount('permissionsLevel', account.permissionsLevel, rankColor);

    if (account.permissionsLevel > 0) {
      clientIsAdmin = true;
      navItemServerSettings.style.display = 'block';

      if (account.loadAccounts) loadAccounts();
    } else {
      clientIsAdmin = false;
      navItemServerSettings.style.display = 'none';

      if (getCookie('user_content') == 3) changeContentTo(0);

      accountsMap.clear();
    }
  }
  if (account.email) {
    setAccount('email', account.email);
  }
  if (account.symbols) {
    setAccount('symbols', account.symbols);
    localStorage.setItem('symbols', account.symbols);
  }
  if (account.lastLogin) {
    setAccount('lastLogin', getFullTime(account.lastLogin));
  }
  if (account.modifiedAt) {
    setAccount('modifiedAt', account.modifiedAt === '-/-' ? '-/-' : getFullTime(account.modifiedAt), config.colors.modifiedAt);
  }
}

function getRankColor(permissionsLevel) {
  const level = parseInt(permissionsLevel);
  return level === 2 ? config.colors.rankMaster : (level === 1 ? config.colors.rankAdmin : config.colors.rankUser);
}

function getRankName(permissionsLevel) {
  return permissionsLevel == 2 ? 'Master' : (permissionsLevel == 1 ? 'Admin' : 'User');
}

function getPermissionsLevel(rankName) {
  return rankName === 'master' ? 2 : (rankName === 'admin' ? 1 : 0);
}

function getKey() {
  return CryptoJS.AES.decrypt(localStorage.getItem('key'), getCookie('user_session')).toString(CryptoJS.enc.Utf8);
}

let webSocket;

setTimeout(() => startWebSocket(webSocketServerLocation), 1000);

function startWebSocket(webSocketServerLocation) {
  webSocket = new WebSocket(webSocketServerLocation);

  webSocket.onopen = () => {
    console.info('webSocket open');
    setPageLoaderStatus('connected');
    
    initSystem();
  }

  webSocket.onerror = (error) => console.error('websocket error', error);

  webSocket.onclose = (event) => {
    console.info('websocket closed');

    if (event.wasClean) return;

    setPageLoader(0);
    setPageLoaderStatus('reconnect ...');

    setTimeout(() => {
      console.warn('reconnect....')
      startWebSocket(webSocketServerLocation);
    }, 2000);
  };

  webSocket.onmessage = (event) => {
    const data = JSON.parse(event.data);

    switch (data.type) {
      case 'logout':
        handleLogOut(data.location);
        break;

      case 'reload':
        setPageLoader(0);
        setPageLoaderStatus('reload ...');
        initSystem();
        break;

      case 'updateUser': {
        data.loadAccounts = true;
        updateUser(data);
        break;
      }
       
      case 'addPassword': {
        const key = getKey();
        const encryptedPassword = data.password;
        
        const decryptedPassword = {
          id: encryptedPassword.id,
          name: CryptoJS.AES.decrypt(encryptedPassword.name, key).toString(CryptoJS.enc.Utf8),
          password: CryptoJS.AES.decrypt(encryptedPassword.password, key).toString(CryptoJS.enc.Utf8),
          platform: encryptedPassword.platform === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.platform, key).toString(CryptoJS.enc.Utf8),
          url: encryptedPassword.url === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.url, key).toString(CryptoJS.enc.Utf8),
          username: encryptedPassword.username === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.username, key).toString(CryptoJS.enc.Utf8),
          email: encryptedPassword.email === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.email, key).toString(CryptoJS.enc.Utf8),
          description: encryptedPassword.description === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.description, key).toString(CryptoJS.enc.Utf8),
          createdAt: CryptoJS.AES.decrypt(encryptedPassword.createdAt, key).toString(CryptoJS.enc.Utf8),
          modifiedAt: encryptedPassword.modifiedAt === undefined ? undefined : CryptoJS.AES.decrypt(encryptedPassword.modifiedAt, key).toString(CryptoJS.enc.Utf8),
        };

        if (encryptedPassword.histories.length > 0) {
          const histories = [];

          for (const history of encryptedPassword.histories) {
            const decryptedHistory = {
              id: history.id,
              password: CryptoJS.AES.decrypt(history.password, key).toString(CryptoJS.enc.Utf8),
              deletedAt: CryptoJS.AES.decrypt(history.deletedAt, key).toString(CryptoJS.enc.Utf8)
            };

            histories.push(decryptedHistory);
          }
          decryptedPassword.histories = histories;
        } else {
          decryptedPassword.histories = [];
        }

        console.log('enc Hi', encryptedPassword.histories)

        if (passwordsMap.size === 0) {
          showNoPasswordsMessage(false);
        }

        new Password(decryptedPassword);

        Password.registerClickEvents();

        setAccount('passwords', passwordsMap.size);
        break;
      }
       
      case 'updatePassword': {
        const key = getKey();
        const encryptedPassword = data.password;

        const decryptedPassword = {
          id: encryptedPassword.id,
          name: encryptedPassword.name === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.name, key).toString(CryptoJS.enc.Utf8),
          password: encryptedPassword.password === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.password, key).toString(CryptoJS.enc.Utf8),
          histories: [],
          platform: encryptedPassword.platform === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.platform, key).toString(CryptoJS.enc.Utf8),
          url: encryptedPassword.url === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.url, key).toString(CryptoJS.enc.Utf8),
          username: encryptedPassword.username === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.username, key).toString(CryptoJS.enc.Utf8),
          email: encryptedPassword.email === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.email, key).toString(CryptoJS.enc.Utf8),
          description: encryptedPassword.description === undefined ? '' : CryptoJS.AES.decrypt(encryptedPassword.description, key).toString(CryptoJS.enc.Utf8),
          modifiedAt: encryptedPassword.modifiedAt === undefined ? undefined : CryptoJS.AES.decrypt(encryptedPassword.modifiedAt, key).toString(CryptoJS.enc.Utf8)
        };

        if (modalPasswordEdit.headerTitle.innerText.endsWith(decryptedPassword.id) && containsClassName(modalPasswordEdit.getModal(), 'active')) {
          modalPasswordEdit.close();
          sendPopup('error', config.messages.password.updated.replace('%name%', decryptedPassword.name));
        }

        for (const history of encryptedPassword.histories) {
          const encryptedHistory = {
            id: history.id,
            password: CryptoJS.AES.decrypt(history.password, key).toString(CryptoJS.enc.Utf8),
            deletedAt: CryptoJS.AES.decrypt(history.deletedAt, key).toString(CryptoJS.enc.Utf8)
          };

          decryptedPassword.histories.push(encryptedHistory);
        }

        const password = Password.getPassword(decryptedPassword.id);

        if (decryptedPassword.name) {
          password.setName(decryptedPassword.name);
        }
        if (decryptedPassword.password) {
          password.setPassword(decryptedPassword.password);
        }

        if (decryptedPassword.histories.length !== 0) {
          for (const newHistory of decryptedPassword.histories) {
            const exists = contentPasswords.querySelector(`#password-history-${newHistory.id}`);

            if (!exists) {
              password.addHistory(newHistory);
              password.show('history', true);
            }
          }

          const historiesElements = contentPasswords.querySelectorAll(`#show-history-${decryptedPassword.id} .password-history`);

          for (const historyElement of historiesElements) {
            const historyId = historyElement.id.split('-')[2];

            if (historyId) {
              const result = decryptedPassword.histories.find(({id}) => id === historyId);

              if (!result) {
                password.removeHistory(historyId);
                historyElement.remove();
              }
            }
          }
        } else {
          password.show('history', false);
          password.clearHistory();
        }
        
        if (decryptedPassword.platform) {
          password.show('platform', true);
          password.setPlatform(decryptedPassword.platform);
        } else {
          password.show('platform', false);
          password.setPlatform('');
        }

        if (decryptedPassword.url) {
          password.show('url', true);
          password.setUrl(decryptedPassword.url);
        } else {
          password.show('url', false);
          password.setUrl('');
        }

        if (decryptedPassword.username) {
          password.show('username', true);
          password.setUsername(decryptedPassword.username);
        } else {
          password.show('username', false);
          password.setUsername('');
        }

        if (decryptedPassword.email) {
          password.show('email', true);
          password.setEmail(decryptedPassword.email);
        } else {
          password.show('email', false);
          password.setEmail('');
        }

        if (decryptedPassword.description) {
          password.show('description', true);
          password.setDescription(decryptedPassword.description);
        } else {
          password.show('description', false);
          password.setDescription('');
        }

        if (decryptedPassword.modifiedAt) {
          password.show('modifiedat', true);
          password.setModifiedAt(decryptedPassword.modifiedAt);
        } else {
          password.show('modifiedat', false);
          password.setModifiedAt('');
        }

        password.setCollapsibleBodyHeight();
        break;
      }

      case 'deletePassword':
        Password.deletePassword(data.id);

        if (passwordsMap.size === 0) {
          showNoPasswordsMessage(true);
        }

        if (modalPasswordEdit.headerTitle.innerText.endsWith(data.id) && containsClassName(modalPasswordEdit.getModal(), 'active')) {
          modalPasswordEdit.close();
          sendPopup('error', config.messages.password.deleted.replace('%name%', modalPasswordEdit.headerTitle.innerText.split(' #')[0]));
        }

        setAccount('passwords', passwordsMap.size);
        break;

      case 'addAccount':
        new ServerSettingsAccount(data).build();
        
        ServerSettingsAccount.registerClickEvents();
        break;

      case 'updateAccount':
        const account = data;
    
        if (!account.id) return;

        const serverSettingsAccount = ServerSettingsAccount.getAccount(account.id);

        if (modalAccountEdit.headerTitle.innerText.endsWith(account.id) && containsClassName(modalAccountEdit.getModal(), 'active')) {
          modalAccountEdit.close();
          sendPopup('error', config.messages.account.updated.replace('%username%', modalAccountEdit.headerTitle.innerText.split(' #')[0]));
        }
  
        if (account.username) {
          serverSettingsTabContentAccounts.querySelector(`#username-${account.id}`).innerHTML = account.username;
          serverSettingsAccount.setUsername(account.username);
        }
  
        if (account.email) {
          const email = serverSettingsTabContentAccounts.querySelector(`#email-${account.id}`);
          email.innerHTML = account.email;
          email.setAttribute('href', `mailto:${account.email}`);

          serverSettingsAccount.setEmail(account.email);
        }
  
        if (account.passwords != undefined) {
          serverSettingsTabContentAccounts.querySelector(`#passwords-${account.id}`).innerHTML = `${account.passwords}`;
        }

        if (account.passwordLimit) {
          serverSettingsTabContentAccounts.querySelector(`#passwordlimit-${account.id}`).innerHTML = account.passwordLimit;
          serverSettingsAccount.setPasswordsLimit(account.passwordLimit);
        }
  
        if (account.permissionsLevel) {
          const rank = serverSettingsTabContentAccounts.querySelector(`#permissionslevel-${account.id}`);
        
          rank.innerHTML = getRankName(account.permissionsLevel);
          rank.style.color = getRankColor(account.permissionsLevel);

          serverSettingsAccount.setPermissionsLevel(account.permissionsLevel);

          const username = serverSettingsTabContentAccounts.querySelector(`#username-${account.id}`);

          username.style.color = getRankColor(account.permissionsLevel);
  
          const collapsible = serverSettingsTabContentAccounts.querySelector(`button[data-id="${account.id}"]`);
          const collapsibleBody = collapsible.nextElementSibling;
  
          collapsible.dataset.permissionslevel = account.permissionsLevel;
  
          if (account.permissionsLevel == 2) {
            if (collapsible.parentElement.className !== 'collapsible-masters') {
              const collapsibleMasters = serverSettingsTabContentAccounts.querySelector('.collapsible-masters');
              
              collapsibleMasters.appendChild(collapsible);
              collapsibleMasters.appendChild(collapsibleBody);
            }
          } else if (account.permissionsLevel == 1) {
            if (collapsible.parentElement.className !== 'collapsible-admins') {
              const collapsibleAdmins = serverSettingsTabContentAccounts.querySelector('.collapsible-admins');
              
              collapsibleAdmins.appendChild(collapsible);
              collapsibleAdmins.appendChild(collapsibleBody);
            }
          } else if (collapsible.parentElement.className !== 'collapsible-users') {
            const collapsibleUsers = serverSettingsTabContentAccounts.querySelector('.collapsible-users');
            
            collapsibleUsers.appendChild(collapsible);
            collapsibleUsers.appendChild(collapsibleBody); 
          }

          ServerSettingsAccount.registerClickEvents();
        }
  
        if (account.lastLogin) {
          serverSettingsTabContentAccounts.querySelector(`#lastlogin-${account.id}`).innerHTML = account.lastLogin;

          if (account.id === myAccount.id) {
            setAccount('lastLogin', getFullTime(account.lastLogin));
          }
        }
  
        if (account.modifiedAt) {
          serverSettingsTabContentAccounts.querySelector(`#modifiedat-${account.id}`).innerHTML = getFullTime(account.modifiedAt);
        }
        break;

      case 'removeAccount': {
        if (modalAccountEdit.headerTitle.innerText.endsWith(data.id) && containsClassName(modalAccountEdit.getModal(), 'active')) {
          modalAccountEdit.close();
          sendPopup('error', config.messages.account.deleted.replace('%username%', modalAccountEdit.headerTitle.innerText.split(' #')[0]));
        }
  
        const collapsibles = serverSettingsTabContentAccounts.querySelectorAll('.collapsible');
  
        for (let collapsible of collapsibles) {
          if (collapsible.dataset.id === data.id) {
            collapsible.nextElementSibling.remove();
            collapsible.remove();
          }
        }
        break;
      }
      case 'updateServer':
        updateServerStats(data);
        break;

      case 'updateLogs':
        if (containsClassName(serverSettingsTabItemLogs, 'active')) {
          serverSettingsCardLogs.addMessage(data.message);
        }
        break;

      case 'updateSession':
        updateSession(data.session);
        break;

      case 'removeSession':
        removeSession(data.id);
        break;

      case 'addPasswordToTrash':
        addPasswordToTrash(data.password);
        myAccount.passwordTrash.push(data.password);
        handleShowPasswordTrash();
        break;

      case 'deletePasswordFromTrash':
        deletePasswordFromTrash(data.id);
        handleShowPasswordTrash();
        break;

      default:
        throw new Error('Unknown socket message type');
    }
  };
}

function setCookie(cookieName, cookieValue, expiresDays) {
  let d = new Date();
  d.setTime(d.getTime() + (expiresDays*24*60*60*1000));
  let expires = "expires="+ d.toUTCString();
  document.cookie = cookieName + "=" + cookieValue + ";" + expires + ";path=/; Secure";
}

function getCookies() {
  let c = document.cookie, v = 0, cookies = {};
  if (document.cookie.match(/^\s*\$Version=(?:"1"|1);\s*(.*)/)) {
    c = RegExp.$1;
    v = 1;
  }
  if (v === 0) {
    c.split(/[,;]/).map(function(cookie) {
      let parts = cookie.split(/=/, 2),
        name = decodeURIComponent(parts[0].trimLeft()),
        value = parts.length > 1 ? decodeURIComponent(parts[1].trimRight()) : null;
      cookies[name] = value;
    });
  } else {
    c.match(/(?:^|\s+)([!#$%&'*+\-.0-9A-Z^`a-z|~]+)=([!#$%&'*+\-.0-9A-Z^`a-z|~]*|"(?:[\x20-\x7E\x80\xFF]|\\[\x00-\x7F])*")(?=\s*[,;]|$)/g).map(function($0, $1) {
      let name = $0,
        value = $1.charAt(0) === '"'
                ? $1.substr(1, -1).replace(/\\(.)/g, "$1")
                : $1;
      cookies[name] = value;
    });
  }
  return cookies;
}

function getCookie(name) {
  return getCookies()[name];
}