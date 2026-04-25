const crypto = require("crypto")
const { runAIWithTimeout } = require("../services/aiTimeoutService")
const {
  hasAnyAdminAccount,
  createAdminAccount,
  insertAccountRequest,
  createPendingAccountFromRequest,
  createUserSession,
  createPasswordResetToken,
  closeUserSessionsForAccount,
  listAccountRequests,
  listAccounts,
  listMailboxResourcesAdmin,
  listMailRules,
  createMailRule,
  updateMailRule,
  setMailRuleStatus,
  updateAccountRequestStatus,
  updateAccountStatus,
  updateAccountPassword,
  deleteAccountPermanently,
  getAccountById,
  listSecurityEvents,
  getPriorityRulesConfig,
  setPriorityRulesConfig,
  updateMailboxResource
} = require("../services/databaseService")
const { sendTextMail } = require("../services/mailService")
const { validateEmailAddress } = require("../services/emailValidationService")
const { validateHumanVerification } = require("../services/humanVerificationService")
const { enforceSecurityRateLimit, recordSecurityEvent } = require("../services/securityService")
const { getSessionPayloadFromRequest } = require("./accountRoutes")
const SESSION_COOKIE_NAME = "mail_assistant_session"
const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000)
const LOCAL_AI_TIMEOUT_MS = Number(process.env.LOCAL_AI_TIMEOUT_MS || 120000)
const REASONER_AI_TIMEOUT_MS = Number(process.env.REASONER_AI_TIMEOUT_MS || 90000)
const ADMIN_ROLES = new Set(["admin", "super_admin"])

