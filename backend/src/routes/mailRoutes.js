const { importMail, createMailDraft, createReplyDraft, interpretVoiceEditCommand } = require("../controllers/mailController")
const { createTextAssistStreamPlan, processTextAssist } = require("../services/textAssistService")
const { sendTextMail } = require("../services/mailService")
const {
  resolveMailboxProvider,
  createMailboxConnectionStart,
  finalizeGoogleMailboxConnection,
  listMailboxConnectionsForAccount,
  listConnectedInboxMessages,
  getConnectedInboxMessage,
  processConnectedInboxMessage,
  claimMailboxMessageForAccount,
  releaseMailboxMessageForAccount,
  updateMailboxSharingModeForAccount
} = require("../services/mailboxService")
const {
  deleteMailboxConnectionForAccount,
  getMailboxMessageActionStats,
  listStatsEvents,
  recordStatsEvent,
  resetStatsEventsForAccount,
  getAccountById
} = require("../services/databaseService")
const { getSessionPayloadFromRequest } = require("./accountRoutes")
const { log } = require("../utils/logger")
const pendingTextAssistStreams = new Map()
const TEXT_ASSIST_STREAM_TTL_MS = 10 * 60 * 1000

function createTextAssistStreamId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function pruneExpiredTextAssistStreams() {
  const now = Date.now()
  for (const [streamId, entry] of pendingTextAssistStreams.entries()) {
    if (!entry || (now - entry.createdAt) > TEXT_ASSIST_STREAM_TTL_MS) {
      pendingTextAssistStreams.delete(streamId)
    }
  }
}

function writeSseEvent(res, eventName, payload) {
  res.write(`event: ${eventName}\n`)
  res.write(`data: ${JSON.stringify(payload)}\n\n`)
}

function countWords(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

function recordTranslationStreamStats(entry, status = "succeeded", fullText = "", startedAt = Date.now(), error = null) {
  const payload = entry?.payload || {}
  const options = entry?.options || {}
  const sourceText = String(payload.sourceText || "").trim()
  const attachmentCount = Array.isArray(payload.attachments) ? payload.attachments.length : 0
  const provider = options.model || ""

  recordStatsEvent({
    event_type: status === "started" ? "translation_started" : status === "failed" ? "translation_failed" : "translation_succeeded",
    status: status === "started" ? "started" : status === "failed" ? "failed" : "succeeded",
    success: status === "started" ? null : status === "failed" ? 0 : 1,
    user_id: options.userId || options.accountId || null,
    account_id: options.accountId || null,
    session_id: options.sessionId || null,
    workflow: options.workflow || payload.workflow || null,
    action_scope: attachmentCount > 0 && !sourceText ? "attachment" : "mail",
    attachment_count: attachmentCount,
    source_language: payload.sourceLanguage || null,
    target_language: payload.targetLanguage || null,
    automatic: options.automatic ? 1 : 0,
    provider: provider || null,
    model_name: provider || null,
    model_label: provider || null,
    model_kind: String(provider || "").includes(":") ? "local" : (String(provider || "").includes("-api") || String(provider || "").includes("deepseek-") ? "api" : null),
    selection_mode: options.selectionMode || "user_selected",
    duration_ms: status === "started" ? null : Math.max(0, Date.now() - startedAt),
    generated_word_count: status === "succeeded" ? countWords(fullText) : null,
    generated_character_count: status === "succeeded" ? fullText.length : null,
    error_code: error?.code || null,
    error_message: error?.message || null,
    metadata: {
      action: "translate",
      sourceLabel: String(payload.sourceLabel || "").trim(),
      sourceTextLength: sourceText.length,
      provider: provider || "",
      fallback: false,
      retried: false,
      stream: true,
      totalChunks: Array.isArray(entry?.chunks) ? entry.chunks.length : 0
    }
  })
}

function getAccountDisplayLabel(account = null) {
  if (!account) return "Compte"
  const firstName = String(account.first_name || "").trim()
  const lastName = String(account.last_name || "").trim()
  const fullName = `${firstName} ${lastName}`.trim()
  if (fullName) return fullName
  const organizationName = String(account.organization_name || "").trim()
  if (organizationName) return organizationName
  return String(account.email || account.id || "Compte")
}

function requireActiveSession(req, res) {
  const payload = getSessionPayloadFromRequest(req)
  if (payload) {
    return payload
  }

  res.writeHead(401, {
    "Content-Type": "application/json"
  })
  res.end(JSON.stringify({
    ok: false,
    error: "Connexion utilisateur requise."
  }))
  return null
}

async function handleMailImport(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const rawMail = data.rawMail || data.raw || ""
    const options = {
      ...(data.options || {}),
      accountId: sessionPayload.account.id
    }
    const result = await importMail(rawMail, options)

    res.writeHead(200, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify(result))
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      error: "Erreur traitement mail",
      details: error.message
    }))
  }
}

