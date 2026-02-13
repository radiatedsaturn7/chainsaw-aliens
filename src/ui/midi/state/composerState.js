export function initializeComposerState(composer, options = {}) {
  const {
    quantizeOptions,
    quantizeIndex,
    noteLengthIndex,
    song,
    cachedPrograms,
    instrumentFamilyTabs
  } = options;

  composer.ticksPerBeat = 8;
  composer.beatsPerBar = 4;
  composer.quantizeOptions = quantizeOptions;
  composer.quantizeIndex = quantizeIndex;
  composer.quantizeEnabled = true;
  composer.noteLengthIndex = noteLengthIndex;
  composer.swing = 0;
  composer.previewOnEdit = true;
  composer.scrubAudition = false;
  composer.metronomeEnabled = false;
  composer.scaleLock = false;
  composer.slurEnabled = false;
  composer.staccatoEnabled = Boolean(song?.staccatoEnabled);
  composer.drumAdvanced = false;
  composer.activeTab = 'grid';
  composer.activeTool = 'draw';
  composer.currentDocumentRef = null;
  composer.highContrast = Boolean(song?.highContrast);
  composer.chordMode = Boolean(song?.chordMode);
  composer.selectedTrackIndex = 0;
  composer.selectedPatternIndex = 0;
  composer.playheadTick = 0;
  composer.lastPlaybackTick = 0;
  composer.isPlaying = false;
  composer.keyframePanelOpen = false;
  composer.activeNotes = new Map();
  composer.livePreviewNotes = new Set();
  composer.dragState = null;
  composer.suppressNextGridTap = false;
  composer.selection = new Set();
  composer.clipboard = null;
  composer.cursor = { tick: 0, pitch: 60 };
  composer.cachedPrograms = new Set(cachedPrograms || []);
  composer.instrumentPreview = { loading: false, key: null };
  composer.instrumentDownload = { loading: false, key: null };
  composer.instrumentPicker = {
    familyTab: instrumentFamilyTabs?.[0]?.id || 'piano-keys',
    trackIndex: null,
    mode: null,
    selectedProgram: null,
    bounds: [],
    favoriteBounds: [],
    sectionBounds: [],
    tabBounds: [],
    tabPrevBounds: null,
    tabNextBounds: null,
    confirmBounds: null,
    cancelBounds: null,
    downloadBounds: null,
    scrollUpBounds: null,
    scrollDownBounds: null,
    scroll: 0,
    scrollMax: 0,
    scrollStep: 0
  };
}
