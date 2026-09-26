"use client";

import React, { useState, useEffect } from "react";
import kbData from "../knowledgeBase.json";

interface SheetMultiLangResponse {
  keyword: string;
  ar: string;
  en: string;
  ur: string;
  kurmanji: string;
  sorani: string;
}

const defaultGreetingResponses = {
  ar: "وعليكم السلام ورحمة الله وبركاته. أهلاً بك! كيف يمكنني مساعدتك اليوم؟",
  en: "Peace be upon you too! Welcome to Talabat Support. How can I assist you today?",
  ur: "وعلیکم السلام ورحمة اللہ وبرکاتہ۔ طالبات سپورٹ میں خوش آمدید! میں آج آپ کی کیا مدد کر سکتا ہوں؟",
  kurmanji: "Silav û rêz! Hûn bi xêr hatin piştgiriya Talabat. Ez çawa dikarim îro alîkariya we bikim?",
  sorani: "سڵاو و ڕێز! بەخێربێن بۆ پشتیوانی تەڵەبات. چۆن دەتوانم ئەمڕۆ یارمەتیدەر بم؟",
};

function normalizeArabic(text: string): string {
  return text
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/[\u064B-\u0652]/g, "")
    .replace(/\s+/g, " ");
}

export default function Home() {
  const [userName] = useState("Eslam Hafez");
  const [mode, setMode] = useState<"chat" | "first-response">("first-response");
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [copiedLang, setCopiedLang] = useState<string | null>(null);

  const [responses, setResponses] = useState<{
    ar: string;
    en: string;
    ur: string;
    kurmanji: string;
    sorani: string;
  } | null>(null);

  const [sheetData, setSheetData] = useState<SheetMultiLangResponse[]>([]);

  useEffect(() => {
    async function fetchSheetData() {
      try {
        const res = await fetch("/api/sheet");
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data)) setSheetData(data);
        }
      } catch (error) {
        console.error("Error fetching sheet data:", error);
      }
    }
    fetchSheetData();
  }, []);

  // دالة الإرسال المحدثة لربط الشيت المباشر والردود باللغات الخمس
  const handleSend = async () => {
    if (!input.trim()) return;
    setLoading(true);
    setResponses(null);

    try {
      // 1. استدعاء API الـ Sheet بـ GET مع الجملة المدخلة
      const res = await fetch(`/api/sheet?query=${encodeURIComponent(input.trim())}`);
      const result = await res.json();

      if (result.status === "success" && result.data) {
        // 2. تحديث الإجابات مباشرة باللغات الخمس من الشيت الجديد
        setResponses({
          ar: result.data["ARABIC"],
          en: result.data["ENGLISH"],
          ur: result.data["URDU"],
          kurmanji: result.data["KURDISH — KURMANJI"],
          sorani: result.data["KURDISH — SORANI"],
        });
      } else {
        // fallback في حال حدث خطأ أثر الاستجابة
        setResponses(defaultGreetingResponses);
      }
    } catch (err) {
      console.error("Error updating responses:", err);
      setResponses(defaultGreetingResponses);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text: string, langKey: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedLang(langKey);
    setTimeout(() => setCopiedLang(null), 2000);
  };

  const languagesList = [
    { key: "ar", label: "ARABIC", text: responses?.ar, isRtl: true },
    { key: "en", label: "ENGLISH", text: responses?.en, isRtl: false },
    { key: "ur", label: "URDU", text: responses?.ur, isRtl: true },
    { key: "kurmanji", label: "KURDISH — KURMANJI", text: responses?.kurmanji, isRtl: false },
    { key: "sorani", label: "KURDISH — SORANI", text: responses?.sorani, isRtl: true },
  ];

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#F4EDE3",
        color: "#41151F",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        fontFamily: "var(--font-poppins), sans-serif",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
        }}
      >
        {/* Header Section */}
        <div
          style={{
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              marginBottom: "12px",
              height: "50px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <img
              src="/logo.png"
              alt="Talabat Logo"
              width={200}
              height={44}
              style={{
                maxHeight: "44px",
                maxWidth: "200px",
                objectFit: "contain",
                display: "block",
                margin: "0 auto",
              }}
            />
          </div>

          <h1 style={{ fontSize: "22px", fontWeight: 900, margin: "0" }}>
            <span style={{ fontWeight: 800 }}>Hi, </span>
            <span
              style={{
                fontWeight: 900,
                textDecoration: "underline",
                textDecorationColor: "#FF5900",
              }}
            >
              {userName}
            </span>
          </h1>

          <p
            style={{
              fontSize: "12px",
              fontWeight: 600,
              opacity: 0.75,
              marginTop: "4px",
            }}
          >
            Knowledge Base & Multi-Language First Response
          </p>
        </div>

        {/* Output Box - Multi-Language Cards */}
        {responses && (
          <div
            style={{
              width: "100%",
              maxHeight: "380px",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
              paddingRight: "4px",
            }}
          >
            {languagesList.map((lang) => (
              <div
                key={lang.key}
                style={{
                  backgroundColor: "#F9F6F0",
                  borderRadius: "16px",
                  padding: "14px 16px",
                  border: "1px solid #EAE3D9",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  boxShadow: "0 2px 4px rgba(0, 0, 0, 0.02)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: "800",
                      color: "#FF5900",
                      letterSpacing: "0.5px",
                    }}
                  >
                    {lang.label}
                  </span>

                  <button
                    type="button"
                    onClick={() => handleCopy(lang.text || "", lang.key)}
                    style={{
                      backgroundColor: "#ffffff",
                      color: "#FF5900",
                      border: "1px solid #FF5900",
                      borderRadius: "20px",
                      padding: "4px 12px",
                      fontSize: "11px",
                      fontWeight: "700",
                      cursor: "pointer",
                      fontFamily: "var(--font-poppins), sans-serif",
                    }}
                  >
                    {copiedLang === lang.key ? "Copied!" : "Copy"}
                  </button>
                </div>

                <p
                  style={{
                    fontSize: "13px",
                    fontWeight: 400,
                    lineHeight: "1.6",
                    margin: 0,
                    color: "#41151F",
                    direction: lang.isRtl ? "rtl" : "ltr",
                    textAlign: lang.isRtl ? "right" : "left",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {lang.text}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Input Box */}
        <div
          style={{
            width: "100%",
            backgroundColor: "#ffffff",
            borderRadius: "24px",
            padding: "16px",
            boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
            border: "1px solid #f3f4f6",
            boxSizing: "border-box",
          }}
        >
          <textarea
            rows={3}
            value={input}
            disabled={loading}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Paste rider or vendor chat here..."
            style={{
              width: "100%",
              resize: "none",
              outline: "none",
              border: "none",
              fontSize: "14px",
              fontWeight: 300,
              fontFamily: "var(--font-poppins), sans-serif",
              color: "#41151F",
              boxSizing: "border-box",
            }}
          />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              paddingTop: "12px",
              borderTop: "1px solid #f3f4f6",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                backgroundColor: "#F4EDE3",
                padding: "4px",
                borderRadius: "12px",
                fontSize: "12px",
              }}
            >
              <button
                type="button"
                onClick={() => setMode("chat")}
                style={{
                  padding: "6px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: mode === "chat" ? "#ffffff" : "transparent",
                  color: mode === "chat" ? "#41151F" : "#6b7280",
                  fontWeight: mode === "chat" ? 700 : 500,
                  fontFamily: "var(--font-poppins), sans-serif",
                }}
              >
                Ask KB
              </button>
              <button
                type="button"
                onClick={() => setMode("first-response")}
                style={{
                  padding: "6px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor:
                    mode === "first-response" ? "#FF5900" : "transparent",
                  color: mode === "first-response" ? "#ffffff" : "#6b7280",
                  fontWeight: mode === "first-response" ? 700 : 500,
                  fontFamily: "var(--font-poppins), sans-serif",
                }}
              >
                ⚡ First response
              </button>
            </div>

            <button
              type="button"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              style={{
                backgroundColor: "#FF5900",
                color: "#ffffff",
                border: "none",
                borderRadius: "50%",
                width: "44px",
                height: "44px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                opacity: loading || !input.trim() ? 0.5 : 1,
              }}
            >
              {loading ? (
                <div
                  style={{
                    width: "18px",
                    height: "18px",
                    border: "2px solid #ffffff",
                    borderTopColor: "transparent",
                    borderRadius: "50%",
                  }}
                />
              ) : (
                <svg
                  style={{ width: "20px", height: "20px" }}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2.5"
                    d="M14 5l7 7m0 0l-7 7m7-7H3"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}