async function handleMailCreateDraft(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const payload = data.payload || {}
    const options = {
      ...(data.options || {}),
      accountId: sessionPayload.account.id,
      userId: sessionPayload.account.id,
      sessionId: sessionPayload.sessionId
    }
    const result = await createMailDraft(payload, options)

    res.writeHead(200, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: true,
      ...result
    }))
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: false,
      error: "Erreur génération brouillon",
      details: error.message
    }))
  }
}

async function handleMailReplyDraft(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const payload = data.payload || {}
    const options = {
      ...(data.options || {}),
      accountId: sessionPayload.account.id,
      userId: sessionPayload.account.id,
      sessionId: sessionPayload.sessionId
    }
    const result = await createReplyDraft(payload, options)

    res.writeHead(200, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: true,
      ...result
    }))
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: false,
      error: "Erreur génération réponse",
      details: error.message
    }))
  }
}

async function handleMailVoiceEditCommand(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const payload = data.payload || {}
    const options = {
      ...(data.options || {}),
      accountId: sessionPayload.account.id
    }
    const result = await interpretVoiceEditCommand(payload, options)

    res.writeHead(200, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: true,
      ...result
    }))
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: false,
      error: "Erreur interpretation commande vocale",
      details: error.message
    }))
  }
}

async function handleMailTextAssist(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const payload = data.payload || {}
    const options = {
      ...(data.options || {}),
      accountId: sessionPayload.account.id,
      userId: sessionPayload.account.id,
      sessionId: sessionPayload.sessionId
    }
    const result = await processTextAssist(payload, options)

    res.writeHead(200, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: true,
      ...result
    }))
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: false,
      error: "Erreur assistance textuelle",
      details: error.message
    }))
  }
}

async function handleMailTextAssistStreamStart(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    pruneExpiredTextAssistStreams()
    const data = JSON.parse(body || "{}")
    const payload = data.payload || {}
    const options = {
      ...(data.options || {}),
      accountId: sessionPayload.account.id,
      userId: sessionPayload.account.id,
      sessionId: sessionPayload.sessionId
    }
    let chunks = Array.isArray(data.chunks)
      ? data.chunks
          .map((chunk) => {
            if (chunk && typeof chunk === "object") {
              const text = String(chunk.text || "").trim()
              return text ? {
                text,
                segmentType: String(chunk.segmentType || "").trim().toLowerCase()
              } : null
            }

            const text = String(chunk || "").trim()
            return text ? { text, segmentType: "" } : null
          })
          .filter(Boolean)
      : []

    if (!chunks.length) {
      const plan = createTextAssistStreamPlan(payload)
      chunks = plan.chunks
      log(`[text-assist-stream:start] sourceLabel="${payload.sourceLabel || ""}" texte_resolu=${plan.sourceText.length} chunks_generes=${chunks.length}`)
      if (plan.debug) {
        log(`[text-assist-stream:debug] ${JSON.stringify(plan.debug)}`)
      }
    } else {
      log(`[text-assist-stream:start] sourceLabel="${payload.sourceLabel || ""}" chunks_fournis=${chunks.length}`)
    }

    if (!chunks.length) {
      res.writeHead(400, {
        "Content-Type": "application/json"
      })
      res.end(JSON.stringify({
        ok: false,
        error: "Aucun bloc de traduction n'a ete prepare."
      }))
      return
    }

    const streamId = createTextAssistStreamId()
    pendingTextAssistStreams.set(streamId, {
      accountId: sessionPayload.account.id,
      payload,
      options,
      chunks,
      createdAt: Date.now()
    })
    log(`[text-assist-stream:start] streamId=${streamId} accountId=${sessionPayload.account.id} totalChunks=${chunks.length} model=${options.model || ""}`)

    res.writeHead(200, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: true,
      streamId,
      totalChunks: chunks.length
    }))
  } catch (error) {
    res.writeHead(500, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: false,
      error: "Erreur preparation streaming traduction",
      details: error.message
    }))
  }
}

