using GeoFence.Api.Data;
using GeoFence.Api.Dtos;
using GeoFence.Api.Models;
using Microsoft.EntityFrameworkCore;
using System.Net.Http;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();
builder.Services.AddSignalR();
builder.Services.AddCors(options =>
{
    options.AddPolicy("frontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var connectionString = builder.Configuration.GetConnectionString("GeoFenceDb")
    ?? builder.Configuration["GeoFenceDbConnection"]
    ?? "Host=localhost;Port=5432;Database=geofence;Username=postgres;Password=postgres";

builder.Services.AddDbContext<GeoFenceDbContext>(options =>
    options.UseNpgsql(connectionString));

// HttpClient for calling external scorer service
builder.Services.AddHttpClient();

var app = builder.Build();

app.UseCors("frontend");

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.MapHub<GeoFence.Api.Hubs.UpdateHub>("/hub/updates");

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "GeoFence.Api" }));

// ── Auth endpoints ──

app.MapPost("/api/auth/register", async (
    AuthRegisterRequest request,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        return Results.BadRequest(new { error = "Email and password are required." });

    if (request.Password.Length < 4)
        return Results.BadRequest(new { error = "Password must be at least 4 characters." });

    var normalizedEmail = request.Email.Trim().ToLowerInvariant();
    var existing = await db.Users.AnyAsync(u => u.Email == normalizedEmail, cancellationToken);
    if (existing)
        return Results.Conflict(new { error = "An account with this email already exists." });

    var passwordHash = HashPassword(request.Password);
    var user = new User
    {
        Email = normalizedEmail,
        PasswordHash = passwordHash,
        DisplayName = request.Name?.Trim() ?? normalizedEmail,
        CreatedAtUtc = DateTimeOffset.UtcNow
    };

    db.Users.Add(user);
    await db.SaveChangesAsync(cancellationToken);

    return Results.Created($"/api/auth/{user.Id}", new
    {
        user.Id,
        user.Email,
        user.DisplayName,
        user.CreatedAtUtc
    });
});

app.MapPost("/api/auth/login", async (
    AuthLoginRequest request,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Email) || string.IsNullOrWhiteSpace(request.Password))
        return Results.BadRequest(new { error = "Email and password are required." });

    var normalizedEmail = request.Email.Trim().ToLowerInvariant();
    var passwordHash = HashPassword(request.Password);

    var user = await db.Users
        .SingleOrDefaultAsync(u => u.Email == normalizedEmail && u.PasswordHash == passwordHash, cancellationToken);

    if (user is null)
        return Results.Unauthorized();

    return Results.Ok(new
    {
        user.Id,
        user.Email,
        user.DisplayName,
        user.CreatedAtUtc
    });
});

// ── Packet endpoints ──

