(() => {
const SETTINGS_STORAGE_KEY = "mail-assistant-settings"
const THEME_STORAGE_KEY = "mail-assistant-theme"
const SESSION_KEY = "mail-assistant-session"
const LAST_MAIL_MODE_STORAGE_KEY = "mail-assistant-last-mail-mode"

const DEFAULT_SETTINGS = {
  theme: "blue-violet",
  fontFamily: "Inter",
  fontSize: "normal",
  lineSpacing: "standard",
  readingWidth: "standard",
  contrastSimulation: false,
  scrollSpeed: "normal",
  contentStep: "2",
  progressUnit: "320",
  progressiveReading: false,
  buttonSize: "normal",
  confirmations: true,
  audioOption: false,
  audioInputEnabled: false,
  predictiveDictionaryEnabled: false,
  audioInputProvider: "deepgram",
  audioInputDeviceId: "",
  translationActionsEnabled: false,
  summaryActionsEnabled: false,
  rephraseActionsEnabled: true,
  translationTargetLanguage: "fr",
  audioVoicePreferences: {},
  model: "deepseek-chat",
  assistanceLevel: "active",
  defaultTone: "professional",
  defaultLength: "standard",
  generationMode: "manual",
  comparisonEnabled: true,
  defaultMode: "reply",
  attachmentsMode: "manual",
  showClassification: true,
  showPriority: true,
  simulationEnabled: true,
  validationRequired: true,
  deleteConfirmation: true,
  autoDraft: false
}

const SETTINGS_FIELD_IDS = {
  theme: "settingsTheme",
  fontFamily: "fontFamilySelect",
  fontSize: "fontSizeSelect",
  lineSpacing: "lineSpacingSelect",
  readingWidth: "readingWidthSelect",
  contrastSimulation: "contrastSimulationToggle",
  scrollSpeed: "scrollSpeedSelect",
  contentStep: "contentStepSelect",
  progressUnit: "progressUnitInput",
  progressiveReading: "progressiveReadingToggle",
  buttonSize: "buttonSizeSelect",
  confirmations: "confirmationsToggle",
  audioOption: "audioOptionToggle",
  audioInputEnabled: "audioInputToggle",
  predictiveDictionaryEnabled: "predictiveDictionaryToggle",
  audioInputProvider: "audioInputProviderSelect",
  audioInputDeviceId: "audioInputDeviceSelect",
  translationActionsEnabled: "translationActionsToggle",
  summaryActionsEnabled: "summaryActionsToggle",
  rephraseActionsEnabled: "rephraseActionsToggle",
  translationTargetLanguage: "translationTargetLanguageSelect",
  model: "defaultModelSelect",
  assistanceLevel: "assistanceLevelSelect",
  defaultTone: "defaultToneSelect",
  defaultLength: "defaultLengthSelect",
  generationMode: "generationModeSelect",
  comparisonEnabled: "comparisonToggle",
  defaultMode: "defaultModeSelect",
  attachmentsMode: "attachmentsModeSelect",
  showClassification: "classificationToggle",
  showPriority: "priorityToggle",
  simulationEnabled: "simulationToggle",
  validationRequired: "validationToggle",
  deleteConfirmation: "deleteConfirmationToggle",
  autoDraft: "draftToggle"
}

const sizeMap = {
  normal: "1rem",
  large: "1.15rem",
  "extra-large": "1.32rem"
}

const spacingMap = {
  standard: "1.65",
  comfort: "1.95",
  airy: "2.2"
}

const widthMap = {
  standard: "100%",
  reduced: "78%",
  "very-reduced": "62%"
}

const buttonSizeMap = {
  normal: "1rem",
  large: "1.12rem",
  "extra-large": "1.24rem"
}

const PREVIEW_CASE = {
  sourceBlocks: [
    {
      title: "Contexte",
      paragraphs: [
        "Bonjour, je vous contacte au sujet du dossier de transport adapté. J’ai bien reçu votre dernier message mais j’ai encore besoin d’aide pour confirmer l’organisation de la semaine prochaine.",
        "Je souhaite vérifier les horaires proposés, les coordonnées utiles et les documents à préparer avant le rendez-vous."
      ]
    },
    {
      title: "Précisions",
      paragraphs: [
        "Le mardi matin reste la meilleure option pour moi, car mon aidant est disponible sur cette tranche horaire. En revanche, le jeudi après-midi devient difficile à maintenir.",
        "Si un changement est possible, pourriez-vous me proposer un horaire équivalent entre 9 h 30 et 11 h 30 afin de limiter les déplacements trop matinaux ?"
      ]
    },
    {
      title: "Attentes",
      paragraphs: [
        "J’aimerais aussi savoir si la pièce jointe concernant l’attestation médicale est toujours valable ou s’il faut transmettre une version plus récente.",
        "Merci de me confirmer les points essentiels dans une réponse simple, claire et structurée pour que je puisse valider rapidement."
      ]
    }
  ],
  creationPrompt: [
    "Vous préparez un nouveau mail à destination du service d’accompagnement afin de demander un rendez-vous et de clarifier les justificatifs attendus.",
    "L’objectif est d’obtenir une réponse brève, explicite et facilement validable avant envoi."
  ],
  draftVariants: [
    {
      tone: "Professionnel",
      length: "Standard",
      paragraphs: [
        "Bonjour, merci pour votre message. Après vérification, le créneau du mardi entre 9 h 30 et 11 h 30 semble possible sous réserve de confirmation finale du service.",
        "L’attestation médicale actuellement jointe reste recevable pour cette étape. Si une mise à jour devient nécessaire, nous vous le signalerons explicitement avant le rendez-vous.",
        "Si vous le souhaitez, je peux aussi reformuler cette réponse dans une version plus courte pour validation immédiate."
      ]
    },
    {
      tone: "Chaleureux",
      length: "Détaillée",
      paragraphs: [
        "Bonjour, merci pour votre message et pour les précisions très utiles. Nous avons bien noté votre préférence pour le mardi matin, qui correspond mieux à votre organisation actuelle.",
        "À ce stade, le créneau entre 9 h 30 et 11 h 30 paraît être la solution la plus adaptée. Nous allons demander une confirmation définitive afin d’éviter tout déplacement inutile.",
        "Concernant l’attestation médicale, le document déjà transmis peut être conservé pour le moment. Si une version plus récente devait être demandée, nous vous l’indiquerions clairement avant toute validation.",
        "Nous pouvons également vous envoyer une version très courte de cette réponse si vous préférez un message plus direct et plus rapide à approuver."
      ]
    },
    {
      tone: "Court",
      length: "Courte",
      paragraphs: [
        "Bonjour, le mardi matin entre 9 h 30 et 11 h 30 semble possible.",
        "L’attestation actuelle peut être conservée pour l’instant.",
        "Souhaitez-vous une version encore plus courte avant validation ?"
      ]
    }
  ]
}

let currentVariantIndex = 0
let currentPreviewStepIndex = 0
let currentPreviewWordIndex = 0
let previewWordMeta = []
let previewTimerId = null
let automaticReadingPaused = false
let currentDraftStepIndex = 0
let currentDraftWordIndex = 0
let draftWordMeta = []
let draftTimerId = null
let automaticDraftReadingPaused = false
let aiDraftGenerated = false
let previewInputModel = "deepseek-chat"
let previewOutputModel = "deepseek-chat"
let previewSpeechUtterance = null
let audioStartedByUser = false
let inputAudioEnabled = false
let draftAudioEnabled = false
let activeAudioTarget = null
let settingsAudioVoicePreferences = {}

const AUDIO_VOICE_LANGUAGE_OPTIONS = [
  { value: "fr", label: "Francais" },
  { value: "en", label: "English" },
  { value: "es", label: "Espanol" },
  { value: "de", label: "Deutsch" },
  { value: "it", label: "Italiano" },
  { value: "nl", label: "Nederlands" },
  { value: "ar", label: "Arabe" }
]

const AUDIO_TEST_TEXTS = {
  fr: "Bonjour, ceci est un test de lecture audio en francais.",
  en: "Hello, this is an English audio reading test.",
  es: "Hola, esta es una prueba de lectura de audio en espanol.",
  de: "Hallo, dies ist ein Audiolesetest auf Deutsch.",
  it: "Ciao, questo e un test di lettura audio in italiano.",
  nl: "Hallo, dit is een audiotest in het Nederlands.",
  ar: "مرحبا، هذا اختبار قراءة صوتية باللغة العربية."
}

const AUDIO_LANGUAGE_TO_LOCALE = {
  fr: ["fr-FR", "fr-CA", "fr-BE", "fr-CH"],
  en: ["en-US", "en-GB", "en-AU", "en-CA"],
  es: ["es-ES", "es-MX", "es-US"],
  de: ["de-DE", "de-AT", "de-CH"],
  it: ["it-IT", "it-CH"],
  nl: ["nl-NL", "nl-BE"],
  ar: ["ar-001", "ar-SA", "ar-AE", "ar-EG", "ar-MA"]
}

const AUDIO_FANTASY_VOICE_PATTERNS = [
  /bahh/i, /boing/i, /bonnes nouvelles/i, /bouffon/i, /bulles/i, /cloches/i,
  /mauvaises nouvelles/i, /murmure/i, /orgue/i, /superstar/i, /trinoi?des/i,
  /violoncelles/i, /wobble/i, /zarvox/i, /cellos/i, /good news/i, /bad news/i, /whisper/i
]

function getSessionStorageKey(baseKey) {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    const accountId = session?.userId || session?.accountId || ""
    return accountId ? `${baseKey}:${accountId}` : baseKey
  } catch (_) {
    return baseKey
  }
}

function clearLocalAccountState(sessionPayload = null) {
  const session = sessionPayload?.session || (() => {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    } catch (_) {
      return null
    }
  })()

  localStorage.removeItem(SETTINGS_STORAGE_KEY)
  localStorage.removeItem(LAST_MAIL_MODE_STORAGE_KEY)

  const accountId = session?.userId || session?.accountId || ""
  if (accountId) {
    localStorage.removeItem(`${SETTINGS_STORAGE_KEY}:${accountId}`)
    localStorage.removeItem(`${LAST_MAIL_MODE_STORAGE_KEY}:${accountId}`)
  }
}

