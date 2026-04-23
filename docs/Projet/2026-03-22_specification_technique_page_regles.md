# Specification technique - page Règles

Date : 2026-03-22

## 1. Objet

Ce document décrit l'implémentation technique recommandée de la future page `Règles`.

## 2. Objectif technique

Transformer la page `frontend/rules.html` en page fonctionnelle de gestion des règles métier.

## 3. Fichiers concernés

Frontend :
- `frontend/rules.html`
- nouveau fichier `frontend/js/rules.js`

Backend :
- nouveau service de stockage des règles
- nouveaux endpoints API dédiés
- intégration du chargement des règles dans la génération de réponse

Base de données :
- nouvelle table ou nouveau stockage structuré pour les règles

## 4. Option de stockage recommandée

Recommandation :
- utiliser SQLite, comme le reste du backend.

Nouvelle table recommandée :
- `mail_rules`

## 5. Structure minimale recommandée pour `mail_rules`

Champs recommandés :
- `id`
- `created_at`
- `updated_at`
- `created_by`
- `updated_by`
- `status`
- `rule_type`
- `scope_type`
- `scope_value`
- `theme`
- `title`
- `content`
- `missing_info_action`
- `priority_rank`
- `metadata_json`

## 6. Valeurs techniques recommandées

### `status`

- `active`
- `inactive`

### `rule_type`

- `content`
- `prudence`
- `validation`
- `missing_info`
- `source_access`

### `scope_type`

- `global`
- `mailbox`
- `category`
- `workflow`

## 7. API recommandée

### Lire les règles

`GET /api/rules`

### Créer une règle

`POST /api/rules`

### Modifier une règle

`POST /api/rules/update`

### Activer / désactiver une règle

`POST /api/rules/status`

## 8. Réponse API minimale

Chaque règle renvoyée doit contenir au minimum :
- identifiant ;
- type ;
- portée ;
- thème ;
- titre ;
- contenu ;
- statut ;
- date de mise à jour.

## 9. Intégration frontend recommandée

### `rules.html`

La page doit comporter :
- une liste de règles ;
- un formulaire de création / édition ;
- une zone d'aide métier.

### `rules.js`

Responsabilités :
- charger les règles ;
- afficher la liste ;
- gérer le formulaire ;
- envoyer les créations et mises à jour ;
- refléter les statuts.

## 10. Intégration backend recommandée

Le backend doit :
- lire les règles actives ;
- filtrer selon la portée utile ;
- les injecter dans le contexte de génération.

## 11. Intégration dans la génération de réponse

Lors de `reply-draft` et plus tard `create-draft`, le backend doit :
- charger les règles actives pertinentes ;
- les ajouter explicitement au prompt ;
- conserver leur résumé dans la trace IA si utile.

## 12. Fonction technique recommandée

Créer une fonction dédiée du type :

```javascript
getApplicableRules({
  mailboxId,
  category,
  workflow
})
```

Elle devra renvoyer :
- les règles globales actives ;
- les règles spécifiques applicables ;
- triées dans un ordre stable.

## 13. Priorité d'implémentation

### Version 1

- règles textuelles uniquement ;
- pas de source externe exécutée automatiquement ;
- pas de logique complexe de droits par règle.

### Version 2

- meilleure portée ;
- meilleur filtrage ;
- meilleure intégration dans la complétude du contexte.

### Version 3

- prise en charge des règles d'accès à source ;
- coordination avec Browser Use ou autres mécanismes d'accès.

## 14. Critères techniques d'acceptation

La page `Règles` est techniquement prête si :
- les règles sont stockées proprement ;
- les règles peuvent être créées et modifiées ;
- les règles actives sont récupérées par API ;
- le backend peut les charger avant génération ;
- elles peuvent être intégrées à la réponse IA.

## 15. Conclusion

La page `Règles` doit être conçue dès le départ comme :
- une base métier exploitable ;
- une source de contexte ;
- une future passerelle vers des sources complémentaires plus riches.
