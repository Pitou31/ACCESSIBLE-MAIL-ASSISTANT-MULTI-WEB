const {
  getAudioTranscriptionHealth,
  resolveAudioProviderContext,
  estimateAudioUsageCost,
  recordAudioUsage,
  transcribeAudioBuffer,
  probeAudioWithFasterWhisper,
  probeAudioWithDeepgram,
  startDeepgramLiveSession,
  appendDeepgramLiveAudio,
  listDeepgramLiveEvents,
  stopDeepgramLiveSession,
  startAssemblyAiLiveSession,
  appendAssemblyAiLiveAudio,
  listAssemblyAiLiveEvents,
  stopAssemblyAiLiveSession
} = require("../services/audioTranscriptionService")
const { getSessionPayloadFromRequest } = require("./accountRoutes")
const { getUserPreferences } = require("../services/databaseService")

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

async function handleAudioTranscriptionStatus(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  const status = getAudioTranscriptionHealth()
  const preferences = getUserPreferences(sessionPayload.account.id)
  res.writeHead(200, { "Content-Type": "application/json" })
  res.end(JSON.stringify({
    ok: true,
    ...status,
    preferences: preferences?.provider || {}
  }))
}

async function handleAudioTranscription(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    console.log("[audio][route] transcription request received")
    const data = JSON.parse(body || "{}")
    const audioBase64 = String(data.audioBase64 || "")
    const mimeType = String(data.mimeType || "audio/webm")
    const language = String(data.language || "fr")
    const prompt = String(data.prompt || "")
    const mode = String(data.mode || "default")

    if (!audioBase64) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Aucun contenu audio recu."
      }))
      return
    }

    const normalizedBase64 = audioBase64.includes(",")
      ? audioBase64.split(",").pop()
      : audioBase64

    const buffer = Buffer.from(normalizedBase64, "base64")
    const result = await transcribeAudioBuffer({
      buffer,
      mimeType,
      language,
      prompt,
      mode
    })

    console.log("[audio][route] transcription request completed", JSON.stringify({
      bytes: buffer.length,
      mimeType,
      mode,
      model: result.model,
      textLength: String(result.text || "").length
    }))

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      text: result.text,
      provider: result.provider,
      model: result.model,
      detectedLanguage: result.detectedLanguage || language,
      audioDurationSeconds: result.audioDurationSeconds ?? null,
      audioBytes: buffer.length,
      mimeType,
      debugPreview: String(result.debug?.mergedOutput || "").slice(0, 500)
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de transcription audio."
    }))
  }
}

async function handleFasterWhisperProbe(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const audioBase64 = String(data.audioBase64 || "")
    const mimeType = String(data.mimeType || "audio/wav")
    const language = String(data.language || "fr")

    if (!audioBase64) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Aucun contenu audio recu."
      }))
      return
    }

    const normalizedBase64 = audioBase64.includes(",")
      ? audioBase64.split(",").pop()
      : audioBase64
    const buffer = Buffer.from(normalizedBase64, "base64")
    const result = await probeAudioWithFasterWhisper({
      buffer,
      mimeType,
      language
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      provider: result.provider,
      model: result.model,
      probe: result.probe
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur pendant le test faster-whisper."
    }))
  }
}

async function handleDeepgramProbe(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const audioBase64 = String(data.audioBase64 || "")
    const mimeType = String(data.mimeType || "audio/wav")
    const language = String(data.language || "fr")

    if (!audioBase64) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Aucun contenu audio recu."
      }))
      return
    }

    const normalizedBase64 = audioBase64.includes(",")
      ? audioBase64.split(",").pop()
      : audioBase64
    const buffer = Buffer.from(normalizedBase64, "base64")
    const result = await probeAudioWithDeepgram({
      buffer,
      mimeType,
      language
    })

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      provider: result.provider,
      model: result.model,
      probe: result.probe
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur pendant le test Deepgram."
    }))
  }
}

async function handleDeepgramLiveStart(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const language = String(data.language || "fr")
    const preferences = getUserPreferences(sessionPayload.account.id)
    const preferredProvider = String(data.provider || preferences?.audio?.audioInputProvider || preferences?.provider?.preferredAudioProvider || "deepgram")
    const providerContext = await resolveAudioProviderContext(sessionPayload.account.id, preferredProvider)
    const result = await startDeepgramLiveSession({
      language,
      apiKey: providerContext.apiKey,
      providerMeta: {
        accountId: sessionPayload.account.id,
        providerType: providerContext.providerType,
        providerAccountId: providerContext.providerAccountId,
        billingMode: providerContext.billingMode,
        providerLabel: providerContext.providerLabel
      }
    })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, ...result, provider: providerContext }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: error.message || "Impossible de démarrer Deepgram live." }))
  }
}

async function handleDeepgramLiveChunk(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const sessionId = String(data.sessionId || "")
    const normalizedBase64 = String(data.audioBase64 || "").includes(",")
      ? String(data.audioBase64 || "").split(",").pop()
      : String(data.audioBase64 || "")
    const buffer = normalizedBase64 ? Buffer.from(normalizedBase64, "base64") : Buffer.alloc(0)
    const result = await appendDeepgramLiveAudio({ sessionId, buffer })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, ...result }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: error.message || "Impossible d'envoyer le chunk audio." }))
  }
}