async function loadActiveSession() {
  try {
    const response = await fetch("/api/account/session")
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture de session.")
    }
    return result
  } catch (_) {
    return {
      ok: false,
      accountActive: 0,
      session: null
    }
  }
}

function renderActiveSession(sessionPayload) {
  const identityElement = document.getElementById("settingsSessionIdentity")
  const detailsElement = document.getElementById("settingsSessionDetails")
  if (!identityElement || !detailsElement) {
    return
  }

  if (!sessionPayload?.accountActive || !sessionPayload.session) {
    identityElement.textContent = "Aucun utilisateur connecté"
    detailsElement.textContent = "Les paramètres ne doivent pas être utilisés sans session active. Redirection vers la page compte."
    return
  }

  const session = sessionPayload.session
  identityElement.textContent = `${session.email || "Compte inconnu"} (${session.accountType || "type non renseigné"})`
  detailsElement.textContent = `Rôle : ${session.role || "non renseigné"} | Statut : ${session.status || "inconnu"} | Version : ${session.productVersion || "base"}`
}

async function refreshSessionStateOrRedirect() {
  const activeSession = await loadActiveSession()
  renderActiveSession(activeSession)

  if (!activeSession?.accountActive || !activeSession.session) {
    clearLocalAccountState(activeSession)
    window.location.replace("/frontend/account.html")
    return null
  }

  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(activeSession.session))
  } catch (_) {
    // Rien de bloquant.
  }

  return activeSession
}

function getPreferredAudioInputDevice(devices = []) {
  if (!Array.isArray(devices) || !devices.length) {
    return null
  }

  const virtualPattern = /(teams|virtual|blackhole|loopback|aggregate|zoomaudio|zoom audio|obs|cable|vb-audio)/i
  const physicalDevice = devices.find((device) => !virtualPattern.test(device.label || ""))
  return physicalDevice || devices[0]
}

async function populateAudioInputDevices({ preserveCurrentSelection = true } = {}) {
  const deviceSelect = document.getElementById(SETTINGS_FIELD_IDS.audioInputDeviceId)
  if (!deviceSelect || !navigator.mediaDevices?.enumerateDevices) {
    return
  }

  const storedSettings = getStoredSettings()
  const previousValue = preserveCurrentSelection ? deviceSelect.value || storedSettings.audioInputDeviceId || "" : ""

  try {
    let temporaryStream = null
    try {
      temporaryStream = await navigator.mediaDevices.getUserMedia({ audio: true })
    } catch (_) {
      // On tente quand meme enumerateDevices, meme sans labels complets.
    }

    const devices = await navigator.mediaDevices.enumerateDevices()
    temporaryStream?.getTracks().forEach((track) => track.stop())

    const audioInputs = devices.filter((device) => device.kind === "audioinput")
    const preferredDevice = getPreferredAudioInputDevice(audioInputs)

    deviceSelect.innerHTML = ""

    const autoOption = document.createElement("option")
    autoOption.value = ""
    autoOption.textContent = preferredDevice
      ? `Automatique (prefere : ${preferredDevice.label || "micro principal"})`
      : "Automatique"
    deviceSelect.appendChild(autoOption)

    audioInputs.forEach((device, index) => {
      const option = document.createElement("option")
      option.value = device.deviceId
      option.textContent = device.label || `Microphone ${index + 1}`
      deviceSelect.appendChild(option)
    })

    const nextValue = audioInputs.some((device) => device.deviceId === previousValue) ? previousValue : ""
    deviceSelect.value = nextValue
  } catch (_) {
    deviceSelect.innerHTML = ""
    const option = document.createElement("option")
    option.value = ""
    option.textContent = "Micro indisponible ou non autorise"
    deviceSelect.appendChild(option)
    deviceSelect.value = ""
  }
}

function getStoredSettings() {
  try {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
    const storedSettings = JSON.parse(localStorage.getItem(getSessionStorageKey(SETTINGS_STORAGE_KEY)) || "{}")

    return {
      ...DEFAULT_SETTINGS,
      ...storedSettings,
      theme: storedTheme || storedSettings.theme || DEFAULT_SETTINGS.theme
    }
  } catch (_) {
    return {
      ...DEFAULT_SETTINGS,
      theme: localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_SETTINGS.theme
    }
  }
}

function saveSettings(settings) {
  localStorage.setItem(getSessionStorageKey(SETTINGS_STORAGE_KEY), JSON.stringify(settings))
}

function setFormFeedback(element, message, tone = "info") {
  if (!element) return
  element.textContent = message
  element.classList.remove("is-info", "is-success", "is-error")
  element.classList.add("form-feedback", `is-${tone}`)
}

function getProviderApiClient() {
  return window.ProviderApiClient || null
}

async function loadServerPreferences() {
  const api = getProviderApiClient()
  if (!api) {
    return null
  }

  try {
    const result = await api.fetchPreferences()
    return result.preferences || null
  } catch (_) {
    return null
  }
}

async function saveServerPreferences(partialPreferences) {
  const api = getProviderApiClient()
  if (!api) {
    return null
  }

  return api.savePreferences(partialPreferences)
}

async function loadProviderAccounts() {
  const api = getProviderApiClient()
  if (!api) {
    return []
  }

  const result = await api.fetchProviderAccounts()
  return Array.isArray(result.providers) ? result.providers : []
}

async function loadUsageSummary() {
  const api = getProviderApiClient()
  if (!api) {
    return null
  }

  const result = await api.fetchUsageSummary()
  return result.summary || null
}

function getProviderUiConfig(providerType) {
  const map = {
    deepgram: {
      inputId: "deepgramApiKeyInput",
      defaultToggleId: "deepgramDefaultToggle",
      feedbackId: "deepgramProviderFeedback",
      saveButtonId: "deepgramSaveProviderBtn",
      testButtonId: "deepgramTestProviderBtn",
      label: "Deepgram"
    },
    assemblyai: {
      inputId: "assemblyaiApiKeyInput",
      defaultToggleId: "assemblyaiDefaultToggle",
      feedbackId: "assemblyaiProviderFeedback",
      saveButtonId: "assemblyaiSaveProviderBtn",
      testButtonId: "assemblyaiTestProviderBtn",
      label: "AssemblyAI"
    },
    "deepseek-api": {
      inputId: "deepseekApiKeyInput",
      defaultToggleId: "deepseekDefaultToggle",
      feedbackId: "deepseekProviderFeedback",
      saveButtonId: "deepseekSaveProviderBtn",
      testButtonId: "deepseekTestProviderBtn",
      label: "DeepSeek API"
    },
    "mistral-api": {
      inputId: "mistralApiKeyInput",
      defaultToggleId: "mistralDefaultToggle",
      feedbackId: "mistralProviderFeedback",
      saveButtonId: "mistralSaveProviderBtn",
      testButtonId: "mistralTestProviderBtn",
      label: "Mistral API"
    }
  }

  return map[providerType]
}

function renderProviderFeedback(providerType, message, tone = "info") {
  const config = getProviderUiConfig(providerType)
  setFormFeedback(document.getElementById(config.feedbackId), message, tone)
}

function renderProviderAccounts(providers = []) {
  const providerTypes = ["deepgram", "assemblyai", "deepseek-api", "mistral-api"]

  providerTypes.forEach((providerType) => {
    const config = getProviderUiConfig(providerType)
    const provider = providers.find((item) => item.providerType === providerType && item.status !== "inactive")
    const input = document.getElementById(config.inputId)
    const toggle = document.getElementById(config.defaultToggleId)

    if (input) {
      input.value = ""
      input.placeholder = provider?.apiKeyMasked || `Coller la clé ${config.label}`
    }

    if (toggle) {
      toggle.checked = Boolean(provider?.isDefault)
    }

    if (provider) {
      renderProviderFeedback(
        providerType,
        `${config.label} configuré${provider.isDefault ? " (par défaut)" : ""}. Statut : ${provider.status}.`,
        provider.status === "active" ? "success" : "info"
      )
    } else {
      renderProviderFeedback(providerType, `${config.label} non configuré.`, "info")
    }
  })
}

function renderUsageSummary(summary) {
  const target = document.getElementById("providerUsageSummary")
  if (!target) return

  if (!summary || !Array.isArray(summary.providers) || summary.providers.length === 0) {
    target.textContent = "Aucune consommation enregistrée pour le moment."
    return
  }

  const formatMoney = (amount = 0, currency = "EUR") => {
    const numeric = Number(amount || 0)
    const decimals = numeric > 0 && numeric < 0.01 ? 4 : 2
    const symbol = String(currency || "EUR").toUpperCase() === "USD" ? "$" : "€"
    return `${numeric.toFixed(decimals).replace(".", ",")} ${symbol}`
  }

  const totalAmount = Number(summary.totalEstimatedCostAmount || (Number(summary.totalEstimatedCostCents || 0) / 100) || 0)
  const totalCurrency = summary.currency || "EUR"
  const providerLines = summary.providers.map((provider) => {
    const costAmount = Number(provider.estimatedCostAmount || (Number(provider.estimatedCostCents || 0) / 100) || 0)
    return `${provider.providerType} : ${formatMoney(costAmount, provider.currency || totalCurrency)}`
  })

  target.textContent = `Total estimé ce mois : ${formatMoney(totalAmount, totalCurrency)}. ${providerLines.join(" | ")}`
}

function buildProviderPayload(providerType) {
  const config = getProviderUiConfig(providerType)
  const input = document.getElementById(config.inputId)
  const toggle = document.getElementById(config.defaultToggleId)

  return {
    providerType,
    providerLabel: config.label,
    apiKey: input?.value?.trim() || "",
    isDefault: Boolean(toggle?.checked)
  }
}

function getPreferredTextProviderType() {
  if (document.getElementById("mistralDefaultToggle")?.checked) {
    return "mistral-api"
  }
  if (document.getElementById("deepseekDefaultToggle")?.checked) {
    return "deepseek-api"
  }
  return ""
}

function syncExclusiveTextProviderToggles(selectedProviderType = "") {
  const deepseekToggle = document.getElementById("deepseekDefaultToggle")
  const mistralToggle = document.getElementById("mistralDefaultToggle")

  if (selectedProviderType === "deepseek-api" && mistralToggle) {
    mistralToggle.checked = false
  }
  if (selectedProviderType === "mistral-api" && deepseekToggle) {
    deepseekToggle.checked = false
  }
}

