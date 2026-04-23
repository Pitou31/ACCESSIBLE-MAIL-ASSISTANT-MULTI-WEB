const SESSION_KEY = "mail-assistant-session"

function formatInteger(value = 0) {
  return new Intl.NumberFormat("fr-FR").format(Number(value || 0))
}

function formatDuration(durationMs = 0) {
  const totalSeconds = Math.max(0, Math.round(Number(durationMs || 0) / 1000))
  if (totalSeconds < 60) return `${totalSeconds} s`
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) return `${hours} h ${String(minutes).padStart(2, "0")}`
  return `${minutes} min ${String(seconds).padStart(2, "0")} s`
}

function formatPercent(numerator, denominator) {
  if (!denominator) return "0 %"
  return `${Math.round((Number(numerator || 0) / Number(denominator || 1)) * 100)} %`
}

function setText(id, value) {
  const element = document.getElementById(id)
  if (element) element.textContent = value
}

function getCurrentSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
  } catch (_) {
    return null
  }
}

async function syncSessionFromServer() {
  try {
    const response = await fetch('/api/account/session', {
      credentials: 'same-origin',
      cache: 'no-store'
    })
    const result = await response.json()
    if (!response.ok || !result.ok || result.accountActive !== 1 || !result.session) {
      return null
    }
    localStorage.setItem(SESSION_KEY, JSON.stringify(result.session))
    return result.session
  } catch (_) {
    return null
  }
}

function getCurrentUserLabel() {
  const session = getCurrentSession()
  const firstName = String(session?.firstName || "").trim()
  const lastName = String(session?.lastName || "").trim()
  const fullName = `${firstName} ${lastName}`.trim()
  if (fullName) return fullName
  const organizationName = String(session?.organizationName || "").trim()
  if (organizationName) return organizationName
  const email = String(session?.email || "").trim()
  if (email) return email
  return "Compte connecté"
}

function parseMetadata(event) {
  try {
    const raw = event?.metadata_json
    return raw ? JSON.parse(raw) : {}
  } catch (_) {
    return {}
  }
}

function toActionLabel(eventType = "") {
  const map = {
    summary_started: "Résumé",
    summary_succeeded: "Résumé",
    summary_failed: "Résumé",
    rephrase_started: "Reformulation",
    rephrase_succeeded: "Reformulation",
    rephrase_failed: "Reformulation",
    translation_started: "Traduction",
    translation_succeeded: "Traduction",
    translation_failed: "Traduction",
    draft_generation_started: "Création de brouillon",
    draft_generation_succeeded: "Création de brouillon",
    draft_generation_failed: "Création de brouillon",
    reply_generation_started: "Réponse générée",
    reply_generation_succeeded: "Réponse générée",
    reply_generation_failed: "Réponse générée"
  }
  return map[eventType] || eventType || "Action"
}

function toWorkflowLabel(workflow = "") {
  const map = {
    reply: "Réponse",
    creation: "Création",
    mail: "Mail"
  }
  return map[workflow] || workflow || "Général"
}

function toStatusBadge(status = "") {
  const normalized = String(status || "").toLowerCase()
  if (normalized === "succeeded") return { label: "Validée", className: "success" }
  if (normalized === "failed") return { label: "Erreur", className: "warning" }
  if (normalized === "started") return { label: "En cours", className: "admin" }
  return { label: status || "Inconnu", className: "user" }
}

