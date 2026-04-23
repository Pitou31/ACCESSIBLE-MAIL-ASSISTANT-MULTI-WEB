const createModeBtn = document.getElementById("createModeBtn")
const replyModeBtn = document.getElementById("replyModeBtn")

const creationWorkspace = document.getElementById("creationWorkspace")
const replyWorkspace = document.getElementById("replyWorkspace")

const classificationBadge = document.getElementById("classificationBadge")
const classificationValue = document.getElementById("classificationValue")
const priorityBadge = document.getElementById("priorityBadge")
const priorityValue = document.getElementById("priorityValue")
const priorityGroup = document.getElementById("priorityGroup")
const llmSelect = document.getElementById("llmSelect")
const languageSelect = document.getElementById("languageSelect")
const createModeBtnBottom = document.getElementById("createModeBtnBottom")
const replyModeBtnBottom = document.getElementById("replyModeBtnBottom")
const classificationBadgeBottom = document.getElementById("classificationBadgeBottom")
const classificationValueBottom = document.getElementById("classificationValueBottom")
const priorityBadgeBottom = document.getElementById("priorityBadgeBottom")
const priorityValueBottom = document.getElementById("priorityValueBottom")
const priorityGroupBottom = document.getElementById("priorityGroupBottom")
const llmSelectBottom = document.getElementById("llmSelectBottom")
const languageSelectBottom = document.getElementById("languageSelectBottom")
const mailboxEmail = document.getElementById("mailboxEmail")
const mailboxConnectBtn = document.getElementById("mailboxConnectBtn")
const mailboxRefreshBtn = document.getElementById("mailboxRefreshBtn")
const mailboxFeedback = document.getElementById("mailboxFeedback")
const mailboxConnectionsList = document.getElementById("mailboxConnectionsList")
const mailboxMessagesList = document.getElementById("mailboxMessagesList")
const mailboxProviderHint = document.getElementById("mailboxProviderHint")
const mailboxSharingModeSummary = document.getElementById("mailboxSharingModeSummary")
const mailboxSharingModeHelp = document.getElementById("mailboxSharingModeHelp")
const automaticProcessingStartBtn = document.getElementById("automaticProcessingStartBtn")
const automaticProcessingStopBtn = document.getElementById("automaticProcessingStopBtn")
const automaticProcessingFeedback = document.getElementById("automaticProcessingFeedback")
const automaticProcessingContext = document.getElementById("automaticProcessingContext")
const SESSION_KEY = "mail-assistant-session"
const SETTINGS_STORAGE_KEY = "mail-assistant-settings"
const LAST_MAIL_MODE_STORAGE_KEY = "mail-assistant-last-mail-mode"
const CREATION_PROMPT_STORAGE_KEY = "mail-assistant-creation-prompt"
const CREATION_SUBJECT_STORAGE_KEY = "mail-assistant-creation-subject"
const CREATION_DRAFT_STORAGE_KEY = "mail-assistant-creation-draft"
const SELECTED_LLM_STORAGE_KEY = "mail-assistant-selected-llm"
const SELECTED_LANGUAGE_STORAGE_KEY = "mail-assistant-selected-language"
const MAIL_STATS_STORAGE_KEY = "mail-assistant-mail-stats-events"
const MAIL_STATS_MAX_EVENTS = 2000

const mailDate = document.getElementById("mailDate")
const mailTo = document.getElementById("mailTo")
const mailCc = document.getElementById("mailCc")
const mailBcc = document.getElementById("mailBcc")
const mailSubject = document.getElementById("mailSubject")
const creationPrompt = document.getElementById("creationPrompt")
const creationAttachments = document.getElementById("creationAttachments")
const creationAttachmentsPreview = document.getElementById("creationAttachmentsPreview")
const creationOutputMailContent = document.getElementById("creationOutputMailContent")
const creationOutputSuggestions = document.getElementById("creationOutputSuggestions")
const creationGenerateBtn = document.getElementById("creationGenerateBtn")
const creationPromptDictionaryEditorBtn = document.getElementById("creationPromptDictionaryEditorBtn")
const creationDictionaryEditorBtn = document.getElementById("creationDictionaryEditorBtn")
const creationRegenerateBtn = document.getElementById("creationRegenerateBtn")
const creationGenerationFeedback = document.getElementById("creationGenerationFeedback")
const creationAiTrace = document.getElementById("creationAiTrace")

const receivedMailContent = document.getElementById("receivedMailContent")
const receivedAttachments = document.getElementById("receivedAttachments")
const receivedAttachmentsPreview = document.getElementById("receivedAttachmentsPreview")
const replyAttachmentsInfo = document.getElementById("replyAttachmentsInfo")
const replyOutputMailContent = document.getElementById("replyOutputMailContent")
const replyOutputSuggestions = document.getElementById("replyOutputSuggestions")
const replyGenerateBtn = document.getElementById("replyGenerateBtn")
const replyDictionaryEditorBtn = document.getElementById("replyDictionaryEditorBtn")
const replyRegenerateBtn = document.getElementById("replyRegenerateBtn")
const replyGenerationFeedback = document.getElementById("replyGenerationFeedback")
const replyAiTrace = document.getElementById("replyAiTrace")
const mailCollaborationIndicator = document.getElementById("mailCollaborationIndicator")
const mailCollaborationText = document.getElementById("mailCollaborationText")
const creationPromptDetectedLanguage = document.getElementById("creationPromptDetectedLanguage")
const receivedMailDetectedLanguage = document.getElementById("receivedMailDetectedLanguage")

const creationSendBtn = document.getElementById("creationSendBtn")
const creationRejectBtn = document.getElementById("creationRejectBtn")
const creationDeleteBtn = document.getElementById("creationDeleteBtn")

const replySendBtn = document.getElementById("replySendBtn")
const replyRejectBtn = document.getElementById("replyRejectBtn")
const replyDeleteBtn = document.getElementById("replyDeleteBtn")

const creationSendCount = document.getElementById("creationSendCount")
const creationRejectCount = document.getElementById("creationRejectCount")
const creationDeleteCount = document.getElementById("creationDeleteCount")

const replySendCount = document.getElementById("replySendCount")
const replyRejectCount = document.getElementById("replyRejectCount")
const replyDeleteCount = document.getElementById("replyDeleteCount")

let sessionCounters = {
  creation: {
    send: 0,
    reject: 0,
    delete: 0
  },
  reply: {
    send: 0,
    reject: 0,
    delete: 0
  }
}

let currentMailboxConnectionId = ""
let currentMailboxSharingEnabled = false
let currentMailboxSharingFeatureEnabled = false
let knownMailboxConnections = []
let currentInboxMessages = []
let currentOpenedMessage = null
let currentMailAnalysis = null
let collaborationRefreshIntervalId = null
let automationState = {
  running: false,
  currentMessageId: "",
  timeoutSeconds: 45,
  automaticModel: "deepseek-local",
  processedInCurrentPass: [],
  countdownIntervalId: null,
  timeoutId: null
}

const mailStatsTimers = new Map()
let currentTrackedWorkflowMode = ""

const suggestionAssistantState = new WeakMap()

function getMailStatsStorageKey() {
  return getSessionStorageKey(MAIL_STATS_STORAGE_KEY)
}

function getCurrentWorkflowMode() {
  if (replyWorkspace && !replyWorkspace.hidden && !replyWorkspace.classList.contains("hidden-panel")) {
    return "reply"
  }
  return "creation"
}

function getCurrentSessionIdentity() {
  try {
    const session = JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    return {
      userId: session?.userId || session?.accountId || "",
      accountId: session?.accountId || session?.userId || ""
    }
  } catch (_) {
    return { userId: "", accountId: "" }
  }
}

function readMailStatsEvents() {
  try {
    const raw = JSON.parse(localStorage.getItem(getMailStatsStorageKey()) || "[]")
    return Array.isArray(raw) ? raw : []
  } catch (_) {
    return []
  }
}

function writeMailStatsEvents(events) {
  try {
    localStorage.setItem(getMailStatsStorageKey(), JSON.stringify(events.slice(-MAIL_STATS_MAX_EVENTS)))
  } catch (_) {
    // Rien de bloquant.
  }
}

function trackMailEvent(eventType, payload = {}) {
  const identity = getCurrentSessionIdentity()
  const event = {
    eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    screen: "mail",
    workflow: payload.workflow || getCurrentWorkflowMode(),
    eventType,
    messageId: payload.messageId ?? currentOpenedMessage?.id ?? "",
    connectionId: payload.connectionId ?? currentMailboxConnectionId ?? "",
    userId: payload.userId ?? identity.userId,
    accountId: payload.accountId ?? identity.accountId,
    metadata: payload.metadata && typeof payload.metadata === "object" ? payload.metadata : {}
  }

  if (typeof payload.duration_ms === "number") {
    event.duration_ms = Math.max(0, Math.round(payload.duration_ms))
  }

  const events = readMailStatsEvents()
  events.push(event)
  writeMailStatsEvents(events)
  return event
}

function startMailTimer(name, metadata = {}) {
  mailStatsTimers.set(name, { startedAt: Date.now(), metadata })
}

function stopMailTimer(name, eventType, payload = {}) {
  const active = mailStatsTimers.get(name)
  if (!active) return null

  mailStatsTimers.delete(name)
  const durationMs = Date.now() - active.startedAt
  trackMailEvent(eventType, {
    ...payload,
    metadata: {
      ...(active.metadata || {}),
      ...((payload && payload.metadata) || {})
    },
    duration_ms: durationMs
  })
  return durationMs
}

function syncWorkflowTracking(mode) {
  const normalizedMode = mode === "reply" ? "reply" : "creation"

  if (currentTrackedWorkflowMode && currentTrackedWorkflowMode !== normalizedMode) {
    stopMailTimer(`workflow_session:${currentTrackedWorkflowMode}`, "workflow_session_completed", {
      workflow: currentTrackedWorkflowMode
    })
  }

  if (currentTrackedWorkflowMode !== normalizedMode) {
    currentTrackedWorkflowMode = normalizedMode
    startMailTimer(`workflow_session:${normalizedMode}`, { workflow: normalizedMode })
  }
}

window.MailStatsTracker = {
  trackMailEvent,
  readMailStatsEvents,
  clear() {
    writeMailStatsEvents([])
  }
}

