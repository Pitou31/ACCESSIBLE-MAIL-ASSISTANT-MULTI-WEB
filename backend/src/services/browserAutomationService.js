const {
  getMailboxConnectionByIdForAccount,
  upsertAutomationPolicy,
  getAutomationPolicyForConnection,
  createBrowserUseSession,
  listBrowserUseSessionsForConnection
} = require("./databaseService")
const { getConnectedInboxMessage } = require("./mailboxService")

const PRODUCT_VERSION_CAPABILITIES = {
  base: {
    browserAutomationAllowed: false,
    maxAutomationLevel: "manual_assisted"
  },
  automatisation_legere: {
    browserAutomationAllowed: true,
    maxAutomationLevel: "semi_automated"
  },
  automatisation_poussee: {
    browserAutomationAllowed: true,
    maxAutomationLevel: "advanced_automation"
  }
}

const AUTOMATION_LEVELS = ["manual_assisted", "semi_automated", "advanced_automation"]
const OBJECTIVE_DEFAULTS = {
  open_inbox: "Ouvrir la boîte et lister les mails visibles",
  open_message: "Ouvrir un mail ciblé et collecter son contexte",
  prepare_reply: "Préparer une réponse avec validation humaine avant envoi",
  inject_reply: "Réinjecter un brouillon validé dans le webmail"
}

function getProductVersionCapabilities(productVersion = "base") {
  return PRODUCT_VERSION_CAPABILITIES[productVersion] || PRODUCT_VERSION_CAPABILITIES.base
}

function normalizeAutomationLevel(level = "") {
  const normalized = String(level || "").trim().toLowerCase()
  return AUTOMATION_LEVELS.includes(normalized) ? normalized : "manual_assisted"
}

function getAutomationLevelRank(level) {
  return AUTOMATION_LEVELS.indexOf(normalizeAutomationLevel(level))
}

function createError(message, statusCode = 400) {
  const error = new Error(message)
  error.statusCode = statusCode
  return error
}

function ensureConnectionAccess(accountId, connectionId) {
  const connection = getMailboxConnectionByIdForAccount(connectionId, accountId)
  if (!connection) {
    throw createError("Connexion boîte mail introuvable.", 404)
  }

  if (connection.connection_status !== "connected") {
    throw createError("La boîte mail doit être connectée avant d'activer l'automatisation navigateur.", 403)
  }

  return connection
}

function buildDefaultPolicy(account, connection) {
  const capabilities = getProductVersionCapabilities(account.product_version)

  return {
    policyScope: "mailbox_connection",
    policyStatus: capabilities.browserAutomationAllowed ? "draft" : "disabled",
    automationLevel: capabilities.browserAutomationAllowed ? capabilities.maxAutomationLevel : "manual_assisted",
    browserProvider: "browser_use",
    browserEnabled: capabilities.browserAutomationAllowed,
    navigationEnabled: capabilities.browserAutomationAllowed,
    messageOpenEnabled: capabilities.browserAutomationAllowed,
    contextCollectionEnabled: capabilities.browserAutomationAllowed,
    draftInjectionEnabled: capabilities.browserAutomationAllowed,
    sendEnabled: false,
    humanValidationRequired: true,
    allowedActions: capabilities.browserAutomationAllowed
      ? ["open_inbox", "open_message", "prepare_reply", "inject_reply"]
      : [],
    policy: {
      providerMode: "planned_integration",
      mailboxEmail: connection.mailbox_email,
      productVersion: account.product_version,
      defaultObjective: "prepare_reply",
      v2Guardrails: [
        "validation_humaine_obligatoire",
        "aucun_envoi_automatique",
        "journalisation_systematique"
      ]
    }
  }
}