function buildSessionCookie(value, options = {}) {
  const parts = [`${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"]
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }
  return parts.join("; ")
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(String(role || "").trim())
}

function findAdminAccountByEmail(email) {
  return listAccounts({ email }).find((account) => isAdminRole(account.role)) || null
}

function findSuperAdminAccount() {
  return listAccounts({ role: "super_admin", status: "active" })[0] || null
}

function findOpenAdminRequestByEmail(email) {
  return listAccountRequests({ email, accountType: "administrateur" }).find((request) => (
    ["pending", "more_info_requested", "approved"].includes(request.status)
  )) || null
}

function isSuperAdminAccount(account) {
  return Boolean(account && account.role === "super_admin")
}

function normalizeOrganizationName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
}

function canAdminSeeRequest(actorAccount, request) {
  if (isSuperAdminAccount(actorAccount)) {
    return true
  }

  if (!actorAccount || actorAccount.role !== "admin" || !request) {
    return false
  }

  if (request.account_type === "administrateur" || request.account_type === "individuel") {
    return false
  }

  const actorOrg = normalizeOrganizationName(actorAccount.organization_name)
  const requestOrg = normalizeOrganizationName(request.organization_name)
  return Boolean(actorOrg && requestOrg && actorOrg === requestOrg)
}

function canAdminSeeAccount(actorAccount, account) {
  if (isSuperAdminAccount(actorAccount)) {
    return true
  }

  if (!actorAccount || actorAccount.role !== "admin" || !account) {
    return false
  }

  if (isAdminRole(account.role)) {
    return account.id === actorAccount.id
  }

  if (account.account_type === "individuel") {
    return false
  }

  const actorOrg = normalizeOrganizationName(actorAccount.organization_name)
  const accountOrg = normalizeOrganizationName(account.organization_name)
  return Boolean(actorOrg && accountOrg && actorOrg === accountOrg)
}

function requireAdminSession(req, res) {
  const payload = getSessionPayloadFromRequest(req)
  if (!payload) {
    res.writeHead(401, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: "Connexion administrateur requise."
    }))
    return null
  }

  if (!isAdminRole(payload.account.role)) {
    res.writeHead(403, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: "Accès administrateur requis."
    }))
    return null
  }

  return payload
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex")
  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex")
  return `${salt}:${derivedKey}`
}

function verifyPassword(password, passwordHash) {
  if (!passwordHash || !password) {
    return false
  }

  const [salt, expectedKey] = passwordHash.split(":")
  if (!salt || !expectedKey) {
    return false
  }

  const derivedKey = crypto.scryptSync(password, salt, 64).toString("hex")
  return crypto.timingSafeEqual(Buffer.from(derivedKey, "hex"), Buffer.from(expectedKey, "hex"))
}

function buildResetPasswordUrl(token) {
  const baseUrl = process.env.APP_BASE_URL || "http://localhost:3000"
  return `${baseUrl}/frontend/reset-password.html?token=${encodeURIComponent(token)}`
}

function extractJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Réponse IA vide.")
  }

  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error("Aucun JSON détecté dans la réponse IA.")
    }
    return JSON.parse(match[0])
  }
}


function buildRuleDraftPrompt({ requestsText = "", operatorComment = "" }) {
  return `
Tu es un assistant chargé d'aider un administrateur à créer une règle métier pour une application de réponse automatique aux mails.

Objectif :
À partir d'une ou plusieurs demandes reçues, proposer une règle métier candidate réutilisable.
Si les informations disponibles ne suffisent pas à produire une règle suffisamment précise, tu dois :
- l'indiquer explicitement,
- lister ce qu'il manque,
- formuler les questions minimales à poser à l'administrateur pour finaliser la règle.

Contraintes :
- ne pas créer une règle spécifique à un seul mail,
- identifier le motif métier commun,
- produire une règle générale applicable à plusieurs demandes du même type,
- viser une réponse définitive dès le premier run si possible,
- sinon une demande de complément minimale côté usager,
- ne pas inventer de données métier absentes,
- signaler clairement si la règle reste trop vague sans complément administrateur.

Réponds uniquement en JSON valide avec cette structure :
{
  "motif_metier": "motif identifié",
  "merite_une_regle": true,
  "niveau_standardisation": "faible|moyen|fort",
  "justification": "explication courte",
  "regle_candidate": {
    "titre": "titre proposé",
    "objectif": "objectif opérationnel",
    "texte_regle": "texte complet de la règle candidate",
    "niveau_precision": "insuffisant|correct|bon",
    "utilisable_immediatement": false
  },
  "points_a_preciser": ["point manquant 1"],
  "questions_pour_admin": ["question 1"],
  "impact_attendu": {
    "peut_repondre_en_one_shot": true,
    "sinon_demander": ["complément minimal 1"]
  },
  "sources_ou_services_utiles": [
    {
      "type": "regle_interne|fichier|base_de_donnees|site_web|api|aucun",
      "description": "source ou service utile"
    }
  ],
  "prochaine_action_recommandee": "creer_la_regle|completer_les_parametres_admin|ne_pas_creer_de_regle"
}

Commentaire opérateur éventuel :
${operatorComment || "Aucun commentaire opérateur"}

Demandes à analyser :
${requestsText || "Aucune demande fournie"}
  `.trim()
}

function buildRuleFinalizePrompt({ requestsText = "", operatorComment = "", draftJsonText = "", adminAnswersText = "" }) {
  return `
Tu es un assistant chargé de finaliser une règle métier pour une application de réponse automatique aux mails.

Tu disposes :
- de la ou des demandes d'origine,
- d'une règle candidate,
- et des réponses apportées par l'administrateur pour la rendre exploitable.

Objectif :
Produire la règle finale prête à être enregistrée dans le référentiel métier.

Contraintes :
- la règle doit rester générale et réutilisable,
- elle doit viser une réponse définitive dès le premier run si possible,
- sinon une demande de complément minimale et ciblée,
- elle ne doit pas contenir de formulation vague,
- n'invente aucune donnée métier absente des réponses administrateur,
- si certaines données restent absentes, le signaler dans les notes.

Réponds uniquement en JSON valide avec cette structure :
{
  "final_rule": {
    "title": "titre final",
    "content": "texte complet final de la règle",
    "rule_type": "content|prudence|validation|missing_info|source_access",
    "priority_rank": 100,
    "application_scope": "mail_assistant",
    "mailbox_scope": "global",
    "mail_category_scope": "global",
    "workflow_scope": "reply",
    "theme": "theme principal",
    "missing_info_action": "cautious_reply|ask_for_more|block_final_reply|require_human_validation|require_external_source",
    "status": "active",
    "notes": "note interne éventuelle"
  },
  "summary": "résumé court de la règle finale",
  "remaining_gaps": ["lacune restante 1"]
}

Commentaire opérateur éventuel :
${operatorComment || "Aucun commentaire opérateur"}

Demandes source :
${requestsText || "Aucune demande fournie"}

Règle candidate :
${draftJsonText || "Aucune règle candidate fournie"}

Réponses de l'administrateur :
${adminAnswersText || "Aucune réponse administrateur fournie"}
  `.trim()
}

async function handleAdminLogin(req, res, body) {
  try {
    const payload = JSON.parse(body || "{}")
    const email = payload.email?.trim().toLowerCase() || ""
    const password = payload.password || ""
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "admin_login",
      eventType: "admin_login_attempt",
      route: "/api/admin/login"
    })) {
      return
    }
    const humanValidation = await validateHumanVerification(payload, {
      remoteIp: req.socket?.remoteAddress || ""
    })

    if (!email || !password) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Email admin ou mot de passe manquant."
      }))
      return
    }

    if (!humanValidation.ok) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: humanValidation.message || "Vérification humaine invalide."
      }))
      return
    }

    const adminAccount = findAdminAccountByEmail(email)

    if (!adminAccount) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Aucun compte administrateur trouvé pour cet email."
      }))
      return
    }

    if (adminAccount.status !== "active") {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Le compte administrateur existe mais n'est pas actif."
      }))
      return
    }

    const exact = getAccountById(adminAccount.id)
    if (!exact?.password_hash) {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Aucun mot de passe n'est défini pour ce compte administrateur."
      }))
      return
    }

    if (!verifyPassword(password, exact.password_hash)) {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Mot de passe administrateur incorrect."
      }))
      return
    }

    closeUserSessionsForAccount(adminAccount.id)
    const session = createUserSession(adminAccount)
    recordSecurityEvent(req, payload, {
      eventType: "admin_login_attempt",
      severity: "info",
      status: "success",
      route: "/api/admin/login",
      actorId: adminAccount.id
    })

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": buildSessionCookie(session.id)
    })
    res.end(JSON.stringify({
      ok: true,
      account: adminAccount,
      session: {
        userId: adminAccount.id,
        email: adminAccount.email,
        firstName: adminAccount.first_name,
        lastName: adminAccount.last_name,
        accountType: adminAccount.account_type,
        role: adminAccount.role,
        status: adminAccount.status,
        productVersion: adminAccount.product_version,
        startedAt: session.created_at,
        accountActive: 1
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de connexion administrateur."
    }))
  }
}

async function handleAdminChangePassword(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const currentPassword = payload.currentPassword || ""
    const newPassword = payload.newPassword || ""
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "password_action",
      eventType: "admin_password_change_attempt",
      route: "/api/admin/change-password"
    })) {
      return
    }
    const humanValidation = await validateHumanVerification(payload, {
      remoteIp: req.socket?.remoteAddress || ""
    })

    if (!currentPassword || !newPassword || newPassword.length < 10) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Informations insuffisantes ou nouveau mot de passe trop court."
      }))
      return
    }

    if (!humanValidation.ok) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: humanValidation.message || "Vérification humaine invalide."
      }))
      return
    }

    const exact = getAccountById(sessionPayload.account.id)
    if (!exact?.password_hash || !verifyPassword(currentPassword, exact.password_hash)) {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Mot de passe administrateur actuel incorrect."
      }))
      return
    }

    const finalAccount = updateAccountPassword(exact.id, hashPassword(newPassword), {
      reviewedBy: exact.email,
      notes: "Mot de passe changé par l'administrateur connecté."
    })

    await sendTextMail({
      to: finalAccount.email,
      subject: "Votre mot de passe administrateur a été modifié",
      text: [
        "Votre mot de passe administrateur a bien été modifié.",
        "",
        `Compte : ${finalAccount.id}`,
        `Email : ${finalAccount.email}`
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      account: {
        id: finalAccount.id,
        email: finalAccount.email,
        role: finalAccount.role,
        status: finalAccount.status
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors du changement de mot de passe administrateur."
    }))
  }
}

async function handleAdminForgotPassword(req, res, body) {
  try {
    const payload = JSON.parse(body || "{}")
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "password_action",
      eventType: "admin_forgot_password_blocked",
      route: "/api/admin/forgot-password"
    })) {
      return
    }
    res.writeHead(403, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: "La réinitialisation de mot de passe administrateur par email est désactivée."
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la demande de réinitialisation administrateur."
    }))
  }
}

async function sendAdminAndUserActionAlerts({ userEmail, userSubject, userText, adminSubject, adminText }) {
  const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER

  const results = {
    admin: null,
    user: null
  }

  if (adminEmail) {
    results.admin = await sendTextMail({
      to: adminEmail,
      subject: adminSubject,
      text: adminText
    })
  }

  if (userEmail) {
    results.user = await sendTextMail({
      to: userEmail,
      subject: userSubject,
      text: userText
    })
  }

  return results
}

async function handleAdminBootstrap(req, res, body) {
  try {
    if (hasAnyAdminAccount()) {
      res.writeHead(409, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Un compte administrateur existe déjà."
      }))
      return
    }

    const payload = JSON.parse(body || "{}")
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "admin_request",
      eventType: "admin_bootstrap_attempt",
      route: "/api/admin/bootstrap"
    })) {
      return
    }
    const firstName = payload.firstName?.trim() || ""
    const lastName = payload.lastName?.trim() || ""
    const email = payload.email?.trim().toLowerCase() || ""
    const password = payload.password || ""
    const phone = payload.phone?.trim() || ""
    const organizationName = payload.organizationName?.trim() || ""
    const emailValidation = validateEmailAddress(email, { required: true })
    const humanValidation = await validateHumanVerification(payload, {
      remoteIp: req.socket?.remoteAddress || ""
    })

    const issues = []
    if (!firstName) issues.push("Le prénom est requis.")
    if (!lastName) issues.push("Le nom est requis.")
    if (!emailValidation.ok) issues.push(emailValidation.message)
    if (!organizationName) issues.push("L'organisation administrée est requise.")
    if (!password || password.length < 10) issues.push("Le mot de passe doit contenir au moins 10 caractères.")
    if (!humanValidation.ok) issues.push(humanValidation.message)

    if (issues.length > 0) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Formulaire administrateur invalide.",
        details: issues
      }))
      return
    }

    const now = new Date().toISOString()
    const adminAccount = {
      id: `admin-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      status: "active",
      role: "super_admin",
      accountType: "individuel",
      usageMode: "NA",
      productVersion: "automatisation_poussee",
      firstName,
      lastName,
      email: emailValidation.normalized,
      phone,
      organizationName,
      passwordHash: hashPassword(password),
      validatedBy: "bootstrap",
      validatedAt: now,
      sourceRequestId: ""
    }

    createAdminAccount(adminAccount)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      admin: {
        id: adminAccount.id,
        email: adminAccount.email,
        firstName: adminAccount.firstName,
        lastName: adminAccount.lastName,
        organizationName: adminAccount.organizationName,
        role: adminAccount.role,
        status: adminAccount.status
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la création du compte administrateur."
    }))
  }
}

