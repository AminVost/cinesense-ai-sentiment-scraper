from transformers import AutoTokenizer, AutoModelForSequenceClassification
import torch

# 🔹 بارگذاری مدل اصلی و مدل فاین‌تیون شده
original_model = AutoModelForSequenceClassification.from_pretrained("HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary")
fine_tuned_model = AutoModelForSequenceClassification.from_pretrained("fine_tuned_model")

tokenizer = AutoTokenizer.from_pretrained("fine_tuned_model")

text = "این فیلم خیلی عالی بود!"

# پردازش متن برای مدل اصلی
tokens = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512)
with torch.no_grad():
    outputs_original = original_model(**tokens)
    probabilities_original = torch.nn.functional.softmax(outputs_original.logits, dim=-1)

# پردازش متن برای مدل فاین‌تیون شده
with torch.no_grad():
    outputs_fine_tuned = fine_tuned_model(**tokens)
    probabilities_fine_tuned = torch.nn.functional.softmax(outputs_fine_tuned.logits, dim=-1)

# نمایش خروجی‌ها
print("\n🔹 مدل قبل از فاین‌تیونینگ:")
print(f"مثبت: {probabilities_original[0][1].item() * 100:.2f}% | منفی: {probabilities_original[0][0].item() * 100:.2f}%")

print("\n🔹 مدل بعد از فاین‌تیونینگ:")
print(f"مثبت: {probabilities_fine_tuned[0][1].item() * 100:.2f}% | منفی: {probabilities_fine_tuned[0][0].item() * 100:.2f}%")
