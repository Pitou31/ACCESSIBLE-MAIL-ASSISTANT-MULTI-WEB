const fs = require("fs")
const os = require("os")
const path = require("path")
const { execFile, spawn } = require("child_process")
const { promisify } = require("util")
const crypto = require("crypto")
const WebSocket = require("ws")
const { DeepgramClient } = require("@deepgram/sdk")
const { resolveProviderAccountForUser, decryptProviderApiKey } = require("./providerAccountService")
const { recordProviderUsageEvent } = require("./databaseService")

const execFileAsync = promisify(execFile)
const MAX_AUDIO_BYTES = 20 * 1024 * 1024
const projectRoot = path.resolve(__dirname, "../../..")
const FAST_WHISPER_VENV_PYTHON = process.env.FASTER_WHISPER_TEST_PYTHON
  || path.join(projectRoot, "..", "tools", "whisperlive-test", ".venv", "bin", "python")
const FAST_WHISPER_PROBE_SCRIPT = process.env.FASTER_WHISPER_TEST_SCRIPT
  || path.join(projectRoot, "..", "tools", "faster-whisper-test", "scripts", "browser_voice_probe.py")
const FAST_WHISPER_BASE_MODEL = process.env.FASTER_WHISPER_BASE_MODEL_PATH
  || "/Users/jacquessoule/.cache/huggingface/hub/models--Systran--faster-whisper-base/snapshots/ebe41f70d5b6dfa9166e2c581c45c9c0cfc57b66"
const DEEPGRAM_API_URL = process.env.DEEPGRAM_API_URL || "https://api.deepgram.com/v1/listen"
const KNOWN_HALLUCINATIONS = [
  "Sous-titres réalisés par la communauté d'Amara.org",
  "Sous titres réalisés par la communauté d'Amara.org",
  "Merci d'avoir regardé cette vidéo"
]
let whisperServerProcess = null
let whisperServerStartupPromise = null
const deepgramLiveSessions = new Map()
const assemblyAiLiveSessions = new Map()

function createStatusError(message, statusCode = 500) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function isConfiguredSecret(value) {
  const normalized = String(value || "").trim()
  return Boolean(normalized && normalized.toLowerCase() !== "replace_me")
}

function getDeepgramClient(overrideApiKey = "") {
  const apiKey = String(overrideApiKey || process.env.DEEPGRAM_API_KEY || "").trim()
  if (!isConfiguredSecret(apiKey)) {
    throw createStatusError("La cle API Deepgram n'est pas configuree.", 503)
  }
  return new DeepgramClient({ apiKey })
}

function getAssemblyAiApiKey(overrideApiKey = "") {
  const apiKey = String(overrideApiKey || process.env.ASSEMBLYAI_API_KEY || "").trim()
  if (!isConfiguredSecret(apiKey)) {
    throw createStatusError("La cle API AssemblyAI n'est pas configuree.", 503)
  }
  return apiKey
}

function getExtensionFromMimeType(mimeType = "") {
  if (mimeType.includes("wav")) return "wav"
  if (mimeType.includes("webm")) return "webm"
  if (mimeType.includes("ogg")) return "ogg"
  if (mimeType.includes("mp4")) return "mp4"
  if (mimeType.includes("mpeg")) return "mp3"
  return "wav"
}

function getAudioTranscriptionConfig() {
  return {
    provider: process.env.AUDIO_TRANSCRIPTION_PROVIDER || "whisper.cpp",
    model: process.env.AUDIO_TRANSCRIPTION_MODEL || "small",
    partialModel: process.env.AUDIO_TRANSCRIPTION_PARTIAL_MODEL || "tiny",
    cliPath: process.env.WHISPER_CPP_BIN || "whisper-cli",
    serverBinPath: process.env.WHISPER_CPP_SERVER_BIN || "whisper-server",
    modelPath: process.env.WHISPER_CPP_MODEL_PATH
      || "/Users/jacquessoule/Documents/SPARK/IA-Agent-Universel-Dev/tools/whisper.cpp/models/ggml-small.bin",
    partialModelPath: process.env.WHISPER_CPP_PARTIAL_MODEL_PATH
      || "/Users/jacquessoule/Documents/SPARK/IA-Agent-Universel-Dev/tools/whisper.cpp/models/for-tests-ggml-tiny.bin",
    serverPort: Number(process.env.WHISPER_CPP_SERVER_PORT || 8091),
    disableGpu: String(process.env.WHISPER_CPP_NO_GPU || "true").toLowerCase() !== "false"
  }
}

