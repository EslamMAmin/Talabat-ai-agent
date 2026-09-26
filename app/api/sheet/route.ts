import { NextResponse } from "next/server";

const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1_9_2yJFa08udNQDm2wnxaYJwvshIgg1Vpre5Olj2k6s/gviz/tq?tqx=out:csv";
const GOOGLE_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyvfmBR4TaCwBYQGLIEr_nKWOzfRTVkpw0IF75IyeRBX3itm3uJenWOAT0QaQWRaNLpxg/exec";

function cleanCSVField(field: string): string {
  if (!field) return "";
  return field.trim().replace(/^"+|"+$/g, "").replace(/""/g, '"');
}

// 🌐 دالة الترجمة الفورية
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
  return { en, ur, ku, ckb };
}

// 📝 دالة حفظ السطر الجديد في Google Sheet
async function appendNewScenarioToSheet(keyword: string, arabicResponse: string, customTranslations?: any) {
  try {
    let translations = customTranslations;
    if (!translations) {
      translations = await translateToAllLanguages(arabicResponse);
    }

    const payload = {
      keyword: keyword,
      arabic: arabicResponse,
      english: translations.en || translations["ENGLISH"] || "",
      urdu: translations.ur || translations["URDU"] || "",
      kurdishKurmanji: translations.ku || translations["KURDISH — KURMANJI"] || "",
      kurdishSorani: translations.ckb || translations["KURDISH — SORANI"] || "",
    };

    await fetch(GOOGLE_SHEET_WEBHOOK_URL, {
      method: "POST",
      mode: "no-cors",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    console.error("Error appending to Sheet:", error);
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const queryParam = searchParams.get("query") || "";
  const cleanInput = queryParam.toLowerCase().trim();

  // 1. فحص وجود التحية في نص رسالة المندوب
  const greetingKeywords = [
    "سلام", "سلام عليكم", "السلام عليكم", 
    "السلام عليكم ورحمة الله وبركاته", "السلام عليكم ورحمة الله وبركاتو", 
    "مرحبا", "أهلا", "اهلا", "صباح الخير", "مساء الخير"
  ];

  const hasGreetingInInput = greetingKeywords.some((g) => cleanInput.includes(g));

  // إعداد الرد المباشر بناءً على وجود السلام من عدمه لتجنب خطأ التقييم
  const baseGreeting = hasGreetingInInput 
    ? "وعليكم السلام ورحمة الله وبركاته! أهلاً بك،" 
    : "أهلاً بك، تم استلام استفسارك.";

  const fallbackResponses = {
    "ARABIC": `${baseGreeting} كيف يمكنني مساعدتك اليوم؟`,
    "ENGLISH": "Hello! How can I assist you today?",
    "URDU": "ہیلو! میں آپ کی کیسے مدد کر سکتا ہوں؟",
    "KURDISH — KURMANJI": "Silav! Ez çawa dikarim alîkariya we bikim?",
    "KURDISH — SORANI": "سڵاو! چۆن دەتوانم یارمەتیدەر بم؟"
  };

  // إذا كانت الرسالة عبارة عن تحية فقط
  if (greetingKeywords.some((g) => cleanInput === g)) {
    return NextResponse.json({ status: "success", data: fallbackResponses });
  }

  // 2. 🟢 المحاولة الأولى: قراءة مطابقة صريحة من Google Sheet
  try {
    const res = await fetch(GOOGLE_SHEET_CSV_URL, { cache: "no-store" });
    const csvText = await res.text();

    if (!csvText.includes("<!DOCTYPE html>") && !csvText.includes("<html")) {
      const lines = csvText.split("\n").filter((l) => l.trim() !== "");

      for (let i = 1; i < lines.length; i++) {
        const row = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(cleanCSVField);
        if (row.length > 0 && row[0]) {
          const sheetKeyword = row[0].toLowerCase().trim();
          const sheetResponse = row[1] ? row[1].trim() : "";

          if (cleanInput === sheetKeyword && sheetResponse !== "") {
            return NextResponse.json({
              status: "success",
              data: {
                "ARABIC": row[1],
                "ENGLISH": row[2] || fallbackResponses["ENGLISH"],
                "URDU": row[3] || fallbackResponses["URDU"],
                "KURDISH — KURMANJI": row[4] || fallbackResponses["KURDISH — KURMANJI"],
                "KURDISH — SORANI": row[5] || fallbackResponses["KURDISH — SORANI"],
              },
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Fetch error from Sheet:", error);
  }

  // 3. 🧠 محرك التحليل التشغيلي المباشر (إضافة سيناريو مشاكل التواصل ورفض الاستلام)
  let extractedKeyword = "";
  let baseArabicResponse = "";

  const hasCode = cleanInput.includes("كود") || cleanInput.includes("pin") || cleanInput.includes("رمز") || cleanInput.includes("الرقم");
  const hasStaff = cleanInput.includes("موظف") || cleanInput.includes("مشغول") || cleanInput.includes("مطعم") || cleanInput.includes("متجر");
  const hasCustomer = cleanInput.includes("عميل") || cleanInput.includes("زبون") || cleanInput.includes("مشتري");
  const hasMissing = cleanInput.includes("ناقص") || cleanInput.includes("مارت") || cleanInput.includes("tmart") || cleanInput.includes("مش كامل");
  const hasCancel = cleanInput.includes("الغ") || cleanInput.includes("إلغاء") || cleanInput.includes("يلغي") || cleanInput.includes("مش عاوزه") || cleanInput.includes("رافض") || cleanInput.includes("رفض") || cleanInput.includes("استلمش") || cleanInput.includes("مسلمه");
  const hasBreakdown = cleanInput.includes("عطل") || cleanInput.includes("موتور") || cleanInput.includes("سلسلة") || cleanInput.includes("محرك") || cleanInput.includes("كاوتش") || cleanInput.includes("بنشر") || cleanInput.includes("اتكسرت");
  const hasVoucherOrDiscount = cleanInput.includes("قسيمه") || cleanInput.includes("قسيمة") || cleanInput.includes("voucher") || cleanInput.includes("خصم") || cleanInput.includes("بطاقه خصم") || cleanInput.includes("بطاقة خصم") || cleanInput.includes("سعر الطلب") || cleanInput.includes("مبلغ");

  // 🎯 منطق قواعد الـ SOPs للجودة 10/10:
  if (hasVoucherOrDiscount) {
    extractedKeyword = "قسيمة/خصم/سعر الطلب";
    baseArabicResponse = "يرجى الانتظار لحظات بينما أقوم بمراجعة سعر الطلب والقسيمة أو الخصم المستخدم مع العميل وتحديث التفاصيل فوراً.";
  } else if (hasCode && hasStaff) {
    extractedKeyword = "كود إرجاع مطعم";
    baseArabicResponse = "يرجى الانتظار لحظات بينما أقوم بالتواصل مع موظف المطعم/المتجر ومساعدتك للحصول على الكود المخصص لإتمام عملية الإرجاع فوراً.";
  } else if (hasCode && (hasCustomer || !hasStaff)) {
    extractedKeyword = "كود تسليم عميل";
    baseArabicResponse = "يرجى الانتظار لحظات بينما أقوم بالتحقق من كود التسليم الخاص بالطلب ومساعدتك للحصول عليه فوراً لتسليم الطلب.";
  } else if (hasMissing) {
    extractedKeyword = "أصناف مفقودة/مارت";
    baseArabicResponse = "يرجى الانتظار لحظات بينما أقوم بالتواصل مع إدارة المارت للتأكد من تفاصيل الأصناف المفقودة ومعالجة الطلب فوراً.";
  } else if (hasCancel) {
    extractedKeyword = "مشكلة تسليم/رفض عميل";
    baseArabicResponse = "نعتذر عن الصعوبة التي تواجهها مع العميل. يرجى تزويدنا برقم الطلب (Order ID) ومحاولة التواصل مع العميل، وسنتحقق فوراً من حالة الطلب ومساعدتك لإنهاء الإجراء.";
  } else if (hasBreakdown) {
    extractedKeyword = "عطل مركبة";
    baseArabicResponse = "نرجو أن يكون عطلاً بسيطاً. يرجى إفادتنا هل الطلب معك الآن ليتسنى لنا اتخاذ الإجراء المناسب ومساعدتك للتفرغ لإصلاح مركبتك.";
  }

  // 4. تركيب الرد العربي مع التحية الدقيقة
  if (baseArabicResponse !== "") {
    let finalArabicText = `${baseGreeting} ${baseArabicResponse}`;

    const dynamicTranslations = await translateToAllLanguages(finalArabicText);
    await appendNewScenarioToSheet(extractedKeyword, finalArabicText, dynamicTranslations);

    return NextResponse.json({
      status: "success",
      data: {
        "ARABIC": finalArabicText,
        "ENGLISH": dynamicTranslations.en,
        "URDU": dynamicTranslations.ur,
        "KURDISH — KURMANJI": dynamicTranslations.ku,
        "KURDISH — SORANI": dynamicTranslations.ckb,
      },
    });
  }

  // 5. الرد الافتراضي المعدل
  return NextResponse.json({
    status: "success",
    data: fallbackResponses,
  });
}