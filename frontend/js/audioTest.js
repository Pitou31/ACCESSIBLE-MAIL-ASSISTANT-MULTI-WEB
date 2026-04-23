(() => {
  const START_BUTTON = document.getElementById("fwStartBtn")
  const STOP_BUTTON = document.getElementById("fwStopBtn")
  const STATUS = document.getElementById("fwStatus")
  const PROVIDER_SELECT = document.getElementById("fwProvider")
  const DEVICE_SELECT = document.getElementById("fwTestDevice")
  const LANGUAGE_SELECT = document.getElementById("fwTestLanguage")
  const FINAL_TEXT = document.getElementById("fwFinalText")
  const PARTIALS = document.getElementById("fwPartials")
  const METRICS = document.getElementById("fwMetrics")
  const STATUS_URL = "/api/audio/transcription/status"
  const PROVIDER_URLS = {
    "faster-whisper": "/api/audio/faster-whisper-probe",
    deepgram: "/api/audio/deepgram-probe"
  }
  const DEEPGRAM_LIVE_URLS = {
    start: "/api/audio/deepgram-live/start",
    chunk: "/api/audio/deepgram-live/chunk",
    events: "/api/audio/deepgram-live/events",
    stop: "/api/audio/deepgram-live/stop"
  }
  const ASSEMBLYAI_LIVE_URLS = {
    start: "/api/audio/assemblyai-live/start",
    chunk: "/api/audio/assemblyai-live/chunk",
    events: "/api/audio/assemblyai-live/events",
    stop: "/api/audio/assemblyai-live/stop"
  }
  const DEEPGRAM_LIVE_FLUSH_MS = 350
  const DEEPGRAM_LIVE_POLL_MS = 400

  let mediaStream = null
  let recorder = null
  let chunks = []
  let startedAt = 0
  let liveRecorder = null
  let deepgramSessionId = ""
  let deepgramFlushTimer = null
  let deepgramPollTimer = null
  let deepgramCursor = 0
  let deepgramQueuedBytes = []
  let deepgramPartials = []
  let assemblyAiSessionId = ""
  let assemblyAiFlushTimer = null
  let assemblyAiPollTimer = null
  let assemblyAiCursor = 0
  let assemblyAiQueuedBytes = []
  let assemblyAiPartials = []
  let liveRunId = 0
  let activeLiveProvider = ""

  function setStatus(message) {
    if (STATUS) {
      STATUS.textContent = message
    }
  }

  function formatJson(data) {
    return JSON.stringify(data, null, 2)
  }

  function appendUniqueEvents(target, source, startedAtValue) {
    for (const event of source) {
      const normalizedText = String(event.text || "").trim()
      if (!normalizedText) {
        continue
      }

      const nextItem = {
        elapsed_s: Math.round((event.receivedAt - startedAtValue) / 10) / 100,
        text: normalizedText,
        isFinal: Boolean(event.isFinal)
      }

      const lastItem = target[target.length - 1]
      if (lastItem && lastItem.text === nextItem.text && lastItem.isFinal === nextItem.isFinal) {
        continue
      }

      target.push(nextItem)
    }
  }

  function updateLiveMetrics(provider, recordedSeconds, partialCount, finalText) {
    METRICS.textContent = formatJson({
      provider,
      recorded_seconds: recordedSeconds,
      partial_count: partialCount,
      final_text_length: String(finalText || "").length
    })
  }

  function beginLiveRun(provider) {
    liveRunId += 1
    activeLiveProvider = provider
    return liveRunId
  }

  function endLiveRun(provider) {
    if (activeLiveProvider === provider) {
      activeLiveProvider = ""
      liveRunId += 1
    }
  }

  function isCurrentLiveRun(provider, runId) {
    return activeLiveProvider === provider && liveRunId === runId
  }

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

  function pickPreferredAudioInputDevice(devices = []) {
    const virtualPattern = /(teams|virtual|blackhole|loopback|aggregate|zoomaudio|zoom audio|obs|cable|vb-audio)/i
    return devices.find((device) => !virtualPattern.test(device.label || "")) || devices[0] || null
  }

  async function loadDevices() {
    try {
      const tempStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      tempStream.getTracks().forEach((track) => track.stop())
    } catch (_) {
      // On continue quand même pour lister ce qui est visible.
    }

    const devices = (await navigator.mediaDevices.enumerateDevices())
      .filter((device) => device.kind === "audioinput")

    DEVICE_SELECT.innerHTML = ""
    const preferred = pickPreferredAudioInputDevice(devices)

    for (const device of devices) {
      const option = document.createElement("option")
      option.value = device.deviceId
      option.textContent = device.label || "Micro non nommé"
      if (preferred && preferred.deviceId === device.deviceId) {
        option.selected = true
      }
      DEVICE_SELECT.appendChild(option)
    }

    if (!devices.length) {
      const option = document.createElement("option")
      option.value = ""
      option.textContent = "Aucun micro détecté"
      DEVICE_SELECT.appendChild(option)
    }
  }

  async function loadProviderPreference() {
    try {
      const response = await fetch(STATUS_URL)
      const payload = await response.json()
      if (response.ok && payload.ok && payload.deepgramReady) {
        PROVIDER_SELECT.value = "deepgram"
        setStatus("Deepgram est disponible et sélectionné par défaut.")
        return
      }
      if (response.ok && payload.ok && payload.assemblyaiReady) {
        PROVIDER_SELECT.value = "assemblyai"
        setStatus("AssemblyAI est configuré et prêt pour l'intégration.")
        return
      }
    } catch (_) {
      // On garde le moteur local par défaut si l'état n'est pas disponible.
    }

    PROVIDER_SELECT.value = "faster-whisper"
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

  function writeString(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index))
    }
  }

  function encodeWavFrom16kMono(samples) {
    const buffer = new ArrayBuffer(44 + samples.length * 2)
    const view = new DataView(buffer)

    writeString(view, 0, "RIFF")
    view.setUint32(4, 36 + samples.length * 2, true)
    writeString(view, 8, "WAVE")
    writeString(view, 12, "fmt ")
    view.setUint32(16, 16, true)
    view.setUint16(20, 1, true)
    view.setUint16(22, 1, true)
    view.setUint32(24, 16000, true)
    view.setUint32(28, 32000, true)
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

  async function convertToWav(blob) {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)()
    try {
      const arrayBuffer = await blob.arrayBuffer()
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))
      const source = audioBuffer.getChannelData(0)
      const sampleRate = audioBuffer.sampleRate
      const targetRate = 16000
      const targetLength = Math.max(1, Math.round(source.length * targetRate / sampleRate))
      const output = new Float32Array(targetLength)

      for (let index = 0; index < targetLength; index += 1) {
        const sourceIndex = Math.min(source.length - 1, Math.round(index * sampleRate / targetRate))
        output[index] = source[sourceIndex]
      }

      return encodeWavFrom16kMono(output)
    } finally {
      await audioContext.close()
    }
  }

  async function startRecording() {
    const selectedDeviceId = DEVICE_SELECT.value
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : true
    })

    recorder = new MediaRecorder(mediaStream, { mimeType: "audio/webm" })
    chunks = []
    startedAt = Date.now()

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunks.push(event.data)
      }
    }

    recorder.start()
    START_BUTTON.disabled = true
    STOP_BUTTON.disabled = false
    setStatus("Enregistrement en cours... parle 3 à 6 secondes puis arrête.")
  }

  class DeepgramLiveRecorder {
    constructor(stream) {
      this.stream = stream
      this.audioContext = null
      this.source = null
      this.processor = null
      this.started = false
    }

    async start(onChunk) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext
      this.audioContext = new AudioContextCtor()
      await this.audioContext.resume()
      this.source = this.audioContext.createMediaStreamSource(this.stream)
      this.processor = this.audioContext.createScriptProcessor(4096, 1, 1)
      this.processor.onaudioprocess = (event) => {
        if (!this.started) {
          return
        }

        const input = event.inputBuffer.getChannelData(0)
        const floatCopy = new Float32Array(input)
        const resampled = resampleFloat32(floatCopy, this.audioContext.sampleRate, 16000)
        const pcm = floatTo16BitPCM(resampled)
        onChunk(pcm)
      }

      this.source.connect(this.processor)
      this.processor.connect(this.audioContext.destination)
      this.started = true
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
        await this.audioContext.close()
      }
    }
  }

  async function startDeepgramLiveRecording() {
    const selectedDeviceId = DEVICE_SELECT.value
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : true
    })

    const sessionResponse = await fetch(DEEPGRAM_LIVE_URLS.start, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: LANGUAGE_SELECT.value })
    })
    const sessionPayload = await sessionResponse.json()
    if (!sessionResponse.ok || !sessionPayload.ok) {
      throw new Error(sessionPayload.error || "Impossible de démarrer Deepgram live.")
    }

    deepgramSessionId = sessionPayload.sessionId
    deepgramCursor = 0
    deepgramQueuedBytes = []
    deepgramPartials = []
    FINAL_TEXT.textContent = "(en attente)"
    PARTIALS.textContent = "[]"
    METRICS.textContent = "Aucune métrique pour le moment."

    liveRecorder = new DeepgramLiveRecorder(mediaStream)
    await liveRecorder.start((pcmBytes) => {
      deepgramQueuedBytes.push(pcmBytes)
    })

    beginLiveRun("deepgram")
    deepgramFlushTimer = window.setInterval(flushDeepgramChunks, DEEPGRAM_LIVE_FLUSH_MS)
    deepgramPollTimer = window.setInterval(pollDeepgramEvents, DEEPGRAM_LIVE_POLL_MS)
    startedAt = Date.now()
    START_BUTTON.disabled = true
    STOP_BUTTON.disabled = false
    setStatus("Deepgram live en cours... le texte devrait commencer à apparaître pendant la dictée.")
  }

  async function startAssemblyAiLiveRecording() {
    const selectedDeviceId = DEVICE_SELECT.value
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: selectedDeviceId
        ? { deviceId: { exact: selectedDeviceId } }
        : true
    })

    const sessionResponse = await fetch(ASSEMBLYAI_LIVE_URLS.start, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ language: LANGUAGE_SELECT.value })
    })
    const sessionPayload = await sessionResponse.json()
    if (!sessionResponse.ok || !sessionPayload.ok) {
      throw new Error(sessionPayload.error || "Impossible de démarrer AssemblyAI live.")
    }

    assemblyAiSessionId = sessionPayload.sessionId
    assemblyAiCursor = 0
    assemblyAiQueuedBytes = []
    assemblyAiPartials = []
    FINAL_TEXT.textContent = "(en attente)"
    PARTIALS.textContent = "[]"
    METRICS.textContent = "Aucune métrique pour le moment."

    liveRecorder = new DeepgramLiveRecorder(mediaStream)
    await liveRecorder.start((pcmBytes) => {
      assemblyAiQueuedBytes.push(pcmBytes)
    })

    beginLiveRun("assemblyai")
    assemblyAiFlushTimer = window.setInterval(flushAssemblyAiChunks, DEEPGRAM_LIVE_FLUSH_MS)
    assemblyAiPollTimer = window.setInterval(pollAssemblyAiEvents, DEEPGRAM_LIVE_POLL_MS)
    startedAt = Date.now()
    START_BUTTON.disabled = true
    STOP_BUTTON.disabled = false
    setStatus("AssemblyAI live en cours... le texte devrait commencer à apparaître pendant la dictée.")
  }

  async function flushDeepgramChunks() {
    if (!deepgramSessionId || !deepgramQueuedBytes.length) {
      return
    }

    const merged = concatUint8Arrays(deepgramQueuedBytes)
    deepgramQueuedBytes = []
    const blob = new Blob([merged], { type: "application/octet-stream" })
    const audioBase64 = await blobToBase64(blob)

    await fetch(DEEPGRAM_LIVE_URLS.chunk, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: deepgramSessionId,
        audioBase64
      })
    })
  }

  async function pollDeepgramEvents() {
    if (!deepgramSessionId) {
      return
    }

    const runId = liveRunId

    const response = await fetch(`${DEEPGRAM_LIVE_URLS.events}?sessionId=${encodeURIComponent(deepgramSessionId)}&since=${deepgramCursor}`)
    if (!isCurrentLiveRun("deepgram", runId)) {
      return
    }
    const payload = await response.json()
    if (!response.ok || !payload.ok) {
      return
    }

    deepgramCursor = payload.cursor || deepgramCursor
    const events = Array.isArray(payload.events) ? payload.events : []
    if (events.length) {
      appendUniqueEvents(deepgramPartials, events, startedAt)
      PARTIALS.textContent = formatJson(deepgramPartials)
    }

    FINAL_TEXT.textContent = payload.finalText || payload.latestPartialText || "(en attente)"
    updateLiveMetrics(
      "deepgram-live",
      Math.round((Date.now() - startedAt) / 100) / 10,
      deepgramPartials.length,
      payload.finalText || payload.latestPartialText || ""
    )
  }

  async function stopRecording() {
    if (!recorder) {
      return
    }

    STOP_BUTTON.disabled = true
    setStatus("Analyse de l'enregistrement...")

    const stopped = new Promise((resolve) => {
      recorder.onstop = resolve
    })
    recorder.stop()
    await stopped

    const rawBlob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" })
    const wavBlob = await convertToWav(rawBlob)
    const audioBase64 = await blobToBase64(wavBlob)
    const recordedSeconds = Math.round((Date.now() - startedAt) / 100) / 10

    const selectedProvider = PROVIDER_SELECT.value || "faster-whisper"
    const response = await fetch(PROVIDER_URLS[selectedProvider], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        audioBase64,
        mimeType: "audio/wav",
        language: LANGUAGE_SELECT.value
      })
    })

    const payload = await response.json()
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Test audio impossible.")
    }

    const probe = payload.probe || {}
    FINAL_TEXT.textContent = probe.final_text || "(vide)"
    PARTIALS.textContent = formatJson(probe.partials || [])
    METRICS.textContent = formatJson({
      provider: selectedProvider,
      recorded_seconds: recordedSeconds,
      model_load_s: probe.model_load_s,
      first_partial_s: probe.first_partial_s,
      partial_count: probe.partial_count,
      audio_total_s: probe.audio_total_s,
      last_partial_text: probe.last_partial_text,
      request_elapsed_ms: probe.request_elapsed_ms,
      word_count: probe.word_count
    })

    setStatus("Test terminé.")
    mediaStream?.getTracks()?.forEach((track) => track.stop())
    mediaStream = null
    recorder = null
    chunks = []
    START_BUTTON.disabled = false
  }

  async function flushAssemblyAiChunks() {
    if (!assemblyAiSessionId || !assemblyAiQueuedBytes.length) {
      return
    }

    const merged = concatUint8Arrays(assemblyAiQueuedBytes)
    assemblyAiQueuedBytes = []
    const blob = new Blob([merged], { type: "application/octet-stream" })
    const audioBase64 = await blobToBase64(blob)

    await fetch(ASSEMBLYAI_LIVE_URLS.chunk, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: assemblyAiSessionId,
        audioBase64
      })
    })
  }

  async function pollAssemblyAiEvents() {
    if (!assemblyAiSessionId) {
      return
    }

    const runId = liveRunId

    const response = await fetch(`${ASSEMBLYAI_LIVE_URLS.events}?sessionId=${encodeURIComponent(assemblyAiSessionId)}&since=${assemblyAiCursor}`)
    if (!isCurrentLiveRun("assemblyai", runId)) {
      return
    }
    const payload = await response.json()
    if (!response.ok || !payload.ok) {
      return
    }

    assemblyAiCursor = payload.cursor || assemblyAiCursor
    const events = Array.isArray(payload.events) ? payload.events : []
    if (events.length) {
      appendUniqueEvents(assemblyAiPartials, events, startedAt)
      PARTIALS.textContent = formatJson(assemblyAiPartials)
    }

    FINAL_TEXT.textContent = payload.finalText || payload.latestPartialText || "(en attente)"
    updateLiveMetrics(
      "assemblyai-live",
      Math.round((Date.now() - startedAt) / 100) / 10,
      assemblyAiPartials.length,
      payload.finalText || payload.latestPartialText || ""
    )
  }

  async function stopDeepgramLiveRecording() {
    STOP_BUTTON.disabled = true
    setStatus("Finalisation Deepgram...")
    const finalSessionId = deepgramSessionId

    window.clearInterval(deepgramFlushTimer)
    window.clearInterval(deepgramPollTimer)
    deepgramFlushTimer = null
    deepgramPollTimer = null

    if (liveRecorder) {
      await liveRecorder.stop()
    }
    await flushDeepgramChunks()
    await pollDeepgramEvents()

    const response = await fetch(DEEPGRAM_LIVE_URLS.stop, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: finalSessionId })
    })
    const payload = await response.json()
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Impossible d'arrêter Deepgram live.")
    }

    const recordedSeconds = Math.round((Date.now() - startedAt) / 100) / 10
    FINAL_TEXT.textContent = payload.finalText || "(vide)"
    PARTIALS.textContent = formatJson(deepgramPartials)
    updateLiveMetrics("deepgram-live", recordedSeconds, deepgramPartials.length, payload.finalText || "")

    mediaStream?.getTracks()?.forEach((track) => track.stop())
    mediaStream = null
    liveRecorder = null
    deepgramSessionId = ""
    deepgramQueuedBytes = []
    deepgramPartials = []
    endLiveRun("deepgram")
    START_BUTTON.disabled = false
    setStatus("Test Deepgram live terminé.")
  }

  async function stopAssemblyAiLiveRecording() {
    STOP_BUTTON.disabled = true
    setStatus("Finalisation AssemblyAI...")
    const finalSessionId = assemblyAiSessionId

    window.clearInterval(assemblyAiFlushTimer)
    window.clearInterval(assemblyAiPollTimer)
    assemblyAiFlushTimer = null
    assemblyAiPollTimer = null

    if (liveRecorder) {
      await liveRecorder.stop()
    }
    await flushAssemblyAiChunks()
    await pollAssemblyAiEvents()

    const response = await fetch(ASSEMBLYAI_LIVE_URLS.stop, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: finalSessionId })
    })
    const payload = await response.json()
    if (!response.ok || !payload.ok) {
      throw new Error(payload.error || "Impossible d'arrêter AssemblyAI live.")
    }

    const recordedSeconds = Math.round((Date.now() - startedAt) / 100) / 10
    FINAL_TEXT.textContent = payload.finalText || "(vide)"
    PARTIALS.textContent = formatJson(assemblyAiPartials)
    updateLiveMetrics("assemblyai-live", recordedSeconds, assemblyAiPartials.length, payload.finalText || "")

    mediaStream?.getTracks()?.forEach((track) => track.stop())
    mediaStream = null
    liveRecorder = null
    assemblyAiSessionId = ""
    assemblyAiQueuedBytes = []
    assemblyAiPartials = []
    endLiveRun("assemblyai")
    START_BUTTON.disabled = false
    setStatus("Test AssemblyAI live terminé.")
  }

  START_BUTTON?.addEventListener("click", async () => {
    try {
      if ((PROVIDER_SELECT.value || "faster-whisper") === "deepgram") {
        await startDeepgramLiveRecording()
      } else if ((PROVIDER_SELECT.value || "faster-whisper") === "assemblyai") {
        await startAssemblyAiLiveRecording()
      } else {
        await startRecording()
      }
    } catch (error) {
      setStatus(error.message || "Impossible de démarrer l'enregistrement.")
      START_BUTTON.disabled = false
      STOP_BUTTON.disabled = true
    }
  })

  STOP_BUTTON?.addEventListener("click", async () => {
    try {
      if ((PROVIDER_SELECT.value || "faster-whisper") === "deepgram") {
        await stopDeepgramLiveRecording()
      } else if ((PROVIDER_SELECT.value || "faster-whisper") === "assemblyai") {
        await stopAssemblyAiLiveRecording()
      } else {
        await stopRecording()
      }
    } catch (error) {
      setStatus(error.message || "Impossible d'analyser l'enregistrement.")
      START_BUTTON.disabled = false
      STOP_BUTTON.disabled = true
    }
  })

  loadDevices().catch((error) => {
    setStatus(error.message || "Impossible de charger les microphones.")
  })

  loadProviderPreference().catch(() => {
    PROVIDER_SELECT.value = "faster-whisper"
  })
})()
