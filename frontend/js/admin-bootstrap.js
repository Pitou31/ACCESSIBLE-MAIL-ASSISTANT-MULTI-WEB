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

  function setFeedback(element, message, tone = "info") {
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  function clearBootstrapForm() {
    const ids = [
      "adminFirstName",
      "adminLastName",
      "adminEmail",
      "adminPhone",
      "adminOrganizationName",
      "adminPassword",
      "adminWebsite"
    ]

    ids.forEach((id) => {
      const element = $(id)
      if (element) {
        element.value = ""
      }
    })

    const humanCheckbox = $("adminHumanConfirmation")
    if (humanCheckbox) {
      humanCheckbox.checked = false
    }
  }

  async function createPrimaryAdmin() {
    const feedback = $("adminBootstrapFeedback")
    const summary = $("adminBootstrapSummary")
    const button = $("createAdminButton")

    const payload = {
      firstName: $("adminFirstName")?.value.trim() || "",
      lastName: $("adminLastName")?.value.trim() || "",
      email: $("adminEmail")?.value.trim().toLowerCase() || "",
      phone: $("adminPhone")?.value.trim() || "",
      organizationName: $("adminOrganizationName")?.value.trim() || "",
      password: $("adminPassword")?.value || "",
      humanConfirmed: Boolean($("adminHumanConfirmation")?.checked),
      humanTrap: $("adminWebsite")?.value || "",
      turnstileToken: $("adminTurnstileToken")?.value || ""
    }

    const emailInput = $("adminEmail")
    if (emailInput && !emailInput.checkValidity()) {
      setFeedback(feedback, "Adresse mail invalide.", "error")
      emailInput.reportValidity()
      return
    }

    const humanValidation = validateHumanVerification({
      confirmed: payload.humanConfirmed,
      trapValue: payload.humanTrap
    })
    if (!humanValidation.ok) {
      setFeedback(feedback, humanValidation.message || "Vérification humaine invalide.", "error")
      return
    }

    button.disabled = true
    setFeedback(feedback, "Création du compte administrateur principal en cours...", "info")

    try {
      const response = await fetch("/api/admin/bootstrap", {
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
        throw new Error(`${result.error || "Erreur de création."}${details}`)
      }

      const identityLabel = buildPersonTitle({
        firstName: result.admin.firstName,
        lastName: result.admin.lastName,
        email: result.admin.email
      })

      setFeedback(feedback, `Compte administrateur principal créé pour ${maskEmail(result.admin.email)}.`, "success")
      clearBootstrapForm()
      summary.innerHTML = `
        <p class="account-summary-title">${identityLabel}</p>
        <p class="settings-help"><strong>Contexte :</strong> Administrateur principal créé</p>
        <p class="settings-help"><strong>Email :</strong> ${maskEmail(result.admin.email)}</p>
        <p class="settings-help"><strong>Organisation :</strong> ${result.admin.organizationName || "Non renseignée"}</p>
        <p class="settings-help"><strong>Rôle :</strong> ${result.admin.role}</p>
        <p class="settings-help"><strong>Statut :</strong> ${result.admin.status}</p>
      `
    } catch (error) {
      setFeedback(feedback, error.message || "Erreur de création du compte administrateur principal.", "error")
    } finally {
      button.disabled = false
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("createAdminButton")?.addEventListener("click", createPrimaryAdmin)
  })
})()
