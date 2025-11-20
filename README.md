# Real-Time Collaborative Task Manager

A full-stack real-time collaborative task management application built with Node.js, Express, MongoDB, PostgreSQL, Redis, and Docker. Supports 1K+ concurrent WebSocket users with optimized performance and scalability. Features a double-entry accounting ledger system for tracking points and rewards.

## Features

- 🔐 **Secure Authentication** - JWT-based authentication with bcrypt password hashing
- 📝 **CRUD Operations** - Full create, read, update, delete functionality for tasks
- 🔄 **Real-time Updates** - WebSocket integration with Socket.IO for live collaboration
- 💰 **Transaction Ledger System** - Double-entry accounting with ACID compliance for points tracking
- ⚡ **Redis Caching** - Optimized data retrieval with Redis caching layer
- 🐳 **Dockerized** - Complete Docker and Docker Compose setup for easy deployment
- 📊 **Scalable Architecture** - Redis adapter for horizontal scaling across multiple servers
- 🚀 **CI/CD Pipeline** - GitHub Actions workflow for automated testing and deployment
- 🎨 **Modern UI** - React frontend with Material-UI components
- 📱 **Responsive Design** - Works on desktop and mobile devices
- 🏆 **Points & Rewards** - Automatic points awarded when tasks are completed

## Tech Stack

### Backend
- Node.js
- Express.js
- MongoDB (with Mongoose) - Task and user data
- PostgreSQL - Transaction ledger system
- Redis - Caching and Socket.IO adapter
- Socket.IO (with Redis adapter)
- JWT Authentication
- bcryptjs

### Frontend
- React
- Material-UI
- Socket.IO Client
- Axios
- React Router

### Infrastructure
- Docker
- Docker Compose
- Nginx (for frontend)
- GitHub Actions (CI/CD)
- PostgreSQL (for ledger system)

## Project Structure

