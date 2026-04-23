const body = document.body
const sidebar = document.getElementById("sidebar")
const sidebarToggle = document.getElementById("sidebarToggle")
const themeSelect = document.getElementById("themeSelect")

const createModeBtn = document.getElementById("createModeBtn")
const replyModeBtn = document.getElementById("replyModeBtn")

const mailDate = document.getElementById("mailDate")
const outputMailContent = document.getElementById("outputMailContent")
const creationPrompt = document.getElementById("creationPrompt")

const sendBtn = document.getElementById("sendBtn")
const rejectBtn = document.getElementById("rejectBtn")
const deleteBtn = document.getElementById("deleteBtn")

const sendCount = document.getElementById("sendCount")
const rejectCount = document.getElementById("rejectCount")
const deleteCount = document.getElementById("deleteCount")

const THEME_STORAGE_KEY = "mail-assistant-theme"

let sessionCounters = {
  send: 0,
  reject: 0,
  delete: 0
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

function loadCreationDefaults() {
  if (mailDate) {
    mailDate.value = getTodayString()
  }

  if (creationPrompt) {
    creationPrompt.value =
`Tu es un spécialiste de la rédaction de mails.
Rédige un mail clair, professionnel et accessible.
Objectif : répondre de manière polie et concise à la demande de l’interlocuteur.`
  }

  if (outputMailContent) {
    outputMailContent.value =
`Bonjour Madame, Monsieur,

Je vous contacte afin de vous transmettre les éléments demandés et de vous apporter les précisions nécessaires concernant votre demande.

Vous trouverez ci-joint les informations utiles. Je reste naturellement à votre disposition pour tout complément ou pour un échange supplémentaire si besoin.

Bien cordialement`
  }
}

function incrementCounter(type) {
  sessionCounters[type] += 1

  if (type === "send" && sendCount) {
    sendCount.textContent = sessionCounters[type]
  }

  if (type === "reject" && rejectCount) {
    rejectCount.textContent = sessionCounters[type]
  }

  if (type === "delete" && deleteCount) {
    deleteCount.textContent = sessionCounters[type]
  }
}

function preventReplyModeActivation() {
  if (replyModeBtn) {
    replyModeBtn.classList.remove("active")
  }

  if (createModeBtn) {
    createModeBtn.classList.add("active")
  }
}

sidebarToggle?.addEventListener("click", () => {
  sidebar?.classList.toggle("expanded")
})

themeSelect?.addEventListener("change", (event) => {
  applyTheme(event.target.value)
})

createModeBtn?.addEventListener("click", () => {
  createModeBtn.classList.add("active")
  replyModeBtn?.classList.remove("active")
})

replyModeBtn?.addEventListener("click", () => {
  preventReplyModeActivation()
})

sendBtn?.addEventListener("click", () => incrementCounter("send"))
rejectBtn?.addEventListener("click", () => incrementCounter("reject"))
deleteBtn?.addEventListener("click", () => incrementCounter("delete"))

loadTheme()
loadCreationDefaults()
preventReplyModeActivation()