# Specification des tables Sprint 1 - fournisseurs API et preferences utilisateur

Date : 2026-03-23

## 1. Objet

Ce document fixe les tables exactes a ajouter en Sprint 1 pour preparer :

- les fournisseurs API personnels par utilisateur ;
- le suivi d'usage et de cout ;
- la sauvegarde serveur des preferences critiques.

Le Sprint 1 ne traite pas encore :

- le partage multi-utilisateurs d'une meme boite mail ;
- les memberships ;
- les assignations de messages.

Il doit rester 100 % compatible avec l'existant mono-utilisateur.

## 2. Principe de conception

Le Sprint 1 ajoute de nouvelles tables sans casser les tables existantes.

On ne remplace pas encore :

- `accounts`
- `mailbox_connections`
- `mailbox_message_actions`

On les complete par de nouvelles entites.

## 3. Tables a ajouter

## 3.1 Table `provider_accounts`

## 3.1.1 Objet

Stocker les comptes fournisseurs API rattaches a un utilisateur ou, plus tard, a une organisation ou a la plateforme.

Exemples de fournisseurs :

- `deepgram`
- `assemblyai`
- `deepseek-api`

## 3.1.2 SQL recommande

```sql
CREATE TABLE IF NOT EXISTS provider_accounts (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  owner_scope_type TEXT NOT NULL,
  owner_scope_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  provider_label TEXT NOT NULL,
  credential_mode TEXT NOT NULL,
  api_key_encrypted TEXT NOT NULL,
  api_key_masked TEXT NOT NULL,
  status TEXT NOT NULL,
  is_default INTEGER NOT NULL DEFAULT 0,
  billing_mode TEXT NOT NULL,
  monthly_budget_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  notes TEXT,
  last_tested_at TEXT,
  last_error TEXT
);
```

## 3.1.3 Sens des colonnes

- `id`
  - identifiant technique
  - exemple : `prov-1742760000000-123`

- `created_at`, `updated_at`
  - timestamps ISO

- `owner_scope_type`
  - premiere version :
    - `account`
  - extensions futures :
    - `organization`
    - `platform`

- `owner_scope_id`
  - en Sprint 1 : identifiant du compte utilisateur

- `provider_type`
  - valeurs initiales :
    - `deepgram`
    - `assemblyai`
    - `deepseek-api`

- `provider_label`
  - libelle UI stable

- `credential_mode`
  - valeurs initiales recommandees :
    - `personal_api_key`
  - valeur future possible :
    - `platform_managed`

- `api_key_encrypted`
  - cle chiffree au repos

- `api_key_masked`
  - version masquee pour l'UI
  - exemple :
    - `dg_xxxxxxxxx1234`

- `status`
  - valeurs recommandees :
    - `active`
    - `inactive`
    - `invalid`
    - `revoked`

- `is_default`
  - `0` ou `1`
  - indique le fournisseur par defaut pour ce scope

- `billing_mode`
  - valeurs recommandees :
    - `personal`
    - `platform`
  - en Sprint 1, le plus courant sera `personal`

- `monthly_budget_cents`
  - plafond optionnel
  - `0` = pas de plafond defini

- `currency`
  - devise de presentation du budget et du cout estime

- `notes`
  - commentaire interne

- `last_tested_at`
  - date du dernier test de validite de la cle

- `last_error`
  - dernier message d'erreur connu

## 3.1.4 Contraintes logiques

- un compte utilisateur peut avoir plusieurs fournisseurs
- mais un seul fournisseur par type doit pouvoir etre marque `is_default = 1`
- en Sprint 1, pour simplifier :
  - un seul `deepgram` actif par utilisateur
  - un seul `assemblyai` actif par utilisateur

## 3.1.5 Index recommandes

```sql
CREATE INDEX IF NOT EXISTS idx_provider_accounts_owner
ON provider_accounts(owner_scope_type, owner_scope_id);

CREATE INDEX IF NOT EXISTS idx_provider_accounts_provider_type
ON provider_accounts(provider_type);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_accounts_owner_provider_mode
ON provider_accounts(owner_scope_type, owner_scope_id, provider_type, credential_mode);
```

## 3.1.6 Regle de selection par defaut

Pour un utilisateur et un type de fournisseur donnes :

1. prendre l'entree `status = active` et `is_default = 1`
2. sinon prendre la plus recente `status = active`
3. sinon retourner `null`

## 3.2 Table `provider_usage_events`

## 3.2.1 Objet

Journaliser les appels payants ou potentiellement payants.

Cette table ne remplace pas les statistiques produit globales.
Elle sert a la comptabilite et a la traçabilite des API.

## 3.2.2 SQL recommande

