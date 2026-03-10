import re

from pydantic import BaseModel, EmailStr, Field, validator

class UserCreate(BaseModel):
    name: str = Field(..., min_length=3, max_length=20, description="Username must be 3-20 characters")
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=100, description="Password must be 8-100 characters")

    @validator('name')
    def name_alphanumeric(cls, v):
        if not re.match("^[a-zA-Z0-9_]+$", v):
            raise ValueError('Username must be alphanumeric or underscore')
        return v
    
    @validator('password')
    def password_strength(cls, v):
        """Check password strength"""
        if not any(char.isdigit() for char in v):
            raise ValueError('Password must contain at least one number')
        if not any(char.isupper() for char in v):
            raise ValueError('Password must contain at least one uppercase letter')
        return v