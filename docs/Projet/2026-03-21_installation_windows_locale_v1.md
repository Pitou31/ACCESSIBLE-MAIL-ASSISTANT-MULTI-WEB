# Installation Windows Locale V1

## Objectif

Installer l'application **Accessible Mail Assistant** sur un poste Windows local, avec une procédure simple, reproductible et documentée.

Cette note récapitule :
- les prérequis Windows
- les scripts fournis
- la procédure d'installation
- les points à compléter à la main
- les vérifications à effectuer après installation

## Périmètre actuel

Cette installation locale Windows vise la **V1** actuelle :
- backend Node.js local
- frontend servi en local
- base SQLite locale
- connexion Gmail via OAuth Google
- IA via API distante ou via Ollama local
- traitement des pièces jointes `txt`, `docx`, `pdf`

## Scripts et fichiers fournis

### Script principal d'installation

- [install-local.ps1](/Users/jacquessoule/Documents/ACCESSIBLE-MAIL-ASSISTANT/scripts/windows/install-local.ps1)

Ce script automatise :
- la vérification de `node`
- la vérification de `npm`
- la vérification de `python`
- l'installation des dépendances Node.js
- l'installation de `pypdf`
- la création du fichier `.env`
- le contrôle optionnel d'Ollama

### Fichier modèle d'environnement

- [.env.windows.example](/Users/jacquessoule/Documents/ACCESSIBLE-MAIL-ASSISTANT/.env.windows.example)

Ce fichier sert de base pour générer le `.env` local Windows.

### Référence générale

- [README.md](/Users/jacquessoule/Documents/ACCESSIBLE-MAIL-ASSISTANT/README.md)

## Pré-requis à installer avant le script

Le script **n'installe pas lui-même** les logiciels système.  
Il faut préparer le poste Windows avec :

1. **Node.js 22 LTS ou supérieur**
2. **Python 3**
3. **Ollama** seulement si l'on veut utiliser les modèles locaux

## Préparation du poste Windows

### Étape 1 : copier le projet

Copier le projet dans un dossier simple, par exemple :

```text
C:\ACCESSIBLE-MAIL-ASSISTANT
```

### Étape 2 : ouvrir PowerShell

Ouvrir **PowerShell** dans le dossier du projet :

```powershell
cd C:\ACCESSIBLE-MAIL-ASSISTANT
```

### Étape 3 : autoriser les scripts PowerShell si nécessaire

Si PowerShell refuse l'exécution du script :

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
```

## Lancement du script

### Installation standard

```powershell
.\scripts\windows\install-local.ps1
```

### Installation avec contrôle Ollama

```powershell
.\scripts\windows\install-local.ps1 -WithOllama
```

### Forcer la recréation du `.env`

```powershell
.\scripts\windows\install-local.ps1 -ForceEnv
```

## Ce que fait exactement le script

Le script :

1. vérifie la présence de :
   - `node`
   - `npm`
   - `python`
2. refuse Node.js si la version est inférieure à 22
3. exécute :

```powershell
npm install
```

4. exécute :

```powershell
python -m pip install --user pypdf
```

5. crée le dossier :

```text
backend\data
```

6. crée le fichier `.env` à partir de `.env.windows.example` si nécessaire
7. contrôle Ollama si l'option `-WithOllama` est demandée

## Fichier `.env` à compléter

Après le script, il faut ouvrir le fichier `.env` local et renseigner les secrets.

Les variables importantes à compléter sont :

- `GOOGLE_OAUTH_CLIENT_ID`
- `GOOGLE_OAUTH_CLIENT_SECRET`
- `GOOGLE_OAUTH_REDIRECT_URI`
- `SMTP_USER`
- `SMTP_PASS`
- `MAIL_FROM`
- `ADMIN_ALERT_EMAIL`
- `DEEPSEEK_API_KEY` si utilisation API
- `SESSION_SECRET`
- `MAILBOX_TOKEN_SECRET`
- `APP_SECRET`

## Exemple de callback Google OAuth en local

Pour Gmail OAuth local, le callback attendu est :

```text
http://localhost:3000/api/mailbox/google/callback
```

## Cas des modèles IA

### Cas 1 : utilisation API distante

Il suffit de renseigner :

- `DEEPSEEK_API_KEY`

Dans ce cas, les modèles distants peuvent être utilisés sans Ollama.

### Cas 2 : utilisation locale avec Ollama

Après installation d'Ollama, télécharger les modèles :

```powershell
ollama pull mistral:latest
ollama pull deepseek-r1:latest
```

Le code actuel utilise précisément :
- `mistral:latest`
- `deepseek-r1:latest`

## Démarrage de l'application

Une fois `.env` complété :

```powershell
npm start
```

Puis ouvrir :

- `http://localhost:3000/frontend/account.html`

## Contrôles après installation

Vérifier dans cet ordre :

1. la page d'accueil s'ouvre
2. la page `account.html` s'ouvre
3. l'application démarre sans erreur Node
4. la base SQLite locale se crée
5. la connexion utilisateur fonctionne
6. la création de mail fonctionne
7. la génération avec pièce jointe `txt` fonctionne
8. la génération avec pièce jointe `docx` fonctionne
9. la génération avec pièce jointe `pdf` fonctionne
10. la connexion Gmail OAuth fonctionne

## Données locales créées

La base locale est créée ici :

```text
backend\data\agent-mail-assistant.db
```

Ce fichier fait partie des éléments à sauvegarder.

## Limites actuelles

Le script automatise l'installation applicative, mais il n'installe pas automatiquement :
- Node.js
- Python
- Ollama

Ce choix est volontaire pour éviter :
- des installations système non maîtrisées
- des droits administrateur imprévus
- des effets de bord sur le poste Windows

## Remarque importante

Ce document et le script ont été préparés depuis macOS, à partir du projet réel.  
Ils sont prêts pour test sur Windows, mais la validation finale doit être faite sur un **poste Windows réel**.

## Reprise prévue

Lors de la reprise sur Windows, il faudra :

1. exécuter le script sur un vrai poste Windows
2. vérifier le comportement PowerShell réel
3. corriger si nécessaire les détails spécifiques au poste
4. valider ensuite la procédure utilisateur finale
