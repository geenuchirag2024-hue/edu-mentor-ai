"""Safe, backward-compatible migration: add role column to users table."""

import asyncio
import sys
from pathlib import Path

# Ensure project root is on sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine

from backend.config import get_settings
from backend.db.database import _async_url


async def run_migration():
    settings = get_settings()
    url = _async_url(settings.database_url)
    print(f"[Migration] Connecting to database: {url}")
    engine = create_async_engine(url)

    async with engine.begin() as conn:
        # Check current columns in users table
        query_cols = text(
            "SELECT column_name, data_type, column_default "
            "FROM information_schema.columns "
            "WHERE table_name = 'users';"
        )
        res = await conn.execute(query_cols)
        cols = {r[0]: r[1] for r in res.fetchall()}
        print(f"[Migration] Current columns in users: {list(cols.keys())}")

        if "role" not in cols:
            print("[Migration] Adding 'role' column (VARCHAR(20) DEFAULT 'student' NOT NULL)...")
            await conn.execute(
                text("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'student';")
            )
            print("[Migration] Column 'role' added successfully.")
        else:
            print("[Migration] Column 'role' already exists in users table.")

        # Ensure any rows with NULL or empty role are set to 'student'
        await conn.execute(
            text("UPDATE users SET role = 'student' WHERE role IS NULL OR role = '';")
        )

        # Print all users to verify
        users_res = await conn.execute(text("SELECT id, full_name, email, role FROM users;"))
        users = users_res.fetchall()
        print(f"[Migration] Verified {len(users)} users in database:")
        for u in users:
            print(f"  User id={u[0]} name='{u[1]}' email='{u[2]}' role='{u[3]}'")

    await engine.dispose()
    print("[Migration] Migration completed successfully.")


if __name__ == "__main__":
    asyncio.run(run_migration())
