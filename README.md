# TaskFlow API - Production-Ready Refactor

## Introduction

This repository has been refactored to address performance, scalability, security, and reliability concerns and provide a production-ready baseline. Below are the key improvements and how to run the system.

## Tech Stack

- Language: TypeScript
- Framework: NestJS
- ORM: TypeORM with PostgreSQL
- Queue: BullMQ with Redis
- Package Manager: Bun
- Testing: Bun test

## Getting Started

1. Install deps: `bun install`
2. Copy env: `cp .env.example .env` and configure DB/Redis + `jwt.secret`, `jwt.expiresIn`.
3. Build: `bun run build`
4. Migrate: `bun run migration:run`
5. Seed (optional): `bun run seed`
6. Start: `bun run start:dev`

## Key Improvements

- Performance & scalability
  - DB-side filtering/search/pagination via `TasksService.findAllPaginated`
  - SQL aggregations for stats via `TasksService.getStatistics`
  - Bulk batch complete/delete with ownership checks
  - Indexes on `tasks(status, priority, due_date, user_id)` and `users(email)`

- Architecture
  - Controllers no longer access repositories directly
  - `TaskFilterDto` with validation + Swagger
  - Global exception filter and rate limiter guard registration

- Security
  - Enforced JWT on tasks routes
  - Refresh token rotation with server-side hashed storage (`refresh_token_hash`) via `/auth/refresh`
  - Stricter validation and safe error responses

- Resilience & Observability
  - Consistent exception responses with logging
  - Safer queue interactions
  - Global throttling plus per-route rate limiting

## API Endpoints

- Auth
  - POST `/auth/login` → `{ access_token, refresh_token, user }`
  - POST `/auth/register` → `{ access_token, refresh_token, user }`
  - POST `/auth/refresh` → body `{ userId, refreshToken }` → new tokens

- Tasks (JWT required)
  - GET `/tasks` with `status, priority, search, fromDate, toDate, page, limit, sortBy, sortOrder`
  - GET `/tasks/:id`
  - POST `/tasks`
  - PATCH `/tasks/:id`
  - DELETE `/tasks/:id`
  - POST `/tasks/batch` → `{ tasks: string[], action: 'complete' | 'delete' }`

## Ownership & Roles

- Non-admins only access their own tasks; admins can filter by `userId`.

## Notes

- In-memory rate limiting is safe and bounded here; for multi-instance deployments, use a Redis-backed limiter.
- The provided in-memory cache is not used in critical paths; replace with a distributed cache where necessary.