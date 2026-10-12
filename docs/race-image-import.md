# Race From Image

Open **Race Editor → File → From Image**. Choose an existing photo or use **Take Photo**.

Draw the route as a single pencil line on plain paper. A complete loop becomes a circuit; a line with two ends becomes a point-to-point race. Photograph the page from directly above in even light for the closest match to the drawing.

For a page with several tracks:

1. Choose **Crop One Track**, then drag a box around the drawing you want. Leave some white space around it. Cropping uses the original photo, so it can recover detail lost in the whole-page preview.
2. The selected route is green; other detected routes are blue. Tap a route or choose it from **Detected track**. **Whole Page** resets the crop.
3. Adjust **Pencil sensitivity** if the route is faint or the preview includes paper texture. **Join tiny pencil gaps** reconnects small breaks; it does not bridge large missing sections.
4. For a circuit, **Set Start** lets you tap the route to choose a starting node. **Reverse direction** changes the driving direction; for an open route it swaps the endpoints. The orange marker shows the start.
5. Choose a name, track length, and road width. Check the entire highlight, then select **Import Track**.

The import creates a new flat asphalt race with editable nodes and edges. Existing races remain in the project. Duplicate race names get a numeric suffix. **Undo** removes the import; **Redo** restores it. Save the race using the editor’s normal File actions.

If the automatic tracer cannot follow the drawing, choose **Trace by Hand** and tap along the intended route. Add points at bends, then tap the first point to close a circuit or select **Finish Open Route**. **Undo Point** corrects the most recent point. This also works for drawings with two road edges: trace the middle of the road.

Photos are processed locally in a browser worker and are not uploaded or stored with the race. Analysis uses a crop of at most 640 pixels on its longest edge. It cannot interpret crossings as bridges, choose between branching routes, or correct perspective distortion. Labels touching a track, heavy shading, and large gaps may require a closer crop or manual tracing. Always review the preview before importing.

Validation: `node --test tests/unit/raceImageTrace.test.js`. Browser upload, crop, import, manual trace, and cancellation coverage lives in `tests/playwright/race-image-import.spec.js` and runs in the repository’s Playwright CI environment.
