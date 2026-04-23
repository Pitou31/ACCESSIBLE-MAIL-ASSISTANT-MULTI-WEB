const { runAIWithTimeout } = require("./aiTimeoutService")
const { buildAttachmentContext } = require("./attachmentContextService")

const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000)
const LOCAL_AI_TIMEOUT_MS = Number(process.env.LOCAL_AI_TIMEOUT_MS || 120000)
const REASONER_AI_TIMEOUT_MS = Number(process.env.REASONER_AI_TIMEOUT_MS || 90000)
const SALUTATION_SEGMENT = "salutation"
const BODY_SEGMENT = "body"
const CLOSING_SEGMENT = "closing"
const SIGNATURE_SEGMENT = "signature"
const ATTACHMENT_SEGMENT = "attachment"

const STANDARD_MAIL_FORMULAS = {
  "bonjour,": { en: "Hello,", es: "Hola,", de: "Guten Tag,", it: "Buongiorno,", nl: "Hallo,", ar: "مرحبا،", fr: "Bonjour," },
  "bonjour madame,": { en: "Dear Madam,", es: "Estimada señora,", de: "Sehr geehrte Dame,", it: "Gentile Signora,", nl: "Geachte mevrouw,", ar: "السيدة المحترمة،", fr: "Bonjour Madame," },
  "bonjour monsieur,": { en: "Dear Sir,", es: "Estimado señor,", de: "Sehr geehrter Herr,", it: "Gentile Signore,", nl: "Geachte heer,", ar: "السيد المحترم،", fr: "Bonjour Monsieur," },
  "bonjour madame, monsieur,": { en: "Dear Sir or Madam,", es: "Estimada señora, estimado señor:", de: "Sehr geehrte Damen und Herren,", it: "Gentile Signora, Gentile Signore,", nl: "Geachte mevrouw, geachte heer,", ar: "السيدة المحترمة، السيد المحترم،", fr: "Bonjour Madame, Monsieur," },
  "madame, monsieur,": { en: "Dear Sir or Madam,", es: "Estimada señora, estimado señor:", de: "Sehr geehrte Damen und Herren,", it: "Gentile Signora, Gentile Signore,", nl: "Geachte mevrouw, geachte heer,", ar: "السيدة المحترمة، السيد المحترم،", fr: "Madame, Monsieur," },
  "cordialement": { en: "Kind regards,", es: "Atentamente,", de: "Mit freundlichen Grüßen,", it: "Cordiali saluti,", nl: "Met vriendelijke groet,", ar: "مع خالص التحية،", fr: "Cordialement," },
  "cordialement,": { en: "Kind regards,", es: "Atentamente,", de: "Mit freundlichen Grüßen,", it: "Cordiali saluti,", nl: "Met vriendelijke groet,", ar: "مع خالص التحية،", fr: "Cordialement," },
  "bien cordialement": { en: "Kind regards,", es: "Atentamente,", de: "Mit freundlichen Grüßen,", it: "Cordiali saluti,", nl: "Met vriendelijke groet,", ar: "مع خالص التحية،", fr: "Bien cordialement," },
  "bien cordialement,": { en: "Kind regards,", es: "Atentamente,", de: "Mit freundlichen Grüßen,", it: "Cordiali saluti,", nl: "Met vriendelijke groet,", ar: "مع خالص التحية،", fr: "Bien cordialement," }
}

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

function normalizeComparableText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
}

function detectTranslationSegmentType(text = "", sourceLabel = "") {
  const normalizedText = normalizeComparableText(text)
  const normalizedLabel = normalizeComparableText(sourceLabel)

  if (!normalizedText) return BODY_SEGMENT
  if (normalizedLabel.includes("piece jointe")) return ATTACHMENT_SEGMENT

  if (STANDARD_MAIL_FORMULAS[normalizedText]) {
    if (normalizedText.includes("bonjour") || normalizedText.includes("madame") || normalizedText.includes("monsieur")) {
      return SALUTATION_SEGMENT
    }
    return CLOSING_SEGMENT
  }

  if (/^(bonjour|salut|madame|monsieur|cher|chere|dear|hello)\b/.test(normalizedText)) return SALUTATION_SEGMENT
  if (/^(cordialement|bien cordialement|kind regards|best regards|sincerely|with warm regards|regards)\b/.test(normalizedText)) return CLOSING_SEGMENT
  if (/^\[.+\]$/.test(String(text || "").trim()) || /^(\[.*name.*\]|\[.*position.*\]|\[.*contact.*\])$/i.test(String(text || "").trim())) return SIGNATURE_SEGMENT

  return BODY_SEGMENT
}

function translateStandardMailFormula(sourceText = "", targetLanguage = "fr") {
  const normalizedText = normalizeComparableText(sourceText)
  const formulas = STANDARD_MAIL_FORMULAS[normalizedText]
  if (!formulas) return ""
  return String(formulas[targetLanguage] || formulas.fr || "").trim()
}

