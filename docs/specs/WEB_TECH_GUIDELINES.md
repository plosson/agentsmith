# Web Tech Guidelines

> **Status:** Draft
> **Date:** January 2026

This document describes the technology stack and patterns for building HTML-first admin UIs with minimal client-side JavaScript.

---

## Stack Overview

| Layer | Technology | Version | Purpose |
|-------|------------|---------|---------|
| **Runtime** | Bun | 1.3.x | JavaScript runtime |
| **Server** | Hono | 4.11.x | HTTP framework + JSX templates |
| **Interactivity** | HTMX | 2.0.x | Server communication via HTML attributes |
| **Client State** | Alpine.js | 3.15.x | Local UI state (modals, dropdowns, shortcuts) |
| **Styling** | Tailwind CSS | 4.x (CDN) | Utility-first CSS |
| **Icons** | HugeIcons | CDN | Icon library |
| **Fonts** | Google Fonts | CDN | Geist (sans), Fira Mono (mono) |

> **Version Policy:** Always use the latest stable version of each package. The versions listed above are minimum requirements, not constraints. Using older versions than those specified is not supported.

**Total client-side JS:** ~30kb gzipped (HTMX + Alpine.js)

---

## Design Principles

### 1. HTML Over JavaScript
The UI is **HTML-first**. Interactive behavior is declared in HTML attributes, not JavaScript files.

```html
<!-- HTMX: Server fetches HTML fragment -->
<button hx-get="/api/items" hx-target="#table">Refresh</button>

<!-- Alpine: Local state in attributes -->
<div x-data="{ open: false }">
  <button @click="open = !open">Toggle</button>
</div>
```

### 2. Server Renders HTML, Not JSON
API endpoints return **HTML fragments**, not JSON. The server is the single source of truth.

```tsx
// Server returns rendered HTML
app.get('/api/items', async (c) => {
  const items = await db.getItems()
  return c.html(<ItemsTable items={items} />)
})
```

### 3. No Build Step
All dependencies load via CDN. No bundler, no compilation, no `node_modules` for frontend.

### 4. Progressive Enhancement
Core functionality works without JavaScript. HTMX and Alpine add interactivity on top.

---

## Dependencies

### HTML Head Template

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin UI</title>

  <!-- Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Fira+Mono:wght@400;500&display=swap" rel="stylesheet">

  <!-- Icons -->
  <link rel="stylesheet" href="https://sets.hugeicons.com/7v2rm862ty6.css" crossorigin="anonymous">

  <!-- Tailwind CSS (CDN - no build) -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          fontFamily: {
            sans: ['Geist', 'system-ui', 'sans-serif'],
            mono: ['Fira Mono', 'monospace'],
          },
          colors: {
            primary: {
              100: '#d7d7d7',
              500: '#868686',
              600: '#727272',
              900: '#363636',
              1000: '#222222',
            },
            gray: {
              50: '#fafafa',
              70: '#f6f6f6',
              100: '#ffffff',
              200: '#e6e6e6',
              300: '#cecece',
              400: '#b5b5b5',
              500: '#9d9d9d',
              600: '#848484',
              700: '#6c6c6c',
              800: '#535353',
              900: '#3b3b3b',
            }
          }
        }
      }
    }
  </script>

  <!-- HTMX -->
  <script src="https://unpkg.com/htmx.org@2.0.8"></script>
  <script src="https://unpkg.com/htmx-ext-ws@2.0.4/ws.js"></script>

  <!-- Alpine.js -->
  <script defer src="https://unpkg.com/alpinejs@3.15.3/dist/cdn.min.js"></script>

  <!-- App styles -->
  <style>
    /* Custom styles that extend Tailwind */
  </style>
</head>
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                               │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Alpine.js │  │    HTMX     │  │   HTMX WebSocket    │  │
│  │  (UI state) │  │   (AJAX)    │  │   (real-time)       │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │             │
│         ▼                ▼                     ▼             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                    HTML DOM                              ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
                           │
                           │ HTTP / WebSocket
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                     Hono Server (Bun)                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Pages      │  │  Partials   │  │   WebSocket Hub     │  │
│  │  (full HTML)│  │  (fragments)│  │   (push updates)    │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
│                           │                                  │
│                           ▼                                  │
│  ┌─────────────────────────────────────────────────────────┐│
│  │                   Backend / Database                     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