app.MapPost("/api/devices/{deviceKey}/packets", async (
    string deviceKey,
    GsmPacketCreateRequest request,
    GeoFenceDbContext db,
    Microsoft.AspNetCore.SignalR.IHubContext<GeoFence.Api.Hubs.UpdateHub> hub,
    IHttpClientFactory httpFactory,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(deviceKey))
    {
        return Results.BadRequest(new { error = "deviceKey is required." });
    }

    if (string.IsNullOrWhiteSpace(request.PacketType))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.PacketType)] = ["PacketType is required."]
        });
    }

    var normalizedDeviceKey = NormalizeDeviceKey(deviceKey);
    var device = await db.Devices.SingleOrDefaultAsync(x => x.ExternalKey == normalizedDeviceKey, cancellationToken);

    if (device is null)
    {
        device = new Device
        {
            ExternalKey = normalizedDeviceKey,
            DisplayName = request.DeviceName ?? normalizedDeviceKey,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

        db.Devices.Add(device);
        await db.SaveChangesAsync(cancellationToken);
    }

    var packet = new GsmPacket
    {
        DeviceId = device.Id,
        PacketType = request.PacketType.Trim(),
        CapturedAtUtc = request.CapturedAtUtc ?? DateTimeOffset.UtcNow,
        ReceivedAtUtc = DateTimeOffset.UtcNow,
        Latitude = request.Latitude,
        Longitude = request.Longitude,
        SpeedKph = request.SpeedKph,
        HeadingDegrees = request.HeadingDegrees,
        AccuracyMeters = request.AccuracyMeters,
        BatteryPercent = request.BatteryPercent,
        GpsEnabled = request.GpsEnabled,
        MotionState = request.MotionState?.Trim(),
        RoutineState = request.RoutineState?.Trim(),
        DeviationScore = request.DeviationScore,
        SignalRssi = request.SignalRssi,
        RawPayload = request.RawPayload?.Trim(),
        CorrelationId = request.CorrelationId?.Trim()
    };

    db.GsmPackets.Add(packet);
    await db.SaveChangesAsync(cancellationToken);

    // Call CareTag scorer service (best-effort). Update packet with returned score/state.
    try
    {
        var scorerUrl = Environment.GetEnvironmentVariable("CARETAG_SCORER_URL") ?? "http://caretag-scorer:8000/score";
        var client = httpFactory.CreateClient();
        var payload = new
        {
            latitude = packet.Latitude,
            longitude = packet.Longitude,
            timestamp = packet.CapturedAtUtc,
            speed = packet.SpeedKph,
            deviceKey = device.ExternalKey
        };

        var resp = await client.PostAsJsonAsync(scorerUrl, payload, cancellationToken);
        if (resp.IsSuccessStatusCode)
        {
            var obj = await resp.Content.ReadFromJsonAsync<System.Text.Json.JsonElement>(cancellationToken: cancellationToken);
            if (obj.ValueKind != System.Text.Json.JsonValueKind.Undefined && obj.ValueKind != System.Text.Json.JsonValueKind.Null)
            {
                if (obj.TryGetProperty("deviation_score", out var ds))
                {
                    if (ds.TryGetDecimal(out var dec)) packet.DeviationScore = dec;
                    else if (ds.TryGetDouble(out var d2)) packet.DeviationScore = (decimal)d2;
                }
                if (obj.TryGetProperty("motion_state", out var ms)) packet.MotionState = ms.GetString();
                db.GsmPackets.Update(packet);
                await db.SaveChangesAsync(cancellationToken);
            }
        }
    }
    catch
    {
        // scoring is best-effort; ignore failures
    }

    // Notify connected clients about the new packet
    try
    {
        // Use SendCoreAsync to avoid missing extension method issues in some SDK contexts
        await hub.Clients.All.SendCoreAsync("NewPacket", new object[] { new
        {
            packet.Id,
            device.ExternalKey,
            packet.PacketType,
            packet.CapturedAtUtc,
            packet.Latitude,
            packet.Longitude,
            packet.DeviationScore,
            packet.MotionState
        } }, cancellationToken);
    }
    catch
    {
        // ignore hub errors for resiliency in minimal API
    }

    return Results.Created($"/api/devices/{normalizedDeviceKey}/packets/{packet.Id}", new
    {
        packet.Id,
        device.ExternalKey,
        packet.PacketType,
        packet.CapturedAtUtc,
        packet.ReceivedAtUtc
    });
});

app.MapGet("/api/devices/{deviceKey}/packets/latest", async (
    string deviceKey,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    var normalizedDeviceKey = NormalizeDeviceKey(deviceKey);
    var packet = await db.GsmPackets
        .AsNoTracking()
        .Include(x => x.Device)
        .Where(x => x.Device.ExternalKey == normalizedDeviceKey)
        .OrderByDescending(x => x.CapturedAtUtc)
        .FirstOrDefaultAsync(cancellationToken);

    if (packet is null) return Results.NotFound();

    var dto = new
    {
        packet.Id,
        DeviceKey = packet.Device.ExternalKey,
        packet.PacketType,
        packet.CapturedAtUtc,
        packet.ReceivedAtUtc,
        packet.Latitude,
        packet.Longitude,
        packet.SpeedKph,
        packet.HeadingDegrees,
        packet.AccuracyMeters,
        packet.BatteryPercent,
        packet.GpsEnabled,
        packet.MotionState,
        packet.RoutineState,
        packet.DeviationScore,
        packet.SignalRssi,
        packet.RawPayload,
        packet.CorrelationId
    };

    return Results.Ok(dto);
});

