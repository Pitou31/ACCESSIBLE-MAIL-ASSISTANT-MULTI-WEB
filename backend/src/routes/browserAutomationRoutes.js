const {
  getOrCreateAutomationPolicy,
  updateAutomationPolicy,
  startBrowserAutomationSession,
  listBrowserAutomationSessions
} = require("../services/browserAutomationService")
const { getSessionPayloadFromRequest } = require("./accountRoutes")

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

async function handleBrowserAutomationPolicyGet(req, res) {
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

    const result = getOrCreateAutomationPolicy(sessionPayload.account, connectionId)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      connection: {
        id: result.connection.id,
        mailbox_email: result.connection.mailbox_email,
        provider_label: result.connection.provider_label
      },
      policy: result.policy
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture de la politique d'automatisation."
    }))
  }
}

async function handleBrowserAutomationPolicyUpdate(req, res, body) {
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

    const result = updateAutomationPolicy(sessionPayload.account, connectionId, data)
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      connection: {
        id: result.connection.id,
        mailbox_email: result.connection.mailbox_email
      },
      policy: result.policy
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de mise à jour de la politique d'automatisation."
    }))
  }
}

async function handleBrowserAutomationSessionStart(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const result = await startBrowserAutomationSession(sessionPayload.account, data)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      connection: {
        id: result.connection.id,
        mailbox_email: result.connection.mailbox_email
      },
      policy: result.policy,
      session: result.session,
      message: result.message || null
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de démarrage de session navigateur."
    }))
  }
}

async function handleBrowserAutomationSessionsList(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const connectionId = url.searchParams.get("connectionId") || ""
    const limit = url.searchParams.get("limit") || "10"

    if (!connectionId) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Connexion boîte mail manquante."
      }))
      return
    }

    const sessions = listBrowserAutomationSessions(sessionPayload.account, connectionId, { limit })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      sessions
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des sessions navigateur."
    }))
  }
}

module.exports = {
  handleBrowserAutomationPolicyGet,
  handleBrowserAutomationPolicyUpdate,
  handleBrowserAutomationSessionStart,
  handleBrowserAutomationSessionsList
}
