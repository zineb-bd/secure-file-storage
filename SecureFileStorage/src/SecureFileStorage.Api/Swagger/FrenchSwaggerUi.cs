namespace SecureFileStorage.Api.Swagger;

public static class FrenchSwaggerUi
{
    // Pas de script JS : il cassait les boutons cliquables de Swagger.
    public const string HeadContent = """
        <style>
          .swagger-ui .topbar { display: none; }
          .swagger-ui .info .title { font-size: 1.6em; }
        </style>
        """;
}
