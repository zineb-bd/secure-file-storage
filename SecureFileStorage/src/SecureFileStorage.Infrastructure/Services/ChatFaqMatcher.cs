using System.Globalization;
using System.Text;

namespace SecureFileStorage.Infrastructure.Services;

/// <summary>
/// FAQ locale côté serveur pour répondre même sans clé IA.
/// </summary>
public static class ChatFaqMatcher
{
    private sealed record Entry(string Intent, string[] Keywords, string ReplyFr, string ReplyEn);

    private static readonly Entry[] Entries =
    [
        new("greeting",
            ["bonjour", "hello", "hi", "salut", "hey", "bonsoir", "merci", "thanks"],
            "Bonjour ! Je suis l'assistant SecureDocs. Posez-moi une question sur le téléversement, le partage, l'archive, la corbeille ou la sécurité.",
            "Hello! I'm the SecureDocs assistant. Ask me about uploading, sharing, archives, trash, or security."),
        new("help",
            ["aide", "help", "assistance", "comment utiliser", "fonctionnalit", "features", "que peux"],
            "Je peux vous guider sur : téléversement, documents, partage, catégories, archive, corbeille, profil, tableau de bord, et (admin) utilisateurs, rôles, audit, configuration.",
            "I can guide you on: upload, documents, sharing, categories, archive, trash, profile, dashboard, and (admin) users, roles, audit, settings."),
        new("upload",
            ["upload", "uploader", "téléverser", "televerser", "importer", "déposer", "deposer", "envoyer fichier", "ajouter un fichier", "nouveau document"],
            "Pour téléverser un fichier : ouvrez Documents → Téléverser (ou le bouton Upload). Glissez-déposez le fichier, renseignez éventuellement la catégorie, puis validez. Le fichier est chiffré avant stockage.",
            "To upload: open Documents → Upload. Drag and drop the file, optionally set a category, then confirm. The file is encrypted before storage."),
        new("documents",
            ["document", "documents", "fichier", "fichiers", "télécharger", "telecharger", "download", "prévisualiser", "preview", "rechercher"],
            "Vos documents actifs sont dans le menu Documents. Vous pouvez rechercher, prévisualiser, télécharger, partager ou archiver. Les fichiers reçus sont sous Partagés.",
            "Your active documents are under Documents. You can search, preview, download, share, or archive. Shared files appear under Shared."),
        new("share",
            ["partag", "share", "shared", "lien", "inviter", "collabor"],
            "Pour partager : ouvrez un document, invitez un utilisateur avec un niveau d'accès ou créez un lien. Les documents reçus apparaissent dans Partagés.",
            "To share: open a document, invite a user with an access level, or create a link. Received files appear under Shared."),
        new("categories",
            ["catégorie", "categorie", "categories", "category", "classer", "organiser"],
            "Les catégories organisent vos documents. Attribuez-en une à l'upload ou dans les métadonnées, puis filtrez depuis Catégories.",
            "Categories organize documents. Set one on upload or in metadata, then filter from Categories."),
        new("archive",
            ["archiv", "archive", "archived"],
            "Archiver retire un document de la liste active sans le supprimer. Retrouvez-le dans Archivés, puis restaurez-le si besoin.",
            "Archiving removes a document from the active list without deleting it. Find it under Archived, then restore when needed."),
        new("trash",
            ["corbeille", "trash", "supprim", "delete", "restaurer", "restore", "vider"],
            "La Corbeille contient les documents supprimés. Vous pouvez les restaurer ou les supprimer définitivement. Vider la corbeille est irréversible.",
            "Trash holds deleted documents. You can restore them or permanently delete them. Emptying trash is irreversible."),
        new("profile",
            ["profil", "profile", "mot de passe", "password", "avatar", "mon compte"],
            "Dans Profil, mettez à jour vos informations, changez votre mot de passe et gérez vos préférences (thème, langue, avatar).",
            "In Profile, update your details, change your password, and manage preferences (theme, language, avatar)."),
        new("dashboard",
            ["tableau de bord", "dashboard", "statistique", "accueil"],
            "Le tableau de bord résume votre activité : nombre de documents, stockage, éléments récents et accès rapides.",
            "The dashboard summarizes your activity: document count, storage, recent items, and quick actions."),
        new("roles",
            ["rôle", "role", "roles", "droits"],
            "Les administrateurs gèrent les rôles dans Admin → Rôles (création, description, permissions).",
            "Administrators manage roles under Admin → Roles (create, describe, assign permissions)."),
        new("users",
            ["utilisateur", "utilisateurs", "users", "gestion users"],
            "Les administrateurs gèrent les comptes dans Admin → Utilisateurs (création, activation, rôles).",
            "Administrators manage accounts under Admin → Users (create, activate, assign roles)."),
        new("audit",
            ["audit", "traçabilité", "tracabilite", "journal"],
            "L'audit (Admin → Audit) journalise les actions importantes pour la traçabilité (connexion, upload, partage, suppression…).",
            "Audit (Admin → Audit) logs important actions for traceability (login, upload, share, delete…)."),
        new("config",
            ["configuration", "paramètre système", "parametre systeme", "settings", "antivirus"],
            "La configuration système (Admin → Configuration) permet d'ajuster le stockage et les options de la plateforme.",
            "System configuration (Admin → Config) lets you adjust storage and platform options."),
        new("security",
            ["sécurité", "securite", "security", "chiffrement", "encrypt", "intégrité", "integrite", "jwt"],
            "SecureDocs chiffre les fichiers avant stockage, contrôle l'accès par rôles/permissions et peut vérifier l'intégrité. Les sessions sont protégées par JWT.",
            "SecureDocs encrypts files before storage, enforces role-based access, and can verify integrity. Sessions are protected with JWT.")
    ];

    public static (string Reply, string Intent)? TryMatch(string message, string? locale)
    {
        var normalized = Normalize(message);
        if (string.IsNullOrWhiteSpace(normalized)) return null;

        Entry? best = null;
        var bestScore = 0;

        foreach (var entry in Entries)
        {
            var score = 0;
            foreach (var kw in entry.Keywords)
            {
                var needle = Normalize(kw);
                if (needle.Length > 0 && normalized.Contains(needle, StringComparison.Ordinal))
                    score += Math.Max(1, needle.Length / 4);
            }

            if (score > bestScore)
            {
                bestScore = score;
                best = entry;
            }
        }

        if (best is null || bestScore <= 0) return null;

        var isEn = !string.IsNullOrWhiteSpace(locale) && locale.StartsWith("en", StringComparison.OrdinalIgnoreCase);
        return (isEn ? best.ReplyEn : best.ReplyFr, best.Intent);
    }

    private static string Normalize(string text)
    {
        var form = text.ToLowerInvariant().Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(form.Length);
        foreach (var c in form)
        {
            if (CharUnicodeInfo.GetUnicodeCategory(c) != UnicodeCategory.NonSpacingMark)
                sb.Append(c);
        }
        return sb.ToString().Normalize(NormalizationForm.FormC).Trim();
    }
}
