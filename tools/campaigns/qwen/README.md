# Voicing cutscenes with Qwen

The game plays an ordinary MP3 voice track. It does not need Qwen, Python, a model download, or an online service. Dialogue and score are separate in Movie Maker. Dialogue follows the master volume, so turning the score down does not mute conversations. MP4 exports include both tracks.

## Setup (once, on the machine doing the rendering)

- Python 3.12, FFmpeg with `libmp3lame`, and a virtual environment.
- The reference CPU environment used `torch==2.6.0+cpu`, `torchaudio==2.6.0+cpu` (PyTorch CPU wheel index), `qwen-tts==0.1.1`, `transformers==4.57.3`, `accelerate==1.12.0`, NumPy, and SoundFile. The runner uses BF16 with PyTorch SDPA on CPU. A machine without native BF16 support will be much slower.
- Download the full [Qwen3-TTS-12Hz-1.7B-VoiceDesign model](https://huggingface.co/Qwen/Qwen3-TTS-12Hz-1.7B-VoiceDesign) at the revision in [voice-presets.json](voice-presets.json), including the `speech_tokenizer` subfolder. Keep the downloaded files outside the game repo. The runner opens them locally and does not send the script anywhere.

## New scene

1. In Movie Maker, start each spoken caption with `ROB:` or `CAIT:`. Time it for the performance you want. Keep silences as gaps between captions, not stage directions in the words. Save the scene.
2. From the repo root, run the command below, replacing `r1-blue-hills-exit` with the saved scene name. It works with later regions too.

```sh
CUTSCENES=data/server-storage/files/cutscenes
OMP_WAIT_POLICY=PASSIVE QWEN_THREADS=2 HF_HUB_OFFLINE=1 TRANSFORMERS_OFFLINE=1 \
python tools/campaigns/qwen/render_dialogue.py "$CUTSCENES" \
  --scene r1-blue-hills-exit --model /path/to/Qwen3-TTS-VoiceDesign \
  --out /path/to/voice-work --install-into "$CUTSCENES" \
  --direction "Rob spots movement, keeps his voice low, then cuts Cait off. Cait starts curious and ends worried."
```

3. Reload the scene and check it in Movie Maker with the score, then through the game. Check both the quiet beats and interruptions. If a take is too long, use a shorter delivery direction or give the existing caption more time; the installer stops instead of truncating speech. If Qwen misreads a name or word, add a pronunciation override in the renderer or try a new take with `--seed 951`.

Leaving off `--direction` uses the saved direction for that scene or the neutral conversational default. Leaving off `--scene` selects Region 1 only. Skip `--install-into` to render audition WAVs without touching the scene. The tool only replaces its own **Dialogue (Qwen)** track and `assets/qwen-dialogue.mp3`; it leaves captions, picture, duration, and score intact. Regenerate after changes to captions or timing.

## Settings to keep consistent

| Setting | Default |
| --- | --- |
| Model | Qwen3-TTS-12Hz-1.7B-VoiceDesign, pinned revision in the preset |
| Language / mode | English, non-streaming |
| Take seed | 177 |
| Sampling | Temperature 0.74, top-k 28, top-p 0.93, subtalker temperature 0.76 |
| Character descriptions | Rob: understated eastern Massachusetts / Chicago influence. Cait: contemporary Dublin Irish English. Full prompts live in the preset. |
| Scene direction | Describe what just happened and who the speaker is talking to. Don't start by changing pitch or temperature. |
| Output | Mono 24 kHz takes, compressed MP3 in the native scene |

Keep the character descriptions stable across scenes. VoiceDesign makes a new performance from a description; it does not lock the speaker identity or guarantee that a different batch will sound identical. If locking the voices becomes important, audition one clean synthetic reference per character and use Qwen's Base model with saved reference prompts. Do not use real-person recordings without permission. Only commit the game documents and compressed MP3s, not model weights or raw takes.
