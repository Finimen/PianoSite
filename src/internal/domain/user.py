from pydantic import BaseModel, EmailStr, Field


class UserResponse(BaseModel):
    name: str = Field(..., min_length=3, max_length=20)
    email: EmailStr

    class Config:
        from_attributes = True