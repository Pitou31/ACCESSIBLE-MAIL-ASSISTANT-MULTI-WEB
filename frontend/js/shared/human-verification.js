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

  async function fetchHumanVerificationConfig() {
    try {
      const response = await fetch("/api/human-verification/config", {
        cache: "no-store",
        credentials: "same-origin"
      })
      const result = await response.json()
      return response.ok && result.ok ? result : { provider: "local", turnstileSiteKey: "" }
    } catch (_) {
      return { provider: "local", turnstileSiteKey: "" }
    }
  }

  function loadTurnstileScript() {
    if (window.turnstile) {
      return Promise.resolve()
    }

    return new Promise((resolve, reject) => {
      const existing = document.querySelector("script[data-turnstile-api]")
      if (existing) {
        existing.addEventListener("load", () => resolve(), { once: true })
        existing.addEventListener("error", () => reject(new Error("Turnstile indisponible.")), { once: true })
        return
      }

      const script = document.createElement("script")
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
      script.async = true
      script.defer = true
      script.dataset.turnstileApi = "1"
      script.addEventListener("load", () => resolve(), { once: true })
      script.addEventListener("error", () => reject(new Error("Turnstile indisponible.")), { once: true })
      document.head.appendChild(script)
    })
  }

  function hideLocalConfirmation(checkboxId) {
    const checkbox = document.getElementById(checkboxId)
    const wrapper = checkbox?.closest("label")
    if (wrapper) {
      wrapper.hidden = true
    }
  }

  function markConfirmed(checkboxId, confirmed) {
    const checkbox = document.getElementById(checkboxId)
    if (checkbox) {
      checkbox.checked = Boolean(confirmed)
    }
  }

  async function setupTurnstileWidgets() {
    const containers = Array.from(document.querySelectorAll("[data-turnstile-target]"))
    if (!containers.length) {
      return
    }

    const config = await fetchHumanVerificationConfig()
    if (config.provider !== "turnstile" || !config.turnstileSiteKey) {
      return
    }

    await loadTurnstileScript()

    containers.forEach((container) => {
      const targetId = container.dataset.turnstileTarget || ""
      const checkboxId = container.dataset.turnstileCheckbox || ""
      const tokenInput = document.getElementById(targetId)
      if (!tokenInput || container.dataset.turnstileRendered === "1") {
        return
      }

      hideLocalConfirmation(checkboxId)
      window.turnstile.render(container, {
        sitekey: config.turnstileSiteKey,
        callback: (token) => {
          tokenInput.value = token || ""
          markConfirmed(checkboxId, Boolean(token))
        },
        "expired-callback": () => {
          tokenInput.value = ""
          markConfirmed(checkboxId, false)
        },
        "error-callback": () => {
          tokenInput.value = ""
          markConfirmed(checkboxId, false)
        }
      })
      container.dataset.turnstileRendered = "1"
    })
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        setupTurnstileWidgets().catch(() => {})
      }, { once: true })
    } else {
      setupTurnstileWidgets().catch(() => {})
    }
  }

  return {
    validateHumanVerification,
    setupTurnstileWidgets
  }
})
