# Garde-fous et securite de l'automatisation

Date : 2026-03-21

## 1. Objet

Ce document formalise les garde-fous obligatoires pour la V2 et la V3.

## 2. Principe general

L'automatisation doit toujours etre :
- utile ;
- compréhensible ;
- journalisée ;
- réversible autant que possible ;
- subordonnee aux droits et aux politiques.

## 3. Regles fondamentales

### Regle 1

Pas d'automatisation sans politique active.

### Regle 2

Pas d'action navigateur sensible sans trace.

### Regle 3

Pas d'envoi automatique par defaut.

### Regle 4

Pas de suppression automatique par defaut.

### Regle 5

Pas d'activation `Browser Use` pour les profils non autorises.

## 4. Garde-fous V2

En V2, doivent etre obligatoires :
- validation humaine avant sortie ;
- simulation d'envoi privilegiee ;
- trace lisible des actions V2 ;
- sequence courte et bornees ;
- retour rapide de la main a l'utilisateur.

## 5. Garde-fous V3

En V3, doivent etre obligatoires :
- politique explicite par boite ou connexion ;
- niveau d'autonomie explicite ;
- journalisation detaillee ;
- possibilite de stop ou d'interruption ;
- restriction forte des actions finales.

## 6. Actions a encadrer specialement

Actions critiques :
- connexion a la boite ;
- ouverture d'un message sensible ;
- ouverture d'une piece jointe ;
- injection d'une reponse ;
- envoi ;
- rejet ;
- suppression ;
- archivage.

## 7. Journalisation minimale

Pour chaque session :
- qui a demande l'action ;
- sur quelle boite ;
- sur quel message ;
- quelle action a ete tentee ;
- avec quel resultat ;
- a quelle date ;
- avec quel niveau d'autonomie ;
- avec quelle politique.

## 8. Regles de produit recommandees

Recommandations fortes :
- `validation_required = true` tant qu'aucune politique avancee ne le leve explicitement ;
- `simulation_enabled = true` par defaut ;
- `send_enabled = false` par defaut ;
- les pieces jointes doivent rester pre-traitees par l'application avant toute IA ;
- la priorite doit rester calculee hors IA.

## 9. Comportement d'echec

En cas d'echec Browser Use :
- arret de la sequence ;
- restitution d'un message clair ;
- conservation de la trace ;
- retour de la main a l'utilisateur ;
- aucune poursuite silencieuse du workflow.

## 10. Conclusion

L'automatisation n'est acceptable que si elle reste gouvernee.
La securite et la confiance utilisateur priment sur la vitesse.