function ensurePolicyCompatibleWithAccount(account, requestedLevel, browserEnabled) {
  const capabilities = getProductVersionCapabilities(account.product_version)
  const level = normalizeAutomationLevel(requestedLevel)

  if (browserEnabled && !capabilities.browserAutomationAllowed) {
    throw createError("Cette version produit n'autorise pas encore l'automatisation navigateur.", 403)
  }

  if (getAutomationLevelRank(level) > getAutomationLevelRank(capabilities.maxAutomationLevel)) {
    throw createError("Le niveau d'automatisation demandé dépasse les droits de la version produit de ce compte.", 403)
  }
}

function getOrCreateAutomationPolicy(account, connectionId) {
  const connection = ensureConnectionAccess(account.id, connectionId)
  const existingPolicy = getAutomationPolicyForConnection(account.id, connectionId)
  if (existingPolicy) {
    return {
      connection,
      policy: existingPolicy
    }
  }

  const savedPolicy = upsertAutomationPolicy({
    accountId: account.id,
    connectionId,
    ...buildDefaultPolicy(account, connection),
    updatedBy: account.id
  })

  return {
    connection,
    policy: savedPolicy
  }
}

function updateAutomationPolicy(account, connectionId, payload = {}) {
  const { connection, policy: existingPolicy } = getOrCreateAutomationPolicy(account, connectionId)
  const nextBrowserEnabled = payload.browserEnabled ?? existingPolicy.browser_enabled
  const nextLevel = normalizeAutomationLevel(payload.automationLevel || existingPolicy.automation_level)

  ensurePolicyCompatibleWithAccount(account, nextLevel, nextBrowserEnabled)

  const humanValidationRequired = payload.humanValidationRequired ?? existingPolicy.human_validation_required
  const sendEnabled = payload.sendEnabled ?? existingPolicy.send_enabled
  const safeSendEnabled = humanValidationRequired ? false : Boolean(sendEnabled)

  const nextPolicy = upsertAutomationPolicy({
    accountId: account.id,
    connectionId,
    policyScope: payload.policyScope || existingPolicy.policy_scope,
    policyStatus: payload.policyStatus || (nextBrowserEnabled ? "active" : "disabled"),
    automationLevel: nextLevel,
    browserProvider: payload.browserProvider || existingPolicy.browser_provider,
    browserEnabled: nextBrowserEnabled,
    navigationEnabled: payload.navigationEnabled ?? existingPolicy.navigation_enabled,
    messageOpenEnabled: payload.messageOpenEnabled ?? existingPolicy.message_open_enabled,
    contextCollectionEnabled: payload.contextCollectionEnabled ?? existingPolicy.context_collection_enabled,
    draftInjectionEnabled: payload.draftInjectionEnabled ?? existingPolicy.draft_injection_enabled,
    sendEnabled: safeSendEnabled,
    humanValidationRequired,
    allowedActions: Array.isArray(payload.allowedActions) ? payload.allowedActions : existingPolicy.allowed_actions,
    policy: {
      ...existingPolicy.policy,
      ...(payload.policy && typeof payload.policy === "object" ? payload.policy : {}),
      mailboxEmail: connection.mailbox_email,
      updatedForVersion: account.product_version
    },
    updatedBy: payload.updatedBy || account.id
  })

  return {
    connection,
    policy: nextPolicy
  }
}

