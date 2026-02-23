// E2E-safe mock for @thallesp/nestjs-better-auth.
// Decorator exports must be decorator factories returning actual decorator functions,
// otherwise Nest/reflect-metadata will crash with "decorator is not a function".

import { Module } from "@nestjs/common";

// Parameter decorator: @Session()
export const Session =
  () =>
  (target: unknown, propertyKey: string | symbol, parameterIndex: number) => {
    // no-op decorator
  };

// Class/method decorator: @AllowAnonymous()
export const AllowAnonymous =
  () =>
  (
    target: unknown,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    // no-op decorator
  };

// Class decorator: @Hook()
export const Hook = () => (target: unknown) => {
  // no-op decorator
};

// Method decorator: @AfterHook(path)
export const AfterHook =
  (_path: string) =>
  (
    target: unknown,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {
    // no-op decorator
  };

// Type for auth hook context (used as type only)
export type AuthHookContext = Record<string, unknown>;

// Simple class mock used as a type only in controllers
export class UserSession {}

// Fake module for AppModule import (must have forRoot for dynamic module registration)
@Module({})
export class AuthModule {
  static forRoot(_options: {
    auth: Record<string, unknown>;
    disableTrustedOriginsCors?: boolean;
  }) {
    return {
      module: AuthModule,
      global: true,
    };
  }
}
