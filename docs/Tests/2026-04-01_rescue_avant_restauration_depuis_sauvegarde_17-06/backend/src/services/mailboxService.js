const crypto = require("crypto")
const {
  upsertMailboxConnection,
  getMailboxConnectionByState,
  getMailboxConnectionById,
  getMailboxConnectionByIdForAccount,
  listMailboxConnectionsForAccount,
  updateMailboxConnectionStatus,
  getPriorityRulesConfig,
  upsertMailboxMessageAction,
  listProcessedMailboxMessageIds,
  listMailboxMessageActionsForConnection,
  getOrCreateMailboxResourceForConnection,
  getMailboxMembershipForAccountAndResource,
  getMailboxMessageCollaboration,
  upsertMailboxMessageCollaboration,
  updateMailboxResource
} = require("./databaseService")
const { analyzeMailForProcessing } = require("./mailAnalysisService")
const { sendTextMail } = require("./mailService")
const { buildAttachmentContext } = require("./attachmentContextService")

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/gmail.compose",
  "https://www.googleapis.com/auth/gmail.send"
]

const PRIORITY_RANK = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4
}

const PRIORITY_LABELS = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  critical: "Critique"
}

function resolveMailboxProvider(email = "") {
  const normalizedEmail = email.trim().toLowerCase()
  const domain = normalizedEmail.split("@")[1] || ""

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return {
      id: "gmail",
      label: "Gmail",
      authType: "oauth2",
      authHint: "Connexion sécurisée Google. L'utilisateur s'authentifie directement chez Google."
    }
  }

  return {
    id: "generic",
    label: domain || "Boîte mail",
    authType: "oauth2",
    authHint: "Fournisseur non encore pris en charge automatiquement."
  }
}

function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || ""
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ""
  const appBaseUrl = process.env.APP_BASE_URL || "http://localhost:3000"
  const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI || `${appBaseUrl}/api/mailbox/google/callback`

  return {
    clientId,
    clientSecret,
    redirectUri,
    configured: Boolean(clientId && clientSecret)
  }
}

function createOAuthState() {
  return crypto.randomBytes(24).toString("hex")
}

function getEncryptionKey() {
  const raw = process.env.MAILBOX_TOKEN_SECRET || process.env.SESSION_SECRET || process.env.APP_SECRET || "mailbox-dev-secret-change-me"
  return crypto.createHash("sha256").update(raw).digest()
}

function encryptSecret(value = "") {
  if (!value) return ""
  const iv = crypto.randomBytes(12)
  const key = getEncryptionKey()
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

function decryptSecret(value = "") {
  if (!value) return ""
  const [ivHex, tagHex, encryptedHex] = String(value).split(":")
  if (!ivHex || !tagHex || !encryptedHex) {
    return ""
  }

  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ])
  return decrypted.toString("utf8")
}

function buildGoogleAuthorizationUrl({ email, state }) {
  const oauth = getGoogleOAuthConfig()
  const params = new URLSearchParams({
    client_id: oauth.clientId,
    redirect_uri: oauth.redirectUri,
    response_type: "code",
    access_type: "offline",
    prompt: "consent",
    scope: GMAIL_SCOPES.join(" "),
    login_hint: email,
    state
  })

  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

async function exchangeGoogleAuthorizationCode(code) {
  const oauth = getGoogleOAuthConfig()
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      code,
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      redirect_uri: oauth.redirectUri,
      grant_type: "authorization_code"
    })
  })

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error_description || result.error || "Echec de l'échange OAuth Google.")
  }

  return result
}

async function refreshGoogleAccessToken(refreshToken) {
  const oauth = getGoogleOAuthConfig()
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: oauth.clientId,
      client_secret: oauth.clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  })

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error_description || result.error || "Echec du rafraîchissement OAuth Google.")
  }

  return result
}

async function fetchGoogleProfile(accessToken) {
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/profile", {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  })

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error?.message || "Impossible de lire le profil Gmail.")
  }

  return result
}

function computeExpiry(expiresInSeconds) {
  const seconds = Number(expiresInSeconds || 3600)
  return new Date(Date.now() + seconds * 1000).toISOString()
}

function ensureMailboxProviderSupported(provider) {
  if (provider.id !== "gmail") {
    const error = new Error("Ce fournisseur n'est pas encore pris en charge automatiquement. Le premier connecteur production sera Google.")
    error.statusCode = 400
    throw error
  }
}