async function saveProviderAccount(providerType) {
  const api = getProviderApiClient()
  if (!api) {
    return
  }

  const payload = buildProviderPayload(providerType)
  if (!payload.apiKey) {
    renderProviderFeedback(providerType, "Renseigne d'abord une clé API.", "error")
    return
  }

  renderProviderFeedback(providerType, "Enregistrement en cours...", "info")
  try {
    const existingProviders = await loadProviderAccounts()
    const existingProvider = existingProviders.find((item) => item.providerType === providerType && item.status !== "inactive")

    if (existingProvider?.id) {
      await api.updateProvider(existingProvider.id, payload)
    } else {
      await api.createProvider(payload)
    }

    const providers = await loadProviderAccounts()
    renderProviderAccounts(providers)
    renderProviderFeedback(providerType, "Fournisseur enregistré.", "success")
  } catch (error) {
    renderProviderFeedback(providerType, error.message || "Erreur d'enregistrement du fournisseur.", "error")
  }
}

async function testProviderAccount(providerType) {
  const api = getProviderApiClient()
  if (!api) {
    return
  }

  try {
    const providers = await loadProviderAccounts()
    const provider = providers.find((item) => item.providerType === providerType && item.status !== "inactive")
    if (!provider?.id) {
      renderProviderFeedback(providerType, "Enregistre d'abord ce fournisseur avant de le tester.", "error")
      return
    }

    renderProviderFeedback(providerType, "Test en cours...", "info")
    const result = await api.testProvider(provider.id)
    const refreshed = await loadProviderAccounts()
    renderProviderAccounts(refreshed)
    renderProviderFeedback(providerType, result.test?.message || "Test terminé.", result.ok ? "success" : "error")
  } catch (error) {
    renderProviderFeedback(providerType, error.message || "Erreur de test du fournisseur.", "error")
  }
}

function getCurrentSettings() {
  const settings = {}

  Object.entries(SETTINGS_FIELD_IDS).forEach(([key, elementId]) => {
    const element = document.getElementById(elementId)
    if (!element) return

    settings[key] = element.type === "checkbox" ? element.checked : element.value
  })

  settings.audioVoicePreferences = getAudioVoicePreferences()
  return settings
}

function hydrateForm(settings) {
  Object.entries(SETTINGS_FIELD_IDS).forEach(([key, elementId]) => {
    const element = document.getElementById(elementId)
    if (!element) return

    if (element.type === "checkbox") {
      element.checked = Boolean(settings[key])
      return
    }

    element.value = settings[key]
  })

  setAudioVoicePreferences(settings.audioVoicePreferences || {})
}

function normalizeAudioLanguage(language) {
  return String(language || "fr").trim().toLowerCase() || "fr"
}

function normalizeAudioRate(rate) {
  const parsed = Number(rate)
  return Number.isFinite(parsed) ? parsed.toFixed(2) : "0.95"
}

function getAudioVoicePreferences() {
  return settingsAudioVoicePreferences && typeof settingsAudioVoicePreferences === "object"
    ? { ...settingsAudioVoicePreferences }
    : {}
}

function setAudioVoicePreferences(preferences) {
  settingsAudioVoicePreferences = preferences && typeof preferences === "object"
    ? JSON.parse(JSON.stringify(preferences))
    : {}
}

function getAudioVoiceElements() {
  return {
    languageSelect: document.getElementById("audioVoiceLanguageSelect"),
    voiceSelect: document.getElementById("audioVoiceSelect"),
    rateSelect: document.getElementById("audioVoiceRateSelect"),
    testText: document.getElementById("audioVoiceTestText"),
    testButton: document.getElementById("audioVoiceTestButton"),
    saveButton: document.getElementById("audioVoiceSaveButton"),
    feedback: document.getElementById("audioVoiceFeedback")
  }
}

function getAudioVoiceTestText(language) {
  return AUDIO_TEST_TEXTS[normalizeAudioLanguage(language)] || AUDIO_TEST_TEXTS.fr
}

function getCurrentAudioVoiceLanguage() {
  const { languageSelect } = getAudioVoiceElements()
  return normalizeAudioLanguage(languageSelect?.value || "fr")
}

function getStoredAudioVoiceConfig(language) {
  const normalized = normalizeAudioLanguage(language)
  const preferences = getAudioVoicePreferences()
  const current = preferences[normalized] || {}
  return {
    voiceName: current.voiceName || "",
    voiceLang: current.voiceLang || "",
    rate: normalizeAudioRate(current.rate || "0.95")
  }
}


function buildAudioVoiceOptionValue(voiceName = "", voiceLang = "") {
  return `${voiceName}|||${voiceLang}`
}

function parseAudioVoiceOptionValue(value = "") {
  const [voiceName = "", voiceLang = ""] = String(value || "").split("|||")
  return { voiceName, voiceLang }
}

function isFantasyAudioVoice(voice) {
  const label = `${voice?.name || ""} ${voice?.lang || ""}`
  return AUDIO_FANTASY_VOICE_PATTERNS.some((pattern) => pattern.test(label))
}

function getLanguageVoiceCandidates(language) {
  if (!("speechSynthesis" in window)) {
    return []
  }

  const normalized = normalizeAudioLanguage(language)
  const preferredLocales = AUDIO_LANGUAGE_TO_LOCALE[normalized] || [`${normalized}-${normalized.toUpperCase()}`]
  const voices = window.speechSynthesis.getVoices() || []
  const matching = voices.filter((voice) => {
    const voiceLang = String(voice?.lang || "").toLowerCase()
    return preferredLocales.some((locale) => voiceLang === locale.toLowerCase()) || voiceLang.startsWith(`${normalized}-`) || voiceLang === normalized
  })

  const natural = matching.filter((voice) => !isFantasyAudioVoice(voice))
  const source = natural.length ? natural : matching
  return [...source].sort((left, right) => {
    const leftScore = (left.localService ? 1 : 0)
    const rightScore = (right.localService ? 1 : 0)
    if (rightScore !== leftScore) return rightScore - leftScore
    return String(left.name || "").localeCompare(String(right.name || ""), "fr")
  })
}

function ensureSettingsVoicesReady() {
  if (!("speechSynthesis" in window)) {
    return Promise.resolve([])
  }

  const immediate = window.speechSynthesis.getVoices() || []
  if (immediate.length) {
    return Promise.resolve(immediate)
  }

  return new Promise((resolve) => {
    let settled = false
    const finalize = () => {
      if (settled) return
      settled = true
      resolve(window.speechSynthesis.getVoices() || [])
    }
    const previous = window.speechSynthesis.onvoiceschanged
    window.speechSynthesis.onvoiceschanged = () => {
      if (typeof previous === "function") previous()
      finalize()
      window.speechSynthesis.onvoiceschanged = previous
    }
    window.setTimeout(finalize, 700)
  })
}

function resolveSelectedAudioVoice(language, voiceName = "", voiceLang = "") {
  const voices = getLanguageVoiceCandidates(language)
  const exact = voices.find((voice) => voice.name === voiceName && (!voiceLang || voice.lang === voiceLang))
  return {
    voice: exact || voices[0] || null,
    voices
  }
}

function populateAudioVoiceSelect(language) {
  const { voiceSelect } = getAudioVoiceElements()
  if (!voiceSelect) return []

  const config = getStoredAudioVoiceConfig(language)
  const { voice, voices } = resolveSelectedAudioVoice(language, config.voiceName, config.voiceLang)
  voiceSelect.innerHTML = ""

  if (!voices.length) {
    const option = document.createElement("option")
    option.value = ""
    option.textContent = "Aucune voix compatible detectee"
    voiceSelect.appendChild(option)
    return []
  }

  voices.forEach((entry) => {
    const option = document.createElement("option")
    option.value = buildAudioVoiceOptionValue(entry.name || "", entry.lang || "")
    option.textContent = `${entry.name || "Voix sans nom"} (${entry.lang || "langue inconnue"})${entry.localService ? " - locale" : ""}`
    option.dataset.voiceName = entry.name || ""
    option.dataset.voiceLang = entry.lang || ""
    voiceSelect.appendChild(option)
  })

  voiceSelect.value = voice ? buildAudioVoiceOptionValue(voice.name || "", voice.lang || "") : ""
  return voices
}

function renderAudioVoiceConfigurator(language = getCurrentAudioVoiceLanguage()) {
  const normalized = normalizeAudioLanguage(language)
  const { languageSelect, rateSelect, testText, feedback } = getAudioVoiceElements()
  const config = getStoredAudioVoiceConfig(normalized)

  if (languageSelect) languageSelect.value = normalized
  populateAudioVoiceSelect(normalized)
  if (rateSelect) rateSelect.value = normalizeAudioRate(config.rate || "0.95")
  if (testText && !testText.dataset.userEdited) {
    testText.value = getAudioVoiceTestText(normalized)
  }
  if (feedback) {
    setFormFeedback(feedback, `Configuration en cours pour ${AUDIO_VOICE_LANGUAGE_OPTIONS.find((item) => item.value === normalized)?.label || normalized}.`, "info")
  }
}

function collectAudioVoiceConfigFromForm(language = getCurrentAudioVoiceLanguage()) {
  const normalized = normalizeAudioLanguage(language)
  const { voiceSelect, rateSelect, testText } = getAudioVoiceElements()
  const selectedOption = voiceSelect?.selectedOptions?.[0] || null
  const parsed = parseAudioVoiceOptionValue(voiceSelect?.value || "")
  return {
    language: normalized,
    voiceName: selectedOption?.dataset?.voiceName || parsed.voiceName || "",
    voiceLang: selectedOption?.dataset?.voiceLang || parsed.voiceLang || "",
    rate: normalizeAudioRate(rateSelect?.value || "0.95"),
    testText: (testText?.value || getAudioVoiceTestText(normalized)).trim()
  }
}

