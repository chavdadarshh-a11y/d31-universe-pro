/** v4.1 strings: Gold tier, in-app player, in-app downloads, grace period. Merged into strings.ts. */
export const en41 = {
  rememberMe: 'Remember me', googleContinue: 'Continue with Google', googleLaunchNote: 'Google sign-in switches on at launch — then your phone’s Google accounts appear here. For now, use email.', showPw: 'Show password', hidePw: 'Hide password',
  dlMissing: '{n} saved items are not on this phone yet (for example after reinstalling).', dlRestore: 'Download again', dlAutoWifi: 'Auto re-download on Wi-Fi', dlAutoWifiSub: 'Otherwise we ask first.', dlCloudDemo: 'Demo: this list is kept on this phone. Restoring it after a reinstall works once cloud accounts (Supabase) are switched on.', dlCloudOn: 'Your downloads list is backed up to your account — after a reinstall it comes back here.', dlUnlockedUntil: 'Grace period · full Platinum access until {t}', dlGraceShort: 'Grace',
  cmp_platinumPaths: 'Advanced skill paths', cmp_knowledgeDl: 'Save Knowledge videos & PDFs in the app', cmp_player: 'In-app player for every Knowledge video',
  dlTitle: 'Downloads', dlSub: 'Saved inside the app only — never to your gallery or files.', dlEmpty: 'Nothing saved yet. Open a Knowledge post and tap “Save in app”.',
  dlSave: 'Save in app', dlSaving: 'Saving… {p}%', dlSaved: 'Saved in app', dlDelete: 'Delete', dlDeleted: 'Removed from this phone', dlUsed: '{x} used on this phone',
  dlLocked: 'Locked', dlRenew: 'Renew to unlock', dlGrace: 'Pass ended · downloads stay open until {t}', dlFailed: 'Download failed. Check your internet and try again.', dlAtLaunch: 'Save', dlNeedsKey: 'Saving videos & PDFs inside the app switches on at launch. Photos can be saved now.',
  dlOpen: 'Open', dlOffline: 'Offline', dlCount: '{n} items',
  graceRule: 'When a Platinum pass ends, saved items stay open for 10 h (ended 00:00–05:59), 3 h (06:00–11:59) or 1 h (12:00–23:59). Then they stay on this phone but lock until you renew.',
  demoExpire: 'Simulate pass ending now', demoExpired: 'Demo · pass ended',
  pSpeed: 'Speed', pReset: 'Reset', pLoop: 'Loop', pLock: 'Lock controls', pUnlock: 'Unlock', pFullscreen: 'Full screen', pPrev: 'Previous video', pNext: 'Next video',
  pBack10: 'Back 10 seconds', pFwd10: 'Forward 10 seconds', pPlay: 'Play', pPause: 'Pause', pClose: 'Close', pDoubleTap: 'Double-tap left / right to skip 10 s',
  pStreamFail: 'This video can’t stream directly. Showing Drive’s player inside the app.',
}
type D41 = Record<keyof typeof en41, string>

