import asyncio

from ..common.logs import setup
from ..common.settings import get_settings
from .service import Ingest


def main() -> None:
    s = get_settings()
    setup(s.log_level)
    asyncio.run(Ingest(s).run())


if __name__ == "__main__":
    main()
