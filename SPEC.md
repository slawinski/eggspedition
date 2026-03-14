# Grocery List App (MVP) - Project Vision

## Vision
A delightful, family-oriented grocery list application that simplifies household shopping through real-time collaboration, intuitive categorization, and a unique "claymorphism" aesthetic. It's designed to be the digital equivalent of a "squishy" physical list on the fridge.

## Core Goals
1. **Seamless Collaboration:** Family members can instantly see, add, and remove items.
2. **Matrix Categorization:** Support multi-dimensional organization where items belong to both a **Category** (e.g., Vegetables) and a **Preferred Store** (e.g., Biedronka) simultaneously, allowing for rich, context-aware filtering.
3. **High-Fidelity UX:** A responsive web app with rich microinteractions and a consistent claymorphism design system.
4. **Security & Simplicity:** Passwordless authentication via Email OTP (Magic Link).

## Tech Stack
- **Frontend:** TanStack Start (React) + CSS Modules.
- **Backend:** Bun.
- **Database:** PostgreSQL.
- **Auth:** Email OTP (Magic Link).
- **Validation:** Zod (Full-stack schema validation).
- **Environment Management:** Varlock (Declarative .env schema with `@env-spec`).
- **Performance:** TanStack Virtual (For buttery smooth scrolling on long lists).
- **Design System:** Claymorphism (Soft shadows, rounded corners, "squishy" feel).

## Resiliency & Performance (Fool-Proofing)
- **Offline-First Sync:** Use `persistQueryClient` with `LocalStorage` to ensure the list is visible and functional in "dead zones" (e.g., concrete grocery store interiors).
- **Claymorphic Sync Indicator:** A visual "cloud" indicator that changes state (Pulsing = Syncing, Grey/Still = Offline) to manage user expectations without breaking the aesthetic.
- **Sticky Sessions:** Implement ultra-long-lived sessions (30-90 days) with `HttpOnly` secure cookies to prevent "aisle-lockout" (users being logged out while shopping).
- **LOD (Layer of Detail) Rendering:** Use CSS variables and `:after` pseudo-elements to simplify shadows during high-speed scrolling or on lower-end devices (`will-change: transform`).
- **Virtualization:** Integrate `TanStack Virtual` for long lists to maintain 60fps scrolling by only rendering the "squishy" items currently in view.
- **Thin UI Pattern:** Decouple business logic from TanStack Start "Server Functions" into pure TypeScript domain services to ensure the app is framework-agnostic and resilient to alpha/beta shifts.

## Human-Proofing & Habit Formation
- **Household Activity Feed:** A "squishy" log of recent actions (e.g., "Dad added Milk", "Mom removed Eggs") to prevent confusion and allow for "Panic Undos" if an item is accidentally deleted.
- **Categorization Matrix:** Items are not tied to a single view. Each item is tagged with a `Category` AND an optional `Preferred Store`. The UI allows toggling filters without losing cross-category associations.
- **Quick-Add Deep Linking:** Support for a simple URL scheme (e.g., `/add?name=Milk`) to allow users to create shortcuts or "Add to List" widgets on their mobile home screens.
- **Share Extension Support:** Basic implementation to allow "sharing" text or links from browser/recipe apps directly into the grocery list.

## Environment Management
- **Varlock:** Used for declarative, type-safe environment variable management via a `.env.schema` file.
    - **@env-spec Decorators:** Employs JSDoc-style comments (e.g., `@type`, `@required`, `@sensitive`) to define validation rules directly in the environment configuration.
    - **Automatic Type Generation:** Configured to auto-generate `env.d.ts` for end-to-end type safety across Bun and TanStack Start.
    - **Validation:** Ensures critical variables (e.g., `DATABASE_URL`, `RESEND_API_KEY`) are present and correctly formatted before the app starts.
    - **Secret Masking:** Leverages `@sensitive` to prevent accidental logging of credentials in CI/CD or production logs.

## Validation & Type Safety
- **Zod:** Used as the single source of truth for validation across the entire stack:
    - **API Boundaries:** All Server Functions in TanStack Start will use Zod schemas to parse and validate incoming data (e.g., adding an item, user login).
    - **Form Validation:** Client-side forms will use the same Zod schemas to provide instant, reactive validation feedback within the "squishy" UI.
    - **Database Integration:** Zod schemas will be used alongside Drizzle ORM to ensure data integrity between the application and PostgreSQL.
    - **Type Inference:** Automatic TypeScript type generation from Zod schemas to maintain strict end-to-end type safety.

