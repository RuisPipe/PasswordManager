module.exports = {
  hostname: '127.0.0.1',
  port: 50000,
  informations: { // about this service for email
    name: 'PasswordManager',
    from: 'no-reply@roese.dev',
    supportEmail: 'support@roese.dev',
    domain: 'roese.dev'
  },
  cookieMaxAge: 604800000, // 7 days in milliseconds
  redirectPath: '/login',
  email: {
    enabled: false,
    host: 'YOUR HOST',
    port: 25,
    secure: false,
    auth: {
      user: 'ruispipe@roese.dev',
      pass: 'password'
    },
    tls: {
      ciphers:'SSLv3'
    },
  },
  messages: {
    noPermissions: "You don't have permissions to use this",
    noAccounts: "You don't have accounts",
    noPasswords: "You don't have passwords",
    noPermissions: "You don't have permissions to use this",
    noAccountLogs: 'This account has no logs',
    password: {
      created: 'Password <strong>%name%</strong> was created',
      deleted: 'Password <strong>%name%</strong> was deleted',
      updated: 'Password <strong>%name%</strong> was updated',
      typeNotValid: '<strong>%type%</strong> is not valid',
      nameNotAvailable: 'Password <strong>%name%</strong> is not available',
      wasUpdated: 'Password was already updated',
      imported: 'Passwords imported' // import passwords from file
    },
    account: {
      created: 'Account <strong>%username%</strong> was created',
      deleted: 'Account <strong>%username%</strong> was deleted',
      updated: 'Account <strong>%username%</strong> was updated',
      meUpdated: 'Your account was updated',
      usernameNotValid: 'Username <strong>%username%</strong> is not valid',
      usernameNotAvailable: 'Username <strong>%username%</strong> is not available',
      emailNotValid: 'Email <strong>%email%</strong> is not valid',
      emailNotAvailable: 'Email <strong>%email%</strong> is not available',
      passwordLimitReached: 'You have reached your password limit'
    }
  },
  colors: {
    rankMaster: '#8854d0',            // purple
    rankAdmin: '#c0392b',             // red
    rankUser: '#d1d1d1',              // white-grey
    createdAt: '#44bd32',             // green
    modifiedAt: '#e67e22',            // orange
    deletedAt: '#c0392b',             // red
    red: '#c0392b',                   
    buttonLastAndNext: '#363636',     // dark-grey
    hashtag: '#d1d1d1',               // grey
    session: {
      current: '#44bd32',             // green
      lastAccessed: '#e67e22'         // orange
    }
  },
  logs: {
    enabled: true,
    deleteDays: 7
  },
  password: {
    name: {
      min: 3,
      max: 50
    },
    platform: {
      min: 3,
      max: 50
    },
    url: {
      min: 3,
      max: 50
    },
    username: {
      min: 3,
      max: 50
    },
    email: {
      min: 3,
      max: 50
    },
    description: {
      min: 3,
      max: 5000
    },
    password: {
      min: 6,
      max: 128,
      default: 16, // default value for slider
    }
  },
  account: {
    username: {
      min: 3,
      max: 30
    },
    email: {
      min: 3,
      max: 50
    },
    password: {
      min: 6,
      max: 128,
      default: 16, // default value for slider
      limit: 5000 // max passwords for a account
    },
    logs: {
      enabled: true,
      deleteDays: 7
    }
  },
  symbols: {
    min: 1,
    max: 32,
    default: '!"#$%`’(+),*-./:;<@>[\']^_`{|}~'
  }
};