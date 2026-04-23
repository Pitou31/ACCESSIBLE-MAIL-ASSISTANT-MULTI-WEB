# Specification fonctionnelle - mini application administrateur

Date : 2026-03-18

## 1. Objet du document

Ce document decrit la future mini application administrateur qui devra interagir avec l'application usager.

Son but est de :
- traiter les demandes d'ouverture de compte ;
- controler et valider les comptes ;
- rattacher les versions autorisees et les boites mail ;
- preparer plus tard la comptabilite, la facturation, les statistiques et la supervision.

## 2. Decision de pilotage retenue

Pour gagner du temps, le projet ne doit pas essayer de construire tout de suite l'application administrateur complete.

Decision immediate :
- on se focalise d'abord sur la partie usager ;
- les actions de l'administrateur seront traitees manuellement dans un premier temps ;
- mais ces actions manuelles doivent etre strictement specifiees pour que leur future automatisation soit simple.

Donc :
- **specification admin maintenant**
- **implementation admin plus tard**
- **travail usager prioritaire maintenant**

## 3. Positionnement de l'application administrateur

La mini application administrateur est une application annexe, separee de l'application usager.

Elle n'est pas une simple page secondaire.
Elle doit etre consideree comme un outil de controle et de pilotage.

Elle devra avoir acces :
- aux demandes de compte ;
- aux statuts des comptes ;
- aux boites mail rattachees ;
- aux versions du produit autorisees ;
- aux droits associes ;
- plus tard a la facturation et aux statistiques globales.

## 4. Roles de l'administrateur

L'administrateur doit pouvoir :
- recevoir les alertes de nouvelle demande ;
- consulter une demande ;
- demander des informations complementaires ;
- refuser une demande ;
- valider une demande ;
- creer ou activer le compte correspondant ;
- affecter une version du produit ;
- rattacher une ou plusieurs boites mail ;
- affecter les droits principaux ;
- suivre l'activite globale.

## 5. Pages recommandees de la mini application administrateur

### 5.1 Tableau de bord

Fonctions :
- voir les nouvelles demandes ;
- voir les demandes en attente ;
- voir les demandes a completer ;
- voir les comptes recemment actives ;
- plus tard voir des indicateurs globaux.

### 5.2 Liste des demandes

Fonctions :
- lister les demandes ;
- filtrer par statut ;
- filtrer par type de compte ;
- filtrer par usage gratuit ou payant ;
- filtrer par presence ou non d'un justificatif.

### 5.3 Fiche detaillee d'une demande

Fonctions :
- voir toutes les donnees saisies ;
- voir la mention `Handicape` si elle existe ;
- voir les justificatifs fournis ;
- voir les boites mail prevues ;
- voir les besoins d'accessibilite ;
- historiser les actions admin.

Actions possibles :
- `Demander des informations complementaires`
- `Refuser`
- `Valider`

### 5.4 Validation d'un compte

Lors de la validation, l'administrateur doit pouvoir definir :
- version du produit autorisee ;
- type de compte final ;
- mode d'usage gratuit ou payant ;
- boites mail rattachees ;
- droits principaux ;
- statut du compte.

### 5.5 Gestion des comptes

Fonctions futures :
- consulter les comptes existants ;
- suspendre un compte ;
- reactiver un compte ;
- changer la version autorisee ;
- ajouter ou retirer des boites mail ;
- modifier les droits.

### 5.6 Modules futurs

Plus tard, la mini application administrateur devra aussi porter :
- comptabilite ;
- facturation ;
- statistiques globales ;
- supervision des boites mail ;
- suivi des automatisations.

## 6. Etats de la demande

La demande d'ouverture doit pouvoir passer par les etats suivants :
- `pending`
- `more_info_requested`
- `approved`
- `rejected`
- `closed`

## 7. Etats du compte

Le compte doit pouvoir passer par :
- `pending_activation`
- `active`
- `suspended`
- `archived`

## 8. Workflow cible usager / administrateur

### 8.1 Cote usager

1. L'usager remplit la demande.
2. Il depose la demande.
3. L'administrateur est alerte.
4. L'usager attend une reponse.
5. Si besoin, il envoie des complements.
6. Il recoit ensuite une decision.
7. Si la demande est validee, son compte devient utilisable.

### 8.2 Cote administrateur

1. L'administrateur recoit l'alerte.
2. Il consulte la demande.
3. Il verifie :
   - l'identite ;
   - le type de compte ;
   - le mode d'usage ;
   - les justificatifs ;
   - la mention `Handicape` si elle est cochee ;
   - les boites mail prevues.
4. Il choisit :
   - demander des informations complementaires ;
   - refuser ;
   - valider.
5. En cas de validation, il fixe :
   - version autorisee ;
   - boites mail rattachees ;
   - droits principaux.
6. Le systeme met a jour la demande et le compte.

## 9. Ce qui sera fait manuellement dans un premier temps

Pour accelerer le projet, les actions suivantes resteront manuelles au debut :
- lecture du mail d'alerte admin ;
- examen de la demande ;
- echange mail avec le demandeur ;
- decision d'acceptation, refus ou demande de complement ;
- saisie manuelle des informations de validation.

Ces actions manuelles doivent cependant suivre une logique stricte, car elles prefigurent le futur outil admin.

## 10. Regle de travail immediate

La priorite de developpement actuelle est la suivante :

### Cote usager
- rendre la demande d'ouverture claire et robuste ;
- enregistrer correctement la demande ;
- envoyer l'alerte admin ;
- permettre a l'usager de suivre sa demande ;
- preparer l'acces au compte une fois valide.

### Cote administrateur
- ne pas encore construire toute l'application ;
- mais definir precisement les actions et etats ;
- traiter ces actions manuellement ;
- garder la structure necessaire pour l'implementation future.

## 11. Donnees minimales que l'administrateur devra pouvoir fixer

Lors de la validation, l'administrateur devra pouvoir renseigner au minimum :
- `compte valide par un administrateur`
- `version d'application autorisee`
- `boites mail rattachees`
- `droits principaux`

Ces informations ne doivent pas etre remplies par l'usager.

## 12. Question de l'automatisation future

Plus tard, la mini application administrateur pourra automatiser une partie du travail :
- reponses standardisees aux demandes ;
- demandes de justificatif ;
- relances ;
- creation de compte apres validation ;
- facturation ;
- tableaux de bord.

Mais pour le moment, le bon choix est :
- automatiser seulement le strict necessaire ;
- garder la validation humaine ;
- documenter finement le cheminement.

## 13. Resume executif

La mini application administrateur est bien necessaire.

Cependant, pour gagner du temps :
- on en fait la specification maintenant ;
- on continue a developper la partie usager ;
- et l'administrateur travaille encore manuellement selon un workflow deja cadre.

Le projet avance donc en deux vitesses :
- **usager developpe**
- **admin specifie puis implemente plus tard**
