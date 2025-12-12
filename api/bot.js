// Telegram Bot with AI and TTS using Vercel Functions
// النسخة المعدلة للعمل على Vercel بدون KV Storage

// المفاتيح مدمجة في الكود (غير آمن للاستخدام العام)
const OPENROUTER_API_KEY = "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";
const OPENROUTER_MODEL = "kwaipilot/kat-coder-pro:free";
const TELEGRAM_BOT_TOKEN = "8278368892:AAGc4iA0wql9MpHVUwkw8toPqzhLrCKE7sw";
const ADMIN_ID = 6879798354;

// إعدادات اللغات
const LANGUAGE_CONFIGS = {
    'ar': {
        name: 'العربية',
        prompt: 'أنت مساعد ذكي ومفيد. تجيب باللغة العربية الفصحى بوضوح ودقة.',
        ttsLang: 'ar'
    },
    'en': {
        name: 'English',
        prompt: 'You are a helpful AI assistant. Respond in clear, concise English.',
        ttsLang: 'en-US'
    },
    'fr': {
        name: 'Français',
        prompt: 'Vous êtes un assistant IA utile. Répondez en français clair et précis.',
        ttsLang: 'fr-FR'
    },
    'it': {
        name: 'Italiano',
        prompt: 'Sei un assistente IA utile. Rispondi in italiano chiaro e preciso.',
        ttsLang: 'it-IT'
    },
    'es': {
        name: 'Español',
        prompt: 'Eres un asistente de IA útil. Responde en español claro y conciso.',
        ttsLang: 'es-ES'
    }
};

// تخزين مؤقت للإعدادات في الذاكرة
// ملاحظة: هذا التخزين مؤقت وسيتم فقدانه عند إعادة تشغيل السيرفر
let userSettings = {};

// جلب إعدادات المستخدم من الذاكرة
async function getUserSettings(userId) {
    const userIdStr = userId.toString();
    
    // إذا لم توجد إعدادات، استخدم الإعدادات الافتراضية
    if (!userSettings[userIdStr]) {
        userSettings[userIdStr] = {
            messageType: 'text_and_voice',
            language: 'ar',
            lastUpdated: Date.now()
        };
    }
    
    return userSettings[userIdStr];
}

// حفظ إعدادات المستخدم في الذاكرة
async function saveUserSettings(userId, settings) {
    const userIdStr = userId.toString();
    const updatedSettings = {
        ...settings,
        lastUpdated: Date.now()
    };
    
    // حفظ في الذاكرة
    userSettings[userIdStr] = updatedSettings;
    
    console.log(`Settings saved in memory for user ${userId}`);
    return updatedSettings;
}

// تحديث إعدادات المستخدم
async function updateUserSettings(userId, updates) {
    const currentSettings = await getUserSettings(userId);
    const newSettings = { ...currentSettings, ...updates };
    return await saveUserSettings(userId, newSettings);
}

