const { runAIWithTimeout } = require("../services/aiTimeoutService")
const { analyseEmail } = require("../services/llmService")
const { log } = require("../utils/logger")
const { buildAttachmentContext } = require("../services/attachmentContextService")
const { getApplicableMailRules, recordStatsEvent } = require("../services/databaseService")

function debugMailController(...args) {
  console.log("[MAIL-CTRL]", ...args)
}

function getRequestIdFromOptions(options = {}) {
  return String(options.requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
}

function countWords(value = "") {
  return String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .length
}

function buildGenerationStatsPayload(kind = "draft", status = "succeeded", options = {}, base = {}) {
  const eventType = kind === "reply"
    ? (status === "started" ? "reply_generation_started" : status === "failed" ? "reply_generation_failed" : "reply_generation_succeeded")
    : (status === "started" ? "draft_generation_started" : status === "failed" ? "draft_generation_failed" : "draft_generation_succeeded")

  return {
    event_type: eventType,
    status: status === "failed" ? "failed" : status === "started" ? "started" : "succeeded",
    success: status === "failed" ? 0 : status === "started" ? null : 1,
    user_id: options.userId || options.accountId || null,
    account_id: options.accountId || null,
    session_id: options.sessionId || null,
    workflow: kind === "reply" ? "reply" : "creation",
    action_scope: "mail",
    ...base
  }
}

const DEFAULT_AI_TIMEOUT_MS = Number(process.env.AI_TIMEOUT_MS || 30000)
const LOCAL_AI_TIMEOUT_MS = Number(process.env.LOCAL_AI_TIMEOUT_MS || 120000)
const REASONER_AI_TIMEOUT_MS = Number(process.env.REASONER_AI_TIMEOUT_MS || 90000)

function parseRawMail(rawMail) {
  const raw = rawMail || ""

  const fromMatch = raw.match(/From:\s*(.*)/i)
  const subjectMatch = raw.match(/Subject:\s*(.*)/i)

  let body = raw
  if (raw.includes("\n\n")) {
    const parts = raw.split("\n\n")
    body = parts.slice(1).join("\n\n").trim()
  }

  return {
    from: fromMatch ? fromMatch[1].trim() : "",
    subject: subjectMatch ? subjectMatch[1].trim() : "",
    body: body.trim()
  }
}

function getLanguageLabel(language = "fr") {
  switch (String(language || "fr").trim().toLowerCase()) {
    case "ar":
      return "arabe"
    case "nl":
      return "neerlandais"
    case "en":
      return "anglais"
    case "es":
      return "espagnol"
    case "de":
      return "allemand"
    case "it":
      return "italien"
    case "fr":
    default:
      return "francais"
  }
}

function buildPrompt(mailContext) {
  return `
Tu es un assistant de gestion de mails accessible.

Analyse l'email suivant et réponds uniquement en JSON valide avec cette structure :

{
  "category": "demande_document|question_facture|demande_information|reclamation|relance|autre",
  "priority": "normal|urgent",
  "summary": "résumé court",
  "replies": {
    "court": "réponse courte",
    "professionnel": "réponse professionnelle",
    "chaleureux": "réponse chaleureuse"
  }
}

Email :
From: ${mailContext.from}
Subject: ${mailContext.subject}
Body: ${mailContext.body}
`.trim()
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

function buildVoiceEditCommandPrompt(payload = {}) {
  const currentText = String(payload.currentText || "")
  const selectedText = String(payload.selectedText || "")
  const command = String(payload.command || "").trim()
  const language = String(payload.language || "fr").trim().toLowerCase()
  const languageLabel = getLanguageLabel(language)
  const selectionStart = Number.isInteger(payload.selectionStart) ? payload.selectionStart : 0
  const selectionEnd = Number.isInteger(payload.selectionEnd) ? payload.selectionEnd : selectionStart

  return `
Tu es un assistant d'edition locale de texte en ${languageLabel}.

Tu dois interpreter une commande vocale d'edition et repondre uniquement en JSON valide.

Actions autorisees :
- "replace_selection"
- "replace_text"
- "insert_before"
- "insert_after"
- "move_caret"
- "insert_line_break"
- "append_end"
- "delete_selection"
- "delete_text"
- "none"

Regle Edition vocale :
- La commande vocale contient generalement une action, une cible et parfois un contenu.
- Tu dois toujours separer strictement l'action demandee, la cible et le contenu exact a inserer, remplacer ou supprimer.
- Les mots comme "ajoute", "mets", "insere", "remplace", "supprime", "positionne-toi", "a la fin", "en fin de page", "devant", "avant", "apres" decrivent l'action ou la cible.
- Ces mots de commande ne doivent jamais etre inclus dans le champ "text", sauf si l'utilisateur dit explicitement "ecris exactement".
- Si l'utilisateur dit "ajoute le mot cordialement a la fin", l'action est "append_end" et le champ "text" vaut seulement "cordialement".
- Si l'utilisateur dit "positionne-toi en fin de page et ajoute le mot cordialement", l'action est "append_end" et le champ "text" vaut seulement "cordialement".
- Si l'utilisateur dit "dans Bonjour Madame ajoute Mademoiselle virgule devant Madame", l'action est "insert_before", la cible est "Madame" et le champ "text" vaut "Mademoiselle,".
- Si l'utilisateur dit "ajoute Bien avant Cordialement", l'action est "insert_before", la cible est "Cordialement" et le champ "text" vaut "Bien". Le mot "avant" indique la position, pas le texte a inserer.
- Si l'utilisateur dit "insere un espace apres Madame", l'action est "insert_after", la cible est "Madame" et le champ "text" vaut " ".
- De maniere generale : "ajoute X avant Y" ou "insere X avant Y" → "insert_before", target Y, text X. "ajoute X apres Y" ou "insere X apres Y" → "insert_after", target Y, text X.
- Si l'utilisateur dit simplement "ecris ..." ou "insere ..." sans cible explicite ni mention de fin, l'action par defaut est "replace_selection" et le champ "text" contient seulement le texte a inserer. Si aucune selection n'est active, cela sera insere a l'emplacement courant du curseur.
- Si l'utilisateur dit "supprime cordialement" ou "supprime le mot cordialement", l'action est "delete_text" et le champ "target" vaut seulement "cordialement".
- Si l'utilisateur dit "va a la ligne", "a la ligne", "retour a la ligne", "saut de ligne" ou "saute une ligne", l'action est "insert_line_break".
- Si l'utilisateur dit "place le curseur avant Madame", l'action est "move_caret", le champ "target" vaut "Madame" et le champ "cursorPosition" vaut "before".
- Si l'utilisateur dit "mets le curseur apres cordialement", l'action est "move_caret", le champ "target" vaut "cordialement" et le champ "cursorPosition" vaut "after".
- Si l'utilisateur dit "place le curseur au debut", l'action est "move_caret" et le champ "cursorPosition" vaut "start".
- Si l'utilisateur dit "place le curseur a la fin", l'action est "move_caret" et le champ "cursorPosition" vaut "end".

Regles :
- Tu ne modifies jamais tout le texte.
- Tu agis seulement sur la selection ou sur une cible textuelle explicite.
- Si la commande est ambigue, reponds avec action "none".
- Si la commande demande de remplacer la selection courante, utilise "replace_selection".
- Si la commande demande simplement d'ecrire ou d'inserer du texte sans autre precision de cible, utilise "replace_selection". Si la selection est vide, cela signifie une insertion au curseur courant.
- Si la commande demande d'ajouter a la fin, utilise "append_end".
- Si la commande demande d'inserer avant ou apres un mot cible, utilise "insert_before" ou "insert_after".
- Si la commande demande de deplacer ou placer le curseur, utilise "move_caret".
- Si la commande demande simplement d'aller a la ligne, de faire un retour a la ligne ou un saut de ligne, utilise "insert_line_break".
- Si la commande demande de remplacer un mot cible explicite, utilise "replace_text".
- Si la commande demande de supprimer un mot, une expression ou une phrase cible explicite, utilise "delete_text".
- Le champ "text" contient uniquement le texte exact a inserer ou a mettre a la place, jamais l'ordre complet.
- Le champ "target" contient la cible textuelle exacte si necessaire.
- Le champ "cursorPosition" vaut seulement "before", "after", "start" ou "end" pour l'action "move_caret".
- Le champ "shouldApply" vaut true seulement si l'action est suffisamment claire.

Structure attendue :
{
  "action": "replace_selection|replace_text|insert_before|insert_after|move_caret|insert_line_break|append_end|delete_selection|delete_text|none",
  "target": "texte cible ou vide",
  "text": "texte a inserer ou vide",
  "cursorPosition": "before|after|start|end|vide",
  "shouldApply": true,
  "confidence": 0.0,
  "reason": "explication courte"
}

Contexte :
- Texte courant : ${JSON.stringify(currentText)}
- Selection courante : ${JSON.stringify(selectedText)}
- Debut selection : ${selectionStart}
- Fin selection : ${selectionEnd}
- Commande vocale : ${JSON.stringify(command)}
  `.trim()
}

function normalizeVoiceEditAction(raw = {}) {
  const allowedActions = new Set(["replace_selection", "replace_text", "insert_before", "insert_after", "move_caret", "insert_line_break", "append_end", "delete_selection", "delete_text", "none"])
  const action = allowedActions.has(String(raw.action || "").trim()) ? String(raw.action || "").trim() : "none"
  const allowedCursorPositions = new Set(["before", "after", "start", "end"])
  const cursorPosition = allowedCursorPositions.has(String(raw.cursorPosition || "").trim()) ? String(raw.cursorPosition || "").trim() : ""
  return {
    action,
    target: String(raw.target || "").trim(),
    text: String(raw.text || "").trim(),
    cursorPosition,
    shouldApply: Boolean(raw.shouldApply) && action !== "none",
    confidence: Number.isFinite(Number(raw.confidence)) ? Number(raw.confidence) : 0,
    reason: String(raw.reason || "").trim()
  }
}

async function interpretVoiceEditCommand(payload = {}, options = {}) {
  const requestedModel = options.model || "deepseek-chat"
  const prompt = buildVoiceEditCommandPrompt(payload)
  const aiRaw = await runAIWithTimeout(requestedModel, prompt, options)
  const parsed = extractJson(aiRaw)
  return {
    command: normalizeVoiceEditAction(parsed),
    meta: {
      provider: requestedModel,
      fallback: false,
      aiInputPreview: prompt
    }
  }
}

function extractQuotedField(source, fieldName) {
  const fieldIndex = source.indexOf(`"${fieldName}"`)
  if (fieldIndex === -1) {
    return ""
  }

  const colonIndex = source.indexOf(":", fieldIndex)
  if (colonIndex === -1) {
    return ""
  }

  const firstQuoteIndex = source.indexOf('"', colonIndex + 1)
  if (firstQuoteIndex === -1) {
    return ""
  }

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

    if (char === '"') {
      break
    }

    value += char
    cursor += 1
  }

  return value.trim()
}

async function importMail(rawMail, options = {}) {
  log("📩 Mail reçu")

  const mailContext = parseRawMail(rawMail)
  log(`🧾 Body détecté : ${mailContext.body}`)

  const requestedModel = options.model || "deepseek-chat"

  try {
    log(`🧠 Analyse IA via ${requestedModel}`)

    const prompt = buildPrompt(mailContext)
   const aiRaw = await runAIWithTimeout(requestedModel, prompt, options)
    const analysis = extractJson(aiRaw)

    log("📤 Résultat IA envoyé au frontend")

    return {
      mail: mailContext,
      analysis,
      meta: {
        provider: requestedModel,
        fallback: false
      }
    }
  } catch (error) {
    log(`⚠️ Échec IA principale : ${error.message}`)
    log("🛟 Fallback heuristique local")

    const analysis = await analyseEmail(mailContext)

    return {
      mail: mailContext,
      analysis,
      meta: {
        provider: "heuristic-fallback",
        fallback: true,
        error: error.message
      }
    }
  }
}

function buildCreateMailPrompt(payload) {
  const attachmentContext = buildAttachmentContext(payload.attachments || [])
  const language = String(payload.language || "fr").trim().toLowerCase()
  const languageLabel = getLanguageLabel(language)

  return `
Tu es un assistant expert de la redaction de mails accessibles en ${languageLabel}.

Tu dois rediger un mail complet, clair, professionnel, facile a relire et pret a etre modifie par l'utilisateur.
La langue cible obligatoire de sortie est : ${languageLabel}.

Consignes :
- Reponds uniquement en JSON valide.
- Respecte strictement cette structure :
{
  "subject": "objet propose",
  "body": "contenu complet du mail"
}
- Le champ "body" doit contenir un mail complet en ${languageLabel}, avec formule d'appel si utile, paragraphes lisibles et formule de fin.
- Le champ "subject" doit lui aussi etre redige en ${languageLabel}.
- Meme si le prompt utilisateur ou les pieces jointes sont dans une autre langue, la sortie finale doit etre integralement redigee en ${languageLabel}.
- Le prompt utilisateur peut etre redige en francais, en anglais ou dans toute autre langue exploitable : tu dois le comprendre puis produire le resultat final en ${languageLabel}.
- N'ajoute aucun commentaire hors JSON.

Contexte :
- Destinataire : ${payload.to || "Non renseigne"}
- CC : ${payload.cc || "Aucun"}
- BCC : ${payload.bcc || "Aucun"}
- Objet actuel : ${payload.subject || "Non renseigne"}
- Prompt utilisateur :
${payload.prompt || "Aucun prompt fourni"}

Contexte pièces jointes complémentaires :
${attachmentContext.combinedText || attachmentContext.summary}
  `.trim()
}

function extractCreateMailJson(text) {
  try {
    const parsed = extractJson(text)
    return {
      subject: typeof parsed.subject === "string" ? parsed.subject.trim() : "",
      body: typeof parsed.body === "string" ? parsed.body.trim() : ""
    }
  } catch (_) {
    const source = typeof text === "string" ? text.trim() : ""
    return {
      subject: extractQuotedField(source, "subject"),
      body: extractQuotedField(source, "body")
    }
  }
}

function buildFallbackDraft(payload) {
  const fallbackSubject = payload.subject?.trim() || "Message"
  const language = String(payload.language || "fr").trim().toLowerCase()
  const fallbackByLanguage = {
    ar: [
      "مرحبا،",
      "",
      payload.prompt?.trim() || "أتواصل معكم بخصوص هذه الرسالة.",
      "",
      "أبقى رهن إشارتكم لأي معلومات إضافية.",
      "",
      "مع خالص التحية"
    ],
    nl: [
      "Hallo,",
      "",
      payload.prompt?.trim() || "Ik neem contact met u op over dit bericht.",
      "",
      "Ik blijf beschikbaar voor verdere informatie.",
      "",
      "Met vriendelijke groet"
    ],
    en: [
      "Hello,",
      "",
      payload.prompt?.trim() || "I am contacting you regarding this message.",
      "",
      "I remain available for any further information.",
      "",
      "Kind regards"
    ],
    es: [
      "Hola,",
      "",
      payload.prompt?.trim() || "Le escribo en relación con este mensaje.",
      "",
      "Quedo a su disposición para cualquier información adicional.",
      "",
      "Atentamente"
    ],
    de: [
      "Guten Tag,",
      "",
      payload.prompt?.trim() || "Ich kontaktiere Sie wegen dieser Nachricht.",
      "",
      "Für weitere Informationen stehe ich Ihnen gerne zur Verfügung.",
      "",
      "Mit freundlichen Grüßen"
    ],
    it: [
      "Buongiorno,",
      "",
      payload.prompt?.trim() || "La contatto in merito a questo messaggio.",
      "",
      "Resto a disposizione per qualsiasi ulteriore informazione.",
      "",
      "Cordiali saluti"
    ],
    fr: [
      "Bonjour,",
      "",
      payload.prompt?.trim() || "Je vous contacte pour vous transmettre ce message.",
      "",
      "Je reste a votre disposition pour tout complement.",
      "",
      "Bien cordialement"
    ]
  }
  const body = [
    ...(fallbackByLanguage[language] || fallbackByLanguage.fr)
  ].join("\n")

  return {
    subject: fallbackSubject,
    body
  }
}


function buildTextAssistPrompt(payload = {}) {
  const action = String(payload.action || "").trim().toLowerCase()
  const sourceText = String(payload.sourceText || "").trim()
  const sourceLabel = String(payload.sourceLabel || "ce texte").trim()
  const targetLanguage = String(payload.targetLanguage || "fr").trim().toLowerCase()
  const languageLabel = getLanguageLabel(targetLanguage)

  if (action !== "translate") {
    throw new Error("Action d'assistance textuelle non prise en charge.")
  }

  return `
Tu es un assistant expert de la traduction de textes pour une application de gestion de mails.

Ta mission est de traduire fidelement le texte ci-dessous en ${languageLabel}.

Consignes :
- Reponds uniquement avec le texte traduit final.
- Ne mets ni JSON, ni balises Markdown, ni commentaire introductif.
- Conserve strictement le sens, les informations utiles et le niveau de detail.
- N'ajoute aucune information.
- Ne resume pas.
- Si le texte contient deja principalement la langue cible, rends une version simplement naturelle et corrigee dans cette langue.

Bloc source : ${sourceLabel}
Texte source :
${sourceText}
  `.trim()
}

function extractTextAssistJson(text) {
  const source = typeof text === "string" ? text.trim() : ""

  try {
    const parsed = extractJson(text)
    const transformedText = typeof parsed.transformed_text === "string"
      ? parsed.transformed_text.trim()
      : ""
    if (transformedText) {
      return { transformedText }
    }
  } catch (_) {
    // On tente ensuite des formats plus souples.
  }

  const quoted = extractQuotedField(source, "transformed_text")
  if (quoted) {
    return {
      transformedText: quoted
    }
  }

  const fencedMatch = source.match(/^```(?:json|text|txt)?\s*([\s\S]*?)\s*```$/i)
  if (fencedMatch?.[1]?.trim()) {
    return {
      transformedText: fencedMatch[1].trim()
    }
  }

  return {
    transformedText: source
  }
}

function resolveTextAssistSource(payload = {}) {
  const attachmentContext = buildAttachmentContext(payload.attachments || [])
  const directSourceText = String(payload.sourceText || "").trim()
  const extractedAttachmentText = attachmentContext.attachments
    .filter((attachment) => attachment.hasUsableText)
    .map((attachment, index) => {
      const header = `Fichier ${index + 1} : ${attachment.filename}`
      return `${header}\n${attachment.extractedText}`.trim()
    })
    .join("\n\n")
    .trim()
  const sourceText = directSourceText || extractedAttachmentText

  return {
    sourceText,
    attachmentContext
  }
}

async function processTextAssist(payload = {}, options = {}) {
  const requestedModel = options.model || "deepseek-chat"
  const { sourceText, attachmentContext } = resolveTextAssistSource(payload)

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

  const prompt = buildTextAssistPrompt({
    ...payload,
    sourceText
  })
  const aiRaw = await runAIWithTimeout(requestedModel, prompt, options)
  const result = extractTextAssistJson(aiRaw)

  if (!result.transformedText) {
    throw new Error("La reponse du modele ne contient pas de texte exploitable.")
  }

  return {
    result: {
      text: result.transformedText
    },
    meta: {
      provider: requestedModel,
      fallback: false,
      action: String(payload.action || "").trim().toLowerCase(),
      sourceLabel: String(payload.sourceLabel || "").trim(),
      targetLanguage: String(payload.targetLanguage || "fr").trim().toLowerCase(),
      attachmentCount: attachmentContext.attachments.length,
      aiInputPreview: prompt
    }
  }
}

async function createMailDraft(payload = {}, options = {}) {
  const requestedModel = options.model || "deepseek-chat"
  const attachmentContext = buildAttachmentContext(payload.attachments || [])
  const prompt = buildCreateMailPrompt(payload)
  const startedAt = Date.now()

  try {
    recordStatsEvent(buildGenerationStatsPayload("draft", "started", options, {
      attachment_count: attachmentContext.attachments.length,
      target_language: payload.language || "fr",
      automatic: options.automatic ? 1 : 0,
      provider: requestedModel,
      model_name: requestedModel,
      model_label: requestedModel,
      model_kind: String(requestedModel || "").includes(":") ? "local" : "api",
      selection_mode: options.selectionMode || "user_selected",
      metadata: {
        source: "createMailDraft"
      }
    }))
  } catch (_) {
    // Les statistiques ne doivent jamais bloquer la generation.
  }

  try {
    const aiRaw = await runAIWithTimeout(requestedModel, prompt, options)
    const draft = extractCreateMailJson(aiRaw)
    const finalDraft = {
      subject: draft.subject || payload.subject || "",
      body: draft.body || buildFallbackDraft(payload).body
    }

    try {
      recordStatsEvent(buildGenerationStatsPayload("draft", "succeeded", options, {
        attachment_count: attachmentContext.attachments.length,
        target_language: payload.language || "fr",
        automatic: options.automatic ? 1 : 0,
        provider: requestedModel,
        model_name: requestedModel,
        model_label: requestedModel,
        model_kind: String(requestedModel || "").includes(":") ? "local" : "api",
        selection_mode: options.selectionMode || "user_selected",
        duration_ms: Date.now() - startedAt,
        generated_word_count: countWords(finalDraft.body),
        generated_character_count: finalDraft.body.length,
        metadata: {
          source: "createMailDraft",
          fallback_used: false
        }
      }))
    } catch (_) {
      // Les statistiques ne doivent jamais bloquer la generation.
    }

    return {
      draft: finalDraft,
      meta: {
        provider: requestedModel,
        fallback: false,
        attachmentCount: attachmentContext.attachments.length,
        attachmentNames: attachmentContext.attachments.map((attachment) => attachment.filename),
        attachmentsWithExtractedText: attachmentContext.attachments.filter((attachment) => attachment.hasUsableText).length,
        aiInputPreview: prompt
      }
    }
  } catch (error) {
    const draft = buildFallbackDraft(payload)
    try {
      recordStatsEvent(buildGenerationStatsPayload("draft", "failed", options, {
        attachment_count: attachmentContext.attachments.length,
        target_language: payload.language || "fr",
        automatic: options.automatic ? 1 : 0,
        provider: requestedModel,
        model_name: requestedModel,
        model_label: requestedModel,
        model_kind: String(requestedModel || "").includes(":") ? "local" : "api",
        selection_mode: options.selectionMode || "user_selected",
        duration_ms: Date.now() - startedAt,
        generated_word_count: countWords(draft.body),
        generated_character_count: draft.body.length,
        error_message: error.message,
        metadata: {
          source: "createMailDraft",
          fallback_used: true
        }
      }))
    } catch (_) {
      // Les statistiques ne doivent jamais bloquer la generation.
    }

    return {
      draft,
      meta: {
        provider: "creation-fallback",
        fallback: true,
        error: error.message,
        attachmentCount: attachmentContext.attachments.length,
        attachmentNames: attachmentContext.attachments.map((attachment) => attachment.filename),
        attachmentsWithExtractedText: attachmentContext.attachments.filter((attachment) => attachment.hasUsableText).length,
        aiInputPreview: prompt
      }
    }
  }
}

function formatApplicableRulesForPrompt(rules = []) {
  if (!Array.isArray(rules) || rules.length === 0) {
    return ""
  }

  return rules.map((rule, index) => {
    const scopeBits = [
      rule.applicationScope ? `application=${rule.applicationScope}` : "",
      rule.mailboxScope ? `boite=${rule.mailboxScope}` : "",
      rule.mailCategoryScope ? `categorie=${rule.mailCategoryScope}` : "",
      rule.workflowScope ? `workflow=${rule.workflowScope}` : ""
    ].filter(Boolean).join(", ")

    return [
      `${index + 1}. ${rule.title}`,
      `type=${rule.ruleType} | portee=${scopeBits} | action_si_info_manquante=${rule.missingInfoAction}`,
      `${rule.content}`
    ].join("\n")
  }).join("\n\n")
}

const BASE_RULE_TITLES = new Set([
  "Ne jamais inventer une information absente du contexte",
  "Produire une reponse prudente si une information necessaire manque",
  "Règle générale de formule d'appel, ton et signature"
])

function normalizeForRuleDetection(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function detectRuleThemesFromPayload(payload = {}) {
  const text = normalizeForRuleDetection([
    payload.receivedMail || "",
    payload.receivedAttachmentsSummary || "",
    Array.isArray(payload.receivedAttachments)
      ? payload.receivedAttachments.map((attachment) => `${attachment.filename || ""} ${attachment.extractedText || ""}`).join("\n")
      : ""
  ].join("\n"))

  const themes = new Set()
  const isFollowUp = /(relance|je me permets de vous relancer|pas encore recu de retour|pas de retour|aucune nouvelle|ou en est|ou en est ma demande|suivi de ma demande|suivi de mon dossier)/.test(text)
  const isDelayQuestion = /(quels sont.*delais|quel est le delai|quand aurai-je une reponse|sous combien de temps|delai moyen|delais moyens|quand vais-je recevoir une reponse|combien de temps pour obtenir une reponse)/.test(text)

  if (isFollowUp) {
    themes.add("relance_client")
    themes.add("suivi_dossier")
  }

  if ((!isFollowUp && /(delai|delais|attente|reponse|retour)/.test(text)) || isDelayQuestion) {
    themes.add("delais")
    themes.add("délais_traitement")
    themes.add("Délais")
  }

  if (/(facture|montant|tarif|ligne de facturation|prestation)/.test(text)) {
    themes.add("facturation")
  }

  if (/(document|documents|piece justificative|justificatif|transmettre)/.test(text)) {
    themes.add("documents_a_fournir")
  }

  if (/(photo|image|scan|piece jointe|lisible|lisibilite)/.test(text)) {
    themes.add("pieces_jointes")
  }

  if (/(handicap|accessibilite|amenagement|adaptation)/.test(text)) {
    themes.add("accessibilite")
  }

  if (/(dossier|pris en compte|recu|recu par vos services|etat du dossier|suivi)/.test(text)) {
    themes.add("suivi_dossier")
  }

  if (/(probleme|anomalie|blocage|incident|erreur)/.test(text)) {
    themes.add("incident_dossier")
  }

  if (/\burgent\b/.test(text)) {
    themes.add("urgence")
  }

  const questionMarks = (String(payload.receivedMail || "").match(/\?/g) || []).length
  if (questionMarks > 1) {
    themes.add("questions_multiples")
  }

  return Array.from(themes)
}

function dedupeRules(rules = []) {
  const seen = new Set()
  return rules.filter((rule) => {
    if (!rule?.id || seen.has(rule.id)) {
      return false
    }
    seen.add(rule.id)
    return true
  })
}

function resolveApplicableRules(payload = {}) {
  if (payload.disableStoredRules) {
    return []
  }

  const baseRules = getApplicableMailRules({
    applicationScope: payload.applicationScope || "mail_assistant",
    workflowScope: payload.workflowScope || "reply",
    mailboxScope: payload.mailboxScope || "global",
    mailCategoryScope: payload.mailCategoryScope || payload.category || "global"
  }).filter((rule) => BASE_RULE_TITLES.has(rule.title))

  const explicitTheme = String(payload.ruleTheme || "").trim()
  const detectedThemes = explicitTheme ? [explicitTheme] : detectRuleThemesFromPayload(payload)

  if (detectedThemes.length === 0) {
    return dedupeRules(baseRules)
  }

  const themedRules = detectedThemes.flatMap((theme) => getApplicableMailRules({
    applicationScope: payload.applicationScope || "mail_assistant",
    workflowScope: payload.workflowScope || "reply",
    mailboxScope: payload.mailboxScope || "global",
    mailCategoryScope: payload.mailCategoryScope || payload.category || "global",
    theme
  }))

  return dedupeRules([
    ...baseRules,
    ...themedRules
  ])
}

function buildReplyMailPrompt(payload) {
  const attachmentContext = buildAttachmentContext(payload.receivedAttachments || [])
  const activeRulesText = String(payload.activeRulesText || payload.rulesText || "").trim()
  const mailboxInstructions = String(payload.mailboxInstructions || "").trim()
  const applicationScope = String(payload.applicationScope || "mail_assistant").trim()
  const language = String(payload.language || "fr").trim().toLowerCase()
  const languageLabel = getLanguageLabel(language)
  const contextCompletenessHints = [
    "- Avant de repondre, evalue si le contexte transmis est suffisant.",
    "- Commence par analyser la teneur de la demande et determine si la question posee est claire, precise et exploitable en l'etat.",
    "- La consultation des regles metier actives et des consignes de boite mail ci-dessous est obligatoire avant toute reponse finale.",
    "- Tu dois lire les regles metier actives meme si le mail te semble simple, puis verifier si elles modifient, encadrent ou limitent la reponse.",
    "- Tu n'as pas le droit de conclure qu'une reponse est fiable avant d'avoir examine les regles metier actives et les consignes de boite mail transmises ci-dessous.",
    "- Si le contexte est insuffisant, n'invente rien : redige une reponse prudente, demande un complement ou indique qu'une verification est necessaire.",
    "- Si ni le mail, ni les pieces jointes exploitees, ni les regles actives ne suffisent, indique clairement qu'une verification, un complement ou une validation est necessaire.",
    "- Ne confirme jamais un rendez-vous, une disponibilite, une reception validee, une conformite documentaire ou une decision administrative sans element explicite dans le contexte.",
    "- Si une piece jointe est seulement signalee mais non exploitee automatiquement, ne suppose ni son contenu ni sa lisibilite.",
    "- Si le mail ou les pieces jointes ne permettent pas une reponse certaine, privilegie une formulation precise de verification ou de demande de complement."
  ].join("\n")
  const prioritizedRuleHints = [
    "- Ne jamais inventer une information absente du contexte.",
    "- Si une information necessaire manque, produire une reponse prudente.",
    "- Utiliser d'abord le contenu effectivement traite par l'application pour les pieces jointes.",
    "- En cas de doute, demander un complement ou une validation humaine.",
    "- Ne mobiliser que les regles pertinentes pour le type d'application et la demande en cours."
  ].join("\n")
  const reasoningSequence = [
    "1. Comprendre l'intention exacte du mail et la nature de la demande.",
    "2. Lire integralement les regles metier actives et les consignes de boite mail ci-dessous avant de decider de la reponse.",
    "3. Verifier ensuite si le mail, les pieces jointes exploitees et les regles suffisent ensemble pour repondre de maniere precise et fiable.",
    "4. Si les regles couvrent partiellement le cas, t'appuyer sur elles pour cadrer une reponse prudente et exacte.",
    "5. Si les regles ne suffisent toujours pas, rediger une reponse prudente, explicite et exploitable sans inventer.",
    "6. Ne pas utiliser dans la reponse des informations qui ne sont pas clairement etablies par le contexte transmis."
  ].join("\n")

  return `
 Tu es un assistant expert de la reponse a un mail en ${languageLabel}.

Tu dois rediger une reponse claire, professionnelle, accessible et directement exploitable par l'utilisateur.
La langue cible obligatoire de sortie est : ${languageLabel}.

Consignes :
- Reponds uniquement en JSON valide.
- Respecte strictement cette structure :
{
  "body": "reponse complete"
}
- Le champ "body" doit contenir uniquement la reponse finale, avec une formule d'appel si utile, des paragraphes lisibles et une formule de fin, integralement en ${languageLabel}.
- Meme si le mail recu, les regles ou les pieces jointes sont rediges dans une autre langue, la reponse finale doit etre integralement redigee en ${languageLabel}.
- Tu dois donc comprendre le mail source dans sa langue d'origine, puis rediger la reponse finale uniquement dans la langue cible ${languageLabel}.
- Ne recopie pas le mail source.
- N'ajoute aucun commentaire hors JSON.
- En plus du texte du mail, prends en compte les fichiers joints comme compléments d'information de même niveau d'importance que le mail lui-même.
- Les regles metier et consignes de prudence ci-dessous sont une source obligatoire de contexte.
- Les regles metier actives ci-dessous sont toujours supposees disponibles : tu dois obligatoirement les examiner avant de finaliser ta reponse.
- Tu travailles dans le cadre de l'application : ${applicationScope}.
- N'utilise pas mentalement de regles d'un autre domaine metier que celui de l'application et de la demande courante.

Sequence obligatoire de raisonnement :
${reasoningSequence}

Controle obligatoire de completude du contexte :
${contextCompletenessHints}

Regles prioritaires a respecter :
${prioritizedRuleHints}

Regles metier actives :
${activeRulesText || "Aucune regle metier explicite n'est encore transmise. Applique strictement les regles prioritaires ci-dessus."}

Consignes de la boite mail :
${mailboxInstructions || "Aucune consigne specifique de boite mail transmise."}

Mail recu :
${payload.receivedMail || "Aucun mail fourni"}

Phrase de contexte sur les pièces jointes :
${attachmentContext.intro}

Pieces jointes detectees :
${payload.receivedAttachmentsSummary || attachmentContext.summary || "Aucune piece jointe detectee"}

Contenu des pieces jointes ou informations exploitables :
${attachmentContext.combinedText || "Aucun contenu complémentaire transmis."}
  `.trim()
}

function buildReplyDiagnosticPromptReference(payload) {
  const attachmentContext = buildAttachmentContext(payload.receivedAttachments || [])
  const activeRulesText = String(payload.activeRulesText || payload.rulesText || "").trim()
  const mailboxInstructions = String(payload.mailboxInstructions || "").trim()
  const applicationScope = String(payload.applicationScope || "mail_assistant").trim()

  return `
Tu es un assistant expert de la reponse a un mail en francais.

Tu es en mode diagnostic de test.

Ta mission n'est pas seulement de proposer une reponse, mais d'evaluer si le contexte disponible suffit pour produire une reponse fiable et precise.

Reponds uniquement en JSON valide en respectant strictement cette structure :
{
  "context_sufficient": true,
  "should_consult_rules": false,
  "rules_would_help": false,
  "missing_information": ["..."],
  "reasoning_summary": "resume court du diagnostic",
  "draft_response": "reponse proposee"
}

Consignes importantes :
- Le champ "context_sufficient" vaut true seulement si la reponse peut etre precise et fiable avec le contexte transmis.
- Le champ "should_consult_rules" vaut true si, en l'absence de certitude suffisante, il serait pertinent d'aller consulter un referentiel de regles.
- Le champ "rules_would_help" vaut true si des regles metier pourraient ameliorer ou securiser la reponse.
- Le champ "missing_information" doit lister les informations manquantes concretement utiles.
- Le champ "reasoning_summary" doit rester bref, factuel et non verbeux.
- Le champ "draft_response" doit contenir la meilleure reponse prudente et exploitable possible.
- N'invente jamais une information absente du contexte.
- Si une piece jointe est seulement signalee mais non exploitee automatiquement, ne suppose ni son contenu ni sa lisibilite.
- Tu travailles dans le cadre de l'application : ${applicationScope}.
- Des regles metier et consignes de boite mail peuvent exister et aider a mieux cadrer la reponse si le contexte parait insuffisant ou ambigu.
- N'indique should_consult_rules = true que si tu juges qu'il serait vraiment pertinent d'aller consulter ces regles pour ameliorer la surete ou la precision de la reponse.
- Si les regles sont vides ou insuffisantes, ton diagnostic doit le signaler explicitement.

Regles metier actives :
${activeRulesText || "Aucune regle metier transmise dans ce test."}

Consignes de la boite mail :
${mailboxInstructions || "Aucune consigne specifique de boite mail transmise."}

Mail recu :
${payload.receivedMail || "Aucun mail fourni"}

Phrase de contexte sur les pieces jointes :
${attachmentContext.intro}

Pieces jointes detectees :
${payload.receivedAttachmentsSummary || attachmentContext.summary || "Aucune piece jointe detectee"}

Contenu des pieces jointes ou informations exploitables :
${attachmentContext.combinedText || "Aucun contenu complementaire transmis."}
  `.trim()
}

function buildReplyDiagnosticPromptMandatory(payload) {
  const attachmentContext = buildAttachmentContext(payload.receivedAttachments || [])
  const activeRulesText = String(payload.activeRulesText || payload.rulesText || "").trim()
  const mailboxInstructions = String(payload.mailboxInstructions || "").trim()
  const applicationScope = String(payload.applicationScope || "mail_assistant").trim()

  return `
Tu es un assistant expert de la reponse a un mail en francais.

Tu es en mode diagnostic de test.

Ta mission n'est pas seulement de proposer une reponse, mais d'evaluer si le contexte disponible suffit pour produire une reponse fiable et precise.

Reponds uniquement en JSON valide en respectant strictement cette structure :
{
  "context_sufficient": true,
  "should_consult_rules": false,
  "rules_would_help": false,
  "missing_information": ["..."],
  "reasoning_summary": "resume court du diagnostic",
  "draft_response": "reponse proposee"
}

Consignes importantes :
- Le champ "context_sufficient" vaut true seulement si la reponse peut etre precise et fiable avec le contexte transmis.
- Le champ "should_consult_rules" vaut true si, apres lecture des regles et consignes, tu juges qu'elles etaient effectivement pertinentes pour cadrer la reponse.
- Le champ "rules_would_help" vaut true si les regles metier ameliorent ou securisent la reponse.
- Le champ "missing_information" doit lister les informations manquantes concretement utiles.
- Le champ "reasoning_summary" doit rester bref, factuel et non verbeux.
- Le champ "draft_response" doit contenir la meilleure reponse prudente et exploitable possible.
- N'invente jamais une information absente du contexte.
- Si une piece jointe est seulement signalee mais non exploitee automatiquement, ne suppose ni son contenu ni sa lisibilite.
- Tu travailles dans le cadre de l'application : ${applicationScope}.
- Tu dois consulter les regles metier et consignes de boite mail ci-dessous de facon obligatoire avant tout diagnostic.
- Tu n'as pas le droit de conclure qu'une reponse est fiable avant d'avoir examine les regles et consignes transmises, meme si le mail te semble simple.
- Si les regles sont vides ou insuffisantes, ton diagnostic doit le signaler explicitement.

Regles metier actives :
${activeRulesText || "Aucune regle metier transmise dans ce test."}

Consignes de la boite mail :
${mailboxInstructions || "Aucune consigne specifique de boite mail transmise."}

Mail recu :
${payload.receivedMail || "Aucun mail fourni"}

Phrase de contexte sur les pieces jointes :
${attachmentContext.intro}

Pieces jointes detectees :
${payload.receivedAttachmentsSummary || attachmentContext.summary || "Aucune piece jointe detectee"}

Contenu des pieces jointes ou informations exploitables :
${attachmentContext.combinedText || "Aucun contenu complementaire transmis."}
  `.trim()
}

function buildReplyDiagnosticPrompt(payload, promptMode = "reference") {
  if (promptMode === "mandatory") {
    return buildReplyDiagnosticPromptMandatory(payload)
  }
  return buildReplyDiagnosticPromptReference(payload)
}

function extractReplyMailJson(text) {
  try {
    const parsed = extractJson(text)
    return {
      body: typeof parsed.body === "string" ? parsed.body.trim() : ""
    }
  } catch (_) {
    const source = typeof text === "string" ? text.trim() : ""
    return {
      body: extractQuotedField(source, "body")
    }
  }
}

function buildReplyLanguageRewritePrompt(body = "", language = "fr") {
  const languageLabel = getLanguageLabel(language)

  return `
Tu es un assistant expert de la reformulation de mails.

Ta mission est de conserver strictement le sens, les informations et la structure utile de la reponse ci-dessous,
mais de la rediger integralement en ${languageLabel}.

Consignes :
- Reponds uniquement en JSON valide.
- Respecte strictement cette structure :
{
  "body": "reponse complete"
}
- Ne change ni le fond, ni les decisions, ni les informations metier.
- Ne resume pas.
- Ne rajoute aucune information.
- Traduis et reformule uniquement pour obtenir une reponse finale naturelle en ${languageLabel}.

Reponse source a reformuler :
${body || ""}
  `.trim()
}

function extractReplyDiagnosticJson(text) {
  try {
    const parsed = extractJson(text)
    return {
      contextSufficient: Boolean(parsed.context_sufficient),
      shouldConsultRules: Boolean(parsed.should_consult_rules),
      rulesWouldHelp: Boolean(parsed.rules_would_help),
      missingInformation: Array.isArray(parsed.missing_information)
        ? parsed.missing_information.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      reasoningSummary: typeof parsed.reasoning_summary === "string" ? parsed.reasoning_summary.trim() : "",
      draftResponse: typeof parsed.draft_response === "string" ? parsed.draft_response.trim() : ""
    }
  } catch (_) {
    const source = typeof text === "string" ? text.trim() : ""
    return {
      contextSufficient: /"context_sufficient"\s*:\s*true/i.test(source),
      shouldConsultRules: /"should_consult_rules"\s*:\s*true/i.test(source),
      rulesWouldHelp: /"rules_would_help"\s*:\s*true/i.test(source),
      missingInformation: [],
      reasoningSummary: extractQuotedField(source, "reasoning_summary"),
      draftResponse: extractQuotedField(source, "draft_response")
    }
  }
}

function buildFallbackReply(payload) {
  const language = String(payload.language || "fr").trim().toLowerCase()
  const fallbackByLanguage = {
    ar: [
      "مرحبا،",
      "",
      "شكرا على رسالتكم.",
      "",
      "لقد اطلعنا على طلبكم وسنعود إليكم في أقرب وقت ممكن.",
      "",
      "مع خالص التحية"
    ],
    nl: [
      "Hallo,",
      "",
      "Dank u voor uw bericht.",
      "",
      "Wij hebben uw verzoek goed ontvangen en komen zo snel mogelijk bij u terug.",
      "",
      "Met vriendelijke groet"
    ],
    en: [
      "Hello,",
      "",
      "Thank you for your message.",
      "",
      "We have received your request and will get back to you as soon as possible.",
      "",
      "Kind regards"
    ],
    es: [
      "Hola,",
      "",
      "Gracias por su mensaje.",
      "",
      "Hemos recibido su solicitud y volveremos a usted lo antes posible.",
      "",
      "Atentamente"
    ],
    de: [
      "Guten Tag,",
      "",
      "Vielen Dank für Ihre Nachricht.",
      "",
      "Wir haben Ihre Anfrage erhalten und melden uns schnellstmöglich bei Ihnen zurück.",
      "",
      "Mit freundlichen Grüßen"
    ],
    it: [
      "Buongiorno,",
      "",
      "Grazie per il suo messaggio.",
      "",
      "Abbiamo preso in carico la sua richiesta e le risponderemo al più presto.",
      "",
      "Cordiali saluti"
    ],
    fr: [
      "Bonjour,",
      "",
      "Merci pour votre message.",
      "",
      "Nous avons bien pris connaissance de votre demande et revenons vers vous dans les meilleurs delais.",
      "",
      "Bien cordialement"
    ]
  }

  return {
    body: (fallbackByLanguage[language] || fallbackByLanguage.fr).join("\n")
  }
}

async function createReplyDraft(payload = {}, options = {}) {
  const requestedModel = options.model || "deepseek-chat"
  const requestId = getRequestIdFromOptions(options)
  const attachmentContext = buildAttachmentContext(payload.receivedAttachments || [])
  const applicableRules = resolveApplicableRules(payload)
  const language = String(payload.language || "fr").trim().toLowerCase()
  const promptPayload = {
    ...payload,
    activeRulesText: payload.activeRulesText || formatApplicableRulesForPrompt(applicableRules)
  }
  const prompt = buildReplyMailPrompt(promptPayload)
  const startedAt = Date.now()

  debugMailController(`[${requestId}] createReplyDraft START model=${requestedModel}`)

  try {
    recordStatsEvent(buildGenerationStatsPayload("reply", "started", options, {
      message_id: payload.messageId || null,
      attachment_count: attachmentContext.attachments.length,
      target_language: payload.language || "fr",
      automatic: options.automatic ? 1 : 0,
      provider: requestedModel,
      model_name: requestedModel,
      model_label: requestedModel,
      model_kind: String(requestedModel || "").includes(":") ? "local" : "api",
      selection_mode: options.selectionMode || "user_selected",
      metadata: {
        source: "createReplyDraft",
        requestId
      }
    }))
  } catch (_) {
    // Les statistiques ne doivent jamais bloquer la generation.
  }

  try {
    const aiRaw = await runAIWithTimeout(requestedModel, prompt, {
      ...options,
      requestId
    })
    const draft = extractReplyMailJson(aiRaw)
    let finalBody = draft.body || buildFallbackReply(payload).body

    if (language !== "fr" && finalBody) {
      try {
        debugMailController(
          `[${requestId}] createReplyDraft REWRITE START model=${requestedModel} language=${language}`
        )

        const rewritePrompt = buildReplyLanguageRewritePrompt(finalBody, language)
        const rewrittenRaw = await runAIWithTimeout(requestedModel, rewritePrompt, {
          ...options,
          requestId
        })
        const rewrittenDraft = extractReplyMailJson(rewrittenRaw)
        if (rewrittenDraft.body) {
          finalBody = rewrittenDraft.body
        }

        debugMailController(
          `[${requestId}] createReplyDraft REWRITE SUCCESS model=${requestedModel} language=${language}`
        )
      } catch (error) {
        debugMailController(
          `[${requestId}] createReplyDraft REWRITE FALLBACK model=${requestedModel} language=${language} error=${error?.message || error}`
        )
      }
    }

    debugMailController(`[${requestId}] createReplyDraft SUCCESS model=${requestedModel}`)

    try {
      recordStatsEvent(buildGenerationStatsPayload("reply", "succeeded", options, {
        message_id: payload.messageId || null,
        attachment_count: attachmentContext.attachments.length,
        target_language: payload.language || "fr",
        automatic: options.automatic ? 1 : 0,
        provider: requestedModel,
        model_name: requestedModel,
        model_label: requestedModel,
        model_kind: String(requestedModel || "").includes(":") ? "local" : "api",
        selection_mode: options.selectionMode || "user_selected",
        duration_ms: Date.now() - startedAt,
        generated_word_count: countWords(finalBody),
        generated_character_count: finalBody.length,
        metadata: {
          source: "createReplyDraft",
          requestId,
          fallback_used: false,
          applied_rule_count: applicableRules.length
        }
      }))
    } catch (_) {
      // Les statistiques ne doivent jamais bloquer la generation.
    }

    return {
      draft: {
        body: finalBody
      },
      meta: {
        provider: requestedModel,
        fallback: false,
        attachmentCount: attachmentContext.attachments.length,
        attachmentNames: attachmentContext.attachments.map((attachment) => attachment.filename),
        attachmentsWithExtractedText: attachmentContext.attachments.filter((attachment) => attachment.hasUsableText).length,
        appliedRuleCount: applicableRules.length,
        appliedRuleTitles: applicableRules.map((rule) => rule.title),
        aiInputPreview: prompt,
        requestId
      }
    }
  } catch (error) {
    debugMailController(
      `[${requestId}] createReplyDraft FALLBACK model=${requestedModel} error=${error?.message || error}`
    )

    const draft = buildFallbackReply(payload)
    try {
      recordStatsEvent(buildGenerationStatsPayload("reply", "failed", options, {
        message_id: payload.messageId || null,
        attachment_count: attachmentContext.attachments.length,
        target_language: payload.language || "fr",
        automatic: options.automatic ? 1 : 0,
        provider: requestedModel,
        model_name: requestedModel,
        model_label: requestedModel,
        model_kind: String(requestedModel || "").includes(":") ? "local" : "api",
        selection_mode: options.selectionMode || "user_selected",
        duration_ms: Date.now() - startedAt,
        generated_word_count: countWords(draft.body),
        generated_character_count: draft.body.length,
        error_message: error.message,
        metadata: {
          source: "createReplyDraft",
          requestId,
          fallback_used: true,
          applied_rule_count: applicableRules.length
        }
      }))
    } catch (_) {
      // Les statistiques ne doivent jamais bloquer la generation.
    }

    return {
      draft,
      meta: {
        provider: "reply-fallback",
        fallback: true,
        error: error.message,
        attachmentCount: attachmentContext.attachments.length,
        attachmentNames: attachmentContext.attachments.map((attachment) => attachment.filename),
        attachmentsWithExtractedText: attachmentContext.attachments.filter((attachment) => attachment.hasUsableText).length,
        appliedRuleCount: applicableRules.length,
        appliedRuleTitles: applicableRules.map((rule) => rule.title),
        aiInputPreview: prompt,
        requestId
      }
    }
  }
}
async function createReplyDiagnostic(payload = {}, options = {}) {
  const requestedModel = options.model || "deepseek-chat"
  const promptMode = String(options.rulesPromptMode || "reference").trim().toLowerCase()
  const attachmentContext = buildAttachmentContext(payload.receivedAttachments || [])
  const applicableRules = resolveApplicableRules(payload)
  const promptPayload = {
    ...payload,
    activeRulesText: payload.activeRulesText || formatApplicableRulesForPrompt(applicableRules)
  }
  const prompt = buildReplyDiagnosticPrompt(promptPayload, promptMode)

  try {
    const aiRaw = await runAIWithTimeout(requestedModel, prompt, options)
    const diagnostic = extractReplyDiagnosticJson(aiRaw)

    return {
      diagnostic: {
        contextSufficient: diagnostic.contextSufficient,
        shouldConsultRules: diagnostic.shouldConsultRules,
        rulesWouldHelp: diagnostic.rulesWouldHelp,
        missingInformation: diagnostic.missingInformation,
        reasoningSummary: diagnostic.reasoningSummary,
        draftResponse: diagnostic.draftResponse
      },
      meta: {
        provider: requestedModel,
        fallback: false,
        attachmentCount: attachmentContext.attachments.length,
        attachmentNames: attachmentContext.attachments.map((attachment) => attachment.filename),
        attachmentsWithExtractedText: attachmentContext.attachments.filter((attachment) => attachment.hasUsableText).length,
        appliedRuleCount: applicableRules.length,
        appliedRuleTitles: applicableRules.map((rule) => rule.title),
        rulesPromptMode: promptMode,
        aiInputPreview: prompt
      }
    }
  } catch (error) {
    return {
      diagnostic: {
        contextSufficient: false,
        shouldConsultRules: true,
        rulesWouldHelp: true,
        missingInformation: [],
        reasoningSummary: "",
        draftResponse: buildFallbackReply(payload).body
      },
      meta: {
        provider: "reply-diagnostic-fallback",
        fallback: true,
        error: error.message,
        attachmentCount: attachmentContext.attachments.length,
        attachmentNames: attachmentContext.attachments.map((attachment) => attachment.filename),
        attachmentsWithExtractedText: attachmentContext.attachments.filter((attachment) => attachment.hasUsableText).length,
        appliedRuleCount: applicableRules.length,
        appliedRuleTitles: applicableRules.map((rule) => rule.title),
        rulesPromptMode: promptMode,
        aiInputPreview: prompt
      }
    }
  }
}

module.exports = {
  importMail,
  createMailDraft,
  createReplyDraft,
  createReplyDiagnostic,
  processTextAssist,
  resolveTextAssistSource,
  interpretVoiceEditCommand,
  buildReplyDiagnosticPromptReference,
  buildReplyDiagnosticPromptMandatory
}
