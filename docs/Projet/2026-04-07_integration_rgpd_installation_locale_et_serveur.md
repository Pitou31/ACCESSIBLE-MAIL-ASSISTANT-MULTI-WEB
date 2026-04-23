# Integration RGPD pour installation locale et serveur

Date : 2026-04-07

## 1. Question de depart

Le RGPD est-il necessaire si l'application tourne en local ?

Reponse courte :
- usage strictement personnel ou domestique : le RGPD peut ne pas s'appliquer ;
- usage pour une association, une entreprise, une administration, un service rendu a des tiers ou plusieurs utilisateurs : le RGPD doit etre pris en compte, meme si l'application tourne localement ;
- usage DGX Spark local pilote depuis Mac : le caractere local reduit les risques d'hebergement externe, mais ne supprime pas automatiquement les obligations si des donnees de tiers sont traitees.

Cette note n'est pas un avis juridique. Elle sert de base pratique d'integration technique et documentaire.

## 2. Principe juridique simplifie

Le RGPD concerne le traitement de donnees personnelles.

Sont notamment des donnees personnelles :
- nom ;
- prenom ;
- adresse e-mail ;
- telephone ;
- identifiant de compte ;
- adresse IP ;
- voix ou enregistrement sonore ;
- contenu de mail permettant d'identifier une personne ;
- jeton ou identifiant rattache a une personne.

Le traitement est entendu largement :
- collecte ;
- enregistrement ;
- conservation ;
- consultation ;
- modification ;
- extraction ;
- transmission ;
- suppression.

Donc une application locale peut traiter des donnees personnelles si elle manipule des comptes, adresses mail, contenus de mails, dictées ou jetons OAuth.

## 3. Cas ou le RGPD peut ne pas s'appliquer

Le RGPD ne s'applique pas au traitement realise par une personne physique dans le cadre d'une activite strictement personnelle ou domestique.

Exemple probablement hors RGPD :
- une personne utilise l'application seule, chez elle, uniquement pour sa propre boite mail personnelle, sans usage associatif, professionnel ou service rendu a des tiers.

Point de prudence :
- meme dans ce cas, il reste recommande de proteger les donnees : mot de passe, sauvegarde, chiffrement, limitation des logs, suppression des fichiers temporaires.

## 4. Cas ou il faut appliquer une demarche RGPD

Une demarche RGPD devient necessaire si :
- l'application est utilisee par une association ;
- l'application est utilisee par une entreprise ;
- plusieurs utilisateurs ont des comptes ;
- l'application gere des boites mail de tiers ;
- l'application traite des demandes de compte ;
- l'application traite des donnees de personnes accompagnees ou vulnerables ;
- des API externes recoivent du contenu de mail ou de l'audio ;
- l'application est hebergee sur un serveur ;
- un administrateur gere des droits, des comptes, des statistiques ou des traces.

Dans ce cas, le caractere local ne suffit pas a exclure le RGPD.

## 5. Donnees traitees par l'application

### Donnees a conserver en base

La base peut conserver :
- comptes utilisateurs et administrateurs ;
- e-mails et identifiants de compte ;
- hash de mot de passe ;
- sessions ;
- jetons de reinitialisation de mot de passe ;
- connexions OAuth Gmail ;
- jetons OAuth d'acces et de rafraichissement ;
- preferences utilisateur ;
- reglages audio et LLM ;
- regles de traitement ;
- actions realisees sur messages ;
- identifiants techniques Gmail ;
- brouillons ou corps de reponse necessaires a l'action ;
- traces d'usage fournisseur ;
- cles API chiffrees ou masquees ;
- eventuels elements de facturation.

### Donnees a eviter de conserver par defaut

Ne pas conserver durablement par defaut :
- copie complete des boites mail ;
- contenu complet de tous les mails ;
- pieces jointes completes ;
- audio brut ;
- transcriptions longues ;
- prompts LLM complets contenant le mail ;
- secrets en clair.

Orientation retenue :
- les mails restent geres dans chaque boite mail individuelle ;
- l'application agit comme assistant ;
- la base conserve seulement ce qui est necessaire au fonctionnement.

## 6. Registre RGPD minimal

