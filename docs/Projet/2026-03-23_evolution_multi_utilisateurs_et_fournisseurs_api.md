# Evolution de l'existant vers un mode multi-utilisateurs avec fournisseurs API rattaches aux comptes

Date : 2026-03-23

## 1. Objet

Ce document analyse l'etat actuel de l'application et propose, module par module, les modifications a apporter pour faire evoluer l'existant :

- d'un mode essentiellement mono-utilisateur ;
- vers un mode multi-utilisateurs ;
- avec possibilite de partager une meme boite mail entre plusieurs utilisateurs ;
- avec rattachement de fournisseurs API personnels ou mutualises ;
- avec suivi d'usage, de couts et de statistiques par utilisateur.

Decision d'architecture actee :

- l'application cible est une application nativement multi-utilisateurs ;
- le mode mono-utilisateur n'est pas un mode technique distinct ;
- il devient simplement un cas particulier du modele multi-utilisateurs.

Le mode mono-utilisateur doit donc rester possible, mais uniquement comme cas particulier du modele cible :

- un seul utilisateur actif ;
- une seule boite rattachee ;
- un seul fournisseur configure ;
- aucun partage explicite entre utilisateurs.

## 2. Constat sur l'existant

## 2.1 Ce qui est deja en place

L'existant contient deja des briques utiles :

- une base SQLite structuree ;
- des comptes, sessions et statuts ;
- des connexions a des boites mail ;
- des actions journalisees sur les messages ;
- une base de facturation minimale ;
- un fonctionnement audio avec choix de fournisseur ;
- une logique de session applicative par utilisateur.

## 2.2 Limites actuelles

L'existant reste cependant pense principalement autour de `account_id` comme cle unique de presque tout.

Conséquences :

- un utilisateur et une entite de facturation sont pratiquement confondus ;
- une connexion a une boite mail est possedee par un seul compte ;
- le partage d'une meme boite entre plusieurs utilisateurs n'est pas modele proprement ;
- les fournisseurs API audio ne sont pas stockes comme ressources persistantes du compte ;
- les preferences sont surtout locales au navigateur ;
- les statistiques ne suivent pas encore l'usage des API payantes.

## 3. Principe cible

Le modele cible doit distinguer clairement :

- l'utilisateur ;
- le compte de connexion a l'application ;
- la boite mail comme ressource partageable ;
- le droit d'acces de l'utilisateur sur cette boite ;
- le fournisseur API utilise ;
- la source de facturation de ce fournisseur ;
- les evenements de consommation et les couts.

## 3.1 Partage des donnees Mail

Le partage d'une meme boite mail entre plusieurs utilisateurs doit rester une fonction optionnelle du point de vue metier et ergonomique, mais pas un second mode technique de l'application.

La regle retenue est la suivante :

- une seule architecture multi-utilisateurs ;
- une meme logique d'acces aux ressources ;
- une meme logique de droits et de verrous ;
- et, lorsque qu'une boite n'a qu'un seul utilisateur autorise, le cas se comporte simplement comme un cas mono-utilisateur.

Autrement dit :

- `mono-utilisateur` = une seule `mailbox_membership` active sur la boite ;
- `multi-utilisateurs` = plusieurs `mailbox_memberships` actives sur la meme boite ;
- dans les deux cas, c'est la meme application et la meme base technique.

La simplicite doit etre geree surtout dans l'interface :

- masquer la complexite de partage quand elle n'apporte rien ;
- ne montrer les notions de verrou, d'occupation ou de collaboration que lorsqu'elles ont un sens ;
- ne pas exposer inutilement la complexite multi-utilisateurs a un usager seul.

### Problemes a resoudre

Le partage des donnees mail vise a resoudre plusieurs besoins metier :

- permettre a plusieurs utilisateurs d'acceder a une meme boite mail ;
- savoir qui traite un message a un instant donne ;
- eviter qu'un meme message soit finalise deux fois en parallele ;
- tracer qui a lu, prepare, valide ou envoye un message ;
- permettre une reprise de traitement si un utilisateur abandonne ou perd sa session.

### Ce que l'on code nous-memes

Dans l'etat actuel du projet, il est recommande de coder nous-memes une couche metier legere de partage et de reservation, directement dans l'application :

