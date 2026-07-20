# Replica Neighborhood Battle Vertical Slice

## Product promise

Battle Earth lets a player choose a real location on Earth, generate a battlefield that closely replicates what is actually there, view it as a highly stylized miniature model world, place player-owned headquarters and forces into the environment, fight at tactical scale, and then return to a broader Earth view where resources and consequences persist.

The defining standard is:

> Stylize the appearance, not the arrangement.

The rendering may use the readable proportions, materials, palette, lighting, animation, and miniature presentation associated with city-building and base-building games. At neighborhood and tactical scales, however, source-backed geography must retain its real location, footprint, orientation, spacing, and tactical relationships.

## Why this slice exists

The current prototype proves that Battle Earth can move from location selection into a generated tactical environment and support basic squad commands. The next slice must prove the distinctive product idea rather than expand broad campaign mechanics.

The Replica Neighborhood Battle slice validates one connected experience:

1. the selected place is recognizable
2. the generated battlefield is visually cohesive
3. a persistent player HQ can be placed against the real environment
4. troops can fight one complete objective battle using that environment
5. the result survives a return to the macro view

## Core principles

### One persistent Earth

The globe, strategic, regional, neighborhood, and tactical presentations represent the same world state at different levels of detail. A tactical battle is the highest-detail representation of a location, not an unrelated map.

### Replica-first local geography

At neighborhood and tactical scales, preserve real spatial relationships as closely as available data permits. Players familiar with a location should recognize it and be able to use their knowledge of its roads, buildings, trees, alleys, driveways, slopes, water, and obstacles.

### Stylize presentation, not spatial truth

Allowed stylization includes materials, color themes, lighting, simplified mesh detail, animation, effects, and slight readability exaggeration. Stylization must not casually move, reshape, add, or remove source-backed geographic features.

### Player-directed autonomy

The player allocates resources and gives tactical intent. Units should execute routine movement and combat behavior without requiring control of every soldier, while still allowing local intervention.

### Scale-aware simulation

At broad scales, resources are represented as aggregates, formations, facilities, routes, and status. At tactical scale, those records resolve into detailed units, structures, and combat state.

### Persistent consequences

Force strength, casualties, resource use, HQ condition, objective state, and battle outcome survive the macro/micro round trip.

## Required player journey

### Stage 1: Earth view

**Input**

- deterministic development profile
- public benchmark location
- no active battle session, or a reset test session

**Player action**

- select the benchmark neighborhood location
- choose the Replica Neighborhood Battle entry

**Output**

- geographic context containing latitude, longitude, hierarchy, selected area, and requested tactical footprint
- a new deterministic `BattleSession`

### Stage 2: Battlefield generation

**Input**

- geographic context
- playable width and depth
- larger rendered-context width and depth
- deterministic seed
- Replica Mode source policy

**System behavior**

- load or resolve terrain and map-source features
- preserve source-backed geometry
- classify every generated feature by fidelity class and provenance
- render environmental context beyond the playable boundary
- identify valid HQ staging candidates

**Output**

- generated replica battlefield
- fidelity report
- HQ candidate list
- explicit playable and rendered-context bounds

### Stage 3: HQ placement

**Input**

- fixed development-profile HQ
- staging candidates
- terrain, road access, obstacles, water, slope, and battlefield-entry constraints

**Player action**

- accept the recommended position or choose another valid candidate

**Output**

- snapped and oriented HQ in the rendered context area
- connected battlefield entry route
- rejected-placement reasons for invalid positions

### Stage 4: Force deployment

**Input**

- fixed profile force package
- two friendly squads
- deployment capacity and entry route

**Player action**

- deploy the force through the HQ connection

**Output**

- friendly units inside the playable bounds
- profile resources marked as committed to the battle

### Stage 5: Objective battle

**Input**

- one recognizable source-backed objective
- two friendly squads
- a small deterministic enemy force
- current tactical commands and combat systems

**Player action**

- move, defend, suppress, hold, or retreat
- capture the objective and hold it against opposition

**Output**

- clear victory or defeat
- casualties and remaining force strength
- resource expenditure
- objective and HQ state

### Stage 6: Macro return and persistence

**Input**

- completed tactical outcome

**System behavior**

- summarize tactical state into the persistent session
- return to Earth or regional representation
- display the battle marker and result

**Output**

- retained outcome, casualties, remaining force strength, resource changes, HQ state, and session state
- restored state after browser reload

## Fidelity contract

Every visible geographic feature should carry a fidelity classification, source identifier, and confidence where applicable.

### Class A: source-exact

Examples:

