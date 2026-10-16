using GeoFence.Api.Models;
using Microsoft.EntityFrameworkCore;

namespace GeoFence.Api.Data;

public sealed class GeoFenceDbContext : DbContext
{
    public GeoFenceDbContext(DbContextOptions<GeoFenceDbContext> options)
        : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();
    public DbSet<Device> Devices => Set<Device>();
    public DbSet<GsmPacket> GsmPackets => Set<GsmPacket>();
    public DbSet<GeofenceRule> GeofenceRules => Set<GeofenceRule>();
    public DbSet<ActivityObservation> ActivityObservations => Set<ActivityObservation>();
    public DbSet<AlertEvent> AlertEvents => Set<AlertEvent>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.Entity<User>(entity =>
        {
            entity.ToTable("users");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Email).HasMaxLength(256).IsRequired();
            entity.Property(x => x.PasswordHash).HasMaxLength(256).IsRequired();
            entity.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
            entity.HasIndex(x => x.Email).IsUnique();
        });

        modelBuilder.Entity<Device>(entity =>
        {
            entity.ToTable("devices");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ExternalKey).HasMaxLength(64).IsRequired();
            entity.Property(x => x.DisplayName).HasMaxLength(128).IsRequired();
            entity.HasIndex(x => x.ExternalKey).IsUnique();
            entity.HasOne(x => x.User)
                .WithMany(x => x.Devices)
                .HasForeignKey(x => x.UserId)
                .OnDelete(DeleteBehavior.SetNull);
        });

        modelBuilder.Entity<GsmPacket>(entity =>
        {
            entity.ToTable("gsm_packets");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.PacketType).HasMaxLength(40).IsRequired();
            entity.Property(x => x.MotionState).HasMaxLength(32);
            entity.Property(x => x.RoutineState).HasMaxLength(32);
            entity.Property(x => x.RawPayload).HasColumnType("text");
            entity.Property(x => x.CorrelationId).HasMaxLength(80);
            entity.HasIndex(x => new { x.DeviceId, x.CapturedAtUtc });
            entity.HasOne(x => x.Device)
                .WithMany(x => x.GsmPackets)
                .HasForeignKey(x => x.DeviceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<GeofenceRule>(entity =>
        {
            entity.ToTable("geofence_rules");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.Label).HasMaxLength(120).IsRequired();
            entity.Property(x => x.IsActive).HasDefaultValue(true);
            entity.HasIndex(x => new { x.DeviceId, x.Label }).IsUnique();
            entity.HasOne(x => x.Device)
                .WithMany(x => x.GeofenceRules)
                .HasForeignKey(x => x.DeviceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<ActivityObservation>(entity =>
        {
            entity.ToTable("activity_observations");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.ActivityLabel).HasMaxLength(40).IsRequired();
            entity.Property(x => x.Notes).HasMaxLength(500);
            entity.Property(x => x.Source).HasMaxLength(40).IsRequired();
            entity.HasIndex(x => new { x.DeviceId, x.CapturedAtUtc });
            entity.HasOne(x => x.Device)
                .WithMany(x => x.ActivityObservations)
                .HasForeignKey(x => x.DeviceId)
                .OnDelete(DeleteBehavior.Cascade);
        });

        modelBuilder.Entity<AlertEvent>(entity =>
        {
            entity.ToTable("alert_events");
            entity.HasKey(x => x.Id);
            entity.Property(x => x.AlertType).HasMaxLength(32).IsRequired();
            entity.Property(x => x.Message).HasMaxLength(500).IsRequired();
            entity.Property(x => x.NearestGeofence).HasMaxLength(120);
            entity.HasIndex(x => new { x.DeviceId, x.TimestampUtc });
            entity.HasOne(x => x.Device)
                .WithMany(x => x.AlertEvents)
                .HasForeignKey(x => x.DeviceId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
