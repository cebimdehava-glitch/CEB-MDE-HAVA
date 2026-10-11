
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Bu endpoint POST isteği bekliyor."
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "OPENAI_API_KEY Vercel ortam değişkenlerinde tanımlı değil."
    });
  }

  try {
    const body = req.body || {};
    const message = typeof body.message === "string"
      ? body.message.trim()
      : "";

    if (!message || message.length > 500) {
      return res.status(400).json({
        error: "Mesaj boş olamaz ve en fazla 500 karakter olabilir."
      });
    }

    const context = body.context &&
      typeof body.context === "object"
      ? body.context
      : {};

    const response = await fetch(
      "https://api.openai.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content:
                "Sen Ayaz'sın, Talha'nın mahalle meteoroloğusun. " +
                "Türkçe konuş, kısa ve samimi cevap ver. " +
                "Uygun olduğunda kanka kelimesini kullan. " +
                "Hava durumu sorularında aşağıdaki verileri kullan. " +
                "Verilmeyen hava bilgilerini uydurma.\n\n" +
                "Seçili şehrin hava durumu bağlamı:\n" +
                JSON.stringify(context)
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.7,
          max_tokens: 300
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error("OpenAI hata kodu:", response.status);
      return res.status(502).json({
        error: "OpenAI bağlantısı başarısız. API erişimini ve faturalandırmayı kontrol et."
      });
    }

    const reply = data.choices?.[0]?.message?.content;

    if (!reply) {
      return res.status(502).json({
        error: "Ayaz şu anda cevap üretemedi."
      });
    }

    return res.status(200).json({
      reply: reply.trim()
    });
  } catch (error) {
    console.error("Ayaz API hatası:", error);

    return res.status(500).json({
      error: "Sunucu hatası oluştu. Biraz sonra tekrar dene."
    });
  }
}
