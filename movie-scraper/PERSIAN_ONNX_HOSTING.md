# Persian browser model: published and active

**Live free model:** https://huggingface.co/Aminvost/cinesense-persian-sentiment-onnx

**Production:** `PERSIAN_BROWSER_MODEL_ID=Aminvost/cinesense-persian-sentiment-onnx` is configured in Vercel Production and Preview.

**Verified:** GitHub Actions [Persian end-to-end real browser test](https://github.com/AminVost/cinesense-ai-sentiment-scraper/actions/runs/37983757358) passed: correct predicted positive and negative labels for two separate Persian sentences, using the same public model repo and the live website. This is a smoke test, *not* a scientific accuracy estimate.

The model runs on visitors' devices with WebAssembly, using public Hugging Face-hosted weights. No paid AI API or dedicated server is needed. The initial download is ~164 MB of model weights plus tokenizer, and user bandwidth/device CPU capacity are necessary.

### Maintenance / republishing


The original Persian binary sentiment model is `HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary` (Apache-2.0).

**Already completed:** A dedicated GitHub Actions job exported this model to quantized ONNX. The files are publicly available as 6 GitHub Release assets at:
https://github.com/AminVost/cinesense-ai-sentiment-scraper/releases/tag/persian-sentiment-onnx-v1

**Why another hosting step?** GitHub Release binary downloads do NOT allow direct cross-origin browser fetching in our real Chrome tests. A Next.js rewrite returned 302 redirects rather than a usable same-origin 164 MB stream. This release is therefore an *archive*, not an inference-hosting endpoint. Do not enable an unavailable browser model ID.

## Republishing to the free Hugging Face model hub

The owner has already connected a write token as the GitHub Actions secret `HF_TOKEN`. The steps below apply only when manually republishing a new exported model version.

1. Create a free https://huggingface.co account; create a **fine-grained write** token authorized to create/update a public model repository. Keep it secret.
2. In GitHub repository Settings → Secrets and variables → Actions, add the secret **`HF_TOKEN`**; do not paste it into chat.
3. In Actions → **Publish Persian ONNX to Hugging Face** → Run workflow, enter your Hugging Face `namespace/model-name` as `repo_id`. The job downloads the already-exported model artifact and uploads its tokenizer, config and quantized ONNX weights to a **public** HF model repo.
4. Verify that the production Vercel Environment Variable **`PERSIAN_BROWSER_MODEL_ID`** matches the repo id. Redeploy when changed. Run the **Persian ONNX end-to-end browser smoke** against the live site to validate the newly published files.

## Limitations
- ~164 MB model weights plus tokenizer downloaded once by the browser and cached. Users with slow/restricted connections may be unable to use it.
- This original model is a **binary positive/negative Persian classifier**, not a neutral emotion classifier.
- The historical pseudo-labelled training examples do not prove accuracy. Use `movie-scraper/tools/evaluate-sentiment.mjs` with separate human-reviewed truth and model predictions. A minimum 100 independent review examples per target language is recommended before publishing an accuracy percentage.
- Github Release is a backup source only; do not infer direct browser model availability merely because the release exists.
