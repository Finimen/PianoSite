from logging import getLogger
from typing import Optional, List
from fastapi import HTTPException, status
from piano_site.internal.models.user_model import UserModel
from piano_site.internal.models.token import Token, TokenPayload
from piano_site.internal.repositories.user_repository import UserRepository
import bcrypt
import secrets
import jwt 
from datetime import datetime, timedelta

SECRET_KEY = "your-secret-key-here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

class AuthService:
    def __init__(self, repository: UserRepository):
        self.repository = repository
        self.logger = getLogger(__name__)

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

        if not bcrypt.checkpw(password.encode('utf-8'), user.password_hash.encode('utf-8')):
            self.logger.warning(f"invalid password for {name}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="invaldi username or password",
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        access_token = await self.create_access_token(
            data={"sub": user.name}
        )
        
        self.logger.info(f"user loggd in successfully: {name}")
        return Token(access_token=access_token)

    async def create_access_token(self, data: dict) -> str:
        to_encode = data.copy()
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        to_encode.update({"exp":expire})
        encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
        return encoded_jwt
    
    async def logout(self, token:Optional[str]):
        self.logger.info("try to logout")

    async def get_current_user(self, token: str) -> UserModel:
        try:
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            
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