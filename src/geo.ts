import { geoAlbersUsa, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import topology from "us-atlas/states-10m.json";

// Shared by the story maps and the explorer: one projection, one 960×620 frame.
export const topologyStates = feature(
  topology as never,
  topology.objects.states as never,
) as unknown as GeoJSON.FeatureCollection;
export const projection = geoAlbersUsa().scale(870).translate([480, 305]);
export const path = geoPath(projection);
