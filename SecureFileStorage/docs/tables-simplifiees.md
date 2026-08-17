# Modèle de données simplifié — SecureFileStorage

Tables **simples**, **cohérentes**, avec **toutes les informations métier**.  
(Les noms techniques anglais du code sont indiqués entre parenthèses.)

---

## Mode de stockage des fichiers

Le microservice **ne stocke pas** le contenu des fichiers en base de données (pas de BLOB / BYTEA SQL).

| Aspect | Choix retenu |
|---|---|
| **Mode** | **Stockage physique** (fichier binaire sur disque) |
| **Ce qui n’est pas utilisé** | BLOB / BYTEA en PostgreSQL |
| **Format sur disque** | Fichier binaire chiffré AES-256 (extension `.enc`) |
| **Emplacement** | `{BasePath}/blobs/{SHA-256}.enc` (défaut : `./storage`) |
| **Base de données** | Métadonnées uniquement (nom, hash, chemin, clé, droits…) |
| **Fournisseur actuel** | Système de fichiers local (`LocalFileSystem`) |
| **Évolutivité** | S3-compatible ou NAS (configurables, même principe : objet fichier, pas BLOB SQL) |

**Séparation contenu / métadonnées :**

```
Écriture :
  Fichier utilisateur
    → validation + scan antivirus
    → compression GZip (si gain)
    → chiffrement AES-256
    → fichier physique  :  ./storage/blobs/{empreinte}.enc

Lecture :
  fichier .enc
    → déchiffrement AES-256 (clé par fichier)
    → décompression GZip
    → document original
```

**Pourquoi ce choix (et pas un BLOB SQL) :**
- la base reste légère (requêtes, sauvegardes, index) ;
- le contenu binaire est lu/écrit en flux (`FileStream`) ;
- déduplication : un même contenu (même SHA-256) n’est écrit qu’une fois sur disque ;
- le chiffrement au repos s’applique au fichier, pas à une colonne SQL.

> Le nom technique `StoredBlob` désigne une **référence logique** au fichier physique (chemin + hash + clé). Ce n’est **pas** un type BLOB SQL.

---

## 1. Utilisateur
*(User + Role)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| Email | Texte | Adresse email (connexion) |
| MotDePasse | Texte | Mot de passe hashé |
| Prenom | Texte | Prénom |
| Nom | Texte | Nom de famille |
| Role | Texte | `Admin` ou `User` |
| Actif | Booléen | Compte activé ou non |
| DateCreation | DateTime | Date d’inscription |
| DateMiseAJour | DateTime? | Dernière modification |

> Un utilisateur a **un rôle** (Admin / User). Pas besoin d’une table d’association séparée pour le modèle simplifié.

---

## 2. Document
*(Document)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| NomFichier | Texte | Nom du fichier |
| TypeContenu | Texte | MIME (pdf, image…) |
| Taille | Long | Taille en octets |
| Categorie | Texte | Catégorie métier |
| Description | Texte | Description |
| Empreinte | Texte | Hash SHA-256 |
| VersionCourante | Entier | Numéro de version actuelle |
| Statut | Enum | Actif / Archivé / Supprimé |
| Visibilite | Enum | Privé / Partagé / Public |
| ProprietaireId | Guid | Réf. → Utilisateur |
| VerrouilleParId | Guid? | Réf. → Utilisateur (check-out) |
| DateVerrouillage | DateTime? | Début du verrou |
| ExpirationVerrou | DateTime? | Fin du verrou |
| ResultatAntivirus | Enum | Sain / Infecté / Ignoré / Erreur |
| DateScan | DateTime? | Dernier scan antivirus |
| DateCreation | DateTime | Date d’ajout |
| DateMiseAJour | DateTime? | Dernière modification |
| DateArchivage | DateTime? | Si archivé |
| DateSuppression | DateTime? | Si mis à la corbeille |

> **Règle d’association** : les relations entre domaines/services sont transmises et stockées par identifiant (`…Id`), jamais par objet complet. Exemple : `Document.OwnerId` (`OWNER_ID`) référence `User.Id`. Les propriétés comme `Owner` ne sont que des navigations ORM internes.

---

## 3. Version
*(DocumentVersion + StoredBlob)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| DocumentId | Guid | Réf. → Document |
| Numero | Entier | N° de version (1, 2, 3…) |
| CheminStockage | Texte | Chemin relatif du **fichier physique** chiffré (ex. `blobs/{hash}.enc`) |
| CleChiffrement | Texte | Clé AES-256 chiffrée |
| Empreinte | Texte | Hash SHA-256 du contenu en clair |
| Taille | Long | Taille en octets (fichier en clair) |
| DeposeParId | Guid | Réf. → Utilisateur |
| Commentaire | Texte? | Motif de la nouvelle version |
| DateCreation | DateTime | Date du dépôt |

