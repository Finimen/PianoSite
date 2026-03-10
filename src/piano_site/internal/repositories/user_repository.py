from logging import getLogger
from typing import Optional
from unittest import result

from piano_site.internal.models.user_model import UserModel
from sqlalchemy import update, select, delete
from sqlalchemy.exc import NoResultFound
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql.coercions import expect

class UserRepository:
    def __init__(self, db_session: AsyncSession):
        self.db = db_session
        self.logger = getLogger(__name__)

    async def create_table(self):
        self.logger.info("migrations not found")

    async def get_user_by_username(self, username:str)->Optional[UserModel]:
        self.logger.info(f"getting teacher by username: {username}")

        try:
            query = select(UserModel).where(UserModel.name == username)
            result = await self.db.execute(query)
            user_model = result.scalar_one_or_none()

            return user_model

        except NoResultFound as exeption:
            self.logger.info(f"error getting user by username: {exeption}")
            raise
    
    async def create_user(self, user_model: UserModel) -> UserModel:
        self.logger.info(f"creating user: {user_model.name}")

        try:
            self.db.add(user_model)
            await self.db.commit()
            await self.db.refresh(user_model)

            self.logger.info(f"user created: {user_model.name}")
            return user_model
        
        except Exception as e:
            await self.db.rollback()
            self.logger.error(f"error creating user: {e}")
            raise

    async def delete_user(self, user_model: UserModel) -> bool:
        self.logger.info(f"deleting user: {user_model}")

        try:
            query = delete(UserModel).where(UserModel.name == user_model)
            result = await self.db.execute(query)
            await self.db.commit()

            deleted = result.one_or_none() != None

            if deleted:
                self.logger.info(f"user_deleted: {user_model}")
            else:
                self.logger.info(f"user_not_deleted: {user_model}")

            return deleted
        
        except Exception as e:
            await self.db.rollback()
            self.logger.error(f"error deleting user: {e}")
            raise

    async def get_all_users(self) -> list[UserModel]:
        self.logger.info("getting all users")

        try:
            query = select(UserModel).order_by(UserModel.id)

            result=await self.db.execute(query)
            users = result.scalars().all()

            self.logger.info(f"users found: {len(users)}")
            return list(users)
        
        except Exception as e:
            self.logger.error(f"error getting all users: {e}")
            raise
