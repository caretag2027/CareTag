namespace GeoFence.Api.Dtos;

public sealed record ActivityObservationCreateRequest(
    string? DeviceName,
    string ActivityLabel,
    DateTimeOffset? CapturedAtUtc,
    decimal? Latitude,
    decimal? Longitude,
    string? Notes,
    string? Source);
