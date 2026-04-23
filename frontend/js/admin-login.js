(() => {
  const SESSION_KEY = "mail-assistant-session"
  const ACCOUNT_ACTIVE_KEY = "mail-assistant-account-active"
  const identityFormatting = window.MailIdentityFormatting || {}
  const humanVerification = window.MailHumanVerification || {}
  const maskEmail = identityFormatting.maskEmail || ((value) => String(value || ""))
  const buildPersonTitle = identityFormatting.buildPersonTitle || ((person = {}) => {
    return `${person.firstName || ""} ${person.lastName || ""}`.trim() || person.email || "Identité non renseignée"
  })
  const validateHumanVerification = humanVerification.validateHumanVerification || (() => ({ ok: true }))

  function $(id) {
    return document.getElementById(id)
  }

  function isAdminRole(role) {
    return role === "admin" || role === "super_admin"
  }

  function setFeedback(message, tone = "info") {
    const element = $("adminLoginFeedback")
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  function setChangePasswordFeedback(message, tone = "info") {
    const element = $("adminChangePasswordFeedback")
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    localStorage.setItem(ACCOUNT_ACTIVE_KEY, session?.accountActive ? "1" : "0")
    window.dispatchEvent(new CustomEvent("mail-assistant-session-changed", {
      detail: { accountActive: session?.accountActive ? 1 : 0 }
    }))
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY)
    localStorage.setItem(ACCOUNT_ACTIVE_KEY, "0")
    window.dispatchEvent(new CustomEvent("mail-assistant-session-changed", {
      detail: { accountActive: 0 }
    }))
  }

  function setLoginFieldsForSession(session = null) {
    const emailField = $("adminLoginEmail")
    const passwordField = $("adminLoginPassword")
    const isAdminSession = Boolean(session?.userId && isAdminRole(session?.role))

    if (emailField) {
      if (isAdminSession) {
        emailField.value = ""
        emailField.placeholder = "Session administrateur active"
        emailField.disabled = true
        emailField.setAttribute("aria-label", "Adresse email administrateur masquée pendant la session active")
      } else {
        emailField.disabled = false
        emailField.placeholder = "nom@exemple.fr"
        emailField.setAttribute("aria-label", "Adresse email administrateur")
      }
    }

    if (passwordField) {
      passwordField.value = ""
      passwordField.disabled = isAdminSession
      passwordField.placeholder = isAdminSession ? "Session administrateur active" : "Mot de passe administrateur"
    }
  }

  function renderSessionCard(session = null) {
    const card = $("adminLoginStatusCard")
    if (!card) return

    if (!session?.userId || !isAdminRole(session.role)) {
      card.innerHTML = '<p class="settings-help">Aucune session administrateur active.</p>'
      return
    }

    card.innerHTML = `
      <p class="account-summary-title">${buildPersonTitle({
        firstName: session.firstName,
        lastName: session.lastName,
        email: session.email
      })}</p>
      <p class="settings-help"><strong>Contexte :</strong> Session administrateur active</p>
      <p class="settings-help"><strong>Email :</strong> ${maskEmail(session.email || "Non renseigné")}</p>
      <p class="settings-help"><strong>Rôle :</strong> ${session.role || "Non renseigné"}</p>
      <p class="settings-help"><strong>Statut :</strong> ${session.status || "Non renseigné"}</p>
      <p class="settings-help"><strong>Version :</strong> ${session.productVersion || "Non renseignée"}</p>
    `
  }

  function syncAdminButtons(session = null) {
    const isAdminSession = Boolean(session?.userId && isAdminRole(session?.role))
    const loginButton = $("adminLoginButton")
    const logoutButton = $("adminLogoutButton")

    if (loginButton) {
      loginButton.classList.toggle("send-button", !isAdminSession)
      loginButton.disabled = isAdminSession
    }

    if (logoutButton) {
      logoutButton.classList.toggle("send-button", isAdminSession)
      logoutButton.disabled = !isAdminSession
    }
  }

  async function loadActiveSession() {
    const response = await fetch("/api/account/session", {
      cache: "no-store",
      credentials: "same-origin"
    })
    const result = await response.json()
    if (!response.ok || !result.ok || !result.accountActive || !result.session) {
      clearSession()
      renderSessionCard(null)
      syncAdminButtons(null)
      setLoginFieldsForSession(null)
      return null
    }

    if (!isAdminRole(result.session.role)) {
      saveSession(result.session)
      renderSessionCard(null)
      syncAdminButtons(null)
      setLoginFieldsForSession(null)
      setFeedback(`Une session utilisateur est active pour ${maskEmail(result.session.email)}, mais aucun administrateur n'est connecté.`, "error")
      return result.session
    }

    saveSession(result.session)
    renderSessionCard(result.session)
    syncAdminButtons(result.session)
    setLoginFieldsForSession(result.session)
    setFeedback(`Administrateur connecté : ${maskEmail(result.session.email)}.`, "success")
    return result.session
  }

  async function loginAdmin() {
    const email = $("adminLoginEmail")?.value.trim().toLowerCase() || ""
    const password = $("adminLoginPassword")?.value || ""
    const humanConfirmed = Boolean($("adminLoginHumanConfirmation")?.checked)
    const humanTrap = $("adminLoginWebsite")?.value || ""
    const turnstileToken = $("adminLoginTurnstileToken")?.value || ""
    const humanValidation = validateHumanVerification({
      confirmed: humanConfirmed,
      trapValue: humanTrap
    })

    if (!email || !password) {
      setFeedback("Renseigne l’email admin et le mot de passe.", "error")
      return
    }

    if (!humanValidation.ok) {
      setFeedback(humanValidation.message || "Vérification humaine invalide.", "error")
      return
    }

    setFeedback("Connexion administrateur en cours...", "info")
    const response = await fetch("/api/admin/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        email,
        password,
        humanConfirmed,
        humanTrap,
        turnstileToken
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de connexion administrateur.")
    }

    const session = result.session || null
    if (!session || !isAdminRole(session.role)) {
      throw new Error("Ce compte n’a pas le rôle administrateur.")
    }

    const normalizedSession = {
      ...session,
      firstName: session.firstName || session.first_name || "",
      lastName: session.lastName || session.last_name || "",
      email,
      accountType: session.accountType || "individuel"
    }

    saveSession(normalizedSession)
    setLoginFieldsForSession(normalizedSession)
    renderSessionCard(normalizedSession)
    syncAdminButtons(normalizedSession)
    if ($("adminLoginHumanConfirmation")) $("adminLoginHumanConfirmation").checked = false
    if ($("adminLoginWebsite")) $("adminLoginWebsite").value = ""
    if ($("adminLoginTurnstileToken")) $("adminLoginTurnstileToken").value = ""
    setFeedback(`Connexion admin réussie pour ${maskEmail(email)}.`, "success")
  }

  async function logoutAdmin() {
    try {
      await fetch("/api/account/logout", {
        method: "POST",
        credentials: "same-origin"
      })
    } catch (_) {
      // no-op
    }
    clearSession()
    renderSessionCard(null)
    syncAdminButtons(null)
    setLoginFieldsForSession(null)
    setFeedback("Session administrateur fermée.", "info")
  }

  async function changeAdminPassword() {
    const sessionRaw = localStorage.getItem(SESSION_KEY)
    const session = sessionRaw ? JSON.parse(sessionRaw) : null
    const currentPassword = $("adminCurrentPassword")?.value || ""
    const newPassword = $("adminNewPassword")?.value || ""
    const confirmPassword = $("adminConfirmPassword")?.value || ""
    const humanConfirmed = Boolean($("adminChangePasswordHumanConfirmation")?.checked)
    const humanTrap = $("adminChangePasswordWebsite")?.value || ""
    const turnstileToken = $("adminChangePasswordTurnstileToken")?.value || ""
    const humanValidation = validateHumanVerification({
      confirmed: humanConfirmed,
      trapValue: humanTrap
    })

    if (!session?.userId || !isAdminRole(session.role)) {
      setChangePasswordFeedback("Aucune session administrateur active.", "error")
      return
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setChangePasswordFeedback("Renseigne tous les champs du changement de mot de passe admin.", "error")
      return
    }

    if (newPassword !== confirmPassword) {
      setChangePasswordFeedback("La confirmation du nouveau mot de passe ne correspond pas.", "error")
      return
    }

    if (!humanValidation.ok) {
      setChangePasswordFeedback(humanValidation.message || "Vérification humaine invalide.", "error")
      return
    }

    setChangePasswordFeedback("Changement du mot de passe admin en cours...", "info")
    const response = await fetch("/api/admin/change-password", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      credentials: "same-origin",
      body: JSON.stringify({
        currentPassword,
        newPassword,
        humanConfirmed,
        humanTrap,
        turnstileToken
      })
    })

    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de changement du mot de passe administrateur.")
    }

    $("adminCurrentPassword").value = ""
    $("adminNewPassword").value = ""
    $("adminConfirmPassword").value = ""
    if ($("adminChangePasswordHumanConfirmation")) $("adminChangePasswordHumanConfirmation").checked = false
    if ($("adminChangePasswordWebsite")) $("adminChangePasswordWebsite").value = ""
    if ($("adminChangePasswordTurnstileToken")) $("adminChangePasswordTurnstileToken").value = ""
    setChangePasswordFeedback(`Mot de passe administrateur mis à jour pour ${maskEmail(result.account.email)}.`, "success")
  }

  document.addEventListener("DOMContentLoaded", async () => {
    $("adminLoginButton")?.addEventListener("click", async () => {
      try {
        await loginAdmin()
      } catch (error) {
        renderSessionCard(null)
        syncAdminButtons(null)
        setLoginFieldsForSession(null)
        setFeedback(error.message || "Erreur de connexion administrateur.", "error")
      }
    })

    $("adminLogoutButton")?.addEventListener("click", logoutAdmin)
    $("adminChangePasswordButton")?.addEventListener("click", async () => {
      try {
        await changeAdminPassword()
      } catch (error) {
        setChangePasswordFeedback(error.message || "Erreur de changement du mot de passe administrateur.", "error")
      }
    })

    try {
      await loadActiveSession()
    } catch (_) {
      renderSessionCard(null)
      syncAdminButtons(null)
      setLoginFieldsForSession(null)
    }
  })
})()
