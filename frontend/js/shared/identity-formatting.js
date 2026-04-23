(function (root, factory) {
  root.MailIdentityFormatting = factory()
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  function maskToken(token, keep = 1) {
    const value = String(token || "")
    if (!value) return ""
    if (value.length <= keep) return value[0] + "***"
    return value.slice(0, keep) + "*".repeat(Math.max(3, value.length - keep))
  }

  function maskEmail(value) {
    const email = String(value || "").trim()
    if (!email || !email.includes("@")) return email

    const [localPart, domainPart] = email.split("@")
    const maskedLocal = localPart
      .split(/([._+-])/)
      .map((part) => (/^[._+-]$/.test(part) ? part : maskToken(part, 1)))
      .join("")

    const domainParts = domainPart.split(".")
    const tld = domainParts.length > 1 ? domainParts.pop() : ""
    const maskedDomainHead = domainParts.map((part) => maskToken(part, 1)).join(".")

    return tld ? `${maskedLocal}@${maskedDomainHead}.${tld}` : `${maskedLocal}@${maskedDomainHead}`
  }

  function buildPersonTitle({ firstName = "", lastName = "", email = "" } = {}) {
    const displayName = `${String(firstName || "").trim()} ${String(lastName || "").trim()}`.trim()
    if (displayName) return displayName
    if (email) return maskEmail(email)
    return "Identité non renseignée"
  }

  return {
    maskEmail,
    buildPersonTitle
  }
})
