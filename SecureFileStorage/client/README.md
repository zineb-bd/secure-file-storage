# SecureDocs — Frontend React

Interface utilisateur **React 19 + TypeScript + Vite** pour le microservice SecureFileStorage.

## Développement

1. Démarrer l'API ASP.NET Core (port **5001** par défaut) :
   ```bash
   cd ../src/SecureFileStorage.Api
   dotnet run
   ```

2. Démarrer le frontend en mode dev (port **5173**, proxy API automatique) :
   ```bash
   npm install
   npm run dev
   ```

3. Ouvrir [http://localhost:5173](http://localhost:5173)

Compte admin par défaut : `admin@entreprise.local` / `Admin123!`

## Production

Le build génère les fichiers statiques dans `../src/SecureFileStorage.Api/wwwroot` :

```bash
npm run build
```

Puis lancer l'API — elle sert le SPA React et redirige les routes vers `index.html`.

## Structure

```
src/
├── api/           # Client HTTP (JWT)
├── components/    # Layout, documents, modales
├── context/       # Auth, thème
├── i18n/          # Traductions FR/EN
├── pages/         # Routes de l'application
├── styles/        # Design system (app.css)
└── types/         # Types TypeScript API
```

## Traductions

Pour resynchroniser les clés i18n depuis l'ancien `i18n.js` :

```bash
npm run i18n:extract
```