```
CollaborativeTaskManager/
├── backend/
│   ├── config/
│   │   ├── database.js
│   │   ├── redis.js
│   │   └── postgres.js
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── taskController.js
│   │   └── ledgerController.js
│   ├── middleware/
│   │   ├── auth.js
│   │   └── errorHandler.js
│   ├── models/
│   │   ├── User.js
│   │   └── Task.js
│   ├── routes/
│   │   ├── auth.js
│   │   ├── tasks.js
│   │   └── ledger.js
│   ├── services/
│   │   └── ledgerService.js
│   ├── socket/
│   │   └── socketHandler.js
│   ├── server.js
│   ├── Dockerfile
│   ├── LEDGER_SYSTEM.md
│   └── package.json
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   └── App.js
│   ├── Dockerfile
│   ├── nginx.conf
│   └── package.json
├── docker-compose.yml
├── .github/
│   └── workflows/
│       └── ci-cd.yml
└── README.md
```

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- Docker and Docker Compose
- MongoDB (if running locally)
- PostgreSQL (if running locally)
- Redis (if running locally)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd CollaborativeTaskManager
   ```

2. **Set up environment variables**
   
   Create a `.env` file in the `backend` directory:
   ```env
   NODE_ENV=development
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/taskApp
   REDIS_HOST=localhost
   REDIS_PORT=6379
   POSTGRES_HOST=localhost
   POSTGRES_PORT=5432
   POSTGRES_DB=taskledger
   POSTGRES_USER=postgres
   POSTGRES_PASSWORD=postgres
   JWT_SECRET=your-super-secret-jwt-key-change-in-production
   JWT_EXPIRE=7d
   CORS_ORIGIN=http://localhost:3000
   ```

3. **Run with Docker Compose (Recommended)**
   ```bash
   docker-compose up --build
   ```

   This will start:
   - MongoDB on port 27017
   - PostgreSQL on port 5432
   - Redis on port 6379
   - Backend API on port 5000
   - Frontend on port 3000

4. **Run locally (Development)**

   **Backend:**
   ```bash
   cd backend
   npm install
   npm run dev
   ```

   **Frontend:**
   ```bash
   cd frontend
   npm install
   npm start
   ```

   Make sure MongoDB, PostgreSQL, and Redis are running locally before starting the backend.

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register a new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (Protected)

### Tasks
- `GET /api/tasks` - Get all tasks (Protected)
- `GET /api/tasks/:id` - Get single task (Protected)
- `POST /api/tasks` - Create new task (Protected)
- `PUT /api/tasks/:id` - Update task (Protected)
- `DELETE /api/tasks/:id` - Delete task (Protected)

### Ledger & Points
- `POST /api/ledger/transactions` - Create a ledger transaction (Protected)
- `GET /api/ledger/points/balance` - Get user's points balance (Protected)
- `GET /api/ledger/accounts/:accountId/balance` - Get account balance (Protected)
- `POST /api/ledger/reconcile` - Reconcile accounts (Protected)
- `GET /api/ledger/transactions` - Get transaction history (Protected)
- `GET /api/ledger/audit` - Get audit trail (Protected)

### WebSocket Events
- `task_created` - Emitted when a new task is created
- `task_updated` - Emitted when a task is updated
- `task_deleted` - Emitted when a task is deleted
- `join_task` - Join a task room for real-time updates
- `leave_task` - Leave a task room

## Transaction Ledger System

The application includes a comprehensive double-entry accounting system for tracking points and rewards:

- **Double-Entry Accounting** - Every transaction creates balanced debit/credit entries
- **ACID Compliance** - All transactions are atomic, consistent, isolated, and durable
- **Automatic Points** - Points are automatically awarded when tasks are completed:
  - Low priority: 10 points
  - Medium priority: 25 points
  - High priority: 50 points
- **Reconciliation** - Automated balance verification and reconciliation checks
- **Audit Trail** - Complete immutable audit log of all transactions
- **PostgreSQL Backend** - Robust relational database for financial data integrity

For detailed documentation, see [LEDGER_SYSTEM.md](./backend/LEDGER_SYSTEM.md)

## Performance Optimizations

1. **Redis Caching** - Task queries are cached in Redis to reduce database load
2. **Database Indexing** - Optimized MongoDB and PostgreSQL indexes for faster queries
3. **Redis Adapter** - Socket.IO uses Redis adapter for horizontal scaling
4. **Connection Pooling** - Efficient database connection management for both MongoDB and PostgreSQL
5. **Rate Limiting** - API rate limiting to prevent abuse

## Scalability Features

- **Redis Adapter** - Enables WebSocket scaling across multiple server instances
- **Stateless Authentication** - JWT tokens allow horizontal scaling
- **Caching Layer** - Redis reduces database load
- **Optimized Queries** - Indexed database queries for performance
- **Load Balancing Ready** - Architecture supports load balancing

## CI/CD Pipeline

The project includes a GitHub Actions workflow that:
- Runs backend tests
- Runs frontend tests
- Builds Docker images
- Deploys to production (configure as needed)

## Security Features

- JWT token-based authentication
- Password hashing with bcrypt
- Helmet.js for security headers
- CORS configuration
- Rate limiting
- Input validation
- SQL injection prevention (MongoDB)
- XSS protection

## Environment Variables

### Backend
- `NODE_ENV` - Environment (development/production)
- `PORT` - Server port
- `MONGODB_URI` - MongoDB connection string
- `REDIS_HOST` - Redis host
- `REDIS_PORT` - Redis port
- `POSTGRES_HOST` - PostgreSQL host
- `POSTGRES_PORT` - PostgreSQL port
- `POSTGRES_DB` - PostgreSQL database name
- `POSTGRES_USER` - PostgreSQL username
- `POSTGRES_PASSWORD` - PostgreSQL password
- `JWT_SECRET` - JWT secret key
- `JWT_EXPIRE` - JWT expiration time
- `CORS_ORIGIN` - CORS allowed origin

### Frontend
- `REACT_APP_API_URL` - Backend API URL

## Deployment

### Docker Compose
```bash
docker-compose up -d
```

### Production Deployment
1. Set environment variables in production
2. Use a process manager like PM2 for Node.js
3. Set up reverse proxy (Nginx)
4. Configure SSL certificates
5. Set up monitoring and logging

## Testing

```bash
# Backend tests
cd backend
npm test

# Frontend tests
cd frontend
npm test
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License.

## Author

Developed as a full-stack real-time collaborative task management application.

## Acknowledgments

- Socket.IO for real-time communication
- Material-UI for React components
- MongoDB for document database
- PostgreSQL for relational database and ACID transactions
- Redis for caching and scaling

