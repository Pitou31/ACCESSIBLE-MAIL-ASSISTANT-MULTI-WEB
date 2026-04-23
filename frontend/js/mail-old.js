const body = document.body
const sidebar = document.getElementById("sidebar")
const sidebarToggle = document.getElementById("sidebarToggle")
const themeSelect = document.getElementById("themeSelect")

const createModeBtn = document.getElementById("createModeBtn")
const replyModeBtn = document.getElementById("replyModeBtn")

const creationWorkspace = document.getElementById("creationWorkspace")
const replyWorkspace = document.getElementById("replyWorkspace")

const mailDate = document.getElementById("mailDate")

const creationOutputMailContent = document.getElementById("creationOutputMailContent")
const receivedMailContent = document.getElementById("receivedMailContent")
const replyOutputMailContent = document.getElementById("replyOutputMailContent")

const creationSendBtn = document.getElementById("creationSendBtn")
const creationRejectBtn = document.getElementById("creationRejectBtn")
const creationDeleteBtn = document.getElementById("creationDeleteBtn")

const replySendBtn = document.getElementById("replySendBtn")
const replyRejectBtn = document.getElementById("replyRejectBtn")
const replyDeleteBtn = document.getElementById("replyDeleteBtn")

const creationSendCount = document.getElementById("creationSendCount")
const creationRejectCount = document.getElementById("creationRejectCount")
const creationDeleteCount = document.getElementById("creationDeleteCount")

const replySendCount = document.getElementById("replySendCount")
const replyRejectCount = document.getElementById("replyRejectCount")
const replyDeleteCount = document.getElementById("replyDeleteCount")

const THEME_STORAGE_KEY = "mail-assistant-theme"

let sessionCounters = {
  creation: {
    send: 0,
    reject: 0,
    delete: 0
  },
  reply: {
    send: 0,
    reject: 0,
    delete: 0
  }
}

function applyTheme(themeName) {
  body.setAttribute("data-theme", themeName)
  localStorage.setItem(THEME_STORAGE_KEY, themeName)
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "midnight"
  if (themeSelect) {
    themeSelect.value = savedTheme
  }
  applyTheme(savedTheme)
}

function getTodayString() {
  const now = new Date()
  return now.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  })
}

function loadCreationExample() {
  if (creationOutputMailContent) {
    creationOutputMailContent.value = `Bonjour Madame, Monsieur,

Je vous contacte afin de vous transmettre les éléments demandés et de vous apporter les précisions nécessaires concernant votre demande.

Vous trouverez ci-joint les informations utiles. Je reste naturellement à votre disposition pour tout complément ou pour un échange supplémentaire si besoin.

Bien cordialement`
  }
}

function loadReplyExample() {
  if (receivedMailContent) {
    receivedMailContent.value = `From : client@example.com
Date : 14/03/2026
Objet : Demande de précisions sur les délais

Bonjour,

Je souhaiterais connaître les délais moyens de traitement de ma demande ainsi que les documents à fournir pour compléter mon dossier.

Merci par avance pour votre retour.

Bien cordialement`
  }

  if (replyOutputMailContent) {
    replyOutputMailContent.value = `Bonjour,

Merci pour votre message.

Les délais moyens de traitement sont actuellement de 5 à 7 jours ouvrés à compter de la réception d’un dossier complet.

Pour finaliser votre demande, merci de nous transmettre les documents suivants :
- une copie de votre pièce d’identité,
- le document de référence lié à votre demande,
- tout justificatif complémentaire utile.

Nous restons à votre disposition pour toute précision complémentaire.

Bien cordialement`
  }
}

function setMode(mode) {
  const isCreation = mode === "creation"

  createModeBtn?.classList.toggle("active", isCreation)
  replyModeBtn?.classList.toggle("active", !isCreation)

  creationWorkspace?.classList.toggle("hidden-panel", !isCreation)
  replyWorkspace?.classList.toggle("hidden-panel", isCreation)

  if (isCreation) {
    loadCreationExample()
  } else {
    loadReplyExample()
  }
}

function incrementCounter(section, type) {
  sessionCounters[section][type] += 1

  if (section === "creation") {
    if (type === "send" && creationSendCount) creationSendCount.textContent = sessionCounters[section][type]
    if (type === "reject" && creationRejectCount) creationRejectCount.textContent = sessionCounters[section][type]
    if (type === "delete" && creationDeleteCount) creationDeleteCount.textContent = sessionCounters[section][type]
  }

  if (section === "reply") {
    if (type === "send" && replySendCount) replySendCount.textContent = sessionCounters[section][type]
    if (type === "reject" && replyRejectCount) replyRejectCount.textContent = sessionCounters[section][type]
    if (type === "delete" && replyDeleteCount) replyDeleteCount.textContent = sessionCounters[section][type]
  }
}

function loadSessionDefaults() {
  if (mailDate) {
    mailDate.value = getTodayString()
  }
}

sidebarToggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("expanded")
})

themeSelect?.addEventListener("change", (event) => {
  applyTheme(event.target.value)
})

createModeBtn?.addEventListener("click", () => setMode("creation"))
replyModeBtn?.addEventListener("click", () => setMode("reply"))

creationSendBtn?.addEventListener("click", () => incrementCounter("creation", "send"))
creationRejectBtn?.addEventListener("click", () => incrementCounter("creation", "reject"))
creationDeleteBtn?.addEventListener("click", () => incrementCounter("creation", "delete"))

replySendBtn?.addEventListener("click", () => incrementCounter("reply", "send"))
replyRejectBtn?.addEventListener("click", () => incrementCounter("reply", "reject"))
replyDeleteBtn?.addEventListener("click", () => incrementCounter("reply", "delete"))

loadTheme()
loadSessionDefaults()
setMode("creation")