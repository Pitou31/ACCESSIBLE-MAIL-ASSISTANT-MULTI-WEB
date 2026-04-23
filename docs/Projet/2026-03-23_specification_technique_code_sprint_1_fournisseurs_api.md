# Specification technique du code Sprint 1 - fournisseurs API, preferences et usage

Date : 2026-03-23

## 1. Objet

Ce document descend au niveau du code a implementer pour le Sprint 1.

Il precise :

- les fonctions a ajouter ;
- les signatures recommandees ;
- les responsabilites par fichier ;
- l'ordre de codage ;
- les points de compatibilite avec l'existant.

Le Sprint 1 couvre :

- `Deepgram`
- `AssemblyAI`
- `DeepSeek API`
- `provider_accounts`
- `provider_usage_events`
- `user_preferences`

## 2. Backend - fichiers et fonctions a ajouter

## 2.1 `/backend/src/services/databaseService.js`

### 2.1.1 Nouvelles fonctions fournisseurs

```js
function upsertProviderAccount(payload) {}
function getProviderAccountById(providerAccountId) {}
function listProviderAccountsForOwner(ownerScopeType, ownerScopeId) {}
function getDefaultProviderAccountForOwner(ownerScopeType, ownerScopeId, providerType) {}
function updateProviderAccount(providerAccountId, payload) {}
function deactivateProviderAccount(providerAccountId) {}
function markProviderAccountTestResult(providerAccountId, payload) {}
```

### 2.1.2 Payload recommande pour `upsertProviderAccount`

```js
{
  id,
  ownerScopeType,
  ownerScopeId,
  providerType,
  providerLabel,
  credentialMode,
  apiKeyEncrypted,
  apiKeyMasked,
  status,
  isDefault,
  billingMode,
  monthlyBudgetCents,
  currency,
  notes,
  lastTestedAt,
  lastError
}
```

### 2.1.3 Nouvelles fonctions usage/cout

```js
function recordProviderUsageEvent(payload) {}
function listProviderUsageEventsForAccount(accountId, options = {}) {}
function getProviderUsageSummaryForAccount(accountId, options = {}) {}
function getProviderUsageSummaryForProviderAccount(providerAccountId, options = {}) {}
```

### 2.1.4 Payload recommande pour `recordProviderUsageEvent`

```js
{
  id,
  accountId,
  providerAccountId,
  providerType,
  featureType,
  requestMode,
  quantity,
  quantityUnit,
  estimatedCostCents,
  currency,
  status,
  requestId,
  mailboxResourceId,
  metadataJson
}
```

### 2.1.5 Nouvelles fonctions preferences

```js
function getUserPreferences(accountId) {}
function saveUserPreferences(accountId, payload) {}
```

### 2.1.6 Structure retour recommandee de `getUserPreferences`

```js
{
  accountId,
  updatedAt,
  ui: {},
  audio: {},
  mail: {},
  provider: {}
}
```

## 2.2 `/backend/src/services/providerAccountService.js`

### 2.2.1 Nouveau fichier recommande

But :

- eviter de charger `databaseService.js` avec trop de logique metier ;
- centraliser les regles de validation et de chiffrement des cles ;
- resoudre le fournisseur actif d'un utilisateur.

### 2.2.2 Fonctions recommandees

```js
function encryptProviderApiKey(apiKey) {}
function decryptProviderApiKey(encryptedValue) {}
function maskProviderApiKey(apiKey) {}
function validateProviderType(providerType) {}
function normalizeProviderAccountPayload(payload) {}
function resolveProviderAccountForUser(accountId, providerType) {}
function testProviderAccount(providerAccount) {}
```

### 2.2.3 Regles

- reutiliser la logique de chiffrement existante des secrets quand c'est possible ;
- ne jamais exposer la cle en clair hors du service ;
- `resolveProviderAccountForUser` doit pouvoir plus tard gerer :
  - compte personnel
  - compte mutualise plateforme

## 2.3 `/backend/src/services/userPreferencesService.js`

### 2.3.1 Nouveau fichier recommande

But :

- centraliser la fusion entre :
  - valeurs par defaut
  - preferences serveur
  - anciennes preferences locales si recues

### 2.3.2 Fonctions recommandees

```js
function getDefaultUserPreferences() {}
function normalizeUserPreferences(payload = {}) {}
function mergeUserPreferences(basePreferences, incomingPreferences) {}
```

## 2.4 `/backend/src/routes/accountRoutes.js`

### 2.4.1 Fonctions handler a ajouter

