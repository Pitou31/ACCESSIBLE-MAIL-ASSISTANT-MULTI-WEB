const accessSummary = document.getElementById("ruleCreationAccessSummary")
const draftForm = document.getElementById("ruleBuilderDraftForm")
const draftFeedback = document.getElementById("ruleBuilderDraftFeedback")
const finalizeFeedback = document.getElementById("ruleBuilderFinalizeFeedback")
const saveFeedback = document.getElementById("ruleBuilderSaveFeedback")
const promptFeedback = document.getElementById("rulePromptFeedback")

const modeInput = document.getElementById("ruleBuilderModeInput")
const modelInput = document.getElementById("ruleBuilderModelInput")
const operatorCommentInput = document.getElementById("ruleBuilderOperatorCommentInput")
const modeHelp = document.getElementById("ruleBuilderModeHelp")
const requestsInput = document.getElementById("ruleBuilderRequestsInput")
const adminAnswersInput = document.getElementById("ruleBuilderAdminAnswersInput")
const manualPanel = document.getElementById("ruleBuilderManualPanel")
const manualDraftInput = document.getElementById("ruleBuilderManualDraftInput")
const manualFeedback = document.getElementById("ruleBuilderManualFeedback")
const importBtn = document.getElementById("ruleBuilderImportBtn")
const copyContextBtn = document.getElementById("copyRuleBuilderContextBtn")
const copyFinalizeContextBtn = document.getElementById("copyRuleBuilderFinalizeContextBtn")
const copyCheckContextBtn = document.getElementById("copyRuleBuilderCheckContextBtn")
const promptCreateText = document.getElementById("rulePromptCreateText")
const promptFinalizeText = document.getElementById("rulePromptFinalizeText")
const promptCheckText = document.getElementById("rulePromptCheckText")
const copyPromptCreateBtn = document.getElementById("copyRulePromptCreateBtn")
const copyPromptFinalizeBtn = document.getElementById("copyRulePromptFinalizeBtn")
const copyPromptCheckBtn = document.getElementById("copyRulePromptCheckBtn")

const motifText = document.getElementById("ruleBuilderMotifText")
const decisionText = document.getElementById("ruleBuilderDecisionText")
const draftText = document.getElementById("ruleBuilderDraftText")
const questionsText = document.getElementById("ruleBuilderQuestionsText")
const missingPointsText = document.getElementById("ruleBuilderMissingPointsText")
const expectedEffectText = document.getElementById("ruleBuilderExpectedEffectText")
const summaryText = document.getElementById("ruleBuilderSummaryText")
const remainingGapsText = document.getElementById("ruleBuilderRemainingGapsText")

const finalizeBtn = document.getElementById("ruleBuilderFinalizeBtn")
const saveBtn = document.getElementById("ruleBuilderSaveBtn")

const saveForm = document.getElementById("ruleBuilderSaveForm")
const finalFields = {
  title: document.getElementById("ruleBuilderFinalTitleInput"),
  ruleType: document.getElementById("ruleBuilderFinalTypeInput"),
  applicationScope: document.getElementById("ruleBuilderFinalApplicationInput"),
  mailboxScope: document.getElementById("ruleBuilderFinalMailboxInput"),
  mailCategoryScope: document.getElementById("ruleBuilderFinalCategoryInput"),
  workflowScope: document.getElementById("ruleBuilderFinalWorkflowInput"),
  theme: document.getElementById("ruleBuilderFinalThemeInput"),
  missingInfoAction: document.getElementById("ruleBuilderFinalMissingActionInput"),
  priorityRank: document.getElementById("ruleBuilderFinalPriorityInput"),
  status: document.getElementById("ruleBuilderFinalStatusInput"),
  content: document.getElementById("ruleBuilderFinalContentInput"),
  notes: document.getElementById("ruleBuilderFinalNotesInput")
}

let currentSession = null
let currentDraft = null
let currentFinalRule = null
let currentSavedRuleId = ""