1. **Initial page load**: Server renders full HTML page
2. **User interaction**: HTMX sends request, server returns HTML fragment
3. **HTMX swaps**: Fragment replaces target element in DOM
4. **Real-time**: WebSocket pushes HTML fragments for live updates

---

## HTMX Patterns

### Basic AJAX

```html
<!-- GET request, replace target -->
<button
  hx-get="/api/items"
  hx-target="#items-table"
  hx-swap="innerHTML"
>
  Refresh
</button>

<div id="items-table">
  <!-- Content replaced here -->
</div>
```

### Form Submission

```html
<form
  hx-post="/api/items/42/delete"
  hx-target="#item-42"
  hx-swap="outerHTML"
  hx-confirm="Are you sure you want to delete this item?"
>
  <button type="submit">Delete</button>
</form>
```

### Search with Debounce

```html
<input
  type="search"
  name="q"
  placeholder="Search..."
  hx-get="/api/items"
  hx-target="#items-table"
  hx-trigger="input changed delay:300ms, search"
  hx-include="[name='status']"
>
```

### Loading States

```html
<button
  hx-get="/api/items"
  hx-target="#items-table"
  hx-indicator="#loading"
>
  Refresh
</button>

<span id="loading" class="htmx-indicator">
  Loading...
</span>
```

### Infinite Scroll / Pagination

```html
<tbody id="items-table">
  <!-- rows -->
  <tr hx-get="/api/items?page=2"
      hx-trigger="revealed"
      hx-swap="afterend">
    <td colspan="6">Loading more...</td>
  </tr>
</tbody>
```

### Out-of-Band Updates

Server can update multiple elements with one response:

```html
<!-- Server response -->
<tbody id="items-table" hx-swap-oob="true">
  <!-- Updated table content -->
</tbody>

<span id="item-count" hx-swap-oob="true">
  23 items
</span>
```

---

## WebSocket (Real-time Updates)

### Connection Setup

```html
<div hx-ext="ws" ws-connect="/ws/events">
  <!-- Activity stream - new items prepended -->
  <div id="activity-stream" hx-swap-oob="afterbegin">
  </div>

  <!-- Stats updated in place -->
  <div id="stats-cards">
  </div>
</div>
```

### Server Push

```tsx
// Server broadcasts HTML fragments
ws.send(`
  <div id="activity-stream" hx-swap-oob="afterbegin">
    <div class="activity-item">
      10:32 - New item created
    </div>
  </div>

  <span id="total-count" hx-swap-oob="true">
    48
  </span>
`)
```

### Reconnection

HTMX WebSocket extension handles reconnection automatically with exponential backoff.

---

## Alpine.js Patterns

### Dropdowns

```html
<div x-data="{ open: false }" class="relative">
  <button
    @click="open = !open"
    class="select-trigger"
  >
    <span x-text="selected || 'All'"></span>
    <i class="hgi hgi-stroke hgi-arrow-down-01"></i>
  </button>

  <div
    x-show="open"
    x-transition
    @click.away="open = false"
    class="select-content absolute mt-1"
  >
    <button @click="selected = 'Active'; open = false">Active</button>
    <button @click="selected = 'Inactive'; open = false">Inactive</button>
  </div>
</div>
```

### Modal / Slide Panel

```html
<div
  x-data="{ open: false }"
  @open-panel.window="open = true; panelData = $event.detail"
>
  <!-- Trigger -->
  <button @click="$dispatch('open-panel', { id: 42 })">
    View Details
  </button>

  <!-- Backdrop -->
  <div
    x-show="open"
    x-transition.opacity
    @click="open = false"
    class="fixed inset-0 bg-black/50"
  ></div>

  <!-- Panel -->
  <div
    x-show="open"
    x-transition:enter="transition ease-out duration-300"
    x-transition:enter-start="translate-x-full"
    x-transition:enter-end="translate-x-0"
    x-transition:leave="transition ease-in duration-200"
    x-transition:leave-start="translate-x-0"
    x-transition:leave-end="translate-x-full"
    class="fixed right-0 top-0 h-full w-96 bg-white shadow-xl"
  >
    <button @click="open = false">Close</button>
    <div
      hx-get="/api/items/detail"
      hx-vals="js:{id: panelData.id}"
      hx-trigger="open-panel from:window"
    >
      <!-- Content loaded via HTMX -->
    </div>
  </div>
</div>
```

