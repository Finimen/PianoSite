from src.internal.models.user_model import Base
from src.internal.repositories.sessions import engine

async def init_db():
    """Create database tables"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Database tables created!")