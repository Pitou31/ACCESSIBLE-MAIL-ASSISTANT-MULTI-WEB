(() => {
  const SESSION_KEY = "mail-assistant-session"
  const SETTINGS_STORAGE_KEY = "mail-assistant-settings"
  const TRANSCRIPTION_STATUS_URL = "/api/audio/transcription/status"
  const TRANSCRIPTION_URL = "/api/audio/transcription"
  const LIVE_PROVIDER_URLS = {
    deepgram: {
      start: "/api/audio/deepgram-live/start",
      chunk: "/api/audio/deepgram-live/chunk",
      events: "/api/audio/deepgram-live/events",
      stop: "/api/audio/deepgram-live/stop"
    },
    assemblyai: {
      start: "/api/audio/assemblyai-live/start",
      chunk: "/api/audio/assemblyai-live/chunk",
      events: "/api/audio/assemblyai-live/events",
      stop: "/api/audio/assemblyai-live/stop"
    }
  }
  const MIN_RECORDING_MS = 1200
  const TRANSCRIPTION_TIMEOUT_MS = 30000
  const PARTIAL_TRANSCRIPTION_INTERVAL_MS = 1400
  const PARTIAL_TRANSCRIPTION_MIN_MS = 900
  const PARTIAL_TRANSCRIPTION_OVERLAP_MS = 350
  const BACKEND_STATUS_RETRY_MS = 4000
  const LIVE_FLUSH_MS = 350
  const LIVE_POLL_MS = 400
  const VOICE_COMMAND_SILENCE_DELAY_MS = 1500
  const audioInputControllerRegistry = window.__mailAudioInputControllers || new Map()
  window.__mailAudioInputControllers = audioInputControllerRegistry

  function getSessionStorageKey(baseKey) {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
      const accountId = session?.userId || session?.accountId || ""
      return accountId ? `${baseKey}:${accountId}` : baseKey
    } catch (_) {
      return baseKey
    }
  }

  function getStoredAudioInputEnabled() {
    try {
      const settings = JSON.parse(localStorage.getItem(getSessionStorageKey(SETTINGS_STORAGE_KEY)) || "{}")
      if (typeof settings.audioInputEnabled === "boolean") {
        return settings.audioInputEnabled
      }
      return true
    } catch (_) {
      return true
    }
  }

  function getStoredAudioInputDeviceId() {
    try {
      const settings = JSON.parse(localStorage.getItem(getSessionStorageKey(SETTINGS_STORAGE_KEY)) || "{}")
      return String(settings.audioInputDeviceId || "").trim()
    } catch (_) {
      return ""
    }
  }

  function getStoredAudioInputProvider() {
    try {
      const settings = JSON.parse(localStorage.getItem(getSessionStorageKey(SETTINGS_STORAGE_KEY)) || "{}")
      const provider = String(settings.audioInputProvider || "assemblyai").trim().toLowerCase()
      if (provider === "assemblyai" || provider === "local" || provider === "deepgram") {
        return provider
      }
      return "assemblyai"
    } catch (_) {
      return "assemblyai"
    }
  }

  function isMissingAccountProviderError(error) {
    const message = String(error?.message || "")
    return /Aucun fournisseur .* actif n'est configuré pour ce compte\.?/i.test(message)
  }

  function pickPreferredAudioInputDevice(devices = []) {
    if (!Array.isArray(devices) || !devices.length) {
      return null
    }

    const virtualPattern = /(teams|virtual|blackhole|loopback|aggregate|zoomaudio|zoom audio|obs|cable|vb-audio)/i
    return devices.find((device) => !virtualPattern.test(device.label || "")) || devices[0]
  }

  async function blobToBase64(blob) {
    const arrayBuffer = await blob.arrayBuffer()
    let binary = ""
    const bytes = new Uint8Array(arrayBuffer)
    const chunkSize = 0x8000

    for (let index = 0; index < bytes.length; index += chunkSize) {
      const chunk = bytes.subarray(index, index + chunkSize)
      binary += String.fromCharCode(...chunk)
    }

    return btoa(binary)
  }

  function formatAudioDebugInfo({ recordedMs = 0, audioBytes = 0, mimeType = "", audioDurationSeconds = null, peak = null, rms = null, gain = null, trackLabel = "", trackState = "", trackEnabled = null, trackMuted = null, contextState = "" }) {
    const parts = []
    if (recordedMs) parts.push(`capture ${Math.round(recordedMs / 100) / 10}s`)
    if (audioDurationSeconds) parts.push(`audio ${Math.round(audioDurationSeconds * 10) / 10}s`)
    if (audioBytes) parts.push(`${Math.round(audioBytes / 1024)} Ko`)
    if (mimeType) parts.push(mimeType)
    if (peak !== null) parts.push(`peak ${peak.toFixed(3)}`)
    if (rms !== null) parts.push(`rms ${rms.toFixed(3)}`)
    if (gain && gain !== 1) parts.push(`gain x${gain.toFixed(1)}`)
    if (trackLabel) parts.push(`micro "${trackLabel}"`)
    if (trackState) parts.push(`track ${trackState}`)
    if (trackEnabled !== null) parts.push(`enabled ${trackEnabled}`)
    if (trackMuted !== null) parts.push(`muted ${trackMuted}`)
    if (contextState) parts.push(`context ${contextState}`)
    return parts.join(" | ")
  }

  function formatUsageCost(usage) {
    const cents = Number(usage?.estimatedCostCents || 0)
    if (!Number.isFinite(cents) || cents <= 0) {
      return ""
    }
    const currency = String(usage?.currency || "EUR")
    return (cents / 100).toLocaleString("fr-FR", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 4
    })
  }

  function mergeFloat32Chunks(chunks) {
    const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    const result = new Float32Array(totalLength)
    let offset = 0
    for (const chunk of chunks) {
      result.set(chunk, offset)
      offset += chunk.length
    }
    return result
  }

  function analyzeSamples(samples) {
    if (!samples.length) {
      return { peak: 0, rms: 0 }
    }

    let peak = 0
    let energy = 0
    for (let index = 0; index < samples.length; index += 1) {
      const value = Math.abs(samples[index])
      if (value > peak) {
        peak = value
      }
      energy += samples[index] * samples[index]
    }

    return {
      peak,
      rms: Math.sqrt(energy / samples.length)
    }
  }

  function normalizeSamples(samples) {
    const stats = analyzeSamples(samples)
    if (!samples.length || !stats.peak) {
      return {
        samples,
        peak: stats.peak,
        rms: stats.rms,
        gain: 1
      }
    }

    const targetPeak = 0.72
    const gain = Math.min(20, Math.max(1, targetPeak / stats.peak))
    if (gain === 1) {
      return {
        samples,
        peak: stats.peak,
        rms: stats.rms,
        gain
      }
    }

    const normalized = new Float32Array(samples.length)
    for (let index = 0; index < samples.length; index += 1) {
      const boosted = samples[index] * gain
      normalized[index] = Math.max(-1, Math.min(1, boosted))
    }

    const normalizedStats = analyzeSamples(normalized)
    return {
      samples: normalized,
      peak: normalizedStats.peak,
      rms: normalizedStats.rms,
      gain
    }
  }

  function writeString(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  function encodeWav(samples, sampleRate) {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    writeString(view, 0, "RIFF")
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(view, 8, "WAVE")
    writeString(view, 12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, sampleRate, true)
    view.setUint32(28, sampleRate * 2, true)
    view.setUint16(32, 2, true)
    view.setUint16(34, 16, true)
    writeString(view, 36, "data")
    view.setUint32(40, samples.length * 2, true)

    let offset = 44
    for (let index = 0; index < samples.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, samples[index]))
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
      offset += 2
    }

    return new Blob([buffer], { type: "audio/wav" })
  }

  function mergeIncrementalTranscript(previousText, chunkText) {
    const previous = String(previousText || "").trim()
    const incoming = String(chunkText || "").trim()

    if (!incoming) return previous
    if (!previous) return incoming

    const previousWords = previous.split(/\s+/)
    const incomingWords = incoming.split(/\s+/)
    const maxOverlap = Math.min(12, previousWords.length, incomingWords.length)
    let overlapCount = 0

    for (let count = maxOverlap; count > 0; count -= 1) {
      const previousSuffix = previousWords.slice(-count).join(" ").toLowerCase()
      const incomingPrefix = incomingWords.slice(0, count).join(" ").toLowerCase()
      if (previousSuffix === incomingPrefix) {
        overlapCount = count
        break
      }
    }

    const tail = incomingWords.slice(overlapCount).join(" ").trim()
    return tail ? `${previous} ${tail}` : previous
  }

  function pushDictationTrace(entry) {
    const type = String(entry?.type || "")
    if (type === "voice-command-lock:start" || type === "voice-command-lock:done") {
      console.info("[voice-command-lock]", entry)
    }
    if (
      type === "voice-silence-timer:reset"
      || type === "voice-silence-timer:cleared"
      || type === "voice-silence-timer:fired"
    ) {
      console.info("[voice-silence-timer]", entry)
    }
  }

  function extractIncrementalTranscript(previousText, nextText) {
    const previous = String(previousText || "").trim()
    const next = String(nextText || "").trim()

    if (!next) return ""
    if (!previous) return next
    if (next === previous) return ""
    if (next.startsWith(previous)) {
      return next.slice(previous.length).trim()
    }

    const previousWords = previous.split(/\s+/)
    const nextWords = next.split(/\s+/)
    const maxOverlap = Math.min(12, previousWords.length, nextWords.length)
    let overlapCount = 0

    for (let count = maxOverlap; count > 0; count -= 1) {
      const previousSuffix = previousWords.slice(-count).join(" ").toLowerCase()
      const nextPrefix = nextWords.slice(0, count).join(" ").toLowerCase()
      if (previousSuffix === nextPrefix) {
        overlapCount = count
        break
      }
    }

    return nextWords.slice(overlapCount).join(" ").trim()
  }

  function stripDiacritics(value) {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }

  function normalizePunctuationTarget(value) {
    const normalized = normalizeVoiceCommandForParsing(value)
    if (normalized === "virgule") return ","
    if (normalized === "point") return "."
    if (normalized === "deux points") return ":"
    if (normalized === "point d'interrogation") return "?"
    if (normalized === "point d exclamation") return "!"
    return decodeSpokenPunctuation(value)
  }

  function cleanupTargetCandidate(value) {
    return String(value || "")
      .trim()
      .replace(/^["“”'«»]+|["“”'«»]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
  }

  function applyTranscriptionCommandHeuristics(value) {
    let normalized = String(value || "")

    normalized = normalized.replace(/^\s*mais\s+(?=(?:une\s+majuscule|un\s+retour|deux\s+points|un\s+point|.+?\s+en\s+majuscules|.+?\s+en\s+minuscules))/i, "mets ")
    normalized = normalized.replace(/^\s*mes\s+(?=(?:une\s+majuscule|un\s+retour|deux\s+points|un\s+point|.+?\s+en\s+majuscules|.+?\s+en\s+minuscules))/i, "mets ")
    normalized = normalized.replace(/^\s*fait\s+un\s+nouveau\s+paragraphe/i, "fais un nouveau paragraphe")
    normalized = normalized.replace(/\bmai?s\s+deux\s+points\b/i, "mets deux points")
    normalized = normalized.replace(/\bmai?s\s+une\s+virgule\b/i, "mets une virgule")
    normalized = normalized.replace(/\bmai?s\s+un\s+point\b/i, "mets un point")
    normalized = normalized.replace(/\bmai?s\s+un\s+retour\s+a\s+la\s+ligne\b/i, "mets un retour a la ligne")

    return normalized
  }

  function normalizeVoiceCommandForParsing(value) {
    return stripDiacritics(applyTranscriptionCommandHeuristics(value))
      .toLowerCase()
      .replace(/[“”«»"]/g, "\"")
      .replace(/[’']/g, "'")
      .replace(/\s+/g, " ")
      .trim()
  }

  function decodeSpokenPunctuation(value) {
    return String(value || "")
      .replace(/\bvirgule\b/gi, ",")
      .replace(/\bpoint d'interrogation\b/gi, "?")
      .replace(/\bpoint d exclamation\b/gi, "!")
      .replace(/\bpoint\b/gi, ".")
      .replace(/\bdeux points\b/gi, ":")
      .replace(/\s+([,.;:!?])/g, "$1")
      .trim()
  }

  function buildLocalVoiceEditCommand(payload = {}) {
    const commandRaw = String(payload.command || "").trim()
    const command = normalizeVoiceCommandForParsing(commandRaw)
    if (!command) {
      return null
    }

    const shouldApply = true
    const confidence = 0.98

    const parseOccurrenceDescriptor = (rawDescriptor) => {
      const descriptor = normalizeVoiceCommandForParsing(rawDescriptor)
      if (/^(premier|premiere|première)$/.test(descriptor)) {
        return { occurrenceIndex: 1, occurrenceMode: "" }
      }
      if (/^(deuxieme|deuxième|second|seconde)$/.test(descriptor)) {
        return { occurrenceIndex: 2, occurrenceMode: "" }
      }
      if (/^(dernier|derniere|dernière)$/.test(descriptor)) {
        return { occurrenceIndex: 0, occurrenceMode: "last" }
      }
      return null
    }

    const replaceOrdinalMatch = command.match(/^(?:remplace|remplacer)\s+(?:le|la)\s+(premier|premiere|première|deuxieme|deuxième|second|seconde|dernier|derniere|dernière)\s+(.+?)\s+par\s+(.+)$/i)
    if (replaceOrdinalMatch) {
      const occurrence = parseOccurrenceDescriptor(replaceOrdinalMatch[1])
      if (occurrence) {
        return {
          action: "replace_nth_occurrence",
          target: normalizePunctuationTarget(replaceOrdinalMatch[2]),
          text: decodeSpokenPunctuation(replaceOrdinalMatch[3]),
          cursorPosition: "",
          shouldApply,
          confidence,
          reason: "Commande locale reconnue : remplacement d'occurrence ordinale.",
          occurrenceIndex: occurrence.occurrenceIndex,
          occurrenceMode: occurrence.occurrenceMode
        }
      }
    }

    const deleteOrdinalMatch = command.match(/^(?:supprime|supprimer)\s+(?:le|la)\s+(premier|premiere|première|deuxieme|deuxième|second|seconde|dernier|derniere|dernière)\s+(.+)$/i)
    if (deleteOrdinalMatch) {
      const occurrence = parseOccurrenceDescriptor(deleteOrdinalMatch[1])
      if (occurrence) {
        return {
          action: "delete_nth_occurrence",
          target: normalizePunctuationTarget(deleteOrdinalMatch[2]),
          text: "",
          cursorPosition: "",
          shouldApply,
          confidence,
          reason: "Commande locale reconnue : suppression d'occurrence ordinale.",
          occurrenceIndex: occurrence.occurrenceIndex,
          occurrenceMode: occurrence.occurrenceMode
        }
      }
    }

    const appendEndMatch = command.match(/^(?:ajoute|ajouter|mets|mettre|met)\s+(?:seulement\s+)?(?:(?:le|la)\s+mot\s+|la\s+phrase\s+)?(.+?)\s+a\s+la\s+fin(?:\s+du\s+texte|\s+de\s+page)?$/i)
      || command.match(/^a\s+la\s+fin\s+(?:ajoute|ajouter|mets|mettre|met)\s+(?:la\s+phrase\s+)?(.+)$/i)
      || command.match(/^positionne-toi\s+en\s+fin\s+de\s+page\s+et\s+(?:ajoute|ajouter|mets|mettre|met)\s+(?:seulement\s+)?(?:(?:le|la)\s+mot\s+|la\s+phrase\s+)?(.+)$/i)
    if (appendEndMatch) {
      return {
        action: "append_end",
        target: "",
        text: decodeSpokenPunctuation(appendEndMatch[1]),
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : ajout en fin."
      }
    }

    const replaceMatch = command.match(/^(?:remplace|remplacer|corrige|corriger)\s+(.+?)\s+par\s+(.+)$/i)
    if (replaceMatch) {
      return {
        action: "replace_text",
        target: replaceMatch[1].trim(),
        text: decodeSpokenPunctuation(replaceMatch[2]),
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : remplacement."
      }
    }

    const deleteMatch = command.match(/^(?:supprime|supprimer)\s+(?:le\s+mot\s+|la\s+phrase\s+)?(.+)$/i)
    if (deleteMatch && !/\b(paragraphe|premier|dernier|deuxieme|deuxième)\b/i.test(deleteMatch[1])) {
      return {
        action: "delete_text",
        target: decodeSpokenPunctuation(deleteMatch[1]),
        text: "",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : suppression."
      }
    }

    const insertBeforeMatch = command.match(/^(?:dans\s+.+?\s+)?(?:ajoute|ajouter|insere|inserer|mets|mettre|met)\s+(.+?)\s+(?:devant|avant)\s+(.+)$/i)
    if (insertBeforeMatch) {
      return {
        action: "insert_before",
        target: decodeSpokenPunctuation(insertBeforeMatch[2]),
        text: decodeSpokenPunctuation(insertBeforeMatch[1]),
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : insertion avant cible."
      }
    }

    const insertAfterMatch = command.match(/^(?:dans\s+.+?\s+)?(?:ajoute|ajouter|insere|inserer|mets|mettre|met)\s+(.+?)\s+apres\s+(.+)$/i)
    if (insertAfterMatch) {
      return {
        action: "insert_after",
        target: decodeSpokenPunctuation(insertAfterMatch[2].replace(/\s+sans\s+supprimer.+$/i, "")),
        text: decodeSpokenPunctuation(insertAfterMatch[1]),
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : insertion après cible."
      }
    }

    const uppercaseWordMatch = command.match(/^(?:mets|mettre|met)\s+(.+?)\s+en\s+majuscules?$/i)
    if (uppercaseWordMatch) {
      return {
        action: "uppercase_target",
        target: cleanupTargetCandidate(decodeSpokenPunctuation(uppercaseWordMatch[1])),
        text: "",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : passage en majuscules."
      }
    }

    const capitalizeMatch = command.match(/^(?:mets|mettre|met)\s+une\s+majuscule\s+a\s+(.+)$/i)
    if (capitalizeMatch) {
      return {
        action: "capitalize_target",
        target: cleanupTargetCandidate(decodeSpokenPunctuation(capitalizeMatch[1])),
        text: "",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : mise en capitale initiale."
      }
    }

    const lowercaseWordMatch = command.match(/^(?:mets|mettre|met)\s+(.+?)\s+en\s+minuscules?$/i)
    if (lowercaseWordMatch) {
      return {
        action: "lowercase_target",
        target: cleanupTargetCandidate(decodeSpokenPunctuation(lowercaseWordMatch[1])),
        text: "",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : passage en minuscules."
      }
    }

    const lineBreakBeforeMatch = command.match(/^(?:mets|mettre|met|fais|faire)\s+(?:un\s+)?retour\s+a\s+la\s+ligne\s+avant\s+(.+)$/i)
    if (lineBreakBeforeMatch) {
      return {
        action: "insert_line_break_before_target",
        target: cleanupTargetCandidate(decodeSpokenPunctuation(lineBreakBeforeMatch[1])),
        text: "",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : retour à la ligne avant cible."
      }
    }

    const lineBreakAfterMatch = command.match(/^(?:mets|mettre|met|fais|faire)\s+(?:un\s+)?retour\s+a\s+la\s+ligne\s+apres\s+(.+)$/i)
    if (lineBreakAfterMatch) {
      return {
        action: "insert_line_break_after_target",
        target: cleanupTargetCandidate(decodeSpokenPunctuation(lineBreakAfterMatch[1])),
        text: "",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : retour à la ligne après cible."
      }
    }

    const paragraphBeforeMatch = command.match(/^(?:fais|faire)\s+un\s+nouveau\s+paragraphe\s+avant\s+(.+)$/i)
    if (paragraphBeforeMatch) {
      return {
        action: "insert_paragraph_before_target",
        target: cleanupTargetCandidate(decodeSpokenPunctuation(paragraphBeforeMatch[1])),
        text: "",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : nouveau paragraphe avant cible."
      }
    }

    const insertStartMatch = command.match(/^au\s+debut\s+du\s+texte\s+(?:ajoute|ajouter|mets|mettre|met)\s+(.+)$/i)
    if (insertStartMatch) {
      return {
        action: "insert_at_start",
        target: "",
        text: `${decodeSpokenPunctuation(insertStartMatch[1])}\n`,
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : insertion au début."
      }
    }

    const colonBetweenMatch = command.match(/^(?:mets|mettre|met)\s+deux\s+points\s+entre\s+(.+?)\s+et\s+(.+)$/i)
    if (colonBetweenMatch) {
      return {
        action: "insert_after",
        target: decodeSpokenPunctuation(colonBetweenMatch[1]),
        text: ":",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : deux-points après la première cible."
      }
    }

    const commaAfterMatch = command.match(/^(?:ajoute|ajouter|mets|mettre|met)\s+une\s+virgule\s+apres\s+(.+)$/i)
    if (commaAfterMatch) {
      return {
        action: "insert_after",
        target: decodeSpokenPunctuation(commaAfterMatch[1]),
        text: ",",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : virgule après cible."
      }
    }

    const pointQuestionEndMatch = command.match(/^(?:mets|mettre|met)\s+un\s+point\s+d'interrogation\s+a\s+la\s+fin(?:\s+du\s+texte|\s+de\s+la\s+phrase)?$/i)
    if (pointQuestionEndMatch) {
      return {
        action: "append_end",
        target: "",
        text: "?",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : point d'interrogation final."
      }
    }

    const pointEndMatch = command.match(/^(?:ajoute|ajouter|mets|mettre|met)\s+un\s+point\s+a\s+la\s+fin(?:\s+du\s+texte|\s+de\s+la\s+phrase)?$/i)
    if (pointEndMatch) {
      return {
        action: "append_end",
        target: "",
        text: ".",
        cursorPosition: "",
        shouldApply,
        confidence,
        reason: "Commande locale reconnue : point final."
      }
    }

    return null
  }

  async function requestVoiceEditCommand(payload = {}, options = {}) {
    const localCommand = buildLocalVoiceEditCommand(payload)
    if (localCommand) {
      return localCommand
    }

    const response = await fetch("/api/mail/voice-edit-command", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload,
        options
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.details || result.error || "Erreur d'interpretation de la commande vocale.")
    }

    return result.command || {}
  }

  class PcmRecorder {
    constructor(stream, options = {}) {
      this.stream = stream
      this.options = options
      this.audioContext = null
      this.source = null
      this.processor = null
      this.chunks = []
      this.sampleRate = 44100
      this.started = false
      this.paused = false
      this.audioStats = { peak: 0, rms: 0, gain: 1 }
      this.contextState = "unknown"
    }

    async start() {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      if (!AudioContextCtor) {
        throw new Error("AudioContext non supporte par ce navigateur.")
      }

      this.audioContext = new AudioContextCtor()
      await this.audioContext.resume()
      this.contextState = this.audioContext.state
      this.sampleRate = this.audioContext.sampleRate
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (event) => {
        if (!this.started || this.paused) {
          return
        }
        const input = event.inputBuffer.getChannelData(0)
        const floatCopy = new Float32Array(input)
        this.chunks.push(floatCopy)
        if (typeof this.options.onPcmChunk === "function") {
          const targetRate = Number(this.options.pcmSampleRate || 16000)
          const resampled = resampleFloat32(floatCopy, this.audioContext.sampleRate, targetRate)
          const pcm = floatTo16BitPCM(resampled)
          this.options.onPcmChunk(pcm)
        }
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      this.started = true
      this.paused = false
    }

    pause() {
      this.paused = true
    }

    resume() {
      this.paused = false
    }

    async stop() {
      this.started = false
      if (this.processor) {
        this.processor.disconnect()
      }
      if (this.source) {
        this.source.disconnect()
      }
      if (this.audioContext) {
        this.contextState = this.audioContext.state
        if (this.audioContext.state !== "closed") {
          await this.audioContext.close()
        }
      }
      this.processor = null
      this.source = null
      this.audioContext = null

      const merged = mergeFloat32Chunks(this.chunks)
      const normalized = normalizeSamples(merged)
      this.audioStats = {
        peak: normalized.peak,
        rms: normalized.rms,
        gain: normalized.gain
      }
      return {
        blob: encodeWav(normalized.samples, this.sampleRate),
        totalSamples: normalized.samples.length,
        sampleRate: this.sampleRate,
        audioStats: this.audioStats
      }
    }

    buildSnapshot(options = {}) {
      const fromSample = Math.max(0, Number(options.fromSample || 0))
      const merged = mergeFloat32Chunks(this.chunks)
      const slice = merged.subarray(fromSample)
      const normalized = normalizeSamples(slice)

      return {
        blob: encodeWav(normalized.samples, this.sampleRate),
        sampleCount: normalized.samples.length,
        totalSamples: merged.length,
        sampleRate: this.sampleRate,
        durationMs: normalized.samples.length ? Math.round((normalized.samples.length / this.sampleRate) * 1000) : 0,
        audioStats: {
          peak: normalized.peak,
          rms: normalized.rms,
          gain: normalized.gain
        }
      }
    }
  }

  class LiveStreamRecorder {
    constructor(stream, onChunk) {
      this.stream = stream
      this.onChunk = onChunk
      this.audioContext = null
      this.source = null
      this.processor = null
      this.started = false
      this.paused = false
    }

    async start() {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      if (!AudioContextCtor) {
        throw new Error("AudioContext non supporte par ce navigateur.")
      }

      this.audioContext = new AudioContextCtor()
      await this.audioContext.resume()
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (event) => {
        if (!this.started || this.paused || typeof this.onChunk !== "function") {
          return
        }
        const input = event.inputBuffer.getChannelData(0)
        const floatCopy = new Float32Array(input)
        const resampled = resampleFloat32(floatCopy, this.audioContext.sampleRate, 16000)
        const pcm = floatTo16BitPCM(resampled)
        this.onChunk(pcm)
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      this.started = true
      this.paused = false
    }

    pause() {
      this.paused = true
    }

    resume() {
      this.paused = false
    }

    async stop() {
      this.started = false
      if (this.processor) {
        this.processor.disconnect()
      }
      if (this.source) {
        this.source.disconnect()
      }
      if (this.audioContext) {
        if (this.audioContext.state !== "closed") {
          await this.audioContext.close()
        }
      }
      this.processor = null
      this.source = null
      this.audioContext = null
    }
  }

  class AudioInputController {
    constructor(textElement, controlsElement, options = {}) {
      this.textElement = textElement
      this.controlsElement = controlsElement
      this.options = options
      this.state = "idle"
      this.enabled = getStoredAudioInputEnabled()
      this.supported = Boolean(navigator.mediaDevices?.getUserMedia && (window.AudioContext || window.webkitAudioContext))
      this.mediaStream = null
      this.recorder = null
      this.liveRecorder = null
      this.liveSession = null
      this.runtimeProviderOverride = ""
      this.transcriptBuffer = ""
      this.recordingStartedAt = 0
      this.lastSelectionStart = this.textElement?.selectionStart ?? 0
      this.lastSelectionEnd = this.textElement?.selectionEnd ?? 0
      this.lastNonEmptySelectionStart = null
      this.lastNonEmptySelectionEnd = null
      this.lastStatusMessage = ""
      this.backendReady = false
      this.backendReason = "Verification du service de transcription en attente."
      this.deepgramReady = false
      this.assemblyAiReady = false
      this.trackDebug = null
      this.partialTimerId = null
      this.partialRequestPromise = null
      this.backendStatusRetryId = null
      this.voiceCommandSilenceTimerId = null
      this.voiceCommandReady = false
      this.voiceCommandInputLocked = false
      this.voiceCommandAutoCycleInFlight = false
      this.partialTranscript = ""
      this.lastTranscribedSampleCount = 0
      this.initialValueBeforeDictation = ""
      this.initialSelectionStart = 0
      this.initialSelectionEnd = 0
      this.selectionTranscriptBase = ""
      this.pendingVoiceCommandText = ""
      this.suppressSelectionTracking = false
      this.liveProvider = ""
      this.liveSessionId = ""
      this.liveCursor = 0
      this.liveQueuedBytes = []
      this.livePollTimerId = null
      this.liveFlushTimerId = null
      this.liveFlushKickId = null
      this.liveCapturedChunkCount = 0
      this.liveSentChunkCount = 0
      this.liveFinalText = ""
      this.liveLatestPartialText = ""
      this.livePartials = []
      this.liveRunId = 0
      this.runtimeProviderOverride = ""
      this.startingListening = false
      this.stoppingListening = false
      this.appliedCaretStart = null
      this.appliedCaretEnd = null
      this.bind()
      this.refreshBackendStatus()
      this.render()
    }

    bind() {
      this.startButton = this.controlsElement.querySelector("[data-audio-input-start]")
      this.pauseButton = this.controlsElement.querySelector("[data-audio-input-pause]")
      this.resumeButton = this.controlsElement.querySelector("[data-audio-input-resume]")
      this.stopButton = this.controlsElement.querySelector("[data-audio-input-stop]")
      this.modeSelect = this.controlsElement.querySelector("[data-audio-input-mode]")
      this.statusElement = this.controlsElement.querySelector("[data-audio-input-status]")

      this.startButton?.addEventListener("mousedown", (event) => {
        event.preventDefault()
        if (!this.textElement) return
        this.lastSelectionStart = this.textElement.selectionStart ?? this.textElement.value.length
        this.lastSelectionEnd = this.textElement.selectionEnd ?? this.lastSelectionStart
        if (this.lastSelectionStart !== this.lastSelectionEnd) {
          this.lastNonEmptySelectionStart = this.lastSelectionStart
          this.lastNonEmptySelectionEnd = this.lastSelectionEnd
        }
        pushDictationTrace({
          type: "start-button-mousedown",
          targetId: this.textElement.id || "",
          mode: this.modeSelect?.value || "cursor",
          selectionStart: this.lastSelectionStart,
          selectionEnd: this.lastSelectionEnd,
          selectedText: this.textElement.value.slice(this.lastSelectionStart, this.lastSelectionEnd)
        })
      })
      this.startButton?.addEventListener("click", () => this.startListening())
      this.pauseButton?.addEventListener("click", () => this.pauseListening())
      this.resumeButton?.addEventListener("click", () => this.resumeListening())
      this.stopButton?.addEventListener("mousedown", (event) => {
        event.preventDefault()
      })
      this.stopButton?.addEventListener("click", () => this.stopListening({ insert: true }))
      this.modeSelect?.addEventListener("change", () => {
        if (!this.textElement) return
        const currentMode = this.modeSelect?.value || "cursor"
        const currentSelectionStart = this.textElement.selectionStart ?? this.textElement.value.length
        const currentSelectionEnd = this.textElement.selectionEnd ?? currentSelectionStart

        if (currentSelectionStart !== currentSelectionEnd) {
          this.lastNonEmptySelectionStart = currentSelectionStart
          this.lastNonEmptySelectionEnd = currentSelectionEnd
        }

        if (this.state === "recording") {
          this.initialValueBeforeDictation = this.textElement.value
          if (
            currentMode === "selection"
            && this.lastNonEmptySelectionStart !== null
            && this.lastNonEmptySelectionEnd !== null
            && this.lastNonEmptySelectionStart !== this.lastNonEmptySelectionEnd
          ) {
            this.initialSelectionStart = this.lastNonEmptySelectionStart
            this.initialSelectionEnd = this.lastNonEmptySelectionEnd
          } else {
            this.initialSelectionStart = currentSelectionStart
            this.initialSelectionEnd = currentSelectionEnd
          }
          this.liveSession?.resetTranscriptCapture?.()
          this.transcriptBuffer = ""
          this.partialTranscript = ""
          this.selectionTranscriptBase = ""
      this.pendingVoiceCommandText = ""
          pushDictationTrace({
            type: "mode-change-rebased-during-recording",
            targetId: this.textElement.id || "",
            mode: currentMode,
            initialSelectionStart: this.initialSelectionStart,
            initialSelectionEnd: this.initialSelectionEnd,
            selectedText: this.textElement.value.slice(this.initialSelectionStart, this.initialSelectionEnd),
            transcriptBase: this.selectionTranscriptBase
          })
        }
      })

      const rememberSelection = () => {
        if (!this.textElement) return
        if (this.suppressSelectionTracking) return
        this.lastSelectionStart = this.textElement.selectionStart ?? this.textElement.value.length
        this.lastSelectionEnd = this.textElement.selectionEnd ?? this.lastSelectionStart
        if (this.lastSelectionStart !== this.lastSelectionEnd) {
          this.lastNonEmptySelectionStart = this.lastSelectionStart
          this.lastNonEmptySelectionEnd = this.lastSelectionEnd
          if ((this.modeSelect?.value || "cursor") === "selection") {
            this.selectionModeArmed = true
          }
          if (this.state === "recording" && (this.modeSelect?.value || "cursor") === "selection") {
            this.initialValueBeforeDictation = this.textElement.value
            this.initialSelectionStart = this.lastSelectionStart
            this.initialSelectionEnd = this.lastSelectionEnd
            this.liveSession?.resetTranscriptCapture?.()
            this.transcriptBuffer = ""
            this.partialTranscript = ""
            this.selectionTranscriptBase = ""
      this.pendingVoiceCommandText = ""
            pushDictationTrace({
              type: "selection-rebased-during-recording",
              targetId: this.textElement.id || "",
              mode: "selection",
              initialSelectionStart: this.initialSelectionStart,
              initialSelectionEnd: this.initialSelectionEnd,
              selectedText: this.textElement.value.slice(this.initialSelectionStart, this.initialSelectionEnd),
              transcriptBase: this.selectionTranscriptBase
            })
          }
        }
        pushDictationTrace({
          type: "selection-change",
          targetId: this.textElement.id || "",
          mode: this.modeSelect?.value || "cursor",
          selectionStart: this.lastSelectionStart,
          selectionEnd: this.lastSelectionEnd,
          selectedText: this.textElement.value.slice(this.lastSelectionStart, this.lastSelectionEnd)
        })
      }

      this.textElement?.addEventListener("focus", rememberSelection)
      this.textElement?.addEventListener("click", rememberSelection)
      this.textElement?.addEventListener("mouseup", rememberSelection)
      this.textElement?.addEventListener("keyup", rememberSelection)
      this.textElement?.addEventListener("select", rememberSelection)
      this.textElement?.addEventListener("input", rememberSelection)

      window.addEventListener("storage", (event) => {
        if (event.key !== getSessionStorageKey(SETTINGS_STORAGE_KEY)) return
        this.enabled = getStoredAudioInputEnabled()
        if (!this.enabled && (this.state === "recording" || this.state === "paused" || this.state === "transcribing")) {
          this.stopListening({ insert: false })
        }
        this.render()
      })
    }

    async refreshBackendStatus() {
      if (!this.supported) return
      try {
        const response = await fetch(TRANSCRIPTION_STATUS_URL, {
          credentials: "same-origin",
          cache: "no-store"
        })
        const result = await response.json()
        this.backendReady = Boolean(result.ok && result.ready)
        this.backendReason = result.reason || "Service de transcription pret."
        this.deepgramReady = Boolean(result.ok && result.deepgramReady)
        this.assemblyAiReady = Boolean(result.ok && result.assemblyaiReady)
        if (this.backendReady) {
          this.clearBackendRetry()
        } else {
          this.scheduleBackendRetry()
        }
      } catch (_) {
        this.backendReady = false
        this.backendReason = "Le service de transcription n'est pas joignable."
        this.deepgramReady = false
        this.assemblyAiReady = false
        this.scheduleBackendRetry()
      }
      this.render()
    }

    scheduleBackendRetry() {
      if (this.backendStatusRetryId) return
      this.backendStatusRetryId = window.setTimeout(() => {
        this.backendStatusRetryId = null
        this.refreshBackendStatus()
      }, BACKEND_STATUS_RETRY_MS)
    }

    clearBackendRetry() {
      if (this.backendStatusRetryId) {
        window.clearTimeout(this.backendStatusRetryId)
      }
      this.backendStatusRetryId = null
    }

    isAiCommandMode() {
      return (this.modeSelect?.value || "cursor") === "ai-command"
    }

    clearVoiceCommandSilenceTimer() {
      if (this.voiceCommandSilenceTimerId) {
        window.clearTimeout(this.voiceCommandSilenceTimerId)
        pushDictationTrace({
          type: "voice-silence-timer:cleared",
          targetId: this.textElement?.id || "",
          isAiCommandMode: this.isAiCommandMode(),
          state: this.state
        })
      }
      this.voiceCommandSilenceTimerId = null
    }

    lockVoiceCommandInput() {
      pushDictationTrace({
        type: "voice-command-lock:start",
        targetId: this.textElement?.id || "",
        isLiveProvider: this.isLiveProvider(),
        hasControllerMediaStream: Boolean(this.mediaStream),
        controllerTracks: Array.from(this.mediaStream?.getTracks?.() || []).map((track) => ({
          kind: track.kind,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted
        })),
        hasLiveSession: Boolean(this.liveSession),
        hasRecorder: Boolean(this.recorder)
      })
      this.voiceCommandInputLocked = true
      this.clearVoiceCommandSilenceTimer()
      if (this.isLiveProvider()) {
        this.mediaStream?.getTracks()?.forEach((track) => track.stop())
        this.mediaStream = null
        this.liveSession?.freezeCapture?.()
      } else {
        this.stopPartialTranscriptionLoop()
        this.recorder?.pause()
        this.mediaStream?.getTracks()?.forEach((track) => track.stop())
      }
      pushDictationTrace({
        type: "voice-command-lock:done",
        targetId: this.textElement?.id || "",
        isLiveProvider: this.isLiveProvider(),
        hasControllerMediaStream: Boolean(this.mediaStream),
        hasLiveSession: Boolean(this.liveSession),
        hasRecorder: Boolean(this.recorder)
      })
    }

    markVoiceCommandReadyAfterSilence() {
      if (this.state !== "recording" || !this.isAiCommandMode() || this.voiceCommandAutoCycleInFlight) {
        return
      }
      const commandPreview = String(this.pendingVoiceCommandText || this.transcriptBuffer || "").trim()
      if (!commandPreview) {
        return
      }
      this.voiceCommandReady = true
      this.lockVoiceCommandInput()
      this.setStatus("transcribing", "Commande vocale détectée après silence. Analyse automatique en cours...")
      this.runAutomaticAiCommandCycle()
    }

    async runAutomaticAiCommandCycle() {
      if (this.voiceCommandAutoCycleInFlight) {
        return
      }
      this.voiceCommandAutoCycleInFlight = true
      try {
        await this.stopListening({ insert: true, autoRestartAiCommand: true })
      } finally {
        this.voiceCommandAutoCycleInFlight = false
      }
    }

    resetVoiceCommandSilenceTimer(transcriptText = "") {
      this.clearVoiceCommandSilenceTimer()
      if (this.state !== "recording" || !this.isAiCommandMode()) {
        return
      }
      const commandPreview = String(transcriptText || this.pendingVoiceCommandText || this.transcriptBuffer || "").trim()
      if (!commandPreview) {
        return
      }
      this.voiceCommandReady = false
      pushDictationTrace({
        type: "voice-silence-timer:reset",
        targetId: this.textElement?.id || "",
        isAiCommandMode: this.isAiCommandMode(),
        state: this.state,
        preview: commandPreview.slice(0, 80)
      })
      this.voiceCommandSilenceTimerId = window.setTimeout(() => {
        this.voiceCommandSilenceTimerId = null
        pushDictationTrace({
          type: "voice-silence-timer:fired",
          targetId: this.textElement?.id || "",
          isAiCommandMode: this.isAiCommandMode(),
          state: this.state
        })
        this.markVoiceCommandReadyAfterSilence()
      }, VOICE_COMMAND_SILENCE_DELAY_MS)
    }

    isEditable() {
      return Boolean(this.textElement) && !this.textElement.readOnly && !this.textElement.disabled
    }

    isAvailable() {
      if (!(this.enabled && this.supported && this.isEditable())) {
        return false
      }

      const provider = this.getSelectedProvider()
      if (provider === "deepgram") {
        return this.deepgramReady
      }
      if (provider === "assemblyai") {
        return this.assemblyAiReady
      }
      return this.backendReady
    }

    getSelectedProvider() {
      if (this.runtimeProviderOverride) {
        return this.runtimeProviderOverride
      }

      const storedProvider = getStoredAudioInputProvider()
      if (storedProvider === "deepgram" && !this.deepgramReady && this.assemblyAiReady) {
        return "assemblyai"
      }
      if (storedProvider === "assemblyai" && !this.assemblyAiReady && this.deepgramReady) {
        return "deepgram"
      }
      return storedProvider
    }

    rebaseCurrentActionFromVisibleText() {
      if (!this.textElement) return

      const currentMode = this.modeSelect?.value || "cursor"
      const selectionStart = this.textElement.selectionStart ?? this.textElement.value.length
      const selectionEnd = this.textElement.selectionEnd ?? selectionStart

      this.transcriptBuffer = ""
      this.partialTranscript = ""
      this.selectionTranscriptBase = ""
      this.pendingVoiceCommandText = ""
      this.voiceCommandReady = false
      this.clearVoiceCommandSilenceTimer()

      this.initialValueBeforeDictation = this.textElement.value
      this.lastSelectionStart = selectionStart
      this.lastSelectionEnd = selectionEnd

      if (selectionStart !== selectionEnd) {
        this.lastNonEmptySelectionStart = selectionStart
        this.lastNonEmptySelectionEnd = selectionEnd
      }

      if (
        currentMode === "selection"
        && this.lastNonEmptySelectionStart !== null
        && this.lastNonEmptySelectionEnd !== null
        && this.lastNonEmptySelectionStart !== this.lastNonEmptySelectionEnd
      ) {
        this.initialSelectionStart = this.lastNonEmptySelectionStart
        this.initialSelectionEnd = this.lastNonEmptySelectionEnd
      } else {
        this.initialSelectionStart = selectionStart
        this.initialSelectionEnd = selectionEnd
      }

      pushDictationTrace({
        type: "session-reset-rebased",
        targetId: this.textElement.id || "",
        mode: currentMode,
        initialSelectionStart: this.initialSelectionStart,
        initialSelectionEnd: this.initialSelectionEnd,
        selectedText: this.textElement.value.slice(this.initialSelectionStart, this.initialSelectionEnd)
      })
    }

    rememberAppliedCaret(start, end = start) {
      this.appliedCaretStart = Number.isInteger(start) ? start : null
      this.appliedCaretEnd = Number.isInteger(end) ? end : this.appliedCaretStart
    }

    restoreAppliedCaret() {
      if (!this.textElement) return
      if (!Number.isInteger(this.appliedCaretStart)) return
      const start = Math.max(0, Math.min(this.appliedCaretStart, this.textElement.value.length))
      const end = Math.max(start, Math.min(
        Number.isInteger(this.appliedCaretEnd) ? this.appliedCaretEnd : start,
        this.textElement.value.length
      ))
      this.textElement.focus()
      this.textElement.setSelectionRange(start, end)
      this.lastSelectionStart = start
      this.lastSelectionEnd = end
    }

    scheduleRestoreAppliedCaret() {
      window.setTimeout(() => {
        this.restoreAppliedCaret()
      }, 0)
    }

    getProviderLabel() {
      const provider = this.getSelectedProvider()
      if (provider === "assemblyai") return "AssemblyAI"
      if (provider === "local") return "local"
      return "Deepgram"
    }

    getCurrentProviderReadiness() {
      const provider = this.getSelectedProvider()
      if (provider === "deepgram") {
        return {
          ready: this.deepgramReady,
          reason: this.deepgramReady ? "Deepgram prêt." : "Deepgram n'est pas disponible."
        }
      }
      if (provider === "assemblyai") {
        return {
          ready: this.assemblyAiReady,
          reason: this.assemblyAiReady ? "AssemblyAI prêt." : "AssemblyAI n'est pas disponible."
        }
      }
      return {
        ready: this.backendReady,
        reason: this.backendReason
      }
    }

    isLiveProvider() {
      const provider = this.getSelectedProvider()
      return provider === "deepgram" || provider === "assemblyai"
    }

    beginLiveRun(provider) {
      this.liveProvider = provider
      this.liveRunId += 1
      return this.liveRunId
    }

    endLiveRun() {
      this.liveProvider = ""
      this.liveRunId += 1
    }

    isCurrentLiveRun(provider, runId) {
      return this.liveProvider === provider && this.liveRunId === runId
    }

    resetLiveState() {
      this.liveSessionId = ""
      this.liveCursor = 0
      this.liveQueuedBytes = []
      this.liveFlushKickId = null
      this.liveCapturedChunkCount = 0
      this.liveSentChunkCount = 0
      this.liveFinalText = ""
      this.liveLatestPartialText = ""
      this.livePartials = []
    }

    queueLiveChunk(provider, pcmBytes) {
      this.liveQueuedBytes.push(pcmBytes)
      this.liveCapturedChunkCount += 1
      if (this.state === "recording" && this.liveCapturedChunkCount <= 3) {
        this.setStatus("recording", `Signal micro capté (${this.liveCapturedChunkCount} chunk${this.liveCapturedChunkCount > 1 ? "s" : ""}) via ${this.getProviderLabel()}...`)
      }
      if (this.liveFlushKickId) {
        return
      }

      this.liveFlushKickId = window.setTimeout(() => {
        this.liveFlushKickId = null
        this.flushLiveChunks(provider).catch((error) => {
          this.state = "error"
          this.setStatus("error", error?.message ? String(error.message) : "Erreur de dictée en direct.")
        })
      }, 120)
    }

    composeLiveTranscript(finalText, latestPartialText) {
      const finalPart = String(finalText || "").trim()
      const partialPart = String(latestPartialText || "").trim()
      if (finalPart && partialPart) {
        return `${finalPart} ${partialPart}`.trim()
      }
      return finalPart || partialPart || ""
    }

    async startLiveSession(provider) {
      const urls = LIVE_PROVIDER_URLS[provider]
      if (!urls) {
        throw new Error(`Provider live non supporte : ${provider}`)
      }

      const response = await fetch(urls.start, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          language: this.options.lang || "fr"
        })
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Impossible de demarrer ${provider}.`)
      }

      this.liveSessionId = payload.sessionId
      this.liveCursor = 0
      this.liveQueuedBytes = []
      this.liveFinalText = ""
      this.liveLatestPartialText = ""
      this.livePartials = []
    }

    async flushLiveChunks(provider) {
      if (!this.liveSessionId || !this.liveQueuedBytes.length) {
        return
      }

      const urls = LIVE_PROVIDER_URLS[provider]
      const merged = new Blob([concatUint8Arrays(this.liveQueuedBytes)], { type: "application/octet-stream" })
      this.liveQueuedBytes = []
      const audioBase64 = await blobToBase64(merged)
      this.liveSentChunkCount += 1

      await fetch(urls.chunk, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.liveSessionId,
          audioBase64
        })
      })
    }

    async pollLiveEvents(provider) {
      if (!this.liveSessionId || this.voiceCommandInputLocked) {
        return
      }

      const runId = this.liveRunId
      const urls = LIVE_PROVIDER_URLS[provider]
      const response = await fetch(`${urls.events}?sessionId=${encodeURIComponent(this.liveSessionId)}&since=${this.liveCursor}`, {
        credentials: "same-origin",
        cache: "no-store"
      })
      if (!this.isCurrentLiveRun(provider, runId)) {
        return
      }

      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        return
      }
      if (this.voiceCommandInputLocked) {
        return
      }

      this.liveCursor = payload.cursor || this.liveCursor
      this.liveFinalText = String(payload.finalText || "").trim()
      this.liveLatestPartialText = String(payload.latestPartialText || "").trim()
      const transcript = this.composeLiveTranscript(this.liveFinalText, this.liveLatestPartialText)
      if (transcript) {
        const previousTranscript = this.transcriptBuffer
        this.transcriptBuffer = transcript
        this.partialTranscript = transcript
        this.renderLiveTranscript(transcript, previousTranscript)
        if (this.state === "recording") {
          const preview = transcript.length > 80 ? `${transcript.slice(0, 80)}...` : transcript
          this.setStatus("recording", `Dictée ${this.getProviderLabel()} : "${preview}"`)
        }
      }
    }

    startLiveLoop(provider) {
      this.stopLiveLoop()
      this.beginLiveRun(provider)
      this.liveFlushTimerId = window.setInterval(() => {
        this.flushLiveChunks(provider).catch((error) => {
          this.state = "error"
          this.setStatus("error", error?.message ? String(error.message) : "Erreur de dictée en direct.")
        })
      }, LIVE_FLUSH_MS)
      this.livePollTimerId = window.setInterval(() => {
        this.pollLiveEvents(provider).catch((error) => {
          this.state = "error"
          this.setStatus("error", error?.message ? String(error.message) : "Erreur de dictée en direct.")
        })
      }, LIVE_POLL_MS)
    }

    stopLiveLoop() {
      if (this.liveFlushTimerId) {
        window.clearInterval(this.liveFlushTimerId)
      }
      if (this.livePollTimerId) {
        window.clearInterval(this.livePollTimerId)
      }
      if (this.liveFlushKickId) {
        window.clearTimeout(this.liveFlushKickId)
      }
      this.liveFlushTimerId = null
      this.livePollTimerId = null
      this.liveFlushKickId = null
    }

    async stopLiveSession(provider) {
      const urls = LIVE_PROVIDER_URLS[provider]
      const finalSessionId = this.liveSessionId
      if (!finalSessionId || !urls) {
        return {
          finalText: this.liveFinalText,
          events: []
        }
      }

      const response = await fetch(urls.stop, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: finalSessionId })
      })
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || `Impossible d'arreter ${provider}.`)
      }
      return payload
    }

    async ensureMicrophoneAccess() {
      try {
        let temporaryStream = null
        try {
          temporaryStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        } catch (_) {
          // On tente quand meme l'enumeration et l'ouverture du micro cible.
        }

        let audioConstraints = true
        const preferredDeviceId = getStoredAudioInputDeviceId()

        if (preferredDeviceId) {
          audioConstraints = { deviceId: { exact: preferredDeviceId } }
        } else if (navigator.mediaDevices?.enumerateDevices) {
          const devices = await navigator.mediaDevices.enumerateDevices()
          const preferredDevice = pickPreferredAudioInputDevice(
            devices.filter((device) => device.kind === "audioinput")
          )
          if (preferredDevice?.deviceId) {
            audioConstraints = { deviceId: { exact: preferredDevice.deviceId } }
          }
        }

        temporaryStream?.getTracks().forEach((track) => track.stop())

        try {
          this.mediaStream = await navigator.mediaDevices.getUserMedia({
            audio: audioConstraints
          })
        } catch (error) {
          if (audioConstraints !== true) {
            this.mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
          } else {
            throw error
          }
        }
        const [track] = this.mediaStream.getAudioTracks()
        this.trackDebug = track ? {
          label: track.label || "micro inconnu",
          readyState: track.readyState || "unknown",
          enabled: Boolean(track.enabled),
          muted: Boolean(track.muted)
        } : null
        return true
      } catch (_) {
        this.setStatus("error", "Acces micro refuse ou indisponible. Verifie l'autorisation micro du navigateur.")
        return false
      }
    }

    async startListening() {
      if (this.startingListening || this.stoppingListening) {
        return
      }
      this.startingListening = true
      try {
        return await this._startListeningInternal()
      } finally {
        this.startingListening = false
      }
    }

    async _startListeningInternal() {
      if (!this.enabled) return this.setStatus("error", "La saisie audio est desactivee dans les parametres.")
      if (!this.supported) return this.setStatus("unsupported", "Saisie audio non supportee par ce navigateur.")
      if (!this.isEditable()) return this.setStatus("error", "Cette zone n'est pas modifiable.")
      const providerReadiness = this.getCurrentProviderReadiness()
      if (!providerReadiness.ready) {
        await this.refreshBackendStatus()
        const refreshedReadiness = this.getCurrentProviderReadiness()
        if (!refreshedReadiness.ready) {
          return this.setStatus("error", refreshedReadiness.reason || "Le service de transcription audio n'est pas pret.")
        }
      }
      if (this.state === "recording") return

      const microphoneReady = await this.ensureMicrophoneAccess()
      if (!microphoneReady) return

      this.transcriptBuffer = ""
      this.partialTranscript = ""
      this.pendingVoiceCommandText = ""
      this.voiceCommandReady = false
      this.voiceCommandInputLocked = false
      this.clearVoiceCommandSilenceTimer()
      this.lastTranscribedSampleCount = 0
      const currentMode = this.modeSelect?.value || "cursor"
      const rememberedStart = Number.isInteger(this.lastSelectionStart) ? this.lastSelectionStart : null
      const rememberedEnd = Number.isInteger(this.lastSelectionEnd) ? this.lastSelectionEnd : null
      const rememberedNonEmptyStart = Number.isInteger(this.lastNonEmptySelectionStart) ? this.lastNonEmptySelectionStart : null
      const rememberedNonEmptyEnd = Number.isInteger(this.lastNonEmptySelectionEnd) ? this.lastNonEmptySelectionEnd : null
      this.lastSelectionStart = rememberedStart ?? this.textElement.selectionStart ?? this.textElement.value.length
      this.lastSelectionEnd = rememberedEnd ?? this.textElement.selectionEnd ?? this.lastSelectionStart
      this.initialValueBeforeDictation = this.textElement.value
      if (
        currentMode === "selection"
        && rememberedNonEmptyStart !== null
        && rememberedNonEmptyEnd !== null
        && rememberedNonEmptyStart !== rememberedNonEmptyEnd
      ) {
        this.initialSelectionStart = rememberedNonEmptyStart
        this.initialSelectionEnd = rememberedNonEmptyEnd
      } else {
        this.initialSelectionStart = this.lastSelectionStart
        this.initialSelectionEnd = this.lastSelectionEnd
      }
      this.selectionTranscriptBase = currentMode === "selection" ? "" : this.selectionTranscriptBase
      pushDictationTrace({
        type: "start-listening",
        targetId: this.textElement.id || "",
        mode: currentMode,
        lastSelectionStart: this.lastSelectionStart,
        lastSelectionEnd: this.lastSelectionEnd,
        initialSelectionStart: this.initialSelectionStart,
        initialSelectionEnd: this.initialSelectionEnd,
        initialSelectedText: this.initialValueBeforeDictation.slice(this.initialSelectionStart, this.initialSelectionEnd)
      })
      const selectedProvider = this.getSelectedProvider()
      const useLiveProvider = this.isLiveProvider()
      this.resetLiveState()
      try {
        if (useLiveProvider) {
          this.mediaStream?.getTracks()?.forEach((track) => track.stop())
          this.mediaStream = null
          if (!window.MailLiveSpeech?.createSession) {
            throw new Error("Le module de dictée live n'est pas chargé.")
          }
          this.liveSession = window.MailLiveSpeech.createSession({
            provider: selectedProvider,
            language: this.options.lang || "fr",
            deviceId: getStoredAudioInputDeviceId(),
            onSessionReset: () => {
              this.rebaseCurrentActionFromVisibleText()
            },
            onFatalError: (message) => {
              this.cleanupRecorder()
              this.transcriptBuffer = ""
              this.partialTranscript = ""
              this.selectionTranscriptBase = ""
              this.pendingVoiceCommandText = ""
              this.voiceCommandReady = false
              this.voiceCommandInputLocked = false
              this.setStatus("error", message || "La session de dictée a été interrompue.")
            },
            onUpdate: ({ finalText, latestPartialText, capturedChunkCount }) => {
              if (this.voiceCommandInputLocked) {
                return
              }
              this.liveCapturedChunkCount = capturedChunkCount || this.liveCapturedChunkCount
              const transcript = this.composeLiveTranscript(finalText, latestPartialText)
              if (!transcript) {
                return
              }
              const previousTranscript = this.transcriptBuffer
              if (transcript === previousTranscript) {
                return
              }
              this.transcriptBuffer = transcript
              this.partialTranscript = transcript
              this.renderLiveTranscript(transcript, previousTranscript)
              if (this.state === "recording") {
                const preview = transcript.length > 80 ? `${transcript.slice(0, 80)}...` : transcript
                this.setStatus("recording", `Dictée ${this.getProviderLabel()} : "${preview}"`)
              }
            },
            onStatus: (message) => {
              if (this.state === "recording") {
                this.setStatus("recording", message)
              }
            }
          })
          try {
            const liveStart = await this.liveSession.start()
            this.trackDebug = liveStart.trackDebug || this.trackDebug
          } catch (error) {
            if (!isMissingAccountProviderError(error)) {
              throw error
            }
            this.cleanupRecorder()
            const microphoneReadyForFallback = await this.ensureMicrophoneAccess()
            if (!microphoneReadyForFallback) {
              return
            }
            this.runtimeProviderOverride = "local"
            this.recorder = new PcmRecorder(this.mediaStream, {
              pcmSampleRate: 16000
            })
            await this.recorder.start()
            this.state = "recording"
            this.recordingStartedAt = Date.now()
            this.voiceCommandReady = false
            this.voiceCommandInputLocked = false
            this.startPartialTranscriptionLoop()
            this.setStatus("recording", `Fournisseur ${selectedProvider} indisponible pour ce compte. Bascule automatique sur le moteur local.`)
            return
          }
        } else {
          this.recorder = new PcmRecorder(this.mediaStream, {
            pcmSampleRate: 16000
          })
          await this.recorder.start()
        }
        this.state = "recording"
        this.recordingStartedAt = Date.now()
        this.voiceCommandReady = false
        this.voiceCommandInputLocked = false
        if (useLiveProvider) {
          this.setStatus("recording", `Enregistrement ${this.getProviderLabel()} en cours.`)
        } else {
          this.startPartialTranscriptionLoop()
          this.setStatus("recording", "Enregistrement en cours. La transcription va apparaitre progressivement.")
        }
      } catch (error) {
        this.cleanupRecorder()
        this.setStatus("error", error.message || "Impossible de demarrer la dictée.")
      }
    }

    pauseListening() {
      if (this.state !== "recording") return
      this.voiceCommandInputLocked = false
      this.clearVoiceCommandSilenceTimer()
      if (this.isLiveProvider()) {
        this.liveSession?.pause()
      } else {
        this.recorder?.pause()
      }
      this.setStatus("paused", "Dictée en pause.")
    }

    resumeListening() {
      if (this.state !== "paused") return
      this.voiceCommandInputLocked = false
      if (this.isLiveProvider()) {
        this.liveSession?.resume()
      } else {
        this.recorder?.resume()
      }
      this.setStatus("recording", "Enregistrement repris.")
      this.resetVoiceCommandSilenceTimer()
    }

    async stopListening(options = {}) {
      if (this.stoppingListening) {
        return
      }
      this.stoppingListening = true
      try {
        return await this._stopListeningInternal(options)
      } finally {
        this.stoppingListening = false
      }
    }

    async _stopListeningInternal(options = {}) {
      const insert = options.insert !== false
      const autoRestartAiCommand = options.autoRestartAiCommand === true
      const recordedMs = this.recordingStartedAt ? Date.now() - this.recordingStartedAt : 0
      const selectedProvider = this.getSelectedProvider()
      const useLiveProvider = this.isLiveProvider()
      let liveUsage = null
      let liveProviderMeta = null

      this.clearVoiceCommandSilenceTimer()

      if (insert) {
        this.setStatus("transcribing", "Analyse de la dictée en cours...")
      }

      if (useLiveProvider) {
        this.stopLiveLoop()
      } else {
        this.stopPartialTranscriptionLoop()
        try {
          await this.flushPartialTranscription({ final: true })
        } catch (error) {
          this.state = "error"
          this.setStatus("error", error?.message ? String(error.message) : "Erreur de transcription audio.")
        }
      }

      const recorderRef = this.recorder
      const recordingResult = !useLiveProvider && recorderRef ? await recorderRef.stop() : null
      const blob = recordingResult?.blob || null
      const audioStats = recordingResult?.audioStats || recorderRef?.audioStats || { peak: 0, rms: 0, gain: 1 }
      const recorderContextState = recorderRef?.contextState || ""
      this.recordingStartedAt = 0

      if (!insert) {
        if (useLiveProvider) {
          try {
            await this.liveSession?.stop()
          } catch (_) {
            // On nettoie silencieusement dans ce cas.
          }
        }
        this.cleanupRecorder()
        this.state = "idle"
        this.transcriptBuffer = ""
        this.partialTranscript = ""
        this.selectionTranscriptBase = ""
        this.pendingVoiceCommandText = ""
        this.voiceCommandReady = false
        this.voiceCommandInputLocked = false
        this.setStatus("idle", "Dictée arrêtée.")
        return
      }

      if (useLiveProvider && this.liveCapturedChunkCount === 0) {
        this.cleanupRecorder()
        this.state = "error"
        this.setStatus("error", `Aucun chunk audio n'a ete capté dans cette zone pour ${this.getProviderLabel()}. Le micro est autorisé, mais la capture live ne produit pas de signal exploitable ici.`)
        return
      }

      if (!useLiveProvider && (!blob || !blob.size)) {
        this.state = "idle"
        this.setStatus("idle", "Aucun audio exploitable n'a ete enregistre.")
        return
      }

      if (recordedMs < MIN_RECORDING_MS) {
        this.state = "idle"
        this.setStatus("idle", "Enregistrement trop court. Parle un peu plus longtemps avant d'appuyer sur Stop dictée.")
        return
      }

      if (!useLiveProvider && audioStats.peak === 0 && audioStats.rms === 0) {
        const debugInfo = formatAudioDebugInfo({
          recordedMs,
          audioBytes: blob.size,
          mimeType: blob.type || "audio/wav",
          peak: audioStats.peak,
          rms: audioStats.rms,
          gain: audioStats.gain,
          trackLabel: this.trackDebug?.label || "",
          trackState: this.trackDebug?.readyState || "",
          trackEnabled: this.trackDebug?.enabled ?? null,
          trackMuted: this.trackDebug?.muted ?? null,
          contextState: recorderContextState
        })
        this.state = "error"
        this.setStatus("error", `Le navigateur a enregistre du silence. Diagnostic : ${debugInfo}`)
        return
      }

      if (useLiveProvider) {
        try {
          const hadLivePreview = Boolean(String(this.transcriptBuffer || "").trim())
          const liveResult = await this.liveSession?.stop()
          this.liveCapturedChunkCount = liveResult?.capturedChunkCount || 0
          this.liveSentChunkCount = liveResult?.sentChunkCount || 0
          this.trackDebug = liveResult?.trackDebug || this.trackDebug
          liveUsage = liveResult?.usage || null
          liveProviderMeta = liveResult?.provider || null
          this.liveFinalText = String(liveResult.finalText || "").trim()
          const finalTranscript = this.composeLiveTranscript(this.liveFinalText, "")
          this.transcriptBuffer = finalTranscript
          this.partialTranscript = finalTranscript
          this.endLiveRun()
          this.resetLiveState()
          if (!hadLivePreview && this.transcriptBuffer) {
            this.renderLiveTranscript(this.transcriptBuffer)
          }
        } catch (error) {
          this.cleanupRecorder()
          this.state = "error"
          this.setStatus("error", error?.message ? String(error.message) : "Erreur de dictée en direct.")
          return
        }
      } else {
        this.transcriptBuffer = this.partialTranscript.trim()
      }

      this.cleanupRecorder()

      if (!this.transcriptBuffer) {
        if (useLiveProvider) {
          this.state = "error"
          this.setStatus("error", `Aucun texte n'a ete renvoye par ${this.getProviderLabel()}. La dictée ne doit pas basculer sur le moteur local dans ce mode.`)
          return
        }
        try {
          const fallbackText = await this.requestWholeRecordingTranscription(blob)
          this.transcriptBuffer = String(fallbackText || "").trim()
          if (this.transcriptBuffer) {
            this.partialTranscript = this.transcriptBuffer
            this.renderLiveTranscript(this.transcriptBuffer)
          }
        } catch (error) {
          this.state = "error"
          this.setStatus("error", error?.message ? String(error.message) : "Erreur de transcription audio.")
          return
        }
      }

      if (!this.transcriptBuffer) {
        const debugInfo = formatAudioDebugInfo({
          recordedMs,
          audioBytes: blob.size,
          mimeType: blob.type || "audio/wav",
          peak: audioStats.peak,
          rms: audioStats.rms,
          gain: audioStats.gain,
          trackLabel: this.trackDebug?.label || "",
          trackState: this.trackDebug?.readyState || "",
          trackEnabled: this.trackDebug?.enabled ?? null,
          trackMuted: this.trackDebug?.muted ?? null,
          contextState: recorderContextState
        })
        this.state = "error"
        this.setStatus("error", `Aucun texte n'a pu etre reconnu pendant la dictée. Diagnostic : ${debugInfo}`)
        return
      }

      const currentMode = this.modeSelect?.value || "cursor"
      const preview = this.transcriptBuffer.length > 80 ? `${this.transcriptBuffer.slice(0, 80)}...` : this.transcriptBuffer
      const usageCost = useLiveProvider ? formatUsageCost(liveUsage) : ""
      const providerLabel = liveProviderMeta?.providerLabel || this.getProviderLabel()

      if (currentMode === "ai-command") {
        try {
          await this.applyVoiceEditCommand(this.transcriptBuffer)
          this.state = "idle"
          this.pendingVoiceCommandText = ""
          this.transcriptBuffer = ""
          this.partialTranscript = ""
          this.setStatus(
            "idle",
            autoRestartAiCommand
              ? `Commande IA appliquee${usageCost ? ` via ${providerLabel} (${usageCost})` : ""}. Reprise automatique de l'écoute...`
              : `Commande IA appliquee${usageCost ? ` via ${providerLabel} (${usageCost})` : ""}.`
          )
          this.scheduleRestoreAppliedCaret()
          if (autoRestartAiCommand) {
            window.setTimeout(() => {
              if (!this.enabled || !this.isEditable()) {
                return
              }
              this.startListening().catch((error) => {
                this.setStatus("error", error?.message ? String(error.message) : "Impossible de reprendre automatiquement la dictée.")
              })
            }, 250)
          }
        } catch (error) {
          const errorMessage = error?.message ? String(error.message) : "Erreur d'application de la commande IA."
          this.pendingVoiceCommandText = ""
          this.transcriptBuffer = ""
          this.partialTranscript = ""
          if (autoRestartAiCommand) {
            this.state = "idle"
            this.setStatus("idle", `${errorMessage} Reprise automatique de l'écoute...`)
            window.setTimeout(() => {
              if (!this.enabled || !this.isEditable()) {
                return
              }
              this.startListening().catch((restartError) => {
                this.setStatus("error", restartError?.message ? String(restartError.message) : "Impossible de reprendre automatiquement la dictée.")
              })
            }, 250)
          } else {
            this.state = "error"
            this.setStatus("error", errorMessage)
          }
        }
        return
      }

      this.state = "idle"
      this.setStatus("idle", `Transcription inseree${usageCost ? ` via ${providerLabel} (${usageCost})` : ""} : "${preview}"`)
    }

    cleanupRecorder() {
      this.stopPartialTranscriptionLoop()
      this.clearBackendRetry()
      this.clearVoiceCommandSilenceTimer()
      this.voiceCommandReady = false
      this.voiceCommandInputLocked = false
      this.voiceCommandAutoCycleInFlight = false
      this.stopLiveLoop()
      this.endLiveRun()
      this.resetLiveState()
      if (this.mediaStream) {
        this.mediaStream.getTracks().forEach((track) => track.stop())
      }
      this.mediaStream = null
      this.recorder = null
      this.liveRecorder = null
      this.liveSession = null
      this.runtimeProviderOverride = ""
    }

    insertTranscript(text, mode) {
      const normalizedText = String(text || "").trim()
      if (!normalizedText || !this.textElement) return false

      const beforeValue = this.textElement.value

      if (mode === "selection") {
        this.replaceSelection(normalizedText)
      } else if (mode === "append") {
        this.appendToEnd(normalizedText)
      } else {
        this.insertAtCursor(normalizedText)
      }

      if (this.textElement.value.includes(normalizedText)) return true

      const separator = beforeValue && !beforeValue.endsWith("\n") ? "\n" : ""
      this.textElement.value = `${beforeValue}${separator}${normalizedText}`
      const caret = this.textElement.value.length
      this.textElement.focus()
      this.textElement.setSelectionRange(caret, caret)
      this.lastSelectionStart = caret
      this.lastSelectionEnd = caret
      this.textElement.dispatchEvent(new Event("input", { bubbles: true }))
      return this.textElement.value.includes(normalizedText)
    }

    renderLiveTranscript(text, previousText = "") {
      if (!this.textElement) return false

      const normalizedText = String(text || "").trim()
      const currentMode = this.modeSelect?.value || "cursor"
      if (currentMode === "cursor") {
        const incrementalText = extractIncrementalTranscript(previousText, normalizedText)
        if (!incrementalText) {
          return false
        }
        this.insertAtCursor(incrementalText)
        return true
      }
      if (currentMode === "append") {
        const incrementalText = extractIncrementalTranscript(previousText, normalizedText)
        if (!incrementalText) {
          return false
        }
        this.appendToEnd(incrementalText)
        return true
      }
      if (currentMode === "ai-command") {
        if (normalizedText === this.pendingVoiceCommandText) {
          return false
        }
        this.pendingVoiceCommandText = normalizedText
        this.resetVoiceCommandSilenceTimer(normalizedText)
        return false
      }
      if (currentMode === "selection") {
        if (this.initialSelectionStart === this.initialSelectionEnd) {
          pushDictationTrace({
            type: "selection-mode-not-armed",
            targetId: this.textElement.id || "",
            mode: currentMode,
            initialSelectionStart: this.initialSelectionStart,
            initialSelectionEnd: this.initialSelectionEnd
          })
          return false
        }
        const replacementText = this.selectionTranscriptBase
          ? extractIncrementalTranscript(this.selectionTranscriptBase, normalizedText)
          : normalizedText
        if (!replacementText) {
          pushDictationTrace({
            type: "selection-replacement-waiting-new-text",
            targetId: this.textElement.id || "",
            mode: currentMode,
            initialSelectionStart: this.initialSelectionStart,
            initialSelectionEnd: this.initialSelectionEnd,
            transcriptBase: this.selectionTranscriptBase,
            transcriptCurrent: normalizedText
          })
          return false
        }
        const prefix = this.initialValueBeforeDictation.slice(0, this.initialSelectionStart)
        const suffix = this.initialValueBeforeDictation.slice(this.initialSelectionEnd)
        this.suppressSelectionTracking = true
        try {
          this.textElement.value = `${prefix}${replacementText}${suffix}`
          pushDictationTrace({
            type: "apply-selection-replacement",
            targetId: this.textElement.id || "",
            mode: currentMode,
            initialSelectionStart: this.initialSelectionStart,
            initialSelectionEnd: this.initialSelectionEnd,
            replacementText
          })
          this.textElement.dispatchEvent(new Event("input", { bubbles: true }))
        } finally {
          this.suppressSelectionTracking = false
        }
        return true
      }

      const prefix = this.initialValueBeforeDictation.slice(0, this.initialSelectionStart)
      const suffix = this.initialValueBeforeDictation.slice(this.initialSelectionEnd)
      const insertion = this.buildInsertion(prefix, normalizedText, suffix)

      this.textElement.value = insertion.value
      const caret = insertion.caret
      this.textElement.focus()
      this.textElement.setSelectionRange(caret, caret)
      this.lastSelectionStart = caret
      this.lastSelectionEnd = caret
      this.textElement.dispatchEvent(new Event("input", { bubbles: true }))
      return true
    }

    startPartialTranscriptionLoop() {
      this.stopPartialTranscriptionLoop()
      this.partialTimerId = window.setInterval(() => {
        this.flushPartialTranscription().catch((error) => {
          this.state = "error"
          this.setStatus("error", error?.message ? String(error.message) : "Erreur de transcription audio.")
        })
      }, PARTIAL_TRANSCRIPTION_INTERVAL_MS)
    }

    stopPartialTranscriptionLoop() {
      if (this.partialTimerId) {
        window.clearInterval(this.partialTimerId)
      }
      this.partialTimerId = null
    }

    async flushPartialTranscription(options = {}) {
      if (!this.recorder) return
      if (this.partialRequestPromise) {
        await this.partialRequestPromise
        return
      }

      const overlapSamples = Math.round((PARTIAL_TRANSCRIPTION_OVERLAP_MS / 1000) * this.recorder.sampleRate)
      const fromSample = Math.max(0, this.lastTranscribedSampleCount - overlapSamples)
      const snapshot = this.recorder.buildSnapshot({ fromSample })
      if (!snapshot || !snapshot.sampleCount) return

      const minDuration = options.final ? 300 : PARTIAL_TRANSCRIPTION_MIN_MS
      if (snapshot.durationMs < minDuration) return

      this.partialRequestPromise = this.requestChunkTranscription(snapshot, options)
      try {
        await this.partialRequestPromise
      } finally {
        this.partialRequestPromise = null
      }
    }

    async requestWholeRecordingTranscription(blob) {
      const audioBase64 = await blobToBase64(blob)
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS)

      try {
        const response = await fetch(TRANSCRIPTION_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            audioBase64,
            mimeType: blob.type || "audio/wav",
            language: this.options.lang || "fr",
            prompt: this.options.prompt || "",
            mode: "final"
          })
        })

        const result = await response.json()
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Erreur de transcription audio.")
        }

        return String(result.text || "").trim()
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error("La transcription finale a mis trop de temps a repondre (delai depasse apres 30 s).")
        }
        throw error
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    async requestChunkTranscription(snapshot, options = {}) {
      if (this.voiceCommandInputLocked && this.isAiCommandMode() && !options.final) {
        return
      }
      const audioBase64 = await blobToBase64(snapshot.blob)
      const controller = new AbortController()
      const timeoutId = window.setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS)

      try {
        const response = await fetch(TRANSCRIPTION_URL, {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          signal: controller.signal,
          body: JSON.stringify({
            audioBase64,
            mimeType: snapshot.blob.type || "audio/wav",
            language: this.options.lang || "fr",
            prompt: this.options.prompt || "",
            mode: options.final ? "final" : "partial"
          })
        })

        const result = await response.json()
        if (!response.ok || !result.ok) {
          throw new Error(result.error || "Erreur de transcription audio.")
        }

        const chunkText = String(result.text || "").trim()
        this.lastTranscribedSampleCount = snapshot.totalSamples

        if (!chunkText) {
          if (options.final && !this.partialTranscript) {
            const debugInfo = formatAudioDebugInfo({
              recordedMs: snapshot.durationMs,
              audioBytes: result.audioBytes || snapshot.blob.size,
              mimeType: result.mimeType || snapshot.blob.type || "audio/wav",
              peak: snapshot.audioStats.peak,
              rms: snapshot.audioStats.rms,
              gain: snapshot.audioStats.gain,
              trackLabel: this.trackDebug?.label || "",
              trackState: this.trackDebug?.readyState || "",
              trackEnabled: this.trackDebug?.enabled ?? null,
              trackMuted: this.trackDebug?.muted ?? null,
              contextState: this.recorder?.contextState || ""
            })
            const backendPreview = String(result.debugPreview || "").trim()
            const suffix = backendPreview ? ` | backend: ${backendPreview}` : ""
            throw new Error(`Transcription vide. Diagnostic : ${debugInfo}${suffix}`)
          }
          return
        }

        if (this.voiceCommandInputLocked && this.isAiCommandMode() && !options.final) {
          return
        }

        this.partialTranscript = mergeIncrementalTranscript(this.partialTranscript, chunkText)
        this.transcriptBuffer = this.partialTranscript
        this.renderLiveTranscript(this.partialTranscript)

        if (this.state === "recording") {
          const preview = this.partialTranscript.length > 80
            ? `${this.partialTranscript.slice(0, 80)}...`
            : this.partialTranscript
          this.setStatus("recording", `Dictée en direct : "${preview}"`)
        }
      } catch (error) {
        if (error?.name === "AbortError") {
          throw new Error("Le serveur de transcription a mis trop de temps a repondre (delai depasse apres 30 s).")
        }
        throw error
      } finally {
        window.clearTimeout(timeoutId)
      }
    }

    getActiveLanguage() {
      if (typeof this.options.getLanguage === "function") {
        return String(this.options.getLanguage() || this.options.lang || "fr").trim().toLowerCase() || "fr"
      }
      return String(this.options.lang || "fr").trim().toLowerCase() || "fr"
    }

    getActiveModel() {
      if (typeof this.options.getModel === "function") {
        return String(this.options.getModel() || "deepseek-chat").trim() || "deepseek-chat"
      }
      return String(this.options.model || "deepseek-chat").trim() || "deepseek-chat"
    }

    getCurrentSelectionSnapshot() {
      const start = this.textElement?.selectionStart ?? this.lastSelectionStart ?? this.textElement?.value.length ?? 0
      const end = this.textElement?.selectionEnd ?? this.lastSelectionEnd ?? start
      return {
        start,
        end,
        selectedText: this.textElement?.value?.slice(start, end) || ""
      }
    }

    findTargetInText(value, target) {
      const normalizedTarget = cleanupTargetCandidate(target)
      const candidates = Array.from(new Set([
        normalizedTarget,
        normalizedTarget.replace(/[.,;:!?]+$/g, "").trim(),
        normalizedTarget.replace(/\s+/g, " ").trim(),
        normalizedTarget.replace(/-/g, " ").trim(),
        normalizedTarget.replace(/\s+/g, "-").trim()
      ].filter(Boolean)))

      for (const candidate of candidates) {
        const direct = this.findTargetInTextByCandidate(value, candidate)
        if (direct.index !== -1) {
          return direct
        }
      }

      return { index: -1, length: 0, ambiguous: false }
    }

    findTargetInTextByCandidate(value, target) {
      const first = value.indexOf(target)
      if (first !== -1) {
        const second = value.indexOf(target, first + target.length)
        return { index: first, length: target.length, ambiguous: second !== -1 }
      }
      const valueLower = value.toLowerCase()
      const targetLower = target.toLowerCase()
      const firstCI = valueLower.indexOf(targetLower)
      if (firstCI !== -1) {
        const secondCI = valueLower.indexOf(targetLower, firstCI + targetLower.length)
        return { index: firstCI, length: targetLower.length, ambiguous: secondCI !== -1 }
      }
      if (/[-\s]/.test(target)) {
        try {
          const tokens = target.split(/[-\s]+/).filter(Boolean)
          if (tokens.length > 1) {
            const pattern = tokens.map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[-\\s]+")
            const rx = new RegExp(pattern, "i")
            const m = rx.exec(value)
            if (m) {
              const second = rx.exec(value.slice(m.index + m[0].length))
              return { index: m.index, length: m[0].length, ambiguous: second !== null }
            }
          }
        } catch (_) { /* ignore invalid regex */ }
      }
      return { index: -1, length: 0, ambiguous: false }
    }

    findTargetOccurrencesInText(value, target) {
      const normalizedTarget = String(target || "")
      if (!normalizedTarget) {
        return []
      }

      const exactMatches = []
      let cursor = value.indexOf(normalizedTarget)
      while (cursor !== -1) {
        exactMatches.push({ index: cursor, length: normalizedTarget.length })
        cursor = value.indexOf(normalizedTarget, cursor + Math.max(1, normalizedTarget.length))
      }
      if (exactMatches.length) {
        return exactMatches
      }

      const valueLower = value.toLowerCase()
      const targetLower = normalizedTarget.toLowerCase()
      const insensitiveMatches = []
      cursor = valueLower.indexOf(targetLower)
      while (cursor !== -1) {
        insensitiveMatches.push({ index: cursor, length: targetLower.length })
        cursor = valueLower.indexOf(targetLower, cursor + Math.max(1, targetLower.length))
      }
      return insensitiveMatches
    }

    resolveOccurrenceMatch(value, target, occurrenceIndex = 0, occurrenceMode = "") {
      const matches = this.findTargetOccurrencesInText(value, target)
      if (!matches.length) {
        throw new Error("Texte cible introuvable dans la zone courante.")
      }
      if (occurrenceMode === "last") {
        return matches[matches.length - 1]
      }
      if (occurrenceIndex > 0) {
        if (occurrenceIndex > matches.length) {
          throw new Error("Occurrence demandee introuvable dans la zone courante.")
        }
        return matches[occurrenceIndex - 1]
      }
      if (matches.length > 1) {
        throw new Error("Cible ambigue dans la zone courante.")
      }
      return matches[0]
    }

    transformExactText(target, transformer, emptyErrorMessage = "Transformation impossible.") {
      const value = String(this.textElement?.value || "")
      const normalizedTarget = String(target || "").trim()
      if (!normalizedTarget) {
        throw new Error("Texte cible manquant.")
      }
      const found = this.findTargetInText(value, normalizedTarget)
      if (found.index === -1) {
        throw new Error("Texte cible introuvable dans la zone courante.")
      }
      if (found.ambiguous) {
        throw new Error("Cible ambigue dans la zone courante.")
      }
      const current = value.slice(found.index, found.index + found.length)
      const replacement = String(transformer(current) || "")
      if (!replacement) {
        throw new Error(emptyErrorMessage)
      }
      this.replaceExactRange(found.index, found.index + found.length, replacement)
    }

    replaceExactRange(start, end, replacement) {
      const value = String(this.textElement?.value || "")
      const prefix = value.slice(0, start)
      const suffix = value.slice(end)
      const nextValue = `${prefix}${replacement}${suffix}`
      const caret = prefix.length + String(replacement || "").length
      this.textElement.value = nextValue
      this.textElement.focus()
      this.textElement.setSelectionRange(caret, caret)
      this.rememberAppliedCaret(caret, caret)
      this.lastSelectionStart = caret
      this.lastSelectionEnd = caret
      this.textElement.dispatchEvent(new Event("input", { bubbles: true }))
    }

    replaceExactText(target, replacement) {
      const value = String(this.textElement?.value || "")
      const normalizedTarget = String(target || "")
      const normalizedReplacement = String(replacement || "").trim()
      if (!normalizedTarget || !normalizedReplacement) {
        throw new Error("Cible ou remplacement manquant.")
      }
      const found = this.findTargetInText(value, normalizedTarget)
      if (found.index === -1) {
        throw new Error("Texte cible introuvable dans la zone courante.")
      }
      if (found.ambiguous) {
        throw new Error("Cible ambigue dans la zone courante.")
      }
      this.replaceExactRange(found.index, found.index + found.length, normalizedReplacement)
    }

    replaceNthOccurrence(target, replacement, occurrenceIndex = 0, occurrenceMode = "") {
      const value = String(this.textElement?.value || "")
      const normalizedTarget = String(target || "")
      const normalizedReplacement = String(replacement || "").trim()
      if (!normalizedTarget || !normalizedReplacement) {
        throw new Error("Cible ou remplacement manquant.")
      }
      const found = this.resolveOccurrenceMatch(value, normalizedTarget, occurrenceIndex, occurrenceMode)
      this.replaceExactRange(found.index, found.index + found.length, normalizedReplacement)
    }

    deleteExactText(target) {
      const value = String(this.textElement?.value || "")
      const normalizedTarget = String(target || "").trim()
      if (!normalizedTarget) {
        throw new Error("Texte cible a supprimer manquant.")
      }
      const found = this.findTargetInText(value, normalizedTarget)
      if (found.index === -1) {
        throw new Error("Texte cible introuvable dans la zone courante.")
      }
      if (found.ambiguous) {
        throw new Error("Cible ambigue dans la zone courante.")
      }
      this.replaceExactRange(found.index, found.index + found.length, "")
    }

    deleteNthOccurrence(target, occurrenceIndex = 0, occurrenceMode = "") {
      const value = String(this.textElement?.value || "")
      const normalizedTarget = String(target || "").trim()
      if (!normalizedTarget) {
        throw new Error("Texte cible a supprimer manquant.")
      }
      const found = this.resolveOccurrenceMatch(value, normalizedTarget, occurrenceIndex, occurrenceMode)
      this.replaceExactRange(found.index, found.index + found.length, "")
    }

    insertAroundTarget(target, text, position = "before") {
      const value = String(this.textElement?.value || "")
      const normalizedTarget = String(target || "")
      const normalizedText = String(text || "").trim()
      if (!normalizedTarget || !normalizedText) {
        throw new Error("Cible ou texte d'insertion manquant.")
      }
      const found = this.findTargetInText(value, normalizedTarget)
      if (found.index === -1) {
        throw new Error("Texte cible introuvable dans la zone courante.")
      }
      const { index: firstIndex, length: targetLength, ambiguous } = found
      const secondIndex = ambiguous ? firstIndex + 1 : -1
      if (secondIndex !== -1) {
        throw new Error("Cible ambigue dans la zone courante.")
      }
      if (position === "before") {
        this.lastSelectionStart = firstIndex
        this.lastSelectionEnd = firstIndex
        this.insertAtCursor(normalizedText)
        return
      }
      const insertIndex = firstIndex + targetLength
      this.lastSelectionStart = insertIndex
      this.lastSelectionEnd = insertIndex
      this.insertAtCursor(normalizedText)
    }

    insertLineBreak() {
      if (!this.textElement) {
        return
      }
      const start = this.lastSelectionStart ?? this.textElement.selectionStart ?? this.textElement.value.length
      const end = this.lastSelectionEnd ?? this.textElement.selectionEnd ?? start
      const prefix = this.textElement.value.slice(0, start)
      const suffix = this.textElement.value.slice(end)
      this.textElement.value = `${prefix}\n${suffix}`
      const caret = start + 1
      this.textElement.focus()
      this.textElement.setSelectionRange(caret, caret)
      this.rememberAppliedCaret(caret, caret)
      this.lastSelectionStart = caret
      this.lastSelectionEnd = caret
      this.textElement.dispatchEvent(new Event("input", { bubbles: true }))
    }

    insertLineBreakAroundTarget(target, position = "before", count = 1) {
      const value = String(this.textElement?.value || "")
      const normalizedTarget = String(target || "").trim()
      if (!normalizedTarget) {
        throw new Error("Texte cible manquant pour le retour à la ligne.")
      }
      const found = this.findTargetInText(value, normalizedTarget)
      if (found.index === -1) {
        throw new Error("Texte cible introuvable dans la zone courante.")
      }
      if (found.ambiguous) {
        throw new Error("Cible ambigue dans la zone courante.")
      }
      const breaks = "\n".repeat(Math.max(1, count))
      const insertIndex = position === "after" ? found.index + found.length : found.index
      this.lastSelectionStart = insertIndex
      this.lastSelectionEnd = insertIndex
      this.insertAtCursor(breaks)
    }

    insertAtStart(text) {
      if (!this.textElement) {
        return
      }
      this.lastSelectionStart = 0
      this.lastSelectionEnd = 0
      this.insertAtCursor(text)
    }

    moveCaret(target = "", position = "before") {
      if (!this.textElement) {
        return
      }

      const value = String(this.textElement.value || "")
      let caret = 0

      if (position === "start") {
        caret = 0
      } else if (position === "end") {
        caret = value.length
      } else {
        const normalizedTarget = String(target || "").trim()
        if (!normalizedTarget) {
          throw new Error("Cible du curseur manquante.")
        }
        const found = this.findTargetInText(value, normalizedTarget)
        if (found.index === -1) {
          throw new Error("Texte cible introuvable pour déplacer le curseur.")
        }
        if (found.ambiguous) {
          throw new Error("Cible ambigue pour déplacer le curseur.")
        }
        caret = position === "after"
          ? found.index + found.length
          : found.index
      }

      this.textElement.focus()
      this.textElement.setSelectionRange(caret, caret)
      this.rememberAppliedCaret(caret, caret)
      this.lastSelectionStart = caret
      this.lastSelectionEnd = caret
    }

    async applyVoiceEditCommand(commandText) {
      const normalizedCommand = String(commandText || "").trim()
      if (!normalizedCommand || !this.textElement) {
        throw new Error("Commande vocale vide.")
      }
      const selection = this.getCurrentSelectionSnapshot()
      const command = await requestVoiceEditCommand({
        command: normalizedCommand,
        currentText: this.textElement.value || "",
        selectedText: selection.selectedText,
        selectionStart: selection.start,
        selectionEnd: selection.end,
        targetId: this.textElement.id || "",
        language: this.getActiveLanguage()
      }, {
        model: this.getActiveModel(),
        language: this.getActiveLanguage()
      })

      const action = String(command.action || "none").trim()
      const target = String(command.target || "").trim()
      const text = String(command.text || "").trim()
      const cursorPosition = String(command.cursorPosition || "").trim()
      const occurrenceIndex = Number.isFinite(Number(command.occurrenceIndex)) ? Number(command.occurrenceIndex) : 0
      const occurrenceMode = String(command.occurrenceMode || "").trim()
      const shouldApply = Boolean(command.shouldApply)
      if (!shouldApply || action === "none") {
        throw new Error(command.reason || "Commande trop ambigue pour etre appliquee automatiquement.")
      }

      if (action === "replace_selection") {
        this.lastSelectionStart = selection.start
        this.lastSelectionEnd = selection.end
        this.replaceSelection(text)
      } else if (action === "replace_text") {
        this.replaceExactText(target, text)
      } else if (action === "replace_nth_occurrence") {
        this.replaceNthOccurrence(target, text, occurrenceIndex, occurrenceMode)
      } else if (action === "delete_text") {
        this.deleteExactText(target)
      } else if (action === "delete_nth_occurrence") {
        this.deleteNthOccurrence(target, occurrenceIndex, occurrenceMode)
      } else if (action === "insert_before") {
        this.insertAroundTarget(target, text, "before")
      } else if (action === "insert_after") {
        this.insertAroundTarget(target, text, "after")
      } else if (action === "uppercase_target") {
        this.transformExactText(target, (current) => current.toUpperCase(), "Transformation en majuscules impossible.")
      } else if (action === "lowercase_target") {
        this.transformExactText(target, (current) => current.toLowerCase(), "Transformation en minuscules impossible.")
      } else if (action === "capitalize_target") {
        this.transformExactText(target, (current) => current ? current.charAt(0).toUpperCase() + current.slice(1) : "", "Mise en majuscule initiale impossible.")
      } else if (action === "insert_line_break_before_target") {
        this.insertLineBreakAroundTarget(target, "before", 1)
      } else if (action === "insert_line_break_after_target") {
        this.insertLineBreakAroundTarget(target, "after", 1)
      } else if (action === "insert_paragraph_before_target") {
        this.insertLineBreakAroundTarget(target, "before", 2)
      } else if (action === "insert_at_start") {
        this.insertAtStart(text)
      } else if (action === "move_caret") {
        this.moveCaret(target, cursorPosition || "before")
      } else if (action === "insert_line_break") {
        this.insertLineBreak()
      } else if (action === "append_end") {
        this.appendToEnd(text)
      } else if (action === "delete_selection") {
        if (!selection.selectedText) {
          throw new Error("Aucune selection active a supprimer.")
        }
        this.lastSelectionStart = selection.start
        this.lastSelectionEnd = selection.end
        this.replaceSelection("")
      } else {
        throw new Error(command.reason || "Action IA non supportee.")
      }

      pushDictationTrace({
        type: "voice-edit-command-applied",
        targetId: this.textElement.id || "",
        mode: "ai-command",
        commandText: normalizedCommand,
        action,
        actionTarget: target,
        actionText: text,
        cursorPosition,
        occurrenceIndex,
        occurrenceMode
      })

      this.rebaseCurrentActionFromVisibleText()
      this.scheduleRestoreAppliedCaret()
    }

    replaceSelection(text) {
      const start = this.lastSelectionStart ?? this.textElement.selectionStart ?? this.textElement.value.length
      const end = this.lastSelectionEnd ?? this.textElement.selectionEnd ?? this.textElement.value.length
      if (start === end) return this.insertAtCursor(text)

      const prefix = this.textElement.value.slice(0, start)
      const suffix = this.textElement.value.slice(end)
      const insertion = this.buildInsertion(prefix, text, suffix)
      this.textElement.value = insertion.value
      const caret = insertion.caret
      this.textElement.focus()
      this.textElement.setSelectionRange(caret, caret)
      this.rememberAppliedCaret(caret, caret)
      this.lastSelectionStart = caret
      this.lastSelectionEnd = caret
      this.textElement.dispatchEvent(new Event("input", { bubbles: true }))
    }

    insertAtCursor(text) {
      const start = this.lastSelectionStart ?? this.textElement.selectionStart ?? this.textElement.value.length
      const end = this.lastSelectionEnd ?? this.textElement.selectionEnd ?? start
      const prefix = this.textElement.value.slice(0, start)
      const suffix = this.textElement.value.slice(end)
      const insertion = this.buildInsertion(prefix, text, suffix)
      this.textElement.value = insertion.value
      const caret = insertion.caret
      this.textElement.focus()
      this.textElement.setSelectionRange(caret, caret)
      this.rememberAppliedCaret(caret, caret)
      this.lastSelectionStart = caret
      this.lastSelectionEnd = caret
      this.textElement.dispatchEvent(new Event("input", { bubbles: true }))
    }

    appendToEnd(text) {
      const currentValue = this.textElement.value
      const isFirstAppend = currentValue === this.initialValueBeforeDictation
      const prefix = isFirstAppend && currentValue && !currentValue.endsWith("\n")
        ? currentValue + "\n"
        : currentValue
      const insertion = this.buildInsertion(prefix, text, "")
      this.textElement.value = insertion.value
      const caret = insertion.value.length
      this.textElement.focus()
      this.textElement.setSelectionRange(caret, caret)
      this.rememberAppliedCaret(caret, caret)
      this.lastSelectionStart = caret
      this.lastSelectionEnd = caret
      this.textElement.dispatchEvent(new Event("input", { bubbles: true }))
    }

    buildInsertion(prefix, text, suffix) {
      const startsWithClosingPunctuation = /^[,.;:!?]/.test(text)
      const containsLineBreak = /[\r\n]/.test(text)
      const needsLeadingSpace = prefix && !/\s$/.test(prefix) && !startsWithClosingPunctuation && !containsLineBreak
      const needsTrailingSpace = suffix && !/^\s/.test(suffix) && !containsLineBreak
      const insertionText = `${needsLeadingSpace ? " " : ""}${text}${needsTrailingSpace ? " " : ""}`
      return {
        value: `${prefix}${insertionText}${suffix}`,
        caret: prefix.length + insertionText.length
      }
    }

    setStatus(state, message) {
      pushDictationTrace({
        type: "status-change",
        targetId: this.textElement?.id || "",
        state,
        message
      })
      this.state = state
      this.lastStatusMessage = message
      if (this.statusElement) {
        this.statusElement.textContent = message
        this.statusElement.title = message
        this.statusElement.dataset.fullMessage = message
      }
      this.render()
    }

    render() {
      const disabled = !this.isAvailable()
      this.controlsElement.classList.toggle("audio-input-disabled", disabled)
      this.controlsElement.classList.toggle("audio-input-ready", this.state === "idle" && !disabled)
      this.controlsElement.classList.toggle("audio-input-listening", this.state === "recording")
      this.controlsElement.classList.toggle("audio-input-processing", this.state === "transcribing")
      this.controlsElement.classList.toggle("audio-input-error-state", this.state === "error")
      this.controlsElement.classList.toggle("audio-input-command-ready", this.state === "recording" && this.voiceCommandReady)

      if (this.startButton) this.startButton.disabled = disabled || this.state === "recording" || this.state === "paused" || this.state === "transcribing"
      if (this.pauseButton) this.pauseButton.disabled = disabled || this.state !== "recording"
      if (this.resumeButton) this.resumeButton.disabled = disabled || this.state !== "paused"
      if (this.stopButton) this.stopButton.disabled = disabled || (this.state !== "recording" && this.state !== "paused")
      if (this.modeSelect) this.modeSelect.disabled = disabled || this.state === "transcribing"

      if (!this.statusElement) return
      if (this.state === "idle") {
        if (!this.enabled) {
          this.statusElement.textContent = "Saisie audio desactivee dans les parametres."
        } else if (!this.supported) {
          this.statusElement.textContent = "Saisie audio non supportee par ce navigateur."
        } else if (!this.isEditable()) {
          this.statusElement.textContent = "Zone non modifiable."
        } else if (!this.isAvailable()) {
          this.statusElement.textContent = this.getCurrentProviderReadiness().reason || "Service de transcription indisponible."
        } else if (this.lastStatusMessage) {
          this.statusElement.textContent = this.lastStatusMessage
        } else {
          this.statusElement.textContent = "Dictée inactive."
        }
        this.statusElement.title = this.statusElement.textContent
        this.statusElement.dataset.fullMessage = this.statusElement.textContent
      }
    }
  }

  function createAudioInput(textareaId, options = {}) {
    const textElement = document.getElementById(textareaId)
    const controlsElement = document.querySelector(`[data-audio-input-for="${textareaId}"]`)
    if (!textElement || !controlsElement) return null
    const existing = audioInputControllerRegistry.get(textareaId)
    if (existing && existing.textElement === textElement && existing.controlsElement === controlsElement) {
      return existing
    }
    if (existing && typeof existing.cleanupRecorder === "function") {
      try {
        existing.cleanupRecorder()
      } catch (_) {
        // no-op
      }
    }
    if (controlsElement.dataset.audioInputBound === "true") {
      return existing || null
    }
    controlsElement.dataset.audioInputBound = "true"
    const controller = new AudioInputController(textElement, controlsElement, options)
    audioInputControllerRegistry.set(textareaId, controller)
    return controller
  }

  window.MailAudioInput = {
    create(textareaId, options) {
      return createAudioInput(textareaId, options)
    }
  }
})()