async function handleMailTextAssistStream(req, res, streamId) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  pruneExpiredTextAssistStreams()
  const entry = pendingTextAssistStreams.get(streamId)
  if (!entry || entry.accountId !== sessionPayload.account.id) {
    res.writeHead(404, {
      "Content-Type": "application/json"
    })
    res.end(JSON.stringify({
      ok: false,
      error: "Flux de traduction introuvable ou expire."
    }))
    return
  }

  pendingTextAssistStreams.delete(streamId)

  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no"
  })
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders()
  }
  if (typeof res.socket?.setNoDelay === "function") {
    res.socket.setNoDelay(true)
  }
  res.write(": stream-open\n\n")

  let closed = false
  req.on("close", () => {
    closed = true
  })

  writeSseEvent(res, "open", {
    streamId,
    totalChunks: entry.chunks.length
  })
  log(`[text-assist-stream:open] streamId=${streamId} totalChunks=${entry.chunks.length}`)

  const translatedChunks = []
  const streamStartedAt = Date.now()

  try {
    try {
      recordTranslationStreamStats(entry, "started", "", streamStartedAt, null)
    } catch (_) {
      // Les statistiques ne doivent jamais bloquer le streaming.
    }
    for (let index = 0; index < entry.chunks.length; index += 1) {
      if (closed) {
        return
      }

      writeSseEvent(res, "progress", {
        current: index + 1,
        total: entry.chunks.length
      })
      const currentChunk = entry.chunks[index]
      log(`[text-assist-stream:progress] streamId=${streamId} bloc=${index + 1}/${entry.chunks.length} chars=${currentChunk.text.length} segment=${currentChunk.segmentType || ""}`)

      const result = await processTextAssist({
        ...entry.payload,
        sourceLabel: `fragment ${index + 1}/${entry.chunks.length} de ${entry.payload.sourceLabel || "la traduction"}`,
        sourceText: currentChunk.text,
        segmentType: currentChunk.segmentType || "",
        attachments: []
      }, {
        ...entry.options,
        statsTracking: false
      })

      const chunkText = String(result.result?.text || "")
      translatedChunks.push(chunkText)

      writeSseEvent(res, "chunk", {
        index,
        current: index + 1,
        total: entry.chunks.length,
        text: chunkText,
        fullText: translatedChunks.join("\n\n"),
        provider: result.meta?.provider || entry.options.model || ""
      })
      log(`[text-assist-stream:chunk] streamId=${streamId} bloc=${index + 1}/${entry.chunks.length} translatedChars=${chunkText.length}`)
    }

    const fullText = translatedChunks.join("\n\n")
    try {
      recordTranslationStreamStats(entry, "succeeded", fullText, streamStartedAt, null)
    } catch (_) {
      // Les statistiques ne doivent jamais bloquer le streaming.
    }

    writeSseEvent(res, "done", {
      totalChunks: entry.chunks.length,
      fullText
    })
    log(`[text-assist-stream:done] streamId=${streamId} totalChunks=${entry.chunks.length} finalChars=${fullText.length}`)
    res.end()
  } catch (error) {
    try {
      recordTranslationStreamStats(entry, "failed", translatedChunks.join("\n\n"), streamStartedAt, error)
    } catch (_) {
      // Les statistiques ne doivent jamais bloquer le streaming.
    }
    writeSseEvent(res, "error", {
      error: error.message || "Erreur streaming traduction."
    })
    log(`[text-assist-stream:error] streamId=${streamId} message=${error.message || "Erreur streaming traduction."}`)
    res.end()
  }
}

async function handleMailSend(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const payload = data.payload || {}
    const to = String(payload.to || "").trim()
    const cc = String(payload.cc || "").trim()
    const bcc = String(payload.bcc || "").trim()
    const subject = String(payload.subject || "").trim()
    const text = String(payload.body || "").trim()

    if (!to) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Destinataire manquant."
      }))
      return
    }

    if (!text) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Contenu du mail manquant."
      }))
      return
    }

    const result = await sendTextMail({
      to,
      cc,
      bcc,
      subject: subject || "Message",
      text
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      result
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur d'envoi du mail."
    }))
  }
}