Si l'application est utilisee hors usage strictement personnel, creer un registre minimal des traitements.

Fiche 1 - Gestion des comptes :
- finalite : creer, gerer et securiser les comptes ;
- donnees : nom, prenom, e-mail, role, hash de mot de passe, sessions ;
- base juridique a choisir selon contexte : contrat, interet legitime, obligation ou consentement selon l'organisation ;
- conservation : duree du compte puis suppression ou archivage limite ;
- destinataires : administrateurs autorises ;
- securite : hash mot de passe, sessions expirees, droits admin limites.

Fiche 2 - Assistance mail :
- finalite : aider a lire, analyser, rediger et modifier des mails ;
- donnees : adresse mail, identifiants techniques Gmail, sujet, expediteur, brouillon ou reponse si necessaire ;
- conservation : limiter aux actions necessaires, pas d'archivage complet des mails ;
- destinataires : utilisateur concerne, administrateurs techniques strictement si necessaire ;
- securite : acces par compte, logs limites, suppression des temporaires.

Fiche 3 - Dictée et commandes vocales :
- finalite : convertir la voix en texte et permettre l'edition vocale ;
- donnees : audio temporaire, transcription, commandes vocales ;
- conservation : pas de conservation durable de l'audio brut par defaut ;
- destinataires : fournisseur STT si API externe utilisee ;
- securite : information utilisateur, purge, limitation des logs.

Fiche 4 - Fournisseurs IA/API :
- finalite : generer, reformuler, classifier ou interpreter une commande ;
- donnees : prompts, extraits de mail, commandes, pieces jointes si activees ;
- conservation : ne pas journaliser le contenu complet par defaut ;
- destinataires : fournisseur API si modele distant utilise ;
- securite : cles API protegees, choix local/API visible, minimisation du contexte transmis.

Fiche 5 - Administration et traces :
- finalite : securite, support, pilotage et couts ;
- donnees : actions admin, etats, erreurs techniques, usage fournisseur ;
- conservation : duree limitee ;
- destinataires : administrateurs autorises ;
- securite : pas de contenu de mail dans les logs par defaut.

## 7. Mesures techniques a integrer

### Minimisation

Regle :
- ne transmettre au LLM ou au STT que ce qui est necessaire.

Application :
- pour l'edition vocale, envoyer seulement commande + contexte local utile ;
- ne pas envoyer toute la boite mail ;
- ne pas stocker les mails complets ;
- ne pas stocker l'audio brut.

### Transparence utilisateur

Ajouter dans l'application ou la documentation :
- quel LLM est utilise ;
- local ou API distante ;
- quel STT est utilise ;
- local ou API distante ;
- quelles donnees sont envoyees ;
- ce qui est conserve ;
- comment supprimer les donnees.

### Securite

Prevoir :
- secrets forts ;
- `.env` non versionne ;
- jetons OAuth proteges ;
- logs sans contenu sensible ;
- sauvegardes chiffrees si donnees personnelles ;
- acces admin limites ;
- HTTPS si acces reseau autre que local strict ;
- verrouillage du poste ou du DGX Spark.

### Droit des personnes

Prevoir une procedure simple pour :
- consulter les donnees d'un compte ;
- corriger un compte ;
- supprimer un compte ;
- supprimer une connexion Gmail ;
- supprimer preferences et traces associees ;
- exporter les informations utiles si necessaire.

### Conservation

Proposition par defaut :
- audio brut : non conserve ;
- transcriptions temporaires : non conservees durablement sauf action explicite ;
- mails complets : non conserves ;
- actions mail : conservation limitee a definir ;
- sessions : expiration automatique ;
- jetons de reinitialisation : expiration courte ;
- logs techniques : retention courte ;
- comptes : duree du compte puis suppression ou archivage minimal.

## 8. Cas DGX Spark local

Le DGX Spark local reduit :
- dependance hebergeur ;
- transfert de donnees vers un cloud ;
- latence IA ;
- risque lie a une base distante.

Mais il ne supprime pas automatiquement :
- la presence de donnees personnelles ;
- le besoin de securiser les acces ;
- le besoin de proteger les jetons OAuth ;
- le besoin d'informer les utilisateurs si plusieurs personnes utilisent l'application ;
- le besoin d'encadrer les API externes si elles restent utilisees.