const EDITOR_SUGGESTION_LIBRARY = {
  fr: {
    quick: ["Bonjour", "Je vous remercie", "Veuillez", "Cordialement,"],
    words: [
      "bonjour",
      "merci",
      "veuillez",
      "dossier",
      "référence",
      "date",
      "demande",
      "message",
      "document",
      "pièce jointe",
      "justificatif",
      "coordonnées",
      "numéro",
      "traitement",
      "relance",
      "information",
      "confirmation",
      "complément",
      "vérification",
      "service",
      "réponse",
      "courriel",
      "statut",
      "transmission",
      "demandeur",
      "précision",
      "disposition",
      "cordialement"
    ],
    greetings: ["Bonjour,", "Bonjour Madame,", "Bonjour Monsieur,", "Bonjour [Nom],"],
    body: [
      "Je vous remercie pour votre message.",
      "Je vous remercie pour votre patience.",
      "Nous accusons réception de votre demande.",
      "Je reste à votre disposition pour tout complément d'information.",
      "Veuillez nous transmettre votre numéro de dossier.",
      "Merci de votre compréhension."
    ],
    reply: [
      "Nous accusons réception de votre relance.",
      "Les éléments fournis permettent de situer votre demande.",
      "Nous ne pouvons pas confirmer l'état exact du dossier à ce stade.",
      "Votre relance a bien été reçue."
    ],
    creation: [
      "Je vous contacte au sujet de",
      "Vous trouverez ci-joint",
      "Merci de bien vouloir",
      "Je vous prie de bien vouloir"
    ],
    closings: ["Cordialement,", "Bien cordialement,", "Merci de votre collaboration,", "Le service"],
    nouns: ["numéro de dossier", "référence", "pièce jointe", "demande", "justificatif", "coordonnées"]
  },
  en: {
    quick: ["Hello", "Thank you", "Please", "Kind regards,"],
    words: ["hello", "thank you", "please", "file", "reference", "date", "request", "message", "attachment", "document"],
    greetings: ["Hello,", "Hello [Name],", "Dear Sir or Madam,"],
    body: [
      "Thank you for your message.",
      "Thank you for your patience.",
      "We have received your request.",
      "Please send us your file reference.",
      "We remain available if you need any further information."
    ],
    reply: [
      "We acknowledge receipt of your follow-up.",
      "The information provided helps us identify your request.",
      "We cannot confirm the exact status of the file at this stage."
    ],
    creation: ["I am contacting you regarding", "Please find attached", "Thank you for your cooperation"],
    closings: ["Kind regards,", "Best regards,", "Sincerely,", "The team"],
    nouns: ["file number", "reference", "attachment", "request", "supporting document"]
  },
  es: {
    quick: ["Hola", "Gracias", "Por favor", "Atentamente,"],
    words: ["hola", "gracias", "por favor", "expediente", "referencia", "fecha", "solicitud", "mensaje", "adjunto"],
    greetings: ["Hola,", "Hola [Nombre],", "Estimado/a,"],
    body: [
      "Gracias por su mensaje.",
      "Gracias por su paciencia.",
      "Hemos recibido su solicitud.",
      "Por favor, envíenos su número de expediente."
    ],
    reply: ["Acusamos recibo de su recordatorio.", "La información facilitada ayuda a identificar su solicitud."],
    creation: ["Me pongo en contacto con usted sobre", "Adjunto encontrará"],
    closings: ["Atentamente,", "Saludos cordiales,", "El servicio"],
    nouns: ["número de expediente", "referencia", "adjunto", "solicitud"]
  },
  de: {
    quick: ["Guten Tag", "Vielen Dank", "Bitte", "Mit freundlichen Grüßen,"],
    words: ["guten tag", "danke", "bitte", "aktenzeichen", "referenz", "datum", "anfrage", "nachricht", "anlage"],
    greetings: ["Guten Tag,", "Guten Tag [Name],", "Sehr geehrte Damen und Herren,"],
    body: [
      "Vielen Dank für Ihre Nachricht.",
      "Vielen Dank für Ihre Geduld.",
      "Wir haben Ihre Anfrage erhalten."
    ],
    reply: ["Wir bestätigen den Eingang Ihrer Nachfrage.", "Die übermittelten Angaben helfen, Ihre Anfrage einzuordnen."],
    creation: ["Ich schreibe Ihnen bezüglich", "Im Anhang finden Sie"],
    closings: ["Mit freundlichen Grüßen,", "Freundliche Grüße,", "Der Dienst"],
    nouns: ["Aktenzeichen", "Referenz", "Anlage", "Anfrage"]
  },
  it: {
    quick: ["Buongiorno", "Grazie", "Per favore", "Cordiali saluti,"],
    words: ["buongiorno", "grazie", "per favore", "pratica", "riferimento", "data", "richiesta", "messaggio", "allegato"],
    greetings: ["Buongiorno,", "Buongiorno [Nome],", "Gentile utente,"],
    body: ["Grazie per il suo messaggio.", "Grazie per la sua pazienza.", "Abbiamo ricevuto la sua richiesta."],
    reply: ["Confermiamo la ricezione del suo sollecito."],
    creation: ["La contatto in merito a", "In allegato trova"],
    closings: ["Cordiali saluti,", "Distinti saluti,", "Il servizio"],
    nouns: ["numero di pratica", "riferimento", "allegato", "richiesta"]
  },
  nl: {
    quick: ["Hallo", "Dank u", "Alstublieft", "Met vriendelijke groet,"],
    words: ["hallo", "dank u", "alstublieft", "dossier", "referentie", "datum", "verzoek", "bericht", "bijlage"],
    greetings: ["Hallo,", "Hallo [Naam],", "Geachte heer/mevrouw,"],
    body: ["Dank u voor uw bericht.", "Dank u voor uw geduld.", "Wij hebben uw verzoek ontvangen."],
    reply: ["Wij bevestigen de ontvangst van uw herinnering."],
    creation: ["Ik neem contact met u op over", "In de bijlage vindt u"],
    closings: ["Met vriendelijke groet,", "Vriendelijke groeten,", "De dienst"],
    nouns: ["dossiernummer", "referentie", "bijlage", "verzoek"]
  },
  ar: {
    quick: ["مرحبا", "شكرا", "يرجى", "مع خالص التحية،"],
    words: ["مرحبا", "شكرا", "يرجى", "ملف", "مرجع", "تاريخ", "طلب", "رسالة", "مرفق"],
    greetings: ["مرحبا،", "مرحبا [الاسم]،", "السيدة/السيد المحترم،"],
    body: ["شكرا على رسالتكم.", "شكرا على صبركم.", "لقد استلمنا طلبكم."],
    reply: ["نؤكد استلام المتابعة الخاصة بكم.", "المعلومات المرسلة تساعد على تحديد الطلب."],
    creation: ["أتواصل معكم بخصوص", "يرجى الاطلاع على المرفق"],
    closings: ["مع خالص التحية،", "وتفضلوا بقبول فائق الاحترام،", "الخدمة"],
    nouns: ["رقم الملف", "المرجع", "مرفق", "طلب"]
  }
}

async function ensureMailUserSession() {
  try {
    const response = await fetch("/api/account/session", {
      cache: "no-store",
      credentials: "same-origin"
    })
    const result = await response.json()

    if (!response.ok || !result.ok || !result.accountActive || !result.session) {
      window.location.replace("/frontend/account.html")
      return false
    }

    if (result.session.role === "admin") {
      window.location.replace("/frontend/account.html")
      return false
    }

    return true
  } catch (_) {
    window.location.replace("/frontend/account.html")
    return false
  }
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

function getStoredDefaultMode() {
  try {
    const settings = JSON.parse(localStorage.getItem(getSessionStorageKey(SETTINGS_STORAGE_KEY)) || "{}")
    return settings.defaultMode === "creation" ? "creation" : "reply"
  } catch (_) {
    return "reply"
  }
}

function getStoredMailSettings() {
  try {
    return JSON.parse(localStorage.getItem(getSessionStorageKey(SETTINGS_STORAGE_KEY)) || "{}")
  } catch (_) {
    return {}
  }
}

function getInitialMailMode() {
  try {
    const lastMode = localStorage.getItem(getSessionStorageKey(LAST_MAIL_MODE_STORAGE_KEY))
    if (lastMode === "creation" || lastMode === "reply") {
      return lastMode
    }
  } catch (_) {
    // Rien de bloquant.
  }

  return getStoredDefaultMode()
}

function getStoredCreationPrompt() {
  try {
    return localStorage.getItem(getSessionStorageKey(CREATION_PROMPT_STORAGE_KEY)) || ""
  } catch (_) {
    return ""
  }
}

function persistCreationPrompt(value = "") {
  try {
    localStorage.setItem(getSessionStorageKey(CREATION_PROMPT_STORAGE_KEY), String(value || ""))
  } catch (_) {
    // Rien de bloquant.
  }
}

function getStoredUiValue(storageKey) {
  try {
    return localStorage.getItem(getSessionStorageKey(storageKey)) || ""
  } catch (_) {
    return ""
  }
}

function persistUiValue(storageKey, value = "") {
  try {
    localStorage.setItem(getSessionStorageKey(storageKey), String(value || ""))
  } catch (_) {
    // Rien de bloquant.
  }
}

function restoreComposePreferences() {
  const storedLlm = getStoredUiValue(SELECTED_LLM_STORAGE_KEY)
  const storedLanguage = getStoredUiValue(SELECTED_LANGUAGE_STORAGE_KEY)
  const storedSubject = getStoredUiValue(CREATION_SUBJECT_STORAGE_KEY)
  const storedDraft = getStoredUiValue(CREATION_DRAFT_STORAGE_KEY)

  if (storedLlm) {
    if (llmSelect) llmSelect.value = storedLlm
    if (llmSelectBottom) llmSelectBottom.value = storedLlm
  }

  if (storedLanguage) {
    if (languageSelect) languageSelect.value = storedLanguage
    if (languageSelectBottom) languageSelectBottom.value = storedLanguage
  }

  if (mailSubject && storedSubject && !mailSubject.value.trim()) {
    mailSubject.value = storedSubject
  }

  if (creationOutputMailContent && storedDraft && !creationOutputMailContent.value.trim()) {
    creationOutputMailContent.value = storedDraft
  }
}

function setGenerationFeedback(message, tone = "info") {
  if (!creationGenerationFeedback) return
  creationGenerationFeedback.textContent = message
  creationGenerationFeedback.classList.remove("is-info", "is-success", "is-error")
  creationGenerationFeedback.classList.add("form-feedback", `is-${tone}`)
}

function setReplyGenerationFeedback(message, tone = "info") {
  if (!replyGenerationFeedback) return
  replyGenerationFeedback.textContent = message
  replyGenerationFeedback.classList.remove("is-info", "is-success", "is-error")
  replyGenerationFeedback.classList.add("form-feedback", `is-${tone}`)
}

function setReplyAttachmentsInfo(message, tone = "info") {
  if (!replyAttachmentsInfo) return
  replyAttachmentsInfo.textContent = message
  replyAttachmentsInfo.classList.remove("is-info", "is-success", "is-error")
  replyAttachmentsInfo.classList.add("form-feedback", `is-${tone}`)
}

function setMailboxFeedback(message, tone = "info") {
  if (!mailboxFeedback) return
  mailboxFeedback.textContent = message
  mailboxFeedback.classList.remove("is-info", "is-success", "is-error")
  mailboxFeedback.classList.add("form-feedback", `is-${tone}`)
}

function decodeBase64ToUint8Array(base64 = "") {
  if (!base64) {
    return new Uint8Array()
  }

  const binary = window.atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index)
  }
  return bytes
}

function syncReceivedAttachmentsInput(attachments = []) {
  if (!receivedAttachments) {
    return
  }

  try {
    const transfer = new DataTransfer()
    attachments.forEach((attachment) => {
      if (!attachment.base64Data) {
        return
      }

      const bytes = decodeBase64ToUint8Array(attachment.base64Data)
      const file = new File([bytes], attachment.filename || "fichier", {
        type: attachment.contentType || "application/octet-stream"
      })
      transfer.items.add(file)
    })
    receivedAttachments.files = transfer.files
  } catch (_) {
    // Certains navigateurs peuvent refuser cette affectation ; le contexte texte reste alors la source principale.
  }
}

function buildAttachmentPayloadForGeneration(attachments = []) {
  if (!Array.isArray(attachments) || attachments.length === 0) {
    return {
      summary: "Aucune pièce jointe détectée.",
      details: []
    }
  }

  return {
    summary: `${attachments.length} pièce(s) jointe(s) détectée(s) : ${attachments.map((attachment) => attachment.filename).join(", ")}`,
    details: attachments.map((attachment) => ({
      filename: attachment.filename,
      contentType: attachment.contentType,
      size: attachment.size,
      base64Data: attachment.base64Data || "",
      extractedText: attachment.extractedText || ""
    }))
  }
}

function escapeHtml(value = "") {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function formatAttachmentSize(size = 0) {
  const numericSize = Number(size || 0)
  if (!numericSize) {
    return "0 o"
  }
  if (numericSize < 1024) {
    return `${numericSize} o`
  }
  if (numericSize < 1024 * 1024) {
    return `${(numericSize / 1024).toFixed(1)} Ko`
  }
  return `${(numericSize / (1024 * 1024)).toFixed(1)} Mo`
}

function renderAttachmentPreview(container, attachments = [], options = {}) {
  if (!container) {
    return
  }

  if (!Array.isArray(attachments) || attachments.length === 0) {
    container.innerHTML = '<p class="settings-help">Aucune pièce jointe chargée.</p>'
    return
  }

  container.innerHTML = attachments.map((attachment) => {
    const contentPreview = attachment.extractedText
      ? `<pre class="attachment-preview-content">${escapeHtml(attachment.extractedText)}</pre>`
      : `<p class="settings-help">Contenu non extrait automatiquement.</p>`

    const sourceLabel = options.received
      ? "rattachée automatiquement"
      : "chargée localement"

    return `
      <article class="account-summary-card attachment-preview-card">
        <p class="account-summary-title">${escapeHtml(attachment.filename || "fichier")}</p>
        <p class="settings-help"><strong>Statut :</strong> pièce jointe ${sourceLabel}</p>
        <p class="settings-help"><strong>Type :</strong> ${escapeHtml(attachment.contentType || "application/octet-stream")}</p>
        <p class="settings-help"><strong>Taille :</strong> ${formatAttachmentSize(attachment.size)}</p>
        ${contentPreview}
      </article>
    `
  }).join("")
}

function renderAiTrace(container, promptText = "") {
  if (!container) {
    return
  }

  if (!promptText) {
    container.innerHTML = '<p class="settings-help">Trace IA non disponible pour le moment.</p>'
    return
  }

  container.innerHTML = `
    <article class="account-summary-card attachment-preview-card">
      <p class="account-summary-title">Trace envoyée à la génération IA</p>
      <p class="settings-help"><strong>But :</strong> vérifier exactement ce qui est transmis au modèle.</p>
      <pre class="attachment-preview-content">${escapeHtml(promptText)}</pre>
    </article>
  `
}

function readFileAsText(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || "").slice(0, 5000))
    reader.onerror = () => resolve("")
    reader.readAsText(file)
  })
}

function readFileAsBase64(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result || "")
      const [, base64 = ""] = result.split(",", 2)
      resolve(base64)
    }
    reader.onerror = () => resolve("")
    reader.readAsDataURL(file)
  })
}

function shouldKeepFrontendTextExtraction(file) {
  const filename = String(file?.name || "").toLowerCase()
  const contentType = String(file?.type || "").toLowerCase()

  return filename.endsWith(".txt")
    || filename.endsWith(".md")
    || contentType.startsWith("text/plain")
    || contentType === "text/markdown"
}