async function saveAudioVoiceConfiguration() {
  const { feedback } = getAudioVoiceElements()
  await ensureSettingsVoicesReady()
  const config = collectAudioVoiceConfigFromForm()
  const { voice } = resolveSelectedAudioVoice(config.language, config.voiceName, config.voiceLang)

  if (!voice) {
    setFormFeedback(feedback, "Aucune voix valide a enregistrer pour cette langue.", "error")
    return
  }

  const nextPreferences = getAudioVoicePreferences()
  nextPreferences[config.language] = {
    voiceName: voice.name || "",
    voiceLang: voice.lang || "",
    rate: config.rate
  }
  setAudioVoicePreferences(nextPreferences)
  saveSettings(getCurrentSettings())
  renderAudioVoiceConfigurator(config.language)
  if (feedback) {
    setFormFeedback(feedback, `Voix enregistree pour ${AUDIO_VOICE_LANGUAGE_OPTIONS.find((item) => item.value === config.language)?.label || config.language} : ${voice.name} (${voice.lang}).`, "success")
  }
}

async function testSelectedAudioVoice() {
  const { feedback } = getAudioVoiceElements()
  if (!("speechSynthesis" in window)) {
    setFormFeedback(feedback, "Lecture audio indisponible sur ce navigateur.", "error")
    return
  }

  await ensureSettingsVoicesReady()
  const config = collectAudioVoiceConfigFromForm()
  const { voice } = resolveSelectedAudioVoice(config.language, config.voiceName, config.voiceLang)

  if (!voice) {
    setFormFeedback(feedback, "Aucune voix disponible pour cette langue.", "error")
    return
  }

  const utterance = new SpeechSynthesisUtterance(config.testText || getAudioVoiceTestText(config.language))
  utterance.lang = voice.lang || config.voiceLang || (AUDIO_LANGUAGE_TO_LOCALE[config.language]?.[0] || `${config.language}-${config.language.toUpperCase()}`)
  utterance.voice = voice
  utterance.rate = Number(config.rate || "0.95")
  utterance.onstart = () => {
    setFormFeedback(feedback, `Test en cours avec ${voice.name} (${voice.lang}).`, "info")
  }
  utterance.onend = () => {
    setFormFeedback(feedback, `Test termine avec ${voice.name} (${voice.lang}).`, "success")
  }
  utterance.onerror = () => {
    setFormFeedback(feedback, "La lecture audio du test a echoue.", "error")
  }

  window.speechSynthesis.cancel()
  window.speechSynthesis.resume()
  window.setTimeout(() => {
    window.speechSynthesis.speak(utterance)
  }, 40)
}

async function initializeAudioVoiceSettings(settings) {
  setAudioVoicePreferences(settings.audioVoicePreferences || {})
  const { languageSelect, voiceSelect, testButton, saveButton, testText, feedback } = getAudioVoiceElements()
  await ensureSettingsVoicesReady()
  renderAudioVoiceConfigurator(languageSelect?.value || "fr")

  languageSelect?.addEventListener("change", async () => {
    if (testText) {
      testText.dataset.userEdited = ""
    }
    await ensureSettingsVoicesReady()
    renderAudioVoiceConfigurator(languageSelect.value)
  })

  voiceSelect?.addEventListener("change", () => {
    const option = voiceSelect.selectedOptions?.[0]
    if (feedback && option?.value) {
      setFormFeedback(feedback, `Voix selectionnee : ${option.value} (${option.dataset.voiceLang || "langue inconnue"}).`, "info")
    }
  })

  testText?.addEventListener("input", () => {
    testText.dataset.userEdited = testText.value.trim() ? "true" : ""
  })

  testButton?.addEventListener("click", testSelectedAudioVoice)
  saveButton?.addEventListener("click", saveAudioVoiceConfiguration)
}

function syncSidebarTheme(settings) {
  const sidebarThemeSelect = document.getElementById("themeSelect")
  if (sidebarThemeSelect) {
    sidebarThemeSelect.value = settings.theme
  }
}

function getPreviewElements() {
  return {
    previewModal: document.getElementById("previewModal"),
    previewBackdrop: document.getElementById("previewBackdrop"),
    openPreviewBtn: document.getElementById("openPreviewBtn"),
    closePreviewBtn: document.getElementById("closePreviewBtn"),
    previewSurface: document.getElementById("previewSurface"),
    previewPrimaryButton: document.getElementById("previewPrimaryButton"),
    previewGenerateButton: document.getElementById("previewGenerateButton"),
    previewAlternateButton: document.getElementById("previewAlternateButton"),
    previewContextLabel: document.getElementById("previewContextLabel"),
    previewHeading: document.getElementById("previewHeading"),
    previewBadges: document.getElementById("previewBadges"),
    previewSourceLabel: document.getElementById("previewSourceLabel"),
    previewInputModelSelect: document.getElementById("previewInputModelSelect"),
    previewSourceContent: document.getElementById("previewSourceContent"),
    previewDraftLabel: document.getElementById("previewDraftLabel"),
    previewOutputModelSelect: document.getElementById("previewOutputModelSelect"),
    previewSummaryText: document.getElementById("previewSummaryText"),
    previewAssistanceList: document.getElementById("previewAssistanceList"),
    previewDraftContent: document.getElementById("previewDraftContent"),
    previewDraftProgressControls: document.getElementById("previewDraftProgressControls"),
    previewDraftPrevStepButton: document.getElementById("previewDraftPrevStepButton"),
    previewDraftNextStepButton: document.getElementById("previewDraftNextStepButton"),
    previewDraftStepIndicator: document.getElementById("previewDraftStepIndicator"),
    previewDraftSoundToggle: document.getElementById("previewDraftSoundToggle"),
    previewSpeakDraftButton: document.getElementById("previewSpeakDraftButton"),
    previewStopDraftAudioButton: document.getElementById("previewStopDraftAudioButton"),
    previewDraftPauseButton: document.getElementById("previewDraftPauseButton"),
    previewDraftResumeButton: document.getElementById("previewDraftResumeButton"),
    previewProgressControls: document.getElementById("previewProgressControls"),
    previewPrevStepButton: document.getElementById("previewPrevStepButton"),
    previewNextStepButton: document.getElementById("previewNextStepButton"),
    previewStepIndicator: document.getElementById("previewStepIndicator"),
    previewInputSoundToggle: document.getElementById("previewInputSoundToggle"),
    previewSpeakInputButton: document.getElementById("previewSpeakInputButton"),
    previewStopInputAudioButton: document.getElementById("previewStopInputAudioButton"),
    previewPauseButton: document.getElementById("previewPauseButton"),
    previewResumeButton: document.getElementById("previewResumeButton"),
    previewScrollTestButton: document.getElementById("previewScrollTestButton"),
    previewStatusBadge: document.getElementById("previewStatusBadge"),
    previewThemeLabel: document.getElementById("previewThemeLabel"),
    previewFontLabel: document.getElementById("previewFontLabel"),
    previewTextLabel: document.getElementById("previewTextLabel"),
    previewSpacingLabel: document.getElementById("previewSpacingLabel"),
    previewWidthLabel: document.getElementById("previewWidthLabel"),
    previewButtonsLabel: document.getElementById("previewButtonsLabel"),
    previewBehaviorList: document.getElementById("previewBehaviorList")
  }
}

function updatePreviewStatusBadge(settings) {
  const { previewStatusBadge } = getPreviewElements()
  if (!previewStatusBadge) return

  previewStatusBadge.classList.remove("status-manual", "status-running", "status-paused")

  if (!settings.progressiveReading) {
    previewStatusBadge.textContent = "Lecture manuelle"
    previewStatusBadge.classList.add("status-manual")
    return
  }

  if (automaticReadingPaused) {
    previewStatusBadge.textContent = "Lecture en pause"
    previewStatusBadge.classList.add("status-paused")
    return
  }

  previewStatusBadge.textContent = "Lecture automatique en cours"
  previewStatusBadge.classList.add("status-running")
}

function formatModelLabel(model) {
  const labels = {
    "mistral-api": "Mistral API",
    "deepseek-chat": "DeepSeek chat",
    "deepseek-reasoner": "DeepSeek reasoner"
  }

  return labels[model] || model
}

function updateSoundToggleButtons() {
  const { previewInputSoundToggle, previewDraftSoundToggle } = getPreviewElements()

  const applyState = (button, enabled) => {
    if (!button) return
    button.classList.toggle("sound-on", enabled)
    button.classList.toggle("sound-off", !enabled)
    button.setAttribute("aria-pressed", enabled ? "true" : "false")
  }

  applyState(previewInputSoundToggle, inputAudioEnabled)
  applyState(previewDraftSoundToggle, draftAudioEnabled)
}

function getPreviewAudioLanguage() {
  return getCurrentAudioVoiceLanguage()
}

function getConfiguredPreviewVoice(language) {
  const config = getStoredAudioVoiceConfig(language)
  const candidates = getLanguageVoiceCandidates(language)
  const exact = candidates.find((voice) => voice.name === config.voiceName && (!config.voiceLang || voice.lang === config.voiceLang))
  const sameName = candidates.find((voice) => voice.name === config.voiceName)
  return {
    voice: exact || sameName || candidates[0] || null,
    rate: Number(config.rate || "0.95")
  }
}

function speakTextFromElement(element, target) {
  if (!element || !("speechSynthesis" in window)) {
    return
  }

  const text = element.innerText.trim()
  if (!text) {
    return
  }

  const language = getPreviewAudioLanguage()
  const configured = getConfiguredPreviewVoice(language)
  const locale = configured.voice?.lang || (AUDIO_LANGUAGE_TO_LOCALE[language]?.[0] || `${language}-${language.toUpperCase()}`)

  audioStartedByUser = true
  activeAudioTarget = target
  window.speechSynthesis.cancel()
  window.speechSynthesis.resume()
  previewSpeechUtterance = new SpeechSynthesisUtterance(text)
  previewSpeechUtterance.lang = locale
  previewSpeechUtterance.rate = configured.rate || 0.95

  if (configured.voice) {
    previewSpeechUtterance.voice = configured.voice
  }

  previewSpeechUtterance.onboundary = (event) => {
    if (typeof event.charIndex === "number") {
      updateWordFromBoundary(event.charIndex, target, element)
    }
  }

  previewSpeechUtterance.onend = () => {
    if (target === "input" && inputAudioEnabled) {
      const settings = getCurrentSettings()
      const steps = getProgressiveSteps(settings)
      if (currentPreviewStepIndex < steps.length - 1) {
        currentPreviewStepIndex += 1
        currentPreviewWordIndex = 0
        applyPreview(settings)
        startInputReadingWithAudio()
      }
    }

    if (target === "draft" && draftAudioEnabled) {
      const settings = getCurrentSettings()
      const variant = PREVIEW_CASE.draftVariants[currentVariantIndex]
      const stepSize = settings.contentStep === "unlimited" ? variant.paragraphs.length : Math.max(1, Number(settings.contentStep))
      const totalSteps = Math.ceil(variant.paragraphs.length / stepSize)
      if (currentDraftStepIndex < totalSteps - 1) {
        currentDraftStepIndex += 1
        currentDraftWordIndex = 0
        applyPreview(settings)
        startDraftReadingWithAudio()
      }
    }
  }

  window.setTimeout(() => {
    window.speechSynthesis.speak(previewSpeechUtterance)
  }, 40)
}

