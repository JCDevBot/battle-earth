# Phase 11A — Detection & Contact

Adds the first combat loop for infantry squads:

- contact detection with range, cover, suppression, and confidence
- contact reports with bearing/range/confidence
- contact/searching/engaged/suppressed/retreating squad states
- automatic dig-in and cover seeking on contact
- return-fire firefights using probability-based combat
- suppression, wounded, casualties, morale, and combat-ineffective events
- expanded infantry debug stats

Test loop:
1. Spawn a friendly squad and an enemy squad.
2. Select the friendly squad.
3. Right-click to secure an area toward/near the enemy.
4. Watch logs for CONTACT reports.
5. Watch squad state change to contact/engaged/suppressed.
6. Track suppression, morale, wounded/KIA, cover, and contact stats in the infantry panel.
