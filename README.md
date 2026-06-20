# StudyRoom

A virtual study room platform where students can create and join online study rooms, chat in real time, collaborate on notes, and use synchronized Pomodoro timers.

## Tech Stack

- **Frontend**: Angular 20+, TypeScript, Angular Material, RxJS
- **Backend**: ASP.NET Core 9 Web API, Entity Framework Core, SignalR
- **Database**: PostgreSQL
- **Authentication**: JWT with BCrypt password hashing
- **Deployment**: Docker, Render

## Features

- User authentication (register, login, JWT)
- Create and join study rooms
- Real-time chat via SignalR
- Collaborative markdown notes
- Synchronized Pomodoro timer
- Study statistics tracking
- Dark mode UI

## Project Structure

```
├── backend/
│   ├── StudyRoom.API/
│   │   ├── Controllers/      # API endpoints
│   │   ├── Services/         # Business logic
│   │   ├── Repositories/     # Data access
│   │   ├── Models/           # Entity models
│   │   ├── DTOs/             # Data transfer objects
│   │   ├── Data/             # DbContext & seed data
│   │   ├── Hubs/             # SignalR hub
│   │   ├── Middleware/       # Exception handling
│   │   └── Authentication/   # JWT settings
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/app/
│   │   ├── core/             # Services, guards, interceptors
│   │   ├── shared/           # Components, models
│   │   ├── auth/             # Login, register
│   │   ├── dashboard/        # Dashboard page
│   │   ├── rooms/            # Room list, detail, create
│   │   ├── chat/             # Chat components
│   │   ├── notes/            # Notes editor
│   │   ├── timer/            # Pomodoro timer
│   │   └── profile/          # User profile
│   ├── Dockerfile
│   ├── nginx.conf
│   └── .env.example
├── docker-compose.yml
└── README.md
```

## Quick Start with Docker

```bash
# Clone and start all services
docker-compose up -d

# Services:
# - Frontend: http://localhost
# - Backend API: http://localhost:5000
# - PostgreSQL: localhost:5432
```

## Manual Setup

### Prerequisites

- Node.js 20+
- .NET SDK 9.0
- PostgreSQL 16

### Database

```bash
# Create database
createdb studyroom
```

### Backend

```bash
cd backend

# Copy env and configure connection string
cp .env.example .env

# Run migrations and seed data
dotnet run --project StudyRoom.API
```

The API starts at `http://localhost:5000`.

### Frontend

```bash
cd frontend

# Install dependencies
npm install

# Start dev server (proxies API)
npm start
```

The app starts at `http://localhost:4200`.

## Seed Data

The application automatically seeds test data on first run:

**Users:**
| Username | Password | Role |
|----------|----------|------|
| admin    | Admin123! | Admin |
| alice    | Alice123! | User |
| bob      | Bob123!   | User |

**Sample Rooms:** Calculus Study Group, Physics Lab, LeetCode Grind

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login

### Rooms
- `GET /api/rooms` - List rooms (search, subject filter)
- `GET /api/rooms/{id}` - Get room details
- `POST /api/rooms` - Create room
- `PUT /api/rooms/{id}` - Update room
- `DELETE /api/rooms/{id}` - Delete room
- `POST /api/rooms/{id}/join` - Join room
- `POST /api/rooms/{id}/leave` - Leave room
- `GET /api/rooms/{id}/members` - Get members
- `GET /api/rooms/my` - Get user's rooms

### Messages
- `GET /api/rooms/{id}/messages` - Get room messages

### Notes
- `GET /api/rooms/{id}/notes` - Get room notes
- `PUT /api/rooms/{id}/notes` - Update room notes

### Statistics
- `GET /api/users/stats` - Get user study statistics

## SignalR Hub

**Endpoint:** `/hubs/studyroom`

**Events:**
- `JoinRoom` / `LeaveRoom`
- `SendMessage` / `ReceiveMessage`
- `StartTimer` / `PauseTimer` / `ResetTimer` / `TimerCompleted`
- `UpdateNotes` / `NotesUpdated`
- `UserJoined` / `UserLeft` / `OnlineUsers`

## Environment Variables

### Backend

| Variable | Description |
|----------|-------------|
| `ConnectionStrings__DefaultConnection` | PostgreSQL connection string |
| `JwtSettings__Secret` | JWT signing key |
| `JwtSettings__Issuer` | JWT issuer |
| `JwtSettings__Audience` | JWT audience |
| `JwtSettings__ExpiryMinutes` | Token expiry in minutes |
| `Cors__Origins__0` | Allowed CORS origin |

### Frontend

| Variable | Description |
|----------|-------------|
| `API_URL` | Backend API URL |
| `SIGNALR_URL` | SignalR hub URL |

## Deploying to Render

### Backend (Web Service)
1. Create a new Web Service on Render
2. Set root directory to `backend`
3. Build command: `dotnet publish -c Release -o /publish`
4. Start command: `dotnet StudyRoom.API.dll`
5. Add environment variables from `.env.example`

### Frontend (Static Site)
1. Create a new Static Site on Render
2. Set root directory to `frontend`
3. Build command: `npm ci && npm run build`
4. Publish directory: `dist/studyroom`
5. Add environment variables as needed
