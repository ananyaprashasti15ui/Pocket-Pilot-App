from __future__ import annotations

from datetime import date as date_type
from typing import Literal

from pydantic import BaseModel, Field

BucketType = Literal["Expenses", "Savings", "Investments"]


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: str = Field(min_length=5)
    name: str = Field(min_length=2)
    password: str = Field(min_length=6)


class UserLogin(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    user_name: str
    user_email: str


# ── Transactions ──────────────────────────────────────────────────────────────

class TransactionCreate(BaseModel):
    amount: float = Field(gt=0)
    merchant: str = Field(min_length=1, max_length=80)
    category: str
    date: date_type | None = None


class TransactionUpdate(BaseModel):
    amount: float | None = Field(default=None, gt=0)
    merchant: str | None = Field(default=None, min_length=1, max_length=80)
    category: str | None = None
    date: date_type | None = None


class TransactionResponse(BaseModel):
    id: int
    date: str
    amount: float
    merchant: str
    category: str
    bucket: BucketType
    original_message: str


# ── Budget ────────────────────────────────────────────────────────────────────

class BudgetSet(BaseModel):
    amount: float = Field(gt=0)


# ── Goals ─────────────────────────────────────────────────────────────────────

class GoalCreate(BaseModel):
    name: str = Field(min_length=2)
    target_amount: float = Field(gt=0)
    monthly_saving_amount: float = Field(default=0, ge=0)


class GoalUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=2)
    target_amount: float | None = Field(default=None, gt=0)
    monthly_saving_amount: float | None = Field(default=None, ge=0)


class GoalDepositCreate(BaseModel):
    amount: float = Field(gt=0)
    date: date_type | None = None


class GoalDepositResponse(BaseModel):
    id: int
    goal_id: int
    amount: float
    date: str


class GoalResponse(BaseModel):
    id: int
    created_at: str
    name: str
    target_amount: float
    monthly_saving_amount: float
    total_deposited: float
    amount_saved: float
    remaining_amount: float
    estimated_months: float
    deposits: list[GoalDepositResponse] = []


class SavingSuggestion(BaseModel):
    strategy: str
    estimated_months: float
    monthly_saving_amount: float
    expense_reduction: float
    details: list[str]