function getAudioTranscriptionHealth() {
  const config = getAudioTranscriptionConfig()
  const ready = Boolean(
    config.cliPath
    && config.modelPath
    && fs.existsSync(config.modelPath)
    && config.partialModelPath
    && fs.existsSync(config.partialModelPath)
  )

  return {
    provider: config.provider,
    model: config.model,
    partialModel: config.partialModel,
    ready,
    reason: ready ? null : "whisper.cpp ou son modele n'est pas configure.",
    deepgramReady: isConfiguredSecret(process.env.DEEPGRAM_API_KEY),
    assemblyaiReady: isConfiguredSecret(process.env.ASSEMBLYAI_API_KEY)
  }
}

async function resolveAudioProviderContext(accountId, preferredProvider) {
  const normalized = String(preferredProvider || "").trim().toLowerCase()
  if (!normalized || normalized === "local") {
    return {
      providerType: "local",
      providerAccountId: "",
      billingMode: "local",
      providerLabel: "Local"
    }
  }

  const providerAccount = resolveProviderAccountForUser(accountId, normalized)
  if (!providerAccount) {
    throw createStatusError(`Aucun fournisseur ${normalized} actif n'est configuré pour ce compte.`, 503)
  }

  return {
    providerType: providerAccount.providerType,
    providerAccountId: providerAccount.id || "",
    billingMode: providerAccount.billingMode || "personal",
    providerLabel: providerAccount.providerLabel,
    apiKey: providerAccount.apiKeyEncrypted ? decryptProviderApiKey(providerAccount.apiKeyEncrypted) : ""
  }
}

function estimateAudioUsageCost(providerType, durationSeconds, requestMode = "live") {
  const seconds = Math.max(0, Number(durationSeconds || 0))
  const minutes = seconds / 60

  if (providerType === "deepgram") {
    return {
      quantity: seconds,
      quantityUnit: "seconds",
      estimatedCostCents: Math.max(0, Math.round(minutes * 0.0077 * 100)),
      currency: "EUR",
      requestMode
    }
  }

  if (providerType === "assemblyai") {
    return {
      quantity: seconds,
      quantityUnit: "seconds",
      estimatedCostCents: Math.max(0, Math.round((minutes / 60) * 0.15 * 100)),
      currency: "EUR",
      requestMode
    }
  }

  return {
    quantity: seconds,
    quantityUnit: "seconds",
    estimatedCostCents: 0,
    currency: "EUR",
    requestMode
  }
}

async function recordAudioUsage(payload) {
  return recordProviderUsageEvent({
    accountId: payload.accountId,
    providerAccountId: payload.providerAccountId,
    providerType: payload.providerType,
    featureType: payload.featureType || "audio_dictation_live",
    requestMode: payload.requestMode || "live",
    quantity: payload.quantity,
    quantityUnit: payload.quantityUnit || "seconds",
    estimatedCostCents: payload.estimatedCostCents || 0,
    currency: payload.currency || "EUR",
    status: payload.status || "success",
    requestId: payload.requestId || "",
    mailboxResourceId: payload.mailboxResourceId || "",
    metadataJson: JSON.stringify(payload.metadata || {})
  })
}

