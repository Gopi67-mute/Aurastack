# AGENTS.md

# AuraStack Engineering Specification

Version: 1.0.0
Status: Official
Last Updated: August 2026

---

# PROJECT INFORMATION

Project Name

AuraStack

Version

1.0.0

Purpose

AuraStack is an AI-powered Software Architecture Assistant that helps developers transform a simple application idea into a production-ready software blueprint.

AuraStack acts as an intelligent technical mentor capable of understanding the user's project context and generating structured implementation guidance rather than acting as a generic chatbot.

The system generates:

• Technology Stack Recommendations
• Software Architecture
• Folder Structure
• Database Design
• API Design
• Authentication Strategy
• Development Roadmap
• Learning Roadmap
• AI Mentoring
• Project Documentation
• Feature Breakdown
• Development Timeline
• Best Practices

AuraStack continuously remembers project context to provide consistent and context-aware responses throughout development.

---

# VISION

AuraStack aims to become the AI operating system for software development.

Instead of replacing developers, AuraStack empowers them by acting as an experienced software architect capable of guiding projects from idea to deployment.

The application should remain:

- Developer-first
- Production-focused
- Educational
- Scalable
- Reliable
- Context-aware
- Modern

Every engineering decision should support these goals.

---

# TARGET USERS

AuraStack is designed for:

- Students
- Beginner Developers
- Self-taught Developers
- Freelancers
- Startup Teams
- Indie Hackers
- Professional Developers
- Software Agencies

Every feature should provide value across multiple skill levels.

---

# PROJECT OBJECTIVES

The primary objectives of AuraStack are:

- Reduce architecture decision fatigue.
- Help developers choose appropriate technologies.
- Generate structured implementation plans.
- Encourage best engineering practices.
- Teach modern software development.
- Improve developer productivity.
- Maintain project context across conversations.
- Produce production-ready recommendations.

---

# ENGINEERING ROLE

When contributing to AuraStack, always act as:

- Senior React Native Engineer
- Senior Expo Engineer
- Senior TypeScript Engineer
- Senior FastAPI Engineer
- Senior Backend Engineer
- Senior AI Systems Engineer
- Senior Software Architect
- Senior Database Architect
- Senior DevOps Engineer
- Senior Security Engineer

Every implementation should reflect production-quality engineering standards.

---

# ENGINEERING PHILOSOPHY

AuraStack is built feature-by-feature.

Never attempt to build multiple unrelated systems simultaneously.

For every feature:

1. Understand the user's request.
2. Review this AGENTS.md.
3. Analyze the existing architecture.
4. Identify affected modules.
5. Implement only what is required.
6. Validate the implementation.
7. Avoid modifying unrelated code.
8. Explain the changes clearly.

Small, maintainable improvements are preferred over massive rewrites.

---

# CORE PRINCIPLES

Every implementation must be:

- Modular
- Reusable
- Maintainable
- Scalable
- Secure
- Testable
- Type-safe
- Readable
- Predictable
- Extensible

Never sacrifice maintainability for short-term convenience.

---

# SOFTWARE ENGINEERING PRINCIPLES

Follow these principles throughout the project:

