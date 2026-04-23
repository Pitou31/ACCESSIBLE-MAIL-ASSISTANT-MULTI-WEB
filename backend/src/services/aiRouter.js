const { runMistralApi } = require("./mistralAPI")
const { runDeepseekChat, runDeepseekReasoner } = require("./deepseekAPI")

async function runAI(model, prompt, options = {}) {
  switch (model) {
    case "mistral-api":
      return await runMistralApi(prompt, options)
    case "deepseek-chat":
      return await runDeepseekChat(prompt, options)
    case "deepseek-reasoner":
      return await runDeepseekReasoner(prompt, options)
    default:
      throw new Error(`Modèle non disponible en version Web : ${model}`)
  }
}

module.exports = { runAI }
