const crypto = require("crypto")
const { validateEmailAddress, validateEmailList } = require("./emailValidationService")

function normalizeBoolean(value) {
  return value === true || value === "true"
}

function normalizeOrganizationName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex")
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${derivedKey}`
}

function validateAccountRequestPayload(payload, dependencies = {}) {
  const {
    findExistingMailboxEmail,
    findAccountByEmail,
    findOpenRequestByPlannedMailboxEmail
  } = dependencies

  const issues = []
  const emailValidation = validateEmailAddress(payload.email, { required: true })
  const plannedMailboxesValidation = validateEmailList(payload.plannedMailboxes, { required: false })

  if (!payload.firstName?.trim()) issues.push("Le prénom est requis.")
  if (!payload.lastName?.trim()) issues.push("Le nom est requis.")
  if (!payload.password || String(payload.password).length < 10) issues.push("Le mot de passe doit contenir au moins 10 caractères.")
  if (!emailValidation.ok) issues.push(emailValidation.message)
  if (!plannedMailboxesValidation.ok) issues.push(plannedMailboxesValidation.message)
  if (plannedMailboxesValidation.ok && Array.isArray(plannedMailboxesValidation.normalized)) {
    const existingMailboxEmail = plannedMailboxesValidation.normalized.find((email) => Boolean(findExistingMailboxEmail?.(email)))
    if (existingMailboxEmail) {
      issues.push(`Boîte mail déjà enregistrée dans l'application : ${existingMailboxEmail}.`)
    }

    const existingAccountEmail = plannedMailboxesValidation.normalized.find((email) => Boolean(findAccountByEmail?.(email)))
    if (existingAccountEmail) {
      issues.push(`Adresse déjà utilisée par un compte de l'application : ${existingAccountEmail}.`)
    }

    const existingRequestedMailboxEmail = plannedMailboxesValidation.normalized.find((email) => Boolean(findOpenRequestByPlannedMailboxEmail?.(email)))
    if (existingRequestedMailboxEmail) {
      issues.push(`Boîte mail déjà demandée dans une autre demande ouverte : ${existingRequestedMailboxEmail}.`)
    }
  }

  if (!normalizeBoolean(payload.consent)) issues.push("Le consentement est requis.")

  if (payload.accountType && payload.accountType !== "individuel" && !payload.organizationName?.trim()) {
    issues.push("Une organisation est requise pour ce type de compte.")
  }

  return {
    issues,
    emailValidation,
    plannedMailboxesValidation
  }
}

function validatePlannedMailboxEmails(value, dependencies = {}) {
  const {
    findExistingMailboxEmail,
    findAccountByEmail,
    findOpenRequestByPlannedMailboxEmail
  } = dependencies

  const issues = []
  const plannedMailboxesValidation = validateEmailList(value, { required: false })
  if (!plannedMailboxesValidation.ok) {
    issues.push(plannedMailboxesValidation.message)
    return {
      ok: false,
      issues,
      plannedMailboxesValidation
    }
  }

  if (Array.isArray(plannedMailboxesValidation.normalized)) {
    const existingMailboxEmail = plannedMailboxesValidation.normalized.find((email) => Boolean(findExistingMailboxEmail?.(email)))
    if (existingMailboxEmail) {
      issues.push(`Boîte mail déjà enregistrée dans l'application : ${existingMailboxEmail}.`)
    }

    const existingAccountEmail = plannedMailboxesValidation.normalized.find((email) => Boolean(findAccountByEmail?.(email)))
    if (existingAccountEmail) {
      issues.push(`Adresse déjà utilisée par un compte de l'application : ${existingAccountEmail}.`)
    }

    const existingRequestedMailboxEmail = plannedMailboxesValidation.normalized.find((email) => Boolean(findOpenRequestByPlannedMailboxEmail?.(email)))
    if (existingRequestedMailboxEmail) {
      issues.push(`Boîte mail déjà demandée dans une autre demande ouverte : ${existingRequestedMailboxEmail}.`)
    }
  }

  return {
    ok: issues.length === 0,
    issues,
    plannedMailboxesValidation
  }
}