// ── Geofence endpoints ──

app.MapGet("/api/devices/{deviceKey}/geofences", async (
    string deviceKey,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    var normalizedDeviceKey = NormalizeDeviceKey(deviceKey);
    var geofences = await db.GeofenceRules
        .AsNoTracking()
        .Where(x => x.Device.ExternalKey == normalizedDeviceKey)
        .OrderByDescending(x => x.CreatedAtUtc)
        .ToListAsync(cancellationToken);

    return Results.Ok(geofences);
});

app.MapPost("/api/devices/{deviceKey}/geofences", async (
    string deviceKey,
    GeofenceRuleCreateRequest request,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.Label))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.Label)] = ["Label is required."]
        });
    }

    if (request.RadiusMeters <= 0)
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.RadiusMeters)] = ["RadiusMeters must be greater than zero."]
        });
    }

    var normalizedDeviceKey = NormalizeDeviceKey(deviceKey);
    var device = await db.Devices.SingleOrDefaultAsync(x => x.ExternalKey == normalizedDeviceKey, cancellationToken)
        ?? new Device
        {
            ExternalKey = normalizedDeviceKey,
            DisplayName = request.DeviceName ?? normalizedDeviceKey,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

    if (device.Id == 0)
    {
        db.Devices.Add(device);
        await db.SaveChangesAsync(cancellationToken);
    }

    var geofence = new GeofenceRule
    {
        DeviceId = device.Id,
        Label = request.Label.Trim(),
        CenterLatitude = request.CenterLatitude,
        CenterLongitude = request.CenterLongitude,
        RadiusMeters = request.RadiusMeters,
        ActiveFrom = request.ActiveFrom,
        ActiveTo = request.ActiveTo,
        IsActive = request.IsActive,
        CreatedAtUtc = DateTimeOffset.UtcNow
    };

    db.GeofenceRules.Add(geofence);
    await db.SaveChangesAsync(cancellationToken);

    return Results.Created($"/api/devices/{normalizedDeviceKey}/geofences/{geofence.Id}", geofence);
});

app.MapDelete("/api/devices/{deviceKey}/geofences/{id}", async (
    string deviceKey,
    int id,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    var normalizedDeviceKey = NormalizeDeviceKey(deviceKey);
    var geofence = await db.GeofenceRules.Include(g => g.Device).SingleOrDefaultAsync(g => g.Id == id && g.Device.ExternalKey == normalizedDeviceKey, cancellationToken);
    if (geofence == null) return Results.NotFound();
    db.GeofenceRules.Remove(geofence);
    await db.SaveChangesAsync(cancellationToken);
    return Results.NoContent();
});

// ── Activity observation endpoint ──

