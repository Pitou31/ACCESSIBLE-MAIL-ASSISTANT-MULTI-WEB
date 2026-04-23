#!/usr/bin/env node

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") })

const fs = require("fs")
const path = require("path")
const nodemailer = require("nodemailer")
const { getTransportConfig } = require("../src/services/mailService")

const datasetPath = path.resolve(__dirname, "../../docs/Tests/jeu-essai-gmail/mails-test.json")
const attachmentsDirectory = path.resolve(__dirname, "../../docs/Tests/jeu-essai-gmail/pieces-jointes")

function parseArgs(argv) {
  const args = {
    to: "",
    dryRun: false
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === "--to") {
      args.to = argv[index + 1] || ""
      index += 1
      continue
    }

    if (value === "--dry-run") {
      args.dryRun = true
    }
  }

  return args
}

function loadDataset() {
  const raw = fs.readFileSync(datasetPath, "utf8")
  return JSON.parse(raw)
}

function resolveAttachment(attachment) {
  if (!attachment?.filename) {
    return null
  }

  const filePath = path.join(attachmentsDirectory, attachment.filename)
  if (!fs.existsSync(filePath)) {
    throw new Error(`Pièce jointe introuvable : ${attachment.filename}`)
  }

  return {
    filename: attachment.filename,
    path: filePath
  }
}

async function sendDataset(targetEmail, dryRun) {
  if (!targetEmail) {
    throw new Error("Adresse cible manquante. Utiliser --to adresse@gmail.com")
  }

  const dataset = loadDataset()
  const mails = Array.isArray(dataset.mails) ? dataset.mails : []

  if (dryRun) {
    console.log(`DRY RUN - ${mails.length} mails seraient envoyés à ${targetEmail}`)
    mails.forEach((mail) => {
      console.log(`- ${mail.id} | ${mail.subject}`)
    })
    return
  }

  const transport = nodemailer.createTransport(getTransportConfig())
  const sender = process.env.MAIL_FROM || process.env.SMTP_USER

  for (const mail of mails) {
    const attachments = Array.isArray(mail.attachments)
      ? mail.attachments.map(resolveAttachment).filter(Boolean)
      : []

    const result = await transport.sendMail({
      from: `"${mail.from_name}" <${process.env.SMTP_USER}>`,
      replyTo: `${mail.from_name} <${mail.from_email}>`,
      to: targetEmail,
      subject: mail.subject,
      text: mail.body,
      attachments,
      headers: {
        "X-Test-Mail-Id": mail.id,
        "X-Test-Original-From": mail.from_email,
        "X-Test-Dataset": dataset.dataset_name || "jeu_essai_gmail"
      }
    })

    console.log(`OK ${mail.id} -> ${targetEmail} (${result.messageId || "sent"})`)
  }

  console.log(`Envoi terminé : ${mails.length} mails envoyés à ${targetEmail}`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const targetEmail = args.to || process.env.TEST_GMAIL_RECIPIENT || ""

  await sendDataset(targetEmail, args.dryRun)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })
}

module.exports = {
  sendDataset
}
