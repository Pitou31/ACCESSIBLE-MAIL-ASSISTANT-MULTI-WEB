const { runMistralApi } = require("./mistralAPI")
const { runDeepseekChat, runDeepseekReasoner } = require("./deepseekAPI")
const { runTogetherApi } = require("./togetherAPI")

async function runAI(model, prompt, options = {}) {
  switch (model) {
    case "mistral-api":
      return await runMistralApi(prompt, options)
    case "together-api":
    case "together-lfm2-24b":
    case "together-llama-3-8b-lite":
    case "together-gemma-3n-e4b":
    case "together-qwen-3-5-9b":
    case "together-gpt-oss-20b":
      return await runTogetherApi(prompt, options)
    case "deepseek-chat":
      return await runDeepseekChat(prompt, options)
    case "deepseek-reasoner":
      return await runDeepseekReasoner(prompt, options)
    default:
      throw new Error(`Modèle non disponible en version Web : ${model}`)
  }
}

module.exports = { runAI }
