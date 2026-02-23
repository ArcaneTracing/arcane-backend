import { Module } from "@nestjs/common";

export const Session =
  () =>
  (target: unknown, propertyKey: string | symbol, parameterIndex: number) => {};

export const AllowAnonymous =
  () =>
  (
    target: unknown,
    propertyKey?: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {};

export const Hook = () => (target: unknown) => {};

export const AfterHook =
  (_path: string) =>
  (
    target: unknown,
    propertyKey: string | symbol,
    descriptor?: PropertyDescriptor,
  ) => {};

export type AuthHookContext = Record<string, unknown>;

export class UserSession {}

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
