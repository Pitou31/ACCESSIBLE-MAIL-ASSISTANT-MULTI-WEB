const crypto = require("crypto")
const {
  getAppSetting,
  getProviderAccountById,
  listProviderAccountsForOwner,
  getDefaultProviderAccountForOwner,
  upsertProviderAccount,
  updateProviderAccount,
  deactivateProviderAccount,
  markProviderAccountTestResult
} = require("./databaseService")

const ALLOWED_PROVIDER_TYPES = new Set(["deepgram", "assemblyai", "deepseek-api", "mistral-api"])

function getProviderSecretKey() {
  const raw = process.env.PROVIDER_API_SECRET
    || process.env.MAILBOX_TOKEN_SECRET
    || process.env.SESSION_SECRET
    || process.env.APP_SECRET
    || "provider-dev-secret-change-me"
  return crypto.createHash("sha256").update(raw).digest()
}

function encryptProviderApiKey(value = "") {
  if (!value) return ""
  const iv = crypto.randomBytes(12)
  const key = getProviderSecretKey()
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

function decryptProviderApiKey(value = "") {
  if (!value) return ""
  const [ivHex, tagHex, encryptedHex] = String(value).split(":")
  if (!ivHex || !tagHex || !encryptedHex) {
    return ""
  }

  const key = getProviderSecretKey()
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ])
  return decrypted.toString("utf8")
}

function maskProviderApiKey(apiKey = "") {
  const raw = String(apiKey || "").trim()
  if (!raw) {
    return ""
  }

  if (raw.length <= 8) {
    return `${raw.slice(0, 2)}****`
  }

  return `${raw.slice(0, 3)}${"*".repeat(Math.max(4, raw.length - 7))}${raw.slice(-4)}`
}

function validateProviderType(providerType) {
  const normalized = String(providerType || "").trim().toLowerCase()
  if (!ALLOWED_PROVIDER_TYPES.has(normalized)) {
    const error = new Error("Fournisseur API non pris en charge.")
    error.statusCode = 400
    throw error
  }

  return normalized
}

function getProviderLabel(providerType) {
  switch (providerType) {
    case "deepgram":
      return "Deepgram"
    case "assemblyai":
      return "AssemblyAI"
    case "deepseek-api":
      return "DeepSeek API"
    case "mistral-api":
      return "Mistral API"
    default:
      return providerType
  }
}

function normalizeProviderAccountPayload(payload = {}) {
  const providerType = validateProviderType(payload.providerType)
  return {
    providerType,
    providerLabel: payload.providerLabel || getProviderLabel(providerType),
    credentialMode: payload.credentialMode || "personal_api_key",
    status: payload.status || "active",
    isDefault: Boolean(payload.isDefault),
    billingMode: payload.billingMode || "personal",
    monthlyBudgetCents: Number(payload.monthlyBudgetCents || 0),
    currency: payload.currency || "EUR",
    notes: payload.notes || ""
  }
}

function sanitizeProviderAccount(providerAccount) {
  if (!providerAccount) {
    return null
  }

  const { apiKeyEncrypted, ...rest } = providerAccount
  return rest
}

function listProviderAccountsForAccount(accountId) {
  return listProviderAccountsForOwner("account", accountId).map(sanitizeProviderAccount)
}