function aggregateEvents(events, scope = "account") {
  const summary = {
    totalDurationMs: 0,
    processedCount: 0,
    successfulCount: 0,
    textActions: 0,
    byAction: new Map(),
    byModel: new Map(),
    byDay: new Map(),
    userRow: null,
    userRows: [],
    detailRows: [],
    scope
  }

  const succeededEvents = events.filter((event) => String(event.status) === "succeeded")
  const processableTypes = new Set([
    "summary_succeeded",
    "rephrase_succeeded",
    "translation_succeeded",
    "draft_generation_succeeded",
    "reply_generation_succeeded"
  ])

  const byAccount = new Map()

  succeededEvents.forEach((event) => {
    const eventType = String(event.event_type || "")
    const actionLabel = toActionLabel(eventType)
    const durationMs = Number(event.duration_ms || 0)
    const modelName = event.model_label || event.model_name || event.provider || "Modèle non renseigné"
    const eventDate = new Date(event.event_timestamp || event.created_at || Date.now())
    const dayLabel = eventDate.toLocaleDateString("fr-FR", { weekday: "short" })
    const metadata = parseMetadata(event)
    const accountLabel = String(event.account_label || getCurrentUserLabel()).trim() || getCurrentUserLabel()

    if (processableTypes.has(eventType)) {
      summary.processedCount += 1
      summary.totalDurationMs += durationMs
      summary.successfulCount += 1
    }

    if (["summary_succeeded", "rephrase_succeeded", "translation_succeeded"].includes(eventType)) {
      summary.textActions += 1
    }

    const actionEntry = summary.byAction.get(actionLabel) || { count: 0, durationMs: 0, successCount: 0 }
    actionEntry.count += 1
    actionEntry.durationMs += durationMs
    actionEntry.successCount += 1
    summary.byAction.set(actionLabel, actionEntry)

    const modelEntry = summary.byModel.get(modelName) || { count: 0, durationMs: 0, fallbackCount: 0 }
    modelEntry.count += 1
    modelEntry.durationMs += durationMs
    if (metadata.fallback_used || metadata.fallback === true) {
      modelEntry.fallbackCount += 1
    }
    summary.byModel.set(modelName, modelEntry)

    const dayEntry = summary.byDay.get(dayLabel) || { total: 0 }
    dayEntry.total += 1
    summary.byDay.set(dayLabel, dayEntry)

    const accountEntry = byAccount.get(accountLabel) || { label: accountLabel, totalDurationMs: 0, count: 0 }
    accountEntry.totalDurationMs += durationMs
    accountEntry.count += processableTypes.has(eventType) ? 1 : 0
    byAccount.set(accountLabel, accountEntry)
  })

  events.slice(0, 8).forEach((event) => {
    summary.detailRows.push({
      timestamp: event.event_timestamp || event.created_at,
      user: String(event.account_label || getCurrentUserLabel()).trim() || getCurrentUserLabel(),
      workflow: toWorkflowLabel(event.workflow),
      action: toActionLabel(event.event_type),
      model: event.model_label || event.model_name || event.provider || "-",
      durationMs: Number(event.duration_ms || 0),
      status: toStatusBadge(event.status)
    })
  })

  summary.userRows = Array.from(byAccount.values())
    .map((row) => ({
      ...row,
      averageDurationMs: row.count ? Math.round(row.totalDurationMs / row.count) : 0
    }))
    .sort((a, b) => b.totalDurationMs - a.totalDurationMs)

  summary.userRow = scope === "global"
    ? null
    : {
        label: getCurrentUserLabel(),
        totalDurationMs: summary.totalDurationMs,
        count: summary.processedCount,
        averageDurationMs: summary.processedCount ? Math.round(summary.totalDurationMs / summary.processedCount) : 0
      }

  return summary
}

function renderWeeklyChart(summary) {
  const container = document.getElementById("statsWeeklyChart")
  if (!container) return
  const orderedDays = ["lun.", "mar.", "mer.", "jeu.", "ven.", "sam.", "dim."]
  const values = orderedDays.map((day) => summary.byDay.get(day)?.total || 0)
  const maxValue = Math.max(1, ...values)
  container.innerHTML = orderedDays.map((day, index) => {
    const value = values[index]
    const height = value > 0 ? Math.max(12, Math.round((value / maxValue) * 82)) : 0
    return `
      <div class="bar-group">
        <div class="bar-value">${value}</div>
        <div class="bar primary" style="height: ${height}%"></div>
        <div class="bar secondary" style="height: ${value > 0 ? Math.max(8, Math.round(height * 0.55)) : 0}%"></div>
        <div class="bar-label">${day}</div>
      </div>
    `
  }).join("")
}

