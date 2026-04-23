(() => {
  const SESSION_KEY = "mail-assistant-session"

  function $(id) {
    return document.getElementById(id)
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    } catch (_) {
      return null
    }
  }

  function setText(id, value) {
    const element = $(id)
    if (element) {
      element.textContent = value
    }
  }

  function formatDate(value) {
    if (!value) return "Non renseigné"
    return new Date(value).toLocaleString("fr-FR")
  }

  function getCurrencySymbol(currency = "EUR") {
    const normalized = String(currency || "EUR").trim().toUpperCase()
    if (normalized === "USD") return "$"
    return "€"
  }

  function formatMoney(amount = 0, currency = "EUR") {
    const numeric = Number(amount || 0)
    const decimals = numeric > 0 && numeric < 0.01 ? 4 : 2
    const symbol = getCurrencySymbol(currency)
    return `${numeric.toFixed(decimals).replace(".", ",")} ${symbol}`
  }

  function formatInteger(value = 0) {
    return new Intl.NumberFormat("fr-FR").format(Number(value || 0))
  }

  function formatQuantity(value = 0, unit = "") {
    const normalizedUnit = String(unit || "").trim()
    if (!normalizedUnit) {
      return formatInteger(value)
    }

    if (normalizedUnit === "seconds") {
      return `${formatInteger(value)} s`
    }

    if (normalizedUnit === "requests") {
      return `${formatInteger(value)} requêtes`
    }

    return `${formatInteger(value)} ${normalizedUnit}`
  }

  function getIdentityLabel(session) {
    const firstName = String(session?.firstName || "").trim()
    const lastName = String(session?.lastName || "").trim()
    const fullName = `${firstName} ${lastName}`.trim()
    if (fullName) return fullName

    const organizationName = String(session?.organizationName || "").trim()
    if (organizationName) return organizationName

    return String(session?.email || "Compte connecté").trim() || "Compte connecté"
  }

  function isAdminSession(session) {
    return String(session?.role || "").trim().toLowerCase() === "admin"
  }

  function getStatusBadge(status = "") {
    const normalized = String(status || "").trim().toLowerCase()
    if (normalized === "active" || normalized === "connected" || normalized === "success") {
      return { label: "Actif", className: "success" }
    }
    if (normalized === "error" || normalized === "invalid" || normalized === "failed") {
      return { label: "Erreur", className: "warning" }
    }
    if (normalized === "inactive") {
      return { label: "Inactif", className: "user" }
    }
    return { label: status || "En attente", className: "admin" }
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      credentials: "same-origin",
      cache: "no-store"
    })
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de chargement.")
    }
    return result
  }

  async function syncSessionFromServer() {
    try {
      const result = await fetchJson("/api/account/session")
      if (result.accountActive === 1 && result.session) {
        localStorage.setItem(SESSION_KEY, JSON.stringify(result.session))
        return result.session
      }
    } catch (_) {
      // La sidebar gere deja la redirection si la session est absente.
    }
    return getSession()
  }

  function renderScope(scope = "account") {
    const isGlobal = scope === "global"
    setText("billingScopeTitle", isGlobal ? "Vision consolidée de la consommation" : "Vision utilisateur de la consommation")
    setText(
      "billingScopeNote",
      isGlobal
        ? "Vue administrateur : agrégation du mois en cours sur tous les comptes actifs, avec consolidation des fournisseurs, boîtes mail et événements de consommation."
        : "Première version : suivi du mois en cours, fournisseurs actifs, coûts estimés disponibles, connexions boîtes mail et événements récents de consommation."
    )
  }

  function renderIdentity(session, scope = "account") {
    const identity = getIdentityLabel(session)
    const role = String(session?.role || "").trim() || "utilisateur"
    const accountType = String(session?.accountType || "").trim() || "individuel"
    const email = String(session?.email || "").trim()
    const scopeLabel = scope === "global" ? "Vue consolidée administrateur" : "Vue individuelle"

    setText("billingIdentity", identity)
    setText(
      "billingSessionDetails",
      `${email || "Email non renseigné"} | Type de compte : ${accountType} | Rôle : ${role} | ${scopeLabel}`
    )
  }

  function renderKpis(providers = [], usageSummary = {}, mailboxConnections = [], usageEvents = []) {
    const activeProviders = providers.filter((provider) => provider.isActive !== false && provider.status !== "inactive")
    const activeMailboxes = mailboxConnections.filter((connection) => String(connection.connection_status || "").toLowerCase() === "connected")

    setText(
      "billingTotalCost",
      formatMoney(usageSummary.totalEstimatedCostAmount || 0, usageSummary.currency || "EUR")
    )
    setText("billingUsageEventsCount", formatInteger(usageEvents.length))
    setText("billingActiveProvidersCount", formatInteger(activeProviders.length))
    setText("billingMailboxConnectionsCount", formatInteger(activeMailboxes.length))
  }

  function renderProvidersList(providers = [], scope = "account") {
    const target = $("billingProvidersList")
    if (!target) return

    if (!providers.length) {
      target.innerHTML = '<p class="billing-empty">Aucun fournisseur chargé pour le moment.</p>'
      return
    }

    target.innerHTML = providers.map((provider) => {
      const badge = getStatusBadge(provider.status)
      const maskedKey = provider.maskedApiKey ? `Clé : ${provider.maskedApiKey}` : "Clé masquée"
      const scopeLine = scope === "global" ? ` | Compte : ${provider.accountLabel || "Compte"}` : ""
      const costLine = provider.eventsCount > 0
        ? ` | Coût estimé ce mois : ${formatMoney(provider.estimatedCostAmount, provider.summaryCurrency || provider.currency)}`
        : ""
      return `
        <article class="billing-list-item">
          <div class="billing-list-head">
            <div class="billing-list-title">${provider.displayName || provider.providerLabel || provider.providerType}</div>
            <span class="status ${badge.className}">${badge.label}</span>
          </div>
          <div class="billing-list-meta">
            ${maskedKey}${scopeLine} | Facturation : ${provider.billingMode || "personal"}${provider.isDefault ? " | Par défaut" : ""}${costLine}
          </div>
        </article>
      `
    }).join("")
  }

  function renderMailboxList(mailboxConnections = [], scope = "account") {
    const target = $("billingMailboxList")
    if (!target) return

    if (!mailboxConnections.length) {
      target.innerHTML = '<p class="billing-empty">Aucune connexion boîte mail enregistrée pour le moment.</p>'
      return
    }

    target.innerHTML = mailboxConnections.map((connection) => {
      const badge = getStatusBadge(connection.connection_status)
      return `
        <article class="billing-list-item">
          <div class="billing-list-head">
            <div class="billing-list-title">${connection.mailbox_email}</div>
            <span class="status ${badge.className}">${badge.label}</span>
          </div>
          <div class="billing-list-meta">
            ${connection.provider_label || connection.provider_id || "Fournisseur non renseigné"}${scope === "global" ? ` | Compte : ${connection.accountLabel || "Compte"}` : ""} | Authentification : ${connection.auth_type || "oauth2"} | Dernière mise à jour : ${formatDate(connection.updated_at)}
          </div>
        </article>
      `
    }).join("")
  }

  function renderProvidersTable(providers = [], scope = "account") {
    const tbody = $("billingProvidersTableBody")
    if (!tbody) return

    if (!providers.length) {
      tbody.innerHTML = '<tr><td colspan="6" class="billing-empty">Aucun fournisseur API à afficher.</td></tr>'
      return
    }

    tbody.innerHTML = providers.map((provider) => {
      const consumed = Number(provider.estimatedCostCents || 0)
      const budget = Number(provider.monthlyBudgetCents || 0)
      const remaining = budget > 0 ? Math.max(0, budget - consumed) : 0
      const badge = getStatusBadge(provider.status)
      const remainingClass = budget > 0 && consumed > budget ? "billing-warning" : ""
      const providerLabel = scope === "global"
        ? `${provider.displayName || provider.providerLabel || provider.providerType} · ${provider.accountLabel || "Compte"}`
        : (provider.displayName || provider.providerLabel || provider.providerType)

      return `
        <tr>
          <td>${providerLabel}</td>
          <td><span class="status ${badge.className}">${badge.label}</span></td>
          <td>${provider.billingMode || "personal"}</td>
          <td>${budget > 0 ? formatMoney(budget / 100, provider.currency || "EUR") : "Non défini"}</td>
          <td>${formatMoney(provider.estimatedCostAmount || 0, provider.summaryCurrency || provider.currency || "EUR")}</td>
          <td class="${remainingClass}">${budget > 0 ? formatMoney(remaining / 100, provider.currency || "EUR") : "Non applicable"}</td>
        </tr>
      `
    }).join("")
  }

  function renderUsageEventsTable(events = [], scope = "account") {
    const tbody = $("billingUsageEventsTableBody")
    if (!tbody) return

    if (!events.length) {
      tbody.innerHTML = '<tr><td colspan="7" class="billing-empty">Aucun événement de consommation enregistré.</td></tr>'
      return
    }

    tbody.innerHTML = events.map((event) => {
      const badge = getStatusBadge(event.status)
      const providerLabel = scope === "global"
        ? `${event.providerType || "-"} · ${event.accountLabel || "Compte"}`
        : (event.providerType || "-")
      return `
        <tr>
          <td>${formatDate(event.createdAt)}</td>
          <td>${providerLabel}</td>
          <td>${event.featureType || "-"}</td>
          <td>${event.requestMode || "-"}</td>
          <td>${formatQuantity(event.quantity, event.quantityUnit)}</td>
          <td>${formatMoney(event.estimatedCostAmount || 0, event.currency || "EUR")}</td>
          <td><span class="status ${badge.className}">${badge.label}</span></td>
        </tr>
      `
    }).join("")
  }

  function configureScopeSelect(session) {
    const select = $("billingScopeSelect")
    if (!select) return "account"

    const isAdmin = isAdminSession(session)
    const globalOption = Array.from(select.options).find((option) => option.value === "global")
    if (globalOption) {
      globalOption.hidden = !isAdmin
      globalOption.disabled = !isAdmin
    }

    if (!isAdmin && select.value === "global") {
      select.value = "account"
    }

    return isAdmin && select.value === "global" ? "global" : "account"
  }

  async function loadBillingPage() {
    try {
      const session = await syncSessionFromServer()
      const requestedScope = configureScopeSelect(session)
      const dashboardResult = await fetchJson(`/api/account/billing-dashboard?period=this_month&limit=200&scope=${encodeURIComponent(requestedScope)}`)
      const scope = String(dashboardResult.scope || requestedScope || "account").trim().toLowerCase()
      const providers = Array.isArray(dashboardResult.providers) ? dashboardResult.providers : []
      const usageSummary = dashboardResult.usageSummary || {}
      const usageEvents = Array.isArray(dashboardResult.usageEvents) ? dashboardResult.usageEvents : []
      const mailboxConnections = Array.isArray(dashboardResult.mailboxConnections) ? dashboardResult.mailboxConnections : []

      renderScope(scope)
      renderIdentity(session, scope)
      renderKpis(providers, usageSummary, mailboxConnections, usageEvents)
      renderProvidersList(providers, scope)
      renderMailboxList(mailboxConnections, scope)
      renderProvidersTable(providers, scope)
      renderUsageEventsTable(usageEvents, scope)
    } catch (error) {
      console.error(error)
      setText("billingIdentity", "Impossible de charger la comptabilité.")
      setText("billingSessionDetails", error.message || "Erreur de chargement.")
    }
  }

  $("billingScopeSelect")?.addEventListener("change", () => {
    loadBillingPage()
  })

  $("billingRefreshButton")?.addEventListener("click", () => {
    loadBillingPage()
  })

  loadBillingPage()
})()