function ensureGoogleOAuthConfigured() {
  const oauth = getGoogleOAuthConfig()
  if (oauth.configured) {
    return oauth
  }

  const error = new Error("Configuration Google OAuth incomplète. Renseigner GOOGLE_OAUTH_CLIENT_ID et GOOGLE_OAUTH_CLIENT_SECRET dans .env.")
  error.statusCode = 500
  throw error
}

function createMailboxConnectionStart(account, email) {
  const normalizedEmail = email.trim().toLowerCase()
  if (!normalizedEmail) {
    const error = new Error("Adresse de boîte mail manquante.")
    error.statusCode = 400
    throw error
  }

  const provider = resolveMailboxProvider(normalizedEmail)
  ensureMailboxProviderSupported(provider)
  ensureGoogleOAuthConfigured()

  const existingConnection = listMailboxConnectionsForAccount(account.id).find((connection) =>
    connection.mailbox_email === normalizedEmail && connection.provider_id === provider.id
  )

  if (existingConnection?.connection_status === "connected" && existingConnection.oauth_refresh_token) {
    return {
      provider,
      connection: existingConnection,
      redirectUrl: "",
      reusedExisting: true
    }
  }

  const state = createOAuthState()
  const connection = upsertMailboxConnection({
    accountId: account.id,
    mailboxEmail: normalizedEmail,
    providerId: provider.id,
    providerLabel: provider.label,
    authType: provider.authType,
    connectionStatus: "authorization_pending",
    oauthState: state,
    oauthScope: GMAIL_SCOPES.join(" "),
    oauthAccessToken: "",
    oauthRefreshToken: "",
    oauthTokenExpiresAt: "",
    oauthExternalAccountId: "",
    lastError: "",
    isDefault: true
  })

  return {
    provider,
    connection,
    redirectUrl: buildGoogleAuthorizationUrl({
      email: normalizedEmail,
      state
    })
  }
}

async function finalizeGoogleMailboxConnection(code, state) {
  if (!code || !state) {
    const error = new Error("Code OAuth ou état manquant.")
    error.statusCode = 400
    throw error
  }

  ensureGoogleOAuthConfigured()

  const connection = getMailboxConnectionByState(state)
  if (!connection) {
    const error = new Error("Connexion boîte mail introuvable ou expirée.")
    error.statusCode = 404
    throw error
  }

  const tokenResult = await exchangeGoogleAuthorizationCode(code)
  const profile = await fetchGoogleProfile(tokenResult.access_token)
  const updatedConnection = updateMailboxConnectionStatus(connection.id, "connected", {
    oauthState: "",
    oauthScope: Array.isArray(tokenResult.scope) ? tokenResult.scope.join(" ") : (tokenResult.scope || connection.oauth_scope || ""),
    oauthAccessToken: encryptSecret(tokenResult.access_token),
    oauthRefreshToken: encryptSecret(tokenResult.refresh_token || decryptSecret(connection.oauth_refresh_token || "")),
    oauthTokenExpiresAt: computeExpiry(tokenResult.expires_in),
    oauthExternalAccountId: profile.emailAddress || connection.mailbox_email,
    lastSyncAt: "",
    lastError: ""
  })

  return updatedConnection
}

async function getValidGoogleAccessToken(connection) {
  const accessToken = decryptSecret(connection.oauth_access_token)
  const refreshToken = decryptSecret(connection.oauth_refresh_token)
  const expiry = connection.oauth_token_expires_at ? new Date(connection.oauth_token_expires_at).getTime() : 0

  if (accessToken && expiry > Date.now() + 30_000) {
    return {
      accessToken,
      connection
    }
  }

  if (!refreshToken) {
    const error = new Error("Aucun refresh token disponible pour cette boîte Gmail.")
    error.statusCode = 401
    throw error
  }

  try {
    const refreshResult = await refreshGoogleAccessToken(refreshToken)
    const updatedConnection = updateMailboxConnectionStatus(connection.id, connection.connection_status || "connected", {
      oauthAccessToken: encryptSecret(refreshResult.access_token),
      oauthRefreshToken: connection.oauth_refresh_token,
      oauthTokenExpiresAt: computeExpiry(refreshResult.expires_in),
      lastError: ""
    })

    return {
      accessToken: refreshResult.access_token,
      connection: updatedConnection
    }
  } catch (error) {
    updateMailboxConnectionStatus(connection.id, "connection_error", {
      lastError: error.message || "Impossible de rafraîchir le jeton Gmail."
    })
    error.statusCode = error.statusCode || 401
    throw error
  }
}