async function handleAdminCreate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "admin_mutation",
      eventType: "admin_create_attempt",
      route: "/api/admin/create"
    })) {
      return
    }
    const firstName = payload.firstName?.trim() || ""
    const lastName = payload.lastName?.trim() || ""
    const email = payload.email?.trim().toLowerCase() || ""
    const password = payload.password || ""
    const phone = payload.phone?.trim() || ""
    const reviewedBy = sessionPayload.account.email || payload.reviewedBy?.trim() || "admin-manuel"

    const issues = []
    if (!firstName) issues.push("Le prénom est requis.")
    if (!lastName) issues.push("Le nom est requis.")
    if (!email) issues.push("L’email est requis.")
    if (!password || password.length < 10) issues.push("Le mot de passe doit contenir au moins 10 caractères.")

    const existingAdmins = listAccounts({ email, role: "admin" })
    if (existingAdmins.length > 0) {
      issues.push("Un administrateur existe déjà pour cette adresse email.")
    }

    if (issues.length > 0) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Formulaire administrateur invalide.",
        details: issues
      }))
      return
    }

    const now = new Date().toISOString()
    const adminAccount = {
      id: `admin-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      status: "active",
      role: "admin",
      accountType: "individuel",
      usageMode: "NA",
      productVersion: "automatisation_poussee",
      firstName,
      lastName,
      email,
      phone,
      organizationName: "Administration",
      passwordHash: hashPassword(password),
      validatedBy: reviewedBy,
      validatedAt: now,
      sourceRequestId: ""
    }

    createAdminAccount(adminAccount)

    await sendAdminAndUserActionAlerts({
      userEmail: adminAccount.email,
      userSubject: "Création de votre compte administrateur",
      userText: [
        "Votre compte administrateur a été créé.",
        "",
        `Compte : ${adminAccount.id}`,
        `Email : ${adminAccount.email}`,
        `Rôle : ${adminAccount.role}`,
        "Vous pouvez maintenant vous connecter avec le mot de passe qui vous a été communiqué."
      ].join("\n"),
      adminSubject: `Création d'un administrateur ${adminAccount.email}`,
      adminText: [
        "Un administrateur supplémentaire a été créé.",
        "",
        `Compte : ${adminAccount.id}`,
        `Email : ${adminAccount.email}`,
        `Créé par : ${reviewedBy}`
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      admin: {
        id: adminAccount.id,
        email: adminAccount.email,
        firstName: adminAccount.firstName,
        lastName: adminAccount.lastName,
        role: adminAccount.role,
        status: adminAccount.status
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la création de l'administrateur."
    }))
  }
}