async function buildLocalAttachmentDescriptor(file) {
  const extractedText = shouldKeepFrontendTextExtraction(file)
    ? await readFileAsText(file)
    : ""

  return {
    filename: file.name,
    contentType: file.type || "application/octet-stream",
    size: file.size,
    base64Data: await readFileAsBase64(file),
    extractedText
  }
}

async function handleCreationAttachmentsPreview() {
  if (!creationAttachments) {
    return
  }

  const files = Array.from(creationAttachments.files || [])
  if (files.length === 0) {
    trackMailEvent("creation_attachments_cleared", { workflow: "creation" })
    renderAttachmentPreview(creationAttachmentsPreview, [])
    return
  }

  const attachments = await Promise.all(files.map(buildLocalAttachmentDescriptor))
  trackMailEvent("creation_attachments_added", {
    workflow: "creation",
    metadata: {
      count: attachments.length,
      filenames: attachments.map((attachment) => attachment.filename)
    }
  })

  renderAttachmentPreview(creationAttachmentsPreview, attachments)
}

async function handleReceivedAttachmentsPreview() {
  if (!receivedAttachments) {
    return
  }

  const files = Array.from(receivedAttachments.files || [])
  if (files.length === 0) {
    trackMailEvent("reply_attachments_cleared", { workflow: "reply" })
    renderAttachmentPreview(receivedAttachmentsPreview, [])
    return
  }

  const attachments = await Promise.all(files.map(buildLocalAttachmentDescriptor))
  trackMailEvent("reply_attachments_added", {
    workflow: "reply",
    metadata: {
      count: attachments.length,
      filenames: attachments.map((attachment) => attachment.filename)
    }
  })

  renderAttachmentPreview(receivedAttachmentsPreview, attachments, { received: true })
}

function setAutomaticProcessingFeedback(message, tone = "info") {
  if (!automaticProcessingFeedback) return
  automaticProcessingFeedback.textContent = message
  automaticProcessingFeedback.classList.remove("is-info", "is-success", "is-error")
  automaticProcessingFeedback.classList.add("form-feedback", `is-${tone}`)
}

function setAutomaticProcessingContext(message) {
  if (!automaticProcessingContext) return
  automaticProcessingContext.textContent = message
}

function updateAutomaticProcessingButtons() {
  if (automaticProcessingStartBtn) {
    automaticProcessingStartBtn.disabled = automationState.running
  }
  if (automaticProcessingStopBtn) {
    automaticProcessingStopBtn.disabled = !automationState.running
  }
}

function resolveProviderHint(email) {
  const normalizedEmail = (email || "").trim().toLowerCase()
  const domain = normalizedEmail.split("@")[1] || ""

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return "Fournisseur détecté : Gmail. L'application ouvrira la connexion sécurisée Google."
  }

  if (!domain) {
    return "Le fournisseur sera détecté automatiquement à partir de l'adresse saisie."
  }

  return `Fournisseur détecté : ${domain}. La connexion sécurisée sera alignée sur ce fournisseur quand son connecteur sera disponible.`
}

function formatMailboxDate(value) {
  if (!value) return ""
  return new Date(value).toLocaleString("fr-FR")
}

function updateMailboxProviderHint() {
  if (!mailboxProviderHint) return
  mailboxProviderHint.textContent = resolveProviderHint(mailboxEmail?.value || "")
}

function updateMailboxActionButtons(hasConnectedMailbox = false) {
  if (mailboxConnectBtn) {
    mailboxConnectBtn.classList.toggle("send-button", !hasConnectedMailbox)
  }

  if (mailboxRefreshBtn) {
    mailboxRefreshBtn.classList.toggle("send-button", hasConnectedMailbox)
  }
}

function renderMailboxSharingSummary() {
  if (!mailboxSharingModeSummary || !mailboxSharingModeHelp) {
    return
  }

  if (currentMailboxSharingEnabled) {
    mailboxSharingModeSummary.innerHTML = "<strong>Mode :</strong> Multi-utilisateur"
    mailboxSharingModeHelp.textContent = "La sélection d'un mail dans la liste le verrouille pour le traitement jusqu'à validation, rejet, suppression ou expiration du délai."
    return
  }

  mailboxSharingModeSummary.innerHTML = "<strong>Mode :</strong> Mono-utilisateur"
  mailboxSharingModeHelp.textContent = "Le mode multi-utilisateur n'est pas actif sur cette boîte."
}

function stopCollaborationRefresh() {
  if (collaborationRefreshIntervalId) {
    window.clearInterval(collaborationRefreshIntervalId)
    collaborationRefreshIntervalId = null
  }
}

function setCollaborationIndicator(state = "neutral", message = "Aucun mail ouvert.") {
  if (!mailCollaborationIndicator || !mailCollaborationText) {
    return
  }

  const labels = {
    neutral: "Multi désactivé",
    free: "Libre",
    busy: "Occupé",
    self: "Pris en charge"
  }

  mailCollaborationIndicator.textContent = labels[state] || labels.neutral
  mailCollaborationIndicator.classList.remove("is-neutral", "is-free", "is-busy", "is-self")
  mailCollaborationIndicator.classList.add(`is-${state}`)
  mailCollaborationText.textContent = message
}

function applyMailboxSharingModeUi(sharingEnabled) {
  currentMailboxSharingFeatureEnabled = Boolean(sharingEnabled)
  currentMailboxSharingEnabled = Boolean(sharingEnabled)
  renderMailboxSharingSummary()
}

function describeMessageAvailability(message) {
  const collaboration = message?.collaboration
  if (!currentMailboxSharingEnabled) {
    return {
      state: "neutral",
      text: "Mode mono-utilisateur actif pour cette boîte."
    }
  }

  if (!collaboration) {
    return {
      state: "free",
      text: "Aucun verrou actif sur ce mail."
    }
  }

  if (collaboration.lockedByCurrentAccount || collaboration.assignedToCurrentAccount) {
    return {
      state: "self",
      text: "Ce mail est actuellement pris en charge par votre compte."
    }
  }

  if (collaboration.lockedByAnotherAccount) {
    return {
      state: "busy",
      text: "Ce mail est actuellement occupé par un autre utilisateur."
    }
  }

  return {
    state: "free",
    text: "Ce mail est libre."
  }
}

async function refreshCurrentMessageCollaboration() {
  if (!currentOpenedMessage?.id || !currentMailboxConnectionId) {
    return
  }

  try {
    const refreshResponse = await fetch("/api/mailbox/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: currentMailboxConnectionId,
        messageId: currentOpenedMessage.id
      })
    })
    const refreshResult = await refreshResponse.json()
    if (!refreshResponse.ok || !refreshResult.ok) {
      return
    }

    currentOpenedMessage = {
      ...currentOpenedMessage,
      collaboration: refreshResult.message?.collaboration || currentOpenedMessage.collaboration
    }
    const refreshedAvailability = describeMessageAvailability(currentOpenedMessage)
    setCollaborationIndicator(refreshedAvailability.state, refreshedAvailability.text)
  } catch (_) {
    // L'UI garde le dernier état connu.
  }
}

function buildInboxMessageCard(message) {
  const safeSubject = message.subject || "(Sans objet)"
  const safeFrom = message.from || "Expediteur inconnu"
  const safeDate = message.date || ""
  const classification = message.analysis?.categoryLabel || "En attente"
  const priority = message.analysis?.priorityLabel || "En attente"
  const collaboration = describeMessageAvailability(message)
  return `
    <article class="account-summary-card mailbox-message-card ${collaboration.state === "busy" ? "is-busy" : collaboration.state === "free" ? "is-free" : ""}">
      <p class="account-summary-title">${safeSubject}</p>
      <p class="settings-help"><strong>De :</strong> ${safeFrom}</p>
      <p class="settings-help"><strong>Date :</strong> ${safeDate || "Non renseignee"}</p>
      <p class="settings-help"><strong>ID :</strong> ${message.id}</p>
      <p class="settings-help"><strong>Classification :</strong> ${classification}</p>
      <p class="settings-help"><strong>Priorité :</strong> ${priority}</p>
      <p class="settings-help"><strong>Disponibilité :</strong> ${collaboration.state === "busy" ? "Occupé" : collaboration.state === "self" ? "Pris en charge" : collaboration.state === "free" ? "Libre" : "Non applicable"}</p>
      <p class="settings-help">${message.snippet || ""}</p>
      <div class="mail-actions">
        <button class="action-button send-button" type="button" data-mailbox-open="${message.id}">Ouvrir dans Répondre au mail</button>
      </div>
    </article>
  `
}

function isSystemMailboxMessage(message) {
  const from = String(message?.from || "").toLowerCase()
  const subject = String(message?.subject || "").toLowerCase()

  if (from.includes("no-reply@accounts.google.com") || from.includes("no-reply@google.com")) {
    return true
  }

  if (subject.includes("google account") || subject.includes("compte google")) {
    return true
  }

  return false
}

function buildMailboxConnectionCard(connection) {
  const action = connection.connection_status === "connected"
    ? `
      <button class="action-button send-button" type="button" data-mailbox-load="${connection.id}">Charger l'Inbox</button>
      <button class="action-button delete-button" type="button" data-mailbox-disconnect="${connection.id}" data-mailbox-email="${connection.mailbox_email}">Déconnecter</button>
      <button class="action-button delete-button" type="button" data-mailbox-disconnect="${connection.id}" data-mailbox-email="${connection.mailbox_email}">Supprimer la connexion</button>
    `
    : `<button class="action-button delete-button" type="button" data-mailbox-disconnect="${connection.id}" data-mailbox-email="${connection.mailbox_email}">Supprimer</button>`

  return `
    <article class="account-summary-card mailbox-message-card">
      <p class="account-summary-title">${connection.mailbox_email}</p>
      <p class="settings-help"><strong>Fournisseur :</strong> ${connection.provider_label}</p>
      <p class="settings-help"><strong>Authentification :</strong> ${connection.auth_type}</p>
      <p class="settings-help"><strong>Statut :</strong> ${connection.connection_status}</p>
      <p class="settings-help"><strong>Dernière synchro :</strong> ${formatMailboxDate(connection.last_sync_at)}</p>
      <p class="settings-help"><strong>Dernière erreur :</strong> ${connection.last_error || "Aucune"}</p>
      <div class="mail-actions">${action}</div>
    </article>
  `
}

function renderInbox(messages) {
  if (!mailboxMessagesList) return
  const filteredMessages = Array.isArray(messages)
    ? messages.filter((message) => !isSystemMailboxMessage(message))
    : []
  currentInboxMessages = filteredMessages

  mailboxMessagesList.innerHTML = filteredMessages.length > 0
    ? filteredMessages.map(buildInboxMessageCard).join("")
    : '<p class="settings-help">Aucun mail trouvé dans l\'Inbox.</p>'
}

function updateInboxMessageCollaboration(messageId, collaboration) {
  if (!messageId || !Array.isArray(currentInboxMessages) || !currentInboxMessages.length) {
    return
  }

  currentInboxMessages = currentInboxMessages.map((message) => {
    if (message.id !== messageId) {
      return message
    }

    return {
      ...message,
      collaboration: collaboration || {
        collaborationState: "available",
        lockedByCurrentAccount: false,
        assignedToCurrentAccount: false,
        lockedByAnotherAccount: false
      }
    }
  })

  renderInbox(currentInboxMessages)
}

function renderMailboxConnections(connections) {
  if (!mailboxConnectionsList) return
  knownMailboxConnections = Array.isArray(connections) ? connections : []
  updateMailboxActionButtons(
    knownMailboxConnections.some((connection) => connection.connection_status === "connected")
  )
  mailboxConnectionsList.innerHTML = Array.isArray(connections) && connections.length > 0
    ? connections.map(buildMailboxConnectionCard).join("")
    : '<p class="settings-help">Aucune connexion enregistrée pour le moment.</p>'
}

function resetMailboxUiState() {
  currentMailboxConnectionId = ""
  currentMailboxSharingEnabled = false
  currentMailboxSharingFeatureEnabled = false
  knownMailboxConnections = []
  currentInboxMessages = []
  stopCollaborationRefresh()
  if (mailboxEmail) {
    mailboxEmail.value = ""
  }
  applyMailboxSharingModeUi(false)
  setCollaborationIndicator("neutral", "Aucun mail ouvert.")
  updateMailboxProviderHint()
  updateMailboxActionButtons(false)
  renderMailboxConnections([])
  renderInbox([])
  setReplyAttachmentsInfo("Aucune pièce jointe détectée.", "info")
  stopAutomaticProcessing("Traitement automatique arrêté : aucune boîte mail connectée.", "info")
}

function pickDefaultConnectedConnection(connections) {
  if (!Array.isArray(connections) || connections.length === 0) {
    return null
  }

  return connections.find((connection) => connection.id === currentMailboxConnectionId)
    || connections.find((connection) => connection.is_default && connection.connection_status === "connected")
    || connections.find((connection) => connection.connection_status === "connected")
    || null
}