async function gmailApiRequest(connection, path, options = {}) {
  const { accessToken, connection: freshConnection } = await getValidGoogleAccessToken(connection)
  const method = options.method || "GET"
  const headers = {
    Authorization: `Bearer ${accessToken}`
  }

  if (options.body !== undefined) {
    headers["Content-Type"] = options.contentType || "application/json"
  }

  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, {
    method,
    headers,
    body: options.body === undefined
      ? undefined
      : (typeof options.body === "string" ? options.body : JSON.stringify(options.body))
  })

  const rawText = await response.text()
  const result = rawText ? JSON.parse(rawText) : {}
  if (!response.ok) {
    updateMailboxConnectionStatus(freshConnection.id, "connection_error", {
      lastError: result.error?.message || "Erreur Gmail API."
    })
    const error = new Error(result.error?.message || "Erreur Gmail API.")
    error.statusCode = response.status
    throw error
  }

  return {
    result,
    connection: updateMailboxConnectionStatus(freshConnection.id, "connected", {
      lastSyncAt: new Date().toISOString(),
      lastError: ""
    })
  }
}

function extractHeader(headers = [], name) {
  const lower = String(name || "").toLowerCase()
  const match = headers.find((header) => String(header.name || "").toLowerCase() === lower)
  return match?.value || ""
}

function extractEmailAddress(value = "") {
  const headerValue = String(value || "").trim()
  const angleMatch = headerValue.match(/<([^>]+)>/)
  if (angleMatch?.[1]) {
    return angleMatch[1].trim().toLowerCase()
  }

  const directMatch = headerValue.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return directMatch?.[0]?.trim().toLowerCase() || ""
}

function encodeBase64Url(value = "") {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "")
}

function encodeMimeHeader(value = "") {
  const text = String(value || "")
  if (!text) {
    return ""
  }

  if (/^[\x00-\x7F]*$/.test(text)) {
    return text
  }

  return `=?UTF-8?B?${Buffer.from(text, "utf8").toString("base64")}?=`
}

function encodeBodyBase64(value = "") {
  const encoded = Buffer.from(String(value || ""), "utf8").toString("base64")
  return encoded.replace(/(.{1,76})/g, "$1\r\n").trim()
}

