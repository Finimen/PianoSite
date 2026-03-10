from datetime import datetime
import string

from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy import Column, Integer, String, Boolean, DateTime

Base = declarative_base()

class UserModel(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True)
    name = Column(String(20), nullable=False, unique=True)
    email = Column(String(100), nullable=False, unique=True)
    password_hash = Column(String(200), nullable=False)
    
    is_verified = Column(Boolean, default=True, nullable=False)
    verify_token = Column(String(100), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)