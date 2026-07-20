from datetime import datetime
from enum import Enum
from typing import Annotated, Any

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field

# Mongo's ObjectId is not a JSON type, so serialise it as a string on the way out.
ObjectIdStr = Annotated[str, BeforeValidator(str)]


class Status(str, Enum):
    open = "open"
    pending = "pending"
    closed = "closed"


class TicketCreate(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)


class TicketUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    status: Status | None = None

    def changes(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True, exclude_none=True)


class Ticket(BaseModel):
    model_config = ConfigDict(populate_by_name=True)

    # Reads Mongo's "_id" but serialises as "id" for the client.
    id: ObjectIdStr = Field(validation_alias="_id")
    title: str
    description: str
    status: Status
    created_at: datetime
    updated_at: datetime