function stopPreviewSpeech() {
  if ("speechSynthesis" in window) {
    window.speechSynthesis.cancel()
  }

  previewSpeechUtterance = null
  audioStartedByUser = false
  activeAudioTarget = null
}

function toggleInputSound() {
  if (inputAudioEnabled) {
    stopInputAudioMode()
    return
  }

  inputAudioEnabled = true
  draftAudioEnabled = false
  stopPreviewSpeech()
  updateSoundToggleButtons()
}

function toggleDraftSound() {
  if (draftAudioEnabled) {
    stopDraftAudioMode()
    return
  }

  draftAudioEnabled = true
  inputAudioEnabled = false
  stopPreviewSpeech()
  updateSoundToggleButtons()
}

function stopInputAudioMode() {
  inputAudioEnabled = false
  updateSoundToggleButtons()
  stopPreviewSpeech()
  automaticReadingPaused = false
  updatePreviewStatusBadge(getCurrentSettings())
  startAutomaticPreviewReading()
}

function stopDraftAudioMode() {
  draftAudioEnabled = false
  updateSoundToggleButtons()
  stopPreviewSpeech()
  automaticDraftReadingPaused = false
  startAutomaticDraftReading()
}

function pausePreviewSpeech() {
  if (
    audioStartedByUser &&
    "speechSynthesis" in window &&
    window.speechSynthesis.speaking &&
    !window.speechSynthesis.paused
  ) {
    window.speechSynthesis.pause()
  }
}

function resumePreviewSpeech() {
  if (audioStartedByUser && "speechSynthesis" in window && window.speechSynthesis.paused) {
    window.speechSynthesis.resume()
  }
}

function getInputBlocks(settings) {
  if (settings.defaultMode === "creation") {
    return [
      {
        title: "Objectif",
        paragraphs: [
          "Vous préparez un nouveau mail à destination du service d’accompagnement afin de demander un rendez-vous et de clarifier les justificatifs attendus."
        ]
      },
      {
        title: "Contraintes",
        paragraphs: [
          "Le message doit rester simple, compréhensible et rapide à valider. Il doit rappeler le besoin principal sans surcharge d’informations."
        ]
      },
      {
        title: "Attendu",
        paragraphs: [
          "L’objectif final est d’obtenir une réponse brève, explicite et facilement validable avant envoi."
        ]
      }
    ]
  }

  return PREVIEW_CASE.sourceBlocks
}

function getVisibleUnitCount(settings) {
  if (settings.contentStep === "unlimited") {
    return Number.POSITIVE_INFINITY
  }

  return Number(settings.contentStep)
}

function buildParagraphSteps(stepSize) {
  const flattened = PREVIEW_CASE.sourceBlocks.flatMap((block) =>
    block.paragraphs.map((paragraph) => ({
      title: block.title,
      paragraphs: [paragraph]
    }))
  )

  const steps = []

  for (let index = 0; index < flattened.length; index += stepSize) {
    const chunk = flattened.slice(index, index + stepSize)
    const grouped = []

    chunk.forEach((entry) => {
      const existing = grouped.find((item) => item.title === entry.title)
      if (existing) {
        existing.paragraphs.push(...entry.paragraphs)
      } else {
        grouped.push({ ...entry })
      }
    })

    steps.push(grouped)
  }

  return steps
}

function getProgressiveSteps(settings) {
  const visibleUnits = getVisibleUnitCount(settings)
  const sourceBlocks = getInputBlocks(settings)

  if (!Number.isFinite(visibleUnits)) {
    return [sourceBlocks]
  }

  const flattened = sourceBlocks.flatMap((block) =>
    block.paragraphs.map((paragraph) => ({
      title: block.title,
      paragraphs: [paragraph]
    }))
  )

  const steps = []

  for (let index = 0; index < flattened.length; index += visibleUnits) {
    const chunk = flattened.slice(index, index + visibleUnits)
    const grouped = []

    chunk.forEach((entry) => {
      const existing = grouped.find((item) => item.title === entry.title)
      if (existing) {
        existing.paragraphs.push(...entry.paragraphs)
      } else {
        grouped.push({ ...entry })
      }
    })

    steps.push(grouped)
  }

  return steps
}

function createPreviewParagraph(text) {
  const paragraph = document.createElement("p")
  paragraph.className = "settings-preview-text"
  paragraph.dataset.previewParagraph = "true"
  paragraph.dataset.previewText = text
  paragraph.textContent = text
  return paragraph
}

function clearPreviewTimer() {
  if (previewTimerId) {
    window.clearTimeout(previewTimerId)
    previewTimerId = null
  }
}

function clearDraftTimer() {
  if (draftTimerId) {
    window.clearTimeout(draftTimerId)
    draftTimerId = null
  }
}

function updatePreviewWordHighlight(previewSourceContent) {
  const wordElements = previewSourceContent?.querySelectorAll(".preview-word")
  if (!wordElements?.length) return

  wordElements.forEach((element) => element.classList.remove("active-word"))
  const activeElement = wordElements[currentPreviewWordIndex]
  activeElement?.classList.add("active-word")
}

function buildWordBoundaries(element) {
  const words = Array.from(element.querySelectorAll(".preview-word"))
  let cursor = 0

  return words.map((word, index) => {
    const start = cursor
    cursor += word.textContent.length + 1
    return { start, index }
  })
}

function updateWordFromBoundary(charIndex, target, element) {
  const boundaries = buildWordBoundaries(element)
  let matchedIndex = 0

  boundaries.forEach((entry) => {
    if (charIndex >= entry.start) {
      matchedIndex = entry.index
    }
  })

  if (target === "input") {
    currentPreviewWordIndex = matchedIndex
    updatePreviewWordHighlight(element)
  } else {
    currentDraftWordIndex = matchedIndex
    updateDraftWordHighlight(element)
  }
}

function getCurrentParagraphStartIndex() {
  const activeWord = previewWordMeta[currentPreviewWordIndex]
  if (!activeWord) return 0

  const paragraphWords = previewWordMeta.filter((word) => word.paragraphIndex === activeWord.paragraphIndex)
  return paragraphWords.length ? paragraphWords[0].wordIndex : 0
}

function renderInteractiveWords(previewSourceContent) {
  previewWordMeta = []

  const paragraphs = previewSourceContent.querySelectorAll("[data-preview-paragraph='true']")
  let globalWordIndex = 0

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const text = paragraph.dataset.previewText || paragraph.textContent || ""
    const words = text.split(/\s+/).filter(Boolean)

    paragraph.innerHTML = ""

    words.forEach((word, wordIndexInParagraph) => {
      const wordSpan = document.createElement("span")
      wordSpan.className = "preview-word"
      wordSpan.textContent = word
      wordSpan.dataset.wordIndex = String(globalWordIndex)
      wordSpan.addEventListener("click", () => {
        currentPreviewWordIndex = Number(wordSpan.dataset.wordIndex)
        updatePreviewWordHighlight(previewSourceContent)
      })

      paragraph.appendChild(wordSpan)

      if (wordIndexInParagraph < words.length - 1) {
        paragraph.appendChild(document.createTextNode(" "))
      }

      previewWordMeta.push({
        paragraphIndex,
        wordIndex: globalWordIndex
      })

      globalWordIndex += 1
    })
  })

  if (currentPreviewWordIndex >= previewWordMeta.length) {
    currentPreviewWordIndex = Math.max(previewWordMeta.length - 1, 0)
  }

  updatePreviewWordHighlight(previewSourceContent)
}

function updateDraftWordHighlight(previewDraftContent) {
  const wordElements = previewDraftContent?.querySelectorAll(".preview-word")
  if (!wordElements?.length) return

  wordElements.forEach((element) => element.classList.remove("active-word"))
  const activeElement = wordElements[currentDraftWordIndex]
  activeElement?.classList.add("active-word")
}

function getCurrentDraftParagraphStartIndex() {
  const activeWord = draftWordMeta[currentDraftWordIndex]
  if (!activeWord) return 0

  const paragraphWords = draftWordMeta.filter((word) => word.paragraphIndex === activeWord.paragraphIndex)
  return paragraphWords.length ? paragraphWords[0].wordIndex : 0
}

function renderInteractiveDraftWords(previewDraftContent) {
  draftWordMeta = []

  const paragraphs = previewDraftContent.querySelectorAll("[data-preview-paragraph='true']")
  let globalWordIndex = 0

  paragraphs.forEach((paragraph, paragraphIndex) => {
    const text = paragraph.dataset.previewText || paragraph.textContent || ""
    const words = text.split(/\s+/).filter(Boolean)

    paragraph.innerHTML = ""

    words.forEach((word, wordIndexInParagraph) => {
      const wordSpan = document.createElement("span")
      wordSpan.className = "preview-word"
      wordSpan.textContent = word
      wordSpan.dataset.wordIndex = String(globalWordIndex)
      wordSpan.addEventListener("click", () => {
        currentDraftWordIndex = Number(wordSpan.dataset.wordIndex)
        updateDraftWordHighlight(previewDraftContent)
      })

      paragraph.appendChild(wordSpan)

      if (wordIndexInParagraph < words.length - 1) {
        paragraph.appendChild(document.createTextNode(" "))
      }

      draftWordMeta.push({
        paragraphIndex,
        wordIndex: globalWordIndex
      })

      globalWordIndex += 1
    })
  })

  if (currentDraftWordIndex >= draftWordMeta.length) {
    currentDraftWordIndex = Math.max(draftWordMeta.length - 1, 0)
  }

  updateDraftWordHighlight(previewDraftContent)
}

