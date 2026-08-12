import json
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

from .providers.factory import get_tts_provider
from .providers.tts_provider import TTSRequest

app = FastAPI()


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/voices")
async def voices():
    provider = get_tts_provider()
    return {"voices": provider.list_voices()}


@app.websocket("/synthesize")
async def synthesize_ws(websocket: WebSocket):
    await websocket.accept()
    provider = get_tts_provider()

    try:
        while True:
            raw = await websocket.receive_text()
            payload = json.loads(raw)

            request = TTSRequest(
                text=payload["text"],
                voice_id=payload.get("voiceId", "af_heart"),
                speed=payload.get("speed", 1.0),
            )
            message_id = payload.get("messageId")

            chunk_index = 0
            async for audio_chunk in provider.synthesize_stream(request):
                await websocket.send_bytes(audio_chunk)
                # A small JSON marker after each chunk so presence-service
                # knows which message/chunk this belongs to, since binary
                # frames alone carry no metadata
                await websocket.send_text(
                    json.dumps(
                        {
                            "messageId": message_id,
                            "chunkIndex": chunk_index,
                            "type": "chunk",
                        }
                    )
                )
                chunk_index += 1

            # Signal end of this message's audio
            await websocket.send_text(
                json.dumps(
                    {
                        "messageId": message_id,
                        "type": "complete",
                        "totalChunks": chunk_index,
                    }
                )
            )

    except WebSocketDisconnect:
        pass