function createOrUpdateProviderAccountForAccount(accountId, payload = {}) {
  const normalized = normalizeProviderAccountPayload(payload)
  const apiKey = String(payload.apiKey || "").trim()
  if (!apiKey && !payload.id) {
    const error = new Error("Clé API manquante.")
    error.statusCode = 400
    throw error
  }

  const existing = payload.id ? getProviderAccountById(payload.id) : null
  const provider = upsertProviderAccount({
    id: payload.id || undefined,
    ownerScopeType: "account",
    ownerScopeId: accountId,
    providerType: normalized.providerType,
    providerLabel: normalized.providerLabel,
    credentialMode: normalized.credentialMode,
    apiKeyEncrypted: apiKey ? encryptProviderApiKey(apiKey) : existing?.apiKeyEncrypted,
    apiKeyMasked: apiKey ? maskProviderApiKey(apiKey) : existing?.apiKeyMasked,
    status: normalized.status,
    isDefault: normalized.isDefault,
    billingMode: normalized.billingMode,
    monthlyBudgetCents: normalized.monthlyBudgetCents,
    currency: normalized.currency,
    notes: normalized.notes,
    lastTestedAt: existing?.lastTestedAt || "",
    lastError: existing?.lastError || ""
  })

  return sanitizeProviderAccount(provider)
}

function getProviderAccountForAccount(accountId, providerAccountId) {
  const provider = getProviderAccountById(providerAccountId)
  if (!provider || provider.ownerScopeType !== "account" || provider.ownerScopeId !== accountId) {
    return null
  }
  return provider
}

function resolveProviderAccountForUser(accountId, providerType) {
  const normalizedType = validateProviderType(providerType)
  const personal = getDefaultProviderAccountForOwner("account", accountId, normalizedType)
  if (personal?.status === "active") {
    return {
      ...personal,
      resolvedFrom: "account"
    }
  }

  const platformAccounts = getAppSetting("provider_platform_accounts")
  let platform = []
  try {
    platform = platformAccounts?.value_json ? JSON.parse(platformAccounts.value_json) : []
  } catch (_) {
    platform = []
  }
  const platformMatch = platform.find((item) => item.providerType === normalizedType && item.status === "active")
  if (platformMatch) {
    return {
      ...platformMatch,
      resolvedFrom: "platform"
    }
  }

  return null
}

async function testProviderAccount(providerAccount) {
  const provider = typeof providerAccount === "string" ? getProviderAccountById(providerAccount) : providerAccount
  if (!provider) {
    const error = new Error("Compte fournisseur introuvable.")
    error.statusCode = 404
    throw error
  }

  const apiKey = decryptProviderApiKey(provider.apiKeyEncrypted)
  if (!apiKey) {
    return {
      success: false,
      status: "invalid",
      message: "Clé API absente ou illisible."
    }
  }

  try {
    if (provider.providerType === "deepgram") {
      const response = await fetch("https://api.deepgram.com/v1/projects", {
        headers: { Authorization: `Token ${apiKey}` }
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } else if (provider.providerType === "assemblyai") {
      const response = await fetch("https://api.assemblyai.com/v2/transcript", {
        method: "GET",
        headers: { Authorization: apiKey }
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } else if (provider.providerType === "deepseek-api") {
      const response = await fetch(`${process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    } else if (provider.providerType === "mistral-api") {
      const response = await fetch(`${process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1"}/models`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      })
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
    }

    markProviderAccountTestResult(provider.id, {
      success: true,
      status: "active",
      lastTestedAt: new Date().toISOString(),
      lastError: ""
    })

    return {
      success: true,
      status: "active",
      message: "Connexion API validee."
    }
  } catch (error) {
    markProviderAccountTestResult(provider.id, {
      success: false,
      status: "invalid",
      lastTestedAt: new Date().toISOString(),
      lastError: error.message || "Echec de validation."
    })

    return {
      success: false,
      status: "invalid",
      message: error.message || "Echec de validation."
    }
  }
}

module.exports = {
  ALLOWED_PROVIDER_TYPES,
  encryptProviderApiKey,
  decryptProviderApiKey,
  maskProviderApiKey,
  validateProviderType,
  normalizeProviderAccountPayload,
  sanitizeProviderAccount,
  listProviderAccountsForAccount,
  createOrUpdateProviderAccountForAccount,
  getProviderAccountForAccount,
  resolveProviderAccountForUser,
  testProviderAccount,
  updateProviderAccount,
  deactivateProviderAccount
}
