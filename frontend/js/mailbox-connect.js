(() => {
  const SESSION_KEY = "mail-assistant-session"

  function $(id) {
    return document.getElementById(id)
  }

  function setFeedback(message, tone = "info") {
    const element = $("mailboxConnectFeedback")
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  function getStoredSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    } catch (_) {
      return null
    }
  }

  function maskEmail(email = "") {
    const value = String(email || "").trim()
    const [localPart, domain] = value.split("@")
    if (!localPart || !domain) return value
    const maskedLocal = localPart.length <= 2
      ? `${localPart[0] || "*"}*`
      : `${localPart[0]}${"*".repeat(Math.max(localPart.length - 2, 1))}${localPart[localPart.length - 1]}`
    return `${maskedLocal}@${domain}`
  }

  function formatDate(value) {
    if (!value) return "Non renseignée"
    return new Date(value).toLocaleString("fr-FR")
  }

  function buildSessionLabel(session) {
    if (!session) return "Connexion utilisateur requise."
    const fullName = `${session.firstName || ""} ${session.lastName || ""}`.trim()
    const roleLabel = session.role === "super_admin" ? "super administrateur" : session.role === "admin" ? "administrateur" : "utilisateur"
    return `${fullName || maskEmail(session.email)} (${roleLabel})`
  }

  function renderAccountSummary(session) {
    const target = $("mailboxAccountSummary")
    if (!target) return
    if (!session?.email) {
      target.textContent = "Connectez-vous d'abord sur la page Compte avant de relier une boîte mail."
      return
    }
    target.textContent = `Session active : ${buildSessionLabel(session)}. Compte : ${maskEmail(session.email)}.`
  }

  function renderConnections(connections = []) {
    const target = $("mailboxConnectionsUserList")
    if (!target) return
    if (!connections.length) {
      target.innerHTML = `
        <article class="account-summary-card">
          <p class="settings-help">Aucune connexion enregistrée.</p>
        </article>
      `
      return
    }

    target.innerHTML = connections.map((connection) => `
      <article class="account-summary-card">
        <p class="account-summary-title">${connection.mailbox_email}</p>
        <p class="settings-help"><strong>Fournisseur :</strong> ${connection.provider_label || connection.provider_id || "Gmail"}</p>
        <p class="settings-help"><strong>État :</strong> ${connection.connection_status || "inconnu"}</p>
        <p class="settings-help"><strong>Dernière mise à jour :</strong> ${formatDate(connection.updated_at)}</p>
        <div class="mail-actions">
          <button class="action-button send-button" type="button" data-mailbox-reconnect="${connection.mailbox_email}">Reconnecter</button>
          <button class="action-button" type="button" data-mailbox-disconnect="${connection.id}" data-mailbox-email="${connection.mailbox_email}">Déconnecter cette boîte</button>
        </div>
      </article>
    `).join("")
  }

  async function fetchSession() {
    const response = await fetch("/api/account/session")
    const result = await response.json()
    if (!response.ok || !result.ok || !result.session) {
      return null
    }

    localStorage.setItem(SESSION_KEY, JSON.stringify(result.session))
    return result.session
  }

  async function loadConnections() {
    const response = await fetch("/api/mailbox/connections")
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Impossible de lire les connexions boîte mail.")
    }

    renderConnections(Array.isArray(result.connections) ? result.connections : [])

    const defaultConnection = Array.isArray(result.connections)
      ? result.connections.find((connection) => Number(connection.is_default) === 1) || result.connections[0]
      : null

    if (defaultConnection) {
      $("mailboxEmailInput").value = defaultConnection.mailbox_email || ""
      setFeedback(`Boîte déjà connectée : ${defaultConnection.mailbox_email}.`, "success")
    }

    return result
  }

  async function connectMailbox() {
    const email = $("mailboxEmailInput")?.value?.trim().toLowerCase() || ""
    if (!email) {
      setFeedback("Renseignez d'abord l'adresse Gmail à connecter.", "error")
      return
    }

    setFeedback("Préparation de la connexion Gmail...", "info")

    const response = await fetch("/api/mailbox/connect/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Impossible de démarrer la connexion Gmail.")
    }

    if (result.reusedExisting) {
      await loadConnections()
      setFeedback(`Boîte déjà connectée : ${result.connection?.mailbox_email || email}.`, "success")
      return
    }

    if (!result.redirectUrl) {
      throw new Error("URL de redirection Gmail manquante.")
    }

    window.location.href = result.redirectUrl
  }

  async function disconnectMailbox(connectionId, mailboxEmail) {
    const response = await fetch("/api/mailbox/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId })
    })
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Impossible de déconnecter cette boîte mail.")
    }

    setFeedback(`Connexion supprimée pour ${mailboxEmail || result.connection?.mailbox_email || "la boîte mail"}.`, "success")
    await loadConnections()
  }

  function applyQueryState() {
    const params = new URLSearchParams(window.location.search)
    const mailboxState = params.get("mailbox") || ""
    const reason = params.get("reason") || ""
    const email = params.get("email") || ""

    if (mailboxState === "connected") {
      if (email) {
        $("mailboxEmailInput").value = email
      }
      setFeedback(`Boîte connectée avec succès : ${email || "Gmail"}.`, "success")
    } else if (mailboxState === "error") {
      setFeedback(reason || "Erreur de connexion boîte mail.", "error")
    }

    if (mailboxState) {
      window.history.replaceState({}, document.title, "/frontend/mailbox-connect.html")
    }
  }

  async function boot() {
    applyQueryState()
    let session = getStoredSession()
    session = await fetchSession() || session
    renderAccountSummary(session)

    if (!session?.email) {
      setFeedback("Connectez-vous d'abord sur la page Compte pour relier une boîte mail.", "error")
      return
    }

    if (!$("mailboxEmailInput").value) {
      $("mailboxEmailInput").value = session.email || ""
    }

    try {
      await loadConnections()
    } catch (error) {
      setFeedback(error.message || "Impossible de lire l'état des connexions boîte mail.", "error")
    }
  }

  $("mailboxConnectStartButton")?.addEventListener("click", async () => {
    try {
      await connectMailbox()
    } catch (error) {
      setFeedback(error.message || "Impossible de démarrer la connexion Gmail.", "error")
    }
  })

  $("mailboxRefreshStateButton")?.addEventListener("click", async () => {
    try {
      await loadConnections()
      setFeedback("État des connexions actualisé.", "success")
    } catch (error) {
      setFeedback(error.message || "Impossible d'actualiser les connexions boîte mail.", "error")
    }
  })

  $("mailboxConnectionsUserList")?.addEventListener("click", async (event) => {
    const reconnectButton = event.target.closest("[data-mailbox-reconnect]")
    if (reconnectButton) {
      $("mailboxEmailInput").value = reconnectButton.getAttribute("data-mailbox-reconnect") || ""
      try {
        await connectMailbox()
      } catch (error) {
        setFeedback(error.message || "Impossible de reconnecter cette boîte mail.", "error")
      }
      return
    }

    const disconnectButton = event.target.closest("[data-mailbox-disconnect]")
    if (!disconnectButton) return

    const mailboxEmail = disconnectButton.getAttribute("data-mailbox-email") || ""
    const confirmed = window.confirm(`Déconnecter la boîte mail ${mailboxEmail} ?`)
    if (!confirmed) return

    try {
      await disconnectMailbox(disconnectButton.getAttribute("data-mailbox-disconnect") || "", mailboxEmail)
    } catch (error) {
      setFeedback(error.message || "Impossible de déconnecter cette boîte mail.", "error")
    }
  })

  boot()
})()
