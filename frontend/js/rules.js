const rulesAccessSummary = document.getElementById("rulesAccessSummary")
const rulesListFeedback = document.getElementById("rulesListFeedback")
const rulesListContainer = document.getElementById("rulesListContainer")
const rulesEditorForm = document.getElementById("rulesEditorForm")
const rulesEditorTitle = document.getElementById("rulesEditorTitle")
const rulesEditorFeedback = document.getElementById("rulesEditorFeedback")
const rulesRefreshBtn = document.getElementById("rulesRefreshBtn")
const ruleResetBtn = document.getElementById("ruleResetBtn")

const statusFilter = document.getElementById("rulesStatusFilter")
const workflowFilter = document.getElementById("rulesWorkflowFilter")
const typeFilter = document.getElementById("rulesTypeFilter")
const searchInput = document.getElementById("rulesSearchInput")

const fields = {
  title: document.getElementById("ruleTitleInput"),
  ruleType: document.getElementById("ruleTypeInput"),
  applicationScope: document.getElementById("ruleApplicationScopeInput"),
  mailboxScope: document.getElementById("ruleMailboxScopeInput"),
  mailCategoryScope: document.getElementById("ruleCategoryScopeInput"),
  workflowScope: document.getElementById("ruleWorkflowScopeInput"),
  theme: document.getElementById("ruleThemeInput"),
  missingInfoAction: document.getElementById("ruleMissingInfoActionInput"),
  priorityRank: document.getElementById("rulePriorityRankInput"),
  status: document.getElementById("ruleStatusInput"),
  content: document.getElementById("ruleContentInput"),
  notes: document.getElementById("ruleNotesInput")
}

let currentSession = null
let currentEditingRuleId = ""
let currentRules = []

function isAdminRole(role = "") {
  return role === "admin" || role === "super_admin"
}

function normalizeSearch(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
}

function setFeedback(element, text, tone = "info") {
  if (!element) return
  element.textContent = text
  element.classList.remove("is-info", "is-success", "is-error")
  element.classList.add(tone === "error" ? "is-error" : tone === "success" ? "is-success" : "is-info")
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
  const role = result.session?.role || ""
  const email = result.session?.email || ""
  if (!isAdminRole(role)) {
    setFeedback(rulesAccessSummary, `Connecté en ${email}, mais l’édition des règles est réservée à l’administrateur.`, "error")
    disableEditor(true)
    window.setTimeout(() => {
      window.location.href = "/frontend/admin-login.html"
    }, 1200)
    return result.session
  }
  setFeedback(rulesAccessSummary, `Administrateur connecté : ${email}. Vous pouvez créer, modifier, activer et désactiver les règles.`, "success")
  disableEditor(false)
  return result.session
}

function disableEditor(disabled) {
  Object.values(fields).forEach((field) => {
    if (field) field.disabled = disabled
  })
  if (ruleResetBtn) ruleResetBtn.disabled = disabled
  const saveBtn = document.getElementById("ruleSaveBtn")
  if (saveBtn) saveBtn.disabled = disabled
}

function resetEditor() {
  currentEditingRuleId = ""
  rulesEditorTitle.textContent = "Nouvelle règle"
  fields.title.value = ""
  fields.ruleType.value = "prudence"
  fields.applicationScope.value = "mail_assistant"
  fields.mailboxScope.value = "global"
  fields.mailCategoryScope.value = "global"
  fields.workflowScope.value = "reply"
  fields.theme.value = ""
  fields.missingInfoAction.value = "cautious_reply"
  fields.priorityRank.value = "100"
  fields.status.value = "active"
  fields.content.value = ""
  fields.notes.value = ""
  setFeedback(rulesEditorFeedback, "Créer une règle générale, utile et répétitive.", "info")
}

function fillEditor(rule) {
  currentEditingRuleId = rule.id
  rulesEditorTitle.textContent = "Modifier la règle"
  fields.title.value = rule.title || ""
  fields.ruleType.value = rule.ruleType || "prudence"
  fields.applicationScope.value = rule.applicationScope || "mail_assistant"
  fields.mailboxScope.value = rule.mailboxScope || "global"
  fields.mailCategoryScope.value = rule.mailCategoryScope || "global"
  fields.workflowScope.value = rule.workflowScope || "reply"
  fields.theme.value = rule.theme || ""
  fields.missingInfoAction.value = rule.missingInfoAction || "cautious_reply"
  fields.priorityRank.value = String(rule.priorityRank || 100)
  fields.status.value = rule.status || "active"
  fields.content.value = rule.content || ""
  fields.notes.value = rule.notes || ""
  setFeedback(rulesEditorFeedback, `Édition de la règle : ${rule.title}`, "info")
}

function formatScope(rule) {
  return [
    rule.applicationScope || "mail_assistant",
    rule.mailboxScope || "global",
    rule.mailCategoryScope || "global",
    rule.workflowScope || "reply"
  ].join(" / ")
}

