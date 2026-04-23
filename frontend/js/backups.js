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

  async function fetchBackups() {
    const response = await fetch("/api/backups")
    const result = await response.json()
    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture des sauvegardes.")
    }
    return result
  }

  function renderPaths(data) {
    const container = $("backupPathsList")
    if (!container) return

    container.innerHTML = `
      <li>Projet actif : <code>${data.projectRoot}</code></li>
      <li>Bibliothèque de snapshots : <code>${data.snapshotRoot}</code></li>
      <li>Projet BIS : <code>${data.restoreBisPath}</code></li>
      <li>LATEST : <code>${data.latestTarget || "Aucun snapshot courant"}</code></li>
    `
  }

  function renderSnapshotOptions(data) {
    const select = $("snapshotSelect")
    if (!select) return

    select.innerHTML = ""
    for (const snapshot of data.snapshots) {
      const option = document.createElement("option")
      option.value = snapshot.name
      option.textContent = `${snapshot.name} — ${snapshot.title}`
      select.appendChild(option)
    }
  }

  function renderSnapshotsList(data) {
    const summary = $("snapshotsSummary")
    const list = $("snapshotsList")
    if (!summary || !list) return

    summary.textContent = `${data.snapshots.length} snapshot(s) disponible(s).`

    if (!data.snapshots.length) {
      list.innerHTML = "<p class=\"section-note\">Aucun snapshot disponible.</p>"
      return
    }

    list.innerHTML = data.snapshots
      .slice(0, 12)
      .map((snapshot) => `
        <div class="account-summary-card">
          <p class="account-summary-title">${snapshot.title}</p>
          <p class="settings-help"><strong>Dossier :</strong> ${snapshot.name}</p>
          <p class="settings-help"><strong>Mise à jour :</strong> ${new Date(snapshot.updatedAt).toLocaleString("fr-FR")}</p>
        </div>
      `)
      .join("")
  }

  async function refreshBackupsView() {
    const data = await fetchBackups()
    renderPaths(data)
    renderSnapshotOptions(data)
    renderSnapshotsList(data)
    return data
  }

  async function createSnapshot() {
    const feedback = $("snapshotFeedback")
    const button = $("createSnapshotButton")
    const label = $("backupLabelInput")?.value?.trim() || ""

    if (!label) {
      setFeedback(feedback, "Le titre de sauvegarde est requis.", "error")
      return
    }

    button.disabled = true
    setFeedback(feedback, "Création du snapshot en cours...", "info")

    try {
      const response = await fetch("/api/backups/snapshot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label })
      })
      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Erreur de création du snapshot.")
      }

      setFeedback(feedback, `Snapshot créé : ${result.latest?.name || "OK"}`, "success")
      await refreshBackupsView()
    } catch (error) {
      setFeedback(feedback, error.message || "Échec de la création du snapshot.", "error")
    } finally {
      button.disabled = false
    }
  }

  async function restoreBis() {
    const feedback = $("restoreFeedback")
    const button = $("restoreBisButton")
    const snapshotName = $("snapshotSelect")?.value || ""
    const reuseDependencies = Boolean($("reuseNodeModulesToggle")?.checked)

    if (!snapshotName) {
      setFeedback(feedback, "Choisis un snapshot source.", "error")
      return
    }

    button.disabled = true
    setFeedback(feedback, "Restauration du projet BIS en cours...", "info")

    try {
      const response = await fetch("/api/backups/restore-bis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          snapshotName,
          reuseDependencies
        })
      })
      const result = await response.json()

      if (!response.ok || !result.ok) {
        throw new Error(result.error || "Erreur de restauration.")
      }

      const suffix = result.dependenciesReused
        ? " Les dépendances locales ont été reprises."
        : ""
      setFeedback(feedback, `Projet BIS restauré depuis ${snapshotName}.${suffix}`, "success")
    } catch (error) {
      setFeedback(feedback, error.message || "Échec de la restauration BIS.", "error")
    } finally {
      button.disabled = false
    }
  }

  function initializePage() {
    $("createSnapshotButton")?.addEventListener("click", createSnapshot)
    $("refreshSnapshotsButton")?.addEventListener("click", () => {
      refreshBackupsView().catch((error) => {
        setFeedback($("snapshotFeedback"), error.message || "Erreur de rafraîchissement.", "error")
      })
    })
    $("restoreBisButton")?.addEventListener("click", restoreBis)

    refreshBackupsView().catch((error) => {
      setFeedback($("snapshotFeedback"), error.message || "Erreur de chargement.", "error")
      setFeedback($("restoreFeedback"), error.message || "Erreur de chargement.", "error")
    })
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initializePage)
  } else {
    initializePage()
  }
})()
