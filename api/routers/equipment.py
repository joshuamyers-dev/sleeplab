from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..auth import get_current_user
from ..database import get_db
from ..models import EquipmentCreate, EquipmentResponse, EquipmentUpdate, InferredEquipment

router = APIRouter()

EQUIPMENT_TYPES = {"cushion", "headgear", "tubing", "humidifier_chamber", "filter"}


def _row_to_response(row: dict, ref_date: date | None = None) -> EquipmentResponse:
    days_in_use = None
    if ref_date and row["start_date"]:
        days_in_use = (ref_date - row["start_date"]).days
    return EquipmentResponse(
        id=str(row["id"]),
        equipment_type=row["equipment_type"],
        start_date=row["start_date"],
        replacement_days=row["replacement_days"],
        mask_category=row["mask_category"],
        brand=row["brand"],
        model=row["model"],
        notes=row["notes"],
        days_in_use=days_in_use,
        created_at=row["created_at"],
        updated_at=row["updated_at"],
    )


@router.get("/", response_model=list[EquipmentResponse], operation_id="list_equipment")
def list_equipment(
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all CPAP equipment/accessories for the current user.

    Returns equipment sorted by type and start date (most recent first).
    """
    rows = (
        db.execute(
            text("""
            SELECT id::text AS id, equipment_type, start_date, replacement_days,
                   mask_category, brand, model, notes, created_at, updated_at
            FROM user_equipment
            WHERE user_id = CAST(:uid AS uuid)
            ORDER BY equipment_type, start_date DESC
        """),
            {"uid": current_user["id"]},
        )
        .mappings()
        .all()
    )
    today = date.today()
    return [_row_to_response(dict(r), today) for r in rows]


@router.post("/", response_model=EquipmentResponse, status_code=201, operation_id="create_equipment")
def create_equipment(
    body: EquipmentCreate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new CPAP equipment/accessory record.

    Returns the created equipment with days_in_use calculated from today.
    """
    row = (
        db.execute(
            text("""
            INSERT INTO user_equipment
                (user_id, equipment_type, start_date, replacement_days,
                 mask_category, brand, model, notes)
            VALUES
                (CAST(:uid AS uuid), :equipment_type, :start_date, :replacement_days,
                 :mask_category, :brand, :model, :notes)
            RETURNING id::text AS id, equipment_type, start_date, replacement_days,
                      mask_category, brand, model, notes, created_at, updated_at
        """),
            {
                "uid": current_user["id"],
                "equipment_type": body.equipment_type,
                "start_date": body.start_date,
                "replacement_days": body.replacement_days,
                "mask_category": body.mask_category,
                "brand": body.brand,
                "model": body.model,
                "notes": body.notes,
            },
        )
        .mappings()
        .first()
    )
    db.commit()
    return _row_to_response(dict(row), date.today())


@router.put("/{equipment_id}", response_model=EquipmentResponse, operation_id="update_equipment")
def update_equipment(
    equipment_id: str,
    body: EquipmentUpdate,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update an existing CPAP equipment/accessory record.

    Only provided fields are updated; omitted fields remain unchanged.
    Returns 404 if the equipment does not exist or does not belong to the user.
    """
    existing = db.execute(
        text("SELECT 1 FROM user_equipment WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)"),
        {"id": equipment_id, "uid": current_user["id"]},
    ).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Equipment not found")

    set_clauses = ["updated_at = NOW()"]
    params: dict = {"id": equipment_id, "uid": current_user["id"]}

    for field in ("start_date", "replacement_days", "mask_category", "brand", "model", "notes"):
        val = getattr(body, field)
        if val is not None:
            set_clauses.append(f"{field} = :{field}")
            params[field] = val

    row = (
        db.execute(
            text(f"""
            UPDATE user_equipment
            SET {", ".join(set_clauses)}
            WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)
            RETURNING id::text AS id, equipment_type, start_date, replacement_days,
                      mask_category, brand, model, notes, created_at, updated_at
        """),
            params,
        )
        .mappings()
        .first()
    )
    db.commit()
    return _row_to_response(dict(row), date.today())


@router.delete("/{equipment_id}", status_code=204, operation_id="delete_equipment")
def delete_equipment(
    equipment_id: str,
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a CPAP equipment/accessory record.

    Returns 204 on success, 404 if the equipment does not exist or does not belong to the user.
    """
    result = db.execute(
        text("DELETE FROM user_equipment WHERE id = CAST(:id AS uuid) AND user_id = CAST(:uid AS uuid)"),
        {"id": equipment_id, "uid": current_user["id"]},
    )
    db.commit()
    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Equipment not found")


@router.get("/inferred", response_model=InferredEquipment, operation_id="get_inferred_equipment")
def get_inferred_equipment(
    ref_date: date = Query(default=None, description="Date to infer active equipment for (defaults to today)"),
    current_user: dict = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Get the most recently started equipment of each type active as of ref_date.

    Returns one item per equipment type (cushion, headgear, tubing, humidifier_chamber, filter),
    or None for types with no equipment started before ref_date.
    """
    if ref_date is None:
        ref_date = date.today()

    result: dict = {"cushion": None, "headgear": None, "tubing": None, "humidifier_chamber": None, "filter": None}

    for eq_type in result:
        row = (
            db.execute(
                text("""
                SELECT id::text AS id, equipment_type, start_date, replacement_days,
                       mask_category, brand, model, notes, created_at, updated_at
                FROM user_equipment
                WHERE user_id = CAST(:uid AS uuid)
                  AND equipment_type = :equipment_type
                  AND start_date <= :ref_date
                ORDER BY start_date DESC
                LIMIT 1
            """),
                {"uid": current_user["id"], "equipment_type": eq_type, "ref_date": ref_date},
            )
            .mappings()
            .first()
        )
        if row:
            result[eq_type] = _row_to_response(dict(row), ref_date)

    return InferredEquipment(**result)
