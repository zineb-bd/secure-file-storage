# Déploiement SecureDocs — Vercel (frontend) + Render (API, gratuit)

Vercel n'héberge **pas** ASP.NET Core ni PostgreSQL.
Architecture recommandée (gratuit) : frontend React sur Vercel, API + Postgres sur Render.

```
Utilisateur → https://votre-app.vercel.app
                    │
                    │  VITE_API_BASE_URL
                    ▼
           https://securedocs-api.onrender.com  (+ Postgres free)
```

> Railway n'offre plus de plan gratuit durable (essai puis Hobby payant).
> Le fichier `render.yaml` à la racine du dépôt définit l'API + la base.

### Limites du plan free Render
- L'API s'endort après ~15 min d'inactivité (cold start 30–60 s).
- Disque **éphémère** (fichiers uploadés perdus au redémarrage).
- Postgres free expire ~30 jours (renouveler ou migrer vers Neon).

---

## 1. Backend sur Render (gratuit)

### Prérequis
- Compte [Render](https://dashboard.render.com)
- Repo GitHub poussé (contient `render.yaml` + `SecureFileStorage/Dockerfile`)

### Étapes (Blueprint)
1. Dashboard → **New** → **Blueprint**.
2. Connecter le repo `secure-file-storage`.
3. Render lit [`render.yaml`](../render.yaml) → crée `securedocs-api` + `securedocs-db`.
4. Apply → attendre le build Docker (plusieurs minutes).
5. Noter l'URL du service, ex. `https://securedocs-api.onrender.com`.
6. Tester : `GET https://…/health` → `{ "status": "healthy", … }`.

### Compte admin initial
Après le premier démarrage (seed) :
- Email : `admin@entreprise.local`
- Mot de passe : `Admin123!`  
**Changez-le immédiatement** en production.

### Alternative payante : Railway
Voir aussi [`Dockerfile`](Dockerfile), [`railway.toml`](railway.toml) et [`.env.railway.example`](.env.railway.example) si vous passez au plan Hobby Railway.

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
| `VITE_API_BASE_URL` | `https://securedocs-api.onrender.com` (sans slash final) |

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

- [ ] `/health` OK sur Render
- [ ] Login depuis l'URL Vercel
- [ ] Upload d'un document (attention : disque éphémère en free)
- [ ] Favoris / collaboration
- [ ] Dashboard admin (maturité)
- [ ] Mot de passe admin changé

---

## Dépannage

| Problème | Cause probable |
|---|---|
| Login / API en erreur CORS ou réseau | `VITE_API_BASE_URL` absente, incorrecte, ou rebuild Vercel non refait après ajout de la variable |
| 500 au démarrage API | `Database__ConnectionString` invalide / SSL |
| Premier appel très lent | Cold start Render free (~30–60 s) |
| Upload OK puis fichiers perdus | Disque éphémère (pas de volume persistant en free) |
| Page blanche sur refresh Vercel | Vérifier `vercel.json` (rewrites vers `index.html`) |
