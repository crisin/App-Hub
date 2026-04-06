#!/usr/bin/env python3
"""
Scans the KMP project structure and regenerates the dynamic sections of CLAUDE.md.

Preserves hand-written sections (architecture docs, conventions, common tasks) while
updating machine-scannable sections (module layout, dependencies, expect/actual table,
known files). Run this after structural changes: new modules, dependency bumps, new
platform capabilities, or source set changes.

Usage:
    python3 scripts/update-claude-md.py          # preview diff to stdout
    python3 scripts/update-claude-md.py --write  # overwrite CLAUDE.md in place
"""

import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CLAUDE_MD = ROOT / "CLAUDE.md"


def scan_version_catalog():
    """Parse libs.versions.toml for key dependency versions."""
    toml_path = ROOT / "gradle" / "libs.versions.toml"
    if not toml_path.exists():
        return {}
    versions = {}
    in_versions = False
    for line in toml_path.read_text().splitlines():
        stripped = line.strip()
        if stripped == "[versions]":
            in_versions = True
            continue
        if stripped.startswith("[") and in_versions:
            break
        if in_versions and "=" in stripped and not stripped.startswith("#"):
            key, val = stripped.split("=", 1)
            key = key.strip()
            val = val.strip().strip('"')
            versions[key] = val
    return versions


def scan_expect_actuals():
    """Find all expect class declarations and their actual implementations."""
    platform_dir = ROOT / "shared" / "src" / "commonMain" / "kotlin" / "com" / "example" / "kmpapp" / "platform"
    expects = []
    if not platform_dir.exists():
        return expects
    for f in sorted(platform_dir.glob("*.kt")):
        content = f.read_text()
        for match in re.finditer(r"expect\s+(?:class|object)\s+(\w+)", content):
            expects.append(match.group(1))
    return expects


def scan_actual_platforms(class_name):
    """For a given expect class, find which platforms have actuals."""
    platforms = {}
    platform_dirs = {
        "Android": "androidMain",
        "iOS": "iosMain",
        "Web": "jsMain",
    }
    for label, src_dir in platform_dirs.items():
        base = ROOT / "shared" / "src" / src_dir / "kotlin"
        if not base.exists():
            continue
        for kt_file in base.rglob("*.kt"):
            content = kt_file.read_text()
            if re.search(rf"actual\s+(?:class|object|typealias)\s+{class_name}\b", content):
                # Try to extract a brief description from the first meaningful line
                for line in content.splitlines():
                    if "import" in line or line.strip().startswith("package") or not line.strip():
                        continue
                    if class_name in line:
                        # Look for a comment above or inline hint
                        break
                platforms[label] = kt_file.name
                break
    return platforms


def scan_modules():
    """Find all Gradle modules from settings.gradle.kts."""
    settings = ROOT / "settings.gradle.kts"
    if not settings.exists():
        return []
    modules = []
    for line in settings.read_text().splitlines():
        match = re.search(r'include\("(:[^"]+)"\)', line)
        if match:
            modules.append(match.group(1))
    return modules


def scan_sq_tables():
    """Find SQLDelight table definitions."""
    tables = []
    for sq_file in (ROOT / "shared").rglob("*.sq"):
        content = sq_file.read_text()
        for match in re.finditer(r"CREATE TABLE\s+(\w+)", content):
            tables.append(match.group(1))
    return tables


def scan_routes():
    """Find Route sealed class members."""
    routes = []
    route_file = None
    for kt in (ROOT / "shared").rglob("Route.kt"):
        route_file = kt
        break
    if not route_file:
        return routes
    content = route_file.read_text()
    for match in re.finditer(r"(?:data\s+object|data\s+class)\s+(\w+)", content):
        routes.append(match.group(1))
    return routes


def scan_koin_modules():
    """Find Koin module names from KoinModules.kt."""
    modules = []
    for kt in (ROOT / "shared").rglob("KoinModules.kt"):
        content = kt.read_text()
        for match in re.finditer(r"val\s+(\w+Module)\s*=\s*module", content):
            modules.append(match.group(1))
        break
    return modules


