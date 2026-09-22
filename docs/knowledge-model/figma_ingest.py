"""Export scoped FigJam structure without copying board text or private sections.

Usage: python figma_ingest.py RAW_XML --board-key KEY --fetched-at YYYY-MM-DD
Only the explicitly approved foundation/advanced sections are exported. Coordinates
and connector attachments describe the board, not semantic or probabilistic rules.
"""
import argparse
from collections import Counter
from datetime import date, datetime
import hashlib
import json
import math
from pathlib import Path
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parent
ALLOWED_ROOTS = {"498:4143": "기초", "498:4142": "심화"}
SAFE_SECTION_NAMES = {
    **ALLOWED_ROOTS,
    "498:6058": "Section 1", "498:6059": "Section 2",
    "498:6060": "Section 3", "498:8467": "Section 4",
    "498:10742": "Section 5", "498:13013": "Section 6",
}
ARROW_CAPS = {"ARROW_LINES", "ARROW_EQUILATERAL"}


def text_fingerprint(element):
    """Hash direct element text, else a textual attribute; never descendants.

    Whitespace surrounding direct XML text is stripped; attribute text is exact.
    Figma TEXT content is carried in `name` in this metadata export. This is a
    fingerprint of the exported representation, not a claim of full content access.
    """
    direct = (element.text or "").strip()
    if direct:
        value, field = direct, "direct_text_stripped"
    else:
        field = next((key for key in ("characters", "text", "name")
                      if element.get(key) is not None), "absent")
        value = element.get(field, "")
    return {"text_sha256": hashlib.sha256(value.encode("utf-8")).hexdigest(),
            "text_length": len(value), "text_source_field": field}, value


def coordinates(element):
    result = {}
    for key in ("x", "y", "width", "height"):
        if element.get(key) is None:
            continue
        value = float(element.get(key))
        if not math.isfinite(value):
            raise ValueError(f"Non-finite coordinate on node {element.get('id')}")
        result[key] = int(value) if value.is_integer() else value
    return result


def visual_direction(start_cap, end_cap):
    """Arrowheads encode visual direction only; NONE is distinct from unknown."""
    known = ARROW_CAPS | {"NONE"}
    if start_cap not in known or end_cap not in known:
        return "unknown_cap", "unknown"
    start, end = start_cap in ARROW_CAPS, end_cap in ARROW_CAPS
    if start and end:
        return "both", "both"
    if end:
        return "end_only", "start_to_end"
    if start:
        return "start_only", "end_to_start"
    return "none", "no_arrowheads"


