import asyncio

from ..common.logs import setup
from ..common.settings import get_settings
from .service import Analytics


def main() -> None:
    s = get_settings()
    setup(s.log_level)
    asyncio.run(Analytics(s).run())


if __name__ == "__main__":
    main()
