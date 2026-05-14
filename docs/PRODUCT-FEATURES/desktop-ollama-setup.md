# Desktop — Ollama setup

Ollama is a separate application that runs local AI models on your computer. Install it from [https://ollama.com](https://ollama.com), then start it before using features that call Ollama (for example AI image analysis with a vision model, or search-prompt translation).

1. Install Ollama for your OS.
2. Run `ollama serve` (or use the desktop tray app where available).
3. Pull the models you need, for example: `ollama pull qwen2.5vl:3b` (exact names depend on your Settings choices).

This app does not bundle Ollama; it connects to the Ollama HTTP API on your machine.
