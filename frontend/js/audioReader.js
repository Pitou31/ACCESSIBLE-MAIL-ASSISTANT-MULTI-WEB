(() => {
  const SETTINGS_STORAGE_KEY = "mail-assistant-settings"
  const SESSION_KEY = "mail-assistant-session"

  const LANGUAGE_TO_LOCALE = {
    fr: ["fr-FR", "fr-CA", "fr-BE", "fr-CH"],
    en: ["en-US", "en-GB", "en-AU", "en-CA"],
    es: ["es-ES", "es-MX", "es-US"],
    de: ["de-DE", "de-AT", "de-CH"],
    it: ["it-IT", "it-CH"],
    nl: ["nl-NL", "nl-BE"],
    ar: ["ar-SA", "ar-AE", "ar-EG", "ar-MA"]
  }


  const FANTASY_VOICE_PATTERNS = [
    /bahh/i,
    /boing/i,
    /bonnes nouvelles/i,
    /bouffon/i,
    /bulles/i,
    /cloches/i,
    /mauvaises nouvelles/i,
    /murmure/i,
    /orgue/i,
    /superstar/i,
    /trinoi?des/i,
    /violoncelles/i,
    /wobble/i,
    /zarvox/i,
    /cellos/i,
    /good news/i,
    /bad news/i,
    /whisper/i
  ]

  const PREFERRED_VOICE_NAMES = {
    fr: ["amelie", "thomas", "jacques", "eddy", "flo"],
    en: ["samantha", "daniel", "karen", "moira", "kathy", "fred", "eddy", "flo", "sandy", "shelley"],
    es: ["monica", "montse", "eddy", "flo"],
    de: ["anna", "eddy", "flo"],
    it: ["alice", "eddy", "flo"],
    nl: ["ellen"],
    ar: ["majed"]
  }

  let cachedVoices = []
  let voicesReadyPromise = null

  function normalizeLanguage(language) {
    return String(language || "").trim().toLowerCase() || "fr"
  }

  function refreshVoices() {
    if (!("speechSynthesis" in window)) {
      cachedVoices = []
      return cachedVoices
    }

    cachedVoices = window.speechSynthesis.getVoices() || []
    return cachedVoices
  }

  function ensureVoicesReady() {
    if (!("speechSynthesis" in window)) {
      return Promise.resolve([])
    }

    const immediateVoices = refreshVoices()
    if (immediateVoices.length) {
      return Promise.resolve(immediateVoices)
    }

    if (voicesReadyPromise) {
      return voicesReadyPromise
    }

    voicesReadyPromise = new Promise((resolve) => {
      let settled = false

      const finalize = () => {
        if (settled) return
        settled = true
        window.speechSynthesis.onvoiceschanged = previousHandler
        const voices = refreshVoices()
        resolve(voices)
      }

      const previousHandler = window.speechSynthesis.onvoiceschanged
      window.speechSynthesis.onvoiceschanged = () => {
        if (typeof previousHandler === "function") {
          previousHandler()
        }
        finalize()
      }

      window.setTimeout(finalize, 700)
    }).finally(() => {
      voicesReadyPromise = null
    })

    return voicesReadyPromise
  }

  function getSessionStorageKey(baseKey) {
    try {
      const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
      const accountId = session?.userId || session?.accountId || ""
      return accountId ? `${baseKey}:${accountId}` : baseKey
    } catch (_) {
      return baseKey
    }
  }

  function getStoredAudioVoicePreferences() {
    try {
      const scopedRaw = JSON.parse(localStorage.getItem(getSessionStorageKey(SETTINGS_STORAGE_KEY)) || "{}")
      if (scopedRaw.audioVoicePreferences && typeof scopedRaw.audioVoicePreferences === "object" && Object.keys(scopedRaw.audioVoicePreferences).length) {
        return scopedRaw.audioVoicePreferences
      }

      const legacyRaw = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "{}")
      return legacyRaw.audioVoicePreferences && typeof legacyRaw.audioVoicePreferences === "object"
        ? legacyRaw.audioVoicePreferences
        : {}
    } catch (_) {
      return {}
    }
  }

  function getStoredVoicePreference(language) {
    const preferences = getStoredAudioVoicePreferences()
    const normalized = normalizeLanguage(language)
    const current = preferences[normalized] || {}
    return {
      voiceName: current.voiceName || "",
      voiceLang: current.voiceLang || "",
      rate: Number(current.rate || 0.95)
    }
  }

  function pushAudioTrace(entry) {
    try {
      const nextEntry = {
        timestamp: new Date().toISOString(),
        ...entry
      }
      const current = Array.isArray(window.__mailAudioTrace) ? window.__mailAudioTrace : []
      current.push(nextEntry)
      window.__mailAudioTrace = current.slice(-200)
    } catch (_) {
      // Rien de bloquant.
    }
  }

  function normalizeVoiceKey(value = "") {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim()
      .toLowerCase()
  }

  function resolveLocale(language) {
    const normalized = normalizeLanguage(language)
    const preferredLocales = LANGUAGE_TO_LOCALE[normalized]
    if (preferredLocales?.length) {
      return preferredLocales[0]
    }
    return `${normalized}-${normalized.toUpperCase()}`
  }

  function isFantasyVoice(voice) {
    const label = `${voice?.name || ""} ${voice?.lang || ""}`
    return FANTASY_VOICE_PATTERNS.some((pattern) => pattern.test(label))
  }

  function scoreVoice(voice, language, preferredLocales) {
    const normalized = normalizeLanguage(language)
    const voiceLang = String(voice?.lang || "").toLowerCase()
    const voiceName = normalizeVoiceKey(voice?.name || "")
    let score = 0

    if (preferredLocales.some((locale) => voiceLang === locale.toLowerCase())) {
      score += 120
    } else if (voiceLang.startsWith(`${normalized}-`) || voiceLang === normalized) {
      score += 80
    }

    if (voice.localService) {
      score += 8
    }

    if (!isFantasyVoice(voice)) {
      score += 25
    } else {
      score -= 200
    }

    const preferredNames = PREFERRED_VOICE_NAMES[normalized] || []
    const preferredIndex = preferredNames.findIndex((name) => voiceName.includes(name))
    if (preferredIndex >= 0) {
      score += 60 - preferredIndex
    }

    return score
  }

  function findVoiceForLanguage(language) {
    const normalized = normalizeLanguage(language)
    const voices = getLanguageVoiceCandidates(normalized)
    if (!voices.length) {
      return null
    }

    const preferredLocales = LANGUAGE_TO_LOCALE[normalized] || [resolveLocale(normalized)]
    const preferredNames = PREFERRED_VOICE_NAMES[normalized] || []

    for (const preferredName of preferredNames) {
      const exactPreferred = voices.find((voice) => {
        const voiceName = normalizeVoiceKey(voice?.name || "")
        const voiceLang = String(voice?.lang || "").toLowerCase()
        return !isFantasyVoice(voice)
          && voiceName.includes(preferredName)
          && (preferredLocales.some((locale) => voiceLang === locale.toLowerCase()) || voiceLang.startsWith(`${normalized}-`) || voiceLang === normalized)
      })
      if (exactPreferred) {
        return exactPreferred
      }
    }

    const sorted = [...voices].sort((left, right) => {
      return scoreVoice(right, normalized, preferredLocales) - scoreVoice(left, normalized, preferredLocales)
    })

    return sorted[0] || null
  }

  function getLanguageVoiceCandidates(language) {
    const normalized = normalizeLanguage(language)
    const preferredLocales = LANGUAGE_TO_LOCALE[normalized] || [resolveLocale(normalized)]
    const voices = cachedVoices.length ? cachedVoices : refreshVoices()
    if (!voices.length) {
      return []
    }

    const matching = voices.filter((voice) => {
      const voiceLang = String(voice?.lang || "").toLowerCase()
      return preferredLocales.some((locale) => voiceLang === locale.toLowerCase())
        || voiceLang.startsWith(`${normalized}-`)
        || voiceLang === normalized
    })

    const natural = matching.filter((voice) => !isFantasyVoice(voice))
    return natural.length ? natural : matching
  }

  function getTextareaCaretTop(textarea, position) {
    if (!textarea || typeof document === "undefined") {
      return null
    }

    const mirror = document.createElement("div")
    const computed = window.getComputedStyle(textarea)
    const properties = [
      "boxSizing",
      "width",
      "height",
      "overflowX",
      "overflowY",
      "borderTopWidth",
      "borderRightWidth",
      "borderBottomWidth",
      "borderLeftWidth",
      "paddingTop",
      "paddingRight",
      "paddingBottom",
      "paddingLeft",
      "fontStyle",
      "fontVariant",
      "fontWeight",
      "fontStretch",
      "fontSize",
      "fontSizeAdjust",
      "lineHeight",
      "fontFamily",
      "textAlign",
      "textTransform",
      "textIndent",
      "textDecoration",
      "letterSpacing",
      "wordSpacing",
      "tabSize",
      "whiteSpace",
      "wordBreak",
      "overflowWrap"
    ]

    mirror.style.position = "absolute"
    mirror.style.visibility = "hidden"
    mirror.style.pointerEvents = "none"
    mirror.style.zIndex = "-1"
    properties.forEach((property) => {
      mirror.style[property] = computed[property]
    })
    mirror.style.whiteSpace = "pre-wrap"
    mirror.style.wordWrap = "break-word"
    mirror.style.overflow = "hidden"

    const value = textarea.value || ""
    const safePosition = Math.max(0, Math.min(position, value.length))
    mirror.textContent = value.slice(0, safePosition)

    const marker = document.createElement("span")
    marker.textContent = value.slice(safePosition, safePosition + 1) || "\u200b"
    mirror.appendChild(marker)

    document.body.appendChild(mirror)
    const top = marker.offsetTop
    mirror.remove()
    return top
  }

  class AudioReader {
    constructor(textElement, controlsElement, options = {}) {
      this.textElement = textElement
      this.controlsElement = controlsElement
      this.audioEnabled = true
      this.utterance = null
      this.lastCharIndex = 0
      this.options = options || {}
      this.playbackToken = 0
      this.progressTimerId = null
      this.progressStartTime = 0
      this.bind()
      this.render()
    }

    bind() {
      this.toggleButton = this.controlsElement.querySelector("[data-audio-toggle]")
      this.playButton = this.controlsElement.querySelector("[data-audio-play]")
      this.pauseButton = this.controlsElement.querySelector("[data-audio-pause]")
      this.resumeButton = this.controlsElement.querySelector("[data-audio-resume]")
      this.stopButton = this.controlsElement.querySelector("[data-audio-stop]")

      this.toggleButton?.addEventListener("click", () => this.toggleAudio())
      this.playButton?.addEventListener("click", () => this.play())
      this.pauseButton?.addEventListener("click", () => this.pause())
      this.resumeButton?.addEventListener("click", () => this.resume())
      this.stopButton?.addEventListener("click", () => this.stop())
    }

    render() {
      if (!this.toggleButton) return

      this.toggleButton.classList.toggle("audio-on", this.audioEnabled)
      this.toggleButton.classList.toggle("audio-off", !this.audioEnabled)
      this.toggleButton.setAttribute("aria-pressed", this.audioEnabled ? "true" : "false")
      this.toggleButton.title = this.audioEnabled ? "Audio activé" : "Audio désactivé"
      this.toggleButton.setAttribute("aria-label", this.audioEnabled ? "Audio activé" : "Audio désactivé")
      this.toggleButton.textContent = this.audioEnabled ? "Audio ON" : "Audio OFF"
    }

    toggleAudio() {
      this.audioEnabled = !this.audioEnabled
      if (!this.audioEnabled) {
        this.stop()
      }
      this.render()
    }

    getLanguage() {
      if (typeof this.options.getLanguage === "function") {
        const nextLanguage = this.options.getLanguage()
        if (nextLanguage) {
          return normalizeLanguage(nextLanguage)
        }
      }

      if (this.options.language) {
        return normalizeLanguage(this.options.language)
      }

      return normalizeLanguage((navigator.language || "fr").split("-")[0])
    }

    getText() {
      const rawText = this.textElement?.value?.trim() || ""
      if (!rawText) {
        return ""
      }

      return rawText
        .replace(/<([^>]+)>/g, " adresse mail $1 ")
        .replace(/@/g, " arobase ")
        .split(/\n+/)
        .map((line) => line.replace(/[\t ]+/g, " ").trim())
        .filter(Boolean)
        .join("\n")
        .trim()
    }

    splitIntoSegments(text) {
      const segments = []
      const pattern = /[^.!?\n]+(?:[.!?]+|\n+|$)/gu
      let match

      while ((match = pattern.exec(text)) !== null) {
        const rawSegment = match[0] || ""
        const leadingWhitespace = rawSegment.match(/^\s*/u)?.[0]?.length || 0
        const trimmed = rawSegment.trim()
        if (!trimmed) {
          continue
        }

        const start = match.index + leadingWhitespace
        segments.push({
          text: trimmed,
          start
        })
      }

      if (!segments.length && text.trim()) {
        segments.push({ text: text.trim(), start: text.indexOf(text.trim()) })
      }

      return segments
    }

    getSegmentLanguage(segmentText, segmentIndex = 0, segments = [], previousLanguage = "") {
      if (typeof this.options.getSegmentLanguage === "function") {
        const nextLanguage = this.options.getSegmentLanguage(segmentText, this.getLanguage(), segmentIndex, segments, previousLanguage)
        if (nextLanguage) {
          return normalizeLanguage(nextLanguage)
        }
      }

      return this.getLanguage()
    }

    resolveVoiceForLanguage(language) {
      const preference = getStoredVoicePreference(language)
      const candidates = getLanguageVoiceCandidates(language)
      const allVoices = cachedVoices.length ? cachedVoices : refreshVoices()
      const normalizedPreferredName = normalizeVoiceKey(preference.voiceName)
      const normalizedPreferredLang = normalizeVoiceKey(preference.voiceLang)
      const configuredCandidateExact = candidates.find((voice) =>
        normalizeVoiceKey(voice.name) === normalizedPreferredName
        && (!normalizedPreferredLang || normalizeVoiceKey(voice.lang) === normalizedPreferredLang)
      )
      const configuredCandidateByName = configuredCandidateExact || candidates.find((voice) => normalizeVoiceKey(voice.name) === normalizedPreferredName)
      const configuredVoice = configuredCandidateExact
        || configuredCandidateByName
      const fallbackVoice = configuredVoice ? null : findVoiceForLanguage(language)
      const voice = configuredVoice || fallbackVoice
      const locale = voice?.lang || resolveLocale(language)
      const rate = Number.isFinite(preference.rate) ? preference.rate : 0.95
      const preferredCandidates = candidates
        .filter((candidate) => {
          const normalizedName = normalizeVoiceKey(candidate?.name || "")
          const normalizedLang = normalizeVoiceKey(candidate?.lang || "")
          return normalizedName.includes(normalizedPreferredName || "__none__")
            || (!normalizedPreferredName && normalizedLang.startsWith(normalizeLanguage(language)))
        })
        .slice(0, 5)
        .map((candidate) => ({
          name: candidate?.name || "",
          lang: candidate?.lang || ""
        }))
      pushAudioTrace({
        type: "voice-resolution",
        targetId: this.textElement?.id || "",
        requestedLanguage: language,
        storedPreference: preference,
        candidateCount: candidates.length,
        resolutionBranch: configuredCandidateExact ? "configured-candidate-exact"
          : configuredCandidateByName ? "configured-candidate-by-name"
            : fallbackVoice ? "fallback-language-voice"
              : "no-voice-found",
        preferredCandidates,
        chosenVoiceName: voice?.name || "",
        chosenVoiceLang: voice?.lang || "",
        chosenLocale: locale,
        chosenRate: rate
      })
      return { voice, locale, rate }
    }

    getWordRange(text, charIndex) {
      const safeIndex = Math.max(0, Math.min(charIndex, text.length))
      let start = safeIndex
      let end = safeIndex

      while (start > 0 && !/\s/.test(text[start - 1])) {
        start -= 1
      }

      while (end < text.length && !/\s/.test(text[end])) {
        end += 1
      }

      return { start, end }
    }

    showProgressAt(charIndex) {
      if (!this.textElement) {
        return
      }

      const text = this.textElement.value || ""
      if (!text) {
        return
      }

      const { start, end } = this.getWordRange(text, charIndex)
      this.textElement.focus()
      this.textElement.setSelectionRange(start, end)
      const computedStyle = window.getComputedStyle(this.textElement)
      const lineHeight = Number.parseFloat(computedStyle.lineHeight) || 24
      const caretTop = getTextareaCaretTop(this.textElement, start)
      if (Number.isFinite(caretTop)) {
        const currentScrollTop = Math.max(0, this.textElement.scrollTop || 0)
        const viewportTop = currentScrollTop
        const viewportBottom = currentScrollTop + this.textElement.clientHeight
        const caretBottom = caretTop + lineHeight
        const padding = lineHeight * 2

        if (start === 0 && currentScrollTop <= 0) {
          this.textElement.scrollTop = 0
        } else if (caretTop < viewportTop + padding) {
          this.textElement.scrollTop = Math.max(0, caretTop - padding)
        } else if (caretBottom > viewportBottom - padding) {
          this.textElement.scrollTop = Math.max(0, caretBottom - this.textElement.clientHeight + padding)
        }
      }
      this.lastCharIndex = start
    }

    clearProgress() {
      if (!this.textElement) {
        return
      }

      const position = Math.max(0, Math.min(this.lastCharIndex, this.textElement.value.length))
      this.textElement.setSelectionRange(position, position)
    }

    resetPlaybackPosition() {
      if (!this.textElement) {
        return
      }

      this.lastCharIndex = 0
      this.textElement.focus()
      this.textElement.setSelectionRange(0, 0)
      this.textElement.scrollTop = 0
      this.textElement.scrollLeft = 0
    }

    stopProgressFallback() {
      if (this.progressTimerId) {
        window.clearInterval(this.progressTimerId)
      }
      this.progressTimerId = null
      this.progressStartTime = 0
    }

    startProgressFallback(segment, rate = 0.95) {
      this.stopProgressFallback()
      if (!segment?.text) {
        return
      }

      const charsPerSecond = Math.max(8, 13 * Number(rate || 0.95))
      this.progressStartTime = Date.now()
      this.progressTimerId = window.setInterval(() => {
        const elapsedMs = Date.now() - this.progressStartTime
        const progressedChars = Math.min(
          segment.text.length,
          Math.floor((elapsedMs / 1000) * charsPerSecond)
        )
        this.showProgressAt(segment.start + progressedChars)

        if (progressedChars >= segment.text.length) {
          this.stopProgressFallback()
        }
      }, 90)
    }

    getInitialPlaybackIndex(segments = []) {
      if (!this.textElement || !segments.length) {
        return 0
      }

      const currentScrollTop = Math.max(0, this.textElement.scrollTop || 0)
      if (currentScrollTop <= 0) {
        return 0
      }

      let fallbackIndex = 0
      for (let index = 0; index < segments.length; index += 1) {
        const segment = segments[index]
        const caretTop = getTextareaCaretTop(this.textElement, segment.start)
        if (!Number.isFinite(caretTop)) {
          continue
        }
        fallbackIndex = index
        if (caretTop >= currentScrollTop) {
          return index
        }
      }

      return fallbackIndex
    }

    async play() {
      if (!this.audioEnabled || !("speechSynthesis" in window)) {
        return
      }

      const text = this.getText()
      if (!text) return

      await ensureVoicesReady()

      const rawSegments = this.splitIntoSegments(text)
      pushAudioTrace({
        type: "play-start",
        targetId: this.textElement?.id || "",
        baseLanguage: this.getLanguage(),
        textLength: text.length,
        segmentCount: rawSegments.length
      })
      const segments = rawSegments.map((segment, index) => {
        const language = this.getSegmentLanguage(segment.text, index, rawSegments, "")
        const resolved = this.resolveVoiceForLanguage(language)
        return {
          ...segment,
          language,
          ...resolved
        }
      })
      segments.forEach((segment, index) => {
        pushAudioTrace({
          type: "segment-prepared",
          targetId: this.textElement?.id || "",
          segmentIndex: index,
          segmentText: segment.text,
          detectedLanguage: segment.language,
          chosenVoiceName: segment.voice?.name || "",
          chosenVoiceLang: segment.voice?.lang || "",
          chosenLocale: segment.locale,
          chosenRate: segment.rate
        })
      })
      if (!segments.length) {
        return
      }

      this.resetPlaybackPosition()

      const initialIndex = 0
      const initialSegment = segments[0]
      if (initialSegment) {
        this.showProgressAt(initialSegment.start)
      }

      this.playbackToken += 1
      const currentToken = this.playbackToken

      window.speechSynthesis.cancel()
      window.speechSynthesis.resume()

      const speakSegment = (index) => {
        if (currentToken != this.playbackToken) {
          return
        }

        const segment = segments[index]
        if (!segment) {
          this.utterance = null
          this.clearProgress()
          return
        }

        const { voice, locale, rate } = segment

        this.utterance = new SpeechSynthesisUtterance(segment.text)
        this.utterance.lang = locale
        this.utterance.rate = rate

        if (voice) {
          this.utterance.voice = voice
        }

        pushAudioTrace({
          type: "utterance-prepared",
          targetId: this.textElement?.id || "",
          segmentIndex: index,
          segmentText: segment.text,
          detectedLanguage: segment.language,
          utteranceLang: this.utterance.lang || "",
          utteranceVoiceName: this.utterance.voice?.name || "",
          utteranceVoiceLang: this.utterance.voice?.lang || "",
          utteranceRate: this.utterance.rate
        })
        this.utterance.onstart = () => {
          this.startProgressFallback(segment, rate)
        }

        this.utterance.onboundary = (event) => {
          if (typeof event.charIndex === "number") {
            this.stopProgressFallback()
            this.showProgressAt(segment.start + event.charIndex)
          }
        }

        this.utterance.onend = () => {
          this.stopProgressFallback()
          if (currentToken != this.playbackToken) {
            return
          }
          if (index < segments.length - 1) {
            speakSegment(index + 1)
            return
          }
          this.utterance = null
          this.clearProgress()
        }

        window.setTimeout(() => {
          if (currentToken === this.playbackToken) {
            window.speechSynthesis.speak(this.utterance)
          }
        }, 40)
      }

      speakSegment(initialIndex)
    }

    pause() {
      if ("speechSynthesis" in window && window.speechSynthesis.speaking && !window.speechSynthesis.paused) {
        window.speechSynthesis.pause()
      }
    }

    resume() {
      if ("speechSynthesis" in window && window.speechSynthesis.paused) {
        window.speechSynthesis.resume()
      }
    }

    stop() {
      this.playbackToken += 1
      this.stopProgressFallback()
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel()
      }
      this.utterance = null
      this.clearProgress()
    }
  }

  function createAudioReader(textareaId, options = {}) {
    const textElement = document.getElementById(textareaId)
    const controlsElement = document.querySelector(`[data-audio-for="${textareaId}"]`)

    if (!textElement || !controlsElement) {
      return null
    }

    return new AudioReader(textElement, controlsElement, options)
  }

  window.MailAudioReader = {
    create(textareaId, options = {}) {
      return createAudioReader(textareaId, options)
    }
  }

  if ("speechSynthesis" in window) {
    refreshVoices()
    window.speechSynthesis.onvoiceschanged = () => {
      refreshVoices()
    }
  }
})()