function findConnectedMailboxForEmail(email) {
  const normalizedEmail = (email || "").trim().toLowerCase()
  if (!normalizedEmail) {
    return null
  }

  return knownMailboxConnections.find((connection) =>
    connection.mailbox_email === normalizedEmail && connection.connection_status === "connected"
  ) || null
}

function getTodayString() {
  const now = new Date()

  return now.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
}

function loadCreationDefaults() {
  if (mailDate) {
    mailDate.value = getTodayString()
  }

  const storedCreationPrompt = getStoredCreationPrompt().trim()

  if (creationPrompt && !creationPrompt.value.trim()) {
    creationPrompt.value = storedCreationPrompt ||
`Tu es un spécialiste de la rédaction de mails.
Rédige un mail clair, professionnel et accessible.
Objectif : répondre de manière polie et concise à la demande de l’interlocuteur.`
    persistCreationPrompt(creationPrompt.value)
  }

  if (creationOutputMailContent && !creationOutputMailContent.value.trim()) {
    creationOutputMailContent.value =
`Bonjour Madame, Monsieur,

Je vous contacte afin de vous transmettre les éléments demandés et de vous apporter les précisions nécessaires concernant votre demande.

Vous trouverez ci-joint les informations utiles. Je reste naturellement à votre disposition pour tout complément ou pour un échange supplémentaire si besoin.

Bien cordialement`
  }

  if (mailSubject && !mailSubject.value) {
    mailSubject.value = "Demande d'informations"
  }
}

function loadReplyDefaults() {
  if (receivedMailContent) {
    receivedMailContent.value =
`From : client@example.com
Date : 14/03/2026
Objet : Demande de précisions sur les délais

Bonjour,

Je souhaiterais connaître les délais moyens de traitement de ma demande ainsi que les documents à fournir pour compléter mon dossier.

Merci par avance pour votre retour.

Bien cordialement`
  }

  setReplyAttachmentsInfo("Aucune pièce jointe détectée.", "info")

  if (replyOutputMailContent) {
    replyOutputMailContent.value =
`Bonjour,

Merci pour votre message.

Les délais moyens de traitement sont actuellement de 5 à 7 jours ouvrés à compter de la réception d’un dossier complet.

Pour finaliser votre demande, merci de nous transmettre les documents suivants :
- une copie de votre pièce d’identité,
- le document de référence lié à votre demande,
- tout justificatif complémentaire utile.

Nous restons à votre disposition pour toute précision complémentaire.

Bien cordialement`
  }
}

function setIndicatorValues({ classification = "En attente", priority = "En attente", showPriority = false } = {}) {
  if (classificationValue) {
    classificationValue.textContent = classification
  }
  if (classificationValueBottom) {
    classificationValueBottom.textContent = classification
  }
  if (priorityValue) {
    priorityValue.textContent = priority
  }
  if (priorityValueBottom) {
    priorityValueBottom.textContent = priority
  }

  priorityGroup?.classList.toggle("hidden-panel", !showPriority)
  priorityGroupBottom?.classList.toggle("hidden-panel", !showPriority)
  if (priorityGroup) {
    priorityGroup.hidden = !showPriority
  }
  if (priorityGroupBottom) {
    priorityGroupBottom.hidden = !showPriority
  }
}

function updateAiIndicators(mode) {
  if (classificationBadge) {
    classificationBadge.textContent = "Classification"
  }
  if (classificationBadgeBottom) {
    classificationBadgeBottom.textContent = "Classification"
  }

  if (priorityBadge) {
    priorityBadge.textContent = "Priorité"
  }
  if (priorityBadgeBottom) {
    priorityBadgeBottom.textContent = "Priorité"
  }

  if (mode === "creation") {
    setIndicatorValues({
      classification: "En attente",
      priority: "En attente",
      showPriority: false
    })
    return
  }

  setIndicatorValues({
    classification: currentMailAnalysis?.categoryLabel || "En attente",
    priority: currentMailAnalysis?.priorityLabel || "En attente",
    showPriority: true
  })
}

function setMode(mode) {
  const isCreation = mode === "creation"
  const normalizedMode = isCreation ? "creation" : "reply"

  trackMailEvent("workflow_mode_changed", { workflow: normalizedMode })
  syncWorkflowTracking(normalizedMode)

  createModeBtn?.classList.toggle("active", isCreation)
  replyModeBtn?.classList.toggle("active", !isCreation)
  createModeBtnBottom?.classList.toggle("active", isCreation)
  replyModeBtnBottom?.classList.toggle("active", !isCreation)

  creationWorkspace?.classList.toggle("hidden-panel", !isCreation)
  replyWorkspace?.classList.toggle("hidden-panel", isCreation)

  if (isCreation) {
    if (creationWorkspace) creationWorkspace.hidden = false
    if (replyWorkspace) replyWorkspace.hidden = true
  } else {
    if (creationWorkspace) creationWorkspace.hidden = true
    if (replyWorkspace) replyWorkspace.hidden = false
  }

  try {
    localStorage.setItem(getSessionStorageKey(LAST_MAIL_MODE_STORAGE_KEY), normalizedMode)
  } catch (_) {
    // Rien de bloquant.
  }

  updateAiIndicators(normalizedMode)
}

function incrementCounter(section, type) {
  trackMailEvent("mail_action_counter_incremented", {
    workflow: section,
    metadata: { counterType: type }
  })
  sessionCounters[section][type] += 1

  if (section === "creation") {
    if (type === "send" && creationSendCount) creationSendCount.textContent = sessionCounters[section][type]
    if (type === "reject" && creationRejectCount) creationRejectCount.textContent = sessionCounters[section][type]
    if (type === "delete" && creationDeleteCount) creationDeleteCount.textContent = sessionCounters[section][type]
  }

  if (section === "reply") {
    if (type === "send" && replySendCount) replySendCount.textContent = sessionCounters[section][type]
    if (type === "reject" && replyRejectCount) replyRejectCount.textContent = sessionCounters[section][type]
    if (type === "delete" && replyDeleteCount) replyDeleteCount.textContent = sessionCounters[section][type]
  }
}

function renderReplyCounters() {
  if (replySendCount) replySendCount.textContent = sessionCounters.reply.send
  if (replyRejectCount) replyRejectCount.textContent = sessionCounters.reply.reject
  if (replyDeleteCount) replyDeleteCount.textContent = sessionCounters.reply.delete
}

async function syncReplyCountersFromServer(connectionId = currentMailboxConnectionId) {
  if (!connectionId) {
    return
  }

  try {
    const response = await fetch(`/api/mailbox/stats?connectionId=${encodeURIComponent(connectionId)}`)
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture des compteurs.")
    }

    sessionCounters.reply.send = Number(result.stats?.validated || 0)
    sessionCounters.reply.reject = Number(result.stats?.rejected || 0)
    sessionCounters.reply.delete = Number(result.stats?.deleted || 0)
    renderReplyCounters()
  } catch (error) {
    console.error(error)
  }
}

function clearReplyWorkspaceAfterProcessing() {
  stopCollaborationRefresh()
  currentOpenedMessage = null
  currentMailAnalysis = null
  setCollaborationIndicator(currentMailboxSharingEnabled ? "free" : "neutral", currentMailboxSharingEnabled ? "Aucun mail ouvert. Le prochain mail pourra être pris en charge." : "Aucun mail ouvert.")

  if (receivedMailContent) {
    receivedMailContent.value = ""
  }

  if (replyOutputMailContent) {
    replyOutputMailContent.value = ""
  }

  syncReceivedAttachmentsInput([])
  renderAttachmentPreview(receivedAttachmentsPreview, [])
  renderAiTrace(replyAiTrace, "")
  setReplyAttachmentsInfo("Aucune pièce jointe détectée.", "info")
  setReplyGenerationFeedback("Sélectionne un mail pour traiter une nouvelle réponse.", "info")
  updateAiIndicators("reply")
}

function getPriorityRank(priority = "normal") {
  const ranks = {
    critical: 4,
    high: 3,
    normal: 2,
    low: 1
  }

  return ranks[priority] || 0
}

function getMessageDateValue(message) {
  const parsed = Date.parse(message?.date || "")
  return Number.isNaN(parsed) ? Number.MAX_SAFE_INTEGER : parsed
}

function getNextAutomaticMessage() {
  if (!Array.isArray(currentInboxMessages) || currentInboxMessages.length === 0) {
    return null
  }

  const visitedIds = new Set(automationState.processedInCurrentPass || [])
  const sortCandidates = (messages) => messages.slice().sort((left, right) => {
    const priorityDelta = getPriorityRank(right.analysis?.priority) - getPriorityRank(left.analysis?.priority)
    if (priorityDelta !== 0) {
      return priorityDelta
    }

    return getMessageDateValue(left) - getMessageDateValue(right)
  })

  const unvisitedCandidates = sortCandidates(
    currentInboxMessages.filter((message) => !visitedIds.has(message.id))
  )

  if (unvisitedCandidates.length > 0) {
    return unvisitedCandidates[0]
  }

  automationState.processedInCurrentPass = []
  const recycledCandidates = sortCandidates(currentInboxMessages)
  return recycledCandidates[0] || null
}

function clearAutomaticProcessingTimers() {
  if (automationState.countdownIntervalId) {
    window.clearInterval(automationState.countdownIntervalId)
    automationState.countdownIntervalId = null
  }

  if (automationState.timeoutId) {
    window.clearTimeout(automationState.timeoutId)
    automationState.timeoutId = null
  }
}

function stopAutomaticProcessing(message = "Traitement automatique arrêté.", tone = "info") {
  automationState.running = false
  automationState.currentMessageId = ""
  automationState.processedInCurrentPass = []
  clearAutomaticProcessingTimers()
  updateAutomaticProcessingButtons()
  setAutomaticProcessingFeedback(message, tone)
  setAutomaticProcessingContext("Aucune campagne automatique en cours.")
}

function startAutomaticCountdown(message) {
  clearAutomaticProcessingTimers()

  let remainingSeconds = automationState.timeoutSeconds
  setAutomaticProcessingContext(`Traitement automatique en cours. Mail : ${message.subject || "(Sans objet)"} | Priorité : ${message.analysis?.priorityLabel || "Normale"} | Temps restant : ${remainingSeconds}s`)

  automationState.countdownIntervalId = window.setInterval(() => {
    remainingSeconds -= 1
    setAutomaticProcessingContext(`Traitement automatique en cours. Mail : ${message.subject || "(Sans objet)"} | Priorité : ${message.analysis?.priorityLabel || "Normale"} | Temps restant : ${Math.max(remainingSeconds, 0)}s`)
  }, 1000)

  automationState.timeoutId = window.setTimeout(async () => {
    await handleAutomaticTimeout()
  }, automationState.timeoutSeconds * 1000)
}

function getSelectedLlm(options = {}) {
  if (options.automatic && automationState.automaticModel) {
    return automationState.automaticModel
  }

  return llmSelectBottom?.value || llmSelect?.value || "deepseek-local"
}

function getSelectedLanguage() {
  return languageSelectBottom?.value || languageSelect?.value || "fr"
}

const INPUT_LANGUAGE_HINTS = {
  fr: ["bonjour", "merci", "veuillez", "cordialement", "demande", "message", "pièce", "rendez-vous", "service", "confirmation", "document"],
  en: ["hello", "please", "thanks", "thank", "regards", "appointment", "document", "message", "request", "confirm", "service"],
  es: ["hola", "gracias", "por favor", "mensaje", "solicitud", "cita", "confirmar", "documento", "servicio"],
  de: ["hallo", "danke", "bitte", "nachricht", "anfrage", "termin", "dokument", "bestaetigung", "bestätigung", "service", "auf deutsch", "deutsch", "audiolesetest", "dies ist"],
  it: ["ciao", "buongiorno", "grazie", "prego", "messaggio", "richiesta", "appuntamento", "documento", "confermare", "servizio"],
  nl: ["hallo", "dank", "alstublieft", "bericht", "verzoek", "afspraak", "document", "bevestiging", "service", "dit is", "een", "het", "nederlands", "audiotest"],
  ar: ["مرحبا", "شكرا", "شكراً", "من فضلك", "رسالة", "موعد", "مستند", "خدمة", "تأكيد"]
}

function normalizeLanguageSample(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
}

