using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace SecureFileStorage.Api.Swagger;

public class FrenchSchemaFilter : ISchemaFilter
{
    private static readonly Dictionary<string, string> Champs = new(StringComparer.OrdinalIgnoreCase)
    {
        ["email"] = "Adresse e-mail",
        ["password"] = "Mot de passe",
        ["token"] = "Jeton d'accès JWT",
        ["fullName"] = "Nom complet",
        ["firstName"] = "Prénom",
        ["lastName"] = "Nom de famille",
        ["roles"] = "Rôles de l'utilisateur",
        ["expiresAt"] = "Date d'expiration du jeton",
        ["fileName"] = "Nom du fichier",
        ["contentType"] = "Type MIME (ex. application/pdf)",
        ["sizeBytes"] = "Taille en octets",
        ["category"] = "Catégorie (ex. RH, Factures)",
        ["description"] = "Description du document",
        ["sha256Hash"] = "Empreinte SHA-256 (intégrité)",
        ["currentVersion"] = "Numéro de version actuelle",
        ["status"] = "Statut (Actif, Archivé, Supprimé)",
        ["ownerId"] = "Identifiant du propriétaire",
        ["ownerName"] = "Nom du propriétaire",
        ["createdAt"] = "Date de création",
        ["updatedAt"] = "Date de modification",
        ["page"] = "Numéro de page",
        ["pageSize"] = "Nombre d'éléments par page",
        ["totalCount"] = "Nombre total de résultats",
        ["items"] = "Liste des éléments",
        ["userId"] = "Identifiant utilisateur",
        ["permission"] = "Permission (Read, Write, Delete, Admin)",
        ["newPassword"] = "Nouveau mot de passe",
        ["isActive"] = "Compte actif ou non",
        ["name"] = "Nom",
        ["roleNames"] = "Liste des noms de rôles",
        ["version"] = "Numéro de version (optionnel)",
        ["file"] = "Fichier à téléverser",
        ["changeComment"] = "Commentaire sur la modification",
        ["action"] = "Type d'action documentaire (Upload, Download, View, Update…)",
        ["resourceId"] = "Identifiant du document",
        ["details"] = "Détails de l'action",
        ["ipAddress"] = "Adresse IP",
        ["success"] = "Action réussie ou non",
        ["timestamp"] = "Date et heure",
        ["threatName"] = "Nom de la menace détectée",
        ["isValid"] = "Intégrité valide ou non",
        ["message"] = "Message explicatif"
    };

    public void Apply(OpenApiSchema schema, SchemaFilterContext context)
    {
        if (schema.Properties is null) return;

        foreach (var (nom, propriete) in schema.Properties)
        {
            if (Champs.TryGetValue(nom, out var libelle))
                propriete.Description = libelle;
        }
    }
}