- `mailbox_memberships` pour les droits d'acces ;
- `assigned_to_account_id` pour la prise en charge metier d'un message ;
- `lock_owner_account_id` pour indiquer qui a la main sur une action exclusive ;
- `lock_expires_at` pour liberer automatiquement un verrou abandonne ;
- `collaboration_state` pour savoir si le message est `new`, `claimed`, `drafting`, `awaiting_validation`, `sent`.

Cette approche a plusieurs avantages :

- elle reste compatible avec SQLite et le mode local actuel ;
- elle ne rajoute pas d'infrastructure externe des maintenant ;
- elle permet de conserver un cas mono-utilisateur tres simple sans inventer un second mode technique ;
- elle couvre deja les conflits les plus importants autour de la validation et de l'envoi.

### Ce qu'il ne faut pas reimplementer si une brique existante suffit

Il n'est pas utile de reecrire un moteur complet d'orchestration asynchrone si l'application doit plus tard gerer davantage de concurrence, de reprise automatique et de traitements differes.

Dans ce cas, la brique la plus interessante a integrer plus tard est `BullMQ`.

`BullMQ` servirait a :

- mettre en file les traitements de synchronisation ou d'envoi ;
- garantir les retries propres ;
- serialiser certaines operations critiques ;
- reprendre des traitements interrompus ;
- isoler les taches longues du cycle HTTP principal.

Cette brique est pertinente pour eviter de reecrire :

- une file de jobs ;
- un systeme de retries ;
- un ordonnanceur de reprise ;
- une gestion artisanale des echecs de traitements.

### Ce qu'il ne faut pas integrer trop tot

Les briques suivantes existent, mais ne sont pas recommandees a ce stade :

- `Yjs`
- `Liveblocks`
- `Temporal`

Raisons :

- `Yjs` est surtout utile pour de la vraie co-edition temps reel de documents ;
- `Liveblocks` est surtout une plateforme de collaboration et de presence temps reel cote interface ;
- `Temporal` est tres puissant, mais plus lourd que le besoin actuel du projet.

Pour le produit actuel, ces briques introduiraient trop de complexite par rapport au besoin reel :

- partage d'une boite mail ;
- reservation d'un message ;
- action finale exclusive ;
- tracabilite.

### Gratuité et cout

Pour la logique de partage a ce stade :

- la couche metier codee dans l'application est gratuite ;
- `BullMQ` est gratuit et open source ;
- `Yjs` est gratuit et open source ;
- `Temporal` est gratuit en self-hosted open source, mais plus couteux a exploiter ;
- `Liveblocks` est freemium puis payant.

Conclusion pratique :

- maintenant : logique de partage et de verrouillage legere codee dans l'application ;
- plus tard si la concurrence augmente : integration de `BullMQ` ;
- pas d'integration immediate de `Yjs`, `Liveblocks` ou `Temporal`.

## 4. Modele de donnees cible

## 4.1 Evolution conceptuelle

L'existant peut evoluer sans tout casser si l'on retient ces concepts :

- `accounts` : reste le compte de connexion d'un utilisateur ;
- `mailbox_resources` : nouvelle entite representant la boite partagee ;
- `mailbox_memberships` : nouvelle table pour lier un utilisateur a une boite ;
- `provider_accounts` : nouvelle table pour stocker les fournisseurs API associes a un utilisateur ou a une organisation ;
- `provider_usage_events` : nouvelle table pour enregistrer l'usage et le cout ;
- `user_preferences` : nouvelle table pour sortir progressivement les preferences critiques du `localStorage`.

## 4.2 Tables existantes a faire evoluer

### `accounts`

Etat actuel :

- correcte pour l'identite et l'authentification ;
- insuffisante pour la gestion des fournisseurs et du partage de boites.

Modifications proposees :

- conserver la table ;
- ajouter si besoin :
  - `default_billing_mode`
  - `default_provider_scope`
  - `is_personal_provider_allowed`
  - `last_login_at`

### `mailboxes`

Etat actuel :

- represente une boite mais avec une structure encore trop liee a un seul `account_id`.

Modifications proposees :

- transformer le role de cette table en ressource partagee ;
- deplacer la notion de possession exclusive hors de cette table ;
- preferer un champ du type :
  - `owner_scope_type`
  - `owner_scope_id`

### `mailbox_connections`

Etat actuel :

- connexion OAuth ou technique rattachee a `account_id` ;
- contrainte unique par `account_id + mailbox_email + provider_id`.

