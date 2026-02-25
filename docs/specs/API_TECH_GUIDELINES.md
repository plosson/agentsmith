# API Tech Guidelines

> **Status:** Draft
> **Date:** January 2026

This document describes the technology stack and patterns for building REST APIs with Bun and Hono.

---

## Stack Overview

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Bun | 1.3.x | JavaScript runtime |
| **Server** | Hono | 4.11.x | HTTP framework |

> **Version Policy:** Always use the latest stable version of each package. The versions listed above are minimum requirements, not constraints. Using older versions than those specified is not supported.

---

## Design Principles

### 1. JSON Over HTML
API endpoints return **JSON**, not HTML. The server is the single source of truth for data.

```tsx
app.get('/api/items', async (c) => {
  const items = await db.getItems()
  return c.json({ data: items })
})
```

### 2. RESTful Design
Follow REST conventions for resource-based routing and HTTP methods.

```
GET    /api/items          # List items
GET    /api/items/:id      # Get single item
POST   /api/items          # Create item
PUT    /api/items/:id      # Update item (full)
PATCH  /api/items/:id      # Update item (partial)
DELETE /api/items/:id      # Delete item
```

### 3. Consistent Response Format
Use a consistent envelope for all responses.

```tsx
// Success response
{
  "data": { ... },
  "meta": { "page": 1, "total": 100 }
}

// Error response
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Item not found"
  }
}
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client                                │
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Hono Server (Bun)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Middleware │  │   Routes    │  │   WebSocket Hub     │  │
│  │  (auth,cors)│  │  (handlers) │  │   (real-time)       │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Services / Database                    ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
src/
├── index.ts              # Entry point
├── app.ts                # Hono app setup
├── routes/
│   ├── items.ts          # Item routes
│   ├── users.ts          # User routes
│   └── ws.ts             # WebSocket handlers
├── middleware/
│   ├── auth.ts           # Authentication
│   ├── error.ts          # Error handling
│   └── logger.ts         # Request logging
├── services/
│   ├── items.ts          # Item business logic
│   └── users.ts          # User business logic
├── db/
│   └── client.ts         # Database client
└── lib/
    ├── ws-hub.ts         # WebSocket broadcast
    └── utils.ts          # Utilities
```

---

## Hono Patterns

### App Setup

```tsx
// src/app.ts
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { itemsRoutes } from './routes/items'
import { usersRoutes } from './routes/users'
import { errorHandler } from './middleware/error'

const app = new Hono()

// Global middleware
app.use('*', logger())
app.use('*', cors())
app.onError(errorHandler)

// Routes
app.route('/api/items', itemsRoutes)
app.route('/api/users', usersRoutes)

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }))

export default app
```

### Entry Point

```tsx
// src/index.ts
import app from './app'

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
}
```

### Route Handlers

```tsx
// src/routes/items.ts
import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import * as itemService from '../services/items'

export const itemsRoutes = new Hono()

// List items with filtering
itemsRoutes.get('/', async (c) => {
  const status = c.req.query('status')
  const search = c.req.query('q')
  const page = parseInt(c.req.query('page') || '1')
  const limit = parseInt(c.req.query('limit') || '20')

  const { items, total } = await itemService.list({ status, search, page, limit })

  return c.json({
    data: items,
    meta: { page, limit, total }
  })
})

// Get single item
itemsRoutes.get('/:id', async (c) => {
  const id = c.req.param('id')
  const item = await itemService.getById(id)

  if (!item) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, 404)
  }

  return c.json({ data: item })
})

// Create item with validation
const createItemSchema = z.object({
  name: z.string().min(1).max(255),
  status: z.enum(['active', 'inactive']).optional(),
})

itemsRoutes.post('/', zValidator('json', createItemSchema), async (c) => {
  const body = c.req.valid('json')
  const item = await itemService.create(body)

  return c.json({ data: item }, 201)
})

// Update item
const updateItemSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  status: z.enum(['active', 'inactive']).optional(),
})

itemsRoutes.patch('/:id', zValidator('json', updateItemSchema), async (c) => {
  const id = c.req.param('id')
  const body = c.req.valid('json')

  const item = await itemService.update(id, body)

  if (!item) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, 404)
  }

  return c.json({ data: item })
})

// Delete item
itemsRoutes.delete('/:id', async (c) => {
  const id = c.req.param('id')
  const deleted = await itemService.remove(id)

  if (!deleted) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Item not found' } }, 404)
  }

  return c.json({ data: { deleted: true } })
})
```

---

## Middleware

### Error Handler

```tsx
// src/middleware/error.ts
import { ErrorHandler } from 'hono'

export const errorHandler: ErrorHandler = (err, c) => {
  console.error(err)

  if (err instanceof ValidationError) {
    return c.json({
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        details: err.details
      }
    }, 400)
  }

  if (err instanceof AuthenticationError) {
    return c.json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required'
      }
    }, 401)
  }

  return c.json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred'
    }
  }, 500)
}
```

### Authentication

