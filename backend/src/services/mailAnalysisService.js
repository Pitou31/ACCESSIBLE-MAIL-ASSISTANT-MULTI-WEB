const { analyseEmail } = require("./llmService")

const CATEGORY_LABELS = {
  demande_document: "Demande de document",
  question_facture: "Question facture",
  demande_information: "Demande d'information",
  reclamation: "Réclamation",
  "réclamation": "Réclamation",
  relance: "Relance",
  autre: "Autre"
}

const PRIORITY_LABELS = {
  low: "Basse",
  normal: "Normale",
  high: "Haute",
  critical: "Critique"
}

const PRIORITY_RANK = {
  low: 1,
  normal: 2,
  high: 3,
  critical: 4
}

const DEFAULT_PRIORITY_RULES_CONFIG = {
  levels: {
    lowMax: 0,
    normalMax: 4,
    highMax: 7
  },
  weights: {
    urgentTerms: 4,
    deadlineTerms: 3,
    blockingTerms: 3,
    inabilityTerms: 2,
    followupTerms: 3,
    complaintTerms: 3,
    billingTerms: 2,
    infoTerms: 1,
    attachmentBonus: 1,
    longMailBonus: 1,
    twoFamiliesBonus: 1,
    threeFamiliesBonus: 2,
    thankYouOnlyPenalty: -1
  },
  criteria: {
    urgentTerms: ["urgent", "urgence", "très urgent", "critique", "immédiat", "immediat"],
    deadlineTerms: ["aujourd'hui", "aujourdhui", "dès que possible", "des que possible", "avant le", "date limite", "échéance", "echeance", "ce jour", "dans la journée", "dans la journee"],
    blockingTerms: ["bloqué", "bloque", "impossible", "problème", "probleme", "erreur", "incident", "panne"],
    inabilityTerms: ["je ne peux pas", "je n'arrive pas", "je narrive pas", "je suis dans l'impossibilité", "je suis dans limpossibilite"],
    followupTerms: [
      "relance",
      "je vous relance",
      "sans réponse",
      "sans reponse",
      "deuxième fois",
      "deuxieme fois",
      "troisième fois",
      "troisieme fois",
      "rappel",
      "je reviens vers vous",
      "je me permets de revenir vers vous",
      "suite à mon précédent mail",
      "suite a mon precedent mail",
      "a nouveau",
      "à nouveau"
    ],
    complaintTerms: ["réclamation", "reclamation", "mécontent", "mecontent", "plainte", "contestation"],
    billingTerms: ["facture", "paiement", "remboursement", "remboursement", "prélèvement", "prelevement"],
    infoTerms: ["information", "informations", "renseignement", "renseignements", "précision", "precision"],
    thankYouTerms: ["merci", "remerciement", "bien reçu", "bien recu"]
  }
}