const EXTERNAL_CREATE_PROMPT = `Tu es un assistant chargé d'aider un administrateur à créer une règle métier pour une application de réponse automatique aux mails.

Objectif :
À partir d'une ou plusieurs demandes reçues, proposer une règle métier candidate réutilisable.
Si les informations disponibles ne suffisent pas à produire une règle suffisamment précise, tu dois :
- l'indiquer explicitement,
- lister ce qu'il manque,
- formuler les questions minimales à poser à l'administrateur pour finaliser la règle.

Contraintes :
- ne pas créer une règle spécifique à un seul mail,
- identifier le motif métier commun,
- produire une règle générale applicable à plusieurs demandes du même type,
- viser une réponse définitive dès le premier run si possible,
- sinon une demande de complément minimale côté usager,
- ne pas inventer de données métier absentes,
- signaler clairement si la règle reste trop vague sans complément administrateur.

Réponds uniquement en JSON valide avec cette structure :

{
  "motif_metier": "motif identifié",
  "merite_une_regle": true,
  "niveau_standardisation": "faible|moyen|fort",
  "justification": "explication courte",
  "regle_candidate": {
    "titre": "titre proposé",
    "objectif": "objectif opérationnel",
    "texte_regle": "texte complet de la règle candidate",
    "niveau_precision": "insuffisant|correct|bon",
    "utilisable_immediatement": false
  },
  "points_a_preciser": [
    "point manquant 1",
    "point manquant 2"
  ],
  "questions_pour_admin": [
    "question 1",
    "question 2",
    "question 3"
  ],
  "impact_attendu": {
    "peut_repondre_en_one_shot": true,
    "sinon_demander": [
      "complément minimal 1",
      "complément minimal 2"
    ]
  },
  "sources_ou_services_utiles": [
    {
      "type": "regle_interne|fichier|base_de_donnees|site_web|api|aucun",
      "description": "source ou service utile"
    }
  ],
  "prochaine_action_recommandee": "creer_la_regle|completer_les_parametres_admin|ne_pas_creer_de_regle"
}

Demandes à analyser :
[COLLER ICI UNE OU PLUSIEURS DEMANDES]`

const EXTERNAL_FINALIZE_PROMPT = `Tu es un assistant chargé de finaliser une règle métier pour une application de réponse automatique aux mails.

Tu disposes :
- de la ou des demandes d'origine,
- d'une règle candidate,
- et des réponses apportées par l'administrateur pour la rendre exploitable.

Objectif :
Produire la règle finale prête à être enregistrée dans le référentiel métier.

Contraintes :
- la règle doit rester générale et réutilisable,
- elle doit viser une réponse définitive dès le premier run si possible,
- sinon une demande de complément minimale et ciblée,
- elle ne doit pas contenir de formulation vague,
- n'invente aucune donnée métier absente des réponses administrateur,
- si certaines données restent absentes, le signaler dans les notes.

Réponds uniquement en JSON valide avec cette structure :

{
  "final_rule": {
    "title": "titre final",
    "content": "texte complet final de la règle",
    "rule_type": "content|prudence|validation|missing_info|source_access",
    "priority_rank": 100,
    "application_scope": "mail_assistant",
    "mailbox_scope": "global",
    "mail_category_scope": "global",
    "workflow_scope": "reply",
    "theme": "theme principal",
    "missing_info_action": "cautious_reply|ask_for_more|block_final_reply|require_human_validation|require_external_source",
    "status": "active",
    "notes": "note interne éventuelle"
  },
  "summary": "résumé court de la règle finale",
  "remaining_gaps": [
    "lacune restante 1"
  ]
}

Demandes source :
[COLLER ICI LES DEMANDES]

Règle candidate :
[COLLER ICI LE JSON OU LE TEXTE DE LA RÈGLE CANDIDATE]

Réponses de l'administrateur :
[COLLER ICI LES RÉPONSES ADMIN]`

const EXTERNAL_CHECK_PROMPT = `Tu es un assistant de contrôle qualité chargé de vérifier si une règle métier a bien été appliquée dans une réponse générée à un mail.

Objectif :
Analyser si la réponse produite tient réellement compte de la règle active et si elle est conforme à l'intention métier attendue.

Contraintes :
- ne pas juger seulement le style,
- vérifier surtout la conformité métier,
- dire clairement si la règle a été appliquée, partiellement appliquée ou non appliquée,
- signaler les écarts concrets,
- ne pas inventer d'informations absentes.

Réponds uniquement en JSON valide avec cette structure :

{
  "rule_was_relevant": true,
  "rule_was_applied": "yes|partially|no",
  "overall_quality": "poor|fair|good|excellent",
  "compliance_summary": "résumé court",
  "points_correctly_applied": [
    "point respecté 1",
    "point respecté 2"
  ],
  "points_missing_or_incorrect": [
    "point manquant ou incorrect 1",
    "point manquant ou incorrect 2"
  ],
  "did_response_use_rule_logic": true,
  "did_response_request_only_needed_missing_info": true,
  "suggested_improved_response": "version améliorée courte de la réponse si nécessaire"
}

Mail reçu :
[COLLER ICI LE MAIL]

Règle active :
[COLLER ICI LA RÈGLE]

Réponse générée :
[COLLER ICI LA RÉPONSE IA]`

