# Jeu d'essai - Commandes vocales d'edition textuelle

Date : 2026-04-07

## Objet

Ce jeu d'essai sert a tester la premiere etape de l'edition vocale assistee par IA : edition textuelle pure d'un mail.

Sont inclus :
- remplacement de texte ;
- insertion avant ou apres une cible ;
- ajout en fin de texte ;
- suppression locale ;
- ponctuation ;
- retours a la ligne ;
- majuscules/minuscules simples ;
- cas d'ambiguite a refuser.

Sont exclus pour cette premiere campagne :
- couleur ;
- gras, italique, soulignement ;
- mise en forme riche ;
- titres visuels ;
- tableaux ;
- reecriture complete du mail.

## Regle d'evaluation

Pour chaque cas, le systeme doit :
- interpreter la commande vocale ;
- separer action, cible et contenu ;
- appliquer uniquement une modification locale ;
- ne pas rejouer d'ancienne commande ;
- ne pas modifier tout le mail ;
- refuser si la cible est ambigue.

## Texte de base pour la campagne

Sauf indication contraire, utiliser le texte suivant :

```text
Bonjour Madame,

Merci pour votre message. Je vous confirme que le dossier est complet. Je reste disponible pour un rendez-vous mardi matin.

Cordialement
Jacques
```

## Tableau des cas

