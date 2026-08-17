FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /app

COPY StudyRoom.API/*.csproj ./StudyRoom.API/
RUN dotnet restore ./StudyRoom.API/StudyRoom.API.csproj

COPY . .
RUN dotnet publish ./StudyRoom.API/StudyRoom.API.csproj -c Release -o /publish

FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS runtime
WORKDIR /app
EXPOSE 80
EXPOSE 443

ENV ASPNETCORE_URLS=http://+:80
ENV ASPNETCORE_ENVIRONMENT=Production

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg curl python3 python3-pip && \
    (curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && chmod +x /usr/local/bin/yt-dlp) || \
    pip3 install --break-system-packages --no-cache-dir yt-dlp ; \
    apt-get purge -y curl python3-pip && rm -rf /var/lib/apt/lists/*

COPY --from=build /publish .

ENTRYPOINT ["dotnet", "StudyRoom.API.dll"]
