namespace GeoFence.Api.Models;

public sealed class ActivityObservation
{
    public long Id { get; set; }
    public long DeviceId { get; set; }
    public Device Device { get; set; } = default!;

    public string ActivityLabel { get; set; } = string.Empty;
    public DateTimeOffset CapturedAtUtc { get; set; }
    public decimal? Latitude { get; set; }
    public decimal? Longitude { get; set; }
    public string? Notes { get; set; }
    public string Source { get; set; } = "manual";
}
