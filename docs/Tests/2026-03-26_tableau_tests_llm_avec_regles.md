# Tableau B - Tests LLM avec règles

Date de lancement : 2026-03-26

## Objectif

Mesurer l'amélioration de la réponse après ajout de règles générales pertinentes.

## Règles générales de départ

1. `Ne jamais inventer une information absente du contexte`
2. `Ne pas confirmer la lisibilité d'une image non analysée`
3. `Produire une réponse prudente si une information nécessaire manque`

## Synthèse provisoire archivée

Effet global observé :
- les règles améliorent surtout la netteté du cadrage et la prudence ;
- elles aident davantage `deepseek-chat` que `deepseek-local` ;
- elles corrigent partiellement certains travers de `mistral-local`, sans suffire à en faire un bon candidat ;
- elles améliorent `deepseek-reasoner`, mais sans compenser sa lenteur.

Conclusion provisoire :
- `deepseek-chat` reste le meilleur candidat avec règles ;
- `deepseek-local` progresse avec règles mais reste lent et moins pertinent ;
- `deepseek-reasoner` reste bon mais coûteux en temps ;
- `mistral-local` reste derrière malgré l'aide des règles.
- `mistral-api` a passé un premier essai réel concluant sur le cas `photo_document.jpg`, avec amélioration visible lorsqu'on active les règles.

## Tableau détaillé

Note :
- la colonne `Plan / abonnement` doit être renseignée pour chaque campagne
- pour `Mistral API`, il faudra distinguer au minimum `gratuit / Experiment` et `pay as you go` si un second essai est fait plus tard

| Test | Message / sujet | Pièce jointe | Modèle | Plan / abonnement | Règles activées | Context sufficient | Should consult rules | Règles effectivement utiles | Réponse produite | Amélioration observée | Hallucination | Qualité réponse | Observation détaillée |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `mistral-local` | `local Mac` | `3 règles générales` | `non` | `oui` | `oui` | Refuse plus explicitement de confirmer la lisibilité. | `oui` | `aucune` | `moyenne` | Gain réel de prudence, style encore moyen. |
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `mistral-api` | `gratuit / Experiment ?` | `3 règles générales` | `non` | `oui` | `oui` | Réponse plus cadrée, plus procédurale et plus sûre qu'en l'absence de règles. | `oui` | `aucune` | `bonne` | Premier essai réel concluant côté accès API. Avec règles, le modèle bascule enfin sur `shouldConsultRules = true`. |
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `deepseek-local` | `local Mac` | `3 règles générales` | `non` | `oui` | `oui` | Réponse plus nette et mieux cadrée. | `oui` | `aucune` | `moyenne` | Amélioration visible, latence encore forte. |
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `deepseek-chat` | `API DeepSeek` | `3 règles générales` | `non` | `oui` | `oui` | Réponse plus procédurale et plus sûre. | `oui` | `aucune` | `bonne` | Très bon compromis qualité / prudence / temps. |
| T1 | Photo de document à confirmer lisible | `photo_document.jpg` | `deepseek-reasoner` | `API DeepSeek` | `3 règles générales` | `non` | `oui` | `oui` | Réponse très cadrée et prudente. | `oui` | `aucune` | `bonne` | Bonne qualité, mais temps plus long. |

## Cas marquants supplémentaires

- `mail-test-001` `Délais`
  - avec règles, `deepseek-chat` et `deepseek-local` formulent mieux la prudence
- `mail-test-007` `Photo de document`
  - `deepseek-chat` améliore clairement sa réponse
  - `deepseek-local` reste en retrait sur l'usage explicite des règles
- `mail-test-008` `Accessibilité / handicap`
  - `deepseek-chat` s'appuie utilement sur le besoin de référentiel et de contexte complémentaire
- `mail-test-009` `Urgent`
  - `deepseek-local` progresse avec règles
  - `deepseek-chat` reste prudent mais pas particulièrement “orienté règles”
- `mail-test-010` `Demande multi-points`
  - `deepseek-chat` exploite bien l'idée qu'il faut d'abord le contenu de la pièce jointe