function detectInputContentLanguageDetailed(text = "", fallback = getSelectedLanguage()) {
  const raw = String(text || "").trim()
  if (!raw) {
    return { language: fallback, score: 0 }
  }

  if (/[؀-ۿ]/.test(raw)) {
    return { language: "ar", score: 10 }
  }

  const normalized = normalizeLanguageSample(raw)
  const tokenText = ` ${normalized.replace(/[^\p{L}\p{N}'’-]+/gu, " ")} `
  const scores = new Map(Object.keys(INPUT_LANGUAGE_HINTS).map((language) => [language, 0]))

  for (const [language, hints] of Object.entries(INPUT_LANGUAGE_HINTS)) {
    let score = 0
    for (const hint of hints) {
      const normalizedHint = normalizeLanguageSample(hint)
      if (!normalizedHint) continue
      if (tokenText.includes(` ${normalizedHint} `)) {
        score += normalizedHint.includes(" ") ? 3 : 2
      }
    }
    scores.set(language, score)
  }

  if (/[àâçéèêëîïôùûüÿœ]/i.test(raw)) {
    scores.set("fr", (scores.get("fr") || 0) + 2)
  }
  if (/[ñ¡¿]/i.test(raw)) {
    scores.set("es", (scores.get("es") || 0) + 2)
  }
  if (/[äöüß]/i.test(raw)) {
    scores.set("de", (scores.get("de") || 0) + 2)
  }
  if (/[àèéìíîòóù]/i.test(raw)) {
    scores.set("it", (scores.get("it") || 0) + 1)
  }

  const [bestLanguage, bestScore] = [...scores.entries()].sort((left, right) => right[1] - left[1])[0] || [fallback, 0]
  return {
    language: bestScore > 0 ? bestLanguage : fallback,
    score: bestScore
  }
}

function detectInputContentLanguage(text = "", fallback = getSelectedLanguage()) {
  return detectInputContentLanguageDetailed(text, fallback).language
}

function splitInputTextForLanguageDetection(text = "") {
  return String(text || "")
    .match(/[^.!?\n]+(?:[.!?]+|\n+|$)/gu)
    ?.map((segment) => segment.trim())
    .filter(Boolean) || []
}

function collectDetectedInputLanguages(text = "", fallback = getSelectedLanguage()) {
  const segments = splitInputTextForLanguageDetection(text)
  const detected = []

  for (const segment of segments) {
    const result = detectInputContentLanguageDetailed(segment, "")
    if (result.score > 0 && result.language && !detected.includes(result.language)) {
      detected.push(result.language)
    }
  }

  if (!detected.length) {
    const dominant = detectInputContentLanguage(text, fallback)
    if (dominant) {
      detected.push(dominant)
    }
  }

  return detected
}

function detectSegmentInputLanguage(segmentText = "", fallback = "", segmentIndex = 0, segments = [], previousLanguage = "") {
  const direct = detectInputContentLanguageDetailed(segmentText, "")
  if (direct.score > 0) {
    return direct.language
  }

  if (previousLanguage) {
    return previousLanguage
  }

  for (let index = segmentIndex + 1; index < segments.length; index += 1) {
    const next = detectInputContentLanguageDetailed(segments[index]?.text || "", "")
    if (next.score > 0) {
      return next.language
    }
  }

  return fallback || getSelectedLanguage()
}

function getCreationPromptInputLanguage() {
  return detectInputContentLanguage(creationPrompt?.value || "", getSelectedLanguage())
}

function getReceivedMailInputLanguage() {
  return detectInputContentLanguage(receivedMailContent?.value || "", getSelectedLanguage())
}

function formatDetectedLanguageLabel(language = "") {
  const normalized = String(language || "").trim().toLowerCase()
  const labels = {
    fr: "français",
    en: "anglais",
    es: "espagnol",
    de: "allemand",
    it: "italien",
    nl: "néerlandais",
    ar: "arabe"
  }
  return labels[normalized] || normalized || "indéterminée"
}

function formatDetectedLanguagesText(text = "", fallback = getSelectedLanguage()) {
  if (!String(text || "").trim()) {
    return "Langue détectée : en attente"
  }

  const detected = collectDetectedInputLanguages(text, fallback)
  if (!detected.length) {
    return "Langue détectée : en attente"
  }

  if (detected.length === 1) {
    return `Langue détectée : ${formatDetectedLanguageLabel(detected[0])}`
  }

  return `Langues détectées : ${detected.map((language) => formatDetectedLanguageLabel(language)).join(", ")}`
}

function updateDetectedInputLanguages() {
  if (creationPromptDetectedLanguage) {
    creationPromptDetectedLanguage.textContent = formatDetectedLanguagesText(
      creationPrompt?.value || "",
      getSelectedLanguage()
    )
  }

  if (receivedMailDetectedLanguage) {
    receivedMailDetectedLanguage.textContent = formatDetectedLanguagesText(
      receivedMailContent?.value || "",
      getSelectedLanguage()
    )
  }
}

function isRtlLanguage(language = "fr") {
  return String(language || "").trim().toLowerCase() === "ar"
}

function applyLanguageDirection(language = getSelectedLanguage()) {
  ;[
    creationPrompt,
    receivedMailContent,
    creationOutputMailContent,
    replyOutputMailContent,
    mailSubject
  ].forEach((element) => {
    if (!element) {
      return
    }
    element.dir = "auto"
    element.style.textAlign = ""
  })
}

function normalizeSuggestionText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function getSuggestionDictionary(language = getSelectedLanguage()) {
  return EDITOR_SUGGESTION_LIBRARY[language] || EDITOR_SUGGESTION_LIBRARY.fr
}

function getWordSuggestions(dictionary) {
  const language = getSelectedLanguage()
  const externalWords = (window.PredictiveDictionary?.getWords(language) || []).filter((word) => !/\s/.test(String(word || "").trim()))
  if (externalWords.length) {
    return externalWords
  }

  return (dictionary.words || []).filter((word) => !/\s/.test(String(word || "").trim()))
}

function getPhraseSuggestions(dictionary, mode = "reply") {
  return [
    ...(dictionary.quick || []),
    ...(dictionary.nouns || []),
    ...(dictionary.body || []),
    ...(mode === "reply" ? (dictionary.reply || []) : (dictionary.creation || [])),
    ...(dictionary.closings || [])
  ]
}

function getEditorSuggestionState(textarea) {
  const value = String(textarea?.value || "")
  const cursor = Number.isInteger(textarea?.selectionStart) ? textarea.selectionStart : value.length
  let fragmentStart = cursor

  while (fragmentStart > 0 && /[0-9A-Za-zÀ-ÿ_\-'\u0600-\u06FF]/.test(value[fragmentStart - 1])) {
    fragmentStart -= 1
  }

  const fragment = value.slice(fragmentStart, cursor)
  const beforeCursor = value.slice(0, cursor)
  return {
    value,
    cursor,
    fragmentStart,
    fragment,
    normalizedFragment: normalizeSuggestionText(fragment),
    beforeCursor,
    trimmedBeforeCursor: beforeCursor.trim(),
    hasActiveWordFragment: Boolean(normalizeSuggestionText(fragment))
  }
}

function rankWordCandidates(wordPool, normalizedFragment) {
  const exactPrefixMatches = []
  const secondaryMatches = []

  wordPool.forEach((candidate) => {
    const normalizedCandidate = normalizeSuggestionText(candidate)
    if (!normalizedCandidate || !normalizedFragment) {
      return
    }

    if (normalizedCandidate.startsWith(normalizedFragment)) {
      exactPrefixMatches.push(candidate)
      return
    }

    const parts = normalizedCandidate.split(/[\s,.;:!?()\-]+/).filter(Boolean)
    if (parts.some((part) => part.startsWith(normalizedFragment))) {
      secondaryMatches.push(candidate)
    }
  })

  return [...exactPrefixMatches, ...secondaryMatches]
    .filter((candidate, index, array) => array.findIndex((item) => normalizeSuggestionText(item) === normalizeSuggestionText(candidate)) === index)
}

async function preloadPredictiveDictionary(language = getSelectedLanguage()) {
  if (!window.PredictiveDictionary?.load) {
    return
  }

  await window.PredictiveDictionary.load(language)
}

function buildSuggestionCandidates(textarea, mode = "reply") {
  const dictionary = getSuggestionDictionary()
  const state = getEditorSuggestionState(textarea)
  const wordPool = getWordSuggestions(dictionary)
  const phrasePool = getPhraseSuggestions(dictionary, mode)
  const pools = [...wordPool, ...phrasePool]

  if (!state.trimmedBeforeCursor) {
    pools.unshift(...(dictionary.greetings || []))
  }

  if (/\n\s*$/.test(state.beforeCursor)) {
    pools.unshift(...(dictionary.body || []))
  }

  const seen = new Set()
  const uniqueCandidates = pools.filter((candidate) => {
    const key = normalizeSuggestionText(candidate)
    if (!key || seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })

  if (!state.normalizedFragment) {
    return {
      words: [...wordPool].slice(0, 4),
      phrases: [...(dictionary.greetings || []), ...phrasePool]
        .filter((candidate, index, array) => array.findIndex((item) => normalizeSuggestionText(item) === normalizeSuggestionText(candidate)) === index)
        .slice(0, 4)
    }
  }

  const rankedWords = rankWordCandidates(wordPool, state.normalizedFragment)
  if (state.hasActiveWordFragment) {
    const predictiveWords = window.PredictiveDictionary?.suggest
      ? window.PredictiveDictionary.suggest(state.fragment, getSelectedLanguage(), 5)
      : rankedWords.slice(0, 5)

    return {
      words: predictiveWords.length ? predictiveWords : rankedWords.slice(0, 5),
      phrases: []
    }
  }

  const wordStartsWithMatches = []
  const phraseStartsWithMatches = []
  const includesWordMatches = []

  uniqueCandidates.forEach((candidate) => {
    const normalizedCandidate = normalizeSuggestionText(candidate)
    const isWordCandidate = wordPool.some((word) => normalizeSuggestionText(word) === normalizedCandidate)
    if (normalizedCandidate.startsWith(state.normalizedFragment)) {
      if (isWordCandidate) {
        wordStartsWithMatches.push(candidate)
      } else {
        phraseStartsWithMatches.push(candidate)
      }
      return
    }

    const words = normalizedCandidate.split(/[\s,.;:!?()\-]+/).filter(Boolean)
    if (words.some((word) => word.startsWith(state.normalizedFragment))) {
      includesWordMatches.push(candidate)
    }
  })

  const phraseMatches = [...phraseStartsWithMatches, ...includesWordMatches]
    .filter((candidate, index, array) => array.findIndex((item) => normalizeSuggestionText(item) === normalizeSuggestionText(candidate)) === index)
    .slice(0, 4)

  return {
    words: wordStartsWithMatches.slice(0, 6),
    phrases: phraseMatches
  }
}

function renderSuggestionSection(title, suggestions, primary = false) {
  if (!Array.isArray(suggestions) || !suggestions.length) {
    return ""
  }

  return `
    <div class="suggestion-section">
      <p class="suggestion-section-title">${title}</p>
      <div class="suggestion-chip-list">
        ${suggestions.map((suggestion, index) => `<button class="suggestion-chip${primary && index === 0 ? " is-primary" : ""}" type="button" data-suggestion-value="${encodeURIComponent(suggestion)}">${suggestion}</button>`).join("")}
      </div>
    </div>
  `
}

function renderSuggestionChips(container, textarea, mode = "reply") {
  if (!container || !textarea) {
    return
  }

  const suggestions = buildSuggestionCandidates(textarea, mode)
  const words = suggestions.words || []
  const phrases = suggestions.phrases || []
  const signature = JSON.stringify({ words, phrases })
  const previousSignature = container.getAttribute("data-suggestion-signature") || ""

  if (signature === previousSignature) {
    return
  }

  if (!words.length && !phrases.length) {
    container.innerHTML = '<p class="settings-help">Aucune suggestion utile pour le moment.</p>'
    container.setAttribute("data-suggestion-signature", signature)
    return
  }

  container.innerHTML = [
    renderSuggestionSection("Mots suggérés", words, true),
    renderSuggestionSection("Formules utiles", phrases, !words.length)
  ].filter(Boolean).join("")
  container.setAttribute("data-suggestion-signature", signature)
}

function insertSuggestionIntoTextarea(textarea, suggestion) {
  if (!textarea || !suggestion) {
    return
  }

  const state = getEditorSuggestionState(textarea)
  const before = state.value.slice(0, state.fragmentStart)
  const after = state.value.slice(state.cursor)
  const needsLeadingSpace = before && !/\s$/.test(before) && !/^[,.;:!?)]/.test(suggestion)
  const needsTrailingSpace = !/\s$/.test(after) && !/^[,.;:!?)]/.test(after) && !/[,:;!?]$/.test(suggestion)
  const insertion = `${needsLeadingSpace ? " " : ""}${suggestion}${needsTrailingSpace ? " " : ""}`
  const nextValue = `${before}${insertion}${after}`
  const nextCursor = before.length + insertion.length

  textarea.value = nextValue
  textarea.focus()
  textarea.setSelectionRange(nextCursor, nextCursor)
  textarea.dispatchEvent(new Event("input", { bubbles: true }))
}

function bindSuggestionAssistant(textarea, container, mode = "reply") {
  if (!textarea || !container) {
    return
  }

  const state = {
    timerId: null
  }
  suggestionAssistantState.set(textarea, state)

  const refreshNow = () => renderSuggestionChips(container, textarea, mode)
  const refreshSoon = () => {
    window.clearTimeout(state.timerId)
    state.timerId = window.setTimeout(() => {
      refreshNow()
    }, 70)
  }

  textarea.addEventListener("input", refreshSoon)
  textarea.addEventListener("focus", refreshNow)

  container.addEventListener("click", (event) => {
    const button = event.target.closest("[data-suggestion-value]")
    if (!button) {
      return
    }

    const suggestion = decodeURIComponent(button.getAttribute("data-suggestion-value") || "")
    insertSuggestionIntoTextarea(textarea, suggestion)
    refreshNow()
  })

  refreshNow()
}

