const fs = require("fs")
const os = require("os")
const path = require("path")
const zlib = require("zlib")
const { execFileSync } = require("child_process")

function decodeBase64UrlBuffer(value = "") {
  if (!value) return Buffer.alloc(0)
  const sanitized = String(value)
    .replace(/^data:[^;]+;base64,/, "")
    .trim()
  const normalized = sanitized.replace(/-/g, "+").replace(/_/g, "/")
  const padding = normalized.length % 4 === 0 ? "" : "=".repeat(4 - (normalized.length % 4))
  return Buffer.from(normalized + padding, "base64")
}

function stripHtmlTags(value = "") {
  return String(value || "")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function decodeXmlEntities(value = "") {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
}

function normalizeLines(value = "") {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
}

function toMarkdownText(value = "") {
  const normalized = normalizeLines(value)
  if (!normalized.trim()) {
    return ""
  }

  const lines = normalized.split("\n")
  const output = []
  let previousBlank = false

  lines.forEach((line) => {
    const trimmed = line.trim()

    if (!trimmed) {
      if (!previousBlank && output.length > 0) {
        output.push("")
      }
      previousBlank = true
      return
    }

    const bulletLike = /^[-*]\s+/.test(trimmed)
      || /^\d+[.)]\s+/.test(trimmed)
      || /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9 _-]{0,80}\s*:\s*$/.test(trimmed)

    if (bulletLike) {
      output.push(trimmed)
    } else {
      output.push(trimmed)
    }

    previousBlank = false
  })

  return output.join("\n").trim()
}

function decodePdfLiteralString(value = "") {
  return String(value || "")
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\n")
    .replace(/\\t/g, "\t")
}

function decodePdfHexString(value = "") {
  const cleaned = String(value || "").replace(/[^0-9A-Fa-f]/g, "")
  if (!cleaned) {
    return ""
  }

  const normalized = cleaned.length % 2 === 0 ? cleaned : `${cleaned}0`
  const buffer = Buffer.from(normalized, "hex")

  if (!buffer.length) {
    return ""
  }

  const decodeUtf16BeBuffer = (sourceBuffer) => {
    const swapped = Buffer.alloc(sourceBuffer.length)
    for (let index = 0; index < sourceBuffer.length; index += 2) {
      swapped[index] = sourceBuffer[index + 1] ?? 0
      swapped[index + 1] = sourceBuffer[index]
    }
    return swapped.toString("utf16le").replace(/\u0000/g, "")
  }

  if (buffer.length >= 2) {
    const bom = buffer.subarray(0, 2)
    if (bom[0] === 0xFE && bom[1] === 0xFF) {
      return decodeUtf16BeBuffer(buffer.subarray(2))
    }
    if (bom[0] === 0xFF && bom[1] === 0xFE) {
      return buffer.subarray(2).toString("utf16le").replace(/\u0000/g, "")
    }
  }

  const zeroByteRatio = buffer.length
    ? Array.from(buffer).filter((byte) => byte === 0x00).length / buffer.length
    : 0

  if (zeroByteRatio > 0.2) {
    return decodeUtf16BeBuffer(buffer)
  }

  return buffer.toString("latin1")
}

function extractPdfArrayText(value = "") {
  const parts = []

  for (const item of String(value || "").matchAll(/\(([^()]*(?:\\.[^()]*)*)\)|<([0-9A-Fa-f\s]+)>/g)) {
    if (item[1]) {
      parts.push(decodePdfLiteralString(item[1]))
      continue
    }

    if (item[2]) {
      parts.push(decodePdfHexString(item[2]))
    }
  }

  return parts.join("\n")
}

function normalizeExtractedPdfText(value = "") {
  return String(value || "")
    .replace(/\u0000/g, "")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
}

