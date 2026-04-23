import json
import os
import sys

KNOWN_HALLUCINATIONS = [
    "Sous-titres réalisés par la communauté d'Amara.org",
    "Sous titres réalisés par la communauté d'Amara.org",
    "Merci d'avoir regardé cette vidéo",
]


def looks_like_hallucination(text: str) -> bool:
    normalized = (text or "").strip().lower()
    if not normalized:
        return True

    for phrase in KNOWN_HALLUCINATIONS:
        if normalized == phrase.lower() or normalized.startswith(phrase.lower()):
            return True

    return False


def main():
    if len(sys.argv) < 4:
        raise RuntimeError("Usage: transcribe_audio.py <audio_path> <model_name> <language>")

    audio_path = sys.argv[1]
    model_name = sys.argv[2]
    language = sys.argv[3]
    device = os.environ.get("AUDIO_TRANSCRIPTION_DEVICE", "auto")
    compute_type = os.environ.get("AUDIO_TRANSCRIPTION_COMPUTE_TYPE", "auto")

    try:
        from faster_whisper import WhisperModel
    except Exception as error:
        raise RuntimeError(
            "Le package Python faster-whisper est introuvable. "
            "Installe-le avec : python -m pip install --user faster-whisper"
        ) from error

    try:
        model = WhisperModel(model_name, device=device, compute_type=compute_type)

        attempts = [
            {
                "language": language or "fr",
                "beam_size": 5,
                "best_of": 5,
                "condition_on_previous_text": False,
                "vad_filter": True,
                "vad_parameters": {"min_silence_duration_ms": 250},
                "no_speech_threshold": 0.45,
                "log_prob_threshold": -1.0,
            },
            {
                "language": language or "fr",
                "beam_size": 5,
                "best_of": 5,
                "condition_on_previous_text": False,
                "vad_filter": False,
                "no_speech_threshold": 0.45,
                "log_prob_threshold": -1.0,
            },
            {
                "beam_size": 5,
                "best_of": 5,
                "condition_on_previous_text": False,
                "vad_filter": False,
                "no_speech_threshold": 0.45,
                "log_prob_threshold": -1.0,
            },
        ]

        text = ""
        info = None

        for attempt in attempts:
            segments, info = model.transcribe(audio_path, **attempt)
            text = " ".join(segment.text.strip() for segment in segments if segment.text).strip()
            if text and not looks_like_hallucination(text):
                break
            text = ""

        result = {
            "ok": True,
            "text": text,
            "language": getattr(info, "language", language or "fr"),
            "duration": getattr(info, "duration", None),
        }
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
    except Exception as error:
        raise RuntimeError(f"Transcription locale impossible : {error}") from error


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        sys.stderr.write(str(error))
        sys.exit(1)
