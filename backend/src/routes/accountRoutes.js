const crypto = require("crypto")
const { createAccountRequest, lookupAdminAttachment, lookupPlannedMailboxIssues } = require("../services/accountRequestService")
const {
  listAccountRequests,
  listAccounts,
  findAccountByEmailAndType,
  getAccountById,
  updateAccountPassword,
  createPasswordResetToken,
  getPasswordResetToken,
  consumePasswordResetToken,
  createUserSession,
  getUserSession,
  closeUserSession,
  closeUserSessionsForAccount,
  getUserPreferences,
  saveUserPreferences,
  listMailboxConnectionsForAccount,
  listMailboxMembershipsForAccount,
  getProviderUsageSummaryForAccount,
  listProviderUsageEventsForAccount
} = require("../services/databaseService")
const { sendTextMail } = require("../services/mailService")
const {
  listProviderAccountsForAccount,
  createOrUpdateProviderAccountForAccount,
  getProviderAccountForAccount,
  testProviderAccount,
  sanitizeProviderAccount
} = require("../services/providerAccountService")
const {
  getDefaultUserPreferences,
  normalizeUserPreferences,
  mergeUserPreferences
} = require("../services/userPreferencesService")
const SESSION_COOKIE_NAME = "mail_assistant_session"

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

function parseCookies(req) {
  const cookieHeader = req.headers.cookie || ""
  return cookieHeader.split(";").reduce((accumulator, entry) => {
    const [rawName, ...rest] = entry.trim().split("=")
    if (!rawName) {
      return accumulator
    }

    accumulator[rawName] = decodeURIComponent(rest.join("=") || "")
    return accumulator
  }, {})
}

function buildSessionCookie(value, options = {}) {
  const parts = [`${SESSION_COOKIE_NAME}=${encodeURIComponent(value)}`, "Path=/", "HttpOnly", "SameSite=Lax"]
  if (options.maxAge !== undefined) {
    parts.push(`Max-Age=${options.maxAge}`)
  }
  return parts.join("; ")
}

function sanitizeAccountForPrivacyExport(account) {
  if (!account) {
    return null
  }

  return {
    id: account.id,
    created_at: account.created_at,
    updated_at: account.updated_at,
    status: account.status,
    role: account.role,
    account_type: account.account_type,
    usage_mode: account.usage_mode,
    product_version: account.product_version,
    first_name: account.first_name,
    last_name: account.last_name,
    email: account.email,
    phone: account.phone || "",
    organization_name: account.organization_name || "",
    validated_by: account.validated_by || "",
    validated_at: account.validated_at || "",
    source_request_id: account.source_request_id || "",
    password_hash_stored: Boolean(account.password_hash)
  }
}

function sanitizeMailboxConnectionForPrivacyExport(connection) {
  return {
    id: connection.id,
    mailbox_resource_id: connection.mailbox_resource_id || "",
    mailbox_email: connection.mailbox_email,
    provider_id: connection.provider_id,
    provider_label: connection.provider_label,
    auth_type: connection.auth_type,
    connection_status: connection.connection_status,
    created_at: connection.created_at,
    updated_at: connection.updated_at,
    oauth_scope: connection.oauth_scope || "",
    oauth_external_account_id: connection.oauth_external_account_id || "",
    oauth_token_expires_at: connection.oauth_token_expires_at || "",
    last_sync_at: connection.last_sync_at || "",
    last_error: connection.last_error || "",
    is_default: Boolean(connection.is_default),
    oauth_access_token_stored: Boolean(connection.oauth_access_token),
    oauth_refresh_token_stored: Boolean(connection.oauth_refresh_token),
    oauth_state_stored: Boolean(connection.oauth_state)
  }
}

