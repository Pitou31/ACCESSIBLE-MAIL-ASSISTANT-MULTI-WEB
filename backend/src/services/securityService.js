const { randomUUID } = require("crypto")
const { insertSecurityEvent } = require("./databaseService")

const DEFAULT_RULE = {
  windowMs: 10 * 60 * 1000,
  maxAttempts: 20,
  lockMs: 10 * 60 * 1000
}

const RULES = {
  admin_login: {
    windowMs: 10 * 60 * 1000,
    maxAttempts: 5,
    lockMs: 15 * 60 * 1000
  },
  account_login: {
    windowMs: 10 * 60 * 1000,
    maxAttempts: 8,
    lockMs: 10 * 60 * 1000
  },
  account_request: {
    windowMs: 60 * 60 * 1000,
    maxAttempts: 5,
    lockMs: 30 * 60 * 1000
  },
  admin_request: {
    windowMs: 60 * 60 * 1000,
    maxAttempts: 5,
    lockMs: 30 * 60 * 1000
  },
  password_action: {
    windowMs: 30 * 60 * 1000,
    maxAttempts: 5,
    lockMs: 30 * 60 * 1000
  },
  admin_mutation: {
    windowMs: 10 * 60 * 1000,
    maxAttempts: 30,
    lockMs: 10 * 60 * 1000
  }
}

const buckets = new Map()

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)[0]
  return forwardedFor || req.socket?.remoteAddress || ""
}

function normalizeEmail(payload = {}) {
  return String(payload.email || payload.adminEmail || payload.userEmail || "")
    .trim()
    .toLowerCase()
}

function normalizeAccountType(payload = {}) {
  return String(payload.accountType || payload.account_type || "")
    .trim()
    .toLowerCase()
}

function getRule(ruleName) {
  return RULES[ruleName] || DEFAULT_RULE
}

function buildBucketKey({ ruleName, route, ip, email, accountType }) {
  return [
    ruleName || "default",
    route || "",
    ip || "",
    email || "",
    accountType || ""
  ].join("|")
}

function formatRetryDelay(ms) {
  const seconds = Math.max(1, Math.ceil(ms / 1000))
  if (seconds < 60) {
    return `${seconds} seconde${seconds > 1 ? "s" : ""}`
  }
  const minutes = Math.ceil(seconds / 60)
  return `${minutes} minute${minutes > 1 ? "s" : ""}`
}

function maskEmail(email) {
  if (!email || typeof email !== "string") return email
  const at = email.indexOf("@")
  if (at < 1) return email
  return email[0] + "***" + email.slice(at)
}

function safeDetails(details) {
  try {
    return JSON.stringify(details || {})
  } catch (_) {
    return "{}"
  }
}

function writeSecurityEvent(req, payload = {}, options = {}) {
  try {
    insertSecurityEvent({
      id: randomUUID(),
      created_at: new Date().toISOString(),
      event_type: String(options.eventType || "security_event"),
      severity: String(options.severity || "info"),
      status: String(options.status || "observed"),
      route: String(options.route || req.url || ""),
      method: String(req.method || ""),
      ip: getClientIp(req),
      email: maskEmail(normalizeEmail(payload)),
      account_type: normalizeAccountType(payload),
      actor_id: String(options.actorId || payload.accountId || ""),
      user_agent: String(req.headers["user-agent"] || ""),
      details_json: safeDetails(options.details)
    })
  } catch (error) {
    console.warn("[security] impossible d'enregistrer l'événement", error.message)
  }
}

function recordSecurityEvent(req, payload = {}, options = {}) {
  setTimeout(() => {
    writeSecurityEvent(req, payload, options)
  }, 0)
}

function checkSecurityRateLimit(req, payload = {}, options = {}) {
  const ruleName = options.ruleName || "default"
  const rule = getRule(ruleName)
  const now = Date.now()
  const email = normalizeEmail(payload)
  const accountType = normalizeAccountType(payload)
  const ip = getClientIp(req)
  const route = options.route || req.url || ""
  const key = buildBucketKey({ ruleName, route, ip, email, accountType })
  const current = buckets.get(key) || {
    attempts: 0,
    windowStartedAt: now,
    lockedUntil: 0
  }

  if (current.lockedUntil > now) {
    return {
      ok: false,
      statusCode: 403,
      retryAfterSeconds: Math.ceil((current.lockedUntil - now) / 1000),
      error: `Trop de tentatives. Merci de réessayer dans ${formatRetryDelay(current.lockedUntil - now)}.`
    }
  }

  if (now - current.windowStartedAt > rule.windowMs) {
    current.attempts = 0
    current.windowStartedAt = now
    current.lockedUntil = 0
  }

  current.attempts += 1
  if (current.attempts > rule.maxAttempts) {
    current.lockedUntil = now + rule.lockMs
    buckets.set(key, current)
    return {
      ok: false,
      statusCode: 403,
      retryAfterSeconds: Math.ceil(rule.lockMs / 1000),
      error: `Trop de tentatives. Merci de réessayer dans ${formatRetryDelay(rule.lockMs)}.`
    }
  }

  buckets.set(key, current)
  return {
    ok: true,
    attempts: current.attempts,
    maxAttempts: rule.maxAttempts
  }
}

function enforceSecurityRateLimit(req, res, payload = {}, options = {}) {
  const result = checkSecurityRateLimit(req, payload, options)
  if (result.ok) {
    return true
  }

  res.writeHead(result.statusCode || 403, { "Content-Type": "application/json" })
  res.end(JSON.stringify({
    ok: false,
    error: result.error
  }))
  return false
}

module.exports = {
  checkSecurityRateLimit,
  enforceSecurityRateLimit,
  getClientIp,
  maskEmail,
  recordSecurityEvent
}
