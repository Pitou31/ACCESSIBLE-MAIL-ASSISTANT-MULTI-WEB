#!/usr/bin/env node
require("dotenv").config({ path: require("path").join(__dirname, "../..", ".env") })

const {
  listMailRules,
  createMailRule,
  updateMailRule
} = require("../src/services/databaseService")

const BASE_RULES = [
  {
    title: "Ne pas confirmer la lisibilite d'une image non analysee",
    ruleType: "prudence",
    applicationScope: "mail_assistant",
    mailboxScope: "global",
    mailCategoryScope: "demande_document",
    workflowScope: "reply",
    theme: "pieces_jointes",
    missingInfoAction: "ask_for_more",
    priorityRank: 10,
    status: "active",
    content: "Si une image jointe n'a pas ete exploitee automatiquement, ne pas confirmer sa lisibilite. Indiquer qu'une verification ou un complement est necessaire.",
    notes: "Regle generale pour les documents images signales sans texte exploitable."
  },
  {
    title: "Produire une reponse prudente si une information necessaire manque",
    ruleType: "missing_info",
    applicationScope: "mail_assistant",
    mailboxScope: "global",
    mailCategoryScope: "global",
    workflowScope: "reply",
    theme: "prudence",
    missingInfoAction: "cautious_reply",
    priorityRank: 20,
    status: "active",
    content: "Si le contexte du mail, des pieces jointes et des regles ne suffit pas, produire une reponse prudente, demander un complement ou signaler qu'une verification est necessaire.",
    notes: "Regle generale de controle de completude."
  },
  {
    title: "Ne jamais inventer une information absente du contexte",
    ruleType: "prudence",
    applicationScope: "mail_assistant",
    mailboxScope: "global",
    mailCategoryScope: "global",
    workflowScope: "global",
    theme: "prudence",
    missingInfoAction: "require_human_validation",
    priorityRank: 5,
    status: "active",
    content: "Ne jamais inventer une information absente du contexte transmis. Ne pas confirmer un fait, une disponibilite, une conformite ou une lisibilite sans element explicite.",
    notes: "Garde-fou global principal."
  },
  {
    title: "Répondre aux demandes d'information sur les délais",
    ruleType: "content",
    applicationScope: "mail_assistant",
    mailboxScope: "global",
    mailCategoryScope: "global",
    workflowScope: "reply",
    theme: "delais",
    missingInfoAction: "cautious_reply",
    priorityRank: 15,
    status: "active",
    content: "Lorsqu'un mail demande un délai, un délai de réponse ou une date de retour, ne pas inventer de délai chiffré absent du contexte. Accuser réception de la demande, indiquer qu'elle est prise en compte, annoncer une réponse dans les meilleurs délais et signaler qu'une vérification humaine est nécessaire si un délai précis doit être confirmé.",
    notes: "Règle socle pour les demandes d'information portant sur les délais."
  }
]

function main() {
  const existingRules = listMailRules({})
  let created = 0
  let updated = 0

  for (const rule of BASE_RULES) {
    const existing = existingRules.find((item) => item.title === rule.title)
    if (!existing) {
      createMailRule({
        ...rule,
        createdBy: "codex-seed",
        updatedBy: "codex-seed"
      })
      created += 1
      continue
    }

    updateMailRule(existing.id, {
      ...rule,
      updatedBy: "codex-seed"
    })
    updated += 1
  }

  console.log(JSON.stringify({
    ok: true,
    created,
    updated,
    total: BASE_RULES.length
  }, null, 2))
}

main()
