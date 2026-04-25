(() => {
  const SESSION_KEY = "mail-assistant-session"
  const ACCOUNT_ACTIVE_KEY = "mail-assistant-account-active"
  const SETTINGS_STORAGE_KEY = "mail-assistant-settings"
  const LAST_MAIL_MODE_STORAGE_KEY = "mail-assistant-last-mail-mode"
  const identityFormatting = window.MailIdentityFormatting || {}
  const humanVerification = window.MailHumanVerification || {}
  const maskEmail = identityFormatting.maskEmail || ((value) => String(value || ""))
  const buildPersonTitle = identityFormatting.buildPersonTitle || ((person = {}) => {
    return `${person.firstName || ""} ${person.lastName || ""}`.trim() || person.email || "Identité non renseignée"
  })
  const validateHumanVerification = humanVerification.validateHumanVerification || (() => ({ ok: true, message: "" }))
  let requestAttachmentState = { matched: false, attachmentLabel: "", organizationName: "" }

  function $(id) {
    return document.getElementById(id)
  }

  function getEmailValidator() {
    return window.MailEmailValidation || null
  }

  function saveSession(session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session))
    localStorage.setItem(ACCOUNT_ACTIVE_KEY, session?.accountActive ? "1" : "0")
    window.dispatchEvent(new CustomEvent("mail-assistant-session-changed", {
      detail: { accountActive: session?.accountActive ? 1 : 0 }
    }))
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
    } catch (_) {
      return null
    }
  }

  function clearSession() {
    let accountId = ""
    try {
      const current = JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
      accountId = current?.userId || current?.accountId || ""
    } catch (_) {
      accountId = ""
    }

    localStorage.removeItem(SESSION_KEY)
    localStorage.setItem(ACCOUNT_ACTIVE_KEY, "0")
    localStorage.removeItem(SETTINGS_STORAGE_KEY)
    localStorage.removeItem(LAST_MAIL_MODE_STORAGE_KEY)
    if (accountId) {
      localStorage.removeItem(`${SETTINGS_STORAGE_KEY}:${accountId}`)
      localStorage.removeItem(`${LAST_MAIL_MODE_STORAGE_KEY}:${accountId}`)
    }
    window.dispatchEvent(new CustomEvent("mail-assistant-session-changed", {
      detail: { accountActive: 0 }
    }))
  }

  function setFeedback(element, message, tone = "info") {
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  function formatDate(value) {
    if (!value) return "Non renseigne"
    return new Date(value).toLocaleString("fr-FR")
  }

  function buildStatusLabel(status) {
    const labels = {
      pending: "En attente",
      more_info_requested: "Complements demandes",
      approved: "Approuvee",
      rejected: "Refusee",
      pending_activation: "Compte cree, en attente d'activation",
      active: "Compte actif",
      suspended: "Compte suspendu"
    }

    return labels[status] || status || "Inconnu"
  }

function getProviderApiClient() {
  return window.ProviderApiClient || null
}

  function getKnownProviderDefinitions() {
    return [
      {
        providerType: "deepgram",
        label: "Deepgram"
      },
      {
        providerType: "assemblyai",
        label: "AssemblyAI"
      },
      {
        providerType: "deepseek-api",
        label: "DeepSeek API"
      },
      {
        providerType: "mistral-api",
        label: "Mistral API"
      },
      {
        providerType: "together-api",
        label: "Together API"
      }
    ]
  }

  function getRequestFormData() {
    const file = $("supportingDocument")?.files?.[0] || null

    return {
      accountType: $("accountType")?.value || "individuel",
      usageMode: $("usageMode")?.value || "gratuit",
      firstName: $("firstName")?.value.trim() || "",
      lastName: $("lastName")?.value.trim() || "",
      email: $("emailAddress")?.value.trim().toLowerCase() || "",
      phone: $("phoneNumber")?.value.trim() || "",
      password: $("requestPassword")?.value || "",
      organizationName: $("organizationName")?.value.trim() || "",
      disabilityUsage: Boolean($("disabilityUsage")?.checked),
      plannedMailboxes: $("mailboxesPlanned")?.value.trim() || "",
      motivation: $("motivationText")?.value.trim() || "",
      supportingDocumentName: file?.name || "",
      consent: Boolean($("dataConsent")?.checked),
      humanConfirmed: Boolean($("humanConfirmation")?.checked),
      humanTrap: $("humanWebsite")?.value || "",
      turnstileToken: $("accountTurnstileToken")?.value || ""
    }
  }

  function validateContactEmailForRequest() {
    const validator = getEmailValidator()
    const emailInput = $("emailAddress")
    if (!validator || !emailInput) {
      const raw = String(emailInput?.value || "").trim().toLowerCase()
      if (!raw) {
        return { ok: false, message: "Adresse mail obligatoire.", normalized: raw }
      }
      if (!emailInput.checkValidity()) {
        return { ok: false, message: "Adresse mail invalide.", normalized: raw }
      }
      return { ok: true, normalized: raw }
    }

    const result = validator.validateEmailAddress(emailInput.value, { required: true })
    if (result.ok) {
      emailInput.value = result.normalized
      emailInput.setCustomValidity("")
    } else {
      emailInput.setCustomValidity(result.message || "Adresse mail invalide.")
    }

    return result
  }

  function validatePlannedMailboxesForRequest() {
    const validator = getEmailValidator()
    const input = $("mailboxesPlanned")
    if (!input) return { ok: true, normalized: [] }
    if (!validator) {
      return { ok: true, normalized: [] }
    }

    const result = validator.validateEmailList(input.value, { required: false })
    if (result.ok) {
      input.setCustomValidity("")
      if (Array.isArray(result.normalized) && result.normalized.length > 0) {
        input.value = result.normalized.join(", ")
      }
    } else {
      input.setCustomValidity(result.message || "Liste d'adresses mail invalide.")
    }

    return result
  }

  async function refreshPlannedMailboxesFeedback(options = {}) {
    const input = $("mailboxesPlanned")
    const feedback = $("accountRequestFeedback")
    if (!input || !feedback) return { ok: true }

    const localValidation = validatePlannedMailboxesForRequest()
    if (!localValidation.ok) {
      if (!options.silent) {
        setFeedback(feedback, localValidation.message || "La liste des boîtes mail prévues est invalide.", "error")
      }
      return localValidation
    }

    if (!String(input.value || "").trim()) {
      return { ok: true, normalized: [] }
    }

    try {
      const params = new URLSearchParams({ emails: input.value })
      const response = await fetch(`/api/account/request/planned-mailboxes?${params.toString()}`)
      const result = await response.json()

      if (!response.ok || !result.ok) {
        const message = (Array.isArray(result.issues) && result.issues[0]) || "Boîtes mail prévues invalides."
        input.setCustomValidity(message)
        if (!options.silent) {
          setFeedback(feedback, message, "error")
        }
        return { ok: false, message }
      }

      input.setCustomValidity("")
      if (Array.isArray(result.normalized) && result.normalized.length > 0) {
        input.value = result.normalized.join(", ")
      }
      return { ok: true, normalized: result.normalized || [] }
    } catch (error) {
      if (!options.silent) {
        setFeedback(feedback, error.message || "Impossible de vérifier les boîtes mail prévues.", "error")
      }
      return { ok: false, message: error.message || "Impossible de vérifier les boîtes mail prévues." }
    }
  }

  function updateRequestEmailFeedback(options = {}) {
    const feedback = $("accountRequestFeedback")
    if (!feedback) return

    const emailInput = $("emailAddress")
    const rawValue = String(emailInput?.value || "").trim()
    if (!rawValue) {
      if (options.resetToDefault) {
        setFeedback(feedback, "Le formulaire attend votre saisie.", "info")
      }
      return
    }

    const validation = validateContactEmailForRequest()
    if (validation.ok) {
      if (options.showSuccess !== false) {
        setFeedback(feedback, "Adresse mail valide.", "success")
      }
      return
    }

    setFeedback(feedback, validation.message || "Adresse mail invalide.", "error")
  }

  function setAttachmentDisplay(message) {
    const input = $("attachmentAdminDisplay")
    if (input) {
      input.value = message || ""
    }
  }

  async function refreshAttachmentResolution(options = {}) {
    const feedback = $("organizationLookupFeedback")
    const data = getRequestFormData()
    const emailValidation = validateContactEmailForRequest()

    if (data.accountType === "individuel") {
      requestAttachmentState = { matched: true, attachmentLabel: "Vous-même (compte individuel)", organizationName: "" }
      setAttachmentDisplay(requestAttachmentState.attachmentLabel)
      if (feedback) {
        feedback.textContent = "Le compte individuel est rattaché à lui-même."
      }
      return requestAttachmentState
    }

    if (!emailValidation.ok) {
      requestAttachmentState = { matched: false, attachmentLabel: "", organizationName: "" }
      setAttachmentDisplay("")
      if (feedback && !options.silent) {
        feedback.textContent = emailValidation.message || "Adresse mail invalide."
      }
      return requestAttachmentState
    }

    if (!data.organizationName) {
      requestAttachmentState = { matched: false, attachmentLabel: "", organizationName: "" }
      setAttachmentDisplay("")
      if (feedback) {
        feedback.textContent = "Saisissez une organisation reconnue pour retrouver l'administrateur compétent."
      }
      return requestAttachmentState
    }

    const params = new URLSearchParams({
      accountType: data.accountType,
      email: data.email,
      organizationName: data.organizationName
    })

    try {
      const response = await fetch(`/api/account/request/attachment?${params.toString()}`)
      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error((Array.isArray(result.details) && result.details[0]) || result.error || "Organisation non reconnue.")
      }

      requestAttachmentState = {
        matched: true,
        attachmentLabel: result.attachmentLabel || "Demande envoyée à l’administrateur compétent.",
        organizationName: result.organizationName || data.organizationName
      }
      setAttachmentDisplay(requestAttachmentState.attachmentLabel)
      if (feedback) {
        feedback.textContent = `Organisation reconnue : ${requestAttachmentState.organizationName}.`
      }
      return requestAttachmentState
    } catch (error) {
      requestAttachmentState = { matched: false, attachmentLabel: "", organizationName: "" }
      setAttachmentDisplay("")
      if (feedback && !options.silent) {
        feedback.textContent = error.message || "Organisation non reconnue."
      }
      return requestAttachmentState
    }
  }

  function validateRequest(data) {
    const issues = []
    const emailValidation = validateContactEmailForRequest()
    const plannedMailboxesValidation = validatePlannedMailboxesForRequest()

    if (!data.firstName) issues.push("Le prénom est requis.")
    if (!data.lastName) issues.push("Le nom est requis.")
    if (!data.password || data.password.length < 10) issues.push("Le mot de passe doit contenir au moins 10 caractères.")
    if (!emailValidation.ok) {
      issues.push(emailValidation.message || "L'email de contact est invalide.")
    }
    if (!plannedMailboxesValidation.ok) {
      issues.push(plannedMailboxesValidation.message || "La liste des boîtes mail prévues est invalide.")
    }
    if (!data.consent) issues.push("Le consentement est requis.")
    const humanValidation = validateHumanVerification({
      confirmed: data.humanConfirmed,
      trapValue: data.humanTrap
    })
    if (!humanValidation.ok) {
      issues.push(humanValidation.message || "Merci de confirmer que vous êtes un humain.")
    }
    if (data.accountType !== "individuel" && !data.organizationName) {
      issues.push("Une organisation est requise pour ce type de compte.")
    }
    if (data.accountType !== "individuel" && !requestAttachmentState.matched) {
      issues.push("L'organisation doit correspondre à un administrateur déjà enregistré.")
    }

    return issues
  }

  function renderSubmittedRequest(request, account, adminAlert = null) {
    const card = $("requestSubmissionCard")
    if (!card) return

    if (!request) {
      card.innerHTML = '<p class="settings-help">Aucune demande deposee pendant cette session.</p>'
      return
    }

    const identityLabel = buildPersonTitle({
      firstName: request.firstName || request.first_name || "",
      lastName: request.lastName || request.last_name || "",
      email: request.email || ""
    })
    const alertText = adminAlert?.message || "Demande envoyée à l’administrateur compétent."

    card.innerHTML = `
      <p class="account-summary-title">${identityLabel}</p>
      <p class="settings-help"><strong>Contexte :</strong> Demande enregistrée</p>
      <p class="settings-help"><strong>Demande :</strong> ${request.id}</p>
      <p class="settings-help"><strong>Compte lie :</strong> ${account?.id || request.linkedAccountId || "Aucun"}</p>
      <p class="settings-help"><strong>Type :</strong> ${request.accountType} | <strong>Usage :</strong> ${request.usageMode}</p>
      <p class="settings-help"><strong>Statut :</strong> ${buildStatusLabel(request.status)}</p>
      <p class="settings-help"><strong>Alerte :</strong> ${alertText}</p>
    `
  }

  async function submitRequest() {
    const feedback = $("accountRequestFeedback")
    const submitButton = $("submitAccountRequestButton")
    if (!feedback || !submitButton) return

    const data = getRequestFormData()
    await refreshAttachmentResolution({ silent: false })
    const issues = validateRequest(data)

    if (issues.length > 0) {
      setFeedback(feedback, issues.join(" "), "error")
      return
    }

    submitButton.disabled = true
    setFeedback(feedback, "Enregistrement de la demande en cours...", "info")

    try {
      const response = await fetch("/api/account/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data)
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        const details = Array.isArray(result.details) && result.details.length > 0
          ? ` ${result.details.join(" ")}`
          : ""
        throw new Error(`${result.error || "Erreur backend."}${details}`)
      }

      setFeedback(feedback, "Demande envoyée à l’administrateur compétent.", "success")
      renderSubmittedRequest(result.request, result.account, result.adminAlert)
    } catch (error) {
      setFeedback(feedback, error.message || "Echec lors de l'envoi de la demande.", "error")
    } finally {
      submitButton.disabled = false
    }
  }

  function getLoginContext() {
    return {
      email: $("loginEmail")?.value.trim().toLowerCase() || "",
      accountType: $("loginAccountType")?.value || "individuel",
      password: $("loginPassword")?.value || "",
      humanConfirmed: Boolean($("accountLoginHumanConfirmation")?.checked),
      humanTrap: $("accountLoginWebsite")?.value || "",
      turnstileToken: $("accountLoginTurnstileToken")?.value || ""
    }
  }

  function getAccountChangePasswordHumanPayload() {
    return {
      humanConfirmed: Boolean($("accountChangePasswordHumanConfirmation")?.checked),
      humanTrap: $("accountChangePasswordWebsite")?.value || "",
      turnstileToken: $("accountChangePasswordTurnstileToken")?.value || ""
    }
  }

  function renderAccountStatus(statusPayload) {
    const card = $("accountStatusCard")
    if (!card) return

    if (!statusPayload?.latestRequest && !statusPayload?.latestAccount) {
      card.innerHTML = '<p class="settings-help">Aucune demande ni aucun compte trouves pour ce type de compte.</p>'
      return
    }

    const request = statusPayload.latestRequest
    const account = statusPayload.latestAccount

    card.innerHTML = `
      <p class="account-summary-title">Etat du dossier</p>
      <p class="settings-help"><strong>Derniere demande :</strong> ${request ? request.id : "Aucune"}</p>
      <p class="settings-help"><strong>Statut demande :</strong> ${request ? buildStatusLabel(request.status) : "Aucune"}</p>
      <p class="settings-help"><strong>Compte :</strong> ${account ? account.id : "Aucun"}</p>
      <p class="settings-help"><strong>Statut compte :</strong> ${account ? buildStatusLabel(account.status) : "Aucun"}</p>
      <p class="settings-help"><strong>Version :</strong> ${account?.product_version || "Non attribuee"}</p>
      <p class="settings-help"><strong>Derniere mise a jour :</strong> ${formatDate(account?.updated_at || request?.updated_at)}</p>
    `
  }

  function renderSessionStatus() {
    const card = $("sessionStatusCard")
    if (!card) return

    const session = getSession()
    syncLoginControlsWithSession(session)
    if (!session?.userId) {
      card.innerHTML = '<p class="settings-help">Aucune session active.</p>'
      return
    }

    card.innerHTML = `
      <p class="account-summary-title">Session active</p>
      <p class="settings-help"><strong>Compte :</strong> ${session.email}</p>
      <p class="settings-help"><strong>Type :</strong> ${session.accountType}</p>
      <p class="settings-help"><strong>Role :</strong> ${session.role}</p>
      <p class="settings-help"><strong>Version :</strong> ${session.productVersion}</p>
      <p class="settings-help"><strong>Ouverte le :</strong> ${formatDate(session.startedAt)}</p>
    `
  }

  function syncLoginControlsWithSession(session = getSession()) {
    const emailInput = $("loginEmail")
    const accountTypeSelect = $("loginAccountType")
    const loginButton = $("loginChoiceButton")
    const logoutButton = $("logoutButton")
    const passwordInput = $("loginPassword")
    const isConnected = Boolean(session?.userId)

    if (emailInput) {
      emailInput.value = isConnected ? (session.email || "") : ""
    }

    if (accountTypeSelect && isConnected && session.accountType) {
      accountTypeSelect.value = session.accountType
    }

    if (passwordInput && !isConnected) {
      passwordInput.value = ""
    }

    if (loginButton) {
      loginButton.classList.toggle("send-button", !isConnected)
    }

    if (logoutButton) {
      logoutButton.classList.toggle("send-button", isConnected)
    }
  }

  function renderProviderStatus({ providers = [], preferences = null } = {}) {
    const card = $("providerStatusCard")
    if (!card) return

    const session = getSession()
    if (!session?.userId) {
      card.innerHTML = '<p class="settings-help">Connecte-toi pour afficher tes fournisseurs API personnels et leur consommation.</p>'
      return
    }

    if (!providers.length) {
      card.innerHTML = `
        <p class="account-summary-title">Fournisseurs API personnels</p>
        <p class="settings-help">Aucun fournisseur personnel n'est encore configuré pour ce compte.</p>
      `
      return
    }

    const activeProviders = providers.filter((provider) => provider.isActive !== false)
    const preferredAudioProviderType = String(preferences?.audio?.audioInputProvider || preferences?.provider?.preferredAudioProvider || "").trim().toLowerCase()
    const preferredTextProviderType = String(preferences?.provider?.preferredLlmProvider || "").trim().toLowerCase()
    const audioProvider = activeProviders.find((provider) => provider.providerType === preferredAudioProviderType)
      || activeProviders.find((provider) => provider.providerType === "deepgram" || provider.providerType === "assemblyai")
    const textProvider = activeProviders.find((provider) => provider.providerType === preferredTextProviderType)
      || activeProviders.find((provider) => ["deepseek-api", "mistral-api"].includes(provider.providerType) && provider.isDefault)
    const providerLines = getKnownProviderDefinitions().map((definition) => {
      const provider = activeProviders.find((item) => item.providerType === definition.providerType)
      if (!provider) {
        return `<p class="settings-help"><strong>${definition.label}</strong> : Non configuré</p>`
      }

      const label = provider.displayName || provider.providerLabel || definition.label
      const maskedKey = provider.maskedApiKey ? ` | <strong>Clé :</strong> ${provider.maskedApiKey}` : ""
      return `<p class="settings-help"><strong>${label}</strong> : ${buildStatusLabel(provider.status)}${maskedKey}</p>`
    }).join("")

    card.innerHTML = `
      <p class="account-summary-title">Fournisseurs API personnels</p>
      <p class="settings-help"><strong>Dictée :</strong> ${audioProvider?.displayName || audioProvider?.providerLabel || "Aucun fournisseur audio actif"}${preferredAudioProviderType ? ` | <strong>Choix par défaut :</strong> ${preferredAudioProviderType}` : ""}</p>
      <p class="settings-help"><strong>IA texte :</strong> ${textProvider?.displayName || textProvider?.providerLabel || "Aucun fournisseur texte actif"}${preferredTextProviderType ? ` | <strong>Choix par défaut :</strong> ${preferredTextProviderType}` : ""}</p>
      ${providerLines}
    `
  }

  async function loadProviderStatus() {
    const client = getProviderApiClient()
    if (!client) {
      renderProviderStatus()
      return
    }

    const session = getSession()
    if (!session?.userId) {
      renderProviderStatus()
      return
    }

    try {
      const [providersResult, preferencesResult] = await Promise.all([
        client.fetchProviderAccounts(),
        client.fetchPreferences()
      ])
      renderProviderStatus({
        providers: providersResult?.providers || [],
        preferences: preferencesResult?.preferences || null
      })
    } catch (error) {
      const card = $("providerStatusCard")
      if (card) {
        card.innerHTML = `
          <p class="account-summary-title">Fournisseurs API personnels</p>
          <p class="settings-help">Impossible de charger le résumé des fournisseurs : ${error.message || "erreur inconnue"}.</p>
        `
      }
    }
  }

  async function lookupAccountStatus() {
    const feedback = $("loginFeedback")
    const { email, accountType, humanConfirmed, humanTrap, turnstileToken } = getLoginContext()

    if (!email || !accountType) {
      setFeedback(feedback, "Renseigne l'email et le type de compte pour verifier le statut.", "error")
      return
    }

    setFeedback(feedback, "Recherche du statut en cours...", "info")

    try {
      const params = new URLSearchParams({ email, accountType, humanConfirmed, humanTrap, turnstileToken })
      const response = await fetch(`/api/account/status?${params.toString()}`)
      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Erreur de lecture du statut.")
      }

      renderAccountStatus(result)

      const accountStatus = result.latestAccount?.status
      if (accountStatus === "active") {
        setFeedback(feedback, "Le compte est actif. La connexion est autorisee.", "success")
      } else if (accountStatus === "suspended") {
        setFeedback(feedback, "Le compte est suspendu. L'acces a l'application est bloque.", "error")
      } else if (accountStatus) {
        setFeedback(feedback, `Compte trouve : ${buildStatusLabel(accountStatus)}.`, "info")
      } else if (result.latestRequest) {
        setFeedback(feedback, `Demande trouvee : ${buildStatusLabel(result.latestRequest.status)}.`, "info")
      } else {
        setFeedback(feedback, "Aucun compte ni aucune demande trouves.", "error")
      }
    } catch (error) {
      setFeedback(feedback, error.message || "Erreur de lecture du statut.", "error")
    }
  }

  async function login() {
    const feedback = $("loginFeedback")
    const context = getLoginContext()

    if (!context.email || !context.accountType || !context.password) {
      setFeedback(feedback, "Renseigne le type de compte, l'email et le mot de passe.", "error")
      return
    }

    setFeedback(feedback, "Connexion en cours...", "info")

    try {
      const response = await fetch("/api/account/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(context)
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        if (result.account) {
          renderAccountStatus({ latestAccount: result.account, latestRequest: null })
        }
        throw new Error(result.error || "Connexion impossible.")
      }

      saveSession({
        ...result.session,
        email: result.account.email,
        firstName: result.account.first_name || "",
        lastName: result.account.last_name || "",
        organizationName: result.account.organization_name || "",
        accountType: result.account.account_type,
        accountActive: 1
      })
      renderSessionStatus()
      loadProviderStatus()
      renderAccountStatus({ latestAccount: result.account, latestRequest: null })
      setFeedback(feedback, `Connexion reussie pour ${result.account.email}.`, "success")
    } catch (error) {
      setFeedback(feedback, error.message || "Erreur de connexion.", "error")
    }
  }

  async function forgotPassword() {
    const feedback = $("loginFeedback")
    const { email, accountType, humanConfirmed, humanTrap, turnstileToken } = getLoginContext()

    if (!email || !accountType) {
      setFeedback(feedback, "Renseigne l'email et le type de compte avant de demander un mot de passe oublié.", "error")
      return
    }

    setFeedback(feedback, "Transmission de la demande de mot de passe oublié...", "info")

    try {
      const response = await fetch("/api/account/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, accountType, humanConfirmed, humanTrap, turnstileToken })
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Erreur lors de la demande de mot de passe oublié.")
      }

      setFeedback(feedback, "Un lien de reinitialisation a ete envoye par mail. Verifie ta boite de reception.", "success")
    } catch (error) {
      setFeedback(feedback, error.message || "Erreur lors de la demande de mot de passe oublié.", "error")
    }
  }

  async function restoreSessionStatus() {
    try {
      const response = await fetch("/api/account/session")
      const result = await response.json()
      if (!response.ok || !result.ok) {
        return
      }

      if (result.accountActive === 1 && result.session) {
        saveSession(result.session)
      } else {
        clearSession()
      }
      renderSessionStatus()
      loadProviderStatus()
    } catch (_) {
      renderSessionStatus()
      loadProviderStatus()
    }
  }

  async function changePassword() {
    const feedback = $("changePasswordFeedback")
    const session = getSession()
    const currentPassword = $("currentPassword")?.value || ""
    const newPassword = $("newPassword")?.value || ""
    const confirmNewPassword = $("confirmNewPassword")?.value || ""

    if (!session?.email || !session?.accountType) {
      setFeedback(feedback, "Connecte-toi d'abord pour changer ton mot de passe.", "error")
      return
    }

    if (!currentPassword || !newPassword || !confirmNewPassword) {
      setFeedback(feedback, "Renseigne tous les champs du changement de mot de passe.", "error")
      return
    }

    if (newPassword !== confirmNewPassword) {
      setFeedback(feedback, "La confirmation du nouveau mot de passe ne correspond pas.", "error")
      return
    }

    setFeedback(feedback, "Changement du mot de passe en cours...", "info")

    try {
      const response = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: session.email,
          accountType: session.accountType,
          currentPassword,
          newPassword,
          ...getAccountChangePasswordHumanPayload()
        })
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Erreur lors du changement de mot de passe.")
      }

      $("currentPassword").value = ""
      $("newPassword").value = ""
      $("confirmNewPassword").value = ""
      setFeedback(feedback, "Le mot de passe a été modifié. Un mail d'information a été envoyé.", "success")
    } catch (error) {
      setFeedback(feedback, error.message || "Erreur lors du changement de mot de passe.", "error")
    }
  }

  async function logout() {
    try {
      await fetch("/api/account/logout", {
        method: "POST"
      })
    } catch (_) {
      // Intentionally ignore network errors; local logout still applies.
    }

    clearSession()
    renderSessionStatus()
    renderProviderStatus()
    setFeedback($("loginFeedback"), "La session a ete fermee.", "info")
  }

  function bindRequestPage() {
    $("submitAccountRequestButton")?.addEventListener("click", submitRequest)
    $("accountType")?.addEventListener("change", () => {
      refreshAttachmentResolution({ silent: false })
    })
    $("organizationName")?.addEventListener("input", () => {
      refreshAttachmentResolution({ silent: true })
    })
    $("organizationName")?.addEventListener("blur", () => {
      refreshAttachmentResolution({ silent: false })
    })
    $("emailAddress")?.addEventListener("input", () => {
      updateRequestEmailFeedback({ showSuccess: false })
      refreshAttachmentResolution({ silent: true })
    })
    $("emailAddress")?.addEventListener("blur", () => {
      updateRequestEmailFeedback({ showSuccess: true })
      refreshAttachmentResolution({ silent: false })
    })
    $("mailboxesPlanned")?.addEventListener("blur", () => {
      refreshPlannedMailboxesFeedback({ silent: false })
    })
    refreshAttachmentResolution({ silent: true })
    renderSubmittedRequest(null)
  }

  function bindAccountPage() {
    $("accountStatusButton")?.addEventListener("click", lookupAccountStatus)
    $("loginChoiceButton")?.addEventListener("click", login)
    $("forgotPasswordButton")?.addEventListener("click", forgotPassword)
    $("logoutButton")?.addEventListener("click", logout)
    $("changePasswordButton")?.addEventListener("click", changePassword)
    restoreSessionStatus()
  }

  document.addEventListener("DOMContentLoaded", () => {
    if ($("submitAccountRequestButton")) {
      bindRequestPage()
    }

    if ($("loginChoiceButton")) {
      bindAccountPage()
    }
  })
})()
