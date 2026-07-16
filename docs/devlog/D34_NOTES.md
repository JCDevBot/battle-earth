# D34 Notes — Island Helper Overlay Cleanup

## Goal
Remove visible island helper/land overlay meshes that appeared as pale green plates inside ponds after the broad OSM ingestion cleanup.

## Changes
- OSM water inner-ring islands are still registered as island land for water exclusion and island vegetation logic.
- OSM inner-ring island helper land meshes are no longer rendered as separate terrain plates.
- The base terrain should now show through the water polygon hole instead of a separate pale island overlay sitting on top of the water.

## Expected Result
- Islands remain visible as normal terrain through water holes.
- Islands no longer toggle or read as a separate overlay layer.
- Island vegetation/water exclusion support remains available.