```tsx
// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory'

export const authMiddleware = createMiddleware(async (c, next) => {
  const token = c.req.header('Authorization')?.replace('Bearer ', '')

  if (!token) {
    return c.json({
      error: { code: 'UNAUTHORIZED', message: 'Missing token' }
    }, 401)
  }

  try {
    const user = await verifyToken(token)
    c.set('user', user)
    await next()
  } catch {
    return c.json({
      error: { code: 'UNAUTHORIZED', message: 'Invalid token' }
    }, 401)
  }
})

// Usage
app.use('/api/*', authMiddleware)
```

### Request Validation

```tsx
// Using Zod with Hono validator
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'

const querySchema = z.object({
  page: z.coerce.number().int().positive().optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  status: z.enum(['active', 'inactive', 'all']).optional(),
})

app.get('/api/items', zValidator('query', querySchema), async (c) => {
  const { page, limit, status } = c.req.valid('query')
  // ...
})
```

---

## WebSocket (Real-time)

### WebSocket Handler

```tsx
// src/routes/ws.ts
import { Hono } from 'hono'
import { createBunWebSocket } from 'hono/bun'

const { upgradeWebSocket, websocket } = createBunWebSocket()

export const wsApp = new Hono()

const clients = new Set<WebSocket>()

wsApp.get('/ws/events', upgradeWebSocket((c) => ({
  onOpen(event, ws) {
    clients.add(ws.raw)
    ws.send(JSON.stringify({ type: 'connected' }))
  },
  onMessage(event, ws) {
    const message = JSON.parse(event.data.toString())
    // Handle incoming messages
  },
  onClose(event, ws) {
    clients.delete(ws.raw)
  }
})))

export { websocket }
```

### Broadcasting

```tsx
// src/lib/ws-hub.ts
type BroadcastMessage = {
  type: string
  data: unknown
}

export function broadcast(message: BroadcastMessage) {
  const payload = JSON.stringify(message)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  }
}

// Usage: broadcast on events
export function onItemCreated(item: Item) {
  broadcast({
    type: 'item:created',
    data: item
  })
}

export function onItemUpdated(item: Item) {
  broadcast({
    type: 'item:updated',
    data: item
  })
}
```

### Server Entry with WebSocket

```tsx
// src/index.ts
import app from './app'
import { websocket } from './routes/ws'

export default {
  port: process.env.PORT || 3000,
  fetch: app.fetch,
  websocket,
}
```

---

## Error Handling

### Custom Error Classes

```tsx
// src/lib/errors.ts
export class AppError extends Error {
  constructor(
    public code: string,
    message: string,
    public statusCode: number = 500
  ) {
    super(message)
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super('NOT_FOUND', `${resource} not found`, 404)
  }
}

export class ValidationError extends AppError {
  constructor(message: string, public details?: unknown) {
    super('VALIDATION_ERROR', message, 400)
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized') {
    super('UNAUTHORIZED', message, 401)
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super('FORBIDDEN', message, 403)
  }
}
```

### Using Errors in Services

```tsx
// src/services/items.ts
import { NotFoundError } from '../lib/errors'

export async function getById(id: string) {
  const item = await db.items.findUnique({ where: { id } })

  if (!item) {
    throw new NotFoundError('Item')
  }

  return item
}
```

---

## Testing

### Unit Tests

```tsx
// src/routes/items.test.ts
import { describe, it, expect } from 'bun:test'
import app from '../app'

describe('GET /api/items', () => {
  it('returns a list of items', async () => {
    const res = await app.request('/api/items')
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data).toBeArray()
    expect(json.meta).toHaveProperty('total')
  })

  it('filters by status', async () => {
    const res = await app.request('/api/items?status=active')
    expect(res.status).toBe(200)

    const json = await res.json()
    expect(json.data.every((item: any) => item.status === 'active')).toBe(true)
  })
})

describe('POST /api/items', () => {
  it('creates a new item', async () => {
    const res = await app.request('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Item' })
    })
    expect(res.status).toBe(201)

    const json = await res.json()
    expect(json.data.name).toBe('Test Item')
  })

  it('validates required fields', async () => {
    const res = await app.request('/api/items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    expect(res.status).toBe(400)
  })
})
```

### Running Tests

```bash
bun test
bun test --watch
bun test src/routes/items.test.ts
```

---

## Configuration

### Environment Variables

```tsx
// src/lib/config.ts
export const config = {
  port: parseInt(process.env.PORT || '3000'),
  env: process.env.NODE_ENV || 'development',
  database: {
    url: process.env.DATABASE_URL!,
  },
  jwt: {
    secret: process.env.JWT_SECRET!,
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
}

// Validate required env vars at startup
const required = ['DATABASE_URL', 'JWT_SECRET']
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
}
```

---

## Performance Considerations

1. **Bun Runtime**: Fast startup, efficient memory usage
2. **Connection Pooling**: Use connection pools for database access
3. **Response Compression**: Enable gzip/brotli for large responses
4. **Caching**: Use `Cache-Control` headers and consider Redis for frequently accessed data
5. **Pagination**: Always paginate list endpoints to avoid large payloads

---

## Dependencies

Always use the latest stable versions. The versions below are minimum requirements:

```json
{
  "dependencies": {
    "hono": "^4.11.4",
    "@hono/zod-validator": "^0.7.6",
    "zod": "^4.3.5"
  },
  "devDependencies": {
    "bun-types": "latest",
    "@types/bun": "latest"
  }
}
```