function setFeedback(element, text, tone = "info") {
  if (!element) return
  element.textContent = text
  element.classList.remove("is-info", "is-success", "is-error")
  element.classList.add(tone === "error" ? "is-error" : tone === "success" ? "is-success" : "is-info")
}

async function copyText(text, successMessage) {
  await navigator.clipboard.writeText(text)
  setFeedback(promptFeedback, successMessage, "success")
}

function buildCreateContextExport() {
  const requestsText = requestsInput.value.trim()
  const operatorComment = operatorCommentInput.value.trim()
  return [
    "Commentaire opérateur :",
    operatorComment || "Aucun commentaire opérateur",
    "",
    "Demandes à analyser :",
    requestsText || "[Aucune demande fournie]"
  ].join("\n")
}

function buildFinalizeContextExport() {
  const requestsText = requestsInput.value.trim()
  const operatorComment = operatorCommentInput.value.trim()
  const adminAnswersText = adminAnswersInput.value.trim()
  const draftJsonText = currentDraft
    ? JSON.stringify(currentDraft, null, 2)
    : String(manualDraftInput.value || "").trim()

  return [
    "Commentaire opérateur :",
    operatorComment || "Aucun commentaire opérateur",
    "",
    "Demandes source :",
    requestsText || "[Aucune demande fournie]",
    "",
    "Règle candidate :",
    draftJsonText || "[Aucun brouillon disponible]",
    "",
    "Réponses de l'administrateur :",
    adminAnswersText || "[Aucune réponse administrateur fournie]"
  ].join("\n")
}

function buildCheckContextExport() {
  const requestsText = requestsInput.value.trim()
  const finalRule = collectFinalRulePayload()

  return [
    "Mail reçu :",
    requestsText || "[Aucune demande fournie]",
    "",
    "Règle active :",
    finalRule.title || finalRule.content
      ? JSON.stringify(finalRule, null, 2)
      : "[Aucune règle finale disponible]",
    "",
    "Réponse générée :",
    "[COLLER ICI LA RÉPONSE IA À CONTRÔLER]"
  ].join("\n")
}

function toMultilineText(value, fallback = "") {
  if (Array.isArray(value)) {
    return value.length ? value.map((item) => `- ${item}`).join("\n") : fallback
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value, null, 2)
  }
  const text = String(value || "").trim()
  return text || fallback
}

function extractJson(text) {
  const trimmed = String(text || "").trim()
  if (!trimmed) {
    throw new Error("Le brouillon externe est vide.")
  }
  try {
    return JSON.parse(trimmed)
  } catch (_) {
    const match = trimmed.match(/\{[\s\S]*\}/)
    if (!match) {
      throw new Error("Aucun JSON détecté dans le brouillon externe.")
    }
    return JSON.parse(match[0])
  }
}

function buildFallbackDraftFromText(text) {
  const trimmed = String(text || "").trim()
  if (!trimmed) {
    throw new Error("Le brouillon externe est vide.")
  }

  return {
    motif_metier: "à préciser manuellement",
    merite_une_regle: true,
    niveau_standardisation: "moyen",
    justification: "Brouillon importé manuellement depuis un LLM externe.",
    regle_candidate: {
      titre: "Règle importée à finaliser",
      objectif: "Reprendre un brouillon externe et le transformer en règle métier exploitable.",
      texte_regle: trimmed,
      niveau_precision: "correct",
      utilisable_immediatement: false
    },
    points_a_preciser: [
      "Vérifier le motif métier réel",
      "Valider le niveau de généralisation",
      "Compléter les paramètres métier manquants"
    ],
    questions_pour_admin: [
      "Quels paramètres métier faut-il ajouter pour rendre cette règle robuste ?",
      "Cette règle couvre-t-elle une famille de demandes répétitives ?",
      "Quel niveau de précision attend-on pour répondre en one shot ?"
    ],
    impact_attendu: {
      peut_repondre_en_one_shot: false,
      sinon_demander: [
        "les compléments strictement nécessaires définis par l'administrateur"
      ]
    },
    sources_ou_services_utiles: [
      {
        type: "aucun",
        description: "Brouillon externe importé manuellement."
      }
    ],
    prochaine_action_recommandee: "completer_les_parametres_admin"
  }
}