```js
async function handleAccountPreferencesGet(req, res) {}
async function handleAccountPreferencesPut(req, res, body) {}
async function handleAccountProvidersList(req, res) {}
async function handleAccountProviderCreate(req, res, body) {}
async function handleAccountProviderUpdate(req, res, body, providerId) {}
async function handleAccountProviderDelete(req, res, providerId) {}
async function handleAccountProviderTest(req, res, providerId) {}
async function handleAccountUsageSummary(req, res) {}
async function handleAccountProviderUsageEvents(req, res) {}
```

### 2.4.2 Regles

- tous ces handlers doivent reutiliser `requireActiveSession` ou equivalent ;
- le `providerId` doit toujours etre verifie comme appartenant au compte connecte ;
- en cas de fournisseur invalide, renvoyer une erreur metier claire ;
- en cas d'absence de donnees, retourner un succes avec objets vides plutot qu'une 500.

## 2.5 `/backend/src/services/audioTranscriptionService.js`

### 2.5.1 Fonctions a ajouter

```js
async function resolveAudioProviderContext(accountId, preferredProvider) {}
function estimateAudioUsageCost(providerType, durationSeconds, requestMode) {}
async function recordAudioUsage(payload) {}
```

### 2.5.2 Structure retour recommandee de `resolveAudioProviderContext`

```js
{
  providerType: "deepgram",
  providerAccountId: "prov-123",
  billingMode: "personal",
  apiKey: "secret",
  providerLabel: "Deepgram"
}
```

### 2.5.3 Points d'integration

Fonctions existantes a faire evoluer :

- `getDeepgramClient()`
- `getAssemblyAiApiKey()`

Elles ne doivent plus dependre uniquement de `.env` pour la production utilisateur.

Elles doivent accepter un contexte ou etre remplacees par une resolution plus haute.

### 2.5.4 Usage event a produire en fin de session

Pour chaque session live terminee avec succes ou echec :

```js
{
  accountId,
  providerAccountId,
  providerType,
  featureType: "audio_dictation_live",
  requestMode: "live",
  quantity: durationSeconds,
  quantityUnit: "seconds",
  estimatedCostCents,
  currency: "EUR",
  status: "success" // ou "error"
}
```

## 2.6 `/backend/src/routes/audioRoutes.js`

### 2.6.1 Fonctions a ajuster

Toutes les routes live doivent pouvoir :

- connaitre l'utilisateur connecte ;
- resoudre le bon fournisseur ;
- renvoyer le meta fournisseur et cout.

Handlers concernes :

- deepgram live start / chunk / events / stop
- assemblyai live start / chunk / events / stop

### 2.6.2 Reponse de fin recommandee

```js
{
  ok: true,
  finalText,
  metrics,
  provider: {
    providerType,
    providerAccountId,
    billingMode
  },
  usage: {
    quantity,
    quantityUnit,
    estimatedCostCents,
    currency
  }
}
```

## 2.7 `/backend/src/services/aiRouter.js` et services IA

### 2.7.1 Portee Sprint 1

Le Sprint 1 ne demande pas encore d'implementer tout le multi-fournisseur texte.

Mais il faut preparer l'extension a `DeepSeek API`.

### 2.7.2 Fonctions a prevoir

```js
async function resolveLlmProviderContext(accountId, preferredProvider) {}
function estimateLlmUsageCost(providerType, usageMetrics) {}
async function recordLlmUsage(payload) {}
```

### 2.7.3 Fichiers cibles futurs

- `/backend/src/services/aiRouter.js`
- `/backend/src/services/deepseekAPI.js`
- `/backend/src/controllers/mailController.js`

## 3. Frontend - fichiers et fonctions a ajouter

## 3.1 `/frontend/js/settings.js`

### 3.1.1 Nouvelles fonctions serveur

```js
async function loadServerPreferences() {}
async function saveServerPreferences(partialPreferences) {}
async function loadProviderAccounts() {}
async function createProviderAccount(payload) {}
async function updateProviderAccount(providerId, payload) {}
async function deleteProviderAccount(providerId) {}
async function testProviderAccount(providerId) {}
async function loadUsageSummary() {}
```

### 3.1.2 Nouvelles fonctions UI

```js
function renderProviderAccounts(providers) {}
function renderProviderCard(provider) {}
function renderUsageSummary(summary) {}
function collectProviderFormData(providerType) {}
function syncSettingsFromServer(preferences) {}
```

### 3.1.3 Regles d'integration

- ne pas casser l'existant `DEFAULT_SETTINGS` ;
- conserver le `localStorage` comme cache et secours ;
- si le serveur est disponible, il devient prioritaire pour les settings critiques.

## 3.2 `/frontend/settings.html`

### 3.2.1 Blocs UI a ajouter

- conteneur `apiProvidersSection`
- carte `deepgramProviderCard`
- carte `assemblyaiProviderCard`
- carte `deepseekApiProviderCard`
- bloc `usageSummaryCard`

