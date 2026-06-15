import os
import json
import time
import torch
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, Trainer, TrainingArguments

# 📌 بررسی GPU
device = "cuda" if torch.cuda.is_available() else "cpu"
print(f"Using device: {device}")

# 📌 مسیر مدل فاین‌تیون‌شده
fine_tuned_model_path = "fine_tuned_model"

# 📌 بررسی اینکه آیا مدل فاین‌تیون‌شده وجود دارد
if os.path.exists(fine_tuned_model_path):
    print("📌 مدل فاین‌تیون‌شده پیدا شد! بارگذاری از fine_tuned_model/")
    tokenizer = AutoTokenizer.from_pretrained(fine_tuned_model_path)
    model = AutoModelForSequenceClassification.from_pretrained(fine_tuned_model_path).to(device)
else:
    print("⚠️ مدل فاین‌تیون‌شده پیدا نشد! بارگذاری مدل خام از Hugging Face...")
    model_name = "HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary"
    tokenizer = AutoTokenizer.from_pretrained(model_name)
    model = AutoModelForSequenceClassification.from_pretrained(model_name).to(device)

# 📌 شروع زمان اجرای کل برنامه
start_program_time = time.time()

# 📌 لیست کامنت‌ها (بدون لیبل اولیه)
comments = [
    {"id": 1, "text": "خیلی ناز بود و حس بچگی هامونو بهمون میده"},
    {"id": 2, "text": "این فیلم از بچگی کابوسم بود موقع دیدنش وحشت میکردم از گریم هاش ولی بازم میدیدم"},
    {"id": 3, "text": "یا اینکه فیلمش واسه سال ۱۳۱۸ ، ولی حس خوب دوران کودکی رو میده بهم 🥲"},
    {"id": 4, "text": "فکر نمی‌کنم اگر بدونید پشت صحنه ی این فیلم چطور بوده و بلاهایی که بر سر بازیگراش به خاطرش اومده همچنان انقدر دوستش داشته باشید:>"},
    {"id": 5, "text": "چرا مگه چی بوده؟"},
    {"id": 6, "text": "تو بچگی این فیلمو چندین و چندین بار توی MBC3 میدیدم… و حالا دیدم که تو سایتتون هست… اخ قلبم… دمتون گرم"},
    {"id": 7, "text": "جرو قشنگترین نوستالژی هایی که دیدم♡من عاشق ده دقیقه ی آخرش شدم…۸۰ سال پیش همچین شاهکاری ساختن بخدا هنر میخواد،که حتی احساس نمیکنی عمری گذشته ازش مگه میشه انقد قشنگ و تو دل برو؟!"},
    {"id": 8, "text": "بهترین فیلم عمرمه. هر بار که میخوام ببینمش میخکوب میشم و نه تنها هر بار از دفعه قبلی جذابیتش کمتر نمیشه بلکه خیلی هم بیشتر میشه."},
    {"id": 9, "text": "جودی گارلند تو این فیلم عالیی بود. این فیلمو بعد دیدن فیلم judy دیدم و خیلیی خوشم اومد"},
    {"id": 10, "text": "کلی خاطره. شاهکاری ک هنوزم ک هنوزع واسه کودکان همه نقاط دنیا خاطره سازی میکنه واقعا دمتون گرم که تو سایت قرار دادین"},
    {"id": 11, "text": "نسبت به سالی که ساخته شده شاهکاره 82 سال خیلیه"},
    {"id": 12, "text": "نسبت به سال ؟ فیلم های اون زمان بالاتر الانن"},
    {"id": 13, "text": "تعصب"}
]

# 📌 پردازش کامنت‌ها و پیش‌بینی احساسات
start_total_time = time.time()
results = []

for comment in comments:
    text = comment["text"]
    tokens = tokenizer(text, return_tensors="pt", padding=True, truncation=True, max_length=512).to(device)

    with torch.no_grad():
        outputs = model(**tokens)
        probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)

    negative_prob = probabilities[0][0].item() * 100
    positive_prob = probabilities[0][1].item() * 100
    sentiment = "مثبت" if positive_prob > negative_prob else "منفی"
    label = 1 if sentiment == "مثبت" else 0

    results.append({
        "id": comment["id"],
        "text": text,
        "sentiment": sentiment,
        "positive": f"{positive_prob:.2f}%",
        "negative": f"{negative_prob:.2f}%",
        "label": label
    })

total_processing_time = time.time() - start_total_time
print(f"Total comments processing time: {total_processing_time:.4f} seconds")

# 📌 ذخیره داده‌های قبلی و افزودن داده‌های جدید
data_path = "fine_tuned_data.json"

if os.path.exists(data_path):
    with open(data_path, "r", encoding="utf-8") as f:
        previous_data = json.load(f)
else:
    previous_data = []

all_data = previous_data + results

with open(data_path, "w", encoding="utf-8") as f:
    json.dump(all_data, f, ensure_ascii=False, indent=2)

# 📌 آماده‌سازی داده‌ها برای فاین‌تیونینگ
def tokenize_function(example):
    encoding = tokenizer(example["text"], padding="max_length", truncation=True, max_length=512)
    encoding["labels"] = example["label"]
    return encoding

dataset = Dataset.from_list(all_data)
dataset = dataset.map(tokenize_function, batched=True)
dataset = dataset.train_test_split(test_size=0.2)

# 📌 تنظیمات آموزش مدل
training_args = TrainingArguments(
    output_dir="./results",
    num_train_epochs=1,
    per_device_train_batch_size=4,
    per_device_eval_batch_size=4,
    warmup_steps=10,
    weight_decay=0.01,
    logging_dir="./logs",
    evaluation_strategy="epoch",
)

trainer = Trainer(
    model=model,
    args=training_args,
    train_dataset=dataset["train"],
    eval_dataset=dataset["test"],
)

# 📌 آموزش مدل (فاین‌تیونینگ)
print("Starting fine-tuning...")
trainer.train()
print("Fine-tuning complete!")

# 📌 ذخیره مدل فاین‌تیون شده
model.save_pretrained(fine_tuned_model_path)
tokenizer.save_pretrained(fine_tuned_model_path)

# 📌 محاسبه کل زمان اجرا
total_program_time = time.time() - start_program_time
print(f"Total execution time (including fine-tuning): {total_program_time:.4f} seconds")

# 📌 نمایش نتایج نهایی
print(json.dumps(results, ensure_ascii=False, indent=2))