function fillFinalRule(rule) {
  currentFinalRule = rule
  currentSavedRuleId = rule.id || currentSavedRuleId || ""
  finalFields.title.value = rule.title || ""
  finalFields.ruleType.value = rule.ruleType || "content"
  finalFields.applicationScope.value = rule.applicationScope || "mail_assistant"
  finalFields.mailboxScope.value = rule.mailboxScope || "global"
  finalFields.mailCategoryScope.value = rule.mailCategoryScope || "global"
  finalFields.workflowScope.value = rule.workflowScope || "reply"
  finalFields.theme.value = rule.theme || ""
  finalFields.missingInfoAction.value = rule.missingInfoAction || "cautious_reply"
  finalFields.priorityRank.value = String(rule.priorityRank || 100)
  finalFields.status.value = rule.status || "active"
  finalFields.content.value = rule.content || ""
  finalFields.notes.value = rule.notes || ""
  saveBtn.disabled = false
}

function updateModeUI() {
  const isManual = modeInput?.value === "manual"
  if (draftForm) {
    draftForm.hidden = isManual
  }
  if (manualPanel) {
    manualPanel.hidden = !isManual
  }
  if (modelInput) {
    modelInput.disabled = isManual
  }
  if (modeHelp) {
    modeHelp.textContent = isManual
      ? "En mode manuel, tu colles un brouillon externe déjà généré, puis tu poursuis la finalisation et l’enregistrement ici."
      : "Le commentaire opérateur est injecté dans le prompt pour cadrer la création de la règle."
  }
}

function clearDraftOutputs() {
  motifText.textContent = "Aucun brouillon généré."
  decisionText.textContent = "L’IA indiquera ici si la demande mérite une règle."
  draftText.value = ""
  questionsText.value = ""
  missingPointsText.value = ""
  expectedEffectText.value = ""
  summaryText.value = ""
  remainingGapsText.value = ""
  currentDraft = null
  currentFinalRule = null
  currentSavedRuleId = ""
  finalizeBtn.disabled = true
  saveBtn.disabled = true
  Object.values(finalFields).forEach((field) => {
    if (field) field.value = field.tagName === "SELECT" ? field.value : ""
  })
  finalFields.applicationScope.value = "mail_assistant"
  finalFields.mailboxScope.value = "global"
  finalFields.mailCategoryScope.value = "global"
  finalFields.workflowScope.value = "reply"
  finalFields.priorityRank.value = "100"
  finalFields.status.value = "active"
}

async function loadSession() {
  const response = await fetch("/api/account/session", {
    cache: "no-store",
    credentials: "same-origin"
  })
  const result = await response.json()
  if (!response.ok || !result.ok || !result.accountActive || !result.session) {
    window.location.href = "/frontend/admin-login.html"
    return null
  }

  currentSession = result.session
  if (result.session.role !== "admin") {
    setFeedback(accessSummary, "Accès réservé à l’administrateur.", "error")
    window.setTimeout(() => {
      window.location.href = "/frontend/admin-login.html"
    }, 1200)
    return null
  }

  setFeedback(accessSummary, `Administrateur connecté : ${result.session.email}`, "success")
  return result.session
}

function renderDraftResult(result) {
  const draft = result.draft || {}
  currentDraft = draft
  motifText.textContent = draft.motif_metier || "Motif non détecté."
  decisionText.textContent = draft.merite_une_regle
    ? `Oui, règle utile. Standardisation : ${draft.niveau_standardisation || "non précisée"}.`
    : `Non, cette demande ne semble pas mériter une règle.`

  draftText.value = toMultilineText(draft.regle_candidate?.texte_regle, "")
  questionsText.value = toMultilineText(draft.questions_pour_admin, "Aucune question complémentaire.")
  missingPointsText.value = toMultilineText(draft.points_a_preciser, "Aucun point manquant détecté.")

  const effectLines = []
  if (draft.impact_attendu?.peut_repondre_en_one_shot !== undefined) {
    effectLines.push(`One shot visé : ${draft.impact_attendu.peut_repondre_en_one_shot ? "oui" : "non"}`)
  }
  if (Array.isArray(draft.impact_attendu?.sinon_demander) && draft.impact_attendu.sinon_demander.length) {
    effectLines.push("Compléments minimaux à demander :")
    effectLines.push(...draft.impact_attendu.sinon_demander.map((item) => `- ${item}`))
  }
  if (Array.isArray(draft.sources_ou_services_utiles) && draft.sources_ou_services_utiles.length) {
    effectLines.push("Sources ou services utiles :")
    effectLines.push(...draft.sources_ou_services_utiles.map((item) => `- ${item.type} : ${item.description}`))
  }
  expectedEffectText.value = effectLines.join("\n")

  summaryText.value = [
    `Motif : ${draft.motif_metier || "non détecté"}`,
    `Justification : ${draft.justification || "aucune"}`,
    `Prochaine action : ${draft.prochaine_action_recommandee || "non précisée"}`
  ].join("\n")

  finalizeBtn.disabled = false
}

