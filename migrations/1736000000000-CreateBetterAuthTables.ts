import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateBetterAuthTables1736000000000 implements MigrationInterface {
  name = 'CreateBetterAuthTables1736000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      'create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null, "auth0Id" text);',
    );
    await queryRunner.query(
      'create table "session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);',
    );
    await queryRunner.query(
      'create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);',
    );
    await queryRunner.query(
      'create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);',
    );
    await queryRunner.query('create index "session_userId_idx" on "session" ("userId");');
    await queryRunner.query('create index "account_userId_idx" on "account" ("userId");');
    await queryRunner.query('create index "verification_identifier_idx" on "verification" ("identifier");');
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('drop index if exists "verification_identifier_idx";');
    await queryRunner.query('drop index if exists "account_userId_idx";');
    await queryRunner.query('drop index if exists "session_userId_idx";');
    await queryRunner.query('drop table if exists "verification";');
    await queryRunner.query('drop table if exists "account";');
    await queryRunner.query('drop table if exists "session";');
    await queryRunner.query('drop table if exists "user";');
  }
}
