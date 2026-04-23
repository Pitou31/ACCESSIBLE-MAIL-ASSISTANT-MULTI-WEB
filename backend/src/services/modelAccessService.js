const fs = require("fs")
const path = require("path")

const configDir = path.resolve(__dirname, "../../config")
const configPath = path.join(configDir, "model-access.json")

const DEFAULT_CONFIG = {
  roles: {
    mac: {
      blockedModels: []
    },
    spark: {
      blockedModels: []
    }
  }
}

function ensureConfigFile() {
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true })
  }

  if (!fs.existsSync(configPath)) {
    fs.writeFileSync(configPath, JSON.stringify(DEFAULT_CONFIG, null, 2), "utf8")
  }
}

function readConfig() {
  ensureConfigFile()

  try {
    const raw = fs.readFileSync(configPath, "utf8")
    const parsed = JSON.parse(raw)

    return {
      roles: {
        mac: {
          blockedModels: Array.isArray(parsed?.roles?.mac?.blockedModels)
            ? parsed.roles.mac.blockedModels
            : [...DEFAULT_CONFIG.roles.mac.blockedModels]
        },
        spark: {
          blockedModels: Array.isArray(parsed?.roles?.spark?.blockedModels)
            ? parsed.roles.spark.blockedModels
            : [...DEFAULT_CONFIG.roles.spark.blockedModels]
        }
      }
    }
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_CONFIG))
  }
}

function writeConfig(config) {
  ensureConfigFile()
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf8")
}

function getCurrentRole() {
  const role = String(process.env.APP_NODE_ROLE || "mac").trim().toLowerCase()
  return role === "spark" ? "spark" : "mac"
}

function getBlockedModelsForRole(role = getCurrentRole()) {
  return []
}

function isModelBlocked(modelName, role = getCurrentRole()) {
  if (!modelName) return false
  return getBlockedModelsForRole(role).includes(modelName)
}

function assertModelAllowed(modelName, role = getCurrentRole()) {
  if (!modelName) return

  if (isModelBlocked(modelName, role)) {
    const error = new Error(
      `Le modèle ${modelName} est interdit sur le noeud ${role} car il est trop lourd ou désactivé.`
    )
    error.code = "MODEL_BLOCKED_FOR_ROLE"
    error.statusCode = 403
    throw error
  }
}

function filterAllowedModels(models, role = getCurrentRole()) {
  const blocked = new Set(getBlockedModelsForRole(role))
  return (models || []).filter(model => !blocked.has(model?.value))
}

function blockModelForRole(role, modelName) {
  const normalizedRole = String(role || "").trim().toLowerCase()
  const normalizedModel = String(modelName || "").trim()

  if (!normalizedModel) {
    throw new Error("Nom de modèle manquant.")
  }

  if (!["mac", "spark"].includes(normalizedRole)) {
    throw new Error(`Rôle invalide: ${role}`)
  }

  const config = readConfig()
  const current = new Set(config.roles[normalizedRole].blockedModels || [])
  current.add(normalizedModel)
  config.roles[normalizedRole].blockedModels = [...current].sort()
  writeConfig(config)

  return config
}

function allowModelForRole(role, modelName) {
  const normalizedRole = String(role || "").trim().toLowerCase()
  const normalizedModel = String(modelName || "").trim()

  if (!normalizedModel) {
    throw new Error("Nom de modèle manquant.")
  }

  if (!["mac", "spark"].includes(normalizedRole)) {
    throw new Error(`Rôle invalide: ${role}`)
  }

  const config = readConfig()
  config.roles[normalizedRole].blockedModels = (config.roles[normalizedRole].blockedModels || [])
    .filter(name => name !== normalizedModel)
    .sort()

  writeConfig(config)

  return config
}

module.exports = {
  configPath,
  readConfig,
  writeConfig,
  getCurrentRole,
  getBlockedModelsForRole,
  isModelBlocked,
  assertModelAllowed,
  filterAllowedModels,
  blockModelForRole,
  allowModelForRole
}