function normalizeReplySubject(subject = "") {
  const trimmed = String(subject || "").trim()
  if (!trimmed) {
    return "Re: (Sans objet)"
  }

  return /^re\s*:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`
}

function getEscalatedPriority(priority = "normal") {
  if (priority === "low") return "normal"
  if (priority === "normal") return "high"
  if (priority === "high") return "critical"
  return "critical"
}

function applyMailboxActionPriority(message, action) {
  const storedPriority = action?.metadata?.currentPriority
  if (!storedPriority || !message?.analysis) {
    return message
  }

  return {
    ...message,
    analysis: {
      ...message.analysis,
      priority: storedPriority,
      priorityLabel: PRIORITY_LABELS[storedPriority] || message.analysis.priorityLabel
    }
  }
}

function computeMailboxPermissions({ connection, membership, isOwner }) {
  if (isOwner) {
    return {
      read: true,
      draft: true,
      validate: true,
      send: true,
      manageMailbox: true
    }
  }

  return {
    read: Boolean(membership?.permission_read),
    draft: Boolean(membership?.permission_draft),
    validate: Boolean(membership?.permission_validate),
    send: Boolean(membership?.permission_send),
    manageMailbox: Boolean(membership?.permission_manage_mailbox)
  }
}

function permissionKeyForAction(requiredPermission) {
  if (requiredPermission === "manageMailbox") return "manageMailbox"
  if (requiredPermission === "send") return "send"
  if (requiredPermission === "validate") return "validate"
  if (requiredPermission === "draft") return "draft"
  return "read"
}

function getFutureIsoDate(minutesFromNow = 15) {
  return new Date(Date.now() + Math.max(1, Number(minutesFromNow || 15)) * 60 * 1000).toISOString()
}

function isExpiredIsoDate(value = "") {
  if (!value) {
    return false
  }

  const timestamp = Date.parse(value)
  return Number.isNaN(timestamp) ? false : timestamp <= Date.now()
}

function normalizeCollaborationState(collaboration) {
  if (!collaboration) {
    return null
  }

  if (!isExpiredIsoDate(collaboration.lock_expires_at)) {
    return collaboration
  }

  return upsertMailboxMessageCollaboration({
    mailboxResourceId: collaboration.mailbox_resource_id,
    connectionId: collaboration.connection_id,
    gmailMessageId: collaboration.gmail_message_id,
    assignedToAccountId: null,
    lockOwnerAccountId: null,
    lockExpiresAt: null,
    assignmentState: "new",
    collaborationState: "available",
    lastActorAccountId: collaboration.last_actor_account_id || null,
    metadata: {
      ...(collaboration.metadata || {}),
      expiredAt: new Date().toISOString()
    }
  })
}

function decorateMessageWithCollaboration(message, collaboration, accountId) {
  const normalized = normalizeCollaborationState(collaboration)
  if (!normalized) {
    return {
      ...message,
      collaboration: {
        assignmentState: "new",
        collaborationState: "available",
        assignedToCurrentAccount: false,
        lockedByCurrentAccount: false,
        lockedByAnotherAccount: false,
        lockExpiresAt: ""
      }
    }
  }

  return {
    ...message,
    collaboration: {
      assignmentState: normalized.assignment_state,
      collaborationState: normalized.collaboration_state,
      assignedToAccountId: normalized.assigned_to_account_id,
      lockOwnerAccountId: normalized.lock_owner_account_id,
      lockExpiresAt: normalized.lock_expires_at,
      assignedToCurrentAccount: normalized.assigned_to_account_id === accountId,
      lockedByCurrentAccount: normalized.lock_owner_account_id === accountId,
      lockedByAnotherAccount: Boolean(normalized.lock_owner_account_id && normalized.lock_owner_account_id !== accountId)
    }
  }
}

function resolveMailboxConnectionAccess(accountId, connectionId, requiredPermission = "read") {
  const connection = getMailboxConnectionById(connectionId)
  if (!connection) {
    const error = new Error("Connexion boîte mail introuvable.")
    error.statusCode = 404
    throw error
  }

  const mailboxResource = getOrCreateMailboxResourceForConnection(connection)
  const isOwner = connection.account_id === accountId
  const membership = mailboxResource?.id
    ? getMailboxMembershipForAccountAndResource(accountId, mailboxResource.id)
    : null

  const sharingEnabled = Boolean(mailboxResource?.sharing_enabled)
  if (!isOwner && !sharingEnabled) {
    const error = new Error("Cette boîte mail n'est pas partagée avec ce compte.")
    error.statusCode = 403
    throw error
  }

  if (!isOwner && (!membership || membership.membership_status !== "active")) {
    const error = new Error("Aucun droit actif sur cette boîte mail.")
    error.statusCode = 403
    throw error
  }

  const permissions = computeMailboxPermissions({ connection, membership, isOwner })
  const permissionKey = permissionKeyForAction(requiredPermission)
  if (!permissions[permissionKey]) {
    const error = new Error("Droit insuffisant pour cette action sur la boîte mail.")
    error.statusCode = 403
    throw error
  }

  return {
    connection,
    mailboxResource,
    membership,
    permissions,
    isOwner,
    sharingEnabled
  }
}

function buildRawReplyMessage({ to, subject, text, inReplyTo }) {
  const headerLines = [
    `To: ${to}`,
    `Subject: ${encodeMimeHeader(subject)}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64"
  ]

  if (inReplyTo) {
    headerLines.push(`In-Reply-To: ${inReplyTo}`)
    headerLines.push(`References: ${inReplyTo}`)
  }

  return `${headerLines.join("\r\n")}\r\n\r\n${encodeBodyBase64(text)}`
}

async function getOrCreateGmailLabelId(connection, labelName) {
  const { result } = await gmailApiRequest(connection, "labels")
  const labels = Array.isArray(result.labels) ? result.labels : []
  const existingLabel = labels.find((label) => label.name === labelName)
  if (existingLabel?.id) {
    return existingLabel.id
  }

  const { result: createdLabel } = await gmailApiRequest(connection, "labels", {
    method: "POST",
    body: {
      name: labelName,
      labelListVisibility: "labelShow",
      messageListVisibility: "show"
    }
  })

  return createdLabel.id
}

async function sendGmailReply(connection, payload) {
  const raw = buildRawReplyMessage(payload)
  const { result } = await gmailApiRequest(connection, "messages/send", {
    method: "POST",
    body: {
      raw: encodeBase64Url(raw),
      threadId: payload.threadId || undefined
    }
  })

  return result
}

async function updateGmailMessageLabels(connection, messageId, addLabelIds = [], removeLabelIds = []) {
  return gmailApiRequest(connection, `messages/${encodeURIComponent(messageId)}/modify`, {
    method: "POST",
    body: {
      addLabelIds,
      removeLabelIds
    }
  })
}

async function trashGmailMessage(connection, messageId) {
  return gmailApiRequest(connection, `messages/${encodeURIComponent(messageId)}/trash`, {
    method: "POST",
    body: {}
  })
}

