const TelegramBot = require('node-telegram-bot-api');
const express = require('express');

// التوكن الخاص بك - سيتم تعيينه كمتغير بيئة في Vercel
const token = process.env.TELEGRAM_TOKEN || '8278368892:AAGc4iA0wql9MpHVUwkw8toPqzhLrCKE7sw';

// تهيئة البوت
const bot = new TelegramBot(token, { polling: false });

// إنشاء تطبيق Express
const app = express();
app.use(express.json());

// المسار الأساسي للتحقق من عمل الخادم
app.get('/', (req, res) => {
  res.json({ 
    status: 'active',
    message: 'Telegram Bot is running on Vercel!',
    bot: '@' + (bot.options.username || 'your_bot')
  });
});

// مسار ويب هوك لاستقبال التحديثات من تلجرام
app.post(`/webhook`, async (req, res) => {
  const update = req.body;
  
  // التأكد من وجود رسالة
  if (!update.message) {
    return res.sendStatus(200);
  }
  
  const chatId = update.message.chat.id;
  const messageText = update.message.text;
  const userName = update.message.from.first_name || 'مستخدم';
  
  console.log(`رسالة من ${userName}: ${messageText}`);
  
  try {
    // التعامل مع الأوامر
    if (messageText.startsWith('/')) {
      await handleCommand(chatId, messageText, userName);
    } else {
      // رد على الرسالة العادية
      await bot.sendMessage(chatId, `مرحباً ${userName}! لقد أرسلت: "${messageText}"`);
    }
  } catch (error) {
    console.error('خطأ في معالجة الرسالة:', error);
  }
  
  res.sendStatus(200);
});

// دالة للتعامل مع الأوامر
async function handleCommand(chatId, command, userName) {
  switch (command) {
    case '/start':
      await bot.sendMessage(
        chatId,
        `✨ *مرحباً ${userName}!* ✨\n\n` +
        `أنا بوت تلجرام يعمل على *Vercel*! 🚀\n\n` +
        `*الأوامر المتاحة:*\n` +
        `/start - بدء استخدام البوت\n` +
        `/help - عرض المساعدة\n` +
        `/about - معلومات عن البوت\n` +
        `/echo [نص] - إعادة إرسال النص\n` +
        `/time - عرض الوقت الحالي`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case '/help':
      await bot.sendMessage(
        chatId,
        `*🔧 المساعدة:*\n\n` +
        `هذا بوت توضيحي يعمل على منصة Vercel.\n` +
        `يمكنك إرسال أي رسالة وسأرد عليها.\n\n` +
        `جرب هذه الأوامر:\n` +
        `/start - بدء البوت\n` +
        `/about - معلومات\n` +
        `/time - الوقت الحالي`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case '/about':
      await bot.sendMessage(
        chatId,
        `*🤖 عن البوت:*\n\n` +
        `• الإصدار: 1.0.0\n` +
        `• المنصة: Vercel\n` +
        `• اللغة: JavaScript/Node.js\n` +
        `• الغرض: توضيحي/تعليمي\n\n` +
        `تم تطويره كمثال لبوت يعمل على Vercel.`,
        { parse_mode: 'Markdown' }
      );
      break;
      
    case '/time':
      const now = new Date();
      const timeString = now.toLocaleString('ar-EG', {
        timeZone: 'Africa/Cairo',
        hour12: true,
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
      });
      await bot.sendMessage(chatId, `🕒 الوقت الحالي:\n${timeString}`);
      break;
      
    default:
      if (command.startsWith('/echo ')) {
        const textToEcho = command.substring(6);
        if (textToEcho.trim()) {
          await bot.sendMessage(chatId, `📢: ${textToEcho}`);
        } else {
          await bot.sendMessage(chatId, 'الرجاء إدخال نص بعد /echo');
        }
      } else {
        await bot.sendMessage(chatId, '❌ أمر غير معروف! جرب /help لرؤية الأوامر المتاحة.');
      }
  }
}

// دالة لتعيين ويب هوك في تلجرام
async function setWebhook() {
  const webhookUrl = `${process.env.VERCEL_URL || 'https://your-project.vercel.app'}/webhook`;
  
  try {
    await bot.setWebHook(webhookUrl);
    console.log(`✅ تم تعيين Webhook: ${webhookUrl}`);
  } catch (error) {
    console.error('❌ خطأ في تعيين Webhook:', error);
  }
}

// بدء الخادم
const PORT = process.env.PORT || 3000;
app.listen(PORT, async () => {
  console.log(`✅ البوت يعمل على المنفذ ${PORT}`);
  
  // تعيين ويب هوك عند التشغيل
  if (process.env.VERCEL_URL) {
    await setWebhook();
  }
});

// تصدير التطبيق لاستخدامه في Vercel
module.exports = app;