function buildPrivacyNotice() {
  return {
    generatedAt: new Date().toISOString(),
    scope: "Accessible Mail Assistant",
    principles: [
      "Les mails complets ne sont pas conserves durablement par defaut dans l'application.",
      "La gestion principale des mails reste dans chaque boite mail individuelle.",
      "L'audio brut de dictée ne doit pas etre conserve durablement par defaut.",
      "Les secrets, jetons OAuth et cles API ne sont pas exposes en clair dans l'export utilisateur.",
      "Les appels a une API IA ou STT externe doivent etre compris comme une transmission de donnees au fournisseur choisi.",
      "L'IA locale limite les transferts externes, sans supprimer le besoin de proteger la machine et la base locale."
    ],
    retainedDataFamilies: [
      "compte utilisateur",
      "sessions",
      "preferences",
      "connexions de boites mail",
      "jetons OAuth proteges",
      "regles et traces d'action necessaires",
      "fournisseurs API configures",
      "evenements d'usage fournisseur"
    ],
    notRetainedByDefault: [
      "copie complete des boites mail",
      "pieces jointes completes",
      "audio brut",
      "transcriptions longues sans finalite",
      "prompts LLM complets dans les logs",
      "secrets en clair"
    ]
  }
}

function getSessionPayloadFromRequest(req) {
  const cookies = parseCookies(req)
  const sessionId = cookies[SESSION_COOKIE_NAME]
  if (!sessionId) {
    return null
  }

  const session = getUserSession(sessionId)
  if (!session || session.session_status !== "active") {
    return null
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    closeUserSession(sessionId)
    return null
  }

  const account = getAccountById(session.account_id)
  if (!account || account.status !== "active") {
    return null
  }

  return {
    sessionId,
    session,
    account
  }
}

function requireActiveSession(req, res) {
  const payload = getSessionPayloadFromRequest(req)
  if (payload) {
    return payload
  }

  res.writeHead(401, { "Content-Type": "application/json" })
  res.end(JSON.stringify({
    ok: false,
    error: "Connexion utilisateur requise."
  }))
  return null
}

function buildAccountLabel(account = {}) {
  const firstName = String(account.first_name || account.firstName || "").trim()
  const lastName = String(account.last_name || account.lastName || "").trim()
  const fullName = `${firstName} ${lastName}`.trim()
  if (fullName) {
    return fullName
  }

  const organizationName = String(account.organization_name || account.organizationName || "").trim()
  if (organizationName) {
    return organizationName
  }

  return String(account.email || "").trim() || "Compte"
}

function getBillingScope(requestedScope, sessionPayload) {
  const normalized = String(requestedScope || "account").trim().toLowerCase()
  if (normalized === "global" && sessionPayload?.account?.role === "admin") {
    return "global"
  }
  return "account"
}

function getPeriodSince(period = "this_month") {
  const now = new Date()
  if (period === "this_month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
  }
  return ""
}

function collectBillingDashboard(sessionPayload, options = {}) {
  const scope = getBillingScope(options.scope, sessionPayload)
  const period = options.period || "this_month"
  const since = getPeriodSince(period)
  const providerType = options.providerType || undefined
  const featureType = options.featureType || undefined
  const limit = Math.max(1, Math.min(Number(options.limit || 200), 500))
  const targetAccounts = scope === "global"
    ? listAccounts({ status: "active" })
    : [getAccountById(sessionPayload.account.id) || sessionPayload.account]

  const providers = []
  const mailboxConnections = []
  const usageEvents = []
  let totalEstimatedCostCents = 0
  let totalEstimatedCostAmount = 0
  let totalEventsCount = 0
  let totalQuantity = 0
  const currencies = new Set()

  targetAccounts.forEach((account) => {
    if (!account?.id) {
      return
    }

    const accountLabel = buildAccountLabel(account)
    const accountProviders = listProviderAccountsForAccount(account.id)
    const accountUsageSummary = getProviderUsageSummaryForAccount(account.id, {
      providerType,
      featureType,
      since: since || undefined
    })
    const summaryByProviderType = new Map(
      Array.isArray(accountUsageSummary.providers)
        ? accountUsageSummary.providers.map((provider) => [provider.providerType, provider])
        : []
    )

    accountProviders.forEach((provider) => {
      const providerSummary = summaryByProviderType.get(provider.providerType)
      providers.push({
        ...provider,
        accountId: account.id,
        accountLabel,
        estimatedCostCents: Number(providerSummary?.estimatedCostCents || 0),
        estimatedCostAmount: Number(providerSummary?.estimatedCostAmount || 0),
        quantity: Number(providerSummary?.quantity || 0),
        quantityUnit: providerSummary?.quantityUnit || "requests",
        eventsCount: Number(providerSummary?.eventsCount || 0),
        summaryCurrency: providerSummary?.currency || provider.currency || "EUR"
      })
    })

    mailboxConnections.push(
      ...listMailboxConnectionsForAccount(account.id).map((connection) => ({
        ...connection,
        accountId: account.id,
        accountLabel
      }))
    )

    usageEvents.push(
      ...listProviderUsageEventsForAccount(account.id, {
        providerType,
        featureType,
        since: since || undefined,
        limit: scope === "global" ? 500 : limit
      }).map((event) => ({
        ...event,
        accountLabel
      }))
    )

    totalEstimatedCostCents += Number(accountUsageSummary.totalEstimatedCostCents || 0)
    totalEstimatedCostAmount += Number(accountUsageSummary.totalEstimatedCostAmount || 0)
    totalEventsCount += Number(accountUsageSummary.eventsCount || 0)
    totalQuantity += Number(accountUsageSummary.totalQuantity || 0)
    currencies.add(accountUsageSummary.currency || "EUR")
  })

  usageEvents.sort((left, right) => {
    const leftTime = new Date(left.createdAt || 0).getTime()
    const rightTime = new Date(right.createdAt || 0).getTime()
    return rightTime - leftTime
  })

  return {
    scope,
    period,
    usageSummary: {
      period,
      totalEstimatedCostCents,
      totalEstimatedCostAmount,
      eventsCount: totalEventsCount,
      totalQuantity,
      currency: currencies.has("USD") ? "USD" : "EUR"
    },
    providers,
    mailboxConnections,
    usageEvents: usageEvents.slice(0, limit)
  }
}