function buildRejectionMessageBody(message, reason) {
  return [
    "Bonjour,",
    "",
    `Votre message "${message.subject || "(Sans objet)"}" n'a pas été retenu pour traitement.`,
    "",
    `Motif du rejet : ${reason}`,
    "",
    "Si nécessaire, vous pouvez reformuler votre demande et nous écrire à nouveau.",
    "",
    "Bien cordialement"
  ].join("\n")
}

function buildDeletionMessageBody(message, reason) {
  return [
    "Bonjour,",
    "",
    `Votre message "${message.subject || "(Sans objet)"}" a été supprimé de notre file de traitement.`,
    "",
    `Motif de la suppression : ${reason}`,
    "",
    "Si cette suppression vous paraît erronée, vous pouvez nous renvoyer votre message avec des précisions complémentaires.",
    "",
    "Bien cordialement"
  ].join("\n")
}

function decodeBase64Url(value = "") {
  if (!value) return ""
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + padding, "base64").toString("utf8")
}

function collectBodyAndAttachments(parts = [], accumulator = { text: "", html: "", attachments: [] }) {
  for (const part of parts) {
    if (part.parts?.length) {
      collectBodyAndAttachments(part.parts, accumulator)
      continue
    }

    const filename = part.filename || ""
    if (filename) {
      accumulator.attachments.push({
        filename,
        contentType: part.mimeType || "",
        attachmentId: part.body?.attachmentId || "",
        inlineData: part.body?.data || "",
        size: Number(part.body?.size || 0)
      })
      continue
    }

    if (part.mimeType === "text/plain" && part.body?.data) {
      accumulator.text += `${decodeBase64Url(part.body.data)}\n`
    }

    if (part.mimeType === "text/html" && part.body?.data) {
      accumulator.html += decodeBase64Url(part.body.data)
    }
  }

  return accumulator
}

async function fetchGmailAttachmentData(connection, messageId, attachmentId) {
  if (!attachmentId) {
    return ""
  }

  const { result } = await gmailApiRequest(
    connection,
    `messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`
  )

  return result?.data || ""
}

async function enrichAttachmentsForClient(connection, messageId, attachments = []) {
  const context = buildAttachmentContext(
    await Promise.all((attachments || []).map(async (attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      rawData: attachment.inlineData || await fetchGmailAttachmentData(connection, messageId, attachment.attachmentId)
    })))
  )

  return context.attachments
}

async function listConnectedInboxMessages(accountId, connectionId, options = {}) {
  const { connection, mailboxResource, permissions, sharingEnabled } = resolveMailboxConnectionAccess(accountId, connectionId, "read")

  if (connection.connection_status !== "connected") {
    const error = new Error("La boîte mail n'est pas encore connectée.")
    error.statusCode = 403
    throw error
  }

  const maxResults = Math.max(1, Math.min(Number(options.limit || 10), 25))
  const processedMessageIds = new Set(listProcessedMailboxMessageIds(accountId, connectionId))
  const actionMap = new Map(
    listMailboxMessageActionsForConnection(accountId, connectionId).map((action) => [action.gmail_message_id, action])
  )
  const priorityConfig = getPriorityRulesConfig()
  const { result } = await gmailApiRequest(connection, `messages?labelIds=INBOX&maxResults=${maxResults}`)
  const messages = Array.isArray(result.messages) ? result.messages : []

  const detailedMessages = []
  for (const message of messages) {
    if (processedMessageIds.has(message.id)) {
      continue
    }

    const { result: detail } = await gmailApiRequest(connection, `messages/${encodeURIComponent(message.id)}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`)
    const mailAnalysis = await analyzeMailForProcessing({
      from: extractHeader(detail.payload?.headers, "From") || "",
      subject: extractHeader(detail.payload?.headers, "Subject") || "",
      body: detail.snippet || ""
    }, { priorityConfig })

    const detailedMessage = {
      id: detail.id,
      threadId: detail.threadId,
      subject: extractHeader(detail.payload?.headers, "Subject") || "(Sans objet)",
      from: extractHeader(detail.payload?.headers, "From") || "",
      date: extractHeader(detail.payload?.headers, "Date") || "",
      snippet: detail.snippet || "",
      analysis: mailAnalysis
    }

    const messageWithPriority = applyMailboxActionPriority(detailedMessage, actionMap.get(detail.id))
    const collaboration = sharingEnabled ? getMailboxMessageCollaboration(connection.id, detail.id) : null
    detailedMessages.push(decorateMessageWithCollaboration(messageWithPriority, collaboration, accountId))
  }

  return {
    connection,
    mailboxResource,
    permissions,
    messages: detailedMessages
  }
}

