const popupContainer = document.querySelector('#popup-container');

function sendPopup(type, message) {
  const popup = createElement('div', {class: `popup popup-${type}`});
  popupContainer.appendChild(popup);

  const popupMessage = createElement('div', {class: 'popup-message'}, message);
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

const form = document.querySelector('form');
const errorMessage = 'Login credentials are invalid';
let config = undefined;

fetch('login/data')
.then(response => response.json())
.then(result => {
  config = {
    min: result.username.min > result.email.min ? result.email.min : result.username.min,
    max: result.username.max < result.email.max ? result.email.max : result.username.max,
    password: result.password
  };

  result.username.min > result.email.min ? form.login.setAttribute('minlength', result.email.min) : form.login.setAttribute('minlength', result.username.min);
  result.username.max < result.email.max ? form.login.setAttribute('maxlength', result.email.max) : form.login.setAttribute('maxlength', result.username.max);
});

form.onsubmit = (event) => {
  event.preventDefault();

  if (!form.login.value || form.login.value.length < config.min || form.login.value.length > config.max) {
    sendPopup('error', errorMessage);
    return;
  }

  if (!form.password.value || form.password.value.length < config.password.min || form.password.value.length > config.password.max) {
    sendPopup('error', errorMessage);
    return;
  }

  fetch(`login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: `${form.login.value.includes('@') ? `email=${form.login.value.toLowerCase()}` : `username=${form.login.value}`}&password=${form.password.value}`
  })
  .then(response => response.json())
  .then(result => {
    if (result.success) {
      const encrypted = CryptoJS.AES.encrypt(form.password.value, getCookie('user_session'));
      localStorage.setItem('key', encrypted);
      
      window.location.href = result.location;
    } else {
      sendPopup('error', errorMessage);
    }
  }).catch((error) => console.error(error));
};

function createElement(tag, attributes, html) {
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
  if (html) {
    element.innerHTML = html;
  }
  return element;
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