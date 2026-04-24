from __future__ import annotations

import math
import re
from collections import defaultdict
from datetime import date, datetime
from typing import Any

CATEGORY_RULES: dict[str, tuple[str, str]] = {
    "zomato": ("Food", "Expenses"),
    "swiggy": ("Food", "Expenses"),
    "restaurant": ("Food", "Expenses"),
    "cafe": ("Food", "Expenses"),
    "uber": ("Travel", "Expenses"),
    "ola": ("Travel", "Expenses"),
    "metro": ("Travel", "Expenses"),
    "amazon": ("Shopping", "Expenses"),
    "flipkart": ("Shopping", "Expenses"),
    "myntra": ("Shopping", "Expenses"),
    "sip": ("Investment", "Investments"),
    "stock": ("Investment", "Investments"),
    "mutual fund": ("Investment", "Investments"),
    "salary": ("Savings", "Savings"),
    "deposit": ("Savings", "Savings"),
    "scholarship": ("Savings", "Savings"),
    "freelance": ("Savings", "Savings"),
    "subscription": ("Subscriptions", "Expenses"),
    "netflix": ("Subscriptions", "Expenses"),
    "spotify": ("Subscriptions", "Expenses"),
}

MERCHANT_STOPWORDS = {
    "debited",
    "credited",
    "paid",
    "payment",
    "purchase",
    "spent",
    "at",
    "to",
    "via",
    "for",
    "on",
    "mutual",
    "fund",
}

CATEGORY_OPTIONS = [
    "Food",
    "Transport",
    "Shopping",
    "Entertainment",
    "Bills",
    "Health",
    "Education",
    "Subscriptions",
    "Clothing",
    "Investment",
    "Savings",
    "Other",
]

CATEGORY_TO_BUCKET = {
    "Food": "Expenses",
    "Transport": "Expenses",
    "Shopping": "Expenses",
    "Entertainment": "Expenses",
    "Bills": "Expenses",
    "Health": "Expenses",
    "Education": "Expenses",
    "Subscriptions": "Expenses",
    "Clothing": "Expenses",
    "Other": "Expenses",
    "Investment": "Investments",
    "Savings": "Savings",
}


class ParseError(ValueError):
    pass


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def extract_amount(message: str) -> float:
    amount_match = re.search(r"(?:rs\.?|inr|₹)?\s*(\d+(?:[.,]\d{1,2})?)", message, re.IGNORECASE)
    if not amount_match:
        raise ParseError("Could not find a valid amount in the message.")
    return float(amount_match.group(1).replace(",", ""))


def extract_merchant(message: str) -> str:
    lower_message = normalize_text(message)
    anchored_match = re.search(r"(?:at|to|from|via|for)\s+([a-zA-Z][a-zA-Z\s&.-]+)$", lower_message)
    if anchored_match:
        candidate = anchored_match.group(1)
    else:
        amount_removed = re.sub(r"(?:rs\.?|inr|₹)?\s*\d+(?:[.,]\d{1,2})?", "", lower_message, count=1)
        cleaned = re.sub(r"[^a-zA-Z\s&.-]", " ", amount_removed)
        words = [word for word in cleaned.split() if word not in MERCHANT_STOPWORDS]
        if not words:
            raise ParseError("Could not detect the merchant or transaction label.")
        candidate = " ".join(words)

    merchant = re.sub(r"\s+", " ", candidate).strip(" .-")
    if not merchant:
        raise ParseError("Could not detect the merchant or transaction label.")
    return merchant.title()


def infer_category(merchant: str, message: str) -> tuple[str | None, str | None]:
    haystack = normalize_text(f"{merchant} {message}")
    for keyword, (category, bucket) in CATEGORY_RULES.items():
        if keyword in haystack:
            return category, bucket
    return None, None


def parse_message(message: str) -> dict[str, Any]:
    amount = extract_amount(message)
    merchant = extract_merchant(message)
    category, bucket = infer_category(merchant, message)
    return {
        "amount": amount,
        "merchant": merchant,
        "category": category,
        "bucket": bucket,
        "needs_category": category is None,
    }


def bucket_totals(transactions: list[dict[str, Any]]) -> dict[str, float]:
    totals = {"Expenses": 0.0, "Savings": 0.0, "Investments": 0.0}
    for transaction in transactions:
        totals[transaction["bucket"]] += float(transaction["amount"])
    return totals


