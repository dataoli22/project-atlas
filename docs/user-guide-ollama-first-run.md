# Setting up Ollama for the first time

This is a short, practical walkthrough for getting on-device AI working in Atlas via Ollama. For the deeper architecture (how requests are routed, provider fallback internals, agent design), see `docs/ollama-on-device-and-agents.md` - this doc is just "what do I click."

## The default behavior, before you do anything

Out of the box, Atlas prefers a cloud provider once you add a key for one (Groq's free tier, or Ollama pointed at a cloud endpoint), because it's faster and more capable. If that call fails, Atlas automatically falls back to on-device Ollama. Your provider keys and prompts always go straight from your device to whichever provider you configure - Atlas never routes them through a hosted relay of its own.

If you haven't installed Ollama and haven't added any cloud key, AI features simply won't have a working provider to fall back to. So if you want AI features at all without a cloud key, you need Ollama installed and running.

## 1. Install Ollama

Download it from [ollama.com/download](https://ollama.com/download) and install it like any other app, then make sure it's running (it typically runs in the background/system tray once started).

## 2. Open AI runtime settings in Atlas

In Atlas, go to **Settings -> On-device AI runtime**. You'll see the connection fields for Ollama:

- **Ollama base URL** (defaults to your local Ollama install)
- **Ollama generation model** (the chat model, e.g. `llama3.1:8b`)
- **Ollama embedding model**
- **Ollama API key** (only needed if you've pointed this at a non-local/hosted Ollama endpoint)

If your base URL isn't a loopback address (`localhost`/`127.0.0.1`), Atlas will show a warning that requests will leave your device - only do this if you deliberately set up a remote Ollama endpoint.

## 3. Run the first-run check

In the **"Ollama first-run check"** card, click **"Run first-run check."** This verifies, in order:

1. **Installed** - whether Ollama is detected on this device (can't be checked for non-local targets)
2. **Running** - whether Atlas could actually reach it and what version it reports
3. **Chat model** - whether your configured generation model is present
4. **Embedding model** - whether your configured embedding model is present

If Ollama isn't installed, the result will tell you to download it from the same `ollama.com/download` link above. If it's installed but not running, start the Ollama app/service and run the check again.

## 4. Pull missing models

If the check finds a model isn't installed, a **"Pull {model}"** button appears next to it. Click it and wait - Atlas waits for Ollama to finish the pull and report a final success/failure rather than showing a live progress bar, so large models can take a while with no visible feedback in the meantime. Once it succeeds, the check re-runs automatically.

You can browse available models at [ollama.com/library](https://ollama.com/library) if you want something other than the defaults.

## 5. Save your settings

Click **"Save AI runtime settings"** at the bottom of the page. You'll see a confirmation that it saved to the local Atlas runtime on this device.

## Enabling local-only mode (hard privacy guarantee)

If you want a guarantee that nothing ever leaves your device - not even an occasional cloud fallback - turn on the **"Local-only mode"** toggle in the same settings panel. This forces Ollama as the only active provider and blocks remote AI use entirely (the "Allow Groq" toggle and default-provider selector become disabled while it's on). This is the setting to use if the cloud-first-with-fallback default isn't acceptable for your use case.
