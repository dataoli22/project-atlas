from typing import Literal

from pydantic import BaseModel, Field


HydrationUnit = Literal["ml", "l"]
WeightUnit = Literal["kg", "lb"]


class HydrationMetric(BaseModel):
    amount: float = Field(..., ge=0, description="Measured hydration intake value.")
    unit: HydrationUnit = Field(default="ml")
    source: str | None = Field(default=None, description="Origin of the hydration value.")


class BodyWeightMetric(BaseModel):
    value: float = Field(..., gt=0, description="Body weight measurement value.")
    unit: WeightUnit = Field(default="kg")
    source: str | None = Field(default=None, description="Origin of the body weight value.")
