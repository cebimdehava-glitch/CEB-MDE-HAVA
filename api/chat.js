
module.exports = async (req, res) => {
  // Sadece POST isteklerine izin ver
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({
      error: "Sadece POST isteği kabul edilir."
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      error: "GEMINI_API_KEY Vercel ortam değişkenlerinde tanımlı değil."
    });
  }

  try {
    const { message, context } = req.body || {};

    if (
      typeof message !== "string" ||
      !message.trim()
    ) {
      return res.status(400).json({
        error: "Lütfen Ayaz'a bir soru yaz."
      });
    }

    const weatherContext = context
      ? JSON.stringify(context).slice(0, 6000)
      : "Henüz hava durumu verisi yok.";
      const prompt = `
Sen Ayaz'sın. Cebimde Hava internet sitesinin
Türkçe konuşan hava durumu asistanısın.

Kurallar:
- Daima Türkçe cevap ver.
- Samimi, anlaşılır ve kısa cevaplar yaz.
- Verilen hava durumu verilerini kullan.
- Veride olmayan sıcaklık, yağış veya tahmin bilgilerini uydurma.
- Güncel bilgi yoksa bunu açıkça belirt.
- Kullanıcıya hava koşullarına uygun pratik öneriler ver.

Sitenin hava durumu verileri:
${weatherContext}

Kullanıcının sorusu:
${message.trim()}
`;

    
let response;

for (let attempt = 0; attempt < 3; attempt++) {
  response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey
      },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 700
        }
      })
    }
  );

  if (response.status !== 503 && response.status !== 429) {
    break;
  }

  if (attempt < 2) {
    await new Promise(resolve =>
      setTimeout(resolve, 2000 * (attempt + 1))
    );
  }
}


const raw = await response.text();

let data;

try {
  data = JSON.parse(raw);

} catch (error) {
  console.error("Gemini geçersiz yanıt:", raw.slice(0, 500));

  return res.status(502).json({
    error: "Yapay zekâ sunucusundan geçersiz yanıt geldi."
  });
}
    if (!response.ok) {
      console.error("Gemini API hatası:", response.status, data);

      return res.status(502).json({
        error:
          data.error?.message ||
          "Gemini bağlantısı başarısız. API anahtarını ve kullanım limitini kontrol et."
      });
    }

    const reply = data.candidates?.[0]?.content?.parts
      ?.map(part => part.text || "")
      .join("")
      .trim();

    if (!reply) {
      return res.status(502).json({
        error: "Gemini boş cevap verdi. Lütfen tekrar dene."
      });
    }

    return res.status(200).json({ reply });

  } catch (error) {
    console.error("Ayaz sunucu hatası:", error);

    return res.status(500).json({
      error: "Ayaz şu anda cevap veremiyor. Lütfen tekrar dene."
    });
  }
};
