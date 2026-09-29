import asyncio
import os

from dotenv import load_dotenv
from motor.motor_asyncio import AsyncIOMotorClient

load_dotenv()


async def main():
    client = AsyncIOMotorClient(
        os.environ["MONGODB_URI"],
        tls=True,
        serverSelectionTimeoutMS=10000,
    )

    try:
        result = await client.admin.command("ping")
        print("MOTOR PING:", result)
    finally:
        client.close()


asyncio.run(main())