from collections.abc import Callable

from fastapi import Request
from fastapi.routing import APIRoute

from app.core import config


class LargeFormRequest(Request):
    def form(self, *, max_files: int | float = 1000, max_fields: int | float = 1000, max_part_size: int = config.MAX_MANIFEST_BYTES * 2):
        return super().form(max_files=max_files, max_fields=max_fields, max_part_size=max_part_size)


class LargeFormRoute(APIRoute):
    def get_route_handler(self) -> Callable:
        handler = super().get_route_handler()

        async def with_large_form(request: Request):
            return await handler(LargeFormRequest(request.scope, request.receive))

        return with_large_form