async function handleAdminRequest(req, res, body) {
  try {
    const payload = JSON.parse(body || "{}")
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "admin_request",
      eventType: "admin_request_attempt",
      route: "/api/admin/request"
    })) {
      return
    }
    const firstName = payload.firstName?.trim() || ""
    const lastName = payload.lastName?.trim() || ""
    const email = payload.email?.trim().toLowerCase() || ""
    const password = payload.password || ""
    const phone = payload.phone?.trim() || ""
    const organizationName = payload.organizationName?.trim() || ""
    const consent = payload.consent === true || payload.consent === "true"
    const superAdmin = findSuperAdminAccount()
    const emailValidation = validateEmailAddress(email, { required: true })
    const humanValidation = await validateHumanVerification(payload, {
      remoteIp: req.socket?.remoteAddress || ""
    })

    const issues = []
    if (!firstName) issues.push("Le prénom est requis.")
    if (!lastName) issues.push("Le nom est requis.")
    if (!emailValidation.ok) issues.push(emailValidation.message)
    if (!organizationName) issues.push("L'organisation gérée est requise.")
    if (!password || password.length < 10) issues.push("Le mot de passe doit contenir au moins 10 caractères.")
    if (!consent) issues.push("Le consentement est requis.")
    if (!humanValidation.ok) issues.push(humanValidation.message)
    if (!superAdmin) issues.push("Aucun super administrateur actif n'est disponible pour traiter cette demande.")

    const normalizedEmail = emailValidation.normalized || email
    const existingAdmins = listAccounts({ email: normalizedEmail }).filter((account) => isAdminRole(account.role))
    if (existingAdmins.length > 0) {
      issues.push("Un administrateur existe déjà pour cette adresse email.")
    }

    if (findOpenAdminRequestByEmail(normalizedEmail)) {
      issues.push("Une demande de compte administrateur existe déjà pour cette adresse email.")
    }

    if (issues.length > 0) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Formulaire administrateur invalide.",
        details: issues
      }))
      return
    }

    const now = new Date().toISOString()
    const request = {
      id: `req-admin-${Date.now()}`,
      createdAt: now,
      updatedAt: now,
      status: "pending",
      accountType: "administrateur",
      usageMode: "NA",
      firstName,
      lastName,
      email: normalizedEmail,
      phone,
      organizationName,
      disabilityUsage: false,
      plannedMailboxes: "",
      motivation: payload.motivation?.trim() || "Demande d'ouverture de compte administrateur.",
      documentRequired: false,
      supportingDocumentName: "",
      adminNotes: "",
      requestedAdditionalInfo: "",
      reviewedBy: "",
      reviewedAt: "",
      linkedAccountId: "",
      passwordHash: hashPassword(password)
    }

    insertAccountRequest(request)
    createPendingAccountFromRequest(request)

    await sendTextMail({
      to: superAdmin.email,
      subject: `Nouvelle demande de compte administrateur - ${firstName} ${lastName}`,
      text: [
        "Une demande de compte administrateur a été déposée.",
        "",
        `Identité : ${firstName} ${lastName}`,
        `Email : ${normalizedEmail}`,
        `Téléphone : ${phone || "Non renseigné"}`,
        `Organisation gérée : ${organizationName}`,
        "",
        "Cette demande doit être validée par le super administrateur avant activation du compte."
      ].join("\n")
    })

    await sendTextMail({
      to: normalizedEmail,
      subject: "Demande de compte administrateur enregistrée",
      text: [
        "Votre demande de compte administrateur a bien été enregistrée.",
        "",
        "Elle a été transmise au super administrateur pour validation.",
        "Le compte ne sera effectif qu'après validation."
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      request: {
        id: request.id,
        status: request.status,
        email: request.email,
        firstName: request.firstName,
        lastName: request.lastName,
        organizationName: request.organizationName
      },
      adminAlert: {
        message: "Demande envoyée à l’administrateur compétent."
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la demande de compte administrateur."
    }))
  }
}

