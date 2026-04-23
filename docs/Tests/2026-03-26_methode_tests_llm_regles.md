# Méthode de test LLM / Règles

Date : 2026-03-26

## Objet

Cette campagne doit distinguer strictement deux sujets :

1. la qualité intrinsèque du modèle ;
2. l'amélioration apportée par les règles.

Il ne faut donc pas mélanger :
- l'évaluation du modèle seul ;
- l'évaluation du modèle aidé par un corpus de règles.

## Prompts figés pour la campagne

Le prompt de référence et les deux variantes prévues pour la suite sont archivés ici :

- `2026-03-26_prompts_reference_phase_1_et_phase_2.md`
- `2026-03-28_prompts_outil_aide_regles.md`

Règle impérative :
- la comparaison `Mistral API` / `DeepSeek Chat` en phase 1 doit utiliser le prompt de référence figé, sans le modifier en cours de campagne.

## Principe retenu

Chaque cas de test doit être évalué en deux phases distinctes.

### Phase A - Référentiel de règles vide

Objectif :
- mesurer la capacité du LLM à détecter seul que le contexte est insuffisant ;
- mesurer sa capacité à éviter les hallucinations ;
- mesurer s'il estime qu'un recours aux règles serait pertinent ;
- mesurer la qualité de sa réponse prudente sans aide métier.

Dans cette phase :
- aucune règle métier n'est injectée ;
- le référentiel est considéré comme vide ;
- on cherche d'abord à juger la qualité du modèle.

### Phase B - Référentiel de règles enrichi

Objectif :
- mesurer l'amélioration de la réponse après ajout de règles générales pertinentes ;
- mesurer si le modèle exploite bien les règles ;
- mesurer le gain de précision, de prudence et de cohérence.

Dans cette phase :
- seules des règles générales, répétitives et utiles sont injectées ;
- on n'ajoute pas de règles pour des cas anecdotiques ou isolés ;
- on cherche à juger la qualité conjointe :
  - du modèle ;
  - du référentiel ;
  - de l'itération de test.

## Point méthodologique important

Avec le prompt de production actuel, la sortie fonctionnelle de l'application contient seulement :

```json
{
  "body": "reponse finale"
}
```

Cela ne suffit pas pour savoir de manière fiable :
- si le modèle a estimé qu'il devait consulter les règles ;
- s'il a jugé le contexte suffisant ou non ;
- quelles informations il considère manquantes.

Il faut donc distinguer :

### Prompt de production

But :
- produire une réponse exploitable par l'utilisateur.

### Prompt de test diagnostique

But :
- produire un diagnostic structuré de raisonnement pour la campagne de tests.

Ce prompt de test doit demander au modèle une sortie du type :

```json
{
  "context_sufficient": false,
  "should_consult_rules": true,
  "missing_information": [
    "verification reelle de la lisibilite de l'image"
  ],
  "rules_would_help": true,
  "draft_response": "..."
}
```

Conclusion :
- la campagne de test doit utiliser un mode diagnostique ;
- l'application utilisateur continue, elle, à utiliser le prompt de production.

## Variables à étudier

Les résultats dépendent de trois dimensions :

1. `Qualité du modèle`
2. `Qualité du corpus de règles`
3. `Nombre d'itérations de tests`

Le critère fondamental retenu reste :

4. `Qualité réelle de la réponse`

Autrement dit :
- la vitesse est importante ;
- le coût est important ;
- mais le premier critère de décision reste la qualité et la sûreté de la réponse produite.

## Réserve importante sur les modèles locaux

Les modèles locaux sont, à ce stade, exécutés sur le Mac de test.

Conséquence :
- leurs temps de réponse ne doivent pas être considérés comme définitifs ;
- ils devront être réévalués plus tard sur une machine plus adaptée, par exemple un serveur dédié ou un environnement tel que `DGX Spark`.

La comparaison actuelle doit donc être lue ainsi :
- qualité du diagnostic et de la réponse : exploitable dès maintenant ;
- performance locale : provisoire ;
- performance cible sur serveur : à mesurer plus tard.

## Orientation produit à préserver

À terme, l'application pourra prendre en compte plusieurs dimensions pour choisir automatiquement un modèle :
- urgence du mail ;
- complexité de la demande ;
- coût API ;
- disponibilité d'un modèle local ou distant ;
- qualité observée lors des campagnes de test.

