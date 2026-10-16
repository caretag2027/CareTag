namespace GeoFence.Api.Models;

public sealed class AlertEvent
{
    public long Id { get; set; }
    public long DeviceId { get; set; }
    public Device Device { get; set; } = default!;

    /// <summary>out_of_zone | anomaly | low_battery</summary>
    public string AlertType { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public DateTimeOffset TimestampUtc { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? NearestGeofence { get; set; }
    public double? DistanceKm { get; set; }
    public decimal? DeviationScore { get; set; }
    public int? BatteryPercent { get; set; }
    public bool Acknowledged { get; set; }
}
