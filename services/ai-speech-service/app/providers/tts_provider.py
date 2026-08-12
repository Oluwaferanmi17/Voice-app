from abc import ABC, abstractmethod
from typing import AsyncGenerator
from dataclasses import dataclass


@dataclass
class TTSRequest:
    text: str
    voice_id: str
    speed: float = 1.0


class TTSProvider(ABC):
    """Abstract base every TTS provider must implement.
    The rest of the system only ever talks to this interface —
    swapping Kokoro for ElevenLabs/Cartesia later means writing
    one new class, not touching any calling code.
    """

    @abstractmethod
    async def synthesize_stream(
        self, request: TTSRequest
    ) -> AsyncGenerator[bytes, None]:
        """Yields raw audio chunks (PCM/WAV bytes) as they become available."""
        ...

    @abstractmethod
    def list_voices(self) -> list[dict]:
        """Returns available voices: [{'id': ..., 'name': ..., 'language': ...}, ...]"""
        ...
