const path = require("path")
require("dotenv").config({
  path: path.resolve(__dirname, "../..", ".env")
})

const http = require("http")
const fs = require("fs")

const {
  handleMailImport,
  handleMailCreateDraft,
  handleMailReplyDraft,
  handleMailTextAssist,
  handleMailTextAssistStreamStart,
  handleMailTextAssistStream,
  handleMailVoiceEditCommand,
  handleMailSend,
  handleMailboxConnectStart,
  handleGoogleMailboxCallback,
  handleMailboxConnectionsList,
  handleMailboxInbox,
  handleMailboxMessage
  ,
  handleMailboxDisconnect,
  handleMailboxProcess,
  handleMailboxClaim,
  handleMailboxRelease,
  handleMailboxSharingMode,
  handleMailboxStats,
  handleStatsEvents,
  handleStatsReset
} = require("./routes/mailRoutes")
const {
  handleAccountRequest,
  handleAccountRequestAttachmentLookup,
  handleAccountRequestPlannedMailboxesLookup,
  handleAccountStatus,
  handleAccountLogin,
  handleAccountSession,
  handleAccountLogout,
  handleForgotPassword,
  handleResetPassword,
  handleChangePassword,
  handleAccountPreferencesGet,
  handleAccountPreferencesPut,
  handleAccountPrivacyExport,
  handleAccountProvidersList,
  handleAccountProviderCreate,
  handleAccountProviderUpdate,
  handleAccountProviderDelete,
  handleAccountProviderTest,
  handleAccountBillingDashboard,
  handleAccountUsageSummary,
  handleAccountProviderUsageEvents,
  getSessionPayloadFromRequest
} = require("./routes/accountRoutes")
const {
  handleAdminLogin,
  handleAdminForgotPassword,
  handleAdminChangePassword,
  handleAdminBootstrap,
  handleAdminRequest,
  handleAdminCreate,
  handleAdminRequestsList,
  handleAdminAccountsList,
  handleAdminMailboxResourcesList,
  handleAdminSecurityEventsList,
  handleAdminMailRulesList,
  handleAdminMailRuleCreate,
  handleAdminMailRuleUpdate,
  handleAdminMailRuleStatusUpdate,
  handleAdminRuleBuilderDraft,
  handleAdminRuleBuilderFinalize,
  handleAdminPriorityRulesGet,
  handleAdminPriorityRulesUpdate,
  handleAdminMailboxSharingUpdate,
  handleAdminRequestStatusUpdate,
  handleAdminAccountStatusUpdate,
  handleAdminAccountDelete,
  handleAdminPasswordReset
} = require("./routes/adminRoutes")
const {
  handleBrowserAutomationPolicyGet,
  handleBrowserAutomationPolicyUpdate,
  handleBrowserAutomationSessionStart,
  handleBrowserAutomationSessionsList
} = require("./routes/browserAutomationRoutes")
const {
  handleAudioTranscriptionStatus,
  handleAudioTranscription,
  handleFasterWhisperProbe,
  handleDeepgramProbe,
  handleDeepgramLiveStart,
  handleDeepgramLiveChunk,
  handleDeepgramLiveEvents,
  handleDeepgramLiveStop,
  handleAssemblyAiLiveStart,
  handleAssemblyAiLiveChunk,
  handleAssemblyAiLiveEvents,
  handleAssemblyAiLiveStop
} = require("./routes/audioRoutes")
const {
  handleBackupsList,
  handleBackupsSnapshotCreate,
  handleBackupsRestoreBis
} = require("./routes/backupsRoutes")
const { openDatabase, getDatabaseInfo } = require("./services/databaseService")
const {
  getCurrentRole,
  getBlockedModelsForRole
} = require("./services/modelAccessService")
const { getHumanVerificationProvider } = require("./services/humanVerificationService")
const projectRoot = path.resolve(__dirname, "../..")
const frontendRoot = path.join(projectRoot, "frontend")
const sidebarPath = path.join(frontendRoot, "components", "sidebar.html")
const PRIVATE_FRONTEND_PATHS = new Set([
  "/frontend/mail.html",
  "/frontend/settings.html",
  "/frontend/audio-test.html",
  "/frontend/rules.html",
  "/frontend/rule-creation.html",
  "/frontend/stats.html",
  "/frontend/billing.html",
  "/frontend/versions.html",
  "/frontend/backups.html",
  "/frontend/test-tools.html"
])

