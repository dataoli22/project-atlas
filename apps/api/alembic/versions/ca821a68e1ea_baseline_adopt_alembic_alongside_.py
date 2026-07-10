"""baseline: adopt Alembic alongside existing db.py migrations

Intentionally a no-op. The existing app_state / connector_sync_history / planner_generation_history
tables are created and versioned by app/features/shared/services/db.py's own
PRAGMA-user_version-based migration list (_MIGRATIONS), NOT by Alembic - that system stays the
source of truth for those tables and is not being replaced here (see alembic/README.atlas.md for
why).

This revision exists purely as revision zero for whichever future migration first adds a real
relational table (e.g. a nutrition recipe library, or endurance biometric normalization tables)
that actually needs foreign keys / joins the KV-table approach can't express. Until that day,
running `alembic upgrade head` against a fresh or existing Atlas database is expected to do
nothing and change nothing.

Revision ID: ca821a68e1ea
Revises:
Create Date: 2026-07-10 12:44:19.733163

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'ca821a68e1ea'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    pass


def downgrade() -> None:
    """Downgrade schema."""
    pass