## Data Sync & State Management
- **TanStack Query (React Query):** This is the core engine for data fetching and synchronization. It must be implemented with all its advanced features:
    - **Caching & Stale Time:** Aggressive caching strategies to ensure the list feels instant on subsequent opens.
    - **Optimistic Updates:** When a family member adds or removes an item, the UI must update *instantly* before the server confirms, with rollback logic on failure.
    - **Loading & Error States:** Each claymorphic component (buttons, inputs) should have distinct "squishy" loading and error states.
    - **Background Refetching:** Automatic synchronization when the tab is refocused or the network reconnects to ensure family members see changes immediately.
    - **Prefetching:** Proactive fetching of household data to eliminate loading spinners.

## Target Audience
Families or households who shop together and want a shared, real-time list that is both functional and aesthetically pleasing.
---

## Domain Analysis

## Domain: Household Collaboration (Core)

**Type**: Core Domain

**Ubiquitous Language**: Household, Member, Invitation, Active List.

**Business Capability**: Allows members to belong to a shared space where lists are synchronized.

**Key Concepts**:
- **Household** (Entity) - The shared unit of ownership for lists.
- **Member** (Entity) - A user belonging to one or more households.
- **Invitation** (Service) - Sending a magic link/invite to join a household.

## Domain: Grocery Management (Core)

**Type**: Core Domain

**Ubiquitous Language**: Item, Quantity, Category, Store, Checked/Unchecked.

**Business Capability**: CRUD operations on the list items with matrix-based categorization.

**Key Concepts**:
- **GroceryItem** (Entity) - A specific product with both `categoryId` and `storeId` (optional) fields.
- **Categorization Matrix** (Service) - Logic to filter and sort items by multiple dimensions (e.g., "All Vegetables at Biedronka").
- **ListManager** (Service) - Logic for adding/removing items, handling "undo", and recording household activity logs.

## Domain: Authentication (Generic)

**Type**: Generic Subdomain

**Ubiquitous Language**: Magic Link, OTP, Session, JWT.

**Business Capability**: Passwordless email-based auth.

**Key Concepts**:
- **AuthService** (Generic) - Sends emails and verifies OTP tokens.
- **SessionStore** (Service) - Manages Bun/JWT sessions.

---

## Suggested Bounded Contexts

### 1. **CollaborationContext**
Handles household creation and user memberships.
- **Term**: "Family Member" in this context refers to a person with permissions to modify a household's lists.

### 2. **ShoppingContext**
Handles the actual grocery list logic and categorization.
- **Term**: "Item" in this context is a physical product with optional grouping properties (category or store).

## Cohesion Analysis
- **High Cohesion**: Grocery Management and Household Collaboration are tightly coupled in the user's mind but will be architected to interact via a clear `householdId` foreign key.
- **Generic**: Authentication is standard and will be isolated from the core domain logic.
---

## UI/UX & Design Strategy (Claymorphism)

## The Aesthetic: Claymorphism
- **Foundation:** Soft, rounded 3D appearance mimicking "squishy" clay.
- **Visual Cues:**
    - Large border-radius (e.g., `2rem`).
    - Multiple box-shadows (outer for depth, inner for the "puffy" top-left highlight and bottom-right shadow).
    - Pastel background colors.

## CSS Modules Strategy
```css
/* example of a clay-button.module.css */
.button {
  background: var(--primary-pastel);
  border-radius: 20px;
  border: none;
  box-shadow: 
    8px 8px 16px rgba(0,0,0,0.1), 
    inset 8px 8px 16px rgba(255,255,255,0.4),
    inset -8px -8px 16px rgba(0,0,0,0.05);
  transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

.button:active {
  transform: scale(0.92); /* The "squish" effect */
}
```

## Microinteractions
- **Item Removal:** "Poof" animation or a squishy collapse when an item is deleted.
- **Adding Items:** Items should "pop" into existence with an elastic ease-out effect.
- **Collaboration Feedback:** A small "puffy" notification or badge showing who added an item (e.g., "Mom added Bread").

## Responsive Layout
- **Mobile-First:** Large tap targets for one-handed shopping.
- **Desktop:** Multi-column view showing categories side-by-side (Store view vs. Category view).

