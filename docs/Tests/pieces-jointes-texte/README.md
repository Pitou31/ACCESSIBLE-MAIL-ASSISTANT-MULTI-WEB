# Kit de test - Pièce jointe texte

Ce dossier prépare un cas de test minimal pour vérifier que l'application transmet bien à l'IA :

1. le texte du mail ;
2. le fichier texte joint ;
3. une consigne explicite indiquant que la pièce jointe complète le mail.

## Objectif

Valider, sur un cas simple, que la réponse générée :

- lit le contenu du fichier `planning.txt` ;
- reprend correctement les contraintes qu'il contient ;
- ne se contente pas de mentionner le nom du fichier ;
- fonctionne aussi bien en création qu'en réponse.

## Fichiers du kit

- `planning.txt`
  Contient les contraintes à prendre en compte.
- `mail-entree-reponse.txt`
  Texte du mail reçu pour le scénario de réponse.
- `prompt-creation.txt`
  Prompt à utiliser pour le scénario de création.
- `prompt-reponse.txt`
  Prompt à utiliser pour le scénario de réponse si un prompt local est nécessaire.
- `traces-test.md`
  Grille de contrôle pour noter les résultats observés.

## Critères de réussite

Le test sera considéré comme concluant si :

1. le fichier `planning.txt` apparaît bien comme pièce jointe reçue ;
2. le système signale qu'il a bien été transmis au contexte de génération ;
3. la réponse mentionne correctement les contraintes du fichier ;
4. la réponse n'invente pas de contraintes absentes du fichier ;
5. la réponse ne dit pas qu'aucun fichier n'a été reçu.