function extractTranscriptFromStdout(stdout = "") {
  const lines = String(stdout || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  const transcriptLines = lines.filter((line) => {
    if (line.startsWith("load_backend:")) return false
    if (line.startsWith("ggml_")) return false
    if (line.startsWith("whisper_")) return false
    if (line.startsWith("system_info:")) return false
    if (line.startsWith("main:")) return false
    return true
  })

  return transcriptLines.join(" ").trim()
}

function looksLikeHallucination(text = "") {
  const normalized = String(text || "").trim()
  if (!normalized) {
    return true
  }

  const lower = normalized.toLowerCase()
  if (/^[\s.!,;:?'"“”‘’()[\]{}\-–—…]+$/.test(normalized)) {
    return true
  }

  for (const phrase of KNOWN_HALLUCINATIONS) {
    const phraseLower = phrase.toLowerCase()
    if (lower === phraseLower || lower.startsWith(phraseLower)) {
      return true
    }
  }

  return false
}

function resolveModelForMode(config, mode = "default") {
  if (mode === "partial" && config.partialModelPath && fs.existsSync(config.partialModelPath)) {
    return {
      model: config.partialModel,
      modelPath: config.partialModelPath
    }
  }

  return {
    model: config.model,
    modelPath: config.modelPath
  }
}

async function transcribeWithWhisperCpp({ buffer, mimeType, language = "fr", mode = "default" }) {
  const config = getAudioTranscriptionConfig()
  const selectedModel = resolveModelForMode(config, mode)
  if (!selectedModel.modelPath || !fs.existsSync(selectedModel.modelPath)) {
    throw createStatusError("Le modele whisper.cpp est introuvable.", 503)
  }

  const extension = getExtensionFromMimeType(mimeType)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ama-whispercpp-"))
  const audioPath = path.join(tempDir, `dictation.${extension}`)

  try {
    fs.writeFileSync(audioPath, buffer)

    const args = [
      "-m", selectedModel.modelPath,
      "-f", audioPath,
      "-l", language || "fr",
      "-nt",
      "-np"
    ]

    if (config.disableGpu) {
      args.unshift("-ng")
    }

    const { stdout, stderr } = await execFileAsync(config.cliPath, args, {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024,
      timeout: Number(process.env.AUDIO_TRANSCRIPTION_TIMEOUT_MS || 300000)
    })

    const mergedOutput = [stdout, stderr].filter(Boolean).join("\n")
    const extractedText = extractTranscriptFromStdout(mergedOutput)
    const text = looksLikeHallucination(extractedText) ? "" : extractedText

    console.log("[audio][whisper.cpp] transcription result", JSON.stringify({
      bytes: buffer.length,
      mimeType,
      language,
      mode,
      model: selectedModel.model,
      disableGpu: config.disableGpu,
      extractedTextLength: extractedText.length,
      textLength: text.length,
      stdoutLength: String(stdout || "").length,
      stderrLength: String(stderr || "").length
    }))

    return {
      text,
      provider: "whisper.cpp",
      model: selectedModel.model,
      debug: {
        stdout,
        stderr,
        mergedOutput
      }
    }
  } catch (error) {
    console.error("[audio][whisper.cpp] transcription error", error?.message || error)
    throw createStatusError(
      error?.stderr?.trim()
      || error?.stdout?.trim()
      || error.message
      || "Transcription whisper.cpp impossible.",
      500
    )
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (_) {
      // Rien de bloquant ici.
    }
  }
}

async function waitForWhisperServer(config, timeoutMs = 15000) {
  const startedAt = Date.now()
  const healthUrl = `http://127.0.0.1:${config.serverPort}/health`

  while (Date.now() - startedAt < timeoutMs) {
    try {
      const response = await fetch(healthUrl, { method: "GET" })
      if (response.ok) {
        return true
      }
    } catch (_) {
      // Le serveur n'est pas encore prêt.
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw createStatusError("Le serveur local whisper-server n'a pas pu demarrer a temps.", 503)
}

async function ensureWhisperServerStarted() {
  const config = getAudioTranscriptionConfig()
  if (!config.partialModelPath || !fs.existsSync(config.partialModelPath)) {
    throw createStatusError("Le modele partiel whisper.cpp est introuvable.", 503)
  }

  if (whisperServerProcess && whisperServerProcess.exitCode === null) {
    await waitForWhisperServer(config)
    return config
  }

  if (whisperServerStartupPromise) {
    await whisperServerStartupPromise
    return config
  }

  whisperServerStartupPromise = (async () => {
    const args = [
      "--host", "127.0.0.1",
      "--port", String(config.serverPort),
      "-m", config.partialModelPath,
      "-l", "fr",
      "-nt",
      "-nf"
    ]

    if (config.disableGpu) {
      args.push("-ng")
    }

    whisperServerProcess = spawn(config.serverBinPath, args, {
      stdio: ["ignore", "pipe", "pipe"]
    })

    whisperServerProcess.stdout.on("data", (chunk) => {
      const text = String(chunk || "").trim()
      if (text) {
        console.log(`[audio][whisper-server] ${text}`)
      }
    })

    whisperServerProcess.stderr.on("data", (chunk) => {
      const text = String(chunk || "").trim()
      if (text) {
        console.error(`[audio][whisper-server] ${text}`)
      }
    })

    whisperServerProcess.on("exit", (code, signal) => {
      console.error(`[audio][whisper-server] stopped code=${code} signal=${signal}`)
      whisperServerProcess = null
    })

    await waitForWhisperServer(config)
  })()

  try {
    await whisperServerStartupPromise
  } finally {
    whisperServerStartupPromise = null
  }

  return config
}

async function transcribeWithWhisperServer({ buffer, mimeType, language = "fr" }) {
  const config = await ensureWhisperServerStarted()
  const formData = new FormData()
  const filename = `chunk.${getExtensionFromMimeType(mimeType)}`
  const blob = new Blob([buffer], { type: mimeType || "audio/wav" })

  formData.append("file", blob, filename)
  formData.append("language", language || "fr")
  formData.append("response_format", "verbose_json")
  formData.append("no_timestamps", "true")
  formData.append("no_context", "true")
  formData.append("temperature", "0.0")
  formData.append("temperature_inc", "0.0")
  formData.append("suppress_nst", "true")

  const response = await fetch(`http://127.0.0.1:${config.serverPort}/inference`, {
    method: "POST",
    body: formData
  })

  const payloadText = await response.text()
  let payload = {}

  try {
    payload = JSON.parse(payloadText || "{}")
  } catch (_) {
    payload = {}
  }

  if (!response.ok) {
    throw createStatusError(
      payload.error
      || payloadText
      || "Erreur de transcription whisper-server.",
      response.status || 500
    )
  }

  const extractedText = String(payload.text || "").trim()
  const text = looksLikeHallucination(extractedText) ? "" : extractedText

  console.log("[audio][whisper-server] transcription result", JSON.stringify({
    bytes: buffer.length,
    mimeType,
    language,
    model: config.partialModel,
    extractedTextLength: extractedText.length,
    textLength: text.length
  }))

  return {
    text,
    provider: "whisper-server",
    model: config.partialModel,
    detectedLanguage: payload.detected_language || payload.language || language,
    audioDurationSeconds: payload.duration ?? null,
    debug: {
      mergedOutput: payloadText
    }
  }
}

async function transcribeAudioBuffer({ buffer, mimeType, language = "fr", mode = "default" }) {
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw createStatusError("Audio manquant pour la transcription.", 400)
  }

  if (buffer.length > MAX_AUDIO_BYTES) {
    throw createStatusError("Le fichier audio depasse la taille maximale autorisee.", 413)
  }

  const config = getAudioTranscriptionConfig()
  if (config.provider !== "whisper.cpp") {
    throw createStatusError(`Provider non supporte : ${config.provider}.`, 501)
  }

  if (mode === "partial") {
    return transcribeWithWhisperServer({ buffer, mimeType, language })
  }

  return transcribeWithWhisperCpp({ buffer, mimeType, language, mode })
}

async function probeAudioWithFasterWhisper({ buffer, mimeType, language = "fr" }) {
  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw createStatusError("Audio manquant pour le test faster-whisper.", 400)
  }

  if (!fs.existsSync(FAST_WHISPER_VENV_PYTHON)) {
    throw createStatusError("L'environnement faster-whisper de test est introuvable.", 503)
  }

  if (!fs.existsSync(FAST_WHISPER_PROBE_SCRIPT)) {
    throw createStatusError("Le script de test faster-whisper est introuvable.", 503)
  }

  if (!fs.existsSync(FAST_WHISPER_BASE_MODEL)) {
    throw createStatusError("Le modele faster-whisper base est introuvable.", 503)
  }

  const extension = getExtensionFromMimeType(mimeType)
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ama-fw-probe-"))
  const audioPath = path.join(tempDir, `probe.${extension}`)

  try {
    fs.writeFileSync(audioPath, buffer)
    const { stdout, stderr } = await execFileAsync(
      FAST_WHISPER_VENV_PYTHON,
      [
        FAST_WHISPER_PROBE_SCRIPT,
        audioPath,
        language || "fr",
        FAST_WHISPER_BASE_MODEL
      ],
      {
        encoding: "utf8",
        maxBuffer: 10 * 1024 * 1024,
        timeout: Number(process.env.FASTER_WHISPER_TEST_TIMEOUT_MS || 120000),
        env: {
          ...process.env,
          HF_HOME: path.join(projectRoot, "..", "tools", "faster-whisper-test", "cache", "hf"),
          FW_DEVICE: process.env.FW_DEVICE || "cpu",
          FW_COMPUTE_TYPE: process.env.FW_COMPUTE_TYPE || "int8",
          FW_WINDOW_SECONDS: process.env.FW_WINDOW_SECONDS || "1.8",
          FW_STEP_SECONDS: process.env.FW_STEP_SECONDS || "0.45"
        }
      }
    )

    const payload = JSON.parse(String(stdout || "{}").trim().split(/\r?\n/).filter(Boolean).pop() || "{}")

    console.log("[audio][faster-whisper-probe] result", JSON.stringify({
      bytes: buffer.length,
      mimeType,
      language,
      finalTextLength: String(payload.final_text || "").length,
      partialCount: Number(payload.partial_count || 0)
    }))

    return {
      provider: "faster-whisper",
      model: "base",
      probe: payload,
      debug: {
        stdout,
        stderr
      }
    }
  } catch (error) {
    console.error("[audio][faster-whisper-probe] error", error?.message || error)
    throw createStatusError(
      error?.stderr?.trim()
      || error?.stdout?.trim()
      || error.message
      || "Test faster-whisper impossible.",
      500
    )
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (_) {
      // Rien de bloquant ici.
    }
  }
}

async function probeAudioWithDeepgram({ buffer, mimeType, language = "fr" }) {
  const apiKey = String(process.env.DEEPGRAM_API_KEY || "").trim()
  if (!isConfiguredSecret(apiKey)) {
    throw createStatusError("La cle API Deepgram n'est pas configuree.", 503)
  }

  if (!buffer || !Buffer.isBuffer(buffer) || !buffer.length) {
    throw createStatusError("Audio manquant pour le test Deepgram.", 400)
  }

  const url = new URL(DEEPGRAM_API_URL)
  url.searchParams.set("model", "nova-3")
  url.searchParams.set("language", language || "fr")
  url.searchParams.set("smart_format", "true")
  url.searchParams.set("punctuate", "true")

  const startedAt = Date.now()
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Token ${apiKey}`,
      "Content-Type": mimeType || "audio/wav"
    },
    body: buffer
  })

  const payloadText = await response.text()
  let payload = {}
  try {
    payload = JSON.parse(payloadText || "{}")
  } catch (_) {
    payload = {}
  }

  if (!response.ok) {
    throw createStatusError(
      payload.err_msg
      || payload.error
      || payloadText
      || "Erreur Deepgram.",
      response.status || 500
    )
  }

  const alternative = payload?.results?.channels?.[0]?.alternatives?.[0] || {}
  const transcript = String(alternative.transcript || "").trim()
  const words = Array.isArray(alternative.words) ? alternative.words : []
  const utterances = Array.isArray(payload?.results?.utterances) ? payload.results.utterances : []
  const duration = Number(payload?.metadata?.duration || 0) || null
  const elapsedMs = Date.now() - startedAt

  return {
    provider: "deepgram",
    model: "nova-3",
    probe: {
      final_text: transcript,
      partials: utterances.map((item) => ({
        start: item.start,
        end: item.end,
        text: item.transcript
      })),
      word_count: words.length,
      audio_total_s: duration,
      request_elapsed_ms: elapsedMs,
      metadata: {
        request_id: payload?.metadata?.request_id || null,
        model_info: payload?.metadata?.model_info || null
      }
    },
    debug: {
      payloadText
    }
  }
}

async function startDeepgramLiveSession({ language = "fr", apiKey = "", providerMeta = null } = {}) {
  const client = getDeepgramClient(apiKey)
  const socket = await client.listen.v1.connect({
    Authorization: `Token ${apiKey || process.env.DEEPGRAM_API_KEY}`,
    model: "nova-3",
    language,
    encoding: "linear16",
    sample_rate: 16000,
    interim_results: true,
    punctuate: true,
    smart_format: true,
    vad_events: true,
    endpointing: 300,
    utterance_end_ms: 1000
  })

  const sessionId = crypto.randomUUID()
  const session = {
    id: sessionId,
    socket,
    createdAt: Date.now(),
    cursor: 0,
    events: [],
    finalText: "",
    latestPartialText: "",
    isOpen: false,
    stopRequested: false,
    providerMeta: providerMeta || null,
    resolveOpen: null,
    rejectOpen: null
  }

  session.openPromise = new Promise((resolve, reject) => {
    session.resolveOpen = resolve
    session.rejectOpen = reject
  })

  socket.on("open", () => {
    console.log(`[audio][deepgram-live] session ${sessionId} open`)
    session.isOpen = true
    session.resolveOpen?.()
  })

  socket.on("message", (message) => {
    const transcript = String(
      message?.channel?.alternatives?.[0]?.transcript
      || message?.results?.channels?.[0]?.alternatives?.[0]?.transcript
      || ""
    ).trim()
    const isFinal = Boolean(message?.is_final || message?.speech_final || message?.from_finalize)
    const speechFinal = Boolean(message?.speech_final || message?.from_finalize)
    const utterances = Array.isArray(message?.results?.utterances) ? message.results.utterances : []

    console.log("[audio][deepgram-live] message received", JSON.stringify({
      sessionId,
      rawKeys: message && typeof message === "object" ? Object.keys(message) : [],
      type: message?.type || null,
      rawPreview: JSON.stringify(message).slice(0, 500),
      hasResults: Boolean(message?.results || message?.channel),
      transcript: transcript.slice(0, 120),
      isFinal
    }))

    if (transcript) {
      if (isFinal) {
        session.finalText = [session.finalText, transcript].filter(Boolean).join(" ").trim()
        session.latestPartialText = ""
      } else {
        session.latestPartialText = transcript
      }

      session.cursor += 1
      session.events.push({
        cursor: session.cursor,
        text: transcript,
        isFinal,
        speechFinal,
        receivedAt: Date.now(),
        utterances: utterances.map((item) => ({
          start: item.start ?? null,
          end: item.end ?? null,
          text: item.transcript || ""
        }))
      })
    }
  })

  socket.on("close", () => {
    console.log(`[audio][deepgram-live] session ${sessionId} close`)
    session.isOpen = false
  })

  socket.on("error", (error) => {
    console.error(`[audio][deepgram-live] session ${sessionId} error`, error?.message || error)
    const err = createStatusError(error?.message || "Erreur Deepgram streaming.", 500)
    session.lastError = err
    if (!session.isOpen) {
      session.rejectOpen?.(err)
    }
  })

  socket.connect()
  deepgramLiveSessions.set(sessionId, session)
  await session.openPromise

  return {
    sessionId,
    model: "nova-3",
    provider: "deepgram"
  }
}

function getDeepgramLiveSession(sessionId) {
  const session = deepgramLiveSessions.get(String(sessionId || ""))
  if (!session) {
    throw createStatusError("Session Deepgram introuvable.", 404)
  }
  return session
}

async function appendDeepgramLiveAudio({ sessionId, buffer }) {
  const session = getDeepgramLiveSession(sessionId)
  if (session.lastError) {
    throw session.lastError
  }
  if (!buffer || !buffer.length) {
    return { ok: true }
  }
  if (!session.isOpen) {
    throw createStatusError("La session Deepgram n'est pas ouverte.", 409)
  }
  console.log("[audio][deepgram-live] chunk sent", JSON.stringify({
    sessionId,
    bytes: buffer.length
  }))
  session.socket.sendMedia(buffer)
  return { ok: true }
}

function listDeepgramLiveEvents({ sessionId, since = 0 }) {
  const session = getDeepgramLiveSession(sessionId)
  const cursor = Number(since || 0)
  const events = session.events.filter((event) => event.cursor > cursor)
  return {
    cursor: session.cursor,
    events,
    finalText: session.finalText,
    latestPartialText: session.latestPartialText
  }
}

async function stopDeepgramLiveSession({ sessionId }) {
  const session = getDeepgramLiveSession(sessionId)
  if (session.stopRequested) {
    return {
      finalText: session.finalText,
      cursor: session.cursor,
      events: session.events
    }
  }

  session.stopRequested = true
  if (session.isOpen) {
    try {
      session.socket.sendFinalize({ type: "Finalize" })
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 1200))
    try {
      session.socket.sendCloseStream({ type: "CloseStream" })
    } catch (_) {}
    try {
      session.socket.close()
    } catch (_) {}
  }

  deepgramLiveSessions.delete(sessionId)

  return {
    finalText: session.finalText,
    cursor: session.cursor,
    events: session.events,
    providerMeta: session.providerMeta || null,
    durationSeconds: Math.max(0, (Date.now() - session.createdAt) / 1000)
  }
}

function getAssemblyAiRealtimeUrl({ language = "fr" } = {}) {
  const url = new URL(process.env.ASSEMBLYAI_REALTIME_URL || "wss://streaming.assemblyai.com/v3/ws")
  url.searchParams.set("sample_rate", "16000")
  url.searchParams.set("encoding", "pcm_s16le")
  url.searchParams.set("speech_model", "universal-streaming-multilingual")
  url.searchParams.set("format_turns", "true")
  url.searchParams.set("language_detection", "true")
  url.searchParams.set("min_turn_silence", process.env.ASSEMBLYAI_MIN_TURN_SILENCE || "400")
  url.searchParams.set("max_turn_silence", process.env.ASSEMBLYAI_MAX_TURN_SILENCE || "1280")
  url.searchParams.set("inactivity_timeout", process.env.ASSEMBLYAI_INACTIVITY_TIMEOUT || "60")
  if (language && language !== "fr") {
    url.searchParams.set("language", language)
  }
  return url
}

function getAssemblyAiLiveSession(sessionId) {
  const session = assemblyAiLiveSessions.get(String(sessionId || ""))
  if (!session) {
    throw createStatusError("Session AssemblyAI introuvable.", 404)
  }
  return session
}

function rebuildAssemblyAiFinalText(session) {
  session.finalText = Array.from(session.finalTurns.values()).filter(Boolean).join(" ").trim()
}

async function startAssemblyAiLiveSession({ language = "fr", apiKey = "", providerMeta = null } = {}) {
  const resolvedApiKey = getAssemblyAiApiKey(apiKey)
  const url = getAssemblyAiRealtimeUrl({ language })
  const socket = new WebSocket(url, {
    headers: {
      Authorization: resolvedApiKey
    }
  })

  const sessionId = crypto.randomUUID()
  const session = {
    id: sessionId,
    socket,
    createdAt: Date.now(),
    cursor: 0,
    events: [],
    finalText: "",
    latestPartialText: "",
    finalTurns: new Map(),
    isOpen: false,
    stopRequested: false,
    providerMeta: providerMeta || null,
    resolveOpen: null,
    rejectOpen: null,
    lastError: null
  }

  session.openPromise = new Promise((resolve, reject) => {
    session.resolveOpen = resolve
    session.rejectOpen = reject
  })

  socket.on("open", () => {
    console.log(`[audio][assemblyai-live] session ${sessionId} open`)
    session.isOpen = true
  })

  socket.on("message", (rawData, isBinary) => {
    if (isBinary) {
      return
    }

    let message = null
    try {
      message = JSON.parse(String(rawData || ""))
    } catch (_) {
      message = null
    }

    if (!message || typeof message !== "object") {
      return
    }

    if (message.type === "Begin") {
      session.resolveOpen?.()
      return
    }

    if (message.type === "Termination") {
      session.isOpen = false
      return
    }

    if (message.type !== "Turn") {
      console.log("[audio][assemblyai-live] message received", JSON.stringify({
        sessionId,
        type: message.type || null
      }))
      return
    }

    const transcript = String(message.transcript || "").trim()
    const isFinal = Boolean(message.end_of_turn)
    const turnOrder = Number(message.turn_order || 0) || session.cursor + 1

    console.log("[audio][assemblyai-live] turn received", JSON.stringify({
      sessionId,
      turnOrder,
      isFinal,
      endOfTurn: Boolean(message.end_of_turn),
      turnIsFormatted: Boolean(message.turn_is_formatted),
      transcript: transcript.slice(0, 160)
    }))

    if (!transcript) {
      return
    }

    if (isFinal) {
      session.finalTurns.set(turnOrder, transcript)
      rebuildAssemblyAiFinalText(session)
      session.latestPartialText = ""
    } else {
      session.latestPartialText = transcript
    }

    session.cursor += 1
    session.events.push({
      cursor: session.cursor,
      turnOrder,
      text: transcript,
      isFinal,
      receivedAt: Date.now(),
      endOfTurn: Boolean(message.end_of_turn),
      turnIsFormatted: Boolean(message.turn_is_formatted),
      rawType: message.type,
      detectedLanguage: message.language_code || null,
      confidence: message.confidence ?? null
    })
  })

  socket.on("close", (code, reason) => {
    console.log(`[audio][assemblyai-live] session ${sessionId} close`, JSON.stringify({
      code,
      reason: String(reason || "")
    }))
    session.isOpen = false
  })

  socket.on("error", (error) => {
    console.error(`[audio][assemblyai-live] session ${sessionId} error`, error?.message || error)
    const err = createStatusError(error?.message || "Erreur AssemblyAI streaming.", 500)
    session.lastError = err
    if (!session.isOpen) {
      session.rejectOpen?.(err)
    }
  })

  assemblyAiLiveSessions.set(sessionId, session)
  await session.openPromise

  return {
    sessionId,
    model: "universal-streaming-multilingual",
    provider: "assemblyai"
  }
}

async function appendAssemblyAiLiveAudio({ sessionId, buffer }) {
  const session = getAssemblyAiLiveSession(sessionId)
  if (session.lastError) {
    throw session.lastError
  }
  if (!buffer || !buffer.length) {
    console.log("[audio][assemblyai-live] empty chunk ignored", JSON.stringify({ sessionId }))
    return { ok: true }
  }
  if (!session.isOpen) {
    throw createStatusError("La session AssemblyAI n'est pas ouverte.", 409)
  }

  console.log("[audio][assemblyai-live] chunk sent", JSON.stringify({
    sessionId,
    bytes: buffer.length
  }))
  session.socket.send(buffer, { binary: true })
  return { ok: true }
}

function listAssemblyAiLiveEvents({ sessionId, since = 0 }) {
  const session = getAssemblyAiLiveSession(sessionId)
  const cursor = Number(since || 0)
  const events = session.events.filter((event) => event.cursor > cursor)
  return {
    cursor: session.cursor,
    events,
    finalText: session.finalText,
    latestPartialText: session.latestPartialText
  }
}

async function stopAssemblyAiLiveSession({ sessionId }) {
  const session = getAssemblyAiLiveSession(sessionId)
  if (session.stopRequested) {
    return {
      finalText: session.finalText,
      cursor: session.cursor,
      events: session.events
    }
  }

  session.stopRequested = true
  if (session.isOpen) {
    try {
      session.socket.send(JSON.stringify({ type: "ForceEndpoint" }))
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 400))
    try {
      session.socket.send(JSON.stringify({ type: "Terminate" }))
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 900))
    try {
      session.socket.close()
    } catch (_) {}
  }

  assemblyAiLiveSessions.delete(sessionId)

  return {
    finalText: session.finalText || session.latestPartialText,
    cursor: session.cursor,
    events: session.events,
    providerMeta: session.providerMeta || null,
    durationSeconds: Math.max(0, (Date.now() - session.createdAt) / 1000)
  }
}

module.exports = {
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
}
