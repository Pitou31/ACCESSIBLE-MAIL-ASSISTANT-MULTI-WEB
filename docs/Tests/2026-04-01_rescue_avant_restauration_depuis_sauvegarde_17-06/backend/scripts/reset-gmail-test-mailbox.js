#!/usr/bin/env node

require("dotenv").config({ path: require("path").resolve(__dirname, "../../.env") })

const path = require("path")
const crypto = require("crypto")
const { DatabaseSync } = require("node:sqlite")
const { sendDataset } = require("./send-gmail-test-dataset")

const projectRoot = path.resolve(__dirname, "../..")
const databasePath = path.join(projectRoot, "backend", "data", "agent-mail-assistant.db")

function parseArgs(argv) {
  const args = {
    email: "",
    reinject: true
  }

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index]

    if (value === "--email") {
      args.email = argv[index + 1] || ""
      index += 1
      continue
    }

    if (value === "--no-reinject") {
      args.reinject = false
    }
  }

  return args
}

function getEncryptionKey() {
  const raw = process.env.MAILBOX_TOKEN_SECRET || process.env.SESSION_SECRET || process.env.APP_SECRET || "mailbox-dev-secret-change-me"
  return crypto.createHash("sha256").update(raw).digest()
}

function decryptSecret(value = "") {
  if (!value) return ""
  const [ivHex, tagHex, encryptedHex] = String(value).split(":")
  if (!ivHex || !tagHex || !encryptedHex) {
    return ""
  }

  const key = getEncryptionKey()
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"))
  decipher.setAuthTag(Buffer.from(tagHex, "hex"))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, "hex")),
    decipher.final()
  ])
  return decrypted.toString("utf8")
}

function encryptSecret(value = "") {
  if (!value) return ""
  const iv = crypto.randomBytes(12)
  const key = getEncryptionKey()
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv)
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  return [iv.toString("hex"), tag.toString("hex"), encrypted.toString("hex")].join(":")
}

function openDatabase() {
  const db = new DatabaseSync(databasePath)
  db.exec("PRAGMA foreign_keys = ON;")
  return db
}

async function refreshGoogleAccessToken(refreshToken) {
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID || ""
  const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET || ""
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token"
    })
  })

  const result = await response.json()
  if (!response.ok) {
    throw new Error(result.error_description || result.error || "Echec du rafraîchissement OAuth Google.")
  }

  return result
}

async function getAccessToken(db, connection) {
  const now = Date.now()
  const accessToken = decryptSecret(connection.oauth_access_token || "")
  const refreshToken = decryptSecret(connection.oauth_refresh_token || "")
  const expiry = connection.oauth_token_expires_at ? new Date(connection.oauth_token_expires_at).getTime() : 0

  if (accessToken && expiry > now + 30_000) {
    return accessToken
  }

  if (!refreshToken) {
    throw new Error("Aucun refresh token disponible pour cette boîte Gmail.")
  }

  const refreshed = await refreshGoogleAccessToken(refreshToken)
  const encryptedAccessToken = encryptSecret(refreshed.access_token)
  const expiresAt = new Date(Date.now() + Number(refreshed.expires_in || 3600) * 1000).toISOString()

  db.prepare(`
    UPDATE mailbox_connections
    SET oauth_access_token = ?,
        oauth_token_expires_at = ?,
        updated_at = ?,
        last_error = ''
    WHERE id = ?
  `).run(encryptedAccessToken, expiresAt, new Date().toISOString(), connection.id)

  return refreshed.access_token
}