app.MapPost("/api/devices/{deviceKey}/activity-observations", async (
    string deviceKey,
    ActivityObservationCreateRequest request,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    if (string.IsNullOrWhiteSpace(request.ActivityLabel))
    {
        return Results.ValidationProblem(new Dictionary<string, string[]>
        {
            [nameof(request.ActivityLabel)] = ["ActivityLabel is required."]
        });
    }

    var normalizedDeviceKey = NormalizeDeviceKey(deviceKey);
    var device = await db.Devices.SingleOrDefaultAsync(x => x.ExternalKey == normalizedDeviceKey, cancellationToken)
        ?? new Device
        {
            ExternalKey = normalizedDeviceKey,
            DisplayName = request.DeviceName ?? normalizedDeviceKey,
            CreatedAtUtc = DateTimeOffset.UtcNow
        };

    if (device.Id == 0)
    {
        db.Devices.Add(device);
        await db.SaveChangesAsync(cancellationToken);
    }

    var observation = new ActivityObservation
    {
        DeviceId = device.Id,
        ActivityLabel = request.ActivityLabel.Trim(),
        CapturedAtUtc = request.CapturedAtUtc ?? DateTimeOffset.UtcNow,
        Latitude = request.Latitude,
        Longitude = request.Longitude,
        Notes = request.Notes?.Trim(),
        Source = request.Source?.Trim() ?? "manual"
    };

    db.ActivityObservations.Add(observation);
    await db.SaveChangesAsync(cancellationToken);

    return Results.Created($"/api/devices/{normalizedDeviceKey}/activity-observations/{observation.Id}", observation);
});

// ── Alert endpoints ──

app.MapPost("/api/devices/{deviceKey}/alerts", async (
    string deviceKey,
    AlertEventCreateRequest request,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    var normalizedDeviceKey = NormalizeDeviceKey(deviceKey);
    var device = await db.Devices.SingleOrDefaultAsync(x => x.ExternalKey == normalizedDeviceKey, cancellationToken);
    if (device is null) return Results.NotFound(new { error = "Device not found." });

    var alertEvent = new AlertEvent
    {
        DeviceId = device.Id,
        AlertType = request.AlertType?.Trim() ?? "anomaly",
        Message = request.Message?.Trim() ?? "Alert triggered",
        TimestampUtc = DateTimeOffset.UtcNow,
        Latitude = request.Latitude,
        Longitude = request.Longitude,
        NearestGeofence = request.NearestGeofence?.Trim(),
        DistanceKm = request.DistanceKm,
        DeviationScore = request.DeviationScore,
        BatteryPercent = request.BatteryPercent,
        Acknowledged = false
    };

    db.AlertEvents.Add(alertEvent);
    await db.SaveChangesAsync(cancellationToken);

    return Results.Created($"/api/devices/{normalizedDeviceKey}/alerts/{alertEvent.Id}", alertEvent);
});

app.MapGet("/api/devices/{deviceKey}/alerts", async (
    string deviceKey,
    GeoFenceDbContext db,
    CancellationToken cancellationToken) =>
{
    var normalizedDeviceKey = NormalizeDeviceKey(deviceKey);
    var alerts = await db.AlertEvents
        .AsNoTracking()
        .Where(a => a.Device.ExternalKey == normalizedDeviceKey)
        .OrderByDescending(a => a.TimestampUtc)
        .Take(100)
        .ToListAsync(cancellationToken);

    return Results.Ok(alerts);
});

// Ensure database is initialized at startup. Try migrations first, fall back to EnsureCreated.
void InitializeDatabase(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<GeoFenceDbContext>();
    try
    {
        var pending = db.Database.GetPendingMigrations();
        if (pending != null && pending.Any())
        {
            db.Database.Migrate();
        }
        else
        {
            db.Database.EnsureCreated();
        }
    }
    catch
    {
        // If migrations aren't available or migration fails, ensure schema exists from models
        db.Database.EnsureCreated();
    }
}

// call initialization BEFORE the app starts listening
InitializeDatabase(app.Services);

app.Run();

static string NormalizeDeviceKey(string deviceKey) => deviceKey.Trim().ToUpperInvariant();

static string HashPassword(string password)
{
    var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(password));
    return Convert.ToHexString(bytes).ToLowerInvariant();
}

// ── Auth DTOs ──
record AuthRegisterRequest(string? Name, string Email, string Password);
record AuthLoginRequest(string Email, string Password);
record AlertEventCreateRequest(
    string? AlertType,
    string? Message,
    decimal? Latitude,
    decimal? Longitude,
    string? NearestGeofence,
    double? DistanceKm,
    decimal? DeviationScore,
    int? BatteryPercent);
