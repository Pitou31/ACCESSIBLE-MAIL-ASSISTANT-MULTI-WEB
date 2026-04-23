# Conception technique - comptes, roles, demandes et boites mail

Date : 2026-03-15

## 1. Objet du document
Ce document decrit une proposition de conception technique pour la future gestion :
- des comptes ;
- des roles ;
- des demandes d'ouverture ;
- des boites mail ;
- des droits d'acces ;
- de la tracabilite des actions.

Il complete le document de reprise cree le meme jour et sert de base de reference pour une implementation ulterieure.

---

## 2. Principes de conception retenus

### 2.1 Ne pas implementer trop tot
La gestion des comptes ne doit pas etre mise en production dans le projet tant que le fonctionnement local de base n'est pas suffisamment stable.

En revanche, la conception doit etre posee des maintenant pour eviter :
- les impasses d'architecture ;
- la duplication future ;
- l'oubli des contraintes de droits et de multi-utilisateur.

### 2.2 Distinguer identite, droits et ressources
Le systeme doit distinguer clairement :
- l'identite d'un compte ;
- son role global ;
- les boites mail auxquelles il a acces ;
- le niveau de droit accorde sur chaque boite.

Cette separation est importante car un utilisateur peut :
- avoir un role modeste mais des acces sur plusieurs boites ;
- partager une boite avec d'autres utilisateurs ;
- ne pas avoir les memes permissions sur toutes ses boites.

---

## 3. Types de comptes

### 3.1 Compte administrateur
Caracteristiques :
- cree en dehors du parcours public ;
- non ouvert au libre enregistrement ;
- protege de facon forte ;
- non derive automatiquement d'une demande d'ouverture ;
- accede a toutes les fonctions de supervision.

Contraintes complementaires :
- plusieurs comptes administrateur doivent etre possibles ;
- tous les administrateurs actifs peuvent recevoir les alertes liees aux demandes d'ouverture ;
- un compte administrateur principal pourra etre distingue plus tard si le besoin apparait.

Responsabilites principales :
- consulter les demandes d'ouverture ;
- accepter, refuser ou demander des precisions ;
- creer et desactiver des comptes ;
- definir les droits ;
- rattacher les utilisateurs a une ou plusieurs boites mail ;
- superviser l'activite ;
- gerer la dimension administrative et, plus tard, comptable.

### 3.2 Compte utilisateur
Caracteristiques :
- cree apres validation par un administrateur ;
- accede seulement aux fonctions autorisees ;
- dispose d'un profil de droits controle ;
- est rattache a une ou plusieurs boites mail.

Cas possibles :
- utilisateur final ;
- aidant ;
- validateur ;
- collaborateur traite une boite partagee.

---

## 4. Roles recommandes

### 4.1 Role `admin`
Droits globaux :
- tous les droits ;
- acces a la future page Administration ;
- gestion des demandes, comptes, boites mail, affectations et supervision.

### 4.2 Role `user_standard`
Droits globaux :
- acces au produit ;
- lecture et traitement des boites autorisees ;
- utilisation des fonctions standards ;
- pas de gestion des comptes ;
- pas de gestion globale des droits.

### 4.3 Role `user_validator`
Droits globaux :
- droits de `user_standard` ;
- validation de brouillons ou actions sensibles selon les boites autorisees.

### 4.4 Roles futurs possibles
Roles a ne pas implementer tout de suite, mais a garder en tete :
- `caregiver` / aidant ;
- `manager` ;
- `billing_manager` ;
- `support_operator`.

---

## 5. Niveaux de droits par boite mail

En plus du role global, il faut prevoir des droits rattaches a la boite mail.

### 5.1 Niveaux proposes
- `read`
- `draft`
- `validate`
- `send`
- `manage_mailbox`

### 5.2 Exemple
Un utilisateur peut :
- etre `user_standard` au niveau global ;
- avoir `read`, `draft` et `validate` sur une boite mail A ;
- avoir seulement `read` sur une boite mail B.

Ce modele donne beaucoup plus de souplesse qu'un simple role global.

---

## 6. Entites fonctionnelles recommandees

### 6.1 `account_requests`
Objet : conserver les demandes d'ouverture de compte.

Champs recommandes :
- `id`
- `created_at`
- `updated_at`
- `status`
- `first_name`
- `last_name`
- `email`
- `phone`
- `account_type`
- `usage_mode`
- `declared_disability_usage`
- `organization_name`
- `requested_usage`
- `target_mailboxes`
- `motivation`
- `accessibility_needs`
- `supporting_document_required`
- `supporting_document_received`
- `supporting_document_path`
- `admin_notes`
- `requested_additional_info`
- `reviewed_by`
- `reviewed_at`

