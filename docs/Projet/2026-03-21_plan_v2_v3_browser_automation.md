# Plan V2 V3 - automatisation navigateur

Date : 2026-03-21

## 1. Objet

Ce document fixe la base technique de la suite du produit a partir de la V1 validee.

La V2 et la V3 conservent les principes deja retenus :
- l'utilisateur reste protege ;
- la priorite des mails reste calculee sans IA ;
- les pieces jointes sont traitees par l'application avant l'IA autant que possible ;
- la validation humaine reste centrale tant que le risque d'action sensible est present.

## 2. Cap cible

Le produit doit pouvoir automatiser une partie des gestes navigateur pour reduire la fatigue :
- ouverture du webmail ;
- navigation dans l'inbox ;
- ouverture du bon message ;
- scroll ;
- clic ;
- repositionnement dans la page ;
- injection d'un brouillon valide.

## 3. Ce qui est mis en place dans la base V2

Une premiere couche backend est ajoutee :
- `automation_policies` :
  politique d'automatisation par connexion de boite mail ;
- `browser_use_sessions` :
  trace de chaque session d'automatisation navigateur ;
- `browserAutomationService` :
  orchestration produit independante du moteur navigateur reel ;
- routes `/api/browser-automation/*` :
  lecture et mise a jour de politique, creation de session, historique des sessions.

Cette couche ne depend pas encore d'un SDK Browser Use.
Elle prepare un branchement propre pour plus tard.

## 4. Positionnement V2

La V2 correspond a un produit semi-automatise.

Caracteristiques :
- l'automatisation navigateur peut etre activee pour certaines boites ;
- la navigation et la collecte de contexte peuvent etre automatisees ;
- l'ouverture du message et la preparation de la reponse peuvent etre assistees ;
- l'envoi automatique reste desactive par defaut ;
- la validation humaine reste obligatoire.

## 5. Positionnement V3

La V3 correspond a une automatisation avancee sous garde-fous.

Caracteristiques :
- orchestration plus poussee du navigateur ;
- execution de sequences plus longues ;
- eventuelle injection du brouillon dans le webmail ;
- envoi conditionnel seulement si la politique le permet ;
- journalisation complete et controle strict des droits.

## 6. API ajoutee

### Lire ou creer la politique d'automatisation

`GET /api/browser-automation/policy?connectionId=...`

### Mettre a jour la politique d'automatisation

`POST /api/browser-automation/policy`

Exemple :

```json
{
  "connectionId": "mbxc-123",
  "browserEnabled": true,
  "automationLevel": "semi_automated",
  "navigationEnabled": true,
  "messageOpenEnabled": true,
  "contextCollectionEnabled": true,
  "draftInjectionEnabled": true,
  "sendEnabled": false,
  "humanValidationRequired": true,
  "allowedActions": ["open_inbox", "open_message", "prepare_reply", "inject_reply"]
}
```

### Creer une session d'automatisation navigateur

`POST /api/browser-automation/session/start`

Exemple :

```json
{
  "connectionId": "mbxc-123",
  "objective": "prepare_reply",
  "messageId": "gmail-message-id"
}
```

### Lister les sessions

`GET /api/browser-automation/sessions?connectionId=...&limit=10`

## 7. Objet des sessions V2

Une session cree :
- une politique appliquee ;
- un plan d'execution navigateur ;
- un statut ;
- des metadonnees utiles a l'audit.

Le plan ne pilote pas encore un navigateur reel.
Il decrit ce que le moteur navigateur devra faire.

## 8. Branchement futur Browser Use

Le branchement du moteur reel devra se faire dans une couche adaptateur dediee.

Principe recommande :
- garder `browserAutomationService` comme orchestrateur produit ;
- ajouter un adaptateur `browserUseAdapter` charge d'executer les pas ;
- conserver les garde-fous dans l'application et non dans le moteur externe seul.

## 9. Garde-fous obligatoires

Pour la suite :
- aucune action navigateur sans droits explicites ;
- aucune activation navigateur pour les comptes `base` ;
- aucun envoi auto par defaut ;
- validation humaine obligatoire en V2 ;
- traces obligatoires pour chaque session.

## 10. Etapes recommandees ensuite

1. Ajouter une interface admin ou parametres pour piloter la politique par boite.
2. Ajouter un adaptateur Browser Use reel avec mode simulation.
3. Faire executer les plans `open_inbox`, `open_message`, puis `prepare_reply`.
4. Ajouter des tests de non-regression sur les garde-fous.
5. Ouvrir ensuite seulement les fonctions V3 plus poussees.
