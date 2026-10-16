namespace GeoFence.Api.Dtos;

public sealed record GsmPacketCreateRequest(
    string? DeviceName,
    string PacketType,
    DateTimeOffset? CapturedAtUtc,
    decimal? Latitude,
    decimal? Longitude,
    double? SpeedKph,
    double? HeadingDegrees,
    double? AccuracyMeters,
    int? BatteryPercent,
    bool? GpsEnabled,
    string? MotionState,
    string? RoutineState,
    decimal? DeviationScore,
    int? SignalRssi,
    string? RawPayload,
    string? CorrelationId);
