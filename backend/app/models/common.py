from bson import ObjectId


def doc(d: dict | None) -> dict | None:
    """Convert a MongoDB document to a JSON-serialisable dict (ObjectId → str)."""
    if d is None:
        return None
    result = dict(d)
    if "_id" in result:
        result["id"] = str(result.pop("_id"))
    for k, v in result.items():
        if isinstance(v, ObjectId):
            result[k] = str(v)
    return result


def docs(cursor) -> list[dict]:
    return [doc(d) for d in cursor]