Probleme :

- cela bloque proprement le partage natif d'une meme boite entre plusieurs utilisateurs.

Modifications proposees :

- remplacer la logique de possession par une logique de support de connexion ;
- rattacher la connexion a une `mailbox_resource_id` au lieu de `account_id` ;
- ajouter :
  - `created_by_account_id`
  - `managed_by_scope_type`
  - `managed_by_scope_id`

### `mailbox_message_actions`

Etat actuel :

- journalisation par `account_id` et `connection_id`.

Probleme :

- utile pour un usage personnel ;
- insuffisant pour savoir qui a fait quoi sur une boite partagee.

Modifications proposees :

- remplacer ou completer avec :
  - `mailbox_resource_id`
  - `membership_id`
  - `actor_account_id`
  - `assignment_state`
  - `collaboration_state`

### `user_stats`

Etat actuel :

- statistiques utilisateur basiques ;
- pas de cout fournisseur.

Modifications proposees :

- garder la table pour les stats produit globales ;
- ajouter des tables dediees aux API payantes.

### `billing_profiles` et `invoices`

Etat actuel :

- structure presente mais encore generale.

Modifications proposees :

- conserver ces tables ;
- ajouter des liens vers les usages fournisseurs ;
- permettre un profil de facturation :
  - personnel ;
  - organisation ;
  - plateforme.

## 4.3 Nouvelles tables recommandees

### `mailbox_resources`

Objet :

- representer une boite mail partageable comme ressource metier unique.

Champs recommandes :

- `id`
- `created_at`
- `updated_at`
- `status`
- `email_address`
- `display_name`
- `provider`
- `resource_scope_type`
- `resource_scope_id`
- `default_connection_id`
- `notes`

### `mailbox_memberships`

Objet :

- rattacher plusieurs utilisateurs a une meme boite.

Champs recommandes :

- `id`
- `created_at`
- `updated_at`
- `account_id`
- `mailbox_resource_id`
- `membership_status`
- `permission_read`
- `permission_draft`
- `permission_validate`
- `permission_send`
- `permission_manage_mailbox`
- `permission_manage_rules`
- `permission_manage_provider_costs`
- `is_default_mailbox`

### `provider_accounts`

Objet :

- stocker les comptes fournisseurs personnels ou mutualises.

Champs recommandes :

- `id`
- `created_at`
- `updated_at`
- `owner_scope_type`
- `owner_scope_id`
- `provider_type`
- `provider_label`
- `credential_mode`
- `api_key_encrypted`
- `api_key_masked`
- `status`
- `is_default`
- `billing_mode`
- `monthly_budget_cents`
- `notes`
- `last_tested_at`
- `last_error`

### `provider_usage_events`

Objet :

- enregistrer chaque consommation facturable.

Champs recommandes :

- `id`
- `created_at`
- `account_id`
- `mailbox_resource_id`
- `provider_account_id`
- `provider_type`
- `feature_type`
- `request_mode`
- `quantity`
- `quantity_unit`
- `estimated_cost_cents`
- `currency`
- `request_id`
- `status`
- `metadata_json`

### `user_preferences`

Objet :

- stocker cote serveur les preferences critiques.

Champs recommandes :

- `account_id`
- `updated_at`
- `ui_settings_json`
- `audio_settings_json`
- `mail_settings_json`
- `provider_preferences_json`

### `mailbox_assignments`

Objet :

- gerer l'attribution de traitement quand plusieurs utilisateurs travaillent sur la meme boite.

Champs recommandes :

- `id`
- `created_at`
- `updated_at`
- `mailbox_resource_id`
- `message_id`
- `assigned_to_account_id`
- `assigned_by_account_id`
- `assignment_status`
- `lock_expires_at`

## 5. Modifications backend module par module

## 5.1 `/backend/src/services/databaseService.js`

Role actuel :

- schema SQLite principal ;
- acces bas niveau a presque toutes les entites.

Modifications a apporter :

- ajouter les nouvelles tables :
  - `mailbox_resources`
  - `mailbox_memberships`
  - `provider_accounts`
  - `provider_usage_events`
  - `user_preferences`
  - `mailbox_assignments`