async function handleAdminRequestsList(req, res) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const email = url.searchParams.get("email") || ""
    const status = url.searchParams.get("status") || ""
    const accountType = url.searchParams.get("accountType") || ""
    const requests = listAccountRequests({ email, status, accountType }).filter((request) => {
      if (!canAdminSeeRequest(sessionPayload.account, request)) {
        return false
      }

      if (!request.linked_account_id) {
        return true
      }

      const linkedAccount = getAccountById(request.linked_account_id)
      return linkedAccount?.status !== "active"
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      requests
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des demandes."
    }))
  }
}

async function handleAdminAccountsList(req, res) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const email = url.searchParams.get("email") || ""
    const status = url.searchParams.get("status") || ""
    const role = url.searchParams.get("role") || ""
    const accountType = url.searchParams.get("accountType") || ""
    const accounts = listAccounts({ email, status, role, accountType }).filter((account) => (
      canAdminSeeAccount(sessionPayload.account, account)
    ))

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      accounts
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des comptes."
    }))
  }
}

async function handleAdminMailboxResourcesList(req, res) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const email = url.searchParams.get("email") || ""
    let mailboxes = listMailboxResourcesAdmin({ email })

    if (!isSuperAdminAccount(sessionPayload.account)) {
      const actorOrg = normalizeOrganizationName(sessionPayload.account.organization_name)
      mailboxes = mailboxes.filter((mailbox) => {
        const ownerOrg = normalizeOrganizationName(mailbox.owner_organization_name || mailbox.organization_name || "")
        return Boolean(actorOrg && ownerOrg && actorOrg === ownerOrg)
      })
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      mailboxes
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des boîtes mail."
    }))
  }
}

async function handleAdminSecurityEventsList(req, res) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  if (!isSuperAdminAccount(sessionPayload.account)) {
    res.writeHead(403, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: "Accès super administrateur requis pour consulter le journal de sécurité."
    }))
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const email = url.searchParams.get("email")?.trim().toLowerCase() || ""
    const status = url.searchParams.get("status")?.trim() || ""
    const eventType = url.searchParams.get("eventType")?.trim() || ""
    const limit = Number(url.searchParams.get("limit") || 100)

    const events = listSecurityEvents({
      email,
      status,
      eventType,
      limit
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      events
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture du journal de sécurité."
    }))
  }
}

