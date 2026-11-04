# 🚀 PhoneZone ERP - Render.com Full Noob Hosting Guide (100% Free)

यह गाइड किसी भी बिगिनर (Noob) के लिए बनाई गई है ताकि आप PhoneZone ERP को **Render.com** पर बिना किसी परेशानी या एरर के 100% फ़्री में लाइव होस्ट कर सकें।

---

## 📌 Render पर क्या-क्या चलेगा?
- **Frontend (React + Vite)**: आपका पूरा स्टोर और एडमिन पैनल।
- **Backend (Node.js + Express API)**: सारे इनवॉइस, रिपेयर्स, इन्वेंटरी, IMEI और बैकअप सर्विसेज।
- **Cloud Database (Supabase)**: सुरक्षित और परमानेंट डेटा स्टोरेज जो कभी रीसेट नहीं होगा।

---

## 🛠️ Step-by-Step Setup Guide (5 आसान चरण)

### चरण 1: GitHub और Render Account
1. [github.com](https://github.com/) पर लॉगिन रखें जहाँ आपकी रिपॉज़िटरी `mailtempry9211-byte/phone-zone-` है।
2. [dashboard.render.com](https://dashboard.render.com/) पर जाएँ और **GitHub से Sign In** करें।

---

### चरण 2: New Web Service बनाएँ
1. Render डैशबोर्ड पर ऊपर दाईं ओर **New +** बटन दबाएँ।
2. **Web Service** चुनें।
3. **Build and deploy from a Git repository** चुनें → **Next** दबाएँ।
4. अपनी रिपॉज़िटरी `phone-zone-` को **Connect** करें।

---

### चरण 3: सेटिंग्स भरें (Exact Values)

| फ़ील्ड (Field) | क्या भरना है (Value) |
|---|---|
| **Name** | `phonezone-erp` (या अपनी पसंद का नाम) |
| **Region** | `Singapore` (भारत में सबसे तेज़ स्पीड के लिए) |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm run render:build` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` ($0/month) |

---

### चरण 4: Environment Variables (ज़रूरी सेटिंग्स)
नीचे **Advanced** पर क्लिक करें और **Add Environment Variable** दबाकर ये कीज़ जोड़ें:

| Key | Value | विवरण |
|---|---|---|
| `NODE_VERSION` | `20.18.0` | **(अति-आवश्यक)** Node 20 LTS - Node 24 क्रैश रोकता है |
| `NODE_ENV` | `production` | प्रोडक्शन मोड |
| `PORT` | `10000` | Render का इंटरनल पोर्ट |
| `RENDER` | `true` | Render डिटेक्शन |
| `PHONEZONE_OFFLINE` | `true` | बैकएंड API इनेबल |
| `PHONEZONE_ADMIN_PASSWORD` | `Admin@12345` | आपका एडमिन पासवर्ड |
| `JWT_SECRET` | `phonezone_super_secret_jwt_key_2026` | टोकन सुरक्षा |
| `SUPABASE_URL` | *(Supabase Project URL)* | अगर Supabase इस्तेमाल कर रहे हैं |
| `SUPABASE_ANON_KEY` | *(Supabase Anon Key)* | अगर Supabase इस्तेमाल कर रहे हैं |

---

### चरण 5: Deploy Web Service
1. सबसे नीचे **Create Web Service** बटन पर क्लिक करें।
2. 3 से 4 मिनट में बिल्ड प्रोसेस पूरा होगा और स्टेटस **Live** हो जाएगा!
3. ऊपर आपको आपका परमानेंट लाइव लिंक मिल जाएगा:
   👉 **`https://phonezone-erp.onrender.com`**

---

## ⚠️ Render Common Errors & 100% Working Fixes

### Error 1: "Exited with status 1 while building your code (Node 24 / Vite Not Found)"
- **कारण**:
  1. Render ने अपने आप **Node.js 24.22.1** चुन लिया था। Node 24 में Linux के लिए `better-sqlite3` और `sharp` के प्रीबिल्ट बाइनरी नहीं होते, जिससे npm install फ़ेल हो जाता है।
  2. `NODE_ENV=production` सेट होने पर npm install बाय डिफ़ॉल्ट `vite` और `typescript` को छोड़ देता है।
- **100% परमानेंट समाधान**:
  1. हमने रिपॉज़िटरी में `.node-version` और `.nvmrc` फ़ाइल बनाकर Node 20.18.0 फ़िक्स कर दिया है।
  2. `package.json` में `vite`, `typescript`, `tailwindcss` को सीधे कोर `dependencies` में डाल दिया है।
  3. Environment Variables में `NODE_VERSION` = `20.18.0` रखें और Build Command में `npm run render:build` रखें।

---

### Error 2: "Rollup failed to resolve import src/lib/data/config (ENOENT)"
- **असली कारण (Root Cause)**:
  `.gitignore` में `data/` लिखा हुआ था, जिससे Git ने रूट के डाटा फ़ोल्डर के साथ-साथ कोड फ़ोल्डर `src/lib/data/` (`config.ts`, `index.ts`, `offlineSupabase.ts`) को भी Git में जाने से रोक (ignore) दिया था! इस वजह से GitHub पर `src/lib/data` फ़ोल्डर मौजूद ही नहीं था, और Render पर बिल्ड के समय `no such file or directory: src/lib/data/config` का एरर आ रहा था।
- **100% परमानेंट समाधान**:
  1. `.gitignore` को ठीक करके `/data/` कर दिया गया और `!src/lib/data/` को स्पष्ट रूप से शामिल (unignore) कर दिया गया।
  2. पूरे `src/lib/data/` कोड को GitHub रिपॉज़िटरी में कमिट करके पुश कर दिया गया।
  3. अब Render पर कोड क्लोन होते ही सारी फ़ाइलें मिलेंगी और बिल्ड 100% पास हो जाएगा!

---

### Error 2: "Server 15 मिनट बाद Stop / Sleep हो जाता है (Cold Start Delay)"
- **कारण**: Render Free Tier पर जब 15 मिनट तक कोई वेबसाइट नहीं खोलता, तो वह सर्वर को सुला देता है। अगली बार खोलने पर 30-50 सेकंड का समय लगता है।
- **समाधान (100% Free Keep-Alive)**:
  1. [cron-job.org](https://cron-job.org/) पर मुफ़्त अकाउंट बनाएँ।
  2. **Create Cronjob** पर क्लिक करें।
  3. **URL**: `https://phonezone-erp.onrender.com/api/health`
  4. **Schedule**: **Every 10 minutes** (`*/10 * * * *`)
  5. **Save** कर दें।
  > **परिणाम**: Cron-Job हर 10 मिनट में सर्ver को पिंग करेगा, जिससे Render का सर्वर **24 घंटे 365 दिन कभी नहीं सोएगा!**

---

### Error 2: "Database 7 दिन बाद Supabase पर Paused हो गया"
- **कारण**: Supabase Free Tier पर अगर 7 दिन तक 0 डेटाबेस क्वेरी होती है, तो प्रोजेक्ट पॉज़ हो जाता है।
- **समाधान**:
  - हमारे नए अपडेट में `/api/health` पिंग के अंदर `SELECT 1` डेटाबेस टच पहले से लगा दिया गया है।
  - जब Cron-Job हर 10 मिनट में Render को जगाएगा, तो Render खुद Supabase डेटाबेस को भी जगाए रखेगा। **Supabase कभी भी पॉज़ नहीं होगा!**

---

### Error 3: "Build Failed: Out of Memory (OOM) on Free Tier"
- **कारण**: Render Free Tier पर RAM 512 MB होती है, कभी-कभी Vite बिल्ड के समय ज़्यादा RAM माँगता है।
- **समाधान**:
  Render के Environment Variables में यह जोड़ें:
  - **Key**: `NODE_OPTIONS`
  - **Value**: `--max-old-space-size=450`
  *(हमारे कोड में पहले से ऑप्टिमाइज़्ड चंक स्प्लिटिंग मौजूद है, इसलिए सामान्यतः OOM नहीं आता)*

---

### Error 4: "Port Binding Error (Service failed to bind to $PORT)"
- **कारण**: Express सर्वर सिर्फ `localhost` पर सुन रहा हो और Render के इनपुट पोर्ट को न पकड़े।
- **समाधान**:
  हमारे `backend/src/server.js` में हमने कोड पहले ही अपडेट कर दिया है:
  `host: 0.0.0.0` और `port: process.env.PORT || 47713`
  इसलिए यह एरर आपके प्रोजेक्ट में 0% आएगी।

---

### Error 5: "Server Restart होने पर डेटा रीसेट हो जाना (Render Ephemeral Disk)"
- **कारण**: Render Free Tier पर लोकल फ़ाइलें सर्वर रीस्टार्ट होने पर हट जाती हैं।
- **समाधान**:
  डेटाबेस के लिए **Supabase PostgreSQL** का इस्तेमाल करें:
  1. [`supabase/supabase_complete_schema.sql`](./supabase/supabase_complete_schema.sql) को Supabase SQL Editor में चलाएँ।
  2. Render के Environment Variables में `SUPABASE_URL` और `SUPABASE_ANON_KEY` डाल दें।
  3. सारा डेटा Supabase के क्लाउड में हमेशा के लिए सुरक्षित रहेगा!

---

## 📱 Mobile APK को Render से कैसे जोड़ें?

1. अपने मोबाइल में **PhoneZone APK** खोलें।
2. स्क्रीन पर Server / API URL माँगे जाने पर अपना Render URL डालें:
   `https://phonezone-erp.onrender.com/api`
3. बस! आपका मोबाइल सीधे Render के सुपरफ़ास्ट क्लाउड से कनेक्ट हो जाएगा!
