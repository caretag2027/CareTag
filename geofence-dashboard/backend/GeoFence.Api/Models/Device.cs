namespace GeoFence.Api.Models;

public sealed class Device
{
    public long Id { get; set; }
    public string ExternalKey { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public DateTimeOffset CreatedAtUtc { get; set; }

    // Owner (nullable for backward-compat with existing rows)
    public long? UserId { get; set; }
    public User? User { get; set; }

    public List<GsmPacket> GsmPackets { get; set; } = [];
    public List<GeofenceRule> GeofenceRules { get; set; } = [];
    public List<ActivityObservation> ActivityObservations { get; set; } = [];
    public List<AlertEvent> AlertEvents { get; set; } = [];
}