export const hi41: D41 = {
  rememberMe: 'मुझे याद रखें', googleContinue: 'Google से जारी रखें', googleLaunchNote: 'Google साइन-इन लॉन्च पर चालू होगा — तब आपके फ़ोन के Google अकाउंट यहाँ दिखेंगे। अभी ईमेल इस्तेमाल करें।', showPw: 'पासवर्ड दिखाएँ', hidePw: 'पासवर्ड छिपाएँ',
  dlMissing: '{n} सेव आइटम अभी इस फ़ोन पर नहीं हैं (जैसे दोबारा इंस्टॉल करने के बाद)।', dlRestore: 'फिर से डाउनलोड करें', dlAutoWifi: 'Wi-Fi पर अपने आप फिर डाउनलोड', dlAutoWifiSub: 'नहीं तो पहले पूछेंगे।', dlCloudDemo: 'डेमो: यह लिस्ट इसी फ़ोन पर है। दोबारा इंस्टॉल के बाद वापस लाना क्लाउड अकाउंट (Supabase) चालू होने पर काम करेगा।', dlCloudOn: 'आपकी डाउनलोड लिस्ट आपके अकाउंट में बैकअप है — दोबारा इंस्टॉल के बाद यहाँ वापस आएगी।', dlUnlockedUntil: 'ग्रेस पीरियड · {t} तक पूरा Platinum एक्सेस', dlGraceShort: 'ग्रेस',
  cmp_platinumPaths: 'एडवांस्ड स्किल पाथ', cmp_knowledgeDl: 'नॉलेज वीडियो और PDF ऐप में सेव करें', cmp_player: 'हर नॉलेज वीडियो के लिए इन-ऐप प्लेयर',
  dlTitle: 'डाउनलोड', dlSub: 'सिर्फ़ ऐप के अंदर सेव — गैलरी या फ़ाइलों में कभी नहीं।', dlEmpty: 'अभी कुछ सेव नहीं है। कोई नॉलेज पोस्ट खोलें और “ऐप में सेव करें” दबाएँ।',
  dlSave: 'ऐप में सेव करें', dlSaving: 'सेव हो रहा है… {p}%', dlSaved: 'ऐप में सेव है', dlDelete: 'हटाएँ', dlDeleted: 'इस फ़ोन से हटा दिया', dlUsed: 'इस फ़ोन पर {x} इस्तेमाल',
  dlLocked: 'लॉक', dlRenew: 'अनलॉक के लिए रिन्यू करें', dlGrace: 'पास ख़त्म · डाउनलोड {t} तक खुले रहेंगे', dlFailed: 'डाउनलोड नहीं हुआ। इंटरनेट चेक करके फिर कोशिश करें।', dlAtLaunch: 'सेव', dlNeedsKey: 'ऐप में वीडियो और PDF सेव करना लॉन्च पर चालू होगा। फ़ोटो अभी सेव हो सकती हैं।',
  dlOpen: 'खोलें', dlOffline: 'ऑफ़लाइन', dlCount: '{n} आइटम',
  graceRule: 'Platinum पास ख़त्म होने पर सेव आइटम 10 घंटे (00:00–05:59 पर ख़त्म), 3 घंटे (06:00–11:59) या 1 घंटा (12:00–23:59) तक खुले रहते हैं। फिर वे फ़ोन पर रहते हैं पर रिन्यू होने तक लॉक रहते हैं।',
  demoExpire: 'पास अभी ख़त्म करके देखें', demoExpired: 'डेमो · पास ख़त्म',
  pSpeed: 'स्पीड', pReset: 'रीसेट', pLoop: 'लूप', pLock: 'कंट्रोल लॉक करें', pUnlock: 'अनलॉक', pFullscreen: 'फ़ुल स्क्रीन', pPrev: 'पिछला वीडियो', pNext: 'अगला वीडियो',
  pBack10: '10 सेकंड पीछे', pFwd10: '10 सेकंड आगे', pPlay: 'चलाएँ', pPause: 'रोकें', pClose: 'बंद करें', pDoubleTap: 'बाएँ / दाएँ डबल-टैप करके 10 सेकंड स्किप करें',
  pStreamFail: 'यह वीडियो सीधे स्ट्रीम नहीं हो रहा। ऐप के अंदर Drive प्लेयर दिखा रहे हैं।',
}