async function handleAccountRequest(req, res, body) {
  try {
    const payload = JSON.parse(body || "{}")
    const result = await createAccountRequest(payload)

    res.writeHead(200, {
      "Content-Type": "application/json"
    })

    res.end(JSON.stringify({
      ok: true,
      ...result
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, {
      "Content-Type": "application/json"
    })

    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la création de la demande",
      details: error.details || []
    }))
  }
}

function handleAccountRequestAttachmentLookup(req, res) {
  try {
    const url = new URL(req.url, "http://localhost")
    const payload = {
      accountType: url.searchParams.get("accountType")?.trim() || "individuel",
      email: url.searchParams.get("email")?.trim() || "",
      organizationName: url.searchParams.get("organizationName")?.trim() || ""
    }

    const attachment = lookupAdminAttachment(payload)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      matched: true,
      attachmentLabel: attachment.attachmentLabel,
      organizationName: attachment.organizationName || ""
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      matched: false,
      error: error.message || "Organisation non reconnue.",
      details: error.details || []
    }))
  }
}

function handleAccountRequestPlannedMailboxesLookup(req, res) {
  try {
    const url = new URL(req.url, "http://localhost")
    const emails = url.searchParams.get("emails") || ""
    const result = lookupPlannedMailboxIssues(emails)

    res.writeHead(result.ok ? 200 : 400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: result.ok,
      issues: result.issues,
      normalized: result.plannedMailboxesValidation?.normalized || []
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 400, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      issues: [error.message || "Impossible de vérifier les boîtes mail prévues."]
    }))
  }
}

async function handleAccountStatus(req, res) {
  try {
    const url = new URL(req.url, "http://localhost")
    const email = url.searchParams.get("email")?.trim().toLowerCase() || ""
    const accountType = url.searchParams.get("accountType")?.trim() || ""

    if (!email || !accountType) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Email ou type de compte manquant."
      }))
      return
    }

    const requests = listAccountRequests({ email, accountType })
    const accounts = listAccounts({ email, accountType })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      latestRequest: requests[0] || null,
      latestAccount: accounts[0] || null,
      requests,
      accounts
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture du statut du compte."
    }))
  }
}