function buildTranslationPolicy(payload = {}) {
  const targetLanguage = String(payload.targetLanguage || "fr").trim().toLowerCase()
  const segmentType = String(
    payload.segmentType || detectTranslationSegmentType(payload.sourceText || "", payload.sourceLabel || "")
  ).trim().toLowerCase()

  return {
    targetLanguage,
    languageLabel: getLanguageLabel(targetLanguage),
    segmentType
  }
}

function extractJson(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Réponse modèle vide")
  }

  const trimmed = text.trim()

  try {
    return JSON.parse(trimmed)
  } catch (_) {
    // continue
  }

  const match = trimmed.match(/\{[\s\S]*\}/)
  if (!match) {
    throw new Error("Aucun JSON détecté dans la réponse du modèle")
  }

  return JSON.parse(match[0])
}

function extractQuotedField(source, fieldName) {
  const fieldIndex = source.indexOf(`"${fieldName}"`)
  if (fieldIndex === -1) return ""
  const colonIndex = source.indexOf(":", fieldIndex)
  if (colonIndex === -1) return ""
  const firstQuoteIndex = source.indexOf('"', colonIndex + 1)
  if (firstQuoteIndex === -1) return ""

  let cursor = firstQuoteIndex + 1
  let escaped = false
  let value = ""

  while (cursor < source.length) {
    const char = source[cursor]
    if (escaped) {
      value += char === "n" ? "\n" : char
      escaped = false
      cursor += 1
      continue
    }
    if (char === "\\") {
      escaped = true
      cursor += 1
      continue
    }
    if (char === '"') break
    value += char
    cursor += 1
  }

  return value.trim()
}


function buildTranslationPrompt(payload = {}) {
  const sourceText = String(payload.sourceText || "").trim()
  const policy = buildTranslationPolicy(payload)

  const segmentSpecificRules = policy.segmentType === SALUTATION_SEGMENT
    ? [
        "- Il s'agit d'une formule d'appel.",
        "- Garde une formule d'appel de meme niveau de politesse.",
        "- N'ajoute aucun nom, titre ou destinataire absent."
      ]
    : policy.segmentType === CLOSING_SEGMENT
      ? [
          "- Il s'agit d'une formule de cloture.",
          "- Rends une formule de cloture courte et equivalente.",
          "- N'ajoute jamais de nom, fonction ou signature."
        ]
      : policy.segmentType === SIGNATURE_SEGMENT
        ? [
            "- Il s'agit d'une signature ou d'un placeholder de signature.",
            "- Ne cree aucun nom, poste ou coordonnee.",
            "- Si le texte est un placeholder, traduis uniquement le placeholder."
          ]
        : policy.segmentType === ATTACHMENT_SEGMENT
          ? [
              "- Il s'agit d'un texte issu d'une piece jointe.",
              "- Traduis fidelement sans ajout editorial."
            ]
          : [
              "- Il s'agit du corps d'un message.",
              "- Traduis fidelement le contenu, sans reecrire le mail."
            ]

  return `
Traduis en ${policy.languageLabel} le texte ci-dessous.

Regles obligatoires :
- Reponds uniquement sous la forme <translation>...contenu traduit...</translation>.
- N'ajoute rien avant ni apres.
- N'invente aucune formule de politesse, signature, titre ou information.
- Garde la meme structure et les memes paragraphes.
- Traduis uniquement le texte fourni.
${segmentSpecificRules.join("\n")}

Texte :
${sourceText}
  `.trim()
}

function normalizeTranslationOutput(text = "") {
  const source = String(text || "").trim()
  if (!source) return ""

  const xmlLikeMatch = source.match(/<translation>([\s\S]*?)<\/translation>/i)
  if (xmlLikeMatch?.[1]?.trim()) {
    return xmlLikeMatch[1].trim()
  }

  try {
    const parsed = extractJson(source)
    const transformedText = typeof parsed.transformed_text === "string" ? parsed.transformed_text.trim() : ""
    if (transformedText) {
      return transformedText
    }
  } catch (_) {
    // continue
  }

  const quoted = extractQuotedField(source, "transformed_text")
  if (quoted) {
    return quoted
  }

  const fencedMatch = source.match(/^```(?:json|text|txt)?\s*([\s\S]*?)\s*```$/i)
  if (fencedMatch?.[1]?.trim()) {
    return fencedMatch[1].trim()
  }

  return source
}

function resolveTranslationSource(payload = {}) {
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

function isStructuredLine(line = "") {
  const normalized = String(line || "").trim()
  if (!normalized) return false

  return /^([0-9]+[.)-]\s+|[-*•]\s+|subject\s*:|objet\s*:|from\s*:|to\s*:|cc\s*:|bcc\s*:|dear\b|hello\b|bonjour\b|best regards\b|kind regards\b|cordialement\b|bien cordialement\b)/i.test(normalized)
}

