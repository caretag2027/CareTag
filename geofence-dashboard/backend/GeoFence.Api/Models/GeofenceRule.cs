namespace GeoFence.Api.Models;

public sealed class GeofenceRule
{
    public long Id { get; set; }
    public long DeviceId { get; set; }
    public Device Device { get; set; } = default!;

    public string Label { get; set; } = string.Empty;
    public decimal CenterLatitude { get; set; }
    public decimal CenterLongitude { get; set; }
    public int RadiusMeters { get; set; }
    public TimeOnly? ActiveFrom { get; set; }
    public TimeOnly? ActiveTo { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTimeOffset CreatedAtUtc { get; set; }
}
