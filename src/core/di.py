from mmap import ACCESS_COPY
from typing import AsyncGenerator

from src.core.configs.prod import Settings
from fastapi import Depends
from src.internal.repositories.sessions import async_session
from src.internal.repositories.user_repository import UserRepository
from src.internal.services.auth_service import AuthService
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_user_repository(db: AsyncSession = Depends(get_db)) -> UserRepository:
    return UserRepository(db)

async def get_config() -> Settings:
    return Settings()

async def get_auth_service(
        user_repository: UserRepository = Depends(get_user_repository),
        config : Settings = Depends(get_config)
          ) -> AuthService:
    return AuthService(user_repository, config)