- migrer `mailbox_connections` pour qu'elle reference une ressource partagee ;
- ajouter des fonctions :
  - `listMailboxResourcesForAccount`
  - `getMailboxMembership`
  - `listMailboxMembershipsForMailbox`
  - `upsertProviderAccount`
  - `listProviderAccountsForAccount`
  - `recordProviderUsageEvent`
  - `listProviderUsageStats`
  - `saveUserPreferences`
  - `getUserPreferences`
- sortir les stats de cout de la logique purement `user_stats`.

Impact :

- c'est le module prioritaire ;
- toute la suite depend de cette evolution.

## 5.2 `/backend/src/routes/accountRoutes.js`

Role actuel :

- login ;
- session ;
- demande de compte ;
- statut de compte.

Modifications a apporter :

- conserver la session telle quelle ;
- enrichir la session retournee avec :
  - `defaultMailboxResourceId`
  - `availableMailboxCount`
  - `providerAccountsConfigured`
- ajouter des endpoints :
  - `GET /api/account/preferences`
  - `PUT /api/account/preferences`
  - `GET /api/account/providers`
  - `POST /api/account/providers`
  - `PUT /api/account/providers/:id`
  - `POST /api/account/providers/:id/test`
  - `DELETE /api/account/providers/:id`
- ajouter plus tard :
  - `GET /api/account/mailboxes`
  - `GET /api/account/memberships`

Impact :

- la page Compte devient la porte d'entree d'un vrai profil utilisateur complet.

## 5.3 `/backend/src/services/mailboxService.js`

Role actuel :

- connexion OAuth ;
- inbox ;
- lecture des messages ;
- traitement ;
- actions Gmail.

Limite actuelle :

- tout est pense a partir de `accountId + connectionId`.

Modifications a apporter :

- faire passer les verifications d'acces par `mailbox_memberships` ;
- remplacer la logique `getMailboxConnectionByIdForAccount` par une logique du type :
  - `getMailboxConnectionForMember`
  - `getDefaultMailboxConnectionForResource`
- decoupler :
  - la ressource boite ;
  - la connexion technique ;
  - le membre utilisateur ;
- ajouter la gestion de conflits simples :
  - message en cours de traitement ;
  - message deja traite par un autre utilisateur ;
  - message assigne ;
- retourner a l'UI :
  - l'identite de la boite ;
  - le role de l'utilisateur sur cette boite ;
  - l'etat de partage.

Impact :

- c'est le coeur du passage au multi-utilisateurs sur une meme boite.

## 5.4 `/backend/src/routes/mailRoutes.js`

Role actuel :

- endpoints mail IA ;
- endpoints boites mail ;
- endpoints inbox.

Modifications a apporter :

- faire remonter un contexte explicite :
  - `account`
  - `mailboxResource`
  - `membership`
  - `connection`
- ajouter des endpoints :
  - `GET /api/mailbox/resources`
  - `GET /api/mailbox/:resourceId/members`
  - `POST /api/mailbox/:resourceId/assignments`
  - `GET /api/mailbox/:resourceId/activity`
- lors des actions sur message, journaliser :
  - l'utilisateur ;
  - la boite ;
  - le fournisseur utilise ;
  - le cout eventuel.

## 5.5 `/backend/src/controllers/mailController.js`

Role actuel :

- import ;
- creation de brouillon ;
- reponse.

Modifications a apporter :

- enrichir le contexte avec :
  - identite utilisateur ;
  - boite courante ;
  - regles de cette boite ;
  - fournisseur IA choisi pour ce compte ;
  - mode de facturation ;
- preparer la future logique de completude du contexte ;
- journaliser l'usage des modeles payants quand ils sont utilises plus tard.

## 5.6 `/backend/src/services/audioTranscriptionService.js`

Role actuel :

- transcription locale ;
- Deepgram ;
- AssemblyAI ;
- live sessions.

Limite actuelle :

- les cles API sont encore globales au serveur via `.env`.

Modifications a apporter :

- introduire une resolution dynamique du fournisseur :
  - chercher le `provider_account` associe a l'utilisateur ;
  - sinon utiliser un compte mutualise de plateforme si autorise ;
- ne plus lire `DEEPGRAM_API_KEY` et `ASSEMBLYAI_API_KEY` comme source unique de production ;
- ajouter des fonctions :
  - `resolveAudioProviderForAccount(accountId, providerType)`
  - `estimateAudioUsageCost(providerType, usageData)`
  - `recordAudioUsageEvent(...)`