### Tabs

```html
<div x-data="{ tab: 'general' }">
  <div class="tabs-list">
    <button
      :class="tab === 'general' ? 'tabs-trigger-active' : 'tabs-trigger'"
      @click="tab = 'general'"
    >General</button>
    <button
      :class="tab === 'settings' ? 'tabs-trigger-active' : 'tabs-trigger'"
      @click="tab = 'settings'"
    >Settings</button>
    <button
      :class="tab === 'advanced' ? 'tabs-trigger-active' : 'tabs-trigger'"
      @click="tab = 'advanced'"
    >Advanced</button>
  </div>

  <div x-show="tab === 'general'">General content</div>
  <div x-show="tab === 'settings'">Settings content</div>
  <div x-show="tab === 'advanced'">Advanced content</div>
</div>
```

### Keyboard Shortcuts

```html
<div
  x-data
  @keydown.meta.k.window.prevent="$dispatch('open-command-palette')"
  @keydown.meta.1.window.prevent="window.location = '/dashboard'"
  @keydown.meta.2.window.prevent="window.location = '/items'"
  @keydown.meta.3.window.prevent="window.location = '/settings'"
  @keydown.meta.r.window.prevent="htmx.trigger(document.body, 'refresh')"
  @keydown.escape.window="$dispatch('close-all')"
>
  <!-- App content -->
</div>
```

### Command Palette

```html
<div
  x-data="{
    open: false,
    search: '',
    selected: 0,
    results: []
  }"
  @open-command-palette.window="open = true; $nextTick(() => $refs.input.focus())"
  @close-all.window="open = false"
  @keydown.escape="open = false"
>
  <!-- Backdrop -->
  <div x-show="open" x-transition.opacity class="fixed inset-0 bg-black/50" @click="open = false"></div>

  <!-- Palette -->
  <div
    x-show="open"
    x-transition
    class="fixed top-[15vh] left-1/2 -translate-x-1/2 w-full max-w-xl bg-white rounded-lg shadow-2xl"
  >
    <input
      x-ref="input"
      x-model="search"
      @keydown.down.prevent="selected = Math.min(selected + 1, results.length - 1)"
      @keydown.up.prevent="selected = Math.max(selected - 1, 0)"
      @keydown.enter.prevent="executeCommand(results[selected])"
      placeholder="Search commands..."
      class="w-full p-4 border-b"
    >

    <div class="max-h-96 overflow-auto">
      <!-- Results rendered here -->
    </div>
  </div>
</div>
```

### Toast Notifications

```html
<div
  x-data="{
    toasts: [],
    add(toast) {
      const id = Date.now()
      this.toasts.push({ id, ...toast })
      setTimeout(() => this.remove(id), 5000)
    },
    remove(id) {
      this.toasts = this.toasts.filter(t => t.id !== id)
    }
  }"
  @toast.window="add($event.detail)"
  class="fixed bottom-4 right-4 space-y-2 z-50"
>
  <template x-for="toast in toasts" :key="toast.id">
    <div
      x-transition
      :class="{
        'bg-green-50 border-green-200': toast.type === 'success',
        'bg-red-50 border-red-200': toast.type === 'error',
        'bg-blue-50 border-blue-200': toast.type === 'info',
        'bg-amber-50 border-amber-200': toast.type === 'warning'
      }"
      class="p-4 rounded-lg border shadow-lg"
    >
      <p x-text="toast.message"></p>
      <button @click="remove(toast.id)">Dismiss</button>
    </div>
  </template>
</div>

<!-- Trigger toast from anywhere -->
<button @click="$dispatch('toast', { type: 'success', message: 'Action completed' })">
  Test Toast
</button>
```

---

## Hono Server Patterns

### Project Structure

```
src/
├── index.ts              # Entry point
├── app.ts                # Hono app setup
├── routes/
│   ├── pages.tsx         # Full page routes
│   ├── api/
│   │   ├── items.tsx     # Item partials
│   │   ├── users.tsx     # User partials
│   │   └── ...
│   └── ws.ts             # WebSocket handlers
├── components/
│   ├── Layout.tsx        # Page layout
│   ├── Sidebar.tsx       # Navigation
│   ├── DataGrid.tsx      # Reusable table
│   ├── StatusBadge.tsx   # Status indicators
│   └── ...
├── services/
│   └── api.ts            # Backend API client
└── lib/
    └── ws-hub.ts         # WebSocket broadcast
```

