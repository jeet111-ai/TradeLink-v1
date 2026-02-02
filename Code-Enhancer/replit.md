# TradeSync - Multi-Asset Trading Journal & Portfolio Tracker

## Overview

TradeSync is a comprehensive trading journal and portfolio tracking application designed for professional traders who manage both aggressive Futures/Intraday trading and long-term Stock investments. The application separates these two activities to prevent long-term holdings from skewing day-trading statistics.

The app supports two main "segments":
1. **The Trading Engine (Futures/Intraday)** - Focuses on Realized P&L, Win Rate, and Risk Management
2. **The Investment Vault (Stocks/Long Term)** - Focuses on Unrealized P&L, Total Allocation, and Average Buy Price

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state
- **Styling**: Tailwind CSS with dark mode fintech theme
- **UI Components**: shadcn/ui component library (New York style)
- **Charts**: Recharts for financial visualizations (P&L curves, allocation pies)
- **Form Handling**: React Hook Form with Zod validation

### Backend Architecture
- **Runtime**: Node.js with Express 5
- **Language**: TypeScript (ES Modules)
- **API Style**: RESTful JSON API under `/api/*` routes
- **Build Tool**: Vite for frontend, esbuild for server bundling

### Data Storage
- **Database**: PostgreSQL
- **ORM**: Drizzle ORM with drizzle-zod for schema validation
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit (`db:push` command)

### Key Database Schema
The `trades` table handles both trading and investment records with these differentiators:
- `type`: String field (can be 'FUTURES', 'EQUITY_INTRADAY', 'LONG_TERM_HOLDING', or custom types)
- `status`: Enum ('OPEN', 'CLOSED')
- `side`: Enum ('LONG', 'SHORT')
- Trading-specific fields: `strategy`, `leverage`, `stopLoss`, `targetPrice`
- Investment-specific fields: `sector`, `fundamentalReason`

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # UI components (shadcn + custom)
│   ├── hooks/           # React Query hooks for API calls
│   ├── pages/           # Route pages (Dashboard, Journal, Portfolio, Analytics)
│   └── lib/             # Utilities and query client
├── server/              # Express backend
│   ├── routes.ts        # API route handlers
│   ├── storage.ts       # Database access layer
│   └── db.ts            # Drizzle database connection
├── shared/              # Shared code (schema, route definitions)
└── migrations/          # Drizzle database migrations
```

### Development Workflow
- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm run db:push` - Push schema changes to database

## External Dependencies

### Database
- **PostgreSQL** - Primary database, connection via `DATABASE_URL` environment variable
- **connect-pg-simple** - PostgreSQL session store (available but not currently active)

### UI/Visualization
- **Recharts** - Financial charting library for equity curves and pie charts
- **Radix UI** - Headless UI primitives (dialogs, dropdowns, tooltips, etc.)
- **Lucide React** - Icon library

### Build & Development
- **Vite** - Frontend build tool with HMR
- **esbuild** - Server bundling for production
- **Drizzle Kit** - Database schema management

### Replit-Specific
- **@replit/vite-plugin-runtime-error-modal** - Error overlay for development
- **@replit/vite-plugin-cartographer** - Development tooling (dev only)
- **@replit/vite-plugin-dev-banner** - Development banner (dev only)

## Recent Changes
- Project imported and configured for Replit environment
- Database schema pushed to PostgreSQL
- Sample seed data added for demonstration
