const isEmail = require("validator/lib/isEmail")
const SINGLE_EMAIL_SEPARATORS = /[\s,;]+/g

function normalizeEmailInput(value) {
  return String(value || "").trim().toLowerCase()
}

function validateEmailAddress(value, options = {}) {
  const normalized = normalizeEmailInput(value)

  if (!normalized) {
    return options.required === false
      ? { ok: true, code: "empty_allowed", message: "", normalized }
      : { ok: false, code: "empty", message: "Adresse mail obligatoire.", normalized }
  }

  if (/\s/.test(normalized)) {
    return { ok: false, code: "spaces", message: "Adresse mail invalide : espaces interdits.", normalized }
  }

  const ok = isEmail(normalized, {
    allow_display_name: false,
    allow_utf8_local_part: false,
    require_tld: true,
    allow_ip_domain: false,
    domain_specific_validation: false
  })

  return ok
    ? { ok: true, code: "valid", message: "", normalized }
    : { ok: false, code: "invalid", message: "Adresse mail invalide.", normalized }
}

module.exports = {
  normalizeEmailInput,
  validateEmailAddress,
  splitEmailList,
  validateEmailList
}

function splitEmailList(value) {
  return String(value || "")
    .trim()
    .split(SINGLE_EMAIL_SEPARATORS)
    .map((item) => normalizeEmailInput(item))
    .filter(Boolean)
}

function validateEmailList(value, options = {}) {
  const entries = splitEmailList(value)

  if (entries.length === 0) {
    return options.required === false
      ? { ok: true, code: "empty_allowed", message: "", normalized: [], entries: [] }
      : { ok: false, code: "empty", message: "Au moins une adresse mail est requise.", normalized: [], entries: [] }
  }

  const seen = new Set()
  const details = []
  for (const entry of entries) {
    const validation = validateEmailAddress(entry)
    if (!validation.ok) {
      return {
        ok: false,
        code: "invalid_entry",
        message: `Adresse mail invalide dans la liste : ${entry}`,
        normalized: entries,
        entries: details.concat([{ value: entry, validation }])
      }
    }

    if (options.unique !== false) {
      if (seen.has(validation.normalized)) {
        return {
          ok: false,
          code: "duplicate",
          message: `Adresse mail en double : ${entry}`,
          normalized: entries,
          entries: details.concat([{ value: entry, validation }])
        }
      }
      seen.add(validation.normalized)
    }

    details.push({ value: entry, validation })
  }

  return {
    ok: true,
    code: "valid",
    message: "",
    normalized: entries,
    entries: details
  }
}
