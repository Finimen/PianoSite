import os
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./user.db")

engine = create_async_engine(
    url=DATABASE_URL,
    echo=False
)

async_session = async_sessionmaker(
    engine, 
    class_=AsyncSession,
    expire_on_commit=False
)

# Alternative sessionmaker:
# from sqlalchemy.orm import sessionmaker
# async_session = sessionmaker(
#     engine, 
#     class_=AsyncSession,
#     expire_on_commit=False
# )