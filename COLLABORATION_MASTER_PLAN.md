# Master Plan: Order Reception Real-Time Collaboration (Google Sheets Style)

This document outlines the architectural and implementation details for the collaborative order reception system in the Smart Economato project. The system is designed to provide a "Google Sheets" experience, where multiple staff members edit fields simultaneously with zero-latency visual feedback.

## 1. System Overview (Strict Real-Time)
The system relies on a **Centralized Lock Manager** and a **Reactive State Sync** with ultra-short TTLs to ensure high consistency and prevent stale sessions.

### Core Entities & TTLs (Aggressive)
- **Order Lock**: Grants "Owner" status. **TTL: 1 minute**. Requires active heartbeat every 30s.
- **Field Lock**: Granular lock on a specific input field. **TTL: 10 seconds**. 
- **Field Patch**: Value update sent on every keystroke (with 100ms debounce) or on change.

---

## 2. Backend Implementation (`inventory-service`)

### Constants (`OrderReviewLockService.java`)
- `LOCK_TTL = Duration.ofMinutes(1);`
- `FIELD_LOCK_TTL = Duration.ofSeconds(10);`

### Logic Requirements
- **Broadcast on Lock**: When a field is locked, broadcast `COLLAB_FIELD_LOCKED` immediately to show the "remote cursor" to others.
- **Eviction on Expiry**: When a lock expires, the backend MUST broadcast a `LOCK_EXPIRED` event.
- **Strict Validation**: Any `patchField` request without a valid active lock MUST return `409 Conflict`.
- **Force Release**: If an Admin performs a "Confirm" or "Cancel", all active collaboration sessions for that order must be forcefully terminated and broadcasted as `COLLAB_STATE_CLEARED`.

---

## 3. Frontend Implementation (Google Sheets Experience)

### Visual "Cursors" (Field Highlights)
- Every input field must have a border that changes color based on who is editing it.
- A small label with the user's name should appear above/below the locked field.
- **Implementation**: Use a map of `fieldPath -> User` in the component to apply CSS classes dynamically.

### Synchronization Flow
- **Keystroke Sync**: Send `patchField` as the user types (debounce 100ms).
- **Remote Update**: If a field is NOT focused locally, its value must update instantly when a `COLLAB_FIELD_PATCHED` event arrives.
- **Heartbeat**: The frontend must send a heartbeat every 30 seconds to maintain the 1-minute order lock.

---

## 4. Exhaustive Edge Case Analysis & Technical Safety

### A. Connectivity & Network Failure
- **Silent Network Drop**: 
    - *Scenario*: User's WiFi dies. Browser doesn't trigger 'offline' immediately.
    - *Risk*: User keeps typing but nothing is saved.
    - *Solution*: If any `patchField` or `heartbeat` fails (HTTP error or Timeout), trigger **Emergency Evacuation** immediately.
- **WebSocket Gap (Missed Events)**:
    - *Scenario*: WebSocket reconnects after a 5s blip. Events were missed.
    - *Solution*: On the `connected` event of the WebSocket, perform a full `getReviewCollaborationState` resync before allowing further edits.
- **Background Tab Throttling**:
    - *Scenario*: User switches tabs. Browser slows down JS (Chrome/Safari). Heartbeat misses the 1m window.
    - *Solution*: Use `WebWorkers` for heartbeats if possible, or detect "Tab Visible" event and force an immediate resync/re-lock.

### B. Concurrency & Race Conditions
- **The "Millisecond War" (Double Focus)**:
    - *Scenario*: User A and B click the same field within 5ms.
    - *Solution*: Frontend must wait for `lockField` success before enabling input. If A wins, B gets a 409 and their input is reverted/locked.
- **Lock Expiration while Typing**:
    - *Scenario*: User A types very slowly, holding the field for >10s without a refresh. User B tries to take it.
    - *Solution*: Every `patchField` must act as a "lock refresh". If the user is active, the 10s TTL resets.
- **Clock Skew (Out-of-Order Events)**:
    - *Scenario*: Server clock and Client clock are slightly off.
    - *Solution*: Use **Server-Side Timestamps** as the source of truth. Discard any patch that is older than the current `lastModified` in the local state.

### C. UI/UX Consistency
- **The "Flicker" Conflict**:
    - *Scenario*: Remote update arrives while the local user is typing (maybe due to a previous laggy patch).
    - *Solution*: Never update the `value` property of a focused HTML element from a remote event. Store remote values in a "shadow state" and apply them only on blur.
- **Layout Jumps (Lot Management)**:
    - *Scenario*: User A adds a new Lot row. User B's list shifts down while they are clicking.
    - *Solution*: Animate transitions. If a row is added/removed, highlight the change with a flash (green for new, red for deleted) to orient the user.
- **Dynamic Path Corruption**:
    - *Scenario*: Order lines are reordered or filtered. Index-based paths (`detail[0]`) point to different products.
    - *Solution*: Paths MUST be ID-based: `detail:{productId}:lot:{lotId}:field`. This ensures stability regardless of UI sorting or filtering.

### D. Security & Permissions
- **The "Rogue Admin"**:
    - *Scenario*: An admin kicks everyone out or closes the order while others are editing.
    - *Solution*: The `COLLAB_STATE_CLEARED` event must be handled as a "hard close" for all modals, saving nothing to prevent data corruption.
- **Permission Elevation**:
    - *Scenario*: A user is demoted from "Admitted" to "Viewer" while the modal is open.
    - *Solution*: The collaboration state includes `currentUserCollaborator`. If this becomes `false`, the UI must instantly switch to read-only mode.

### E. Validation & Business Logic
- **Invalid Patch Cascade**:
    - *Scenario*: User A enters "99999" (invalid quantity).
    - *Solution*: Backend must validate patches. If invalid, return 400. Frontend must NOT propagate invalid values to other users.
- **Rounding Discrepancies**:
    - *Scenario*: Different rounding settings between browsers.
    - *Solution*: All price/total calculations must happen on the backend or follow a strictly shared math utility to ensure User A and User B see the exact same numbers down to the cent.

---

## 5. Deployment Checklist (Production Ready)
- [x] Backend: TTLs set to 10s (Field) and 1m (Order).
- [ ] Frontend: "Emergency Evacuation" logic implemented in `OrderReceptionModal`.
- [ ] Frontend: Field highlight directive/logic implemented (Google Sheets style).
- [ ] Frontend: High-frequency WebSocket heartbeat (every 30s).
- [ ] Frontend: ID-based dynamic paths implemented for all fields.
- [ ] Frontend: "Tab Visible" resync logic implemented.