async function getConnectedInboxMessage(accountId, connectionId, messageId) {
  const { connection, sharingEnabled } = resolveMailboxConnectionAccess(accountId, connectionId, "read")

  const { result } = await gmailApiRequest(connection, `messages/${encodeURIComponent(messageId)}?format=full`)
  const extracted = collectBodyAndAttachments(result.payload?.parts || [])
  const enrichedAttachments = await enrichAttachmentsForClient(connection, result.id, extracted.attachments)
  const attachmentContext = buildAttachmentContext(enrichedAttachments)
  const headers = result.payload?.headers || []
  const priorityConfig = getPriorityRulesConfig()

  let text = extracted.text.trim()
  if (!text && result.payload?.body?.data) {
    text = decodeBase64Url(result.payload.body.data).trim()
  }

  const mailAnalysis = await analyzeMailForProcessing({
    from: extractHeader(headers, "From") || "",
    subject: extractHeader(headers, "Subject") || "",
    body: text,
    attachments: enrichedAttachments
  }, { priorityConfig })

  const action = listMailboxMessageActionsForConnection(accountId, connectionId).find((storedAction) => storedAction.gmail_message_id === result.id)
  const messageWithPriority = applyMailboxActionPriority({
      id: result.id,
      threadId: result.threadId,
      messageIdHeader: extractHeader(headers, "Message-ID") || "",
      subject: extractHeader(headers, "Subject") || "(Sans objet)",
      from: extractHeader(headers, "From") || "",
      fromEmail: extractEmailAddress(extractHeader(headers, "From") || ""),
      to: extractHeader(headers, "To") || "",
      date: extractHeader(headers, "Date") || "",
      snippet: result.snippet || "",
      text,
      html: extracted.html || "",
      attachments: enrichedAttachments,
      attachmentContext,
      analysis: mailAnalysis
    }, action)

  const collaboration = sharingEnabled ? getMailboxMessageCollaboration(connection.id, result.id) : null

  return {
    connection,
    message: decorateMessageWithCollaboration(messageWithPriority, collaboration, accountId)
  }
}