- associer chaque session live a :
  - `account_id`
  - `provider_account_id`
  - `mailbox_resource_id` si pertinent.

Impact :

- indispensable pour rendre la comptabilite par utilisateur fiable.

## 5.7 `/backend/src/routes/audioRoutes.js`

Role actuel :

- route de transcription batch et live.

Modifications a apporter :

- exiger une session utilisateur pour toute route live de production ;
- resoudre le fournisseur a partir du compte ;
- retourner :
  - le fournisseur reellement utilise ;
  - un cout estime en fin de session ;
  - un identifiant d'usage.

## 5.8 `/backend/src/services/browserAutomationService.js`

Role actuel :

- politiques d'automatisation par connexion.

Modifications a apporter :

- remplacer la logique `account + connection` par :
  - `mailbox_resource + membership + policy scope`
- distinguer :
  - politique personnelle de l'utilisateur ;
  - politique commune a la boite ;
- journaliser l'auteur d'une session navigateur sur une boite partagee.

## 5.9 `/backend/src/routes/browserAutomationRoutes.js`

Modifications a apporter :

- toutes les verifications d'acces doivent passer par le membre de boite ;
- les politiques ne doivent plus etre uniquement proprietaires d'un compte individuel ;
- ajouter plus tard la notion :
  - `policy owner = user`
  - ou `policy owner = mailbox`.

## 5.10 `/backend/src/services/accountDataStore.js`

Etat actuel :

- ancien stockage JSON.

Modifications a apporter :

- le geler comme couche legacy ;
- ne plus l'utiliser pour les nouvelles fonctions multi-utilisateurs ;
- documenter qu'il n'est plus la source principale.

## 6. Modifications frontend module par module

## 6.1 `/frontend/js/account.js` et `/frontend/account.html`

Role actuel :

- demande de compte ;
- login ;
- statut ;
- session.

Modifications a apporter :

- afficher apres connexion :
  - boites rattachees ;
  - fournisseur audio configure ;
  - mode de facturation ;
- ajouter un bloc :
  - `Mes fournisseurs API`
  - `Mes boites partagees`
  - `Mon role sur chaque boite`
- plus tard :
  - selection de la boite par defaut.

## 6.2 `/frontend/js/settings.js` et `/frontend/settings.html`

Role actuel :

- preferences principalement locales ;
- choix du moteur audio.

Modifications a apporter :

- conserver le confort du `localStorage` pour l'UX immediate ;
- mais synchroniser les preferences importantes avec le backend ;
- ajouter une section :
  - `Fournisseurs et API`
- pour chaque fournisseur :
  - activer/desactiver
  - renseigner la cle
  - tester la cle
  - voir le mode de facturation
  - choisir le fournisseur de dictée par defaut
- ajouter une section `Consommation et couts` avec :
  - minutes audio
  - requetes
  - cout estime du mois
  - plafond optionnel

Impact :

- la page Parametres devient la page principale de configuration des API.

## 6.3 `/frontend/js/mail.js` et `/frontend/mail.html`

Role actuel :

- traitement creation/reponse ;
- gestion d'une boite connectee ;
- quelques compteurs de session.

Modifications a apporter :

- afficher clairement la boite active ;
- si plusieurs boites sont accessibles :
  - permettre de choisir la boite courante ;
- si la boite est partagee :
  - afficher le role utilisateur ;
  - afficher l'etat d'assignation ou de verrouillage d'un message ;
  - afficher qui a deja traite ou valide ;
- lors d'une dictée :
  - indiquer quel fournisseur est utilise ;
  - indiquer si le fournisseur est personnel ou mutualise ;
- remplacer les compteurs purement locaux par des donnees serveur pour les vraies stats.

## 6.4 `/frontend/js/audioInput.js`

Role actuel :

- branchement de la dictée dans les zones mail.

Modifications a apporter :

- utiliser uniquement le moteur partage live ;
- envoyer au backend le contexte :
  - `providerPreference`
  - `mailboxResourceId`
  - `featureType = dictation`
- afficher si necessaire :
  - fournisseur ;
  - statut de cout ;
  - erreur de fournisseur personnel invalide.

## 6.5 `/frontend/js/liveSpeechClient.js`

Role actuel :

- client live partage pour Deepgram et AssemblyAI.

Modifications a apporter :

- conserver ce module comme socle ;
- lui ajouter des callbacks meta :
  - `providerType`
  - `providerAccountMode`
  - `usageEstimate`
