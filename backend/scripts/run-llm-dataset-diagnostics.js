#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../..", ".env") })

const fs = require("fs")
const path = require("path")
const { createReplyDiagnostic } = require("../src/controllers/mailController")

const DEFAULT_MODELS = ["deepseek-chat"]
const DATASET_PATH = path.join(__dirname, "../../docs/Tests/jeu-essai-gmail/mails-test.json")

const GENERAL_RULES = [
  "1. Ne jamais confirmer une information absente du contexte.",
  "2. Si une information necessaire manque, produire une reponse prudente et demander un complement ou une verification.",
  "3. Utiliser d'abord le contenu effectivement traite par l'application pour les pieces jointes.",
  "4. Ne pas confirmer la conformite, la lisibilite ou la validite d'un document si son contenu n'a pas ete exploite automatiquement.",
  "5. En cas de doute, demander un complement ou une validation humaine."
].join("\n")

function parseArgs(argv = []) {
  const options = {
    start: 1,
    limit: 5,
    models: [],
    promptMode: "reference"
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === "--limit") {
      options.limit = Number(argv[index + 1] || 5)
      index += 1
      continue
    }
    if (arg === "--start") {
      options.start = Number(argv[index + 1] || 1)
      index += 1
      continue
    }
    if (arg === "--models") {
      options.models = String(argv[index + 1] || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
      index += 1
      continue
    }
    if (arg === "--prompt-mode") {
      options.promptMode = String(argv[index + 1] || "reference").trim().toLowerCase() || "reference"
      index += 1
    }
  }

  return options
}

function loadDataset() {
  return JSON.parse(fs.readFileSync(DATASET_PATH, "utf8"))
}

function inferMailCategory(mail) {
  const subject = String(mail.subject || "").toLowerCase()
  const body = String(mail.body || "").toLowerCase()
  const text = `${subject}\n${body}`

  if (text.includes("facture")) return "question_facture"
  if (text.includes("document")) return "demande_document"
  if (text.includes("relance")) return "relance"
  if (text.includes("probleme")) return "reclamation"
  if (text.includes("renseignement") || text.includes("savoir")) return "demande_information"
  return "global"
}

function buildPayload(mail) {
  const attachments = Array.isArray(mail.attachments) ? mail.attachments : []
  return {
    applicationScope: "mail_assistant",
    workflowScope: "reply",
    mailboxScope: "global",
    mailCategoryScope: inferMailCategory(mail),
    receivedMail: [
      `From : ${mail.from_name} <${mail.from_email}>`,
      `Date : ${mail.date}`,
      `Objet : ${mail.subject}`,
      "",
      `${mail.body || ""}`
    ].join("\n"),
    receivedAttachmentsSummary: attachments.length > 0
      ? `${attachments.length} pièce(s) jointe(s) détectée(s) : ${attachments.map((item) => item.filename).join(", ")}`
      : "Aucune pièce jointe détectée",
    receivedAttachments: attachments.map((attachment) => ({
      filename: attachment.filename,
      mimeType: "application/octet-stream",
      extractedText: "",
      summaryText: attachment.description || "",
      analysisStatus: "detected_only"
    }))
  }
}

async function runScenario(mail, model, scenario, promptMode = "reference") {
  const payload = buildPayload(mail)
  const startedAt = Date.now()
  const withRules = scenario === "avec_regle"

  const result = await createReplyDiagnostic({
    ...payload,
    activeRulesText: withRules ? GENERAL_RULES : "",
    disableStoredRules: !withRules
  }, {
    model,
    rulesPromptMode: promptMode
  })

  return {
    mailId: mail.id,
    subject: mail.subject,
    model,
    scenario,
    promptMode,
    elapsedMs: Date.now() - startedAt,
    fallback: Boolean(result.meta?.fallback),
    appliedRuleCount: Number(result.meta?.appliedRuleCount || 0),
    contextSufficient: Boolean(result.diagnostic?.contextSufficient),
    shouldConsultRules: Boolean(result.diagnostic?.shouldConsultRules),
    rulesWouldHelp: Boolean(result.diagnostic?.rulesWouldHelp),
    missingInformation: result.diagnostic?.missingInformation || [],
    reasoningSummary: result.diagnostic?.reasoningSummary || "",
    draftResponse: result.diagnostic?.draftResponse || ""
  }
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const dataset = loadDataset()
  const startIndex = Math.max(0, Number(options.start || 1) - 1)
  const mails = (dataset.mails || []).slice(startIndex, startIndex + Math.max(1, options.limit || 5))
  const models = options.models.length > 0 ? options.models : DEFAULT_MODELS
  const rows = []

  for (const mail of mails) {
    for (const model of models) {
      rows.push(await runScenario(mail, model, "sans_regle", options.promptMode))
      rows.push(await runScenario(mail, model, "avec_regle", options.promptMode))
    }
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    dataset: dataset.dataset_name,
    start: startIndex + 1,
    limit: mails.length,
    models,
    promptMode: options.promptMode,
    rows
  }, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
