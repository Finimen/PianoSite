
from pydantic import BaseModel, Field


class UserLogin(BaseModel):
    name: str = Field(..., min_length=3, max_length=20)
    password: str = Field(..., min_length=8)

    class Config:
        schema_extra= {
            "example:":{
                "name": "jon_titer",
                "password": "ibm_5100",
            }
        }