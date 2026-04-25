const fs = require("fs")
const path = require("path")
const { execFile } = require("child_process")
const { promisify } = require("util")
const { getSessionPayloadFromRequest } = require("./accountRoutes")

const execFileAsync = promisify(execFile)

const PROJECT_NAME = process.env.BACKUP_PROJECT_NAME || "ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB"
const PROJECT_ROOT = process.env.BACKUP_PROJECT_ROOT || path.resolve(__dirname, "../../..")
const BACKUP_ROOT = process.env.BACKUP_ROOT || path.join(path.dirname(PROJECT_ROOT), "backups")
const SNAPSHOT_ROOT = path.join(BACKUP_ROOT, "accessible_mail_assistant_multi_web")
const SNAPSHOT_SCRIPT = process.env.BACKUP_SCRIPT || "/Users/jacquessoule/bin/project-backup.sh"
const RESTORE_BIS_PATH = process.env.RESTORE_BIS_PATH || path.join(path.dirname(PROJECT_ROOT), "ACCESSIBLE_MAIL_ASSISTANT_MULTI_WEB_BIS")
const ADMIN_ROLES = new Set(["admin", "super_admin"])

function requireAdminSession(req, res) {
  const payload = getSessionPayloadFromRequest(req)
  if (payload && ADMIN_ROLES.has(payload.account?.role)) {
    return payload
  }

  res.writeHead(payload ? 403 : 401, {
    "Content-Type": "application/json"
  })
  res.end(JSON.stringify({
    ok: false,
    error: payload
      ? "Accès administrateur requis."
      : "Connexion administrateur requise."
  }))
  return null
}

function sanitizeLabel(label) {
  return String(label || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 120)
}

function listSnapshots() {
  if (!fs.existsSync(SNAPSHOT_ROOT)) {
    return []
  }

  return fs.readdirSync(SNAPSHOT_ROOT, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => b.localeCompare(a, "fr"))
    .map((name) => {
      const fullPath = path.join(SNAPSHOT_ROOT, name)
      const stats = fs.statSync(fullPath)
      const manifestPath = path.join(fullPath, "manifest.txt")
      let manifest = ""
      if (fs.existsSync(manifestPath)) {
        manifest = fs.readFileSync(manifestPath, "utf8")
      }

      return {
        name,
        fullPath,
        updatedAt: stats.mtime.toISOString(),
        hasManifest: fs.existsSync(manifestPath),
        title: manifest.match(/^Titre\s+:\s+(.+)$/m)?.[1] || "snapshot sans titre"
      }
    })
}

async function handleBackupsList(req, res) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const latestLink = path.join(SNAPSHOT_ROOT, "LATEST")
    let latestTarget = null
    if (fs.existsSync(latestLink)) {
      latestTarget = fs.readlinkSync(latestLink)
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      projectName: PROJECT_NAME,
      projectRoot: PROJECT_ROOT,
      backupRoot: BACKUP_ROOT,
      snapshotRoot: SNAPSHOT_ROOT,
      restoreBisPath: RESTORE_BIS_PATH,
      snapshotScript: fs.existsSync(SNAPSHOT_SCRIPT) ? SNAPSHOT_SCRIPT : "",
      latestTarget,
      snapshots: listSnapshots()
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur de lecture des snapshots."
    }))
  }
}

async function handleBackupsSnapshotCreate(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const label = sanitizeLabel(data.label)

    if (!label) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Titre de sauvegarde manquant."
      }))
      return
    }

    if (!fs.existsSync(SNAPSHOT_SCRIPT)) {
      res.writeHead(503, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Script de sauvegarde indisponible sur cet environnement."
      }))
      return
    }

    const { stdout, stderr } = await execFileAsync(SNAPSHOT_SCRIPT, [
      "--source", PROJECT_ROOT,
      "--name", PROJECT_NAME,
      "--label", label
    ], {
      cwd: PROJECT_ROOT,
      maxBuffer: 1024 * 1024 * 20
    })

    const snapshots = listSnapshots()
    const latest = snapshots[0] || null

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      message: "Snapshot créé.",
      latest,
      stdout,
      stderr
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la création du snapshot."
    }))
  }
}

async function handleBackupsRestoreBis(req, res, body) {
  const sessionPayload = requireAdminSession(req, res)
  if (!sessionPayload) {
    return
  }

  try {
    const data = JSON.parse(body || "{}")
    const snapshotName = String(data.snapshotName || "").trim()
    const reuseDependencies = data.reuseDependencies !== false

    if (!snapshotName) {
      res.writeHead(400, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Snapshot source manquant."
      }))
      return
    }

    const sourceSnapshot = path.join(SNAPSHOT_ROOT, snapshotName)
    if (!fs.existsSync(sourceSnapshot)) {
      res.writeHead(404, { "Content-Type": "application/json" })
      res.end(JSON.stringify({
        ok: false,
        error: "Snapshot introuvable."
      }))
      return
    }

    await execFileAsync("/usr/bin/rsync", [
      "-a",
      "--delete",
      `${sourceSnapshot}/`,
      `${RESTORE_BIS_PATH}/`
    ], {
      cwd: PROJECT_ROOT,
      maxBuffer: 1024 * 1024 * 20
    })

    let dependenciesReused = false
    const currentNodeModules = path.join(PROJECT_ROOT, "node_modules")
    const bisNodeModules = path.join(RESTORE_BIS_PATH, "node_modules")

    if (reuseDependencies && fs.existsSync(currentNodeModules)) {
      fs.mkdirSync(bisNodeModules, { recursive: true })
      await execFileAsync("/usr/bin/rsync", [
        "-a",
        `${currentNodeModules}/`,
        `${bisNodeModules}/`
      ], {
        cwd: PROJECT_ROOT,
        maxBuffer: 1024 * 1024 * 20
      })
      dependenciesReused = true
    }

    res.writeHead(200, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: true,
      message: "Projet BIS restauré.",
      snapshotName,
      restoreBisPath: RESTORE_BIS_PATH,
      dependenciesReused
    }))
  } catch (error) {
    res.writeHead(500, { "Content-Type": "application/json" })
    res.end(JSON.stringify({
      ok: false,
      error: error.message || "Erreur lors de la restauration BIS."
    }))
  }
}

module.exports = {
  handleBackupsList,
  handleBackupsSnapshotCreate,
  handleBackupsRestoreBis
}
