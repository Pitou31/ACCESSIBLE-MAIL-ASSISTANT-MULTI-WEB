(() => {
const THEME_STORAGE_KEY = "mail-assistant-theme"
const DEFAULT_THEME = "blue-violet"
const SESSION_KEY = "mail-assistant-session"
const ACCOUNT_ACTIVE_KEY = "mail-assistant-account-active"
const SETTINGS_STORAGE_KEY = "mail-assistant-settings"
const LAST_MAIL_MODE_STORAGE_KEY = "mail-assistant-last-mail-mode"
const RUNTIME_ROLE_STORAGE_KEY = "mail-assistant-runtime-role"
const PUBLIC_NAV_ITEMS = new Set(["home", "account", "privacy"])
const PUBLIC_PATHS = new Set([
  "/",
  "/index.html",
  "/frontend/account.html",
  "/frontend/account-request.html",
  "/frontend/privacy.html",
  "/frontend/reset-password.html",
  "/frontend/admin-bootstrap.html",
  "/frontend/admin-login.html"
])

function applyTheme(themeName) {
  document.body.setAttribute("data-theme", themeName)
  localStorage.setItem(THEME_STORAGE_KEY, themeName)
  window.dispatchEvent(
    new CustomEvent("mail-assistant-theme-changed", {
      detail: { theme: themeName }
    })
  )
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null")
  } catch (_) {
    return null
  }
}

function getAccountScopedKey(baseKey, session = getSession()) {
  const accountId = session?.userId || session?.accountId || ""
  return accountId ? `${baseKey}:${accountId}` : baseKey
}

function clearLocalSessionState() {
  const session = getSession()
  localStorage.removeItem(SESSION_KEY)
  localStorage.setItem(ACCOUNT_ACTIVE_KEY, "0")
  localStorage.removeItem(SETTINGS_STORAGE_KEY)
  localStorage.removeItem(LAST_MAIL_MODE_STORAGE_KEY)
  if (session?.userId || session?.accountId) {
    localStorage.removeItem(getAccountScopedKey(SETTINGS_STORAGE_KEY, session))
    localStorage.removeItem(getAccountScopedKey(LAST_MAIL_MODE_STORAGE_KEY, session))
  }
}

function hasActiveAccount() {
  const session = getSession()
  if (session?.accountActive === 1 || session?.accountActive === "1") {
    localStorage.setItem(ACCOUNT_ACTIVE_KEY, "1")
    return true
  }
  return false
}

function getRuntimeRole() {
  return String(localStorage.getItem(RUNTIME_ROLE_STORAGE_KEY) || "").trim().toLowerCase()
}

async function syncRuntimeRoleFromServer() {
  try {
    const response = await fetch("/api/models")
    const result = await response.json()
    const role = String(result?.role || "").trim().toLowerCase()

    if (response.ok && role) {
      localStorage.setItem(RUNTIME_ROLE_STORAGE_KEY, role)
    }
  } catch (_) {
    // Conserver la derniere valeur connue si l'API est temporairement indisponible.
  }
}

async function syncSessionFromServer() {
  try {
    const response = await fetch("/api/account/session")
    const result = await response.json()

    if (!response.ok || !result.ok) {
      throw new Error(result.error || "Erreur de lecture de session.")
    }

    if (result.accountActive === 1 && result.session) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(result.session))
      localStorage.setItem(ACCOUNT_ACTIVE_KEY, "1")
    } else {
      clearLocalSessionState()
    }
  } catch (_) {
    clearLocalSessionState()
  }
}

function isPrivatePath(pathname) {
  return !PUBLIC_PATHS.has(pathname)
}

function loadTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || DEFAULT_THEME
  const themeSelect = document.getElementById("themeSelect")

  if (themeSelect) {
    themeSelect.value = savedTheme
  }

  applyTheme(savedTheme)
}

