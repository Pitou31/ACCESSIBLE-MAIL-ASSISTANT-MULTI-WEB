# Specification frontend Sprint 1 - fournisseurs API, preferences et couts utilisateur

Date : 2026-03-23

## 1. Objet

Ce document fixe la specification frontend du Sprint 1 pour :

- permettre a l'utilisateur de configurer ses fournisseurs API ;
- choisir son fournisseur par defaut pour la dictée et, plus tard, pour l'IA ;
- synchroniser les preferences importantes avec le backend ;
- afficher les premiers elements de consommation et de cout.

Le Sprint 1 frontend doit rester compatible avec l'existant :

- mode mono-utilisateur ;
- Paramètres principalement locaux ;
- dictée deja fonctionnelle dans la page mails.

## 2. Pages concernees

Pages impactees en priorite :

- `settings.html`
- `mail.html`
- `account.html`

Scripts impactes :

- [settings.js](/Users/jacquessoule/Documents/SPARK/IA-Agent-Universel-Dev/accessible-mail-assistant-vnext/frontend/js/settings.js)
- [audioInput.js](/Users/jacquessoule/Documents/SPARK/IA-Agent-Universel-Dev/accessible-mail-assistant-vnext/frontend/js/audioInput.js)
- [liveSpeechClient.js](/Users/jacquessoule/Documents/SPARK/IA-Agent-Universel-Dev/accessible-mail-assistant-vnext/frontend/js/liveSpeechClient.js)
- [mail.js](/Users/jacquessoule/Documents/SPARK/IA-Agent-Universel-Dev/accessible-mail-assistant-vnext/frontend/js/mail.js)
- [account.js](/Users/jacquessoule/Documents/SPARK/IA-Agent-Universel-Dev/accessible-mail-assistant-vnext/frontend/js/account.js)

## 3. Principes UX

## 3.1 Simplicite par defaut

Pour un utilisateur simple, l'interface ne doit pas devenir inutilement complexe.

Le comportement cible est :

- si aucun fournisseur personnel n'est configure :
  - l'application continue a fonctionner comme aujourd'hui selon la configuration disponible ;
- si un ou plusieurs fournisseurs personnels sont configures :
  - l'utilisateur peut choisir celui qu'il prefere ;
- si les couts ne sont pas encore disponibles :
  - l'interface le dit clairement sans bloquer le reste.

## 3.2 Transparence

L'utilisateur doit pouvoir savoir :

- quel fournisseur il utilise ;
- si ce fournisseur est personnel ou mutualise ;
- si sa cle est valide ;
- quel cout estime il genere.

## 3.3 Progressivite

Le Sprint 1 ne doit pas afficher toute la complexite future.

Il doit exposer seulement :

- la configuration de fournisseur ;
- le choix du fournisseur prefere ;
- le test de validite ;
- le premier resume de consommation.

## 4. Evolution de `settings.html`

## 4.1 Section nouvelle `Fournisseurs API`

Cette nouvelle section doit etre ajoutee dans la page Paramètres.

Contenu recommande :

- bloc `Dictée vocale`
- bloc `IA texte`
- bloc `Consommation`

## 4.2 Bloc `Dictée vocale`

Ce bloc doit permettre :

- de voir les fournisseurs audio disponibles :
  - `Deepgram`
  - `AssemblyAI`
  - `Local dégradé`
- de configurer une cle personnelle pour `Deepgram`
- de configurer une cle personnelle pour `AssemblyAI`
- de choisir le fournisseur prefere de dictée
- de tester chaque fournisseur

Elements UI recommandes pour chaque fournisseur payant :

- label fournisseur
- champ de cle API masque
- bouton `Tester`
- bouton `Enregistrer`
- indicateur d'etat :
  - `non configuré`
  - `valide`
  - `invalide`
- indicateur `Par défaut`

## 4.3 Bloc `IA texte`

