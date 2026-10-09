import json
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from hooshFineTune import read_gold_data, stratified_split


class TrainingDataTests(unittest.TestCase):
    def create_file(self, rows):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        path = Path(temporary.name) / "gold.jsonl"
        path.write_text("\n".join(json.dumps(row, ensure_ascii=False) for row in rows) + "\n", encoding="utf-8")
        return path

    def test_reject_duplicate_model_pseudo_labels(self):
        records = [{"text": f"کامنت تکراری {index}", "label": index % 2} for index in range(13)]
        path = self.create_file(records + records)
        with self.assertRaisesRegex(ValueError, "Duplicate"):
            read_gold_data(path)

    def test_50_unique_balanced_labels_pass_without_leakage(self):
        records = [{"text": f"کامنت معتبر {index}", "label": index % 2} for index in range(50)]
        rows = read_gold_data(self.create_file(records))
        training, held_out = stratified_split(rows)
        self.assertEqual(len(training), 40)
        self.assertEqual(len(held_out), 10)
        self.assertFalse({x["text"] for x in training} & {x["text"] for x in held_out})
        self.assertEqual({x["label"] for x in held_out}, {0, 1})

    def test_reject_invalid_label(self):
        records = [{"text": f"sample {index}", "label": "positive" if index == 0 else index % 2} for index in range(50)]
        with self.assertRaisesRegex(ValueError, "label"):
            read_gold_data(self.create_file(records))


if __name__ == "__main__":
    unittest.main()
