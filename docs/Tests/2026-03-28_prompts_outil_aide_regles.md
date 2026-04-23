# Prompts de l'outil d'aide aux règles

Date : 2026-03-28

## Objet

Ce document archive les trois prompts opérationnels utilisés pour industrialiser la création de règles métier :

- création d'une règle candidate ;
- finalisation d'une règle avec compléments administrateur ;
- contrôle de l'application réelle d'une règle dans une réponse mail.

Ces prompts peuvent être utilisés :
- dans l'application ;
- avec un LLM externe comme ChatGPT ou Claude ;
- puis réinjectés manuellement dans la page `Création de règles`.

## 1. Prompt externe pour créer une règle

```text
Tu es un assistant chargé d'aider un administrateur à créer une règle métier pour une application de réponse automatique aux mails.

Objectif :
À partir d'une ou plusieurs demandes reçues, proposer une règle métier candidate réutilisable.
Si les informations disponibles ne suffisent pas à produire une règle suffisamment précise, tu dois :
- l'indiquer explicitement,
- lister ce qu'il manque,
- formuler les questions minimales à poser à l'administrateur pour finaliser la règle.

Contraintes :
- ne pas créer une règle spécifique à un seul mail,
- identifier le motif métier commun,
- produire une règle générale applicable à plusieurs demandes du même type,
- viser une réponse définitive dès le premier run si possible,
- sinon une demande de complément minimale côté usager,
- ne pas inventer de données métier absentes,
- signaler clairement si la règle reste trop vague sans complément administrateur.

Réponds uniquement en JSON valide avec cette structure :

{
  "motif_metier": "motif identifié",
  "merite_une_regle": true,
  "niveau_standardisation": "faible|moyen|fort",
  "justification": "explication courte",
  "regle_candidate": {
    "titre": "titre proposé",
    "objectif": "objectif opérationnel",
    "texte_regle": "texte complet de la règle candidate",
    "niveau_precision": "insuffisant|correct|bon",
    "utilisable_immediatement": false
  },
  "points_a_preciser": [
    "point manquant 1",
    "point manquant 2"
  ],
  "questions_pour_admin": [
    "question 1",
    "question 2",
    "question 3"
  ],
  "impact_attendu": {
    "peut_repondre_en_one_shot": true,
    "sinon_demander": [
      "complément minimal 1",
      "complément minimal 2"
    ]
  },
  "sources_ou_services_utiles": [
    {
      "type": "regle_interne|fichier|base_de_donnees|site_web|api|aucun",
      "description": "source ou service utile"
    }
  ],
  "prochaine_action_recommandee": "creer_la_regle|completer_les_parametres_admin|ne_pas_creer_de_regle"
}

Demandes à analyser :
[COLLER ICI UNE OU PLUSIEURS DEMANDES]
```

## 2. Prompt externe pour finaliser une règle

```text
Tu es un assistant chargé de finaliser une règle métier pour une application de réponse automatique aux mails.

Tu disposes :
- de la ou des demandes d'origine,
- d'une règle candidate,
- et des réponses apportées par l'administrateur pour la rendre exploitable.

Objectif :
Produire la règle finale prête à être enregistrée dans le référentiel métier.

Contraintes :
- la règle doit rester générale et réutilisable,
- elle doit viser une réponse définitive dès le premier run si possible,
- sinon une demande de complément minimale et ciblée,
- elle ne doit pas contenir de formulation vague,
- n'invente aucune donnée métier absente des réponses administrateur,
- si certaines données restent absentes, le signaler dans les notes.

Réponds uniquement en JSON valide avec cette structure :

{
  "final_rule": {
    "title": "titre final",
    "content": "texte complet final de la règle",
    "rule_type": "content|prudence|validation|missing_info|source_access",
    "priority_rank": 100,
    "application_scope": "mail_assistant",
    "mailbox_scope": "global",
    "mail_category_scope": "global",
    "workflow_scope": "reply",
    "theme": "theme principal",
    "missing_info_action": "cautious_reply|ask_for_more|block_final_reply|require_human_validation|require_external_source",
    "status": "active",
    "notes": "note interne éventuelle"
  },
  "summary": "résumé court de la règle finale",
  "remaining_gaps": [
    "lacune restante 1"
  ]
}

Demandes source :
[COLLER ICI LES DEMANDES]

Règle candidate :
[COLLER ICI LE JSON OU LE TEXTE DE LA RÈGLE CANDIDATE]

Réponses de l'administrateur :
[COLLER ICI LES RÉPONSES ADMIN]
```

## 3. Prompt externe pour tester si la règle a bien été appliquée

```text
Tu es un assistant de contrôle qualité chargé de vérifier si une règle métier a bien été appliquée dans une réponse générée à un mail.

Objectif :
Analyser si la réponse produite tient réellement compte de la règle active et si elle est conforme à l'intention métier attendue.

Contraintes :
- ne pas juger seulement le style,
- vérifier surtout la conformité métier,
- dire clairement si la règle a été appliquée, partiellement appliquée ou non appliquée,
- signaler les écarts concrets,
- ne pas inventer d'informations absentes.

Réponds uniquement en JSON valide avec cette structure :

{
  "rule_was_relevant": true,
  "rule_was_applied": "yes|partially|no",
  "overall_quality": "poor|fair|good|excellent",
  "compliance_summary": "résumé court",
  "points_correctly_applied": [
    "point respecté 1",
    "point respecté 2"
  ],
  "points_missing_or_incorrect": [
    "point manquant ou incorrect 1",
    "point manquant ou incorrect 2"
  ],
  "did_response_use_rule_logic": true,
  "did_response_request_only_needed_missing_info": true,
  "suggested_improved_response": "version améliorée courte de la réponse si nécessaire"
}

Mail reçu :
[COLLER ICI LE MAIL]

Règle active :
[COLLER ICI LA RÈGLE]

Réponse générée :
[COLLER ICI LA RÉPONSE IA]
```

## Usage recommandé

Ordre conseillé :

1. créer la règle candidate ;
2. compléter les paramètres manquants ;
3. finaliser et enregistrer la règle ;
4. générer une réponse mail ;
5. contrôler que la règle a bien été appliquée.

## Intérêt du mode externe

Ce dispositif permet :
- d'utiliser un abonnement déjà disponible ;
- de comparer qualité, temps et coût entre plusieurs LLM ;
- de réinjecter ensuite le résultat dans le même processus admin.