### 6.2 `users`
Objet : representer les comptes actifs ou suspendus.

Champs recommandes :
- `id`
- `created_at`
- `updated_at`
- `status`
- `role`
- `account_type`
- `usage_mode`
- `first_name`
- `last_name`
- `email`
- `phone`
- `organization_name`
- `password_hash`
- `last_login_at`
- `is_protected_admin`

### 6.3 `mailboxes`
Objet : representer les boites mail gerees par le produit.

Champs recommandes :
- `id`
- `created_at`
- `updated_at`
- `status`
- `email_address`
- `display_name`
- `provider`
- `owner_type`
- `owner_reference`
- `notes`

### 6.4 `mailbox_members`
Objet : rattacher des utilisateurs a des boites mail.

Champs recommandes :
- `id`
- `created_at`
- `updated_at`
- `user_id`
- `mailbox_id`
- `membership_status`
- `permission_read`
- `permission_draft`
- `permission_validate`
- `permission_send`
- `permission_manage_mailbox`

### 6.5 `mail_actions`
Objet : journaliser les actions faites sur les messages.

Champs recommandes :
- `id`
- `created_at`
- `user_id`
- `mailbox_id`
- `message_identifier`
- `action_type`
- `action_status`
- `metadata`

### 6.6 `user_stats`
Objet : fournir des statistiques personnelles pre-calculees ou materialisees.

Champs recommandes :
- `user_id`
- `period_start`
- `period_end`
- `processed_count`
- `validated_count`
- `rejected_count`
- `drafted_count`
- `estimated_time_saved`

---

## 7. Statuts recommandes

### 7.1 Statuts d'une demande d'ouverture
Statuts proposes :
- `pending`
- `more_info_requested`
- `approved`
- `rejected`
- `closed`

Indicateurs documentaires complementaires a prevoir :
- justificatif requis ou non ;
- justificatif recu ou non ;
- justificatif valide ou non.

### 7.2 Statuts d'un compte utilisateur
Statuts proposes :
- `active`
- `pending_activation`
- `suspended`
- `archived`

### 7.3 Statuts d'une affectation a une boite mail
Statuts proposes :
- `active`
- `revoked`
- `pending`

---

## 8. Workflow propose pour la demande d'ouverture

### 8.1 Soumission
L'utilisateur remplit un formulaire de demande comprenant au minimum :
- identite ;
- email de contact ;
- type de compte ;
- type d'usage gratuit ou payant ;
- contexte d'usage ;
- eventuelle organisation ;
- boites mail concernees ;
- besoins d'accessibilite ;
- informations complementaires utiles.

Types de comptes a prevoir :
- `individuel`
- `entreprise`
- `collectivite`
- `association`

Le formulaire doit aussi comporter une mention d'usage :
- `Handicape`

Si cette mention est cochee :
- un justificatif doit etre demande ;
- si ce justificatif n'est pas fourni avec la demande, l'information doit etre marquee pour controle ;
- l'administrateur doit pouvoir demander la piece avant validation definitive si la politique retenue l'exige.

Pour les comptes non individuels :
- `entreprise`
- `collectivite`
- `association`

une piece justificative doit egalement etre fournie pour verification.

### 8.2 Reception
La demande est creee en base avec le statut `pending`.

Une notification future pourra etre :
- affichee dans une interface admin ;
- envoyee par mail a un ou plusieurs administrateurs actifs ;
- enregistree dans un journal.

Le message d'alerte doit permettre a l'administrateur de voir rapidement :
- l'identite du demandeur ;
- son email ;
- le type de compte ;
- le mode d'usage gratuit ou payant ;
- la mention `Handicape` si elle est cochee ;
- la presence ou non d'un justificatif.

### 8.3 Revue administrateur
L'administrateur peut :
- approuver ;
- refuser ;
- demander des precisions.

La revue doit aussi permettre :
- de verifier les justificatifs attendus ;
- de controler les demandes marquees `Handicape` ;
- de controler les comptes non individuels ;
- d'exiger un complement documentaire avant activation.

### 8.4 Approbation
Lorsqu'une demande est approuvee :
- un compte utilisateur est cree ;
- les donnees utiles sont reprises depuis la demande ;
- un role initial est affecte ;
- une ou plusieurs boites mail sont associees ;
- des droits par defaut sont definis ;
- la demande passe a `approved`.

Le compte cree doit reprendre aussi :
- le type de compte ;
- le mode d'usage gratuit ou payant ;
- la mention eventuelle `Handicape` ;
- l'etat documentaire de validation.

### 8.5 Demande de precisions
Lorsque les informations ne sont pas suffisantes :
- la demande passe a `more_info_requested` ;
- l'administrateur renseigne ce qui manque ;
- l'utilisateur complete ensuite sa demande.