## View Toggling
- **Switch:** A claymorphic toggle to switch between "Group by Store" and "Group by Category".
---

## Project Roadmap

## Phase 1: Foundation (MVP)
- [ ] **Authentication:** Email OTP (Magic Link) setup with Bun + PostgreSQL.
- [ ] **Core List Management:** CRUD for grocery items.
- [ ] **Collaboration:** Basic household/group sharing mechanism.
- [ ] **Categorization:** Grouping items by store or category.
- [ ] **Design Implementation:** Basic claymorphism UI using CSS Modules.

## Phase 2: UX & Microinteractions
- [ ] **Animations:** "Squishy" buttons and transitions.
- [ ] **Real-time Updates & Data Sync:** TanStack Query implementation with:
    - [ ] Full optimistic updates for adding/removing items.
    - [ ] Advanced caching strategies and background refetching.
    - [ ] Real-time polling or WebSockets/SSE for family-wide synchronization.
- [ ] **Mobile Optimization:** Touch-friendly drag-and-drop for categorization.

## Phase 3: Enhancements
- [ ] **Search & History:** Quick-add from previous purchases with prefetching.
- [ ] **Push Notifications:** Alert family members when someone is shopping.
- [ ] **Multiple Lists:** Separate lists for groceries, DIY, etc.
---

## Implementation Tasks

## Phase 1: Environment & Auth (Foundation)
- [ ] Initialize Bun project with TanStack Start.
- [ ] **Configure Varlock for Environment Management:**
    - [ ] Create `.env.schema` with `@env-spec` decorators for `DATABASE_URL`, `RESEND_API_KEY`, and `AUTH_SECRET`.
    - [ ] Enable automatic type generation (`env.d.ts`).
- [ ] Configure PostgreSQL with Drizzle ORM.
- [ ] Define **Zod schemas** for `user` and `session` objects.
- [ ] Implement Magic Link Email Service with Zod input validation.
- [ ] **Sticky Sessions:** Configure auth cookies for 30-90 day persistent sessions.
- [ ] Create `users`, `households`, and `memberships` tables.
- [ ] Set up Auth middleware (JWT or session-based) with schema validation.

## Phase 2: Schema & Core Backend (Thin Logic)
- [ ] **Domain Isolation:** Build pure TypeScript services for grocery logic (decoupled from TanStack Start).
- [ ] **Matrix Schema:** Create `grocery_items` table with support for multiple tag fields (e.g., `store_id`, `category_id`).
- [ ] **Activity Log Schema:** Create `household_logs` table (user_id, action, item_name, timestamp).
- [ ] Implement CRUD API for items using Zod for payload validation.
- [ ] Implement Matrix categorization logic (server-side grouping/filtering).

## Phase 3: Frontend Construction & Advanced State Management
- [ ] Set up TanStack Query with Zod-inferred types for data fetching.
- [ ] **UI Performance:**
    - [ ] Integrate **TanStack Virtual** for item lists.
    - [ ] Implement **LOD CSS Shadows** for scroll performance.
- [ ] Create base "Clay" components (Button, Card, Input) with CSS Modules.
- [ ] **Habit Formation Features:**
    - [ ] Implement **Deep Linking** for quick-add (`/add?name=...`).
    - [ ] Add the **Household Activity Feed** (recent actions log).
- [ ] Build the "Add Item" interface with Zod-powered form validation.
- [ ] Build the List View with Matrix-based togglable filtering.

## Phase 4: Real-Time Synchronization & Final Polish
- [ ] **Offline-First Resilience:**
    - [ ] Set up `persistQueryClient` with LocalStorage for offline persistence.
    - [ ] Add the **Claymorphic Sync Indicator** (Puffy cloud) to UI.
- [ ] **SSE Signaling Service:**
    - [ ] Implement a Streaming Server Function in TanStack Start for real-time signaling.
    - [ ] Set up PostgreSQL `LISTEN/NOTIFY` for multi-member signaling.
    - [ ] Integrate TanStack Query invalidation upon receiving signals.
- [ ] **Final UX Polish:**
    - [ ] Apply final claymorphic shadows, "pop" animations, and squishy transitions.
    - [ ] Add **"Panic Undo"** capability from the activity feed.
    - [ ] Ensure full responsiveness and accessibility across devices.