async function handleAdminPriorityRulesGet(req, res) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const config = getPriorityRulesConfig()
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      config
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des règles de priorité."
    }))
  }
}

async function handleAdminPriorityRulesUpdate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const config = payload.config
    if (!config || typeof config !== "object") {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Configuration de priorité invalide."
      }))
      return
    }

    const savedConfig = setPriorityRulesConfig(config)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      config: savedConfig
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour des règles de priorité."
    }))
  }
}

async function handleAdminMailboxSharingUpdate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const mailboxResourceId = payload.mailboxResourceId?.trim() || ""
    const sharingEnabled = Boolean(payload.sharingEnabled)

    if (!mailboxResourceId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Identifiant de boîte mail manquant."
      }))
      return
    }

    const mailbox = updateMailboxResource(mailboxResourceId, {
      sharingEnabled
    })

    if (!mailbox) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Boîte mail introuvable."
      }))
      return
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      mailbox
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour du mode de partage."
    }))
  }
}

async function handleAdminMailRulesList(req, res) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const status = url.searchParams.get("status") || ""
    const applicationScope = url.searchParams.get("applicationScope") || ""
    const workflowScope = url.searchParams.get("workflowScope") || ""
    const mailboxScope = url.searchParams.get("mailboxScope") || ""
    const mailCategoryScope = url.searchParams.get("mailCategoryScope") || ""
    const ruleType = url.searchParams.get("ruleType") || ""

    const rules = listMailRules({
      status,
      applicationScope,
      workflowScope,
      mailboxScope,
      mailCategoryScope,
      ruleType
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      rules
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des règles."
    }))
  }
}

async function handleAdminMailRuleCreate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const rule = payload.rule || {}

    if (!String(rule.title || "").trim() || !String(rule.content || "").trim()) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Le titre et le contenu de la règle sont requis."
      }))
      return
    }

    const savedRule = createMailRule({
      ...rule,
      createdBy: sessionPayload.account.email,
      updatedBy: sessionPayload.account.email
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      rule: savedRule
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de création de la règle."
    }))
  }
}

async function handleAdminMailRuleUpdate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const ruleId = String(payload.ruleId || "").trim()
    const updates = payload.updates || {}

    if (!ruleId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Identifiant de règle manquant."
      }))
      return
    }

    const savedRule = updateMailRule(ruleId, {
      ...updates,
      updatedBy: sessionPayload.account.email
    })

    if (!savedRule) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Règle introuvable."
      }))
      return
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      rule: savedRule
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour de la règle."
    }))
  }
}

async function handleAdminMailRuleStatusUpdate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const ruleId = String(payload.ruleId || "").trim()
    const status = String(payload.status || "").trim()

    if (!ruleId || !status) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Identifiant ou statut manquant."
      }))
      return
    }

    const savedRule = setMailRuleStatus(ruleId, status, sessionPayload.account.email)
    if (!savedRule) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Règle introuvable."
      }))
      return
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      rule: savedRule
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour du statut."
    }))
  }
}

async function handleAdminRuleBuilderDraft(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const requestsText = String(payload.requestsText || "").trim()
    const operatorComment = String(payload.operatorComment || "").trim()
    const model = String(payload.model || "deepseek-chat").trim()

    if (!requestsText) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Au moins une demande source est requise."
      }))
      return
    }

    const prompt = buildRuleDraftPrompt({ requestsText, operatorComment })
    const rawResponse = await runAIWithTimeout(model, prompt, {
      accountId: sessionPayload.account.id,
      model
    })
    const draft = extractJson(rawResponse)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      model,
      prompt,
      rawResponse,
      draft
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la génération de la règle candidate."
    }))
  }
}