function renderActivityChart(summary) {
  const container = document.getElementById("statsActivityChart")
  if (!container) return

  const segments = [
    { label: "Résumé", count: summary.byAction.get("Résumé")?.count || 0 },
    { label: "Reformulation", count: summary.byAction.get("Reformulation")?.count || 0 },
    { label: "Traduction", count: summary.byAction.get("Traduction")?.count || 0 },
    {
      label: "Autres",
      count: Math.max(
        0,
        Array.from(summary.byAction.entries())
          .filter(([label]) => !["Résumé", "Reformulation", "Traduction"].includes(label))
          .reduce((total, [, values]) => total + Number(values?.count || 0), 0)
      )
    }
  ]

  const total = segments.reduce((sum, segment) => sum + segment.count, 0)
  const segmentsWithPercent = segments.map((segment) => ({
    ...segment,
    percent: total > 0 ? Math.round((segment.count / total) * 100) : 0
  }))
  const dominantSegment = [...segmentsWithPercent].sort((a, b) => b.count - a.count)[0] || { label: 'Activité dominante', percent: 0 }
  let cursor = 0
  const colors = ["var(--accent)", "var(--accent-2)", "var(--success)", "var(--warning)"]
  const gradientParts = segmentsWithPercent.map((segment, index) => {
    const value = total > 0 ? (segment.count / total) * 100 : 25
    const start = cursor
    const end = index === segmentsWithPercent.length - 1 ? 100 : cursor + value
    cursor = end
    return `${colors[index]} ${start}% ${end}%`
  })

  container.innerHTML = `
    <div class="donut" style="background: conic-gradient(${gradientParts.join(", ")});">
      <div class="donut-center">
        <strong>${dominantSegment.percent} %</strong>
        <span>${dominantSegment.label}</span>
      </div>
    </div>
    <div class="legend">
      ${segmentsWithPercent.map((segment) => `<span>${segment.label} · ${segment.percent} % · ${formatInteger(segment.count)}</span>`).join("")}
    </div>
  `
}

function renderFixedCategory(summary, rank, actionLabel) {
  const current = summary.byAction.get(actionLabel) || { count: 0, durationMs: 0, successCount: 0 }
  setText(`statsCategory${rank}Title`, actionLabel)
  setText(`statsCategory${rank}Count`, formatInteger(current.count || 0))
  setText(`statsCategory${rank}Duration`, formatDuration(current.durationMs || 0))
  const avg = current.count ? Math.round(current.durationMs / current.count) : 0
  setText(`statsCategory${rank}Average`, formatDuration(avg))
  setText(`statsCategory${rank}Success`, formatPercent(current.successCount || 0, current.count || 0))
}

function renderUserTable(summary) {
  const tbody = document.getElementById("statsUserTableBody")
  if (!tbody) return
  const rows = summary.scope === "global"
    ? summary.userRows
    : (summary.userRow ? [summary.userRow] : [])

  tbody.innerHTML = rows.length ? rows.map((row) => `
    <tr>
      <td>${row.label}</td>
      <td>${formatDuration(row.totalDurationMs)}</td>
      <td>${formatInteger(row.count)}</td>
      <td>${formatDuration(row.averageDurationMs)}</td>
      <td><span class="status ${summary.scope === "global" ? "admin" : "user"}">${summary.scope === "global" ? "Administrateur" : "Utilisateur"}</span></td>
    </tr>
  `).join("") : '<tr><td colspan="5">Aucune donnée utilisateur à afficher.</td></tr>'
}

function renderModelTable(summary) {
  const tbody = document.getElementById("statsModelTableBody")
  if (!tbody) return
  const rows = Array.from(summary.byModel.entries()).sort((a, b) => b[1].count - a[1].count)
  tbody.innerHTML = rows.length ? rows.map(([model, values]) => {
    const average = values.count ? Math.round(values.durationMs / values.count) : 0
    const fallbackRate = formatPercent(values.fallbackCount, values.count)
    const badgeClass = values.fallbackCount > 0 ? "warning" : "success"
    return `
      <tr>
        <td>${model}</td>
        <td>${formatDuration(average)}</td>
        <td><span class="status ${badgeClass}">${fallbackRate}</span></td>
      </tr>
    `
  }).join("") : '<tr><td colspan="3">Aucun modèle encore mesuré.</td></tr>'
}

function renderDetailTable(summary) {
  const tbody = document.getElementById("statsDetailTableBody")
  if (!tbody) return
  tbody.innerHTML = summary.detailRows.length ? summary.detailRows.map((row) => `
    <tr>
      <td>${new Date(row.timestamp).toLocaleString("fr-FR")}</td>
      <td>${row.user}</td>
      <td>${row.workflow}</td>
      <td>${row.action}</td>
      <td>${row.model}</td>
      <td>${formatDuration(row.durationMs)}</td>
      <td><span class="status ${row.status.className}">${row.status.label}</span></td>
    </tr>
  `).join("") : '<tr><td colspan="7">Aucun événement enregistré pour le moment.</td></tr>'
}

function getSelectedScope() {
  const session = getCurrentSession()
  const isAdmin = String(session?.role || "").trim().toLowerCase() === "admin"
  const select = document.getElementById('statsScopeSelect')
  const requested = String(select?.value || 'account').trim().toLowerCase()
  return isAdmin && requested === 'global' ? 'global' : 'account'
}


function getSelectedModel() {
  const select = document.getElementById('statsModelSelect')
  return String(select?.value || '').trim()
}