| ID | Type | Texte initial | Commande vocale | Action attendue | Resultat attendu |
| --- | --- | --- | --- | --- | --- |
| EVT-001 | Insertion avant | `Bonjour Madame,` | `Dans Bonjour Madame ajoute Mademoiselle virgule devant Madame` | `insert_before`, target `Madame`, text `Mademoiselle,` | `Bonjour Mademoiselle, Madame,` |
| EVT-002 | Insertion apres | `Bonjour Madame,` | `Dans Bonjour Madame ajoute et Monsieur apres Madame` | `insert_after`, target `Madame`, text `et Monsieur` | `Bonjour Madame et Monsieur,` |
| EVT-003 | Remplacement simple | `Bonjour Madame,` | `Remplace Madame par Monsieur` | `replace_text`, target `Madame`, text `Monsieur` | `Bonjour Monsieur,` |
| EVT-004 | Remplacement expression | `Merci pour votre message.` | `Remplace votre message par votre retour` | `replace_text`, target `votre message`, text `votre retour` | `Merci pour votre retour.` |
| EVT-005 | Ajout fin | texte de base | `Positionne-toi en fin de page et ajoute le mot Bien cordialement` | `append_end`, text `Bien cordialement` | texte de base + `Bien cordialement` a la fin |
| EVT-006 | Ajout fin formulation courte | texte de base | `Ajoute merci a la fin` | `append_end`, text `merci` | texte de base + `merci` a la fin |
| EVT-007 | Ajout fin avec phrase | texte de base | `A la fin ajoute la phrase Je vous remercie par avance` | `append_end`, text `Je vous remercie par avance` | texte de base + phrase en fin |
| EVT-008 | Insertion avant formule | `Cordialement\nJacques` | `Ajoute Bien avant Cordialement` | `insert_before`, target `Cordialement`, text `Bien` | `Bien Cordialement\nJacques` |
| EVT-009 | Insertion apres formule | `Cordialement\nJacques` | `Ajoute Jacques Soule apres Jacques` | `insert_after`, target `Jacques`, text `Soule` | `Cordialement\nJacques Soule` |
| EVT-010 | Suppression cible | `Bonjour Madame,` | `Supprime Madame` | `replace_text`, target `Madame`, text vide ou delete target | `Bonjour,` |
| EVT-011 | Suppression phrase | `Merci pour votre message. Je vous confirme que le dossier est complet.` | `Supprime la phrase Merci pour votre message` | suppression de la phrase cible | `Je vous confirme que le dossier est complet.` |
| EVT-012 | Ponctuation deux points | `Objet Rendez-vous` | `Mets deux points entre Objet et Rendez-vous` | inserer `:` entre `Objet` et `Rendez-vous` | `Objet : Rendez-vous` |
| EVT-013 | Ponctuation virgule | `Bonjour Madame` | `Ajoute une virgule apres Madame` | `insert_after`, target `Madame`, text `,` | `Bonjour Madame,` |
| EVT-014 | Ponctuation point | `Le dossier est complet` | `Ajoute un point a la fin de la phrase` | insertion `.` en fin | `Le dossier est complet.` |
| EVT-015 | Point interrogation | `Pouvez-vous me confirmer le rendez-vous` | `Mets un point d'interrogation a la fin` | insertion `?` en fin | `Pouvez-vous me confirmer le rendez-vous ?` |
| EVT-016 | Majuscule mot | `bonjour Madame,` | `Mets une majuscule a bonjour` | transformer `bonjour` en `Bonjour` | `Bonjour Madame,` |
| EVT-017 | Majuscules mot complet | `code dossier abc123` | `Mets abc123 en majuscules` | upper target | `code dossier ABC123` |
| EVT-018 | Minuscule mot | `Bonjour MADAME,` | `Mets Madame en minuscules` | lower target | `Bonjour madame,` |
| EVT-019 | Retour ligne avant | `Merci Cordialement` | `Mets un retour a la ligne avant Cordialement` | insert newline before target | `Merci\nCordialement` |
| EVT-020 | Retour ligne apres | `Bonjour Madame, Merci pour votre message.` | `Mets un retour a la ligne apres Madame virgule` | insert newline after `Madame,` | `Bonjour Madame,\nMerci pour votre message.` |
| EVT-021 | Nouveau paragraphe | `Bonjour Madame, Merci pour votre message.` | `Fais un nouveau paragraphe avant Merci` | insert blank line before target | `Bonjour Madame,\n\nMerci pour votre message.` |
| EVT-022 | Remplacement cible accent | `Je vous confirme le rendez-vous mardi matin.` | `Remplace rendez-vous par entretien` | replace target | `Je vous confirme le entretien mardi matin.` |
| EVT-023 | Remplacement avec article | `Je vous confirme le rendez-vous mardi matin.` | `Remplace le rendez-vous par l'entretien` | replace expression | `Je vous confirme l'entretien mardi matin.` |
| EVT-024 | Insertion cible fin phrase | `Le dossier est complet.` | `Ajoute et valide avant le point` | insert before `.` | `Le dossier est complet et valide.` |
| EVT-025 | Insertion apres mot avec ponctuation | `Bonjour Madame,` | `Ajoute Monsieur apres Madame sans supprimer la virgule` | insert after target before comma ou apres cible | `Bonjour Madame Monsieur,` |
| EVT-026 | Ambiguite cible multiple | `Madame a repondu a Madame Martin.` | `Remplace Madame par Monsieur` | refuser car cible multiple | aucune modification |
| EVT-027 | Ambiguite manque cible | texte de base | `Remplace ce mot par demande` | refuser sans selection/cible | aucune modification |
| EVT-028 | Ambiguite manque contenu | texte de base | `Ajoute a la fin` | refuser contenu vide | aucune modification |
| EVT-029 | Ambiguite action seule | texte de base | `Modifie le texte` | refuser action trop vague | aucune modification |
| EVT-030 | Texte exact | texte de base | `Ecris exactement ajoute merci a la fin` | si mode edition, `append_end` ou refuser selon regle exacte a confirmer | a discuter |
| EVT-031 | Suppression mot fin | `Merci beaucoup beaucoup.` | `Supprime le dernier beaucoup` | supprimer occurrence finale | `Merci beaucoup.` |
| EVT-032 | Remplacement occurrence precise | `Merci beaucoup beaucoup.` | `Remplace le premier beaucoup par énormément` | remplacer premiere occurrence | `Merci énormément beaucoup.` |
| EVT-033 | Insertion debut texte | texte de base | `Au debut du texte ajoute Note importante deux points` | insert at beginning | `Note importante :\nBonjour Madame,...` |
| EVT-034 | Ajout signature | texte de base sans `Jacques` | `Ajoute Jacques en signature a la fin` | append end | texte + `Jacques` en fin |
| EVT-035 | Correction faute | `Je vous remerci pour votre message.` | `Corrige remerci en remercie` | replace target | `Je vous remercie pour votre message.` |
| EVT-036 | Correction accord | `Les document sont complets.` | `Remplace document par documents` | replace target | `Les documents sont complets.` |
| EVT-037 | Suppression ponctuation | `Bonjour Madame,,` | `Supprime la deuxième virgule` | supprimer une virgule | `Bonjour Madame,` |
| EVT-038 | Ajout ponctuation entre mots | `Dossier transport adapte` | `Mets un tiret entre transport et adapte` | insert `-` ou ` - ` selon regle | `Dossier transport-adapte` ou `transport - adapte` a preciser |
| EVT-039 | Remplacer formule appel | `Bonjour Madame,` | `Remplace Bonjour Madame par Bonjour Mademoiselle` | replace expression | `Bonjour Mademoiselle,` |
| EVT-040 | Ajouter civilite | `Bonjour Jacques,` | `Ajoute Monsieur devant Jacques` | insert_before target `Jacques`, text `Monsieur` | `Bonjour Monsieur Jacques,` |
| EVT-041 | Supprimer paragraphe | texte de base | `Supprime le paragraphe qui commence par Merci` | supprimer paragraphe cible | `Bonjour Madame,\n\nCordialement\nJacques` |
| EVT-042 | Ajouter phrase apres phrase | texte de base | `Apres la phrase le dossier est complet ajoute je vous l'envoie aujourd'hui` | insert_after phrase target | phrase inseree apres la phrase cible |
| EVT-043 | Remplacer jour | texte de base | `Remplace mardi matin par jeudi apres-midi` | replace expression | `... rendez-vous jeudi apres-midi.` |
| EVT-044 | Ajouter precision | texte de base | `Ajoute si cela vous convient apres mardi matin` | insert_after target | `... mardi matin si cela vous convient.` |
| EVT-045 | Supprimer precision | texte de base | `Supprime mardi matin` | remove target | `Je reste disponible pour un rendez-vous.` |
| EVT-046 | Transformer en phrase courte | `Je vous confirme que le dossier est complet.` | `Remplace cette phrase par dossier complet` sans selection | refuser si cible `cette phrase` non resolue | aucune modification |
| EVT-047 | Action avec contexte local | `Objet Rendez-vous\nBonjour Madame,` | `Dans la ligne Objet Rendez-vous mets deux points apres Objet` | insert `:` apres Objet dans la ligne cible | `Objet : Rendez-vous\nBonjour Madame,` |
| EVT-048 | Ajout mot avec accent | `Je vous confirme le reveil.` | `Remplace reveil par réveil avec accent` | replace target | `Je vous confirme le réveil.` |
| EVT-049 | Supprimer espaces doubles | `Bonjour  Madame,` | `Supprime le double espace entre Bonjour et Madame` | replace double space | `Bonjour Madame,` |
| EVT-050 | Ne pas tout inserer | texte de base | `Positionne-toi en fin de page et ajoute le mot cordialement` | `append_end`, text uniquement `cordialement` | ne doit pas inserer toute la commande |
| EVT-051 | Ne pas tout inserer 2 | texte de base | `Ajoute seulement le mot merci a la fin` | `append_end`, text uniquement `merci` | ne doit pas inserer `Ajoute seulement...` |
| EVT-052 | Remplacement cible avec guillemets | `Le statut est en attente.` | `Remplace en attente par validé` | replace target | `Le statut est validé.` |
| EVT-053 | Ajout fin avec ponctuation | texte de base | `Ajoute a la fin merci point` | append `merci.` | texte + `merci.` |
| EVT-054 | Suppression formule | texte de base | `Supprime Cordialement` | remove target | texte sans `Cordialement` |
| EVT-055 | Ambiguite homonyme | `Le dossier dossier est complet.` | `Supprime dossier` | refuser cible multiple | aucune modification |
