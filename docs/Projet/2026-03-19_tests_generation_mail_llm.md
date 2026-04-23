# Structure du fichier de test

## 1. Création de mail

### Prompt d'introduction

```text
Tu es un spécialiste de la rédaction de mails.
Rédige un mail clair, professionnel et accessible.
Objectif : répondre de manière polie et concise à la demande de l’interlocuteur.
```

### Résultats obtenus

| Modèle testé | Résultat | Commentaires obtenus à la demande |
|---|---|---|
| `mistral-local` | Brouillon généré en mode secours. | `Bad control character in string literal in JSON at position 71 (line 3 column 25).` Puis correction du parseur pour rendre l'extraction plus tolérante. |
| `deepseek-local` |  | Le modèle existe bien en local (`deepseek-r1:latest`), mais la génération a été perçue comme non concluante. Le délai local a été augmenté à `120 s`. |
| `deepseek-chat` | Brouillon généré rapidement. | Réponse jugée rapide. La barre de progression n'a pas été jugée exploitable. |
| `deepseek-reasoner` |  | Pas encore de résultat utilisateur archivé. Le délai spécifique a été porté à `90 s`. |

## 2. Réponse de mail

### Mail d'input d'introduction

```text
From : client@example.com
Date : 14/03/2026
Objet : Demande de précisions sur les délais

Bonjour,

Je souhaiterais connaître les délais moyens de traitement de ma demande ainsi que les documents à fournir pour compléter mon dossier.

Merci par avance pour votre retour.

Bien cordialement
```

### Résultats obtenus

| Modèle testé | Résultat | Commentaires obtenus à la demande |
|---|---|---|
| `mistral-local` |  | Aucun résultat archivé pour le moment dans cette campagne de test. |
| `deepseek-local` |  | Aucun résultat archivé pour le moment dans cette campagne de test. |
| `deepseek-chat` |  | Aucun résultat archivé pour le moment dans cette campagne de test. |
| `deepseek-reasoner` |  | Aucun résultat archivé pour le moment dans cette campagne de test. |

## 3. Paramètres de délai actuellement en place

- Modèles distants standards : `30 s`
- `deepseek-reasoner` : `90 s`
- Modèles locaux (`mistral-local`, `deepseek-local`) : `120 s`
