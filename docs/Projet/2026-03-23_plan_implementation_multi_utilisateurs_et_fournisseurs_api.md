# Plan d'implementation - multi-utilisateurs, boites partagees et fournisseurs API

Date : 2026-03-23

## 1. Objet

Ce document transforme l'analyse cible en plan d'implementation concret.

L'objectif n'est pas de tout faire d'un coup. Il s'agit de faire evoluer l'existant de maniere progressive :

- sans casser les usages mono-utilisateur actuels ;
- en introduisant d'abord les fournisseurs API rattaches au compte utilisateur ;
- puis en introduisant ensuite le partage d'une meme boite mail entre plusieurs utilisateurs ;
- enfin en ajoutant la comptabilite, les couts et les statistiques de production.

Decision de conception retenue :

- il n'y a pas deux applications, l'une `mono` et l'autre `multi` ;
- il y a une seule application cible multi-utilisateurs ;
- le `mono-utilisateur` est traite comme un cas particulier de configuration.

## 2. Principe de migration

Le mode actuel doit rester valide pendant toute la migration.

Le principe est donc :

1. ajouter les nouvelles tables sans supprimer les anciennes ;
2. faire coexister temporairement ancien et nouveau modele ;
3. faire migrer les services backend un par un ;
4. exposer ensuite les nouvelles capacites dans le frontend ;
5. seulement a la fin, faire converger tout le produit vers un mode multi-utilisateurs normal, dont le mono restera un cas particulier.

## 3. Resultat attendu par phase

### Phase A

Resultat attendu :

- chaque utilisateur peut configurer son propre fournisseur API de dictée ;
- le cas mono-utilisateur continue de fonctionner ;
- les couts et usages peuvent etre traces par utilisateur.

### Phase B

Resultat attendu :

- une boite mail peut devenir une ressource partagee ;
- plusieurs utilisateurs peuvent y etre rattaches ;
- leurs droits differencient lecture, brouillon, validation, envoi et administration de la boite.

### Phase C

Resultat attendu :

- les usages API payants sont suivis par utilisateur et par boite ;
- les statistiques et les couts deviennent visibles ;
- les administrateurs peuvent superviser et arbitrer.

## 4. Phase A - Fournisseurs API personnels par utilisateur

## 4.1 Objectif

Commencer par le besoin le plus immediat :

- l'utilisateur choisit `Deepgram` ou `AssemblyAI` ;
- il saisit sa propre cle ;
- l'application utilise son compte fournisseur ;
- la consommation est rattachee a son compte.

Cette phase ne demande pas encore de partage de boite mail.

## 4.2 Base de donnees

### Nouvelles tables a ajouter

#### `provider_accounts`

Premiere version recommandee :

- `id TEXT PRIMARY KEY`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `owner_scope_type TEXT NOT NULL`
- `owner_scope_id TEXT NOT NULL`
- `provider_type TEXT NOT NULL`
- `provider_label TEXT NOT NULL`
- `credential_mode TEXT NOT NULL`
- `api_key_encrypted TEXT NOT NULL`
- `api_key_masked TEXT NOT NULL`
- `status TEXT NOT NULL`
- `is_default INTEGER NOT NULL DEFAULT 0`
- `billing_mode TEXT NOT NULL`
- `monthly_budget_cents INTEGER NOT NULL DEFAULT 0`
- `notes TEXT`
- `last_tested_at TEXT`
- `last_error TEXT`

Indices recommandes :

- index sur `owner_scope_type, owner_scope_id`
- index sur `provider_type`
- unicite sur `owner_scope_type, owner_scope_id, provider_type, credential_mode, is_default` si besoin

#### `provider_usage_events`

Premiere version recommandee :

- `id TEXT PRIMARY KEY`
- `created_at TEXT NOT NULL`
- `account_id TEXT NOT NULL`
- `provider_account_id TEXT NOT NULL`
- `provider_type TEXT NOT NULL`
- `feature_type TEXT NOT NULL`
- `request_mode TEXT NOT NULL`
- `quantity REAL NOT NULL DEFAULT 0`
- `quantity_unit TEXT NOT NULL`
- `estimated_cost_cents INTEGER NOT NULL DEFAULT 0`
- `currency TEXT NOT NULL DEFAULT 'EUR'`
- `status TEXT NOT NULL`
- `request_id TEXT`
- `mailbox_resource_id TEXT`
- `metadata_json TEXT`

Indices recommandes :

- index sur `account_id, created_at`
- index sur `provider_account_id, created_at`
- index sur `provider_type, feature_type`

#### `user_preferences`

Premiere version recommandee :