function resolveAccountRequestAttachment(payload, dependencies = {}) {
  const { listAccounts } = dependencies
  const accountType = payload.accountType || "individuel"
  const superAdmin = listAccounts({ role: "super_admin", status: "active" })[0] || null
  const emailValidation = validateEmailAddress(payload.email, { required: true })

  if (!emailValidation.ok) {
    const error = new Error(emailValidation.message || "Adresse mail invalide.")
    error.statusCode = 400
    error.details = ["Merci de corriger l'adresse mail avant de poursuivre."]
    throw error
  }

  if (!superAdmin) {
    const error = new Error("Aucun super administrateur actif n'est disponible pour traiter cette demande.")
    error.statusCode = 503
    error.details = ["Merci de finaliser d'abord le bootstrap du super administrateur."]
    throw error
  }

  if (accountType === "individuel") {
    return {
      assignedAdminAccountId: superAdmin.id,
      assignedAdminEmail: String(superAdmin.email || "").trim().toLowerCase(),
      attachmentLabel: "Demande envoyée à l’administrateur compétent.",
      organizationMatched: true,
      organizationName: ""
    }
  }

  const organizationName = payload.organizationName?.trim() || ""
  const normalizedOrganizationName = normalizeOrganizationName(organizationName)
  if (!normalizedOrganizationName) {
    const error = new Error("Organisation obligatoire pour ce type de compte.")
    error.statusCode = 400
    error.details = ["Merci de sélectionner une organisation reconnue avant d'envoyer la demande."]
    throw error
  }

  const matchingAdmins = listAccounts({ role: "admin", status: "active" }).filter((account) => (
    normalizeOrganizationName(account.organization_name || account.organizationName || "") === normalizedOrganizationName
  ))

  if (matchingAdmins.length === 0) {
    const error = new Error("Aucun administrateur de rattachement n'a été trouvé pour cette organisation.")
    error.statusCode = 400
    error.details = ["L'organisation saisie n'est pas reconnue. Vérifiez son libellé exact avant de valider la demande."]
    throw error
  }

  if (matchingAdmins.length > 1) {
    const error = new Error("Plusieurs administrateurs actifs correspondent à cette organisation.")
    error.statusCode = 400
    error.details = ["Le rattachement est ambigu. Merci de contacter l'administrateur principal avant de poursuivre."]
    throw error
  }

  const admin = matchingAdmins[0]
  return {
    assignedAdminAccountId: admin.id,
    assignedAdminEmail: String(admin.email || "").trim().toLowerCase(),
    attachmentLabel: "Demande envoyée à l’administrateur compétent.",
    organizationMatched: true,
    organizationName: admin.organization_name || admin.organizationName || organizationName
  }
}

function buildStoredAccountRequest(payload, attachment) {
  const documentRequired = normalizeBoolean(payload.disabilityUsage) || payload.accountType !== "individuel"
  const supportingDocumentName = payload.supportingDocumentName?.trim() || ""
  const plannedMailboxesValidation = validateEmailList(payload.plannedMailboxes, { required: false })
  const now = new Date().toISOString()

  return {
    id: `req-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
    status: documentRequired && !supportingDocumentName ? "more_info_requested" : "pending",
    accountType: payload.accountType || "individuel",
    usageMode: payload.usageMode || "gratuit",
    firstName: payload.firstName.trim(),
    lastName: payload.lastName.trim(),
    email: payload.email.trim().toLowerCase(),
    phone: payload.phone?.trim() || "",
    organizationName: attachment.organizationName || payload.organizationName?.trim() || "",
    disabilityUsage: normalizeBoolean(payload.disabilityUsage),
    plannedMailboxes: plannedMailboxesValidation.ok ? plannedMailboxesValidation.normalized.join(", ") : "",
    motivation: payload.motivation?.trim() || "",
    documentRequired,
    supportingDocumentName,
    adminNotes: "",
    requestedAdditionalInfo: "",
    reviewedBy: "",
    reviewedAt: "",
    linkedAccountId: "",
    passwordHash: hashPassword(payload.password),
    assignedAdminAccountId: attachment.assignedAdminAccountId || "",
    assignedAdminEmail: attachment.assignedAdminEmail || "",
    localNote: documentRequired && !supportingDocumentName
      ? "Demande reçue, mais justificatif encore attendu."
      : "Demande reçue et prête pour revue administrative."
  }
}

module.exports = {
  normalizeBoolean,
  normalizeOrganizationName,
  validateAccountRequestPayload,
  validatePlannedMailboxEmails,
  resolveAccountRequestAttachment,
  buildStoredAccountRequest
}
