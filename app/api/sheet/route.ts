import { NextResponse } from "next/server";

const GOOGLE_SHEET_CSV_URL = "https://docs.google.com/spreadsheets/d/1_9_2yJFa08udNQDm2wnxaYJwvshIgg1Vpre5Olj2k6s/gviz/tq?tqx=out:csv";
const GOOGLE_SHEET_WEBHOOK_URL = "https://script.google.com/macros/s/AKfycbyvfmBR4TaCwBYQGLIEr_nKWOzfRTVkpw0IF75IyeRBX3itm3uJenWOAT0QaQWRaNLpxg/exec";

// الرد الافتراضي لمعايير الجودة (Unclear Inquiry / Fallback)
const unclearInquiryResponses = {
  "ARABIC": "وعليكم السلام ورحمة الله وبركاته! أهلاً بك، كيف يمكنني مساعدتك اليوم؟",
  "ENGLISH": "Hello! How can I assist you today?",
  "URDU": "ہیلو! میں آپ کی کیسے مدد کر سکتا ہوں؟",
  "KURDISH — KURMANJI": "Silav! Ez çawa dikarim alîkariya we bikim?",
  "KURDISH — SORANI": "سڵاو! چۆن دەتوانم یارمەتیدەر بم؟"
};

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

  // إذا كانت الرسالة عبارة عن تحية فقط بدون أي كلمات تشغيلية أخرى
  if (greetingKeywords.some((g) => cleanInput === g)) {
    return NextResponse.json({ status: "success", data: unclearInquiryResponses });
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

          if (cleanInput === sheetKeyword && sheetResponse !== "" && sheetResponse !== unclearInquiryResponses["ARABIC"]) {
            return NextResponse.json({
              status: "success",
              data: {
                "ARABIC": row[1],
                "ENGLISH": row[2] || unclearInquiryResponses["ENGLISH"],
                "URDU": row[3] || unclearInquiryResponses["URDU"],
                "KURDISH — KURMANJI": row[4] || unclearInquiryResponses["KURDISH — KURMANJI"],
                "KURDISH — SORANI": row[5] || unclearInquiryResponses["KURDISH — SORANI"],
              },
            });
          }
        }
      }
    }
  } catch (error) {
    console.error("Fetch error from Sheet:", error);
  }

  // 3. 🧠 محرك التحليل التشغيلي المباشر مع دعم سيناريو الخصم والقسيمة وسعر الطلب
  let extractedKeyword = "";
  let baseArabicResponse = "";

  const hasCode = cleanInput.includes("كود") || cleanInput.includes("pin") || cleanInput.includes("رمز") || cleanInput.includes("الرقم");
  const hasStaff = cleanInput.includes("موظف") || cleanInput.includes("مشغول") || cleanInput.includes("مطعم") || cleanInput.includes("متجر");
  const hasCustomer = cleanInput.includes("عميل") || cleanInput.includes("زبون") || cleanInput.includes("مشتري");
  const hasMissing = cleanInput.includes("ناقص") || cleanInput.includes("مارت") || cleanInput.includes("tmart") || cleanInput.includes("مش كامل");
  const hasCancel = cleanInput.includes("الغ") || cleanInput.includes("إلغاء") || cleanInput.includes("يلغي") || cleanInput.includes("مش عاوزه") || cleanInput.includes("رفض");
  const hasBreakdown = cleanInput.includes("عطل") || cleanInput.includes("موتور") || cleanInput.includes("سلسلة") || cleanInput.includes("محرك") || cleanInput.includes("كاوتش") || cleanInput.includes("بنشر") || cleanInput.includes("اتكسرت");
  
  // 🏷️ إضافة فحص استفسارات القسيمة والخصم وسعر الطلب
  const hasVoucherOrDiscount = cleanInput.includes("قسيمه") || cleanInput.includes("قسيمة") || cleanInput.includes("voucher") || cleanInput.includes("خصم") || cleanInput.includes("بطاقه خصم") || cleanInput.includes("بطاقة خصم") || cleanInput.includes("سعر الطلب") || cleanInput.includes("مبلغ");

  // 🎯 منطق قواعد الـ SOPs للجودة 10/10:
  if (hasVoucherOrDiscount) {
    // 🏷️ مراجعة القسيمة أو الخصم أو سعر الطلب
    extractedKeyword = "قسيمة/خصم/سعر الطلب";
    baseArabicResponse = "يرجى الانتظار لحظات بينما أقوم بمراجعة سعر الطلب والقسيمة أو الخصم المستخدم مع العميل وتحديث التفاصيل فوراً.";
  } else if (hasCode && hasStaff) {
    // 🔄 رحلة إرجاع (كود + موظف/مشغول/مطعم)
    extractedKeyword = "كود إرجاع مطعم";
    baseArabicResponse = "يرجى الانتظار لحظات بينما أقوم بالتواصل مع موظف المطعم/المتجر ومساعدتك للحصول على الكود المخصص لإتمام عملية الإرجاع فوراً.";
  } else if (hasCode && (hasCustomer || !hasStaff)) {
    // 🚚 رحلة تسليم عميل (كود + عميل)
    extractedKeyword = "كود تسليم عميل";
    baseArabicResponse = "يرجى الانتظار لحظات بينما أقوم بالتحقق من كود التسليم الخاص بالطلب ومساعدتك للحصول عليه فوراً لتسليم الطلب.";
  } else if (hasMissing) {
    // 🛒 أصناف مفقودة / المارت
    extractedKeyword = "أصناف مفقودة/مارت";
    baseArabicResponse = "يرجى الانتظار لحظات بينما أقوم بالتواصل مع إدارة المارت للتأكد من تفاصيل الأصناف المفقودة ومعالجة الطلب فوراً.";
  } else if (hasCancel) {
    // 🛑 طلب إلغاء
    extractedKeyword = "إلغاء عميل";
    baseArabicResponse = "يرجى التوجه لموقع العميل والتواصل معه لتسليم الطلب، وسنتحقق فوراً من حالة الطلب وملاحظات العميل والتواصل معه لإفادتك.";
  } else if (hasBreakdown) {
    // 🔧 عطل مركبة
    extractedKeyword = "عطل مركبة";
    baseArabicResponse = "نرجو أن يكون عطلاً بسيطاً. يرجى إفادتنا هل الطلب معك الآن ليتسنى لنا اتخاذ الإجراء المناسب ومساعدتك للتفرغ لإصلاح مركبتك.";
  }

  // 4. تركيب الرد العربي مع التحية اللبقة المناسبة
  if (baseArabicResponse !== "") {
    let finalArabicText = "";

    if (hasGreetingInInput) {
      finalArabicText = `وعليكم السلام ورحمة الله وبركاته! أهلاً بك، ${baseArabicResponse}`;
    } else {
      finalArabicText = `أهلاً بك! ${baseArabicResponse}`;
    }

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

  // 5. الرد الافتراضي
  return NextResponse.json({
    status: "success",
    data: unclearInquiryResponses,
  });
}