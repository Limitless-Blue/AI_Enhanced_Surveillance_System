"""
Phase 2 — Standalone AI Pipeline Test
======================================
No server, no database. Pure AI verification.

Usage
-----
Enroll from a folder of subfolders (one subfolder = one person):

    python scripts/test_pipeline.py enroll --dir test_faces/enroll

    test_faces/enroll/
        John_Doe/
            photo1.jpg
            photo2.jpg
        Jane_Smith/
            photo1.jpg

Then query a single image:

    python scripts/test_pipeline.py query --image test_faces/query.jpg

Or run a self-contained demo (enrolls + queries in one go):

    python scripts/test_pipeline.py demo --dir test_faces/enroll --query test_faces/query.jpg

The matcher state is saved to scripts/.matcher_state.json between commands.
"""

import sys
import os
import json
import argparse
import time
from pathlib import Path

# Make sure we can import app modules from backend/
sys.path.insert(0, str(Path(__file__).parent.parent))

import cv2
import numpy as np

from app.utils.logging import setup_logging
setup_logging()

import structlog
log = structlog.get_logger()

STATE_FILE = Path(__file__).parent / ".matcher_state.json"
SUPPORTED = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}


# ── helpers ──────────────────────────────────────────────────────────────────

def load_state() -> list[dict]:
    if STATE_FILE.exists():
        with open(STATE_FILE) as f:
            return json.load(f)
    return []


def save_state(persons: list[dict]) -> None:
    with open(STATE_FILE, "w") as f:
        json.dump(persons, f, indent=2)


def build_pipeline(persons: list[dict]):
    from app.ai.embedder import FaceEmbedder
    from app.ai.matcher import FaceMatcher
    from app.ai.pipeline import AIPipeline

    embedder = FaceEmbedder()
    matcher = FaceMatcher()
    matcher.load(persons)
    pipeline = AIPipeline(embedder, matcher)
    return embedder, matcher, pipeline


# ── commands ─────────────────────────────────────────────────────────────────

def cmd_enroll(args):
    enroll_dir = Path(args.dir)
    if not enroll_dir.is_dir():
        print(f"[ERROR] Not a directory: {enroll_dir}")
        sys.exit(1)

    persons = load_state()
    existing_names = {p["name"] for p in persons}

    from app.ai.embedder import FaceEmbedder
    from app.ai.quality import is_quality_face, quality_reason
    embedder = FaceEmbedder()

    enrolled = 0
    skipped = 0

    for person_dir in sorted(enroll_dir.iterdir()):
        if not person_dir.is_dir():
            continue

        name = person_dir.name.replace("_", " ")

        if name in existing_names:
            print(f"  [skip]  {name} — already enrolled")
            skipped += 1
            continue

        image_files = [f for f in sorted(person_dir.iterdir()) if f.suffix.lower() in SUPPORTED]
        if not image_files:
            print(f"  [skip]  {name} — no images found")
            skipped += 1
            continue

        embeddings = []
        for img_path in image_files:
            img = cv2.imread(str(img_path))
            if img is None:
                print(f"    [warn] Cannot read {img_path.name}")
                continue

            faces = embedder.get_faces(img)
            if not faces:
                print(f"    [warn] No face detected in {img_path.name}")
                continue

            quality_faces = [f for f in faces if is_quality_face(f, img)]
            if not quality_faces:
                reasons = [quality_reason(f, img) for f in faces]
                print(f"    [warn] Face rejected in {img_path.name}: {reasons}")
                continue

            largest = max(quality_faces, key=lambda f: (f.bbox[2]-f.bbox[0]) * (f.bbox[3]-f.bbox[1]))
            embeddings.append(largest.embedding)
            print(f"    [ok]   {img_path.name}")

        if not embeddings:
            print(f"  [fail]  {name} — no usable face found in any image")
            skipped += 1
            continue

        # Average across multiple enrollment images → more robust identity
        avg_emb = np.mean(embeddings, axis=0).astype(np.float32)
        avg_emb /= np.linalg.norm(avg_emb)   # re-normalise after averaging

        persons.append({
            "name": name,
            "embedding": avg_emb.tolist(),
            "num_images": len(embeddings),
        })
        existing_names.add(name)
        print(f"  [enrolled] {name}  ({len(embeddings)} image(s))")
        enrolled += 1

    save_state(persons)
    print(f"\nDone. Enrolled: {enrolled}  Skipped: {skipped}  Total in DB: {len(persons)}")


def cmd_query(args):
    persons = load_state()
    if not persons:
        print("[ERROR] No persons enrolled yet. Run: python scripts/test_pipeline.py enroll --dir <path>")
        sys.exit(1)

    query_path = Path(args.image)
    if not query_path.exists():
        print(f"[ERROR] Image not found: {query_path}")
        sys.exit(1)

    _, matcher, pipeline = build_pipeline(persons)

    img = cv2.imread(str(query_path))
    if img is None:
        print(f"[ERROR] Cannot read image: {query_path}")
        sys.exit(1)

    print(f"\nQuerying: {query_path.name}")
    print(f"Enrolled persons: {matcher.size}")
    print("-" * 50)

    t0 = time.perf_counter()
    result = pipeline.run(img)
    elapsed_ms = (time.perf_counter() - t0) * 1000

    print(f"Faces detected  : {result.faces_detected}")
    print(f"Passed quality  : {result.faces_passed_quality}")
    print(f"Inference time  : {elapsed_ms:.1f} ms")
    print()

    if not result.matches:
        print("Result          : NO MATCH")
    else:
        for m in result.matches:
            bar = "█" * int(m.score * 40)
            print(f"  MATCH  [{m.confidence}]")
            print(f"  Name   : {m.person_name}")
            print(f"  Score  : {m.score:.4f}  {bar}")
            print(f"  BBox   : {m.bbox}")
            print()


def cmd_demo(args):
    """Enroll + query in a single command."""
    # Patch args for enroll
    enroll_args = argparse.Namespace(dir=args.dir)
    cmd_enroll(enroll_args)

    print("\n" + "=" * 50)

    query_args = argparse.Namespace(image=args.query)
    cmd_query(query_args)


def cmd_list(_args):
    persons = load_state()
    if not persons:
        print("No persons enrolled.")
        return
    print(f"{'Name':<30} {'Images'}")
    print("-" * 40)
    for p in persons:
        print(f"{p['name']:<30} {p.get('num_images', 1)}")
    print(f"\nTotal: {len(persons)}")


def cmd_clear(_args):
    if STATE_FILE.exists():
        STATE_FILE.unlink()
    print("Cleared all enrolled persons.")


# ── main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="AI pipeline test — enroll faces and run matching",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_enroll = sub.add_parser("enroll", help="Enroll persons from a folder of subfolders")
    p_enroll.add_argument("--dir", required=True, help="Path to folder with per-person subfolders")

    p_query = sub.add_parser("query", help="Match a query image against enrolled persons")
    p_query.add_argument("--image", required=True, help="Path to query image")

    p_demo = sub.add_parser("demo", help="Enroll + query in one step")
    p_demo.add_argument("--dir", required=True, help="Enroll folder")
    p_demo.add_argument("--query", required=True, help="Query image")

    sub.add_parser("list", help="List enrolled persons")
    sub.add_parser("clear", help="Clear all enrolled persons")

    args = parser.parse_args()

    commands = {
        "enroll": cmd_enroll,
        "query": cmd_query,
        "demo": cmd_demo,
        "list": cmd_list,
        "clear": cmd_clear,
    }
    commands[args.cmd](args)


if __name__ == "__main__":
    main()