async function processConnectedInboxMessage(accountId, connectionId, payload = {}) {
  const messageId = String(payload.messageId || "").trim()
  const actionType = String(payload.actionType || "").trim().toLowerCase()
  const reason = String(payload.reason || "").trim()
  const replyBody = String(payload.replyBody || "").trim()

  if (!messageId || !actionType) {
    const error = new Error("Message ou action de traitement manquant.")
    error.statusCode = 400
    throw error
  }

  const supportedActions = new Set(["validated", "rejected", "deleted", "timed_out"])
  if (!supportedActions.has(actionType)) {
    const error = new Error("Action de traitement inconnue.")
    error.statusCode = 400
    throw error
  }

  if (actionType === "validated" && !replyBody) {
    const error = new Error("La réponse à envoyer est vide.")
    error.statusCode = 400
    throw error
  }

  if ((actionType === "rejected" || actionType === "deleted") && !reason) {
    const error = new Error("Le motif est obligatoire pour ce traitement.")
    error.statusCode = 400
    throw error
  }

  const requiredPermission = actionType === "timed_out"
    ? "draft"
    : actionType === "validated"
      ? "send"
      : "validate"
  const { connection, mailboxResource, permissions, sharingEnabled } = resolveMailboxConnectionAccess(accountId, connectionId, requiredPermission)

  const { message } = await getConnectedInboxMessage(accountId, connectionId, messageId)
  const activeCollaboration = sharingEnabled ? normalizeCollaborationState(getMailboxMessageCollaboration(connectionId, messageId)) : null
  if (activeCollaboration?.lock_owner_account_id && activeCollaboration.lock_owner_account_id !== accountId && !permissions.manageMailbox) {
    const error = new Error("Ce message est actuellement pris en charge par un autre utilisateur.")
    error.statusCode = 409
    throw error
  }
  const existingAction = listMailboxMessageActionsForConnection(accountId, connectionId).find((action) => action.gmail_message_id === messageId)
  const recipientEmail = message.fromEmail || extractEmailAddress(message.from)
  if (!recipientEmail && actionType !== "timed_out") {
    const error = new Error("Impossible d'identifier l'adresse du demandeur.")
    error.statusCode = 400
    throw error
  }

  if (actionType === "timed_out") {
    const currentPriority = existingAction?.metadata?.currentPriority || message.analysis?.priority || "normal"
    const escalatedPriority = getEscalatedPriority(currentPriority)
    const timeoutCount = Number(existingAction?.metadata?.timeoutCount || 0) + 1
    const adminAlertEmail = process.env.ADMIN_ALERT_EMAIL || process.env.SMTP_USER || ""
    let adminAlertSent = Boolean(existingAction?.metadata?.adminAlertSent)

    if (currentPriority === "critical" && adminAlertEmail && !adminAlertSent) {
      await sendTextMail({
        to: adminAlertEmail,
        subject: `Alerte admin - mail critique non traité ${message.subject || "(Sans objet)"}`,
        text: [
          "Un mail critique n'a pas été traité dans le délai imparti.",
          "",
          `Boîte : ${connection.mailbox_email}`,
          `Message : ${message.id}`,
          `Expéditeur : ${message.from || "Non renseigné"}`,
          `Objet : ${message.subject || "(Sans objet)"}`,
          `Priorité : ${message.analysis?.priorityLabel || "Critique"}`,
          "Motif : absence de décision utilisateur dans le délai imparti."
        ].join("\n")
      })
      adminAlertSent = true
    }

    const action = upsertMailboxMessageAction({
      accountId,
      connectionId,
      mailboxEmail: connection.mailbox_email,
      gmailMessageId: message.id,
      gmailThreadId: message.threadId || "",
      fromEmail: message.fromEmail || "",
      subject: message.subject || "",
      actionType: "timed_out",
      actionReason: "Absence de réponse utilisateur dans le délai imparti.",
      sourceStatus: "pending",
      metadataJson: JSON.stringify({
        currentPriority: escalatedPriority,
        timeoutCount,
        adminAlertSent,
        lastTimeoutAt: new Date().toISOString()
      })
    })

    return {
      connection,
      message,
      action,
      escalatedPriority,
      escalatedPriorityLabel: PRIORITY_LABELS[escalatedPriority] || "Normale",
      timeoutCount,
      adminAlertSent,
      sentMessage: {
        id: "",
        threadId: message.threadId || ""
      }
    }
  }

  let outgoingSubject = normalizeReplySubject(message.subject)
  let outgoingBody = replyBody
  let labelName = "AMA_TRAITE"
  const currentPriority = existingAction?.metadata?.currentPriority || message.analysis?.priority || "normal"
  const escalatedPriority = getEscalatedPriority(currentPriority)
  const rejectionCount = Number(existingAction?.metadata?.rejectionCount || 0) + (actionType === "rejected" ? 1 : 0)

  if (actionType === "rejected") {
    outgoingSubject = `Rejet de votre message : ${message.subject || "(Sans objet)"}`
    outgoingBody = buildRejectionMessageBody(message, reason)
    labelName = "AMA_REJETE"
  }

  if (actionType === "deleted") {
    outgoingSubject = `Suppression de votre message : ${message.subject || "(Sans objet)"}`
    outgoingBody = buildDeletionMessageBody(message, reason)
    labelName = "AMA_SUPPRIME"
  }

  const sentMessage = await sendGmailReply(connection, {
    to: recipientEmail,
    subject: outgoingSubject,
    text: outgoingBody,
    threadId: message.threadId,
    inReplyTo: message.messageIdHeader
  })

  const labelId = await getOrCreateGmailLabelId(connection, labelName)

  if (actionType === "deleted") {
    await updateGmailMessageLabels(connection, message.id, [labelId], ["INBOX", "UNREAD"])
    await trashGmailMessage(connection, message.id)
  } else if (actionType === "validated") {
    await updateGmailMessageLabels(connection, message.id, [labelId], ["INBOX", "UNREAD"])
  } else if (actionType === "rejected") {
    await updateGmailMessageLabels(connection, message.id, [labelId], ["UNREAD"])
  }

  const action = upsertMailboxMessageAction({
    accountId,
    connectionId,
    mailboxEmail: connection.mailbox_email,
    gmailMessageId: message.id,
    gmailThreadId: message.threadId || "",
    fromEmail: recipientEmail,
    subject: message.subject || "",
    actionType,
    actionReason: reason,
    replySubject: outgoingSubject,
    replyBody: outgoingBody,
    sentMessageId: sentMessage.id || "",
    sourceStatus: actionType === "rejected" ? "pending" : actionType,
    metadataJson: JSON.stringify({
      mailboxLabel: labelName,
      sentThreadId: sentMessage.threadId || message.threadId || "",
      attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
      currentPriority: actionType === "rejected" ? escalatedPriority : currentPriority,
      rejectionCount,
      lastRejectedAt: actionType === "rejected" ? new Date().toISOString() : (existingAction?.metadata?.lastRejectedAt || "")
    })
  })

  if (sharingEnabled && mailboxResource?.id) {
    upsertMailboxMessageCollaboration({
      mailboxResourceId: mailboxResource.id,
      connectionId,
      gmailMessageId: message.id,
      assignedToAccountId: actionType === "timed_out" ? accountId : null,
      lockOwnerAccountId: null,
      lockExpiresAt: null,
      assignmentState: actionType === "timed_out"
        ? "claimed"
        : actionType === "rejected"
          ? "new"
          : "completed",
      collaborationState: actionType === "timed_out"
        ? "awaiting_review"
        : actionType === "rejected"
          ? "available"
          : actionType,
      lastActorAccountId: accountId,
      metadata: {
        lastActionType: actionType,
        lastProcessedAt: new Date().toISOString(),
        currentPriority: actionType === "rejected" ? escalatedPriority : currentPriority,
        rejectionCount
      }
    })
  }

  return {
    connection,
    message,
    action,
    sentMessage: {
      id: sentMessage.id || "",
      threadId: sentMessage.threadId || ""
    }
  }
}

