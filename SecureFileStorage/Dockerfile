FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY SecureFileStorage.sln .
COPY src/SecureFileStorage.Domain/ src/SecureFileStorage.Domain/
COPY src/SecureFileStorage.Application/ src/SecureFileStorage.Application/
COPY src/SecureFileStorage.Infrastructure/ src/SecureFileStorage.Infrastructure/
COPY src/SecureFileStorage.Api/ src/SecureFileStorage.Api/

RUN dotnet restore
RUN dotnet publish src/SecureFileStorage.Api/SecureFileStorage.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish .
RUN mkdir -p /app/storage

ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production
ENV Storage__BasePath=/app/storage
ENV Antivirus__Enabled=false

EXPOSE 8080

# Railway injecte $PORT ; défaut 8080 en local/docker-compose
ENTRYPOINT ["sh", "-c", "exec dotnet SecureFileStorage.Api.dll --urls http://0.0.0.0:${PORT:-8080}"]