- building footprints and orientation
- explicit building height or level count
- roads, alleys, paths, rail, waterways, shorelines, bridges, barriers, and other explicit geometry
- explicit tree locations
- explicit infrastructure

Rules:

- preserve source geometry and placement
- do not replace it with a generic footprint
- do not relocate it for visual composition
- document any correction made because source geometry is invalid
- source-exact features take priority over all inferred or procedural content

### Class B: high-confidence derived

Examples:

- height derived from `building:levels`
- canopy-derived vegetation placement
- terrain grade derived from elevation data
- driveway or access alignment derived from visible geometry

Rules:

- generation must be deterministic for the same source data and seed
- record the derivation method and source
- derived features may fill missing attributes but may not displace Class A features
- confidence must be sufficient for tactical use

### Class C: low-confidence inferred

Examples:

- roof family without explicit roof tags
- façade family based on use or regional context
- inferred vegetation where no exact tree or canopy position exists
- minor lot detail inferred from land use

Rules:

- use only where necessary for visual completeness
- identify the result as inferred
- keep placement conservative
- do not invent features that materially alter cover, movement, line of sight, or access without explicit gameplay approval
- do not displace known features

### Class D: procedural fallback

Procedural content is allowed when source data is unavailable, invalid, or when Simulation Mode is explicitly selected.

Replica Mode rules:

- minimize procedural invention
- report each procedural category and affected area
- never represent procedural content as source-exact
- avoid procedural buildings in a source-backed neighborhood
- prefer visual emptiness or low-impact ground treatment over tactically misleading invention when confidence is too low

## Source priority

When sources conflict, use this default priority:

1. explicit validated vector geometry and attributes
2. exact point features
3. high-resolution elevation or canopy-derived placement
4. high-confidence geometric derivation
5. low-confidence contextual inference
6. procedural fallback
7. manual benchmark override, when documented as a correction rather than hidden source data

Manual overrides are permitted for deterministic benchmark validation. They must identify the corrected feature, previous source, reason, and replacement value.

## Inference rules

- Generation must be deterministic.
- Inference must not overwrite a known source attribute.
- Inferred objects must avoid source-backed collision areas.
- Inferred vegetation must not block a known road, alley, driveway, entrance, or structure.
- Inferred building visuals must retain the source footprint, orientation, and known height.
- Readability scaling must not materially change cover, traversal distance, line of sight, or spacing.
- Missing data must remain visible in the fidelity report.

## Replica Mode failure conditions

The slice fails fidelity review when any critical condition occurs:

- a source-backed building is absent, moved, or uses a materially different footprint
- a source-backed road, alley, path, bridge, shoreline, or water feature is missing or materially misaligned
- known terrain form or meaningful grade is flattened or fabricated
- an explicit tree or tactical obstacle is missing or relocated
- procedural content blocks a real route or replaces a real feature
- the default view exposes a blank rectangular map edge
- a tester familiar with the human-known fixture cannot recognize the location or use expected local knowledge
- provenance cannot distinguish exact, derived, inferred, and procedural content

Noncritical visual differences such as exact façade texture, roof color, tree species, or decorative props may remain when source data does not provide them, provided the uncertainty is reported and tactical relationships remain correct.

## What may be stylized

- materials and color palette
- lighting, shadows, atmosphere, and water appearance
- simplified mesh detail
- tree, vehicle, unit, and HQ model language
- roof and façade treatment when attributes are unavailable
- effects, damage presentation, overlays, and UI
- animation and construction/deployment feedback
- slight scale exaggeration used only for recognition and selection

## What may not be casually stylized

- geographic location
- source-backed building footprint, orientation, or known height
- road, alley, path, driveway, shoreline, rail, or bridge alignment
- meaningful terrain form and grade
- known tree and obstacle locations
- relative spacing and tactical relationships
- source-backed access to buildings or lots

## Benchmark strategy

### Public deterministic fixture

Use **St. Paul / Harriet Island** as the initial public fixture because it exercises water edges, roads, parks, buildings, vegetation, terrain, and contextual map boundaries. The fixture must use a fixed location, footprint, source snapshot or deterministic fallback, seed, viewport, and scenario identifier.

It supports:

- CI browser flows
- screenshot comparison
- map-edge validation
- water and shoreline validation
- deterministic generation and performance measurement

The committed fixture must not depend on a live service response changing between test runs.

### Human-known fidelity fixture

Use a private neighborhood known closely by at least one tester. The exact location does not need to be committed publicly.

Before evaluation, create at least 25 written recognition checks across:

