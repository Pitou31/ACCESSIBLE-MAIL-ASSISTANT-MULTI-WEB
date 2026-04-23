const { runAIWithTimeout } = require("./aiTimeoutService")
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

function resolveRephraseSource(payload = {}) {
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

function buildRephrasePrompt(payload = {}) {
  const sourceText = String(payload.sourceText || "").trim()
  const sourceLabel = String(payload.sourceLabel || "").trim()
  const isAttachment = /piece jointe/i.test(sourceLabel)
  const targetLanguage = String(payload.targetLanguage || "fr").trim().toLowerCase()
  const languageLabel = getLanguageLabel(targetLanguage)
  const languageDirective = getLanguageDirective(targetLanguage)
  const strictMode = Boolean(payload.strictRephrase)

  return `
Reformule fidelement le texte ci-dessous en ${languageLabel}.

Regles obligatoires :
- Reponds uniquement sous la forme <rephrase>...texte reformule...</rephrase>.
- N'ajoute rien avant ni apres.
- N'invente aucune information.
- Garde le meme sens et les memes informations.
- Redige integralement la reformulation en ${languageLabel}.
- ${languageDirective}
- Ne transforme pas le texte en resume.
- Rends le texte plus naturel, plus clair et plus fluide, sans changer le fond.
- Garde la meme structure generale et les memes paragraphes.
- ${strictMode ? "Interdiction absolue de raccourcir fortement le texte : conserve l'essentiel des phrases et du niveau de detail." : "Conserve un niveau de detail proche du texte source."}
- ${strictMode ? "Si ta reponse ressemble a un resume, elle est incorrecte et doit etre regeneree comme une vraie reformulation." : "Ne fais pas une synthese courte."}
- ${isAttachment ? "Il s'agit d'un texte issu d'une piece jointe." : "Il s'agit d'un texte issu d'un bloc de l'interface mail."}

Texte :
${sourceText}
  `.trim()
}

function normalizeRephraseOutput(text = "") {
  const source = String(text || "").trim()
  if (!source) return ""

  const xmlLikeMatch = source.match(/<rephrase>([\s\S]*?)<\/rephrase>/i)
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

function countWords(value = "") {
  return String(value || "")
    .split(/\s+/)
    .filter(Boolean)
    .length
}

function looksLikeTranslationInsteadOfRephrase(sourceText = "", candidate = "", targetLanguage = "fr") {
  const source = String(sourceText || "").trim()
  const rephrased = String(candidate || "").trim()
  if (!source || !rephrased) return false

  const englishMarkers = /\b(dear|hello|best regards|kind regards|subject:|meeting request|please find|i hope this message finds you well)\b/i
  const frenchMarkers = /\b(bonjour|bien cordialement|cordialement|objet\s*:|je vous contacte|vous trouverez ci-joint)\b/i

  if (String(targetLanguage || "fr").trim().toLowerCase() === "fr" && englishMarkers.test(rephrased) && frenchMarkers.test(source)) {
    return true
  }

  return false
}

function looksLikeSummaryInsteadOfRephrase(sourceText = "", candidate = "") {
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

function isWrongRephraseLanguage(candidate = "", targetLanguage = "fr") {
  const normalizedTarget = String(targetLanguage || "fr").trim().toLowerCase()
  if (!candidate || !normalizedTarget) return false

  const detectedLanguage = detectOutputLanguage(candidate)
  if (!detectedLanguage) return false

  return detectedLanguage !== normalizedTarget
}


async function processRephrase(payload = {}, options = {}) {
  const requestedModel = options.model || "deepseek-chat"
  const { sourceText, attachmentContext } = resolveRephraseSource(payload)
  const targetLanguage = String(payload.targetLanguage || "fr").trim().toLowerCase()

  if (!sourceText) {
    if (attachmentContext.attachments.length > 0) {
      const filenames = attachmentContext.attachments.map((attachment) => attachment.filename).join(", ")
      throw new Error(`Aucun texte extractible n'a pu etre prepare depuis la ou les pieces jointes (${filenames}).`)
    }
    throw new Error("Aucun texte a traiter pour cette action.")
  }

  const validateRephrase = (candidate) => {
    if (!candidate) {
      throw new Error("La reponse du modele ne contient pas de reformulation exploitable.")
    }
    if (looksLikeTranslationInsteadOfRephrase(sourceText, candidate, targetLanguage)) {
      throw new Error(`Le modele ${requestedModel} a renvoye un texte qui ressemble a une traduction, pas a une reformulation.`)
    }
    if (looksLikeSummaryInsteadOfRephrase(sourceText, candidate)) {
      const preview = String(candidate || "").replace(/\s+/g, " ").trim().slice(0, 240)
      const error = new Error(`Le modele ${requestedModel} a renvoye un texte qui ressemble a un resume, pas a une reformulation. Extrait renvoye : ${preview}`)
      error.code = "REPHRASE_LOOKS_LIKE_SUMMARY"
      error.candidatePreview = preview
      throw error
    }
    if (isWrongRephraseLanguage(candidate, targetLanguage)) {
      throw new Error(`Le modele ${requestedModel} n'a pas respecte la langue de reformulation demandee (${targetLanguage}).`)
    }
    return candidate
  }

  const prompt = buildRephrasePrompt({ ...payload, sourceText })

  let normalizedOutput = ""
  let aiInputPreview = prompt
  let retried = false

  try {
    const aiRaw = await runAIWithTimeout(requestedModel, prompt, options)
    normalizedOutput = validateRephrase(stripHtmlArtifacts(normalizeRephraseOutput(aiRaw)))
  } catch (error) {
    if (error?.code !== "REPHRASE_LOOKS_LIKE_SUMMARY") {
      throw error
    }

    const retryPrompt = buildRephrasePrompt({ ...payload, sourceText, strictRephrase: true })
    const retryRaw = await runAIWithTimeout(requestedModel, retryPrompt, options)
    normalizedOutput = validateRephrase(stripHtmlArtifacts(normalizeRephraseOutput(retryRaw)))
    aiInputPreview = retryPrompt
    retried = true
  }

  return {
    result: { text: normalizedOutput },
    meta: {
      provider: requestedModel,
      fallback: false,
      action: "rephrase",
      targetLanguage,
      sourceLabel: String(payload.sourceLabel || "").trim(),
      attachmentCount: attachmentContext.attachments.length,
      aiInputPreview,
      retried
    }
  }
}

module.exports = {
  buildRephrasePrompt,
  normalizeRephraseOutput,
  processRephrase,
  resolveRephraseSource
}
