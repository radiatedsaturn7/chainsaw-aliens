# Voicing cutscenes with Qwen

The game plays an ordinary MP3 voice track. It does not need Qwen, Python, a model download, or an online service. Dialogue and score are separate in Movie Maker. Dialogue follows the master volume, so turning the score down does not mute conversations. MP4 exports include both tracks.

## Setup (once, on the machine doing the rendering)

- Python 3.12, FFmpeg with `libmp3lame`, and a virtual environment.
- The reference CPU environment used `torch==2.6.0+cpu`, `torchaudio==2.6.0+cpu` (PyTorch CPU wheel index), `qwen-tts==0.1.1`, `transformers==4.57.3`, `accelerate==1.12.0`, NumPy, and SoundFile. The runner uses BF16 with PyTorch SDPA on CPU. A machine without native BF16 support will be much slower.

## Voice a new scene with the existing cast

Use **fixed-reference generation** for new scenes with the existing cast. Use VoiceDesign only to audition a different actor, not to regenerate normal dialogue: the same description and seed do not fix speaker identity across lines or batches.

Download the [0.6B Base weights](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-0.6B-Base) at the revision in [cast.json](cast.json), including the `speech_tokenizer` subfolder. Keep the weights outside the game repo; the runner reads them locally. The two short reference takes in this directory are synthetic voice assets made for these fictional characters. Do not swap, normalize, or trim the reference files between scenes. The renderer checks the original bytes and uses the matching transcript as part of each voice prompt.


1. Start each spoken caption in Movie Maker with `ROB:` or `CAIT:`, then save the scene. Use gaps for pauses. The planner treats every nonempty Text clip as dialogue, so a plain title Text clip is rejected as an unattributed caption. Use a visual asset for a silent title card.
2. Run from the repo root, replacing `r1-blue-hills-intro` with the saved scene name:

```sh
CUTSCENES=data/server-storage/files/cutscenes
OMP_WAIT_POLICY=PASSIVE QWEN_THREADS=2 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
python tools/campaigns/qwen/render_locked_dialogue.py "$CUTSCENES" \
  /path/to/Qwen3-TTS-0.6B-Base /path/to/voice-work \
  --scene r1-blue-hills-intro --install-into "$CUTSCENES"
```

3. Reopen the scene and check it with the score in Movie Maker and in the game. Omit `--install-into` for WAV takes only. Regenerate after changing the text or timing. The installer does not truncate an overlong take: try a different seed or deliberately allow more caption time. It replaces only its own dialogue track.

The model reads each caption with the same reference for that character. Cadence can still vary. The reference-locked pass uses English, BF16 SDPA on CPU, seed 772 plus the batch index and microbatch offset, temperature 0.74, top-k 25, top-p 0.94 and subtalker temperature 0.75. The default batch cap is four takes to bound memory on CPU. Use `--max-batch 1` on smaller machines and `--seed` to audition another delivery without changing the cast. For a longer script, render first and audit the early, late and scene-changing lines for both dialogue fidelity and consistency. If an alternate take is needed, regenerate only those lines and reinstall the stem; subtitle timing is unchanged. This Base model does not take `--direction` prompts. The game never loads the reference WAVs or model weights.

## Audition a different actor (optional)

Use the [1.7B VoiceDesign model](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) and [voice-presets.json](voice-presets.json) to create synthetic reference candidates. Its direction prompt affects the performance but does not lock the actor. Omit `--install-into` for a safe audition. After selecting a new reference, update its transcript and fingerprint in a separate cast preset before using the locked runner. Do not add model weights or raw auditions to Git.

```sh
CUTSCENES=data/server-storage/files/cutscenes
OMP_WAIT_POLICY=PASSIVE QWEN_THREADS=2 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
python tools/campaigns/qwen/render_dialogue.py "$CUTSCENES" \
  --scene r1-blue-hills-exit --model /path/to/Qwen3-TTS-VoiceDesign \
  --out /path/to/voice-work \
  --direction "Rob spots movement, keeps his voice low, then cuts Cait off. Cait starts curious and ends worried."
```
