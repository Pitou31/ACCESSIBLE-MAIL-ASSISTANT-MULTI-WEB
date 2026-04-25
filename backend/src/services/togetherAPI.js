const OpenAI = require("openai")
const { resolveProviderAccountForUser, decryptProviderApiKey } = require("./providerAccountService")
const { recordProviderUsageEvent } = require("./databaseService")

const TOGETHER_PRICING_USD_PER_1M = {
  input: Number(process.env.TOGETHER_INPUT_USD_PER_1M || 0),
  output: Number(process.env.TOGETHER_OUTPUT_USD_PER_1M || 0)
}

const TOGETHER_MODEL_ALIASES = {
  "together-api": () => process.env.TOGETHER_API_MODEL || "LiquidAI/LFM2-24B-A2B",
  "together-lfm2-24b": () => process.env.TOGETHER_LFM2_24B_MODEL || "LiquidAI/LFM2-24B-A2B",
  "together-llama-3-8b-lite": () => process.env.TOGETHER_LLAMA_3_8B_LITE_MODEL || "meta-llama/Meta-Llama-3-8B-Instruct-Lite",
  "together-gemma-3n-e4b": () => process.env.TOGETHER_GEMMA_3N_E4B_MODEL || "google/gemma-3n-E4B-it",
  "together-qwen-3-5-9b": () => process.env.TOGETHER_QWEN_3_5_9B_MODEL || "Qwen/Qwen3.5-9B",
  "together-gpt-oss-20b": () => process.env.TOGETHER_GPT_OSS_20B_MODEL || "openai/gpt-oss-20b"
}

function getTogetherClient(overrideApiKey = "") {
  const apiKey = overrideApiKey || process.env.TOGETHER_API_KEY
  if (!apiKey || apiKey === "replace_me") {
    throw new Error("TOGETHER_API_KEY manquante dans .env ou dans les fournisseurs utilisateur")
  }

  return new OpenAI({
    baseURL: process.env.TOGETHER_BASE_URL || "https://api.together.xyz/v1",
    apiKey
  })
}

function resolveTogetherModel(model = "") {
  const requestedModel = String(model || "").trim()
  const normalized = requestedModel.toLowerCase()
  if (TOGETHER_MODEL_ALIASES[normalized]) {
    return TOGETHER_MODEL_ALIASES[normalized]()
  }
  return requestedModel || TOGETHER_MODEL_ALIASES["together-api"]()
}

function extractMessageText(messageContent) {
  if (typeof messageContent === "string") {
    return messageContent
  }

  if (Array.isArray(messageContent)) {
    return messageContent
      .map((item) => {
        if (typeof item === "string") return item
        if (item?.type === "text") return item.text || ""
        return ""
      })
      .join("\n")
      .trim()
  }

  return ""
}

function normalizeUsage(usage = {}) {
  const promptTokens = Number(usage?.prompt_tokens || 0)
  const completionTokens = Number(usage?.completion_tokens || 0)
  const totalTokens = Number(usage?.total_tokens || (promptTokens + completionTokens) || 0)
  return {
    promptTokens,
    completionTokens,
    totalTokens
  }
}

function estimateTogetherUsageCost(usage = {}) {
  const normalizedUsage = normalizeUsage(usage)
  const estimatedCostAmount =
    (normalizedUsage.promptTokens * TOGETHER_PRICING_USD_PER_1M.input) / 1_000_000
    + (normalizedUsage.completionTokens * TOGETHER_PRICING_USD_PER_1M.output) / 1_000_000

  return {
    quantity: normalizedUsage.totalTokens,
    quantityUnit: "tokens",
    estimatedCostAmount,
    estimatedCostCents: Math.round(estimatedCostAmount * 100),
    currency: "USD",
    usage: normalizedUsage
  }
}

async function recordTogetherUsage({ accountId, provider, model, prompt, usage = {}, status = "success", errorMessage = "" }) {
  if (!accountId || !provider?.id) {
    return null
  }

  const cost = estimateTogetherUsageCost(usage)
  return recordProviderUsageEvent({
    accountId,
    providerAccountId: provider.id,
    providerType: provider.providerType || "together-api",
    featureType: "llm_generation",
    requestMode: model,
    quantity: cost.quantity,
    quantityUnit: cost.quantityUnit,
    estimatedCostCents: cost.estimatedCostCents,
    estimatedCostAmount: cost.estimatedCostAmount,
    currency: cost.currency,
    status,
    requestId: `together-${Date.now()}`,
    metadataJson: JSON.stringify({
      model,
      promptLength: String(prompt || "").length,
      promptTokens: cost.usage.promptTokens,
      completionTokens: cost.usage.completionTokens,
      totalTokens: cost.usage.totalTokens,
      errorMessage: errorMessage || ""
    })
  })
}

async function runTogetherApi(prompt, options = {}) {
  const accountId = String(options.accountId || "").trim()
  const provider = accountId ? resolveProviderAccountForUser(accountId, "together-api") : null
  const apiKey = options.apiKey || (provider?.apiKeyEncrypted ? decryptProviderApiKey(provider.apiKeyEncrypted) : "")
  const model = resolveTogetherModel(options.apiModel || options.model)
  const client = getTogetherClient(apiKey)

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
    await recordTogetherUsage({
      accountId,
      provider,
      model,
      prompt,
      usage: completion?.usage || {},
      status: "success"
    })
    return extractMessageText(completion.choices?.[0]?.message?.content)
  } catch (error) {
    await recordTogetherUsage({
      accountId,
      provider,
      model,
      prompt,
      usage: error?.response?.data?.usage || {},
      status: "error",
      errorMessage: error.message || "Erreur Together API"
    })
    throw error
  }
}

module.exports = {
  getTogetherClient,
  resolveTogetherModel,
  runTogetherApi
}