async function handleAdminRuleBuilderFinalize(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const requestsText = String(payload.requestsText || "").trim()
    const operatorComment = String(payload.operatorComment || "").trim()
    const adminAnswersText = String(payload.adminAnswersText || "").trim()
    const model = String(payload.model || "deepseek-chat").trim()
    const draft = payload.draft || null

    if (!requestsText) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "La demande source est requise pour finaliser la règle."
      }))
      return
    }

    if (!draft || typeof draft !== "object") {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "La règle candidate est requise."
      }))
      return
    }

    const draftJsonText = JSON.stringify(draft, null, 2)
    const prompt = buildRuleFinalizePrompt({
      requestsText,
      operatorComment,
      draftJsonText,
      adminAnswersText
    })
    const rawResponse = await runAIWithTimeout(model, prompt, {
      accountId: sessionPayload.account.id,
      model
    })
    const finalized = extractJson(rawResponse)
    const finalRule = finalized.final_rule || {}
    const normalizedRule = {
      title: String(finalRule.title || "").trim(),
      content: String(finalRule.content || "").trim(),
      ruleType: String(finalRule.rule_type || "content").trim(),
      priorityRank: Number(finalRule.priority_rank || 100),
      applicationScope: String(finalRule.application_scope || "mail_assistant").trim() || "mail_assistant",
      mailboxScope: String(finalRule.mailbox_scope || "global").trim() || "global",
      mailCategoryScope: String(finalRule.mail_category_scope || "global").trim() || "global",
      workflowScope: String(finalRule.workflow_scope || "reply").trim() || "reply",
      theme: String(finalRule.theme || "").trim(),
      missingInfoAction: String(finalRule.missing_info_action || "cautious_reply").trim() || "cautious_reply",
      status: String(finalRule.status || "active").trim() || "active",
      notes: String(finalRule.notes || "").trim()
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      model,
      prompt,
      rawResponse,
      finalization: finalized,
      finalRule: normalizedRule
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la finalisation de la règle."
    }))
  }
}

function isProtectedAdminAccount(account) {
  return Boolean(account && account.role === "admin")
}

async function handleAdminRequestStatusUpdate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "admin_mutation",
      eventType: "admin_request_status_attempt",
      route: "/api/admin/request-status"
    })) {
      return
    }
    const requestId = payload.requestId?.trim() || ""
    const status = payload.status?.trim() || ""
    const reviewedBy = sessionPayload.account.email || payload.reviewedBy?.trim() || "admin-manuel"
    const adminNotes = payload.adminNotes?.trim() || ""
    const requestedAdditionalInfo = payload.requestedAdditionalInfo?.trim() || ""
    const productVersion = payload.productVersion?.trim() || "base"
    const temporaryPassword = payload.temporaryPassword || ""

    if (!requestId || !status) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Identifiant de demande ou statut manquant."
      }))
      return
    }

    const request = updateAccountRequestStatus(requestId, status, {
      reviewedBy,
      adminNotes,
      requestedAdditionalInfo,
      productVersion,
      passwordHash: temporaryPassword ? hashPassword(temporaryPassword) : undefined
    })

    if (!request) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Demande introuvable."
      }))
      return
    }

    await sendAdminAndUserActionAlerts({
      userEmail: request.email,
      userSubject: `Votre demande de compte a été mise à jour (${status})`,
      userText: [
        "Votre demande a été mise à jour.",
        "",
        `Demande : ${request.id}`,
        `Type de compte : ${request.account_type}`,
        `Nouveau statut : ${request.status}`,
        `Note administrateur : ${adminNotes || requestedAdditionalInfo || "Aucune"}`
      ].join("\n"),
      adminSubject: `Action administrateur sur la demande ${request.id}`,
      adminText: [
        "Une demande de compte a été mise à jour.",
        "",
        `Demande : ${request.id}`,
        `Email : ${request.email}`,
        `Type de compte : ${request.account_type}`,
        `Nouveau statut : ${request.status}`,
        `Administrateur : ${reviewedBy}`,
        `Note : ${adminNotes || requestedAdditionalInfo || "Aucune"}`
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      request
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour de la demande."
    }))
  }
}

async function handleAdminAccountStatusUpdate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "admin_mutation",
      eventType: "admin_account_status_attempt",
      route: "/api/admin/account-status"
    })) {
      return
    }
    const accountId = payload.accountId?.trim() || ""
    const status = payload.status?.trim() || ""
    const reviewedBy = sessionPayload.account.email || payload.reviewedBy?.trim() || "admin-manuel"
    const adminNotes = payload.adminNotes?.trim() || ""
    const productVersion = payload.productVersion?.trim() || "base"
    const temporaryPassword = payload.temporaryPassword || ""

    if (!accountId || !status) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Identifiant de compte ou statut manquant."
      }))
      return
    }

    const account = updateAccountStatus(accountId, status, {
      reviewedBy,
      adminNotes,
      productVersion,
      passwordHash: temporaryPassword ? hashPassword(temporaryPassword) : undefined
    })

    if (!account) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Compte introuvable."
      }))
      return
    }

    await sendAdminAndUserActionAlerts({
      userEmail: account.email,
      userSubject: `Votre compte a été mis à jour (${status})`,
      userText: [
        "Votre compte a été modifié par l'administrateur.",
        "",
        `Compte : ${account.id}`,
        `Type de compte : ${account.account_type}`,
        `Nouveau statut : ${account.status}`,
        `Version : ${account.product_version}`,
        `Note administrateur : ${adminNotes || "Aucune"}`
      ].join("\n"),
      adminSubject: `Action administrateur sur le compte ${account.id}`,
      adminText: [
        "Un compte a été mis à jour.",
        "",
        `Compte : ${account.id}`,
        `Email : ${account.email}`,
        `Type de compte : ${account.account_type}`,
        `Nouveau statut : ${account.status}`,
        `Administrateur : ${reviewedBy}`,
        `Note : ${adminNotes || "Aucune"}`
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      account
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour du compte."
    }))
  }
}