```sql
CREATE TABLE IF NOT EXISTS provider_usage_events (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL,
  account_id TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  feature_type TEXT NOT NULL,
  request_mode TEXT NOT NULL,
  quantity REAL NOT NULL DEFAULT 0,
  quantity_unit TEXT NOT NULL,
  estimated_cost_cents INTEGER NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR',
  status TEXT NOT NULL,
  request_id TEXT,
  mailbox_resource_id TEXT,
  metadata_json TEXT,
  FOREIGN KEY (account_id) REFERENCES accounts(id),
  FOREIGN KEY (provider_account_id) REFERENCES provider_accounts(id)
);
```

## 3.2.3 Sens des colonnes

- `account_id`
  - utilisateur consommateur

- `provider_account_id`
  - compte fournisseur reellement utilise

- `provider_type`
  - duplication volontaire pour lecture simple

- `feature_type`
  - valeurs initiales recommandees :
    - `audio_dictation_live`
    - `audio_dictation_batch`
    - `llm_generation`
    - `llm_reasoning`
  - extensions futures :
    - `browser_automation`

- `request_mode`
  - valeurs recommandees :
    - `live`
    - `batch`
    - `test`

- `quantity`
  - volume consomme
  - en Sprint 1 :
    - nombre de secondes audio
    - ou minutes si vous preferez

- `quantity_unit`
  - valeurs recommandees :
    - `seconds`
    - `minutes`
    - `requests`

- `estimated_cost_cents`
  - cout estime calcule au moment de l'appel

- `status`
  - valeurs recommandees :
    - `success`
    - `error`
    - `cancelled`

- `request_id`
  - id logique de session ou de requete

- `mailbox_resource_id`
  - `NULL` en Sprint 1 si la notion n'existe pas encore
  - prevue pour l'etape multi-boites partagees

- `metadata_json`
  - details techniques :
    - duree brute
    - fournisseur
    - mode
    - langue
    - nombre de partiels

## 3.2.4 Index recommandes

```sql
CREATE INDEX IF NOT EXISTS idx_provider_usage_events_account_created
ON provider_usage_events(account_id, created_at);

CREATE INDEX IF NOT EXISTS idx_provider_usage_events_provider_account_created
ON provider_usage_events(provider_account_id, created_at);

CREATE INDEX IF NOT EXISTS idx_provider_usage_events_provider_feature
ON provider_usage_events(provider_type, feature_type);
```

## 3.2.5 Regle de granularite

En Sprint 1, un evenement = une session de dictée terminee.

Donc :

- pas un evenement par chunk live ;
- pas un evenement par partiel ;
- un seul evenement par dictée.

## 3.3 Table `user_preferences`

## 3.3.1 Objet

Sortir progressivement les preferences critiques du navigateur pour les rendre :

- persistantes cote serveur ;
- attachables a un compte ;
- transportables d'un poste a un autre.

## 3.3.2 SQL recommande

```sql
CREATE TABLE IF NOT EXISTS user_preferences (
  account_id TEXT PRIMARY KEY,
  updated_at TEXT NOT NULL,
  ui_settings_json TEXT NOT NULL,
  audio_settings_json TEXT NOT NULL,
  mail_settings_json TEXT NOT NULL,
  provider_preferences_json TEXT NOT NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id)
);
```

## 3.3.3 Repartition des champs JSON

- `ui_settings_json`
  - theme
  - police
  - taille
  - largeur de lecture

- `audio_settings_json`
  - lecture audio active
  - saisie audio active
  - microphone prefere
  - moteur prefere

- `mail_settings_json`
  - mode par defaut
  - ton
  - longueur
  - confirmations
  - brouillon auto

- `provider_preferences_json`
  - fournisseur de dictée prefere
  - fallback local autorise ou non
  - budget d'alerte UI

## 4. Evolutions mineures de tables existantes

## 4.1 Table `accounts`

Le Sprint 1 peut se faire sans modifier `accounts`.

Ajouts optionnels possibles plus tard :

- `last_login_at`
- `default_billing_mode`
- `default_provider_scope`

Recommandation :

- ne pas modifier `accounts` dans le tout premier lot si cela n'est pas indispensable.

## 4.2 Table `app_settings`

Cette table existe deja.

Utilisation recommandee en Sprint 1 :

- stocker les fournisseurs mutualises plateforme
- stocker un bareme de cout de reference

Exemples de cle :

- `provider_platform_accounts`
- `provider_pricing_reference`

## 5. Fonctions backend a creer dans `databaseService.js`

## 5.1 Fournisseurs

Fonctions a ajouter en priorite :

- `upsertProviderAccount(payload)`
- `getProviderAccountById(id)`
- `listProviderAccountsForOwner(ownerScopeType, ownerScopeId)`
- `getDefaultProviderAccountForOwner(ownerScopeType, ownerScopeId, providerType)`
- `deactivateProviderAccount(id)`
- `markProviderAccountTestResult(id, { status, lastTestedAt, lastError })`

