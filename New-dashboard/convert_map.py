#!/usr/bin/env python3
"""
convert_map.py
Converts Veins/SUMO erlangen.net.xml + erlangen.poly.xml to GeoJSON
for use in the IoV Digital Twin dashboard.

Usage:
    python convert_map.py \
        --net erlangen.net.xml \
        --poly erlangen.poly.xml \
        --out map.geojson

Output: map.geojson  (place next to index.html / serve statically)

Requirements:
    pip install sumolib
"""

import argparse
import json
import sys

try:
    import sumolib
except ImportError:
    print("ERROR: sumolib not found.  Run:  pip install sumolib")
    sys.exit(1)


def convert(net_path: str, poly_path: str | None, out_path: str) -> None:
    print(f"Reading network: {net_path}")
    net = sumolib.net.readNet(net_path, withInternal=False)

    features = []

    # ── Roads (edges) ──────────────────────────────────────────────────────────
    for edge in net.getEdges():
        shape = edge.getShape()
        if len(shape) < 2:
            continue
        coords = [list(net.convertXY2LonLat(x, y)) for x, y in shape]
        features.append({
            "type": "Feature",
            "geometry": {"type": "LineString", "coordinates": coords},
            "properties": {
                "kind":     "road",
                "id":       edge.getID(),
                "speed":    round(edge.getSpeed() * 3.6, 1),   # m/s → km/h
                "lanes":    edge.getLaneNumber(),
                "priority": edge.getPriority(),
            }
        })

    # ── Junctions (nodes) ──────────────────────────────────────────────────────
    for junction in net.getNodes():
        x, y = junction.getCoord()
        lon, lat = net.convertXY2LonLat(x, y)
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "kind": "junction",
                "id":   junction.getID(),
                "type": junction.getType(),
            }
        })

    # ── Polygons / buildings (poly.xml) ───────────────────────────────────────
    if poly_path:
        print(f"Reading polygons: {poly_path}")
        try:
            import xml.etree.ElementTree as ET
            tree = ET.parse(poly_path)
            root = tree.getroot()
            for poly in root.iter("poly"):
                shape_str = poly.get("shape", "")
                if not shape_str:
                    continue
                raw = [tuple(map(float, pt.split(",")))
                       for pt in shape_str.strip().split()]
                coords = [list(net.convertXY2LonLat(x, y)) for x, y in raw]
                if coords and coords[0] != coords[-1]:
                    coords.append(coords[0])          # close the ring
                poly_type = poly.get("type", "unknown")
                features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [coords]
                    },
                    "properties": {
                        "kind":     "polygon",
                        "id":       poly.get("id", ""),
                        "poly_type": poly_type,
                        "color":    poly.get("color", ""),
                    }
                })
        except Exception as e:
            print(f"  Warning: could not parse poly file: {e}")

    # ── Bounding box (used by dashboard to set initial map view) ───────────────
    boundary = net.getBoundary()                       # (xmin,ymin,xmax,ymax) in SUMO coords
    lon_min, lat_min = net.convertXY2LonLat(boundary[0], boundary[1])
    lon_max, lat_max = net.convertXY2LonLat(boundary[2], boundary[3])
    center_lon = (lon_min + lon_max) / 2
    center_lat = (lat_min + lat_max) / 2

    # ── Also export the SUMO offset so the dashboard can convert Redis X/Y live ─
    offset = net.getLocationOffset()       # (x_offset, y_offset)
    proj_params = None   # proj4 string or None

    geojson = {
        "type": "FeatureCollection",
        "metadata": {
            "center":      [center_lat, center_lon],
            "bbox":        [lat_min, lon_min, lat_max, lon_max],
            "sumo_boundary": [boundary[0], boundary[1], boundary[2], boundary[3]],
            "sumo_offset": list(offset),
            "proj":        proj_params,
            "edge_count":  sum(1 for f in features if f["properties"].get("kind") == "road"),
            "poly_count":  sum(1 for f in features if f["properties"].get("kind") == "polygon"),
        },
        "features": features,
    }

    with open(out_path, "w") as fh:
        json.dump(geojson, fh, separators=(",", ":"))

    print(f"\nDone.")
    print(f"  Roads:     {geojson['metadata']['edge_count']}")
    print(f"  Polygons:  {geojson['metadata']['poly_count']}")
    print(f"  Center:    {center_lat:.6f}, {center_lon:.6f}")
    print(f"  Output:    {out_path}")
    print(f"\nPlace {out_path} in the same folder as index.html and run the dashboard.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert SUMO map to GeoJSON for IoV dashboard")
    parser.add_argument("--net",  required=True,  help="Path to erlangen.net.xml")
    parser.add_argument("--poly", required=False, default=None, help="Path to erlangen.poly.xml (optional)")
    parser.add_argument("--out",  required=False, default="map.geojson", help="Output GeoJSON path")
    args = parser.parse_args()
    convert(args.net, args.poly, args.out)