function createRuleCard(rule) {
  const article = document.createElement("article")
  article.className = "list-card"

  const title = document.createElement("h4")
  title.textContent = rule.title || "Règle sans titre"

  const meta = document.createElement("p")
  meta.className = "settings-help"
  meta.textContent = `${rule.status} | ${rule.ruleType} | ${formatScope(rule)} | priorité ${rule.priorityRank}`

  const content = document.createElement("p")
  content.textContent = rule.content || ""

  const actions = document.createElement("div")
  actions.className = "form-actions"

  const editBtn = document.createElement("button")
  editBtn.type = "button"
  editBtn.className = "action-button secondary-button"
  editBtn.textContent = "Modifier"
  editBtn.addEventListener("click", () => fillEditor(rule))

  const statusBtn = document.createElement("button")
  statusBtn.type = "button"
  statusBtn.className = "action-button"
  statusBtn.textContent = rule.status === "active" ? "Désactiver" : "Activer"
  statusBtn.addEventListener("click", async () => {
    await updateRuleStatus(rule.id, rule.status === "active" ? "inactive" : "active")
  })

  actions.append(editBtn, statusBtn)
  article.append(title, meta, content, actions)
  return article
}

function renderRules() {
  rulesListContainer.innerHTML = ""
  const query = normalizeSearch(searchInput?.value || "")
  const visibleRules = !query
    ? currentRules
    : currentRules.filter((rule) => {
        const haystack = normalizeSearch([
          rule.title || "",
          rule.theme || "",
          rule.content || "",
          rule.notes || ""
        ].join("\n"))
        return haystack.includes(query)
      })

  if (!visibleRules.length) {
    setFeedback(rulesListFeedback, "Aucune règle pour ce filtre.", "info")
    return
  }

  setFeedback(rulesListFeedback, `${visibleRules.length} règle(s) affichée(s).`, "success")
  visibleRules.forEach((rule) => {
    rulesListContainer.appendChild(createRuleCard(rule))
  })
}

async function loadRules() {
  const params = new URLSearchParams()
  if (statusFilter.value) params.set("status", statusFilter.value)
  if (workflowFilter.value) params.set("workflowScope", workflowFilter.value)
  if (typeFilter.value) params.set("ruleType", typeFilter.value)

  setFeedback(rulesListFeedback, "Chargement des règles...", "info")
  const response = await fetch(`/api/admin/mail-rules?${params.toString()}`, {
    cache: "no-store",
    credentials: "same-origin"
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Erreur de lecture des règles.")
  }

  currentRules = Array.isArray(result.rules) ? result.rules : []
  renderRules()
}

async function saveRule(event) {
  event.preventDefault()
  const rule = {
    title: fields.title.value.trim(),
    ruleType: fields.ruleType.value,
    applicationScope: fields.applicationScope.value.trim() || "mail_assistant",
    mailboxScope: fields.mailboxScope.value.trim() || "global",
    mailCategoryScope: fields.mailCategoryScope.value.trim() || "global",
    workflowScope: fields.workflowScope.value,
    theme: fields.theme.value.trim(),
    missingInfoAction: fields.missingInfoAction.value,
    priorityRank: Number(fields.priorityRank.value || 100),
    status: fields.status.value,
    content: fields.content.value.trim(),
    notes: fields.notes.value.trim()
  }

  if (!rule.title || !rule.content) {
    setFeedback(rulesEditorFeedback, "Le titre et le texte de la règle sont requis.", "error")
    return
  }

  setFeedback(rulesEditorFeedback, "Enregistrement en cours...", "info")
  const url = currentEditingRuleId ? "/api/admin/mail-rules/update" : "/api/admin/mail-rules"
  const payload = currentEditingRuleId
    ? { ruleId: currentEditingRuleId, updates: rule }
    : { rule }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify(payload)
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Erreur d’enregistrement.")
  }

  setFeedback(rulesEditorFeedback, "Règle enregistrée.", "success")
  resetEditor()
  await loadRules()
}

async function updateRuleStatus(ruleId, status) {
  const response = await fetch("/api/admin/mail-rules/status", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    credentials: "same-origin",
    body: JSON.stringify({ ruleId, status })
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || "Erreur de mise à jour du statut.")
  }
  await loadRules()
}

async function init() {
  try {
    const session = await loadSession()
    if (!session) {
      return
    }
    if (isAdminRole(session.role)) {
      await loadRules()
    }
    resetEditor()
  } catch (error) {
    setFeedback(rulesListFeedback, error.message || "Erreur d’initialisation.", "error")
    setFeedback(rulesEditorFeedback, error.message || "Erreur d’initialisation.", "error")
  }
}

rulesEditorForm?.addEventListener("submit", async (event) => {
  try {
    await saveRule(event)
  } catch (error) {
    setFeedback(rulesEditorFeedback, error.message || "Erreur d’enregistrement.", "error")
  }
})

rulesRefreshBtn?.addEventListener("click", async () => {
  try {
    await loadRules()
  } catch (error) {
    setFeedback(rulesListFeedback, error.message || "Erreur de chargement.", "error")
  }
})

ruleResetBtn?.addEventListener("click", () => {
  resetEditor()
})

statusFilter?.addEventListener("change", () => loadRules().catch((error) => setFeedback(rulesListFeedback, error.message, "error")))
workflowFilter?.addEventListener("change", () => loadRules().catch((error) => setFeedback(rulesListFeedback, error.message, "error")))
typeFilter?.addEventListener("change", () => loadRules().catch((error) => setFeedback(rulesListFeedback, error.message, "error")))
searchInput?.addEventListener("input", () => renderRules())

init()