function syncScopeControl() {
  const session = getCurrentSession()
  const isAdmin = String(session?.role || "").trim().toLowerCase() === "admin"
  const select = document.getElementById('statsScopeSelect')
  if (!select) return
  const globalOption = Array.from(select.options).find((option) => option.value === 'global')
  if (globalOption) {
    globalOption.hidden = !isAdmin
    globalOption.disabled = !isAdmin
  }
  if (!isAdmin) {
    select.value = 'account'
  }
}


function syncModelOptions(events = []) {
  const select = document.getElementById('statsModelSelect')
  if (!select) return
  const currentValue = String(select.value || '').trim()
  const models = [...new Set(events.map((event) => String(event.model_label || event.model_name || event.provider || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'))
  select.innerHTML = ['<option value="">Tous les modèles</option>', ...models.map((model) => `<option value="${model.replace(/"/g, '&quot;')}">${model}</option>`)].join('')
  if (currentValue && models.includes(currentValue)) {
    select.value = currentValue
  }
}

async function loadAvailableModels(scope = 'account') {
  const response = await fetch(`/api/stats/events?limit=500&scope=${encodeURIComponent(scope)}`, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Impossible de charger la liste des modèles.')
  }
  return Array.isArray(result.events) ? result.events : []
}

async function loadStatsEvents(scope = 'account', provider = '') {
  const params = new URLSearchParams({ limit: '500', scope })
  if (provider) {
    params.set('provider', provider)
  }
  const response = await fetch(`/api/stats/events?${params.toString()}`, { credentials: 'same-origin' })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Impossible de charger les statistiques.')
  }
  return {
    scope: String(result.scope || scope || 'account').trim().toLowerCase(),
    events: Array.isArray(result.events) ? result.events : []
  }
}

async function resetStatsEvents() {
  const response = await fetch('/api/stats/reset', {
    method: 'POST',
    credentials: 'same-origin'
  })
  const result = await response.json()
  if (!response.ok || !result.ok) {
    throw new Error(result.error || 'Impossible de réinitialiser les statistiques.')
  }
  return result
}

function bindStatsActions() {
  const resetButton = document.getElementById('statsResetButton')
  const refreshButton = document.getElementById('statsRefreshButton')
  const scopeSelect = document.getElementById('statsScopeSelect')
  const modelSelect = document.getElementById('statsModelSelect')

  refreshButton?.addEventListener('click', () => {
    initializeStatsPage()
  })

  scopeSelect?.addEventListener('change', () => {
    initializeStatsPage()
  })

  modelSelect?.addEventListener('change', () => {
    initializeStatsPage()
  })

  if (!resetButton) return

  resetButton.addEventListener('click', async () => {
    const confirmed = window.confirm(`Voulez-vous vraiment remettre à zéro les statistiques de ${getCurrentUserLabel()} ?`)
    if (!confirmed) return

    try {
      await resetStatsEvents()
      window.location.reload()
    } catch (error) {
      window.alert(error.message || 'Impossible de réinitialiser les statistiques.')
    }
  })
}

async function initializeStatsPage() {
  try {
    await syncSessionFromServer()
    syncScopeControl()
    const scope = getSelectedScope()
    const selectedModel = getSelectedModel()
    const [availableModelEvents, payload] = await Promise.all([
      loadAvailableModels(scope),
      loadStatsEvents(scope, selectedModel)
    ])
    syncModelOptions(availableModelEvents)
    if (selectedModel) {
      const modelSelect = document.getElementById('statsModelSelect')
      if (modelSelect) {
        modelSelect.value = selectedModel
      }
    }
    const summary = aggregateEvents(payload.events, payload.scope)
    setText('statsTotalDuration', formatDuration(summary.totalDurationMs))
    setText('statsTotalProcessed', formatInteger(summary.processedCount))
    const average = summary.processedCount ? Math.round(summary.totalDurationMs / summary.processedCount) : 0
    setText('statsAverageDuration', formatDuration(average))
    setText('statsSuccessRate', formatPercent(summary.successfulCount, summary.processedCount || summary.successfulCount))
    renderWeeklyChart(summary)
    renderActivityChart(summary)
    renderFixedCategory(summary, 1, 'Résumé')
    renderFixedCategory(summary, 2, 'Reformulation')
    renderFixedCategory(summary, 3, 'Traduction')
    renderUserTable(summary)
    renderModelTable(summary)
    renderDetailTable(summary)
  } catch (error) {
    console.error(error)
  }
}

bindStatsActions()
initializeStatsPage()