async function handleMailboxConnectStart(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const email = data.email?.trim().toLowerCase() || ""
    if (!email) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Adresse de boîte mail manquante."
      }))
      return
    }

    const result = createMailboxConnectionStart(sessionPayload.account, email)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      provider: result.provider,
      connection: result.connection,
      redirectUrl: result.redirectUrl,
      reusedExisting: Boolean(result.reusedExisting)
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de préparation de connexion boîte mail."
    }))
  }
}

async function handleGoogleMailboxCallback(req, res) {
  try {
    const url = new URL(req.url, "http://localhost")
    const code = url.searchParams.get("code") || ""
    const state = url.searchParams.get("state") || ""
    const errorParam = url.searchParams.get("error") || ""

    if (errorParam) {
      res.writeHead(302, {
        Location: `/frontend/mail.html?mailbox=error&reason=${encodeURIComponent(errorParam)}`
      })
      res.end()
      return
    }

    const connection = await finalizeGoogleMailboxConnection(code, state)
    res.writeHead(302, {
      Location: `/frontend/mail.html?mailbox=connected&connectionId=${encodeURIComponent(connection.id)}&email=${encodeURIComponent(connection.mailbox_email)}`
    })
    res.end()
  } catch (error) {
    res.writeHead(302, {
      Location: `/frontend/mail.html?mailbox=error&reason=${encodeURIComponent(error.message || "Erreur OAuth Google")}`
    })
    res.end()
  }
}

async function handleMailboxConnectionsList(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const connections = listMailboxConnectionsForAccount(sessionPayload.account.id).map((connection) => ({
      id: connection.id,
      mailbox_email: connection.mailbox_email,
      provider_id: connection.provider_id,
      provider_label: connection.provider_label,
      auth_type: connection.auth_type,
      connection_status: connection.connection_status,
      updated_at: connection.updated_at,
      last_sync_at: connection.last_sync_at,
      last_error: connection.last_error,
      is_default: connection.is_default
    }))

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      providerHint: "Connexion production par fournisseur. Les secrets utilisateur ne sont pas demandés dans l'application.",
      connections
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des connexions boîte mail."
    }))
  }
}

async function handleMailboxInbox(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const connectionId = data.connectionId || ""
    const result = await listConnectedInboxMessages(sessionPayload.account.id, connectionId, { limit: data.limit || 10 })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      connection: {
        id: result.connection.id,
        mailbox_email: result.connection.mailbox_email,
        provider_label: result.connection.provider_label,
        connection_status: result.connection.connection_status
      },
      mailboxResource: result.mailboxResource
        ? {
            id: result.mailboxResource.id,
            sharing_enabled: result.mailboxResource.sharing_enabled
          }
        : null,
      permissions: result.permissions || null,
      inbox: result.messages
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture de l'Inbox."
    }))
  }
}

async function handleMailboxMessage(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const connectionId = data.connectionId || ""
    const messageId = data.messageId || ""

    if (!connectionId || !messageId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion boîte mail ou identifiant du message manquant."
      }))
      return
    }

    const result = await getConnectedInboxMessage(sessionPayload.account.id, connectionId, messageId)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      connection: {
        id: result.connection.id,
        mailbox_email: result.connection.mailbox_email,
        provider_label: result.connection.provider_label
      },
      message: result.message
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture du mail."
    }))
  }
}

async function handleMailboxDisconnect(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const connectionId = data.connectionId || ""
    if (!connectionId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion boîte mail manquante."
      }))
      return
    }

    const deleted = deleteMailboxConnectionForAccount(connectionId, sessionPayload.account.id)
    if (!deleted) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion boîte mail introuvable."
      }))
      return
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      connection: {
        id: deleted.id,
        mailbox_email: deleted.mailbox_email
      }
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de suppression de connexion boîte mail."
    }))
  }
}