function renderSourceContent(settings, previewSourceContent) {
  const progressiveReadingEnabled = Boolean(settings.progressiveReading) && settings.contentStep !== "unlimited"
  const sourceBlocks = getInputBlocks(settings)
  const steps = getProgressiveSteps(settings)
  const safeStepIndex = Math.min(currentPreviewStepIndex, Math.max(steps.length - 1, 0))
  const visibleBlocks = settings.contentStep === "unlimited" ? sourceBlocks : steps[safeStepIndex]
  previewSourceContent.innerHTML = ""

  visibleBlocks.forEach((block, index) => {
    const section = document.createElement("section")
    section.className = "settings-preview-subblock"

    const title = document.createElement("p")
    title.className = "settings-preview-subtitle"
    title.textContent = `${index + 1}. ${block.title}`
    section.appendChild(title)

    block.paragraphs.forEach((paragraph) => {
      section.appendChild(createPreviewParagraph(paragraph))
    })

    previewSourceContent.appendChild(section)
  })

  renderInteractiveWords(previewSourceContent)

  return {
    totalSteps: settings.contentStep === "unlimited" ? 1 : steps.length,
    currentStep: settings.contentStep === "unlimited" ? 1 : safeStepIndex + 1,
    progressiveReadingEnabled,
    manualProgressionEnabled: settings.contentStep !== "unlimited"
  }
}

function renderDraftContent(settings, previewDraftContent) {
  const variant = PREVIEW_CASE.draftVariants[currentVariantIndex]
  const stepSize = settings.contentStep === "unlimited" ? variant.paragraphs.length : Math.max(1, Number(settings.contentStep))
  const draftSteps = []

  for (let index = 0; index < variant.paragraphs.length; index += stepSize) {
    draftSteps.push(variant.paragraphs.slice(index, index + stepSize))
  }

  const safeStepIndex = Math.min(currentDraftStepIndex, Math.max(draftSteps.length - 1, 0))
  const visibleParagraphs = settings.defaultLength === "detailed" ? draftSteps[safeStepIndex] : draftSteps[safeStepIndex]
  previewDraftContent.innerHTML = ""

  visibleParagraphs.forEach((paragraph) => {
    previewDraftContent.appendChild(createPreviewParagraph(paragraph))
  })

  renderInteractiveDraftWords(previewDraftContent)

  if (settings.comparisonEnabled) {
    const note = document.createElement("p")
    note.className = "settings-preview-note"
    note.textContent = `Version affichée : ton ${variant.tone.toLowerCase()}, longueur ${variant.length.toLowerCase()}.`
    previewDraftContent.appendChild(note)
  }

  return {
    totalSteps: draftSteps.length,
    currentStep: safeStepIndex + 1,
    manualProgressionEnabled: settings.contentStep !== "unlimited"
  }
}

function renderAiSummary(settings, previewSummaryText, previewAssistanceList) {
  if (previewSummaryText) {
    previewSummaryText.textContent = settings.defaultMode === "creation"
      ? `Le LLM de sortie ${formatModelLabel(previewOutputModel)} prépare un objectif de message, une structure de rédaction et une formulation adaptée au ton choisi.`
      : `Le LLM de sortie ${formatModelLabel(previewOutputModel)} résume la demande, identifie les points à confirmer et propose une réponse rédigée selon le ton et la longueur attendus.`
  }

  if (!previewAssistanceList) {
    return
  }

  const assistanceItems = {
    suggestion: [
      "Brouillon simple",
      "Ton et longueur appliqués",
      "Pas d’aide complémentaire"
    ],
    active: [
      "Résumé IA visible",
      "Brouillon proposé",
      "Suggestion de ton et de longueur"
    ],
    advanced: [
      "Résumé IA visible",
      "Brouillon proposé",
      "Classification et priorité rappelées",
      "Conseil d’action avant validation"
    ]
  }

  previewAssistanceList.innerHTML = (assistanceItems[settings.assistanceLevel] || assistanceItems.active)
    .map((item) => `<li>${item}</li>`)
    .join("")
}

function renderPreviewBadges(settings, previewBadges) {
  const variant = PREVIEW_CASE.draftVariants[currentVariantIndex]
  const badges = [
    settings.defaultMode === "creation" ? "Création simulée" : "Réponse simulée",
    settings.showClassification ? "Classification visible" : "Classification masquée",
    settings.showPriority ? "Priorité visible" : "Priorité masquée",
    `LLM entrée : ${formatModelLabel(previewInputModel)}`,
    `LLM sortie : ${formatModelLabel(previewOutputModel)}`,
    `Ton : ${variant.tone}`,
    `Longueur : ${variant.length}`
  ]

  previewBadges.innerHTML = badges
    .map((badge) => `<span class="settings-preview-badge">${badge}</span>`)
    .join("")
}

function renderBehaviorList(settings, previewBehaviorList) {
  const behaviors = [
    `Défilement : ${labelFromValue(settings.scrollSpeed)}`,
    `Lecture progressive : ${settings.progressiveReading ? "Activée" : "Désactivée"}`,
    `Unité de progression : ${settings.progressUnit} ms/mot`,
    `Quantité par étape : ${settings.contentStep === "unlimited" ? "Illimitée" : `${settings.contentStep} paragraphe(s)`}`,
    `Analyse entrée : ${formatModelLabel(previewInputModel)}`,
    `Génération sortie : ${formatModelLabel(previewOutputModel)}`,
    `Pièces jointes : ${labelFromValue(settings.attachmentsMode)}`,
    `Brouillon automatique : ${settings.autoDraft ? "Oui" : "Non"}`,
    `Validation avant envoi : ${settings.validationRequired ? "Oui" : "Non"}`,
    `Simulation d'envoi : ${settings.simulationEnabled ? "Oui" : "Non"}`,
    `Audio : ${settings.audioOption ? "Prévu / activé" : "Non activé"}`,
    `Traduction : ${settings.translationActionsEnabled ? "Affichée" : "Masquée"}`,
    `Résumé : ${settings.summaryActionsEnabled ? "Affiché" : "Masqué"}`,
    `Reformulation : ${settings.rephraseActionsEnabled ? "Affichée" : "Masquée"}`,
    `Langue cible des traductions : ${labelFromValue(settings.translationTargetLanguage)}`
  ]

  previewBehaviorList.innerHTML = behaviors
    .map((behavior) => `<li>${behavior}</li>`)
    .join("")
}