function repairFragmentedPdfText(value = "") {
  const collapseFragmentedUnit = (unit) => {
    const trimmed = String(unit || "").trim()
    if (!trimmed) {
      return ""
    }

    return trimmed
      .replace(/\b([A-ZÀ-Ý])\s+([a-zà-ÿ]{2,}(?:[’'][A-Za-zÀ-ÿ]+)?)\b/g, "$1$2")
      .replace(/\b(?:[A-Za-zÀ-ÿ]\s+){1,}[A-Za-zÀ-ÿ]\b/g, (match) => match.replace(/\s+/g, ""))
  }

  const repairLine = (line) => {
    const trimmedLine = String(line || "").trim()
    if (!trimmedLine) {
      return ""
    }

    const units = trimmedLine.split(/\s{2,}/).map(collapseFragmentedUnit).filter(Boolean)
    return units.join(" ")
      .replace(/\b([A-Za-zÀ-ÿ]+)\s+[’']\s+([A-Za-zÀ-ÿ]+)/g, "$1’$2")
      .replace(/\(\s+/g, "(")
      .replace(/\s+\)/g, ")")
  }

  return normalizeLines(value)
    .split("\n")
    .map(repairLine)
    .join("\n")
    .replace(/\b([A-ZÀ-Ý])\s+([A-ZÀ-Ý])\b/g, "$1$2")
    .replace(/\(\s*([A-ZÀ-Ý])(?:\s+([A-ZÀ-Ý]))+\s*\)/g, (match) => `(${match.replace(/[()\s]/g, "")})`)
    .replace(/\b(\d)\s+(\d)\b/g, "$1$2")
    .replace(/\b([A-Za-zÀ-ÿ]+)\s*-\s*([A-Za-zÀ-ÿ]+)\b/g, "$1-$2")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/([“"«])\s+/g, "$1")
    .replace(/\s+([”"»])/g, "$1")
    .replace(/\b(\d+)([A-ZÀ-Ý][a-zà-ÿ]{1,})\b/g, "$1 $2")
    // Keep repeated page headers/footers from gluing themselves to body text.
    .replace(/([.!?])\s+(\d{1,3})\s+([A-ZÀ-Ý][A-Za-zÀ-ÿ]+(?:\s+[A-ZÀ-Ý][A-Za-zÀ-ÿ]+){2,})/g, "$1\n\n$2 $3")
    .replace(/\b(Table of Contents|Agent FAQs)\s+(\d{1,3})\b/g, "$1\n$2")
    .replace(/\b(Intro|Contents)\s+(\d{1,3})\s+(The\s+[A-ZÀ-Ý])/g, "$1 $2\n$3")
    .replace(/\b(\d{1,3})\s+(The Prompt Stage|The Examples & Files Stage|The Multi-Agent Stage|The Context Engineering Stage|The Metadata Stage|The Takeaway)/g, "\n$1\n$2")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function stripPdfPageArtifacts(value = "") {
  const normalized = normalizeLines(value)
  const repeatedHeaderPatterns = [
    /^\d{1,3}\s+The Evolution of AI Agent Management: From Prompts to Metadata(?:\s+Table of Contents)?\s*$/gmi
  ]

  let cleaned = normalized
  repeatedHeaderPatterns.forEach((pattern) => {
    cleaned = cleaned.replace(pattern, "")
  })

  cleaned = cleaned
    // Remove standalone page numbers inserted between title-like lines.
    .replace(/\n(\d{1,3})\n(?=[A-ZÀ-Ý][^\n]{8,}\n)/g, "\n")
    // Remove page number prefixes before long repeated title lines.
    .replace(/\n\d{1,3}\s+(?=The Evolution of AI Agent Management: From Prompts to Metadata)/g, "\n")
    .replace(/\n{3,}/g, "\n\n")

  return cleaned.trim()
}

function isLikelyTableOfContentsLine(line = "") {
  const normalizedLine = String(line || "").trim()
  if (!normalizedLine) {
    return false
  }

  if (/table of contents/i.test(normalizedLine)) {
    return true
  }

  if (/^[A-ZÀ-Ý][A-Za-zÀ-ÿ0-9&,:;'"()!?\- ]{3,120}\s+\d{1,3}$/u.test(normalizedLine)) {
    return true
  }

  if (/^(intro|contents|agent faqs?)(\s+\d{1,3})?$/i.test(normalizedLine)) {
    return true
  }

  if (/^(the prompt stage|the examples & files stage|the multi-agent stage|the context engineering stage|the metadata stage|the takeaway)\b/i.test(normalizedLine)) {
    return true
  }

  return false
}

function stripLeadingTableOfContents(value = "") {
  const normalized = normalizeLines(value).trim()
  if (!normalized) {
    return ""
  }

  const lines = normalized.split("\n").map((line) => line.trim())
  const firstBodyLineIndex = lines.findIndex((line) => {
    const text = String(line || "").trim()
    return /[.!?]/.test(text) && text.length > 140
  })

  if (firstBodyLineIndex <= 0) {
    return normalized
  }

  const leadingLines = lines.slice(0, firstBodyLineIndex).filter(Boolean)
  const tocLikeLines = leadingLines.filter((line) => isLikelyTableOfContentsLine(line)).length
  const pageNumberOnlyLines = leadingLines.filter((line) => /^\d{1,3}$/.test(line)).length
  const headingLikeLines = leadingLines.filter((line) => /^[A-ZÀ-Ý][A-Za-zÀ-ÿ0-9&,:;'"()!?\- ]{10,120}$/u.test(line)).length

  if ((tocLikeLines + pageNumberOnlyLines + headingLikeLines) < Math.max(5, Math.floor(leadingLines.length * 0.7))) {
    return normalized
  }

  const preservedTitleLines = []
  for (const line of leadingLines) {
    if (!line) {
      if (preservedTitleLines.length) {
        break
      }
      continue
    }
    if (isLikelyTableOfContentsLine(line) || /^\d{1,3}$/.test(line)) {
      break
    }
    preservedTitleLines.push(line)
    if (preservedTitleLines.length >= 3) {
      break
    }
  }

  return [...preservedTitleLines, ...lines.slice(firstBodyLineIndex)]
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

function extractPdfTextOperators(source = "") {
  const parts = []

  for (const match of source.matchAll(/\(([^()]*(?:\\.[^()]*)*)\)\s*Tj/g)) {
    parts.push(decodePdfLiteralString(match[1]))
  }

  for (const match of source.matchAll(/<([0-9A-Fa-f\s]+)>\s*Tj/g)) {
    parts.push(decodePdfHexString(match[1]))
  }

  for (const match of source.matchAll(/\[(.*?)\]\s*TJ/gs)) {
    parts.push(extractPdfArrayText(match[1]))
  }

  return normalizeExtractedPdfText(parts.join("\n"))
}

function extractPdfStreams(buffer) {
  const streams = []
  const raw = buffer.toString("latin1")
  const streamRegex = /<<(.*?)>>\s*stream\r?\n/gs
  let match

  while ((match = streamRegex.exec(raw)) !== null) {
    const dict = match[1] || ""
    const streamStart = match.index + match[0].length
    const endMatch = /\r?\nendstream/g.exec(raw.slice(streamStart))
    if (!endMatch) {
      continue
    }

    const streamEnd = streamStart + endMatch.index
    const streamBuffer = buffer.subarray(streamStart, streamEnd)
    streams.push({
      dict,
      buffer: streamBuffer
    })
  }

  return streams
}

function inflatePdfStream(streamBuffer) {
  try {
    return zlib.inflateSync(streamBuffer)
  } catch (_) {
    try {
      return zlib.inflateRawSync(streamBuffer)
    } catch (_) {
      return null
    }
  }
}

function extractPrintableTextRuns(source = "") {
  const matches = String(source || "").match(/[A-Za-zÀ-ÿ0-9][A-Za-zÀ-ÿ0-9 ,;:!?'"%()\/\-_@&\n]{15,}/g) || []
  return normalizeExtractedPdfText(matches.join("\n"))
}

function extractPdfTextHeuristically(buffer) {
  const directRaw = buffer.toString("latin1")
  const directText = extractPdfTextOperators(directRaw)
  if (directText) {
    return directText
  }

  const streamTexts = extractPdfStreams(buffer)
    .map((stream) => {
      const hasFlate = /\/FlateDecode/.test(stream.dict)
      const payload = hasFlate ? inflatePdfStream(stream.buffer) : stream.buffer
      if (!payload || !payload.length) {
        return ""
      }

      return extractPdfTextOperators(payload.toString("latin1"))
    })
    .filter(Boolean)

  const joinedStreamText = normalizeExtractedPdfText(streamTexts.join("\n\n"))
  if (joinedStreamText) {
    return joinedStreamText
  }

  const printableFallback = extractPrintableTextRuns(directRaw)
  if (printableFallback) {
    return printableFallback
  }

  const streamPrintableFallback = extractPdfStreams(buffer)
    .map((stream) => {
      const hasFlate = /\/FlateDecode/.test(stream.dict)
      const payload = hasFlate ? inflatePdfStream(stream.buffer) : stream.buffer
      if (!payload || !payload.length) {
        return ""
      }

      return extractPrintableTextRuns(payload.toString("latin1"))
    })
    .filter(Boolean)
    .join("\n\n")

  return normalizeExtractedPdfText(streamPrintableFallback)
}

function extractDocxText(buffer, filename = "document.docx") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ama-docx-"))
  const sourcePath = path.join(tempDir, filename)
  try {
    fs.writeFileSync(sourcePath, buffer)
    const documentXml = execFileSync("/usr/bin/unzip", ["-p", sourcePath, "word/document.xml"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    })

    const text = documentXml
      .replace(/<w:p[^>]*>/g, "\n\n")
      .replace(/<w:br[^/>]*\/>/g, "\n")
      .replace(/<w:tab[^/>]*\/>/g, "\t")
      .replace(/<w:t[^>]*>/g, "")
      .replace(/<\/w:t>/g, "")
      .replace(/<[^>]+>/g, "")

    return decodeXmlEntities(normalizeLines(text))
      .replace(/\n{3,}/g, "\n\n")
      .trim()
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (_) {
      // Rien de bloquant ici.
    }
  }
}

function extractDocxMarkdown(buffer, filename = "document.docx") {
  const text = extractDocxText(buffer, filename)
  return toMarkdownText(text)
}

function extractPdfTextWithPdfjs(buffer, filename = "document.pdf") {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "ama-pdf-"))
  const sourcePath = path.join(tempDir, filename)
  const pdfjsModulePath = require.resolve("pdfjs-dist/legacy/build/pdf.mjs")

  try {
    fs.writeFileSync(sourcePath, buffer)
    const text = execFileSync(process.execPath, [
      "--input-type=module",
      "-e",
      [
        "import fs from 'fs';",
        "const sourcePath = process.argv[1];",
        "const modulePath = process.argv[2];",
        "const pdfjs = await import(modulePath);",
        "const data = new Uint8Array(fs.readFileSync(sourcePath));",
        "const document = await pdfjs.getDocument({ data, useWorkerFetch: false, isEvalSupported: false }).promise;",
        "const parts = [];",
        "for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {",
        "  const page = await document.getPage(pageNumber);",
        "  const content = await page.getTextContent();",
        "  const items = content.items.map((item) => ('str' in item ? item.str : '')).filter(Boolean);",
        "  parts.push(items.join(' '));",
        "}",
        "console.log(parts.join('\\n\\n'));"
      ].join(" "),
      sourcePath,
      pdfjsModulePath
    ], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    }).trim()

    return {
      text,
      strategy: "pdfjs-dist",
      error: ""
    }
  } catch (error) {
    return {
      text: "",
      strategy: "pdfjs-dist",
      error: error.message || "Extraction PDF impossible avec pdfjs-dist."
    }
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true })
    } catch (_) {
      // Rien de bloquant ici.
    }
  }
}

function extractPdfMarkdown(buffer) {
  const pdfjsResult = extractPdfTextWithPdfjs(buffer)
  const heuristicText = pdfjsResult.text ? "" : extractPdfTextHeuristically(buffer)
  const finalText = stripPdfPageArtifacts(repairFragmentedPdfText(pdfjsResult.text || heuristicText))

  return {
    text: toMarkdownText(finalText),
    strategy: pdfjsResult.text ? pdfjsResult.strategy : (heuristicText ? "heuristic-pdf" : pdfjsResult.strategy),
    error: pdfjsResult.text || heuristicText ? "" : pdfjsResult.error || "Aucun texte extractible détecté dans le PDF."
  }
}

function extractAttachmentTextFromBuffer({ buffer, filename = "", contentType = "" }) {
  const normalizedContentType = String(contentType || "").toLowerCase()
  const normalizedFilename = String(filename || "").toLowerCase()
  const isOpenXmlOfficeDocument = normalizedContentType.includes("openxmlformats-officedocument")

  if (!buffer || !buffer.length) {
    return ""
  }

  if (
    normalizedContentType.startsWith("text/")
    || normalizedContentType.includes("json")
    || (normalizedContentType.includes("xml") && !isOpenXmlOfficeDocument)
    || normalizedFilename.endsWith(".txt")
    || normalizedFilename.endsWith(".md")
    || normalizedFilename.endsWith(".csv")
    || normalizedFilename.endsWith(".json")
    || normalizedFilename.endsWith(".xml")
    || normalizedFilename.endsWith(".html")
    || normalizedFilename.endsWith(".htm")
  ) {
    const text = buffer.toString("utf8").trim()
    if (normalizedFilename.endsWith(".txt") || normalizedFilename.endsWith(".md")) {
      return text
    }

    if (normalizedContentType.includes("html") || normalizedFilename.endsWith(".html") || normalizedFilename.endsWith(".htm")) {
      return toMarkdownText(stripHtmlTags(text))
    }

    return toMarkdownText(text)
  }

  if (
    normalizedContentType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    || normalizedFilename.endsWith(".docx")
  ) {
    return extractDocxMarkdown(buffer, filename || "document.docx")
  }

  if (normalizedContentType === "application/pdf" || normalizedFilename.endsWith(".pdf")) {
    return extractPdfMarkdown(buffer).text
  }

  return ""
}

function normalizeAttachmentForAI(attachment = {}, options = {}) {
  const rawData = attachment.rawData || attachment.base64Data || ""
  const buffer = decodeBase64UrlBuffer(rawData)
  const normalizedFilename = attachment.filename || ""
  const normalizedContentType = attachment.contentType || ""
  const maxExtractedTextLength = Number.isFinite(Number(options.maxExtractedTextLength))
    ? Number(options.maxExtractedTextLength)
    : 5000
  const isPdf = String(normalizedContentType).toLowerCase() === "application/pdf" || String(normalizedFilename).toLowerCase().endsWith(".pdf")
  const pdfExtraction = isPdf
    ? extractPdfMarkdown(buffer)
    : null
  const extractedText = attachment.extractedText
    || (pdfExtraction ? pdfExtraction.text : extractAttachmentTextFromBuffer({
      buffer,
      filename: normalizedFilename,
      contentType: normalizedContentType
    }))

  return {
    filename: normalizedFilename || "fichier",
    contentType: normalizedContentType || "application/octet-stream",
    size: Number(attachment.size || buffer.length || 0),
    base64Data: rawData || buffer.toString("base64"),
    extractedText: extractedText
      ? (maxExtractedTextLength > 0 ? extractedText.slice(0, maxExtractedTextLength) : extractedText)
      : "",
    hasUsableText: Boolean(extractedText && extractedText.trim()),
    extractionStrategy: pdfExtraction?.strategy || "",
    extractionError: pdfExtraction?.error || ""
  }
}

function buildAttachmentContext(attachments = [], options = {}) {
  const normalizedAttachments = Array.isArray(attachments)
    ? attachments.map((attachment) => normalizeAttachmentForAI(attachment, options))
    : []

  if (normalizedAttachments.length === 0) {
    return {
      intro: "Aucune pièce jointe complémentaire n'accompagne ce message.",
      summary: "Aucune pièce jointe détectée.",
      attachments: [],
      combinedText: ""
    }
  }

  const intro = normalizedAttachments.length === 1
    ? "En complément du texte du mail, un fichier joint apporte une information supplémentaire à prendre en compte dans la réponse."
    : "En complément du texte du mail, plusieurs fichiers joints apportent des informations supplémentaires à prendre en compte dans la réponse."

  const attachmentBlocks = normalizedAttachments.map((attachment, index) => {
    const title = `Fichier joint ${index + 1} : ${attachment.filename} (${attachment.contentType})`
    const body = attachment.hasUsableText
      ? `Contenu exploitable extrait :\n${attachment.extractedText}`
      : `Contenu textuel non extrait automatiquement. Le fichier reste signalé comme complément d'information.${attachment.extractionStrategy || attachment.extractionError ? `\nDiagnostic extraction : strategie=${attachment.extractionStrategy || "indeterminee"}${attachment.extractionError ? ` ; erreur=${attachment.extractionError}` : ""}` : ""}`

    return `${title}\n${body}`
  })

  return {
    intro,
    summary: `${normalizedAttachments.length} fichier(s) joint(s) détecté(s) : ${normalizedAttachments.map((attachment) => attachment.filename).join(", ")}`,
    attachments: normalizedAttachments,
    combinedText: [intro, ...attachmentBlocks].join("\n\n")
  }
}

module.exports = {
  normalizeAttachmentForAI,
  buildAttachmentContext,
  extractAttachmentTextFromBuffer
}
