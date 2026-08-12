import asyncio
import io
from typing import AsyncGenerator

import numpy as np
import soundfile as sf
from kokoro import KPipeline

from .tts_provider import TTSProvider, TTSRequest

# Kokoro's built-in voice identifiers (subset — full list depends on
# which voice pack you download; these are the standard English ones)
AVAILABLE_VOICES = [
    {"id": "af_heart", "name": "Heart", "language": "en-US", "gender": "female"},
    {"id": "af_bella", "name": "Bella", "language": "en-US", "gender": "female"},
    {"id": "am_michael", "name": "Michael", "language": "en-US", "gender": "male"},
    {"id": "bf_emma", "name": "Emma", "language": "en-GB", "gender": "female"},
    {"id": "bm_george", "name": "George", "language": "en-GB", "gender": "male"},
]


class KokoroProvider(TTSProvider):
    def __init__(self):
        # lang_code 'a' = American English; Kokoro loads the model once here
        self._pipeline = KPipeline(lang_code="a")

    async def synthesize_stream(
        self, request: TTSRequest
    ) -> AsyncGenerator[bytes, None]:
        # Kokoro's pipeline is a generator that yields (graphemes, phonemes, audio)
        # per sentence/segment — this is what gives us streaming-friendly chunks
        # instead of waiting for the whole message to synthesize at once.
        loop = asyncio.get_event_loop()

        def _generate_chunks():
            return list(
                self._pipeline(
                    request.text,
                    voice=request.voice_id,
                    speed=request.speed,
                )
            )

        # Kokoro's inference is CPU/GPU-bound sync code — run it in a thread
        # so it doesn't block the FastAPI event loop for other connections.
        segments = await loop.run_in_executor(None, _generate_chunks)

        for _, _, audio in segments:
            # audio is a numpy float32 array at 24kHz — encode each segment
            # as a small WAV chunk so the client can decode/play it independently
            buffer = io.BytesIO()
            sf.write(buffer, audio, samplerate=24000, format="WAV")
            yield buffer.getvalue()

    def list_voices(self) -> list[dict]:
        return AVAILABLE_VOICES
