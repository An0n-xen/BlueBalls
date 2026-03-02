import redis.asyncio as redis

# This holds the global connection
redis_client: redis.Redis | None = None
