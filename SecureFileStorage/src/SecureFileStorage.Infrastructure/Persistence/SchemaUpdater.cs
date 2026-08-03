using Microsoft.EntityFrameworkCore;

namespace SecureFileStorage.Infrastructure.Persistence;

public static class SchemaUpdater
{
    public static async Task ApplyAsync(ApplicationDbContext context, CancellationToken ct = default)
    {
        await context.Database.ExecuteSqlRawAsync("""
            ALTER TABLE "DocumentPermissions"
                ADD COLUMN IF NOT EXISTS "AccessLevel" integer NOT NULL DEFAULT 0;
            ALTER TABLE "DocumentPermissions"
                ADD COLUMN IF NOT EXISTS "ExpiresAt" timestamp with time zone NULL;
            ALTER TABLE "DocumentPermissions"
                ADD COLUMN IF NOT EXISTS "GrantedById" uuid NULL;
            ALTER TABLE "DocumentPermissions"
                ADD COLUMN IF NOT EXISTS "GrantedAt" timestamp with time zone NOT NULL DEFAULT NOW();
            CREATE TABLE IF NOT EXISTS "DocumentShareLinks" (
                "Id" uuid NOT NULL,
                "DocumentId" uuid NOT NULL,
                "TokenHash" character varying(64) NOT NULL,
                "AccessLevel" integer NOT NULL,
                "ExpiresAt" timestamp with time zone NOT NULL,
                "CreatedById" uuid NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL,
                "IsRevoked" boolean NOT NULL DEFAULT FALSE,
                CONSTRAINT "PK_DocumentShareLinks" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_DocumentShareLinks_Documents_DocumentId"
                    FOREIGN KEY ("DocumentId") REFERENCES "Documents" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_DocumentShareLinks_TokenHash"
                ON "DocumentShareLinks" ("TokenHash");
            CREATE INDEX IF NOT EXISTS "IX_DocumentShareLinks_DocumentId"
                ON "DocumentShareLinks" ("DocumentId");
            CREATE TABLE IF NOT EXISTS "StoredBlobs" (
                "Id" uuid NOT NULL,
                "Sha256Hash" character varying(64) NOT NULL,
                "StoragePath" character varying(500) NOT NULL,
                "EncryptedKey" text NOT NULL,
                "SizeBytes" bigint NOT NULL,
                "ReferenceCount" integer NOT NULL DEFAULT 1,
                "CreatedAt" timestamp with time zone NOT NULL,
                CONSTRAINT "PK_StoredBlobs" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_StoredBlobs_Sha256Hash"
                ON "StoredBlobs" ("Sha256Hash");
            ALTER TABLE "DocumentVersions"
                ADD COLUMN IF NOT EXISTS "StoredBlobId" uuid NULL;
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_DocumentVersions_StoredBlobs_StoredBlobId'
                ) THEN
                    ALTER TABLE "DocumentVersions"
                        ADD CONSTRAINT "FK_DocumentVersions_StoredBlobs_StoredBlobId"
                        FOREIGN KEY ("StoredBlobId") REFERENCES "StoredBlobs" ("Id") ON DELETE RESTRICT;
                END IF;
            END $$;
            CREATE INDEX IF NOT EXISTS "IX_DocumentVersions_StoredBlobId"
                ON "DocumentVersions" ("StoredBlobId");
            ALTER TABLE "Documents"
                ADD COLUMN IF NOT EXISTS "LockedById" uuid NULL;
            ALTER TABLE "Documents"
                ADD COLUMN IF NOT EXISTS "LockedAt" timestamp with time zone NULL;
            ALTER TABLE "Documents"
                ADD COLUMN IF NOT EXISTS "LockExpiresAt" timestamp with time zone NULL;
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint WHERE conname = 'FK_Documents_Users_LockedById'
                ) THEN
                    ALTER TABLE "Documents"
                        ADD CONSTRAINT "FK_Documents_Users_LockedById"
                        FOREIGN KEY ("LockedById") REFERENCES "Users" ("Id") ON DELETE SET NULL;
                END IF;
            END $$;
            CREATE INDEX IF NOT EXISTS "IX_Documents_LockedById" ON "Documents" ("LockedById");
            ALTER TABLE "Documents"
                ADD COLUMN IF NOT EXISTS "Visibility" integer NOT NULL DEFAULT 0;
            ALTER TABLE "Documents"
                ADD COLUMN IF NOT EXISTS "PublicAccessLevel" integer NOT NULL DEFAULT 0;
            CREATE INDEX IF NOT EXISTS "IX_Documents_Visibility" ON "Documents" ("Visibility");
            INSERT INTO "UserRoles" ("UserId", "RoleId")
            SELECT DISTINCT ur."UserId", user_role."Id"
            FROM "UserRoles" ur
            INNER JOIN "Roles" extra ON ur."RoleId" = extra."Id" AND extra."Name" NOT IN ('Admin', 'User')
            CROSS JOIN (SELECT "Id" FROM "Roles" WHERE "Name" = 'User' LIMIT 1) user_role
            WHERE NOT EXISTS (
                SELECT 1 FROM "UserRoles" ur2
                INNER JOIN "Roles" r ON ur2."RoleId" = r."Id"
                WHERE ur2."UserId" = ur."UserId" AND r."Name" IN ('Admin', 'User')
            );
            DELETE FROM "UserRoles" ur
            USING "Roles" r
            WHERE ur."RoleId" = r."Id" AND r."Name" NOT IN ('Admin', 'User');
            DELETE FROM "Roles" WHERE "Name" NOT IN ('Admin', 'User');
            CREATE TABLE IF NOT EXISTS "DocumentFavorites" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "DocumentId" uuid NOT NULL,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_DocumentFavorites" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_DocumentFavorites_Users_UserId"
                    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_DocumentFavorites_Documents_DocumentId"
                    FOREIGN KEY ("DocumentId") REFERENCES "Documents" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_DocumentFavorites_UserId_DocumentId"
                ON "DocumentFavorites" ("UserId", "DocumentId");
            CREATE INDEX IF NOT EXISTS "IX_DocumentFavorites_DocumentId"
                ON "DocumentFavorites" ("DocumentId");
            ALTER TABLE "StorageConfigurations"
                ADD COLUMN IF NOT EXISTS "ConnectionString" text NULL;
            CREATE TABLE IF NOT EXISTS "UserNotifications" (
                "Id" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "ActorId" uuid NULL,
                "Type" character varying(64) NOT NULL,
                "Message" character varying(1000) NOT NULL,
                "DocumentId" uuid NULL,
                "IsRead" boolean NOT NULL DEFAULT FALSE,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_UserNotifications" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_UserNotifications_Users_UserId"
                    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_UserNotifications_Users_ActorId"
                    FOREIGN KEY ("ActorId") REFERENCES "Users" ("Id") ON DELETE SET NULL,
                CONSTRAINT "FK_UserNotifications_Documents_DocumentId"
                    FOREIGN KEY ("DocumentId") REFERENCES "Documents" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_UserNotifications_UserId_CreatedAt"
                ON "UserNotifications" ("UserId", "CreatedAt");
            CREATE INDEX IF NOT EXISTS "IX_UserNotifications_UserId_IsRead"
                ON "UserNotifications" ("UserId", "IsRead");
            """, ct);
    }
}