def build_deps_table(versions):
    """Build the key dependencies markdown table."""
    key_deps = [
        ("Kotlin", "kotlin", "Language + compiler"),
        ("Compose Multiplatform", "compose-multiplatform", "Shared UI framework"),
        ("Ktor", "ktor", "HTTP client (all platforms)"),
        ("SQLDelight", "sqldelight", "Cross-platform database"),
        ("Koin", "koin", "Dependency injection"),
        ("kotlinx.coroutines", "coroutines", "Async/concurrency"),
        ("kotlinx.serialization", "serialization", "JSON serialization"),
        ("Napier", "napier", "Multiplatform logging"),
    ]
    lines = ["| Library | Version | Purpose |", "|---|---|---|"]
    for name, key, purpose in key_deps:
        ver = versions.get(key, "?")
        lines.append(f"| {name} | {ver} | {purpose} |")
    return "\n".join(lines)


def build_expect_actual_table(expects):
    """Build the expect/actual platform table."""
    lines = ["| Expect Class | Android | iOS | Web |", "|---|---|---|---|"]
    for cls in expects:
        actuals = scan_actual_platforms(cls)
        android = actuals.get("Android", "-")
        ios = actuals.get("iOS", "-")
        web = actuals.get("Web", "-")
        lines.append(f"| `{cls}` | {android} | {ios} | {web} |")
    return "\n".join(lines)


def update_section(content, marker_start, marker_end, new_content):
    """Replace content between two marker comments."""
    pattern = re.compile(
        rf"({re.escape(marker_start)}\n)(.*?)(\n{re.escape(marker_end)})",
        re.DOTALL,
    )
    if pattern.search(content):
        return pattern.sub(rf"\1{new_content}\3", content)
    return content


def main():
    write_mode = "--write" in sys.argv

    if not CLAUDE_MD.exists():
        print("CLAUDE.md not found. Run from project root.", file=sys.stderr)
        sys.exit(1)

    content = CLAUDE_MD.read_text()
    versions = scan_version_catalog()
    expects = scan_expect_actuals()
    modules = scan_modules()
    routes = scan_routes()
    koin_modules = scan_koin_modules()
    tables = scan_sq_tables()

    # Update dependency table
    new_deps = build_deps_table(versions)
    content = update_section(content, "<!-- DEPS:START -->", "<!-- DEPS:END -->", new_deps)

    # Update expect/actual table
    new_ea = build_expect_actual_table(expects)
    content = update_section(content, "<!-- EXPECT_ACTUAL:START -->", "<!-- EXPECT_ACTUAL:END -->", new_ea)

    # Update modules list
    if modules:
        mod_str = ", ".join(f"`{m}`" for m in modules)
        content = update_section(content, "<!-- MODULES:START -->", "<!-- MODULES:END -->", f"Gradle modules: {mod_str}")

    # Update routes
    if routes:
        route_str = ", ".join(routes)
        content = update_section(content, "<!-- ROUTES:START -->", "<!-- ROUTES:END -->", f"Routes: {route_str}")

    # Update Koin modules
    if koin_modules:
        koin_str = ", ".join(f"`{m}`" for m in koin_modules)
        content = update_section(content, "<!-- KOIN:START -->", "<!-- KOIN:END -->", f"Koin modules: {koin_str}")

    # Update SQLDelight tables
    if tables:
        table_str = ", ".join(f"`{t}`" for t in tables)
        content = update_section(content, "<!-- TABLES:START -->", "<!-- TABLES:END -->", f"Tables: {table_str}")

    if write_mode:
        CLAUDE_MD.write_text(content)
        print("CLAUDE.md updated.")
    else:
        print(content)
        print("\n--- Run with --write to save changes ---", file=sys.stderr)


if __name__ == "__main__":
    main()
