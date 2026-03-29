import re
from pydantic import BaseModel, EmailStr, Field, field_validator
from typing import Optional
from datetime import datetime

PASSWORD_ALLOWED_REGEX = re.compile(r"^[A-Za-z0-9!@#$%_\-\.]+$")


class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=72)
    referral_code: Optional[str] = None

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        # bcrypt supports only first 72 bytes; keep passwords ASCII and bounded.
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Пароль не должен превышать 72 символа")
        if not PASSWORD_ALLOWED_REGEX.match(value):
            raise ValueError(
                "Разрешены только латинские буквы, цифры и спецсимволы: ! @ # $ % _ - ."
            )
        return value


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(..., min_length=8, max_length=72)

    @field_validator("new_password")
    @classmethod
    def validate_new_password(cls, value: str) -> str:
        if len(value.encode("utf-8")) > 72:
            raise ValueError("Пароль не должен превышать 72 символа")
        if not PASSWORD_ALLOWED_REGEX.match(value):
            raise ValueError(
                "Разрешены только латинские буквы, цифры и спецсимволы: ! @ # $ % _ - ."
            )
        return value


class MessageResponse(BaseModel):
    message: str


class UserResponse(BaseModel):
    id: int
    email: str
    referral_code: str
    referral_balance: float
    is_admin: bool
    created_at: datetime
    
    class Config:
        from_attributes = True


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse
