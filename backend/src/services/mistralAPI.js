const OpenAI = require("openai")
const { resolveProviderAccountForUser, decryptProviderApiKey } = require("./providerAccountService")
const { recordProviderUsageEvent } = require("./databaseService")

const MISTRAL_PRICING_USD_PER_1M = {
  input: Number(process.env.MISTRAL_INPUT_USD_PER_1M || 0),
  output: Number(process.env.MISTRAL_OUTPUT_USD_PER_1M || 0)
}

function getMistralClient(overrideApiKey = "") {
  const apiKey = overrideApiKey || process.env.MISTRAL_API_KEY
  if (!apiKey || apiKey === "replace_me") {
    throw new Error("MISTRAL_API_KEY manquante dans .env")
  }

  return new OpenAI({
    baseURL: process.env.MISTRAL_BASE_URL || "https://api.mistral.ai/v1",
    apiKey
  })
}

function resolveMistralModel(model = "") {
  const requestedModel = String(model || "").trim().toLowerCase()
  if (requestedModel === "mistral-api") {
    return process.env.MISTRAL_API_MODEL || "mistral-medium-latest"
  }
  return model || process.env.MISTRAL_API_MODEL || "mistral-medium-latest"
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

function estimateMistralUsageCost(usage = {}) {
  const normalizedUsage = normalizeUsage(usage)
  const estimatedCostAmount =
    (normalizedUsage.promptTokens * MISTRAL_PRICING_USD_PER_1M.input) / 1_000_000
    + (normalizedUsage.completionTokens * MISTRAL_PRICING_USD_PER_1M.output) / 1_000_000

  return {
    quantity: normalizedUsage.totalTokens,
    quantityUnit: "tokens",
    estimatedCostAmount,
    estimatedCostCents: Math.round(estimatedCostAmount * 100),
    currency: "USD",
    usage: normalizedUsage
  }
}

async function recordMistralUsage({ accountId, provider, model, prompt, usage = {}, status = "success", errorMessage = "" }) {
  if (!accountId || !provider?.id) {
    return null
  }

  const cost = estimateMistralUsageCost(usage)
  return recordProviderUsageEvent({
    accountId,
    providerAccountId: provider.id,
    providerType: provider.providerType || "mistral-api",
    featureType: "llm_generation",
    requestMode: model,
    quantity: cost.quantity,
    quantityUnit: cost.quantityUnit,
    estimatedCostCents: cost.estimatedCostCents,
    estimatedCostAmount: cost.estimatedCostAmount,
    currency: cost.currency,
    status,
    requestId: `mistral-${model}-${Date.now()}`,
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

async function runMistralApi(prompt, options = {}) {
  const accountId = String(options.accountId || "").trim()
  const provider = accountId ? resolveProviderAccountForUser(accountId, "mistral-api") : null
  const apiKey = options.apiKey || (provider?.apiKeyEncrypted ? decryptProviderApiKey(provider.apiKeyEncrypted) : "")
  const model = resolveMistralModel(options.apiModel || options.model)
  const client = getMistralClient(apiKey)

  try {
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2
    })
    await recordMistralUsage({
      accountId,
      provider,
      model,
      prompt,
      usage: completion?.usage || {},
      status: "success"
    })
    return extractMessageText(completion.choices?.[0]?.message?.content)
  } catch (error) {
    await recordMistralUsage({
      accountId,
      provider,
      model,
      prompt,
      usage: error?.response?.data?.usage || {},
      status: "error",
      errorMessage: error.message || "Erreur Mistral API"
    })
    throw error
  }
}

module.exports = {
  getMistralClient,
  resolveMistralModel,
  runMistralApi
}