openDatabase()

function getContentType(filePath) {
  if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8"
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8"
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8"
  if (filePath.endsWith(".png")) return "image/png"
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) return "image/jpeg"

  return "text/plain; charset=utf-8"
}

function safeResolveProjectPath(requestPath) {
  const pathname = requestPath.includes("?")
    ? new URL(requestPath, "http://localhost").pathname
    : requestPath
  const trimmedPath = pathname.replace(/^\/+/, "")
  const resolvedPath = path.resolve(projectRoot, trimmedPath)

  if (!resolvedPath.startsWith(projectRoot)) {
    return null
  }

  return resolvedPath
}

function serveHtmlPage(res, filePath) {
  fs.readFile(filePath, "utf8", (pageError, pageHtml) => {
    if (pageError) {
      res.writeHead(404)
      res.end("Not found")
      return
    }

    fs.readFile(sidebarPath, "utf8", (sidebarError, sidebarHtml) => {
      if (sidebarError) {
        res.writeHead(500)
        res.end("Sidebar not found")
        return
      }

      const finalHtml = pageHtml.replace("<!-- SIDEBAR -->", sidebarHtml)

      res.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      })
      res.end(finalHtml)
    })
  })
}

function getRequestPathname(requestUrl) {
  return new URL(requestUrl, "http://localhost").pathname
}

function hasActiveAccountSession(req) {
  return Boolean(getSessionPayloadFromRequest(req))
}