- building presence and footprint
- building level count
- road and alley alignment
- driveways and parking access
- major tree locations
- slopes, hills, embankments, or depressions
- water or drainage features
- paths, fences, walls, or barriers
- recognizable landmarks
- tactically significant sight lines and routes

Record each check as pass, partial, fail, or unavailable-data. Critical failures must be corrected or explicitly accepted before the slice is complete.

## Slice scope

Included:

- one deterministic `BattleSession`
- one public benchmark fixture
- one private human-known fixture checklist
- separate playable and rendered-context bounds
- Replica Mode fidelity and provenance reporting
- one fixed development player profile
- one HQ model and snap-placement flow
- two friendly squads and a small enemy force
- one capture-and-hold battle
- one macro/micro persistence round trip
- one development Test Lab launcher
- automated and human validation

## Non-goals

- full global autonomous war simulation
- networked multiplayer
- complete campaign economy
- purchases or monetization
- every military era
- full vehicle or aircraft roster
- direct control of individual soldiers
- exact worldwide tree or building detail where no source exists
- full graphical map-correction editor
- strategic renderer replacement
- broad combat-rule redesign

## Ordered delivery plan

1. Define and test the `BattleSession` contract.
2. Add the vertical-slice Test Lab launcher using the normal session and routing contracts.
3. Separate playable bounds from rendered context bounds and eliminate visible map edges.
4. Add Replica Mode source classification, provenance, confidence, and fidelity reporting.
5. Apply the miniature visual treatment without changing source geometry.
6. Import the development-profile HQ and implement valid snap placement.
7. Complete one deterministic capture-and-hold battle.
8. Persist tactical results into the macro representation and restore them after reload.
9. Add automated browser, screenshot, performance, and human fidelity validation.

Large refactors should be taken only where needed to deliver these steps safely. Map-builder and infantry decomposition remain enabling work and should be completed incrementally around product-facing slices rather than as unbounded rewrites.

## Slice-level definition of done

### Replica fidelity

- every source-backed building footprint in the public fixture is represented
- every source-backed road, alley, path, water feature, bridge, and explicit tree is represented
- explicit building level or height data is honored
- source geometry is not replaced by a generic geometry with a materially different footprint
- inferred and procedural features are deterministic and identifiable
- every rendered feature can report fidelity class and source/provenance
- the human-known fixture has at least 25 written checks and no unresolved critical failure
- a tester familiar with the location considers it recognizable and strategically usable

### Presentation

- the battlefield reads as one cohesive miniature model world
- buildings, vegetation, roads, terrain, water, HQ, and units share an intentional visual language
- no blank rectangular edge is visible from supported tactical cameras
- normal play does not expose development overlays
- source footprints and tactical spacing remain unchanged by the visual treatment

### HQ placement

- the HQ imports from a deterministic profile snapshot
- the system recommends at least one valid staging position
- invalid water, obstacle, building, slope, and disconnected placements are rejected with a reason
- the HQ snaps and orients coherently
- a connected route permits troop deployment into the playable area

### Battle completion

- two friendly squads deploy from the HQ connection
- a small deterministic enemy force enters or defends the objective
- the player can use the supported tactical commands
- units navigate around source-backed obstacles
- the objective can be captured and held
- the battle reaches a clear victory or defeat state
- casualties, remaining strength, and resource expenditure are recorded

### Macro/micro persistence

- the journey starts from Earth view
- the completed battle returns to Earth or a defined regional representation
- the location displays outcome and remaining force state
- HQ and session state persist
- browser reload restores the completed state

### Test flow

- the Test Lab reaches the benchmark tactical battle in one click
- the full Earth-to-battle journey can be launched in one click
- direct-launch scenarios use normal session, routing, generation, and persistence contracts
- scenarios have stable URLs and deterministic configuration

### Performance and reliability

Initial budgets for the reference development laptop:

- cold benchmark generation completes within 90 seconds
- cached benchmark generation completes within 15 seconds
- median tactical frame rate is at least 30 FPS at the standard camera and viewport
- rendered context increases generation time and peak memory by no more than 25 percent unless evidence supports a documented exception
- no uncaught browser errors occur during the complete journey
- deterministic unit tests, browser smoke tests, and screenshot artifacts pass
- `npm run check` passes

Performance budgets may be revised only with captured measurements and a documented reason.

## Completion evidence

The vertical slice is complete only when the repository contains:

- this approved charter
- stable fixture and scenario definitions
- automated check results
- before-and-after visual artifacts
- benchmark generation and frame-rate measurements
- the private human-known fidelity checklist summary
- exact local playtest instructions
- a recorded sign-off that the complete journey is recognizable, playable, persistent, and free of blocking errors
