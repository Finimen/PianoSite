from typing import AsyncGenerator

from fastapi import Depends
from piano_site.internal.repositories.sessions import async_session
from piano_site.internal.repositories.user_repository import UserRepository
from piano_site.internal.services.auth_service import AuthService
from sqlalchemy.ext.asyncio import AsyncSession

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with async_session() as session:
        try:
            yield session
        finally:
            await session.close()

async def get_user_repository(db: AsyncSession = Depends(get_db)) -> UserRepository:
    return UserRepository(db)

async def get_auth_service(user_repository: UserRepository = Depends(get_user_repository)) -> AuthService:
    return AuthService(user_repository)