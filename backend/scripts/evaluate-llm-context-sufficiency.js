#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../..", ".env") })

const { createReplyDiagnostic } = require("../src/controllers/mailController")

const DEFAULT_MODELS = [
  "deepseek-chat",
  "deepseek-reasoner",
  "mistral-api"
]

const SAMPLE_PAYLOAD = {
  applicationScope: "mail_assistant",
  workflowScope: "reply",
  mailboxScope: "global",
  mailCategoryScope: "demande_document",
  receivedMail: [
    "From : Emma Girard <jsoule2010@gmail.com>",
    "Date : Wed, 25 Mar 2026 22:19:53 +0000",
    "Objet : Transmission d'une photo de document",
    "",
    "Bonjour,",
    "",
    "Comme convenu, je vous transmets en piece jointe une photo du document demande.",
    "Pouvez-vous me confirmer qu'elle est suffisamment lisible ?",
    "",
    "Merci par avance.",
    "",
    "Bien cordialement,",
    "Emma Girard"
  ].join("\n"),
  receivedAttachmentsSummary: "1 pièce jointe détectée : photo_document.jpg",
  receivedAttachments: [
    {
      filename: "photo_document.jpg",
      mimeType: "image/jpeg",
      extractedText: "",
      summaryText: "",
      analysisStatus: "detected_only"
    }
  ]
}

const GENERAL_RULES = [
  "1. Ne jamais confirmer la lisibilite d'un document image si son contenu n'a pas ete exploite automatiquement.",
  "2. Si une information necessaire manque, produire une reponse prudente et demander un complement ou une verification.",
  "3. Utiliser d'abord le contenu effectivement traite par l'application pour les pieces jointes.",
  "4. Ne jamais inventer une information absente du contexte.",
  "5. En cas de doute, demander un complement ou une validation humaine."
].join("\n")

function truncate(value, max = 400) {
  const text = String(value || "").replace(/\s+/g, " ").trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

async function runCase(model, activeRulesText, options = {}) {
  const startedAt = Date.now()
  try {
    const result = await createReplyDiagnostic({
      ...SAMPLE_PAYLOAD,
      activeRulesText,
      disableStoredRules: Boolean(options.disableStoredRules)
    }, {
      model,
      rulesPromptMode: options.promptMode || "reference"
    })

    return {
      model,
      ok: true,
      elapsedMs: Date.now() - startedAt,
      provider: result.meta?.provider || model,
      fallback: Boolean(result.meta?.fallback),
      fallbackError: result.meta?.error || "",
      appliedRuleCount: Number(result.meta?.appliedRuleCount || 0),
      appliedRuleTitles: result.meta?.appliedRuleTitles || [],
      contextSufficient: Boolean(result.diagnostic?.contextSufficient),
      shouldConsultRules: Boolean(result.diagnostic?.shouldConsultRules),
      rulesWouldHelp: Boolean(result.diagnostic?.rulesWouldHelp),
      missingInformation: Array.isArray(result.diagnostic?.missingInformation) ? result.diagnostic.missingInformation : [],
      reasoningSummary: result.diagnostic?.reasoningSummary || "",
      body: result.diagnostic?.draftResponse || ""
    }
  } catch (error) {
    return {
      model,
      ok: false,
      elapsedMs: Date.now() - startedAt,
      error: error.message || String(error)
    }
  }
}

async function main() {
  const args = process.argv.slice(2)
  const promptModeIndex = args.indexOf("--prompt-mode")
  const promptMode = promptModeIndex >= 0
    ? String(args[promptModeIndex + 1] || "reference").trim().toLowerCase() || "reference"
    : "reference"
  const models = args.filter((value, index) => index !== promptModeIndex && index !== promptModeIndex + 1).filter(Boolean)
  const selectedModels = models.length > 0 ? models : DEFAULT_MODELS
  const results = []

  for (const model of selectedModels) {
    results.push({
      scenario: "sans_regle",
      ...(await runCase(model, "", { disableStoredRules: true, promptMode }))
    })
    results.push({
      scenario: "avec_regle",
      ...(await runCase(model, GENERAL_RULES, { promptMode }))
    })
  }

  console.log(JSON.stringify({
    generatedAt: new Date().toISOString(),
    sample: "photo_document_lisibilite",
    promptMode,
    results
  }, null, 2))

  console.log("\nResume lisible :")
  for (const row of results) {
    if (!row.ok) {
      console.log(`- ${row.model} / ${row.scenario} : ERREUR (${row.error})`)
      continue
    }
    console.log(`- ${row.model} / ${row.scenario} : ${row.elapsedMs} ms | fallback=${row.fallback} | regles=${row.appliedRuleCount} | suffisant=${row.contextSufficient} | consulter_regles=${row.shouldConsultRules} | regles_utiles=${row.rulesWouldHelp} | erreur=${truncate(row.fallbackError || "aucune", 120)} | ${truncate(row.body)}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
