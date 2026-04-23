const {
  insertAccountRequest,
  createPendingAccountFromRequest,
  findOpenRequestByEmail,
  findOpenRequestByPlannedMailboxEmail,
  findOpenRequestByEmailAndType,
  findAccountByEmail,
  findAccountByEmailAndType,
  findExistingMailboxEmail,
  listAccounts,
  getDatabaseInfo,
  openDatabase
} = require("./databaseService")
const { sendTextMail } = require("./mailService")
const { validateHumanVerification } = require("./humanVerificationService")
const {
  validateAccountRequestPayload,
  validatePlannedMailboxEmails,
  resolveAccountRequestAttachment,
  buildStoredAccountRequest
} = require("./accountRequestRulesService")

function normalizeBoolean(value) {
  return value === true || value === "true"
}

function validatePayload(payload) {
  return validateAccountRequestPayload(payload, {
    findExistingMailboxEmail,
    findAccountByEmail,
    findOpenRequestByPlannedMailboxEmail
  }).issues
}

function resolveAdminAttachment(payload) {
  return resolveAccountRequestAttachment(payload, { listAccounts })
}

function lookupAdminAttachment(payload) {
  return resolveAdminAttachment(payload)
}

function lookupPlannedMailboxIssues(value) {
  return validatePlannedMailboxEmails(value, {
    findExistingMailboxEmail,
    findAccountByEmail,
    findOpenRequestByPlannedMailboxEmail
  })
}

function buildStoredRequest(payload, attachment) {
  return buildStoredAccountRequest(payload, attachment)
}

function buildAdminMail(request) {
  const to = request.assignedAdminEmail || process.env.ADMIN_ALERT_EMAIL || "jsoule2010@gmail.com"
  const lines = [
    "Nouvelle demande d'ouverture de compte",
    "",
    `Identité : ${request.firstName} ${request.lastName}`,
    `Email : ${request.email}`,
    `Téléphone : ${request.phone || "Non renseigné"}`,
    `Type de compte : ${request.accountType}`,
    `Mode d'usage : ${request.usageMode}`,
    `Organisation : ${request.organizationName || "Non renseignée"}`,
    `Mention Handicapé : ${request.disabilityUsage ? "Oui" : "Non"}`,
    `Boîtes mail prévues : ${request.plannedMailboxes || "Non précisées"}`,
    `Justificatif requis : ${request.documentRequired ? "Oui" : "Non"}`,
    `Justificatif fourni : ${request.supportingDocumentName || "Non"}`,
    "",
    "Contexte d'usage :",
    request.motivation || "Non renseigné",
    "",
    `Statut initial : ${request.status}`,
    `Créée le : ${new Date(request.createdAt).toLocaleString("fr-FR")}`
  ]

  return {
    to,
    subject: `Nouvelle demande de compte - ${request.firstName} ${request.lastName}`,
    text: lines.join("\n")
  }
}

async function sendAdminAlert(request) {
  const mail = buildAdminMail(request)
  return sendTextMail(mail)
}

async function createAccountRequest(payload) {
  const issues = validatePayload(payload)
  const humanValidation = await validateHumanVerification(payload)
  if (!humanValidation.ok) {
    issues.push(humanValidation.message || "Merci de confirmer que vous êtes un humain.")
  }
  if (issues.length > 0) {
    const error = new Error("Demande invalide")
    error.statusCode = 400
    error.details = issues
    throw error
  }

  const normalizedEmail = payload.email.trim().toLowerCase()
  const accountType = payload.accountType || "individuel"
  openDatabase()

  const existingAccount = findAccountByEmail(normalizedEmail)
  if (existingAccount) {
    const error = new Error("Un compte existe déjà pour cette adresse email.")
    error.statusCode = 409
    error.details = ["Cette adresse email est déjà rattachée à un compte existant."]
    throw error
  }

  const existingRequest = findOpenRequestByEmail(normalizedEmail)
  if (existingRequest) {
    const error = new Error("Une demande d'ouverture de compte existe déjà pour cette adresse email.")
    error.statusCode = 409
    error.details = ["Demande déjà existante pour cette adresse email. Merci d'attendre son traitement ou de reprendre le suivi de demande."]
    throw error
  }

  const attachment = resolveAdminAttachment(payload)
  const request = buildStoredRequest(payload, attachment)
  insertAccountRequest(request)
  const account = createPendingAccountFromRequest(request)

  const mailResult = await sendAdminAlert(request)

  return {
    request,
    account,
    storage: getDatabaseInfo(),
    adminAlert: {
      message: attachment.attachmentLabel,
      ...mailResult
    }
  }
}

module.exports = {
  createAccountRequest,
  lookupAdminAttachment,
  lookupPlannedMailboxIssues
}
