// Placement snapshot from the saved 2022 Subaru WRX4, 2026-10-12.
// Graphics, frame order, visibility, and vehicle physics are deliberately excluded.
const WRX4_PLACEMENT = {
  "front": {
    "body": {
      "bodyScaleX": 2.4831177137924674,
      "bodyScaleY": 2.2958861916001347,
      "bodyOffsetX": 0.03383458646616333,
      "bodyOffsetY": -0.09833176691729406,
      "bodyRotationDeg": 0
    },
    "tires": {
      "tireScaleX": 1.4287106822818194,
      "tireScaleY": 1.1908884148848684,
      "tireSpacingScale": 1.1041129434915415,
      "frontTireOffsetX": 0.06790374338593352,
      "frontTireOffsetY": -1.0931657818645828,
      "rearTireOffsetX": -0.08670112781954842,
      "rearTireOffsetY": 7.825969392383872
    }
  },
  "frontRight": {
    "body": {
      "bodyScaleX": 4.083142548754699,
      "bodyScaleY": 2.513625800340695,
      "bodyOffsetX": -6.0458176691729335,
      "bodyOffsetY": -0.468397556390979,
      "bodyRotationDeg": 2.771528430451127
    },
    "tires": {
      "tireScaleX": 2.4642699277490596,
      "tireScaleY": 1.3586983816964284,
      "tireSpacingScale": 1,
      "frontTireOffsetX": -1.0499295112781954,
      "frontTireOffsetY": -1.4199953007518804,
      "rearTireOffsetX": -0.5476973684210531,
      "rearTireOffsetY": -0.28336466165413654
    }
  },
  "right": {
    "body": {
      "bodyScaleX": 2.63207989456062,
      "bodyScaleY": 2.6123375455239657,
      "bodyOffsetX": -4.421757518796991,
      "bodyOffsetY": -1.9486607142857153,
      "bodyRotationDeg": 0
    },
    "tires": {
      "tireScaleX": 2.128649994125939,
      "tireScaleY": 1.4672813013980261,
      "tireSpacingScale": 1,
      "frontTireOffsetX": -0.5212640977443623,
      "frontTireOffsetY": -0.7591635338345881,
      "rearTireOffsetX": -1.0234962406015047,
      "rearTireOffsetY": -0.8913298872180455
    }
  },
  "rearRight": {
    "body": {
      "bodyScaleX": 2.7011781161889092,
      "bodyScaleY": 2.4247852296757517,
      "bodyOffsetX": -1.6198308270676698,
      "bodyOffsetY": -2.9002584586466167,
      "bodyRotationDeg": 1.0199938322368425
    },
    "tires": {
      "tireScaleX": 2.020067074424342,
      "tireScaleY": 1.576524592526598,
      "tireSpacingScale": 0.7385903724154136,
      "frontTireOffsetX": -2.0808270676691745,
      "frontTireOffsetY": 1.0118656015037573,
      "rearTireOffsetX": -6.098684210526317,
      "rearTireOffsetY": -0.09833176691729406
    }
  },
  "rear": {
    "body": {
      "bodyScaleX": 2.0891652960526312,
      "bodyScaleY": 1.9114841547227441,
      "bodyOffsetX": 0.007401315789472562,
      "bodyOffsetY": -0.09833176691729406,
      "bodyRotationDeg": 0
    },
    "tires": {
      "tireScaleX": 1.6252200936912593,
      "tireScaleY": 1.447538952361372,
      "tireSpacingScale": 1.2357010690789474,
      "frontTireOffsetX": 0,
      "frontTireOffsetY": -0.17763157894736992,
      "rearTireOffsetX": 0.08670112781954842,
      "rearTireOffsetY": 1.6198308270676698
    }
  },
  "rearLeft": {
    "body": {
      "bodyScaleX": 2.7011781161889092,
      "bodyScaleY": 2.4247852296757517,
      "bodyOffsetX": 1.6198308270676698,
      "bodyOffsetY": -2.9002584586466167,
      "bodyRotationDeg": -1.0199938322368425
    },
    "tires": {
      "tireScaleX": 2.020067074424342,
      "tireScaleY": 1.3389560326597745,
      "tireSpacingScale": 1,
      "frontTireOffsetX": 3.496593045112782,
      "frontTireOffsetY": 0.5360667293233057,
      "rearTireOffsetX": 6.034187030075188,
      "rearTireOffsetY": -0.6534304511278197
    }
  },
  "left": {
    "body": {
      "bodyScaleX": 2.63207989456062,
      "bodyScaleY": 2.6123375455239657,
      "bodyOffsetX": 4.421757518796991,
      "bodyOffsetY": -1.9486607142857153,
      "bodyRotationDeg": 0
    },
    "tires": {
      "tireScaleX": 2.128649994125939,
      "tireScaleY": 1.4672813013980261,
      "tireSpacingScale": 1,
      "frontTireOffsetX": 0.4039003759398483,
      "frontTireOffsetY": -0.5476973684210531,
      "rearTireOffsetX": 0.35103383458646675,
      "rearTireOffsetY": -0.697346105895301
    }
  },
  "frontLeft": {
    "body": {
      "bodyScaleX": 4.083142548754699,
      "bodyScaleY": 2.513625800340695,
      "bodyOffsetX": 6.0458176691729335,
      "bodyOffsetY": -0.468397556390979,
      "bodyRotationDeg": 3.753356361996481
    },
    "tires": {
      "tireScaleX": 2.4642699277490596,
      "tireScaleY": 1.3586983816964284,
      "tireSpacingScale": 1,
      "frontTireOffsetX": 0.8268327067669148,
      "frontTireOffsetY": -0.7591635338345881,
      "rearTireOffsetX": -0.09833176691729406,
      "rearTireOffsetY": 0.3774671052631575
    }
  }
};

export function applyCarImportPlacementDefaults(car, component, previousLayers = {}, slots = Object.keys(WRX4_PLACEMENT)) {
  if (!['body', 'tires'].includes(component)) return;
  for (const slot of slots) {
    const entry = car.art?.angleLayers?.[slot]?.[component];
    if (!entry?.artRef) continue;
    entry.transforms = { ...WRX4_PLACEMENT[slot]?.[component], ...previousLayers[slot]?.[component]?.transforms };
    if (component === 'body') entry.fitToCar = previousLayers[slot]?.body?.fitToCar ?? true;
  }
}
