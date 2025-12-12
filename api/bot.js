import fetch from 'node-fetch';

// المفاتيح - يمكن تغييرها هنا مباشرة
const TELEGRAM_BOT_TOKEN = "8278368892:AAGc4iA0wql9MpHVUwkw8toPqzhLrCKE7sw";
const OPENROUTER_API_KEY = "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";
const OPENROUTER_MODEL = "kwaipilot/kat-coder-pro:free";
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

// تخزين مؤقت للإعدادات (سيتم فقدانه عند إعادة التشغيل)
const userSettings = new Map();

// ============= دوال المساعدة =============

// جلب إعدادات المستخدم
function getUserSettings(userId) {
    const userIdStr = userId.toString();
    
    if (!userSettings.has(userIdStr)) {
        userSettings.set(userIdStr, {
            messageType: 'text_and_voice',
            language: 'ar',
            lastUpdated: Date.now()
        });
    }
    
    return userSettings.get(userIdStr);
}

// حفظ إعدادات المستخدم
function saveUserSettings(userId, settings) {
    const userIdStr = userId.toString();
    const updatedSettings = {
        ...settings,
        lastUpdated: Date.now()
    };
    
    userSettings.set(userIdStr, updatedSettings);
    console.log(`✅ تم حفظ إعدادات المستخدم ${userId}`);
    return updatedSettings;
}

// تحديث إعدادات المستخدم
function updateUserSettings(userId, updates) {
    const currentSettings = getUserSettings(userId);
    const newSettings = { ...currentSettings, ...updates };
    return saveUserSettings(userId, newSettings);
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
        const errorText = await response.text();
        console.error('❌ خطأ في OpenRouter API:', errorText);
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
        
        console.log('🎵 جاري توليد الصوت من Google...');
        
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
        const base64Audio = Buffer.from(binary, 'binary').toString('base64');
        
        return {
            audio: base64Audio,
            mimeType: 'audio/mpeg'
        };
        
    } catch (error) {
        console.error('❌ خطأ في توليد الصوت:', error);
        throw error;
    }
}

// ============= دوال تليجرام =============

// إرسال رسالة نصية
async function sendTelegramMessage(chatId, text, replyMarkup = null) {
    const payload = {
        chat_id: chatId,
        text: text,
        parse_mode: 'HTML'
    };
    
    if (replyMarkup) {
        payload.reply_markup = replyMarkup;
    }
    
    const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    
    return await response.json();
}

// إرسال رسالة صوتية
async function sendTelegramVoice(chatId, audioBase64, caption = '') {
    try {
        // إنشاء FormData افتراضي
        const formData = new URLSearchParams();
        formData.append('chat_id', chatId);
        formData.append('voice', audioBase64);
        
        if (caption) {
            formData.append('caption', caption);
        }
        
        const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendVoice`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: formData.toString()
        });
        
        return await response.json();
    } catch (error) {
        console.error('❌ خطأ في إرسال الصوت:', error);
        throw error;
    }
}

// إرسال إجراء (typing, upload_voice, etc)
async function sendChatAction(chatId, action) {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendChatAction`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId,
            action: action
        })
    });
}

// الرد على استعلام callback
async function answerCallbackQuery(callbackQueryId, text = '') {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerCallbackQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            callback_query_id: callbackQueryId,
            text: text
        })
    });
}

// إشعار الأدمن
async function notifyAdmin(userId, userName, message) {
    try {
        const settings = getUserSettings(userId);
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
        console.error('❌ خطأ في إشعار الأدمن:', error);
    }
}

// ============= لوحات المفاتيح =============