- `account_id TEXT PRIMARY KEY`
- `updated_at TEXT NOT NULL`
- `ui_settings_json TEXT NOT NULL`
- `audio_settings_json TEXT NOT NULL`
- `mail_settings_json TEXT NOT NULL`
- `provider_preferences_json TEXT NOT NULL`

## 4.3 Modules backend a modifier

### `/backend/src/services/databaseService.js`

Travaux :

- ajouter les 3 tables ci-dessus ;
- ajouter les fonctions :
  - `upsertProviderAccount`
  - `listProviderAccountsForOwner`
  - `getProviderAccountById`
  - `getDefaultProviderAccountForOwner`
  - `recordProviderUsageEvent`
  - `listProviderUsageEvents`
  - `getProviderUsageSummaryForAccount`
  - `saveUserPreferences`
  - `getUserPreferences`

Priorite :

- tres haute.

### `/backend/src/routes/accountRoutes.js`

Travaux :

- ajouter :
  - `GET /api/account/preferences`
  - `PUT /api/account/preferences`
  - `GET /api/account/providers`
  - `POST /api/account/providers`
  - `PUT /api/account/providers/:id`
  - `POST /api/account/providers/:id/test`
  - `DELETE /api/account/providers/:id`
- verifier que toutes ces routes necessitent une session active ;
- enrichir la route session pour retourner :
  - les preferences serveur minimales ;
  - les fournisseurs actifs disponibles.

Priorite :

- tres haute.

### `/backend/src/services/audioTranscriptionService.js`

Travaux :

- ne plus prendre `DEEPGRAM_API_KEY` ou `ASSEMBLYAI_API_KEY` comme unique source de prod ;
- introduire un resolveur fournisseur :
  - chercher d'abord un compte personnel utilisateur ;
  - sinon un compte mutualise autorise ;
  - sinon retourner une erreur claire ;
- ajouter la logique d'estimation de cout ;
- enregistrer un `provider_usage_event` a la fin de chaque session live.

Priorite :

- tres haute.

### `/backend/src/routes/audioRoutes.js`

Travaux :

- transmettre l'identite utilisateur a la resolution du fournisseur ;
- retourner dans les reponses de fin de session :
  - `providerType`
  - `providerAccountId`
  - `estimatedCostCents`
  - `billingMode`
- conserver la compatibilite avec le mode local de secours.

Priorite :

- haute.

## 4.4 Modules frontend a modifier

### `/frontend/settings.html`

Travaux :

- ajouter une vraie section `Fournisseurs API` ;
- pour chaque fournisseur :
  - bouton `Configurer`
  - champ de cle masque
  - bouton `Tester`
  - bouton `Activer comme fournisseur par defaut`
  - affichage du mode de facturation
- ajouter une zone `Consommation et couts`.

Priorite :

- tres haute.

### `/frontend/js/settings.js`

Travaux :

- charger les preferences depuis le backend apres login ;
- synchroniser :
  - fournisseur de dictée choisi ;
  - mode de secours local ;
  - budget mensuel si expose a l'utilisateur ;
- enregistrer les modifications de preferences cote serveur ;
- garder `localStorage` comme cache local, pas comme source unique.

Priorite :

- tres haute.

### `/frontend/js/audioInput.js`

Travaux :

- continuer d'utiliser le module partage live ;
- ajouter dans les statuts utilisateur :
  - fournisseur reellement utilise ;
  - compte fournisseur personnel ou mutualise ;
  - erreur si la cle personnelle est invalide ;
- afficher plus tard le cout estime d'une session si utile.

Priorite :

- haute.

## 4.5 Livrable de fin de phase A

Fin de phase A validee si :

- un utilisateur peut configurer `Deepgram` ou `AssemblyAI` ;
- la dictée marche avec son fournisseur personnel ;
- les appels sont journalises ;
- un cout estime est calculable ;
- le mode mono-utilisateur continue de fonctionner.

## 5. Phase B - Boites mail partagees et droits d'acces

## 5.1 Objectif

Faire evoluer la boite mail depuis une ressource quasi personnelle vers une ressource partagee entre plusieurs utilisateurs.

## 5.2 Base de donnees

### Nouvelles tables a ajouter

#### `mailbox_resources`

- `id TEXT PRIMARY KEY`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `status TEXT NOT NULL`
- `email_address TEXT NOT NULL`
- `display_name TEXT`
- `provider TEXT`
- `resource_scope_type TEXT NOT NULL`
- `resource_scope_id TEXT`
- `default_connection_id TEXT`
- `notes TEXT`

#### `mailbox_memberships`