async function handleAccountLogin(req, res, body) {
  try {
    const payload = JSON.parse(body || "{}")
    const email = payload.email?.trim().toLowerCase() || ""
    const accountType = payload.accountType?.trim() || ""
    const password = payload.password || ""

    if (!email || !accountType || !password) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Email, type de compte ou mot de passe manquant."
      }))
      return
    }

    const account = findAccountByEmailAndType(email, accountType)
    if (!account) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Aucun compte trouve pour cet email et ce type de compte."
      }))
      return
    }

    const detailedAccount = listAccounts({ email, accountType })[0] || null
    if (!detailedAccount) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Compte introuvable."
      }))
      return
    }

    if (detailedAccount.status !== "active") {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Le compte existe mais n'est pas encore actif.",
        account: detailedAccount
      }))
      return
    }

    const fullAccount = findAccountByEmailAndType(email, accountType)
    const exact = getAccountById(fullAccount.id)
    if (!exact?.password_hash) {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Le compte est actif mais aucun mot de passe n'a encore ete initialise par l'administrateur.",
        account: detailedAccount
      }))
      return
    }

    if (!verifyPassword(password, exact.password_hash)) {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Mot de passe incorrect."
      }))
      return
    }

    closeUserSessionsForAccount(detailedAccount.id)
    const session = createUserSession(detailedAccount)

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": buildSessionCookie(session.id)
    })
    res.end(JSON.stringify({
      ok: true,
      account: detailedAccount,
      session: {
        userId: detailedAccount.id,
        role: detailedAccount.role,
        status: detailedAccount.status,
        productVersion: detailedAccount.product_version,
        startedAt: session.created_at,
        accountActive: 1
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de connexion."
    }))
  }
}

async function handleAccountSession(req, res) {
  try {
    const payload = getSessionPayloadFromRequest(req)
    if (!payload) {
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Set-Cookie": buildSessionCookie("", { maxAge: 0 })
      })
      res.end(JSON.stringify({
        ok: true,
        accountActive: 0,
        session: null
      }))
      return
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      accountActive: 1,
      session: {
        userId: payload.account.id,
        email: payload.account.email,
        firstName: payload.account.first_name || "",
        lastName: payload.account.last_name || "",
        organizationName: payload.account.organization_name || "",
        accountType: payload.account.account_type,
        role: payload.account.role,
        status: payload.account.status,
        productVersion: payload.account.product_version,
        startedAt: payload.session.created_at,
        accountActive: 1
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture de session."
    }))
  }
}

async function handleAccountLogout(req, res) {
  try {
    const payload = getSessionPayloadFromRequest(req)
    const cookies = parseCookies(req)
    const sessionId = cookies[SESSION_COOKIE_NAME]
    if (sessionId) {
      closeUserSession(sessionId)
    }
    if (payload?.account?.id) {
      closeUserSessionsForAccount(payload.account.id)
    }

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Set-Cookie": buildSessionCookie("", { maxAge: 0 })
    })
    res.end(JSON.stringify({
      ok: true,
      accountActive: 0
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de deconnexion."
    }))
  }
}

async function handleForgotPassword(req, res, body) {
  try {
    const payload = JSON.parse(body || "{}")
    const email = payload.email?.trim().toLowerCase() || ""
    const accountType = payload.accountType?.trim() || ""

    if (!email || !accountType) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Email ou type de compte manquant."
      }))
      return
    }

    const account = findAccountByEmailAndType(email, accountType)
    if (!account) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Aucun compte trouvé pour cet email et ce type de compte."
      }))
      return
    }

    const exact = getAccountById(account.id)
    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER
    const resetToken = crypto.randomBytes(32).toString("hex")
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()
    const resetLink = buildResetPasswordUrl(resetToken)

    createPasswordResetToken(exact.id, resetToken, expiresAt)

    await sendTextMail({
      to: exact.email,
      subject: "Reinitialisation de votre mot de passe",
      text: [
        "Vous avez demande la reinitialisation de votre mot de passe.",
        "",
        `Compte : ${exact.id}`,
        `Type de compte : ${exact.account_type}`,
        "",
        "Utilisez ce lien pour definir vous-meme un nouveau mot de passe :",
        resetLink,
        "",
        `Ce lien expire le ${new Date(expiresAt).toLocaleString("fr-FR")}.`,
        "",
        "Si vous n'etes pas a l'origine de cette demande, contactez l'administrateur."
      ].join("\n")
    })

    await sendTextMail({
      to: adminEmail,
      subject: `Demande de reinitialisation de mot de passe - ${email}`,
      text: [
        "Une demande de mot de passe oublie a ete emise.",
        "",
        `Compte : ${exact.id}`,
        `Email : ${exact.email}`,
        `Type de compte : ${exact.account_type}`,
        `Role : ${exact.role}`,
        "",
        "Un lien de reinitialisation a ete envoye directement a l'utilisateur.",
        "Vous pouvez aussi reinitialiser le mot de passe depuis l'espace administrateur si necessaire."
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      accountId: exact.id,
      expiresAt
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la demande de mot de passe oublié."
    }))
  }
}