def category_distribution(transactions: list[dict[str, Any]]) -> dict[str, float]:
    distribution: dict[str, float] = defaultdict(float)
    for transaction in transactions:
        distribution[transaction["category"]] += float(transaction["amount"])
    return dict(sorted(distribution.items(), key=lambda item: item[1], reverse=True))


def analytics_summary(transactions: list[dict[str, Any]]) -> dict[str, Any]:
    totals = bucket_totals(transactions)
    expenses = totals["Expenses"]
    savings = totals["Savings"]
    investments = totals["Investments"]
    remaining_balance = savings - expenses - investments

    transaction_dates = [datetime.fromisoformat(item["date"]).date() for item in transactions]
    if transaction_dates:
        active_days = max((max(transaction_dates) - min(transaction_dates)).days + 1, 1)
    else:
        active_days = 1

    average_daily_spending = round(expenses / active_days, 2) if expenses else 0.0
    days_left = math.floor(remaining_balance / average_daily_spending) if average_daily_spending > 0 and remaining_balance > 0 else None

    expense_distribution = category_distribution([item for item in transactions if item["bucket"] == "Expenses"])
    food_spend = expense_distribution.get("Food", 0.0)
    warnings: list[str] = []
    suggestions: list[str] = []

    if expenses > 0 and food_spend / expenses > 0.4:
        warnings.append("Food spending is above 40% of total expenses. This looks like an overspending zone.")
        suggestions.append("Reduce food delivery orders and set a weekly eating-out cap.")

    subscription_spend = expense_distribution.get("Subscriptions", 0.0)
    if expenses > 0 and subscription_spend / expenses > 0.15:
        warnings.append("Subscriptions are taking a noticeable share of your monthly expenses.")
        suggestions.append("Pause low-value subscriptions until your balance stabilizes.")

    if days_left is not None and days_left <= 10:
        warnings.append(f"At the current pace, your balance may run out in about {days_left} days.")
        suggestions.append("Shift more inflows into savings or cut discretionary purchases this week.")

    if savings < expenses * 0.3 and expenses > 0:
        suggestions.append("Increase savings contributions so at least 30% of your expense load is covered by reserves.")

    if investments == 0 and savings > 1000:
        suggestions.append("You have idle savings available. Consider routing a small amount into investments each month.")

    if not suggestions:
        suggestions.append("Your money split looks stable. Keep tracking regularly to preserve momentum.")

    return {
        "totals": {
            "expenses": round(expenses, 2),
            "savings": round(savings, 2),
            "investments": round(investments, 2),
            "remaining_balance": round(remaining_balance, 2),
        },
        "average_daily_spending": average_daily_spending,
        "active_days": active_days,
        "predicted_days_left": days_left,
        "warnings": warnings,
        "suggestions": suggestions,
        "category_distribution": category_distribution(transactions),
        "expense_distribution": expense_distribution,
    }


def compute_goal_progress(goal: dict[str, Any], total_deposited: float) -> dict[str, Any]:
    target = float(goal["target_amount"])
    monthly_saving = float(goal.get("monthly_saving_amount", 0))
    amount_saved = min(max(total_deposited, 0.0), target)
    remaining_amount = max(target - amount_saved, 0.0)
    
    # Estimate ETA based on monthly saving amount
    if monthly_saving > 0 and remaining_amount > 0:
        estimated_months = round(remaining_amount / monthly_saving, 1)
    else:
        estimated_months = 0.0
    
    return {
        "total_deposited": round(total_deposited, 2),
        "amount_saved": round(amount_saved, 2),
        "remaining_amount": round(remaining_amount, 2),
        "estimated_months": estimated_months,
    }


def today_iso() -> str:
    return date.today().isoformat()


# ── A* Algorithm for Smart Saving Suggestions ──────────────────────────────────

class SavingNode:
    """Represents a state in the saving journey."""
    
    def __init__(self, saved_amount: float, months: int, expense_reduction: float = 0.0):
        self.saved_amount = saved_amount  # Current saved amount
        self.months = months  # Time elapsed in months
        self.expense_reduction = expense_reduction  # Total expense reduction applied
        self.g_n = months  # Cost from start (time elapsed)
        
    def h_n(self, target: float, monthly_rate: float) -> float:
        """Heuristic: estimated remaining time to reach target."""
        if monthly_rate <= 0:
            return float('inf')
        remaining = max(target - self.saved_amount, 0)
        return remaining / monthly_rate
    
    def f_n(self, target: float, monthly_rate: float) -> float:
        """f(n) = g(n) + h(n)"""
        return self.g_n + self.h_n(target, monthly_rate)


