;(function attachDictionaryEditor(globalScope) {
  const seedWords = [
    "a", "aide", "ajout", "algorithme", "analyse", "analyser", "analytique", "apercu", "application", "appliquer",
    "architecture", "artificielle", "audio", "automatique", "automatiquement", "autre", "avant", "base", "bascule", "besoin",
    "bloc", "bonjour", "bord", "bouton", "branche", "brique", "cadre", "campagne", "canal", "candidat",
    "capture", "carte", "cave", "cause", "causer", "centre", "choix", "clique", "complet", "complete",
    "composant", "configuration", "contenu", "contexte", "correction", "curseur", "dictionnaire", "document", "edition", "element",
    "entree", "export", "fichier", "filtre", "fonction", "galerie", "generale", "generation", "image", "images",
    "input", "inputs", "insertion", "intelligence", "interface", "lecture", "liste", "logique", "modal", "modele",
    "mot", "navigation", "operateur", "output", "parametre", "popup", "positionnement", "presentation", "previsualisation", "processus",
    "profil", "proposition", "recherche", "reformulation", "resultat", "resume", "scroll", "selection", "selon", "sequence",
    "solution", "source", "statut", "strategie", "structure", "suggestion", "support", "texte", "traduction", "transcription",
    "transformateur", "type", "video", "vision", "zone", "a priori", "aidee", "abeille", "abeilles", "abri",
    "abriter", "acces", "accessible", "accueil", "action", "acteur", "adapter", "adaptation", "adapte", "adresse",
    "affichage", "afficher", "ajouter", "ajuste", "alignement", "alphabetique", "amelioration", "ameliorer", "ancre", "annotation",
    "article", "assistant", "automatisation", "automatisable", "bibliotheque", "caractere", "champ", "clavier", "composition", "controle",
    "courant", "deplacement", "deroulant", "edition-guidee", "enrichissement", "equivalent", "filtrage", "frappe", "grammaire", "guide",
    "indexation", "inference", "insertion-guidee", "liste-complete", "mot-cle", "mot-courant", "ordonnancement", "ponctuation", "popup-editeur",
    "reduction", "remplacement", "reordonner", "repositionnement", "selection-guidee", "token", "vocabulaire", "à", "à-propos"
  ]

  const punctuationDictionary = ["'", ",", ".", ";", ":", "?", "!", "-", "(", ")", '"']

  let modal = null
  let surface = null
  let originalTextNode = null
  let wordInput = null
  let dictionaryList = null
  let dictionaryCount = null
  let editorStatus = null
  let currentTokenPreview = null
  let titleNode = null
  let selectedTarget = { mode: "replace", index: -1 }
  let selectedRange = null
  let selectedDictionaryWord = ""
  let dragTokenIndex = -1
  let dictionaryWords = []
  let hasTypedSinceSelection = false
  let currentTokens = []
  let initialTokens = []
  let saveCallback = null
  let cancelCallback = null
  let currentLanguage = "fr"

  function ensureModal() {
    if (modal) return

    const wrapper = document.createElement("div")
    wrapper.innerHTML = `
      <div id="dictionaryEditorModal" class="dictionary-editor-modal" aria-hidden="true">
        <div class="dictionary-editor-dialog">
          <div class="dictionary-editor-head">
            <div>
              <h2 id="dictionaryEditorTitle">Edition guidee</h2>
              <p>Le texte initial reste visible. On clique sur un mot, on filtre le dictionnaire complet, puis on valide explicitement le choix.</p>
            </div>
            <button id="dictionaryEditorClose" class="dictionary-editor-btn dictionary-editor-btn-ghost" type="button">Fermer</button>
          </div>
          <div class="dictionary-editor-grid">
            <section class="dictionary-editor-panel">
              <h3>Contenu initial</h3>
              <div id="dictionaryEditorOriginal" class="dictionary-editor-original"></div>
              <h3 style="margin-top:14px;">Texte en cours d'edition</h3>
              <div id="dictionaryEditorSurface" class="dictionary-editor-surface"></div>
            </section>
            <section class="dictionary-editor-panel">
              <div class="dictionary-editor-row">
                <label for="dictionaryEditorInput">Mot ou signe courant</label>
                <input id="dictionaryEditorInput" type="text" autocomplete="off" spellcheck="false" placeholder="Tape ici pour filtrer le dictionnaire">
              </div>
              <div class="dictionary-editor-row">
                <label>Token actuellement cible</label>
                <div id="dictionaryEditorCurrent" class="dictionary-editor-footnote">Aucun token cible.</div>
              </div>
              <div class="dictionary-editor-row">
                <label>Etat courant</label>
                <div id="dictionaryEditorStatus" class="dictionary-editor-footnote">Aucun token selectionne.</div>
              </div>
              <div class="dictionary-editor-toolbar">
                <button id="dictionaryEditorSelectAll" class="dictionary-editor-btn dictionary-editor-btn-ghost" type="button">Selectionner toute la phrase</button>
                <button id="dictionaryEditorNext" class="dictionary-editor-btn dictionary-editor-btn-ghost" type="button">Mot suivant</button>
              </div>
              <div class="dictionary-editor-shell">
                <div class="dictionary-editor-shell-head">
                  <strong>Dictionnaire complet</strong>
                  <span id="dictionaryEditorCount">0 entree</span>
                </div>
                <div id="dictionaryEditorList" class="dictionary-editor-list"></div>
              </div>
            </section>
          </div>
          <div class="dictionary-editor-actions">
            <div class="dictionary-editor-actions-left">
              <button id="dictionaryEditorApply" class="dictionary-editor-btn dictionary-editor-btn-secondary" type="button">Valider le mot choisi</button>
              <button id="dictionaryEditorDelete" class="dictionary-editor-btn dictionary-editor-btn-ghost" type="button">Supprimer la selection</button>
              <button id="dictionaryEditorClear" class="dictionary-editor-btn dictionary-editor-btn-ghost" type="button">Effacer le filtre</button>
            </div>
            <div class="dictionary-editor-actions-right">
              <button id="dictionaryEditorFinish" class="dictionary-editor-btn dictionary-editor-btn-primary" type="button">Fin de l'edition</button>
            </div>
          </div>
        </div>
      </div>
    `
    document.body.appendChild(wrapper.firstElementChild)

    modal = document.getElementById("dictionaryEditorModal")
    surface = document.getElementById("dictionaryEditorSurface")
    originalTextNode = document.getElementById("dictionaryEditorOriginal")
    wordInput = document.getElementById("dictionaryEditorInput")
    dictionaryList = document.getElementById("dictionaryEditorList")
    dictionaryCount = document.getElementById("dictionaryEditorCount")
    editorStatus = document.getElementById("dictionaryEditorStatus")
    currentTokenPreview = document.getElementById("dictionaryEditorCurrent")
    titleNode = document.getElementById("dictionaryEditorTitle")

    document.getElementById("dictionaryEditorClose").addEventListener("click", close)
    document.getElementById("dictionaryEditorApply").addEventListener("click", applySelectedWord)
    document.getElementById("dictionaryEditorClear").addEventListener("click", () => {
      wordInput.value = ""
      selectedDictionaryWord = ""
      hasTypedSinceSelection = false
      renderDictionary()
      updateStatus()
      wordInput.focus()
    })
    document.getElementById("dictionaryEditorDelete").addEventListener("click", deleteSelection)
    document.getElementById("dictionaryEditorSelectAll").addEventListener("click", selectAllTokens)
    document.getElementById("dictionaryEditorNext").addEventListener("click", selectNextToken)
    document.getElementById("dictionaryEditorFinish").addEventListener("click", finishEditing)
    wordInput.addEventListener("input", () => {
      selectedDictionaryWord = ""
      hasTypedSinceSelection = true
      renderDictionary()
      updateStatus()
    })
    modal.addEventListener("click", (event) => {
      if (event.target === modal) close()
    })
  }

  function normalizeForSearch(value) {
    return String(value || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
  }

  function normalizeLoose(value) {
    return normalizeForSearch(value).replace(/[\s'’_-]+/g, "")
  }

  function tokenizeText(text) {
    const tokens = []
    const source = String(text || "")
    const matches = source.match(/\r\n|\n|[ \t]+|[A-Za-zÀ-ÿ0-9]+|[^\sA-Za-zÀ-ÿ0-9]/g) || []
    matches.forEach((part) => {
      if (part === "\r\n" || part === "\n") {
        tokens.push({ type: "newline", value: "\n" })
      } else if (/^[ \t]+$/.test(part)) {
        tokens.push({ type: "space", value: " " })
      } else if (/^[A-Za-zÀ-ÿ0-9]+$/.test(part)) {
        tokens.push({ type: "word", value: part })
      } else {
        tokens.push({ type: "punct", value: part })
      }
    })
    return tokens
  }

  function cloneTokens(tokens) {
    return tokens.map((token) => ({ ...token }))
  }

  function editableEntries() {
    const entries = []
    currentTokens.forEach((token, index) => {
      if (token.type === "word" || token.type === "punct") {
        entries.push({ token, index })
      }
    })
    return entries
  }

  function entryCount() {
    return editableEntries().length
  }

  function entryIndexToTokenIndex(entryIndex) {
    const entry = editableEntries()[entryIndex]
    return entry ? entry.index : currentTokens.length
  }

  function tokenIndexToEntryIndex(tokenIndex) {
    return editableEntries().findIndex((entry) => entry.index === tokenIndex)
  }

  function rebuildText() {
    let out = ""
    currentTokens.forEach((token, index) => {
      const previous = index > 0 ? currentTokens[index - 1] : null
      if (token.type === "newline") {
        out = out.replace(/[ \t]+$/g, "")
        out += "\n"
        return
      }
      if (token.type === "space") {
        if (out && !out.endsWith("\n") && !out.endsWith(" ")) {
          out += " "
        }
        return
      }
      if (token.type === "word") {
        const prevValue = previous?.value || ""
        const shouldPrefixSpace = Boolean(out)
          && !out.endsWith("\n")
          && !out.endsWith(" ")
          && prevValue !== "'"
          && prevValue !== "’"
          && prevValue !== "-"
          && prevValue !== "("
          && prevValue !== '"'
        if (shouldPrefixSpace) out += " "
        out += token.value
        return
      }
      if (token.type === "punct") {
        const needsSpaceBefore = token.value === "(" || token.value === '"'
        if (needsSpaceBefore && out && !out.endsWith(" ") && !out.endsWith("\n")) {
          out += " "
        }
        out += token.value
        if ([":", ";", "?", "!"].includes(token.value)) {
          out += " "
        }
      }
    })
    return out.replace(/[ \t]+\n/g, "\n").replace(/[ ]{2,}/g, " ").trim()
  }

  function buildDictionary() {
    const unique = new Map()
    const push = (word) => {
      const raw = String(word || "").trim()
      if (!raw) return
      const key = normalizeForSearch(raw)
      if (!key) return
      if (!unique.has(key)) unique.set(key, raw)
    }
    seedWords.forEach(push)
    const predictiveWords = globalScope.PredictiveDictionary?.getWords(currentLanguage) || []
    predictiveWords.forEach(push)
    currentTokens.forEach((token) => {
      if (token.type === "word") push(token.value)
    })
    dictionaryWords = Array.from(unique.values()).sort((a, b) => a.localeCompare(b, currentLanguage || "fr", { sensitivity: "base" }))
  }

  function currentFilterFragment(value) {
    const raw = String(value || "")
    if (!raw.trim()) return ""
    const parts = raw.trim().split(/\s+/)
    return parts[parts.length - 1] || ""
  }

  function renderOriginalText() {
    originalTextNode.textContent = initialTokens.map((token) => token.value).join("")
  }

  function buildInsertionSlot(entryIndex) {
    const slot = document.createElement("span")
    slot.className = `dictionary-editor-slot${selectedTarget.mode === "insert" && selectedTarget.index === entryIndex ? " active" : ""}`
    slot.title = "Inserer ici"
    slot.addEventListener("click", () => setActiveTarget("insert", entryIndex))
    slot.addEventListener("dragover", (event) => {
      event.preventDefault()
      slot.classList.add("drop-target")
    })
    slot.addEventListener("dragleave", () => slot.classList.remove("drop-target"))
    slot.addEventListener("drop", (event) => {
      event.preventDefault()
      slot.classList.remove("drop-target")
      if (dragTokenIndex < 0) return
      moveToken(dragTokenIndex, entryIndex)
    })
    return slot
  }

  function buildToken(entryIndex, entry) {
    const tokenIndex = entry.index
    const token = entry.token
    const active = selectedTarget.mode === "replace" && selectedTarget.index === entryIndex
    const inRange = selectedRange && entryIndex >= selectedRange.start && entryIndex <= selectedRange.end
    const span = document.createElement("span")
    span.className = `dictionary-editor-token ${token.type}${active || inRange ? " active" : ""}`
    span.textContent = token.value
    span.draggable = true
    span.addEventListener("click", (event) => {
      if (event.shiftKey && selectedTarget.index >= 0) {
        const start = Math.min(selectedTarget.index, entryIndex)
        const end = Math.max(selectedTarget.index, entryIndex)
        selectedRange = { start, end }
        selectedTarget = { mode: "replace", index: entryIndex }
        selectedDictionaryWord = ""
        hasTypedSinceSelection = false
        const rangeText = editableEntries().slice(start, end + 1).map((item) => item.token.value).join(" ")
        wordInput.value = rangeText
        currentTokenPreview.textContent = `Selection multiple: ${start}-${end}`
        renderEditorSurface()
        renderDictionary()
        updateStatus()
        return
      }
      const isSameActiveToken = !selectedRange
        && selectedTarget.mode === "replace"
        && selectedTarget.index === entryIndex
      if (isSameActiveToken) {
        clearActiveTarget()
        return
      }
      setActiveTarget("replace", entryIndex)
    })
    span.addEventListener("dragstart", () => {
      dragTokenIndex = entryIndex
      span.classList.add("dragging")
    })
    span.addEventListener("dragend", () => {
      dragTokenIndex = -1
      span.classList.remove("dragging")
    })
    return span
  }

  function renderEditorSurface() {
    surface.innerHTML = ""
    const entries = editableEntries()
    for (let index = 0; index <= entries.length; index += 1) {
      surface.appendChild(buildInsertionSlot(index))
      if (index < entries.length) {
        surface.appendChild(buildToken(index, entries[index]))
      }
    }
  }

  function clearActiveTarget() {
    selectedTarget = { mode: "replace", index: -1 }
    selectedRange = null
    selectedDictionaryWord = ""
    hasTypedSinceSelection = false
    wordInput.placeholder = "Tape ici pour filtrer le dictionnaire"
    wordInput.value = ""
    renderEditorSurface()
    renderDictionary()
    updateStatus()
    wordInput.blur()
  }

  function setActiveTarget(mode, index) {
    selectedTarget = { mode, index }
    selectedRange = null
    selectedDictionaryWord = ""
    hasTypedSinceSelection = false
    const entry = editableEntries()[index]
    const token = entry?.token
    wordInput.placeholder = mode === "insert"
      ? "Tape pour inserer un mot ou une ponctuation"
      : "Tape ici pour remplacer le token courant"
    wordInput.value = mode === "replace" && token ? token.value : ""
    currentTokenPreview.textContent = mode === "replace" && token
      ? `Token actuel: ${token.value}`
      : `Insertion a la position ${index}`
    renderEditorSurface()
    renderDictionary()
    updateStatus()
    wordInput.focus()
    wordInput.select()
  }

  function updateStatus() {
    if (selectedTarget.index < 0) {
      editorStatus.textContent = "Aucun token selectionne. Clique d'abord sur un mot, une apostrophe, une ponctuation ou une zone d'insertion."
      currentTokenPreview.textContent = "Aucun token cible."
      return
    }
    if (selectedRange) {
      const selectedItems = editableEntries().slice(selectedRange.start, selectedRange.end + 1)
      const rangeText = selectedItems.map((item) => item.token.value).join(" ")
      const selectedInfo = selectedDictionaryWord ? ` | candidat retenu: ${selectedDictionaryWord}` : ""
      editorStatus.textContent = `Selection multiple: ${rangeText}${selectedInfo}`
      return
    }
    if (selectedTarget.mode === "insert") {
      const selectedInfo = selectedDictionaryWord ? ` | candidat retenu: ${selectedDictionaryWord}` : ""
      editorStatus.textContent = `Insertion preparee a la position ${selectedTarget.index}${selectedInfo}`
      return
    }
    const entry = editableEntries()[selectedTarget.index]
    const currentWord = entry?.token?.value || ""
    const selectedInfo = selectedDictionaryWord ? ` | candidat retenu: ${selectedDictionaryWord}` : ""
    editorStatus.textContent = `Token cible: ${currentWord} | index ${selectedTarget.index}${selectedInfo}`
  }

  function renderDictionary() {
    const fragment = currentFilterFragment(wordInput.value)
    const filter = hasTypedSinceSelection ? normalizeForSearch(fragment) : ""
    const looseFilter = hasTypedSinceSelection ? normalizeLoose(fragment) : ""
    const entry = editableEntries()[selectedTarget.index]
    const targetToken = entry?.token
    const pool = selectedTarget.mode === "insert"
      ? Array.from(new Set([...dictionaryWords, ...punctuationDictionary])).sort((a, b) => a.localeCompare(b, currentLanguage || "fr", { sensitivity: "base" }))
      : targetToken && targetToken.type === "punct"
        ? punctuationDictionary
        : dictionaryWords
    const filtered = pool.filter((word) => {
      if (!filter) return true
      const normalizedWord = normalizeForSearch(word)
      const looseWord = normalizeLoose(word)
      return normalizedWord.startsWith(filter) || (looseFilter && looseWord.startsWith(looseFilter))
    })
    const visibleWords = filtered.length ? filtered : pool
    dictionaryCount.textContent = filter
      ? filtered.length
        ? `${filtered.length} candidat${filtered.length > 1 ? "s" : ""} sur ${pool.length} pour "${fragment}"`
        : `0 candidat pour "${fragment}" - affichage complet maintenu (${pool.length} entrees)`
      : `${pool.length} entrees chargees`
    dictionaryList.innerHTML = ""

    visibleWords.forEach((word) => {
      const button = document.createElement("button")
      button.type = "button"
      button.className = `dictionary-editor-item${word === selectedDictionaryWord ? " focused" : ""}`
      button.textContent = word
      button.addEventListener("click", () => {
        selectedDictionaryWord = word
        wordInput.value = word
        hasTypedSinceSelection = false
        renderDictionary()
        updateStatus()
      })
      dictionaryList.appendChild(button)
    })
  }

  function applySelectedWord() {
    if (selectedTarget.index < 0) return
    const nextWord = selectedDictionaryWord || wordInput.value.trim()
    if (!nextWord) return
    const nextType = punctuationDictionary.includes(nextWord) ? "punct" : "word"
    const nextToken = { type: nextType, value: nextWord }

    if (selectedRange) {
      const entries = editableEntries()
      const startTokenIndex = entries[selectedRange.start]?.index ?? 0
      const endTokenIndex = entries[selectedRange.end]?.index ?? startTokenIndex
      currentTokens.splice(startTokenIndex, endTokenIndex - startTokenIndex + 1, nextToken)
      selectedTarget = { mode: "replace", index: selectedRange.start }
      selectedRange = null
      hasTypedSinceSelection = false
      buildDictionary()
      renderEditorSurface()
      wordInput.value = nextWord
      updateStatus()
      renderDictionary()
      return
    }

    if (selectedTarget.mode === "insert") {
      const tokenIndex = entryIndexToTokenIndex(selectedTarget.index)
      if (tokenIndex > 0) {
        const prev = currentTokens[tokenIndex - 1]
        if (prev && prev.type !== "space" && prev.type !== "newline" && nextType === "word") {
          currentTokens.splice(tokenIndex, 0, { type: "space", value: " " }, nextToken)
        } else {
          currentTokens.splice(tokenIndex, 0, nextToken)
        }
      } else {
        currentTokens.splice(tokenIndex, 0, nextToken)
      }
      selectedTarget = { mode: "replace", index: selectedTarget.index }
    } else {
      const tokenIndex = entryIndexToTokenIndex(selectedTarget.index)
      currentTokens[tokenIndex] = nextToken
    }

    hasTypedSinceSelection = false
    wordInput.value = nextWord
    buildDictionary()
    renderEditorSurface()
    updateStatus()
    renderDictionary()
  }

  function deleteSelection() {
    const entries = editableEntries()
    if (selectedRange) {
      const startTokenIndex = entries[selectedRange.start]?.index
      const endTokenIndex = entries[selectedRange.end]?.index
      if (startTokenIndex == null || endTokenIndex == null) return
      currentTokens.splice(startTokenIndex, endTokenIndex - startTokenIndex + 1)
      selectedTarget = { mode: "insert", index: selectedRange.start }
      selectedRange = null
    } else if (selectedTarget.index >= 0 && selectedTarget.mode === "replace") {
      const tokenIndex = entries[selectedTarget.index]?.index
      if (tokenIndex == null) return
      currentTokens.splice(tokenIndex, 1)
      selectedTarget = { mode: "insert", index: Math.min(selectedTarget.index, entryCount()) }
    } else {
      return
    }
    wordInput.value = ""
    selectedDictionaryWord = ""
    hasTypedSinceSelection = false
    buildDictionary()
    renderEditorSurface()
    renderDictionary()
    updateStatus()
  }

  function moveToken(fromEntryIndex, toEntryIndex) {
    const entries = editableEntries()
    const fromTokenIndex = entries[fromEntryIndex]?.index
    if (fromTokenIndex == null) return
    const [token] = currentTokens.splice(fromTokenIndex, 1)
    const refreshedEntries = editableEntries()
    const targetTokenIndex = toEntryIndex >= refreshedEntries.length
      ? currentTokens.length
      : refreshedEntries[toEntryIndex].index
    currentTokens.splice(targetTokenIndex, 0, token)
    selectedTarget = { mode: "replace", index: Math.max(0, Math.min(toEntryIndex, entryCount() - 1)) }
    selectedRange = null
    hasTypedSinceSelection = false
    buildDictionary()
    renderEditorSurface()
    wordInput.value = editableEntries()[selectedTarget.index]?.token?.value || ""
    renderDictionary()
    updateStatus()
  }

  function selectAllTokens() {
    const count = entryCount()
    if (!count) return
    selectedRange = { start: 0, end: count - 1 }
    selectedTarget = { mode: "replace", index: count - 1 }
    selectedDictionaryWord = ""
    hasTypedSinceSelection = false
    wordInput.value = editableEntries().map((entry) => entry.token.value).join(" ")
    currentTokenPreview.textContent = "Selection complete de la phrase"
    renderEditorSurface()
    renderDictionary()
    updateStatus()
  }

  function selectNextToken() {
    const count = entryCount()
    if (!count) return
    const nextIndex = selectedTarget.index < count - 1 ? selectedTarget.index + 1 : 0
    setActiveTarget("replace", nextIndex)
  }

  function finishEditing() {
    const candidate = selectedDictionaryWord || wordInput.value.trim()
    if (candidate) {
      applySelectedWord()
    }
    const nextText = rebuildText()
    if (typeof saveCallback === "function") {
      saveCallback(nextText)
    }
    close({ triggerCancel: false })
  }

  function close(options = {}) {
    const { triggerCancel = true } = options
    modal.classList.remove("is-open")
    modal.setAttribute("aria-hidden", "true")
    if (triggerCancel && typeof cancelCallback === "function") {
      cancelCallback()
    }
    selectedDictionaryWord = ""
    selectedRange = null
    hasTypedSinceSelection = false
    currentTokenPreview.textContent = "Aucun token cible."
    wordInput.value = ""
  }

  async function open(options = {}) {
    ensureModal()
    const {
      text = "",
      title = "Edition guidee par dictionnaire",
      language = "fr",
      onSave,
      onCancel
    } = options
    currentLanguage = language || "fr"
    if (globalScope.PredictiveDictionary?.load) {
      await globalScope.PredictiveDictionary.load(currentLanguage)
    }
    saveCallback = onSave
    cancelCallback = onCancel
    initialTokens = tokenizeText(text)
    currentTokens = cloneTokens(initialTokens)
    selectedTarget = { mode: "replace", index: -1 }
    selectedRange = null
    selectedDictionaryWord = ""
    dragTokenIndex = -1
    hasTypedSinceSelection = false
    buildDictionary()
    renderOriginalText()
    renderEditorSurface()
    renderDictionary()
    updateStatus()
    titleNode.textContent = title
    modal.classList.add("is-open")
    modal.setAttribute("aria-hidden", "false")
    const firstIndex = entryCount() ? 0 : -1
    if (firstIndex >= 0) {
      setActiveTarget("replace", firstIndex)
    }
  }

  globalScope.DictionaryEditor = {
    open
  }
})(window)