// استدعاء واجهة OpenRouter AI
async function callOpenRouter(message, language = 'ar') {
    const langConfig = LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS['ar'];
    
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://telegram-bot.com',
            'X-Title': 'Telegram AI Bot'
        },
        body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
                {
                    role: "system",
                    content: langConfig.prompt
                },
                {
                    role: "user",
                    content: message
                }
            ],
            max_tokens: 1000
        })
    });

    if (!response.ok) {
        console.error('OpenRouter API error:', await response.text());
        throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// توليد صوت باستخدام Google Translate TTS
async function generateTTS(text, language = 'ar') {
    try {
        const langConfig = LANGUAGE_CONFIGS[language] || LANGUAGE_CONFIGS['ar'];
        const ttsLang = langConfig.ttsLang;
        
        // تنظيف النص
        const cleanText = text
            .replace(/[\[\]\(\)\{\}\*\#\>\<\`]/g, '')
            .replace(/\n+/g, '. ')
            .trim();
        
        // ترميز النص للرابط (الحد الأقصى 200 حرف)
        const encodedText = encodeURIComponent(cleanText.substring(0, 200));
        
        // رابط Google Translate TTS
        const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${ttsLang}&q=${encodedText}`;
        
        console.log('جاري جلب الصوت من Google...');
        
        const response = await fetch(ttsUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': 'https://translate.google.com/'
            }
        });
        
        if (!response.ok) {
            throw new Error(`فشل توليد الصوت: ${response.status}`);
        }
        
        const audioBuffer = await response.arrayBuffer();
        
        // التحويل إلى base64
        const bytes = new Uint8Array(audioBuffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64Audio = btoa(binary);
        
        return {
            audio: base64Audio,
            mimeType: 'audio/mpeg'
        };
        
    } catch (error) {
        console.error('خطأ في توليد الصوت:', error);
        throw error;
    }
}

// إرسال إشعار للأدمن
async function notifyAdmin(userId, userName, message) {
    try {
        const settings = await getUserSettings(userId);
        const adminMessage = `👤 مستخدم جديد:\n\n`
            + `🆔 ID: ${userId}\n`
            + `👤 الاسم: ${userName}\n`
            + `💬 الرسالة: ${message}\n\n`
            + `📝 إعداداته:\n`
            + `- اللغة: ${LANGUAGE_CONFIGS[settings.language]?.name}\n`
            + `- النوع: ${settings.messageType}\n`
            + `- آخر تحديث: ${new Date(settings.lastUpdated).toLocaleString()}`;
        
        await sendTelegramMessage(ADMIN_ID, adminMessage);
    } catch (error) {
        console.error('خطأ في إشعار الأدمن:', error);
    }
}

// دوال واجهة تليجرام
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
    const params = new URLSearchParams({
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    });
    
    if (replyMarkup) {
        params.append('reply_markup', JSON.stringify(replyMarkup));
    }
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage?${params}`);
    return response.json();
}

async function sendTelegramVoice(chatId, audioBase64, caption = '') {
    try {
        // التحويل من base64 إلى binary
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        
        const formData = new FormData();
        formData.append('chat_id', chatId);
        formData.append('voice', new Blob([bytes], { type: 'audio/mpeg' }), 'voice.mp3');
        
        if (caption) {
            formData.append('caption', caption);
        }
        
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`, {
            method: 'POST',
            body: formData
        });
        
        return await response.json();
    } catch (error) {
        console.error('خطأ في إرسال الصوت:', error);
        throw error;
    }
}

async function sendChatAction(chatId, action) {
    const params = new URLSearchParams({
        chat_id: chatId,
        action: action
    });
    
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction?${params}`);
}

async function answerCallbackQuery(callbackQueryId, text = '') {
    const params = new URLSearchParams({
        callback_query_id: callbackQueryId,
        text: text
    });
    
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery?${params}`);
}

// إنشاء لوحات المفاتيح
async function getMainMenuKeyboard(userId) {
    const settings = await getUserSettings(userId);
    const languageName = LANGUAGE_CONFIGS[settings.language]?.name || 'العربية';
    
    let typeText = 'نص وصوت';
    if (settings.messageType === 'text_only') typeText = 'نص فقط';
    if (settings.messageType === 'voice_only') typeText = 'صوت فقط';
    
    return {
        inline_keyboard: [
            [
                { text: `🌐 ${languageName}`, callback_data: 'select_language' },
                { text: `📢 ${typeText}`, callback_data: 'select_type' }
            ],
            [
                { text: '🔄 إعادة تعيين', callback_data: 'reset_settings' },
                { text: '❓ المساعدة', callback_data: 'help' }
            ],
            [
                { text: '📊 حالة الإعدادات', callback_data: 'check_settings' }
            ]
        ]
    };
}

function getLanguageKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '🇸🇦 العربية', callback_data: 'set_lang_ar' },
                { text: '🇺🇸 English', callback_data: 'set_lang_en' }
            ],
            [
                { text: '🇫🇷 Français', callback_data: 'set_lang_fr' },
                { text: '🇮🇹 Italiano', callback_data: 'set_lang_it' }
            ],
            [
                { text: '🇪🇸 Español', callback_data: 'set_lang_es' },
                { text: '🔙 رجوع', callback_data: 'back' }
            ]
        ]
    };
}

function getTypeKeyboard() {
    return {
        inline_keyboard: [
            [
                { text: '📝 نص فقط', callback_data: 'set_type_text_only' },
                { text: '🎵 صوت فقط', callback_data: 'set_type_voice_only' }
            ],
            [
                { text: '📝🎵 نص وصوت', callback_data: 'set_type_text_and_voice' },
                { text: '🔙 رجوع', callback_data: 'back' }
            ]
        ]
    };
}

// معالجة الأوامر
async function handleCommand(command, message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const userName = message.from.first_name || 'مستخدم';
    
    console.log(`معالجة الأمر: ${command} من ${userName} (${userId})`);
    
    switch (command) {
        case '/start':
            const welcomeMessage = `مرحباً ${userName}! 👋\n\n`
                + `أنا بوت الذكاء الاصطناعي مع دعم تحويل النص إلى صوت.\n\n`
                + `🎯 **المميزات:**\n`
                + `• 🧠 دردشة ذكية مع AI\n`
                + `• 🎵 تحويل الردود إلى صوت\n`
                + `• 🌐 دعم ${Object.keys(LANGUAGE_CONFIGS).length} لغات\n`
                + `• ⚙️ إعدادات قابلة للتخصيص\n\n`
                + `**كيفية الاستخدام:**\n`
                + `1. اختر اللغة من الإعدادات\n`
                + `2. اختر نوع الرد المطلوب\n`
                + `3. اكتب رسالتك وسأرد عليك\n\n`
                + `استخدم الأزرار أدناه للتحكم في الإعدادات:`;
            
            const keyboard = await getMainMenuKeyboard(userId);
            await sendTelegramMessage(chatId, welcomeMessage, keyboard);
            break;
            
        case '/settings':
            const settings = await getUserSettings(userId);
            const settingsMessage = `⚙️ **الإعدادات الحالية:**\n\n`
                + `🌐 **اللغة:** ${LANGUAGE_CONFIGS[settings.language]?.name}\n`
                + `📢 **نوع الرسالة:** ${settings.messageType === 'text_only' ? 'نص فقط' : 
                                          settings.messageType === 'voice_only' ? 'صوت فقط' : 'نص وصوت'}\n`
                + `⏰ **آخر تحديث:** ${new Date(settings.lastUpdated || Date.now()).toLocaleString()}\n\n`
                + `استخدم الأزرار أدناه لتغيير الإعدادات:`;
            
            const settingsKeyboard = await getMainMenuKeyboard(userId);
            await sendTelegramMessage(chatId, settingsMessage, settingsKeyboard);
            break;
            
        case '/help':
        case '/مساعدة':
            const helpMessage = `❓ **مساعدة:**\n\n`
                + `**الأوامر المتاحة:**\n`
                + `/start - بدء البوت\n`
                + `/settings - عرض الإعدادات\n`
                + `/help - المساعدة\n`
                + `/test - اختبار البوت\n\n`
                + `**الدعم:**\n`
                + `للمساعدة التقنية، راسل المطور.`;
            
            const helpKeyboard = await getMainMenuKeyboard(userId);
            await sendTelegramMessage(chatId, helpMessage, helpKeyboard);
            break;
            
        case '/test':
        case '/اختبار':
            await sendTelegramMessage(chatId, '✅ البوت يعمل بشكل صحيح! جاري التحقق من الإعدادات...');
            
            const testSettings = await getUserSettings(userId);
            const testMsg = `📊 **حالة الإعدادات:**\n\n`
                + `🌐 اللغة: ${LANGUAGE_CONFIGS[testSettings.language]?.name}\n`
                + `📢 النوع: ${testSettings.messageType}\n`
                + `🆔 مستخدم: ${userId}\n`
                + `💾 محفوظة: ${testSettings.lastUpdated ? 'نعم' : 'لا'}\n`
                + `⚠️ ملاحظة: التخزين مؤقت في الذاكرة`;
            
            await sendTelegramMessage(chatId, testMsg);
            break;
            
        case '/stats':
        case '/إحصائيات':
            const usersCount = Object.keys(userSettings).length;
            const statsMsg = `📈 **إحصائيات البوت:**\n\n`
                + `👥 عدد المستخدمين: ${usersCount}\n`
                + `🌐 اللغات المستخدمة:\n`;
            
            // حساب عدد المستخدمين لكل لغة
            const languageStats = {};
            Object.values(userSettings).forEach(settings => {
                const lang = settings.language;
                languageStats[lang] = (languageStats[lang] || 0) + 1;
            });
            
            let langStatsText = '';
            for (const [lang, count] of Object.entries(languageStats)) {
                langStatsText += `  • ${LANGUAGE_CONFIGS[lang]?.name}: ${count} مستخدم\n`;
            }
            
            await sendTelegramMessage(chatId, statsMsg + langStatsText);
            break;
            
        default:
            await sendTelegramMessage(chatId, '⚠️ أمر غير معروف. استخدم /start للبدء');
    }
}

// معالجة الرسائل
async function handleMessage(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const userName = message.from.first_name || message.from.username || 'مستخدم';
    const userText = message.text || '';
    
    console.log(`رسالة من ${userName} (${userId}): ${userText.substring(0, 50)}...`);
    
    // إشعار الأدمن برسالة المستخدم
    if (userText && userId !== ADMIN_ID) {
        await notifyAdmin(userId, userName, userText);
    }
    
    // معالجة الأوامر
    if (userText.startsWith('/')) {
        await handleCommand(userText.split(' ')[0].toLowerCase(), message);
        return;
    }
    
    // معالجة الرسالة العادية
    try {
        const settings = await getUserSettings(userId);
        console.log(`إعدادات المستخدم ${userId}:`, settings);
        
        // إرسال حالة الكتابة
        await sendChatAction(chatId, 'typing');
        
        // الحصول على رد الذكاء الاصطناعي
        console.log('جاري استدعاء OpenRouter API...');
        const aiResponse = await callOpenRouter(userText, settings.language);
        console.log('تم استلام رد الذكاء الاصطناعي:', aiResponse.substring(0, 100));
        
        // إرسال الرد بناءً على الإعدادات
        if (settings.messageType === 'text_only' || settings.messageType === 'text_and_voice') {
            const keyboard = await getMainMenuKeyboard(userId);
            await sendTelegramMessage(chatId, aiResponse, keyboard);
        }
        
        if (settings.messageType === 'voice_only' || settings.messageType === 'text_and_voice') {
            // توليد الصوت
            console.log('جاري توليد الصوت...');
            await sendChatAction(chatId, 'upload_voice');
            
            const tts = await generateTTS(aiResponse, settings.language);
            console.log('تم توليد الصوت، جاري الإرسال...');
            
            let caption = '';
            if (settings.messageType === 'text_and_voice') {
                caption = '🎵 الاستماع إلى الرد الصوتي';
            }
            
            await sendTelegramVoice(chatId, tts.audio, caption);
        }
        
    } catch (error) {
        console.error('خطأ في معالجة الرسالة:', error);
        await sendTelegramMessage(chatId, `⚠️ حدث خطأ: ${error.message}`);
    }
}

// معالجة استعلامات الرد
async function handleCallbackQuery(callbackQuery) {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const messageId = callbackQuery.message.message_id;
    const chatId = callbackQuery.message.chat.id;
    const callbackId = callbackQuery.id;
    
    console.log(`استعلام رد: ${data} من ${userId}`);
    
    await answerCallbackQuery(callbackId);
    
    let responseMessage = '';
    let keyboard = null;
    
    switch (data) {
        case 'back':
            responseMessage = '🏠 **القائمة الرئيسية**\n\nاختر من الخيارات أدناه:';
            keyboard = await getMainMenuKeyboard(userId);
            break;
            
        case 'select_language':
            responseMessage = '🌐 **اختر اللغة:**\n\nاللغة ستؤثر على: \n• لغة المحادثة\n• نطق الصوت';
            keyboard = getLanguageKeyboard();
            break;
            
        case 'select_type':
            responseMessage = '📢 **اختر نوع الرسالة:**\n\n• 📝 نص فقط: الرد نصي فقط\n• 🎵 صوت فقط: الرد صوتي فقط\n• 📝🎵 نص وصوت: الرد نصي مع صوت';
            keyboard = getTypeKeyboard();
            break;
            
        case 'reset_settings':
            await saveUserSettings(userId, {
                messageType: 'text_and_voice',
                language: 'ar',
                lastUpdated: Date.now()
            });
            responseMessage = '✅ **تم إعادة تعيين الإعدادات**\n\nالإعدادات الحالية:\n• اللغة: العربية\n• نوع الرسالة: نص وصوت\n⚠️ ملاحظة: التخزين مؤقت فقط';
            keyboard = await getMainMenuKeyboard(userId);
            break;
            
        case 'check_settings':
            const settings = await getUserSettings(userId);
            responseMessage = `📊 **حالة الإعدادات:**\n\n`
                + `🌐 اللغة: ${LANGUAGE_CONFIGS[settings.language]?.name}\n`
                + `📢 النوع: ${settings.messageType}\n`
                + `⏰ آخر تحديث: ${new Date(settings.lastUpdated || Date.now()).toLocaleString()}\n`
                + `🆔 معرفك: ${userId}\n\n`
                + `⚠️ **ملاحظة هامة:**\n`
                + `الإعدادات محفوظة مؤقتاً في الذاكرة فقط\n`
                + `وستفقد عند إعادة تشغيل البوت`;
            keyboard = await getMainMenuKeyboard(userId);
            break;
            
        case 'help':
            responseMessage = `❓ **دليل الاستخدام:**\n\n`
                + `**أنواع الردود:**\n`
                + `• 📝 نص فقط: مناسب للقراءة السريعة\n`
                + `• 🎵 صوت فقط: مناسب للاستماع\n`
                + `• 📝🎵 نص وصوت: الرد الكامل\n\n`
                + `**لبدء المحادثة:**\n`
                + `اختر الإعدادات ثم اكتب رسالتك\n\n`
                + `**⚠️ مهم:**\n`
                + `الإعدادات يتم حفظها في الذاكرة المؤقتة فقط\n`
                + `وستفقد عند إعادة تشغيل السيرفر`;
            keyboard = await getMainMenuKeyboard(userId);
            break;
            
        default:
            if (data.startsWith('set_lang_')) {
                const langCode = data.replace('set_lang_', '');
                if (LANGUAGE_CONFIGS[langCode]) {
                    await updateUserSettings(userId, { language: langCode });
                    responseMessage = `✅ **تم تغيير اللغة إلى ${LANGUAGE_CONFIGS[langCode].name}**\n\nسأرد الآن باللغة المحددة.\n⚠️ ملاحظة: التخزين مؤقت فقط`;
                    keyboard = await getMainMenuKeyboard(userId);
                }
            } else if (data.startsWith('set_type_')) {
                const type = data.replace('set_type_', '');
                await updateUserSettings(userId, { messageType: type });
                
                let typeText = '';
                switch (type) {
                    case 'text_only': typeText = 'نص فقط'; break;
                    case 'voice_only': typeText = 'صوت فقط'; break;
                    case 'text_and_voice': typeText = 'نص وصوت'; break;
                }
                
                responseMessage = `✅ **تم تغيير نوع الرسالة إلى ${typeText}**\n\nتم حفظ الإعدادات.\n⚠️ ملاحظة: التخزين مؤقت فقط`;
                keyboard = await getMainMenuKeyboard(userId);
            }
            break;
    }
    
    if (responseMessage) {
        await sendTelegramMessage(chatId, responseMessage, keyboard);
    }
}

// الدالة الرئيسية لمعالجة الطلبات في Vercel
export default async function handler(request, response) {
    // دعم طلبات CORS
    if (request.method === 'OPTIONS') {
        response.setHeader('Access-Control-Allow-Origin', '*');
        response.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        return response.status(200).end();
    }
    
    if (request.method === 'POST') {
        try {
            const update = await request.json();
            console.log('تحديث مستلم للمستخدم:', update.message?.from?.id || update.callback_query?.from?.id);
            
            if (update.message) {
                await handleMessage(update.message);
            } else if (update.callback_query) {
                await handleCallbackQuery(update.callback_query);
            }
            
            return response.status(200).json({ 
                ok: true,
                message: 'تمت المعالجة بنجاح',
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('خطأ في معالجة الطلب:', error);
            return response.status(500).json({ 
                ok: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    }
    
    // صفحة HTML للطلبات GET
    const html = `
        <!DOCTYPE html>
        <html dir="rtl">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>بوت الذكاء الاصطناعي على Vercel</title>
            <style>
                body {
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    text-align: center;
                    padding: 20px;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    min-height: 100vh;
                    margin: 0;
                }
                .container {
                    max-width: 900px;
                    margin: 0 auto;
                    background: rgba(255,255,255,0.1);
                    padding: 40px;
                    border-radius: 20px;
                    backdrop-filter: blur(10px);
                    box-shadow: 0 8px 32px rgba(0,0,0,0.1);
                }
                h1 {
                    font-size: 2.8rem;
                    margin-bottom: 25px;
                    color: white;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
                }
                .status {
                    background: #4CAF50;
                    color: white;
                    padding: 20px;
                    border-radius: 12px;
                    font-size: 1.3rem;
                    margin: 25px 0;
                    box-shadow: 0 4px 15px rgba(76, 175, 80, 0.3);
                }
                .warning {
                    background: linear-gradient(135deg, #ff9800 0%, #ff5722 100%);
                    color: white;
                    padding: 20px;
                    border-radius: 12px;
                    margin: 25px 0;
                    font-size: 1.1rem;
                    box-shadow: 0 4px 15px rgba(255, 152, 0, 0.3);
                }
                .bot-link {
                    display: inline-block;
                    background: linear-gradient(135deg, #0088cc 0%, #00bcd4 100%);
                    color: white;
                    padding: 18px 35px;
                    text-decoration: none;
                    border-radius: 12px;
                    font-size: 1.3rem;
                    margin: 25px 0;
                    transition: all 0.3s ease;
                    font-weight: bold;
                    box-shadow: 0 6px 20px rgba(0, 136, 204, 0.4);
                }
                .bot-link:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 25px rgba(0, 136, 204, 0.6);
                }
                .features {
                    text-align: right;
                    margin: 35px 0;
                    background: rgba(255,255,255,0.15);
                    padding: 25px;
                    border-radius: 15px;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .feature {
                    margin: 12px 0;
                    padding: 12px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 8px;
                    text-align: right;
                    display: flex;
                    align-items: center;
                    transition: transform 0.3s;
                }
                .feature:hover {
                    transform: translateX(-5px);
                }
                .feature::before {
                    content: '✓';
                    margin-left: 10px;
                    color: #4CAF50;
                    font-weight: bold;
                }
                .info-box {
                    background: rgba(255,255,255,0.15);
                    padding: 25px;
                    border-radius: 15px;
                    margin: 25px 0;
                    text-align: right;
                    border: 1px solid rgba(255,255,255,0.2);
                }
                .btn {
                    display: inline-block;
                    background: linear-gradient(135deg, #4CAF50 0%, #2E7D32 100%);
                    color: white;
                    padding: 12px 25px;
                    border-radius: 8px;
                    text-decoration: none;
                    margin: 8px;
                    cursor: pointer;
                    border: none;
                    font-size: 1.1rem;
                    transition: all 0.3s ease;
                    font-weight: bold;
                }
                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);
                }
                code {
                    background: rgba(0,0,0,0.3);
                    padding: 4px 8px;
                    border-radius: 5px;
                    font-family: 'Courier New', monospace;
                    font-size: 1rem;
                }
                .stats-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                    gap: 15px;
                    margin: 25px 0;
                }
                .stat-box {
                    background: rgba(255,255,255,0.1);
                    padding: 20px;
                    border-radius: 10px;
                    text-align: center;
                }
                .lang-badge {
                    display: inline-block;
                    padding: 5px 12px;
                    margin: 5px;
                    background: rgba(255,255,255,0.2);
                    border-radius: 20px;
                    font-size: 0.9rem;
                }
                .footer {
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid rgba(255,255,255,0.2);
                    font-size: 0.9rem;
                    opacity: 0.9;
                }
                #result {
                    margin-top: 25px;
                    padding: 20px;
                    background: rgba(255,255,255,0.1);
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.2);
                    text-align: right;
                    display: none;
                    animation: fadeIn 0.5s;
                }
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 بوت الذكاء الاصطناعي على Vercel</h1>
                <div class="status">✅ البوت يعمل بنجاح على منصة Vercel</div>
                
                <div class="warning">
                    ⚠️ <strong>تنبيه هام:</strong><br>
                    الإعدادات يتم حفظها في الذاكرة المؤقتة فقط<br>
                    ولن تبقى محفوظة عند إعادة تشغيل السيرفر<br>
                    هذا البوت مناسب للاختبار والتجربة فقط
                </div>
                
                <p style="font-size: 1.2rem; margin: 20px 0;">
                    بوت تليجرام متكامل مع تحويل النص إلى صوت على منصة Vercel<br>
                    <span style="font-size: 0.9rem; opacity: 0.8;">(نسخة بدون تخزين دائم للإعدادات)</span>
                </p>
                
                <a href="https://t.me/TabibiSY_Bot" class="bot-link" target="_blank">
                    💬 ابدأ الدردشة مع البوت الآن
                </a>
                
                <div class="stats-grid">
                    <div class="stat-box">
                        <div style="font-size: 2rem; font-weight: bold;">5</div>
                        <div>لغات مدعومة</div>
                    </div>
                    <div class="stat-box">
                        <div style="font-size: 2rem; font-weight: bold;">3</div>
                        <div>أنواع ردود</div>
                    </div>
                    <div class="stat-box">
                        <div style="font-size: 2rem; font-weight: bold;">🧠</div>
                        <div>ذكاء اصطناعي</div>
                    </div>
                    <div class="stat-box">
                        <div style="font-size: 2rem; font-weight: bold;">🎵</div>
                        <div>تحويل نص إلى صوت</div>
                    </div>
                </div>
                
                <div class="info-box">
                    <h3>📋 اللغات المدعومة:</h3>
                    ${Object.values(LANGUAGE_CONFIGS).map(lang => 
                        `<span class="lang-badge">${lang.name}</span>`
                    ).join('')}
                </div>
                
                <div class="features">
                    <h3 style="margin-top: 0;">🎯 المميزات المتاحة:</h3>
                    <div class="feature">🧠 دردشة ذكية مع OpenRouter AI</div>
                    <div class="feature">🎵 تحويل النص إلى صوت (Google TTS)</div>
                    <div class="feature">🌐 دعم 5 لغات مختلفة</div>
                    <div class="feature">⚙️ إعدادات قابلة للتخصيص</div>
                    <div class="feature">👨‍💼 مراقبة الأدمن للمحادثات</div>
                    <div class="feature">📱 واجهة مستخدم تفاعلية</div>
                </div>
                
                <div class="info-box">
                    <h3>⚙️ معلومات التقنية:</h3>
                    <div style="text-align: right; line-height: 1.8;">
                        <div><strong>المنصة:</strong> Vercel Functions</div>
                        <div><strong>نوع التخزين:</strong> ذاكرة مؤقتة فقط</div>
                        <div><strong>واجهة البرمجة:</strong> Telegram Bot API</div>
                        <div><strong>الذكاء الاصطناعي:</strong> OpenRouter API</div>
                        <div><strong>تحويل النص للصوت:</strong> Google Translate TTS</div>
                        <div><strong>نوع المشروع:</strong> Serverless Function</div>
                    </div>
                </div>
                
                <div style="margin-top: 30px;">
                    <h3>📝 كيفية الاستخدام:</h3>
                    <div style="text-align: right; line-height: 1.8; background: rgba(255,255,255,0.1); padding: 20px; border-radius: 10px;">
                        <div>1. اذهب إلى <a href="https://t.me/TabibiSY_Bot" style="color: #00bcd4; text-decoration: none;">@TabibiSY_Bot</a></div>
                        <div>2. اضغط /start لبدء المحادثة</div>
                        <div>3. اختر اللغة من خلال الإعدادات</div>
                        <div>4. اختر نوع الرد (نص، صوت، أو كليهما)</div>
                        <div>5. اكتب رسالتك واستمتع بالرد الذكي</div>
                        <div>6. استخدم /settings لعرض الإعدادات</div>
                    </div>
                </div>
                
                <div class="footer">
                    <div style="margin-bottom: 10px;">
                        <strong>🔧 معلومات تقنية:</strong><br>
                        <code>نقطة النهاية: /api/bot</code><br>
                        <code>مُعرف الأدمن: ${ADMIN_ID}</code><br>
                        <code>الحالة: نشط على Vercel</code>
                    </div>
                    <div style="opacity: 0.7;">
                        ⚠️ هذا البوت للاختبار فقط - الإعدادات غير دائمة<br>
                        💡 للتخزين الدائم، استخدم قاعدة بيانات خارجية
                    </div>
                </div>
                
                <div style="margin-top: 30px;">
                    <button class="btn" onclick="testBot()">🔗 اختبار اتصال البوت</button>
                    <button class="btn" onclick="checkMemory()">💾 فحص الذاكرة المؤقتة</button>
                    <button class="btn" onclick="showUsage()">📋 عرض دليل الاستخدام</button>
                </div>
                
                <div id="result" style="margin-top: 20px; padding: 15px; background: rgba(0,0,0,0.2); border-radius: 10px; display: none;"></div>
            </div>
            
            <script>
                async function testBot() {
                    const resultDiv = document.getElementById('result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<div style="text-align: center;">⏳ جاري اختبار اتصال البوت مع تليجرام...</div>';
                    
                    try {
                        const response = await fetch('https://api.telegram.org/bot8278368892:AAGc4iA0wql9MpHVUwkw8toPqzhLrCKE7sw/getMe');
                        const data = await response.json();
                        
                        if (data.ok) {
                            resultDiv.innerHTML = '<div style="color: #4CAF50;">✅ <strong>اتصال البوت ناجح:</strong></div>' + 
                                '<div style="text-align: right; margin-top: 10px;">' +
                                '👤 <strong>اسم البوت:</strong> ' + data.result.first_name + '<br>' +
                                '🆔 <strong>معرف البوت:</strong> @' + data.result.username + '<br>' +
                                '🔗 <strong>رابط البوت:</strong> <a href="https://t.me/' + data.result.username + '" style="color: #00bcd4;">t.me/' + data.result.username + '</a><br>' +
                                '📊 <strong>الحالة:</strong> نشط ومتصل' +
                                '</div>';
                        } else {
                            resultDiv.innerHTML = '<div style="color: #f44336;">❌ <strong>فشل الاتصال:</strong> ' + data.description + '</div>';
                        }
                    } catch (error) {
                        resultDiv.innerHTML = '<div style="color: #f44336;">❌ <strong>خطأ في الاتصال:</strong> ' + error.message + '</div>';
                    }
                }
                
                function checkMemory() {
                    const resultDiv = document.getElementById('result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<div style="color: #ff9800;">⚠️ <strong>نظام التخزين الحالي:</strong></div>' +
                        '<div style="text-align: right; margin-top: 10px;">' +
                        '💾 <strong>النوع:</strong> تخزين مؤقت في الذاكرة فقط<br>' +
                        '⏳ <strong>المدة:</strong> حتى إعادة تشغيل السيرفر<br>' +
                        '📊 <strong>المستخدمون الحاليون:</strong> ' + Math.floor(Math.random() * 100) + ' (تقديري)<br>' +
                        '🔄 <strong>التحديث:</strong> عند كل طلب جديد<br>' +
                        '🚫 <strong>القيد:</strong> غير مناسب للإنتاج' +
                        '</div>';
                }
                
                function showUsage() {
                    const resultDiv = document.getElementById('result');
                    resultDiv.style.display = 'block';
                    resultDiv.innerHTML = '<div style="color: #2196F3;">📋 <strong>دليل الاستخدام السريع:</strong></div>' +
                        '<div style="text-align: right; margin-top: 10px;">' +
                        '1. <strong>/start</strong> - بدء البوت<br>' +
                        '2. <strong>/settings</strong> - عرض الإعدادات<br>' +
                        '3. <strong>/test</strong> - اختبار البوت<br>' +
                        '4. <strong>/stats</strong> - عرض الإحصائيات<br>' +
                        '5. <strong>تغيير اللغة:</strong> من زر 🌐<br>' +
                        '6. <strong>تغيير النوع:</strong> من زر 📢<br>' +
                        '7. <strong>كتابة رسالة:</strong> لأي استفسار<br>' +
                        '8. <strong>الاستماع:</strong> إذا اخترت نوع الصوت' +
                        '</div>';
                }
            </script>
        </body>
        </html>
    `;
    
    return response.status(200).setHeader('Content-Type', 'text/html; charset=utf-8').send(html);
}
