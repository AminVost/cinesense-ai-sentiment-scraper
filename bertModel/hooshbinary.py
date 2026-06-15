import torch
import json
import time
from transformers import AutoTokenizer, AutoModelForSequenceClassification

# ✅ Start measuring total execution time
start_program_time = time.time()

# ✅ Load model and tokenizer
# model_name = "HooshvareLab/bert-fa-base-uncased-sentiment-deepsentipers-binary"
model_name = "fine_tuned_model"
tokenizer = AutoTokenizer.from_pretrained(model_name)
model = AutoModelForSequenceClassification.from_pretrained(model_name)

# ✅ Calculate model loading time
model_load_time = time.time() - start_program_time
print(f"Model loading time: {model_load_time:.4f} seconds")

# ✅ List of comments for sentiment analysis
comments = [
    {"id": 1, "text": "ایقد بد بود ک حد نداشت. به شدت حوصله سربر و افتضاح. انگار تو کنسرت بودی"},
    {"id": 2, "text": "این فیلم واقعاً فاجعه‌ی قرن بود! 😂 هنوز به نیمه نرسیده، پاکش کردم و از همه جا حذفش کردم. انقدر لوس و بی‌محتوا بود که حتی ارزش ادامه دادن نداشت!"},
    {"id": 3, "text": "در ژانر خودش قشنگ بود 👌🏽"},
    {"id": 4, "text": "بد نبود"},
    {"id": 5, "text": "چرا همه کامت ها منفی‌ان! اگه شمادخوشتون نیومد دلیل به بد بودن فیلم نیست."},
    {"id": 6, "text": "من خیلی دوسش داشتم و بنظرم خیلی خوش ساخت بود مثلا این فیلم صد هیچ باربری رو میزد! منتظرم قسمت دو بیاد"},
    {"id": 7, "text": "خوب نبود"},
    {"id": 8, "text": "نمیدونم ولی جدا از تحلیل دوستان من ازش لذت بردم و به شدت جدا از داستان جدیدش ، خیلی خوشگل و کمدی بود.."},
    {"id": 9, "text": "نکته مثبتش آریانا گراندس و دیگر هیچ"},
    {"id": 10, "text": "به نظر من فیلم معمولیه، یه مقدار قسمت های مربوط به آریانا باعث شده فیلم حالت لوس و بچگانه پیدا کنه! در کل برای سرگرمی خوبه"},
    {"id": 11, "text": "خوشم اومد از فیلمش شاید بخاطر موزیکال بودنش تم کودکانه گرفته باشه ولی در کل داستان و زاویه دید جالب بود"},
    {"id": 12, "text": "زیبا بود ، یه نگاه جدید از داستان شهر از بهت میده ، نگاهی که شخصا بیشتر دوستش داشتم"},
    {"id": 13, "text": "خب الان آخرش چی شد؟"},
    {"id": 14, "text": "بنظرم اصلا بد نبود! من نقاد نیستم، اما فیلم از نظر فضاسازی، طراحی صحنه و لباس و جلوه‌های ویژه و تو ژانر خودش واقعا غنی بود!"},
    {"id": 15, "text": "خیلی مسخرههههههههههه"},
    {"id": 16, "text": "از بدترین فیلم‌هایی که در تمام زندگیم دیدم."},
    {"id": 17, "text": "دیگ شما با این تحصیلات حرفتون سند"},
    {"id": 18, "text": "وای عاااالیییی خخخخخ"},
    {"id": 19, "text": "حیف وقتی که برای دانلودش گذاشتم"},
    {"id": 20, "text": "درود و ادب دوستانی که کامت بندرو میخونید، خواهش میکنم انقد نظرات الکی زیر پستا نزارین"},
    {"id": 21, "text": "نه عزیزم فیلم قشنگیه فقط قسمت دومش هم باید بیاد"}
]

# ✅ Start measuring processing time for comments
start_total_time = time.time()

# ✅ Store results
results = []

# ✅ Batch processing: Extract all texts at once
batch_texts = [comment["text"] for comment in comments]

# ✅ Tokenize all comments in a single batch
tokens = tokenizer(batch_texts, return_tensors="pt", padding=True, truncation=True, max_length=512)

# ✅ Perform sentiment prediction
with torch.no_grad():
    outputs = model(**tokens)

probabilities = torch.nn.functional.softmax(outputs.logits, dim=-1)

# ✅ Process the output results
for i, comment in enumerate(comments):
    negative_prob = probabilities[i][0].item() * 100
    positive_prob = probabilities[i][1].item() * 100
    sentiment = "Positive" if positive_prob > negative_prob else "Negative"

    results.append({
        "id": comment["id"],
        "text": comment["text"],
        "sentiment": sentiment,
        "positive": f"{positive_prob:.2f}%",
        "negative": f"{negative_prob:.2f}%"
    })

# ✅ Calculate processing time for all comments
total_processing_time = time.time() - start_total_time

# ✅ Calculate total execution time
total_program_time = time.time() - start_program_time

# ✅ Print execution times and results
print(f"\nModel loading time: {model_load_time:.4f} seconds")
print(f"Total comments processing time: {total_processing_time:.4f} seconds")
print(f"Total execution time (including model loading): {total_program_time:.4f} seconds")
print(json.dumps(results, ensure_ascii=False, indent=2))

# ✅ Save results to output.json (overwrite previous content)
output_file = "output.json"
with open(output_file, "w", encoding="utf-8") as f:
    json.dump(results, f, ensure_ascii=False, indent=2)

print(f"Results saved to {output_file}")