async function gmailRequest(accessToken, pathValue, options = {}) {
  const response = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${pathValue}`, {
    method: options.method || "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {})
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined
  })

  const rawText = await response.text()
  const result = rawText ? JSON.parse(rawText) : {}
  if (!response.ok) {
    throw new Error(result.error?.message || `Erreur Gmail API sur ${pathValue}`)
  }

  return result
}

async function listAllMessageIds(accessToken) {
  const ids = []
  let pageToken = ""

  do {
    const params = new URLSearchParams({
      includeSpamTrash: "true",
      maxResults: "500"
    })
    if (pageToken) {
      params.set("pageToken", pageToken)
    }

    const result = await gmailRequest(accessToken, `messages?${params.toString()}`)
    for (const message of result.messages || []) {
      ids.push(message.id)
    }
    pageToken = result.nextPageToken || ""
  } while (pageToken)

  return ids
}

async function listAllDraftIds(accessToken) {
  const ids = []
  let pageToken = ""

  do {
    const params = new URLSearchParams({
      maxResults: "500"
    })
    if (pageToken) {
      params.set("pageToken", pageToken)
    }

    const result = await gmailRequest(accessToken, `drafts?${params.toString()}`)
    for (const draft of result.drafts || []) {
      ids.push(draft.id)
    }
    pageToken = result.nextPageToken || ""
  } while (pageToken)

  return ids
}

async function trashMessages(accessToken, messageIds) {
  for (const messageId of messageIds) {
    await gmailRequest(accessToken, `messages/${encodeURIComponent(messageId)}/trash`, {
      method: "POST",
      body: {}
    })
  }
}

async function deleteDrafts(accessToken, draftIds) {
  for (const draftId of draftIds) {
    await gmailRequest(accessToken, `drafts/${encodeURIComponent(draftId)}`, {
      method: "DELETE"
    })
  }
}

async function deleteCustomLabels(accessToken) {
  const result = await gmailRequest(accessToken, "labels")
  const labels = Array.isArray(result.labels) ? result.labels : []
  const labelsToDelete = labels.filter((label) =>
    ["AMA_TRAITE", "AMA_REJETE", "AMA_SUPPRIME"].includes(label.name)
  )

  for (const label of labelsToDelete) {
    try {
      await gmailRequest(accessToken, `labels/${encodeURIComponent(label.id)}`, {
        method: "DELETE"
      })
    } catch (error) {
      console.warn(`Label non supprimé (${label.name}) : ${error.message}`)
    }
  }
}

function resetLocalTracking(db, connection) {
  const deletedActions = db.prepare(`
    DELETE FROM mailbox_message_actions
    WHERE account_id = ?
      AND connection_id = ?
  `).run(connection.account_id, connection.id).changes

  const deletedCollaborations = db.prepare(`
    DELETE FROM mailbox_message_collaboration
    WHERE connection_id = ?
  `).run(connection.id).changes

  return {
    deletedActions,
    deletedCollaborations
  }
}

async function resetMailbox(email, reinject) {
  const db = openDatabase()
  const normalizedEmail = String(email || "").trim().toLowerCase()
  if (!normalizedEmail) {
    throw new Error("Adresse Gmail de test manquante. Utiliser --email adresse@gmail.com")
  }

  const connection = db.prepare(`
    SELECT *
    FROM mailbox_connections
    WHERE mailbox_email = ?
      AND provider_id = 'gmail'
    ORDER BY updated_at DESC
    LIMIT 1
  `).get(normalizedEmail)

  if (!connection) {
    throw new Error(`Aucune connexion Gmail enregistrée pour ${normalizedEmail}`)
  }

  const initialLocalReset = resetLocalTracking(db, connection)
  console.log(`Etat local initial supprimé : ${initialLocalReset.deletedActions} action(s), ${initialLocalReset.deletedCollaborations} collaboration(s)`)

  const accessToken = await getAccessToken(db, connection)
  const messageIds = await listAllMessageIds(accessToken)
  const draftIds = await listAllDraftIds(accessToken)

  await trashMessages(accessToken, messageIds)
  await deleteDrafts(accessToken, draftIds)
  await deleteCustomLabels(accessToken)
  const finalLocalReset = resetLocalTracking(db, connection)

  console.log(`Boîte nettoyée : ${normalizedEmail}`)
  console.log(`Messages déplacés vers la corbeille : ${messageIds.length}`)
  console.log(`Brouillons supprimés : ${draftIds.length}`)
  console.log(`Etat local final supprimé : ${finalLocalReset.deletedActions} action(s), ${finalLocalReset.deletedCollaborations} collaboration(s)`)

  if (reinject) {
    await sendDataset(normalizedEmail, false)
    console.log(`Jeu de test réinjecté : ${normalizedEmail}`)
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const targetEmail = args.email || process.env.TEST_GMAIL_RECIPIENT || ""
  await resetMailbox(targetEmail, args.reinject)
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || error)
    process.exit(1)
  })
}