function splitParagraphIntoTranslationUnits(paragraph = "", segmentType = BODY_SEGMENT, maxChunkLength = 1200) {
  const normalizedParagraph = String(paragraph || "").trim()
  if (!normalizedParagraph) return []

  const lines = normalizedParagraph.split(/\n+/).map((line) => line.trim()).filter(Boolean)
  const hasStructuredLines = lines.length > 1 && lines.some((line) => isStructuredLine(line))
  if (hasStructuredLines) {
    return lines.flatMap((line) => splitParagraphIntoTranslationUnits(line, segmentType, maxChunkLength))
  }

  if (normalizedParagraph.length <= maxChunkLength) {
    return [{ text: normalizedParagraph, segmentType }]
  }

  if (segmentType !== BODY_SEGMENT && segmentType !== ATTACHMENT_SEGMENT) {
    return [{ text: normalizedParagraph, segmentType }]
  }

  const sentences = normalizedParagraph
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  const chunks = []
  let sentenceChunk = ""

  sentences.forEach((sentence) => {
    const sentenceCandidate = sentenceChunk ? `${sentenceChunk} ${sentence}` : sentence
    if (sentenceCandidate.length <= maxChunkLength) {
      sentenceChunk = sentenceCandidate
      return
    }
    if (sentenceChunk) {
      chunks.push({ text: sentenceChunk, segmentType })
    }
    sentenceChunk = sentence
  })

  if (sentenceChunk) {
    chunks.push({ text: sentenceChunk, segmentType })
  }

  return chunks
}

function splitTranslationText(text = "", maxChunkLength = 1200) {
  const normalized = String(text || "").trim()
  if (!normalized) return []

  const paragraphs = normalized.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean)
  if (!paragraphs.length) return []

  const chunks = []
  paragraphs.forEach((paragraph) => {
    const segmentType = detectTranslationSegmentType(paragraph)
    chunks.push(...splitParagraphIntoTranslationUnits(paragraph, segmentType, maxChunkLength))
  })
  return chunks
}

function createTranslationStreamPlan(payload = {}) {
  const { sourceText, attachmentContext } = resolveTranslationSource(payload)
  return {
    sourceText,
    attachmentContext,
    chunks: splitTranslationText(sourceText)
  }
}

async function processTranslation(payload = {}, options = {}) {
  const requestedModel = options.model || "deepseek-chat"
  const { sourceText, attachmentContext } = resolveTranslationSource(payload)
  const policy = buildTranslationPolicy({ ...payload, sourceText })

  if (!sourceText) {
    if (attachmentContext.attachments.length > 0) {
      const filenames = attachmentContext.attachments.map((attachment) => attachment.filename).join(", ")
      const pdfOnly = attachmentContext.attachments.every((attachment) => String(attachment.filename || "").toLowerCase().endsWith(".pdf") || String(attachment.contentType || "").toLowerCase() === "application/pdf")
      throw new Error(
        pdfOnly
          ? `Aucun texte extractible n'a pu etre prepare depuis la ou les pieces jointes (${filenames}). Le PDF est probablement image ou scanne. Une etape OCR sera necessaire pour le traduire.`
          : `Aucun texte extractible n'a pu etre prepare depuis la ou les pieces jointes (${filenames}).`
      )
    }
    throw new Error("Aucun texte a traiter pour cette action.")
  }

  const standardFormulaTranslation = translateStandardMailFormula(sourceText, policy.targetLanguage)
  if (standardFormulaTranslation) {
    return {
      result: { text: standardFormulaTranslation },
      meta: {
        provider: "mail-formula-policy",
        fallback: false,
        action: "translate",
        sourceLabel: String(payload.sourceLabel || "").trim(),
        targetLanguage: policy.targetLanguage,
        segmentType: policy.segmentType,
        attachmentCount: attachmentContext.attachments.length,
        aiInputPreview: ""
      }
    }
  }

  const prompt = buildTranslationPrompt({ ...payload, sourceText, segmentType: policy.segmentType })
  const aiRaw = await runAIWithTimeout(requestedModel, prompt, options)
  const normalizedOutput = normalizeTranslationOutput(aiRaw)

  if (!normalizedOutput) {
    throw new Error("La reponse du modele ne contient pas de texte exploitable.")
  }

  return {
    result: { text: normalizedOutput },
    meta: {
      provider: requestedModel,
      fallback: false,
      action: "translate",
      sourceLabel: String(payload.sourceLabel || "").trim(),
      targetLanguage: policy.targetLanguage,
      segmentType: policy.segmentType,
      attachmentCount: attachmentContext.attachments.length,
      aiInputPreview: prompt
    }
  }
}

module.exports = {
  ATTACHMENT_SEGMENT,
  BODY_SEGMENT,
  CLOSING_SEGMENT,
  SALUTATION_SEGMENT,
  SIGNATURE_SEGMENT,
  buildTranslationPolicy,
  buildTranslationPrompt,
  createTranslationStreamPlan,
  detectTranslationSegmentType,
  getLanguageLabel,
  isStructuredLine,
  normalizeTranslationOutput,
  processTranslation,
  resolveTranslationSource,
  splitParagraphIntoTranslationUnits,
  splitTranslationText,
  translateStandardMailFormula
}