// لوحة المفاتيح الرئيسية
function getMainMenuKeyboard(userId) {
    const settings = getUserSettings(userId);
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

// لوحة اختيار اللغة
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

// لوحة اختيار النوع
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

// ============= معالجة الأوامر =============

async function handleCommand(command, message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const userName = message.from.first_name || 'مستخدم';
    
    console.log(`📝 معالجة الأمر: ${command} من ${userName} (${userId})`);
    
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
            
            const keyboard = getMainMenuKeyboard(userId);
            await sendTelegramMessage(chatId, welcomeMessage, keyboard);
            break;
            
        case '/settings':
            const settings = getUserSettings(userId);
            const settingsMessage = `⚙️ **الإعدادات الحالية:**\n\n`
                + `🌐 **اللغة:** ${LANGUAGE_CONFIGS[settings.language]?.name}\n`
                + `📢 **نوع الرسالة:** ${settings.messageType === 'text_only' ? 'نص فقط' : 
                                          settings.messageType === 'voice_only' ? 'صوت فقط' : 'نص وصوت'}\n`
                + `⏰ **آخر تحديث:** ${new Date(settings.lastUpdated || Date.now()).toLocaleString()}\n\n`
                + `استخدم الأزرار أدناه لتغيير الإعدادات:`;
            
            const settingsKeyboard = getMainMenuKeyboard(userId);
            await sendTelegramMessage(chatId, settingsMessage, settingsKeyboard);
            break;
            
        case '/help':
        case '/مساعدة':
            const helpMessage = `❓ **مساعدة:**\n\n`
                + `**الأوامر المتاحة:**\n`
                + `/start - بدء البوت\n`
                + `/settings - عرض الإعدادات\n`
                + `/help - المساعدة\n`
                + `/test - اختبار البوت\n`
                + `/stats - إحصائيات البوت\n\n`
                + `**الدعم:**\n`
                + `للمساعدة التقنية، راسل المطور.`;
            
            const helpKeyboard = getMainMenuKeyboard(userId);
            await sendTelegramMessage(chatId, helpMessage, helpKeyboard);
            break;
            
        case '/test':
        case '/اختبار':
            await sendTelegramMessage(chatId, '✅ البوت يعمل بشكل صحيح! جاري التحقق من الإعدادات...');
            
            const testSettings = getUserSettings(userId);
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
            const usersCount = userSettings.size;
            const statsMsg = `📈 **إحصائيات البوت:**\n\n`
                + `👥 عدد المستخدمين: ${usersCount}\n`
                + `🌐 اللغات المستخدمة:\n`;
            
            // حساب عدد المستخدمين لكل لغة
            const languageStats = {};
            userSettings.forEach(settings => {
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

// ============= معالجة الرسائل =============

async function handleMessage(message) {
    const chatId = message.chat.id;
    const userId = message.from.id;
    const userName = message.from.first_name || message.from.username || 'مستخدم';
    const userText = message.text || '';
    
    console.log(`📩 رسالة من ${userName} (${userId}): ${userText.substring(0, 50)}...`);
    
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
        const settings = getUserSettings(userId);
        console.log(`⚙️ إعدادات المستخدم ${userId}:`, settings);
        
        // إرسال حالة الكتابة
        await sendChatAction(chatId, 'typing');
        
        // الحصول على رد الذكاء الاصطناعي
        console.log('🧠 جاري استدعاء OpenRouter API...');
        const aiResponse = await callOpenRouter(userText, settings.language);
        console.log('✅ تم استلام رد الذكاء الاصطناعي:', aiResponse.substring(0, 100));
        
        // إرسال الرد بناءً على الإعدادات
        if (settings.messageType === 'text_only' || settings.messageType === 'text_and_voice') {
            const keyboard = getMainMenuKeyboard(userId);
            await sendTelegramMessage(chatId, aiResponse, keyboard);
        }
        
        if (settings.messageType === 'voice_only' || settings.messageType === 'text_and_voice') {
            // توليد الصوت
            console.log('🎵 جاري توليد الصوت...');
            await sendChatAction(chatId, 'upload_voice');
            
            const tts = await generateTTS(aiResponse, settings.language);
            console.log('✅ تم توليد الصوت، جاري الإرسال...');
            
            let caption = '';
            if (settings.messageType === 'text_and_voice') {
                caption = '🎵 الاستماع إلى الرد الصوتي';
            }
            
            await sendTelegramVoice(chatId, tts.audio, caption);
        }
        
    } catch (error) {
        console.error('❌ خطأ في معالجة الرسالة:', error);
        await sendTelegramMessage(chatId, `⚠️ حدث خطأ: ${error.message}`);
    }
}

// ============= معالجة Callback Queries =============

async function handleCallbackQuery(callbackQuery) {
    const data = callbackQuery.data;
    const userId = callbackQuery.from.id;
    const chatId = callbackQuery.message.chat.id;
    const callbackId = callbackQuery.id;
    
    console.log(`🔘 استعلام: ${data} من ${userId}`);
    
    await answerCallbackQuery(callbackId);
    
    let responseMessage = '';
    let keyboard = null;
    
    switch (data) {
        case 'back':
            responseMessage = '🏠 **القائمة الرئيسية**\n\nاختر من الخيارات أدناه:';
            keyboard = getMainMenuKeyboard(userId);
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
            saveUserSettings(userId, {
                messageType: 'text_and_voice',
                language: 'ar',
                lastUpdated: Date.now()
            });
            responseMessage = '✅ **تم إعادة تعيين الإعدادات**\n\nالإعدادات الحالية:\n• اللغة: العربية\n• نوع الرسالة: نص وصوت\n⚠️ ملاحظة: التخزين مؤقت فقط';
            keyboard = getMainMenuKeyboard(userId);
            break;
            
        case 'check_settings':
            const settings = getUserSettings(userId);
            responseMessage = `📊 **حالة الإعدادات:**\n\n`
                + `🌐 اللغة: ${LANGUAGE_CONFIGS[settings.language]?.name}\n`
                + `📢 النوع: ${settings.messageType}\n`
                + `⏰ آخر تحديث: ${new Date(settings.lastUpdated || Date.now()).toLocaleString()}\n`
                + `🆔 معرفك: ${userId}\n\n`
                + `⚠️ **ملاحظة هامة:**\n`
                + `الإعدادات محفوظة مؤقتاً في الذاكرة فقط\n`
                + `وستفقد عند إعادة تشغيل البوت`;
            keyboard = getMainMenuKeyboard(userId);
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
            keyboard = getMainMenuKeyboard(userId);
            break;
            
        default:
            if (data.startsWith('set_lang_')) {
                const langCode = data.replace('set_lang_', '');
                if (LANGUAGE_CONFIGS[langCode]) {
                    updateUserSettings(userId, { language: langCode });
                    responseMessage = `✅ **تم تغيير اللغة إلى ${LANGUAGE_CONFIGS[langCode].name}**\n\nسأرد الآن باللغة المحددة.\n⚠️ ملاحظة: التخزين مؤقت فقط`;
                    keyboard = getMainMenuKeyboard(userId);
                }
            } else if (data.startsWith('set_type_')) {
                const type = data.replace('set_type_', '');
                updateUserSettings(userId, { messageType: type });
                
                let typeText = '';
                switch (type) {
                    case 'text_only': typeText = 'نص فقط'; break;
                    case 'voice_only': typeText = 'صوت فقط'; break;
                    case 'text_and_voice': typeText = 'نص وصوت'; break;
                }
                
                responseMessage = `✅ **تم تغيير نوع الرسالة إلى ${typeText}**\n\nتم حفظ الإعدادات.\n⚠️ ملاحظة: التخزين مؤقت فقط`;
                keyboard = getMainMenuKeyboard(userId);
            }
            break;
    }
    
    if (responseMessage) {
        await sendTelegramMessage(chatId, responseMessage, keyboard);
    }
}

// ============= الدالة الرئيسية =============

export default async function handler(req, res) {
    // إعدادات CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    // معالجة طلبات OPTIONS (لـ CORS preflight)
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    // معالجة طلبات GET (لعرض صفحة ويب)
    if (req.method === 'GET') {
        return res.status(200).json({
            status: 'active',
            service: 'Telegram AI Bot',
            webhook: '/api/bot',
            endpoints: {
                telegram_webhook: 'POST /api/bot',
                homepage: 'GET /'
            },
            stats: {
                users: userSettings.size,
                languages: Object.keys(LANGUAGE_CONFIGS).length,
                uptime: process.uptime()
            }
        });
    }
    
    // معالجة طلبات POST (webhook تليجرام)
    if (req.method === 'POST') {
        try {
            const update = req.body;
            
            if (!update) {
                return res.status(400).json({ error: 'No update data provided' });
            }
            
            console.log('📥 تحديث مستلم من تليجرام:', update.update_id);
            
            // معالجة الرسائل
            if (update.message) {
                await handleMessage(update.message);
            }
            
            // معالجة callback queries
            if (update.callback_query) {
                await handleCallbackQuery(update.callback_query);
            }
            
            return res.status(200).json({ 
                ok: true,
                message: 'Update processed successfully',
                update_id: update.update_id
            });
            
        } catch (error) {
            console.error('❌ خطأ في معالجة الطلب:', error);
            return res.status(500).json({ 
                ok: false,
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
    
    // طريقة HTTP غير مدعومة
    return res.status(405).json({ 
        error: 'Method not allowed',
        allowed: ['GET', 'POST', 'OPTIONS']
    });
}