### App Setup

```tsx
// src/app.ts
import { Hono } from 'hono'
import { serveStatic } from 'hono/bun'
import { pages } from './routes/pages'
import { itemsApi } from './routes/api/items'
import { usersApi } from './routes/api/users'

const app = new Hono()

// Static files
app.use('/public/*', serveStatic({ root: './' }))

// Full pages
app.route('/', pages)

// API partials (return HTML fragments)
app.route('/api/items', itemsApi)
app.route('/api/users', usersApi)

export default app
```

### Full Page Route

```tsx
// src/routes/pages.tsx
import { Hono } from 'hono'
import { Layout } from '../components/Layout'
import { ItemsPage } from '../components/pages/Items'

export const pages = new Hono()

pages.get('/items', async (c) => {
  const items = await fetchItems()

  return c.html(
    <Layout title="Items" active="items">
      <ItemsPage items={items} />
    </Layout>
  )
})
```

### API Partial Route

```tsx
// src/routes/api/items.tsx
import { Hono } from 'hono'
import { ItemsTable } from '../../components/ItemsTable'

export const itemsApi = new Hono()

// Returns HTML fragment, not JSON
itemsApi.get('/', async (c) => {
  const status = c.req.query('status')
  const search = c.req.query('q')

  const items = await fetchItems({ status, search })

  return c.html(<ItemsTable items={items} />)
})

// Delete item, return empty to remove row
itemsApi.post('/:id/delete', async (c) => {
  const id = c.req.param('id')
  await deleteItem(id)

  return c.html(<></>)
})
```

### Layout Component

```tsx
// src/components/Layout.tsx
import { FC, PropsWithChildren } from 'hono/jsx'
import { Sidebar } from './Sidebar'

type LayoutProps = PropsWithChildren<{
  title: string
  active: string
}>

export const Layout: FC<LayoutProps> = ({ title, active, children }) => (
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>{title} - Admin</title>

      {/* CDN dependencies */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <link rel="stylesheet" href="https://sets.hugeicons.com/7v2rm862ty6.css" crossorigin="anonymous" />
      <script src="https://cdn.tailwindcss.com"></script>
      <script src="https://unpkg.com/htmx.org@2.0.8"></script>
      <script src="https://unpkg.com/htmx-ext-ws@2.0.4/ws.js"></script>
      <script defer src="https://unpkg.com/alpinejs@3.15.3/dist/cdn.min.js"></script>

      {/* Tailwind config */}
      <script dangerouslySetInnerHTML={{ __html: `
        tailwind.config = {
          darkMode: 'class',
          theme: {
            extend: {
              fontFamily: {
                sans: ['Geist', 'system-ui', 'sans-serif'],
                mono: ['Fira Mono', 'monospace'],
              }
            }
          }
        }
      `}} />
    </head>
    <body
      class="font-sans bg-gray-50"
      x-data
      @keydown.meta.k.window.prevent="$dispatch('open-command-palette')"
    >
      <div class="flex h-screen" hx-ext="ws" ws-connect="/ws/events">
        <Sidebar active={active} />
        <main class="flex-1 overflow-auto p-4">
          {children}
        </main>
      </div>

      {/* Global components */}
      <CommandPalette />
      <ToastContainer />
    </body>
  </html>
)
```

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
  },
  onClose(event, ws) {
    clients.delete(ws.raw)
  }
})))

// Broadcast HTML fragment to all clients
export function broadcast(html: string) {
  for (const client of clients) {
    client.send(html)
  }
}

// Usage: broadcast on events
export function onItemCreated(item: Item) {
  broadcast(`
    <div id="activity-stream" hx-swap-oob="afterbegin">
      <div class="activity-item">
        ${new Date().toLocaleTimeString()} - Item "${item.name}" created
      </div>
    </div>
    <span id="item-count" hx-swap-oob="true">
      ${getItemCount()} total
    </span>
  `)
}
```

---

## Data Grid Component

A reusable data grid pattern for tables:

```tsx
// src/components/DataGrid.tsx
import { FC } from 'hono/jsx'

type Column<T> = {
  key: keyof T
  label: string
  width?: string
  render?: (value: any, row: T) => JSX.Element
}

