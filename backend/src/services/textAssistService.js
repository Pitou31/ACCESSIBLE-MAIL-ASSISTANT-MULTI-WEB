const {
  createTranslationStreamPlan,
  processTranslation
} = require("./translationService")
const {
  processSummary
} = require("./summaryService")
const {
  processRephrase
} = require("./rephraseService")

function assertSupportedAction(payload = {}) {
  const action = String(payload.action || "").trim().toLowerCase()
  if (action !== "translate" && action !== "summarize" && action !== "rephrase") {
    throw new Error("Action d'assistance textuelle non prise en charge.")
  }
  return action
}

function createTextAssistStreamPlan(payload = {}) {
  const action = assertSupportedAction(payload)
  if (action !== "translate") {
    throw new Error("Le streaming n'est disponible que pour la traduction.")
  }
  return createTranslationStreamPlan(payload)
}

async function processTextAssist(payload = {}, options = {}) {
  const action = assertSupportedAction(payload)
  if (action === "translate") {
    return await processTranslation(payload, options)
  }
  if (action === "summarize") {
    return await processSummary(payload, options)
  }
  if (action === "rephrase") {
    return await processRephrase(payload, options)
  }
  throw new Error("Action d'assistance textuelle non prise en charge.")
}

module.exports = {
  createTextAssistStreamPlan,
  processTextAssist
}