### 3.2.2 Identifiants recommandes

```html
<div id="providerAccountsContainer"></div>
<div id="providerUsageSummary"></div>
<button id="deepgramSaveProviderBtn"></button>
<button id="deepgramTestProviderBtn"></button>
<button id="assemblyaiSaveProviderBtn"></button>
<button id="assemblyaiTestProviderBtn"></button>
<button id="deepseekApiSaveProviderBtn"></button>
<button id="deepseekApiTestProviderBtn"></button>
```

## 3.3 `/frontend/js/audioInput.js`

### 3.3.1 Nouvelles fonctions recommandees

```js
async function getEffectiveAudioProviderContext() {}
function renderAudioProviderStatus(providerMeta) {}
function renderAudioUsageMeta(usageMeta) {}
```

### 3.3.2 Integration avec la dictée

Au demarrage :

- lire la preference audio ;
- appeler le backend si besoin pour connaitre le fournisseur reel.

A l'arret :

- afficher :
  - le fournisseur utilise ;
  - eventuellement le cout estime.

### 3.3.3 Regle importante

Si `Deepgram` ou `AssemblyAI` est choisi explicitement et indisponible :

- erreur claire
- pas de bascule silencieuse vers `local`

## 3.4 `/frontend/js/mail.js`

### 3.4.1 Fonctions recommandees

```js
function updateDictationProviderHint(providerMeta) {}
function updateDictationCostHint(usageMeta) {}
```

### 3.4.2 Portee

Pas de gros chantier ici en Sprint 1.

Seulement :

- meilleure lisibilite du moteur actif ;
- retour d'information sur la dictée ;
- eventuelle consommation de meta retournee par `audioInput.js`.

## 3.5 `/frontend/js/account.js`

### 3.5.1 Fonctions recommandees

```js
async function loadAccountProviderSummary() {}
function renderAccountProviderSummary(summary) {}
```

### 3.5.2 Portee

Afficher simplement :

- fournisseur de dictée par defaut ;
- fournisseur IA texte par defaut ;
- nombre de fournisseurs configures.

## 4. Nouveau service frontend recommande

## 4.1 `/frontend/js/providerApiClient.js`

### 4.1.1 Pourquoi

Pour eviter de disperser les appels REST entre `settings.js`, `audioInput.js` et `account.js`.

### 4.1.2 Fonctions recommandees

```js
async function fetchPreferences() {}
async function savePreferences(payload) {}
async function fetchProviderAccounts() {}
async function createProvider(payload) {}
async function updateProvider(providerId, payload) {}
async function deleteProvider(providerId) {}
async function testProvider(providerId) {}
async function fetchUsageSummary() {}
async function fetchUsageEvents() {}
```

### 4.1.3 Recommandation

Creer ce fichier des le Sprint 1 si l'on veut garder le code propre.

## 5. Ordre de codage recommande

## 5.1 Backend

1. tables et fonctions dans `databaseService.js`
2. `providerAccountService.js`
3. `userPreferencesService.js`
4. routes `accountRoutes.js`
5. resolution dynamique dans `audioTranscriptionService.js`
6. meta fournisseur/cout dans `audioRoutes.js`

## 5.2 Frontend

1. `providerApiClient.js`
2. `settings.html`
3. `settings.js`
4. `audioInput.js`
5. `mail.js`
6. `account.js`

## 6. Tests techniques a prevoir

## 6.1 Backend

- creation d'un fournisseur `deepgram`
- creation d'un fournisseur `assemblyai`
- creation d'un fournisseur `deepseek-api`
- test fournisseur valide / invalide
- enregistrement d'une preference
- lecture d'un resume d'usage vide
- enregistrement d'un usage audio

## 6.2 Frontend

- affichage d'un fournisseur valide
- erreur visible si la cle est invalide
- sauvegarde preference audio fournisseur
- affichage resume de cout
- absence de regression sur la page Paramètres

## 7. Compatibilite avec l'existant

## 7.1 Ne pas casser

- les routes compte existantes
- la dictée existante dans les pages mail
- le fonctionnement local de secours
- les preferences historiques en `localStorage`

## 7.2 Strategie

- brancher les nouvelles fonctions par ajout progressif ;
- ne pas supprimer tout de suite les anciennes sources de configuration globale ;
- faire en sorte que la resolution utilisateur prenne la priorite si elle existe.

## 8. Conclusion

Le Sprint 1 est pret a etre code si l'on suit ce decoupage :

- couche base de donnees ;
- couche service fournisseur ;
- routes backend compte/preferences/usage ;
- client frontend fournisseur ;
- page Paramètres ;
- integration legere dans la dictée et le compte.

Ce lot est suffisamment concret pour passer du document au code sans ambiguite majeure.
