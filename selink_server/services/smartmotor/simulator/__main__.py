import asyncio

from ..common.settings import get_settings
from ..common.logs import setup
from .service import Simulator


if __name__ == "__main__":
    settings = get_settings()
    setup(settings.log_level)
    asyncio.run(Simulator(settings).run())
