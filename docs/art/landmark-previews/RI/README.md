# Providence landmark sightline review

Rendered the Providence race with its existing terrain, sky and scenery in the game's chase camera (960×540 desktop and the actual 390×844 handheld shell). Each frame samples the road centerline before the landmark's closest point on the route, not a free or posed camera angle. The QA fixture loads the exact serialized race document resolved through the project manifest; the on-road render and landmark art hydration use the game runtime. The test vehicle uses placeholder art. These frames verify visual placement; separate road tests check the full square collision footprints.

| Landmark | Sampled distance before projection | Result |
| --- | --- | --- |
| State House | 105 m | Dome and portico identifiable after rotating the sprite toward the approach. |
| John Brown House | 105 m | Red-brick gable and front elevation clearly visible above the left shoulder. |
| City Hall | 195 m | Mansard and upper facade visible mid-turn; existing roadside props obscure part of the base. |
| PPAC | 75 m | Terracotta facade and its unlettered blade marquee clearly visible. |
