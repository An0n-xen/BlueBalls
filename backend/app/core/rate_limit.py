import time
from app.core.redis import redis_client
from fastapi import Request, HTTPException, status
from typing import Callable


async def check_rate_limit(
    identifier: str, limit: int, window_size_seconds: int = 60
) -> bool:
    """
    Evaluates if a request is allowed based on the sliding window counter algorithm.
    """

    window_size_seconds = 60
    current_time = time.time()

    # calculate the timestamp of current and previous fixed windows
    current_window_start = (
        int(current_time // window_size_seconds) * window_size_seconds
    )
    previous_window_start = current_window_start - window_size_seconds

    curr_key = f"rate_limit:{identifier}:{int(current_window_start)}"
    prev_key = f"rate_limit:{identifier}:{int(previous_window_start)}"

    # query redis for both simultanously
    prev_count_str, curr_count_str = await redis_client.mget([prev_key, curr_key])

    # convert to int, default to 0 if None
    prev_count = int(prev_count_str) if prev_count_str else 0
    curr_count = int(curr_count_str) if curr_count_str else 0

    # calculate the weighted average
    time_into_current_window = current_time - current_window_start
    prev_weight = (window_size_seconds - time_into_current_window) / window_size_seconds

    estimated_requests = (prev_count * prev_weight) + curr_count

    if estimated_requests > limit:
        return False

    async with redis_client.pipeline() as pipe:
        pipe.incr(curr_key)
        pipe.expire(curr_key, window_size_seconds * 2)
        await pipe.execute()

    return True


def get_rate_limit(limit: int, window_size_seconds: int = 60) -> Callable:
    """
    Returns a FastAPI dependency that checks the rate limit.
    """

    async def _rate_limit_dependency(request: Request):
        client_ip = request.client.host if request.client else "unknown"

        identifier = f"ip:{client_ip}"

        is_allowed = await check_rate_limit(identifier, limit, window_size_seconds)

        if not is_allowed:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Too many requests",
            )

    return _rate_limit_dependency
