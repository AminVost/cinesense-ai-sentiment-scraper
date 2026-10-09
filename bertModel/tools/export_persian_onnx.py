"""Export the existing Persian movie-review sentiment model to a browser-ready ONNX archive.

Requires: pip install -r bertModel/requirements-onnx-export.txt
Exports a quantized model and tokenizer; weights are NOT committed to GitHub.
"""
from pathlib import Path
import argparse
import json
import shutil

from optimum.onnxruntime import ORTModelForSequenceClassification
from transformers import AutoTokenizer
from onnxruntime.quantization import quantize_dynamic, QuantType

DEFAULT = "HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary"

def export(model_name, destination):
    destination.mkdir(parents=True, exist_ok=True)
    source = destination / "temporary"
    source.mkdir(exist_ok=True)
    model = ORTModelForSequenceClassification.from_pretrained(model_name, export=True)
    model.save_pretrained(source)
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    tokenizer.save_pretrained(destination)
    shutil.copy2(source / "config.json", destination / "config.json")
    graph = next(source.rglob("*.onnx"), None)
    if graph is None:
        raise RuntimeError("ONNX export did not produce a model")
    onnx_path = destination / "onnx" / "model_quantized.onnx"
    onnx_path.parent.mkdir(exist_ok=True)
    quantize_dynamic(str(graph), str(onnx_path), weight_type=QuantType.QInt8)
    shutil.rmtree(source)
    config = json.loads((destination / "config.json").read_text(encoding="utf8"))
    print(json.dumps({
        "model": model_name,
        "quantized_onnx_bytes": onnx_path.stat().st_size,
        "id2label": config.get("id2label"),
        "export": str(destination),
    }, ensure_ascii=False))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--model", default=DEFAULT)
    parser.add_argument("--out", default="dist/persian-sentiment")
    args = parser.parse_args()
    export(args.model, Path(args.out))
