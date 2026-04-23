const { runAI } = require("./aiRouter")

const DEFAULT_AI_TIMEOUT_MS = Number(process.env.DEFAULT_AI_TIMEOUT_MS || 60000)
const REASONER_AI_TIMEOUT_MS = Number(process.env.REASONER_AI_TIMEOUT_MS || 120000)

function debugAi(...args) {
  console.log("[AI-TIMEOUT]", ...args)
}

function getTimeoutForModel(model) {
  if (model === "deepseek-reasoner") {
    return REASONER_AI_TIMEOUT_MS
  }

  return DEFAULT_AI_TIMEOUT_MS
}

function getRequestId(options = {}) {
  return String(options.requestId || `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`)
}

async function runAIWithTimeout(model, prompt, options = {}) {
  const requestId = getRequestId(options)
  const timeoutMs = getTimeoutForModel(model)
  const controller = new AbortController()

  const mergedOptions = {
    ...options,
    requestId,
    signal: controller.signal
  }

  debugAi(`[${requestId}] START model=${model} timeoutMs=${timeoutMs}`)

  let timeoutId = null

  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(async () => {
      debugAi(`[${requestId}] TIMEOUT fired model=${model}`)
      controller.abort()
      debugAi(`[${requestId}] ABORT sent model=${model}`)

      const error = new Error(
        `Temps d'attente dépassé pour ${model} (${Math.round(timeoutMs / 1000)} s)`
      )
      error.code = "AI_TIMEOUT_ABORTED"
      error.statusCode = 504
      reject(error)
    }, timeoutMs)
  })

  const aiPromise = runAI(model, prompt, mergedOptions)
    .then((result) => {
      debugAi(`[${requestId}] AI resolved model=${model}`)
      return result
    })
    .catch(async (error) => {
      debugAi(
        `[${requestId}] AI rejected model=${model} name=${error?.name || "unknown"} message=${error?.message || error}`
      )

      if (
        controller.signal.aborted ||
        error?.name === "AbortError" ||
        error?.name === "APIUserAbortError"
      ) {
        const abortError = new Error(
          `Temps d'attente dépassé pour ${model} (${Math.round(timeoutMs / 1000)} s)`
        )
        abortError.code = "AI_TIMEOUT_ABORTED"
        abortError.statusCode = 504
        throw abortError
      }

      throw error
    })

  try {
    const result = await Promise.race([aiPromise, timeoutPromise])
    debugAi(`[${requestId}] RACE resolved model=${model}`)
    return result
  } catch (error) {
    debugAi(`[${requestId}] RACE rejected model=${model} error=${error?.message || error}`)
    throw error
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
    debugAi(`[${requestId}] FINALLY model=${model}`)
    aiPromise.catch(() => {})
  }
}

module.exports = {
  runAIWithTimeout,
  getTimeoutForModel
}