- SOLID
- DRY (Don't Repeat Yourself)
- KISS (Keep It Simple)
- YAGNI (You Aren't Gonna Need It)
- Separation of Concerns
- Single Responsibility Principle
- Composition over Inheritance
- Explicit over Implicit
- Convention over Configuration (when appropriate)

Never overengineer.

---

# DEVELOPMENT PHILOSOPHY

Build the smallest useful implementation first.

Prefer:

- clarity
- simplicity
- readability

Avoid:

- unnecessary abstraction
- premature optimization
- excessive design patterns
- speculative features

Refactor only when repetition or complexity justifies it.

---

# PROJECT ARCHITECTURE

AuraStack follows a layered architecture.

Frontend

↓

API Layer

↓

Authentication Layer

↓

Business Logic

↓

AI Engine

↓

Validation Layer

↓

Persistence Layer

↓

Response Builder

↓

Frontend

Every layer has a single responsibility.

Business logic must never leak into the presentation layer.

---

# HIGH LEVEL SYSTEM FLOW

User

↓

React Native (Expo)

↓

Clerk Authentication

↓

FastAPI

↓

JWT Verification

↓

Request Validation

↓

Business Services

↓

Gemini AI

↓

Pydantic Validation

↓

Response Normalization

↓

MongoDB

↓

Typed JSON Response

↓

React Native UI

Every response must pass validation before reaching the frontend.

---

# OFFICIAL TECH STACK

Frontend

- React Native
- Expo
- TypeScript
- Expo Router
- NativeWind
- Zustand
- React Hook Form
- Zod

Backend

- FastAPI
- Python
- Pydantic
- AsyncIO
- JWT Verification

Database

- MongoDB

Authentication

- Clerk

Artificial Intelligence

- Google Gemini

Deployment

Frontend

- Expo EAS

Backend

- Docker
- Railway
- Render

Version Control

- Git
- GitHub

---

# ARCHITECTURAL RULES

Never mix concerns.

Frontend is responsible for:

- UI
- Navigation
- User interactions
- Local validation
- State management

Backend is responsible for:

- Business logic
- Authentication verification
- Authorization
- AI orchestration
- Data persistence
- Response validation

Database is responsible only for persistence.

AI is responsible only for generating structured outputs.

---

# PROJECT FOLDER STRUCTURE

Frontend

```
app/
features/
components/
hooks/
services/
store/
types/
constants/
utils/
assets/
lib/
```

Backend

```
backend/
    app/
        api/
        core/
        db/
        middleware/
        models/
        repositories/
        schemas/
        services/
        utils/
        ai/
        tests/
```

Every directory must have a single responsibility.

Avoid dumping unrelated files into shared folders.

---

# FEATURE ORGANIZATION

Every feature should be organized as:

```
feature/

components/

hooks/

services/

types/

constants/

utils/
```

Feature-specific code should remain inside its own module whenever possible.

---

# ARCHITECTURE DECISION RULES

Never change:

- Project architecture
- Folder structure
- Authentication provider
- Database provider
- API contracts
- AI response contracts

without explicit approval.

When uncertain:

Stop and ask.

Never assume.

---

# CODE ORGANIZATION

Business logic belongs in services.

Validation belongs in schemas.

Database access belongs in repositories.

Routes should remain thin.

Components should focus on presentation.

Hooks should encapsulate reusable client logic.

Utilities should remain pure.

---

# REUSABILITY

Avoid duplicate implementations.

If identical logic appears more than twice:

Extract it.

Prefer reusable services over repeated code.

---

# DEPENDENCY MANAGEMENT

Before introducing any new dependency:

1. Explain why it is needed.
2. Compare available alternatives.
3. Describe benefits and drawbacks.
4. Ask for approval.
5. Proceed only after approval.

Never introduce libraries without permission.

---

# DECISION MAKING

When implementing any feature:

Understand

↓

Analyze

↓

Plan

↓

Implement

↓

Validate

↓

Explain

Never skip analysis.

---

# COMMUNICATION STYLE

When presenting code changes:

- Explain what changed.
- Explain why it changed.
- Explain where it changed.
- Explain how to test it.
- Mention any assumptions.
- Highlight potential risks.

Be concise, technical, and accurate.

---

# FRONTEND OVERVIEW

AuraStack's frontend is responsible for:

- Rendering the user interface
- Managing navigation
- Collecting user input
- Displaying API responses
- Local validation
- Managing client-side state
- Providing a responsive user experience

Business logic must remain on the backend whenever possible.

---

# FRONTEND TECH STACK

Framework

- React Native
- Expo

Language

- TypeScript (Strict Mode)

Routing

- Expo Router

Styling

- NativeWind

State Management

- Zustand

Forms

- React Hook Form
- Zod

Authentication

- Clerk

Networking

- Fetch API (or centralized API client)

---

# FRONTEND RESPONSIBILITIES

The frontend should:

- Render UI
- Navigate between screens
- Handle loading states
- Handle error states
- Handle empty states
- Handle success states
- Perform lightweight client validation
- Cache temporary UI state

The frontend should NEVER:

- Access databases directly
- Verify authentication tokens
- Contain business rules
- Store secrets
- Expose API keys
- Call Gemini directly

---

# SCREEN STRUCTURE

Each screen should focus on composition.

Screens should:

- Compose reusable components
- Use hooks
- Call services
- Read from stores

Avoid large business logic inside screens.

---

# COMPONENT RULES

Create reusable components only when:

- Reused multiple times
- Improves readability
- Represents a clear UI concept

Examples

- ProjectCard
- RoadmapCard
- AIResponseCard
- FeatureTile
- PrimaryButton
- LoadingSpinner

Avoid creating tiny one-off components prematurely.

---

# COMPONENT STANDARDS

Every component should:

- Have a single responsibility
- Accept typed props
- Avoid unnecessary state
- Avoid duplicated logic
- Remain reusable
- Be easy to test

Never use class components.

Always use functional components.

---

# COMPONENT LENGTH

Maximum recommended size

Simple Components

100 lines

Medium Components

200 lines

Maximum

250 lines

Extract logic before exceeding limits.

---

# HOOK RULES

Hooks should encapsulate reusable logic.

Examples

useProjects()

useCurrentProject()

useTheme()

useRoadmap()

useAuth()

Never place UI inside hooks.

Hooks should never render components.

---

# STATE MANAGEMENT

Global State

Use Zustand for:

- Current User
- Current Project
- Authentication State
- Theme
- AI Session
- User Preferences
- Recent Projects

Local State

Use React State for:

- Modal visibility
- Inputs
- Search text
- Animations
- Temporary selections

Avoid putting temporary UI state into Zustand.

---

# PERSISTENT STATE

Persist only appropriate client data.

Allowed

- Theme
- User Preferences
- Recent Projects
- Last Opened Project
- Draft Inputs
- Cached Metadata

Do NOT persist

- JWT Secrets
- API Keys
- Sensitive Tokens
- AI Secrets

Server remains the source of truth.

---

# STYLING RULES

Primary styling system

NativeWind

Use NativeWind whenever possible.

Use StyleSheet only for:

- Animated styles
- Platform-specific styles
- SafeAreaView
- KeyboardAvoidingView
- Modal
- Complex transforms
- Shadow edge cases
- Dynamic runtime styles

Avoid inline styles.

---

# DESIGN SYSTEM

AuraStack's design language is:

- Premium
- Minimal
- Modern
- Developer-focused
- Clean
- Consistent

Animations should be subtle.

Avoid flashy effects.

---

# SPACING SYSTEM

Use an 8-point grid.

Spacing values

4

8

12

16

24

32

40

48

Avoid arbitrary spacing.

---

# BORDER RADIUS

Small

8

Medium

12

Large

16

Extra Large

24

Maintain consistency across the app.

---

# COLOR RULES

Never hardcode colors.

Colors should come from centralized theme constants.

Support:

- Light Theme
- Dark Theme

Future themes should require minimal changes.

---

# TYPOGRAPHY

Maintain clear hierarchy.

Use consistent font sizes.

Avoid random sizing.

Titles

Large

Headings

Medium

Body

Readable

Captions

Small

---

# IMAGE RULES

Centralize image imports.

Use

constants/images.ts

Never import assets directly across multiple components.

Example

images.logo

images.emptyState

images.avatar

---

# ICON RULES

Use a single icon library consistently.

Do not mix icon libraries unless approved.

Icons should remain visually consistent.

---

# NAVIGATION RULES

Use Expo Router.

Never mix routing systems.

Navigation should remain predictable.

Keep route nesting shallow.

---

# FORM RULES

Use

React Hook Form

with

Zod

Every form must:

- Validate input
- Display errors
- Prevent invalid submission
- Disable duplicate requests

---

# LOADING STATES

Every async screen must display:

- Loading State
- Success State
- Error State
- Empty State

Never leave the user wondering what is happening.

---

# ERROR HANDLING

Display friendly messages.

Never expose:

- Stack traces
- Internal exceptions
- Server implementation details

Errors should help users recover.

---

# PERFORMANCE RULES

Lazy load heavy screens.

Memoize expensive components.

Use FlatList.

Debounce search.

Avoid unnecessary renders.

Cache repeated API calls when appropriate.

---

# ACCESSIBILITY

Buttons require labels.

Inputs require placeholders.

Maintain touch-friendly sizing.

Support screen readers.

Maintain sufficient color contrast.

---

# RESPONSIVE DESIGN

Design mobile-first.

Support:

- Small phones
- Large phones
- Tablets (future)

Avoid fixed pixel layouts.

---

# TYPESCRIPT RULES

Strict Mode required.

Never use

any

Prefer

unknown

interfaces

type aliases

Always type:

- Props
- API Responses
- Store State
- Hooks
- Services

---

# FILE NAMING

Components

PascalCase

Example

ProjectCard.tsx

Hooks

camelCase

Example

useProjects.ts

Utilities

camelCase

Example

formatDate.ts

Stores

camelCase

Example

useProjectStore.ts

Constants

UPPER_CASE

Example

API_URL.ts

Folders

lowercase

---

# CODE QUALITY

Avoid:

- Nested conditionals
- Duplicate logic
- Magic numbers
- Hardcoded values

Prefer:

- Early returns
- Reusable functions
- Clear naming
- Readability

---

# FRONTEND SECURITY

Never expose:

- API Keys
- Secrets
- Clerk Secret Keys
- Gemini Keys
- Database Credentials

Never trust client-side validation.

Backend validation is mandatory.

---

# FRONTEND TESTING

Frontend tests should cover:

- Components
- Hooks
- Stores
- Utilities

Recommended tools

- Jest
- React Native Testing Library

Critical UI flows should remain testable.

---

# FRONTEND CHECKLIST

Before completing any feature:

✓ UI matches design

✓ Loading handled

✓ Error handled

✓ Empty state handled

✓ Types defined

✓ No duplicated logic

✓ Responsive

✓ Accessible

✓ Secure

✓ Linted

✓ Type-safe

✓ Production-ready

---

# BACKEND OVERVIEW

The backend is the brain of AuraStack.

It is responsible for:

- Business Logic
- Authentication Verification
- Authorization
- AI Orchestration
- Data Validation
- Database Operations
- Context Management
- Response Normalization
- Logging
- Security

The frontend must never replace backend responsibilities.

---

# BACKEND TECH STACK

Framework

- FastAPI

Language

- Python 3.12+

Validation

- Pydantic

Authentication

- Clerk JWT Verification

Database

- MongoDB

ODM / Driver

- Motor (Async MongoDB Driver)

AI Provider

- Google Gemini

Deployment

- Docker
- Railway
- Render

---

# BACKEND ARCHITECTURE

Every request follows this flow:

Client

↓

API Router

↓

Authentication Middleware

↓

Authorization

↓

Request Validation

↓

Business Service

↓

AI Service / Repository

↓

Database

↓

Response Builder

↓

Pydantic Response Validation

↓

JSON Response

Never bypass any layer.

---

# BACKEND FOLDER STRUCTURE

backend/

app/

api/

core/

middleware/

models/

schemas/

services/

repositories/

ai/

db/

utils/

config/

tests/

Each folder must have one responsibility.

---

# ROUTER RULES

Routers should only:

- Receive requests
- Validate inputs
- Call services
- Return responses

Never place business logic inside routers.

---

# SERVICE RULES

Services contain business logic.

Services may:

- Call repositories
- Call Gemini
- Transform data
- Validate workflows

Services must NOT:

- Access HTTP Requests directly
- Build UI responses
- Store secrets in code

---

# REPOSITORY RULES

Repositories are responsible for:

- Reading MongoDB
- Writing MongoDB
- Updating documents
- Deleting documents

Repositories should never contain business logic.

---

# DATABASE DESIGN

MongoDB stores:

Users

Projects

AI Conversations

Project Metadata

Technology Stacks

Roadmaps

Architecture Plans

API Designs

Folder Structures

Database Designs

Settings

Project History

Learning Progress

---

# DATABASE PRINCIPLES

Always:

Normalize where appropriate.

Avoid duplicate documents.

Use indexes.

Use ObjectId.

Use async operations.

Validate before saving.

Never block the event loop.

---

# COLLECTION RULES

Each collection has one responsibility.

Never mix unrelated data.

Example

users

projects

conversations

roadmaps

architectures

settings

---

# AUTHENTICATION

Authentication Provider

Clerk

Responsibilities

Sign Up

Sign In

OAuth

Session Management

Email Verification

JWT Generation

Never build custom authentication.

---

# AUTHORIZATION

Backend must verify:

User identity

↓

Resource ownership

↓

Permission

↓

Action

Never trust the client.

---

# JWT RULES

Every protected endpoint must:

Verify Clerk JWT.

Reject expired tokens.

Reject invalid signatures.

Reject unauthorized users.

Never expose JWT contents.

---

# AI ENGINE

Aura AI is context-aware.

Aura AI must understand:

Current Project

Current Conversation

Previous Conversations

Project Metadata

Technology Stack

Architecture

Database Design

API Design

User Skill Level

Previous AI Responses

Never generate responses without project context if context exists.

---

# AI RESPONSE FLOW

React Native

↓

FastAPI

↓

Context Builder

↓

Gemini

↓

Pydantic Validation

↓

Normalization

↓

MongoDB Storage

↓

Typed JSON

↓

Frontend

---

# CONTEXT ENGINE

Aura AI should build context in this order:

Current Request

↓

Current Project

↓

Saved Metadata

↓

Conversation History

↓

Previous AI Responses

↓

User Preferences

↓

Generate Response

Context should improve response quality.

---

# GEMINI RULES

Gemini must never return plain text directly.

Gemini should always return structured JSON.

Backend validates all responses before sending them to the frontend.

---

# AI RESPONSE SCHEMA

Every AI response should include structured sections such as:

Project Summary

Technology Stack

Architecture

Folder Structure

Database

API

Development Roadmap

Learning Path

Warnings

Recommendations

Next Steps

The schema should be versioned for future compatibility.

---

# VALIDATION

All incoming requests

↓

Pydantic Validation

↓

Business Validation

↓

Database Validation

↓

Response Validation

Validation is mandatory.

---

# ERROR HANDLING

Never ignore exceptions.

Backend should:

Log complete errors.

Return safe messages.

Hide stack traces.

Return proper HTTP status codes.

Never expose internal implementation details.

---

# LOGGING

Log:

Timestamp

User ID

Project ID

Endpoint

Duration

Status Code

Error Type

Never log:

Passwords

JWT Tokens

Secrets

API Keys

Database Credentials

---

# API DESIGN

Use REST.

Examples

GET /projects

POST /projects

GET /projects/{id}

PATCH /projects/{id}

DELETE /projects/{id}

GET /roadmaps/{id}

POST /chat

Version APIs.

Example

/api/v1/projects

---

# RESPONSE STANDARDS

Every response should contain:

success

message

data

errors

metadata

Use consistent response formats across the API.

---

# SECURITY

Never expose:

Gemini API Key

MongoDB URI

Clerk Secret Key

Environment Variables

JWT Secrets

Always sanitize input.

Always validate data.

Always use HTTPS.

Always verify ownership.

---

# PERFORMANCE

Use async endpoints.

Avoid blocking operations.

Reuse database connections.

Cache repeated lookups where appropriate.

Optimize MongoDB indexes.

Paginate large datasets.

---

# ENVIRONMENT VARIABLES

Frontend

EXPO_PUBLIC_API_URL

EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY

Backend

MONGODB_URI

CLERK_SECRET_KEY

CLERK_JWT_ISSUER

GEMINI_API_KEY

JWT_AUDIENCE

ENVIRONMENT

Never hardcode environment values.

---

# TESTING

Backend testing should include:

API Routes

Services

Repositories

Validation

Authentication

Authorization

AI Response Parsing

Database Operations

Use Pytest.

Critical business logic must remain testable.

---

# BACKEND CHECKLIST

Before completing any backend feature:

✓ Authentication verified

✓ Authorization verified

✓ Request validated

✓ Response validated

✓ Errors handled

✓ Logs implemented

✓ Async operations used

✓ Database optimized

✓ Types defined

✓ Secrets protected

✓ Production-ready

---

# PART 4 — PRODUCTION STANDARDS & FINAL ENGINEERING RULE

# TESTING STANDARDS

Testing is mandatory for critical business logic.

Frontend

- Jest
- React Native Testing Library

Backend

- Pytest

Priority

1. Business Logic
2. API Endpoints
3. Authentication
4. Authorization
5. AI Validation
6. Database Operations
7. Utilities
8. Components

Never merge untested critical functionality.

---

# DOCUMENTATION

Every public module should be self-explanatory.

Document:

- Services
- API Endpoints
- Custom Hooks
- Utility Functions
- Complex Algorithms

Documentation should explain:

- Purpose
- Inputs
- Outputs
- Side Effects

Avoid obvious comments.

---

# CODE REVIEW STANDARDS

Before considering any feature complete:

✓ Code is readable

✓ No duplicated logic

✓ No unused imports

✓ No dead code

✓ Strong typing

✓ Handles edge cases

✓ Proper error handling

✓ Loading states implemented

✓ Empty states implemented

✓ Security verified

✓ Performance reviewed

✓ Architecture respected

---

# GIT WORKFLOW

Branch Strategy

main

↓

develop

↓

feature/<feature-name>

↓

Pull Request

↓

Review

↓

Merge

Never develop directly on main.

---

# COMMIT STANDARDS

Every commit should represent one logical change.

Allowed prefixes

feat:

fix:

refactor:

docs:

style:

perf:

test:

build:

chore:

Examples

feat: add project creation endpoint

fix: resolve JWT verification issue

refactor: simplify roadmap generator

docs: update AGENTS specification

Avoid vague commit messages.

---

# VERSIONING

Follow Semantic Versioning.

MAJOR

Breaking changes

MINOR

New functionality

PATCH

Bug fixes

Example

1.0.0

1.1.0

1.1.1

---

# ENVIRONMENT MANAGEMENT

Use environment variables only.

Never hardcode:

API Keys

Secrets

Database URIs

JWT Secrets

Service Tokens

Every environment should have its own configuration.

Development

Testing

Production

---

# DEPLOYMENT

Frontend

Expo EAS

Backend

Docker

Railway

Render

Deployment should be repeatable and automated.

---

# CONFIGURATION RULES

Configuration belongs inside configuration files.

Never scatter configuration across the project.

Centralize:

URLs

Timeouts

Limits

Feature Flags

Environment Variables

Constants

---

# LOGGING STANDARDS

Log useful information.

Include:

Timestamp

User ID

Project ID

Endpoint

Request Duration

Status Code

Error Type

Never log:

Passwords

JWT Tokens

Secrets

API Keys

Personal Information

---

# MONITORING

Production applications should monitor:

Server Health

API Errors

Response Times

Database Performance

AI Failures

Authentication Failures

Application Crashes

Monitoring should help diagnose issues quickly.

---

# PERFORMANCE STANDARDS

Optimize only after measuring.

Always:

Lazy load heavy modules

Memoize expensive calculations

Cache repeated queries

Paginate large datasets

Optimize indexes

Compress responses where appropriate

Avoid unnecessary renders

---

# SECURITY CHECKLIST

Every feature must verify:

✓ Authentication

✓ Authorization

✓ Validation

✓ Sanitization

✓ Resource Ownership

✓ Secure Headers

✓ HTTPS

✓ Secret Protection

Never trust client input.

---

# ACCESSIBILITY CHECKLIST

Every screen should:

✓ Support screen readers

✓ Maintain proper contrast

✓ Use readable typography

✓ Provide labels

✓ Provide placeholders

✓ Maintain large touch targets

Accessibility is a requirement, not an optional enhancement.

---

# AI IMPLEMENTATION RULES

Before implementing AI features:

Understand project context.

Retrieve existing project metadata.

Retrieve previous AI responses.

Build context.

Generate structured JSON.

Validate JSON.

Normalize data.

Store response.

Return typed response.

Never bypass validation.

---

# AI CODING RULES

When generating code:

Always:

Read AGENTS.md first.

Respect architecture.

Use existing project patterns.

Maintain consistency.

Write production-quality code.

Avoid introducing unnecessary abstractions.

Explain implementation decisions.

Never:

Invent APIs

Invent database schemas

Invent routes

Invent authentication flows

Invent libraries

Invent environment variables

Invent project structure

When uncertain:

Ask for clarification.

---

# DECISION RULES

Always ask before:

Installing libraries

Changing folder structure

Changing authentication

Changing database schema

Changing API contracts

Deleting files

Renaming major modules

Changing UI design

Migrating technologies

Never make architectural decisions without approval.

---

# DO NOT

Do not use any.

Do not duplicate logic.

Do not expose secrets.

Do not hardcode values.

Do not bypass validation.

Do not bypass authentication.

Do not ignore authorization.

Do not ignore loading states.

Do not ignore error states.

Do not ignore empty states.

Do not create unnecessary files.

Do not introduce unused dependencies.

Do not perform blocking database operations.

Do not redesign existing UI without approval.

Do not change architecture without approval.

Do not leak internal errors.

Do not optimize prematurely.

Do not overengineer.

---

# ALWAYS

Always write modular code.

Always write readable code.

Always use TypeScript Strict Mode.

Always use async database operations.

Always validate requests.

Always validate responses.

Always protect secrets.

Always separate concerns.

Always write reusable components.

Always write reusable services.

Always keep business logic outside UI.

Always think before implementing.

Always explain changes clearly.

Always leave the project cleaner than you found it.

---

# FINAL IMPLEMENTATION CHECKLIST

Before completing ANY feature:

Architecture

✓ Architecture respected

✓ Folder structure respected

✓ Existing patterns followed

Frontend

✓ Responsive

✓ Accessible

✓ Loading handled

✓ Empty state handled

✓ Error state handled

✓ Type-safe

Backend

✓ Authentication verified

✓ Authorization verified

✓ Validation completed

✓ Async operations used

✓ Repository pattern followed

AI

✓ Context loaded

✓ JSON validated

✓ Response normalized

✓ Metadata updated

Database

✓ Indexed appropriately

✓ No duplicate data

✓ Async queries

Security

✓ Secrets protected

✓ Input sanitized

✓ Resource ownership verified

Testing

✓ Unit tested where appropriate

✓ Lint passes

✓ Type checking passes

Git

✓ Single-purpose commit

✓ Meaningful commit message

Production

✓ Production-ready

✓ Maintainable

✓ Scalable

✓ Secure

---

# FINAL REMINDER

Before writing any code:

1. Read this AGENTS.md completely.

2. Understand the requested feature.

3. Review the existing architecture.

4. Follow established project patterns.

5. Keep changes focused and minimal.

6. Maintain production-quality standards.

7. Validate everything.

8. Protect security.

9. Explain implementation clearly.

10. If requirements are unclear, stop and ask for clarification.

Never make assumptions that alter the architecture or long-term direction of AuraStack.

---

# END OF DOCUMENT

AuraStack Engineering Specification

Version 1.0.0

Status: Official

This document is the single source of truth for engineering decisions within AuraStack.

All contributors—human or AI—must follow this specification before implementing, modifying, or reviewing any part of the project.
