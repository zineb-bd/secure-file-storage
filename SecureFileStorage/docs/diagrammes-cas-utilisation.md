# Diagrammes de cas d’utilisation — SecureFileStorage

Système : **microservice de stockage et de lecture sécurisée des fichiers**.

Acteurs principaux : **Utilisateur** (`User`) et **Administrateur** (`Admin`).

Fichiers PlantUML associés :
- [`usecase-utilisateur.puml`](./usecase-utilisateur.puml)
- [`usecase-administrateur.puml`](./usecase-administrateur.puml)

---

## 1. Diagramme — Utilisateur

```mermaid
flowchart LR
  User((Utilisateur))

  subgraph SYS["SecureFileStorage"]
    subgraph AUTH["Authentification & compte"]
      UC1([S'inscrire])
      UC2([Se connecter])
      UC3([Se déconnecter])
      UC4([Gérer mon profil])
      UC5([Changer mon mot de passe])
    end

    subgraph DOCS["Gestion des documents"]
      UC6([Téléverser un document])
      UC7([Importer depuis une URL])
      UC8([Rechercher / lister])
      UC9([Consulter])
      UC10([Prévisualiser])
      UC11([Télécharger])
      UC12([Nouvelle version])
      UC13([Historique des versions])
      UC14([Restaurer une version])
      UC15([Vérifier intégrité SHA-256])
      UC16([Archiver / restaurer])
      UC17([Mettre à la corbeille])
      UC18([Vider ma corbeille])
      UC19([Check-out / Check-in])
      UC20([Gérer les favoris])
      UC21([Gérer les catégories])
    end

    subgraph SHARE["Partage & collaboration"]
      UC22([Partager avec un utilisateur])
      UC23([Générer un lien sécurisé])
      UC24([Révoquer partage / lien])
      UC25([Gérer les permissions])
      UC26([Voir partagés avec moi])
    end

    subgraph HELP["Tableau de bord & aide"]
      UC27([Consulter mon tableau de bord])
      UC28([Utiliser le chatbot d'aide])
    end

    INC1([Valider fichier])
    INC2([Scanner antivirus])
    INC3([Chiffrer AES-256])
    INC3b([Compresser GZip])
    INC3c([Déchiffrer + décompresser])
    INC4([Journaliser audit])
  end

  User --> UC1 & UC2 & UC3 & UC4 & UC5
  User --> UC6 & UC7 & UC8 & UC9 & UC10 & UC11
  User --> UC12 & UC13 & UC14 & UC15 & UC16 & UC17 & UC18 & UC19 & UC20 & UC21
  User --> UC22 & UC23 & UC24 & UC25 & UC26
  User --> UC27 & UC28

  UC6 -.->|include| INC1
  UC6 -.->|include| INC2
  UC6 -.->|include| INC3b
  UC6 -.->|include| INC3
  UC6 -.->|include| INC4
  UC10 -.->|include| INC3c
  UC11 -.->|include| INC3c
  UC11 -.->|include| INC4
  UC12 -.->|include| INC1
  UC12 -.->|include| INC2
  UC12 -.->|include| INC3b
  UC12 -.->|include| INC3
  UC12 -.->|include| INC4
```

### Liste des cas d’utilisation Utilisateur

| Package | Cas d’utilisation |
|---|---|
| Authentification | S’inscrire, Se connecter, Se déconnecter, Gérer mon profil, Changer mon mot de passe |
| Documents | Téléverser, Importer URL, Rechercher, Consulter, Prévisualiser, Télécharger, Versionner, Historique, Restaurer version, Vérifier intégrité, Archiver, Corbeille, Check-out/in, Favoris, Catégories |
| Partage | Partager (utilisateur), Lien sécurisé, Révoquer, Permissions, Partagés avec moi |
| Aide | Tableau de bord, Chatbot |

**Relations `<<include>>`** : téléversement / nouvelle version = validation → antivirus → compression GZip → chiffrement AES-256 → audit. Téléchargement / prévisualisation = déchiffrement + décompression.

---

## 2. Diagramme — Administrateur

```mermaid
flowchart LR
  Admin((Administrateur))
  User((Utilisateur))

  Admin -->|généralisation| User

  subgraph SYS["SecureFileStorage"]
    subgraph INHERIT["Capacités héritées"]
      UC0([Toutes les UC Utilisateur])
    end

    subgraph USERS["Gestion des utilisateurs"]
      A1([Lister les utilisateurs])
      A2([Créer un utilisateur])
      A3([Modifier un utilisateur])
      A4([Désactiver un utilisateur])
      A5([Supprimer un utilisateur])
      A6([Réinitialiser un mot de passe])
    end

    subgraph ROLES["Gestion des rôles"]
      A7([Consulter les rôles])
      A8([Affecter un rôle])
      A9([Modifier description d'un rôle])
    end

    subgraph DOCS["Administration documentaire"]
      A10([Voir / gérer tous les documents])
      A11([Suppression définitive])
      A12([Vider toute la corbeille])
      A13([Changer le propriétaire])
    end

    subgraph SEC["Stockage & sécurité"]
      A14([Configurer le stockage Local/S3/NAS])
      A15([Rotation clé de chiffrement])
      A16([Consulter alertes antivirus])
    end

    subgraph AUDIT["Audit & supervision"]
      A17([Consulter les journaux d'audit])
      A18([Rechercher dans l'audit])
      A19([Exporter l'audit CSV])
      A20([Tableau de bord admin / maturité])
    end
  end

  Admin --> UC0
  Admin --> A1 & A2 & A3 & A4 & A5 & A6
  Admin --> A7 & A8 & A9
  Admin --> A10 & A11 & A12 & A13
  Admin --> A14 & A15 & A16
  Admin --> A17 & A18 & A19 & A20
```

### Liste des cas d’utilisation Administrateur

| Package | Cas d’utilisation |
|---|---|
| Héritage | Toutes les UC de l’Utilisateur |
| Utilisateurs | Lister, Créer, Modifier, Désactiver, Supprimer, Réinitialiser mot de passe |
| Rôles | Consulter, Affecter, Modifier description |
| Documents (étendue) | Voir tous les documents, Suppression définitive, Vider toute la corbeille, Changer propriétaire |
| Sécurité | Configurer stockage, Rotation clé, Alertes antivirus |
| Audit | Consulter, Rechercher, Exporter CSV, Dashboard maturité |

**Relation de généralisation** : `Administrateur` hérite de `Utilisateur` (l’admin peut tout faire qu’un user, plus l’administration).

---

## Correspondance API (rappel)

| Acteur | Endpoints |
|---|---|
| Utilisateur | `/api/auth/*`, `/api/documents/*`, `/api/share/*`, `/api/chat`, dashboard |
| Administrateur | `/api/admin/users`, `/api/admin/roles`, `/api/admin/storage`, `/api/admin/audit`, `/api/admin/security/*` |
```
