(function (root, factory) {
  root.MailHumanVerification = factory()
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function normalizeTrapValue(value) {
    return String(value || "").trim()
  }

  function normalizeBoolean(value) {
    return value === true || value === "true"
  }

  function validateHumanVerification(payload = {}) {
    const confirmed = payload.confirmed ?? payload.humanConfirmed ?? false
    const trapValue = payload.trapValue ?? payload.humanTrap ?? ""

    if (normalizeTrapValue(trapValue)) {
      return {
        ok: false,
        code: "bot_detected",
        message: "Vérification humaine invalide."
      }
    }

    if (!normalizeBoolean(confirmed)) {
      return {
        ok: false,
        code: "not_confirmed",
        message: "Merci de confirmer que vous êtes un humain."
      }
    }

    return {
      ok: true,
      code: "valid",
      message: ""
    }
  }

  return {
    validateHumanVerification
  }
})
