import os
from .tts_provider import TTSProvider
from .kokoro_provider import KokoroProvider

_provider_instance: TTSProvider | None = None


def get_tts_provider() -> TTSProvider:
    global _provider_instance
    if _provider_instance is None:
        provider_name = os.getenv("TTS_PROVIDER", "kokoro")
        if provider_name == "kokoro":
            _provider_instance = KokoroProvider()
        # elif provider_name == "elevenlabs":
        #     _provider_instance = ElevenLabsProvider()
        else:
            raise ValueError(f"Unknown TTS provider: {provider_name}")
    return _provider_instance
