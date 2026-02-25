# AgentSmith — Product Requirements Document (v1 Foundations)

---

# 1. Purpose

AgentSmith is a **room-scoped, extensible event fabric** that connects local Claude Code sessions and a shared web canvas.

It enables:

- Ambient presence between developers
- Bidirectional interactions between sessions
- Visual and behavioral extensions without modifying Claude itself
- A foundation for future multiplayer and programmable behaviors

AgentSmith is not:
- A chat system
- A code-sharing platform
- A project management tool

It is a **distributed interaction layer**.

---

# 2. Core Principles

## 2.1 Non-Negotiable Invariants

### 1. No Sensitive Context Leakage

The system must never transmit:

- Source code
- Claude messages
- Prompt content
- File names
- Stack traces
- Diffs
- Error messages
- Any derivative content that reveals what the user is working on

Only coarse, non-reconstructive signals are allowed.

---

### 2. No Blocking Claude

- Network calls must never block Claude hooks
- Pull operations are fire-and-forget
- Event processing only occurs if data is already locally available
- No real-time dependency is required

---

### 3. Extensibility First

- New event types must not require server redesign
- Server must not embed interaction semantics
- Clients own behavior interpretation
- Protocol must support heterogeneous future clients

---

# 3. System Overview

AgentSmith consists of three components.

---

## 3.1 Claude Code Plugin (Client A)

Runs locally inside Claude Code sessions.

Responsibilities:

- Emit events to server
- Pull events from server
- Persist a local event queue
- Apply received events
- Emit lifecycle ACKs
- Detect coarse local session signals

The plugin must not expose sensitive session context.

---

## 3.2 Web Application (Client B)

Shared canvas displaying avatars and room activity.

Responsibilities:

- Render avatars
- Emit user-triggered events
- Display event lifecycle feedback
- Reflect room activity

---

## 3.3 AgentSmith Server

Authoritative room event coordinator.

Responsibilities:

- Authenticate users
- Maintain room-scoped event streams
- Assign global sequence numbers
- Enforce TTL bounds
- Route events
- Relay lifecycle ACKs

The server does **not**:

- Interpret event semantics
- Inspect Claude content
- Execute arbitrary logic
- Embed interaction meaning

---

# 4. Event Fabric Architecture

## 4.1 Room-Scoped Event Log

Each room maintains:

- A globally ordered event stream
- Monotonically increasing sequence numbers
- At-most-once delivery semantics
- TTL-bounded durability

The server assigns authoritative sequence numbers.

---

## 4.2 Delivery Model

Clients:

- Pull events using `since_seq`
- Receive events where `seq > since_seq`
- Omit expired events
- Never block execution while waiting for events

No background daemon is required.

---

## 4.3 Event Lifecycle

1. Sender emits event
2. Server validates and assigns `seq`
3. Server responds with `ACK: accepted`
4. Recipient pulls event
5. Recipient applies event
6. Recipient sends `ACK: applied | rejected`
7. Server forwards lifecycle ACK to original sender

Clients self-declare application state.

---

## 4.4 Local Event Queue (Claude Plugin)

- FIFO queue
- Capacity: 20 events
- Drop oldest when full
- Events expire based on TTL
- Events processed only at hook boundaries

---

# 5. Privacy Model

## 5.1 Allowed Outbound Signals

The plugin may transmit coarse session states such as:

- `TestsPassed`
- `BuildFailed`
- `HighTokenUsage`
- `Idle`
- `LongRunningCommand`

These are abstract signals only.

---

## 5.2 Forbidden Data

The plugin must never transmit:

- File paths
- Code snippets
- Error details
- Claude responses
- Prompt contents
- Stack traces
- Any contextual data tied to the user’s work

---

# 6. Core Concepts

## 6.1 Identity

- Users authenticate via OAuth
- Identity is global
- Sessions are ephemeral

---

## 6.2 Avatar

Each Claude session corresponds to one avatar instance.

Avatars reflect:

- Presence
- Coarse state
- Interaction effects

Avatars are visual projections of interpreted events.

---

## 6.3 Rooms

Rooms are logical namespaces for event streams.

Properties:

- Unique identifier
- Shared event log
- Membership grants visibility to coarse session states
- No complex permission model in v1

---

# 7. Interaction Model

Interactions are generic events.

Each event contains:

- `room_id`
- `sender_id`
- `sequence`
- `ttl`
- `payload` (opaque to server)

The server does not interpret payload content.

Clients define event meaning.

This enables:

- Visual-only effects
- Claude-side behavioral effects
- Future programmable behaviors
- New client types without server changes

---

# 8. Non-Real-Time Design

AgentSmith has no real-time guarantees.

- No push required
- No streaming dependency
- No synchronous coordination
- Effects occur at natural Claude hook boundaries

This ensures Claude performance is preserved.

---

# 9. Extensibility Model

The architecture supports:

- New event types without protocol changes
- Multiple client implementations
- Heterogeneous room participants
- Future automation agents
- Programmable interaction layers

The server remains event-generic.

Clients evolve independently.

---

# 10. Server Enforcement Boundaries

The server enforces:

- Authentication
- Room membership validation
- TTL bounds
- Payload size limits
- Basic rate limits

The server does not enforce semantic meaning.

---

# 11. v1 Scope

Included:

- Room event fabric
- Claude plugin
- Web avatar canvas
- Coarse session state broadcasting
- Event lifecycle ACKs
- FIFO queue (size 20)
- TTL-based expiration

Excluded:

- Persistent history
- Replay system
- Enterprise governance
- Advanced moderation
- Complex permission models
- Deep game mechanics

---

# 12. Success Criteria

AgentSmith v1 is successful if:

- Claude performance remains unaffected
- No sensitive data leaves local sessions
- Events propagate reliably
- New interaction types can be added without server redesign
- The system behaves predictably under load and expiration

---

# 13. Definition

AgentSmith is a minimal, ordered, room-scoped event runtime connecting local AI sessions and a shared canvas.

It is infrastructure, not a feature.