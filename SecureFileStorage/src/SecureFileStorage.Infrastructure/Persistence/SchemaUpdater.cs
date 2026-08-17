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
            ALTER TABLE "StorageConfigurations"
                ADD COLUMN IF NOT EXISTS "CompressionEnabled" boolean NOT NULL DEFAULT TRUE;
            ALTER TABLE "StorageConfigurations"
                ADD COLUMN IF NOT EXISTS "EncryptionAlgorithm" integer NOT NULL DEFAULT 0;
            ALTER TABLE "StorageConfigurations"
                ADD COLUMN IF NOT EXISTS "ActiveEncryptionKeyId" uuid NULL;
            ALTER TABLE "StoredBlobs"
                ADD COLUMN IF NOT EXISTS "IsCompressed" boolean NOT NULL DEFAULT FALSE;
            ALTER TABLE "StoredBlobs"
                ADD COLUMN IF NOT EXISTS "EncryptionAlgorithm" integer NOT NULL DEFAULT 2;
            ALTER TABLE "StoredBlobs"
                ADD COLUMN IF NOT EXISTS "StorageConfigurationId" uuid NULL;
            ALTER TABLE "StoredBlobs"
                ADD COLUMN IF NOT EXISTS "EncryptionKeyId" uuid NULL;
            ALTER TABLE "EncryptionKeys"
                ADD COLUMN IF NOT EXISTS "StorageConfigurationId" uuid NULL;
            UPDATE "EncryptionKeys"
            SET "StorageConfigurationId" = (
                SELECT "Id" FROM "StorageConfigurations"
                WHERE "IsActive" = TRUE
                ORDER BY "UpdatedAt" DESC
                LIMIT 1
            )
            WHERE "StorageConfigurationId" IS NULL;
            CREATE INDEX IF NOT EXISTS "IX_StoredBlobs_StorageConfigurationId"
                ON "StoredBlobs" ("StorageConfigurationId");
            CREATE INDEX IF NOT EXISTS "IX_StoredBlobs_EncryptionKeyId"
                ON "StoredBlobs" ("EncryptionKeyId");
            CREATE INDEX IF NOT EXISTS "IX_EncryptionKeys_StorageConfigurationId_IsActive"
                ON "EncryptionKeys" ("StorageConfigurationId", "IsActive");
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
            CREATE TABLE IF NOT EXISTS "UserGroups" (
                "Id" uuid NOT NULL,
                "Name" character varying(100) NOT NULL,
                "Description" character varying(500) NOT NULL DEFAULT '',
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "UpdatedAt" timestamp with time zone NULL,
                CONSTRAINT "PK_UserGroups" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_UserGroups_Name"
                ON "UserGroups" ("Name");
            CREATE TABLE IF NOT EXISTS "UserGroupMembers" (
                "UserGroupId" uuid NOT NULL,
                "UserId" uuid NOT NULL,
                "JoinedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_UserGroupMembers" PRIMARY KEY ("UserGroupId", "UserId"),
                CONSTRAINT "FK_UserGroupMembers_UserGroups_UserGroupId"
                    FOREIGN KEY ("UserGroupId") REFERENCES "UserGroups" ("Id") ON DELETE CASCADE,
                CONSTRAINT "FK_UserGroupMembers_Users_UserId"
                    FOREIGN KEY ("UserId") REFERENCES "Users" ("Id") ON DELETE CASCADE
            );
            CREATE INDEX IF NOT EXISTS "IX_UserGroupMembers_UserId"
                ON "UserGroupMembers" ("UserId");
            CREATE TABLE IF NOT EXISTS "CategoryAccessRules" (
                "Id" uuid NOT NULL,
                "Category" character varying(100) NOT NULL,
                "UserGroupId" uuid NOT NULL,
                "AccessLevel" integer NOT NULL DEFAULT 0,
                "CreatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                "CreatedById" uuid NOT NULL,
                CONSTRAINT "PK_CategoryAccessRules" PRIMARY KEY ("Id"),
                CONSTRAINT "FK_CategoryAccessRules_UserGroups_UserGroupId"
                    FOREIGN KEY ("UserGroupId") REFERENCES "UserGroups" ("Id") ON DELETE CASCADE
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_CategoryAccessRules_Category_UserGroupId"
                ON "CategoryAccessRules" ("Category", "UserGroupId");
            CREATE INDEX IF NOT EXISTS "IX_CategoryAccessRules_Category"
                ON "CategoryAccessRules" ("Category");
            CREATE TABLE IF NOT EXISTS "ChatbotUsageMetrics" (
                "Id" uuid NOT NULL,
                "Day" date NOT NULL,
                "Topic" character varying(64) NOT NULL,
                "Source" character varying(32) NOT NULL,
                "RequestCount" integer NOT NULL DEFAULT 0,
                "UpdatedAt" timestamp with time zone NOT NULL DEFAULT NOW(),
                CONSTRAINT "PK_ChatbotUsageMetrics" PRIMARY KEY ("Id")
            );
            CREATE UNIQUE INDEX IF NOT EXISTS "IX_ChatbotUsageMetrics_Day_Topic_Source"
                ON "ChatbotUsageMetrics" ("Day", "Topic", "Source");
            -- Les associations inter-domaines sont toujours réalisées par les champs …Id.
            -- NOT VALID conserve la compatibilité des données historiques tout en protégeant
            -- toutes les nouvelles écritures par des clés étrangères.
            DO $$ BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_DocumentPermissions_Users_GrantedById') THEN
                    ALTER TABLE "DocumentPermissions"
                    ADD CONSTRAINT "FK_DocumentPermissions_Users_GrantedById"
                    FOREIGN KEY ("GrantedById") REFERENCES "Users" ("Id") ON DELETE SET NULL NOT VALID;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_DocumentShareLinks_Users_CreatedById') THEN
                    ALTER TABLE "DocumentShareLinks"
                    ADD CONSTRAINT "FK_DocumentShareLinks_Users_CreatedById"
                    FOREIGN KEY ("CreatedById") REFERENCES "Users" ("Id") ON DELETE RESTRICT NOT VALID;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'FK_CategoryAccessRules_Users_CreatedById') THEN
                    ALTER TABLE "CategoryAccessRules"
                    ADD CONSTRAINT "FK_CategoryAccessRules_Users_CreatedById"
                    FOREIGN KEY ("CreatedById") REFERENCES "Users" ("Id") ON DELETE RESTRICT NOT VALID;
                END IF;
            END $$;
            """, ct);
    }
}
