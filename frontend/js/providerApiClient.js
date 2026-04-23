(() => {
  async function parseResponse(response, fallbackMessage) {
    const result = await response.json().catch(() => ({}))
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || fallbackMessage)
    }
    return result
  }

  async function fetchPreferences() {
    const response = await fetch("/api/account/preferences")
    return parseResponse(response, "Erreur de lecture des préférences.")
  }

  async function savePreferences(payload) {
    const response = await fetch("/api/account/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    return parseResponse(response, "Erreur d'enregistrement des préférences.")
  }

  async function fetchProviderAccounts() {
    const response = await fetch("/api/account/providers")
    return parseResponse(response, "Erreur de lecture des fournisseurs API.")
  }

  async function createProvider(payload) {
    const response = await fetch("/api/account/providers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    return parseResponse(response, "Erreur de création du fournisseur API.")
  }

  async function updateProvider(providerId, payload) {
    const response = await fetch(`/api/account/providers/${encodeURIComponent(providerId)}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
    return parseResponse(response, "Erreur de mise à jour du fournisseur API.")
  }

  async function deleteProvider(providerId) {
    const response = await fetch(`/api/account/providers/${encodeURIComponent(providerId)}`, {
      method: "DELETE"
    })
    return parseResponse(response, "Erreur de désactivation du fournisseur API.")
  }

  async function testProvider(providerId) {
    const response = await fetch(`/api/account/providers/${encodeURIComponent(providerId)}/test`, {
      method: "POST"
    })
    return parseResponse(response, "Erreur de test du fournisseur API.")
  }

  async function fetchUsageSummary() {
    const response = await fetch("/api/account/usage-summary?period=this_month")
    return parseResponse(response, "Erreur de lecture du résumé d'usage.")
  }

  window.ProviderApiClient = {
    fetchPreferences,
    savePreferences,
    fetchProviderAccounts,
    createProvider,
    updateProvider,
    deleteProvider,
    testProvider,
    fetchUsageSummary
  }
})()
