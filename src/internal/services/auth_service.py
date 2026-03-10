from logging import getLogger
from typing import Optional, List
from fastapi import HTTPException, status
from src.internal.models.user_model import UserModel
from src.internal.models.token import Token, TokenPayload
from src.internal.repositories.user_repository import UserRepository
import bcrypt
import secrets
import jwt 
from datetime import datetime, timedelta
from src.core.configs.prod import Settings

class AuthService:
    def __init__(self, repository: UserRepository, config: Settings):
        self.repository = repository
        self.logger = getLogger(__name__)
        self.config = config

    async def register(self, name:str, email:str, password:str) -> UserModel:
        self.logger.info(f"registering user {name}")

        existing = await self.repository.get_user_by_username(name)
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already exist"
            )
        
        salt = bcrypt.gensalt()
        password_hash = bcrypt.hashpw(password.encode('utf-8'), salt)

        user = UserModel(
            name=name,
            email=email,
            password_hash=password_hash.decode('utf-8'),
            verify_token=secrets.token_urlsafe(32)
        )

        return await self.repository.create_user(user)

    async def login(self, name:str, password:str)->Token:
        self.logger.info(f"logging user{name}")
        
        user = await self.repository.get_user_by_username(name)

        if not user:
            self.logger.error(f"user not found: {name}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid username or password",
                headers={"WWW-Authenticate": "Bearer"}
                )

        password_bytes = password.encode('utf-8')
        hash_bytes = user.password_hash.encode('utf-8')
        
        if not bcrypt.checkpw(password_bytes, hash_bytes):
            self.logger.warning(f"invalid password for {name}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invalid username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token = self.create_access_token(  
            data={"sub": user.name}
        )
        
        self.logger.info(f"user logged in successfully: {name}")
        return Token(access_token=access_token)

    def create_access_token(self, data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=self.config.ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp":expire})
        encoded_jwt = jwt.encode(to_encode, self.config.JWT_SECRET_KEY, algorithm=self.config.JWT_ALGORITHM)
        return encoded_jwt
    
    async def logout(self, token:Optional[str]):
        self.logger.info("try to logout")

    async def get_current_user(self, token: str) -> UserModel:
        try:
            payload = jwt.decode(token, self.config.JWT_SECRET_KEY, algorithms=[self.config.JWT_ALGORITHM])
            
            name = payload.get("sub")
            if name is None or not isinstance(name, str):
                self.logger.warning("Token missing 'sub' claim")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid authentication credentials"
                )
            
            user = await self.repository.get_user_by_username(name)
            if user is None:
                self.logger.warning(f"User not found: {name}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="User not found"
                )
            
            return user
            
        except jwt.PyJWTError as e:
            self.logger.error(f"JWT error: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication credentials"
            )