type DataGridProps<T> = {
  id: string
  columns: Column<T>[]
  rows: T[]
  rowKey: keyof T
  onRowClick?: string  // HTMX endpoint
  emptyMessage?: string
}

export function DataGrid<T>({ id, columns, rows, rowKey, onRowClick, emptyMessage }: DataGridProps<T>) {
  if (rows.length === 0) {
    return (
      <div class="data-grid">
        <div class="p-8 text-center text-gray-500">
          <p class="text-sm">{emptyMessage || 'No data'}</p>
        </div>
      </div>
    )
  }

  return (
    <div class="data-grid">
      <div class="data-grid-header">
        {columns.map(col => (
          <div class="data-grid-header-cell" style={col.width ? `width: ${col.width}` : 'flex: 1'}>
            {col.label}
          </div>
        ))}
      </div>
      <div class="data-grid-body" id={id}>
        {rows.map(row => (
          <div
            class={`data-grid-row ${onRowClick ? 'data-grid-row--clickable' : ''}`}
            id={`${id}-${row[rowKey]}`}
            {...(onRowClick ? {
              'hx-get': `${onRowClick}/${row[rowKey]}`,
              'hx-target': '#detail-panel',
              'hx-trigger': 'click'
            } : {})}
          >
            {columns.map(col => (
              <div class="data-grid-cell" style={col.width ? `width: ${col.width}` : 'flex: 1'}>
                {col.render ? col.render(row[col.key], row) : String(row[col.key])}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Usage

```tsx
<DataGrid
  id="items-table"
  columns={[
    { key: 'id', label: 'ID', width: '60px' },
    { key: 'name', label: 'NAME' },
    { key: 'status', label: 'STATUS', width: '100px' },
    { key: 'createdAt', label: 'CREATED', width: '120px' },
    {
      key: 'isActive',
      label: 'ACTIVE',
      width: '60px',
      render: (val) => <StatusIndicator active={val} />
    },
  ]}
  rows={items}
  rowKey="id"
  onRowClick="/api/items/detail"
  emptyMessage="No items found"
/>
```

---

## Styling Strategy

### Base Styles

Create a `<style>` block in the layout with CSS custom properties and component classes:

```css
:root {
  --color-primary-100: #d7d7d7;
  --color-primary-500: #868686;
  --color-primary-600: #727272;
  --color-primary-900: #363636;
  --color-primary-1000: #222222;
}

.dark {
  --color-primary-100: #5a5a5c;
  --color-primary-1000: #ffffff;
}

/* Component classes */
.btn { /* ... */ }
.form-input { /* ... */ }
.status { /* ... */ }
.data-grid { /* ... */ }
```

### Tailwind for Layout

Use Tailwind utilities for layout, spacing, and one-off styles:

```html
<div class="flex items-center gap-4 p-4">
  <input class="form-input w-48" />
  <button class="btn btn-primary">Search</button>
</div>
```

---

## Testing

### Manual Testing

1. Start server: `bun run dev`
2. Open browser: `http://localhost:3000`
3. Use browser DevTools Network tab to verify:
   - Initial page loads complete HTML
   - HTMX requests return HTML fragments
   - WebSocket connects and receives updates

### HTMX Debugging

```html
<!-- Enable HTMX debug logging -->
<script>
  htmx.logAll()
</script>
```

### Alpine.js Debugging

```html
<!-- Access Alpine data in console -->
<div x-data="{ count: 0 }" x-ref="counter">
  <!-- In console: $0.__x.$data -->
</div>
```

---

## Performance Considerations

1. **Initial Load**: Single HTML response, no JS bundle to parse
2. **Subsequent Requests**: Small HTML fragments (typically <5kb)
3. **WebSocket**: Efficient for real-time, avoids polling
4. **Caching**: Add `Cache-Control` headers for static partials
5. **CDN**: All dependencies cached by browser across sessions

---

## Migration Path

If the application grows and needs more sophisticated client-side state:

1. **Alpine → Alpine + Stores**: Alpine's `$store` for global state
2. **HTMX → HTMX + JSON**: Can return JSON and use `hx-swap="none"` with Alpine
3. **Full Migration**: Extract components to Preact/React if needed (unlikely)

The current stack should handle most admin UI requirements without needing migration.
