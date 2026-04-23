function getDefaultUserPreferences() {
  return {
    ui: {},
    audio: {
      audioInputEnabled: false,
      audioInputProvider: "deepgram",
      audioInputDeviceId: "",
      allowLocalFallback: true
    },
    mail: {
      defaultMode: "reply"
    },
    provider: {
      preferredAudioProvider: "deepgram",
      preferredLlmProvider: "",
      allowLocalFallback: true
    }
  }
}

function mergeObjects(base = {}, incoming = {}) {
  return {
    ...base,
    ...(incoming || {})
  }
}

function normalizeUserPreferences(payload = {}) {
  const defaults = getDefaultUserPreferences()
  return {
    ui: mergeObjects(defaults.ui, payload.ui),
    audio: mergeObjects(defaults.audio, payload.audio),
    mail: mergeObjects(defaults.mail, payload.mail),
    provider: mergeObjects(defaults.provider, payload.provider)
  }
}

function mergeUserPreferences(basePreferences, incomingPreferences) {
  return normalizeUserPreferences({
    ui: mergeObjects(basePreferences?.ui, incomingPreferences?.ui),
    audio: mergeObjects(basePreferences?.audio, incomingPreferences?.audio),
    mail: mergeObjects(basePreferences?.mail, incomingPreferences?.mail),
    provider: mergeObjects(basePreferences?.provider, incomingPreferences?.provider)
  })
}

module.exports = {
  getDefaultUserPreferences,
  normalizeUserPreferences,
  mergeUserPreferences
}