function claimMailboxMessageForAccount(accountId, connectionId, messageId, options = {}) {
  const { mailboxResource, permissions } = resolveMailboxConnectionAccess(accountId, connectionId, "draft")
  const collaboration = normalizeCollaborationState(getMailboxMessageCollaboration(connectionId, messageId))
  if (collaboration?.lock_owner_account_id && collaboration.lock_owner_account_id !== accountId && !permissions.manageMailbox) {
    const error = new Error("Ce message est déjà pris en charge par un autre utilisateur.")
    error.statusCode = 409
    throw error
  }

  return upsertMailboxMessageCollaboration({
    mailboxResourceId: mailboxResource.id,
    connectionId,
    gmailMessageId: messageId,
    assignedToAccountId: accountId,
    lockOwnerAccountId: accountId,
    lockExpiresAt: getFutureIsoDate(options.ttlMinutes || 15),
    assignmentState: "claimed",
    collaborationState: "claimed",
    lastActorAccountId: accountId,
    metadata: {
      ...(collaboration?.metadata || {}),
      claimedAt: new Date().toISOString()
    }
  })
}

function releaseMailboxMessageForAccount(accountId, connectionId, messageId, options = {}) {
  const { mailboxResource, permissions } = resolveMailboxConnectionAccess(accountId, connectionId, "draft")
  const collaboration = normalizeCollaborationState(getMailboxMessageCollaboration(connectionId, messageId))
  if (!collaboration) {
    return null
  }

  if (collaboration.lock_owner_account_id && collaboration.lock_owner_account_id !== accountId && !permissions.manageMailbox) {
    const error = new Error("Ce message est verrouillé par un autre utilisateur.")
    error.statusCode = 409
    throw error
  }

  return upsertMailboxMessageCollaboration({
    mailboxResourceId: mailboxResource.id,
    connectionId,
    gmailMessageId: messageId,
    assignedToAccountId: null,
    lockOwnerAccountId: null,
    lockExpiresAt: null,
    assignmentState: options.completed ? "completed" : "new",
    collaborationState: options.completed ? "completed" : "available",
    lastActorAccountId: accountId,
    metadata: {
      ...(collaboration.metadata || {}),
      releasedAt: new Date().toISOString()
    }
  })
}

function updateMailboxSharingModeForAccount(accountId, connectionId, sharingEnabled) {
  const { mailboxResource, permissions } = resolveMailboxConnectionAccess(accountId, connectionId, "manageMailbox")
  if (!mailboxResource?.id || !permissions.manageMailbox) {
    const error = new Error("Impossible de modifier le mode de partage de cette boîte mail.")
    error.statusCode = 403
    throw error
  }

  return updateMailboxResource(mailboxResource.id, {
    sharingEnabled: Boolean(sharingEnabled)
  })
}

module.exports = {
  resolveMailboxProvider,
  getGoogleOAuthConfig,
  createMailboxConnectionStart,
  finalizeGoogleMailboxConnection,
  listMailboxConnectionsForAccount,
  listConnectedInboxMessages,
  getConnectedInboxMessage,
  processConnectedInboxMessage,
  claimMailboxMessageForAccount,
  releaseMailboxMessageForAccount,
  updateMailboxSharingModeForAccount
}