Ce bloc doit preparer l'integration de `DeepSeek API`.

Premiere version recommandee :

- afficher `DeepSeek API`
- champ de cle masque
- bouton `Tester`
- bouton `Enregistrer`
- choix :
  - `Utiliser DeepSeek API comme fournisseur texte préféré`

Le bloc doit rester simple et ne pas encore afficher toute la granularite des modeles.

## 4.4 Bloc `Consommation`

Ce bloc doit afficher un resume lisible :

- cout estime du mois
- nombre d'usages audio
- nombre d'usages IA texte
- repartition par fournisseur

Affichage minimal recommande :

- `Total estimé ce mois`
- `Deepgram`
- `AssemblyAI`
- `DeepSeek API`

Si aucune donnee n'existe :

- afficher `Aucune consommation enregistrée pour le moment.`

## 5. Evolution de `settings.js`

## 5.1 Objectif

Faire passer `settings.js` d'une logique purement locale a une logique hybride :

- cache local pour le confort ;
- source de verite serveur pour les preferences critiques.

## 5.2 Nouvelles responsabilites

`settings.js` devra :

- charger les preferences serveur a l'ouverture si l'utilisateur est connecte ;
- fusionner avec les valeurs locales si necessaire ;
- charger la liste des fournisseurs configures ;
- afficher leur etat ;
- enregistrer les modifications de preferences ;
- tester une cle API ;
- afficher le resume de consommation.

## 5.3 Nouvelles fonctions recommandees

- `loadServerPreferences()`
- `saveServerPreferences(partialSettings)`
- `loadProviderAccounts()`
- `renderProviderAccounts(providers)`
- `saveProviderAccount(providerType, payload)`
- `testProviderAccount(providerId)`
- `loadUsageSummary()`
- `renderUsageSummary(summary)`

## 5.4 Regles de synchronisation

Priorite de lecture recommandee :

1. preferences serveur si l'utilisateur est connecte
2. sinon `localStorage`
3. sinon valeurs par defaut

Priorite d'ecriture recommandee :

1. serveur si l'utilisateur est connecte
2. mise a jour locale en cache

## 5.5 Compatibilite

Si le backend preferences n'est pas encore disponible :

- `settings.js` doit continuer a fonctionner avec `localStorage`
- sans casser la page Paramètres

## 6. Evolution de `audioInput.js`

## 6.1 Objectif

Ne plus dependre seulement de la preference locale du navigateur.

Le module doit tenir compte :

- du fournisseur choisi dans les preferences serveur ;
- du fournisseur reellement disponible ;
- du statut de configuration utilisateur.

## 6.2 Comportement cible

Quand l'utilisateur clique `Dicter` :

1. lire la preference de dictée active ;
2. verifier qu'un fournisseur reel est resolvable ;
3. demarrer la session ;
4. afficher dans le statut :
   - le fournisseur utilise ;
   - l'etat en cours ;
5. en fin de session, afficher si possible :
   - le fournisseur utilise ;
   - un cout estime simple.

## 6.3 Messages utilisateur recommandes

Exemples :

- `Dictée en cours avec Deepgram.`
- `Dictée en cours avec AssemblyAI.`
- `Deepgram sélectionné, mais aucune clé personnelle valide n'est configurée.`
- `AssemblyAI sélectionné, utilisation impossible tant que la clé n'est pas enregistrée.`

## 6.4 Fallback

Le fallback local ne doit pas etre implicite si l'utilisateur a explicitement choisi un fournisseur payant.

Regle recommandee :

- si l'utilisateur choisit `Deepgram` ou `AssemblyAI` et qu'il n'est pas disponible :
  - afficher une erreur claire ;
  - ne pas basculer silencieusement sur `local`

Le fallback local doit etre un choix explicite ou une preference autorisee.

## 7. Evolution de `mail.html` et `mail.js`

## 7.1 Objectif