- `id TEXT PRIMARY KEY`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `account_id TEXT NOT NULL`
- `mailbox_resource_id TEXT NOT NULL`
- `membership_status TEXT NOT NULL`
- `permission_read INTEGER NOT NULL DEFAULT 0`
- `permission_draft INTEGER NOT NULL DEFAULT 0`
- `permission_validate INTEGER NOT NULL DEFAULT 0`
- `permission_send INTEGER NOT NULL DEFAULT 0`
- `permission_manage_mailbox INTEGER NOT NULL DEFAULT 0`
- `permission_manage_rules INTEGER NOT NULL DEFAULT 0`
- `permission_manage_provider_costs INTEGER NOT NULL DEFAULT 0`
- `is_default_mailbox INTEGER NOT NULL DEFAULT 0`

### Table a faire evoluer

#### `mailbox_connections`

Migration recommandee :

- ajouter `mailbox_resource_id`
- ajouter `created_by_account_id`
- ajouter `managed_by_scope_type`
- ajouter `managed_by_scope_id`
- conserver temporairement `account_id` pour compatibilite

## 5.3 Strategy de migration des boites

Pour chaque connexion existante :

1. creer une `mailbox_resource` avec la meme adresse ;
2. rattacher la connexion existante a cette ressource ;
3. creer une `mailbox_membership` pour l'utilisateur actuel ;
4. marquer cette membership comme `is_default_mailbox = 1`.

Ainsi :

- l'ancien mode reste supporte ;
- chaque ancien utilisateur retrouve sa boite sans rupture ;
- la structure est deja prete pour le partage futur.

## 5.4 Modules backend a modifier

### `/backend/src/services/databaseService.js`

Travaux :

- ajouter :
  - `createMailboxResource`
  - `getMailboxResourceById`
  - `listMailboxResourcesForAccount`
  - `createMailboxMembership`
  - `listMailboxMembershipsForMailbox`
  - `getMailboxMembershipForAccount`
- ajouter une migration de donnees pour les connexions existantes.

Priorite :

- tres haute.

### `/backend/src/services/mailboxService.js`

Travaux :

- faire passer tous les controles d'acces par la `mailbox_membership` ;
- remplacer la logique `getMailboxConnectionByIdForAccount` par une logique :
  - ressource + membership + connexion ;
- verifier les droits avant :
  - inbox
  - lecture de message
  - brouillon
  - validation
  - envoi
- retourner le contexte de partage a l'UI.

Priorite :

- tres haute.

### `/backend/src/routes/mailRoutes.js`

Travaux :

- introduire des endpoints ressources :
  - `GET /api/mailbox/resources`
  - `GET /api/mailbox/resources/:id`
  - `GET /api/mailbox/resources/:id/members`
- faire en sorte que les routes existantes puissent accepter :
  - `connectionId`
  - ou `mailboxResourceId`
- journaliser l'auteur exact de chaque action.

Priorite :

- haute.

### `/backend/src/services/browserAutomationService.js`

Travaux :

- passer de `account + connection` a `membership + resource + connection` ;
- permettre des politiques :
  - personnelles
  - ou partagees a l'echelle de la boite.

Priorite :

- moyenne a ce stade.

## 5.5 Modules frontend a modifier

### `/frontend/account.html` et `/frontend/js/account.js`

Travaux :

- afficher :
  - boites rattachees
  - role sur chaque boite
  - boite par defaut

### `/frontend/mail.html` et `/frontend/js/mail.js`

Travaux :

- ajouter le choix de la boite courante si plusieurs boites sont disponibles ;
- afficher dans l'interface :
  - la boite active
  - le role utilisateur
  - l'etat partage ou non de la boite
- a terme :
  - afficher qui traite ou a traite certains messages.

### `/frontend/admin-db.html` et `/frontend/js/admin-db.js`

Travaux :

- ajouter des ecrans de gestion :
  - ressources boite mail
  - memberships
  - permissions.

## 5.6 Livrable de fin de phase B

Fin de phase B validee si :

- une meme boite mail peut etre visible par plusieurs utilisateurs ;
- chaque utilisateur n'a que les droits autorises ;
- les actions sont tracees avec le bon auteur ;
- l'ancien mode mono-utilisateur continue de marcher sans configuration supplementaire.

## 6. Phase C - Assignations, couts, stats et supervision

## 6.1 Objectif

Completer la dimension production :

- suivis de couts ;
- supervision ;
- collaboration sur une meme boite ;
- pilotage admin.

## 6.2 Base de donnees

### Nouvelle table `mailbox_assignments`

- `id TEXT PRIMARY KEY`
- `created_at TEXT NOT NULL`
- `updated_at TEXT NOT NULL`
- `mailbox_resource_id TEXT NOT NULL`
- `message_id TEXT NOT NULL`
- `assigned_to_account_id TEXT`
- `assigned_by_account_id TEXT`
- `assignment_status TEXT NOT NULL`
- `lock_expires_at TEXT`

