(() => {
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

  function setFeedback(message, tone = "info") {
    const element = $("adminDbFeedback")
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  function getPayload() {
    return {
      firstName: $("secondaryAdminFirstName")?.value.trim() || "",
      lastName: $("secondaryAdminLastName")?.value.trim() || "",
      email: $("secondaryAdminEmail")?.value.trim().toLowerCase() || "",
      phone: $("secondaryAdminPhone")?.value.trim() || "",
      organizationName: $("secondaryAdminOrganizationName")?.value.trim() || "",
      password: $("secondaryAdminPassword")?.value || "",
      motivation: $("secondaryAdminMotivation")?.value.trim() || "",
      consent: Boolean($("secondaryAdminConsent")?.checked),
      humanConfirmed: Boolean($("secondaryAdminHumanConfirmation")?.checked),
      humanTrap: $("secondaryAdminWebsite")?.value || "",
      turnstileToken: $("secondaryAdminTurnstileToken")?.value || ""
    }
  }

  function clearForm() {
    const ids = [
      "secondaryAdminFirstName",
      "secondaryAdminLastName",
      "secondaryAdminEmail",
      "secondaryAdminPhone",
      "secondaryAdminOrganizationName",
      "secondaryAdminPassword",
      "secondaryAdminMotivation",
      "secondaryAdminWebsite",
      "secondaryAdminTurnstileToken"
    ]

    ids.forEach((id) => {
      const element = $(id)
      if (element) element.value = ""
    })

    if ($("secondaryAdminConsent")) $("secondaryAdminConsent").checked = false
    if ($("secondaryAdminHumanConfirmation")) $("secondaryAdminHumanConfirmation").checked = false
  }

  async function createAdminRequest() {
    const button = $("createSecondaryAdminButton")
    if (!button) return
    const payload = getPayload()
    const emailInput = $("secondaryAdminEmail")
    const humanValidation = validateHumanVerification({
      confirmed: payload.humanConfirmed,
      trapValue: payload.humanTrap
    })

    if (emailInput && !emailInput.checkValidity()) {
      setFeedback("Adresse mail invalide.", "error")
      emailInput.reportValidity()
      return
    }

    if (!humanValidation.ok) {
      setFeedback(humanValidation.message || "Vérification humaine invalide.", "error")
      return
    }

    button.disabled = true
    setFeedback("Envoi de la demande administrateur...", "info")

    try {
      const response = await fetch("/api/admin/request", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        credentials: "same-origin",
        body: JSON.stringify(payload)
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        const details = Array.isArray(result.details) && result.details.length > 0
          ? ` ${result.details.join(" ")}`
          : ""
        throw new Error(`${result.error || "Erreur de demande de compte administrateur."}${details}`)
      }

      const submittedEmail = result.request?.email || payload.email
      const identityLabel = buildPersonTitle({
        firstName: result.request?.firstName || result.request?.first_name || payload.firstName,
        lastName: result.request?.lastName || result.request?.last_name || payload.lastName,
        email: submittedEmail
      })
      clearForm()
      setFeedback(`Demande envoyée à l’administrateur compétent pour ${identityLabel} (${maskEmail(submittedEmail)}).`, "success")
    } catch (error) {
      setFeedback(error.message || "Erreur de demande de compte administrateur.", "error")
    } finally {
      button.disabled = false
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("createSecondaryAdminButton")?.addEventListener("click", createAdminRequest)
  })
})()