Recommandation :
- traiter DGX Spark comme serveur local prive ;
- ne pas l'exposer sur Internet au depart ;
- utiliser LLM local autant que possible pour les contenus sensibles ;
- conserver les API STT/LLM externes seulement si l'utilisateur est informe et si la finalite est claire ;
- sauvegarder la base si l'usage devient durable.

## 9. Integration dans la feuille de route

### V1 integree le 2026-04-07

Elements ajoutes dans l'application :
- page `frontend/privacy.html` ;
- entree `RGPD` dans la navigation laterale ;
- script frontend `frontend/js/privacy.js` ;
- endpoint backend `GET /api/account/privacy-export` ;
- export JSON des donnees du compte connecte ;
- exclusion des secrets en clair dans l'export ;
- exclusion des jetons OAuth en clair dans l'export ;
- rappel explicite que les mails complets et l'audio brut ne sont pas inclus par defaut.

Limites volontaires de la V1 :
- pas de suppression automatique destructrice ;
- pas encore de workflow de demande de suppression ;
- pas encore de registre administrateur edite depuis l'interface ;
- pas encore de gestion fine des durees de conservation ;
- pas encore d'ecran de consentement selon fournisseur IA/STT ;
- pas encore d'export complet administrateur multi-comptes.

Prochaine etape recommandee :
- ajouter une demande de suppression/rectification guidee ;
- ajouter une page administrateur de suivi RGPD ;
- formaliser les durees de conservation ;
- afficher clairement le fournisseur IA/STT utilise et le caractere local ou API externe.

### Phase 1 - Local personnel

Actions suffisantes :
- minimisation ;
- pas de stockage mails complets ;
- pas de stockage audio brut ;
- secrets dans `.env` ;
- logs limites ;
- sauvegarde locale prudente.

### Phase 2 - Local multi-utilisateur ou associatif

Ajouter :
- registre minimal ;
- notice d'information utilisateur ;
- procedures suppression/export ;
- separation stricte des comptes ;
- politique de conservation ;
- verification des fournisseurs API ;
- sauvegardes chiffrees.

### Phase 3 - Serveur ou DGX accessible a plusieurs utilisateurs

Ajouter :
- PostgreSQL si multi-utilisateur reel ;
- HTTPS ;
- durcissement sessions/cookies ;
- journalisation d'administration ;
- sauvegardes automatiques ;
- restauration testee ;
- analyse des risques ;
- documentation incident ;
- contrats ou conditions fournisseurs API ;
- decision formelle responsable de traitement / sous-traitant.

## 10. Checklist avant ouverture a d'autres utilisateurs

- [ ] Identifier le responsable de traitement.
- [ ] Identifier si l'application agit aussi comme sous-traitant.
- [ ] Lister les traitements dans un registre minimal.
- [ ] Confirmer que les mails complets ne sont pas conserves.
- [ ] Confirmer que l'audio brut n'est pas conserve.
- [ ] Documenter les API externes utilisees.
- [ ] Documenter les donnees envoyees aux LLM/STT.
- [ ] Limiter les logs.
- [ ] Definir les durees de conservation.
- [ ] Prevoir suppression/export compte.
- [ ] Proteger `.env` et secrets.
- [ ] Proteger les jetons OAuth.
- [ ] Chiffrer les sauvegardes si elles contiennent des donnees personnelles.
- [ ] Tester la restauration.
- [ ] Informer les utilisateurs.
- [ ] Valider HTTPS si acces reseau ou serveur.

## 11. Conclusion

Pour un usage strictement personnel local, la charge RGPD peut etre tres reduite.

Pour un usage associatif, professionnel, multi-utilisateur, DGX partage ou serveur, il faut integrer une demarche RGPD, meme si l'application reste hebergee localement.

La bonne approche pour ce projet :
- ne pas conserver les mails complets ;
- ne pas conserver l'audio brut ;
- limiter les prompts transmis ;
- preferer l'IA locale pour les contenus sensibles ;
- documenter clairement API externe ou local ;
- ajouter un registre minimal et une notice utilisateur avant tout usage a plusieurs personnes.
