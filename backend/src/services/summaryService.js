const { runAI } = require("./aiRouter")
const { buildAttachmentContext } = require("./attachmentContextService")

const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000)
const LOCAL_AI_TIMEOUT_MS = Number(process.env.LOCAL_AI_TIMEOUT_MS || 120000)
const REASONER_AI_TIMEOUT_MS = Number(process.env.REASONER_AI_TIMEOUT_MS || 90000)

function getLanguageLabel(language = "fr") {
  switch (String(language || "fr").trim().toLowerCase()) {
    case "ar": return "arabe"
    case "nl": return "neerlandais"
    case "en": return "anglais"
    case "es": return "espagnol"
    case "de": return "allemand"
    case "it": return "italien"
    case "fr":
    default: return "francais"
  }
}

function getLanguageDirective(language = "fr") {
  switch (String(language || "fr").trim().toLowerCase()) {
    case "ar": return "Answer only in Arabic."
    case "nl": return "Answer only in Dutch."
    case "en": return "Answer only in English."
    case "es": return "Answer only in Spanish."
    case "de": return "Answer only in German."
    case "it": return "Answer only in Italian."
    case "fr":
    default: return "Answer only in French."
  }
}

function resolveSummarySource(payload = {}) {
  const attachmentContext = buildAttachmentContext(payload.attachments || [])
  const directSourceText = String(payload.sourceText || "").trim()
  const extractedAttachmentText = attachmentContext.attachments
    .filter((attachment) => attachment.hasUsableText)
    .map((attachment) => String(attachment.extractedText || "").trim())
    .filter(Boolean)
    .join("\n\n")
    .trim()

  return {
    sourceText: directSourceText || extractedAttachmentText,
    attachmentContext
  }
}

function buildSummaryPrompt(payload = {}) {
  const sourceText = String(payload.sourceText || "").trim()
  const sourceLabel = String(payload.sourceLabel || "").trim()
  const isAttachment = /piece jointe/i.test(sourceLabel)
  const targetLanguage = String(payload.targetLanguage || "fr").trim().toLowerCase()
  const languageLabel = getLanguageLabel(targetLanguage)
  const languageDirective = getLanguageDirective(targetLanguage)

  return `
Resume brievement et fidelement le contenu ci-dessous en ${languageLabel}.

Regles obligatoires :
- Reponds uniquement sous la forme <summary>...resume...</summary>.
- N'ajoute rien avant ni apres.
- N'invente aucune information.
- Reste factuel, clair et concis.
- Garde les elements importants, sans reecriture creative.
- Redige integralement le resume en ${languageLabel}.
- ${languageDirective}
- Si le texte source est dans une autre langue, ne conserve pas cette langue : rends tout le resume uniquement en ${languageLabel}.
- Rends le resume sous forme de texte continu naturel, pas sous forme de liste ni de puces, sauf si le texte source est impossible a comprendre autrement.
- ${isAttachment ? "Il s'agit d'un texte issu d'une piece jointe." : "Il s'agit d'un texte issu d'un bloc de l'interface mail."}

Texte :
${sourceText}
  `.trim()
}

function normalizeSummaryOutput(text = "") {
  const source = String(text || "").trim()
  if (!source) return ""

  const xmlLikeMatch = source.match(/<summary>([\s\S]*?)<\/summary>/i)
  if (xmlLikeMatch?.[1]?.trim()) {
    return xmlLikeMatch[1].trim()
  }

  const fencedMatch = source.match(/^```(?:json|text|txt)?\s*([\s\S]*?)\s*```$/i)
  if (fencedMatch?.[1]?.trim()) {
    return fencedMatch[1].trim()
  }

  return source
}

