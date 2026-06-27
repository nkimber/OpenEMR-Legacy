FROM node:24-alpine AS seed
WORKDIR /src
COPY modernization-workbench/seed-data ./modernization-workbench/seed-data
COPY modernized-openemr/scripts ./modernized-openemr/scripts
RUN node modernized-openemr/scripts/generate-postgres-seed.mjs

FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY modernized-openemr/backend/src/OpenEmr.Modernized.Api/OpenEmr.Modernized.Api.csproj ./
RUN dotnet restore
COPY modernized-openemr/backend/src/OpenEmr.Modernized.Api/ ./
RUN dotnet publish -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS runtime
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates postgresql-client \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=build /app/publish ./
COPY --from=seed /src/modernized-openemr/artifacts/postgres/seed-gold.sql ./demo-seed.sql
COPY infra/azure/demo/modernized-api-entrypoint.sh ./modernized-api-entrypoint.sh
RUN chmod +x ./modernized-api-entrypoint.sh
EXPOSE 8081
ENTRYPOINT ["./modernized-api-entrypoint.sh"]