async function handleResetPassword(req, res, body) {
  try {
    const payload = JSON.parse(body || "{}")
    const token = payload.token?.trim() || ""
    const newPassword = payload.newPassword || ""

    if (!token || !newPassword || newPassword.length < 10) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Jeton manquant ou nouveau mot de passe trop court."
      }))
      return
    }

    const tokenRow = getPasswordResetToken(token)
    if (!tokenRow) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Lien de reinitialisation introuvable."
      }))
      return
    }

    if (tokenRow.used_at) {
      res.writeHead(410, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Ce lien de reinitialisation a deja ete utilise."
      }))
      return
    }

    if (new Date(tokenRow.expires_at).getTime() < Date.now()) {
      res.writeHead(410, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Ce lien de reinitialisation a expire."
      }))
      return
    }

    const account = getAccountById(tokenRow.account_id)
    if (!account) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Compte introuvable."
      }))
      return
    }

    const updatedAccount = updateAccountPassword(account.id, hashPassword(newPassword), {
      reviewedBy: account.email,
      notes: "Mot de passe reinitialise par lien utilisateur."
    })
    consumePasswordResetToken(token)

    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER

    await sendTextMail({
      to: updatedAccount.email,
      subject: "Votre mot de passe a ete reinitialise",
      text: [
        "Votre mot de passe a bien ete reinitialise.",
        "",
        `Compte : ${updatedAccount.id}`,
        `Type de compte : ${updatedAccount.account_type}`
      ].join("\n")
    })

    await sendTextMail({
      to: adminEmail,
      subject: `Mot de passe reinitialise - ${updatedAccount.email}`,
      text: [
        "Un utilisateur a reinitialise son mot de passe via le lien de securite.",
        "",
        `Compte : ${updatedAccount.id}`,
        `Email : ${updatedAccount.email}`,
        `Type de compte : ${updatedAccount.account_type}`,
        `Role : ${updatedAccount.role}`
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      account: {
        id: updatedAccount.id,
        email: updatedAccount.email,
        accountType: updatedAccount.account_type
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la reinitialisation du mot de passe."
    }))
  }
}

async function handleChangePassword(req, res, body) {
  try {
    const payload = JSON.parse(body || "{}")
    const email = payload.email?.trim().toLowerCase() || ""
    const accountType = payload.accountType?.trim() || ""
    const currentPassword = payload.currentPassword || ""
    const newPassword = payload.newPassword || ""

    if (!email || !accountType || !currentPassword || !newPassword || newPassword.length < 10) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Informations insuffisantes ou nouveau mot de passe trop court."
      }))
      return
    }

    const account = findAccountByEmailAndType(email, accountType)
    if (!account) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Compte introuvable."
      }))
      return
    }

    const exact = getAccountById(account.id)
    if (!exact?.password_hash || !verifyPassword(currentPassword, exact.password_hash)) {
      res.writeHead(403, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Mot de passe actuel incorrect."
      }))
      return
    }

    const updatedAccount = updateAccountPassword(exact.id, hashPassword(newPassword), {
      reviewedBy: exact.email,
      notes: "Mot de passe changé par l'utilisateur."
    })

    const adminEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER

    await sendTextMail({
      to: adminEmail,
      subject: `Changement de mot de passe utilisateur - ${updatedAccount.email}`,
      text: [
        "Un utilisateur a changé son mot de passe.",
        "",
        `Compte : ${updatedAccount.id}`,
        `Email : ${updatedAccount.email}`,
        `Type de compte : ${updatedAccount.account_type}`
      ].join("\n")
    })

    await sendTextMail({
      to: updatedAccount.email,
      subject: "Votre mot de passe a été modifié",
      text: [
        "Votre mot de passe a bien été modifié.",
        "",
        `Compte : ${updatedAccount.id}`,
        `Type de compte : ${updatedAccount.account_type}`
      ].join("\n")
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      account: {
        id: updatedAccount.id,
        email: updatedAccount.email,
        accountType: updatedAccount.account_type
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors du changement de mot de passe."
    }))
  }
}

