#!/bin/bash
cd "$(dirname "$0")"
zip -r osm-tactical-map.zip . -x@.zipignore
