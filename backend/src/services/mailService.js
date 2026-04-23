const nodemailer = require("nodemailer")

function getTransportConfig() {
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!user || !pass) {
    throw new Error("Configuration SMTP incomplète. Renseigner SMTP_USER et SMTP_PASS dans .env.")
  }

  return {
    host: process.env.SMTP_HOST || "smtp.gmail.com",
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE || "true") !== "false",
    auth: {
      user,
      pass
    }
  }
}

async function sendTextMail({ to, cc = "", bcc = "", subject, text }) {
  const transport = nodemailer.createTransport(getTransportConfig())
  const result = await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to,
    cc: cc || undefined,
    bcc: bcc || undefined,
    subject,
    text
  })

  return {
    accepted: result.accepted || [],
    rejected: result.rejected || [],
    messageId: result.messageId || ""
  }
}

module.exports = {
  sendTextMail,
  getTransportConfig
}
