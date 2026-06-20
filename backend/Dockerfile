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

COPY --from=build /publish .

ENTRYPOINT ["dotnet", "StudyRoom.API.dll"]