- ne pas y mettre de logique metier multi-utilisateur ;
- garder ce module le plus technique et reutilisable possible.

## 6.6 `/frontend/js/audioTest.js` et `/frontend/audio-test.html`

Role actuel :

- banc d'essai technique.

Modifications a apporter :

- en faire un outil admin ou debug ;
- afficher :
  - fournisseur reel ;
  - cout estime de l'essai ;
  - compte fournisseur utilise ;
- ajouter un mode de test :
  - `cle perso`
  - `cle plateforme`

## 6.7 `/frontend/js/admin-db.js` et page admin

Role actuel :

- gestion des demandes et comptes.

Modifications a apporter :

- ajouter la gestion :
  - des boites partagees ;
  - des membres de boite ;
  - des droits ;
  - des fournisseurs mutualises ;
  - des plafonds de cout ;
  - des usages et couts par utilisateur.

## 7. Statistiques et comptabilite

## 7.1 Ce qu'il faut suivre

Pour chaque appel payant, il faut enregistrer :

- utilisateur ;
- boite mail si applicable ;
- fournisseur ;
- fonctionnalite ;
- duree ou volume ;
- cout estime ;
- statut ;
- date.

## 7.2 Restitutions a prevoir

### Cote utilisateur

- consommation du mois ;
- cout estime ;
- fournisseur utilise ;
- historique recent.

### Cote administrateur

- cout total par fournisseur ;
- cout par utilisateur ;
- cout par boite partagee ;
- top utilisateurs ;
- anomalies ;
- depassements de budget.

## 8. Securite

## 8.1 Cles API

Les cles personnelles ne doivent pas etre stockees en clair.

Il faut :

- chiffrement au repos ;
- masquage UI ;
- test sans reaffichage ;
- suppression propre ;
- rotation possible.

## 8.2 Autorisations

Un utilisateur ne doit jamais pouvoir :

- utiliser la cle personnelle d'un autre utilisateur ;
- voir les couts detailles d'un autre utilisateur sans droit ;
- acceder a une boite partagee sans `membership`.

## 9. Migration progressive depuis le mono-utilisateur

Important :

- la migration ne vise pas a maintenir durablement deux architectures `mono` et `multi` ;
- elle vise a faire converger l'existant vers une seule architecture multi-utilisateurs ;
- le `mono-utilisateur` reste ensuite seulement un cas de configuration simple.

## 9.1 Phase 1

- garder `accounts` tel quel ;
- ajouter `provider_accounts` ;
- ajouter `provider_usage_events` ;
- garder les boites encore quasi personnelles ;
- synchroniser les preferences critiques au serveur.

Objectif :

- gerer les fournisseurs API personnels par utilisateur.

## 9.2 Phase 2

- introduire `mailbox_resources` ;
- introduire `mailbox_memberships` ;
- migrer `mailbox_connections` ;
- permettre plusieurs utilisateurs sur la meme boite.

Objectif :

- gerer proprement le partage de boites mail.

## 9.3 Phase 3

- ajout des assignments, locks, validations partagees ;
- ajout des stats et couts avances ;
- ajout de la gouvernance admin complete.

## 10. Ordre de priorite recommande

1. `databaseService.js`
2. `audioTranscriptionService.js`
3. `audioRoutes.js`
4. `settings.html` / `settings.js`
5. `accountRoutes.js`
6. `account.html` / `account.js`
7. `mailboxService.js`
8. `mailRoutes.js`
9. `mail.html` / `mail.js`
10. `admin-db`

## 11. Conclusion

L'existant peut evoluer vers un vrai mode multi-utilisateurs sans etre reconstruit integralement, mais a une condition :

- cesser de faire porter a `account_id` seul toutes les responsabilites.

La direction cible est la suivante :

- `account` = identite et session ;
- `mailbox_resource` = boite partagee ;
- `mailbox_membership` = droit d'un utilisateur sur une boite ;
- `provider_account` = compte API personnel ou mutualise ;
- `provider_usage_event` = traçabilite et cout.

Le mode mono-utilisateur reste alors simple :

- un seul compte ;
- une seule membership ;
- un seul fournisseur ;
- aucune complexite visible pour l'usager.

Mais il ne constitue plus un mode technique a part :

- il est seulement un cas particulier du modele multi-utilisateurs cible.
