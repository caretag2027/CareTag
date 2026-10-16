FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# copy csproj and restore
COPY ./GeoFence.Api/*.csproj ./GeoFence.Api/
RUN dotnet restore GeoFence.Api/GeoFence.Api.csproj

# copy everything and publish
COPY . .
RUN dotnet publish GeoFence.Api/GeoFence.Api.csproj -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app
COPY --from=build /app/publish ./

ENV ASPNETCORE_URLS=http://+:5077
EXPOSE 5077

ENTRYPOINT ["dotnet", "GeoFence.Api.dll"]
