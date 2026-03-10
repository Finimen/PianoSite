from logging import getLogger
from typing import List


from fastapi import Depends
from fastapi.routing import APIRouter
from fastapi.security import OAuth2PasswordBearer
from src.internal.models.token import Token
from src.core.di import get_auth_service
from src.internal.domain.user import UserResponse
from src.internal.models.user_create import UserCreate
from src.internal.models.user_login import UserLogin
from src.internal.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])
logger = getLogger('auth_handler')

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

@router.post("/register", response_model=UserResponse)
async def register(user_data: UserCreate, auth_service: AuthService = Depends(get_auth_service)):
    logger.info(f"register attemt for {user_data.name}")

    user = await auth_service.register(
        name=user_data.name,
        email=user_data.email,
        password=user_data.password,
    )
    
    return user

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin, auth_service: AuthService = Depends(get_auth_service)):
    logger.info(f"login attemot for {login_data.name}")

    token = await auth_service.login(
        name=login_data.name,
        password=login_data.password
    )

    return token

@router.post("/logout")
async def logout(token:str = Depends(oauth2_scheme), auth_service: AuthService = Depends(get_auth_service)):
    logger.info(f"logout attempt")

    result = await auth_service.logout(token)
    return result

@router.get("/me", response_model=UserResponse)
async def get_user(token: str = Depends(oauth2_scheme), auth_service: AuthService = Depends(get_auth_service)):
    logger.info("getting current user")
    user = await auth_service.get_current_user(token)
    return user

@router.get("/all", response_model=List[UserResponse])
async def get_all_users():
    logger.info("gettting all users")
    raise