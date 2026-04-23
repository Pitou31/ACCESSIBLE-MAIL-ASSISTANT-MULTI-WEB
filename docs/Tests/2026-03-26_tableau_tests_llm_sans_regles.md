# Tableau A - Tests LLM sans règles

Date de lancement : 2026-03-26

## Objectif

Mesurer la qualité intrinsèque du modèle lorsque le référentiel de règles est vide.

## Synthèse provisoire archivée

État au 2026-03-26 :
- `deepseek-chat` a été testé sur `10 mails`
- `deepseek-local` a été testé sur `10 mails`
- `deepseek-reasoner` a été testé sur les `5 premiers mails`
- `mistral-local` a été testé sur les `5 premiers mails`
- `mistral-api` : campagne phase 1 `sans règle` lancée sur `10 mails` avec le prompt de référence figé

Classement provisoire sur le critère fondamental de qualité de réponse :
1. `deepseek-chat`
2. `deepseek-reasoner`
3. `deepseek-local`
4. `mistral-local`

Points saillants :
- `deepseek-chat` détecte le mieux l'insuffisance du contexte et sait assez bien signaler quand un référentiel métier serait utile.
- `deepseek-reasoner` est bon en diagnostic, mais sa lenteur est forte.
- `deepseek-local` est prudent mais moins pertinent que `deepseek-chat` pour décider d'un recours aux règles.
- `mistral-local` a montré plusieurs faux `contextSufficient = true` et des réponses trop affirmatives.
- `mistral-api` est nettement meilleur que `mistral-local`, mais reste inégal sur `shouldConsultRules` et a produit un fallback sur le cas le plus complexe.

## Tableau détaillé

Note :
- la colonne `Plan / abonnement` doit être renseignée pour chaque campagne
- pour `Mistral API`, il faudra distinguer au minimum `gratuit / Experiment` et `pay as you go` si un second essai est fait plus tard

| Test | Message / sujet | Pièce jointe | Modèle | Plan / abonnement | Context sufficient | Should consult rules | Missing information | Réponse produite | Hallucination | Qualité réponse | Observation détaillée |
|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `mistral-local` | `local Mac` | `non` | `oui` | `verification reelle de la lisibilite de l'image` | Détecte le manque d'information, mais formulation maladroite. | `aucune` | `moyenne` | Prudent, mais style peu naturel. |
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `mistral-api` | `gratuit / Experiment ?` | `non` | `non` | `non remontée explicitement` | Réponse prudente, exploitable et sans hallucination, mais le modèle ne juge pas spontanément utile de consulter les règles. | `aucune` | `bonne` | Premier essai réel concluant côté accès API. Diagnostic bon, mais moins intéressant que `deepseek-chat` sur `shouldConsultRules`. |
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `deepseek-local` | `local Mac` | `non` | `oui` | `verification reelle de la lisibilite de l'image` | Détecte le manque d'information, mais demande parfois à l'expéditrice de confirmer elle-même. | `mineure` | `moyenne` | Correct, mais plus confus et lent. |
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `deepseek-chat` | `API DeepSeek` | `non` | `oui` | `verification reelle de la lisibilite de l'image` | Réponse prudente claire, sans hallucination. | `aucune` | `bonne` | Meilleur compromis actuel. |
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `deepseek-reasoner` | `API DeepSeek` | `non` | `oui` | `verification reelle de la lisibilite de l'image` | Réponse prudente de bonne qualité. | `aucune` | `bonne` | Bonne qualité, mais plus lent. |

## Cas marquants supplémentaires

- `mail-test-001` `Délais`
  - `deepseek-chat` et `deepseek-reasoner` jugent correctement le contexte insuffisant
  - `mistral-local` invente un délai moyen
- `mail-test-003` `Facture`
  - `deepseek-chat` voit qu'il manque le contenu de la facture
  - `mistral-local` confirme à tort que le montant est correct
- `mail-test-006` `Remerciement`
  - `deepseek-chat` et `deepseek-local` reconnaissent correctement que le contexte est suffisant
- `mail-test-010` `Demande multi-points + pièce jointe`
  - `deepseek-chat` détecte bien que la pièce jointe est centrale
  - `deepseek-local` reste prudent mais moins net

## Campagne Mistral API - Phase 1 sans règle

Plan / abonnement utilisé :
- `plan supérieur / paiement à l'usage` activé le jour du test

Lecture provisoire :
- accès API stable
- amélioration nette de latence par rapport au premier essai en gratuit
- bon niveau de prudence global
- mais recours aux règles encore trop peu détecté spontanément
- un `timeout / fallback` observé sur `mail-test-010`

### Tableau de synthèse Mistral API

| Test | Sujet | Plan / abonnement | Context sufficient | Should consult rules | Qualité réponse | Observation détaillée |
|---|---|---|---|---|---|---|
| T001 | Délais | `pay as you go` | `non` | `oui` | `bonne` | Bon diagnostic. Comprend bien qu'il faut un référentiel métier ou un SLA. |
| T002 | Relance dossier | `pay as you go` | `non` | `non` | `moyenne` | Réponse prudente, mais ajoute un délai `48h` non justifié. |
| T003 | Facture + PDF | `pay as you go` | `non` | `non` | `moyenne` | Bonne prudence sur le PDF non exploité, mais sous-estime l'intérêt d'un référentiel métier. |
| T004 | Documents à transmettre | `pay as you go` | `non` | `oui` | `bonne` | Bon cas. Détecte correctement l'insuffisance du contexte et l'utilité des règles. |
| T005 | Problème dans la démarche | `pay as you go` | `non` | `non` | `bonne-` | Prudence correcte, mais faible réflexe de consultation des règles. |
| T006 | Remerciement | `pay as you go` | `oui` | `non` | `bonne` | Cas bien géré. Contexte suffisant détecté correctement. |
| T007 | Photo de document | `pay as you go` | `non` | `non` | `moyenne+` | Bonne prudence, mais ajoute un comportement implicite discutable sur l'absence de réponse. |
| T008 | Accessibilité / handicap | `pay as you go` | `non` | `oui` | `bonne` | Cas intéressant. Détecte bien qu'un référentiel métier et des procédures internes seraient utiles. |
| T009 | Urgent sans contexte | `pay as you go` | `non` | `non` | `bonne-` | Réponse prudente et exploitable, mais pas orientée règles. |
| T010 | Demande multi-points + docx | `pay as you go` | `non` | `oui` | `insuffisante` | Timeout sur le scénario `sans règle`, fallback générique. Point faible actuel. |

### Conclusion provisoire Mistral API - sans règle

- `Mistral API` est très au-dessus de `mistral-local`
- il est globalement prudent et souvent exploitable
- mais il reste derrière `deepseek-chat` sur la détection spontanée du besoin de consulter les règles
- il a aussi montré une fragilité de temps de réponse sur le cas le plus complexe