function stripHtmlArtifacts(text = "") {
  return String(text || "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<\/?p>/gi, "")
    .replace(/&nbsp;/gi, " ")
    .trim()
}

function countLines(value = "") {
  return String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .length
}

function normalizeForComparison(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function looksLikeTranslationInsteadOfSummary(sourceText = "", candidate = "", targetLanguage = "fr") {
  const source = String(sourceText || "").trim()
  const summary = String(candidate || "").trim()
  if (!source || !summary) return false

  const sourceLines = countLines(source)
  const summaryLines = countLines(summary)
  const sourceWords = source.split(/\s+/).filter(Boolean).length
  const summaryWords = summary.split(/\s+/).filter(Boolean).length
  const normalizedSource = normalizeForComparison(source)
  const normalizedSummary = normalizeForComparison(summary)

  if (normalizedSummary && normalizedSummary === normalizedSource) {
    return true
  }

  if (sourceWords >= 80 && summaryWords > sourceWords * 0.95) {
    return true
  }

  if (sourceLines >= 6 && summaryLines >= sourceLines && summaryWords > sourceWords * 0.9) {
    return true
  }

  const englishMarkers = /\b(dear|hello|best regards|kind regards|subject:|meeting request|please find|i hope this message finds you well)\b/i
  const frenchMarkers = /\b(bonjour|bien cordialement|cordialement|objet\s*:|je vous contacte|vous trouverez ci-joint)\b/i

  if (String(targetLanguage || "fr").trim().toLowerCase() === "fr" && englishMarkers.test(summary) && frenchMarkers.test(source)) {
    return true
  }

  return false
}

function detectOutputLanguage(text = "") {
  const source = String(text || "").trim().toLowerCase()
  if (!source) return ""

  const scores = {
    fr: 0,
    en: 0,
    es: 0,
    de: 0,
    it: 0,
    nl: 0,
    ar: 0
  }

  const addScore = (language, patterns) => {
    for (const pattern of patterns) {
      if (pattern.test(source)) {
        scores[language] += 1
      }
    }
  }

  addScore("fr", [/\b(le|la|les|des|une|un|pour|avec|reste|disponible|piece jointe|demande)\b/g, /\bbonjour\b/g, /\bcordialement\b/g])
  addScore("en", [/\b(the|and|with|for|available|request|attached|summary|please)\b/g, /\bhello\b/g, /\bkind regards\b/g])
  addScore("es", [/\b(el|la|los|las|con|para|solicitud|adjunto|disponible)\b/g, /\bhola\b/g, /\batentamente\b/g])
  addScore("de", [/\b(der|die|das|und|mit|fur|anfrage|verfugbar)\b/g, /\bhallo\b/g, /\bmit freundlichen grussen\b/g])
  addScore("it", [/\b(il|lo|la|gli|con|per|richiesta|allegato|disponibile)\b/g, /\bciao\b/g, /\bcordiali saluti\b/g])
  addScore("nl", [/\b(de|het|een|met|voor|aanvraag|bijlage|beschikbaar)\b/g, /\bhallo\b/g, /\bmet vriendelijke groet\b/g])
  addScore("ar", [/[\u0600-\u06FF]/g])

  let bestLanguage = ""
  let bestScore = 0
  for (const [language, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestLanguage = language
      bestScore = score
    }
  }

  return bestScore > 0 ? bestLanguage : ""
}

function isWrongSummaryLanguage(candidate = "", targetLanguage = "fr") {
  const normalizedTarget = String(targetLanguage || "fr").trim().toLowerCase()
  if (!candidate || !normalizedTarget) return false

  const detectedLanguage = detectOutputLanguage(candidate)
  if (!detectedLanguage) return false

  return detectedLanguage !== normalizedTarget
}

async function runAIWithTimeout(model, prompt, options = {}) {
  let timeoutMs = DEFAULT_AI_TIMEOUT_MS
  if (model === "deepseek-reasoner") {
    timeoutMs = REASONER_AI_TIMEOUT_MS
  }

  return await Promise.race([
    runAI(model, prompt, options),
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Temps d'attente dépassé pour ${model} (${Math.round(timeoutMs / 1000)} s)`)), timeoutMs)
    })
  ])
}

async function processSummary(payload = {}, options = {}) {
  const requestedModel = options.model || "deepseek-chat"
  const { sourceText, attachmentContext } = resolveSummarySource(payload)
  const targetLanguage = String(payload.targetLanguage || "fr").trim().toLowerCase()

  if (!sourceText) {
    if (attachmentContext.attachments.length > 0) {
      const filenames = attachmentContext.attachments.map((attachment) => attachment.filename).join(", ")
      throw new Error(`Aucun texte extractible n'a pu etre prepare depuis la ou les pieces jointes (${filenames}).`)
    }
    throw new Error("Aucun texte a traiter pour cette action.")
  }

  const prompt = buildSummaryPrompt({ ...payload, sourceText })
  const aiRaw = await runAIWithTimeout(requestedModel, prompt, options)
  const normalizedOutput = stripHtmlArtifacts(normalizeSummaryOutput(aiRaw))

  if (!normalizedOutput) {
    throw new Error("La reponse du modele ne contient pas de resume exploitable.")
  }

  if (looksLikeTranslationInsteadOfSummary(sourceText, normalizedOutput, targetLanguage)) {
    throw new Error(`Le modele ${requestedModel} a renvoye un texte qui ressemble a une traduction ou a une reecriture complete, pas a un resume.`)
  }

  if (isWrongSummaryLanguage(normalizedOutput, targetLanguage)) {
    throw new Error(`Le modele ${requestedModel} n'a pas respecte la langue de resume demandee (${targetLanguage}).`)
  }

  return {
    result: { text: normalizedOutput },
    meta: {
      provider: requestedModel,
      fallback: false,
      action: "summarize",
      targetLanguage,
      sourceLabel: String(payload.sourceLabel || "").trim(),
      attachmentCount: attachmentContext.attachments.length,
      aiInputPreview: prompt
    }
  }
}

module.exports = {
  buildSummaryPrompt,
  normalizeSummaryOutput,
  processSummary,
  resolveSummarySource
}