Informer l'utilisateur du fournisseur reellement utilise dans les zones de dictée.

## 7.2 Affichages a ajouter

Dans chaque zone de dictée editable :

- rappeler le moteur actif
- afficher un statut plus explicite

Exemples :

- `Moteur de dictée : Deepgram`
- `Moteur de dictée : AssemblyAI`
- `Mode local dégradé`

## 7.3 Cout

Le Sprint 1 ne doit pas encombrer la page mail avec une comptabilite lourde.

Option recommandee :

- afficher seulement un message de fin de session du type :
  - `Dictée terminée avec Deepgram.`
  - plus tard :
  - `Coût estimé : 0,01 €`

L'affichage detaille des couts doit rester dans `Paramètres`.

## 8. Evolution de `account.html` et `account.js`

## 8.1 Objectif

Donner une vue simple du statut de configuration utilisateur.

## 8.2 Bloc a ajouter

Ajouter un resume simple de configuration :

- `Fournisseurs configurés`
- `Fournisseur dictée par défaut`
- `Fournisseur IA texte par défaut`

Ce bloc est informatif.
La vraie configuration reste dans `Paramètres`.

## 9. Etats UI a gerer

## 9.1 Etat fournisseur

Pour chaque fournisseur :

- `non_configure`
- `test_en_cours`
- `valide`
- `invalide`
- `desactive`

## 9.2 Etat usage

Pour la consommation :

- `non_charge`
- `chargement`
- `vide`
- `disponible`
- `erreur`

## 10. Endpoints frontend a consommer

Le frontend devra consommer :

- `GET /api/account/preferences`
- `PUT /api/account/preferences`
- `GET /api/account/providers`
- `POST /api/account/providers`
- `PUT /api/account/providers/:id`
- `POST /api/account/providers/:id/test`
- `DELETE /api/account/providers/:id`
- `GET /api/account/usage-summary`

## 11. Donnees minimales a persister cote serveur

## 11.1 Preferences audio

- `audioInputEnabled`
- `audioInputProvider`
- `audioInputDeviceId`
- `allowLocalFallback`

## 11.2 Preferences IA

- `preferredLlmProvider`
- `model`
- `assistanceLevel`

## 11.3 Preferences mail

- `defaultMode`
- `defaultTone`
- `defaultLength`
- `generationMode`

## 12. Tests frontend a prevoir

## 12.1 Paramètres

- affichage de la nouvelle section fournisseurs
- sauvegarde d'une cle `Deepgram`
- sauvegarde d'une cle `AssemblyAI`
- sauvegarde d'une cle `DeepSeek API`
- choix du fournisseur de dictée
- test du fournisseur

## 12.2 Dictée

- message correct quand `Deepgram` est choisi
- message correct quand `AssemblyAI` est choisi
- erreur claire si le fournisseur choisi n'est pas disponible
- pas de fallback silencieux

## 12.3 Resume de cout

- affichage vide quand aucun usage n'existe
- affichage des donnees quand le backend retourne un resume

## 13. Ordre exact d'implementation frontend

1. `settings.html`
   - ajouter la section `Fournisseurs API`

2. `settings.js`
   - chargement preferences serveur
   - CRUD fournisseurs
   - test fournisseurs
   - lecture usage summary

3. `audioInput.js`
   - affichage fournisseur reel
   - gestion des erreurs sans fallback silencieux

4. `mail.js`
   - affichage du moteur actif dans les zones de dictée

5. `account.js`
   - bloc resume de configuration

## 14. Conclusion

Le Sprint 1 frontend doit fournir une experience simple :

- l'utilisateur configure ses fournisseurs ;
- il choisit celui qu'il veut utiliser ;
- il sait si cela fonctionne ;
- il voit ses premiers couts ;
- et il garde une interface lisible.

La complexite multi-utilisateurs avancee et le partage de boites viendront ensuite, sans obliger a refaire cette couche frontend.