def calculate_astar_suggestion(
    target_amount: float,
    current_saved: float,
    monthly_saving: float,
    max_expense_reduction: float = 0.0,
) -> dict[str, Any]:
    """
    Use A* algorithm to find optimal saving strategy.
    
    Args:
        target_amount: Target saving goal
        current_saved: Already saved amount
        monthly_saving: Current monthly saving rate
        max_expense_reduction: Maximum possible expense reduction per month
    
    Returns:
        Dictionary with strategy, estimated months, and details
    """
    if current_saved >= target_amount:
        return {
            "strategy": "🎉 Goal Already Achieved!",
            "estimated_months": 0.0,
            "monthly_saving_amount": monthly_saving,
            "expense_reduction": 0.0,
            "details": [
                "Congratulations! You've already reached your target amount.",
                "Keep maintaining your current savings plan.",
            ],
        }
    
    remaining = target_amount - current_saved
    
    # Base case: no additional saving
    if monthly_saving <= 0:
        return {
            "strategy": "⚠️ No Saving Plan Set",
            "estimated_months": float('inf'),
            "monthly_saving_amount": 0.0,
            "expense_reduction": 0.0,
            "details": [
                "Please set a monthly saving amount to get a strategy.",
                "Even small amounts like ₹500/month will help you reach your goal.",
            ],
        }
    
    base_months = math.ceil(remaining / monthly_saving)
    
    # Strategy 1: Current pace
    strategy1_months = base_months
    
    # Strategy 2: Reduce expenses (if possible)
    strategy2_months = base_months
    expense_reduction = 0.0
    
    if max_expense_reduction > 0 and monthly_saving > 0:
        # Try reducing 10% of target as monthly savings boost
        boost_amount = min(max_expense_reduction, remaining * 0.1 / 12)  # 10% of target per year
        new_monthly = monthly_saving + boost_amount
        strategy2_months = math.ceil(remaining / new_monthly)
        expense_reduction = boost_amount
    
    # Choose best strategy
    if strategy2_months < strategy1_months and expense_reduction > 0:
        months_saved = strategy1_months - strategy2_months
        return {
            "strategy": "💡 Smart Expense Reduction Plan",
            "estimated_months": float(strategy2_months),
            "monthly_saving_amount": monthly_saving + expense_reduction,
            "expense_reduction": round(expense_reduction, 2),
            "details": [
                f"If you reduce expenses by ₹{round(expense_reduction)} per month,",
                f"you can reach your goal {months_saved} months faster!",
                f"New timeline: {strategy2_months} months (vs {base_months} months)",
                f"Total monthly saving: ₹{round(monthly_saving + expense_reduction)}",
            ],
        }
    else:
        return {
            "strategy": "📊 Steady Saving Plan",
            "estimated_months": float(base_months),
            "monthly_saving_amount": monthly_saving,
            "expense_reduction": 0.0,
            "details": [
                f"At your current saving rate of ₹{round(monthly_saving)}/month,",
                f"you'll reach your goal in approximately {base_months} months.",
                f"Total amount to save: ₹{round(remaining)}",
                "Stay consistent and track your progress regularly!",
            ],
        }


def analyze_spending_by_category(transactions: list[dict]) -> dict[str, float]:
    """
    Analyze transactions and return total spending by category.
    
    Args:
        transactions: List of transaction dictionaries
    
    Returns:
        Dictionary mapping category to total spending
    """
    spending = defaultdict(float)
    for txn in transactions:
        category = txn.get("category", "Other")
        amount = float(txn.get("amount", 0))
        if txn.get("bucket") == "Expenses":
            spending[category] += amount
    return dict(spending)


