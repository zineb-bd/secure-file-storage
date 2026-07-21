using Microsoft.OpenApi.Models;
using Swashbuckle.AspNetCore.SwaggerGen;

namespace SecureFileStorage.Api.Swagger;

public class FrenchDocumentFilter : IDocumentFilter
{
    public void Apply(OpenApiDocument swaggerDoc, DocumentFilterContext context)
    {
        if (swaggerDoc.Info is not null)
        {
            swaggerDoc.Info.Title = "API — Stockage sécurisé des fichiers";
            swaggerDoc.Info.Description = """
                **Microservice de gestion sécurisée des documents d'entreprise.**

                ### Mode d'emploi
                1. **Authentification → Connexion** : connectez-vous
                2. Copiez le **jeton** (token) reçu
                3. Cliquez **Autoriser** et entrez : `Bearer VOTRE_JETON`
                4. Testez les autres fonctions (documents, audit, etc.)
                """;
        }

        foreach (var path in swaggerDoc.Paths.Values)
        {
            foreach (var operation in path.Operations.Values)
            {
                foreach (var response in operation.Responses)
                {
                    response.Value.Description = TraduireReponse(response.Key, response.Value.Description);
                }
            }
        }
    }

    private static string TraduireReponse(string code, string? desc)
    {
        if (code.StartsWith('2')) return "Succès";
        return code switch
        {
            "400" => "Requête incorrecte",
            "401" => "Non authentifié — connectez-vous d'abord",
            "403" => "Accès interdit — droits insuffisants",
            "404" => "Ressource introuvable",
            "409" => "Conflit (ex. email déjà utilisé)",
            "500" => "Erreur interne du serveur",
            _ => desc ?? code
        };
    }
}