function refreshAllSuggestionAssistants() {
  renderSuggestionChips(creationOutputSuggestions, creationOutputMailContent, "creation")
  renderSuggestionChips(replyOutputSuggestions, replyOutputMailContent, "reply")
}

function applyPredictiveDictionaryVisibility() {
  const settings = getStoredMailSettings()
  const enabled = Boolean(settings.predictiveDictionaryEnabled)

  document.querySelectorAll("[data-suggestion-assistant]").forEach((panel) => {
    panel.classList.toggle("hidden-panel", !enabled)
    panel.setAttribute("aria-hidden", enabled ? "false" : "true")
  })

  if (enabled) {
    refreshAllSuggestionAssistants()
  }
}

function syncLlmSelectors(source = "top") {
  const selectedValue = source === "bottom"
    ? (llmSelectBottom?.value || "mistral-local")
    : (llmSelect?.value || "mistral-local")

  if (llmSelect && llmSelect.value !== selectedValue) {
    llmSelect.value = selectedValue
  }

  if (llmSelectBottom && llmSelectBottom.value !== selectedValue) {
    llmSelectBottom.value = selectedValue
  }

  persistUiValue(SELECTED_LLM_STORAGE_KEY, selectedValue)
}

function countWords(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

function syncLanguageSelectors(source = "top") {
  const selectedValue = source === "bottom"
    ? (languageSelectBottom?.value || "fr")
    : (languageSelect?.value || "fr")

  if (languageSelect && languageSelect.value !== selectedValue) {
    languageSelect.value = selectedValue
  }

  if (languageSelectBottom && languageSelectBottom.value !== selectedValue) {
    languageSelectBottom.value = selectedValue
  }

  persistUiValue(SELECTED_LANGUAGE_STORAGE_KEY, selectedValue)
  applyLanguageDirection(selectedValue)
  preloadPredictiveDictionary(selectedValue).finally(() => {
    refreshAllSuggestionAssistants()
  })
}

async function generateCreationDraft() {
  if (!creationPrompt || !creationOutputMailContent) {
    return
  }

  const selectedModel = getSelectedLlm()

  trackMailEvent("creation_draft_generate_started", {
    workflow: "creation",
    metadata: {
      promptLength: creationPrompt.value.trim().length,
      promptWordCount: countWords(creationPrompt.value),
      model: selectedModel
    }
  })
  startMailTimer("creation_draft_generation", {
    workflow: "creation",
    model: selectedModel
  })

  const creationAttachmentFiles = Array.from(creationAttachments?.files || [])
  const attachments = await Promise.all(creationAttachmentFiles.map(buildLocalAttachmentDescriptor))

  const payload = {
    to: mailTo?.value.trim() || "",
    cc: mailCc?.value.trim() || "",
    bcc: mailBcc?.value.trim() || "",
    subject: mailSubject?.value.trim() || "",
    prompt: creationPrompt.value.trim(),
    attachments,
    language: getSelectedLanguage()
  }

  creationGenerateBtn && (creationGenerateBtn.disabled = true)
  creationRegenerateBtn && (creationRegenerateBtn.disabled = true)
  setGenerationFeedback(`Generation en cours avec ${selectedModel}...`, "info")

  try {
    const response = await fetch("/api/mail/create-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payload,
        options: {
          model: selectedModel
        }
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || result.details || "Erreur de generation du brouillon.")
    }

    if (mailSubject && result.draft?.subject) {
      mailSubject.value = result.draft.subject
      persistUiValue(CREATION_SUBJECT_STORAGE_KEY, mailSubject.value)
    }

    creationOutputMailContent.value = result.draft?.body || ""
    persistUiValue(CREATION_DRAFT_STORAGE_KEY, creationOutputMailContent.value)
    refreshAllSuggestionAssistants()

    stopMailTimer("creation_draft_generation", "creation_draft_generate_completed", {
      workflow: "creation",
      metadata: {
        model: selectedModel,
        provider: result.meta?.provider || "",
        fallback: Boolean(result.meta?.fallback),
        attachmentCount: result.meta?.attachmentCount || 0,
        outputWordCount: countWords(result.draft?.body || ""),
        outputCharacterCount: String(result.draft?.body || "").length
      }
    })

    if (result.meta?.fallback) {
      setGenerationFeedback(`Brouillon genere en mode secours. Cause : ${result.meta.error || "indisponibilite du modele"}. Contexte transmis : prompt + ${result.meta.attachmentCount || 0} piece(s) jointe(s), dont ${result.meta.attachmentsWithExtractedText || 0} avec contenu exploitable.`, "error")
    } else {
      setGenerationFeedback(`Brouillon genere avec ${result.meta.provider}. Contexte transmis : prompt + ${result.meta.attachmentCount || 0} piece(s) jointe(s), dont ${result.meta.attachmentsWithExtractedText || 0} avec contenu exploitable.`, "success")
    }
    renderAiTrace(creationAiTrace, result.meta?.aiInputPreview || "")
  } catch (error) {
    stopMailTimer("creation_draft_generation", "creation_draft_generate_failed", {
      workflow: "creation",
      metadata: {
        model: selectedModel,
        error: error.message || "Erreur de generation du brouillon."
      }
    })
    setGenerationFeedback(error.message || "Erreur de generation du brouillon.", "error")
  } finally {
    creationGenerateBtn && (creationGenerateBtn.disabled = false)
    creationRegenerateBtn && (creationRegenerateBtn.disabled = false)
  }
}

async function generateReplyDraft(options = {}) {
  if (!receivedMailContent || !replyOutputMailContent) {
    return
  }

  const selectedModel = getSelectedLlm({ automatic: options.automatic })
  const attachmentPayload = buildAttachmentPayloadForGeneration(currentOpenedMessage?.attachments || [])

  trackMailEvent("reply_draft_generate_started", {
    workflow: "reply",
    metadata: {
      automatic: Boolean(options.automatic),
      receivedLength: receivedMailContent.value.trim().length,
      receivedWordCount: countWords(receivedMailContent.value),
      model: selectedModel
    }
  })
  startMailTimer("reply_draft_generation", {
    workflow: "reply",
    automatic: Boolean(options.automatic),
    model: selectedModel
  })

  replyGenerateBtn && (replyGenerateBtn.disabled = true)
  replyRegenerateBtn && (replyRegenerateBtn.disabled = true)
  setReplyGenerationFeedback(`Generation en cours avec ${selectedModel}...`, "info")

  try {
    const response = await fetch("/api/mail/reply-draft", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        payload: {
          receivedMail: receivedMailContent.value.trim(),
          receivedAttachmentsSummary: attachmentPayload.summary,
          receivedAttachments: attachmentPayload.details,
          language: getSelectedLanguage()
        },
        options: {
          model: selectedModel
        }
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || result.details || "Erreur de generation de la reponse.")
    }

    replyOutputMailContent.value = result.draft?.body || ""
    refreshAllSuggestionAssistants()

    stopMailTimer("reply_draft_generation", "reply_draft_generate_completed", {
      workflow: "reply",
      metadata: {
        automatic: Boolean(options.automatic),
        model: selectedModel,
        provider: result.meta?.provider || "",
        fallback: Boolean(result.meta?.fallback),
        attachmentCount: result.meta?.attachmentCount || 0,
        outputWordCount: countWords(result.draft?.body || ""),
        outputCharacterCount: String(result.draft?.body || "").length
      }
    })

    if (result.meta?.fallback) {
      setReplyGenerationFeedback(`Reponse generee en mode secours. Cause : ${result.meta.error || "indisponibilite du modele"}. Contexte transmis : texte du mail + ${result.meta.attachmentCount || 0} piece(s) jointe(s).`, "error")
    } else {
      setReplyGenerationFeedback(`Reponse generee avec ${result.meta.provider}. Contexte transmis : texte du mail + ${result.meta.attachmentCount || 0} piece(s) jointe(s), dont ${result.meta.attachmentsWithExtractedText || 0} avec contenu exploitable.`, "success")
    }
    renderAiTrace(replyAiTrace, result.meta?.aiInputPreview || "")

    return true
  } catch (error) {
    stopMailTimer("reply_draft_generation", "reply_draft_generate_failed", {
      workflow: "reply",
      metadata: {
        automatic: Boolean(options.automatic),
        model: selectedModel,
        error: error.message || "Erreur de generation de la reponse."
      }
    })
    setReplyGenerationFeedback(error.message || "Erreur de generation de la reponse.", "error")
    return false
  } finally {
    replyGenerateBtn && (replyGenerateBtn.disabled = false)
    replyRegenerateBtn && (replyRegenerateBtn.disabled = false)
  }
}

async function connectMailbox() {
  const email = mailboxEmail?.value.trim().toLowerCase() || ""
  trackMailEvent("mailbox_connect_requested", {
    workflow: getCurrentWorkflowMode(),
    metadata: { emailDomain: email.split("@")[1] || "" }
  })
  if (!email) {
    setMailboxFeedback("Renseigne l'adresse de la boîte mail.", "error")
    return
  }

  if (knownMailboxConnections.length === 0) {
    await loadMailboxConnections()
  }

  let existingConnection = findConnectedMailboxForEmail(email)
  if (!existingConnection) {
    const connections = await loadMailboxConnections()
    existingConnection = pickDefaultConnectedConnection(
      connections.filter((connection) => connection.mailbox_email === email)
    )
  }

  if (existingConnection) {
    currentMailboxConnectionId = existingConnection.id
    setMailboxFeedback(`Boîte déjà connectée : ${existingConnection.mailbox_email}. Rechargement direct de l'Inbox.`, "success")
    loadInbox(existingConnection.id)
    return
  }

  mailboxConnectBtn && (mailboxConnectBtn.disabled = true)
  mailboxRefreshBtn && (mailboxRefreshBtn.disabled = true)
  setMailboxFeedback("Préparation de la connexion sécurisée fournisseur...", "info")

  try {
    const response = await fetch("/api/mailbox/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de préparation de connexion à la boîte mail.")
    }

    if (result.reusedExisting && result.connection?.id) {
      currentMailboxConnectionId = result.connection.id
      setMailboxFeedback(`Boîte déjà connectée : ${result.connection.mailbox_email}. Rechargement direct de l'Inbox.`, "success")
      await loadMailboxConnections()
      await loadInbox(result.connection.id)
      return
    }

    if (mailboxProviderHint && result.provider?.authHint) {
      mailboxProviderHint.textContent = `Fournisseur détecté : ${result.provider.label}. ${result.provider.authHint}`
    }

    setMailboxFeedback("Redirection vers la connexion sécurisée du fournisseur...", "success")
    window.location.assign(result.redirectUrl)
  } catch (error) {
    setMailboxFeedback(error.message || "Erreur de connexion a la boite mail.", "error")
  } finally {
    mailboxConnectBtn && (mailboxConnectBtn.disabled = false)
    mailboxRefreshBtn && (mailboxRefreshBtn.disabled = false)
  }
}

async function loadMailboxConnections() {
  try {
    const response = await fetch("/api/mailbox/connections")
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture des connexions.")
    }

    renderMailboxConnections(result.connections || [])

    const defaultConnection = pickDefaultConnectedConnection(result.connections || [])
    if (defaultConnection) {
      currentMailboxConnectionId = defaultConnection.id
      if (mailboxEmail) {
        mailboxEmail.value = defaultConnection.mailbox_email || ""
      }
      if (mailboxProviderHint) {
        mailboxProviderHint.textContent = `Fournisseur détecté : ${defaultConnection.provider_label}. Connexion réutilisable déjà enregistrée.`
      }
    }

    updateMailboxActionButtons(Boolean(defaultConnection))

    return result.connections || []
  } catch (error) {
    renderMailboxConnections([])
    updateMailboxActionButtons(false)
    setMailboxFeedback(error.message || "Erreur de lecture des connexions boîte mail.", "error")
    return []
  }
}

async function loadInbox(connectionId = currentMailboxConnectionId) {
  trackMailEvent("mailbox_inbox_refresh_requested", {
    metadata: { connectionId: connectionId || "" }
  })
  if (!connectionId) {
    setMailboxFeedback("Aucune boîte mail connectée n'est encore disponible.", "error")
    return
  }

  currentMailboxConnectionId = connectionId
  setMailboxFeedback("Chargement de l'Inbox connectée...", "info")

  try {
    const response = await fetch("/api/mailbox/inbox", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId,
        limit: 25
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture de l'Inbox.")
    }

    applyMailboxSharingModeUi(Boolean(result.mailboxResource?.sharing_enabled))
    renderInbox(result.inbox || [])
    await syncReplyCountersFromServer(connectionId)
    setMailboxFeedback(`Inbox chargée pour ${result.connection?.mailbox_email || "la boîte mail connectée"}.`, "success")
  } catch (error) {
    await loadMailboxConnections()
    const message = error.message || "Erreur de lecture de l'Inbox."
    if (/expired or revoked/i.test(message)) {
      setMailboxFeedback("Le jeton Gmail a expiré ou a été révoqué. Déconnecte puis reconnecte la boîte mail Google.", "error")
    } else {
      setMailboxFeedback(message, "error")
    }
  }
}

