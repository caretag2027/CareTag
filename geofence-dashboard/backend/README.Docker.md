## Run with Docker (local dev)

This project includes a `docker-compose.yml` that starts PostgreSQL and the API.

Start services:

```bash
docker-compose -f backend/docker-compose.yml up --build
```

The API will be available at `http://localhost:5077` and the DB at port `5432`.

To apply the included SQL schema to the DB (once the DB is running):

```bash
docker exec -i <db-container-name> psql -U postgres -d geofence < backend/GeoFence.Api/Database/schema.sql
```

Notes:
- The Docker image builds with the .NET 8 SDK; building requires Docker installed locally.
- If you prefer not to use Docker, set the connection string in `appsettings.json` or environment variables and run the API via `dotnet run` (requires .NET SDK).