function buildExecutionPlan({ connection, policy, objective, message }) {
  const steps = [
    {
      id: "check-policy",
      action: "assert_policy",
      description: "Vérifier les droits, le niveau d'automatisation et les garde-fous actifs.",
      requiresHumanValidation: false
    }
  ]

  if (objective === "open_inbox" || objective === "open_message" || objective === "prepare_reply" || objective === "inject_reply") {
    steps.push({
      id: "open-webmail",
      action: "open_url",
      description: `Ouvrir l'interface webmail de ${connection.mailbox_email}.`,
      requiresHumanValidation: false
    })
  }

  if (policy.navigation_enabled) {
    steps.push({
      id: "navigate-inbox",
      action: "navigate_inbox",
      description: "Naviguer vers le dossier ou la vue contenant les messages à traiter.",
      requiresHumanValidation: false
    })
  }

  if (objective !== "open_inbox" && message) {
    steps.push({
      id: "open-message",
      action: "open_message",
      description: `Ouvrir le message ciblé "${message.subject || "(Sans objet)"}".`,
      targetMessageId: message.id,
      requiresHumanValidation: false
    })
  }

  if (policy.context_collection_enabled && message) {
    steps.push({
      id: "collect-context",
      action: "collect_context",
      description: "Collecter les éléments visibles utiles au traitement avant IA.",
      targetMessageId: message.id,
      requiresHumanValidation: false
    })
  }

  if (objective === "prepare_reply") {
    steps.push({
      id: "prepare-reply",
      action: "prepare_reply",
      description: "Ouvrir la zone de réponse et préparer l'injection du brouillon validé.",
      targetMessageId: message?.id || "",
      requiresHumanValidation: Boolean(policy.human_validation_required)
    })
  }

  if (objective === "inject_reply") {
    steps.push({
      id: "inject-reply",
      action: "inject_reply",
      description: "Insérer le texte de réponse validé dans l'éditeur du webmail.",
      targetMessageId: message?.id || "",
      requiresHumanValidation: Boolean(policy.human_validation_required)
    })
  }

  steps.push({
    id: "journalize-session",
    action: "write_trace",
    description: "Journaliser la session et son résultat pour audit.",
    requiresHumanValidation: false
  })

  return steps
}

async function startBrowserAutomationSession(account, payload = {}) {
  const connectionId = String(payload.connectionId || "").trim()
  const objective = String(payload.objective || "prepare_reply").trim()
  const targetMessageId = String(payload.messageId || "").trim()

  if (!connectionId) {
    throw createError("Connexion boîte mail manquante.")
  }

  if (!OBJECTIVE_DEFAULTS[objective]) {
    throw createError("Objectif d'automatisation navigateur inconnu.")
  }

  const { connection, policy } = getOrCreateAutomationPolicy(account, connectionId)
  if (!policy.browser_enabled || policy.policy_status === "disabled") {
    throw createError("L'automatisation navigateur n'est pas activée pour cette boîte.", 403)
  }

  if (!policy.allowed_actions.includes(objective)) {
    throw createError("Cette action navigateur n'est pas autorisée par la politique active.", 403)
  }

  let message = null
  if (targetMessageId) {
    const result = await getConnectedInboxMessage(account.id, connectionId, targetMessageId)
    message = result.message
  }

  const executionPlan = buildExecutionPlan({
    connection,
    policy,
    objective,
    message
  })

  const sessionStatus = policy.human_validation_required ? "planned" : "ready"
  const session = createBrowserUseSession({
    accountId: account.id,
    connectionId,
    automationPolicyId: policy.id,
    providerId: policy.browser_provider,
    objective,
    targetMessageId,
    sessionStatus,
    runMode: normalizeAutomationLevel(policy.automation_level) === "advanced_automation" ? "autonomous_guarded" : "assistive",
    validationMode: policy.human_validation_required ? "human_required" : "policy_only",
    executionPlan,
    result: {
      objectiveLabel: OBJECTIVE_DEFAULTS[objective],
      providerMode: "planned_integration",
      browserProvider: policy.browser_provider
    },
    metadata: {
      mailboxEmail: connection.mailbox_email,
      productVersion: account.product_version,
      messageSubject: message?.subject || "",
      messagePriority: message?.analysis?.priority || ""
    }
  })

  return {
    connection,
    policy,
    session,
    message
  }
}

function listBrowserAutomationSessions(account, connectionId, options = {}) {
  ensureConnectionAccess(account.id, connectionId)
  return listBrowserUseSessionsForConnection(account.id, connectionId, options)
}

module.exports = {
  getProductVersionCapabilities,
  getOrCreateAutomationPolicy,
  updateAutomationPolicy,
  startBrowserAutomationSession,
  listBrowserAutomationSessions
}