async function disconnectMailbox(connectionId, mailboxEmailValue) {
  try {
    const response = await fetch("/api/mailbox/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de suppression de connexion.")
    }

    resetMailboxUiState()
    await loadMailboxConnections()
    setMailboxFeedback(`Connexion supprimée pour ${mailboxEmailValue || result.connection?.mailbox_email || "la boîte mail"}.`, "success")
  } catch (error) {
    setMailboxFeedback(error.message || "Erreur de suppression de connexion boîte mail.", "error")
  }
}

async function openInboxMessage(messageId) {
  trackMailEvent("reply_mail_open_requested", { workflow: "reply", messageId })
  if (!currentMailboxConnectionId) {
    setMailboxFeedback("Reconnecte d'abord une boîte mail pour ouvrir un message.", "error")
    return
  }

  if (
    currentMailboxSharingEnabled
    && currentOpenedMessage?.id
    && currentOpenedMessage.id !== messageId
    && (currentOpenedMessage.collaboration?.lockedByCurrentAccount || currentOpenedMessage.collaboration?.assignedToCurrentAccount)
  ) {
    try {
      await fetch("/api/mailbox/release", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: currentMailboxConnectionId,
          messageId: currentOpenedMessage.id,
          completed: false
        })
      })
    } catch (_) {
      // On tente quand meme la nouvelle selection.
    }
  }

  setMode("reply")
  if (receivedMailContent) {
    receivedMailContent.value = "Chargement du mail en cours..."
  }
  setReplyAttachmentsInfo("Analyse des pièces jointes en cours...", "info")
  replyWorkspace?.scrollIntoView({ behavior: "smooth", block: "start" })
  setMailboxFeedback(`Chargement du mail ${messageId}...`, "info")

  try {
    if (currentMailboxSharingEnabled) {
      const claimResponse = await fetch("/api/mailbox/claim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          connectionId: currentMailboxConnectionId,
          messageId,
          ttlMinutes: 15
        })
      })
      const claimResult = await claimResponse.json()
      if (!claimResponse.ok || !claimResult.ok) {
        throw new Error(claimResult.error || "Ce mail vient d'être pris en charge par un autre utilisateur.")
      }
      updateInboxMessageCollaboration(messageId, {
        ...(claimResult.collaboration || {}),
        lockedByCurrentAccount: true,
        assignedToCurrentAccount: true,
        lockedByAnotherAccount: false
      })
    }

    const response = await fetch("/api/mailbox/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: currentMailboxConnectionId,
        messageId
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture du mail.")
    }

    const message = result.message
    currentOpenedMessage = message
    startMailTimer(`reply_mail_session:${message.id}`, {
      workflow: "reply",
      messageId: message.id
    })
    updateInboxMessageCollaboration(message.id, message.collaboration || null)
    currentMailAnalysis = message.analysis || null
    syncReceivedAttachmentsInput(message.attachments || [])
    const attachmentLines = Array.isArray(message.attachments) && message.attachments.length > 0
      ? `\n\nPieces jointes :\n- ${message.attachments.map((attachment) => attachment.filename).join("\n- ")}\n\nComplement d'information : en plus du texte du mail, un ou plusieurs fichiers joints apportent des informations supplementaires a prendre en compte dans la reponse.`
      : ""

    if (Array.isArray(message.attachments) && message.attachments.length > 0) {
      const extractedCount = message.attachments.filter((attachment) => attachment.extractedText).length
      setReplyAttachmentsInfo(`Pièces jointes détectées et rattachées automatiquement : ${message.attachments.map((attachment) => attachment.filename).join(", ")}. Contenu exploitable disponible : ${extractedCount}/${message.attachments.length}.`, "success")
      renderAttachmentPreview(receivedAttachmentsPreview, message.attachments, { received: true })
    } else {
      setReplyAttachmentsInfo("Aucune pièce jointe détectée.", "info")
      renderAttachmentPreview(receivedAttachmentsPreview, [])
    }

    receivedMailContent.value = [
      `From : ${message.from || ""}`,
      `Date : ${message.date || ""}`,
      `Objet : ${message.subject || ""}`,
      "",
      (message.text || "").trim() + attachmentLines
    ].join("\n").trim()
    updateDetectedInputLanguages()
    trackMailEvent("reply_mail_open_completed", {
      workflow: "reply",
      messageId: message.id,
      metadata: {
        attachmentCount: Array.isArray(message.attachments) ? message.attachments.length : 0,
        subjectLength: String(message.subject || "").length
      }
    })

    const availability = describeMessageAvailability(message)
    setCollaborationIndicator(availability.state, availability.text)

    stopCollaborationRefresh()
    if (currentMailboxSharingEnabled) {
      collaborationRefreshIntervalId = window.setInterval(async () => {
        if (!currentOpenedMessage?.id || !currentMailboxConnectionId || !currentMailboxSharingEnabled) {
          stopCollaborationRefresh()
          return
        }
        await refreshCurrentMessageCollaboration()
      }, 5000)
    }

    setMailboxFeedback(`Mail chargé dans le mode Répondre au mail : ${message.subject || "(Sans objet)"}`, "success")
    updateAiIndicators("reply")
    replyWorkspace?.scrollIntoView({ behavior: "smooth", block: "start" })
    return message
  } catch (error) {
    trackMailEvent("reply_mail_open_failed", {
      workflow: "reply",
      messageId,
      metadata: { error: error.message || "Erreur de lecture du mail." }
    })
    currentOpenedMessage = null
    currentMailAnalysis = null
    syncReceivedAttachmentsInput([])
    if (receivedMailContent) {
      receivedMailContent.value = ""
      updateDetectedInputLanguages()
    }
    renderAiTrace(replyAiTrace, "")
    renderAttachmentPreview(receivedAttachmentsPreview, [])
    setReplyAttachmentsInfo("Aucune pièce jointe détectée.", "error")
    setMailboxFeedback(error.message || "Erreur de lecture du mail.", "error")
    updateAiIndicators("reply")
    return null
  }
}

async function openNextAutomaticMessage() {
  if (!automationState.running) {
    return
  }

  const nextMessage = getNextAutomaticMessage()
  if (!nextMessage) {
    stopAutomaticProcessing("Traitement automatique terminé : plus aucun mail à traiter.", "success")
    clearReplyWorkspaceAfterProcessing()
    return
  }

  automationState.currentMessageId = nextMessage.id
  if (!automationState.processedInCurrentPass.includes(nextMessage.id)) {
    automationState.processedInCurrentPass.push(nextMessage.id)
  }
  setMode("reply")
  setAutomaticProcessingFeedback(`Traitement automatique : ouverture du mail prioritaire ${nextMessage.subject || "(Sans objet)"}.`, "success")
  const loadedMessage = await openInboxMessage(nextMessage.id)
  if (!loadedMessage) {
    stopAutomaticProcessing("Traitement automatique interrompu : impossible d'ouvrir le mail suivant.", "error")
    return
  }

  syncLlmSelectors("top")
  if (llmSelect && llmSelect.value !== automationState.automaticModel) {
    llmSelect.value = automationState.automaticModel
  }
  if (llmSelectBottom && llmSelectBottom.value !== automationState.automaticModel) {
    llmSelectBottom.value = automationState.automaticModel
  }

  const generated = await generateReplyDraft({ automatic: true })
  if (!generated) {
    stopAutomaticProcessing("Traitement automatique interrompu : génération de réponse impossible.", "error")
    return
  }

  startAutomaticCountdown(loadedMessage)
}

async function startAutomaticProcessing() {
  if (!currentMailboxConnectionId) {
    setAutomaticProcessingFeedback("Connecte d'abord une boîte mail avant de lancer le traitement automatique.", "error")
    return
  }

  if (!Array.isArray(currentInboxMessages) || currentInboxMessages.length === 0) {
    await loadInbox(currentMailboxConnectionId)
  }

  if (!Array.isArray(currentInboxMessages) || currentInboxMessages.length === 0) {
    setAutomaticProcessingFeedback("Aucun mail à traiter automatiquement.", "info")
    return
  }

  automationState.running = true
  automationState.processedInCurrentPass = []
  updateAutomaticProcessingButtons()
  setAutomaticProcessingFeedback(`Traitement automatique lancé. Modèle automatique par défaut : ${automationState.automaticModel}. Le délai utilisateur démarre après génération complète.`, "success")
  await openNextAutomaticMessage()
}

async function handleAutomaticTimeout() {
  if (!automationState.running || !currentMailboxConnectionId || !currentOpenedMessage?.id) {
    return
  }

  clearAutomaticProcessingTimers()
  setAutomaticProcessingFeedback("Délai dépassé : le mail change automatiquement de priorité.", "error")

  try {
    const response = await fetch("/api/mailbox/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: currentMailboxConnectionId,
        messageId: currentOpenedMessage.id,
        actionType: "timed_out"
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur d'escalade automatique du mail.")
    }

    const nextPriorityLabel = result.escalatedPriorityLabel || "supérieure"
    clearReplyWorkspaceAfterProcessing()
    await loadInbox(currentMailboxConnectionId)
    setAutomaticProcessingFeedback(`Délai dépassé : le mail passe en priorité ${nextPriorityLabel}.`, "error")
    await openNextAutomaticMessage()
  } catch (error) {
    stopAutomaticProcessing(error.message || "Erreur de gestion du délai automatique.", "error")
  }
}

async function processReplyAction(actionType) {
  if (!currentMailboxConnectionId || !currentOpenedMessage?.id) {
    setMailboxFeedback("Ouvre d'abord un mail avant de lancer ce traitement.", "error")
    return
  }

  let reason = ""
  let replyBody = ""

  if (actionType === "validated") {
    replyBody = replyOutputMailContent?.value.trim() || ""
    if (!replyBody) {
      setReplyGenerationFeedback("La réponse est vide. Génère ou rédige d'abord un contenu avant validation.", "error")
      return
    }
  }

  if (actionType === "rejected") {
    reason = window.prompt("Indique le motif du rejet à envoyer au demandeur :", "")?.trim() || ""
    if (!reason) {
      setReplyGenerationFeedback("Le rejet a été annulé : motif manquant.", "error")
      return
    }
  }

  if (actionType === "deleted") {
    reason = window.prompt("Indique le motif de la suppression à envoyer au demandeur :", "")?.trim() || ""
    if (!reason) {
      setReplyGenerationFeedback("La suppression a été annulée : motif manquant.", "error")
      return
    }
  }

  replySendBtn && (replySendBtn.disabled = true)
  replyRejectBtn && (replyRejectBtn.disabled = true)
  replyDeleteBtn && (replyDeleteBtn.disabled = true)
  clearAutomaticProcessingTimers()
  if (actionType === "validated") {
    setReplyGenerationFeedback("Validation en cours...", "info")
  } else if (actionType === "rejected") {
    setReplyGenerationFeedback("Rejet en cours...", "info")
  } else if (actionType === "deleted") {
    setReplyGenerationFeedback("Suppression en cours...", "info")
  }
  setMailboxFeedback("Traitement du mail en cours...", "info")

  try {
    const response = await fetch("/api/mailbox/process", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        connectionId: currentMailboxConnectionId,
        messageId: currentOpenedMessage.id,
        actionType,
        reason,
        replyBody
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de traitement du mail.")
    }

    if (actionType === "validated") {
      setReplyGenerationFeedback("Réponse envoyée. Le mail source est sorti de l'Inbox et marqué comme traité.", "success")
    } else if (actionType === "rejected") {
      setReplyGenerationFeedback("Confirmation de rejet envoyée. Le mail reste dans l'Inbox avec une priorité supérieure pour pouvoir être retraité.", "success")
    } else {
      setReplyGenerationFeedback("Confirmation de suppression envoyée. Le mail source est sorti de l'Inbox et marqué comme supprimé.", "success")
    }

    trackMailEvent("reply_action_completed", {
      workflow: "reply",
      messageId: currentOpenedMessage.id,
      metadata: { actionType }
    })
    stopMailTimer(`reply_mail_session:${currentOpenedMessage.id}`, "reply_mail_session_completed", {
      workflow: "reply",
      messageId: currentOpenedMessage.id,
      metadata: { actionType }
    })

    clearReplyWorkspaceAfterProcessing()
    await loadInbox(currentMailboxConnectionId)
    if (automationState.running) {
      await openNextAutomaticMessage()
    }
  } catch (error) {
    trackMailEvent("reply_action_failed", {
      workflow: "reply",
      messageId: currentOpenedMessage?.id || "",
      metadata: {
        actionType,
        error: error.message || "Erreur de traitement du mail."
      }
    })
    setReplyGenerationFeedback(error.message || "Erreur de traitement du mail.", "error")
    setMailboxFeedback(error.message || "Erreur de traitement du mail.", "error")
  } finally {
    replySendBtn && (replySendBtn.disabled = false)
    replyRejectBtn && (replyRejectBtn.disabled = false)
    replyDeleteBtn && (replyDeleteBtn.disabled = false)
  }
}