function applyPreview(settings) {
  const {
    previewSurface,
    previewPrimaryButton,
    previewGenerateButton,
    previewAlternateButton,
    previewContextLabel,
    previewHeading,
    previewBadges,
    previewSourceLabel,
    previewInputModelSelect,
    previewSourceContent,
    previewDraftLabel,
    previewOutputModelSelect,
    previewSummaryText,
    previewAssistanceList,
    previewDraftContent,
    previewDraftProgressControls,
    previewDraftPrevStepButton,
    previewDraftNextStepButton,
    previewDraftStepIndicator,
    previewDraftPauseButton,
    previewDraftResumeButton,
    previewProgressControls,
    previewPrevStepButton,
    previewNextStepButton,
    previewStepIndicator,
    previewPauseButton,
    previewResumeButton,
    previewScrollTestButton,
    previewThemeLabel,
    previewFontLabel,
    previewTextLabel,
    previewSpacingLabel,
    previewWidthLabel,
    previewButtonsLabel,
    previewBehaviorList
  } = getPreviewElements()

  if (!previewSurface || !previewPrimaryButton) {
    return
  }

  previewSurface.setAttribute("data-theme", settings.theme)
  previewSurface.style.fontFamily = `"${settings.fontFamily}", sans-serif`
  previewSurface.style.setProperty("--preview-text-size", sizeMap[settings.fontSize])
  previewSurface.style.setProperty("--preview-line-height", spacingMap[settings.lineSpacing])
  previewSurface.style.setProperty("--preview-width", widthMap[settings.readingWidth])
  previewPrimaryButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  previewPrimaryButton.style.padding = settings.buttonSize === "extra-large" ? "18px 28px" : settings.buttonSize === "large" ? "16px 24px" : "14px 20px"
  if (previewGenerateButton) {
    previewGenerateButton.style.fontSize = buttonSizeMap[settings.buttonSize]
    previewGenerateButton.style.padding = settings.buttonSize === "extra-large" ? "18px 28px" : settings.buttonSize === "large" ? "16px 24px" : "14px 20px"
  }
  if (previewInputModelSelect) {
    previewInputModelSelect.value = previewInputModel
  }
  if (previewOutputModelSelect) {
    previewOutputModelSelect.value = previewOutputModel
  }
  if (previewAlternateButton) {
    previewAlternateButton.style.fontSize = buttonSizeMap[settings.buttonSize]
    previewAlternateButton.style.padding = settings.buttonSize === "extra-large" ? "18px 28px" : settings.buttonSize === "large" ? "16px 24px" : "14px 20px"
  }
  if (previewPrevStepButton) {
    previewPrevStepButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  if (previewNextStepButton) {
    previewNextStepButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  if (previewPauseButton) {
    previewPauseButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  if (previewResumeButton) {
    previewResumeButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  if (previewDraftPrevStepButton) {
    previewDraftPrevStepButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  if (previewDraftNextStepButton) {
    previewDraftNextStepButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  if (previewDraftPauseButton) {
    previewDraftPauseButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  if (previewDraftResumeButton) {
    previewDraftResumeButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  if (previewScrollTestButton) {
    previewScrollTestButton.style.fontSize = buttonSizeMap[settings.buttonSize]
  }
  previewSurface.classList.toggle("high-contrast-preview", settings.contrastSimulation)
  updateSoundToggleButtons()
  updatePreviewStatusBadge(settings)

  if (previewContextLabel) {
    previewContextLabel.textContent = settings.defaultMode === "creation" ? "Simulation de création" : "Simulation de réponse"
  }

  if (previewHeading) {
    previewHeading.textContent = settings.defaultMode === "creation"
      ? "Préparation d’un nouveau mail assisté"
      : "Traitement d’un mail reçu avec assistance IA"
  }

  if (previewSourceLabel) {
    previewSourceLabel.textContent = settings.defaultMode === "creation" ? "Contexte de rédaction" : "Mail reçu"
  }

  if (previewDraftLabel) {
    previewDraftLabel.textContent = settings.defaultMode === "creation" ? "Brouillon proposé" : "Réponse proposée"
  }

  if (previewThemeLabel) previewThemeLabel.textContent = `Thème : ${settings.theme}`
  if (previewFontLabel) previewFontLabel.textContent = `Police : ${settings.fontFamily}`
  if (previewTextLabel) previewTextLabel.textContent = `Texte : ${labelFromValue(settings.fontSize)}`
  if (previewSpacingLabel) previewSpacingLabel.textContent = `Interligne : ${labelFromValue(settings.lineSpacing)}`
  if (previewWidthLabel) previewWidthLabel.textContent = `Largeur : ${labelFromValue(settings.readingWidth)}`
  if (previewButtonsLabel) previewButtonsLabel.textContent = `Boutons : ${labelFromValue(settings.buttonSize)}`
  if (previewBadges) renderPreviewBadges(settings, previewBadges)
  if (previewBehaviorList) renderBehaviorList(settings, previewBehaviorList)
  renderAiSummary(settings, previewSummaryText, previewAssistanceList)

  if (previewSourceContent) {
    const progressState = renderSourceContent(settings, previewSourceContent)
    if (previewProgressControls) previewProgressControls.hidden = !progressState.manualProgressionEnabled
    if (previewStepIndicator) previewStepIndicator.textContent = `Étape ${progressState.currentStep} / ${progressState.totalSteps}`
    if (previewPrevStepButton) previewPrevStepButton.disabled = progressState.currentStep <= 1
    if (previewNextStepButton) previewNextStepButton.disabled = progressState.currentStep >= progressState.totalSteps
    if (previewPauseButton) previewPauseButton.disabled = !settings.progressiveReading
    if (previewResumeButton) previewResumeButton.disabled = !settings.progressiveReading
  }

  if (previewDraftContent) {
    if (settings.generationMode === "manual" && !aiDraftGenerated) {
      previewDraftContent.innerHTML = ""
      if (previewDraftProgressControls) previewDraftProgressControls.hidden = true
      const waitingText = document.createElement("p")
      waitingText.className = "settings-preview-note"
      waitingText.textContent = "La génération est réglée sur 'Sur demande'. Utilisez le bouton Generer pour afficher la proposition IA."
      previewDraftContent.appendChild(waitingText)
    } else {
      const draftState = renderDraftContent(settings, previewDraftContent)
      if (previewDraftProgressControls) previewDraftProgressControls.hidden = !draftState.manualProgressionEnabled
      if (previewDraftStepIndicator) previewDraftStepIndicator.textContent = `Étape ${draftState.currentStep} / ${draftState.totalSteps}`
      if (previewDraftPrevStepButton) previewDraftPrevStepButton.disabled = draftState.currentStep <= 1
      if (previewDraftNextStepButton) previewDraftNextStepButton.disabled = draftState.currentStep >= draftState.totalSteps
      if (previewDraftPauseButton) previewDraftPauseButton.disabled = !settings.progressiveReading
      if (previewDraftResumeButton) previewDraftResumeButton.disabled = !settings.progressiveReading

      if (settings.assistanceLevel === "advanced") {
        const advice = document.createElement("p")
        advice.className = "settings-preview-note"
        advice.textContent = "Conseil IA : vérifier le créneau du mardi et conserver l’attestation actuelle avant validation."
        previewDraftContent.appendChild(advice)
      }
    }
  }

  if (previewGenerateButton) {
    previewGenerateButton.hidden = settings.generationMode !== "manual"
  }
}

function labelFromValue(value) {
  const labels = {
    normal: "Normal",
    large: "Large",
    "extra-large": "Extra large",
    slow: "Lent",
    fast: "Rapide",
    standard: "Standard",
    comfort: "Confort",
    airy: "Très aéré",
    reduced: "Réduite",
    "very-reduced": "Très réduite",
    signal: "Signalées",
    manual: "Ouverture manuelle",
    assisted: "Ouverture assistée"
  }

  return labels[value] || value
}

async function handleSettingsChange() {
  const settings = getCurrentSettings()
  currentPreviewStepIndex = 0
  currentPreviewWordIndex = 0
  currentDraftStepIndex = 0
  currentDraftWordIndex = 0
  automaticReadingPaused = true
  automaticDraftReadingPaused = true
  aiDraftGenerated = settings.generationMode === "automatic"
  clearPreviewTimer()
  clearDraftTimer()
  stopPreviewSpeech()
  saveSettings(settings)

  if (typeof applyTheme === "function") {
    applyTheme(settings.theme)
  }

  syncSidebarTheme(settings)
  applyPreview(settings)

  try {
    await saveServerPreferences({
      audio: {
        audioInputEnabled: settings.audioInputEnabled,
        audioInputProvider: settings.audioInputProvider,
        audioInputDeviceId: settings.audioInputDeviceId,
        allowLocalFallback: settings.audioInputProvider === "local"
      },
      mail: {
        defaultMode: settings.defaultMode,
        defaultTone: settings.defaultTone,
        defaultLength: settings.defaultLength,
        generationMode: settings.generationMode
      },
      provider: {
        preferredAudioProvider: settings.audioInputProvider,
        preferredLlmProvider: getPreferredTextProviderType(),
        allowLocalFallback: settings.audioInputProvider === "local"
      }
    })
  } catch (_) {
    // Le mode local reste autorisé si le backend n'est pas encore prêt.
  }
}

function updatePreviewModels() {
  const { previewInputModelSelect, previewOutputModelSelect } = getPreviewElements()
  previewInputModel = previewInputModelSelect?.value || previewInputModel
  previewOutputModel = previewOutputModelSelect?.value || previewOutputModel
  clearPreviewTimer()
  clearDraftTimer()
  stopPreviewSpeech()
  automaticReadingPaused = true
  automaticDraftReadingPaused = true
  applyPreview(getCurrentSettings())
}

function syncFromSidebarTheme(themeName) {
  const currentSettings = {
    ...getStoredSettings(),
    ...getCurrentSettings(),
    theme: themeName
  }

  const themeField = document.getElementById(SETTINGS_FIELD_IDS.theme)
  if (themeField) {
    themeField.value = themeName
  }

  saveSettings(currentSettings)
  applyPreview(currentSettings)
}

function openPreview() {
  const { previewModal } = getPreviewElements()
  if (!previewModal) return

  currentPreviewStepIndex = 0
  currentPreviewWordIndex = 0
  currentDraftStepIndex = 0
  currentDraftWordIndex = 0
  automaticReadingPaused = true
  automaticDraftReadingPaused = true
  aiDraftGenerated = getCurrentSettings().generationMode === "automatic"
  previewModal.classList.remove("hidden-panel")
  previewModal.setAttribute("aria-hidden", "false")
  applyPreview(getCurrentSettings())
}

function showAlternatePreview() {
  currentVariantIndex = (currentVariantIndex + 1) % PREVIEW_CASE.draftVariants.length
  currentDraftStepIndex = 0
  currentDraftWordIndex = 0
  automaticDraftReadingPaused = false
  if (getCurrentSettings().generationMode === "manual") {
    aiDraftGenerated = true
  }
  applyPreview(getCurrentSettings())
  startAutomaticDraftReading()
}

function generatePreviewDraft() {
  aiDraftGenerated = true
  currentDraftStepIndex = 0
  currentDraftWordIndex = 0
  automaticDraftReadingPaused = true
  applyPreview(getCurrentSettings())
}

function startInputReadingWithAudio() {
  automaticReadingPaused = false
  if (inputAudioEnabled) {
    speakTextFromElement(getPreviewElements().previewSourceContent, "input")
  }
  updatePreviewStatusBadge(getCurrentSettings())
  startAutomaticPreviewReading()
}

function startDraftReadingWithAudio() {
  if (!aiDraftGenerated) {
    aiDraftGenerated = true
    applyPreview(getCurrentSettings())
  }

  automaticDraftReadingPaused = false
  if (draftAudioEnabled) {
    speakTextFromElement(getPreviewElements().previewDraftContent, "draft")
  }
  startAutomaticDraftReading()
}

function showPreviousPreviewStep() {
  currentPreviewStepIndex = Math.max(0, currentPreviewStepIndex - 1)
  currentPreviewWordIndex = 0
  automaticReadingPaused = true
  clearPreviewTimer()
  stopPreviewSpeech()
  applyPreview(getCurrentSettings())
}

function showNextPreviewStep() {
  const steps = getProgressiveSteps(getCurrentSettings())
  currentPreviewStepIndex = Math.min(steps.length - 1, currentPreviewStepIndex + 1)
  currentPreviewWordIndex = 0
  automaticReadingPaused = true
  clearPreviewTimer()
  stopPreviewSpeech()
  applyPreview(getCurrentSettings())
}

function testPreviewScroll() {
  const { previewSurface } = getPreviewElements()
  if (!previewSurface) return

  const scrollDistances = {
    slow: 120,
    normal: 240,
    fast: 380
  }

  previewSurface.scrollBy({
    top: scrollDistances[getCurrentSettings().scrollSpeed] || scrollDistances.normal,
    behavior: "smooth"
  })
}

function startAutomaticPreviewReading() {
  clearPreviewTimer()

  const settings = getCurrentSettings()
  const { previewSourceContent } = getPreviewElements()

  if (
    !settings.progressiveReading ||
    settings.contentStep === "unlimited" ||
    automaticReadingPaused ||
    !previewSourceContent ||
    inputAudioEnabled
  ) {
    return
  }

  const delay = Math.max(120, Number(settings.progressUnit || DEFAULT_SETTINGS.progressUnit))

  previewTimerId = window.setTimeout(() => {
    if (currentPreviewWordIndex < previewWordMeta.length - 1) {
      currentPreviewWordIndex += 1
      updatePreviewWordHighlight(previewSourceContent)
      startAutomaticPreviewReading()
      return
    }

    const steps = getProgressiveSteps(settings)

    if (currentPreviewStepIndex < steps.length - 1) {
      currentPreviewStepIndex += 1
      currentPreviewWordIndex = 0
      applyPreview(settings)
      startAutomaticPreviewReading()
    }
  }, delay)
}

function pauseAutomaticPreviewReading() {
  automaticReadingPaused = true
  clearPreviewTimer()
  pausePreviewSpeech()
  updatePreviewStatusBadge(getCurrentSettings())
}

function resumeAutomaticPreviewReading() {
  if (!getCurrentSettings().progressiveReading) {
    return
  }

  automaticReadingPaused = false
  currentPreviewWordIndex = getCurrentParagraphStartIndex()
  updatePreviewWordHighlight(getPreviewElements().previewSourceContent)
  resumePreviewSpeech()
  updatePreviewStatusBadge(getCurrentSettings())
  startAutomaticPreviewReading()
}

function showPreviousDraftStep() {
  currentDraftStepIndex = Math.max(0, currentDraftStepIndex - 1)
  currentDraftWordIndex = 0
  automaticDraftReadingPaused = true
  clearDraftTimer()
  stopPreviewSpeech()
  applyPreview(getCurrentSettings())
}

function showNextDraftStep() {
  const settings = getCurrentSettings()
  const variant = PREVIEW_CASE.draftVariants[currentVariantIndex]
  const stepSize = settings.contentStep === "unlimited" ? variant.paragraphs.length : Math.max(1, Number(settings.contentStep))
  const totalSteps = Math.ceil(variant.paragraphs.length / stepSize)
  currentDraftStepIndex = Math.min(totalSteps - 1, currentDraftStepIndex + 1)
  currentDraftWordIndex = 0
  automaticDraftReadingPaused = true
  clearDraftTimer()
  stopPreviewSpeech()
  applyPreview(getCurrentSettings())
}

function pauseAutomaticDraftReading() {
  automaticDraftReadingPaused = true
  clearDraftTimer()
  pausePreviewSpeech()
}

function resumeAutomaticDraftReading() {
  if (!getCurrentSettings().progressiveReading) {
    return
  }

  automaticDraftReadingPaused = false
  currentDraftWordIndex = getCurrentDraftParagraphStartIndex()
  updateDraftWordHighlight(getPreviewElements().previewDraftContent)
  resumePreviewSpeech()
  startAutomaticDraftReading()
}

function startAutomaticDraftReading() {
  clearDraftTimer()

  const settings = getCurrentSettings()
  const { previewDraftContent } = getPreviewElements()

  if (
    !settings.progressiveReading ||
    automaticDraftReadingPaused ||
    !previewDraftContent ||
    !aiDraftGenerated ||
    draftAudioEnabled
  ) {
    return
  }

  const delay = Math.max(120, Number(settings.progressUnit || DEFAULT_SETTINGS.progressUnit))

  draftTimerId = window.setTimeout(() => {
    if (currentDraftWordIndex < draftWordMeta.length - 1) {
      currentDraftWordIndex += 1
      updateDraftWordHighlight(previewDraftContent)
      startAutomaticDraftReading()
      return
    }

    const variant = PREVIEW_CASE.draftVariants[currentVariantIndex]
    const stepSize = settings.contentStep === "unlimited" ? variant.paragraphs.length : Math.max(1, Number(settings.contentStep))
    const totalSteps = Math.ceil(variant.paragraphs.length / stepSize)

    if (currentDraftStepIndex < totalSteps - 1) {
      currentDraftStepIndex += 1
      currentDraftWordIndex = 0
      applyPreview(settings)
      startAutomaticDraftReading()
    }
  }, delay)
}

function closePreview() {
  const { previewModal } = getPreviewElements()
  if (!previewModal) return

  clearPreviewTimer()
  clearDraftTimer()
  stopPreviewSpeech()
  previewModal.classList.add("hidden-panel")
  previewModal.setAttribute("aria-hidden", "true")
}

async function loadModelsIntoSelect() {
  const select = document.getElementById("defaultModelSelect")
  if (!select) return
  try {
    const res = await fetch("/api/models")
    const data = await res.json()
    if (!data.ok || !data.models) return
    const currentValue = select.value
    select.innerHTML = ""
    for (const m of data.models) {
      const opt = document.createElement("option")
      opt.value = m.value
      opt.textContent = m.label
      select.appendChild(opt)
    }
    if (currentValue) select.value = currentValue
  } catch {
    // Garde les options statiques si l'API échoue
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const activeSession = await refreshSessionStateOrRedirect()
  if (!activeSession) {
    return
  }

  await loadModelsIntoSelect()

  const localSettings = getStoredSettings()
  const serverPreferences = await loadServerPreferences()
  const settings = serverPreferences
    ? {
      ...localSettings,
      ...serverPreferences.ui,
      ...serverPreferences.audio,
      ...serverPreferences.mail
    }
    : localSettings

  saveSettings(settings)
  hydrateForm(settings)
  await initializeAudioVoiceSettings(settings)
  populateAudioInputDevices()
  syncSidebarTheme(settings)
  applyPreview(settings)

  Object.values(SETTINGS_FIELD_IDS).forEach((elementId) => {
    const element = document.getElementById(elementId)
    if (!element) return

    element.addEventListener("change", handleSettingsChange)
  })

  navigator.mediaDevices?.addEventListener?.("devicechange", () => {
    populateAudioInputDevices()
  })

  try {
    const providers = await loadProviderAccounts()
    renderProviderAccounts(providers)
  } catch (_) {
    // Le reste de la page doit rester utilisable sans blocage.
  }

  try {
    const usageSummary = await loadUsageSummary()
    renderUsageSummary(usageSummary)
  } catch (_) {
    renderUsageSummary(null)
  }

  document.getElementById("deepgramSaveProviderBtn")?.addEventListener("click", () => {
    saveProviderAccount("deepgram")
  })
  document.getElementById("deepgramTestProviderBtn")?.addEventListener("click", () => {
    testProviderAccount("deepgram")
  })
  document.getElementById("assemblyaiSaveProviderBtn")?.addEventListener("click", () => {
    saveProviderAccount("assemblyai")
  })
  document.getElementById("assemblyaiTestProviderBtn")?.addEventListener("click", () => {
    testProviderAccount("assemblyai")
  })
  document.getElementById("deepseekSaveProviderBtn")?.addEventListener("click", () => {
    saveProviderAccount("deepseek-api")
  })
  document.getElementById("deepseekTestProviderBtn")?.addEventListener("click", () => {
    testProviderAccount("deepseek-api")
  })
  document.getElementById("mistralSaveProviderBtn")?.addEventListener("click", () => {
    saveProviderAccount("mistral-api")
  })
  document.getElementById("mistralTestProviderBtn")?.addEventListener("click", () => {
    testProviderAccount("mistral-api")
  })
  document.getElementById("deepseekDefaultToggle")?.addEventListener("change", (event) => {
    if (event.target?.checked) {
      syncExclusiveTextProviderToggles("deepseek-api")
    }
    handleSettingsChange()
  })
  document.getElementById("mistralDefaultToggle")?.addEventListener("change", (event) => {
    if (event.target?.checked) {
      syncExclusiveTextProviderToggles("mistral-api")
    }
    handleSettingsChange()
  })

  const {
    openPreviewBtn,
    closePreviewBtn,
    previewBackdrop,
    previewModal,
    previewInputModelSelect,
    previewOutputModelSelect,
    previewGenerateButton,
    previewAlternateButton,
    previewDraftPrevStepButton,
    previewDraftNextStepButton,
    previewDraftSoundToggle,
    previewSpeakDraftButton,
    previewStopDraftAudioButton,
    previewDraftPauseButton,
    previewDraftResumeButton,
    previewPrevStepButton,
    previewNextStepButton,
    previewInputSoundToggle,
    previewSpeakInputButton,
    previewStopInputAudioButton,
    previewPauseButton,
    previewResumeButton,
    previewScrollTestButton
  } = getPreviewElements()
  openPreviewBtn?.addEventListener("click", openPreview)
  closePreviewBtn?.addEventListener("click", closePreview)
  previewBackdrop?.addEventListener("click", closePreview)
  previewInputModelSelect?.addEventListener("change", updatePreviewModels)
  previewOutputModelSelect?.addEventListener("change", updatePreviewModels)
  previewInputSoundToggle?.addEventListener("click", toggleInputSound)
  previewDraftSoundToggle?.addEventListener("click", toggleDraftSound)
  previewGenerateButton?.addEventListener("click", generatePreviewDraft)
  previewAlternateButton?.addEventListener("click", showAlternatePreview)
  previewDraftPrevStepButton?.addEventListener("click", showPreviousDraftStep)
  previewDraftNextStepButton?.addEventListener("click", showNextDraftStep)
  previewSpeakDraftButton?.addEventListener("click", startDraftReadingWithAudio)
  previewStopDraftAudioButton?.addEventListener("click", stopDraftAudioMode)
  previewDraftPauseButton?.addEventListener("click", pauseAutomaticDraftReading)
  previewDraftResumeButton?.addEventListener("click", resumeAutomaticDraftReading)
  previewPrevStepButton?.addEventListener("click", showPreviousPreviewStep)
  previewNextStepButton?.addEventListener("click", showNextPreviewStep)
  previewSpeakInputButton?.addEventListener("click", startInputReadingWithAudio)
  previewStopInputAudioButton?.addEventListener("click", stopInputAudioMode)
  previewPauseButton?.addEventListener("click", pauseAutomaticPreviewReading)
  previewResumeButton?.addEventListener("click", resumeAutomaticPreviewReading)
  previewScrollTestButton?.addEventListener("click", testPreviewScroll)
  window.addEventListener("mail-assistant-theme-changed", (event) => {
    syncFromSidebarTheme(event.detail?.theme || DEFAULT_SETTINGS.theme)
  })
  window.addEventListener("mail-assistant-session-changed", () => {
    refreshSessionStateOrRedirect()
  })
  window.addEventListener("storage", (event) => {
    if (event.key === SESSION_KEY) {
      refreshSessionStateOrRedirect()
    }
  })
  window.addEventListener("focus", () => {
    refreshSessionStateOrRedirect()
  })
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      refreshSessionStateOrRedirect()
    }
  })
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !previewModal?.classList.contains("hidden-panel")) {
      closePreview()
    }
  })

  updateSoundToggleButtons()
})
})()
