import { Module, Global, Logger } from "@nestjs/common";
import { CacheModule as NestCacheModule } from "@nestjs/cache-manager";
import { ConfigModule, ConfigService } from "@nestjs/config";
import Keyv from "keyv";
import KeyvRedis from "@keyv/redis";

@Global()
@Module({
  imports: [
    NestCacheModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger("CacheModule");
        const redisUrl = configService.get<string>("REDIS_URL");
        const redisEnabled =
          configService.get<string>("REDIS_ENABLED", "false").toLowerCase() ===
          "true";

        const defaultTtl =
          Number.parseInt(
            configService.get<string>("CACHE_DEFAULT_TTL") || "3600",
            10,
          ) * 1000;
        const maxItems = Number.parseInt(
          configService.get<string>("CACHE_MAX_ITEMS") || "100",
          10,
        );

        if (redisEnabled && redisUrl) {
          try {
            logger.log(
              `Initializing Redis cache with URL: ${redisUrl.replace(/:[^:@]+@/, ":****@")}`,
            );
            const keyvRedis = new KeyvRedis(redisUrl);
            const keyv = new Keyv({
              store: keyvRedis,
              namespace: "app-cache",
            });
            return {
              store: keyv as any,
              ttl: defaultTtl,
            };
          } catch (error) {
            logger.error(
              `Failed to initialize Redis cache: ${error.message}. Falling back to in-memory cache.`,
            );
          }
        } else if (redisEnabled && !redisUrl) {
          logger.warn(
            "REDIS_ENABLED is true but REDIS_URL is not set. Falling back to in-memory cache.",
          );
        }

        logger.log("Using in-memory cache");
        return {
          ttl: defaultTtl,
          max: maxItems,
        };
      },
      inject: [ConfigService],
    }),
  ],
  exports: [NestCacheModule],
})
export class CacheModule {}