### 8.6 Refus
En cas de refus :
- la demande passe a `rejected` ;
- le motif peut etre consigne ;
- aucun compte n'est cree.

---

## 9. Workflow propose pour le compte administrateur

### 9.1 Creation initiale
Le premier compte administrateur doit etre cree hors interface publique.

Options possibles plus tard :
- fichier d'initialisation protege ;
- script d'amorcage local ;
- creation manuelle en base ;
- variable de configuration initiale.

Une fois l'initialisation faite, plusieurs comptes administrateur doivent pouvoir coexister.

### 9.2 Mesure de protection
Le compte administrateur ne doit pas :
- apparaitre dans un formulaire public ;
- etre genere automatiquement depuis une demande utilisateur ;
- partager les memes parcours que les comptes standard.

### 9.3 Future page Administration
Fonctions recommandees :
- tableau des demandes ;
- vue detaillee d'une demande ;
- actions approuver / refuser / demander des precisions ;
- creation automatique ou manuelle de compte ;
- affectation de roles ;
- affectation de boites mail ;
- configuration de la liste des administrateurs alertes ;
- suivi d'activite ;
- supervision administrative et comptable.

---

## 10. Modele de page recommande

### 10.1 Page `Compte`
Destinee a l'utilisateur connecte.

Sections recommandees :
- profil ;
- etat du compte ;
- boites mail autorisees ;
- statistiques personnelles ;
- droits visibles ;
- historique de base.

### 10.2 Page `Statistiques`
A distinguer de `Compte`.

Orientation recommandee :
- vue produit ;
- vue globale ;
- eventuellement vue organisationnelle.

### 10.3 Future page publique `Demande d'ouverture`
Page distincte de `Compte`.

Pourquoi :
- `Compte` suppose un utilisateur deja connu ;
- la demande d'ouverture correspond a une entree dans le systeme.

### 10.4 Future page `Administration`
Page reservee au role admin.

---

## 11. Impact sur la gestion des mails

### 11.1 Multi-utilisateur
Le systeme doit considerer qu'une meme boite mail peut etre traitee par plusieurs utilisateurs.

Conséquences :
- suivi des droits par boite ;
- besoin de journaliser qui fait quoi ;
- besoin de distinguer brouillon, validation, envoi ;
- besoin d'identifier la responsabilite de chaque action.

### 11.2 Journalisation minimale recommandee
Pour chaque action importante sur un message :
- utilisateur ;
- boite mail ;
- horodatage ;
- type d'action ;
- resultat ;
- reference du message.

### 11.3 Benefice
Cette approche permet :
- auditabilite ;
- supervision ;
- securite fonctionnelle ;
- meilleure comprehension des usages reels.

---

## 12. Proposition de decoupage technique futur

### 12.1 Backend
Modules recommandés a terme :
- `auth`
- `accountRequests`
- `users`
- `roles`
- `mailboxes`
- `permissions`
- `mailActions`
- `admin`

### 12.2 Frontend
Pages recommandees a terme :
- `account.html`
- `stats.html`
- `request-account.html`
- `admin.html`
- `mailbox-detail.html` plus tard si necessaire

### 12.3 Donnees
Au depart, un stockage simple pourra suffire :
- JSON local ;
- SQLite ;
- ou autre solution legere.

Il n'est pas necessaire de choisir tout de suite une infrastructure lourde.

---

## 13. Questions encore ouvertes

Questions a redecider plus tard :
- la future authentification sera-t-elle locale simple ou plus robuste ?
- quel niveau de granularite faut-il sur les permissions ?
- l'administrateur est-il unique ou plusieurs admins seront-ils permis ?
- faudra-t-il une logique d'abonnement par utilisateur, par boite mail ou par organisation ?
- la page `Statistiques` sera-t-elle globale, organisationnelle, ou les deux ?

---

## 14. Recommandation de mise en oeuvre plus tard

Ordre technique recommande quand le moment viendra :

1. creer les structures de donnees ;
2. creer la page publique de demande d'ouverture ;
3. creer le compte administrateur protege ;
4. creer une interface admin minimaliste de validation ;
5. automatiser la creation du compte utilisateur apres approbation ;
6. rattacher les utilisateurs aux boites mail ;
7. ajouter les statistiques personnelles ;
8. ajouter la journalisation complete.

---

## 15. Resume executif

La future gestion des comptes ne doit pas etre pensee comme un simple login.

Elle doit articuler :
- un compte administrateur protege ;
- des comptes utilisateurs valides ;
- des roles globaux ;
- des droits par boite mail ;
- des demandes d'ouverture ;
- une traçabilite complete des actions.

Le socle conceptuel est maintenant pose.
Il pourra etre implemente plus tard lorsque le produit local sera suffisamment stable.
