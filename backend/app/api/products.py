from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field
from app.core.security import get_current_user, require_staff, require_admin
from app.services.supabase_client import get_supabase, signed_url

router = APIRouter(prefix="/api/products", tags=["products"])


class ProductIn(BaseModel):
    product_code: str = Field(min_length=1, max_length=64)
    name: str = Field(min_length=1, max_length=200)
    category: str | None = None
    description: str | None = None
    manufacturing_date: str | None = None


@router.get("")
def list_products(_=Depends(get_current_user)):
    rows = get_supabase().table("products").select("*").order("created_at", desc=True).execute().data
    for r in rows:
        r["image_signed"] = signed_url("product-images", r.get("image_url")) if r.get("image_url") else None
    return rows


@router.post("", status_code=201)
def create(p: ProductIn, _=Depends(require_staff)):
    return get_supabase().table("products").insert(p.model_dump(exclude_none=True)).execute().data[0]


@router.put("/{pid}")
def update(pid: str, p: ProductIn, _=Depends(require_staff)):
    r = get_supabase().table("products").update(p.model_dump(exclude_none=True)).eq("id", pid).execute()
    if not r.data:
        raise HTTPException(404, "Product not found")
    return r.data[0]


@router.delete("/{pid}", status_code=204)
def delete(pid: str, _=Depends(require_admin)):
    get_supabase().table("products").delete().eq("id", pid).execute()


@router.get("/{pid}/inspections")
def product_inspections(pid: str, _=Depends(get_current_user)):
    return get_supabase().table("inspections").select("id,status,quality_score,defect_count,batch_number,created_at") \
        .eq("product_id", pid).order("created_at", desc=True).limit(100).execute().data


@router.post("/{pid}/image")
async def upload_image(pid: str, file: UploadFile = File(...), _=Depends(require_staff)):
    from app.api.inspection import read_validated, ALLOWED
    data = await read_validated(file)
    path = f"{pid}/image.{ALLOWED[file.content_type]}"
    sb = get_supabase()
    sb.storage.from_("product-images").upload(path, data, {"content-type": file.content_type, "upsert": "true"})
    sb.table("products").update({"image_url": path}).eq("id", pid).execute()
    return {"image_url": path, "image_signed": signed_url("product-images", path)}
