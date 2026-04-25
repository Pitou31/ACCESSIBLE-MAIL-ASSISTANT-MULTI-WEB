(() => {
  const QUICK_LINKS = [
    ["Initialiser le super admin", "/frontend/admin-bootstrap.html"],
    ["Demande administrateur", "/frontend/admin-db.html"],
    ["Connexion administrateur", "/frontend/admin-login.html"],
    ["Espace administrateur", "/frontend/admin-private.html"],
    ["Demande utilisateur", "/frontend/account-request.html"],
    ["Connexion utilisateur", "/frontend/account.html"],
    ["Connexion boîte mail", "/frontend/mailbox-connect.html"],
    ["Application mail", "/frontend/mail.html"],
    ["Test audio", "/frontend/audio-test.html"]
  ]

  function $(id) {
    return document.getElementById(id)
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;")
  }

  function setFeedback(message, tone = "info") {
    const element = $("testToolsFeedback")
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  function formatDate(value) {
    if (!value) return "Non renseigné"
    return new Date(value).toLocaleString("fr-FR")
  }

  function countBy(items, key) {
    return items.reduce((accumulator, item) => {
      const value = String(typeof key === "function" ? key(item) : item[key] || "non_renseigne")
      accumulator[value] = (accumulator[value] || 0) + 1
      return accumulator
    }, {})
  }

  function renderStats({ requests, accounts, mailboxes }) {
    const pendingRequests = requests.filter((request) => request.status === "pending").length
    const activeAccounts = accounts.filter((account) => account.status === "active").length
    const multiMailboxes = mailboxes.filter((mailbox) => Number(mailbox.sharing_enabled) === 1).length

    $("testToolsStats").innerHTML = [
      `<article class="mini-stat"><strong>${requests.length}</strong><span>Demandes visibles dont ${pendingRequests} en attente.</span></article>`,
      `<article class="mini-stat"><strong>${accounts.length}</strong><span>Comptes visibles dont ${activeAccounts} actifs.</span></article>`,
      `<article class="mini-stat"><strong>${mailboxes.length}</strong><span>Boîtes mail connues dont ${multiMailboxes} en mode multi-utilisateur.</span></article>`
    ].join("")
  }

  function renderCountCards(containerId, groups, label) {
    const entries = Object.entries(groups).sort(([left], [right]) => left.localeCompare(right))
    const container = $(containerId)
    if (!container) return
    container.innerHTML = entries.length > 0
      ? entries.map(([name, count]) => `
        <article class="account-summary-card admin-record-card">
          <p class="account-summary-title">${escapeHtml(name)}</p>
          <p class="settings-help"><strong>${escapeHtml(label)} :</strong> ${count}</p>
        </article>
      `).join("")
      : '<div class="account-summary-card"><p class="settings-help">Aucune donnée.</p></div>'
  }

  function renderMailboxes(mailboxes) {
    const container = $("testToolsMailboxes")
    if (!container) return
    container.innerHTML = mailboxes.length > 0
      ? mailboxes.slice(0, 20).map((mailbox) => `
        <article class="account-summary-card admin-record-card">
          <p class="account-summary-title">${escapeHtml(mailbox.email_address)}</p>
          <p class="settings-help"><strong>Fournisseur :</strong> ${escapeHtml(mailbox.provider || "Non renseigné")}</p>
          <p class="settings-help"><strong>Mode :</strong> ${Number(mailbox.sharing_enabled) === 1 ? "multi-utilisateur" : "mono-utilisateur"}</p>
          <p class="settings-help"><strong>Connexions :</strong> ${Number(mailbox.connection_count || 0)} | <strong>Membres :</strong> ${Number(mailbox.member_count || 0)}</p>
          <p class="settings-help"><strong>Propriétaire :</strong> ${escapeHtml(mailbox.owner_email || "Non renseigné")}</p>
        </article>
      `).join("")
      : '<div class="account-summary-card"><p class="settings-help">Aucune boîte mail connue.</p></div>'
  }

  function renderSecurity(events, forbidden = false) {
    const container = $("testToolsSecurity")
    if (!container) return
    if (forbidden) {
      container.innerHTML = '<div class="account-summary-card"><p class="settings-help">Journal réservé au super administrateur.</p></div>'
      return
    }

    container.innerHTML = events.length > 0
      ? events.slice(0, 20).map((event) => `
        <article class="account-summary-card admin-record-card">
          <p class="account-summary-title">${escapeHtml(event.event_type)}</p>
          <p class="settings-help"><strong>Statut :</strong> ${escapeHtml(event.status)} | <strong>Sévérité :</strong> ${escapeHtml(event.severity)}</p>
          <p class="settings-help"><strong>Route :</strong> ${escapeHtml(event.route)}</p>
          <p class="settings-help"><strong>Email :</strong> ${escapeHtml(event.email || "Non renseigné")}</p>
          <p class="settings-help"><strong>Date :</strong> ${formatDate(event.created_at)}</p>
        </article>
      `).join("")
      : '<div class="account-summary-card"><p class="settings-help">Aucun événement sécurité enregistré pour le moment.</p></div>'
  }

  function renderLinks() {
    const container = $("testToolsLinks")
    if (!container) return
    container.innerHTML = QUICK_LINKS.map(([label, href]) => `
      <article class="account-summary-card admin-record-card">
        <p class="account-summary-title">${escapeHtml(label)}</p>
        <p class="settings-help"><a class="settings-link" href="${escapeHtml(href)}">${escapeHtml(href)}</a></p>
      </article>
    `).join("")
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin"
    })
    const result = await response.json()
    return { response, result }
  }

  async function requireAdminSession() {
    const { response, result } = await fetchJson("/api/account/session")
    if (!response.ok || !result.ok || !result.accountActive || !result.session) {
      window.location.href = "/frontend/admin-login.html"
      return null
    }

    if (!["admin", "super_admin"].includes(result.session.role)) {
      window.location.href = "/frontend/admin-login.html"
      return null
    }

    return result.session
  }

  async function refreshTools() {
    setFeedback("Chargement des données de test...", "info")
    try {
      const [requestsResponse, accountsResponse, mailboxesResponse, securityResponse] = await Promise.all([
        fetchJson("/api/admin/requests"),
        fetchJson("/api/admin/accounts"),
        fetchJson("/api/admin/mailboxes"),
        fetchJson("/api/admin/security-events?limit=50")
      ])

      const failures = [requestsResponse, accountsResponse, mailboxesResponse]
        .filter(({ response, result }) => !response.ok || !result.ok)
      if (failures.length > 0) {
        throw new Error(failures[0].result.error || "Erreur de chargement des données de test.")
      }

      const requests = requestsResponse.result.requests || []
      const accounts = accountsResponse.result.accounts || []
      const mailboxes = mailboxesResponse.result.mailboxes || []
      const securityForbidden = securityResponse.response.status === 403
      const securityEvents = securityResponse.result.events || []

      renderStats({ requests, accounts, mailboxes })
      renderCountCards("testToolsRequests", countBy(requests, (request) => `${request.account_type || "type inconnu"} / ${request.status || "statut inconnu"}`), "Demandes")
      renderCountCards("testToolsAccounts", countBy(accounts, (account) => `${account.role || "role inconnu"} / ${account.status || "statut inconnu"}`), "Comptes")
      renderMailboxes(mailboxes)
      renderSecurity(securityEvents, securityForbidden)
      renderLinks()
      setFeedback(`Données chargées le ${formatDate(new Date().toISOString())}.`, "success")
    } catch (error) {
      setFeedback(error.message || "Erreur de chargement des outils de test.", "error")
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("testToolsRefreshButton")?.addEventListener("click", refreshTools)
    requireAdminSession().then((session) => {
      if (!session) return
      refreshTools()
    }).catch(() => {
      window.location.href = "/frontend/admin-login.html"
    })
  })
})()
