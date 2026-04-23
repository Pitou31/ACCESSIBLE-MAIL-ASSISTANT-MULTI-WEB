# Specification des endpoints backend Sprint 1 - fournisseurs API, preferences et usage

Date : 2026-03-23

## 1. Objet

Ce document fixe les endpoints backend du Sprint 1 pour :

- configurer des fournisseurs API personnels ;
- tester leur validite ;
- sauvegarder les preferences utilisateur ;
- retourner les premiers usages et couts ;
- preparer la resolution dynamique de `Deepgram`, `AssemblyAI` et `DeepSeek API`.

## 2. Principes generaux

- tous les endpoints de ce document exigent une session utilisateur active ;
- aucun endpoint ne renvoie une cle API en clair ;
- les erreurs doivent etre lisibles et exploitables par l'UI ;
- le mode mono-utilisateur reste compatible.

## 3. Endpoints preferences utilisateur

## 3.1 `GET /api/account/preferences`

### Objet

Retourner les preferences serveur du compte connecte.

### Reponse 200

```json
{
  "ok": true,
  "preferences": {
    "ui": {},
    "audio": {},
    "mail": {},
    "provider": {}
  }
}
```

### Regles

- si aucune preference n'existe encore :
  - retourner des objets vides ou des valeurs par defaut ;
- ne jamais echouer juste parce que l'utilisateur n'a encore rien configure.

## 3.2 `PUT /api/account/preferences`

### Objet

Mettre a jour les preferences critiques du compte connecte.

### Payload recommande

```json
{
  "ui": {},
  "audio": {
    "audioInputEnabled": true,
    "audioInputProvider": "deepgram",
    "audioInputDeviceId": ""
  },
  "mail": {
    "defaultMode": "reply"
  },
  "provider": {
    "preferredAudioProvider": "deepgram",
    "preferredLlmProvider": "deepseek-api",
    "allowLocalFallback": true
  }
}
```

### Reponse 200

```json
{
  "ok": true,
  "preferences": {
    "ui": {},
    "audio": {},
    "mail": {},
    "provider": {}
  }
}
```

### Regles

- upsert si la ligne n'existe pas ;
- validation minimale des valeurs enumerees ;
- ne pas ecraser brutalement les blocs absents si l'API choisit une logique de merge partiel.

## 4. Endpoints fournisseurs API

## 4.1 `GET /api/account/providers`

### Objet

Lister les fournisseurs configures pour le compte connecte.

### Reponse 200

```json
{
  "ok": true,
  "providers": [
    {
      "id": "prov-1",
      "providerType": "deepgram",
      "providerLabel": "Deepgram",
      "status": "active",
      "credentialMode": "personal_api_key",
      "billingMode": "personal",
      "isDefault": true,
      "apiKeyMasked": "dg_********1234",
      "lastTestedAt": "2026-03-23T19:00:00.000Z",
      "lastError": ""
    }
  ]
}
```

### Regles

- ne jamais retourner `api_key_encrypted` ;
- ne jamais retourner la cle originale ;
- trier idealement par fournisseur puis par defaut.

## 4.2 `POST /api/account/providers`

### Objet

Creer ou remplacer un fournisseur personnel pour le compte connecte.

### Payload recommande

```json
{
  "providerType": "deepgram",
  "providerLabel": "Deepgram",
  "apiKey": "secret",
  "credentialMode": "personal_api_key",
  "billingMode": "personal",
  "isDefault": true,
  "monthlyBudgetCents": 0,
  "currency": "EUR",
  "notes": ""
}
```

### Reponse 200

```json
{
  "ok": true,
  "provider": {
    "id": "prov-1",
    "providerType": "deepgram",
    "status": "active",
    "isDefault": true,
    "apiKeyMasked": "dg_********1234"
  }
}
```

### Regles

- valeurs autorisees initiales :
  - `deepgram`
  - `assemblyai`
  - `deepseek-api`
- si `isDefault = true`, retirer le flag default des autres fournisseurs du meme type pour ce compte ;
- chiffrer la cle avant stockage ;
- stocker une version masquee.

## 4.3 `PUT /api/account/providers/:id`

### Objet

Mettre a jour un fournisseur existant du compte connecte.

### Payload recommande

```json
{
  "apiKey": "nouvelle-cle-optionnelle",
  "status": "active",
  "isDefault": true,
  "monthlyBudgetCents": 500,
  "notes": "Compte principal"
}
```

### Regles

- si `apiKey` absent :
  - ne pas modifier la cle stockee ;
- si `apiKey` present :
  - rechiffrer
  - remasquer
- refuser toute modification d'un fournisseur n'appartenant pas au compte connecte.

## 4.4 `DELETE /api/account/providers/:id`

### Objet

Desactiver ou supprimer un fournisseur du compte connecte.

### Recommandation

En Sprint 1, preferer une suppression logique :

- `status = inactive`

plutot qu'une suppression physique immediate.

### Reponse 200

```json
{
  "ok": true,
  "provider": {
    "id": "prov-1",
    "status": "inactive"
  }
}
```

## 4.5 `POST /api/account/providers/:id/test`