## 6.3 Modules backend a modifier

### `/backend/src/services/databaseService.js`

Travaux :

- ajouter :
  - `createMailboxAssignment`
  - `getMailboxAssignment`
  - `listMailboxAssignmentsForMailbox`
  - `releaseMailboxAssignment`
  - `getProviderCostSummaryByAccount`
  - `getProviderCostSummaryByMailbox`
  - `getProviderCostSummaryByProvider`

### `/backend/src/routes/accountRoutes.js`

Travaux :

- ajouter des endpoints :
  - `GET /api/account/usage-summary`
  - `GET /api/account/provider-costs`

### `/backend/src/routes/mailRoutes.js`

Travaux :

- ajouter :
  - `POST /api/mailbox/resources/:id/assignments`
  - `DELETE /api/mailbox/resources/:id/assignments/:assignmentId`
  - `GET /api/mailbox/resources/:id/activity`

### `/backend/src/routes/adminRoutes.js`

Travaux :

- ajouter :
  - `GET /api/admin/provider-usage`
  - `GET /api/admin/provider-costs`
  - `GET /api/admin/mailbox-collaboration`
  - `PUT /api/admin/mailbox-memberships/:id`

## 6.4 Modules frontend a modifier

### `/frontend/settings.html` et `/frontend/js/settings.js`

Travaux :

- afficher les couts utilisateur :
  - du mois
  - par fournisseur
  - par fonctionnalite

### `/frontend/mail.html` et `/frontend/js/mail.js`

Travaux :

- afficher l'etat d'assignation d'un message ;
- permettre plus tard :
  - prise en charge
  - liberation
  - validation par un autre utilisateur.

### `/frontend/admin-db.html` et `/frontend/js/admin-db.js`

Travaux :

- afficher :
  - couts par utilisateur
  - couts par fournisseur
  - couts par boite
  - memberships
  - droits
  - budgets

## 6.5 Livrable de fin de phase C

Fin de phase C validee si :

- les couts et usages API sont visibles ;
- les stats sont exploitables ;
- les administrateurs peuvent surveiller les boites partagees et les fournisseurs ;
- les utilisateurs peuvent collaborer proprement sur une meme boite.

## 7. Fonctions a coder en premier

Ordre recommande des toutes premieres fonctions :

1. `provider_accounts` dans `databaseService.js`
2. `provider_usage_events` dans `databaseService.js`
3. `get/set user_preferences`
4. routes `account providers`
5. resolution dynamique du fournisseur dans `audioTranscriptionService.js`
6. enregistrement d'un usage audio facturable
7. synchronisation `settings.js` <-> backend
8. ajout UI `Fournisseurs API`
9. `mailbox_resources`
10. `mailbox_memberships`

## 8. Points de vigilance

## 8.1 Compatibilite

Ne pas casser :

- login actuel ;
- session actuelle ;
- connexion actuelle aux boites ;
- dictée actuelle ;
- mode mono-utilisateur.

## 8.2 Securite

Ne jamais stocker les cles API en clair.

Toujours prevoir :

- chiffrement ;
- masquage ;
- test de cle ;
- suppression ;
- erreur lisible.

## 8.3 UX

Ne pas exposer trop tot toute la complexite multi-utilisateur a l'usager simple.

Par defaut :

- un utilisateur mono compte ne doit presque rien voir de plus ;
- les ecrans avances ne doivent apparaitre que si plusieurs boites, fournisseurs ou memberships existent.

## 9. Planning de realisation recommande

### Sprint 1

- tables `provider_accounts`, `provider_usage_events`, `user_preferences`
- endpoints de configuration fournisseur
- lecture/enregistrement des preferences audio serveur

### Sprint 2

- integration dictée live avec fournisseur personnel ou mutualise
- trace de cout et d'usage
- affichage des premiers couts utilisateur

### Sprint 3

- tables `mailbox_resources` et `mailbox_memberships`
- migration des connexions existantes
- selection de boite active cote UI

### Sprint 4

- droits fins par boite
- journaux multi-utilisateurs
- supervision admin

### Sprint 5

- assignations
- collaboration
- stats et couts avances

## 10. Conclusion

L'evolution cible doit etre implementee dans cet ordre :

1. fournisseurs API par utilisateur ;
2. preferences serveur ;
3. ressources boites partagees ;
4. memberships et droits ;
5. couts et stats ;
6. collaboration avancee.

C'est le chemin le plus sur pour transformer l'existant sans rupture et sans perdre la simplicite du cas mono-utilisateur.

Point d'architecture a conserver :

- la simplicite du mono doit etre preservee dans l'UX ;
- mais elle ne justifie plus le maintien de deux logiques techniques distinctes.
