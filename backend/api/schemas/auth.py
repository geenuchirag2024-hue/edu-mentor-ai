from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

VALID_ROLES = ("student", "teacher")


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)
    role: str = Field(default="student")

    @field_validator("role", mode="before")
    @classmethod
    def validate_role(cls, v: str | None) -> str:
        if v is None:
            return "student"
        cleaned = str(v).strip().lower()
        if cleaned not in VALID_ROLES:
            raise ValueError(f"Invalid role '{v}'. Must be one of: {', '.join(VALID_ROLES)}")
        return cleaned

    @model_validator(mode="before")
    @classmethod
    def populate_full_name(cls, data):
        if isinstance(data, dict):
            if "full_name" not in data and "name" in data:
                data["full_name"] = data["name"]
            elif "full_name" in data and "name" not in data:
                data["name"] = data["full_name"]
            if "role" not in data or not data["role"]:
                data["role"] = "student"
        return data

    @property
    def name(self) -> str:
        return self.full_name


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: int
    full_name: str
    email: EmailStr
    role: str = "student"
    created_at: datetime | None = None

    model_config = {"from_attributes": True}

    @property
    def name(self) -> str:
        return self.full_name


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut | None = None


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ForgotPasswordResponse(BaseModel):
    message: str
    reset_link_dev: str | None = None  # Exposed in dev when SMTP is unconfigured for local testing


class ValidateResetTokenRequest(BaseModel):
    token: str


class ValidateResetTokenResponse(BaseModel):
    valid: bool
    message: str


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=10)
    new_password: str = Field(min_length=6, max_length=128)


class ResetPasswordResponse(BaseModel):
    success: bool
    message: str
