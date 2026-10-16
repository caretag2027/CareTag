# GeoFence.Api

Initial ASP.NET Core API for incoming GSM packets, geofence rules, and activity observations.

## Endpoints
- `GET /health`
- `POST /api/devices/{deviceKey}/packets`
- `GET /api/devices/{deviceKey}/packets/latest`
- `GET /api/devices/{deviceKey}/geofences`
- `POST /api/devices/{deviceKey}/geofences`
- `POST /api/devices/{deviceKey}/activity-observations`

## Database
The relational schema is defined in `Database/schema.sql` and mirrored in the EF Core model.

## Notes
- The project targets .NET 8.
- PostgreSQL is the default database provider.
- Set `ConnectionStrings:GeoFenceDb` for your cloud or local environment.