const server = http.createServer((req, res) => {
  const pathname = getRequestPathname(req.url)

  if (req.method === "POST" && req.url === "/api/mail/import") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailImport(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mail/create-draft") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailCreateDraft(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mail/reply-draft") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailReplyDraft(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mail/text-assist") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailTextAssist(req, res, body)
    })

    return
  }

  if (req.method === "GET" && pathname === "/api/models") {
    const apiModels = [
      { value: "together-api", label: "Together éco - LFM2 24B", type: "api" },
      { value: "together-gemma-3n-e4b", label: "Together éco - Gemma 3N E4B", type: "api" },
      { value: "together-llama-3-8b-lite", label: "Together éco - Llama 3 8B Lite", type: "api" },
      { value: "together-qwen-3-5-9b", label: "Together éco - Qwen 3.5 9B", type: "api" },
      { value: "together-gpt-oss-20b", label: "Together éco - GPT OSS 20B", type: "api" },
      { value: "deepseek-chat", label: "DeepSeek Chat (API)", type: "api" },
      { value: "deepseek-reasoner", label: "DeepSeek Reasoner (API)", type: "api" },
      { value: "mistral-api", label: "Mistral API", type: "api" }
    ]

    const role = getCurrentRole()
    const blockedModels = getBlockedModelsForRole(role)

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      role,
      models: apiModels,
      blockedModels
    }))

    return
  }

  if (req.method === "GET" && pathname === "/api/human-verification/config") {
    const provider = getHumanVerificationProvider()
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      provider,
      turnstileSiteKey: provider === "turnstile"
        ? String(process.env.TURNSTILE_SITE_KEY || "").trim()
        : ""
    }))
    return
  }

  if (req.method === "GET" && pathname === "/api/stats/events") {
    handleStatsEvents(req, res)
    return
  }

  if (req.method === "POST" && pathname === "/api/stats/reset") {
    handleStatsReset(req, res)
    return
  }

  if (req.method === "GET" && pathname === "/api/backups") {
    handleBackupsList(req, res)
    return
  }

  if (req.method === "POST" && pathname === "/api/backups/snapshot") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleBackupsSnapshotCreate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && pathname === "/api/backups/restore-bis") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleBackupsRestoreBis(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mail/text-assist/stream/start") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailTextAssistStreamStart(req, res, body)
    })

    return
  }

  const textAssistStreamMatch = pathname.match(/^\/api\/mail\/text-assist\/stream\/([^/]+)$/)
  if (req.method === "GET" && textAssistStreamMatch) {
    handleMailTextAssistStream(req, res, decodeURIComponent(textAssistStreamMatch[1]))
    return
  }

  if (req.method === "POST" && req.url === "/api/mail/voice-edit-command") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailVoiceEditCommand(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mail/send") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailSend(req, res, body)
    })

    return
  }

  if (req.method === "GET" && req.url === "/api/audio/transcription/status") {
    handleAudioTranscriptionStatus(req, res)
    return
  }

  if (req.method === "GET" && pathname === "/api/account/preferences") {
    handleAccountPreferencesGet(req, res)
    return
  }

  if (req.method === "PUT" && pathname === "/api/account/preferences") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleAccountPreferencesPut(req, res, body)
    })
    return
  }

  if (req.method === "GET" && pathname === "/api/account/privacy-export") {
    handleAccountPrivacyExport(req, res)
    return
  }

  if (req.method === "GET" && pathname === "/api/account/providers") {
    handleAccountProvidersList(req, res)
    return
  }

  if (req.method === "POST" && pathname === "/api/account/providers") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleAccountProviderCreate(req, res, body)
    })
    return
  }

  const providerMatch = pathname.match(/^\/api\/account\/providers\/([^/]+)$/)
  if (providerMatch && req.method === "PUT") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleAccountProviderUpdate(req, res, body, decodeURIComponent(providerMatch[1]))
    })
    return
  }

  if (providerMatch && req.method === "DELETE") {
    handleAccountProviderDelete(req, res, decodeURIComponent(providerMatch[1]))
    return
  }

  const providerTestMatch = pathname.match(/^\/api\/account\/providers\/([^/]+)\/test$/)
  if (providerTestMatch && req.method === "POST") {
    handleAccountProviderTest(req, res, decodeURIComponent(providerTestMatch[1]))
    return
  }

  if (req.method === "GET" && pathname === "/api/account/usage-summary") {
    handleAccountUsageSummary(req, res)
    return
  }

  if (req.method === "GET" && pathname === "/api/account/billing-dashboard") {
    handleAccountBillingDashboard(req, res)
    return
  }

  if (req.method === "GET" && pathname === "/api/account/provider-usage-events") {
    handleAccountProviderUsageEvents(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/audio/transcription") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAudioTranscription(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/audio/faster-whisper-probe") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleFasterWhisperProbe(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/audio/deepgram-probe") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleDeepgramProbe(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/audio/deepgram-live/start") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleDeepgramLiveStart(req, res, body)
    })
    return
  }

  if (req.method === "POST" && req.url === "/api/audio/deepgram-live/chunk") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleDeepgramLiveChunk(req, res, body)
    })
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/audio/deepgram-live/events")) {
    handleDeepgramLiveEvents(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/audio/deepgram-live/stop") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleDeepgramLiveStop(req, res, body)
    })
    return
  }

  if (req.method === "POST" && req.url === "/api/audio/assemblyai-live/start") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleAssemblyAiLiveStart(req, res, body)
    })
    return
  }

  if (req.method === "POST" && req.url === "/api/audio/assemblyai-live/chunk") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleAssemblyAiLiveChunk(req, res, body)
    })
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/audio/assemblyai-live/events")) {
    handleAssemblyAiLiveEvents(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/audio/assemblyai-live/stop") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleAssemblyAiLiveStop(req, res, body)
    })
    return
  }

  if (req.method === "POST" && (req.url === "/api/mailbox/connect/start" || req.url === "/api/mailbox/connect")) {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailboxConnectStart(req, res, body)
    })

    return
  }

  if (
    req.method === "GET"
    && (
      req.url.startsWith("/api/mailbox/google/callback")
      || req.url.startsWith("/api/mailbox/callback")
      || req.url.startsWith("/oauth2callback")
    )
  ) {
    handleGoogleMailboxCallback(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/mailbox/connections")) {
    handleMailboxConnectionsList(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/mailbox/inbox") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailboxInbox(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mailbox/message") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailboxMessage(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mailbox/disconnect") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailboxDisconnect(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mailbox/process") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleMailboxProcess(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/mailbox/claim") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleMailboxClaim(req, res, body)
    })
    return
  }

  if (req.method === "POST" && req.url === "/api/mailbox/release") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleMailboxRelease(req, res, body)
    })
    return
  }

  if (req.method === "POST" && req.url === "/api/mailbox/sharing-mode") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleMailboxSharingMode(req, res, body)
    })
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/mailbox/stats")) {
    handleMailboxStats(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/browser-automation/policy")) {
    handleBrowserAutomationPolicyGet(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/browser-automation/policy") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleBrowserAutomationPolicyUpdate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/browser-automation/session/start") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleBrowserAutomationSessionStart(req, res, body)
    })

    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/browser-automation/sessions")) {
    handleBrowserAutomationSessionsList(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/account/request") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAccountRequest(req, res, body)
    })

    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/account/request/attachment")) {
    handleAccountRequestAttachmentLookup(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/account/request/planned-mailboxes")) {
    handleAccountRequestPlannedMailboxesLookup(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/account/status")) {
    handleAccountStatus(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/account/login") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAccountLogin(req, res, body)
    })

    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/account/session")) {
    handleAccountSession(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/account/logout") {
    handleAccountLogout(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/account/forgot-password") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleForgotPassword(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/account/change-password") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleChangePassword(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/account/reset-password") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleResetPassword(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/bootstrap") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminBootstrap(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/login") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminLogin(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/forgot-password") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminForgotPassword(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/create") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminCreate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/request") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminRequest(req, res, body)
    })

    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/admin/requests")) {
    handleAdminRequestsList(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/admin/accounts")) {
    handleAdminAccountsList(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/admin/mailboxes")) {
    handleAdminMailboxResourcesList(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/admin/security-events")) {
    handleAdminSecurityEventsList(req, res)
    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/admin/mail-rules")) {
    handleAdminMailRulesList(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/admin/mail-rules") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminMailRuleCreate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/mail-rules/update") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminMailRuleUpdate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/mail-rules/status") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminMailRuleStatusUpdate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/rule-builder/draft") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminRuleBuilderDraft(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/rule-builder/finalize") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminRuleBuilderFinalize(req, res, body)
    })

    return
  }

  if (req.method === "GET" && req.url.startsWith("/api/admin/priority-rules")) {
    handleAdminPriorityRulesGet(req, res)
    return
  }

  if (req.method === "POST" && req.url === "/api/admin/priority-rules") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminPriorityRulesUpdate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/mailbox-sharing") {
    let body = ""
    req.on("data", chunk => {
      body += chunk.toString()
    })
    req.on("end", async () => {
      await handleAdminMailboxSharingUpdate(req, res, body)
    })
    return
  }

  if (req.method === "POST" && req.url === "/api/admin/request-status") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminRequestStatusUpdate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/account-status") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminAccountStatusUpdate(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/account-delete") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminAccountDelete(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/password-reset") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminPasswordReset(req, res, body)
    })

    return
  }

  if (req.method === "POST" && req.url === "/api/admin/change-password") {
    let body = ""

    req.on("data", chunk => {
      body += chunk.toString()
    })

    req.on("end", async () => {
      await handleAdminChangePassword(req, res, body)
    })

    return
  }

  if (req.method === "GET" && req.url === "/api/health") {
    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      status: "ok",
      message: "Backend running",
      database: getDatabaseInfo()
    }))
    return
  }

  if (req.url === "/" || req.url === "/index.html") {
    const filePath = path.join(frontendRoot, "index.html")
    serveHtmlPage(res, filePath)
    return
  }

  if (pathname.startsWith("/frontend/")) {
    if (PRIVATE_FRONTEND_PATHS.has(pathname) && !hasActiveAccountSession(req)) {
      res.writeHead(302, { Location: "/frontend/account.html" })
      res.end()
      return
    }

    const filePath = safeResolveProjectPath(req.url)

    if (!filePath) {
      res.writeHead(403)
      res.end("Forbidden")
      return
    }

    if (filePath.endsWith(".html")) {
      serveHtmlPage(res, filePath)
      return
    }

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404)
        res.end("Not found")
        return
      }

      res.writeHead(200, {
        "Content-Type": getContentType(filePath),
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0"
      })
      res.end(data)
    })

    return
  }

  res.writeHead(404, { "Content-Type": "application/json" })
  res.end(JSON.stringify({
    error: "Route not found"
  }))
})

process.on("uncaughtException", (err) => {
  console.error("[server] uncaughtException — serveur maintenu:", err?.message || err)
})

process.on("unhandledRejection", (reason) => {
  console.error("[server] unhandledRejection — serveur maintenu:", reason?.message || reason)
})

const port = process.env.PORT || 3000

server.listen(port, () => {
  console.log(`Serveur démarré sur http://localhost:${port}`)
})