async function handleAccountPreferencesGet(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const stored = getUserPreferences(sessionPayload.account.id)
    const preferences = stored
      ? mergeUserPreferences(getDefaultUserPreferences(), stored)
      : getDefaultUserPreferences()

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      preferences
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des préférences."
    }))
  }
}

async function handleAccountPreferencesPut(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const existing = getUserPreferences(sessionPayload.account.id) || getDefaultUserPreferences()
    const merged = normalizeUserPreferences(mergeUserPreferences(existing, payload))
    const preferences = saveUserPreferences(sessionPayload.account.id, merged)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      preferences
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur d'enregistrement des préférences."
    }))
  }
}

async function handleAccountPrivacyExport(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const account = getAccountById(sessionPayload.account.id)
    const accountType = account?.account_type || sessionPayload.account.account_type || ""
    const email = account?.email || sessionPayload.account.email || ""
    const requests = email && accountType
      ? listAccountRequests({ email, accountType })
      : []
    const preferences = getUserPreferences(sessionPayload.account.id) || getDefaultUserPreferences()
    const mailboxConnections = listMailboxConnectionsForAccount(sessionPayload.account.id)
      .map(sanitizeMailboxConnectionForPrivacyExport)
    const mailboxMemberships = listMailboxMembershipsForAccount(sessionPayload.account.id)
    const providers = listProviderAccountsForAccount(sessionPayload.account.id)
      .map(sanitizeProviderAccount)
    const providerUsageSummary = getProviderUsageSummaryForAccount(sessionPayload.account.id)
    const providerUsageEvents = listProviderUsageEventsForAccount(sessionPayload.account.id, {
      limit: 500
    })

    res.writeHead(200, {
      "Content-Type": "application/json",
      "Content-Disposition": `attachment; filename="donnees-rgpd-${sessionPayload.account.id}.json"`
    })
    res.end(JSON.stringify({
      ok: true,
      exportType: "account-privacy-export",
      exportedAt: new Date().toISOString(),
      notice: buildPrivacyNotice(),
      account: sanitizeAccountForPrivacyExport(account),
      accountRequests: requests.map((request) => ({
        id: request.id,
        created_at: request.created_at,
        updated_at: request.updated_at,
        status: request.status,
        account_type: request.account_type,
        usage_mode: request.usage_mode,
        first_name: request.first_name,
        last_name: request.last_name,
        email: request.email,
        phone: request.phone || "",
        organization_name: request.organization_name || "",
        disability_usage: Boolean(request.disability_usage),
        planned_mailboxes: request.planned_mailboxes || "",
        motivation: request.motivation || "",
        document_required: Boolean(request.document_required),
        supporting_document_name: request.supporting_document_name || "",
        admin_notes: request.admin_notes || "",
        requested_additional_info: request.requested_additional_info || "",
        reviewed_by: request.reviewed_by || "",
        reviewed_at: request.reviewed_at || "",
        linked_account_id: request.linked_account_id || ""
      })),
      preferences,
      mailboxConnections,
      mailboxMemberships,
      providers,
      providerUsageSummary,
      providerUsageEvents,
      limits: {
        providerUsageEvents: 500,
        secretsIncludedInClearText: false,
        oauthTokensIncludedInClearText: false,
        completeMailboxContentIncluded: false,
        rawAudioIncluded: false
      }
    }, null, 2))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de l'export RGPD du compte."
    }))
  }
}

async function handleAccountProvidersList(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const providers = listProviderAccountsForAccount(sessionPayload.account.id)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      providers
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des fournisseurs API."
    }))
  }
}