Exemples de logique future :
- pour un mail urgent, privilégier un modèle plus rapide ;
- pour une demande complexe ou ambiguë, privilégier un modèle plus prudent et plus fiable ;
- pour un lot important de mails, arbitrer entre coût moyen et qualité attendue ;
- pour certains cas, utiliser un premier modèle de tri puis un second modèle de réponse.

## Système d'évaluation à prévoir dans l'application

Il faudra intégrer dans l'application un dispositif d'évaluation continue, surtout au démarrage du produit.

Ce système devra permettre :
- de comparer les réponses générées ;
- de noter leur qualité perçue ;
- de repérer les hallucinations ;
- de mesurer l'effet réel des règles ;
- d'alimenter les choix futurs de routage automatique entre modèles.

Ce système d'évaluation devra s'appuyer :
- sur les campagnes de tests archivées ;
- sur les retours utilisateurs ;
- sur les rejets de réponses ;
- sur les itérations successives du corpus de règles.

## Classement provisoire après la campagne du jour

Ce classement est provisoire et devra être revu après les tests suivants.

Périmètre actuellement couvert :
- `deepseek-chat` : `10 mails`
- `deepseek-local` : `10 mails`
- `deepseek-reasoner` : `5 premiers mails`
- `mistral-local` : `5 premiers mails`

### Classement provisoire qualité / prudence

1. `deepseek-chat`
2. `deepseek-reasoner`
3. `deepseek-local`
4. `mistral-local`

### Lecture de ce classement

- `deepseek-chat`
  - meilleur compromis actuel entre qualité de réponse, prudence, détection du manque d'information et temps de réponse
- `deepseek-reasoner`
  - très bon en qualité, mais plus lent
- `deepseek-local`
  - plutôt prudent, mais moins pertinent que `deepseek-chat` pour décider qu'un recours aux règles est utile
- `mistral-local`
  - insuffisant à ce stade sur la détection du manque d'information, avec plusieurs réponses trop affirmatives ou hallucinées

### Réserve de confidentialité et de routage futur

Le meilleur candidat actuel est `deepseek-chat`, mais son usage pose une question de confidentialité dès lors qu'il s'agit d'un modèle API externe.

Conséquence produit :
- le choix du meilleur modèle ne peut pas être fondé uniquement sur la qualité ;
- il devra aussi intégrer :
  - le niveau de confidentialité du mail ;
  - la criticité métier ;
  - le coût ;
  - la latence ;
  - la disponibilité d'un modèle local.

Orientation future recommandée :
- pour les contenus sensibles, prévoir un basculement automatique ou forcé vers un modèle local ;
- pour les cas urgents ou moins sensibles, autoriser un modèle API plus performant ;
- pour les cas complexes, envisager un routage par niveau de difficulté.

## Sorties archivées à produire

La campagne doit produire deux tableaux archivés distincts :

1. `Tableau A - Modèles seuls, sans règles`
2. `Tableau B - Modèles avec règles`

Chaque test produit une ligne détaillée dans chacun des tableaux.

## Tableau A - Sans règles

Fichier recommandé :
- `2026-03-26_tableau_tests_llm_sans_regles.md`

Colonnes :
- `Test`
- `Message / sujet`
- `Pièce jointe`
- `Modèle`
- `Plan / abonnement`
- `Context sufficient`
- `Should consult rules`
- `Missing information`
- `Réponse produite`
- `Hallucination`
- `Qualité réponse`
- `Observation détaillée`

## Tableau B - Avec règles

Fichier recommandé :
- `2026-03-26_tableau_tests_llm_avec_regles.md`

Colonnes :
- `Test`
- `Message / sujet`
- `Pièce jointe`
- `Modèle`
- `Plan / abonnement`
- `Règles activées`
- `Context sufficient`
- `Should consult rules`
- `Règles effectivement utiles`
- `Réponse produite`
- `Amélioration observée`
- `Hallucination`
- `Qualité réponse`
- `Observation détaillée`

## Principe de construction du corpus de règles

L'administrateur doit :
- commencer par un petit nombre de règles générales adaptées au type d'application ;
- enrichir ce corpus progressivement ;
- ne retenir que des cas généraux, répétitifs et représentatifs ;
- ne pas alourdir le référentiel avec des cas particuliers sans intérêt structurel.

## Evolution future

Plus tard :
- certaines règles textuelles pourront devenir des règles d'accès à une source autorisée ;
- par exemple :
  - horaires d'un club ;
  - calendrier ;
  - fichier de référence ;
  - base documentaire.

Dans ce cas :
- on ne met plus la donnée en dur dans la règle ;
- on indique à l'IA où chercher, dans quel cadre, et pour quel type de demande.