export const gu41: D41 = {
  rememberMe: 'મને યાદ રાખો', googleContinue: 'Google સાથે ચાલુ રાખો', googleLaunchNote: 'Google સાઇન-ઇન લોન્ચ પર ચાલુ થશે — ત્યારે તમારા ફોનના Google એકાઉન્ટ અહીં દેખાશે. હમણાં ઇમેઇલ વાપરો.', showPw: 'પાસવર્ડ બતાવો', hidePw: 'પાસવર્ડ છુપાવો',
  dlMissing: '{n} સેવ આઇટમ હજી આ ફોન પર નથી (જેમ કે ફરી ઇન્સ્ટોલ કર્યા પછી).', dlRestore: 'ફરી ડાઉનલોડ કરો', dlAutoWifi: 'Wi-Fi પર આપોઆપ ફરી ડાઉનલોડ', dlAutoWifiSub: 'નહીં તો પહેલા પૂછીશું.', dlCloudDemo: 'ડેમો: આ લિસ્ટ આ ફોન પર જ છે. ફરી ઇન્સ્ટોલ પછી પાછું લાવવું ક્લાઉડ એકાઉન્ટ (Supabase) ચાલુ થયા પછી કામ કરશે.', dlCloudOn: 'તમારી ડાઉનલોડ લિસ્ટ તમારા એકાઉન્ટમાં બેકઅપ છે — ફરી ઇન્સ્ટોલ પછી અહીં પાછી આવશે.', dlUnlockedUntil: 'ગ્રેસ પીરિયડ · {t} સુધી સંપૂર્ણ Platinum એક્સેસ', dlGraceShort: 'ગ્રેસ',
  cmp_platinumPaths: 'એડવાન્સ્ડ સ્કિલ પાથ', cmp_knowledgeDl: 'નોલેજ વીડિયો અને PDF એપમાં સેવ કરો', cmp_player: 'દરેક નોલેજ વીડિયો માટે ઇન-એપ પ્લેયર',
  dlTitle: 'ડાઉનલોડ', dlSub: 'ફક્ત એપની અંદર સેવ — ગેલેરી કે ફાઇલોમાં ક્યારેય નહીં.', dlEmpty: 'હજી કંઈ સેવ નથી. કોઈ નોલેજ પોસ્ટ ખોલો અને “એપમાં સેવ કરો” દબાવો.',
  dlSave: 'એપમાં સેવ કરો', dlSaving: 'સેવ થાય છે… {p}%', dlSaved: 'એપમાં સેવ છે', dlDelete: 'કાઢો', dlDeleted: 'આ ફોનમાંથી કાઢી નાખ્યું', dlUsed: 'આ ફોન પર {x} વપરાયું',
  dlLocked: 'લૉક', dlRenew: 'અનલૉક માટે રિન્યૂ કરો', dlGrace: 'પાસ પૂરો · ડાઉનલોડ {t} સુધી ખુલ્લા રહેશે', dlFailed: 'ડાઉનલોડ ન થયું. ઇન્ટરનેટ તપાસી ફરી પ્રયાસ કરો.', dlAtLaunch: 'સેવ', dlNeedsKey: 'ઍપમાં વીડિયો અને PDF સેવ કરવાનું લૉન્ચ પર ચાલુ થશે. ફોટા હમણાં સેવ થઈ શકે છે.',
  dlOpen: 'ખોલો', dlOffline: 'ઑફલાઇન', dlCount: '{n} આઇટમ',
  graceRule: 'Platinum પાસ પૂરો થાય ત્યારે સેવ આઇટમ 10 કલાક (00:00–05:59 એ પૂરો), 3 કલાક (06:00–11:59) અથવા 1 કલાક (12:00–23:59) ખુલ્લા રહે છે. પછી ફોન પર રહે છે પણ રિન્યૂ સુધી લૉક રહે છે.',
  demoExpire: 'પાસ અત્યારે પૂરો કરીને જુઓ', demoExpired: 'ડેમો · પાસ પૂરો',
  pSpeed: 'સ્પીડ', pReset: 'રીસેટ', pLoop: 'લૂપ', pLock: 'કંટ્રોલ લૉક કરો', pUnlock: 'અનલૉક', pFullscreen: 'ફુલ સ્ક્રીન', pPrev: 'પાછલો વીડિયો', pNext: 'આગલો વીડિયો',
  pBack10: '10 સેકન્ડ પાછળ', pFwd10: '10 સેકન્ડ આગળ', pPlay: 'ચલાવો', pPause: 'રોકો', pClose: 'બંધ કરો', pDoubleTap: 'ડાબે / જમણે ડબલ-ટેપ કરી 10 સેકન્ડ સ્કિપ કરો',
  pStreamFail: 'આ વીડિયો સીધો સ્ટ્રીમ નથી થતો. એપની અંદર Drive પ્લેયર બતાવીએ છીએ.',
}
