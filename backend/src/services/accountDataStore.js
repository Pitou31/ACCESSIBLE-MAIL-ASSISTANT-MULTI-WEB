const fs = require("fs/promises")
const path = require("path")

const projectRoot = path.resolve(__dirname, "../../..")
const dataDirectory = path.join(projectRoot, "backend", "data")

const dataFiles = {
  requests: path.join(dataDirectory, "account-requests.json"),
  accounts: path.join(dataDirectory, "accounts.json"),
  mailboxes: path.join(dataDirectory, "mailboxes.json"),
  actions: path.join(dataDirectory, "account-actions.json")
}

async function ensureDataStore() {
  await fs.mkdir(dataDirectory, { recursive: true })

  await Promise.all(
    Object.values(dataFiles).map(async (filePath) => {
      try {
        await fs.access(filePath)
      } catch (_) {
        await fs.writeFile(filePath, "[]\n", "utf8")
      }
    })
  )
}

async function readCollection(filePath) {
  await ensureDataStore()
  const raw = await fs.readFile(filePath, "utf8")

  try {
    return JSON.parse(raw || "[]")
  } catch (_) {
    return []
  }
}

async function writeCollection(filePath, items) {
  await ensureDataStore()
  await fs.writeFile(filePath, `${JSON.stringify(items, null, 2)}\n`, "utf8")
}

async function readRequests() {
  return readCollection(dataFiles.requests)
}

async function writeRequests(items) {
  return writeCollection(dataFiles.requests, items)
}

async function readAccounts() {
  return readCollection(dataFiles.accounts)
}

async function writeAccounts(items) {
  return writeCollection(dataFiles.accounts, items)
}

async function readMailboxes() {
  return readCollection(dataFiles.mailboxes)
}

async function writeMailboxes(items) {
  return writeCollection(dataFiles.mailboxes, items)
}

async function readActions() {
  return readCollection(dataFiles.actions)
}

async function writeActions(items) {
  return writeCollection(dataFiles.actions, items)
}

module.exports = {
  dataDirectory,
  dataFiles,
  ensureDataStore,
  readRequests,
  writeRequests,
  readAccounts,
  writeAccounts,
  readMailboxes,
  writeMailboxes,
  readActions,
  writeActions
}