async function handleDeepgramLiveEvents(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const sessionId = String(url.searchParams.get("sessionId") || "")
    const since = Number(url.searchParams.get("since") || 0)
    const result = listDeepgramLiveEvents({ sessionId, since })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, ...result }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: error.message || "Impossible de lire les partiels Deepgram." }))
  }
}

async function handleDeepgramLiveStop(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const sessionId = String(data.sessionId || "")
    const result = await stopDeepgramLiveSession({ sessionId })
    const providerMeta = result.providerMeta || {}
    const usage = estimateAudioUsageCost(providerMeta.providerType || "deepgram", result.durationSeconds, "live")
    if (providerMeta.accountId && providerMeta.providerAccountId) {
      await recordAudioUsage({
        accountId: providerMeta.accountId,
        providerAccountId: providerMeta.providerAccountId,
        providerType: providerMeta.providerType,
        quantity: usage.quantity,
        quantityUnit: usage.quantityUnit,
        estimatedCostCents: usage.estimatedCostCents,
        currency: usage.currency,
        requestMode: "live",
        status: result.finalText ? "success" : "error",
        requestId: sessionId,
        metadata: {
          eventsCount: Array.isArray(result.events) ? result.events.length : 0,
          durationSeconds: result.durationSeconds
        }
      })
    }
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      ...result,
      provider: providerMeta,
      usage
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: error.message || "Impossible d'arrêter Deepgram live." }))
  }
}

async function handleAssemblyAiLiveStart(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const language = String(data.language || "fr")
    const preferences = getUserPreferences(sessionPayload.account.id)
    const preferredProvider = String(data.provider || preferences?.audio?.audioInputProvider || preferences?.provider?.preferredAudioProvider || "assemblyai")
    const providerContext = await resolveAudioProviderContext(sessionPayload.account.id, preferredProvider)
    const result = await startAssemblyAiLiveSession({
      language,
      apiKey: providerContext.apiKey,
      providerMeta: {
        accountId: sessionPayload.account.id,
        providerType: providerContext.providerType,
        providerAccountId: providerContext.providerAccountId,
        billingMode: providerContext.billingMode,
        providerLabel: providerContext.providerLabel
      }
    })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, ...result, provider: providerContext }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: error.message || "Impossible de démarrer AssemblyAI live." }))
  }
}

async function handleAssemblyAiLiveChunk(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const sessionId = String(data.sessionId || "")
    const normalizedBase64 = String(data.audioBase64 || "").includes(",")
      ? String(data.audioBase64 || "").split(",").pop()
      : String(data.audioBase64 || "")
    const buffer = normalizedBase64 ? Buffer.from(normalizedBase64, "base64") : Buffer.alloc(0)
    const result = await appendAssemblyAiLiveAudio({ sessionId, buffer })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, ...result }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: error.message || "Impossible d'envoyer le chunk audio AssemblyAI." }))
  }
}

async function handleAssemblyAiLiveEvents(req, res) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const url = new URL(req.url, "http://localhost")
    const sessionId = String(url.searchParams.get("sessionId") || "")
    const since = Number(url.searchParams.get("since") || 0)
    const result = listAssemblyAiLiveEvents({ sessionId, since })
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: true, ...result }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: error.message || "Impossible de lire les partiels AssemblyAI." }))
  }
}

async function handleAssemblyAiLiveStop(req, res, body) {
  const sessionPayload = requireActiveSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const sessionId = String(data.sessionId || "")
    const result = await stopAssemblyAiLiveSession({ sessionId })
    const providerMeta = result.providerMeta || {}
    const usage = estimateAudioUsageCost(providerMeta.providerType || "assemblyai", result.durationSeconds, "live")
    if (providerMeta.accountId && providerMeta.providerAccountId) {
      await recordAudioUsage({
        accountId: providerMeta.accountId,
        providerAccountId: providerMeta.providerAccountId,
        providerType: providerMeta.providerType,
        quantity: usage.quantity,
        quantityUnit: usage.quantityUnit,
        estimatedCostCents: usage.estimatedCostCents,
        currency: usage.currency,
        requestMode: "live",
        status: result.finalText ? "success" : "error",
        requestId: sessionId,
        metadata: {
          eventsCount: Array.isArray(result.events) ? result.events.length : 0,
          durationSeconds: result.durationSeconds
        }
      })
    }
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      ...result,
      provider: providerMeta,
      usage
    }))
  } catch (error) {
    res.writeHead(error.statusCode || 500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({ ok: false, error: error.message || "Impossible d'arrêter AssemblyAI live." }))
  }
}

module.exports = {
  handleAudioTranscriptionStatus,
  handleAudioTranscription,
  handleFasterWhisperProbe,
  handleDeepgramProbe,
  handleDeepgramLiveStart,
  handleDeepgramLiveChunk,
  handleDeepgramLiveEvents,
  handleDeepgramLiveStop,
  handleAssemblyAiLiveStart,
  handleAssemblyAiLiveChunk,
  handleAssemblyAiLiveEvents,
  handleAssemblyAiLiveStop
}