async function handleAdminPasswordReset(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "password_action",
      eventType: "admin_password_reset_attempt",
      route: "/api/admin/password-reset"
    })) {
      return
    }
    const accountId = payload.accountId?.trim() || ""
    const reviewedBy = sessionPayload.account.email || payload.reviewedBy?.trim() || "admin-manuel"
    const temporaryPassword = payload.temporaryPassword || ""

    if (!accountId || !temporaryPassword || temporaryPassword.length < 10) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Compte ou mot de passe temporaire invalide."
      }))
      return
    }

    const existingAccount = getAccountById(accountId)
    if (!existingAccount) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Compte introuvable."
      }))
      return
    }

    const account = updateAccountStatus(accountId, existingAccount.status, {
      reviewedBy,
      productVersion: existingAccount.product_version || "base",
      adminNotes: "Mot de passe réinitialisé par l'administrateur.",
      passwordHash: hashPassword(temporaryPassword)
    })

    await sendAdminAndUserActionAlerts({
      userEmail: account.email,
      userSubject: "Réinitialisation de votre mot de passe administrateur",
      userText: [
        "Votre mot de passe administrateur a été réinitialisé.",
        "",
        `Compte : ${account.id}`,
        `Email : ${account.email}`,
        "Un nouveau mot de passe temporaire vous a été communiqué."
      ].join("\n"),
      adminSubject: `Réinitialisation du mot de passe ${account.id}`,
      adminText: [
        "Le mot de passe d'un administrateur a été réinitialisé.",
        "",
        `Compte : ${account.id}`,
        `Email : ${account.email}`,
        `Administrateur opérateur : ${reviewedBy}`
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      account
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de réinitialisation du mot de passe."
    }))
  }
}

async function handleAdminAccountDelete(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    if (!enforceSecurityRateLimit(req, res, payload, {
      ruleName: "admin_mutation",
      eventType: "admin_account_delete_attempt",
      route: "/api/admin/account-delete"
    })) {
      return
    }
    const accountId = payload.accountId?.trim() || ""
    const reviewedBy = sessionPayload.account.email || payload.reviewedBy?.trim() || "admin-manuel"
    const adminNotes = payload.adminNotes?.trim() || ""

    if (!accountId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Identifiant de compte manquant."
      }))
      return
    }

    const accounts = listAccounts({})
    const targetAccount = accounts.find((account) => account.id === accountId)

    if (!targetAccount) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Compte introuvable."
      }))
      return
    }

    if (isProtectedAdminAccount(targetAccount)) {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Un compte administrateur ne peut pas être supprimé depuis cette page."
      }))
      return
    }

    const deletedAccount = deleteAccountPermanently(accountId, {
      reviewedBy,
      adminNotes
    })

    if (!deletedAccount) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Compte introuvable."
      }))
      return
    }

    await sendAdminAndUserActionAlerts({
      userEmail: deletedAccount.email,
      userSubject: "Votre compte a été supprimé",
      userText: [
        "Votre compte a été supprimé de l'application.",
        "",
        `Compte : ${deletedAccount.id}`,
        `Type de compte : ${deletedAccount.account_type}`,
        `Motif / note : ${adminNotes || "Aucune note"}`
      ].join("\n"),
      adminSubject: `Suppression du compte ${deletedAccount.id}`,
      adminText: [
        "Un compte a été supprimé définitivement de la base.",
        "",
        `Compte : ${deletedAccount.id}`,
        `Email : ${deletedAccount.email}`,
        `Type de compte : ${deletedAccount.account_type}`,
        `Administrateur : ${reviewedBy}`,
        `Note : ${adminNotes || "Aucune"}`
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      account: deletedAccount
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de suppression du compte."
    }))
  }
}

module.exports = {
  handleAdminLogin,
  handleAdminForgotPassword,
  handleAdminChangePassword,
  handleAdminBootstrap,
  handleAdminRequest,
  handleAdminCreate,
  handleAdminRequestsList,
  handleAdminAccountsList,
  handleAdminMailboxResourcesList,
  handleAdminSecurityEventsList,
  handleAdminMailRulesList,
  handleAdminMailRuleCreate,
  handleAdminMailRuleUpdate,
  handleAdminMailRuleStatusUpdate,
  handleAdminRuleBuilderDraft,
  handleAdminRuleBuilderFinalize,
  handleAdminPriorityRulesGet,
  handleAdminPriorityRulesUpdate,
  handleAdminMailboxSharingUpdate,
  handleAdminRequestStatusUpdate,
  handleAdminAccountStatusUpdate,
  handleAdminAccountDelete,
  handleAdminPasswordReset
}
