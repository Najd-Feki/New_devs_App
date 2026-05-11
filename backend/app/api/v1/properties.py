from fastapi import APIRouter, Depends, HTTPException, Query
from typing import Dict, Any, List
from app.core.auth import authenticate_request as get_current_user
from app.core.database_pool import db_pool
from sqlalchemy import text

router = APIRouter()


@router.get("/properties")
async def get_properties(
    page: int = Query(1, ge=1),
    page_size: int = Query(1000, ge=1, le=5000),
    current_user: dict = Depends(get_current_user),
) -> Dict[str, Any]:
    tenant_id = getattr(current_user, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=403, detail="Tenant context is required")

    try:
        if db_pool.session_factory is None:
            await db_pool.initialize()

        if not db_pool.session_factory:
            raise HTTPException(status_code=503, detail="Database pool not available")

        offset = (page - 1) * page_size

        async with (await db_pool.get_session()) as session:
            count_query = text(
                """
                SELECT COUNT(*) AS total
                FROM properties
                WHERE tenant_id = :tenant_id
                """
            )
            count_result = await session.execute(count_query, {"tenant_id": tenant_id})
            total = int(count_result.scalar() or 0)

            data_query = text(
                """
                SELECT id, name, timezone
                FROM properties
                WHERE tenant_id = :tenant_id
                ORDER BY name ASC
                LIMIT :limit OFFSET :offset
                """
            )
            rows = await session.execute(
                data_query,
                {"tenant_id": tenant_id, "limit": page_size, "offset": offset},
            )

            items: List[Dict[str, Any]] = [
                {"id": row.id, "name": row.name, "timezone": row.timezone}
                for row in rows.fetchall()
            ]

            return {"items": items, "total": total, "page": page, "page_size": page_size}
    except HTTPException:
        raise
    except Exception as error:
        raise HTTPException(status_code=500, detail=f"Failed to fetch properties: {error}")
