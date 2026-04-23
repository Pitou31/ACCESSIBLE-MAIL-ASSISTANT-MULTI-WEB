const OpenAI = require("openai")
const { resolveProviderAccountForUser, decryptProviderApiKey } = require("./providerAccountService")
const { recordProviderUsageEvent } = require("./databaseService")

const DEEPSEEK_PRICING_USD_PER_1M = {
  inputCacheHit: Number(process.env.DEEPSEEK_INPUT_CACHE_HIT_USD_PER_1M || 0.028),
  inputCacheMiss: Number(process.env.DEEPSEEK_INPUT_CACHE_MISS_USD_PER_1M || 0.28),
  output: Number(process.env.DEEPSEEK_OUTPUT_USD_PER_1M || 0.42)
}

function getClient(overrideApiKey = "") {
  const apiKey = overrideApiKey || process.env.DEEPSEEK_API_KEY
  if (!apiKey || apiKey === "replace_me") {
    throw new Error("DEEPSEEK_API_KEY manquante dans .env")
  }

  return new OpenAI({
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com",
    apiKey
  })
}

async function resolveDeepseekApiKeyForAccount(accountId) {
  const provider = resolveProviderAccountForUser(accountId, "deepseek-api")
  if (!provider?.apiKeyEncrypted) {
    return ""
  }
  return decryptProviderApiKey(provider.apiKeyEncrypted)
}

function normalizeUsage(usage = {}) {
  const promptTokens = Number(usage?.prompt_tokens || 0)
  const promptCacheHitTokens = Number(usage?.prompt_cache_hit_tokens || 0)
  const promptCacheMissTokens = Number(
    usage?.prompt_cache_miss_tokens !== undefined
      ? usage?.prompt_cache_miss_tokens
      : Math.max(0, promptTokens - promptCacheHitTokens)
  )
  const completionTokens = Number(usage?.completion_tokens || 0)
  const totalTokens = Number(usage?.total_tokens || (promptTokens + completionTokens) || 0)
  return {
    promptTokens,
    promptCacheHitTokens,
    promptCacheMissTokens,
    completionTokens,
    totalTokens
  }
}

function estimateDeepseekUsageCost(usage = {}) {
  const normalizedUsage = normalizeUsage(usage)
  const estimatedCostAmount =
    (normalizedUsage.promptCacheHitTokens * DEEPSEEK_PRICING_USD_PER_1M.inputCacheHit) / 1_000_000
    + (normalizedUsage.promptCacheMissTokens * DEEPSEEK_PRICING_USD_PER_1M.inputCacheMiss) / 1_000_000
    + (normalizedUsage.completionTokens * DEEPSEEK_PRICING_USD_PER_1M.output) / 1_000_000

  return {
    quantity: normalizedUsage.totalTokens,
    quantityUnit: "tokens",
    estimatedCostAmount,
    estimatedCostCents: Math.round(estimatedCostAmount * 100),
    currency: "USD",
    usage: normalizedUsage
  }
}

async function recordDeepseekUsage({ accountId, provider, model, prompt, usage = {}, status = "success", errorMessage = "" }) {
  if (!accountId || !provider?.id) {
    return null
  }

  const cost = estimateDeepseekUsageCost(usage)
  return recordProviderUsageEvent({
    accountId,
    providerAccountId: provider.id,
    providerType: provider.providerType || "deepseek-api",
    featureType: "llm_generation",
    requestMode: model,
    quantity: cost.quantity,
    quantityUnit: cost.quantityUnit,
    estimatedCostCents: cost.estimatedCostCents,
    estimatedCostAmount: cost.estimatedCostAmount,
    currency: cost.currency,
    status,
    requestId: `deepseek-${model}-${Date.now()}`,
    metadataJson: JSON.stringify({
      model,
      promptLength: String(prompt || "").length,
      promptTokens: cost.usage.promptTokens,
      promptCacheHitTokens: cost.usage.promptCacheHitTokens,
      promptCacheMissTokens: cost.usage.promptCacheMissTokens,
      completionTokens: cost.usage.completionTokens,
      totalTokens: cost.usage.totalTokens,
      errorMessage: errorMessage || ""
    })
  })
}

async function runDeepseekChat(prompt, options = {}) {
  const accountId = String(options.accountId || "").trim()
  const provider = accountId ? resolveProviderAccountForUser(accountId, "deepseek-api") : null
  const apiKey = options.apiKey || (provider?.apiKeyEncrypted ? decryptProviderApiKey(provider.apiKeyEncrypted) : "")
  const client = getClient(apiKey)

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-chat",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
    await recordDeepseekUsage({
      accountId,
      provider,
      model: "deepseek-chat",
      prompt,
      usage: completion?.usage || {},
      status: "success"
    })
    return completion.choices[0].message.content
  } catch (error) {
    await recordDeepseekUsage({
      accountId,
      provider,
      model: "deepseek-chat",
      prompt,
      status: "error",
      errorMessage: error.message || "Erreur DeepSeek"
    })
    throw error
  }
}

async function runDeepseekReasoner(prompt, options = {}) {
  const accountId = String(options.accountId || "").trim()
  const provider = accountId ? resolveProviderAccountForUser(accountId, "deepseek-api") : null
  const apiKey = options.apiKey || (provider?.apiKeyEncrypted ? decryptProviderApiKey(provider.apiKeyEncrypted) : "")
  const client = getClient(apiKey)

  try {
    const completion = await client.chat.completions.create({
      model: "deepseek-reasoner",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
    await recordDeepseekUsage({
      accountId,
      provider,
      model: "deepseek-reasoner",
      prompt,
      usage: completion?.usage || {},
      status: "success"
    })
    return completion.choices[0].message.content
  } catch (error) {
    await recordDeepseekUsage({
      accountId,
      provider,
      model: "deepseek-reasoner",
      prompt,
      status: "error",
      errorMessage: error.message || "Erreur DeepSeek"
    })
    throw error
  }
}

module.exports = {
  getClient,
  resolveDeepseekApiKeyForAccount,
  runDeepseekChat,
  runDeepseekReasoner
}