async function handleAccountProviderCreate(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const payload = JSON.parse(body || "{}")
    const provider = createOrUpdateProviderAccountForAccount(sessionPayload.account.id, payload)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      provider
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de création du fournisseur API."
    }))
  }
}

async function handleAccountProviderUpdate(req, res, body, providerId) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const existing = getProviderAccountForAccount(sessionPayload.account.id, providerId)
    if (!existing) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Fournisseur API introuvable."
      }))
      return
    }

    const payload = JSON.parse(body || "{}")
    const provider = createOrUpdateProviderAccountForAccount(sessionPayload.account.id, {
      ...sanitizeProviderAccount(existing),
      id: providerId,
      ...payload
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      provider
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour du fournisseur API."
    }))
  }
}

async function handleAccountProviderDelete(req, res, providerId) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const existing = getProviderAccountForAccount(sessionPayload.account.id, providerId)
    if (!existing) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Fournisseur API introuvable."
      }))
      return
    }

    const provider = createOrUpdateProviderAccountForAccount(sessionPayload.account.id, {
      ...sanitizeProviderAccount(existing),
      id: providerId,
      status: "inactive",
      isDefault: false
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      provider
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de désactivation du fournisseur API."
    }))
  }
}

async function handleAccountProviderTest(req, res, providerId) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const provider = getProviderAccountForAccount(sessionPayload.account.id, providerId)
    if (!provider) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Fournisseur API introuvable."
      }))
      return
    }

    const test = await testProviderAccount(provider)
    const updated = getProviderAccountForAccount(sessionPayload.account.id, providerId)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: test.success,
      provider: sanitizeProviderAccount(updated),
      test
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de test du fournisseur API."
    }))
  }
}

async function handleAccountUsageSummary(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const providerType = url.searchParams.get("providerType") || ""
    const featureType = url.searchParams.get("featureType") || ""
    const period = url.searchParams.get("period") || "this_month"
    const now = new Date()
    const since = period === "this_month"
      ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      : ""

    const summary = getProviderUsageSummaryForAccount(sessionPayload.account.id, {
      providerType: providerType || undefined,
      featureType: featureType || undefined,
      since: since || undefined
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      summary: {
        period,
        ...summary
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture du résumé d'usage."
    }))
  }
}

async function handleAccountBillingDashboard(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const dashboard = collectBillingDashboard(sessionPayload, {
      scope: url.searchParams.get("scope") || "account",
      providerType: url.searchParams.get("providerType") || "",
      featureType: url.searchParams.get("featureType") || "",
      period: url.searchParams.get("period") || "this_month",
      limit: Number(url.searchParams.get("limit") || 200)
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      scope: dashboard.scope,
      period: dashboard.period,
      usageSummary: dashboard.usageSummary,
      providers: dashboard.providers,
      mailboxConnections: dashboard.mailboxConnections,
      usageEvents: dashboard.usageEvents
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture du tableau de bord comptable."
    }))
  }
}

async function handleAccountProviderUsageEvents(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const providerType = url.searchParams.get("providerType") || ""
    const featureType = url.searchParams.get("featureType") || ""
    const limit = Number(url.searchParams.get("limit") || 100)
    const events = listProviderUsageEventsForAccount(sessionPayload.account.id, {
      providerType: providerType || undefined,
      featureType: featureType || undefined,
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
      error: error.message || "Erreur de lecture des événements d'usage."
    }))
  }
}

module.exports = {
  handleAccountRequest,
  handleAccountRequestAttachmentLookup,
  handleAccountRequestPlannedMailboxesLookup,
  handleAccountStatus,
  handleAccountLogin,
  handleAccountSession,
  handleAccountLogout,
  handleForgotPassword,
  handleResetPassword,
  handleChangePassword,
  handleAccountPreferencesGet,
  handleAccountPreferencesPut,
  handleAccountPrivacyExport,
  handleAccountProvidersList,
  handleAccountProviderCreate,
  handleAccountProviderUpdate,
  handleAccountProviderDelete,
  handleAccountProviderTest,
  handleAccountBillingDashboard,
  handleAccountUsageSummary,
  handleAccountProviderUsageEvents,
  getSessionPayloadFromRequest,
  requireActiveSession
}