async function generateDraft(event) {
  event.preventDefault()
  const requestsText = requestsInput.value.trim()
  const operatorComment = operatorCommentInput.value.trim()
  const model = modelInput.value

  if (!requestsText) {
    setFeedback(draftFeedback, "Colle au moins une demande source.", "error")
    return
  }

  clearDraftOutputs()
  setFeedback(draftFeedback, "Génération du brouillon en cours...", "info")
  setFeedback(finalizeFeedback, "La finalisation se débloquera après génération.", "info")

  const response = await fetch("/api/admin/rule-builder/draft", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({
      requestsText,
      operatorComment,
      model
    })
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Erreur pendant la génération du brouillon.")
  }

  renderDraftResult(result)
  setFeedback(draftFeedback, "Brouillon généré. Tu peux maintenant compléter les paramètres admin.", "success")
  setFeedback(finalizeFeedback, "Réponds aux questions puis lance la construction de la règle finale.", "info")
}

async function finalizeRule() {
  if (!currentDraft) {
    setFeedback(finalizeFeedback, "Génère d’abord une règle candidate.", "error")
    return
  }

  const requestsText = requestsInput.value.trim()
  const operatorComment = operatorCommentInput.value.trim()
  const adminAnswersText = adminAnswersInput.value.trim()
  const model = modelInput.value

  setFeedback(finalizeFeedback, "Construction de la règle finale en cours...", "info")
  const response = await fetch("/api/admin/rule-builder/finalize", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({
      requestsText,
      operatorComment,
      adminAnswersText,
      draft: currentDraft,
      model
    })
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Erreur pendant la construction de la règle finale.")
  }

  fillFinalRule(result.finalRule || {})
  summaryText.value = result.finalization?.summary || "Règle finale générée."
  remainingGapsText.value = toMultilineText(result.finalization?.remaining_gaps, "Aucune lacune restante signalée.")
  setFeedback(finalizeFeedback, "Règle finale construite. Tu peux encore la modifier avant enregistrement.", "success")
  setFeedback(saveFeedback, "Vérifie la règle finale puis enregistre-la dans le référentiel.", "info")
}

function importManualDraft() {
  const rawText = manualDraftInput.value.trim()
  if (!rawText) {
    setFeedback(manualFeedback, "Colle d’abord un brouillon externe.", "error")
    return
  }

  let draft
  try {
    const parsed = extractJson(rawText)
    draft = parsed.draft || parsed
  } catch (_) {
    draft = buildFallbackDraftFromText(rawText)
  }

  clearDraftOutputs()
  renderDraftResult({ draft })
  setFeedback(manualFeedback, "Brouillon externe importé. Tu peux maintenant compléter et finaliser.", "success")
  setFeedback(finalizeFeedback, "Réponds aux questions puis construis la règle finale.", "info")
}

function collectFinalRulePayload() {
  return {
    title: finalFields.title.value.trim(),
    ruleType: finalFields.ruleType.value,
    applicationScope: finalFields.applicationScope.value.trim() || "mail_assistant",
    mailboxScope: finalFields.mailboxScope.value.trim() || "global",
    mailCategoryScope: finalFields.mailCategoryScope.value.trim() || "global",
    workflowScope: finalFields.workflowScope.value.trim() || "reply",
    theme: finalFields.theme.value.trim(),
    missingInfoAction: finalFields.missingInfoAction.value,
    priorityRank: Number(finalFields.priorityRank.value || 100),
    status: finalFields.status.value,
    content: finalFields.content.value.trim(),
    notes: finalFields.notes.value.trim()
  }
}

