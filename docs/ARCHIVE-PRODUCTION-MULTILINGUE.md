# Archive - Agent multilingue en production

Date : 2026-03-31
Projet : ACCESSIBLE_MAIL_ASSISTANT_MULTI

## Objet
Conserver la décision suivante pour la fin du projet : la mise en place complète d'un agent multilingue ne sera traitée qu'au moment du passage en production.

## Décision retenue
Ne pas industrialiser maintenant la gestion multilingue complète de l'agent.
Reporter ce chantier à la phase finale de mise en production.

## Cible production
Mettre en place un agent unique multilingue piloté par un profil linguistique, sans dupliquer l'application par langue.

## Périmètre visé en production
1. Langue de l'interface distincte de la langue de travail de l'agent.
2. Langue de sortie distincte de la langue des contenus d'entrée.
3. Détection automatique des langues d'entrée.
4. Prompts système et messages de l'agent localisés.
5. Ressources UI localisées.
6. Préférences audio par langue.
7. Gestion propre des contenus mixtes et multilingues.

## Configuration cible
- uiLanguage
- agentLanguage
- outputLanguage
- inputLanguageMode=auto

## Principe d'architecture
- un seul agent
- multilingue
- piloté par configuration
- sans duplication du code métier par langue

## Conditions préalables avant ce chantier
1. Stabilisation complète du flux mail.
2. Stabilisation des règles et tests métier.
3. Stabilisation de l'accessibilité et de l'édition assistée.
4. Validation du comportement audio multilingue.
5. Passage en phase de préparation production.

## Rappel
Ce sujet ne doit pas être oublié, mais il ne doit pas ralentir le développement courant tant que l'agent n'est pas considéré comme prêt pour la production.
