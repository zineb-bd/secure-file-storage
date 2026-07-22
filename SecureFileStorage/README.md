# Microservice de stockage et de lecture sécurisée des fichiers

Microservice **ASP.NET Core 8** qui centralise le stockage, la consultation et la gestion sécurisée des documents d'entreprise.

## Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| Téléversement sécurisé | Chiffrement AES-256 au repos, scan antivirus, hash SHA-256 |
| Lecture / téléchargement | Contrôle d'accès RBAC par document |
| Métadonnées | Nom, type, taille, propriétaire, catégorie, dates |
| Versioning | Conservation de toutes les versions |
| Prévisualisation | PDF, images, documents Office |
| Partage sécurisé | Partage utilisateur, liens temporaires, expiration, révocation |
| Audit | Traçabilité des opérations sur les documents (export CSV) |
| Suppression logique | Archivage et restauration |
| API REST | JWT/OAuth2, Swagger |

## Architecture

```
SecureFileStorage/
├── src/
│   ├── SecureFileStorage.Api/           # Contrôleurs REST, JWT, Swagger
│   ├── SecureFileStorage.Application/   # DTOs, interfaces
│   ├── SecureFileStorage.Domain/        # Entités métier
│   └── SecureFileStorage.Infrastructure/# EF Core, chiffrement, stockage
├── docker-compose.yml
└── Dockerfile
```

## Prérequis

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- PostgreSQL 16 (ou SQL Server)
- Docker (optionnel, pour PostgreSQL + ClamAV)

## Démarrage rapide

### 1. Installer le SDK .NET 8

```powershell
winget install Microsoft.DotNet.SDK.8
```

### 2. Lancer PostgreSQL avec Docker

```powershell
docker compose up postgres -d
```

### 3. Configurer et lancer l'API

```powershell
cd SecureFileStorage
dotnet restore
dotnet run --project src/SecureFileStorage.Api
```

L'API est disponible sur `https://localhost:7001/swagger`.

### Compte administrateur par défaut

| Champ | Valeur |
|---|---|
| Email | `admin@entreprise.local` |
| Mot de passe | `Admin123!` |

## Endpoints principaux

### Authentification
- `POST /api/auth/login` — Connexion (JWT)
- `POST /api/auth/register` — Inscription

### Documents (authentifié)
- `POST /api/documents` — Téléverser un fichier
- `POST /api/documents/{id}/share/user` — Partager avec un utilisateur (lecture / téléchargement / modification)
- `POST /api/documents/{id}/share/link` — Générer un lien sécurisé temporaire
- `GET /api/documents/{id}/shares` — Lister les partages actifs
- `DELETE /api/documents/{id}/share/link/{linkId}` — Révoquer un lien
- `GET /api/share/{token}/info` — Consulter un partage par lien (public)
- `GET /api/share/{token}/preview` — Prévisualiser via lien (public)
- `GET /api/share/{token}/download` — Télécharger via lien (public)
- `GET /api/documents` — Rechercher
- `GET /api/documents/{id}` — Détails
- `GET /api/documents/{id}/download` — Télécharger
- `GET /api/documents/{id}/preview` — Prévisualiser
- `GET /api/documents/{id}/versions` — Historique des versions
- `PUT /api/documents/{id}` — Nouvelle version
- `POST /api/documents/{id}/archive` — Archiver
- `POST /api/documents/{id}/restore` — Restaurer
- `DELETE /api/documents/{id}` — Suppression logique
- `GET /api/documents/{id}/integrity` — Vérifier l'intégrité SHA-256

### Administration (rôle Admin)
- `GET/POST/PUT/DELETE /api/admin/users` — Gestion utilisateurs
- `GET/POST/PUT/DELETE /api/admin/roles` — Gestion rôles
- `GET/PUT /api/admin/storage` — Configuration stockage
- `GET /api/admin/audit` — Traçabilité des documents
- `GET /api/admin/audit/export` — Export CSV de la traçabilité documentaire
- `POST /api/admin/security/rotate-key` — Rotation clé de chiffrement
- `GET /api/admin/security/antivirus-alerts` — Alertes antivirus

## Exemple d'utilisation

```powershell
# 1. Connexion
$login = Invoke-RestMethod -Method POST -Uri "http://localhost:5001/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"admin@entreprise.local","password":"Admin123!"}'

$headers = @{ Authorization = "Bearer $($login.token)" }

# 2. Téléverser un document
$form = @{
  file = Get-Item -Path ".\contrat.pdf"
  category = "RH"
  description = "Contrat de travail"
}
Invoke-RestMethod -Method POST -Uri "http://localhost:5001/api/documents" `
  -Headers $headers -Form $form
```

## Sécurité

- **JWT** : Authentification par token Bearer
- **RBAC** : Rôles Admin, Manager, User + permissions par document
- **AES-256** : Chiffrement au repos avec clé par fichier
- **SHA-256** : Empreinte d'intégrité vérifiable
- **ClamAV** : Scan antivirus avant stockage (activable via config)
- **Audit** : Traçabilité des opérations sur les documents uniquement

## Configuration

Modifier `src/SecureFileStorage.Api/appsettings.json` :

```json
{
  "Jwt": { "Secret": "votre-cle-secrete-32-caracteres-minimum" },
  "Encryption": { "MasterKey": "votre-cle-maitre" },
  "Database": {
    "Provider": "PostgreSql",
    "ConnectionString": "Host=localhost;..."
  },
  "Antivirus": { "Enabled": true, "ClamAvHost": "localhost" }
}
```

Pour SQL Server, changer `Provider` en `"SqlServer"` et adapter la chaîne de connexion.

## Correspondance avec les diagrammes UML

Les cas d'utilisation des diagrammes (Administrateur, Utilisateur, Application Cliente) sont couverts par :

- **Utilisateur** → endpoints `/api/documents` et `/api/auth`
- **Administrateur** → endpoints `/api/admin/*`
- **Application cliente** → intégration via l'API REST JWT

## Licence

Projet académique — libre d'utilisation.
