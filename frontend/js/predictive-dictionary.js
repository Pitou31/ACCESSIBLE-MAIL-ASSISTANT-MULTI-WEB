;(function attachPredictiveDictionary(globalScope) {
  const cache = new Map()
  const MAX_INDEX_PREFIX_LENGTH = 4
  const MAX_SUGGESTIONS_PER_PREFIX = 12

  function normalize(value = "") {
    return String(value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim()
  }

  function sanitizeWordList(words) {
    if (!Array.isArray(words)) {
      return []
    }

    const seen = new Set()
    return words
      .map((word) => String(word || "").trim())
      .filter((word) => {
        const normalized = normalize(word)
        if (!normalized || seen.has(normalized)) {
          return false
        }
        seen.add(normalized)
        return true
      })
  }

  function isSingleWordCandidate(word = "") {
    return Boolean(word) && !/\s{1,}/.test(word.trim())
  }

  function addToIndex(prefixMap, prefix, word) {
    if (!prefixMap.has(prefix)) {
      prefixMap.set(prefix, [])
    }

    const bucket = prefixMap.get(prefix)
    if (!bucket.includes(word) && bucket.length < MAX_SUGGESTIONS_PER_PREFIX) {
      bucket.push(word)
    }
  }

  function buildPrefixIndex(words) {
    const prefixMap = new Map()

    words.forEach((word) => {
      if (!isSingleWordCandidate(word)) {
        return
      }

      const normalizedWord = normalize(word)
      if (!normalizedWord) {
        return
      }

      const maxPrefixLength = Math.min(MAX_INDEX_PREFIX_LENGTH, normalizedWord.length)
      for (let prefixLength = 1; prefixLength <= maxPrefixLength; prefixLength += 1) {
        addToIndex(prefixMap, normalizedWord.slice(0, prefixLength), word)
      }
    })

    return prefixMap
  }

  async function load(language = "fr") {
    const normalizedLanguage = normalize(language) || "fr"
    if (cache.has(normalizedLanguage)) {
      return cache.get(normalizedLanguage).words
    }

    try {
      const response = await fetch(`/frontend/data/predictive-dictionaries/${normalizedLanguage}.json`, {
        cache: "no-store"
      })
      if (!response.ok) {
        cache.set(normalizedLanguage, {
          words: [],
          prefixMap: new Map()
        })
        return []
      }

      const payload = await response.json()
      const words = sanitizeWordList(payload?.words)
      cache.set(normalizedLanguage, {
        words,
        prefixMap: buildPrefixIndex(words)
      })
      return words
    } catch (_) {
      cache.set(normalizedLanguage, {
        words: [],
        prefixMap: new Map()
      })
      return []
    }
  }

  function getWords(language = "fr") {
    return cache.get(normalize(language) || "fr")?.words || []
  }

  function suggest(prefix = "", language = "fr", limit = 5) {
    const normalizedPrefix = normalize(prefix)
    if (!normalizedPrefix) {
      return []
    }

    const cacheEntry = cache.get(normalize(language) || "fr")
    const words = cacheEntry?.words || []
    const prefixMap = cacheEntry?.prefixMap || new Map()

    const indexedPrefix = normalizedPrefix.slice(0, Math.min(MAX_INDEX_PREFIX_LENGTH, normalizedPrefix.length))
    const indexedCandidates = prefixMap.get(indexedPrefix) || []
    const sourceCandidates = indexedCandidates.length ? indexedCandidates : words
    const exactPrefixMatches = []

    sourceCandidates.forEach((candidate) => {
      if (!isSingleWordCandidate(candidate)) {
        return
      }

      const normalizedCandidate = normalize(candidate)
      if (!normalizedCandidate) {
        return
      }

      if (normalizedCandidate.startsWith(normalizedPrefix)) {
        exactPrefixMatches.push(candidate)
      }
    })

    return [...exactPrefixMatches]
      .sort((left, right) => left.localeCompare(right, language, { sensitivity: "base" }))
      .slice(0, Math.max(1, limit))
  }

  globalScope.PredictiveDictionary = {
    load,
    getWords,
    suggest,
    normalize
  }
})(window)
