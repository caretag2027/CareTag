namespace GeoFence.Api.Dtos;

public sealed record GeofenceRuleCreateRequest(
    string? DeviceName,
    string Label,
    decimal CenterLatitude,
    decimal CenterLongitude,
    int RadiusMeters,
    TimeOnly? ActiveFrom,
    TimeOnly? ActiveTo,
    bool IsActive);
