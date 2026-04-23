const fs = require("fs")
const path = require("path")

const PROJECT_ROOT = path.resolve(__dirname, "../..")
const DICTIONARY_ROOT = path.join(PROJECT_ROOT, "frontend/data/predictive-dictionaries")
const SOURCE_ROOT = path.join(DICTIONARY_ROOT, "source")

const CONFIGS = [
  {
    language: "fr",
    sourceFile: "fr.dic",
    outputFile: "fr.json",
    priorityWords: [
      "bonjour",
      "merci",
      "veuillez",
      "dossier",
      "référence",
      "date",
      "demande",
      "message",
      "document",
      "pièce jointe",
      "justificatif",
      "coordonnées",
      "numéro",
      "traitement",
      "relance",
      "information",
      "confirmation",
      "complément",
      "vérification",
      "service",
      "réponse",
      "courriel",
      "statut",
      "transmission",
      "demandeur",
      "précision",
      "disposition",
      "cordialement"
    ]
  },
  {
    language: "nl",
    sourceFile: "nl.dic",
    outputFile: "nl.json",
    priorityWords: [
      "hallo",
      "dank",
      "alstublieft",
      "dossier",
      "dossiernummer",
      "referentie",
      "datum",
      "verzoek",
      "bericht",
      "bijlage",
      "informatie",
      "status",
      "reactie",
      "bevestiging",
      "controle"
    ]
  }
]

function normalize(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

function extractLemma(rawEntry = "") {
  const withoutComment = String(rawEntry || "").split("\t")[0].trim()
  const lemma = withoutComment.split("/")[0].trim()
  return lemma
}

function isUsefulWord(word = "") {
  if (!word) {
    return false
  }

  if (word.length < 2 || word.length > 40) {
    return false
  }

  if (/\d/.test(word)) {
    return false
  }

  if (/^[A-ZÀ-ÖØ-Þ]/.test(word)) {
    return false
  }

  if (!/^[A-Za-zÀ-ÖØ-öø-ÿĀ-žĲĳŒœÆæ' -]+$/.test(word)) {
    return false
  }

  return true
}

function sortWords(words = [], priorityWords = []) {
  const priorityMap = new Map(
    priorityWords.map((word, index) => [normalize(word), index])
  )

  return [...words].sort((left, right) => {
    const leftKey = normalize(left)
    const rightKey = normalize(right)
    const leftPriority = priorityMap.has(leftKey) ? priorityMap.get(leftKey) : Number.POSITIVE_INFINITY
    const rightPriority = priorityMap.has(rightKey) ? priorityMap.get(rightKey) : Number.POSITIVE_INFINITY

    if (leftPriority !== rightPriority) {
      return leftPriority - rightPriority
    }

    return left.localeCompare(right, "fr", { sensitivity: "base" })
  })
}

function buildDictionary(config) {
  const sourcePath = path.join(SOURCE_ROOT, config.sourceFile)
  const outputPath = path.join(DICTIONARY_ROOT, config.outputFile)
  const rawContent = fs.readFileSync(sourcePath, "utf8")
  const lines = rawContent.split(/\r?\n/)
  const entries = lines.slice(1)
  const seen = new Set()
  const words = []

  config.priorityWords.forEach((word) => {
    const key = normalize(word)
    if (!key || seen.has(key)) {
      return
    }
    seen.add(key)
    words.push(word)
  })

  entries.forEach((entry) => {
    const lemma = extractLemma(entry)
    if (!isUsefulWord(lemma)) {
      return
    }

    const key = normalize(lemma)
    if (!key || seen.has(key)) {
      return
    }

    seen.add(key)
    words.push(lemma)
  })

  const payload = {
    language: config.language,
    source: "LibreOffice Hunspell dictionary",
    generatedAt: new Date().toISOString(),
    wordCount: words.length,
    words: sortWords(words, config.priorityWords)
  }

  fs.writeFileSync(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8")
  return payload
}

function main() {
  const results = CONFIGS.map(buildDictionary)
  results.forEach((result) => {
    process.stdout.write(`${result.language}: ${result.wordCount} mots\n`)
  })
}

main()