### Objet

Verifier qu'une cle API est exploitable.

### Reponse 200 en succes

```json
{
  "ok": true,
  "provider": {
    "id": "prov-1",
    "providerType": "assemblyai",
    "status": "active",
    "lastTestedAt": "2026-03-23T19:10:00.000Z",
    "lastError": ""
  },
  "test": {
    "success": true,
    "message": "Connexion API validee."
  }
}
```

### Reponse 200 en echec fonctionnel

```json
{
  "ok": false,
  "provider": {
    "id": "prov-1",
    "providerType": "assemblyai",
    "status": "invalid",
    "lastTestedAt": "2026-03-23T19:10:00.000Z",
    "lastError": "Cle invalide"
  },
  "test": {
    "success": false,
    "message": "Cle invalide."
  }
}
```

### Regles par fournisseur

- `deepgram`
  - test simple sur endpoint ou SDK minimal
- `assemblyai`
  - ouverture de session ou endpoint de validation minimal
- `deepseek-api`
  - appel minimal non couteux ou tres faible cout

## 5. Endpoints de synthese d'usage et cout

## 5.1 `GET /api/account/usage-summary`

### Objet

Retourner la consommation du compte connecte.

### Parametres possibles

- `period=this_month`
- `providerType=deepgram`
- `featureType=audio_dictation_live`

### Reponse 200

```json
{
  "ok": true,
  "summary": {
    "period": "this_month",
    "totalEstimatedCostCents": 254,
    "currency": "EUR",
    "eventsCount": 42,
    "providers": [
      {
        "providerType": "deepgram",
        "estimatedCostCents": 180,
        "quantity": 320,
        "quantityUnit": "minutes"
      },
      {
        "providerType": "deepseek-api",
        "estimatedCostCents": 74,
        "quantity": 58,
        "quantityUnit": "requests"
      }
    ]
  }
}
```

## 5.2 `GET /api/account/provider-usage-events`

### Objet

Retourner l'historique detaille des usages.

### Reponse 200

```json
{
  "ok": true,
  "events": [
    {
      "id": "usage-1",
      "createdAt": "2026-03-23T19:20:00.000Z",
      "providerType": "deepgram",
      "featureType": "audio_dictation_live",
      "requestMode": "live",
      "quantity": 18.2,
      "quantityUnit": "seconds",
      "estimatedCostCents": 1,
      "status": "success"
    }
  ]
}
```

## 6. Impacts sur les routes audio

## 6.1 Routes existantes a faire evoluer

Les routes live audio ne doivent plus seulement verifier :

- que le provider global est configure ;

mais aussi :

- quel fournisseur est prefere par cet utilisateur ;
- si une cle personnelle active existe ;
- si un compte mutualise plateforme est autorise ;
- quel compte fournisseur a ete utilise.

## 6.2 Meta a retourner en fin de session live

La reponse de fin de session audio doit progressivement inclure :

```json
{
  "ok": true,
  "provider": {
    "providerType": "deepgram",
    "providerAccountId": "prov-1",
    "billingMode": "personal"
  },
  "usage": {
    "quantity": 18.2,
    "quantityUnit": "seconds",
    "estimatedCostCents": 1,
    "currency": "EUR"
  }
}
```

## 7. Impacts sur les routes IA futures

Le schema doit des maintenant accepter `DeepSeek API`.

Implication :

- les futures routes de generation doivent pouvoir resoudre un `provider_account` pour `deepseek-api`
- elles devront elles aussi enregistrer un `provider_usage_event`

Fonctionnalites visees :

- creation de brouillon
- reponse a un mail
- mode `chat`
- mode `reasoner`

## 8. Validation des payloads

## 8.1 Enum recommandes

### `providerType`

- `deepgram`
- `assemblyai`
- `deepseek-api`

### `credentialMode`

- `personal_api_key`
- `platform_managed`

### `billingMode`

- `personal`
- `platform`

### `featureType`

- `audio_dictation_live`
- `audio_dictation_batch`
- `llm_generation`
- `llm_reasoning`

## 8.2 Erreurs minimales a retourner

- fournisseur inconnu
- fournisseur non configure
- cle invalide
- budget depasse
- acces refuse a une ressource fournisseur
- payload invalide

## 9. Ordre exact d'implementation backend

1. `databaseService.js`
   - CRUD fournisseurs
   - CRUD preferences
   - usage events

2. `accountRoutes.js`
   - preferences
   - providers
   - tests provider

3. `audioTranscriptionService.js`
   - resolution dynamique fournisseur
   - enregistrement usage

4. `audioRoutes.js`
   - retour meta fournisseur et cout

5. plus tard :
   - `aiRouter.js`
   - `deepseekAPI.js`
   - `mailController.js`

## 10. Conclusion

Le Sprint 1 backend doit fournir 3 familles d'API :

- `preferences`
- `providers`
- `usage-summary`

et preparer une meme logique de resolution fournisseur pour :

- `Deepgram`
- `AssemblyAI`
- `DeepSeek API`

Cela permettra d'introduire ensuite la comptabilite par utilisateur sans devoir refaire l'architecture une seconde fois.