function initializeSidebar() {
  const sidebar = document.getElementById("sidebar")
  const sidebarToggle = document.getElementById("sidebarToggle")
  const themeSelect = document.getElementById("themeSelect")

  loadTheme()

  sidebarToggle?.addEventListener("click", () => {
    sidebar?.classList.toggle("expanded")
  })

  themeSelect?.addEventListener("change", (event) => {
    applyTheme(event.target.value)
  })

  setActiveSidebarItem()
  normalizeSidebarLinks()
  Promise.allSettled([syncSessionFromServer(), syncRuntimeRoleFromServer()]).finally(() => {
    updateSidebarAccess()
  })
}

function refreshSidebarSessionState() {
  Promise.allSettled([syncSessionFromServer(), syncRuntimeRoleFromServer()]).finally(() => {
    updateSidebarAccess()
  })
}

function setActiveSidebarItem() {
  const currentPath = window.location.pathname
  const navItems = document.querySelectorAll(".sidebar .nav-item")
  const routes = {
    "/": "home",
    "/index.html": "home",
    "/frontend/mail.html": "mail",
    "/frontend/account.html": "account",
    "/frontend/account-request.html": "account",
    "/frontend/privacy.html": "privacy",
    "/frontend/reset-password.html": "account",
    "/frontend/admin-login.html": "account",
    "/frontend/settings.html": "settings",
    "/frontend/rules.html": "rules",
    "/frontend/stats.html": "stats",
    "/frontend/billing.html": "billing",
    "/frontend/versions.html": "versions",
    "/frontend/backups.html": "backups",
    "/frontend/admin-db.html": "",
    "/frontend/admin-bootstrap.html": ""
  }

  navItems.forEach((item) => item.classList.remove("active"))

  const activeNav = routes[currentPath]
  if (activeNav) {
    document.querySelector(`.sidebar .nav-item[data-nav="${activeNav}"]`)?.classList.add("active")
  }
}

function normalizeSidebarLinks() {
  const links = document.querySelectorAll(".sidebar a")
  links.forEach((link) => {
    link.setAttribute("draggable", "false")
  })
}

function updateSidebarAccess() {
  const activeAccount = hasActiveAccount()
  const runtimeRole = getRuntimeRole()
  const navItems = document.querySelectorAll(".sidebar .nav-item")

  navItems.forEach((item) => {
    const navName = item.dataset.nav || ""
    const isPublic = PUBLIC_NAV_ITEMS.has(navName)
    const shouldDisable = !activeAccount && !isPublic
    const shouldHideByAccount = !activeAccount && !isPublic
    const shouldHideByRole = runtimeRole === "mac" && navName === "rules"
    const shouldHide = shouldHideByAccount || shouldHideByRole

    item.classList.toggle("inactive", shouldDisable)
    item.setAttribute("aria-disabled", shouldDisable ? "true" : "false")
    item.hidden = shouldHide
    item.title = shouldDisable
      ? "Connexion requise pour acceder a cette page."
      : ""

    if (shouldDisable) {
      item.addEventListener("click", preventInactiveNavigation)
    } else {
      item.removeEventListener("click", preventInactiveNavigation)
    }
  })

  if (!activeAccount && isPrivatePath(window.location.pathname)) {
    window.location.replace("/frontend/account.html")
  }
}

function preventInactiveNavigation(event) {
  event.preventDefault()
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    initializeSidebar()
  })
} else {
  initializeSidebar()
}

document.addEventListener("change", (event) => {
  if (event.target?.id === "themeSelect") {
    applyTheme(event.target.value)
  }
})

window.addEventListener("mail-assistant-session-changed", () => {
  refreshSidebarSessionState()
})

window.addEventListener("storage", (event) => {
  if (event.key === SESSION_KEY || event.key === ACCOUNT_ACTIVE_KEY) {
    refreshSidebarSessionState()
  }
})

window.addEventListener("focus", () => {
  refreshSidebarSessionState()
})

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) {
    refreshSidebarSessionState()
  }
})
})()
