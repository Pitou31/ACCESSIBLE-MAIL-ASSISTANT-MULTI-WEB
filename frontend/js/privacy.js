(() => {
const SESSION_KEY = "mail-assistant-session"

function $(id) {
  return document.getElementById(id)
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
  } catch (_) {
    return null
  }
}

function setFeedback(message, type = "info") {
  const feedback = $("privacyExportFeedback")
  if (!feedback) return

  feedback.textContent = message
  feedback.classList.remove("is-info", "is-success", "is-error")
  feedback.classList.add(`is-${type}`)
}

function setRequestFeedback(message, type = "info") {
  const feedback = $("privacyRequestFeedback")
  if (!feedback) return

  feedback.textContent = message
  feedback.classList.remove("is-info", "is-success", "is-error")
  feedback.classList.add(`is-${type}`)
}

function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json;charset=utf-8"
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

async function exportPrivacyData() {
  const button = $("privacyExportButton")
  if (!button) return

  button.disabled = true
  setFeedback("Export RGPD en cours...", "info")

  try {
    const response = await fetch("/api/account/privacy-export")
    const result = await response.json()

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Export indisponible.")
    }

    const date = new Date().toISOString().slice(0, 10)
    const accountId = result.account?.id || "compte"
    downloadJson(`donnees-rgpd-${accountId}-${date}.json`, result)
    setFeedback("Export RGPD téléchargé. Les secrets ne sont pas inclus en clair.", "success")
  } catch (error) {
    setFeedback(error.message || "Impossible d'exporter les données RGPD.", "error")
  } finally {
    button.disabled = false
  }
}

async function copyPrivacyRequestTemplate() {
  const session = getSession()
  const accountId = session?.userId || session?.accountId || "mon compte"
  const request = [
    "Bonjour,",
    "",
    "Je souhaite exercer mes droits RGPD concernant mon compte Mail Care.",
    "",
    `Compte concerné : ${accountId}`,
    "Demande : accès / rectification / suppression / limitation",
    "Précision de ma demande :",
    "",
    "Merci de me confirmer la bonne réception de cette demande et les suites données.",
    "",
    "Cordialement"
  ].join("\n")

  try {
    await navigator.clipboard.writeText(request)
    setRequestFeedback("Modèle de demande RGPD copié dans le presse-papiers.", "success")
  } catch (error) {
    setRequestFeedback("Impossible de copier automatiquement. Vous pouvez rédiger la demande manuellement à partir du texte proposé.", "error")
  }
}

function initialize() {
  const button = $("privacyExportButton")
  const copyButton = $("privacyCopyRequestButton")
  const session = getSession()

  if (session?.userId || session?.accountId) {
    setFeedback("Vous pouvez exporter les données du compte actuellement connecté.", "info")
    setRequestFeedback("Vous pouvez copier un modèle de demande RGPD prêt à compléter.", "info")
  }

  button?.addEventListener("click", exportPrivacyData)
  copyButton?.addEventListener("click", copyPrivacyRequestTemplate)
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initialize)
} else {
  initialize()
}
})()