def calculate_astar_with_spending(
    target_amount: float,
    current_saved: float,
    monthly_saving: float,
    transactions: list[dict],
) -> dict[str, Any]:
    """
    Enhanced A* algorithm that considers actual spending patterns.
    
    Args:
        target_amount: Target saving goal
        current_saved: Already saved amount
        monthly_saving: Current monthly saving rate
        transactions: List of user's transactions for analysis
    
    Returns:
        Dictionary with strategy, estimated months, and personalized details
    """
    if current_saved >= target_amount:
        return {
            "strategy": "🎉 Goal Already Achieved!",
            "estimated_months": 0.0,
            "monthly_saving_amount": monthly_saving,
            "expense_reduction": 0.0,
            "details": [
                "Congratulations! You've already reached your target amount.",
                "Keep maintaining your current savings plan.",
            ],
        }
    
    remaining = target_amount - current_saved
    
    # Base case: no additional saving
    if monthly_saving <= 0:
        return {
            "strategy": "⚠️ No Saving Plan Set",
            "estimated_months": float('inf'),
            "monthly_saving_amount": 0.0,
            "expense_reduction": 0.0,
            "details": [
                "Please set a monthly saving amount to get a strategy.",
                "Even small amounts like ₹500/month will help you reach your goal.",
            ],
        }
    
    base_months = math.ceil(remaining / monthly_saving)
    
    # Analyze spending patterns
    spending_by_category = analyze_spending_by_category(transactions)
    
    if not spending_by_category:
        # No spending data, use basic calculation
        return {
            "strategy": "📊 Steady Saving Plan",
            "estimated_months": float(base_months),
            "monthly_saving_amount": monthly_saving,
            "expense_reduction": 0.0,
            "details": [
                f"At your current saving rate of ₹{round(monthly_saving)}/month,",
                f"you'll reach your goal in approximately {base_months} months.",
                f"Total amount to save: ₹{round(remaining)}",
                "Start tracking your spending to get personalized suggestions.",
            ],
        }
    
    # Find top spending categories
    sorted_categories = sorted(spending_by_category.items(), key=lambda x: x[1], reverse=True)
    
    # Calculate average monthly spending per category
    num_months = max(1, len(transactions) / max(1, sum(1 for t in transactions if t.get("bucket") == "Expenses")))
    avg_monthly_spending = {cat: amount / max(1, num_months) for cat, amount in spending_by_category.items()}
    
    # Identify top 3 categories for reduction
    top_categories = sorted_categories[:3]
    
    # Calculate realistic expense reduction (20-30% of top category)
    max_reducible = 0.0
    reduction_details = []
    
    for category, total in top_categories:
        if total > 0:
            avg_monthly = total / max(1, num_months)
            # Suggest 15-25% reduction in each category
            reducible = avg_monthly * 0.20
            max_reducible += reducible
            if reducible > 10:  # Only suggest if meaningful amount
                reduction_details.append(
                    f"Cut {category} by 20% (₹{round(reducible)}/month)"
                )
    
    # Calculate with expense reduction
    strategy2_months = base_months
    expense_reduction = 0.0
    
    if max_reducible > 0:
        new_monthly = monthly_saving + max_reducible
        strategy2_months = math.ceil(remaining / new_monthly)
        expense_reduction = max_reducible
    
    # Choose best strategy
    if strategy2_months < base_months and expense_reduction > 0:
        months_saved = base_months - strategy2_months
        
        details = [
            f"Based on your spending analysis, we found savings opportunities:",
        ] + reduction_details + [
            f"",
            f"💰 Potential savings: ₹{round(expense_reduction)}/month",
            f"⏱️ Timeline reduction: {months_saved} months faster!",
            f"📍 New timeline: {strategy2_months} months (vs {base_months} months)",
            f"📊 New monthly target: ₹{round(monthly_saving + expense_reduction)}",
        ]
        
        return {
            "strategy": "💡 Smart Expense Reduction Plan",
            "estimated_months": float(strategy2_months),
            "monthly_saving_amount": monthly_saving + expense_reduction,
            "expense_reduction": round(expense_reduction, 2),
            "details": details,
        }
    else:
        top_cat_names = ", ".join([cat for cat, _ in top_categories[:2]])
        return {
            "strategy": "📊 Smart Saving Plan",
            "estimated_months": float(base_months),
            "monthly_saving_amount": monthly_saving,
            "expense_reduction": 0.0,
            "details": [
                f"At ₹{round(monthly_saving)}/month, you'll reach your goal in ~{base_months} months.",
                f"Your main expenses are: {top_cat_names}",
                f"💡 Tip: Consider cutting 10-15% from these categories for faster progress.",
                f"Total remaining: ₹{round(remaining)}",
            ],
        }
