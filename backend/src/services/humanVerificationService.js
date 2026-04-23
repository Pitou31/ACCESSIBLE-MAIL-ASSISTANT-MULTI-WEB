function normalizeTrapValue(value) {
  return String(value || "").trim()
}

function normalizeBoolean(value) {
  return value === true || value === "true"
}

function getHumanVerificationProvider() {
  return String(process.env.HUMAN_VERIFICATION_PROVIDER || "local").trim().toLowerCase()
}

function getTurnstileToken(payload = {}) {
  return String(
    payload.turnstileToken ||
    payload.cfTurnstileResponse ||
    payload["cf-turnstile-response"] ||
    ""
  ).trim()
}

async function verifyTurnstileToken(token, remoteIp = "") {
  const secret = String(process.env.TURNSTILE_SECRET_KEY || "").trim()

  if (!secret) {
    return {
      ok: false,
      code: "turnstile_not_configured",
      message: "Vérification humaine Turnstile non configurée."
    }
  }

  if (!token) {
    return {
      ok: false,
      code: "turnstile_token_missing",
      message: "Merci de valider le contrôle humain."
    }
  }

  const body = new URLSearchParams()
  body.set("secret", secret)
  body.set("response", token)
  if (remoteIp) {
    body.set("remoteip", remoteIp)
  }

  const response = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  })
  const result = await response.json()

  return result.success
    ? { ok: true, code: "valid", message: "" }
    : {
        ok: false,
        code: "turnstile_rejected",
        message: "Vérification humaine refusée.",
        details: result["error-codes"] || []
      }
}

function validateLocalHumanVerification(payload = {}) {
  if (normalizeTrapValue(payload.humanTrap)) {
    return {
      ok: false,
      code: "bot_detected",
      message: "Vérification humaine invalide."
    }
  }

  if (!normalizeBoolean(payload.humanConfirmed)) {
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

async function validateHumanVerification(payload = {}, options = {}) {
  const trapValidation = validateLocalHumanVerification({
    humanConfirmed: true,
    humanTrap: payload.humanTrap
  })
  if (!trapValidation.ok) {
    return trapValidation
  }

  const provider = getHumanVerificationProvider()
  if (provider === "turnstile") {
    return verifyTurnstileToken(getTurnstileToken(payload), options.remoteIp)
  }

  return validateLocalHumanVerification(payload)
}

module.exports = {
  getHumanVerificationProvider,
  validateHumanVerification
}
