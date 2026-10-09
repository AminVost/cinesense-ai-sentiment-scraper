# Free Persian browser model publication

The original Persian binary sentiment model is `HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary` (Apache-2.0).

**Already completed:** A dedicated GitHub Actions job exported this model to quantized ONNX. The files are publicly available as 6 GitHub Release assets at:
https://github.com/AminVost/cinesense-ai-sentiment-scraper/releases/tag/persian-sentiment-onnx-v1

**Why another hosting step?** GitHub Release binary downloads do NOT allow direct cross-origin browser fetching in our real Chrome tests. A Next.js rewrite returned 302 redirects rather than a usable same-origin 164 MB stream. This release is therefore an *archive*, not an inference-hosting endpoint. Do not enable an unavailable browser model ID.

## Publish to the free Hugging Face model hub

This step needs a Hugging Face account owner to authorize a write token. No paid hosting, dedicated server or GPU is required. Creating the account and write token must be done by the owner, not by CineSense.

1. Create a free https://huggingface.co account; create a **fine-grained write** token authorized to create/update a public model repository. Keep it secret.
2. In GitHub repository Settings → Secrets and variables → Actions, add the secret **`HF_TOKEN`**; do not paste it into chat.
3. In Actions → **Publish Persian ONNX to Hugging Face** → Run workflow, enter your Hugging Face `namespace/model-name` as `repo_id`. The job downloads the already-exported model artifact and uploads its tokenizer, config and quantized ONNX weights to a **public** HF model repo.
4. Add Vercel Environment Variable **`PERSIAN_BROWSER_MODEL_ID`** equal to the exact `namespace/model-name` and Redeploy. Before announcing it is active, run **Persian ONNX end-to-end browser smoke** with the new model repository id to validate two real Farsi sentences.

## Limitations
- ~164 MB model weights plus tokenizer downloaded once by the browser and cached. Users with slow/restricted connections may be unable to use it.
- This original model is a **binary positive/negative Persian classifier**, not a neutral emotion classifier.
- The historical pseudo-labelled training examples do not prove accuracy. Use `movie-scraper/tools/evaluate-sentiment.mjs` with separate human-reviewed truth and model predictions. A minimum 100 independent review examples per target language is recommended before publishing an accuracy percentage.
- Github Release is a backup source only; do not infer direct browser model availability merely because the release exists.
