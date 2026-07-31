export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { fileUrl } = req.body;

  if (!fileUrl) {
    return res.status(400).json({ error: 'لم يتم استلام رابط الملف الصوتي' });
  }

  try {
    const token = process.env.REPLICATE_API_TOKEN;
    
    // التعديل السحري: استخدام الرابط المباشر لأحدث إصدار من موديل Spleeter المفتوح
    const startRes = await fetch("https://api.replicate.com/v1/models/cjwbw/spleeter/predictions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        input: {
          audio: fileUrl,
          stems: 2 
        }
      })
    });

    if (!startRes.ok) {
      const errTxt = await startRes.text();
      return res.status(startRes.status).json({ error: "رفض السيرفر الطلب: " + errTxt });
    }

    let prediction = await startRes.json();
    const getUrl = prediction.urls.get;

    while (prediction.status !== "succeeded" && prediction.status !== "failed") {
      await new Promise(resolve => setTimeout(resolve, 4000));
      const checkRes = await fetch(getUrl, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });
      prediction = await checkRes.json();
    }

    if (prediction.status === "failed") {
       return res.status(500).json({ error: "فشلت عملية العزل داخل Replicate" });
    }

    return res.status(200).json({ output: prediction.output });

  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}
