import { NextResponse } from "next/server";

const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1_9_2yJFa08udNQDm2wnxaYJwvshIgg1Vpre5Olj2k6s/gviz/tq?tqx=out:csv";
const GOOGLE_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyvfmBR4TaCwBYQGLIEr_nKWOzfRTVkpw0IF75IyeRBX3itm3uJenWOAT0QaQWRaNLpxg/exec";

function cleanCSVField(field: string): string {
  if (!field) return "";
  return field.trim().replace(/^"+|"+$/g, "").replace(/""/g, '"');
}

// 🔤 دالة توحيد الأحرف والمعالجة الجذرية للأخطاء الإملائية والفرنكو
function normalizeText(text: string): string {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
}

// 🌐 دالة الترجمة الفورية باللغات الـ 5
async function translateText(text: string, targetLang: string): Promise<string> {
  try {
    const res = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=ar|${targetLang}`);
    const json = await res.json();
    return json.responseData?.translatedText || text;
  } catch (error) {
    return text;
  }
}

async function translateToAllLanguages(arabicText: string) {
  const [en, ur, ku, ckb] = await Promise.all([
    translateText(arabicText, "en"),
    translateText(arabicText, "ur"),
    translateText(arabicText, "ku"),
    translateText(arabicText, "ckb"),
  ]);
  return {
    "ARABIC": arabicText,
    "ENGLISH": en,
    "URDU": ur,
    "KURDISH — KURMANJI": ku,
    "KURDISH — SORANI": ckb
  };
}

// 📝 دالة تغذية الـ Google Sheet بالنص المدخل كاملاً للحفظ المستمر
async function appendNewScenarioToSheet(rawUserQuery: string, arabicResponse: string, translations: any) {
  try {
    const payload = {
      keyword: rawUserQuery,
      arabic: arabicResponse,
      english: translations["ENGLISH"] || "",
      urdu: translations["URDU"] || "",
      kurdishKurmanji: translations["KURDISH — KURMANJI"] || "",
      kurdishSorani: translations["KURDISH — SORANI"] || "",
    };

    await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow",
    });
  } catch (error) {
    console.error("Error logging to Google Sheet:", error);
  }
}

// 🧠 محرك التحليل والتعرف على الأحرف والأنماط بكافة أشكالها
function processResponse(rawInput: string, hasGreeting: boolean): string | null {
  const norm = normalizeText(rawInput);

  const greeting = hasGreeting 
    ? "وعليكم السلام ورحمة الله وبركاته! أهلاً بك،" 
    : "أهلاً بك،";

  // 1. 📍 كشف أشكال كتابة "المسافة البعيدة" بكافة الأحرف والفرانكو والأخطاء الإملائية
  const distanceKeywords = [
    "مسافه", "مسافة", "المسافه", "المسافة",
    "بعيد", "بعيده", "بعيدة", "بعيدره", "ب عيد",
    "distance", "far", "long",
    "masafa", "msafa", "masafeh", "msafeh",
    "ba3id", "ba3ida", "ba3ideh"
  ];

  const isDistanceIssue = distanceKeywords.some((kw) => norm.includes(normalizeText(kw)));

  if (isDistanceIssue) {
    return `${greeting} يرجى الانتظار لحظات بينما نقوم بمراجعة مسافة الطلب والموقع والتحقق من التفاصيل فوراً.`;
  }

  // 2. 🎒 مشكلة التجهيزات والمعدات / تلف الباوتش أو الصندوق (Equipment Damage)
  const equipmentKeywords = [
    "باوتش", "pouch", "box", "صندوق", "مقطوع", "تالف", "مكسور", "ينكسر", "معدات"
  ];
  if (equipmentKeywords.some((kw) => norm.includes(normalizeText(kw)))) {
    return `${greeting} نعتذر عن المشكلة المتعلقة بتلف الحقيبة/الباوتش. يرجى الانتظار لحظات بينما نقوم بإعادة تحويل الطلب لسائق آخر لحماية الشحنة فوراً.`;
  }

  // 3. ☕ طلب استراحة / راحة / صلاة (Break Request)
  const breakKeywords = [
    "راحه", "راحة", "استراحه", "استراحة", "break", "صلاه", "صلاة", "غداء", "بريك"
  ];
  if (breakKeywords.some((kw) => norm.includes(normalizeText(kw)))) {
    return `${greeting} تم استلام طلب الاستراحة. يرجى التأكد من عدم وجود طلبات نشطة حالياً، وسنساعدك في تفعيل أوقات الراحة فوراً.`;
  }

  // 4. 📦 طلب كبير / Large Order / الشنطة مش واخدة الطلب
  const isLargeOrder = 
    norm.includes("bag") || 
    norm.includes("fit") || 
    norm.includes("large") || 
    norm.includes("big") || 
    norm.includes("حجم") || 
    norm.includes("كبير") || 
    norm.includes("شنطه") || 
    norm.includes("حقيبه") ||
    (norm.includes("car") && norm.includes("order"));

  if (isLargeOrder) {
    return `${greeting} نعتذر عن كبر حجم الطلب (Large Order) وعدم اتساعه للحقيبة. يرجى الانتظار لحظات بينما نقوم بإعادة تعيين سائق سيارة (Car Rider) لنقل الطلب فوراً.`;
  }

  // 5. 🛠️ عطل أو حادث مركبة فقط
  if (norm.includes("عطل") || norm.includes("موتور") || norm.includes("بنشر") || norm.includes("حادث") || norm.includes("breakdown")) {
    return `${greeting} نرجو أن تكون بخير. يرجى إفادتنا هل الطلب معك الآن ليتسنى لنا اتخاذ الإجراء المناسب وتفريغك لإصلاح المركبة.`;
  }

  // 6. 👤 رفض التسليم / مشاكل العميل
  if (norm.includes("عميل") || norm.includes("استلمش") || norm.includes("رفض") || norm.includes("تواصل")) {
    return `${greeting} نعتذر عن الصعوبة في التواصل أو التسليم للعميل. يرجى محاولة التواصل معه مجدداً، ونحن نتابع حالة الطلب معكم الآن.`;
  }

  // 7. 🔑 كود التسليم / الإرجاع
  if (norm.includes("كود") || norm.includes("pin") || norm.includes("رمز")) {
    return `${greeting} يرجى الانتظار لحظات لمساعدتك في الحصول على الكود الخاص بالتسليم/الإرجاع فوراً.`;
  }

  // 8. 🎟️ القسائم والخصومات وسعر الطلب
  if (norm.includes("قسيمه") || norm.includes("voucher") || norm.includes("خصم") || norm.includes("سعر الطلب")) {
    return `${greeting} يرجى الانتظار لحظات بينما أقوم بمراجعة سعر الطلب والقسيمة أو الخصم وتحديث التفاصيل فوراً.`;
  }

  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryParam = searchParams.get("query") || "";
  const normInput = normalizeText(queryParam);

  if (!normInput) {
    return NextResponse.json({ status: "error", message: "Query is empty" });
  }

  const greetingKeywords = [
    "سلام", "سلام عليكم", "السلام عليكم", 
    "السلام عليكم ورحمه الله وبركاته", "مرحبا", "أهلا", "اهلا", "صباح الخير", "مساء الخير"
  ];

  const hasGreetingInInput = greetingKeywords.some((g) => normInput.includes(normalizeText(g)));

  // 1️⃣ المعالجة بالقواعد التراكمية مع مطابقة الأحرف المتعددة
  const customResponse = processResponse(queryParam, hasGreetingInInput);

  if (customResponse) {
    const translations = await translateToAllLanguages(customResponse);
    await appendNewScenarioToSheet(queryParam, customResponse, translations);
    return NextResponse.json({
      status: "success",
      data: translations,
    });
  }

  // 2️⃣ القراءة من الشيت للسيناريوهات المفهرسة سابقاً
  try {
    const res = await fetch(GOOGLE_SHEET_CSV_URL, { cache: "no-store" });
    const csvText = await res.text();

    if (!csvText.includes("<!DOCTYPE html>") && !csvText.includes("<html")) {
      const lines = csvText.split("\n").filter((l) => l.trim() !== "");

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cleanCSVField);
        if (row.length > 0 && row[0]) {
          const sheetKeyword = normalizeText(row[0]);
          
          if (normInput === sheetKeyword && !sheetKeyword.includes("سلام")) {
            return NextResponse.json({
              status: "success",
              data: {
                "ARABIC": row[1],
                "ENGLISH": row[2] || "Hello! How can I assist you today?",
                "URDU": row[3] || "ہیلو! میں آپ کی کیسے مدد کر سکتا ہوں؟",
                "KURDISH — KURMANJI": row[4] || "Silav! Ez çawa dikarim alîkariya we bikim?",
                "KURDISH — SORANI": row[5] || "سڵاو! چۆن دەتوانم یارمەتیدەر بم؟",
              },
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Sheet error:", error);
  }

  // 3️⃣ الرد القياسي المعتمد في حالة عدم وضوح الرسالة (Unclear Inquiry Standard)
  const defaultResponse = hasGreetingInInput 
    ? "وعليكم السلام ورحمة الله وبركاته! أهلاً بك، كيف يمكنني مساعدتك اليوم؟" 
    : "أهلاً بك، كيف يمكنني مساعدتك اليوم؟";

  const translations = await translateToAllLanguages(defaultResponse);
  await appendNewScenarioToSheet(queryParam, defaultResponse, translations);

  return NextResponse.json({
    status: "success",
    data: translations,
  });
}