createModeBtn?.addEventListener("click", () => {
  stopAutomaticProcessing("Traitement automatique arrêté : passage manuel en création.", "info")
  setMode("creation")
})

replyModeBtn?.addEventListener("click", () => {
  setMode("reply")
})

createModeBtnBottom?.addEventListener("click", () => {
  stopAutomaticProcessing("Traitement automatique arrêté : passage manuel en création.", "info")
  setMode("creation")
})

replyModeBtnBottom?.addEventListener("click", () => {
  setMode("reply")
})

creationSendBtn?.addEventListener("click", () => incrementCounter("creation", "send"))
creationRejectBtn?.addEventListener("click", () => incrementCounter("creation", "reject"))
creationDeleteBtn?.addEventListener("click", () => incrementCounter("creation", "delete"))
creationGenerateBtn?.addEventListener("click", generateCreationDraft)
creationRegenerateBtn?.addEventListener("click", generateCreationDraft)
creationDictionaryEditorBtn?.addEventListener("click", async () => {
  if (!creationOutputMailContent || !window.DictionaryEditor) {
    return
  }

  trackMailEvent("dictionary_editor_opened", {
    workflow: "creation",
    metadata: { target: "creationOutputMailContent" }
  })
  startMailTimer("dictionary_editor:creationOutputMailContent", {
    workflow: "creation",
    target: "creationOutputMailContent"
  })
  await preloadPredictiveDictionary(getSelectedLanguage())
  window.DictionaryEditor.open({
    title: "Edition guidee du contenu du mail",
    text: creationOutputMailContent.value || "",
    language: getSelectedLanguage(),
    onSave: (nextText) => {
      stopMailTimer("dictionary_editor:creationOutputMailContent", "dictionary_editor_applied", {
        workflow: "creation",
        metadata: {
          target: "creationOutputMailContent",
          textLength: nextText.length
        }
      })
      creationOutputMailContent.value = nextText
      persistUiValue(CREATION_DRAFT_STORAGE_KEY, nextText)
      creationOutputMailContent.dispatchEvent(new Event("input", { bubbles: true }))
      creationOutputMailContent.focus()
    }
  })
})
creationPromptDictionaryEditorBtn?.addEventListener("click", async () => {
  if (!creationPrompt || !window.DictionaryEditor) {
    return
  }

  trackMailEvent("dictionary_editor_opened", {
    workflow: "creation",
    metadata: { target: "creationPrompt" }
  })
  startMailTimer("dictionary_editor:creationPrompt", {
    workflow: "creation",
    target: "creationPrompt"
  })
  await preloadPredictiveDictionary(getSelectedLanguage())
  window.DictionaryEditor.open({
    title: "Edition guidee du prompt de creation",
    text: creationPrompt.value || "",
    language: getSelectedLanguage(),
    onSave: (nextText) => {
      stopMailTimer("dictionary_editor:creationPrompt", "dictionary_editor_applied", {
        workflow: "creation",
        metadata: {
          target: "creationPrompt",
          textLength: nextText.length
        }
      })
      creationPrompt.value = nextText
      persistCreationPrompt(nextText)
      creationPrompt.dispatchEvent(new Event("input", { bubbles: true }))
      creationPrompt.focus()
    }
  })
})
creationPrompt?.addEventListener("input", () => {
  persistCreationPrompt(creationPrompt.value)
  updateDetectedInputLanguages()
})
mailSubject?.addEventListener("input", () => persistUiValue(CREATION_SUBJECT_STORAGE_KEY, mailSubject.value))
creationOutputMailContent?.addEventListener("input", () => persistUiValue(CREATION_DRAFT_STORAGE_KEY, creationOutputMailContent.value))

replySendBtn?.addEventListener("click", () => processReplyAction("validated"))
replyRejectBtn?.addEventListener("click", () => processReplyAction("rejected"))
replyDeleteBtn?.addEventListener("click", () => processReplyAction("deleted"))
replyGenerateBtn?.addEventListener("click", generateReplyDraft)
replyRegenerateBtn?.addEventListener("click", generateReplyDraft)
replyDictionaryEditorBtn?.addEventListener("click", async () => {
  if (!replyOutputMailContent || !window.DictionaryEditor) {
    return
  }

  trackMailEvent("dictionary_editor_opened", {
    workflow: "reply",
    metadata: { target: "replyOutputMailContent" }
  })
  startMailTimer("dictionary_editor:replyOutputMailContent", {
    workflow: "reply",
    target: "replyOutputMailContent"
  })
  await preloadPredictiveDictionary(getSelectedLanguage())
  window.DictionaryEditor.open({
    title: "Edition guidee de la reponse",
    text: replyOutputMailContent.value || "",
    language: getSelectedLanguage(),
    onSave: (nextText) => {
      stopMailTimer("dictionary_editor:replyOutputMailContent", "dictionary_editor_applied", {
        workflow: "reply",
        metadata: {
          target: "replyOutputMailContent",
          textLength: nextText.length
        }
      })
      replyOutputMailContent.value = nextText
      replyOutputMailContent.dispatchEvent(new Event("input", { bubbles: true }))
      replyOutputMailContent.focus()
    }
  })
})
mailboxConnectBtn?.addEventListener("click", connectMailbox)
mailboxRefreshBtn?.addEventListener("click", () => loadInbox())
automaticProcessingStartBtn?.addEventListener("click", startAutomaticProcessing)
automaticProcessingStopBtn?.addEventListener("click", () => stopAutomaticProcessing("Traitement automatique arrêté par l'utilisateur.", "info"))
mailboxEmail?.addEventListener("input", updateMailboxProviderHint)
llmSelect?.addEventListener("change", () => syncLlmSelectors("top"))
llmSelectBottom?.addEventListener("change", () => syncLlmSelectors("bottom"))
languageSelect?.addEventListener("change", () => syncLanguageSelectors("top"))
languageSelectBottom?.addEventListener("change", () => syncLanguageSelectors("bottom"))
creationAttachments?.addEventListener("change", handleCreationAttachmentsPreview)
receivedAttachments?.addEventListener("change", handleReceivedAttachmentsPreview)

document.addEventListener("click", (event) => {
  const audioControls = event.target.closest("[data-audio-for]")
  if (audioControls) {
    const targetId = audioControls.getAttribute("data-audio-for") || ""
    const workflow = targetId === "receivedMailContent" || targetId === "replyOutputMailContent"
      ? "reply"
      : "creation"

    if (event.target.closest("[data-audio-play]")) {
      trackMailEvent("audio_read_started", { workflow, metadata: { target: targetId } })
    } else if (event.target.closest("[data-audio-pause]")) {
      trackMailEvent("audio_read_paused", { workflow, metadata: { target: targetId } })
    } else if (event.target.closest("[data-audio-resume]")) {
      trackMailEvent("audio_read_resumed", { workflow, metadata: { target: targetId } })
    } else if (event.target.closest("[data-audio-stop]")) {
      trackMailEvent("audio_read_stopped", { workflow, metadata: { target: targetId } })
    }
  }

  const audioInputControls = event.target.closest("[data-audio-input-for]")
  if (audioInputControls) {
    const targetId = audioInputControls.getAttribute("data-audio-input-for") || ""
    const workflow = targetId === "replyOutputMailContent" ? "reply" : "creation"

    if (event.target.closest("[data-audio-input-start]")) {
      trackMailEvent("audio_input_started", { workflow, metadata: { target: targetId } })
    } else if (event.target.closest("[data-audio-input-pause]")) {
      trackMailEvent("audio_input_paused", { workflow, metadata: { target: targetId } })
    } else if (event.target.closest("[data-audio-input-resume]")) {
      trackMailEvent("audio_input_resumed", { workflow, metadata: { target: targetId } })
    } else if (event.target.closest("[data-audio-input-stop]")) {
      trackMailEvent("audio_input_stopped", { workflow, metadata: { target: targetId } })
    }
  }
})

mailboxConnectionsList?.addEventListener("click", (event) => {
  const loadButton = event.target.closest("[data-mailbox-load]")
  if (loadButton) {
    loadInbox(loadButton.getAttribute("data-mailbox-load"))
    return
  }

  const disconnectButton = event.target.closest("[data-mailbox-disconnect]")
  if (!disconnectButton) return

  const mailboxEmailValue = disconnectButton.getAttribute("data-mailbox-email") || ""
  const confirmed = window.confirm(`Supprimer la connexion de la boîte mail ${mailboxEmailValue} ?`)
  if (!confirmed) return
  disconnectMailbox(disconnectButton.getAttribute("data-mailbox-disconnect"), mailboxEmailValue)
})

mailboxMessagesList?.addEventListener("click", (event) => {
  const button = event.target.closest("[data-mailbox-open]")
  if (!button) return
  openInboxMessage(button.getAttribute("data-mailbox-open"))
})

if (window.MailAudioReader) {
  window.MailAudioReader.create("creationPrompt", {
    getLanguage: () => getCreationPromptInputLanguage(),
    getSegmentLanguage: (segmentText, fallbackLanguage, segmentIndex, segments, previousLanguage) => detectSegmentInputLanguage(segmentText, fallbackLanguage, segmentIndex, segments, previousLanguage)
  })
  window.MailAudioReader.create("creationOutputMailContent", {
    getLanguage: () => getSelectedLanguage(),
    getSegmentLanguage: () => getSelectedLanguage()
  })
  window.MailAudioReader.create("receivedMailContent", {
    getLanguage: () => getReceivedMailInputLanguage(),
    getSegmentLanguage: (segmentText, fallbackLanguage, segmentIndex, segments, previousLanguage) => detectSegmentInputLanguage(segmentText, fallbackLanguage, segmentIndex, segments, previousLanguage)
  })
  window.MailAudioReader.create("replyOutputMailContent", {
    getLanguage: () => getSelectedLanguage(),
    getSegmentLanguage: () => getSelectedLanguage()
  })
}

if (window.MailAudioInput) {
  window.MailAudioInput.create("creationPrompt")
  window.MailAudioInput.create("creationOutputMailContent")
  window.MailAudioInput.create("replyOutputMailContent")
}

bindSuggestionAssistant(creationOutputMailContent, creationOutputSuggestions, "creation")
bindSuggestionAssistant(replyOutputMailContent, replyOutputSuggestions, "reply")

async function initializeMailPage() {
  const allowed = await ensureMailUserSession()
  if (!allowed) {
    return
  }

  await preloadPredictiveDictionary(getSelectedLanguage())
  syncWorkflowTracking(getCurrentWorkflowMode())
  trackMailEvent("mail_page_initialized", { workflow: getCurrentWorkflowMode() })
  loadCreationDefaults()
  loadReplyDefaults()
  updateDetectedInputLanguages()
  restoreComposePreferences()
  applyPredictiveDictionaryVisibility()
  applyMailboxSharingModeUi(false)
  setCollaborationIndicator(
    "neutral",
    "Aucun mail ouvert."
  )
  updateMailboxProviderHint()
  syncLlmSelectors("top")
  syncLanguageSelectors("top")
  updateAutomaticProcessingButtons()
  setMode(getInitialMailMode())

  const mailboxUrlState = new URLSearchParams(window.location.search)
  if (mailboxUrlState.get("mailbox") === "connected") {
    const connectionId = mailboxUrlState.get("connectionId") || ""
    const email = mailboxUrlState.get("email") || ""
    if (connectionId) {
      currentMailboxConnectionId = connectionId
      setMailboxFeedback(`Boîte connectée avec succès : ${email || connectionId}.`, "success")
      loadMailboxConnections().then(() => loadInbox(connectionId))
    }
  }

  if (mailboxUrlState.get("mailbox") === "error") {
    setMailboxFeedback(mailboxUrlState.get("reason") || "Erreur de connexion boîte mail.", "error")
  }

  if (!mailboxUrlState.get("mailbox")) {
    loadMailboxConnections().then((connections) => {
      const defaultConnection = pickDefaultConnectedConnection(connections)
      if (defaultConnection) {
        currentMailboxConnectionId = defaultConnection.id
        setMailboxFeedback(`Boîte déjà connectée retrouvée : ${defaultConnection.mailbox_email}.`, "success")
        loadInbox(defaultConnection.id)
      }
    })
  }
}

initializeMailPage()

window.addEventListener("storage", (event) => {
  if (event.key === getSessionStorageKey(SETTINGS_STORAGE_KEY)) {
    applyPredictiveDictionaryVisibility()
  }
})

window.addEventListener("mail-assistant-session-changed", () => {
  ensureMailUserSession()
})

window.addEventListener("focus", () => {
  ensureMailUserSession()
})

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    ensureMailUserSession()
  }
})
