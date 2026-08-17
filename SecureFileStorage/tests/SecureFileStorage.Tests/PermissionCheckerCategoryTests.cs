using SecureFileStorage.Domain.Entities;
using SecureFileStorage.Domain.Enums;
using SecureFileStorage.Infrastructure.Services;

namespace SecureFileStorage.Tests;

public class PermissionCheckerCategoryTests
{
    private static readonly Guid OwnerId = Guid.Parse("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
    private static readonly Guid UserId = Guid.Parse("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
    private static readonly Guid OtherId = Guid.Parse("cccccccc-cccc-cccc-cccc-cccccccccccc");

    private static Document MakeDoc(
        DocumentVisibility visibility = DocumentVisibility.Private,
        ShareAccessLevel publicLevel = ShareAccessLevel.Read,
        string category = "RH",
        params DocumentPermission[] permissions)
    {
        return new Document
        {
            Id = Guid.NewGuid(),
            FileName = "test.pdf",
            Category = category,
            OwnerId = OwnerId,
            Status = DocumentStatus.Active,
            Visibility = visibility,
            PublicAccessLevel = publicLevel,
            Permissions = permissions.ToList(),
            Owner = new User { Id = OwnerId, FirstName = "Own", LastName = "Er", Email = "o@t.com" }
        };
    }

    private static DocumentPermission Share(Guid userId, ShareAccessLevel level) => new()
    {
        Id = Guid.NewGuid(),
        UserId = userId,
        AccessLevel = level,
        Permission = level == ShareAccessLevel.Write ? PermissionType.Write : PermissionType.Read,
        GrantedAt = DateTime.UtcNow
    };

    [Fact]
    public void Owner_Always_Gets_Write()
    {
        var doc = MakeDoc(category: "RH");
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, OwnerId, isAdmin: false, categoryGrantedLevel: null, categoryHasRules: true);
        Assert.Equal(ShareAccessLevel.Write, level);
    }

    [Fact]
    public void Admin_Always_Gets_Write()
    {
        var doc = MakeDoc();
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, OtherId, isAdmin: true, categoryGrantedLevel: null, categoryHasRules: true);
        Assert.Equal(ShareAccessLevel.Write, level);
    }

    [Fact]
    public void CategoryRules_Without_Matching_Group_Deny_Even_With_Document_Share()
    {
        var doc = MakeDoc(permissions: Share(UserId, ShareAccessLevel.Write));
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, UserId, isAdmin: false, categoryGrantedLevel: null, categoryHasRules: true);
        Assert.Null(level);
    }

    [Fact]
    public void Category_Only_Grant_Allows_Access_On_Private_Document()
    {
        var doc = MakeDoc(DocumentVisibility.Private);
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, UserId, isAdmin: false, categoryGrantedLevel: ShareAccessLevel.Download, categoryHasRules: true);
        Assert.Equal(ShareAccessLevel.Download, level);
    }

    [Fact]
    public void Restrictive_Policy_Takes_Min_Of_Document_And_Category()
    {
        var doc = MakeDoc(permissions: Share(UserId, ShareAccessLevel.Write));
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, UserId, isAdmin: false, categoryGrantedLevel: ShareAccessLevel.Read, categoryHasRules: true);
        Assert.Equal(ShareAccessLevel.Read, level);
    }

    [Fact]
    public void Restrictive_Policy_Takes_Min_When_Category_Is_Higher()
    {
        var doc = MakeDoc(permissions: Share(UserId, ShareAccessLevel.Read));
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, UserId, isAdmin: false, categoryGrantedLevel: ShareAccessLevel.Write, categoryHasRules: true);
        Assert.Equal(ShareAccessLevel.Read, level);
    }

    [Fact]
    public void No_Category_Rules_Falls_Back_To_Document_Share()
    {
        var doc = MakeDoc(permissions: Share(UserId, ShareAccessLevel.Download));
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, UserId, isAdmin: false, categoryGrantedLevel: null, categoryHasRules: false);
        Assert.Equal(ShareAccessLevel.Download, level);
    }

    [Fact]
    public void No_Category_Rules_Public_Document_Uses_Public_Level()
    {
        var doc = MakeDoc(DocumentVisibility.Public, ShareAccessLevel.Preview);
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, UserId, isAdmin: false, categoryGrantedLevel: null, categoryHasRules: false);
        Assert.Equal(ShareAccessLevel.Preview, level);
    }

    [Fact]
    public void Public_Plus_Category_Uses_Restrictive_Min()
    {
        var doc = MakeDoc(DocumentVisibility.Public, ShareAccessLevel.Write);
        var level = PermissionChecker.GetEffectiveLevelOnDocument(
            doc, UserId, isAdmin: false, categoryGrantedLevel: ShareAccessLevel.Download, categoryHasRules: true);
        Assert.Equal(ShareAccessLevel.Download, level);
    }

    [Fact]
    public void Context_Overload_Uses_Max_Matching_Group_Then_Min_With_Document()
    {
        var groupA = Guid.NewGuid();
        var groupB = Guid.NewGuid();
        var doc = MakeDoc(permissions: Share(UserId, ShareAccessLevel.Write));
        var ctx = new AccessEvaluationContext(
            [groupA, groupB],
            new Dictionary<string, IReadOnlyList<(Guid GroupId, ShareAccessLevel Level)>>(StringComparer.OrdinalIgnoreCase)
            {
                ["RH"] =
                [
                    (groupA, ShareAccessLevel.Read),
                    (groupB, ShareAccessLevel.Download)
                ]
            });

        // Max category grant among memberships = Download; min with Write share = Download
        var level = PermissionChecker.GetEffectiveLevelOnDocument(doc, UserId, isAdmin: false, ctx);
        Assert.Equal(ShareAccessLevel.Download, level);
    }

    [Fact]
    public void Non_Member_Of_Any_Category_Group_Is_Denied()
    {
        var groupA = Guid.NewGuid();
        var doc = MakeDoc(DocumentVisibility.Public, ShareAccessLevel.Write);
        var ctx = new AccessEvaluationContext(
            [],
            new Dictionary<string, IReadOnlyList<(Guid GroupId, ShareAccessLevel Level)>>(StringComparer.OrdinalIgnoreCase)
            {
                ["RH"] = [(groupA, ShareAccessLevel.Write)]
            });

        var level = PermissionChecker.GetEffectiveLevelOnDocument(doc, UserId, isAdmin: false, ctx);
        Assert.Null(level);
    }
}