## 5.2 Usage et cout

Fonctions a ajouter :

- `recordProviderUsageEvent(payload)`
- `listProviderUsageEventsForAccount(accountId, options)`
- `getProviderUsageSummaryForAccount(accountId, options)`
- `getProviderUsageSummaryForProviderAccount(providerAccountId, options)`

## 5.3 Preferences

Fonctions a ajouter :

- `getUserPreferences(accountId)`
- `saveUserPreferences(accountId, payload)`

Regle :

- `saveUserPreferences` fait un `upsert`
- si aucune preference n'existe, elle en cree une

## 6. Regles de chiffrement et de stockage des cles

## 6.1 Principe

Les cles API ne doivent jamais etre stockees en clair.

La logique doit reutiliser un mecanisme de chiffrement equivalent a celui deja utilise pour :

- les tokens OAuth de boite mail.

## 6.2 Recommandation

Dans un premier temps, reutiliser le meme secret serveur que celui des secrets mailbox si aucun secret dedie n'existe encore.

Puis idealement introduire plus tard :

- `PROVIDER_API_SECRET`

## 6.3 Masquage UI

La valeur retournee au frontend ne doit jamais etre la vraie cle.

Exemple :

- `dg_1234567890abcdef`
  devient
- `dg_************cdef`

## 7. Regles de migration

## 7.1 Migration schema

Ajout simple :

- creation des nouvelles tables
- creation des index

Pas de migration destructive en Sprint 1.

## 7.2 Migration donnees

Aucune migration obligatoire des anciennes donnees n'est necessaire pour ces tables.

Au demarrage :

- un utilisateur peut ne pas avoir de `provider_account`
- un utilisateur peut ne pas avoir de `user_preferences`

Le systeme doit alors :

- utiliser la preference locale du navigateur si elle existe ;
- ou les valeurs par defaut.

## 8. Regles de compatibilite

Le Sprint 1 est valide seulement si :

- un utilisateur sans fournisseur configure peut encore utiliser le mode local de secours ;
- un utilisateur avec fournisseur configure peut utiliser son compte personnel ;
- les anciennes sessions et connexions mail restent fonctionnelles ;
- le login ne change pas ;
- la page Parametres continue de fonctionner meme sans preferences serveur.

## 9. Tests a prevoir

## 9.1 Tests schema

- creation des 3 tables au premier lancement
- relancement sans erreur si elles existent deja

## 9.2 Tests fournisseur

- insertion d'un compte `deepgram`
- insertion d'un compte `assemblyai`
- insertion d'un compte `deepseek-api`
- lecture de la valeur par defaut
- desactivation d'un compte
- test d'un compte invalide

## 9.3 Tests usage

- creation d'un usage apres une dictée live
- calcul d'un cout estime non negatif
- lecture des usages du mois pour un utilisateur

## 9.4 Tests preferences

- premier enregistrement
- mise a jour
- lecture apres reconnexion

## 10. Ordre exact de codage recommande

1. `databaseService.js`
   - tables
   - index
   - fonctions CRUD

2. `audioTranscriptionService.js`
   - resolution du fournisseur utilisateur
   - enregistrement d'usage

3. `audioRoutes.js`
   - retour des meta fournisseur et cout

4. `accountRoutes.js`
   - endpoints fournisseurs
   - endpoints preferences

5. `settings.js` et `settings.html`
   - lecture/ecriture serveur
   - UI de configuration fournisseur

## 11. Conclusion

Le Sprint 1 doit rester volontairement simple :

- 3 nouvelles tables
- aucun changement destructif
- aucune migration complexe
- un benefice immediat :
  - rattacher `Deepgram` ou `AssemblyAI` a un utilisateur
  - commencer la traçabilite des couts
  - sortir les preferences critiques du seul navigateur

Ce lot est la bonne base avant d'attaquer le vrai partage de boites mail entre plusieurs utilisateurs.

## 12. Extension immediate a prevoir pour DeepSeek API

Le Sprint 1 ne doit pas etre limite a la dictée.

Le meme modele doit deja accepter `DeepSeek API` comme fournisseur utilisateur pour :

- la generation de brouillons ;
- la generation de reponses ;
- les traitements `chat` ;
- les traitements `reasoner`.

Implications :

- `provider_accounts` doit accepter `deepseek-api` des le premier schema ;
- `provider_usage_events` doit accepter des evenements non audio ;
- les futurs services IA devront pouvoir resoudre un compte fournisseur utilisateur au lieu de lire uniquement une cle globale serveur.

Le lot audio reste prioritaire, mais le schema doit etre concu des maintenant pour supporter aussi `DeepSeek API`.