> Le contenu binaire n’est **pas** dans cette table. `CheminStockage` pointe vers le fichier physique. Le nom `StoredBlob` = référence au fichier, **pas** un BLOB SQL.

---

## 4. Partage
*(DocumentPermission)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| DocumentId | Guid | Réf. → Document |
| UtilisateurId | Guid | Utilisateur qui reçoit l’accès |
| Permission | Enum | Lecture / Écriture / Suppression / Admin |
| NiveauAcces | Enum | Lecture / Téléchargement / Écriture / Aperçu |
| ExpireLe | DateTime? | Date de fin du partage |
| AccordeParId | Guid | Qui a donné le droit |
| DateOctroi | DateTime | Date du partage |

---

## 5. LienPartage
*(DocumentShareLink)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| DocumentId | Guid | Réf. → Document |
| Jeton | Texte | Token sécurisé (hash) |
| NiveauAcces | Enum | Lecture / Téléchargement / Écriture / Aperçu |
| ExpireLe | DateTime | Expiration du lien |
| CreeParId | Guid | Réf. → Utilisateur |
| DateCreation | DateTime | Date de création |
| Revoque | Booléen | Lien annulé ou non |

---

## 6. Favori
*(DocumentFavorite)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| UtilisateurId | Guid | Réf. → Utilisateur |
| DocumentId | Guid | Réf. → Document |
| DateAjout | DateTime | Date d’ajout aux favoris |

---

## 7. JournalAudit
*(AuditLog)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| UtilisateurId | Guid? | Qui a fait l’action |
| Action | Enum | Téléverser, Télécharger, Partager, Connexion… |
| TypeRessource | Texte | Ex. : Document, Utilisateur |
| RessourceId | Guid? | Id de la ressource concernée |
| Details | Texte | Description de l’opération |
| AdresseIP | Texte | IP de l’utilisateur |
| Succes | Booléen | Opération réussie ou non |
| DateHeure | DateTime | Horodatage |

---

## 8. AlerteAntivirus
*(AntivirusAlert)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| DocumentId | Guid? | Document concerné |
| NomFichier | Texte | Nom du fichier suspect |
| NomMenace | Texte | Virus / malware détecté |
| Details | Texte | Informations complémentaires |
| DateDetection | DateTime | Date de l’alerte |
| Resolue | Booléen | Traîtée ou non |

---

## 9. Configuration
*(StorageConfiguration + EncryptionKeyRecord)*

| Attribut | Type | Description |
|---|---|---|
| Id | Guid | Identifiant unique |
| TypeStockage | Enum | Local / S3 / NAS |
| TypeBaseDonnees | Enum | PostgreSQL / SQL Server |
| CheminBase | Texte | Chemin du stockage local |
| S3Endpoint | Texte? | URL S3 |
| S3Bucket | Texte? | Nom du bucket |
| S3AccessKey | Texte? | Clé d’accès |
| S3SecretKey | Texte? | Clé secrète |
| CleMaitreChiffrement | Texte | Clé maître AES (chiffrée) |
| IdentifiantCle | Texte | Référence de la clé |
| Actif | Booléen | Config active |
| DateMiseAJour | DateTime | Dernière modification |
| DateRotationCle | DateTime? | Dernière rotation de clé |

> Stockage + sécurité regroupés dans **une seule table de configuration**.

---

## Schéma des liens (simple)

```
Utilisateur 1 ──── * Document          (propriétaire)
Utilisateur 1 ──── * Version           (déposant)
Utilisateur 1 ──── * Partage           (bénéficiaire)
Utilisateur 1 ──── * Favori
Utilisateur 1 ──── * JournalAudit

Document    1 ──── * Version
Document    1 ──── * Partage
Document    1 ──── * LienPartage
Document    1 ──── * Favori
Document    1 ──── * AlerteAntivirus
```

---

## Résumé

| # | Table | Rôle |
|---|---|---|
| 1 | **Utilisateur** | Comptes + rôle |
| 2 | **Document** | Fichier + métadonnées + statut |
| 3 | **Version** | Historique + **chemin** du fichier physique chiffré |
| 4 | **Partage** | Droits entre utilisateurs |
| 5 | **LienPartage** | Lien temporaire |
| 6 | **Favori** | Favoris |
| 7 | **JournalAudit** | Traçabilité |
| 8 | **AlerteAntivirus** | Sécurité antivirus |
| 9 | **Configuration** | Stockage + clés (admin) |

**9 tables** au lieu de 13 — mêmes informations, modèle plus clair pour le rapport.

Le **contenu binaire** n’apparaît dans aucune table : il est stocké **physiquement** sur disque (`./storage/blobs/{SHA-256}.enc`).
