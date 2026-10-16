namespace GeoFence.Api.Models;

public sealed class GsmPacket
{
    public long Id { get; set; }
    public long DeviceId { get; set; }
    public Device Device { get; set; } = default!;

    public string PacketType { get; set; } = string.Empty;
    public DateTimeOffset CapturedAtUtc { get; set; }
    public DateTimeOffset ReceivedAtUtc { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public double? SpeedKph { get; set; }
    public double? HeadingDegrees { get; set; }
    public double? AccuracyMeters { get; set; }
    public int? BatteryPercent { get; set; }
    public bool? GpsEnabled { get; set; }
    public string? MotionState { get; set; }
    public string? RoutineState { get; set; }
    public decimal? DeviationScore { get; set; }
    public int? SignalRssi { get; set; }
    public string? RawPayload { get; set; }
    public string? CorrelationId { get; set; }
}