async function saveFinalRule(event) {
  event.preventDefault()
  const rule = collectFinalRulePayload()

  if (!rule.title || !rule.content) {
    setFeedback(saveFeedback, "Le titre et le texte final de la règle sont requis.", "error")
    return
  }

  setFeedback(saveFeedback, "Enregistrement dans le référentiel...", "info")
  const isUpdate = Boolean(currentSavedRuleId)
  const response = await fetch(isUpdate ? "/api/admin/mail-rules/update" : "/api/admin/mail-rules", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(isUpdate
      ? {
          ruleId: currentSavedRuleId,
          updates: rule
        }
      : { rule })
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Erreur lors de l’enregistrement de la règle.")
  }

  currentSavedRuleId = result.rule?.id || currentSavedRuleId
  currentFinalRule = result.rule || currentFinalRule
  setFeedback(saveFeedback, `${isUpdate ? "Règle mise à jour" : "Règle enregistrée"} : ${result.rule?.title || rule.title}`, "success")
}

async function init() {
  try {
    const session = await loadSession()
    if (!session) {
      return
    }
    clearDraftOutputs()
    updateModeUI()
    if (promptCreateText) promptCreateText.value = EXTERNAL_CREATE_PROMPT
    if (promptFinalizeText) promptFinalizeText.value = EXTERNAL_FINALIZE_PROMPT
    if (promptCheckText) promptCheckText.value = EXTERNAL_CHECK_PROMPT
    setFeedback(draftFeedback, "Colle une ou plusieurs demandes réelles pour lancer la génération.", "info")
    setFeedback(finalizeFeedback, "La finalisation se débloquera après génération du brouillon.", "info")
    setFeedback(saveFeedback, "La règle finale sera enregistrable après finalisation.", "info")
    setFeedback(manualFeedback, "Tu peux utiliser ici une sortie ChatGPT, Claude ou un autre LLM.", "info")
    setFeedback(promptFeedback, "Les prompts sont prêts à être copiés vers un LLM externe.", "info")
  } catch (error) {
    setFeedback(accessSummary, error.message || "Erreur d’initialisation.", "error")
  }
}

draftForm?.addEventListener("submit", async (event) => {
  try {
    await generateDraft(event)
  } catch (error) {
    setFeedback(draftFeedback, error.message || "Erreur pendant la génération du brouillon.", "error")
  }
})

finalizeBtn?.addEventListener("click", async () => {
  try {
    await finalizeRule()
  } catch (error) {
    setFeedback(finalizeFeedback, error.message || "Erreur de finalisation.", "error")
  }
})

modeInput?.addEventListener("change", () => {
  updateModeUI()
  clearDraftOutputs()
})

importBtn?.addEventListener("click", () => {
  try {
    importManualDraft()
  } catch (error) {
    setFeedback(manualFeedback, error.message || "Erreur d’import manuel.", "error")
  }
})

copyPromptCreateBtn?.addEventListener("click", async () => {
  try {
    await copyText(EXTERNAL_CREATE_PROMPT, "Prompt de création copié.")
  } catch (error) {
    setFeedback(promptFeedback, error.message || "Impossible de copier le prompt de création.", "error")
  }
})

copyPromptFinalizeBtn?.addEventListener("click", async () => {
  try {
    await copyText(EXTERNAL_FINALIZE_PROMPT, "Prompt de finalisation copié.")
  } catch (error) {
    setFeedback(promptFeedback, error.message || "Impossible de copier le prompt de finalisation.", "error")
  }
})

copyPromptCheckBtn?.addEventListener("click", async () => {
  try {
    await copyText(EXTERNAL_CHECK_PROMPT, "Prompt de contrôle copié.")
  } catch (error) {
    setFeedback(promptFeedback, error.message || "Impossible de copier le prompt de contrôle.", "error")
  }
})

copyContextBtn?.addEventListener("click", async () => {
  try {
    await copyText(buildCreateContextExport(), "Contexte de création copié.")
  } catch (error) {
    setFeedback(promptFeedback, error.message || "Impossible de copier le contexte de création.", "error")
  }
})

copyFinalizeContextBtn?.addEventListener("click", async () => {
  try {
    await copyText(buildFinalizeContextExport(), "Contexte de finalisation copié.")
  } catch (error) {
    setFeedback(promptFeedback, error.message || "Impossible de copier le contexte de finalisation.", "error")
  }
})

copyCheckContextBtn?.addEventListener("click", async () => {
  try {
    await copyText(buildCheckContextExport(), "Contexte de contrôle copié.")
  } catch (error) {
    setFeedback(promptFeedback, error.message || "Impossible de copier le contexte de contrôle.", "error")
  }
})

saveForm?.addEventListener("submit", async (event) => {
  try {
    await saveFinalRule(event)
  } catch (error) {
    setFeedback(saveFeedback, error.message || "Erreur d’enregistrement.", "error")
  }
})

init()
