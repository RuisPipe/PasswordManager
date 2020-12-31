const {nodemailer, config, getFullTime} = require('../../app.js');

let transporter = undefined;

exports.connect = async () => {
  if (!config.email.enabled) return;

  transporter = nodemailer.createTransport({
    host: config.email.host,
    port: config.email.port,
    secure: config.email.secure,
    auth: {
      user: config.email.auth.user,
      pass: config.email.auth.pass
    },
    tls: {
      ciphers: config.email.tls.ciphers
    },
    debug: false
  });
}

exports.sendEmail = async (receiver, subject, html, attachments) => {
  if (!config.email.enabled) return;

  transporter.verify(function (error, sucess) {
    if (error) throw error;
  });

  transporter.sendMail({
    from: `"${config.informations.name}" ${config.informations.from}`,
    to: receiver,
    subject: subject,
    html: html,
    attachments: attachments === undefined ? undefined : attachments
  });
}