async function handleMailboxProcess(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const connectionId = data.connectionId || ""
    const messageId = data.messageId || ""
    const actionType = data.actionType || ""

    if (!connectionId || !messageId || !actionType) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion, message ou action manquant."
      }))
      return
    }

    const result = await processConnectedInboxMessage(sessionPayload.account.id, connectionId, {
      messageId,
      actionType,
      reason: data.reason || "",
      replyBody: data.replyBody || ""
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      processed: {
        messageId: result.message.id,
        threadId: result.message.threadId,
        actionType: result.action.action_type,
        sourceStatus: result.action.source_status,
        sentMessageId: result.sentMessage.id || ""
      }
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de traitement du mail."
    }))
  }
}

async function handleMailboxClaim(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const connectionId = data.connectionId || ""
    const messageId = data.messageId || ""
    const ttlMinutes = Number(data.ttlMinutes || 15)

    if (!connectionId || !messageId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion ou message manquant."
      }))
      return
    }

    const collaboration = claimMailboxMessageForAccount(sessionPayload.account.id, connectionId, messageId, {
      ttlMinutes
    })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      collaboration
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de prise en charge du message."
    }))
  }
}

async function handleMailboxRelease(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const connectionId = data.connectionId || ""
    const messageId = data.messageId || ""
    const completed = Boolean(data.completed)

    if (!connectionId || !messageId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion ou message manquant."
      }))
      return
    }

    const collaboration = releaseMailboxMessageForAccount(sessionPayload.account.id, connectionId, messageId, {
      completed
    })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      collaboration
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de libération du message."
    }))
  }
}

async function handleMailboxSharingMode(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const connectionId = data.connectionId || ""
    if (!connectionId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion boîte mail manquante."
      }))
      return
    }

    const resource = updateMailboxSharingModeForAccount(
      sessionPayload.account.id,
      connectionId,
      Boolean(data.sharingEnabled)
    )

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      mailboxResource: resource
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour du mode multi-utilisateur."
    }))
  }
}

async function handleMailboxStats(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const connectionId = url.searchParams.get("connectionId") || ""

    if (!connectionId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion boîte mail manquante."
      }))
      return
    }

    const stats = getMailboxMessageActionStats(sessionPayload.account.id, connectionId)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      stats
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des statistiques de traitement."
    }))
  }
}

async function handleStatsEvents(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const limit = Number(url.searchParams.get("limit") || 100)
    const eventType = String(url.searchParams.get("eventType") || "").trim()
    const provider = String(url.searchParams.get("provider") || "").trim()
    const requestedScope = String(url.searchParams.get("scope") || "account").trim().toLowerCase()
    const scope = requestedScope === "global" && sessionPayload.account.role === "admin" ? "global" : "account"

    const events = listStatsEvents({
      account_id: scope === "account" ? sessionPayload.account.id : undefined,
      event_type: eventType || undefined,
      provider: provider || undefined,
      limit
    })

    const accountLabels = new Map()
    const enrichedEvents = events.map((event) => {
      const accountId = String(event.account_id || "").trim()
      if (!accountId) {
        return { ...event, account_label: "Compte" }
      }
      if (!accountLabels.has(accountId)) {
        accountLabels.set(accountId, getAccountDisplayLabel(getAccountById(accountId)))
      }
      return {
        ...event,
        account_label: accountLabels.get(accountId) || accountId
      }
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      scope,
      events: enrichedEvents
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des événements statistiques."
    }))
  }
}


async function handleStatsReset(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const result = resetStatsEventsForAccount(sessionPayload.account.id)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      ...result
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de remise a zero des événements statistiques."
    }))
  }
}

module.exports = {
  handleMailImport,
  handleMailCreateDraft,
  handleMailReplyDraft,
  handleMailTextAssist,
  handleMailTextAssistStreamStart,
  handleMailTextAssistStream,
  handleMailVoiceEditCommand,
  handleMailSend,
  handleMailboxConnectStart,
  handleGoogleMailboxCallback,
  handleMailboxConnectionsList,
  handleMailboxInbox,
  handleMailboxMessage,
  handleMailboxDisconnect,
  handleMailboxProcess,
  handleMailboxClaim,
  handleMailboxRelease,
  handleMailboxSharingMode,
  handleMailboxStats,
  handleStatsEvents,
  handleStatsReset,
  resolveMailboxProvider
}
