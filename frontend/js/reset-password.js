(() => {
  function $(id) {
    return document.getElementById(id)
  }

  function setFeedback(element, message, tone = "info") {
    if (!element) return
    element.textContent = message
    element.classList.remove("is-info", "is-success", "is-error")
    element.classList.add("form-feedback", `is-${tone}`)
  }

  async function resetPassword() {
    const feedback = $("resetPasswordFeedback")
    const token = new URLSearchParams(window.location.search).get("token") || ""
    const newPassword = $("resetPassword")?.value || ""
    const confirmPassword = $("resetPasswordConfirm")?.value || ""

    if (!token) {
      setFeedback(feedback, "Lien de reinitialisation invalide ou incomplet.", "error")
      return
    }

    if (!newPassword || !confirmPassword) {
      setFeedback(feedback, "Renseignez les deux champs du nouveau mot de passe.", "error")
      return
    }

    if (newPassword.length < 10) {
      setFeedback(feedback, "Le nouveau mot de passe doit contenir au moins 10 caracteres.", "error")
      return
    }

    if (newPassword !== confirmPassword) {
      setFeedback(feedback, "La confirmation du mot de passe ne correspond pas.", "error")
      return
    }

    setFeedback(feedback, "Reinitialisation du mot de passe en cours...", "info")

    try {
      const response = await fetch("/api/account/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          newPassword
        })
      })

      const result = await response.json()
      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Erreur lors de la reinitialisation du mot de passe.")
      }

      $("resetPassword").value = ""
      $("resetPasswordConfirm").value = ""
      setFeedback(feedback, "Mot de passe reinitialise. Vous pouvez maintenant revenir a la page Compte et vous connecter.", "success")
    } catch (error) {
      setFeedback(feedback, error.message || "Erreur lors de la reinitialisation du mot de passe.", "error")
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("resetPasswordButton")?.addEventListener("click", resetPassword)
  })
})()
