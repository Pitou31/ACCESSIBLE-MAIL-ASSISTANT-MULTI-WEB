# Contrôle de complétude du contexte avant réponse IA

Date : 2026-03-22

## 1. Objet

Ce document formalise un principe produit qui doit être mis en place avant l'automatisation navigateur avancée :
- l'IA ne doit pas répondre immédiatement ;
- elle doit d'abord évaluer si le contexte disponible est suffisant.

## 2. Pourquoi ce principe est nécessaire

Dans l'état actuel, la logique de génération part du principe suivant :
- un mail est reçu ;
- l'IA génère une réponse.

Cette logique devient insuffisante dès qu'une réponse correcte dépend d'informations complémentaires, par exemple :
- disponibilités de calendrier ;
- règles métier internes ;
- contenu d'un fichier ;
- information issue d'un site web ;
- donnée d'un dossier autorisé ;
- consigne spécifique d'un utilisateur ou d'une boîte mail.

## 3. Nouveau principe produit

Toute réponse IA doit commencer par une étape obligatoire :
- contrôle de suffisance du contexte.

Autrement dit, l'IA doit d'abord déterminer :
- si les informations disponibles suffisent ;
- si les règles fournies complètent utilement le mail ;
- s'il manque une source complémentaire ;
- si elle peut répondre complètement, prudemment, ou si elle doit demander plus d'informations.

## 4. Sources de contexte à considérer

Les sources autorisées doivent être hiérarchisées.

### Niveau 1 - Contexte déjà transmis

- contenu du mail reçu ;
- pièces jointes déjà traitées par l'application ;
- règles métier textuelles ;
- consignes de boîte mail ;
- paramètres applicatifs transmis au prompt.

### Niveau 2 - Contexte complémentaire explicitement autorisé

Plus tard, le système pourra aussi exploiter :
- calendrier ;
- fichiers ;
- sites web autorisés ;
- autres systèmes externes explicitement approuvés.

## 5. Résultats possibles de l'étape de contrôle

Après contrôle, le système doit pouvoir classer la situation dans l'un des cas suivants :

### Cas A - Contexte suffisant

La réponse complète peut être générée.

### Cas B - Contexte insuffisant mais réponse prudente possible

Une réponse d'attente ou de vérification peut être générée.

Exemple :
- "Je vous remercie pour votre message. Je vérifie ce point et reviens vers vous rapidement."

### Cas C - Contexte insuffisant et information manquante identifiée

Le système doit :
- signaler les informations manquantes ;
- demander un complément ;
- ou déclencher une recherche complémentaire autorisée plus tard.

## 6. Interdictions

L'IA ne doit jamais :
- inventer une disponibilité ;
- inventer une règle ;
- inventer une information externe ;
- supposer un contenu non fourni ;
- simuler une confirmation de rendez-vous sans source suffisante.

## 7. Rôle central des règles

Les règles doivent devenir une source métier systématique.

L'IA doit être informée qu'elle doit s'appuyer sur :
- le mail reçu ;
- les pièces jointes ;
- les règles.

Les règles ne doivent donc plus être considérées comme un supplément optionnel.
Elles deviennent une source obligatoire de contexte.

## 8. Première mise en œuvre recommandée

Avant d'ouvrir les accès automatiques à des sources externes, il faut commencer par une mise en œuvre textuelle.

### Étape 1

Créer une vraie page `Règles` permettant de saisir :
- des consignes générales ;
- des règles de réponse ;
- des règles de prudence ;
- des règles métier par thème ;
- des instructions d'escalade quand il manque une information.

### Étape 2

Modifier le prompt de réponse pour imposer :
- la consultation des règles ;
- le contrôle de complétude ;
- l'interdiction d'inventer.

Le prompt doit aussi imposer explicitement la séquence suivante :
- analyser d'abord si la demande est claire ;
- analyser ensuite si les informations disponibles suffisent réellement ;
- si ce n'est pas le cas, consulter les règles métier transmises ;
- si les règles ne suffisent toujours pas, produire une réponse prudente ou demander un complément ;
- signaler implicitement dans la réponse qu'une vérification reste nécessaire, sans inventer.

### Étape 3

Faire produire à l'IA non seulement une réponse, mais aussi un diagnostic du contexte.

## 9. Sortie structurée recommandée

À terme, la génération de réponse devrait produire au minimum :
- `context_sufficient` ;
- `missing_information` ;
- `recommended_action` ;
- `draft_response`.

Exemple conceptuel :

```json
{
  "context_sufficient": false,
  "missing_information": [
    "disponibilités calendrier pour le 4 avril à 14h"
  ],
  "recommended_action": "generate_cautious_reply",
  "draft_response": "Merci pour votre proposition. Je dois d'abord vérifier mes disponibilités avant de vous confirmer ce créneau."
}
```

## 10. Évolution future vers des sources externes

Plus tard, une règle pourra ne plus seulement contenir une donnée textuelle, mais une instruction d'accès.

Exemple futur :
- au lieu d'écrire les disponibilités directement ;
- définir une règle indiquant qu'il faut consulter une source calendrier autorisée.

Dans ce cas, la règle ne fournit plus la donnée finale.
Elle fournit :
- un droit ;
- une méthode ;
- un chemin ou un mode d'accès ;
- un cadre d'utilisation.

Cette évolution doit rester guidée par un principe simple :
- les règles textuelles initiales servent à couvrir les cas généraux et répétitifs ;
- les cas particuliers, non représentatifs ou non répétitifs ne doivent pas alourdir inutilement le référentiel ;
- quand un besoin récurrent dépend d'une donnée mouvante, il est préférable à terme de transformer la règle en règle d'accès à une source autorisée.

## 11. Conséquence architecturale

Il faut distinguer deux types de règles :

### Règles de contenu

Elles donnent une information directement exploitable.

Exemple :
- "Le mardi matin n'est jamais disponible."

### Règles d'accès

Elles autorisent ou demandent la consultation d'une autre source.

Exemple :
- "Pour toute proposition de rendez-vous, consulter le calendrier autorisé avant réponse définitive."

## 12. Conclusion

Le bon ordre de travail est donc :
1. mettre en place le contrôle de complétude du contexte ;
2. rendre la page `Règles` réellement exploitable ;
3. enrichir les prompts avec ce garde-fou ;
4. seulement ensuite ouvrir progressivement l'accès automatisé à des sources externes.

Principe complémentaire retenu :
- l'IA doit être utilisée pour interpréter la teneur du mail et déterminer si les règles doivent être mobilisées ;
- l'administrateur fournit au départ un corpus limité de règles générales adaptées au type d'application ;
- ce corpus s'enrichit ensuite par l'exploitation réelle et les retours utilisateurs ;
- la priorité doit toujours être donnée aux cas généraux, fréquents et structurants.
