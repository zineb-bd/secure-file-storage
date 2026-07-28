# Déploiement SecureDocs — Vercel (frontend) + Railway (API)

Vercel n'héberge **pas** ASP.NET Core ni PostgreSQL.
Architecture : frontend React sur Vercel, API + base sur Railway.

```
Utilisateur → https://votre-app.vercel.app
                    │
                    │  VITE_API_BASE_URL
                    ▼
           https://votre-api.up.railway.app  (+ Postgres + volume /app/storage)
```

---

## 1. Backend sur Railway

### Prérequis
- Compte [Railway](https://railway.app)
- Repo Git poussé (dossier `SecureFileStorage` = racine Docker)

### Étapes
1. **New Project** → **Deploy from GitHub** (ou CLI).
2. **Root Directory** du service API : `SecureFileStorage` (si le repo contient ce dossier).
3. Railway détecte [`Dockerfile`](Dockerfile) + [`railway.toml`](railway.toml).
4. Ajouter un plugin **PostgreSQL**.
5. Sur le service API, variables (voir aussi [`.env.railway.example`](.env.railway.example)) :

| Variable | Valeur |
|---|---|
| `Database__Provider` | `PostgreSql` |
| `Database__ConnectionString` | Connection string Npgsql du Postgres Railway (`SSL Mode=Require` souvent requis) |
| `Jwt__Secret` | Chaîne aléatoire ≥ 32 caractères |
| `Encryption__MasterKey` | Chaîne aléatoire forte |
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `Storage__BasePath` | `/app/storage` |
| `Antivirus__Enabled` | `false` |

6. Attacher un **Volume** au service API, mount path : `/app/storage`.
7. **Generate Domain** sur le service API → noter l'URL, ex. `https://securedocs-api.up.railway.app`.
8. Tester : `GET https://…/health` → `{ "status": "healthy", … }`.

### Compte admin initial
Après le premier démarrage (seed) :
- Email : `admin@entreprise.local`
- Mot de passe : `Admin123!`  
**Changez-le immédiatement** en production.

---

## 2. Frontend sur Vercel

### Prérequis
- Compte [Vercel](https://vercel.com)
- Même repo Git

### Étapes
1. **Add New Project** → importer le repo.
2. **Root Directory** : `SecureFileStorage/client`
3. Framework : Vite (détecté automatiquement).
4. Build Command : `npm run build`
5. Output Directory : `dist`
6. Install Command : `npm install`
7. Environment Variable :

| Name | Value |
|---|---|
| `VITE_API_BASE_URL` | `https://votre-api.up.railway.app` (sans slash final) |

8. Deploy → URL du type `https://securedocs.vercel.app`.

Le fichier [`vercel.json`](client/vercel.json) gère le routing SPA (React Router).

### Local après ce changement
```powershell
cd SecureFileStorage/client
npm run dev
```
Laisser `VITE_API_BASE_URL` vide (ou `.env` local vide) : le proxy Vite vers `http://localhost:5001` reste actif.

Pour republier le frontend dans `wwwroot` de l'API (mode tout-en-un local) :
```powershell
npm run build:api
```

---

## 3. Checklist de validation

- [ ] `/health` OK sur Railway
- [ ] Login depuis l'URL Vercel
- [ ] Upload d'un document
- [ ] Favoris / collaboration
- [ ] Dashboard admin (maturité)
- [ ] Mot de passe admin changé
- [ ] Secrets JWT / chiffrement distincts de ceux du développement

---

## Dépannage

| Problème | Cause probable |
|---|---|
| Login / API en erreur CORS ou réseau | `VITE_API_BASE_URL` absente, incorrecte, ou rebuild Vercel non refait après ajout de la variable |
| 500 au démarrage API | `Database__ConnectionString` invalide / SSL |
| Upload OK puis fichiers perdus | Volume `/app/storage` non monté |
| Page blanche sur refresh Vercel | Vérifier `vercel.json` (rewrites vers `index.html`) |