def ingest(raw, *, board_key, fetched_at, reviewed_connector_labels=None,
           connector_details_raw=None):
    if not board_key or not all(c.isalnum() or c in "_-" for c in board_key):
        raise ValueError("board_key must be a Figma file key")
    try:
        if "T" in fetched_at:
            datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
        else:
            date.fromisoformat(fetched_at)
    except (TypeError, ValueError):
        raise ValueError("fetched_at must be an ISO date or datetime") from None
    if b"<!DOCTYPE" in raw.upper() or b"<!ENTITY" in raw.upper():
        raise ValueError("DTD/entity declarations are not accepted")
    document = ET.fromstring(raw)
    all_elements, parents, ancestry = {}, {}, {}

    def visit(element, ancestors):
        node_id = element.get("id")
        if not node_id:
            raise ValueError("Every exported XML element must have an id")
        if node_id in all_elements:
            raise ValueError(f"Duplicate node id: {node_id}")
        all_elements[node_id] = element
        parents[node_id] = ancestors[-1] if ancestors else None
        ancestry[node_id] = list(ancestors)
        for child in element:
            visit(child, [*ancestors, node_id])

    visit(document, [])
    selected = {}
    scope_for = {}
    for node_id, element in all_elements.items():
        scopes = [root_id for root_id in ALLOWED_ROOTS
                  if root_id == node_id or root_id in ancestry[node_id]]
        if len(scopes) > 1:
            raise ValueError("Allowed scope roots must not be nested")
        if scopes:
            selected[node_id] = element
            scope_for[node_id] = scopes[0]
    if not selected:
        raise ValueError("No approved foundation/advanced section found")
    reviewed_connector_labels = reviewed_connector_labels or {}
    if not isinstance(reviewed_connector_labels, dict):
        raise ValueError("Reviewed labels must map connector IDs to exact short labels")
    for node_id in reviewed_connector_labels:
        if node_id not in selected or selected[node_id].tag != "connector":
            raise ValueError(f"Reviewed label is not an in-scope connector: {node_id}")

    details, details_source = {}, None
    if connector_details_raw is not None:
        extra = json.loads(connector_details_raw)
        if set(extra["scope_root_ids"]) != set(ALLOWED_ROOTS) & set(all_elements):
            raise ValueError("Connector API details and XML have different allowed scope roots")
        for item in extra["connectors"]:
            if item["id"] in details:
                raise ValueError("Duplicate connector ID in API details")
            details[item["id"]] = item
        xml_connector_ids = {node_id for node_id, el in selected.items() if el.tag == "connector"}
        if set(details) != xml_connector_ids:
            raise ValueError("Connector API details must match every in-scope XML connector ID exactly")
        for node_id, item in details.items():
            el = selected[node_id]
            if item["start_cap"] != el.get("connectorStartCap") or item["end_cap"] != el.get("connectorEndCap"):
                raise ValueError(f"Connector caps differ between API details and XML: {node_id}")
            if item["line_type"] not in {"STRAIGHT", "CURVED", "ELBOWED"}:
                raise ValueError(f"Unsupported connector line type: {node_id}")
            if not isinstance(item["label"], str):
                raise ValueError(f"Invalid connector label: {node_id}")
            _, xml_label = text_fingerprint(el)
            if xml_label and xml_label != item["label"]:
                raise ValueError(f"Connector labels differ between API details and XML: {node_id}")
            for role in ("start", "end"):
                attachment = item[role]
                if not isinstance(attachment, dict) or set(attachment) - {"endpointNodeId", "position", "magnet"}:
                    raise ValueError(f"Unsupported connector attachment fields: {node_id}")
                xml_endpoint = el.get("connector" + role.title())
                if attachment.get("endpointNodeId") != xml_endpoint:
                    raise ValueError(f"Connector endpoint differs between API details and XML: {node_id}")
                if "position" in attachment:
                    position = attachment["position"]
                    if (not isinstance(position, dict) or set(position) != {"x", "y"}
                            or any(type(v) not in (int, float) or not math.isfinite(v) for v in position.values())):
                        raise ValueError(f"Invalid attachment position: {node_id}")
                if "magnet" in attachment and attachment["magnet"] not in {"NONE", "AUTO", "CENTER", "TOP", "LEFT", "RIGHT", "BOTTOM"}:
                    raise ValueError(f"Unsupported attachment magnet: {node_id}")
        details_source = {"kind": "figma_plugin_api_connector_properties",
            "raw_sha256": hashlib.sha256(connector_details_raw).hexdigest(),
            "raw_bytes": len(connector_details_raw), "connector_count": len(details),
            "validation": "scope roots, complete ID set, endpoint IDs and caps match XML",
            "raw_content_included": False}

    def endpoint(node_id):
        exists = node_id in all_elements if node_id else False
        inside = node_id in selected if node_id else False
        status = ("absent" if not node_id else "missing_node" if not exists
                  else "inside_scope" if inside else "outside_scope")
        return {"node_id": node_id, "exists_in_input": exists,
                "inside_allowed_scope": inside, "status": status}

    nodes, connectors, tables = [], [], []
    fingerprints = {}
    for node_id, element in selected.items():
        fingerprint, value = text_fingerprint(element)
        fingerprints[node_id] = fingerprint
        record = {"id": node_id, "type": element.tag, "parent_id": parents[node_id],
                  "ancestor_ids": ancestry[node_id], "scope_root_id": scope_for[node_id],
                  "position": coordinates(element), **fingerprint}
        if node_id in SAFE_SECTION_NAMES and element.tag == "section":
            record["safe_section_name"] = SAFE_SECTION_NAMES[node_id]
        nodes.append(record)
        if element.tag != "connector":
            continue
        start, end = endpoint(element.get("connectorStart")), endpoint(element.get("connectorEnd"))
        api = details.get(node_id)
        if api is not None:
            for role, target in (("start", start), ("end", end)):
                target["attachment"] = {key: api[role][key] for key in ("position", "magnet") if key in api[role]}
            value = api["label"]
        start_cap, end_cap = element.get("connectorStartCap"), element.get("connectorEndCap")
        cap_class, direction = visual_direction(start_cap, end_cap)
        label = reviewed_connector_labels.get(node_id)
        if label is not None and (not isinstance(label, str) or not label or len(label) > 80
                                  or "\n" in label or "\r" in label or label != value):
            raise ValueError(f"Reviewed label must exactly match a nonempty <=80 character label: {node_id}")
        connectors.append({"id": node_id, "scope_root_id": scope_for[node_id],
            "start": start, "end": end, "start_cap": start_cap, "end_cap": end_cap,
            "cap_class": cap_class, "visual_arrow_direction": direction,
            "semantic_direction": "not_inferred", "label": label,
            "line_type": api["line_type"] if api is not None else None,
            "attachment_details_status": "api_verified_against_xml" if api is not None else "not_available",
            "label_status": "reviewed" if label is not None else "withheld_pending_review" if value else "absent",
            "label_sha256": hashlib.sha256(value.encode("utf-8")).hexdigest(), "label_length": len(value),
            "dangling": not start["exists_in_input"] or not end["exists_in_input"],
            "both_endpoints_inside_scope": start["inside_allowed_scope"] and end["inside_allowed_scope"],
            "attachment_self_loop": bool(start["node_id"]) and start["node_id"] == end["node_id"],
            "use_in_inference": False, "probability": None})

    for node_id, element in selected.items():
        if element.tag != "table":
            continue
        rows, columns = int(element.get("tableNumRows", "0")), int(element.get("tableNumColumns", "0"))
        if rows <= 0 or columns <= 0:
            raise ValueError(f"Invalid declared table dimensions: {node_id}")
        cells, occupied = [], set()
        for cell in element:
            if cell.tag != "table-cell":
                raise ValueError(f"Unexpected table child in {node_id}")
            row, column = int(cell.get("tableCellRowIndex")), int(cell.get("tableCellColumnIndex"))
            if not (0 <= row < rows and 0 <= column < columns):
                raise ValueError(f"Cell outside declared table dimensions: {cell.get('id')}")
            if (row, column) in occupied:
                raise ValueError(f"Duplicate table cell origin: {node_id}")
            occupied.add((row, column))
            cells.append({"id": cell.get("id"), "row": row, "column": column,
                          **fingerprints[cell.get("id")]})
        tables.append({"id": node_id, "scope_root_id": scope_for[node_id],
            "rows": rows, "columns": columns, "index_base": 0,
            "cells": sorted(cells, key=lambda c: (c["row"], c["column"])),
            "cell_origin_count": len(cells), "unrepresented_grid_origins": rows * columns - len(cells),
            "span_status": "not_provided; merged spans or missing cells are not reconstructed",
            "use_in_inference": False, "probability": None})

    counts = Counter(element.tag for element in selected.values())
    result = {
        "schema_version": "0.1",
        "source": {"kind": "figma_live_metadata_xml", "board_key": board_key,
            "canvas_id": document.get("id"), "fetched_at": fetched_at,
            "raw_sha256": hashlib.sha256(raw).hexdigest(), "raw_bytes": len(raw),
            "raw_content_included": False, "source_path_included": False},
        "connector_details_source": details_source,
        "scope": {"allowed_roots": ALLOWED_ROOTS,
            "missing_allowed_roots": sorted(set(ALLOWED_ROOTS) - set(all_elements)),
            "other_sections_excluded": True, "exported_text_policy": "hash/length only, except fixed safe section names and explicitly reviewed short connector labels",
            "coordinate_space": "parent-relative values as reported by metadata; not absolute canvas coordinates",
            "attachment_positions": "unmodified API position values tied to endpoint nodes; not converted to canvas coordinates",
            "self_loop_meaning": "same endpoint node attachment only; positions may differ, so this does not establish a semantic cycle",
            "id_comparison_policy": "ID changes alone do not establish semantic corpus changes"},
        "use_in_inference": False, "probability": None,
        "semantic_status": "structural_metadata_only; source claims and probabilities require separate review",
        "nodes": sorted(nodes, key=lambda n: n["id"]),
        "connectors": sorted(connectors, key=lambda c: c["id"]),
        "tables": sorted(tables, key=lambda t: t["id"]),
        "statistics": {"nodes": len(nodes), "node_types": dict(sorted(counts.items())),
            "connectors": len(connectors), "connectors_by_scope": dict(sorted(Counter(c["scope_root_id"] for c in connectors).items())),
            "dangling_connectors": sum(c["dangling"] for c in connectors),
            "connectors_with_both_endpoints_inside_scope": sum(c["both_endpoints_inside_scope"] for c in connectors),
            "attachment_self_loops": sum(c["attachment_self_loop"] for c in connectors),
            "visual_directions": dict(sorted(Counter(c["visual_arrow_direction"] for c in connectors).items())),
            "tables": len(tables), "table_cells": sum(len(t["cells"]) for t in tables)},
    }
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("raw_xml", type=Path, help="Local raw export; never copied to the output")
    parser.add_argument("--board-key", required=True)
    parser.add_argument("--fetched-at", required=True, help="ISO date/datetime supplied by the fetch step")
    parser.add_argument("--reviewed-connector-labels", type=Path,
                        help="Optional reviewed mapping of connector ID to its exact short label")
    parser.add_argument("--connector-details", type=Path,
                        help="Optional complete scoped connector properties from the Figma Plugin API")
    parser.add_argument("--output", type=Path, default=ROOT / "data" / "figma_live_structure.json")
    args = parser.parse_args()
    labels = json.loads(args.reviewed_connector_labels.read_text(encoding="utf-8")) if args.reviewed_connector_labels else None
    result = ingest(args.raw_xml.read_bytes(), board_key=args.board_key,
                    fetched_at=args.fetched_at, reviewed_connector_labels=labels,
                    connector_details_raw=args.connector_details.read_bytes() if args.connector_details else None)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(result["statistics"], ensure_ascii=False))


if __name__ == "__main__":
    main()
