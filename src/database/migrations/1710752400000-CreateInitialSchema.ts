import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateInitialSchema1710752400000 implements MigrationInterface {
  name = 'CreateInitialSchema1710752400000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Create tables for users, tasks, and other entities
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "users" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "email" varchar NOT NULL UNIQUE,
        "name" varchar NOT NULL,
        "password" varchar NOT NULL,
        "role" varchar NOT NULL DEFAULT 'user',
        "refresh_token_hash" varchar,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now()
      )
    `);

    // Enable UUID extension if not already enabled
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "tasks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "title" varchar NOT NULL,
        "description" text,
        "status" varchar NOT NULL DEFAULT 'PENDING',
        "priority" varchar NOT NULL DEFAULT 'MEDIUM',
        "due_date" TIMESTAMP,
        "user_id" uuid NOT NULL,
        "created_at" TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "fk_user_id" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE
      )
    `);

    // Useful indexes for performance
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks (status)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks (priority)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks (due_date)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks (user_id)`);
    await queryRunner.query(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email)`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "tasks"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "users"`);
  }
}