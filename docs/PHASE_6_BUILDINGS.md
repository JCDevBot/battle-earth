# Phase 6 - Building Upgrade + Building Destruction

This phase upgrades buildings from simple extruded blocks into more readable tactical objects and adds building-specific destruction output.

## Added

- Building profile resolution from OSM tags and footprint area.
- More varied wall materials: brick, plaster, concrete, industrial, and glass/commercial.
- More varied roof materials: dark, tile, and metal.
- Basic roof-shape handling:
  - flat roofs
  - gable/hip-style roof hints for small residential buildings
  - sawtooth hints for some industrial buildings
- Rooftop detail placeholders such as HVAC/service units.
- Building-specific destruction rubble:
  - collapsed debris chunks
  - dark dust/rubble base
  - exposed beam placeholders
- Recursive destructible registration so grouped roofs/details receive hit IDs.

## Testing

1. Run `npm install` if needed.
2. Run `npm run dev`.
3. Generate a map with buildings.
4. Select grenade, shell, or airstrike in the destruction sandbox.
5. Hit buildings and confirm:
   - damage state changes are logged
   - roofs/details tint with damage
   - destroyed buildings collapse visually and spawn rubble
   - roads, water, and vegetation still render normally

## Known limitations

- Building destruction is still state-based, not physically fractured.
- Roof shapes are placeholders, not full procedural roof modeling.
- Facade/window detail is still material-driven; mesh window props are not generated yet.
