(() => {
  const PROVIDER_URLS = {
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
  const FLUSH_MS = 350
  const POLL_MS = 400

  function concatUint8Arrays(chunksList) {
    const totalLength = chunksList.reduce((sum, chunk) => sum + chunk.length, 0)
    const merged = new Uint8Array(totalLength)
    let offset = 0
    for (const chunk of chunksList) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    return merged
  }

  function floatTo16BitPCM(float32Array) {
    const bytes = new Uint8Array(float32Array.length * 2)
    const view = new DataView(bytes.buffer)
    for (let index = 0; index < float32Array.length; index += 1) {
      const sample = Math.max(-1, Math.min(1, float32Array[index]))
      view.setInt16(index * 2, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
    }
    return bytes
  }

  function resampleFloat32(float32Array, inputRate, targetRate = 16000) {
    if (inputRate === targetRate) {
      return float32Array
    }

    const targetLength = Math.max(1, Math.round(float32Array.length * targetRate / inputRate))
    const output = new Float32Array(targetLength)
    for (let index = 0; index < targetLength; index += 1) {
      const sourceIndex = Math.min(float32Array.length - 1, Math.round(index * inputRate / targetRate))
      output[index] = float32Array[sourceIndex]
    }
    return output
  }

  async function blobToBase64(blob) {
    const buffer = await blob.arrayBuffer()
    let binary = ""
    const bytes = new Uint8Array(buffer)
    const chunkSize = 0x8000

    for (let index = 0; index < bytes.length; index += chunkSize) {
      binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize))
    }

    return btoa(binary)
  }

  function pushLiveTrace(entry) {
    const type = String(entry?.type || "")
    if (type === "freeze-capture:start" || type === "freeze-capture:done") {
      console.info("[voice-freeze]", entry)
    }
  }

  function mergeIncrementalTranscript(previousText, chunkText) {
    const previous = String(previousText || "").trim()
    const incoming = String(chunkText || "").trim()

    if (!incoming) return previous
    if (!previous) return incoming
    if (incoming === previous) return previous
    if (incoming.startsWith(previous)) {
      return incoming
    }

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

  class LiveRecorder {
    constructor(stream, onChunk) {
      this.stream = stream
      this.onChunk = onChunk
      this.audioContext = null
      this.source = null
      this.processor = null
      this.started = false
      this.paused = false
      this.trackDebug = null
    }

    async start() {
      const [track] = this.stream.getAudioTracks()
      this.trackDebug = track ? {
        label: track.label || "micro inconnu",
        readyState: track.readyState || "unknown",
        enabled: Boolean(track.enabled),
        muted: Boolean(track.muted)
      } : null

      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContextCtor()
      await this.audioContext.resume()
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (event) => {
        if (!this.started || this.paused) {
          return
        }

        const input = event.inputBuffer.getChannelData(0)
        const floatCopy = new Float32Array(input)
        const resampled = resampleFloat32(floatCopy, this.audioContext.sampleRate, 16000)
        const pcm = floatTo16BitPCM(resampled)
        this.onChunk?.(pcm)
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
      if (this.processor) this.processor.disconnect()
      if (this.source) this.source.disconnect()
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

  class LiveSpeechSession {
    constructor({ provider, language = "fr", deviceId = "", onUpdate = null, onStatus = null, onSessionReset = null, onFatalError = null } = {}) {
      this.provider = provider
      this.language = language
      this.deviceId = deviceId
      this.onUpdate = onUpdate
      this.onStatus = onStatus
      this.onSessionReset = onSessionReset
      this.onFatalError = onFatalError
      this.mediaStream = null
      this.recorder = null
      this.sessionId = ""
      this.cursor = 0
      this.queuedBytes = []
      this.partials = []
      this.finalText = ""
      this.latestPartialText = ""
      this.flushTimer = null
      this.pollTimer = null
      this.startedAt = 0
      this.runId = 0
      this.stopping = false
      this.capturedChunkCount = 0
      this.sentChunkCount = 0
      this.trackDebug = null
      this.consecutiveConflicts = 0
      this.maxConsecutiveConflictsBeforeFatal = 2
    }

    emitStatus(message) {
      pushLiveTrace({
        type: "status",
        provider: this.provider,
        sessionId: this.sessionId,
        message
      })
      if (this.stopping) {
        return
      }
      this.onStatus?.(message)
    }

    emitUpdate() {
      if (this.stopping) {
        return
      }
      this.onUpdate?.({
        finalText: this.finalText,
        latestPartialText: this.latestPartialText,
        partials: this.partials.slice(),
        startedAt: this.startedAt,
        capturedChunkCount: this.capturedChunkCount,
        sentChunkCount: this.sentChunkCount,
        trackDebug: this.trackDebug
      })
    }

    resetTranscriptCapture() {
      this.partials = []
      this.finalText = ""
      this.latestPartialText = ""
      pushLiveTrace({
        type: "reset-transcript-capture",
        provider: this.provider,
        sessionId: this.sessionId
      })
      this.emitUpdate()
    }

    async failSession(message) {
      const errorMessage = message || `Session ${this.provider} interrompue.`
      pushLiveTrace({
        type: "fatal-error",
        provider: this.provider,
        sessionId: this.sessionId,
        message: errorMessage
      })

      this.stopping = true
      this.runId += 1

      if (this.flushTimer) window.clearInterval(this.flushTimer)
      if (this.pollTimer) window.clearInterval(this.pollTimer)
      this.flushTimer = null
      this.pollTimer = null

      try {
        if (this.recorder) {
          await this.recorder.stop()
        }
      } catch (_) {
        // no-op
      }
      this.recorder = null

      try {
        this.mediaStream?.getTracks()?.forEach((track) => track.stop())
      } catch (_) {
        // no-op
      }
      this.mediaStream = null

      this.sessionId = ""
      this.queuedBytes = []
      this.onFatalError?.(errorMessage)
    }

    async reopenBackendSession() {
      const urls = PROVIDER_URLS[this.provider]
      const sessionResponse = await fetch(urls.start, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: this.language })
      })
      const sessionPayload = await sessionResponse.json()
      if (!sessionResponse.ok || !sessionPayload.ok) {
        pushLiveTrace({
          type: "reopen-failed",
          provider: this.provider,
          sessionId: this.sessionId,
          status: sessionResponse.status
        })
        throw new Error(sessionPayload.error || `Impossible de redémarrer ${this.provider}.`)
      }

      this.partials = []
      this.finalText = ""
      this.latestPartialText = ""
      const previousSessionId = this.sessionId
      this.sessionId = sessionPayload.sessionId
      this.cursor = 0
      this.consecutiveConflicts = 0
      pushLiveTrace({
        type: "reopen-success",
        provider: this.provider,
        previousSessionId,
        sessionId: this.sessionId
      })
      this.onSessionReset?.()
      this.emitStatus(`Session ${this.provider} relancée.`)
    }

    async start() {
      const urls = PROVIDER_URLS[this.provider]
      if (!urls) {
        throw new Error(`Provider live non supporte : ${this.provider}`)
      }

      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: this.deviceId ? { deviceId: { exact: this.deviceId } } : true
      })

      const sessionResponse = await fetch(urls.start, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: this.language })
      })
      const sessionPayload = await sessionResponse.json()
      if (!sessionResponse.ok || !sessionPayload.ok) {
        throw new Error(sessionPayload.error || `Impossible de démarrer ${this.provider}.`)
      }

      this.sessionId = sessionPayload.sessionId
      this.cursor = 0
      this.queuedBytes = []
      this.partials = []
      this.finalText = ""
      this.latestPartialText = ""
      this.capturedChunkCount = 0
      this.sentChunkCount = 0
      this.runId += 1
      this.consecutiveConflicts = 0
      pushLiveTrace({
        type: "start-success",
        provider: this.provider,
        sessionId: this.sessionId,
        runId: this.runId
      })

      this.recorder = new LiveRecorder(this.mediaStream, (pcmBytes) => {
        this.capturedChunkCount += 1
        this.queuedBytes.push(pcmBytes)
      })
      await this.recorder.start()
      this.trackDebug = this.recorder.trackDebug
      this.startedAt = Date.now()

      this.flushTimer = window.setInterval(() => {
        this.flush().catch((error) => this.emitStatus(error.message || "Erreur d'envoi audio."))
      }, FLUSH_MS)
      this.pollTimer = window.setInterval(() => {
        this.poll().catch((error) => this.emitStatus(error.message || "Erreur de lecture des partiels."))
      }, POLL_MS)

      return {
        sessionId: this.sessionId,
        trackDebug: this.trackDebug
      }
    }

    async flush() {
      if (!this.sessionId || !this.queuedBytes.length) {
        return
      }

      const urls = PROVIDER_URLS[this.provider]
      const merged = concatUint8Arrays(this.queuedBytes)
      this.queuedBytes = []
      const blob = new Blob([merged], { type: "application/octet-stream" })
      const audioBase64 = await blobToBase64(blob)
      this.sentChunkCount += 1

      const response = await fetch(urls.chunk, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: this.sessionId,
          audioBase64
        })
      })
      if (response.ok) {
        return
      }

      let payload = {}
      try {
        payload = await response.json()
      } catch (_) {
        payload = {}
      }

      if (response.status === 409 && !this.stopping) {
        this.consecutiveConflicts += 1
        pushLiveTrace({
          type: "chunk-conflict",
          provider: this.provider,
          sessionId: this.sessionId,
          runId: this.runId,
          consecutiveConflicts: this.consecutiveConflicts
        })
        if (this.consecutiveConflicts > this.maxConsecutiveConflictsBeforeFatal) {
          await this.failSession(`Session ${this.provider} tombée à plusieurs reprises. Recliquez sur Dicter.`)
          return
        }
        await this.reopenBackendSession()
        const retryResponse = await fetch(urls.chunk, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: this.sessionId,
            audioBase64
          })
        })
        if (retryResponse.ok) {
          pushLiveTrace({
            type: "chunk-retry-success",
            provider: this.provider,
            sessionId: this.sessionId,
            runId: this.runId
          })
          return
        }
        let retryPayload = {}
        try {
          retryPayload = await retryResponse.json()
        } catch (_) {
          retryPayload = {}
        }
        throw new Error(retryPayload.error || payload.error || `Impossible d'envoyer l'audio ${this.provider}.`)
      }

      throw new Error(payload.error || `Impossible d'envoyer l'audio ${this.provider}.`)
    }

    async poll() {
      if (!this.sessionId) {
        return
      }

      const urls = PROVIDER_URLS[this.provider]
      const currentRunId = this.runId
      const response = await fetch(`${urls.events}?sessionId=${encodeURIComponent(this.sessionId)}&since=${this.cursor}`)
      if (currentRunId !== this.runId) {
        return
      }
      const payload = await response.json()
      if (!response.ok || !payload.ok) {
        pushLiveTrace({
          type: "poll-failed",
          provider: this.provider,
          sessionId: this.sessionId,
          status: response.status
        })
        return
      }

      this.cursor = payload.cursor || this.cursor
      const events = Array.isArray(payload.events) ? payload.events : []
      if (events.length) {
        this.consecutiveConflicts = 0
      }
      for (const event of events) {
        const text = String(event.text || "").trim()
        if (!text) {
          continue
        }
        const last = this.partials[this.partials.length - 1]
        if (last && last.text === text && last.isFinal === Boolean(event.isFinal)) {
          continue
        }
        this.partials.push({
          text,
          isFinal: Boolean(event.isFinal),
          elapsed_s: Math.round((event.receivedAt - this.startedAt) / 10) / 100
        })
      }
      for (const event of events) {
        const text = String(event.text || "").trim()
        if (!text) {
          continue
        }
        if (event.isFinal) {
          this.finalText = mergeIncrementalTranscript(this.finalText, text)
          this.latestPartialText = ""
        } else {
          this.latestPartialText = text
        }
      }
      this.emitUpdate()
    }

    pause() {
      this.recorder?.pause()
    }

    resume() {
      this.recorder?.resume()
    }

    async freezeCapture() {
      pushLiveTrace({
        type: "freeze-capture:start",
        provider: this.provider,
        sessionId: this.sessionId,
        hasRecorder: Boolean(this.recorder),
        hasMediaStream: Boolean(this.mediaStream),
        tracks: Array.from(this.mediaStream?.getTracks?.() || []).map((track) => ({
          kind: track.kind,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted
        }))
      })
      if (this.recorder) {
        await this.recorder.stop()
      }
      this.recorder = null

      this.mediaStream?.getTracks()?.forEach((track) => track.stop())
      this.mediaStream = null

      if (this.flushTimer) window.clearInterval(this.flushTimer)
      if (this.pollTimer) window.clearInterval(this.pollTimer)
      this.flushTimer = null
      this.pollTimer = null

      pushLiveTrace({
        type: "freeze-capture:done",
        provider: this.provider,
        sessionId: this.sessionId,
        hasRecorder: Boolean(this.recorder),
        hasMediaStream: Boolean(this.mediaStream)
      })
    }

    async stop() {
      const urls = PROVIDER_URLS[this.provider]
      const finalSessionId = this.sessionId
      pushLiveTrace({
        type: "stop-start",
        provider: this.provider,
        sessionId: finalSessionId,
        runId: this.runId
      })
      this.stopping = true
      this.runId += 1

      if (this.flushTimer) window.clearInterval(this.flushTimer)
      if (this.pollTimer) window.clearInterval(this.pollTimer)
      this.flushTimer = null
      this.pollTimer = null

      if (this.recorder) {
        await this.recorder.stop()
      }
      this.recorder = null

      // Stop the real microphone immediately so the browser does not keep
      // showing an active capture while we finish the network-side shutdown.
      this.mediaStream?.getTracks()?.forEach((track) => track.stop())
      this.mediaStream = null

      await this.flush()
      await this.poll()

      let payload = {
        finalText: this.finalText,
        events: []
      }

      if (finalSessionId) {
        const response = await fetch(urls.stop, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: finalSessionId })
        })
        payload = await response.json()
        if (!response.ok || !payload.ok) {
          throw new Error(payload.error || `Impossible d'arrêter ${this.provider}.`)
        }
      }

      this.sessionId = ""
      this.queuedBytes = []
      pushLiveTrace({
        type: "stop-success",
        provider: this.provider,
        sessionId: finalSessionId
      })

      return {
        finalText: String(payload.finalText || this.finalText || "").trim(),
        latestPartialText: this.latestPartialText,
        partials: this.partials.slice(),
        capturedChunkCount: this.capturedChunkCount,
        sentChunkCount: this.sentChunkCount,
        trackDebug: this.trackDebug,
        provider: payload.provider || null,
        usage: payload.usage || null
      }
    }
  }

  window.MailLiveSpeech = {
    createSession(options) {
      return new LiveSpeechSession(options)
    }
  }
})()