function normalizeText(value = "") {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

function includesAny(text, terms = []) {
  return terms.some((term) => text.includes(normalizeText(term)))
}

function detectDeadlinePattern(text) {
  return /\b(\d{1,2}[/-]\d{1,2}([/-]\d{2,4})?)\b/.test(text)
}

function computePriority(mailContext = {}, config = DEFAULT_PRIORITY_RULES_CONFIG) {
  const weights = config.weights || DEFAULT_PRIORITY_RULES_CONFIG.weights
  const criteria = config.criteria || DEFAULT_PRIORITY_RULES_CONFIG.criteria
  const levels = config.levels || DEFAULT_PRIORITY_RULES_CONFIG.levels
  const subject = normalizeText(mailContext.subject || "")
  const body = normalizeText(mailContext.body || "")
  const text = `${subject}\n${body}`.trim()
  const reasons = []
  const families = new Set()
  let score = 0

  function addReasonIfMatched(name, label, family, weight) {
    const terms = criteria[name] || []
    if (!includesAny(text, terms)) {
      return
    }
    score += Number(weight || 0)
    families.add(family)
    reasons.push(label)
  }

  addReasonIfMatched("urgentTerms", "urgence explicite", "deadline", weights.urgentTerms)
  addReasonIfMatched("deadlineTerms", "délai ou échéance demandée", "deadline", weights.deadlineTerms)
  addReasonIfMatched("blockingTerms", "blocage ou incident", "blocking", weights.blockingTerms)
  addReasonIfMatched("inabilityTerms", "impossibilité d'agir", "blocking", weights.inabilityTerms)
  addReasonIfMatched("followupTerms", "relance ou absence de réponse", "followup", weights.followupTerms)
  addReasonIfMatched("complaintTerms", "réclamation ou contestation", "business", weights.complaintTerms)
  addReasonIfMatched("billingTerms", "facturation ou paiement", "business", weights.billingTerms)
  addReasonIfMatched("infoTerms", "demande d'information", "information", weights.infoTerms)

  if (detectDeadlinePattern(text)) {
    score += Number(weights.deadlineTerms || 0)
    families.add("deadline")
    reasons.push("date ou échéance détectée")
  }

  if (Array.isArray(mailContext.attachments) && mailContext.attachments.length > 0) {
    score += Number(weights.attachmentBonus || 0)
    families.add("context")
    reasons.push("pièce jointe présente")
  }

  if ((mailContext.body || "").length >= 600) {
    score += Number(weights.longMailBonus || 0)
    families.add("context")
    reasons.push("message détaillé ou long")
  }

  const hasOnlyThanksSignal =
    includesAny(text, criteria.thankYouTerms || [])
    && families.size === 0
    && !detectDeadlinePattern(text)

  if (hasOnlyThanksSignal) {
    score += Number(weights.thankYouOnlyPenalty || 0)
    reasons.push("message de remerciement simple")
  }

  if (families.size >= 2) {
    score += Number(weights.twoFamiliesBonus || 0)
    reasons.push("combinatoire de plusieurs familles")
  }

  if (families.size >= 3) {
    score += Number(weights.threeFamiliesBonus || 0)
    reasons.push("combinatoire forte")
  }

  let priority = "normal"
  if (score <= Number(levels.lowMax ?? 0)) {
    priority = "low"
  } else if (score <= Number(levels.normalMax ?? 4)) {
    priority = "normal"
  } else if (score <= Number(levels.highMax ?? 7)) {
    priority = "high"
  } else {
    priority = "critical"
  }

  return {
    priority,
    priorityLabel: PRIORITY_LABELS[priority] || "Normale",
    score,
    reasons
  }
}

function forceMinimumPriority(priorityAnalysis, minimumPriority, reason) {
  const currentRank = PRIORITY_RANK[priorityAnalysis.priority] || 0
  const minimumRank = PRIORITY_RANK[minimumPriority] || 0
  if (currentRank >= minimumRank) {
    return priorityAnalysis
  }

  return {
    ...priorityAnalysis,
    priority: minimumPriority,
    priorityLabel: PRIORITY_LABELS[minimumPriority] || priorityAnalysis.priorityLabel,
    reasons: [...priorityAnalysis.reasons, reason]
  }
}

async function analyzeMailForProcessing(mailContext = {}, options = {}) {
  const analysis = await analyseEmail({
    from: mailContext.from || "",
    subject: mailContext.subject || "",
    body: mailContext.body || ""
  })

  let priorityAnalysis = computePriority(mailContext, options.priorityConfig || DEFAULT_PRIORITY_RULES_CONFIG)

  if (analysis.category === "relance") {
    priorityAnalysis = forceMinimumPriority(priorityAnalysis, "high", "classification relance : priorité minimale haute")
  }

  return {
    category: analysis.category || "autre",
    categoryLabel: CATEGORY_LABELS[analysis.category] || "Autre",
    priority: priorityAnalysis.priority,
    priorityLabel: priorityAnalysis.priorityLabel,
    priorityScore: priorityAnalysis.score,
    priorityReasons: priorityAnalysis.reasons,
    summary: analysis.summary || ""
  }
}

module.exports = {
  analyzeMailForProcessing,
  CATEGORY_LABELS,
  PRIORITY_LABELS,
  DEFAULT_PRIORITY_RULES_CONFIG
}
