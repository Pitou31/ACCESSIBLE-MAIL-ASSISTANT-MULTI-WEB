(() => {
  let currentAdminSession = null

  function $(id) {
    return document.getElementById(id)
  }

  function setFeedback(message, tone = "info") {
    const element = $("adminDbFeedback")
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  function isAdminRole(role) {
    return role === "admin" || role === "super_admin"
  }

  async function requireAdminSession() {
    const response = await fetch("/api/account/session", {
      cache: "no-store",
      credentials: "same-origin"
    })
    const result = await response.json()
    if (!response.ok || !result.ok || !result.accountActive || !result.session) {
      window.location.href = "/frontend/admin-login.html"
      return null
    }

    if (!isAdminRole(result.session.role)) {
      window.location.href = "/frontend/admin-login.html"
      return null
    }

    currentAdminSession = result.session
    const operatorField = $("adminOperator")
    if (operatorField && !operatorField.value.trim()) {
      operatorField.value = result.session.email || ""
    }
    return result.session
  }

  function getAdminContext() {
    return {
      reviewedBy: $("adminOperator")?.value.trim() || "admin-manuel",
      adminNotes: $("adminNotes")?.value.trim() || "",
      productVersion: $("adminProductVersion")?.value || "base",
      temporaryPassword: $("adminTemporaryPassword")?.value || "",
      email: $("adminFilterEmail")?.value.trim().toLowerCase() || "",
      status: $("adminFilterStatus")?.value || ""
    }
  }

  function getSecondaryAdminPayload() {
    return {
      firstName: $("secondaryAdminFirstName")?.value.trim() || "",
      lastName: $("secondaryAdminLastName")?.value.trim() || "",
      email: $("secondaryAdminEmail")?.value.trim().toLowerCase() || "",
      phone: $("secondaryAdminPhone")?.value.trim() || "",
      password: $("secondaryAdminPassword")?.value || "",
      reviewedBy: $("adminOperator")?.value.trim() || "admin-manuel"
    }
  }

  function formatDate(value) {
    if (!value) return "Non renseigne"
    return new Date(value).toLocaleString("fr-FR")
  }

  function isAdminAccountType(value) {
    return value === "administrateur"
  }

  function buildTypeUsageLine(record) {
    if (isAdminAccountType(record.account_type) || isAdminRole(record.role)) {
      return `<p class="settings-help"><strong>Type :</strong> ${record.account_type}</p>`
    }

    return `<p class="settings-help"><strong>Type :</strong> ${record.account_type} | <strong>Usage :</strong> ${record.usage_mode}</p>`
  }

  function buildRequestCard(request) {
    return `
      <article class="account-summary-card admin-record-card">
        <p class="account-summary-title">${request.first_name} ${request.last_name}</p>
        <p class="settings-help"><strong>ID :</strong> ${request.id}</p>
        <p class="settings-help"><strong>Email :</strong> ${request.email}</p>
        ${buildTypeUsageLine(request)}
        <p class="settings-help"><strong>Statut :</strong> ${request.status}</p>
        <p class="settings-help"><strong>Compte lie :</strong> ${request.linked_account_id || "Aucun"}</p>
        <p class="settings-help"><strong>Organisation :</strong> ${request.organization_name || "Non renseignee"}</p>
        <p class="settings-help"><strong>Document :</strong> ${request.supporting_document_name || "Non fourni"}</p>
        <p class="settings-help"><strong>Creee le :</strong> ${formatDate(request.created_at)}</p>
        <div class="admin-record-actions">
          <button class="action-button" type="button" data-request-action="approved" data-request-id="${request.id}">Valider</button>
          <button class="action-button" type="button" data-request-action="more_info_requested" data-request-id="${request.id}">Complements</button>
          <button class="action-button" type="button" data-request-action="rejected" data-request-id="${request.id}">Refuser</button>
        </div>
      </article>
    `
  }

  function buildAccountCard(account) {
    const activateDisabled = account.status === "active" ? "disabled" : ""
    const suspendDisabled = account.status === "suspended" ? "disabled" : ""
    const activateLabel = account.status === "active" ? "Deja actif" : "Activer"
    const suspendLabel = account.status === "suspended" ? "Deja suspendu" : "Suspendre"
    const deleteButton = isAdminRole(account.role)
      ? ""
      : `<button class="action-button delete-button" type="button" data-account-delete="true" data-account-id="${account.id}">Supprimer</button>`
    const resetPasswordButton = isAdminRole(account.role)
      ? `<button class="action-button" type="button" data-account-reset-password="true" data-account-id="${account.id}">Réinitialiser le mot de passe</button>`
      : ""

    return `
      <article class="account-summary-card admin-record-card">
        <p class="account-summary-title">${account.first_name} ${account.last_name}</p>
        <p class="settings-help"><strong>ID :</strong> ${account.id}</p>
        <p class="settings-help"><strong>Email :</strong> ${account.email}</p>
        <p class="settings-help"><strong>Role :</strong> ${account.role}</p>
        ${buildTypeUsageLine(account)}
        <p class="settings-help"><strong>Statut :</strong> ${account.status}</p>
        <p class="settings-help"><strong>Version :</strong> ${account.product_version}</p>
        <p class="settings-help"><strong>Valide par :</strong> ${account.validated_by || "Non renseigne"}</p>
        <p class="settings-help"><strong>Demande source :</strong> ${account.source_request_id || "Aucune"}</p>
        <div class="admin-record-actions">
          <button class="action-button admin-activate-button" type="button" data-account-action="active" data-account-id="${account.id}" ${activateDisabled}>${activateLabel}</button>
          <button class="action-button admin-suspend-button" type="button" data-account-action="suspended" data-account-id="${account.id}" ${suspendDisabled}>${suspendLabel}</button>
          ${resetPasswordButton}
          ${deleteButton}
        </div>
      </article>
    `
  }

  function buildMailboxCard(mailbox) {
    const ownerLabel = mailbox.owner_email
      ? `${mailbox.owner_email}${mailbox.owner_first_name || mailbox.owner_last_name ? ` (${[mailbox.owner_first_name, mailbox.owner_last_name].filter(Boolean).join(" ")})` : ""}`
      : "Non renseigné"
    const sharingLabel = mailbox.sharing_enabled ? "Multi-utilisateur" : "Mono-utilisateur"
    const actionLabel = mailbox.sharing_enabled ? "Passer en mono" : "Passer en multi"

    return `
      <article class="account-summary-card admin-record-card">
        <p class="account-summary-title">${mailbox.email_address}</p>
        <p class="settings-help"><strong>ID ressource :</strong> ${mailbox.id}</p>
        <p class="settings-help"><strong>Fournisseur :</strong> ${mailbox.provider || "Non renseigné"}</p>
        <p class="settings-help"><strong>Mode :</strong> ${sharingLabel}</p>
        <p class="settings-help"><strong>Propriétaire :</strong> ${ownerLabel}</p>
        <p class="settings-help"><strong>Connexions :</strong> ${mailbox.connection_count} | <strong>Membres actifs :</strong> ${mailbox.member_count}</p>
        <p class="settings-help"><strong>Dernière mise à jour :</strong> ${formatDate(mailbox.updated_at)}</p>
        <div class="admin-record-actions">
          <button class="action-button ${mailbox.sharing_enabled ? "" : "send-button"}" type="button" data-mailbox-sharing="${mailbox.sharing_enabled ? "mono" : "multi"}" data-mailbox-resource-id="${mailbox.id}">${actionLabel}</button>
        </div>
      </article>
    `
  }

  function buildDeleteConfirmationMessage(card) {
    const lines = Array.from(card.querySelectorAll(".settings-help")).map((node) => node.textContent.trim())
    return [
      "Confirmer la suppression définitive de ce compte ?",
      "",
      ...lines
    ].join("\n")
  }

  async function loadRequests() {
    const { email, status } = getAdminContext()
    const params = new URLSearchParams()
    if (email) params.set("email", email)
    if (status && !["pending_activation", "active", "suspended"].includes(status)) {
      params.set("status", status)
    }

    const response = await fetch(`/api/admin/requests?${params.toString()}`)
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture des demandes.")
    }

    const container = $("adminRequestsList")
    if (!container) return
    container.innerHTML = result.requests.length > 0
      ? result.requests.map(buildRequestCard).join("")
      : '<div class="account-summary-card"><p class="settings-help">Aucune demande trouvee.</p></div>'
  }

  async function loadAccounts() {
    const { email, status } = getAdminContext()
    const params = new URLSearchParams()
    if (email) params.set("email", email)
    if (status && !["pending", "more_info_requested", "approved", "rejected"].includes(status)) {
      params.set("status", status)
    }

    const response = await fetch(`/api/admin/accounts?${params.toString()}`)
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture des comptes.")
    }

    const container = $("adminAccountsList")
    if (!container) return
    container.innerHTML = result.accounts.length > 0
      ? result.accounts.map(buildAccountCard).join("")
      : '<div class="account-summary-card"><p class="settings-help">Aucun compte trouve.</p></div>'
  }

  async function loadMailboxResources() {
    const { email } = getAdminContext()
    const params = new URLSearchParams()
    if (email) params.set("email", email)

    const response = await fetch(`/api/admin/mailboxes?${params.toString()}`)
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture des boîtes mail.")
    }

    const container = $("adminMailboxResourcesList")
    if (!container) return
    container.innerHTML = result.mailboxes.length > 0
      ? result.mailboxes.map(buildMailboxCard).join("")
      : '<div class="account-summary-card"><p class="settings-help">Aucune boîte mail connue pour le moment.</p></div>'
  }

  async function refreshAll() {
    setFeedback("Chargement des donnees administrateur...", "info")
    try {
      await Promise.all([loadRequests(), loadAccounts(), loadMailboxResources()])
      setFeedback("Donnees administrateur rechargees.", "success")
    } catch (error) {
      setFeedback(error.message || "Erreur de chargement.", "error")
    }
  }

  async function updateRequest(requestId, status) {
    const context = getAdminContext()
    const response = await fetch("/api/admin/request-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        requestId,
        status,
        reviewedBy: context.reviewedBy,
        adminNotes: context.adminNotes,
        requestedAdditionalInfo: status === "more_info_requested" ? context.adminNotes : "",
        productVersion: context.productVersion,
        temporaryPassword: context.temporaryPassword
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de mise a jour de la demande.")
    }

    return result.request
  }

  async function updateAccount(accountId, status) {
    const context = getAdminContext()
    const response = await fetch("/api/admin/account-status", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId,
        status,
        reviewedBy: context.reviewedBy,
        adminNotes: context.adminNotes,
        productVersion: context.productVersion,
        temporaryPassword: context.temporaryPassword
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de mise a jour du compte.")
    }

    return result.account
  }

  async function deleteAccount(accountId) {
    const context = getAdminContext()
    const response = await fetch("/api/admin/account-delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId,
        reviewedBy: context.reviewedBy,
        adminNotes: context.adminNotes
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de suppression du compte.")
    }

    return result.account
  }

  async function resetAdminPassword(accountId) {
    const context = getAdminContext()
    const response = await fetch("/api/admin/password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        accountId,
        reviewedBy: context.reviewedBy,
        temporaryPassword: context.temporaryPassword
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de réinitialisation du mot de passe.")
    }

    return result.account
  }

  async function updateMailboxSharing(mailboxResourceId, mode) {
    const response = await fetch("/api/admin/mailbox-sharing", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mailboxResourceId,
        sharingEnabled: mode === "multi"
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de mise à jour du mode de la boîte mail.")
    }

    return result.mailbox
  }

  async function createSecondaryAdmin() {
    const payload = getSecondaryAdminPayload()
    const button = $("createSecondaryAdminButton")

    if (!button) return

    button.disabled = true
    try {
      const response = await fetch("/api/admin/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        const details = Array.isArray(result.details) && result.details.length > 0
          ? ` ${result.details.join(" ")}`
          : ""
        throw new Error(`${result.error || "Erreur de création de l'administrateur."}${details}`)
      }

      await refreshAll()
      setFeedback(`Administrateur créé : ${result.admin.email}.`, "success")
      $("secondaryAdminFirstName").value = ""
      $("secondaryAdminLastName").value = ""
      $("secondaryAdminEmail").value = ""
      $("secondaryAdminPhone").value = ""
      $("secondaryAdminPassword").value = ""
    } catch (error) {
      setFeedback(error.message || "Erreur de création de l'administrateur.", "error")
    } finally {
      button.disabled = false
    }
  }

  function bindRecordActions() {
    $("adminRequestsList")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-request-action]")
      if (!button) return

      button.disabled = true
      try {
        const request = await updateRequest(button.dataset.requestId, button.dataset.requestAction)
        await refreshAll()
        setFeedback(`Demande ${request.id} mise a jour : ${request.status}.`, "success")
      } catch (error) {
        setFeedback(error.message || "Erreur de traitement de la demande.", "error")
      } finally {
        button.disabled = false
      }
    })

    $("adminAccountsList")?.addEventListener("click", async (event) => {
      const resetButton = event.target.closest("[data-account-reset-password]")
      if (resetButton) {
        resetButton.disabled = true
        try {
          const account = await resetAdminPassword(resetButton.dataset.accountId)
          await refreshAll()
          setFeedback(`Mot de passe réinitialisé pour ${account.email}.`, "success")
        } catch (error) {
          setFeedback(error.message || "Erreur de réinitialisation du mot de passe.", "error")
        } finally {
          resetButton.disabled = false
        }
        return
      }

      const deleteButton = event.target.closest("[data-account-delete]")
      if (deleteButton) {
        const card = deleteButton.closest(".admin-record-card")
        const confirmationMessage = card ? buildDeleteConfirmationMessage(card) : "Confirmer la suppression définitive de ce compte ?"
        if (!window.confirm(confirmationMessage)) {
          return
        }

        deleteButton.disabled = true
        try {
          const account = await deleteAccount(deleteButton.dataset.accountId)
          await refreshAll()
          setFeedback(`Compte ${account.id} supprimé définitivement.`, "success")
        } catch (error) {
          setFeedback(error.message || "Erreur de suppression du compte.", "error")
        } finally {
          deleteButton.disabled = false
        }
        return
      }

      const button = event.target.closest("[data-account-action]")
      if (!button) return

      button.disabled = true
      try {
        const account = await updateAccount(button.dataset.accountId, button.dataset.accountAction)
        await refreshAll()
        setFeedback(`Compte ${account.id} mis a jour : ${account.status}.`, "success")
      } catch (error) {
        setFeedback(error.message || "Erreur de traitement du compte.", "error")
      } finally {
        button.disabled = false
      }
    })

    $("adminMailboxResourcesList")?.addEventListener("click", async (event) => {
      const button = event.target.closest("[data-mailbox-sharing]")
      if (!button) return

      button.disabled = true
      try {
        const mailbox = await updateMailboxSharing(
          button.dataset.mailboxResourceId,
          button.dataset.mailboxSharing
        )
        await refreshAll()
        setFeedback(`Boîte ${mailbox.email_address} mise en mode ${mailbox.sharing_enabled ? "multi-utilisateur" : "mono-utilisateur"}.`, "success")
      } catch (error) {
        setFeedback(error.message || "Erreur de mise à jour du mode de la boîte mail.", "error")
      } finally {
        button.disabled = false
      }
    })
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("refreshAdminDataButton")?.addEventListener("click", refreshAll)
    $("createSecondaryAdminButton")?.addEventListener("click", createSecondaryAdmin)
    bindRecordActions()
    requireAdminSession().then((session) => {
      if (!session) return
      refreshAll()
    }).catch(() => {
      window.location.href = "/frontend/admin-login.html"
    })
  })
})()
